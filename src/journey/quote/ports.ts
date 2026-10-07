/**
 * JQUOTE ports: the two price sources a journey quote may need, plus a clock.
 *
 * - FxPort: Nova's existing fiat→USDC engine (`fx-v2.ts` rates, `otc-routes.ts`
 *   to VALR/OTC, `buildConversionPostings`) [A-50, A-53]. Used ONLY when the
 *   payer picks FIAT. The package never computes a rate: it asks, then checks
 *   the answer with an exact integer identity (checkQuote, U PORTS). FxPort is
 *   the quote half of the existing ConversionPort (src/nova-ports/conversion.ts),
 *   with the expiry as epoch milliseconds; `fxPortFromConversion` builds it
 *   from any ConversionPort, so Nova's engine is reached, never reimplemented.
 * - PayoutQuotePort: the off-ramp partner's USDC→payout-currency quote with
 *   its fee. Used ONLY when the receiver picks FIAT_BANK. The partner does not
 *   exist yet (agreement pending, K-52 [A-52]); the shape follows what the
 *   archived CPN quote concept says a quote has, and nothing more: an
 *   exchange-rate lock for a time window, two-way quotes (source amount or
 *   destination amount exact) and a fee breakdown
 *   (docs/sources/circle/cpn/concepts_quotes.md, MANIFEST row
 *   `sources/circle/cpn/concepts_quotes.md`). No CPN field name is used or
 *   assumed here; mapping CPN's fields is the CPN stub adapter's job.
 *
 * Every rate is a ratio of positive bigints (never a float [A-51]). Every
 * answer is checked here before the composer relies on it (fail closed).
 * A remainder is accepted only when it is WORTH less than one minor unit of
 * the target asset at the quoted rate (`remainderBelowOneUnit`: remainder x
 * numerator < denominator), the true sub-unit residue. Anything worth more is
 * value the port withheld, never dust (CLAUDE.md "Sub-unit dust"; verifier
 * JQUOTE-R1 B1, R2 B1). A port whose lot size would leave more reports its
 * effective rate (to/from) with remainder 0 instead.
 * Money path: no `number` anywhere (MC-01).
 */
import { checkQuote } from '../../nova-ports/conversion.js';
import type { ConversionPort, Quote, QuoteRejectCode, QuoteRequest, RatioQuote } from '../../nova-ports/conversion.js';
import { ok, rejected } from '../../nova-ports/ids.js';
import type { FiatCode, IdempotencyKey, LedgerAssetCode, PortResult } from '../../nova-ports/ids.js';
import { subtractCbsMinor } from '../../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../../amounts/index.js';

/**
 * True when `remainder` (from-asset minor units a quote did not convert) is
 * worth less than ONE target minor unit at `rate` (target per from-asset):
 * remainder x numerator < denominator. This bounds the remainder by its
 * VALUE, not by the rate's step, so a port cannot hide payer value as "dust"
 * by choosing a finer rate representation (verifier JQUOTE-R2 B1). An honest
 * port that cannot meet it reports its effective rate (to/from) with remainder
 * 0. False for a rate that is not a ratio of positive integers (fail closed).
 */
export function remainderBelowOneUnit(rate: RatioQuote, remainder: bigint): boolean {
  // A denominator <= 0 needs no guard: remainder (>= 0) x numerator (> 0) is never below it.
  if (rate.numerator <= 0n) return false;
  return remainder * rate.numerator < rate.denominator;
}

/** Wall clock in epoch milliseconds, as a bigint (MC-01). Injected; tests drive it. */
export interface Clock {
  nowMs(): bigint;
}

// ---------------------------------------------------------------------------
// FxPort: fiat → USDC (payer's FIAT choice only).
// ---------------------------------------------------------------------------

/** A locked fiat→USDC rate: Nova's quote, plus its expiry as epoch ms. */
export interface FxLock {
  readonly quote: Quote;
  readonly expiresAtMs: bigint;
}

/** `BAD_EXPIRY`: the engine's expiry could not be read; refuse rather than guess (Q: K-51/A-51 format). */
export type FxRejectCode = QuoteRejectCode | 'BAD_EXPIRY';

