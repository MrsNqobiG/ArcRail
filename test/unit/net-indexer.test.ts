/**
 * Unit NET: Arc event indexer (NOVA_ARC_DESIGN §6) with fault injection.
 * Everything runs against in-memory chains; nothing reaches a network.
 */
import { describe, expect, it } from 'vitest';
import { nativeWei, usdcUnits } from '../../src/amounts/index.js';
import type { Hex32 } from '../../src/chain/config/index.js';
import { addressTopic, dataWord, decodeLog, receiptGas, topicAddress, transferDigest, unpairedErc20 } from '../../src/indexer/decode.js';
import type { CanonicalLog, Erc20Log } from '../../src/indexer/decode.js';
import {
  FaultInjectingSource,
  InMemoryArcChain,
  JournalIndexerStore,
  MapIndexerStore,
  ManualTiming,
  erc20TransferTx,
  fakeAddress,
  fakeHash,
  nativeTransferTx,
  transferLog,
  word,
} from '../../src/indexer/fakes.js';
import type { ChainTx } from '../../src/indexer/fakes.js';
import { backoffDelay, fetchLogs, pageRange, sourceFailure, withRetry } from '../../src/indexer/fetch.js';
import { ArcIndexer, lowest } from '../../src/indexer/indexer.js';
import type { LogFilter, RawLog, RawReceipt, RpcOutcome, RpcSource } from '../../src/indexer/rpc.js';
import type { IndexerStore } from '../../src/indexer/store.js';
import type { NetworkFailure } from '../../src/network/types.js';
import { loadArcNetworkParams } from '../../src/network/arc/config.js';
import type { ArcNetworkParams } from '../../src/network/arc/params.js';
import type { ConfirmedTransfer, NetworkAddress } from '../../src/network/types.js';

const base = loadArcNetworkParams({
  chainId: 5042002n,
  dfnsNetwork: 'ArcTestnet',
  singleSourceTestnetOnly: false,
  stallAfterMs: 30_000n,
  startBlock: 1n,
  blocklistMaxAgeMs: 60_000n,
});

const A = fakeAddress('ours-a');
const B = fakeAddress('ours-b');
const X = fakeAddress('external-x');
const Y = fakeAddress('external-y');
const OURS = new Set([A, B]);

interface Setup {
  readonly params: ArcNetworkParams;
  readonly chainA: InMemoryArcChain;
  readonly chainB: InMemoryArcChain;
  readonly own: FaultInjectingSource;
  readonly ref: FaultInjectingSource;
  readonly store: IndexerStore;
  readonly timing: ManualTiming;
  readonly indexer: ArcIndexer;
  mine(txs?: readonly ChainTx[]): void;
}

function setup(over: Partial<ArcNetworkParams> = {}, store: IndexerStore = new MapIndexerStore(), chainOptions = {}): Setup {
  const params = { ...base, ...over } as ArcNetworkParams;
  const chainA = new InMemoryArcChain('own-node', chainOptions);
  const chainB = new InMemoryArcChain('reference', chainOptions);
  const own = new FaultInjectingSource(chainA);
  const ref = new FaultInjectingSource(chainB);
  const timing = new ManualTiming();
  const indexer = new ArcIndexer({ params, sources: [own, ref], store, timing });
  return {
    params,
    chainA,
    chainB,
    own,
    ref,
    store,
    timing,
    indexer,
    mine(txs = []) {
      chainA.mine(txs);
      chainB.mine(txs);
    },
  };
}

const ok = <T>(r: { kind: string; value?: T }): T => {
  expect(r.kind).toBe('OK');
  return r.value as T;
};

/** A MapIndexerStore with some methods replaced (test doubles for store outcomes). */
function storeWith(over: Partial<IndexerStore>): IndexerStore {
  const inner = new MapIndexerStore();
  return {
    loadCursor: (k) => inner.loadCursor(k),
    commitPage: (c) => inner.commitPage(c),
    unacknowledged: (st) => inner.unacknowledged(st),
    acknowledge: (st, k) => inner.acknowledge(st, k),
    loadHalt: (st) => inner.loadHalt(st),
    recordHalt: (st, f) => inner.recordHalt(st, f),
    clearHalt: (st, a) => inner.clearHalt(st, a),
    loadLiveness: (st) => inner.loadLiveness(st),
    saveLiveness: (st, l) => inner.saveLiveness(st, l),
    ...over,
  };
}

// ---------------------------------------------------------------------------
describe('pageRange (C-40)', () => {
  it('splits inclusively into pages of at most maxBlocks', () => {
    expect(pageRange(1n, 25_000n, 9_999n)).toEqual([
      { from: 1n, to: 9_999n },
      { from: 10_000n, to: 19_998n },
      { from: 19_999n, to: 25_000n },
    ]);
    expect(pageRange(5n, 5n, 3n)).toEqual([{ from: 5n, to: 5n }]);
    expect(pageRange(1n, 3n, 3n)).toEqual([{ from: 1n, to: 3n }]);
    expect(pageRange(6n, 5n, 3n)).toEqual([]);
    expect(pageRange(1n, 1n, 1n)).toEqual([{ from: 1n, to: 1n }]);
  });

  it('refuses a page size below one block', () => {
    expect(() => pageRange(1n, 2n, 0n)).toThrow('maxBlocks must be at least 1');
  });

  it('the configured page is 9,999 blocks: to − from ≤ 9,998, accepted by a 10,000-block cap', () => {
    expect(base.maxBlocksPerPage).toBe(9_999n);
    for (const p of pageRange(1n, 30_000n, base.maxBlocksPerPage)) expect(p.to - p.from <= 9_998n).toBe(true);
  });
});

describe('backoffDelay and withRetry (C-42)', () => {
  const policy = { initialMs: 250n, capMs: 8_000n, maxAttempts: 4n };

  it('is capped exponential with equal jitter in [d/2, d]', () => {
    const bounds: bigint[] = [];
    const rnd = (b: bigint): bigint => {
      bounds.push(b);
      return b - 1n;
    };
    expect(backoffDelay(policy, 0n, () => 0n)).toBe(125n);
    expect(backoffDelay(policy, 0n, rnd)).toBe(250n);
    expect(backoffDelay(policy, 1n, () => 0n)).toBe(250n);
    expect(backoffDelay(policy, 5n, () => 0n)).toBe(4_000n);
    expect(backoffDelay(policy, 6n, () => 0n)).toBe(4_000n);
    expect(backoffDelay(policy, 6n, rnd)).toBe(8_000n);
    expect(backoffDelay({ ...policy, capMs: 8_001n }, 5n, () => 0n)).toBe(4_000n);
    expect(bounds).toEqual([126n, 4_001n]);
  });

  it('retries head lag and transport errors with backoff, then succeeds', async () => {
    const timing = new ManualTiming(0n, [3n]);
    const answers: RpcOutcome<string>[] = [
      { ok: false, error: { kind: 'RPC', code: -32014n, message: 'lag' } },
      { ok: false, error: { kind: 'TRANSPORT', message: 'timeout' } },
      { ok: true, value: 'done' },
    ];
    const r = await withRetry(async () => answers.shift() as RpcOutcome<string>, policy, -32014n, timing);
    expect(r).toEqual({ kind: 'OK', value: 'done' });
    expect(timing.slept).toEqual([128n, 250n]);
    expect(timing.randomBounds).toEqual([126n, 251n]);
  });

  it('returns other RPC errors at once and EXHAUSTED after maxAttempts', async () => {
    const timing = new ManualTiming();
    let calls = 0n;
    const other = await withRetry(async () => {
      calls += 1n;
      return { ok: false, error: { kind: 'RPC', code: -32603n, message: 'boom' } } as const;
    }, policy, -32014n, timing);
    expect(other).toEqual({ kind: 'ERROR', code: -32603n, message: 'boom' });
    expect(calls).toBe(1n);
    const lag = await withRetry(async () => {
      calls += 1n;
      return { ok: false, error: { kind: 'RPC', code: -32014n, message: 'lag' } } as const;
    }, policy, -32014n, timing);
    expect(lag).toEqual({ kind: 'EXHAUSTED', last: { kind: 'RPC', code: -32014n, message: 'lag' } });
    expect(calls).toBe(5n);
    expect(timing.slept).toHaveLength(3);
    expect(await withRetry(async () => ({ ok: true, value: 1n }), { ...policy, maxAttempts: 0n }, -32014n, timing)).toEqual({
      kind: 'EXHAUSTED',
      last: { kind: 'TRANSPORT', message: 'no attempt made' },
    });
  });

  it('sourceFailure maps EXHAUSTED to SOURCE_LAGGING and ERROR to SOURCE_STOPPED', () => {
    expect(sourceFailure('s', { kind: 'EXHAUSTED', last: { kind: 'TRANSPORT', message: 't' } })).toEqual({
      kind: 'SOURCE_LAGGING',
      source: 's',
      detail: 'retries exhausted: t',
    });
    expect(sourceFailure('s', { kind: 'ERROR', code: -1n, message: 'm' })).toEqual({ kind: 'SOURCE_STOPPED', source: 's', code: -1n, detail: 'm' });
  });
});

