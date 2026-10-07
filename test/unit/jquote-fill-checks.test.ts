/**
 * JQUOTE D-1 pure checks (src/journey/quote/ports.ts): the code's quote at the
 * code's own rate, the FILLED shape, checks 2-3 (terms, rate by
 * cross-multiplication), check 4 (booked-entry read-back) and check 5
 * (expiry by Nova's fill time). Values are reconstructed by hand in comments.
 */
import { describe, expect, it } from 'vitest';
import { CBS_MINOR_MAX, cbsMinor, cbsPrecision } from '../../src/amounts/index.js';
import type { QuoteRequest } from '../../src/nova-ports/conversion.js';
import { ledgerAssetCode, novaAccountRef } from '../../src/nova-ports/ids.js';
import type { LedgerAccount } from '../../src/nova-ports/ledger.js';
import { honestEntry } from '../../src/journey/quote/fakes.js';
import {
  bookedEntryProblem,
  checkFxLock,
  fillEventProblem,
  filledInTime,
  fillTermsProblem,
  isFxRef,
  isPositiveRatio,
  quoteAtCodeRate,
} from '../../src/journey/quote/ports.js';
import type { BookedEntry, FilledEvent, FillAccounts, PricingCode } from '../../src/journey/quote/ports.js';

const ZAR = ledgerAssetCode('ZAR');
const USDC = ledgerAssetCode('USDC');
const P2 = cbsPrecision(2);
const P6 = cbsPrecision(6);
const MAX = CBS_MINOR_MAX;

const code = (numerator: bigint, denominator: bigint, codeId = 'code-1'): PricingCode => ({ codeId, rate: { numerator, denominator }, expiresAt: 'ms:300000' });
const from = (amount: bigint): QuoteRequest => ({ from: ZAR, to: USDC, amount: cbsMinor(amount), side: 'FROM_EXACT' });
const to = (amount: bigint): QuoteRequest => ({ from: ZAR, to: USDC, amount: cbsMinor(amount), side: 'TO_EXACT' });

