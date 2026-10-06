/**
 * U1 conversion module (CONTRACT §6), property tests: round trips,
 * conservation (m × k + dust = w, nothing dropped), dust bounds, the overflow
 * boundary on every CbsMinor route, the display row, and agreement with an
 * independent string-based reference.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CBS_MINOR_MAX,
  CbsMinorOverflowError,
  addCbsMinor,
  cbsMinor,
  cbsMinorToNativeWei,
  cbsPrecision,
  formatCbsMinor,
  formatNativeWei,
  formatUsdcUnits,
  nativeWei,
  nativeWeiToCbsMinor,
  nativeWeiToUsdcUnits,
  subtractCbsMinor,
  usdcUnits,
  usdcUnitsToNativeWei,
} from '../../src/amounts/index.js';

const RUNS = { numRuns: 1000 };
const precision = fc.integer({ min: 0, max: 18 });
const kOf = (p: number): bigint => 10n ** BigInt(18 - p);
/** Any wei amount whose m fits the CBS, for precision p. */
const fittingWei = (p: number): fc.Arbitrary<bigint> => fc.bigInt({ min: 0n, max: CBS_MINOR_MAX * kOf(p) + kOf(p) - 1n });
const anyWei = fc.bigInt({ min: 0n, max: 2n ** 256n - 1n });
const anyMinor = fc.bigInt({ min: 0n, max: CBS_MINOR_MAX });

/** Independent reference: shift the decimal point in the string form, no division. */
function referenceSplit(w: bigint, places: number): { whole: bigint; rest: bigint } {
  const s = w.toString().padStart(places + 1, '0');
  const cut = s.length - places;
  return { whole: BigInt(s.slice(0, cut)), rest: places === 0 ? 0n : BigInt(s.slice(cut)) };
}

/** Independent reference for display: the digits with a point inserted `places` from the right. */
function referenceText(v: bigint, places: number): string {
  if (places === 0) return v.toString();
  const s = v.toString().padStart(places + 1, '0');
  return `${s.slice(0, s.length - places)}.${s.slice(s.length - places)}`;
}

describe('NATIVE_WEI → CBS_MINOR(p)', () => {
  it('conserves value: m × k + dust = w, with 0 ≤ dust < k', () => {
    fc.assert(
      fc.property(precision.chain((p) => fc.tuple(fc.constant(p), fittingWei(p))), ([p, w]) => {
        const k = kOf(p);
        const { minor, dustWei } = nativeWeiToCbsMinor(nativeWei(w), cbsPrecision(p));
        return minor * k + dustWei === w && dustWei >= 0n && dustWei < k && minor <= CBS_MINOR_MAX;
      }),
      RUNS,
    );
  });

  it('agrees with a string-shift reference (floor, remainder returned)', () => {
    fc.assert(
      fc.property(precision.chain((p) => fc.tuple(fc.constant(p), fittingWei(p))), ([p, w]) => {
        const ref = referenceSplit(w, 18 - p);
        const got = nativeWeiToCbsMinor(nativeWei(w), cbsPrecision(p));
        return got.minor === ref.whole && got.dustWei === ref.rest;
      }),
      RUNS,
    );
  });

  it('dust is zero exactly when w is a multiple of k', () => {
    fc.assert(
      fc.property(precision, anyMinor, fc.bigInt({ min: 0n, max: 10n ** 18n }), (p, m, extra) => {
        const k = kOf(p);
        const dust = extra % k;
        const r = nativeWeiToCbsMinor(nativeWei(m * k + dust), cbsPrecision(p));
        return r.minor === m && r.dustWei === dust && (r.dustWei === 0n) === (dust === 0n);
      }),
      RUNS,
    );
  });

  it('is monotonic: more wei never gives fewer minor units', () => {
    fc.assert(
      fc.property(precision.chain((p) => fc.tuple(fc.constant(p), fittingWei(p), fittingWei(p))), ([p, a, b]) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return nativeWeiToCbsMinor(nativeWei(lo), cbsPrecision(p)).minor <= nativeWeiToCbsMinor(nativeWei(hi), cbsPrecision(p)).minor;
      }),
      RUNS,
    );
  });

  it('overflow boundary: the largest fitting w passes, every w ≥ (MAX + 1) × k is refused', () => {
    fc.assert(
      fc.property(precision, fc.bigInt({ min: 0n, max: 2n ** 200n }), (p, extra) => {
        const k = kOf(p);
        const top = nativeWeiToCbsMinor(nativeWei(CBS_MINOR_MAX * k + k - 1n), cbsPrecision(p));
        expect(top).toEqual({ minor: CBS_MINOR_MAX, dustWei: k - 1n });
        expect(() => nativeWeiToCbsMinor(nativeWei((CBS_MINOR_MAX + 1n) * k + extra), cbsPrecision(p))).toThrow(CbsMinorOverflowError);
      }),
      { numRuns: 300 },
    );
  });
});

