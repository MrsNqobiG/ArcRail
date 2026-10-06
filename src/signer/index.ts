/**
 * U9 Signer. Money path (RUBRIC item 4: every ADR-001 signer duty, the
 * signed-configuration load and the signing-log writer).
 *
 * The signer must not trust the orchestrator (THREAT_MODEL T-T1, T-E2). Every
 * request is re-validated at run time, whatever its static type says. Duties
 * (ADR-001 Context, items 1–6), each enforced in `MockSigner.sign`:
 *   1 approval verification: recompute payloadHash and verify the checker's
 *     WebAuthn (ES256) assertion over the 32 raw bytes of payloadDigest
 *     (CONTRACT §1.3) against the credential in the signer's own loaded
 *     configuration;
 *   2 shape allow-list: EIP-1559 type-2 only, chain ID 5042002 only, empty
 *     data, no other fields, `to` bound per kind (RUBRIC MC-23);
 *   3 limits: per-tx and daily caps on the total debit
 *     (value + gasLimit × maxFeePerGas), the priority-fee ceiling and the
 *     worst-case-fee ceiling;
 *   4 consumed-approval replay record, durable and shared through the injected
 *     `SignerLedger` (RUBRIC MC-24);
 *   5 monitor attestation: sign only under a fresh, in-sequence ALL_CLEAR
 *     signed by the monitor key in the loaded configuration; PAUSE overrides
 *     (ADR-008, MC-25a);
 *   6 internal-move rule: Treasury's list, per-move and daily move caps, the
 *     move-approval threshold (at or below → no checker; strictly above → checker).
 * Signed configuration (ADR-001, THREAT_MODEL T-T6): nothing is signed until
 * both configuration sections are loaded, each signed by its owner key and at
 * its pinned version; the hash of each loaded version is reported.
 * Signing log: every signature appends (payloadHash, nonce, txHash,
 * instructionId) to the injected sink (the direct channel to the monitor)
 * before the signature is released; if the append fails, `sign` rejects and
 * no signature is released.
 *
 * Integer arithmetic only (RUBRIC MC-01). No real keys anywhere in this repo
 * (CLAUDE.md rule 2): `MockSigner` generates a throwaway HD seed in memory at
 * construction; it is never persisted, returned or logged.
 */
