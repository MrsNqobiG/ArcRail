/**
 * U3 chain client (READ path): paging (C-40), fault injection per error code
 * (RUBRIC MC-16: -32012, -32602, -32014, -32603 "Blocked address", unknown),
 * dual-source quorum (DR-02, CONTRACT §1.6) and stall detection (Q-A7).
 * Every source is an in-memory fake transport. No live network.
 */
import { describe, expect, it, vi } from 'vitest';
import { ARC_TESTNET } from '../../src/chain/config/index.js';
import {
  ChainReaderConfigError,
  classifyRpcError,
  createChainReader,
  pageBlockRange,
  type ChainReaderOptions,
  type ReadResult,
  type RpcTransport,
} from '../../src/chain/client/index.js';
import { createViemTransport } from '../../src/chain/client/viem-transport.js';
import { SYSTEM_EMITTER, TRANSFER_TOPIC0, blockHash, fakeNode, hex, mkLog, rpcError, word, type FakeNode, type FakeNodeOptions } from './client-fake-rpc.js';

const OWN = 'http://own-0.invalid';
const OWN1 = 'http://own-1.invalid';
const REF = 'http://reference.invalid';

interface Rig {
  readonly nodes: Record<string, FakeNode>;
  readonly sleeps: bigint[];
  readonly clock: { now: bigint };
  readonly reader: ReturnType<typeof createChainReader>;
}

function rig(nodes: Record<string, FakeNode>, over: Partial<ChainReaderOptions> = {}): Rig {
  const sleeps: bigint[] = [];
  const clock = { now: 1_000n };
  const urls = Object.keys(nodes);
  const reader = createChainReader({
    chain: ARC_TESTNET,
    ownNodeUrls: urls.filter((u) => u !== REF),
    referenceUrl: REF,
    aStallMs: 30_000n,
    retry: { maxRetries: 3n, baseDelayMs: 100n, maxDelayMs: 1_000n },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    nowMs: () => clock.now,
    random: () => 0n,
    transportFor: (url) => {
      const n = nodes[url];
      if (n === undefined) throw new Error(`no fake for ${url}`);
      return n;
    },
    ...over,
  });
  return { nodes, sleeps, clock, reader };
}

/** Two fakes (own#0 and reference) serving the same chain. */
function pair(o: FakeNodeOptions = {}, ref: FakeNodeOptions = o): Record<string, FakeNode> {
  return { [OWN]: fakeNode(o), [REF]: fakeNode(ref) };
}

function expectStop<T>(r: ReadResult<T>): Extract<ReadResult<T>, { kind: 'STOP' }> {
  if (r.kind !== 'STOP') throw new Error(`expected STOP, got ${r.kind}`);
  return r;
}

const logsCalls = (n: FakeNode): { from: bigint; to: bigint }[] =>
  n.calls
    .filter((c) => c.method === 'eth_getLogs')
    .map((c) => {
      const q = c.params[0] as { fromBlock: string; toBlock: string };
      return { from: BigInt(q.fromBlock), to: BigInt(q.toBlock) };
    });

describe('pageBlockRange (C-40: pages of at most 9,999 blocks)', () => {
  it('pages [0, 19998] into 9,999-block windows plus the remainder', () => {
    expect(pageBlockRange(0n, 19_998n, ARC_TESTNET.getLogsMaxBlocksPerPage)).toEqual([
      { fromBlock: 0n, toBlock: 9_998n },
      { fromBlock: 9_999n, toBlock: 19_997n },
      { fromBlock: 19_998n, toBlock: 19_998n },
    ]);
  });

  it('an exact multiple has no remainder page; a single block is one page', () => {
    expect(pageBlockRange(10n, 19n, 5n)).toEqual([
      { fromBlock: 10n, toBlock: 14n },
      { fromBlock: 15n, toBlock: 19n },
    ]);
    expect(pageBlockRange(7n, 7n, 9_999n)).toEqual([{ fromBlock: 7n, toBlock: 7n }]);
    expect(pageBlockRange(0n, 2n, 1n)).toEqual([
      { fromBlock: 0n, toBlock: 0n },
      { fromBlock: 1n, toBlock: 1n },
      { fromBlock: 2n, toBlock: 2n },
    ]);
  });

  it('every page is contiguous, ordered and at most maxBlocksPerPage blocks', () => {
    const pages = pageBlockRange(123n, 54_321n, 9_999n);
    let next = 123n;
    for (const p of pages) {
      expect(p.fromBlock).toBe(next);
      expect(p.toBlock - p.fromBlock + 1n <= 9_999n).toBe(true);
      next = p.toBlock + 1n;
    }
    expect(next).toBe(54_322n);
  });

  it('rejects a negative start, an inverted range and a page size below 1', () => {
    expect(() => pageBlockRange(-1n, 5n, 10n)).toThrow(RangeError);
    expect(() => pageBlockRange(6n, 5n, 10n)).toThrow(RangeError);
    expect(() => pageBlockRange(0n, 5n, 0n)).toThrow(RangeError);
    expect(pageBlockRange(0n, 0n, 1n)).toHaveLength(1);
  });
});

describe('classifyRpcError (MC-16)', () => {
  it.each([
    [rpcError(-32012, 'requested range too large'), 'RANGE_TOO_LARGE'],
    [rpcError(-32602, 'query exceeds max results 2000'), 'RESULT_CAP'],
    [rpcError(-32014, 'block not yet imported'), 'HEAD_LAG'],
    [rpcError(-32603, 'Blocked address'), 'BLOCKED_ADDRESS'],
    [{ code: -32603, details: 'Blocked address', message: 'An internal error was received.' }, 'BLOCKED_ADDRESS'],
    [{ code: -32603, details: 7, message: 'Blocked address' }, 'BLOCKED_ADDRESS'],
    [rpcError(-32603, 'blocked address'), 'UNCLASSIFIED'],
    [rpcError(-32603, 'Blocked address.'), 'UNCLASSIFIED'],
    [rpcError(-32000, 'Blocked address'), 'UNCLASSIFIED'],
    [{ code: -32603 }, 'UNCLASSIFIED'],
    [{ code: -32603, details: 'internal error', message: 'Blocked address' }, 'UNCLASSIFIED'],
    [rpcError(-32000, 'header not found'), 'UNCLASSIFIED'],
    [rpcError(-32601, 'method not found'), 'UNCLASSIFIED'],
    [{ code: '-32012', message: 'string code' }, 'UNCLASSIFIED'],
    [new Error('socket hang up'), 'UNCLASSIFIED'],
    ['-32014', 'UNCLASSIFIED'],
    [null, 'UNCLASSIFIED'],
    [undefined, 'UNCLASSIFIED'],
  ] as const)('%j → %s', (err, kind) => {
    expect(classifyRpcError(err)).toBe(kind);
  });
});

