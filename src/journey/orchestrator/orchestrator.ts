/**
 * JORCH: the journey state machine for all four pay-in x payout combinations.
 *
 *   gate -> pay-in confirmed (fiat or stablecoin deposit) -> reserve ->
 *   convert (fiat only, fill desk, never on an expired code) -> D1 Arc send ->
 *   arrival confirmed by our own indexer -> payout (partner, fiat bank only;
 *   a stablecoin payout IS the Arc transfer). ARRIVED only on the final
 *   confirmation of the last leg.
 *
 * Leg states move only through `decideTransition` (src/status): an illegal
 * move is never applied, it quarantines the payment (fail closed). Every leg,
 * failure, retry and operator action is appended to the client history; a
 * history outage never blocks money progress, but the entries queue in an
 * outbox and a gap older than `historyGapMaxAgeMs` opens a case. Unknown DFNS
 * outcomes become UNRESOLVED_SUBMIT cases and are never re-sent. Requote,
 * consent-style and manual-fill paths open OPS cases and hold. Notification
 * failures never touch money state.
 * No LLM, no floats, bigint minor units only.
 */
import type { HistoryEntryInput, HistoryPort } from '../../history/index.js';
import { STATUS_BY_STAGE, decideTransition, paymentState, toTransactionStatus } from '../../status/index.js';
import type { DfnsRequest, LegKind, LegState, RejectedReason, SignalSource, Stage, TransactionStatus } from '../../status/index.js';
import { journeyEnabled, journeyLegs, legsMatchJourney } from '../../status/journey.js';
import type { JourneyFlags } from '../../status/journey.js';
import type { Hex32, PaymentId } from '../../nova-ports/ids.js';
import type { CaseKind } from '../../ops/types.js';
import type { Notifier } from '../timeline/notifier.js';
import { safeNotifier } from '../timeline/notifier.js';
import type { Clock } from '../quote/ports.js';
import type { JourneyMoney } from '../quote/compose.js';
import type { ArcSendPort, CasePort, ConversionStep, DecisionPort, FundsPort, JourneyOrder, PayInPort, PayoutPort } from './ports.js';

export interface OrchestratorConfig {
  readonly flags: JourneyFlags;
  /** Cross-border journeys stay refused while this is false (the default and the fail-closed value). */
  readonly crossBorderEnabled: boolean;
  /** A history gap older than this opens a HISTORY_WRITE_FAILED case. */
  readonly historyGapMaxAgeMs: bigint;
  /** A payout still PENDING this long after it started opens a STUCK_PAYOUT case. */
  readonly payoutStuckAfterMs: bigint;
}

export interface OrchestratorDeps {
  readonly clock: Clock;
  readonly store: JourneyStore;
  readonly history: HistoryPort;
  readonly notifier: Notifier;
  readonly cases: CasePort;
  readonly funds: FundsPort;
  readonly payIn: PayInPort | null;
  readonly conversion: ConversionStep | null;
  readonly arc: ArcSendPort;
  readonly payout: PayoutPort | null;
  /** The OPS case store, read to resume a held journey after a two-person decision. Null: no resume (stays held, fail closed). */
  readonly decisions?: DecisionPort | null;
}

export interface JourneyStore {
  get(id: PaymentId): JourneyRecord | null;
  put(rec: JourneyRecord): void;
}

type Step = 'GATE' | 'PAYIN' | 'RESERVE' | 'CONVERT' | 'ARC' | 'PAYOUT' | 'DONE';

export interface HoldInfo {
  readonly kind: CaseKind;
  readonly reason: string;
  caseId: string | null;
}

/** Mutable per-payment progress, owned by the orchestrator. A durable store keeps it by payment id. */
export interface JourneyRecord {
  readonly order: JourneyOrder;
  step: Step;
  legs: { leg: LegKind; state: LegState }[];
  payInConfirmed: boolean;
  reserved: boolean;
  converted: boolean;
  arcSent: boolean;
  arcUnresolved: boolean;
  txHash: Hex32 | null;
  payoutStartedAtMs: bigint | null;
  refundDue: 'RESERVE' | 'PAYIN' | null;
  refunded: boolean;
  terminal: boolean;
  hold: HoldInfo | null;
  caseIds: string[];
  notified: Set<string>;
  outbox: HistoryEntryInput[];
  historyGapSinceMs: bigint | null;
  historyGapCaseOpened: boolean;
  retriedBy: PaymentId | null;
}

export type JourneyState = 'IN_PROGRESS' | 'WAITING' | 'HELD' | 'ARRIVED' | 'FAILED';

export interface JourneyOutcome {
  readonly paymentId: PaymentId;
  readonly state: JourneyState;
  readonly stage: Stage;
  readonly reason: string | null;
  readonly status: TransactionStatus;
  readonly waitingOn: LegKind | null;
  readonly hold: { readonly kind: CaseKind; readonly reason: string; readonly caseId: string | null } | null;
  readonly refunded: boolean;
  readonly arrived: boolean;
}

export class InMemoryJourneyStore implements JourneyStore {
  private readonly m = new Map<PaymentId, JourneyRecord>();
  get(id: PaymentId): JourneyRecord | null {
    return this.m.get(id) ?? null;
  }
  put(rec: JourneyRecord): void {
    this.m.set(rec.order.paymentId, rec);
  }
}