export interface FxPort {
  /** Idempotent on `key`: the same key and request replays the same lock; another request is KEY_CONFLICT. */
  lockRate(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<FxLock, FxRejectCode>>;
}

/**
 * Reads Nova's `Quote.expiresAt` text as epoch ms; null when unreadable. The
 * format is unknown until K-51 is answered [A-51], so Nova supplies it.
 */
export type ExpiryReader = (expiresAt: string) => bigint | null;

/**
 * FxPort over Nova's existing ConversionPort (extend, never parallel): the
 * same `quote` call and key; only the expiry is read into epoch ms. An
 * unreadable expiry is refused (`BAD_EXPIRY`), never defaulted.
 */
export function fxPortFromConversion(conversion: Pick<ConversionPort, 'quote'>, readExpiry: ExpiryReader): FxPort {
  return {
    async lockRate(key, req) {
      const r = await conversion.quote(key, req);
      if (r.kind !== 'OK') return r;
      const expiresAtMs = readExpiry(r.value.expiresAt);
      if (expiresAtMs === null) return rejected('BAD_EXPIRY', `unreadable expiry ${JSON.stringify(r.value.expiresAt)}`);
      return ok({ quote: r.value, expiresAtMs }, r.replayed);
    },
  };
}

/** Null when `lock` is an exact answer to `req` at the expected USDC precision; otherwise why not. */
export function checkFxLock(req: QuoteRequest, lock: FxLock, usdcPrecision: CbsPrecision): string | null {
  const why = checkQuote(req, lock.quote);
  if (why !== null) return why;
  if (lock.quote.to.precision !== usdcPrecision) return 'quote is at another USDC precision';
  if (req.side === 'TO_EXACT' && lock.quote.remainder !== 0n) return 'a TO_EXACT quote must leave no remainder';
  if (!remainderBelowOneUnit(lock.quote.rate, lock.quote.remainder)) return 'remainder is worth one target minor unit or more';
  return null;
}

// ---------------------------------------------------------------------------
// PayoutQuotePort: USDC → payout fiat, with the partner's fee (receiver's
// FIAT_BANK choice only).
// ---------------------------------------------------------------------------

/** `SOURCE_EXACT`: the USDC amount is fixed. `NET_EXACT`: what the recipient receives is fixed (CPN "two-way quotes"). */
export type PayoutQuoteSide = 'SOURCE_EXACT' | 'NET_EXACT';

export interface PayoutQuoteRequest {
  /** USDC ledger asset code [A-03]. */
  readonly source: LedgerAssetCode;
  readonly currency: FiatCode;
  readonly side: PayoutQuoteSide;
  /** USDC ledger minor units (SOURCE_EXACT) or payout-currency minor units (NET_EXACT); > 0. */
  readonly amount: CbsMinor;
}

/**
 * The partner's locked quote. All amounts in ledger minor units [A-03]:
 * `source`, `remainder` in USDC; `gross`, `fee`, `net` in the payout currency.
 *   (source − remainder) × rate.numerator = gross × rate.denominator
 *   net = gross − fee
 * The fee is assumed to be charged in the payout currency, out of `gross`
 * (assumption: the CPN concept page names a fee breakdown but not its
 * currency; to confirm when the partner is chosen, K-52).
 */
export interface PayoutQuote {
  readonly payoutQuoteId: string;
  /** The ledger asset code the partner priced (must be the requested USDC code [A-03]). */
  readonly sourceAsset: LedgerAssetCode;
  readonly currency: FiatCode;
  readonly source: CbsMinor;
  readonly sourcePrecision: CbsPrecision;
  /** Payout-currency minor units per USDC minor unit. */
  readonly rate: RatioQuote;
  /** USDC minor units the partner would not convert. */
  readonly remainder: CbsMinor;
  readonly gross: CbsMinor;
  readonly fee: CbsMinor;
  readonly net: CbsMinor;
  readonly expiresAtMs: bigint;
}

/**
 * Who answers: `LIVE` a real partner under agreement (none exists yet);
 * `STUB` the CPN-shaped stub adapter; `TEST_FAKE` an in-memory fake. Only a
 * non-LIVE source can serve the testnet cross-border demo. The composition
 * root declares the kind it wired (`WiredPayoutPartner.kind`, compose.ts);
 * the port's own `partnerKind` is only a cross-check that must agree.
 */
export type PartnerKind = 'LIVE' | 'STUB' | 'TEST_FAKE';

export type PayoutQuoteRejectCode = 'KEY_CONFLICT' | 'NO_ROUTE' | 'LIMIT' | 'BELOW_MINIMUM';

export interface PayoutQuotePort {
  readonly partnerKind: PartnerKind;
  /** Idempotent on `key`, like every keyed port call (§7.1). */
  quotePayout(key: IdempotencyKey, req: PayoutQuoteRequest): Promise<PortResult<PayoutQuote, PayoutQuoteRejectCode>>;
}

/** Null when `q` answers `req` exactly, with integer arithmetic only; otherwise why not. */
export function checkPayoutQuote(req: PayoutQuoteRequest, q: PayoutQuote, usdcPrecision: CbsPrecision): string | null {
  if (q.rate.numerator <= 0n || q.rate.denominator <= 0n) return 'rate must be a ratio of positive integers';
  if (q.sourceAsset !== req.source) return 'quote prices another source asset';
  if (q.currency !== req.currency) return 'quote is for another currency';
  if (q.sourcePrecision !== usdcPrecision) return 'quote is at another USDC precision';
  const exact = req.side === 'SOURCE_EXACT' ? q.source : q.net;
  if (exact !== req.amount) return `quote does not keep the ${req.side === 'SOURCE_EXACT' ? 'source' : 'net'} amount exact`;
  if (req.side === 'NET_EXACT' && q.remainder !== 0n) return 'a NET_EXACT quote must leave no remainder';
  if (q.remainder > q.source) return 'remainder exceeds the source amount';
  if (!remainderBelowOneUnit(q.rate, q.remainder)) return 'remainder is worth one target minor unit or more';
  if (subtractCbsMinor(q.source, q.remainder) * q.rate.numerator !== q.gross * q.rate.denominator) return 'conversion does not balance to the minor unit';
  if (q.fee > q.gross) return 'fee exceeds the gross amount';
  if (subtractCbsMinor(q.gross, q.fee) !== q.net) return 'net is not gross minus fee';
  if (q.net <= 0n) return 'nothing reaches the recipient';
  return null;
}
