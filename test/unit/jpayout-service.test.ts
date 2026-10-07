import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cbsMinor, usdcUnits } from '../../src/amounts/index.js';
import { PayoutConfigError, PayoutService } from '../../src/journey/payout/index.js';
import type { D1PaymentsPort, PayoutCase, PayoutServiceDeps } from '../../src/journey/payout/index.js';
import { FAKE_SIGNATURE_HEADER, FakePartner, fakePartnerSign } from '../../src/journey/payout/partner/fake.js';
import { TRAVEL_RULE_NOT_APPLICABLE_TESTNET } from '../../src/journey/recipients/index.js';
import type { RecipientRef } from '../../src/journey/recipients/index.js';
import { DenyListScreeningFake, RiskScoreScreeningFake } from '../../src/journey/payout/screening-fakes.js';
import { EventMirrorBlocklist, SetBlocklist } from '../../src/network/arc/blocklist-fakes.js';
import { fiatCode, normaliseAddress, novaOwnerRef, ok, rejected } from '../../src/nova-ports/ids.js';
import type { Hex32, IdempotencyKey, NetworkAddress, NetworkId } from '../../src/nova-ports/ids.js';

const ADDR = '0x' + '11'.repeat(20);
const SETTLE = '0x' + '22'.repeat(20);
const TX = ('0x' + 'ab'.repeat(32)) as Hex32;
const NET = 'ARC' as unknown as NetworkId;
const REF = ('rcp-' + 'a'.repeat(32)) as RecipientRef;
const PAYER = novaOwnerRef('owner-1');
const addr = (s: string): NetworkAddress => normaliseAddress(s) as NetworkAddress;
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

const ListScreen = (deny: NetworkAddress[] = [], down = false): DenyListScreeningFake => {
  const f = new DenyListScreeningFake(deny);
  f.down = down;
  return f;
};
const ScoreScreen = (score: (a: string) => bigint): RiskScoreScreeningFake => new RiskScoreScreeningFake(score);

class Payments implements D1PaymentsPort {
  creates: { key: IdempotencyKey; to: NetworkAddress; amount: bigint }[] = [];
  state: 'PENDING' | 'CONFIRMED' | 'FAILED' = 'PENDING';
  override: { to?: NetworkAddress; amount?: bigint } = {};
  async create(key: IdempotencyKey, req: { to: NetworkAddress; amount: ReturnType<typeof usdcUnits> }) {
    const prior = this.creates.find((c) => c.key === key);
    if (prior === undefined) this.creates.push({ key, to: req.to, amount: req.amount });
    return ok({ paymentId: 'pay-1' }, prior !== undefined);
  }
  async get(_id: string) {
    const c = this.creates[0] as { to: NetworkAddress; amount: bigint };
    return ok({ state: this.state, to: this.override.to ?? c.to, amount: usdcUnits(this.override.amount ?? c.amount), txHash: TX }, false);
  }
}

