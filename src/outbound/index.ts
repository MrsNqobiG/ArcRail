/**
 * U10 Outbound and case-return orchestrator, including the single nonce
 * writer. Money path (RUBRIC item 7). SKELETON: types and stubs only.
 *
 * State machines: CONTRACT §5.4 (payout), §5.5 (case return), §5.6 (internal move).
 * On-chain value = A × k wei, exactly (CONTRACT §5.4).
 */
import type { CbsMinor } from '../amounts/index.js';
import type { Address } from '../chain/config/index.js';
import type { AccountRef, WalletRole } from '../registry/index.js';

/** Payout states named in CONTRACT §5.4 and §1.6. */
export type PayoutState =
  | 'ACCEPTED'
  | 'RESERVED'
  | 'SCREENING'
  | 'AWAITING_SCREENING'
  | 'TRAVEL_RULE'
  | 'SIMULATING'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'SIGNED'
  | 'BROADCAST'
  | 'CANCELLING'
  | 'HELD_FOR_CASE'
  | 'PAUSED'
  | 'QUARANTINED'
  | 'RELEASED'
  | 'SETTLED';

/** Case-return states named in CONTRACT §5.5. */
export type CaseReturnState =
  | 'RETURNING'
  | 'RET_SCREENING'
  | 'RET_TRAVEL_RULE'
  | 'RET_SIMULATING'
  | 'RET_AWAITING_APPROVAL'
  | 'RET_SIGNED'
  | 'RET_BROADCAST'
  | 'RET_CANCELLING'
  | 'PAUSED'
  | 'QUARANTINED'
  | 'RETURNED';

/** Internal-move states named in CONTRACT §5.6 and §1.7. */
export type MoveState =
  | 'PROPOSED'
  | 'SIGNED'
  | 'BROADCAST'
  | 'CANCELLING'
  | 'PAUSED'
  | 'QUARANTINED'
  | 'ABANDONED'
  | 'POSTED'
  | 'FAILED';

export interface PayoutInstruction {
  readonly instructionId: string;
  readonly accountRef: AccountRef;
  readonly amount: CbsMinor;
  readonly destination: Address;
  readonly purposeCode?: string;
}

/** Exactly one nonce writer per hot wallet (CLAUDE.md "Exactly-once", ADR-003). */
export interface NonceWriter {
  readonly wallet: WalletRole;
  next(): Promise<bigint>;
}

export interface OutboundOrchestrator {
  accept(instruction: PayoutInstruction): Promise<PayoutState>;
  step(instructionId: string): Promise<PayoutState>;
}

export function createNonceWriter(_wallet: WalletRole): NonceWriter {
  throw new Error('not implemented: U10');
}

export function createOutboundOrchestrator(): OutboundOrchestrator {
  throw new Error('not implemented: U10');
}
