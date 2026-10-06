/**
 * CBS unit: the ACL posting translator (src/cbs/translator.ts): the §5.1
 * slice templates (T1, T2, T8, unid) and the CONTRACT §1.4 AMBIGUOUS
 * resolution behind postJournal and the hold operations.
 */
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { cbsMinor, type CbsMinor } from '../../src/amounts/index.js';
import type { CallMeta, CbsMinorTag, CbsPort, JournalLeg } from '../../src/cbs/port.js';
import type { IdempotencyKey, SubjectRef } from '../../src/cbs/keys.js';
import { REJECTED_CODES, type CbsResult, type RejectedCode } from '../../src/cbs/result.js';
import { buildLegs, createPostingTranslator, type RetryBudget, type TemplateInput } from '../../src/cbs/translator.js';
import type { AccountRef } from '../../src/registry/index.js';

const UNIT: CbsMinorTag = 'CBS_MINOR:USDC:6';
const ZERO = cbsMinor(0n);
const ACCT = 'acct-1' as AccountRef;
const amount = (v: bigint): CbsMinor => cbsMinor(v);
const t = (x: Record<string, unknown>): TemplateInput => ({ unit: UNIT, fee: ZERO, ...x }) as unknown as TemplateInput;

describe('buildLegs: §5.1 slice templates', () => {
  const wire = { unit: UNIT, value: '1500' };
  it.each(['hot', 'gas', 'collection'] as const)('T1 to G2.%s: DR G2.<wallet> m · CR G5.inbound m', (wallet) => {
    expect(buildLegs(t({ template: 'T1', amount: amount(1500n), wallet }))).toEqual([
      { glOrAccountRef: { role: 'G2', wallet }, side: 'DR', amount: wire },
      { glOrAccountRef: { role: 'G5', sub: 'inbound' }, side: 'CR', amount: wire },
    ]);
  });

  it('T2: DR G5.inbound h · CR G1 h', () => {
    expect(buildLegs(t({ template: 'T2', amount: amount(1500n), accountRef: ACCT }))).toEqual([
      { glOrAccountRef: { role: 'G5', sub: 'inbound' }, side: 'DR', amount: wire },
      { glOrAccountRef: { role: 'G1', accountRef: ACCT }, side: 'CR', amount: wire },
    ]);
  });

  it('T8: DR G5.inbound h · CR G7 h', () => {
    expect(buildLegs(t({ template: 'T8', amount: amount(1500n) }))).toEqual([
      { glOrAccountRef: { role: 'G5', sub: 'inbound' }, side: 'DR', amount: wire },
      { glOrAccountRef: { role: 'G7' }, side: 'CR', amount: wire },
    ]);
  });

  it('unid: DR G5.inbound h · CR G4.unidentified h', () => {
    expect(buildLegs(t({ template: 'unid', amount: amount(1500n) }))).toEqual([
      { glOrAccountRef: { role: 'G5', sub: 'inbound' }, side: 'DR', amount: wire },
      { glOrAccountRef: { role: 'G4', sub: 'unidentified' }, side: 'CR', amount: wire },
    ]);
  });

  it('omits zero-amount legs: a zero amount gives no legs, so nothing is posted (CONTRACT §3)', () => {
    for (const x of [{ template: 'T1', wallet: 'hot' }, { template: 'T2', accountRef: ACCT }, { template: 'T8' }, { template: 'unid' }]) {
      expect(buildLegs(t({ ...x, amount: ZERO }))).toEqual([]);
    }
  });

  it('writes the amount as a decimal string, never a JSON number (CONTRACT §1.1), at the CBS maximum', () => {
    const legs = buildLegs(t({ template: 'T8', amount: amount(9_223_372_036_854_775_807n) }));
    expect(legs.map((l) => l.amount.value)).toEqual(['9223372036854775807', '9223372036854775807']);
    expect(legs.map((l) => typeof l.amount.value)).toEqual(['string', 'string']);
    expect(buildLegs(t({ template: 'T8', amount: amount(1n) }))[0]?.amount.value).toBe('1');
  });

  it.each(['CBS_MINOR:USDC:0', 'CBS_MINOR:USDC:9', 'CBS_MINOR:USDC:10', 'CBS_MINOR:USDC:18', 'CBS_MINOR:a.b_c-D:2'])('accepts unit tag %s', (unit) => {
    expect(buildLegs(t({ template: 'T8', amount: amount(5n), unit }))[1]?.amount.unit).toBe(unit);
  });

  it.each([undefined, 7, 'USDC_UNITS', 'NATIVE_WEI', 'CBS_MINOR:USDC:19', 'CBS_MINOR:USDC:06', 'CBS_MINOR::6', 'CBS_MINOR:USDC:', 'CBS_MINOR:US DC:6', 'xCBS_MINOR:USDC:6', 'CBS_MINOR:USDC:6x', 'CBS_MINOR:USDC:-1'])(
    'refuses unit tag %j (CONTRACT §1.1)',
    (unit) => {
      expect(() => buildLegs(t({ template: 'T8', amount: amount(5n), unit }))).toThrow(/CBS_MINOR:<assetCode>:<p>/);
    },
  );

  it('refuses a negative or non-bigint amount, and a non-zero fee', () => {
    expect(() => buildLegs(t({ template: 'T8', amount: -1n }))).toThrow(/non-negative bigint/);
    expect(() => buildLegs(t({ template: 'T8', amount: 5 }))).toThrow(/non-negative bigint/);
    expect(() => buildLegs(t({ template: 'T8', amount: '5' }))).toThrow(RangeError);
    expect(() => buildLegs(t({ template: 'T8', amount: amount(5n), fee: amount(1n) }))).toThrow(/only T4 carries a fee/);
    expect(() => buildLegs(t({ template: 'T8', amount: amount(5n), fee: 0 }))).toThrow(/fee/);
  });

  it('refuses a missing or wrong wallet for T1 and a missing accountRef for T2', () => {
    expect(() => buildLegs(t({ template: 'T1', amount: amount(5n) }))).toThrow(/T1 needs a walletRole/);
    expect(() => buildLegs(t({ template: 'T1', amount: amount(5n), wallet: 'cold' }))).toThrow(/T1 needs a walletRole/);
    expect(() => buildLegs(t({ template: 'T2', amount: amount(5n) }))).toThrow(/T2 needs an accountRef/);
    expect(() => buildLegs(t({ template: 'T2', amount: amount(5n), accountRef: '' }))).toThrow(/T2 needs an accountRef/);
    expect(() => buildLegs(t({ template: 'T2', amount: amount(5n), accountRef: 5 }))).toThrow(/T2 needs an accountRef/);
  });

  it('refuses a field that the template does not take (fail closed on a mixed-up input)', () => {
    for (const template of ['T2', 'T8', 'unid']) {
      expect(() => buildLegs(t({ template, amount: amount(5n), wallet: 'hot', accountRef: ACCT }))).toThrow(new RegExp(`${template} takes no wallet`));
    }
    for (const template of ['T1', 'T8', 'unid']) {
      expect(() => buildLegs(t({ template, amount: amount(5n), wallet: 'hot', accountRef: ACCT }))).toThrow(/takes no/);
      expect(() => buildLegs(t({ template, amount: amount(5n), ...(template === 'T1' ? { wallet: 'hot' } : {}), accountRef: ACCT }))).toThrow(
        new RegExp(`${template} takes no accountRef`),
      );
    }
  });

  it.each(['T3', 'T4', 'T5', 'T6', 'T9', 'T10', 'T11', 'gas', 'dust', 'T7', ''])('refuses template %j: not in the testnet slice', (template) => {
    expect(() => buildLegs(t({ template, amount: amount(5n) }))).toThrow(/is not in the testnet slice/);
  });

  it('property: every slice template balances per unit, one DR and one CR of the same amount (MC-04)', () => {
    const input = fc.record({
      template: fc.constantFrom('T1', 'T2', 'T8', 'unid'),
      v: fc.bigInt({ min: 1n, max: 9_223_372_036_854_775_807n }),
      p: fc.integer({ min: 0, max: 18 }),
    });
    fc.assert(
      fc.property(input, ({ template, v, p }) => {
        const unit = `CBS_MINOR:USDC:${p}`;
        const extra = template === 'T1' ? { wallet: 'hot' } : template === 'T2' ? { accountRef: ACCT } : {};
        const legs = buildLegs(t({ template, amount: amount(v), unit, ...extra }));
        const sum = (side: string): bigint => legs.filter((l) => l.side === side).reduce((s, l) => s + BigInt(l.amount.value), 0n);
        return legs.length === 2 && sum('DR') === v && sum('CR') === v && legs.every((l) => l.amount.unit === unit);
      }),
      { numRuns: 300 },
    );
  });
});