describe('fetchLogs: split on -32012 / -32602, stop on unknown errors', () => {
  const fp = { retry: base.retry, headLagCode: -32014n, splitCodes: [-32012n, -32602n] };
  const filterFor = (from: bigint, to: bigint): LogFilter => ({
    fromBlock: from,
    toBlock: to,
    addresses: [base.systemEmitter, base.usdcErc20],
    topics: [base.transferTopic0, [addressTopic(A)], null],
  });

  it('halves on -32012 and never widens', async () => {
    const chain = new InMemoryArcChain('c', { maxRangeBlocks: 4n });
    chain.mineEmpty(2n);
    chain.mine([nativeTransferTx(base, 't1', A, X, 1n)]);
    chain.mineEmpty(7n);
    const src = new FaultInjectingSource(chain);
    const r = await fetchLogs(src, filterFor(1n, 10n), fp, new ManualTiming());
    expect(r.ok && r.logs.map((l) => l.blockNumber)).toEqual([3n]);
    expect(src.logRanges).toEqual([
      [1n, 10n],
      [1n, 5n],
      [1n, 3n],
      [4n, 5n],
      [6n, 10n],
      [6n, 8n],
      [9n, 10n],
    ]);
  });

  it('bisects on the -32602 result cap and fails RANGE_UNRECOVERABLE when one block still overflows', async () => {
    const chain = new InMemoryArcChain('c', { resultCap: 1n });
    chain.mine([nativeTransferTx(base, 'a', A, X, 1n)]);
    chain.mine([nativeTransferTx(base, 'b', A, X, 2n)]);
    const r = await fetchLogs(chain, filterFor(1n, 2n), fp, new ManualTiming());
    expect(r.ok && r.logs.map((l) => l.data)).toEqual([word(1n), word(2n)]);
    chain.mine([nativeTransferTx(base, 'c', A, X, 3n), nativeTransferTx(base, 'd', A, X, 4n)]);
    expect(await fetchLogs(chain, filterFor(3n, 3n), fp, new ManualTiming())).toEqual({
      ok: false,
      failure: { kind: 'RANGE_UNRECOVERABLE', source: 'c', from: 3n, to: 3n },
    });
  });

  it('a failure in the right half is returned', async () => {
    const chain = new InMemoryArcChain('c');
    chain.mineEmpty(4n);
    const src = new FaultInjectingSource(chain)
      .failNext('getLogs', { kind: 'RPC', code: -32012n, message: 'too large' })
      .failNext('getLogs', { kind: 'RPC', code: -32603n, message: 'right fails' }, 1n);
    // first call splits; left half [1,2] gets the -32603
    const r = await fetchLogs(src, filterFor(1n, 4n), fp, new ManualTiming());
    expect(r).toEqual({ ok: false, failure: { kind: 'SOURCE_STOPPED', source: 'c', code: -32603n, detail: 'right fails' } });
    const src2 = new FaultInjectingSource(chain);
    src2.failNext('getLogs', { kind: 'RPC', code: -32012n, message: 'too large' });
    const wrapped: RpcSource = {
      name: 'w',
      head: () => src2.head(),
      getReceipt: (h) => src2.getReceipt(h),
      getLogs: async (f) => (f.fromBlock === 3n ? { ok: false, error: { kind: 'RPC', code: -1n, message: 'right' } } : src2.getLogs(f)),
    };
    expect(await fetchLogs(wrapped, filterFor(1n, 4n), fp, new ManualTiming())).toEqual({
      ok: false,
      failure: { kind: 'SOURCE_STOPPED', source: 'w', code: -1n, detail: 'right' },
    });
  });

  it('an unknown JSON-RPC error stops the source; it is never read as "no logs"', async () => {
    const chain = new InMemoryArcChain('c');
    chain.mine([nativeTransferTx(base, 'a', A, X, 1n)]);
    const src = new FaultInjectingSource(chain).failNext('getLogs', { kind: 'RPC', code: -32000n, message: 'weird' });
    expect(await fetchLogs(src, filterFor(1n, 1n), fp, new ManualTiming())).toEqual({
      ok: false,
      failure: { kind: 'SOURCE_STOPPED', source: 'c', code: -32000n, detail: 'weird' },
    });
  });

  it('a log outside the requested range stops the source', async () => {
    const chain = new InMemoryArcChain('c');
    chain.mine([nativeTransferTx(base, 'a', A, X, 1n)]);
    chain.mine([nativeTransferTx(base, 'b', A, X, 1n)]);
    const lying = (shift: bigint): RpcSource => ({
      name: 'liar',
      head: () => chain.head(),
      getReceipt: (h) => chain.getReceipt(h),
      getLogs: async (f) => chain.getLogs({ ...f, fromBlock: f.fromBlock + shift, toBlock: f.toBlock + shift }),
    });
    expect(await fetchLogs(lying(1n), filterFor(1n, 1n), fp, new ManualTiming())).toEqual({
      ok: false,
      failure: { kind: 'SOURCE_STOPPED', source: 'liar', code: null, detail: 'log in block 2 outside [1, 1]' },
    });
    expect(await fetchLogs(lying(-1n), filterFor(2n, 2n), fp, new ManualTiming())).toEqual({
      ok: false,
      failure: { kind: 'SOURCE_STOPPED', source: 'liar', code: null, detail: 'log in block 1 outside [2, 2]' },
    });
    expect((await fetchLogs(chain, filterFor(1n, 2n), fp, new ManualTiming())).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('decode (C-20, C-21, C-22, C-27)', () => {
  it('address topics round-trip and reject non-zero padding', () => {
    expect(addressTopic(A)).toBe(`0x${'0'.repeat(24)}${A.slice(2)}`);
    expect(addressTopic(A.toUpperCase().replace('0X', '0x') as NetworkAddress)).toBe(addressTopic(A));
    expect(topicAddress(addressTopic(A))).toBe(A);
    expect(topicAddress(addressTopic(A).toUpperCase().replace('0X', '0x'))).toBe(A);
    expect(topicAddress(`0x1${'0'.repeat(23)}${A.slice(2)}`)).toBeNull();
    expect(topicAddress(`${addressTopic(A)}0`)).toBeNull();
    expect(topicAddress(`x${addressTopic(A)}`)).toBeNull();
  });

  it('dataWord accepts exactly one 32-byte word', () => {
    expect(dataWord(word(255n))).toBe(255n);
    expect(dataWord(word(255n).toUpperCase().replace('0X', '0x'))).toBe(255n);
    expect(dataWord('0x01')).toBeNull();
    expect(dataWord(`${word(1n)}00`)).toBeNull();
    expect(dataWord(`0${word(1n)}`)).toBeNull();
  });

  const raw = (log: ReturnType<typeof transferLog>, i = 0n): RawLog => ({
    ...log,
    blockNumber: 7n,
    blockHash: fakeHash('b7'),
    transactionHash: fakeHash('t7'),
    logIndex: i,
  });

  it('decodes canonical and ERC-20 logs; anything else is UNKNOWN', () => {
    const canon = raw(transferLog(base, base.systemEmitter, A, X, 10n));
    expect(decodeLog(canon, base)).toEqual({
      kind: 'CANONICAL',
      txHash: fakeHash('t7'),
      logIndex: 0n,
      blockNumber: 7n,
      blockHash: fakeHash('b7'),
      from: A,
      to: X,
      value: 10n,
    });
    expect(decodeLog({ ...canon, address: base.systemEmitter.toUpperCase().replace('0X', '0x') as NetworkAddress }, base).kind).toBe('CANONICAL');
    const e = decodeLog(raw(transferLog(base, base.usdcErc20, A, X, 3n), 1n), base);
    expect(e).toMatchObject({ kind: 'ERC20', units: 3n, from: A, to: X, logIndex: 1n });
    const unknown = (log: RawLog) => decodeLog(log, base);
    expect(unknown({ ...canon, address: X })).toEqual({ kind: 'UNKNOWN', txHash: fakeHash('t7'), logIndex: 0n, detail: `unexpected emitter ${X}` });
    expect(unknown({ ...canon, topics: [fakeHash('Approval'), ...canon.topics.slice(1)] })).toMatchObject({ kind: 'UNKNOWN', detail: 'not a Transfer log' });
    expect(unknown({ ...canon, topics: [] })).toMatchObject({ kind: 'UNKNOWN', detail: 'not a Transfer log' });
    expect(unknown({ ...canon, topics: [...canon.topics, fakeHash('x')] })).toMatchObject({ detail: 'unexpected extra topics' });
    expect(unknown({ ...canon, topics: canon.topics.slice(0, 2) })).toMatchObject({ detail: 'malformed address topic' });
    expect(unknown({ ...canon, topics: canon.topics.slice(0, 1) })).toMatchObject({ detail: 'malformed address topic' });
    expect(unknown({ ...canon, topics: [canon.topics[0] as Hex32, fakeHash('nonzero'), canon.topics[2] as Hex32] })).toMatchObject({
      detail: 'malformed address topic',
    });
    expect(unknown({ ...canon, data: '0x' })).toMatchObject({ detail: 'malformed value word' });
    expect(unknown({ ...canon, blockHash: '0x12' })).toMatchObject({ detail: 'malformed transaction or block hash' });
    expect(unknown({ ...canon, transactionHash: '0x12' })).toEqual({
      kind: 'UNKNOWN',
      txHash: '0x12',
      logIndex: 0n,
      detail: 'malformed transaction or block hash',
    });
    const upper = decodeLog({ ...canon, transactionHash: fakeHash('t7').toUpperCase().replace('0X', '0x') as Hex32 }, base);
    expect(upper.txHash).toBe(fakeHash('t7'));
  });

  it('pairs each ERC-20 log with one equal canonical log (two-log transfer)', () => {
    const pos = { txHash: fakeHash('t'), blockNumber: 1n, blockHash: fakeHash('b'), from: A, to: X };
    const c = (i: bigint, v: bigint, extra = {}): CanonicalLog => ({ ...pos, kind: 'CANONICAL', logIndex: i, value: nativeWei(v), ...extra });
    const e = (i: bigint, u: bigint, extra = {}): Erc20Log => ({ ...pos, kind: 'ERC20', logIndex: i, units: usdcUnits(u), ...extra });
    const T = 1_000_000_000_000n;
    expect(unpairedErc20([c(0n, 5n * T)], [e(1n, 5n)])).toBeNull();
    expect(unpairedErc20([c(0n, 5n * T)], [])).toBeNull();
    expect(unpairedErc20([c(0n, 5n * T + 1n)], [e(1n, 5n)])).toEqual(e(1n, 5n));
    expect(unpairedErc20([c(0n, 5n * T)], [e(1n, 5n), e(2n, 5n)])).toEqual(e(2n, 5n));
    expect(unpairedErc20([c(0n, 5n * T), c(2n, 5n * T)], [e(1n, 5n), e(3n, 5n)])).toBeNull();
    expect(unpairedErc20([c(0n, 5n * T, { txHash: fakeHash('other') })], [e(1n, 5n)])).not.toBeNull();
    expect(unpairedErc20([c(0n, 5n * T, { from: B })], [e(1n, 5n)])).not.toBeNull();
    expect(unpairedErc20([c(0n, 5n * T, { to: B })], [e(1n, 5n)])).not.toBeNull();
  });

  it('digest is sha256 over the sorted §10.3 projection', async () => {
    const { createHash } = await import('node:crypto');
    const log: CanonicalLog = {
      kind: 'CANONICAL',
      txHash: fakeHash('t'),
      logIndex: 2n,
      blockNumber: 1n,
      blockHash: fakeHash('b'),
      from: A,
      to: X,
      value: nativeWei(9n),
    };
    const expected = createHash('sha256')
      .update(
        `{"blockHash":"${fakeHash('b')}","chainId":"5042002","from":"${A}","logIndex":"2","status":"1","to":"${X}","txHash":"${fakeHash('t')}","value":"9"}`,
      )
      .digest('hex');
    expect(transferDigest(5042002n, log)).toBe(expected);
  });

  it('receiptGas refuses a malformed payer or negative gas fields', () => {
    expect(receiptGas(A, 1n, 2n)).toEqual({ payer: A, gasUsed: 1n, effectiveGasPrice: 2n });
    expect(receiptGas(A, 0n, 0n)).toEqual({ payer: A, gasUsed: 0n, effectiveGasPrice: 0n });
    expect(receiptGas('0x1', 1n, 2n)).toBeNull();
    expect(receiptGas(A, -1n, 2n)).toBeNull();
    expect(receiptGas(A, 1n, -1n)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('lowest', () => {
  it('is the smallest of start and every element, wherever it sits', () => {
    expect(lowest([5n, 2n, 9n], 7n)).toBe(2n);
    expect(lowest([1n, 3n, 3n], 3n)).toBe(1n);
    expect(lowest([4n, 6n], 3n)).toBe(3n);
    expect(lowest([], 8n)).toBe(8n);
  });
});

describe('ArcIndexer construction', () => {
  const store = new MapIndexerStore();
  const timing = new ManualTiming();
  const c = new InMemoryArcChain('c');

  it('needs exactly two distinct sources, or one under the testnet-only flag', async () => {
    expect(() => new ArcIndexer({ params: base, sources: [c], store, timing })).toThrow('two independent sources are required');
    expect(() => new ArcIndexer({ params: base, sources: [c, c, c], store, timing })).toThrow('two independent sources are required');
    expect(() => new ArcIndexer({ params: base, sources: [], store, timing })).toThrow('two independent sources are required');
    expect(() => new ArcIndexer({ params: { ...base, singleSourceTestnetOnly: true }, sources: [c, c, c], store, timing })).toThrow(RangeError);
    const single = new ArcIndexer({ params: { ...base, singleSourceTestnetOnly: true }, sources: [c], store, timing });
    expect(single.streamKey).toBe(`arc:5042002:${base.systemEmitter}`);
    expect(single.cursorKeyOf(A.toUpperCase().replace('0X', '0x') as NetworkAddress)).toBe(`arc:5042002:${base.systemEmitter}:${A}`);
    expect(await single.halt()).toBeNull();
    expect(() => new ArcIndexer({ params: base, sources: [c, c], store, timing })).toThrow('the two sources must be distinct, with distinct names (§6.3)');
    expect(() => new ArcIndexer({ params: base, sources: [c, new InMemoryArcChain('c')], store, timing })).toThrow(RangeError);
    expect(new ArcIndexer({ params: base, sources: [c, new InMemoryArcChain('d')], store, timing }).streamKey).toBe(single.streamKey);
  });

  it('runs on Arc testnet only', () => {
    const bad = (over: Record<string, unknown>) => () => new ArcIndexer({ params: { ...base, ...over } as ArcNetworkParams, sources: [c, c], store, timing });
    expect(bad({ chainId: 1n })).toThrow('the Arc indexer runs on Arc testnet only');
    expect(bad({ dfnsNetwork: 'Arc' })).toThrow('the Arc indexer runs on Arc testnet only');
  });
});

describe('ArcIndexer.poll', () => {
  it('one ERC-20 transfer (two logs, C-22) yields exactly one credit at 18 dp', async () => {
    const s = setup();
    const tx = erc20TransferTx(s.params, 'erc20', X, A, 7n);
    s.mine([tx]);
    const got = ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[];
    expect(got).toHaveLength(1);
    expect(got[0]).toEqual({
      network: 'ARC',
      chainId: 5042002n,
      txHash: tx.hash,
      logIndex: 0n,
      blockNumber: 1n,
      blockHash: fakeHash('arc-fake-block:1'),
      from: X,
      to: A,
      amount: 7_000_000_000_000n,
      receiptStatus: 1n,
      gas: { payer: X, gasUsed: 45_000n, effectiveGasPrice: 20_000_000_000n },
      sources: 2n,
      dedupeKey: `arc:5042002:${tx.hash}:0`,
      payloadDigest: (got[0] as ConfirmedTransfer).payloadDigest,
    });
    expect((got[0] as ConfirmedTransfer).payloadDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('an INTERNAL transfer (both queries match) is credited once; outbound and inbound both found; ordered by chain position', async () => {
    const s = setup();
    const t1 = nativeTransferTx(s.params, 'in', X, A, 1n);
    const t2 = nativeTransferTx(s.params, 'internal', A, B, 2n);
    const t3 = nativeTransferTx(s.params, 'out', B, Y, 3n);
    const t4 = nativeTransferTx(s.params, 'unrelated', X, Y, 4n);
    s.mine([t3]);
    s.mine([t1, t2, t4]);
    const got = ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[];
    expect(got.map((t) => [t.blockNumber, t.logIndex, t.amount])).toEqual([
      [1n, 0n, 3n],
      [2n, 0n, 1n],
      [2n, 1n, 2n],
    ]);
    expect(ok(await s.indexer.poll(OURS))).toEqual(got);
    await s.indexer.ack(got.map((t) => t.dedupeKey));
    expect(ok(await s.indexer.poll(OURS))).toEqual([]);
  });

  it('orders across queries by block first (an outbound log in a later block than an inbound one)', async () => {
    const s = setup();
    s.mine([nativeTransferTx(s.params, 'in-first', X, A, 1n)]);
    s.mine([nativeTransferTx(s.params, 'out-later', A, Y, 2n)]);
    const got = ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[];
    expect(got.map((t) => [t.blockNumber, t.amount])).toEqual([
      [1n, 1n],
      [2n, 2n],
    ]);
  });

  it('orders by block, then log index, whatever order the queries return (m9)', async () => {
    const s = setup();
    s.mine([nativeTransferTx(s.params, 'o0', A, Y, 1n), nativeTransferTx(s.params, 'o1', A, Y, 2n), nativeTransferTx(s.params, 'o2', A, Y, 3n)]);
    s.mine([nativeTransferTx(s.params, 'i0', X, A, 4n)]);
    const got = ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[];
    expect(got.map((t) => [t.blockNumber, t.logIndex])).toEqual([
      [1n, 0n],
      [1n, 1n],
      [1n, 2n],
      [2n, 0n],
    ]);
  });

  it('log comparison keeps field boundaries: a topic moved into data is a difference (m9)', async () => {
    const s = setup();
    s.mine([nativeTransferTx(s.params, 'shift', X, A, 1n)]);
    const shifted: RpcSource = {
      name: 'reference',
      head: () => s.chainB.head(),
      getReceipt: (h) => s.chainB.getReceipt(h),
      getLogs: async (f) => {
        const r = await s.chainB.getLogs(f);
        return r.ok ? { ok: true, value: r.value.map((l): RawLog => ({ ...l, topics: l.topics.slice(0, 2), data: `${l.topics[2] as string}${l.data.slice(2)}` as RawLog["data"] })) } : r;
      },
    };
    const ix = new ArcIndexer({ params: s.params, sources: [s.chainA, shifted], store: new MapIndexerStore(), timing: new ManualTiming() });
    expect(await ix.poll(OURS)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'RPC_DISAGREEMENT', detail: `blocks 1-1: log ${fakeHash('shift')}:0 differs between sources` },
    });
  });

  it('the next poll starts at cursor + 1', async () => {
    const s = setup();
    s.mine();
    s.mine();
    expect(ok(await s.indexer.poll(OURS))).toEqual([]);
    s.mine();
    expect(ok(await s.indexer.poll(OURS))).toEqual([]);
    expect(s.own.logRanges).toEqual([
      [1n, 2n],
      [1n, 2n],
      [3n, 3n],
      [3n, 3n],
    ]);
  });

  it('a lagging source catching up is not chain progress: stall is measured on the highest head', async () => {
    const s = setup();
    s.chainA.mineEmpty(3n);
    s.chainB.mine();
    expect(ok(await s.indexer.poll(OURS))).toEqual([]);
    s.timing.advance(30_000n);
    s.chainB.mine();
    expect(await s.indexer.poll(OURS)).toEqual({ kind: 'FAILED', failure: { kind: 'CHAIN_STALL', lastHead: 3n, sinceMs: 30_000n } });
  });

  it('RANGE_UNRECOVERABLE halts the indexer', async () => {
    const s = setup({}, new MapIndexerStore(), { resultCap: 1n });
    s.mine([nativeTransferTx(s.params, 'a', X, A, 1n), nativeTransferTx(s.params, 'b', X, A, 2n)]);
    const failed = { kind: 'FAILED', failure: { kind: 'RANGE_UNRECOVERABLE', source: 'own-node', from: 1n, to: 1n } };
    expect(await s.indexer.poll(OURS)).toEqual(failed);
    expect((await s.indexer.halt())).toEqual(failed.failure);
  });

  it('accepts addresses in any case (lower-cased before querying)', async () => {
    const s = setup();
    s.mine([nativeTransferTx(s.params, 'in', X, A, 1n)]);
    const got = ok(await s.indexer.poll(new Set([A.toUpperCase().replace('0X', '0x') as NetworkAddress]))) as readonly ConfirmedTransfer[];
    expect(got).toHaveLength(1);
  });

  it('pages from startBlock up to the lowest head minus confirmations, committing the cursor per page', async () => {
    const s = setup({ maxBlocksPerPage: 2n, confirmations: 1n, startBlock: 2n });
    s.mine([nativeTransferTx(s.params, 'before-start', X, A, 1n)]);
    s.mine([nativeTransferTx(s.params, 'p1', X, A, 2n)]);
    s.mine();
    s.mine([nativeTransferTx(s.params, 'p2', X, A, 3n)]);
    s.mine([nativeTransferTx(s.params, 'not-deep', X, A, 4n)]);
    s.chainA.mine();
    const got = ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[];
    expect(got.map((t) => t.amount)).toEqual([2n, 3n]);
    await s.indexer.ack(got.map((t) => t.dedupeKey));
    expect(s.own.logRanges).toEqual([
      [2n, 3n],
      [2n, 3n],
      [4n, 4n],
      [4n, 4n],
    ]);
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBe(4n);
    s.chainB.mine();
    expect((ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[]).map((t) => t.amount)).toEqual([4n]);
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBe(5n);
  });

  it('an empty address set reads nothing and does not move the cursor', async () => {
    const s = setup();
    s.mine([nativeTransferTx(s.params, 'in', X, A, 1n)]);
    expect(ok(await s.indexer.poll(new Set()))).toEqual([]);
    expect(s.own.logRanges).toEqual([]);
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBeNull();
  });

  it('single source under the testnet-only flag records sources: 1', async () => {
    const params = { ...base, singleSourceTestnetOnly: true };
    const chain = new InMemoryArcChain('only');
    chain.mine([nativeTransferTx(params, 'in', X, A, 1n)]);
    const ix = new ArcIndexer({ params, sources: [chain], store: new MapIndexerStore(), timing: new ManualTiming() });
    const got = ok(await ix.poll(OURS)) as readonly ConfirmedTransfer[];
    expect(got.map((t) => t.sources)).toEqual([1n]);
  });

  it('-32012 on a page is split and still yields every log', async () => {
    const s = setup();
    s.mine([nativeTransferTx(s.params, 'a', X, A, 1n)]);
    s.mine([nativeTransferTx(s.params, 'b', X, A, 2n)]);
    s.own.failNext('getLogs', { kind: 'RPC', code: -32012n, message: 'requested range too large' });
    expect((ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[]).map((t) => t.amount)).toEqual([1n, 2n]);
    expect(s.own.logRanges.slice(0, 3)).toEqual([
      [1n, 2n],
      [1n, 1n],
      [2n, 2n],
    ]);
  });

  it('-32014 is retried with backoff; exhausted → SOURCE_LAGGING (not sticky)', async () => {
    const s = setup({ retry: { initialMs: 100n, capMs: 1_000n, maxAttempts: 3n } });
    s.mine([nativeTransferTx(s.params, 'a', X, A, 1n)]);
    s.ref.failNext('getLogs', { kind: 'RPC', code: -32014n, message: 'block not imported' }, 2n);
    const firstPoll = ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[];
    expect(firstPoll).toHaveLength(1);
    await s.indexer.ack(firstPoll.map((t) => t.dedupeKey));
    expect(s.timing.slept).toEqual([50n, 100n]);
    s.mine([nativeTransferTx(s.params, 'b', X, A, 2n)]);
    s.ref.failNext('getLogs', { kind: 'RPC', code: -32014n, message: 'block not imported' }, 3n);
    expect(await s.indexer.poll(OURS)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'SOURCE_LAGGING', source: 'reference', detail: 'retries exhausted: block not imported' },
    });
    expect((await s.indexer.halt())).toBeNull();
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBe(1n);
    expect(ok(await s.indexer.poll(OURS))).toHaveLength(1);
  });

  it('an unknown error halts (SOURCE_STOPPED), keeps the cursor, and needs two distinct approvers to resume', async () => {
    const s = setup();
    s.mine([nativeTransferTx(s.params, 'a', X, A, 1n)]);
    s.own.failNext('getLogs', { kind: 'RPC', code: -32603n, message: 'internal error' });
    const stopped = { kind: 'FAILED', failure: { kind: 'SOURCE_STOPPED', source: 'own-node', code: -32603n, detail: 'internal error' } };
    expect(await s.indexer.poll(OURS)).toEqual(stopped);
    expect(await s.indexer.poll(OURS)).toEqual(stopped);
    expect(await s.indexer.head()).toEqual(stopped);
    expect(await s.indexer.confirmTx(fakeHash('a'))).toEqual(stopped);
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBeNull();
    await expect(s.indexer.resume('alice', 'alice')).rejects.toThrow('resume needs two distinct named approvers');
    await expect(s.indexer.resume(' alice ', 'alice')).rejects.toThrow(RangeError);
    expect((await s.indexer.halt())).toEqual(stopped.failure);
    await s.indexer.resume(' alice ', 'bob');
    expect((await s.indexer.halt())).toBeNull();
    expect((s.store as MapIndexerStore).resumedBy).toEqual([['alice', 'bob']]);
    await expect(s.indexer.resume('alice', 'bob')).rejects.toThrow('the indexer is not halted');
    expect(ok(await s.indexer.poll(OURS))).toHaveLength(1);
  });

  it('a log present on one source only → RPC_DISAGREEMENT, cursor frozen at the last agreed block', async () => {
    const s = setup({ maxBlocksPerPage: 1n });
    s.mine([nativeTransferTx(s.params, 'agreed', X, A, 1n)]);
    s.chainA.mine([nativeTransferTx(s.params, 'only-own', X, A, 2n)]);
    s.chainB.mine();
    const r = await s.indexer.poll(OURS);
    expect(r).toEqual({ kind: 'FAILED', failure: { kind: 'RPC_DISAGREEMENT', detail: `blocks 2-2: log ${fakeHash('only-own')}:0 missing from one source` } });
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBe(1n);
    expect((await s.indexer.halt())?.kind).toBe('RPC_DISAGREEMENT');
  });

  it('a log on the reference only, or with different content → RPC_DISAGREEMENT', async () => {
    const s = setup();
    s.chainA.mine();
    s.chainB.mine([nativeTransferTx(s.params, 'only-ref', X, A, 2n)]);
    const r = await s.indexer.poll(OURS);
    expect(r).toEqual({ kind: 'FAILED', failure: { kind: 'RPC_DISAGREEMENT', detail: `blocks 1-1: log ${fakeHash('only-ref')}:0 missing from one source` } });
    const t = setup();
    t.chainA.mine([nativeTransferTx(t.params, 'same', X, A, 2n)]);
    t.chainB.mine([nativeTransferTx(t.params, 'same', X, A, 3n)]);
    expect(await t.indexer.poll(OURS)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'RPC_DISAGREEMENT', detail: `blocks 1-1: log ${fakeHash('same')}:0 differs between sources` },
    });
  });

  it('two heads at one height with different hashes → RPC_DISAGREEMENT', async () => {
    const s = setup();
    s.chainA.mine([], fakeHash('fork-a'));
    s.chainB.mine([], fakeHash('fork-b'));
    expect(await s.indexer.head()).toEqual({ kind: 'FAILED', failure: { kind: 'RPC_DISAGREEMENT', detail: 'block 1 has two hashes' } });
    const t = setup();
    t.chainA.mine([], fakeHash('fork-a'));
    t.chainB.mine([], fakeHash('fork-a').toUpperCase().replace('0X', '0x') as Hex32);
    expect(ok(await t.indexer.head())).toEqual({ number: 1n, hash: fakeHash('fork-a') });
  });

  it('the agreed head is the lowest of the sources', async () => {
    const s = setup();
    s.mine();
    s.chainB.mine();
    s.chainB.mine();
    expect(ok(await s.indexer.head())).toEqual({ number: 1n, hash: fakeHash('arc-fake-block:1') });
    s.chainA.mine();
    s.chainA.mine();
    s.chainA.mine();
    expect(ok(await s.indexer.head())).toEqual({ number: 3n, hash: fakeHash('arc-fake-block:3') });
  });

  it('a source whose head fails with an unknown error halts; head lag exhausted is SOURCE_LAGGING', async () => {
    const s = setup({ retry: { initialMs: 1n, capMs: 1n, maxAttempts: 1n } });
    s.ref.failNext('head', { kind: 'TRANSPORT', message: 'refused' });
    expect(await s.indexer.poll(OURS)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'SOURCE_LAGGING', source: 'reference', detail: 'retries exhausted: refused' },
    });
    s.own.failNext('head', { kind: 'RPC', code: -32601n, message: 'method not found' });
    expect(await s.indexer.poll(OURS)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'SOURCE_STOPPED', source: 'own-node', code: -32601n, detail: 'method not found' },
    });
  });

  it('no head advance on any source for stallAfterMs → CHAIN_STALL; clears when a block arrives', async () => {
    const s = setup();
    s.mine();
    expect(ok(await s.indexer.poll(OURS))).toEqual([]);
    s.timing.advance(29_999n);
    expect(ok(await s.indexer.poll(OURS))).toEqual([]);
    s.timing.advance(1n);
    expect(await s.indexer.poll(OURS)).toEqual({ kind: 'FAILED', failure: { kind: 'CHAIN_STALL', lastHead: 1n, sinceMs: 30_000n } });
    expect(await s.indexer.head()).toEqual({ kind: 'FAILED', failure: { kind: 'CHAIN_STALL', lastHead: 1n, sinceMs: 30_000n } });
    expect((await s.indexer.halt())).toBeNull();
    s.mine();
    expect(ok(await s.indexer.poll(OURS))).toEqual([]);
    s.timing.advance(29_999n);
    expect(ok(await s.indexer.head())).toEqual({ number: 2n, hash: fakeHash('arc-fake-block:2') });
  });

  it('one source frozen while the other advances → SOURCE_LAGGING after stallAfterMs (m1, P2); clears when it moves', async () => {
    const s = setup();
    s.mine();
    expect(ok(await s.indexer.poll(OURS))).toEqual([]);
    for (let round = 1n; round <= 3n; round += 1n) {
      s.chainA.mine([nativeTransferTx(s.params, `frozen-b-${round}`, X, A, round)]);
      s.timing.advance(10_000n);
      const r = await s.indexer.poll(OURS);
      if (round < 3n) expect(r).toEqual({ kind: 'OK', value: [] });
      else expect(r).toEqual({ kind: 'FAILED', failure: { kind: 'SOURCE_LAGGING', source: 'reference', detail: 'head 1 has not advanced for 30000 ms while another source advanced' } });
    }
    expect(await s.indexer.head()).toMatchObject({ kind: 'FAILED', failure: { kind: 'SOURCE_LAGGING', source: 'reference' } });
    expect(await s.indexer.halt()).toBeNull();
    s.chainB.mine([nativeTransferTx(s.params, 'frozen-b-1', X, A, 1n)]);
    expect((ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[]).map((t) => t.amount)).toEqual([1n]);
    const t = setup();
    t.mine();
    expect(ok(await t.indexer.head())).toMatchObject({ number: 1n });
    t.chainB.mine();
    t.timing.advance(30_000n);
    t.chainB.mine();
    expect(await t.indexer.head()).toEqual({
      kind: 'FAILED',
      failure: { kind: 'SOURCE_LAGGING', source: 'own-node', detail: 'head 1 has not advanced for 30000 ms while another source advanced' },
    });
  });

  it('a source whose head falls beyond the tolerance or changes hash at the same height is stopped (no reorgs, C-50)', async () => {
    const back = setup({ headRegressionToleranceBlocks: 1n });
    back.mine();
    back.mine();
    back.mine();
    let height = 1n;
    let hash = fakeHash('arc-fake-block:1');
    const moving: RpcSource = { name: 'moving', head: async () => ({ ok: true, value: { number: height, hash } }), getLogs: (f) => back.chainB.getLogs(f), getReceipt: (h) => back.chainB.getReceipt(h) };
    const mv = new ArcIndexer({ params: back.params, sources: [back.chainA, moving], store: new MapIndexerStore(), timing: back.timing });
    expect(ok(await mv.head())).toMatchObject({ number: 1n });
    height = 3n;
    hash = fakeHash('arc-fake-block:3');
    expect(ok(await mv.head())).toMatchObject({ number: 3n });
    // m1: one block below the highest head it reported is a load-balanced backend behind (C-42): the agreed head just falls.
    height = 2n;
    hash = fakeHash('arc-fake-block:2');
    expect(ok(await mv.head())).toEqual({ number: 2n, hash });
    expect(await mv.halt()).toBeNull();
    height = 1n;
    hash = fakeHash('arc-fake-block:1');
    const backwards = {
      kind: 'FAILED',
      failure: { kind: 'SOURCE_STOPPED', source: 'moving', code: null, detail: `head moved from 3 ${fakeHash('arc-fake-block:3')} to 1 ${hash}` },
    };
    expect(await mv.head()).toEqual(backwards);
    expect(await mv.poll(OURS)).toEqual(backwards);
    // The resume resets the stored heads, so the old head 3 cannot halt it again; 1 is agreed now.
    await mv.resume('alice', 'bob');
    expect(ok(await mv.head())).toEqual({ number: 1n, hash });
    height = 1n;
    hash = fakeHash('other');
    expect(await mv.head()).toEqual({
      kind: 'FAILED',
      failure: { kind: 'SOURCE_STOPPED', source: 'moving', code: null, detail: `head moved from 1 ${fakeHash('arc-fake-block:1')} to 1 ${fakeHash('other')}` },
    });
    const zero = setup({ headRegressionToleranceBlocks: 0n });
    zero.mine();
    zero.mine();
    let h0 = 2n;
    const z: RpcSource = { name: 'z', head: async () => ({ ok: true, value: { number: h0, hash: fakeHash(`arc-fake-block:${h0}`) } }), getLogs: (f) => zero.chainB.getLogs(f), getReceipt: (h) => zero.chainB.getReceipt(h) };
    const zx = new ArcIndexer({ params: zero.params, sources: [zero.chainA, z], store: new MapIndexerStore(), timing: zero.timing });
    expect(ok(await zx.head())).toMatchObject({ number: 2n });
    h0 = 1n;
    expect(await zx.head()).toMatchObject({ kind: 'FAILED', failure: { kind: 'SOURCE_STOPPED', source: 'z' } });
  });

  it('liveness is stored with the stream: a restarted indexer still reports CHAIN_STALL and SOURCE_LAGGING (m4)', async () => {
    for (const store of [new MapIndexerStore(), new JournalIndexerStore()]) {
      const s = setup({}, store);
      s.mine();
      expect(ok(await s.indexer.head())).toMatchObject({ number: 1n });
      s.timing.advance(20_000n);
      const again = new ArcIndexer({ params: s.params, sources: [s.own, s.ref], store, timing: s.timing });
      expect(ok(await again.head())).toMatchObject({ number: 1n });
      s.timing.advance(10_000n);
      const third = new ArcIndexer({ params: s.params, sources: [s.own, s.ref], store, timing: s.timing });
      expect(await third.head()).toEqual({ kind: 'FAILED', failure: { kind: 'CHAIN_STALL', lastHead: 1n, sinceMs: 30_000n } });
      expect(await store.loadLiveness(third.streamKey)).toEqual({
        lastHead: 1n,
        lastAdvanceMs: 1_000_000n,
        sources: [
          { source: 'own-node', number: 1n, hash: fakeHash('arc-fake-block:1'), sinceMs: 1_000_000n },
          { source: 'reference', number: 1n, hash: fakeHash('arc-fake-block:1'), sinceMs: 1_000_000n },
        ],
      });
      s.chainA.mine();
      s.timing.advance(30_000n);
      s.chainA.mine();
      const fourth = new ArcIndexer({ params: s.params, sources: [s.own, s.ref], store, timing: s.timing });
      expect(await fourth.head()).toMatchObject({ kind: 'FAILED', failure: { kind: 'SOURCE_LAGGING', source: 'reference' } });
    }
  });

  it('a resume resets the stored liveness; heads from a source no longer configured are dropped', async () => {
    const store = new MapIndexerStore();
    const s = setup({}, store);
    s.mine();
    await store.saveLiveness(s.indexer.streamKey, {
      lastHead: 1n,
      lastAdvanceMs: 0n,
      sources: [{ source: 'retired', number: 9n, hash: fakeHash('x'), sinceMs: 0n }],
    });
    expect(await s.indexer.head()).toEqual({ kind: 'FAILED', failure: { kind: 'CHAIN_STALL', lastHead: 1n, sinceMs: 1_000_000n } });
    expect((await store.loadLiveness(s.indexer.streamKey))?.sources.map((h) => h.source)).toEqual(['own-node', 'reference']);
    await store.recordHalt(s.indexer.streamKey, { kind: 'RPC_DISAGREEMENT', detail: 'x' });
    await s.indexer.resume('alice', 'bob');
    expect(await store.loadLiveness(s.indexer.streamKey)).toBeNull();
    expect(ok(await s.indexer.head())).toMatchObject({ number: 1n });
  });

  it('an undecodable log → UNKNOWN_EVENT (halts)', async () => {
    const s = setup();
    const bad: ChainTx = { ...nativeTransferTx(s.params, 'bad', X, A, 1n), logs: [{ ...transferLog(s.params, s.params.systemEmitter, X, A, 1n), data: '0x' }] };
    s.mine([bad]);
    expect(await s.indexer.poll(OURS)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: bad.hash, logIndex: 0n, detail: 'malformed value word' },
    });
    expect((await s.indexer.halt())?.kind).toBe('UNKNOWN_EVENT');
  });

  it('an ERC-20 log whose value differs from the canonical log → UNKNOWN_EVENT', async () => {
    const s = setup();
    const t = erc20TransferTx(s.params, 'mismatch', X, A, 7n);
    const bad: ChainTx = { ...t, logs: [t.logs[0] as ChainTx['logs'][number], transferLog(s.params, s.params.usdcErc20, X, A, 8n)] };
    s.mine([bad]);
    expect(await s.indexer.poll(OURS)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: bad.hash, logIndex: 1n, detail: 'ERC-20 log without an equal canonical log (C-22)' },
    });
  });

  it('a log touching none of our addresses (a misbehaving source) → UNKNOWN_EVENT', async () => {
    const s = setup();
    const t = nativeTransferTx(s.params, 'foreign', X, Y, 1n);
    s.mine([t]);
    const inject = (inner: InMemoryArcChain): RpcSource => ({
      name: inner.name,
      head: () => inner.head(),
      getReceipt: (h) => inner.getReceipt(h),
      getLogs: async (f) => inner.getLogs({ ...f, topics: [f.topics[0], null, null] }),
    });
    const ix = new ArcIndexer({ params: s.params, sources: [inject(s.chainA), inject(s.chainB)], store: new MapIndexerStore(), timing: new ManualTiming() });
    expect(await ix.poll(OURS)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: t.hash, logIndex: 0n, detail: 'log touches none of our addresses' },
    });
  });

  it('one source returning two different logs at one position → SOURCE_STOPPED', async () => {
    const s = setup();
    const t = nativeTransferTx(s.params, 'dup', A, B, 1n);
    s.mine([t]);
    let calls = 0n;
    const flaky: RpcSource = {
      name: 'flaky',
      head: () => s.chainA.head(),
      getReceipt: (h) => s.chainA.getReceipt(h),
      getLogs: async (f) => {
        calls += 1n;
        const r = await s.chainA.getLogs(f);
        if (!r.ok || calls === 1n) return r;
        return { ok: true, value: r.value.map((l) => ({ ...l, data: word(2n) })) };
      },
    };
    const ix = new ArcIndexer({ params: s.params, sources: [flaky, s.chainB], store: new MapIndexerStore(), timing: new ManualTiming() });
    expect(await ix.poll(OURS)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'SOURCE_STOPPED', source: 'flaky', code: null, detail: `two different logs at ${t.hash}:0` },
    });
  });

  describe('receipts', () => {
    const withReceipt = (s: Setup, tweak: (r: RawReceipt) => RawReceipt | null, onlyOwn = false): ArcIndexer => {
      const wrap = (inner: InMemoryArcChain, apply: boolean): RpcSource => ({
        name: inner.name,
        head: () => inner.head(),
        getLogs: (f) => inner.getLogs(f),
        getReceipt: async (h) => {
          const r = await inner.getReceipt(h);
          return r.ok && r.value !== null && apply ? { ok: true, value: tweak(r.value) } : r;
        },
      });
      return new ArcIndexer({
        params: s.params,
        sources: [wrap(s.chainA, true), wrap(s.chainB, !onlyOwn)],
        store: new MapIndexerStore(),
        timing: new ManualTiming(),
      });
    };

    it('one receipt per transaction (two logs, one receipt read per source)', async () => {
      const s = setup();
      const t: ChainTx = { ...nativeTransferTx(s.params, 'multi', A, X, 1n), logs: [transferLog(s.params, s.params.systemEmitter, A, X, 1n), transferLog(s.params, s.params.systemEmitter, A, Y, 2n)] };
      s.mine([t]);
      let reads = 0n;
      const counting = (inner: InMemoryArcChain): RpcSource => ({
        name: inner.name,
        head: () => inner.head(),
        getLogs: (f) => inner.getLogs(f),
        getReceipt: (h) => {
          reads += 1n;
          return inner.getReceipt(h);
        },
      });
      const ix = new ArcIndexer({ params: s.params, sources: [counting(s.chainA), counting(s.chainB)], store: new MapIndexerStore(), timing: new ManualTiming() });
      expect((ok(await ix.poll(OURS)) as readonly ConfirmedTransfer[]).map((x) => x.logIndex)).toEqual([0n, 1n]);
      expect(reads).toBe(2n);
    });

    it('sources disagreeing on a receipt → RPC_DISAGREEMENT', async () => {
      const s = setup();
      const t = nativeTransferTx(s.params, 'r', X, A, 1n);
      s.mine([t]);
      expect(await withReceipt(s, (r) => ({ ...r, gasUsed: r.gasUsed + 1n }), true).poll(OURS)).toEqual({
        kind: 'FAILED',
        failure: { kind: 'RPC_DISAGREEMENT', detail: `sources disagree on the receipt of ${t.hash}` },
      });
      expect(await withReceipt(s, () => null, true).poll(OURS)).toEqual({
        kind: 'FAILED',
        failure: { kind: 'RPC_DISAGREEMENT', detail: `sources disagree on the receipt of ${t.hash}` },
      });
    });

    it('a log with no receipt anywhere → RPC_DISAGREEMENT', async () => {
      const s = setup();
      const t = nativeTransferTx(s.params, 'r', X, A, 1n);
      s.mine([t]);
      expect(await withReceipt(s, () => null).poll(OURS)).toEqual({
        kind: 'FAILED',
        failure: { kind: 'RPC_DISAGREEMENT', detail: `log ${t.hash}:0 has no receipt` },
      });
    });

    it('a receipt in another block than its log → RPC_DISAGREEMENT', async () => {
      const s = setup();
      const t = nativeTransferTx(s.params, 'r', X, A, 1n);
      s.mine([t]);
      const msg = { kind: 'FAILED', failure: { kind: 'RPC_DISAGREEMENT', detail: `receipt of ${t.hash} is in another block than its log` } };
      const moved = (r: RawReceipt, over: Partial<RawLog>): RawReceipt => ({ ...r, ...over, logs: r.logs.map((l) => ({ ...l, ...over })) });
      expect(await withReceipt(s, (r) => moved(r, { blockNumber: 9n })).poll(OURS)).toEqual(msg);
      expect(await withReceipt(s, (r) => moved(r, { blockHash: fakeHash('other') })).poll(OURS)).toEqual(msg);
      expect(ok(await withReceipt(s, (r) => ({ ...r, blockHash: r.blockHash.toUpperCase().replace('0X', '0x') as Hex32 })).poll(OURS))).toHaveLength(1);
    });

    it('a Transfer log in a status-0 receipt → UNKNOWN_EVENT; a status other than 0/1 → SOURCE_STOPPED', async () => {
      const s = setup();
      const t = nativeTransferTx(s.params, 'r', X, A, 1n);
      s.mine([t]);
      expect(await withReceipt(s, (r) => ({ ...r, status: 0n })).poll(OURS)).toEqual({
        kind: 'FAILED',
        failure: { kind: 'UNKNOWN_EVENT', txHash: t.hash, logIndex: 0n, detail: 'Transfer log in a transaction without status 1' },
      });
      expect(await withReceipt(s, (r) => ({ ...r, status: 2n })).poll(OURS)).toEqual({
        kind: 'FAILED',
        failure: { kind: 'SOURCE_STOPPED', source: 'all', code: null, detail: 'receipt status 2 is not 0 or 1' },
      });
    });

    it('a receipt of another transaction, or with a log of another transaction or block → SOURCE_STOPPED (m3)', async () => {
      const s = setup();
      const t = nativeTransferTx(s.params, 'r', X, A, 1n);
      s.mine([t]);
      const stopped = { kind: 'FAILED', failure: { kind: 'SOURCE_STOPPED', source: 'all', code: null, detail: `the receipt returned for ${t.hash} belongs to another transaction or block` } };
      const other = fakeHash('another-tx');
      expect(await withReceipt(s, (r) => ({ ...r, transactionHash: other })).poll(OURS)).toEqual(stopped);
      expect(await withReceipt(s, (r) => ({ ...r, logs: r.logs.map((l) => ({ ...l, transactionHash: other })) })).poll(OURS)).toEqual(stopped);
      expect(await withReceipt(s, (r) => ({ ...r, logs: r.logs.map((l) => ({ ...l, blockNumber: 9n })) })).poll(OURS)).toEqual(stopped);
      expect(await withReceipt(s, (r) => ({ ...r, logs: r.logs.map((l) => ({ ...l, blockHash: fakeHash('other') })) })).poll(OURS)).toEqual(stopped);
      const upper = (h: Hex32): Hex32 => h.toUpperCase().replace('0X', '0x') as Hex32;
      expect(
        ok(await withReceipt(s, (r) => ({ ...r, transactionHash: upper(r.transactionHash), logs: r.logs.map((l) => ({ ...l, transactionHash: upper(l.transactionHash), blockHash: upper(l.blockHash) })) })).poll(OURS)),
      ).toHaveLength(1);
    });

    it('a receipt that does not carry the credited log itself → RPC_DISAGREEMENT (m4)', async () => {
      const s = setup();
      const t = nativeTransferTx(s.params, 'r', X, A, 5n);
      s.mine([t]);
      const missing = { kind: 'FAILED', failure: { kind: 'RPC_DISAGREEMENT', detail: `receipt of ${t.hash} does not carry log 0` } };
      const swap = (over: Partial<RawLog>) => (r: RawReceipt): RawReceipt => ({ ...r, logs: r.logs.map((l) => ({ ...l, ...over })) });
      expect(await withReceipt(s, (r) => ({ ...r, logs: [] })).poll(OURS)).toEqual(missing);
      expect(await withReceipt(s, swap({ logIndex: 1n })).poll(OURS)).toEqual(missing);
      expect(await withReceipt(s, swap({ data: word(6n) })).poll(OURS)).toEqual(missing);
      expect(await withReceipt(s, swap({ topics: [s.params.transferTopic0, addressTopic(Y), addressTopic(A)] })).poll(OURS)).toEqual(missing);
      expect(await withReceipt(s, swap({ topics: [s.params.transferTopic0, addressTopic(X), addressTopic(B)] })).poll(OURS)).toEqual(missing);
      expect(await withReceipt(s, swap({ address: s.params.usdcErc20 })).poll(OURS)).toEqual(missing);
    });

    it('malformed gas fields → UNKNOWN_EVENT', async () => {
      const s = setup();
      const t = nativeTransferTx(s.params, 'r', X, A, 1n);
      s.mine([t]);
      expect(await withReceipt(s, (r) => ({ ...r, gasUsed: -1n })).poll(OURS)).toEqual({
        kind: 'FAILED',
        failure: { kind: 'UNKNOWN_EVENT', txHash: t.hash, logIndex: 0n, detail: 'malformed receipt gas fields' },
      });
    });

    it('a receipt read failure is a source failure', async () => {
      const s = setup({ retry: { initialMs: 1n, capMs: 1n, maxAttempts: 1n } });
      s.mine([nativeTransferTx(s.params, 'r', X, A, 1n)]);
      s.ref.failNext('getReceipt', { kind: 'RPC', code: -32000n, message: 'nope' });
      expect(await s.indexer.poll(OURS)).toEqual({ kind: 'FAILED', failure: { kind: 'SOURCE_STOPPED', source: 'reference', code: -32000n, detail: 'nope' } });
    });
  });

  it('a second writer moving the cursor → CURSOR_CONFLICT (halts)', async () => {
    const t = setup({}, new MapIndexerStore());
    t.mine([nativeTransferTx(t.params, 'a', X, A, 1n)]);
    const racing = storeWith({ commitPage: async (c) => ({ kind: 'CURSOR_CONFLICT', cursorKey: (c.cursors[0] as { cursorKey: string }).cursorKey, expected: null, actual: 7n }) });
    const ix = new ArcIndexer({ params: t.params, sources: [t.chainA, t.chainB], store: racing, timing: new ManualTiming() });
    expect(await ix.poll(OURS)).toEqual({ kind: 'FAILED', failure: { kind: 'CURSOR_CONFLICT', expected: null, actual: 7n } });
    expect((await ix.halt())?.kind).toBe('CURSOR_CONFLICT');
  });

  it('a stored signal with a different digest → RPC_DISAGREEMENT', async () => {
    const s = setup();
    const t = nativeTransferTx(s.params, 'a', X, A, 1n);
    s.mine([t]);
    const conflicting = storeWith({ commitPage: async () => ({ kind: 'SIGNAL_CONFLICT', key: 'k1' }) });
    const ix = new ArcIndexer({ params: s.params, sources: [s.chainA, s.chainB], store: conflicting, timing: new ManualTiming() });
    expect(await ix.poll(OURS)).toEqual({ kind: 'FAILED', failure: { kind: 'RPC_DISAGREEMENT', detail: 'stored signal k1 differs from the chain' } });
  });

  it('returns the unacknowledged inbox: the same until ack, then only what is left (exactly once, B1)', async () => {
    const s = setup();
    s.mine([nativeTransferTx(s.params, 'a', X, A, 1n), nativeTransferTx(s.params, 'b', X, A, 2n)]);
    const got = ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[];
    expect(got.map((t) => t.amount)).toEqual([1n, 2n]);
    expect(ok(await s.indexer.poll(OURS))).toEqual(got);
    expect(await s.indexer.ack([(got[0] as ConfirmedTransfer).dedupeKey])).toEqual({ kind: 'ACKED' });
    expect((ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[]).map((t) => t.amount)).toEqual([2n]);
    expect((await s.indexer.pending()).map((t) => t.amount)).toEqual([2n]);
    expect(await s.indexer.ack(['nope'])).toEqual({ kind: 'UNKNOWN_KEY', key: 'nope' });
  });

  it('a failure on page 2 keeps page 1 committed and delivered (P1)', async () => {
    const s = setup({ maxBlocksPerPage: 2n });
    s.mine([nativeTransferTx(s.params, 'p1', X, A, 1n)]);
    s.mine();
    s.mine([nativeTransferTx(s.params, 'p2', X, A, 2n)]);
    const lagFrom3: RpcSource = {
      name: 'own-node',
      head: () => s.chainA.head(),
      getReceipt: (h) => s.chainA.getReceipt(h),
      getLogs: async (f) => (f.fromBlock >= 3n ? { ok: false, error: { kind: 'RPC', code: -32014n, message: 'lag' } } : s.chainA.getLogs(f)),
    };
    const store = new JournalIndexerStore();
    const ix = new ArcIndexer({ params: s.params, sources: [lagFrom3, s.chainB], store, timing: new ManualTiming() });
    expect(await ix.poll(OURS)).toEqual({ kind: 'FAILED', failure: { kind: 'SOURCE_LAGGING', source: 'own-node', detail: 'retries exhausted: lag' } });
    expect((await ix.pending()).map((t) => t.amount)).toEqual([1n]);
    const ix2 = new ArcIndexer({ params: s.params, sources: [s.chainA, s.chainB], store, timing: new ManualTiming() });
    expect((ok(await ix2.poll(OURS)) as readonly ConfirmedTransfer[]).map((t) => t.amount)).toEqual([1n, 2n]);
  });

  it('a sticky halt is stored: a restarted indexer on the same store stays halted (m2, P3)', async () => {
    const s = setup();
    s.chainA.mine([nativeTransferTx(s.params, 'only-own', X, A, 1n)]);
    s.chainB.mine();
    const r = await s.indexer.poll(OURS);
    expect(r.kind === 'FAILED' && r.failure.kind).toBe('RPC_DISAGREEMENT');
    const restarted = new ArcIndexer({ params: s.params, sources: [s.chainA, new InMemoryArcChain('other')], store: s.store, timing: new ManualTiming() });
    expect(await restarted.poll(OURS)).toEqual(r);
    expect(await restarted.halt()).toEqual((r as { failure: NetworkFailure }).failure);
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBeNull();
  });

  it('a newly added address is scanned from startBlock; groups catch up and merge (m7)', async () => {
    const s = setup({ maxBlocksPerPage: 2n });
    s.mine([nativeTransferTx(s.params, 'to-b-early', X, B, 7n)]);
    s.mine([nativeTransferTx(s.params, 'to-a', X, A, 1n)]);
    s.mine([nativeTransferTx(s.params, 'internal', A, B, 2n)]);
    expect((ok(await s.indexer.poll(new Set([A]))) as readonly ConfirmedTransfer[]).map((t) => t.amount)).toEqual([1n, 2n]);
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBe(3n);
    s.mine([nativeTransferTx(s.params, 'to-b-late', X, B, 3n)]);
    const all = ok(await s.indexer.poll(OURS)) as readonly ConfirmedTransfer[];
    expect(all.map((t) => t.amount)).toEqual([1n, 2n, 7n, 3n]);
    expect(s.own.logRanges.slice(4)).toEqual([
      [1n, 2n],
      [1n, 2n],
      [3n, 3n],
      [3n, 3n],
      [4n, 4n],
      [4n, 4n],
    ]);
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBe(4n);
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(B))).toBe(4n);
  });

  it('three addresses at different cursors: the lowest group catches up alone, never moving another cursor back (m7)', async () => {
    const C = fakeAddress('ours-c');
    const s = setup();
    let moves: string[] = [];
    const inner = new MapIndexerStore();
    const store = storeWith({
      loadCursor: (k) => inner.loadCursor(k),
      commitPage: (c) => {
        moves = [...moves, c.cursors.map((m) => `${m.cursorKey.slice(-4)}:${m.expected}->${m.next}`).join(',')];
        return inner.commitPage(c);
      },
      unacknowledged: (st) => inner.unacknowledged(st),
    });
    const ix = new ArcIndexer({ params: s.params, sources: [s.chainA, s.chainB], store, timing: s.timing });
    s.mine();
    expect(ok(await ix.poll(new Set([A])))).toEqual([]);
    s.mine();
    expect(ok(await ix.poll(new Set([A, B])))).toEqual([]);
    s.mine([nativeTransferTx(s.params, 'to-c', X, C, 9n)]);
    expect((ok(await ix.poll(new Set([B, A, C]))) as readonly ConfirmedTransfer[]).map((t) => t.amount)).toEqual([9n]);
    const tail = (a: NetworkAddress): string => a.slice(-4);
    expect(moves).toEqual([
      `${tail(A)}:null->1`,
      `${tail(B)}:null->1`,
      `${tail(A)}:1->2,${tail(B)}:1->2`,
      `${tail(C)}:null->2`,
      `${tail(B)}:2->3,${tail(A)}:2->3,${tail(C)}:2->3`,
    ]);
  });

  it('an address whose cursor is already past the indexable head is left alone', async () => {
    const s = setup({ confirmations: 1n });
    s.mine();
    s.mine();
    expect(ok(await s.indexer.poll(new Set([A])))).toEqual([]);
    expect(await s.store.loadCursor(s.indexer.cursorKeyOf(A))).toBe(1n);
    const ix = new ArcIndexer({ params: { ...s.params, confirmations: 2n }, sources: [s.chainA, s.chainB], store: s.store, timing: new ManualTiming() });
    expect(ok(await ix.poll(new Set([A])))).toEqual([]);
    expect(s.own.logRanges).toEqual([
      [1n, 1n],
      [1n, 1n],
    ]);
  });
});

