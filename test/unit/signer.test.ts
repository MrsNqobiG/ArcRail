/**
 * U9 MockSigner: signing output, signing log, address derivation, key hygiene,
 * the in-memory ledger. Refusal fixtures live in signer-*.test.ts.
 */
import { createHash, generateKeyPairSync } from 'node:crypto';
import { inspect } from 'node:util';
import { keccak256, parseTransaction, recoverTransactionAddress, serializeTransaction } from 'viem';
import { describe, expect, it } from 'vitest';
import { InMemorySignerLedger, MockSigner, attestationMessage, configMessage, payloadDigest } from '../../src/signer/index.js';
import type { SignResult } from '../../src/signer/index.js';
import { CAPS, GWEI, USDC, W, attestationFor, digestOf, p256, request, signedTreasury, tx, world } from './signer-fixtures.js';

function signed(r: SignResult): { rawTx: `0x${string}`; txHash: `0x${string}` } {
  if (r.kind !== 'SIGNED') throw new Error(`expected SIGNED, got ${r.reason}`);
  return r;
}

describe('U9 MockSigner signs exactly the EIP-1559 value send it was given', () => {
  it('a valid payout is signed by the sender key, type 2, chain 5042002, empty data, and the hash is keccak256 of the raw bytes', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'ins-1', { nonce: 7n, value: 123_456_789n, maxFeePerGas: 41n * GWEI, maxPriorityFeePerGas: 2n * GWEI, gasLimit: 21_000n });
    const out = signed(await w.signer.sign(req));
    expect(out.txHash).toBe(keccak256(out.rawTx));
    expect(out.rawTx.startsWith('0x02')).toBe(true);
    const p = parseTransaction(out.rawTx);
    expect(p.type).toBe('eip1559');
    expect(p.chainId).toBe(5042002);
    expect(p.nonce).toBe(7);
    expect(p.to).toBe(req.tx.to.toLowerCase());
    expect(p.value).toBe(123_456_789n);
    expect(p.gas).toBe(21_000n);
    expect(p.maxFeePerGas).toBe(41n * GWEI);
    expect(p.maxPriorityFeePerGas).toBe(2n * GWEI);
    expect(p.data).toBeUndefined();
    expect(p.accessList ?? []).toEqual([]);
    expect(p.authorizationList).toBeUndefined();
    const from = await recoverTransactionAddress({ serializedTransaction: out.rawTx as Parameters<typeof recoverTransactionAddress>[0]['serializedTransaction'] });
    expect(from).toBe(w.hot);
    // Re-serialising the parsed fields with viem reproduces the exact bytes (canonical RLP, minimal integers).
    const { r, s, yParity } = p;
    const again = serializeTransaction(
      { type: 'eip1559', chainId: p.chainId!, nonce: p.nonce!, to: p.to!, value: p.value!, gas: p.gas!, maxFeePerGas: p.maxFeePerGas!, maxPriorityFeePerGas: p.maxPriorityFeePerGas! },
      { r: r!, s: s!, yParity: yParity! },
    );
    expect(again).toBe(out.rawTx);
  });

  it('zero value, zero nonce and zero priority fee encode as empty RLP integers (round trip through viem)', async () => {
    const w = await world();
    const t = tx(w, { to: w.treasuryWallet, value: 0n, nonce: 0n, maxPriorityFeePerGas: 0n });
    const out = signed(await w.signer.sign({ kind: 'INTERNAL_MOVE', instructionId: 'mv-0', tx: t, approval: null }));
    const p = parseTransaction(out.rawTx);
    expect(p.nonce).toBe(0);
    expect(p.value ?? 0n).toBe(0n);
    expect(p.maxPriorityFeePerGas ?? 0n).toBe(0n);
    expect(await recoverTransactionAddress({ serializedTransaction: out.rawTx as never })).toBe(w.hot);
  });

  it('values with an odd number of hex digits and both signature parities round-trip', async () => {
    const w = await world();
    const parities = new Set<number>();
    for (let i = 0n; i < 12n; i++) {
      const req = request(w, 'PAYOUT', `odd-${i}`, { nonce: i, value: 0xabcn + i, gasLimit: 0x5208n });
      const out = signed(await w.signer.sign(req));
      const p = parseTransaction(out.rawTx);
      expect(p.value).toBe(0xabcn + i);
      parities.add(p.yParity!);
      expect(await recoverTransactionAddress({ serializedTransaction: out.rawTx as never })).toBe(w.hot);
    }
    expect([...parities].sort()).toEqual([0, 1]);
  });

  it('writes one signing-log entry (payloadHash, nonce, txHash, instructionId) per signature, to the injected sink', async () => {
    const w = await world();
    const req = request(w, 'CASE_RETURN', 'ret-9', { nonce: 3n });
    const out = signed(await w.signer.sign(req));
    expect(w.log).toEqual([{ payloadHash: digestOf(req.tx, 'ret-9').toString('hex'), nonce: 3n, txHash: out.txHash, instructionId: 'ret-9' }]);
  });

  it('a refused request writes no log entry', async () => {
    const w = await world();
    const req = request(w, 'PAYOUT', 'p', { value: CAPS.perTxCapWei * 2n });
    expect(await w.signer.sign(req)).toEqual({ kind: 'REFUSED', reason: 'PER_TX_CAP' });
    expect(w.log).toEqual([]);
  });

  it('if the signing log cannot be written, no signature is released (sign rejects)', async () => {
    const w = await world();
    const s = new MockSigner({
      trust: { securityOwnerKeySpki: w.securityOwner.spki, treasuryOwnerKeySpki: w.treasuryOwner.spki, pinnedSecurityVersion: 'sec-v1', pinnedTreasuryVersion: 'tre-v1' },
      ledger: new InMemorySignerLedger(),
      signingLog: {
        append: () => {
          throw new Error('monitor channel down');
        },
      },
      clock: () => w.clock.now,
    });
    const hot = await s.deriveAddress('hot', 0n);
    const t2 = signedTreasury(w.treasuryOwner, 'tre-v1', { ...w.treasury.body, treasuryList: [hot] });
    expect(s.loadConfig(w.security, t2).kind).toBe('LOADED');
    expect(s.acceptAttestation(attestationFor(w.monitor, 'ALL_CLEAR', 1n, w.clock.now))).toBe('ACCEPTED');
    await expect(s.sign(request(w, 'PAYOUT', 'p', { from: hot }))).rejects.toThrow('monitor channel down');
  });
});

