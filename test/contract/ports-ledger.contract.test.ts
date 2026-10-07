/**
 * PORTS unit: LedgerPort contract suite (docs/NOVA_ARC_DESIGN.md §7.2, §7.7, §7.8, §9).
 * Runs unchanged against both in-memory fakes; Nova's adapter must pass it too
 * [A-34]: add a factory to FACTORIES.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CBS_MINOR_MAX, cbsMinor, cbsPrecision } from '../../src/amounts/index.js';
import type { CbsMinor } from '../../src/amounts/index.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { EventLogLedger, MapLedger } from '../../src/nova-ports/fakes/ledger-fakes.js';
import type { LedgerFakeConfig } from '../../src/nova-ports/fakes/ledger-fakes.js';
import { idempotencyKey, ledgerAssetCode, novaAccountRef, paymentId } from '../../src/nova-ports/ids.js';
import type { PaymentId, PortResult } from '../../src/nova-ports/ids.js';
import type { JournalReceipt, JournalRequest, LedgerAccount, LedgerLeg, LedgerPort, PostingTemplateId } from '../../src/nova-ports/ledger.js';

type Factory = (faults?: FaultPlan, cfg?: Partial<LedgerFakeConfig>) => LedgerPort;

const USDC = ledgerAssetCode('USDC');
const ZAR = ledgerAssetCode('ZAR');
const EUR = ledgerAssetCode('EUR');
const p6 = cbsPrecision(6);
const payer: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acct-payer') };
const other: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acct-other') };
const closed: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acct-closed') };
const ghost: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acct-ghost') };
const clearing: LedgerAccount = { kind: 'ROLE', role: 'GL-5', sub: 'arc.outbound' };
const hot: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'arc.hot' };
const fees: LedgerAccount = { kind: 'ROLE', role: 'GL-6', sub: 'payments' };
const gasFloat: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'arc.gasfloat' };
const gasExpense: LedgerAccount = { kind: 'ROLE', role: 'GL-3', sub: 'arc' };
const partner: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'partner.p1' };
const partnerClaim: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'partnerClaim.p1' };
const funding: LedgerAccount = { kind: 'ROLE', role: 'GL-7', sub: '' };
const ALL = [payer, other, closed, clearing, hot, fees, gasFloat, gasExpense, partner, partnerClaim, funding];

const OPENING = 1_000_000n;
const base: LedgerFakeConfig = {
  assets: [
    { asset: USDC, precision: p6 },
    { asset: ZAR, precision: cbsPrecision(2) },
  ],
  accounts: [...ALL.filter((a) => a !== closed).map((account) => ({ account, status: 'OPEN' as const })), { account: closed, status: 'CLOSED' }],
  opening: [
    { account: hot, asset: USDC, side: 'DEBIT', amount: cbsMinor(OPENING) },
    { account: payer, asset: USDC, side: 'CREDIT', amount: cbsMinor(OPENING) },
  ],
};

const FACTORIES: readonly (readonly [string, Factory])[] = [
  ['MapLedger', (faults, cfg) => new MapLedger({ ...base, ...cfg, ...(faults ? { faults } : {}) })],
  ['EventLogLedger', (faults, cfg) => new EventLogLedger({ ...base, ...cfg, ...(faults ? { faults } : {}) })],
];

const pid = paymentId('pay-' + 'aa'.repeat(16));
const pid2 = paymentId('pay-' + 'bb'.repeat(16));
const leg = (account: LedgerAccount, side: LedgerLeg['side'], amount: bigint): LedgerLeg => ({ account, side, amount: cbsMinor(amount) });
const refs = { paymentId: pid, network: 'ARC', txHash: null, logIndex: null, dfnsTransferId: null, compensates: null } as const;

/** The payment of a P1 key: `pay:a:p1` is `pid`; any other key is its own payment (a payment has exactly one P1). */
const pidOfKey = (key: string): PaymentId => (key === 'pay:a:p1' ? pid : paymentId('pay-' + createHash('sha256').update(key).digest('hex').slice(0, 32)));

