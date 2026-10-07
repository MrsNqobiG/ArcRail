/**
 * Test support: two structurally different in-memory GasDustStore fakes (§7.8).
 *
 * - CounterDustStore: one running NativeWei balance per wallet and account,
 *   plus a Map of keyed results.
 * - LedgerRowDustStore: one row per receipt, unidentified log and sweep; every
 *   balance is a fold over the rows, and keys are found by scan.
 *
 * Both check every split with the shared checkSplit (U1's one conversion
 * module), judge sweeps with decideSweep, use only U1's checked add and
 * subtract, can inject AMBIGUOUS, and pass the same contract tests
 * (test/contract/ports-gas-dust.contract.test.ts).
 */
import { addNativeWei, nativeWei, subtractNativeWei } from '../../amounts/index.js';
import type { CbsMinor, CbsPrecision, NativeWei } from '../../amounts/index.js';
import { ok, rejected } from '../ids.js';
import type { IdempotencyKey, KeyConflict, PortResult, WalletRef } from '../ids.js';
import { canonicalDust, checkSplit, decideSweep } from '../gas-dust.js';
import type { DustBalance, GasDustEntry, GasDustStore, ReceiptDustEntry } from '../gas-dust.js';
import { afterCommit, faultBefore } from './faults.js';
import type { FaultPlan } from './faults.js';

const ZERO: NativeWei = nativeWei(0n);

type GasResult = { readonly balanceWei: NativeWei };
type ReceiptResult = { readonly subminorWei: NativeWei; readonly receiptDustWei: NativeWei };

/** One keyed write. P4D and P5 return a gas-dust balance; P9D returns the receipt-dust balances. */
type Keyed =
  | { readonly op: 'P4D' | 'P5'; readonly canonical: string; readonly result: GasResult }
  | { readonly op: 'P9D'; readonly canonical: string; readonly result: ReceiptResult };

function gasCanonical(e: GasDustEntry): string {
  return canonicalDust('P4D', [e.chainId, e.txHash, e.wallet, e.gasWei, e.recognisedMinor, e.dustWei]);
}

function receiptCanonical(e: ReceiptDustEntry): string {
  return canonicalDust('P9D', [e.chainId, e.txHash, e.logIndex, e.wallet, e.valueWei, e.recognisedMinor, e.dustWei]);
}

function sweepCanonical(wallet: WalletRef, seq: bigint, minor: CbsMinor, wei: NativeWei): string {
  return canonicalDust('P5', [wallet, seq, minor, wei]);
}

function conflict(key: IdempotencyKey): PortResult<never, KeyConflict> {
  return rejected('KEY_CONFLICT', `key ${key} reused with a different entry`);
}

/** Same key and entry: the first result, replayed. Same key, other entry (any op): KEY_CONFLICT. Null: a new key. */
function replayGas(prior: Keyed | null, canonical: string, key: IdempotencyKey): PortResult<GasResult, KeyConflict> | null {
  if (prior === null) return null;
  return prior.op !== 'P9D' && prior.canonical === canonical ? ok(prior.result, true) : conflict(key);
}

function replayReceipt(prior: Keyed | null, canonical: string, key: IdempotencyKey): PortResult<ReceiptResult, KeyConflict> | null {
  if (prior === null) return null;
  return prior.op === 'P9D' && prior.canonical === canonical ? ok(prior.result, true) : conflict(key);
}

/** Fake A: running counters. */
export class CounterDustStore implements GasDustStore {
  readonly #p: CbsPrecision;
  readonly #faults: FaultPlan | undefined;
  readonly #gas = new Map<string, NativeWei>();
  readonly #sub = new Map<string, NativeWei>();
  readonly #seq = new Map<string, bigint>();
  readonly #keys = new Map<string, Keyed>();
  #receiptDust: NativeWei = ZERO;

  constructor(p: CbsPrecision, faults?: FaultPlan) {
    this.#p = p;
    this.#faults = faults;
  }

