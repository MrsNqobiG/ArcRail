/**
 * Unit NET: in-memory test support for the Arc event indexer. NOT production
 * code and not on the money path; nothing here talks to a network.
 *
 * - `InMemoryArcChain`: an `RpcSource` holding blocks, transactions and logs,
 *   with real `eth_getLogs` filter semantics, the C-40 range cap (-32012) and
 *   an optional result cap (-32602, C-41).
 * - `FaultInjectingSource`: wraps any `RpcSource` and returns scripted errors
 *   (structurally different from the chain: a queue, no state of its own).
 * - Two structurally different `IndexerStore` fakes: `MapIndexerStore`
 *   (mutable maps) and `JournalIndexerStore` (append-only journal, every read
 *   is a fold), each with the inbox (acknowledgements) and the stored halt.
 * - `ManualTiming`: a manual clock; `sleep` records the delay and advances it.
 * - Log and transaction builders for the Arc two-log ERC-20 shape (C-22, C-23).
 */
import { createHash } from 'node:crypto';
import type { Hex32 } from '../chain/config/index.js';
import type { ArcNetworkParams } from '../network/arc/params.js';
import type { ConfirmedTransfer, NetworkAddress, NetworkFailure } from '../network/types.js';
import { addressTopic } from './decode.js';
import type { LogFilter, RawLog, RawReceipt, RpcError, RpcHead, RpcOutcome, RpcSource, Timing } from './rpc.js';
import type { AckOutcome, CommitOutcome, IndexerStore, LivenessState, PageCommit } from './store.js';

/** A deterministic 32-byte hash of a label (test data only). */
export function fakeHash(label: string): Hex32 {
  return `0x${createHash('sha256').update(label, 'utf8').digest('hex')}`;
}

/** A deterministic address from a label (test data only). */
export function fakeAddress(label: string): NetworkAddress {
  return `0x${createHash('sha256').update(`addr:${label}`, 'utf8').digest('hex').slice(0, 40)}`;
}

/** A uint256 data word. */
export function word(value: bigint): `0x${string}` {
  return `0x${value.toString(16).padStart(64, '0')}`;
}

export interface ChainLog {
  readonly address: NetworkAddress;
  readonly topics: readonly Hex32[];
  readonly data: `0x${string}`;
}

export interface ChainTx {
  readonly hash: Hex32;
  /** The account that paid gas (receipt `from`). */
  readonly from: NetworkAddress;
  readonly status: bigint;
  readonly gasUsed: bigint;
  readonly effectiveGasPrice: bigint;
  readonly logs: readonly ChainLog[];
}

export function transferLog(params: ArcNetworkParams, emitter: NetworkAddress, from: NetworkAddress, to: NetworkAddress, value: bigint): ChainLog {
  return { address: emitter, topics: [params.transferTopic0, addressTopic(from), addressTopic(to)], data: word(value) };
}

const GAS_USED = 21_000n;
const GAS_PRICE = 20_000_000_000n;

/** A native USDC send: one system-emitter log at 18 dp. */
export function nativeTransferTx(params: ArcNetworkParams, label: string, from: NetworkAddress, to: NetworkAddress, wei: bigint): ChainTx {
  return { hash: fakeHash(label), from, status: 1n, gasUsed: GAS_USED, effectiveGasPrice: GAS_PRICE, logs: [transferLog(params, params.systemEmitter, from, to, wei)] };
}

/** An ERC-20 `transfer()`: the system log (18 dp) first, then the ERC-20 log (6 dp) (C-22, C-23). */
export function erc20TransferTx(params: ArcNetworkParams, label: string, from: NetworkAddress, to: NetworkAddress, units: bigint): ChainTx {
  return {
    hash: fakeHash(label),
    from,
    status: 1n,
    gasUsed: 45_000n,
    effectiveGasPrice: GAS_PRICE,
    logs: [transferLog(params, params.systemEmitter, from, to, units * 1_000_000_000_000n), transferLog(params, params.usdcErc20, from, to, units)],
  };
}

