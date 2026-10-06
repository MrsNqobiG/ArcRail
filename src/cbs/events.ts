/**
 * CBS port: CBS → adapter operations and events, and adapter → CBS events
 * (CONTRACT §4). Types only.
 */
import type { AccountRef } from '../registry/index.js';
import type { CbsMinorWireAmount, WireAmount } from './port.js';
import type { DecimalString, Id, TxHashString } from './keys.js';

/** `submitPayoutInstruction` REJECTED codes (CONTRACT §4). */
export type PayoutInstructionRejectedCode =
  | 'INVALID'
  | 'UNIT_MISMATCH'
  | 'ZERO_AMOUNT'
  | 'INVALID_DESTINATION'
  | 'ADAPTER_PAUSED';

export interface SubmitPayoutInstruction {
  readonly instructionId: Id;
  readonly accountRef: AccountRef;
  readonly asset: 'USDC';
  /** CONTRACT §4 `amount:CBS_MINOR`: any other unit tag does not type-check. */
  readonly amount: CbsMinorWireAmount;
  readonly destination: string;
  readonly purposeCode?: string;
}

export type SubmitPayoutInstructionResult =
  | { readonly kind: 'OK'; readonly instructionId: Id; readonly state: 'ACCEPTED' }
  | { readonly kind: 'CONFLICT'; readonly instructionId: Id }
  | { readonly kind: 'REJECTED'; readonly code: PayoutInstructionRejectedCode };

/** The adapter's inbound port: what the CBS may call. */
export interface AdapterPort {
  submitPayoutInstruction(req: SubmitPayoutInstruction): Promise<SubmitPayoutInstructionResult>;
}

/** adapter → CBS event (CONTRACT §4). */
export interface PayoutOutcome {
  readonly type: 'PayoutOutcome';
  readonly eventId: Id;
  readonly instructionId: Id;
  readonly state:
    | 'SETTLED'
    | 'RELEASED'
    | 'HELD_FOR_CASE'
    | 'QUARANTINED'
    | 'PAUSED'
    | 'RETURNED'
    | 'RETURNED_PARTIAL'
    | 'RETURN_FAILED';
  readonly txHash?: TxHashString;
  readonly amount?: WireAmount;
  readonly caseId?: Id;
  readonly at: string;
}

export interface AccountStatusChanged {
  readonly type: 'AccountStatusChanged';
  readonly eventId: Id;
  readonly seq: DecimalString;
  readonly accountRef: AccountRef;
  readonly active: boolean;
  readonly kycValid: boolean;
  readonly frozen: boolean;
  readonly at: string;
}

export interface HoldChanged {
  readonly type: 'HoldChanged';
  readonly eventId: Id;
  readonly seq: DecimalString;
  readonly holdId: string;
  readonly key: string | null;
  readonly state: string;
  readonly at: string;
}

export interface ScreeningOutcome {
  readonly type: 'ScreeningOutcome';
  readonly eventId: Id;
  readonly screeningRef: string;
  readonly verdict: 'CLEAR' | 'HIT';
  readonly at: string;
}

export interface ApprovalDecided {
  readonly type: 'ApprovalDecided';
  readonly eventId: Id;
  readonly approvalId: string;
  readonly state: string;
  readonly at: string;
}

export type Disposition = 'RELEASE' | 'HOLD' | 'RETURN' | 'ASSIGN' | 'CANCEL';

export interface CaseDisposition {
  readonly type: 'CaseDisposition';
  readonly eventId: Id;
  readonly caseId: Id;
  readonly dispositionSeq: DecimalString;
  readonly disposition: Disposition;
  readonly accountRef?: AccountRef;
  /** CONTRACT §4: `returnAmount` is CBS_MINOR, greater than 0 (checked at intake, §4). */
  readonly returnAmount?: CbsMinorWireAmount;
  readonly returnDestination?: string;
  readonly decidedBy: string;
  readonly at: string;
}

/** Every CBS → adapter event (CONTRACT §4). Unknown type, seq gap or bad schema → QUARANTINE. */
export type CbsEvent =
  | AccountStatusChanged
  | HoldChanged
  | ScreeningOutcome
  | ApprovalDecided
  | CaseDisposition;
