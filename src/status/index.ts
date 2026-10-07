/**
 * Status model (docs/NOVA_ARC_DESIGN.md §13; CO-1 v3 step 6; ADR-013 input).
 *
 * Nova's `TransactionStatus` stays the public status, unchanged [A-31]. Each
 * payment leg carries a lifecycle `stage`; this file is the ONLY place where a
 * stage maps to a status (STATUS_BY_STAGE) and where stage transitions are
 * judged (decideTransition).
 *
 * Rules enforced here:
 * - every non-success terminal stage carries a reason from the §7.3 / §13.2
 *   list (LegState makes a reasonless REJECTED/EXPIRED/CANCELLED
 *   unrepresentable, and isLegalState re-checks it at runtime, fail closed);
 * - a blocklisted sender rejected before the mempool and an under-floor drop
 *   are FAILED with a reason (BLOCKLISTED_PRE_MEMPOOL, UNDER_FEE_FLOOR_DROPPED);
 * - REVERSED is never a stage: it is the status of a COMPLETED payment that
 *   has a compensating ledger entry (P7) recorded, and nothing else;
 * - COMPLETED for the Arc leg comes only from our own confirmed system-emitter
 *   log (ARC_LOG), never from a DFNS webhook or poll (§2 principle 6, §6.5);
 * - no DFNS status ends the Arc leg by itself once a DFNS request may exist
 *   (§8.4 check 3): a hash-less `Failed` ends it only on a two-person decision
 *   (OPERATOR_DECISION: proof (a2) accepted abort, or proof (c) with F-3b step
 *   4a), and while the request is UNRESOLVED (submit marker set, no DFNS entity
 *   known) no terminal stage is reachable at all (§13.3).
 *
 * Signal sources: the six of §7.3 `InboundSignal`, plus two package-internal
 * ones: LEDGER (the result of our own Nova ledger call, for the RESERVE leg)
 * and INTERNAL (our own deterministic checks: flags, precheck, quote clock,
 * proof (b) of §8.4 check 3 computed from both RPC sources).
 */

/** Nova `types.ts` TransactionStatus, unchanged [A-31]. */
export type TransactionStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'REVERSED';

