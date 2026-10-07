/** JPAYIN unit: FIAT pay-in (delta D-3). Throwaway keys only; nothing leaves the process. */
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cbsMinor } from '../../src/amounts/index.js';
import { FiatPayIn, PayIn, settlementDigest, unconfiguredVerifier } from '../../src/journey/payin/index.js';
import type { FiatExpectation, PayInEventVerifier } from '../../src/journey/payin/index.js';
import { Ed25519Verifier, HmacVerifier, LogEntries, MapEntries } from '../../src/journey/payin/fakes.js';
import { makeRig } from './ops-support.js';
import type { Variant } from './ops-support.js';
import { CLIENT, PAY, USDC, ZAR, SETTLE, SUSPENSE } from './ops-support.js';

const EXPIRY = 1_000_000n;
const cfg = { fiatAsset: ZAR, usdcAsset: USDC, refundDebit: SUSPENSE, refundCredit: SETTLE };
const exp = (over: Partial<FiatExpectation> = {}): FiatExpectation => ({
  method: 'FIAT',
  paymentId: PAY,
  clientUid: CLIENT,
  expectedPayInId: 'pi-1',
  expected: cbsMinor(50_000n),
  quoteExpiresAtMs: EXPIRY,
  settlementConsentRef: 'consent-1',
  settlementInstructionsRef: 'instr-1',
  ...over,
});
const body = (o: Record<string, string> = {}): string =>
  JSON.stringify({ expectedPayInId: 'pi-1', bookedEntryRef: 'entry-1', confirmedAmount: '50000', bookedBy: 'staff-a', reviewer: 'staff-b', confirmedAt: '500000', ...o });

interface Signer {
  verifier: PayInEventVerifier;
  headers(raw: string): Record<string, string>;
}
function signers(): Record<string, Signer> {
  const hmac = new HmacVerifier(randomBytes(32));
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const ed = new Ed25519Verifier();
  ed.trust('k1', publicKey.export({ type: 'spki', format: 'pem' }).toString());
  return {
    hmac: { verifier: hmac, headers: (raw) => ({ 'x-payin-signature': hmac.sign(raw) }) },
    ed25519: { verifier: ed, headers: (raw) => ({ 'x-payin-key-id': 'k1', 'x-payin-sig': sign(null, Buffer.from(raw), privateKey).toString('base64') }) },
  };
}

function rig(variant: Variant, s: Signer) {
  const r = makeRig(variant);
  const entries = variant === 'A' ? new MapEntries() : new LogEntries();
  entries.book('entry-1', { balanced: true, clientUid: CLIENT, amount: 50_000n });
  const pay = new FiatPayIn({ verifier: s.verifier, entries, consent: r.deps.consent, ops: r.queue, config: cfg });
  const grant = (ref = 'consent-1', e = exp()): void => r.consentStore.grant(ref, { clientUid: CLIENT, paymentId: PAY, caseId: null, digest: settlementDigest(e) });
  const send = (o: Record<string, string> = {}) => {
    const raw = body(o);
    return pay.ingest(raw, s.headers(raw));
  };
  return { ...r, entries, pay, grant, send };
}

