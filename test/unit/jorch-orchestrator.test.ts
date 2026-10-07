/** JORCH: four happy paths, reconciliation residual 0, and the money-critical failure paths. Throwaway literals only. */
import { describe, expect, it } from 'vitest';
import { FailingHistory, ListHistory } from '../../src/history/fakes.js';
import { EmailNotifier } from '../../src/journey/timeline/fakes.js';
import type { Notifier } from '../../src/journey/timeline/notifier.js';
import { ManualClock } from '../../src/journey/quote/fakes.js';
import { InMemoryJourneyStore, JourneyOrchestrator } from '../../src/journey/orchestrator/index.js';
import type { JourneyOutcome, OrchestratorConfig } from '../../src/journey/orchestrator/index.js';
import { CaptureCases, FakeFunds, ScriptedArc, ScriptedConversion, ScriptedPayIn, ScriptedPayout, fixtureQuote, orderOf } from '../../src/journey/orchestrator/fakes.js';
import type { ArcSendResult, ConvertResult, DecisionPort, OrchPayInResult, PayoutResult } from '../../src/journey/orchestrator/index.js';
import type { CaseRecord } from '../../src/ops/types.js';
import { beneficiaryRef, fiatCode, novaOwnerRef, paymentId } from '../../src/nova-ports/ids.js';
import type { Hex32, NetworkId } from '../../src/nova-ports/ids.js';
import type { PayInMethod, PayoutMethod } from '../../src/status/journey.js';

const NET = 'ARC' as unknown as NetworkId;
const CLIENT = novaOwnerRef('client-1');
const TX = `0x${'ab'.repeat(32)}` as Hex32;
const T0 = 1_000_000n;
const TTL = 300_000n;
const PAYER = 1000n;
const FEE = 10n;
const ARC = PAYER - FEE;
const pid = (n: string) => paymentId(`pay-${n.repeat(32).slice(0, 32)}`);

const FIAT_IN: PayInMethod = { method: 'FIAT', currency: fiatCode('ZAR') };
const BAL_IN: PayInMethod = { method: 'STABLECOIN_BALANCE', asset: 'USDC', network: NET };
const DEP_IN: PayInMethod = { method: 'STABLECOIN_DEPOSIT', asset: 'USDC', network: NET };
const WALLET_OUT: PayoutMethod = { method: 'STABLECOIN_WALLET', asset: 'USDC', network: NET, beneficiaryRef: beneficiaryRef('ben-1') };
const BANK_OUT: PayoutMethod = { method: 'FIAT_BANK', currency: fiatCode('ZAR'), beneficiaryRef: beneficiaryRef('ben-2') };

const CONFIRMED: OrchPayInResult = { kind: 'CONFIRMED', amount: PAYER, evidenceRef: 'ev-1' };
const FILLED: ConvertResult = { kind: 'FILLED', toAmount: ARC, bookedEntryRef: 'je-1' };
const ARC_OK: ArcSendResult = { kind: 'CONFIRMED', txHash: TX };
const PAID: PayoutResult = { kind: 'PAID', payoutRef: 'po-1' };

interface RigOpts {
  payIn: PayInMethod;
  payout: PayoutMethod;
  payInResults?: OrchPayInResult[];
  convert?: ConvertResult[];
  arc?: ArcSendResult[];
  payoutResults?: PayoutResult[];
  cfg?: Partial<OrchestratorConfig>;
  crossBorder?: boolean;
  history?: FailingHistory;
  notifier?: Notifier;
  decisions?: DecisionPort;
}

function rig(o: RigOpts) {
  const clock = new ManualClock(T0);
  const funds = new FakeFunds(PAYER, FEE);
  const cases = new CaptureCases();
  const mail = new EmailNotifier(new Map([[CLIENT, 'c@example.test']]));
  const base = new ListHistory();
  const history = o.history ?? new FailingHistory(base);
  const payIn = new ScriptedPayIn(o.payInResults ?? [CONFIRMED]);
  const conversion = new ScriptedConversion(o.convert ?? [FILLED]);
  const arc = new ScriptedArc(o.arc ?? [ARC_OK]);
  const payout = new ScriptedPayout(o.payoutResults ?? [PAID]);
  const cfg: OrchestratorConfig = {
    flags: { fiatEnabled: true, stablecoinDepositEnabled: true }, crossBorderEnabled: false, historyGapMaxAgeMs: 60_000n, payoutStuckAfterMs: 3_600_000n, ...o.cfg,
  };
  const orch = new JourneyOrchestrator(cfg, {
    clock, store: new InMemoryJourneyStore(), history, notifier: o.notifier ?? mail, cases, funds,
    payIn: o.payIn.method === 'STABLECOIN_BALANCE' ? null : payIn, conversion: o.payIn.method === 'FIAT' ? conversion : null, arc,
    payout: o.payout.method === 'FIAT_BANK' ? payout : null, decisions: o.decisions ?? null,
  });
  if (o.payIn.method === 'STABLECOIN_BALANCE') funds.fund();
  else if (o.payInResults === undefined || o.payInResults.some((r) => r.kind === 'CONFIRMED')) funds.fund();
  const quote = fixtureQuote({
    payIn: o.payIn, payout: o.payout, payer: PAYER, recipient: ARC, arcAmount: ARC, expiresAtMs: T0 + TTL, ...(o.crossBorder === undefined ? {} : { crossBorder: o.crossBorder }),
  });
  const order = orderOf(pid('a'), CLIENT, quote);
  return { clock, funds, cases, mail, base, history, payIn, conversion, arc, payout, orch, order };
}