interface Block {
  readonly number: bigint;
  readonly hash: Hex32;
  readonly txs: readonly ChainTx[];
}

export interface ChainOptions {
  /** C-40: a range of more blocks than this answers -32012. */
  readonly maxRangeBlocks?: bigint;
  /** C-41: more results than this answers -32602 (null: no cap). */
  readonly resultCap?: bigint | null;
}

const ok = <T>(value: T): RpcOutcome<T> => ({ ok: true, value });
const rpcError = <T>(code: bigint, message: string): RpcOutcome<T> => ({ ok: false, error: { kind: 'RPC', code, message } });

export class InMemoryArcChain implements RpcSource {
  readonly name: string;
  private readonly blocks = new Map<bigint, Block>();
  private height = 0n;
  private readonly maxRangeBlocks: bigint;
  private readonly resultCap: bigint | null;

  constructor(name: string, options: ChainOptions = {}) {
    this.name = name;
    this.maxRangeBlocks = options.maxRangeBlocks ?? 10_000n;
    this.resultCap = options.resultCap ?? null;
    this.blocks.set(0n, { number: 0n, hash: fakeHash('arc-fake-block:0'), txs: [] });
  }

  /** Append one block holding `txs`; returns its number. */
  mine(txs: readonly ChainTx[] = [], hash?: Hex32): bigint {
    this.height += 1n;
    this.blocks.set(this.height, { number: this.height, hash: hash ?? fakeHash(`arc-fake-block:${this.height}`), txs });
    return this.height;
  }

  /** Append `count` empty blocks. */
  mineEmpty(count: bigint): bigint {
    for (let i = 0n; i < count; i += 1n) this.mine();
    return this.height;
  }

  private block(n: bigint): Block {
    return this.blocks.get(n) as Block;
  }

  private rawLogs(block: Block): RawLog[] {
    let index = 0n;
    let out: RawLog[] = [];
    for (const tx of block.txs) {
      if (tx.status !== 1n) continue;
      for (const log of tx.logs) {
        out = [...out, { ...log, blockNumber: block.number, blockHash: block.hash, transactionHash: tx.hash, logIndex: index }];
        index += 1n;
      }
    }
    return out;
  }

  async head(): Promise<RpcOutcome<RpcHead>> {
    return ok({ number: this.height, hash: this.block(this.height).hash });
  }

  async getLogs(filter: LogFilter): Promise<RpcOutcome<readonly RawLog[]>> {
    if (filter.toBlock - filter.fromBlock + 1n > this.maxRangeBlocks) return rpcError(-32012n, 'requested range too large');
    const match = (log: RawLog): boolean => {
      const [t0, t1, t2] = filter.topics;
      const at = (i: 0 | 1 | 2): string => (log.topics[i] ?? '').toLowerCase();
      return (
        filter.addresses.includes(log.address.toLowerCase() as NetworkAddress) &&
        at(0) === t0 &&
        (t1 === null || t1.includes(at(1) as Hex32)) &&
        (t2 === null || t2.includes(at(2) as Hex32))
      );
    };
    let out: RawLog[] = [];
    let count = 0n;
    for (let n = filter.fromBlock; n <= filter.toBlock && n <= this.height; n += 1n) {
      for (const log of this.rawLogs(this.block(n)).filter(match)) {
        out = [...out, log];
        count += 1n;
      }
    }
    if (this.resultCap !== null && count > this.resultCap) return rpcError(-32602n, `query exceeds max results ${this.resultCap}`);
    return ok(out);
  }

  async getReceipt(txHash: Hex32): Promise<RpcOutcome<RawReceipt | null>> {
    for (const block of this.blocks.values()) {
      const tx = block.txs.find((t) => t.hash === txHash.toLowerCase());
      if (tx !== undefined) {
        return ok({
          transactionHash: tx.hash,
          blockNumber: block.number,
          blockHash: block.hash,
          status: tx.status,
          from: tx.from,
          gasUsed: tx.gasUsed,
          effectiveGasPrice: tx.effectiveGasPrice,
          logs: this.rawLogs(block).filter((l) => l.transactionHash === tx.hash),
        });
      }
    }
    return ok(null);
  }
}

