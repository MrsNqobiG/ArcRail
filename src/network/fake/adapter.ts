/**
 * Unit NET: `FakeNetAdapter`, the second network adapter (NOVA_ARC_DESIGN
 * §5.3). Test support only: `FAKENET` must be refused by a production
 * composition root.
 *
 * Structurally different from Arc on purpose: no logs, no blocks, no RPC
 * sources, no store port. Its whole state is one `FakeNetLedger` object: an
 * append-only journal of settled transfers whose sequence number is the
 * cursor (one per address, so an address added later is scanned from the
 * first entry), committed one entry at a time into an inbox map with a
 * compare-and-set on the cursors (a second writer → CURSOR_CONFLICT),
 * settable stall / disagreement / lag flags, and the sticky halt. A restart
 * is a new adapter over the same ledger, so the halt survives it. Its value
 * view is coarser: an amount that is not a whole multiple of 10¹² wei
 * (10⁻⁶ USDC) is not representable here. It passes the same network contract
 * tests as `ArcNetworkAdapter` (test/contract/net-adapter.contract.test.ts).
 */
import { createHash } from 'node:crypto';
import { cbsMinorToNativeWei, nativeWei } from '../../amounts/index.js';
import type { CbsMinor, CbsPrecision, NativeWei } from '../../amounts/index.js';
import { checkApprovers, checkExternalId, dfnsAmount, toNetworkAddress, transferDedupeKey } from '../types.js';
import type {
  AckResult,
  ConfirmedTransfer,
  Hex32,
  DfnsNativeTransferBody,
  NetworkAdapter,
  NetworkAddress,
  NetworkFailure,
  NetworkHead,
  NetworkRead,
  NetworkTransferIntent,
  PrecheckResult,
  TxConfirmation,
} from '../types.js';

/** The coarsest unit FAKENET can carry: 10¹² wei. */
export const FAKENET_UNIT_WEI = 1_000_000_000_000n;
const ZERO = `0x${'0'.repeat(40)}`;

interface Entry {
  readonly seq: bigint;
  readonly txHash: Hex32;
  readonly from: NetworkAddress;
  readonly to: NetworkAddress;
  readonly amount: NativeWei;
  /** An entry the network cannot explain (UNKNOWN_EVENT on poll). */
  readonly unknown: boolean;
}

const hashOf = (label: string): Hex32 => `0x${createHash('sha256').update(label, 'utf8').digest('hex')}`;

interface InboxEntry {
  readonly transfer: ConfirmedTransfer;
  acked: boolean;
}

/** Everything FAKENET keeps: the network side (journal, flags) and the adapter's durable side (cursors, inbox, halt). */
export class FakeNetLedger {
  journal: readonly Entry[] = [];
  nextSeq = 1n;
  /** Last journal sequence committed per address (absent: none yet). */
  readonly cursors = new Map<NetworkAddress, bigint>();
  readonly inbox = new Map<string, InboxEntry>();
  readonly blocked = new Set<string>();
  stall = false;
  disagreement = false;
  crash = false;
  /** A second writer commits the next entry first, so the poll's compare-and-set fails. */
  race = false;
  /** Entries the next poll may commit before it fails SOURCE_LAGGING (null: no injected lag). */
  lagAfter: bigint | null = null;
  halted: NetworkFailure | null = null;
  resumes: readonly (readonly [string, string])[] = [];
}

export class FakeNetAdapter implements NetworkAdapter {
  readonly network = 'FAKENET';
  readonly asset = 'USDC';
  readonly chainId = 0n;
  readonly ledger: FakeNetLedger;

  /** A restart is `new FakeNetAdapter(previous.ledger)`. */
  constructor(ledger: FakeNetLedger = new FakeNetLedger()) {
    this.ledger = ledger;
  }

  private append(entry: Omit<Entry, 'seq'>): void {
    const l = this.ledger;
    l.journal = [...l.journal, { ...entry, seq: l.nextSeq }];
    l.nextSeq += 1n;
  }

  /** Settle a transfer on the fake network; returns its transaction hash. */
  settle(from: NetworkAddress, to: NetworkAddress, amount: NativeWei): Hex32 {
    const txHash = hashOf(`fakenet:${this.ledger.nextSeq}`);
    this.append({ txHash, from, to, amount, unknown: false });
    return txHash;
  }

  /** Deliver an already settled transfer again (same hash, same content), as a later sequence entry. */
  redeliver(txHash: Hex32): void {
    const original = this.ledger.journal.find((e) => e.txHash === txHash);
    if (original === undefined) throw new RangeError(`no settled transfer ${txHash}`);
    this.append(original);
  }