const SECRET = randomBytes(32);
function setup(over: Partial<PayoutServiceDeps> & { country?: string; currency?: string; demo?: boolean; legal?: boolean } = {}) {
  const payments = new Payments();
  const cases: PayoutCase[] = [];
  const partner = new FakePartner({
    secret: SECRET,
    recipients: () => ({ country: over.country ?? 'ZA', currency: fiatCode(over.currency ?? 'ZAR') }),
    gate: { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: over.legal ?? false, testnetDemo: over.demo ?? false },
    isFunded: () => true,
    settlementNetwork: { chainId: 5042002n } as never,
    newId: (() => { let n = 0; return () => `t${++n}`; })(),
  });
  const deps: PayoutServiceDeps = {
    payments,
    partner,
    screening: ListScreen(),
    blocklist: new SetBlocklist(1n),
    blocklistMaxAgeMs: 60_000n,
    clock: () => 1_000n,
    travelRule: TRAVEL_RULE_NOT_APPLICABLE_TESTNET,
    cases: { open: async (c) => { cases.push(c); } },
    recipients: () => ({ country: over.country ?? 'ZA', currency: fiatCode(over.currency ?? 'ZAR') }),
    gate: { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: over.legal ?? false, testnetDemo: over.demo ?? false },
    chainId: 5042002n,
    network: NET,
    partnerSettlementAddress: SETTLE,
    ...over,
  };
  return { svc: new PayoutService(deps), payments, cases, partner, deps };
}
const wallet = (id = 'p1', a = ADDR, amt = 5_000_000n) => ({ method: 'STABLECOIN_WALLET' as const, payoutId: id, payer: PAYER, address: a, amount: usdcUnits(amt) });
const fiat = (id = 'f1') => ({ method: 'FIAT_BANK' as const, payoutId: id, payer: PAYER, recipientRef: REF, currency: fiatCode('ZAR'), amount: cbsMinor(9000n), fundingAmount: usdcUnits(5_000_000n) });
const cb = (payoutId: string, state: string, eventId: string, reason: string | null = null): [Uint8Array, Record<string, string>] => {
  const body = enc(JSON.stringify({ eventId, payoutId, state, reason }));
  return [body, { [FAKE_SIGNATURE_HEADER]: fakePartnerSign(SECRET, body) }];
};