import { createHash, createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { keccak256, toRlp } from 'viem';
import type { Hex } from 'viem';
import { HDKey, privateKeyToAddress, sign as signDigest } from 'viem/accounts';
import type { NativeWei } from '../amounts/index.js';
import type { Address, Hex32 } from '../chain/config/index.js';

export type SignKind = 'PAYOUT' | 'CASE_RETURN' | 'INTERNAL_MOVE' | 'CANCEL';

/** The only transaction shape the signer will consider (ADR-001 item 2). */
export interface Eip1559ValueSend {
  readonly type: 'eip1559';
  readonly chainId: 5042002;
  readonly nonce: bigint;
  readonly from: Address;
  readonly to: Address;
  readonly value: NativeWei;
  /** Must be empty: native value sends only. */
  readonly data: '0x';
  readonly gasLimit: bigint;
  readonly maxFeePerGas: NativeWei;
  readonly maxPriorityFeePerGas: NativeWei;
}

export interface ApprovalEvidence {
  readonly approvalId: string;
  /** Lowercase hex of payloadDigest, no `0x` (CONTRACT §1.3). */
  readonly payloadHash: string;
  readonly checkerId: string;
  /**
   * WebAuthn assertion whose challenge is the 32 raw bytes of payloadDigest (CONTRACT §1.3).
   * Encoding (this unit's choice; CONTRACT fixes none): `webauthn1.<credentialId>.<authenticatorData>.<clientDataJSON>.<signature>`,
   * each part unpadded base64url; the signature is the authenticator's DER ECDSA P-256 (ES256) signature.
   */
  readonly checkerAssertion: string;
}

export interface SignRequest {
  readonly kind: SignKind;
  readonly instructionId: string;
  readonly tx: Eip1559ValueSend;
  readonly approval: ApprovalEvidence | null;
}

export type SignRefusal =
  | 'APPROVAL_INVALID'
  | 'APPROVAL_MISMATCH'
  | 'APPROVAL_REPLAYED'
  | 'SHAPE_NOT_ALLOWED'
  | 'CHAIN_ID'
  | 'PER_TX_CAP'
  | 'DAILY_CAP'
  | 'FEE_CEILING'
  | 'MOVE_CAP'
  | 'MOVE_NOT_ON_TREASURY_LIST'
  | 'CHECKER_REQUIRED'
  | 'NO_ALL_CLEAR'
  | 'MONITOR_PAUSE'
  | 'CONFIG_UNSIGNED';

export type SignResult =
  | { readonly kind: 'SIGNED'; readonly rawTx: `0x${string}`; readonly txHash: Hex32 }
  | { readonly kind: 'REFUSED'; readonly reason: SignRefusal };

/** Signing-log entry, written by the signer itself and pushed to the monitor (ADR-001 "Signing log"). */
export interface SigningLogEntry {
  readonly payloadHash: string;
  readonly nonce: bigint;
  readonly txHash: Hex32;
  readonly instructionId: string;
}

/** The signer's direct, append-only channel to the independent monitor (ADR-001, ADR-008). */
export interface SigningLogSink {
  append(entry: SigningLogEntry): void | Promise<void>;
}

/** Monitor attestation (ADR-008). */
export interface MonitorAttestation {
  readonly kind: 'ALL_CLEAR' | 'PAUSE';
  readonly sequence: bigint;
  readonly issuedAtMs: bigint;
  /** ECDSA P-256 over SHA-256 of `attestationMessage(...)`, as `0x` + r ‖ s (64 bytes, IEEE P1363). */
  readonly signature: `0x${string}`;
}

/** What `MockSigner.acceptAttestation` did with an attestation (an ignored one changes nothing). */
export type AttestationOutcome =
  | 'ACCEPTED'
  | 'IGNORED_NO_CONFIG'
  | 'IGNORED_MALFORMED'
  | 'IGNORED_BAD_SIGNATURE'
  | 'IGNORED_STALE'
  | 'IGNORED_FUTURE'
  | 'IGNORED_OUT_OF_SEQUENCE';

/** Signer interface (KICKOFF U9). Every outbound signature goes through this. */
export interface Signer {
  acceptAttestation(attestation: MonitorAttestation): void;
  sign(request: SignRequest): Promise<SignResult>;
  /** Derive an address (ADR-006 collection branch); never exposes key material. */
  deriveAddress(role: 'hot' | 'gas' | 'collection', index: bigint): Promise<Address>;
}

// ---------------------------------------------------------------------------
// Signed configuration (ADR-001 "Signed configuration", THREAT_MODEL T-T6)
// ---------------------------------------------------------------------------

/** A checker's registered FIDO2 credential (ES256). */
export interface CheckerCredential {
  readonly checkerId: string;
  /** Unpadded base64url credential ID. */
  readonly credentialId: string;
  /** Unpadded base64url DER SubjectPublicKeyInfo of the P-256 public key. */
  readonly publicKeySpki: string;
  /** WebAuthn relying-party ID; authenticatorData's rpIdHash must be SHA-256 of it. */
  readonly rpId: string;
  /** Expected clientDataJSON origin. */
  readonly origin: string;
}

/** Owner: Security. Checkers' credentials and the monitor's attestation key. */
export interface SecurityConfig {
  readonly checkers: readonly CheckerCredential[];
  /** Unpadded base64url DER SPKI of the monitor's P-256 attestation key. */
  readonly monitorPublicKeySpki: string;
  /** `A_attest` in ms (ADR-008, proposed 60 s, Q-C17). An attestation older than this is stale. */
  readonly attestationMaxAgeMs: bigint;
}

/** Owner: Treasury, with Risk. Treasury's list, every cap and fee limit, the move-approval threshold. */
export interface TreasuryConfig {
  readonly treasuryList: readonly Address[];
  /** Per-signature cap on value + gasLimit × maxFeePerGas (payout, case return). */
  readonly perTxCapWei: NativeWei;
  /** Daily cap on the total debit of payouts, case returns and their cancels. */
  readonly dailyCapWei: NativeWei;
  /** Per-move cap on value + gasLimit × maxFeePerGas. */
  readonly perMoveCapWei: NativeWei;
  /** Daily cap on the total debit of internal moves and their cancels. */
  readonly dailyMoveCapWei: NativeWei;
  /** A move whose value is strictly above this needs a checker assertion. */
  readonly moveApprovalThresholdWei: NativeWei;
  readonly maxPriorityFeePerGasCeilingWei: NativeWei;
  /** Ceiling on gasLimit × maxFeePerGas. */
  readonly worstCaseFeeCeilingWei: NativeWei;
}

export type ConfigSection = 'security' | 'treasury';

/** A configuration section with its owner's signature (ECDSA P-256, IEEE P1363, over SHA-256 of `configMessage`). */
export interface SignedConfig<T> {
  readonly version: string;
  readonly body: T;
  readonly signature: `0x${string}`;
}

/** The signer's root of trust, fixed at deployment (never from the orchestrator). */
export interface SignerTrustAnchors {
  /** Unpadded base64url DER SPKI of Security's configuration-signing key (P-256). */
  readonly securityOwnerKeySpki: string;
  /** Unpadded base64url DER SPKI of Treasury's configuration-signing key (P-256). */
  readonly treasuryOwnerKeySpki: string;
  readonly pinnedSecurityVersion: string;
  readonly pinnedTreasuryVersion: string;
}

/** Hash of each loaded configuration version, for the owners' daily re-attestation. */
export interface ConfigReport {
  readonly securityVersion: string;
  readonly securityHash: string;
  readonly treasuryVersion: string;
  readonly treasuryHash: string;
}

export type ConfigLoadResult =
  | ({ readonly kind: 'LOADED' } & ConfigReport)
  | { readonly kind: 'REFUSED'; readonly reason: 'CONFIG_UNSIGNED' };

// ---------------------------------------------------------------------------
// Consumed-approval record and daily totals (ADR-001 items 3, 4 and 6)
// ---------------------------------------------------------------------------

/** The (sender, nonce) slot an instruction is bound to, and the payloadDigest consumed for it. */
export interface LedgerSlot {
  readonly instructionId: string;
  readonly kind: SignKind;
  readonly from: string;
  readonly nonce: bigint;
  readonly payloadHash: string;
}

export type DailyCounter = 'DAILY' | 'MOVE';

/** A view of the ledger inside one atomic transaction. */
export interface SignerLedgerTxn {
  slotFor(instructionId: string): LedgerSlot | undefined;
  dailyTotal(counter: DailyCounter, day: string): bigint;
  recordSlot(slot: LedgerSlot): void;
  addDebit(counter: DailyCounter, day: string, debit: bigint): void;
}

/**
 * Durable record shared by every signer instance (ADR-001 item 4: "durable and
 * shared across signer instances"). `transact` runs `fn` atomically: no other
 * transaction interleaves, and writes are committed only when `fn` returns.
 */
export interface SignerLedger {
  transact<T>(fn: (txn: SignerLedgerTxn) => T): Promise<T>;
}

/** In-memory `SignerLedger` (tests and the local slice). One instance shared by signers models the shared store. */
export class InMemorySignerLedger implements SignerLedger {
  readonly #slots = new Map<string, LedgerSlot>();
  readonly #totals = new Map<string, bigint>();
  #tail: Promise<unknown> = Promise.resolve();

  transact<T>(fn: (txn: SignerLedgerTxn) => T): Promise<T> {
    const run = this.#tail.then(() => {
      const slots = new Map<string, LedgerSlot>();
      const totals = new Map<string, bigint>();
      const txn: SignerLedgerTxn = {
        slotFor: (id) => slots.get(id) ?? this.#slots.get(id),
        dailyTotal: (counter, day) => totals.get(`${counter}:${day}`) ?? this.#totals.get(`${counter}:${day}`) ?? 0n,
        recordSlot: (slot) => {
          slots.set(slot.instructionId, slot);
        },
        addDebit: (counter, day, debit) => {
          totals.set(`${counter}:${day}`, txn.dailyTotal(counter, day) + debit);
        },
      };
      const out = fn(txn);
      for (const [k, v] of slots) this.#slots.set(k, v);
      for (const [k, v] of totals) this.#totals.set(k, v);
      return out;
    });
    this.#tail = run.catch(() => undefined);
    return run;
  }
}