describe('U9 payloadDigest and canonical messages', () => {
  it('payloadDigest is SHA-256 of the RFC 8785 encoding of the CONTRACT §1.3 object (recomputed by hand)', () => {
    const jcs = '{"amountWei":"1000000000000","asset":"USDC","chainId":"5042002","destination":"0xabcdef0123456789abcdef0123456789abcdef01","instructionId":"ins-\\"q\\"\\u0001"}';
    const expected = createHash('sha256').update(jcs, 'utf8').digest('hex');
    const got = payloadDigest({ amountWei: 1_000_000_000_000n, destination: '0xABCDEF0123456789ABCDEF0123456789ABCDEF01', instructionId: 'ins-"q"\u0001' });
    expect(got.toString('hex')).toBe(expected);
    expect(got.length).toBe(32);
  });

  it('attestation and configuration messages are fixed JSON arrays of strings', () => {
    expect(attestationMessage({ kind: 'PAUSE', sequence: 12n, issuedAtMs: 34n }).toString('utf8')).toBe('["arc1-monitor-attestation","5042002","PAUSE","12","34"]');
    expect(
      configMessage('security', 'v', {
        checkers: [{ checkerId: 'c', credentialId: 'AA', publicKeySpki: 'BB', rpId: 'r', origin: 'o' }],
        monitorPublicKeySpki: 'MM',
        attestationMaxAgeMs: 60_000n,
      }).toString('utf8'),
    ).toBe('["arc1-signer-config","security","v",[["c","AA","BB","r","o"]],"MM","60000"]');
    expect(
      configMessage('treasury', 'v', { treasuryList: ['0xAbCdEf0123456789aBcDeF0123456789ABCDEF01'], ...CAPS, perTxCapWei: W(1n) }).toString('utf8'),
    ).toBe(
      `["arc1-signer-config","treasury","v",["0xabcdef0123456789abcdef0123456789abcdef01"],"1","${CAPS.dailyCapWei}","${CAPS.perMoveCapWei}","${CAPS.dailyMoveCapWei}","${CAPS.moveApprovalThresholdWei}","${CAPS.maxPriorityFeePerGasCeilingWei}","${CAPS.worstCaseFeeCeilingWei}"]`,
    );
  });
});