describe('ArcIndexer.confirmTx', () => {
  it('returns the transaction with its transfers and gas once it is at or below the agreed head', async () => {
    const s = setup({ confirmations: 1n });
    const t = erc20TransferTx(s.params, 'c', A, X, 3n);
    s.mine([t]);
    expect(await s.indexer.confirmTx(t.hash)).toEqual({ kind: 'OK', value: null });
    s.mine();
    const r = ok(await s.indexer.confirmTx(t.hash.toUpperCase().replace('0X', '0x') as Hex32)) as unknown as { transfers: ConfirmedTransfer[] };
    expect(r).toMatchObject({
      txHash: t.hash,
      blockNumber: 1n,
      blockHash: fakeHash('arc-fake-block:1'),
      receiptStatus: 1n,
      gas: { payer: A, gasUsed: 45_000n, effectiveGasPrice: 20_000_000_000n },
      sources: 2n,
    });
    expect(r.transfers.map((x) => [x.logIndex, x.amount])).toEqual([[0n, 3_000_000_000_000n]]);
  });

  it('a status-0 receipt is returned with no transfers and its gas (C-53, F-3c)', async () => {
    const s = setup();
    const t: ChainTx = { ...nativeTransferTx(s.params, 'rev', A, X, 1n), status: 0n };
    s.mine([t]);
    expect(ok(await s.indexer.confirmTx(t.hash))).toEqual({
      txHash: t.hash,
      blockNumber: 1n,
      blockHash: fakeHash('arc-fake-block:1'),
      receiptStatus: 0n,
      gas: { payer: A, gasUsed: 21_000n, effectiveGasPrice: 20_000_000_000n },
      transfers: [],
      sources: 2n,
    });
  });

  const tweaked = (s: Setup, tweak: (r: RawReceipt) => RawReceipt): ArcIndexer => {
    const wrap = (inner: InMemoryArcChain): RpcSource => ({
      name: inner.name,
      head: () => inner.head(),
      getLogs: (f) => inner.getLogs(f),
      getReceipt: async (h) => {
        const r = await inner.getReceipt(h);
        return r.ok && r.value !== null ? { ok: true, value: tweak(r.value) } : r;
      },
    });
    return new ArcIndexer({ params: s.params, sources: [wrap(s.chainA), wrap(s.chainB)], store: new MapIndexerStore(), timing: new ManualTiming() });
  };

  it('fails closed on a reverted receipt with logs, a malformed system log, an unpaired ERC-20 log or bad gas', async () => {
    const s = setup();
    const t = erc20TransferTx(s.params, 'c', A, X, 3n);
    s.mine([t]);
    expect(await tweaked(s, (r) => ({ ...r, status: 0n })).confirmTx(t.hash)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: t.hash, logIndex: -1n, detail: 'a reverted transaction carries logs' },
    });
    expect(await tweaked(s, (r) => ({ ...r, logs: r.logs.map((l, i) => (i === 0 ? { ...l, data: '0x' } : l)) })).confirmTx(t.hash)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: t.hash, logIndex: 0n, detail: 'malformed value word' },
    });
    expect(await tweaked(s, (r) => ({ ...r, logs: r.logs.slice(1) })).confirmTx(t.hash)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: t.hash, logIndex: 1n, detail: 'ERC-20 log without an equal canonical log (C-22)' },
    });
    expect(await tweaked(s, (r) => ({ ...r, from: '0xzz' as NetworkAddress })).confirmTx(t.hash)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: t.hash, logIndex: -1n, detail: 'malformed receipt gas fields' },
    });
  });

  it('ignores other contracts\' logs in the receipt (an Approval, a Memo event)', async () => {
    const s = setup();
    const t = nativeTransferTx(s.params, 'c', A, X, 3n);
    s.mine([t]);
    const approval = { ...transferLog(s.params, s.params.usdcErc20, A, X, 1n), topics: [fakeHash('Approval')] };
    const memo = { ...transferLog(s.params, Y, A, X, 1n) };
    const ix = tweaked(s, (r) => ({
      ...r,
      logs: [...r.logs, { ...(r.logs[0] as RawLog), ...approval, logIndex: 1n }, { ...(r.logs[0] as RawLog), ...memo, logIndex: 2n }],
    }));
    const got = ok(await ix.confirmTx(t.hash)) as unknown as { transfers: ConfirmedTransfer[] };
    expect(got.transfers.map((x) => x.amount)).toEqual([3n]);
  });

  it('one source has the receipt and the other not, though its head has reached the block → RPC_DISAGREEMENT; a head failure is returned', async () => {
    const s = setup();
    const t = nativeTransferTx(s.params, 'c', A, X, 3n);
    s.chainA.mine([t]);
    s.chainB.mine();
    expect(await s.indexer.confirmTx(t.hash)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'RPC_DISAGREEMENT', detail: `sources disagree on the receipt of ${t.hash}` },
    });
    const v = setup();
    v.chainA.mine();
    v.chainB.mine([t]);
    expect(await v.indexer.confirmTx(t.hash)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'RPC_DISAGREEMENT', detail: `sources disagree on the receipt of ${t.hash}` },
    });
    const u = setup({ retry: { initialMs: 1n, capMs: 1n, maxAttempts: 1n } });
    u.own.failNext('head', { kind: 'TRANSPORT', message: 'down' });
    expect(await u.indexer.confirmTx(t.hash)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'SOURCE_LAGGING', source: 'own-node', detail: 'retries exhausted: down' },
    });
  });
});

