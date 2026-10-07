/** JORCH adapters onto OPS and JPAYIN: closed unions mapped field by field; mismatches fail closed. Throwaway literals only. */
import { describe, expect, it } from 'vitest';
import { fromJPayIn, opsCasePort, opsDecisions, payInFromJPayIn } from '../../src/journey/orchestrator/index.js';
import { fixtureQuote, orderOf } from '../../src/journey/orchestrator/fakes.js';
import type { OpenCaseInput } from '../../src/ops/queue.js';
import type { CaseRecord } from '../../src/ops/types.js';
import type { PayInExpectation, PayInResult } from '../../src/journey/payin/types.js';
import { fiatCode, novaOwnerRef, paymentId } from '../../src/nova-ports/ids.js';
import type { NetworkId } from '../../src/nova-ports/ids.js';

const CLIENT = novaOwnerRef('client-1');
const PID = paymentId(`pay-${'a'.repeat(32)}`);
const NET = 'ARC' as unknown as NetworkId;
const order = orderOf(PID, CLIENT, fixtureQuote({
  payIn: { method: 'FIAT', currency: fiatCode('ZAR') }, payout: { method: 'STABLECOIN_WALLET', asset: 'USDC', network: NET, beneficiaryRef: 'ben-1' as never },
  payer: 1000n, recipient: 990n, arcAmount: 990n, expiresAtMs: 10n,
}));
const exp = { method: 'FIAT', paymentId: PID, clientUid: CLIENT } as unknown as PayInExpectation;

describe('opsCasePort', () => {
  const req = { kind: 'REQUOTE' as const, reason: 'RATE_EXPIRED', subject: 's', paymentId: PID, clientUid: CLIENT, evidenceRefs: [] };
  it('passes the server-built input and returns the case id', async () => {
    const seen: OpenCaseInput[] = [];
    const port = opsCasePort({ openCase: (i) => { seen.push(i); return Promise.resolve({ kind: 'OK', value: { caseId: 'c-9' } as CaseRecord, replayed: false }); } },
      (r) => ({ ...r, amounts: null, options: [] }));
    expect(await port.open(req)).toEqual({ caseId: 'c-9' });
    expect(seen[0]).toMatchObject({ kind: 'REQUOTE', reason: 'RATE_EXPIRED', options: [] });
  });
  it('a refused or ambiguous open is a null case id (still held)', async () => {
    const refused = opsCasePort({ openCase: () => Promise.resolve({ kind: 'REJECTED', code: 'INVALID_INPUT' as never, detail: 'x' }) }, (r) => ({ ...r, amounts: null, options: [] }));
    expect(await refused.open(req)).toEqual({ caseId: null });
    const amb = opsCasePort({ openCase: () => Promise.resolve({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' as never }) }, (r) => ({ ...r, amounts: null, options: [] }));
    expect(await amb.open(req)).toEqual({ caseId: null });
  });
});

describe('payInFromJPayIn', () => {
  it('maps every JPAYIN result kind', () => {
    expect(fromJPayIn({ kind: 'PENDING' })).toEqual({ kind: 'PENDING' });
    expect(fromJPayIn({ kind: 'EXPIRED' })).toEqual({ kind: 'EXPIRED' });
    expect(fromJPayIn({ kind: 'CONFIRMED', method: 'FIAT', amount: 1000n, evidenceRef: 'ev-1', consentRef: 'cs-1' })).toEqual({ kind: 'CONFIRMED', amount: 1000n, evidenceRef: 'ev-1' });
    expect(fromJPayIn({ kind: 'HELD', reason: 'CONSENT_MISSING', caseKind: 'QUARANTINE', caseId: 'c-1', caseCode: 'x' })).toEqual({ kind: 'HELD', reason: 'CONSENT_MISSING', caseId: 'c-1', caseKind: 'QUARANTINE' });
    expect(fromJPayIn({ kind: 'FAILED_CLOSED', code: 'NOT_CONFIGURED', detail: 'd' })).toMatchObject({ kind: 'FAILED_CLOSED' });
  });
  it('settles through the expectation built server-side for this payment', async () => {
    const got: PayInExpectation[] = [];
    const port = payInFromJPayIn({ method: 'FIAT', settle: (e) => { got.push(e); return Promise.resolve<PayInResult>({ kind: 'PENDING' }); } }, () => exp);
    expect(await port.settle(order, 1n)).toEqual({ kind: 'PENDING' });
    expect(got).toEqual([exp]);
  });
  it('fails closed on a wrong rail, a missing expectation, or an expectation of another payment or client', async () => {
    const never = { settle: () => Promise.reject(new Error('must not settle')) };
    expect(await payInFromJPayIn({ method: 'STABLECOIN', ...never }, () => exp).settle(order, 1n)).toMatchObject({ kind: 'FAILED_CLOSED' });
    expect(await payInFromJPayIn({ method: 'FIAT', ...never }, () => null).settle(order, 1n)).toMatchObject({ kind: 'FAILED_CLOSED' });
    const other = { ...exp, paymentId: paymentId(`pay-${'b'.repeat(32)}`) } as PayInExpectation;
    expect(await payInFromJPayIn({ method: 'FIAT', ...never }, () => other).settle(order, 1n)).toMatchObject({ kind: 'FAILED_CLOSED' });
    const otherClient = { ...exp, clientUid: 'client-2' } as PayInExpectation;
    expect(await payInFromJPayIn({ method: 'FIAT', ...never }, () => otherClient).settle(order, 1n)).toMatchObject({ kind: 'FAILED_CLOSED' });
  });
});

describe('opsDecisions', () => {
  it('reads the case back unchanged', async () => {
    const rec = { caseId: 'c-1' } as CaseRecord;
    const d = opsDecisions({ getCase: (id) => Promise.resolve(id === 'c-1' ? { kind: 'OK', value: rec, replayed: false } : { kind: 'REJECTED', code: 'NOT_FOUND', detail: 'x' }) });
    expect(await d.getCase('c-1')).toEqual({ kind: 'OK', value: rec, replayed: false });
    expect(await d.getCase('c-2')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
  });
});
