/**
 * U1 conversion module (CONTRACT §6) and asset registry: every CONTRACT §6.1
 * worked row, the overflow guard on every CbsMinor route, precision
 * validation, fail-closed re-checks of cast inputs, the display row, the
 * registry (address, decimals, status) and the same-unit helpers.
 */
import { describe, expect, it } from 'vitest';
import {
  ASSET_REGISTRY,
  AssetUnavailableError,
  CBS_MINOR_MAX,
  CbsMinorOverflowError,
  ROUNDING_POLICY,
  USDC_ERC20,
  USDC_NATIVE,
  addCbsMinor,
  addNativeWei,
  addUsdcUnits,
  assertAssetEnabled,
  assetForUnit,
  cbsMinor,
  cbsMinorToNativeWei,
  cbsPrecision,
  DISPLAY_MAX_PLACES,
  formatCbsMinor,
  formatNativeWei,
  formatUsdcUnits,
  nativeWei,
  nativeWeiToCbsMinor,
  nativeWeiToUsdcUnits,
  subtractCbsMinor,
  subtractNativeWei,
  subtractUsdcUnits,
  usdcUnits,
  usdcUnitsToNativeWei,
} from '../../src/amounts/index.js';
import type { AssetView, CbsMinor, CbsPrecision, NativeWei, UsdcUnits } from '../../src/amounts/index.js';

const P6 = cbsPrecision(6);
const P2 = cbsPrecision(2);

/** Run `fn` and return what it threw (or undefined). */
function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

// CONTRACT §6.1, transcribed digit for digit (w, m, dust).
const ROWS_P6: readonly (readonly [bigint, bigint, bigint, string])[] = [
  [0n, 0n, 0n, 'zero'],
  [1n, 0n, 1n, 'smallest unit'],
  [999_999_999_999n, 0n, 999_999_999_999n, 'k − 1'],
  [1_000_000_000_000n, 1n, 0n, 'k'],
  [1_000_000_000_000_000_000n, 1_000_000n, 0n, '1 USDC'],
  [1_000_000_500_000_000_000n, 1_000_000n, 500_000_000_000n, '1.0000005 USDC'],
  [420_000_000_000_000n, 420n, 0n, 'gas 21,000 × 20 gwei'],
  [7_374_356_000_000_000n, 7_374n, 356_000_000_000n, 'gas from live testnet tx'],
  [9_223_372_036_854_775_807_999_999_999_999n, 9_223_372_036_854_775_807n, 999_999_999_999n, 'largest w for a signed 64-bit m'],
];
const ROWS_P2: readonly (readonly [bigint, bigint, bigint, string])[] = [
  [1_000_000_000_000_000_000n, 100n, 0n, '1 USDC'],
  [15_000_000_000_000_000n, 1n, 5_000_000_000_000_000n, '0.015 USDC'],
  [9_999_999_999_999_999n, 0n, 9_999_999_999_999_999n, 'k − 1'],
  [7_374_356_000_000_000n, 0n, 7_374_356_000_000_000n, 'gas fee accrues entirely'],
];

describe('CONTRACT §6.1 worked rows, p = 6 (k = 10¹²)', () => {
  it.each(ROWS_P6)('w = %s → m = %s, dust = %s (%s)', (w, m, dust) => {
    expect(nativeWeiToCbsMinor(nativeWei(w), P6)).toEqual({ minor: m, dustWei: dust });
    expect(cbsMinorToNativeWei(cbsMinor(m), P6)).toBe(w - dust);
  });

  it('at p = 6 the CBS minor view equals the ERC-20 view (both 6 dp)', () => {
    for (const [w, m, dust] of ROWS_P6) expect(nativeWeiToUsdcUnits(nativeWei(w))).toEqual({ units: m, remainderWei: dust });
  });
});

describe('CONTRACT §6.1 worked rows, p = 2 (k = 10¹⁶)', () => {
  it.each(ROWS_P2)('w = %s → m = %s, dust = %s (%s)', (w, m, dust) => {
    expect(nativeWeiToCbsMinor(nativeWei(w), P2)).toEqual({ minor: m, dustWei: dust });
    expect(cbsMinorToNativeWei(cbsMinor(m), P2)).toBe(w - dust);
  });
});