describe('createChainReader configuration (fails closed)', () => {
  const ok = (): ChainReaderOptions => ({
    chain: ARC_TESTNET,
    ownNodeUrls: [OWN],
    referenceUrl: REF,
    aStallMs: 1n,
    retry: { maxRetries: 0n, baseDelayMs: 1n, maxDelayMs: 1n },
    sleep: async () => undefined,
    transportFor: () => fakeNode(),
  });

  it('accepts the boundary values', () => {
    expect(createChainReader(ok()).chainId).toBe(5042002);
  });

  it.each([
    ['no options', undefined],
    ['no own node', { ...ok(), ownNodeUrls: [] }],
    ['duplicate own nodes', { ...ok(), ownNodeUrls: [OWN, OWN] }],
    ['own node equal to the reference', { ...ok(), ownNodeUrls: [OWN, REF] }],
    ['own node equal to the default reference (config rpcHttp)', { ...ok(), referenceUrl: undefined, ownNodeUrls: [ARC_TESTNET.rpcHttp] }],
    ['aStallMs 0', { ...ok(), aStallMs: 0n }],
    ['negative maxRetries', { ...ok(), retry: { maxRetries: -1n, baseDelayMs: 1n, maxDelayMs: 1n } }],
    ['baseDelayMs 0', { ...ok(), retry: { maxRetries: 0n, baseDelayMs: 0n, maxDelayMs: 1n } }],
    ['maxDelayMs below baseDelayMs', { ...ok(), retry: { maxRetries: 0n, baseDelayMs: 2n, maxDelayMs: 1n } }],
  ])('%s → ChainReaderConfigError', (_n, opts) => {
    expect(() => createChainReader(opts as ChainReaderOptions)).toThrow(ChainReaderConfigError);
  });

  it('the reference defaults to the config rpcHttp (C-03), and each source gets its own transport', () => {
    const seen: string[] = [];
    createChainReader({
      ...ok(),
      referenceUrl: undefined as unknown as string,
      ownNodeUrls: [OWN, OWN1],
      transportFor: (u) => {
        seen.push(u);
        return fakeNode();
      },
    });
    expect(seen).toEqual([OWN, OWN1, ARC_TESTNET.rpcHttp]);
  });

  it('the error is named', () => {
    expect(new ChainReaderConfigError('x').name).toBe('ChainReaderConfigError');
  });
});

describe('chain ID check (testnet only)', () => {
  it('every source must report 5042002 before any read; the check runs once', async () => {
    const r = rig(pair({ head: 10n }));
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 10n });
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 10n });
    for (const n of Object.values(r.nodes)) expect(n.calls.filter((c) => c.method === 'eth_chainId')).toHaveLength(1);
  });

  it.each(['0x13b2', '0x4cef53', 'garbage', null])('a source on chain %s → STOP WRONG_CHAIN, and nothing else is read', async (id) => {
    const nodes = pair({ head: 10n });
    (nodes[REF] as FakeNode).fault = (c) => (c.method === 'eth_chainId' ? { result: id } : undefined);
    const r = rig(nodes);
    const s = expectStop(await r.reader.getLogs({ fromBlock: 0n, toBlock: 5n }));
    expect(s).toMatchObject({ cause: 'WRONG_CHAIN', code: null, source: 'reference' });
    expect(s.detail).toContain(String(id));
    expect((nodes[OWN] as FakeNode).calls.map((c) => c.method)).toEqual(['eth_chainId']);
    expect(expectStop(await r.reader.getHead()).cause).toBe('WRONG_CHAIN');
  });

  it('a failed check is retried on the next read and passes once the source is right', async () => {
    const nodes = pair({ head: 10n });
    (nodes[OWN] as FakeNode).fault = (c, n) => (c.method === 'eth_chainId' && n === 1 ? { throw: rpcError(-32000, 'boom') } : undefined);
    const r = rig(nodes);
    expect(expectStop(await r.reader.getHead())).toMatchObject({ cause: 'UNCLASSIFIED', source: 'own#0' });
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 10n });
  });
});

