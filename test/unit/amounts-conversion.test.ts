/**
 * U1 conversion module (CONTRACT §6) and asset registry: every CONTRACT §6.1
 * worked row, the overflow guard, precision validation, fail-closed re-checks
 * of cast inputs, and the same-unit helpers.
 */
import { describe, expect, it } from 'vitest';
import {
  ASSET_REGISTRY,
  CBS_MINOR_MAX,
  CbsMinorOverflowError,
  ROUNDING_POLICY,
  USDC_ERC20,
  USDC_NATIVE,
  addCbsMinor,
  addNativeWei,
  addUsdcUnits,
  cbsMinor,
  cbsMinorToNativeWei,
  cbsPrecision,
  nativeWei,
  nativeWeiToCbsMinor,
  nativeWeiToUsdcUnits,
  subtractCbsMinor,
  subtractNativeWei,
  subtractUsdcUnits,
  usdcUnits,
  usdcUnitsToNativeWei,
} from '../../src/amounts/index.js';
import type { CbsMinor, CbsPrecision, NativeWei, UsdcUnits } from '../../src/amounts/index.js';

const P6 = cbsPrecision(6);
const P2 = cbsPrecision(2);

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

  it('the ERC-20 view is not overflow-guarded (it is not a CBS amount)', () => {
    const big = 2n ** 255n;
    expect(nativeWeiToUsdcUnits(nativeWei(big * 1_000_000_000_000n + 7n))).toEqual({ units: big, remainderWei: 7n });
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

describe('overflow guard: m above the signed 64-bit maximum fails closed (CONTRACT §6)', () => {
  it('CBS_MINOR_MAX is 2⁶³ − 1', () => {
    expect(CBS_MINOR_MAX).toBe(2n ** 63n - 1n);
  });

  it('m = CBS_MINOR_MAX is accepted in both directions', () => {
    expect(cbsMinorToNativeWei(cbsMinor(CBS_MINOR_MAX), P6)).toBe(9_223_372_036_854_775_807_000_000_000_000n);
    expect(nativeWeiToCbsMinor(nativeWei(CBS_MINOR_MAX), cbsPrecision(18))).toEqual({ minor: CBS_MINOR_MAX, dustWei: 0n });
  });

  it('the first w past the largest row (m = 2⁶³) is refused with CbsMinorOverflowError', () => {
    const w = nativeWei(9_223_372_036_854_775_808_000_000_000_000n);
    let caught: unknown;
    try {
      nativeWeiToCbsMinor(w, P6);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CbsMinorOverflowError);
    expect(caught).toBeInstanceOf(RangeError);
    const e = caught as CbsMinorOverflowError;
    expect(e.code).toBe('CBS_MINOR_OVERFLOW');
    expect(e.minor).toBe(2n ** 63n);
    expect(e.name).toBe('CbsMinorOverflowError');
    expect(e.message).toBe('CbsMinor 9223372036854775808 exceeds CBS_MINOR_MAX 9223372036854775807: reject and PAUSE');
  });

  it('at p = 18 the capacity is about 9.22 USDC (CONTRACT §6.1 "unusable")', () => {
    expect(() => nativeWeiToCbsMinor(nativeWei(10n ** 19n), cbsPrecision(18))).toThrow(CbsMinorOverflowError);
  });

  it('an outbound m above the maximum is refused before it becomes wei', () => {
    expect(() => cbsMinorToNativeWei(cbsMinor(CBS_MINOR_MAX + 1n), P6)).toThrow(
      new CbsMinorOverflowError(CBS_MINOR_MAX + 1n),
    );
  });
});

describe('cbsPrecision: an integer 0 ≤ p ≤ 18 taken from the CBS', () => {
  it.each([0, 1, 2, 6, 17, 18])('accepts %s unchanged', (p) => {
    expect(cbsPrecision(p)).toBe(p);
  });

  it.each([-1, 19, 1.5, 0.5, 17.999, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('refuses %s', (p) => {
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

  it('every conversion re-validates a precision that bypassed the constructor by a cast', () => {
    const bad = 19 as CbsPrecision;
    const msg = new RangeError('CbsPrecision must be an integer from 0 to 18, got 19');
    expect(() => nativeWeiToCbsMinor(nativeWei(1n), bad)).toThrow(msg);
    expect(() => cbsMinorToNativeWei(cbsMinor(1n), bad)).toThrow(msg);
    expect(() => nativeWeiToCbsMinor(nativeWei(1n), 2.5 as CbsPrecision)).toThrow(RangeError);
  });
});

describe('fail closed on inputs that bypassed the brand by a cast', () => {
  const negW = -1n as NativeWei;
  const negU = -1n as UsdcUnits;
  const negC = -1n as CbsMinor;
  const numW = 1 as unknown as NativeWei;

  it('negative inputs are refused by every conversion', () => {
    expect(() => nativeWeiToCbsMinor(negW, P6)).toThrow(new RangeError('NativeWei must not be negative'));
    expect(() => nativeWeiToUsdcUnits(negW)).toThrow(new RangeError('NativeWei must not be negative'));
    expect(() => cbsMinorToNativeWei(negC, P6)).toThrow(new RangeError('CbsMinor must not be negative'));
    expect(() => usdcUnitsToNativeWei(negU)).toThrow(new RangeError('UsdcUnits must not be negative'));
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

  it('never rounds up: k − 1 wei gives m = 0 and the whole amount as dust', () => {
    expect(nativeWeiToCbsMinor(nativeWei(1_999_999_999_999n), P6)).toEqual({ minor: 1n, dustWei: 999_999_999_999n });
  });
});

describe('asset registry: USDC on Arc testnet (C-01, C-05, C-10 to C-15)', () => {
  it('native view: 18 dp, no contract, the only credit view', () => {
    expect(USDC_NATIVE).toEqual({
      id: 'USDC_NATIVE',
      symbol: 'USDC',
      chainId: '5042002',
      unit: 'NATIVE_WEI',
      decimals: 18n,
      address: null,
      creditView: true,
      constants: ['C-01', 'C-05', 'C-10', 'C-13', 'C-14', 'C-15'],
    });
  });

  it('ERC-20 view: 6 dp at 0x3600…0000, never a credit view', () => {
    expect(USDC_ERC20).toEqual({
      id: 'USDC_ERC20',
      symbol: 'USDC',
      chainId: '5042002',
      unit: 'USDC_UNITS',
      decimals: 6n,
      address: '0x3600000000000000000000000000000000000000',
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