describe('quoteAtCodeRate: whole lots of the code rate as given, U1 add/subtract only', () => {
  it('FROM_EXACT 99,999 cents at 5000/9: 11,111 lots -> 55,555,000 micro-USDC, remainder 0 (passes checkFxLock)', () => {
    const q = quoteAtCodeRate(from(99_999n), code(5000n, 9n), P2, P6);
    expect(q).toEqual({
      quoteId: 'code-1',
      from: { asset: ZAR, amount: 99_999n, precision: P2 },
      to: { asset: USDC, amount: 55_555_000n, precision: P6 },
      rate: { numerator: 5000n, denominator: 9n },
      remainder: 0n,
      expiresAt: 'ms:300000',
      provider: 'otc-code',
    });
    expect(checkFxLock(from(99_999n), { quote: q!, expiresAtMs: 1n }, P6)).toBeNull();
  });

  it('keeps the rate unreduced: 99,999 at 10000/18 is 5,555 lots of 18 -> 55,550,000, remainder 9 (worth 5,000 units: checkFxLock refuses it)', () => {
    const q = quoteAtCodeRate(from(99_999n), code(10_000n, 18n), P2, P6);
    expect(q).toMatchObject({ from: { amount: 99_999n }, to: { amount: 55_550_000n }, remainder: 9n, rate: { numerator: 10_000n, denominator: 18n } });
    expect(checkFxLock(from(99_999n), { quote: q!, expiresAtMs: 1n }, P6)).toBe('remainder is worth one target minor unit or more');
  });

  it('FROM_EXACT 100,000 at 5000/9 leaves 1 cent (11,111 lots); a lot of exactly the amount converts once; less than a lot converts nothing', () => {
    expect(quoteAtCodeRate(from(100_000n), code(5000n, 9n), P2, P6)).toMatchObject({ from: { amount: 100_000n }, to: { amount: 55_555_000n }, remainder: 1n });
    expect(quoteAtCodeRate(from(9n), code(5000n, 9n), P2, P6)).toMatchObject({ from: { amount: 9n }, to: { amount: 5000n }, remainder: 0n });
    expect(quoteAtCodeRate(from(8n), code(5000n, 9n), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(from(17n), code(5000n, 9n), P2, P6)).toMatchObject({ from: { amount: 17n }, to: { amount: 5000n }, remainder: 8n });
    expect(quoteAtCodeRate(from(18n), code(5000n, 9n), P2, P6)).toMatchObject({ to: { amount: 10_000n }, remainder: 0n });
  });

  it('TO_EXACT needs whole lots of the to side and leaves no remainder', () => {
    expect(quoteAtCodeRate(to(55_555_000n), code(5000n, 9n), P2, P6)).toMatchObject({ from: { amount: 99_999n }, to: { amount: 55_555_000n }, remainder: 0n });
    expect(quoteAtCodeRate(to(5000n), code(5000n, 9n), P2, P6)).toMatchObject({ from: { amount: 9n }, to: { amount: 5000n }, remainder: 0n });
    expect(quoteAtCodeRate(to(55_555_001n), code(5000n, 9n), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(to(4999n), code(5000n, 9n), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(to(10_000n), code(5000n, 9n), P2, P6)).toMatchObject({ from: { amount: 18n } });
  });

  it('is fast and exact for large amounts (binary long division, not one step per lot)', () => {
    const q = quoteAtCodeRate(from(1_000_000_000_000_007n), code(3n, 2n), P2, P6);
    expect(q).toMatchObject({ to: { amount: 1_500_000_000_000_009n }, remainder: 1n });
    const t = quoteAtCodeRate(to(3_000_000_000_000_000n), code(3n, 2n), P2, P6);
    expect(t).toMatchObject({ from: { amount: 2_000_000_000_000_000n }, remainder: 0n });
  });

  it('refuses a malformed code: no usable id, a rate that is not a ratio of positive integers, or a rate above CBS_MINOR_MAX', () => {
    expect(quoteAtCodeRate(from(99_999n), code(5000n, 9n, ''), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(from(99_999n), code(5000n, 9n, 'code 1'), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(from(99_999n), code(0n, 9n), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(from(99_999n), code(5000n, 0n), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(from(99_999n), code(-5000n, 9n), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(from(99_999n), code(MAX + 1n, 9n), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(from(MAX), code(1n, MAX + 1n), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(from(MAX), code(1n, MAX), P2, P6)).toMatchObject({ to: { amount: 1n }, remainder: 0n });
    expect(quoteAtCodeRate(from(5n), code(MAX, 1n), P2, P6)).toBeNull();
    // The bounds are inclusive: a rate term of exactly CBS_MINOR_MAX, and a result of exactly CBS_MINOR_MAX, are representable.
    expect(quoteAtCodeRate(from(1n), code(MAX, 1n), P2, P6)).toMatchObject({ to: { amount: MAX } });
    expect(quoteAtCodeRate(from(7n), code(MAX / 7n, 1n), P2, P6)).toMatchObject({ to: { amount: MAX }, remainder: 0n });
    expect(quoteAtCodeRate(to(7n), code(1n, MAX / 7n), P2, P6)).toMatchObject({ from: { amount: MAX } });
  });

  it('refuses a result that would pass CBS_MINOR_MAX (doubling or summing), never throws', () => {
    // lot 1 -> MAX: doubling the to side overflows.
    expect(quoteAtCodeRate(from(2n), code(MAX, 1n), P2, P6)).toBeNull();
    // lot 1 -> 2^62 - 1: 2 lots fit, 3 lots do not.
    const t = 2n ** 62n - 1n;
    expect(quoteAtCodeRate(from(2n), code(t, 1n), P2, P6)).toMatchObject({ to: { amount: 2n * t } });
    expect(quoteAtCodeRate(from(3n), code(t, 1n), P2, P6)).toBeNull();
    // the from side doubling overflows on TO_EXACT: lot MAX -> 1, two lots wanted.
    expect(quoteAtCodeRate(to(2n), code(1n, MAX), P2, P6)).toBeNull();
    // the from side sum overflows on TO_EXACT: lot 2^62 - 1 -> 1, three lots wanted.
    expect(quoteAtCodeRate(to(3n), code(1n, t), P2, P6)).toBeNull();
    expect(quoteAtCodeRate(to(2n), code(1n, t), P2, P6)).toMatchObject({ from: { amount: 2n * t } });
  });
});

describe('isFxRef and isPositiveRatio', () => {
  it.each([
    ['a', true],
    ['x'.repeat(255), true],
    ['x'.repeat(256), false],
    ['', false],
    ['a b', false],
    [7n, false],
  ])('isFxRef(%s) = %s', (s, want) => {
    expect(isFxRef(s)).toBe(want);
  });

  it('a ratio of positive bigints only', () => {
    expect(isPositiveRatio({ numerator: 1n, denominator: 1n })).toBe(true);
    expect(isPositiveRatio({ numerator: 0n, denominator: 1n })).toBe(false);
    expect(isPositiveRatio({ numerator: 1n, denominator: 0n })).toBe(false);
    expect(isPositiveRatio({ numerator: 1 as unknown as bigint, denominator: 1n })).toBe(false);
    expect(isPositiveRatio({ numerator: 1n, denominator: 1 as unknown as bigint })).toBe(false);
  });
});

const filled = (over: Partial<FilledEvent> = {}): FilledEvent => ({
  kind: 'FILLED',
  codeId: 'code-1',
  from: ZAR,
  to: USDC,
  fromAmount: cbsMinor(99_999n),
  toAmount: cbsMinor(55_555_000n),
  rate: { numerator: 5000n, denominator: 9n },
  remainder: cbsMinor(0n),
  bookedEntryRef: 'je-1',
  filledAtMs: 299_999n,
  reviewer: 'desk-reviewer-1',
  ...over,
});

describe('fillEventProblem: the shape D-1 requires', () => {
  it('accepts a FILLED, REJECTED or EXPIRED event', () => {
    expect(fillEventProblem(filled())).toBeNull();
    expect(fillEventProblem(filled({ remainder: cbsMinor(99_999n) }))).toBeNull();
    expect(fillEventProblem(filled({ filledAtMs: 0n }))).toBeNull();
    expect(fillEventProblem({ kind: 'REJECTED', codeId: 'code-1' })).toBeNull();
    expect(fillEventProblem({ kind: 'EXPIRED', codeId: 'code-1' })).toBeNull();
  });

  it.each([
    ['codeId malformed', { codeId: 'a b' }],
    ['pair malformed', { from: '' }],
    ['pair malformed', { to: 'U S' }],
    ['amounts must be bigints', { fromAmount: 1 }],
    ['amounts must be bigints', { toAmount: '1' }],
    ['amounts must be bigints', { remainder: 0 }],
    ['amounts out of range', { fromAmount: 0n }],
    ['amounts out of range', { toAmount: 0n }],
    ['amounts out of range', { remainder: -1n }],
    ['amounts out of range', { remainder: 100_000n }],
    ['rate must be a ratio of positive integers', { rate: { numerator: 0n, denominator: 9n } }],
    ['bookedEntryRef malformed', { bookedEntryRef: '' }],
    ['filledAt malformed', { filledAtMs: -1n }],
    ['filledAt malformed', { filledAtMs: 5 }],
    ['reviewer malformed', { reviewer: '' }],
  ])('refuses: %s', (why, over) => {
    expect(fillEventProblem(filled(over as Partial<FilledEvent>))).toBe(why);
  });

  it('refuses an unknown kind and a malformed REJECTED code id', () => {
    expect(fillEventProblem({ ...filled(), kind: 'PAID' } as unknown as FilledEvent)).toBe('unknown event kind');
    expect(fillEventProblem({ kind: 'REJECTED', codeId: '' })).toBe('codeId malformed');
  });
});

describe('fillTermsProblem (checks 2 and 3) and filledInTime (check 5)', () => {
  const q = quoteAtCodeRate(from(99_999n), code(5000n, 9n), P2, P6)!;

  it('accepts the code quote exactly, and an equivalent rate (10000/18 == 5000/9 by cross-multiplication)', () => {
    expect(fillTermsProblem(q, filled())).toBeNull();
    expect(fillTermsProblem(q, filled({ rate: { numerator: 10_000n, denominator: 18n } }))).toBeNull();
  });

  it('refuses another pair', () => {
    expect(fillTermsProblem(q, filled({ from: ledgerAssetCode('EUR') }))).toBe('PAIR_MISMATCH');
    expect(fillTermsProblem(q, filled({ to: ledgerAssetCode('EURC') }))).toBe('PAIR_MISMATCH');
  });

  it('refuses any amount that differs from the quote (M1 at 550/1: 99,999 -> 54,999,450 is self-consistent but refused)', () => {
    expect(fillTermsProblem(q, filled({ rate: { numerator: 550n, denominator: 1n }, toAmount: cbsMinor(54_999_450n) }))).toBe('AMOUNT_MISMATCH');
    expect(fillTermsProblem(q, filled({ fromAmount: cbsMinor(100_008n) }))).toBe('AMOUNT_MISMATCH');
    expect(fillTermsProblem(q, filled({ toAmount: cbsMinor(55_555_001n) }))).toBe('AMOUNT_MISMATCH');
    expect(fillTermsProblem(q, filled({ remainder: cbsMinor(1n) }))).toBe('AMOUNT_MISMATCH');
  });

  it('refuses another rate even with the quote amounts (check 3 is needed on its own)', () => {
    expect(fillTermsProblem(q, filled({ rate: { numerator: 550n, denominator: 1n } }))).toBe('RATE_MISMATCH');
    expect(fillTermsProblem(q, filled({ rate: { numerator: 5001n, denominator: 9n } }))).toBe('RATE_MISMATCH');
    expect(fillTermsProblem(q, filled({ rate: { numerator: 5000n, denominator: 10n } }))).toBe('RATE_MISMATCH');
  });

  it('live strictly before expiry by filledAt: just before, at and after 300,000', () => {
    expect(filledInTime(filled({ filledAtMs: 299_999n }), 300_000n)).toBe(true);
    expect(filledInTime(filled({ filledAtMs: 300_000n }), 300_000n)).toBe(false);
    expect(filledInTime(filled({ filledAtMs: 300_001n }), 300_000n)).toBe(false);
  });
});

describe('bookedEntryProblem (check 4, read-back)', () => {
  const client: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acc-client-zar') };
  const other: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acc-other-zar') };
  const toAcc: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acc-client-usdc') };
  const dust: LedgerAccount = { kind: 'ROLE', role: 'GL-4', sub: 'fxDust' };
  const deskFrom: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'otcDeskZar' };
  const deskTo: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'otcDeskUsdc' };
  const accounts: FillAccounts = { clientFrom: client, to: toAcc, dust };
  const all = { clientFrom: client, to: toAcc, dust, deskFrom, deskTo };
  const f = filled();
  const withDust = filled({ fromAmount: cbsMinor(100_000n), remainder: cbsMinor(1n) });

  it('accepts the honest entry, with and without dust', () => {
    expect(bookedEntryProblem(honestEntry(f, all), f, accounts)).toBeNull();
    expect(bookedEntryProblem(honestEntry(withDust, all), withDust, accounts)).toBeNull();
  });

  const tamper = (e: BookedEntry, j: 0 | 1, legs: BookedEntry['journals'][number]['legs']): BookedEntry => ({ ...e, journals: e.journals.map((x, i) => (i === j ? { ...x, legs } : x)) });
  const H = honestEntry(f, all);
  const fromLegs = H.journals[0]!.legs;
  const toLegs = H.journals[1]!.legs;

  it.each<[string, BookedEntry, FilledEvent]>([
    ['read-back is for another entry', { ...H, bookedEntryRef: 'je-2' }, f],
    ['journal je-1-from is in another asset', { ...H, journals: [{ ...H.journals[0]!, asset: ledgerAssetCode('EUR') }, H.journals[1]!] }, f],
    ['journal je-1-to has fewer than two legs', tamper(H, 1, [toLegs[0]!]), f],
    ['journal je-1-from has a leg that is not positive', tamper(H, 0, [...fromLegs, { account: deskFrom, side: 'CREDIT', amount: cbsMinor(0n) }]), f],
    ['journal je-1-from has a leg that is not positive', tamper(H, 0, [{ ...fromLegs[0]!, amount: 5 as unknown as ReturnType<typeof cbsMinor> }, fromLegs[1]!]), f],
    ['journal je-1-from has a leg with no side', tamper(H, 0, [...fromLegs, { account: deskFrom, side: 'BOTH' as 'DEBIT', amount: cbsMinor(1n) }]), f],
    ['journal je-1-from does not balance', tamper(H, 0, [fromLegs[0]!, { ...fromLegs[1]!, amount: cbsMinor(99_998n) }]), f],
    ['journal je-1-to does not balance', tamper(H, 1, [toLegs[0]!, { ...toLegs[1]!, amount: cbsMinor(1n) }]), f],
    ['a side of the conversion is not booked', { ...H, journals: [H.journals[0]!] }, f],
    ['a side of the conversion is not booked', { ...H, journals: [H.journals[1]!] }, f],
    // M2: the client is over-debited while the to side equals the quote.
    ['client is not debited exactly the from amount', honestEntry(f, all, cbsMinor(100_008n)), f],
    ['client is not debited exactly the from amount', honestEntry(f, { ...all, clientFrom: other }), f],
    ['client is not debited exactly the from amount', tamper(H, 0, [...fromLegs, { account: client, side: 'CREDIT', amount: cbsMinor(1n) }, { account: deskFrom, side: 'DEBIT', amount: cbsMinor(1n) }]), f],
    ['to side is not credited exactly the to amount', honestEntry(f, { ...all, to: other }), f],
    ['to side is not credited exactly the to amount', tamper(H, 1, [...toLegs, { account: toAcc, side: 'DEBIT', amount: cbsMinor(1n) }, { account: deskTo, side: 'CREDIT', amount: cbsMinor(1n) }]), f],
    ['remainder is not posted exactly to the dust destination', honestEntry(withDust, { ...all, dust: deskFrom }), withDust],
    ['remainder is not posted exactly to the dust destination', tamper(H, 0, [...fromLegs, { account: dust, side: 'CREDIT', amount: cbsMinor(1n) }, { account: deskFrom, side: 'DEBIT', amount: cbsMinor(1n) }]), f],
    ['remainder is not posted exactly to the dust destination', tamper(H, 0, [...fromLegs, { account: dust, side: 'DEBIT', amount: cbsMinor(1n) }, { account: deskFrom, side: 'CREDIT', amount: cbsMinor(1n) }]), f],
  ])('refuses: %s', (why, entry, fill) => {
    expect(bookedEntryProblem(entry, fill, accounts)).toBe(why);
  });

  it('counts only the from asset for the client and the dust, only the to asset for the to side', () => {
    // The client's account also credited in the to asset does not change the from-side debit.
    const e = tamper(H, 1, [...toLegs, { account: client, side: 'CREDIT', amount: cbsMinor(3n) }, { account: deskTo, side: 'DEBIT', amount: cbsMinor(3n) }]);
    expect(bookedEntryProblem(e, f, accounts)).toBeNull();
    const e2 = tamper(H, 0, [...fromLegs, { account: toAcc, side: 'DEBIT', amount: cbsMinor(3n) }, { account: deskFrom, side: 'CREDIT', amount: cbsMinor(3n) }]);
    expect(bookedEntryProblem(e2, f, accounts)).toBeNull();
    const e3 = tamper(H, 1, [...toLegs, { account: dust, side: 'CREDIT', amount: cbsMinor(3n) }, { account: deskTo, side: 'DEBIT', amount: cbsMinor(3n) }]);
    expect(bookedEntryProblem(e3, f, accounts)).toBeNull();
    // ROLE accounts match on role and sub.
    expect(bookedEntryProblem(honestEntry(withDust, { ...all, dust: { kind: 'ROLE', role: 'GL-4', sub: 'other' } }), withDust, accounts)).toBe('remainder is not posted exactly to the dust destination');
    expect(bookedEntryProblem(honestEntry(withDust, { ...all, dust: { kind: 'ROLE', role: 'GL-5', sub: 'fxDust' } }), withDust, accounts)).toBe('remainder is not posted exactly to the dust destination');
    expect(bookedEntryProblem(honestEntry(f, { ...all, to: { kind: 'ROLE', role: 'GL-2', sub: 'otcDeskUsdc' } }), f, { ...accounts, to: { kind: 'CUSTOMER', account: novaAccountRef('otcDeskUsdc') } })).toBe('to side is not credited exactly the to amount');
  });
});
