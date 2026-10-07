/** Pins what the adapters and the recipient store tell their callers, and the byte-level decoding rules. */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cbsMinor } from '../../src/amounts/index.js';
import { CpnStubPartner } from '../../src/journey/payout/partner/cpn-stub.js';
import { FAKE_SIGNATURE_HEADER, FakePartner, fakePartnerSign } from '../../src/journey/payout/partner/fake.js';
import { PayoutTracker } from '../../src/journey/payout/partner/tracker.js';
import { REDACTED, RecipientError, BankRecipientStore } from '../../src/journey/recipients/index.js';
import type { KeyManagement, RecipientRef } from '../../src/journey/recipients/index.js';
import { fiatCode, idempotencyKey, novaOwnerRef } from '../../src/nova-ports/ids.js';
import type { Hex32, NetworkId } from '../../src/nova-ports/ids.js';
import { Clock, PII, bankDetails, makeStore } from './jpartner-support.js';

const TX = ('0x' + 'ab'.repeat(32)) as Hex32;
const REF = ('rcp-' + 'a'.repeat(32)) as RecipientRef;
const req = { recipientRef: REF, currency: fiatCode('ZAR'), amount: cbsMinor(5n), funding: { network: 'ARC' as unknown as NetworkId, txHash: TX } };
const recipients = { country: 'ZA', currency: fiatCode('ZAR') };
const gate = { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: false, testnetDemo: false };
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const k = idempotencyKey('k:1');

function detailOf(r: { kind: string; detail?: string }): string {
  if (r.kind !== 'REJECTED' || r.detail === undefined) throw new Error('expected a rejection');
  return r.detail;
}

describe('rejection details are fixed, non-empty and free of input', () => {
  it('createPayout', async () => {
    const mk = (over: Partial<{ r: () => typeof recipients; f: boolean; g: typeof gate }> = {}) =>
      new FakePartner({ recipients: over.r ?? (() => recipients), gate: over.g ?? gate, isFunded: () => over.f ?? true, secret: randomBytes(16) });
    expect(detailOf(await mk().createPayout(k, { ...req, amount: cbsMinor(0n) }))).toBe('amount must be positive');
    expect(detailOf(await mk({ r: () => { throw new Error(PII.accountNumber); } }).createPayout(k, req))).toBe('recipient unknown or deleted');
    expect(detailOf(await mk().createPayout(k, { ...req, currency: fiatCode('EUR') }))).toBe('payout currency differs from the recipient account');
    expect(detailOf(await mk({ r: () => ({ country: 'US', currency: fiatCode('ZAR') }) }).createPayout(k, req))).toBe('cross-border payouts are off until a legal opinion is recorded');
    expect(detailOf(await mk({ f: false }).createPayout(k, req))).toBe('funding transfer not confirmed by our indexer');
    const p = mk();
    await p.createPayout(k, req);
    expect(detailOf(await p.createPayout(k, { ...req, amount: cbsMinor(6n) }))).toBe('key reused with another request');
  });
});

