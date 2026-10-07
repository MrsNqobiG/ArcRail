/**
 * Unit NET: the Arc event indexer (NOVA_ARC_DESIGN §6). Canonical source of
 * truth for the chain: DFNS indexes Arc only after a 10-block delay
 * (DF:networks), so DFNS events are a cross-check, never the evidence.
 *
 * Per poll:
 * 1. Heads from every source (with -32014 retry, C-42). A source whose head
 *    changes hash at the same height, or falls more than
 *    `headRegressionToleranceBlocks` below the highest head it reported, is
 *    stopped (no reorgs on Arc, C-50). A smaller fall is a load-balanced
 *    backend behind the last one (C-42, rpc-endpoints.md line 119): it only
 *    lowers the agreed head. If no source's head has advanced for
 *    `stallAfterMs` → CHAIN_STALL (§6.6). If one source's head has not
 *    advanced for `stallAfterMs` while another's has → SOURCE_LAGGING for it
 *    (a frozen source would otherwise silently stop confirmations, since the
 *    indexable head is the LOWEST head minus `confirmations`, §6.5 rule 4).
 *    The liveness state is stored with the stream, so restarts do not reset
 *    the stall clock; a resume resets it.
 * 2. Each address has its own cursor (m7). Addresses are grouped by their
 *    next block; the lowest group is indexed up to the next group's start, so
 *    a newly added address is scanned from `startBlock`, and groups merge as
 *    they catch up. Pages are ≤ `maxBlocksPerPage` blocks (C-40). Per page and
 *    per source, two filtered queries over both emitters (system C-20 and
 *    ERC-20 C-12): `topic1 ∈ group` (outbound) and `topic2 ∈ group`
 *    (inbound); an INTERNAL log appears in both and is kept once.
 * 3. The sources must return the same logs (same tx, index, block hash,
 *    emitter, topics and data); any difference → RPC_DISAGREEMENT (§6.3).
 * 4. Every log is decoded; anything unexpected → UNKNOWN_EVENT. ERC-20 logs
 *    must pair with a canonical log (two-log transfer, C-22); only canonical
 *    logs become transfers, so one ERC-20 transfer yields ONE credit.
 * 5. One receipt per transaction from every source; they must agree, be the
 *    receipt of that transaction (its hash and every log's), match the log's
 *    block, have status 1, and contain the credited canonical log itself.
 *    In `confirmTx`, a receipt missing from a source whose head is still
 *    below the receipt's block is "not yet confirmed" (OK null), not a
 *    disagreement: that source cannot have it yet. In `poll`, every source
 *    served the log, so a missing receipt is a load-balanced backend that has
 *    not imported the block (C-42): retried with backoff, then SOURCE_LAGGING.
 * 6. Transfers and the cursor advances are committed atomically per page
 *    (§6.4) into the inbox. Poll returns every committed transfer not yet
 *    acknowledged (`ack`), so a failure after a committed page loses nothing.
 *
 * Fail closed. RPC_DISAGREEMENT, UNKNOWN_EVENT, RANGE_UNRECOVERABLE,
 * SOURCE_STOPPED and CURSOR_CONFLICT halt the indexer: the halt is stored with
 * the stream (so a restart or a second instance sees it), every later call
 * returns the same failure (the cursors stay frozen at the last agreed block)
 * until `resume` is called with two distinct approvers (CLAUDE.md "Fail
 * closed"). The approvers are recorded but not authenticated here; the caller
 * passes identities its operator channel has authenticated (CF-26).
 * CHAIN_STALL and SOURCE_LAGGING are reported but clear by themselves when
 * the sources move again.
 */
import type { Hex32 } from '../chain/config/index.js';
import { checkApprovers, pollAddresses } from '../network/types.js';
import type { AckResult, ConfirmedTransfer, NetworkAddress, NetworkFailure, NetworkHead, NetworkRead, TxConfirmation } from '../network/types.js';
import type { ArcNetworkParams } from '../network/arc/params.js';
import { addressTopic, decodeLog, receiptGas, toConfirmedTransfer, unpairedErc20 } from './decode.js';
import type { CanonicalLog, Erc20Log } from './decode.js';
import { backoffDelay, fetchLogs, pageRange, sourceFailure, withRetry } from './fetch.js';
import type { FetchParams } from './fetch.js';
import type { LogFilter, RawLog, RawReceipt, RpcSource, Timing } from './rpc.js';
import type { CursorMove, IndexerStore, LivenessState, SourceHeadState } from './store.js';

