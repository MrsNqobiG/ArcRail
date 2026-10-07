/**
 * OPS: operator case queue, shapes and the pure rules (design delta 1, D-2 and D-6).
 *
 * Every case has a closed reason code. Operators choose among SERVER-SIDE
 * options; they never type an amount (CLAUDE.md "Binding"). Money-moving
 * actions need two distinct authenticated humans, and a client consent where
 * the delta says so (D-2, D-3). The assumptions about Nova (DA-5, DA-6, DQ-4
 * and CF-31) are in the design delta's assumption table
 * (docs/NOVA_ARC_DESIGN_DELTA-1.md, "Assumptions") and in D1; none is built on
 * here. Kind and action names that differ from D1 (A-2) are mapped in
 * `D1_NAME_OF`; Nova's adapter translates at the boundary.
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
  | 'PAUSE'
  | 'REQUOTE'
  | 'UNMATCHED_FILL'
  | 'FILL_TIMEOUT'
  | 'CONSENT_MISSING'
  | 'HISTORY_WRITE_FAILED'
  | 'UNDERPAYMENT'
  | 'OVERPAYMENT'
  | 'LATE_PAYIN'
  | 'STUCK_PAYOUT'
  | 'RETURNED_PAYOUT'
  | 'UNRESOLVED_SUBMIT';

export const CASE_KINDS: readonly CaseKind[] = [
  'QUARANTINE',
  'PAUSE',
  'REQUOTE',
  'UNMATCHED_FILL',
  'FILL_TIMEOUT',
  'CONSENT_MISSING',
  'HISTORY_WRITE_FAILED',
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
  | 'UNPAUSE'
  | 'ADOPT_FILL'
  | 'REVERSE_FILL'
  | 'CLOSE_HISTORY_GAP';

export const OP_ACTIONS: readonly OpAction[] = [
  'REQUOTE',
  'ACCEPT_WITH_CONSENT',
  'REFUND',
  'RETRY_AS_NEW_PAYMENT',
  'WRITE_OFF',
  'RELEASE_QUARANTINE',
  'UNPAUSE',
  'ADOPT_FILL',
  'REVERSE_FILL',
  'CLOSE_HISTORY_GAP',
];

/**
 * Names that differ from D1 and its amendments A-2 (kept here because other
 * units already build cases with the OPS names). Nova's adapter maps them.
 */
export const D1_NAME_OF: Readonly<Record<string, string>> = {
  STUCK_PAYOUT: 'STUCK',
  RETURNED_PAYOUT: 'PARTNER_RETURN',
  UNDERPAYMENT: 'PAYIN_MISMATCH',
  OVERPAYMENT: 'PAYIN_MISMATCH',
  LATE_PAYIN: 'PAYIN_MISMATCH',
  RELEASE_QUARANTINE: 'LIFT_QUARANTINE',
};

/** Closed reason codes per kind. A case with any other reason is refused (fail closed). */
export const REASONS: Readonly<Record<CaseKind, readonly string[]>> = {
  QUARANTINE: ['SIGNAL_CONFLICT', 'UNKNOWN_EVENT', 'INVARIANT_FAILED', 'CONSENT_MISSING', 'AUTHENTICITY_FAILED', 'BOOKED_ENTRY_MISMATCH', 'SUB_UNIT_REMAINDER'],
  PAUSE: ['RAIL_DISAGREEMENT', 'RECON_DRIFT', 'INDEXER_STALL', 'MONITOR_NOT_ALL_CLEAR'],
  REQUOTE: ['RATE_EXPIRED', 'RATE_CHANGED'],
  UNMATCHED_FILL: ['FILL_AFTER_EXPIRY', 'FILL_MISPOSTED', 'FILL_TERMS_MISMATCH'],
  FILL_TIMEOUT: ['NO_FILL_BY_TIMEOUT'],
  CONSENT_MISSING: ['NO_CONSENT_RECORD', 'CONSENT_BINDING_MISMATCH', 'CONSENT_ALREADY_USED'],
  HISTORY_WRITE_FAILED: ['HISTORY_APPEND_FAILING_PAST_AGE'],
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
  PAUSE: ['UNPAUSE'],
  REQUOTE: ['REQUOTE', 'REFUND', 'WRITE_OFF'],
  UNMATCHED_FILL: ['ADOPT_FILL', 'REVERSE_FILL'],
  FILL_TIMEOUT: ['REQUOTE', 'REFUND', 'WRITE_OFF'],
  CONSENT_MISSING: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
  HISTORY_WRITE_FAILED: ['CLOSE_HISTORY_GAP'],
  UNDERPAYMENT: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
  OVERPAYMENT: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
  LATE_PAYIN: ['REQUOTE', 'ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'],
  STUCK_PAYOUT: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'],
  RETURNED_PAYOUT: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'],
  UNRESOLVED_SUBMIT: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'],
};

