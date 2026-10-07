/**
 * HIST (design delta 1, D-4; Raayl answers 18, 28 and 30): the client's
 * transaction history under the client UID, through a port Nova implements.
 *
 *  - Append-only. A correction is a new entry that points at the key it corrects
 *    (answer 18, read as 19: numbering AMBIGUOUS in
 *    docs/KHUMO_ANSWERS.md; the independent basis is CLAUDE.md, "REVERSED means a compensating
 *    ledger entry only", so append-only does not rest on the ambiguity). `edit` and `remove`
 *    exist on the port only to be refused, so an adapter cannot grow them.
 *  - One entry per business event. The idempotency key is `hist:<paymentId>:<eventId>`
 *    (D-4). The same key with the same body replays; with another body it is KEY_CONFLICT.
 *  - Every leg, failure, retry (a NEW payment linked to the original, answer 28),
 *    correction and operator action is an entry.
 *  - Supporting documents are references by opaque ID only (answer 30). No document
 *    content, no URL and no free text: every descriptive field is a closed code, so
 *    free text enters the history through this package, and nothing goes on-chain. Opaque ids
 *    (`operator.actor`, `caseRef`, `clientUid`) are only as private as the caller makes them:
 *    they must be staff-directory or client-UID ids, never a name or an email.
 *  - Unknown fields are refused (fail closed), never stored.
 *  - Writing history never moves money. The caller's outbox retries an AMBIGUOUS or
 *    UNAVAILABLE append; the ledger stays the system of record (D-4).
 *
 * Idempotency is a port promise (D-4). Whether Nova's own history store dedupes is OPEN (DQ-5),
 * so a Nova adapter must dedupe on the key itself or refuse to start (configure-or-fail-closed).
 * The failed-write case (a failing history write leaves the money transition committed and the
 * outbox item pending, the aged-failure case `HISTORY_WRITE_FAILED`, A-2) belongs to the caller
 * (JORCH/OPS), not to this port; it is tracked there so it is not lost.
 *
 * Assumption DA-7 (docs/KHUMO_QUESTIONS.md): each client has a UID and Nova's
 * history accepts document references. Where it lives is open (DQ-5).
 *
 * Money path: no `number` anywhere (MC-01). Amounts are `bigint` units of a ledger asset.
 */

import { isIdempotencyKey, isPaymentId, lpDigestHex, normaliseHex32, rejected, ok } from '../nova-ports/ids.js';
import type { Hex32, IdempotencyKey, LedgerAssetCode, NovaOwnerRef, PaymentId, PortResult } from '../nova-ports/ids.js';
import { REASONS_BY_STAGE, STATUS_BY_STAGE } from '../status/index.js';
import type { FailureStage, LegKind, Stage, TransactionStatus } from '../status/index.js';

/** What an entry records (D-4). */
export type HistoryKind = 'LEG' | 'FAILURE' | 'RETRY' | 'CORRECTION' | 'OPERATOR_ACTION';
export const HISTORY_KINDS: readonly HistoryKind[] = Object.freeze(['LEG', 'FAILURE', 'RETRY', 'CORRECTION', 'OPERATOR_ACTION']);

const LEG_KINDS: readonly LegKind[] = Object.freeze(['AWAIT_DEPOSIT', 'RESERVE', 'CONVERT_IN', 'ARC_TRANSFER', 'PAYOUT']);

/** A supporting document, by reference ID only. */
export interface DocumentRef {
  readonly id: string;
}

export interface HistoryOperator {
  /** Opaque operator reference (never a name or an email). */
  readonly actor: string;
  /** Closed reason code. */
  readonly reasonCode: string;
  /** Opaque case reference, when the action belongs to a case. */
  readonly caseRef?: string;
}

