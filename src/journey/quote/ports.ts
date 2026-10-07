/**
 * JQUOTE ports: the two price sources a journey quote may need, plus a clock.
 *
 * - FxPort: Nova's fiat→USDC conversion as the Raayl team describes it
 *   (design delta 1, D-1, answers 32-34; assumptions DA-1..DA-4, not
 *   verified). Used ONLY when the payer picks FIAT. It is two asynchronous
 *   steps: `getPricingCode` writes a pricing code (an aggregated feed plus a
 *   spread) to Nova's `otc-codes` and returns `{ codeId, rate, expiresAt }`;
 *   a human then fills the trade in the OTC desk UI, Nova books the general
 *   ledger entries, and the outcome (FILLED, REJECTED or EXPIRED) reaches the
 *   package as an inbound event (`awaitFill`), checked for authenticity by
 *   `verifyFillEvent` before use. Nothing executes a conversion automatically
 *   (answer 33), so FxPort no longer ties to ConversionPort.execute (delta
 *   amendment A-3); the package never computes a rate. The journey quote's
 *   rate lock is the code's own `expiresAt`, read by an `ExpiryReader`; no
 *   duration is fixed here (DA-1).
 * - FxLocker: what the composer asks for (a locked, checked FX quote). It is
 *   implemented by the fill desk (fill.ts), which obtains a pricing code
 *   through FxPort and derives the code's quote amounts here
 *   (`quoteAtCodeRate`, U1 checked add and subtract only), so every amount
 *   the journey relies on passes the one exact identity (`checkFxLock` over
 *   `checkQuote`, src/nova-ports/conversion.ts).
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
import type { Quote, QuoteRejectCode, QuoteRequest, RatioQuote } from '../../nova-ports/conversion.js';
import type { FiatCode, IdempotencyKey, LedgerAssetCode, PortResult } from '../../nova-ports/ids.js';
import type { LedgerAccount, LedgerLeg } from '../../nova-ports/ledger.js';
import { addCbsMinor, cbsMinor, CBS_MINOR_MAX, subtractCbsMinor } from '../../amounts/index.js';
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
// FxPort: fiat → USDC through a pricing code and a manual fill (D-1).
// ---------------------------------------------------------------------------

/** A locked fiat→USDC rate: the code's quote, plus the code's own expiry as epoch ms. */
export interface FxLock {
  readonly quote: Quote;
  readonly expiresAtMs: bigint;
}

/**
 * Why a lock is refused. `BAD_EXPIRY`: the code's expiry could not be read;
 * refuse rather than guess (DA-1). `BAD_CODE`: the code is malformed (no
 * usable id or a rate that is not a ratio of positive integers).
 * `FILL_OUTSTANDING`: the payment already has a code whose outcome is not
 * known yet, a booked conversion, or a refused booked fill whose case is
 * still open; no second code is requested (D-1, verifier delta1 m12).
 */
export type FxRejectCode = QuoteRejectCode | 'BAD_EXPIRY' | 'BAD_CODE' | 'FILL_OUTSTANDING';