type Step<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: NetworkFailure };

/** One receipt read across every source (see `readReceipt`). */
type ReceiptRead =
  | { readonly kind: 'ALL'; readonly receipt: RawReceipt }
  | { readonly kind: 'MISSING'; readonly receipt: RawReceipt | null; readonly missing: readonly RpcSource[] };

const STICKY: ReadonlySet<NetworkFailure['kind']> = new Set(['RPC_DISAGREEMENT', 'UNKNOWN_EVENT', 'RANGE_UNRECOVERABLE', 'SOURCE_STOPPED', 'CURSOR_CONFLICT']);

const fail = <T>(failure: NetworkFailure): Step<T> => ({ ok: false, failure });
const disagree = <T>(detail: string): Step<T> => fail({ kind: 'RPC_DISAGREEMENT', detail });

const text = (x: string | bigint): string => `${x}`.toLowerCase();

/** A log's full content as one comparable string (§6.3: same set, same block hash). JSON keeps field boundaries (m9). */
function logFingerprint(log: RawLog): string {
  return JSON.stringify([
    text(log.transactionHash),
    text(log.logIndex),
    text(log.blockNumber),
    text(log.blockHash),
    text(log.address),
    log.topics.map(text),
    text(log.data),
  ]);
}

function receiptFingerprint(r: RawReceipt): string {
  return JSON.stringify([
    text(r.transactionHash),
    text(r.blockNumber),
    text(r.blockHash),
    text(r.status),
    text(r.from),
    text(r.gasUsed),
    text(r.effectiveGasPrice),
    r.logs.map(logFingerprint),
  ]);
}

const logKey = (log: RawLog): string => `${log.transactionHash.toLowerCase()}:${log.logIndex}`;

/** Logs keyed by (txHash, logIndex), in first-seen order; a key seen twice with different content is an error. */
function mergeLogs(groups: readonly (readonly RawLog[])[]): Map<string, RawLog> | string {
  const merged = new Map<string, RawLog>();
  for (const log of groups.flat()) {
    const seen = merged.get(logKey(log));
    if (seen !== undefined && logFingerprint(seen) !== logFingerprint(log)) return `two different logs at ${logKey(log)}`;
    merged.set(logKey(log), log);
  }
  return merged;
}

/** Ascending by (blockNumber, logIndex). Insertion by partition: no number-valued comparator. */
function inChainOrder<T extends { readonly blockNumber: bigint; readonly logIndex: bigint }>(items: Iterable<T>): T[] {
  const before = (a: T, b: T): boolean => a.blockNumber < b.blockNumber || (a.blockNumber === b.blockNumber && a.logIndex < b.logIndex);
  let sorted: T[] = [];
  for (const x of items) sorted = [...sorted.filter((y) => !before(x, y)), x, ...sorted.filter((y) => before(x, y))];
  return sorted;
}

export interface ArcIndexerDeps {
  readonly params: ArcNetworkParams;
  /** Two distinct sources with distinct names; one only under `singleSourceTestnetOnly` (§6.3). */
  readonly sources: readonly RpcSource[];
  readonly store: IndexerStore;
  readonly timing: Timing;
}

/** One read of every source's head: the agreed (lowest) head, each source's head now, and the updated liveness state. */
interface HeadRead {
  readonly head: NetworkHead;
  readonly bySource: ReadonlyMap<RpcSource, bigint>;
  readonly liveness: LivenessState;
}

/** The smallest of `start` and every element of `xs`. */
export function lowest(xs: readonly bigint[], start: bigint): bigint {
  let low = start;
  for (const x of xs) if (x < low) low = x;
  return low;
}

export class ArcIndexer {
  /** Inbox and halt stream: one per (chainId, emitter) (§6.4). */
  readonly streamKey: string;
  private readonly params: ArcNetworkParams;
  private readonly sources: readonly RpcSource[];
  private readonly store: IndexerStore;
  private readonly timing: Timing;
  private readonly fetchParams: FetchParams;
  private readonly sourceCount: 1n | 2n;

