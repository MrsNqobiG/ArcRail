/**
 * Test support: two structurally different in-memory PaymentStorePort fakes (§7.8).
 *
 * - MapPaymentStore keeps mutable current records with version counters in
 *   Maps, plus Map-based inbox, cursors, outbox, decisions, nonce holds and
 *   cases.
 *   Its storage is a plain state object: `snapshot()` copies it and
 *   `MapPaymentStore.restore()` rebuilds a store from a copy (§7.3 restart test).
 * - EventSourcedPaymentStore keeps only an append-only event list (creations,
 *   signals, submit markers, compensations, F-17 closes, range commits,
 *   decisions, holds, cases, claims, pauses). A record is a fold of its events
 *   through the shared decision procedures, each re-run against the log before
 *   it; the inbox, cursors, outbox, decisions, holds, cases and rail state are
 *   scans of the same list. `events()` and `fromEvents()` are its storage.
 *
 * Both judge every write with the shared decide* procedures of
 * src/nova-ports/payment-store.ts, keep ONE inbox for applySignal, commitRange,
 * recordDecision, liftHold and claimInbound, can inject AMBIGUOUS on every operation (reads
 * before, writes before or after commit), and pass the same contract tests
 * (test/contract/ports-payment-store.contract.test.ts).
 */
import { ok, rejected } from '../ids.js';
import type { Hex32, IdempotencyKey, NovaOwnerRef, PaymentId, PortResult, WalletRef } from '../ids.js';
import type { JournalReceipt } from '../ledger.js';
import {
  arcLeg,
  checkRange,
  decideCaseDecision,
  decideClaim,
  decideClosePayout,
  decideCompensation,
  decideCreate,
  decideDecision,
  decideHoldNonceTx,
  decideLift,
  decideMarkSubmit,
  decidePutCase,
  decideSignal,
  decideUnpause,
  decisionIdOf,
  deriveCaseId,
  deriveHoldId,
  dfnsRequestOf,
  newHold,
  observeHold,
  pauseIncident,
  releaseKey,
} from '../payment-store.js';
import type {
  CaseRecord,
  CaseRejectCode,
  CompensationRejectCode,
  CreateRejectCode,
  DecisionRejectCode,
  HoldObservation,
  InboundSignal,
  InboundTriple,
  InboxEntry,
  LegTransition,
  LiftRejectCode,
  MarkSubmitRejectCode,
  NewNonceHold,
  NewPayment,
  OperatorDecision,
  OutboxItem,
  PaymentRecord,
  PaymentStorePort,
  RailState,
  SignalOutcome,
  SignalRejectCode,
  SubmitMarker,
  UnpauseRejectCode,
  WalletNonceHold,
} from '../payment-store.js';
import type { LegKind, Stage } from '../../status/index.js';
import { afterCommit, faultBefore } from './faults.js';
import type { FaultPlan } from './faults.js';

type SignalResult = PortResult<{ readonly outcome: SignalOutcome; readonly record: PaymentRecord }, SignalRejectCode>;

function requestIndex(payer: NovaOwnerRef, key: IdempotencyKey): string {
  return `${payer}\u0000${key}`;
}

function isOpen(rec: PaymentRecord, leg: LegKind, stage: Stage): boolean {
  return rec.legs.some((l) => l.kind === leg && l.stage === stage);
}

const RUNNING: RailState = Object.freeze({ paused: false, reason: null, incident: null });

function isUnresolved(rec: PaymentRecord): boolean {
  return dfnsRequestOf(arcLeg(rec)) === 'UNRESOLVED';
}

function take<T>(items: readonly T[], limit: bigint): readonly T[] {
  const out: T[] = [];
  let n = 0n;
  for (const x of items) {
    if (n >= limit) break;
    out.push(x);
    n += 1n;
  }
  return out;
}

/** The storage of MapPaymentStore: what a restart keeps. */
export interface MapStoreState {
  readonly records: ReadonlyMap<string, PaymentRecord>;
  readonly byRequest: ReadonlyMap<string, PaymentId>;
  readonly inbox: ReadonlyMap<string, InboxEntry>;
  readonly cursors: ReadonlyMap<string, bigint>;
  readonly outbox: ReadonlyMap<string, OutboxItem>;
  readonly decisions: ReadonlyMap<string, OperatorDecision>;
  readonly consumed: ReadonlySet<string>;
  readonly holds: ReadonlyMap<string, WalletNonceHold>;
  readonly cases: ReadonlyMap<string, CaseRecord>;
  readonly rail: RailState;
  /** Pauses so far (the next pause's incident is `pause-<pauses + 1>`). */
  readonly pauses: bigint;
}

/** Fake A: mutable records in Maps. */
export class MapPaymentStore implements PaymentStorePort {
  readonly #records: Map<string, PaymentRecord>;
  readonly #byRequest: Map<string, PaymentId>;
  readonly #inbox: Map<string, InboxEntry>;
  readonly #cursors: Map<string, bigint>;
  readonly #outbox: Map<string, OutboxItem>;
  readonly #decisions: Map<string, OperatorDecision>;
  readonly #consumed: Set<string>;
  readonly #holds: Map<string, WalletNonceHold>;
  readonly #cases: Map<string, CaseRecord>;
  #rail: RailState;
  #pauses: bigint;
  readonly #faults: FaultPlan | undefined;

  constructor(faults?: FaultPlan, state?: MapStoreState) {
    this.#faults = faults;
    this.#records = new Map(state?.records);
    this.#byRequest = new Map(state?.byRequest);
    this.#inbox = new Map(state?.inbox);
    this.#cursors = new Map(state?.cursors);
    this.#outbox = new Map(state?.outbox);
    this.#decisions = new Map(state?.decisions);
    this.#consumed = new Set(state?.consumed);
    this.#holds = new Map(state?.holds);
    this.#cases = new Map(state?.cases);
    this.#rail = state?.rail ?? RUNNING;
    this.#pauses = state?.pauses ?? 0n;
  }

