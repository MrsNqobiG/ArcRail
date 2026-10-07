/**
 * PORTS unit: ConversionPort contract suite (docs/NOVA_ARC_DESIGN.md §4.1,
 * §7.5, §7.8). The payer may pick fiat; Nova's engine converts it (CONVERT_IN).
 * Runs unchanged against both fakes; Nova's adapter must pass it too [A-34].
 * Every quote is re-checked with checkQuote: integer ratio, nothing lost.
 */
import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision } from '../../src/amounts/index.js';
import type { CbsMinor } from '../../src/amounts/index.js';
import { checkQuote } from '../../src/nova-ports/conversion.js';
import type { ConversionPort, Quote, QuoteRequest } from '../../src/nova-ports/conversion.js';
import { exactConvert, FixedRateConversion, LadderConversion, lotRate } from '../../src/nova-ports/fakes/conversion-fakes.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { idempotencyKey, ledgerAssetCode } from '../../src/nova-ports/ids.js';
import type { PortResult } from '../../src/nova-ports/ids.js';

const ZAR = ledgerAssetCode('ZAR');
const USDC = ledgerAssetCode('USDC');
const EUR = ledgerAssetCode('EUR');
const pair = { from: ZAR, fromPrecision: cbsPrecision(2), to: USDC, toPrecision: cbsPrecision(6) };
/** 18.50 ZAR per USDC: one lot of 1850 ZAR cents buys exactly 1_000_000 USDC minor units. */
const LOT = { from: cbsMinor(1850n), to: cbsMinor(1_000_000n) };
const RATE = lotRate(LOT);
const LOT2 = { from: cbsMinor(1850n), to: cbsMinor(999_500n) };
const TTL = 5n;

interface Clocked extends ConversionPort {
  advance(ticks: bigint): void;
}
type Factory = (faults?: FaultPlan, available?: CbsMinor | null) => Clocked;
const FACTORIES: readonly (readonly [string, Factory])[] = [
  ['FixedRateConversion', (faults, available = null) => new FixedRateConversion({ pairs: [{ ...pair, lot: LOT }], ttlTicks: TTL, limit: cbsMinor(10_000_000n), available, ...(faults ? { faults } : {}) })],
  [
    'LadderConversion',
    (faults, available = null) =>
      new LadderConversion({
        pairs: [{ ...pair, bands: [{ upTo: cbsMinor(1_000_000n), lot: LOT }, { upTo: cbsMinor(10_000_000n), lot: LOT2 }] }],
        ttlTicks: TTL,
        available,
        ...(faults ? { faults } : {}),
      }),
  ],
];

const req = (amount: bigint, side: QuoteRequest['side'] = 'FROM_EXACT', over: Partial<QuoteRequest> = {}): QuoteRequest => ({ from: ZAR, to: USDC, amount: cbsMinor(amount), side, ...over });
const K = idempotencyKey('conv:q1');

