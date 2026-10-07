/**
 * PORTS unit: the shared PaymentStorePort decision procedures that the store
 * fakes cannot reach through their public operations (defence in depth), and
 * the §10.2 record/decision id derivations, recomputed independently here.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cbsMinor, nativeWei } from '../../src/amounts/index.js';
import { beneficiaryRef, idempotencyKey, novaAccountRef, novaOwnerRef, paymentId, walletRef } from '../../src/nova-ports/ids.js';
import {
  decideHoldNonceTx,
  decideMarkSubmit,
  decisionIdOf,
  decisionKey,
  decisionKindFor,
  deriveDecisionId,
  deriveHoldId,
  derive,
  initialRecord,
  newHold,
  observeHold,
  sameDecision,
} from '../../src/nova-ports/payment-store.js';
import type { DecisionKind, LegRecord, NewPayment, OperatorDecision } from '../../src/nova-ports/payment-store.js';
import { CANCELLED_REASONS, EXPIRED_REASONS, REJECTED_REASONS } from '../../src/status/index.js';
import type { FailureReason, LegState } from '../../src/status/index.js';

const PID = paymentId('pay-' + '0a'.repeat(16));
const PID2 = paymentId('pay-' + '0b'.repeat(16));
const ben = beneficiaryRef('ben-1');
const p: NewPayment = {
  paymentId: PID,
  requestKey: idempotencyKey('req-a'),
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
  binding: { network: 'ARC', asset: 'USDC', fromWallet: walletRef('w'), fromAddress: `0x${'aa'.repeat(20)}`, dfnsWalletId: 'wa', to: `0x${'bb'.repeat(20)}`, amount: nativeWei(1n), digest: `0x${'b1'.repeat(32)}` },
  legs: ['RESERVE', 'ARC_TRANSFER'],
};

/** Independent §10.2 lp(): 4-byte big-endian UTF-8 length, then the bytes. */
function lp(s: string): Buffer {
  const b = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(b.length);
  return Buffer.concat([len, b]);
}
const sha = (fields: readonly string[]): string => createHash('sha256').update(Buffer.concat(fields.map(lp))).digest('hex');

describe('decideMarkSubmit: an enqueued P6 refuses a marker even on a live record (R3-B2 defence in depth)', () => {
  it('LEG_TERMINAL with "P6 enqueued" when the caller reports a release, OK otherwise', () => {
    const rec = derive({ ...initialRecord(p), legs: initialRecord(p).legs.map((l): LegRecord => (l.kind === 'RESERVE' ? { ...l, stage: 'COMPLETED', reason: null } : l)) });
    const marker = { externalId: 'nv1-' + 'ab'.repeat(20), bodyDigest: `0x${'bd'.repeat(32)}` as const, markedAt: 't', markedAtBlock: 1n };
    expect(decideMarkSubmit(rec, 1n, marker, true, null)).toMatchObject({ kind: 'DONE', result: { kind: 'REJECTED', code: 'LEG_TERMINAL', detail: 'payment CREATED, P6 enqueued' } });
    expect(decideMarkSubmit(rec, 1n, marker, false, null).kind).toBe('APPLY');
    // m4: an externalId already marked on another payment is MARKER_CONFLICT (one externalId, one payment).
    expect(decideMarkSubmit(rec, 1n, marker, false, PID2)).toMatchObject({ kind: 'DONE', result: { kind: 'REJECTED', code: 'MARKER_CONFLICT', detail: `externalId ${marker.externalId} already marked on ${PID2}` } });
  });
});

