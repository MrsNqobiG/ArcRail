/**
 * U1 Amounts (money path, RUBRIC money-path item 1).
 *
 * This file is the ONLY conversion module (CONTRACT §6, RUBRIC MC-03). It holds:
 * - the three branded amount types and their checked constructors;
 * - the asset registry for USDC on Arc testnet (two views of one balance);
 * - the four CONTRACT §6 conversions, with an explicit rounding policy;
 * - checked same-unit addition and subtraction, so no other module needs to
 *   re-brand a raw arithmetic result (test/unit/amounts-rebrand-lint.test.ts).
 *
 * Rules (CLAUDE.md "Money invariants"):
 * - integer arithmetic only: every amount is a `bigint`, never a `number`;
 * - the three views of value are distinct types, and mixing them is a compile
 *   error (RUBRIC MC-02; see test/types/amount-mixing.typecheck.ts);
 * - amounts carry no sign: direction is carried by the debit/credit leg
 *   (CONTRACT §1.1), so a negative value is refused at construction;
 * - rounding is FLOOR, and the remainder is always returned to the caller,
 *   never dropped (CONTRACT §6, C-14). Sub-unit dust goes to the §5.7 dust
 *   accumulator; that posting is the caller's job, not this module's;
 * - a CBS minor amount above the signed 64-bit maximum is refused with
 *   `CbsMinorOverflowError`, and the caller must PAUSE (CONTRACT §6 overflow
 *   guard, fail closed).
 *
 * Known limit of a bigint brand: TypeScript still accepts the raw operators
 * `+ - * / % < >` between two branded bigints. Their result is a plain
 * `bigint`, which cannot reach any branded slot without an explicit
 * constructor call, so the compiler rejects every implicit mix. An explicit
 * re-brand such as `cbsMinor(a + b)` outside this file is caught by the test
 * test/unit/amounts-rebrand-lint.test.ts (rule set in
 * test/unit/amounts-rebrand-lint.ts).
 */

declare const amountUnit: unique symbol;

/** CBS minor units at the CBS's own precision `p` (CONTRACT §1.1 `CBS_MINOR:<assetCode>:<p>`). */
export type CbsMinor = bigint & { readonly [amountUnit]: 'CbsMinor' };

/** ERC-20 view of USDC, 6 decimals (docs/constants.md C-11). */
export type UsdcUnits = bigint & { readonly [amountUnit]: 'UsdcUnits' };

/** Native view of USDC (gas and value), 18 decimals (docs/constants.md C-10). */
export type NativeWei = bigint & { readonly [amountUnit]: 'NativeWei' };

export type Amount = CbsMinor | UsdcUnits | NativeWei;

/** Wire unit tags (CONTRACT §1.1). */
export type UnitTag = `CBS_MINOR:${string}:${number}` | 'USDC_UNITS' | 'NATIVE_WEI';

/** CBS precision `p`: decimal places of the CBS minor unit (Q-C4). Always taken from the CBS (CONTRACT §1.1). */
export type CbsPrecision = number & { readonly __cbsPrecision: true };

/** Result of an inexact conversion: the remainder is always returned, never dropped (CONTRACT §6, C-14). */
export interface NativeToCbsResult {
  readonly minor: CbsMinor;
  readonly dustWei: NativeWei;
}

export interface NativeToUsdcResult {
  readonly units: UsdcUnits;
  readonly remainderWei: NativeWei;
}

function checkedAmount(value: bigint, typeName: string): bigint {
  if (typeof value !== 'bigint') {
    throw new TypeError(`${typeName} requires a bigint, got ${typeof value}`);
  }
  if (value < 0n) {
    throw new RangeError(`${typeName} must not be negative`);
  }
  return value;
}

/** Brand a non-negative bigint as CBS minor units. Throws on a non-bigint or a negative value. */
export function cbsMinor(value: bigint): CbsMinor {
  return checkedAmount(value, 'CbsMinor') as CbsMinor;
}

/** Brand a non-negative bigint as ERC-20 USDC units (6 dp). Throws on a non-bigint or a negative value. */
export function usdcUnits(value: bigint): UsdcUnits {
  return checkedAmount(value, 'UsdcUnits') as UsdcUnits;
}