/** The write request. Every descriptive field is a closed code or an opaque reference. */
export interface HistoryEntryInput {
  readonly clientUid: NovaOwnerRef;
  readonly paymentId: PaymentId;
  /** The business event id inside the payment, `[a-z0-9-]{1,64}`. */
  readonly eventId: string;
  readonly kind: HistoryKind;
  /** What happened, as an UPPER_SNAKE code. */
  readonly code: string;
  /** UTC instant of the event, `YYYY-MM-DDTHH:MM:SS(.mmm)Z`. */
  readonly occurredAt: string;
  readonly stage?: Stage;
  readonly status?: TransactionStatus;
  /** A failure reason (design §13.2) for failure stages and FAILURE entries. */
  readonly reason?: string;
  readonly leg?: LegKind;
  readonly amount?: { readonly asset: LedgerAssetCode; readonly units: bigint };
  /** The on-chain transaction hash, lower-case. A hash only; it names no person. */
  readonly txHash?: Hex32;
  /** RETRY: the original payment this new payment retries. */
  readonly retryOf?: PaymentId;
  /** CORRECTION: the key of the entry this one corrects (same payment). */
  readonly corrects?: IdempotencyKey;
  readonly operator?: HistoryOperator;
  readonly documents?: readonly DocumentRef[];
}

/** The stored form: every optional field present, `null` when absent. */
export interface HistoryEntry {
  readonly clientUid: NovaOwnerRef;
  readonly paymentId: PaymentId;
  readonly eventId: string;
  readonly kind: HistoryKind;
  readonly code: string;
  readonly occurredAt: string;
  readonly stage: Stage | null;
  readonly status: TransactionStatus | null;
  readonly reason: string | null;
  readonly leg: LegKind | null;
  readonly amount: { readonly asset: LedgerAssetCode; readonly units: bigint } | null;
  readonly txHash: Hex32 | null;
  readonly retryOf: PaymentId | null;
  readonly corrects: IdempotencyKey | null;
  readonly operator: { readonly actor: string; readonly reasonCode: string; readonly caseRef: string | null } | null;
  readonly documents: readonly DocumentRef[];
}

export interface HistoryRecord {
  /** `hist:<paymentId>:<eventId>`. */
  readonly key: IdempotencyKey;
  /** Position in this client's history, 1, 2, 3 ... assigned on first write. */
  readonly seq: bigint;
  /** Digest of the body: the same key with another digest is KEY_CONFLICT. */
  readonly digest: string;
  readonly entry: HistoryEntry;
}

export type HistoryRejectCode = 'INVALID' | 'KEY_CONFLICT' | 'CORRECTS_NOT_FOUND' | 'RETRY_OF_NOT_FOUND' | 'PAYMENT_CLIENT_MISMATCH';
export type AppendOnlyCode = 'APPEND_ONLY';

export interface HistoryQuery {
  readonly clientUid: NovaOwnerRef;
  /** Entries of this payment, plus every payment that retries it, and retries of those (the whole chain). */
  readonly paymentId?: PaymentId;
  /** Only entries with a `seq` above this. Default 0. */
  readonly after?: bigint;
  /** Page size, 1 to 1000. Default 100. */
  readonly limit?: bigint;
}

export interface HistoryPort {
  /**
   * Idempotent on the derived key (a Nova adapter must dedupe itself or fail closed, DQ-5).
   * A payment's entries all belong to one client; a RETRY names an existing payment of the same client.
   * Never throws for a business outcome.
   */
  append(input: HistoryEntryInput): Promise<PortResult<HistoryRecord, HistoryRejectCode>>;
  /** The client's entries, oldest first (by `seq`). */
  list(query: HistoryQuery): Promise<PortResult<readonly HistoryRecord[], 'INVALID'>>;
  /** Always refused: history is append-only. Record a CORRECTION instead. */
  edit(key: string): Promise<PortResult<never, AppendOnlyCode>>;
  /** Always refused: history is append-only. Record a CORRECTION instead. */
  remove(key: string): Promise<PortResult<never, AppendOnlyCode>>;
}

const EVENT_ID_RE = /^[a-z0-9-]{1,64}$/;
const CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const CLIENT_UID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const OPAQUE_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const DOC_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ASSET_RE = /^[A-Za-z0-9_.-]{1,32}$/;
const INSTANT_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?Z$/;

const DAYS_IN_MONTH: ReadonlyMap<bigint, bigint> = new Map([
  [1n, 31n], [2n, 28n], [3n, 31n], [4n, 30n], [5n, 31n], [6n, 30n], [7n, 31n], [8n, 31n], [9n, 30n], [10n, 31n], [11n, 30n], [12n, 31n],
]);