  constructor(deps: ArcIndexerDeps) {
    const { params, sources } = deps;
    if (params.chainId !== 5042002n || params.dfnsNetwork !== 'ArcTestnet') {
      throw new RangeError('the Arc indexer runs on Arc testnet only (C-01, DF:networks ArcTestnet)');
    }
    const single = sources.length === 1;
    if (!(single && params.singleSourceTestnetOnly) && sources.length !== 2) {
      throw new RangeError('two independent sources are required; one only with singleSourceTestnetOnly (§6.3)');
    }
    const [first, second] = sources;
    if (second !== undefined && (first === second || (first as RpcSource).name === second.name)) {
      throw new RangeError('the two sources must be distinct, with distinct names (§6.3)');
    }
    this.params = params;
    this.sources = sources;
    this.store = deps.store;
    this.timing = deps.timing;
    let count: 1n | 2n = 2n;
    if (single) count = 1n;
    this.sourceCount = count;
    this.streamKey = `arc:${params.chainId}:${params.systemEmitter}`;
    this.fetchParams = { retry: params.retry, headLagCode: params.headLagCode, splitCodes: [params.rangeTooLargeCode, params.resultCapCode] };
  }

  /** The cursor of one address (m7): `<streamKey>:<address>`, lower-case. */
  cursorKeyOf(address: NetworkAddress): string {
    return `${this.streamKey}:${address.toLowerCase()}`;
  }

  /** The stored sticky failure, or null. */
  halt(): Promise<NetworkFailure | null> {
    return this.store.loadHalt(this.streamKey);
  }

  /**
   * Clear the stored halt: two distinct approvers (CLAUDE.md "Fail closed"),
   * recorded in the store. The stored liveness state is reset too, so heads
   * recorded before the halt cannot halt the indexer again by themselves.
   */
  async resume(approverA: string, approverB: string): Promise<void> {
    const approvers = checkApprovers(approverA, approverB);
    if ((await this.store.loadHalt(this.streamKey)) === null) throw new RangeError('the indexer is not halted');
    await this.store.clearHalt(this.streamKey, approvers);
    await this.store.saveLiveness(this.streamKey, null);
  }

  /** Committed transfers not yet acknowledged, in commit order. Reads no source; works while halted. */
  pending(): Promise<readonly ConfirmedTransfer[]> {
    return this.store.unacknowledged(this.streamKey);
  }

  /** Acknowledge processed transfers (all or none). */
  ack(dedupeKeys: readonly string[]): Promise<AckResult> {
    return this.store.acknowledge(this.streamKey, dedupeKeys);
  }

  private async run<T>(body: () => Promise<Step<T>>): Promise<NetworkRead<T>> {
    const halted = await this.store.loadHalt(this.streamKey);
    if (halted !== null) return { kind: 'FAILED', failure: halted };
    const step = await body();
    if (step.ok) return { kind: 'OK', value: step.value };
    if (STICKY.has(step.failure.kind)) await this.store.recordHalt(this.streamKey, step.failure);
    return { kind: 'FAILED', failure: step.failure };
  }

  /**
   * Every source's head; the agreed head is the lowest. Same height with
   * different hashes across sources → disagreement. One source changing hash
   * at the height it last reported, or falling more than the tolerance below
   * it → that source is stopped. The liveness state is read from and written
   * back to the store.
   */
  private async readHeads(): Promise<Step<HeadRead>> {
    const stored = await this.store.loadLiveness(this.streamKey);
    const known = new Map<string, SourceHeadState>();
    if (stored !== null) for (const h of stored.sources) known.set(h.source, h);
    let read: readonly (readonly [RpcSource, NetworkHead])[] = [];
    for (const source of this.sources) {
      const r = await withRetry(() => source.head(), this.params.retry, this.params.headLagCode, this.timing);
      if (r.kind !== 'OK') return fail(sourceFailure(source.name, r));
      const h = { number: r.value.number, hash: r.value.hash.toLowerCase() as Hex32 };
      const prev = known.get(source.name);
      if (prev !== undefined && (prev.number - h.number > this.params.headRegressionToleranceBlocks || (h.number === prev.number && h.hash !== prev.hash))) {
        return fail({ kind: 'SOURCE_STOPPED', source: source.name, code: null, detail: `head moved from ${prev.number} ${prev.hash} to ${h.number} ${h.hash}` });
      }
      read = [...read, [source, h]];
    }
    let low: NetworkHead | null = null;
    let high = -1n;
    for (const [, h] of read) {
      if (low !== null && low.number === h.number && low.hash !== h.hash) return disagree(`block ${h.number} has two hashes`);
      if (low === null || h.number < low.number) low = h;
      if (h.number > high) high = h.number;
    }
    const now = this.timing.now();
    const sources = read.map(([source, h]): SourceHeadState => {
      const prev = known.get(source.name);
      return prev === undefined || h.number > prev.number ? { source: source.name, number: h.number, hash: h.hash, sinceMs: now } : prev;
    });
    let lastHead = -1n;
    let lastAdvanceMs = now;
    if (stored !== null) ({ lastHead, lastAdvanceMs } = stored);
    if (high > lastHead) {
      lastHead = high;
      lastAdvanceMs = now;
    }
    const liveness: LivenessState = { lastHead, lastAdvanceMs, sources };
    await this.store.saveLiveness(this.streamKey, liveness);
    return { ok: true, value: { head: low as NetworkHead, bySource: new Map(read.map(([source, h]) => [source, h.number])), liveness } };
  }

