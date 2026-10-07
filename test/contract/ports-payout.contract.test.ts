/**
 * PORTS unit: PayoutPartnerPort contract suite (docs/NOVA_ARC_DESIGN.md §4.1,
 * §7.5, §7.8, §10.3). The receiver may pick a fiat bank account; the partner
 * pays it out after it is funded on Arc. Runs unchanged against both fakes.
 * Every callback is authenticity-checked with a secret generated at test time.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cbsMinor } from '../../src/amounts/index.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { AsyncCallbackPayout, FAKE_SIGNATURE_HEADER, ImmediatePayout, signFakeCallback } from '../../src/nova-ports/fakes/payout-fakes.js';
import { beneficiaryRef, fiatCode, idempotencyKey } from '../../src/nova-ports/ids.js';
import type { Hex32, PortResult } from '../../src/nova-ports/ids.js';
import { payoutDedupeKey } from '../../src/nova-ports/payout.js';
import type { PayoutPartnerPort, PayoutRequest } from '../../src/nova-ports/payout.js';

interface Fundable extends PayoutPartnerPort {
  markFunded(txHash: Hex32): void;
}
const SECRET = randomBytes(32);
const ben = beneficiaryRef('ben-bank-1');
type Factory = (faults?: FaultPlan) => Fundable;
const FACTORIES: readonly (readonly [string, Factory])[] = [
  ['ImmediatePayout', (faults) => new ImmediatePayout({ secret: SECRET, beneficiaries: [ben], ...(faults ? { faults } : {}) })],
  ['AsyncCallbackPayout', (faults) => new AsyncCallbackPayout({ secret: SECRET, beneficiaries: [ben], ...(faults ? { faults } : {}) })],
];

const TX: Hex32 = `0x${'7a'.repeat(32)}`;
const request = (over: Partial<PayoutRequest> = {}): PayoutRequest => ({ beneficiaryRef: ben, currency: fiatCode('ZAR'), amount: cbsMinor(185_000n), funding: { network: 'ARC', txHash: TX }, ...over });
const K = idempotencyKey('pay:x:payout');

function okValue<T>(r: PortResult<T, string>, replayed = false): T {
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${r.kind} ${r.kind === 'REJECTED' ? r.code : r.cause}`);
  expect(r.replayed).toBe(replayed);
  return r.value;
}

describe.each(FACTORIES)('PayoutPartnerPort contract: %s', (_name, make) => {
  it('pays only a known beneficiary, only once the Arc funding is confirmed; a key replays', async () => {
    const p = make();
    expect(await p.createPayout(K, request())).toMatchObject({ kind: 'REJECTED', code: 'NOT_FUNDED', detail: TX });
    expect(await p.createPayout(K, request({ beneficiaryRef: beneficiaryRef('ben-x') }))).toMatchObject({ kind: 'REJECTED', code: 'BENEFICIARY_INVALID' });
    p.markFunded(TX);
    const { payoutId } = okValue(await p.createPayout(K, request()));
    expect(await p.createPayout(K, request())).toEqual({ kind: 'OK', value: { payoutId }, replayed: true });
    expect(await p.createPayout(K, request({ amount: cbsMinor(185_001n) }))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    await expect(p.createPayout(idempotencyKey('pay:y:payout'), request({ amount: cbsMinor(0n) }))).rejects.toThrow(/> 0/);
    expect(['PENDING', 'PAID']).toContain(okValue(await p.getPayout(payoutId)).state);
    expect(await p.getPayout('nope')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
  });

  it('a callback signed with our secret verifies and dedupes on payout:<id>:<state> (§10.3)', async () => {
    const p = make();
    p.markFunded(TX);
    const { payoutId } = okValue(await p.createPayout(K, request()));
    const cb = signFakeCallback(SECRET, { payoutId, state: 'PAID', reason: null });
    expect(p.verifyCallback(cb.rawBody, cb.headers)).toEqual({ kind: 'OK', value: { dedupeKey: payoutDedupeKey(payoutId, 'PAID') }, replayed: false });
    expect(payoutDedupeKey(payoutId, 'PAID')).toBe(`payout:${payoutId}:PAID`);
  });

  it('forged, tampered, malformed or unknown callbacks are BAD_SIGNATURE (fail closed)', async () => {
    const p = make();
    p.markFunded(TX);
    const { payoutId } = okValue(await p.createPayout(K, request()));
    const good = signFakeCallback(SECRET, { payoutId, state: 'PAID', reason: null });
    const forged = signFakeCallback(randomBytes(32), { payoutId, state: 'PAID', reason: null });
    const bad = (raw: Uint8Array, headers: Readonly<Record<string, string>>, why: RegExp): void => {
      expect(p.verifyCallback(raw, headers)).toMatchObject({ kind: 'REJECTED', code: 'BAD_SIGNATURE', detail: expect.stringMatching(why) });
    };
    bad(forged.rawBody, forged.headers, /HMAC mismatch/);
    bad(good.rawBody, {}, /missing or malformed/);
    bad(good.rawBody, { [FAKE_SIGNATURE_HEADER]: 'sha256=xyz' }, /missing or malformed/);
    const tampered = new Uint8Array(good.rawBody);
    tampered[tampered.length - 2] = 0x20;
    bad(tampered, good.headers, /HMAC mismatch/);
    const notJson = new TextEncoder().encode('not json');
    bad(notJson, signFakeCallback(SECRET, { payoutId, state: 'PAID', reason: null }).headers, /HMAC mismatch/);
    /** Signs arbitrary raw text with our secret (the helper only signs well-formed bodies). */
    const signRaw = (raw: string): { rawBody: Uint8Array; headers: Readonly<Record<string, string>> } => {
      const rawBody = new TextEncoder().encode(raw);
      return { rawBody, headers: { [FAKE_SIGNATURE_HEADER]: `sha256=${createHmac('sha256', SECRET).update(rawBody).digest('hex')}` } };
    };
    const nj = signRaw('not json');
    bad(nj.rawBody, nj.headers, /not JSON/);
    for (const shape of ['{"payoutId":1,"state":"PAID","reason":null}', `{"payoutId":"${payoutId}","state":"LOST","reason":null}`, `{"payoutId":"${payoutId}","state":"PAID","reason":5}`]) {
      const s = signRaw(shape);
      bad(s.rawBody, s.headers, /not a payout callback/);
    }
    const unknown = signFakeCallback(SECRET, { payoutId: 'ghost', state: 'PAID', reason: null });
    bad(unknown.rawBody, unknown.headers, /unknown payout/);
  });

  it('AMBIGUOUS before and after commit on createPayout, and before a read', async () => {
    const f = new FaultPlan();
    const p = make(f);
    p.markFunded(TX);
    f.arm('createPayout', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await p.createPayout(K, request())).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    f.arm('createPayout', 'AFTER_COMMIT', 'TIMEOUT');
    expect(await p.createPayout(K, request())).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    const { payoutId } = okValue(await p.createPayout(K, request()), true);
    f.arm('getPayout', 'BEFORE_COMMIT', 'UNAVAILABLE');
    expect(await p.getPayout(payoutId)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
  });
});

