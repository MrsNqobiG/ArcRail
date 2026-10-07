/**
 * PORTS unit, identifiers, result model and stateless checks
 * (docs/NOVA_ARC_DESIGN.md §7.1, §7.2, §7.4, §7.5a, §7.8).
 */
import { describe, expect, it } from 'vitest';
import { cbsMinor, CBS_MINOR_MAX, cbsPrecision } from '../../src/amounts/index.js';
import type { CbsMinor } from '../../src/amounts/index.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import {
  ambiguous,
  beneficiaryRef,
  fiatCode,
  idempotencyKey,
  isIdempotencyKey,
  isPaymentId,
  ledgerAssetCode,
  normaliseAddress,
  normaliseHex32,
  novaAccountRef,
  novaOwnerRef,
  ok,
  paymentId,
  rejected,
  walletRef,
} from '../../src/nova-ports/ids.js';
import type { BeneficiaryRef, FiatCode, IdempotencyKey, LedgerAssetCode, NovaAccountRef, PaymentId } from '../../src/nova-ports/ids.js';
import {
  accountKey,
  canonicalJournal,
  checkJournalShape,
  COMPENSABLE_TEMPLATES,
  evaluateJournal,
  GL_NORMAL_SIDE,
  mirrorLegs,
  PAYMENT_OPTIONAL_TEMPLATES,
  POSTING_TEMPLATES,
  RAIL_LEVEL_TEMPLATES,
  sumSide,
} from '../../src/nova-ports/ledger.js';
import type { JournalRequest, LedgerLeg, LedgerView, PostingTemplateId } from '../../src/nova-ports/ledger.js';
import { checkResolvedPayout } from '../../src/nova-ports/receiver.js';
import type { ResolvedPayout } from '../../src/nova-ports/receiver.js';

const A = '0x' + 'ab'.repeat(20);

describe('identifiers', () => {
  it('idempotency keys: [a-z0-9:-], 1..128 chars', () => {
    for (const k of ['a', 'pay:pay-0123:p1', 'gas:5042002:0xab', 'x'.repeat(128)]) expect(idempotencyKey(k)).toBe(k);
    for (const k of ['', 'A', 'a b', 'a_b', 'x'.repeat(129), 'é', 'a\n']) {
      expect(isIdempotencyKey(k), JSON.stringify(k)).toBe(false);
      expect(() => idempotencyKey(k)).toThrow(/invalid idempotency key/);
    }
  });
  it('payment ids: pay- + 32 lower-case hex', () => {
    const id = 'pay-' + '0a'.repeat(16);
    expect(paymentId(id)).toBe(id);
    expect(isIdempotencyKey(id)).toBe(true);
    for (const bad of ['pay-' + '0A'.repeat(16), 'pay-' + '0a'.repeat(15), 'pay-' + '0a'.repeat(17), 'xpay-' + '0a'.repeat(16), 'pay-' + '0a'.repeat(16) + '\n']) {
      expect(isPaymentId(bad)).toBe(false);
      expect(() => paymentId(bad)).toThrow(/invalid payment id/);
    }
  });
  it('addresses and hashes are lower-cased on entry and length-checked', () => {
    expect(normaliseAddress(A.toUpperCase().replace('0X', '0x'))).toBe(A);
    expect(normaliseAddress('0X' + 'AB'.repeat(20))).toBe(A);
    expect(normaliseAddress(A + 'ab')).toBeNull();
    expect(normaliseAddress('0x' + 'zz'.repeat(20))).toBeNull();
    expect(normaliseAddress('x' + A)).toBeNull();
    const h = '0x' + 'cd'.repeat(32);
    expect(normaliseHex32(h.toUpperCase().replace('0X', '0x'))).toBe(h);
    expect(normaliseHex32(h + 'c')).toBeNull();
    expect(normaliseHex32('y' + h)).toBeNull();
  });
  it('fiat codes are ISO 4217 alpha-3 upper case', () => {
    expect(fiatCode('ZAR')).toBe('ZAR');
    for (const bad of ['zar', 'ZA', 'ZARR', 'Z1R', ' ZAR']) expect(() => fiatCode(bad)).toThrow(/invalid ISO 4217/);
  });
  it('refs are non-empty, no whitespace, ≤ 255 chars', () => {
    for (const f of [novaAccountRef, novaOwnerRef, walletRef, beneficiaryRef, ledgerAssetCode]) {
      expect(f('x-1')).toBe('x-1');
      expect(f('y'.repeat(255))).toBe('y'.repeat(255));
      for (const bad of ['', 'a b', 'y'.repeat(256), ' a', 'a\t']) expect(() => f(bad)).toThrow(/invalid/);
    }
  });
  it('result constructors', () => {
    expect(ok(1n, true)).toEqual({ kind: 'OK', value: 1n, replayed: true });
    expect(rejected('X', 'd')).toEqual({ kind: 'REJECTED', code: 'X', detail: 'd' });
    expect(ambiguous('TIMEOUT')).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
  });
});

