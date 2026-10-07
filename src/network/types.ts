/**
 * Unit NET: the Network port (NOVA_ARC_DESIGN §5.1).
 *
 * Everything network-specific lives behind `NetworkAdapter`. The orchestrator
 * and the postings see only this file's types, `NativeWei` (U1, frozen) and
 * `ConfirmedTransfer`. Arc rules live only in `src/network/arc/**` and the Arc
 * event indexer `src/indexer/**` (§5.2).
 *
 * Money: amounts are U1 branded bigints only. Block numbers, log indexes,
 * chain IDs and gas units are plain `bigint` (never `number`, MC-01).
 *
 * Deviations from the design sketch in §5.1, each deliberate:
 * - Results use `NetworkRead` (OK or FAILED with a typed `NetworkFailure`)
 *   instead of the ports' `PortResult`, because a network read has no
 *   idempotency key and no `AMBIGUOUS` outcome; every FAILED means PAUSE
 *   outbound (fail closed, CLAUDE.md money invariants).
 * - `ConfirmedTransfer.fee` is replaced by `gas` (payer, gasUsed,
 *   effectiveGasPrice). Gas is per transaction, not per log (C-25), and the fee
 *   product is computed once by the gas unit (U11 `receiptFeeWei`), so no
 *   module here re-brands a raw arithmetic result (U1 re-brand rule).
 * - `NetworkFailure` adds `SOURCE_STOPPED` (any unknown RPC error: stop, never
 *   "no logs"), `SOURCE_LAGGING` (-32014 or transport retries exhausted, C-42)
 *   and `CURSOR_CONFLICT` (a second writer moved the cursor), and
 *   `INVALID_ADDRESS` (`poll` refuses a malformed address before any read).
 * - `confirmTx` returns a `TxConfirmation`, which also carries a status-0
 *   receipt (a blocklist revert that consumed gas, C-53), so F-3c is visible.
 * - Delivery is through a transactional inbox (CLAUDE.md "Exactly once"):
 *   `poll` commits pages and returns every committed transfer the consumer has
 *   not yet acknowledged; `pending` reads the same list without touching the
 *   network (it also works while halted); `ack` marks transfers processed. A
 *   transfer committed by a poll that then failed is therefore never lost
 *   (verifier NOVA-NET-lensR-1 B1).
 * - `resume` clears a sticky halt with two distinct approvers. The halt is
 *   persisted with the cursor, so a restart does not clear it (m2).
 */
import type { CbsMinor, CbsPrecision, NativeWei } from '../amounts/index.js';
import type { Hex32 } from '../chain/config/index.js';

export type { Hex32 };

/** Grows per adapter (D7). `FAKENET` is test-only; a production composition root must refuse it. */
export type NetworkId = 'ARC' | 'FAKENET';
export type AssetId = 'USDC';

/** An EVM address, always lower-case (normalised on entry by `toNetworkAddress`). */
export type NetworkAddress = `0x${string}`;

/** Outcome of a network read. FAILED always means: PAUSE outbound and page a human. */
export type NetworkRead<T> =
  | { readonly kind: 'OK'; readonly value: T }
  | { readonly kind: 'FAILED'; readonly failure: NetworkFailure };

export type NetworkFailure =
  | { readonly kind: 'RPC_DISAGREEMENT'; readonly detail: string }
  | { readonly kind: 'CHAIN_STALL'; readonly lastHead: bigint; readonly sinceMs: bigint }
  | { readonly kind: 'UNKNOWN_EVENT'; readonly txHash: Hex32; readonly logIndex: bigint; readonly detail: string }
  | { readonly kind: 'RANGE_UNRECOVERABLE'; readonly source: string; readonly from: bigint; readonly to: bigint }
  | { readonly kind: 'SOURCE_STOPPED'; readonly source: string; readonly code: bigint | null; readonly detail: string }
  | { readonly kind: 'SOURCE_LAGGING'; readonly source: string; readonly detail: string }
  | { readonly kind: 'CURSOR_CONFLICT'; readonly expected: bigint | null; readonly actual: bigint | null }
  /** `poll` was given something that is not an address (lensR-1 m6). Not sticky: no source was read and nothing moved. */
  | { readonly kind: 'INVALID_ADDRESS'; readonly address: string };

export type NetworkFailureKind = NetworkFailure['kind'];

/** What a payment binds to (CLAUDE.md "Binding"): taken from the server-side record, never from client input. */
export interface NetworkTransferIntent {
  readonly network: NetworkId;
  readonly asset: AssetId;
  /** Our custody wallet's address. */
  readonly from: NetworkAddress;
  readonly to: NetworkAddress;
  /** Full-precision amount on the network's value view. */
  readonly amount: NativeWei;
}

