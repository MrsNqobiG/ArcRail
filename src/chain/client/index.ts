/**
 * U3 Chain client (reads). Money path (RUBRIC item 6). SKELETON: interfaces and stubs only.
 *
 * Duties when implemented (KICKOFF U3, PHASE2_SLICE_PLAN): log paging in pages
 * of at most `ARC_TESTNET.getLogsMaxBlocksPerPage` blocks (C-40); split on
 * -32012 (C-40) and on the observed -32602 result cap (C-41, Q-A4); retry
 * -32014 with backoff and jitter (C-42); any unknown error → stop; dual-source
 * reads with disagreement → PAUSE (CONTRACT §1.6); stall detection (Q-A7).
 */
import type { Address, Hex32 } from '../config/index.js';

export type BlockNumber = bigint;

export interface RawLog {
  readonly address: Address;
  readonly topics: readonly Hex32[];
  readonly data: `0x${string}`;
  readonly blockNumber: BlockNumber;
  readonly blockHash: Hex32;
  readonly transactionHash: Hex32;
  readonly logIndex: bigint;
}

export interface LogQuery {
  readonly fromBlock: BlockNumber;
  readonly toBlock: BlockNumber;
  readonly address?: Address;
  readonly topic0?: Hex32;
}

/** Outcome of a read that may have to fail closed. */
export type ReadResult<T> =
  | { readonly kind: 'OK'; readonly value: T }
  | { readonly kind: 'DISAGREEMENT'; readonly detail: string }
  | { readonly kind: 'STALLED'; readonly lastHead: BlockNumber }
  | { readonly kind: 'STOP'; readonly code: number | null; readonly detail: string };

export interface ChainReader {
  readonly chainId: 5042002;
  getHead(): Promise<ReadResult<BlockNumber>>;
  getLogs(query: LogQuery): Promise<ReadResult<readonly RawLog[]>>;
}

/** Split [from, to] into inclusive pages of at most `maxBlocksPerPage` blocks (C-40). */
export function pageBlockRange(
  _from: BlockNumber,
  _to: BlockNumber,
  _maxBlocksPerPage: bigint,
): readonly LogQuery[] {
  throw new Error('not implemented: U3');
}

export function createChainReader(): ChainReader {
  throw new Error('not implemented: U3');
}
