/**
 * U9 test fixtures. Every key here is generated at test time, in memory, and
 * thrown away (CLAUDE.md rule 2). Nothing is signed for or sent to any network:
 * MockSigner signs locally and the tests only parse and recover the bytes.
 */
import { createHash, generateKeyPairSync, randomBytes, sign as nodeSign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { nativeWei } from '../../src/amounts/index.js';
import type { NativeWei } from '../../src/amounts/index.js';
import type { Address } from '../../src/chain/config/index.js';
import {
  InMemorySignerLedger,
  MockSigner,
  attestationMessage,
  configMessage,
  payloadDigest,
} from '../../src/signer/index.js';
import type {
  ApprovalEvidence,
  Eip1559ValueSend,
  MonitorAttestation,
  SecurityConfig,
  SignKind,
  SignRequest,
  SignedConfig,
  SigningLogEntry,
  SignerLedger,
  TreasuryConfig,
} from '../../src/signer/index.js';

export interface P256 {
  readonly priv: KeyObject;
  readonly spki: string;
}

export function p256(): P256 {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return { priv: privateKey, spki: publicKey.export({ type: 'spki', format: 'der' }).toString('base64url') };
}

export function signP1363(key: P256, message: Buffer): `0x${string}` {
  return `0x${nodeSign('sha256', message, { key: key.priv, dsaEncoding: 'ieee-p1363' }).toString('hex')}`;
}

export function randomAddress(): Address {
  return `0x${randomBytes(20).toString('hex')}`;
}

export const sha256 = (b: Buffer | string): Buffer => createHash('sha256').update(b).digest();

export const W = (x: bigint): NativeWei => nativeWei(x);

export const RP_ID = 'bank.example';
export const ORIGIN = 'https://approvals.bank.example';
export const T0 = 1_760_000_000_000n; // a fixed test epoch (ms)
export const A_ATTEST = 60_000n;
export const GWEI = 1_000_000_000n;
/** One USDC in native wei (18 dp, C-10). */
export const USDC = 1_000_000_000_000_000_000n;

export interface Checker {
  readonly id: string;
  readonly key: P256;
  readonly credentialId: string;
}

export function checker(id = 'checker-1'): Checker {
  return { id, key: p256(), credentialId: randomBytes(16).toString('base64url') };
}

export interface AssertionOptions {
  readonly challenge?: Buffer;
  readonly type?: string;
  readonly origin?: string;
  readonly rpId?: string;
  readonly flags?: number;
  readonly clientDataJSON?: string;
  readonly credentialId?: string;
  readonly tag?: string;
  readonly signWith?: P256;
  readonly authTail?: Buffer;
  readonly signature?: Buffer;
}

/** Build a WebAuthn ES256 assertion the way an authenticator and browser would (WebAuthn L3 serialization). */
export function assertion(c: Checker, digest: Buffer, o: AssertionOptions = {}): string {
  const challenge = (o.challenge ?? digest).toString('base64url');
  const clientDataJSON =
    o.clientDataJSON ??
    `{"type":${JSON.stringify(o.type ?? 'webauthn.get')},"challenge":${JSON.stringify(challenge)},"origin":${JSON.stringify(o.origin ?? ORIGIN)},"crossOrigin":false}`;
  const clientData = Buffer.from(clientDataJSON, 'utf8');
  const authData = Buffer.concat([
    sha256(o.rpId ?? RP_ID),
    Buffer.from([o.flags ?? 0x05]),
    Buffer.from([0, 0, 0, 7]),
    o.authTail ?? Buffer.alloc(0),
  ]);
  const sig = o.signature ?? nodeSign('sha256', Buffer.concat([authData, sha256(clientData)]), (o.signWith ?? c.key).priv);
  return [o.tag ?? 'webauthn1', o.credentialId ?? c.credentialId, authData.toString('base64url'), clientData.toString('base64url'), sig.toString('base64url')].join('.');
}

export interface World {
  readonly signer: MockSigner;
  readonly ledger: SignerLedger;
  readonly log: SigningLogEntry[];
  readonly clock: { now: bigint };
  readonly securityOwner: P256;
  readonly treasuryOwner: P256;
  readonly monitor: P256;
  readonly checker: Checker;
  readonly hot: Address;
  readonly treasuryWallet: Address;
  readonly security: SignedConfig<SecurityConfig>;
  readonly treasury: SignedConfig<TreasuryConfig>;
  seq: bigint;
  /** Issue and deliver an attestation signed by the monitor. */
  attest(kind?: 'ALL_CLEAR' | 'PAUSE', o?: { sequence?: bigint; issuedAtMs?: bigint; key?: P256 }): ReturnType<MockSigner['acceptAttestation']>;
  /** A fresh signer instance sharing this world's ledger, trust anchors and configuration. */
  peer(): Promise<{ signer: MockSigner; hot: Address }>;
}

export const CAPS = {
  perTxCapWei: W(1_000n * USDC),
  dailyCapWei: W(2_500n * USDC),
  perMoveCapWei: W(800n * USDC),
  dailyMoveCapWei: W(1_500n * USDC),
  moveApprovalThresholdWei: W(100n * USDC),
  maxPriorityFeePerGasCeilingWei: W(5n * GWEI),
  worstCaseFeeCeilingWei: W(21_000n * 100n * GWEI),
};

export function signedSecurity(owner: P256, version: string, body: SecurityConfig): SignedConfig<SecurityConfig> {
  return { version, body, signature: signP1363(owner, configMessage('security', version, body)) };
}

export function signedTreasury(owner: P256, version: string, body: TreasuryConfig): SignedConfig<TreasuryConfig> {
  return { version, body, signature: signP1363(owner, configMessage('treasury', version, body)) };
}

export function attestationFor(monitor: P256, kind: 'ALL_CLEAR' | 'PAUSE', sequence: bigint, issuedAtMs: bigint): MonitorAttestation {
  return { kind, sequence, issuedAtMs, signature: signP1363(monitor, attestationMessage({ kind, sequence, issuedAtMs })) };
}

export interface WorldOptions {
  readonly caps?: Partial<typeof CAPS>;
  readonly ledger?: SignerLedger;
  readonly allClear?: boolean;
}

export async function world(o: WorldOptions = {}): Promise<World> {
  const securityOwner = p256();
  const treasuryOwner = p256();
  const monitor = p256();
  const chk = checker();
  const ledger = o.ledger ?? new InMemorySignerLedger();
  const log: SigningLogEntry[] = [];
  const clock = { now: T0 };
  const trust = {
    securityOwnerKeySpki: securityOwner.spki,
    treasuryOwnerKeySpki: treasuryOwner.spki,
    pinnedSecurityVersion: 'sec-v1',
    pinnedTreasuryVersion: 'tre-v1',
  };
  const make = (): MockSigner => new MockSigner({ trust, ledger, signingLog: { append: (e) => void log.push(e) }, clock: () => clock.now });
  const signer = make();
  const hot = await signer.deriveAddress('hot', 0n);
  const treasuryWallet = randomAddress();
  const security = signedSecurity(securityOwner, 'sec-v1', {
    checkers: [{ checkerId: chk.id, credentialId: chk.credentialId, publicKeySpki: chk.key.spki, rpId: RP_ID, origin: ORIGIN }],
    monitorPublicKeySpki: monitor.spki,
    attestationMaxAgeMs: A_ATTEST,
  });
  const extraTreasury: Address[] = [];
  const treasuryBody = (): TreasuryConfig => ({ treasuryList: [hot, treasuryWallet, ...extraTreasury], ...CAPS, ...o.caps });
  let treasury = signedTreasury(treasuryOwner, 'tre-v1', treasuryBody());
  const loaded = signer.loadConfig(security, treasury);
  if (loaded.kind !== 'LOADED') throw new Error('fixture config did not load');
  const w: World = {
    signer,
    ledger,
    log,
    clock,
    securityOwner,
    treasuryOwner,
    monitor,
    checker: chk,
    hot,
    treasuryWallet,
    security,
    get treasury() {
      return treasury;
    },
    seq: 0n,
    attest(kind = 'ALL_CLEAR', a = {}) {
      w.seq += 1n;
      return signer.acceptAttestation(attestationFor(a.key ?? monitor, kind, a.sequence ?? w.seq, a.issuedAtMs ?? clock.now));
    },
    async peer() {
      const p = make();
      const peerHot = await p.deriveAddress('hot', 0n);
      extraTreasury.push(peerHot);
      treasury = signedTreasury(treasuryOwner, 'tre-v1', treasuryBody());
      if (p.loadConfig(security, treasury).kind !== 'LOADED') throw new Error('peer config did not load');
      w.seq += 1n;
      p.acceptAttestation(attestationFor(monitor, 'ALL_CLEAR', w.seq, clock.now));
      return { signer: p, hot: peerHot };
    },
  };
  if (o.allClear !== false) w.attest('ALL_CLEAR');
  return w;
}

export interface TxOptions {
  readonly from?: Address;
  readonly to?: Address;
  readonly value?: bigint;
  readonly nonce?: bigint;
  readonly gasLimit?: bigint;
  readonly maxFeePerGas?: bigint;
  readonly maxPriorityFeePerGas?: bigint;
}

export function tx(w: World, o: TxOptions = {}): Eip1559ValueSend {
  return {
    type: 'eip1559',
    chainId: 5042002,
    nonce: o.nonce ?? 0n,
    from: o.from ?? w.hot,
    to: o.to ?? randomAddress(),
    value: W(o.value ?? 1_000n * GWEI),
    data: '0x',
    gasLimit: o.gasLimit ?? 21_000n,
    maxFeePerGas: W(o.maxFeePerGas ?? 40n * GWEI),
    maxPriorityFeePerGas: W(o.maxPriorityFeePerGas ?? 1n * GWEI),
  };
}

export function digestOf(t: Eip1559ValueSend, instructionId: string): Buffer {
  return payloadDigest({ amountWei: t.value, destination: t.to, instructionId });
}

export function approvalFor(w: World, t: Eip1559ValueSend, instructionId: string, a: AssertionOptions = {}): ApprovalEvidence {
  const d = digestOf(t, instructionId);
  return { approvalId: `appr-${instructionId}`, payloadHash: d.toString('hex'), checkerId: w.checker.id, checkerAssertion: assertion(w.checker, d, a) };
}

/** An approved request of `kind` (approval attached unless `kind` is CANCEL). */
export function request(w: World, kind: SignKind, instructionId: string, o: TxOptions = {}): SignRequest {
  const t = tx(w, o);
  return { kind, instructionId, tx: t, approval: kind === 'CANCEL' ? null : approvalFor(w, t, instructionId) };
}

/** Worst-case fee of the default fixture fees: 21,000 × 40 gwei. */
export const DEFAULT_FEE = 21_000n * 40n * GWEI;
