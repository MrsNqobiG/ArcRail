/**
 * DEMO ONLY - built on parts still in review; fakes only; testnet only; not the D1 payment unit;
 * not evidence for any gate. Composes MapLedger, ListHistory and src/status. Payment record, DFNS
 * transfer and chain confirmation are SIMULATED in demo (PAY unit pending).
 */
import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision } from '../src/amounts/index.js';
import type { CbsMinor } from '../src/amounts/index.js';
import { ListHistory } from '../src/history/fakes.js';
import { historyKey } from '../src/history/index.js';
import type { HistoryEntryInput } from '../src/history/index.js';
import { idempotencyKey, ledgerAssetCode, novaAccountRef, novaOwnerRef, paymentId } from '../src/nova-ports/ids.js';
import type { Hex32 } from '../src/nova-ports/ids.js';
import { MapLedger } from '../src/nova-ports/fakes/ledger-fakes.js';
import type { JournalRequest, LedgerAccount, LedgerLeg, Side } from '../src/nova-ports/ledger.js';
import { STATUS_BY_STAGE, decideTransition } from '../src/status/index.js';
import type { LegState, Stage } from '../src/status/index.js';

const CHAIN_ID = 5042002n; // Arc testnet
const USDC = ledgerAssetCode('USDC');
const P6 = cbsPrecision(6);
const CLIENT = novaOwnerRef('client-demo-1');
const PID = paymentId(`pay-${'d3'.repeat(16)}`);
const TX = `0x${'ab'.repeat(32)}` as Hex32; // SIMULATED in demo (PAY unit pending)

const payer: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acct-client-demo-1') };
const clearing: LedgerAccount = { kind: 'ROLE', role: 'GL-5', sub: 'arc.outbound' };
const hot: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'arc.hot' };
const fees: LedgerAccount = { kind: 'ROLE', role: 'GL-6', sub: 'payments' };
const gasExpense: LedgerAccount = { kind: 'ROLE', role: 'GL-3', sub: 'arc' };
const name = (a: LedgerAccount): string => (a.kind === 'CUSTOMER' ? `CUSTOMER:${a.account}` : `${a.role}:${a.sub}`);

const AMOUNT = 2_500_000n; // 2.5 USDC to receiver
const FEE = 50_000n; // 0.05 USDC fee
const GAS = 21_000n; // 0.021 USDC gas (USDC is Arc's gas token)
const OPENING = 10_000_000n;

const leg = (account: LedgerAccount, side: Side, n: bigint): LedgerLeg => ({ account, side, amount: cbsMinor(n) as CbsMinor });
const refs = { paymentId: PID, network: null, txHash: null, logIndex: null, dfnsTransferId: null, compensates: null } as const;

function journals(): JournalRequest[] {
  return [
    { key: idempotencyKey('pay:demo:p1'), template: 'P1_RESERVE', asset: USDC, precision: P6, legs: [leg(payer, 'DEBIT', AMOUNT + FEE), leg(clearing, 'CREDIT', AMOUNT + FEE)], refs },
    { key: idempotencyKey('pay:demo:p2'), template: 'P2_SETTLE_EXTERNAL', asset: USDC, precision: P6, legs: [leg(clearing, 'DEBIT', AMOUNT + FEE), leg(hot, 'CREDIT', AMOUNT), leg(fees, 'CREDIT', FEE)], refs: { ...refs, txHash: TX } },
    { key: idempotencyKey('gas:5042002:demo'), template: 'P4_GAS', asset: USDC, precision: P6, legs: [leg(gasExpense, 'DEBIT', GAS), leg(hot, 'CREDIT', GAS)], refs: { ...refs, txHash: TX } },
  ];
}

function ledger(): MapLedger {
  const open = (account: LedgerAccount) => ({ account, status: 'OPEN' as const });
  return new MapLedger({
    assets: [{ asset: USDC, precision: P6 }],
    accounts: [payer, clearing, hot, fees, gasExpense].map(open),
    opening: [
      { account: payer, asset: USDC, side: 'CREDIT', amount: cbsMinor(OPENING) },
      { account: hot, asset: USDC, side: 'DEBIT', amount: cbsMinor(OPENING) },
    ],
  });
}