type Method = 'head' | 'getLogs' | 'getReceipt';

/** Wraps a source; `failNext` queues errors returned (in order) before the real answer. Records every getLogs range. */
export class FaultInjectingSource implements RpcSource {
  readonly name: string;
  private readonly queues = new Map<Method, readonly RpcError[]>();
  private ranges: readonly (readonly [bigint, bigint])[] = [];
  private readonly inner: RpcSource;

  constructor(inner: RpcSource, name = inner.name) {
    this.inner = inner;
    this.name = name;
  }

  failNext(method: Method, error: RpcError, times = 1n): this {
    let queue = this.queues.get(method) ?? [];
    for (let i = 0n; i < times; i += 1n) queue = [...queue, error];
    this.queues.set(method, queue);
    return this;
  }

  /** Every [fromBlock, toBlock] passed to getLogs, in call order. */
  get logRanges(): readonly (readonly [bigint, bigint])[] {
    return this.ranges;
  }

  private take(method: Method): RpcError | undefined {
    const [first, ...rest] = this.queues.get(method) ?? [];
    this.queues.set(method, rest);
    return first;
  }

  async head(): Promise<RpcOutcome<RpcHead>> {
    const e = this.take('head');
    return e === undefined ? this.inner.head() : { ok: false, error: e };
  }

  async getLogs(filter: LogFilter): Promise<RpcOutcome<readonly RawLog[]>> {
    this.ranges = [...this.ranges, [filter.fromBlock, filter.toBlock]];
    const e = this.take('getLogs');
    return e === undefined ? this.inner.getLogs(filter) : { ok: false, error: e };
  }

  async getReceipt(txHash: Hex32): Promise<RpcOutcome<RawReceipt | null>> {
    const e = this.take('getReceipt');
    return e === undefined ? this.inner.getReceipt(txHash) : { ok: false, error: e };
  }
}

/** Shared refusal rules of both store fakes: cursor expectations first, then digest conflicts. Null: the commit may apply. */
function check(commit: PageCommit, cursorOf: (key: string) => bigint | null, digestOf: (key: string) => string | undefined): CommitOutcome | null {
  for (const move of commit.cursors) {
    const actual = cursorOf(move.cursorKey);
    if (actual !== move.expected) return { kind: 'CURSOR_CONFLICT', cursorKey: move.cursorKey, expected: move.expected, actual };
  }
  const batch = new Map<string, string>();
  for (const t of commit.transfers) {
    const stored = digestOf(t.dedupeKey) ?? batch.get(t.dedupeKey);
    if (stored !== undefined && stored !== t.payloadDigest) return { kind: 'SIGNAL_CONFLICT', key: t.dedupeKey };
    batch.set(t.dedupeKey, t.payloadDigest);
  }
  return null;
}

interface InboxRow {
  readonly stream: string;
  readonly transfer: ConfirmedTransfer;
  acked: boolean;
}

/** Fake A: mutable maps (cursor per key, inbox row per dedupe key, halt per stream). */
export class MapIndexerStore implements IndexerStore {
  private readonly cursors = new Map<string, bigint>();
  private readonly inbox = new Map<string, InboxRow>();
  private readonly halts = new Map<string, NetworkFailure>();
  private readonly resumes: (readonly [string, string])[] = [];
  private readonly liveness = new Map<string, LivenessState>();

  async loadCursor(cursorKey: string): Promise<bigint | null> {
    return this.cursors.get(cursorKey) ?? null;
  }

