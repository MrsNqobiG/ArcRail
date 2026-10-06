/**
 * Arc testnet E2E project. Skipped unless ARC_E2E=1. Read-only: one
 * `eth_chainId` call to the cited testnet endpoint (C-03), no signing, no
 * sending, no key. Mainnet is never contacted (CLAUDE.md rule 1).
 */
import { describe, expect, it } from 'vitest';
import { ARC_TESTNET, resolveChain } from '../../src/chain/config/index.js';

const enabled = process.env['ARC_E2E'] === '1';

describe.skipIf(!enabled)('Arc testnet E2E (read-only)', () => {
  it('eth_chainId on the testnet endpoint equals C-01 (5042002)', async () => {
    const cfg = resolveChain(5042002);
    expect(cfg.rpcHttp).toBe(ARC_TESTNET.rpcHttp);
    const res = await fetch(cfg.rpcHttp, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { result?: string };
    expect(typeof body.result).toBe('string');
    expect(BigInt(body.result as string)).toBe(BigInt(ARC_TESTNET.chainId));
  });
});