describe('FakePartner wire rules', () => {
  const secret = randomBytes(32);
  const p = new FakePartner({ recipients: () => recipients, gate, isFunded: () => true, secret });
  const call = (text: string | Uint8Array) => {
    const body = typeof text === 'string' ? enc(text) : text;
    return p.verifyCallback(body, { [FAKE_SIGNATURE_HEADER]: fakePartnerSign(secret, body) });
  };
  it('names its header', () => {
    expect(FAKE_SIGNATURE_HEADER).toBe('x-fake-partner-signature');
  });
  it('an authentic decode is not a replay', () => {
    expect(call('{"eventId":"e","payoutId":"p","state":"PAID"}')).toMatchObject({ kind: 'OK', replayed: false });
  });
  it('fixed details', () => {
    expect(detailOf(p.verifyCallback(enc('{}'), {}))).toBe('signature missing or malformed');
    expect(detailOf(p.verifyCallback(enc('{}'), { [FAKE_SIGNATURE_HEADER]: fakePartnerSign(randomBytes(32), enc('{}')) }))).toBe('signature mismatch');
    expect(detailOf(call('[]'))).toBe('body is not a JSON object');
    expect(detailOf(call('{"eventId":"e","payoutId":"p","state":"X"}'))).toBe('unknown state');
    expect(detailOf(call('{"eventId":"e","payoutId":"p"}'))).toBe('callback fields missing or invalid');
    expect(() => new FakePartner({ recipients: () => recipients, gate, isFunded: () => true, secret: randomBytes(3) })).toThrow('secret too short');
  });
  it('invalid UTF-8 anywhere in an authentic body is malformed, never repaired', () => {
    const head = enc('{"eventId":"e","payoutId":"p","state":"FAILED","reason":"');
    const tail = enc('"}');
    const body = Uint8Array.from([...head, 0xff, ...tail]);
    expect(call(body)).toMatchObject({ kind: 'REJECTED', code: 'MALFORMED' });
  });
  it('ids are 1 to 128 visible ASCII characters, anchored', () => {
    const bad = [' e', 'e ', 'e e', 'é', '', 'e'.repeat(129), 'e\n'];
    for (const v of bad) {
      expect(call(JSON.stringify({ eventId: v, payoutId: 'p', state: 'PAID' }))).toMatchObject({ code: 'MALFORMED' });
      expect(call(JSON.stringify({ eventId: 'e', payoutId: v, state: 'PAID' }))).toMatchObject({ code: 'MALFORMED' });
    }
    for (const v of ['e', '~', '!', 'e'.repeat(128)]) {
      expect(call(JSON.stringify({ eventId: v, payoutId: v, state: 'PAID' }))).toMatchObject({ kind: 'OK' });
    }
  });
  it('a secret of exactly 16 bytes is enough', () => {
    expect(() => new FakePartner({ recipients: () => recipients, gate, isFunded: () => true, secret: randomBytes(16) })).not.toThrow();
  });
});

describe('CpnStubPartner wire rules', () => {
  const p = new CpnStubPartner({ recipients: () => recipients, gate, isFunded: () => true, verifySignature: () => true, refundPaymentId: (n) => { const v = n.get('paymentId'); return typeof v === 'string' ? v : null; } });
  const env = (type: string, notification: object, id: string = 'n-1') => enc(JSON.stringify({ notificationId: id, notificationType: type, notification }));
  it('an authentic decode is not a replay, for payments and for refunds', () => {
    expect(p.verifyCallback(env('cpn.payment.completed', { id: 'p', status: 'COMPLETED' }), {})).toMatchObject({ kind: 'OK', replayed: false });
    expect(p.verifyCallback(env('cpn.refund.completed', { paymentId: 'p' }), {})).toMatchObject({ kind: 'OK', replayed: false });
  });
  it('fixed details', () => {
    const bad = new CpnStubPartner({ recipients: () => recipients, gate, isFunded: () => true, verifySignature: () => false });
    expect(detailOf(bad.verifyCallback(enc('{}'), {}))).toBe('callback signature not valid');
    expect(detailOf(p.verifyCallback(enc('[]'), {}))).toBe('body is not a JSON object');
    expect(detailOf(p.verifyCallback(env('cpn.refund.completed', {}), {}))).toBe('refund names no payment');
    expect(detailOf(p.verifyCallback(env('cpn.rfi.approved', {}), {}))).toBe('not a payout-state event');
    expect(detailOf(p.verifyCallback(env('cpn.payment.completed', { id: 'p', status: 'FAILED' }), {}))).toBe('event type and payment status disagree');
    expect(detailOf(p.verifyCallback(enc('{"notificationType":"x"}'), {}))).toBe('callback fields missing or invalid');
  });
  it('ids are visible ASCII, anchored, 1 to 128 characters', () => {
    for (const v of [' e', 'e ', 'é', '', 'e'.repeat(129)]) {
      expect(p.verifyCallback(env('cpn.payment.completed', { id: v, status: 'COMPLETED' }), {})).toMatchObject({ code: 'MALFORMED' });
      expect(p.verifyCallback(env('cpn.payment.completed', { id: 'p', status: 'COMPLETED' }, v), {})).toMatchObject({ code: 'MALFORMED' });
      expect(p.verifyCallback(env('cpn.refund.completed', { paymentId: v }), {})).toMatchObject({ code: 'MALFORMED' });
    }
    expect(p.verifyCallback(env('cpn.payment.completed', { id: 'e'.repeat(128), status: 'COMPLETED' }, '~!'), {})).toMatchObject({ kind: 'OK' });
  });
  it('invalid UTF-8 in an authentic body is malformed', () => {
    const body = Uint8Array.from([...enc('{"notificationId":"n","notificationType":"cpn.rfi.approved","notification":{"x":"'), 0xff, ...enc('"}}')]);
    expect(p.verifyCallback(body, {})).toMatchObject({ code: 'MALFORMED' });
  });
  it('a refund extractor that throws fails closed', () => {
    const q = new CpnStubPartner({ recipients: () => recipients, gate, isFunded: () => true, verifySignature: () => true, refundPaymentId: () => { throw new Error('x'); } });
    expect(q.verifyCallback(env('cpn.refund.completed', { paymentId: 'p' }), {})).toMatchObject({ code: 'MALFORMED' });
  });
});

