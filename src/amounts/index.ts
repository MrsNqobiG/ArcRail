/**
 * U1 Amounts (money path, RUBRIC money-path item 1).
 *
 * This file is the ONLY conversion module (CONTRACT §6, RUBRIC MC-03). It holds:
 * - the three branded amount types and their checked constructors;
 * - the asset registry for USDC on Arc testnet (two views of one balance),
 *   with address, decimals and status per view;
 * - every row of the CONTRACT §6 table: the four conversions, with an explicit
 *   rounding policy, and the "any → display" row (integer formatting only);
 * - checked same-unit addition and subtraction, so no other module needs to
 *   re-brand a raw arithmetic result (test/unit/amounts-rebrand-lint.test.ts).
 *
 * Rules (CLAUDE.md "Money invariants"):
 * - integer arithmetic only: every amount is a `bigint`, never a `number`;
 * - the three views of value are distinct types, and mixing them is a compile
 *   error (RUBRIC MC-02; see test/types/amount-mixing.typecheck.ts), including
 *   passing one unit to another unit's constructor (`RawAmount`;
 *   test/types/amounts-ctor-mixing.typecheck.ts);
 * - display never shows more than 6 dp in any view (CONTRACT §6); digits
 *   below that are returned, never dropped;
 * - amounts carry no sign: direction is carried by the debit/credit leg
 *   (CONTRACT §1.1), so a negative value is refused at construction;
 * - rounding is FLOOR, and the remainder is always returned to the caller,
 *   never dropped (CONTRACT §6, C-14). Sub-unit dust goes to the §5.7 dust
 *   accumulator; that posting is the caller's job, not this module's;
 * - overflow guard (CONTRACT §6), fail closed: a `CbsMinor` can never exceed
 *   `CBS_MINOR_MAX`. The bound is enforced by the `cbsMinor` constructor
 *   itself, so it holds for every route that yields a `CbsMinor`: direct
 *   construction, `nativeWeiToCbsMinor`, `addCbsMinor` and `subtractCbsMinor`.
 *   Each throws `CbsMinorOverflowError`, and the caller rejects the call and
 *   PAUSEs. Native wei and ERC-20 units stay arbitrary-precision.
 *
 * Known limit of a bigint brand: TypeScript still accepts the raw operators
 * `+ - * / % < >` between two branded bigints. Their result is a plain
 * `bigint`, which cannot reach any branded slot without an explicit
 * constructor call, a cast, an `any` or a type predicate. Every one of those
 * routes outside this file is checked by test/unit/amounts-rebrand-lint.test.ts
 * (rule set and its stated limits in test/unit/amounts-rebrand-lint.ts).
 */

declare const amountUnit: unique symbol;

/** CBS minor units at the CBS's own precision `p` (CONTRACT §1.1 `CBS_MINOR:<assetCode>:<p>`). Always ≤ `CBS_MINOR_MAX`. */
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

// ---------------------------------------------------------------------------
// Branded constructors and the CBS overflow bound.
// ---------------------------------------------------------------------------

/**
 * Largest CBS minor amount: signed 64-bit (CONTRACT §6.1, last p = 6 row).
 * CONTRACT §6 defines CBS_MAX as the CBS integer max, which is still Q-C4. If
 * the CBS turns out to be narrower, this constant must become the CBS's own
 * value; it must never be wider than the CBS.
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

function checkedAmount(value: bigint, typeName: string): bigint {
  if (typeof value !== 'bigint') {
    throw new TypeError(`${typeName} requires a bigint, got ${typeof value}`);
  }
  if (value < 0n) {
    throw new RangeError(`${typeName} must not be negative`);
  }
  return value;
}

// Module-private checkers. They accept any bigint, including one that is
// already branded, so this module can re-check its own inputs (a cast can
// bypass a brand). They are never exported: outside this module the only
// entry points are the public constructors below, which refuse a branded
// argument at compile time.

function checkCbsMinor(value: bigint): CbsMinor {
  const minor = checkedAmount(value, 'CbsMinor');
  if (minor > CBS_MINOR_MAX) {
    throw new CbsMinorOverflowError(minor);
  }
  return minor as CbsMinor;
}

function checkUsdcUnits(value: bigint): UsdcUnits {
  return checkedAmount(value, 'UsdcUnits') as UsdcUnits;
}

function checkNativeWei(value: bigint): NativeWei {
  return checkedAmount(value, 'NativeWei') as NativeWei;
}

/**
 * A plain, unbranded bigint: the only argument a public constructor accepts.
 * An amount that already carries a brand (of any unit) is refused at compile
 * time (TS2345), so `nativeWei(usdcUnitsValue)` or `cbsMinor(nativeWeiValue)`
 * cannot re-label one unit as another without a conversion (RUBRIC MC-02;
 * test/types/amounts-ctor-mixing.typecheck.ts). A brand widened to plain
 * `bigint` first is caught by the re-brand rule instead (REBRAND-CROSS in
 * test/unit/amounts-rebrand-lint.ts).
 */