describe('CONTRACT §6.1 NATIVE_WEI ↔ USDC_UNITS', () => {
  it('1,234,567,890,123,456,789 wei → 1,234,567 units, remainder 890,123,456,789 wei', () => {
    expect(nativeWeiToUsdcUnits(nativeWei(1_234_567_890_123_456_789n))).toEqual({ units: 1_234_567n, remainderWei: 890_123_456_789n });
  });

  it('1 unit = 1,000,000,000,000 wei', () => {
    expect(usdcUnitsToNativeWei(usdcUnits(1n))).toBe(1_000_000_000_000n);
    expect(usdcUnitsToNativeWei(usdcUnits(0n))).toBe(0n);
    expect(usdcUnitsToNativeWei(usdcUnits(1_234_567n))).toBe(1_234_567_000_000_000_000n);
  });

  it('the ERC-20 and native views are not bounded (they are not CBS amounts)', () => {
    const big = 2n ** 255n;
    expect(nativeWeiToUsdcUnits(nativeWei(big * 1_000_000_000_000n + 7n))).toEqual({ units: big, remainderWei: 7n });
    expect(usdcUnitsToNativeWei(usdcUnits(big))).toBe(big * 1_000_000_000_000n);
  });
});

describe('scale factor k = 10^(18 − p) at the precision boundaries', () => {
  it('p = 0: k = 10¹⁸', () => {
    const p0 = cbsPrecision(0);
    expect(nativeWeiToCbsMinor(nativeWei(2_999_999_999_999_999_999n), p0)).toEqual({ minor: 2n, dustWei: 999_999_999_999_999_999n });
    expect(cbsMinorToNativeWei(cbsMinor(3n), p0)).toBe(3_000_000_000_000_000_000n);
  });

  it('p = 18: k = 1, never any dust', () => {
    const p18 = cbsPrecision(18);
    expect(nativeWeiToCbsMinor(nativeWei(123_456_789n), p18)).toEqual({ minor: 123_456_789n, dustWei: 0n });
    expect(cbsMinorToNativeWei(cbsMinor(123_456_789n), p18)).toBe(123_456_789n);
  });

  it('p = 17: k = 10', () => {
    const p17 = cbsPrecision(17);
    expect(nativeWeiToCbsMinor(nativeWei(1_234n), p17)).toEqual({ minor: 123n, dustWei: 4n });
    expect(cbsMinorToNativeWei(cbsMinor(123n), p17)).toBe(1_230n);
  });
});

