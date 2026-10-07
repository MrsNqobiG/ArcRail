/**
 * Unit NET: Arc network config loader, ArcNetworkAdapter precheck and DFNS
 * body, FakeNetAdapter specifics, and the network type helpers.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision, nativeWei } from '../../src/amounts/index.js';
import type { NativeWei } from '../../src/amounts/index.js';
import { ARC_MAINNET_DISABLED, MainnetGateError } from '../../src/chain/config/index.js';
import { ArcIndexer } from '../../src/indexer/indexer.js';
import { InMemoryArcChain, MapIndexerStore, ManualTiming, fakeAddress, fakeHash } from '../../src/indexer/fakes.js';
import { ArcNetworkAdapter } from '../../src/network/arc/adapter.js';
import type { BlocklistView } from '../../src/network/arc/adapter.js';
import { ArcConfigError, DFNS_ARC_CONFIRMATION_DELAY_BLOCKS, DFNS_ARC_NETWORKS, PROPOSED_HEAD_REGRESSION_TOLERANCE_BLOCKS, PROPOSED_RETRY, loadArcNetworkParams } from '../../src/network/arc/config.js';
import type { ArcConfigInput } from '../../src/network/arc/config.js';
import type { ArcNetworkParams } from '../../src/network/arc/params.js';
import { FAKENET_UNIT_WEI, FakeNetAdapter, FakeNetLedger } from '../../src/network/fake/adapter.js';
import { EventMirrorBlocklist, SetBlocklist } from '../../src/network/arc/blocklist-fakes.js';
import { checkApprovers, checkExternalId, dfnsAmount, toHex32, toNetworkAddress, transferDedupeKey } from '../../src/network/types.js';
import type { NetworkAddress, NetworkTransferIntent } from '../../src/network/types.js';

const input: ArcConfigInput = {
  chainId: 5042002n,
  dfnsNetwork: 'ArcTestnet',
  singleSourceTestnetOnly: false,
  stallAfterMs: 30_000n,
  startBlock: 100n,
  blocklistMaxAgeMs: 60_000n,
  headRegressionToleranceBlocks: 5n,
};
const MAINNET = BigInt(ARC_MAINNET_DISABLED.chainId);

describe('loadArcNetworkParams', () => {
  it('builds the testnet parameters from U2 (C-01, C-12, C-20, C-21, C-30, C-31, C-40, C-41, C-42)', () => {
    const p = loadArcNetworkParams(input);
    expect(p).toEqual({
      network: 'ARC',
      asset: 'USDC',
      enabled: true,
      chainId: 5042002n,
      dfnsNetwork: 'ArcTestnet',
      systemEmitter: '0xfffffffffffffffffffffffffffffffffffffffe',
      usdcErc20: '0x3600000000000000000000000000000000000000',
      transferTopic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      maxBlocksPerPage: 9_999n,
      rangeTooLargeCode: -32012n,
      resultCapCode: -32602n,
      headLagCode: -32014n,
      retry: { initialMs: 250n, capMs: 8_000n, maxAttempts: 8n },
      stallAfterMs: 30_000n,
      headRegressionToleranceBlocks: 5n,
      confirmations: 0n,
      startBlock: 100n,
      singleSourceTestnetOnly: false,
      blocklistMaxAgeMs: 60_000n,
      reservedDestinations: ['0xfffffffffffffffffffffffffffffffffffffffe', '0x3600000000000000000000000000000000000000'],
      feeFloorWei: 20_000_000_000n,
      maxBaseFeeWei: 20_000_000_000_000n,
    });
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.retry)).toBe(true);
    expect(Object.isFrozen(p.reservedDestinations)).toBe(true);
    expect(PROPOSED_RETRY).toEqual({ initialMs: 250n, capMs: 8_000n, maxAttempts: 8n });
    expect(PROPOSED_HEAD_REGRESSION_TOLERANCE_BLOCKS).toBe(5n);
    expect(DFNS_ARC_NETWORKS).toEqual({ testnet: { name: 'ArcTestnet', enabled: true }, mainnet: { name: 'Arc', enabled: false } });
    expect(DFNS_ARC_CONFIRMATION_DELAY_BLOCKS).toBe(10n);
  });

  it('takes operator values for retry, confirmations and the single-source flag on testnet', () => {
    const retry = { initialMs: 5n, capMs: 5n, maxAttempts: 1n };
    const p = loadArcNetworkParams({ ...input, retry, confirmations: 3n, singleSourceTestnetOnly: true, startBlock: 0n });
    expect(p.retry).toEqual(retry);
    expect(p.confirmations).toBe(3n);
    expect(p.singleSourceTestnetOnly).toBe(true);
    expect(loadArcNetworkParams({ ...input, headRegressionToleranceBlocks: 0n }).headRegressionToleranceBlocks).toBe(0n);
    expect(loadArcNetworkParams({ ...input, headRegressionToleranceBlocks: 7n }).headRegressionToleranceBlocks).toBe(7n);
    // lensR-1 m5: no default; an input without it is refused by the type and at runtime, never silently 5.
    const { headRegressionToleranceBlocks: _omitted, ...without } = input;
    expect(() => loadArcNetworkParams(without as ArcConfigInput)).toThrow(new ArcConfigError('headRegressionToleranceBlocks is required (no default)'));
    expect(p.startBlock).toBe(0n);
  });

  it('refuses the single-source flag with any mainnet marker (§11 test e)', () => {
    const msg = 'singleSourceTestnetOnly is refused with the Arc mainnet entry (§6.3, §11 test e)';
    expect(() => loadArcNetworkParams({ ...input, chainId: MAINNET, singleSourceTestnetOnly: true })).toThrow(msg);
    expect(() => loadArcNetworkParams({ ...input, dfnsNetwork: 'Arc', singleSourceTestnetOnly: true })).toThrow(ArcConfigError);
  });

  it('refuses mainnet through the U2 gate even without the flag', () => {
    expect(() => loadArcNetworkParams({ ...input, chainId: MAINNET, dfnsNetwork: 'Arc' })).toThrow(MainnetGateError);
    expect(() => loadArcNetworkParams({ ...input, dfnsNetwork: 'Arc' })).toThrow(MainnetGateError);
    expect(() => loadArcNetworkParams({ ...input, chainId: MAINNET })).toThrow(MainnetGateError);
  });

  it('refuses other chains, mismatched DFNS networks and invalid operator values', () => {
    expect(() => loadArcNetworkParams({ ...input, chainId: 1n })).toThrow('chain 1 is not enabled');
    expect(() => loadArcNetworkParams({ ...input, dfnsNetwork: 'BaseSepolia' })).toThrow('DFNS network BaseSepolia does not match chain 5042002');
    const bad = (over: Partial<ArcConfigInput>, msg: string) => expect(() => loadArcNetworkParams({ ...input, ...over })).toThrow(msg);
    bad({ retry: { initialMs: 0n, capMs: 1n, maxAttempts: 1n } }, 'retry.initialMs must be positive');
    bad({ retry: { initialMs: 2n, capMs: 1n, maxAttempts: 1n } }, 'retry.capMs must be at least retry.initialMs');
    bad({ retry: { initialMs: 1n, capMs: 1n, maxAttempts: 0n } }, 'retry.maxAttempts must be positive');
    bad({ confirmations: -1n }, 'confirmations must not be negative');
    bad({ startBlock: -1n }, 'startBlock must not be negative');
    bad({ headRegressionToleranceBlocks: -1n }, 'headRegressionToleranceBlocks must not be negative');
    bad({ stallAfterMs: 0n }, 'stallAfterMs must be positive');
    bad({ blocklistMaxAgeMs: 0n }, 'blocklistMaxAgeMs must be positive');
    expect(new ArcConfigError('x').name).toBe('ArcConfigError');
  });
});

describe('network type helpers', () => {
  it('normalise addresses and hashes, or refuse them', () => {
    expect(toNetworkAddress(`0x${'AB'.repeat(20)}`)).toBe(`0x${'ab'.repeat(20)}`);
    expect(toNetworkAddress(`0x${'ab'.repeat(19)}`)).toBeNull();
    expect(toNetworkAddress(`0x${'ab'.repeat(21)}`)).toBeNull();
    expect(toNetworkAddress(`x0x${'ab'.repeat(20)}`)).toBeNull();
    expect(toHex32(`0x${'CD'.repeat(32)}`)).toBe(`0x${'cd'.repeat(32)}`);
    expect(toHex32(`0x${'cd'.repeat(31)}`)).toBeNull();
    expect(toHex32(`0x${'cd'.repeat(32)}0`)).toBeNull();
    expect(toHex32(`00x${'cd'.repeat(32)}`)).toBeNull();
  });

  it('dedupe key, externalId and DFNS amount', () => {
    expect(transferDedupeKey('ARC', 5042002n, `0x${'AB'.repeat(32)}`, 3n)).toBe(`arc:5042002:0x${'ab'.repeat(32)}:3`);
    expect(checkExternalId('a')).toBe('a');
    expect(checkExternalId('a'.repeat(50))).toBe('a'.repeat(50));
    expect(() => checkExternalId('')).toThrow('externalId must be 1 to 50 characters (DF:transfer)');
    expect(() => checkExternalId('a'.repeat(51))).toThrow(RangeError);
    expect(dfnsAmount(nativeWei(0n))).toBe('0');
    expect(dfnsAmount(nativeWei(10n ** 30n))).toBe(`1${'0'.repeat(30)}`);
    expect(() => dfnsAmount(-1n as unknown as NativeWei)).toThrow('DFNS amount must match ^\\d+$ (DF:transfer)');
  });

  it('checkApprovers: two distinct, non-empty identities, trimmed', () => {
    expect(checkApprovers(' alice ', 'bob')).toEqual(['alice', 'bob']);
    expect(() => checkApprovers('alice', 'alice')).toThrow('resume needs two distinct named approvers');
    expect(() => checkApprovers(' alice ', 'alice')).toThrow(RangeError);
    expect(() => checkApprovers('', 'bob')).toThrow(RangeError);
    expect(() => checkApprovers('alice', '  ')).toThrow(RangeError);
  });
});

const FROM = fakeAddress('arc-from');
const TO = fakeAddress('arc-to');

function arc(blocklist: BlocklistView, params: ArcNetworkParams = loadArcNetworkParams(input), timing = new ManualTiming(1_000_000n)) {
  const indexer = new ArcIndexer({ params, sources: [new InMemoryArcChain('a'), new InMemoryArcChain('b')], store: new MapIndexerStore(), timing });
  return new ArcNetworkAdapter({ params, indexer, blocklist, clock: timing });
}

const intent: NetworkTransferIntent = { network: 'ARC', asset: 'USDC', from: FROM, to: TO, amount: nativeWei(1n) };

describe.each([
  ['SetBlocklist', (asOf: bigint, blocked: readonly NetworkAddress[]) => new SetBlocklist(asOf, blocked)],
  [
    'EventMirrorBlocklist',
    (asOf: bigint, blocked: readonly NetworkAddress[]) => {
      const m = new EventMirrorBlocklist(0n);
      m.sync([{ kind: 'Blocklisted', account: TO }, { kind: 'UnBlocklisted', account: TO }, ...blocked.map((account) => ({ kind: 'Blocklisted' as const, account }))], asOf);
      return m;
    },
  ],
] as const)('ArcNetworkAdapter.precheck with %s', (_n, list) => {
  const result = async (blocked: readonly NetworkAddress[], over: Partial<NetworkTransferIntent> = {}, asOf = 1_000_000n) =>
    arc(list(asOf, blocked)).precheck({ ...intent, ...over });

  it('accepts a valid intent, a sub-10⁻⁶ amount included (C-15)', async () => {
    expect(await result([])).toEqual({ kind: 'OK' });
  });

  it('refuses each documented case with its reason', async () => {
    const r = (code: string, detail: string) => ({ kind: 'REJECTED', code, detail });
    expect(await result([], { network: 'FAKENET' })).toEqual(r('CHAIN_ID_MISMATCH', 'intent is for FAKENET'));
    expect(await result([], { asset: 'EURC' as 'USDC' })).toEqual(r('ASSET_NOT_SUPPORTED', 'asset EURC'));
    expect(await result([], { from: FROM.toUpperCase().replace('0X', '0x') as NetworkAddress })).toEqual(
      r('INVALID_SOURCE', 'sender is not a lower-case address'),
    );
    expect(await result([], { to: '0x12' })).toEqual(r('INVALID_DESTINATION', 'recipient is not a lower-case address'));
    expect(await result([], { amount: nativeWei(0n) })).toEqual(r('AMOUNT_NOT_POSITIVE', 'zero-value transfers emit no log (C-24)'));
    expect(await result([], { to: `0x${'0'.repeat(40)}` })).toEqual(r('INVALID_DESTINATION', 'zero address (C-54)'));
    expect(await result([], { to: FROM })).toEqual(r('INVALID_DESTINATION', 'self-transfer emits no log (C-24)'));
    expect(await result([], { to: '0xfffffffffffffffffffffffffffffffffffffffe' })).toEqual(r('INVALID_DESTINATION', 'reserved system address'));
    expect(await result([], { to: '0x3600000000000000000000000000000000000000' })).toEqual(r('INVALID_DESTINATION', 'reserved system address'));
    expect(await result([], { to: `0x${'0'.repeat(36)}ffff` })).toEqual(r('INVALID_DESTINATION', 'precompile range (our rule, Q-A14)'));
    expect(await result([], { to: `0x${'0'.repeat(36)}0001` })).toEqual(r('INVALID_DESTINATION', 'precompile range (our rule, Q-A14)'));
    expect(await result([], { to: `0x${'0'.repeat(35)}10000` })).toEqual({ kind: 'OK' });
    expect(await result([FROM])).toEqual(r('SENDER_BLOCKLISTED', 'sender is on the local blocklist copy'));
    expect(await result([TO])).toEqual(r('RECIPIENT_BLOCKLISTED', 'recipient is on the local blocklist copy'));
  });

  it('a blocklist copy older than blocklistMaxAgeMs is BLOCKLIST_STALE (fail closed)', async () => {
    expect(await result([], {}, 1_000_000n - 60_000n)).toEqual({ kind: 'OK' });
    expect(await result([], {}, 1_000_000n - 60_001n)).toEqual({ kind: 'REJECTED', code: 'BLOCKLIST_STALE', detail: 'local blocklist copy is too old' });
  });

  it('a blocklist copy dated in the future is BLOCKLIST_STALE (clock skew, m10)', async () => {
    expect(await result([], {}, 1_000_000n)).toEqual({ kind: 'OK' });
    expect(await result([], {}, 1_000_001n)).toEqual({ kind: 'REJECTED', code: 'BLOCKLIST_STALE', detail: 'local blocklist copy is dated in the future' });
  });
});

describe('ArcNetworkAdapter', () => {
  it('refuses intents when the params are not the enabled testnet entry', async () => {
    const p = loadArcNetworkParams(input);
    const disabled = { kind: 'REJECTED', code: 'NETWORK_DISABLED', detail: 'only Arc testnet (5042002, ArcTestnet) is enabled' };
    const withParams = (over: Record<string, unknown>) => {
      const params = { ...p, ...over } as unknown as ArcNetworkParams;
      const indexer = new ArcIndexer({ params: p, sources: [new InMemoryArcChain('a'), new InMemoryArcChain('b')], store: new MapIndexerStore(), timing: new ManualTiming() });
      return new ArcNetworkAdapter({ params, indexer, blocklist: new SetBlocklist(0n), clock: new ManualTiming(0n) });
    };
    expect(await withParams({ enabled: false }).precheck(intent)).toEqual(disabled);
    expect(await withParams({ chainId: MAINNET }).precheck(intent)).toEqual(disabled);
    expect(await withParams({ dfnsNetwork: 'Arc' }).precheck(intent)).toEqual(disabled);
    expect(await withParams({}).precheck(intent)).toEqual({ kind: 'OK' });
  });

  it('identifies itself and converts amounts exactly through U1', () => {
    const a = arc(new SetBlocklist(0n));
    expect([a.network, a.asset, a.chainId]).toEqual(['ARC', 'USDC', 5042002n]);
    expect(a.toNetworkAmount(cbsMinor(1n), cbsPrecision(18))).toBe(1n);
    expect(a.toNetworkAmount(cbsMinor(7n), cbsPrecision(0))).toBe(7_000_000_000_000_000_000n);
    expect(() => a.dfnsTransferBody({ ...intent, network: 'FAKENET' }, 'x')).toThrow('intent is for FAKENET, not ARC');
  });

  it('delegates reads, the inbox and resume to the indexer', async () => {
    const a = arc(new SetBlocklist(0n));
    expect(await a.head()).toEqual({ kind: 'OK', value: { number: 0n, hash: fakeHash('arc-fake-block:0') } });
    expect(await a.poll(new Set([FROM]))).toEqual({ kind: 'OK', value: [] });
    expect(await a.confirmTx(fakeHash('none'))).toEqual({ kind: 'OK', value: null });
    expect(await a.pending()).toEqual([]);
    expect(await a.ack([])).toEqual({ kind: 'ACKED' });
    expect(await a.ack(['arc:5042002:nope:0'])).toEqual({ kind: 'UNKNOWN_KEY', key: 'arc:5042002:nope:0' });
    await expect(a.resume('alice', 'bob')).rejects.toThrow('the indexer is not halted');
  });
});

describe('FakeNetAdapter specifics', () => {
  const fintent: NetworkTransferIntent = { ...intent, network: 'FAKENET', amount: nativeWei(FAKENET_UNIT_WEI) };

  it('has a coarser value view: amounts below 10¹² wei are not representable', async () => {
    const f = new FakeNetAdapter();
    expect([f.network, f.asset, f.chainId]).toEqual(['FAKENET', 'USDC', 0n]);
    expect(FAKENET_UNIT_WEI).toBe(1_000_000_000_000n);
    expect(await f.precheck(fintent)).toEqual({ kind: 'OK' });
    expect(await f.precheck({ ...fintent, amount: nativeWei(FAKENET_UNIT_WEI + 1n) })).toEqual({
      kind: 'REJECTED',
      code: 'AMOUNT_NOT_REPRESENTABLE',
      detail: 'below the FAKENET unit',
    });
    expect(f.toNetworkAmount(cbsMinor(1n), cbsPrecision(6))).toBe(FAKENET_UNIT_WEI);
    expect(() => f.toNetworkAmount(cbsMinor(1n), cbsPrecision(7))).toThrow('amount is not representable on FAKENET (unit 10^12 wei)');
    expect(() => f.dfnsTransferBody(intent, 'x')).toThrow('intent is for ARC, not FAKENET');
  });

  it('precheck reasons', async () => {
    const f = new FakeNetAdapter();
    const r = (code: string, detail: string) => ({ kind: 'REJECTED', code, detail });
    expect(await f.precheck(intent)).toEqual(r('CHAIN_ID_MISMATCH', 'intent is for ARC'));
    expect(await f.precheck({ ...fintent, asset: 'X' as 'USDC' })).toEqual(r('ASSET_NOT_SUPPORTED', 'asset X'));
    expect(await f.precheck({ ...fintent, from: '0x1' })).toEqual(r('INVALID_SOURCE', 'bad sender'));
    expect(await f.precheck({ ...fintent, to: '0x1' })).toEqual(r('INVALID_DESTINATION', 'bad recipient'));
    expect(await f.precheck({ ...fintent, to: FROM })).toEqual(r('INVALID_DESTINATION', 'bad recipient'));
    expect(await f.precheck({ ...fintent, amount: nativeWei(0n) })).toEqual(r('AMOUNT_NOT_POSITIVE', 'zero amount'));
    f.block(FROM);
    expect(await f.precheck(fintent)).toEqual(r('SENDER_BLOCKLISTED', 'sender blocked'));
    const g = new FakeNetAdapter();
    g.block(TO);
    expect(await g.precheck(fintent)).toEqual(r('RECIPIENT_BLOCKLISTED', 'recipient blocked'));
  });

  it('journal, failures and confirmations', async () => {
    const f = new FakeNetAdapter();
    expect(await f.head()).toEqual({ kind: 'OK', value: { number: 0n, hash: fakeHash('fakenet:head:0') } });
    expect(() => f.redeliver(fakeHash('none'))).toThrow(`no settled transfer ${fakeHash('none')}`);
    const h1 = f.settle(FROM, TO, nativeWei(5n));
    expect(h1).toBe(fakeHash('fakenet:1'));
    f.redeliver(h1);
    const polled = await f.poll(new Set([TO]));
    const t1 = {
      network: 'FAKENET',
      chainId: 0n,
      txHash: h1,
      logIndex: 0n,
      blockNumber: 1n,
      blockHash: fakeHash(`fakenet:block:${h1}`),
      from: FROM,
      to: TO,
      amount: 5n,
      receiptStatus: 1n,
      gas: { payer: FROM, gasUsed: 0n, effectiveGasPrice: 0n },
      sources: 1n,
      dedupeKey: `fakenet:0:${h1}:0`,
      payloadDigest: (polled.kind === 'OK' && polled.value[0]?.payloadDigest) as string,
    };
    expect(polled.kind === 'OK' && polled.value).toEqual([t1]);
    expect(await f.pending()).toEqual([t1]);
    expect(await f.ack([t1.dedupeKey, 'nope'])).toEqual({ kind: 'UNKNOWN_KEY', key: 'nope' });
    expect(await f.pending()).toEqual([t1]);
    expect(await f.ack([t1.dedupeKey])).toEqual({ kind: 'ACKED' });
    expect(await f.pending()).toEqual([]);
    expect(await f.head()).toEqual({ kind: 'OK', value: { number: 2n, hash: fakeHash('fakenet:head:2') } });
    const c = await f.confirmTx(h1.toUpperCase().replace('0X', '0x') as typeof h1);
    expect(c.kind === 'OK' && c.value).toMatchObject({ txHash: h1, blockNumber: 1n, receiptStatus: 1n, sources: 1n });
    f.injectUnknown(FROM, TO);
    expect(await f.confirmTx(fakeHash('fakenet:unknown:3'))).toEqual({ kind: 'OK', value: null });
    const unknown = {
      kind: 'FAILED',
      failure: { kind: 'UNKNOWN_EVENT', txHash: fakeHash('fakenet:unknown:3'), logIndex: 0n, detail: 'unexplained FAKENET entry' },
    };
    expect(await f.poll(new Set([TO]))).toEqual(unknown);
    expect(await f.confirmTx(h1)).toEqual(unknown);
    expect(await f.head()).toEqual(unknown);
  });

  it('stall clears by itself; disagreement halts until two approvers resume', async () => {
    const f = new FakeNetAdapter();
    const h1 = f.settle(FROM, TO, nativeWei(5n));
    f.setStall(true);
    f.setDisagreement(true);
    const stall = { kind: 'FAILED', failure: { kind: 'CHAIN_STALL', lastHead: 1n, sinceMs: 0n } };
    expect(await f.poll(new Set([TO]))).toEqual(stall);
    expect(await f.confirmTx(h1)).toEqual(stall);
    expect(await f.head()).toEqual(stall);
    f.setStall(false);
    const disagreement = { kind: 'FAILED', failure: { kind: 'RPC_DISAGREEMENT', detail: 'FAKENET disagreement flag' } };
    expect(await f.head()).toEqual(disagreement);
    f.setDisagreement(false);
    expect(await f.poll(new Set([TO]))).toEqual(disagreement);
    await expect(f.resume('alice', 'alice')).rejects.toThrow('resume needs two distinct named approvers');
    expect(await f.confirmTx(h1)).toEqual(disagreement);
    await f.resume('alice', 'bob');
    expect(f.resumedBy).toEqual([['alice', 'bob']]);
    await expect(f.resume('alice', 'bob')).rejects.toThrow('the network is not halted');
    const r = await f.poll(new Set([TO]));
    expect(r.kind === 'OK' && r.value.map((t) => t.txHash)).toEqual([h1]);
  });

  it('an injected lag fails after a partial commit; the committed entries are not lost', async () => {
    const f = new FakeNetAdapter();
    const h1 = f.settle(FROM, TO, nativeWei(1n));
    const h2 = f.settle(TO, FROM, nativeWei(2n));
    f.lagAfterCommits(1n);
    expect(await f.poll(new Set([TO]))).toEqual({
      kind: 'FAILED',
      failure: { kind: 'SOURCE_LAGGING', source: 'fakenet', detail: 'injected lag after a partial commit' },
    });
    expect((await f.pending()).map((t) => t.txHash)).toEqual([h1]);
    const r = await f.poll(new Set([TO]));
    expect(r.kind === 'OK' && r.value.map((t) => t.txHash)).toEqual([h1, h2]);
    f.lagAfterCommits(5n);
    expect(await f.poll(new Set([TO]))).toMatchObject({ kind: 'OK' });
  });

  it('an empty poll keeps the cursor; a duplicate in one batch is returned once; an unrelated entry is skipped', async () => {
    const f = new FakeNetAdapter();
    expect(await f.poll(new Set([TO]))).toEqual({ kind: 'OK', value: [] });
    const h = f.settle(FROM, TO, nativeWei(1n));
    f.redeliver(h);
    f.settle(fakeAddress('x'), fakeAddress('y'), nativeWei(1n));
    const r = await f.poll(new Set([FROM]));
    expect(r.kind === 'OK' && r.value.map((t) => t.txHash)).toEqual([h]);
  });
});

describe('FakeNetAdapter ledger, per-address cursors and compare-and-set (m3)', () => {
  const T = fakeAddress('fn-theirs');
  const OURS = fakeAddress('fn-ours');
  const OTHER = fakeAddress('fn-other');
  const txs = (r: Awaited<ReturnType<FakeNetAdapter['poll']>>): readonly string[] => (r.kind === 'OK' ? r.value.map((t) => t.txHash) : [r.failure.kind]);

  it('starts empty; a restart over the same ledger keeps journal, cursors, inbox and halt', async () => {
    const ledger = new FakeNetLedger();
    expect(ledger.journal).toEqual([]);
    expect(ledger.nextSeq).toBe(1n);
    const f = new FakeNetAdapter(ledger);
    expect(f.ledger).toBe(ledger);
    expect(await f.head()).toMatchObject({ kind: 'OK', value: { number: 0n } });
    const h = f.settle(T, OURS, nativeWei(FAKENET_UNIT_WEI));
    expect(txs(await f.poll(new Set([OURS])))).toEqual([h]);
    const g = new FakeNetAdapter(ledger);
    expect((await g.pending()).map((t) => t.txHash)).toEqual([h]);
    expect(ledger.cursors.get(OURS)).toBe(1n);
  });

  it('redeliver repeats the named transfer, not another one', () => {
    const f = new FakeNetAdapter();
    f.settle(T, OURS, nativeWei(1n));
    const h2 = f.settle(T, OTHER, nativeWei(2n));
    f.redeliver(h2);
    const last = f.ledger.journal[2];
    expect([last?.seq, last?.txHash, last?.to, last?.amount]).toEqual([3n, h2, OTHER, 2n]);
  });

  it('payloadDigest is sha256 hex over the transfer content', async () => {
    const f = new FakeNetAdapter();
    const h = f.settle(T, OURS, nativeWei(7n));
    const r = await f.poll(new Set([OURS]));
    const want = createHash('sha256').update(`${h}|${T}|${OURS}|7`, 'utf8').digest('hex');
    expect(r.kind === 'OK' && r.value[0]?.payloadDigest).toBe(want);
  });

  it('only entries past an address\'s cursor are pending; a new address back-scans without moving the others back', async () => {
    const f = new FakeNetAdapter();
    const e1 = f.settle(T, OURS, nativeWei(1n));
    const e2 = f.settle(T, OURS, nativeWei(2n));
    expect(txs(await f.poll(new Set([OURS])))).toEqual([e1, e2]);
    expect(f.ledger.cursors.get(OURS)).toBe(2n);
    // Nothing is pending, so a zero commit budget is never reached.
    f.lagAfterCommits(0n);
    expect(txs(await f.poll(new Set([OURS])))).toEqual([e1, e2]);
    const e3 = f.settle(T, OTHER, nativeWei(3n));
    f.lagAfterCommits(1n);
    expect(txs(await f.poll(new Set([OURS, OTHER])))).toEqual(['SOURCE_LAGGING']);
    expect([f.ledger.cursors.get(OURS), f.ledger.cursors.get(OTHER)]).toEqual([2n, 1n]);
    expect(txs(await f.poll(new Set([OURS, OTHER])))).toEqual([e1, e2, e3]);
    expect([f.ledger.cursors.get(OURS), f.ledger.cursors.get(OTHER)]).toEqual([3n, 3n]);
  });

  it('a lost race reports the expected and actual cursor; the race happens once', async () => {
    const f = new FakeNetAdapter();
    const e1 = f.settle(T, OURS, nativeWei(1n));
    f.raceNextCommit();
    expect(await f.poll(new Set([OURS]))).toEqual({ kind: 'FAILED', failure: { kind: 'CURSOR_CONFLICT', expected: 0n, actual: 1n } });
    await f.resume('alice', 'bob');
    const e2 = f.settle(T, OURS, nativeWei(2n));
    expect(txs(await f.poll(new Set([OURS])))).toEqual([e1, e2]);
  });
});