describe('getLogs: paging and quorum, happy path', () => {
  const logs = [mkLog(5n, 0n), mkLog(5n, 1n), mkLog(9_999n, 0n), mkLog(20_000n, 3n), mkLog(24_999n, 0n)];

  it('pages a 25,000-block range in ≤ 9,999-block windows on every source and returns the agreed logs in order', async () => {
    const r = rig(pair({ head: 30_000n, logs }));
    const res = await r.reader.getLogs({ fromBlock: 0n, toBlock: 24_999n });
    expect(res.kind).toBe('OK');
    if (res.kind !== 'OK') return;
    expect(res.value.map((l) => [l.blockNumber, l.logIndex])).toEqual([
      [5n, 0n],
      [5n, 1n],
      [9_999n, 0n],
      [20_000n, 3n],
      [24_999n, 0n],
    ]);
    expect(res.value[0]).toEqual({
      address: SYSTEM_EMITTER,
      topics: [TRANSFER_TOPIC0, word(1n), word(2n)],
      data: word(500n, 7n),
      blockNumber: 5n,
      blockHash: blockHash(5n),
      transactionHash: word(500n, 0x7an),
      logIndex: 0n,
    });
    for (const n of Object.values(r.nodes)) {
      expect(logsCalls(n)).toEqual([
        { from: 0n, to: 9_998n },
        { from: 9_999n, to: 19_997n },
        { from: 19_998n, to: 24_999n },
      ]);
      const blockCall = n.calls.find((c) => c.method === 'eth_getBlockByNumber');
      expect(blockCall?.params).toEqual([hex(24_999n), false]);
    }
    expect(r.sleeps).toEqual([]);
  });

  it('passes the emitter address and topic0 filter, and sends neither when absent', async () => {
    const r = rig(pair({ head: 100n, logs: [mkLog(1n, 0n), mkLog(2n, 0n, { address: '0x3600000000000000000000000000000000000000' })] }));
    const res = await r.reader.getLogs({ fromBlock: 0n, toBlock: 10n, address: SYSTEM_EMITTER, topic0: TRANSFER_TOPIC0 });
    expect(res.kind === 'OK' && res.value.map((l) => l.blockNumber)).toEqual([1n]);
    const q = (r.nodes[REF] as FakeNode).calls.find((c) => c.method === 'eth_getLogs')?.params[0];
    expect(q).toEqual({ fromBlock: '0x0', toBlock: '0xa', address: SYSTEM_EMITTER, topics: [TRANSFER_TOPIC0] });
    const r2 = rig(pair({ head: 100n }));
    await r2.reader.getLogs({ fromBlock: 0n, toBlock: 10n });
    expect((r2.nodes[OWN] as FakeNode).calls.find((c) => c.method === 'eth_getLogs')?.params[0]).toStrictEqual({ fromBlock: '0x0', toBlock: '0xa' });
  });

  it('an empty range result is OK only when every source agrees it is empty', async () => {
    const r = rig(pair({ head: 100n }));
    expect(await r.reader.getLogs({ fromBlock: 0n, toBlock: 0n })).toEqual({ kind: 'OK', value: [] });
  });

  it('hex case differences are not a disagreement', async () => {
    const upper = logs.map((l) => ({ ...l, transactionHash: l.transactionHash.toUpperCase().replace('0X', '0x'), data: l.data.toUpperCase().replace('0X', '0x') }));
    const r = rig(pair({ head: 30_000n, logs }, { head: 30_000n, logs: upper, hashOf: (n) => blockHash(n).toUpperCase().replace('0X', '0x') }));
    expect((await r.reader.getLogs({ fromBlock: 0n, toBlock: 24_999n })).kind).toBe('OK');
  });

  it('rejects an invalid query without any RPC call', async () => {
    const r = rig(pair());
    for (const q of [{ fromBlock: -1n, toBlock: 3n }, { fromBlock: 4n, toBlock: 3n }]) {
      expect(expectStop(await r.reader.getLogs(q))).toMatchObject({ cause: 'INVALID_QUERY', code: null, source: 'reader' });
    }
    expect((r.nodes[OWN] as FakeNode).calls).toEqual([]);
    expect((await r.reader.getLogs({ fromBlock: 3n, toBlock: 3n })).kind).toBe('OK');
  });
});