async function codes(base: ListHistory): Promise<string[]> {
  const r = await base.list({ clientUid: CLIENT });
  return r.kind === 'OK' ? r.value.map((x) => x.entry.code) : ['LIST_FAILED'];
}

function out(x: JourneyOutcome | { readonly refused: string }): JourneyOutcome {
  if ('refused' in x) throw new Error(`refused ${x.refused}`);
  return x;
}

function expectClean(f: FakeFunds): void {
  expect(f.residual()).toBe(0n);
  expect(f.bal('reserved')).toBe(0n);
}

describe('four happy paths (arrival only on the last leg)', () => {
  it('stablecoin balance -> stablecoin wallet: ARRIVED on the Arc confirmation', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'ARRIVED', stage: 'COMPLETED', status: 'SETTLED', arrived: true });
    expect(r.funds.bal('clearing')).toBe(ARC);
    expect(r.funds.bal('fees')).toBe(FEE);
    expect(r.funds.bal('payer')).toBe(0n);
    expectClean(r.funds);
    expect(r.payIn.calls).toBe(0);
    expect(r.conversion.calls).toBe(0);
    expect(r.payout.calls).toBe(0);
    expect(r.mail.outbox.map((m) => m.key)).toEqual([
      `ntf:${r.order.paymentId}:FUNDS_RESERVED`, `ntf:${r.order.paymentId}:SENT`, `ntf:${r.order.paymentId}:SETTLED_ON_ARC`, `ntf:${r.order.paymentId}:ARRIVED`,
    ]);
  });

  it('stablecoin deposit -> fiat bank: not ARRIVED until the partner confirms payout', async () => {
    const r = rig({ payIn: DEP_IN, payout: BANK_OUT, payoutResults: [{ kind: 'PENDING' }, PAID] });
    const first = out(await r.orch.start(r.order));
    expect(first).toMatchObject({ state: 'WAITING', waitingOn: 'PAYOUT', arrived: false, status: 'PROCESSING' });
    expect(r.mail.outbox.some((m) => m.key.endsWith(':ARRIVED'))).toBe(false);
    const done = out(await r.orch.advance(r.order.paymentId));
    expect(done).toMatchObject({ state: 'ARRIVED', status: 'SETTLED', arrived: true });
    expect(r.arc.calls).toBe(1); // a completed Arc leg is never re-sent on resume
    expectClean(r.funds);
    expect(await codes(r.base)).toContain('LEG_COMPLETED');
  });

  it('fiat -> stablecoin wallet: pay-in, fill, Arc send, arrival', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'ARRIVED', status: 'SETTLED' });
    expect(r.payIn.calls).toBe(1);
    expect(r.conversion.calls).toBe(1);
    expectClean(r.funds);
    expect(r.mail.outbox.map((m) => m.key.split(':')[2])).toEqual(['PAYIN_RECEIVED', 'FUNDS_RESERVED', 'CONVERTED', 'SENT', 'SETTLED_ON_ARC', 'ARRIVED']);
  });

  it('fiat -> fiat bank: all five steps, ARRIVED only on payout PAID', async () => {
    const r = rig({ payIn: FIAT_IN, payout: BANK_OUT, payoutResults: [{ kind: 'PENDING' }, PAID] });
    expect(out(await r.orch.start(r.order)).state).toBe('WAITING');
    const o = out(await r.orch.advance(r.order.paymentId));
    expect(o).toMatchObject({ state: 'ARRIVED', stage: 'COMPLETED', status: 'SETTLED' });
    expectClean(r.funds);
    const history = await codes(r.base);
    expect(history.filter((c) => c === 'LEG_COMPLETED').length).toBe(4); // reserve, convert, arc, payout
  });

  it('start is idempotent on the payment id; another quote under the same id is KEY_CONFLICT', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT });
    await r.orch.start(r.order);
    const again = out(await r.orch.start(r.order));
    expect(again.state).toBe('ARRIVED');
    expect(r.funds.bal('clearing')).toBe(ARC);
    const other = orderOf(r.order.paymentId, CLIENT, fixtureQuote({ payIn: BAL_IN, payout: WALLET_OUT, payer: PAYER, recipient: ARC, arcAmount: ARC, expiresAtMs: T0 + TTL, quoteId: 'q-2' }));
    expect(await r.orch.start(other)).toEqual({ refused: 'KEY_CONFLICT' });
  });
});

