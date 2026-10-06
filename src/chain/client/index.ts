/**
 * U3 Chain client (READ path only for the testnet slice). Money path (RUBRIC item 6).
 *
 * Duties (KICKOFF U3, PHASE2_SLICE_PLAN, RUBRIC MC-16, THREAT_MODEL T-D1/T-D2, DR-02):
 * - One transport per source, own node(s) and the reference RPC. Production passes
 *   `createViemTransport` (./viem-transport.ts: a viem public client over HTTP with
 *   viem's own retries off); tests pass a fake. The reference URL defaults to the
 *   config's `rpcHttp` (C-03). This module imports no network library: every
 *   transport result is `unknown` here and is validated before use. Every source must
 *   answer `eth_chainId` with the reader's chain ID (testnet 5042002, C-01) before
 *   anything it says is used; otherwise the read stops (testnet only, CLAUDE.md rule 1).
 * - `eth_getLogs` paging in windows of at most `chain.getLogsMaxBlocksPerPage`
 *   blocks (C-40). `-32012` (range too large, C-40) splits the window; `-32602`
 *   (observed result cap, C-41, Q-A4) bisects it. A single-block window that still
 *   fails stops with that error (it cannot be split further).
 * - `-32014` (head lag, C-42) is retried with exponential backoff and jitter, up to
 *   `retry.maxRetries`; after that the read stops (`RETRIES_EXHAUSTED`).
 * - `-32603 "Blocked address"` (C-57) is classified exactly. On the read path it,
 *   and every unknown or unclassified error or malformed response, STOPS the read
 *   (fail closed). It is never read as "no logs".
 * - Dual-source quorum (CONTRACT §1.6, DR-02): every own node and the reference
 *   must return the same block hash at `toBlock` and the same log set for the
 *   range. Any difference → `DISAGREEMENT` carrying a typed PAUSE signal
 *   (`createCase RECON_DRIFT`); the caller keeps its cursor before `fromBlock`.
 * - Stall detection (CONTRACT §1.6 and §5.8, Q-A7): a source whose head has not
 *   advanced for `aStallMs` is stalled. `STALLED` (PAUSE, `createCase PENDING_AGE`)
 *   when two or more own nodes are stalled (all of them, if fewer than two are
 *   configured), or when the reference is stalled (the quorum can't advance
 *   past it; fail closed).
 *
 * L-3: `LogQuery` carries only the emitter address and topic0, never a customer
 * address, so the same query may go to the reference RPC.
 *
 * MC-01: no JS number on this path. Block numbers, delays and times are bigint;
 * RPC error codes are compared in place against literals and only stored in the
 * allow-listed `ReadResult.code`. This module holds no timer API: the caller
 * supplies `sleep` (with a bigint delay in ms).
 */
import { randomBytes } from 'node:crypto';
import type { Address, Hex32, TestnetChainConfig } from '../config/index.js';

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

/** The typed PAUSE signal (CONTRACT §1.6 rail-wide chain conditions). */
export type PauseSignal =
  | {
      readonly kind: 'PAUSE';
      readonly reason: 'RPC_DISAGREEMENT';
      readonly caseType: 'RECON_DRIFT';
      readonly fromBlock: BlockNumber;
      readonly toBlock: BlockNumber;
      readonly detail: string;
    }
  | {
      readonly kind: 'PAUSE';
      readonly reason: 'CHAIN_STALL';
      readonly caseType: 'PENDING_AGE';
      readonly lastHead: BlockNumber;
      readonly stalledSources: readonly string[];
      readonly detail: string;
    };

/** Classification of an RPC error (RUBRIC MC-16). Anything not matched exactly is `UNCLASSIFIED`. */
export type RpcErrorKind = 'RANGE_TOO_LARGE' | 'RESULT_CAP' | 'HEAD_LAG' | 'BLOCKED_ADDRESS' | 'UNCLASSIFIED';

/** Why a read stopped. Every one of these fails closed. (`HEAD_LAG` is retried; when retries run out the cause is `RETRIES_EXHAUSTED`.) */
export type StopCause = Exclude<RpcErrorKind, 'HEAD_LAG'> | 'RETRIES_EXHAUSTED' | 'MALFORMED_RESPONSE' | 'WRONG_CHAIN' | 'INVALID_QUERY';