/** Gas facts of one transaction (C-25). The fee product is the gas unit's job (U11). */
export interface TxGas {
  /** `from` of the receipt: the account that paid the gas (may be a relayer, C-27). */
  readonly payer: NetworkAddress;
  readonly gasUsed: bigint;
  /** Wei per gas unit: a rate, not an amount, so no U1 brand (the fee product is U11's). */
  readonly effectiveGasPrice: bigint;
}

/** One canonical value movement, confirmed by the network's own evidence. */
export interface ConfirmedTransfer {
  readonly network: NetworkId;
  readonly chainId: bigint;
  readonly txHash: Hex32;
  readonly logIndex: bigint;
  readonly blockNumber: bigint;
  readonly blockHash: Hex32;
  /** From the canonical log, never from `tx.from` (C-27). */
  readonly from: NetworkAddress;
  readonly to: NetworkAddress;
  readonly amount: NativeWei;
  /** A transfer exists only in a successful transaction. */
  readonly receiptStatus: 1n;
  readonly gas: TxGas;
  /** How many independent sources agreed: 2, or 1 only under the testnet-only flag (§6.3). */
  readonly sources: 1n | 2n;
  /** Inbox dedupe key `<network>:<chainId>:<txHash>:<logIndex>` (§10.3). */
  readonly dedupeKey: string;
  /** sha256 over the normalised projection of §10.3 (hex). */
  readonly payloadDigest: string;
}

/** One transaction looked up by hash (§6.5). A status-0 receipt has no transfers but still has gas (C-53, F-3c). */
export interface TxConfirmation {
  readonly txHash: Hex32;
  readonly blockNumber: bigint;
  readonly blockHash: Hex32;
  readonly receiptStatus: 0n | 1n;
  readonly gas: TxGas;
  readonly transfers: readonly ConfirmedTransfer[];
  readonly sources: 1n | 2n;
}

export interface NetworkHead {
  readonly number: bigint;
  readonly hash: Hex32;
}

export type NetworkPrecheckCode =
  | 'CHAIN_ID_MISMATCH'
  | 'NETWORK_DISABLED'
  | 'ASSET_NOT_SUPPORTED'
  | 'SENDER_BLOCKLISTED'
  | 'RECIPIENT_BLOCKLISTED'
  | 'BLOCKLIST_STALE'
  | 'INVALID_SOURCE'
  | 'INVALID_DESTINATION'
  | 'AMOUNT_NOT_POSITIVE'
  | 'AMOUNT_NOT_REPRESENTABLE';

export type PrecheckResult =
  | { readonly kind: 'OK' }
  | { readonly kind: 'REJECTED'; readonly code: NetworkPrecheckCode; readonly detail: string };

/** Outcome of `ack`. UNKNOWN_KEY: a key that was never committed; nothing was acknowledged. */
export type AckResult = { readonly kind: 'ACKED' } | { readonly kind: 'UNKNOWN_KEY'; readonly key: string };

/**
 * DFNS `Transfer Asset` body, `kind: Native` only (DF:transfer, archived
 * docs/sources/dfns/api-reference_wallets_transfer-asset.md: `kind` enum
 * `Native`, `to`, `amount` pattern `^\d+$` "in minimum denomination",
 * `priority` enum Slow/Standard/Fast, `externalId` 1–50 chars). Whether USDC
 * on ArcTestnet must go as `Native` or `Erc20` is Q-N1, and whether a Native
 * amount on Arc is 18-dp wei is Q-N2; until both are answered the body is
 * used against fakes only.
 */
export interface DfnsNativeTransferBody {
  readonly kind: 'Native';
  readonly to: NetworkAddress;
  readonly amount: string;
  readonly priority: 'Standard';
  readonly externalId: string;
}

