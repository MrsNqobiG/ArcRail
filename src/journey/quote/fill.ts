/**
 * JQUOTE fill desk: a pricing code, then a manual fill (design delta 1, D-1;
 * assumptions DA-1..DA-4, open questions DQ-1..DQ-3, none verified).
 *
 * The desk owns the package's side of Nova's two FX steps:
 * - `lockerFor(binding)` is the FxLocker the composer uses for one payment.
 *   It requests one pricing code per (payment id, quote request key) through
 *   `FxPort.getPricingCode` (idempotent on the derived key), reads the code's
 *   own `expiresAt` (the rate lock; no duration is fixed here), derives the
 *   code's quote at the code's rate and checks it with `checkFxLock`. It
 *   refuses a second code while the payment has a code whose outcome is not
 *   known and whose fill window (`expiresAt` + `fillTimeoutAfterExpiryMs`) is
 *   still running, a booked conversion, a refused booked fill that is not
 *   adopted or reversed, or a quarantine (verifier delta1 m12).
 * - `awaitFill(codeId)` / `receive(event)` take each delivered event:
 *   authenticity first (`FxPort.verifyFillEvent`; with the scheme unknown,
 *   DQ-1, nothing is accepted), then dedupe on `fill:<codeId>` with a digest
 *   over the canonical projection (never the raw envelope). At most one
 *   outcome per code: a second, different event is SIGNAL_CONFLICT and
 *   QUARANTINEs the payment. A FILLED event is accepted only when every D-1
 *   check passes: (1) a code this package requested and still open, (2) the
 *   code's pair and amounts exactly, (3) the code's rate by
 *   cross-multiplication, (4) the booked entry read back through the ledger
 *   (balanced, client debited exactly the from amount, to side credited
 *   exactly the to amount, remainder exactly to the dust destination) and
 *   (5) `filledAt < expiresAt`, by Nova's fill time, never arrival time. A
 *   journey never proceeds on an expired code.
 * - A refused FILLED event was already booked by Nova (answer 33), so it is
 *   never dropped: it is kept as an unmatched fill with its booked entry and
 *   opens a requote case of kind UNMATCHED_FILL. It is `adoptable` only when checks 2-4 passed and
 *   it failed only on expiry or because a requote superseded its code
 *   (verifier delta1 B1); anything else closes only by a reversal.
 * - REJECTED and EXPIRED outcomes book nothing; they also open a requote case.
 * - `sweepTimeouts()` opens a case for every code whose fill window ended
 *   with no outcome (in injected clock time).
 *
 * Cases go to the OPS case queue (src/ops, unit OPS) through `FillCasePort`;
 * `opsFillCases` adapts `OpsQueue.openCase`, and trusted server code adds the
 * case's options. Kinds and reasons are OPS's closed sets (delta amendment
 * A-2): a refused booked fill is UNMATCHED_FILL, a fill window that ended
 * with no outcome is FILL_TIMEOUT, a REJECTED or EXPIRED outcome is REQUOTE,
 * a second distinct event is QUARANTINE; see `fillCaseFor`. The exact
 * refusal is also in the evidence references (`refusal:<code>`).
 *
 * Money path: no `number` anywhere (MC-01); amounts are only compared here.
 */
import { ambiguous, idempotencyKey, isPaymentId, lpDigestHex, ok, rejected } from '../../nova-ports/ids.js';
import type { IdempotencyKey, PaymentId, PortResult } from '../../nova-ports/ids.js';
import type { QuoteRequest } from '../../nova-ports/conversion.js';
import type { LedgerAccount, LedgerPort } from '../../nova-ports/ledger.js';
import type { CbsPrecision } from '../../amounts/index.js';
import type { CaseKind, CaseRecord } from '../../ops/types.js';
import type { OpenCaseInput, OpsCode, OpsQueue } from '../../ops/queue.js';
import { bookedEntryProblem, checkFxLock, fillEventProblem, fillTermsProblem, filledInTime, isFxRef, isPositiveRatio, quoteAtCodeRate } from './ports.js';
import type {
  Clock,
  ExpiryReader,
  FillAccounts,
  FillAuthCode,
  FillEvent,
  FilledEvent,
  FillRefusal,
  FxLock,
  FxLocker,
  FxPort,
  FxRejectCode,
  LedgerReadBackPort,
  PricingCode,
  RawFillEvent,
} from './ports.js';

