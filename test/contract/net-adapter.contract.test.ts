/**
 * Unit NET: the network contract suite (NOVA_ARC_DESIGN §5.3). The same
 * tests run against `ArcNetworkAdapter` (over two in-memory Arc chains) and
 * the structurally different `FakeNetAdapter`. The file is named
 * `net-adapter.contract.test.ts`, not §5.3's `network-adapter.contract.ts`,
 * because the vitest `contract` project only collects `*.contract.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision, nativeWei, nativeWeiToCbsMinor } from '../../src/amounts/index.js';
import type { NativeWei } from '../../src/amounts/index.js';
import type { Hex32 } from '../../src/chain/config/index.js';
import { ArcIndexer } from '../../src/indexer/indexer.js';
import { InMemoryArcChain, MapIndexerStore, ManualTiming, fakeAddress, fakeHash, nativeTransferTx, transferLog } from '../../src/indexer/fakes.js';
import type { LogFilter, RawLog, RpcOutcome, RpcSource } from '../../src/indexer/rpc.js';
import type { AckOutcome, CommitOutcome, IndexerStore, LivenessState, PageCommit } from '../../src/indexer/store.js';
import { ArcNetworkAdapter } from '../../src/network/arc/adapter.js';
import { SetBlocklist } from '../../src/network/arc/blocklist-fakes.js';
import { loadArcNetworkParams } from '../../src/network/arc/config.js';
import { FakeNetAdapter } from '../../src/network/fake/adapter.js';
import type { ArcNetworkParams } from '../../src/network/arc/params.js';
import type { ConfirmedTransfer, NetworkAdapter, NetworkAddress, NetworkFailure, NetworkId } from '../../src/network/types.js';

interface Harness {
  /** The current adapter; `restart` replaces it with a new one over the same durable state. */
  readonly adapter: NetworkAdapter;
  restart(): void;
  /** A second writer commits the next poll's first page (or entry) before it does. */
  raceNextCommit(): void;
  readonly network: NetworkId;
  settle(from: NetworkAddress, to: NetworkAddress, amount: NativeWei): Hex32;
  redeliver(txHash: Hex32): void;
  /** While on, the sources disagree about settled transfers. */
  disagree(on: boolean): void;
  stall(): void;
  unknown(from: NetworkAddress, to: NetworkAddress): void;
  crashNextCommit(): void;
  /** Make the next settle land in a later commit unit than the previous one (Arc: the next 9,999-block page). */
  nextPage(): void;
  /** While on, the next poll commits its first unit, then fails SOURCE_LAGGING. */
  lagAfterFirstCommit(on: boolean): void;
  blockSender(a: NetworkAddress): void;
  blockRecipient(a: NetworkAddress): void;
}

/** Owns its cursors (so a range can be re-read) and delegates the rest; can crash before a commit, or lose a race to a second writer. */
class RewindableStore implements IndexerStore {
  private cursors = new Map<string, bigint>();
  crash = false;
  race = false;
  constructor(private readonly inner: IndexerStore) {}
  async loadCursor(key: string): Promise<bigint | null> {
    return this.cursors.get(key) ?? null;
  }
  async commitPage(c: PageCommit): Promise<CommitOutcome> {
    if (this.crash) {
      this.crash = false;
      throw new Error('crash between fetch and commit');
    }
    if (this.race) {
      this.race = false;
      await this.commitPage(c);
    }
    for (const m of c.cursors) {
      const actual = this.cursors.get(m.cursorKey) ?? null;
      if (m.expected !== actual) return { kind: 'CURSOR_CONFLICT', cursorKey: m.cursorKey, expected: m.expected, actual };
    }
    const moves = [];
    for (const m of c.cursors) moves.push({ ...m, expected: await this.inner.loadCursor(m.cursorKey) });
    const out = await this.inner.commitPage({ ...c, cursors: moves });
    if (out.kind === 'COMMITTED') for (const m of c.cursors) this.cursors.set(m.cursorKey, m.next);
    return out;
  }
  unacknowledged(stream: string): Promise<readonly ConfirmedTransfer[]> {
    return this.inner.unacknowledged(stream);
  }
  acknowledge(stream: string, keys: readonly string[]): Promise<AckOutcome> {
    return this.inner.acknowledge(stream, keys);
  }
  loadHalt(stream: string): Promise<NetworkFailure | null> {
    return this.inner.loadHalt(stream);
  }
  recordHalt(stream: string, f: NetworkFailure): Promise<void> {
    return this.inner.recordHalt(stream, f);
  }
  clearHalt(stream: string, approvers: readonly [string, string]): Promise<void> {
    return this.inner.clearHalt(stream, approvers);
  }
  loadLiveness(stream: string): Promise<LivenessState | null> {
    return this.inner.loadLiveness(stream);
  }
  saveLiveness(stream: string, state: LivenessState | null): Promise<void> {
    return this.inner.saveLiveness(stream, state);
  }
  rewind(): void {
    this.cursors = new Map();
  }
}

