import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision } from '../../src/amounts/index.js';
import type { Quote, QuoteRequest } from '../../src/nova-ports/conversion.js';
import { FixedRateConversion } from '../../src/nova-ports/fakes/conversion-fakes.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { fiatCode, idempotencyKey, ledgerAssetCode } from '../../src/nova-ports/ids.js';
import { checkFxLock, checkPayoutQuote, fxPortFromConversion, remainderBelowOneUnit } from '../../src/journey/quote/ports.js';
import type { FxLock, PayoutQuote, PayoutQuoteRequest } from '../../src/journey/quote/ports.js';

const ZAR = ledgerAssetCode('ZAR');
const USDC = ledgerAssetCode('USDC');
const P6 = cbsPrecision(6);
const P2 = cbsPrecision(2);
const key = idempotencyKey('jq:test:1');

function conversion(faults?: FaultPlan): FixedRateConversion {
  return new FixedRateConversion({
    pairs: [{ from: ZAR, fromPrecision: P2, to: USDC, toPrecision: P6, lot: { from: cbsMinor(37n), to: cbsMinor(20000n) } }],
    ttlTicks: 5n,
    limit: cbsMinor(1_000_000n),
    available: null,
    ...(faults === undefined ? {} : { faults }),
  });
}

const tickReader = (s: string): bigint | null => (s.startsWith('tick:') ? BigInt(s.slice(5)) * 1000n : null);
const fxReq: QuoteRequest = { from: ZAR, to: USDC, amount: cbsMinor(10000n), side: 'FROM_EXACT' };

describe('JQUOTE fxPortFromConversion (Nova ConversionPort reached, not reimplemented)', () => {
  it('returns Nova quote unchanged, with the expiry read into epoch ms', async () => {
    const fx = fxPortFromConversion(conversion(), tickReader);
    const r = await fx.lockRate(key, fxReq);
    expect(r.kind).toBe('OK');
    if (r.kind !== 'OK') return;
    expect(r.replayed).toBe(false);
    expect(r.value.expiresAtMs).toBe(5000n);
    expect(r.value.quote.to.amount).toBe(270n * 20000n);
    expect(r.value.quote.remainder).toBe(10n);
    const again = await fx.lockRate(key, fxReq);
    expect(again).toEqual({ kind: 'OK', value: r.value, replayed: true });
  });

  it('passes REJECTED and AMBIGUOUS through unchanged', async () => {
    const fx = fxPortFromConversion(conversion(), tickReader);
    expect(await fx.lockRate(key, { ...fxReq, from: ledgerAssetCode('EUR') })).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'EUR->USDC' });
    const plan = new FaultPlan();
    plan.arm('quote', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await fxPortFromConversion(conversion(plan), tickReader).lockRate(key, fxReq)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
  });

  it('refuses an unreadable expiry instead of guessing (BAD_EXPIRY)', async () => {
    const fx = fxPortFromConversion(conversion(), () => null);
    expect(await fx.lockRate(key, fxReq)).toEqual({ kind: 'REJECTED', code: 'BAD_EXPIRY', detail: 'unreadable expiry "tick:5"' });
  });
});

function goodLock(over: Partial<Quote> = {}): FxLock {
  const quote: Quote = {
    quoteId: 'q1',
    from: { asset: ZAR, amount: cbsMinor(10000n), precision: P2 },
    to: { asset: USDC, amount: cbsMinor(5_400_000n), precision: P6 },
    rate: { numerator: 5_400_000n, denominator: 10000n },
    remainder: cbsMinor(0n),
    expiresAt: 'x',
    provider: 'p',
    ...over,
  };
  return { quote, expiresAtMs: 1n };
}

describe('JQUOTE remainderBelowOneUnit (value bound, R2 B1)', () => {
  it.each([
    // remainder x numerator < denominator
    [1n, 10000n, 9999n, true],
    [1n, 10000n, 10000n, false],
    [1n, 10000n, 0n, true],
    [20000n, 37n, 0n, true],
    [20000n, 37n, 1n, false],
    [184523n, 100_000_000n, 541n, true],
    [184523n, 100_000_000n, 542n, false],
    [0n, 5n, 0n, false],
    [5n, 0n, 0n, false],
    [-1n, 5n, 0n, false],
    [5n, -1n, 0n, false],
  ])('rate %s/%s remainder %s -> %s', (numerator, denominator, remainder, expected) => {
    expect(remainderBelowOneUnit({ numerator, denominator }, remainder)).toBe(expected);
  });
});

