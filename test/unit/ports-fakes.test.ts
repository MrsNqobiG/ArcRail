/**
 * PORTS unit: fail-closed behaviour of the event-sourced store's fold
 * (src/nova-ports/fakes/payment-store-fakes.ts). A stored event that no longer
 * applies means the log is corrupt, and the fold throws instead of guessing.
 */
import { describe, expect, it } from 'vitest';
import { cbsMinor, nativeWei } from '../../src/amounts/index.js';
import { foldHolds, foldPayment } from '../../src/nova-ports/fakes/payment-store-fakes.js';
import type { StoreEvent } from '../../src/nova-ports/fakes/payment-store-fakes.js';
import { beneficiaryRef, idempotencyKey, novaAccountRef, novaOwnerRef, paymentId, walletRef } from '../../src/nova-ports/ids.js';
import type { NewPayment } from '../../src/nova-ports/payment-store.js';

const PID = paymentId('pay-' + '0f'.repeat(16));
const ben = beneficiaryRef('ben-1');
const p: NewPayment = {
  paymentId: PID,
  requestKey: idempotencyKey('req-x'),
  requestDigest: `0x${'d1'.repeat(32)}`,
  payer: novaOwnerRef('user-1'),
  payerAccount: novaAccountRef('acct-1'),
  payIn: { method: 'STABLECOIN_BALANCE', asset: 'USDC', network: 'ARC' },
  payout: { method: 'STABLECOIN_WALLET', asset: 'USDC', network: 'ARC', beneficiaryRef: ben },
  beneficiaryRef: ben,
  payoutPreferenceVersion: 'v1',
  amount: cbsMinor(1n),
  fee: cbsMinor(0n),
  quoteId: null,
  binding: {
    network: 'ARC',
    asset: 'USDC',
    fromWallet: walletRef('w'),
    fromAddress: `0x${'aa'.repeat(20)}`,
    dfnsWalletId: 'wa',
    to: `0x${'bb'.repeat(20)}`,
    amount: nativeWei(1n),
    digest: `0x${'b1'.repeat(32)}`,
  },
  legs: ['RESERVE', 'ARC_TRANSFER'],
};
const created: StoreEvent = { type: 'CREATED', p };
const reserveDone: StoreEvent = {
  type: 'SIGNAL',
  id: PID,
  signal: { source: 'LEDGER', dedupeKey: 'l:1', payloadDigest: `0x${'01'.repeat(32)}` },
  t: { leg: 'RESERVE', to: { stage: 'COMPLETED', reason: null } },
  applied: true,
  outbox: [],
};
const p7: StoreEvent = {
  type: 'COMPENSATED',
  id: PID,
  p7: {
    journalId: 'jr-7',
    key: idempotencyKey('pay:x:p7'),
    postedAt: 't',
    template: 'P7_COMPENSATE',
    refs: { paymentId: PID, network: 'ARC', txHash: null, logIndex: null, dfnsTransferId: null, compensates: 'jr-2' },
  },
  original: {
    journalId: 'jr-2',
    key: idempotencyKey('pay:x:p2'),
    postedAt: 't',
    template: 'P2_SETTLE_EXTERNAL',
    refs: { paymentId: PID, network: 'ARC', txHash: null, logIndex: null, dfnsTransferId: null, compensates: null },
  },
};
const mark: StoreEvent = { type: 'MARKED', id: PID, marker: { externalId: 'nv1-' + 'ab'.repeat(20), bodyDigest: `0x${'bd'.repeat(32)}`, markedAt: 't', markedAtBlock: 1n } };

describe('EventSourcedPaymentStore fold (fail closed)', () => {
  it('folds a valid log and ignores other payments, unapplied signals and non-payment events', () => {
    const other = paymentId('pay-' + '0e'.repeat(16));
    const stale: StoreEvent = { ...reserveDone, applied: false, t: { leg: 'ARC_TRANSFER', to: { stage: 'COMPLETED', reason: null } } } as StoreEvent;
    const log: StoreEvent[] = [{ type: 'PAUSED', reason: 'x' }, { type: 'CREATED', p: { ...p, paymentId: other } }, created, stale, reserveDone, { ...reserveDone, id: other } as StoreEvent, { type: 'UNPAUSED', decisionId: 'dec-x' }];
    const rec = foldPayment([...log, mark], PID);
    expect(rec?.version).toBe(3n);
    expect(rec?.legs[1]?.submit?.externalId).toBe('nv1-' + 'ab'.repeat(20));
    expect(rec?.legs[0]?.stage).toBe('COMPLETED');
    expect(foldPayment(log, paymentId('pay-' + '0d'.repeat(16)))).toBeNull();
  });
  it('throws on a second creation, a change before creation, an invalid creation or a change that no longer applies', () => {
    expect(() => foldPayment([created, created], PID)).toThrow(/created twice/);
    expect(() => foldPayment([reserveDone, created], PID)).toThrow(/before creation/);
    expect(() => foldPayment([p7], PID)).toThrow(/before creation/);
    expect(() => foldPayment([{ type: 'CREATED', p: { ...p, legs: ['ARC_TRANSFER'] } }], PID)).toThrow(/creation is no longer valid/);
    expect(() => foldPayment([created, reserveDone, reserveDone], PID)).toThrow(/no longer applies/);
    expect(() => foldPayment([created, p7], PID)).toThrow(/no longer applies/);
    expect(() => foldPayment([created, mark], PID)).toThrow(/no longer applies/);
    expect(() => foldPayment([created, reserveDone, mark, mark], PID)).toThrow(/no longer applies/);
    expect(() => foldPayment([mark], PID)).toThrow(/before creation/);
  });
  it('throws when a hold is observed, given a nonce tx or lifted before it was placed', () => {
    expect(() => foldHolds([{ type: 'HOLD_OBSERVED', holdId: 'hold-x', obs: { block: 1n, accountNonce: 1n } }])).toThrow(/hold hold-x changed before it was placed/);
    expect(() => foldHolds([{ type: 'HOLD_NONCE_TX', holdId: 'hold-x', txHash: `0x${'5a'.repeat(32)}` }])).toThrow(/before it was placed/);
    expect(() => foldHolds([{ type: 'HOLD_LIFTED', holdId: 'hold-x', evidence: { source: 'INTERNAL', dedupeKey: 'k', payloadDigest: `0x${'01'.repeat(32)}` } }])).toThrow(/before it was placed/);
    expect(foldHolds([created, reserveDone])).toEqual([]);
  });
});