/** P1_RESERVE: DR GL-1 payer, CR GL-5 arc.outbound, A + F (§9.2). */
const p1 = (amount: bigint, key = 'pay:a:p1', account: LedgerAccount = payer): JournalRequest => ({
  key: idempotencyKey(key),
  template: 'P1_RESERVE',
  asset: USDC,
  precision: p6,
  legs: [leg(account, 'DEBIT', amount), leg(clearing, 'CREDIT', amount)],
  refs: { ...refs, paymentId: pidOfKey(key) },
});
/** P2 + P3 as one shape check: DR GL-5, CR GL-2 hot (A) and GL-6 fees (F). */
const settle = (a: bigint, f: bigint, key = 'pay:a:p2'): JournalRequest => ({
  key: idempotencyKey(key),
  template: 'P2_SETTLE_EXTERNAL',
  asset: USDC,
  precision: p6,
  legs: [leg(clearing, 'DEBIT', a + f), leg(hot, 'CREDIT', a), leg(fees, 'CREDIT', f)],
  refs,
});
const p7 = (original: JournalRequest, compensates: string, key = 'pay:a:p7', legs?: readonly LedgerLeg[]): JournalRequest => ({
  key: idempotencyKey(key),
  template: 'P7_COMPENSATE',
  asset: original.asset,
  precision: original.precision,
  legs: legs ?? original.legs.map((l) => ({ ...l, side: l.side === 'DEBIT' ? 'CREDIT' : 'DEBIT' })),
  refs: { ...original.refs, compensates },
});

