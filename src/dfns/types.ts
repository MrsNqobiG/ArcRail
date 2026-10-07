/**
 * F1a DFNS facts, decoders and the DFNS status → stage mapping (NOVA_ARC_DESIGN §8).
 *
 * Every DFNS name below (endpoint field, enum value, id pattern) is copied from
 * an archived page under docs/sources/dfns/ (MANIFEST rows dated 2026-10-06);
 * the citation key is in brackets, per NOVA_ARC_DESIGN §0.1. Nothing here is
 * inferred. Where two DFNS pages disagree, the open question is named.
 *
 * Decoders are strict and fail closed: a body that does not match the archived
 * schema throws `JsonShapeError`, which the client reports as AMBIGUOUS
 * (`BAD_RESPONSE`). Amount strings are checked against `^\d+$` before any
 * `BigInt`; the float `metadata.asset.quotes.USD` [DF:transfer] is never read.
 */
import { createHash } from 'node:crypto';
import {
  type JsonObject,
  type JsonValue,
  JsonNumber,
  JsonShapeError,
  asArray,
  asObject,
  canonicalJson,
  jsonObject,
  optString,
  reqInteger,
  reqString,
} from './json.js';

// ---------------------------------------------------------------------------
// Networks. Testnet only (CLAUDE.md rule 1).
// ---------------------------------------------------------------------------

/** DFNS name of Arc testnet [DF:networks, "Arc | ArcTestnet"; DF:get-wallet `network` enum]. */
export const DFNS_ARC_TESTNET = 'ArcTestnet';
/** DFNS name of Arc mainnet [DF:get-wallet `network` enum]. Present only so it can be refused (NOVA_ARC_DESIGN §11). */
export const DFNS_ARC_MAINNET = 'Arc';
/** Arc testnet chain ID, C-01 (docs/constants.md). The gateway pins every submission to it. */
export const ARC_TESTNET_CHAIN_ID = 5042002n;

/** DFNS API base URLs [DF:regions "Environments overview"; DF:transfer `servers`]. Staging is deprecated and not accepted. */
export type DfnsBaseUrl = 'https://api.dfns.io' | 'https://api.uae.dfns.io';
export const DFNS_BASE_URLS: readonly DfnsBaseUrl[] = ['https://api.dfns.io', 'https://api.uae.dfns.io'];

// ---------------------------------------------------------------------------
// Identifier and value patterns.
// ---------------------------------------------------------------------------

/** Wallet id [DF:get-wallet `id` pattern]. */
export const WALLET_ID = /^wa-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$/;
/** Transfer id [DF:transfer `TransferRequest.id` pattern]. */
export const TRANSFER_ID = /^xfr-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$/;
/** Approval id [DF:transfer `TransferRequest.approvalId` pattern]. */
export const APPROVAL_ID = /^ap-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$/;
/** Base-unit amount string [DF:transfer `amount` pattern `^\d+$`]; also used for wei strings [DF:fees]. */
export const DECIMAL_STRING = /^\d+$/;
/** EVM address [DF:transfer `Erc20` `contract` / `to` pattern]. */
export const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/** EVM transaction hash (32 bytes hex). DFNS documents `txHash` only as a string [DF:transfer]; we require EVM form on Arc. */
export const EVM_TX_HASH = /^0x[0-9a-fA-F]{64}$/;
/** `externalId`: 1–50 characters [DF:transfer `externalId` minLength/maxLength]. */
export const EXTERNAL_ID = /^.{1,50}$/s;

// ---------------------------------------------------------------------------
// Wallet [DF:get-wallet].
// ---------------------------------------------------------------------------

/** Wallet status enum [DF:get-wallet `status`]. */
export type DfnsWalletStatus = 'Active' | 'Inactive' | 'Archived';
const WALLET_STATUSES: readonly string[] = ['Active', 'Inactive', 'Archived'];

export interface DfnsWallet {
  readonly id: string;
  readonly network: string;
  /** Optional in the schema [DF:get-wallet: `address` is not in `required`]. */
  readonly address: string | null;
  readonly status: DfnsWalletStatus;
  /** Present for a vault wallet, which "is read-only, its funds move through the vault endpoints" [DF:get-wallet `vaultId`]. */
  readonly vaultId: string | null;
}

