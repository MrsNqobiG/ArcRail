import { describe, expect, it } from 'vitest';
import { cbsMinor, usdcUnits } from '../../src/amounts/index.js';
import { ambiguous, ok, rejected } from '../../src/nova-ports/ids.js';
import type { PortResult } from '../../src/nova-ports/ids.js';
import { AuditLog } from '../../src/ops/audit.js';
import { DownAuditStore } from '../../src/ops/fakes.js';
import { OpsQueue } from '../../src/ops/queue.js';
import type { OpsActionRequest, OpsDeps } from '../../src/ops/queue.js';
import type { CaseRecord } from '../../src/ops/types.js';
import { deriveDecisionId } from '../../src/ops/types.js';
import { ALICE, BOB, CLIENT_ACC, EV, FACTS_NONE, FACTS_PROVEN, FACTS_PROVEN_P6, FACTS_SENT, FACTS_UNRESOLVED, LOSS, OPT, PAY, SETTLE, SUSPENSE, USDC, ZAR, exec, grantConsent, legs, makeRig, open, openInput, req } from './ops-support.js';
import type { Rig } from './ops-support.js';

const under = { unit: 'USDC_UNITS' as const, expected: usdcUnits(1000n), confirmed: usdcUnits(900n) };

/** A queue over changed deps; `execute` fills each approver's digest confirmation like `exec`. */
function qWith(rig: Rig, over: Partial<OpsDeps>) {
  const q = new OpsQueue({ ...rig.deps, ...over });
  return { execute: (r: OpsActionRequest) => exec(rig, r, q), getCase: (id: string) => q.getCase(id), openCase: q.openCase.bind(q) };
}

async function actions(rig: Rig): Promise<string[]> {
  return ((await rig.audit.entries()) ?? []).map((e) => `${e.type}:${e.code}`);
}

async function getCase(rig: Rig, id: string): Promise<CaseRecord> {
  const r = await rig.queue.getCase(id);
  if (r.kind !== 'OK') throw new Error('no case');
  return r.value;
}

