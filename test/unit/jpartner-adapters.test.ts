/** Adapter-specific behaviour of the CPN stub and the fake, plus the shared core helpers and the tracker. */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { cbsMinor } from '../../src/amounts/index.js';
import { JsonObject, optString } from '../../src/dfns/json.js';
import { decodeBodyObject, headerValue } from '../../src/journey/payout/partner/core.js';
import { CpnStubPartner } from '../../src/journey/payout/partner/cpn-stub.js';
import { FAKE_SIGNATURE_HEADER, FakePartner, fakePartnerSign } from '../../src/journey/payout/partner/fake.js';
import { canonicalRequest } from '../../src/journey/payout/partner/port.js';
import type { PartnerCallback } from '../../src/journey/payout/partner/port.js';
import { PayoutTracker, safeReason } from '../../src/journey/payout/partner/tracker.js';
import { fiatCode, idempotencyKey } from '../../src/nova-ports/ids.js';
import type { Hex32, NetworkId } from '../../src/nova-ports/ids.js';
import type { RecipientRef } from '../../src/journey/recipients/index.js';

const TX = ('0x' + 'ab'.repeat(32)) as Hex32;
const NET = 'ARC' as unknown as NetworkId;
const REF = ('rcp-' + 'a'.repeat(32)) as RecipientRef;
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const base = {
  recipients: () => ({ country: 'ZA', currency: fiatCode('ZAR') }),
  gate: { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: false, testnetDemo: false },
  isFunded: () => true,
};
const req = { recipientRef: REF, currency: fiatCode('ZAR'), amount: cbsMinor(5n), funding: { network: NET, txHash: TX } };

describe('shared core helpers', () => {
  it('headerValue is case-insensitive, exact on the name, and null when absent', () => {
    expect(headerValue({ 'X-Sig': 'a' }, 'x-sig')).toBe('a');
    expect(headerValue({ 'x-sig': 'a', 'X-SIG': 'b' }, 'X-Sig')).toBe('a');
    expect(headerValue({ 'x-sig2': 'a' }, 'x-sig')).toBeNull();
    expect(headerValue({}, 'x-sig')).toBeNull();
  });
  it('decodeBodyObject accepts only UTF-8 JSON objects', () => {
    expect(decodeBodyObject(enc('{"a":"b"}'))).toBeInstanceOf(JsonObject);
    for (const bad of [enc('[]'), enc('1'), enc('{'), enc(''), Uint8Array.from([0xc3, 0x28])]) expect(decodeBodyObject(bad)).toBeNull();
  });
  it('canonicalRequest covers every field of the request', () => {
    const c = canonicalRequest(req);
    expect(JSON.parse(c)).toEqual([REF, 'ZAR', '5', 'ARC', TX]);
  });
  it('default payout ids are unique, and an injected source is used', async () => {
    const p = new FakePartner({ ...base, secret: randomBytes(16) });
    const a = await p.createPayout(idempotencyKey('k:a'), req);
    const b = await p.createPayout(idempotencyKey('k:b'), { ...req, funding: { ...req.funding, txHash: ('0x' + 'dd'.repeat(32)) as typeof req.funding.txHash } });
    expect(a.kind === 'OK' && b.kind === 'OK' && a.value.payoutId !== b.value.payoutId).toBe(true);
    const q = new FakePartner({ ...base, secret: randomBytes(16), newId: () => 'fixed' });
    expect(await q.createPayout(idempotencyKey('k:a'), req)).toMatchObject({ value: { payoutId: 'fake-fixed' } });
    const stub = new CpnStubPartner({ ...base, newId: () => 'fixed', verifySignature: () => true });
    expect(await stub.createPayout(idempotencyKey('k:a'), req)).toMatchObject({ value: { payoutId: 'fixed' } });
  });
  it('the default id looks like the UUID shape CPN uses for payment ids', async () => {
    const stub = new CpnStubPartner({ ...base, verifySignature: () => true });
    const r = await stub.createPayout(idempotencyKey('k:a'), req);
    expect(r.kind === 'OK' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(r.value.payoutId)).toBe(true);
  });
  it('the gate is evaluated on the recipient country, case-sensitively', async () => {
    const p = new FakePartner({ ...base, secret: randomBytes(16), recipients: () => ({ country: 'za', currency: fiatCode('ZAR') }) });
    expect(await p.createPayout(idempotencyKey('k:a'), req)).toMatchObject({ code: 'CROSS_BORDER_DISABLED' });
  });
  it('checks run in the documented order', async () => {
    const lookup = vi.fn(() => ({ country: 'US', currency: fiatCode('USD') }));
    const funded = vi.fn(() => false);
    const p = new FakePartner({ ...base, secret: randomBytes(16), recipients: lookup, isFunded: funded });
    // amount before recipient
    expect(await p.createPayout(idempotencyKey('k:a'), { ...req, amount: cbsMinor(0n) })).toMatchObject({ code: 'AMOUNT_INVALID' });
    expect(lookup).not.toHaveBeenCalled();
    // currency before gate before funding
    expect(await p.createPayout(idempotencyKey('k:a'), req)).toMatchObject({ code: 'CURRENCY_MISMATCH' });
    expect(funded).not.toHaveBeenCalled();
    const p2 = new FakePartner({ ...base, secret: randomBytes(16), recipients: () => ({ country: 'US', currency: fiatCode('ZAR') }), isFunded: funded });
    expect(await p2.createPayout(idempotencyKey('k:a'), req)).toMatchObject({ code: 'CROSS_BORDER_DISABLED' });
    expect(funded).not.toHaveBeenCalled();
  });
});

