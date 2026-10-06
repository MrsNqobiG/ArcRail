/**
 * CBS port: every adapter → CBS operation in CONTRACT §3. Interface only.
 * Every call carries a `callId` (UUID per transport attempt, not part of the key).
 */
import type { UnitTag } from '../amounts/index.js';
import type { AccountRef, WalletRole } from '../registry/index.js';
import type { CbsResult, RejectedCode } from './result.js';
import type { DecimalString, Id, IdempotencyKey, SubjectRef, TxHashString } from './keys.js';

/** Wire amount (CONTRACT §1.1): never a JSON number. */
export interface WireAmount {
  readonly unit: UnitTag;
  /** `^(0|[1-9][0-9]*)$` */
  readonly value: DecimalString;
}

/** CONTRACT §1.1 unit tag of CBS minor units: `CBS_MINOR:<assetCode>:<p>`. */
export type CbsMinorTag = Extract<UnitTag, `CBS_MINOR:${string}`>;

/**
 * A wire amount in CBS minor units only (CONTRACT §4 `amount:CBS_MINOR`). On
 * the wire it is still `{unit, value}` (§1.1); decoding it into the branded
 * `CbsMinor` bigint is U1's job.
 */
export interface CbsMinorWireAmount extends WireAmount {
  readonly unit: CbsMinorTag;
}

/** GL roles (CONTRACT §2). Account numbers come from Finance config (Q-C7). */
export type GlRole =
  | { readonly role: 'G1'; readonly accountRef: AccountRef }
  | { readonly role: 'G2'; readonly wallet: WalletRole }
  | { readonly role: 'G3' }
  | { readonly role: 'G4'; readonly sub: 'dust' | 'unidentified' }
  | { readonly role: 'G5'; readonly sub: 'inbound' | 'outbound' }
  | { readonly role: 'G6' }
  | { readonly role: 'G7' };

export interface JournalLeg {
  /** CONTRACT §3 `glOrAccountRef`: a GL role, or a customer account (G1) by `accountRef`. */
  readonly glOrAccountRef: GlRole;
  readonly side: 'DR' | 'CR';
  readonly amount: WireAmount;
}

export interface AssignRef {
  readonly caseId: Id;
  readonly dispositionSeq: DecimalString;
}

/**
 * `postJournal` refs (CONTRACT §3), field for field and in contract order.
 * T9/T10 carry `caseId` **and** `dispositionSeq` of their `RETURN`
 * disposition, which the CBS binds (contract R13 D1). `listJournals` returns
 * the same refs as posted.
 */
export interface JournalRefs {
  readonly subjectRef: SubjectRef;
  readonly caseId?: Id;
  readonly dispositionSeq?: DecimalString;
  readonly instructionId?: Id;
  readonly address?: string;
  readonly txHash?: TxHashString;
  readonly assignRef?: AssignRef;
}

export interface CallMeta {
  readonly callId: string;
}

export type CaseReason =
  | 'SCREENING_HIT'
  | 'SCREENING_REVIEW'
  | 'UNIDENTIFIED_INBOUND'
  | 'MINT_UNATTRIBUTED'
  | 'TRAVEL_RULE_INCOMPLETE'
  | 'TR_HASH_CHANGED'
  | 'RECON_DRIFT'
  | 'BLOCKLIST_REVERT'
  | 'BLOCKLIST_PRECHECK'
  | 'STANDING_INELIGIBLE'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_EXPIRED'
  | 'APPROVAL_MISMATCH'
  | 'CANCEL_FINAL'
  | 'POSTING_REJECTED'
  | 'SIGNER_REFUSED'
  | 'CANCEL_BLOCKED'
  | 'LATE_DISPOSITION'
  | 'PENDING_AGE'
  | 'QUARANTINE'
  | 'PAUSE';

export type ScreenVerdict = 'CLEAR' | 'HIT' | 'REVIEW';

export interface CbsPort {
  getAccountStanding(
    req: { readonly accountRef: AccountRef; readonly asset: string },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly active: boolean; readonly kycValid: boolean; readonly frozen: boolean; readonly asOf: string }>>;