/** The OK value; also asserts `replayed` (false unless a replay is expected). */
function okValue<T>(r: PortResult<T, string>, replayed = false): T {
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${JSON.stringify(r, (_k, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v))}`);
  expect(r.replayed).toBe(replayed);
  return r.value;
}

async function bal(l: LedgerPort, a: LedgerAccount, asset = USDC): Promise<{ debits: CbsMinor; credits: CbsMinor }> {
  return okValue(await l.getBalance(a, asset));
}

describe.each(FACTORIES)('LedgerPort contract: %s', (_name, make) => {
  it('reports per-asset precision; unknown asset is ASSET_UNKNOWN', async () => {
    const l = make();
    expect(await l.getAssetPrecision(USDC)).toEqual({ kind: 'OK', value: 6, replayed: false });
    expect(await l.getAssetPrecision(ZAR)).toEqual({ kind: 'OK', value: 2, replayed: false });
    expect(await l.getAssetPrecision(EUR)).toMatchObject({ kind: 'REJECTED', code: 'ASSET_UNKNOWN' });
  });

  it('opening balances are visible; untouched accounts are zero', async () => {
    const l = make();
    expect(await bal(l, payer)).toEqual({ debits: 0n, credits: OPENING });
    expect(await bal(l, hot)).toEqual({ debits: OPENING, credits: 0n });
    expect(await bal(l, other)).toEqual({ debits: 0n, credits: 0n });
    expect(await bal(l, payer, ZAR)).toEqual({ debits: 0n, credits: 0n });
    expect(await l.getBalance(ghost, USDC)).toMatchObject({ kind: 'REJECTED', code: 'ACCOUNT_UNKNOWN' });
    expect(await l.getBalance(payer, EUR)).toMatchObject({ kind: 'REJECTED', code: 'ASSET_UNKNOWN' });
  });

  it('refuses opening balances that do not balance', () => {
    expect(() => make(undefined, { opening: [{ account: hot, asset: USDC, side: 'DEBIT', amount: cbsMinor(1n) }] })).toThrow(/do not balance/);
    expect(() =>
      make(undefined, {
        opening: [
          { account: hot, asset: USDC, side: 'DEBIT', amount: cbsMinor(1n) },
          { account: payer, asset: ZAR, side: 'CREDIT', amount: cbsMinor(1n) },
        ],
      }),
    ).toThrow(/do not balance/);
    expect(() => make(undefined, { opening: [] })).not.toThrow();
  });

  it('posts a balanced journal, moves balances, and returns a receipt with template and refs', async () => {
    const l = make();
    const r = okValue(await l.postJournal(p1(150n)));
    expect(r).toMatchObject({ key: 'pay:a:p1', template: 'P1_RESERVE', refs });
    expect(typeof r.journalId).toBe('string');
    expect(r.postedAt).toMatch(/\S/);
    expect(await bal(l, payer)).toEqual({ debits: 150n, credits: OPENING });
    expect(await bal(l, clearing)).toEqual({ debits: 0n, credits: 150n });
    expect(await l.getJournalByKey(idempotencyKey('pay:a:p1'))).toEqual({ kind: 'OK', value: r, replayed: false });
    expect(await l.getJournalByKey(idempotencyKey('pay:a:nope'))).toEqual({ kind: 'OK', value: null, replayed: false });
  });

  it('exactly once: same key and request replays the original receipt with no second effect', async () => {
    const l = make();
    const first = okValue(await l.postJournal(p1(150n)));
    const again = await l.postJournal(p1(150n));
    expect(again).toEqual({ kind: 'OK', value: first, replayed: true });
    expect(await bal(l, payer)).toEqual({ debits: 150n, credits: OPENING });
  });

  it('same key, different request is KEY_CONFLICT and changes nothing', async () => {
    const l = make();
    await l.postJournal(p1(150n));
    expect(await l.postJournal(p1(151n))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: 'key pay:a:p1 reused with a different journal' });
    expect(await bal(l, payer)).toEqual({ debits: 150n, credits: OPENING });
  });

  it('distinct receipts for distinct keys', async () => {
    const l = make();
    const a = okValue(await l.postJournal(p1(1n, 'pay:a:p1')));
    const b = okValue(await l.postJournal(p1(1n, 'pay:a:p1b')));
    expect(a.journalId).not.toBe(b.journalId);
  });

  it('refuses unbalanced and malformed journals (checked by us and by the ledger) and applies nothing', async () => {
    const l = make();
    const unbalanced: JournalRequest = { ...p1(10n), legs: [leg(payer, 'DEBIT', 10n), leg(clearing, 'CREDIT', 9n)] };
    expect(await l.postJournal(unbalanced)).toMatchObject({ kind: 'REJECTED', code: 'UNBALANCED' });
    expect(await l.postJournal({ ...p1(10n), legs: [leg(payer, 'DEBIT', 10n)] })).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNAL' });
    expect(await l.postJournal({ ...p1(10n), refs: { ...refs, paymentId: null } })).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNAL' });
    expect(await bal(l, payer)).toEqual({ debits: 0n, credits: OPENING });
    expect(await l.getJournalByKey(idempotencyKey('pay:a:p1'))).toEqual({ kind: 'OK', value: null, replayed: false });
  });

  it('asset, precision and account checks (MC-06 precision gate)', async () => {
    const l = make();
    expect(await l.postJournal({ ...p1(1n), asset: EUR })).toMatchObject({ kind: 'REJECTED', code: 'ASSET_UNKNOWN', detail: 'asset EUR' });
    expect(await l.postJournal({ ...p1(1n), precision: cbsPrecision(18) })).toMatchObject({ kind: 'REJECTED', code: 'PRECISION_MISMATCH', detail: 'asset USDC' });
    expect(await l.postJournal({ ...p1(1n), asset: ZAR })).toMatchObject({ kind: 'REJECTED', code: 'PRECISION_MISMATCH' });
    expect(await l.postJournal(p1(1n, 'pay:a:p1', ghost))).toMatchObject({ kind: 'REJECTED', code: 'ACCOUNT_UNKNOWN', detail: 'CUSTOMER:acct-ghost' });
    expect(await l.postJournal(p1(1n, 'pay:a:p1', closed))).toMatchObject({ kind: 'REJECTED', code: 'ACCOUNT_CLOSED', detail: 'CUSTOMER:acct-closed' });
    const ghostRole: LedgerAccount = { kind: 'ROLE', role: 'GL-5', sub: 'nope' };
    expect(await l.postJournal({ ...p1(1n), legs: [leg(payer, 'DEBIT', 1n), leg(ghostRole, 'CREDIT', 1n)] })).toMatchObject({ kind: 'REJECTED', code: 'ACCOUNT_UNKNOWN' });
  });

  it('INSUFFICIENT_FUNDS: a customer can spend exactly its balance, not one minor unit more', async () => {
    const l = make();
    expect(await l.postJournal(p1(OPENING + 1n))).toMatchObject({ kind: 'REJECTED', code: 'INSUFFICIENT_FUNDS', detail: 'CUSTOMER:acct-payer' });
    expect(await l.postJournal(p1(1n, 'pay:a:p1', other))).toMatchObject({ kind: 'REJECTED', code: 'INSUFFICIENT_FUNDS', detail: 'CUSTOMER:acct-other' });
    okValue(await l.postJournal(p1(OPENING)));
    expect(await bal(l, payer)).toEqual({ debits: OPENING, credits: OPENING });
    expect(await l.postJournal(p1(1n, 'pay:a:p1x'))).toMatchObject({ kind: 'REJECTED', code: 'INSUFFICIENT_FUNDS' });
  });

  it('INSUFFICIENT_FUNDS counts credits to the same customer in the same journal', async () => {
    const l = make();
    const netZero: JournalRequest = { ...p1(5n), legs: [leg(other, 'DEBIT', 5n), leg(other, 'CREDIT', 5n)] };
    okValue(await l.postJournal(netZero));
    const netOne: JournalRequest = { ...p1(6n, 'pay:a:p1y'), legs: [leg(other, 'DEBIT', 6n), leg(other, 'CREDIT', 5n), leg(clearing, 'CREDIT', 1n)] };
    expect(await l.postJournal(netOne)).toMatchObject({ kind: 'REJECTED', code: 'INSUFFICIENT_FUNDS' });
    const creditOnly: JournalRequest = { ...p1(3n, 'pay:a:p1z'), legs: [leg(hot, 'DEBIT', 3n), leg(other, 'CREDIT', 3n)] };
    okValue(await l.postJournal(creditOnly));
    expect(await bal(l, other)).toEqual({ debits: 5n, credits: 8n });
  });

  it('balances are per asset: a ZAR journal does not touch USDC totals', async () => {
    const l = make();
    const zar: JournalRequest = { ...settle(300n, 0n, 'pay:a:zar'), asset: ZAR, precision: cbsPrecision(2), legs: [leg(clearing, 'DEBIT', 300n), leg(hot, 'CREDIT', 300n)] };
    okValue(await l.postJournal(zar));
    expect(await bal(l, hot, ZAR)).toEqual({ debits: 0n, credits: 300n });
    expect(await bal(l, hot)).toEqual({ debits: OPENING, credits: 0n });
    expect(await bal(l, clearing)).toEqual({ debits: 0n, credits: 0n });
  });

  it('a credit to an overdrawn customer is accepted (only debits are funds-checked)', async () => {
    const l = make(undefined, {
      opening: [
        { account: other, asset: USDC, side: 'DEBIT', amount: cbsMinor(50n) },
        { account: hot, asset: USDC, side: 'CREDIT', amount: cbsMinor(50n) },
      ],
    });
    const credit: JournalRequest = { ...p1(3n, 'pay:a:cr'), legs: [leg(hot, 'DEBIT', 3n), leg(other, 'CREDIT', 3n)] };
    okValue(await l.postJournal(credit));
    expect(await bal(l, other)).toEqual({ debits: 50n, credits: 3n });
    expect(await l.postJournal(p1(1n, 'pay:a:dr', other))).toMatchObject({ kind: 'REJECTED', code: 'INSUFFICIENT_FUNDS' });
  });

  it('role accounts may run on either side (no funds check)', async () => {
    const l = make();
    okValue(await l.postJournal(settle(10n, 2n)));
    expect(await bal(l, clearing)).toEqual({ debits: 12n, credits: 0n });
  });

  it('REVERSED only via P7: an exact mirror of an existing journal, once', async () => {
    const l = make();
    okValue(await l.postJournal(p1(12n)));
    const original = settle(10n, 2n);
    const s = okValue(await l.postJournal(original));
    const comp = okValue(await l.postJournal(p7(original, s.journalId)));
    expect(comp).toMatchObject({ template: 'P7_COMPENSATE', refs: { compensates: s.journalId, paymentId: pid } });
    expect(await bal(l, clearing)).toEqual({ debits: 12n, credits: 24n });
    expect(await bal(l, hot)).toEqual({ debits: OPENING + 10n, credits: 10n });
    expect(await bal(l, fees)).toEqual({ debits: 2n, credits: 2n });
    expect(await l.postJournal(p7(original, s.journalId))).toEqual({ kind: 'OK', value: comp, replayed: true });
    expect(await l.postJournal(p7(original, s.journalId, 'pay:a:p7b'))).toMatchObject({ kind: 'REJECTED', code: 'ALREADY_COMPENSATED' });
    expect(await l.postJournal(p7(p7(original, s.journalId), comp.journalId, 'pay:a:p7c'))).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH' });
  });

  it('P7 that does not mirror, or names no journal, or another payment or asset, is BINDING_MISMATCH', async () => {
    const l = make();
    okValue(await l.postJournal(p1(12n)));
    const original = settle(10n, 2n);
    const s = okValue(await l.postJournal(original));
    const mismatch = async (req: JournalRequest): Promise<void> => {
      expect(await l.postJournal(req)).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH' });
    };
    expect(await l.postJournal(p7(original, 'no-such-journal'))).toMatchObject({ detail: 'P7 must compensate an existing P2, P2I or P3 journal' });
    expect(await l.postJournal(p7(original, s.journalId, 'pay:a:p7', original.legs))).toMatchObject({ detail: 'P7 legs must mirror the original journal' });
    await mismatch(p7(original, 'no-such-journal'));
    await mismatch(p7(original, s.journalId, 'pay:a:p7', original.legs));
    await mismatch(p7(original, s.journalId, 'pay:a:p7', [leg(clearing, 'CREDIT', 10n), leg(hot, 'DEBIT', 10n)]));
    await mismatch(p7(original, s.journalId, 'pay:a:p7', [leg(clearing, 'CREDIT', 12n), leg(hot, 'DEBIT', 12n)]));
    await mismatch({ ...p7(original, s.journalId), refs: { ...refs, paymentId: pid2, compensates: s.journalId } });
    const zarOriginal: JournalRequest = { ...original, asset: ZAR, precision: cbsPrecision(2) };
    await mismatch({ ...p7(zarOriginal, s.journalId) });
    // A different but well-formed USDC original under the same journal id is not what was posted.
    await mismatch(p7({ ...original, legs: [leg(clearing, 'DEBIT', 12n), leg(hot, 'CREDIT', 12n)] }, s.journalId));
    // Nothing was compensated, so the correct P7 still goes through.
    okValue(await l.postJournal(p7(original, s.journalId, 'pay:a:p7ok')));
  });

  it('AMBIGUOUS before commit: nothing applied; lookup says absent; retry with the same key posts once', async () => {
    const faults = new FaultPlan();
    const l = make(faults);
    faults.arm('postJournal', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await l.postJournal(p1(7n))).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    expect(await l.getJournalByKey(idempotencyKey('pay:a:p1'))).toEqual({ kind: 'OK', value: null, replayed: false });
    expect(await bal(l, payer)).toEqual({ debits: 0n, credits: OPENING });
    expect(await l.postJournal(p1(7n))).toMatchObject({ kind: 'OK', replayed: false });
    expect(await bal(l, payer)).toEqual({ debits: 7n, credits: OPENING });
  });

  it('AMBIGUOUS after commit: applied; lookup finds it; retry replays with no second effect', async () => {
    const faults = new FaultPlan();
    const l = make(faults);
    faults.arm('postJournal', 'AFTER_COMMIT', 'TRANSPORT');
    expect(await l.postJournal(p1(7n))).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    const found = okValue(await l.getJournalByKey(idempotencyKey('pay:a:p1'))) as JournalReceipt;
    expect(found.key).toBe('pay:a:p1');
    expect(await l.postJournal(p1(7n))).toEqual({ kind: 'OK', value: found, replayed: true });
    expect(await bal(l, payer)).toEqual({ debits: 7n, credits: OPENING });
  });

  it('conservation: after any accepted sequence, Σ debits = Σ credits over all accounts, per asset', async () => {
    const l = make();
    okValue(await l.postJournal(p1(500n)));
    okValue(await l.postJournal(settle(450n, 50n)));
    await l.postJournal(p1(OPENING, 'pay:a:p1-big'));
    let debits = 0n;
    let credits = 0n;
    for (const a of ALL) {
      const b = await bal(l, a);
      debits += b.debits;
      credits += b.credits;
    }
    expect(debits).toBe(credits);
    expect(debits).toBe(OPENING + 500n + 500n);
  });
  it('template ids are exactly §7.2; the pre-fix name P8_GAS_FLOAT_FUND is unknown', async () => {
    const l = make();
    const move = (template: string): JournalRequest => ({ ...p1(1n, `move:${template.toLowerCase().replace(/_/g, '-')}`), template: template as PostingTemplateId, legs: [leg(gasFloat, 'DEBIT', 1n), leg(hot, 'CREDIT', 1n)], refs: { ...refs, paymentId: null } });
    expect(await l.postJournal(move('P8_GAS_FLOAT_FUND'))).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNAL', detail: 'unknown template P8_GAS_FLOAT_FUND' });
    expect(okValue(await l.postJournal(move('P10_INTERNAL_MOVE'))).template).toBe('P10_INTERNAL_MOVE');
  });

  it('rail-level journals (P5, P8, P9, P10) carry no payment; P4 may carry one or not (gas of an internal move or a DFNS cancel)', async () => {
    const l = make();
    const gas = (paymentId: typeof pid | null, key: string): JournalRequest => ({ ...p1(2n, key), template: 'P4_GAS', legs: [leg(gasExpense, 'DEBIT', 2n), leg(hot, 'CREDIT', 2n)], refs: { ...refs, paymentId, txHash: `0x${'7a'.repeat(32)}` } });
    okValue(await l.postJournal(gas(null, 'gas:5042002:a')));
    okValue(await l.postJournal(gas(pid, 'gas:5042002:b')));
    const rail = (template: PostingTemplateId, debit: LedgerAccount, credit: LedgerAccount): JournalRequest => ({ ...p1(3n, `rail:${template.toLowerCase().replace(/_/g, '-')}`), template, legs: [leg(debit, 'DEBIT', 3n), leg(credit, 'CREDIT', 3n)], refs: { ...refs, paymentId: null } });
    for (const [t, dr, cr] of [
      ['P5_DUST_SWEEP', gasExpense, hot],
      ['P8_EXTERNAL_FUNDING', hot, funding],
      ['P9_UNIDENTIFIED_RECEIPT', hot, fees],
      ['P10_INTERNAL_MOVE', hot, gasFloat],
    ] as const) {
      okValue(await l.postJournal(rail(t, dr, cr)));
      const withPayment = { ...rail(t, dr, cr), key: idempotencyKey(`railp:${t.toLowerCase().replace(/_/g, '-')}`), refs: { ...refs } };
      expect(await l.postJournal(withPayment)).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNAL', detail: expect.stringMatching(/paymentId must be null for P5\/P8\/P9\/P10/) });
    }
    for (const t of ['P1_RESERVE', 'P2_SETTLE_EXTERNAL', 'P2P_PARTNER_FUNDED', 'P2R_PARTNER_RETURN', 'P3_FEE', 'P6_RELEASE', 'P11_PARTNER_CLAIM'] as const) {
      expect(await l.postJournal({ ...rail(t, hot, clearing), key: idempotencyKey(`nop:${t.toLowerCase().replace(/_/g, '-')}`) })).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNAL' });
    }
  });

  it('F-17 templates: P2P funds the partner, P2R returns it, P11 turns it into a claim', async () => {
    const l = make();
    const j = (template: PostingTemplateId, dr: LedgerAccount, cr: LedgerAccount, key: string): JournalRequest => ({ ...p1(40n, key), refs, template, legs: [leg(dr, 'DEBIT', 40n), leg(cr, 'CREDIT', 40n)] });
    okValue(await l.postJournal(j('P2P_PARTNER_FUNDED', partner, hot, 'pay:a:p2p')));
    okValue(await l.postJournal(j('P11_PARTNER_CLAIM', partnerClaim, partner, 'pay:a:p11')));
    okValue(await l.postJournal(j('P2R_PARTNER_RETURN', hot, partnerClaim, 'pay:a:p2r')));
    expect(await bal(l, partner)).toEqual({ debits: 40n, credits: 40n });
    expect(await bal(l, partnerClaim)).toEqual({ debits: 40n, credits: 40n });
  });

  it('m2: a payment has exactly one P1 (a second under another key is refused, nothing posts); a non-P1 first journal is no reservation to release', async () => {
    const l = make();
    okValue(await l.postJournal(p1(300n)));
    expect(await l.postJournal({ ...p1(200n, 'pay:a:p1-again'), refs })).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH', detail: expect.stringMatching(/exactly one P1/) });
    expect(await bal(l, payer)).toEqual({ debits: 300n, credits: OPENING });
    expect(await l.getJournalByKey(idempotencyKey('pay:a:p1-again'))).toEqual({ kind: 'OK', value: null, replayed: false });
    // The replay of the one P1 is still a replay.
    okValue(await l.postJournal(p1(300n)), true);
    // M29: the P6 binds to the payment's P1, not to whatever journal came first.
    const m = make();
    const gas: JournalRequest = { ...p1(5n, 'pay:a:gas'), template: 'P4_GAS', refs };
    okValue(await m.postJournal(gas));
    const mirror = (a: bigint, key: string): JournalRequest => ({ ...p1(a, key), template: 'P6_RELEASE', refs, legs: [leg(clearing, 'DEBIT', a), leg(payer, 'CREDIT', a)] });
    expect(await m.postJournal(mirror(5n, 'pay:a:p6'))).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH', detail: expect.stringMatching(/mirror this payment's P1/) });
    // Only a P1 counts as the reservation: a gas journal before it does not block the P1, and the P6 then binds to the P1.
    okValue(await m.postJournal(p1(5n)));
    okValue(await m.postJournal(mirror(5n, 'pay:a:p6')));
  });

  it('m3: P11 and P2R need the payment\'s P2P and move exactly its amount', async () => {
    const l = make();
    const j = (template: PostingTemplateId, dr: LedgerAccount, cr: LedgerAccount, key: string, a = 40n): JournalRequest => ({ ...p1(a, key), refs, template, legs: [leg(dr, 'DEBIT', a), leg(cr, 'CREDIT', a)] });
    expect(await l.postJournal(j('P11_PARTNER_CLAIM', partnerClaim, partner, 'pay:a:p11'))).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH', detail: expect.stringMatching(/needs this payment's P2P/) });
    expect(await l.postJournal(j('P2R_PARTNER_RETURN', hot, partner, 'pay:a:p2r'))).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH', detail: expect.stringMatching(/needs this payment's P2P/) });
    // A P1 of the same amount is no P2P.
    okValue(await l.postJournal(p1(40n)));
    expect(await l.postJournal(j('P11_PARTNER_CLAIM', partnerClaim, partner, 'pay:a:p11'))).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH', detail: expect.stringMatching(/needs this payment's P2P/) });
    okValue(await l.postJournal(j('P2P_PARTNER_FUNDED', partner, hot, 'pay:a:p2p')));
    // One leg off A is refused even when the journal balances.
    const split: JournalRequest = { ...j('P11_PARTNER_CLAIM', partnerClaim, partner, 'pay:a:p11'), legs: [leg(partnerClaim, 'DEBIT', 40n), leg(partner, 'CREDIT', 39n), leg(hot, 'CREDIT', 1n)] };
    expect(await l.postJournal(split)).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH', detail: expect.stringMatching(/exactly the payment's P2P amount 40/) });
    for (const a of [1n, 39n, 41n]) {
      expect(await l.postJournal(j('P11_PARTNER_CLAIM', partnerClaim, partner, 'pay:a:p11', a))).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH', detail: expect.stringMatching(/exactly the payment's P2P amount 40/) });
      expect(await l.postJournal(j('P2R_PARTNER_RETURN', hot, partner, 'pay:a:p2r', a))).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH' });
    }
    expect(await l.postJournal({ ...j('P11_PARTNER_CLAIM', partnerClaim, partner, 'pay:a:p11'), asset: ZAR, precision: cbsPrecision(2) })).toMatchObject({ kind: 'REJECTED' });
    // A P11 of 1 therefore never unlocks the P6 (F-17 gate).
    expect(await bal(l, partner)).toEqual({ debits: 40n, credits: 0n });
    okValue(await l.postJournal(j('P11_PARTNER_CLAIM', partnerClaim, partner, 'pay:a:p11')));
  });

  it('LP6: P6 mirrors this payment\'s own P1 and releases it once; with the USDC at a partner it follows P2R or P11 (B1, B2, §9.3)', async () => {
    const l = make();
    const forPay = (id: typeof pid) => ({ ...refs, paymentId: id });
    const reserve = (id: typeof pid, amount: bigint): JournalRequest => ({ ...p1(amount, `pay:${id}:p1`), refs: forPay(id) });
    const release = (id: typeof pid, amount: bigint, key = `pay:${id}:p6`, legs?: readonly LedgerLeg[]): JournalRequest => ({
      key: idempotencyKey(key),
      template: 'P6_RELEASE',
      asset: USDC,
      precision: p6,
      legs: legs ?? [leg(clearing, 'DEBIT', amount), leg(payer, 'CREDIT', amount)],
      refs: forPay(id),
    });
    const j = (id: typeof pid, template: PostingTemplateId, suffix: string, dr: LedgerAccount, cr: LedgerAccount, amount: bigint): JournalRequest => ({
      ...release(id, amount, `pay:${id}:${suffix}`, [leg(dr, 'DEBIT', amount), leg(cr, 'CREDIT', amount)]),
      template,
    });
    const no = async (req: JournalRequest, detail: RegExp): Promise<void> => {
      expect(await l.postJournal(req)).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH', detail: expect.stringMatching(detail) });
    };
    // Another payment's reservation is never released for a payment that has none.
    okValue(await l.postJournal(reserve(pid2, 600_000n)));
    await no(release(pid, 500_000n), /mirror this payment's P1/);
    expect(await bal(l, payer)).toEqual({ debits: 600_000n, credits: OPENING });
    // Exactly the P1's legs, sides swapped (order-free), in its asset.
    const a = paymentId('pay-' + 'a1'.repeat(16));
    okValue(await l.postJournal(reserve(a, 1_000n)));
    await no(release(a, 999n), /mirror/);
    await no(release(a, 1_000n, undefined, [leg(clearing, 'DEBIT', 1_000n), leg(other, 'CREDIT', 1_000n)]), /mirror/);
    await no({ ...release(a, 1_000n), asset: ZAR, precision: cbsPrecision(2) }, /mirror/);
    const swapped = release(a, 1_000n, undefined, [leg(payer, 'CREDIT', 1_000n), leg(clearing, 'DEBIT', 1_000n)]);
    const done = okValue(await l.postJournal(swapped));
    expect(await l.postJournal(swapped)).toEqual({ kind: 'OK', value: done, replayed: true });
    await no(release(a, 1_000n, `pay:${a}:p6b`), /already released by P6_RELEASE/);
    // A settled payment is never released.
    const b = paymentId('pay-' + 'b1'.repeat(16));
    okValue(await l.postJournal(reserve(b, 1_000n)));
    okValue(await l.postJournal(j(b, 'P2_SETTLE_EXTERNAL', 'p2', clearing, hot, 1_000n)));
    await no(release(b, 1_000n), /already released by P2_SETTLE_EXTERNAL/);
    const bi = paymentId('pay-' + 'b2'.repeat(16));
    okValue(await l.postJournal(reserve(bi, 1_000n)));
    okValue(await l.postJournal(j(bi, 'P2I_SETTLE_INTERNAL', 'p2i', clearing, other, 1_000n)));
    await no(release(bi, 1_000n), /already released by P2I_SETTLE_INTERNAL/);
    // F-17: with the USDC at the partner (P2P), P6 follows P2R (returned) or P11 (claim).
    const c = paymentId('pay-' + 'c1'.repeat(16));
    okValue(await l.postJournal(reserve(c, 1_000n)));
    okValue(await l.postJournal(j(c, 'P2P_PARTNER_FUNDED', 'p2p', partner, hot, 1_000n)));
    await no(release(c, 1_000n), /F-17/);
    okValue(await l.postJournal(j(c, 'P11_PARTNER_CLAIM', 'p11', partnerClaim, partner, 1_000n)));
    okValue(await l.postJournal(release(c, 1_000n)));
    const d = paymentId('pay-' + 'd1'.repeat(16));
    okValue(await l.postJournal(reserve(d, 1_000n)));
    okValue(await l.postJournal(j(d, 'P2P_PARTNER_FUNDED', 'p2p', partner, hot, 1_000n)));
    okValue(await l.postJournal(j(d, 'P2R_PARTNER_RETURN', 'p2r', hot, partner, 1_000n)));
    okValue(await l.postJournal(release(d, 1_000n)));
    // Clearing nets to zero for every released payment; only pid2's reservation is still in it.
    expect(await bal(l, clearing)).toEqual({ debits: 5_000n, credits: 605_000n });
  });

  it('P7 compensates only a P2, P2I or P3 journal (§9.2 "mirror of the original P2/P3 legs", m3)', async () => {
    const l = make();
    const reserve = p1(12n);
    const r1 = okValue(await l.postJournal(reserve));
    expect(await l.postJournal(p7(reserve, r1.journalId))).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH', detail: 'P7 must compensate an existing P2, P2I or P3 journal' });
    const gas: JournalRequest = { ...p1(2n, 'gas:5042002:c'), template: 'P4_GAS', legs: [leg(gasExpense, 'DEBIT', 2n), leg(hot, 'CREDIT', 2n)] };
    const g = okValue(await l.postJournal(gas));
    expect(await l.postJournal(p7(gas, g.journalId, 'pay:a:p7g'))).toMatchObject({ kind: 'REJECTED', code: 'BINDING_MISMATCH' });
    const fee: JournalRequest = { ...p1(2n, 'pay:a:p3'), template: 'P3_FEE', legs: [leg(clearing, 'DEBIT', 2n), leg(fees, 'CREDIT', 2n)] };
    const f = okValue(await l.postJournal(fee));
    okValue(await l.postJournal(p7(fee, f.journalId, 'pay:a:p7f')));
    const internal: JournalRequest = { ...p1(5n, 'pay:a:p2i'), template: 'P2I_SETTLE_INTERNAL', legs: [leg(clearing, 'DEBIT', 5n), leg(other, 'CREDIT', 5n)] };
    const i = okValue(await l.postJournal(internal));
    okValue(await l.postJournal(p7(internal, i.journalId, 'pay:a:p7i')));
  });

  it('an account total that would pass CBS_MINOR_MAX is a typed INVALID_JOURNAL, never a thrown overflow (m4, probe L10)', async () => {
    const l = make(undefined, {
      opening: [
        { account: other, asset: USDC, side: 'CREDIT', amount: cbsMinor(CBS_MINOR_MAX) },
        { account: hot, asset: USDC, side: 'DEBIT', amount: cbsMinor(CBS_MINOR_MAX) },
      ],
    });
    const debitOther: JournalRequest = { ...p1(5n, 'pay:a:big', other), legs: [leg(other, 'DEBIT', 5n), leg(other, 'CREDIT', 1n), leg(clearing, 'CREDIT', 4n)] };
    expect(await l.postJournal(debitOther)).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNAL', detail: 'CUSTOMER:acct-other totals would exceed CBS_MINOR_MAX' });
    const roleOver: JournalRequest = { ...p1(1n, 'pay:a:role'), legs: [leg(hot, 'DEBIT', 1n), leg(clearing, 'CREDIT', 1n)] };
    expect(await l.postJournal(roleOver)).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNAL', detail: 'ROLE:GL-2:arc.hot totals would exceed CBS_MINOR_MAX' });
    okValue(await l.postJournal({ ...p1(5n, 'pay:a:ok', other) }));
    expect(await bal(l, other)).toEqual({ debits: 5n, credits: CBS_MINOR_MAX });
  });

  it('AMBIGUOUS can be injected on reads too (gateway check 2 counts it as "exists")', async () => {
    const faults = new FaultPlan();
    const l = make(faults);
    faults.arm('getJournalByKey', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await l.getJournalByKey(idempotencyKey('pay:a:p6'))).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    expect(await l.getJournalByKey(idempotencyKey('pay:a:p6'))).toEqual({ kind: 'OK', value: null, replayed: false });
    faults.arm('getBalance', 'BEFORE_COMMIT', 'UNAVAILABLE');
    expect(await l.getBalance(payer, USDC)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
    faults.arm('getAssetPrecision', 'BEFORE_COMMIT', 'TRANSPORT');
    expect(await l.getAssetPrecision(USDC)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    expect(await l.getAssetPrecision(USDC)).toMatchObject({ kind: 'OK', value: 6 });
  });
});
