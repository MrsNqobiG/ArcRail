/**
 * DEMO ONLY. Narrated walkthrough of the journey orchestrator, built on its
 * own fakes. Every number printed is read from the objects (quote, ledger
 * fake, history fake). Also a test: key facts are asserted.
 */
import { describe, expect, it } from 'vitest';
import { ListHistory } from '../src/history/fakes.js';
import type { HistoryPort, HistoryRecord } from '../src/history/index.js';
import { EmailNotifier } from '../src/journey/timeline/fakes.js';
import { ManualClock } from '../src/journey/quote/fakes.js';
import { InMemoryJourneyStore, JourneyOrchestrator } from '../src/journey/orchestrator/index.js';
import type {
  ArcSendPort, ArcSendResult, CasePort, ConversionStep, ConvertResult, FundsPort, JourneyOrder, JourneyOutcome, OrchPayInResult, PayInPort, PayoutPort, PayoutResult,
} from '../src/journey/orchestrator/index.js';
import { CaptureCases, FakeFunds, ScriptedArc, ScriptedConversion, ScriptedPayIn, ScriptedPayout, fixtureQuote, orderOf } from '../src/journey/orchestrator/fakes.js';
import { beneficiaryRef, fiatCode, novaOwnerRef, paymentId } from '../src/nova-ports/ids.js';
import type { Hex32, NetworkId } from '../src/nova-ports/ids.js';
import type { PayInMethod, PayoutMethod } from '../src/status/journey.js';

const NET = 'ARC' as unknown as NetworkId;
const CLIENT = novaOwnerRef('client-1');
const TX = `0x${'ab'.repeat(32)}` as Hex32;
const T0 = 1_000_000n;
const TTL = 300_000n;
const PAYER = 100_000n; // minor units of the fixture ledger (2 decimals)
const FEE = 1_500n;
const ARC = PAYER - FEE;
const pid = (n: string) => paymentId(`pay-${n.repeat(32).slice(0, 32)}`);

const FIAT_IN: PayInMethod = { method: 'FIAT', currency: fiatCode('ZAR') };
const BAL_IN: PayInMethod = { method: 'STABLECOIN_BALANCE', asset: 'USDC', network: NET };
const WALLET_OUT: PayoutMethod = { method: 'STABLECOIN_WALLET', asset: 'USDC', network: NET, beneficiaryRef: beneficiaryRef('ben-1') };
const BANK_OUT: PayoutMethod = { method: 'FIAT_BANK', currency: fiatCode('ZAR'), beneficiaryRef: beneficiaryRef('ben-2') };