/** What the composer needs: a checked FX lock, idempotent on `key` (same key and request replays; another request is KEY_CONFLICT). */
export interface FxLocker {
  lockRate(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<FxLock, FxRejectCode>>;
}

/** A pricing code as Nova returns it (DA-1): id, rate (to-asset minor units per from-asset minor unit) and Nova's expiry text. */
export interface PricingCode {
  readonly codeId: string;
  readonly rate: RatioQuote;
  readonly expiresAt: string;
}

/** A FILLED event, after authenticity: every field Nova must send (D-1). All amounts are ledger minor units, integer. */
export interface FilledEvent {
  readonly kind: 'FILLED';
  readonly codeId: string;
  readonly from: LedgerAssetCode;
  readonly to: LedgerAssetCode;
  readonly fromAmount: CbsMinor;
  readonly toAmount: CbsMinor;
  readonly rate: RatioQuote;
  /** From-asset dust Nova posted to the dust destination. */
  readonly remainder: CbsMinor;
  readonly bookedEntryRef: string;
  /** Nova's own fill time, epoch ms: the authoritative timestamp for the expiry decision. */
  readonly filledAtMs: bigint;
  readonly reviewer: string;
}

/** A REJECTED or EXPIRED outcome: nothing was booked for the code (verifier delta1 m11). */
export interface UnfilledEvent {
  readonly kind: 'REJECTED' | 'EXPIRED';
  readonly codeId: string;
}

export type FillEvent = FilledEvent | UnfilledEvent;

/** One delivered event, exactly as it arrived (the body is never parsed before its authenticity is checked). */
export interface RawFillEvent {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * `BAD_SIGNATURE`: authenticity failed. `SCHEME_UNCONFIGURED`: the signature
 * scheme is not known yet (DQ-1); no event is accepted (fail closed).
 * `MALFORMED`: authentic but not a fill event.
 */
export type FillAuthCode = 'BAD_SIGNATURE' | 'SCHEME_UNCONFIGURED' | 'MALFORMED';

export interface FxPort {
  /**
   * Writes one pricing code for `req` to `otc-codes` (DA-1). Idempotent on
   * `key` (derived from the payment id and the quote request id): a retry
   * with the same key returns the same code and writes no second row; the
   * same key with other arguments is KEY_CONFLICT.
   */
  getPricingCode(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<PricingCode, QuoteRejectCode>>;
  /** The next event Nova delivers for `codeId` (pushed, never polled from a UI). It may never arrive; the fill desk times it out. */
  awaitFill(codeId: string): Promise<RawFillEvent>;
  /** Authenticity first, then the parsed event (the scheme is open question DQ-1; the same shape as D1 `verifyCallback`). */
  verifyFillEvent(rawBody: string, headers: Readonly<Record<string, string>>): Promise<PortResult<FillEvent, FillAuthCode>>;
}

/**
 * Reads Nova's code `expiresAt` text as epoch ms; null when unreadable. The
 * format is unknown until K-51 is answered [A-51], so Nova supplies it.
 */
export type ExpiryReader = (expiresAt: string) => bigint | null;

/** Null when `lock` is an exact answer to `req` at the expected USDC precision; otherwise why not. */
export function checkFxLock(req: QuoteRequest, lock: FxLock, usdcPrecision: CbsPrecision): string | null {
  const why = checkQuote(req, lock.quote);
  if (why !== null) return why;
  if (lock.quote.to.precision !== usdcPrecision) return 'quote is at another USDC precision';
  if (req.side === 'TO_EXACT' && lock.quote.remainder !== 0n) return 'a TO_EXACT quote must leave no remainder';
  if (!remainderBelowOneUnit(lock.quote.rate, lock.quote.remainder)) return 'remainder is worth one target minor unit or more';
  return null;
}

const REF = /^\S{1,255}$/;

/** True for a well-formed opaque reference (no whitespace, 1-255 characters). */
export function isFxRef(s: unknown): boolean {
  return typeof s === 'string' && REF.test(s);
}

/** True for a ratio of positive bigints. */
export function isPositiveRatio(r: RatioQuote): boolean {
  return typeof r.numerator === 'bigint' && typeof r.denominator === 'bigint' && r.numerator > 0n && r.denominator > 0n;
}

interface Rung {
  readonly from: CbsMinor;
  readonly to: CbsMinor;
}

/**
 * Whole lots of `lot` (`from` units buy exactly `to` units) that fit in
 * `limit`, measured on the `side` of the lot that `limit` is in. Binary long
 * division by doubling, with U1's checked add and subtract only, so no raw
 * arithmetic is re-branded (U1 rule); null when a doubled lot or the sum
 * would pass CBS_MINOR_MAX (it cannot be represented: refuse).
 */
function wholeLots(limit: CbsMinor, lot: Rung, side: 'from' | 'to'): { readonly used: Rung; readonly rest: CbsMinor } | null {
  let ladder: readonly Rung[] = [];
  let top = lot;
  for (;;) {
    ladder = [top, ...ladder];
    if (top[side] > subtractCbsMinor(limit, top[side])) break;
    if (top.from > CBS_MINOR_MAX - top.from || top.to > CBS_MINOR_MAX - top.to) return null;
    top = { from: addCbsMinor(top.from, top.from), to: addCbsMinor(top.to, top.to) };
  }
  let rest = limit;
  let used: Rung = { from: cbsMinor(0n), to: cbsMinor(0n) };
  for (const r of ladder) {
    if (r[side] > rest) continue;
    if (used.from > CBS_MINOR_MAX - r.from || used.to > CBS_MINOR_MAX - r.to) return null;
    rest = subtractCbsMinor(rest, r[side]);
    used = { from: addCbsMinor(used.from, r.from), to: addCbsMinor(used.to, r.to) };
  }
  return { used, rest };
}

/**
 * The code's quote for `req` at the code's own rate, in whole lots of the
 * rate as given (`denominator` from-units buy `numerator` to-units):
 * FROM_EXACT keeps the from amount exact and returns what does not fill a
 * lot as the remainder; TO_EXACT needs a to amount of whole lots and leaves
 * no remainder. The rate is never changed or reduced (the package computes
 * no rate). Null when nothing converts, the amount is not whole lots
 * (TO_EXACT), the result does not fit, or the code is malformed. The caller
 * must still pass the result through `checkFxLock` (the identity and the
 * remainder value bound are the authority, not this arithmetic).
 */
export function quoteAtCodeRate(req: QuoteRequest, code: PricingCode, fromPrec: CbsPrecision, toPrec: CbsPrecision): Quote | null {
  if (!isFxRef(code.codeId) || !isPositiveRatio(code.rate)) return null;
  if (code.rate.numerator > CBS_MINOR_MAX || code.rate.denominator > CBS_MINOR_MAX) return null;
  const lot: Rung = { from: cbsMinor(code.rate.denominator), to: cbsMinor(code.rate.numerator) };
  const side = req.side === 'FROM_EXACT' ? 'from' : 'to';
  if (lot[side] > req.amount) return null;
  const fit = wholeLots(req.amount, lot, side);
  if (fit === null) return null;
  if (side === 'to' && fit.rest !== 0n) return null;
  return {
    quoteId: code.codeId,
    from: { asset: req.from, amount: side === 'from' ? req.amount : fit.used.from, precision: fromPrec },
    to: { asset: req.to, amount: fit.used.to, precision: toPrec },
    rate: code.rate,
    remainder: side === 'from' ? fit.rest : cbsMinor(0n),
    expiresAt: code.expiresAt,
    provider: 'otc-code',
  };
}

// ---------------------------------------------------------------------------
// Fill checks (D-1 checks 2-5). Check 1 (a code this package requested and
// still open) is the fill desk's state (fill.ts).
// ---------------------------------------------------------------------------

/** Why a FILLED event is refused (closed set). */
export type FillRefusal =
  | 'CODE_NOT_OPEN'
  | 'CODE_SUPERSEDED'
  | 'PAIR_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'RATE_MISMATCH'
  | 'FILL_MISPOSTED'
  | 'FILLED_AFTER_EXPIRY';

/** Null when the event has the shape D-1 requires; otherwise why not. */
export function fillEventProblem(e: FillEvent): string | null {
  if (!isFxRef(e.codeId)) return 'codeId malformed';
  if (e.kind === 'REJECTED' || e.kind === 'EXPIRED') return null;
  if (e.kind !== 'FILLED') return 'unknown event kind';
  if (!isFxRef(e.from) || !isFxRef(e.to)) return 'pair malformed';
  if (typeof e.fromAmount !== 'bigint' || typeof e.toAmount !== 'bigint' || typeof e.remainder !== 'bigint') return 'amounts must be bigints';
  if (e.fromAmount <= 0n || e.toAmount <= 0n || e.remainder < 0n || e.remainder > e.fromAmount) return 'amounts out of range';
  if (!isPositiveRatio(e.rate)) return 'rate must be a ratio of positive integers';
  if (!isFxRef(e.bookedEntryRef)) return 'bookedEntryRef malformed';
  if (typeof e.filledAtMs !== 'bigint' || e.filledAtMs < 0n) return 'filledAt malformed';
  if (!isFxRef(e.reviewer)) return 'reviewer malformed';
  return null;
}

/**
 * Checks 2 and 3: the fill is the code's quote exactly. Pair, from amount,
 * to amount and remainder must equal the code's quote (which passed
 * `checkFxLock`), and the rate must equal the code's rate by
 * cross-multiplication, so a self-consistent fill at another rate is refused.
 */
export function fillTermsProblem(code: Quote, fill: FilledEvent): FillRefusal | null {
  if (fill.from !== code.from.asset || fill.to !== code.to.asset) return 'PAIR_MISMATCH';
  if (fill.fromAmount !== code.from.amount || fill.toAmount !== code.to.amount || fill.remainder !== code.remainder) return 'AMOUNT_MISMATCH';
  if (fill.rate.numerator * code.rate.denominator !== code.rate.numerator * fill.rate.denominator) return 'RATE_MISMATCH';
  return null;
}

/** Check 5: a fill is live only strictly before the code's expiry, judged by Nova's `filledAt`, never by arrival time. */
export function filledInTime(fill: FilledEvent, codeExpiresAtMs: bigint): boolean {
  return fill.filledAtMs < codeExpiresAtMs;
}

/** One journal of a booked entry, in one asset. */
export interface BookedJournal {
  readonly journalId: string;
  readonly asset: LedgerAssetCode;
  readonly legs: readonly LedgerLeg[];
}

/** What Nova booked for a fill, read back by reference. */
export interface BookedEntry {
  readonly bookedEntryRef: string;
  readonly journals: readonly BookedJournal[];
}

/**
 * The LedgerPort read-back the delta needs for check 4. D1 LedgerPort has
 * only `getJournalByKey`, and a journal Nova books is not under our key
 * (verifier delta1 m4), so this method is the proposed LedgerPort extension;
 * it uses LedgerPort's own leg and account types.
 */
export interface LedgerReadBackPort {
  getBookedEntry(bookedEntryRef: string): Promise<PortResult<BookedEntry, 'NOT_FOUND'>>;
}

/** The accounts check 4 binds a fill to: from the server-side payment record and configuration, never from the event. */
export interface FillAccounts {
  /** The client's account in the from asset: debited exactly `fromAmount`. */
  readonly clientFrom: LedgerAccount;
  /** The account credited the to side: exactly `toAmount`. */
  readonly to: LedgerAccount;
  /** The configured dust destination (D-5, set explicitly): credited exactly `remainder`. */
  readonly dust: LedgerAccount;
}

function sameAccount(a: LedgerAccount, b: LedgerAccount): boolean {
  return a.kind === 'CUSTOMER' ? b.kind === 'CUSTOMER' && a.account === b.account : b.kind === 'ROLE' && a.role === b.role && a.sub === b.sub;
}

/** Debit and credit totals of `account` across the journals in `asset`. */
function totals(entry: BookedEntry, asset: LedgerAssetCode, account: LedgerAccount): { readonly debits: bigint; readonly credits: bigint } {
  let debits = 0n;
  let credits = 0n;
  for (const j of entry.journals) {
    if (j.asset !== asset) continue;
    for (const l of j.legs) {
      if (!sameAccount(l.account, account)) continue;
      if (l.side === 'DEBIT') debits += l.amount;
      else credits += l.amount;
    }
  }
  return { debits, credits };
}

/**
 * Check 4, by read-back: null when the booked entry is exactly the fill;
 * otherwise why not (the fill is then FILL_MISPOSTED). Every journal has two
 * or more positive legs and balances; only the pair's two assets appear,
 * each at least once; the client's from account is debited exactly
 * `fromAmount` and credited nothing; the to account is credited exactly
 * `toAmount` and debited nothing; the dust destination is credited exactly
 * the remainder (nothing when the remainder is 0) and debited nothing.
 */
export function bookedEntryProblem(entry: BookedEntry, fill: FilledEvent, accounts: FillAccounts): string | null {
  if (entry.bookedEntryRef !== fill.bookedEntryRef) return 'read-back is for another entry';
  const assets = new Set<string>();
  for (const j of entry.journals) {
    if (j.asset !== fill.from && j.asset !== fill.to) return `journal ${j.journalId} is in another asset`;
    assets.add(j.asset);
    if (j.legs.length < 2) return `journal ${j.journalId} has fewer than two legs`;
    let debits = 0n;
    let credits = 0n;
    for (const l of j.legs) {
      if (typeof l.amount !== 'bigint' || l.amount <= 0n) return `journal ${j.journalId} has a leg that is not positive`;
      if (l.side === 'DEBIT') debits += l.amount;
      else if (l.side === 'CREDIT') credits += l.amount;
      else return `journal ${j.journalId} has a leg with no side`;
    }
    if (debits !== credits) return `journal ${j.journalId} does not balance`;
  }
  if (!assets.has(fill.from) || !assets.has(fill.to)) return 'a side of the conversion is not booked';
  const client = totals(entry, fill.from, accounts.clientFrom);
  if (client.debits !== fill.fromAmount || client.credits !== 0n) return 'client is not debited exactly the from amount';
  const to = totals(entry, fill.to, accounts.to);
  if (to.credits !== fill.toAmount || to.debits !== 0n) return 'to side is not credited exactly the to amount';
  const dust = totals(entry, fill.from, accounts.dust);
  if (dust.credits !== fill.remainder || dust.debits !== 0n) return 'remainder is not posted exactly to the dust destination';
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