export type StartRefusal = 'KEY_CONFLICT' | 'UNKNOWN_PAYMENT';
export type ResumeRefusal =
  | 'UNKNOWN_PAYMENT' | 'NOT_HELD' | 'NO_DECISION_SOURCE' | 'CASE_NOT_FOUND' | 'CASE_UNAVAILABLE' | 'CASE_NOT_OURS'
  | 'CASE_NOT_CLOSED' | 'ACTION_NOT_SUPPORTED' | 'NO_JOURNAL' | 'NOT_REFUNDABLE';
export type RetryRefusal = 'NOT_FOUND' | 'NOT_TERMINAL_FAILED' | 'ALREADY_RETRIED' | 'UNRESOLVED_NOT_PROVEN' | 'SAME_PAYMENT' | 'CLIENT_MISMATCH' | 'FUNDS_NOT_RETURNED';

export function moneyMinor(m: JourneyMoney): bigint {
  return m.kind === 'FIAT' ? m.fiat.minor : m.minor;
}

function instant(ms: bigint): string {
  return new Date(Number(ms)).toISOString();
}
/** History document ids (src/history DOC_ID_RE); a reference that does not fit is left out, never rewritten. */
const DOC_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
function docs(...refs: (string | null)[]): { id: string }[] {
  return refs.filter((r): r is string => r !== null && DOC_ID_RE.test(r)).map((id) => ({ id }));
}
function lc(s: string): string {
  return s.toLowerCase().replace(/_/g, '-');
}

export class JourneyOrchestrator {
  private readonly notifier: Notifier;

  constructor(
    private readonly cfg: OrchestratorConfig,
    private readonly d: OrchestratorDeps,
  ) {
    this.notifier = safeNotifier(d.notifier);
  }

  /** Idempotent on the payment id: the same order replays, another quote under the same id is KEY_CONFLICT. */
  async start(order: JourneyOrder): Promise<JourneyOutcome | { readonly refused: StartRefusal }> {
    const existing = this.d.store.get(order.paymentId);
    if (existing !== null) {
      if (existing.order.quote.quoteId !== order.quote.quoteId || existing.order.clientUid !== order.clientUid) return { refused: 'KEY_CONFLICT' };
      return this.advance(order.paymentId);
    }
    const legs = journeyLegs(order.quote.payIn, order.quote.payout).map((leg) => ({ leg, state: { stage: 'CREATED', reason: null } as LegState }));
    const rec: JourneyRecord = {
      order, step: 'GATE', legs: [...legs], payInConfirmed: false, reserved: false, converted: false, arcSent: false, arcUnresolved: false,
      txHash: null, payoutStartedAtMs: null, refundDue: null, refunded: false, terminal: false, hold: null, caseIds: [], notified: new Set(),
      outbox: [], historyGapSinceMs: null, historyGapCaseOpened: false, retriedBy: null,
    };
    const first = legs[0];
    await this.record(rec, {
      kind: 'LEG', code: 'PAYMENT_CREATED', eventId: 'payment-created', stage: 'CREATED', status: STATUS_BY_STAGE.CREATED,
      ...(first === undefined ? {} : { leg: first.leg }),
    });
    this.d.store.put(rec);
    return this.advance(order.paymentId);
  }

  outcome(id: PaymentId): JourneyOutcome | { readonly refused: 'UNKNOWN_PAYMENT' } {
    const rec = this.d.store.get(id);
    return rec === null ? { refused: 'UNKNOWN_PAYMENT' } : this.outcomeOf(rec, null);
  }

  /** Drives the payment as far as it can go without outside input. Safe to call repeatedly (a webhook or a timer). */
  async advance(id: PaymentId): Promise<JourneyOutcome | { readonly refused: 'UNKNOWN_PAYMENT' }> {
    const rec = this.d.store.get(id);
    if (rec === null) return { refused: 'UNKNOWN_PAYMENT' };
    await this.flushHistory(rec);
    const waiting = await this.run(rec);
    await this.flushHistory(rec);
    this.d.store.put(rec);
    return this.outcomeOf(rec, waiting);
  }

  /** A retry is a NEW linked payment (D-2), allowed only for a terminal, refunded failure with no unresolved DFNS outcome. */
  async retryAsNewPayment(original: PaymentId, next: JourneyOrder): Promise<JourneyOutcome | { readonly refused: RetryRefusal | StartRefusal }> {
    const old = this.d.store.get(original);
    if (old === null) return { refused: 'NOT_FOUND' };
    if (next.paymentId === original) return { refused: 'SAME_PAYMENT' };
    if (next.clientUid !== old.order.clientUid) return { refused: 'CLIENT_MISMATCH' };
    if (old.retriedBy !== null && old.retriedBy !== next.paymentId) return { refused: 'ALREADY_RETRIED' };
    if (old.arcUnresolved) return { refused: 'UNRESOLVED_NOT_PROVEN' };
    if (!old.terminal || paymentState(old.legs.map((l) => l.state)).stage === 'COMPLETED') return { refused: 'NOT_TERMINAL_FAILED' };
    if (old.refundDue !== null && !old.refunded) return { refused: 'FUNDS_NOT_RETURNED' };
    // A fill was booked and nothing reached Arc: the converted funds sit with a case until a human unwinds them.
    if (old.converted && !old.refunded && this.legState(old, 'ARC_TRANSFER').stage !== 'COMPLETED') return { refused: 'FUNDS_NOT_RETURNED' };
    old.retriedBy = next.paymentId;
    this.d.store.put(old);
    const order: JourneyOrder = { ...next, retryOf: original };
    await this.record(old, { kind: 'RETRY', code: 'RETRY_LINKED', eventId: `retry-${lc(next.paymentId).slice(0, 50)}`, retryOfOverride: original, paymentOverride: next.paymentId });
    await this.flushHistory(old);
    return this.start(order);
  }