// ---------------------------------------------------------------------------
// Canonical messages (exported so the monitor, the owners and the tests sign the same bytes)
// ---------------------------------------------------------------------------

const ARC_TESTNET_CHAIN_ID = 5042002n;
const DAY_MS = 86_400_000n;
const UINT256_MAX = (1n << 256n) - 1n;
const NONCE_MAX = (1n << 64n) - 1n;
const HD_INDEX_MAX = (1n << 31n) - 1n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const SIG_P1363_RE = /^0x[0-9a-fA-F]{128}$/;
const TX_FIELDS: ReadonlySet<string> = new Set([
  'type', 'chainId', 'nonce', 'from', 'to', 'value', 'data', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas',
]);
const KINDS: ReadonlySet<string> = new Set(['PAYOUT', 'CASE_RETURN', 'INTERNAL_MOVE', 'CANCEL']);
type Role = 'hot' | 'gas' | 'collection';
/** Mock-only HD branches (account level). The real branches are fixed at the key ceremony (ADR-006, Q-D3). */
const ROLE_BRANCH: ReadonlyMap<string, string> = new Map([['hot', "0'"], ['gas', "1'"], ['collection', "2'"]]);

/**
 * payloadDigest = SHA-256(JCS({"amountWei","asset":"USDC","chainId":"5042002","destination","instructionId"}))
 * (CONTRACT §1.3). The keys are already in JCS order and every value is a JSON string,
 * so JSON.stringify of this literal is the RFC 8785 encoding.
 */
