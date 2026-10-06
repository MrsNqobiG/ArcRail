/**
 * U9 approval verification and the consumed-approval record (RUBRIC MC-24,
 * MC-25(d); ADR-001 items 1, 2 and 4; CONTRACT §1.3). The checker credential
 * is an ES256 key generated at test time; assertions are built byte for byte.
 */
import { generateKeyPairSync, randomBytes, sign as nodeSign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ApprovalEvidence, SignRequest } from '../../src/signer/index.js';
import { ORIGIN, RP_ID, approvalFor, assertion, checker, digestOf, p256, randomAddress, request, sha256, tx, world } from './signer-fixtures.js';
import type { AssertionOptions, World } from './signer-fixtures.js';

async function outcome(w: World, req: unknown, signer = w.signer): Promise<string> {
  const r = await signer.sign(req as SignRequest);
  return r.kind === 'REFUSED' ? r.reason : 'SIGNED';
}

function payoutWith(w: World, a: AssertionOptions, instructionId = 'ins-a'): SignRequest {
  const t = tx(w);
  return { kind: 'PAYOUT', instructionId, tx: t, approval: approvalFor(w, t, instructionId, a) };
}

function withApproval(req: SignRequest, change: Partial<Record<keyof ApprovalEvidence, unknown>>): SignRequest {
  return { ...req, approval: { ...(req.approval as ApprovalEvidence), ...change } as ApprovalEvidence };
}