describe('FakePartner', () => {
  const secret = randomBytes(32);
  const p = new FakePartner({ ...base, secret });
  const body = enc(JSON.stringify({ eventId: 'e', payoutId: 'p', state: 'PAID', reason: null }));
  it('accepts an HMAC-SHA256 hex signature over the raw body, header name in any case', () => {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(fakePartnerSign(secret, body)).toBe(sig);
    expect(p.verifyCallback(body, { [FAKE_SIGNATURE_HEADER.toUpperCase()]: sig })).toMatchObject({ kind: 'OK' });
  });
  it('refuses a wrong-key, upper-case, short, long or missing signature', () => {
    const sig = fakePartnerSign(secret, body);
    for (const bad of [fakePartnerSign(randomBytes(32), body), sig.toUpperCase(), sig.slice(1), sig + '0', '']) {
      expect(p.verifyCallback(body, { [FAKE_SIGNATURE_HEADER]: bad })).toMatchObject({ kind: 'REJECTED', code: 'BAD_SIGNATURE' });
    }
    expect(p.verifyCallback(body, {})).toMatchObject({ code: 'BAD_SIGNATURE' });
  });
  it('requires a secret of at least 16 bytes and copies it', () => {
    expect(() => new FakePartner({ ...base, secret: randomBytes(15) })).toThrow(RangeError);
    expect(() => new FakePartner({ ...base, secret: new Uint8Array(0) })).toThrow(RangeError);
    const s = randomBytes(16);
    const q = new FakePartner({ ...base, secret: s });
    const sig = fakePartnerSign(s, body);
    s.fill(0);
    expect(q.verifyCallback(body, { [FAKE_SIGNATURE_HEADER]: sig })).toMatchObject({ kind: 'OK' });
  });
  it('decodes each state and a null or absent reason', () => {
    for (const state of ['PENDING', 'PAID', 'FAILED', 'RETURNED']) {
      const b = enc(JSON.stringify({ eventId: 'e', payoutId: 'p', state }));
      expect(p.verifyCallback(b, { [FAKE_SIGNATURE_HEADER]: fakePartnerSign(secret, b) })).toMatchObject({ kind: 'OK', value: { state, reason: null } });
    }
  });
  it('is labelled in its documentation and kind', () => {
    expect(p.kind).toBe('FAKE_PARTNER');
  });
});

