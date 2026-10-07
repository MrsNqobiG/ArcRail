/**
 * OPS: operator case queue, shapes and the pure rules (design delta 1, D-2 and D-6).
 *
 * Every case has a closed reason code. Operators choose among SERVER-SIDE
 * options; they never type an amount (CLAUDE.md "Binding"). Money-moving
 * actions need two distinct authenticated humans, and a client consent where
 * the delta says so (D-2, D-3). Assumptions about Nova (DA-5, DA-6, DQ-4 and
 * CF-31) are listed in docs/KHUMO_QUESTIONS.md; none is built on here.
 *
 * Money path: no `number` anywhere (MC-01). Amounts are bigint brands from U1.
 */

import { CBS_MINOR_MAX } from '../amounts/index.js';
import type { CbsMinor, UsdcUnits } from '../amounts/index.js';
import { lpDigestHex } from '../nova-ports/ids.js';
import type { LedgerAssetCode, NovaAccountRef, PaymentId } from '../nova-ports/ids.js';

/** An amount the queue moves or compares: CBS minor units or ERC-20 USDC units. Never mixed in one option. */
export type OpsAmount = CbsMinor | UsdcUnits;
export type AmountUnit = 'CBS_MINOR' | 'USDC_UNITS';

/** The closed set of case kinds (D-2 "Cases"). */
export type CaseKind =
  | 'QUARANTINE'
  | 'HOLD'
  | 'PAUSE'
  | 'REQUOTE'
  | 'UNDERPAYMENT'
  | 'OVERPAYMENT'
  | 'LATE_PAYIN'
  | 'STUCK_PAYOUT'
  | 'RETURNED_PAYOUT'
  | 'UNRESOLVED_SUBMIT';

export const CASE_KINDS: readonly CaseKind[] = [
  'QUARANTINE',
  'HOLD',
  'PAUSE',
  'REQUOTE',
  'UNDERPAYMENT',
  'OVERPAYMENT',
  'LATE_PAYIN',
  'STUCK_PAYOUT',
  'RETURNED_PAYOUT',
  'UNRESOLVED_SUBMIT',
];

/** The closed set of operator actions (D-2 "Operator actions"; the last two are the D1 two-person lifts). */
export type OpAction =
  | 'REQUOTE'
  | 'ACCEPT_WITH_CONSENT'
  | 'REFUND'
  | 'RETRY_AS_NEW_PAYMENT'
  | 'WRITE_OFF'
  | 'RELEASE_QUARANTINE'
  | 'UNPAUSE';

export const OP_ACTIONS: readonly OpAction[] = [
  'REQUOTE',
  'ACCEPT_WITH_CONSENT',
  'REFUND',
  'RETRY_AS_NEW_PAYMENT',
  'WRITE_OFF',
  'RELEASE_QUARANTINE',
  'UNPAUSE',
];

/** Closed reason codes per kind. A case with any other reason is refused (fail closed). */
export const REASONS: Readonly<Record<CaseKind, readonly string[]>> = {
  QUARANTINE: ['SIGNAL_CONFLICT', 'UNKNOWN_EVENT', 'INVARIANT_FAILED', 'CONSENT_MISSING', 'AUTHENTICITY_FAILED'],
  HOLD: ['NONCE_HOLD', 'RECON_DRIFT', 'MONITOR_NOT_ALL_CLEAR'],
  PAUSE: ['RAIL_DISAGREEMENT', 'RECON_DRIFT', 'INDEXER_STALL'],
  REQUOTE: ['RATE_EXPIRED', 'RATE_CHANGED', 'FILL_AFTER_EXPIRY'],
  UNDERPAYMENT: ['CONFIRMED_BELOW_EXPECTED'],
  OVERPAYMENT: ['CONFIRMED_ABOVE_EXPECTED'],
  LATE_PAYIN: ['PAYIN_AFTER_QUOTE_EXPIRY', 'PAYIN_AFTER_PAYMENT_CLOSED'],
  STUCK_PAYOUT: ['NO_TERMINAL_STATE', 'PARTNER_TIMEOUT'],
  RETURNED_PAYOUT: ['PARTNER_RETURNED', 'BENEFICIARY_REJECTED'],
  UNRESOLVED_SUBMIT: ['MARKER_SET_NO_EXTERNAL_REF', 'DFNS_TIMEOUT', 'DFNS_5XX', 'HASHLESS_FAILED'],
};

