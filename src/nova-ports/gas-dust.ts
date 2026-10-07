/**
 * GasDustStore (docs/NOVA_ARC_DESIGN.md §7.3, §9.2 P4D/P5/P9D): the package's
 * 18-dp sub-ledger, kept per DFNS wallet, only if Nova's ledger cannot hold an
 * 18-dp account (K-11, [A-11]). Stored in Nova's PostgreSQL [A-30].
 *
 * Accounts (§9.1): GL-4 `arc.gasDust.<w>` (P4D in, P5 out), GL-2
 * `arc.<w>.subminor` and GL-4 `arc.receiptDust` (P9D). Every entry balances on
 * its own; nothing is ever dropped (CLAUDE.md "dust never silently dropped").
 *
 * The decision procedures (checkSplit, decideSweep) are shared by both fakes:
 * - every split must be exactly U1's `nativeWeiToCbsMinor(total, p)` (the one
 *   conversion module, FLOOR_REMAINDER_RETURNED): a different split is a
 *   programming error and throws;
 * - a sweep (P5) clears exactly j·k wei for j ≥ 1 minor units (`sweptWei` =
 *   `cbsMinorToNativeWei(sweptMinor, p)`), only for the wallet's next sweep
 *   number, and never more than the wallet's gas dust (INSUFFICIENT_DUST);
 * - every write is keyed: same key and entry replays the first result, a
 *   different entry is KEY_CONFLICT (§7.1).
 */
import { cbsMinorToNativeWei, nativeWeiToCbsMinor, subtractNativeWei } from '../amounts/index.js';
import type { CbsMinor, CbsPrecision, NativeWei } from '../amounts/index.js';
import { rejected } from './ids.js';
import type { Hex32, IdempotencyKey, KeyConflict, PortResult, WalletRef } from './ids.js';

/** P4D: the sub-minor gas remainder of one receipt. `wallet` paid the gas (the sending wallet). */
export interface GasDustEntry {
  readonly chainId: bigint;
  readonly txHash: Hex32;
  readonly wallet: WalletRef;
  readonly gasWei: NativeWei;
  readonly recognisedMinor: CbsMinor;
  readonly dustWei: NativeWei;
}

/** P9D: the sub-minor remainder of one unidentified inbound log to `wallet`. */
export interface ReceiptDustEntry {
  readonly chainId: bigint;
  readonly txHash: Hex32;
  readonly logIndex: bigint;
  readonly wallet: WalletRef;
  readonly valueWei: NativeWei;
  readonly recognisedMinor: CbsMinor;
  readonly dustWei: NativeWei;
}

export interface DustBalance {
  readonly gasDustWei: NativeWei;
  readonly subminorWei: NativeWei;
  readonly nextSeq: bigint;
}

export interface GasDustStore {
  /** P4D: DR GL-3 `arc.unrecognised`, CR GL-4 `arc.gasDust.<wallet>`, both `dustWei`. Same key as the receipt's P4 journal. */
  record(key: IdempotencyKey, e: GasDustEntry): Promise<PortResult<{ readonly balanceWei: NativeWei }, KeyConflict>>;
  /** P9D: DR GL-2 `arc.<wallet>.subminor`, CR GL-4 `arc.receiptDust`, both `dustWei`. Same key as the P9 journal. */
  recordReceiptDust(key: IdempotencyKey, e: ReceiptDustEntry): Promise<PortResult<{ readonly subminorWei: NativeWei; readonly receiptDustWei: NativeWei }, KeyConflict>>;
  /** P5 (sub-ledger side): clears `sweptWei` = j·k of `wallet`'s gas dust for sweep `seq`, after Nova's P5 journal with the same key is OK. */
  sweep(key: IdempotencyKey, wallet: WalletRef, seq: bigint, sweptMinor: CbsMinor, sweptWei: NativeWei): Promise<PortResult<{ readonly balanceWei: NativeWei }, KeyConflict | 'INSUFFICIENT_DUST'>>;
  balance(wallet: WalletRef): Promise<PortResult<DustBalance, never>>;
  /** Rail-wide total of GL-4 `arc.receiptDust`, for the unidentified-receipts invariant (§9.2). */
  receiptDustTotal(): Promise<PortResult<{ readonly receiptDustWei: NativeWei }, never>>;
}

/** Throws unless (recognisedMinor, dustWei) is exactly U1's split of `totalWei` at precision `p` (a programming error otherwise). */
export function checkSplit(totalWei: NativeWei, recognisedMinor: CbsMinor, dustWei: NativeWei, p: CbsPrecision): void {
  const split = nativeWeiToCbsMinor(totalWei, p);
  if (split.minor !== recognisedMinor || split.dustWei !== dustWei) {
    throw new TypeError(`split of ${totalWei} wei at p=${p} must be ${split.minor} minor + ${split.dustWei} wei`);
  }
}

/** Canonical encoding of a keyed write (bigints as decimal strings, fixed field order), for same-key comparison. */
export function canonicalDust(op: 'P4D' | 'P9D' | 'P5', fields: readonly (string | bigint)[]): string {
  return JSON.stringify([op, ...fields.map((f) => `${f}`)]);
}

/**
 * P5 sweep decision for a wallet whose gas dust is `balanceWei` and whose next
 * sweep number is `nextSeq`. Returns the new gas-dust balance, or a refusal.
 */
export function decideSweep(
  balanceWei: NativeWei,
  nextSeq: bigint,
  seq: bigint,
  sweptMinor: CbsMinor,
  sweptWei: NativeWei,
  p: CbsPrecision,
): PortResult<never, KeyConflict | 'INSUFFICIENT_DUST'> | { readonly balanceWei: NativeWei } {
  if (sweptMinor <= 0n || cbsMinorToNativeWei(sweptMinor, p) !== sweptWei) throw new TypeError('a sweep clears j·k wei for j ≥ 1 minor units');
  if (seq !== nextSeq) return rejected('KEY_CONFLICT', `sweep ${seq} is not the next sweep (${nextSeq})`);
  if (sweptWei > balanceWei) return rejected('INSUFFICIENT_DUST', `gas dust ${balanceWei} wei < ${sweptWei} wei`);
  return { balanceWei: subtractNativeWei(balanceWei, sweptWei) };
}