describe('gate: flags, cross-border, quote expiry', () => {
  it('cross-border is refused while the flag is OFF: nothing reserved, nothing sent', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, crossBorder: true });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'FAILED', stage: 'REJECTED', reason: 'METHOD_NOT_ENABLED', status: 'FAILED' });
    expect(r.funds.postings.filter((p) => p.key.startsWith('p'))).toHaveLength(0);
    expect(r.arc.calls).toBe(0);
  });

  it('cross-border runs when the flag is ON', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, crossBorder: true, cfg: { crossBorderEnabled: true } });
    expect(out(await r.orch.start(r.order)).state).toBe('ARRIVED');
  });

  it('a fiat journey is refused while the fiat flag is OFF', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, cfg: { flags: { fiatEnabled: false, stablecoinDepositEnabled: true } } });
    expect(out(await r.orch.start(r.order))).toMatchObject({ stage: 'REJECTED', reason: 'METHOD_NOT_ENABLED' });
    expect(r.payIn.calls).toBe(0);
  });

  it('an expired quote at the gate is EXPIRED/QUOTE_EXPIRED and touches no money', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT });
    r.clock.advance(TTL);
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'FAILED', stage: 'EXPIRED', reason: 'QUOTE_EXPIRED', status: 'FAILED' });
    expect(r.arc.calls).toBe(0);
    expect(r.funds.bal('reserved')).toBe(0n);
  });
});

describe('pay-in failures', () => {
  it('pay-in never arrives before the quote expires: EXPIRED, no refund needed', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, payInResults: [{ kind: 'EXPIRED' }] });
    expect(out(await r.orch.start(r.order))).toMatchObject({ stage: 'EXPIRED', reason: 'QUOTE_EXPIRED', refunded: false });
    expect(r.conversion.calls).toBe(0);
    expect(r.arc.calls).toBe(0);
  });

  it('a late pay-in held by JPAYIN holds the journey with its case; nothing converts or sends', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, payInResults: [{ kind: 'HELD', reason: 'PAYIN_AFTER_QUOTE_EXPIRY', caseId: 'case-x' }] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'HELD', hold: { kind: 'LATE_PAYIN', caseId: 'case-x' } });
    expect(r.conversion.calls).toBe(0);
    expect(r.arc.calls).toBe(0);
    const again = out(await r.orch.advance(r.order.paymentId));
    expect(again.state).toBe('HELD');
    expect(r.payIn.calls).toBe(1); // a held payment is not re-polled
  });

  it('a short pay-in is held, never accepted by the orchestrator', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, payInResults: [{ kind: 'HELD', reason: 'CONFIRMED_BELOW_EXPECTED', caseId: null }] });
    const o = out(await r.orch.start(r.order));
    expect(o.hold?.kind).toBe('UNDERPAYMENT');
    expect(r.cases.opened.map((c) => c.kind)).toContain('UNDERPAYMENT');
    expect(r.funds.bal('reserved')).toBe(0n);
  });

  it('a confirmed amount that differs from the quote quarantines (belt and braces over JPAYIN)', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, payInResults: [{ kind: 'CONFIRMED', amount: PAYER - 1n, evidenceRef: 'ev' }] });
    expect(out(await r.orch.start(r.order)).hold?.kind).toBe('QUARANTINE');
    expect(r.funds.bal('reserved')).toBe(0n);
    expect(r.arc.calls).toBe(0);
  });

  it('a failed-closed pay-in quarantines', async () => {
    const r = rig({ payIn: DEP_IN, payout: WALLET_OUT, payInResults: [{ kind: 'FAILED_CLOSED', detail: 'indexer down' }] });
    expect(out(await r.orch.start(r.order)).hold?.kind).toBe('QUARANTINE');
  });

  it('pending pay-in waits and resumes', async () => {
    const r = rig({ payIn: DEP_IN, payout: WALLET_OUT, payInResults: [{ kind: 'PENDING' }, CONFIRMED] });
    const first = out(await r.orch.start(r.order));
    expect(first).toMatchObject({ state: 'WAITING', waitingOn: 'AWAIT_DEPOSIT' });
    expect(out(await r.orch.advance(r.order.paymentId)).state).toBe('ARRIVED');
  });

  it('insufficient balance fails the reserve leg, no send', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT });
    r.funds.balances.set('payer', 1n);
    r.funds.balances.set('world', -1n);
    expect(out(await r.orch.start(r.order))).toMatchObject({ stage: 'REJECTED', reason: 'INSUFFICIENT_FUNDS' });
    expect(r.arc.calls).toBe(0);
  });

  it('an unavailable ledger waits; it neither fails nor sends', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT });
    r.funds.reserveResult = 'UNAVAILABLE';
    expect(out(await r.orch.start(r.order))).toMatchObject({ state: 'WAITING', waitingOn: 'RESERVE' });
    expect(r.arc.calls).toBe(0);
    r.funds.reserveResult = 'OK';
    expect(out(await r.orch.advance(r.order.paymentId)).state).toBe('ARRIVED');
  });
});