export type RawAmount = bigint & { readonly [amountUnit]?: never };

/**
 * Brand a plain bigint as CBS minor units. Throws TypeError on a non-bigint,
 * RangeError on a negative value and `CbsMinorOverflowError` above
 * `CBS_MINOR_MAX` (CONTRACT §6 overflow guard).
 */
export function cbsMinor(value: RawAmount): CbsMinor {
  return checkCbsMinor(value);
}

/** Brand a plain, non-negative bigint as ERC-20 USDC units (6 dp). Throws on a non-bigint or a negative value. */
export function usdcUnits(value: RawAmount): UsdcUnits {
  return checkUsdcUnits(value);
}

/** Brand a plain, non-negative bigint as native wei (18 dp). Throws on a non-bigint or a negative value. */
export function nativeWei(value: RawAmount): NativeWei {
  return checkNativeWei(value);
}

// ---------------------------------------------------------------------------
// Asset registry: USDC on Arc testnet (one balance, two views).
// ---------------------------------------------------------------------------

/**
 * Status of a view on this rail. `ENABLED`: the view may be used; every
 * constant it is built from is cited in docs/constants.md. `DISABLED`: the
 * view must not be used, and `assertAssetEnabled` / `assetForUnit` refuse it.
 */
export type AssetStatus = 'ENABLED' | 'DISABLED';

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
  /** Whether this view may be used on the rail at all. */
  readonly status: AssetStatus;
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
  status: 'ENABLED',
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
  status: 'ENABLED',
  creditView: false,
  constants: Object.freeze(['C-01', 'C-11', 'C-12', 'C-13', 'C-14']),
});

/** The asset registry, keyed by wire unit tag. CBS assets are not here: their code and `p` come from the CBS (CONTRACT §1.1, Q-C4). */
export const ASSET_REGISTRY: Readonly<Record<'NATIVE_WEI' | 'USDC_UNITS', AssetView>> = Object.freeze({
  NATIVE_WEI: USDC_NATIVE,
  USDC_UNITS: USDC_ERC20,
});

/** A unit tag with no registry entry, or a view whose status is not `ENABLED`. Fail closed. */
export class AssetUnavailableError extends Error {
  readonly code = 'ASSET_UNAVAILABLE';
  readonly unit: string;
  readonly reason: 'UNKNOWN_UNIT' | 'DISABLED';

  constructor(unit: string, reason: 'UNKNOWN_UNIT' | 'DISABLED') {
    super(`asset view for unit ${unit} is unavailable: ${reason}`);
    this.name = 'AssetUnavailableError';
    this.unit = unit;
    this.reason = reason;
  }
}

/** Refuse a view whose status is not `ENABLED`. */
export function assertAssetEnabled(view: AssetView): AssetView {
  if (view.status !== 'ENABLED') {
    throw new AssetUnavailableError(view.unit, 'DISABLED');
  }
  return view;
}

/** The enabled view for a wire unit tag. Throws `AssetUnavailableError` for any other tag (own keys only, so `toString` is unknown). */
export function assetForUnit(unit: string): AssetView {
  if (!Object.hasOwn(ASSET_REGISTRY, unit)) {
    throw new AssetUnavailableError(unit, 'UNKNOWN_UNIT');
  }
  return assertAssetEnabled(ASSET_REGISTRY[unit as keyof typeof ASSET_REGISTRY]);
}

