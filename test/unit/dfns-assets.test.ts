/**
 * Lens R m2: the D1 balance read `GET /wallets/{walletId}/assets` [DF:assets]
 * (src/dfns/client.ts `getWalletAssets`, src/dfns/types.ts `decodeWalletAssets`),
 * against both DFNS fakes. Bodies derive from the archived balances-guide example
 * (src/dfns/fakes/fixtures.ts `walletAssetsFixture`). Throwaway token only.
 */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type DfnsClientConfig, type DfnsCredentials, DfnsClient, DfnsClientError, assertAllowedRequest } from '../../src/dfns/client.js';
import { walletAssetsFixture } from '../../src/dfns/fakes/fixtures.js';
import { RecordedDfns, ok200 } from '../../src/dfns/fakes/recorded.js';
import { DfnsSimulator } from '../../src/dfns/fakes/simulator.js';
import { parseJson } from '../../src/dfns/json.js';
import { decodeWalletAssets } from '../../src/dfns/types.js';

const W = 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx';
const OTHER_W = 'wa-aaaaa-bbbbb-cccccccccccccccc';
const CONFIG: DfnsClientConfig = { baseUrl: 'https://api.dfns.io', userAgent: 'nova-arc-rail/test', listPageLimit: 2n, maxListPages: 1n };
const USDC = '0x3600000000000000000000000000000000000000';

function creds(): { creds: DfnsCredentials; token: string } {
  const token = randomBytes(24).toString('base64url');
  return {
    token,
    creds: {
      authToken: async () => token,
      signUserActionChallenge: async () => {
        throw new Error('a balance read signs nothing');
      },
    },
  };
}

const EXPECTED = {
  walletId: W,
  network: 'ArcTestnet',
  assets: [
    { kind: 'Native', contract: null, balance: 1_500_000_000_000_000_000n, decimals: 18n },
    { kind: 'Erc20', contract: USDC, balance: 1_000_000n, decimals: 6n },
  ],
};

const OTHER_CONTRACT = '0x2222222222222222222222222222222222222222';
const decode = (body: unknown, walletId = W) => decodeWalletAssets(parseJson(JSON.stringify(body)), walletId);

describe('allow-list (§8.2 "Balance")', () => {
  it('allows only GET /wallets/{walletId}/assets, without netWorth', () => {
    expect(() => assertAllowedRequest('GET', `/wallets/${W}/assets`)).not.toThrow();
    for (const [m, p] of [
      ['POST', `/wallets/${W}/assets`],
      ['GET', `/wallets/${W}/assets?netWorth=true`],
      ['GET', `/wallets/${W}/assets/x`],
      ['GET', `/wallets/wa-bad/assets`],
      ['GET', `x/wallets/${W}/assets`],
    ] as const) {
      expect(() => assertAllowedRequest(m, p), `${m} ${p}`).toThrow(DfnsClientError);
    }
  });
  it('refuses a malformed wallet id before any request', async () => {
    const rec = new RecordedDfns([]);
    await expect(new DfnsClient(CONFIG, rec, creds().creds).getWalletAssets('wa-bad')).rejects.toThrow('walletId does not match');
    expect(rec.seen).toHaveLength(0);
  });
});

