/**
 * U3 test helper: an in-memory fake JSON-RPC node for the chain client. No network.
 * It serves eth_chainId, eth_blockNumber, eth_getBlockByNumber and eth_getLogs with
 * Arc's range cap (-32012, C-40) and the observed result cap (-32602, C-41), and
 * lets a test inject any fault per call.
 */
import type { RpcTransport } from '../../src/chain/client/index.js';

export const TESTNET_CHAIN_ID_HEX = '0x4cef52'; // 5042002 (C-01)
export const TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const SYSTEM_EMITTER = '0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE';

export const hex = (n: bigint): string => `0x${n.toString(16)}`;
export const word = (n: bigint, salt = 0n): string => `0x${(n * 1_000_003n + salt).toString(16).padStart(64, '0')}`;
export const blockHash = (n: bigint): string => word(n, 0xb10cn);

export interface JsonLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  blockHash: string | null;
  transactionHash: string;
  logIndex: string;
  removed?: boolean;
}

export function mkLog(block: bigint, index: bigint, over: Partial<JsonLog> = {}): JsonLog {
  return {
    address: SYSTEM_EMITTER,
    topics: [TRANSFER_TOPIC0, word(1n), word(2n)],
    data: word(block * 100n + index, 7n),
    blockNumber: hex(block),
    blockHash: blockHash(block),
    transactionHash: word(block * 100n + index, 0x7an),
    logIndex: hex(index),
    removed: false,
    ...over,
  };
}

export interface Call {
  readonly method: string;
  readonly params: readonly unknown[];
}

export type Fault = (call: Call, n: number) => { readonly throw: unknown } | { readonly result: unknown } | undefined;

export interface FakeNodeOptions {
  head?: bigint;
  logs?: JsonLog[];
  /** Max blocks per eth_getLogs query before -32012 (Arc: 10,000). */
  rangeCap?: bigint;
  /** Max results per eth_getLogs query before -32602 (observed: 2,000). */
  resultCap?: number;
  chainIdHex?: string;
  hashOf?: (n: bigint) => string;
  fault?: Fault;
}

export interface FakeNode extends RpcTransport {
  readonly calls: Call[];
  head: bigint;
  logs: JsonLog[];
  fault: Fault | undefined;
}

export const rpcError = (code: number, message: string): { code: number; message: string } => ({ code, message });

export function fakeNode(o: FakeNodeOptions = {}): FakeNode {
  const node: FakeNode = {
    calls: [],
    head: o.head ?? 100_000n,
    logs: o.logs ?? [],
    fault: o.fault,
    async request({ method, params }) {
      const call = { method, params };
      node.calls.push(call);
      const f = node.fault?.(call, node.calls.length);
      if (f !== undefined) {
        if ('throw' in f) throw f.throw;
        return f.result;
      }
      switch (method) {
        case 'eth_chainId':
          return o.chainIdHex ?? TESTNET_CHAIN_ID_HEX;
        case 'eth_blockNumber':
          return hex(node.head);
        case 'eth_getBlockByNumber': {
          const n = BigInt(params[0] as string);
          if (n > node.head) return null;
          return { number: hex(n), hash: (o.hashOf ?? blockHash)(n), parentHash: blockHash(n - 1n) };
        }
        case 'eth_getLogs': {
          const q = params[0] as { fromBlock: string; toBlock: string; address?: string; topics?: string[] };
          const from = BigInt(q.fromBlock);
          const to = BigInt(q.toBlock);
          if (to - from + 1n > (o.rangeCap ?? 10_000n)) throw rpcError(-32012, 'requested range too large');
          const hits = node.logs.filter((l) => {
            const b = BigInt(l.blockNumber);
            if (b < from || b > to) return false;
            if (q.address !== undefined && l.address.toLowerCase() !== q.address.toLowerCase()) return false;
            if (q.topics?.[0] !== undefined && l.topics[0] !== q.topics[0]) return false;
            return true;
          });
          if (hits.length > (o.resultCap ?? 2000)) {
            throw rpcError(-32602, `request exceeded max allowed range: query exceeds max results ${o.resultCap ?? 2000}`);
          }
          return hits.map((l) => ({ ...l }));
        }
        default:
          throw rpcError(-32601, `method ${method} not found`);
      }
    },
  };
  return node;
}