/** A source that can drop every log (`lying`) or answer -32014 above a block (`lagFrom`). */
class SwitchableSource implements RpcSource {
  lying = false;
  lagFrom: bigint | null = null;
  constructor(private readonly inner: InMemoryArcChain) {}
  get name(): string {
    return this.inner.name;
  }
  head() {
    return this.inner.head();
  }
  getReceipt(h: Hex32) {
    return this.inner.getReceipt(h);
  }
  async getLogs(f: LogFilter): Promise<RpcOutcome<readonly RawLog[]>> {
    if (this.lagFrom !== null && f.fromBlock >= this.lagFrom) return { ok: false, error: { kind: 'RPC', code: -32014n, message: 'block not imported' } };
    if (this.lying) return { ok: true, value: [] };
    return this.inner.getLogs(f);
  }
}

function arcHarness(): Harness {
  const params = loadArcNetworkParams({
    chainId: 5042002n,
    dfnsNetwork: 'ArcTestnet',
    singleSourceTestnetOnly: false,
    stallAfterMs: 30_000n,
    startBlock: 1n,
    blocklistMaxAgeMs: 60_000n,
    headRegressionToleranceBlocks: 5n,
  });
  const ownChain = new InMemoryArcChain('own-node');
  const refChain = new InMemoryArcChain('reference');
  const own = new SwitchableSource(ownChain);
  const ref = new SwitchableSource(refChain);
  const timing = new ManualTiming();
  const store = new RewindableStore(new MapIndexerStore());
  const blocklist = new SetBlocklist(timing.now());
  const build = (p: ArcNetworkParams): NetworkAdapter =>
    new ArcNetworkAdapter({ params: p, indexer: new ArcIndexer({ params: p, sources: [own, ref], store, timing }), blocklist, clock: timing });
  let adapter = build(params);
  let n = 0n;
  return {
    get adapter() {
      return adapter;
    },
    restart() {
      adapter = build(params);
    },
    raceNextCommit() {
      store.race = true;
    },
    network: 'ARC',
    settle(from, to, amount) {
      n += 1n;
      const tx = nativeTransferTx(params, `contract:${n}`, from, to, amount);
      ownChain.mine([tx]);
      refChain.mine([tx]);
      return tx.hash;
    },
    redeliver() {
      store.rewind();
    },
    disagree(on) {
      ref.lying = on;
    },
    stall() {
      timing.advance(30_000n);
    },
    unknown(from, to) {
      const bad = { ...transferLog(params, params.systemEmitter, from, to, 1n), data: '0x01' as const };
      const tx = { hash: fakeHash('contract:unknown'), from, status: 1n, gasUsed: 1n, effectiveGasPrice: 1n, logs: [bad] };
      ownChain.mine([tx]);
      refChain.mine([tx]);
    },
    crashNextCommit() {
      store.crash = true;
    },
    nextPage() {
      ownChain.mineEmpty(params.maxBlocksPerPage);
      refChain.mineEmpty(params.maxBlocksPerPage);
    },
    lagAfterFirstCommit(on) {
      own.lagFrom = on ? params.startBlock + params.maxBlocksPerPage : null;
    },
    blockSender(a) {
      blocklist.block(a);
    },
    blockRecipient(a) {
      blocklist.block(a);
    },
  };
}