/** True when the date part names a real calendar day (leap years included). */
function isRealDay(instant: string): boolean {
  const year = BigInt(instant.slice(0, 4));
  const month = BigInt(instant.slice(5, 7));
  const day = BigInt(instant.slice(8, 10));
  const leap = (year % 4n === 0n && year % 100n !== 0n) || year % 400n === 0n;
  const base = DAYS_IN_MONTH.get(month) as bigint;
  const limit = month === 2n && leap ? base + 1n : base;
  return day <= limit;
}

const MAX_DOCUMENTS = 16n;
const DEFAULT_LIMIT = 100n;
const MAX_LIMIT = 1000n;

const INPUT_KEYS: ReadonlySet<string> = new Set([
  'clientUid', 'paymentId', 'eventId', 'kind', 'code', 'occurredAt', 'stage', 'status', 'reason', 'leg',
  'amount', 'txHash', 'retryOf', 'corrects', 'operator', 'documents',
]);
const STATUSES: readonly TransactionStatus[] = Object.freeze(['PENDING', 'PROCESSING', 'SETTLED', 'FAILED', 'REVERSED']);
const STAGES: readonly Stage[] = Object.freeze(Object.keys(STATUS_BY_STAGE) as Stage[]);
const FAILURE_STAGES: readonly FailureStage[] = Object.freeze(['REJECTED', 'EXPIRED', 'CANCELLED']);

const ALL_FAILURE_REASONS: readonly string[] = Object.freeze(FAILURE_STAGES.flatMap((f) => [...REASONS_BY_STAGE[f]] as string[]));

const ARRAY_TAG = '[object Array]';

/** The value as a plain object, or null (arrays, null and primitives are not records). */
function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== 'object' || v === null) return null;
  if (Object.prototype.toString.call(v) === ARRAY_TAG) return null;
  // A copy of the own enumerable fields: fields are read by name, so an inherited field must not be readable.
  return { ...(v as Record<string, unknown>) };
}

/** The value as a list, or null. */
function asList(v: unknown): readonly unknown[] | null {
  if (typeof v !== 'object' || v === null) return null;
  return Object.prototype.toString.call(v) === ARRAY_TAG ? (v as readonly unknown[]) : null;
}

function onlyKeys(v: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  for (const k of Object.keys(v)) if (!allowed.has(k)) return false;
  return true;
}

/** True when `v` is a string matching `re`. Callers cast after the check (a type guard would trip the MC-01 lint). */
function isStr(v: unknown, re: RegExp): boolean {
  if (typeof v !== 'string') return false;
  return re.test(v);
}

function bad(detail: string): PortResult<never, 'INVALID'> {
  return rejected('INVALID', detail);
}

/** The idempotency key of an entry (D-4). */
export function historyKey(paymentId: PaymentId, eventId: string): IdempotencyKey {
  return `hist:${paymentId}:${eventId}` as IdempotencyKey;
}

export interface PreparedEntry {
  readonly key: IdempotencyKey;
  readonly digest: string;
  readonly entry: HistoryEntry;
}

function failureStageOf(stage: Stage | null): FailureStage | null {
  for (const f of FAILURE_STAGES) if (f === stage) return f;
  return null;
}

type Checked<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly detail: string };

function fail(detail: string): { readonly ok: false; readonly detail: string } {
  return { ok: false, detail };
}

function checkAmount(v: unknown): Checked<HistoryEntry['amount']> {
  if (v === undefined) return { ok: true, value: null };
  const rec = asRecord(v);
  if (rec === null || !onlyKeys(rec, new Set(['asset', 'units']))) return fail('amount must be { asset, units }');
  if (!isStr(rec['asset'], ASSET_RE)) return fail('amount.asset is malformed');
  const units = rec['units'];
  if (typeof units !== 'bigint' || units < 0n) return fail('amount.units must be a non-negative bigint');
  return { ok: true, value: Object.freeze({ asset: rec['asset'] as LedgerAssetCode, units }) };
}

