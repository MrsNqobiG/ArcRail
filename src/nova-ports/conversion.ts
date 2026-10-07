/**
 * ConversionPort (docs/NOVA_ARC_DESIGN.md §7.5): Nova's existing fiat↔USDC
 * engine (`fx-v2.ts` rates, `otc-routes.ts`, `buildConversionPostings`) [A-50].
 * Used by the CONVERT_IN leg when the PAYER picks fiat (§4.1). Arc is not
 * responsible for fiat conversion (CO-1 v3 D5): the package computes no rate
 * and posts no conversion leg; Nova's engine does both. D1 has fakes only.
 *
 * checkQuote is the integer identity every quote must satisfy before the
 * package relies on it (fail closed): the rate is a ratio of positive bigints
 * (never a float [A-51]) and the conversion loses nothing, because
 *   (from.amount − remainder) × numerator = to.amount × denominator,
 * with 0 ≤ remainder ≤ from.amount, in each asset's own ledger minor units.
 * The remainder is what Nova's engine posts to suspense [A-51].
 */
import { subtractCbsMinor } from '../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../amounts/index.js';
import type { IdempotencyKey, KeyConflict, LedgerAssetCode, PortResult } from './ids.js';

/** to-asset minor units per from-asset minor unit, as an exact ratio. */
export interface RatioQuote {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface QuoteLeg {
  readonly asset: LedgerAssetCode;
  readonly amount: CbsMinor;
  readonly precision: CbsPrecision;
}

export interface Quote {
  readonly quoteId: string;
  readonly from: QuoteLeg;
  readonly to: QuoteLeg;
  readonly rate: RatioQuote;
  /** From-asset minor units not converted; posted to suspense by Nova's engine [A-51]. */
  readonly remainder: CbsMinor;
  readonly expiresAt: string;
  /** For example the OTC route used [A-53]. */
  readonly provider: string;
}

export type ConversionSide = 'FROM_EXACT' | 'TO_EXACT';

export interface QuoteRequest {
  readonly from: LedgerAssetCode;
  readonly to: LedgerAssetCode;
  readonly amount: CbsMinor;
  readonly side: ConversionSide;
}

export interface Execution {
  readonly conversionId: string;
  /** Nova's own conversion journals (each quote leg a separate, balanced posting [A-50]). */
  readonly journalIds: readonly string[];
  readonly state: 'SETTLED' | 'PENDING';
}

export type ConversionState = 'SETTLED' | 'PENDING' | 'FAILED';
export type QuoteRejectCode = KeyConflict | 'NO_ROUTE' | 'LIMIT';
export type ExecuteRejectCode = KeyConflict | 'QUOTE_EXPIRED' | 'INSUFFICIENT_FUNDS';

export interface ConversionPort {
  quote(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<Quote, QuoteRejectCode>>;
  execute(key: IdempotencyKey, quoteId: string): Promise<PortResult<Execution, ExecuteRejectCode>>;
  get(conversionId: string): Promise<PortResult<{ readonly state: ConversionState }, 'NOT_FOUND'>>;
}

/** Null when `q` answers `req` with an exact, integer, positive-ratio conversion; otherwise why not. */
export function checkQuote(req: QuoteRequest, q: Quote): string | null {
  if (q.rate.numerator <= 0n || q.rate.denominator <= 0n) return 'rate must be a ratio of positive integers';
  if (q.from.asset !== req.from || q.to.asset !== req.to) return 'quote is for another pair';
  const exact = req.side === 'FROM_EXACT' ? q.from.amount : q.to.amount;
  if (exact !== req.amount) return `quote does not keep the ${req.side === 'FROM_EXACT' ? 'from' : 'to'} amount exact`;
  if (q.to.amount <= 0n) return 'nothing converts';
  if (q.remainder > q.from.amount) return 'remainder exceeds the from amount';
  if (subtractCbsMinor(q.from.amount, q.remainder) * q.rate.numerator !== q.to.amount * q.rate.denominator) return 'conversion does not balance to the minor unit';
  return null;
}