// ---------------------------------------------------------------------------
// CONTRACT §1.4 AMBIGUOUS resolution.
// ---------------------------------------------------------------------------

const KEY = `arc1-${'1'.repeat(64)}` as IdempotencyKey;
const META: CallMeta = { callId: 'call-0' };
const OKV = { kind: 'OK', value: { journalId: 'j1', postedAt: 't' } } as const;
const AMB = { kind: 'AMBIGUOUS', detail: 'x' } as const;
const lookup = (value: Record<string, unknown>): CbsResult<unknown> => ({ kind: 'OK', value: { op: 'postJournal', ...value } });

type Scripted = unknown | (() => unknown);

/** A fake port: each method answers from its own script, in order, and records every call. */
function fakePort(scripts: Partial<Record<keyof CbsPort, Scripted[]>>) {
  const calls: { op: string; req: unknown; meta: CallMeta }[] = [];
  const handler = (op: keyof CbsPort) => async (req: unknown, meta: CallMeta) => {
    calls.push({ op, req, meta });
    const next = scripts[op]?.shift();
    if (next === undefined) throw new Error(`fake port: no scripted answer for ${op}`);
    return typeof next === 'function' ? (next as () => unknown)() : next;
  };
  const port = new Proxy({} as CbsPort, { get: (_t, op) => handler(op as keyof CbsPort) });
  return { port, calls };
}