describe('STABLECOIN_WALLET payout', () => {
  it('screens, sends once, and ARRIVED only after the payment reads back CONFIRMED', async () => {
    const t = setup();
    const r = await t.svc.start(wallet());
    expect(r.kind).toBe('OK');
    expect(t.payments.creates).toHaveLength(1);
    expect(t.svc.record('p1')?.status).toBe('SENT');
    expect((await t.svc.advance('p1'))?.status).toBe('SENT');
    t.payments.state = 'CONFIRMED';
    expect((await t.svc.advance('p1'))?.status).toBe('ARRIVED');
  });
  it('same id replays, another request is KEY_CONFLICT, one send', async () => {
    const t = setup();
    await t.svc.start(wallet());
    const again = await t.svc.start(wallet());
    expect(again.kind === 'OK' && again.replayed).toBe(true);
    expect(await t.svc.start(wallet('p1', ADDR, 6_000_000n))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    expect(t.payments.creates).toHaveLength(1);
  });
  it('rejects non-positive amounts', async () => {
    const t = setup();
    expect(await t.svc.start(wallet('p1', ADDR, 0n))).toMatchObject({ code: 'AMOUNT_INVALID' });
    expect(t.payments.creates).toHaveLength(0);
  });
  for (const [name, mk] of [
    ['SetBlocklist', () => { const b = new SetBlocklist(1n); b.block(addr(ADDR)); return b; }],
    ['EventMirrorBlocklist', () => { const b = new EventMirrorBlocklist(1n); b.sync([{ kind: 'Blocklisted', account: addr(ADDR) }], 2n); return b; }],
  ] as const) {
    it(`blocklisted destination (${name}): no send, hold`, async () => {
      const t = setup({ blocklist: mk() });
      const r = await t.svc.start(wallet());
      expect(r).toMatchObject({ kind: 'REJECTED', code: 'BLOCKLISTED' });
      expect(t.payments.creates).toHaveLength(0);
      expect(t.svc.record('p1')?.status).toBe('HELD');
      expect(t.cases).toEqual([{ payoutId: 'p1', kind: 'QUARANTINE', reason: 'BLOCKLISTED' }]);
    });
  }
  it('unblocklisted again is allowed (event mirror fold)', async () => {
    const b = new EventMirrorBlocklist(1n);
    b.sync([{ kind: 'Blocklisted', account: addr(ADDR) }, { kind: 'UnBlocklisted', account: addr(ADDR) }], 2n);
    expect((await setup({ blocklist: b }).svc.start(wallet())).kind).toBe('OK');
  });
  it('screen-failed (two structurally different fakes): no send, hold', async () => {
    for (const screening of [ListScreen([addr(ADDR)]), ScoreScreen(() => 95n), ListScreen([], true), ScoreScreen(() => -1n)]) {
      const t = setup({ screening });
      const r = await t.svc.start(wallet());
      expect(r.kind).toBe('REJECTED');
      expect(t.payments.creates).toHaveLength(0);
      expect(t.svc.record('p1')?.status).toBe('HELD');
      expect(t.cases).toHaveLength(1);
    }
  });
  it('blocklist view that throws fails closed', async () => {
    const t = setup({ blocklist: { snapshot: async () => { throw new Error('x'); } } });
    expect(await t.svc.start(wallet())).toMatchObject({ code: 'SCREENING_UNAVAILABLE' });
    expect(t.payments.creates).toHaveLength(0);
  });
  it('travel-rule HOLD blocks (unhosted wallet: configure-or-fail-closed)', async () => {
    const t = setup({ travelRule: { check: async () => 'HOLD' } });
    expect(await t.svc.start(wallet())).toMatchObject({ code: 'TRAVEL_RULE_HOLD' });
    const t2 = setup({ travelRule: { check: async () => { throw new Error('x'); } } });
    expect(await t2.svc.start(wallet())).toMatchObject({ code: 'TRAVEL_RULE_HOLD' });
    expect(t.payments.creates.length + t2.payments.creates.length).toBe(0);
  });
  it('invalid address: no send', async () => {
    const t = setup();
    expect(await t.svc.start(wallet('p1', '0x12'))).toMatchObject({ code: 'ADDRESS_INVALID' });
    expect(t.payments.creates).toHaveLength(0);
  });
  it('blocklist is re-checked on every send (later block applies to the next payout)', async () => {
    const b = new SetBlocklist(1n);
    const t = setup({ blocklist: b });
    expect((await t.svc.start(wallet('p1'))).kind).toBe('OK');
    b.block(addr(ADDR));
    expect(await t.svc.start(wallet('p2'))).toMatchObject({ code: 'BLOCKLISTED' });
    expect(t.payments.creates).toHaveLength(1);
  });
  it('a confirmed payment that differs from the bound record is never ARRIVED', async () => {
    for (const o of [{ amount: 1n }, { to: addr('0x' + '33'.repeat(20)) }]) {
      const t = setup();
      await t.svc.start(wallet());
      t.payments.state = 'CONFIRMED';
      t.payments.override = o;
      expect((await t.svc.advance('p1'))?.status).toBe('FAILED');
      expect(t.cases.at(-1)).toEqual({ payoutId: 'p1', kind: 'QUARANTINE', reason: 'PAYMENT_MISMATCH' });
    }
  });
  it('failed payment opens a case and is not ARRIVED', async () => {
    const t = setup();
    await t.svc.start(wallet());
    t.payments.state = 'FAILED';
    expect((await t.svc.advance('p1'))?.status).toBe('FAILED');
    expect(t.cases).toEqual([{ payoutId: 'p1', kind: 'PAYMENT_FAILED', reason: 'PAYMENT_FAILED' }]);
  });
  it('payments rejection or ambiguity: never ARRIVED; ambiguity is UNRESOLVED (never FAILED) with a case', async () => {
    const t = setup({ payments: { create: async () => rejected('X', 'x'), get: async () => rejected('NOT_FOUND', 'x') } });
    expect(await t.svc.start(wallet())).toMatchObject({ code: 'PAYMENT_REJECTED' });
    expect(t.svc.record('p1')?.status).toBe('FAILED');
    const t2 = setup({ payments: { create: async () => { throw new Error('boom'); }, get: async () => rejected('NOT_FOUND', 'x') } });
    expect(await t2.svc.start(wallet())).toMatchObject({ code: 'PAYMENT_OUTCOME_UNKNOWN' });
    expect(t2.svc.record('p1')).toMatchObject({ status: 'UNRESOLVED', code: 'PAYMENT_OUTCOME_UNKNOWN' });
    expect(t2.cases).toEqual([{ payoutId: 'p1', kind: 'UNRESOLVED_SUBMIT', reason: 'PAYMENT_OUTCOME_UNKNOWN' }]);
  });
});

describe('FIAT_BANK payout', () => {
  async function toPartner(t: ReturnType<typeof setup>, id = 'f1') {
    await t.svc.start(fiat(id));
    t.payments.state = 'CONFIRMED';
    return t.svc.advance(id);
  }
  it('funds, creates the partner payout, and ARRIVED only on the authentic PAID callback', async () => {
    const t = setup();
    expect((await t.svc.start(fiat())).kind).toBe('OK');
    expect(t.payments.creates[0]?.to).toBe(SETTLE);
    expect((await t.svc.advance('f1'))?.status).toBe('FUNDING');
    t.payments.state = 'CONFIRMED';
    expect((await t.svc.advance('f1'))?.status).toBe('PARTNER_PENDING');
    expect(t.svc.record('f1')?.status).not.toBe('ARRIVED');
    const r = await t.svc.handlePartnerCallback(...cb('fake-t1', 'PAID', 'e1'));
    expect(r.kind).toBe('OK');
    expect(t.svc.record('f1')?.status).toBe('ARRIVED');
  });
  it('forged callback: no effect', async () => {
    const t = setup();
    await toPartner(t);
    const [body] = cb('fake-t1', 'PAID', 'e1');
    const r = await t.svc.handlePartnerCallback(body, { [FAKE_SIGNATURE_HEADER]: '0'.repeat(64) });
    expect(r).toMatchObject({ kind: 'REJECTED', code: 'BAD_SIGNATURE' });
    expect(t.svc.record('f1')?.status).toBe('PARTNER_PENDING');
  });
  it('cross-border refused while the flag is OFF, before any funding', async () => {
    for (const o of [{ country: 'KE', currency: 'KES' }, { country: 'ZA', currency: 'USD' }]) {
      const t = setup(o);
      const r = await t.svc.start({ ...fiat(), currency: fiatCode(o.currency) });
      expect(r).toMatchObject({ kind: 'REJECTED', code: 'CROSS_BORDER_DISABLED' });
      expect(t.payments.creates).toHaveLength(0);
      expect(t.svc.record('f1')).toBeNull();
    }
  });
  it('cross-border allowed with a recorded legal opinion, or the testnet demo flag on 5042002 only', async () => {
    const f = { ...fiat(), currency: fiatCode('KES') };
    expect((await setup({ country: 'KE', currency: 'KES', legal: true }).svc.start(f)).kind).toBe('OK');
    expect((await setup({ country: 'KE', currency: 'KES', demo: true }).svc.start(f)).kind).toBe('OK');
    expect(await setup({ country: 'KE', currency: 'KES', demo: true, chainId: 5042n, travelRule: { check: async () => 'READY' } }).svc.start(f)).toMatchObject({ code: 'CROSS_BORDER_DISABLED' });
  });
  it('unknown recipient and currency mismatch are refused before funding', async () => {
    const t = setup({ recipients: () => { throw new Error('x'); } });
    expect(await t.svc.start(fiat())).toMatchObject({ code: 'BENEFICIARY_INVALID' });
    const t2 = setup();
    expect(await t2.svc.start({ ...fiat(), currency: fiatCode('USD') })).toMatchObject({ code: 'CURRENCY_MISMATCH' });
    expect(t.payments.creates.length + t2.payments.creates.length).toBe(0);
  });
  it('blocklisted or screen-failed partner settlement address: no funding, hold', async () => {
    const b = new SetBlocklist(1n);
    b.block(addr(SETTLE));
    const t = setup({ blocklist: b });
    expect(await t.svc.start(fiat())).toMatchObject({ code: 'BLOCKLISTED' });
    const t2 = setup({ screening: ScoreScreen(() => 99n) });
    expect(await t2.svc.start(fiat())).toMatchObject({ code: 'SCREENING_BLOCKED' });
    expect(t.payments.creates.length + t2.payments.creates.length).toBe(0);
    expect(t.cases[0]?.kind).toBe('QUARANTINE');
  });
  it('malformed settlement address is refused', async () => {
    const t = setup({ partnerSettlementAddress: 'nope' });
    expect(await t.svc.start(fiat())).toMatchObject({ code: 'PARTNER_FUNDING_ADDRESS_INVALID' });
  });
  it('partner FAILED -> REFUND_DUE once; then RETURNED -> REFUND_RECEIVED; never ARRIVED', async () => {
    const t = setup();
    await toPartner(t);
    await t.svc.handlePartnerCallback(...cb('fake-t1', 'FAILED', 'e1', 'ACCOUNT_CLOSED'));
    expect(t.svc.record('f1')?.status).toBe('FAILED');
    expect(t.cases).toEqual([{ payoutId: 'f1', kind: 'REFUND_DUE', reason: 'ACCOUNT_CLOSED' }]);
    await t.svc.handlePartnerCallback(...cb('fake-t1', 'RETURNED', 'e2'));
    expect(t.cases.map((c) => c.kind)).toEqual(['REFUND_DUE', 'REFUND_RECEIVED']);
    expect(t.svc.record('f1')?.status).toBe('FAILED');
  });
  it('PAID then RETURNED -> CLAIM, status not ARRIVED any more', async () => {
    const t = setup();
    await toPartner(t);
    await t.svc.handlePartnerCallback(...cb('fake-t1', 'PAID', 'e1'));
    expect(t.svc.record('f1')?.status).toBe('ARRIVED');
    await t.svc.handlePartnerCallback(...cb('fake-t1', 'RETURNED', 'e2'));
    expect(t.cases.at(-1)?.kind).toBe('CLAIM');
    expect(t.svc.record('f1')?.status).toBe('FAILED');
  });
  it('REFUND_FAILED opens a case for Ops', async () => {
    const t = setup();
    await toPartner(t);
    await t.svc.handlePartnerCallback(...cb('fake-t1', 'FAILED', 'e1'));
    await t.svc.handlePartnerCallback(...cb('fake-t1', 'REFUND_FAILED', 'e2'));
    expect(t.cases.map((c) => c.kind)).toEqual(['REFUND_DUE', 'REFUND_FAILED']);
  });
  it('conflicting PAID and FAILED -> CONFLICT case, not ARRIVED', async () => {
    const t = setup();
    await toPartner(t);
    await t.svc.handlePartnerCallback(...cb('fake-t1', 'FAILED', 'e1'));
    const r = await t.svc.handlePartnerCallback(...cb('fake-t1', 'PAID', 'e2'));
    expect(r).toMatchObject({ kind: 'REJECTED', code: 'CONFLICT' });
    expect(t.svc.record('f1')?.status).not.toBe('ARRIVED');
  });
  it('duplicate callbacks (same event, same state different event, replay) have one effect', async () => {
    const t = setup();
    await toPartner(t);
    await t.svc.handlePartnerCallback(...cb('fake-t1', 'FAILED', 'e1'));
    for (const c of [cb('fake-t1', 'FAILED', 'e1'), cb('fake-t1', 'FAILED', 'e9'), cb('fake-t1', 'FAILED', 'e1')]) {
      const r = await t.svc.handlePartnerCallback(...c);
      expect(r.kind === 'OK' && r.value.applied).toBe(false);
    }
    expect(t.cases).toHaveLength(1);
  });
  it('unknown payout / malformed callback: no effect; malformed opens a case', async () => {
    const t = setup();
    await toPartner(t);
    expect(await t.svc.handlePartnerCallback(...cb('fake-zzz', 'PAID', 'e1'))).toMatchObject({ code: 'UNKNOWN_PAYOUT' });
    const body = enc('[]');
    const r = await t.svc.handlePartnerCallback(body, { [FAKE_SIGNATURE_HEADER]: fakePartnerSign(SECRET, body) });
    expect(r).toMatchObject({ code: 'MALFORMED' });
    expect(t.cases.at(-1)?.kind).toBe('QUARANTINE');
    expect(t.cases.map((c) => c.reason)).toEqual(['UNKNOWN_PAYOUT', 'MALFORMED']);
    expect(t.svc.record('f1')?.status).toBe('PARTNER_PENDING');
  });
  it('funding payment failed: no partner payout', async () => {
    const t = setup();
    await t.svc.start(fiat());
    t.payments.state = 'FAILED';
    expect((await t.svc.advance('f1'))?.status).toBe('FAILED');
    expect(t.partner.reports()).toEqual([]);
  });
  it('partner rejecting the create (e.g. not funded) opens a refund case, never ARRIVED', async () => {
    const t = setup();
    (t.deps as { partner: unknown }).partner = undefined;
    const t2 = setup({ partner: { ...t.partner, kind: 'FAKE_PARTNER', createPayout: async () => rejected('NOT_FUNDED', 'x'), handleCallback: () => rejected('MALFORMED', 'x'), verifyCallback: () => rejected('MALFORMED', 'x'), arrived: () => false, reports: () => [] } });
    await t2.svc.start(fiat());
    t2.payments.state = 'CONFIRMED';
    expect((await t2.svc.advance('f1'))?.status).toBe('FAILED');
    expect(t2.cases[0]?.kind).toBe('REFUND_DUE');
  });
});

describe('pre-verification fixes (fail closed)', () => {
  it('a stale or future-dated local blocklist copy fails closed: no send', async () => {
    for (const clock of [() => 1n + 60_001n, () => 0n]) {
      const t = setup({ clock });
      expect(await t.svc.start(wallet())).toMatchObject({ code: 'SCREENING_UNAVAILABLE' });
      expect(t.payments.creates).toHaveLength(0);
      expect(t.svc.record('p1')?.status).toBe('HELD');
    }
    // exactly at the max age is still fresh
    expect((await setup({ clock: () => 1n + 60_000n }).svc.start(wallet())).kind).toBe('OK');
  });
  it('configure or fail closed: the testnet travel-rule no-op off 5042002, a zero blocklist age', () => {
    expect(() => setup({ chainId: 5042n })).toThrow(PayoutConfigError);
    expect(() => setup({ blocklistMaxAgeMs: 0n })).toThrow(PayoutConfigError);
    expect(() => setup({ chainId: 5042n, travelRule: { check: async () => 'READY' } })).not.toThrow();
  });
  it('PAID then a conflicting FAILED withdraws ARRIVED and opens a CONFLICT case', async () => {
    const t = setup();
    await t.svc.start(fiat());
    t.payments.state = 'CONFIRMED';
    await t.svc.advance('f1');
    await t.svc.handlePartnerCallback(...cb('fake-t1', 'PAID', 'e1'));
    expect(t.svc.record('f1')?.status).toBe('ARRIVED');
    const r = await t.svc.handlePartnerCallback(...cb('fake-t1', 'FAILED', 'e2'));
    expect(r).toMatchObject({ kind: 'REJECTED', code: 'CONFLICT' });
    expect(t.svc.record('f1')).toMatchObject({ status: 'FAILED', code: 'PARTNER_CONFLICT' });
    expect(t.cases).toContainEqual({ payoutId: 'f1', kind: 'CONFLICT', reason: 'SIGNAL_CONFLICT' });
  });
  it('the partner payout is bound to the funding tx WE read back (advance takes no caller hash)', async () => {
    const t = setup();
    const seen: Hex32[] = [];
    const create = t.partner.createPayout.bind(t.partner);
    t.partner.createPayout = async (k, req) => { seen.push(req.funding.txHash); return create(k, req); };
    await t.svc.start(fiat());
    t.payments.state = 'CONFIRMED';
    await (t.svc.advance as (id: string, x: unknown) => Promise<unknown>)('f1', { txHash: '0x' + 'ff'.repeat(32) });
    expect(seen).toEqual([TX]);
  });
  it('an unknown create outcome is UNRESOLVED; a retry re-screens and replays the SAME key; never refunded as FAILED', async () => {
    const t = setup();
    let fail = true;
    const inner = t.payments.create.bind(t.payments);
    t.payments.create = async (k, req) => { if (fail) throw new Error('timeout'); return inner(k, req); };
    expect(await t.svc.start(wallet())).toMatchObject({ code: 'PAYMENT_OUTCOME_UNKNOWN' });
    expect(t.svc.record('p1')?.status).toBe('UNRESOLVED');
    fail = false;
    const screening = ScoreScreen(() => 0n);
    (t.deps as { screening: unknown }).screening = screening; // the service holds deps by reference
    expect((await t.svc.start(wallet())).kind).toBe('OK');
    expect(screening.calls).toBe(1n); // re-screened before the retry
    expect(t.payments.creates).toHaveLength(1);
    expect(t.payments.creates[0]?.key).toMatch(/^payout-send-[0-9a-f]{32}$/);
    expect(t.svc.record('p1')?.status).toBe('SENT');
  });
  it('an UNRESOLVED retry refused by screening stays UNRESOLVED (money may have moved) and opens a QUARANTINE case', async () => {
    const t = setup({ payments: { create: async () => ({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' }) as const, get: async () => rejected('NOT_FOUND', 'x') } });
    await t.svc.start(wallet());
    const b = new SetBlocklist(1n);
    b.block(addr(ADDR));
    (t.deps as { blocklist: unknown }).blocklist = b; // the service holds deps by reference
    expect(await t.svc.advance('p1')).toMatchObject({ status: 'UNRESOLVED' });
    expect(t.cases).toEqual([
      { payoutId: 'p1', kind: 'UNRESOLVED_SUBMIT', reason: 'PAYMENT_OUTCOME_UNKNOWN' },
      { payoutId: 'p1', kind: 'QUARANTINE', reason: 'BLOCKLISTED' },
    ]);
  });
  it('HELD replays as the same rejection, never OK', async () => {
    const b = new SetBlocklist(1n);
    b.block(addr(ADDR));
    const t = setup({ blocklist: b });
    await t.svc.start(wallet());
    expect(await t.svc.start(wallet())).toMatchObject({ kind: 'REJECTED', code: 'BLOCKLISTED' });
    expect(t.cases).toHaveLength(1);
  });
  it('a case whose open failed stays pending and is retried on the next call', async () => {
    let down = true;
    const opened: PayoutCase[] = [];
    const b = new SetBlocklist(1n);
    b.block(addr(ADDR));
    const t = setup({ blocklist: b, cases: { open: async (c) => { if (down) throw new Error('x'); opened.push(c); } } });
    await t.svc.start(wallet());
    expect(t.svc.pendingCases()).toHaveLength(1);
    down = false;
    await t.svc.advance('p1');
    expect(opened).toEqual([{ payoutId: 'p1', kind: 'QUARANTINE', reason: 'BLOCKLISTED' }]);
    expect(t.svc.pendingCases()).toHaveLength(0);
  });
  it('unattributable authentic callbacks each open their own case (not one shared "unknown")', async () => {
    const t = setup();
    await t.svc.handlePartnerCallback(...cb('fake-a', 'PAID', 'e1'));
    await t.svc.handlePartnerCallback(...cb('fake-b', 'PAID', 'e2'));
    const quarantined = t.cases.filter((c) => c.kind === 'QUARANTINE');
    expect(quarantined).toHaveLength(2);
    expect(new Set(quarantined.map((c) => c.payoutId)).size).toBe(2);
    expect(JSON.stringify(t.cases)).not.toContain('fake-a');
  });
  it('restart: state is lost fail closed; the same request replays the same key (one payment)', async () => {
    const t = setup();
    await t.svc.start(wallet());
    const restarted = new PayoutService(t.deps);
    expect(restarted.record('p1')).toBeNull();
    expect((await restarted.start(wallet())).kind).toBe('OK');
    expect(t.payments.creates).toHaveLength(1);
  });
});

describe('no PII in errors, cases or records', () => {
  it('nothing personal or addresses leak through results and cases', async () => {
    const t = setup({ blocklist: (() => { const b = new SetBlocklist(1n); b.block(addr(ADDR)); return b; })() });
    const r = await t.svc.start(wallet());
    const dump = JSON.stringify([r, t.cases, t.svc.record('p1')]);
    expect(dump).not.toContain(ADDR.slice(2));
    expect(dump).not.toMatch(/holder|account|branch/i);
  });
});