function fakeHarness(): Harness {
  let adapter = new FakeNetAdapter();
  return {
    get adapter() {
      return adapter;
    },
    restart() {
      adapter = new FakeNetAdapter(adapter.ledger);
    },
    raceNextCommit: () => adapter.raceNextCommit(),
    network: 'FAKENET',
    settle: (from, to, amount) => adapter.settle(from, to, amount),
    redeliver: (h) => adapter.redeliver(h),
    disagree: (on) => adapter.setDisagreement(on),
    stall: () => adapter.setStall(true),
    unknown: (from, to) => adapter.injectUnknown(from, to),
    crashNextCommit: () => adapter.crashNextCommit(),
    nextPage: () => undefined,
    lagAfterFirstCommit: (on) => {
      if (on) adapter.lagAfterCommits(1n);
    },
    blockSender: (a) => adapter.block(a),
    blockRecipient: (a) => adapter.block(a),
  };
}

const ours = fakeAddress('contract:ours');
const theirs = fakeAddress('contract:theirs');
const ONE_USDC = nativeWei(1_000_000_000_000_000_000n);

describe.each([
  ['ArcNetworkAdapter', arcHarness],
  ['FakeNetAdapter', fakeHarness],
] as const)('network contract: %s', (_name, make) => {
  it('toNetworkAmount is exact through U1 and round-trips', () => {
    const { adapter } = make();
    const p = cbsPrecision(2);
    const wei = adapter.toNetworkAmount(cbsMinor(12_345n), p);
    expect(wei).toBe(123_450_000_000_000_000_000n);
    expect(nativeWeiToCbsMinor(wei, p)).toEqual({ minor: 12_345n, dustWei: 0n });
  });

  const keysOf = (r: Awaited<ReturnType<NetworkAdapter['poll']>>): readonly string[] => (r.kind === 'OK' ? r.value.map((t) => t.txHash) : [`FAILED ${r.failure.kind}`]);

  it('poll returns a settled transfer with its binding fields, the same until acknowledged, and is idempotent', async () => {
    const h = make();
    const txHash = h.settle(ours, theirs, ONE_USDC);
    const first = await h.adapter.poll(new Set([ours]));
    expect(first.kind).toBe('OK');
    if (first.kind !== 'OK') return;
    expect(first.value).toHaveLength(1);
    expect(first.value[0]).toMatchObject({ network: h.network, txHash, from: ours, to: theirs, amount: ONE_USDC, receiptStatus: 1n });
    expect(await h.adapter.poll(new Set([ours]))).toEqual(first);
    expect(await h.adapter.pending()).toEqual(first.value);
    expect(await h.adapter.ack([(first.value[0] as ConfirmedTransfer).dedupeKey])).toEqual({ kind: 'ACKED' });
    expect(await h.adapter.poll(new Set([ours]))).toEqual({ kind: 'OK', value: [] });
    expect(await h.adapter.pending()).toEqual([]);
  });

  it('poll refuses a malformed address before any read (INVALID_ADDRESS, not sticky) and lower-cases a valid one (lensR-1 m6)', async () => {
    const h = make();
    const txHash = h.settle(ours, theirs, ONE_USDC);
    const bad = '0x1234' as NetworkAddress;
    const refused = { kind: 'FAILED', failure: { kind: 'INVALID_ADDRESS', address: '0x1234' } };
    expect(await h.adapter.poll(new Set([ours, bad]))).toEqual(refused);
    expect(await h.adapter.poll(new Set([`0x${'g'.repeat(40)}` as NetworkAddress]))).toEqual({ kind: 'FAILED', failure: { kind: 'INVALID_ADDRESS', address: `0x${'g'.repeat(40)}` } });
    expect(await h.adapter.pending()).toEqual([]);
    const upper = `0x${ours.slice(2).toUpperCase()}` as NetworkAddress;
    const r = await h.adapter.poll(new Set([upper, ours]));
    expect(keysOf(r)).toEqual([txHash]);
    expect(r.kind === 'OK' && r.value[0]).toMatchObject({ to: theirs, from: ours });
  });

  it('ack is all or nothing: an unknown key acknowledges none', async () => {
    const h = make();
    h.settle(ours, theirs, ONE_USDC);
    const r = await h.adapter.poll(new Set([ours]));
    const key = r.kind === 'OK' ? (r.value[0] as ConfirmedTransfer).dedupeKey : '';
    expect(await h.adapter.ack([key, 'never-committed'])).toEqual({ kind: 'UNKNOWN_KEY', key: 'never-committed' });
    expect((await h.adapter.pending()).map((t) => t.dedupeKey)).toEqual([key]);
  });

  it('a transfer touching none of our addresses is not returned', async () => {
    const h = make();
    h.settle(fakeAddress('x'), theirs, ONE_USDC);
    expect(await h.adapter.poll(new Set([ours]))).toEqual({ kind: 'OK', value: [] });
  });

  it('a re-delivered transfer is deduplicated, before and after its acknowledgement', async () => {
    const h = make();
    const txHash = h.settle(ours, theirs, ONE_USDC);
    expect(keysOf(await h.adapter.poll(new Set([ours])))).toEqual([txHash]);
    h.redeliver(txHash);
    const again = await h.adapter.poll(new Set([ours]));
    expect(keysOf(again)).toEqual([txHash]);
    await h.adapter.ack(again.kind === 'OK' ? again.value.map((t) => t.dedupeKey) : []);
    h.redeliver(txHash);
    expect(await h.adapter.poll(new Set([ours]))).toEqual({ kind: 'OK', value: [] });
  });

  it('resumes from the cursor after a crash between fetch and commit, delivering once', async () => {
    const h = make();
    const txHash = h.settle(ours, theirs, ONE_USDC);
    h.crashNextCommit();
    await expect(h.adapter.poll(new Set([ours]))).rejects.toThrow('crash between fetch and commit');
    expect(await h.adapter.pending()).toEqual([]);
    const again = await h.adapter.poll(new Set([ours]));
    expect(keysOf(again)).toEqual([txHash]);
    await h.adapter.ack(again.kind === 'OK' ? again.value.map((t) => t.dedupeKey) : []);
    expect(await h.adapter.poll(new Set([ours]))).toEqual({ kind: 'OK', value: [] });
  });

  it('a failure after a partial commit loses nothing: committed transfers stay pending and are delivered once (B1)', async () => {
    const h = make();
    const t1 = h.settle(theirs, ours, ONE_USDC);
    h.nextPage();
    const t2 = h.settle(ours, theirs, ONE_USDC);
    h.lagAfterFirstCommit(true);
    const failed = await h.adapter.poll(new Set([ours]));
    expect(failed.kind === 'FAILED' && failed.failure.kind).toBe('SOURCE_LAGGING');
    expect((await h.adapter.pending()).map((t) => t.txHash)).toEqual([t1]);
    h.lagAfterFirstCommit(false);
    expect(keysOf(await h.adapter.poll(new Set([ours])))).toEqual([t1, t2]);
    expect(keysOf(await h.adapter.poll(new Set([ours])))).toEqual([t1, t2]);
  });

  it('source disagreement → RPC_DISAGREEMENT, sticky until two distinct approvers resume', async () => {
    const h = make();
    const txHash = h.settle(theirs, ours, ONE_USDC);
    h.disagree(true);
    const r = await h.adapter.poll(new Set([ours]));
    expect(r.kind === 'FAILED' && r.failure.kind).toBe('RPC_DISAGREEMENT');
    h.disagree(false);
    expect(await h.adapter.poll(new Set([ours]))).toEqual(r);
    expect(await h.adapter.head()).toEqual(r);
    expect(await h.adapter.confirmTx(txHash)).toEqual(r);
    await expect(h.adapter.resume('alice', ' alice ')).rejects.toThrow(RangeError);
    expect(await h.adapter.poll(new Set([ours]))).toEqual(r);
    await h.adapter.resume('alice', 'bob');
    expect(keysOf(await h.adapter.poll(new Set([ours])))).toEqual([txHash]);
    await expect(h.adapter.resume('alice', 'bob')).rejects.toThrow(RangeError);
  });

  it('a sticky halt survives a restart; the restarted adapter resumes with two approvers (m3)', async () => {
    const h = make();
    const txHash = h.settle(theirs, ours, ONE_USDC);
    h.disagree(true);
    const r = await h.adapter.poll(new Set([ours]));
    expect(r.kind === 'FAILED' && r.failure.kind).toBe('RPC_DISAGREEMENT');
    h.disagree(false);
    h.restart();
    expect(await h.adapter.poll(new Set([ours]))).toEqual(r);
    expect(await h.adapter.head()).toEqual(r);
    await h.adapter.resume('alice', 'bob');
    expect(keysOf(await h.adapter.poll(new Set([ours])))).toEqual([txHash]);
  });

  it('a newly added address is scanned from the start, not only past the other addresses\' cursors (m3)', async () => {
    const h = make();
    const other = fakeAddress('contract:other');
    const txHash = h.settle(theirs, other, ONE_USDC);
    expect(await h.adapter.poll(new Set([ours]))).toEqual({ kind: 'OK', value: [] });
    expect(keysOf(await h.adapter.poll(new Set([ours, other])))).toEqual([txHash]);
    expect(keysOf(await h.adapter.poll(new Set([ours, other])))).toEqual([txHash]);
  });

  it('a second writer moving a cursor → CURSOR_CONFLICT, sticky; after resume the transfer is delivered once (m3)', async () => {
    const h = make();
    const txHash = h.settle(theirs, ours, ONE_USDC);
    h.raceNextCommit();
    const r = await h.adapter.poll(new Set([ours]));
    expect(r.kind === 'FAILED' && r.failure.kind).toBe('CURSOR_CONFLICT');
    expect(await h.adapter.poll(new Set([ours]))).toEqual(r);
    await h.adapter.resume('alice', 'bob');
    expect(keysOf(await h.adapter.poll(new Set([ours])))).toEqual([txHash]);
    h.nextPage();
    const later = h.settle(ours, theirs, ONE_USDC);
    expect(keysOf(await h.adapter.poll(new Set([ours])))).toEqual([txHash, later]);
  });

  it('CHAIN_STALL is still reported after a restart (m4)', async () => {
    const h = make();
    expect((await h.adapter.head()).kind).toBe('OK');
    h.restart();
    h.stall();
    const r = await h.adapter.poll(new Set([ours]));
    expect(r.kind === 'FAILED' && r.failure.kind).toBe('CHAIN_STALL');
  });

  it('no new head → CHAIN_STALL', async () => {
    const h = make();
    expect((await h.adapter.head()).kind).toBe('OK');
    h.stall();
    const r = await h.adapter.poll(new Set([ours]));
    expect(r.kind === 'FAILED' && r.failure.kind).toBe('CHAIN_STALL');
    const hd = await h.adapter.head();
    expect(hd.kind === 'FAILED' && hd.failure.kind).toBe('CHAIN_STALL');
  });

  it('an unexplained event → UNKNOWN_EVENT, never "no transfers"; it halts', async () => {
    const h = make();
    h.unknown(ours, theirs);
    const r = await h.adapter.poll(new Set([ours]));
    expect(r.kind === 'FAILED' && r.failure.kind).toBe('UNKNOWN_EVENT');
    expect(await h.adapter.head()).toEqual(r);
  });

  it('confirmTx finds a settled transaction and returns null for an unknown hash', async () => {
    const h = make();
    const txHash = h.settle(ours, theirs, ONE_USDC);
    const r = await h.adapter.confirmTx(txHash);
    expect(r.kind === 'OK' && r.value?.transfers.map((t) => [t.from, t.to, t.amount])).toEqual([[ours, theirs, ONE_USDC]]);
    expect(r.kind === 'OK' && r.value?.receiptStatus).toBe(1n);
    expect(await h.adapter.confirmTx(fakeHash('never'))).toEqual({ kind: 'OK', value: null });
  });

  it('precheck accepts a valid intent and refuses the documented cases', async () => {
    const h = make();
    const base = { network: h.network, asset: 'USDC', from: ours, to: theirs, amount: ONE_USDC } as const;
    expect(await h.adapter.precheck(base)).toEqual({ kind: 'OK' });
    const code = async (i: Partial<typeof base> | Record<string, unknown>) => {
      const r = await h.adapter.precheck({ ...base, ...i } as typeof base);
      return r.kind === 'REJECTED' ? r.code : 'OK';
    };
    expect(await code({ network: h.network === 'ARC' ? 'FAKENET' : 'ARC' })).toBe('CHAIN_ID_MISMATCH');
    expect(await code({ asset: 'EURC' })).toBe('ASSET_NOT_SUPPORTED');
    expect(await code({ from: 'nope' })).toBe('INVALID_SOURCE');
    expect(await code({ to: theirs.toUpperCase().replace('0X', '0x') })).toBe('INVALID_DESTINATION');
    expect(await code({ to: ours })).toBe('INVALID_DESTINATION');
    expect(await code({ to: `0x${'0'.repeat(40)}` })).toBe('INVALID_DESTINATION');
    expect(await code({ amount: nativeWei(0n) })).toBe('AMOUNT_NOT_POSITIVE');
    h.blockRecipient(theirs);
    expect(await code({})).toBe('RECIPIENT_BLOCKLISTED');
    h.blockSender(ours);
    expect(await code({})).toBe('SENDER_BLOCKLISTED');
  });

  it('dfnsTransferBody is a Native body with a ^\\d+$ amount and a checked externalId', () => {
    const h = make();
    const intent = { network: h.network, asset: 'USDC', from: ours, to: theirs, amount: ONE_USDC } as const;
    expect(h.adapter.dfnsTransferBody(intent, 'nv1-abc')).toEqual({
      kind: 'Native',
      to: theirs,
      amount: '1000000000000000000',
      priority: 'Standard',
      externalId: 'nv1-abc',
    });
    expect(() => h.adapter.dfnsTransferBody(intent, '')).toThrow(RangeError);
    expect(() => h.adapter.dfnsTransferBody(intent, 'x'.repeat(51))).toThrow(RangeError);
    expect(h.adapter.dfnsTransferBody(intent, 'x'.repeat(50)).externalId).toHaveLength(50);
    expect(() => h.adapter.dfnsTransferBody({ ...intent, network: h.network === 'ARC' ? 'FAKENET' : 'ARC' }, 'a')).toThrow(RangeError);
  });

  it('head reports a number and a hash', async () => {
    const h = make();
    h.settle(ours, theirs, ONE_USDC);
    const r = await h.adapter.head();
    expect(r.kind === 'OK' && r.value.number).toBe(1n);
    expect(r.kind === 'OK' && /^0x[0-9a-f]{64}$/.test(r.value.hash)).toBe(true);
  });
});