  /** Append an entry the network cannot explain. */
  injectUnknown(from: NetworkAddress, to: NetworkAddress): void {
    this.append({ txHash: hashOf(`fakenet:unknown:${this.ledger.nextSeq}`), from, to, amount: nativeWei(0n), unknown: true });
  }

  setStall(on: boolean): void {
    this.ledger.stall = on;
  }

  setDisagreement(on: boolean): void {
    this.ledger.disagreement = on;
  }

  /** The next poll throws after reading and before committing (a crash between fetch and commit). */
  crashNextCommit(): void {
    this.ledger.crash = true;
  }

  /** A second writer commits the next poll's first entry before it does (CURSOR_CONFLICT). */
  raceNextCommit(): void {
    this.ledger.race = true;
  }

  /** The next poll commits `entries` journal entries, then fails SOURCE_LAGGING (a failure after a partial commit). */
  lagAfterCommits(entries: bigint): void {
    this.ledger.lagAfter = entries;
  }

  block(address: NetworkAddress): void {
    this.ledger.blocked.add(address);
  }

  /** Every recorded resume's approvers (test inspection). */
  get resumedBy(): readonly (readonly [string, string])[] {
    return this.ledger.resumes;
  }

  async precheck(intent: NetworkTransferIntent): Promise<PrecheckResult> {
    if (intent.network !== 'FAKENET') return { kind: 'REJECTED', code: 'CHAIN_ID_MISMATCH', detail: `intent is for ${intent.network}` };
    if (intent.asset !== 'USDC') return { kind: 'REJECTED', code: 'ASSET_NOT_SUPPORTED', detail: `asset ${intent.asset}` };
    if (toNetworkAddress(intent.from) !== intent.from) return { kind: 'REJECTED', code: 'INVALID_SOURCE', detail: 'bad sender' };
    if (toNetworkAddress(intent.to) !== intent.to || intent.to === ZERO || intent.to === intent.from) {
      return { kind: 'REJECTED', code: 'INVALID_DESTINATION', detail: 'bad recipient' };
    }
    if (intent.amount <= 0n) return { kind: 'REJECTED', code: 'AMOUNT_NOT_POSITIVE', detail: 'zero amount' };
    if (intent.amount % FAKENET_UNIT_WEI !== 0n) return { kind: 'REJECTED', code: 'AMOUNT_NOT_REPRESENTABLE', detail: 'below the FAKENET unit' };
    if (this.ledger.blocked.has(intent.from)) return { kind: 'REJECTED', code: 'SENDER_BLOCKLISTED', detail: 'sender blocked' };
    if (this.ledger.blocked.has(intent.to)) return { kind: 'REJECTED', code: 'RECIPIENT_BLOCKLISTED', detail: 'recipient blocked' };
    return { kind: 'OK' };
  }

  toNetworkAmount(minor: CbsMinor, p: CbsPrecision): NativeWei {
    const wei = cbsMinorToNativeWei(minor, p);
    if (wei % FAKENET_UNIT_WEI !== 0n) throw new RangeError('amount is not representable on FAKENET (unit 10^12 wei)');
    return wei;
  }

  dfnsTransferBody(intent: NetworkTransferIntent, externalId: string): DfnsNativeTransferBody {
    if (intent.network !== 'FAKENET') throw new RangeError(`intent is for ${intent.network}, not FAKENET`);
    return { kind: 'Native', to: intent.to, amount: dfnsAmount(intent.amount), priority: 'Standard', externalId: checkExternalId(externalId) };
  }

  private transfer(e: Entry): ConfirmedTransfer {
    return {
      network: 'FAKENET',
      chainId: this.chainId,
      txHash: e.txHash,
      logIndex: 0n,
      blockNumber: e.seq,
      blockHash: hashOf(`fakenet:block:${e.txHash}`),
      from: e.from,
      to: e.to,
      amount: e.amount,
      receiptStatus: 1n,
      gas: { payer: e.from, gasUsed: 0n, effectiveGasPrice: 0n },
      sources: 1n,
      dedupeKey: transferDedupeKey('FAKENET', this.chainId, e.txHash, 0n),
      payloadDigest: createHash('sha256').update(`${e.txHash}|${e.from}|${e.to}|${e.amount}`, 'utf8').digest('hex'),
    };
  }

  private halt(failure: NetworkFailure): NetworkRead<never> {
    this.ledger.halted = failure;
    return { kind: 'FAILED', failure };
  }