describe('JQUOTE checkFxLock', () => {
  it('accepts an exact lock', () => {
    expect(checkFxLock(fxReq, goodLock(), P6)).toBeNull();
    const toReq: QuoteRequest = { ...fxReq, side: 'TO_EXACT', amount: cbsMinor(5_400_000n) };
    expect(checkFxLock(toReq, goodLock({ from: { asset: ZAR, amount: cbsMinor(9990n), precision: P2 }, rate: { numerator: 20000n, denominator: 37n }, remainder: cbsMinor(0n) }), P6)).toBeNull();
  });

  it('refuses through the shared checkQuote identity', () => {
    expect(checkFxLock(fxReq, goodLock({ to: { asset: USDC, amount: cbsMinor(5_400_001n), precision: P6 } }), P6)).toBe('conversion does not balance to the minor unit');
  });

  it('refuses a lock at another USDC precision', () => {
    expect(checkFxLock(fxReq, goodLock({ to: { asset: USDC, amount: cbsMinor(5_400_000n), precision: cbsPrecision(18) } }), P6)).toBe('quote is at another USDC precision');
  });

  it('refuses a FROM_EXACT remainder worth one target unit or more (R2 B1); accepts one unit below it', () => {
    // rate 1/1000 (1 target unit per 1000 from-units): remainder 999 is worth < 1 unit, 1000 is worth 1.
    const rate = { numerator: 1n, denominator: 1000n };
    const at = (from: bigint, to: bigint, remainder: bigint): FxLock => goodLock({ from: { asset: ZAR, amount: cbsMinor(from), precision: P2 }, to: { asset: USDC, amount: cbsMinor(to), precision: P6 }, rate, remainder: cbsMinor(remainder) });
    expect(checkFxLock({ ...fxReq, amount: cbsMinor(10999n) }, at(10999n, 10n, 999n), P6)).toBeNull();
    expect(checkFxLock({ ...fxReq, amount: cbsMinor(11000n) }, at(11000n, 10n, 1000n), P6)).toBe('remainder is worth one target minor unit or more');
  });

  it('A3 (verifier): lot R1845.23 -> 100 USDC, R3000.00 in: R1154.77 as "remainder" is withheld value, refused even though it balances', () => {
    const req: QuoteRequest = { ...fxReq, amount: cbsMinor(300_000n) };
    const lock = goodLock({
      from: { asset: ZAR, amount: cbsMinor(300_000n), precision: P2 },
      to: { asset: USDC, amount: cbsMinor(100_000_000n), precision: P6 },
      rate: { numerator: 100_000_000n, denominator: 184_523n },
      remainder: cbsMinor(115_477n),
    });
    expect(checkFxLock(req, lock, P6)).toBe('remainder is worth one target minor unit or more');
    // The honest answer reports the effective rate with remainder 0.
    const honest = goodLock({ from: lock.quote.from, to: lock.quote.to, rate: { numerator: 100_000_000n, denominator: 300_000n }, remainder: cbsMinor(0n) });
    expect(checkFxLock(req, honest, P6)).toBeNull();
  });

  it('refuses a TO_EXACT lock with a remainder', () => {
    const toReq: QuoteRequest = { ...fxReq, side: 'TO_EXACT', amount: cbsMinor(5_400_000n) };
    expect(checkFxLock(toReq, goodLock({ rate: { numerator: 20000n, denominator: 37n }, remainder: cbsMinor(10n) }), P6)).toBe('a TO_EXACT quote must leave no remainder');
  });
});

const usd = fiatCode('USD');
const srcReq: PayoutQuoteRequest = { source: USDC, currency: usd, side: 'SOURCE_EXACT', amount: cbsMinor(1_005_000n) };

function goodPayout(over: Partial<PayoutQuote> = {}): PayoutQuote {
  // 1_005_000 USDC units, lot 10_000 units -> 1 cent: 100 cents, remainder 5_000; fee 50.
  return {
    payoutQuoteId: 'po1',
    sourceAsset: USDC,
    currency: usd,
    source: cbsMinor(1_005_000n),
    sourcePrecision: P6,
    rate: { numerator: 1n, denominator: 10000n },
    remainder: cbsMinor(5000n),
    gross: cbsMinor(100n),
    fee: cbsMinor(50n),
    net: cbsMinor(50n),
    expiresAtMs: 1n,
    ...over,
  };
}