export function decodeWallet(v: JsonValue): DfnsWallet {
  const o = asObject(v, 'wallet');
  const status = reqString(o, 'status');
  if (!WALLET_STATUSES.includes(status)) throw shapeError(`wallet status ${JSON.stringify(status)}`);
  return {
    id: reqString(o, 'id', WALLET_ID),
    network: reqString(o, 'network'),
    address: optString(o, 'address'),
    status: status as DfnsWalletStatus,
    vaultId: optString(o, 'vaultId'),
  };
}

// ---------------------------------------------------------------------------
// Wallet assets (balance) [DF:assets].
// ---------------------------------------------------------------------------

/** A fungible asset row: the EVM kinds `Native` and `Erc20` [DF:assets `kind` oneOf], the only rows whose balance is read on Arc. */
export interface DfnsFungibleAsset {
  readonly kind: 'Native' | 'Erc20';
  /** The ERC-20 contract [DF:assets: required for `Erc20`]; null for `Native`. */
  readonly contract: string | null;
  /**
   * Base units: "balances are returned in their smallest unit (wei, satoshi, etc.) as strings"
   * (docs/sources/dfns/guides_developers_displaying-balances.md). Checked against `^\d+$` first.
   */
  readonly balance: bigint;
  /** [DF:assets `decimals`, a JSON number]: must be a JSON integer here. Informational; our own decimals come from C-10/C-12. */
  readonly decimals: bigint;
}

/**
 * An EVM ERC-7984 confidential-token row [DF:assets: `Erc7984`, "EVM ERC-7984 confidential tokens",
 * required `kind` and `contract`]. Never USDC (C-12 is the `Erc20` row) and never a balance we read:
 * its `balance` is not interpreted, so a confidential token anyone sends to the wallet cannot make the
 * whole read fail (Lens R-1 m3). Carried only so reconciliation can see it is there.
 */
export interface DfnsConfidentialAsset {
  readonly kind: 'Erc7984';
  readonly contract: string;
}

export type DfnsWalletAsset = DfnsFungibleAsset | DfnsConfidentialAsset;

export interface DfnsWalletAssets {
  readonly walletId: string;
  readonly network: string;
  readonly assets: readonly DfnsWalletAsset[];
}

function decodeWalletAsset(v: JsonValue): DfnsWalletAsset {
  const o = asObject(v, 'asset');
  const kind = reqString(o, 'kind');
  if (kind === 'Erc7984') return { kind, contract: reqString(o, 'contract', EVM_ADDRESS) };
  // Every other kind in [DF:assets] belongs to a non-EVM chain: on an ArcTestnet wallet it is a contradiction.
  if (kind !== 'Native' && kind !== 'Erc20') throw shapeError(`asset kind ${JSON.stringify(kind)} is not an EVM kind`);
  return {
    kind,
    contract: kind === 'Erc20' ? reqString(o, 'contract', EVM_ADDRESS) : null,
    balance: BigInt(reqString(o, 'balance', DECIMAL_STRING)),
    decimals: reqInteger(o, 'decimals'),
  };
}

/**
 * Get Wallet Assets response [DF:assets]: required `walletId`, `network`, `assets`; per asset the
 * required `kind`, `balance` and `decimals`. `quotes.USD` and `netWorth.USD` are floats and are
 * never read. A response for another wallet than `walletId` is a shape error.
 */
export function decodeWalletAssets(v: JsonValue, walletId: string): DfnsWalletAssets {
  const o = asObject(v, 'wallet assets');
  const got = reqString(o, 'walletId', WALLET_ID);
  if (got !== walletId) throw shapeError(`assets for wallet ${got}, not ${walletId}`);
  return { walletId: got, network: reqString(o, 'network'), assets: asArray(o.get('assets'), 'assets').map(decodeWalletAsset) };
}

// ---------------------------------------------------------------------------
// Fees [DF:fees, "EVM EIP-1559"].
// ---------------------------------------------------------------------------

export interface DfnsEip1559Fees {
  readonly network: string;
  readonly slowMaxFeePerGas: bigint;
  readonly standardMaxFeePerGas: bigint;
  readonly fastMaxFeePerGas: bigint;
}