/** Non-terminal stages, in lifecycle order (§13.3). */
export const NON_TERMINAL_STAGES = Object.freeze(['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'CONFIRMING'] as const);
export type NonTerminalStage = (typeof NON_TERMINAL_STAGES)[number];
export type FailureStage = 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type TerminalStage = 'COMPLETED' | FailureStage;
export type Stage = NonTerminalStage | TerminalStage;

/** The legs a payment journey can have (§4.1). */
export type LegKind = 'AWAIT_DEPOSIT' | 'RESERVE' | 'CONVERT_IN' | 'ARC_TRANSFER' | 'PAYOUT';

/** §13.2 REJECTED reasons, in the design's order. */
export const REJECTED_REASONS = Object.freeze([
  'APPROVAL_DENIED',
  'BLOCKLISTED_PRECHECK',
  'BLOCKLISTED_PRE_MEMPOOL',
  'ONCHAIN_REVERTED',
  'DFNS_FAILED',
  'INSUFFICIENT_FUNDS',
  'PAYOUT_FAILED',
  'METHOD_NOT_ENABLED',
  'DESTINATION_NOT_ALLOWED',
] as const);
/** §13.2 EXPIRED reasons. */
export const EXPIRED_REASONS = Object.freeze(['APPROVAL_EXPIRED', 'QUOTE_EXPIRED', 'UNDER_FEE_FLOOR_DROPPED'] as const);
/** §13.2 CANCELLED reasons. */
export const CANCELLED_REASONS = Object.freeze(['CANCELLED_BY_OPERATOR', 'CANCELLED_ONCHAIN_REPLACED'] as const);

export type RejectedReason = (typeof REJECTED_REASONS)[number];
export type ExpiredReason = (typeof EXPIRED_REASONS)[number];
export type CancelledReason = (typeof CANCELLED_REASONS)[number];
/** Exactly the §7.3 `FailureReason` list. */
export type FailureReason = RejectedReason | ExpiredReason | CancelledReason;

/** Reasons allowed per failure stage (§13.2). */
export const REASONS_BY_STAGE: Readonly<Record<FailureStage, readonly FailureReason[]>> = Object.freeze({
  REJECTED: REJECTED_REASONS,
  EXPIRED: EXPIRED_REASONS,
  CANCELLED: CANCELLED_REASONS,
});

/** A leg's stage with its reason. A failure stage without a reason is unrepresentable. */
export type LegState =
  | { readonly stage: NonTerminalStage | 'COMPLETED'; readonly reason: null }
  | { readonly stage: 'REJECTED'; readonly reason: RejectedReason }
  | { readonly stage: 'EXPIRED'; readonly reason: ExpiredReason }
  | { readonly stage: 'CANCELLED'; readonly reason: CancelledReason };

/** Where a stage change comes from (see the file header). */
export type SignalSource = 'ARC_LOG' | 'DFNS_WEBHOOK' | 'DFNS_POLL' | 'CONVERSION' | 'PAYOUT_CALLBACK' | 'OPERATOR_DECISION' | 'LEDGER' | 'INTERNAL';
export const SIGNAL_SOURCES: readonly SignalSource[] = Object.freeze(['ARC_LOG', 'DFNS_WEBHOOK', 'DFNS_POLL', 'CONVERSION', 'PAYOUT_CALLBACK', 'OPERATOR_DECISION', 'LEDGER', 'INTERNAL']);

/**
 * Whether a DFNS transfer request may exist for an Arc leg (§7.3 SubmitMarker,
 * §8.4 check 3). NONE: no submit marker, so no DFNS request can exist.
 * UNRESOLVED: marker set, no DFNS entity known yet (a request may exist).
 * KNOWN: marker set and the DFNS entity's id is stored. Every other leg is NONE.
 */
export type DfnsRequest = 'NONE' | 'UNRESOLVED' | 'KNOWN';
export const DFNS_REQUEST_STATES: readonly DfnsRequest[] = Object.freeze(['NONE', 'UNRESOLVED', 'KNOWN']);

/** §13.2: the single stage → TransactionStatus table. COMPLETED is SETTLED unless a P7 compensation is recorded. */
export const STATUS_BY_STAGE: Readonly<Record<Stage, TransactionStatus>> = Object.freeze({
  CREATED: 'PENDING',
  PENDING_APPROVAL: 'PENDING',
  APPROVED: 'PROCESSING',
  SUBMITTED: 'PROCESSING',
  CONFIRMING: 'PROCESSING',
  COMPLETED: 'SETTLED',
  REJECTED: 'FAILED',
  EXPIRED: 'FAILED',
  CANCELLED: 'FAILED',
});

/** Lifecycle rank of each non-terminal stage (§13.3). */
const RANK: Readonly<Record<NonTerminalStage, bigint>> = Object.freeze({ CREATED: 0n, PENDING_APPROVAL: 1n, APPROVED: 2n, SUBMITTED: 3n, CONFIRMING: 4n });

/** Rank of a non-terminal stage; null for a terminal (or unknown) stage. */
function rankOf(stage: Stage): bigint | null {
  for (const s of NON_TERMINAL_STAGES) if (s === stage) return RANK[s];
  return null;
}

/** Reasons a failure stage may carry; empty for any other stage. */
function failureReasons(stage: Stage): readonly FailureReason[] {
  switch (stage) {
    case 'REJECTED':
      return REJECTED_REASONS;
    case 'EXPIRED':
      return EXPIRED_REASONS;
    case 'CANCELLED':
      return CANCELLED_REASONS;
    default:
      return [];
  }
}

export function isNonTerminal(stage: Stage): boolean {
  return rankOf(stage) !== null;
}

export function isFailureStage(stage: Stage): boolean {
  return failureReasons(stage).length > 0;
}

/** Runtime check of the LegState invariant (a cast could bypass the type). */
export function isLegalState(state: { readonly stage: Stage; readonly reason: FailureReason | null }): boolean {
  if (isNonTerminal(state.stage) || state.stage === 'COMPLETED') return state.reason === null;
  const allowed: readonly (FailureReason | null)[] = failureReasons(state.stage);
  return allowed.includes(state.reason);
}

/**
 * Public status of a leg or payment state. `compensatedBy` is the P7 journal id
 * when a compensating ledger entry was recorded, else null. REVERSED is reachable
 * only this way, and only from COMPLETED. Throws on an illegal combination
 * (programming error; the caller QUARANTINEs).
 */
export function toTransactionStatus(state: LegState, compensatedBy: string | null): TransactionStatus {
  if (!isLegalState(state)) throw new TypeError(`illegal stage/reason: ${state.stage}/${String(state.reason)}`);
  if (compensatedBy !== null) {
    if (state.stage !== 'COMPLETED') throw new TypeError(`compensation recorded on a ${state.stage} payment`);
    return 'REVERSED';
  }
  return STATUS_BY_STAGE[state.stage];
}

/**
 * Non-terminal stages strictly between `from` and `to` when both are
 * non-terminal: the stages a forward jump passes (§13.3). Empty otherwise.
 */
export function skippedStages(from: Stage, to: Stage): readonly NonTerminalStage[] {
  const lo = rankOf(from);
  const hi = rankOf(to);
  if (lo === null || hi === null) return [];
  return NON_TERMINAL_STAGES.filter((s) => RANK[s] > lo && RANK[s] < hi);
}

const ALL_LEGS: readonly LegKind[] = Object.freeze(['AWAIT_DEPOSIT', 'RESERVE', 'CONVERT_IN', 'ARC_TRANSFER', 'PAYOUT']);
const PRE_SUBMIT: readonly NonTerminalStage[] = Object.freeze(['CREATED', 'PENDING_APPROVAL', 'APPROVED']);
const IN_FLIGHT: readonly NonTerminalStage[] = Object.freeze(['SUBMITTED', 'CONFIRMING']);
const DFNS: readonly SignalSource[] = Object.freeze(['DFNS_WEBHOOK', 'DFNS_POLL']);
const NO_REQUEST: readonly DfnsRequest[] = Object.freeze(['NONE']);
const KNOWN: readonly DfnsRequest[] = Object.freeze(['KNOWN']);
const ARC: readonly LegKind[] = Object.freeze(['ARC_TRANSFER']);

/** One way a transition can be legal: on these legs, from these stages, on this evidence, in these request states. */
export interface Rule {
  readonly legs: readonly LegKind[];
  readonly from: readonly Stage[];
  readonly sources: readonly SignalSource[];
  readonly request: readonly DfnsRequest[];
}

/**
 * §13.3, per reason: the ways a leg may end with it. Pre-request reasons need
 * NONE (no submit marker, so no DFNS request can exist); every DFNS-path reason
 * needs KNOWN (the DFNS entity is known); UNRESOLVED has no failure at all.
 */
export const FAILURE_RULES: Readonly<Record<FailureReason, readonly Rule[]>> = Object.freeze({
  // Pre-request reasons (CREATED, no submit marker).
  INSUFFICIENT_FUNDS: [
    { legs: ['RESERVE'], from: ['CREATED'], sources: ['LEDGER'], request: NO_REQUEST },
    { legs: ['CONVERT_IN'], from: ['CREATED'], sources: ['CONVERSION'], request: NO_REQUEST },
  ],
  METHOD_NOT_ENABLED: [{ legs: ALL_LEGS, from: ['CREATED'], sources: ['INTERNAL'], request: NO_REQUEST }],
  BLOCKLISTED_PRECHECK: [{ legs: ARC, from: ['CREATED'], sources: ['INTERNAL'], request: NO_REQUEST }],
  DESTINATION_NOT_ALLOWED: [{ legs: ARC, from: ['CREATED'], sources: ['INTERNAL'], request: NO_REQUEST }],
  QUOTE_EXPIRED: [{ legs: ['AWAIT_DEPOSIT', 'RESERVE', 'CONVERT_IN', 'ARC_TRANSFER'], from: ['CREATED'], sources: ['INTERNAL', 'CONVERSION'], request: NO_REQUEST }],
  // Directly by an operator only while no request exists; after it, only on proof (a2), an abort DFNS accepted (a two-person case).
  CANCELLED_BY_OPERATOR: [
    { legs: ALL_LEGS, from: ['CREATED'], sources: ['OPERATOR_DECISION'], request: NO_REQUEST },
    { legs: ARC, from: PRE_SUBMIT, sources: ['OPERATOR_DECISION'], request: KNOWN },
  ],
  // Proof (a1): DFNS rejects only from Pending.
  APPROVAL_DENIED: [{ legs: ARC, from: ['CREATED', 'PENDING_APPROVAL'], sources: DFNS, request: KNOWN }],
  APPROVAL_EXPIRED: [{ legs: ARC, from: ['CREATED', 'PENDING_APPROVAL'], sources: DFNS, request: KNOWN }],
  // Hash-less Failed: only with proof (c) and F-3b step 4a, a two-person decision. The DFNS status alone is never enough.
  DFNS_FAILED: [{ legs: ARC, from: PRE_SUBMIT, sources: ['OPERATOR_DECISION'], request: KNOWN }],
  BLOCKLISTED_PRE_MEMPOOL: [{ legs: ARC, from: PRE_SUBMIT, sources: ['OPERATOR_DECISION'], request: KNOWN }],
  // On-chain reasons, from SUBMITTED onward only.
  ONCHAIN_REVERTED: [{ legs: ARC, from: IN_FLIGHT, sources: ['ARC_LOG'], request: KNOWN }],
  UNDER_FEE_FLOOR_DROPPED: [{ legs: ARC, from: IN_FLIGHT, sources: ['INTERNAL'], request: KNOWN }],
  CANCELLED_ONCHAIN_REPLACED: [{ legs: ARC, from: IN_FLIGHT, sources: ['OPERATOR_DECISION'], request: KNOWN }],
  PAYOUT_FAILED: [{ legs: ['PAYOUT'], from: IN_FLIGHT, sources: ['PAYOUT_CALLBACK'], request: NO_REQUEST }],
});

/**
 * Per leg: from which stages, and on which evidence, a leg may become COMPLETED.
 * ARC_TRANSFER completes only on our own confirmed system-emitter log (§6.5),
 * never before SUBMITTED. PAYOUT completes only on the partner's authenticated
 * final confirmation (§4.1).
 */
export const COMPLETION_RULES: readonly Rule[] = Object.freeze([
  { legs: ['AWAIT_DEPOSIT'], from: NON_TERMINAL_STAGES, sources: ['ARC_LOG'], request: NO_REQUEST },
  { legs: ['RESERVE'], from: NON_TERMINAL_STAGES, sources: ['LEDGER'], request: NO_REQUEST },
  { legs: ['CONVERT_IN'], from: NON_TERMINAL_STAGES, sources: ['CONVERSION'], request: NO_REQUEST },
  { legs: ARC, from: IN_FLIGHT, sources: ['ARC_LOG'], request: KNOWN },
  { legs: ['PAYOUT'], from: IN_FLIGHT, sources: ['PAYOUT_CALLBACK'], request: NO_REQUEST },
]);

/** A forward jump (§13.3) to one of `to`. */
export interface ProgressRule extends Rule {
  readonly to: readonly NonTerminalStage[];
}

/**
 * Who may move a leg forward between non-terminal stages. The Arc leg moves on
 * DFNS's view of the transfer (§8.6) only once a submit marker exists; while
 * UNRESOLVED only a DFNS signal (which carries the entity) may move it. Our
 * indexer (ARC_LOG, INTERNAL) may move SUBMITTED → CONFIRMING, and a two-person
 * hash link (§6.5 rule 1) is a forward jump to CONFIRMING.
 */
export const PROGRESS_RULES: readonly ProgressRule[] = Object.freeze([
  { legs: ['AWAIT_DEPOSIT'], to: NON_TERMINAL_STAGES, from: NON_TERMINAL_STAGES, sources: ['ARC_LOG'], request: NO_REQUEST },
  { legs: ['RESERVE'], to: NON_TERMINAL_STAGES, from: NON_TERMINAL_STAGES, sources: ['LEDGER'], request: NO_REQUEST },
  { legs: ['CONVERT_IN'], to: NON_TERMINAL_STAGES, from: NON_TERMINAL_STAGES, sources: ['CONVERSION'], request: NO_REQUEST },
  { legs: ['PAYOUT'], to: NON_TERMINAL_STAGES, from: NON_TERMINAL_STAGES, sources: ['PAYOUT_CALLBACK'], request: NO_REQUEST },
  { legs: ARC, to: NON_TERMINAL_STAGES, from: NON_TERMINAL_STAGES, sources: DFNS, request: ['UNRESOLVED', 'KNOWN'] },
  { legs: ARC, to: ['CONFIRMING'], from: ['SUBMITTED'], sources: ['ARC_LOG', 'INTERNAL'], request: KNOWN },
  { legs: ARC, to: ['CONFIRMING'], from: ['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED'], sources: ['OPERATOR_DECISION'], request: KNOWN },
]);

function fits(rule: Rule, leg: LegKind, from: Stage, source: SignalSource, request: DfnsRequest): boolean {
  return rule.legs.includes(leg) && rule.from.includes(from) && rule.sources.includes(source) && rule.request.includes(request);
}

/** APPLIED: change the leg. DUPLICATE: same terminal state again. STALE: older or repeated state, no change. ILLEGAL: QUARANTINE and page. */
export type TransitionVerdict = 'APPLIED' | 'DUPLICATE' | 'STALE' | 'ILLEGAL';

/** §13.3 "Legal transitions" and "Everything else", for one leg. `request` is the Arc leg's DfnsRequest, and NONE for any other leg. */
export function decideTransition(leg: LegKind, current: LegState, target: LegState, source: SignalSource, request: DfnsRequest): TransitionVerdict {
  if (!isLegalState(current) || !isLegalState(target)) return 'ILLEGAL';
  const from = rankOf(current.stage);
  const to = rankOf(target.stage);
  if (from === null) {
    if (to !== null) return 'STALE';
    return target.stage === current.stage && target.reason === current.reason ? 'DUPLICATE' : 'ILLEGAL';
  }
  if (to !== null) {
    if (to <= from) return 'STALE';
    return PROGRESS_RULES.some((r) => r.to.includes(target.stage as NonTerminalStage) && fits(r, leg, current.stage, source, request)) ? 'APPLIED' : 'ILLEGAL';
  }
  const rules = target.reason === null ? COMPLETION_RULES : FAILURE_RULES[target.reason];
  return rules.some((r) => fits(r, leg, current.stage, source, request)) ? 'APPLIED' : 'ILLEGAL';
}

/**
 * §4.2 payment-level state from leg states (legs in journey order): the first
 * leg that ended without success makes the payment terminal with its stage and
 * reason; otherwise the first leg not COMPLETED; otherwise COMPLETED. The store
 * refuses a failure on a leg while a leg ahead of it may still move money, and
 * any change after a failure (src/nova-ports/payment-store.ts), so a FAILED
 * payment never has money in flight.
 */
export function paymentState(legs: readonly LegState[]): LegState {
  if (legs.length === 0) throw new TypeError('a payment has at least one leg');
  const failed = legs.find((l) => isFailureStage(l.stage));
  if (failed !== undefined) return failed;
  return legs.find((l) => l.stage !== 'COMPLETED') ?? { stage: 'COMPLETED', reason: null };
}