for (const [name, s] of Object.entries(signers())) {
  for (const v of ['A', 'B'] as const) {
    describe(`FIAT pay-in (${name} verifier, rig ${v})`, () => {
      it('confirms a signed, reviewed, balanced entry equal to expected, consuming consent once', async () => {
        const t = rig(v, s);
        t.grant();
        expect(t.send().kind).toBe('ACCEPTED');
        const r = await t.pay.settle(exp(), 600_000n);
        expect(r).toMatchObject({ kind: 'CONFIRMED', amount: 50_000n, evidenceRef: 'entry-1', consentRef: 'consent-1' });
        expect(await t.pay.settle(exp(), 600_000n)).toEqual(r); // idempotent, no second consent consume
      });

      it('rejects an invalid signature and stores nothing', async () => {
        const t = rig(v, s);
        const raw = body();
        expect(t.pay.ingest(raw, { 'x-payin-signature': 'ab'.repeat(32), 'x-payin-sig': 'AAAA', 'x-payin-key-id': 'k1' })).toEqual({ kind: 'REJECTED', code: 'AUTHENTICITY_FAILED' });
        expect(t.pay.ingest(raw + ' ', s.headers(raw))).toEqual({ kind: 'REJECTED', code: 'AUTHENTICITY_FAILED' }); // tampered body
        expect(await t.pay.settle(exp(), 1n)).toEqual({ kind: 'PENDING' });
      });

      it('treats a duplicate event as a no-op', async () => {
        const t = rig(v, s);
        t.send();
        expect(t.send().kind).toBe('DUPLICATE');
      });

      it('a second distinct confirmation is SIGNAL_CONFLICT: quarantine, nothing moves', async () => {
        const t = rig(v, s);
        t.grant();
        t.send();
        expect(t.send({ bookedEntryRef: 'entry-2' }).kind).toBe('CONFLICT');
        const r = await t.pay.settle(exp(), 600_000n);
        expect(r).toMatchObject({ kind: 'HELD', reason: 'SIGNAL_CONFLICT', caseKind: 'QUARANTINE' });
        expect((await t.queue.listOpen()).kind).toBe('OK');
      });

      it('refuses reviewer == bookedBy', async () => {
        const t = rig(v, s);
        expect(t.send({ reviewer: 'Staff-A ' .trim() })).toEqual({ kind: 'REJECTED', code: 'SAME_PERSON' });
        expect(await t.pay.settle(exp(), 1n)).toEqual({ kind: 'PENDING' });
      });

      it('refuses a malformed body (float, negative, missing field)', async () => {
        const t = rig(v, s);
        for (const o of [{ confirmedAmount: '500.00' }, { confirmedAmount: '-5' }, { confirmedAmount: '0' }, { reviewer: '' }]) {
          expect(t.send(o)).toEqual({ kind: 'REJECTED', code: 'MALFORMED' });
        }
      });

      it('amount below / above expected opens UNDERPAYMENT / OVERPAYMENT and does not consume consent', async () => {
        for (const [amt, kind, reason] of [['40000', 'UNDERPAYMENT', 'CONFIRMED_BELOW_EXPECTED'], ['60000', 'OVERPAYMENT', 'CONFIRMED_ABOVE_EXPECTED']] as const) {
          const t = rig(v, s);
          t.entries.book('entry-1', { balanced: true, clientUid: CLIENT, amount: BigInt(amt) });
          t.grant();
          t.send({ confirmedAmount: amt });
          const r = await t.pay.settle(exp(), 600_000n);
          expect(r).toMatchObject({ kind: 'HELD', reason, caseKind: kind, caseCode: 'OK' });
          // consent still unused: a later exact-match flow could still use it
          expect(await t.deps.consent.consume('consent-1', { clientUid: CLIENT, paymentId: PAY, caseId: null, digest: settlementDigest(exp()) })).toMatchObject({ kind: 'OK' });
        }
      });

      it('mismatched booked entry (unbalanced, other client, other amount, missing) is quarantined', async () => {
        const bad = [{ balanced: false, clientUid: CLIENT, amount: 50_000n }, { balanced: true, clientUid: 'other', amount: 50_000n }, { balanced: true, clientUid: CLIENT, amount: 49_999n }];
        for (const e of bad) {
          const t = rig(v, s);
          t.entries.book('entry-1', e);
          t.grant();
          t.send();
          expect(await t.pay.settle(exp(), 600_000n)).toMatchObject({ kind: 'HELD', reason: 'BOOKED_ENTRY_MISMATCH', caseKind: 'QUARANTINE' });
        }
        const t = rig(v, s);
        t.send({ bookedEntryRef: 'ghost' });
        expect(await t.pay.settle(exp(), 600_000n)).toMatchObject({ kind: 'HELD', reason: 'BOOKED_ENTRY_MISMATCH' });
      });

      it('consent missing / other client / used / other option: hold and open a case, nothing confirmed', async () => {
        const t = rig(v, s);
        t.send();
        expect(await t.pay.settle(exp({ settlementConsentRef: null }), 600_000n)).toMatchObject({ kind: 'HELD', reason: 'CONSENT_MISSING' });
        expect(await t.pay.settle(exp({ settlementConsentRef: 'nope' }), 600_000n)).toMatchObject({ kind: 'HELD', reason: 'CONSENT_MISSING' });
      });

      it('consent bound to another client, another option, or already used is refused', async () => {
        const mk = () => {
          const t = rig(v, s);
          t.send();
          return t;
        };
        let t = mk();
        t.consentStore.grant('c-other', { clientUid: 'someone-else', paymentId: PAY, caseId: null, digest: settlementDigest(exp()) });
        expect(await t.pay.settle(exp({ settlementConsentRef: 'c-other' }), 600_000n)).toMatchObject({ reason: 'CONSENT_MISSING' });
        t = mk();
        t.consentStore.grant('c-opt', { clientUid: CLIENT, paymentId: PAY, caseId: null, digest: settlementDigest(exp({ expected: cbsMinor(49_000n) })) });
        expect(await t.pay.settle(exp({ settlementConsentRef: 'c-opt' }), 600_000n)).toMatchObject({ reason: 'CONSENT_MISSING' });
        t = mk();
        t.grant();
        await t.deps.consent.consume('consent-1', { clientUid: CLIENT, paymentId: PAY, caseId: null, digest: settlementDigest(exp()) });
        expect(await t.pay.settle(exp(), 600_000n)).toMatchObject({ reason: 'CONSENT_MISSING' });
      });

      it('late confirmation opens LATE_PAYIN; no pay-in by expiry is EXPIRED; before expiry is PENDING', async () => {
        const t = rig(v, s);
        expect(await t.pay.settle(exp(), EXPIRY)).toEqual({ kind: 'PENDING' });
        expect(await t.pay.settle(exp(), EXPIRY + 1n)).toEqual({ kind: 'EXPIRED' });
        t.grant();
        t.send({ confirmedAt: String(EXPIRY + 5n) });
        expect(await t.pay.settle(exp(), EXPIRY + 10n)).toMatchObject({ kind: 'HELD', reason: 'PAYIN_AFTER_QUOTE_EXPIRY', caseKind: 'LATE_PAYIN' });
      });
    });
  }
}