/** Which actions each kind may take. Anything else is ACTION_NOT_ALLOWED. */
export const ALLOWED_ACTIONS: Readonly<Record<CaseKind, readonly OpAction[]>> = {
  QUARANTINE: ['RELEASE_QUARANTINE', 'REFUND', 'WRITE_OFF'],
  HOLD: ['UNPAUSE', 'REFUND', 'WRITE_OFF'],
  PAUSE: ['UNPAUSE'],
  REQUOTE: ['REQUOTE', 'REFUND', 'WRITE_OFF'],
  UNDERPAYMENT: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
  OVERPAYMENT: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
  LATE_PAYIN: ['REQUOTE', 'ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
  STUCK_PAYOUT: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'],
  RETURNED_PAYOUT: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'],
  UNRESOLVED_SUBMIT: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'],
};

/** Actions that need a consent bound to the exact option (D-2, D-3). */
export const CONSENT_ACTIONS: readonly OpAction[] = ['REQUOTE', 'ACCEPT_WITH_CONSENT'];

/** Posting templates the queue sends to the ledger (D-2 "Posting templates"). P6 is the existing D1 template. */
export type TemplateId = 'P6' | 'P13_PAYIN_REFUND' | 'P14_REQUOTE_REPRICE' | 'P15_WRITE_OFF';

export interface Leg {
  readonly account: NovaAccountRef;
  readonly side: 'DEBIT' | 'CREDIT';
  readonly asset: LedgerAssetCode;
  readonly unit: AmountUnit;
  readonly amount: OpsAmount;
}

/** A server-side option an operator may select. Built by trusted code when the case opens, never by an operator. */
export type CaseOption =
  | {
      readonly action: 'REQUOTE';
      readonly optionId: string;
      readonly unit: AmountUnit;
      readonly asset: LedgerAssetCode;
      readonly reserved: OpsAmount;
      readonly requoted: OpsAmount;
      readonly legs: readonly Leg[];
    }
  | { readonly action: 'ACCEPT_WITH_CONSENT'; readonly optionId: string; readonly unit: AmountUnit; readonly acceptedAmount: OpsAmount }
  | { readonly action: 'REFUND'; readonly optionId: string; readonly template: 'P6' | 'P13_PAYIN_REFUND'; readonly legs: readonly Leg[] }
  | { readonly action: 'RETRY_AS_NEW_PAYMENT'; readonly optionId: string }
  | {
      readonly action: 'WRITE_OFF';
      readonly optionId: string;
      readonly unit: AmountUnit;
      readonly asset: LedgerAssetCode;
      readonly amount: OpsAmount;
      /** Client liability or Suspense; the loss side is the configured loss account, never defaulted (D-2, D-5). */
      readonly creditAccount: NovaAccountRef;
    }
  | { readonly action: 'RELEASE_QUARANTINE'; readonly optionId: string }
  | { readonly action: 'UNPAUSE'; readonly optionId: string };

export type OptionRecord = CaseOption & { readonly digest: string };

/** Under/overpayment amounts, recorded by the server from the confirmed pay-in (D-3). */
export interface CaseAmounts {
  readonly unit: AmountUnit;
  readonly expected: OpsAmount;
  readonly confirmed: OpsAmount;
}

export interface PendingDecision {
  readonly decisionId: string;
  readonly consentConsumed: boolean;
}

export interface CaseOutcome {
  readonly decisionId: string;
  readonly action: OpAction;
  readonly optionId: string;
  readonly journalRef: string | null;
  readonly newPaymentId: string | null;
  /** ACCEPT_WITH_CONSENT: the server-side amount the journey now applies. */
  readonly acceptedAmount: OpsAmount | null;
  readonly closedAt: string;
}

export interface CaseRecord {
  readonly caseId: string;
  readonly kind: CaseKind;
  readonly reason: string;
  readonly subject: string;
  readonly paymentId: PaymentId;
  readonly clientUid: string;
  readonly amounts: CaseAmounts | null;
  readonly options: readonly OptionRecord[];
  readonly evidenceRefs: readonly string[];
  readonly openedAt: string;
  readonly status: 'OPEN' | 'CLOSED';
  /** Compare-and-set version, starting at 1n. */
  readonly version: bigint;
  readonly inputDigest: string;
  readonly pending: PendingDecision | null;
  readonly outcome: CaseOutcome | null;
}

export type NotSentProof = 'APPROVER_DENIAL' | 'ABORT_ACCEPTED' | 'NONCE_CONSUMED_ELSEWHERE' | 'NONCE_RESOLVED' | 'RECEIPT_STATUS_0_BOTH_SOURCES';

/** D-6: exactly the D1 §8.4 check 3 proofs. An `externalId` lookup that finds nothing is NOT one (F-6, Q-N21). */
export const NOT_SENT_PROOFS: readonly string[] = [
  'APPROVER_DENIAL',
  'ABORT_ACCEPTED',
  'NONCE_CONSUMED_ELSEWHERE',
  'NONCE_RESOLVED',
  'RECEIPT_STATUS_0_BOTH_SOURCES',
];

const REF_RE = /^\S{1,255}$/;

export function isRef(s: string): boolean {
  return typeof s === 'string' && REF_RE.test(s);
}

/** Deterministic case id (§10.2 style): one case per (kind, subject). */
export function deriveCaseId(kind: CaseKind, subject: string): string {
  return `case-${lpDigestHex(['ops-case', kind, subject]).slice(0, 32)}`;
}

/** Deterministic decision id: one decision per (case, action, option). */
export function deriveDecisionId(caseId: string, action: OpAction, optionId: string): string {
  return `dec-${lpDigestHex(['ops-decision', caseId, action, optionId]).slice(0, 32)}`;
}

function unitOk(unit: AmountUnit): boolean {
  return unit === 'CBS_MINOR' || unit === 'USDC_UNITS';
}

/** True for a positive bigint; CBS minor units are also bounded by CBS_MINOR_MAX (U1). */
export function amountOk(unit: AmountUnit, a: bigint): boolean {
  return typeof a === 'bigint' && a > 0n && (unit === 'USDC_UNITS' || a <= CBS_MINOR_MAX);
}

/** Null when the legs are valid, balanced, and in one asset and unit; else a detail string. */
export function legsProblem(legs: readonly Leg[], asset: LedgerAssetCode | null, unit: AmountUnit | null): string | null {
  if (legs.length < 2) return 'at least two legs';
  let wantAsset = asset;
  let wantUnit = unit;
  let debits = 0n;
  let credits = 0n;
  for (const l of legs) {
    if (!isRef(l.account) || !isRef(l.asset)) return 'leg account or asset malformed';
    if (l.side !== 'DEBIT' && l.side !== 'CREDIT') return 'leg side malformed';
    wantAsset ??= l.asset;
    wantUnit ??= l.unit;
    if (l.asset !== wantAsset || l.unit !== wantUnit) return 'legs mix assets or units';
    if (!unitOk(l.unit) || !amountOk(l.unit, l.amount)) return 'leg amount must be a positive bigint';
    if (l.side === 'DEBIT') debits += l.amount;
    else credits += l.amount;
  }
  return debits === credits ? null : 'legs are unbalanced';
}

/** Total of the debit legs (equals the credit total on valid legs). */
export function debitTotal(legs: readonly Leg[]): bigint {
  let t = 0n;
  for (const l of legs) if (l.side === 'DEBIT') t += l.amount;
  return t;
}

/** Null when the option is valid; else a detail string. */
export function optionProblem(o: CaseOption): string | null {
  if (!isRef(o.optionId)) return 'optionId malformed';
  switch (o.action) {
    case 'REQUOTE': {
      if (!unitOk(o.unit) || !amountOk(o.unit, o.reserved) || !amountOk(o.unit, o.requoted)) return 'REQUOTE amounts must be positive bigints';
      if (o.requoted > o.reserved) return 'REQUOTE_EXCEEDS_RESERVATION';
      const p = legsProblem(o.legs, o.asset, o.unit);
      return p === null ? null : `P14 ${p}`;
    }
    case 'ACCEPT_WITH_CONSENT':
      return unitOk(o.unit) && amountOk(o.unit, o.acceptedAmount) ? null : 'acceptedAmount must be a positive bigint';
    case 'REFUND': {
      if (o.template !== 'P6' && o.template !== 'P13_PAYIN_REFUND') return 'REFUND template must be P6 or P13_PAYIN_REFUND';
      const p = legsProblem(o.legs, null, null);
      return p === null ? null : `${o.template} ${p}`;
    }
    case 'WRITE_OFF':
      if (!unitOk(o.unit) || !amountOk(o.unit, o.amount)) return 'WRITE_OFF amount must be a positive bigint';
      return isRef(o.creditAccount) && isRef(o.asset) ? null : 'WRITE_OFF accounts malformed';
    default:
      return null;
  }
}

function legFields(legs: readonly Leg[]): string[] {
  return legs.flatMap((l) => [l.account, l.side, l.asset, l.unit, l.amount.toString(10)]);
}

/** Digest of the exact option (what a consent binds to): action, template, amounts, legs and accounts. */
export function optionDigest(o: CaseOption): string {
  const head = ['ops-option', o.optionId, o.action];
  switch (o.action) {
    case 'REQUOTE':
      return lpDigestHex([...head, o.unit, o.asset, o.reserved.toString(10), o.requoted.toString(10), ...legFields(o.legs)]);
    case 'ACCEPT_WITH_CONSENT':
      return lpDigestHex([...head, o.unit, o.acceptedAmount.toString(10)]);
    case 'REFUND':
      return lpDigestHex([...head, o.template, ...legFields(o.legs)]);
    case 'WRITE_OFF':
      return lpDigestHex([...head, o.unit, o.asset, o.amount.toString(10), o.creditAccount]);
    default:
      return lpDigestHex(head);
  }
}