describe('getLogs fault injection per error code (MC-16)', () => {
  const many = Array.from({ length: 12 }, (_, i) => mkLog(BigInt(i * 3), 0n));

  it('-32012 (range too large) splits the window until it fits, and every log is still returned', async () => {
    const r = rig(pair({ head: 100n, logs: many, rangeCap: 4n }));
    const res = await r.reader.getLogs({ fromBlock: 0n, toBlock: 33n });
    expect(res.kind === 'OK' && res.value.map((l) => l.blockNumber)).toEqual(many.map((l) => BigInt(l.blockNumber)));
    const calls = logsCalls(r.nodes[OWN] as FakeNode);
    expect(calls[0]).toEqual({ from: 0n, to: 33n });
    expect(calls[1]).toEqual({ from: 0n, to: 16n });
    // the windows that succeeded tile [0, 33] exactly
    const okWins = calls.filter((c) => c.to - c.from + 1n <= 4n);
    expect(okWins[0]?.from).toBe(0n);
    for (let i = 1; i < okWins.length; i += 1) expect(okWins[i]?.from).toBe((okWins[i - 1]?.to ?? -9n) + 1n);
    expect(okWins.at(-1)?.to).toBe(33n);
    expect(r.sleeps).toEqual([]);
  });

  it('-32602 (result cap) bisects the window, and every log is still returned', async () => {
    const r = rig(pair({ head: 100n, logs: many, resultCap: 2 }));
    const res = await r.reader.getLogs({ fromBlock: 0n, toBlock: 40n });
    expect(res.kind === 'OK' && res.value).toHaveLength(12);
    const calls = logsCalls(r.nodes[REF] as FakeNode);
    expect(calls.slice(0, 3)).toEqual([
      { from: 0n, to: 40n },
      { from: 0n, to: 20n },
      { from: 0n, to: 10n },
    ]);
  });

  it('-32602 on a single block cannot be split → STOP with code -32602 (never "no logs")', async () => {
    const crowded = [mkLog(7n, 0n), mkLog(7n, 1n), mkLog(7n, 2n)];
    const r = rig(pair({ head: 100n, logs: crowded, resultCap: 2 }));
    const s = expectStop(await r.reader.getLogs({ fromBlock: 6n, toBlock: 8n }));
    expect(s).toMatchObject({ code: -32602, cause: 'RESULT_CAP', source: 'own#0' });
    expect(s.detail).toContain('single block 7');
  });

  it('-32012 on a single block → STOP with code -32012', async () => {
    const r = rig(pair({ head: 100n, rangeCap: 0n }));
    const s = expectStop(await r.reader.getLogs({ fromBlock: 6n, toBlock: 7n }));
    expect(s).toMatchObject({ code: -32012, cause: 'RANGE_TOO_LARGE' });
    expect(logsCalls(r.nodes[OWN] as FakeNode)).toEqual([
      { from: 6n, to: 7n },
      { from: 6n, to: 6n },
    ]);
  });

  it('a failure in the upper half of a split stops the whole read', async () => {
    const nodes = pair({ head: 100n, logs: many, rangeCap: 4n });
    (nodes[OWN] as FakeNode).fault = (c) => {
      const q = c.params[0] as { fromBlock?: string } | undefined;
      return c.method === 'eth_getLogs' && q?.fromBlock === hex(17n) ? { throw: rpcError(-32000, 'nope') } : undefined;
    };
    expect(expectStop(await rig(nodes).reader.getLogs({ fromBlock: 0n, toBlock: 33n })).cause).toBe('UNCLASSIFIED');
  });

  it('-32014 (head lag) is retried with exponential backoff and jitter, then succeeds', async () => {
    const nodes = pair({ head: 100n, logs: [mkLog(3n, 0n)] });
    (nodes[OWN] as FakeNode).fault = (c, n) => (c.method === 'eth_getLogs' && n <= 5 ? { throw: rpcError(-32014, 'not imported') } : undefined);
    const r = rig(nodes, { retry: { maxRetries: 5n, baseDelayMs: 100n, maxDelayMs: 300n } });
    const res = await r.reader.getLogs({ fromBlock: 0n, toBlock: 5n });
    expect(res.kind === 'OK' && res.value).toHaveLength(1);
    // random() = 0 → each delay is the lower edge of its jitter band: half of min(100·2^n, 300)
    expect(r.sleeps).toEqual([50n, 100n, 150n]);
  });

  it('jitter stays inside [delay/2, delay] whatever the random source returns', async () => {
    for (const [rand, expected] of [
      [1n, [51n, 101n, 151n]],
      [-1n, [51n, 101n, 151n]],
      [51n, [50n, 151n, 201n]],
      [50n, [100n, 150n, 200n]],
      [101n, [100n, 100n, 251n]],
    ] as const) {
      const nodes = pair({ head: 100n });
      (nodes[OWN] as FakeNode).fault = (c, n) => (c.method === 'eth_blockNumber' && n <= 4 ? { throw: rpcError(-32014, 'lag') } : undefined);
      const r = rig(nodes, { retry: { maxRetries: 3n, baseDelayMs: 100n, maxDelayMs: 300n }, random: () => rand });
      expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 100n });
      expect(r.sleeps, `random ${rand}`).toEqual(expected);
    }
  });

  it('-32014 past maxRetries → STOP RETRIES_EXHAUSTED with code -32014', async () => {
    const nodes = pair({ head: 100n });
    (nodes[REF] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { throw: rpcError(-32014, 'not imported') } : undefined);
    const r = rig(nodes, { retry: { maxRetries: 2n, baseDelayMs: 10n, maxDelayMs: 10n } });
    const s = expectStop(await r.reader.getLogs({ fromBlock: 0n, toBlock: 5n }));
    expect(s).toMatchObject({ code: -32014, cause: 'RETRIES_EXHAUSTED', source: 'reference' });
    expect(s.detail).toContain('after 2 retries');
    expect(r.sleeps).toEqual([5n, 5n]);
    expect(logsCalls(nodes[REF] as FakeNode)).toHaveLength(3);
  });

  it('maxRetries 0 → the first -32014 stops', async () => {
    const nodes = pair({ head: 100n });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { throw: rpcError(-32014, 'lag') } : undefined);
    const r = rig(nodes, { retry: { maxRetries: 0n, baseDelayMs: 10n, maxDelayMs: 10n } });
    expect(expectStop(await r.reader.getLogs({ fromBlock: 0n, toBlock: 5n })).cause).toBe('RETRIES_EXHAUSTED');
    expect(r.sleeps).toEqual([]);
  });

  it('-32603 "Blocked address" is classified exactly and stops the read with code -32603', async () => {
    const nodes = pair({ head: 100n });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { throw: rpcError(-32603, 'Blocked address') } : undefined);
    expect(expectStop(await rig(nodes).reader.getLogs({ fromBlock: 0n, toBlock: 5n }))).toMatchObject({ code: -32603, cause: 'BLOCKED_ADDRESS' });
  });

  it.each([
    ['unknown code -32000', rpcError(-32000, 'header not found')],
    ['-32603 with another message', rpcError(-32603, 'internal error')],
    ['-32005 limit exceeded', rpcError(-32005, 'limit exceeded')],
    ['an Error without a code', new Error('ECONNRESET')],
    ['a thrown string', 'boom'],
    ['a thrown null', null],
  ])('%s → STOP UNCLASSIFIED (fail closed, never read as "no logs")', async (_n, err) => {
    const nodes = pair({ head: 100n, logs: [mkLog(1n, 0n)] });
    (nodes[REF] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { throw: err } : undefined);
    const r = rig(nodes);
    const res = await r.reader.getLogs({ fromBlock: 0n, toBlock: 5n });
    const s = expectStop(res);
    expect(s).toMatchObject({ code: null, cause: 'UNCLASSIFIED', source: 'reference' });
    expect(s.detail.startsWith('eth_getLogs: ')).toBe(true);
    expect(r.sleeps).toEqual([]);
  });

  it('the stop detail carries the code and message, truncated to 200 characters', async () => {
    const nodes = pair({ head: 100n });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { throw: rpcError(-32099, 'x'.repeat(500)) } : undefined);
    const s = expectStop(await rig(nodes).reader.getLogs({ fromBlock: 0n, toBlock: 5n }));
    expect(s.detail).toBe(`eth_getLogs: ${`code=-32099 ${'x'.repeat(500)}`.slice(0, 200)}`);
    const nodes2 = pair({ head: 100n });
    (nodes2[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { throw: 'plain' } : undefined);
    expect(expectStop(await rig(nodes2).reader.getLogs({ fromBlock: 0n, toBlock: 5n })).detail).toBe('eth_getLogs: plain');
    const nodes3 = pair({ head: 100n });
    (nodes3[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { throw: new Error('reset') } : undefined);
    expect(expectStop(await rig(nodes3).reader.getLogs({ fromBlock: 0n, toBlock: 5n })).detail).toBe('eth_getLogs: reset');
  });
});

