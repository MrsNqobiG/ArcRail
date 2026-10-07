import { describe, expect, it } from 'vitest';
import { cbsMinor, CBS_MINOR_MAX, usdcUnits } from '../../src/amounts/index.js';
import { lpDigestHex, novaAccountRef } from '../../src/nova-ports/ids.js';
import {
  ALLOWED_ACTIONS,
  CASE_KINDS,
  CONSENT_ACTIONS,
  NOT_SENT_PROOFS,
  OP_ACTIONS,
  REASONS,
  amountOk,
  debitTotal,
  deriveCaseId,
  deriveDecisionId,
  isRef,
  legsProblem,
  optionDigest,
  optionProblem,
} from '../../src/ops/types.js';
import type { CaseOption, Leg } from '../../src/ops/types.js';
import { CLIENT_ACC, EV, OPT, PAY, SETTLE, USDC, ZAR, legs, makeRig, open, openInput } from './ops-support.js';

describe('OPS closed sets', () => {
  it('has exactly these case kinds, actions, reasons and per-kind actions', () => {
    expect(CASE_KINDS).toEqual(['QUARANTINE', 'PAUSE', 'REQUOTE', 'UNMATCHED_FILL', 'FILL_TIMEOUT', 'CONSENT_MISSING', 'HISTORY_WRITE_FAILED', 'UNDERPAYMENT', 'OVERPAYMENT', 'LATE_PAYIN', 'STUCK_PAYOUT', 'RETURNED_PAYOUT', 'UNRESOLVED_SUBMIT']);
    expect(OP_ACTIONS).toEqual(['REQUOTE', 'ACCEPT_WITH_CONSENT', 'REFUND', 'RETRY_AS_NEW_PAYMENT', 'WRITE_OFF', 'RELEASE_QUARANTINE', 'UNPAUSE', 'ADOPT_FILL', 'REVERSE_FILL', 'CLOSE_HISTORY_GAP']);
    expect(CONSENT_ACTIONS).toEqual(['REQUOTE', 'ACCEPT_WITH_CONSENT', 'ADOPT_FILL']);
    expect(NOT_SENT_PROOFS).toEqual(['APPROVER_DENIAL', 'ABORT_ACCEPTED', 'NONCE_CONSUMED_ELSEWHERE', 'NONCE_RESOLVED', 'RECEIPT_STATUS_0_BOTH_SOURCES']);
    expect(REASONS).toEqual({
      QUARANTINE: ['SIGNAL_CONFLICT', 'UNKNOWN_EVENT', 'INVARIANT_FAILED', 'CONSENT_MISSING', 'AUTHENTICITY_FAILED', 'BOOKED_ENTRY_MISMATCH', 'SUB_UNIT_REMAINDER'],
      PAUSE: ['RAIL_DISAGREEMENT', 'RECON_DRIFT', 'INDEXER_STALL', 'MONITOR_NOT_ALL_CLEAR'],
      REQUOTE: ['RATE_EXPIRED', 'RATE_CHANGED'],
      UNMATCHED_FILL: ['FILL_AFTER_EXPIRY', 'FILL_MISPOSTED', 'FILL_TERMS_MISMATCH'],
      FILL_TIMEOUT: ['NO_FILL_BY_TIMEOUT'],
      CONSENT_MISSING: ['NO_CONSENT_RECORD', 'CONSENT_BINDING_MISMATCH', 'CONSENT_ALREADY_USED'],
      HISTORY_WRITE_FAILED: ['HISTORY_APPEND_FAILING_PAST_AGE'],
      UNDERPAYMENT: ['CONFIRMED_BELOW_EXPECTED'],
      OVERPAYMENT: ['CONFIRMED_ABOVE_EXPECTED'],
      LATE_PAYIN: ['PAYIN_AFTER_QUOTE_EXPIRY', 'PAYIN_AFTER_PAYMENT_CLOSED'],
      STUCK_PAYOUT: ['NO_TERMINAL_STATE', 'PARTNER_TIMEOUT'],
      RETURNED_PAYOUT: ['PARTNER_RETURNED', 'BENEFICIARY_REJECTED'],
      UNRESOLVED_SUBMIT: ['MARKER_SET_NO_EXTERNAL_REF', 'DFNS_TIMEOUT', 'DFNS_5XX', 'HASHLESS_FAILED'],
    });
    expect(ALLOWED_ACTIONS).toEqual({
      QUARANTINE: ['RELEASE_QUARANTINE', 'REFUND', 'WRITE_OFF'],
      PAUSE: ['UNPAUSE'],
      REQUOTE: ['REQUOTE', 'REFUND', 'WRITE_OFF'],
      UNMATCHED_FILL: ['ADOPT_FILL', 'REVERSE_FILL'],
      FILL_TIMEOUT: ['REQUOTE', 'REFUND', 'WRITE_OFF'],
      CONSENT_MISSING: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
      HISTORY_WRITE_FAILED: ['CLOSE_HISTORY_GAP'],
      UNDERPAYMENT: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
      OVERPAYMENT: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
      LATE_PAYIN: ['REQUOTE', 'ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
      STUCK_PAYOUT: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'],
      RETURNED_PAYOUT: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'],
      UNRESOLVED_SUBMIT: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'],
    });
    expect(NOT_SENT_PROOFS).not.toContain('EXTERNAL_ID_NOT_FOUND');
  });
});

describe('OPS ids and amounts', () => {
  it('derives deterministic ids', () => {
    expect(deriveCaseId('REQUOTE', 's1')).toBe(`case-${lpDigestHex(['ops-case', 'REQUOTE', 's1']).slice(0, 32)}`);
    expect(deriveCaseId('REQUOTE', 's1')).toMatch(/^case-[0-9a-f]{32}$/);
    expect(deriveCaseId('REQUOTE', 's1')).not.toBe(deriveCaseId('PAUSE', 's1'));
    expect(deriveCaseId('REQUOTE', 's1')).not.toBe(deriveCaseId('REQUOTE', 's2'));
    expect(deriveDecisionId('c', 'REFUND', 'o')).toBe(`dec-${lpDigestHex(['ops-decision', 'c', 'REFUND', 'o']).slice(0, 32)}`);
    expect(deriveDecisionId('c', 'REFUND', 'o')).not.toBe(deriveDecisionId('c', 'WRITE_OFF', 'o'));
    expect(deriveDecisionId('c', 'REFUND', 'o')).not.toBe(deriveDecisionId('c', 'REFUND', 'p'));
    expect(deriveDecisionId('c', 'REFUND', 'o')).not.toBe(deriveDecisionId('d', 'REFUND', 'o'));
  });
  it('checks refs and amounts', () => {
    expect(isRef('a')).toBe(true);
    expect(isRef('a'.repeat(255))).toBe(true);
    expect(isRef('a'.repeat(256))).toBe(false);
    expect(isRef('')).toBe(false);
    expect(isRef('a b')).toBe(false);
    expect(isRef(5 as unknown as string)).toBe(false);
    expect(amountOk('USDC_UNITS', 1n)).toBe(true);
    expect(amountOk('USDC_UNITS', 0n)).toBe(false);
    expect(amountOk('USDC_UNITS', -1n)).toBe(false);
    expect(amountOk('USDC_UNITS', CBS_MINOR_MAX + 1n)).toBe(true);
    expect(amountOk('CBS_MINOR', CBS_MINOR_MAX)).toBe(true);
    expect(amountOk('CBS_MINOR', CBS_MINOR_MAX + 1n)).toBe(false);
    expect(amountOk('CBS_MINOR', 5 as unknown as bigint)).toBe(false);
  });
});

describe('OPS legs and options', () => {
  const leg = (over: Partial<Leg> = {}): Leg => ({ account: CLIENT_ACC, side: 'DEBIT', asset: USDC, unit: 'USDC_UNITS', amount: usdcUnits(5n), ...over });
  it('accepts balanced legs and totals the debits', () => {
    expect(legsProblem(legs(7n), null, null)).toBeNull();
    expect(legsProblem(legs(7n), USDC, 'USDC_UNITS')).toBeNull();
    expect(debitTotal(legs(7n))).toBe(7n);
    expect(debitTotal([...legs(7n), ...legs(3n)])).toBe(10n);
  });
  it('refuses every malformed or unbalanced shape', () => {
    const credit = leg({ side: 'CREDIT', account: SETTLE });
    expect(legsProblem([], null, null)).toBe('at least two legs');
    expect(legsProblem([leg()], null, null)).toBe('at least two legs');
    expect(legsProblem('x' as unknown as Leg[], null, null)).toBe('at least two legs');
    expect(legsProblem([leg(), leg({ side: 'CREDIT', amount: usdcUnits(6n), account: SETTLE })], null, null)).toBe('legs are unbalanced');
    expect(legsProblem([leg({ account: '' as never }), credit], null, null)).toBe('leg account or asset malformed');
    expect(legsProblem([leg({ asset: '' as never }), credit], null, null)).toBe('leg account or asset malformed');
    expect(legsProblem([leg({ side: 'X' as never }), credit], null, null)).toBe('leg side malformed');
    expect(legsProblem([leg(), leg({ side: 'CREDIT', asset: ZAR })], null, null)).toBe('legs mix assets or units');
    expect(legsProblem([leg(), leg({ side: 'CREDIT', unit: 'CBS_MINOR', amount: cbsMinor(5n) })], null, null)).toBe('legs mix assets or units');
    expect(legsProblem([leg(), credit], ZAR, null)).toBe('legs mix assets or units');
    expect(legsProblem([leg(), credit], null, 'CBS_MINOR')).toBe('legs mix assets or units');
    expect(legsProblem([leg({ amount: 0n as never }), leg({ side: 'CREDIT', amount: 0n as never })], null, null)).toBe('leg amount must be a positive bigint');
    expect(legsProblem([leg({ unit: 'X' as never }), leg({ side: 'CREDIT', unit: 'X' as never })], null, null)).toBe('leg amount must be a positive bigint');
    expect(legsProblem([leg({ amount: 5 as never }), credit], null, null)).toBe('leg amount must be a positive bigint');
  });
  it('validates each option kind', () => {
    expect(optionProblem(OPT.requote())).toBeNull();
    expect(optionProblem(OPT.requote(900n, 900n))).toBeNull();
    expect(optionProblem(OPT.requote(900n, 901n))).toBe('REQUOTE_EXCEEDS_RESERVATION');
    expect(optionProblem({ ...OPT.requote(), reserved: 0n as never })).toBe('REQUOTE amounts must be positive bigints');
    expect(optionProblem({ ...OPT.requote(), requoted: 0n as never })).toBe('REQUOTE amounts must be positive bigints');
    expect(optionProblem({ ...OPT.requote(), unit: 'X' as never })).toBe('REQUOTE amounts must be positive bigints');
    expect(optionProblem({ ...OPT.requote(), legs: [] })).toBe('P14 at least two legs');
    expect(optionProblem({ ...OPT.requote(), asset: ZAR })).toBe('P14 legs mix assets or units');
    expect(optionProblem({ ...OPT.requote(), unit: 'CBS_MINOR', reserved: cbsMinor(9n), requoted: cbsMinor(8n) })).toBe('P14 legs mix assets or units');
    expect(optionProblem(OPT.accept())).toBeNull();
    expect(optionProblem({ ...OPT.accept(), acceptedAmount: 0n as never })).toBe('acceptedAmount must be a positive bigint');
    expect(optionProblem({ ...OPT.accept(), unit: 'X' as never })).toBe('acceptedAmount must be a positive bigint');
    expect(optionProblem(OPT.refundP6())).toBeNull();
    expect(optionProblem(OPT.refundP13())).toBeNull();
    expect(optionProblem({ ...OPT.refundP6(), template: 'P15_WRITE_OFF' as never })).toBe('REFUND template must be P6 or P13_PAYIN_REFUND');
    expect(optionProblem({ ...OPT.refundP6(), legs: [] })).toBe('P6 at least two legs');
    expect(optionProblem({ ...OPT.refundP13(), legs: [] })).toBe('P13_PAYIN_REFUND at least two legs');
    expect(optionProblem(OPT.writeOff())).toBeNull();
    expect(optionProblem({ ...OPT.writeOff(), amount: 0n as never })).toBe('WRITE_OFF amount must be a positive bigint');
    expect(optionProblem({ ...OPT.writeOff(), unit: 'X' as never })).toBe('WRITE_OFF amount must be a positive bigint');
    expect(optionProblem({ ...OPT.writeOff(), creditAccount: '' as never })).toBe('WRITE_OFF accounts malformed');
    expect(optionProblem({ ...OPT.writeOff(), asset: '' as never })).toBe('WRITE_OFF accounts malformed');
    expect(optionProblem(OPT.retry())).toBeNull();
    expect(optionProblem(OPT.release())).toBeNull();
    expect(optionProblem(OPT.unpause())).toBeNull();
    expect(optionProblem({ ...OPT.retry(), optionId: 'a b' })).toBe('optionId malformed');
  });
  it('digests the exact option: any field change changes the digest', () => {
    const base = (o: CaseOption) => optionDigest(o);
    const all = [OPT.requote(), OPT.accept(), OPT.refundP6(), OPT.writeOff(), OPT.retry(), OPT.release(), OPT.unpause()];
    expect(new Set(all.map(base)).size).toBe(all.length);
    expect(base(OPT.requote())).toBe(base(OPT.requote()));
    const changed: CaseOption[] = [
      { ...OPT.requote(), optionId: 'x' },
      { ...OPT.requote(), reserved: usdcUnits(1001n) },
      { ...OPT.requote(), requoted: usdcUnits(901n) },
      { ...OPT.requote(), asset: ZAR },
      { ...OPT.requote(), legs: legs(101n) },
      { ...OPT.accept(), acceptedAmount: usdcUnits(901n) },
      { ...OPT.accept(), unit: 'CBS_MINOR' },
      { ...OPT.refundP6(), template: 'P13_PAYIN_REFUND' },
      { ...OPT.refundP6(), legs: legs(501n) },
      { ...OPT.refundP6(), legs: legs(500n, SETTLE, CLIENT_ACC) },
      { ...OPT.writeOff(), amount: cbsMinor(71n) },
      { ...OPT.writeOff(), asset: USDC },
      { ...OPT.writeOff(), creditAccount: novaAccountRef('other') },
      { ...OPT.writeOff(), unit: 'USDC_UNITS', amount: usdcUnits(70n) },
    ];
    const origs = [OPT.requote(), OPT.requote(), OPT.requote(), OPT.requote(), OPT.requote(), OPT.accept(), OPT.accept(), OPT.refundP6(), OPT.refundP6(), OPT.refundP6(), OPT.writeOff(), OPT.writeOff(), OPT.writeOff(), OPT.writeOff()];
    changed.forEach((c, i) => expect(base(c), `change ${i}`).not.toBe(base(origs[i] as CaseOption)));
  });
});

describe.each(['A', 'B'] as const)('OPS openCase (fakes %s)', (v) => {
  it('opens a case with a closed reason, stores it and audits the opening', async () => {
    const rig = makeRig(v);
    const c = await open(rig);
    expect(c).toMatchObject({ kind: 'REQUOTE', reason: 'RATE_EXPIRED', subject: 'quote-1', paymentId: PAY, status: 'OPEN', version: 1n, pending: null, outcome: null, evidenceRefs: EV });
    expect(c.caseId).toBe(deriveCaseId('REQUOTE', 'quote-1'));
    expect(c.options.map((o) => o.optionId)).toEqual(['o-requote', 'o-refund', 'o-writeoff']);
    expect(c.options.map((o) => o.digest)).toEqual(c.options.map((o) => optionDigest(o)));
    expect(c.openedAt).toMatch(/^2026-10-07T/);
    const open1 = await rig.queue.listOpen();
    expect(open1.kind === 'OK' && open1.value.map((x) => x.caseId)).toEqual([c.caseId]);
    expect(await rig.queue.getCase(c.caseId)).toMatchObject({ kind: 'OK', value: { caseId: c.caseId } });
    const log = await rig.audit.entries();
    expect(log).toHaveLength(1);
    expect(log?.[0]).toMatchObject({ type: 'CASE_OPENED', caseId: c.caseId, action: null, optionId: null, actors: [], reason: 'REQUOTE:RATE_EXPIRED', evidenceRefs: EV, code: 'OK' });
  });

  it('opens one case of every kind with each of its reasons', async () => {
    const rig = makeRig(v);
    let n = 0;
    for (const kind of CASE_KINDS) {
      for (const reason of REASONS[kind]) {
        n += 1;
        const amounts = kind === 'UNDERPAYMENT' ? { unit: 'USDC_UNITS' as const, expected: usdcUnits(10n), confirmed: usdcUnits(9n) } : kind === 'OVERPAYMENT' ? { unit: 'USDC_UNITS' as const, expected: usdcUnits(10n), confirmed: usdcUnits(11n) } : null;
        const wo = amounts === null ? OPT.writeOff() : { ...OPT.writeOff(1n), unit: 'USDC_UNITS' as const, amount: usdcUnits(1n), asset: USDC };
        const pool: CaseOption[] = [wo, OPT.unpause(), OPT.adopt(), OPT.reverse(), OPT.closeHistory()];
        const options = pool.filter((o) => ALLOWED_ACTIONS[kind].includes(o.action) && (o.action !== 'WRITE_OFF' || kind !== 'PAUSE'));
        const bookedEntryRef = kind === 'UNMATCHED_FILL' ? 'booked-1' : null;
        const r = await rig.queue.openCase(openInput({ kind, reason, subject: `s${n}`, amounts, bookedEntryRef, options }));
        expect(r, `${kind}/${reason}`).toMatchObject({ kind: 'OK', replayed: false });
      }
    }
  });

  it('is idempotent on the same input and refuses a different input for the same kind and subject', async () => {
    const rig = makeRig(v);
    const c = await open(rig);
    const again = await rig.queue.openCase(openInput());
    expect(again).toMatchObject({ kind: 'OK', replayed: true, value: { caseId: c.caseId, openedAt: c.openedAt } });
    expect(await rig.audit.entries()).toHaveLength(1);
    const variants = [
      openInput({ reason: 'RATE_CHANGED' }),
      openInput({ paymentId: `pay-${'b'.repeat(32)}` }),
      openInput({ clientUid: 'other' }),
      openInput({ evidenceRefs: ['other-evidence'] }),
      openInput({ options: [OPT.requote(), OPT.refundP6(600n), OPT.writeOff()] }),
    ];
    for (const x of variants) expect(await rig.queue.openCase(x)).toMatchObject({ kind: 'REJECTED', code: 'CASE_CONFLICT' });
  });

  it('refuses every bad input and writes nothing', async () => {
    const rig = makeRig(v);
    const under = { unit: 'USDC_UNITS' as const, expected: usdcUnits(10n), confirmed: usdcUnits(9n) };
    const cases: [Partial<ReturnType<typeof openInput>>, string][] = [
      [{ kind: 'NOPE' as never }, 'KIND_MISMATCH'],
      [{ reason: 'MADE_UP' }, 'REASON_INVALID'],
      [{ reason: 'NONCE_HOLD' }, 'REASON_INVALID'],
      [{ subject: '' }, 'INPUT_INVALID'],
      [{ subject: 'a b' }, 'INPUT_INVALID'],
      [{ clientUid: '' }, 'INPUT_INVALID'],
      [{ paymentId: 'pay-short' }, 'INPUT_INVALID'],
      [{ paymentId: 5 as never }, 'INPUT_INVALID'],
      [{ evidenceRefs: [] }, 'EVIDENCE_MISSING'],
      [{ evidenceRefs: 'x' as never }, 'EVIDENCE_MISSING'],
      [{ evidenceRefs: ['a b'] }, 'EVIDENCE_MISSING'],
      [{ amounts: under }, 'INPUT_INVALID'],
      [{ kind: 'UNDERPAYMENT', reason: 'CONFIRMED_BELOW_EXPECTED', amounts: null }, 'INPUT_INVALID'],
      [{ kind: 'UNDERPAYMENT', reason: 'CONFIRMED_BELOW_EXPECTED', amounts: { ...under, expected: 0n as never } }, 'INPUT_INVALID'],
      [{ kind: 'UNDERPAYMENT', reason: 'CONFIRMED_BELOW_EXPECTED', amounts: { ...under, confirmed: 0n as never } }, 'INPUT_INVALID'],
      [{ kind: 'UNDERPAYMENT', reason: 'CONFIRMED_BELOW_EXPECTED', amounts: { ...under, confirmed: usdcUnits(10n) } }, 'KIND_MISMATCH'],
      [{ kind: 'UNDERPAYMENT', reason: 'CONFIRMED_BELOW_EXPECTED', amounts: { ...under, confirmed: usdcUnits(11n) } }, 'KIND_MISMATCH'],
      [{ kind: 'OVERPAYMENT', reason: 'CONFIRMED_ABOVE_EXPECTED', amounts: { ...under, confirmed: usdcUnits(10n) } }, 'KIND_MISMATCH'],
      [{ kind: 'OVERPAYMENT', reason: 'CONFIRMED_ABOVE_EXPECTED', amounts: under }, 'KIND_MISMATCH'],
      [{ options: [] }, 'OPTION_INVALID'],
      [{ options: 'x' as never }, 'OPTION_INVALID'],
      [{ options: [OPT.retry()] }, 'ACTION_NOT_ALLOWED'],
      [{ options: [OPT.writeOff(), OPT.writeOff()] }, 'OPTION_INVALID'],
      [{ options: [{ ...OPT.writeOff(), amount: 0n as never }] }, 'OPTION_INVALID'],
    ];
    for (const [over, code] of cases) expect(await rig.queue.openCase(openInput(over)), JSON.stringify(Object.keys(over))).toMatchObject({ kind: 'REJECTED', code });
    expect(await rig.audit.entries()).toHaveLength(0);
    const l = await rig.queue.listOpen();
    expect(l.kind === 'OK' && l.value).toEqual([]);
  });

  it('accepts only the confirmed amount, and refunds no more than it', async () => {
    const rig = makeRig(v);
    const over = { kind: 'OVERPAYMENT' as const, reason: 'CONFIRMED_ABOVE_EXPECTED', amounts: { unit: 'USDC_UNITS' as const, expected: usdcUnits(10n), confirmed: usdcUnits(12n) } };
    expect(await rig.queue.openCase(openInput({ ...over, options: [OPT.accept(11n)] }))).toMatchObject({ kind: 'REJECTED', code: 'OPTION_INVALID' });
    expect(await rig.queue.openCase(openInput({ ...over, options: [{ ...OPT.accept(12n), unit: 'CBS_MINOR', acceptedAmount: cbsMinor(12n) }] }))).toMatchObject({ kind: 'REJECTED', code: 'OPTION_INVALID' });
    expect(await rig.queue.openCase(openInput({ ...over, options: [OPT.refundP13(13n)] }))).toMatchObject({ kind: 'REJECTED', code: 'OPTION_INVALID' });
    expect(await rig.queue.openCase(openInput({ ...over, options: [{ ...OPT.refundP13(5n), legs: legs(5n).map((l): Leg => ({ ...l, unit: 'CBS_MINOR', amount: cbsMinor(5n) })) }] }))).toMatchObject({ kind: 'REJECTED', code: 'OPTION_INVALID' });
    expect(await rig.queue.openCase(openInput({ ...over, options: [OPT.accept(12n), OPT.refundP13(12n)] }))).toMatchObject({ kind: 'OK' });
  });

  it('fails closed when the store or the audit is unavailable', async () => {
    const rig = makeRig(v);
    const ambiguousCases = { ...rig.deps.cases, get: async () => ({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' }) } as never;
    const q = new (rig.queue.constructor as new (d: unknown) => typeof rig.queue)({ ...rig.deps, cases: ambiguousCases });
    expect(await q.openCase(openInput())).toMatchObject({ kind: 'AMBIGUOUS' });
    const racing = { get: rig.cases.get.bind(rig.cases), listOpen: rig.cases.listOpen.bind(rig.cases), put: async () => ({ kind: 'REJECTED', code: 'VERSION_CONFLICT', detail: '' }) } as never;
    const q2 = new (rig.queue.constructor as new (d: unknown) => typeof rig.queue)({ ...rig.deps, cases: racing });
    expect(await q2.openCase(openInput())).toMatchObject({ kind: 'REJECTED', code: 'CASE_CONFLICT' });
    const flaky = { get: rig.cases.get.bind(rig.cases), listOpen: rig.cases.listOpen.bind(rig.cases), put: async () => ({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' }) } as never;
    const q3 = new (rig.queue.constructor as new (d: unknown) => typeof rig.queue)({ ...rig.deps, cases: flaky });
    expect(await q3.openCase(openInput({ subject: 'other' }))).toMatchObject({ kind: 'AMBIGUOUS' });
  });
});