describe('MC-24: the signer verifies checkerAssertion over the 32 raw bytes of payloadDigest itself', () => {
  it('a genuine assertion over the raw digest is accepted (control)', async () => {
    const w = await world();
    expect(await outcome(w, payoutWith(w, {}))).toBe('SIGNED');
  });

  it('a payout or case return without an approval needs a checker', async () => {
    const w = await world();
    for (const kind of ['PAYOUT', 'CASE_RETURN'] as const) {
      expect(await outcome(w, { kind, instructionId: `n-${kind}`, tx: tx(w), approval: null })).toBe('CHECKER_REQUIRED');
      const { approval: _drop, ...noField } = request(w, kind, `m-${kind}`);
      expect(await outcome(w, noField)).toBe('CHECKER_REQUIRED');
    }
  });

  it('forged approval JSON (no assertion, or a made-up one) is refused', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'forged');
    expect(await outcome(w, withApproval(req, { checkerAssertion: '{"signature":"ok","approved":true}' }))).toBe('APPROVAL_INVALID');
    expect(await outcome(w, withApproval(req, { checkerAssertion: undefined }))).toBe('APPROVAL_INVALID');
    expect(await outcome(w, withApproval(req, { checkerAssertion: 42 }))).toBe('APPROVAL_INVALID');
    expect(await outcome(w, { ...req, approval: 'APPROVED' as never })).toBe('APPROVAL_INVALID');
    expect(await outcome(w, withApproval(req, { checkerId: undefined }))).toBe('APPROVAL_INVALID');
    expect(await outcome(w, withApproval(req, { checkerId: '' }))).toBe('APPROVAL_INVALID');
    expect(await outcome(w, withApproval(req, { checkerId: 'checker-unknown' }))).toBe('APPROVAL_INVALID');
  });

  it('an assertion over the hex payloadHash text (not the raw 32 bytes) is refused', async () => {
    const w = await world();
    const t = tx(w);
    const d = digestOf(t, 'hex');
    expect(await outcome(w, payoutWith(w, { challenge: Buffer.from(d.toString('hex'), 'utf8') }, 'hex'))).toBe('APPROVAL_INVALID');
  });

  it('an assertion over a different digest (another instruction) is refused', async () => {
    const w = await world();
    expect(await outcome(w, payoutWith(w, { challenge: randomBytes(32) }))).toBe('APPROVAL_INVALID');
  });

  it.each<[string, AssertionOptions]>([
    ['signed by another key', { signWith: p256() }],
    ['clientData type webauthn.create', { type: 'webauthn.create' }],
    ['another origin', { origin: 'https://evil.example' }],
    ['another RP ID', { rpId: 'evil.example' }],
    ['user presence flag missing', { flags: 0x04 }],
    ['user verification flag missing', { flags: 0x01 }],
    ['no flags', { flags: 0x00 }],
    ['crossOrigin true', { clientDataJSON: '' }],
    ['another credential ID', { credentialId: randomBytes(16).toString('base64url') }],
    ['an unknown encoding tag', { tag: 'webauthn2' }],
    ['a signature that is not DER', { signature: randomBytes(64) }],
    ['an empty signature', { signature: Buffer.alloc(0) }],
  ])('refuses an assertion %s', async (label, a) => {
    const w = await world();
    let opts = a;
    if (label === 'crossOrigin true') {
      const t = tx(w);
      const challenge = digestOf(t, 'xo').toString('base64url');
      opts = { clientDataJSON: `{"type":"webauthn.get","challenge":"${challenge}","origin":"${ORIGIN}","crossOrigin":true}` };
      expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'xo', tx: t, approval: approvalFor(w, t, 'xo', opts) })).toBe('APPROVAL_INVALID');
      return;
    }
    expect(await outcome(w, payoutWith(w, opts))).toBe('APPROVAL_INVALID');
  });

  it.each<[string, (challenge: string) => string, string]>([
    ['WebAuthn L3 form with crossOrigin:false and more fields', (c) => `{"type":"webauthn.get","challenge":"${c}","origin":"${ORIGIN}","crossOrigin":false,"other_keys_can_be_added_here":"x"}`, 'SIGNED'],
    ['WebAuthn L2 form without crossOrigin', (c) => `{"type":"webauthn.get","challenge":"${c}","origin":"${ORIGIN}"}`, 'SIGNED'],
    ['without crossOrigin but with more fields', (c) => `{"type":"webauthn.get","challenge":"${c}","origin":"${ORIGIN}","topOrigin":"x"}`, 'SIGNED'],
    ['origin as a prefix of a longer origin', (c) => `{"type":"webauthn.get","challenge":"${c}","origin":"${ORIGIN}.evil.example"}`, 'APPROVAL_INVALID'],
    ['crossOrigin true followed by more fields', (c) => `{"type":"webauthn.get","challenge":"${c}","origin":"${ORIGIN}","crossOrigin":true,"topOrigin":"https://evil.example"}`, 'APPROVAL_INVALID'],
    ['crossOrigin false repeated as true', (c) => `{"type":"webauthn.get","challenge":"${c}","origin":"${ORIGIN}","crossOrigin":false,"crossOrigin":true}`, 'APPROVAL_INVALID'],
    ['crossOrigin false and nothing else', (c) => `{"type":"webauthn.get","challenge":"${c}","origin":"${ORIGIN}","crossOrigin":false}`, 'SIGNED'],
    ['crossOrigin false then junk', (c) => `{"type":"webauthn.get","challenge":"${c}","origin":"${ORIGIN}","crossOrigin":falsey}`, 'APPROVAL_INVALID'],
    ['fields in another order', (c) => `{"challenge":"${c}","type":"webauthn.get","origin":"${ORIGIN}"}`, 'APPROVAL_INVALID'],
    ['whitespace in the serialization', (c) => `{"type": "webauthn.get","challenge":"${c}","origin":"${ORIGIN}"}`, 'APPROVAL_INVALID'],
    ['truncated after origin', (c) => `{"type":"webauthn.get","challenge":"${c}","origin":"${ORIGIN}"`, 'APPROVAL_INVALID'],
  ])('clientDataJSON %s', async (_l, make, expected) => {
    const w = await world();
    const t = tx(w);
    const c = digestOf(t, 'cd').toString('base64url');
    expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'cd', tx: t, approval: approvalFor(w, t, 'cd', { clientDataJSON: make(c) }) })).toBe(expected);
  });

  it('authenticatorData with extension bytes after the counter is accepted; one shorter than 37 bytes is refused', async () => {
    const w = await world();
    expect(await outcome(w, payoutWith(w, { flags: 0x85, authTail: Buffer.from([0xa0]) }))).toBe('SIGNED');
    // Build a 36-byte authenticatorData by hand (rpIdHash ‖ flags ‖ 3 counter bytes), validly signed.
    const t = tx(w);
    const d = digestOf(t, 'short');
    const clientData = Buffer.from(`{"type":"webauthn.get","challenge":"${d.toString('base64url')}","origin":"${ORIGIN}","crossOrigin":false}`);
    const authData = Buffer.concat([sha256(RP_ID), Buffer.from([0x05, 0, 0, 0])]);
    const sig = nodeSign('sha256', Buffer.concat([authData, sha256(clientData)]), w.checker.key.priv);
    const a = ['webauthn1', w.checker.credentialId, authData.toString('base64url'), clientData.toString('base64url'), sig.toString('base64url')].join('.');
    const req: SignRequest = { kind: 'PAYOUT', instructionId: 'short', tx: t, approval: { approvalId: 'x', payloadHash: d.toString('hex'), checkerId: w.checker.id, checkerAssertion: a } };
    expect(await outcome(w, req)).toBe('APPROVAL_INVALID');
  });

  it.each([
    ['four parts', (s: string) => s.split('.').slice(0, 4).join('.')],
    ['six parts', (s: string) => `${s}.AA`],
    ['padded base64url in a part', (s: string) => s.split('.').map((p, i) => (i === 2 ? `${p}=` : p)).join('.')],
    ['standard base64 characters in a part', (s: string) => s.split('.').map((p, i) => (i === 3 ? `${p}+/` : p)).join('.')],
    ['an empty part', (s: string) => s.split('.').map((p, i) => (i === 4 ? '' : p)).join('.')],
    ['a non-canonical base64url tail', (s: string) => s.split('.').map((p, i) => (i === 2 ? `${p.slice(0, -1)}${p.endsWith('A') ? 'B' : 'A'}` : p)).join('.')],
  ])('a malformed assertion encoding (%s) is refused', async (_l, mangle) => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'enc');
    expect(await outcome(w, withApproval(req, { checkerAssertion: mangle(req.approval!.checkerAssertion) }))).toBe('APPROVAL_INVALID');
  });

  it('a credential registered for another checker cannot vouch for this checkerId', async () => {
    const w = await world();
    const mallory = checker('mallory');
    const t = tx(w);
    const d = digestOf(t, 'm');
    const req: SignRequest = { kind: 'PAYOUT', instructionId: 'm', tx: t, approval: { approvalId: 'x', payloadHash: d.toString('hex'), checkerId: w.checker.id, checkerAssertion: assertion(mallory, d) } };
    expect(await outcome(w, req)).toBe('APPROVAL_INVALID');
  });

  it('a non-P-256 signature key never verifies (secp256k1 key with the right credential ID)', async () => {
    const w = await world();
    const k1 = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
    const t = tx(w);
    const d = digestOf(t, 'k1');
    const a = assertion(w.checker, d, { signWith: { priv: k1.privateKey, spki: '' } });
    expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'k1', tx: t, approval: { approvalId: 'x', payloadHash: d.toString('hex'), checkerId: w.checker.id, checkerAssertion: a } })).toBe('APPROVAL_INVALID');
  });
});