  async record(key: IdempotencyKey, e: GasDustEntry): Promise<PortResult<GasResult, KeyConflict>> {
    const before = faultBefore(this.#faults, 'record');
    if (before !== null) return before;
    checkSplit(e.gasWei, e.recognisedMinor, e.dustWei, this.#p);
    const replay = replayGas(this.#keys.get(key) ?? null, gasCanonical(e), key);
    if (replay !== null) return replay;
    const result = { balanceWei: addNativeWei(this.#gas.get(e.wallet) ?? ZERO, e.dustWei) };
    this.#gas.set(e.wallet, result.balanceWei);
    this.#keys.set(key, { op: 'P4D', canonical: gasCanonical(e), result });
    return afterCommit(this.#faults, 'record', ok(result, false));
  }

  async recordReceiptDust(key: IdempotencyKey, e: ReceiptDustEntry): Promise<PortResult<ReceiptResult, KeyConflict>> {
    const before = faultBefore(this.#faults, 'recordReceiptDust');
    if (before !== null) return before;
    checkSplit(e.valueWei, e.recognisedMinor, e.dustWei, this.#p);
    const replay = replayReceipt(this.#keys.get(key) ?? null, receiptCanonical(e), key);
    if (replay !== null) return replay;
    const result = { subminorWei: addNativeWei(this.#sub.get(e.wallet) ?? ZERO, e.dustWei), receiptDustWei: addNativeWei(this.#receiptDust, e.dustWei) };
    this.#sub.set(e.wallet, result.subminorWei);
    this.#receiptDust = result.receiptDustWei;
    this.#keys.set(key, { op: 'P9D', canonical: receiptCanonical(e), result });
    return afterCommit(this.#faults, 'recordReceiptDust', ok(result, false));
  }

  async sweep(key: IdempotencyKey, wallet: WalletRef, seq: bigint, sweptMinor: CbsMinor, sweptWei: NativeWei): Promise<PortResult<GasResult, KeyConflict | 'INSUFFICIENT_DUST'>> {
    const before = faultBefore(this.#faults, 'sweep');
    if (before !== null) return before;
    const canonical = sweepCanonical(wallet, seq, sweptMinor, sweptWei);
    const replay = replayGas(this.#keys.get(key) ?? null, canonical, key);
    if (replay !== null) return replay;
    const v = decideSweep(this.#gas.get(wallet) ?? ZERO, this.#seq.get(wallet) ?? 1n, seq, sweptMinor, sweptWei, this.#p);
    if ('kind' in v) return v;
    this.#gas.set(wallet, v.balanceWei);
    this.#seq.set(wallet, seq + 1n);
    this.#keys.set(key, { op: 'P5', canonical, result: v });
    return afterCommit(this.#faults, 'sweep', ok(v, false));
  }

  async balance(wallet: WalletRef): Promise<PortResult<DustBalance, never>> {
    const before = faultBefore(this.#faults, 'balance');
    if (before !== null) return before;
    return ok({ gasDustWei: this.#gas.get(wallet) ?? ZERO, subminorWei: this.#sub.get(wallet) ?? ZERO, nextSeq: this.#seq.get(wallet) ?? 1n }, false);
  }

  async receiptDustTotal(): Promise<PortResult<{ readonly receiptDustWei: NativeWei }, never>> {
    const before = faultBefore(this.#faults, 'receiptDustTotal');
    if (before !== null) return before;
    return ok({ receiptDustWei: this.#receiptDust }, false);
  }
}

/** One row per keyed entry; `wei` is the amount it adds (P4D, P9D) or clears (P5). */
type Row = Keyed & { readonly key: IdempotencyKey; readonly wallet: WalletRef; readonly wei: NativeWei; readonly seq: bigint };

/** Fake B: one row per entry; balances are folds. */
export class LedgerRowDustStore implements GasDustStore {
  readonly #p: CbsPrecision;
  readonly #faults: FaultPlan | undefined;
  #rows: readonly Row[] = [];

  constructor(p: CbsPrecision, faults?: FaultPlan) {
    this.#p = p;
    this.#faults = faults;
  }

  #prior(key: IdempotencyKey): Keyed | null {
    return this.#rows.find((r) => r.key === key) ?? null;
  }

  /** Gas dust of `wallet`: Σ P4D − Σ P5 (a P5 never exceeds the balance, so this never goes negative). */
  #fold(wallet: WalletRef): DustBalance {
    let added = ZERO;
    let swept = ZERO;
    let sub = ZERO;
    let next = 1n;
    for (const r of this.#rows) {
      if (r.wallet !== wallet) continue;
      if (r.op === 'P4D') added = addNativeWei(added, r.wei);
      else if (r.op === 'P9D') sub = addNativeWei(sub, r.wei);
      else {
        swept = addNativeWei(swept, r.wei);
        next = r.seq + 1n;
      }
    }
    return { gasDustWei: subtractNativeWei(added, swept), subminorWei: sub, nextSeq: next };
  }

  #receiptTotal(): NativeWei {
    let t = ZERO;
    for (const r of this.#rows) if (r.op === 'P9D') t = addNativeWei(t, r.wei);
    return t;
  }

  async record(key: IdempotencyKey, e: GasDustEntry): Promise<PortResult<GasResult, KeyConflict>> {
    const before = faultBefore(this.#faults, 'record');
    if (before !== null) return before;
    checkSplit(e.gasWei, e.recognisedMinor, e.dustWei, this.#p);
    const replay = replayGas(this.#prior(key), gasCanonical(e), key);
    if (replay !== null) return replay;
    const result = { balanceWei: addNativeWei(this.#fold(e.wallet).gasDustWei, e.dustWei) };
    this.#rows = [...this.#rows, { op: 'P4D', key, canonical: gasCanonical(e), wallet: e.wallet, wei: e.dustWei, seq: 0n, result }];
    return afterCommit(this.#faults, 'record', ok(result, false));
  }

  async recordReceiptDust(key: IdempotencyKey, e: ReceiptDustEntry): Promise<PortResult<ReceiptResult, KeyConflict>> {
    const before = faultBefore(this.#faults, 'recordReceiptDust');
    if (before !== null) return before;
    checkSplit(e.valueWei, e.recognisedMinor, e.dustWei, this.#p);
    const replay = replayReceipt(this.#prior(key), receiptCanonical(e), key);
    if (replay !== null) return replay;
    const result = { subminorWei: addNativeWei(this.#fold(e.wallet).subminorWei, e.dustWei), receiptDustWei: addNativeWei(this.#receiptTotal(), e.dustWei) };
    this.#rows = [...this.#rows, { op: 'P9D', key, canonical: receiptCanonical(e), wallet: e.wallet, wei: e.dustWei, seq: 0n, result }];
    return afterCommit(this.#faults, 'recordReceiptDust', ok(result, false));
  }

  async sweep(key: IdempotencyKey, wallet: WalletRef, seq: bigint, sweptMinor: CbsMinor, sweptWei: NativeWei): Promise<PortResult<GasResult, KeyConflict | 'INSUFFICIENT_DUST'>> {
    const before = faultBefore(this.#faults, 'sweep');
    if (before !== null) return before;
    const canonical = sweepCanonical(wallet, seq, sweptMinor, sweptWei);
    const replay = replayGas(this.#prior(key), canonical, key);
    if (replay !== null) return replay;
    const b = this.#fold(wallet);
    const v = decideSweep(b.gasDustWei, b.nextSeq, seq, sweptMinor, sweptWei, this.#p);
    if ('kind' in v) return v;
    this.#rows = [...this.#rows, { op: 'P5', key, canonical, wallet, wei: sweptWei, seq, result: v }];
    return afterCommit(this.#faults, 'sweep', ok(v, false));
  }

  async balance(wallet: WalletRef): Promise<PortResult<DustBalance, never>> {
    return faultBefore(this.#faults, 'balance') ?? ok(this.#fold(wallet), false);
  }

  async receiptDustTotal(): Promise<PortResult<{ readonly receiptDustWei: NativeWei }, never>> {
    return faultBefore(this.#faults, 'receiptDustTotal') ?? ok({ receiptDustWei: this.#receiptTotal() }, false);
  }
}
