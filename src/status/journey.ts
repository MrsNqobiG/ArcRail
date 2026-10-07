/**
 * The payment journey (docs/NOVA_ARC_DESIGN.md §4.1): two independent choices.
 *
 * Operator correction (binding): "(they pick) they can pay in traditional
 * currency or stable coin and the receiver can receive in traditional currency
 * or stable coin". So:
 * - the PAYER picks the pay-in method: fiat, or stablecoin (from a Nova
 *   balance, or deposited from an external wallet);
 * - the RECEIVER picks the payout method: a fiat bank account or a stablecoin
 *   wallet. It is read server-side through ReceiverPort, never taken from the
 *   payer's request.
 *
 * All four combinations are modelled; journeyLegs gives the legs each needs.
 * Which combinations are live is decided by feature flags (journeyEnabled);
 * only stablecoin to stablecoin is live in D1.
 */
import type { BeneficiaryRef, FiatCode, NetworkId } from '../nova-ports/ids.js';
import type { LegKind } from './index.js';

/** The payer's choice. */
export type PayInMethod =
  | { readonly method: 'STABLECOIN_BALANCE'; readonly asset: 'USDC'; readonly network: NetworkId }
  | { readonly method: 'STABLECOIN_DEPOSIT'; readonly asset: 'USDC'; readonly network: NetworkId }
  | { readonly method: 'FIAT'; readonly currency: FiatCode };

/** The receiver's choice. */
export type PayoutMethod =
  | { readonly method: 'STABLECOIN_WALLET'; readonly asset: 'USDC'; readonly network: NetworkId; readonly beneficiaryRef: BeneficiaryRef }
  | { readonly method: 'FIAT_BANK'; readonly currency: FiatCode; readonly beneficiaryRef: BeneficiaryRef };

/** Feature flags (§4.1). Both default to false; the cross-border flag lives elsewhere and stays OFF. */
export interface JourneyFlags {
  readonly fiatEnabled: boolean;
  readonly stablecoinDepositEnabled: boolean;
}

export const D1_FLAGS: JourneyFlags = Object.freeze({ fiatEnabled: false, stablecoinDepositEnabled: false });

function when(condition: boolean, leg: LegKind): readonly LegKind[] {
  return condition ? [leg] : [];
}

/**
 * §4.1 legs table, in order. Arc is always the settlement leg between the two
 * choices. Fiat pay-in converts first (CONVERT_IN, Nova's engine); fiat payout
 * pays out after Arc (PAYOUT, partner port).
 */
export function journeyLegs(payIn: PayInMethod, payout: PayoutMethod): readonly LegKind[] {
  return Object.freeze([
    ...when(payIn.method === 'STABLECOIN_DEPOSIT', 'AWAIT_DEPOSIT'),
    'RESERVE',
    ...when(payIn.method === 'FIAT', 'CONVERT_IN'),
    'ARC_TRANSFER',
    ...when(payout.method === 'FIAT_BANK', 'PAYOUT'),
  ]);
}

/**
 * True when both choices are enabled. A closed flag refuses the payment with
 * METHOD_NOT_ENABLED before anything is reserved; a method is never silently
 * switched to another.
 */
export function journeyEnabled(payIn: PayInMethod, payout: PayoutMethod, flags: JourneyFlags): boolean {
  const fiat = payIn.method === 'FIAT' || payout.method === 'FIAT_BANK';
  if (fiat && !flags.fiatEnabled) return false;
  return payIn.method !== 'STABLECOIN_DEPOSIT' || flags.stablecoinDepositEnabled;
}

/** True when `legs` is exactly the §4.1 leg list for the two choices. */
export function legsMatchJourney(payIn: PayInMethod, payout: PayoutMethod, legs: readonly LegKind[]): boolean {
  return journeyLegs(payIn, payout).join(',') === legs.join(',');
}