  /** Every operator action on a payment goes to the client history (D-4). */
  async recordOperatorAction(id: PaymentId, op: { readonly actor: string; readonly reasonCode: string; readonly caseRef?: string; readonly actionId: string }): Promise<boolean> {
    const rec = this.d.store.get(id);
    if (rec === null) return false;
    await this.record(rec, { kind: 'OPERATOR_ACTION', code: op.reasonCode, eventId: `op-${lc(op.actionId).slice(0, 56)}`, operator: { actor: op.actor, reasonCode: op.reasonCode, ...(op.caseRef === undefined ? {} : { caseRef: op.caseRef }) } });
    await this.flushHistory(rec);
    this.d.store.put(rec);
    return true;
  }

  /**
   * Resumes a held journey after its OPS case was decided (two-person, in OPS). The decision is read back from the
   * case store, never taken from the caller. Only REFUND is applied here: OPS already posted the refund journal
   * (P6 / P13), so the orchestrator posts nothing; it closes the open leg as CANCELLED_BY_OPERATOR and records the
   * refund with the journal reference. Refused (the journey stays held) when anything was converted, sent or is
   * unresolved on Arc (D-2: never a REFUND before the D-6 proofs). Other decisions are refused for now (fail closed).
   */
  async resumeAfterDecision(id: PaymentId): Promise<JourneyOutcome | { readonly refused: ResumeRefusal }> {
    const rec = this.d.store.get(id);
    if (rec === null) return { refused: 'UNKNOWN_PAYMENT' };
    if (rec.terminal && rec.refunded) return this.outcomeOf(rec, null);
    const hold = rec.hold;
    if (hold === null || rec.terminal) return { refused: 'NOT_HELD' };
    const source = this.d.decisions ?? null;
    if (source === null) return { refused: 'NO_DECISION_SOURCE' };
    if (hold.caseId === null) return { refused: 'CASE_NOT_FOUND' };
    const got = await source.getCase(hold.caseId);
    if (got.kind === 'AMBIGUOUS') return { refused: 'CASE_UNAVAILABLE' };
    if (got.kind === 'REJECTED') return { refused: 'CASE_NOT_FOUND' };
    const c = got.value;
    if (c.caseId !== hold.caseId || c.paymentId !== rec.order.paymentId || c.clientUid !== rec.order.clientUid || c.kind !== hold.kind) return { refused: 'CASE_NOT_OURS' };
    if (c.status !== 'CLOSED' || c.outcome === null) return { refused: 'CASE_NOT_CLOSED' };
    const o = c.outcome;
    if (o.action !== 'REFUND') return { refused: 'ACTION_NOT_SUPPORTED' };
    if (o.journalRef === null) return { refused: 'NO_JOURNAL' };
    if (rec.arcUnresolved || rec.arcSent || rec.converted) return { refused: 'NOT_REFUNDABLE' };
    const open = rec.legs.find((l) => l.state.stage === 'CREATED');
    if (open === undefined) return { refused: 'NOT_REFUNDABLE' };
    await this.record(rec, {
      kind: 'OPERATOR_ACTION', code: 'REFUND', eventId: `op-${lc(o.decisionId)}`.slice(0, 64), leg: open.leg,
      operator: { actor: `decision:${o.decisionId}`.slice(0, 128), reasonCode: 'REFUND', caseRef: c.caseId },
    });
    if (!(await this.move(rec, open.leg, { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }, 'OPERATOR_DECISION', 'NONE'))) {
      await this.flushHistory(rec);
      this.d.store.put(rec);
      return { refused: 'NOT_REFUNDABLE' };
    }
    rec.terminal = true;
    rec.hold = null;
    rec.refundDue = this.refundKind(rec) ?? (rec.order.quote.payIn.method === 'FIAT' ? 'PAYIN' : 'RESERVE');
    rec.refunded = true;
    await this.recordRefunded(rec, o.journalRef);
    await this.flushHistory(rec);
    this.d.store.put(rec);
    return this.outcomeOf(rec, null);
  }

  // ---------------------------------------------------------------- core

