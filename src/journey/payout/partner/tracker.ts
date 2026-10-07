/**
 * JPARTNER tracker: the one decision core behind every PayoutPartner adapter.
 *
 * It takes callbacks that an adapter already authenticated and decides:
 * duplicate (same payout and state: replayed, no effect), stale (older than
 * what we know: ignored), conflicting (PAID and FAILED for one payout: the payout is
 * quarantined, ARRIVED is withdrawn, and Ops is told), out of order (a state
 * whose predecessor we have not seen: refused so the partner redelivers, and NOT recorded as seen), or
 * applied. Failed and returned payouts are reported for refund or claim.
 *
 * `arrived(payoutId)` is true only after an applied PAID. Nothing else
 * licenses ARRIVED for a FIAT_BANK payout.
 */
import { ok, rejected } from '../../../nova-ports/ids.js';
import type { PortResult } from '../../../nova-ports/ids.js';
import type { PartnerCallback, PartnerPayoutState } from './port.js';

/** What Nova must do about a payout the partner did not deliver. */
export type PayoutReportKind =
  | 'REFUND_DUE' //        FAILED: funds were not delivered; claim the USDC back from the partner
  | 'REFUND_RECEIVED' //   RETURNED after FAILED: the refund came back; Nova may release only with the matching INBOUND log on the open F-17 case (design section nine, P2R and P6), never on the partner's word alone
  | 'REFUND_FAILED' //     the partner failed to return the money: Ops must chase it
  | 'CLAIM' //             RETURNED after PAID: delivered, then returned; open a claim with Ops
  | 'RFI_OPEN' //          the partner needs information from us before the payment can proceed: Ops must answer
  | 'CONFLICT'; //         PAID and FAILED for one payout: Ops must decide

export interface PayoutReport {
  readonly payoutId: string;
  readonly kind: PayoutReportKind;
  readonly reason: string | null;
}

export type CallbackApplyRejectCode = 'UNKNOWN_PAYOUT' | 'OUT_OF_ORDER' | 'CONFLICT';

export interface CallbackOutcome {
  readonly payoutId: string;
  readonly state: PartnerPayoutState;
  /** False for a duplicate or a stale callback. */
  readonly applied: boolean;
  readonly report: PayoutReport | null;
}

const RANK: Readonly<Record<PartnerPayoutState, bigint>> = { PENDING: 0n, PAID: 1n, FAILED: 1n, RETURNED: 2n, REFUND_FAILED: 2n };
/** Tuple-encoded (ids may contain ':'), so two different tuples can never join to one key (MC-10). */
function dedupeKey(payoutId: string, state: PartnerPayoutState): string {
  return JSON.stringify(['payout', payoutId, state]);
}
const REASON_RE = /^[A-Za-z0-9_.-]{1,64}$/;

/** A partner reason is kept only if it is a short machine token, so free text (possibly personal data) never travels on. */
export function safeReason(reason: string | null): string | null {
  return reason !== null && REASON_RE.test(reason) ? reason : null;
}

export class PayoutTracker {
  readonly #state = new Map<string, PartnerPayoutState>();
  readonly #seen = new Set<string>();
  readonly #seenEvents = new Set<string>();
  readonly #quarantined = new Set<string>();
  #reports: readonly PayoutReport[] = [];

  /** A payout the adapter created. Registering twice is a programming error. */
  register(payoutId: string): void {
    if (this.#state.has(payoutId)) throw new Error('payout already registered');
    this.#state.set(payoutId, 'PENDING');
  }

  state(payoutId: string): PartnerPayoutState | null {
    return this.#state.get(payoutId) ?? null;
  }

  /** True only after an applied, authentic PAID, and never for a quarantined (conflicting) payout. */
  arrived(payoutId: string): boolean {
    return this.#state.get(payoutId) === 'PAID' && !this.#quarantined.has(payoutId);
  }

  /** Reports raised so far, oldest first (a copy). */
  reports(): readonly PayoutReport[] {
    return [...this.#reports];
  }

  /** The callback MUST already be authentic (`PayoutPartner.verifyCallback`). */
  apply(cb: PartnerCallback): PortResult<CallbackOutcome, CallbackApplyRejectCode> {
    const current = this.#state.get(cb.payoutId);
    if (current === undefined) return rejected('UNKNOWN_PAYOUT', 'no such payout');
    if (this.#quarantined.has(cb.payoutId)) return rejected('CONFLICT', 'payout is quarantined for Ops');
    const key = dedupeKey(cb.payoutId, cb.state);
    const eventKey = JSON.stringify([cb.payoutId, cb.eventId]);
    if (cb.notice === 'RFI') {
      if (this.#seenEvents.has(eventKey)) return ok({ payoutId: cb.payoutId, state: current, applied: false, report: null }, true);
      this.#seenEvents.add(eventKey);
      const rfi: PayoutReport = { payoutId: cb.payoutId, kind: 'RFI_OPEN', reason: safeReason(cb.reason) };
      this.#reports = [...this.#reports, rfi];
      return ok({ payoutId: cb.payoutId, state: current, applied: true, report: rfi }, false);
    }
    // The partner's own notification id: a redelivery is a no-op whatever the body says.
    if (this.#seenEvents.has(eventKey) || this.#seen.has(key)) return ok({ payoutId: cb.payoutId, state: current, applied: false, report: null }, true);

    const from = RANK[current];
    const to = RANK[cb.state];
    if (cb.state === current || to === 0n) {
      // A repeat of the current state, or a late PENDING: stale.
      this.#seen.add(key);
      this.#seenEvents.add(eventKey);
      return ok({ payoutId: cb.payoutId, state: current, applied: false, report: null }, false);
    }
    if (to <= from) {
      // PAID versus FAILED (also after RETURNED, whose callback then ranks below), or RETURNED versus REFUND_FAILED: never pick one silently.
      this.#quarantined.add(cb.payoutId);
      this.#reports = [...this.#reports, { payoutId: cb.payoutId, kind: 'CONFLICT', reason: safeReason(cb.reason) }];
      return rejected('CONFLICT', 'partner reported a conflicting final state');
    }
    if (to === 2n && current === 'PENDING') return rejected('OUT_OF_ORDER', 'refund outcome before a final state');

    this.#seen.add(key);
    this.#seenEvents.add(eventKey);
    this.#state.set(cb.payoutId, cb.state);
    const report = reportFor(cb, current);
    if (report !== null) this.#reports = [...this.#reports, report];
    return ok({ payoutId: cb.payoutId, state: cb.state, applied: true, report }, false);
  }
}

function reportFor(cb: PartnerCallback, from: PartnerPayoutState): PayoutReport | null {
  const reason = safeReason(cb.reason);
  if (cb.state === 'FAILED') return { payoutId: cb.payoutId, kind: 'REFUND_DUE', reason };
  if (cb.state === 'REFUND_FAILED') return { payoutId: cb.payoutId, kind: 'REFUND_FAILED', reason };
  if (cb.state === 'RETURNED') return { payoutId: cb.payoutId, kind: from === 'PAID' ? 'CLAIM' : 'REFUND_RECEIVED', reason };
  return null;
}
