/**
 * JPARTNER: the CPN-shaped stub and the labelled fake run through ONE contract.
 * They are structurally different on purpose: the stub verifies an Ed25519
 * signature (a throwaway key made at runtime) over a CPN-style envelope; the
 * fake verifies an HMAC-SHA256 over its own flat body.
 * Header name and refund field below are TEST inventions, not Circle's.
 */
import { generateKeyPairSync, randomBytes, randomUUID, sign, verify } from 'node:crypto';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { cbsMinor } from '../../src/amounts/index.js';
import { asObject, parseJson, reqString } from '../../src/dfns/json.js';
import type { JsonObject } from '../../src/dfns/json.js';
import { CpnStubPartner } from '../../src/journey/payout/partner/cpn-stub.js';
import { FAKE_SIGNATURE_HEADER, FakePartner, fakePartnerSign } from '../../src/journey/payout/partner/fake.js';
import type { CrossBorderGate, FundingBinding, PartnerPayoutRequest, PartnerPayoutState, PayoutPartner } from '../../src/journey/payout/partner/port.js';
import { fiatCode, idempotencyKey, novaOwnerRef } from '../../src/nova-ports/ids.js';
import type { Hex32, NetworkId } from '../../src/nova-ports/ids.js';
import { AesKms, Clock, PII_STRINGS, bankDetails, makeStore } from '../unit/jpartner-support.js';

const NETWORK = 'ARC' as unknown as NetworkId;
const TX = ('0x' + 'ab'.repeat(32)) as Hex32;
const TX2 = ('0x' + 'cd'.repeat(32)) as Hex32;
const TX_BAD = ('0x' + 'ee'.repeat(32)) as Hex32;
const owner = novaOwnerRef('owner-1');
const k1 = idempotencyKey('k:1');
const k2 = idempotencyKey('k:2');
const k3 = idempotencyKey('k:3');
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const leaks = (text: string): string[] => PII_STRINGS.filter((p) => text.includes(p));

interface Wire {
  readonly body: Uint8Array;
  readonly headers: Record<string, string>;
}
interface Built {
  readonly partner: PayoutPartner;
  /** An authentic callback for the payout. */
  cb(payoutId: string, state: PartnerPayoutState, o?: { eventId?: string; reason?: string | null }): Wire;
  /** The same body with a signature that does not verify. */
  forge(w: Wire): Wire;
  /** Authentic signature over an arbitrary body. */
  signed(text: string | Uint8Array): Wire;
}
interface Opts {
  recipients: (ref: string) => { country: string; currency: ReturnType<typeof fiatCode> };
  gate: CrossBorderGate;
  isFunded: (f: { network: NetworkId; txHash: Hex32 }, b: FundingBinding) => boolean;
  newId?: () => string;
  settlementNetwork?: { network: NetworkId; chainId: bigint };
}
interface Harness {
  readonly name: string;
  readonly make: (o: Opts) => Built;
}

const STUB_HEADER = 'x-test-signature';
const stub: Harness = {
  name: 'CpnStubPartner',
  make: (o) => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const other = generateKeyPairSync('ed25519').privateKey;
    const sigOf = (k: typeof privateKey, body: Uint8Array): string => sign(null, body, k).toString('base64');
    const partner = new CpnStubPartner({
      ...o,
      verifySignature: (body, headers) => {
        const s = headers[STUB_HEADER];
        return s !== undefined && verify(null, body, publicKey, Buffer.from(s, 'base64'));
      },
      refundPaymentId: (n: JsonObject) => {
        const v = n.get('paymentId');
        return typeof v === 'string' ? v : null;
      },
    });
    const signed = (text: string | Uint8Array): Wire => {
      const body = typeof text === 'string' ? enc(text) : text;
      return { body, headers: { [STUB_HEADER]: sigOf(privateKey, body) } };
    };
    return {
      partner,
      signed,
      cb: (payoutId, state, x = {}) => {
        const eventId = x.eventId ?? randomUUID();
        const types: Record<PartnerPayoutState, string> = {
          PENDING: 'cpn.payment.cryptoFundsPending',
          PAID: 'cpn.payment.completed',
          FAILED: 'cpn.payment.failed',
          RETURNED: 'cpn.refund.completed',
          REFUND_FAILED: 'cpn.refund.failed',
        };
        const status = state === 'PAID' ? 'COMPLETED' : state === 'FAILED' ? 'FAILED' : 'CRYPTO_FUNDS_PENDING';
        const notification = state === 'RETURNED' || state === 'REFUND_FAILED' ? { paymentId: payoutId, status: 'COMPLETED' } : { id: payoutId, status };
        const envelope = { subscriptionId: randomUUID(), notificationId: eventId, notificationType: types[state], notification, timestamp: '2026-10-07T10:00:00Z', version: 2 };
        return signed(JSON.stringify(envelope));
      },
      forge: (w) => ({ body: w.body, headers: { [STUB_HEADER]: sigOf(other, w.body) } }),
    };
  },
};