function maxFeeOf(o: JsonObject, tier: 'slow' | 'standard' | 'fast'): bigint {
  return BigInt(reqString(asObject(o.get(tier), tier), 'maxFeePerGas', DECIMAL_STRING));
}

export function decodeFees(v: JsonValue): DfnsEip1559Fees {
  const o = asObject(v, 'fees');
  reqString(o, 'kind', /^Eip1559$/);
  return {
    network: reqString(o, 'network'),
    slowMaxFeePerGas: maxFeeOf(o, 'slow'),
    standardMaxFeePerGas: maxFeeOf(o, 'standard'),
    fastMaxFeePerGas: maxFeeOf(o, 'fast'),
  };
}

// ---------------------------------------------------------------------------
// Transfer request [DF:transfer `TransferRequest`; DF:get-transfer].
// ---------------------------------------------------------------------------

/** TransferRequest status enum [DF:transfer `status`]. */
export type DfnsTransferStatus = 'Pending' | 'Executing' | 'Broadcasted' | 'Confirmed' | 'Failed' | 'Rejected';
const TRANSFER_STATUSES: readonly string[] = ['Pending', 'Executing', 'Broadcasted', 'Confirmed', 'Failed', 'Rejected'];

export interface DfnsTransfer {
  readonly id: string;
  readonly walletId: string;
  readonly network: string;
  readonly status: DfnsTransferStatus;
  /** The body DFNS recorded for this transfer, verbatim (numbers as text). */
  readonly requestBody: JsonObject;
  readonly txHash: string | null;
  readonly externalId: string | null;
  readonly replacementId: string | null;
  readonly approvalId: string | null;
  readonly reason: string | null;
  readonly dateBroadcasted: string | null;
  /**
   * "Structured representation of the data used to construct the signature (e.g. nonce, gas
   * parameters). Shape is blockchain specific." [DF:transfer `TransferRequest.details`]. Kept
   * verbatim; only `detailsNonce` reads it.
   */
  readonly details: JsonObject | null;
}

export function decodeTransfer(v: JsonValue): DfnsTransfer {
  const o = asObject(v, 'transferRequest');
  const status = reqString(o, 'status');
  if (!TRANSFER_STATUSES.includes(status)) throw shapeError(`transfer status ${JSON.stringify(status)}`);
  return {
    id: reqString(o, 'id', TRANSFER_ID),
    walletId: reqString(o, 'walletId', WALLET_ID),
    network: reqString(o, 'network'),
    status: status as DfnsTransferStatus,
    requestBody: asObject(o.get('requestBody'), 'requestBody'),
    txHash: optString(o, 'txHash', EVM_TX_HASH),
    externalId: optString(o, 'externalId'),
    replacementId: optString(o, 'replacementId'),
    approvalId: optString(o, 'approvalId', APPROVAL_ID),
    reason: optString(o, 'reason'),
    dateBroadcasted: optString(o, 'dateBroadcasted'),
    details: optObject(o, 'details'),
  };
}

/** An optional object field: absent → null; present but not an object → shape error. */
function optObject(o: JsonObject, key: string): JsonObject | null {
  const v = o.get(key);
  return v === undefined ? null : asObject(v, key);
}

/** Decimal, or `0x` hex with at least one digit: the EVM `nonce` string forms [DF:cancel, EVM `nonce` anyOf]. */
const NONCE_DECIMAL = /^\d+$/;
const NONCE_HEX = /^0x[0-9a-fA-F]+$/;

/**
 * The reserved nonce `n` from a transfer's `details`, or null when it cannot be read.
 *
 * DFNS documents `details` only as "e.g. nonce … Shape is blockchain specific" [DF:transfer] and
 * archives no EVM example of it. We read one key, `nonce`, in the three forms DFNS documents for
 * an EVM transaction's `nonce` (a non-negative JSON integer, a `^\d+$` string or a `0x` hex
 * string) [DF:cancel, EVM `nonce`]. That key name is our reading, not a DFNS statement (Q-N20
 * part 3). Anything else is null, and a null nonce is never proof (c): the payment stays
 * QUARANTINED and the wallet stays on hold until a two-person decision with DFNS's written
 * answer (NOVA_ARC_DESIGN §8.4 check 3 (c), check 5; F-3b step 1).
 */
