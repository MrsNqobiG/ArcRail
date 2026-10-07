/**
 * PORTS unit: GasDustStore contract suite (docs/NOVA_ARC_DESIGN.md §7.3, §9.2
 * P4D/P5/P9D, §7.8). Sub-minor gas and receipt dust is kept to the wei, per
 * wallet, and never dropped; the expense invariant is recomputed. Runs
 * unchanged against both fakes; Nova's adapter must pass it too [A-34].
 */
import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision, nativeWei, nativeWeiToCbsMinor } from '../../src/amounts/index.js';
import type { CbsPrecision } from '../../src/amounts/index.js';
import { CounterDustStore, LedgerRowDustStore } from '../../src/nova-ports/fakes/gas-dust-fakes.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { checkSplit } from '../../src/nova-ports/gas-dust.js';
import type { GasDustEntry, GasDustStore, ReceiptDustEntry } from '../../src/nova-ports/gas-dust.js';
import { idempotencyKey, walletRef } from '../../src/nova-ports/ids.js';
import type { Hex32, PortResult } from '../../src/nova-ports/ids.js';

type Factory = (p: CbsPrecision, faults?: FaultPlan) => GasDustStore;
const FACTORIES: readonly (readonly [string, Factory])[] = [
  ['CounterDustStore', (p, f) => new CounterDustStore(p, f)],
  ['LedgerRowDustStore', (p, f) => new LedgerRowDustStore(p, f)],
];

const P6 = cbsPrecision(6);
const K6 = 1_000_000_000_000n; // k = 10^(18 − 6)
const HOT = walletRef('w-hot');
const GAS = walletRef('w-gas');
const tx = (b: string): Hex32 => `0x${b.repeat(32)}`;

/** A P4D entry split exactly by U1. */
function gasEntry(gasWei: bigint, wallet = HOT, t = tx('7a'), p: CbsPrecision = P6): GasDustEntry {
  const s = nativeWeiToCbsMinor(nativeWei(gasWei), p);
  return { chainId: 5042002n, txHash: t, wallet, gasWei: nativeWei(gasWei), recognisedMinor: s.minor, dustWei: s.dustWei };
}
function receiptEntry(valueWei: bigint, wallet = HOT, logIndex = 0n): ReceiptDustEntry {
  const s = nativeWeiToCbsMinor(nativeWei(valueWei), P6);
  return { chainId: 5042002n, txHash: tx('9c'), logIndex, wallet, valueWei: nativeWei(valueWei), recognisedMinor: s.minor, dustWei: s.dustWei };
}
const gasKey = (b: string) => idempotencyKey(`gas:5042002:${tx(b)}`);