describe('decisionKindFor: the decision each OPERATOR_DECISION transition needs (§13.3)', () => {
  const NEED: Readonly<Partial<Record<FailureReason, DecisionKind>>> = {
    CANCELLED_BY_OPERATOR: 'ABORT_ACCEPTED',
    DFNS_FAILED: 'NONCE_TX_LOCATED',
    BLOCKLISTED_PRE_MEMPOOL: 'NONCE_TX_LOCATED',
    CANCELLED_ONCHAIN_REPLACED: 'DFNS_CANCEL_ISSUED',
  };
  it('maps every failure reason exactly (all others need none)', () => {
    const states: LegState[] = [
      ...REJECTED_REASONS.map((reason) => ({ stage: 'REJECTED', reason }) as const),
      ...EXPIRED_REASONS.map((reason) => ({ stage: 'EXPIRED', reason }) as const),
      ...CANCELLED_REASONS.map((reason) => ({ stage: 'CANCELLED', reason }) as const),
    ];
    expect(states).toHaveLength(14);
    for (const to of states) expect(decisionKindFor({ leg: 'ARC_TRANSFER', to }), String(to.reason)).toBe(to.reason === null ? null : (NEED[to.reason] ?? null));
  });
  it('a hash link is a jump to CONFIRMING carrying a hash; nothing else without a reason', () => {
    const h = `0x${'7a'.repeat(32)}` as const;
    expect(decisionKindFor({ leg: 'ARC_TRANSFER', to: { stage: 'CONFIRMING', reason: null }, txHash: h })).toBe('LINK_HASH');
    expect(decisionKindFor({ leg: 'ARC_TRANSFER', to: { stage: 'CONFIRMING', reason: null } })).toBeNull();
    for (const stage of ['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'COMPLETED'] as const) {
      expect(decisionKindFor({ leg: 'ARC_TRANSFER', to: { stage, reason: null }, txHash: h }), stage).toBeNull();
    }
  });
});

describe('§10.2 decision and hold ids, recomputed independently', () => {
  it('decisionId = dec- + sha256(lp(nv1-decision) ‖ lp(kind) ‖ lp(subject) ‖ lp(caseId or "") ‖ lp(seq))[0..32]', () => {
    expect(deriveDecisionId('UNPAUSE', 'rail', null, 1n)).toBe(`dec-${sha(['nv1-decision', 'UNPAUSE', 'rail', '', '1']).slice(0, 32)}`);
    expect(deriveDecisionId('LINK_HASH', PID, 'case-1', 12n)).toBe(`dec-${sha(['nv1-decision', 'LINK_HASH', PID, 'case-1', '12']).slice(0, 32)}`);
    expect(deriveDecisionId('UNPAUSE', 'rail', null, 1n)).not.toBe(deriveDecisionId('UNPAUSE', 'rail', '', 2n));
    expect(deriveDecisionId('UNPAUSE', 'rail', null, 1n)).toMatch(/^dec-[0-9a-f]{32}$/);
  });
  it('holdId = hold- + sha256(lp(nv1-hold) ‖ lp(walletRef) ‖ lp(dfnsTransferId))[0..32], at most 37 chars', () => {
    const id = deriveHoldId(walletRef('w-hot'), 'tr-01');
    expect(id).toBe(`hold-${sha(['nv1-hold', 'w-hot', 'tr-01']).slice(0, 32)}`);
    expect(id).toHaveLength(37);
    expect(deriveHoldId(walletRef('w-ho'), 't-tr-01')).not.toBe(id);
  });
  it('decision keys round-trip; other keys name no decision', () => {
    expect(decisionKey('dec-1')).toBe('op:dec-1');
    expect(decisionIdOf('op:dec-1')).toBe('dec-1');
    expect(decisionIdOf('dfns:transfer:x:Failed')).toBeNull();
    expect(decisionIdOf('xop:dec-1')).toBeNull();
  });
});

describe('sameDecision compares every field', () => {
  const d: OperatorDecision = { decisionId: 'dec-1', kind: 'UNPAUSE', subject: 'rail', caseId: null, seq: 1n, evidenceDigest: `0x${'ee'.repeat(32)}`, approvers: ['ann', 'bob'], decidedAt: 't' };
  it('equal only when every field is equal', () => {
    expect(sameDecision(d, { ...d })).toBe(true);
    const changes: readonly Partial<OperatorDecision>[] = [
      { decisionId: 'dec-2' },
      { kind: 'LIFT_QUARANTINE' },
      { subject: 'x' },
      { caseId: 'c' },
      { seq: 2n },
      { evidenceDigest: `0x${'ef'.repeat(32)}` },
      { approvers: ['ann', 'cy'] },
      { approvers: ['cy', 'bob'] },
      { decidedAt: 'u' },
      { txHash: `0x${'7a'.repeat(32)}` },
    ];
    for (const c of changes) expect(sameDecision(d, { ...d, ...c }), JSON.stringify(Object.keys(c))).toBe(false);
  });
});

describe('hold procedures: malformed input is a programming error', () => {
  const h = newHold({ wallet: walletRef('w'), dfnsTransferId: 'tr', subject: PID, nonce: 3n, aborted: false });
  it('observations need non-negative block and nonce', () => {
    expect(() => observeHold(h, { block: -1n, accountNonce: 0n })).toThrow(/non-negative/);
    expect(() => observeHold(h, { block: 0n, accountNonce: -1n })).toThrow(/non-negative/);
    expect(observeHold(h, { block: 0n, accountNonce: 0n }).lastAtOrBelow).toEqual({ block: 0n, accountNonce: 0n });
    expect(observeHold(h, { block: 5n, accountNonce: 3n }).lastAtOrBelow).toEqual({ block: 5n, accountNonce: 3n });
    expect(observeHold(h, { block: 5n, accountNonce: 4n }).firstAbove).toEqual({ block: 5n, accountNonce: 4n });
  });
  it('the nonce-n tx hash must be lower-case 32-byte hex', () => {
    expect(() => decideHoldNonceTx(h, `0x${'AB'.repeat(32)}`)).toThrow(/lower-case/);
    expect(() => decideHoldNonceTx(h, '0x12')).toThrow(/lower-case/);
    expect(decideHoldNonceTx(h, `0x${'ab'.repeat(32)}`)).toMatchObject({ kind: 'SET', hold: { nonceTx: `0x${'ab'.repeat(32)}` } });
  });
});