function okValue<T>(r: PortResult<T, string>, replayed = false): T {
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${r.kind} ${r.kind === 'REJECTED' ? r.code : r.cause}`);
  expect(r.replayed).toBe(replayed);
  return r.value;
}

describe.each(FACTORIES)('ConversionPort contract: %s', (_name, make) => {
  it('FROM_EXACT keeps the from amount, converts exactly and returns the rest as remainder (never dropped)', async () => {
    const c = make();
    const a = okValue(await c.quote(K, req(1850n)));
    expect(a).toMatchObject({ from: { asset: ZAR, amount: 1850n, precision: 2 }, to: { asset: USDC, amount: 1_000_000n, precision: 6 }, remainder: 0n, rate: RATE });
    expect(checkQuote(req(1850n), a)).toBeNull();
    const b = okValue(await c.quote(idempotencyKey('conv:q2'), req(1851n)));
    expect(b).toMatchObject({ to: { amount: 1_000_000n }, remainder: 1n });
    expect(checkQuote(req(1851n), b)).toBeNull();
  });

  it('TO_EXACT keeps the to amount when it is exactly reachable; otherwise NO_ROUTE', async () => {
    const c = make();
    const q = okValue(await c.quote(K, req(1_000_000n, 'TO_EXACT')));
    expect(q).toMatchObject({ from: { amount: 1850n }, to: { amount: 1_000_000n }, remainder: 0n });
    expect(checkQuote(req(1_000_000n, 'TO_EXACT'), q)).toBeNull();
    expect(await c.quote(idempotencyKey('conv:q2'), req(1_000_001n, 'TO_EXACT'))).toMatchObject({ kind: 'REJECTED', code: 'NO_ROUTE', detail: /exactly/ });
  });

  it('nothing to convert, an unknown pair, or an amount above the limit is refused', async () => {
    const c = make();
    expect(await c.quote(K, req(36n))).toMatchObject({ kind: 'REJECTED', code: 'NO_ROUTE' });
    expect(await c.quote(K, req(0n, 'TO_EXACT'))).toMatchObject({ kind: 'REJECTED', code: 'NO_ROUTE' });
    expect(await c.quote(K, req(1850n, 'FROM_EXACT', { from: EUR }))).toMatchObject({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'EUR->USDC' });
    expect(await c.quote(K, req(10_000_001n))).toMatchObject({ kind: 'REJECTED', code: 'LIMIT' });
  });

  it('exactly once: same key and request replays; same key, another request is KEY_CONFLICT', async () => {
    const c = make();
    const q = okValue(await c.quote(K, req(1850n)));
    expect(await c.quote(K, req(1850n))).toEqual({ kind: 'OK', value: q, replayed: true });
    expect(await c.quote(K, req(3700n))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
  });

  it('execute consumes a live quote once; a replay returns the same execution; the state is readable', async () => {
    const c = make();
    const q = okValue(await c.quote(K, req(1850n)));
    const e = okValue(await c.execute(idempotencyKey('conv:x1'), q.quoteId));
    expect(['SETTLED', 'PENDING']).toContain(e.state);
    expect(e.journalIds.length).toBeGreaterThan(0);
    expect(await c.execute(idempotencyKey('conv:x1'), q.quoteId)).toEqual({ kind: 'OK', value: e, replayed: true });
    expect(await c.execute(idempotencyKey('conv:x2'), q.quoteId)).toMatchObject({ kind: 'REJECTED', code: 'QUOTE_EXPIRED' });
    const q2 = okValue(await c.quote(idempotencyKey('conv:q2'), req(3700n)));
    expect(await c.execute(idempotencyKey('conv:x1'), q2.quoteId)).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    expect(okValue(await c.get(e.conversionId)).state).toBe(e.state);
    expect(await c.get('nope')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    expect(await c.execute(idempotencyKey('conv:x3'), 'no-such-quote')).toMatchObject({ kind: 'REJECTED', code: 'QUOTE_EXPIRED' });
  });

  it('a quote expires on the clock: live at its expiry tick, QUOTE_EXPIRED after it', async () => {
    const c = make();
    const q = okValue(await c.quote(K, req(1850n)));
    const q2 = okValue(await c.quote(idempotencyKey('conv:q2'), req(3700n)));
    c.advance(TTL);
    okValue(await c.execute(idempotencyKey('conv:x1'), q.quoteId));
    c.advance(1n);
    expect(await c.execute(idempotencyKey('conv:x2'), q2.quoteId)).toMatchObject({ kind: 'REJECTED', code: 'QUOTE_EXPIRED' });
  });

  it('INSUFFICIENT_FUNDS once the from-asset budget is spent', async () => {
    const c = make(undefined, cbsMinor(3000n));
    const q1 = okValue(await c.quote(K, req(1850n)));
    const q2 = okValue(await c.quote(idempotencyKey('conv:q2'), req(1850n)));
    okValue(await c.execute(idempotencyKey('conv:x1'), q1.quoteId));
    expect(await c.execute(idempotencyKey('conv:x2'), q2.quoteId)).toMatchObject({ kind: 'REJECTED', code: 'INSUFFICIENT_FUNDS', detail: '1850 > 1150' });
  });

  it('AMBIGUOUS before and after commit on quote and execute, and before a read', async () => {
    const f = new FaultPlan();
    const c = make(f);
    f.arm('quote', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await c.quote(K, req(1850n))).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    f.arm('quote', 'AFTER_COMMIT', 'TIMEOUT');
    expect(await c.quote(K, req(1850n))).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    const q = okValue(await c.quote(K, req(1850n)), true);
    f.arm('execute', 'BEFORE_COMMIT', 'TRANSPORT');
    expect(await c.execute(idempotencyKey('conv:x1'), q.quoteId)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    f.arm('execute', 'AFTER_COMMIT', 'TRANSPORT');
    expect(await c.execute(idempotencyKey('conv:x1'), q.quoteId)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    const e = okValue(await c.execute(idempotencyKey('conv:x1'), q.quoteId), true);
    f.arm('get', 'BEFORE_COMMIT', 'UNAVAILABLE');
    expect(await c.get(e.conversionId)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
  });
});

describe('fake-specific behaviour', () => {
  it('FixedRateConversion settles at once; LadderConversion stays PENDING until the engine finishes', async () => {
    const fixed = FACTORIES[0]![1]();
    const q = okValue(await fixed.quote(K, req(1850n)));
    expect(okValue(await fixed.execute(idempotencyKey('conv:x1'), q.quoteId)).state).toBe('SETTLED');
    const ladder = new LadderConversion({ pairs: [{ ...pair, bands: [{ upTo: cbsMinor(1_000_000n), lot: LOT }, { upTo: cbsMinor(10_000_000n), lot: LOT2 }] }], ttlTicks: TTL, available: null });
    const lq = okValue(await ladder.quote(K, req(1850n)));
    const e = okValue(await ladder.execute(idempotencyKey('conv:x1'), lq.quoteId));
    expect(e.state).toBe('PENDING');
    ladder.settle(e.conversionId, 'FAILED');
    expect(okValue(await ladder.get(e.conversionId)).state).toBe('FAILED');
    const big = okValue(await ladder.quote(idempotencyKey('conv:big'), req(3_700_000n)));
    expect(big.rate).toEqual({ numerator: 999_500n, denominator: 1850n });
    expect(big.to.amount).toBe(2000n * 999_500n);
    expect(checkQuote(req(3_700_000n), big)).toBeNull();
  });
});

describe('checkQuote (fail closed on any quote that is not exact)', () => {
  const good = (): Quote => ({ quoteId: 'q', from: { asset: ZAR, amount: cbsMinor(1851n), precision: cbsPrecision(2) }, to: { asset: USDC, amount: cbsMinor(1_000_000n), precision: cbsPrecision(6) }, rate: RATE, remainder: cbsMinor(1n), expiresAt: 't', provider: 'p' });
  it.each([
    ['zero numerator', { rate: { numerator: 0n, denominator: 1850n } }, /positive integers/],
    ['zero denominator', { rate: { numerator: 1n, denominator: 0n } }, /positive integers/],
    ['another pair', { to: { asset: EUR, amount: cbsMinor(1_000_000n), precision: cbsPrecision(6) } }, /another pair/],
    ['another from asset', { from: { asset: EUR, amount: cbsMinor(1851n), precision: cbsPrecision(2) } }, /another pair/],
    ['from amount changed', { from: { asset: ZAR, amount: cbsMinor(1852n), precision: cbsPrecision(2) } }, /from amount exact/],
    ['nothing converts', { to: { asset: USDC, amount: cbsMinor(0n), precision: cbsPrecision(6) } }, /nothing converts/],
    ['remainder above amount', { remainder: cbsMinor(1852n) }, /remainder exceeds/],
    ['one minor unit off', { to: { asset: USDC, amount: cbsMinor(1_000_001n), precision: cbsPrecision(6) } }, /does not balance/],
    ['remainder dropped', { remainder: cbsMinor(0n) }, /does not balance/],
  ] as const)('%s', (_n, over, why) => {
    expect(checkQuote(req(1851n), { ...good(), ...over } as Quote)).toMatch(why);
  });
  it('TO_EXACT keeps the to amount', () => {
    expect(checkQuote(req(1_000_000n, 'TO_EXACT'), good())).toBeNull();
    expect(checkQuote(req(999_999n, 'TO_EXACT'), good())).toMatch(/to amount exact/);
  });
  it('exactConvert never loses a unit: (from − remainder)·n = to·d, remainder below one lot', () => {
    for (let a = 1800n; a < 6000n; a += 7n) {
      const c = exactConvert(cbsMinor(a), LOT, 'FROM_EXACT');
      if (c === null) {
        expect(a).toBeLessThan(1850n);
        continue;
      }
      expect((c.from - c.remainder) * RATE.numerator).toBe(c.to * RATE.denominator);
      expect(c.remainder).toBeLessThan(1850n);
      expect(checkQuote(req(a), { quoteId: 'q', from: { asset: ZAR, amount: c.from, precision: cbsPrecision(2) }, to: { asset: USDC, amount: c.to, precision: cbsPrecision(6) }, rate: RATE, remainder: c.remainder, expiresAt: 't', provider: 'p' })).toBeNull();
    }
  });
});
