/**
 * PaymentStorePort (docs/NOVA_ARC_DESIGN.md §7.3): the package's working state
 * (payments, legs, submit markers, inbox, outbox, indexer cursor, rail state),
 * stored in Nova's PostgreSQL through Nova's migrations [A-30]. It is not a
 * ledger: money moves only through LedgerPort.
 *
 * The decision procedures (decideCreate, decideSignal, decideMarkSubmit,
 * decideCompensation, decideDecision, decideUnpause, observeHold,
 * decideHoldNonceTx, decideLift, checkRange, decideClosePayout, decidePutCase,
 * decideCaseDecision, decideClaim) are shared by both fakes and are what Nova's
 * adapter must reproduce [A-34]:
 * - exactly once: a create replays on the same request key and digest. One
 *   inbox holds every inbound signal: applySignal, commitRange, recordDecision
 *   and liftHold all record their dedupe keys in it. A key seen with a different payload digest is
 *   SIGNAL_CONFLICT (QUARANTINE); a key already applied to one payment is
 *   SIGNAL_CONFLICT for any other payment (§6.5 rule 5) and DUPLICATE for the
 *   same one; a key committed by commitRange and not yet applied is applied once;
 * - stage changes go only through src/status decideTransition (§13.3). A leg
 *   progresses only after every leg ahead of it has COMPLETED (§4.1). A leg may
 *   fail only while every leg ahead of it is COMPLETED or has not started
 *   (CREATED with no DFNS request), and nothing changes once a leg has failed,
 *   so a FAILED payment never has money in flight;
 * - the Arc leg's DFNS request (§8.4 check 3): `markSubmit` commits the submit
 *   marker before the DFNS POST. Without a marker the leg cannot move forward
 *   (no DFNS request exists). With a marker and no DFNS entity known
 *   (UNRESOLVED) no terminal stage is reachable (LEG_UNRESOLVED) and only a DFNS
 *   signal carrying the entity's id moves it;
 * - the Arc leg's DFNS transfer id is set only by a DFNS signal, and its
 *   `txHash` only by a DFNS signal or a two-person link (OPERATOR_DECISION,
 *   §6.5 rule 1), never by a log. It reaches SUBMITTED or CONFIRMING only with
 *   that hash (§8.6). Our ARC_LOG moves it only when it carries that hash, so
 *   COMPLETED is only on our log in that transaction: a log carrying another
 *   hash is SIGNAL_CONFLICT (§2 principle 6, §6.5, §10.4);
 * - REVERSED only from SETTLED, and only with the P7 receipt that compensates
 *   this payment's P2 or P2I settlement;
 * - P6 (release, key `pay:<id>:p6`) is accepted in applySignal's outbox only
 *   with the change that leaves the payment FAILED, only when the RESERVE leg
 *   ahead of the failing leg is COMPLETED (P1 is posted, so there is something
 *   to release), never for a PAYOUT failure (F-17: the USDC is at the partner),
 *   never beside a live DFNS request, and LEG_UNRESOLVED while the Arc leg is
 *   UNRESOLVED (§7.3, §9.2 P6, §9.3). P11 and P2R are never enqueued there;
 * - F-17: a FIAT_BANK payment whose PAYOUT leg failed is released only by
 *   closeFailedPayout, with P6 and P11 under a recorded two-person
 *   CLOSE_PARTNER_UNRETURNED decision added to the payment's open
 *   PARTNER_RETURN case, or with P2R and P6 on the Arc log that case claimed
 *   (claimInbound). The ledger enforces the order too (P6 after P2R or P11);
 * - a no-change signal (DUPLICATE, STALE) enqueues nothing: its outbox must
 *   already be enqueued item for item, or it is refused (never a silent OK);
 * - OPERATOR_DECISION evidence is accepted only when its `op:<decisionId>` key
 *   names a two-person decision recorded through recordDecision, for this
 *   payment, of the kind the transition needs (§10.3, §13.3): LINK_HASH for a
 *   hash link (which may also replace a DFNS-reported hash, F-18),
 *   ABORT_ACCEPTED for CANCELLED_BY_OPERATOR, NONCE_TX_LOCATED for
 *   DFNS_FAILED / BLOCKLISTED_PRE_MEMPOOL, DFNS_CANCEL_ISSUED for
 *   CANCELLED_ONCHAIN_REPLACED. A LINK_HASH decision names the hash it links
 *   (`txHash`), and only that hash is linked. Approver ids are canonical staff
 *   ids (ASCII letters, digits and . _ @ - only), and two ids equal after NFKC
 *   and upper-casing are the same person;
 * - unpause consumes a recorded UNPAUSE decision whose subject is the incident
 *   id of the pause it lifts (`RailState.incident`);
 * - a submit marker's externalId belongs to one payment only (MARKER_CONFLICT);
 * - wallet nonce holds (§8.4 check 5) are written only with the DFNS signal
 *   that starts them (`placeHold`, same commit). A hold with a known n lifts
 *   only once the account nonce is seen above n AND the nonce-n transaction is
 *   located (F-3b step 4a), on ARC_LOG, INTERNAL or OPERATOR_DECISION
 *   evidence; the rest of proof (c) or the two-person link stays the caller's
 *   (§8.4 check 5 "When it lifts"). An unknown n lifts only on a
 *   NONCE_UNKNOWN_CLOSE decision for the hold;
 * - inbox: a change (or a hold) claims the signal's key for the payment; a
 *   no-change STALE/DUPLICATE records only its digest, so the key can still be
 *   applied once by the payment it belongs to.
 *
 * Deviations from the §7.3 signatures, each a strengthening or a field the
 * rules above need (a design delta must record them; the design is frozen):
 * - create takes NewPayment (the store derives stage, status and version) and
 *   adds INVALID_JOURNEY; markSubmit adds NOT_READY;
 * - commitRange adds SIGNAL_CONFLICT; liftHold adds SIGNAL_CONFLICT and
 *   HOLD_NOT_RESOLVED; unpause adds NOT_PAUSED, DECISION_MISSING,
 *   DECISION_CONSUMED and WRONG_INCIDENT; RailState adds `incident`;
 * - InboundSignal adds the LEDGER and INTERNAL sources (src/status);
 * - OperatorDecision adds `txHash` (LINK_HASH only); CaseRecord adds
 *   `matchedLog` (the claimed log, like ApprovedFundingRecord's);
 * - added: recordCompensation, pendingOutbox, closeFailedPayout, getCase;
 * - not yet built (fail closed): ApprovedMoveRecord, ApprovedFundingRecord,
 *   putMove, getMove, putFunding, applySignal/markSubmit/findByExternalId on a
 *   MoveId, and funding claims in claimInbound (an inbound log no case claims
 *   is the caller's P9, never a credit).
 */
import { decideTransition, isFailureStage, isLegalState, isNonTerminal, paymentState, skippedStages, toTransactionStatus } from '../status/index.js';
import type { DfnsRequest, FailureReason, LegKind, LegState, SignalSource, Stage, TransactionStatus } from '../status/index.js';
import { journeyLegs, legsMatchJourney } from '../status/journey.js';
import type { PayInMethod, PayoutMethod } from '../status/journey.js';
import type { CbsMinor, NativeWei } from '../amounts/index.js';
import { idempotencyKey, lpDigestHex, normaliseHex32, ok, rejected } from './ids.js';
import type {
  AssetId,
  BeneficiaryRef,
  Hex32,
  IdempotencyKey,
  KeyConflict,
  NetworkAddress,
  NetworkId,
  NovaAccountRef,
  NovaOwnerRef,
  PaymentId,
  PortResult,
  WalletRef,
} from './ids.js';
import type { JournalReceipt } from './ledger.js';

/** Frozen at creation, hashed, re-checked before submit and at confirmation (§7.3). */
export interface TransferBinding {
  readonly network: NetworkId;
  readonly asset: AssetId;
  readonly fromWallet: WalletRef;
  readonly fromAddress: NetworkAddress;
  readonly dfnsWalletId: string;
  readonly to: NetworkAddress;
  readonly amount: NativeWei;
  readonly digest: Hex32;
}

/**
 * §7.3 "A DFNS request may exist." Committed by `markSubmit` before the first
 * DFNS transfer POST and never cleared.
 */
export interface SubmitMarker {
  /** deriveExternalId (§10.2): `nv1-` + 40 lower-case hex; the only externalId this leg ever uses. */
  readonly externalId: string;
  /** sha256 of the exact serialised POST body; every re-POST sends these same bytes. */
  readonly bodyDigest: Hex32;
  readonly markedAt: string;
  /** A head both sources agree on at marking; lower bound of the F-3b nonce search. */
  readonly markedAtBlock: bigint;
}

/** One step a leg passed, with the signal that evidenced it (skipped stages share the signal, §13.3). */
export interface LegHistoryEntry {
  readonly stage: Stage;
  readonly reason: FailureReason | null;
  readonly via: string;
}