// ---------------------------------------------------------------------------
// Configuration, ports and results.
// ---------------------------------------------------------------------------

/** The server-side payment a code is requested for. Never from client input. */
export interface CodeBinding {
  readonly paymentId: PaymentId;
  readonly clientUid: string;
  /** The client's from-asset account and the to-side account check 4 binds the fill to. */
  readonly accounts: Omit<FillAccounts, 'dust'>;
}

export interface FillDeskConfig {
  /** How long after a code's `expiresAt` a fill may still arrive (DQ-2, OPEN). Null is refused at construction (fail closed). */
  readonly fillTimeoutAfterExpiryMs: bigint | null;
  /** The dust destination (D-5, F-4, OPEN): set explicitly. Null is refused at construction (fail closed). */
  readonly dustAccount: LedgerAccount | null;
  /** Nova ledger precision of the settlement stablecoin [A-01]. */
  readonly usdcPrecision: CbsPrecision;
}

/** The OPS case kinds the desk opens (OPS's closed set; a kind OPS drops is a compile error here). */
export type FillCaseKind = Extract<CaseKind, 'UNMATCHED_FILL' | 'FILL_TIMEOUT' | 'REQUOTE' | 'QUARANTINE'>;

/** A case the desk asks OPS to open. Server-built from a verified signal; never from operator or client input. */
export interface FillCaseRequest {
  readonly kind: FillCaseKind;
  readonly reason: string;
  readonly subject: string;
  readonly paymentId: PaymentId;
  readonly clientUid: string;
  /** UNMATCHED_FILL: the entry Nova already booked (the case closes by ADOPT or REVERSE of it); null otherwise. */
  readonly bookedEntryRef: string | null;
  readonly evidenceRefs: readonly string[];
}

export interface FillCasePort {
  open(req: FillCaseRequest): Promise<PortResult<CaseRecord, OpsCode>>;
}

/**
 * `FillCasePort` over the OPS queue. `toInput` is trusted server code (the
 * composition root) that turns the request into OPS's `OpenCaseInput`,
 * adding the case's server-side options; never an operator.
 */
export function opsFillCases(queue: Pick<OpsQueue, 'openCase'>, toInput: (req: FillCaseRequest) => OpenCaseInput): FillCasePort {
  return { open: async (req) => queue.openCase(toInput(req)) };
}

export interface FillDeskDeps {
  readonly fx: FxPort;
  /** Nova's LedgerPort precision lookup plus the read-back check 4 needs. */
  readonly ledger: Pick<LedgerPort, 'getAssetPrecision'> & LedgerReadBackPort;
  readonly cases: FillCasePort;
  readonly clock: Clock;
  readonly readExpiry: ExpiryReader;
}

/** Thrown at construction when a required value is unset: the desk does not start (fail closed). */
export class FillDeskConfigError extends Error {
  readonly code = 'FILL_DESK_CONFIG';

  constructor(detail: string) {
    super(`fill desk configuration: ${detail}`);
    this.name = 'FillDeskConfigError';
  }
}

/** The outcome of one delivered event. `duplicate` is true when the same event was already decided (no second effect). */
export type FillDecision =
  | { readonly kind: 'FILL_ACCEPTED'; readonly codeId: string; readonly paymentId: PaymentId; readonly fill: FilledEvent; readonly duplicate: boolean }
  | {
      readonly kind: 'UNMATCHED_FILL';
      readonly codeId: string;
      readonly paymentId: PaymentId;
      readonly refusal: FillRefusal;
      readonly detail: string;
      readonly adoptable: boolean;
      readonly bookedEntryRef: string;
      readonly caseId: string | null;
      readonly duplicate: boolean;
    }
  | { readonly kind: 'REQUOTE_REQUIRED'; readonly codeId: string; readonly paymentId: PaymentId; readonly outcome: 'REJECTED' | 'EXPIRED'; readonly caseId: string | null; readonly duplicate: boolean }
  | { readonly kind: 'SIGNAL_CONFLICT'; readonly codeId: string; readonly paymentId: PaymentId | null; readonly caseId: string | null; readonly duplicate: false }
  | { readonly kind: 'UNKNOWN_CODE'; readonly codeId: string; readonly duplicate: boolean }
  | { readonly kind: 'REFUSED'; readonly code: FillAuthCode; readonly detail: string }
  | { readonly kind: 'RETRY'; readonly detail: string };

