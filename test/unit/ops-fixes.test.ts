import { describe, expect, it } from 'vitest';
import { cbsMinor, usdcUnits } from '../../src/amounts/index.js';
import { ambiguous, ok, rejected } from '../../src/nova-ports/ids.js';
import type { PortResult } from '../../src/nova-ports/ids.js';
import { AuditLog, GENESIS_HASH, entryHash, verifyChain } from '../../src/ops/audit.js';
import type { AuditEntry } from '../../src/ops/audit.js';
import { ArrayAuditStore } from '../../src/ops/fakes.js';
import { OpsQueue } from '../../src/ops/queue.js';
import type { OpsDeps } from '../../src/ops/queue.js';
import type { AuditStorePort } from '../../src/ops/ports.js';
import { D1_NAME_OF, legKeys, optionDigest, optionProblem, termsProblem } from '../../src/ops/types.js';
import type { CaseOption, CaseRecord, QuoteTerms } from '../../src/ops/types.js';
import {
  ALICE,
  BOB,
  CLIENT_ACC,
  FACTS_NONE,
  FACTS_NONE_P6,
  FACTS_PROVEN,
  FACTS_SENT,
  LOSS,
  OPT,
  PAY,
  SETTLE,
  SETTLEMENT,
  SUSPENSE,
  USDC,
  exec,
  grantConsent,
  legs,
  makeRig,
  open,
  openInput,
  req,
} from './ops-support.js';
import type { Rig } from './ops-support.js';

const under = { unit: 'USDC_UNITS' as const, expected: usdcUnits(1000n), confirmed: usdcUnits(900n) };
const BOOKED = 'booked-1';

function qWith(rig: Rig, over: Partial<OpsDeps>) {
  const q = new OpsQueue({ ...rig.deps, ...over });
  return { execute: (r: Parameters<typeof exec>[1]) => exec(rig, r, q), openCase: q.openCase.bind(q), getCase: q.getCase.bind(q) };
}

async function getCase(rig: Rig, id: string): Promise<CaseRecord> {
  const r = await rig.queue.getCase(id);
  if (r.kind !== 'OK') throw new Error('no case');
  return r.value;
}

async function codes(rig: Rig): Promise<string[]> {
  return ((await rig.audit.entries()) ?? []).map((e) => `${e.type}:${e.code}`);
}

const fillCase = (over: Record<string, unknown> = {}) =>
  openInput({ kind: 'UNMATCHED_FILL', reason: 'FILL_AFTER_EXPIRY', subject: 'fill-1', bookedEntryRef: BOOKED, options: [OPT.adopt(), OPT.reverse()], ...over } as never);