export type LegRecord = LegState & {
  readonly kind: LegKind;
  /** Always 1n: one DFNS request per payment; a retry is a new payment (§7.3, §8.4 check 3). */
  readonly attempt: 1n;
  /** ARC_TRANSFER only; null until markSubmit (§7.3). */
  readonly submit: SubmitMarker | null;
  /** DFNS transfer id, conversion id or payout id. */
  readonly externalRef: string | null;
  readonly txHash: Hex32 | null;
  readonly history: readonly LegHistoryEntry[];
};

/** What the orchestrator supplies at creation. Stage, status and version are derived by the store. */
export interface NewPayment {
  readonly paymentId: PaymentId;
  readonly requestKey: IdempotencyKey;
  readonly requestDigest: Hex32;
  readonly payer: NovaOwnerRef;
  readonly payerAccount: NovaAccountRef;
  /** The payer's choice: pay in fiat or in stablecoin. */
  readonly payIn: PayInMethod;
  /** The receiver's choice (fiat bank account or stablecoin wallet), resolved by ReceiverPort at creation, never from the request (§4.1). */
  readonly payout: PayoutMethod;
  readonly beneficiaryRef: BeneficiaryRef;
  readonly payoutPreferenceVersion: string;
  /** What the receiver gets, in the payout asset's ledger precision. */
  readonly amount: CbsMinor;
  readonly fee: CbsMinor;
  readonly quoteId: string | null;
  readonly binding: TransferBinding;
  /** Must be exactly journeyLegs(payIn, payout). */
  readonly legs: readonly LegKind[];
}

export type PaymentRecord = Omit<NewPayment, 'legs'> &
  LegState & {
    readonly version: bigint;
    readonly legs: readonly LegRecord[];
    /** Derived from `stage` by the §13.2 table, stored for Nova's existing readers. */
    readonly status: TransactionStatus;
    /** P7 journalId when REVERSED, else null. */
    readonly compensatedBy: string | null;
  };

export interface InboundSignal {
  readonly source: SignalSource;
  /** §10.3 */
  readonly dedupeKey: string;
  /** sha256 over the per-source canonical projection (§10.3), never over a raw envelope. */
  readonly payloadDigest: Hex32;
}

/**
 * One inbox row: the signal's digest, and what it was applied to: a payment id,
 * or a hold id for hold-lifting evidence. Null: seen (committed by commitRange,
 * recorded as an operator decision, or offered as a no-change STALE/DUPLICATE)
 * but not yet applied to anything, so it can still be applied exactly once.
 */
export interface InboxEntry {
  readonly digest: Hex32;
  readonly subject: string | null;
}

/** §7.3 MoveId: 'mov-' + 32 lower-case hex (§10.2); an approved internal move (P10). Moves are D1-later; holds may already name one. */
export type MoveId = string & { readonly __moveId: true };

/** §7.3 NewNonceHold: written only through applySignal's `placeHold`, in the same commit as the DFNS signal that starts it. */
export interface NewNonceHold {
  readonly wallet: WalletRef;
  readonly dfnsTransferId: string;
  readonly subject: PaymentId | MoveId;
  /** n from DFNS `details`; null when unparseable (Q-N20). */
  readonly nonce: bigint | null;
  /** An ABORT_ACCEPTED decision exists for this transfer. */
  readonly aborted: boolean;
}

/** An account-nonce reading at a block both RPC sources agree on (§8.4 check 5). */
export interface HoldObservation {
  readonly block: bigint;
  readonly accountNonce: bigint;
}

/** §7.3 WalletNonceHold (§8.4 check 5): while ACTIVE, gateway check 5 refuses every submission from `wallet`. */
export interface WalletNonceHold extends NewNonceHold {
  /** deriveHoldId (§10.2). */
  readonly holdId: string;
  /** Latest agreed block with account nonce ≤ n. */
  readonly lastAtOrBelow: HoldObservation | null;
  /** First agreed block with account nonce > n. */
  readonly firstAbove: HoldObservation | null;
  /** The nonce-n transaction, once located (F-3b step 4a). */
  readonly nonceTx: Hex32 | null;
  readonly state: 'ACTIVE' | 'LIFTED';
  /** Dedupe key of the lifting evidence or decision. */
  readonly liftedBy: string | null;
}

export interface LegTransition {
  readonly leg: LegKind;
  readonly to: LegState;
  readonly externalRef?: string;
  readonly txHash?: Hex32;
  /** §8.4 check 5: a wallet nonce hold started by this DFNS signal, written in the same commit. */
  readonly placeHold?: NewNonceHold;
}

export interface OutboxItem {
  readonly key: IdempotencyKey;
  readonly topic: string;
  readonly payload: string;
}

/** STALE: valid but older than the current stage (out of order). */
export type SignalOutcome = 'APPLIED' | 'DUPLICATE' | 'STALE';

/** §7.3 DecisionKind. */
export type DecisionKind =
  | 'LINK_HASH'
  | 'ABORT_ACCEPTED'
  | 'DFNS_CANCEL_ISSUED'
  | 'NONCE_TX_LOCATED'
  | 'NONCE_UNKNOWN_CLOSE'
  | 'LIFT_QUARANTINE'
  | 'UNPAUSE'
  | 'APPROVE_MOVE'
  | 'APPROVE_FUNDING'
  | 'OPEN_PARTNER_CASE'
  | 'CLOSE_PARTNER_UNRETURNED'
  | 'RESOLVE_UNIDENTIFIED';

/** §7.3 two-person operator decision. The approvers are authenticated by Nova's staff authentication [A-35] before this port is called. */
export interface OperatorDecision {
  readonly decisionId: string;
  readonly kind: DecisionKind;
  readonly subject: string;
  readonly caseId: string | null;
  readonly seq: bigint;
  readonly evidenceDigest: Hex32;
  readonly approvers: readonly [string, string];
  readonly decidedAt: string;
  /** LINK_HASH only, and required there: the hash both approvers link (the `txHash` of its §10.3 evidence projection). */
  readonly txHash?: Hex32;
}

/** §7.3 CaseRecord kinds (Ops cases: F-3b, F-5, F-6, F-17, F-18, F-19). */
export type CaseKind = 'PARTNER_RETURN' | 'NONCE_BURN' | 'REPLACEMENT' | 'STUCK' | 'UNRESOLVED_SUBMIT' | 'UNIDENTIFIED';

/** An inbound log's (from, to, value), exactly as the indexer read it (§6.1). */
export interface InboundTriple {
  readonly from: NetworkAddress;
  readonly to: NetworkAddress;
  readonly value: NativeWei;
}

/** §7.3 CaseRecord, plus `matchedLog` (the `arc:` key of the log the case claimed, as ApprovedFundingRecord has). */
export interface CaseRecord {
  /** deriveCaseId(kind, subject) (§10.2). */
  readonly caseId: string;
  readonly kind: CaseKind;
  /** paymentId, moveId, or the arc:… key of a P9 log. */
  readonly subject: string;
  /** PARTNER_RETURN only: the exact return expected, value = cbsMinorToNativeWei(A, p). */
  readonly expected: InboundTriple | null;
  readonly state: 'OPEN' | 'MATCHED' | 'CLOSED';
  /** decisionIds, in order. */
  readonly decisions: readonly string[];
  readonly matchedLog: string | null;
}

export type CreateRejectCode = KeyConflict | 'INVALID_JOURNEY';
export type SignalRejectCode = 'NOT_FOUND' | 'VERSION_CONFLICT' | 'ILLEGAL_TRANSITION' | 'SIGNAL_CONFLICT' | 'LEG_UNRESOLVED';
/** NOT_READY: a leg ahead of the Arc leg has not completed (the reservation is not posted). */
export type MarkSubmitRejectCode = 'NOT_FOUND' | 'VERSION_CONFLICT' | 'LEG_TERMINAL' | 'MARKER_CONFLICT' | 'NOT_READY';
export type CompensationRejectCode = 'NOT_FOUND' | 'VERSION_CONFLICT' | 'NOT_SETTLED' | 'NOT_COMPENSATION' | 'ALREADY_REVERSED';
/** §7.3 DecisionRejectCode. */
export type DecisionRejectCode = 'SIGNAL_CONFLICT' | 'SAME_APPROVER' | 'APPROVER_UNAUTHENTICATED' | 'WRONG_KIND';
/**
 * §7.3 unpause codes, plus four fail-closed refusals: NOT_PAUSED (the rail is
 * running), DECISION_MISSING (no such decision was recorded through
 * recordDecision), DECISION_CONSUMED (that decision already lifted a pause;
 * each pause needs a fresh two-person decision) and WRONG_INCIDENT (the
 * decision's subject is not the incident id of the pause in force).
 */
export type UnpauseRejectCode = DecisionRejectCode | 'NOT_PAUSED' | 'DECISION_MISSING' | 'DECISION_CONSUMED' | 'WRONG_INCIDENT';
/**
 * HOLD_NOT_RESOLVED: the evidence does not show nonce n passed with the nonce-n
 * transaction located, from an accepted source (or, for an unknown nonce, no
 * NONCE_UNKNOWN_CLOSE decision for the hold).
 */