/** Brand a non-negative bigint as native wei (18 dp). Throws on a non-bigint or a negative value. */
export function nativeWei(value: bigint): NativeWei {
  return checkedAmount(value, 'NativeWei') as NativeWei;
}

// ---------------------------------------------------------------------------
// Asset registry: USDC on Arc testnet (one balance, two views).
// ---------------------------------------------------------------------------

/** One view of an on-chain asset. Decimals are `bigint` (MC-01: `number` is reserved for p, chain IDs and RPC codes). */
export interface AssetView {
  readonly id: 'USDC_NATIVE' | 'USDC_ERC20';
  /** C-05: native currency symbol; C-12: ERC-20 `symbol()`. */
  readonly symbol: 'USDC';
  /** C-01, as a CONTRACT §1.2 decimal string. Testnet only (CLAUDE.md N1). */
  readonly chainId: '5042002';
  /** CONTRACT §1.1 wire unit tag of amounts in this view. */
  readonly unit: 'NATIVE_WEI' | 'USDC_UNITS';
  /** C-10 (18) or C-11 (6). */
  readonly decimals: bigint;
  /** C-12 for the ERC-20 interface; `null` for the native balance (no contract). */
  readonly address: `0x${string}` | null;
  /** C-14, C-15: credit and record only at native precision; the ERC-20 view truncates below 10⁻⁶ USDC. */
  readonly creditView: boolean;
  /** docs/constants.md rows this view is built from. */
  readonly constants: readonly string[];
}

/** USDC on Arc testnet, native view (gas and value), 18 dp. */
export const USDC_NATIVE: AssetView = Object.freeze({
  id: 'USDC_NATIVE',
  symbol: 'USDC',
  chainId: '5042002',
  unit: 'NATIVE_WEI',
  decimals: 18n,
  address: null,
  creditView: true,
  constants: Object.freeze(['C-01', 'C-05', 'C-10', 'C-13', 'C-14', 'C-15']),
});

/** USDC on Arc testnet, optional ERC-20 interface at 0x3600…0000, 6 dp. */
export const USDC_ERC20: AssetView = Object.freeze({
  id: 'USDC_ERC20',
  symbol: 'USDC',
  chainId: '5042002',
  unit: 'USDC_UNITS',
  decimals: 6n,
  address: '0x3600000000000000000000000000000000000000',
  creditView: false,
  constants: Object.freeze(['C-01', 'C-11', 'C-12', 'C-13', 'C-14']),
});

/** The asset registry, keyed by wire unit tag. CBS assets are not here: their code and `p` come from the CBS (CONTRACT §1.1, Q-C4). */
export const ASSET_REGISTRY: Readonly<Record<'NATIVE_WEI' | 'USDC_UNITS', AssetView>> = Object.freeze({
  NATIVE_WEI: USDC_NATIVE,
  USDC_UNITS: USDC_ERC20,
});

// ---------------------------------------------------------------------------
// The single conversion module (CONTRACT §6).
// ---------------------------------------------------------------------------

/**
 * The only rounding policy: FLOOR toward zero (amounts are non-negative), and
 * the remainder is returned in the result, never dropped (CONTRACT §6, C-14).
 * Conversions toward finer units (`× k`) are exact.
 */
export const ROUNDING_POLICY = 'FLOOR_REMAINDER_RETURNED';

/**
 * Largest CBS minor amount: signed 64-bit (CONTRACT §6.1, last p = 6 row).
 * The CBS integer width is still Q-C4; this bound only ever refuses.
 */
export const CBS_MINOR_MAX: bigint = 9_223_372_036_854_775_807n;

/** A CBS minor amount above `CBS_MINOR_MAX`. Fail closed: the caller rejects the call and PAUSEs (CONTRACT §6). */
export class CbsMinorOverflowError extends RangeError {
  readonly code = 'CBS_MINOR_OVERFLOW';
  readonly minor: bigint;

  constructor(minor: bigint) {
    super(`CbsMinor ${minor} exceeds CBS_MINOR_MAX ${CBS_MINOR_MAX}: reject and PAUSE`);
    this.name = 'CbsMinorOverflowError';
    this.minor = minor;
  }
}