/** Actions that need a consent bound to the exact option (D-2, D-3). */
export const CONSENT_ACTIONS: readonly OpAction[] = ['REQUOTE', 'ACCEPT_WITH_CONSENT', 'ADOPT_FILL'];

/** Posting templates the queue sends to the ledger (D-2 "Posting templates"). P6 is the existing D1 template. */
export type TemplateId = 'P6' | 'P12_FILL_REVERSAL' | 'P13_PAYIN_REFUND' | 'P14_REQUOTE_REPRICE' | 'P15_WRITE_OFF';

export interface Leg {
  readonly account: NovaAccountRef;
  readonly side: 'DEBIT' | 'CREDIT';
  readonly asset: LedgerAssetCode;
  readonly unit: AmountUnit;
  readonly amount: OpsAmount;
}

/** A server-side option an operator may select. Built by trusted code when the case opens, never by an operator. */
/**
 * What a consent covers besides the amount (D-3): the new code or quote and the
 * settlement instructions, as references and a digest the journey computes.
 */
export interface QuoteTerms {
  readonly quoteId: string;
  /** Rate as an integer ratio; never a float. */
  readonly rateNum: bigint;
  readonly rateDen: bigint;
  /** ISO-8601 instant the quote expires. */
  readonly expiresAt: string;
  /** Digest of the settlement instructions the client agrees to (answer 35). */
  readonly settlementDigest: string;
}

export type CaseOption =
  | ({
      readonly action: 'REQUOTE';
      readonly optionId: string;
      readonly unit: AmountUnit;
      readonly asset: LedgerAssetCode;
      readonly reserved: OpsAmount;
      readonly requoted: OpsAmount;
      readonly legs: readonly Leg[];
    } & QuoteTerms)
  | {
      readonly action: 'ACCEPT_WITH_CONSENT';
      readonly optionId: string;
      readonly unit: AmountUnit;
      readonly acceptedAmount: OpsAmount;
      /** The quote the accepted amount applies to, or null when it applies to the existing one. */
      readonly quoteId: string | null;
      readonly settlementDigest: string;
    }
  | ({
      /** UNMATCHED_FILL ADOPT (D-1): the new quote is built from the already booked fill; no new code is requested. */
      readonly action: 'ADOPT_FILL';
      readonly optionId: string;
      readonly bookedEntryRef: string;
      readonly unit: AmountUnit;
      readonly asset: LedgerAssetCode;
      readonly adoptedAmount: OpsAmount;
    } & QuoteTerms)
  | {
      /** UNMATCHED_FILL REVERSE (D-1): P12 unwinds the booked conversion exactly. */
      readonly action: 'REVERSE_FILL';
      readonly optionId: string;
      readonly bookedEntryRef: string;
      readonly legs: readonly Leg[];
    }
  | { readonly action: 'CLOSE_HISTORY_GAP'; readonly optionId: string }
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