const fake: Harness = {
  name: 'FakePartner',
  make: (o) => {
    const secret = randomBytes(32);
    const partner = new FakePartner({ ...o, secret });
    const signed = (text: string | Uint8Array): Wire => {
      const body = typeof text === 'string' ? enc(text) : text;
      return { body, headers: { [FAKE_SIGNATURE_HEADER]: fakePartnerSign(secret, body) } };
    };
    return {
      partner,
      signed,
      cb: (payoutId, state, x = {}) => signed(JSON.stringify({ eventId: x.eventId ?? randomUUID(), payoutId, state, reason: x.reason ?? null })),
      forge: (w) => ({ body: w.body, headers: { [FAKE_SIGNATURE_HEADER]: fakePartnerSign(randomBytes(32), w.body) } }),
    };
  },
};

describe.each([stub, fake])('PayoutPartner contract: $name', (h) => {
  async function setup(over: Partial<{ gate: Partial<CrossBorderGate>; funded: boolean; country: string; currency: string; chainId: bigint; maxAmount: bigint }> = {}) {
    const { store, clock } = makeStore(10_000n, new Clock(1n));
    const ref = await store.create(owner, bankDetails({ country: over.country ?? 'ZA', currency: fiatCode(over.currency ?? 'ZAR') }));
    let funded = over.funded ?? true;
    const built = h.make({
      recipients: (r) => store.meta(r),
      gate: { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: false, testnetDemo: false, ...over.gate },
      settlementNetwork: { network: NETWORK, chainId: over.chainId ?? 5042002n },
      isFunded: (f, b) => funded && f.txHash !== TX_BAD && b.amount <= (over.maxAmount ?? 12_345n),
    });
    const req: PartnerPayoutRequest = { recipientRef: ref, currency: fiatCode(over.currency ?? 'ZAR'), amount: cbsMinor(12_345n), funding: { network: NETWORK, txHash: TX } };
    return { ...built, store, clock, ref, req, setFunded: (v: boolean) => (funded = v) };
  }
  async function created(s: Awaited<ReturnType<typeof setup>>, key = k1): Promise<string> {
    // one funding per payout: a distinct (valid) funding transaction for each key
    const tx = key === k1 ? TX : (('0x' + Buffer.from(key).toString('hex').padEnd(64, '0').slice(0, 64)) as Hex32);
    const r = await s.partner.createPayout(key, { ...s.req, funding: { network: NETWORK, txHash: tx } });
    if (r.kind !== 'OK') throw new Error(`create failed: ${JSON.stringify(r)}`);
    return r.value.payoutId;
  }

  it('labels what is behind the port', async () => {
    const s = await setup();
    expect(s.partner.kind).toBe(h.name === 'FakePartner' ? 'FAKE_PARTNER' : 'CPN_STUB');
  });

  describe('createPayout', () => {
    it('is exactly-once on the key: same request replays, another request is KEY_CONFLICT', async () => {
      const s = await setup();
      const a = await s.partner.createPayout(k1, s.req);
      const b = await s.partner.createPayout(k1, s.req);
      expect(a).toMatchObject({ kind: 'OK', replayed: false });
      expect(b).toMatchObject({ kind: 'OK', replayed: true });
      expect(a.kind === 'OK' && b.kind === 'OK' && a.value.payoutId === b.value.payoutId).toBe(true);
      for (const other of [
        { ...s.req, amount: cbsMinor(12_346n) },
        { ...s.req, funding: { network: NETWORK, txHash: TX2 } },
        { ...s.req, funding: { network: 'OTHER' as unknown as NetworkId, txHash: TX } },
        { ...s.req, recipientRef: (await s.store.create(owner, bankDetails())) },
      ]) {
        expect(await s.partner.createPayout(k1, other)).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
      }
      const c = await s.partner.createPayout(k2, { ...s.req, funding: { network: NETWORK, txHash: TX2 } });
      expect(c.kind === 'OK' && a.kind === 'OK' && c.value.payoutId !== a.value.payoutId).toBe(true);
    });

    it('refuses a non-positive amount', async () => {
      const s = await setup();
      for (const amount of [0n, -1n]) {
        expect(await s.partner.createPayout(k1, { ...s.req, amount: amount as ReturnType<typeof cbsMinor> })).toMatchObject({ kind: 'REJECTED', code: 'AMOUNT_INVALID' });
      }
    });

    it('refuses an unknown, malformed or deleted recipient without revealing why', async () => {
      const s = await setup();
      const bad = await s.partner.createPayout(k1, { ...s.req, recipientRef: 'nope' as typeof s.req.recipientRef });
      expect(bad).toMatchObject({ kind: 'REJECTED', code: 'BENEFICIARY_INVALID' });
      s.store.delete(s.ref);
      expect(await s.partner.createPayout(k2, s.req)).toMatchObject({ kind: 'REJECTED', code: 'BENEFICIARY_INVALID' });
    });

    it('refuses a recipient past its retention', async () => {
      const s = await setup();
      s.clock.t = 1_000_000n;
      expect(await s.partner.createPayout(k1, s.req)).toMatchObject({ kind: 'REJECTED', code: 'BENEFICIARY_INVALID' });
    });

    it('binds the payout currency to the recipient account', async () => {
      const s = await setup();
      expect(await s.partner.createPayout(k1, { ...s.req, currency: fiatCode('EUR') })).toMatchObject({ kind: 'REJECTED', code: 'CURRENCY_MISMATCH' });
    });

    it('cross-border is refused by default, with the home country allowed', async () => {
      const home = await setup();
      expect((await home.partner.createPayout(k1, home.req)).kind).toBe('OK');
      const abroad = await setup({ country: 'US', currency: 'USD' });
      const r = await abroad.partner.createPayout(k1, abroad.req);
      expect(r).toMatchObject({ kind: 'REJECTED', code: 'CROSS_BORDER_DISABLED' });
      // refused even when everything else is right, and nothing was recorded under the key
      expect(await abroad.partner.createPayout(k1, abroad.req)).toMatchObject({ code: 'CROSS_BORDER_DISABLED' });
    });

    it('cross-border is enabled only by a recorded legal opinion or the labelled testnet demo flag', async () => {
      for (const gate of [{ legalOpinionRecorded: true }, { testnetDemo: true }]) {
        const s = await setup({ country: 'US', currency: 'USD', gate });
        expect((await s.partner.createPayout(k1, s.req)).kind).toBe('OK');
      }
    });

    it('the testnet demo flag opens nothing off Arc testnet (chain ID 5042002), and a home country in a foreign currency is cross-border', async () => {
      for (const chainId of [5042n, 1n, 0n]) {
        const s = await setup({ country: 'US', currency: 'USD', gate: { testnetDemo: true }, chainId });
        expect(await s.partner.createPayout(k1, s.req)).toMatchObject({ code: 'CROSS_BORDER_DISABLED' });
      }
      const unset = h.make({ recipients: () => ({ country: 'US', currency: fiatCode('USD') }), gate: { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: false, testnetDemo: true }, isFunded: () => true });
      const { store } = makeStore(10_000n, new Clock(1n));
      const ref = await store.create(owner, bankDetails({ country: 'US', currency: fiatCode('USD') }));
      const r = { recipientRef: ref, currency: fiatCode('USD'), amount: cbsMinor(5n), funding: { network: NETWORK, txHash: TX } };
      expect(await unset.partner.createPayout(k1, r)).toMatchObject({ code: 'CROSS_BORDER_DISABLED' });
      const za = await setup({ country: 'ZA', currency: 'USD' });
      expect(await za.partner.createPayout(k1, za.req)).toMatchObject({ code: 'CROSS_BORDER_DISABLED' });
    });

    it('one funding licenses one payout: a second key reusing it is refused, a replay of the first is not', async () => {
      const s = await setup();
      const first = await s.partner.createPayout(k1, s.req);
      expect(first.kind).toBe('OK');
      expect(await s.partner.createPayout(k2, s.req)).toMatchObject({ kind: 'REJECTED', code: 'FUNDING_ALREADY_USED', detail: 'funding transfer already licenses another payout' });
      expect(await s.partner.createPayout(k1, s.req)).toMatchObject({ kind: 'OK', replayed: true });
      const other = { ...s.req, funding: { network: NETWORK, txHash: TX2 } };
      expect((await s.partner.createPayout(k2, other)).kind).toBe('OK');
    });

    it('one transaction hash is one funding whatever its spelling (MC-10); a malformed hash is refused', async () => {
      const s = await setup();
      expect((await s.partner.createPayout(k1, s.req)).kind).toBe('OK');
      const spell = (txHash: string): PartnerPayoutRequest => ({ ...s.req, funding: { network: NETWORK, txHash: txHash as Hex32 } });
      const upper = '0x' + 'AB'.repeat(32);
      const mixed = '0x' + 'aB'.repeat(32);
      expect(await s.partner.createPayout(k2, spell(upper))).toMatchObject({ kind: 'REJECTED', code: 'FUNDING_ALREADY_USED' });
      expect(await s.partner.createPayout(k3, spell(mixed))).toMatchObject({ kind: 'REJECTED', code: 'FUNDING_ALREADY_USED' });
      // the first key replays with any spelling of its own hash, and still gets the same payout
      const first = await s.partner.createPayout(k1, s.req);
      expect(await s.partner.createPayout(k1, spell(upper))).toEqual(first);
      for (const bad of ['not-a-hash', '0x' + 'ab'.repeat(31), '0x' + 'zz'.repeat(32), '']) {
        expect(await s.partner.createPayout(k3, spell(bad))).toMatchObject({ kind: 'REJECTED', code: 'FUNDING_INVALID' });
      }
      // a malformed hash never reaches the funding check
      const seen: string[] = [];
      const t = h.make({ recipients: (r) => s.store.meta(r), gate: { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: false, testnetDemo: false }, isFunded: (f) => (seen.push(f.txHash), true) });
      await t.partner.createPayout(k1, spell(upper));
      expect(seen).toEqual([TX]);
    });

    it('a throwing or repeating newId does not consume the funding', async () => {
      let n = 0;
      const s = await setup();
      const t = h.make({
        recipients: (r) => s.store.meta(r),
        gate: { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: false, testnetDemo: false },
        isFunded: () => true,
        newId: () => {
          n += 1;
          if (n === 1) throw new Error('no id');
          return n <= 3 ? 'dup' : 'fresh';
        },
      });
      const second = { ...s.req, funding: { network: NETWORK, txHash: TX2 } };
      await expect(t.partner.createPayout(k1, s.req)).rejects.toThrow('no id');
      expect((await t.partner.createPayout(k2, s.req)).kind).toBe('OK'); // the funding was not stranded by the throw
      await expect(t.partner.createPayout(k3, second)).rejects.toThrow('payout already registered');
      expect((await t.partner.createPayout(k3, second)).kind).toBe('OK'); // nor by the repeated id
    });

    it('a refused funding check does not consume the funding, and a throwing check fails closed', async () => {
      const s = await setup({ funded: false });
      expect(await s.partner.createPayout(k1, s.req)).toMatchObject({ code: 'NOT_FUNDED' });
      s.setFunded(true);
      expect((await s.partner.createPayout(k2, s.req)).kind).toBe('OK');
      const t = h.make({ recipients: () => ({ country: 'ZA', currency: fiatCode('ZAR') }), gate: { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: false, testnetDemo: false }, isFunded: () => { throw new Error('indexer down'); } });
      const { store } = makeStore(10_000n, new Clock(1n));
      const ref = await store.create(owner, bankDetails({ country: 'ZA', currency: fiatCode('ZAR') }));
      expect(await t.partner.createPayout(k1, { recipientRef: ref, currency: fiatCode('ZAR'), amount: cbsMinor(5n), funding: { network: NETWORK, txHash: TX } })).toMatchObject({ code: 'NOT_FUNDED' });
    });

    it('the funding check is bound to the payout: over-amount is refused (the check sees key, ref, currency and amount)', async () => {
      const s = await setup({ maxAmount: 12_345n });
      const big = { ...s.req, amount: cbsMinor(99_999_999_999n) };
      expect(await s.partner.createPayout(k1, big)).toMatchObject({ code: 'NOT_FUNDED' });
      const seen: FundingBinding[] = [];
      const t = h.make({ recipients: (r) => s.store.meta(r), gate: { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: false, testnetDemo: false }, isFunded: (_f, b) => (seen.push(b), true) });
      expect((await t.partner.createPayout(k2, s.req)).kind).toBe('OK');
      expect(seen).toEqual([{ key: k2, recipientRef: s.ref, currency: s.req.currency, amount: s.req.amount }]);
    });

    it('is not created before our own indexer confirmed the funding, and a refusal is not cached', async () => {
      const s = await setup({ funded: false });
      expect(await s.partner.createPayout(k1, s.req)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FUNDED' });
      const wrongTx = { ...s.req, funding: { network: NETWORK, txHash: TX_BAD } };
      s.setFunded(true);
      expect(await s.partner.createPayout(k1, wrongTx)).toMatchObject({ code: 'NOT_FUNDED' });
      expect((await s.partner.createPayout(k1, s.req)).kind).toBe('OK');
    });
  });

  describe('callbacks', () => {
    it('PAID licenses ARRIVED, and nothing earlier does', async () => {
      const s = await setup();
      const id = await created(s);
      expect(s.partner.arrived(id)).toBe(false);
      expect(s.partner.handleCallback(...args(s.cb(id, 'PENDING')))).toMatchObject({ kind: 'OK', value: { state: 'PENDING', applied: false } });
      expect(s.partner.arrived(id)).toBe(false);
      const r = s.partner.handleCallback(...args(s.cb(id, 'PAID')));
      expect(r).toMatchObject({ kind: 'OK', replayed: false, value: { payoutId: id, state: 'PAID', applied: true, report: null } });
      expect(s.partner.arrived(id)).toBe(true);
      expect(s.partner.reports()).toEqual([]);
    });

    it('verifyCallback decodes an authentic callback and records nothing', async () => {
      const s = await setup();
      const id = await created(s);
      const w = s.cb(id, 'PAID', { eventId: 'evt-1' });
      for (let i = 0; i < 2; i += 1) {
        expect(s.partner.verifyCallback(w.body, w.headers)).toMatchObject({ kind: 'OK', value: { eventId: 'evt-1', payoutId: id, state: 'PAID' } });
      }
      expect(s.partner.arrived(id)).toBe(false);
    });

    it('a forged signature, a missing signature and a tampered body license nothing', async () => {
      const s = await setup();
      const id = await created(s);
      const w = s.cb(id, 'PAID');
      const tampered = { body: enc(new TextDecoder().decode(w.body).replace('PAID', 'PAID ').replace('COMPLETED', 'COMPLETED ')), headers: w.headers };
      for (const bad of [s.forge(w), { body: w.body, headers: {} }, tampered, { body: w.body, headers: { [STUB_HEADER]: 'zz', [FAKE_SIGNATURE_HEADER]: 'zz' } }]) {
        expect(s.partner.handleCallback(bad.body, bad.headers)).toMatchObject({ kind: 'REJECTED', code: 'BAD_SIGNATURE' });
        expect(s.partner.verifyCallback(bad.body, bad.headers)).toMatchObject({ kind: 'REJECTED', code: 'BAD_SIGNATURE' });
      }
      expect(s.partner.arrived(id)).toBe(false);
      expect(s.partner.reports()).toEqual([]);
      // and the authentic one still works afterwards: the forgery did not poison dedupe
      expect(s.partner.handleCallback(...args(w))).toMatchObject({ kind: 'OK', value: { applied: true } });
    });

    it('a duplicate is a no-op, by state and by partner event id', async () => {
      const s = await setup();
      const id = await created(s);
      const w = s.cb(id, 'FAILED', { eventId: 'evt-9' });
      expect(s.partner.handleCallback(...args(w))).toMatchObject({ kind: 'OK', replayed: false, value: { applied: true } });
      expect(s.partner.handleCallback(...args(w))).toMatchObject({ kind: 'OK', replayed: true, value: { applied: false, report: null } });
      expect(s.partner.handleCallback(...args(s.cb(id, 'FAILED')))).toMatchObject({ kind: 'OK', replayed: true, value: { applied: false } });
      // same event id carrying a different state is still a redelivery, never a transition
      expect(s.partner.handleCallback(...args(s.cb(id, 'RETURNED', { eventId: 'evt-9' })))).toMatchObject({ kind: 'OK', replayed: true, value: { applied: false } });
      expect(s.partner.reports()).toHaveLength(1);
    });

    it('an event id seen on one payout does not suppress another payout', async () => {
      const s = await setup();
      const a = await created(s, k1);
      const b = await created(s, k2);
      s.partner.handleCallback(...args(s.cb(a, 'PAID', { eventId: 'shared' })));
      expect(s.partner.handleCallback(...args(s.cb(b, 'PAID', { eventId: 'shared' })))).toMatchObject({ kind: 'OK', value: { applied: true } });
      expect(s.partner.arrived(b)).toBe(true);
    });

    it('out of order: RETURNED before a final state is refused and redelivery works; a late PENDING or PAID after a final state is stale', async () => {
      const s = await setup();
      const id = await created(s);
      const early = s.cb(id, 'RETURNED', { eventId: 'evt-r' });
      expect(s.partner.handleCallback(...args(early))).toMatchObject({ kind: 'REJECTED', code: 'OUT_OF_ORDER' });
      expect(s.partner.handleCallback(...args(early))).toMatchObject({ kind: 'REJECTED', code: 'OUT_OF_ORDER' });
      expect(s.partner.reports()).toEqual([]);
      expect(s.partner.handleCallback(...args(s.cb(id, 'FAILED')))).toMatchObject({ kind: 'OK', value: { applied: true, report: { kind: 'REFUND_DUE' } } });
      expect(s.partner.handleCallback(...args(early))).toMatchObject({ kind: 'OK', value: { applied: true, state: 'RETURNED', report: { kind: 'REFUND_RECEIVED' } } });
      // a late PENDING after RETURNED changes nothing; a replayed FAILED (new event id) is a duplicate state
      expect(s.partner.handleCallback(...args(s.cb(id, 'PENDING')))).toMatchObject({ kind: 'OK', value: { applied: false, state: 'RETURNED' } });
      expect(s.partner.handleCallback(...args(s.cb(id, 'FAILED')))).toMatchObject({ kind: 'OK', value: { applied: false, state: 'RETURNED' } });
      // a PAID after FAILED and RETURNED contradicts the final state: conflict, quarantine, one report
      expect(s.partner.handleCallback(...args(s.cb(id, 'PAID')))).toMatchObject({ kind: 'REJECTED', code: 'CONFLICT' });
      expect(s.partner.reports().filter((x) => x.kind === 'CONFLICT')).toHaveLength(1);
      expect(s.partner.arrived(id)).toBe(false);
    });

    it('a failed refund is reported for Ops, is out of order before a final state, and conflicts with RETURNED', async () => {
      const s = await setup();
      const id = await created(s);
      const early = s.cb(id, 'REFUND_FAILED', { eventId: 'evt-rf' });
      expect(s.partner.handleCallback(...args(early))).toMatchObject({ kind: 'REJECTED', code: 'OUT_OF_ORDER' });
      s.partner.handleCallback(...args(s.cb(id, 'FAILED')));
      expect(s.partner.handleCallback(...args(early))).toMatchObject({ kind: 'OK', value: { applied: true, state: 'REFUND_FAILED', report: { kind: 'REFUND_FAILED' } } });
      expect(s.partner.handleCallback(...args(early))).toMatchObject({ kind: 'OK', value: { applied: false } });
      expect(s.partner.handleCallback(...args(s.cb(id, 'RETURNED')))).toMatchObject({ kind: 'REJECTED', code: 'CONFLICT' });
      expect(s.partner.reports().map((r) => r.kind)).toEqual(['REFUND_DUE', 'REFUND_FAILED', 'CONFLICT']);
    });

    it('PAID arriving before PENDING is applied (final state wins), and a later PENDING is stale', async () => {
      const s = await setup();
      const id = await created(s);
      s.partner.handleCallback(...args(s.cb(id, 'PAID')));
      expect(s.partner.handleCallback(...args(s.cb(id, 'PENDING')))).toMatchObject({ kind: 'OK', value: { applied: false, state: 'PAID' } });
      expect(s.partner.arrived(id)).toBe(true);
    });

    it('a failed payout is reported for refund; the returned funds close it', async () => {
      const s = await setup();
      const id = await created(s);
      s.partner.handleCallback(...args(s.cb(id, 'FAILED', { reason: 'ACCOUNT_CLOSED' })));
      s.partner.handleCallback(...args(s.cb(id, 'RETURNED')));
      const kinds = s.partner.reports().map((r) => r.kind);
      expect(kinds).toEqual(['REFUND_DUE', 'REFUND_RECEIVED']);
      expect(s.partner.reports().every((r) => r.payoutId === id)).toBe(true);
      expect(s.partner.arrived(id)).toBe(false);
    });

    it('a payout returned after PAID is a claim, and ARRIVED is withdrawn', async () => {
      const s = await setup();
      const id = await created(s);
      s.partner.handleCallback(...args(s.cb(id, 'PAID')));
      expect(s.partner.arrived(id)).toBe(true);
      s.partner.handleCallback(...args(s.cb(id, 'RETURNED')));
      expect(s.partner.reports().map((r) => r.kind)).toEqual(['CLAIM']);
      expect(s.partner.arrived(id)).toBe(false);
    });

    it('PAID and FAILED for one payout is a conflict: quarantined, reported once, ARRIVED withdrawn', async () => {
      for (const order of [['PAID', 'FAILED'], ['FAILED', 'PAID']] as const) {
        const s = await setup();
        const id = await created(s);
        s.partner.handleCallback(...args(s.cb(id, order[0])));
        const r = s.partner.handleCallback(...args(s.cb(id, order[1])));
        expect(r).toMatchObject({ kind: 'REJECTED', code: 'CONFLICT' });
        expect(s.partner.arrived(id)).toBe(false);
        expect(s.partner.handleCallback(...args(s.cb(id, order[1])))).toMatchObject({ kind: 'REJECTED', code: 'CONFLICT' });
        expect(s.partner.handleCallback(...args(s.cb(id, 'RETURNED')))).toMatchObject({ kind: 'REJECTED', code: 'CONFLICT' });
        expect(s.partner.reports().filter((x) => x.kind === 'CONFLICT')).toHaveLength(1);
      }
    });

    it('a callback for a payout we never created is refused', async () => {
      const s = await setup();
      expect(s.partner.handleCallback(...args(s.cb('ghost-1', 'PAID')))).toMatchObject({ kind: 'REJECTED', code: 'UNKNOWN_PAYOUT' });
      expect(s.partner.arrived('ghost-1')).toBe(false);
    });

    it('an authentic but malformed callback is refused', async () => {
      const s = await setup();
      const id = await created(s);
      const base = s.cb(id, 'PAID');
      const good = parseJson(new TextDecoder().decode(base.body));
      const o = asObject(good, 'x');
      expect(reqString(o, h.name === 'FakePartner' ? 'payoutId' : 'notificationType').length > 0).toBe(true);
      const bodies: (string | Uint8Array)[] = [
        '',
        'not json',
        '[]',
        '"x"',
        '{}',
        Uint8Array.from([0xff, 0xfe]),
        '{"notificationType":1,"notificationId":"e","notification":{}}',
        '{"eventId":"e","payoutId":"p","state":"EXPLODED","reason":null}',
        '{"eventId":"e","payoutId":"p","state":"PAID","reason":5}',
        '{"eventId":"","payoutId":"p","state":"PAID"}',
        '{"eventId":"e","payoutId":"has space","state":"PAID"}',
        '{"notificationId":"e","notificationType":"cpn.payment.completed","notification":{"id":"has space","status":"COMPLETED"}}',
        '{"notificationId":"","notificationType":"cpn.payment.completed","notification":{"id":"p","status":"COMPLETED"}}',
        '{"notificationId":"e","notificationType":"cpn.payment.completed","notification":[]}',
      ];
      for (const b of bodies) {
        const w = s.signed(b);
        expect(s.partner.handleCallback(w.body, w.headers)).toMatchObject({ kind: 'REJECTED', code: 'MALFORMED' });
      }
      expect(s.partner.arrived(id)).toBe(false);
    });

    it('free-text reasons are dropped, machine tokens kept', async () => {
      const s = await setup();
      const id = await created(s);
      s.partner.handleCallback(...args(s.cb(id, 'FAILED', { reason: `account ${PII_STRINGS[1]} belongs to ${PII_STRINGS[0]}` })));
      const id2 = await created(s, k2);
      s.partner.handleCallback(...args(s.cb(id2, 'FAILED', { reason: 'ACCOUNT_CLOSED' })));
      const reasons = s.partner.reports().map((r) => r.reason);
      expect(reasons[0]).toBe(h.name === 'FakePartner' ? null : 'cpn.payment.failed');
      // the CPN stub derives its own token; the fake passes the partner's machine token through
      expect(reasons[1]).toBe(h.name === 'FakePartner' ? 'ACCOUNT_CLOSED' : 'cpn.payment.failed');
    });
  });

  it('PII never appears in anything the partner returns, reports or renders', async () => {
    const s = await setup();
    const id = await created(s);
    const out: unknown[] = [];
    out.push(await s.partner.createPayout(k1, s.req), await s.partner.createPayout(k2, { ...s.req, amount: cbsMinor(1n) }));
    out.push(s.partner.handleCallback(...args(s.cb(id, 'FAILED', { reason: PII_STRINGS[0] ?? null }))));
    out.push(s.partner.handleCallback(...args(s.cb(id, 'PAID'))));
    out.push(s.partner.reports(), s.partner);
    const text = out.map((x) => JSON.stringify(x, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)) + inspect(x, { depth: 9 })).join('\n');
    expect(leaks(text)).toEqual([]);
    // the request type has no PII field at all: only the opaque ref
    expect(Object.keys(s.req).sort()).toEqual(['amount', 'currency', 'funding', 'recipientRef']);
  });

  it('the payout request is bound to stored routing facts, not to caller claims', async () => {
    const s = await setup({ country: 'US', currency: 'USD' });
    // the caller cannot claim the home country: the lookup decides
    expect(await s.partner.createPayout(k1, s.req)).toMatchObject({ code: 'CROSS_BORDER_DISABLED' });
  });
});

function args(w: Wire): [Uint8Array, Record<string, string>] {
  return [w.body, w.headers];
}

// A used import for the shared KMS so the contract file documents the real store wiring.
void AesKms;