describe('FaultPlan', () => {
  it('fires once per arm, per op and point, first armed first', () => {
    const f = new FaultPlan();
    expect(f.take('op', 'BEFORE_COMMIT')).toBeNull();
    f.arm('op', 'BEFORE_COMMIT', 'TIMEOUT');
    f.arm('op', 'BEFORE_COMMIT', 'TRANSPORT');
    f.arm('op', 'AFTER_COMMIT', 'UNAVAILABLE');
    expect(f.take('other', 'BEFORE_COMMIT')).toBeNull();
    expect(f.take('op', 'AFTER_COMMIT')).toBe('UNAVAILABLE');
    expect(f.take('op', 'AFTER_COMMIT')).toBeNull();
    expect(f.take('op', 'BEFORE_COMMIT')).toBe('TIMEOUT');
    expect(f.take('op', 'BEFORE_COMMIT')).toBe('TRANSPORT');
    expect(f.take('op', 'BEFORE_COMMIT')).toBeNull();
  });
});

// Fixtures are built with casts, not the constructors under test, so a broken
// constructor fails the tests below instead of failing this module's load.
const k = (s: string): IdempotencyKey => s as IdempotencyKey;
const USDC = 'USDC' as LedgerAssetCode;
const p6 = cbsPrecision(6);
const pid = ('pay-' + '11'.repeat(16)) as PaymentId;
const cust = { kind: 'CUSTOMER', account: 'acct-a' as NovaAccountRef } as const;
const clearing = { kind: 'ROLE', role: 'GL-5', sub: 'arc.outbound' } as const;
const leg = (account: LedgerLeg['account'], side: LedgerLeg['side'], amount: bigint): LedgerLeg => ({ account, side, amount: cbsMinor(amount) });
const refs = { paymentId: pid, network: 'ARC', txHash: null, logIndex: null, dfnsTransferId: null, compensates: null } as const;
const journal = (over: Partial<JournalRequest> = {}): JournalRequest => ({
  key: k('pay:x:p1'),
  template: 'P1_RESERVE',
  asset: USDC,
  precision: p6,
  legs: [leg(cust, 'DEBIT', 100n), leg(clearing, 'CREDIT', 100n)],
  refs,
  ...over,
});