export function payloadDigest(p: { readonly amountWei: bigint; readonly destination: string; readonly instructionId: string }): Buffer {
  const jcs = JSON.stringify({
    amountWei: p.amountWei.toString(),
    asset: 'USDC',
    chainId: ARC_TESTNET_CHAIN_ID.toString(),
    destination: p.destination.toLowerCase(),
    instructionId: p.instructionId,
  });
  return createHash('sha256').update(jcs, 'utf8').digest();
}

/** The bytes the monitor signs for an attestation. */
export function attestationMessage(a: Pick<MonitorAttestation, 'kind' | 'sequence' | 'issuedAtMs'>): Buffer {
  return Buffer.from(
    JSON.stringify(['arc1-monitor-attestation', ARC_TESTNET_CHAIN_ID.toString(), a.kind, a.sequence.toString(), a.issuedAtMs.toString()]),
    'utf8',
  );
}

/** The bytes a section's owner signs: a JSON array of strings (and arrays of strings) only. */
export function configMessage(section: 'security', version: string, body: SecurityConfig): Buffer;
export function configMessage(section: 'treasury', version: string, body: TreasuryConfig): Buffer;
export function configMessage(section: ConfigSection, version: string, body: SecurityConfig | TreasuryConfig): Buffer {
  const fields =
    section === 'security'
      ? [
          (body as SecurityConfig).checkers.map((c) => [c.checkerId, c.credentialId, c.publicKeySpki, c.rpId, c.origin]),
          (body as SecurityConfig).monitorPublicKeySpki,
          (body as SecurityConfig).attestationMaxAgeMs.toString(),
        ]
      : [
          (body as TreasuryConfig).treasuryList.map((a) => a.toLowerCase()),
          ...CAP_FIELDS.map((f) => (body as TreasuryConfig)[f].toString()),
        ];
  return Buffer.from(JSON.stringify(['arc1-signer-config', section, version, ...fields]), 'utf8');
}

const CAP_FIELDS = [
  'perTxCapWei',
  'dailyCapWei',
  'perMoveCapWei',
  'dailyMoveCapWei',
  'moveApprovalThresholdWei',
  'maxPriorityFeePerGasCeilingWei',
  'worstCaseFeeCeilingWei',
] as const;

// ---------------------------------------------------------------------------
// Validation helpers (the request is untrusted: check every field at run time)
// ---------------------------------------------------------------------------

type Loose = Readonly<Record<string, unknown>>;

// Helpers return the narrowed value or null (no type predicates: MC-01 lint).
function asObject(x: unknown): Loose | null {
  return typeof x === 'object' && x !== null ? (x as Loose) : null;
}

/** A JSON-like list. `Array.isArray` is used without narrowing, so no `any[]` appears. */
const isList: (x: unknown) => boolean = Array.isArray;

/** A non-zero 20-byte address, returned in lowercase. */
function asAddress(x: unknown): string | null {
  return typeof x === 'string' && ADDRESS_RE.test(x) && x.toLowerCase() !== ZERO_ADDRESS ? x.toLowerCase() : null;
}

function asUint(x: unknown, max: bigint): bigint | null {
  return typeof x === 'bigint' && x >= 0n && x <= max ? x : null;
}

function asText(x: unknown): string | null {
  return typeof x === 'string' && x !== '' ? x : null;
}

/** Strict unpadded base64url: decodes and re-encodes to the same text. */
function b64u(x: unknown): Buffer | null {
  if (typeof x !== 'string' || !B64URL_RE.test(x)) return null;
  const bytes = Buffer.from(x, 'base64url');
  return bytes.toString('base64url') === x ? bytes : null;
}

function p256Key(spki: unknown): KeyObject | null {
  const der = b64u(spki);
  if (der === null) return null;
  try {
    const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
    return key.asymmetricKeyDetails?.namedCurve === 'prime256v1' ? key : null;
  } catch {
    return null;
  }
}

function verifyP1363(key: KeyObject, message: Buffer, signature: unknown): boolean {
  if (typeof signature !== 'string' || !SIG_P1363_RE.test(signature)) return false;
  return verifySignature('sha256', message, { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature.slice(2), 'hex'));
}

function sha256(b: Buffer | string): Buffer {
  return createHash('sha256').update(b).digest();
}

/** Minimal big-endian RLP integer: 0 → empty string. */
function rlpUint(x: bigint): Hex {
  if (x === 0n) return '0x';
  const h = x.toString(16);
  return /^(?:[0-9a-f]{2})+$/.test(h) ? `0x${h}` : `0x0${h}`;
}

interface LoadedCredential {
  readonly credentialId: string;
  readonly key: KeyObject;
  readonly rpIdHash: Buffer;
  readonly origin: string;
}

interface LoadedSecurity {
  readonly credentials: ReadonlyMap<string, LoadedCredential>;
  readonly monitorKey: KeyObject;
  readonly attestationMaxAgeMs: bigint;
  readonly hash: string;
}