function checkOperator(kind: HistoryKind, v: unknown): Checked<HistoryEntry['operator']> {
  if (v === undefined) return kind === 'OPERATOR_ACTION' ? fail('an operator action needs the operator') : { ok: true, value: null };
  if (kind !== 'OPERATOR_ACTION' && kind !== 'CORRECTION') return fail('operator is only for OPERATOR_ACTION and CORRECTION');
  const rec = asRecord(v);
  if (rec === null || !onlyKeys(rec, new Set(['actor', 'reasonCode', 'caseRef']))) return fail('operator must be { actor, reasonCode, caseRef? }');
  if (!isStr(rec['actor'], OPAQUE_RE)) return fail('operator.actor must be an opaque reference');
  if (!isStr(rec['reasonCode'], CODE_RE)) return fail('operator.reasonCode must be a code');
  const caseRef = rec['caseRef'];
  if (caseRef !== undefined && !isStr(caseRef, OPAQUE_RE)) return fail('operator.caseRef must be an opaque reference');
  return { ok: true, value: Object.freeze({ actor: rec['actor'] as string, reasonCode: rec['reasonCode'] as string, caseRef: (caseRef ?? null) as string | null }) };
}

function checkDocuments(v: unknown): Checked<readonly DocumentRef[]> {
  if (v === undefined) return { ok: true, value: Object.freeze([]) };
  const list = asList(v);
  if (list === null) return fail('documents must be a list');
  const seen = new Set<string>();
  let out: readonly DocumentRef[] = [];
  let count = 0n;
  for (const d of list) {
    count += 1n;
    if (count > MAX_DOCUMENTS) return fail('too many documents');
    const doc = asRecord(d);
    if (doc === null || !onlyKeys(doc, new Set(['id']))) return fail('a document is a reference { id } and nothing else');
    if (!isStr(doc['id'], DOC_ID_RE)) return fail('document id must be an opaque reference');
    const id = doc['id'] as string;
    if (seen.has(id)) return fail('duplicate document id');
    seen.add(id);
    out = [...out, Object.freeze({ id })];
  }
  return { ok: true, value: Object.freeze(out) };
}

/** Stage, status and reason must agree with the §13.2 table, and with the entry kind. */
function checkStatus(kind: HistoryKind, stage: Stage | null, status: TransactionStatus | null, reason: string | null): string | null {
  if (stage !== null && status !== null) {
    const expected = STATUS_BY_STAGE[stage];
    // REVERSED is a compensating ledger entry on a COMPLETED payment, never a stage of its own.
    const reversed = status === 'REVERSED' && stage === 'COMPLETED';
    if (status !== expected && !reversed) return `stage ${stage} maps to ${expected}, not ${status}`;
  }
  const failure = failureStageOf(stage);
  if (failure !== null) {
    if (reason === null || !REASONS_BY_STAGE[failure].includes(reason as never)) return `reason is not allowed for stage ${failure}`;
  } else if (stage !== null && reason !== null) return 'a reason goes only with a failure stage';
  else if (reason !== null && !ALL_FAILURE_REASONS.includes(reason)) return 'reason is not a design §13.2 failure reason';
  if (kind === 'FAILURE') {
    if (reason === null) return 'a failure entry needs a reason';
    if (status !== null && status !== 'FAILED') return 'a failure entry has status FAILED';
  }
  return null;
}