/** A code whose fill window ended with no outcome. */
export interface FillTimeout {
  readonly codeId: string;
  readonly paymentId: PaymentId;
  readonly caseId: string | null;
}

export type AdoptCode = 'NOT_FOUND' | 'NOT_ADOPTABLE' | 'CONVERSION_EXISTS';

/** What opens a case. */
export type FillCaseCause = FillRefusal | 'FILL_TIMEOUT' | 'REJECTED' | 'EXPIRED' | 'SIGNAL_CONFLICT';

/**
 * The OPS kind and reason for each cause (OPS REASONS). A booked fill made
 * or delivered too late is UNMATCHED_FILL FILL_AFTER_EXPIRY (a code
 * superseded by a requote counts as late); a booking that fails the
 * read-back is FILL_MISPOSTED; any other refused booked fill (another pair,
 * amount or rate, or a code refused when issued) is FILL_TERMS_MISMATCH. No
 * outcome by the end of the fill window is FILL_TIMEOUT. A REJECTED or
 * EXPIRED outcome books nothing and is a REQUOTE. A second distinct event is
 * QUARANTINE SIGNAL_CONFLICT.
 */
export function fillCaseFor(cause: FillCaseCause): { readonly kind: FillCaseKind; readonly reason: string } {
  switch (cause) {
    case 'FILLED_AFTER_EXPIRY':
    case 'CODE_SUPERSEDED':
      return { kind: 'UNMATCHED_FILL', reason: 'FILL_AFTER_EXPIRY' };
    case 'FILL_MISPOSTED':
      return { kind: 'UNMATCHED_FILL', reason: 'FILL_MISPOSTED' };
    case 'FILL_TIMEOUT':
      return { kind: 'FILL_TIMEOUT', reason: 'NO_FILL_BY_TIMEOUT' };
    case 'EXPIRED':
      return { kind: 'REQUOTE', reason: 'RATE_EXPIRED' };
    case 'REJECTED':
      return { kind: 'REQUOTE', reason: 'RATE_CHANGED' };
    case 'SIGNAL_CONFLICT':
      return { kind: 'QUARANTINE', reason: 'SIGNAL_CONFLICT' };
    default:
      return { kind: 'UNMATCHED_FILL', reason: 'FILL_TERMS_MISMATCH' };
  }
}

/** The Nova idempotency key of a code: derived from the payment id and the composer's quote request key (§10.2 style). */
export function codeKey(paymentId: PaymentId, quoteKey: IdempotencyKey): IdempotencyKey {
  return idempotencyKey(`fxc:${lpDigestHex(['jquote-fx-code', paymentId, quoteKey])}`);
}

/** Digest of the canonical projection of an event (D-1): never the raw envelope. The reviewer is not part of it. */
export function fillDigest(e: FillEvent): string {
  if (e.kind !== 'FILLED') return lpDigestHex(['fx-fill-v1', e.kind, e.codeId]);
  return lpDigestHex([
    'fx-fill-v1',
    e.kind,
    e.codeId,
    e.from,
    e.to,
    e.fromAmount.toString(),
    e.toAmount.toString(),
    `${e.rate.numerator}/${e.rate.denominator}`,
    e.remainder.toString(),
    e.bookedEntryRef,
    e.filledAtMs.toString(),
  ]);
}

// ---------------------------------------------------------------------------
// The desk.
// ---------------------------------------------------------------------------