describe('MC-25(d) and ADR-001 item 2: the payout is bound to the approval content', () => {
  it('a payout whose to differs from the approved destination is refused', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'bind');
    expect(await outcome(w, { ...req, tx: { ...req.tx, to: randomAddress() } })).toBe('APPROVAL_MISMATCH');
  });

  it('a payout whose value differs from the approved amount by 1 wei is refused', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'bind');
    expect(await outcome(w, { ...req, tx: { ...req.tx, value: (req.tx.value + 1n) as typeof req.tx.value } })).toBe('APPROVAL_MISMATCH');
  });

  it('a case return whose to differs from the approved destination is refused', async () => {
    const w = await world();
    const req = request(w, 'CASE_RETURN', 'ret');
    expect(await outcome(w, { ...req, tx: { ...req.tx, to: randomAddress() } })).toBe('APPROVAL_MISMATCH');
  });

  it('an approval for another instructionId is refused', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'ins-1');
    expect(await outcome(w, { ...req, instructionId: 'ins-2' })).toBe('APPROVAL_MISMATCH');
  });

  it('payloadHash must be the exact lowercase hex of the recomputed digest', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'case');
    const h = req.approval!.payloadHash;
    expect(await outcome(w, withApproval(req, { payloadHash: h.toUpperCase() }))).toBe('APPROVAL_MISMATCH');
    expect(await outcome(w, withApproval(req, { payloadHash: `0x${h}` }))).toBe('APPROVAL_MISMATCH');
    expect(await outcome(w, withApproval(req, { payloadHash: undefined }))).toBe('APPROVAL_MISMATCH');
  });

  it('a consistent payloadHash for a swapped destination still fails: the assertion covers the original digest', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'swap');
    const t = { ...req.tx, to: randomAddress() };
    const forgedHash = digestOf(t, 'swap').toString('hex');
    expect(await outcome(w, { ...req, tx: t, approval: { ...req.approval!, payloadHash: forgedHash } })).toBe('APPROVAL_INVALID');
  });
});