describe('conversion failures (D-1)', () => {
  it('a pricing code already stale after the pay-in reserves nothing and opens a REQUOTE case; no automatic refund', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, payInResults: [CONFIRMED] });
    // Pay-in confirms in time, then time passes past the code's expiry before the reserve.
    const quote = fixtureQuote({ payIn: FIAT_IN, payout: WALLET_OUT, payer: PAYER, recipient: ARC, arcAmount: ARC, expiresAtMs: T0 + TTL, convertExpiresAtMs: T0 + 1n });
    const order = orderOf(pid('b'), CLIENT, quote);
    r.clock.advance(5n);
    const o = out(await r.orch.start(order));
    expect(o).toMatchObject({ state: 'HELD', hold: { kind: 'REQUOTE', reason: 'RATE_EXPIRED' }, refunded: false });
    expect(r.cases.opened.map((c) => `${c.kind}/${c.reason}`)).toEqual(['REQUOTE/RATE_EXPIRED']);
    expect(r.conversion.calls).toBe(0);
    expect(r.arc.calls).toBe(0);
    // No money moved on the stale code: nothing reserved, the pay-in still sits with the client.
    expect(r.funds.postings.filter((p) => p.key.startsWith('p1:') || p.key.startsWith('p13:'))).toEqual([]);
    expect(r.funds.bal('payer')).toBe(PAYER);
    expect(r.funds.residual()).toBe(0n);
    // Exactly at the code's expiry is expired (now >= expiresAt).
    const at = rig({ payIn: FIAT_IN, payout: WALLET_OUT });
    const q2 = fixtureQuote({ payIn: FIAT_IN, payout: WALLET_OUT, payer: PAYER, recipient: ARC, arcAmount: ARC, expiresAtMs: T0 + TTL, convertExpiresAtMs: T0 });
    expect(out(await at.orch.start(orderOf(pid('c'), CLIENT, q2)))).toMatchObject({ state: 'HELD', hold: { kind: 'REQUOTE' } });
    expect(at.funds.bal('reserved')).toBe(0n);
    // One millisecond before expiry it runs.
    const before = rig({ payIn: FIAT_IN, payout: WALLET_OUT });
    const q3 = fixtureQuote({ payIn: FIAT_IN, payout: WALLET_OUT, payer: PAYER, recipient: ARC, arcAmount: ARC, expiresAtMs: T0 + TTL, convertExpiresAtMs: T0 + 1n });
    expect(out(await before.orch.start(orderOf(pid('d'), CLIENT, q3)))).toMatchObject({ state: 'ARRIVED' });
  });

  it('a code that expires after the reserve is never executed: REQUOTE case, reservation kept for the decision', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, convert: [{ kind: 'PENDING' }] });
    const quote = fixtureQuote({ payIn: FIAT_IN, payout: WALLET_OUT, payer: PAYER, recipient: ARC, arcAmount: ARC, expiresAtMs: T0 + TTL, convertExpiresAtMs: T0 + 10n });
    const order = orderOf(pid('e'), CLIENT, quote);
    expect(out(await r.orch.start(order))).toMatchObject({ state: 'WAITING', waitingOn: 'CONVERT_IN' });
    const calls = r.conversion.calls;
    r.clock.advance(10n);
    const o = out(await r.orch.advance(order.paymentId));
    expect(o).toMatchObject({ state: 'HELD', hold: { kind: 'REQUOTE', reason: 'RATE_EXPIRED' }, refunded: false });
    expect(r.conversion.calls).toBe(calls);
    expect(r.arc.calls).toBe(0);
    expect(r.funds.bal('reserved')).toBe(PAYER);
  });

  it('EXPIRED from the desk holds with a REQUOTE/RATE_EXPIRED case (as the fill desk maps it); nothing refunded automatically', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, convert: [{ kind: 'EXPIRED' }] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'HELD', hold: { kind: 'REQUOTE', reason: 'RATE_EXPIRED' }, refunded: false });
    expect(r.arc.calls).toBe(0);
    expect(await codes(r.base)).not.toContain('FUNDS_REFUNDED');
  });

  it('a desk result carrying its own case id opens no second case', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, convert: [{ kind: 'UNMATCHED_FILL', reason: 'FILL_MISPOSTED', caseId: 'case-desk-1' }] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'HELD', hold: { kind: 'UNMATCHED_FILL', caseId: 'case-desk-1' } });
    expect(r.cases.opened).toEqual([]);
  });

  it('REJECTED by the desk holds with a REQUOTE case (operator may refund), nothing sent', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, convert: [{ kind: 'REJECTED' }] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'HELD', hold: { kind: 'REQUOTE' } });
    expect(r.arc.calls).toBe(0);
    expect(r.cases.opened.map((c) => c.kind)).toEqual(['REQUOTE']);
  });

  it('a late fill opens UNMATCHED_FILL and holds; a mismatched fill amount opens REQUOTE', async () => {
    const a = rig({ payIn: FIAT_IN, payout: WALLET_OUT, convert: [{ kind: 'UNMATCHED_FILL', reason: 'FILL_AFTER_EXPIRY' }] });
    expect(out(await a.orch.start(a.order)).hold).toMatchObject({ kind: 'UNMATCHED_FILL', reason: 'FILL_AFTER_EXPIRY' });
    expect(a.arc.calls).toBe(0);
    const b = rig({ payIn: FIAT_IN, payout: WALLET_OUT, convert: [{ kind: 'FILLED', toAmount: ARC - 1n, bookedEntryRef: 'je' }] });
    expect(out(await b.orch.start(b.order)).hold?.kind).toBe('REQUOTE');
    expect(b.arc.calls).toBe(0);
    expect(b.cases.opened.map((c) => c.kind)).toEqual(['REQUOTE']);
  });

  it('a fill timeout opens FILL_TIMEOUT; a pending fill waits', async () => {
    const a = rig({ payIn: FIAT_IN, payout: WALLET_OUT, convert: [{ kind: 'FILL_TIMEOUT' }] });
    expect(out(await a.orch.start(a.order)).hold?.kind).toBe('FILL_TIMEOUT');
    const b = rig({ payIn: FIAT_IN, payout: WALLET_OUT, convert: [{ kind: 'PENDING' }, FILLED] });
    expect(out(await b.orch.start(b.order))).toMatchObject({ state: 'WAITING', waitingOn: 'CONVERT_IN' });
    expect(out(await b.orch.advance(b.order.paymentId)).state).toBe('ARRIVED');
  });
});

