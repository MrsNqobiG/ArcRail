/**
 * Contract tests shared by the two FxPort fakes and the two PayoutQuotePort
 * fakes of JQUOTE: same behaviour, structurally different implementations.
 */
import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision } from '../../src/amounts/index.js';
import type { QuoteRequest } from '../../src/nova-ports/conversion.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { fiatCode, idempotencyKey, ledgerAssetCode } from '../../src/nova-ports/ids.js';
import { BandedFx, BandedPayoutQuotes, LotTableFx, LotTablePayoutQuotes, ManualClock } from '../../src/journey/quote/fakes.js';
import { checkFxLock, checkPayoutQuote } from '../../src/journey/quote/ports.js';
import type { FxLocker, PayoutQuotePort, PayoutQuoteRequest } from '../../src/journey/quote/ports.js';

const P2 = cbsPrecision(2);
const P6 = cbsPrecision(6);
const ZAR = ledgerAssetCode('ZAR');
const USDC = ledgerAssetCode('USDC');
const ZARF = fiatCode('ZAR');
const k1 = idempotencyKey('k:1');
const k2 = idempotencyKey('k:2');
const lot = { from: cbsMinor(37n), to: cbsMinor(20000n) };
const pair = { from: ZAR, fromPrec: P2, to: USDC, toPrec: P6 };

const fxMakers: [string, (clock: ManualClock, faults: FaultPlan) => FxLocker][] = [
  ['LotTableFx', (clock, faults) => new LotTableFx({ clock, pairs: [{ ...pair, lot }], ttlMs: 1000n, limit: cbsMinor(10_000_000n), faults })],
  ['BandedFx', (clock, faults) => new BandedFx({ clock, pairs: [{ ...pair, bands: [{ upTo: cbsMinor(10_000_000n), lot }] }], ttlMs: 1000n, faults })],
];

const req: QuoteRequest = { from: ZAR, to: USDC, amount: cbsMinor(10000n), side: 'FROM_EXACT' };

describe.each(fxMakers)('FxLocker double contract: %s', (_name, make) => {
  it('locks an exact rate that passes checkFxLock, expiring on the clock', async () => {
    const clock = new ManualClock(500n);
    const fx = make(clock, new FaultPlan());
    const r = await fx.lockRate(k1, req);
    if (r.kind !== 'OK') throw new Error('expected OK');
    expect(checkFxLock(req, r.value, P6)).toBeNull();
    expect(r.value.expiresAtMs).toBe(1500n);
    expect(r.value.quote.to.amount).toBe(5_400_000n);
    // R2 B1: the remainder (10 cents) is worth far more than one USDC unit, so the engine reports its effective rate with remainder 0.
    expect(r.value.quote.remainder).toBe(0n);
    expect(r.value.quote.rate).toEqual({ numerator: 5_400_000n, denominator: 10_000n });
    expect(r.value.quote.expiresAt).toBe('ms:1500');
    const to: QuoteRequest = { ...req, side: 'TO_EXACT', amount: cbsMinor(5_400_000n) };
    const t = await fx.lockRate(k2, to);
    if (t.kind !== 'OK') throw new Error('expected OK');
    expect(checkFxLock(to, t.value, P6)).toBeNull();
    expect(t.value.quote.from.amount).toBe(9990n);
  });

  it('replays the same key and request; refuses the same key with another request', async () => {
    const fx = make(new ManualClock(0n), new FaultPlan());
    const a = await fx.lockRate(k1, req);
    expect(await fx.lockRate(k1, req)).toEqual(a.kind === 'OK' ? { ...a, replayed: true } : a);
    expect(await fx.lockRate(k1, { ...req, amount: cbsMinor(37n) })).toEqual({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: 'key k:1 reused with another request' });
  });

  it('refuses unknown pairs, amounts above the limit and inexact TO_EXACT', async () => {
    const fx = make(new ManualClock(0n), new FaultPlan());
    expect((await fx.lockRate(k1, { ...req, to: ZAR, from: USDC })).kind).toBe('REJECTED');
    const lim = await fx.lockRate(k1, { ...req, amount: cbsMinor(10_000_001n) });
    expect(lim.kind === 'REJECTED' && lim.code).toBe('LIMIT');
    expect(await fx.lockRate(k1, { ...req, side: 'TO_EXACT', amount: cbsMinor(1n) })).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'amount does not convert exactly' });
  });

  it('injects AMBIGUOUS before and after commit; after commit the lock replays', async () => {
    const faults = new FaultPlan();
    const fx = make(new ManualClock(0n), faults);
    faults.arm('lockRate', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await fx.lockRate(k1, req)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    faults.arm('lockRate', 'AFTER_COMMIT', 'TRANSPORT');
    expect(await fx.lockRate(k1, req)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    const r = await fx.lockRate(k1, req);
    expect(r.kind === 'OK' && r.replayed).toBe(true);
  });
});

const price = { lot: { from: cbsMinor(20000n), to: cbsMinor(37n) }, fee: cbsMinor(100n) };
const payoutMakers: [string, (clock: ManualClock, faults: FaultPlan) => PayoutQuotePort][] = [
  ['LotTablePayoutQuotes', (clock, faults) => new LotTablePayoutQuotes({ clock, source: USDC, sourcePrecision: P6, prices: new Map([[ZARF, price]]), ttlMs: 700n, limit: cbsMinor(100_000_000n), faults })],
  ['BandedPayoutQuotes', (clock, faults) => new BandedPayoutQuotes({ clock, source: USDC, sourcePrecision: P6, bands: [{ currency: ZARF, upTo: cbsMinor(100_000_000n), price }], ttlMs: 700n, faults })],
];