export function detailsNonce(details: JsonObject | null): bigint | null {
  const v = details?.get('nonce');
  if (v instanceof JsonNumber) return NONCE_DECIMAL.test(v.raw) ? BigInt(v.raw) : null;
  if (typeof v !== 'string') return null;
  return NONCE_DECIMAL.test(v) || NONCE_HEX.test(v) ? BigInt(v) : null;
}

export interface DfnsTransferPage {
  readonly items: readonly DfnsTransfer[];
  readonly nextPageToken: string | null;
}

/** List Transfers response: `items`, optional `nextPageToken` [DF:list-transfers]. */
export function decodeTransferPage(v: JsonValue): DfnsTransferPage {
  const o = asObject(v, 'transfer list');
  reqString(o, 'walletId', WALLET_ID);
  return { items: asArray(o.get('items'), 'items').map(decodeTransfer), nextPageToken: optString(o, 'nextPageToken') };
}

// ---------------------------------------------------------------------------
// User-action challenge [DF:action-init] and token [DF:action-sig].
// ---------------------------------------------------------------------------

export interface DfnsChallenge {
  readonly challenge: string;
  readonly challengeIdentifier: string;
  /** First entry of `allowCredentials.key` [DF:action-init; DF:flows "credId: challenge.allowCredentials.key[0].id"]. */
  readonly credId: string;
}

export function decodeChallenge(v: JsonValue): DfnsChallenge {
  const o = asObject(v, 'challenge');
  const keys = asArray(asObject(o.get('allowCredentials'), 'allowCredentials').get('key'), 'allowCredentials.key');
  const first = keys[0];
  if (first === undefined) throw shapeError('allowCredentials.key is empty: this identity has no Key credential');
  return {
    challenge: reqString(o, 'challenge', /^.+$/s),
    challengeIdentifier: reqString(o, 'challengeIdentifier', /^.+$/s),
    credId: reqString(asObject(first, 'allowCredentials.key[0]'), 'id', /^.+$/s),
  };
}

export function decodeUserAction(v: JsonValue): string {
  return reqString(asObject(v, 'user action'), 'userAction', /^.+$/s);
}

function shapeError(detail: string): JsonShapeError {
  return new JsonShapeError(`DFNS response shape: ${detail}`);
}

// ---------------------------------------------------------------------------
// Transfer request body we send [DF:transfer request schemas "Native", "Erc20"].
// ---------------------------------------------------------------------------

export type DfnsTransferBody =
  | { readonly kind: 'Native'; readonly to: string; readonly amount: string; readonly externalId: string }
  | { readonly kind: 'Erc20'; readonly contract: string; readonly to: string; readonly amount: string; readonly externalId: string };

/** Thrown when a body we are about to send is malformed (a programming error; nothing is sent). */
export class DfnsBodyError extends Error {
  override readonly name = 'DfnsBodyError';
}

/**
 * The exact JSON text of a transfer body. `priority` is always `Standard` (NOVA_ARC_DESIGN §8.4 check 7);
 * no `memo`, `travelRule` or `feeSponsorId` is ever sent in D1 (§8.5).
 */
export function transferBodyText(b: DfnsTransferBody): string {
  if (!DECIMAL_STRING.test(b.amount)) throw new DfnsBodyError('amount must match ^\\d+$');
  if (!EVM_ADDRESS.test(b.to)) throw new DfnsBodyError('to must be an EVM address');
  if (!EXTERNAL_ID.test(b.externalId)) throw new DfnsBodyError('externalId must be 1–50 characters');
  const common: readonly (readonly [string, JsonValue])[] = [
    ['to', b.to],
    ['amount', b.amount],
    ['priority', 'Standard'],
    ['externalId', b.externalId],
  ];
  if (b.kind === 'Native') return canonicalJson(jsonObject([['kind', 'Native'], ...common]));
  if (!EVM_ADDRESS.test(b.contract)) throw new DfnsBodyError('contract must be an EVM address');
  return canonicalJson(jsonObject([['kind', 'Erc20'], ['contract', b.contract], ...common]));
}

