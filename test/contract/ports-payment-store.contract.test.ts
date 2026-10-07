/**
 * PORTS unit: PaymentStorePort contract suite (docs/NOVA_ARC_DESIGN.md §7.3,
 * §6.5, §8.4 check 3, §8.6, §10, §12, §13). Runs unchanged against both
 * in-memory fakes; Nova's adapter must pass it too [A-34]: add a factory to
 * FACTORIES.
 */
import { describe, expect, it } from 'vitest';
import { cbsMinor, nativeWei } from '../../src/amounts/index.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { EventSourcedPaymentStore, MapPaymentStore } from '../../src/nova-ports/fakes/payment-store-fakes.js';
import { beneficiaryRef, fiatCode, idempotencyKey, novaAccountRef, novaOwnerRef, paymentId, walletRef } from '../../src/nova-ports/ids.js';
import type { Hex32, PaymentId, PortResult } from '../../src/nova-ports/ids.js';
import type { JournalReceipt } from '../../src/nova-ports/ledger.js';
import { decisionKey, deriveCaseId, deriveDecisionId, deriveHoldId, partnerClaimKey, partnerReturnKey, pauseIncident, releaseKey } from '../../src/nova-ports/payment-store.js';
import type {
  CaseRecord,
  DecisionKind,
  InboundSignal,
  InboundTriple,
  LegTransition,
  NewNonceHold,
  NewPayment,
  OperatorDecision,
  OutboxItem,
  PaymentRecord,
  PaymentStorePort,
  SubmitMarker,
} from '../../src/nova-ports/payment-store.js';
import type { LegState, SignalSource } from '../../src/status/index.js';

type Factory = (faults?: FaultPlan) => PaymentStorePort;
/** Rebuilds a store from its storage only, as after a process restart (§7.3 "Durability of the safety records"). */
type Restart = (s: PaymentStorePort) => PaymentStorePort;
const FACTORIES: readonly (readonly [string, Factory, Restart])[] = [
  ['MapPaymentStore', (f) => new MapPaymentStore(f), (s) => MapPaymentStore.restore((s as MapPaymentStore).snapshot())],
  ['EventSourcedPaymentStore', (f) => new EventSourcedPaymentStore(f), (s) => EventSourcedPaymentStore.fromEvents((s as EventSourcedPaymentStore).events())],
];

const hex = (byte: string, n = 32): Hex32 => `0x${byte.repeat(n)}`;
const addr = (byte: string): `0x${string}` => `0x${byte.repeat(20)}`;
const PID = paymentId('pay-' + '01'.repeat(16));
const PID2 = paymentId('pay-' + '02'.repeat(16));
const payer = novaOwnerRef('user-1');
const ben = beneficiaryRef('ben-1');
const FIAT_BANK = { method: 'FIAT_BANK', currency: fiatCode('ZAR'), beneficiaryRef: ben } as const;

const newPayment = (over: Partial<NewPayment> = {}): NewPayment => ({
  paymentId: PID,
  requestKey: idempotencyKey('req-' + '01'.repeat(32)),
  requestDigest: hex('d1'),
  payer,
  payerAccount: novaAccountRef('acct-1'),
  payIn: { method: 'STABLECOIN_BALANCE', asset: 'USDC', network: 'ARC' },
  payout: { method: 'STABLECOIN_WALLET', asset: 'USDC', network: 'ARC', beneficiaryRef: ben },
  beneficiaryRef: ben,
  payoutPreferenceVersion: 'v1',
  amount: cbsMinor(1_000_000n),
  fee: cbsMinor(5_000n),
  quoteId: null,
  binding: {
    network: 'ARC',
    asset: 'USDC',
    fromWallet: walletRef('w-hot'),
    fromAddress: addr('aa'),
    dfnsWalletId: 'wa-test',
    to: addr('bb'),
    amount: nativeWei(1_000_000_000_000_000_000n),
    digest: hex('b1'),
  },
  legs: ['RESERVE', 'ARC_TRANSFER'],
  ...over,
});
const fiatBankPayment = (over: Partial<NewPayment> = {}): NewPayment => newPayment({ payout: FIAT_BANK, legs: ['RESERVE', 'ARC_TRANSFER', 'PAYOUT'], ...over });

let sigSeq = 0;
const sig = (source: SignalSource, dedupeKey?: string, digest = hex('5e')): InboundSignal => {
  sigSeq += 1;
  return { source, dedupeKey: dedupeKey ?? `sig:${sigSeq}`, payloadDigest: digest };
};
const to = (leg: LegTransition['leg'], state: LegState, extra: Partial<LegTransition> = {}): LegTransition => ({ leg, to: state, ...extra });
const st = (stage: LegState['stage']): LegState => ({ stage, reason: null }) as LegState;
const TX = hex('7a');
const outbox = (key: string): OutboxItem => ({ key: idempotencyKey(key), topic: 'payment.updated', payload: key });
const marker = (over: Partial<SubmitMarker> = {}): SubmitMarker => ({ externalId: 'nv1-' + 'ab'.repeat(20), bodyDigest: hex('bd'), markedAt: 't-mark', markedAtBlock: 100n, ...over });
/** A two-person decision whose id derives from its content (§10.2); a LINK_HASH links TX unless told otherwise. */
const decision = (over: Partial<Omit<OperatorDecision, 'decisionId'>> = {}): OperatorDecision => {
  const base: Omit<OperatorDecision, 'decisionId'> = { kind: 'UNPAUSE', subject: pauseIncident(1n), caseId: null, seq: 1n, evidenceDigest: hex('ee'), approvers: ['ann', 'bob'], decidedAt: 't', ...over };
  const linked = base.kind === 'LINK_HASH' && base.txHash === undefined ? { ...base, txHash: TX } : base;
  return { ...linked, decisionId: deriveDecisionId(base.kind, base.subject, base.caseId, base.seq) };
};
/** The decision's own §10.3 inbox signal. */
const opSig = (d: OperatorDecision, digest = hex('de')): InboundSignal => ({ source: 'OPERATOR_DECISION', dedupeKey: decisionKey(d.decisionId), payloadDigest: digest });
/** Records a decision for `subject` and returns it. */
async function decide(s: PaymentStorePort, kind: DecisionKind, subject: string = PID, over: Partial<Omit<OperatorDecision, 'decisionId'>> = {}): Promise<OperatorDecision> {
  const d = decision({ kind, subject, ...over });
  expect(await s.recordDecision(opSig(d), d)).toEqual({ kind: 'OK', value: { outcome: 'APPLIED' }, replayed: false });
  return d;
}