interface LoadedTreasury {
  readonly treasury: ReadonlySet<string>;
  readonly caps: TreasuryConfig;
  readonly hash: string;
}

interface LoadedConfig {
  readonly report: ConfigReport;
  readonly security: LoadedSecurity;
  readonly treasury: LoadedTreasury;
}

function loadSecurity(signed: unknown, ownerKey: KeyObject, pinned: string): LoadedSecurity | null {
  const env = asObject(signed);
  const body = asObject(env?.['body']);
  if (env === null || body === null || env['version'] !== pinned) return null;
  const checkers: unknown = body['checkers'];
  const maxAge = asUint(body['attestationMaxAgeMs'], UINT256_MAX);
  if (!isList(checkers) || maxAge === null) return null;
  const credentials = new Map<string, LoadedCredential>();
  for (const item of checkers as readonly unknown[]) {
    const c = asObject(item);
    if (c === null) return null;
    const checkerId = asText(c['checkerId']);
    const credentialId = asText(c['credentialId']);
    const rpId = asText(c['rpId']);
    const origin = asText(c['origin']);
    const key = p256Key(c['publicKeySpki']);
    if (checkerId === null || credentialId === null || b64u(credentialId) === null || rpId === null || origin === null || key === null) return null;
    if (credentials.has(checkerId)) return null;
    credentials.set(checkerId, { credentialId, key, rpIdHash: sha256(rpId), origin });
  }
  const monitorKey = p256Key(body['monitorPublicKeySpki']);
  if (monitorKey === null) return null;
  const message = configMessage('security', pinned, body as unknown as SecurityConfig);
  if (!verifyP1363(ownerKey, message, env['signature'])) return null;
  return { credentials, monitorKey, attestationMaxAgeMs: maxAge, hash: sha256(message).toString('hex') };
}

function loadTreasury(signed: unknown, ownerKey: KeyObject, pinned: string): LoadedTreasury | null {
  const env = asObject(signed);
  const body = asObject(env?.['body']);
  if (env === null || body === null || env['version'] !== pinned) return null;
  const list: unknown = body['treasuryList'];
  if (!isList(list) || !(list as readonly unknown[]).every((x) => asAddress(x) !== null)) return null;
  if (!CAP_FIELDS.every((f) => asUint(body[f], UINT256_MAX) !== null)) return null;
  const given = body as unknown as TreasuryConfig;
  const message = configMessage('treasury', pinned, given);
  if (!verifyP1363(ownerKey, message, env['signature'])) return null;
  const caps: TreasuryConfig = {
    treasuryList: given.treasuryList.map((x) => x.toLowerCase() as Address),
    perTxCapWei: given.perTxCapWei,
    dailyCapWei: given.dailyCapWei,
    perMoveCapWei: given.perMoveCapWei,
    dailyMoveCapWei: given.dailyMoveCapWei,
    moveApprovalThresholdWei: given.moveApprovalThresholdWei,
    maxPriorityFeePerGasCeilingWei: given.maxPriorityFeePerGasCeilingWei,
    worstCaseFeeCeilingWei: given.worstCaseFeeCeilingWei,
  };
  return { treasury: new Set<string>(caps.treasuryList), caps, hash: sha256(message).toString('hex') };
}

/** authenticatorData: rpIdHash (32 bytes) ‖ flags (1) ‖ signCount (4) ‖ optional extensions, as hex. */
const AUTH_DATA_RE = /^([0-9a-f]{64})([0-9a-f]{2})[0-9a-f]{8}/;

/**
 * Verify a WebAuthn assertion (ES256) whose challenge must be `digest`.
 * clientDataJSON is checked with the WebAuthn Level 3 limited verification
 * algorithm (exact serialization prefix), so no JSON parser is used.
 * User presence and user verification are both required.
 */
