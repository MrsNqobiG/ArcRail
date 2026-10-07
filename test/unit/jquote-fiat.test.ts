import { describe, expect, it } from 'vitest';
import { CBS_MINOR_MAX, cbsMinor } from '../../src/amounts/index.js';
import { addFiat, fiatAmount, FiatCurrencyMismatchError, fiatFromLedger, fiatText, subtractFiat } from '../../src/journey/quote/fiat.js';
import type { FiatAmount } from '../../src/journey/quote/fiat.js';

describe('JQUOTE FiatMinor<CCY>', () => {
  it('builds a frozen amount with its currency', () => {
    const a = fiatAmount('ZAR', 12345n);
    expect(a).toEqual({ currency: 'ZAR', minor: 12345n });
    expect(Object.isFrozen(a)).toBe(true);
    expect(fiatAmount('ZAR', 0n).minor).toBe(0n);
    expect(fiatAmount('USD', CBS_MINOR_MAX).minor).toBe(CBS_MINOR_MAX);
  });

  it('refuses a malformed currency, a non-bigint, a negative and an overflow (fail closed)', () => {
    expect(() => fiatAmount('zar', 1n)).toThrow(new TypeError('invalid ISO 4217 code: "zar"'));
    expect(() => fiatAmount('ZARX', 1n)).toThrow(TypeError);
    expect(() => fiatAmount('XZAR', 1n)).toThrow(TypeError);
    expect(() => fiatAmount('', 1n)).toThrow(TypeError);
    expect(() => fiatAmount('ZAR', 1 as unknown as bigint)).toThrow(new TypeError('FiatMinor requires a bigint, got number'));
    expect(() => fiatAmount('ZAR', -1n)).toThrow(new RangeError('FiatMinor must not be negative'));
    expect(() => fiatAmount('ZAR', CBS_MINOR_MAX + 1n)).toThrow(new RangeError(`FiatMinor ${CBS_MINOR_MAX + 1n} exceeds CBS_MINOR_MAX: reject and PAUSE`));
  });

  it('views a ledger amount in its currency without scaling', () => {
    expect(fiatFromLedger('ZAR', cbsMinor(990n))).toEqual({ currency: 'ZAR', minor: 990n });
  });

  it('adds and subtracts in one currency only', () => {
    const a = fiatAmount('ZAR', 500n);
    const b = fiatAmount('ZAR', 200n);
    expect(addFiat(a, b)).toEqual({ currency: 'ZAR', minor: 700n });
    expect(subtractFiat(a, b)).toEqual({ currency: 'ZAR', minor: 300n });
    expect(subtractFiat(a, a).minor).toBe(0n);
    expect(() => subtractFiat(b, a)).toThrow(RangeError);
    const usd = fiatAmount('USD', 1n) as unknown as FiatAmount<'ZAR'>;
    expect(() => addFiat(a, usd)).toThrow(new FiatCurrencyMismatchError('ZAR', 'USD'));
    expect(() => subtractFiat(a, usd)).toThrow(FiatCurrencyMismatchError);
    const err = new FiatCurrencyMismatchError('ZAR', 'USD');
    expect(err.message).toBe('fiat currency mismatch: ZAR vs USD');
    expect(err.name).toBe('FiatCurrencyMismatchError');
    expect(err.code).toBe('FIAT_CURRENCY_MISMATCH');
  });

  it('prints canonical integer text', () => {
    expect(fiatText(fiatAmount('ZAR', 1050n))).toBe('ZAR:1050');
  });
});
