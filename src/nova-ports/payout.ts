/**
 * PayoutPartnerPort (docs/NOVA_ARC_DESIGN.md §7.5): the fiat payout rail used
 * by the PAYOUT leg when the RECEIVER picks a fiat bank account (§4.1). A
 * CPN-shaped STUB until a partner agreement exists: no real partner API is
 * assumed, and the callback authenticity scheme is unknown (Q-N12). D1 has
 * fakes only. The partner is paid in USDC on Arc first (ARC_TRANSFER to its
 * settlement address [A-52], P2P) and pays the receiver in fiat; `PAID` from
 * an authenticated source is the only thing that completes the PAYOUT leg.
 *
 * Every callback is authenticity-checked (verifyCallback) and then
 * deduplicated on `payout:<payoutId>:<state>` (§10.3) before use.
 */
import type { CbsMinor } from '../amounts/index.js';
import type { BeneficiaryRef, FiatCode, Hex32, IdempotencyKey, KeyConflict, NetworkId, PortResult } from './ids.js';

export interface PayoutRequest {
  readonly beneficiaryRef: BeneficiaryRef;
  readonly currency: FiatCode;
  /** > 0, in the payout currency's ledger minor units. */
  readonly amount: CbsMinor;
  /** The Arc transaction that funded the partner. */
  readonly funding: { readonly network: NetworkId; readonly txHash: Hex32 };
}

export type PayoutState = 'PENDING' | 'PAID' | 'FAILED';

export interface PayoutStatus {
  readonly state: PayoutState;
  readonly reason: string | null;
}

export type CreatePayoutRejectCode = KeyConflict | 'BENEFICIARY_INVALID' | 'NOT_FUNDED';
export type CallbackRejectCode = 'BAD_SIGNATURE' | 'STALE';

export interface PayoutPartnerPort {
  createPayout(key: IdempotencyKey, req: PayoutRequest): Promise<PortResult<{ readonly payoutId: string }, CreatePayoutRejectCode>>;
  getPayout(payoutId: string): Promise<PortResult<PayoutStatus, 'NOT_FOUND'>>;
  /** Authenticity check of a partner callback over the raw body; the scheme is unknown until the agreement (Q-N12). */
  verifyCallback(rawBody: Uint8Array, headers: Readonly<Record<string, string>>): PortResult<{ readonly dedupeKey: string }, CallbackRejectCode>;
}

/** §10.3 dedupe key of a payout state (a callback and our read of the same state dedupe to one). */
export function payoutDedupeKey(payoutId: string, state: PayoutState): string {
  return `payout:${payoutId}:${state}`;
}

/** Canonical encoding of a createPayout request, for same-key comparison (§7.1). */
export function canonicalPayout(req: PayoutRequest): string {
  return JSON.stringify([req.beneficiaryRef, req.currency, req.amount.toString(), req.funding.network, req.funding.txHash]);
}