describe('JQUOTE checkPayoutQuote', () => {
  it('accepts an exact SOURCE_EXACT and NET_EXACT quote', () => {
    expect(checkPayoutQuote(srcReq, goodPayout(), P6)).toBeNull();
    const netReq: PayoutQuoteRequest = { ...srcReq, side: 'NET_EXACT', amount: cbsMinor(50n) };
    expect(checkPayoutQuote(netReq, goodPayout({ source: cbsMinor(1_000_000n), remainder: cbsMinor(0n) }), P6)).toBeNull();
    // fee equal to gross is allowed by the identity but leaves nothing.
    expect(checkPayoutQuote(srcReq, goodPayout({ fee: cbsMinor(99n), net: cbsMinor(1n) }), P6)).toBeNull();
  });

  it.each([
    ['zero numerator', { rate: { numerator: 0n, denominator: 10000n } }, 'rate must be a ratio of positive integers'],
    ['zero denominator', { rate: { numerator: 1n, denominator: 0n } }, 'rate must be a ratio of positive integers'],
    ['negative numerator', { rate: { numerator: -1n, denominator: 10000n } }, 'rate must be a ratio of positive integers'],
    ['another source asset', { sourceAsset: ledgerAssetCode('EURC') }, 'quote prices another source asset'],
    ['another currency', { currency: fiatCode('EUR') }, 'quote is for another currency'],
    ['another precision', { sourcePrecision: cbsPrecision(18) }, 'quote is at another USDC precision'],
    ['source not exact', { source: cbsMinor(1_005_001n), remainder: cbsMinor(5001n) }, 'quote does not keep the source amount exact'],
    ['remainder above source', { remainder: cbsMinor(1_005_001n) }, 'remainder exceeds the source amount'],
    ['unbalanced', { gross: cbsMinor(101n), net: cbsMinor(51n) }, 'conversion does not balance to the minor unit'],
    ['fee above gross', { fee: cbsMinor(101n), net: cbsMinor(0n) }, 'fee exceeds the gross amount'],
    ['net not gross minus fee', { net: cbsMinor(49n) }, 'net is not gross minus fee'],
    ['nothing reaches the recipient', { fee: cbsMinor(100n), net: cbsMinor(0n) }, 'nothing reaches the recipient'],
  ] as const)('refuses: %s', (_name, over, why) => {
    expect(checkPayoutQuote(srcReq, goodPayout(over as Partial<PayoutQuote>), P6)).toBe(why);
  });

  it('a remainder worth one payout unit or more is withheld value, never dust (R2 B1): refused even when it balances', () => {
    // rate 1/10000: remainder 9_999 is worth < 1 cent; 10_000 is worth 1 cent.
    const at = (source: bigint, remainder: bigint): PayoutQuote => goodPayout({ source: cbsMinor(source), remainder: cbsMinor(remainder) });
    expect(checkPayoutQuote({ ...srcReq, amount: cbsMinor(1_010_000n) }, at(1_010_000n, 10_000n), P6)).toBe('remainder is worth one target minor unit or more');
    expect(checkPayoutQuote({ ...srcReq, amount: cbsMinor(1_009_999n) }, at(1_009_999n, 9_999n), P6)).toBeNull();
    expect(checkPayoutQuote(srcReq, goodPayout({ remainder: cbsMinor(1_005_000n) }), P6)).toBe('remainder is worth one target minor unit or more');
  });

  it('A1 (verifier): lot 100 USDC -> R1845.23, SEND_EXACT 150 USDC: 50 USDC as "remainder" is refused; A2: rate 3/(2e8), 199.999999 USDC as "remainder" is refused', () => {
    const rate = { numerator: 184_523n, denominator: 100_000_000n };
    const a1Req: PayoutQuoteRequest = { source: USDC, currency: usd, side: 'SOURCE_EXACT', amount: cbsMinor(150_000_000n) };
    const a1 = goodPayout({ source: cbsMinor(150_000_000n), rate, remainder: cbsMinor(50_000_000n), gross: cbsMinor(184_523n), fee: cbsMinor(100n), net: cbsMinor(184_423n) });
    expect(checkPayoutQuote(a1Req, a1, P6)).toBe('remainder is worth one target minor unit or more');
    // Honest: effective rate gross/source, remainder 0.
    const honest = goodPayout({ source: cbsMinor(150_000_000n), rate: { numerator: 184_523n, denominator: 150_000_000n }, remainder: cbsMinor(0n), gross: cbsMinor(184_523n), fee: cbsMinor(100n), net: cbsMinor(184_423n) });
    expect(checkPayoutQuote(a1Req, honest, P6)).toBeNull();
    const a2Req: PayoutQuoteRequest = { ...a1Req, amount: cbsMinor(399_999_999n) };
    const a2 = goodPayout({ source: cbsMinor(399_999_999n), rate: { numerator: 3n, denominator: 200_000_000n }, remainder: cbsMinor(199_999_999n), gross: cbsMinor(3n), fee: cbsMinor(0n), net: cbsMinor(3n) });
    expect(checkPayoutQuote(a2Req, a2, P6)).toBe('remainder is worth one target minor unit or more');
  });

  it('NET_EXACT: keeps the net exact and leaves no remainder', () => {
    const netReq: PayoutQuoteRequest = { ...srcReq, side: 'NET_EXACT', amount: cbsMinor(50n) };
    expect(checkPayoutQuote(netReq, goodPayout({ net: cbsMinor(49n) }), P6)).toBe('quote does not keep the net amount exact');
    expect(checkPayoutQuote(netReq, goodPayout(), P6)).toBe('a NET_EXACT quote must leave no remainder');
  });
});
