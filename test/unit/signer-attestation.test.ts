/**
 * U9 monitor attestation protocol (RUBRIC MC-25(a), ADR-008 "Attestation
 * protocol", ADR-001 item 5) and the signed configuration (MC-25(c)).
 */
import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemorySignerLedger, MockSigner } from '../../src/signer/index.js';
import type { MonitorAttestation, SecurityConfig, SignRequest, SignedConfig, TreasuryConfig } from '../../src/signer/index.js';
import { A_ATTEST, CAPS, T0, attestationFor, p256, request, signP1363, signedSecurity, signedTreasury, world } from './signer-fixtures.js';
import type { World } from './signer-fixtures.js';

const k1Spki = (): string => generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');

async function outcome(w: World, req?: SignRequest, signer = w.signer): Promise<string> {
  const r = await signer.sign(req ?? request(w, 'PAYOUT', `i-${w.log.length}-${w.seq}`, { nonce: BigInt(w.log.length) }));
  return r.kind === 'REFUSED' ? r.reason : 'SIGNED';
}

describe('MC-25(a): sign only under a fresh, in-sequence ALL_CLEAR from the monitor key', () => {
  it('no ALL_CLEAR → refused', async () => {
    const w = await world({ allClear: false });
    expect(await outcome(w)).toBe('NO_ALL_CLEAR');
  });

  it('a fresh, in-sequence ALL_CLEAR with no later PAUSE → signed', async () => {
    const w = await world({ allClear: false });
    expect(w.attest('ALL_CLEAR')).toBe('ACCEPTED');
    expect(await outcome(w)).toBe('SIGNED');
  });

  it('an ALL_CLEAR exactly A_attest old still signs; 1 ms older → refused', async () => {
    const w = await world();
    w.clock.now = T0 + A_ATTEST;
    expect(await outcome(w)).toBe('SIGNED');
    w.clock.now = T0 + A_ATTEST + 1n;
    expect(await outcome(w)).toBe('NO_ALL_CLEAR');
  });

  it('a stale ALL_CLEAR (older than A_attest when it arrives) is ignored', async () => {
    const w = await world({ allClear: false });
    expect(w.attest('ALL_CLEAR', { issuedAtMs: T0 - A_ATTEST - 1n })).toBe('IGNORED_STALE');
    expect(await outcome(w)).toBe('NO_ALL_CLEAR');
    expect(w.attest('ALL_CLEAR', { issuedAtMs: T0 - A_ATTEST })).toBe('ACCEPTED');
    expect(await outcome(w)).toBe('SIGNED');
  });

  it('a future-dated attestation is ignored (it could otherwise outlive A_attest)', async () => {
    const w = await world({ allClear: false });
    expect(w.attest('ALL_CLEAR', { issuedAtMs: T0 + 1n })).toBe('IGNORED_FUTURE');
    expect(await outcome(w)).toBe('NO_ALL_CLEAR');
  });

  it('if the signer clock moves back before the held ALL_CLEAR, signing stops', async () => {
    const w = await world();
    w.clock.now = T0 - 1n;
    expect(await outcome(w)).toBe('NO_ALL_CLEAR');
    w.clock.now = T0;
    expect(await outcome(w)).toBe('SIGNED');
  });

  it('an attestation whose sequence is ≤ the highest seen is ignored (no replay)', async () => {
    const w = await world({ allClear: false });
    expect(w.attest('ALL_CLEAR', { sequence: 5n })).toBe('ACCEPTED');
    const pauseAgain = attestationFor(w.monitor, 'PAUSE', 5n, T0);
    expect(w.signer.acceptAttestation(pauseAgain)).toBe('IGNORED_OUT_OF_SEQUENCE');
    expect(w.signer.acceptAttestation(attestationFor(w.monitor, 'PAUSE', 4n, T0))).toBe('IGNORED_OUT_OF_SEQUENCE');
    expect(await outcome(w)).toBe('SIGNED');
    // replaying the old ALL_CLEAR after it went stale does not refresh it
    w.clock.now = T0 + A_ATTEST + 1n;
    expect(w.signer.acceptAttestation(attestationFor(w.monitor, 'ALL_CLEAR', 5n, T0 + A_ATTEST + 1n))).toBe('IGNORED_OUT_OF_SEQUENCE');
    expect(await outcome(w)).toBe('NO_ALL_CLEAR');
    expect(w.signer.acceptAttestation(attestationFor(w.monitor, 'ALL_CLEAR', 6n, T0 + A_ATTEST + 1n))).toBe('ACCEPTED');
    expect(await outcome(w)).toBe('SIGNED');
  });

  it('sequence 0 is a valid first sequence', async () => {
    const w = await world({ allClear: false });
    expect(w.attest('ALL_CLEAR', { sequence: 0n })).toBe('ACCEPTED');
    expect(await outcome(w)).toBe('SIGNED');
  });

  it('an attestation not signed by the monitor key in the loaded configuration is ignored', async () => {
    const w = await world({ allClear: false });
    expect(w.attest('ALL_CLEAR', { key: p256() })).toBe('IGNORED_BAD_SIGNATURE');
    expect(w.attest('ALL_CLEAR', { key: w.securityOwner })).toBe('IGNORED_BAD_SIGNATURE');
    expect(await outcome(w)).toBe('NO_ALL_CLEAR');
  });

  it('a signature over different fields does not verify (kind, sequence and time are all bound)', async () => {
    const w = await world({ allClear: false });
    const pause = attestationFor(w.monitor, 'PAUSE', 7n, T0);
    expect(w.signer.acceptAttestation({ ...pause, kind: 'ALL_CLEAR' })).toBe('IGNORED_BAD_SIGNATURE');
    expect(w.signer.acceptAttestation({ ...attestationFor(w.monitor, 'ALL_CLEAR', 7n, T0), sequence: 8n })).toBe('IGNORED_BAD_SIGNATURE');
    expect(w.signer.acceptAttestation({ ...attestationFor(w.monitor, 'ALL_CLEAR', 9n, T0 - 10n), issuedAtMs: T0 })).toBe('IGNORED_BAD_SIGNATURE');
    expect(await outcome(w)).toBe('NO_ALL_CLEAR');
  });

  it.each<[string, unknown]>([
    ['unknown kind', { kind: 'RESUME', sequence: 1n, issuedAtMs: T0, signature: `0x${'00'.repeat(64)}` }],
    ['sequence as a number', { kind: 'ALL_CLEAR', sequence: 1, issuedAtMs: T0, signature: `0x${'00'.repeat(64)}` }],
    ['negative sequence', { kind: 'ALL_CLEAR', sequence: -1n, issuedAtMs: T0, signature: `0x${'00'.repeat(64)}` }],
    ['issuedAtMs as a number', { kind: 'ALL_CLEAR', sequence: 1n, issuedAtMs: 1, signature: `0x${'00'.repeat(64)}` }],
    ['null', null],
  ])('a malformed attestation (%s) is ignored', async (_l, a) => {
    const w = await world({ allClear: false });
    expect(w.signer.acceptAttestation(a as MonitorAttestation)).toBe('IGNORED_MALFORMED');
  });

  it.each([
    ['DER instead of P1363', (s: string) => `0x3045${s.slice(2, 138)}`],
    ['no 0x prefix', (s: string) => s.slice(2)],
    ['one byte short', (s: string) => s.slice(0, -2)],
    ['all zeros', () => `0x${'00'.repeat(64)}`],
  ])('a badly encoded attestation signature (%s) is ignored', async (_l, mangle) => {
    const w = await world({ allClear: false });
    const a = attestationFor(w.monitor, 'ALL_CLEAR', 1n, T0);
    expect(w.signer.acceptAttestation({ ...a, signature: mangle(a.signature) as `0x${string}` })).toBe('IGNORED_BAD_SIGNATURE');
  });

  it('a fresh PAUSE while an unexpired ALL_CLEAR is held → refused, and stays refused after the PAUSE is old', async () => {
    const w = await world();
    expect(await outcome(w)).toBe('SIGNED');
    expect(w.attest('PAUSE')).toBe('ACCEPTED');
    expect(await outcome(w)).toBe('MONITOR_PAUSE');
    w.clock.now = T0 + 10n * A_ATTEST;
    expect(await outcome(w)).toBe('MONITOR_PAUSE');
  });

  it('only a later ALL_CLEAR (higher sequence, after the two-person unpause at the monitor) resumes signing', async () => {
    const w = await world();
    expect(w.attest('PAUSE')).toBe('ACCEPTED');
    expect(w.signer.acceptAttestation(attestationFor(w.monitor, 'ALL_CLEAR', 1n, T0))).toBe('IGNORED_OUT_OF_SEQUENCE');
    expect(await outcome(w)).toBe('MONITOR_PAUSE');
    expect(w.attest('ALL_CLEAR')).toBe('ACCEPTED');
    expect(await outcome(w)).toBe('SIGNED');
  });

  it('PAUSE is checked before anything about the request (even a malformed request gets MONITOR_PAUSE)', async () => {
    const w = await world();
    w.attest('PAUSE');
    expect(await w.signer.sign(null as never)).toEqual({ kind: 'REFUSED', reason: 'MONITOR_PAUSE' });
  });

  it('an attestation that arrives before any configuration is loaded is ignored', async () => {
    const w = await world();
    const fresh = new MockSigner({
      trust: { securityOwnerKeySpki: w.securityOwner.spki, treasuryOwnerKeySpki: w.treasuryOwner.spki, pinnedSecurityVersion: 'sec-v1', pinnedTreasuryVersion: 'tre-v1' },
      ledger: new InMemorySignerLedger(),
      signingLog: { append: () => undefined },
      clock: () => w.clock.now,
    });
    expect(fresh.acceptAttestation(attestationFor(w.monitor, 'ALL_CLEAR', 1n, T0))).toBe('IGNORED_NO_CONFIG');
    expect(fresh.configReport()).toBeNull();
    expect(await fresh.sign(request(w, 'PAYOUT', 'x'))).toEqual({ kind: 'REFUSED', reason: 'CONFIG_UNSIGNED' });
  });
});

