/**
 * U6 Inbound flow → CBS. Money path (RUBRIC item 3). SKELETON: types and stubs only.
 *
 * State machine: CONTRACT §5.3. Templates T1, T2, T8, T11, unid (CONTRACT §5.1).
 * Keys: CONTRACT §1.3 (`K.recv`, `K.avail`, `K.unid`, `K.assign`).
 */
import type { CbsMinor } from '../amounts/index.js';
import type { CanonicalTransfer } from '../ingestion/index.js';

/** Non-terminal inbound states named in CONTRACT §5.3 and §1.6. */
export type InboundActiveState =
  | 'DETECTED'
  | 'RECEIVED'
  | 'SCREENING'
  | 'AWAITING_SCREENING'
  | 'HELD_IN_CLEARING'
  | 'SUSPENSE'
  | 'SUSPENSE_ASSIGNING'
  | 'PAUSED'
  | 'QUARANTINED';

/** Terminal inbound states (CONTRACT §1.7). */
export type InboundTerminalState = 'AVAILABLE' | 'BANK_FUNDED' | 'ASSIGNED' | 'DUST_ONLY';

export type InboundState = InboundActiveState | InboundTerminalState;

export interface InboundItem {
  readonly transfer: CanonicalTransfer;
  readonly state: InboundState;
  /** `h`, the item's current heldAmount (CONTRACT §5.1). */
  readonly heldAmount: CbsMinor;
  readonly currentCaseId: string | null;
}

export interface InboundFlow {
  /** Detection commit (CONTRACT §5.3): one local transaction. */
  detect(transfer: CanonicalTransfer): Promise<InboundItem>;
  /** Drive one item one step on a final result or an event. */
  step(item: InboundItem): Promise<InboundItem>;
}

export function createInboundFlow(): InboundFlow {
  throw new Error('not implemented: U6');
}