/** Validates and normalises a write request into its stored form, key and digest. Unknown fields are refused. */
export function prepareEntry(input: unknown): PortResult<PreparedEntry, 'INVALID'> {
  const rec = asRecord(input);
  if (rec === null || !onlyKeys(rec, INPUT_KEYS)) return bad('entry must be an object with known fields only');
  const { clientUid, paymentId, eventId, kind, code, occurredAt, stage, status, reason, leg, txHash, retryOf, corrects } = rec;
  if (!isStr(clientUid, CLIENT_UID_RE)) return bad('clientUid is malformed');
  if (typeof paymentId !== 'string' || !isPaymentId(paymentId)) return bad('paymentId is malformed');
  if (!isStr(eventId, EVENT_ID_RE)) return bad('eventId is malformed');
  if (typeof kind !== 'string' || !HISTORY_KINDS.includes(kind as HistoryKind)) return bad('kind is unknown');
  if (!isStr(code, CODE_RE)) return bad('code must be an UPPER_SNAKE code');
  if (!isStr(occurredAt, INSTANT_RE) || !isRealDay(occurredAt as string)) return bad('occurredAt must be a UTC instant');
  const k = kind as HistoryKind;
  if (stage !== undefined && !STAGES.includes(stage as Stage)) return bad('stage is unknown');
  if (status !== undefined && !STATUSES.includes(status as TransactionStatus)) return bad('status is unknown');
  if (reason !== undefined && !isStr(reason, CODE_RE)) return bad('reason must be a code');
  const stageV = (stage ?? null) as Stage | null;
  const statusV = (status ?? null) as TransactionStatus | null;
  const reasonV = (reason ?? null) as string | null;
  const statusError = checkStatus(k, stageV, statusV, reasonV);
  if (statusError !== null) return bad(statusError);

  if (leg !== undefined && !LEG_KINDS.includes(leg as LegKind)) return bad('leg is unknown');
  if (k === 'LEG' && leg === undefined) return bad('a leg entry needs the leg');
  if (txHash !== undefined && (typeof txHash !== 'string' || normaliseHex32(txHash) !== txHash)) return bad('txHash must be 32 bytes of lower-case hex');

  if (k === 'RETRY') {
    if (typeof retryOf !== 'string' || !isPaymentId(retryOf)) return bad('a retry names the original payment');
    if (retryOf === paymentId) return bad('a retry is a new payment, not the original');
  } else if (retryOf !== undefined) return bad('retryOf is only for RETRY');

  const eventIdV = eventId as string;
  const codeV = code as string;
  const occurredAtV = occurredAt as string;
  const key = historyKey(paymentId as PaymentId, eventIdV);
  if (k === 'CORRECTION') {
    if (typeof corrects !== 'string' || !isIdempotencyKey(corrects)) return bad('a correction names the entry key it corrects');
    if (!corrects.startsWith(`hist:${paymentId}:`)) return bad('a correction points at an entry of the same payment');
    if (corrects === key) return bad('an entry cannot correct itself');
  } else if (corrects !== undefined) return bad('corrects is only for CORRECTION');

  const amount = checkAmount(rec['amount']);
  if (!amount.ok) return bad(amount.detail);
  const operator = checkOperator(k, rec['operator']);
  if (!operator.ok) return bad(operator.detail);
  const documents = checkDocuments(rec['documents']);
  if (!documents.ok) return bad(documents.detail);

  const entry: HistoryEntry = Object.freeze({
    clientUid: clientUid as NovaOwnerRef,
    paymentId: paymentId as PaymentId,
    eventId: eventIdV,
    kind: k,
    code: codeV,
    occurredAt: occurredAtV,
    stage: stageV,
    status: statusV,
    reason: reasonV,
    leg: (leg ?? null) as LegKind | null,
    amount: amount.value,
    txHash: (txHash ?? null) as Hex32 | null,
    retryOf: (retryOf ?? null) as PaymentId | null,
    corrects: (corrects ?? null) as IdempotencyKey | null,
    operator: operator.value,
    documents: documents.value,
  });
  return ok(Object.freeze({ key, digest: entryDigest(entry), entry }), false);
}

function opt(v: string | null): string {
  return v === null ? 'N' : `S${v}`;
}

/** Digest of the stored form: injective over the fields (length-prefixed, null distinct from empty). */
export function entryDigest(e: HistoryEntry): string {
  const docs = e.documents.map((d) => d.id);
  return lpDigestHex([
    e.clientUid, e.paymentId, e.eventId, e.kind, e.code, e.occurredAt,
    opt(e.stage), opt(e.status), opt(e.reason), opt(e.leg),
    e.amount === null ? 'N' : `S${e.amount.asset}`, e.amount === null ? 'N' : `S${e.amount.units.toString()}`,
    opt(e.txHash), opt(e.retryOf), opt(e.corrects),
    e.operator === null ? 'N' : `S${e.operator.actor}`, e.operator === null ? 'N' : `S${e.operator.reasonCode}`,
    e.operator === null ? 'N' : opt(e.operator.caseRef),
    ...docs.map((d) => `D${d}`),
  ]);
}

export type AppendPlan =
  | { readonly kind: 'INSERT'; readonly prepared: PreparedEntry }
  | { readonly kind: 'DONE'; readonly result: PortResult<HistoryRecord, HistoryRejectCode> };

/**
 * The one append decision, shared by every implementation. `lookup` reads the
 * store by key. A replay returns the stored record (replayed true); a different
 * body under the same key is KEY_CONFLICT; a correction needs its target to exist
 * under the same client; a payment's entries all belong to one client (`clientOf` names
 * the client that already has entries for a payment, or null); a RETRY names an existing
 * payment of the same client; anything else is an INSERT the store numbers itself.
 */
