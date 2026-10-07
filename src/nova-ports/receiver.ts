/**
 * ReceiverPort (docs/NOVA_ARC_DESIGN.md §7.5a): the RECEIVER's choice.
 *
 * Operator correction: the payer picks how they pay (fiat or stablecoin) and
 * the receiver picks how they receive (fiat bank account or stablecoin wallet).
 * The payout method and the destination are read here, from Nova's server-side
 * receiver / beneficiary record [A-41], never from the payer's request, and are
 * frozen into the payment with the preference version.
 *
 * checkResolvedPayout is the shared consistency rule (fail closed): a
 * STABLECOIN_WALLET payout must land on an address on the same network, and a
 * FIAT_BANK payout on the same beneficiary's bank record. The package never
 * picks a payout method on the receiver's behalf (NO_PAYOUT_PREFERENCE).
 */
import type { PayoutMethod } from '../status/journey.js';
import { normaliseAddress } from './ids.js';
import type { BeneficiaryRef, NetworkAddress, NetworkId, NovaOwnerRef, PortResult } from './ids.js';

export type ReceiverResolveCode = 'BENEFICIARY_UNKNOWN' | 'BENEFICIARY_INACTIVE' | 'NO_PAYOUT_PREFERENCE' | 'PREFERENCE_INVALID';

export type PayoutDestination =
  | { readonly kind: 'ADDRESS'; readonly network: NetworkId; readonly address: NetworkAddress }
  /** Bank details stay in Nova; the partner gets only the ref. */
  | { readonly kind: 'BANK'; readonly beneficiaryRef: BeneficiaryRef };

export interface ResolvedPayout {
  readonly payout: PayoutMethod;
  readonly destination: PayoutDestination;
  /** Set when the receiver is a Nova customer. */
  readonly receiver: NovaOwnerRef | null;
  /** Frozen into the payment record. */
  readonly preferenceVersion: string;
}

export interface ReceiverPort {
  resolvePayout(beneficiaryRef: BeneficiaryRef): Promise<PortResult<ResolvedPayout, ReceiverResolveCode>>;
}

/** Null when the resolved payout is consistent for `ref`; otherwise why not. */
export function checkResolvedPayout(ref: BeneficiaryRef, r: ResolvedPayout): string | null {
  if (r.payout.beneficiaryRef !== ref) return 'payout preference belongs to another beneficiary';
  if (r.preferenceVersion === '') return 'preference version required';
  if (r.payout.method === 'STABLECOIN_WALLET') {
    const d = r.destination;
    if (d.kind !== 'ADDRESS' || d.network !== r.payout.network || normaliseAddress(d.address) !== d.address) {
      return 'a stablecoin payout needs a lower-case address on the same network';
    }
    return null;
  }
  return r.destination.kind === 'BANK' && r.destination.beneficiaryRef === ref ? null : 'a fiat payout needs this beneficiary bank record';
}