describe('overflow guard: no CbsMinor above the signed 64-bit maximum, by any route (CONTRACT §6)', () => {
  const overflow = new CbsMinorOverflowError(CBS_MINOR_MAX + 1n);

  it('CBS_MINOR_MAX is 2⁶³ − 1', () => {
    expect(CBS_MINOR_MAX).toBe(2n ** 63n - 1n);
  });

  it('the error carries code, minor, name and a PAUSE message, and is a RangeError', () => {
    const e = thrown(() => cbsMinor(2n ** 63n));
    expect(e).toBeInstanceOf(CbsMinorOverflowError);
    expect(e).toBeInstanceOf(RangeError);
    const err = e as CbsMinorOverflowError;
    expect(err.code).toBe('CBS_MINOR_OVERFLOW');
    expect(err.minor).toBe(2n ** 63n);
    expect(err.name).toBe('CbsMinorOverflowError');
    expect(err.message).toBe('CbsMinor 9223372036854775808 exceeds CBS_MINOR_MAX 9223372036854775807: reject and PAUSE');
  });

  it('constructor: CBS_MINOR_MAX is accepted, CBS_MINOR_MAX + 1 is refused', () => {
    expect(cbsMinor(CBS_MINOR_MAX)).toBe(CBS_MINOR_MAX);
    expect(() => cbsMinor(CBS_MINOR_MAX + 1n)).toThrow(overflow);
    expect(() => cbsMinor(2n ** 64n)).toThrow(CbsMinorOverflowError);
  });

  it('NATIVE_WEI → CBS_MINOR: m = CBS_MINOR_MAX passes, m = 2⁶³ is refused', () => {
    expect(nativeWeiToCbsMinor(nativeWei(CBS_MINOR_MAX), cbsPrecision(18))).toEqual({ minor: CBS_MINOR_MAX, dustWei: 0n });
    const e = thrown(() => nativeWeiToCbsMinor(nativeWei(9_223_372_036_854_775_808_000_000_000_000n), P6));
    expect(e).toBeInstanceOf(CbsMinorOverflowError);
    expect((e as CbsMinorOverflowError).minor).toBe(2n ** 63n);
  });

  it('at p = 18 the capacity is about 9.22 USDC (CONTRACT §6.1 "unusable")', () => {
    expect(() => nativeWeiToCbsMinor(nativeWei(10n ** 19n), cbsPrecision(18))).toThrow(CbsMinorOverflowError);
  });

  it('CBS_MINOR → NATIVE_WEI: MAX passes; a cast m above MAX is refused before it becomes wei', () => {
    expect(cbsMinorToNativeWei(cbsMinor(CBS_MINOR_MAX), P6)).toBe(9_223_372_036_854_775_807_000_000_000_000n);
    expect(() => cbsMinorToNativeWei((CBS_MINOR_MAX + 1n) as CbsMinor, P6)).toThrow(overflow);
  });

  it('addCbsMinor: a sum above MAX is refused (verifier D3), a sum equal to MAX passes', () => {
    expect(addCbsMinor(cbsMinor(CBS_MINOR_MAX - 1n), cbsMinor(1n))).toBe(CBS_MINOR_MAX);
    expect(() => addCbsMinor(cbsMinor(CBS_MINOR_MAX), cbsMinor(1n))).toThrow(overflow);
  });

  it('every CbsMinor input that bypassed the constructor by a cast is re-checked', () => {
    const tooBig = (CBS_MINOR_MAX + 1n) as CbsMinor;
    expect(() => addCbsMinor(tooBig, cbsMinor(0n))).toThrow(overflow);
    expect(() => addCbsMinor(cbsMinor(0n), tooBig)).toThrow(overflow);
    expect(() => subtractCbsMinor(tooBig, cbsMinor(1n))).toThrow(overflow);
    expect(() => formatCbsMinor(tooBig, P2)).toThrow(overflow);
  });
});