describe('MC-25(c): signed configuration, pinned versions, hash report', () => {
  async function fresh(w: World): Promise<{ s: MockSigner; hot: `0x${string}` }> {
    const s = new MockSigner({
      trust: { securityOwnerKeySpki: w.securityOwner.spki, treasuryOwnerKeySpki: w.treasuryOwner.spki, pinnedSecurityVersion: 'sec-v1', pinnedTreasuryVersion: 'tre-v1' },
      ledger: new InMemorySignerLedger(),
      signingLog: { append: () => undefined },
      clock: () => w.clock.now,
    });
    return { s, hot: await s.deriveAddress('hot', 0n) };
  }

  function treasuryBody(w: World, hot: `0x${string}`): TreasuryConfig {
    return { ...w.treasury.body, treasuryList: [hot, w.treasuryWallet] };
  }

  async function loads(w: World, sec: unknown, tre: unknown): Promise<{ load: string; sign: string; report: unknown }> {
    const { s, hot } = await fresh(w);
    const load = s.loadConfig(sec as SignedConfig<SecurityConfig>, (typeof tre === 'function' ? tre(hot) : tre) as SignedConfig<TreasuryConfig>);
    s.acceptAttestation(attestationFor(w.monitor, 'ALL_CLEAR', 1n, w.clock.now));
    const r = await s.sign(request(w, 'PAYOUT', 'cfg', { from: hot }));
    return { load: load.kind, sign: r.kind === 'REFUSED' ? r.reason : 'SIGNED', report: s.configReport() };
  }

  it('control: both sections signed by their owners at the pinned versions load, and their hashes are reported', async () => {
    const w = await world();
    const out = await loads(w, w.security, (hot: `0x${string}`) => signedTreasury(w.treasuryOwner, 'tre-v1', treasuryBody(w, hot)));
    expect(out.load).toBe('LOADED');
    expect(out.sign).toBe('SIGNED');
    expect(out.report).toEqual({
      securityVersion: 'sec-v1',
      securityHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      treasuryVersion: 'tre-v1',
      treasuryHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('the reported hash is SHA-256 of the signed configuration message and changes with any field', async () => {
    const w = await world();
    const { createHash } = await import('node:crypto');
    const { configMessage } = await import('../../src/signer/index.js');
    const report = w.signer.configReport()!;
    expect(report.securityHash).toBe(createHash('sha256').update(configMessage('security', 'sec-v1', w.security.body)).digest('hex'));
    expect(report.treasuryHash).toBe(createHash('sha256').update(configMessage('treasury', 'tre-v1', w.treasury.body)).digest('hex'));
    const t2 = signedTreasury(w.treasuryOwner, 'tre-v1', { ...w.treasury.body, dailyCapWei: (CAPS.dailyCapWei + 1n) as typeof CAPS.dailyCapWei });
    const r2 = w.signer.loadConfig(w.security, t2);
    expect(r2.kind === 'LOADED' && r2.treasuryHash).not.toBe(report.treasuryHash);
  });

  it.each<[string, (w: World) => SignedConfig<SecurityConfig> | unknown]>([
    ['unsigned (no signature)', (w) => ({ ...w.security, signature: undefined })],
    ['signed by the Treasury key instead of Security', (w) => signedSecurity(w.treasuryOwner, 'sec-v1', w.security.body)],
    ['signed by an unknown key', (w) => signedSecurity(p256(), 'sec-v1', w.security.body)],
    ['a version that does not match the pin', (w) => signedSecurity(w.securityOwner, 'sec-v2', w.security.body)],
    ['a body altered after signing (monitor key swapped)', (w) => ({ ...w.security, body: { ...w.security.body, monitorPublicKeySpki: p256().spki } })],
    ['a body altered after signing (A_attest raised)', (w) => ({ ...w.security, body: { ...w.security.body, attestationMaxAgeMs: 3_600_000n } })],
    ['a body altered after signing (checker key swapped)', (w) => ({ ...w.security, body: { ...w.security.body, checkers: [{ ...w.security.body.checkers[0]!, publicKeySpki: p256().spki }] } })],
    ['the version altered after signing', (w) => ({ ...w.security, version: 'sec-v1 ' })],
    ['a monitor key that is not P-256', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, monitorPublicKeySpki: 'AAAA' })],
    ['a checker key that is not a key', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, checkers: [{ ...w.security.body.checkers[0]!, publicKeySpki: 'AAAA' }] })],
    ['a checker credential ID that is not base64url', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, checkers: [{ ...w.security.body.checkers[0]!, credentialId: 'a+b/' }] })],
    ['a checker credential ID that is non-canonical base64url', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, checkers: [{ ...w.security.body.checkers[0]!, credentialId: 'AB' }] })],
    ['a monitor key that is not base64url', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, monitorPublicKeySpki: 'a+b/' })],
    ['a monitor key on secp256k1 instead of P-256', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, monitorPublicKeySpki: k1Spki() })],
    ['a checker key on secp256k1 instead of P-256', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, checkers: [{ ...w.security.body.checkers[0]!, publicKeySpki: k1Spki() }] })],
    ['no checkers', (w) => ({ ...w.security, body: { ...w.security.body, checkers: undefined } })],
    ['an empty checker ID', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, checkers: [{ ...w.security.body.checkers[0]!, checkerId: '' }] })],
    ['an empty RP ID', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, checkers: [{ ...w.security.body.checkers[0]!, rpId: '' }] })],
    ['an empty origin', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, checkers: [{ ...w.security.body.checkers[0]!, origin: '' }] })],
    ['a duplicate checker ID', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, checkers: [w.security.body.checkers[0]!, w.security.body.checkers[0]!] })],
    ['A_attest as a number', (w) => signedSecurity(w.securityOwner, 'sec-v1', { ...w.security.body, attestationMaxAgeMs: 60000 as never })],
    ['checkers not a list', (w) => ({ ...w.security, body: { ...w.security.body, checkers: { 0: w.security.body.checkers[0] } } })],
    ['a checker entry that is not an object', (w) => ({ ...w.security, body: { ...w.security.body, checkers: ['checker-1'] } })],
    ['no body', (w) => ({ ...w.security, body: undefined })],
    ['not an object', () => 'security'],
  ])('a security section %s → CONFIG_UNSIGNED, nothing signs', async (_l, make) => {
    const w = await world();
    const out = await loads(w, make(w), (hot: `0x${string}`) => signedTreasury(w.treasuryOwner, 'tre-v1', treasuryBody(w, hot)));
    expect(out).toEqual({ load: 'REFUSED', sign: 'CONFIG_UNSIGNED', report: null });
  });

  it.each<[string, (w: World, hot: `0x${string}`) => unknown]>([
    ['unsigned (no signature)', (w, hot) => ({ ...signedTreasury(w.treasuryOwner, 'tre-v1', treasuryBody(w, hot)), signature: undefined })],
    ['signed by the Security key instead of Treasury', (w, hot) => signedTreasury(w.securityOwner, 'tre-v1', treasuryBody(w, hot))],
    ['a version that does not match the pin', (w, hot) => signedTreasury(w.treasuryOwner, 'tre-v0', treasuryBody(w, hot))],
    ['a cap raised after signing', (w, hot) => ({ ...signedTreasury(w.treasuryOwner, 'tre-v1', treasuryBody(w, hot)), body: { ...treasuryBody(w, hot), perTxCapWei: CAPS.perTxCapWei * 10n } })],
    ['the threshold raised after signing', (w, hot) => ({ ...signedTreasury(w.treasuryOwner, 'tre-v1', treasuryBody(w, hot)), body: { ...treasuryBody(w, hot), moveApprovalThresholdWei: CAPS.perMoveCapWei } })],
    ['a fee ceiling raised after signing', (w, hot) => ({ ...signedTreasury(w.treasuryOwner, 'tre-v1', treasuryBody(w, hot)), body: { ...treasuryBody(w, hot), maxPriorityFeePerGasCeilingWei: CAPS.maxPriorityFeePerGasCeilingWei + 1n } })],
    ["an address added to Treasury's list after signing", (w, hot) => ({ ...signedTreasury(w.treasuryOwner, 'tre-v1', treasuryBody(w, hot)), body: { ...treasuryBody(w, hot), treasuryList: [...treasuryBody(w, hot).treasuryList, `0x${'ee'.repeat(20)}`] } })],
    ['a negative cap', (w, hot) => signedTreasury(w.treasuryOwner, 'tre-v1', { ...treasuryBody(w, hot), dailyCapWei: -1n as never })],
    ['a cap as a number', (w, hot) => signedTreasury(w.treasuryOwner, 'tre-v1', { ...treasuryBody(w, hot), worstCaseFeeCeilingWei: 1 as never })],
    ['a missing cap', (w, hot) => {
      const { dailyMoveCapWei: _d, ...rest } = treasuryBody(w, hot);
      return { version: 'tre-v1', body: rest, signature: `0x${'00'.repeat(64)}` };
    }],
    ["the zero address on Treasury's list", (w, hot) => signedTreasury(w.treasuryOwner, 'tre-v1', { ...treasuryBody(w, hot), treasuryList: [hot, '0x0000000000000000000000000000000000000000'] })],
    ["a malformed address on Treasury's list", (w, hot) => signedTreasury(w.treasuryOwner, 'tre-v1', { ...treasuryBody(w, hot), treasuryList: [hot, '0x1234'] })],
    ["Treasury's list not a list", (w, hot) => ({ ...signedTreasury(w.treasuryOwner, 'tre-v1', treasuryBody(w, hot)), body: { ...treasuryBody(w, hot), treasuryList: hot } })],
    ['no body', () => ({ version: 'tre-v1', signature: `0x${'00'.repeat(64)}` })],
    ['null', () => null],
  ])('a treasury section %s → CONFIG_UNSIGNED, nothing signs', async (_l, make) => {
    const w = await world();
    const out = await loads(w, w.security, (hot: `0x${string}`) => make(w, hot));
    expect(out).toEqual({ load: 'REFUSED', sign: 'CONFIG_UNSIGNED', report: null });
  });

  it('a failed reload unloads the previous configuration and the held ALL_CLEAR (fail closed)', async () => {
    const w = await world();
    expect(await outcome(w)).toBe('SIGNED');
    expect(w.signer.loadConfig(w.security, { ...w.treasury, version: 'tre-v9' }).kind).toBe('REFUSED');
    expect(w.signer.configReport()).toBeNull();
    expect(await outcome(w)).toBe('CONFIG_UNSIGNED');
    expect(w.attest('ALL_CLEAR')).toBe('IGNORED_NO_CONFIG');
    expect(w.signer.loadConfig(w.security, w.treasury).kind).toBe('LOADED');
    expect(await outcome(w)).toBe('NO_ALL_CLEAR'); // a valid reload needs a new ALL_CLEAR
    expect(w.attest('ALL_CLEAR')).toBe('ACCEPTED');
    expect(await outcome(w)).toBe('SIGNED');
  });

  it("the loaded configuration is the signer's own copy: mutating the caller's objects changes nothing", async () => {
    const w = await world();
    const body = { ...w.treasury.body, treasuryList: [...w.treasury.body.treasuryList] } as { -readonly [K in keyof TreasuryConfig]: TreasuryConfig[K] } & { treasuryList: `0x${string}`[] };
    const sig = signP1363(w.treasuryOwner, (await import('../../src/signer/index.js')).configMessage('treasury', 'tre-v1', body));
    expect(w.signer.loadConfig(w.security, { version: 'tre-v1', body, signature: sig }).kind).toBe('LOADED');
    w.attest('ALL_CLEAR');
    body.perTxCapWei = (CAPS.perTxCapWei * 100n) as typeof body.perTxCapWei;
    body.treasuryList.push(`0x${'ab'.repeat(20)}`);
    expect(await outcome(w, request(w, 'PAYOUT', 'big', { value: CAPS.perTxCapWei * 2n }))).toBe('PER_TX_CAP');
    const t = { ...request(w, 'INTERNAL_MOVE', 'mv', { to: `0x${'ab'.repeat(20)}`, value: 1n }), approval: null };
    expect(await outcome(w, t)).toBe('MOVE_NOT_ON_TREASURY_LIST');
  });

  it('a configuration message cannot be confused across sections (a Security signature over the same bytes is not a Treasury one)', async () => {
    const w = await world();
    const anchors = { securityOwnerKeySpki: w.securityOwner.spki, treasuryOwnerKeySpki: w.securityOwner.spki, pinnedSecurityVersion: 'v', pinnedTreasuryVersion: 'v' };
    const s = new MockSigner({ trust: anchors, ledger: new InMemorySignerLedger(), signingLog: { append: () => undefined }, clock: () => w.clock.now });
    const sec = signedSecurity(w.securityOwner, 'v', w.security.body);
    const tre = signedTreasury(w.securityOwner, 'v', w.treasury.body);
    expect(s.loadConfig(sec, tre).kind).toBe('LOADED');
    // A security signature replayed as the treasury signature fails.
    expect(s.loadConfig(sec, { ...tre, signature: sec.signature }).kind).toBe('REFUSED');
  });
});