describe('getWalletAssets over fake #1 (simulator)', () => {
  it('reads balances as bigint base units with the bearer token, and 404s an unknown wallet', async () => {
    const c = creds();
    const sim = new DfnsSimulator(c.token, 'cred-x', () => false);
    sim.addWallet();
    const client = new DfnsClient(CONFIG, sim, c.creds);
    expect(await client.getWalletAssets(W)).toEqual({ kind: 'OK', value: EXPECTED });
    expect(sim.requests.map((r) => [r.method, r.url, r.headers['authorization'], r.body])).toEqual([['GET', `https://api.dfns.io/wallets/${W}/assets`, `Bearer ${c.token}`, null]]);
    expect(await client.getWalletAssets(OTHER_W)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND', httpStatus: 404n });
  });
});

describe('getWalletAssets over fake #2 (recorded exchanges)', () => {
  it('replays the archived example and pins the single call', async () => {
    const rec = new RecordedDfns([{ method: 'GET', path: `/wallets/${W}/assets`, respond: ok200(walletAssetsFixture()) }]);
    expect(await new DfnsClient(CONFIG, rec, creds().creds).getWalletAssets(W)).toEqual({ kind: 'OK', value: EXPECTED });
    expect(rec.remaining()).toBe(0);
  });
  it('an answer for another wallet is AMBIGUOUS BAD_RESPONSE, never a balance', async () => {
    const rec = new RecordedDfns([{ method: 'GET', path: `/wallets/${W}/assets`, respond: ok200(walletAssetsFixture(OTHER_W)) }]);
    const out = await new DfnsClient(CONFIG, rec, creds().creds).getWalletAssets(W);
    expect(out).toMatchObject({ kind: 'AMBIGUOUS', cause: 'BAD_RESPONSE' });
    expect(out.kind === 'AMBIGUOUS' ? out.detail : '').toContain(`assets for wallet ${OTHER_W}, not ${W}`);
  });
});

describe('decodeWalletAssets [DF:assets]: strict, fails closed, never reads a float', () => {
  const native = { kind: 'Native', balance: '7', decimals: 18 };
  const erc = { kind: 'Erc20', contract: USDC, balance: '5', decimals: 6 };
  const body = (assets: unknown[], over: Record<string, unknown> = {}) => ({ walletId: W, network: 'ArcTestnet', assets, ...over });

  it('accepts an empty list, ignores quotes/netWorth/symbol, and gives Native no contract', () => {
    expect(decode(body([]))).toEqual({ walletId: W, network: 'ArcTestnet', assets: [] });
    const out = decode(body([{ ...native, contract: USDC, quotes: { USD: 1.25 } }], { netWorth: { USD: 3.5 } }));
    expect(out.assets).toEqual([{ kind: 'Native', contract: null, balance: 7n, decimals: 18n }]);
    expect(decode(body([erc])).assets).toEqual([{ kind: 'Erc20', contract: USDC, balance: 5n, decimals: 6n }]);
  });

  it('Lens R-1 m3: an Erc7984 confidential token is carried as a non-USDC row (balance never read), not a failed read', () => {
    const conf = { kind: 'Erc7984', contract: OTHER_CONTRACT, balance: '0xencrypted-handle', decimals: 6, symbol: 'cUSD' };
    expect(decode(body([native, conf, erc])).assets).toEqual([
      { kind: 'Native', contract: null, balance: 7n, decimals: 18n },
      { kind: 'Erc7984', contract: OTHER_CONTRACT },
      { kind: 'Erc20', contract: USDC, balance: 5n, decimals: 6n },
    ]);
    expect(() => decode(body([{ kind: 'Erc7984', balance: '1', decimals: 6 }]))).toThrow('contract: expected a string');
    expect(() => decode(body([{ kind: 'Erc7984', contract: '0x36', balance: '1', decimals: 6 }]))).toThrow('contract: does not match');
  });

  it.each([
    ['a non-EVM kind', body([{ kind: 'Spl', mint: 'm', balance: '1', decimals: 6 }]), 'asset kind "Spl" is not an EVM kind'],
    ['a missing kind', body([{ balance: '1', decimals: 6 }]), 'kind: expected a string'],
    ['an Erc20 without contract', body([{ kind: 'Erc20', balance: '1', decimals: 6 }]), 'contract: expected a string'],
    ['an Erc20 with a bad contract', body([{ ...erc, contract: '0x36' }]), 'contract: does not match'],
    ['a decimal balance', body([{ ...native, balance: '1.5' }]), 'balance: does not match'],
    ['a negative balance', body([{ ...native, balance: '-1' }]), 'balance: does not match'],
    ['a numeric balance', body([{ ...native, balance: 1 }]), 'balance: expected a string'],
    ['fractional decimals', body([{ ...native, decimals: 6.5 }]), 'decimals: expected an integer'],
    ['string decimals', body([{ ...native, decimals: '6' }]), 'decimals: expected an integer'],
    ['no network', { walletId: W, assets: [] }, 'network: expected a string'],
    ['no assets array', { walletId: W, network: 'ArcTestnet', assets: {} }, 'assets: expected an array'],
    ['a bad wallet id', body([], { walletId: 'wa-x' }), 'walletId: does not match'],
    ['not an object', [], 'wallet assets: expected an object'],
    ['an asset that is not an object', body([1]), 'asset: expected an object'],
  ])('refuses %s', (_n, b, msg) => {
    expect(() => decode(b)).toThrow(msg);
  });

  it('refuses another wallet, comparing exactly', () => {
    expect(() => decode(body([]), OTHER_W)).toThrow(`assets for wallet ${W}, not ${OTHER_W}`);
  });
});