  private async run(rec: JourneyRecord): Promise<LegKind | null> {
    if (rec.terminal) {
      await this.settleRefund(rec);
      return null;
    }
    if (rec.hold !== null) {
      if (rec.hold.caseId === null) await this.ensureCase(rec, rec.hold.kind, rec.hold.reason);
      return null;
    }
    if (rec.arcUnresolved) return null;
    const now = this.d.clock.nowMs();
    for (;;) {
      switch (rec.step) {
        case 'GATE':
          if (!(await this.gate(rec, now))) return null;
          rec.step = this.hasLeg(rec, 'AWAIT_DEPOSIT') || rec.order.quote.payIn.method === 'FIAT' ? 'PAYIN' : 'RESERVE';
          break;
        case 'PAYIN': {
          const r = await this.payInStep(rec, now);
          if (r !== 'NEXT') return r === 'WAIT' ? this.payInLeg(rec) : null;
          rec.step = 'RESERVE';
          break;
        }
        case 'RESERVE': {
          const r = await this.reserveStep(rec, now);
          if (r !== 'NEXT') return r === 'WAIT' ? 'RESERVE' : null;
          rec.step = rec.order.quote.convertIn === null ? 'ARC' : 'CONVERT';
          break;
        }
        case 'CONVERT': {
          const r = await this.convertStep(rec, now);
          if (r !== 'NEXT') return r === 'WAIT' ? 'CONVERT_IN' : null;
          rec.step = 'ARC';
          break;
        }
        case 'ARC': {
          const r = await this.arcStep(rec);
          if (r !== 'NEXT') return r === 'WAIT' ? 'ARC_TRANSFER' : null;
          rec.step = this.hasLeg(rec, 'PAYOUT') ? 'PAYOUT' : 'DONE';
          break;
        }
        case 'PAYOUT': {
          const r = await this.payoutStep(rec, now);
          if (r !== 'NEXT') return r === 'WAIT' ? 'PAYOUT' : null;
          rec.step = 'DONE';
          break;
        }
        case 'DONE':
          rec.terminal = true;
          await this.notify(rec, 'ARRIVED');
          return null;
      }
    }
  }

  private async gate(rec: JourneyRecord, now: bigint): Promise<boolean> {
    const q = rec.order.quote;
    const first = rec.legs[0]?.leg;
    if (first === undefined || !legsMatchJourney(q.payIn, q.payout, q.legs)) {
      await this.quarantine(rec, 'INVARIANT_FAILED', 'quote legs do not match the journey');
      return false;
    }
    if (!journeyEnabled(q.payIn, q.payout, this.cfg.flags) || (q.crossBorder && !this.cfg.crossBorderEnabled)) {
      return this.fail(rec, first, 'METHOD_NOT_ENABLED', 'INTERNAL', 'NONE').then(() => false);
    }
    if (now >= q.expiresAtMs) {
      return this.fail(rec, first, 'QUOTE_EXPIRED', 'INTERNAL', 'NONE').then(() => false);
    }
    return true;
  }

  private payInLeg(rec: JourneyRecord): LegKind {
    return this.hasLeg(rec, 'AWAIT_DEPOSIT') ? 'AWAIT_DEPOSIT' : 'RESERVE';
  }

  private async payInStep(rec: JourneyRecord, now: bigint): Promise<'NEXT' | 'WAIT' | 'STOP'> {
    const port = this.d.payIn;
    const leg = this.payInLeg(rec);
    if (port === null) {
      await this.quarantine(rec, 'INVARIANT_FAILED', 'no pay-in port wired');
      return 'STOP';
    }
    const r = await port.settle(rec.order, now);
    switch (r.kind) {
      case 'PENDING':
        return 'WAIT';
      case 'EXPIRED':
        await this.fail(rec, leg, 'QUOTE_EXPIRED', 'INTERNAL', 'NONE');
        return 'STOP';
      case 'HELD':
        await this.holdCase(rec, r.caseKind ?? this.heldKind(r.reason), r.reason, r.caseId);
        return 'STOP';
      case 'FAILED_CLOSED':
        await this.quarantine(rec, 'INVARIANT_FAILED', `pay-in failed closed: ${r.detail}`);
        return 'STOP';
      case 'CONFIRMED': {
        if (r.amount !== moneyMinor(rec.order.quote.payer)) {
          await this.quarantine(rec, 'BOOKED_ENTRY_MISMATCH', 'confirmed pay-in differs from the quote');
          return 'STOP';
        }
        rec.payInConfirmed = true;
        await this.record(rec, { kind: 'LEG', code: 'PAYIN_CONFIRMED', eventId: 'payin-confirmed', leg, documents: docs(r.evidenceRef) });
        if (leg === 'AWAIT_DEPOSIT' && !(await this.move(rec, 'AWAIT_DEPOSIT', { stage: 'COMPLETED', reason: null }, 'ARC_LOG', 'NONE'))) return 'STOP';
        await this.notify(rec, 'PAYIN_RECEIVED');
        return 'NEXT';
      }
    }
  }

  private heldKind(reason: string): CaseKind {
    if (reason === 'CONFIRMED_BELOW_EXPECTED') return 'UNDERPAYMENT';
    if (reason === 'CONFIRMED_ABOVE_EXPECTED') return 'OVERPAYMENT';
    if (reason === 'PAYIN_AFTER_QUOTE_EXPIRY') return 'LATE_PAYIN';
    // D-3: no valid consent is a QUARANTINE of the item (as JPAYIN opens it); CONSENT_MISSING-kind reasons differ.
    if (reason === 'CONSENT_MISSING') return 'QUARANTINE';
    return 'QUARANTINE';
  }