/** A code's life: OPEN until its one outcome; SUPERSEDED by a requote after its fill window; UNUSABLE when refused at issue. */
export type CodeState = 'OPEN' | 'UNUSABLE' | 'SUPERSEDED' | 'FILLED' | 'UNMATCHED' | 'NOT_FILLED';

interface Unmatched {
  readonly fill: FilledEvent;
  readonly refusal: FillRefusal;
  readonly detail: string;
  /** The code's lock when the fill is adoptable (checks 2-4 passed), else null. */
  readonly adoptLock: FxLock | null;
  resolution: 'OPEN' | 'ADOPTED' | 'REVERSED';
  reversalRef: string | null;
}

interface CodeRow {
  readonly codeId: string;
  readonly novaKey: IdempotencyKey;
  readonly canonical: string;
  readonly binding: CodeBinding;
  /** The code's lock, or why it was refused when issued (state UNUSABLE). */
  readonly issued: Issued;
  /** End of the fill window: the code's expiresAt + fillTimeoutAfterExpiryMs (0 for a code refused when issued: never OPEN). */
  readonly deadlineMs: bigint;
  state: CodeState;
  fill: FilledEvent | null;
  timeoutCaseId: string | null;
  unmatched: Unmatched | null;
}

/** The decisions that are recorded against a code's dedupe key (RETRY, REFUSED and SIGNAL_CONFLICT never are). */
type Recorded = Extract<FillDecision, { readonly kind: 'FILL_ACCEPTED' | 'UNMATCHED_FILL' | 'REQUOTE_REQUIRED' | 'UNKNOWN_CODE' }>;
type Decided = Recorded | Extract<FillDecision, { readonly kind: 'RETRY' }>;

/** A decision and how to (re)open its case, idempotently (OPS dedupes on kind and subject). */
interface Outcome {
  readonly decision: Decided;
  readonly reopen: () => Promise<string | null>;
}

interface EventRow {
  readonly digest: string;
  decision: Recorded | null;
  reopen: () => Promise<string | null>;
  pending: Promise<Outcome> | null;
}

const NO_CASE = async (): Promise<string | null> => null;

type Issued = { readonly lock: FxLock } | { readonly code: FxRejectCode; readonly detail: string };

type Judgement = { readonly refusal: FillRefusal; readonly detail: string; readonly adoptLock: FxLock | null } | null | 'RETRY';

function canonicalRequest(req: QuoteRequest): string {
  return JSON.stringify([req.from, req.to, req.amount.toString(), req.side]);
}

export class FillDesk {
  readonly #deps: FillDeskDeps;
  readonly #timeoutMs: bigint;
  readonly #dust: LedgerAccount;
  readonly #usdcPrecision: CbsPrecision;
  readonly #byKey = new Map<string, CodeRow>();
  readonly #codes = new Map<string, CodeRow>();
  readonly #events = new Map<string, EventRow>();
  readonly #quarantined = new Set<string>();

  constructor(cfg: FillDeskConfig, deps: FillDeskDeps) {
    if (cfg.fillTimeoutAfterExpiryMs === null) throw new FillDeskConfigError('fillTimeoutAfterExpiryMs is unset (DQ-2): set it explicitly');
    if (cfg.fillTimeoutAfterExpiryMs < 0n) throw new FillDeskConfigError('fillTimeoutAfterExpiryMs must not be negative');
    if (cfg.dustAccount === null) throw new FillDeskConfigError('the dust destination is unset (D-5, F-4): set it explicitly');
    this.#timeoutMs = cfg.fillTimeoutAfterExpiryMs;
    this.#dust = cfg.dustAccount;
    this.#usdcPrecision = cfg.usdcPrecision;
    this.#deps = deps;
  }

