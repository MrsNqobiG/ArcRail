/**
 * RUBRIC MC-02: mixing CbsMinor, UsdcUnits and NativeWei fails to compile.
 *
 * Checked by `tsc --noEmit` (this file is in tsconfig.json `include`): an
 * `@ts-expect-error` that no longer has an error is itself an error (TS2578).
 * Because `@ts-expect-error` accepts ANY error, test/unit/amount-mixing.test.ts
 * strips every directive and re-runs tsc to prove each line fails with exactly
 * the TS code named in its `expect TSnnnn` tag, and that nothing else fails.
 *
 * Tag format (one per directive): `MIX:<id> expect TS<code>`.
 */
import { cbsMinor, nativeWei, usdcUnits } from '../../src/amounts/index.js';
import type { CbsMinor, NativeWei, UsdcUnits } from '../../src/amounts/index.js';

const c: CbsMinor = cbsMinor(1n);
const u: UsdcUnits = usdcUnits(1n);
const w: NativeWei = nativeWei(1n);

function takesCbsMinor(x: CbsMinor): CbsMinor {
  return x;
}
function takesUsdcUnits(x: UsdcUnits): UsdcUnits {
  return x;
}
function takesNativeWei(x: NativeWei): NativeWei {
  return x;
}

// Positive controls: same-type use compiles.
export const okC: CbsMinor = takesCbsMinor(c);
export const okU: UsdcUnits = takesUsdcUnits(u);
export const okW: NativeWei = takesNativeWei(w);

// --- Assignment, one per ordered pair -------------------------------------
// @ts-expect-error MIX:assign-cbs-to-usdc expect TS2322
export const a1: UsdcUnits = c;
// @ts-expect-error MIX:assign-cbs-to-wei expect TS2322
export const a2: NativeWei = c;
// @ts-expect-error MIX:assign-usdc-to-cbs expect TS2322
export const a3: CbsMinor = u;
// @ts-expect-error MIX:assign-usdc-to-wei expect TS2322
export const a4: NativeWei = u;
// @ts-expect-error MIX:assign-wei-to-cbs expect TS2322
export const a5: CbsMinor = w;
// @ts-expect-error MIX:assign-wei-to-usdc expect TS2322
export const a6: UsdcUnits = w;

// --- Argument passing, one per ordered pair --------------------------------
// @ts-expect-error MIX:arg-cbs-to-usdc expect TS2345
export const p1 = takesUsdcUnits(c);
// @ts-expect-error MIX:arg-cbs-to-wei expect TS2345
export const p2 = takesNativeWei(c);
// @ts-expect-error MIX:arg-usdc-to-cbs expect TS2345
export const p3 = takesCbsMinor(u);
// @ts-expect-error MIX:arg-usdc-to-wei expect TS2345
export const p4 = takesNativeWei(u);
// @ts-expect-error MIX:arg-wei-to-cbs expect TS2345
export const p5 = takesCbsMinor(w);
// @ts-expect-error MIX:arg-wei-to-usdc expect TS2345
export const p6 = takesUsdcUnits(w);

// --- Equality comparison, one per unordered pair ---------------------------
// @ts-expect-error MIX:eq-cbs-usdc expect TS2367
export const e1 = c === u;
// @ts-expect-error MIX:eq-cbs-wei expect TS2367
export const e2 = c === w;
// @ts-expect-error MIX:eq-usdc-wei expect TS2367
export const e3 = u === w;

// --- Raw arithmetic across types cannot land in any branded slot -----------
// @ts-expect-error MIX:sum-cbs-usdc-into-cbs expect TS2322
export const s1: CbsMinor = c + u;
// @ts-expect-error MIX:sum-cbs-wei-into-wei expect TS2322
export const s2: NativeWei = c + w;
// @ts-expect-error MIX:sum-usdc-wei-into-usdc expect TS2322
export const s3: UsdcUnits = u + w;

// --- Unbranded values cannot pose as amounts --------------------------------
// @ts-expect-error MIX:bigint-to-cbs expect TS2322
export const b1: CbsMinor = 1n;
// @ts-expect-error MIX:bigint-to-usdc expect TS2322
export const b2: UsdcUnits = 1n;
// @ts-expect-error MIX:bigint-to-wei expect TS2322
export const b3: NativeWei = 1n;
// @ts-expect-error MIX:number-to-cbs expect TS2322
export const n1: CbsMinor = 1;
// @ts-expect-error MIX:number-to-usdc expect TS2322
export const n2: UsdcUnits = 1;
// @ts-expect-error MIX:number-to-wei expect TS2322
export const n3: NativeWei = 1;
// @ts-expect-error MIX:number-to-ctor expect TS2345
export const n4 = cbsMinor(1);