describe('getLogs: malformed responses stop the read', () => {
  const good = mkLog(3n, 0n);
  it.each([
    ['result not an array', { result: { logs: [] } }],
    ['result null', { result: null }],
    ['entry not an object', { result: ['0x1'] }],
    ['entry null', { result: [null] }],
    ['missing blockNumber', { result: [{ ...good, blockNumber: undefined }] }],
    ['missing logIndex', { result: [{ ...good, logIndex: undefined }] }],
    ['blockNumber not hex', { result: [{ ...good, blockNumber: '3' }] }],
    ['log below the window', { result: [mkLog(1n, 0n)] }],
    ['log above the window', { result: [mkLog(6n, 0n)] }],
    ['removed log', { result: [{ ...good, removed: true }] }],
    ['bad address', { result: [{ ...good, address: '0x1234' }] }],
    ['address not a string', { result: [{ ...good, address: 5 }] }],
    ['topics not an array', { result: [{ ...good, topics: TRANSFER_TOPIC0 }] }],
    ['a short topic', { result: [{ ...good, topics: [TRANSFER_TOPIC0, '0x01'] }] }],
    ['data not hex', { result: [{ ...good, data: 'zz' }] }],
    ['data not a string', { result: [{ ...good, data: 1 }] }],
    ['pending log (blockHash null)', { result: [{ ...good, blockHash: null }] }],
    ['bad transactionHash', { result: [{ ...good, transactionHash: '0xabc' }] }],
    ['one bad entry among good ones', { result: [good, { ...good, logIndex: '0xq' }] }],
    ['duplicate log', { result: [good, { ...good }] }],
    ['duplicate log in another hex case', { result: [good, { ...good, transactionHash: good.transactionHash.toUpperCase().replace('0X', '0x') }] }],
    // Anchored patterns: a valid value with a prefix or suffix is malformed.
    ['address with a trailing hex digit', { result: [{ ...good, address: `${SYSTEM_EMITTER}0` }] }],
    ['address with a leading character', { result: [{ ...good, address: `z${SYSTEM_EMITTER}` }] }],
    ['topic with a trailing hex digit', { result: [{ ...good, topics: [`${TRANSFER_TOPIC0}0`] }] }],
    ['topic with a leading character', { result: [{ ...good, topics: [`z${TRANSFER_TOPIC0}`] }] }],
    ['data with a trailing non-hex character', { result: [{ ...good, data: '0x12z' }] }],
    ['data with a leading character', { result: [{ ...good, data: 'z0x12' }] }],
    ['blockNumber with a trailing character', { result: [{ ...good, blockNumber: '0x3z' }] }],
    ['blockNumber with a leading character', { result: [{ ...good, blockNumber: 'z0x3' }] }],
    ['blockHash with a trailing hex digit', { result: [{ ...good, blockHash: `${good.blockHash}0` }] }],
    // Non-string values that would stringify to a valid one are malformed.
    ['blockNumber as a one-element array', { result: [{ ...good, blockNumber: [good.blockNumber] }] }],
    ['address as a one-element array', { result: [{ ...good, address: [SYSTEM_EMITTER] }] }],
    ['data as a one-element array', { result: [{ ...good, data: ['0x'] }] }],
    ['a topic as a one-element array', { result: [{ ...good, topics: [[TRANSFER_TOPIC0]] }] }],
    ['blockHash as a one-element array', { result: [{ ...good, blockHash: [good.blockHash] }] }],
    ['entry undefined', { result: [undefined] }],
  ])('%s → STOP MALFORMED_RESPONSE', async (_n, fault) => {
    const nodes = pair({ head: 100n, logs: [good] });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? fault : undefined);
    const s = expectStop(await rig(nodes).reader.getLogs({ fromBlock: 2n, toBlock: 5n }));
    expect(s).toMatchObject({ cause: 'MALFORMED_RESPONSE', code: null, source: 'own#0' });
  });

  it('a log without blockNumber is malformed even when the window starts at block 0', async () => {
    const nodes = pair({ head: 100n });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { result: [{ ...good, blockNumber: undefined }] } : undefined);
    const s = expectStop(await rig(nodes).reader.getLogs({ fromBlock: 0n, toBlock: 5n }));
    expect(s).toEqual({ kind: 'STOP', cause: 'MALFORMED_RESPONSE', code: null, source: 'own#0', detail: 'eth_getLogs [0, 5]: malformed log' });
  });

  it('a non-array eth_getLogs result names the problem', async () => {
    const nodes = pair({ head: 100n });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { result: { logs: [] } } : undefined);
    expect(expectStop(await rig(nodes).reader.getLogs({ fromBlock: 2n, toBlock: 5n })).detail).toBe('eth_getLogs: result is not an array');
  });

  it('a duplicate log names the duplicate (lower-case id)', async () => {
    const nodes = pair({ head: 100n });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { result: [good, { ...good }] } : undefined);
    expect(expectStop(await rig(nodes).reader.getLogs({ fromBlock: 2n, toBlock: 5n })).detail).toBe(
      `eth_getLogs: duplicate log ${good.transactionHash.toLowerCase()}|0`,
    );
  });

  it('accepts the edges of the window, empty data and no topics', async () => {
    const edge = [mkLog(2n, 0n, { data: '0x', topics: [] }), mkLog(5n, 0n)];
    const r = rig(pair({ head: 100n, logs: edge }));
    const res = await r.reader.getLogs({ fromBlock: 2n, toBlock: 5n });
    expect(res.kind === 'OK' && res.value.map((l) => l.blockNumber)).toEqual([2n, 5n]);
  });

  it.each([
    ['block number mismatch', { result: { number: hex(4n), hash: blockHash(5n) } }],
    ['block hash malformed', { result: { number: hex(5n), hash: '0x12' } }],
    ['block not an object', { result: '0x5' }],
    ['block undefined', { result: undefined }],
  ])('%s → STOP MALFORMED_RESPONSE', async (_n, fault) => {
    const nodes = pair({ head: 100n });
    (nodes[REF] as FakeNode).fault = (c) => (c.method === 'eth_getBlockByNumber' ? fault : undefined);
    expect(expectStop(await rig(nodes).reader.getLogs({ fromBlock: 2n, toBlock: 5n }))).toMatchObject({
      cause: 'MALFORMED_RESPONSE',
      source: 'reference',
      detail: 'eth_getBlockByNumber 5: malformed block',
    });
  });

  it('a block a source does not have yet (null) is head lag: retried, then RETRIES_EXHAUSTED', async () => {
    const r = rig(pair({ head: 100n }, { head: 4n }));
    const s = expectStop(await r.reader.getLogs({ fromBlock: 2n, toBlock: 5n }));
    expect(s).toMatchObject({ cause: 'RETRIES_EXHAUSTED', code: -32014, source: 'reference' });
    expect(s.detail).toContain('null result');
    expect(r.sleeps).toHaveLength(3);
  });

  it('a block that arrives during the retries is read normally', async () => {
    const nodes = pair({ head: 100n }, { head: 4n });
    const ref = nodes[REF] as FakeNode;
    const r = rig(nodes, {
      sleep: async () => {
        ref.head = 100n;
      },
    });
    expect((await r.reader.getLogs({ fromBlock: 2n, toBlock: 5n })).kind).toBe('OK');
  });

  it('a null eth_getLogs or eth_blockNumber result is not head lag: it is malformed', async () => {
    const nodes = pair({ head: 100n });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_blockNumber' ? { result: null } : undefined);
    expect(expectStop(await rig(nodes).reader.getHead())).toMatchObject({ cause: 'MALFORMED_RESPONSE', source: 'own#0', detail: 'eth_blockNumber returned null' });
  });
});