describe('CpnStubPartner mapping (event types from references_webhooks_webhook-events.md)', () => {
  const sigOk = vi.fn(() => true);
  const p = new CpnStubPartner({ ...base, verifySignature: sigOk, refundPaymentId: (n) => { const v = n.get('paymentId'); return typeof v === 'string' ? v : null; } });
  const env = (notificationType: string, notification: unknown, notificationId: unknown = 'n-1'): Uint8Array =>
    enc(JSON.stringify({ subscriptionId: randomUUID(), notificationId, notificationType, notification, timestamp: '2026-10-07T00:00:00Z', version: 2 }));
  const v = (b: Uint8Array) => p.verifyCallback(b, {});

  it('maps every payment event', () => {
    const cases: [string, string, string, string | null][] = [
      ['cpn.payment.cryptoFundsPending', 'CRYPTO_FUNDS_PENDING', 'PENDING', null],
      ['cpn.payment.fiatPaymentInitiated', 'FIAT_PAYMENT_INITIATED', 'PENDING', null],
      ['cpn.payment.delayed', 'FIAT_PAYMENT_INITIATED', 'PENDING', null],
      ['cpn.payment.inManualReview', 'CREATED', 'PENDING', null],
      ['cpn.payment.completed', 'COMPLETED', 'PAID', null],
      ['cpn.payment.failed', 'FAILED', 'FAILED', 'cpn.payment.failed'],
    ];
    for (const [type, status, state, reason] of cases) {
      expect(v(env(type, { id: 'pay-1', status }))).toMatchObject({ kind: 'OK', value: { eventId: 'n-1', payoutId: 'pay-1', state, reason } });
    }
  });
  it('refuses completed and failed whose status disagrees with the event type', () => {
    expect(v(env('cpn.payment.completed', { id: 'p', status: 'FAILED' }))).toMatchObject({ code: 'MALFORMED' });
    expect(v(env('cpn.payment.completed', { id: 'p', status: 'FIAT_PAYMENT_INITIATED' }))).toMatchObject({ code: 'MALFORMED' });
    expect(v(env('cpn.payment.failed', { id: 'p', status: 'COMPLETED' }))).toMatchObject({ code: 'MALFORMED' });
    expect(v(env('cpn.payment.completed', { id: 'p' }))).toMatchObject({ code: 'MALFORMED' });
  });
  it('progress events need no status, only an id', () => {
    expect(v(env('cpn.payment.delayed', { id: 'p' }))).toMatchObject({ kind: 'OK' });
    expect(v(env('cpn.payment.delayed', {}))).toMatchObject({ code: 'MALFORMED' });
  });
  it('a refund completion is a return, naming the payment through the injected extractor only', () => {
    expect(v(env('cpn.refund.completed', { paymentId: 'pay-1' }))).toMatchObject({ kind: 'OK', value: { payoutId: 'pay-1', state: 'RETURNED', reason: 'cpn.refund.completed' } });
    expect(v(env('cpn.refund.completed', { id: 'pay-1' }))).toMatchObject({ code: 'MALFORMED' });
    expect(v(env('cpn.refund.completed', { paymentId: 'has space' }))).toMatchObject({ code: 'MALFORMED' });
    expect(v(env('cpn.refund.completed', { paymentId: '' }))).toMatchObject({ code: 'MALFORMED' });
    const noExtractor = new CpnStubPartner({ ...base, verifySignature: () => true });
    expect(noExtractor.verifyCallback(env('cpn.refund.completed', { paymentId: 'pay-1' }), {})).toMatchObject({ code: 'MALFORMED' });
  });
  it('a refund failure is a REFUND_FAILED report trigger, naming the payment through the injected extractor only', () => {
    expect(v(env('cpn.refund.failed', { paymentId: 'pay-1' }))).toMatchObject({ kind: 'OK', value: { payoutId: 'pay-1', state: 'REFUND_FAILED', reason: 'cpn.refund.failed' } });
    expect(v(env('cpn.refund.failed', { id: 'pay-1' }))).toMatchObject({ code: 'MALFORMED' });
    const noExtractor = new CpnStubPartner({ ...base, verifySignature: () => true });
    expect(noExtractor.verifyCallback(env('cpn.refund.failed', { paymentId: 'pay-1' }), {})).toMatchObject({ code: 'MALFORMED' });
  });
  it('the enumerated known no-op events are IGNORED, and nothing else is', () => {
    for (const t of ['cpn.rfi.inReview', 'cpn.rfi.approved', 'cpn.transaction.broadcasted', 'cpn.transaction.completed', 'cpn.transaction.failed', 'cpn.refund.created']) {
      expect(v(env(t, { id: 'p', status: 'COMPLETED' }))).toMatchObject({ kind: 'REJECTED', code: 'IGNORED' });
    }
  });
  it('an authentic event of an unrecognised type is UNKNOWN_EVENT (quarantine and page), never the benign IGNORED', () => {
    for (const t of ['cpn.payment.other', '', 'CPN.PAYMENT.COMPLETED', 'cpn.payment.completed ', 'cpn.rfi.other', 'x']) {
      expect(v(env(t, { id: 'p', status: 'COMPLETED' }))).toMatchObject({ kind: 'REJECTED', code: 'UNKNOWN_EVENT' });
    }
  });
  it('RFI events needing action become RFI_OPEN reports, naming the payment through the injected extractor only', () => {
    const q = new CpnStubPartner({ ...base, verifySignature: () => true, rfiPaymentId: (n) => optString(n, 'paymentRef') });
    for (const t of ['cpn.rfi.informationRequired', 'cpn.rfi.rejected']) {
      expect(q.verifyCallback(env(t, { paymentRef: 'pay-1' }), {})).toMatchObject({ kind: 'OK', value: { payoutId: 'pay-1', state: 'PENDING', reason: t, notice: 'RFI' } });
      expect(q.verifyCallback(env(t, { id: 'pay-1' }), {})).toMatchObject({ code: 'MALFORMED' });
      expect(q.verifyCallback(env(t, { paymentRef: 'has space' }), {})).toMatchObject({ code: 'MALFORMED' });
      expect(v(env(t, { paymentRef: 'pay-1' }))).toMatchObject({ code: 'MALFORMED' });
    }
  });
  it('requires the envelope fields', () => {
    expect(v(env('cpn.payment.completed', { id: 'p', status: 'COMPLETED' }, 5))).toMatchObject({ code: 'MALFORMED' });
    expect(v(env('cpn.payment.completed', { id: 'p', status: 'COMPLETED' }, 'has space'))).toMatchObject({ code: 'MALFORMED' });
    expect(v(enc('{"notificationId":"n","notification":{}}'))).toMatchObject({ code: 'MALFORMED' });
    expect(v(enc('{"notificationId":"n","notificationType":"cpn.payment.completed"}'))).toMatchObject({ code: 'MALFORMED' });
    expect(v(enc('{"notificationType":"cpn.payment.completed","notification":{"id":"p","status":"COMPLETED"}}'))).toMatchObject({ code: 'MALFORMED' });
  });
  it('authenticity runs first and fails closed, also on a throw; the verifier sees the raw body and headers', () => {
    const body = env('cpn.payment.completed', { id: 'p', status: 'COMPLETED' });
    const spy = vi.fn((_b: Uint8Array, _h: Readonly<Record<string, string>>) => false);
    const q = new CpnStubPartner({ ...base, verifySignature: spy });
    const headers = { 'x-any': '1' };
    expect(q.verifyCallback(body, headers)).toMatchObject({ code: 'BAD_SIGNATURE' });
    expect(spy).toHaveBeenCalledWith(body, headers);
    expect(q.verifyCallback(enc('not json'), {})).toMatchObject({ code: 'BAD_SIGNATURE' });
    const thrower = new CpnStubPartner({ ...base, verifySignature: () => { throw new Error('boom'); } });
    expect(thrower.verifyCallback(body, {})).toMatchObject({ code: 'BAD_SIGNATURE' });
    for (const notBool of [1, 'yes', {}, Promise.resolve(false)]) {
      const truthy = new CpnStubPartner({ ...base, verifySignature: () => notBool as unknown as boolean });
      expect(truthy.verifyCallback(body, {})).toMatchObject({ code: 'BAD_SIGNATURE' });
    }
  });
  it('is labelled a stub', () => {
    expect(p.kind).toBe('CPN_STUB');
  });
});