describe('U9 deriveAddress', () => {
  it('derives distinct, stable addresses per role and index, and never returns key material', async () => {
    const w = await world();
    const a = await w.signer.deriveAddress('hot', 0n);
    expect(a).toBe(w.hot);
    expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
    const all = new Set([a, await w.signer.deriveAddress('hot', 1n), await w.signer.deriveAddress('gas', 0n), await w.signer.deriveAddress('collection', 0n)]);
    expect(all.size).toBe(4);
    expect(await w.signer.deriveAddress('collection', 0n)).toBe(await w.signer.deriveAddress('collection', 0n));
    expect(await w.signer.deriveAddress('hot', 2_147_483_647n)).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('two signers never share a key (the seed is generated per instance)', async () => {
    const w1 = await world();
    const w2 = await world();
    expect(w1.hot).not.toBe(w2.hot);
  });

  it.each([
    ['unknown role', 'cold', 0n],
    ['inherited property name as role', 'toString', 0n],
    ['negative index', 'hot', -1n],
    ['hardened index', 'hot', 2_147_483_648n],
    ['number index', 'hot', 0],
  ])('refuses %s', async (_l, role, index) => {
    const w = await world();
    await expect(w.signer.deriveAddress(role as 'hot', index as bigint)).rejects.toThrow(RangeError);
  });

  it('the key is not reachable by enumeration, JSON or inspection', async () => {
    const w = await world();
    await w.signer.sign(request(w, 'PAYOUT', 'p'));
    expect(Object.keys(w.signer)).toEqual([]);
    expect(JSON.stringify(w.signer)).toBe('{}');
    const shown = inspect(w.signer, { showHidden: true, depth: 20 });
    expect(shown).not.toMatch(/[0-9a-f]{64}/i);
    expect(shown).not.toMatch(/privateKey|seed/i);
  });
});

describe('U9 constructor', () => {
  it.each([
    ['no options', undefined],
    ['no trust', { ledger: new InMemorySignerLedger() }],
    ['a trust anchor that is not a key', { trust: { securityOwnerKeySpki: 'nope', treasuryOwnerKeySpki: p256().spki, pinnedSecurityVersion: 'a', pinnedTreasuryVersion: 'b' } }],
    ['a second trust anchor that is not a key', { trust: { securityOwnerKeySpki: p256().spki, treasuryOwnerKeySpki: 'nope', pinnedSecurityVersion: 'a', pinnedTreasuryVersion: 'b' } }],
    ['a trust anchor on secp256k1', { trust: { securityOwnerKeySpki: generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'), treasuryOwnerKeySpki: p256().spki, pinnedSecurityVersion: 'a', pinnedTreasuryVersion: 'b' } }],
    ['an ed25519 trust anchor', { trust: { securityOwnerKeySpki: p256().spki, treasuryOwnerKeySpki: generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'), pinnedSecurityVersion: 'a', pinnedTreasuryVersion: 'b' } }],
    ['a trust anchor with padding', { trust: { securityOwnerKeySpki: `${p256().spki}=`, treasuryOwnerKeySpki: p256().spki, pinnedSecurityVersion: 'a', pinnedTreasuryVersion: 'b' } }],
  ])('throws on %s', (_l, opts) => {
    expect(() => new MockSigner(opts as never)).toThrow(TypeError);
  });
});

describe('U9 InMemorySignerLedger', () => {
  it('commits only when the transaction returns, and serialises transactions', async () => {
    const l = new InMemorySignerLedger();
    const slot = { instructionId: 'i', kind: 'PAYOUT' as const, from: '0x1', nonce: 1n, payloadHash: 'h' };
    await expect(
      l.transact((t) => {
        t.recordSlot(slot);
        t.addDebit('DAILY', 'd', 5n);
        expect(t.slotFor('i')).toEqual(slot);
        expect(t.dailyTotal('DAILY', 'd')).toBe(5n);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await l.transact((t) => [t.slotFor('i'), t.dailyTotal('DAILY', 'd')])).toEqual([undefined, 0n]);
    const order: string[] = [];
    await Promise.all([
      l.transact((t) => {
        order.push('a');
        t.addDebit('MOVE', 'd', 2n);
      }),
      l.transact((t) => {
        order.push('b');
        t.addDebit('MOVE', 'd', 3n);
        t.recordSlot(slot);
      }),
    ]);
    expect(order).toEqual(['a', 'b']);
    expect(await l.transact((t) => [t.dailyTotal('MOVE', 'd'), t.dailyTotal('DAILY', 'd'), t.dailyTotal('MOVE', 'e'), t.slotFor('i')])).toEqual([5n, 0n, 0n, slot]);
  });

  it('the daily cap holds across several signatures (sum, not max)', async () => {
    const w = await world();
    let signedCount = 0n;
    for (let i = 0n; i < 4n; i++) {
      const r = await w.signer.sign(request(w, 'PAYOUT', `s-${i}`, { nonce: i, value: 700n * USDC }));
      if (r.kind === 'SIGNED') signedCount += 1n;
      else expect(r.reason).toBe('DAILY_CAP');
    }
    expect(signedCount).toBe(3n);
  });
});
