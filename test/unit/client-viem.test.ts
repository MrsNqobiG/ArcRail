/**
 * U3 chain client over the real viem HTTP transport, with an injected fetch
 * (no network). Checks that each JSON-RPC error code (RUBRIC MC-16) reaches the
 * classifier through viem's own error wrapping, that viem does not retry on its
 * own (this module owns retries), and that a stop detail never carries the URL.
 */
import { describe, expect, it, vi } from 'vitest';
import { ARC_TESTNET } from '../../src/chain/config/index.js';
import { classifyRpcError, createChainReader, type ReadResult } from '../../src/chain/client/index.js';
import { createViemTransport } from '../../src/chain/client/viem-transport.js';

const URL_OWN = 'http://own-node.invalid:8545/secret-path';
const URL_REF = 'http://reference.invalid/also-secret';

type Reply = { result: unknown } | { error: { code: number; message: string } } | { status: number };

function fakeFetch(reply: (method: string) => Reply): ReturnType<typeof vi.fn> & typeof fetch {
  const fn = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string };
    const r = reply(body.method);
    if ('status' in r) return new Response('upstream down', { status: r.status });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, ...r }), { headers: { 'content-type': 'application/json' } });
  });
  return fn as unknown as ReturnType<typeof vi.fn> & typeof fetch;
}

async function thrownBy(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('expected a rejection');
}

describe('createViemTransport (viem public client over HTTP, injected fetch)', () => {
  it('passes a result through', async () => {
    const f = fakeFetch(() => ({ result: '0x4cef52' }));
    const t = createViemTransport(URL_OWN, f);
    expect(await t.request({ method: 'eth_chainId', params: [] })).toBe('0x4cef52');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it.each([
    [-32012, 'requested range too large', 'RANGE_TOO_LARGE'],
    [-32602, 'request exceeded max allowed range: query exceeds max results 2000, retry with the range 1-2', 'RESULT_CAP'],
    [-32014, 'block not yet imported', 'HEAD_LAG'],
    [-32603, 'Blocked address', 'BLOCKED_ADDRESS'],
    [-32603, 'internal error', 'UNCLASSIFIED'],
    [-32000, 'header not found', 'UNCLASSIFIED'],
    [-32005, 'limit exceeded', 'UNCLASSIFIED'],
  ])('JSON-RPC error %i "%s" → %s, sent exactly once (viem retries off)', async (code, message, kind) => {
    const f = fakeFetch(() => ({ error: { code, message } }));
    const err = await thrownBy(createViemTransport(URL_OWN, f).request({ method: 'eth_getLogs', params: [{ fromBlock: '0x0', toBlock: '0x1' }] }));
    expect(classifyRpcError(err)).toBe(kind);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('an HTTP 500 is unclassified and not retried by viem', async () => {
    const f = fakeFetch(() => ({ status: 500 }));
    const err = await thrownBy(createViemTransport(URL_OWN, f).request({ method: 'eth_blockNumber', params: [] }));
    expect(classifyRpcError(err)).toBe('UNCLASSIFIED');
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('the reader over viem transports: stop details carry no URL', () => {
  const reader = (own: typeof fetch, ref: typeof fetch): ReturnType<typeof createChainReader> =>
    createChainReader({
      chain: ARC_TESTNET,
      ownNodeUrls: [URL_OWN],
      referenceUrl: URL_REF,
      aStallMs: 30_000n,
      retry: { maxRetries: 1n, baseDelayMs: 1n, maxDelayMs: 1n },
      sleep: async () => undefined,
      transportFor: (u) => createViemTransport(u, u === URL_OWN ? own : ref),
    });

  const stopOf = <T>(r: ReadResult<T>): Extract<ReadResult<T>, { kind: 'STOP' }> => {
    if (r.kind !== 'STOP') throw new Error(`expected STOP, got ${r.kind}`);
    return r;
  };

  it.each([
    [-32603, 'Blocked address', 'BLOCKED_ADDRESS', -32603],
    [-32000, 'header not found', 'UNCLASSIFIED', null],
    [-32014, 'block not yet imported', 'RETRIES_EXHAUSTED', -32014],
  ])('eth_getLogs error %i → STOP %s', async (code, message, cause, stopCode) => {
    const ok = (m: string): Reply =>
      m === 'eth_chainId' ? { result: '0x4cef52' } : m === 'eth_getBlockByNumber' ? { result: { number: '0x1', hash: `0x${'ab'.repeat(32)}` } } : { result: [] };
    const own = fakeFetch((m) => (m === 'eth_getLogs' ? { error: { code, message } } : ok(m)));
    const s = stopOf(await reader(own, fakeFetch(ok)).getLogs({ fromBlock: 0n, toBlock: 1n }));
    expect(s).toMatchObject({ cause, code: stopCode, source: 'own#0' });
    expect(s.detail).toContain(message);
    expect(s.detail).not.toContain('invalid');
    expect(s.detail).not.toContain('secret');
  });

  it('a mainnet chain ID from the reference (0x13b2 = 5042) → STOP WRONG_CHAIN', async () => {
    const own = fakeFetch(() => ({ result: '0x4cef52' }));
    const ref = fakeFetch(() => ({ result: '0x13b2' }));
    expect(stopOf(await reader(own, ref).getHead())).toMatchObject({ cause: 'WRONG_CHAIN', source: 'reference' });
  });
});

describe('createViemTransport without fetchFn', () => {
  it('also has viem retries off: an HTTP 500 from the global fetch is sent once', async () => {
    const f = fakeFetch(() => ({ status: 500 }));
    vi.stubGlobal('fetch', f);
    try {
      const err = await thrownBy(createViemTransport(URL_OWN).request({ method: 'eth_blockNumber', params: [] }));
      expect(classifyRpcError(err)).toBe('UNCLASSIFIED');
      expect(f).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