describe('PayoutTracker', () => {
  const cb = (state: PartnerCallback['state'], eventId: string = state, payoutId = 'p', reason: string | null = null): PartnerCallback => ({ eventId, payoutId, state, reason });
  it('register twice is a programming error; state is null for unknown', () => {
    const t = new PayoutTracker();
    expect(t.state('p')).toBeNull();
    t.register('p');
    expect(t.state('p')).toBe('PENDING');
    expect(() => t.register('p')).toThrow('payout already registered');
  });
  it('reports() hands out a copy', () => {
    const t = new PayoutTracker();
    t.register('p');
    t.apply(cb('FAILED'));
    const r = t.reports() as unknown[];
    expect(r).toHaveLength(1);
    expect(() => r.splice(0, 1)).not.toThrow();
    expect(t.reports()).toHaveLength(1);
  });
  it('safeReason keeps machine tokens only', () => {
    expect(safeReason(null)).toBeNull();
    expect(safeReason('A_b-1.2')).toBe('A_b-1.2');
    expect(safeReason('a'.repeat(64))).toBe('a'.repeat(64));
    for (const bad of ['', 'a'.repeat(65), 'has space', 'x\n', 'é']) expect(safeReason(bad)).toBeNull();
  });
  it('an out-of-order refusal is not remembered, but a stale one is', () => {
    const t = new PayoutTracker();
    t.register('p');
    expect(t.apply(cb('RETURNED', 'r1'))).toMatchObject({ code: 'OUT_OF_ORDER' });
    expect(t.apply(cb('RETURNED', 'r1'))).toMatchObject({ code: 'OUT_OF_ORDER' });
    t.apply(cb('PAID', 'a'));
    expect(t.apply(cb('PENDING', 's1'))).toMatchObject({ kind: 'OK', replayed: false, value: { applied: false } });
    expect(t.apply(cb('PENDING', 's1'))).toMatchObject({ kind: 'OK', replayed: true });
    expect(t.apply(cb('PENDING', 's2'))).toMatchObject({ kind: 'OK', replayed: true });
  });
  it('a conflict report carries only a safe reason', () => {
    const t = new PayoutTracker();
    t.register('p');
    t.apply(cb('PAID'));
    t.apply(cb('FAILED', 'f', 'p', 'John Smith'));
    expect(t.reports()).toEqual([{ payoutId: 'p', kind: 'CONFLICT', reason: null }]);
  });
  it('quarantine is per payout', () => {
    const t = new PayoutTracker();
    t.register('p');
    t.register('q');
    t.apply(cb('PAID'));
    t.apply(cb('FAILED'));
    t.apply(cb('PAID', 'x', 'q'));
    expect(t.arrived('p')).toBe(false);
    expect(t.arrived('q')).toBe(true);
    expect(t.arrived('none')).toBe(false);
  });
  it('an RFI is an RFI_OPEN report with no state change, deduplicated on the partner event id', () => {
    const t = new PayoutTracker();
    t.register('p');
    const rfi = (eventId: string): PartnerCallback => ({ eventId, payoutId: 'p', state: 'PENDING', reason: 'cpn.rfi.informationRequired', notice: 'RFI' });
    const first = t.apply(rfi('e1'));
    expect(first).toMatchObject({ kind: 'OK', replayed: false, value: { applied: true, state: 'PENDING', report: { kind: 'RFI_OPEN', payoutId: 'p' } } });
    expect(t.apply(rfi('e1'))).toMatchObject({ kind: 'OK', replayed: true, value: { applied: false, report: null } });
    expect(t.apply(rfi('e2'))).toMatchObject({ value: { applied: true } });
    expect(t.reports().map((r) => r.kind)).toEqual(['RFI_OPEN', 'RFI_OPEN']);
    expect(t.state('p')).toBe('PENDING');
    expect(t.arrived('p')).toBe(false);
    // an RFI does not suppress the real PENDING / PAID that follow
    expect(t.apply(cb('PAID', 'e3'))).toMatchObject({ value: { applied: true } });
    expect(t.apply({ ...rfi('e4'), payoutId: 'nope' })).toMatchObject({ code: 'UNKNOWN_PAYOUT' });
  });
  it('an RFI for a quarantined payout is refused as CONFLICT (already with Ops)', () => {
    const t = new PayoutTracker();
    t.register('p');
    t.apply(cb('PAID'));
    t.apply(cb('FAILED'));
    expect(t.apply({ eventId: 'r', payoutId: 'p', state: 'PENDING', reason: null, notice: 'RFI' })).toMatchObject({ code: 'CONFLICT' });
  });
  it('ids containing a colon cannot collide (MC-10): different tuples stay different', () => {
    const t = new PayoutTracker();
    t.register('a');
    t.register('a:PAID');
    t.register('a:x');
    expect(t.apply(cb('PAID', 'x', 'a'))).toMatchObject({ value: { applied: true } });
    // ('a:x','PAID') must not be treated as a replay of ('a', event 'x' ...) or of state PAID on 'a'
    t.register('b');
    t.register('b:e');
    expect(t.apply(cb('PAID', 'e:z', 'b'))).toMatchObject({ value: { applied: true } });
    expect(t.apply(cb('PAID', 'z', 'b:e'))).toMatchObject({ value: { applied: true } });
    expect(t.apply(cb('PAID', 'e1', 'a:x'))).toMatchObject({ value: { applied: true } });
    expect(t.apply(cb('PAID', 'e1', 'a:PAID'))).toMatchObject({ value: { applied: true } });
  });
  it('a PAID or FAILED after RETURNED contradicts the first final state; the same one is a replay', () => {
    const t = new PayoutTracker();
    t.register('p');
    t.apply(cb('FAILED'));
    t.apply(cb('RETURNED'));
    expect(t.apply(cb('FAILED', 'again'))).toMatchObject({ kind: 'OK', replayed: true });
    expect(t.apply(cb('PAID', 'late'))).toMatchObject({ code: 'CONFLICT' });
    expect(t.arrived('p')).toBe(false);
  });
});