describe('dual-source quorum (DR-02, CONTRACT §1.6): disagreement → typed PAUSE', () => {
  const logs = [mkLog(3n, 0n), mkLog(4n, 1n)];

  it('a different block hash at toBlock → DISAGREEMENT with a RECON_DRIFT PAUSE signal', async () => {
    const r = rig(pair({ head: 100n, logs }, { head: 100n, logs, hashOf: (n) => (n === 5n ? word(5n, 0xbadn) : blockHash(n)) }));
    const res = await r.reader.getLogs({ fromBlock: 2n, toBlock: 5n });
    expect(res).toEqual({
      kind: 'DISAGREEMENT',
      detail: 'reference vs own#0: block hash at 5 differs for [2, 5]',
      pause: {
        kind: 'PAUSE',
        reason: 'RPC_DISAGREEMENT',
        caseType: 'RECON_DRIFT',
        fromBlock: 2n,
        toBlock: 5n,
        detail: 'reference vs own#0: block hash at 5 differs for [2, 5]',
      },
    });
  });

  it.each([
    ['a fabricated extra log on the reference', logs, [...logs, mkLog(4n, 2n)]],
    ['a log missing on the reference', logs, [logs[0] as never]],
    ['a log missing on the own node', [logs[0] as never], logs],
    ['same count, different amount (data)', logs, [logs[0], { ...logs[1], data: word(9n, 9n) }]],
    ['same count, different recipient (topic)', logs, [logs[0], { ...logs[1], topics: [TRANSFER_TOPIC0, word(1n), word(3n)] }]],
    ['same count, different emitter', logs, [logs[0], { ...logs[1], address: '0x3600000000000000000000000000000000000000' }]],
    ['same count, different log index', logs, [logs[0], { ...logs[1], logIndex: hex(2n) }]],
    ['same count, different tx hash', logs, [logs[0], { ...logs[1], transactionHash: word(1n, 1n) }]],
    ['same count, different log block hash', logs, [logs[0], { ...logs[1], blockHash: word(4n, 0xbadn) }]],
    ['same count, swapped for a duplicate-content log', logs, [logs[0], { ...logs[0], logIndex: hex(5n) }]],
  ])('%s → DISAGREEMENT "log set differs"', async (_n, own, ref) => {
    const r = rig(pair({ head: 100n, logs: own as never }, { head: 100n, logs: ref as never }));
    const res = await r.reader.getLogs({ fromBlock: 2n, toBlock: 5n });
    expect(res.kind).toBe('DISAGREEMENT');
    if (res.kind !== 'DISAGREEMENT') return;
    expect(res.detail).toBe('reference vs own#0: log set differs for [2, 5]');
    expect(res.pause).toMatchObject({ kind: 'PAUSE', reason: 'RPC_DISAGREEMENT', caseType: 'RECON_DRIFT', fromBlock: 2n, toBlock: 5n });
  });

  it('a second own node that disagrees is named; the reference is not read after the first disagreement', async () => {
    const nodes = { [OWN]: fakeNode({ head: 100n, logs }), [OWN1]: fakeNode({ head: 100n, logs: [] }), [REF]: fakeNode({ head: 100n, logs }) };
    const r = rig(nodes);
    const res = await r.reader.getLogs({ fromBlock: 2n, toBlock: 5n });
    expect(res.kind === 'DISAGREEMENT' && res.detail).toBe('own#1 vs own#0: log set differs for [2, 5]');
    expect(logsCalls(nodes[REF])).toEqual([]);
  });

  it('three agreeing sources → OK with the primary logs', async () => {
    const nodes = { [OWN]: fakeNode({ head: 100n, logs }), [OWN1]: fakeNode({ head: 100n, logs }), [REF]: fakeNode({ head: 100n, logs }) };
    const res = await rig(nodes).reader.getLogs({ fromBlock: 2n, toBlock: 5n });
    expect(res.kind === 'OK' && res.value.map((l) => l.logIndex)).toEqual([0n, 1n]);
  });

  it('the primary failing stops the read before any other source is asked for logs', async () => {
    const nodes = pair({ head: 100n, logs });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_getLogs' ? { throw: rpcError(-32000, 'x') } : undefined);
    expect(expectStop(await rig(nodes).reader.getLogs({ fromBlock: 2n, toBlock: 5n })).source).toBe('own#0');
    expect(logsCalls(nodes[REF] as FakeNode)).toEqual([]);
  });
});

