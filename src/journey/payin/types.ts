/**
 * JPAYIN: the pay-in port. The SENDER chooses the method: FIAT (Nova's
 * internal-ledger pay-in, delta D-3) or STABLECOIN (USDC on Arc, detected PER
 * TRANSFER by our indexer). Every inbound signal is authenticity-checked and
 * deduplicated before use; anything unconfigured fails closed.
 *
 * Money path: no `number` (MC-01). Fiat amounts are `CbsMinor`, stablecoin
 * amounts `UsdcUnits`; they are never mixed. Times are epoch ms bigints.
 */
import type { CbsMinor, UsdcUnits } from '../../amounts/index.js';
import { lpDigestHex } from '../../nova-ports/ids.js';
import type { LedgerAssetCode, NetworkAddress, NovaAccountRef, PaymentId } from '../../nova-ports/ids.js';
import type { CaseKind } from '../../ops/types.js';

export type PayInMethod = 'FIAT' | 'STABLECOIN';

interface ExpectationBase {
  readonly paymentId: PaymentId;
  readonly clientUid: string;
  /** Server-side id of this expected pay-in (dedupe key `payin:<id>`). */
  readonly expectedPayInId: string;
  /** Epoch ms at which the journey quote (rate lock) expires. */
  readonly quoteExpiresAtMs: bigint;
  /** The client's recorded agreement to the settlement instructions (answer 35). Null: hold. */
  readonly settlementConsentRef: string | null;
  /** Id of the settlement instructions the client saw (bound into the consent digest). */
  readonly settlementInstructionsRef: string;
}

export interface FiatExpectation extends ExpectationBase {
  readonly method: 'FIAT';
  readonly expected: CbsMinor;
}

export interface StablecoinExpectation extends ExpectationBase {
  readonly method: 'STABLECOIN';
  readonly expected: UsdcUnits;
  /** The payment-specific Arc deposit address (server-side record, never client input). */
  readonly depositAddress: NetworkAddress;
}

export type PayInExpectation = FiatExpectation | StablecoinExpectation;

/** Why a pay-in is held (a case is opened in the OPS queue). */
export type HoldReason =
  | 'SIGNAL_CONFLICT'
  | 'CONSENT_MISSING'
  | 'BOOKED_ENTRY_MISMATCH'
  | 'CONFIRMED_BELOW_EXPECTED'
  | 'CONFIRMED_ABOVE_EXPECTED'
  | 'SUB_UNIT_REMAINDER'
  | 'PAYIN_AFTER_QUOTE_EXPIRY';

export type FailCode = 'NOT_CONFIGURED' | 'INDEXER_FAILED' | 'LEDGER_UNAVAILABLE' | 'EXPECTATION_INVALID' | 'METHOD_UNSUPPORTED';

export type PayInResult =
  | { readonly kind: 'PENDING' }
  /** Money may move on. `amount` is the confirmed amount (equal to expected). */
  | { readonly kind: 'CONFIRMED'; readonly method: PayInMethod; readonly amount: bigint; readonly evidenceRef: string; readonly consentRef: string }
  /** Quote expired with no pay-in: the quote lapses, nothing to refund. */
  | { readonly kind: 'EXPIRED' }
  /** Nothing moves; an OPS case was opened (`caseId` null when opening failed: still held). */
  | { readonly kind: 'HELD'; readonly reason: HoldReason; readonly caseKind: CaseKind; readonly caseId: string | null; readonly caseCode: string }
  /** A technical failure; nothing moves. Callers PAUSE/page, never treat as "no pay-in". */
  | { readonly kind: 'FAILED_CLOSED'; readonly code: FailCode; readonly detail: string };

export interface PayInPort {
  readonly method: PayInMethod;
  /** Idempotent: a confirmed pay-in returns the same CONFIRMED and consumes the consent once. */
  settle(exp: PayInExpectation, nowMs: bigint): Promise<PayInResult>;
}

/** Accounts and assets the refund option of a case posts (D-2 P13). All must be set explicitly; none is defaulted. */
export interface PayInConfig {
  readonly fiatAsset: LedgerAssetCode;
  readonly usdcAsset: LedgerAssetCode;
  /** Debited on a refund: where the unmatched pay-in is held (Suspense per answer 19, configured). */
  readonly refundDebit: NovaAccountRef;
  /** Credited on a refund: the account the money leaves through (configured, never defaulted). */
  readonly refundCredit: NovaAccountRef;
}

export function assertConfig(c: PayInConfig | null | undefined): PayInConfig {
  if (c === null || c === undefined || [c.fiatAsset, c.usdcAsset, c.refundDebit, c.refundCredit].some((x) => typeof x !== 'string' || x.trim() === '')) {
    throw new RangeError('JPAYIN: asset codes and refund accounts must be set explicitly (fail closed)');
  }
  return c;
}

/** Digest of the exact settlement option a consent is bound to (D-3): payment, method, amount, instructions. */
export function settlementDigest(exp: PayInExpectation): string {
  return lpDigestHex(['payin-settlement', exp.paymentId, exp.method, exp.expected.toString(10), exp.settlementInstructionsRef, exp.method === 'STABLECOIN' ? exp.depositAddress : '-']);
}

export function expectationProblem(e: PayInExpectation): string | null {
  const bad = (s: string): boolean => typeof s !== 'string' || !/^\S{1,255}$/.test(s);
  if (bad(e.clientUid) || bad(e.expectedPayInId) || bad(e.settlementInstructionsRef)) return 'clientUid, expectedPayInId or settlementInstructionsRef malformed';
  if (typeof e.expected !== 'bigint' || e.expected <= 0n) return 'expected amount must be a positive bigint';
  if (typeof e.quoteExpiresAtMs !== 'bigint') return 'quoteExpiresAtMs must be a bigint';
  if (e.method === 'STABLECOIN' && !/^0x[0-9a-f]{40}$/.test(e.depositAddress)) return 'depositAddress must be a lower-case address';
  return null;
}