  postJournal(
    req: {
      readonly key: IdempotencyKey;
      readonly valueDate: string;
      readonly legs: readonly JournalLeg[];
      readonly narrative: string;
      readonly refs: JournalRefs;
    },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly journalId: string; readonly postedAt: string }>>;

  getResultByKey(
    req: { readonly key: IdempotencyKey },
    meta: CallMeta,
  ): Promise<
    CbsResult<{
      readonly state: 'APPLIED' | 'NOT_FOUND' | 'REJECTED';
      readonly op: string;
      readonly result?: unknown;
      readonly code?: RejectedCode;
    }>
  >;

  placeHold(
    req: { readonly key: IdempotencyKey; readonly instructionId: Id },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly holdId: string; readonly accountRef: AccountRef; readonly amount: WireAmount }>>;

  releaseHold(req: { readonly key: IdempotencyKey; readonly holdId: string }, meta: CallMeta): Promise<CbsResult<Record<string, never>>>;

  settleHold(
    req: {
      readonly key: IdempotencyKey;
      readonly holdId: string;
      readonly instructionId: Id;
      readonly txHash: TxHashString;
      readonly legs: readonly JournalLeg[];
    },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly journalId: string }>>;

  screen(
    req: {
      readonly key: IdempotencyKey;
      readonly subject: { readonly kind: 'ADDRESS' | 'CCTP_MINT'; readonly value: string };
      readonly role: 'sender' | 'destination';
      readonly direction: 'inbound' | 'outbound';
      readonly amount: WireAmount;
      readonly context: SubjectRef;
    },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly verdict: ScreenVerdict; readonly screeningRef: string }>>;

  createCase(
    req: {
      readonly key: IdempotencyKey;
      readonly reason: CaseReason;
      readonly subjectRef: SubjectRef;
      readonly refs: JournalRefs;
      readonly evidenceRefs: readonly string[];
    },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly caseId: Id }>>;

  submitMonitoringEvent(
    req: {
      readonly key: IdempotencyKey;
      readonly direction: 'inbound' | 'outbound' | 'internal';
      readonly class: string;
      readonly accountRef?: AccountRef;
      readonly amount: WireAmount;
      readonly chainId: '5042002';
      readonly txHash: TxHashString;
      readonly counterpartyAddress: string;
      readonly at: string;
    },
    meta: CallMeta,
  ): Promise<CbsResult<Record<string, never>>>;

  getTravelRuleOriginator(
    req: { readonly subjectRef: SubjectRef },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly payloadRef: string; readonly payloadHashTR: string }>>;

  requestApproval(
    req: { readonly key: IdempotencyKey; readonly instructionId: Id; readonly payloadHash: string; readonly summary: string },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly approvalId: string }>>;

  getApproval(
    req: { readonly approvalId: string },
    meta: CallMeta,
  ): Promise<
    CbsResult<{
      readonly state: 'PENDING' | 'APPROVED' | 'REJECTED';
      readonly payloadHash: string;
      readonly makerId: string;
      readonly checkerId: string;
      readonly decidedAt: string;
      readonly checkerAssertion: string;
    }>
  >;

  getBalancesAsOf(
    req: { readonly accounts: readonly GlRole[]; readonly cutoff: string },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly balances: readonly { readonly account: GlRole; readonly amount: WireAmount }[]; readonly cutoffApplied: string }>>;

  listJournals(
    req: { readonly fromCutoff: string; readonly toCutoff: string; readonly keys?: readonly IdempotencyKey[] },
    meta: CallMeta,
  ): Promise<
    CbsResult<{
      readonly journals: readonly {
        readonly journalId: string;
        readonly key: IdempotencyKey;
        readonly legs: readonly JournalLeg[];
        readonly refs: JournalRefs;
        readonly postedAt: string;
      }[];
      readonly next?: string;
    }>
  >;

  fileReportData(
    req: { readonly key: IdempotencyKey; readonly reportType: string; readonly subjectRef: SubjectRef; readonly dataRefs: readonly string[] },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly reportRef: string }>>;

  replayEvents(
    req: { readonly fromSeq?: DecimalString; readonly fromTime?: string; readonly types?: readonly string[] },
    meta: CallMeta,
  ): Promise<CbsResult<{ readonly events: readonly unknown[]; readonly next?: string }>>;
}
