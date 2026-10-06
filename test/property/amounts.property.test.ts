import fc from 'fast-check';
import { describe, it } from 'vitest';
import { CBS_MINOR_MAX, CbsMinorOverflowError, cbsMinor, nativeWei, usdcUnits } from '../../src/amounts/index.js';

const unbounded = [usdcUnits, nativeWei] as const;
const all = [cbsMinor, usdcUnits, nativeWei] as const;

describe('branded amount constructors (property)', () => {
  it('UsdcUnits and NativeWei accept every non-negative bigint unchanged', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 2n ** 256n }), fc.integer({ min: 0, max: 1 }), (v, i) => unbounded[i]!(v) === v),
      { numRuns: 1000 },
    );
  });

  it('CbsMinor accepts exactly 0 ≤ v ≤ CBS_MINOR_MAX, unchanged, and refuses above with CbsMinorOverflowError', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 2n ** 70n }), (v) => {
        try {
          return cbsMinor(v) === v && v <= CBS_MINOR_MAX;
        } catch (error) {
          return error instanceof CbsMinorOverflowError && error.minor === v && v > CBS_MINOR_MAX;
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('every negative bigint is refused by every constructor', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(2n ** 256n), max: -1n }), fc.integer({ min: 0, max: 2 }), (v, i) => {
        try {
          all[i]!(v);
          return false;
        } catch (error) {
          return error instanceof RangeError && !(error instanceof CbsMinorOverflowError);
        }
      }),
      { numRuns: 1000 },
    );
  });
});