/** Outcome of a read that may have to fail closed. */
export type ReadResult<T> =
  | { readonly kind: 'OK'; readonly value: T }
  | { readonly kind: 'DISAGREEMENT'; readonly detail: string; readonly pause: Extract<PauseSignal, { readonly reason: 'RPC_DISAGREEMENT' }> }
  | { readonly kind: 'STALLED'; readonly lastHead: BlockNumber; readonly pause: Extract<PauseSignal, { readonly reason: 'CHAIN_STALL' }> }
  | {
      readonly kind: 'STOP';
      readonly code: number | null;
      readonly cause: StopCause;
      readonly source: string;
      readonly detail: string;
    };

export interface ChainReader {
  readonly chainId: 5042002;
  getHead(): Promise<ReadResult<BlockNumber>>;
  getLogs(query: LogQuery): Promise<ReadResult<readonly RawLog[]>>;
}

/** The minimal JSON-RPC surface the reader uses. Production: `createViemTransport` (./viem-transport.ts); tests: a fake. */
export interface RpcTransport {
  request(args: { readonly method: string; readonly params: readonly unknown[] }): Promise<unknown>;
}

export interface RetryPolicy {
  /** Retries after the first attempt, for `-32014` only. */
  readonly maxRetries: bigint;
  /** The delay before retry n (0-based) is `min(baseDelayMs << n, maxDelayMs)`, jittered into its upper half. */
  readonly baseDelayMs: bigint;
  readonly maxDelayMs: bigint;
}

export interface ChainReaderOptions {
  /** Testnet config only (type-level pin; pass `ARC_TESTNET`). */
  readonly chain: TestnetChainConfig;
  /** Own node RPC URLs, at least one. */
  readonly ownNodeUrls: readonly string[];
  /** Reference RPC URL. Default: `chain.rpcHttp` (C-03). */
  readonly referenceUrl?: string;
  /** `A_stall` in ms (CONTRACT §5.8; its value is decided under Q-A7). */
  readonly aStallMs: bigint;
  readonly retry: RetryPolicy;
  readonly sleep: (ms: bigint) => Promise<void>;
  /** Monotonic clock in ms. Default: `process.hrtime.bigint()`. */
  readonly nowMs?: () => bigint;
  /** Jitter source (its absolute value is used). Default: 48 random bits from node:crypto. */
  readonly random?: () => bigint;
  /** Transport factory, called once per source URL. Production: `createViemTransport`; tests: a fake. */
  readonly transportFor: (url: string) => RpcTransport;
}

export class ChainReaderConfigError extends Error {
  override readonly name = 'ChainReaderConfigError';
}

function* pages(from: BlockNumber, to: BlockNumber, max: bigint): Generator<LogQuery> {
  for (let start = from; start <= to; start += max) {
    const end = start + max - 1n;
    yield { fromBlock: start, toBlock: end < to ? end : to };
  }
}

/** Split [from, to] into inclusive pages of at most `maxBlocksPerPage` blocks (C-40). */
export function pageBlockRange(from: BlockNumber, to: BlockNumber, maxBlocksPerPage: bigint): readonly LogQuery[] {
  if (from < 0n || to < from) throw new RangeError(`invalid block range [${from}, ${to}]`);
  if (maxBlocksPerPage < 1n) throw new RangeError(`invalid page size ${maxBlocksPerPage}`);
  return [...pages(from, to, maxBlocksPerPage)];
}

/** The provider's own message: viem keeps it in `details`; a raw JSON-RPC error has `message`. */
function rawMessage(err: object): unknown {
  if ('details' in err && typeof err.details === 'string') return err.details;
  return 'message' in err ? err.message : undefined;
}

/** Classify an RPC error by its JSON-RPC code (and, for -32603, its exact message). */
export function classifyRpcError(err: unknown): RpcErrorKind {
  if (typeof err !== 'object' || err === null || !('code' in err)) return 'UNCLASSIFIED';
  const code = err.code;
  if (code === -32012) return 'RANGE_TOO_LARGE';
  if (code === -32602) return 'RESULT_CAP';
  if (code === -32014) return 'HEAD_LAG';
  if (code === -32603 && rawMessage(err) === 'Blocked address') return 'BLOCKED_ADDRESS';
  return 'UNCLASSIFIED';
}

/** A short description of an error, without viem's URL and request-body lines. */
function describeError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return String(err);
  const code = 'code' in err ? `code=${String(err.code)} ` : '';
  return `${code}${String(rawMessage(err))}`.slice(0, 200);
}