describe('ArcIndexer.confirmTx receipt race (m1)', () => {
  it('a receipt only on a source ahead of the other is "not yet confirmed", then confirmed when both have it', async () => {
    for (const ahead of ['own', 'ref'] as const) {
      const s = setup();
      const t = nativeTransferTx(s.params, 'race', A, X, 3n);
      s.mine();
      const [fast, slow] = ahead === 'own' ? [s.chainA, s.chainB] : [s.chainB, s.chainA];
      fast.mine([t]);
      expect(await s.indexer.confirmTx(t.hash)).toEqual({ kind: 'OK', value: null });
      expect(await s.indexer.halt()).toBeNull();
      slow.mine([t]);
      const got = ok(await s.indexer.confirmTx(t.hash)) as unknown as { transfers: ConfirmedTransfer[]; blockNumber: bigint };
      expect(got.blockNumber).toBe(2n);
      expect(got.transfers.map((x) => x.amount)).toEqual([3n]);
    }
  });

  it('two different receipts are a disagreement even above the agreed head', async () => {
    const s = setup();
    const t = nativeTransferTx(s.params, 'race', A, X, 3n);
    s.chainA.mine([t]);
    s.chainB.mine([{ ...t, gasUsed: 1n }]);
    s.chainA.mine();
    expect(await s.indexer.confirmTx(t.hash)).toEqual({ kind: 'FAILED', failure: { kind: 'RPC_DISAGREEMENT', detail: `sources disagree on the receipt of ${t.hash}` } });
  });

  it('a malformed USDC ERC-20 Transfer log in the receipt fails closed, like poll (m4)', async () => {
    const s = setup();
    const t = erc20TransferTx(s.params, 'bad-erc20', A, X, 3n);
    s.mine([t]);
    const make = (tweak: (l: RawLog) => RawLog): ArcIndexer => {
      const wrap = (inner: InMemoryArcChain): RpcSource => ({
        name: inner.name,
        head: () => inner.head(),
        getLogs: (f) => inner.getLogs(f),
        getReceipt: async (h) => {
          const r = await inner.getReceipt(h);
          return r.ok && r.value !== null ? { ok: true, value: { ...r.value, logs: r.value.logs.map((l, i) => (i === 1 ? tweak(l) : l)) } } : r;
        },
      });
      return new ArcIndexer({ params: s.params, sources: [wrap(s.chainA), wrap(s.chainB)], store: new MapIndexerStore(), timing: new ManualTiming() });
    };
    expect(await make((l) => ({ ...l, data: '0x' })).confirmTx(t.hash)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: t.hash, logIndex: 1n, detail: 'malformed value word' },
    });
    expect(await make((l) => ({ ...l, address: l.address.toUpperCase().replace('0X', '0x') as NetworkAddress, topics: [...l.topics, fakeHash('extra')] })).confirmTx(t.hash)).toEqual({
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: t.hash, logIndex: 1n, detail: 'unexpected extra topics' },
    });
    const approvalTopic = make((l) => ({ ...l, topics: [fakeHash('Approval'), ...l.topics.slice(1)] }));
    expect((ok(await approvalTopic.confirmTx(t.hash)) as unknown as { transfers: ConfirmedTransfer[] }).transfers).toHaveLength(1);
    const upperTopic = make((l) => ({ ...l, topics: [(l.topics[0] as string).toUpperCase().replace('0X', '0x') as Hex32, ...l.topics.slice(1)], data: '0x' }));
    expect(await upperTopic.confirmTx(t.hash)).toMatchObject({ kind: 'FAILED', failure: { kind: 'UNKNOWN_EVENT', logIndex: 1n } });
    const noTopics = make((l) => ({ ...l, topics: [] }));
    expect((ok(await noTopics.confirmTx(t.hash)) as unknown as { transfers: ConfirmedTransfer[] }).transfers).toHaveLength(1);
  });
});