describe('cbsPrecision: an integer 0 ≤ p ≤ 18 taken from the CBS', () => {
  it.each([0, 1, 2, 6, 17, 18])('accepts %s unchanged', (p) => {
    expect(cbsPrecision(p)).toBe(p);
  });

  it.each([-1, 19, 1.5, 0.5, 17.999, 18.5, -0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('refuses %s', (p) => {
    expect(() => cbsPrecision(p)).toThrow(new RangeError(`CbsPrecision must be an integer from 0 to 18, got ${String(p)}`));
  });

  it.each([
    ['6', 'string'],
    [6n, 'bigint'],
    [undefined, 'undefined'],
    [null, 'object'],
  ])('refuses the non-number %s', (p, kind) => {
    expect(() => cbsPrecision(p as unknown as number)).toThrow(new TypeError(`CbsPrecision requires a number, got ${kind}`));
  });

  it('every conversion and the CBS formatter re-validate a precision that bypassed the constructor by a cast', () => {
    const bad = 19 as CbsPrecision;
    const msg = new RangeError('CbsPrecision must be an integer from 0 to 18, got 19');
    expect(() => nativeWeiToCbsMinor(nativeWei(1n), bad)).toThrow(msg);
    expect(() => cbsMinorToNativeWei(cbsMinor(1n), bad)).toThrow(msg);
    expect(() => formatCbsMinor(cbsMinor(1n), bad)).toThrow(msg);
    expect(() => nativeWeiToCbsMinor(nativeWei(1n), 2.5 as CbsPrecision)).toThrow(RangeError);
    expect(() => nativeWeiToCbsMinor(nativeWei(1n), -1 as CbsPrecision)).toThrow(RangeError);
  });
});

describe('fail closed on inputs that bypassed the brand by a cast', () => {
  const negW = -1n as NativeWei;
  const negU = -1n as UsdcUnits;
  const negC = -1n as CbsMinor;
  const numW = 1 as unknown as NativeWei;

  it('negative inputs are refused by every conversion and formatter', () => {
    expect(() => nativeWeiToCbsMinor(negW, P6)).toThrow(new RangeError('NativeWei must not be negative'));
    expect(() => nativeWeiToUsdcUnits(negW)).toThrow(new RangeError('NativeWei must not be negative'));
    expect(() => cbsMinorToNativeWei(negC, P6)).toThrow(new RangeError('CbsMinor must not be negative'));
    expect(() => usdcUnitsToNativeWei(negU)).toThrow(new RangeError('UsdcUnits must not be negative'));
    expect(() => formatCbsMinor(negC, P2)).toThrow(new RangeError('CbsMinor must not be negative'));
    expect(() => formatUsdcUnits(negU)).toThrow(new RangeError('UsdcUnits must not be negative'));
    expect(() => formatNativeWei(negW)).toThrow(new RangeError('NativeWei must not be negative'));
  });

  it('number inputs are refused by every conversion', () => {
    expect(() => nativeWeiToCbsMinor(numW, P6)).toThrow(new TypeError('NativeWei requires a bigint, got number'));
    expect(() => nativeWeiToUsdcUnits(numW)).toThrow(new TypeError('NativeWei requires a bigint, got number'));
    expect(() => cbsMinorToNativeWei(1 as unknown as CbsMinor, P6)).toThrow(new TypeError('CbsMinor requires a bigint, got number'));
    expect(() => usdcUnitsToNativeWei(1 as unknown as UsdcUnits)).toThrow(new TypeError('UsdcUnits requires a bigint, got number'));
  });
});

describe('rounding policy', () => {
  it('is FLOOR with the remainder returned, and nothing else', () => {
    expect(ROUNDING_POLICY).toBe('FLOOR_REMAINDER_RETURNED');
  });

  it('never rounds up: 2k − 1 wei gives m = 1 and k − 1 as dust', () => {
    expect(nativeWeiToCbsMinor(nativeWei(1_999_999_999_999n), P6)).toEqual({ minor: 1n, dustWei: 999_999_999_999n });
  });
});

describe('display (CONTRACT §6 "any → display"): integer formatting only, never 18 dp', () => {
  it.each([
    [0n, 2, '0.00'],
    [1n, 2, '0.01'],
    [12_345n, 2, '123.45'],
    [100n, 2, '1.00'],
    [1_000_000n, 6, '1.000000'],
    [999_999n, 6, '0.999999'],
    [1_000_000n, 0, '1000000'],
    [9_223_372_036_854_775_807n, 6, '9223372036854.775807'],
  ] as const)('CBS %s at p = %s → %s, exact (nothing hidden at p ≤ 6)', (m, p, text) => {
    expect(formatCbsMinor(cbsMinor(m), cbsPrecision(p))).toEqual({ text, hiddenMinor: 0n });
  });

  it.each([
    // p = 18 (§6.1 "unusable"): never 18 dp (verifier round 2 D3); floored to 6 dp, the rest returned.
    [7n, 18, '0.000000', 7n],
    [1_234_567_890_123_456_789n, 18, '1.234567', 890_123_456_789n],
    [CBS_MINOR_MAX, 18, '9.223372', 36_854_775_807n],
    [1_000_000_000_000n, 18, '0.000001', 0n],
    // p = 7: one hidden place.
    [12_345_678n, 7, '1.234567', 8n],
    [10n, 7, '0.000001', 0n],
    [9n, 7, '0.000000', 9n],
    // p = 17.
    [123_456_789_012_345_678n, 17, '1.234567', 89_012_345_678n],
  ] as const)('CBS %s at p = %s → %s, hidden %s minor (at most 6 dp, floored)', (m, p, text, hiddenMinor) => {
    expect(formatCbsMinor(cbsMinor(m), cbsPrecision(p))).toEqual({ text, hiddenMinor });
  });

  it('DISPLAY_MAX_PLACES is 6, the ERC-20 precision (C-11, C-13)', () => {
    expect(DISPLAY_MAX_PLACES).toBe(6n);
  });

  it.each([
    [0n, '0.000000'],
    [1n, '0.000001'],
    [1_234_567n, '1.234567'],
    [1_000_000n, '1.000000'],
    [123_000_000_000n, '123000.000000'],
  ] as const)('USDC units %s → %s (always 6 places)', (u, text) => {
    expect(formatUsdcUnits(usdcUnits(u))).toBe(text);
  });

  it('native wei is floored to 6 dp and the hidden wei is returned, never dropped (C-13)', () => {
    expect(formatNativeWei(nativeWei(1_234_567_890_123_456_789n))).toEqual({ text: '1.234567', hiddenWei: 890_123_456_789n });
    expect(formatNativeWei(nativeWei(7_374_356_000_000_000n))).toEqual({ text: '0.007374', hiddenWei: 356_000_000_000n });
    expect(formatNativeWei(nativeWei(999_999_999_999n))).toEqual({ text: '0.000000', hiddenWei: 999_999_999_999n });
    expect(formatNativeWei(nativeWei(0n))).toEqual({ text: '0.000000', hiddenWei: 0n });
  });
});

describe('asset registry: USDC on Arc testnet (C-01, C-05, C-10 to C-15)', () => {
  it('native view: 18 dp, no contract, enabled, the only credit view', () => {
    expect(USDC_NATIVE).toEqual({
      id: 'USDC_NATIVE',
      symbol: 'USDC',
      chainId: '5042002',
      unit: 'NATIVE_WEI',
      decimals: 18n,
      address: null,
      status: 'ENABLED',
      creditView: true,
      constants: ['C-01', 'C-05', 'C-10', 'C-13', 'C-14', 'C-15'],
    });
  });

  it('ERC-20 view: 6 dp at 0x3600…0000, enabled, never a credit view', () => {
    expect(USDC_ERC20).toEqual({
      id: 'USDC_ERC20',
      symbol: 'USDC',
      chainId: '5042002',
      unit: 'USDC_UNITS',
      decimals: 6n,
      address: '0x3600000000000000000000000000000000000000',
      status: 'ENABLED',
      creditView: false,
      constants: ['C-01', 'C-11', 'C-12', 'C-13', 'C-14'],
    });
  });

  it('is keyed by wire unit tag and the native/ERC-20 factor is 10¹² (C-13)', () => {
    expect(ASSET_REGISTRY).toEqual({ NATIVE_WEI: USDC_NATIVE, USDC_UNITS: USDC_ERC20 });
    expect(ASSET_REGISTRY.NATIVE_WEI).toBe(USDC_NATIVE);
    expect(ASSET_REGISTRY.USDC_UNITS).toBe(USDC_ERC20);
    expect(10n ** (USDC_NATIVE.decimals - USDC_ERC20.decimals)).toBe(1_000_000_000_000n);
  });

  it('is deeply frozen', () => {
    for (const o of [ASSET_REGISTRY, USDC_NATIVE, USDC_ERC20, USDC_NATIVE.constants, USDC_ERC20.constants]) expect(Object.isFrozen(o)).toBe(true);
  });

  it('chain ID is testnet only (C-01), never mainnet (C-02)', () => {
    for (const v of [USDC_NATIVE, USDC_ERC20]) {
      expect(v.chainId).toBe('5042002');
      expect(v.chainId).not.toBe('5042');
    }
  });

  it('assetForUnit returns the enabled view for each registry key', () => {
    expect(assetForUnit('NATIVE_WEI')).toBe(USDC_NATIVE);
    expect(assetForUnit('USDC_UNITS')).toBe(USDC_ERC20);
  });

  it.each(['CBS_MINOR:ZAR:2', 'toString', '__proto__', 'native_wei', ''])('assetForUnit refuses the unknown unit %j', (unit) => {
    const e = thrown(() => assetForUnit(unit));
    expect(e).toBeInstanceOf(AssetUnavailableError);
    const err = e as AssetUnavailableError;
    expect(err.code).toBe('ASSET_UNAVAILABLE');
    expect(err.reason).toBe('UNKNOWN_UNIT');
    expect(err.unit).toBe(unit);
    expect(err.name).toBe('AssetUnavailableError');
    expect(err.message).toBe(`asset view for unit ${unit} is unavailable: UNKNOWN_UNIT`);
  });

  it('assertAssetEnabled passes an enabled view and refuses a disabled one', () => {
    expect(assertAssetEnabled(USDC_ERC20)).toBe(USDC_ERC20);
    const disabled: AssetView = { ...USDC_ERC20, status: 'DISABLED' };
    const e = thrown(() => assertAssetEnabled(disabled));
    expect(e).toBeInstanceOf(AssetUnavailableError);
    const err = e as AssetUnavailableError;
    expect(err.reason).toBe('DISABLED');
    expect(err.unit).toBe('USDC_UNITS');
    expect(err.message).toBe('asset view for unit USDC_UNITS is unavailable: DISABLED');
  });
});

describe('same-unit helpers (the sanctioned way to add and subtract)', () => {
  it('add and subtract per unit', () => {
    expect(addCbsMinor(cbsMinor(2n), cbsMinor(3n))).toBe(5n);
    expect(subtractCbsMinor(cbsMinor(5n), cbsMinor(3n))).toBe(2n);
    expect(addUsdcUnits(usdcUnits(2n), usdcUnits(3n))).toBe(5n);
    expect(subtractUsdcUnits(usdcUnits(5n), usdcUnits(3n))).toBe(2n);
    expect(addNativeWei(nativeWei(2n), nativeWei(3n))).toBe(5n);
    expect(subtractNativeWei(nativeWei(5n), nativeWei(3n))).toBe(2n);
    expect(subtractNativeWei(nativeWei(5n), nativeWei(5n))).toBe(0n);
  });

  it('a negative difference fails closed', () => {
    expect(() => subtractCbsMinor(cbsMinor(1n), cbsMinor(2n))).toThrow(new RangeError('CbsMinor must not be negative'));
    expect(() => subtractUsdcUnits(usdcUnits(1n), usdcUnits(2n))).toThrow(new RangeError('UsdcUnits must not be negative'));
    expect(() => subtractNativeWei(nativeWei(1n), nativeWei(2n))).toThrow(new RangeError('NativeWei must not be negative'));
  });

  it('cast operands are re-checked (a negative cannot cancel a positive)', () => {
    expect(() => addCbsMinor(cbsMinor(5n), -3n as CbsMinor)).toThrow(new RangeError('CbsMinor must not be negative'));
    expect(() => addCbsMinor(-3n as CbsMinor, cbsMinor(5n))).toThrow(new RangeError('CbsMinor must not be negative'));
    expect(() => addUsdcUnits(usdcUnits(5n), -3n as UsdcUnits)).toThrow(new RangeError('UsdcUnits must not be negative'));
    expect(() => addUsdcUnits(-3n as UsdcUnits, usdcUnits(5n))).toThrow(new RangeError('UsdcUnits must not be negative'));
    expect(() => addNativeWei(nativeWei(5n), -3n as NativeWei)).toThrow(new RangeError('NativeWei must not be negative'));
    expect(() => addNativeWei(-3n as NativeWei, nativeWei(5n))).toThrow(new RangeError('NativeWei must not be negative'));
    expect(() => subtractCbsMinor(cbsMinor(5n), -3n as CbsMinor)).toThrow(new RangeError('CbsMinor must not be negative'));
    expect(() => subtractCbsMinor(-3n as CbsMinor, cbsMinor(0n))).toThrow(new RangeError('CbsMinor must not be negative'));
    expect(() => subtractUsdcUnits(usdcUnits(5n), -3n as UsdcUnits)).toThrow(new RangeError('UsdcUnits must not be negative'));
    expect(() => subtractUsdcUnits(-3n as UsdcUnits, usdcUnits(0n))).toThrow(new RangeError('UsdcUnits must not be negative'));
    expect(() => subtractNativeWei(nativeWei(5n), -3n as NativeWei)).toThrow(new RangeError('NativeWei must not be negative'));
    expect(() => subtractNativeWei(-3n as NativeWei, nativeWei(0n))).toThrow(new RangeError('NativeWei must not be negative'));
  });
});