describe('ledger: stateless checks', () => {
  it('GL roles and normal sides follow §9.1', () => {
    expect(GL_NORMAL_SIDE).toEqual({ 'GL-1': 'CREDIT', 'GL-2': 'DEBIT', 'GL-3': 'DEBIT', 'GL-4': 'CREDIT', 'GL-5': 'CREDIT', 'GL-6': 'CREDIT', 'GL-7': 'CREDIT' });
    // Exactly §7.2 PostingTemplateId, in the design's order.
    expect(POSTING_TEMPLATES).toEqual([
      'P1_RESERVE',
      'P2_SETTLE_EXTERNAL',
      'P2I_SETTLE_INTERNAL',
      'P2P_PARTNER_FUNDED',
      'P2R_PARTNER_RETURN',
      'P3_FEE',
      'P4_GAS',
      'P5_DUST_SWEEP',
      'P6_RELEASE',
      'P7_COMPENSATE',
      'P8_EXTERNAL_FUNDING',
      'P9_UNIDENTIFIED_RECEIPT',
      'P10_INTERNAL_MOVE',
      'P11_PARTNER_CLAIM',
    ]);
    expect(RAIL_LEVEL_TEMPLATES).toEqual(['P5_DUST_SWEEP', 'P8_EXTERNAL_FUNDING', 'P9_UNIDENTIFIED_RECEIPT', 'P10_INTERNAL_MOVE']);
    expect(PAYMENT_OPTIONAL_TEMPLATES).toEqual(['P4_GAS']);
    expect(COMPENSABLE_TEMPLATES).toEqual(['P2_SETTLE_EXTERNAL', 'P2I_SETTLE_INTERNAL', 'P3_FEE']);
  });
  it('accountKey distinguishes customers and roles', () => {
    expect(accountKey(cust)).toBe('CUSTOMER:acct-a');
    expect(accountKey(clearing)).toBe('ROLE:GL-5:arc.outbound');
  });
  it('a well-formed journal passes', () => {
    expect(checkJournalShape(journal())).toBeNull();
  });
  it.each([
    ['malformed key', journal({ key: 'BAD KEY' as IdempotencyKey }), 'INVALID_JOURNAL', /malformed/],
    ['unknown template', journal({ template: 'P99' as PostingTemplateId }), 'INVALID_JOURNAL', /unknown template/],
    ['payment-level template without paymentId', journal({ refs: { ...refs, paymentId: null } }), 'INVALID_JOURNAL', /paymentId/],
    ['rail-level template with paymentId', journal({ template: 'P9_UNIDENTIFIED_RECEIPT' }), 'INVALID_JOURNAL', /paymentId/],
    ['compensates on a non-P7', journal({ refs: { ...refs, compensates: 'jr-1' } }), 'INVALID_JOURNAL', /compensates/],
    ['P7 without compensates', journal({ template: 'P7_COMPENSATE' }), 'INVALID_JOURNAL', /compensates/],
    ['one leg', journal({ legs: [leg(cust, 'DEBIT', 100n)] }), 'INVALID_JOURNAL', /two legs/],
    ['zero amount', journal({ legs: [leg(cust, 'DEBIT', 0n), leg(clearing, 'CREDIT', 0n)] }), 'INVALID_JOURNAL', /> 0/],
    ['debits only', journal({ legs: [leg(cust, 'DEBIT', 1n), leg(clearing, 'DEBIT', 1n)] }), 'UNBALANCED', /both a debit and a credit/],
    ['credits only', journal({ legs: [leg(cust, 'CREDIT', 1n), leg(clearing, 'CREDIT', 1n)] }), 'UNBALANCED', /both a debit and a credit/],
    ['off by one base unit', journal({ legs: [leg(cust, 'DEBIT', 101n), leg(clearing, 'CREDIT', 100n)] }), 'UNBALANCED', /debits 101 != credits 100/],
    [
      'total above CBS_MINOR_MAX',
      journal({ legs: [leg(cust, 'DEBIT', CBS_MINOR_MAX), leg(cust, 'DEBIT', 1n), leg(clearing, 'CREDIT', 1n)] }),
      'INVALID_JOURNAL',
      /CBS_MINOR_MAX/,
    ],
  ] as const)('%s', (_n, req, code, detail) => {
    const r = checkJournalShape(req);
    expect(r?.code).toBe(code);
    expect(r?.detail).toMatch(detail);
  });
  it('P5/P8/P9/P10 with no paymentId, P4 with or without one, and P7 with compensates are well-formed', () => {
    for (const template of ['P5_DUST_SWEEP', 'P8_EXTERNAL_FUNDING', 'P9_UNIDENTIFIED_RECEIPT', 'P10_INTERNAL_MOVE', 'P4_GAS'] as const) {
      expect(checkJournalShape(journal({ template, refs: { ...refs, paymentId: null } })), template).toBeNull();
    }
    expect(checkJournalShape(journal({ template: 'P4_GAS' }))).toBeNull();
    expect(checkJournalShape(journal({ template: 'P10_INTERNAL_MOVE' }))?.detail).toMatch(/paymentId must be null for P5\/P8\/P9\/P10 and set for every template but P4/);
    expect(checkJournalShape(journal({ template: 'P2R_PARTNER_RETURN', refs: { ...refs, paymentId: null } }))?.code).toBe('INVALID_JOURNAL');
    expect(checkJournalShape(journal({ template: 'P7_COMPENSATE', refs: { ...refs, compensates: 'jr-1' } }))).toBeNull();
  });
  it('rethrows anything that is not an overflow', () => {
    let reads = 0;
    const boom = {
      get amount() {
        reads += 1;
        if (reads > 1) throw new Error('boom');
        return cbsMinor(1n);
      },
      account: cust,
      side: 'DEBIT',
    } as unknown as LedgerLeg;
    expect(() => checkJournalShape(journal({ legs: [leg(cust, 'DEBIT', 1n), boom, leg(clearing, 'CREDIT', 1n)] }))).toThrow(/boom/);
  });
  it('evaluateJournal turns a total overflow into INVALID_JOURNAL but rethrows any other error (a corrupt view)', () => {
    const view = (debits: bigint): LedgerView => ({
      assetPrecision: () => ({ precision: p6 }),
      accountStatus: () => 'OPEN',
      journalByKey: () => null,
      journalById: () => null,
      isCompensated: () => false,
      paymentJournals: () => [],
      balance: () => ({ debits: debits as CbsMinor, credits: cbsMinor(1_000n) }),
    });
    expect(() => evaluateJournal(journal(), view(-1n))).toThrow(/must not be negative/);
    expect(evaluateJournal(journal(), view(CBS_MINOR_MAX))).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNAL', detail: 'CUSTOMER:acct-a totals would exceed CBS_MINOR_MAX' });
    expect(evaluateJournal(journal(), view(0n))).toBeNull();
  });
  it('sumSide adds one side only', () => {
    const legs = [leg(cust, 'DEBIT', 3n), leg(clearing, 'CREDIT', 5n), leg(cust, 'DEBIT', 4n)];
    expect(sumSide(legs, 'DEBIT')).toBe(7n);
    expect(sumSide(legs, 'CREDIT')).toBe(5n);
    expect(sumSide([], 'CREDIT')).toBe(0n);
  });
  it('mirrorLegs swaps sides and keeps accounts and amounts', () => {
    expect(mirrorLegs([leg(cust, 'DEBIT', 3n), leg(clearing, 'CREDIT', 3n)])).toEqual([leg(cust, 'CREDIT', 3n), leg(clearing, 'DEBIT', 3n)]);
  });
  it('canonicalJournal differs on every field and encodes bigints as strings', () => {
    const base = canonicalJournal(journal());
    expect(base).toContain('"100"');
    const variants: JournalRequest[] = [
      journal({ key: k('pay:x:p2') }),
      journal({ template: 'P6_RELEASE' }),
      journal({ asset: 'ZAR' as LedgerAssetCode }),
      journal({ precision: cbsPrecision(2) }),
      journal({ legs: [leg(cust, 'DEBIT', 101n), leg(clearing, 'CREDIT', 101n)] }),
      journal({ legs: [leg(clearing, 'DEBIT', 100n), leg(cust, 'CREDIT', 100n)] }),
      journal({ refs: { ...refs, network: null } }),
      journal({ refs: { ...refs, txHash: `0x${'ee'.repeat(32)}` } }),
      journal({ refs: { ...refs, logIndex: 3n } }),
      journal({ refs: { ...refs, dfnsTransferId: 'tr-1' } }),
      journal({ refs: { ...refs, compensates: 'jr-1' } }),
      journal({ refs: { ...refs, paymentId: ('pay-' + '22'.repeat(16)) as PaymentId } }),
    ];
    for (const v of variants) expect(canonicalJournal(v)).not.toBe(base);
    expect(canonicalJournal(journal({ refs: { ...refs, logIndex: 3n } }))).toContain('"3"');
    expect(canonicalJournal(journal())).toBe(base);
  });
});