  /** §6.6 stall (no source advanced), then lag (this source did not advance while another did). */
  private liveness(state: LivenessState): NetworkFailure | null {
    const now = this.timing.now();
    const since = now - state.lastAdvanceMs;
    if (since >= this.params.stallAfterMs) return { kind: 'CHAIN_STALL', lastHead: state.lastHead, sinceMs: since };
    for (const h of state.sources) {
      const lag = now - h.sinceMs;
      if (lag >= this.params.stallAfterMs) {
        return { kind: 'SOURCE_LAGGING', source: h.source, detail: `head ${h.number} has not advanced for ${lag} ms while another source advanced` };
      }
    }
    return null;
  }

  /** Liveness (§6.6): the agreed head, or CHAIN_STALL / SOURCE_LAGGING. */
  head(): Promise<NetworkRead<NetworkHead>> {
    return this.run(async () => {
      const heads = await this.readHeads();
      if (!heads.ok) return heads;
      const dead = this.liveness(heads.value.liveness);
      return dead === null ? { ok: true, value: heads.value.head } : fail(dead);
    });
  }

  /** Pull and commit every page between each address's cursor and the indexable head; return the unacknowledged inbox. */
  poll(addresses: ReadonlySet<NetworkAddress>): Promise<NetworkRead<readonly ConfirmedTransfer[]>> {
    return this.run(async () => {
      const ours = pollAddresses(addresses);
      if ('kind' in ours) return fail(ours);
      const heads = await this.readHeads();
      if (!heads.ok) return heads;
      const dead = this.liveness(heads.value.liveness);
      if (dead !== null) return fail(dead);
      const cursors = new Map<NetworkAddress, bigint | null>();
      for (const a of ours) cursors.set(a, await this.store.loadCursor(this.cursorKeyOf(a)));
      const nextOf = (a: NetworkAddress): bigint => {
        const c = cursors.get(a) as bigint | null;
        return c === null ? this.params.startBlock : c + 1n;
      };
      const last = heads.value.head.number - this.params.confirmations;
      for (;;) {
        const behind = ours.filter((a) => nextOf(a) <= last);
        const [firstBehind] = behind;
        if (firstBehind === undefined) break;
        const low = lowest(behind.map(nextOf), nextOf(firstBehind));
        const group = behind.filter((a) => nextOf(a) === low);
        const upper = lowest(behind.filter((a) => nextOf(a) !== low).map((a) => nextOf(a) - 1n), last);
        for (const page of pageRange(low, upper, this.params.maxBlocksPerPage)) {
          const indexed = await this.indexPage(page.from, page.to, group);
          if (!indexed.ok) return indexed;
          const moves: readonly CursorMove[] = group.map((a) => ({ cursorKey: this.cursorKeyOf(a), expected: cursors.get(a) as bigint | null, next: page.to }));
          const outcome = await this.store.commitPage({ streamKey: this.streamKey, cursors: moves, transfers: indexed.value });
          if (outcome.kind === 'CURSOR_CONFLICT') return fail({ kind: 'CURSOR_CONFLICT', expected: outcome.expected, actual: outcome.actual });
          if (outcome.kind === 'SIGNAL_CONFLICT') return disagree(`stored signal ${outcome.key} differs from the chain`);
          for (const a of group) cursors.set(a, page.to);
        }
      }
      return { ok: true, value: await this.store.unacknowledged(this.streamKey) };
    });
  }