export function decideAppend(
  input: unknown,
  lookup: (key: IdempotencyKey) => HistoryRecord | null,
  clientOf: (paymentId: PaymentId) => NovaOwnerRef | null,
): AppendPlan {
  const prepared = prepareEntry(input);
  if (prepared.kind !== 'OK') return { kind: 'DONE', result: prepared as PortResult<never, 'INVALID'> };
  const p = prepared.value;
  const prior = lookup(p.key);
  if (prior !== null) {
    return {
      kind: 'DONE',
      result: prior.digest === p.digest ? ok(prior, true) : rejected('KEY_CONFLICT', `key ${p.key} reused with a different entry`),
    };
  }
  const target = p.entry.corrects;
  if (target !== null) {
    const found = lookup(target);
    if (found === null || found.entry.clientUid !== p.entry.clientUid) return { kind: 'DONE', result: rejected('CORRECTS_NOT_FOUND', `no entry ${target} for this client`) };
  }
  const owner = clientOf(p.entry.paymentId);
  if (owner !== null && owner !== p.entry.clientUid) return { kind: 'DONE', result: rejected('PAYMENT_CLIENT_MISMATCH', `payment ${p.entry.paymentId} belongs to another client`) };
  const original = p.entry.retryOf;
  if (original !== null && clientOf(original) !== p.entry.clientUid) return { kind: 'DONE', result: rejected('RETRY_OF_NOT_FOUND', `no payment ${original} for this client`) };
  return { kind: 'INSERT', prepared: p };
}

/** The stored record for a prepared entry at `seq`. */
export function makeRecord(p: PreparedEntry, seq: bigint): HistoryRecord {
  return Object.freeze({ key: p.key, seq, digest: p.digest, entry: p.entry });
}

export interface PreparedQuery {
  readonly clientUid: NovaOwnerRef;
  readonly paymentId: PaymentId | null;
  readonly after: bigint;
  readonly limit: bigint;
}

export function prepareQuery(q: unknown): PortResult<PreparedQuery, 'INVALID'> {
  const rec = asRecord(q);
  if (rec === null || !onlyKeys(rec, new Set(['clientUid', 'paymentId', 'after', 'limit']))) return bad('query must be an object with known fields only');
  if (!isStr(rec['clientUid'], CLIENT_UID_RE)) return bad('clientUid is malformed');
  const paymentId = rec['paymentId'];
  if (paymentId !== undefined && (typeof paymentId !== 'string' || !isPaymentId(paymentId))) return bad('paymentId is malformed');
  const after = rec['after'] ?? 0n;
  if (typeof after !== 'bigint' || after < 0n) return bad('after must be a non-negative bigint');
  const limit = rec['limit'] ?? DEFAULT_LIMIT;
  if (typeof limit !== 'bigint' || limit < 1n || limit > MAX_LIMIT) return bad('limit must be a bigint from 1 to 1000');
  return ok({ clientUid: rec['clientUid'] as NovaOwnerRef, paymentId: (paymentId ?? null) as PaymentId | null, after, limit }, false);
}

/**
 * The payment and every payment that retries it, directly or through a chain of retries,
 * read from one client's records (answer 28: record everything for both).
 */
export function linkedPayments(records: readonly HistoryRecord[], root: PaymentId): ReadonlySet<PaymentId> {
  const linked = new Set<PaymentId>([root]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of records) {
      const from = r.entry.retryOf;
      if (from !== null && linked.has(from) && !linked.has(r.entry.paymentId)) {
        linked.add(r.entry.paymentId);
        grew = true;
      }
    }
  }
  return linked;
}

/** True when the record belongs to the query: same client, past the cursor, and (if asked) one of the linked payments. */
export function matchesQuery(r: HistoryRecord, q: PreparedQuery, linked: ReadonlySet<PaymentId>): boolean {
  if (r.entry.clientUid !== q.clientUid || r.seq <= q.after) return false;
  return q.paymentId === null || linked.has(r.entry.paymentId);
}

/** The refusal every edit or delete gets. */
export function refuseMutation(op: 'edit' | 'remove', key: string): PortResult<never, AppendOnlyCode> {
  return rejected('APPEND_ONLY', `history is append-only: ${op} of ${key} refused; record a CORRECTION entry instead`);
}