/** What the server says a case may move at most (refund and write-off bounds). */
export interface CaseExposure {
  readonly unit: AmountUnit;
  readonly amount: OpsAmount;
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
  /** REQUOTE, ADOPT_FILL and ACCEPT_WITH_CONSENT: the quote the journey now uses. */
  readonly quoteId: string | null;
  /** ADOPT_FILL and REVERSE_FILL: the booked fill entry. */
  readonly bookedEntryRef: string | null;
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
  /** UNMATCHED_FILL only: the already booked fill entry. */
  readonly bookedEntryRef: string | null;
  readonly exposure: CaseExposure | null;
  /** Digests of options whose consent was already consumed on this case (a consent is never lost to a later refusal). */
  readonly consumedDigests: readonly string[];
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

export function unitOk(unit: AmountUnit): boolean {
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

const DIGEST_RE = /^[0-9a-f]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

/** Null when the quote terms are well formed; else a detail string. */
export function termsProblem(t: QuoteTerms): string | null {
  if (!isRef(t.quoteId)) return 'quoteId malformed';
  if (typeof t.rateNum !== 'bigint' || typeof t.rateDen !== 'bigint' || t.rateNum <= 0n || t.rateDen <= 0n) return 'rate must be a positive bigint ratio';
  if (typeof t.expiresAt !== 'string' || !ISO_RE.test(t.expiresAt)) return 'expiresAt must be an ISO-8601 UTC instant';
  return typeof t.settlementDigest === 'string' && DIGEST_RE.test(t.settlementDigest) ? null : 'settlementDigest must be a 64-hex digest';
}

/** Null when the option is valid; else a detail string. */
export function optionProblem(o: CaseOption): string | null {
  if (!isRef(o.optionId)) return 'optionId malformed';
  switch (o.action) {
    case 'REQUOTE': {
      if (!unitOk(o.unit) || !amountOk(o.unit, o.reserved) || !amountOk(o.unit, o.requoted)) return 'REQUOTE amounts must be positive bigints';
      if (o.requoted > o.reserved) return 'REQUOTE_EXCEEDS_RESERVATION';
      const t = termsProblem(o);
      if (t !== null) return `REQUOTE ${t}`;
      const p = legsProblem(o.legs, o.asset, o.unit);
      if (p !== null) return `P14 ${p}`;
      // The reprice moves exactly the requoted amount from the old reservation to the new one.
      return debitTotal(o.legs) === o.requoted ? null : 'P14 legs must move exactly the requoted amount';
    }
    case 'ACCEPT_WITH_CONSENT':
      if (!unitOk(o.unit) || !amountOk(o.unit, o.acceptedAmount)) return 'acceptedAmount must be a positive bigint';
      if (o.quoteId !== null && !isRef(o.quoteId)) return 'quoteId malformed';
      return typeof o.settlementDigest === 'string' && DIGEST_RE.test(o.settlementDigest) ? null : 'settlementDigest must be a 64-hex digest';
    case 'ADOPT_FILL': {
      if (!isRef(o.bookedEntryRef)) return 'bookedEntryRef malformed';
      if (!unitOk(o.unit) || !amountOk(o.unit, o.adoptedAmount) || !isRef(o.asset)) return 'ADOPT_FILL amount must be a positive bigint';
      const t = termsProblem(o);
      return t === null ? null : `ADOPT_FILL ${t}`;
    }
    case 'REVERSE_FILL': {
      if (!isRef(o.bookedEntryRef)) return 'bookedEntryRef malformed';
      const p = legsProblem(o.legs, null, null);
      return p === null ? null : `P12 ${p}`;
    }
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

/** One canonical string per leg; the ledger read-back is compared to the request as a sorted list of these. */
export function legKeys(legs: readonly Leg[]): string[] {
  return legs.map((l) => `${l.account}|${l.side}|${l.asset}|${l.unit}|${l.amount.toString(10)}`).sort();
}

function termFields(o: QuoteTerms): string[] {
  return [o.quoteId, o.rateNum.toString(10), o.rateDen.toString(10), o.expiresAt, o.settlementDigest];
}

/**
 * Digest of the exact option (what a consent binds to): action, template,
 * amounts, legs, accounts, and for a requote or accepted amount the new quote
 * (id, rate, expiry) and the settlement instructions (D-3).
 */
export function optionDigest(o: CaseOption): string {
  const head = ['ops-option', o.optionId, o.action];
  switch (o.action) {
    case 'REQUOTE':
      return lpDigestHex([...head, o.unit, o.asset, o.reserved.toString(10), o.requoted.toString(10), ...termFields(o), ...legFields(o.legs)]);
    case 'ACCEPT_WITH_CONSENT':
      return lpDigestHex([...head, o.unit, o.acceptedAmount.toString(10), o.quoteId ?? '-', o.settlementDigest]);
    case 'ADOPT_FILL':
      return lpDigestHex([...head, o.bookedEntryRef, o.unit, o.asset, o.adoptedAmount.toString(10), ...termFields(o)]);
    case 'REVERSE_FILL':
      return lpDigestHex([...head, o.bookedEntryRef, ...legFields(o.legs)]);
    case 'REFUND':
      return lpDigestHex([...head, o.template, ...legFields(o.legs)]);
    case 'WRITE_OFF':
      return lpDigestHex([...head, o.unit, o.asset, o.amount.toString(10), o.creditAccount]);
    default:
      return lpDigestHex(head);
  }
}
