/**
 * CBS contract tests: the in-memory CBS stub (src/cbs/stub.ts) against
 * CONTRACT v3 §1.4 (result model), §3 (operations, binding, balance) and the
 * slice's inbound path T1 → screen → standing → T2/T8/unid, also driven
 * through the posting translator with injected faults (exactly-once).
 */
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cbsMinor } from '../../src/amounts/index.js';
import { deriveKey, subjectRef, type IdempotencyKey } from '../../src/cbs/keys.js';
import type { CallMeta, CbsMinorTag, CbsPort, GlRole, JournalLeg, JournalRefs } from '../../src/cbs/port.js';
import { REJECTED_CODES } from '../../src/cbs/result.js';
import { CASE_REASONS, CbsStub, createCbsStub, type StubOp } from '../../src/cbs/stub.js';
import { buildLegs, createPostingTranslator, type TemplateInput } from '../../src/cbs/translator.js';
import type { AccountRef } from '../../src/registry/index.js';

const UNIT: CbsMinorTag = 'CBS_MINOR:USDC:6';
const NOW = '2026-10-06T10:00:00.000Z';
const ACCT = 'acct-1' as AccountRef;
const OTHER = 'acct-2' as AccountRef;
const ADDR = `0x${'a1'.repeat(20)}`;
const ADDR2 = `0x${'b2'.repeat(20)}`;
const SENDER = `0x${'c3'.repeat(20)}`;
const TX = `0x${'ab'.repeat(32)}` as const;
const META: CallMeta = { callId: 'call-1' };
const SUBJ = subjectRef(['in', '5042002', TX, '0']);

let seq = 0;
/** A fresh, distinct idempotency key. */
const key = (): IdempotencyKey => deriveKey({ name: 'K.move', k: ['arc1', 'tre', `m${(seq += 1)}`, 'move', '0'] });

function mk(config: Partial<ConstructorParameters<typeof CbsStub>[0]> = {}): CbsStub {
  const s = createCbsStub({ unit: UNIT, now: () => NOW, ...config });
  s.openAccount(ACCT);
  s.openAccount(OTHER);
  s.issueAddress(ADDR, ACCT);
  s.issueAddress(ADDR2, OTHER);
  return s;
}

const G2HOT: GlRole = { role: 'G2', wallet: 'hot' };
const G5IN: GlRole = { role: 'G5', sub: 'inbound' };
const G5OUT: GlRole = { role: 'G5', sub: 'outbound' };
const G4U: GlRole = { role: 'G4', sub: 'unidentified' };
const G4D: GlRole = { role: 'G4', sub: 'dust' };
const G1A: GlRole = { role: 'G1', accountRef: ACCT };
const G7: GlRole = { role: 'G7' };
const G3: GlRole = { role: 'G3' };
const G6: GlRole = { role: 'G6' };

const amt = (v: bigint | string, unit: string = UNIT) => ({ unit, value: v.toString() }) as JournalLeg['amount'];
const leg = (g: GlRole, side: 'DR' | 'CR', v: bigint | string, unit?: string): JournalLeg => ({ glOrAccountRef: g, side, amount: amt(v, unit) });
const pair = (dr: GlRole, cr: GlRole, v: bigint): JournalLeg[] => [leg(dr, 'DR', v), leg(cr, 'CR', v)];
const T = (x: Record<string, unknown>): TemplateInput => ({ unit: UNIT, fee: cbsMinor(0n), ...x }) as unknown as TemplateInput;

type JReq = Parameters<CbsPort['postJournal']>[0];
const jreq = (legs: readonly JournalLeg[], refs: Partial<JournalRefs> = {}, k: IdempotencyKey = key()): JReq => ({
  key: k,
  valueDate: '2026-10-06',
  legs,
  narrative: 'inbound',
  refs: { subjectRef: SUBJ, ...refs },
});
const t1 = (v: bigint, k?: IdempotencyKey): JReq => jreq(pair(G2HOT, G5IN, v), {}, k);
const t2 = (v: bigint, address: string = ADDR, acct: GlRole = G1A, k?: IdempotencyKey): JReq => jreq(pair(G5IN, acct, v), { address }, k);

const ok = (value: unknown) => ({ kind: 'OK', value });
const rej = (code: string) => ({ kind: 'REJECTED', code });

afterEach(() => {
  vi.useRealTimers();
});

