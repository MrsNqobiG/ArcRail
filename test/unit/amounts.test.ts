import { describe, expect, it } from 'vitest';
import { CBS_MINOR_MAX, CbsMinorOverflowError, cbsMinor, nativeWei, usdcUnits } from '../../src/amounts/index.js';

const constructors = [
  ['CbsMinor', cbsMinor],
  ['UsdcUnits', usdcUnits],
  ['NativeWei', nativeWei],
] as const;

describe('branded amount constructors (U1)', () => {
  it.each(constructors)('%s keeps the exact bigint value', (_name, make) => {
    expect(make(0n)).toBe(0n);
    expect(make(1n)).toBe(1n);
    expect(make(CBS_MINOR_MAX)).toBe(CBS_MINOR_MAX);
    expect(typeof make(5n)).toBe('bigint');
  });

  it.each([
    ['UsdcUnits', usdcUnits],
    ['NativeWei', nativeWei],
  ] as const)('%s is arbitrary-precision (CONTRACT §6): the largest §6.1 row and 2²⁵⁶ are kept', (_name, make) => {
    const big = 9_223_372_036_854_775_807_999_999_999_999n; // CONTRACT §6.1 largest row
    expect(make(big)).toBe(big);
    expect(make(2n ** 256n)).toBe(2n ** 256n);
  });

  it('CbsMinor is bounded by CBS_MINOR_MAX (CONTRACT §6 overflow guard)', () => {
    expect(() => cbsMinor(9_223_372_036_854_775_807_999_999_999_999n)).toThrow(CbsMinorOverflowError);
    expect(() => cbsMinor(CBS_MINOR_MAX + 1n)).toThrow(new CbsMinorOverflowError(CBS_MINOR_MAX + 1n));
  });

  it.each(constructors)('%s refuses a negative value', (name, make) => {
    expect(() => make(-1n)).toThrow(new RangeError(`${name} must not be negative`));
  });

  it.each(constructors)('%s refuses a non-bigint at runtime (number, string)', (name, make) => {
    expect(() => make(1 as unknown as bigint)).toThrow(new TypeError(`${name} requires a bigint, got number`));
    expect(() => make('1' as unknown as bigint)).toThrow(new TypeError(`${name} requires a bigint, got string`));
  });
});