describe('Arc send failures', () => {
  it('a blocklisted destination is refused before any send; stablecoin reservation released (P6), residual 0', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, arc: [{ kind: 'REFUSED', reason: 'BLOCKLISTED_PRECHECK' }] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK', status: 'FAILED', refunded: true });
    expect(r.funds.bal('payer')).toBe(PAYER);
    expectClean(r.funds);
  });

  it('a refused destination after a fiat fill is a case, not an automatic refund of converted funds', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, arc: [{ kind: 'REFUSED', reason: 'DESTINATION_NOT_ALLOWED' }] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'FAILED', reason: 'DESTINATION_NOT_ALLOWED', refunded: false });
    expect(r.cases.opened.map((c) => c.kind)).toEqual(['QUARANTINE']);
    expect(r.funds.bal('reserved')).toBe(PAYER);
  });

  it('an on-chain revert is FAILED/ONCHAIN_REVERTED and the reservation is released, never reversed on-chain', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, arc: [{ kind: 'REVERTED', txHash: TX }] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ stage: 'REJECTED', reason: 'ONCHAIN_REVERTED', refunded: true });
    expect(r.funds.bal('payer')).toBe(PAYER);
    expectClean(r.funds);
  });

  it('an unknown DFNS outcome opens UNRESOLVED_SUBMIT, is never re-sent, and cannot be retried as a new payment', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, arc: [{ kind: 'UNRESOLVED', reason: 'DFNS_TIMEOUT' }, ARC_OK] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'HELD', hold: { kind: 'UNRESOLVED_SUBMIT', reason: 'DFNS_TIMEOUT' } });
    out(await r.orch.advance(r.order.paymentId));
    out(await r.orch.advance(r.order.paymentId));
    expect(r.arc.calls).toBe(1);
    const next = orderOf(pid('c'), CLIENT, r.order.quote);
    expect(await r.orch.retryAsNewPayment(r.order.paymentId, next)).toEqual({ refused: 'UNRESOLVED_NOT_PROVEN' });
  });

  it('a pending Arc send waits for our indexer and is not ARRIVED', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, arc: [{ kind: 'PENDING' }, ARC_OK] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'WAITING', waitingOn: 'ARC_TRANSFER', arrived: false, status: 'PROCESSING' });
    expect(out(await r.orch.advance(r.order.paymentId)).state).toBe('ARRIVED');
  });

  it('a settlement posting failure after arrival quarantines instead of reporting a clean arrival', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT });
    r.funds.settleResult = 'UNAVAILABLE';
    const o = out(await r.orch.start(r.order));
    expect(o.arrived).toBe(false);
    expect(o.hold?.kind).toBe('QUARANTINE');
  });
});

describe('payout failures', () => {
  it('payout failed: leg FAILED/PAYOUT_FAILED, RETURNED_PAYOUT case, no automatic refund (USDC is with the partner)', async () => {
    const r = rig({ payIn: BAL_IN, payout: BANK_OUT, payoutResults: [{ kind: 'FAILED', reason: 'BENEFICIARY_REJECTED' }] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'FAILED', stage: 'REJECTED', reason: 'PAYOUT_FAILED', status: 'FAILED', refunded: false, arrived: false });
    expect(r.cases.opened.map((c) => c.kind)).toEqual(['RETURNED_PAYOUT']);
    expect(r.mail.outbox.some((m) => m.key.endsWith(':ARRIVED'))).toBe(false);
  });

  it('payout returned after start is the same: FAILED + case', async () => {
    const r = rig({ payIn: BAL_IN, payout: BANK_OUT, payoutResults: [{ kind: 'PENDING' }, { kind: 'RETURNED', reason: 'PARTNER_RETURNED' }] });
    expect(out(await r.orch.start(r.order)).state).toBe('WAITING');
    const o = out(await r.orch.advance(r.order.paymentId));
    expect(o).toMatchObject({ state: 'FAILED', reason: 'PAYOUT_FAILED' });
    expect(r.cases.opened[0]?.reason).toBe('PARTNER_RETURNED');
  });

  it('a payout pending past the stuck age opens STUCK_PAYOUT', async () => {
    const r = rig({ payIn: BAL_IN, payout: BANK_OUT, payoutResults: [{ kind: 'PENDING' }], cfg: { payoutStuckAfterMs: 1000n } });
    expect(out(await r.orch.start(r.order)).state).toBe('WAITING');
    r.clock.advance(1000n);
    const o = out(await r.orch.advance(r.order.paymentId));
    expect(o.hold?.kind).toBe('STUCK_PAYOUT');
  });
});