describe.each(['A', 'B'] as const)('OPS actions (fakes %s)', (v) => {
  describe('REQUOTE', () => {
    it('consumes the bound consent, posts P14, closes the case and audits', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      grantConsent(rig, 'consent-1', c, 'o-requote');
      const r = await exec(rig, req(c.caseId, 'REQUOTE', 'o-requote', { consentRef: 'consent-1' }));
      expect(r).toMatchObject({ kind: 'OK', replayed: false, value: { action: 'REQUOTE', optionId: 'o-requote', newPaymentId: null, acceptedAmount: null } });
      expect(r.kind === 'OK' && r.value.journalRef).toMatch(/^jrnl-/);
      expect(r.kind === 'OK' && r.value.decisionId).toBe(deriveDecisionId(c.caseId, 'REQUOTE', 'o-requote'));
      expect(rig.ledgerStore.count).toBe(1);
      const closed = await getCase(rig, c.caseId);
      expect(closed).toMatchObject({ status: 'CLOSED', pending: null, version: 4n });
      expect(closed.outcome).toEqual(r.kind === 'OK' ? r.value : null);
      const log = (await rig.audit.entries()) ?? [];
      expect(log.map((e) => `${e.type}:${e.code}`)).toEqual(['CASE_OPENED:OK', 'ACTION_AUTHORIZED:OK', 'ACTION_APPLIED:OK']);
      expect(log[2]).toMatchObject({ caseId: c.caseId, action: 'REQUOTE', optionId: 'o-requote', actors: v === 'A' ? ['alice', 'bob'] : [ALICE, BOB], reason: 'operator reviewed', evidenceRefs: EV });
      expect(log[2]?.refs).toEqual(['consent:consent-1', `journal:${r.kind === 'OK' ? r.value.journalRef : ''}`]);
      expect(await rig.audit.verify()).toBeNull();
      const open1 = await rig.queue.listOpen();
      expect(open1.kind === 'OK' && open1.value).toEqual([]);
    });

    it('is refused without a consent, and nothing moves', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      for (const consentRef of [null, '', 'has space']) {
        expect(await exec(rig, req(c.caseId, 'REQUOTE', 'o-requote', { consentRef }))).toMatchObject({ kind: 'REJECTED', code: 'CONSENT_MISSING' });
      }
      expect(rig.ledgerStore.count).toBe(0);
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: null, version: 1n });
      expect(await actions(rig)).toEqual(['CASE_OPENED:OK', 'ACTION_REFUSED:CONSENT_MISSING', 'ACTION_REFUSED:CONSENT_MISSING', 'ACTION_REFUSED:CONSENT_MISSING']);
    });

    it('refuses an unknown, foreign, used or differently-bound consent, and releases the claim', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      const other = await open(rig, { subject: 'quote-2', options: [OPT.requote(1000n, 800n)] });
      const attempt = (ref: string) => exec(rig, req(c.caseId, 'REQUOTE', 'o-requote', { consentRef: ref }));
      expect(await attempt('missing')).toMatchObject({ kind: 'REJECTED', code: 'CONSENT_REFUSED', detail: 'consent refused: NOT_FOUND' });
      grantConsent(rig, 'foreign', c, 'o-requote', 'someone-else');
      expect(await attempt('foreign')).toMatchObject({ code: 'CONSENT_REFUSED', detail: 'consent refused: WRONG_CLIENT' });
      grantConsent(rig, 'for-other-case', other, 'o-requote');
      expect(await attempt('for-other-case')).toMatchObject({ code: 'CONSENT_REFUSED', detail: 'consent refused: BINDING_MISMATCH' });
      rig.consentStore.grant('wrong-digest', { clientUid: c.clientUid, paymentId: c.paymentId, caseId: c.caseId, digest: 'x' });
      expect(await attempt('wrong-digest')).toMatchObject({ code: 'CONSENT_REFUSED', detail: 'consent refused: BINDING_MISMATCH' });
      expect(rig.ledgerStore.count).toBe(0);
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: null });
      grantConsent(rig, 'good', c, 'o-requote');
      expect(await attempt('good')).toMatchObject({ kind: 'OK' });
      const closedOther = await exec(rig, req(other.caseId, 'REQUOTE', 'o-requote', { consentRef: 'good' }));
      expect(closedOther).toMatchObject({ kind: 'REJECTED', code: 'CONSENT_REFUSED', detail: 'consent refused: BINDING_MISMATCH' });
      expect(rig.ledgerStore.count).toBe(1);
    });

    it('refuses a consent used before (single use, replayed across two cases)', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      const twin = await open(rig, { subject: 'quote-2', kind: 'LATE_PAYIN', reason: 'PAYIN_AFTER_QUOTE_EXPIRY' });
      grantConsent(rig, 'k', c, 'o-requote');
      rig.consentStore.grant('k-twin', { clientUid: twin.clientUid, paymentId: twin.paymentId, caseId: twin.caseId, digest: twin.options[0]?.digest ?? '' });
      expect(await exec(rig, req(c.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k' }))).toMatchObject({ kind: 'OK' });
      expect(await exec(rig, req(twin.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k' }))).toMatchObject({ code: 'CONSENT_REFUSED' });
      // consuming the twin's own consent twice is refused too
      const t1 = await exec(rig, req(twin.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k-twin' }));
      expect(t1).toMatchObject({ kind: 'OK' });
      expect(await rig.consentStore.consume('k-twin', { clientUid: twin.clientUid, paymentId: twin.paymentId, caseId: twin.caseId, digest: twin.options[0]?.digest ?? '' })).toMatchObject({ code: 'ALREADY_USED' });
    });
  });

  describe('ACCEPT_WITH_CONSENT', () => {
    it('posts nothing, closes with the server-side confirmed amount', async () => {
      const rig = makeRig(v);
      const c = await open(rig, { kind: 'UNDERPAYMENT', reason: 'CONFIRMED_BELOW_EXPECTED', subject: 'payin-1', amounts: under, options: [OPT.accept(900n)] });
      expect(await exec(rig, req(c.caseId, 'ACCEPT_WITH_CONSENT', 'o-accept'))).toMatchObject({ code: 'CONSENT_MISSING' });
      grantConsent(rig, 'consent-a', c, 'o-accept');
      const r = await exec(rig, req(c.caseId, 'ACCEPT_WITH_CONSENT', 'o-accept', { consentRef: 'consent-a' }));
      expect(r).toMatchObject({ kind: 'OK', value: { action: 'ACCEPT_WITH_CONSENT', acceptedAmount: 900n, journalRef: null, newPaymentId: null } });
      expect(rig.ledgerStore.count).toBe(0);
      expect((await getCase(rig, c.caseId)).status).toBe('CLOSED');
    });
  });

  describe('REFUND', () => {
    it('P6 after a proof the Arc leg was never sent', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_PROVEN);
      const c = await open(rig);
      const r = await exec(rig, req(c.caseId, 'REFUND', 'o-refund'));
      expect(r).toMatchObject({ kind: 'OK', value: { action: 'REFUND', optionId: 'o-refund' } });
      expect(rig.ledgerStore.count).toBe(1);
    });

    it('P13 only for a pay-in with no Arc leg; P6 also fine with no Arc leg', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig, { kind: 'OVERPAYMENT', reason: 'CONFIRMED_ABOVE_EXPECTED', subject: 'p', amounts: { ...under, expected: usdcUnits(500n), confirmed: usdcUnits(600n) }, options: [OPT.refundP13(100n), OPT.refundP6(100n)] });
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund13'))).toMatchObject({ kind: 'OK' });
      const c2 = await open(rig, { subject: 'q2', options: [OPT.refundP6()] });
      expect(await exec(rig, req(c2.caseId, 'REFUND', 'o-refund'))).toMatchObject({ kind: 'OK' });
      rig.payments.set(PAY, FACTS_PROVEN);
      const c3 = await open(rig, { subject: 'q3', options: [OPT.refundP13()] });
      expect(await exec(rig, req(c3.caseId, 'REFUND', 'o-refund13'))).toMatchObject({ kind: 'REJECTED', code: 'LEG_NOT_PROVEN_UNSENT' });
    });

    it('never on an UNRESOLVED or SENT leg, or an unknown proof, or without facts', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      const run = () => exec(rig, req(c.caseId, 'REFUND', 'o-refund'));
      expect(await run()).toMatchObject({ code: 'FACTS_UNAVAILABLE' });
      rig.payments.set(PAY, FACTS_UNRESOLVED);
      expect(await run()).toMatchObject({ code: 'LEG_UNRESOLVED' });
      rig.payments.set(PAY, { ...FACTS_NONE, arcLeg: 'SENT' });
      expect(await run()).toMatchObject({ code: 'LEG_NOT_PROVEN_UNSENT' });
      rig.payments.set(PAY, { ...FACTS_PROVEN, proof: null });
      expect(await run()).toMatchObject({ code: 'LEG_NOT_PROVEN_UNSENT' });
      rig.payments.set(PAY, { ...FACTS_PROVEN, proof: 'EXTERNAL_ID_NOT_FOUND' as never });
      expect(await run()).toMatchObject({ code: 'LEG_NOT_PROVEN_UNSENT' });
      rig.payments.set(PAY, { ...FACTS_NONE, arcLeg: 'UNRESOLVED', proof: 'ABORT_ACCEPTED' });
      expect(await run()).toMatchObject({ code: 'LEG_UNRESOLVED' });
      expect(rig.ledgerStore.count).toBe(0);
      expect((await getCase(rig, c.caseId)).status).toBe('OPEN');
    });

    it('accepts each D-6 proof kind', async () => {
      for (const proof of ['APPROVER_DENIAL', 'ABORT_ACCEPTED', 'NONCE_CONSUMED_ELSEWHERE', 'NONCE_RESOLVED', 'RECEIPT_STATUS_0_BOTH_SOURCES'] as const) {
        const rig = makeRig(v);
        rig.payments.set(PAY, { ...FACTS_PROVEN, proof });
        const c = await open(rig);
        expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund')), proof).toMatchObject({ kind: 'OK' });
      }
    });
  });

  describe('RETRY_AS_NEW_PAYMENT', () => {
    const stuck = { kind: 'UNRESOLVED_SUBMIT' as const, reason: 'DFNS_TIMEOUT', subject: 'submit-1', options: [OPT.retry(), OPT.writeOff()] };
    it('creates exactly one retry payment, keyed retry:<original>, after proof and P6', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_PROVEN_P6);
      const c = await open(rig, stuck);
      const r = await exec(rig, req(c.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-retry'));
      expect(r).toMatchObject({ kind: 'OK', value: { action: 'RETRY_AS_NEW_PAYMENT', journalRef: null } });
      const id = r.kind === 'OK' ? r.value.newPaymentId : null;
      expect(id).toMatch(/^pay-/);
      expect(rig.ledgerStore.count).toBe(0);
      const retry = await rig.deps.payments.createRetry(`retry:${PAY}` as never, PAY);
      expect(retry).toMatchObject({ kind: 'OK', replayed: true, value: { newPaymentId: id } });
      // a second case for the same original returns the same retry payment
      const c2 = await open(rig, { ...stuck, subject: 'submit-2', reason: 'DFNS_5XX' });
      const r2 = await exec(rig, req(c2.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-retry'));
      expect(r2.kind === 'OK' && r2.value.newPaymentId).toBe(id);
      const log = (await rig.audit.entries()) ?? [];
      expect(log.at(-1)?.refs).toEqual([`retry:${id}`]);
    });

    it('is refused without proof of not-sent (unresolved, externalId not found, sent) and before terminal+P6', async () => {
      const rig = makeRig(v);
      const c = await open(rig, stuck);
      const run = () => exec(rig, req(c.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-retry'));
      rig.payments.set(PAY, FACTS_UNRESOLVED);
      expect(await run()).toMatchObject({ code: 'RETRY_NOT_ALLOWED' });
      rig.payments.set(PAY, { ...FACTS_UNRESOLVED, terminal: true, p6Posted: true });
      expect(await run()).toMatchObject({ code: 'LEG_UNRESOLVED' });
      rig.payments.set(PAY, { ...FACTS_PROVEN_P6, proof: 'EXTERNAL_ID_NOT_FOUND' as never });
      expect(await run()).toMatchObject({ code: 'LEG_NOT_PROVEN_UNSENT' });
      rig.payments.set(PAY, { ...FACTS_PROVEN_P6, proof: null });
      expect(await run()).toMatchObject({ code: 'LEG_NOT_PROVEN_UNSENT' });
      rig.payments.set(PAY, { ...FACTS_SENT, p6Posted: true });
      expect(await run()).toMatchObject({ code: 'LEG_NOT_PROVEN_UNSENT' });
      rig.payments.set(PAY, { ...FACTS_PROVEN_P6, terminal: true, p6Posted: false });
      expect(await run()).toMatchObject({ code: 'RETRY_NOT_ALLOWED' });
      rig.payments.set(PAY, { ...FACTS_PROVEN_P6, terminal: false, p6Posted: true });
      expect(await run()).toMatchObject({ code: 'RETRY_NOT_ALLOWED' });
      expect((await getCase(rig, c.caseId)).status).toBe('OPEN');
    });

    it('releases the claim when the retry port refuses', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_PROVEN_P6);
      const c = await open(rig, stuck);
      const bad = { facts: rig.payments.facts.bind(rig.payments), createRetry: async () => rejected('KEY_CONFLICT', 'x') } as never;
      const q = qWith(rig, { payments: bad });
      expect(await q.execute(req(c.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-retry'))).toMatchObject({ code: 'RETRY_REJECTED', detail: 'the retry was refused: KEY_CONFLICT' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: null });
      const amb = { facts: rig.payments.facts.bind(rig.payments), createRetry: async () => ambiguous('TIMEOUT') } as never;
      expect(await qWith(rig, { payments: amb }).execute(req(c.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-retry'))).toMatchObject({ kind: 'AMBIGUOUS' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: { consentConsumed: false } });
      expect(await exec(rig, req(c.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-retry'))).toMatchObject({ kind: 'OK' });
    });
  });

  describe('WRITE_OFF', () => {
    it('posts P15 to the configured loss account, with two humans', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const seen: unknown[] = [];
      const ledger = { post: async (k: never, j: never) => { seen.push([k, j]); return rig.ledgerStore.post(k, j); } };
      const q = qWith(rig, { ledger });
      const c = await open(rig);
      const r = await q.execute(req(c.caseId, 'WRITE_OFF', 'o-writeoff'));
      expect(r).toMatchObject({ kind: 'OK', value: { action: 'WRITE_OFF' } });
      const [key, journal] = seen[0] as [string, { template: string; legs: unknown[] }];
      expect(key).toBe(`ops:${deriveDecisionId(c.caseId, 'WRITE_OFF', 'o-writeoff')}`);
      expect(journal.template).toBe('P15_WRITE_OFF');
      expect(journal.legs).toEqual([
        { account: LOSS, side: 'DEBIT', asset: ZAR, unit: 'CBS_MINOR', amount: cbsMinor(70n) },
        { account: SUSPENSE, side: 'CREDIT', asset: ZAR, unit: 'CBS_MINOR', amount: cbsMinor(70n) },
      ]);
    });

    it('is refused with no loss account configured (never defaulted), and on an unresolved Arc leg', async () => {
      const rig = makeRig(v, { config: { lossAccount: null } });
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'LOSS_ACCOUNT_UNSET' });
      expect(rig.ledgerStore.count).toBe(0);
      const rig2 = makeRig(v);
      rig2.payments.set(PAY, FACTS_UNRESOLVED);
      const c2 = await open(rig2);
      expect(await exec(rig2, req(c2.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'LEG_UNRESOLVED' });
      rig2.payments.set(PAY, { ...FACTS_NONE, arcLeg: 'SENT' });
      expect(await exec(rig2, req(c2.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ kind: 'OK' });
      const rig3 = makeRig(v);
      const c3 = await open(rig3);
      expect(await exec(rig3, req(c3.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'FACTS_UNAVAILABLE' });
    });
  });

  describe('RELEASE_QUARANTINE and UNPAUSE', () => {
    it('release a quarantine through the control port, with two humans', async () => {
      const rig = makeRig(v);
      const c = await open(rig, { kind: 'QUARANTINE', reason: 'SIGNAL_CONFLICT', subject: 'item-1', options: [OPT.release()] });
      expect(await exec(rig, req(c.caseId, 'RELEASE_QUARANTINE', 'o-release', { approvers: [ALICE, ALICE] }))).toMatchObject({ code: 'SAME_APPROVER' });
      const r = await exec(rig, req(c.caseId, 'RELEASE_QUARANTINE', 'o-release'));
      expect(r).toMatchObject({ kind: 'OK', value: { action: 'RELEASE_QUARANTINE', journalRef: null, newPaymentId: null } });
      const seen = v === 'A' ? [...(rig.control as { applied: Set<string> }).applied] : (rig.control as unknown as { log: { kind: string; subject: string; decisionId: string; approvers: string[] }[] }).log;
      expect(seen).toHaveLength(1);
      if (v === 'B') expect(seen[0]).toMatchObject({ kind: 'RELEASE_QUARANTINE', subject: 'item-1', approvers: [ALICE, BOB] });
    });

    it('unpause a rail PAUSE; refuses when Nova does not know the subject', async () => {
      const rig = makeRig(v);
      const c = await open(rig, { kind: 'PAUSE', reason: 'INDEXER_STALL', subject: 'rail', options: [OPT.unpause()] });
      expect(await exec(rig, req(c.caseId, 'UNPAUSE', 'o-unpause'))).toMatchObject({ kind: 'OK', value: { action: 'UNPAUSE' } });
      const c2 = await open(rig, { kind: 'PAUSE', reason: 'RECON_DRIFT', subject: 'ghost', options: [OPT.unpause()] });
      expect(await exec(rig, req(c2.caseId, 'UNPAUSE', 'o-unpause'))).toMatchObject({ code: 'CONTROL_REJECTED', detail: 'the control action was refused: NOT_FOUND' });
      expect(await getCase(rig, c2.caseId)).toMatchObject({ status: 'OPEN', pending: null });
      const amb = { apply: async () => ambiguous('TIMEOUT') } as never;
      expect(await qWith(rig, { control: amb }).execute(req(c2.caseId, 'UNPAUSE', 'o-unpause'))).toMatchObject({ kind: 'AMBIGUOUS' });
    });
  });

  describe('two humans, authenticated', () => {
    const money: [string, () => Promise<{ rig: Rig; c: CaseRecord }>][] = [
      ['REQUOTE', async () => { const rig = makeRig(v); const c = await open(rig); grantConsent(rig, 'k', c, 'o-requote'); return { rig, c }; }],
      ['REFUND', async () => { const rig = makeRig(v); rig.payments.set(PAY, FACTS_NONE); return { rig, c: await open(rig) }; }],
      ['WRITE_OFF', async () => { const rig = makeRig(v); rig.payments.set(PAY, FACTS_NONE); return { rig, c: await open(rig) }; }],
    ];
    const optionOf = { REQUOTE: 'o-requote', REFUND: 'o-refund', WRITE_OFF: 'o-writeoff' } as const;
    it.each(money)('%s: the same human twice is refused, in any spelling, and nothing moves', async (action, setup) => {
      const { rig, c } = await setup();
      const act = action as 'REQUOTE' | 'REFUND' | 'WRITE_OFF';
      const spellings: [string, string][] = v === 'A' ? [[ALICE, ALICE], [ALICE, 'Alice@x']] : [[ALICE, ALICE], [ALICE, 'staff:Alice']];
      for (const approvers of spellings) {
        expect(await exec(rig, req(c.caseId, act, optionOf[act], { approvers, consentRef: 'k' }))).toMatchObject({ kind: 'REJECTED', code: 'SAME_APPROVER' });
      }
      expect(rig.ledgerStore.count).toBe(0);
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: null, version: 1n });
    });

    it.each(money)('%s: an unauthenticated approver or a service account is refused', async (action, setup) => {
      const { rig, c } = await setup();
      const act = action as 'REQUOTE' | 'REFUND' | 'WRITE_OFF';
      for (const approvers of [[ALICE, 'svc:bot'], ['svc:bot', BOB], ['nobody', 'ghost']] as [string, string][]) {
        expect(await exec(rig, req(c.caseId, act, optionOf[act], { approvers, consentRef: 'k' }))).toMatchObject({ code: 'APPROVER_UNAUTHENTICATED' });
      }
      for (const approvers of [[ALICE] as never, [ALICE, BOB, 'staff:carol'] as never, undefined as never, [ALICE, 5] as never, [5, ALICE] as never]) {
        expect(await exec(rig, req(c.caseId, act, optionOf[act], { approvers, consentRef: 'k' }))).toMatchObject({ code: 'APPROVER_UNAUTHENTICATED' });
      }
      expect(rig.ledgerStore.count).toBe(0);
    });

    it('two different humans pass, in either order', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff', { approvers: [BOB, ALICE] }))).toMatchObject({ kind: 'OK' });
    });
  });

  describe('amounts never come from input', () => {
    it('an operator-supplied amount, account or legs are ignored: the server-side option is posted', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_PROVEN);
      const c = await open(rig);
      const seen: { legs: { amount: bigint; account: string }[] }[] = [];
      const ledger = { post: async (k: never, j: never) => { seen.push(j); return rig.ledgerStore.post(k, j); } };
      const hostile = { ...req(c.caseId, 'REFUND', 'o-refund'), amount: 9_999_999n, destination: 'attacker', legs: legs(9_999_999n, CLIENT_ACC, 'attacker' as never), journal: { debits: 1n } } as unknown as OpsActionRequest;
      const r = await qWith(rig, { ledger }).execute(hostile);
      expect(r).toMatchObject({ kind: 'OK' });
      expect(seen[0]?.legs.map((l) => [l.amount, l.account])).toEqual([[500n, CLIENT_ACC], [500n, SETTLE]]);
      expect(JSON.stringify(r, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))).not.toContain('9999999');
    });

    it('an option that is not on the case cannot be selected, and the action must match the option', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-invented'))).toMatchObject({ code: 'OPTION_NOT_FOUND' });
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-writeoff'))).toMatchObject({ code: 'OPTION_NOT_FOUND' });
      expect(await exec(rig, req(c.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-refund'))).toMatchObject({ code: 'ACTION_NOT_ALLOWED' });
      expect(await exec(rig, req(c.caseId, 'NOPE' as never, 'o-refund'))).toMatchObject({ code: 'ACTION_NOT_ALLOWED' });
    });
  });

  describe('a case cannot close while unbalanced', () => {
    const skewed = (rig: Rig, skew: { debits?: bigint; credits?: bigint }, calls: { n: number }) => ({
      post: async (k: never, j: never): Promise<PortResult<never, never>> => {
        calls.n += 1;
        const r = (await rig.ledgerStore.post(k, j)) as { value: { journalRef: string; debits: bigint; credits: bigint } };
        return ok({ ...r.value, ...skew }, false) as never;
      },
    });
    it.each([
      ['credits short', { credits: 499n }],
      ['debits long', { debits: 501n, credits: 501n }],
      ['debits short', { debits: 499n, credits: 499n }],
      ['debits short only', { debits: 499n }],
    ])('keeps the case open when the ledger read-back is off: %s', async (_n, skew) => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_PROVEN);
      const c = await open(rig);
      const calls = { n: 0 };
      const q = qWith(rig, { ledger: skewed(rig, skew, calls) });
      expect(await q.execute(req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ kind: 'REJECTED', code: 'UNBALANCED' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', outcome: null, pending: { decisionId: deriveDecisionId(c.caseId, 'REFUND', 'o-refund') } });
      expect(await actions(rig)).toContain('ACTION_PENDING:UNBALANCED');
      const paged = await rig.queue.listOpen();
      expect(paged.kind === 'OK' && paged.value.filter((x) => x.kind === 'QUARANTINE').map((x) => [x.reason, x.subject])).toEqual([['INVARIANT_FAILED', `unbalanced:${deriveDecisionId(c.caseId, 'REFUND', 'o-refund')}`]]);
      // a different decision cannot be started while this one is unresolved
      expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'CASE_PENDING_OTHER_DECISION' });
      // once the ledger reads back balanced, the same decision completes (idempotent key)
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ kind: 'OK' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'CLOSED', pending: null });
      expect(rig.ledgerStore.count).toBe(1);
    });

    it('an unbalanced journal cannot even be offered as an option', async () => {
      const rig = makeRig(v);
      const bad = { ...OPT.refundP6(), legs: legs(500n).map((l, i) => (i === 0 ? { ...l, amount: usdcUnits(501n) } : l)) };
      expect(await rig.queue.openCase(openInput({ options: [bad] }))).toMatchObject({ code: 'OPTION_INVALID', detail: 'P6 legs are unbalanced' });
    });

    it('releases the claim when the ledger rejects; keeps it when the ledger is ambiguous', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_PROVEN);
      const c = await open(rig);
      const rej = { post: async () => rejected('KEY_CONFLICT', 'x') } as never;
      expect(await qWith(rig, { ledger: rej }).execute(req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ code: 'LEDGER_REJECTED', detail: 'the ledger refused the journal: KEY_CONFLICT' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: null });
      const amb = { post: async () => ambiguous('TIMEOUT') } as never;
      expect(await qWith(rig, { ledger: amb }).execute(req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ kind: 'AMBIGUOUS' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: { consentConsumed: false } });
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ kind: 'OK' });
    });

    it('does not take a consent twice when the ledger step is retried', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      grantConsent(rig, 'k', c, 'o-requote');
      const amb = { post: async () => ambiguous('TIMEOUT') } as never;
      expect(await qWith(rig, { ledger: amb }).execute(req(c.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k' }))).toMatchObject({ kind: 'AMBIGUOUS' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ pending: { consentConsumed: true } });
      // the retry needs no consentRef: it is already consumed for this decision
      expect(await exec(rig, req(c.caseId, 'REQUOTE', 'o-requote'))).toMatchObject({ kind: 'OK' });
      const consumes = { n: 0 };
      const counting = { consume: async () => { consumes.n += 1; return ok(undefined, false); } } as never;
      const c2 = await open(rig, { subject: 'quote-2' });
      expect(await qWith(rig, { consent: counting }).execute(req(c2.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k2' }))).toMatchObject({ kind: 'OK' });
      expect(consumes.n).toBe(1);
    });
  });

  describe('gate, closed cases, replay and fail-closed paths', () => {
    it('refuses every action while the decision path is not enabled (CF-31 open)', async () => {
      const rig = makeRig(v, { config: { decisionPathEnabled: false } });
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'NOT_ENABLED' });
      expect(rig.ledgerStore.count).toBe(0);
      expect(await actions(rig)).toEqual(['CASE_OPENED:OK', 'ACTION_REFUSED:NOT_ENABLED']);
    });

    it('refuses an unknown case; an ambiguous store is passed through', async () => {
      const rig = makeRig(v);
      expect(await exec(rig, req('case-nope', 'WRITE_OFF', 'o'))).toMatchObject({ code: 'CASE_NOT_FOUND' });
      const amb = { get: async () => ambiguous('TIMEOUT') } as never;
      expect(await qWith(rig, { cases: amb }).execute(req('x', 'WRITE_OFF', 'o'))).toMatchObject({ kind: 'AMBIGUOUS' });
    });

    it('replays the same closed decision without side effects; refuses any other action on a closed case', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      const first = await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff'));
      const again = await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff', { approvers: [BOB, ALICE] }));
      expect(again).toMatchObject({ kind: 'OK', replayed: true });
      expect(again.kind === 'OK' && again.value).toEqual(first.kind === 'OK' && first.value);
      expect(rig.ledgerStore.count).toBe(1);
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ code: 'CASE_CLOSED' });
      expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-other'))).toMatchObject({ code: 'CASE_CLOSED' });
      expect((await actions(rig)).slice(-3)).toEqual(['ACTION_REPLAYED:OK', 'ACTION_REFUSED:CASE_CLOSED', 'ACTION_REFUSED:CASE_CLOSED']);
    });

    it('requires a reason and evidence on every action', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      for (const reason of ['', '   ', 'x'.repeat(501), 5 as never]) {
        expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff', { reason }))).toMatchObject({ code: 'REASON_INVALID' });
      }
      for (const evidenceRefs of [[], 'x' as never, ['a b'], [5 as never]]) {
        expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff', { evidenceRefs }))).toMatchObject({ code: 'EVIDENCE_MISSING' });
      }
      expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff', { reason: 'x'.repeat(500) }))).toMatchObject({ kind: 'OK' });
    });

    it('does nothing when the audit cannot be written', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      const q = qWith(rig, { audit: new AuditLog(new DownAuditStore(), () => 't') });
      expect(await q.execute(req(c.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'AUDIT_FAILED' });
      expect(await q.execute(req(c.caseId, 'WRITE_OFF', 'o-nope'))).toMatchObject({ code: 'OPTION_NOT_FOUND' });
      expect(rig.ledgerStore.count).toBe(0);
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: null, version: 1n });
      expect(await q.openCase(openInput({ subject: 'x' }))).toMatchObject({ code: 'AUDIT_FAILED' });
    });

    it('survives concurrent racing on the case: only one writer claims it', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      const results = await Promise.all([exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff')), exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff'))]);
      expect(rig.ledgerStore.count).toBe(1);
      expect(results.filter((r) => r.kind === 'OK' && !r.replayed)).toHaveLength(1);
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'CLOSED' });
    });

    it('reports a lost claim, a lost consent mark and a lost close', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      grantConsent(rig, 'k', c, 'o-requote');
      const failing = (okTimes: number) => {
        let n = 0;
        return {
          get: rig.cases.get.bind(rig.cases),
          listOpen: rig.cases.listOpen.bind(rig.cases),
          listByPayment: rig.cases.listByPayment.bind(rig.cases),
          put: async (rec: CaseRecord, ev: bigint | null) => {
            n += 1;
            return n > okTimes ? (rejected('VERSION_CONFLICT', 'x') as never) : rig.cases.put(rec, ev);
          },
        } as never;
      };
      const q0 = qWith(rig, { cases: failing(0) });
      expect(await q0.execute(req(c.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'CASE_CONFLICT', detail: 'the case changed; reload and retry' });
      expect(rig.ledgerStore.count).toBe(0);
      // consent consumed, then the mark fails: a new consent is needed
      const q1 = qWith(rig, { cases: failing(1) });
      expect(await q1.execute(req(c.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k' }))).toMatchObject({ code: 'CASE_CONFLICT', detail: 'consent consumed but the case changed; a new consent is needed' });
      expect(rig.ledgerStore.count).toBe(0);
      // close fails after the ledger posted: ambiguous, and the retry replays the same journal
      const c2 = await open(rig, { subject: 'q2' });
      const q2 = qWith(rig, { cases: failing(1) });
      expect(await q2.execute(req(c2.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ kind: 'AMBIGUOUS' });
      expect(rig.ledgerStore.count).toBe(1);
      expect(await exec(rig, req(c2.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ kind: 'OK' });
      expect(rig.ledgerStore.count).toBe(1);
    });

    it('an ambiguous consent port leaves the claim pending', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      const amb = { consume: async () => ambiguous('TIMEOUT') } as never;
      expect(await qWith(rig, { consent: amb }).execute(req(c.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k' }))).toMatchObject({ kind: 'AMBIGUOUS' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ pending: { consentConsumed: false } });
    });

    it('lists open cases', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const a = await open(rig);
      const b = await open(rig, { subject: 'other' });
      await exec(rig, req(a.caseId, 'WRITE_OFF', 'o-writeoff'));
      const l = await rig.queue.listOpen();
      expect(l.kind === 'OK' && l.value.map((x) => x.caseId)).toEqual([b.caseId]);
      expect(USDC).toBe('USDC');
    });
  });
});