/** Validate a CBS precision taken from the CBS's own asset configuration (CONTRACT §1.1, Q-C4): an integer 0 ≤ p ≤ 18 (C-10). */
export function cbsPrecision(p: number): CbsPrecision {
  if (typeof p !== 'number') {
    throw new TypeError(`CbsPrecision requires a number, got ${typeof p}`);
  }
  if (p % 1 !== 0 || p < 0 || p > 18) {
    throw new RangeError(`CbsPrecision must be an integer from 0 to 18, got ${String(p)}`);
  }
  return p as CbsPrecision;
}

/** `10^(18 − decimals)`: wei per one unit of a view with `decimals` places. */
function weiPer(decimals: bigint): bigint {
  return 10n ** (USDC_NATIVE.decimals - decimals);
}

/** `k = 10^(18 − p)` (CONTRACT §5, §6). Re-validates `p`, so a cast cannot bypass `cbsPrecision`. */
function weiPerMinor(p: CbsPrecision): bigint {
  cbsPrecision(p);
  return weiPer(BigInt(p));
}

function checkCbsMax(m: bigint): CbsMinor {
  if (m > CBS_MINOR_MAX) {
    throw new CbsMinorOverflowError(m);
  }
  return cbsMinor(m);
}

/** `m = ⌊W/k⌋`, dust `= W mod k`, `k = 10^(18 − p)` (CONTRACT §5, §6). Throws `CbsMinorOverflowError` if `m > CBS_MINOR_MAX`. */
export function nativeWeiToCbsMinor(w: NativeWei, p: CbsPrecision): NativeToCbsResult {
  const wei = nativeWei(w);
  const k = weiPerMinor(p);
  return { minor: checkCbsMax(wei / k), dustWei: nativeWei(wei % k) };
}

/** `w = m × k`, exact (CONTRACT §6). Outbound amounts are always built this way. Throws `CbsMinorOverflowError` if `m > CBS_MINOR_MAX`. */
export function cbsMinorToNativeWei(m: CbsMinor, p: CbsPrecision): NativeWei {
  const k = weiPerMinor(p);
  return nativeWei(checkCbsMax(cbsMinor(m)) * k);
}

/** `u = ⌊w / 10¹²⌋`, remainder `w mod 10¹²` reported (CONTRACT §6, C-13, C-14). */
export function nativeWeiToUsdcUnits(w: NativeWei): NativeToUsdcResult {
  const wei = nativeWei(w);
  const k = weiPer(USDC_ERC20.decimals);
  return { units: usdcUnits(wei / k), remainderWei: nativeWei(wei % k) };
}

/** `w = u × 10¹²`, exact (CONTRACT §6). */
export function usdcUnitsToNativeWei(u: UsdcUnits): NativeWei {
  return nativeWei(usdcUnits(u) * weiPer(USDC_ERC20.decimals));
}

// ---------------------------------------------------------------------------
// Same-unit arithmetic. The only sanctioned way to sum or subtract amounts;
// a negative difference throws RangeError (fail closed).
// ---------------------------------------------------------------------------

export function addCbsMinor(a: CbsMinor, b: CbsMinor): CbsMinor {
  return cbsMinor(cbsMinor(a) + cbsMinor(b));
}

export function subtractCbsMinor(a: CbsMinor, b: CbsMinor): CbsMinor {
  return cbsMinor(cbsMinor(a) - cbsMinor(b));
}

export function addUsdcUnits(a: UsdcUnits, b: UsdcUnits): UsdcUnits {
  return usdcUnits(usdcUnits(a) + usdcUnits(b));
}

export function subtractUsdcUnits(a: UsdcUnits, b: UsdcUnits): UsdcUnits {
  return usdcUnits(usdcUnits(a) - usdcUnits(b));
}

export function addNativeWei(a: NativeWei, b: NativeWei): NativeWei {
  return nativeWei(nativeWei(a) + nativeWei(b));
}

export function subtractNativeWei(a: NativeWei, b: NativeWei): NativeWei {
  return nativeWei(nativeWei(a) - nativeWei(b));
}