describe('getHead and stall detection (CONTRACT §1.6, §5.8 A_stall, Q-A7)', () => {
  it('returns the lowest head of all sources (the height every source has)', async () => {
    const r = rig(pair({ head: 120n }, { head: 118n }));
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 118n });
    const r2 = rig(pair({ head: 117n }, { head: 118n }));
    expect(await r2.reader.getHead()).toEqual({ kind: 'OK', value: 117n });
  });

  it('one own node: no new head for exactly A_stall → STALLED with a CHAIN_STALL / PENDING_AGE PAUSE', async () => {
    const r = rig(pair({ head: 50n }, { head: 50n }));
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 50n });
    (r.nodes[REF] as FakeNode).head = 51n;
    r.clock.now += 29_999n;
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 50n });
    r.clock.now += 1n;
    expect(await r.reader.getHead()).toEqual({
      kind: 'STALLED',
      lastHead: 50n,
      pause: {
        kind: 'PAUSE',
        reason: 'CHAIN_STALL',
        caseType: 'PENDING_AGE',
        lastHead: 50n,
        stalledSources: ['own#0'],
        detail: 'no new block for 30000 ms on own#0',
      },
    });
  });

  it('a new head resets the stall timer', async () => {
    const r = rig(pair({ head: 50n }));
    await r.reader.getHead();
    r.clock.now += 20_000n;
    (r.nodes[OWN] as FakeNode).head = 51n;
    (r.nodes[REF] as FakeNode).head = 51n;
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 51n });
    r.clock.now += 20_000n;
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 51n });
    r.clock.now += 10_000n;
    expect((await r.reader.getHead()).kind).toBe('STALLED');
  });

  it('a head that goes backwards is not progress (the highest seen is kept)', async () => {
    const r = rig(pair({ head: 50n }, { head: 60n }));
    await r.reader.getHead();
    (r.nodes[OWN] as FakeNode).head = 49n;
    (r.nodes[REF] as FakeNode).head = 61n;
    r.clock.now += 30_000n;
    const res = await r.reader.getHead();
    expect(res.kind === 'STALLED' && [res.lastHead, res.pause.stalledSources]).toEqual([49n, ['own#0']]);
  });

  it('two own nodes: one stalled is not a chain stall; two stalled is', async () => {
    const nodes = { [OWN]: fakeNode({ head: 50n }), [OWN1]: fakeNode({ head: 50n }), [REF]: fakeNode({ head: 50n }) };
    const r = rig(nodes);
    await r.reader.getHead();
    nodes[OWN1].head = 51n;
    nodes[REF].head = 51n;
    r.clock.now += 30_000n;
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 50n });
    r.clock.now += 30_000n;
    nodes[REF].head = 52n;
    const res = await r.reader.getHead();
    expect(res.kind === 'STALLED' && res.pause.stalledSources).toEqual(['own#0', 'own#1']);
  });

  it('a stalled reference alone → STALLED (the quorum cannot advance past it)', async () => {
    const r = rig(pair({ head: 50n }));
    await r.reader.getHead();
    (r.nodes[OWN] as FakeNode).head = 51n;
    r.clock.now += 30_000n;
    const res = await r.reader.getHead();
    expect(res.kind === 'STALLED' && [res.lastHead, res.pause.stalledSources, res.pause.detail]).toEqual([
      50n,
      ['reference'],
      'no new block for 30000 ms on reference',
    ]);
  });

  it.each([
    ['unknown error', { throw: rpcError(-32000, 'x') }, 'UNCLASSIFIED'],
    ['non-hex head', { result: '100' }, 'MALFORMED_RESPONSE'],
    ['numeric head', { result: 100 }, 'MALFORMED_RESPONSE'],
  ])('eth_blockNumber %s → STOP %s', async (_n, fault, cause) => {
    const nodes = pair({ head: 50n });
    (nodes[REF] as FakeNode).fault = (c) => (c.method === 'eth_blockNumber' ? (fault as never) : undefined);
    expect(expectStop(await rig(nodes).reader.getHead())).toMatchObject({ cause, source: 'reference' });
  });
});

