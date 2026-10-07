/**
 * PORTS unit, journey (docs/NOVA_ARC_DESIGN.md §4.1). Operator correction:
 * the payer picks fiat or stablecoin to pay, the receiver picks fiat or
 * stablecoin to receive. All four combinations are modelled.
 */
import { describe, expect, it } from 'vitest';
import { beneficiaryRef, fiatCode } from '../../src/nova-ports/ids.js';
import { D1_FLAGS, journeyEnabled, journeyLegs, legsMatchJourney } from '../../src/status/journey.js';
import type { PayInMethod, PayoutMethod } from '../../src/status/journey.js';

const ben = beneficiaryRef('ben-1');
const ZAR = fiatCode('ZAR');
const balance: PayInMethod = { method: 'STABLECOIN_BALANCE', asset: 'USDC', network: 'ARC' };
const deposit: PayInMethod = { method: 'STABLECOIN_DEPOSIT', asset: 'USDC', network: 'ARC' };
const fiatIn: PayInMethod = { method: 'FIAT', currency: ZAR };
const wallet: PayoutMethod = { method: 'STABLECOIN_WALLET', asset: 'USDC', network: 'ARC', beneficiaryRef: ben };
const bank: PayoutMethod = { method: 'FIAT_BANK', currency: ZAR, beneficiaryRef: ben };

describe('journeyLegs: the §4.1 table', () => {
  it.each([
    ['stablecoin balance → stablecoin wallet (D1)', balance, wallet, ['RESERVE', 'ARC_TRANSFER']],
    ['stablecoin deposit → stablecoin wallet (D2)', deposit, wallet, ['AWAIT_DEPOSIT', 'RESERVE', 'ARC_TRANSFER']],
    ['fiat → stablecoin wallet (D5)', fiatIn, wallet, ['RESERVE', 'CONVERT_IN', 'ARC_TRANSFER']],
    ['stablecoin balance → fiat bank', balance, bank, ['RESERVE', 'ARC_TRANSFER', 'PAYOUT']],
    ['stablecoin deposit → fiat bank', deposit, bank, ['AWAIT_DEPOSIT', 'RESERVE', 'ARC_TRANSFER', 'PAYOUT']],
    ['fiat → fiat bank', fiatIn, bank, ['RESERVE', 'CONVERT_IN', 'ARC_TRANSFER', 'PAYOUT']],
  ] as const)('%s', (_n, payIn, payout, legs) => {
    expect(journeyLegs(payIn, payout)).toEqual(legs);
    expect(Object.isFrozen(journeyLegs(payIn, payout))).toBe(true);
    expect(legsMatchJourney(payIn, payout, legs)).toBe(true);
    expect(legsMatchJourney(payIn, payout, legs.slice(1))).toBe(false);
    expect(legsMatchJourney(payIn, payout, [...legs].reverse())).toBe(false);
  });
});

describe('journeyEnabled: closed flags refuse, never switch', () => {
  it('D1 enables only stablecoin balance → stablecoin wallet', () => {
    expect(D1_FLAGS).toEqual({ fiatEnabled: false, stablecoinDepositEnabled: false });
    expect(journeyEnabled(balance, wallet, D1_FLAGS)).toBe(true);
    for (const [i, o] of [
      [deposit, wallet],
      [fiatIn, wallet],
      [balance, bank],
      [deposit, bank],
      [fiatIn, bank],
    ] as const)
      expect(journeyEnabled(i, o, D1_FLAGS)).toBe(false);
  });
  it('the fiat flag covers fiat pay-in (payer) and fiat payout (receiver)', () => {
    const f = { fiatEnabled: true, stablecoinDepositEnabled: false };
    expect(journeyEnabled(fiatIn, wallet, f)).toBe(true);
    expect(journeyEnabled(balance, bank, f)).toBe(true);
    expect(journeyEnabled(fiatIn, bank, f)).toBe(true);
    expect(journeyEnabled(deposit, bank, f)).toBe(false);
  });
  it('the deposit flag covers stablecoin deposit pay-in only', () => {
    const d = { fiatEnabled: false, stablecoinDepositEnabled: true };
    expect(journeyEnabled(deposit, wallet, d)).toBe(true);
    expect(journeyEnabled(deposit, bank, d)).toBe(false);
    expect(journeyEnabled(fiatIn, wallet, d)).toBe(false);
    expect(journeyEnabled(deposit, bank, { fiatEnabled: true, stablecoinDepositEnabled: true })).toBe(true);
  });
});
