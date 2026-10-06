/**
 * RUBRIC MC-02, constructor route (verifier P3-U1-lensR-2 D1): a branded amount
 * cannot be passed to another unit's public constructor, so one unit cannot be
 * re-labelled as another without a CONTRACT §6 conversion. Re-branding into the
 * same unit is refused too (it is never needed outside src/amounts/index.ts).
 *
 * Checked by `tsc --noEmit` (this file is in tsconfig.json `include`). Because
 * `@ts-expect-error` accepts ANY error, test/unit/amounts-ctor-mixing.test.ts
 * strips every directive and re-runs tsc to prove each line fails with exactly
 * the TS code named in its `expect TSnnnn` tag, and that nothing else fails.
 *
 * Tag format (one per directive): `MIX:<id> expect TS<code>`.
 */
import { cbsMinor, nativeWei, usdcUnits } from '../../src/amounts/index.js';
import * as amounts from '../../src/amounts/index.js';
import type { CbsMinor, NativeWei, UsdcUnits } from '../../src/amounts/index.js';

const c: CbsMinor = cbsMinor(1n);
const u: UsdcUnits = usdcUnits(1n);
const w: NativeWei = nativeWei(1n);
const raw: bigint = 5n;
const pick = (first: boolean): UsdcUnits | CbsMinor => (first ? u : c);

// Positive controls: a plain bigint (literal or bigint-typed value) is accepted.
export const okC: CbsMinor = cbsMinor(raw);
export const okU: UsdcUnits = usdcUnits(raw);
export const okW: NativeWei = nativeWei(10n ** 18n);
export const okHex: NativeWei = nativeWei(BigInt('0x10'));

// --- Constructor argument, one per ordered pair of distinct units ----------
// @ts-expect-error MIX:ctor-cbs-to-usdc expect TS2345
export const k1 = usdcUnits(c);
// @ts-expect-error MIX:ctor-cbs-to-wei expect TS2345
export const k2 = nativeWei(c);
// @ts-expect-error MIX:ctor-usdc-to-cbs expect TS2345
export const k3 = cbsMinor(u);
// @ts-expect-error MIX:ctor-usdc-to-wei expect TS2345
export const k4 = nativeWei(u);
// @ts-expect-error MIX:ctor-wei-to-cbs expect TS2345
export const k5 = cbsMinor(w);
// @ts-expect-error MIX:ctor-wei-to-usdc expect TS2345
export const k6 = usdcUnits(w);

// --- Same-unit re-brand (no use outside the conversion module) -------------
// @ts-expect-error MIX:ctor-cbs-to-cbs expect TS2345
export const r1 = cbsMinor(c);
// @ts-expect-error MIX:ctor-usdc-to-usdc expect TS2345
export const r2 = usdcUnits(u);
// @ts-expect-error MIX:ctor-wei-to-wei expect TS2345
export const r3 = nativeWei(w);

// --- Other call forms ---------------------------------------------------------
// @ts-expect-error MIX:ctor-namespace-wei-to-cbs expect TS2345
export const f1 = amounts.cbsMinor(w);
// @ts-expect-error MIX:ctor-union-to-wei expect TS2345
export const f2 = nativeWei(pick(true));
// @ts-expect-error MIX:ctor-result-field-to-usdc expect TS2345
export const f3 = usdcUnits(amounts.nativeWeiToCbsMinor(w, amounts.cbsPrecision(6)).minor);