describe.each(['A', 'B'] as const)('OPS fix block (fakes %s)', (v) => {
  describe('D-B1: refund and write-off bounds, P6 posted once, atomic guard', () => {
    it('refuses a P6 refund when the proof already posted P6', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, { ...FACTS_PROVEN, p6Posted: true });
      const c = await open(rig);
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ kind: 'REJECTED', code: 'REFUND_ALREADY_POSTED', detail: 'P6 is already posted for this payment' });
      expect(rig.ledgerStore.count).toBe(0);
      // a P13 pay-in refund is a different template and is not blocked by P6
      rig.payments.set(PAY, FACTS_NONE_P6);
      const c2 = await open(rig, { subject: 'q2', options: [OPT.refundP13()] });
      expect(await exec(rig, req(c2.caseId, 'REFUND', 'o-refund13'))).toMatchObject({ kind: 'OK' });
    });

    it('a payment is never refunded more than its cap, across any number of cases', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const ids: string[] = [];
      for (const [i, kind] of (['QUARANTINE', 'REQUOTE', 'REQUOTE'] as const).entries()) {
        const c = await open(rig, { kind, reason: kind === 'QUARANTINE' ? 'SIGNAL_CONFLICT' : 'RATE_EXPIRED', subject: `s${i}`, options: [OPT.refundP13(500n)] });
        ids.push(c.caseId);
      }
      expect(await exec(rig, req(ids[0] as string, 'REFUND', 'o-refund13'))).toMatchObject({ kind: 'OK' });
      expect(await exec(rig, req(ids[1] as string, 'REFUND', 'o-refund13'))).toMatchObject({ kind: 'OK' });
      const third = await exec(rig, req(ids[2] as string, 'REFUND', 'o-refund13'));
      expect(third).toMatchObject({ kind: 'REJECTED', code: 'LEDGER_REJECTED', detail: 'the ledger refused the journal: LIMIT_EXCEEDED' });
      expect(rig.ledgerStore.count).toBe(2);
      expect(await getCase(rig, ids[2] as string)).toMatchObject({ status: 'OPEN', pending: null });
    });

    it('refuses when the limit is unknown, in another unit, or below the amount', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      const refund = () => exec(rig, req(c.caseId, 'REFUND', 'o-refund'));
      rig.payments.set(PAY, { ...FACTS_NONE, refundCap: null });
      expect(await refund()).toMatchObject({ code: 'LIMIT_UNKNOWN', detail: 'the per-payment limit is unknown; refused' });
      rig.payments.set(PAY, { ...FACTS_NONE, refundCap: { unit: 'CBS_MINOR', amount: 9999n } });
      expect(await refund()).toMatchObject({ code: 'LIMIT_EXCEEDED', detail: 'the amount exceeds what this payment may move' });
      rig.payments.set(PAY, { ...FACTS_NONE, refundCap: { unit: 'USDC_UNITS', amount: 499n } });
      expect(await refund()).toMatchObject({ code: 'LIMIT_EXCEEDED' });
      rig.payments.set(PAY, { ...FACTS_NONE, refundCap: { unit: 'USDC_UNITS', amount: 500n } });
      expect(await refund()).toMatchObject({ kind: 'OK' });
      const w = (cap: PaymentCap) => {
        rig.payments.set(PAY, { ...FACTS_NONE, writeOffCap: cap });
        return exec(rig, req(c2.caseId, 'WRITE_OFF', 'o-writeoff'));
      };
      const c2 = await open(rig, { subject: 'q-w' });
      expect(await w(null)).toMatchObject({ code: 'LIMIT_UNKNOWN' });
      expect(await w({ unit: 'USDC_UNITS', amount: 1000n })).toMatchObject({ code: 'LIMIT_EXCEEDED' });
      expect(await w({ unit: 'CBS_MINOR', amount: 69n })).toMatchObject({ code: 'LIMIT_EXCEEDED' });
      expect(await w({ unit: 'CBS_MINOR', amount: 70n })).toMatchObject({ kind: 'OK' });
    });

    it('the ledger enforces the leg guard in the posting commit (facts that went stale)', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig, { options: [OPT.refundP13()] });
      const stale = { post: async (k: never, j: never) => (rig.payments.set(PAY, FACTS_SENT), rig.ledgerStore.post(k, j)) };
      const r = await qWith(rig, { ledger: stale }).execute(req(c.caseId, 'REFUND', 'o-refund13'));
      expect(r).toMatchObject({ kind: 'REJECTED', code: 'LEDGER_REJECTED', detail: 'the ledger refused the journal: LEG_GUARD' });
      expect(rig.ledgerStore.count).toBe(0);
      // the same for a write-off racing an unresolved submit, and a P6 racing P6 being posted
      rig.payments.set(PAY, FACTS_NONE);
      const c2 = await open(rig, { subject: 'q2' });
      const unresolved = { post: async (k: never, j: never) => (rig.payments.set(PAY, { ...FACTS_NONE, arcLeg: 'UNRESOLVED' }), rig.ledgerStore.post(k, j)) };
      expect(await qWith(rig, { ledger: unresolved }).execute(req(c2.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'LEDGER_REJECTED' });
      rig.payments.set(PAY, FACTS_NONE);
      const posted = { post: async (k: never, j: never) => (rig.payments.set(PAY, FACTS_NONE_P6), rig.ledgerStore.post(k, j)) };
      expect(await qWith(rig, { ledger: posted }).execute(req(c2.caseId, 'REFUND', 'o-refund'))).toMatchObject({ code: 'LEDGER_REJECTED' });
      expect(rig.ledgerStore.count).toBe(0);
    });

    it('a returned payout is refunded only once the partner return was claimed (D1 F-17)', async () => {
      const rig = makeRig(v);
      const c = await open(rig, { kind: 'RETURNED_PAYOUT', reason: 'PARTNER_RETURNED', subject: 'ret-1', options: [OPT.refundP6(), OPT.retry()] });
      const refund = () => exec(rig, req(c.caseId, 'REFUND', 'o-refund'));
      rig.payments.set(PAY, FACTS_SENT);
      expect(await refund()).toMatchObject({ code: 'LEG_NOT_PROVEN_UNSENT' });
      const stale = { post: async (k: never, j: never) => (rig.payments.set(PAY, FACTS_SENT), rig.ledgerStore.post(k, j)) };
      rig.payments.set(PAY, { ...FACTS_SENT, returnClaimed: true });
      expect(await qWith(rig, { ledger: stale }).execute(req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ code: 'LEDGER_REJECTED' });
      rig.payments.set(PAY, { ...FACTS_SENT, returnClaimed: true });
      expect(await refund()).toMatchObject({ kind: 'OK' });
      // a retry after the claimed return and P6 is allowed too, but not before the claim
      const rig2 = makeRig(v);
      const c2 = await open(rig2, { kind: 'RETURNED_PAYOUT', reason: 'PARTNER_RETURNED', subject: 'ret-2', options: [OPT.retry()] });
      rig2.payments.set(PAY, { ...FACTS_SENT, p6Posted: true });
      expect(await exec(rig2, req(c2.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-retry'))).toMatchObject({ code: 'LEG_NOT_PROVEN_UNSENT' });
      rig2.payments.set(PAY, { ...FACTS_SENT, p6Posted: true, returnClaimed: true });
      expect(await exec(rig2, req(c2.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-retry'))).toMatchObject({ kind: 'OK' });
      // returnClaimed means nothing for a case that is not a returned payout
      const c3 = await open(rig2, { kind: 'STUCK_PAYOUT', reason: 'PARTNER_TIMEOUT', subject: 'st', options: [OPT.refundP6()] });
      rig2.payments.set(PAY, { ...FACTS_SENT, returnClaimed: true });
      expect(await exec(rig2, req(c3.caseId, 'REFUND', 'o-refund'))).toMatchObject({ code: 'LEG_NOT_PROVEN_UNSENT' });
    });

    it('bounds a write-off by the shortfall and a refund or write-off by the case exposure', async () => {
      const rig = makeRig(v);
      const usdcWo = (amount: bigint) => ({ ...OPT.writeOff(), unit: 'USDC_UNITS' as const, asset: USDC, amount: usdcUnits(amount) });
      const underCase = { kind: 'UNDERPAYMENT' as const, reason: 'CONFIRMED_BELOW_EXPECTED', amounts: under };
      expect(await rig.queue.openCase(openInput({ ...underCase, options: [usdcWo(101n)] }))).toMatchObject({ code: 'OPTION_INVALID', detail: 'a write-off may not exceed the shortfall' });
      expect(await rig.queue.openCase(openInput({ ...underCase, options: [OPT.writeOff(1n)] }))).toMatchObject({ code: 'OPTION_INVALID', detail: 'a write-off may not exceed the shortfall' });
      expect(await rig.queue.openCase(openInput({ ...underCase, options: [usdcWo(100n)] }))).toMatchObject({ kind: 'OK' });
      const over = { kind: 'OVERPAYMENT' as const, reason: 'CONFIRMED_ABOVE_EXPECTED', amounts: { ...under, confirmed: usdcUnits(1100n) } };
      expect(await rig.queue.openCase(openInput({ ...over, subject: 'o', options: [usdcWo(101n)] }))).toMatchObject({ code: 'OPTION_INVALID' });
      const exposure = { unit: 'USDC_UNITS' as const, amount: usdcUnits(400n) };
      expect(await rig.queue.openCase(openInput({ subject: 'e1', exposure, options: [OPT.refundP6(401n)] }))).toMatchObject({ code: 'OPTION_INVALID', detail: 'a refund may not exceed the case exposure' });
      expect(await rig.queue.openCase(openInput({ subject: 'e2', exposure: { unit: 'CBS_MINOR', amount: cbsMinor(9999n) }, options: [OPT.refundP6(1n)] }))).toMatchObject({ code: 'OPTION_INVALID', detail: 'a refund may not exceed the case exposure' });
      expect(await rig.queue.openCase(openInput({ subject: 'e3', exposure, options: [usdcWo(401n)] }))).toMatchObject({ code: 'OPTION_INVALID', detail: 'a write-off may not exceed the case exposure' });
      expect(await rig.queue.openCase(openInput({ subject: 'e4', exposure: { unit: 'CBS_MINOR', amount: cbsMinor(10n) }, options: [OPT.writeOff(11n)] }))).toMatchObject({ code: 'OPTION_INVALID' });
      expect(await rig.queue.openCase(openInput({ subject: 'e5', exposure, options: [OPT.refundP6(400n), usdcWo(400n)] }))).toMatchObject({ kind: 'OK' });
      expect(await rig.queue.openCase(openInput({ subject: 'e6', exposure: { unit: 'FOO' as never, amount: 5n as never }, options: [OPT.refundP6()] }))).toMatchObject({ code: 'INPUT_INVALID', detail: 'exposure must be a positive bigint in a known unit' });
      expect(await rig.queue.openCase(openInput({ subject: 'e7', exposure: { unit: 'USDC_UNITS', amount: 0n as never }, options: [OPT.refundP6()] }))).toMatchObject({ code: 'INPUT_INVALID' });
    });

    it('the write-off credit account may not be the loss account (at open and at execution)', async () => {
      const rig = makeRig(v);
      const same = { ...OPT.writeOff(), creditAccount: LOSS };
      expect(await rig.queue.openCase(openInput({ options: [same] }))).toMatchObject({ code: 'OPTION_INVALID', detail: 'the write-off credit account may not be the loss account' });
      const lateRig = makeRig(v, { config: { lossAccount: null } });
      lateRig.payments.set(PAY, FACTS_NONE);
      const c = await open(lateRig, { options: [same] });
      const q = qWith(lateRig, { config: { decisionPathEnabled: true, lossAccount: LOSS } });
      expect(await q.execute(req(c.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'LOSS_ACCOUNT_SAME', detail: 'the write-off credit account may not be the loss account' });
      expect(lateRig.ledgerStore.count).toBe(0);
    });
  });

  describe('D-B2: UNMATCHED_FILL closes by ADOPT or REVERSE, never by two conversions', () => {
    it('opens only with the booked entry, both options, and options naming that entry', async () => {
      const rig = makeRig(v);
      expect(await rig.queue.openCase(fillCase({ bookedEntryRef: null }))).toMatchObject({ code: 'INPUT_INVALID', detail: 'bookedEntryRef belongs to UNMATCHED_FILL cases, and is required there' });
      expect(await rig.queue.openCase(fillCase({ bookedEntryRef: 'has space' }))).toMatchObject({ code: 'INPUT_INVALID' });
      expect(await rig.queue.openCase(openInput({ bookedEntryRef: BOOKED }))).toMatchObject({ code: 'INPUT_INVALID' });
      expect(await rig.queue.openCase(fillCase({ options: [OPT.adopt()] }))).toMatchObject({ code: 'OPTION_INVALID', detail: 'an UNMATCHED_FILL case needs both an ADOPT_FILL and a REVERSE_FILL option' });
      expect(await rig.queue.openCase(fillCase({ options: [OPT.reverse()] }))).toMatchObject({ code: 'OPTION_INVALID' });
      expect(await rig.queue.openCase(fillCase({ options: [OPT.adopt('other'), OPT.reverse()] }))).toMatchObject({ code: 'OPTION_INVALID', detail: "ADOPT_FILL must name the case's bookedEntryRef" });
      expect(await rig.queue.openCase(fillCase({ options: [OPT.adopt(), OPT.reverse('other')] }))).toMatchObject({ code: 'OPTION_INVALID', detail: "REVERSE_FILL must name the case's bookedEntryRef" });
      expect(await rig.queue.openCase(fillCase({ reason: 'RATE_EXPIRED' }))).toMatchObject({ code: 'REASON_INVALID' });
      const ok1 = await rig.queue.openCase(fillCase());
      expect(ok1).toMatchObject({ kind: 'OK', value: { bookedEntryRef: BOOKED, kind: 'UNMATCHED_FILL' } });
      // the digest covers the booked entry: a case with another entry is a conflict
      expect(await rig.queue.openCase(fillCase({ subject: 'fill-2', bookedEntryRef: 'booked-2', options: [OPT.adopt('booked-2'), OPT.reverse('booked-2')] }))).toMatchObject({ kind: 'OK' });
      expect(await rig.queue.openCase(fillCase({ options: [OPT.adopt(BOOKED, 800n), OPT.reverse()] }))).toMatchObject({ code: 'CASE_CONFLICT' });
      // REQUOTE no longer takes FILL_AFTER_EXPIRY
      expect(await rig.queue.openCase(openInput({ reason: 'FILL_AFTER_EXPIRY' }))).toMatchObject({ code: 'REASON_INVALID' });
    });

    it('ADOPT consumes the bound consent, posts nothing, and names the quote and the entry', async () => {
      const rig = makeRig(v);
      const c = await open(rig, fillCase());
      expect(await exec(rig, req(c.caseId, 'ADOPT_FILL', 'o-adopt'))).toMatchObject({ code: 'CONSENT_MISSING' });
      grantConsent(rig, 'k-adopt', c, 'o-adopt');
      const r = await exec(rig, req(c.caseId, 'ADOPT_FILL', 'o-adopt', { consentRef: 'k-adopt' }));
      expect(r).toMatchObject({ kind: 'OK', value: { action: 'ADOPT_FILL', journalRef: null, newPaymentId: null, acceptedAmount: 900n, quoteId: 'quote-adopted', bookedEntryRef: BOOKED } });
      expect(rig.ledgerStore.count).toBe(0);
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'CLOSED', consumedDigests: [c.options[0]?.digest] });
      // the case closed by ADOPT: REVERSE is refused, ADOPT replays
      expect(await exec(rig, req(c.caseId, 'REVERSE_FILL', 'o-reverse'))).toMatchObject({ code: 'CASE_CLOSED', detail: 'the case is closed by another decision' });
      expect(await exec(rig, req(c.caseId, 'ADOPT_FILL', 'o-adopt', { consentRef: 'k-adopt' }))).toMatchObject({ kind: 'OK', replayed: true });
    });

    it('REVERSE posts P12 once per booked entry, whichever case asks, and needs no consent', async () => {
      const rig = makeRig(v);
      const seen: { key: string; template: string }[] = [];
      const spy = { post: async (k: never, j: never) => (seen.push({ key: k as string, template: (j as { template: string }).template }), rig.ledgerStore.post(k, j)) };
      const q = qWith(rig, { ledger: spy });
      const c1 = await open(rig, fillCase());
      const r1 = await q.execute(req(c1.caseId, 'REVERSE_FILL', 'o-reverse'));
      expect(r1).toMatchObject({ kind: 'OK', value: { action: 'REVERSE_FILL', bookedEntryRef: BOOKED, quoteId: null, acceptedAmount: null } });
      expect(seen[0]?.template).toBe('P12_FILL_REVERSAL');
      expect(seen[0]?.key).toMatch(/^ops-p12:[0-9a-f]{32}$/);
      // a second case for the same booked entry replays the first journal: one reversal, never two
      const c2 = await open(rig, fillCase({ subject: 'fill-2', reason: 'FILL_MISPOSTED' }));
      const r2 = await q.execute(req(c2.caseId, 'REVERSE_FILL', 'o-reverse'));
      expect(r2.kind === 'OK' && r2.value.journalRef).toBe(r1.kind === 'OK' ? r1.value.journalRef : null);
      expect(rig.ledgerStore.count).toBe(1);
      expect(seen[1]?.key).toBe(seen[0]?.key);
    });

    it('no REQUOTE while an UNMATCHED_FILL case of the payment is open', async () => {
      const rig = makeRig(v);
      const rq = await open(rig);
      grantConsent(rig, 'k-rq', rq, 'o-requote');
      const fill = await open(rig, fillCase());
      expect(await exec(rig, req(rq.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k-rq' }))).toMatchObject({ code: 'UNMATCHED_FILL_OPEN', detail: 'no new code while an UNMATCHED_FILL case of this payment is open' });
      expect(rig.ledgerStore.count).toBe(0);
      expect(await getCase(rig, rq.caseId)).toMatchObject({ status: 'OPEN', pending: null, consumedDigests: [] });
      // another payment's open fill case does not block
      const other = await open(rig, fillCase({ subject: 'fill-x', paymentId: `pay-${'c'.repeat(32)}` }));
      expect(other.status).toBe('OPEN');
      await exec(rig, req(fill.caseId, 'REVERSE_FILL', 'o-reverse'));
      expect(await exec(rig, req(rq.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k-rq' }))).toMatchObject({ kind: 'OK' });
    });

    it('one booked conversion per payment: ADOPT is refused once a requote or an adoption already closed', async () => {
      const rig = makeRig(v);
      const rq = await open(rig);
      grantConsent(rig, 'k-rq', rq, 'o-requote');
      expect(await exec(rig, req(rq.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k-rq' }))).toMatchObject({ kind: 'OK' });
      const late = await open(rig, fillCase({ subject: 'late' }));
      grantConsent(rig, 'k-late', late, 'o-adopt');
      expect(await exec(rig, req(late.caseId, 'ADOPT_FILL', 'o-adopt', { consentRef: 'k-late' }))).toMatchObject({ code: 'FILL_ALREADY_ACCOUNTED', detail: 'a conversion for this payment is already accounted for; reverse this fill instead' });
      expect(await getCase(rig, late.caseId)).toMatchObject({ status: 'OPEN', pending: null });
      expect(await exec(rig, req(late.caseId, 'REVERSE_FILL', 'o-reverse'))).toMatchObject({ kind: 'OK' });
      // two adoptions for one payment
      const rig2 = makeRig(v);
      const a = await open(rig2, fillCase());
      const b = await open(rig2, fillCase({ subject: 'fill-b', bookedEntryRef: 'booked-b', options: [OPT.adopt('booked-b'), OPT.reverse('booked-b')] }));
      grantConsent(rig2, 'ka', a, 'o-adopt');
      grantConsent(rig2, 'kb', b, 'o-adopt');
      expect(await exec(rig2, req(a.caseId, 'ADOPT_FILL', 'o-adopt', { consentRef: 'ka' }))).toMatchObject({ kind: 'OK' });
      expect(await exec(rig2, req(b.caseId, 'ADOPT_FILL', 'o-adopt', { consentRef: 'kb' }))).toMatchObject({ code: 'FILL_ALREADY_ACCOUNTED' });
      // a requote of ANOTHER payment does not count
      const rig3 = makeRig(v);
      const rqOther = await open(rig3, { paymentId: `pay-${'d'.repeat(32)}` });
      grantConsent(rig3, 'k1', rqOther, 'o-requote');
      await exec(rig3, req(rqOther.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k1' }));
      const f3 = await open(rig3, fillCase());
      grantConsent(rig3, 'k3', f3, 'o-adopt');
      expect(await exec(rig3, req(f3.caseId, 'ADOPT_FILL', 'o-adopt', { consentRef: 'k3' }))).toMatchObject({ kind: 'OK' });
    });

    it('an unreadable case list refuses (fail closed)', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      grantConsent(rig, 'k', c, 'o-requote');
      const cases = {
        get: rig.cases.get.bind(rig.cases),
        put: rig.cases.put.bind(rig.cases),
        listOpen: rig.cases.listOpen.bind(rig.cases),
        listByPayment: async () => ambiguous('TIMEOUT'),
      } as never;
      expect(await qWith(rig, { cases }).execute(req(c.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k' }))).toMatchObject({ code: 'FACTS_UNAVAILABLE', detail: 'the payment cases could not be read' });
    });
  });

  describe('D-B3: the consent binds the quote, the rate, the expiry and the settlement instructions', () => {
    const base = OPT.requote();
    const changed: [string, Partial<QuoteTerms>][] = [
      ['quote id', { quoteId: 'quote-other' }],
      ['rate numerator', { rateNum: 19n }],
      ['rate denominator', { rateDen: 2n }],
      ['expiry', { expiresAt: '2026-10-07T12:00:01Z' }],
      ['settlement instructions', { settlementDigest: 'b'.repeat(64) }],
    ];
    it.each(changed)('a changed %s changes the option digest (REQUOTE, ADOPT_FILL, ACCEPT)', (_n, patch) => {
      expect(optionDigest({ ...base, ...patch })).not.toBe(optionDigest(base));
      expect(optionDigest({ ...OPT.adopt(), ...patch })).not.toBe(optionDigest(OPT.adopt()));
      const acc = { ...OPT.accept(), ...('quoteId' in patch ? { quoteId: patch.quoteId as string } : {}), ...('settlementDigest' in patch ? { settlementDigest: patch.settlementDigest as string } : {}) };
      if ('quoteId' in patch || 'settlementDigest' in patch) expect(optionDigest(acc)).not.toBe(optionDigest(OPT.accept()));
    });

    it('a consent given for one quote cannot be spent on another', async () => {
      const rig = makeRig(v);
      const a = await open(rig, { options: [OPT.requote()] });
      const b = await open(rig, { subject: 'quote-2', options: [{ ...OPT.requote(), quoteId: 'quote-evil', settlementDigest: 'e'.repeat(64) }] });
      rig.consentStore.grant('k', { clientUid: a.clientUid, paymentId: a.paymentId, caseId: b.caseId, digest: a.options[0]?.digest ?? '' });
      expect(await exec(rig, req(b.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k' }))).toMatchObject({ code: 'CONSENT_REFUSED', detail: 'consent refused: BINDING_MISMATCH' });
    });

    it('the outcome names the quote the journey now uses', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      grantConsent(rig, 'k', c, 'o-requote');
      expect(await exec(rig, req(c.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k' }))).toMatchObject({ kind: 'OK', value: { quoteId: 'quote-new', bookedEntryRef: null } });
      const acc = await open(rig, { kind: 'CONSENT_MISSING', reason: 'NO_CONSENT_RECORD', subject: 'cm', options: [{ ...OPT.accept(), quoteId: 'quote-acc' }] });
      grantConsent(rig, 'k2', acc, 'o-accept');
      expect(await exec(rig, req(acc.caseId, 'ACCEPT_WITH_CONSENT', 'o-accept', { consentRef: 'k2' }))).toMatchObject({ kind: 'OK', value: { quoteId: 'quote-acc', acceptedAmount: 900n, bookedEntryRef: null } });
      const plain = await open(rig, { kind: 'CONSENT_MISSING', reason: 'CONSENT_ALREADY_USED', subject: 'cm2', options: [OPT.accept()] });
      grantConsent(rig, 'k3', plain, 'o-accept');
      expect(await exec(rig, req(plain.caseId, 'ACCEPT_WITH_CONSENT', 'o-accept', { consentRef: 'k3' }))).toMatchObject({ kind: 'OK', value: { quoteId: null } });
    });

    it('rejects malformed quote terms', () => {
      const t: QuoteTerms = { quoteId: 'q', rateNum: 1n, rateDen: 1n, expiresAt: '2026-10-07T12:00:00Z', settlementDigest: SETTLEMENT };
      expect(termsProblem(t)).toBeNull();
      expect(termsProblem({ ...t, expiresAt: '2026-10-07T12:00:00.123456789Z' })).toBeNull();
      expect(termsProblem({ ...t, quoteId: 'has space' })).toBe('quoteId malformed');
      expect(termsProblem({ ...t, rateNum: 0n })).toBe('rate must be a positive bigint ratio');
      expect(termsProblem({ ...t, rateDen: -1n })).toBe('rate must be a positive bigint ratio');
      expect(termsProblem({ ...t, rateNum: 1 as never })).toBe('rate must be a positive bigint ratio');
      expect(termsProblem({ ...t, rateDen: '1' as never })).toBe('rate must be a positive bigint ratio');
      expect(termsProblem({ ...t, expiresAt: '2026-10-07 12:00:00' })).toBe('expiresAt must be an ISO-8601 UTC instant');
      expect(termsProblem({ ...t, expiresAt: 5 as never })).toBe('expiresAt must be an ISO-8601 UTC instant');
      expect(termsProblem({ ...t, settlementDigest: 'abc' })).toBe('settlementDigest must be a 64-hex digest');
      expect(termsProblem({ ...t, settlementDigest: 'A'.repeat(64) })).toBe('settlementDigest must be a 64-hex digest');
      expect(termsProblem({ ...t, settlementDigest: 5 as never })).toBe('settlementDigest must be a 64-hex digest');
      expect(optionProblem({ ...OPT.requote(), quoteId: 'a b' })).toBe('REQUOTE quoteId malformed');
      expect(optionProblem({ ...OPT.adopt(), rateNum: 0n })).toBe('ADOPT_FILL rate must be a positive bigint ratio');
      expect(optionProblem({ ...OPT.accept(), quoteId: 'a b' })).toBe('quoteId malformed');
      expect(optionProblem({ ...OPT.accept(), settlementDigest: 'x' })).toBe('settlementDigest must be a 64-hex digest');
      expect(optionProblem({ ...OPT.adopt(), bookedEntryRef: 'a b' })).toBe('bookedEntryRef malformed');
      expect(optionProblem({ ...OPT.adopt(), adoptedAmount: 0n as never })).toBe('ADOPT_FILL amount must be a positive bigint');
      expect(optionProblem({ ...OPT.adopt(), asset: 'a b' as never })).toBe('ADOPT_FILL amount must be a positive bigint');
      expect(optionProblem({ ...OPT.adopt(), unit: 'FOO' as never })).toBe('ADOPT_FILL amount must be a positive bigint');
      expect(optionProblem({ ...OPT.reverse(), bookedEntryRef: 'a b' })).toBe('bookedEntryRef malformed');
      expect(optionProblem({ ...OPT.reverse(), legs: OPT.reverse().legs.slice(0, 1) })).toBe('P12 at least two legs');
      expect(optionProblem(OPT.reverse())).toBeNull();
      expect(optionProblem(OPT.adopt())).toBeNull();
      expect(optionProblem(OPT.closeHistory())).toBeNull();
    });

    it('a requote moves exactly the requoted amount, in the option unit and asset', () => {
      expect(optionProblem(OPT.requote(1000n, 900n))).toBeNull();
      expect(optionProblem({ ...OPT.requote(1000n, 900n), legs: legs(100n) })).toBe('P14 legs must move exactly the requoted amount');
      expect(optionProblem({ ...OPT.requote(1000n, 900n), legs: legs(999_999n) })).toBe('P14 legs must move exactly the requoted amount');
      expect(optionProblem({ ...OPT.requote(1000n, 900n), unit: 'FOO' as never })).toBe('REQUOTE amounts must be positive bigints');
      expect(optionProblem(OPT.requote(900n, 1000n))).toBe('REQUOTE_EXCEEDS_RESERVATION');
    });
  });

  describe('new kinds and the reason names', () => {
    it('has no HOLD kind; a nonce hold is not a case', async () => {
      const rig = makeRig(v);
      expect(await rig.queue.openCase(openInput({ kind: 'HOLD' as never, reason: 'NONCE_HOLD', options: [OPT.unpause()] }))).toMatchObject({ code: 'KIND_MISMATCH', detail: 'unknown case kind' });
      expect(await rig.queue.openCase(openInput({ kind: 'PAUSE', reason: 'MONITOR_NOT_ALL_CLEAR', options: [OPT.unpause()] }))).toMatchObject({ kind: 'OK' });
      expect(D1_NAME_OF).toEqual({ STUCK_PAYOUT: 'STUCK', RETURNED_PAYOUT: 'PARTNER_RETURN', UNDERPAYMENT: 'PAYIN_MISMATCH', OVERPAYMENT: 'PAYIN_MISMATCH', LATE_PAYIN: 'PAYIN_MISMATCH', RELEASE_QUARANTINE: 'LIFT_QUARANTINE' });
    });

    it('FILL_TIMEOUT closes by REQUOTE (with consent), REFUND or WRITE_OFF; HISTORY_WRITE_FAILED by CLOSE_HISTORY_GAP, two-person', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const t = await open(rig, { kind: 'FILL_TIMEOUT', reason: 'NO_FILL_BY_TIMEOUT', subject: 'timeout-1', options: [OPT.requote(), OPT.refundP6()] });
      grantConsent(rig, 'kt', t, 'o-requote');
      expect(await exec(rig, req(t.caseId, 'REQUOTE', 'o-requote', { consentRef: 'kt' }))).toMatchObject({ kind: 'OK' });
      const h = await open(rig, { kind: 'HISTORY_WRITE_FAILED', reason: 'HISTORY_APPEND_FAILING_PAST_AGE', subject: 'hist-1', options: [OPT.closeHistory()] });
      expect(await exec(rig, req(h.caseId, 'CLOSE_HISTORY_GAP', 'o-history', { approvers: [ALICE, ALICE] }))).toMatchObject({ code: 'SAME_APPROVER' });
      expect(await exec(rig, req(h.caseId, 'REFUND', 'o-refund'))).toMatchObject({ code: 'ACTION_NOT_ALLOWED' });
      const r = await exec(rig, req(h.caseId, 'CLOSE_HISTORY_GAP', 'o-history'));
      expect(r).toMatchObject({ kind: 'OK', value: { action: 'CLOSE_HISTORY_GAP', journalRef: null, newPaymentId: null, quoteId: null, bookedEntryRef: null } });
      const cm = await open(rig, { kind: 'CONSENT_MISSING', reason: 'NO_CONSENT_RECORD', subject: 'cm', options: [OPT.accept(), OPT.refundP6()] });
      expect(cm.amounts).toBeNull();
      grantConsent(rig, 'kc', cm, 'o-accept');
      expect(await exec(rig, req(cm.caseId, 'ACCEPT_WITH_CONSENT', 'o-accept', { consentRef: 'kc' }))).toMatchObject({ kind: 'OK', value: { acceptedAmount: 900n } });
    });

    it('rejects a bad unit on the case amounts and exposes legKeys sorted', async () => {
      const rig = makeRig(v);
      const bad = { unit: 'FOO' as never, expected: 10n as never, confirmed: 9n as never };
      expect(await rig.queue.openCase(openInput({ kind: 'UNDERPAYMENT', reason: 'CONFIRMED_BELOW_EXPECTED', amounts: bad, options: [OPT.refundP6(1n)] }))).toMatchObject({ code: 'INPUT_INVALID', detail: 'expected and confirmed amounts are required' });
      expect(legKeys(legs(5n))).toEqual([`${CLIENT_ACC}|DEBIT|USDC|USDC_UNITS|5`, `${SETTLE}|CREDIT|USDC|USDC_UNITS|5`].sort());
    });
  });

  describe('two humans confirm the same option digest (D1 :1040), canonical ids reach the control port and the audit', () => {
    it('refuses a missing, wrong or one-sided confirmation', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      const d = c.options.find((o) => o.optionId === 'o-writeoff')?.digest ?? '';
      const go = (confirmedDigests: unknown) => rig.queue.execute({ ...req(c.caseId, 'WRITE_OFF', 'o-writeoff'), confirmedDigests: confirmedDigests as never });
      const detail = 'each approver must confirm the digest of the exact option';
      for (const x of [[d, 'x'], ['x', d], [d], [d, d, d], undefined, 'ab', [d, 5], [5, d], ['', ''], [d.toUpperCase(), d]]) {
        expect(await go(x), JSON.stringify(x)).toMatchObject({ kind: 'REJECTED', code: 'DIGEST_NOT_CONFIRMED', detail });
      }
      expect(await go([d, d])).toMatchObject({ kind: 'OK' });
    });

    it('passes canonical staff ids to the control port and the audit', async () => {
      const rig = makeRig(v);
      const c = await open(rig, { kind: 'PAUSE', reason: 'RECON_DRIFT', subject: 'rail', options: [OPT.unpause()] });
      const seen: unknown[] = [];
      const control = { apply: async (...a: unknown[]) => (seen.push(a), ok(undefined, false)) } as never;
      const approvers: [string, string] = v === 'A' ? ['Alice@x', 'staff:bob'] : ['staff:ALICE', 'staff:bob'];
      expect(await qWith(rig, { control }).execute(req(c.caseId, 'UNPAUSE', 'o-unpause', { approvers }))).toMatchObject({ kind: 'OK' });
      const want = v === 'A' ? ['alice', 'bob'] : [ALICE, BOB];
      expect(seen[0]).toEqual(['UNPAUSE', 'rail', expect.stringMatching(/^dec-/), want]);
      const log = (await rig.audit.entries()) ?? [];
      expect(log.at(-1)?.actors).toEqual(want);
      expect(log.at(-2)?.actors).toEqual(want);
    });

    it('a refusal before authentication records what arrived; after it, the canonical ids', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      await exec(rig, req(c.caseId, 'REFUND', 'o-refund', { approvers: ['ghost', BOB] }));
      await exec(rig, req(c.caseId, 'REFUND', 'o-refund', { confirmedDigests: ['x', 'x'] }));
      const log = (await rig.audit.entries()) ?? [];
      expect(log.at(-2)).toMatchObject({ code: 'APPROVER_UNAUTHENTICATED', actors: ['ghost', BOB] });
      expect(log.at(-1)).toMatchObject({ code: 'DIGEST_NOT_CONFIRMED', actors: v === 'A' ? ['alice', 'bob'] : [ALICE, BOB] });
    });
  });

  describe('malformed shapes never throw (ports never throw)', () => {
    it('refuses odd approvers, evidence and options without an exception', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      for (const approvers of [{} as never, 'ab' as never, null as never, { length: 2 } as never]) {
        await expect(exec(rig, req(c.caseId, 'REFUND', 'o-refund', { approvers }))).resolves.toMatchObject({ code: 'APPROVER_UNAUTHENTICATED' });
      }
      await expect(exec(rig, req(c.caseId, 'REFUND', 'o-refund', { evidenceRefs: {} as never }))).resolves.toMatchObject({ code: 'EVIDENCE_MISSING' });
      await expect(exec(rig, req(c.caseId, 'REFUND', 'o-refund', { evidenceRefs: 'abc' as never }))).resolves.toMatchObject({ code: 'EVIDENCE_MISSING' });
      await expect(rig.queue.openCase(openInput({ evidenceRefs: {} as never }))).resolves.toMatchObject({ code: 'EVIDENCE_MISSING' });
      await expect(rig.queue.openCase(openInput({ options: {} as never }))).resolves.toMatchObject({ code: 'OPTION_INVALID', detail: 'at least one option is required' });
      await expect(rig.queue.openCase(openInput({ options: 'abc' as never }))).resolves.toMatchObject({ code: 'OPTION_INVALID' });
      const log = (await rig.audit.entries()) ?? [];
      expect(log.filter((e) => e.code === 'EVIDENCE_MISSING').every((e) => Array.isArray(e.evidenceRefs))).toBe(true);
      expect(log.find((e) => e.actors.length === 0 && e.type === 'ACTION_REFUSED')).toBeDefined();
    });
  });

  describe('audit gaps (m3, m11)', () => {
    class FlakyStore implements AuditStorePort {
      readonly inner = new ArrayAuditStore();
      failOn: ((e: AuditEntry) => boolean) | null = null;
      async append(e: AuditEntry): Promise<PortResult<void, 'SEQ_CONFLICT'>> {
        return this.failOn?.(e) === true ? ambiguous('UNAVAILABLE') : this.inner.append(e);
      }
      tail() {
        return this.inner.tail();
      }
      all() {
        return this.inner.all();
      }
    }
    const flakyRig = () => {
      const store = new FlakyStore();
      const rig = makeRig(v, { audit: new AuditLog(store, () => '2026-10-07T10:00:00Z') });
      return { rig, store };
    };

    it('an APPLIED audit that cannot be written leaves the case pending; the same decision completes it once', async () => {
      const { rig, store } = flakyRig();
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      store.failOn = (e) => e.type === 'ACTION_APPLIED';
      const first = await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff'));
      expect(first).toMatchObject({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: { decisionId: expect.stringMatching(/^dec-/) } });
      expect(rig.ledgerStore.count).toBe(1);
      store.failOn = null;
      const second = await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff'));
      expect(second).toMatchObject({ kind: 'OK' });
      expect(rig.ledgerStore.count).toBe(1);
      expect((await codes(rig)).filter((x) => x === 'ACTION_APPLIED:OK')).toHaveLength(1);
      expect(await rig.audit.verify()).toBeNull();
    });

    it('a PENDING audit that cannot be written fails closed', async () => {
      const { rig, store } = flakyRig();
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig, { options: [OPT.refundP13()] });
      const skew = { post: async (k: never, j: never) => ok({ ...((await rig.ledgerStore.post(k, j)) as { value: object }).value, debits: 1n, credits: 1n }, false) } as never;
      store.failOn = (e) => e.type === 'ACTION_PENDING';
      expect(await qWith(rig, { ledger: skew }).execute(req(c.caseId, 'REFUND', 'o-refund13'))).toMatchObject({
        code: 'AUDIT_FAILED',
        detail: 'the ledger read-back (totals) does not match; the case stays open but the page-out failed',
      });
      expect(await getCase(rig, c.caseId)).toMatchObject({ status: 'OPEN', pending: { consentConsumed: false } });
    });

    it('a case that was stored but not audited is repaired by opening it again, once', async () => {
      const { rig, store } = flakyRig();
      store.failOn = (e) => e.type === 'CASE_OPENED';
      expect(await rig.queue.openCase(openInput())).toMatchObject({ code: 'AUDIT_FAILED', detail: 'the case was stored but its opening could not be audited; open it again to repair' });
      expect(await store.inner.all()).toMatchObject({ value: [] });
      expect(await rig.queue.listOpen()).toMatchObject({ value: [expect.objectContaining({ subject: 'quote-1' })] });
      store.failOn = (e) => e.type === 'CASE_OPENED';
      expect(await rig.queue.openCase(openInput())).toMatchObject({ code: 'AUDIT_FAILED', detail: 'the case opening could not be audited' });
      store.failOn = null;
      expect(await rig.queue.openCase(openInput())).toMatchObject({ kind: 'OK', replayed: true });
      expect(await rig.queue.openCase(openInput())).toMatchObject({ kind: 'OK', replayed: true });
      expect((await codes(rig)).filter((x) => x === 'CASE_OPENED:OK')).toHaveLength(1);
    });

    it('an unreadable audit trail refuses the repair check', async () => {
      const { rig, store } = flakyRig();
      await open(rig);
      store.all = async () => ambiguous('TIMEOUT') as never;
      expect(await rig.queue.openCase(openInput())).toMatchObject({ code: 'AUDIT_FAILED', detail: 'the audit trail could not be read' });
    });

    it('stored audit entries are deeply frozen', async () => {
      const rig = makeRig(v);
      await exec(rig, req('nope', 'REFUND', 'o'));
      const e = ((await rig.audit.entries()) ?? [])[0] as AuditEntry;
      expect(Object.isFrozen(e.actors) && Object.isFrozen(e.evidenceRefs) && Object.isFrozen(e.refs)).toBe(true);
      expect(() => (e.actors as string[]).push('x')).toThrow(TypeError);
    });
  });

  describe('read-back is per account, and the claim and consent are kept (m7, m8)', () => {
    it('a read-back that books other accounts is UNBALANCED and pages a human', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_PROVEN);
      const c = await open(rig);
      const wrong = {
        post: async (k: never, j: never) => {
          const r = (await rig.ledgerStore.post(k, j)) as unknown as { value: { lines: { account: string }[] } };
          return ok({ ...r.value, lines: r.value.lines.map((l, i) => (i === 0 ? { ...l, account: 'elsewhere' } : l)) }, false) as never;
        },
      };
      const r = await qWith(rig, { ledger: wrong as never }).execute(req(c.caseId, 'REFUND', 'o-refund'));
      expect(r).toMatchObject({ kind: 'REJECTED', code: 'UNBALANCED', detail: 'the ledger read-back (lines) does not match; the case stays open and a QUARANTINE case pages a human' });
      const l = await rig.queue.listOpen();
      expect(l.kind === 'OK' && l.value.some((x) => x.kind === 'QUARANTINE' && x.reason === 'INVARIANT_FAILED')).toBe(true);
      // a short line list is just as wrong
      const rig2 = makeRig(v);
      rig2.payments.set(PAY, FACTS_PROVEN);
      const c2 = await open(rig2);
      const short = { post: async (k: never, j: never) => ok({ ...((await rig2.ledgerStore.post(k, j)) as unknown as { value: { lines: unknown[] } }).value, lines: [] }, false) as never };
      expect(await qWith(rig2, { ledger: short as never }).execute(req(c2.caseId, 'REFUND', 'o-refund'))).toMatchObject({ code: 'UNBALANCED' });
    });

    it('the same decision after a repair completes and the paging case is not duplicated', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_PROVEN);
      const c = await open(rig);
      const skew = { post: async (k: never, j: never) => ok({ ...((await rig.ledgerStore.post(k, j)) as { value: object }).value, credits: 1n }, false) } as never;
      const q = qWith(rig, { ledger: skew });
      await q.execute(req(c.caseId, 'REFUND', 'o-refund'));
      await q.execute(req(c.caseId, 'REFUND', 'o-refund'));
      const l = await rig.queue.listOpen();
      expect(l.kind === 'OK' && l.value.filter((x) => x.kind === 'QUARANTINE')).toHaveLength(1);
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ kind: 'OK' });
    });

    it('a consent consumed before a ledger refusal is not lost', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      grantConsent(rig, 'k', c, 'o-requote');
      const rej = { post: async () => rejected('KEY_CONFLICT', 'x') } as never;
      expect(await qWith(rig, { ledger: rej }).execute(req(c.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k' }))).toMatchObject({ code: 'LEDGER_REJECTED' });
      const after = await getCase(rig, c.caseId);
      expect(after).toMatchObject({ status: 'OPEN', pending: null, consumedDigests: [c.options[0]?.digest] });
      // no new consent is asked for, and the old one is not consumed twice
      expect(await exec(rig, req(c.caseId, 'REQUOTE', 'o-requote'))).toMatchObject({ kind: 'OK' });
      expect(await rig.consentStore.consume('k', { clientUid: c.clientUid, paymentId: c.paymentId, caseId: c.caseId, digest: c.options[0]?.digest ?? '' })).toMatchObject({ code: 'ALREADY_USED' });
      // the claim made by a consented retry carries the consumed mark
      const c2 = await open(rig, { subject: 'q2' });
      grantConsent(rig, 'k2', c2, 'o-requote');
      await qWith(rig, { ledger: rej }).execute(req(c2.caseId, 'REQUOTE', 'o-requote', { consentRef: 'k2' }));
      const hang = { post: async () => ambiguous('TIMEOUT') } as never;
      expect(await qWith(rig, { ledger: hang }).execute(req(c2.caseId, 'REQUOTE', 'o-requote'))).toMatchObject({ kind: 'AMBIGUOUS' });
      expect(await getCase(rig, c2.caseId)).toMatchObject({ pending: { consentConsumed: true } });
    });

    it('a call that did not make the claim never releases it', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig, { options: [OPT.refundP13()] });
      const hang = { post: async () => ambiguous('TIMEOUT') } as never;
      await qWith(rig, { ledger: hang }).execute(req(c.caseId, 'REFUND', 'o-refund13'));
      const decisionId = (await getCase(rig, c.caseId)).pending?.decisionId;
      const rej = { post: async () => rejected('LEG_GUARD', 'x') } as never;
      expect(await qWith(rig, { ledger: rej }).execute(req(c.caseId, 'REFUND', 'o-refund13'))).toMatchObject({ code: 'LEDGER_REJECTED' });
      expect(await getCase(rig, c.caseId)).toMatchObject({ pending: { decisionId } });
      // the retry and control refusals likewise leave a foreign claim alone
      const c2 = await open(rig, { kind: 'PAUSE', reason: 'RECON_DRIFT', subject: 'rail', options: [OPT.unpause()] });
      const hangControl = { apply: async () => ambiguous('TIMEOUT') } as never;
      await qWith(rig, { control: hangControl }).execute(req(c2.caseId, 'UNPAUSE', 'o-unpause'));
      const refuse = { apply: async () => rejected('NOT_FOUND', 'x') } as never;
      expect(await qWith(rig, { control: refuse }).execute(req(c2.caseId, 'UNPAUSE', 'o-unpause'))).toMatchObject({ code: 'CONTROL_REJECTED' });
      expect(await getCase(rig, c2.caseId)).toMatchObject({ pending: { decisionId: expect.stringMatching(/^dec-/) } });
    });
  });

  describe('closed cases and replays (queue.ts:262 operands)', () => {
    it('replays only the same action and option; any other is CASE_CLOSED', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig, { options: [OPT.refundP6(), { ...OPT.refundP6(), optionId: 'o-refund-b' }, OPT.writeOff()] });
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ kind: 'OK' });
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ kind: 'OK', replayed: true });
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund-b'))).toMatchObject({ code: 'CASE_CLOSED' });
      expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-refund'))).toMatchObject({ code: 'CASE_CLOSED' });
      expect(await exec(rig, req(c.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'CASE_CLOSED', detail: 'the case is closed by another decision' });
      expect((await codes(rig)).filter((x) => x === 'ACTION_REPLAYED:OK')).toHaveLength(1);
    });

    it('a closed case with no outcome is not replayed', async () => {
      const rig = makeRig(v);
      const c = await open(rig);
      const closed: CaseRecord = { ...c, status: 'CLOSED', outcome: null, version: c.version + 1n };
      await rig.cases.put(closed, c.version);
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-refund'))).toMatchObject({ code: 'CASE_CLOSED' });
    });
  });

  describe('refusal details, one by one', () => {
    it('states why', async () => {
      const rig = makeRig(v);
      rig.payments.set(PAY, FACTS_NONE);
      const c = await open(rig);
      const d = async (over: Parameters<typeof req>[3], action: Parameters<typeof req>[1] = 'WRITE_OFF', opt = 'o-writeoff') => exec(rig, req(c.caseId, action, opt, over));
      expect(await d({ approvers: [ALICE] as never })).toMatchObject({ detail: 'exactly two approvers are required' });
      expect(await d({ approvers: ['ghost', BOB] })).toMatchObject({ detail: 'both approvers must be authenticated staff, never a service account' });
      expect(await d({ approvers: [BOB, 'ghost'] })).toMatchObject({ detail: 'both approvers must be authenticated staff, never a service account' });
      expect(await d({ approvers: [ALICE, ALICE] })).toMatchObject({ detail: 'two different people must approve' });
      expect(await d({ reason: '' })).toMatchObject({ code: 'REASON_INVALID', detail: 'a reason of 1 to 500 characters is required' });
      expect(await d({ reason: '   ' })).toMatchObject({ code: 'REASON_INVALID' });
      expect(await d({ reason: 5 as never })).toMatchObject({ code: 'REASON_INVALID' });
      expect(await d({ reason: 'x'.repeat(501) })).toMatchObject({ code: 'REASON_INVALID' });
      const c500 = await open(rig, { subject: 'c500' });
      expect(await exec(rig, req(c500.caseId, 'WRITE_OFF', 'o-writeoff', { reason: 'x'.repeat(500) }))).toMatchObject({ kind: 'OK' });
      expect(await d({ evidenceRefs: [] }, 'REFUND', 'o-refund')).toMatchObject({ code: 'EVIDENCE_MISSING', detail: 'at least one well-formed evidence reference is required' });
      expect(await d({ evidenceRefs: ['has space'] }, 'REFUND', 'o-refund')).toMatchObject({ code: 'EVIDENCE_MISSING' });
      expect(await exec(rig, req('missing', 'REFUND', 'o-refund'))).toMatchObject({ code: 'CASE_NOT_FOUND', detail: 'no such case' });
      expect(await exec(rig, req(c.caseId, 'REFUND', 'o-nope'))).toMatchObject({ code: 'OPTION_NOT_FOUND', detail: 'no such server-side option for this action' });
      expect(await exec(rig, req(c.caseId, 'UNPAUSE', 'o-unpause'))).toMatchObject({ code: 'ACTION_NOT_ALLOWED', detail: 'UNPAUSE is not an action of a REQUOTE case' });
      const off = makeRig(v, { config: { decisionPathEnabled: false } });
      const co = await open(off);
      expect(await exec(off, req(co.caseId, 'REFUND', 'o-refund'))).toMatchObject({ code: 'NOT_ENABLED', detail: 'CF-31 is open: no decision-entry path is enabled' });
      const noLoss = makeRig(v, { config: { lossAccount: null } });
      const cn = await open(noLoss);
      expect(await exec(noLoss, req(cn.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ detail: 'no loss account is configured; WRITE_OFF is refused' });
      const cq = await open(rig, { subject: 'cq' });
      expect(await exec(rig, req(cq.caseId, 'REQUOTE', 'o-requote'))).toMatchObject({ detail: "REQUOTE needs the client's recorded consent" });
      rig.payments.set(PAY, FACTS_SENT);
      expect(await exec(rig, req(cq.caseId, 'REFUND', 'o-refund'))).toMatchObject({ detail: 'the Arc leg is not proven never sent (D-6)' });
      rig.payments.set(PAY, { ...FACTS_NONE, arcLeg: 'UNRESOLVED' });
      expect(await exec(rig, req(cq.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ detail: 'the Arc leg may have been sent; resolve it first' });
      expect(await exec(rig, req(cq.caseId, 'REFUND', 'o-refund'))).toMatchObject({ detail: 'the Arc leg is not proven never sent (D-6)' });
      rig.payments.set(PAY, FACTS_PROVEN);
      const c13 = await open(rig, { subject: 'c13', options: [OPT.refundP13()] });
      expect(await exec(rig, req(c13.caseId, 'REFUND', 'o-refund13'))).toMatchObject({ detail: 'P13 refunds only a pay-in that has no Arc leg' });
      const retry = await open(rig, { kind: 'UNRESOLVED_SUBMIT', reason: 'DFNS_5XX', subject: 'r', options: [OPT.retry()] });
      rig.payments.set(PAY, { ...FACTS_PROVEN, p6Posted: false });
      expect(await exec(rig, req(retry.caseId, 'RETRY_AS_NEW_PAYMENT', 'o-retry'))).toMatchObject({ detail: 'the original must be terminal with P6 posted' });
      const fresh = makeRig(v);
      const cf = await open(fresh);
      expect(await exec(fresh, req(cf.caseId, 'WRITE_OFF', 'o-writeoff'))).toMatchObject({ code: 'FACTS_UNAVAILABLE', detail: 'the payment facts could not be read' });
    });

    it('input problems state why', async () => {
      const rig = makeRig(v);
      const o = (over: Record<string, unknown>) => rig.queue.openCase(openInput(over as never));
      expect(await o({ kind: 'NOPE' })).toMatchObject({ code: 'KIND_MISMATCH', detail: 'unknown case kind' });
      expect(await o({ reason: 'x' })).toMatchObject({ detail: 'reason "x" is not a REQUOTE reason' });
      expect(await o({ subject: 'has space' })).toMatchObject({ detail: 'subject, paymentId or clientUid malformed' });
      expect(await o({ clientUid: 'has space' })).toMatchObject({ detail: 'subject, paymentId or clientUid malformed' });
      expect(await o({ paymentId: 'nope' })).toMatchObject({ detail: 'subject, paymentId or clientUid malformed' });
      expect(await o({ paymentId: 5 })).toMatchObject({ detail: 'subject, paymentId or clientUid malformed' });
      expect(await o({ evidenceRefs: [] })).toMatchObject({ detail: 'at least one well-formed evidence reference is required' });
      expect(await o({ amounts: under })).toMatchObject({ detail: 'amounts only belong to UNDERPAYMENT and OVERPAYMENT' });
      expect(await o({ options: [] })).toMatchObject({ detail: 'at least one option is required' });
      expect(await o({ options: [OPT.unpause()] })).toMatchObject({ code: 'ACTION_NOT_ALLOWED', detail: 'UNPAUSE is not an action of a REQUOTE case' });
      expect(await o({ options: [{ ...OPT.refundP6(), optionId: 'a b' }] })).toMatchObject({ code: 'OPTION_INVALID', detail: 'optionId malformed' });
      expect(await o({ options: [OPT.refundP6(), OPT.refundP6()] })).toMatchObject({ detail: 'duplicate optionId' });
      const u = { kind: 'UNDERPAYMENT', reason: 'CONFIRMED_BELOW_EXPECTED', amounts: under };
      expect(await o({ ...u, options: [OPT.accept(800n)] })).toMatchObject({ detail: 'ACCEPT_WITH_CONSENT must accept exactly the confirmed amount' });
      expect(await o({ ...u, options: [{ ...OPT.accept(900n), unit: 'CBS_MINOR' }] })).toMatchObject({ detail: 'ACCEPT_WITH_CONSENT must accept exactly the confirmed amount' });
      expect(await o({ ...u, options: [OPT.refundP6(901n)] })).toMatchObject({ detail: 'a refund may not exceed the confirmed amount' });
      expect(await o({ ...u, options: [{ ...OPT.refundP6(1n), legs: legs(1n).map((l) => ({ ...l, unit: 'CBS_MINOR' as const })) }] })).toMatchObject({ detail: 'a refund may not exceed the confirmed amount' });
      expect(await o({ ...u, options: [OPT.refundP6(900n)] })).toMatchObject({ kind: 'OK' });
      expect(await o({ ...u, subject: 'n', amounts: null })).toMatchObject({ detail: 'expected and confirmed amounts are required' });
      expect(await o({ ...u, subject: 'm', amounts: { ...under, confirmed: usdcUnits(1000n) } })).toMatchObject({ detail: 'confirmed amount does not make a UNDERPAYMENT' });
      expect(await o({ kind: 'OVERPAYMENT', reason: 'CONFIRMED_ABOVE_EXPECTED', subject: 'p', amounts: under, options: [OPT.refundP6()] })).toMatchObject({ detail: 'confirmed amount does not make a OVERPAYMENT' });
      expect(await o({ ...u, subject: 'q', amounts: { ...under, expected: 0n as never } })).toMatchObject({ code: 'INPUT_INVALID' });
      expect(await o({ ...u, subject: 'r', amounts: { ...under, confirmed: 0n as never } })).toMatchObject({ code: 'INPUT_INVALID' });
      expect(await o({ subject: 'dup', options: [OPT.refundP6()] })).toMatchObject({ kind: 'OK' });
      expect(await o({ subject: 'dup', options: [OPT.refundP6(400n)] })).toMatchObject({ detail: 'same kind and subject opened with different content' });
      void SUSPENSE;
    });
  });
});

type PaymentCap = { readonly unit: 'USDC_UNITS' | 'CBS_MINOR'; readonly amount: bigint } | null;

describe('verifyChain also checks prevHash and sequence (m10)', () => {
  const chain = (n: number): AuditEntry[] => {
    const out: AuditEntry[] = [];
    let prev = GENESIS_HASH;
    for (let i = 1; i <= n; i += 1) {
      const base = { seq: BigInt(i), at: 't', type: 'ACTION_APPLIED' as const, caseId: `c${i}`, action: 'REFUND', optionId: 'o', actors: ['a', 'b'], reason: 'r', evidenceRefs: ['e'], code: 'OK', refs: [], prevHash: prev };
      const e: AuditEntry = { ...base, hash: entryHash(base) };
      out.push(e);
      prev = e.hash;
    }
    return out;
  };
  const rehash = (es: AuditEntry[], keepPrev: boolean): AuditEntry[] => {
    const out: AuditEntry[] = [];
    let prev = GENESIS_HASH;
    for (const [i, e] of es.entries()) {
      const base = { ...e, seq: BigInt(i + 1), prevHash: keepPrev ? e.prevHash : prev };
      const x: AuditEntry = { ...base, hash: entryHash(base) };
      out.push(x);
      prev = x.hash;
    }
    return out;
  };
  it('detects a deleted entry whose successors were renumbered and re-hashed, keeping their old prevHash', () => {
    const es = chain(4);
    expect(verifyChain(es)).toBeNull();
    const cut = [es[0], es[2], es[3]] as AuditEntry[];
    expect(verifyChain(rehash(cut, true))).toBe(2n);
    expect(verifyChain(rehash(cut, false))).toBeNull();
  });
  it('detects a wrong first prevHash, a wrong sequence and a wrong hash', () => {
    const es = chain(2);
    const first = { ...(es[0] as AuditEntry), prevHash: 'f'.repeat(64) };
    expect(verifyChain(rehash([first, es[1] as AuditEntry], true))).toBe(1n);
    const gap = { ...(es[1] as AuditEntry), seq: 3n };
    const base = { ...gap, hash: undefined };
    expect(verifyChain([es[0] as AuditEntry, { ...gap, hash: entryHash(base as never) }])).toBe(2n);
    expect(verifyChain([es[0] as AuditEntry, { ...(es[1] as AuditEntry), hash: 'e'.repeat(64) }])).toBe(2n);
    expect(verifyChain([{ ...(es[0] as AuditEntry), seq: 2n }])).toBe(1n);
  });
});

describe('P14 reprice and decision keys', () => {
  it('stays a CaseOption union member', () => {
    const o: CaseOption = OPT.requote();
    expect(o.action).toBe('REQUOTE');
    expect(SETTLEMENT).toHaveLength(64);
  });
});
