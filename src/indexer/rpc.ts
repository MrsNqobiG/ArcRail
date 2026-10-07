/**
 * Unit NET: the RPC source port of the Arc event indexer (types only).
 *
 * One `RpcSource` is one independent JSON-RPC endpoint: our own node or the
 * reference RPC (ADR-002; C-03, C-04). The concrete HTTP implementation lives
 * in the composition root; it decodes hex quantities from strings into
 * `bigint` (never through `number`), so this port is integer-only. Tests use
 * the in-memory chain in `src/indexer/fakes.ts`.
 */
import type { RawLog } from '../chain/client/index.js';
import type { Hex32 } from '../chain/config/index.js';
import type { NetworkAddress } from '../network/types.js';

export type { RawLog };

/** A JSON-RPC error (`code` as bigint), or a transport failure (timeout, connection, HTTP status). */
export type RpcError =
  | { readonly kind: 'RPC'; readonly code: bigint; readonly message: string }
  | { readonly kind: 'TRANSPORT'; readonly message: string };

export type RpcOutcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RpcError };

/** `eth_getLogs` filter: inclusive block range, emitter list, topic positions (null = any, array = OR). */
export interface LogFilter {
  readonly fromBlock: bigint;
  readonly toBlock: bigint;
  readonly addresses: readonly NetworkAddress[];
  readonly topics: readonly [Hex32, readonly Hex32[] | null, readonly Hex32[] | null];
}

/** The receipt fields the indexer reads (C-25 gas, C-53 status). */
export interface RawReceipt {
  readonly transactionHash: Hex32;
  readonly blockNumber: bigint;
  readonly blockHash: Hex32;
  /** 1n success, 0n reverted (anything else is malformed). */
  readonly status: bigint;
  readonly from: NetworkAddress;
  readonly gasUsed: bigint;
  /** Wei per gas unit, as a decimal-free bigint. */
  readonly effectiveGasPrice: bigint;
  readonly logs: readonly RawLog[];
}

export interface RpcHead {
  readonly number: bigint;
  readonly hash: Hex32;
}

export interface RpcSource {
  /** Stable name for evidence and failures (for example "own-node", "reference"). */
  readonly name: string;
  head(): Promise<RpcOutcome<RpcHead>>;
  getLogs(filter: LogFilter): Promise<RpcOutcome<readonly RawLog[]>>;
  /** null when the source has no receipt for this hash. */
  getReceipt(txHash: Hex32): Promise<RpcOutcome<RawReceipt | null>>;
}

/** Clock, sleep and jitter, injected so tests are deterministic. All in integer milliseconds. */
export interface Timing {
  now(): bigint;
  sleep(ms: bigint): Promise<void>;
  /** A uniform integer in [0, boundExclusive). */
  random(boundExclusive: bigint): bigint;
}
