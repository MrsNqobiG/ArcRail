import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision } from '../../src/amounts/index.js';
import type { Quote, QuoteRequest } from '../../src/nova-ports/conversion.js';
import { FixedRateConversion } from '../../src/nova-ports/fakes/conversion-fakes.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { fiatCode, idempotencyKey, ledgerAssetCode } from '../../src/nova-ports/ids.js';
import { checkFxLock, checkPayoutQuote, fxPortFromConversion } from '../../src/journey/quote/ports.js';
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
    rate: { numerator: 20000n, denominator: 37n },
    remainder: cbsMinor(10n),
    expiresAt: 'x',
    provider: 'p',
    ...over,
  };
  return { quote, expiresAtMs: 1n };
}

describe('JQUOTE checkFxLock', () => {
  it('accepts an exact lock', () => {
    expect(checkFxLock(fxReq, goodLock(), P6)).toBeNull();
    const toReq: QuoteRequest = { ...fxReq, side: 'TO_EXACT', amount: cbsMinor(5_400_000n) };
    expect(checkFxLock(toReq, goodLock({ from: { asset: ZAR, amount: cbsMinor(9990n), precision: P2 }, remainder: cbsMinor(0n) }), P6)).toBeNull();
  });

  it('refuses through the shared checkQuote identity', () => {
    expect(checkFxLock(fxReq, goodLock({ to: { asset: USDC, amount: cbsMinor(5_400_001n), precision: P6 } }), P6)).toBe('conversion does not balance to the minor unit');
  });

  it('refuses a lock at another USDC precision', () => {
    expect(checkFxLock(fxReq, goodLock({ to: { asset: USDC, amount: cbsMinor(5_400_000n), precision: cbsPrecision(18) } }), P6)).toBe('quote is at another USDC precision');
  });

  it('refuses a TO_EXACT lock with a remainder', () => {
    const toReq: QuoteRequest = { ...fxReq, side: 'TO_EXACT', amount: cbsMinor(5_400_000n) };
    expect(checkFxLock(toReq, goodLock(), P6)).toBe('a TO_EXACT quote must leave no remainder');
  });
});

const usd = fiatCode('USD');
const srcReq: PayoutQuoteRequest = { source: USDC, currency: usd, side: 'SOURCE_EXACT', amount: cbsMinor(1_005_000n) };

function goodPayout(over: Partial<PayoutQuote> = {}): PayoutQuote {
  // 1_005_000 USDC units, lot 10_000 units -> 1 cent: 100 cents, remainder 5_000; fee 50.
  return {
    payoutQuoteId: 'po1',
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

  it('remainder equal to the source is a balance question, not a remainder one', () => {
    expect(checkPayoutQuote(srcReq, goodPayout({ remainder: cbsMinor(1_005_000n) }), P6)).toBe('conversion does not balance to the minor unit');
  });

  it('NET_EXACT: keeps the net exact and leaves no remainder', () => {
    const netReq: PayoutQuoteRequest = { ...srcReq, side: 'NET_EXACT', amount: cbsMinor(50n) };
    expect(checkPayoutQuote(netReq, goodPayout({ net: cbsMinor(49n) }), P6)).toBe('quote does not keep the net amount exact');
    expect(checkPayoutQuote(netReq, goodPayout(), P6)).toBe('a NET_EXACT quote must leave no remainder');
  });
});
