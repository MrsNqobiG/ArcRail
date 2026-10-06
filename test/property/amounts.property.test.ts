import fc from 'fast-check';
import { describe, it } from 'vitest';
import { cbsMinor, nativeWei, usdcUnits } from '../../src/amounts/index.js';

const constructors = [cbsMinor, usdcUnits, nativeWei] as const;

describe('branded amount constructors (property)', () => {
  it('every non-negative bigint is accepted unchanged', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 2n ** 256n }), fc.integer({ min: 0, max: 2 }), (v, i) => {
        return constructors[i]!(v) === v;
      }),
      { numRuns: 1000 },
    );
  });

  it('every negative bigint is refused', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(2n ** 256n), max: -1n }), fc.integer({ min: 0, max: 2 }), (v, i) => {
        try {
          constructors[i]!(v);
          return false;
        } catch (error) {
          return error instanceof RangeError;
        }
      }),
      { numRuns: 1000 },
    );
  });
});