describe('PayoutTracker details', () => {
  it('fixed details and event-id dedupe on a stale callback', () => {
    const t = new PayoutTracker();
    t.register('p');
    const cb = (state: 'PENDING' | 'PAID' | 'FAILED' | 'RETURNED', eventId: string) => ({ eventId, payoutId: 'p', state, reason: null });
    expect(detailOf(t.apply({ ...cb('PAID', 'a'), payoutId: 'ghost' }))).toBe('no such payout');
    expect(detailOf(t.apply(cb('RETURNED', 'r')))).toBe('refund outcome before a final state');
    t.apply(cb('PAID', 'a'));
    t.apply(cb('RETURNED', 'b'));
    // two stale callbacks sharing one event id: the second is a replay by event id, not by state
    expect(t.apply(cb('PENDING', 'z'))).toMatchObject({ kind: 'OK', replayed: false });
    expect(t.apply(cb('FAILED', 'z'))).toMatchObject({ kind: 'OK', replayed: true });
    const c = new PayoutTracker();
    c.register('p');
    c.apply(cb('PAID', 'a'));
    expect(detailOf(c.apply(cb('FAILED', 'f')))).toBe('partner reported a conflicting final state');
    expect(detailOf(c.apply(cb('FAILED', 'f')))).toBe('payout is quarantined for Ops');
  });
});

describe('BankRecipient details', () => {
  it('fixed error messages and the redaction marker', () => {
    expect(REDACTED).toBe('[REDACTED]');
    const m = (c: ConstructorParameters<typeof RecipientError>[0]) => new RecipientError(c).message;
    expect(m('INVALID_DETAILS')).toBe('recipient details rejected');
    expect(m('INVALID_REF')).toBe('recipient ref is not valid');
    expect(m('NOT_FOUND')).toBe('recipient not found');
    expect(m('RETENTION_EXPIRED')).toBe('recipient data past its retention and deleted');
    expect(m('KEY_MANAGEMENT_FAILED')).toBe('key management failed');
    expect(m('CORRUPT_RECORD')).toBe('recipient record could not be decoded');
    expect(() => new BankRecipientStore({ keys: {} as KeyManagement, clock: () => 0n, retentionMs: 0n })).toThrow('retentionMs must be > 0');
  });
  it('a stored record with invalid UTF-8 inside a field is corrupt, never repaired', async () => {
    const bytes = Uint8Array.from([...enc('{"holderName":"'), 0xff, ...enc('","accountNumber":"1","branchCode":"2","bankName":"b","country":"ZA","currency":"ZAR"}')]);
    const kms: KeyManagement = { encrypt: async () => Uint8Array.from([1]), decrypt: async () => bytes };
    const { store } = makeStore(1000n, new Clock(1n), kms);
    const ref = await store.create(novaOwnerRef('o'), bankDetails());
    await expect(store.reveal(ref)).rejects.toMatchObject({ code: 'CORRUPT_RECORD' });
  });
});