/** The OK value; also asserts `replayed` (false unless a replay is expected). */
function okValue<T>(r: PortResult<T, string>, replayed = false): T {
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${r.kind} ${r.kind === 'REJECTED' ? `${r.code} ${r.detail}` : r.cause}`);
  expect(r.replayed).toBe(replayed);
  return r.value;
}

/** Reservation posted and the Arc leg's submit marker committed (UNRESOLVED). */
async function marked(s: PaymentStorePort, p: NewPayment = newPayment()): Promise<PaymentRecord> {
  let r = okValue(await s.create(p));
  r = okValue(await s.applySignal(p.paymentId, r.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
  return okValue(await s.markSubmit(p.paymentId, r.version, marker({ externalId: `nv1-${p.paymentId.slice(4)}${'00'.repeat(4)}` })));
}

/** …then DFNS reports the entity (Pending), so the leg is resolved (KNOWN), with no hash yet. */
async function pending(s: PaymentStorePort, p: NewPayment = newPayment()): Promise<PaymentRecord> {
  const r = await marked(s, p);
  return okValue(await s.applySignal(p.paymentId, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('PENDING_APPROVAL'), { externalRef: `tr-${p.paymentId.slice(-2)}` }), [])).record;
}

/** …then DFNS reports Broadcasted with the hash: the Arc leg is SUBMITTED and linked. */
async function toSubmitted(s: PaymentStorePort, p: NewPayment = newPayment(), tx: Hex32 = TX): Promise<PaymentRecord> {
  const r = await pending(s, p);
  return okValue(await s.applySignal(p.paymentId, r.version, sig('DFNS_WEBHOOK'), to('ARC_TRANSFER', st('SUBMITTED'), { txHash: tx }), [])).record;
}

const receipt = (over: Omit<Partial<JournalReceipt>, 'refs'> & { refs?: Partial<JournalReceipt['refs']> } = {}): JournalReceipt => {
  const { refs, ...rest } = over;
  return {
    journalId: 'jr-p2',
    key: idempotencyKey(`pay:${PID}:p2`),
    postedAt: 't',
    template: 'P2_SETTLE_EXTERNAL',
    ...rest,
    refs: { paymentId: PID, network: 'ARC', txHash: null, logIndex: null, dfnsTransferId: null, compensates: null, ...refs },
  };
};
const P2 = receipt();
const P7 = receipt({ journalId: 'jr-p7', key: idempotencyKey(`pay:${PID}:p7`), template: 'P7_COMPENSATE', refs: { compensates: 'jr-p2' } });

describe.each(FACTORIES)('PaymentStorePort contract: %s', (_name, make, restart) => {
  describe('create (exactly once, both choices frozen)', () => {
    it('creates every leg CREATED with no submit marker, payment PENDING, version 1', async () => {
      const s = make();
      const r = okValue(await s.create(newPayment()));
      expect(r).toMatchObject({ paymentId: PID, stage: 'CREATED', reason: null, status: 'PENDING', version: 1n, compensatedBy: null });
      expect(r.payIn.method).toBe('STABLECOIN_BALANCE');
      expect(r.payout.method).toBe('STABLECOIN_WALLET');
      expect(r.legs.map((l) => [l.kind, l.stage, l.reason, l.attempt, l.submit, l.externalRef, l.txHash, l.history.length])).toEqual([
        ['RESERVE', 'CREATED', null, 1n, null, null, null, 0],
        ['ARC_TRANSFER', 'CREATED', null, 1n, null, null, null, 0],
      ]);
      expect(await s.get(PID)).toEqual({ kind: 'OK', value: r, replayed: false });
    });

    it('a replayed request returns the same payment (replayed) and creates nothing new', async () => {
      const s = make();
      const r = okValue(await s.create(newPayment()));
      expect(await s.create(newPayment())).toEqual({ kind: 'OK', value: r, replayed: true });
      expect(okValue(await s.listOpen('RESERVE', 'CREATED', 10n))).toHaveLength(1);
    });

    it('same request key with a different request, or a reused payment id, is KEY_CONFLICT', async () => {
      const s = make();
      await s.create(newPayment());
      expect(await s.create(newPayment({ requestDigest: hex('d2') }))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: /reused with a different request/ });
      expect(await s.create(newPayment({ paymentId: PID2 }))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: /reused with a different request/ });
      expect(await s.create(newPayment({ requestKey: idempotencyKey('req-other') }))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: `payment id ${PID} already used by another request` });
      expect(await s.get(PID2)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    });

    it('request keys are per payer', async () => {
      const s = make();
      await s.create(newPayment());
      const other = novaOwnerRef('user-2');
      expect(okValue(await s.create(newPayment({ payer: other, paymentId: PID2 }))).payer).toBe(other);
      expect(okValue(await s.getByRequestKey(payer, newPayment().requestKey))?.paymentId).toBe(PID);
      expect(okValue(await s.getByRequestKey(other, newPayment().requestKey))?.paymentId).toBe(PID2);
      expect(okValue(await s.getByRequestKey(novaOwnerRef('user-3'), newPayment().requestKey))).toBeNull();
    });

    it('legs must be exactly the journey for (payer choice, receiver choice): INVALID_JOURNEY', async () => {
      const s = make();
      expect(await s.create(newPayment({ legs: ['ARC_TRANSFER'] }))).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNEY', detail: /RESERVE,ARC_TRANSFER/ });
      const fiatToBank = newPayment({ payIn: { method: 'FIAT', currency: fiatCode('ZAR') }, payout: FIAT_BANK, legs: ['RESERVE', 'CONVERT_IN', 'ARC_TRANSFER', 'PAYOUT'] });
      expect(okValue(await s.create(fiatToBank)).legs.map((l) => l.kind)).toEqual(['RESERVE', 'CONVERT_IN', 'ARC_TRANSFER', 'PAYOUT']);
    });

    it('AMBIGUOUS before commit creates nothing; after commit the payment exists and a retry replays', async () => {
      const f = new FaultPlan();
      const s = make(f);
      f.arm('create', 'BEFORE_COMMIT', 'UNAVAILABLE');
      expect(await s.create(newPayment())).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
      expect(okValue(await s.getByRequestKey(payer, newPayment().requestKey))).toBeNull();
      f.arm('create', 'AFTER_COMMIT', 'TIMEOUT');
      expect(await s.create(newPayment())).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.getByRequestKey(payer, newPayment().requestKey))?.paymentId).toBe(PID);
      expect(await s.create(newPayment())).toMatchObject({ kind: 'OK', replayed: true });
    });
  });

  describe('markSubmit (one DFNS request per payment, committed before the POST)', () => {
    it('needs the reservation first; then commits once; an equal marker replays, another conflicts', async () => {
      const s = make();
      let r = okValue(await s.create(newPayment()));
      expect(await s.markSubmit(PID, r.version, marker())).toMatchObject({ kind: 'REJECTED', code: 'NOT_READY', detail: /ahead of the Arc leg/ });
      r = okValue(await s.applySignal(PID, r.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
      expect(await s.markSubmit(PID, 99n, marker())).toMatchObject({ kind: 'REJECTED', code: 'VERSION_CONFLICT', detail: `at version ${r.version}` });
      const m = okValue(await s.markSubmit(PID, r.version, marker()));
      expect(m).toMatchObject({ version: r.version + 1n, stage: 'CREATED', status: 'PENDING' });
      expect(m.legs[1]).toMatchObject({ stage: 'CREATED', submit: marker(), externalRef: null });
      expect(m.legs[0]?.submit).toBeNull();
      expect(await s.get(PID)).toEqual({ kind: 'OK', value: m, replayed: false });
      expect(await s.markSubmit(PID, r.version, marker())).toEqual({ kind: 'OK', value: m, replayed: true });
      for (const other of [marker({ bodyDigest: hex('be') }), marker({ externalId: 'nv1-' + 'cd'.repeat(20) }), marker({ markedAt: 'x' }), marker({ markedAtBlock: 101n })]) {
        expect(await s.markSubmit(PID, m.version, other)).toMatchObject({ kind: 'REJECTED', code: 'MARKER_CONFLICT', detail: /already set/ });
      }
      expect(await s.markSubmit(PID2, 1n, marker())).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    });

    it('a malformed marker is a programming error (throws): markers are derived (§10.2)', async () => {
      const s = make();
      let r = okValue(await s.create(newPayment()));
      r = okValue(await s.applySignal(PID, r.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
      await expect(s.markSubmit(PID, r.version, marker({ externalId: 'nv1-short' }))).rejects.toThrow(/externalId/);
      await expect(s.markSubmit(PID, r.version, marker({ bodyDigest: `0x${'AB'.repeat(32)}` }))).rejects.toThrow(/bodyDigest/);
      await expect(s.markSubmit(PID, r.version, marker({ markedAt: '' }))).rejects.toThrow(/markedAt/);
      await expect(s.markSubmit(PID, r.version, marker({ markedAtBlock: -1n }))).rejects.toThrow(/markedAtBlock/);
      expect(okValue(await s.get(PID)).legs[1]?.submit).toBeNull();
    });

    it('LEG_TERMINAL once the payment is terminal or a P6 is enqueued: no DFNS request after release (R3-B2)', async () => {
      const s = make();
      let r = okValue(await s.create(newPayment()));
      r = okValue(await s.applySignal(PID, r.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
      r = okValue(await s.applySignal(PID, r.version, sig('INTERNAL'), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK' }), [outbox(`pay:${PID}:p6`)])).record;
      expect(await s.markSubmit(PID, r.version, marker())).toMatchObject({ kind: 'REJECTED', code: 'LEG_TERMINAL', detail: 'payment REJECTED, P6 enqueued' });
      const s2 = make();
      let q = okValue(await s2.create(newPayment()));
      expect(await s2.applySignal(PID, q.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [outbox(releaseKey(PID))])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /P6 refused: the payment is PENDING/ });
      q = okValue(await s2.applySignal(PID, q.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
      expect(okValue(await s2.markSubmit(PID, q.version, marker())).legs[1]?.submit).toEqual(marker());
      const s3 = make();
      let x = okValue(await s3.create(fiatBankPayment()));
      x = okValue(await s3.applySignal(PID, x.version, sig('INTERNAL'), to('PAYOUT', { stage: 'REJECTED', reason: 'METHOD_NOT_ENABLED' }), [])).record;
      expect(await s3.markSubmit(PID, x.version, marker())).toMatchObject({ kind: 'REJECTED', code: 'LEG_TERMINAL', detail: 'payment REJECTED' });
    });

    it('m4: an externalId already marked on one payment is MARKER_CONFLICT for any other', async () => {
      const s = make();
      await marked(s);
      let q = okValue(await s.create(newPayment({ paymentId: PID2, requestKey: idempotencyKey('req-two') })));
      q = okValue(await s.applySignal(PID2, q.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
      const taken = marker({ externalId: `nv1-${PID.slice(4)}${'00'.repeat(4)}` });
      expect(await s.markSubmit(PID2, q.version, taken)).toMatchObject({ kind: 'REJECTED', code: 'MARKER_CONFLICT', detail: `externalId ${taken.externalId} already marked on ${PID}` });
      expect(okValue(await s.findByExternalId(taken.externalId))?.paymentId).toBe(PID);
      expect(okValue(await s.get(PID2)).legs[1]?.submit).toBeNull();
      expect(okValue(await s.markSubmit(PID2, q.version, marker({ externalId: `nv1-${PID2.slice(4)}${'00'.repeat(4)}` }))).legs[1]?.submit).not.toBeNull();
    });

    it('findByExternalId and listUnresolvedSubmits (F-6 start-up recovery)', async () => {
      const s = make();
      const a = await marked(s);
      const b = await pending(s, newPayment({ paymentId: PID2, requestKey: idempotencyKey('req-two') }));
      const ida = a.legs[1]?.submit?.externalId as string;
      expect(okValue(await s.findByExternalId(ida))?.paymentId).toBe(PID);
      expect(okValue(await s.findByExternalId(b.legs[1]?.submit?.externalId as string))?.paymentId).toBe(PID2);
      expect(okValue(await s.findByExternalId('nv1-' + '99'.repeat(20)))).toBeNull();
      expect(okValue(await s.listUnresolvedSubmits(10n)).map((r) => r.paymentId)).toEqual([PID]);
      expect(okValue(await s.listUnresolvedSubmits(0n))).toEqual([]);
      okValue(await s.applySignal(PID, a.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('PENDING_APPROVAL'), { externalRef: 'tr-a' }), []));
      expect(okValue(await s.listUnresolvedSubmits(10n))).toEqual([]);
    });

    it('AMBIGUOUS before commit sets no marker; after commit it is set and a re-send replays', async () => {
      const f = new FaultPlan();
      const s = make(f);
      let r = okValue(await s.create(newPayment()));
      r = okValue(await s.applySignal(PID, r.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
      f.arm('markSubmit', 'BEFORE_COMMIT', 'TIMEOUT');
      expect(await s.markSubmit(PID, r.version, marker())).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.get(PID)).legs[1]?.submit).toBeNull();
      f.arm('markSubmit', 'AFTER_COMMIT', 'TRANSPORT');
      expect(await s.markSubmit(PID, r.version, marker())).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
      expect(okValue(await s.get(PID)).legs[1]?.submit).toEqual(marker());
      expect(await s.markSubmit(PID, r.version, marker())).toMatchObject({ kind: 'OK', replayed: true });
    });
  });

  describe('UNRESOLVED leg (marker set, no DFNS entity): nothing ends it (R3-B1)', () => {
    it('quote expiry, operator cancel, timers and entity-less signals are LEG_UNRESOLVED; a DFNS signal with the entity resolves it', async () => {
      const s = make();
      const r = await marked(s);
      const refused: readonly [SignalSource, LegState][] = [
        ['INTERNAL', { stage: 'EXPIRED', reason: 'QUOTE_EXPIRED' }],
        ['OPERATOR_DECISION', { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }],
        ['INTERNAL', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK' }],
        ['DFNS_POLL', st('PENDING_APPROVAL')],
        ['DFNS_WEBHOOK', { stage: 'REJECTED', reason: 'APPROVAL_DENIED' }],
        ['ARC_LOG', st('CONFIRMING')],
      ];
      for (const [src, state] of refused) {
        expect(await s.applySignal(PID, r.version, sig(src), to('ARC_TRANSFER', state, { txHash: TX }), [outbox(releaseKey(PID))]), `${src} ${state.stage}`).toMatchObject({ kind: 'REJECTED', code: 'LEG_UNRESOLVED' });
      }
      expect(await s.applySignal(PID, r.version, sig('OPERATOR_DECISION'), to('ARC_TRANSFER', st('CONFIRMING'), { externalRef: 'tr-x', txHash: TX }), [])).toMatchObject({ kind: 'REJECTED', code: 'LEG_UNRESOLVED' });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
      expect(okValue(await s.get(PID))).toEqual(r);
      const res = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('PENDING_APPROVAL'), { externalRef: 'tr-1' }), []));
      expect(res.record.legs[1]).toMatchObject({ stage: 'PENDING_APPROVAL', externalRef: 'tr-1' });
    });

    it('a DFNS Rejected that carries the entity resolves and ends the leg in one write (proof (a1))', async () => {
      const s = make();
      const r = await marked(s);
      const out = okValue(await s.applySignal(PID, r.version, sig('DFNS_WEBHOOK'), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'APPROVAL_DENIED' }, { externalRef: 'tr-1' }), [outbox(releaseKey(PID))]));
      expect(out.record).toMatchObject({ stage: 'REJECTED', reason: 'APPROVAL_DENIED', status: 'FAILED' });
      expect(okValue(await s.pendingOutbox()).map((o) => o.key)).toEqual([releaseKey(PID)]);
    });
  });

  describe('applySignal: Arc leg linked only by the DFNS hash (§6.5, B1)', () => {
    it('D1 happy path: SETTLED only on our own ARC_LOG in the DFNS-reported transaction', async () => {
      const s = make();
      let r = await toSubmitted(s);
      expect(r).toMatchObject({ stage: 'SUBMITTED', status: 'PROCESSING', version: 5n });
      expect(r.legs[1]).toMatchObject({ externalRef: 'tr-01', txHash: TX });
      const done = await s.applySignal(PID, r.version, sig('ARC_LOG', `arc:5042002:${TX}:0`), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [outbox('pay:x:done')]);
      r = okValue(done).record;
      expect(okValue(done).outcome).toBe('APPLIED');
      expect(r).toMatchObject({ stage: 'COMPLETED', status: 'SETTLED', reason: null, version: 6n });
      expect(await s.get(PID)).toEqual({ kind: 'OK', value: r, replayed: false });
    });

    it('a DFNS webhook or poll can never complete the Arc leg', async () => {
      const s = make();
      const r = await toSubmitted(s);
      for (const src of ['DFNS_WEBHOOK', 'DFNS_POLL'] as const) {
        expect(await s.applySignal(PID, r.version, sig(src), to('ARC_TRANSFER', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: 'ARC_TRANSFER SUBMITTED -> COMPLETED' });
      }
      expect(okValue(await s.get(PID)).status).toBe('PROCESSING');
    });

    it('without a DFNS-reported hash the leg reaches neither SUBMITTED nor CONFIRMING (probe P1a)', async () => {
      const s = make();
      const r = await pending(s);
      for (const stage of ['SUBMITTED', 'CONFIRMING'] as const) {
        expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st(stage)), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /without a DFNS-reported hash/ });
      }
      expect(okValue(await s.get(PID)).legs[1]?.stage).toBe('PENDING_APPROVAL');
    });

    it('a log never links itself: ARC_LOG, LEDGER, PAYOUT_CALLBACK or INTERNAL cannot set the hash (probes P1b, P1c, P7)', async () => {
      const s = make();
      const r = await pending(s);
      expect(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: hex('99') }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      expect(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: hex('99') }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      expect(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: hex('99') }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      const s2 = make();
      let q = okValue(await s2.create(newPayment()));
      q = okValue(await s2.applySignal(PID, q.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
      expect(await s2.applySignal(PID, q.version, sig('INTERNAL'), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK' }, { txHash: TX }), [])).toMatchObject({
        kind: 'REJECTED',
        code: 'ILLEGAL_TRANSITION',
        detail: /only DFNS or a two-person link sets the Arc leg txHash/,
      });
      expect(await s2.applySignal(PID, q.version, sig('INTERNAL'), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK' }, { externalRef: 'tr-x' }), [])).toMatchObject({
        kind: 'REJECTED',
        code: 'ILLEGAL_TRANSITION',
        detail: /only a DFNS signal identifies the DFNS transfer/,
      });
      expect(okValue(await s.get(PID)).legs[1]?.txHash).toBeNull();
    });

    it('F-12: a log from another payment\'s transaction never settles this one', async () => {
      const s = make();
      const a = await toSubmitted(s, newPayment(), TX);
      await toSubmitted(s, newPayment({ paymentId: PID2, requestKey: idempotencyKey('req-two') }), hex('7b'));
      expect(await s.applySignal(PID, a.version, sig('ARC_LOG', `arc:5042002:${hex('7b')}:0`), to('ARC_TRANSFER', st('COMPLETED'), { txHash: hex('7b') }), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      expect(okValue(await s.get(PID)).status).toBe('PROCESSING');
      expect(okValue(await s.applySignal(PID2, 5n, sig('ARC_LOG', `arc:5042002:${hex('7b')}:0`), to('ARC_TRANSFER', st('COMPLETED'), { txHash: hex('7b') }), [])).record.status).toBe('SETTLED');
    });

    it('our indexer moves SUBMITTED → CONFIRMING only in the linked transaction; a two-person link is the other way in (§6.5 rule 1)', async () => {
      const s = make();
      const r = await toSubmitted(s);
      expect(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: hex('99') }), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      expect(okValue(await s.applySignal(PID, r.version, sig('INTERNAL'), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: TX }), [])).record.legs[1]?.stage).toBe('CONFIRMING');
      const s2 = make();
      let q = await pending(s2);
      q = okValue(await s2.applySignal(PID, q.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED')), [])).record;
      const link = await decide(s2, 'LINK_HASH');
      q = okValue(await s2.applySignal(PID, q.version, opSig(link), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: TX }), [])).record;
      expect(q.legs[1]).toMatchObject({ stage: 'CONFIRMING', txHash: TX });
      expect(await s2.applySignal(PID, q.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /only with the hash of its transaction/ });
      expect(okValue(await s2.applySignal(PID, q.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).record.status).toBe('SETTLED');
    });

    it('a changed DFNS transfer id or txHash (speed-up/replacement, F-18) is SIGNAL_CONFLICT, even when stale', async () => {
      const s = make();
      const r = await toSubmitted(s);
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('CONFIRMING'), { externalRef: 'tr-2' }), [])).toMatchObject({
        kind: 'REJECTED',
        code: 'SIGNAL_CONFLICT',
        detail: 'ARC_TRANSFER external reference or txHash changed',
      });
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED'), { txHash: hex('99') }), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      const same = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('CONFIRMING'), { externalRef: 'tr-01', txHash: TX }), []));
      expect(same.outcome).toBe('APPLIED');
    });
  });

  describe('applySignal: one inbox, exactly once', () => {
    it('the same signal twice is DUPLICATE (replayed); the same key with another payload is SIGNAL_CONFLICT', async () => {
      const s = make();
      const r0 = okValue(await s.create(newPayment()));
      const once = sig('LEDGER', 'ledger:pay:p1');
      const r1 = okValue(await s.applySignal(PID, r0.version, once, to('RESERVE', st('COMPLETED')), [outbox('o:1')]));
      expect(r1.outcome).toBe('APPLIED');
      expect(await s.applySignal(PID, r0.version, once, to('RESERVE', st('COMPLETED')), [outbox('o:1')])).toEqual({ kind: 'OK', value: { outcome: 'DUPLICATE', record: r1.record }, replayed: true });
      // B2: a re-delivery never enqueues something new behind a false OK.
      expect(await s.applySignal(PID, r0.version, once, to('RESERVE', st('COMPLETED')), [outbox('o:2')])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /enqueues nothing; o:2 is not already enqueued/ });
      expect(await s.applySignal(PID, r0.version, once, to('RESERVE', st('COMPLETED')), [{ ...outbox('o:1'), payload: 'other' }])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      expect(await s.applySignal(PID, r0.version, once, to('RESERVE', st('COMPLETED')), [{ ...outbox('o:1'), topic: 'other' }])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      expect(await s.applySignal(PID, r1.record.version, { ...once, payloadDigest: hex('ff') }, to('RESERVE', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /ledger:pay:p1/ });
      expect(okValue(await s.pendingOutbox()).map((o) => o.key)).toEqual(['o:1']);
    });

    it('a key applied to one payment is SIGNAL_CONFLICT for another, never DUPLICATE (§6.5 rule 5, m9)', async () => {
      const s = make();
      okValue(await s.create(newPayment()));
      okValue(await s.create(newPayment({ paymentId: PID2, requestKey: idempotencyKey('req-two') })));
      const k = sig('LEDGER', 'ledger:shared');
      okValue(await s.applySignal(PID, 1n, k, to('RESERVE', st('COMPLETED')), []));
      expect(await s.applySignal(PID2, 1n, k, to('RESERVE', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /already applied to another payment/ });
      expect(okValue(await s.get(PID2)).legs[0]?.stage).toBe('CREATED');
    });

    it('commitRange and applySignal share the inbox: a range key applies once, then DUPLICATE; digests must agree both ways (m9)', async () => {
      const s = make();
      const r = await toSubmitted(s);
      const log = sig('ARC_LOG', `arc:5042002:${TX}:0`, hex('11'));
      okValue(await s.commitRange('arc', 10n, [log]));
      const done = okValue(await s.applySignal(PID, r.version, log, to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), []));
      expect(done.outcome).toBe('APPLIED');
      expect(okValue(await s.applySignal(PID, done.record.version, log, to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), []), true).outcome).toBe('DUPLICATE');
      expect(await s.applySignal(PID, done.record.version, { ...log, payloadDigest: hex('12') }, to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      expect(await s.commitRange('arc', 20n, [{ ...log, payloadDigest: hex('12') }])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      okValue(await s.commitRange('arc', 20n, [log]));
      const applied = sig('LEDGER', 'ledger:k', hex('21'));
      const s2 = make();
      okValue(await s2.create(newPayment()));
      okValue(await s2.applySignal(PID, 1n, applied, to('RESERVE', st('COMPLETED')), []));
      expect(await s2.commitRange('c', 1n, [{ ...applied, payloadDigest: hex('22') }])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      okValue(await s2.commitRange('c', 1n, [applied]));
      expect(okValue(await s2.applySignal(PID, 2n, applied, to('RESERVE', st('COMPLETED')), []), true).outcome).toBe('DUPLICATE');
    });

    it('out-of-order DFNS states are STALE (no change, version kept) and then DUPLICATE when re-delivered', async () => {
      const s = make();
      const r = await toSubmitted(s);
      const late = sig('DFNS_POLL', 'dfns:transfer:tr-1:Pending');
      // B2: a no-change signal cannot carry a new outbox item (it would be dropped behind an OK).
      expect(await s.applySignal(PID, r.version, late, to('ARC_TRANSFER', st('PENDING_APPROVAL')), [outbox('o:stale')])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /changes nothing enqueues nothing/ });
      expect(await s.applySignal(PID, r.version, late, to('ARC_TRANSFER', st('PENDING_APPROVAL')), [])).toEqual({ kind: 'OK', value: { outcome: 'STALE', record: r }, replayed: false });
      expect(okValue(await s.get(PID)).version).toBe(r.version);
      // A no-change signal records only its digest: re-delivered it is STALE again, and another payload under its key conflicts.
      expect(okValue(await s.applySignal(PID, r.version, late, to('ARC_TRANSFER', st('PENDING_APPROVAL')), [])).outcome).toBe('STALE');
      expect(await s.applySignal(PID, r.version, { ...late, payloadDigest: hex('99') }, to('ARC_TRANSFER', st('PENDING_APPROVAL')), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
    });

    it('a forward jump applies in one write and records every skipped stage with the same evidence', async () => {
      const s = make();
      let r = await marked(s);
      r = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL', 'p:pending'), to('ARC_TRANSFER', st('PENDING_APPROVAL'), { externalRef: 'tr-1' }), [])).record;
      r = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL', 'p:broadcasted'), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: TX }), [])).record;
      expect(r.version).toBe(5n);
      expect(r.legs[1]?.history).toEqual([
        { stage: 'PENDING_APPROVAL', reason: null, via: 'p:pending' },
        { stage: 'APPROVED', reason: null, via: 'p:broadcasted' },
        { stage: 'SUBMITTED', reason: null, via: 'p:broadcasted' },
        { stage: 'CONFIRMING', reason: null, via: 'p:broadcasted' },
      ]);
      expect(r).toMatchObject({ stage: 'CONFIRMING', status: 'PROCESSING' });
      expect(r.legs[0]?.history).toEqual([{ stage: 'COMPLETED', reason: null, via: r.legs[0]?.history[0]?.via }]);
    });

    it('version conflict, unknown payment, unknown leg and malformed targets are refused and change nothing', async () => {
      const s = make();
      const r = okValue(await s.create(newPayment()));
      expect(await s.applySignal(PID, 7n, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'VERSION_CONFLICT', detail: 'at version 1' });
      expect(await s.applySignal(PID2, 1n, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      expect(await s.applySignal(PID, 1n, sig('CONVERSION'), to('CONVERT_IN', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: 'no legal CONVERT_IN leg target' });
      const bad = { stage: 'REJECTED', reason: null } as unknown as LegState;
      expect(await s.applySignal(PID, 1n, sig('LEDGER'), to('RESERVE', bad), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      expect(okValue(await s.get(PID))).toEqual(r);
    });

    it('a rejected signal is not recorded: the same key can still be applied with a legal transition', async () => {
      const k = sig('LEDGER', 'ledger:retry');
      const s = make();
      okValue(await s.create(newPayment()));
      expect(await s.applySignal(PID, 1n, k, to('ARC_TRANSFER', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      expect(okValue(await s.applySignal(PID, 1n, k, to('RESERVE', st('COMPLETED')), [])).outcome).toBe('APPLIED');
    });

    it('outbox items are enqueued once per key, only with an applied transition', async () => {
      const s = make();
      let r = okValue(await s.create(newPayment()));
      r = okValue(await s.applySignal(PID, r.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [outbox('o:a'), outbox('o:b')])).record;
      r = okValue(await s.markSubmit(PID, r.version, marker()));
      await s.applySignal(PID, 99n, sig('DFNS_POLL'), to('ARC_TRANSFER', st('PENDING_APPROVAL'), { externalRef: 'tr-1' }), [outbox('o:rejected')]);
      okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('PENDING_APPROVAL'), { externalRef: 'tr-1' }), [{ ...outbox('o:a'), payload: 'second' }, outbox('o:c')]));
      expect(okValue(await s.pendingOutbox()).map((o) => [o.key, o.payload])).toEqual([
        ['o:a', 'o:a'],
        ['o:b', 'o:b'],
        ['o:c', 'o:c'],
      ]);
    });

    it('AMBIGUOUS before commit applies nothing; after commit the change is visible and a re-send is DUPLICATE', async () => {
      const f = new FaultPlan();
      const s = make(f);
      const r = okValue(await s.create(newPayment()));
      const one = sig('LEDGER', 'ledger:amb');
      f.arm('applySignal', 'BEFORE_COMMIT', 'TIMEOUT');
      expect(await s.applySignal(PID, r.version, one, to('RESERVE', st('COMPLETED')), [outbox('o:amb')])).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.get(PID)).version).toBe(1n);
      expect(okValue(await s.pendingOutbox())).toEqual([]);
      f.arm('applySignal', 'AFTER_COMMIT', 'TRANSPORT');
      expect(await s.applySignal(PID, r.version, one, to('RESERVE', st('COMPLETED')), [outbox('o:amb')])).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
      expect(okValue(await s.get(PID)).version).toBe(2n);
      expect(okValue(await s.applySignal(PID, r.version, one, to('RESERVE', st('COMPLETED')), []), true).outcome).toBe('DUPLICATE');
      expect(okValue(await s.pendingOutbox()).map((o) => o.key)).toEqual(['o:amb']);
    });
  });

  describe('applySignal: legs in journey order; a FAILED payment never has money in flight (B3)', () => {
    it('no Arc progress before the reservation and its marker; a pre-request failure may land while nothing has started', async () => {
      const s = make();
      const r = okValue(await s.create(newPayment()));
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('PENDING_APPROVAL'), { externalRef: 'tr-1' }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      const failed = okValue(await s.applySignal(PID, r.version, sig('INTERNAL'), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK' }), []));
      expect(failed.record).toMatchObject({ stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK', status: 'FAILED' });
      expect(failed.record.legs[0]?.stage).toBe('CREATED');
      expect(await s.applySignal(PID, failed.record.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /nothing changes after a failure/ });
    });

    it('fiat payout (receiver\'s choice): a PAYOUT failure while the Arc leg moves money is refused (probe P3)', async () => {
      const s = make();
      let r = await toSubmitted(s, fiatBankPayment());
      r = okValue(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: TX }), [])).record;
      for (const [src, state] of [
        ['OPERATOR_DECISION', { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }],
        ['INTERNAL', { stage: 'REJECTED', reason: 'METHOD_NOT_ENABLED' }],
      ] as const) {
        expect(await s.applySignal(PID, r.version, sig(src), to('PAYOUT', state), [outbox(releaseKey(PID))])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /PAYOUT cannot fail while a leg ahead of it is not completed/ });
      }
      expect(okValue(await s.pendingOutbox())).toEqual([]);
      expect(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), to('PAYOUT', st('SUBMITTED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /PAYOUT cannot progress while a leg ahead/ });
      r = okValue(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).record;
      expect(r).toMatchObject({ stage: 'CREATED', status: 'PENDING' });
      expect(r.legs.map((l) => l.stage)).toEqual(['COMPLETED', 'COMPLETED', 'CREATED']);
    });

    it('a later-leg failure is refused while a DFNS request may exist ahead of it, even at CREATED', async () => {
      const s = make();
      const r = await marked(s, fiatBankPayment());
      expect(await s.applySignal(PID, r.version, sig('INTERNAL'), to('PAYOUT', { stage: 'REJECTED', reason: 'METHOD_NOT_ENABLED' }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      const s2 = make();
      const q = okValue(await s2.create(fiatBankPayment()));
      expect(okValue(await s2.applySignal(PID, q.version, sig('INTERNAL'), to('PAYOUT', { stage: 'REJECTED', reason: 'METHOD_NOT_ENABLED' }), [])).record).toMatchObject({ status: 'FAILED', reason: 'METHOD_NOT_ENABLED' });
    });

    it('fiat payout: SETTLED only when the PAYOUT leg completes on the partner callback; PAYOUT_FAILED after Arc is FAILED (F-17)', async () => {
      const s = make();
      let r = await toSubmitted(s, fiatBankPayment());
      r = okValue(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).record;
      r = okValue(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), to('PAYOUT', st('SUBMITTED'), { externalRef: 'po-1' }), [])).record;
      expect(r.status).toBe('PROCESSING');
      expect(await s.applySignal(PID, r.version, sig('INTERNAL'), to('PAYOUT', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('PAYOUT', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      const paid = okValue(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), to('PAYOUT', st('COMPLETED')), [])).record;
      expect(paid).toMatchObject({ stage: 'COMPLETED', status: 'SETTLED' });
      const s2 = make();
      let q = await toSubmitted(s2, fiatBankPayment());
      q = okValue(await s2.applySignal(PID, q.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).record;
      q = okValue(await s2.applySignal(PID, q.version, sig('PAYOUT_CALLBACK'), to('PAYOUT', st('SUBMITTED')), [])).record;
      q = okValue(await s2.applySignal(PID, q.version, sig('PAYOUT_CALLBACK'), to('PAYOUT', { stage: 'REJECTED', reason: 'PAYOUT_FAILED' }), [])).record;
      expect(q).toMatchObject({ stage: 'REJECTED', reason: 'PAYOUT_FAILED', status: 'FAILED' });
    });
  });

  describe('applySignal: Arc failures need their proof (§8.4 check 3, §13.3, B2)', () => {
    it('a hash-less DFNS Failed alone never ends the leg; only the two-person proof (c) decision does', async () => {
      const s = make();
      let r = await pending(s);
      r = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED')), [])).record;
      for (const reason of ['DFNS_FAILED', 'BLOCKLISTED_PRE_MEMPOOL'] as const)
        for (const src of ['DFNS_WEBHOOK', 'DFNS_POLL', 'INTERNAL'] as const) {
          expect(await s.applySignal(PID, r.version, sig(src), to('ARC_TRANSFER', { stage: 'REJECTED', reason }), [outbox(releaseKey(PID))])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
        }
      expect(await s.applySignal(PID, r.version, sig('DFNS_WEBHOOK'), to('ARC_TRANSFER', { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
      const proofC = await decide(s, 'NONCE_TX_LOCATED');
      const out = okValue(await s.applySignal(PID, r.version, opSig(proofC), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRE_MEMPOOL' }), [outbox(releaseKey(PID))]));
      expect(out.record).toMatchObject({ stage: 'REJECTED', reason: 'BLOCKLISTED_PRE_MEMPOOL', status: 'FAILED' });
      expect(okValue(await s.pendingOutbox()).map((o) => o.key)).toEqual([releaseKey(PID)]);
      expect(okValue(await s.applySignal(PID, out.record.version, opSig(proofC), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRE_MEMPOOL' }), []), true).outcome).toBe('DUPLICATE');
      expect(await s.applySignal(PID, out.record.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
    });

    it('operator cancel after the request exists only on an accepted abort (proof (a2), a two-person decision)', async () => {
      const s = make();
      const r = await pending(s);
      const abort = await decide(s, 'ABORT_ACCEPTED');
      const out = okValue(await s.applySignal(PID, r.version, opSig(abort), to('ARC_TRANSFER', { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }), []));
      expect(out.record).toMatchObject({ stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR', status: 'FAILED' });
    });

    it('under-floor drop (proof (b), our own check) and a recorded DFNS cancel replacement: FAILED with reason, only once broadcast', async () => {
      const s = make();
      const r = await toSubmitted(s);
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', { stage: 'EXPIRED', reason: 'UNDER_FEE_FLOOR_DROPPED' }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      expect(okValue(await s.applySignal(PID, r.version, sig('INTERNAL'), to('ARC_TRANSFER', { stage: 'EXPIRED', reason: 'UNDER_FEE_FLOOR_DROPPED' }), [])).record).toMatchObject({ stage: 'EXPIRED', reason: 'UNDER_FEE_FLOOR_DROPPED', status: 'FAILED' });
      const s2 = make();
      const q = await toSubmitted(s2);
      expect(await s2.applySignal(PID, q.version, sig('INTERNAL'), to('ARC_TRANSFER', { stage: 'CANCELLED', reason: 'CANCELLED_ONCHAIN_REPLACED' }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      const cancel = await decide(s2, 'DFNS_CANCEL_ISSUED');
      expect(okValue(await s2.applySignal(PID, q.version, opSig(cancel), to('ARC_TRANSFER', { stage: 'CANCELLED', reason: 'CANCELLED_ONCHAIN_REPLACED' }), [])).record).toMatchObject({ stage: 'CANCELLED', reason: 'CANCELLED_ONCHAIN_REPLACED', status: 'FAILED' });
    });
  });

  describe('recordCompensation (REVERSED only via the P7 of this payment\'s P2/P2I)', () => {
    async function settled(s: PaymentStorePort): Promise<PaymentRecord> {
      const r = await toSubmitted(s);
      return okValue(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).record;
    }

    it('SETTLED + the P7 of its P2 → REVERSED; stage stays COMPLETED; idempotent per journal', async () => {
      const s = make();
      const r = await settled(s);
      const rev = okValue(await s.recordCompensation(PID, r.version, P7, P2));
      expect(rev).toMatchObject({ stage: 'COMPLETED', status: 'REVERSED', compensatedBy: 'jr-p7', version: r.version + 1n });
      expect(await s.get(PID)).toEqual({ kind: 'OK', value: rev, replayed: false });
      expect(await s.recordCompensation(PID, r.version, P7, P2)).toEqual({ kind: 'OK', value: rev, replayed: true });
      expect(await s.recordCompensation(PID, rev.version, { ...P7, journalId: 'jr-other' }, P2)).toMatchObject({ kind: 'REJECTED', code: 'ALREADY_REVERSED', detail: 'compensated by jr-p7' });
      expect(await s.applySignal(PID, rev.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED')), [])).toMatchObject({ kind: 'OK', value: { outcome: 'DUPLICATE' } });
      const s2 = make();
      const q = await settled(s2);
      const p2i = receipt({ journalId: 'jr-p2i', key: idempotencyKey(`pay:${PID}:p2i`), template: 'P2I_SETTLE_INTERNAL' });
      expect(okValue(await s2.recordCompensation(PID, q.version, { ...P7, refs: { ...P7.refs, compensates: 'jr-p2i' } }, p2i)).status).toBe('REVERSED');
    });

    it('refuses anything but the P7 that compensates this payment\'s P2 or P2I (a P7 of the fee alone does not reverse, m3)', async () => {
      const s = make();
      const r = await settled(s);
      const no = async (p7: JournalReceipt, original: JournalReceipt): Promise<void> => {
        expect(await s.recordCompensation(PID, r.version, p7, original)).toMatchObject({ kind: 'REJECTED', code: 'NOT_COMPENSATION', detail: /P7 receipt compensating this payment's P2 or P2I/ });
      };
      await no({ ...P7, template: 'P6_RELEASE' }, P2);
      await no({ ...P7, refs: { ...P7.refs, paymentId: PID2 } }, P2);
      await no({ ...P7, refs: { ...P7.refs, compensates: 'jr-other' } }, P2);
      await no({ ...P7, refs: { ...P7.refs, compensates: 'jr-p3' } }, receipt({ journalId: 'jr-p3', template: 'P3_FEE' }));
      await no(P7, receipt({ refs: { paymentId: PID2 } }));
      await no({ ...P7, refs: { ...P7.refs, compensates: 'jr-p1' } }, receipt({ journalId: 'jr-p1', template: 'P1_RESERVE' }));
      // m10: the receipts must sit under this payment's §10.2 keys.
      await no({ ...P7, key: idempotencyKey(`pay:${PID2}:p7`) }, P2);
      await no({ ...P7, key: idempotencyKey(`pay:${PID}:p7f`) }, P2);
      await no(P7, { ...P2, key: idempotencyKey(`pay:${PID}:p2i`) });
      await no(P7, { ...P2, key: idempotencyKey(`pay:${PID2}:p2`) });
      expect(await s.recordCompensation(PID, 99n, P7, P2)).toMatchObject({ kind: 'REJECTED', code: 'VERSION_CONFLICT', detail: `at version ${r.version}` });
      expect(await s.recordCompensation(PID2, 1n, P7, P2)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      expect(okValue(await s.get(PID)).status).toBe('SETTLED');
    });

    it('a payment that is not SETTLED can never become REVERSED (FAILED stays FAILED)', async () => {
      const s = make();
      let r = okValue(await s.create(newPayment()));
      expect(await s.recordCompensation(PID, r.version, P7, P2)).toMatchObject({ kind: 'REJECTED', code: 'NOT_SETTLED', detail: 'status PENDING' });
      r = okValue(await s.applySignal(PID, r.version, sig('LEDGER'), to('RESERVE', { stage: 'REJECTED', reason: 'INSUFFICIENT_FUNDS' }), [])).record;
      expect(r.status).toBe('FAILED');
      expect(await s.recordCompensation(PID, r.version, P7, P2)).toMatchObject({ kind: 'REJECTED', code: 'NOT_SETTLED' });
    });

    it('AMBIGUOUS before commit records nothing; after commit it is recorded and a re-send replays', async () => {
      const f = new FaultPlan();
      const s = make(f);
      const r = await settled(s);
      f.arm('recordCompensation', 'BEFORE_COMMIT', 'TIMEOUT');
      expect(await s.recordCompensation(PID, r.version, P7, P2)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.get(PID)).status).toBe('SETTLED');
      f.arm('recordCompensation', 'AFTER_COMMIT', 'UNAVAILABLE');
      expect(await s.recordCompensation(PID, r.version, P7, P2)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
      expect(okValue(await s.get(PID)).status).toBe('REVERSED');
      expect(await s.recordCompensation(PID, r.version, P7, P2)).toMatchObject({ kind: 'OK', replayed: true });
    });
  });

  describe('indexer cursor', () => {
    const rs = (k: string, d = hex('01')): InboundSignal => ({ source: 'ARC_LOG', dedupeKey: k, payloadDigest: d });
    it('starts empty, moves forward, accepts a re-commit of the same block, refuses regression', async () => {
      const s = make();
      expect(okValue(await s.getCursor('arc'))).toBeNull();
      okValue(await s.commitRange('arc', 100n, [rs('arc:1')]));
      expect(okValue(await s.getCursor('arc'))).toBe(100n);
      okValue(await s.commitRange('arc', 100n, [rs('arc:1')]));
      expect(await s.commitRange('arc', 99n, [])).toMatchObject({ kind: 'REJECTED', code: 'CURSOR_REGRESSION', detail: 'cursor at 100, asked 99' });
      okValue(await s.commitRange('arc', 200n, []));
      expect(okValue(await s.getCursor('arc'))).toBe(200n);
      expect(okValue(await s.getCursor('other'))).toBeNull();
      okValue(await s.commitRange('other', 5n, []));
      expect(okValue(await s.getCursor('arc'))).toBe(200n);
    });
    it('a dedupe key seen with another digest (earlier or in the same batch) is SIGNAL_CONFLICT and nothing commits', async () => {
      const s = make();
      okValue(await s.commitRange('arc', 10n, [rs('arc:1')]));
      expect(await s.commitRange('arc', 20n, [rs('arc:2'), rs('arc:1', hex('02'))])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: 'arc:1' });
      expect(await s.commitRange('arc', 20n, [rs('arc:3'), rs('arc:3', hex('03'))])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: 'arc:3' });
      expect(okValue(await s.getCursor('arc'))).toBe(10n);
      okValue(await s.commitRange('arc', 20n, [rs('arc:3', hex('03')), rs('arc:2', hex('04'))]));
      expect(await s.commitRange('arc', 30n, [rs('arc:2')])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      okValue(await s.commitRange('arc', 30n, [rs('arc:3', hex('03')), rs('arc:3', hex('03'))]));
    });
    it('AMBIGUOUS before commit moves nothing; after commit the cursor moved', async () => {
      const f = new FaultPlan();
      const s = make(f);
      f.arm('commitRange', 'BEFORE_COMMIT', 'TRANSPORT');
      expect(await s.commitRange('arc', 5n, [rs('arc:9')])).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
      expect(okValue(await s.getCursor('arc'))).toBeNull();
      f.arm('commitRange', 'AFTER_COMMIT', 'TRANSPORT');
      expect(await s.commitRange('arc', 5n, [rs('arc:9')])).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
      expect(okValue(await s.getCursor('arc'))).toBe(5n);
      expect(await s.commitRange('arc', 6n, [rs('arc:9', hex('09'))])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
    });
  });

  describe('rail state (fail closed, two-person unpause by a recorded, unused decision)', () => {
    it('pause keeps the first reason; unpause needs a recorded UNPAUSE decision by two distinct authenticated approvers, used once', async () => {
      const s = make();
      okValue(await s.create(newPayment()));
      expect(okValue(await s.getRailState())).toEqual({ paused: false, reason: null, incident: null });
      expect(await s.unpause(decision())).toMatchObject({ kind: 'REJECTED', code: 'NOT_PAUSED', detail: 'rail is running' });
      okValue(await s.pause('RPC_DISAGREEMENT', 'indexer'));
      expect(okValue(await s.create(newPayment()), true).paymentId).toBe(PID);
      okValue(await s.pause('CHAIN_STALL', 'monitor'));
      expect(okValue(await s.getRailState())).toEqual({ paused: true, reason: 'RPC_DISAGREEMENT (by indexer)', incident: 'pause-1' });
      expect(await s.unpause(decision({ approvers: ['ann', 'ann'] }))).toMatchObject({ kind: 'REJECTED', code: 'SAME_APPROVER', detail: /two distinct approvers/ });
      expect(await s.unpause(decision({ approvers: ['ann', ''] }))).toMatchObject({ kind: 'REJECTED', code: 'APPROVER_UNAUTHENTICATED' });
      expect(await s.unpause(decision({ approvers: ['', 'bob'] }))).toMatchObject({ kind: 'REJECTED', code: 'APPROVER_UNAUTHENTICATED' });
      // m3: canonical ids: case and NFKC forms of one id are one person; whitespace is never an id.
      expect(await s.unpause(decision({ approvers: ['ann', 'ANN'] }))).toMatchObject({ kind: 'REJECTED', code: 'SAME_APPROVER' });
      expect(await s.unpause(decision({ approvers: ['\uFF41nn', 'ann'] }))).toMatchObject({ kind: 'REJECTED', code: 'SAME_APPROVER' });
      expect(await s.unpause(decision({ approvers: [' ', 'bob'] }))).toMatchObject({ kind: 'REJECTED', code: 'APPROVER_UNAUTHENTICATED', detail: /no whitespace/ });
      expect(await s.unpause(decision({ approvers: ['ann', 'bob '] }))).toMatchObject({ kind: 'REJECTED', code: 'APPROVER_UNAUTHENTICATED' });
      const lift = decision({ kind: 'LIFT_QUARANTINE' });
      expect(await s.unpause(lift)).toMatchObject({ kind: 'REJECTED', code: 'WRONG_KIND', detail: `decision ${lift.decisionId} is LIFT_QUARANTINE` });
      expect(await s.unpause(decision())).toMatchObject({ kind: 'REJECTED', code: 'DECISION_MISSING' });
      // m5: an UNPAUSE decision lifts only the pause it names.
      const other = await decide(s, 'UNPAUSE', 'rail');
      expect(await s.unpause(other)).toMatchObject({ kind: 'REJECTED', code: 'WRONG_INCIDENT', detail: `decision ${other.decisionId} is for rail; the pause in force is pause-1` });
      const d1 = await decide(s, 'UNPAUSE', 'pause-1');
      expect(await s.unpause({ ...d1, evidenceDigest: hex('ef') })).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /differs from the recorded one/ });
      expect(okValue(await s.getRailState()).paused).toBe(true);
      okValue(await s.unpause(d1));
      expect(okValue(await s.getRailState())).toEqual({ paused: false, reason: null, incident: null });
      okValue(await s.pause('DRIFT', 'recon'));
      expect(okValue(await s.getRailState())).toEqual({ paused: true, reason: 'DRIFT (by recon)', incident: 'pause-2' });
      // S10: an old decision never lifts a new pause; each pause needs fresh approvals.
      expect(await s.unpause(d1)).toMatchObject({ kind: 'REJECTED', code: 'DECISION_CONSUMED' });
      expect(await s.unpause(await decide(s, 'UNPAUSE', 'pause-1', { seq: 2n }))).toMatchObject({ kind: 'REJECTED', code: 'WRONG_INCIDENT' });
      expect(okValue(await s.getRailState()).paused).toBe(true);
      okValue(await s.unpause(await decide(s, 'UNPAUSE', 'pause-2')));
      expect(okValue(await s.getRailState()).paused).toBe(false);
    });

    it('AMBIGUOUS on pause and unpause, before and after commit', async () => {
      const f = new FaultPlan();
      const s = make(f);
      f.arm('pause', 'BEFORE_COMMIT', 'TIMEOUT');
      expect(await s.pause('X', 'a')).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.getRailState()).paused).toBe(false);
      f.arm('pause', 'AFTER_COMMIT', 'TIMEOUT');
      expect(await s.pause('X', 'a')).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.getRailState()).paused).toBe(true);
      const d = await decide(s, 'UNPAUSE', 'pause-1');
      f.arm('unpause', 'BEFORE_COMMIT', 'TIMEOUT');
      expect(await s.unpause(d)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.getRailState()).paused).toBe(true);
      f.arm('unpause', 'AFTER_COMMIT', 'TIMEOUT');
      expect(await s.unpause(d)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.getRailState()).paused).toBe(false);
      okValue(await s.pause('Y', 'a'));
      expect(await s.unpause(d)).toMatchObject({ kind: 'REJECTED', code: 'DECISION_CONSUMED' });
    });
  });

  describe('recordDecision (two-person, through the inbox, §10.3)', () => {
    it('records once; the same decision again is DUPLICATE; getDecision reads it back', async () => {
      const s = make();
      expect(await s.getDecision('dec-none')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      const d = await decide(s, 'LINK_HASH');
      expect(await s.getDecision(d.decisionId)).toEqual({ kind: 'OK', value: d, replayed: false });
      expect(await s.recordDecision(opSig(d), d)).toEqual({ kind: 'OK', value: { outcome: 'DUPLICATE' }, replayed: true });
    });

    it('refuses equal or missing approvers, a mislabelled signal, an underived id, and different evidence under one id', async () => {
      const s = make();
      const d = decision({ kind: 'LINK_HASH', subject: PID });
      const no = async (sg: InboundSignal, x: OperatorDecision, code: string, detail: RegExp): Promise<void> => {
        expect(await s.recordDecision(sg, x)).toMatchObject({ kind: 'REJECTED', code, detail });
      };
      await no(opSig(d), { ...d, approvers: ['ann', 'ann'] }, 'SAME_APPROVER', /two distinct approvers/);
      await no(opSig(d), { ...d, approvers: ['', 'bob'] }, 'APPROVER_UNAUTHENTICATED', /authenticated/);
      await no(opSig(d), { ...d, approvers: ['ann', ''] }, 'APPROVER_UNAUTHENTICATED', /authenticated/);
      await no({ ...opSig(d), source: 'INTERNAL' }, d, 'SIGNAL_CONFLICT', /only from an OPERATOR_DECISION signal/);
      await no({ ...opSig(d), dedupeKey: 'op:dec-other' }, d, 'SIGNAL_CONFLICT', /only from an OPERATOR_DECISION signal/);
      await no(opSig({ ...d, decisionId: 'dec-forged' }), { ...d, decisionId: 'dec-forged' }, 'SIGNAL_CONFLICT', /does not derive/);
      await no(opSig(d), { ...d, subject: PID2 }, 'SIGNAL_CONFLICT', /only from an OPERATOR_DECISION signal|does not derive/);
      expect(await s.getDecision(d.decisionId)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      okValue(await s.recordDecision(opSig(d), d));
      await no(opSig(d, hex('df')), d, 'SIGNAL_CONFLICT', /different payload/);
      await no(opSig(d), { ...d, evidenceDigest: hex('ef') }, 'SIGNAL_CONFLICT', /different evidence/);
      await no(opSig(d), { ...d, approvers: ['bob', 'ann'] }, 'SIGNAL_CONFLICT', /different evidence/);
      await no(opSig(d), { ...d, decidedAt: 't2' }, 'SIGNAL_CONFLICT', /different evidence/);
      expect(okValue(await s.getDecision(d.decisionId))).toEqual(d);
    });

    it('OPERATOR_DECISION evidence applies only with a recorded decision for this payment, of the kind the transition needs (B2)', async () => {
      const s = make();
      let r = await pending(s);
      r = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED')), [])).record;
      const fail = to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'DFNS_FAILED' });
      const unrecorded = decision({ kind: 'NONCE_TX_LOCATED', subject: PID });
      expect(await s.applySignal(PID, r.version, opSig(unrecorded), fail, [outbox(releaseKey(PID))])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /no recorded two-person decision/ });
      expect(await s.applySignal(PID, r.version, sig('OPERATOR_DECISION', 'op:anything'), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: hex('66') }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /no recorded/ });
      const other = await decide(s, 'NONCE_TX_LOCATED', PID2);
      expect(await s.applySignal(PID, r.version, opSig(other), fail, [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /is for pay-0202/ });
      const link = await decide(s, 'LINK_HASH');
      expect(await s.applySignal(PID, r.version, opSig(link), fail, [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /is LINK_HASH; this transition needs NONCE_TX_LOCATED/ });
      const abort = await decide(s, 'ABORT_ACCEPTED');
      expect(await s.applySignal(PID, r.version, opSig(abort), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: hex('66') }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /needs LINK_HASH/ });
      const unpause = await decide(s, 'UNPAUSE', PID);
      expect(await s.applySignal(PID, r.version, opSig(unpause), to('ARC_TRANSFER', { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /needs ABORT_ACCEPTED/ });
      expect(okValue(await s.get(PID))).toMatchObject({ version: r.version, status: 'PROCESSING' });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
      const proofC = await decide(s, 'NONCE_TX_LOCATED');
      expect(okValue(await s.applySignal(PID, r.version, opSig(proofC), fail, [outbox(releaseKey(PID))])).record).toMatchObject({ status: 'FAILED', reason: 'DFNS_FAILED' });
    });

    it('a decision key first seen as a no-change signal is still recorded once, then applies once', async () => {
      const s = make();
      const r = await pending(s);
      const d = decision({ kind: 'LINK_HASH', subject: PID });
      expect(okValue(await s.applySignal(PID, r.version, opSig(d), to('ARC_TRANSFER', st('CREATED')), [])).outcome).toBe('STALE');
      expect(await s.recordDecision(opSig(d, hex('df')), d)).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      expect(okValue(await s.recordDecision(opSig(d), d)).outcome).toBe('APPLIED');
      expect(okValue(await s.applySignal(PID, r.version, opSig(d), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: TX }), [])).record.legs[1]?.txHash).toBe(TX);
    });

    it('a decision applies to one payment only: its key is then claimed (§6.5 rule 5)', async () => {
      const s = make();
      okValue(await s.create(newPayment()));
      okValue(await s.create(newPayment({ paymentId: PID2, requestKey: idempotencyKey('req-two') })));
      const d = await decide(s, 'ABORT_ACCEPTED');
      const cancel = to('ARC_TRANSFER', { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' });
      expect(okValue(await s.applySignal(PID, 1n, opSig(d), cancel, [])).record.status).toBe('FAILED');
      expect(await s.applySignal(PID2, 1n, opSig(d), cancel, [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /already applied to another payment/ });
    });

    it('F-18: a two-person LINK_HASH replaces a speed-up hash; the leg then completes only in the linked transaction (m3a)', async () => {
      const s = make();
      const r = await toSubmitted(s);
      const sped = hex('7c');
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: sped }), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      const wrongSubject = await decide(s, 'LINK_HASH', PID2);
      expect(await s.applySignal(PID, r.version, opSig(wrongSubject), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: sped }), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      // m2: a LINK_HASH links only the hash both approvers saw.
      const linkTx = await decide(s, 'LINK_HASH', PID, { seq: 2n });
      expect(await s.applySignal(PID, r.version, opSig(linkTx), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: sped }), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      const link = await decide(s, 'LINK_HASH', PID, { txHash: sped });
      const q = okValue(await s.applySignal(PID, r.version, opSig(link), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: sped }), [])).record;
      expect(q.legs[1]).toMatchObject({ stage: 'CONFIRMING', txHash: sped, externalRef: 'tr-01' });
      expect(await s.applySignal(PID, q.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      expect(okValue(await s.applySignal(PID, q.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: sped }), [])).record.status).toBe('SETTLED');
    });
  });

  describe('P6 only with the change that fails the payment (§7.3, §9.2 P6, B1)', () => {
    it('S1: an UNRESOLVED leg resolved by DFNS to a live stage cannot carry P6 (LEG_UNRESOLVED); the leg still moves on afterwards', async () => {
      const s = make();
      const r = await marked(s);
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('PENDING_APPROVAL'), { externalRef: 'tr-1' }), [outbox(releaseKey(PID))])).toMatchObject({
        kind: 'REJECTED',
        code: 'LEG_UNRESOLVED',
        detail: /P6 refused/,
      });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
      const q = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('PENDING_APPROVAL'), { externalRef: 'tr-1' }), [])).record;
      expect(q.legs[1]).toMatchObject({ stage: 'PENDING_APPROVAL', externalRef: 'tr-1' });
    });

    it('S2: a KNOWN leg moving forward, a STALE signal, or a SETTLING log cannot carry P6 (ILLEGAL_TRANSITION)', async () => {
      const s = make();
      const r = await pending(s);
      const p6 = [outbox('o:x'), outbox(releaseKey(PID))];
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED')), p6)).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /P6 refused: the payment is PROCESSING/ });
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('CREATED')), p6)).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /changes nothing enqueues nothing/ });
      const s3 = make();
      const q = await toSubmitted(s3);
      expect(await s3.applySignal(PID, q.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [outbox(releaseKey(PID))])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /the payment is SETTLED/ });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
      expect(okValue(await s3.pendingOutbox())).toEqual([]);
    });

    it('a DFNS signal that resolves an UNRESOLVED leg and ends it (proof (a1)) carries P6 in the same commit', async () => {
      const s = make();
      const r = await marked(s);
      const out = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'APPROVAL_DENIED' }, { externalRef: 'tr-1' }), [outbox(releaseKey(PID))]));
      expect(out.record).toMatchObject({ status: 'FAILED', reason: 'APPROVAL_DENIED' });
      expect(okValue(await s.pendingOutbox()).map((o) => o.key)).toEqual([releaseKey(PID)]);
    });
  });

  describe('inbox claims: only a change claims a key (m3b, m3c)', () => {
    it('S5: a log offered to the wrong payment as STALE does not claim it; the right payment still applies it once', async () => {
      const s = make();
      okValue(await s.create(newPayment()));
      const b = await toSubmitted(s, newPayment({ paymentId: PID2, requestKey: idempotencyKey('req-two') }), hex('7b'));
      let a = okValue(await s.get(PID));
      a = okValue(await s.applySignal(PID, a.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
      const log = sig('ARC_LOG', `arc:5042002:${hex('7b')}:0`, hex('11'));
      expect(okValue(await s.applySignal(PID, a.version, log, to('RESERVE', st('CONFIRMING')), [])).outcome).toBe('STALE');
      expect(okValue(await s.applySignal(PID2, b.version, log, to('ARC_TRANSFER', st('COMPLETED'), { txHash: hex('7b') }), [])).record.status).toBe('SETTLED');
      expect(okValue(await s.applySignal(PID2, b.version, log, to('ARC_TRANSFER', st('COMPLETED'), { txHash: hex('7b') }), []), true).outcome).toBe('DUPLICATE');
      expect(await s.applySignal(PID, a.version, log, to('RESERVE', st('CONFIRMING')), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /already applied to another payment/ });
    });

    it('S4: a state-level DUPLICATE (terminal leg, fresh key) does not claim the key either', async () => {
      const s = make();
      const a = await toSubmitted(s);
      const done = okValue(await s.applySignal(PID, a.version, sig('ARC_LOG', 'arc:l1'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).record;
      const l2 = sig('ARC_LOG', `arc:5042002:${hex('7b')}:0`);
      expect(okValue(await s.applySignal(PID, done.version, l2, to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), []), true).outcome).toBe('DUPLICATE');
      const b = await toSubmitted(s, newPayment({ paymentId: PID2, requestKey: idempotencyKey('req-two') }), hex('7b'));
      expect(okValue(await s.applySignal(PID2, b.version, l2, to('ARC_TRANSFER', st('COMPLETED'), { txHash: hex('7b') }), [])).record.status).toBe('SETTLED');
    });
  });

  describe('wallet nonce holds (§8.4 check 5, §7.3 durability, B3)', () => {
    const HOT = walletRef('w-hot');
    const hold = (over: Partial<NewNonceHold> = {}): NewNonceHold => ({ wallet: HOT, dfnsTransferId: 'tr-01', subject: PID, nonce: 7n, aborted: false, ...over });
    /** Arc leg APPROVED with DFNS transfer tr-01 and no hash. */
    async function approved(s: PaymentStorePort): Promise<PaymentRecord> {
      const r = await pending(s);
      return okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED')), [])).record;
    }
    const failed = 'dfns:transfer:tr-01:Failed';

    it('a hash-less DFNS Failed places the hold in the same commit; the leg is unchanged and nothing is released', async () => {
      const s = make();
      const r = await approved(s);
      expect(okValue(await s.listActiveHolds(HOT))).toEqual([]);
      const out = okValue(await s.applySignal(PID, r.version, sig('DFNS_WEBHOOK', failed), to('ARC_TRANSFER', st('APPROVED'), { placeHold: hold() }), []));
      expect(out).toEqual({ outcome: 'STALE', record: r });
      const holds = okValue(await s.listActiveHolds(HOT));
      expect(holds).toEqual([{ ...hold(), holdId: deriveHoldId(HOT, 'tr-01'), lastAtOrBelow: null, firstAbove: null, nonceTx: null, state: 'ACTIVE', liftedBy: null }]);
      expect(holds[0]?.holdId).toMatch(/^hold-[0-9a-f]{32}$/);
      expect(okValue(await s.listActiveHolds(walletRef('w-other')))).toEqual([]);
      // The webhook and the poll of the same state dedupe to one; the key is claimed by the hold.
      expect(okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL', failed), to('ARC_TRANSFER', st('APPROVED'), { placeHold: hold() }), []), true).outcome).toBe('DUPLICATE');
      expect(okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL', 'dfns:other'), to('ARC_TRANSFER', st('APPROVED'), { placeHold: hold({ nonce: 9n }) }), [])).outcome).toBe('STALE');
      expect(okValue(await s.listActiveHolds(HOT))).toEqual(holds);
      expect(okValue(await s.get(PID))).toEqual(r);
      expect(okValue(await s.pendingOutbox())).toEqual([]);
    });

    it('an accepted abort ends the leg (proof (a2)) and places the hold in one commit; the hold outlives the terminal leg', async () => {
      const s = make();
      const r = await approved(s);
      const abort = await decide(s, 'ABORT_ACCEPTED');
      const out = okValue(await s.applySignal(PID, r.version, opSig(abort), to('ARC_TRANSFER', { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }, { placeHold: hold({ aborted: true }) }), [outbox(releaseKey(PID))]));
      expect(out.record.status).toBe('FAILED');
      expect(okValue(await s.listActiveHolds(HOT))).toMatchObject([{ aborted: true, state: 'ACTIVE' }]);
    });

    it('refuses a hold that does not name this payment, its wallet and its hash-less DFNS transfer, or comes from elsewhere', async () => {
      const s = make();
      const r = await approved(s);
      const no = async (src: SignalSource, t: LegTransition, detail: RegExp): Promise<void> => {
        expect(await s.applySignal(PID, r.version, sig(src), t, [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail });
      };
      const stay = (h: NewNonceHold): LegTransition => to('ARC_TRANSFER', st('APPROVED'), { placeHold: h });
      await no('DFNS_POLL', stay(hold({ wallet: walletRef('w-other') })), /names this payment and its sending wallet/);
      await no('DFNS_POLL', stay(hold({ subject: PID2 })), /names this payment and its sending wallet/);
      await no('DFNS_POLL', stay(hold({ dfnsTransferId: 'tr-other' })), /this leg's DFNS transfer/);
      await no('DFNS_POLL', stay(hold({ nonce: -1n })), /non-negative/);
      await no('INTERNAL', stay(hold()), /only a DFNS signal or a two-person decision/);
      await no('LEDGER', to('RESERVE', st('COMPLETED'), { placeHold: hold() }), /belongs to the Arc leg/);
      const unrecorded = decision({ kind: 'ABORT_ACCEPTED', subject: PID });
      await no('OPERATOR_DECISION', { ...stay(hold()) }, /no recorded two-person decision/);
      expect(await s.applySignal(PID, r.version, opSig(unrecorded), stay(hold()), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION' });
      const sub = make();
      const q = await toSubmitted(sub);
      expect(await sub.applySignal(PID, q.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('SUBMITTED'), { placeHold: hold() }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /no txHash/ });
      const m = make();
      const u = await marked(m);
      expect(await m.applySignal(PID, u.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('CREATED'), { placeHold: hold() }), [])).toMatchObject({ kind: 'REJECTED', code: 'LEG_UNRESOLVED' });
      expect(okValue(await s.listActiveHolds(HOT))).toEqual([]);
      expect(okValue(await sub.listActiveHolds(HOT))).toEqual([]);
    });

    it('observations bound the nonce window; the nonce-n tx is set once; the hold lifts only once the account nonce passed n', async () => {
      const s = make();
      const r = await approved(s);
      okValue(await s.applySignal(PID, r.version, sig('DFNS_WEBHOOK', failed), to('ARC_TRANSFER', st('APPROVED'), { placeHold: hold() }), []));
      const id = deriveHoldId(HOT, 'tr-01');
      const ev = sig('INTERNAL', `nonce:${id}:passed`, hex('a1'));
      expect(await s.liftHold(id, ev)).toMatchObject({ kind: 'REJECTED', code: 'HOLD_NOT_RESOLVED', detail: 'account nonce not yet seen above 7' });
      expect(okValue(await s.recordHoldObservation(id, { block: 100n, accountNonce: 6n }))).toMatchObject({ lastAtOrBelow: { block: 100n, accountNonce: 6n }, firstAbove: null });
      expect(okValue(await s.recordHoldObservation(id, { block: 90n, accountNonce: 5n }))).toMatchObject({ lastAtOrBelow: { block: 100n, accountNonce: 6n } });
      expect(okValue(await s.recordHoldObservation(id, { block: 110n, accountNonce: 7n }))).toMatchObject({ lastAtOrBelow: { block: 110n, accountNonce: 7n } });
      expect(okValue(await s.recordHoldObservation(id, { block: 130n, accountNonce: 8n }))).toMatchObject({ firstAbove: { block: 130n, accountNonce: 8n } });
      expect(okValue(await s.recordHoldObservation(id, { block: 140n, accountNonce: 9n }))).toMatchObject({ firstAbove: { block: 130n, accountNonce: 8n } });
      expect(okValue(await s.recordHoldObservation(id, { block: 120n, accountNonce: 8n }))).toMatchObject({ lastAtOrBelow: { block: 110n }, firstAbove: { block: 120n } });
      // m1: the account nonce passing n is not enough; the nonce-n transaction must be located first (F-3b step 4a).
      expect(await s.liftHold(id, ev)).toMatchObject({ kind: 'REJECTED', code: 'HOLD_NOT_RESOLVED', detail: /nonce-7 transaction is not located/ });
      expect(okValue(await s.recordHoldNonceTx(id, hex('5a')))).toMatchObject({ nonceTx: hex('5a') });
      for (const src of ['DFNS_WEBHOOK', 'DFNS_POLL', 'LEDGER', 'CONVERSION', 'PAYOUT_CALLBACK'] as const) {
        expect(await s.liftHold(id, sig(src, `lift:${src}`)), src).toMatchObject({ kind: 'REJECTED', code: 'HOLD_NOT_RESOLVED', detail: /cannot lift a hold/ });
      }
      expect(okValue(await s.listActiveHolds(HOT))).toHaveLength(1);
      expect(await s.recordHoldNonceTx(id, hex('5a'))).toMatchObject({ kind: 'OK', replayed: true, value: { nonceTx: hex('5a') } });
      expect(await s.recordHoldNonceTx(id, hex('5b'))).toMatchObject({ kind: 'REJECTED', code: 'NONCE_TX_CONFLICT' });
      expect(okValue(await s.listActiveHolds(HOT))).toHaveLength(1);
      expect(await s.liftHold(id, ev)).toMatchObject({ kind: 'OK', replayed: false, value: { state: 'LIFTED', liftedBy: ev.dedupeKey } });
      expect(await s.liftHold(id, ev)).toMatchObject({ kind: 'OK', replayed: true, value: { state: 'LIFTED', liftedBy: ev.dedupeKey } });
      expect(await s.liftHold(id, sig('INTERNAL', 'other:lift'))).toMatchObject({ kind: 'OK', replayed: true, value: { liftedBy: ev.dedupeKey } });
      expect(await s.liftHold(id, { ...ev, payloadDigest: hex('a2') })).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      expect(okValue(await s.listActiveHolds(HOT))).toEqual([]);
      expect(okValue(await s.recordHoldObservation(id, { block: 150n, accountNonce: 9n }))).toMatchObject({ state: 'LIFTED' });
    });

    it('lift evidence is deduped like any signal; an unknown nonce lifts only on a NONCE_UNKNOWN_CLOSE decision for that hold (Q-N20)', async () => {
      const s = make();
      const r = await approved(s);
      okValue(await s.applySignal(PID, r.version, sig('DFNS_WEBHOOK', failed), to('ARC_TRANSFER', st('APPROVED'), { placeHold: hold({ nonce: null }) }), []));
      const id = deriveHoldId(HOT, 'tr-01');
      expect(okValue(await s.recordHoldObservation(id, { block: 1n, accountNonce: 99n }))).toMatchObject({ lastAtOrBelow: null, firstAbove: null });
      expect(await s.liftHold(id, sig('INTERNAL', 'x:1'))).toMatchObject({ kind: 'REJECTED', code: 'HOLD_NOT_RESOLVED', detail: /NONCE_UNKNOWN_CLOSE/ });
      const forPayment = await decide(s, 'NONCE_UNKNOWN_CLOSE', PID);
      expect(await s.liftHold(id, opSig(forPayment))).toMatchObject({ kind: 'REJECTED', code: 'HOLD_NOT_RESOLVED' });
      const wrongKind = await decide(s, 'NONCE_TX_LOCATED', id);
      expect(await s.liftHold(id, opSig(wrongKind))).toMatchObject({ kind: 'REJECTED', code: 'HOLD_NOT_RESOLVED' });
      expect(await s.liftHold(id, sig('INTERNAL', decisionKey(decision({ kind: 'NONCE_UNKNOWN_CLOSE', subject: id }).decisionId)))).toMatchObject({ kind: 'REJECTED', code: 'HOLD_NOT_RESOLVED' });
      const close = await decide(s, 'NONCE_UNKNOWN_CLOSE', id);
      // S713b: the recorded decision's own key, offered from any source but OPERATOR_DECISION, lifts nothing.
      expect(await s.liftHold(id, { ...opSig(close), source: 'INTERNAL' })).toMatchObject({ kind: 'REJECTED', code: 'HOLD_NOT_RESOLVED' });
      expect(await s.liftHold(id, opSig(close, hex('d0')))).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /different payload/ });
      expect(okValue(await s.liftHold(id, opSig(close)))).toMatchObject({ state: 'LIFTED', liftedBy: decisionKey(close.decisionId) });
      expect(okValue(await s.listActiveHolds(HOT))).toEqual([]);
      // A key already applied to a payment cannot lift a hold.
      const s2 = make();
      const q = await approved(s2);
      okValue(await s2.applySignal(PID, q.version, sig('DFNS_WEBHOOK', failed), to('ARC_TRANSFER', st('APPROVED'), { placeHold: hold() }), []));
      okValue(await s2.recordHoldObservation(id, { block: 5n, accountNonce: 8n }));
      expect(await s2.liftHold(id, sig('DFNS_WEBHOOK', failed))).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /already applied to pay-/ });
      expect(okValue(await s2.listActiveHolds(HOT))).toHaveLength(1);
    });

    it('unknown hold ids are NOT_FOUND', async () => {
      const s = make();
      expect(await s.recordHoldObservation('hold-x', { block: 1n, accountNonce: 1n })).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      expect(await s.recordHoldNonceTx('hold-x', hex('5a'))).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      expect(await s.liftHold('hold-x', sig('INTERNAL'))).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    });

    it('restart: holds, markers, decisions, consumed unpauses, the inbox and the outbox survive a rebuild from storage', async () => {
      const s = make();
      const r = await approved(s);
      okValue(await s.applySignal(PID, r.version, sig('DFNS_WEBHOOK', failed), to('ARC_TRANSFER', st('APPROVED'), { placeHold: hold({ aborted: true }) }), []));
      const id = deriveHoldId(HOT, 'tr-01');
      okValue(await s.recordHoldObservation(id, { block: 10n, accountNonce: 7n }));
      okValue(await s.recordHoldNonceTx(id, hex('5a')));
      const s1 = make();
      await marked(s1, newPayment({ paymentId: PID2, requestKey: idempotencyKey('req-two') }));
      okValue(await s.pause('DRIFT', 'recon'));
      const d = await decide(s, 'UNPAUSE', 'pause-1');
      okValue(await s.unpause(d));
      okValue(await s.pause('DRIFT2', 'recon'));
      okValue(await s.commitRange('arc', 50n, [sig('ARC_LOG', 'arc:r1', hex('31'))]));
      const before = { holds: okValue(await s.listActiveHolds(HOT)), rec: okValue(await s.get(PID)) };
      const t = restart(s);
      expect(okValue(await t.listActiveHolds(HOT))).toEqual(before.holds);
      expect(before.holds[0]).toMatchObject({ aborted: true, nonceTx: hex('5a'), lastAtOrBelow: { block: 10n } });
      expect(okValue(await t.get(PID))).toEqual(before.rec);
      expect(okValue(await t.getDecision(d.decisionId))).toEqual(d);
      expect(await t.unpause(d)).toMatchObject({ kind: 'REJECTED', code: 'DECISION_CONSUMED' });
      expect(okValue(await t.getRailState())).toEqual({ paused: true, reason: 'DRIFT2 (by recon)', incident: 'pause-2' });
      // The next pause after a restart keeps counting.
      okValue(await t.unpause(await decide(t, 'UNPAUSE', 'pause-2')));
      okValue(await t.pause('DRIFT3', 'recon'));
      expect(okValue(await t.getRailState()).incident).toBe('pause-3');
      expect(okValue(await t.getCursor('arc'))).toBe(50n);
      expect(await t.applySignal(PID, before.rec.version, sig('DFNS_POLL', failed, hex('77')), to('ARC_TRANSFER', st('APPROVED')), [])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      expect(await t.commitRange('arc', 60n, [sig('ARC_LOG', 'arc:r1', hex('32'))])).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      const t1 = restart(s1);
      expect(okValue(await t1.listUnresolvedSubmits(10n)).map((x) => x.paymentId)).toEqual([PID2]);
      expect(okValue(await t1.findByExternalId(`nv1-${PID2.slice(4)}${'00'.repeat(4)}`))?.paymentId).toBe(PID2);
      // A restarted store keeps working on the same state.
      expect(okValue(await t.recordHoldObservation(id, { block: 20n, accountNonce: 8n }))).toMatchObject({ firstAbove: { block: 20n } });
      expect(okValue(await t.liftHold(id, sig('INTERNAL', 'lift:1')))).toMatchObject({ state: 'LIFTED' });
      expect(okValue(await s.listActiveHolds(HOT))).toHaveLength(1);
    });
  });

  describe('AMBIGUOUS on every operation (§7.8, m5)', () => {
    it('reads fail before reading; decision and hold writes fail before or after commit', async () => {
      const f = new FaultPlan();
      const s = make(f);
      const r = await pending(s);
      const reads: readonly (readonly [string, () => Promise<PortResult<unknown, string>>])[] = [
        ['get', () => s.get(PID)],
        ['getByRequestKey', () => s.getByRequestKey(payer, r.requestKey)],
        ['findByExternalId', () => s.findByExternalId('nv1-x')],
        ['listUnresolvedSubmits', () => s.listUnresolvedSubmits(1n)],
        ['getCursor', () => s.getCursor('arc')],
        ['getRailState', () => s.getRailState()],
        ['listOpen', () => s.listOpen('RESERVE', 'CREATED', 1n)],
        ['pendingOutbox', () => s.pendingOutbox()],
        ['getDecision', () => s.getDecision('dec-x')],
        ['listActiveHolds', () => s.listActiveHolds(walletRef('w-hot'))],
      ];
      for (const [op, call] of reads) {
        f.arm(op, 'BEFORE_COMMIT', 'UNAVAILABLE');
        expect(await call()).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
        expect((await call()).kind).not.toBe('AMBIGUOUS');
      }
      const d = decision({ kind: 'LINK_HASH', subject: PID });
      f.arm('recordDecision', 'BEFORE_COMMIT', 'TIMEOUT');
      expect(await s.recordDecision(opSig(d), d)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(await s.getDecision(d.decisionId)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      f.arm('recordDecision', 'AFTER_COMMIT', 'TIMEOUT');
      expect(await s.recordDecision(opSig(d), d)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.recordDecision(opSig(d), d), true).outcome).toBe('DUPLICATE');
      const q = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED')), [])).record;
      const hold = { wallet: walletRef('w-hot'), dfnsTransferId: 'tr-01', subject: PID, nonce: 3n, aborted: false };
      f.arm('applySignal', 'BEFORE_COMMIT', 'TRANSPORT');
      expect(await s.applySignal(PID, q.version, sig('DFNS_POLL', 'dfns:f'), to('ARC_TRANSFER', st('APPROVED'), { placeHold: hold }), [])).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
      expect(okValue(await s.listActiveHolds(walletRef('w-hot')))).toEqual([]);
      f.arm('applySignal', 'AFTER_COMMIT', 'TRANSPORT');
      expect(await s.applySignal(PID, q.version, sig('DFNS_POLL', 'dfns:f'), to('ARC_TRANSFER', st('APPROVED'), { placeHold: hold }), [])).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
      expect(okValue(await s.listActiveHolds(walletRef('w-hot')))).toHaveLength(1);
      const id = deriveHoldId(walletRef('w-hot'), 'tr-01');
      for (const [op, call, check] of [
        ['recordHoldObservation', () => s.recordHoldObservation(id, { block: 9n, accountNonce: 4n }), (h: { readonly firstAbove: unknown }) => h.firstAbove !== null],
        ['recordHoldNonceTx', () => s.recordHoldNonceTx(id, hex('5a')), (h: { readonly nonceTx: unknown }) => h.nonceTx !== null],
        ['liftHold', () => s.liftHold(id, sig('INTERNAL', 'lift:amb')), (h: { readonly state: string }) => h.state === 'LIFTED'],
      ] as const) {
        f.arm(op, 'BEFORE_COMMIT', 'TIMEOUT');
        expect(await (call as () => Promise<unknown>)()).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
        f.arm(op, 'AFTER_COMMIT', 'TIMEOUT');
        expect(await (call as () => Promise<unknown>)()).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
        const after = okValue(await s.recordHoldObservation(id, { block: 1n, accountNonce: 0n }));
        expect((check as (h: typeof after) => boolean)(after)).toBe(true);
      }
    });
  });

  describe('P6 needs a posted P1; a failed payout is released only by the F-17 close (B1, B2)', () => {
    const CASE = deriveCaseId('PARTNER_RETURN', PID);
    const triple: InboundTriple = { from: addr('9a'), to: addr('aa'), value: nativeWei(1_000_000_000_000_000_000n) };
    const partnerCase = (over: Partial<CaseRecord> = {}): CaseRecord => ({ caseId: CASE, kind: 'PARTNER_RETURN', subject: PID, expected: triple, state: 'OPEN', decisions: [], matchedLog: null, ...over });
    const claimAndRelease = (): OutboxItem[] => [outbox(partnerClaimKey(PID)), outbox(releaseKey(PID))];
    const returnAndRelease = (): OutboxItem[] => [outbox(partnerReturnKey(PID)), outbox(releaseKey(PID))];
    /** FIAT_BANK payment: Arc leg COMPLETED (P2P), then the partner's verified callback PAYOUT_FAILED; nothing released. */
    async function payoutFailed(s: PaymentStorePort): Promise<PaymentRecord> {
      let r = await toSubmitted(s, fiatBankPayment());
      r = okValue(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).record;
      r = okValue(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), to('PAYOUT', st('SUBMITTED'), { externalRef: 'po-1' }), [])).record;
      return okValue(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), to('PAYOUT', { stage: 'REJECTED', reason: 'PAYOUT_FAILED' }), [])).record;
    }
    /** Two people open the PARTNER_RETURN case for PID (OPEN_PARTNER_CASE). */
    async function openCase(s: PaymentStorePort): Promise<CaseRecord> {
      const open = await decide(s, 'OPEN_PARTNER_CASE', PID, { caseId: CASE });
      return okValue(await s.putCase(partnerCase({ decisions: [open.decisionId] })));
    }

    it('R1: a RESERVE failure (P1 refused or never posted) cannot carry P6; the payment still fails without it', async () => {
      for (const [src, reason] of [
        ['LEDGER', 'INSUFFICIENT_FUNDS'],
        ['INTERNAL', 'METHOD_NOT_ENABLED'],
      ] as const) {
        const s = make();
        const r = okValue(await s.create(newPayment()));
        expect(await s.applySignal(PID, r.version, sig(src), to('RESERVE', { stage: 'REJECTED', reason }), [outbox(releaseKey(PID))])).toMatchObject({
          kind: 'REJECTED',
          code: 'ILLEGAL_TRANSITION',
          detail: 'P6 refused: no P1 reservation to release: the RESERVE leg ahead of RESERVE is not COMPLETED (§9.3 P1 = P6)',
        });
        expect(okValue(await s.get(PID))).toEqual(r);
        expect(okValue(await s.applySignal(PID, r.version, sig(src), to('RESERVE', { stage: 'REJECTED', reason }), [])).record.status).toBe('FAILED');
        expect(okValue(await s.pendingOutbox())).toEqual([]);
      }
      // A failure ahead of the reservation (nothing started) fails the payment with no P6 either.
      const s = make();
      const r = okValue(await s.create(newPayment()));
      expect(await s.applySignal(PID, r.version, sig('INTERNAL'), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK' }), [outbox(releaseKey(PID))])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /RESERVE leg ahead of ARC_TRANSFER is not COMPLETED/ });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
    });

    it('Q1: a PAYOUT_FAILED callback cannot carry P6 (the USDC is at the partner); P11 and P2R never go through applySignal', async () => {
      const s = make();
      let r = await toSubmitted(s, fiatBankPayment());
      r = okValue(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), [])).record;
      r = okValue(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), to('PAYOUT', st('SUBMITTED'), { externalRef: 'po-1' }), [])).record;
      const failed = to('PAYOUT', { stage: 'REJECTED', reason: 'PAYOUT_FAILED' });
      expect(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), failed, [outbox(releaseKey(PID))])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /F-17.*closeFailedPayout/ });
      for (const key of [partnerClaimKey(PID), partnerReturnKey(PID)]) {
        expect(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), failed, [outbox(key)])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /enqueued only by closeFailedPayout/ });
      }
      expect(okValue(await s.applySignal(PID, r.version, sig('PAYOUT_CALLBACK'), failed, [])).record).toMatchObject({ status: 'FAILED', reason: 'PAYOUT_FAILED' });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
    });

    it('R3-m4 (F-17 branch 2): P6 with P11 only on the recorded CLOSE_PARTNER_UNRETURNED decision added to the open case; exactly once; restart-safe', async () => {
      const s = make();
      const r = await payoutFailed(s);
      const close = await decide(s, 'CLOSE_PARTNER_UNRETURNED', PID, { caseId: CASE });
      const attempt = (ev: InboundSignal, items: readonly OutboxItem[] = claimAndRelease(), v: bigint = r.version) => s.closeFailedPayout(PID, v, ev, items);
      expect(await attempt(opSig(close))).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /no PARTNER_RETURN case/ });
      const c = await openCase(s);
      expect(c).toMatchObject({ caseId: CASE, state: 'OPEN', matchedLog: null });
      expect(await attempt(opSig(close))).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /is not on case .* \(addCaseDecision first\)/ });
      expect(okValue(await s.addCaseDecision(CASE, close.decisionId)).decisions).toEqual([...c.decisions, close.decisionId]);
      expect(await s.addCaseDecision(CASE, close.decisionId)).toMatchObject({ kind: 'OK', replayed: true, value: { decisions: [...c.decisions, close.decisionId] } });
      for (const items of [[outbox(releaseKey(PID))], [outbox(partnerClaimKey(PID))], [...claimAndRelease(), outbox(partnerReturnKey(PID))]]) {
        expect(await attempt(opSig(close), items)).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /P6 and exactly one of P11 or P2R/ });
      }
      expect(await attempt(opSig(close), claimAndRelease(), 99n)).toMatchObject({ kind: 'REJECTED', code: 'VERSION_CONFLICT' });
      expect(await attempt(opSig(close, hex('d0')))).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /not the recorded signal/ });
      expect(await attempt(sig('OPERATOR_DECISION', 'op:dec-none'))).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      const opener = okValue(await s.getDecision(c.decisions[0] as string));
      expect(await attempt(opSig(opener))).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /is OPEN_PARTNER_CASE for pay-0101.*not CLOSE_PARTNER_UNRETURNED/ });
      const forOther = await decide(s, 'CLOSE_PARTNER_UNRETURNED', PID2, { caseId: CASE });
      okValue(await s.addCaseDecision(CASE, forOther.decisionId));
      expect(await attempt(opSig(forOther))).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /for pay-0202/ });
      expect(await attempt({ ...opSig(close), source: 'INTERNAL' })).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /needs the recorded two-person CLOSE_PARTNER_UNRETURNED/ });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
      const out = okValue(await attempt(opSig(close)));
      expect(out).toMatchObject({ outcome: 'APPLIED', record: { stage: 'REJECTED', reason: 'PAYOUT_FAILED', status: 'FAILED', version: r.version + 1n } });
      expect(okValue(await s.pendingOutbox()).map((o) => o.key)).toEqual([partnerClaimKey(PID), releaseKey(PID)]);
      expect(await attempt(opSig(close))).toEqual({ kind: 'OK', value: { outcome: 'DUPLICATE', record: out.record }, replayed: true });
      expect(await attempt(opSig(close), [...claimAndRelease(), outbox('o:new')], out.record.version)).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /already released; .*o:new/ });
      expect(okValue(await s.getCase(CASE)).state).toBe('OPEN');
      const t = restart(s);
      expect(okValue(await t.get(PID))).toEqual(out.record);
      expect(okValue(await t.pendingOutbox())).toEqual(okValue(await s.pendingOutbox()));
      expect(okValue(await t.getCase(CASE))).toEqual(okValue(await s.getCase(CASE)));
      expect(okValue(await t.closeFailedPayout(PID, r.version, opSig(close), claimAndRelease()), true).outcome).toBe('DUPLICATE');
    });

    it('F-17 branch 1: P2R with P6 only on the Arc log the case claimed by its exact (from, to, value)', async () => {
      const s = make();
      const r = await payoutFailed(s);
      await openCase(s);
      const log = sig('ARC_LOG', `arc:5042002:${hex('9b')}:0`, hex('41'));
      expect(await s.closeFailedPayout(PID, r.version, log, returnAndRelease())).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT' });
      for (const near of [{ ...triple, value: nativeWei(999_999_999_999_999_999n) }, { ...triple, from: addr('9c') }, { ...triple, to: addr('ab') }]) {
        expect(await s.claimInbound(log, near)).toEqual({ kind: 'OK', value: { claimedBy: null }, replayed: false });
      }
      expect(okValue(await s.getCase(CASE)).state).toBe('OPEN');
      const claimed = okValue(await s.claimInbound(log, triple)).claimedBy;
      expect(claimed).toMatchObject({ caseId: CASE, state: 'MATCHED', matchedLog: log.dedupeKey });
      expect(await s.claimInbound(log, triple)).toEqual({ kind: 'OK', value: { claimedBy: claimed }, replayed: true });
      expect(await s.claimInbound({ ...log, payloadDigest: hex('42') }, triple)).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /different payload/ });
      // The partner returned: P11 is no longer the branch.
      const close = await decide(s, 'CLOSE_PARTNER_UNRETURNED', PID, { caseId: CASE });
      okValue(await s.addCaseDecision(CASE, close.decisionId));
      expect(await s.closeFailedPayout(PID, r.version, opSig(close), claimAndRelease())).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /is MATCHED; the partner's return is P2R/ });
      expect(await s.closeFailedPayout(PID, r.version, opSig(close), returnAndRelease())).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /needs the Arc log/ });
      const other = sig('ARC_LOG', 'arc:other', hex('43'));
      okValue(await s.commitRange('arc', 1n, [other]));
      expect(await s.closeFailedPayout(PID, r.version, other, returnAndRelease())).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /has not claimed arc:other/ });
      const out = okValue(await s.closeFailedPayout(PID, r.version, log, returnAndRelease()));
      expect(out.record).toMatchObject({ status: 'FAILED', version: r.version + 1n });
      expect(okValue(await s.pendingOutbox()).map((o) => o.key)).toEqual([partnerReturnKey(PID), releaseKey(PID)]);
      const t = restart(s);
      expect(okValue(await t.get(PID))).toEqual(out.record);
      expect(okValue(await t.getCase(CASE))).toEqual(okValue(await s.getCase(CASE)));
      expect(okValue(await t.getCase(CASE))).toMatchObject({ state: 'MATCHED', matchedLog: log.dedupeKey });
      expect(await t.claimInbound(log, triple)).toMatchObject({ kind: 'OK', replayed: true });
    });

    it('closeFailedPayout is only for a failed payout; cases and claims refuse what they cannot prove', async () => {
      const s = make();
      const r = await toSubmitted(s);
      expect(await s.closeFailedPayout(PID, r.version, sig('INTERNAL'), [outbox(releaseKey(PID))])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /only for a FIAT_BANK payment whose PAYOUT leg is REJECTED\/PAYOUT_FAILED/ });
      expect(await s.closeFailedPayout(PID2, 1n, sig('INTERNAL'), [])).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      const live = make();
      const l = await toSubmitted(live, fiatBankPayment());
      expect(await live.closeFailedPayout(PID, l.version, sig('INTERNAL'), returnAndRelease())).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /only for/ });
      // Cases.
      expect(await s.getCase(CASE)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      expect(await s.addCaseDecision(CASE, 'dec-x')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      expect(await s.putCase(partnerCase({ caseId: 'case-forged' }))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: /does not derive/ });
      expect(await s.putCase(partnerCase())).toMatchObject({ kind: 'REJECTED', code: 'DECISION_MISSING', detail: /opens on a two-person OPEN_PARTNER_CASE/ });
      expect(await s.putCase(partnerCase({ decisions: ['dec-none'] }))).toMatchObject({ kind: 'REJECTED', code: 'DECISION_MISSING', detail: /not recorded for it/ });
      const elsewhere = await decide(s, 'OPEN_PARTNER_CASE', PID, { caseId: 'case-other' });
      expect(await s.putCase(partnerCase({ decisions: [elsewhere.decisionId] }))).toMatchObject({ kind: 'REJECTED', code: 'DECISION_MISSING' });
      const notOpener = await decide(s, 'LIFT_QUARANTINE', PID, { caseId: CASE });
      expect(await s.putCase(partnerCase({ decisions: [notOpener.decisionId] }))).toMatchObject({ kind: 'REJECTED', code: 'DECISION_MISSING', detail: /OPEN_PARTNER_CASE/ });
      await expect(s.putCase(partnerCase({ state: 'MATCHED' }))).rejects.toThrow(/OPEN with no claimed log/);
      await expect(s.putCase(partnerCase({ matchedLog: 'arc:x' }))).rejects.toThrow(/OPEN with no claimed log/);
      await expect(s.putCase(partnerCase({ expected: null }))).rejects.toThrow(/exactly for a PARTNER_RETURN/);
      const burnId = deriveCaseId('NONCE_BURN', PID);
      await expect(s.putCase(partnerCase({ caseId: burnId, kind: 'NONCE_BURN' }))).rejects.toThrow(/exactly for a PARTNER_RETURN/);
      expect(await s.getCase(CASE)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      const burn = okValue(await s.putCase(partnerCase({ caseId: burnId, kind: 'NONCE_BURN', expected: null })));
      expect(await s.putCase(burn)).toEqual({ kind: 'OK', value: burn, replayed: true });
      const lift = await decide(s, 'LIFT_QUARANTINE', PID, { caseId: burnId, seq: 3n });
      expect(await s.putCase({ ...burn, decisions: [lift.decisionId] })).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: /already exists/ });
      expect(await s.addCaseDecision(burnId, 'dec-none')).toMatchObject({ kind: 'REJECTED', code: 'DECISION_MISSING' });
      expect(await s.addCaseDecision(burnId, elsewhere.decisionId)).toMatchObject({ kind: 'REJECTED', code: 'DECISION_MISSING' });
      expect(okValue(await s.addCaseDecision(burnId, lift.decisionId)).decisions).toEqual([lift.decisionId]);
      expect(okValue(await s.getCase(burnId)).decisions).toEqual([lift.decisionId]);
      // Claims: only an Arc log; a log already applied to a payment is never claimed; two equal open cases claim nothing (F-12).
      expect(await s.claimInbound(sig('DFNS_POLL', 'arc:x'), triple)).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /only an Arc log/ });
      expect(okValue(await s.claimInbound(sig('ARC_LOG', 'arc:none'), triple)).claimedBy).toBeNull();
      const done = sig('ARC_LOG', 'arc:done');
      okValue(await s.applySignal(PID, r.version, done, to('ARC_TRANSFER', st('COMPLETED'), { txHash: TX }), []));
      expect(await s.claimInbound(done, triple)).toMatchObject({ kind: 'REJECTED', code: 'SIGNAL_CONFLICT', detail: /already applied to pay-/ });
      await openCase(s);
      const case2 = deriveCaseId('PARTNER_RETURN', PID2);
      const open2 = await decide(s, 'OPEN_PARTNER_CASE', PID2, { caseId: case2 });
      okValue(await s.putCase(partnerCase({ caseId: case2, subject: PID2, decisions: [open2.decisionId] })));
      expect(okValue(await s.claimInbound(sig('ARC_LOG', 'arc:twin'), triple)).claimedBy).toBeNull();
      expect([okValue(await s.getCase(CASE)).state, okValue(await s.getCase(case2)).state]).toEqual(['OPEN', 'OPEN']);
    });

    it('AMBIGUOUS on the F-17 close and the case operations, before and after commit', async () => {
      const f = new FaultPlan();
      const s = make(f);
      const r = await payoutFailed(s);
      f.arm('getCase', 'BEFORE_COMMIT', 'UNAVAILABLE');
      expect(await s.getCase(CASE)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
      const open = await decide(s, 'OPEN_PARTNER_CASE', PID, { caseId: CASE });
      const c = partnerCase({ decisions: [open.decisionId] });
      f.arm('putCase', 'BEFORE_COMMIT', 'TIMEOUT');
      expect(await s.putCase(c)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(await s.getCase(CASE)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
      f.arm('putCase', 'AFTER_COMMIT', 'TIMEOUT');
      expect(await s.putCase(c)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.putCase(c), true)).toEqual(c);
      const close = await decide(s, 'CLOSE_PARTNER_UNRETURNED', PID, { caseId: CASE });
      f.arm('addCaseDecision', 'BEFORE_COMMIT', 'TRANSPORT');
      expect(await s.addCaseDecision(CASE, close.decisionId)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
      expect(okValue(await s.getCase(CASE)).decisions).toEqual([open.decisionId]);
      f.arm('addCaseDecision', 'AFTER_COMMIT', 'TRANSPORT');
      expect(await s.addCaseDecision(CASE, close.decisionId)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
      expect(okValue(await s.getCase(CASE)).decisions).toEqual([open.decisionId, close.decisionId]);
      f.arm('closeFailedPayout', 'BEFORE_COMMIT', 'TIMEOUT');
      expect(await s.closeFailedPayout(PID, r.version, opSig(close), claimAndRelease())).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.pendingOutbox())).toEqual([]);
      f.arm('closeFailedPayout', 'AFTER_COMMIT', 'TIMEOUT');
      expect(await s.closeFailedPayout(PID, r.version, opSig(close), claimAndRelease())).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      expect(okValue(await s.pendingOutbox())).toHaveLength(2);
      expect(okValue(await s.closeFailedPayout(PID, r.version, opSig(close), claimAndRelease()), true).outcome).toBe('DUPLICATE');
      const s2 = make(f);
      await payoutFailed(s2);
      await openCase(s2);
      const log = sig('ARC_LOG', 'arc:ret', hex('44'));
      f.arm('claimInbound', 'BEFORE_COMMIT', 'UNAVAILABLE');
      expect(await s2.claimInbound(log, triple)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
      expect(okValue(await s2.getCase(CASE)).state).toBe('OPEN');
      f.arm('claimInbound', 'AFTER_COMMIT', 'UNAVAILABLE');
      expect(await s2.claimInbound(log, triple)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
      expect(okValue(await s2.getCase(CASE)).state).toBe('MATCHED');
      expect(await s2.claimInbound(log, triple)).toMatchObject({ kind: 'OK', replayed: true });
    });
  });

  describe('test-strength gaps from mutation (m6)', () => {
    it('S496: a leg progresses only once every leg ahead of it is COMPLETED, not merely "not started"', async () => {
      const deposit = newPayment({ payIn: { method: 'STABLECOIN_DEPOSIT', asset: 'USDC', network: 'ARC' }, legs: ['AWAIT_DEPOSIT', 'RESERVE', 'ARC_TRANSFER'] });
      const s = make();
      const r = okValue(await s.create(deposit));
      expect(await s.applySignal(PID, r.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /RESERVE cannot progress while a leg ahead/ });
      const s2 = make();
      let q = okValue(await s2.create(fiatBankPayment()));
      q = okValue(await s2.applySignal(PID, q.version, sig('LEDGER'), to('RESERVE', st('COMPLETED')), [])).record;
      expect(await s2.applySignal(PID, q.version, sig('PAYOUT_CALLBACK'), to('PAYOUT', st('SUBMITTED')), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /PAYOUT cannot progress while a leg ahead/ });
    });

    it('S453: a hold for nonce 0 (a wallet\'s first transaction) is accepted', async () => {
      const s = make();
      let r = await pending(s);
      r = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED')), [])).record;
      const h: NewNonceHold = { wallet: walletRef('w-hot'), dfnsTransferId: 'tr-01', subject: PID, nonce: 0n, aborted: false };
      okValue(await s.applySignal(PID, r.version, sig('DFNS_WEBHOOK'), to('ARC_TRANSFER', st('APPROVED'), { placeHold: h }), []));
      expect(okValue(await s.listActiveHolds(walletRef('w-hot')))).toMatchObject([{ nonce: 0n, state: 'ACTIVE' }]);
    });

    it('S448: a hold on a non-Arc leg is refused even when everything else names the Arc transfer', async () => {
      const s = make();
      let r = await pending(s);
      r = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED')), [])).record;
      const h: NewNonceHold = { wallet: walletRef('w-hot'), dfnsTransferId: 'tr-01', subject: PID, nonce: 4n, aborted: false };
      expect(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('RESERVE', st('COMPLETED'), { externalRef: 'tr-01', placeHold: h }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /belongs to the Arc leg/ });
      expect(okValue(await s.listActiveHolds(walletRef('w-hot')))).toEqual([]);
    });

    it('S536: once DFNS identified the transfer, our own signal may repeat that same id', async () => {
      const s = make();
      const r = await toSubmitted(s);
      expect(okValue(await s.applySignal(PID, r.version, sig('INTERNAL'), to('ARC_TRANSFER', st('CONFIRMING'), { externalRef: 'tr-01', txHash: TX }), [])).record.legs[1]).toMatchObject({ stage: 'CONFIRMING', externalRef: 'tr-01' });
    });

    it('m2: a LINK_HASH decision names its lower-case hash, links only that hash, and no other kind carries one', async () => {
      const s = make();
      let r = await pending(s);
      r = okValue(await s.applySignal(PID, r.version, sig('DFNS_POLL'), to('ARC_TRANSFER', st('APPROVED')), [])).record;
      const bare: OperatorDecision = (({ txHash: _drop, ...rest }) => rest)(decision({ kind: 'LINK_HASH', subject: PID }));
      expect(await s.recordDecision(opSig(bare), bare)).toMatchObject({ kind: 'REJECTED', code: 'WRONG_KIND', detail: /names the lower-case hash/ });
      const upper = decision({ kind: 'LINK_HASH', subject: PID, txHash: `0x${'7A'.repeat(32)}` });
      expect(await s.recordDecision(opSig(upper), upper)).toMatchObject({ kind: 'REJECTED', code: 'WRONG_KIND' });
      const carried = decision({ kind: 'ABORT_ACCEPTED', subject: PID, txHash: TX });
      expect(await s.recordDecision(opSig(carried), carried)).toMatchObject({ kind: 'REJECTED', code: 'WRONG_KIND' });
      const link = await decide(s, 'LINK_HASH');
      expect(await s.applySignal(PID, r.version, opSig(link), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: hex('99') }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: `decision ${link.decisionId} links ${TX}, not ${hex('99')}` });
      expect(okValue(await s.applySignal(PID, r.version, opSig(link), to('ARC_TRANSFER', st('CONFIRMING'), { txHash: TX }), [])).record.legs[1]?.txHash).toBe(TX);
    });
  });

  describe('journey order with a deposit leg (m4, M22)', () => {
    it('the Arc leg cannot fail while the deposit leg ahead of it is in flight; it can while the deposit has not started', async () => {
      const deposit = (): NewPayment => newPayment({ payIn: { method: 'STABLECOIN_DEPOSIT', asset: 'USDC', network: 'ARC' }, legs: ['AWAIT_DEPOSIT', 'RESERVE', 'ARC_TRANSFER'] });
      const s = make();
      let r = okValue(await s.create(deposit()));
      r = okValue(await s.applySignal(PID, r.version, sig('ARC_LOG'), to('AWAIT_DEPOSIT', st('SUBMITTED')), [])).record;
      expect(await s.applySignal(PID, r.version, sig('INTERNAL'), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK' }), [])).toMatchObject({ kind: 'REJECTED', code: 'ILLEGAL_TRANSITION', detail: /cannot fail while a leg ahead/ });
      const s2 = make();
      const q = okValue(await s2.create(deposit()));
      expect(okValue(await s2.applySignal(PID, q.version, sig('INTERNAL'), to('ARC_TRANSFER', { stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK' }), [])).record.status).toBe('FAILED');
    });
  });

  describe('listOpen', () => {
    it('filters by leg and stage, in creation order, up to the limit', async () => {
      const s = make();
      okValue(await s.create(newPayment()));
      okValue(await s.create(newPayment({ paymentId: PID2, requestKey: idempotencyKey('req-two') })));
      okValue(await s.applySignal(PID, 1n, sig('LEDGER'), to('RESERVE', st('COMPLETED')), []));
      expect(okValue(await s.listOpen('RESERVE', 'CREATED', 10n)).map((r) => r.paymentId)).toEqual([PID2]);
      expect(okValue(await s.listOpen('RESERVE', 'COMPLETED', 10n)).map((r) => r.paymentId)).toEqual([PID]);
      expect(okValue(await s.listOpen('ARC_TRANSFER', 'CREATED', 10n)).map((r) => r.paymentId)).toEqual([PID, PID2]);
      expect(okValue(await s.listOpen('ARC_TRANSFER', 'CREATED', 1n)).map((r) => r.paymentId)).toEqual([PID]);
      expect(okValue(await s.listOpen('ARC_TRANSFER', 'CREATED', 0n))).toEqual([]);
      expect(okValue(await s.listOpen('PAYOUT', 'CREATED', 10n))).toEqual([]);
    });
  });
});

describe('releaseKey', () => {
  it('is the §10.2 P6 key', () => {
    expect(releaseKey(PID as PaymentId)).toBe(`pay:${PID}:p6`);
  });
});