describe('CBS_MINOR(p) → NATIVE_WEI', () => {
  it('round trip m → w → m is exact with zero dust', () => {
    fc.assert(
      fc.property(precision, anyMinor, (p, m) => {
        const w = cbsMinorToNativeWei(cbsMinor(m), cbsPrecision(p));
        const back = nativeWeiToCbsMinor(w, cbsPrecision(p));
        return w === m * kOf(p) && back.minor === m && back.dustWei === 0n;
      }),
      RUNS,
    );
  });

  it('round trip w → (m, dust) → m × k + dust = w', () => {
    fc.assert(
      fc.property(precision.chain((p) => fc.tuple(fc.constant(p), fittingWei(p))), ([p, w]) => {
        const { minor, dustWei } = nativeWeiToCbsMinor(nativeWei(w), cbsPrecision(p));
        return cbsMinorToNativeWei(minor, cbsPrecision(p)) + dustWei === w;
      }),
      RUNS,
    );
  });

  it('every m above CBS_MINOR_MAX is refused, even when cast past the constructor', () => {
    fc.assert(
      fc.property(precision, fc.bigInt({ min: CBS_MINOR_MAX + 1n, max: 2n ** 256n }), (p, m) => {
        expect(() => cbsMinor(m)).toThrow(CbsMinorOverflowError);
        expect(() => cbsMinorToNativeWei(m as Parameters<typeof cbsMinorToNativeWei>[0], cbsPrecision(p))).toThrow(CbsMinorOverflowError);
      }),
      { numRuns: 300 },
    );
  });
});

describe('same-unit CBS arithmetic keeps the bound', () => {
  it('addCbsMinor returns a + b when it fits and throws CbsMinorOverflowError exactly when it does not', () => {
    fc.assert(
      fc.property(anyMinor, anyMinor, (a, b) => {
        try {
          return addCbsMinor(cbsMinor(a), cbsMinor(b)) === a + b && a + b <= CBS_MINOR_MAX;
        } catch (error) {
          return error instanceof CbsMinorOverflowError && a + b > CBS_MINOR_MAX;
        }
      }),
      RUNS,
    );
  });

  it('subtractCbsMinor undoes addCbsMinor', () => {
    fc.assert(
      fc.property(anyMinor, anyMinor, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const diff = subtractCbsMinor(cbsMinor(hi), cbsMinor(lo));
        return addCbsMinor(diff, cbsMinor(lo)) === hi;
      }),
      RUNS,
    );
  });
});

describe('NATIVE_WEI ↔ USDC_UNITS (10¹², C-13)', () => {
  it('w → (u, remainder) conserves value and agrees with the string-shift reference', () => {
    fc.assert(
      fc.property(anyWei, (w) => {
        const { units, remainderWei } = nativeWeiToUsdcUnits(nativeWei(w));
        const ref = referenceSplit(w, 12);
        return units * 10n ** 12n + remainderWei === w && units === ref.whole && remainderWei === ref.rest && remainderWei < 10n ** 12n;
      }),
      RUNS,
    );
  });

  it('round trip u → w → u is exact with zero remainder', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 2n ** 200n }), (u) => {
        const w = usdcUnitsToNativeWei(usdcUnits(u));
        const back = nativeWeiToUsdcUnits(w);
        return w === u * 10n ** 12n && back.units === u && back.remainderWei === 0n;
      }),
      RUNS,
    );
  });

  it('at p = 6 the CBS minor split and the ERC-20 split are identical', () => {
    fc.assert(
      fc.property(fittingWei(6), (w) => {
        const a = nativeWeiToCbsMinor(nativeWei(w), cbsPrecision(6));
        const b = nativeWeiToUsdcUnits(nativeWei(w));
        const minor: bigint = a.minor;
        const units: bigint = b.units;
        return minor === units && a.dustWei === b.remainderWei;
      }),
      RUNS,
    );
  });
});

describe('display (CONTRACT §6 "any → display")', () => {
  it('formatCbsMinor matches the string-shift reference for every p ≤ 6, with nothing hidden', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), anyMinor, (p, m) => {
        const shown = formatCbsMinor(cbsMinor(m), cbsPrecision(p));
        return shown.text === referenceText(m, p) && shown.hiddenMinor === 0n;
      }),
      RUNS,
    );
  });

  it('formatCbsMinor never shows more than 6 dp, and text plus hidden minor conserve the value for every p', () => {
    fc.assert(
      fc.property(precision, anyMinor, (p, m) => {
        const { text, hiddenMinor } = formatCbsMinor(cbsMinor(m), cbsPrecision(p));
        const places = p < 6 ? p : 6;
        const hiddenScale = 10n ** BigInt(p - places);
        const shownMinor = BigInt(text.replace('.', ''));
        const shape = places === 0 ? /^\d+$/ : new RegExp(`^\\d+\\.\\d{${places}}$`);
        return shape.test(text) && shownMinor * hiddenScale + hiddenMinor === m && hiddenMinor < hiddenScale && text === referenceText(m / hiddenScale, places);
      }),
      RUNS,
    );
  });

  it('formatUsdcUnits matches the reference with exactly 6 places', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 2n ** 200n }), (u) => {
        const text = formatUsdcUnits(usdcUnits(u));
        return text === referenceText(u, 6) && /^\d+\.\d{6}$/.test(text);
      }),
      RUNS,
    );
  });

  it('formatNativeWei never shows more than 6 dp and returns every hidden wei', () => {
    fc.assert(
      fc.property(anyWei, (w) => {
        const { text, hiddenWei } = formatNativeWei(nativeWei(w));
        const shownUnits = BigInt(text.replace('.', ''));
        return /^\d+\.\d{6}$/.test(text) && shownUnits * 10n ** 12n + hiddenWei === w && hiddenWei < 10n ** 12n;
      }),
      RUNS,
    );
  });
});

describe('cbsPrecision', () => {
  it('accepts exactly the integers 0..18', () => {
    fc.assert(
      fc.property(fc.double({ min: -100, max: 100, noNaN: false }), (x) => {
        const valid = Number.isInteger(x) && x >= 0 && x <= 18;
        let ok = true;
        try {
          cbsPrecision(x);
        } catch {
          ok = false;
        }
        return ok === valid;
      }),
      { numRuns: 2000 },
    );
  });
});