describe.each([
  ['MapIndexerStore', () => new MapIndexerStore()],
  ['JournalIndexerStore', () => new JournalIndexerStore()],
] as const)('IndexerStore contract: %s', (_n, make) => {
  const transfer = (key: string, digest: string): ConfirmedTransfer => ({ dedupeKey: key, payloadDigest: digest }) as ConfirmedTransfer;

  const page = (expected: bigint | null, next: bigint, transfers: readonly ConfirmedTransfer[], keys: readonly string[] = ['k']) => ({
    streamKey: 'st',
    cursors: keys.map((cursorKey) => ({ cursorKey, expected, next })),
    transfers,
  });

  it('commits atomically, dedupes re-deliveries, refuses conflicts without applying anything', async () => {
    const st = make();
    expect(await st.loadCursor('k')).toBeNull();
    expect(await st.commitPage(page(null, 5n, [transfer('a', '1'), transfer('a', '1'), transfer('b', '2')]))).toEqual({
      kind: 'COMMITTED',
      inserted: ['a', 'b'],
    });
    expect(await st.loadCursor('k')).toBe(5n);
    expect(await st.loadCursor('other')).toBeNull();
    expect(await st.commitPage(page(null, 6n, []))).toEqual({ kind: 'CURSOR_CONFLICT', cursorKey: 'k', expected: null, actual: 5n });
    expect(await st.commitPage(page(5n, 6n, [transfer('c', '3'), transfer('a', 'X')]))).toEqual({ kind: 'SIGNAL_CONFLICT', key: 'a' });
    expect(await st.commitPage(page(5n, 6n, [transfer('d', '4'), transfer('d', 'Y')]))).toEqual({ kind: 'SIGNAL_CONFLICT', key: 'd' });
    expect(await st.loadCursor('k')).toBe(5n);
    expect(st.keys()).toEqual(['a', 'b']);
    expect(await st.commitPage(page(5n, 9n, [transfer('b', '2'), transfer('c', '3')]))).toEqual({ kind: 'COMMITTED', inserted: ['c'] });
    expect(await st.loadCursor('k')).toBe(9n);
    expect(st.keys()).toEqual(['a', 'b', 'c']);
  });

  it('moves several cursors in one commit, all or none', async () => {
    const st = make();
    expect(await st.commitPage(page(null, 3n, [transfer('a', '1')], ['k1', 'k2']))).toEqual({ kind: 'COMMITTED', inserted: ['a'] });
    expect([await st.loadCursor('k1'), await st.loadCursor('k2')]).toEqual([3n, 3n]);
    const mixed = { streamKey: 'st', cursors: [{ cursorKey: 'k1', expected: 3n, next: 4n }, { cursorKey: 'k2', expected: 2n, next: 4n }], transfers: [transfer('b', '2')] };
    expect(await st.commitPage(mixed)).toEqual({ kind: 'CURSOR_CONFLICT', cursorKey: 'k2', expected: 2n, actual: 3n });
    expect([await st.loadCursor('k1'), await st.loadCursor('k2')]).toEqual([3n, 3n]);
    expect(st.keys()).toEqual(['a']);
  });

  it('keeps committed transfers unacknowledged per stream until acknowledged (all or none)', async () => {
    const st = make();
    await st.commitPage(page(null, 1n, [transfer('a', '1'), transfer('b', '2')]));
    await st.commitPage({ streamKey: 'other', cursors: [], transfers: [transfer('z', '9')] });
    expect((await st.unacknowledged('st')).map((t) => t.dedupeKey)).toEqual(['a', 'b']);
    expect(await st.acknowledge('st', ['a', 'z'])).toEqual({ kind: 'UNKNOWN_KEY', key: 'z' });
    expect(await st.acknowledge('st', ['a', 'never'])).toEqual({ kind: 'UNKNOWN_KEY', key: 'never' });
    expect((await st.unacknowledged('st')).map((t) => t.dedupeKey)).toEqual(['a', 'b']);
    expect(await st.acknowledge('st', ['a', 'a'])).toEqual({ kind: 'ACKED' });
    expect((await st.unacknowledged('st')).map((t) => t.dedupeKey)).toEqual(['b']);
    expect((await st.unacknowledged('other')).map((t) => t.dedupeKey)).toEqual(['z']);
    await st.commitPage(page(1n, 2n, [transfer('a', '1')]));
    expect((await st.unacknowledged('st')).map((t) => t.dedupeKey)).toEqual(['b']);
  });

  it('stores one halt per stream (the first is kept) until cleared with two approvers', async () => {
    const st = make();
    const f1: NetworkFailure = { kind: 'RPC_DISAGREEMENT', detail: 'one' };
    const f2: NetworkFailure = { kind: 'UNKNOWN_EVENT', txHash: fakeHash('t'), logIndex: 0n, detail: 'two' };
    expect(await st.loadHalt('st')).toBeNull();
    await st.recordHalt('st', f1);
    await st.recordHalt('st', f2);
    expect(await st.loadHalt('st')).toEqual(f1);
    expect(await st.loadHalt('other')).toBeNull();
    await st.clearHalt('st', ['alice', 'bob']);
    expect(await st.loadHalt('st')).toBeNull();
    await st.recordHalt('st', f2);
    expect(await st.loadHalt('st')).toEqual(f2);
    await st.clearHalt('other', ['carol', 'dave']);
    expect(await st.loadHalt('st')).toEqual(f2);
    expect(st.resumedBy).toEqual([
      ['alice', 'bob'],
      ['carol', 'dave'],
    ]);
  });

  it('stores one liveness state per stream; null resets it', async () => {
    const st = make();
    const l1 = { lastHead: 1n, lastAdvanceMs: 5n, sources: [{ source: 'a', number: 1n, hash: '0x01', sinceMs: 5n }] };
    const l2 = { lastHead: 2n, lastAdvanceMs: 7n, sources: [] };
    expect(await st.loadLiveness('st')).toBeNull();
    await st.saveLiveness('st', l1);
    await st.saveLiveness('other', l2);
    expect(await st.loadLiveness('st')).toEqual(l1);
    await st.saveLiveness('st', l2);
    expect(await st.loadLiveness('st')).toEqual(l2);
    await st.saveLiveness('st', null);
    expect(await st.loadLiveness('st')).toBeNull();
    expect(await st.loadLiveness('other')).toEqual(l2);
  });
});

describe('fakes', () => {
  it('InMemoryArcChain enforces the C-40 range cap and filters by emitter and topics', async () => {
    const chain = new InMemoryArcChain('c');
    expect(chain.mineEmpty(2n)).toBe(2n);
    const f = (from: bigint, to: bigint): LogFilter => ({ fromBlock: from, toBlock: to, addresses: [base.systemEmitter], topics: [base.transferTopic0, null, null] });
    expect(await chain.getLogs(f(1n, 10_000n))).toEqual({ ok: true, value: [] });
    expect(await chain.getLogs(f(1n, 10_001n))).toEqual({ ok: false, error: { kind: 'RPC', code: -32012n, message: 'requested range too large' } });
    expect(await chain.getReceipt(fakeHash('none'))).toEqual({ ok: true, value: null });
  });

  it('ManualTiming returns scripted randoms then 0', () => {
    const t = new ManualTiming(5n, [2n]);
    expect(t.now()).toBe(5n);
    expect(t.random(10n)).toBe(2n);
    expect(t.random(10n)).toBe(0n);
    expect(t.randomBounds).toEqual([10n, 10n]);
  });
});