  /** One page: fetch from every source, compare, decode, cross-check, read receipts. */
  private async indexPage(from: bigint, to: bigint, ours: readonly NetworkAddress[]): Promise<Step<readonly ConfirmedTransfer[]>> {
    const topics = ours.map(addressTopic);
    const p = this.params;
    const filters: readonly LogFilter[] = [
      { fromBlock: from, toBlock: to, addresses: [p.systemEmitter, p.usdcErc20], topics: [p.transferTopic0, topics, null] },
      { fromBlock: from, toBlock: to, addresses: [p.systemEmitter, p.usdcErc20], topics: [p.transferTopic0, null, topics] },
    ];
    let reference: Map<string, RawLog> | null = null;
    for (const source of this.sources) {
      let groups: readonly (readonly RawLog[])[] = [];
      for (const filter of filters) {
        const got = await fetchLogs(source, filter, this.fetchParams, this.timing);
        if (!got.ok) return fail(got.failure);
        groups = [...groups, got.logs];
      }
      const merged = mergeLogs(groups);
      if (typeof merged === 'string') return fail({ kind: 'SOURCE_STOPPED', source: source.name, code: null, detail: merged });
      if (reference === null) reference = merged;
      else {
        const mismatch = sameLogs(reference, merged);
        if (mismatch !== null) return disagree(`blocks ${from}-${to}: ${mismatch}`);
      }
    }
    const logs = inChainOrder([...(reference as Map<string, RawLog>).values()]);
    const decoded = this.decodeAll(logs, ours);
    if (!decoded.ok) return decoded;
    return this.withReceipts(decoded.value);
  }

  /** Decode every log; pair ERC-20 logs; every canonical log must touch one of `ours` (it was filtered for that). */
  private decodeAll(logs: readonly RawLog[], ours: readonly NetworkAddress[]): Step<readonly CanonicalLog[]> {
    let canonical: readonly CanonicalLog[] = [];
    let erc20: readonly Erc20Log[] = [];
    for (const log of logs) {
      const d = decodeLog(log, this.params);
      if (d.kind === 'UNKNOWN') return fail({ kind: 'UNKNOWN_EVENT', txHash: d.txHash, logIndex: d.logIndex, detail: d.detail });
      if (!ours.includes(d.from) && !ours.includes(d.to)) {
        return fail({ kind: 'UNKNOWN_EVENT', txHash: d.txHash, logIndex: d.logIndex, detail: 'log touches none of our addresses' });
      }
      if (d.kind === 'CANONICAL') canonical = [...canonical, d];
      else erc20 = [...erc20, d];
    }
    const lone = unpairedErc20(canonical, erc20);
    if (lone !== null) {
      return fail({ kind: 'UNKNOWN_EVENT', txHash: lone.txHash, logIndex: lone.logIndex, detail: 'ERC-20 log without an equal canonical log (C-22)' });
    }
    return { ok: true, value: canonical };
  }

  /** One receipt per transaction from every source, compared; then the confirmed transfers. */
  private async withReceipts(canonical: readonly CanonicalLog[]): Promise<Step<readonly ConfirmedTransfer[]>> {
    let out: readonly ConfirmedTransfer[] = [];
    const receipts = new Map<string, RawReceipt>();
    for (const log of canonical) {
      let receipt = receipts.get(log.txHash);
      if (receipt === undefined) {
        const r = await this.pollReceipt(log.txHash);
        if (!r.ok) return r;
        receipt = r.value;
        receipts.set(log.txHash, receipt);
      }
      if (receipt.blockHash.toLowerCase() !== log.blockHash || receipt.blockNumber !== log.blockNumber) {
        return disagree(`receipt of ${log.txHash} is in another block than its log`);
      }
      if (receipt.status !== 1n) {
        return fail({ kind: 'UNKNOWN_EVENT', txHash: log.txHash, logIndex: log.logIndex, detail: 'Transfer log in a transaction without status 1' });
      }
      if (!receiptCarries(receipt, log, this.params)) return disagree(`receipt of ${log.txHash} does not carry log ${log.logIndex}`);
      const gas = receiptGas(receipt.from, receipt.gasUsed, receipt.effectiveGasPrice);
      if (gas === null) return fail({ kind: 'UNKNOWN_EVENT', txHash: log.txHash, logIndex: log.logIndex, detail: 'malformed receipt gas fields' });
      out = [...out, toConfirmedTransfer(this.params.chainId, log, gas, this.sourceCount)];
    }
    return { ok: true, value: out };
  }

