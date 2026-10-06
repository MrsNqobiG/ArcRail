/**
 * U4 Ingestion. Money path (RUBRIC item 2: classification, dedupe, canonical source).
 * SKELETON: types and stubs only.
 *
 * Canonical credit source: the system-emitter Transfer log (C-20, 18 dp).
 * The ERC-20 log (C-12, 6 dp) is stored for cross-check only (C-22).
 * Dedupe on (chainId, txHash, logIndex). Attribution uses the log's `from` (C-27).
 * Classification follows CONTRACT §5.0.
 */
import type { NativeWei, UsdcUnits } from '../amounts/index.js';
import type { Address, Hex32 } from '../chain/config/index.js';
import type { RawLog } from '../chain/client/index.js';

/** Dedupe identity of a log (CONTRACT §1.2 subject `["in",chainId,txHash,logIndex]`). */
export interface LogId {
  readonly chainId: '5042002';
  readonly txHash: Hex32;
  readonly logIndex: string;
}

export interface CanonicalTransfer {
  readonly id: LogId;
  readonly blockNumber: bigint;
  readonly from: Address;
  readonly to: Address;
  readonly valueWei: NativeWei;
}

export interface Erc20CrossCheck {
  readonly id: LogId;
  readonly from: Address;
  readonly to: Address;
  readonly valueUnits: UsdcUnits;
}

/** CONTRACT §5.0 rules 1–4. */
export type LogClass = 'INTERNAL' | 'OUTBOUND' | 'INBOUND' | 'NOT_OURS';

export type IngestDecision =
  | { readonly kind: 'CREDIT_CANDIDATE'; readonly transfer: CanonicalTransfer; readonly logClass: LogClass }
  | { readonly kind: 'CROSS_CHECK_ONLY'; readonly record: Erc20CrossCheck }
  | { readonly kind: 'DUPLICATE'; readonly id: LogId }
  | { readonly kind: 'QUARANTINE'; readonly reason: 'UNKNOWN_EVENT' | 'SCHEMA'; readonly id: LogId };

export interface Ingestor {
  ingest(log: RawLog): Promise<IngestDecision>;
}

export function decodeLog(_log: RawLog): IngestDecision {
  throw new Error('not implemented: U4');
}

export function createIngestor(): Ingestor {
  throw new Error('not implemented: U4');
}