describe('construction and set-up', () => {
  it.each(['CBS_MINOR:USDC:6', 'CBS_MINOR:USDC:0', 'CBS_MINOR:USDC:18', 'CBS_MINOR:ZAR.x_1-2:2'])('accepts unit %s and takes the asset code from it', (unit) => {
    const s = createCbsStub({ unit: unit as CbsMinorTag });
    expect(s.unit).toBe(unit);
    expect(s.assetCode).toBe(unit.split(':')[1]);
    expect(s).toBeInstanceOf(CbsStub);
  });

  it.each(['USDC_UNITS', 'CBS_MINOR:USDC:19', 'CBS_MINOR::6', 'CBS_MINOR:USDC:06', 'CBS_MINOR:USDC', 'xCBS_MINOR:USDC:6', 'CBS_MINOR:USDC:6 ', 7])('refuses unit %j', (unit) => {
    expect(() => createCbsStub({ unit: unit as CbsMinorTag })).toThrow(/CBS_MINOR:<assetCode>:<p>/);
  });

  it('defaults: ISO clock and CLEAR verdict', async () => {
    const s = createCbsStub({ unit: UNIT });
    s.openAccount(ACCT);
    const r = await s.getAccountStanding({ accountRef: ACCT, asset: 'USDC' }, META);
    expect(r.kind === 'OK' && r.value.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const v = await s.screen({ key: key(), subject: { kind: 'ADDRESS', value: SENDER }, role: 'sender', direction: 'inbound', amount: amt(1n), context: SUBJ }, META);
    expect(v).toEqual(ok({ verdict: 'CLEAR', screeningRef: 'scr-1' }));
  });

  it('refuses bad set-up calls', () => {
    const s = mk();
    expect(() => s.openAccount(ACCT)).toThrow(/already open/);
    expect(() => s.openAccount('' as AccountRef)).toThrow(/non-empty/);
    expect(() => s.setAccountStatus('nope' as AccountRef, { frozen: true })).toThrow(/unknown account/);
    expect(() => s.issueAddress(`0x${'d4'.repeat(20)}`, 'nope' as AccountRef)).toThrow(/unknown account/);
    expect(() => s.issueAddress(ADDR.toUpperCase().replace('0X', '0x'), OTHER)).toThrow(/already issued/);
    expect(() => s.issueAddress(`0x${'0'.repeat(40)}`, ACCT)).toThrow(/not 0x0/);
    expect(() => s.issueAddress('0x1234', ACCT)).toThrow(/20 bytes/);
    expect(() => s.balanceOf({ role: 'G9' } as unknown as GlRole)).toThrow(/malformed/);
  });

  it('listIssuedAddresses returns the issuance record, lowercase', async () => {
    const s = createCbsStub({ unit: UNIT });
    s.openAccount(ACCT);
    s.issueAddress(`0x${'AB'.repeat(20)}`, ACCT);
    await expect(s.listIssuedAddresses(META)).resolves.toEqual(ok({ issued: [{ address: `0x${'ab'.repeat(20)}`, accountRef: ACCT }] }));
  });
});

describe('postJournal: slice templates, balances, idempotency (CONTRACT §1.4, §3, §5.1)', () => {
  it('T1 then T2: balances move as CONTRACT §5.7 says, journals numbered from 1', async () => {
    const s = mk();
    await expect(s.postJournal(t1(1500n), META)).resolves.toEqual(ok({ journalId: 'jrn-1', postedAt: NOW }));
    expect([s.balanceOf(G2HOT), s.balanceOf(G5IN)]).toEqual([1500n, 1500n]);
    await expect(s.postJournal(t2(1500n), META)).resolves.toEqual(ok({ journalId: 'jrn-2', postedAt: NOW }));
    expect([s.balanceOf(G2HOT), s.balanceOf(G5IN), s.balanceOf(G1A)]).toEqual([1500n, 0n, 1500n]);
    expect(s.journalSeq()).toBe(2n);
  });

  it.each([
    ['T8', G7],
    ['unid', G4U],
  ] as const)('%s moves G5.inbound to its credit account', async (_n, cr) => {
    const s = mk();
    await s.postJournal(t1(10n), META);
    await expect(s.postJournal(jreq(pair(G5IN, cr, 4n)), META)).resolves.toMatchObject({ kind: 'OK' });
    expect([s.balanceOf(G5IN), s.balanceOf(cr)]).toEqual([6n, 4n]);
  });

  it.each(['gas', 'collection'] as const)('T1 into G2.%s is accepted', async (wallet) => {
    const s = mk();
    await expect(s.postJournal(jreq(pair({ role: 'G2', wallet }, G5IN, 3n)), META)).resolves.toMatchObject({ kind: 'OK' });
    expect(s.balanceOf({ role: 'G2', wallet })).toBe(3n);
  });

  it('accepts the legs in any order (credit first)', async () => {
    const s = mk();
    await expect(s.postJournal(jreq([leg(G5IN, 'CR', 7n), leg(G2HOT, 'DR', 7n)]), META)).resolves.toMatchObject({ kind: 'OK' });
    await expect(s.postJournal(jreq([leg(G1A, 'CR', 7n), leg(G5IN, 'DR', 7n)], { address: ADDR }), META)).resolves.toMatchObject({ kind: 'OK' });
    expect(s.balanceOf(G1A)).toBe(7n);
  });

  it('same key and same payload → the recorded OK again, with no second effect', async () => {
    const s = mk();
    const req = t1(5n);
    const first = await s.postJournal(req, META);
    const again = await s.postJournal(structuredClone(req), { callId: 'call-2' });
    expect(again).toEqual(first);
    expect(s.journals()).toHaveLength(1);
    expect(s.balanceOf(G2HOT)).toBe(5n);
  });

  it('same key, different payload (amount, narrative, refs, legs) → CONFLICT{key}, with no effect', async () => {
    const s = mk();
    const req = t1(5n);
    await s.postJournal(req, META);
    for (const changed of [t1(6n, req.key), { ...req, narrative: 'x' }, { ...req, valueDate: '2026-10-07' }, { ...req, refs: { ...req.refs, txHash: TX } }]) {
      await expect(s.postJournal(changed, META)).resolves.toEqual({ kind: 'CONFLICT', key: req.key });
    }
    expect(s.journals()).toHaveLength(1);
  });

  it('a key used by another operation → CONFLICT', async () => {
    const s = mk();
    const req = t1(5n);
    await s.postJournal(req, META);
    await expect(s.createCase({ key: req.key, reason: 'PAUSE', subjectRef: SUBJ, refs: { subjectRef: SUBJ }, evidenceRefs: [] }, META)).resolves.toEqual({
      kind: 'CONFLICT',
      key: req.key,
    });
    expect(s.cases()).toHaveLength(0);
  });

  it('a REJECTED is recorded under its key: the same payload gets the same REJECTED even after the cause is gone', async () => {
    const s = mk();
    const req = t2(5n); // G5.inbound is empty → INSUFFICIENT_FUNDS
    await expect(s.postJournal(req, META)).resolves.toEqual(rej('INSUFFICIENT_FUNDS'));
    await s.postJournal(t1(5n), META);
    await expect(s.postJournal(req, META)).resolves.toEqual(rej('INSUFFICIENT_FUNDS'));
    await expect(s.postJournal({ ...req, narrative: 'other' }, META)).resolves.toEqual({ kind: 'CONFLICT', key: req.key });
    await expect(s.getResultByKey({ key: req.key }, META)).resolves.toEqual(ok({ state: 'REJECTED', op: 'postJournal', code: 'INSUFFICIENT_FUNDS' }));
    expect(s.balanceOf(G1A)).toBe(0n);
  });

  it('getResultByKey: APPLIED with the result, NOT_FOUND, and INVALID for a malformed key', async () => {
    const s = mk();
    const req = t1(5n);
    await s.postJournal(req, META);
    await expect(s.getResultByKey({ key: req.key }, META)).resolves.toEqual(
      ok({ state: 'APPLIED', op: 'postJournal', result: { journalId: 'jrn-1', postedAt: NOW } }),
    );
    await expect(s.getResultByKey({ key: key() }, META)).resolves.toEqual(ok({ state: 'NOT_FOUND', op: '' }));
    await expect(s.getResultByKey({ key: 'arc1-xyz' as IdempotencyKey }, META)).resolves.toEqual(rej('INVALID'));
  });

  it('a malformed key or a missing callId → INVALID, and nothing is recorded under the key', async () => {
    const s = mk();
    await expect(s.postJournal({ ...t1(5n), key: 'arc1-nope' as IdempotencyKey }, META)).resolves.toEqual(rej('INVALID'));
    const req = t1(5n);
    for (const meta of [{ callId: '' }, {}, null, { callId: 7 }]) {
      await expect(s.postJournal(req, meta as unknown as CallMeta)).resolves.toEqual(rej('INVALID'));
    }
    await expect(s.getResultByKey({ key: req.key }, META)).resolves.toEqual(ok({ state: 'NOT_FOUND', op: '' }));
    await expect(s.postJournal(req, META)).resolves.toMatchObject({ kind: 'OK' });
  });

  it('returned journals and records are copies: callers cannot rewrite the CBS record', async () => {
    const s = mk();
    const req = t1(5n);
    await s.postJournal(req, META);
    (req.legs[0] as { amount: { value: string } }).amount.value = '999';
    const j = s.journals();
    (j[0]?.legs[0] as { amount: { value: string } }).amount.value = '1';
    expect(s.journals()[0]?.legs[0]?.amount.value).toBe('5');
  });
});

describe('postJournal: REJECTED codes (CONTRACT §1.4, §3)', () => {
  const funded = async (): Promise<CbsStub> => {
    const s = mk();
    await s.postJournal(t1(100n), META);
    return s;
  };

  const invalid: [string, (r: JReq) => unknown][] = [
    ['valueDate format', (r) => ({ ...r, valueDate: '2026/10/06' })],
    ['valueDate type', (r) => ({ ...r, valueDate: 20261006 })],
    ['narrative type', (r) => ({ ...r, narrative: null })],
    ['refs missing', (r) => ({ ...r, refs: undefined })],
    ['refs not an object', (r) => ({ ...r, refs: 'x' })],
    ['subjectRef missing', (r) => ({ ...r, refs: {} })],
    ['subjectRef not JSON', (r) => ({ ...r, refs: { subjectRef: '[in' } })],
    ['subjectRef not an array', (r) => ({ ...r, refs: { subjectRef: '"in"' } })],
    ['subjectRef empty array', (r) => ({ ...r, refs: { subjectRef: '[]' } })],
    ['subjectRef non-string element', (r) => ({ ...r, refs: { subjectRef: '["rail",0]' } })],
    ['subjectRef not canonical', (r) => ({ ...r, refs: { subjectRef: '["rail", "0"]' } })],
    ['subjectRef not a string', (r) => ({ ...r, refs: { subjectRef: ['rail', '0'] } })],
    ['caseId', (r) => ({ ...r, refs: { ...r.refs, caseId: 'a b' } })],
    ['dispositionSeq', (r) => ({ ...r, refs: { ...r.refs, dispositionSeq: '01' } })],
    ['instructionId', (r) => ({ ...r, refs: { ...r.refs, instructionId: '' } })],
    ['address', (r) => ({ ...r, refs: { ...r.refs, address: '0x12' } })],
    ['address 0x0', (r) => ({ ...r, refs: { ...r.refs, address: `0x${'0'.repeat(40)}` } })],
    ['txHash', (r) => ({ ...r, refs: { ...r.refs, txHash: TX.toUpperCase() } })],
    ['assignRef not an object', (r) => ({ ...r, refs: { ...r.refs, assignRef: 'c:1' } })],
    ['assignRef caseId', (r) => ({ ...r, refs: { ...r.refs, assignRef: { caseId: '', dispositionSeq: '1' } } })],
    ['assignRef dispositionSeq', (r) => ({ ...r, refs: { ...r.refs, assignRef: { caseId: 'c', dispositionSeq: 'x' } } })],
    ['legs not an array', (r) => ({ ...r, legs: {} })],
    ['legs empty', (r) => ({ ...r, legs: [] })],
    ['leg not an object', (r) => ({ ...r, legs: [null, ...r.legs] })],
    ['leg side', (r) => ({ ...r, legs: [{ ...r.legs[0], side: 'DEBIT' }, r.legs[1]] })],
    ['leg account missing', (r) => ({ ...r, legs: [{ ...r.legs[0], glOrAccountRef: undefined }, r.legs[1]] })],
    ['G1 without accountRef', (r) => ({ ...r, legs: [r.legs[0], { ...r.legs[1], glOrAccountRef: { role: 'G1' } }] })],
    ['G1 with empty accountRef', (r) => ({ ...r, legs: [r.legs[0], { ...r.legs[1], glOrAccountRef: { role: 'G1', accountRef: '' } }] })],
    ['G2 bad wallet', (r) => ({ ...r, legs: [{ ...r.legs[0], glOrAccountRef: { role: 'G2', wallet: 'cold' } }, r.legs[1]] })],
    ['G2 wallet not a string', (r) => ({ ...r, legs: [{ ...r.legs[0], glOrAccountRef: { role: 'G2', wallet: 1 } }, r.legs[1]] })],
    ['G4 bad sub', (r) => ({ ...r, legs: [r.legs[0], { ...r.legs[1], glOrAccountRef: { role: 'G4', sub: 'other' } }] })],
    ['G5 bad sub', (r) => ({ ...r, legs: [r.legs[0], { ...r.legs[1], glOrAccountRef: { role: 'G5', sub: 'in' } }] })],
    ['unknown role', (r) => ({ ...r, legs: [r.legs[0], { ...r.legs[1], glOrAccountRef: { role: 'G8' } }] })],
    ['amount missing', (r) => ({ ...r, legs: [{ ...r.legs[0], amount: undefined }, r.legs[1]] })],
    ['amount a JSON number', (r) => ({ ...r, legs: [{ ...r.legs[0], amount: { unit: UNIT, value: 5 } }, r.legs[1]] })],
    ['amount leading zero', (r) => ({ ...r, legs: [{ ...r.legs[0], amount: { unit: UNIT, value: '05' } }, r.legs[1]] })],
    ['amount negative', (r) => ({ ...r, legs: [{ ...r.legs[0], amount: { unit: UNIT, value: '-5' } }, r.legs[1]] })],
    ['unit not a string', (r) => ({ ...r, legs: [{ ...r.legs[0], amount: { unit: 6, value: '5' } }, r.legs[1]] })],
  ];
  it.each(invalid)('INVALID: %s', async (_n, mutate) => {
    const s = await funded();
    await expect(s.postJournal(mutate(t1(5n)) as JReq, META)).resolves.toEqual(rej('INVALID'));
    expect(s.journals()).toHaveLength(1);
  });

  it('accepts every optional ref in its grammar', async () => {
    const s = await funded();
    const refs = { caseId: 'c-1', dispositionSeq: '3', instructionId: 'cr-1', txHash: TX, assignRef: { caseId: 'c-1', dispositionSeq: '0' }, address: SENDER.toUpperCase().replace('0X', '0x') };
    await expect(s.postJournal(jreq(pair(G2HOT, G5IN, 1n), refs), META)).resolves.toMatchObject({ kind: 'OK' });
    await expect(s.listJournals({ fromCutoff: '1', toCutoff: '2' }, META)).resolves.toMatchObject(ok({ journals: [{ refs: { subjectRef: SUBJ, ...refs } }] }));
  });

  it.each(['CBS_MINOR:USDC:2', 'CBS_MINOR:EURC:6', 'USDC_UNITS', 'NATIVE_WEI'])('UNIT_MISMATCH: a leg in %s (CONTRACT §1.1)', async (unit) => {
    const s = await funded();
    await expect(s.postJournal(jreq([leg(G2HOT, 'DR', 5n, unit), leg(G5IN, 'CR', 5n, unit)]), META)).resolves.toEqual(rej('UNIT_MISMATCH'));
  });

  it('ZERO_AMOUNT: a zero-amount leg is never accepted', async () => {
    const s = await funded();
    await expect(s.postJournal(jreq(pair(G2HOT, G5IN, 0n)), META)).resolves.toEqual(rej('ZERO_AMOUNT'));
    await expect(s.postJournal(jreq([...pair(G2HOT, G5IN, 3n), leg(G7, 'CR', 0n)]), META)).resolves.toEqual(rej('ZERO_AMOUNT'));
  });

  it.each([
    ['DR > CR', [leg(G2HOT, 'DR', 5n), leg(G5IN, 'CR', 4n)]],
    ['CR > DR', [leg(G2HOT, 'DR', 4n), leg(G5IN, 'CR', 5n)]],
    ['a single leg', [leg(G2HOT, 'DR', 5n)]],
    ['two debits', [leg(G2HOT, 'DR', 5n), leg(G5IN, 'DR', 5n)]],
    ['three legs, off by one', [leg(G5IN, 'DR', 5n), leg(G7, 'CR', 2n), leg(G4U, 'CR', 2n)]],
  ])('UNBALANCED: %s', async (_n, legs) => {
    const s = await funded();
    await expect(s.postJournal(jreq(legs), META)).resolves.toEqual(rej('UNBALANCED'));
    expect(s.balanceOf(G5IN)).toBe(100n);
  });

  it('T2 without refs.address → INVALID (a required ref is missing)', async () => {
    const s = await funded();
    await expect(s.postJournal(jreq(pair(G5IN, G1A, 5n)), META)).resolves.toEqual(rej('INVALID'));
  });

  it('T2 binding (CF-16): the G1 account must be the one the CBS issued refs.address to', async () => {
    const s = await funded();
    await expect(s.postJournal(t2(5n, ADDR2), META)).resolves.toEqual(rej('BINDING_MISMATCH'));
    await expect(s.postJournal(t2(5n, SENDER), META)).resolves.toEqual(rej('BINDING_MISMATCH'));
    await expect(s.postJournal(t2(5n, ADDR, { role: 'G1', accountRef: OTHER }), META)).resolves.toEqual(rej('BINDING_MISMATCH'));
    await expect(s.postJournal(t2(5n, ADDR, { role: 'G1', accountRef: 'ghost' as AccountRef }), META)).resolves.toEqual(rej('BINDING_MISMATCH'));
    expect(s.balanceOf(G1A)).toBe(0n);
    await expect(s.postJournal(t2(5n, ADDR.toUpperCase().replace('0X', '0x')), META)).resolves.toMatchObject({ kind: 'OK' });
    await expect(s.postJournal(t2(5n, ADDR2, { role: 'G1', accountRef: OTHER }), META)).resolves.toMatchObject({ kind: 'OK' });
  });

  it.each([
    ['closed', { closed: true }, 'ACCOUNT_CLOSED'],
    ['closed and frozen', { closed: true, frozen: true }, 'ACCOUNT_CLOSED'],
    ['frozen', { frozen: true }, 'ACCOUNT_BLOCKED'],
    ['inactive', { active: false }, 'ACCOUNT_BLOCKED'],
    ['KYC invalid', { kycValid: false }, 'ACCOUNT_BLOCKED'],
  ] as const)('T2 to a %s account → %s', async (_n, status, code) => {
    const s = await funded();
    s.setAccountStatus(ACCT, status);
    await expect(s.postJournal(t2(5n), META)).resolves.toEqual(rej(code));
  });

  it.each([
    ['T11 (DR G4.unidentified · CR G1)', pair(G4U, G1A, 5n), { assignRef: { caseId: 'c', dispositionSeq: '1' } }],
    ['T3 fallback (DR G1 · CR G5.outbound)', pair(G1A, G5OUT, 5n), { instructionId: 'ins-1' }],
    ['T5 fallback (DR G5.outbound · CR G1)', pair(G5OUT, G1A, 5n), { instructionId: 'ins-1' }],
    ['a G1 leg in a three-leg journal', [leg(G5IN, 'DR', 5n), leg(G1A, 'CR', 3n), leg(G7, 'CR', 2n)], { address: ADDR }],
  ])('BINDING_MISMATCH: %s has no CBS record to bind to in the stub', async (_n, legs, refs) => {
    const s = await funded();
    await expect(s.postJournal(jreq(legs, refs), META)).resolves.toEqual(rej('BINDING_MISMATCH'));
  });

  it.each([
    ['T4 fallback', [leg(G5OUT, 'DR', 5n), leg(G2HOT, 'CR', 4n), leg(G6, 'CR', 1n)]],
    ['T6', pair({ role: 'G2', wallet: 'gas' }, G2HOT, 5n)],
    ['T9', pair(G5IN, G2HOT, 5n)],
    ['T10', pair(G4U, G2HOT, 5n)],
    ['gas batch', pair(G3, G2HOT, 5n)],
    ['dust batch', pair(G2HOT, G4D, 5n)],
    ['G2 into G5.outbound', pair(G2HOT, G5OUT, 5n)],
  ])('NOT_PERMITTED: %s is outside the testnet slice', async (_n, legs) => {
    const s = await funded();
    await expect(s.postJournal(jreq(legs), META)).resolves.toEqual(rej('NOT_PERMITTED'));
  });

  it('INSUFFICIENT_FUNDS: no normal-side balance may go below 0; exactly the balance is accepted', async () => {
    const s = mk();
    await expect(s.postJournal(jreq(pair(G5IN, G7, 1n)), META)).resolves.toEqual(rej('INSUFFICIENT_FUNDS'));
    await s.postJournal(t1(10n), META);
    await expect(s.postJournal(jreq(pair(G5IN, G4U, 11n)), META)).resolves.toEqual(rej('INSUFFICIENT_FUNDS'));
    await expect(s.postJournal(jreq(pair(G5IN, G4U, 10n)), META)).resolves.toMatchObject({ kind: 'OK' });
    expect([s.balanceOf(G5IN), s.balanceOf(G4U)]).toEqual([0n, 10n]);
  });
});

describe('listJournals and getBalancesAsOf (CONTRACT §3, P10)', () => {
  async function twoJournals(): Promise<{ s: CbsStub; k1: IdempotencyKey; k2: IdempotencyKey }> {
    const s = mk();
    const r1 = t1(9n);
    const r2 = t2(9n);
    await s.postJournal(r1, META);
    await s.postJournal(r2, META);
    return { s, k1: r1.key, k2: r2.key };
  }

  it('returns fromCutoff < seq ≤ toCutoff, with legs and refs as posted', async () => {
    const { s, k1, k2 } = await twoJournals();
    const all = await s.listJournals({ fromCutoff: '0', toCutoff: '2' }, META);
    expect(all).toEqual(
      ok({
        journals: [
          { journalId: 'jrn-1', key: k1, legs: pair(G2HOT, G5IN, 9n), refs: { subjectRef: SUBJ }, postedAt: NOW },
          { journalId: 'jrn-2', key: k2, legs: pair(G5IN, G1A, 9n), refs: { subjectRef: SUBJ, address: ADDR }, postedAt: NOW },
        ],
      }),
    );
    await expect(s.listJournals({ fromCutoff: '1', toCutoff: '2' }, META)).resolves.toMatchObject(ok({ journals: [{ journalId: 'jrn-2' }] }));
    await expect(s.listJournals({ fromCutoff: '0', toCutoff: '1' }, META)).resolves.toMatchObject(ok({ journals: [{ journalId: 'jrn-1' }] }));
    await expect(s.listJournals({ fromCutoff: '1', toCutoff: '1' }, META)).resolves.toEqual(ok({ journals: [] }));
    await expect(s.listJournals({ fromCutoff: '2', toCutoff: '9' }, META)).resolves.toEqual(ok({ journals: [] }));
  });

  it('filters by keys', async () => {
    const { s, k2 } = await twoJournals();
    await expect(s.listJournals({ fromCutoff: '0', toCutoff: '2', keys: [k2] }, META)).resolves.toMatchObject(ok({ journals: [{ key: k2 }] }));
    await expect(s.listJournals({ fromCutoff: '0', toCutoff: '2', keys: [] }, META)).resolves.toEqual(ok({ journals: [] }));
    await expect(s.listJournals({ fromCutoff: '0', toCutoff: '2', keys: [key()] }, META)).resolves.toEqual(ok({ journals: [] }));
  });

  it.each([
    [{ fromCutoff: '2', toCutoff: '1' }],
    [{ fromCutoff: '01', toCutoff: '2' }],
    [{ fromCutoff: '0', toCutoff: 'x' }],
    [{ fromCutoff: '0', toCutoff: '2', keys: ['bad'] }],
    [{ fromCutoff: '0', toCutoff: '2', keys: 'bad' }],
  ])('INVALID request %j', async (req) => {
    const { s } = await twoJournals();
    await expect(s.listJournals(req as Parameters<CbsPort['listJournals']>[0], META)).resolves.toEqual(rej('INVALID'));
  });

  it('getBalancesAsOf sums journals with seq ≤ cutoff, normal side, in the CBS unit', async () => {
    const { s } = await twoJournals();
    const accounts = [G2HOT, G5IN, G1A, G7];
    const at = async (cutoff: string) => s.getBalancesAsOf({ accounts, cutoff }, META);
    const view = (values: string[], applied: string) =>
      ok({ balances: accounts.map((account, i) => ({ account, amount: { unit: UNIT, value: values[i] } })), cutoffApplied: applied });
    await expect(at('0')).resolves.toEqual(view(['0', '0', '0', '0'], '0'));
    await expect(at('1')).resolves.toEqual(view(['9', '9', '0', '0'], '1'));
    await expect(at('2')).resolves.toEqual(view(['9', '0', '9', '0'], '2'));
    await expect(at('99')).resolves.toEqual(view(['9', '0', '9', '0'], '2'));
  });

  it.each([
    [{ accounts: [G2HOT], cutoff: '-1' }],
    [{ accounts: [{ role: 'G2', wallet: 'cold' }], cutoff: '1' }],
    [{ accounts: 'G2', cutoff: '1' }],
  ])('getBalancesAsOf INVALID %j', async (req) => {
    const { s } = await twoJournals();
    await expect(s.getBalancesAsOf(req as Parameters<CbsPort['getBalancesAsOf']>[0], META)).resolves.toEqual(rej('INVALID'));
  });
});

describe('screen, createCase, submitMonitoringEvent, getAccountStanding (CONTRACT §3)', () => {
  type SReq = Parameters<CbsPort['screen']>[0];
  const sreq = (x: Partial<Record<keyof SReq, unknown>> = {}): SReq =>
    ({ key: key(), subject: { kind: 'ADDRESS', value: SENDER }, role: 'sender', direction: 'inbound', amount: amt(5n), context: SUBJ, ...x }) as SReq;

  it('screen: configured verdicts (address case-insensitive), CCTP_MINT always REVIEW, refs numbered, records kept', async () => {
    const s = mk();
    s.setScreeningVerdict(SENDER.toUpperCase().replace('0X', '0x'), 'HIT');
    s.setScreeningVerdict(ADDR2, 'REVIEW');
    await expect(s.screen(sreq(), META)).resolves.toEqual(ok({ verdict: 'HIT', screeningRef: 'scr-1' }));
    await expect(s.screen(sreq({ subject: { kind: 'ADDRESS', value: ADDR2 }, role: 'destination', direction: 'outbound' }), META)).resolves.toEqual(
      ok({ verdict: 'REVIEW', screeningRef: 'scr-2' }),
    );
    s.setScreeningVerdict('0x0', 'CLEAR');
    await expect(s.screen(sreq({ subject: { kind: 'CCTP_MINT', value: '0x0' } }), META)).resolves.toEqual(ok({ verdict: 'REVIEW', screeningRef: 'scr-3' }));
    await expect(s.screen(sreq({ subject: { kind: 'ADDRESS', value: ADDR }, amount: amt(5n, 'NATIVE_WEI') }), META)).resolves.toEqual(
      ok({ verdict: 'CLEAR', screeningRef: 'scr-4' }),
    );
    await expect(s.screen(sreq({ amount: amt(0n, 'USDC_UNITS') }), META)).resolves.toMatchObject(ok({ screeningRef: 'scr-5' }));
    expect(s.screenings().map((r) => [r.screeningRef, r.verdict])).toEqual([
      ['scr-1', 'HIT'],
      ['scr-2', 'REVIEW'],
      ['scr-3', 'REVIEW'],
      ['scr-4', 'CLEAR'],
      ['scr-5', 'HIT'],
    ]);
    expect(s.screenings()[0]?.request).toMatchObject({ subject: { kind: 'ADDRESS', value: SENDER } });
  });

  it('screen: a replay returns the same screeningRef and verdict, even after the verdict changes', async () => {
    const s = mk({ defaultVerdict: 'HIT' });
    const req = sreq();
    await expect(s.screen(req, META)).resolves.toEqual(ok({ verdict: 'HIT', screeningRef: 'scr-1' }));
    s.setScreeningVerdict(SENDER, 'CLEAR');
    await expect(s.screen(req, META)).resolves.toEqual(ok({ verdict: 'HIT', screeningRef: 'scr-1' }));
    await expect(s.screen({ ...req, role: 'destination' }, META)).resolves.toEqual({ kind: 'CONFLICT', key: req.key });
  });

  it.each([
    ['subject not an object', { subject: 'x' }],
    ['subject kind', { subject: { kind: 'EMAIL', value: SENDER } }],
    ['ADDRESS value', { subject: { kind: 'ADDRESS', value: '0x12' } }],
    ['ADDRESS 0x0', { subject: { kind: 'ADDRESS', value: `0x${'0'.repeat(40)}` } }],
    ['CCTP_MINT empty value', { subject: { kind: 'CCTP_MINT', value: '' } }],
    ['role', { role: 'payer' }],
    ['direction', { direction: 'internal' }],
    ['context', { context: 'in' }],
    ['amount', { amount: { unit: UNIT, value: '1.5' } }],
  ])('screen INVALID: %s', async (_n, x) => {
    const s = mk();
    await expect(s.screen(sreq(x), META)).resolves.toEqual(rej('INVALID'));
    expect(s.screenings()).toHaveLength(0);
  });

  it('screen UNIT_MISMATCH: another CBS unit tag', async () => {
    const s = mk();
    await expect(s.screen(sreq({ amount: amt(5n, 'CBS_MINOR:USDC:2') }), META)).resolves.toEqual(rej('UNIT_MISMATCH'));
  });

  type CReq = Parameters<CbsPort['createCase']>[0];
  const creq = (x: Partial<Record<keyof CReq, unknown>> = {}): CReq =>
    ({ key: key(), reason: 'SCREENING_HIT', subjectRef: SUBJ, refs: { subjectRef: SUBJ }, evidenceRefs: ['scr-1'], ...x }) as CReq;

  it('createCase: every reason of the closed list, caseIds numbered, replay → same caseId', async () => {
    const s = mk();
    expect(CASE_REASONS).toHaveLength(21);
    for (const [i, reason] of CASE_REASONS.entries()) {
      await expect(s.createCase(creq({ reason, evidenceRefs: [] }), META)).resolves.toEqual(ok({ caseId: `case-${i + 1}` }));
    }
    const req = creq();
    const first = await s.createCase(req, META);
    await expect(s.createCase(req, META)).resolves.toEqual(first);
    expect(s.cases()).toHaveLength(22);
    expect(s.cases()[21]).toMatchObject({ key: req.key, caseId: 'case-22', reason: 'SCREENING_HIT', request: { evidenceRefs: ['scr-1'] } });
  });

  it.each([
    ['reason', { reason: 'BORED' }],
    ['subjectRef', { subjectRef: 'x' }],
    ['evidenceRefs not an array', { evidenceRefs: 'scr-1' }],
    ['evidenceRefs element', { evidenceRefs: ['ok', 3] }],
    ['refs', { refs: { subjectRef: SUBJ, txHash: '0x1' } }],
  ])('createCase INVALID: %s', async (_n, x) => {
    const s = mk();
    await expect(s.createCase(creq(x), META)).resolves.toEqual(rej('INVALID'));
    expect(s.cases()).toHaveLength(0);
  });

  type MReq = Parameters<CbsPort['submitMonitoringEvent']>[0];
  const mreq = (x: Partial<Record<keyof MReq, unknown>> = {}): MReq =>
    ({ key: key(), direction: 'inbound', class: 'inbound-customer', accountRef: ACCT, amount: amt(5n), chainId: '5042002', txHash: TX, counterpartyAddress: SENDER, at: NOW, ...x }) as MReq;

  it('submitMonitoringEvent: OK {} for every direction, with or without accountRef; recorded once', async () => {
    const s = mk();
    for (const direction of ['inbound', 'outbound', 'internal']) await expect(s.submitMonitoringEvent(mreq({ direction }), META)).resolves.toEqual(ok({}));
    const { accountRef: _a, ...noAccount } = mreq();
    await expect(s.submitMonitoringEvent(noAccount as MReq, META)).resolves.toEqual(ok({}));
    await expect(s.submitMonitoringEvent(mreq({ amount: amt(5n, 'USDC_UNITS') }), META)).resolves.toEqual(ok({}));
    expect(s.monitoringEvents()).toHaveLength(5);
    expect(s.monitoringEvents()[0]?.request).toMatchObject({ direction: 'inbound', chainId: '5042002' });
  });

  it.each([
    ['direction', { direction: 'sideways' }, 'INVALID'],
    ['class', { class: '' }, 'INVALID'],
    ['at', { at: '' }, 'INVALID'],
    ['txHash', { txHash: '0x12' }, 'INVALID'],
    ['counterpartyAddress', { counterpartyAddress: 'abc' }, 'INVALID'],
    ['counterpartyAddress 0x0', { counterpartyAddress: `0x${'0'.repeat(40)}` }, 'INVALID'],
    ['chainId mainnet', { chainId: '5042' }, 'CHAIN_NOT_ENABLED'],
    ['accountRef unknown', { accountRef: 'ghost' }, 'UNKNOWN_ACCOUNT'],
    ['amount', { amount: { unit: UNIT } }, 'INVALID'],
    ['amount unit', { amount: amt(5n, 'CBS_MINOR:USDC:2') }, 'UNIT_MISMATCH'],
  ])('submitMonitoringEvent %s → %s', async (_n, x, code) => {
    const s = mk();
    await expect(s.submitMonitoringEvent(mreq(x), META)).resolves.toEqual(rej(code));
    expect(s.monitoringEvents()).toHaveLength(0);
  });

  it('getAccountStanding: the CBS record, asOf from the CBS clock; unknown/closed/other asset are REJECTED', async () => {
    const s = mk();
    await expect(s.getAccountStanding({ accountRef: ACCT, asset: 'USDC' }, META)).resolves.toEqual(ok({ active: true, kycValid: true, frozen: false, asOf: NOW }));
    s.setAccountStatus(ACCT, { frozen: true, kycValid: false, active: false });
    await expect(s.getAccountStanding({ accountRef: ACCT, asset: 'USDC' }, META)).resolves.toEqual(ok({ active: false, kycValid: false, frozen: true, asOf: NOW }));
    await expect(s.getAccountStanding({ accountRef: ACCT, asset: 'EURC' }, META)).resolves.toEqual(rej('UNIT_MISMATCH'));
    await expect(s.getAccountStanding({ accountRef: 'ghost' as AccountRef, asset: 'USDC' }, META)).resolves.toEqual(rej('UNKNOWN_ACCOUNT'));
    s.setAccountStatus(OTHER, { closed: true });
    await expect(s.getAccountStanding({ accountRef: OTHER, asset: 'USDC' }, META)).resolves.toEqual(rej('ACCOUNT_CLOSED'));
    const opened = createCbsStub({ unit: UNIT, now: () => NOW });
    opened.openAccount(ACCT, { frozen: true });
    await expect(opened.getAccountStanding({ accountRef: ACCT, asset: 'USDC' }, META)).resolves.toEqual(ok({ active: true, kycValid: true, frozen: true, asOf: NOW }));
  });
});

describe('fault injection (AMBIGUOUS, timeouts, unknown codes) and the call log', () => {
  it('AMBIGUOUS before the effect: nothing applied, NOT_FOUND, and the same key then applies once', async () => {
    const s = mk();
    s.injectFault({ op: 'postJournal', kind: 'AMBIGUOUS' });
    const req = t1(5n);
    await expect(s.postJournal(req, META)).resolves.toEqual({ kind: 'AMBIGUOUS', detail: 'injected transport error' });
    expect(s.journals()).toHaveLength(0);
    await expect(s.getResultByKey({ key: req.key }, META)).resolves.toEqual(ok({ state: 'NOT_FOUND', op: '' }));
    await expect(s.postJournal(req, META)).resolves.toEqual(ok({ journalId: 'jrn-1', postedAt: NOW }));
  });

  it('AMBIGUOUS after the effect: applied, APPLIED, and a replay returns the original OK', async () => {
    const s = mk();
    s.injectFault({ op: 'postJournal', kind: 'AMBIGUOUS', applied: true });
    const req = t1(5n);
    await expect(s.postJournal(req, META)).resolves.toMatchObject({ kind: 'AMBIGUOUS' });
    expect(s.journals()).toHaveLength(1);
    await expect(s.getResultByKey({ key: req.key }, META)).resolves.toMatchObject(ok({ state: 'APPLIED' }));
    await expect(s.postJournal(req, META)).resolves.toEqual(ok({ journalId: 'jrn-1', postedAt: NOW }));
    expect(s.balanceOf(G2HOT)).toBe(5n);
  });

  it('TIMEOUT: AMBIGUOUS("timeout") only after delayMs, applied or not', async () => {
    vi.useFakeTimers();
    const s = mk();
    s.injectFault({ op: 'postJournal', kind: 'TIMEOUT', delayMs: 50, applied: true });
    let settled = false;
    const p = s.postJournal(t1(5n), META).then((r) => {
      settled = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(49);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toEqual({ kind: 'AMBIGUOUS', detail: 'timeout' });
    expect(s.journals()).toHaveLength(1);
    s.injectFault({ op: 'screen', kind: 'TIMEOUT' });
    const q = s.screen({ key: key(), subject: { kind: 'ADDRESS', value: SENDER }, role: 'sender', direction: 'inbound', amount: amt(1n), context: SUBJ }, META);
    await vi.advanceTimersByTimeAsync(0);
    await expect(q).resolves.toEqual({ kind: 'AMBIGUOUS', detail: 'timeout' });
    expect(s.screenings()).toHaveLength(0);
  });

  it('UNKNOWN_CODE: a REJECTED code outside the closed list, with no effect and nothing recorded', async () => {
    const s = mk();
    s.injectFault({ op: 'postJournal', kind: 'UNKNOWN_CODE', applied: true });
    const req = t1(5n);
    const r = await s.postJournal(req, META);
    expect(r.kind).toBe('REJECTED');
    expect(REJECTED_CODES as readonly string[]).not.toContain((r as { code: string }).code);
    expect(s.journals()).toHaveLength(0);
    await expect(s.getResultByKey({ key: req.key }, META)).resolves.toEqual(ok({ state: 'NOT_FOUND', op: '' }));
  });

  it('times, key and op filters', async () => {
    const s = mk();
    const req = t1(5n);
    s.injectFault({ op: 'postJournal', kind: 'AMBIGUOUS', key: req.key, times: 2 });
    s.injectFault({ op: 'screen', kind: 'AMBIGUOUS' });
    await expect(s.postJournal(t1(1n), META)).resolves.toMatchObject({ kind: 'OK' });
    await expect(s.postJournal(req, META)).resolves.toMatchObject({ kind: 'AMBIGUOUS' });
    await expect(s.postJournal(req, META)).resolves.toMatchObject({ kind: 'AMBIGUOUS' });
    await expect(s.postJournal(req, META)).resolves.toMatchObject({ kind: 'OK' });
  });

  it('read operations take faults too', async () => {
    const s = mk();
    const reads: [StubOp, () => Promise<unknown>][] = [
      ['getResultByKey', () => s.getResultByKey({ key: key() }, META)],
      ['getAccountStanding', () => s.getAccountStanding({ accountRef: ACCT, asset: 'USDC' }, META)],
      ['listJournals', () => s.listJournals({ fromCutoff: '0', toCutoff: '0' }, META)],
      ['getBalancesAsOf', () => s.getBalancesAsOf({ accounts: [], cutoff: '0' }, META)],
      ['listIssuedAddresses', () => s.listIssuedAddresses(META)],
    ];
    for (const [op, call] of reads) {
      s.injectFault({ op, kind: 'AMBIGUOUS' });
      await expect(call()).resolves.toMatchObject({ kind: 'AMBIGUOUS' });
      await expect(call()).resolves.toMatchObject({ kind: 'OK' });
    }
  });

  it('logs every call with its op, callId and key (P8.4)', async () => {
    const s = mk();
    const req = t1(5n);
    await s.postJournal(req, META);
    await s.getAccountStanding({ accountRef: ACCT, asset: 'USDC' }, { callId: 'c2' });
    await expect(s.placeHold({ key: key(), instructionId: 'i' }, { callId: 'c3' })).rejects.toThrow(/outside the testnet slice/);
    expect(s.calls()).toEqual([
      { op: 'postJournal', callId: 'call-1', key: req.key },
      { op: 'getAccountStanding', callId: 'c2' },
      { op: 'placeHold', callId: 'c3' },
    ]);
  });

  it('every operation outside the slice rejects (a transport error, so AMBIGUOUS to the translator)', async () => {
    const s = mk();
    const k = key();
    const outside: [string, () => Promise<unknown>][] = [
      ['placeHold', () => s.placeHold({ key: k, instructionId: 'i' }, META)],
      ['releaseHold', () => s.releaseHold({ key: k, holdId: 'h' }, META)],
      ['settleHold', () => s.settleHold({ key: k, holdId: 'h', instructionId: 'i', txHash: TX, legs: [] }, META)],
      ['getTravelRuleOriginator', () => s.getTravelRuleOriginator({ subjectRef: SUBJ }, META)],
      ['requestApproval', () => s.requestApproval({ key: k, instructionId: 'i', payloadHash: 'h', summary: 's' }, META)],
      ['getApproval', () => s.getApproval({ approvalId: 'a' }, META)],
      ['fileReportData', () => s.fileReportData({ key: k, reportType: 'r', subjectRef: SUBJ, dataRefs: [] }, META)],
      ['replayEvents', () => s.replayEvents({}, null as unknown as CallMeta)],
    ];
    for (const [op, call] of outside) await expect(call()).rejects.toThrow(`CBS stub: ${op} is outside the testnet slice`);
    expect(s.calls().map((c) => c.op)).toEqual(outside.map(([op]) => op));
    expect(s.calls().at(-1)?.callId).toBeUndefined();
  });
});

describe('the inbound slice through the posting translator (exactly-once, CONTRACT §1.4, §5.3, §5.7)', () => {
  const inKey = (step: 'recv' | 'avail' | 'unid', logIndex: string, attempt = '0') =>
    deriveKey({ name: `K.${step}`, k: ['arc1', 'in', '5042002', TX, logIndex, step, attempt] } as Parameters<typeof deriveKey>[0]);
  const post = (legs: readonly JournalLeg[], k: IdempotencyKey, refs: Partial<JournalRefs> = {}, logIndex = '0'): JReq => ({
    key: k,
    valueDate: '2026-10-06',
    legs,
    narrative: 'arc inbound',
    refs: { subjectRef: subjectRef(['in', '5042002', TX, logIndex]), ...refs },
  });
  const identity = (s: CbsStub): boolean =>
    s.balanceOf(G2HOT) + s.balanceOf({ role: 'G2', wallet: 'collection' }) + s.balanceOf(G3) ===
    s.balanceOf(G1A) + s.balanceOf({ role: 'G1', accountRef: OTHER }) + s.balanceOf(G4U) + s.balanceOf(G4D) + s.balanceOf(G5IN) + s.balanceOf(G5OUT) + s.balanceOf(G6) + s.balanceOf(G7);

  it('detect → T1 → screen CLEAR → standing eligible → T2: customer credited once, G5 back to 0', async () => {
    const s = mk();
    const tr = createPostingTranslator(s);
    const m = cbsMinor(1_000_000n);
    const collection = { role: 'G2', wallet: 'collection' } as const;
    const r1 = await tr.postJournal(post(buildLegs(T({ template: 'T1', amount: m, wallet: 'collection' })), inKey('recv', '0')), META);
    expect(r1).toEqual(ok({ journalId: 'jrn-1', postedAt: NOW }));
    const scr = await s.screen(
      { key: deriveKey({ name: 'K.scr', k: ['arc1', 'scr', SUBJ, 'sender', '0', '0'] }), subject: { kind: 'ADDRESS', value: SENDER }, role: 'sender', direction: 'inbound', amount: amt(m), context: SUBJ },
      META,
    );
    expect(scr).toMatchObject(ok({ verdict: 'CLEAR' }));
    await expect(s.getAccountStanding({ accountRef: ACCT, asset: 'USDC' }, META)).resolves.toMatchObject(ok({ active: true, kycValid: true, frozen: false }));
    const r2 = await tr.postJournal(post(buildLegs(T({ template: 'T2', amount: m, accountRef: ACCT })), inKey('avail', '0'), { address: ADDR }), META);
    expect(r2).toEqual(ok({ journalId: 'jrn-2', postedAt: NOW }));
    await expect(
      s.submitMonitoringEvent({ key: deriveKey({ name: 'K.mon', k: ['arc1', 'mon', SUBJ, '0'] }), direction: 'inbound', class: 'inbound-customer', accountRef: ACCT, amount: amt(m), chainId: '5042002', txHash: TX, counterpartyAddress: SENDER, at: NOW }, META),
    ).resolves.toEqual(ok({}));
    expect([s.balanceOf(collection), s.balanceOf(G5IN), s.balanceOf(G1A)]).toEqual([1_000_000n, 0n, 1_000_000n]);
    expect(identity(s)).toBe(true);
  });

  it('a T2 whose response is lost after it applied is resolved to the same OK, and the customer is credited once', async () => {
    const s = mk();
    const tr = createPostingTranslator(s);
    await tr.postJournal(post(buildLegs(T({ template: 'T1', amount: cbsMinor(50n), wallet: 'hot' })), inKey('recv', '0')), META);
    s.injectFault({ op: 'postJournal', kind: 'TIMEOUT', applied: true });
    const r = await tr.postJournal(post(buildLegs(T({ template: 'T2', amount: cbsMinor(50n), accountRef: ACCT })), inKey('avail', '0'), { address: ADDR }), META);
    expect(r).toEqual(ok({ journalId: 'jrn-2', postedAt: NOW }));
    expect(s.journals()).toHaveLength(2);
    expect(s.balanceOf(G1A)).toBe(50n);
    expect(s.calls().map((c) => c.op)).toEqual(['postJournal', 'postJournal', 'getResultByKey', 'postJournal']);
    expect(new Set(s.calls().slice(1).map((c) => c.callId)).size).toBe(3);
  });

  it('a lost request (not applied) resolves through NOT_FOUND to one final call', async () => {
    const s = mk();
    s.injectFault({ op: 'postJournal', kind: 'AMBIGUOUS' });
    const tr = createPostingTranslator(s);
    await expect(tr.postJournal(post(buildLegs(T({ template: 'T1', amount: cbsMinor(7n), wallet: 'hot' })), inKey('recv', '1'), {}, '1'), META)).resolves.toMatchObject({ kind: 'OK' });
    expect(s.journals()).toHaveLength(1);
  });

  it('getResultByKey unavailable → UNRESOLVED (the caller PAUSEs), and the CBS holds at most one journal', async () => {
    const s = mk();
    s.injectFault({ op: 'postJournal', kind: 'AMBIGUOUS', applied: true });
    s.injectFault({ op: 'getResultByKey', kind: 'AMBIGUOUS' });
    const tr = createPostingTranslator(s);
    await expect(tr.postJournal(post(buildLegs(T({ template: 'T1', amount: cbsMinor(7n), wallet: 'hot' })), inKey('recv', '0')), META)).resolves.toEqual({ kind: 'UNRESOLVED' });
    expect(s.journals()).toHaveLength(1);
  });

  it('an unknown REJECTED code is never taken as a refusal: it is resolved by key', async () => {
    const s = mk();
    s.injectFault({ op: 'postJournal', kind: 'UNKNOWN_CODE' });
    const tr = createPostingTranslator(s);
    await expect(tr.postJournal(post(buildLegs(T({ template: 'T1', amount: cbsMinor(7n), wallet: 'hot' })), inKey('recv', '0')), META)).resolves.toMatchObject({ kind: 'OK' });
  });

  it('BINDING_MISMATCH comes back as a definite REJECTED (the caller PAUSEs) and moves nothing', async () => {
    const s = mk();
    const tr = createPostingTranslator(s);
    await tr.postJournal(post(buildLegs(T({ template: 'T1', amount: cbsMinor(9n), wallet: 'hot' })), inKey('recv', '0')), META);
    const r = await tr.postJournal(post(buildLegs(T({ template: 'T2', amount: cbsMinor(9n), accountRef: OTHER })), inKey('avail', '0'), { address: ADDR }), META);
    expect(r).toEqual(rej('BINDING_MISMATCH'));
    expect([s.balanceOf(G5IN), s.balanceOf({ role: 'G1', accountRef: OTHER })]).toEqual([9n, 0n]);
  });

  it('MC-06: a CBS at a different precision refuses every posting built at the adapter p (UNIT_MISMATCH), and nothing is posted', async () => {
    const s = mk({ unit: 'CBS_MINOR:USDC:2' });
    const tr = createPostingTranslator(s);
    const r = await tr.postJournal(post(buildLegs(T({ template: 'T1', amount: cbsMinor(9n), wallet: 'hot' })), inKey('recv', '0')), META);
    expect(r).toEqual(rej('UNIT_MISMATCH'));
    expect(s.journals()).toHaveLength(0);
  });

  it('property: random inbound items through T1 then T2/T8/unid with random faults: both sides equal, each key at most one journal, G5 itemised', async () => {
    const item = fc.record({
      m: fc.bigInt({ min: 0n, max: 10n ** 12n }),
      route: fc.constantFrom('T2', 'T8', 'unid'),
      fault: fc.constantFrom('none', 'before', 'after', 'timeout', 'unknown'),
      lookupDown: fc.boolean(),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(item, { minLength: 1, maxLength: 8 }), async (items) => {
        const s = mk();
        const tr = createPostingTranslator(s);
        let expectedG5 = 0n;
        for (const [i, it] of items.entries()) {
          const logIndex = String(i);
          const legs1 = buildLegs(T({ template: 'T1', amount: cbsMinor(it.m), wallet: 'hot' }));
          if (legs1.length === 0) continue; // m = 0: DUST_ONLY, nothing is posted
          if ((await tr.postJournal(post(legs1, inKey('recv', logIndex), {}, logIndex), META)).kind !== 'OK') return false;
          const step = it.route === 'unid' ? 'unid' : 'avail';
          const k2 = inKey(step, logIndex);
          // Faults are keyed to this item's key, so an unconsumed one can't leak into another item.
          if (it.fault === 'before') s.injectFault({ op: 'postJournal', key: k2, kind: 'AMBIGUOUS' });
          if (it.fault === 'after') s.injectFault({ op: 'postJournal', key: k2, kind: 'AMBIGUOUS', applied: true });
          if (it.fault === 'timeout') s.injectFault({ op: 'postJournal', key: k2, kind: 'TIMEOUT', applied: true });
          if (it.fault === 'unknown') s.injectFault({ op: 'postJournal', key: k2, kind: 'UNKNOWN_CODE' });
          if (it.lookupDown) s.injectFault({ op: 'getResultByKey', key: k2, kind: 'AMBIGUOUS' });
          const extra = it.route === 'T2' ? { accountRef: ACCT } : {};
          const refs = it.route === 'T2' ? { address: ADDR } : {};
          const r2 = await tr.postJournal(post(buildLegs(T({ template: it.route, amount: cbsMinor(it.m), ...extra })), k2, refs, logIndex), META);
          if (r2.kind !== 'OK' && r2.kind !== 'UNRESOLVED') return false;
          const posted = s.journals().filter((j) => j.key === k2).length;
          if (posted > 1 || (r2.kind === 'OK' && posted !== 1)) return false;
          // UNRESOLVED (→ PAUSE) leaves the item in G5 unless the CBS did apply it.
          if (posted === 0) expectedG5 += it.m;
        }
        const keys = s.journals().map((j) => j.key);
        return identity(s) && new Set(keys).size === keys.length && s.balanceOf(G5IN) === expectedG5;
      }),
      { numRuns: 60 },
    );
  });
});