function verifyAssertion(cred: LoadedCredential, assertion: unknown, digest: Buffer): boolean {
  if (typeof assertion !== 'string') return false;
  const parts = assertion.split('.');
  if (parts.length !== 5) return false;
  const [tag, credentialId, authB64, clientB64, sigB64] = parts;
  const authData = b64u(authB64);
  const clientData = b64u(clientB64);
  const sig = b64u(sigB64);
  if (tag !== 'webauthn1' || credentialId !== cred.credentialId || authData === null || clientData === null || sig === null) return false;
  const prefix = `{"type":"webauthn.get","challenge":${JSON.stringify(digest.toString('base64url'))},"origin":${JSON.stringify(cred.origin)}`;
  const text = clientData.toString('utf8');
  if (!text.startsWith(prefix)) return false;
  const rest = text.slice(prefix.length);
  // crossOrigin, when present, follows origin and must be false (a cross-origin ceremony is refused).
  const crossOrigin = ',"crossOrigin":';
  const tail = rest.startsWith(`${crossOrigin}false`) ? rest.slice(`${crossOrigin}false`.length) : rest;
  if (tail.startsWith(crossOrigin) || (!tail.startsWith('}') && !tail.startsWith(','))) return false;
  const auth = AUTH_DATA_RE.exec(authData.toString('hex'));
  if (auth === null || auth[1] !== cred.rpIdHash.toString('hex')) return false;
  const flags = BigInt(`0x${auth[2]}`);
  if ((flags & 0x05n) !== 0x05n) return false; // UP (bit 0) and UV (bit 2)
  // A malformed DER signature verifies false; were it ever to throw, sign() rejects and nothing is signed.
  return verifySignature('sha256', Buffer.concat([authData, sha256(clientData)]), { key: cred.key, dsaEncoding: 'der' }, sig);
}

/** A request after run-time validation: every field read once and copied (no getter can change it later). */
interface ValidRequest {
  readonly kind: SignKind;
  readonly instructionId: string;
  readonly approval: unknown;
  readonly nonce: bigint;
  readonly from: string;
  readonly to: string;
  readonly value: bigint;
  readonly gasLimit: bigint;
  readonly maxFeePerGas: bigint;
  readonly maxPriorityFeePerGas: bigint;
}

type Checked = { readonly ok: true; readonly req: ValidRequest } | { readonly ok: false; readonly reason: SignRefusal };

const NOT_ALLOWED: Checked = { ok: false, reason: 'SHAPE_NOT_ALLOWED' };

