/**
 * JQUOTE, CLAUDE.md "Mixing types is a compile error" for `FiatMinor<CCY>`
 * (verifier JQUOTE-R1 m1): amounts in two literal currencies, or a fiat amount
 * and a U1 amount, cannot be combined or assigned to each other.
 *
 * Checked by `tsc --noEmit` (this file is in tsconfig.json `include`): an
 * `@ts-expect-error` that no longer has an error is itself an error (TS2578).
 * Because `@ts-expect-error` accepts ANY error, test/unit/jquote-fiat-mixing.test.ts
 * strips every directive and re-runs tsc to prove each line fails with exactly
 * the TS code named in its `expect TSnnnn` tag, and that nothing else fails.
 *
 * Tag format (one per directive): `MIX:<id> expect TS<code>`.
 */
import { cbsMinor } from '../../src/amounts/index.js';
import type { CbsMinor } from '../../src/amounts/index.js';
import { addFiat, fiatAmount, subtractFiat } from '../../src/journey/quote/fiat.js';
import type { FiatAmount, FiatMinor } from '../../src/journey/quote/fiat.js';

const zar: FiatAmount<'ZAR'> = fiatAmount('ZAR', 500n);
const zar2: FiatAmount<'ZAR'> = fiatAmount('ZAR', 200n);
const usd: FiatAmount<'USD'> = fiatAmount('USD', 1n);
const c: CbsMinor = cbsMinor(1n);
const raw: bigint = 1n;

// Positive controls: same-currency use compiles.
export const okAdd: FiatAmount<'ZAR'> = addFiat(zar, zar2);
export const okSub: FiatAmount<'ZAR'> = subtractFiat(zar, zar2);
export const okMinor: FiatMinor<'ZAR'> = zar.minor;

// --- Two literal currencies -------------------------------------------------
// @ts-expect-error MIX:add-zar-usd expect TS2345
export const m1 = addFiat(zar, usd);
// @ts-expect-error MIX:add-usd-zar expect TS2345
export const m2 = addFiat(usd, zar);
// @ts-expect-error MIX:sub-zar-usd expect TS2345
export const m3 = subtractFiat(zar, usd);
// @ts-expect-error MIX:sub-usd-zar expect TS2345
export const m4 = subtractFiat(usd, zar);
// @ts-expect-error MIX:assign-amount-zar-to-usd expect TS2322
export const m5: FiatAmount<'USD'> = zar;
// @ts-expect-error MIX:assign-minor-zar-to-usd expect TS2322
export const m6: FiatMinor<'USD'> = zar.minor;

// --- Fiat vs U1 brands and plain bigints ------------------------------------
// @ts-expect-error MIX:assign-minor-zar-to-cbs expect TS2322
export const m7: CbsMinor = zar.minor;
// @ts-expect-error MIX:assign-cbs-to-minor-zar expect TS2322
export const m8: FiatMinor<'ZAR'> = c;
// @ts-expect-error MIX:assign-bigint-to-minor-zar expect TS2322
export const m9: FiatMinor<'ZAR'> = raw;
