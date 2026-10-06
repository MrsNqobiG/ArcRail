import { describe, expect, it } from 'vitest';
import { cbsMinor, nativeWei, usdcUnits } from '../../src/amounts/index.js';

const constructors = [
  ['CbsMinor', cbsMinor],
  ['UsdcUnits', usdcUnits],
  ['NativeWei', nativeWei],
] as const;

describe('branded amount constructors (U1, real in the skeleton)', () => {
  it.each(constructors)('%s keeps the exact bigint value', (_name, make) => {
    expect(make(0n)).toBe(0n);
    expect(make(1n)).toBe(1n);
    const big = 9_223_372_036_854_775_807_999_999_999_999n; // CONTRACT §6.1 largest row
    expect(make(big)).toBe(big);
    expect(typeof make(5n)).toBe('bigint');
  });

  it.each(constructors)('%s refuses a negative value', (name, make) => {
    expect(() => make(-1n)).toThrow(new RangeError(`${name} must not be negative`));
  });

  it.each(constructors)('%s refuses a non-bigint at runtime (number, string)', (name, make) => {
    expect(() => make(1 as unknown as bigint)).toThrow(new TypeError(`${name} requires a bigint, got number`));
    expect(() => make('1' as unknown as bigint)).toThrow(new TypeError(`${name} requires a bigint, got string`));
  });
});