export interface NetworkAdapter {
  readonly network: NetworkId;
  readonly asset: AssetId;
  readonly chainId: bigint;
  /** Pre-submit checks only this network can make (Arc: chain pin, local blocklist, destination rules). */
  precheck(intent: NetworkTransferIntent): Promise<PrecheckResult>;
  /** The business amount (ledger minor units at precision p) on the network's value view, exactly, via U1. Throws if not representable. */
  toNetworkAmount(minor: CbsMinor, p: CbsPrecision): NativeWei;
  /** The DFNS transfer body for this network and asset (§8.5). Throws on an invalid externalId. */
  dfnsTransferBody(intent: NetworkTransferIntent, externalId: string): DfnsNativeTransferBody;
  /**
   * Pull confirmed transfers touching `addresses` since each address's stored
   * cursor and commit them with the cursor advance (one atomic step per page).
   * A newly added address is scanned from the start block. On OK, returns
   * every committed transfer not yet acknowledged, in commit order: the same
   * list on every call until `ack`, each transfer once (a re-delivery is
   * deduplicated on its `dedupeKey`). On FAILED, pages committed before the
   * failure stay committed and are returned by `pending` and by the next OK
   * poll. FAILED never means "no transfers".
   */
  poll(addresses: ReadonlySet<NetworkAddress>): Promise<NetworkRead<readonly ConfirmedTransfer[]>>;
  /** Every committed transfer not yet acknowledged, in commit order. Reads no network; works while halted. */
  pending(): Promise<readonly ConfirmedTransfer[]>;
  /**
   * Mark transfers processed, after the consumer has applied them (its own
   * apply is idempotent on the same `dedupeKey`, so a crash between apply and
   * ack only re-delivers). All or nothing: an unknown key acknowledges none.
   */
  ack(dedupeKeys: readonly string[]): Promise<AckResult>;
  /** Look up one transaction by hash on every source; OK null when it is not (yet) confirmed. */
  confirmTx(txHash: Hex32): Promise<NetworkRead<TxConfirmation | null>>;
  /** Liveness: the confirmed head every source has reached. */
  head(): Promise<NetworkRead<NetworkHead>>;
  /**
   * Clear a sticky halt (RPC_DISAGREEMENT, UNKNOWN_EVENT, RANGE_UNRECOVERABLE,
   * SOURCE_STOPPED, CURSOR_CONFLICT). Two distinct, non-empty approver
   * identities (CLAUDE.md "Fail closed"); the adapter records them but cannot
   * authenticate them: the caller must pass identities its operator channel
   * has already authenticated (CF-26). Throws RangeError on invalid approvers
   * or when nothing is halted.
   */
  resume(approverA: string, approverB: string): Promise<void>;
}

/** Shared approver rule of `resume`: two distinct, non-empty (trimmed) identities. Returns them trimmed. */
export function checkApprovers(approverA: string, approverB: string): readonly [string, string] {
  const a = approverA.trim();
  const b = approverB.trim();
  if (a === '' || b === '' || a === b) throw new RangeError('resume needs two distinct named approvers');
  return [a, b];
}

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const HASH_RE = /^0x[0-9a-f]{64}$/;

/** A 20-byte hex address, lower-cased; null for anything else. */
export function toNetworkAddress(raw: string): NetworkAddress | null {
  const lower = raw.toLowerCase();
  return ADDRESS_RE.test(lower) ? (lower as NetworkAddress) : null;
}

/**
 * `poll` input check, shared by every adapter (lensR-1 m6): the addresses
 * lower-cased, or INVALID_ADDRESS for the first one that is not an address.
 */
export function pollAddresses(addresses: ReadonlySet<NetworkAddress>): readonly NetworkAddress[] | NetworkFailure {
  let out: readonly NetworkAddress[] = [];
  for (const raw of addresses) {
    const a = toNetworkAddress(raw);
    if (a === null) return { kind: 'INVALID_ADDRESS', address: raw };
    if (!out.includes(a)) out = [...out, a];
  }
  return out;
}

/** A 32-byte hex hash, lower-cased; null for anything else. */
export function toHex32(raw: string): Hex32 | null {
  const lower = raw.toLowerCase();
  return HASH_RE.test(lower) ? (lower as Hex32) : null;
}

/** Inbox dedupe key (§10.3): `<network>:<chainId>:<txHash>:<logIndex>`, lower-case. */
export function transferDedupeKey(network: NetworkId, chainId: bigint, txHash: Hex32, logIndex: bigint): string {
  return `${network.toLowerCase()}:${chainId}:${txHash.toLowerCase()}:${logIndex}`;
}

/** DFNS `externalId`: 1–50 characters (DF:transfer). */
export function checkExternalId(externalId: string): string {
  if (externalId.length === 0 || externalId.length > 50) {
    throw new RangeError('externalId must be 1 to 50 characters (DF:transfer)');
  }
  return externalId;
}

/** DFNS `amount`: a decimal string of a non-negative integer, `^\d+$` (DF:transfer). */
export function dfnsAmount(amount: NativeWei): string {
  const text = amount.toString(10);
  if (!/^\d+$/.test(text)) {
    throw new RangeError('DFNS amount must match ^\\d+$ (DF:transfer)');
  }
  return text;
}