// ---------------------------------------------------------------------------
// The single conversion module (CONTRACT §6).
// ---------------------------------------------------------------------------

/**
 * The only rounding policy: FLOOR toward zero (amounts are non-negative), and
 * the remainder is returned in the result, never dropped (CONTRACT §6, C-14).
 * Conversions toward finer units (`× k`) are exact. Display uses the same floor.
 */
export const ROUNDING_POLICY = 'FLOOR_REMAINDER_RETURNED';

function precisionError(shown: string): RangeError {
  return new RangeError(`CbsPrecision must be an integer from 0 to 18, got ${shown}`);
}

/**
 * Validate a CBS precision taken from the CBS's own asset configuration
 * (CONTRACT §1.1, Q-C4): an integer 0 ≤ p ≤ 18 (C-10). Integrality is decided
 * by `BigInt(p)`, which throws on a fraction, NaN or ±Infinity; the range is
 * then compared in bigint, so no number arithmetic is needed.
 */
export function cbsPrecision(p: number): CbsPrecision {
  if (typeof p !== 'number') {
    throw new TypeError(`CbsPrecision requires a number, got ${typeof p}`);
  }
  let places: bigint;
  try {
    places = BigInt(p);
  } catch {
    throw precisionError(String(p));
  }
  if (places < 0n || places > USDC_NATIVE.decimals) {
    throw precisionError(String(p));
  }
  return p as CbsPrecision;
}

/** `p` as bigint decimal places. Re-validates `p`, so a cast cannot bypass `cbsPrecision`. */
function placesOf(p: CbsPrecision): bigint {
  return BigInt(cbsPrecision(p));
}

/** `10^(18 − decimals)`: wei per one unit of a view with `decimals` places. */
function weiPer(decimals: bigint): bigint {
  return 10n ** (USDC_NATIVE.decimals - decimals);
}

/** `m = ⌊W/k⌋`, dust `= W mod k`, `k = 10^(18 − p)` (CONTRACT §5, §6). Throws `CbsMinorOverflowError` if `m > CBS_MINOR_MAX`. */
export function nativeWeiToCbsMinor(w: NativeWei, p: CbsPrecision): NativeToCbsResult {
  const wei = checkNativeWei(w);
  const k = weiPer(placesOf(p));
  return { minor: checkCbsMinor(wei / k), dustWei: checkNativeWei(wei % k) };
}

/** `w = m × k`, exact (CONTRACT §6). Outbound amounts are always built this way. Throws `CbsMinorOverflowError` if `m > CBS_MINOR_MAX`. */
export function cbsMinorToNativeWei(m: CbsMinor, p: CbsPrecision): NativeWei {
  const k = weiPer(placesOf(p));
  return checkNativeWei(checkCbsMinor(m) * k);
}

/** `u = ⌊w / 10¹²⌋`, remainder `w mod 10¹²` reported (CONTRACT §6, C-13, C-14). */
export function nativeWeiToUsdcUnits(w: NativeWei): NativeToUsdcResult {
  const wei = checkNativeWei(w);
  const k = weiPer(USDC_ERC20.decimals);
  return { units: checkUsdcUnits(wei / k), remainderWei: checkNativeWei(wei % k) };
}

/** `w = u × 10¹²`, exact (CONTRACT §6). */
export function usdcUnitsToNativeWei(u: UsdcUnits): NativeWei {
  return checkNativeWei(checkUsdcUnits(u) * weiPer(USDC_ERC20.decimals));
}

// ---------------------------------------------------------------------------
// Display (CONTRACT §6 "any → display"): integer formatting only, at most
// DISPLAY_MAX_PLACES (6) dp in every view, never 18 dp.
// ---------------------------------------------------------------------------

/** A native amount as shown to a user: 6 dp USDC text, plus the wei below 10⁻⁶ USDC that the text does not show. */
export interface NativeDisplay {
  readonly text: string;
  readonly hiddenWei: NativeWei;
}