function okValue<T>(r: PortResult<T, string>, replayed = false): T {
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${r.kind} ${r.kind === 'REJECTED' ? `${r.code} ${r.detail}` : r.cause}`);
  expect(r.replayed).toBe(replayed);
  return r.value;
}

describe.each(FACTORIES)('GasDustStore contract: %s', (_name, make) => {
  it('P4D keeps the sub-minor gas remainder per paying wallet, to the wei', async () => {
    const d = make(P6);
    const e = gasEntry(1_234_567_890_123_456n);
    expect(e).toMatchObject({ recognisedMinor: 1234n, dustWei: 567_890_123_456n });
    expect(okValue(await d.record(gasKey('7a'), e))).toEqual({ balanceWei: 567_890_123_456n });
    expect(okValue(await d.record(gasKey('7b'), gasEntry(600_000_000_000n, HOT, tx('7b'))))).toEqual({ balanceWei: 1_167_890_123_456n });
    expect(okValue(await d.record(gasKey('7c'), gasEntry(5n, GAS, tx('7c'))))).toEqual({ balanceWei: 5n });
    expect(okValue(await d.balance(HOT))).toEqual({ gasDustWei: 1_167_890_123_456n, subminorWei: 0n, nextSeq: 1n });
    expect(okValue(await d.balance(GAS))).toEqual({ gasDustWei: 5n, subminorWei: 0n, nextSeq: 1n });
    expect(okValue(await d.balance(walletRef('w-none')))).toEqual({ gasDustWei: 0n, subminorWei: 0n, nextSeq: 1n });
  });

  it('exactly once: same key and entry replays the first result; another entry is KEY_CONFLICT; keys are one namespace', async () => {
    const d = make(P6);
    const first = okValue(await d.record(gasKey('7a'), gasEntry(1_500_000_000_000n)));
    okValue(await d.record(gasKey('7b'), gasEntry(1_500_000_000_000n, HOT, tx('7b'))));
    expect(await d.record(gasKey('7a'), gasEntry(1_500_000_000_000n))).toEqual({ kind: 'OK', value: first, replayed: true });
    expect(await d.record(gasKey('7a'), gasEntry(1_600_000_000_000n))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    expect(await d.sweep(gasKey('7a'), HOT, 1n, cbsMinor(1n), nativeWei(K6))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    expect(await d.recordReceiptDust(gasKey('7a'), receiptEntry(5n))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    expect(okValue(await d.balance(HOT)).gasDustWei).toBe(1_000_000_000_000n);
  });

  it('a split that is not exactly U1\'s is a programming error (throws), never silently accepted', async () => {
    const d = make(P6);
    const e = gasEntry(1_234_567_890_123_456n);
    await expect(d.record(gasKey('7a'), { ...e, dustWei: nativeWei(e.dustWei - 1n) })).rejects.toThrow(/split of/);
    await expect(d.record(gasKey('7a'), { ...e, recognisedMinor: cbsMinor(1235n) })).rejects.toThrow(/split of/);
    await expect(d.recordReceiptDust(idempotencyKey('unid:x'), { ...receiptEntry(7n), dustWei: nativeWei(0n) })).rejects.toThrow(/split of/);
    expect(okValue(await d.balance(HOT)).gasDustWei).toBe(0n);
  });

  it('P5 clears exactly j·k wei for the next sweep number, never more than the dust', async () => {
    const d = make(P6);
    okValue(await d.record(gasKey('7a'), gasEntry(1_700_000_000_000n)));
    okValue(await d.record(gasKey('7b'), gasEntry(1_700_000_000_000n, HOT, tx('7b'))));
    expect(okValue(await d.balance(HOT)).gasDustWei).toBe(1_400_000_000_000n);
    const sk = (n: bigint) => idempotencyKey(`dust:5042002:wt${'0'.repeat(32)}:${n}`);
    expect(await d.sweep(sk(1n), HOT, 1n, cbsMinor(2n), nativeWei(2n * K6))).toMatchObject({ kind: 'REJECTED', code: 'INSUFFICIENT_DUST' });
    expect(await d.sweep(sk(2n), HOT, 2n, cbsMinor(1n), nativeWei(K6))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: /not the next sweep/ });
    await expect(d.sweep(sk(1n), HOT, 1n, cbsMinor(1n), nativeWei(K6 - 1n))).rejects.toThrow(/j·k wei/);
    await expect(d.sweep(sk(1n), HOT, 1n, cbsMinor(0n), nativeWei(0n))).rejects.toThrow(/j·k wei/);
    const swept = okValue(await d.sweep(sk(1n), HOT, 1n, cbsMinor(1n), nativeWei(K6)));
    expect(swept).toEqual({ balanceWei: 400_000_000_000n });
    expect(await d.sweep(sk(1n), HOT, 1n, cbsMinor(1n), nativeWei(K6))).toEqual({ kind: 'OK', value: swept, replayed: true });
    expect(okValue(await d.balance(HOT))).toEqual({ gasDustWei: 400_000_000_000n, subminorWei: 0n, nextSeq: 2n });
    expect(okValue(await d.balance(GAS)).nextSeq).toBe(1n);
    expect(await d.sweep(idempotencyKey('dust:gas:1'), GAS, 1n, cbsMinor(1n), nativeWei(K6))).toMatchObject({ kind: 'REJECTED', code: 'INSUFFICIENT_DUST', detail: /gas dust 0 wei/ });
    okValue(await d.record(gasKey('7c'), gasEntry(900_000_000_000n, HOT, tx('7c'))));
    expect(await d.sweep(sk(3n), HOT, 1n, cbsMinor(1n), nativeWei(K6))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: /sweep 1 is not the next sweep \(2\)/ });
    expect(okValue(await d.sweep(sk(2n), HOT, 2n, cbsMinor(1n), nativeWei(K6)))).toEqual({ balanceWei: 300_000_000_000n });
    expect(okValue(await d.balance(HOT)).nextSeq).toBe(3n);
    // m4 (M21): a sweep of exactly the whole dust balance is allowed and leaves zero.
    okValue(await d.record(gasKey('7d'), gasEntry(700_000_000_000n, HOT, tx('7d'))));
    expect(okValue(await d.balance(HOT)).gasDustWei).toBe(K6);
    expect(okValue(await d.sweep(sk(3n), HOT, 3n, cbsMinor(1n), nativeWei(K6)))).toEqual({ balanceWei: 0n });
    expect(okValue(await d.balance(HOT))).toEqual({ gasDustWei: 0n, subminorWei: 0n, nextSeq: 4n });
  });

  it('P9D keeps unidentified-receipt dust per wallet and rail-wide', async () => {
    const d = make(P6);
    const u = (n: bigint) => idempotencyKey(`unid:5042002:${tx('9c')}:${n}`);
    expect(okValue(await d.recordReceiptDust(u(0n), receiptEntry(2_000_000_000_123n)))).toEqual({ subminorWei: 123n, receiptDustWei: 123n });
    expect(okValue(await d.recordReceiptDust(u(1n), receiptEntry(77n, GAS, 1n)))).toEqual({ subminorWei: 77n, receiptDustWei: 200n });
    expect(await d.recordReceiptDust(u(0n), receiptEntry(2_000_000_000_123n))).toMatchObject({ kind: 'OK', replayed: true });
    expect(await d.recordReceiptDust(u(0n), receiptEntry(2_000_000_000_124n))).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    expect(okValue(await d.receiptDustTotal())).toEqual({ receiptDustWei: 200n });
    expect(okValue(await d.balance(HOT))).toEqual({ gasDustWei: 0n, subminorWei: 123n, nextSeq: 1n });
  });

  it('expense invariant (§9.2): Σ receipt gas G = (Σ g + Σ j)·k + Σ gas dust, to the wei', async () => {
    const d = make(P6);
    const gases = [1_999_999_999_999n, 21_000n * 20_000_000_000n, 3n, 987_654_321_987_654_321n, 1_000_000_000_001n];
    let recognised = 0n;
    for (const [i, g] of gases.entries()) {
      const e = gasEntry(g, i % 2 === 0 ? HOT : GAS, tx(`a${i}`));
      recognised += e.recognisedMinor;
      okValue(await d.record(idempotencyKey(`gas:5042002:${tx(`a${i}`)}`), e));
    }
    let swept = 0n;
    for (const w of [HOT, GAS]) {
      const b = okValue(await d.balance(w));
      const j = b.gasDustWei / K6;
      if (j > 0n) {
        okValue(await d.sweep(idempotencyKey(`dust:5042002:${w}:1`), w, 1n, cbsMinor(j), nativeWei(j * K6)));
        swept += j;
      }
    }
    const dust = okValue(await d.balance(HOT)).gasDustWei + okValue(await d.balance(GAS)).gasDustWei;
    expect((recognised + swept) * K6 + dust).toBe(gases.reduce((s, g) => s + g, 0n));
    expect(swept).toBeGreaterThan(0n);
  });

  it('at p = 18 (k = 1) there is never any dust', async () => {
    const d = make(cbsPrecision(18));
    const e = gasEntry(12_345n, HOT, tx('7a'), cbsPrecision(18));
    expect(e.dustWei).toBe(0n);
    expect(okValue(await d.record(gasKey('7a'), e))).toEqual({ balanceWei: 0n });
  });

  it('AMBIGUOUS before and after commit on every write', async () => {
    const f = new FaultPlan();
    const d = make(P6, f);
    okValue(await d.record(gasKey('8a'), gasEntry(1_950_000_000_000n, HOT, tx('8a'))));
    const writes: readonly [string, () => Promise<PortResult<unknown, string>>][] = [
      ['record', () => d.record(gasKey('7a'), gasEntry(1_100_000_000_000n))],
      ['recordReceiptDust', () => d.recordReceiptDust(idempotencyKey('unid:x'), receiptEntry(9n))],
      ['sweep', () => d.sweep(idempotencyKey('dust:x:1'), HOT, 1n, cbsMinor(1n), nativeWei(K6))],
    ];
    for (const [op, call] of writes) {
      f.arm(op, 'BEFORE_COMMIT', 'TIMEOUT');
      expect(await call(), op).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
      f.arm(op, 'AFTER_COMMIT', 'TRANSPORT');
      expect(await call(), op).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
      expect(await call(), op).toMatchObject({ kind: 'OK', replayed: true });
    }
    expect(okValue(await d.balance(HOT))).toEqual({ gasDustWei: 50_000_000_000n, subminorWei: 9n, nextSeq: 2n });
  });

  it('AMBIGUOUS before reading on every read (m8: balance, receiptDustTotal)', async () => {
    const f = new FaultPlan();
    const d = make(P6, f);
    okValue(await d.recordReceiptDust(idempotencyKey('unid:y'), receiptEntry(7n)));
    const reads: readonly [string, () => Promise<PortResult<unknown, string>>][] = [
      ['balance', () => d.balance(HOT)],
      ['receiptDustTotal', () => d.receiptDustTotal()],
    ];
    for (const [op, call] of reads) {
      f.arm(op, 'BEFORE_COMMIT', 'UNAVAILABLE');
      expect(await call(), op).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
      expect((await call()).kind, op).toBe('OK');
    }
    expect(okValue(await d.receiptDustTotal())).toEqual({ receiptDustWei: 7n });
  });
});

describe('checkSplit', () => {
  it('accepts exactly U1\'s split and nothing else', () => {
    expect(() => checkSplit(nativeWei(K6 + 5n), cbsMinor(1n), nativeWei(5n), P6)).not.toThrow();
    expect(() => checkSplit(nativeWei(K6 + 5n), cbsMinor(0n), nativeWei(K6 + 5n), P6)).toThrow(/must be 1 minor \+ 5 wei/);
  });
});