const preq: PayoutQuoteRequest = { source: USDC, currency: ZARF, side: 'SOURCE_EXACT', amount: cbsMinor(5_410_000n) };

describe.each(payoutMakers)('PayoutQuotePort contract: %s', (_name, make) => {
  it('is labelled TEST_FAKE, never LIVE', () => {
    expect(make(new ManualClock(0n), new FaultPlan()).partnerKind).toBe('TEST_FAKE');
  });

  it('quotes SOURCE_EXACT and NET_EXACT exactly (checkPayoutQuote), expiring on the clock', async () => {
    const po = make(new ManualClock(100n), new FaultPlan());
    const s = await po.quotePayout(k1, preq);
    if (s.kind !== 'OK') throw new Error('expected OK');
    expect(checkPayoutQuote(preq, s.value, P6)).toBeNull();
    expect(s.value).toMatchObject({ sourceAsset: USDC, source: 5_410_000n, remainder: 0n, rate: { numerator: 9990n, denominator: 5_410_000n }, gross: 9990n, fee: 100n, net: 9890n, expiresAtMs: 800n });
    const nreq: PayoutQuoteRequest = { ...preq, side: 'NET_EXACT', amount: cbsMinor(9890n) };
    const n = await po.quotePayout(k2, nreq);
    if (n.kind !== 'OK') throw new Error('expected OK');
    expect(checkPayoutQuote(nreq, n.value, P6)).toBeNull();
    expect(n.value).toMatchObject({ source: 5_400_000n, remainder: 0n, gross: 9990n, net: 9890n });
  });

  it('replays, refuses key reuse, unknown routes, the limit, below-minimum and inexact NET_EXACT', async () => {
    const po = make(new ManualClock(0n), new FaultPlan());
    const a = await po.quotePayout(k1, preq);
    expect(await po.quotePayout(k1, preq)).toEqual(a.kind === 'OK' ? { ...a, replayed: true } : a);
    expect(await po.quotePayout(k1, { ...preq, amount: cbsMinor(1n) })).toEqual({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: 'key k:1 reused with another request' });
    expect(await po.quotePayout(k2, { ...preq, currency: fiatCode('USD') })).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'USDC->USD' });
    expect(await po.quotePayout(k2, { ...preq, source: ZAR })).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'ZAR->ZAR' });
    const lim = await po.quotePayout(k2, { ...preq, amount: cbsMinor(100_000_001n) });
    expect(lim.kind === 'REJECTED' && lim.code).toBe('LIMIT');
    expect(await po.quotePayout(k2, { ...preq, amount: cbsMinor(40_000n) })).toEqual({ kind: 'REJECTED', code: 'BELOW_MINIMUM', detail: '40000 does not cover the fee' });
    expect(await po.quotePayout(k2, { ...preq, amount: cbsMinor(1n) })).toEqual({ kind: 'REJECTED', code: 'BELOW_MINIMUM', detail: '1 does not cover the fee' });
    expect(await po.quotePayout(k2, { ...preq, side: 'NET_EXACT', amount: cbsMinor(1n) })).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'net plus fee does not convert exactly' });
  });

  it('injects AMBIGUOUS before and after commit; after commit the quote replays', async () => {
    const faults = new FaultPlan();
    const po = make(new ManualClock(0n), faults);
    faults.arm('quotePayout', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await po.quotePayout(k1, preq)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    faults.arm('quotePayout', 'AFTER_COMMIT', 'UNAVAILABLE');
    expect(await po.quotePayout(k1, preq)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
    const r = await po.quotePayout(k1, preq);
    expect(r.kind === 'OK' && r.replayed).toBe(true);
  });
});

describe('ManualClock', () => {
  it('moves only when advanced', () => {
    const c = new ManualClock(10n);
    expect(c.nowMs()).toBe(10n);
    c.advance(5n);
    expect(c.nowMs()).toBe(15n);
  });
});

describe('payout fakes keep a remainder only when it is worth less than one payout unit (R2 B1)', () => {
  const cents = { lot: { from: cbsMinor(10000n), to: cbsMinor(1n) }, fee: cbsMinor(50n) };
  const usd = fiatCode('USD');
  const req: PayoutQuoteRequest = { source: USDC, currency: usd, side: 'SOURCE_EXACT', amount: cbsMinor(1_005_000n) };
  it.each([
    ['LotTablePayoutQuotes', (clock: ManualClock): PayoutQuotePort => new LotTablePayoutQuotes({ clock, source: USDC, sourcePrecision: P6, prices: new Map([[usd, cents]]), ttlMs: 700n, limit: cbsMinor(100_000_000n) })],
    ['BandedPayoutQuotes', (clock: ManualClock): PayoutQuotePort => new BandedPayoutQuotes({ clock, source: USDC, sourcePrecision: P6, bands: [{ currency: usd, upTo: cbsMinor(100_000_000n), price: cents }], ttlMs: 700n })],
  ])('%s: 1 cent per 10_000 units keeps the 5_000-unit remainder (worth half a cent)', async (_n, make) => {
    const r = await make(new ManualClock(0n)).quotePayout(k1, req);
    if (r.kind !== 'OK') throw new Error('expected OK');
    expect(checkPayoutQuote(req, r.value, P6)).toBeNull();
    expect(r.value).toMatchObject({ remainder: 5_000n, rate: { numerator: 1n, denominator: 10_000n }, gross: 100n });
  });
});
