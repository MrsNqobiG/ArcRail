/**
 * U3 chain client: the production transport. A viem public client over HTTP for
 * one RPC source (an own node or the reference RPC), READ path only.
 *
 * Kept out of ./index.ts on purpose: the money-path module (RUBRIC item 6) holds
 * all classification, retry, paging, quorum and stall logic and imports no
 * network library. This file only adapts viem to `RpcTransport`. Every value it
 * returns is `unknown` to the reader, which validates it before use.
 *
 * viem's own retries are off (`retryCount: 0`): the reader retries `-32014`
 * only (C-42), and viem would otherwise also retry `-32603`, which must be
 * classified exactly (C-57), and unknown errors, which must stop (RUBRIC MC-16).
 * Testnet only: the reader checks `eth_chainId` on every source before use.
 */
import { createPublicClient, http } from 'viem';
import type { RpcTransport } from './index.js';

/** A viem public client over HTTP. `fetchFn` exists so tests can run without a network. */
export function createViemTransport(url: string, fetchFn?: typeof fetch): RpcTransport {
  const client = createPublicClient({
    transport: http(url, fetchFn === undefined ? { retryCount: 0 } : { retryCount: 0, fetchFn }),
  });
  const request = client.request as unknown as RpcTransport['request'];
  return { request: async (args) => request(args) };
}