describe('fake-specific behaviour', () => {
  it('ImmediatePayout: PAID on the first poll; a PENDING callback after that is STALE', async () => {
    const p = new ImmediatePayout({ secret: SECRET, beneficiaries: [ben] });
    p.markFunded(TX);
    const { payoutId } = okValue(await p.createPayout(K, request()));
    expect(okValue(await p.getPayout(payoutId))).toEqual({ state: 'PAID', reason: null });
    const late = signFakeCallback(SECRET, { payoutId, state: 'PENDING', reason: null });
    expect(p.verifyCallback(late.rawBody, late.headers)).toMatchObject({ kind: 'REJECTED', code: 'STALE', detail: 'PENDING after PAID' });
  });

  it('AsyncCallbackPayout: PENDING until a verified callback is injected; a forged one changes nothing', async () => {
    const p = new AsyncCallbackPayout({ secret: SECRET, beneficiaries: [ben] });
    p.markFunded(TX);
    const { payoutId } = okValue(await p.createPayout(K, request()));
    expect(okValue(await p.getPayout(payoutId))).toEqual({ state: 'PENDING', reason: null });
    const forged = signFakeCallback(randomBytes(32), { payoutId, state: 'PAID', reason: null });
    expect(p.inject(forged.rawBody, forged.headers)).toMatchObject({ kind: 'REJECTED', code: 'BAD_SIGNATURE' });
    expect(okValue(await p.getPayout(payoutId)).state).toBe('PENDING');
    const failed = signFakeCallback(SECRET, { payoutId, state: 'FAILED', reason: 'account closed' });
    expect(p.inject(failed.rawBody, failed.headers)).toEqual({ kind: 'OK', value: { dedupeKey: `payout:${payoutId}:FAILED` }, replayed: false });
    expect(okValue(await p.getPayout(payoutId))).toEqual({ state: 'FAILED', reason: 'account closed' });
    const late = signFakeCallback(SECRET, { payoutId, state: 'PENDING', reason: null });
    expect(p.inject(late.rawBody, late.headers)).toMatchObject({ kind: 'REJECTED', code: 'STALE' });
    const ghost = signFakeCallback(SECRET, { payoutId: 'ghost', state: 'PAID', reason: null });
    expect(p.inject(ghost.rawBody, ghost.headers)).toMatchObject({ kind: 'REJECTED', code: 'BAD_SIGNATURE', detail: 'unknown payout ghost' });
    expect(p.verifyCallback(late.rawBody, late.headers)).toMatchObject({ kind: 'REJECTED', code: 'STALE' });
  });
});
