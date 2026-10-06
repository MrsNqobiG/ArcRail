/**
 * U11 Gas treasury: gas and dust accumulators and fee calculation. Money path
 * (RUBRIC item 8). SKELETON: types and stubs only.
 *
 * Fee = gasUsed × effectiveGasPrice from the receipt (C-25). Fee floor C-30,
 * maximum base fee C-31. Accumulators F[r] and D[r] per CONTRACT §5.7; batches
 * post with `K.gas` / `K.dust`. Never show 18 dp to users (KICKOFF U11).
 */
import type { NativeWei } from '../amounts/index.js';
import type { WalletRole } from '../registry/index.js';

export interface ReceiptFee {
  readonly gasUsed: bigint;
  readonly effectiveGasPrice: NativeWei;
}

export interface Accumulators {
  /** F[r]: gas fees not yet posted, in wei. */
  readonly gasWei: NativeWei;
  /** D[r]: dust not yet posted, in wei. */
  readonly dustWei: NativeWei;
}

export interface GasTreasury {
  accumulators(role: WalletRole): Promise<Accumulators>;
  recordFee(role: WalletRole, fee: ReceiptFee): Promise<void>;
}

export function receiptFeeWei(_fee: ReceiptFee): NativeWei {
  throw new Error('not implemented: U11');
}

export function createGasTreasury(): GasTreasury {
  throw new Error('not implemented: U11');
}