let ids = 0;
const newCallId = (): string => `fresh-${(ids += 1)}`;
const budget = (answers: boolean[]): (() => RetryBudget) => {
  return () => ({ next: async () => answers.shift() ?? false });
};
const journalReq = { key: KEY, valueDate: '2026-10-06', legs: [] as JournalLeg[], narrative: 'n', refs: { subjectRef: '["rail","0"]' as SubjectRef } };

describe('resolveAmbiguous and the keyed operations (CONTRACT §1.4)', () => {
  it('OK on the first call is the output; the caller callId is used and getResultByKey is not called', async () => {
    const { port, calls } = fakePort({ postJournal: [OKV] });
    const tr = createPostingTranslator(port, { newCallId });
    await expect(tr.postJournal(journalReq, META)).resolves.toEqual(OKV);
    expect(calls).toEqual([{ op: 'postJournal', req: journalReq, meta: META }]);
  });

  it.each(REJECTED_CODES.map((c) => [c]))('a definite REJECTED{%s} is the output', async (code) => {
    const { port, calls } = fakePort({ postJournal: [{ kind: 'REJECTED', code }] });
    await expect(createPostingTranslator(port).postJournal(journalReq, META)).resolves.toEqual({ kind: 'REJECTED', code });
    expect(calls).toHaveLength(1);
  });

  it('CONFLICT is the output', async () => {
    const { port } = fakePort({ postJournal: [{ kind: 'CONFLICT', key: KEY }] });
    await expect(createPostingTranslator(port).postJournal(journalReq, META)).resolves.toEqual({ kind: 'CONFLICT', key: KEY });
  });

  it.each([
    ['an unknown REJECTED code', { kind: 'REJECTED', code: 'TEAPOT' }],
    ['a thrown transport error', () => { throw new Error('socket'); }],
    ['a null response', null],
    ['a non-object response', 'OK'],
    ['an object with no kind', { value: 1 }],
    ['an unclassified kind', { kind: 'MAYBE' }],
    ['a non-string kind', { kind: 7 }],
    ['AMBIGUOUS', AMB],
  ])('%s is AMBIGUOUS: getResultByKey(key) decides (NOT_FOUND → one final call)', async (_n, first) => {
    const { port, calls } = fakePort({ postJournal: [first, OKV], getResultByKey: [lookup({ state: 'NOT_FOUND' })] });
    await expect(createPostingTranslator(port, { newCallId }).postJournal(journalReq, META)).resolves.toEqual(OKV);
    expect(calls.map((c) => c.op)).toEqual(['postJournal', 'getResultByKey', 'postJournal']);
    expect(calls[1]?.req).toEqual({ key: KEY });
  });

  it('retries with the same key and payload while the H_retry budget lasts; each attempt gets a fresh callId', async () => {
    const { port, calls } = fakePort({ postJournal: [AMB, AMB, OKV] });
    const make = vi.fn(budget([true, true, true]));
    const tr = createPostingTranslator(port, { retryBudget: make, newCallId: () => 'fresh' });
    await expect(tr.postJournal(journalReq, META)).resolves.toEqual(OKV);
    expect(calls.map((c) => [c.op, c.req, c.meta.callId])).toEqual([
      ['postJournal', journalReq, 'call-0'],
      ['postJournal', journalReq, 'fresh'],
      ['postJournal', journalReq, 'fresh'],
    ]);
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('the first non-ambiguous retry result is the output, even a REJECTED', async () => {
    const { port, calls } = fakePort({ postJournal: [AMB, { kind: 'REJECTED', code: 'UNBALANCED' }] });
    const tr = createPostingTranslator(port, { retryBudget: budget([true, true]) });
    await expect(tr.postJournal(journalReq, META)).resolves.toEqual({ kind: 'REJECTED', code: 'UNBALANCED' });
    expect(calls).toHaveLength(2);
  });

  it('once the budget is spent it stops retrying and asks getResultByKey', async () => {
    const { port, calls } = fakePort({ postJournal: [AMB, AMB, OKV], getResultByKey: [lookup({ state: 'APPLIED', result: { journalId: 'j1' } })] });
    const tr = createPostingTranslator(port, { retryBudget: budget([true, false]), newCallId });
    await expect(tr.postJournal(journalReq, META)).resolves.toEqual(OKV);
    expect(calls.map((c) => c.op)).toEqual(['postJournal', 'postJournal', 'getResultByKey', 'postJournal']);
  });

  it('default: no retries, a UUID callId per extra attempt', async () => {
    const { port, calls } = fakePort({ postJournal: [AMB, OKV], getResultByKey: [lookup({ state: 'APPLIED' })] });
    await expect(createPostingTranslator(port).postJournal(journalReq, META)).resolves.toEqual(OKV);
    expect(calls.map((c) => c.op)).toEqual(['postJournal', 'getResultByKey', 'postJournal']);
    const fresh = calls.slice(1).map((c) => c.meta.callId);
    for (const id of fresh) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set([META.callId, ...fresh]).size).toBe(3);
  });

  it('APPLIED → OK with the typed value from a same-key replay; a replay that is not OK → UNRESOLVED', async () => {
    for (const [replay, out] of [
      [OKV, OKV],
      [AMB, { kind: 'UNRESOLVED' }],
      [{ kind: 'REJECTED', code: 'INVALID' }, { kind: 'UNRESOLVED' }],
      [{ kind: 'CONFLICT', key: KEY }, { kind: 'UNRESOLVED' }],
    ] as const) {
      const { port } = fakePort({ postJournal: [AMB, replay], getResultByKey: [lookup({ state: 'APPLIED', result: { journalId: 'other' } })] });
      await expect(createPostingTranslator(port).postJournal(journalReq, META)).resolves.toEqual(out);
    }
  });

  it('NOT_FOUND → exactly one final call; its result is the output, AMBIGUOUS again → UNRESOLVED', async () => {
    for (const [final, out] of [
      [OKV, OKV],
      [{ kind: 'REJECTED', code: 'ZERO_AMOUNT' }, { kind: 'REJECTED', code: 'ZERO_AMOUNT' }],
      [{ kind: 'CONFLICT', key: KEY }, { kind: 'CONFLICT', key: KEY }],
      [AMB, { kind: 'UNRESOLVED' }],
      [{ kind: 'REJECTED', code: 'NOPE' }, { kind: 'UNRESOLVED' }],
    ] as const) {
      const { port, calls } = fakePort({ postJournal: [AMB, final], getResultByKey: [lookup({ state: 'NOT_FOUND' })] });
      await expect(createPostingTranslator(port, { retryBudget: budget([]) }).postJournal(journalReq, META)).resolves.toEqual(out);
      expect(calls).toHaveLength(3);
    }
  });

  it.each(REJECTED_CODES.map((c) => [c]))('getResultByKey REJECTED{%s} → REJECTED{code}, with no further call', async (code) => {
    const { port, calls } = fakePort({ postJournal: [AMB], getResultByKey: [lookup({ state: 'REJECTED', code })] });
    await expect(createPostingTranslator(port).postJournal(journalReq, META)).resolves.toEqual({ kind: 'REJECTED', code });
    expect(calls).toHaveLength(2);
  });

  it.each([
    ['REJECTED with no code', lookup({ state: 'REJECTED' })],
    ['REJECTED with an unknown code', lookup({ state: 'REJECTED', code: 'TEAPOT' })],
    ['an unknown state', lookup({ state: 'PENDING' })],
    ['unavailable (AMBIGUOUS)', AMB],
    ['op not covered (REJECTED)', { kind: 'REJECTED', code: 'NOT_PERMITTED' }],
    ['a CONFLICT', { kind: 'CONFLICT', key: KEY }],
    ['a thrown error', () => { throw new Error('down'); }],
    ['an unclassified response', { kind: 'WHAT' }],
  ])('getResultByKey %s → UNRESOLVED, with no further call', async (_n, answer) => {
    const { port, calls } = fakePort({ postJournal: [AMB], getResultByKey: [answer] });
    await expect(createPostingTranslator(port).postJournal(journalReq, META)).resolves.toEqual({ kind: 'UNRESOLVED' });
    expect(calls).toHaveLength(2);
  });

  it('the hold operations go to their own port method through the same resolution', async () => {
    const hold = { kind: 'OK', value: { holdId: 'h1', accountRef: ACCT, amount: { unit: UNIT, value: '5' } } } as const;
    const { port, calls } = fakePort({
      placeHold: [AMB, hold],
      settleHold: [{ kind: 'OK', value: { journalId: 'j9' } }],
      releaseHold: [{ kind: 'REJECTED', code: 'HOLD_STATE' }],
      getResultByKey: [lookup({ state: 'NOT_FOUND', op: 'placeHold' })],
    });
    const tr = createPostingTranslator(port, { newCallId });
    await expect(tr.placeHold({ key: KEY, instructionId: 'ins-1' }, META)).resolves.toEqual(hold);
    await expect(tr.settleHold({ key: KEY, holdId: 'h1', instructionId: 'ins-1', txHash: `0x${'a'.repeat(64)}`, legs: [] }, META)).resolves.toEqual({
      kind: 'OK',
      value: { journalId: 'j9' },
    });
    await expect(tr.releaseHold({ key: KEY, holdId: 'h1' }, META)).resolves.toEqual({ kind: 'REJECTED', code: 'HOLD_STATE' });
    expect(calls.map((c) => c.op)).toEqual(['placeHold', 'getResultByKey', 'placeHold', 'settleHold', 'releaseHold']);
    expect(calls[1]?.req).toEqual({ key: KEY });
  });

  it('resolveAmbiguous works for any keyed call (e.g. screen) and passes each attempt its CallMeta', async () => {
    const { port } = fakePort({ getResultByKey: [lookup({ state: 'NOT_FOUND', op: 'screen' })] });
    const metas: string[] = [];
    const answers: CbsResult<string>[] = [AMB, { kind: 'OK', value: 'CLEAR' }];
    const tr = createPostingTranslator(port, { newCallId: () => 'n' });
    const out = await tr.resolveAmbiguous({ key: KEY }, async (m) => {
      metas.push(m.callId);
      return answers.shift() as CbsResult<string>;
    }, META);
    expect(out).toEqual({ kind: 'OK', value: 'CLEAR' });
    expect(metas).toEqual(['call-0', 'n']);
  });

  it('never returns AMBIGUOUS (property over random answer scripts)', async () => {
    const answer = fc.constantFrom<unknown>(
      OKV,
      AMB,
      { kind: 'REJECTED', code: 'INVALID' as RejectedCode },
      { kind: 'REJECTED', code: 'BOGUS' },
      { kind: 'CONFLICT', key: KEY },
      null,
      lookup({ state: 'APPLIED' }),
      lookup({ state: 'NOT_FOUND' }),
      lookup({ state: 'REJECTED', code: 'UNBALANCED' }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(answer, { minLength: 8, maxLength: 8 }), fc.array(fc.boolean(), { maxLength: 4 }), async (script, retries) => {
        const queue = [...script];
        const port = new Proxy({} as CbsPort, { get: () => async () => queue.shift() ?? AMB });
        const out = await createPostingTranslator(port, { retryBudget: budget([...retries]) }).postJournal(journalReq, META);
        return ['OK', 'REJECTED', 'CONFLICT', 'UNRESOLVED'].includes(out.kind);
      }),
      { numRuns: 200 },
    );
  });
});
