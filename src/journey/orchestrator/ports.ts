/**
 * JORCH ports: the narrow seams the journey orchestrator drives. Each is a
 * local type so the units that implement them (D1 Arc payments, JPAYIN,
 * JPAYOUT, the fill desk) can be wired later by a thin adapter; nothing here
 * imports their internals. Every result is a closed union: an unknown outcome
 * is a case, never a blind retry (design delta 1 D-2, D-4).
 * Money is bigint minor units only. Account, amount, destination and route are
 * read server-side from the payment record by the adapter, never passed from
 * a client.
 */
import type { JourneyQuote } from '../quote/compose.js';
import type { CaseKind, CaseRecord } from '../../ops/types.js';
import type { Hex32, NovaOwnerRef, PaymentId, PortResult } from '../../nova-ports/ids.js';

/** One payment of one journey. `retryOf` links a retry (a new payment) to the one it replaces. */
export interface JourneyOrder {
  readonly paymentId: PaymentId;
  readonly clientUid: NovaOwnerRef;
  readonly quote: JourneyQuote;
  readonly retryOf: PaymentId | null;
}

/** Same closed shape as JPAYIN `PayInResult` (structurally), plus the amount the orchestrator re-checks. */
export type OrchPayInResult =
  | { readonly kind: 'PENDING' }
  | { readonly kind: 'CONFIRMED'; readonly amount: bigint; readonly evidenceRef: string }
  | { readonly kind: 'EXPIRED' }
  /** `caseKind` is the kind JPAYIN already opened (when known); the orchestrator then never re-derives it. */
  | { readonly kind: 'HELD'; readonly reason: string; readonly caseId: string | null; readonly caseKind?: CaseKind }
  | { readonly kind: 'FAILED_CLOSED'; readonly detail: string };

/** FIAT and STABLECOIN_DEPOSIT pay-ins (JPAYIN). A STABLECOIN_BALANCE journey has none: the balance is reserved. */
export interface PayInPort {
  settle(order: JourneyOrder, nowMs: bigint): Promise<OrchPayInResult>;
}

/** Ledger side of a payment: P1 reserve, P2/P3 settle, P6 / pay-in refund. Idempotent per payment id. */
export type FundsResult = 'OK' | 'INSUFFICIENT_FUNDS' | 'UNAVAILABLE';
export interface FundsPort {
  reserve(order: JourneyOrder): Promise<FundsResult>;
  settle(order: JourneyOrder, txHash: Hex32): Promise<FundsResult>;
  /** 'RESERVE' releases a reservation (P6); 'PAYIN' refunds a confirmed fiat pay-in (P13). */
  refund(order: JourneyOrder, kind: 'RESERVE' | 'PAYIN'): Promise<FundsResult>;
}

/** Fiat to USDC through the fill desk (D-1). Never converts on an expired code. */
export type ConvertResult =
  | { readonly kind: 'PENDING' }
  | { readonly kind: 'FILLED'; readonly toAmount: bigint; readonly bookedEntryRef: string }
  /** The hold results may carry the case the fill desk already opened (`caseId`), so no second case is opened. */
  | { readonly kind: 'REJECTED'; readonly caseId?: string | null }
  | { readonly kind: 'EXPIRED'; readonly caseId?: string | null }
  | { readonly kind: 'REQUOTE'; readonly cause: 'RATE_EXPIRED' | 'RATE_CHANGED'; readonly detail: string; readonly caseId?: string | null }
  | { readonly kind: 'UNMATCHED_FILL'; readonly reason: 'FILL_AFTER_EXPIRY' | 'FILL_MISPOSTED' | 'FILL_TERMS_MISMATCH'; readonly caseId?: string | null }
  | { readonly kind: 'FILL_TIMEOUT'; readonly caseId?: string | null }
  | { readonly kind: 'UNAVAILABLE'; readonly detail: string };
export interface ConversionStep {
  convert(order: JourneyOrder, nowMs: bigint): Promise<ConvertResult>;
}

/** The D1 Arc payment: send, then our own indexer's confirmation (DFNS is a cross-check only). */
export type ArcSendResult =
  | { readonly kind: 'PENDING' }
  | { readonly kind: 'CONFIRMED'; readonly txHash: Hex32 }
  | { readonly kind: 'REVERTED'; readonly txHash: Hex32 }
  | { readonly kind: 'REFUSED'; readonly reason: 'BLOCKLISTED_PRECHECK' | 'DESTINATION_NOT_ALLOWED' }
  /** Timeout, 5xx, marker set without an external ref, hashless Failed: never retried blindly. */
  | { readonly kind: 'UNRESOLVED'; readonly reason: 'MARKER_SET_NO_EXTERNAL_REF' | 'DFNS_TIMEOUT' | 'DFNS_5XX' | 'HASHLESS_FAILED' };
export interface ArcSendPort {
  send(order: JourneyOrder): Promise<ArcSendResult>;
}

/** Off-ramp partner payout (JPARTNER / JPAYOUT). PAID is the partner's final confirmation. */
export type PayoutResult =
  | { readonly kind: 'PENDING' }
  | { readonly kind: 'PAID'; readonly payoutRef: string }
  | { readonly kind: 'FAILED'; readonly reason: 'BENEFICIARY_REJECTED' }
  | { readonly kind: 'RETURNED'; readonly reason: 'PARTNER_RETURNED' };
export interface PayoutPort {
  advance(order: JourneyOrder, nowMs: bigint): Promise<PayoutResult>;
}

/** Opens an OPS case (the adapter builds the server-side options from the payment). Null id when the queue is down. */
export interface CasePort {
  open(req: {
    readonly kind: CaseKind;
    readonly reason: string;
    readonly subject: string;
    readonly paymentId: PaymentId;
    readonly clientUid: NovaOwnerRef;
    readonly evidenceRefs: readonly string[];
  }): Promise<{ readonly caseId: string | null }>;
}

/**
 * Reads an operator decision back from the OPS case store (structurally `Pick<OpsQueue, 'getCase'>`).
 * The orchestrator never takes a decision from a caller: it resumes only on a CLOSED case it can read.
 */
export interface DecisionPort {
  getCase(caseId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND'>>;
}