  /** The sticky halt, then the stall flag (clears by itself), then the disagreement flag (halts). */
  private failure(): NetworkRead<never> | null {
    const l = this.ledger;
    if (l.halted !== null) return { kind: 'FAILED', failure: l.halted };
    if (l.stall) return { kind: 'FAILED', failure: { kind: 'CHAIN_STALL', lastHead: l.nextSeq - 1n, sinceMs: 0n } };
    if (l.disagreement) return this.halt({ kind: 'RPC_DISAGREEMENT', detail: 'FAKENET disagreement flag' });
    return null;
  }

  private unacked(): readonly ConfirmedTransfer[] {
    return [...this.ledger.inbox.values()].filter((e) => !e.acked).map((e) => e.transfer);
  }

  /** Commit one entry for the addresses it is new to: inbox row (if it touches one of them), then their cursors. */
  private commit(e: Entry, covers: readonly NetworkAddress[]): void {
    const t = this.transfer(e);
    const touches = covers.includes(e.from) || covers.includes(e.to);
    if (touches && !this.ledger.inbox.has(t.dedupeKey)) this.ledger.inbox.set(t.dedupeKey, { transfer: t, acked: false });
    for (const a of covers) this.ledger.cursors.set(a, e.seq);
  }

  async poll(addresses: ReadonlySet<NetworkAddress>): Promise<NetworkRead<readonly ConfirmedTransfer[]>> {
    const failed = this.failure();
    if (failed !== null) return failed;
    const l = this.ledger;
    const set = [...addresses];
    // What this poll read; every commit compares the stored cursors with it (compare-and-set).
    const expected = new Map(set.map((a) => [a, l.cursors.get(a) ?? 0n]));
    const coversOf = (e: Entry): readonly NetworkAddress[] => set.filter((a) => (expected.get(a) as bigint) < e.seq);
    const pending = l.journal.filter((e) => coversOf(e).length > 0);
    const odd = pending.find((e) => e.unknown);
    if (odd !== undefined) return this.halt({ kind: 'UNKNOWN_EVENT', txHash: odd.txHash, logIndex: 0n, detail: 'unexplained FAKENET entry' });
    if (l.crash) {
      l.crash = false;
      throw new Error('crash between fetch and commit');
    }
    let budget = l.lagAfter;
    l.lagAfter = null;
    for (const e of pending) {
      if (budget === 0n) return { kind: 'FAILED', failure: { kind: 'SOURCE_LAGGING', source: 'fakenet', detail: 'injected lag after a partial commit' } };
      const covers = coversOf(e);
      if (l.race) {
        l.race = false;
        this.commit(e, covers);
      }
      for (const a of covers) {
        const want = expected.get(a) as bigint;
        const actual = l.cursors.get(a) ?? 0n;
        if (actual !== want) return this.halt({ kind: 'CURSOR_CONFLICT', expected: want, actual });
      }
      this.commit(e, covers);
      for (const a of covers) expected.set(a, e.seq);
      if (budget !== null) budget -= 1n;
    }
    return { kind: 'OK', value: this.unacked() };
  }

  async pending(): Promise<readonly ConfirmedTransfer[]> {
    return this.unacked();
  }

  async ack(dedupeKeys: readonly string[]): Promise<AckResult> {
    const inbox = this.ledger.inbox;
    const unknown = dedupeKeys.find((k) => !inbox.has(k));
    if (unknown !== undefined) return { kind: 'UNKNOWN_KEY', key: unknown };
    for (const k of dedupeKeys) (inbox.get(k) as InboxEntry).acked = true;
    return { kind: 'ACKED' };
  }

  async resume(approverA: string, approverB: string): Promise<void> {
    const approvers = checkApprovers(approverA, approverB);
    const l = this.ledger;
    if (l.halted === null) throw new RangeError('the network is not halted');
    l.halted = null;
    l.resumes = [...l.resumes, approvers];
  }

  async confirmTx(txHash: Hex32): Promise<NetworkRead<TxConfirmation | null>> {
    const failed = this.failure();
    if (failed !== null) return failed;
    const e = this.ledger.journal.find((x) => x.txHash === txHash.toLowerCase() && !x.unknown);
    if (e === undefined) return { kind: 'OK', value: null };
    const t = this.transfer(e);
    return { kind: 'OK', value: { txHash: t.txHash, blockNumber: t.blockNumber, blockHash: t.blockHash, receiptStatus: 1n, gas: t.gas, transfers: [t], sources: 1n } };
  }

  async head(): Promise<NetworkRead<NetworkHead>> {
    const failed = this.failure();
    if (failed !== null) return failed;
    const top = this.ledger.nextSeq - 1n;
    return { kind: 'OK', value: { number: top, hash: hashOf(`fakenet:head:${top}`) } };
  }
}