  /** The composer's FxLocker for one payment. Throws on a malformed binding (a programming error: bindings are server-side). */
  lockerFor(binding: CodeBinding): FxLocker {
    if (!isPaymentId(binding.paymentId) || !isFxRef(binding.clientUid)) throw new TypeError('code binding needs a payment id and a client uid');
    return { lockRate: async (key, req) => this.#lock(binding, key, req) };
  }

  async #lock(binding: CodeBinding, key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<FxLock, FxRejectCode>> {
    const novaKey = codeKey(binding.paymentId, key);
    const canonical = canonicalRequest(req);
    const prior = this.#byKey.get(novaKey);
    if (prior !== undefined) {
      if (prior.canonical !== canonical) return rejected('KEY_CONFLICT', `key ${key} reused with another request`);
      return 'lock' in prior.issued ? ok(prior.issued.lock, true) : rejected(prior.issued.code, prior.issued.detail);
    }
    const block = this.#blocked(binding.paymentId);
    if (block !== null) return rejected('FILL_OUTSTANDING', block);
    const fromPrec = await this.#deps.ledger.getAssetPrecision(req.from);
    if (fromPrec.kind === 'AMBIGUOUS') return ambiguous(fromPrec.cause);
    const toPrec = await this.#deps.ledger.getAssetPrecision(req.to);
    if (toPrec.kind === 'AMBIGUOUS') return ambiguous(toPrec.cause);
    if (fromPrec.kind === 'REJECTED' || toPrec.kind === 'REJECTED') return rejected('NO_ROUTE', `${req.from}->${req.to}: asset unknown to the ledger`);
    const r = await this.#deps.fx.getPricingCode(novaKey, req);
    if (r.kind !== 'OK') return r;
    const code = r.value;
    if (!isFxRef(code.codeId)) return rejected('BAD_CODE', 'the pricing code has no usable id');
    // A key seen before returned above, so a known code id here is bound to another request.
    if (this.#codes.has(code.codeId)) return rejected('BAD_CODE', `code ${code.codeId} is already bound to another request`);
    const issued = this.#evaluate(req, code, fromPrec.value, toPrec.value);
    const usable = 'lock' in issued;
    if (usable) for (const old of this.#rowsOf(binding.paymentId)) if (old.state === 'OPEN') old.state = 'SUPERSEDED';
    const row: CodeRow = {
      codeId: code.codeId,
      novaKey,
      canonical,
      binding,
      issued,
      deadlineMs: usable ? issued.lock.expiresAtMs + this.#timeoutMs : 0n,
      state: usable ? 'OPEN' : 'UNUSABLE',
      fill: null,
      timeoutCaseId: null,
      unmatched: null,
    };
    this.#byKey.set(novaKey, row);
    this.#codes.set(code.codeId, row);
    return usable ? ok(issued.lock, r.replayed) : rejected(issued.code, issued.detail);
  }

  /** The code's lock, or why it cannot be used. Pure: the code is recorded either way, so a fill on it is never dropped. */
  #evaluate(req: QuoteRequest, code: PricingCode, fromPrec: CbsPrecision, toPrec: CbsPrecision): Issued {
    if (!isPositiveRatio(code.rate)) return { code: 'BAD_CODE', detail: 'the code rate is not a ratio of positive integers' };
    const expiresAtMs = this.#deps.readExpiry(code.expiresAt);
    if (expiresAtMs === null) return { code: 'BAD_EXPIRY', detail: `unreadable expiry ${JSON.stringify(code.expiresAt)}` };
    const quote = quoteAtCodeRate(req, code, fromPrec, toPrec);
    if (quote === null) return { code: 'NO_ROUTE', detail: 'the amount does not convert exactly at the code rate' };
    const lock: FxLock = { quote, expiresAtMs };
    const why = checkFxLock(req, lock, this.#usdcPrecision);
    if (why !== null) return { code: 'NO_ROUTE', detail: `the code quote is not exact: ${why}` };
    return { lock };
  }

  *#rowsOf(paymentId: PaymentId): Generator<CodeRow> {
    for (const row of this.#codes.values()) if (row.binding.paymentId === paymentId) yield row;
  }

  /** Why the payment may not get a new code now; null when it may. */
  #blocked(paymentId: PaymentId): string | null {
    if (this.#quarantined.has(paymentId)) return 'the payment is quarantined (SIGNAL_CONFLICT)';
    const now = this.#deps.clock.nowMs();
    for (const row of this.#rowsOf(paymentId)) {
      if (row.state === 'FILLED') return `the payment has a booked conversion (code ${row.codeId})`;
      if (row.state === 'OPEN' && now < row.deadlineMs) return `the outcome of code ${row.codeId} is not known yet`;
      if (row.unmatched !== null && row.unmatched.resolution === 'OPEN') return `the booked fill of code ${row.codeId} is not adopted or reversed`;
    }
    return null;
  }

  /** Waits for Nova's next event for `codeId` and decides it. */
  async awaitFill(codeId: string): Promise<FillDecision> {
    return this.receive(await this.#deps.fx.awaitFill(codeId));
  }

  /** Decides one delivered event (also a redelivery): authenticity, then dedupe, then the D-1 checks. */
  async receive(raw: RawFillEvent): Promise<FillDecision> {
    const v = await this.#deps.fx.verifyFillEvent(raw.rawBody, raw.headers);
    if (v.kind === 'AMBIGUOUS') return { kind: 'RETRY', detail: `the authenticity check outcome is unknown (${v.cause})` };
    if (v.kind === 'REJECTED') return { kind: 'REFUSED', code: v.code, detail: v.detail };
    const ev = v.value;
    const bad = fillEventProblem(ev);
    if (bad !== null) return { kind: 'REFUSED', code: 'MALFORMED', detail: bad };
    const dedupeKey = `fill:${ev.codeId}`;
    const digest = fillDigest(ev);
    const seen = this.#events.get(dedupeKey);
    if (seen !== undefined && seen.digest !== digest) return this.#conflict(ev.codeId, seen.digest);
    if (seen !== undefined && seen.decision !== null) return this.#replay(seen, seen.decision);
    if (seen !== undefined && seen.pending !== null) {
      const first = (await seen.pending).decision;
      return first.kind === 'RETRY' ? first : this.#replay(seen, first);
    }
    const row: EventRow = seen ?? { digest, decision: null, reopen: NO_CASE, pending: null };
    this.#events.set(dedupeKey, row);
    const pending = this.#decide(ev);
    row.pending = pending;
    const { decision, reopen } = await pending;
    row.pending = null;
    row.reopen = reopen;
    if (decision.kind !== 'RETRY') row.decision = decision;
    return decision;
  }

  /** The recorded decision again, with no second effect; a case that could not be opened before is retried. */
  async #replay(ev: EventRow, d: Recorded): Promise<FillDecision> {
    if ((d.kind === 'UNMATCHED_FILL' || d.kind === 'REQUOTE_REQUIRED') && d.caseId === null) {
      const caseId = await ev.reopen();
      ev.decision = { ...d, caseId };
      return { ...d, caseId, duplicate: true };
    }
    return { ...d, duplicate: true };
  }

  async #conflict(codeId: string, firstDigest: string): Promise<FillDecision> {
    const row = this.#codes.get(codeId);
    if (row === undefined) return { kind: 'SIGNAL_CONFLICT', codeId, paymentId: null, caseId: null, duplicate: false };
    this.#quarantined.add(row.binding.paymentId);
    const caseId = await this.#openCase(row, 'SIGNAL_CONFLICT', `fill-conflict:${codeId}`, null, [`fill:${codeId}`, `first-digest:${firstDigest}`]);
    return { kind: 'SIGNAL_CONFLICT', codeId, paymentId: row.binding.paymentId, caseId, duplicate: false };
  }

  async #decide(ev: FillEvent): Promise<Outcome> {
    const row = this.#codes.get(ev.codeId);
    if (row === undefined) return { decision: { kind: 'UNKNOWN_CODE', codeId: ev.codeId, duplicate: false }, reopen: NO_CASE };
    const paymentId = row.binding.paymentId;
    if (ev.kind !== 'FILLED') {
      row.state = 'NOT_FILLED';
      const outcome = ev.kind;
      const reopen = async (): Promise<string | null> => this.#openCase(row, outcome, `code:${row.codeId}`, null, [`code:${row.codeId}`, `outcome:${outcome}`]);
      return { decision: { kind: 'REQUOTE_REQUIRED', codeId: ev.codeId, paymentId, outcome, caseId: await reopen(), duplicate: false }, reopen };
    }
    const j = await this.#judge(row, ev);
    if (j === 'RETRY') return { decision: { kind: 'RETRY', detail: 'the booked entry read-back outcome is unknown' }, reopen: NO_CASE };
    if (j === null) {
      row.state = 'FILLED';
      row.fill = ev;
      return { decision: { kind: 'FILL_ACCEPTED', codeId: ev.codeId, paymentId, fill: ev, duplicate: false }, reopen: NO_CASE };
    }
    row.state = 'UNMATCHED';
    const u: Unmatched = { fill: ev, refusal: j.refusal, detail: j.detail, adoptLock: j.adoptLock, resolution: 'OPEN', reversalRef: null };
    row.unmatched = u;
    const reopen = async (): Promise<string | null> => this.#openCase(row, u.refusal, `fill:${row.codeId}`, ev.bookedEntryRef, [`fill:${row.codeId}`, `booked:${ev.bookedEntryRef}`, `refusal:${u.refusal}`]);
    const caseId = await reopen();
    return { decision: { kind: 'UNMATCHED_FILL', codeId: ev.codeId, paymentId, refusal: j.refusal, detail: j.detail, adoptable: j.adoptLock !== null, bookedEntryRef: ev.bookedEntryRef, caseId, duplicate: false }, reopen };
  }