describe('MC-24: consumed-approval record (replay)', () => {
  it('a replayed genuine approval at a different nonce is refused', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'rp', { nonce: 1n });
    expect(await outcome(w, req)).toBe('SIGNED');
    expect(await outcome(w, { ...req, tx: { ...req.tx, nonce: 2n } })).toBe('APPROVAL_REPLAYED');
  });

  it('a replayed genuine approval from another sender at the same nonce is refused', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'rs', { nonce: 1n });
    expect(await outcome(w, req)).toBe('SIGNED');
    const other = await w.signer.deriveAddress('hot', 1n);
    expect(await outcome(w, { ...req, tx: { ...req.tx, from: other } })).toBe('APPROVAL_REPLAYED');
  });

  it('a same-nonce replacement for the same instruction (fee bump) is allowed', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'bump', { nonce: 5n });
    expect(await outcome(w, req)).toBe('SIGNED');
    expect(await outcome(w, { ...req, tx: { ...req.tx, maxFeePerGas: req.tx.maxFeePerGas + 1n, maxPriorityFeePerGas: req.tx.maxPriorityFeePerGas + 1n } as never })).toBe('SIGNED');
    expect(w.log.map((e) => e.nonce)).toEqual([5n, 5n]);
    expect(w.log[0]?.txHash).not.toBe(w.log[1]?.txHash);
  });

  it('a replayed genuine approval sent to a second signer instance (shared record) is refused at any nonce, and allowed nowhere twice', async () => {
    const w = await world();
    const { signer: second, hot: secondHot } = await w.peer();
    // The approval names a destination and amount; the second instance sends it from its own wallet.
    const t = tx(w, { from: secondHot, nonce: 0n });
    const appr = approvalFor(w, t, 'shared');
    expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'shared', tx: t, approval: appr }, second)).toBe('SIGNED');
    // Same approval, first instance, its own wallet: different sender → refused.
    expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'shared', tx: { ...t, from: w.hot }, approval: appr })).toBe('APPROVAL_REPLAYED');
    // Same approval, second instance again, different nonce → refused.
    expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'shared', tx: { ...t, nonce: 1n }, approval: appr }, second)).toBe('APPROVAL_REPLAYED');
  });

  it('after a restart the new instance refuses a replay of an approval the old instance consumed', async () => {
    const w = await world();
    const { signer: s2, hot: h2 } = await w.peer();
    const t = tx(w, { from: h2, nonce: 3n });
    const appr = approvalFor(w, t, 'restart-2');
    expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'restart-2', tx: t, approval: appr }, s2)).toBe('SIGNED');
    // "restart": a third instance over the same ledger, holding its own wallet
    const { signer: s3, hot: h3 } = await w.peer();
    expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'restart-2', tx: { ...t, from: h3, nonce: 0n }, approval: appr }, s3)).toBe('APPROVAL_REPLAYED');
  });

  it('an instruction cannot change kind on replay (a payout approval re-used as a case return)', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'kind', { nonce: 1n });
    expect(await outcome(w, req)).toBe('SIGNED');
    expect(await outcome(w, { ...req, kind: 'CASE_RETURN' })).toBe('APPROVAL_REPLAYED');
  });

  it('a second, different approval for an already-signed instruction is refused even at the same slot', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'twice', { nonce: 1n, value: 10n });
    expect(await outcome(w, req)).toBe('SIGNED');
    const t2 = { ...req.tx, value: req.tx.value + 1n } as typeof req.tx;
    expect(await outcome(w, { kind: 'PAYOUT', instructionId: 'twice', tx: t2, approval: approvalFor(w, t2, 'twice') })).toBe('APPROVAL_REPLAYED');
  });

  it('a refused signature consumes nothing: the same approval signs afterwards', async () => {
    const w = await world({ allClear: false });
    const req = request(w, 'PAYOUT', 'later', { nonce: 1n });
    expect(await outcome(w, req)).toBe('NO_ALL_CLEAR');
    w.attest('ALL_CLEAR');
    expect(await outcome(w, req)).toBe('SIGNED');
  });

  it('concurrent signatures of one approval at two nonces: exactly one is signed', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'race', { nonce: 1n });
    const results = await Promise.all([outcome(w, req), outcome(w, { ...req, tx: { ...req.tx, nonce: 2n } })]);
    expect(results.sort()).toEqual(['APPROVAL_REPLAYED', 'SIGNED']);
  });
});