describe('FIAT pay-in fail closed', () => {
  it('an unconfigured verifier accepts nothing (DQ-1 open)', () => {
    const r = makeRig('A');
    const pay = new FiatPayIn({ verifier: unconfiguredVerifier, entries: new MapEntries(), consent: r.deps.consent, ops: r.queue, config: cfg });
    expect(pay.ingest(body(), { 'x-payin-signature': 'x' })).toEqual({ kind: 'REJECTED', code: 'AUTHENTICITY_FAILED' });
  });
  it('unset refund accounts fail at construction', () => {
    const r = makeRig('A');
    expect(() => new FiatPayIn({ verifier: unconfiguredVerifier, entries: null, consent: r.deps.consent, ops: r.queue, config: { ...cfg, refundDebit: '' as never } })).toThrow(RangeError);
  });
  it('without a booked-entry reader a confirmed event does not settle', async () => {
    const r = makeRig('A');
    const h = new HmacVerifier(randomBytes(32));
    const pay = new FiatPayIn({ verifier: h, entries: null, consent: r.deps.consent, ops: r.queue, config: cfg });
    const raw = body();
    pay.ingest(raw, { 'x-payin-signature': h.sign(raw) });
    expect(await pay.settle(exp(), 600_000n)).toMatchObject({ kind: 'FAILED_CLOSED', code: 'NOT_CONFIGURED' });
  });
  it('the router fails closed for an unregistered method and a malformed expectation', async () => {
    const router = new PayIn([]);
    expect(await router.settle(exp(), 1n)).toMatchObject({ kind: 'FAILED_CLOSED', code: 'METHOD_UNSUPPORTED' });
    expect(await router.settle(exp({ expected: 0n as never }), 1n)).toMatchObject({ kind: 'FAILED_CLOSED', code: 'EXPECTATION_INVALID' });
  });
});