  /**
   * Checks 1-5 in order. Null: accept. Adoptable (the lock is returned) only
   * when checks 2-4 passed (verifier delta1 B1). A row reaching here is OPEN,
   * SUPERSEDED or UNUSABLE: any other state already has its one outcome, so a
   * second event for it is a duplicate or a SIGNAL_CONFLICT.
   */
  async #judge(row: CodeRow, fill: FilledEvent): Promise<Judgement> {
    if (!('lock' in row.issued)) return { refusal: 'CODE_NOT_OPEN', detail: `code ${row.codeId} is ${row.state}`, adoptLock: null };
    const lock = row.issued.lock;
    const terms = fillTermsProblem(lock.quote, fill);
    if (terms !== null) return { refusal: terms, detail: 'the fill is not the code quote', adoptLock: null };
    const rb = await this.#deps.ledger.getBookedEntry(fill.bookedEntryRef);
    if (rb.kind === 'AMBIGUOUS') return 'RETRY';
    const why = rb.kind === 'REJECTED' ? `booked entry ${fill.bookedEntryRef} not found` : bookedEntryProblem(rb.value, fill, { ...row.binding.accounts, dust: this.#dust });
    if (why !== null) return { refusal: 'FILL_MISPOSTED', detail: why, adoptLock: null };
    if (row.state === 'SUPERSEDED') return { refusal: 'CODE_SUPERSEDED', detail: `code ${row.codeId} was superseded by a requote`, adoptLock: lock };
    if (!filledInTime(fill, lock.expiresAtMs)) return { refusal: 'FILLED_AFTER_EXPIRY', detail: `filled at ${fill.filledAtMs}, code expired at ${lock.expiresAtMs}`, adoptLock: lock };
    return null;
  }

  async #openCase(row: CodeRow, cause: FillCaseCause, subject: string, bookedEntryRef: string | null, evidenceRefs: readonly string[]): Promise<string | null> {
    const r = await this.#deps.cases.open({ ...fillCaseFor(cause), subject, paymentId: row.binding.paymentId, clientUid: row.binding.clientUid, bookedEntryRef, evidenceRefs });
    return r.kind === 'OK' ? r.value.caseId : null;
  }