  /** A copy of the storage (what survives a process restart). */
  snapshot(): MapStoreState {
    return {
      records: new Map(this.#records),
      byRequest: new Map(this.#byRequest),
      inbox: new Map(this.#inbox),
      cursors: new Map(this.#cursors),
      outbox: new Map(this.#outbox),
      decisions: new Map(this.#decisions),
      consumed: new Set(this.#consumed),
      holds: new Map(this.#holds),
      cases: new Map(this.#cases),
      rail: this.#rail,
      pauses: this.#pauses,
    };
  }

  /** A new store over a copy of `state`, as after a restart. */
  static restore(state: MapStoreState, faults?: FaultPlan): MapPaymentStore {
    return new MapPaymentStore(faults, state);
  }

  async create(p: NewPayment): Promise<PortResult<PaymentRecord, CreateRejectCode>> {
    const before = faultBefore(this.#faults, 'create');
    if (before !== null) return before;
    const verdict = decideCreate(p, this.#byRequestKey(p.payer, p.requestKey) ?? null, this.#records.get(p.paymentId) ?? null);
    if (verdict.kind === 'DONE') return verdict.result;
    this.#records.set(p.paymentId, verdict.record);
    this.#byRequest.set(requestIndex(p.payer, p.requestKey), p.paymentId);
    return afterCommit(this.#faults, 'create', ok(verdict.record, false));
  }

  async get(id: PaymentId): Promise<PortResult<PaymentRecord, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'get');
    if (before !== null) return before;
    const rec = this.#records.get(id);
    return rec === undefined ? rejected('NOT_FOUND', id) : ok(rec, false);
  }

  async getByRequestKey(payer: NovaOwnerRef, key: IdempotencyKey): Promise<PortResult<PaymentRecord | null, never>> {
    const before = faultBefore(this.#faults, 'getByRequestKey');
    if (before !== null) return before;
    return ok(this.#byRequestKey(payer, key) ?? null, false);
  }

  #byRequestKey(payer: NovaOwnerRef, key: IdempotencyKey): PaymentRecord | undefined {
    return this.#records.get(this.#byRequest.get(requestIndex(payer, key)) ?? '');
  }

  #decisionFor(dedupeKey: string): OperatorDecision | null {
    const id = decisionIdOf(dedupeKey);
    return id === null ? null : (this.#decisions.get(id) ?? null);
  }

  #placeHold(h: NewNonceHold | null): void {
    if (h === null) return;
    const holdId = deriveHoldId(h.wallet, h.dfnsTransferId);
    if (!this.#holds.has(holdId)) this.#holds.set(holdId, newHold(h));
  }

  async applySignal(id: PaymentId, expectedVersion: bigint, signal: InboundSignal, t: LegTransition, outbox: readonly OutboxItem[]): Promise<SignalResult> {
    const before = faultBefore(this.#faults, 'applySignal');
    if (before !== null) return before;
    const rec = this.#records.get(id);
    if (rec === undefined) return rejected('NOT_FOUND', id);
    const prior = this.#inbox.get(signal.dedupeKey) ?? null;
    const verdict = decideSignal(rec, expectedVersion, signal, t, prior, this.#decisionFor(signal.dedupeKey), outbox, (k) => this.#outbox.get(k) ?? null);
    if (verdict.kind === 'REJECT') return verdict.result;
    if (verdict.kind === 'NOOP') {
      if (verdict.hold !== null) this.#inbox.set(signal.dedupeKey, { digest: signal.payloadDigest, subject: id });
      else if (prior === null) this.#inbox.set(signal.dedupeKey, { digest: signal.payloadDigest, subject: null });
      this.#placeHold(verdict.hold);
      return afterCommit(this.#faults, 'applySignal', ok({ outcome: verdict.outcome, record: rec }, verdict.outcome === 'DUPLICATE'));
    }
    this.#inbox.set(signal.dedupeKey, { digest: signal.payloadDigest, subject: id });
    this.#records.set(id, verdict.record);
    this.#placeHold(verdict.hold);
    for (const item of outbox) if (!this.#outbox.has(item.key)) this.#outbox.set(item.key, item);
    return afterCommit(this.#faults, 'applySignal', ok({ outcome: 'APPLIED' as const, record: verdict.record }, false));
  }

  async markSubmit(id: PaymentId, expectedVersion: bigint, marker: SubmitMarker): Promise<PortResult<PaymentRecord, MarkSubmitRejectCode>> {
    const before = faultBefore(this.#faults, 'markSubmit');
    if (before !== null) return before;
    const rec = this.#records.get(id);
    if (rec === undefined) return rejected('NOT_FOUND', id);
    const owner = [...this.#records.values()].find((r) => arcLeg(r).submit?.externalId === marker.externalId)?.paymentId ?? null;
    const verdict = decideMarkSubmit(rec, expectedVersion, marker, this.#outbox.has(releaseKey(id)), owner);
    if (verdict.kind === 'DONE') return verdict.result;
    this.#records.set(id, verdict.record);
    return afterCommit(this.#faults, 'markSubmit', ok(verdict.record, false));
  }

  async findByExternalId(externalId: string): Promise<PortResult<PaymentRecord | null, never>> {
    const before = faultBefore(this.#faults, 'findByExternalId');
    if (before !== null) return before;
    return ok([...this.#records.values()].find((r) => arcLeg(r).submit?.externalId === externalId) ?? null, false);
  }

  async listUnresolvedSubmits(limit: bigint): Promise<PortResult<readonly PaymentRecord[], never>> {
    const before = faultBefore(this.#faults, 'listUnresolvedSubmits');
    if (before !== null) return before;
    return ok(take([...this.#records.values()].filter(isUnresolved), limit), false);
  }

  async recordCompensation(id: PaymentId, expectedVersion: bigint, p7: JournalReceipt, original: JournalReceipt): Promise<PortResult<PaymentRecord, CompensationRejectCode>> {
    const before = faultBefore(this.#faults, 'recordCompensation');
    if (before !== null) return before;
    const rec = this.#records.get(id);
    if (rec === undefined) return rejected('NOT_FOUND', id);
    const verdict = decideCompensation(rec, expectedVersion, p7, original);
    if (verdict.kind === 'DONE') return verdict.result;
    this.#records.set(id, verdict.record);
    return afterCommit(this.#faults, 'recordCompensation', ok(verdict.record, false));
  }

  async commitRange(cursorKey: string, toBlock: bigint, signals: readonly InboundSignal[]): Promise<PortResult<void, 'CURSOR_REGRESSION' | 'SIGNAL_CONFLICT'>> {
    const before = faultBefore(this.#faults, 'commitRange');
    if (before !== null) return before;
    const refused = checkRange(this.#cursors.get(cursorKey) ?? null, toBlock, signals, (k) => this.#inbox.get(k) ?? null);
    if (refused !== null) return refused;
    for (const s of signals) if (!this.#inbox.has(s.dedupeKey)) this.#inbox.set(s.dedupeKey, { digest: s.payloadDigest, subject: null });
    this.#cursors.set(cursorKey, toBlock);
    return afterCommit(this.#faults, 'commitRange', ok(undefined, false));
  }

  async getCursor(cursorKey: string): Promise<PortResult<bigint | null, never>> {
    const before = faultBefore(this.#faults, 'getCursor');
    if (before !== null) return before;
    return ok(this.#cursors.get(cursorKey) ?? null, false);
  }

  async getRailState(): Promise<PortResult<RailState, never>> {
    const before = faultBefore(this.#faults, 'getRailState');
    if (before !== null) return before;
    return ok(this.#rail, false);
  }

  async pause(reason: string, actor: string): Promise<PortResult<void, never>> {
    const before = faultBefore(this.#faults, 'pause');
    if (before !== null) return before;
    if (!this.#rail.paused) {
      this.#pauses += 1n;
      this.#rail = { paused: true, reason: `${reason} (by ${actor})`, incident: pauseIncident(this.#pauses) };
    }
    return afterCommit(this.#faults, 'pause', ok(undefined, false));
  }

  async unpause(decision: OperatorDecision): Promise<PortResult<void, UnpauseRejectCode>> {
    const before = faultBefore(this.#faults, 'unpause');
    if (before !== null) return before;
    const refused = decideUnpause(this.#rail, decision, this.#decisions.get(decision.decisionId) ?? null, this.#consumed.has(decision.decisionId));
    if (refused !== null) return refused;
    this.#consumed.add(decision.decisionId);
    this.#rail = RUNNING;
    return afterCommit(this.#faults, 'unpause', ok(undefined, false));
  }

  async listOpen(leg: LegKind, stage: Stage, limit: bigint): Promise<PortResult<readonly PaymentRecord[], never>> {
    const before = faultBefore(this.#faults, 'listOpen');
    if (before !== null) return before;
    return ok(take([...this.#records.values()].filter((r) => isOpen(r, leg, stage)), limit), false);
  }

  async pendingOutbox(): Promise<PortResult<readonly OutboxItem[], never>> {
    const before = faultBefore(this.#faults, 'pendingOutbox');
    if (before !== null) return before;
    return ok([...this.#outbox.values()], false);
  }

  async recordDecision(signal: InboundSignal, d: OperatorDecision): Promise<PortResult<{ readonly outcome: SignalOutcome }, DecisionRejectCode>> {
    const before = faultBefore(this.#faults, 'recordDecision');
    if (before !== null) return before;
    const verdict = decideDecision(signal, d, this.#inbox.get(signal.dedupeKey) ?? null, this.#decisions.get(d.decisionId) ?? null);
    if (verdict.kind === 'DONE') return verdict.result;
    if (!this.#inbox.has(signal.dedupeKey)) this.#inbox.set(signal.dedupeKey, { digest: signal.payloadDigest, subject: null });
    this.#decisions.set(d.decisionId, d);
    return afterCommit(this.#faults, 'recordDecision', ok({ outcome: 'APPLIED' as const }, false));
  }

  async getDecision(decisionId: string): Promise<PortResult<OperatorDecision, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'getDecision');
    if (before !== null) return before;
    const d = this.#decisions.get(decisionId);
    return d === undefined ? rejected('NOT_FOUND', decisionId) : ok(d, false);
  }

  async listActiveHolds(wallet: WalletRef): Promise<PortResult<readonly WalletNonceHold[], never>> {
    const before = faultBefore(this.#faults, 'listActiveHolds');
    if (before !== null) return before;
    return ok([...this.#holds.values()].filter((h) => h.wallet === wallet && h.state === 'ACTIVE'), false);
  }

  async recordHoldObservation(holdId: string, obs: HoldObservation): Promise<PortResult<WalletNonceHold, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'recordHoldObservation');
    if (before !== null) return before;
    const h = this.#holds.get(holdId);
    if (h === undefined) return rejected('NOT_FOUND', holdId);
    const next = observeHold(h, obs);
    this.#holds.set(holdId, next);
    return afterCommit(this.#faults, 'recordHoldObservation', ok(next, false));
  }

  async recordHoldNonceTx(holdId: string, txHash: Hex32): Promise<PortResult<WalletNonceHold, 'NOT_FOUND' | 'NONCE_TX_CONFLICT'>> {
    const before = faultBefore(this.#faults, 'recordHoldNonceTx');
    if (before !== null) return before;
    const h = this.#holds.get(holdId);
    if (h === undefined) return rejected('NOT_FOUND', holdId);
    const verdict = decideHoldNonceTx(h, txHash);
    if (!('hold' in verdict)) return verdict;
    this.#holds.set(holdId, verdict.hold);
    return afterCommit(this.#faults, 'recordHoldNonceTx', ok(verdict.hold, false));
  }

  async liftHold(holdId: string, evidence: InboundSignal): Promise<PortResult<WalletNonceHold, LiftRejectCode>> {
    const before = faultBefore(this.#faults, 'liftHold');
    if (before !== null) return before;
    const h = this.#holds.get(holdId);
    if (h === undefined) return rejected('NOT_FOUND', holdId);
    const verdict = decideLift(h, evidence, this.#inbox.get(evidence.dedupeKey) ?? null, this.#decisionFor(evidence.dedupeKey));
    if (!('hold' in verdict)) return verdict;
    this.#inbox.set(evidence.dedupeKey, { digest: evidence.payloadDigest, subject: holdId });
    this.#holds.set(holdId, verdict.hold);
    return afterCommit(this.#faults, 'liftHold', ok(verdict.hold, false));
  }

  async closeFailedPayout(id: PaymentId, expectedVersion: bigint, evidence: InboundSignal, outbox: readonly OutboxItem[]): Promise<SignalResult> {
    const before = faultBefore(this.#faults, 'closeFailedPayout');
    if (before !== null) return before;
    const rec = this.#records.get(id);
    if (rec === undefined) return rejected('NOT_FOUND', id);
    const enqueued = (k: IdempotencyKey): OutboxItem | null => this.#outbox.get(k) ?? null;
    const partnerCase = this.#cases.get(deriveCaseId('PARTNER_RETURN', id)) ?? null;
    const verdict = decideClosePayout(rec, expectedVersion, evidence, outbox, this.#inbox.get(evidence.dedupeKey) ?? null, this.#decisionFor(evidence.dedupeKey), partnerCase, enqueued);
    if (verdict.kind === 'DONE') return verdict.result;
    this.#records.set(id, verdict.record);
    for (const item of outbox) if (!this.#outbox.has(item.key)) this.#outbox.set(item.key, item);
    return afterCommit(this.#faults, 'closeFailedPayout', ok({ outcome: 'APPLIED' as const, record: verdict.record }, false));
  }

  async putCase(c: CaseRecord): Promise<PortResult<CaseRecord, CaseRejectCode>> {
    const before = faultBefore(this.#faults, 'putCase');
    if (before !== null) return before;
    const verdict = decidePutCase(c, this.#cases.get(c.caseId) ?? null, (d) => this.#decisions.get(d) ?? null);
    if (verdict.kind !== 'PUT') return verdict;
    this.#cases.set(c.caseId, c);
    return afterCommit(this.#faults, 'putCase', ok(c, false));
  }

  async getCase(caseId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'getCase');
    if (before !== null) return before;
    const c = this.#cases.get(caseId);
    return c === undefined ? rejected('NOT_FOUND', caseId) : ok(c, false);
  }

  async addCaseDecision(caseId: string, decisionId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND' | 'DECISION_MISSING'>> {
    const before = faultBefore(this.#faults, 'addCaseDecision');
    if (before !== null) return before;
    const c = this.#cases.get(caseId);
    if (c === undefined) return rejected('NOT_FOUND', caseId);
    const verdict = decideCaseDecision(c, this.#decisions.get(decisionId) ?? null);
    if (!('record' in verdict)) return verdict;
    this.#cases.set(caseId, verdict.record);
    return afterCommit(this.#faults, 'addCaseDecision', ok(verdict.record, false));
  }

  async claimInbound(log: InboundSignal, triple: InboundTriple): Promise<PortResult<{ readonly claimedBy: CaseRecord | null }, 'SIGNAL_CONFLICT'>> {
    const before = faultBefore(this.#faults, 'claimInbound');
    if (before !== null) return before;
    const cases = [...this.#cases.values()];
    const claimed = cases.find((c) => c.matchedLog === log.dedupeKey) ?? null;
    const open = cases.filter((c) => c.kind === 'PARTNER_RETURN' && c.state === 'OPEN');
    const verdict = decideClaim(log, triple, this.#inbox.get(log.dedupeKey) ?? null, claimed, open);
    if (!('record' in verdict)) return verdict;
    this.#inbox.set(log.dedupeKey, { digest: log.payloadDigest, subject: verdict.record.caseId });
    this.#cases.set(verdict.record.caseId, verdict.record);
    return afterCommit(this.#faults, 'claimInbound', ok({ claimedBy: verdict.record }, false));
  }
}

export type StoreEvent =
  | { readonly type: 'CREATED'; readonly p: NewPayment }
  /** `applied`: the transition changed the record. A signal that did not, but placed a hold (`t.placeHold`), still claims its key. */
  | { readonly type: 'SIGNAL'; readonly id: PaymentId; readonly signal: InboundSignal; readonly t: LegTransition; readonly applied: boolean; readonly outbox: readonly OutboxItem[] }
  | { readonly type: 'MARKED'; readonly id: PaymentId; readonly marker: SubmitMarker }
  | { readonly type: 'COMPENSATED'; readonly id: PaymentId; readonly p7: JournalReceipt; readonly original: JournalReceipt }
  | { readonly type: 'RANGE'; readonly cursorKey: string; readonly toBlock: bigint; readonly signals: readonly InboundSignal[] }
  | { readonly type: 'DECISION'; readonly signal: InboundSignal; readonly d: OperatorDecision }
  | { readonly type: 'HOLD_OBSERVED'; readonly holdId: string; readonly obs: HoldObservation }
  | { readonly type: 'HOLD_NONCE_TX'; readonly holdId: string; readonly txHash: Hex32 }
  | { readonly type: 'HOLD_LIFTED'; readonly holdId: string; readonly evidence: InboundSignal }
  | { readonly type: 'PAUSED'; readonly reason: string }
  | { readonly type: 'UNPAUSED'; readonly decisionId: string }
  /** F-17 close: the outbox it enqueued, on its evidence. */
  | { readonly type: 'CLOSED'; readonly id: PaymentId; readonly evidence: InboundSignal; readonly outbox: readonly OutboxItem[] }
  | { readonly type: 'CASE_PUT'; readonly c: CaseRecord }
  | { readonly type: 'CASE_DECISION'; readonly caseId: string; readonly decisionId: string }
  | { readonly type: 'CLAIMED'; readonly log: InboundSignal; readonly caseId: string };

function corrupt(what: string): Error {
  return new Error(`event log corrupt: ${what}`);
}

type ChangeEvent = Extract<StoreEvent, { readonly type: 'SIGNAL' | 'MARKED' | 'COMPENSATED' | 'CLOSED' }>;

/** The decision an `op:` key names, from the log. */
function decisionIn(events: readonly StoreEvent[], dedupeKey: string): OperatorDecision | null {
  const id = decisionIdOf(dedupeKey);
  for (const e of events) if (e.type === 'DECISION' && e.d.decisionId === id) return e.d;
  return null;
}

/** The keys and digests one event writes to the inbox, with what it claims them for (null: digest only). */
function inboxRows(e: StoreEvent): readonly (readonly [InboundSignal, string | null])[] {
  switch (e.type) {
    case 'SIGNAL':
      return [[e.signal, e.applied || e.t.placeHold !== undefined ? e.id : null]];
    case 'RANGE':
      return e.signals.map((s) => [s, null] as const);
    case 'DECISION':
      return [[e.signal, null]];
    case 'HOLD_LIFTED':
      return [[e.evidence, e.holdId]];
    case 'CLAIMED':
      return [[e.log, e.caseId]];
    default:
      return [];
  }
}

/** The one inbox: the first digest seen for a key, and the first subject that claimed it. */
function inboxIn(events: readonly StoreEvent[], dedupeKey: string): InboxEntry | null {
  let digest: Hex32 | null = null;
  let subject: string | null = null;
  for (const e of events) {
    for (const [s, claim] of inboxRows(e)) {
      if (s.dedupeKey !== dedupeKey) continue;
      digest ??= s.payloadDigest;
      subject ??= claim;
    }
  }
  return digest === null ? null : { digest, subject };
}

/** The outbox, in enqueue order, one item per key. */
function outboxIn(events: readonly StoreEvent[]): readonly OutboxItem[] {
  const out: OutboxItem[] = [];
  for (const e of events) {
    if (e.type !== 'SIGNAL' && e.type !== 'CLOSED') continue;
    for (const item of e.outbox) if (!out.some((o) => o.key === item.key)) out.push(item);
  }
  return out;
}

/** Folds every case from the log: put, given decisions and claims in order. */
export function foldCases(events: readonly StoreEvent[]): readonly CaseRecord[] {
  const cases = new Map<string, CaseRecord>();
  const at = (caseId: string): CaseRecord => {
    const c = cases.get(caseId);
    if (c === undefined) throw corrupt(`case ${caseId} changed before it was put`);
    return c;
  };
  for (const e of events) {
    if (e.type === 'CASE_PUT') cases.set(e.c.caseId, e.c);
    else if (e.type === 'CASE_DECISION') cases.set(e.caseId, { ...at(e.caseId), decisions: [...at(e.caseId).decisions, e.decisionId] });
    else if (e.type === 'CLAIMED') cases.set(e.caseId, { ...at(e.caseId), state: 'MATCHED', matchedLog: e.log.dedupeKey });
  }
  return [...cases.values()];
}

/** A replayed change was applied, so nothing was enqueued before it under its own keys. */
const nothingEnqueued = (): OutboxItem | null => null;

/** Re-runs one stored change of payment `rec` through its shared decision procedure, against the log before it (`prior`). */
function replay(prior: readonly StoreEvent[], rec: PaymentRecord, e: ChangeEvent): PaymentRecord {
  let v;
  if (e.type === 'SIGNAL') v = decideSignal(rec, rec.version, e.signal, e.t, null, decisionIn(prior, e.signal.dedupeKey), e.outbox, nothingEnqueued);
  else if (e.type === 'MARKED') v = decideMarkSubmit(rec, rec.version, e.marker, false, null);
  else if (e.type === 'COMPENSATED') v = decideCompensation(rec, rec.version, e.p7, e.original);
  else {
    const partnerCase = foldCases(prior).find((c) => c.caseId === deriveCaseId('PARTNER_RETURN', e.id)) ?? null;
    v = decideClosePayout(rec, rec.version, e.evidence, e.outbox, inboxIn(prior, e.evidence.dedupeKey), decisionIn(prior, e.evidence.dedupeKey), partnerCase, nothingEnqueued);
  }
  if (v.kind !== 'APPLY') throw corrupt('stored change no longer applies');
  return v.record;
}

/**
 * Folds one payment's events through the shared decision procedures. A stored
 * event that no longer applies means the log is corrupt: throw (fail closed).
 */
export function foldPayment(events: readonly StoreEvent[], id: PaymentId): PaymentRecord | null {
  let rec: PaymentRecord | null = null;
  for (const [i, e] of events.entries()) {
    if (e.type === 'CREATED') {
      if (e.p.paymentId !== id) continue;
      if (rec !== null) throw corrupt('payment created twice');
      const v = decideCreate(e.p, null, null);
      if (v.kind !== 'INSERT') throw corrupt('stored creation is no longer valid');
      rec = v.record;
    } else if (((e.type === 'SIGNAL' && e.applied) || e.type === 'MARKED' || e.type === 'COMPENSATED' || e.type === 'CLOSED') && e.id === id) {
      if (rec === null) throw corrupt('event before creation');
      rec = replay(events.slice(0, i), rec, e);
    }
  }
  return rec;
}

/** Folds every hold from the log: placed by signals, then observed, given a nonce tx and lifted in order. */
export function foldHolds(events: readonly StoreEvent[]): readonly WalletNonceHold[] {
  const holds = new Map<string, WalletNonceHold>();
  const at = (holdId: string): WalletNonceHold => {
    const h = holds.get(holdId);
    if (h === undefined) throw corrupt(`hold ${holdId} changed before it was placed`);
    return h;
  };
  for (const e of events) {
    if (e.type === 'SIGNAL' && e.t.placeHold !== undefined) {
      const h = newHold(e.t.placeHold);
      if (!holds.has(h.holdId)) holds.set(h.holdId, h);
    } else if (e.type === 'HOLD_OBSERVED') holds.set(e.holdId, observeHold(at(e.holdId), e.obs));
    else if (e.type === 'HOLD_NONCE_TX') holds.set(e.holdId, { ...at(e.holdId), nonceTx: e.txHash });
    else if (e.type === 'HOLD_LIFTED') holds.set(e.holdId, { ...at(e.holdId), state: 'LIFTED', liftedBy: e.evidence.dedupeKey });
  }
  return [...holds.values()];
}

/** Fake B: an append-only event list; every read is a fold or a scan. */
export class EventSourcedPaymentStore implements PaymentStorePort {
  #events: readonly StoreEvent[];
  readonly #faults: FaultPlan | undefined;

  constructor(faults?: FaultPlan, events: readonly StoreEvent[] = []) {
    this.#faults = faults;
    this.#events = [...events];
  }

  /** The stored log (what survives a process restart). */
  events(): readonly StoreEvent[] {
    return [...this.#events];
  }

  /** A new store over a copy of `events`, as after a restart. */
  static fromEvents(events: readonly StoreEvent[], faults?: FaultPlan): EventSourcedPaymentStore {
    return new EventSourcedPaymentStore(faults, events);
  }

  #append(e: StoreEvent): void {
    this.#events = [...this.#events, e];
  }

  #fold(id: PaymentId): PaymentRecord | null {
    return foldPayment(this.#events, id);
  }

  /** Every payment, in creation order (a created payment always folds, or the fold throws). */
  #all(): readonly PaymentRecord[] {
    const ids = this.#events.flatMap((e) => (e.type === 'CREATED' ? [e.p.paymentId] : []));
    return ids.map((id) => this.#fold(id)).filter((r): r is PaymentRecord => r !== null);
  }

  #inbox(dedupeKey: string): InboxEntry | null {
    return inboxIn(this.#events, dedupeKey);
  }

  #creation(payer: NovaOwnerRef, key: IdempotencyKey): NewPayment | null {
    for (const e of this.#events) if (e.type === 'CREATED' && e.p.payer === payer && e.p.requestKey === key) return e.p;
    return null;
  }

  #outbox(): readonly OutboxItem[] {
    return outboxIn(this.#events);
  }

  #enqueued(key: IdempotencyKey): OutboxItem | null {
    return this.#outbox().find((o) => o.key === key) ?? null;
  }

  #decision(decisionId: string): OperatorDecision | null {
    for (const e of this.#events) if (e.type === 'DECISION' && e.d.decisionId === decisionId) return e.d;
    return null;
  }

  #hold(holdId: string): WalletNonceHold | null {
    return foldHolds(this.#events).find((h) => h.holdId === holdId) ?? null;
  }

  async create(p: NewPayment): Promise<PortResult<PaymentRecord, CreateRejectCode>> {
    const before = faultBefore(this.#faults, 'create');
    if (before !== null) return before;
    const prior = this.#creation(p.payer, p.requestKey);
    const verdict = decideCreate(p, prior === null ? null : this.#fold(prior.paymentId), this.#fold(p.paymentId));
    if (verdict.kind === 'DONE') return verdict.result;
    this.#append({ type: 'CREATED', p });
    return afterCommit(this.#faults, 'create', ok(verdict.record, false));
  }

  async get(id: PaymentId): Promise<PortResult<PaymentRecord, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'get');
    if (before !== null) return before;
    const rec = this.#fold(id);
    return rec === null ? rejected('NOT_FOUND', id) : ok(rec, false);
  }

  async getByRequestKey(payer: NovaOwnerRef, key: IdempotencyKey): Promise<PortResult<PaymentRecord | null, never>> {
    const before = faultBefore(this.#faults, 'getByRequestKey');
    if (before !== null) return before;
    const prior = this.#creation(payer, key);
    return ok(prior === null ? null : this.#fold(prior.paymentId), false);
  }

  async applySignal(id: PaymentId, expectedVersion: bigint, signal: InboundSignal, t: LegTransition, outbox: readonly OutboxItem[]): Promise<SignalResult> {
    const before = faultBefore(this.#faults, 'applySignal');
    if (before !== null) return before;
    const rec = this.#fold(id);
    if (rec === null) return rejected('NOT_FOUND', id);
    const prior = this.#inbox(signal.dedupeKey);
    const verdict = decideSignal(rec, expectedVersion, signal, t, prior, decisionIn(this.#events, signal.dedupeKey), outbox, (k) => this.#enqueued(k));
    if (verdict.kind === 'REJECT') return verdict.result;
    if (verdict.kind === 'NOOP') {
      // A no-change signal is logged unless it is the already-claimed duplicate; only a hold makes it claim the key.
      if (verdict.hold !== null || prior === null) this.#append({ type: 'SIGNAL', id, signal, t, applied: false, outbox: [] });
      return afterCommit(this.#faults, 'applySignal', ok({ outcome: verdict.outcome, record: rec }, verdict.outcome === 'DUPLICATE'));
    }
    this.#append({ type: 'SIGNAL', id, signal, t, applied: true, outbox });
    return afterCommit(this.#faults, 'applySignal', ok({ outcome: 'APPLIED' as const, record: verdict.record }, false));
  }

  async markSubmit(id: PaymentId, expectedVersion: bigint, marker: SubmitMarker): Promise<PortResult<PaymentRecord, MarkSubmitRejectCode>> {
    const before = faultBefore(this.#faults, 'markSubmit');
    if (before !== null) return before;
    const rec = this.#fold(id);
    if (rec === null) return rejected('NOT_FOUND', id);
    const owner = this.#events.find((e) => e.type === 'MARKED' && e.marker.externalId === marker.externalId);
    const verdict = decideMarkSubmit(rec, expectedVersion, marker, this.#enqueued(releaseKey(id)) !== null, owner?.type === 'MARKED' ? owner.id : null);
    if (verdict.kind === 'DONE') return verdict.result;
    this.#append({ type: 'MARKED', id, marker });
    return afterCommit(this.#faults, 'markSubmit', ok(verdict.record, false));
  }

  async findByExternalId(externalId: string): Promise<PortResult<PaymentRecord | null, never>> {
    const before = faultBefore(this.#faults, 'findByExternalId');
    if (before !== null) return before;
    for (const e of this.#events) if (e.type === 'MARKED' && e.marker.externalId === externalId) return ok(this.#fold(e.id), false);
    return ok(null, false);
  }

  async listUnresolvedSubmits(limit: bigint): Promise<PortResult<readonly PaymentRecord[], never>> {
    const before = faultBefore(this.#faults, 'listUnresolvedSubmits');
    if (before !== null) return before;
    return ok(take(this.#all().filter(isUnresolved), limit), false);
  }

  async recordCompensation(id: PaymentId, expectedVersion: bigint, p7: JournalReceipt, original: JournalReceipt): Promise<PortResult<PaymentRecord, CompensationRejectCode>> {
    const before = faultBefore(this.#faults, 'recordCompensation');
    if (before !== null) return before;
    const rec = this.#fold(id);
    if (rec === null) return rejected('NOT_FOUND', id);
    const verdict = decideCompensation(rec, expectedVersion, p7, original);
    if (verdict.kind === 'DONE') return verdict.result;
    this.#append({ type: 'COMPENSATED', id, p7, original });
    return afterCommit(this.#faults, 'recordCompensation', ok(verdict.record, false));
  }

  async commitRange(cursorKey: string, toBlock: bigint, signals: readonly InboundSignal[]): Promise<PortResult<void, 'CURSOR_REGRESSION' | 'SIGNAL_CONFLICT'>> {
    const before = faultBefore(this.#faults, 'commitRange');
    if (before !== null) return before;
    const refused = checkRange(this.#cursor(cursorKey), toBlock, signals, (k) => this.#inbox(k));
    if (refused !== null) return refused;
    this.#append({ type: 'RANGE', cursorKey, toBlock, signals });
    return afterCommit(this.#faults, 'commitRange', ok(undefined, false));
  }

  #cursor(cursorKey: string): bigint | null {
    let c: bigint | null = null;
    for (const e of this.#events) if (e.type === 'RANGE' && e.cursorKey === cursorKey) c = e.toBlock;
    return c;
  }

  async getCursor(cursorKey: string): Promise<PortResult<bigint | null, never>> {
    const before = faultBefore(this.#faults, 'getCursor');
    if (before !== null) return before;
    return ok(this.#cursor(cursorKey), false);
  }

  #railState(): RailState {
    let rail: RailState = RUNNING;
    let pauses = 0n;
    for (const e of this.#events) {
      if (e.type === 'PAUSED' && !rail.paused) {
        pauses += 1n;
        rail = { paused: true, reason: e.reason, incident: pauseIncident(pauses) };
      } else if (e.type === 'UNPAUSED') rail = RUNNING;
    }
    return rail;
  }

  async getRailState(): Promise<PortResult<RailState, never>> {
    const before = faultBefore(this.#faults, 'getRailState');
    if (before !== null) return before;
    return ok(this.#railState(), false);
  }

  async pause(reason: string, actor: string): Promise<PortResult<void, never>> {
    const before = faultBefore(this.#faults, 'pause');
    if (before !== null) return before;
    this.#append({ type: 'PAUSED', reason: `${reason} (by ${actor})` });
    return afterCommit(this.#faults, 'pause', ok(undefined, false));
  }

  async unpause(decision: OperatorDecision): Promise<PortResult<void, UnpauseRejectCode>> {
    const before = faultBefore(this.#faults, 'unpause');
    if (before !== null) return before;
    const consumed = this.#events.some((e) => e.type === 'UNPAUSED' && e.decisionId === decision.decisionId);
    const refused = decideUnpause(this.#railState(), decision, this.#decision(decision.decisionId), consumed);
    if (refused !== null) return refused;
    this.#append({ type: 'UNPAUSED', decisionId: decision.decisionId });
    return afterCommit(this.#faults, 'unpause', ok(undefined, false));
  }

  async listOpen(leg: LegKind, stage: Stage, limit: bigint): Promise<PortResult<readonly PaymentRecord[], never>> {
    const before = faultBefore(this.#faults, 'listOpen');
    if (before !== null) return before;
    return ok(take(this.#all().filter((r) => isOpen(r, leg, stage)), limit), false);
  }

  async pendingOutbox(): Promise<PortResult<readonly OutboxItem[], never>> {
    const before = faultBefore(this.#faults, 'pendingOutbox');
    if (before !== null) return before;
    return ok(this.#outbox(), false);
  }

  async recordDecision(signal: InboundSignal, d: OperatorDecision): Promise<PortResult<{ readonly outcome: SignalOutcome }, DecisionRejectCode>> {
    const before = faultBefore(this.#faults, 'recordDecision');
    if (before !== null) return before;
    const verdict = decideDecision(signal, d, this.#inbox(signal.dedupeKey), this.#decision(d.decisionId));
    if (verdict.kind === 'DONE') return verdict.result;
    this.#append({ type: 'DECISION', signal, d });
    return afterCommit(this.#faults, 'recordDecision', ok({ outcome: 'APPLIED' as const }, false));
  }

  async getDecision(decisionId: string): Promise<PortResult<OperatorDecision, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'getDecision');
    if (before !== null) return before;
    const d = this.#decision(decisionId);
    return d === null ? rejected('NOT_FOUND', decisionId) : ok(d, false);
  }

  async listActiveHolds(wallet: WalletRef): Promise<PortResult<readonly WalletNonceHold[], never>> {
    const before = faultBefore(this.#faults, 'listActiveHolds');
    if (before !== null) return before;
    return ok(foldHolds(this.#events).filter((h) => h.wallet === wallet && h.state === 'ACTIVE'), false);
  }

  async recordHoldObservation(holdId: string, obs: HoldObservation): Promise<PortResult<WalletNonceHold, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'recordHoldObservation');
    if (before !== null) return before;
    const h = this.#hold(holdId);
    if (h === null) return rejected('NOT_FOUND', holdId);
    const next = observeHold(h, obs);
    this.#append({ type: 'HOLD_OBSERVED', holdId, obs });
    return afterCommit(this.#faults, 'recordHoldObservation', ok(next, false));
  }

  async recordHoldNonceTx(holdId: string, txHash: Hex32): Promise<PortResult<WalletNonceHold, 'NOT_FOUND' | 'NONCE_TX_CONFLICT'>> {
    const before = faultBefore(this.#faults, 'recordHoldNonceTx');
    if (before !== null) return before;
    const h = this.#hold(holdId);
    if (h === null) return rejected('NOT_FOUND', holdId);
    const verdict = decideHoldNonceTx(h, txHash);
    if (!('hold' in verdict)) return verdict;
    this.#append({ type: 'HOLD_NONCE_TX', holdId, txHash });
    return afterCommit(this.#faults, 'recordHoldNonceTx', ok(verdict.hold, false));
  }

  async liftHold(holdId: string, evidence: InboundSignal): Promise<PortResult<WalletNonceHold, LiftRejectCode>> {
    const before = faultBefore(this.#faults, 'liftHold');
    if (before !== null) return before;
    const h = this.#hold(holdId);
    if (h === null) return rejected('NOT_FOUND', holdId);
    const verdict = decideLift(h, evidence, this.#inbox(evidence.dedupeKey), decisionIn(this.#events, evidence.dedupeKey));
    if (!('hold' in verdict)) return verdict;
    this.#append({ type: 'HOLD_LIFTED', holdId, evidence });
    return afterCommit(this.#faults, 'liftHold', ok(verdict.hold, false));
  }

  #case(caseId: string): CaseRecord | null {
    return foldCases(this.#events).find((c) => c.caseId === caseId) ?? null;
  }

  async closeFailedPayout(id: PaymentId, expectedVersion: bigint, evidence: InboundSignal, outbox: readonly OutboxItem[]): Promise<SignalResult> {
    const before = faultBefore(this.#faults, 'closeFailedPayout');
    if (before !== null) return before;
    const rec = this.#fold(id);
    if (rec === null) return rejected('NOT_FOUND', id);
    const partnerCase = this.#case(deriveCaseId('PARTNER_RETURN', id));
    const verdict = decideClosePayout(rec, expectedVersion, evidence, outbox, this.#inbox(evidence.dedupeKey), decisionIn(this.#events, evidence.dedupeKey), partnerCase, (k) => this.#enqueued(k));
    if (verdict.kind === 'DONE') return verdict.result;
    this.#append({ type: 'CLOSED', id, evidence, outbox });
    return afterCommit(this.#faults, 'closeFailedPayout', ok({ outcome: 'APPLIED' as const, record: verdict.record }, false));
  }

  async putCase(c: CaseRecord): Promise<PortResult<CaseRecord, CaseRejectCode>> {
    const before = faultBefore(this.#faults, 'putCase');
    if (before !== null) return before;
    const verdict = decidePutCase(c, this.#case(c.caseId), (d) => this.#decision(d));
    if (verdict.kind !== 'PUT') return verdict;
    this.#append({ type: 'CASE_PUT', c });
    return afterCommit(this.#faults, 'putCase', ok(c, false));
  }

  async getCase(caseId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'getCase');
    if (before !== null) return before;
    const c = this.#case(caseId);
    return c === null ? rejected('NOT_FOUND', caseId) : ok(c, false);
  }

  async addCaseDecision(caseId: string, decisionId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND' | 'DECISION_MISSING'>> {
    const before = faultBefore(this.#faults, 'addCaseDecision');
    if (before !== null) return before;
    const c = this.#case(caseId);
    if (c === null) return rejected('NOT_FOUND', caseId);
    const verdict = decideCaseDecision(c, this.#decision(decisionId));
    if (!('record' in verdict)) return verdict;
    this.#append({ type: 'CASE_DECISION', caseId, decisionId });
    return afterCommit(this.#faults, 'addCaseDecision', ok(verdict.record, false));
  }

  async claimInbound(log: InboundSignal, triple: InboundTriple): Promise<PortResult<{ readonly claimedBy: CaseRecord | null }, 'SIGNAL_CONFLICT'>> {
    const before = faultBefore(this.#faults, 'claimInbound');
    if (before !== null) return before;
    const cases = foldCases(this.#events);
    const claimed = cases.find((c) => c.matchedLog === log.dedupeKey) ?? null;
    const open = cases.filter((c) => c.kind === 'PARTNER_RETURN' && c.state === 'OPEN');
    const verdict = decideClaim(log, triple, this.#inbox(log.dedupeKey), claimed, open);
    if (!('record' in verdict)) return verdict;
    this.#append({ type: 'CLAIMED', log, caseId: verdict.record.caseId });
    return afterCommit(this.#faults, 'claimInbound', ok({ claimedBy: verdict.record }, false));
  }
}