/**
 * `bodyDigest` of the submit marker (NOVA_ARC_DESIGN §7.3 `SubmitMarker`): `0x` + sha256 of the
 * exact UTF-8 bytes of `transferBodyText(b)`, the text the client signs and POSTs.
 */
export function transferBodyDigest(b: DfnsTransferBody): string {
  return bodyTextDigest(transferBodyText(b));
}

/** `0x` + sha256 of the UTF-8 bytes of an already-serialised body text. */
export function bodyTextDigest(text: string): string {
  return `0x${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

// ---------------------------------------------------------------------------
// Deterministic keys (NOVA_ARC_DESIGN §10.2).
// ---------------------------------------------------------------------------

/** UTF-8 byte length, counted without a `number` (MC-01): two hex digits per byte. */
function utf8ByteLength(s: string): bigint {
  let hexDigits = 0n;
  for (const _ of Buffer.from(s, 'utf8').toString('hex')) hexDigits += 1n;
  return hexDigits / 2n;
}

/**
 * `lp(x)`: 4-byte big-endian UTF-8 byte length of `x`, then the bytes (§10.2). A JS string has
 * fewer than 2^30 UTF-16 units in V8, so at most 3 × 2^30 < 2^32 UTF-8 bytes: the length
 * always fits the 8 hex digits.
 */
export function lengthPrefixed(s: string): Buffer {
  const len = utf8ByteLength(s);
  return Buffer.concat([Buffer.from(len.toString(16).padStart(8, '0'), 'hex'), Buffer.from(s, 'utf8')]);
}

/** sha256 over the concatenation of length-prefixed fields, as lower-case hex. */
export function lpDigestHex(fields: readonly string[]): string {
  return createHash('sha256').update(Buffer.concat(fields.map(lengthPrefixed))).digest('hex');
}

/** The ARC_TRANSFER leg's `attempt`: always the literal 1 (NOVA_ARC_DESIGN §7.3, §8.4 check 3, R3-B2). */
export const ONLY_ATTEMPT = 1n;

/**
 * DFNS `externalId` of a payment's one and only DFNS transfer request (§10.2):
 * `nv1-` + hex(sha256(lp(paymentId) ‖ lp('1')))[0..40], 44 characters, inside DFNS's
 * 1–50 limit [DF:transfer]. The `'1'` is the fixed attempt; no other value is ever
 * used. A retry is a new payment with a new id, so it gets a new externalId, as
 * DFNS requires after a terminal status [DF:idem]. For a P10 move, `moveId` takes
 * the place of `paymentId`.
 */
export function deriveExternalId(paymentId: string): string {
  return `nv1-${lpDigestHex([paymentId, ONLY_ATTEMPT.toString(10)]).slice(0, 40)}`;
}

// ---------------------------------------------------------------------------
// Inbound signal keys (§10.3).
// ---------------------------------------------------------------------------

/** Dedupe key of one DFNS transfer state; a webhook and a GET of the same state share it (§8.7 rule 5). */
export function transferDedupeKey(t: DfnsTransfer): string {
  return `dfns:transfer:${t.id}:${t.status}`;
}

/**
 * `payloadDigest` over the normalised projection of §10.3: `id`, `walletId`,
 * `network`, `status`, `txHash`, `externalId`, `replacementId`, `requestBody`;
 * absent fields as null; delivery fields and dates excluded.
 */
export function transferPayloadDigest(t: DfnsTransfer): string {
  const projection = jsonObject([
    ['id', t.id],
    ['walletId', t.walletId],
    ['network', t.network],
    ['status', t.status],
    ['txHash', t.txHash],
    ['externalId', t.externalId],
    ['replacementId', t.replacementId],
    ['requestBody', t.requestBody],
  ]);
  return `0x${createHash('sha256').update(canonicalJson(projection), 'utf8').digest('hex')}`;
}

/** Order of DFNS statuses: Pending → Executing → Broadcasted → terminal [DF:transfer; DF:monitoring]. */
export function transferStatusRank(s: DfnsTransferStatus): bigint {
  if (s === 'Pending') return 1n;
  if (s === 'Executing') return 2n;
  if (s === 'Broadcasted') return 3n;
  return 4n;
}

// ---------------------------------------------------------------------------
// DFNS status → our leg stage (§8.6). Input only: it never completes a payment
// and no DFNS status releases anything by itself.
// ---------------------------------------------------------------------------

/** A wallet nonce hold the caller must write with the signal (`applySignal` `placeHold`, §8.4 check 5). */
export interface NonceHoldRequest {
  readonly dfnsTransferId: string;
  /** `n` from `details` (`detailsNonce`); null when unparseable (Q-N20). */
  readonly nonce: bigint | null;
  /** An ABORT_ACCEPTED decision exists for this transfer (§7.3 `NewNonceHold.aborted`). */
  readonly aborted: boolean;
}

/** Evidence the mapper cannot read from DFNS: the two-person ABORT_ACCEPTED decision for this transfer id (F-2, F-5). */
export interface MappingEvidence {
  readonly abortAccepted: boolean;
}

export type DfnsStageSignal =
  /** A forward, non-terminal stage. `crossCheckOnly` marks DFNS `Confirmed`: it stays CONFIRMING (§2 rule 6). */
  | {
      readonly kind: 'STAGE';
      readonly stage: 'PENDING_APPROVAL' | 'APPROVED' | 'SUBMITTED' | 'CONFIRMING';
      readonly txHash: string | null;
      readonly crossCheckOnly: boolean;
    }
  /**
   * Proof (a1) of §8.4 check 3: DFNS `Rejected`, reached only from `Pending` by a policy or
   * approval rejection [DF:monitoring]. The leg may end and P6 may follow. Denied and Expired
   * cannot be told apart without `GET /v2/policy-approvals/{approvalId}`, which is not in the
   * D1 allow-list (see client.ts), so this is always REJECTED / APPROVAL_DENIED with
   * `approvalUnverified` and the caller pages (§8.6, Q-N3).
   */
  | {
      readonly kind: 'NEVER_SIGNED';
      readonly proof: 'A1_REJECTED';
      readonly stage: 'REJECTED';
      readonly reason: 'APPROVAL_DENIED';
      readonly approvalUnverified: true;
      /** Set only when `details` shows a nonce (§8.4 check 5 "terminal with no txHash and a nonce in details"). */
      readonly nonceHold: NonceHoldRequest | null;
    }
  /**
   * Proof (a2): hash-less `Failed` after an operator abort DFNS accepted for this transfer id
   * [DF:abort]. CANCELLED / CANCELLED_BY_OPERATOR, P6 may follow, and the wallet nonce hold
   * still applies until the account nonce has passed any nonce in `details` (§8.6).
   */
  | {
      readonly kind: 'NEVER_SIGNED';
      readonly proof: 'A2_ABORT_ACCEPTED';
      readonly stage: 'CANCELLED';
      readonly reason: 'CANCELLED_BY_OPERATOR';
      readonly approvalUnverified: false;
      readonly nonceHold: NonceHoldRequest;
    }
  /**
   * Hash-less `Failed` without an accepted abort. NOT proof (a): DFNS may hold signed bytes for a
   * reserved nonce [DF:cancel]. Stage unchanged, payment QUARANTINED, wallet nonce hold, nothing
   * released (§8.6). Only proof (c) after the F-3b nonce-burn procedure, or a two-person hash
   * link, moves the leg on.
   */
  | { readonly kind: 'FAILED_UNPROVEN'; readonly quarantine: true; readonly nonceHold: NonceHoldRequest; readonly detail: string }
  /**
   * `Failed` with a `txHash`: the outcome is decided by our indexer, never by DFNS (§8.6 last row).
   * Only a `txHash` lets the indexer link the transaction (§10.4), so a hash-less `Failed` never
   * lands here, whatever `dateBroadcasted` says: it is FAILED_UNPROVEN (§8.4 check 5).
   */
  | { readonly kind: 'HOLD_FOR_INDEXER'; readonly stage: 'CONFIRMING'; readonly txHash: string }
  /** A state DFNS's own documentation rules out, or a replacement (F-18): QUARANTINE. */
  | { readonly kind: 'ANOMALY'; readonly detail: string };

export function mapTransferStatus(t: DfnsTransfer, evidence: MappingEvidence): DfnsStageSignal {
  if (t.replacementId !== null) return { kind: 'ANOMALY', detail: `replacement ${t.replacementId} issued for ${t.id} (F-18)` };
  const broadcastEvidence = t.txHash !== null || t.dateBroadcasted !== null;
  // DFNS accepts an abort only while "Executing" and not yet signed [DF:abort]: a broadcast trace or a
  // policy rejection contradicts an accepted abort.
  if (evidence.abortAccepted && (broadcastEvidence || t.status === 'Rejected')) {
    return { kind: 'ANOMALY', detail: `abort accepted for ${t.id}, but DFNS shows ${t.status}${broadcastEvidence ? ' with broadcast evidence' : ''}` };
  }
  const nonce = detailsNonce(t.details);
  switch (t.status) {
    case 'Pending':
    case 'Executing':
      if (broadcastEvidence) return { kind: 'ANOMALY', detail: `${t.status} transfer ${t.id} carries broadcast evidence` };
      return { kind: 'STAGE', stage: t.status === 'Pending' ? 'PENDING_APPROVAL' : 'APPROVED', txHash: null, crossCheckOnly: false };
    case 'Broadcasted':
    case 'Confirmed':
      if (t.txHash === null) return { kind: 'ANOMALY', detail: `${t.status} transfer ${t.id} has no txHash` };
      return {
        kind: 'STAGE',
        stage: t.status === 'Broadcasted' ? 'SUBMITTED' : 'CONFIRMING',
        txHash: t.txHash,
        crossCheckOnly: t.status === 'Confirmed',
      };
    case 'Rejected':
      // DFNS rejects only from Pending ("Pending --> Rejected", "Blocked by policy or approval
      // rejected") [DF:monitoring], so a broadcast trace contradicts it.
      if (broadcastEvidence) return { kind: 'ANOMALY', detail: `Rejected transfer ${t.id} carries broadcast evidence` };
      return {
        kind: 'NEVER_SIGNED',
        proof: 'A1_REJECTED',
        stage: 'REJECTED',
        reason: 'APPROVAL_DENIED',
        approvalUnverified: true,
        nonceHold: nonce === null ? null : { dfnsTransferId: t.id, nonce, aborted: false },
      };
    case 'Failed':
      // "present means it was broadcast on-chain, absent means it failed off-chain" [DF:idem]. Only a
      // txHash lets our indexer link the outcome (§10.4); without one the leg can never resolve there.
      if (t.txHash !== null) return { kind: 'HOLD_FOR_INDEXER', stage: 'CONFIRMING', txHash: t.txHash };
      // Hash-less from here. A `dateBroadcasted` trace ("When the transfer was broadcasted to the
      // blockchain" [DF:transfer]) means signed bytes for a reserved nonce may be in the mempool: the
      // riskiest hash-less case, so it is FAILED_UNPROVEN with a nonce hold (§8.4 check 5, §8.6),
      // never HOLD_FOR_INDEXER. An accepted abort with that trace was already an ANOMALY above.
      if (t.dateBroadcasted !== null) return failedUnproven(t, nonce, `broadcast trace dateBroadcasted ${t.dateBroadcasted} but no txHash`);
      if (evidence.abortAccepted) {
        return {
          kind: 'NEVER_SIGNED',
          proof: 'A2_ABORT_ACCEPTED',
          stage: 'CANCELLED',
          reason: 'CANCELLED_BY_OPERATOR',
          approvalUnverified: false,
          nonceHold: { dfnsTransferId: t.id, nonce, aborted: true },
        };
      }
      return failedUnproven(t, nonce, 'without an accepted abort');
  }
}

/** Hash-less `Failed` that is not proof (a): QUARANTINE plus a wallet nonce hold; nothing released (§8.6). */
function failedUnproven(t: DfnsTransfer, nonce: bigint | null, why: string): DfnsStageSignal {
  return {
    kind: 'FAILED_UNPROVEN',
    quarantine: true,
    nonceHold: { dfnsTransferId: t.id, nonce, aborted: false },
    detail: `hash-less Failed ${t.id} ${why} is not proof (a); nonce ${nonce === null ? 'unknown (Q-N20)' : nonce.toString(10)}`,
  };
}