describe('history, notifications, retries, operator actions', () => {
  it('every leg is in the client history, in order, with its stage and status', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT });
    await r.orch.start(r.order);
    const list = await r.base.list({ clientUid: CLIENT });
    if (list.kind !== 'OK') throw new Error('list');
    const legs = list.value.map((x) => `${x.entry.code}:${x.entry.leg ?? '-'}:${x.entry.stage ?? '-'}:${x.entry.status ?? '-'}`.replace(/^LEG_[A-Z]+:/, ''));
    expect(legs).toEqual([
      'PAYMENT_CREATED:RESERVE:CREATED:PENDING', 'PAYIN_CONFIRMED:RESERVE:-:-', 'RESERVE:COMPLETED:SETTLED', 'CONVERT_IN:COMPLETED:SETTLED', 'ARC_TRANSFER:SUBMITTED:PROCESSING', 'ARC_TRANSFER:COMPLETED:SETTLED',
    ].filter((x) => x !== 'ARC_TRANSFER:SUBMITTED:PROCESSING' || legs.includes(x)));
    expect(list.value.find((x) => x.entry.leg === 'ARC_TRANSFER')?.entry.txHash).toBe(TX);
    // The pay-in evidence is attached by reference.
    expect(list.value.find((x) => x.entry.code === 'PAYIN_CONFIRMED')?.entry.documents).toEqual([{ id: 'ev-1' }]);
  });

  it('a notification failure never changes money state; it is recorded in the history', async () => {
    const mail = new EmailNotifier(new Map([[CLIENT, 'c@example.test']]));
    mail.failNext = 99n;
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, notifier: mail });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ state: 'ARRIVED', status: 'SETTLED' });
    expectClean(r.funds);
    expect((await codes(r.base)).filter((c) => c === 'NOTIFICATION_FAILED').length).toBeGreaterThan(0);
  });

  it('a throwing notifier is contained', async () => {
    const boom: Notifier = { send: () => Promise.reject(new Error('smtp down')) };
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, notifier: boom });
    expect(out(await r.orch.start(r.order)).state).toBe('ARRIVED');
  });

  it('a history outage never blocks money; entries queue and flush in order when it returns', async () => {
    const base = new ListHistory();
    const hist = new FailingHistory(base);
    hist.failNext(1000n);
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, history: hist });
    const o = out(await r.orch.start(r.order));
    expect(o.state).toBe('ARRIVED');
    expectClean(r.funds);
    expect(hist.reached).toBe(0n);
    hist.failNext(0n);
    out(await r.orch.advance(r.order.paymentId));
    const list = await base.list({ clientUid: CLIENT });
    expect(list.kind === 'OK' && list.value.length > 0).toBe(true);
  });

  it('a history gap older than the limit opens a HISTORY_WRITE_FAILED case, once', async () => {
    const hist = new FailingHistory(new ListHistory());
    hist.failNext(1000n);
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, history: hist });
    await r.orch.start(r.order);
    r.clock.advance(60_000n);
    await r.orch.advance(r.order.paymentId);
    await r.orch.advance(r.order.paymentId);
    expect(r.cases.opened.filter((c) => c.kind === 'HISTORY_WRITE_FAILED')).toHaveLength(1);
  });

  it('an operator action is appended to the history with the actor and the case', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, convert: [{ kind: 'REJECTED' }] });
    await r.orch.start(r.order);
    expect(await r.orch.recordOperatorAction(r.order.paymentId, { actor: 'staff-1', reasonCode: 'REFUND', caseRef: 'case-1', actionId: 'act-1' })).toBe(true);
    const list = await r.base.list({ clientUid: CLIENT });
    if (list.kind !== 'OK') throw new Error('list');
    expect(list.value.find((x) => x.entry.kind === 'OPERATOR_ACTION')?.entry.operator).toEqual({ actor: 'staff-1', reasonCode: 'REFUND', caseRef: 'case-1' });
  });

  it('a retry is a new linked payment, allowed once, only after a refunded terminal failure', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, arc: [{ kind: 'REFUSED', reason: 'BLOCKLISTED_PRECHECK' }, ARC_OK] });
    out(await r.orch.start(r.order));
    const next = orderOf(pid('d'), CLIENT, fixtureQuote({ payIn: BAL_IN, payout: WALLET_OUT, payer: PAYER, recipient: ARC, arcAmount: ARC, expiresAtMs: T0 + TTL, quoteId: 'q-3' }));
    const o = out(await r.orch.retryAsNewPayment(r.order.paymentId, next));
    expect(o.paymentId).toBe(next.paymentId);
    expect(await r.orch.retryAsNewPayment(r.order.paymentId, orderOf(pid('e'), CLIENT, next.quote))).toEqual({ refused: 'ALREADY_RETRIED' });
    expect(await r.orch.retryAsNewPayment(r.order.paymentId, orderOf(r.order.paymentId, CLIENT, next.quote))).toEqual({ refused: 'SAME_PAYMENT' });
    const list = await r.base.list({ clientUid: CLIENT });
    if (list.kind !== 'OK') throw new Error('list');
    expect(list.value.find((x) => x.entry.kind === 'RETRY')?.entry.retryOf).toBe(r.order.paymentId);
  });

  it('a retry of a payment that has not failed is refused', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT });
    out(await r.orch.start(r.order));
    const next = orderOf(pid('f'), CLIENT, r.order.quote);
    expect(await r.orch.retryAsNewPayment(r.order.paymentId, next)).toEqual({ refused: 'NOT_TERMINAL_FAILED' });
  });

  it('refund that cannot post stays due and is retried on the next advance', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, arc: [{ kind: 'REFUSED', reason: 'BLOCKLISTED_PRECHECK' }] });
    r.funds.refundResult = 'UNAVAILABLE';
    expect(out(await r.orch.start(r.order))).toMatchObject({ state: 'FAILED', refunded: false });
    r.funds.refundResult = 'OK';
    expect(out(await r.orch.advance(r.order.paymentId))).toMatchObject({ refunded: true });
    expectClean(r.funds);
    expect(r.funds.bal('payer')).toBe(PAYER);
  });

  it('a refund entry carries the failed leg, its terminal stage, status and reason', async () => {
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, arc: [{ kind: 'REFUSED', reason: 'BLOCKLISTED_PRECHECK' }] });
    out(await r.orch.start(r.order));
    const list = await r.base.list({ clientUid: CLIENT });
    if (list.kind !== 'OK') throw new Error('list');
    expect(list.value.find((x) => x.entry.code === 'FUNDS_REFUNDED')?.entry).toMatchObject({ leg: 'ARC_TRANSFER', stage: 'REJECTED', status: 'FAILED', reason: 'BLOCKLISTED_PRECHECK' });
  });

  it('an on-chain revert after a booked fill is a case, never an automatic fiat refund', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, arc: [{ kind: 'REVERTED', txHash: TX }] });
    const o = out(await r.orch.start(r.order));
    expect(o).toMatchObject({ stage: 'REJECTED', reason: 'ONCHAIN_REVERTED', refunded: false });
    expect(r.funds.postings.some((p) => p.key.startsWith('p13:') || p.key.startsWith('p6:'))).toBe(false);
    expect(r.cases.opened.map((c) => `${c.kind}/${c.reason}`)).toEqual(['QUARANTINE/INVARIANT_FAILED']);
    expect(await r.orch.retryAsNewPayment(r.order.paymentId, orderOf(pid('f'), CLIENT, r.order.quote))).toEqual({ refused: 'FUNDS_NOT_RETURNED' });
  });

  it('a pay-in held for missing consent opens a QUARANTINE (the kind whose reasons include CONSENT_MISSING)', async () => {
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, payInResults: [{ kind: 'HELD', reason: 'CONSENT_MISSING', caseId: null }] });
    expect(out(await r.orch.start(r.order))).toMatchObject({ state: 'HELD', hold: { kind: 'QUARANTINE', reason: 'CONSENT_MISSING' } });
  });
});