/** `value / 10^places` as a plain decimal string, built from bigint division and remainder only. */
function formatScaled(value: bigint, places: bigint): string {
  if (places === 0n) {
    return value.toString();
  }
  const scale = 10n ** places;
  // scale + (value mod scale) has exactly places + 1 digits; dropping the leading one zero-pads the fraction.
  const fraction = (scale + (value % scale)).toString().slice(1);
  return `${value / scale}.${fraction}`;
}

/**
 * Most decimal places ever shown to a user: 6, the USDC ERC-20 precision
 * (C-11; C-13 "divide by 10¹²" for display). CONTRACT §6 "Never show 18 dp to
 * users" applies to every view, so a CBS amount at p > 6 is floored too.
 */
export const DISPLAY_MAX_PLACES: bigint = USDC_ERC20.decimals;

/** A CBS amount as shown to a user: at most 6 dp, plus the minor units below the last shown place. */
export interface CbsDisplay {
  readonly text: string;
  readonly hiddenMinor: CbsMinor;
}

/**
 * A CBS amount as decimal text with `min(p, 6)` places (12345n at p = 2 gives
 * the text 123 point 45, exact). At p > 6 the text is floored to 6 dp and the
 * minor units below it are returned as `hiddenMinor`, never dropped
 * (ROUNDING_POLICY); at p ≤ 6, `hiddenMinor` is 0.
 */
export function formatCbsMinor(m: CbsMinor, p: CbsPrecision): CbsDisplay {
  const places = placesOf(p);
  const minor = checkCbsMinor(m);
  // Stryker disable next-line EqualityOperator: equivalent mutant; at places = 6 both branches give 6.
  const shown = places > DISPLAY_MAX_PLACES ? DISPLAY_MAX_PLACES : places;
  const hiddenScale = 10n ** (places - shown);
  return { text: formatScaled(minor / hiddenScale, shown), hiddenMinor: checkCbsMinor(minor % hiddenScale) };
}

/** An ERC-20 amount as USDC text with exactly 6 places, exact. */
export function formatUsdcUnits(u: UsdcUnits): string {
  return formatScaled(checkUsdcUnits(u), USDC_ERC20.decimals);
}

/**
 * A native amount for display: floored to 6 dp USDC (C-13 "divide by 10¹²"),
 * never 18 dp. The wei below 10⁻⁶ USDC is returned as `hiddenWei`, never
 * dropped (ROUNDING_POLICY).
 */
export function formatNativeWei(w: NativeWei): NativeDisplay {
  const { units, remainderWei } = nativeWeiToUsdcUnits(w);
  return { text: formatUsdcUnits(units), hiddenWei: remainderWei };
}

// ---------------------------------------------------------------------------
// Same-unit arithmetic. The only sanctioned way to sum or subtract amounts;
// a negative difference throws RangeError and a CBS sum above CBS_MINOR_MAX
// throws CbsMinorOverflowError (fail closed).
// ---------------------------------------------------------------------------

export function addCbsMinor(a: CbsMinor, b: CbsMinor): CbsMinor {
  return checkCbsMinor(checkCbsMinor(a) + checkCbsMinor(b));
}

export function subtractCbsMinor(a: CbsMinor, b: CbsMinor): CbsMinor {
  return checkCbsMinor(checkCbsMinor(a) - checkCbsMinor(b));
}

export function addUsdcUnits(a: UsdcUnits, b: UsdcUnits): UsdcUnits {
  return checkUsdcUnits(checkUsdcUnits(a) + checkUsdcUnits(b));
}

export function subtractUsdcUnits(a: UsdcUnits, b: UsdcUnits): UsdcUnits {
  return checkUsdcUnits(checkUsdcUnits(a) - checkUsdcUnits(b));
}

export function addNativeWei(a: NativeWei, b: NativeWei): NativeWei {
  return checkNativeWei(checkNativeWei(a) + checkNativeWei(b));
}

export function subtractNativeWei(a: NativeWei, b: NativeWei): NativeWei {
  return checkNativeWei(checkNativeWei(a) - checkNativeWei(b));
}