  private async reserveStep(rec: JourneyRecord, now: bigint): Promise<'NEXT' | 'WAIT' | 'STOP'> {
    const q = rec.order.quote;
    // A balance reservation after the quote has expired is refused; a confirmed pay-in was already handled by JPAYIN.
    if (!rec.payInConfirmed && now >= q.expiresAtMs) {
      await this.fail(rec, 'RESERVE', 'QUOTE_EXPIRED', 'INTERNAL', 'NONE');
      return 'STOP';
    }
    // A fiat journey whose pricing code is already stale reserves nothing (no money moves on a stale code, D-1).
    // The client's pay-in is in: a requote needs the client's consent, so it is a REQUOTE case (D-2), never automatic.
    if (q.convertIn !== null && this.codeExpired(rec, now)) {
      await this.holdCase(rec, 'REQUOTE', 'RATE_EXPIRED', null);
      return 'STOP';
    }
    const r = await this.d.funds.reserve(rec.order);
    if (r === 'UNAVAILABLE') return 'WAIT';
    if (r === 'INSUFFICIENT_FUNDS') {
      if (rec.payInConfirmed) rec.refundDue = q.payIn.method === 'FIAT' ? 'PAYIN' : 'RESERVE';
      await this.fail(rec, 'RESERVE', 'INSUFFICIENT_FUNDS', 'LEDGER', 'NONE');
      return 'STOP';
    }
    rec.reserved = true;
    if (!(await this.move(rec, 'RESERVE', { stage: 'COMPLETED', reason: null }, 'LEDGER', 'NONE'))) return 'STOP';
    await this.notify(rec, 'FUNDS_RESERVED');
    return 'NEXT';
  }

  private async convertStep(rec: JourneyRecord, now: bigint): Promise<'NEXT' | 'WAIT' | 'STOP'> {
    const line = rec.order.quote.convertIn;
    const port = this.d.conversion;
    if (line === null || port === null) {
      await this.quarantine(rec, 'INVARIANT_FAILED', 'conversion leg without a conversion port');
      return 'STOP';
    }
    // Never execute on an expired code. The money is in and reserved: a requote (with consent) or a refund is a
    // two-person decision on a REQUOTE case (D-1, D-2), never an automatic refund.
    if (this.codeExpired(rec, now)) {
      await this.holdCase(rec, 'REQUOTE', 'RATE_EXPIRED', null);
      return 'STOP';
    }
    const r = await port.convert(rec.order, now);
    switch (r.kind) {
      // No SUBMITTED move here: a conversion that later expires must still be failable (QUOTE_EXPIRED is licensed from CREATED only).
      case 'PENDING':
      case 'UNAVAILABLE':
        return 'WAIT';
      // Same mapping as the fill desk's `fillCaseFor` (src/journey/quote/fill.ts).
      case 'EXPIRED':
        await this.holdCase(rec, 'REQUOTE', 'RATE_EXPIRED', r.caseId ?? null);
        return 'STOP';
      case 'REJECTED':
        await this.holdCase(rec, 'REQUOTE', 'RATE_CHANGED', r.caseId ?? null);
        return 'STOP';
      case 'REQUOTE':
        await this.holdCase(rec, 'REQUOTE', r.cause, r.caseId ?? null);
        return 'STOP';
      case 'UNMATCHED_FILL':
        await this.holdCase(rec, 'UNMATCHED_FILL', r.reason, r.caseId ?? null);
        return 'STOP';
      case 'FILL_TIMEOUT':
        await this.holdCase(rec, 'FILL_TIMEOUT', 'NO_FILL_BY_TIMEOUT', r.caseId ?? null);
        return 'STOP';
      case 'FILLED':
        if (r.toAmount !== line.to) {
          await this.holdCase(rec, 'REQUOTE', 'RATE_CHANGED', null);
          return 'STOP';
        }
        rec.converted = true;
        if (!(await this.move(rec, 'CONVERT_IN', { stage: 'COMPLETED', reason: null }, 'CONVERSION', 'NONE'))) return 'STOP';
        await this.notify(rec, 'CONVERTED');
        return 'NEXT';
    }
  }