  /**
   * Poll path (lensR-1 m1): the receipt of a transaction whose log every
   * source has just served. A source without it is a load-balanced backend
   * that has not imported the block yet (C-42, rpc-endpoints.md lines 40,
   * 119): retry with the -32014 backoff; still missing after the last attempt
   * → SOURCE_LAGGING (not sticky; nothing is delivered and no cursor moves).
   */
  private async pollReceipt(txHash: Hex32): Promise<Step<RawReceipt>> {
    const policy = this.params.retry;
    let missing: readonly RpcSource[] = [];
    for (let attempt = 0n; attempt < policy.maxAttempts; attempt += 1n) {
      if (attempt > 0n) await this.timing.sleep(backoffDelay(policy, attempt - 1n, (b) => this.timing.random(b)));
      const r = await this.readReceipt(txHash);
      if (!r.ok) return r;
      if (r.value.kind === 'ALL') return { ok: true, value: r.value.receipt };
      ({ missing } = r.value);
    }
    return fail({ kind: 'SOURCE_LAGGING', source: missing.map((s) => s.name).join(','), detail: `receipt of ${txHash} still missing after ${policy.maxAttempts} attempts` });
  }

  /**
   * confirmTx path: the receipt every source returns (null when none has it).
   * One source having it and another not → disagreement, unless every source
   * without it reports a head below the receipt's block (it cannot have it
   * yet): then null.
   */
  private async agreedReceipt(txHash: Hex32, heads: ReadonlyMap<RpcSource, bigint>): Promise<Step<RawReceipt | null>> {
    const r = await this.readReceipt(txHash);
    if (!r.ok) return r;
    const read = r.value;
    if (read.kind === 'ALL') return { ok: true, value: read.receipt };
    const { receipt, missing } = read;
    if (receipt === null || missing.every((source) => (heads.get(source) as bigint) < receipt.blockNumber)) return { ok: true, value: null };
    return disagree(`sources disagree on the receipt of ${txHash}`);
  }

  /**
   * One receipt read from every source. Two different receipts →
   * disagreement. Every source has it → ALL, checked (status 0 or 1, its own
   * transaction and block); otherwise MISSING with the receipt some source
   * returned (null when none did) and the sources without it.
   */
  private async readReceipt(txHash: Hex32): Promise<Step<ReceiptRead>> {
    let found: { readonly receipt: RawReceipt; readonly print: string } | null = null;
    let missing: readonly RpcSource[] = [];
    for (const source of this.sources) {
      const r = await withRetry(() => source.getReceipt(txHash), this.params.retry, this.params.headLagCode, this.timing);
      if (r.kind !== 'OK') return fail(sourceFailure(source.name, r));
      if (r.value === null) missing = [...missing, source];
      else if (found === null) found = { receipt: r.value, print: receiptFingerprint(r.value) };
      else if (found.print !== receiptFingerprint(r.value)) return disagree(`sources disagree on the receipt of ${txHash}`);
    }
    if (found === null || missing.length > 0) return { ok: true, value: { kind: 'MISSING', receipt: found === null ? null : found.receipt, missing } };
    const { receipt } = found;
    if (receipt.status !== 0n && receipt.status !== 1n) {
      return fail({ kind: 'SOURCE_STOPPED', source: 'all', code: null, detail: `receipt status ${receipt.status} is not 0 or 1` });
    }
    // m3: the receipt and every log in it must belong to the requested transaction and to the receipt's block.
    const foreign = receipt.transactionHash.toLowerCase() !== txHash
      || receipt.logs.some((l) => l.transactionHash.toLowerCase() !== txHash || l.blockNumber !== receipt.blockNumber || l.blockHash.toLowerCase() !== receipt.blockHash.toLowerCase());
    if (foreign) return fail({ kind: 'SOURCE_STOPPED', source: 'all', code: null, detail: `the receipt returned for ${txHash} belongs to another transaction or block` });
    return { ok: true, value: { kind: 'ALL', receipt } };
  }

