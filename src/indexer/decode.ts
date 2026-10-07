/**
 * Unit NET: decoding and checking Arc `Transfer` logs (§6.1).
 *
 * - Canonical: `Transfer(address,address,uint256)` (topic0, C-21) from the
 *   system emitter (C-20) at 18 dp (C-10). Credit and confirmation use this
 *   log only (C-15, C-22). `from`/`to` come from the topics (C-27).
 * - Cross-check only: the ERC-20 `Transfer` from the USDC contract (C-12,
 *   6 dp, C-11) in the same transaction. Each one must pair with a canonical
 *   log of the same tx, `from` and `to` whose value equals its units × 10¹²
 *   exactly (U1 `usdcUnitsToNativeWei`); otherwise UNKNOWN_EVENT. A
 *   canonical log without an ERC-20 partner is valid (native sends, C-15).
 * - Anything else in a fetched set (another emitter, another topic0, a
 *   malformed topic or data word) is UNKNOWN_EVENT. Nothing is skipped.
 */
import { createHash } from 'node:crypto';
import { nativeWei, usdcUnits, usdcUnitsToNativeWei } from '../amounts/index.js';
import type { NativeWei, UsdcUnits } from '../amounts/index.js';
import type { Hex32 } from '../chain/config/index.js';
import { toHex32, toNetworkAddress, transferDedupeKey } from '../network/types.js';
import type { ConfirmedTransfer, NetworkAddress, TxGas } from '../network/types.js';
import type { ArcNetworkParams } from '../network/arc/params.js';
import type { RawLog } from './rpc.js';

const ADDRESS_TOPIC_RE = /^0x0{24}([0-9a-f]{40})$/;
const WORD_RE = /^0x[0-9a-f]{64}$/;

/** An address as an indexed topic: left-padded to 32 bytes, lower-case. */
export function addressTopic(address: NetworkAddress): Hex32 {
  return `0x${'0'.repeat(24)}${address.slice(2).toLowerCase()}`;
}

/** An indexed address topic back to an address; null unless the 12 padding bytes are zero. */
export function topicAddress(topic: string): NetworkAddress | null {
  const m = ADDRESS_TOPIC_RE.exec(topic.toLowerCase());
  return m === null ? null : `0x${m[1] as string}`;
}

/** A single 32-byte data word as an unsigned integer; null for any other length. */
export function dataWord(data: string): bigint | null {
  const lower = data.toLowerCase();
  return WORD_RE.test(lower) ? BigInt(lower) : null;
}

interface LogPosition {
  readonly txHash: Hex32;
  readonly logIndex: bigint;
  readonly blockNumber: bigint;
  readonly blockHash: Hex32;
  readonly from: NetworkAddress;
  readonly to: NetworkAddress;
}

export interface CanonicalLog extends LogPosition {
  readonly kind: 'CANONICAL';
  readonly value: NativeWei;
}

export interface Erc20Log extends LogPosition {
  readonly kind: 'ERC20';
  readonly units: UsdcUnits;
}

export interface UnknownLog {
  readonly kind: 'UNKNOWN';
  readonly txHash: Hex32;
  readonly logIndex: bigint;
  readonly detail: string;
}

export type DecodedLog = CanonicalLog | Erc20Log | UnknownLog;

/** Decode one log against the Arc parameters. Never throws; anything unexpected is UNKNOWN. */
export function decodeLog(log: RawLog, params: ArcNetworkParams): DecodedLog {
  const txHash = toHex32(log.transactionHash) ?? log.transactionHash;
  const unknown = (detail: string): UnknownLog => ({ kind: 'UNKNOWN', txHash, logIndex: log.logIndex, detail });
  const emitter = log.address.toLowerCase();
  const isCanonical = emitter === params.systemEmitter;
  if (!isCanonical && emitter !== params.usdcErc20) return unknown(`unexpected emitter ${emitter}`);
  const blockHash = toHex32(log.blockHash);
  if (toHex32(log.transactionHash) === null || blockHash === null) return unknown('malformed transaction or block hash');
  const [topic0, t1, t2, ...extra] = log.topics;
  if (topic0 === undefined || topic0.toLowerCase() !== params.transferTopic0) return unknown('not a Transfer log');
  if (extra.length > 0) return unknown('unexpected extra topics');
  const from = t1 === undefined ? null : topicAddress(t1);
  const to = t2 === undefined ? null : topicAddress(t2);
  if (from === null || to === null) return unknown('malformed address topic');
  const word = dataWord(log.data);
  if (word === null) return unknown('malformed value word');
  const pos: LogPosition = { txHash, logIndex: log.logIndex, blockNumber: log.blockNumber, blockHash, from, to };
  return isCanonical ? { ...pos, kind: 'CANONICAL', value: nativeWei(word) } : { ...pos, kind: 'ERC20', units: usdcUnits(word) };
}

/**
 * Pair every ERC-20 log with one canonical log of the same transaction, `from`
 * and `to` and an exactly equal value. Returns the first unpaired ERC-20 log,
 * or null when all pair.
 */
export function unpairedErc20(canonical: readonly CanonicalLog[], erc20: readonly Erc20Log[]): Erc20Log | null {
  const used = new Set<string>();
  for (const e of erc20) {
    const wei = usdcUnitsToNativeWei(e.units);
    const partner = canonical.find(
      (c) => !used.has(`${c.txHash}:${c.logIndex}`) && c.txHash === e.txHash && c.from === e.from && c.to === e.to && c.value === wei,
    );
    if (partner === undefined) return e;
    used.add(`${partner.txHash}:${partner.logIndex}`);
  }
  return null;
}

/** sha256 hex over the §10.3 projection of an Arc log: keys sorted, values as strings, no whitespace. */
export function transferDigest(chainId: bigint, log: CanonicalLog): string {
  const projection = JSON.stringify({
    blockHash: log.blockHash,
    chainId: chainId.toString(10),
    from: log.from,
    logIndex: log.logIndex.toString(10),
    status: '1',
    to: log.to,
    txHash: log.txHash,
    value: log.value.toString(10),
  });
  return createHash('sha256').update(projection, 'utf8').digest('hex');
}

/** Build the confirmed transfer for a canonical log of a successful transaction. */
export function toConfirmedTransfer(chainId: bigint, log: CanonicalLog, gas: TxGas, sources: 1n | 2n): ConfirmedTransfer {
  return {
    network: 'ARC',
    chainId,
    txHash: log.txHash,
    logIndex: log.logIndex,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    from: log.from,
    to: log.to,
    amount: log.value,
    receiptStatus: 1n,
    gas,
    sources,
    dedupeKey: transferDedupeKey('ARC', chainId, log.txHash, log.logIndex),
    payloadDigest: transferDigest(chainId, log),
  };
}

/** Gas facts from a receipt; null when the payer address or the gas price is malformed. */
export function receiptGas(from: string, gasUsed: bigint, effectiveGasPrice: bigint): TxGas | null {
  const payer = toNetworkAddress(from);
  if (payer === null || gasUsed < 0n || effectiveGasPrice < 0n) return null;
  return { payer, gasUsed, effectiveGasPrice };
}