  private async arcStep(rec: JourneyRecord): Promise<'NEXT' | 'WAIT' | 'STOP'> {
    const r = await this.d.arc.send(rec.order);
    switch (r.kind) {
      case 'PENDING':
        rec.arcSent = true;
        if (!(await this.move(rec, 'ARC_TRANSFER', { stage: 'SUBMITTED', reason: null }, 'DFNS_POLL', 'KNOWN'))) return 'STOP';
        await this.notify(rec, 'SENT');
        return 'WAIT';
      case 'REFUSED':
        await this.failWithRefund(rec, 'ARC_TRANSFER', r.reason, 'INTERNAL');
        return 'STOP';
      case 'UNRESOLVED':
        // Never a blind retry: the outcome is unknown, so a case decides (D-2).
        rec.arcUnresolved = true;
        await this.holdCase(rec, 'UNRESOLVED_SUBMIT', r.reason, null);
        return 'STOP';
      case 'REVERTED':
        rec.arcSent = true;
        rec.txHash = r.txHash;
        if (!(await this.ensureSubmitted(rec))) return 'STOP';
        if (!(await this.fail(rec, 'ARC_TRANSFER', 'ONCHAIN_REVERTED', 'ARC_LOG', 'KNOWN'))) return 'STOP';
        // A booked fill is unwound by a human (P12), never by an automatic fiat refund (that would count the money twice).
        if (rec.converted) {
          await this.ensureCase(rec, 'QUARANTINE', 'INVARIANT_FAILED');
          return 'STOP';
        }
        // The chain moved nothing: the reservation is released, never reversed on-chain.
        rec.refundDue = this.refundKind(rec);
        await this.settleRefund(rec);
        return 'STOP';
      case 'CONFIRMED': {
        rec.arcSent = true;
        rec.txHash = r.txHash;
        if (!(await this.ensureSubmitted(rec))) return 'STOP';
        if (!(await this.move(rec, 'ARC_TRANSFER', { stage: 'COMPLETED', reason: null }, 'ARC_LOG', 'KNOWN'))) return 'STOP';
        await this.notify(rec, 'SENT');
        await this.notify(rec, 'SETTLED_ON_ARC');
        const s = await this.d.funds.settle(rec.order, r.txHash);
        if (s !== 'OK') {
          await this.quarantine(rec, 'INVARIANT_FAILED', 'settlement posting failed after arrival');
          return 'STOP';
        }
        return 'NEXT';
      }
    }
  }

  private async ensureSubmitted(rec: JourneyRecord): Promise<boolean> {
    const cur = this.legState(rec, 'ARC_TRANSFER');
    if (cur.stage !== 'CREATED') return true;
    return this.move(rec, 'ARC_TRANSFER', { stage: 'SUBMITTED', reason: null }, 'DFNS_POLL', 'KNOWN');
  }

  private async payoutStep(rec: JourneyRecord, now: bigint): Promise<'NEXT' | 'WAIT' | 'STOP'> {
    const port = this.d.payout;
    if (port === null) {
      await this.quarantine(rec, 'INVARIANT_FAILED', 'no payout port wired');
      return 'STOP';
    }
    const r = await port.advance(rec.order, now);
    if (this.legState(rec, 'PAYOUT').stage === 'CREATED' && r.kind !== 'FAILED') {
      if (!(await this.move(rec, 'PAYOUT', { stage: 'SUBMITTED', reason: null }, 'PAYOUT_CALLBACK', 'NONE'))) return 'STOP';
      rec.payoutStartedAtMs = now;
      await this.notify(rec, 'PAYOUT_STARTED');
    }
    switch (r.kind) {
      case 'PENDING':
        if (rec.payoutStartedAtMs !== null && now - rec.payoutStartedAtMs >= this.cfg.payoutStuckAfterMs) {
          await this.holdCase(rec, 'STUCK_PAYOUT', 'PARTNER_TIMEOUT', null);
          return 'STOP';
        }
        return 'WAIT';
      case 'PAID':
        if (!(await this.move(rec, 'PAYOUT', { stage: 'COMPLETED', reason: null }, 'PAYOUT_CALLBACK', 'NONE'))) return 'STOP';
        return 'NEXT';
      case 'FAILED':
      case 'RETURNED':
        // The USDC already sits with the partner: a human decides (retry, refund, write-off). No automatic refund.
        if (this.legState(rec, 'PAYOUT').stage === 'CREATED') await this.move(rec, 'PAYOUT', { stage: 'SUBMITTED', reason: null }, 'PAYOUT_CALLBACK', 'NONE');
        await this.fail(rec, 'PAYOUT', 'PAYOUT_FAILED', 'PAYOUT_CALLBACK', 'NONE');
        await this.ensureCase(rec, 'RETURNED_PAYOUT', r.reason);
        return 'STOP';
    }
  }

  // ------------------------------------------------------ failure paths

  private refundKind(rec: JourneyRecord): 'RESERVE' | 'PAYIN' | null {
    if (!rec.payInConfirmed && !rec.reserved) return null;
    return rec.order.quote.payIn.method === 'FIAT' ? 'PAYIN' : 'RESERVE';
  }

  /** Failure after funds are in. Before conversion: automatic refund. After a fill: a case (a fill is unwound by a human). */
  private async failWithRefund(rec: JourneyRecord, leg: LegKind, reason: RejectedReason | 'QUOTE_EXPIRED', source: SignalSource): Promise<void> {
    if (!(await this.fail(rec, leg, reason, source, 'NONE'))) return;
    if (rec.converted) {
      await this.ensureCase(rec, 'QUARANTINE', 'INVARIANT_FAILED');
      return;
    }
    rec.refundDue = this.refundKind(rec);
    await this.settleRefund(rec);
  }

  private async settleRefund(rec: JourneyRecord): Promise<void> {
    if (rec.refundDue === null || rec.refunded) return;
    const r = await this.d.funds.refund(rec.order, rec.refundDue);
    if (r === 'OK') {
      rec.refunded = true;
      await this.recordRefunded(rec, null);
    } else if (r === 'INSUFFICIENT_FUNDS') {
      await this.ensureCase(rec, 'QUARANTINE', 'INVARIANT_FAILED');
    }
    // UNAVAILABLE: refundDue stays set; the next advance retries (idempotent per payment).
  }