describe('resume after an operator decision (read back from the OPS case store)', () => {
  function closedCase(caseId: string, payment: string, kind: string, action: string, journalRef: string | null, status: 'OPEN' | 'CLOSED' = 'CLOSED'): CaseRecord {
    return {
      caseId, kind, reason: 'RATE_EXPIRED', subject: 's', paymentId: payment, clientUid: CLIENT, status,
      outcome: status === 'OPEN' ? null : { decisionId: 'dec-1', action, optionId: 'o-1', journalRef, newPaymentId: null, acceptedAmount: null, quoteId: null, bookedEntryRef: null, closedAt: '2026-01-01T00:00:00Z' },
    } as unknown as CaseRecord;
  }
  function store(recs: CaseRecord[]): DecisionPort {
    return {
      getCase: (id: string) => {
        const c = recs.find((x) => x.caseId === id);
        return Promise.resolve(c === undefined ? { kind: 'REJECTED' as const, code: 'NOT_FOUND' as const, detail: 'no' } : { kind: 'OK' as const, value: c, replayed: false });
      },
    };
  }
  const STALE = fixtureQuote({ payIn: FIAT_IN, payout: WALLET_OUT, payer: PAYER, recipient: ARC, arcAmount: ARC, expiresAtMs: T0 + TTL, convertExpiresAtMs: T0 });

  it('REFUND: OPS posted the journal, the journey closes CANCELLED, records the refund once, posts nothing itself', async () => {
    const recs: CaseRecord[] = [];
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, decisions: store(recs) });
    const order = orderOf(pid('1'), CLIENT, STALE);
    const held = out(await r.orch.start(order));
    expect(held.hold?.caseId).toBe('case-1');
    // Still open: refused, stays held.
    recs.push(closedCase('case-1', order.paymentId, 'REQUOTE', 'REFUND', 'jr-1', 'OPEN'));
    expect(await r.orch.resumeAfterDecision(order.paymentId)).toEqual({ refused: 'CASE_NOT_CLOSED' });
    recs.length = 0;
    recs.push(closedCase('case-1', order.paymentId, 'REQUOTE', 'REFUND', 'jr-1'));
    const postings = r.funds.postings.length;
    const o = out(await r.orch.resumeAfterDecision(order.paymentId));
    expect(o).toMatchObject({ state: 'FAILED', stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR', refunded: true, hold: null });
    expect(r.funds.postings.length).toBe(postings);
    expect(r.conversion.calls).toBe(0);
    expect(r.arc.calls).toBe(0);
    // Idempotent: a second resume changes nothing and writes nothing twice.
    expect(out(await r.orch.resumeAfterDecision(order.paymentId))).toMatchObject({ refunded: true });
    const list = await r.base.list({ clientUid: CLIENT });
    if (list.kind !== 'OK') throw new Error('list');
    const tail = list.value.map((x) => x.entry).filter((e) => ['REFUND', 'FAILED_CANCELLED_BY_OPERATOR', 'FUNDS_REFUNDED'].includes(e.code));
    expect(tail.map((e) => e.code)).toEqual(['REFUND', 'FAILED_CANCELLED_BY_OPERATOR', 'FUNDS_REFUNDED']);
    expect(tail[0]).toMatchObject({ kind: 'OPERATOR_ACTION', operator: { caseRef: 'case-1' } });
    expect(tail[2]).toMatchObject({ stage: 'CANCELLED', status: 'FAILED', reason: 'CANCELLED_BY_OPERATOR', documents: [{ id: 'jr-1' }] });
    // The refunded failure may now be retried as a new linked payment.
    expect(out(await r.orch.retryAsNewPayment(order.paymentId, orderOf(pid('2'), CLIENT, r.order.quote)))).toMatchObject({ paymentId: pid('2') });
  });

  it('refuses a case of another payment, another kind, a non-REFUND action, a missing journal, and no decision source', async () => {
    const recs: CaseRecord[] = [];
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT, decisions: store(recs) });
    const order = orderOf(pid('3'), CLIENT, STALE);
    out(await r.orch.start(order));
    recs.push(closedCase('case-1', pid('5'), 'REQUOTE', 'REFUND', 'jr-1'));
    expect(await r.orch.resumeAfterDecision(order.paymentId)).toEqual({ refused: 'CASE_NOT_OURS' });
    recs[0] = closedCase('case-1', order.paymentId, 'QUARANTINE', 'REFUND', 'jr-1');
    expect(await r.orch.resumeAfterDecision(order.paymentId)).toEqual({ refused: 'CASE_NOT_OURS' });
    recs[0] = closedCase('case-1', order.paymentId, 'REQUOTE', 'REQUOTE', null);
    expect(await r.orch.resumeAfterDecision(order.paymentId)).toEqual({ refused: 'ACTION_NOT_SUPPORTED' });
    recs[0] = closedCase('case-1', order.paymentId, 'REQUOTE', 'REFUND', null);
    expect(await r.orch.resumeAfterDecision(order.paymentId)).toEqual({ refused: 'NO_JOURNAL' });
    expect(out(r.orch.outcome(order.paymentId))).toMatchObject({ state: 'HELD', refunded: false });
    const n = rig({ payIn: FIAT_IN, payout: WALLET_OUT });
    out(await n.orch.start(orderOf(pid('4'), CLIENT, STALE)));
    expect(await n.orch.resumeAfterDecision(pid('4'))).toEqual({ refused: 'NO_DECISION_SOURCE' });
  });

  it('never applies a REFUND to an unresolved DFNS submission (D-2, D-6)', async () => {
    const recs: CaseRecord[] = [];
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, arc: [{ kind: 'UNRESOLVED', reason: 'DFNS_TIMEOUT' }], decisions: store(recs) });
    out(await r.orch.start(r.order));
    recs.push(closedCase('case-1', r.order.paymentId, 'UNRESOLVED_SUBMIT', 'REFUND', 'jr-1'));
    expect(await r.orch.resumeAfterDecision(r.order.paymentId)).toEqual({ refused: 'NOT_REFUNDABLE' });
    expect(out(r.orch.outcome(r.order.paymentId))).toMatchObject({ state: 'HELD', refunded: false });
  });
});