  async commitPage(commit: PageCommit): Promise<CommitOutcome> {
    const refused = check(commit, (k) => this.cursors.get(k) ?? null, (k) => this.inbox.get(k)?.transfer.payloadDigest);
    if (refused !== null) return refused;
    let inserted: readonly string[] = [];
    for (const t of commit.transfers) {
      if (this.inbox.has(t.dedupeKey)) continue;
      this.inbox.set(t.dedupeKey, { stream: commit.streamKey, transfer: t, acked: false });
      inserted = [...inserted, t.dedupeKey];
    }
    for (const move of commit.cursors) this.cursors.set(move.cursorKey, move.next);
    return { kind: 'COMMITTED', inserted };
  }

  async unacknowledged(streamKey: string): Promise<readonly ConfirmedTransfer[]> {
    return [...this.inbox.values()].filter((r) => r.stream === streamKey && !r.acked).map((r) => r.transfer);
  }

  async acknowledge(streamKey: string, keys: readonly string[]): Promise<AckOutcome> {
    const unknown = keys.find((k) => this.inbox.get(k)?.stream !== streamKey);
    if (unknown !== undefined) return { kind: 'UNKNOWN_KEY', key: unknown };
    for (const k of keys) (this.inbox.get(k) as InboxRow).acked = true;
    return { kind: 'ACKED' };
  }

  async loadHalt(streamKey: string): Promise<NetworkFailure | null> {
    return this.halts.get(streamKey) ?? null;
  }

  async recordHalt(streamKey: string, failure: NetworkFailure): Promise<void> {
    if (!this.halts.has(streamKey)) this.halts.set(streamKey, failure);
  }

  async clearHalt(streamKey: string, approvers: readonly [string, string]): Promise<void> {
    this.halts.delete(streamKey);
    this.resumes.push(approvers);
  }

  async loadLiveness(streamKey: string): Promise<LivenessState | null> {
    return this.liveness.get(streamKey) ?? null;
  }

  async saveLiveness(streamKey: string, state: LivenessState | null): Promise<void> {
    if (state === null) this.liveness.delete(streamKey);
    else this.liveness.set(streamKey, state);
  }

  /** Every stored inbox key (test inspection). */
  keys(): readonly string[] {
    return [...this.inbox.keys()];
  }

  /** Every recorded resume's approvers (test inspection). */
  get resumedBy(): readonly (readonly [string, string])[] {
    return this.resumes;
  }
}

type JournalEntry =
  | { readonly kind: 'cursor'; readonly key: string; readonly value: bigint }
  | { readonly kind: 'signal'; readonly stream: string; readonly transfer: ConfirmedTransfer }
  | { readonly kind: 'ack'; readonly key: string }
  | { readonly kind: 'halt'; readonly stream: string; readonly failure: NetworkFailure }
  | { readonly kind: 'resume'; readonly stream: string; readonly approvers: readonly [string, string] }
  | { readonly kind: 'liveness'; readonly stream: string; readonly state: LivenessState | null };

/** Fake B: an append-only journal; cursors, inbox, acknowledgements and halts are folds over it. */
export class JournalIndexerStore implements IndexerStore {
  private journal: readonly JournalEntry[] = [];

  private cursorOf(cursorKey: string): bigint | null {
    let value: bigint | null = null;
    for (const e of this.journal) if (e.kind === 'cursor' && e.key === cursorKey) value = e.value;
    return value;
  }

  private signalOf(key: string): { readonly stream: string; readonly transfer: ConfirmedTransfer } | undefined {
    for (const e of this.journal) if (e.kind === 'signal' && e.transfer.dedupeKey === key) return e;
    return undefined;
  }

  private haltOf(streamKey: string): NetworkFailure | null {
    let halt: NetworkFailure | null = null;
    for (const e of this.journal) {
      if (e.kind === 'halt' && e.stream === streamKey && halt === null) halt = e.failure;
      if (e.kind === 'resume' && e.stream === streamKey) halt = null;
    }
    return halt;
  }

  async loadCursor(cursorKey: string): Promise<bigint | null> {
    return this.cursorOf(cursorKey);
  }