  /** Opens a case for every open code whose fill window (`expiresAt` + timeout) has ended with no outcome. Repeats until the case opens. */
  async sweepTimeouts(): Promise<readonly FillTimeout[]> {
    const now = this.#deps.clock.nowMs();
    let out: readonly FillTimeout[] = [];
    for (const row of [...this.#codes.values()]) {
      if (row.state !== 'OPEN' || row.timeoutCaseId !== null || now < row.deadlineMs) continue;
      row.timeoutCaseId = await this.#openCase(row, 'FILL_TIMEOUT', `fill-timeout:${row.codeId}`, null, [`code:${row.codeId}`, 'refusal:FILL_TIMEOUT']);
      out = [...out, { codeId: row.codeId, paymentId: row.binding.paymentId, caseId: row.timeoutCaseId }];
    }
    return out;
  }

  /**
   * ADOPT (D-2 `ADOPT_FILL`, two-person, applied by the operator-action layer
   * only): the payment's conversion becomes the already-booked fill, so no
   * new code is requested for that money. Only an adoptable fill (checks 2-4
   * passed), only when the payment has no other booked conversion, and never
   * while the payment is quarantined. Any newer open code of the payment is
   * superseded, so its fill can never be a second conversion. Returns the
   * code's lock (equal to the booked fill by check 2).
   */
  adopt(codeId: string): PortResult<FxLock, AdoptCode> {
    const row = this.#codes.get(codeId);
    if (row === undefined || row.unmatched === null || row.unmatched.resolution !== 'OPEN') return rejected('NOT_FOUND', `no unresolved booked fill on code ${codeId}`);
    const u = row.unmatched;
    if (u.adoptLock === null) return rejected('NOT_ADOPTABLE', `${u.refusal}: closes only by a reversal (P12)`);
    if (this.#quarantined.has(row.binding.paymentId)) return rejected('NOT_ADOPTABLE', 'the payment is quarantined');
    for (const other of this.#rowsOf(row.binding.paymentId)) if (other.state === 'FILLED') return rejected('CONVERSION_EXISTS', `the payment already has a booked conversion (code ${other.codeId})`);
    for (const other of this.#rowsOf(row.binding.paymentId)) if (other.state === 'OPEN') other.state = 'SUPERSEDED';
    u.resolution = 'ADOPTED';
    row.state = 'FILLED';
    row.fill = u.fill;
    return ok(u.adoptLock, false);
  }

  /** REVERSE (D-2 `REVERSE_FILL`, two-person): records the posted compensating reversal (P12) of a refused booked fill. */
  recordReversal(codeId: string, reversalRef: string): PortResult<void, 'NOT_FOUND'> {
    const u = this.#codes.get(codeId)?.unmatched ?? null;
    if (u === null || u.resolution !== 'OPEN' || !isFxRef(reversalRef)) return rejected('NOT_FOUND', `no unresolved booked fill on code ${codeId}, or no reversal reference`);
    u.resolution = 'REVERSED';
    u.reversalRef = reversalRef;
    return ok(undefined, false);
  }

  /**
   * The close-time invariant: one booked conversion per payment, or a
   * reversal for each extra. Null when it holds. A second accepted
   * conversion cannot arise (the requote guard and `adopt` refuse it), so
   * what remains to check is that every refused booked fill is adopted or
   * reversed.
   */
  bookedConversionProblem(paymentId: PaymentId): string | null {
    for (const row of this.#rowsOf(paymentId)) {
      if (row.unmatched !== null && row.unmatched.resolution === 'OPEN') return `the booked fill of code ${row.codeId} is neither adopted nor reversed`;
    }
    return null;
  }

  /** A code's state and, for a refused booked fill, how it was resolved (for operators and audit); null for an unknown code. */
  codeStatus(codeId: string): { readonly state: CodeState; readonly resolution: Unmatched['resolution'] | null; readonly reversalRef: string | null } | null {
    const row = this.#codes.get(codeId);
    if (row === undefined) return null;
    return { state: row.state, resolution: row.unmatched?.resolution ?? null, reversalRef: row.unmatched?.reversalRef ?? null };
  }

  /** True after a SIGNAL_CONFLICT on any of the payment's codes: the journey must not move the payment's money. */
  isQuarantined(paymentId: PaymentId): boolean {
    return this.#quarantined.has(paymentId);
  }

  /** The accepted (or adopted) fill of the payment; null when it has none. The journey proceeds only on this. */
  acceptedFill(paymentId: PaymentId): FilledEvent | null {
    if (this.#quarantined.has(paymentId)) return null;
    for (const row of this.#rowsOf(paymentId)) if (row.state === 'FILLED') return row.fill;
    return null;
  }
}