  /** FUNDS_REFUNDED carries the failed leg's terminal stage, status and reason (D-4: every leg with its status). */
  private async recordRefunded(rec: JourneyRecord, journalRef: string | null): Promise<void> {
    const failed = rec.legs.find((l) => l.state.reason !== null) ?? { leg: this.firstLeg(rec), state: paymentState(rec.legs.map((l) => l.state)) };
    await this.record(rec, {
      kind: 'LEG', code: 'FUNDS_REFUNDED', eventId: 'funds-refunded', leg: failed.leg, stage: failed.state.stage, status: STATUS_BY_STAGE[failed.state.stage],
      ...(failed.state.reason === null ? {} : { reason: failed.state.reason }), documents: docs(journalRef),
    });
  }

  private codeExpired(rec: JourneyRecord, now: bigint): boolean {
    const line = rec.order.quote.convertIn;
    return now >= rec.order.quote.expiresAtMs || (line !== null && now >= line.expiresAtMs);
  }

  private async fail(rec: JourneyRecord, leg: LegKind, reason: RejectedReason | 'QUOTE_EXPIRED' | 'PAYOUT_FAILED' | 'INSUFFICIENT_FUNDS' | 'METHOD_NOT_ENABLED' | 'ONCHAIN_REVERTED', source: SignalSource, request: DfnsRequest): Promise<boolean> {
    const target: LegState = reason === 'QUOTE_EXPIRED' ? { stage: 'EXPIRED', reason } : { stage: 'REJECTED', reason: reason as RejectedReason };
    const ok = await this.move(rec, leg, target, source, request);
    if (ok) rec.terminal = true;
    return ok;
  }

  private async holdCase(rec: JourneyRecord, kind: CaseKind, reason: string, existingCaseId: string | null): Promise<void> {
    rec.hold = { kind, reason, caseId: existingCaseId };
    if (existingCaseId !== null) rec.caseIds.push(existingCaseId);
    else await this.ensureCase(rec, kind, reason);
    await this.record(rec, { kind: 'LEG', code: `HELD_${reason.replace(/[^A-Z0-9_]/g, '_')}`.slice(0, 64), eventId: `held-${lc(kind)}-${lc(reason)}`.slice(0, 64), leg: this.currentLeg(rec) });
  }

  private async quarantine(rec: JourneyRecord, reason: string, detail: string): Promise<void> {
    await this.holdCase(rec, 'QUARANTINE', reason, null);
    void detail;
  }

  private async ensureCase(rec: JourneyRecord, kind: CaseKind, reason: string): Promise<void> {
    const r = await this.d.cases.open({
      kind, reason, subject: `${rec.order.paymentId}:${lc(kind)}`, paymentId: rec.order.paymentId, clientUid: rec.order.clientUid,
      evidenceRefs: [`payment:${rec.order.paymentId}`],
    });
    if (r.caseId !== null && !rec.caseIds.includes(r.caseId)) rec.caseIds.push(r.caseId);
    if (rec.hold !== null && rec.hold.kind === kind) rec.hold.caseId = r.caseId;
  }

  // ------------------------------------------------------ leg moves

  private hasLeg(rec: JourneyRecord, leg: LegKind): boolean {
    return rec.legs.some((l) => l.leg === leg);
  }
  private firstLeg(rec: JourneyRecord): LegKind {
    return (rec.legs[0] as { leg: LegKind }).leg;
  }
  private legState(rec: JourneyRecord, leg: LegKind): LegState {
    return (rec.legs.find((l) => l.leg === leg) as { state: LegState }).state;
  }
  private currentLeg(rec: JourneyRecord): LegKind {
    return (rec.legs.find((l) => l.state.stage !== 'COMPLETED') ?? (rec.legs[rec.legs.length - 1] as { leg: LegKind })).leg;
  }

  /** The one place a leg changes state: `decideTransition` licenses it, history records it. */
  private async move(rec: JourneyRecord, leg: LegKind, target: LegState, source: SignalSource, request: DfnsRequest): Promise<boolean> {
    const entry = rec.legs.find((l) => l.leg === leg);
    if (entry === undefined) {
      await this.quarantine(rec, 'INVARIANT_FAILED', `no ${leg} leg`);
      return false;
    }
    const verdict = decideTransition(leg, entry.state, target, source, request);
    if (verdict === 'DUPLICATE' || verdict === 'STALE') return true;
    if (verdict === 'ILLEGAL') {
      await this.quarantine(rec, 'INVARIANT_FAILED', `illegal ${leg} move to ${target.stage}`);
      return false;
    }
    entry.state = target;
    const failed = target.reason !== null;
    await this.record(rec, {
      kind: failed ? 'FAILURE' : 'LEG', code: failed ? `FAILED_${target.reason}` : `LEG_${target.stage}`,
      eventId: `${lc(leg)}-${lc(target.stage)}${failed ? `-${lc(target.reason)}` : ''}`.slice(0, 64), leg, stage: target.stage,
      status: failed ? 'FAILED' : STATUS_BY_STAGE[target.stage], ...(failed ? { reason: target.reason } : {}),
    });
    return true;
  }