  async commitPage(commit: PageCommit): Promise<CommitOutcome> {
    const refused = check(commit, (k) => this.cursorOf(k), (k) => this.signalOf(k)?.transfer.payloadDigest);
    if (refused !== null) return refused;
    let entries: readonly JournalEntry[] = [];
    let inserted: readonly string[] = [];
    for (const t of commit.transfers) {
      if (this.signalOf(t.dedupeKey) !== undefined || inserted.includes(t.dedupeKey)) continue;
      entries = [...entries, { kind: 'signal', stream: commit.streamKey, transfer: t }];
      inserted = [...inserted, t.dedupeKey];
    }
    const moves: readonly JournalEntry[] = commit.cursors.map((m) => ({ kind: 'cursor', key: m.cursorKey, value: m.next }));
    this.journal = [...this.journal, ...entries, ...moves];
    return { kind: 'COMMITTED', inserted };
  }

  async unacknowledged(streamKey: string): Promise<readonly ConfirmedTransfer[]> {
    const acked = new Set(this.journal.flatMap((e) => (e.kind === 'ack' ? [e.key] : [])));
    return this.journal.flatMap((e) => (e.kind === 'signal' && e.stream === streamKey && !acked.has(e.transfer.dedupeKey) ? [e.transfer] : []));
  }

  async acknowledge(streamKey: string, keys: readonly string[]): Promise<AckOutcome> {
    for (const key of keys) if (this.signalOf(key)?.stream !== streamKey) return { kind: 'UNKNOWN_KEY', key };
    this.journal = [...this.journal, ...keys.map((key): JournalEntry => ({ kind: 'ack', key }))];
    return { kind: 'ACKED' };
  }

  async loadHalt(streamKey: string): Promise<NetworkFailure | null> {
    return this.haltOf(streamKey);
  }

  async recordHalt(streamKey: string, failure: NetworkFailure): Promise<void> {
    this.journal = [...this.journal, { kind: 'halt', stream: streamKey, failure }];
  }

  async clearHalt(streamKey: string, approvers: readonly [string, string]): Promise<void> {
    this.journal = [...this.journal, { kind: 'resume', stream: streamKey, approvers }];
  }

  async loadLiveness(streamKey: string): Promise<LivenessState | null> {
    let state: LivenessState | null = null;
    for (const e of this.journal) if (e.kind === 'liveness' && e.stream === streamKey) state = e.state;
    return state;
  }

  async saveLiveness(streamKey: string, state: LivenessState | null): Promise<void> {
    this.journal = [...this.journal, { kind: 'liveness', stream: streamKey, state }];
  }

  /** Every stored inbox key (test inspection). */
  keys(): readonly string[] {
    return this.journal.flatMap((e) => (e.kind === 'signal' ? [e.transfer.dedupeKey] : []));
  }

  /** Every recorded resume's approvers (test inspection). */
  get resumedBy(): readonly (readonly [string, string])[] {
    return this.journal.flatMap((e) => (e.kind === 'resume' ? [e.approvers] : []));
  }
}

/** A manual clock. `sleep` records the delay and advances the clock; `random` returns the scripted values, then 0. */
export class ManualTiming implements Timing {
  private nowMs: bigint;
  private sleeps: readonly bigint[] = [];
  private randoms: readonly bigint[];
  private bounds: readonly bigint[] = [];

  constructor(startMs = 1_000_000n, randoms: readonly bigint[] = []) {
    this.nowMs = startMs;
    this.randoms = randoms;
  }

  now(): bigint {
    return this.nowMs;
  }

  advance(ms: bigint): void {
    this.nowMs += ms;
  }

  async sleep(ms: bigint): Promise<void> {
    this.sleeps = [...this.sleeps, ms];
    this.nowMs += ms;
  }

  random(boundExclusive: bigint): bigint {
    this.bounds = [...this.bounds, boundExclusive];
    const [next, ...rest] = this.randoms;
    this.randoms = rest;
    return next ?? 0n;
  }

  get slept(): readonly bigint[] {
    return this.sleeps;
  }

  get randomBounds(): readonly bigint[] {
    return this.bounds;
  }
}