const log = (s = ''): void => console.log(s);
const pad = (s: string, n: number): string => s.padEnd(n);
const rpad = (s: string, n: number): string => s.padStart(n);
/** Ledger units are minor units with 2 decimals (the fixture ledger is single-denominated). */
function dec(u: bigint): string {
  const neg = u < 0n;
  const a = neg ? -u : u;
  const whole = (a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${whole}.${(a % 100n).toString().padStart(2, '0')}`;
}
const both = (u: bigint): string => `${rpad(dec(u), 12)}  (${u.toString()} units)`;
const iso = (ms: bigint): string => new Date(Number(ms)).toISOString();

function banner(): void {
  log('='.repeat(78));
  log('DEMO ONLY - Arc testnet, test stand-ins, no real money, code still under review');
  log('='.repeat(78));
}

class Walk {
  seen = 0;
  histSeen = new Set<string>();
  constructor(readonly funds: FakeFunds, readonly base: ListHistory, readonly clock: ManualClock, readonly cases: CaptureCases) {}
  say(s: string): void {
    log(`  > ${s}`);
  }
  postingsSince(): void {
    const fresh = this.funds.postings.slice(this.seen);
    this.seen = this.funds.postings.length;
    if (fresh.length === 0) log('      ledger : (no postings in this step)');
    for (const p of fresh) {
      log(`      ledger : DEBIT ${pad(p.debit, 9)} CREDIT ${pad(p.credit, 9)} ${both(p.amount)}   [${p.key.split(':')[0]}]`);
    }
  }
}

function describeRecord(r: HistoryRecord): string {
  const e = r.entry;
  return `#${String(r.seq)} ${pad(e.code, 22)} kind=${pad(e.kind, 9)} stage=${pad(e.stage ?? '-', 14)} status=${pad(e.status ?? '-', 11)} leg=${pad(e.leg ?? '-', 13)}${e.reason !== null ? ` reason=${e.reason}` : ''}${e.amount !== null ? ` amount=${dec(e.amount.units)} ${e.amount.asset}` : ''}`;
}

function rig(o: { payIn: PayInMethod; payout: PayoutMethod; payInResults?: OrchPayInResult[]; convert?: ConvertResult[]; arc?: ArcSendResult[]; payoutResults?: PayoutResult[] }) {
  const clock = new ManualClock(T0);
  const funds = new FakeFunds(PAYER, FEE);
  const cases = new CaptureCases();
  const mail = new EmailNotifier(new Map([[CLIENT, 'c@example.test']]));
  const base = new ListHistory();
  const w = new Walk(funds, base, clock, cases);
  const scripted = {
    payIn: new ScriptedPayIn(o.payInResults ?? [{ kind: 'CONFIRMED', amount: PAYER, evidenceRef: 'ev-1' }]),
    conversion: new ScriptedConversion(o.convert ?? [{ kind: 'FILLED', toAmount: ARC, bookedEntryRef: 'je-1' }]),
    arc: new ScriptedArc(o.arc ?? [{ kind: 'CONFIRMED', txHash: TX }]),
    payout: new ScriptedPayout(o.payoutResults ?? [{ kind: 'PAID', payoutRef: 'po-1' }]),
  };

  // Observers: each wraps a real fake, narrates the call and its result, then shows the postings it caused.
  const history: HistoryPort = {
    append: async (input) => {
      const r = await base.append(input);
      if (r.kind === 'OK' && !w.histSeen.has(r.value.key)) {
        w.histSeen.add(r.value.key);
        log(`      history: appended ${describeRecord(r.value)}`);
      }
      return r;
    },
    list: (q) => base.list(q),
    edit: (k) => base.edit(k),
    remove: (k) => base.remove(k),
  };
  const fundsObs: FundsPort = {
    reserve: async (ord) => {
      w.say(`FUNDS: reserve ${dec(PAYER)} from the payer account`);
      const r = await funds.reserve(ord);
      log(`      result : ${r}`);
      w.postingsSince();
      return r;
    },
    settle: async (ord, tx) => {
      w.say(`FUNDS: settle on Arc confirmation (tx ${tx.slice(0, 12)}...) - ${dec(ARC)} to clearing, ${dec(FEE)} fee`);
      const r = await funds.settle(ord, tx);
      log(`      result : ${r}`);
      w.postingsSince();
      return r;
    },
    refund: async (ord, kind) => {
      w.say(`FUNDS: refund (${kind})`);
      const r = await funds.refund(ord, kind);
      log(`      result : ${r}`);
      w.postingsSince();
      return r;
    },
  };
  const payIn: PayInPort = {
    settle: async (ord, now) => {
      w.say(`PAY-IN: checking whether the ${ord.quote.payIn.method} payment has landed`);
      const r = await scripted.payIn.settle();
      log(`      result : ${r.kind}${r.kind === 'CONFIRMED' ? ` amount=${dec(r.amount)} evidence=${r.evidenceRef}` : ''}   (now=${iso(now)})`);
      w.postingsSince();
      return r;
    },
  };
  const conversion: ConversionStep = {
    convert: async (ord, now) => {
      const c = ord.quote.convertIn;
      w.say(`OTC DESK: pricing code expires ${c === null ? '-' : iso(c.expiresAtMs)}; now=${iso(now)}; asking the desk to fill`);
      const r = await scripted.conversion.convert();
      log(`      result : ${r.kind}${r.kind === 'FILLED' ? ` toAmount=${dec(r.toAmount)} booked=${r.bookedEntryRef}` : ''}`);
      w.postingsSince();
      return r;
    },
  };
  const arc: ArcSendPort = {
    send: async () => {
      w.say('ARC: sending USDC to the destination (DFNS signs and submits)');
      const r = await scripted.arc.send();
      log(`      result : ${r.kind}${'txHash' in r ? ` tx=${r.txHash.slice(0, 18)}...` : ''}${'reason' in r ? ` reason=${r.reason}` : ''}`);
      w.postingsSince();
      return r;
    },
  };
  const payout: PayoutPort = {
    advance: async () => {
      w.say('PARTNER: asking the off-ramp partner for payout progress');
      const r = await scripted.payout.advance();
      log(`      result : ${r.kind}${r.kind === 'PAID' ? ` ref=${r.payoutRef}` : ''}`);
      w.postingsSince();
      return r;
    },
  };
  const casesObs: CasePort = {
    open: async (req) => {
      const r = await cases.open(req);
      w.say(`OPS CASE opened: kind=${req.kind} reason=${req.reason} id=${String(r.caseId)}`);
      return r;
    },
  };

  const orch = new JourneyOrchestrator(
    { flags: { fiatEnabled: true, stablecoinDepositEnabled: true }, crossBorderEnabled: false, historyGapMaxAgeMs: 60_000n, payoutStuckAfterMs: 3_600_000n },
    {
      clock, store: new InMemoryJourneyStore(), history, notifier: mail, cases: casesObs, funds: fundsObs,
      payIn: o.payIn.method === 'STABLECOIN_BALANCE' ? null : payIn, conversion: o.payIn.method === 'FIAT' ? conversion : null, arc,
      payout: o.payout.method === 'FIAT_BANK' ? payout : null,
    },
  );
  const quote = (convertExpiresAtMs?: bigint) => fixtureQuote({
    payIn: o.payIn, payout: o.payout, payer: PAYER, recipient: ARC, arcAmount: ARC, expiresAtMs: T0 + TTL, ...(convertExpiresAtMs === undefined ? {} : { convertExpiresAtMs }),
  });
  return { clock, funds, cases, mail, base, w, scripted, orch, quote };
}

function showQuote(order: JourneyOrder): void {
  const q = order.quote as unknown as {
    quoteId: string; payer: { fiat?: { currency: string; minor: bigint }; asset?: string; minor?: bigint };
    recipient: { fiat?: { currency: string; minor: bigint }; asset?: string; minor?: bigint };
    arcTransfer: { amount: bigint }; convertIn: { to: bigint; expiresAtMs: bigint } | null; expiresAtMs: bigint;
  };
  const side = (s: typeof q.payer): { unit: string; minor: bigint } => (s.fiat !== undefined ? { unit: s.fiat.currency, minor: s.fiat.minor } : { unit: s.asset ?? '?', minor: s.minor ?? 0n });
  const pay = side(q.payer);
  const get = side(q.recipient);
  log('QUOTE');
  log(`  quote id        : ${q.quoteId}   payment id: ${order.paymentId}`);
  log(`  route           : pay-in ${order.quote.payIn.method} -> payout ${order.quote.payout.method}`);
  log(`  sender pays     : ${pad(pay.unit, 5)} ${both(pay.minor)}`);
  log(`  receiver gets   : ${pad(get.unit, 5)} ${both(get.minor)}`);
  log(`  sent over Arc   : USDC  ${both(q.arcTransfer.amount)}`);
  log(`  fee             : ${both(pay.minor - q.arcTransfer.amount)}   (payer minus Arc amount)`);
  const rate = q.convertIn === null ? null : (Number(q.convertIn.to) / Number(pay.minor)).toFixed(4);
  log(`  rate            : ${rate === null ? 'n/a (no conversion: stablecoin pay-in)' : `${rate} USDC per 1 ${pay.unit} implied, fee included (fixture has no separate FX rate; ledger is single-denominated)`}`);
  log(`  pricing code    : ${q.convertIn === null ? 'n/a' : `expires ${iso(q.convertIn.expiresAtMs)}`}`);
  log(`  quote expires   : ${iso(q.expiresAtMs)}   (created clock ${iso(T0)})`);
  log('');
}

function outcomeLine(o: JourneyOutcome): void {
  log(`  => stage=${o.stage}  status=${o.status}  state=${o.state}${o.reason !== null ? `  reason=${o.reason}` : ''}  arrived=${String(o.arrived)}  refunded=${String(o.refunded)}${o.waitingOn !== null ? `  waitingOn=${o.waitingOn}` : ''}${o.hold !== null ? `  hold=${o.hold.kind}/${o.hold.reason}/case=${String(o.hold.caseId)}` : ''}`);
}

function out(x: JourneyOutcome | { readonly refused: string }): JourneyOutcome {
  if ('refused' in x) throw new Error(`refused ${x.refused}`);
  return x;
}

async function finish(r: ReturnType<typeof rig>, before: Map<string, bigint>): Promise<HistoryRecord[]> {
  log('');
  log('LEDGER BALANCES (before -> after)');
  log(`  ${pad('account', 10)} ${rpad('before', 14)} ${rpad('after', 14)}   (units)`);
  const names = [...new Set([...before.keys(), ...r.funds.balances.keys()])];
  for (const n of names) {
    const b = before.get(n) ?? 0n;
    const a = r.funds.bal(n);
    log(`  ${pad(n, 10)} ${rpad(dec(b), 14)} ${rpad(dec(a), 14)}   (${b.toString()} -> ${a.toString()})`);
  }
  log(`  money in = money out: residual ${r.funds.residual().toString()}`);
  const h = await r.base.list({ clientUid: CLIENT });
  if (h.kind !== 'OK') throw new Error('history list failed');
  log('');
  log('CLIENT HISTORY (in order)');
  for (const rec of h.value) log(`  ${describeRecord(rec)}`);
  log('');
  expect(r.funds.residual()).toBe(0n);
  return [...h.value];
}

function start(title: string): void {
  log('');
  log('#'.repeat(78));
  log(`# ${title}`);
  log('#'.repeat(78));
}

describe('journey walkthrough (narrated)', () => {
  it('Sender pays 1,000.00 ZAR (fiat) -> receiver gets money in a bank account', async () => {
    banner();
    start('SCENARIO 1: Sender pays 1,000.00 ZAR (fiat) -> receiver gets money in a bank account');
    const r = rig({ payIn: FIAT_IN, payout: BANK_OUT, payoutResults: [{ kind: 'PENDING' }, { kind: 'PAID', payoutRef: 'po-1' }] });
    const order = orderOf(pid('a'), CLIENT, r.quote());
    showQuote(order);
    r.funds.fund(); // the fiat pay-in lands in the payer account
    const before = new Map<string, bigint>(); // snapshot taken before any step
    log('STEPS (each line shows what the orchestrator asked, what came back, ledger postings and history written)');
    log('  [funds from the bank pay-in credited to the payer account]');
    r.w.postingsSince();
    const first = out(await r.orch.start(order));
    outcomeLine(first);
    expect(first).toMatchObject({ state: 'WAITING', waitingOn: 'PAYOUT', arrived: false, status: 'PROCESSING' });
    log('  [time passes; the partner is polled again]');
    const done = out(await r.orch.advance(order.paymentId));
    outcomeLine(done);
    expect(done).toMatchObject({ state: 'ARRIVED', stage: 'COMPLETED', status: 'SETTLED', arrived: true });
    expect(r.scripted.arc.calls).toBe(1);
    expect(r.funds.bal('clearing')).toBe(ARC);
    expect(r.funds.bal('fees')).toBe(FEE);
    const hist = await finish(r, before);
    const codes = hist.map((x) => x.entry.code);
    expect(codes.filter((c) => c === 'LEG_COMPLETED')).toHaveLength(4);
    expect(hist.map((x) => x.seq)).toEqual(hist.map((_, i) => BigInt(i + 1)));
    expect(hist[hist.length - 1]?.entry.status).toBe('SETTLED');
  });

  it('Sender pays USDC -> receiver gets USDC in a wallet', async () => {
    start('SCENARIO 2: Sender pays USDC -> receiver gets USDC in a wallet');
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT });
    const order = orderOf(pid('b'), CLIENT, r.quote());
    showQuote(order);
    r.funds.fund();
    const before = new Map<string, bigint>();
    log('STEPS');
    r.w.postingsSince();
    const o = out(await r.orch.start(order));
    outcomeLine(o);
    expect(o).toMatchObject({ state: 'ARRIVED', stage: 'COMPLETED', status: 'SETTLED', arrived: true });
    expect(r.scripted.payIn.calls).toBe(0);
    expect(r.scripted.conversion.calls).toBe(0);
    expect(r.funds.bal('payer')).toBe(0n);
    expect(r.funds.bal('reserved')).toBe(0n);
    await finish(r, before);
  });

  it('Failure: the pricing code expires before the desk fills it', async () => {
    start('SCENARIO 3 (FAILURE): the pricing code expires before the desk fills it');
    const r = rig({ payIn: FIAT_IN, payout: WALLET_OUT });
    const order = orderOf(pid('c'), CLIENT, r.quote(T0 + 1n));
    showQuote(order);
    r.funds.fund();
    const before = new Map<string, bigint>();
    log('STEPS');
    r.w.postingsSince();
    log('  [5 ms pass after the pay-in confirms; the pricing code is now stale, so nothing is reserved]');
    r.clock.advance(5n);
    const o = out(await r.orch.start(order));
    outcomeLine(o);
    expect(o).toMatchObject({ state: 'HELD', hold: { kind: 'REQUOTE', reason: 'RATE_EXPIRED' }, refunded: false });
    log(`  desk fill calls: ${String(r.scripted.conversion.calls)}   Arc send calls: ${String(r.scripted.arc.calls)}   (both must be 0)`);
    log(`  ops cases      : ${r.cases.opened.length === 0 ? 'none' : r.cases.opened.map((c) => `${c.caseId}:${c.kind}/${c.reason}`).join(', ')}`);
    expect(r.scripted.conversion.calls).toBe(0);
    expect(r.scripted.arc.calls).toBe(0);
    expect(r.cases.opened.map((c) => `${c.kind}/${c.reason}`)).toEqual(['REQUOTE/RATE_EXPIRED']);
    // Nothing moved on the stale code: no reservation, the client's pay-in is untouched until two people decide (requote with consent, or refund).
    expect(r.funds.bal('payer')).toBe(PAYER);
    expect(r.funds.bal('reserved')).toBe(0n);
    expect(r.funds.bal('clearing')).toBe(0n);
    const hist = await finish(r, before);
    expect(hist.map((x) => x.entry.code)).toEqual(['PAYMENT_CREATED', 'PAYIN_CONFIRMED', 'HELD_RATE_EXPIRED']);
    log(`  held for a REQUOTE case: payer account ${dec(r.funds.bal('payer'))} (the pay-in waits for the operators' decision; no automatic refund)`);
  });

  it('Failure: unknown DFNS outcome', async () => {
    start('SCENARIO 4 (FAILURE): unknown DFNS outcome (timeout, result not known)');
    const r = rig({ payIn: BAL_IN, payout: WALLET_OUT, arc: [{ kind: 'UNRESOLVED', reason: 'DFNS_TIMEOUT' }, { kind: 'CONFIRMED', txHash: TX }] });
    const order = orderOf(pid('d'), CLIENT, r.quote());
    showQuote(order);
    r.funds.fund();
    const before = new Map<string, bigint>();
    log('STEPS');
    r.w.postingsSince();
    const o = out(await r.orch.start(order));
    outcomeLine(o);
    expect(o).toMatchObject({ state: 'HELD', hold: { kind: 'UNRESOLVED_SUBMIT', reason: 'DFNS_TIMEOUT' } });
    log('  [operator-less re-drive attempted twice: the orchestrator must NOT send again]');
    outcomeLine(out(await r.orch.advance(order.paymentId)));
    outcomeLine(out(await r.orch.advance(order.paymentId)));
    log(`  Arc send calls : ${String(r.scripted.arc.calls)}   (script had a second CONFIRMED ready; it must never be used)`);
    expect(r.scripted.arc.calls).toBe(1);
    expect(r.cases.opened.map((c) => c.kind)).toEqual(['UNRESOLVED_SUBMIT']);
    const next = orderOf(pid('e'), CLIENT, r.quote());
    const retry = await r.orch.retryAsNewPayment(order.paymentId, next);
    log(`  retry as a new payment: ${JSON.stringify(retry)}`);
    expect(retry).toEqual({ refused: 'UNRESOLVED_NOT_PROVEN' });
    log(`  funds stay reserved until the outcome is proven: reserved=${dec(r.funds.bal('reserved'))}`);
    expect(r.funds.bal('reserved')).toBe(PAYER);
    await finish(r, before);
  });
});