describe('DEMO ONLY: USDC payment with client history (Arc testnet, fakes)', () => {
  it('Scenario A: payment goes through and every step lands in client history', async () => {
    console.log('\n=== DEMO ONLY - fakes only; testnet only (chain 5042002); not the D1 payment unit; not gate evidence ===');
    expect(CHAIN_ID).toBe(5042002n);
    const led = ledger();
    const hist = new ListHistory();
    let leg_: LegState = { stage: 'CREATED', reason: null };
    const posted: JournalRequest[] = [];

    const step = async (eventId: string, code: string, stage: Stage, source: 'INTERNAL' | 'DFNS_WEBHOOK' | 'ARC_LOG', extra: Partial<HistoryEntryInput>, note: string, journal?: JournalRequest) => {
      const target = { stage, reason: null } as LegState;
      if (stage !== 'CREATED') {
        const verdict = decideTransition('ARC_TRANSFER', leg_, target, source, 'KNOWN');
        expect(verdict).toBe(eventId === 'ev-07-gas' ? 'DUPLICATE' : 'APPLIED'); // gas is a ledger+history step; stage stays COMPLETED
        leg_ = target;
      }
      const status = STATUS_BY_STAGE[stage];
      console.log(`\n[${eventId}] ${note}\n  stage=${stage} status=${status}`);
      if (journal !== undefined) {
        const r = await led.postJournal(journal);
        expect(r.kind).toBe('OK');
        posted.push(journal);
        console.log(`  ledger ${journal.template} key=${journal.key}`);
        for (const l of journal.legs) console.log(`    ${l.side.padEnd(6)} ${name(l.account)} ${l.amount} USDC-units`);
      }
      const h = await hist.append({ clientUid: CLIENT, paymentId: PID, eventId, kind: 'LEG', code, occurredAt: '2026-10-07T13:00:00Z', stage, status, leg: 'ARC_TRANSFER', amount: { asset: USDC, units: AMOUNT }, ...extra });
      if (h.kind !== 'OK') throw new Error(JSON.stringify(h));
      expect(h.value.key).toBe(historyKey(PID, eventId));
      console.log(`  history seq=${h.value.seq} key=${h.value.key}`);
    };

    await step('ev-01-created', 'PAYMENT_CREATED', 'CREATED', 'INTERNAL', {}, 'payment record created (SIMULATED in demo (PAY unit pending))');
    await step('ev-02-reserved', 'FUNDS_RESERVED', 'PENDING_APPROVAL', 'DFNS_WEBHOOK', {}, 'client funds reserved; awaiting approval (P1)', journals()[0]);
    await step('ev-03-approved', 'DFNS_APPROVED', 'APPROVED', 'DFNS_WEBHOOK', {}, 'DFNS approval (SIMULATED in demo (PAY unit pending))');
    await step('ev-04-submitted', 'TRANSFER_SUBMITTED', 'SUBMITTED', 'DFNS_WEBHOOK', {}, 'transfer submitted via DFNS (SIMULATED in demo (PAY unit pending))');
    await step('ev-05-confirming', 'TRANSFER_BROADCAST', 'CONFIRMING', 'DFNS_WEBHOOK', { txHash: TX }, `tx seen on Arc testnet ${TX.slice(0, 12)}... (SIMULATED confirmed log)`);
    await step('ev-06-settled', 'TRANSFER_CONFIRMED', 'COMPLETED', 'ARC_LOG', { txHash: TX }, 'Transfer log confirmed (SIMULATED); settlement posted (P2)', journals()[1]);
    await step('ev-07-gas', 'GAS_POSTED', 'COMPLETED', 'ARC_LOG', { txHash: TX }, 'gas in USDC posted (P4)', journals()[2]);

    // Postings balance per asset in integer units.
    const sums = new Map<string, bigint>();
    for (const j of posted) for (const l of j.legs) sums.set(`${j.asset}`, (sums.get(`${j.asset}`) ?? 0n) + (l.side === 'DEBIT' ? l.amount : -l.amount));
    expect([...sums.values()].every((v) => v === 0n)).toBe(true);
    const bal = async (a: LedgerAccount) => { const r = await led.getBalance(a, USDC); if (r.kind !== 'OK') throw new Error('bal'); return r.value; };
    expect(await bal(clearing)).toEqual({ debits: AMOUNT + FEE, credits: AMOUNT + FEE });
    expect(await bal(fees)).toEqual({ debits: 0n, credits: FEE });

    // History: one entry per step, in order.
    const list = await hist.list({ clientUid: CLIENT, paymentId: PID });
    if (list.kind !== 'OK') throw new Error('list');
    console.log('\n--- client history ---');
    for (const r of list.value) console.log(`  #${r.seq} ${r.entry.eventId} ${r.entry.code} ${r.entry.stage}/${r.entry.status} ${r.key}`);
    expect(list.value.map((r) => r.entry.eventId)).toEqual(['ev-01-created', 'ev-02-reserved', 'ev-03-approved', 'ev-04-submitted', 'ev-05-confirming', 'ev-06-settled', 'ev-07-gas']);
    expect(list.value.map((r) => r.seq)).toEqual([1n, 2n, 3n, 4n, 5n, 6n, 7n]);
    expect(list.value[6]?.entry.status).toBe('SETTLED');

    // Idempotency: same body replays, different body is KEY_CONFLICT.
    const first = list.value[5]!.entry;
    const same: HistoryEntryInput = { clientUid: CLIENT, paymentId: PID, eventId: first.eventId, kind: 'LEG', code: first.code, occurredAt: first.occurredAt, stage: 'COMPLETED', status: 'SETTLED', leg: 'ARC_TRANSFER', amount: { asset: USDC, units: AMOUNT }, txHash: TX };
    const replay = await hist.append(same);
    expect(replay).toMatchObject({ kind: 'OK', replayed: true });
    const conflict = await hist.append({ ...same, code: 'SOMETHING_ELSE' });
    expect(conflict).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    console.log('\nduplicate append (same body) -> replayed; (different body) -> KEY_CONFLICT');
    // Ledger idempotency too.
    expect(await led.postJournal(journals()[0]!)).toMatchObject({ kind: 'OK', replayed: true });
  });

  it('Scenario B: DFNS approval rejected -> FAILED status + history entry', async () => {
    const hist = new ListHistory();
    const verdict = decideTransition('ARC_TRANSFER', { stage: 'PENDING_APPROVAL', reason: null }, { stage: 'REJECTED', reason: 'APPROVAL_DENIED' } as LegState, 'DFNS_WEBHOOK', 'KNOWN');
    console.log(`\n[B] approval denied: transition verdict=${verdict}, status=${STATUS_BY_STAGE.REJECTED}`);
    const r = await hist.append({ clientUid: CLIENT, paymentId: PID, eventId: 'ev-b-rejected', kind: 'FAILURE', code: 'APPROVAL_DENIED', occurredAt: '2026-10-07T13:05:00Z', stage: 'REJECTED', status: 'FAILED', reason: 'APPROVAL_DENIED', leg: 'ARC_TRANSFER' });
    console.log(`  history ${r.kind === 'OK' ? r.value.key : JSON.stringify(r)}`);
    expect(r.kind).toBe('OK');
    expect(STATUS_BY_STAGE.REJECTED).toBe('FAILED');
  });
});