const HEX = /^0x[0-9a-fA-F]*$/;
const QUANTITY = /^0x[0-9a-fA-F]{1,64}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function quantity(v: unknown): bigint | null {
  return typeof v === 'string' && QUANTITY.test(v) ? BigInt(v) : null;
}
// Plain boolean checks, not type predicates: a predicate's parameter name reads as an `any` value to the MC-01 lint.
function isHash(v: unknown): boolean {
  return typeof v === 'string' && HASH32.test(v);
}
const isArray: (v: unknown) => boolean = Array.isArray;
function asList(v: unknown): readonly unknown[] | null {
  return isArray(v) ? (v as readonly unknown[]) : null;
}
function field(v: unknown, key: string): unknown {
  return typeof v === 'object' && v !== null ? (v as Readonly<Record<string, unknown>>)[key] : undefined;
}
const toHex = (n: bigint): `0x${string}` => `0x${n.toString(16)}`;

/** Parse one `eth_getLogs` entry; null when anything is missing, malformed, pending, removed or outside the window. */
function parseLog(v: unknown, from: BlockNumber, to: BlockNumber): RawLog | null {
  const blockNumber = quantity(field(v, 'blockNumber'));
  const logIndex = quantity(field(v, 'logIndex'));
  const address = field(v, 'address');
  const topics = asList(field(v, 'topics'));
  const data = field(v, 'data');
  const blockHash = field(v, 'blockHash');
  const transactionHash = field(v, 'transactionHash');
  if (blockNumber === null || logIndex === null || blockNumber < from || blockNumber > to) return null;
  if (field(v, 'removed') === true || typeof address !== 'string' || !ADDRESS.test(address)) return null;
  if (topics === null || !topics.every(isHash) || typeof data !== 'string' || !HEX.test(data)) return null;
  if (!isHash(blockHash) || !isHash(transactionHash)) return null;
  return {
    address: address as Address,
    topics: topics as readonly Hex32[],
    data: data as `0x${string}`,
    blockNumber,
    blockHash: blockHash as Hex32,
    transactionHash: transactionHash as Hex32,
    logIndex,
  };
}

/** Canonical identity of a log for the quorum compare (every field, case-insensitive hex). */
function logKey(l: RawLog): string {
  return [l.blockNumber, l.logIndex, l.blockHash, l.transactionHash, l.address, l.topics.join(','), l.data].join('|').toLowerCase();
}

interface Source {
  readonly label: string;
  readonly own: boolean;
  readonly transport: RpcTransport;
}

type Stop = Extract<ReadResult<never>, { readonly kind: 'STOP' }>;
type Step<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly stop: Stop };

function stop(cause: StopCause, source: string, detail: string): { readonly ok: false; readonly stop: Stop } {
  const base = { kind: 'STOP', cause, source, detail } as const;
  switch (cause) {
    case 'RANGE_TOO_LARGE':
      return { ok: false, stop: { ...base, code: -32012 } };
    case 'RESULT_CAP':
      return { ok: false, stop: { ...base, code: -32602 } };
    case 'RETRIES_EXHAUSTED':
      return { ok: false, stop: { ...base, code: -32014 } };
    case 'BLOCKED_ADDRESS':
      return { ok: false, stop: { ...base, code: -32603 } };
    default:
      return { ok: false, stop: { ...base, code: null } };
  }
}

interface SourceRead {
  readonly hash: Hex32;
  readonly keys: readonly string[];
  readonly logs: readonly RawLog[];
}