describe('defaults (no injected clock or random): still no network', () => {
  it('the default clock and jitter source work with an injected transport', async () => {
    const nodes = pair({ head: 50n });
    (nodes[OWN] as FakeNode).fault = (c, n) => (c.method === 'eth_blockNumber' && n === 2 ? { throw: rpcError(-32014, 'lag') } : undefined);
    const sleeps: bigint[] = [];
    const reader = createChainReader({
      chain: ARC_TESTNET,
      ownNodeUrls: [OWN],
      referenceUrl: REF,
      aStallMs: 60_000n,
      retry: { maxRetries: 1n, baseDelayMs: 1_000n, maxDelayMs: 1_000n },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      transportFor: (u) => nodes[u] as RpcTransport,
    });
    expect(await reader.getHead()).toEqual({ kind: 'OK', value: 50n });
    expect(sleeps).toHaveLength(1);
    expect((sleeps[0] ?? -1n) >= 500n && (sleeps[0] ?? 2_000n) <= 1_000n).toBe(true);
    expect(await reader.getHead()).toEqual({ kind: 'OK', value: 50n });
  });

  it('createViemTransport without fetchFn uses the global fetch (stubbed here)', async () => {
    const fetchSpy = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      const body = JSON.parse(String(init?.body)) as { id: number; method: string };
      const result = body.method === 'eth_chainId' ? '0x4cef52' : '0x2a';
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const reader = createChainReader({
        chain: ARC_TESTNET,
        ownNodeUrls: [OWN],
        referenceUrl: REF,
        aStallMs: 1n,
        retry: { maxRetries: 0n, baseDelayMs: 1n, maxDelayMs: 1n },
        sleep: async () => undefined,
        transportFor: (u) => createViemTransport(u),
      });
      expect(await reader.getHead()).toEqual({ kind: 'OK', value: 42n });
      expect(fetchSpy.mock.calls.map((c) => new URL(String(c[0])).href)).toEqual([OWN, REF, OWN, REF].map((u) => new URL(u).href));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('error messages and request shapes', () => {
  it('pageBlockRange names the bad range or page size', () => {
    expect(() => pageBlockRange(6n, 5n, 10n)).toThrow('invalid block range [6, 5]');
    expect(() => pageBlockRange(0n, 5n, 0n)).toThrow('invalid page size 0');
  });

  it('each configuration error says what is wrong', () => {
    const ok = (): ChainReaderOptions => ({
      chain: ARC_TESTNET,
      ownNodeUrls: [OWN],
      referenceUrl: REF,
      aStallMs: 1n,
      retry: { maxRetries: 0n, baseDelayMs: 1n, maxDelayMs: 1n },
      sleep: async () => undefined,
      transportFor: () => fakeNode(),
    });
    expect(() => createChainReader()).toThrow('chain reader options are required');
    expect(() => createChainReader({ ...ok(), ownNodeUrls: [] })).toThrow('at least one own node URL is required');
    expect(() => createChainReader({ ...ok(), ownNodeUrls: [REF] })).toThrow('own node and reference URLs must all be distinct');
    expect(() => createChainReader({ ...ok(), aStallMs: 0n })).toThrow('aStallMs must be positive');
    expect(() => createChainReader({ ...ok(), retry: { maxRetries: 0n, baseDelayMs: 0n, maxDelayMs: 1n } })).toThrow('invalid retry policy');
  });

  it('an invalid query names the range', async () => {
    expect(expectStop(await rig(pair()).reader.getLogs({ fromBlock: 4n, toBlock: 3n })).detail).toBe('invalid block range [4, 3]');
  });

  it('eth_chainId and eth_blockNumber are sent with no params', async () => {
    const r = rig(pair({ head: 10n }));
    await r.reader.getHead();
    for (const n of Object.values(r.nodes)) {
      expect(n.calls.filter((c) => c.method !== 'eth_getBlockByNumber' && c.method !== 'eth_getLogs')).toEqual([
        { method: 'eth_chainId', params: [] },
        { method: 'eth_blockNumber', params: [] },
      ]);
    }
  });
});

describe('quorum log identity is unambiguous', () => {
  it('(block 1, index 23) and (block 12, index 3) with otherwise equal fields are different logs', async () => {
    const shared = { blockHash: blockHash(1n), transactionHash: word(77n), data: word(5n) };
    const own = [mkLog(1n, 23n, shared)];
    const ref = [mkLog(12n, 3n, shared)];
    const res = await rig(pair({ head: 100n, logs: own }, { head: 100n, logs: ref })).reader.getLogs({ fromBlock: 1n, toBlock: 12n });
    expect(res.kind === 'DISAGREEMENT' && res.detail).toBe('reference vs own#0: log set differs for [1, 12]');
  });
});

describe('stall quorum over own nodes and the reference', () => {
  const OWN2 = 'http://own-2.invalid';

  it('two own nodes: only own#1 stalled is not a chain stall', async () => {
    const nodes = { [OWN]: fakeNode({ head: 50n }), [OWN1]: fakeNode({ head: 50n }), [REF]: fakeNode({ head: 50n }) };
    const r = rig(nodes);
    await r.reader.getHead();
    nodes[OWN].head = 51n;
    nodes[REF].head = 51n;
    r.clock.now += 30_000n;
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 50n });
  });

  it('two own nodes: only the reference stalled → STALLED naming the reference', async () => {
    const nodes = { [OWN]: fakeNode({ head: 50n }), [OWN1]: fakeNode({ head: 50n }), [REF]: fakeNode({ head: 50n }) };
    const r = rig(nodes);
    await r.reader.getHead();
    nodes[OWN].head = 51n;
    nodes[OWN1].head = 51n;
    r.clock.now += 30_000n;
    const res = await r.reader.getHead();
    expect(res.kind === 'STALLED' && res.pause.stalledSources).toEqual(['reference']);
  });

  it('three own nodes: two stalled is a chain stall (quorum is 2, not all)', async () => {
    const nodes = { [OWN]: fakeNode({ head: 50n }), [OWN1]: fakeNode({ head: 50n }), [OWN2]: fakeNode({ head: 50n }), [REF]: fakeNode({ head: 50n }) };
    const r = rig(nodes);
    await r.reader.getHead();
    nodes[OWN2].head = 51n;
    nodes[REF].head = 51n;
    r.clock.now += 30_000n;
    expect(await r.reader.getHead()).toEqual({
      kind: 'STALLED',
      lastHead: 50n,
      pause: {
        kind: 'PAUSE',
        reason: 'CHAIN_STALL',
        caseType: 'PENDING_AGE',
        lastHead: 50n,
        stalledSources: ['own#0', 'own#1'],
        detail: 'no new block for 30000 ms on own#0, own#1',
      },
    });
  });

  it('three own nodes: one stalled is not', async () => {
    const nodes = { [OWN]: fakeNode({ head: 50n }), [OWN1]: fakeNode({ head: 50n }), [OWN2]: fakeNode({ head: 50n }), [REF]: fakeNode({ head: 50n }) };
    const r = rig(nodes);
    await r.reader.getHead();
    nodes[OWN1].head = 51n;
    nodes[OWN2].head = 51n;
    nodes[REF].head = 51n;
    r.clock.now += 30_000n;
    expect(await r.reader.getHead()).toEqual({ kind: 'OK', value: 50n });
  });
});

describe('default clock and jitter source', () => {
  const base = (nodes: Record<string, FakeNode>, over: Partial<ChainReaderOptions> = {}): ChainReaderOptions => ({
    chain: ARC_TESTNET,
    ownNodeUrls: [OWN],
    referenceUrl: REF,
    aStallMs: 30_000n,
    retry: { maxRetries: 0n, baseDelayMs: 1n, maxDelayMs: 1n },
    sleep: async () => undefined,
    transportFor: (u) => nodes[u] as RpcTransport,
    ...over,
  });

  it('the default clock is process.hrtime.bigint in ms', async () => {
    let ns = 5_000_000_000n;
    const spy = vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => ns);
    try {
      const reader = createChainReader(base(pair({ head: 50n })));
      expect(await reader.getHead()).toEqual({ kind: 'OK', value: 50n });
      ns += 29_999_999_999n;
      expect(await reader.getHead()).toEqual({ kind: 'OK', value: 50n });
      ns += 1n;
      expect((await reader.getHead()).kind).toBe('STALLED');
    } finally {
      spy.mockRestore();
    }
  });

  it('the default jitter is random within [delay/2, delay]', async () => {
    const nodes = pair({ head: 50n });
    (nodes[OWN] as FakeNode).fault = (c) => (c.method === 'eth_blockNumber' ? { throw: rpcError(-32014, 'lag') } : undefined);
    const sleeps: bigint[] = [];
    const reader = createChainReader(
      base(nodes, {
        retry: { maxRetries: 6n, baseDelayMs: 1_000n, maxDelayMs: 1_000n },
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      }),
    );
    expect(expectStop(await reader.getHead()).cause).toBe('RETRIES_EXHAUSTED');
    expect(sleeps).toHaveLength(6);
    for (const d of sleeps) expect(d >= 500n && d <= 1_000n).toBe(true);
    // A constant source would give 500 every time; six draws from 501 values all equal to 500 has probability 501^-6.
    expect(sleeps.some((d) => d !== 500n)).toBe(true);
  });
});