  // ------------------------------------------------------ history

  private async record(
    rec: JourneyRecord,
    e: {
      kind: HistoryEntryInput['kind']; code: string; eventId: string; leg?: LegKind; stage?: Stage; status?: TransactionStatus; reason?: string;
      retryOfOverride?: PaymentId; paymentOverride?: PaymentId; operator?: { actor: string; reasonCode: string; caseRef?: string }; documents?: { id: string }[];
    },
  ): Promise<void> {
    const input: HistoryEntryInput = {
      clientUid: rec.order.clientUid, paymentId: e.paymentOverride ?? rec.order.paymentId, eventId: e.eventId, kind: e.kind, code: e.code,
      occurredAt: instant(this.d.clock.nowMs()),
      ...(e.stage === undefined ? {} : { stage: e.stage }), ...(e.status === undefined ? {} : { status: e.status }),
      ...(e.reason === undefined ? {} : { reason: e.reason }), ...(e.leg === undefined ? {} : { leg: e.leg }),
      ...(e.retryOfOverride === undefined ? {} : { retryOf: e.retryOfOverride }), ...(e.operator === undefined ? {} : { operator: e.operator }),
      ...(rec.txHash !== null && e.leg === 'ARC_TRANSFER' ? { txHash: rec.txHash } : {}),
      ...(e.documents === undefined || e.documents.length === 0 ? {} : { documents: e.documents }),
    };
    rec.outbox.push(input);
  }

  /** Appends queued entries in order; stops at the first failure. A gap older than the limit opens a case (money is never blocked by it). */
  private async flushHistory(rec: JourneyRecord): Promise<void> {
    while (rec.outbox.length > 0) {
      const next = rec.outbox[0] as HistoryEntryInput;
      const r = await this.d.history.append(next);
      if (r.kind !== 'OK') {
        if (r.kind === 'REJECTED' && r.code !== 'KEY_CONFLICT') {
          // A malformed entry will never succeed: drop it from the queue and open a case so a human closes the gap.
          rec.outbox.shift();
          rec.historyGapSinceMs ??= this.d.clock.nowMs();
          await this.openGapCase(rec);
          continue;
        }
        rec.historyGapSinceMs ??= this.d.clock.nowMs();
        if (this.d.clock.nowMs() - rec.historyGapSinceMs >= this.cfg.historyGapMaxAgeMs) await this.openGapCase(rec);
        return;
      }
      rec.outbox.shift();
    }
    rec.historyGapSinceMs = null;
  }

  private async openGapCase(rec: JourneyRecord): Promise<void> {
    if (rec.historyGapCaseOpened) return;
    const r = await this.d.cases.open({
      kind: 'HISTORY_WRITE_FAILED', reason: 'HISTORY_APPEND_FAILING_PAST_AGE', subject: `${rec.order.paymentId}:history`,
      paymentId: rec.order.paymentId, clientUid: rec.order.clientUid, evidenceRefs: [`payment:${rec.order.paymentId}`],
    });
    if (r.caseId !== null) {
      rec.historyGapCaseOpened = true;
      rec.caseIds.push(r.caseId);
    }
  }

  // ------------------------------------------------------ notifications

  private async notify(rec: JourneyRecord, step: string): Promise<void> {
    if (rec.notified.has(step)) return;
    if (step === 'ARRIVED' && !this.arrived(rec)) return;
    const r = await this.notifier.send({
      key: `ntf:${rec.order.paymentId}:${step}`, recipientRef: rec.order.clientUid, paymentId: rec.order.paymentId, step,
      amount: step === 'ARRIVED' ? moneyMinor(rec.order.quote.recipient).toString(10) : null,
    });
    rec.notified.add(step);
    if (r.kind === 'FAILED') await this.record(rec, { kind: 'LEG', code: 'NOTIFICATION_FAILED', eventId: `notify-failed-${lc(step)}`, leg: this.currentLeg(rec) });
  }

  private arrived(rec: JourneyRecord): boolean {
    return rec.legs.every((l) => l.state.stage === 'COMPLETED');
  }

  private outcomeOf(rec: JourneyRecord, waitingOn: LegKind | null): JourneyOutcome {
    const st = paymentState(rec.legs.map((l) => l.state));
    const status = toTransactionStatus(st, null);
    const arrived = this.arrived(rec) && rec.terminal;
    const failed = st.reason !== null;
    const state: JourneyState = arrived ? 'ARRIVED' : failed ? 'FAILED' : rec.hold !== null || rec.arcUnresolved ? 'HELD' : waitingOn !== null ? 'WAITING' : 'IN_PROGRESS';
    return {
      paymentId: rec.order.paymentId, state, stage: st.stage, reason: st.reason, status, waitingOn: rec.hold === null ? waitingOn : null,
      hold: rec.hold === null ? null : { kind: rec.hold.kind, reason: rec.hold.reason, caseId: rec.hold.caseId }, refunded: rec.refunded, arrived,
    };
  }
}