export function createChainReader(options?: ChainReaderOptions): ChainReader {
  if (options === undefined) throw new ChainReaderConfigError('chain reader options are required');
  const { chain, aStallMs, retry, sleep, transportFor } = options;
  const [firstOwnUrl, ...otherOwnUrls] = options.ownNodeUrls;
  if (firstOwnUrl === undefined) throw new ChainReaderConfigError('at least one own node URL is required');
  const referenceUrl = options.referenceUrl ?? chain.rpcHttp;
  const seenUrls = new Set<string>();
  for (const url of [firstOwnUrl, ...otherOwnUrls, referenceUrl]) {
    if (seenUrls.has(url)) throw new ChainReaderConfigError('own node and reference URLs must all be distinct');
    seenUrls.add(url);
  }
  if (aStallMs <= 0n) throw new ChainReaderConfigError('aStallMs must be positive');
  if (retry.maxRetries < 0n || retry.baseDelayMs < 1n || retry.maxDelayMs < retry.baseDelayMs) {
    throw new ChainReaderConfigError('invalid retry policy');
  }
  const nowMs = options.nowMs ?? ((): bigint => process.hrtime.bigint() / 1_000_000n);
  const random = options.random ?? ((): bigint => BigInt(`0x${randomBytes(6).toString('hex')}`));

  // own#0 is the primary: its logs are returned when every source agrees with it.
  const primary: Source = { label: 'own#0', own: true, transport: transportFor(firstOwnUrl) };
  let ownCount = 1n;
  const others: Source[] = otherOwnUrls.map((url) => {
    const label = `own#${ownCount}`;
    ownCount += 1n;
    return { label, own: true, transport: transportFor(url) };
  });
  const all: readonly Source[] = [primary, ...others, { label: 'reference', own: false, transport: transportFor(referenceUrl) }];
  const stallQuorum = ownCount < 2n ? ownCount : 2n;
  const heads = new Map<string, { readonly head: bigint; readonly since: bigint }>();
  let chainVerified = false;

  const backoff = (attempt: bigint): bigint => {
    const capped = retry.baseDelayMs << attempt;
    const delay = capped < retry.maxDelayMs ? capped : retry.maxDelayMs;
    const half = delay / 2n;
    const r = random();
    return half + (r < 0n ? -r : r) % (delay - half + 1n);
  };

  /** One RPC call; `-32014` (and a null result where one is not allowed) is retried with backoff. */
  const call = async (src: Source, method: string, params: readonly unknown[], nullIsLag = false): Promise<Step<unknown>> => {
    for (let attempt = 0n; ; attempt += 1n) {
      let kind: RpcErrorKind;
      let detail: string;
      try {
        const value = await src.transport.request({ method, params });
        if (!nullIsLag || value !== null) return { ok: true, value };
        kind = 'HEAD_LAG';
        detail = `${method}: null result`;
      } catch (err) {
        kind = classifyRpcError(err);
        detail = `${method}: ${describeError(err)}`;
      }
      if (kind !== 'HEAD_LAG') return stop(kind, src.label, detail);
      if (attempt >= retry.maxRetries) return stop('RETRIES_EXHAUSTED', src.label, `${detail} (after ${attempt} retries)`);
      await sleep(backoff(attempt));
    }
  };

  const verifyChain = async (): Promise<Step<true>> => {
    if (!chainVerified) {
      for (const src of all) {
        const r = await call(src, 'eth_chainId', []);
        if (!r.ok) return r;
        if (quantity(r.value) !== BigInt(reader.chainId)) return stop('WRONG_CHAIN', src.label, `eth_chainId returned ${String(r.value)}`);
      }
      chainVerified = true;
    }
    return { ok: true, value: true };
  };

  /** One window of one source: split on -32012, bisect on -32602, down to a single block. */
  const fetchWindow = async (src: Source, q: LogQuery): Promise<Step<readonly RawLog[]>> => {
    const filter = {
      fromBlock: toHex(q.fromBlock),
      toBlock: toHex(q.toBlock),
      ...(q.address === undefined ? {} : { address: q.address }),
      ...(q.topic0 === undefined ? {} : { topics: [q.topic0] }),
    };
    const r = await call(src, 'eth_getLogs', [filter]);
    if (r.ok) {
      const list = asList(r.value);
      if (list === null) return stop('MALFORMED_RESPONSE', src.label, 'eth_getLogs: result is not an array');
      const logs = list.map((v) => parseLog(v, q.fromBlock, q.toBlock));
      if (!logs.every((l) => l !== null)) return stop('MALFORMED_RESPONSE', src.label, `eth_getLogs [${q.fromBlock}, ${q.toBlock}]: malformed log`);
      return { ok: true, value: logs as readonly RawLog[] };
    }
    if (r.stop.cause !== 'RANGE_TOO_LARGE' && r.stop.cause !== 'RESULT_CAP') return r;
    if (q.fromBlock === q.toBlock) return { ok: false, stop: { ...r.stop, detail: `${r.stop.detail} (single block ${q.fromBlock}: cannot split)` } };
    const mid = q.fromBlock + (q.toBlock - q.fromBlock) / 2n;
    const lo = await fetchWindow(src, { ...q, toBlock: mid });
    if (!lo.ok) return lo;
    const hi = await fetchWindow(src, { ...q, fromBlock: mid + 1n });
    if (!hi.ok) return hi;
    return { ok: true, value: [...lo.value, ...hi.value] };
  };

  /** Block hash at `toBlock` and every log of [fromBlock, toBlock] from one source, paged (C-40). */
  const readSource = async (src: Source, q: LogQuery): Promise<Step<SourceRead>> => {
    const b = await call(src, 'eth_getBlockByNumber', [toHex(q.toBlock), false], true);
    if (!b.ok) return b;
    const hash = field(b.value, 'hash');
    if (quantity(field(b.value, 'number')) !== q.toBlock || !isHash(hash)) {
      return stop('MALFORMED_RESPONSE', src.label, `eth_getBlockByNumber ${q.toBlock}: malformed block`);
    }
    let chunks: (readonly RawLog[])[] = [];
    for (const page of pageBlockRange(q.fromBlock, q.toBlock, chain.getLogsMaxBlocksPerPage)) {
      const r = await fetchWindow(src, { ...q, ...page });
      if (!r.ok) return r;
      chunks = [...chunks, r.value];
    }
    const logs = chunks.flat();
    const ids = new Set<string>();
    for (const l of logs) {
      const id = `${l.transactionHash}|${l.logIndex}`.toLowerCase();
      if (ids.has(id)) return stop('MALFORMED_RESPONSE', src.label, `eth_getLogs: duplicate log ${id}`);
      ids.add(id);
    }
    return { ok: true, value: { hash: hash as Hex32, keys: logs.map(logKey), logs } };
  };

  const getLogs = async (query: LogQuery): Promise<ReadResult<readonly RawLog[]>> => {
    const { fromBlock, toBlock } = query;
    if (fromBlock < 0n || toBlock < fromBlock) return stop('INVALID_QUERY', 'reader', `invalid block range [${fromBlock}, ${toBlock}]`).stop;
    const v = await verifyChain();
    if (!v.ok) return v.stop;
    const base = await readSource(primary, query);
    if (!base.ok) return base.stop;
    const baseKeys = new Set(base.value.keys);
    for (const src of all.slice(1)) {
      const r = await readSource(src, query);
      if (!r.ok) return r.stop;
      let what = '';
      if (r.value.hash.toLowerCase() !== base.value.hash.toLowerCase()) what = `block hash at ${toBlock} differs`;
      else if (r.value.keys.length !== base.value.keys.length || !r.value.keys.every((k) => baseKeys.has(k))) what = 'log set differs';
      if (what !== '') {
        const detail = `${src.label} vs ${primary.label}: ${what} for [${fromBlock}, ${toBlock}]`;
        return { kind: 'DISAGREEMENT', detail, pause: { kind: 'PAUSE', reason: 'RPC_DISAGREEMENT', caseType: 'RECON_DRIFT', fromBlock, toBlock, detail } };
      }
    }
    return { kind: 'OK', value: base.value.logs };
  };

  /** Head of one source, and whether it has not advanced for `aStallMs`. */
  const readHead = async (src: Source, now: bigint): Promise<Step<{ readonly head: bigint; readonly stalled: boolean }>> => {
    const r = await call(src, 'eth_blockNumber', []);
    if (!r.ok) return r;
    const head = quantity(r.value);
    if (head === null) return stop('MALFORMED_RESPONSE', src.label, `eth_blockNumber returned ${String(r.value)}`);
    const prev = heads.get(src.label);
    // A head that went backwards (e.g. a load-balanced endpoint) is not progress: keep the highest seen.
    const seen = prev === undefined || head > prev.head ? { head, since: now } : prev;
    heads.set(src.label, seen);
    return { ok: true, value: { head, stalled: now - seen.since >= aStallMs } };
  };

  const getHead = async (): Promise<ReadResult<BlockNumber>> => {
    const v = await verifyChain();
    if (!v.ok) return v.stop;
    const now = nowMs();
    let lastHead: bigint | undefined;
    let stalledOwn = 0n;
    let referenceStalled = false;
    let stalled: readonly string[] = [];
    for (const src of all) {
      const r = await readHead(src, now);
      if (!r.ok) return r.stop;
      const { head } = r.value;
      if (lastHead === undefined || head < lastHead) lastHead = head;
      if (r.value.stalled) {
        stalled = [...stalled, src.label];
        if (src.own) stalledOwn += 1n;
        else referenceStalled = true;
      }
    }
    const minHead = lastHead as bigint;
    if (stalledOwn >= stallQuorum || referenceStalled) {
      const detail = `no new block for ${aStallMs} ms on ${stalled.join(', ')}`;
      return {
        kind: 'STALLED',
        lastHead: minHead,
        pause: { kind: 'PAUSE', reason: 'CHAIN_STALL', caseType: 'PENDING_AGE', lastHead: minHead, stalledSources: stalled, detail },
      };
    }
    return { kind: 'OK', value: minHead };
  };

  const reader: ChainReader = { chainId: 5042002, getHead, getLogs };
  return reader;
}