/** ADR-001 item 2 (shape) and the chain-ID pin, on the raw request. */
function checkShape(request: unknown): Checked {
  const r = asObject(request);
  const kind = asText(r?.['kind']);
  const instructionId = asText(r?.['instructionId']);
  const t = asObject(r?.['tx']);
  if (r === null || kind === null || !KINDS.has(kind) || instructionId === null || t === null) return NOT_ALLOWED;
  if (!Object.keys(t).every((k) => TX_FIELDS.has(k)) || t['type'] !== 'eip1559' || t['data'] !== '0x') return NOT_ALLOWED;
  if (t['chainId'] !== 5042002) return { ok: false, reason: 'CHAIN_ID' };
  const from = asAddress(t['from']);
  const to = asAddress(t['to']);
  const nonce = asUint(t['nonce'], NONCE_MAX);
  const value = asUint(t['value'], UINT256_MAX);
  const gasLimit = asUint(t['gasLimit'], UINT256_MAX);
  const maxFeePerGas = asUint(t['maxFeePerGas'], UINT256_MAX);
  const maxPriorityFeePerGas = asUint(t['maxPriorityFeePerGas'], maxFeePerGas ?? 0n);
  if (from === null || to === null || nonce === null || value === null || gasLimit === null || gasLimit === 0n) return NOT_ALLOWED;
  if (maxFeePerGas === null || maxPriorityFeePerGas === null) return NOT_ALLOWED;
  const req: ValidRequest = {
    kind: kind as SignKind,
    instructionId,
    approval: r['approval'] ?? null,
    nonce,
    from,
    to,
    value,
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
  return { ok: true, req };
}

function refused(reason: SignRefusal): SignResult {
  return { kind: 'REFUSED', reason };
}

export interface MockSignerOptions {
  readonly trust: SignerTrustAnchors;
  /** Shared, durable consumed-approval record and daily totals. */
  readonly ledger: SignerLedger;
  /** Direct channel to the monitor. */
  readonly signingLog: SigningLogSink;
  /** Milliseconds since the Unix epoch. The daily caps use UTC days (the day boundary is CF-25(d)). */
  readonly clock: () => bigint;
}

/** Test-only signer. Its HD seed is generated at construction time and never persisted. */
export class MockSigner implements Signer {
  readonly #root: HDKey;
  readonly #keys = new Map<string, { readonly key: Hex; readonly role: Role }>();
  readonly #securityOwner: KeyObject;
  readonly #treasuryOwner: KeyObject;
  readonly #trust: SignerTrustAnchors;
  readonly #ledger: SignerLedger;
  readonly #log: SigningLogSink;
  readonly #clock: () => bigint;
  #config: LoadedConfig | null = null;
  #attestation: MonitorAttestation | null = null;
  #highestSequence = -1n;

  /** `options` is typed optional only so a call without it fails closed at run time with a TypeError. */
  constructor(options?: MockSignerOptions) {
    if (options === undefined || asObject(options) === null || asObject(options.trust) === null) throw new TypeError('MockSigner: options required');
    const securityOwner = p256Key(options.trust.securityOwnerKeySpki);
    const treasuryOwner = p256Key(options.trust.treasuryOwnerKeySpki);
    if (securityOwner === null || treasuryOwner === null) throw new TypeError('MockSigner: trust anchors must be P-256 SPKI keys');
    this.#securityOwner = securityOwner;
    this.#treasuryOwner = treasuryOwner;
    this.#trust = { ...options.trust };
    this.#ledger = options.ledger;
    this.#log = options.signingLog;
    this.#clock = options.clock;
    this.#root = HDKey.fromMasterSeed(randomBytes(32));
  }

  /** Load both configuration sections. Any unsigned or unpinned section unloads everything (fail closed). */
  loadConfig(security: SignedConfig<SecurityConfig>, treasury: SignedConfig<TreasuryConfig>): ConfigLoadResult {
    this.#config = null;
    this.#attestation = null;
    const s = loadSecurity(security, this.#securityOwner, this.#trust.pinnedSecurityVersion);
    const t = loadTreasury(treasury, this.#treasuryOwner, this.#trust.pinnedTreasuryVersion);
    if (s === null || t === null) return { kind: 'REFUSED', reason: 'CONFIG_UNSIGNED' };
    const report: ConfigReport = {
      securityVersion: this.#trust.pinnedSecurityVersion,
      securityHash: s.hash,
      treasuryVersion: this.#trust.pinnedTreasuryVersion,
      treasuryHash: t.hash,
    };
    this.#config = { report, security: s, treasury: t };
    return { kind: 'LOADED', ...report };
  }

  /** Hash of each loaded configuration version, or null when no valid configuration is loaded. */
  configReport(): ConfigReport | null {
    return this.#config?.report ?? null;
  }

  /** ADR-008 attestation protocol. Invalid, stale, future-dated or out-of-sequence attestations are ignored. */
  acceptAttestation(attestation: MonitorAttestation): AttestationOutcome {
    const config = this.#config;
    if (config === null) return 'IGNORED_NO_CONFIG';
    const a = asObject(attestation);
    const kind: unknown = a?.['kind'];
    const sequence = asUint(a?.['sequence'], UINT256_MAX);
    const issuedAtMs = asUint(a?.['issuedAtMs'], UINT256_MAX);
    const signature: unknown = a?.['signature'];
    if ((kind !== 'ALL_CLEAR' && kind !== 'PAUSE') || sequence === null || issuedAtMs === null) return 'IGNORED_MALFORMED';
    if (!verifyP1363(config.security.monitorKey, attestationMessage({ kind, sequence, issuedAtMs }), signature)) return 'IGNORED_BAD_SIGNATURE';
    const now = this.#clock();
    if (issuedAtMs > now) return 'IGNORED_FUTURE';
    if (now - issuedAtMs > config.security.attestationMaxAgeMs) return 'IGNORED_STALE';
    if (sequence <= this.#highestSequence) return 'IGNORED_OUT_OF_SEQUENCE';
    this.#highestSequence = sequence;
    this.#attestation = { kind, sequence, issuedAtMs, signature: signature as `0x${string}` };
    return 'ACCEPTED';
  }

  deriveAddress(role: Role, index: bigint): Promise<Address> {
    const root = this.#root; // a foreign receiver throws here, synchronously
    const branch = ROLE_BRANCH.get(role);
    if (branch === undefined || asUint(index, HD_INDEX_MAX) === null) {
      return Promise.reject(new RangeError('MockSigner.deriveAddress: unknown role or index out of range'));
    }
    const child = root.derive(`m/44'/60'/${branch}/0/${index}`);
    const key = `0x${Buffer.from(child.privateKey as Uint8Array).toString('hex')}` as Hex;
    const address = privateKeyToAddress(key);
    this.#keys.set(address.toLowerCase(), { key, role });
    return Promise.resolve(address);
  }

  sign(request: SignRequest): Promise<SignResult> {
    const config = this.#config; // a foreign receiver throws here, synchronously
    return this.#sign(config, request);
  }

  async #sign(config: LoadedConfig | null, request: SignRequest): Promise<SignResult> {
    if (config === null) return refused('CONFIG_UNSIGNED');
    const now = this.#clock();
    const att = this.#attestation;
    if (att?.kind === 'PAUSE') return refused('MONITOR_PAUSE');
    if (att === null || att.issuedAtMs > now || now - att.issuedAtMs > config.security.attestationMaxAgeMs) return refused('NO_ALL_CLEAR');

    const shape = checkShape(request);
    if (!shape.ok) return refused(shape.reason);
    const { kind, instructionId, approval, nonce, from, to, value, gasLimit, maxFeePerGas, maxPriorityFeePerGas } = shape.req;
    const held = this.#keys.get(from);
    if (held === undefined) return refused('SHAPE_NOT_ALLOWED');

    const caps = config.treasury.caps;
    const fee = gasLimit * maxFeePerGas;
    if (maxPriorityFeePerGas > caps.maxPriorityFeePerGasCeilingWei || fee > caps.worstCaseFeeCeilingWei) return refused('FEE_CEILING');
    const total = value + fee;
    const digest = payloadDigest({ amountWei: value, destination: to, instructionId });
    const payloadHash = digest.toString('hex');

    if (kind === 'CANCEL') {
      if (value !== 0n || to !== from) return refused('SHAPE_NOT_ALLOWED');
      if (!config.treasury.treasury.has(from) && held.role !== 'collection') return refused('SHAPE_NOT_ALLOWED');
    } else if (kind === 'INTERNAL_MOVE') {
      if (!config.treasury.treasury.has(to)) return refused('MOVE_NOT_ON_TREASURY_LIST');
      if (total > caps.perMoveCapWei) return refused('MOVE_CAP');
      if (approval !== null || value > caps.moveApprovalThresholdWei) {
        const bad = checkApproval(config, approval, digest, payloadHash);
        if (bad !== null) return refused(bad);
      }
    } else {
      const bad = checkApproval(config, approval, digest, payloadHash);
      if (bad !== null) return refused(bad);
      if (total > caps.perTxCapWei) return refused('PER_TX_CAP');
    }

    const day = (now / DAY_MS).toString();
    const ledgerRefusal = await this.#ledger.transact((txn): SignRefusal | null => {
      const prior = txn.slotFor(instructionId);
      const sameSlot = prior !== undefined && prior.from === from && prior.nonce === nonce;
      let counter: DailyCounter;
      let debit: bigint;
      if (kind === 'CANCEL') {
        // Only a same-nonce cancel of an instruction already signed (by this or a peer instance).
        if (prior === undefined || !sameSlot) return 'SHAPE_NOT_ALLOWED';
        counter = prior.kind === 'INTERNAL_MOVE' ? 'MOVE' : 'DAILY';
        debit = fee;
      } else {
        if (prior !== undefined && (!sameSlot || prior.kind !== kind || prior.payloadHash !== payloadHash)) return 'APPROVAL_REPLAYED';
        counter = kind === 'INTERNAL_MOVE' ? 'MOVE' : 'DAILY';
        debit = prior === undefined ? total : fee; // a same-nonce replacement adds its worst-case fee
      }
      const cap = counter === 'MOVE' ? caps.dailyMoveCapWei : caps.dailyCapWei;
      if (txn.dailyTotal(counter, day) + debit > cap) return counter === 'MOVE' ? 'MOVE_CAP' : 'DAILY_CAP';
      txn.addDebit(counter, day, debit);
      if (prior === undefined) txn.recordSlot({ instructionId, kind, from, nonce, payloadHash });
      return null;
    });
    if (ledgerRefusal !== null) return refused(ledgerRefusal);

    const fields: Hex[] = [
      rlpUint(ARC_TESTNET_CHAIN_ID),
      rlpUint(nonce),
      rlpUint(maxPriorityFeePerGas),
      rlpUint(maxFeePerGas),
      rlpUint(gasLimit),
      to as Hex,
      rlpUint(value),
      '0x',
    ];
    const unsigned: Hex = `0x02${toRlp([...fields, []]).slice(2)}`;
    const sig = await signDigest({ hash: keccak256(unsigned), privateKey: held.key, to: 'hex' });
    const r = rlpUint(BigInt(`0x${sig.slice(2, 66)}`));
    const s = rlpUint(BigInt(`0x${sig.slice(66, 130)}`));
    const yParity: Hex = sig.slice(130) === '1c' ? '0x01' : '0x';
    const rawTx: Hex = `0x02${toRlp([...fields, [], yParity, r, s]).slice(2)}`;
    const txHash = keccak256(rawTx);
    await this.#log.append({ payloadHash, nonce, txHash, instructionId });
    return { kind: 'SIGNED', rawTx, txHash };
  }
}

/** ADR-001 item 1: compare the recomputed payloadHash, then verify the checker's assertion over the raw digest. */
function checkApproval(config: LoadedConfig, approval: unknown, digest: Buffer, payloadHash: string): SignRefusal | null {
  if (approval === null) return 'CHECKER_REQUIRED';
  const a = asObject(approval);
  const checkerId = asText(a?.['checkerId']);
  if (a === null || checkerId === null) return 'APPROVAL_INVALID';
  if (a['payloadHash'] !== payloadHash) return 'APPROVAL_MISMATCH';
  const cred = config.security.credentials.get(checkerId);
  if (cred === undefined || !verifyAssertion(cred, a['checkerAssertion'], digest)) return 'APPROVAL_INVALID';
  return null;
}