  /**
   * One transaction by hash (§6.5): OK null when no source has it yet, or when
   * its block is above the agreed head minus `confirmations`. A status-0
   * receipt is returned with no transfers and its gas (C-53, F-3c).
   */
  confirmTx(txHash: Hex32): Promise<NetworkRead<TxConfirmation | null>> {
    return this.run(async () => {
      const heads = await this.readHeads();
      if (!heads.ok) return heads;
      const r = await this.agreedReceipt(txHash.toLowerCase() as Hex32, heads.value.bySource);
      if (!r.ok) return r;
      const receipt = r.value;
      if (receipt === null || receipt.blockNumber > heads.value.head.number - this.params.confirmations) return { ok: true, value: null };
      const gas = receiptGas(receipt.from, receipt.gasUsed, receipt.effectiveGasPrice);
      if (gas === null) return fail({ kind: 'UNKNOWN_EVENT', txHash, logIndex: -1n, detail: 'malformed receipt gas fields' });
      let canonical: readonly CanonicalLog[] = [];
      let erc20: readonly Erc20Log[] = [];
      for (const log of receipt.logs) {
        const d = decodeLog(log, this.params);
        if (d.kind === 'CANONICAL') canonical = [...canonical, d];
        else if (d.kind === 'ERC20') erc20 = [...erc20, d];
        // Other logs (an Approval, a Memo event) are not ours to read; a malformed system-emitter log, or a
        // malformed USDC `Transfer` log (the ERC-20 cross-check, as in poll), is (m4).
        else if (mustDecode(log, this.params)) {
          return fail({ kind: 'UNKNOWN_EVENT', txHash, logIndex: d.logIndex, detail: d.detail });
        }
      }
      if (receipt.status === 0n && receipt.logs.length > 0) {
        return fail({ kind: 'UNKNOWN_EVENT', txHash, logIndex: -1n, detail: 'a reverted transaction carries logs' });
      }
      const lone = unpairedErc20(canonical, erc20);
      if (lone !== null) return fail({ kind: 'UNKNOWN_EVENT', txHash, logIndex: lone.logIndex, detail: 'ERC-20 log without an equal canonical log (C-22)' });
      const transfers = canonical.map((log) => toConfirmedTransfer(this.params.chainId, log, gas, this.sourceCount));
      return {
        ok: true,
        value: {
          txHash: receipt.transactionHash.toLowerCase() as Hex32,
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash.toLowerCase() as Hex32,
          receiptStatus: statusOf(receipt.status),
          gas,
          transfers,
          sources: this.sourceCount,
        },
      };
    });
  }
}

/** m4: the receipt contains the canonical log being credited, with the same position, parties and value (its block is checked before). */
function receiptCarries(receipt: RawReceipt, log: CanonicalLog, params: ArcNetworkParams): boolean {
  return receipt.logs.some((raw) => {
    const d = decodeLog(raw, params);
    return d.kind === 'CANONICAL' && d.logIndex === log.logIndex && d.from === log.from && d.to === log.to && d.value === log.value;
  });
}

/** A log confirmTx may not skip when it does not decode: any system-emitter log, and a USDC ERC-20 log with the Transfer topic. */
function mustDecode(log: RawLog, params: ArcNetworkParams): boolean {
  const emitter = log.address.toLowerCase();
  if (emitter === params.systemEmitter) return true;
  const [topic0] = log.topics;
  return emitter === params.usdcErc20 && topic0 !== undefined && topic0.toLowerCase() === params.transferTopic0;
}

/** A receipt status already checked to be 0n or 1n, narrowed to its literal type. */
function statusOf(status: bigint): 0n | 1n {
  if (status === 1n) return 1n;
  return 0n;
}

/** null when both maps hold the same keys with the same content; otherwise a description of the first difference. */
function sameLogs(a: ReadonlyMap<string, RawLog>, b: ReadonlyMap<string, RawLog>): string | null {
  for (const [key, log] of a) {
    const other = b.get(key);
    if (other === undefined) return `log ${key} missing from one source`;
    if (logFingerprint(other) !== logFingerprint(log)) return `log ${key} differs between sources`;
  }
  for (const key of b.keys()) if (!a.has(key)) return `log ${key} missing from one source`;
  return null;
}