describe('receiver: checkResolvedPayout', () => {
  const ben = 'ben-1' as BeneficiaryRef;
  const other = 'ben-2' as BeneficiaryRef;
  const wallet: ResolvedPayout = {
    payout: { method: 'STABLECOIN_WALLET', asset: 'USDC', network: 'ARC', beneficiaryRef: ben },
    destination: { kind: 'ADDRESS', network: 'ARC', address: `0x${'ab'.repeat(20)}` },
    receiver: null,
    preferenceVersion: 'v1',
  };
  const bank: ResolvedPayout = { payout: { method: 'FIAT_BANK', currency: 'ZAR' as FiatCode, beneficiaryRef: ben }, destination: { kind: 'BANK', beneficiaryRef: ben }, receiver: null, preferenceVersion: 'v1' };
  it('accepts a consistent stablecoin or fiat payout', () => {
    expect(checkResolvedPayout(ben, wallet)).toBeNull();
    expect(checkResolvedPayout(ben, bank)).toBeNull();
  });
  it.each([
    ['preference of another beneficiary', other, wallet, /another beneficiary/],
    ['empty version', ben, { ...wallet, preferenceVersion: '' }, /version/],
    ['stablecoin payout to a bank record', ben, { ...wallet, destination: { kind: 'BANK', beneficiaryRef: ben } }, /stablecoin payout/],
    ['stablecoin payout on another network', ben, { ...wallet, destination: { kind: 'ADDRESS', network: 'FAKENET', address: `0x${'ab'.repeat(20)}` } }, /stablecoin payout/],
    ['stablecoin payout to a non-normalised address', ben, { ...wallet, destination: { kind: 'ADDRESS', network: 'ARC', address: `0x${'AB'.repeat(20)}` } }, /stablecoin payout/],
    ['fiat payout to an address', ben, { ...bank, destination: wallet.destination }, /fiat payout/],
    ['fiat payout to another bank record', ben, { ...bank, destination: { kind: 'BANK', beneficiaryRef: other } }, /fiat payout/],
  ] as const)('refuses %s', (_n, ref, r, why) => {
    expect(checkResolvedPayout(ref, r as ResolvedPayout)).toMatch(why);
  });
});