export type LiftRejectCode = 'NOT_FOUND' | 'SIGNAL_CONFLICT' | 'HOLD_NOT_RESOLVED';

export interface RailState {
  readonly paused: boolean;
  readonly reason: string | null;
  /** While paused: `pause-<n>`, the n-th pause of this store. An UNPAUSE decision names it as its subject. */
  readonly incident: string | null;
}

/** §7.3 putCase codes. */
export type CaseRejectCode = KeyConflict | 'DECISION_MISSING' | 'BINDING_MISMATCH';

export interface PaymentStorePort {
  create(p: NewPayment): Promise<PortResult<PaymentRecord, CreateRejectCode>>;
  get(id: PaymentId): Promise<PortResult<PaymentRecord, 'NOT_FOUND'>>;
  getByRequestKey(payer: NovaOwnerRef, key: IdempotencyKey): Promise<PortResult<PaymentRecord | null, never>>;
  /** Atomically: dedupe the signal in the inbox, apply the leg transition if legal and the version matches, enqueue outbox items. */
  applySignal(
    id: PaymentId,
    expectedVersion: bigint,
    signal: InboundSignal,
    transition: LegTransition,
    outbox: readonly OutboxItem[],
  ): Promise<PortResult<{ readonly outcome: SignalOutcome; readonly record: PaymentRecord }, SignalRejectCode>>;
  /** Commits the Arc leg's submit marker; the gateway POSTs only after this returns OK (§8.4 check 3). Idempotent for an equal marker. */
  markSubmit(id: PaymentId, expectedVersion: bigint, marker: SubmitMarker): Promise<PortResult<PaymentRecord, MarkSubmitRejectCode>>;
  /** The payment whose Arc leg's submit marker holds this externalId (a DFNS entity whose POST response we never received). */
  findByExternalId(externalId: string): Promise<PortResult<PaymentRecord | null, never>>;
  /** Payments whose Arc leg is UNRESOLVED (marker set, no DFNS entity known), in creation order (F-6). */
  listUnresolvedSubmits(limit: bigint): Promise<PortResult<readonly PaymentRecord[], never>>;
  /** REVERSED: records the P7 journal that compensates this payment's settlement `original` (P2 or P2I). Nothing happens on-chain. */
  recordCompensation(id: PaymentId, expectedVersion: bigint, p7: JournalReceipt, original: JournalReceipt): Promise<PortResult<PaymentRecord, CompensationRejectCode>>;
  /** Indexer cursor, committed with the dedupe keys of its range in the same inbox as applySignal. */
  commitRange(cursorKey: string, toBlock: bigint, signals: readonly InboundSignal[]): Promise<PortResult<void, 'CURSOR_REGRESSION' | 'SIGNAL_CONFLICT'>>;
  getCursor(cursorKey: string): Promise<PortResult<bigint | null, never>>;
  getRailState(): Promise<PortResult<RailState, never>>;
  pause(reason: string, actor: string): Promise<PortResult<void, never>>;
  /** Two-person unpause (CLAUDE.md "Fail closed"): an UNPAUSE decision with two distinct approvers. */
  unpause(decision: OperatorDecision): Promise<PortResult<void, UnpauseRejectCode>>;
  listOpen(leg: LegKind, stage: Stage, limit: bigint): Promise<PortResult<readonly PaymentRecord[], never>>;
  /** Outbox items not yet delivered, in enqueue order (one per key). */
  pendingOutbox(): Promise<PortResult<readonly OutboxItem[], never>>;
  /** Two-person operator decisions (§10.3 OPERATOR_DECISION), recorded through the inbox under `op:<decisionId>`. */
  recordDecision(signal: InboundSignal, d: OperatorDecision): Promise<PortResult<{ readonly outcome: SignalOutcome }, DecisionRejectCode>>;
  getDecision(decisionId: string): Promise<PortResult<OperatorDecision, 'NOT_FOUND'>>;
  /**
   * F-17 close of a FIAT_BANK payment whose PAYOUT leg is REJECTED/PAYOUT_FAILED
   * (the payment is already FAILED): atomically enqueues `outbox`, which holds
   * the payment's P6 with exactly one of P11 (evidence: the recorded two-person
   * CLOSE_PARTNER_UNRETURNED decision, added to the payment's OPEN
   * PARTNER_RETURN case) or P2R (evidence: the Arc log that case claimed). The
   * same close again is DUPLICATE; any other close after P6 is refused.
   */
  closeFailedPayout(
    id: PaymentId,
    expectedVersion: bigint,
    evidence: InboundSignal,
    outbox: readonly OutboxItem[],
  ): Promise<PortResult<{ readonly outcome: SignalOutcome; readonly record: PaymentRecord }, SignalRejectCode>>;
  /** Ops case records (F-3b, F-5, F-6, F-17, F-18, F-19). A PARTNER_RETURN case opens on a recorded OPEN_PARTNER_CASE decision. */
  putCase(rec: CaseRecord): Promise<PortResult<CaseRecord, CaseRejectCode>>;
  getCase(caseId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND'>>;
  addCaseDecision(caseId: string, decisionId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND' | 'DECISION_MISSING'>>;
  /**
   * §6.1 INBOUND claim: the one OPEN PARTNER_RETURN case whose expected
   * (from, to, value) equals the Arc log's exactly is marked MATCHED, in the
   * same commit as the log's inbox row. No match (or two): claimedBy null and
   * nothing is written. A log already claimed by a case replays.
   */
  claimInbound(log: InboundSignal, triple: InboundTriple): Promise<PortResult<{ readonly claimedBy: CaseRecord | null }, 'SIGNAL_CONFLICT'>>;
  /** §8.4 check 5: the wallet's ACTIVE nonce holds, read from the store on every submission. */
  listActiveHolds(wallet: WalletRef): Promise<PortResult<readonly WalletNonceHold[], never>>;
  recordHoldObservation(holdId: string, obs: HoldObservation): Promise<PortResult<WalletNonceHold, 'NOT_FOUND'>>;
  recordHoldNonceTx(holdId: string, txHash: Hex32): Promise<PortResult<WalletNonceHold, 'NOT_FOUND' | 'NONCE_TX_CONFLICT'>>;
  liftHold(holdId: string, evidence: InboundSignal): Promise<PortResult<WalletNonceHold, LiftRejectCode>>;
}

/** §10.2 decisionId: 'dec-' + hex(sha256(lp('nv1-decision') ‖ lp(kind) ‖ lp(subject) ‖ lp(caseId or '') ‖ lp(decimal(seq))))[0..32]. */
export function deriveDecisionId(kind: DecisionKind, subject: string, caseId: string | null, seq: bigint): string {
  return `dec-${lpDigestHex(['nv1-decision', kind, subject, caseId ?? '', seq.toString(10)]).slice(0, 32)}`;
}

/** §10.2 holdId: 'hold-' + hex(sha256(lp('nv1-hold') ‖ lp(walletRef) ‖ lp(dfnsTransferId)))[0..32]. */
export function deriveHoldId(wallet: WalletRef, dfnsTransferId: string): string {
  return `hold-${lpDigestHex(['nv1-hold', wallet, dfnsTransferId]).slice(0, 32)}`;
}

/** §10.3 inbox key of an operator decision. */
export function decisionKey(decisionId: string): string {
  return `op:${decisionId}`;
}

/** The decision id an OPERATOR_DECISION signal names (its `op:<decisionId>` key); null for any other key. */
export function decisionIdOf(dedupeKey: string): string | null {
  return dedupeKey.startsWith('op:') ? dedupeKey.slice(3) : null;
}

/** §10.2 P6 (release) key of a payment: once it exists, the payment is over. */
export function releaseKey(id: PaymentId): IdempotencyKey {
  return idempotencyKey(`pay:${id}:p6`);
}

/** §10.2 P11 (partner claim) key of a payment (F-17 second branch). */
export function partnerClaimKey(id: PaymentId): IdempotencyKey {
  return idempotencyKey(`pay:${id}:p11`);
}

/** §10.2 P2R (partner return) key of a payment (F-17 first branch). */
export function partnerReturnKey(id: PaymentId): IdempotencyKey {
  return idempotencyKey(`pay:${id}:p2r`);
}

/** §10.2 caseId: 'case-' + hex(sha256(lp('nv1-case') ‖ lp(kind) ‖ lp(subject)))[0..32]. */
export function deriveCaseId(kind: CaseKind, subject: string): string {
  return `case-${lpDigestHex(['nv1-case', kind, subject]).slice(0, 32)}`;
}

/** The pause incident id (`RailState.incident`) of a store's n-th pause. */
export function pauseIncident(n: bigint): string {
  return `pause-${n.toString(10)}`;
}

/** The Arc leg's DFNS request state (§8.4 check 3); NONE for any other leg. */
export function dfnsRequestOf(leg: LegRecord): DfnsRequest {
  if (leg.kind !== 'ARC_TRANSFER' || leg.submit === null) return 'NONE';
  return leg.externalRef === null ? 'UNRESOLVED' : 'KNOWN';
}

/** Every journey has exactly one Arc leg (journeyLegs). */
export function arcLeg(rec: PaymentRecord): LegRecord {
  return rec.legs.find((l) => l.kind === 'ARC_TRANSFER') as LegRecord;
}

/** Recomputes the derived payment fields from its legs (§4.2, §13.2). */
export function derive(rec: Omit<PaymentRecord, 'stage' | 'reason' | 'status'>): PaymentRecord {
  const state = paymentState(rec.legs);
  return { ...rec, ...state, status: toTransactionStatus(state, rec.compensatedBy) };
}

/** The initial record for a new payment: every leg CREATED, no marker, version 1. */
export function initialRecord(p: NewPayment): PaymentRecord {
  const legs: LegRecord[] = p.legs.map((kind) => ({ kind, stage: 'CREATED', reason: null, attempt: 1n, submit: null, externalRef: null, txHash: null, history: [] }));
  return derive({ ...p, legs, version: 1n, compensatedBy: null });
}

export type CreateVerdict =
  | { readonly kind: 'DONE'; readonly result: PortResult<PaymentRecord, CreateRejectCode> }
  | { readonly kind: 'INSERT'; readonly record: PaymentRecord };

/** §7.3 create: replay, key conflict, journey check, then insert. */
export function decideCreate(p: NewPayment, byRequestKey: PaymentRecord | null, byId: PaymentRecord | null): CreateVerdict {
  if (byRequestKey !== null) {
    return byRequestKey.requestDigest === p.requestDigest && byRequestKey.paymentId === p.paymentId
      ? { kind: 'DONE', result: ok(byRequestKey, true) }
      : { kind: 'DONE', result: rejected('KEY_CONFLICT', 'request key reused with a different request') };
  }
  if (byId !== null) return { kind: 'DONE', result: rejected('KEY_CONFLICT', `payment id ${p.paymentId} already used by another request`) };
  if (!legsMatchJourney(p.payIn, p.payout, p.legs)) {
    return { kind: 'DONE', result: rejected('INVALID_JOURNEY', `legs must be ${journeyLegs(p.payIn, p.payout).join(',')}`) };
  }
  return { kind: 'INSERT', record: initialRecord(p) };
}

export type SignalVerdict =
  | { readonly kind: 'REJECT'; readonly result: PortResult<never, SignalRejectCode> }
  /**
   * No stage change. `hold`: a nonce hold to write in the same commit, and the
   * signal then claims its dedupe key for this payment. Null: only the digest is
   * recorded (the key is not claimed, so the right payment can still apply it).
   */
  | { readonly kind: 'NOOP'; readonly outcome: 'DUPLICATE' | 'STALE'; readonly hold: NewNonceHold | null }
  | { readonly kind: 'APPLY'; readonly record: PaymentRecord; readonly hold: NewNonceHold | null };

function reject(code: SignalRejectCode, detail: string): SignalVerdict {
  return { kind: 'REJECT', result: rejected(code, detail) };
}

/** The legs ahead of `kind`, in journey order. */
function legsAhead(legs: readonly LegRecord[], kind: LegKind): readonly LegRecord[] {
  let ahead: readonly LegRecord[] = [];
  for (const l of legs) {
    if (l.kind === kind) break;
    ahead = [...ahead, l];
  }
  return ahead;
}

/** §4.1: a leg may progress only when every leg ahead of it is COMPLETED. */
function legsAheadCompleted(legs: readonly LegRecord[], kind: LegKind): boolean {
  return legsAhead(legs, kind).every((l) => l.stage === 'COMPLETED');
}

/** A leg may fail only when every leg ahead of it is COMPLETED or has not started (CREATED, no DFNS request): no money is in flight ahead of it. */
function legsAheadSettled(legs: readonly LegRecord[], kind: LegKind): boolean {
  return legsAhead(legs, kind).every((l) => l.stage === 'COMPLETED' || (l.stage === 'CREATED' && dfnsRequestOf(l) === 'NONE'));
}

function conflicting(current: string | null, incoming: string | undefined): boolean {
  return incoming !== undefined && current !== null && current !== incoming;
}

const DFNS_SOURCES: readonly SignalSource[] = Object.freeze(['DFNS_WEBHOOK', 'DFNS_POLL']);
/** §6.5 rule 1: the only links between an Arc leg and a transaction hash. */
const HASH_LINK_SOURCES: readonly SignalSource[] = Object.freeze(['DFNS_WEBHOOK', 'DFNS_POLL', 'OPERATOR_DECISION']);

/** The two-person decision kind a transition on OPERATOR_DECISION evidence needs (§13.3, §10.3); null: none may carry it. */
export function decisionKindFor(t: LegTransition): DecisionKind | null {
  switch (t.to.reason) {
    case null:
      return t.to.stage === 'CONFIRMING' && t.txHash !== undefined ? 'LINK_HASH' : null;
    case 'CANCELLED_BY_OPERATOR':
      return 'ABORT_ACCEPTED';
    case 'DFNS_FAILED':
    case 'BLOCKLISTED_PRE_MEMPOOL':
      return 'NONCE_TX_LOCATED';
    case 'CANCELLED_ONCHAIN_REPLACED':
      return 'DFNS_CANCEL_ISSUED';
    default:
      return null;
  }
}

/** §10.3 OPERATOR_DECISION: the signal must name a recorded two-person decision for this payment, of the kind the transition needs. */
function decisionRule(rec: PaymentRecord, t: LegTransition, key: string, d: OperatorDecision | null): string | null {
  if (d === null) return `no recorded two-person decision for ${key} (recordDecision first)`;
  if (d.subject !== rec.paymentId) return `decision ${d.decisionId} is for ${d.subject}, not ${rec.paymentId}`;
  const need = decisionKindFor(t);
  if (d.kind !== need) return `decision ${d.decisionId} is ${d.kind}; this transition needs ${String(need)}`;
  return need === 'LINK_HASH' && d.txHash !== t.txHash ? `decision ${d.decisionId} links ${String(d.txHash)}, not ${String(t.txHash)}` : null;
}

/** The item is already in the outbox, exactly (key, topic and payload). */
function isEnqueued(o: OutboxItem, enqueued: (key: IdempotencyKey) => OutboxItem | null): boolean {
  const e = enqueued(o.key);
  return e !== null && e.topic === o.topic && e.payload === o.payload;
}

/** A no-change signal enqueues nothing new: null when every item is already enqueued exactly. */
function unqueued(outbox: readonly OutboxItem[], enqueued: (key: IdempotencyKey) => OutboxItem | null): string | null {
  const fresh = outbox.find((o) => !isEnqueued(o, enqueued));
  return fresh === undefined ? null : `a signal that changes nothing enqueues nothing; ${fresh.key} is not already enqueued`;
}

/**
 * §9.2 P6, §9.3, F-17 for a P6 in applySignal's outbox: null when it may go
 * with this applied change. The change must leave the payment FAILED, must not
 * be a PAYOUT failure after the Arc leg COMPLETED (the USDC is at the partner:
 * closeFailedPayout), and the
 * RESERVE leg ahead of the failing leg must be COMPLETED (P1 posted).
 */
function releaseRule(rec: PaymentRecord, t: LegTransition, after: PaymentRecord): string | null {
  if (after.status !== 'FAILED') return `the payment is ${after.status} after this signal; a release goes only with the change that fails it`;
  // With the Arc leg COMPLETED the USDC is at the partner (P2P posted): F-17. Before that nothing left, and P6 releases P1 as for any leg.
  if (t.leg === 'PAYOUT' && rec.legs.some((l) => l.kind === 'ARC_TRANSFER' && l.stage === 'COMPLETED')) {
    return 'a failed payout leaves the USDC at the partner (F-17); release only through closeFailedPayout with P11 or P2R';
  }
  const reserved = legsAhead(rec.legs, t.leg).some((l) => l.kind === 'RESERVE' && l.stage === 'COMPLETED');
  return reserved ? null : `no P1 reservation to release: the RESERVE leg ahead of ${t.leg} is not COMPLETED (§9.3 P1 = P6)`;
}

/** §8.4 check 5: a hold names this payment, its sending wallet and its Arc leg's hash-less DFNS transfer, and comes from DFNS or a decision. */
function holdRule(rec: PaymentRecord, leg: LegRecord, t: LegTransition, h: NewNonceHold, source: SignalSource): string | null {
  if (t.leg !== 'ARC_TRANSFER') return "a nonce hold belongs to the Arc leg's DFNS transfer";
  if (!HASH_LINK_SOURCES.includes(source)) return 'only a DFNS signal or a two-person decision starts a nonce hold';
  if (h.subject !== rec.paymentId || h.wallet !== rec.binding.fromWallet) return 'a nonce hold names this payment and its sending wallet';
  if (h.dfnsTransferId !== (t.externalRef ?? leg.externalRef)) return "a nonce hold names this leg's DFNS transfer";
  if ((t.txHash ?? leg.txHash) !== null) return 'a nonce hold is for a DFNS transfer with no txHash';
  if (h.nonce !== null && h.nonce < 0n) return 'a nonce is non-negative';
  return null;
}

/**
 * §7.3 applySignal for one payment. `seen` is the inbox row for the signal's
 * dedupeKey (null when unseen); `decision` is the recorded decision the
 * signal's `op:` key names (null when none); `outbox` is what the caller wants
 * enqueued with it; `enqueued` reads the outbox. Dedupe comes first, so a
 * re-delivered signal is DUPLICATE whatever the version (its outbox must
 * already be enqueued).
 */
export function decideSignal(
  rec: PaymentRecord,
  expectedVersion: bigint,
  signal: InboundSignal,
  t: LegTransition,
  seen: InboxEntry | null,
  decision: OperatorDecision | null,
  outbox: readonly OutboxItem[],
  enqueued: (key: IdempotencyKey) => OutboxItem | null,
): SignalVerdict {
  if (seen !== null) {
    if (seen.digest !== signal.payloadDigest) return reject('SIGNAL_CONFLICT', `dedupe key ${signal.dedupeKey} seen with a different payload`);
    if (seen.subject === rec.paymentId) {
      const why = unqueued(outbox, enqueued);
      return why === null ? { kind: 'NOOP', outcome: 'DUPLICATE', hold: null } : reject('ILLEGAL_TRANSITION', why);
    }
    if (seen.subject !== null) return reject('SIGNAL_CONFLICT', `dedupe key ${signal.dedupeKey} already applied to another payment`);
  }
  if (rec.version !== expectedVersion) return reject('VERSION_CONFLICT', `at version ${rec.version}`);
  const leg = rec.legs.find((l) => l.kind === t.leg);
  if (leg === undefined || !isLegalState(t.to)) return reject('ILLEGAL_TRANSITION', `no legal ${t.leg} leg target`);
  const byDecision = signal.source === 'OPERATOR_DECISION';
  // F-18: a two-person LINK_HASH may replace the hash DFNS reported (a speed-up that delivered the money); nothing else may.
  const relink = byDecision && decision?.kind === 'LINK_HASH' && decision.subject === rec.paymentId && decision.txHash === t.txHash;
  if (conflicting(leg.externalRef, t.externalRef) || (!relink && conflicting(leg.txHash, t.txHash))) {
    return reject('SIGNAL_CONFLICT', `${t.leg} external reference or txHash changed`);
  }
  const unresolved = dfnsRequestOf(leg) === 'UNRESOLVED';
  if (unresolved && (t.externalRef === undefined || !DFNS_SOURCES.includes(signal.source))) {
    // Only a DFNS signal carrying the entity resolves the leg; then every other rule applies to it (§13.3).
    return reject('LEG_UNRESOLVED', `${t.leg}: a DFNS request may exist and no DFNS entity is known; only a DFNS signal carrying it applies (§8.4 check 3)`);
  }
  const verdict = decideTransition(leg.kind, leg, t.to, signal.source, unresolved ? 'KNOWN' : dfnsRequestOf(leg));
  if (verdict === 'ILLEGAL') return reject('ILLEGAL_TRANSITION', `${t.leg} ${leg.stage} -> ${t.to.stage}`);
  if (verdict === 'APPLIED') {
    if (rec.legs.some((l) => isFailureStage(l.stage))) return reject('ILLEGAL_TRANSITION', `payment is ${rec.stage}/${String(rec.reason)}; nothing changes after a failure`);
    if (t.to.reason === null ? !legsAheadCompleted(rec.legs, t.leg) : !legsAheadSettled(rec.legs, t.leg)) {
      return reject('ILLEGAL_TRANSITION', `${t.leg} cannot ${t.to.reason === null ? 'progress' : 'fail'} while a leg ahead of it is not completed`);
    }
    const why = t.leg === 'ARC_TRANSFER' ? arcLinkRule(leg, t, signal.source) : null;
    if (why !== null) return reject('ILLEGAL_TRANSITION', why);
  }
  if (byDecision && (verdict === 'APPLIED' || t.placeHold !== undefined)) {
    const why = decisionRule(rec, t, signal.dedupeKey, decision);
    if (why !== null) return reject('ILLEGAL_TRANSITION', why);
  }
  if (t.placeHold !== undefined) {
    const why = holdRule(rec, leg, t, t.placeHold, signal.source);
    if (why !== null) return reject('ILLEGAL_TRANSITION', `nonce hold refused: ${why}`);
  }
  const hold = t.placeHold ?? null;
  let after = rec;
  if (verdict === 'APPLIED') {
    const passed = skippedStages(leg.stage, t.to.stage);
    const history = [...leg.history, ...passed.map((stage) => ({ stage, reason: null, via: signal.dedupeKey })), { stage: t.to.stage, reason: t.to.reason, via: signal.dedupeKey }];
    const next: LegRecord = { ...leg, ...t.to, externalRef: t.externalRef ?? leg.externalRef, txHash: t.txHash ?? leg.txHash, history };
    after = derive({ ...rec, legs: rec.legs.map((l) => (l.kind === t.leg ? next : l)), version: rec.version + 1n });
  }
  // F-17: the partner-case postings go only through closeFailedPayout.
  const keys: readonly string[] = outbox.map((o) => o.key);
  if (keys.includes(partnerClaimKey(rec.paymentId)) || keys.includes(partnerReturnKey(rec.paymentId))) {
    return reject('ILLEGAL_TRANSITION', 'P11 and P2R are enqueued only by closeFailedPayout (F-17)');
  }
  // §13.3: an outbox refused for a leg that was UNRESOLVED when the signal arrived is LEG_UNRESOLVED.
  const code: SignalRejectCode = unresolved ? 'LEG_UNRESOLVED' : 'ILLEGAL_TRANSITION';
  if (verdict !== 'APPLIED') {
    const why = unqueued(outbox, enqueued);
    return why === null ? { kind: 'NOOP', outcome: verdict, hold } : reject(code, why);
  }
  // §7.3, §9.2 P6, §9.3: a release goes only with the change that fails the payment, and only when P1 was posted.
  if (keys.includes(releaseKey(rec.paymentId))) {
    const why = releaseRule(rec, t, after);
    if (why !== null) return reject(code, `P6 refused: ${why}`);
  }
  return { kind: 'APPLY', record: after, hold };
}

/**
 * §6.5 rule 1, §8.6, §10.4 for an applied Arc leg transition; null when it holds.
 * The DFNS transfer id comes only from DFNS; the hash only from DFNS or a
 * two-person link. SUBMITTED and CONFIRMING need the hash. Our ARC_LOG
 * (which can never set a hash) moves the leg only when it carries the linked
 * transaction's hash, so COMPLETED and ONCHAIN_REVERTED are always in that
 * transaction; a log with another hash was already refused as SIGNAL_CONFLICT.
 */
function arcLinkRule(leg: LegRecord, t: LegTransition, source: SignalSource): string | null {
  if (t.externalRef !== undefined && leg.externalRef === null && !DFNS_SOURCES.includes(source)) return 'only a DFNS signal identifies the DFNS transfer';
  if (t.txHash !== undefined && leg.txHash === null && !HASH_LINK_SOURCES.includes(source)) {
    return 'only DFNS or a two-person link sets the Arc leg txHash; a log never links itself (§6.5 rule 1)';
  }
  if ((t.to.stage === 'SUBMITTED' || t.to.stage === 'CONFIRMING') && (t.txHash ?? leg.txHash) === null) {
    return `the Arc leg cannot reach ${t.to.stage} without a DFNS-reported hash (§8.6)`;
  }
  if (source === 'ARC_LOG' && t.txHash === undefined) return 'our ARC_LOG moves the Arc leg only with the hash of its transaction (§6.5, §10.4)';
  return null;
}

export type MarkVerdict =
  | { readonly kind: 'DONE'; readonly result: PortResult<PaymentRecord, MarkSubmitRejectCode> }
  | { readonly kind: 'APPLY'; readonly record: PaymentRecord };

const EXTERNAL_ID_RE = /^nv1-[0-9a-f]{40}$/;

/** Throws on a malformed marker: markers are derived (§10.2), so this is a programming error. */
function checkMarker(m: SubmitMarker): void {
  if (!EXTERNAL_ID_RE.test(m.externalId)) throw new TypeError(`invalid externalId: ${JSON.stringify(m.externalId)}`);
  if (normaliseHex32(m.bodyDigest) !== m.bodyDigest) throw new TypeError('bodyDigest must be lower-case 32-byte hex');
  if (m.markedAt === '' || m.markedAtBlock < 0n) throw new TypeError('marker needs markedAt and a non-negative markedAtBlock');
}

function sameMarker(a: SubmitMarker, b: SubmitMarker): boolean {
  return a.externalId === b.externalId && a.bodyDigest === b.bodyDigest && a.markedAt === b.markedAt && a.markedAtBlock === b.markedAtBlock;
}

/**
 * §7.3 markSubmit. Idempotent for an equal marker; a different marker is
 * MARKER_CONFLICT, and so is an externalId already marked on another payment
 * (`externalIdOwner`, §7.3 "the only externalId this leg will ever use"; the
 * gateway derives it from the payment id, this is defence in depth).
 * LEG_TERMINAL: the Arc leg or the payment is terminal, or a P6 is enqueued
 * (`releaseEnqueued`). NOT_READY: a leg ahead of the Arc leg has not completed.
 */
export function decideMarkSubmit(rec: PaymentRecord, expectedVersion: bigint, marker: SubmitMarker, releaseEnqueued: boolean, externalIdOwner: string | null): MarkVerdict {
  checkMarker(marker);
  const arc = arcLeg(rec);
  if (arc.submit !== null) {
    return sameMarker(arc.submit, marker)
      ? { kind: 'DONE', result: ok(rec, true) }
      : { kind: 'DONE', result: rejected('MARKER_CONFLICT', `marker ${arc.submit.externalId} already set`) };
  }
  if (externalIdOwner !== null) return { kind: 'DONE', result: rejected('MARKER_CONFLICT', `externalId ${marker.externalId} already marked on ${externalIdOwner}`) };
  if (rec.version !== expectedVersion) return { kind: 'DONE', result: rejected('VERSION_CONFLICT', `at version ${rec.version}`) };
  if (!isNonTerminal(rec.stage) || releaseEnqueued) return { kind: 'DONE', result: rejected('LEG_TERMINAL', `payment ${rec.stage}${releaseEnqueued ? ', P6 enqueued' : ''}`) };
  if (!legsAheadCompleted(rec.legs, 'ARC_TRANSFER')) return { kind: 'DONE', result: rejected('NOT_READY', 'a leg ahead of the Arc leg has not completed') };
  const legs = rec.legs.map((l) => (l.kind === 'ARC_TRANSFER' ? { ...l, submit: marker } : l));
  return { kind: 'APPLY', record: derive({ ...rec, legs, version: rec.version + 1n }) };
}

export type CompensationVerdict =
  | { readonly kind: 'DONE'; readonly result: PortResult<PaymentRecord, CompensationRejectCode> }
  | { readonly kind: 'APPLY'; readonly record: PaymentRecord };

/** §10.2 key of each settlement template a REVERSED status may compensate. */
const SETTLEMENT_KEY_SUFFIX: Readonly<Record<string, string>> = Object.freeze({ P2_SETTLE_EXTERNAL: 'p2', P2I_SETTLE_INTERNAL: 'p2i' });

/**
 * §12 last paragraph, §9.2 P7: REVERSED only via the P7 compensating entry of
 * this SETTLED payment's P2 or P2I settlement. A P7 of the P3 fee alone does
 * not reverse the payment. The receipts come from the caller's LedgerPort
 * reads [inspection-only]; the store checks they are this payment's receipts
 * under the §10.2 keys (`pay:<id>:p7` for the P7, `pay:<id>:p2` or `:p2i` for
 * the original), so a receipt of another payment or template is refused. The
 * P3 fee's own P7 (F > 0) is a second journal under `pay:<id>:p7f`, which the
 * design's single `:p7` key does not cover (deviation; see the header).
 */
export function decideCompensation(rec: PaymentRecord, expectedVersion: bigint, p7: JournalReceipt, original: JournalReceipt): CompensationVerdict {
  if (rec.compensatedBy !== null) {
    return rec.compensatedBy === p7.journalId
      ? { kind: 'DONE', result: ok(rec, true) }
      : { kind: 'DONE', result: rejected('ALREADY_REVERSED', `compensated by ${rec.compensatedBy}`) };
  }
  if (rec.version !== expectedVersion) return { kind: 'DONE', result: rejected('VERSION_CONFLICT', `at version ${rec.version}`) };
  if (rec.status !== 'SETTLED') return { kind: 'DONE', result: rejected('NOT_SETTLED', `status ${rec.status}`) };
  const suffix = SETTLEMENT_KEY_SUFFIX[original.template];
  const evidence =
    p7.template === 'P7_COMPENSATE' &&
    p7.key === `pay:${rec.paymentId}:p7` &&
    p7.refs.paymentId === rec.paymentId &&
    p7.refs.compensates === original.journalId &&
    original.refs.paymentId === rec.paymentId &&
    suffix !== undefined &&
    original.key === `pay:${rec.paymentId}:${suffix}`;
  if (!evidence) return { kind: 'DONE', result: rejected('NOT_COMPENSATION', "evidence must be the P7 receipt compensating this payment's P2 or P2I journal") };
  return { kind: 'APPLY', record: derive({ ...rec, compensatedBy: p7.journalId, version: rec.version + 1n }) };
}

/** A canonical staff id from Nova's staff authentication [A-35]: ASCII letters, digits and . _ @ - only (no whitespace, no zero-width or other invisible characters). */
const APPROVER_RE = /^[A-Za-z0-9._@-]+$/;

/**
 * The form two approver ids are compared in: NFKC, then upper case, which folds
 * more than lower case does ('ann' and 'ANN' are one person, and so are 'ß' and
 * 'ss'). Folding too much only ever refuses a pair (fail closed).
 */
export function canonicalApprover(id: string): string {
  return id.normalize('NFKC').toUpperCase();
}

function checkApprovers(d: OperatorDecision): PortResult<never, 'APPROVER_UNAUTHENTICATED' | 'SAME_APPROVER'> | null {
  if (!APPROVER_RE.test(d.approvers[0]) || !APPROVER_RE.test(d.approvers[1])) {
    return rejected('APPROVER_UNAUTHENTICATED', 'both approvers must be authenticated staff identities (canonical ids: ASCII letters, digits and . _ @ -)');
  }
  if (canonicalApprover(d.approvers[0]) === canonicalApprover(d.approvers[1])) return rejected('SAME_APPROVER', 'a decision needs two distinct approvers');
  return null;
}

/** Field-by-field equality of two decisions (the stored one and the one presented). */
export function sameDecision(a: OperatorDecision, b: OperatorDecision): boolean {
  return (
    a.decisionId === b.decisionId &&
    a.kind === b.kind &&
    a.subject === b.subject &&
    a.caseId === b.caseId &&
    a.seq === b.seq &&
    a.evidenceDigest === b.evidenceDigest &&
    a.approvers[0] === b.approvers[0] &&
    a.approvers[1] === b.approvers[1] &&
    a.decidedAt === b.decidedAt &&
    (a.txHash ?? null) === (b.txHash ?? null)
  );
}

export type DecisionVerdict = { readonly kind: 'DONE'; readonly result: PortResult<{ readonly outcome: SignalOutcome }, DecisionRejectCode> } | { readonly kind: 'RECORD' };

/**
 * §7.3 recordDecision, §10.3 OPERATOR_DECISION: the signal is the decision's
 * own `op:<decisionId>` key, the id derives from the decision's content (§10.2),
 * a LINK_HASH (and only a LINK_HASH) names its hash, the approvers are two
 * distinct canonical identities, and one id never carries two contents
 * (SIGNAL_CONFLICT). The same decision again is DUPLICATE.
 */
export function decideDecision(signal: InboundSignal, d: OperatorDecision, seen: InboxEntry | null, recorded: OperatorDecision | null): DecisionVerdict {
  const done = (result: PortResult<{ readonly outcome: SignalOutcome }, DecisionRejectCode>): DecisionVerdict => ({ kind: 'DONE', result });
  if (signal.source !== 'OPERATOR_DECISION' || signal.dedupeKey !== decisionKey(d.decisionId)) {
    return done(rejected('SIGNAL_CONFLICT', `a decision is recorded only from an OPERATOR_DECISION signal keyed ${decisionKey(d.decisionId)}`));
  }
  if (d.decisionId !== deriveDecisionId(d.kind, d.subject, d.caseId, d.seq)) return done(rejected('SIGNAL_CONFLICT', `decision id ${d.decisionId} does not derive from its kind, subject, case and seq (§10.2)`));
  const linked = d.kind === 'LINK_HASH' ? d.txHash !== undefined && normaliseHex32(d.txHash) === d.txHash : d.txHash === undefined;
  if (!linked) return done(rejected('WRONG_KIND', 'a LINK_HASH decision names the lower-case hash it links (txHash); no other kind carries one'));
  const who = checkApprovers(d);
  if (who !== null) return done(who);
  if (seen !== null && seen.digest !== signal.payloadDigest) return done(rejected('SIGNAL_CONFLICT', `dedupe key ${signal.dedupeKey} seen with a different payload`));
  if (recorded !== null) return done(sameDecision(recorded, d) ? ok({ outcome: 'DUPLICATE' as const }, true) : rejected('SIGNAL_CONFLICT', `different evidence under decision ${d.decisionId}`));
  return { kind: 'RECORD' };
}

/**
 * Two-person unpause (CLAUDE.md "Fail closed"): an UNPAUSE decision with two
 * distinct approvers, whose subject is the incident id of the pause in force,
 * recorded through recordDecision exactly as presented, not yet used to lift a
 * pause, and a paused rail. Null when it may proceed (the store then marks the
 * decision consumed in the same commit).
 */
export function decideUnpause(rail: RailState, d: OperatorDecision, recorded: OperatorDecision | null, consumed: boolean): PortResult<never, UnpauseRejectCode> | null {
  if (d.kind !== 'UNPAUSE') return rejected('WRONG_KIND', `decision ${d.decisionId} is ${d.kind}`);
  const who = checkApprovers(d);
  if (who !== null) return who;
  if (!rail.paused) return rejected('NOT_PAUSED', 'rail is running');
  if (recorded === null) return rejected('DECISION_MISSING', `decision ${d.decisionId} was not recorded`);
  if (!sameDecision(recorded, d)) return rejected('SIGNAL_CONFLICT', `decision ${d.decisionId} differs from the recorded one`);
  if (consumed) return rejected('DECISION_CONSUMED', `decision ${d.decisionId} already lifted a pause`);
  return d.subject === rail.incident ? null : rejected('WRONG_INCIDENT', `decision ${d.decisionId} is for ${d.subject}; the pause in force is ${String(rail.incident)}`);
}

/** A new ACTIVE hold (§7.3), no observations yet; the F-3b search starts at the leg's markedAtBlock. */
export function newHold(h: NewNonceHold): WalletNonceHold {
  return { ...h, holdId: deriveHoldId(h.wallet, h.dfnsTransferId), lastAtOrBelow: null, firstAbove: null, nonceTx: null, state: 'ACTIVE', liftedBy: null };
}

/**
 * §8.4 check 5: records an account-nonce reading. A reading with nonce ≤ n
 * moves `lastAtOrBelow` later; one with nonce > n moves `firstAbove` earlier.
 * With an unknown n (Q-N20) a reading bounds nothing and is not kept.
 */
export function observeHold(h: WalletNonceHold, obs: HoldObservation): WalletNonceHold {
  if (obs.block < 0n || obs.accountNonce < 0n) throw new TypeError('block and account nonce are non-negative');
  if (h.nonce === null) return h;
  if (obs.accountNonce <= h.nonce) return h.lastAtOrBelow === null || obs.block > h.lastAtOrBelow.block ? { ...h, lastAtOrBelow: obs } : h;
  return h.firstAbove === null || obs.block < h.firstAbove.block ? { ...h, firstAbove: obs } : h;
}

/** F-3b step 4a: the nonce-n transaction, set once. The same hash again replays; another hash is NONCE_TX_CONFLICT. */
export function decideHoldNonceTx(h: WalletNonceHold, txHash: Hex32): PortResult<WalletNonceHold, 'NONCE_TX_CONFLICT'> | { readonly kind: 'SET'; readonly hold: WalletNonceHold } {
  if (normaliseHex32(txHash) !== txHash) throw new TypeError('txHash must be lower-case 32-byte hex');
  if (h.nonceTx === null) return { kind: 'SET', hold: { ...h, nonceTx: txHash } };
  return h.nonceTx === txHash ? ok(h, true) : rejected('NONCE_TX_CONFLICT', `hold ${h.holdId} already names ${h.nonceTx}`);
}

/** Evidence that may lift a hold with a known nonce: our own chain reading, our own check, or a two-person decision. */
const LIFT_SOURCES: readonly SignalSource[] = Object.freeze(['ARC_LOG', 'INTERNAL', 'OPERATOR_DECISION']);

/** Why a hold with a known n may not lift yet (§8.4 check 5 "When it lifts"); null when it may. */
function knownNonceLift(h: WalletNonceHold, evidence: InboundSignal): string | null {
  if (h.firstAbove === null) return `account nonce not yet seen above ${String(h.nonce)}`;
  if (h.nonceTx === null) return `the nonce-${String(h.nonce)} transaction is not located yet (F-3b step 4a, recordHoldNonceTx)`;
  return LIFT_SOURCES.includes(evidence.source) ? null : `${evidence.source} evidence cannot lift a hold; it needs ARC_LOG, INTERNAL or OPERATOR_DECISION`;
}

/**
 * §8.4 check 5 lift: with a known n, only once an agreed reading shows the
 * account nonce passed n (`firstAbove`) and the nonce-n transaction is located
 * (`nonceTx`), on evidence from an accepted source; with an unknown n, only on
 * a recorded NONCE_UNKNOWN_CLOSE decision for this hold (Q-N20). The rest of
 * proof (c), or the two-person link, for a transfer that was not aborted is
 * the caller's check. The evidence is deduped like any signal; a lifted hold
 * replays.
 */
export function decideLift(
  h: WalletNonceHold,
  evidence: InboundSignal,
  seen: InboxEntry | null,
  decision: OperatorDecision | null,
): PortResult<WalletNonceHold, LiftRejectCode> | { readonly kind: 'LIFT'; readonly hold: WalletNonceHold } {
  if (seen !== null && seen.digest !== evidence.payloadDigest) return rejected('SIGNAL_CONFLICT', `dedupe key ${evidence.dedupeKey} seen with a different payload`);
  if (h.state === 'LIFTED') return ok(h, true);
  if (seen !== null && seen.subject !== null) return rejected('SIGNAL_CONFLICT', `dedupe key ${evidence.dedupeKey} already applied to ${seen.subject}`);
  const why =
    h.nonce === null
      ? evidence.source === 'OPERATOR_DECISION' && decision !== null && decision.kind === 'NONCE_UNKNOWN_CLOSE' && decision.subject === h.holdId
        ? null
        : 'unknown nonce: needs a NONCE_UNKNOWN_CLOSE decision for this hold'
      : knownNonceLift(h, evidence);
  if (why !== null) return rejected('HOLD_NOT_RESOLVED', why);
  return { kind: 'LIFT', hold: { ...h, state: 'LIFTED', liftedBy: evidence.dedupeKey } };
}

/** Range commit check shared by both fakes: no cursor regression, no dedupe key with two digests (against the inbox or within the batch). */
export function checkRange(
  current: bigint | null,
  toBlock: bigint,
  signals: readonly InboundSignal[],
  seen: (dedupeKey: string) => InboxEntry | null,
): PortResult<never, 'CURSOR_REGRESSION' | 'SIGNAL_CONFLICT'> | null {
  if (current !== null && toBlock < current) return rejected('CURSOR_REGRESSION', `cursor at ${current}, asked ${toBlock}`);
  const batch = new Map<string, Hex32>();
  for (const s of signals) {
    const prior = seen(s.dedupeKey)?.digest ?? batch.get(s.dedupeKey) ?? null;
    if (prior !== null && prior !== s.payloadDigest) return rejected('SIGNAL_CONFLICT', s.dedupeKey);
    batch.set(s.dedupeKey, s.payloadDigest);
  }
  return null;
}

export type CloseVerdict =
  | { readonly kind: 'DONE'; readonly result: PortResult<{ readonly outcome: SignalOutcome; readonly record: PaymentRecord }, SignalRejectCode> }
  | { readonly kind: 'APPLY'; readonly record: PaymentRecord };

/** F-17 second branch: the two-person CLOSE_PARTNER_UNRETURNED decision for this payment, added to its OPEN case. */
function closeByClaim(rec: PaymentRecord, evidence: InboundSignal, d: OperatorDecision | null, c: CaseRecord): string | null {
  if (evidence.source !== 'OPERATOR_DECISION' || d === null) return 'P11 needs the recorded two-person CLOSE_PARTNER_UNRETURNED decision as evidence';
  if (d.kind !== 'CLOSE_PARTNER_UNRETURNED' || d.subject !== rec.paymentId) return `decision ${d.decisionId} is ${d.kind} for ${d.subject}, not CLOSE_PARTNER_UNRETURNED for ${rec.paymentId}`;
  if (!c.decisions.includes(d.decisionId)) return `decision ${d.decisionId} is not on case ${c.caseId} (addCaseDecision first)`;
  return c.state === 'OPEN' ? null : `case ${c.caseId} is ${c.state}; the partner's return is P2R, not P11`;
}

/** F-17 first branch: the Arc log of the partner's exact return, claimed by this payment's case. */
function closeByReturn(evidence: InboundSignal, c: CaseRecord): string | null {
  if (evidence.source !== 'ARC_LOG') return 'P2R needs the Arc log of the partner\'s return as evidence';
  // §9.2 P2R, §12 F-17: only a return of exactly value = cbsMinorToNativeWei(A, p) matches. putCase binds a PARTNER_RETURN case's expected value to the payment's binding, and a claim matches the log by that value, so the claimed log is of exactly A.
  // matchedLog is set only by a claim, which also makes the case MATCHED.
  return c.matchedLog === evidence.dedupeKey ? null : `case ${c.caseId} has not claimed ${evidence.dedupeKey} (claimInbound)`;
}

/**
 * F-17 close (§9.2 P6, P11, P2R; §9.3). `seen` is the inbox row of the evidence
 * key (recorded by recordDecision or claimed by claimInbound; its digest must
 * match), `decision` the decision the evidence's `op:` key names, `partnerCase`
 * the payment's PARTNER_RETURN case (deriveCaseId), `enqueued` reads the outbox.
 * The close is exactly once: once P6 is enqueued, the same items again are
 * DUPLICATE and anything else is refused.
 */
export function decideClosePayout(
  rec: PaymentRecord,
  expectedVersion: bigint,
  evidence: InboundSignal,
  outbox: readonly OutboxItem[],
  seen: InboxEntry | null,
  decision: OperatorDecision | null,
  partnerCase: CaseRecord | null,
  enqueued: (key: IdempotencyKey) => OutboxItem | null,
): CloseVerdict {
  const refuse = (code: SignalRejectCode, detail: string): CloseVerdict => ({ kind: 'DONE', result: rejected(code, detail) });
  const payout = rec.legs.find((l) => l.kind === 'PAYOUT');
  const arcDone = rec.legs.some((l) => l.kind === 'ARC_TRANSFER' && l.stage === 'COMPLETED');
  if (payout === undefined || !isFailureStage(payout.stage) || !arcDone) {
    return refuse('ILLEGAL_TRANSITION', 'closeFailedPayout is only for a FIAT_BANK payment whose PAYOUT leg failed after the Arc leg COMPLETED, with the USDC at the partner (F-17)');
  }
  const keys: readonly string[] = outbox.map((o) => o.key);
  // §9.2 P2R, §12 F-17: after the P11 branch a later exact return is P2R alone (credits partnerClaim, no second P6).
  const late = enqueued(partnerClaimKey(rec.paymentId)) !== null && enqueued(partnerReturnKey(rec.paymentId)) === null && keys.length === 1 && keys[0] === partnerReturnKey(rec.paymentId);
  if (enqueued(releaseKey(rec.paymentId)) !== null && !late) {
    const why = unqueued(outbox, enqueued);
    return why === null ? { kind: 'DONE', result: ok({ outcome: 'DUPLICATE' as const, record: rec }, true) } : refuse('ILLEGAL_TRANSITION', `the payment is already released; ${why}`);
  }
  if (rec.version !== expectedVersion) return refuse('VERSION_CONFLICT', `at version ${rec.version}`);
  if (seen === null || seen.digest !== evidence.payloadDigest) return refuse('SIGNAL_CONFLICT', `evidence ${evidence.dedupeKey} is not the recorded signal under that key`);
  const claim = keys.includes(partnerClaimKey(rec.paymentId));
  // `late` implies P11 was enqueued, which closeByClaim does only on an existing case (a case is never deleted).
  if (late && partnerCase !== null) {
    const lateWhy = closeByReturn(evidence, partnerCase);
    return lateWhy === null ? { kind: 'APPLY', record: derive({ ...rec, version: rec.version + 1n }) } : refuse('ILLEGAL_TRANSITION', lateWhy);
  }
  if (!keys.includes(releaseKey(rec.paymentId)) || claim === keys.includes(partnerReturnKey(rec.paymentId))) {
    return refuse('ILLEGAL_TRANSITION', 'a failed payout closes with P6 and exactly one of P11 or P2R (F-17)');
  }
  if (partnerCase === null) return refuse('ILLEGAL_TRANSITION', `no PARTNER_RETURN case for ${rec.paymentId} (putCase on an OPEN_PARTNER_CASE decision first)`);
  const why = claim ? closeByClaim(rec, evidence, decision, partnerCase) : closeByReturn(evidence, partnerCase);
  if (why !== null) return refuse('ILLEGAL_TRANSITION', why);
  return { kind: 'APPLY', record: derive({ ...rec, version: rec.version + 1n }) };
}

/** Canonical encoding of a case, for same-id comparison. */
function caseKey(c: CaseRecord): string {
  const e = c.expected;
  return JSON.stringify([c.caseId, c.kind, c.subject, e === null ? null : [e.from, e.to, e.value.toString()], c.state, c.decisions, c.matchedLog]);
}

/**
 * §7.3 putCase. The id derives from (kind, subject) (§10.2); the same case
 * again replays and a different one under the id is KEY_CONFLICT. A new case is
 * OPEN with no claimed log, carries `expected` exactly when it is a
 * PARTNER_RETURN (throws otherwise: a programming error), and lists only
 * decisions recorded for it; a PARTNER_RETURN opens on an OPEN_PARTNER_CASE
 * decision (two people approve the expected return, F-17) and expects exactly
 * the amount A of its subject payment (BINDING_MISMATCH otherwise).
 */
export function decidePutCase(
  c: CaseRecord,
  existing: CaseRecord | null,
  decisionOf: (decisionId: string) => OperatorDecision | null,
  subjectPayment: PaymentRecord | null,
): PortResult<CaseRecord, CaseRejectCode> | { readonly kind: 'PUT' } {
  if (c.caseId !== deriveCaseId(c.kind, c.subject)) return rejected('KEY_CONFLICT', `case id ${c.caseId} does not derive from its kind and subject (§10.2)`);
  if (existing !== null) return caseKey(existing) === caseKey(c) ? ok(existing, true) : rejected('KEY_CONFLICT', `case ${c.caseId} already exists with other content`);
  if (c.state !== 'OPEN' || c.matchedLog !== null) throw new TypeError('a new case is OPEN with no claimed log');
  if ((c.kind === 'PARTNER_RETURN') !== (c.expected !== null)) throw new TypeError('expected is set exactly for a PARTNER_RETURN case');
  const ds = c.decisions.map(decisionOf);
  if (ds.some((d) => d === null || d.caseId !== c.caseId)) return rejected('DECISION_MISSING', `case ${c.caseId} lists a decision not recorded for it`);
  const [first] = ds;
  if (c.kind === 'PARTNER_RETURN' && first?.kind !== 'OPEN_PARTNER_CASE') return rejected('DECISION_MISSING', 'a PARTNER_RETURN case opens on a two-person OPEN_PARTNER_CASE decision');
  // §9.2 P2R, §12 F-17: the expected return is exactly the payment's A (server-side binding); another value would strand the payment, so it never opens.
  if (c.kind === 'PARTNER_RETURN' && (subjectPayment === null || c.expected?.value !== subjectPayment.binding.amount)) {
    return rejected('BINDING_MISMATCH', `a PARTNER_RETURN case expects exactly the amount of payment ${c.subject} (its binding), and that payment must exist`);
  }
  return { kind: 'PUT' };
}

/** §7.3 addCaseDecision: a decision recorded for this case is appended once (again: replay). */
export function decideCaseDecision(
  c: CaseRecord,
  d: OperatorDecision | null,
): PortResult<CaseRecord, 'DECISION_MISSING'> | { readonly kind: 'ADD'; readonly record: CaseRecord } {
  if (d === null || d.caseId !== c.caseId) return rejected('DECISION_MISSING', `no decision recorded for case ${c.caseId} under that id`);
  if (c.decisions.includes(d.decisionId)) return ok(c, true);
  return { kind: 'ADD', record: { ...c, decisions: [...c.decisions, d.decisionId] } };
}

/**
 * §6.1 claim of an inbound Arc log by an OPEN PARTNER_RETURN case whose
 * expected (from, to, value) equals the log's exactly. `seen` is the log's
 * inbox row; `claimedCase` the case that already claimed this log, if any;
 * `open` the OPEN PARTNER_RETURN cases. Exactly one match is claimed; none or
 * two (ambiguous, F-12) claim nothing.
 */
export function decideClaim(
  log: InboundSignal,
  triple: InboundTriple,
  seen: InboxEntry | null,
  claimedCase: CaseRecord | null,
  open: readonly CaseRecord[],
): PortResult<{ readonly claimedBy: CaseRecord | null }, 'SIGNAL_CONFLICT'> | { readonly kind: 'CLAIM'; readonly record: CaseRecord } {
  if (log.source !== 'ARC_LOG') return rejected('SIGNAL_CONFLICT', 'only an Arc log is claimed by a case');
  if (seen !== null && seen.digest !== log.payloadDigest) return rejected('SIGNAL_CONFLICT', `dedupe key ${log.dedupeKey} seen with a different payload`);
  if (claimedCase !== null) return ok({ claimedBy: claimedCase }, true);
  if (seen !== null && seen.subject !== null) return rejected('SIGNAL_CONFLICT', `dedupe key ${log.dedupeKey} already applied to ${seen.subject}`);
  const matches = open.filter((c) => c.expected !== null && c.expected.from === triple.from && c.expected.to === triple.to && c.expected.value === triple.value);
  const [only, second] = matches;
  return only === undefined || second !== undefined ? ok({ claimedBy: null }, false) : { kind: 'CLAIM', record: { ...only, state: 'MATCHED', matchedLog: log.dedupeKey } };
}
