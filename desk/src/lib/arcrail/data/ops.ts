import type { CaseKindRow } from './types'

// src/ops/types.ts · design delta 1 (D-2/D-6)
export const CASE_KINDS: CaseKindRow[] = [
  {
    kind: 'QUARANTINE', reasons: ['SIGNAL_CONFLICT', 'UNKNOWN_EVENT', 'INVARIANT_FAILED', 'CONSENT_MISSING', 'AUTHENTICITY_FAILED', 'BOOKED_ENTRY_MISMATCH', 'SUB_UNIT_REMAINDER'],
    actions: ['RELEASE_QUARANTINE', 'REFUND', 'WRITE_OFF'], note: 'One item quarantined — an ILLEGAL transition, invariant breach or authenticity failure',
  },
  {
    kind: 'PAUSE', reasons: ['RAIL_DISAGREEMENT', 'RECON_DRIFT', 'INDEXER_STALL', 'MONITOR_NOT_ALL_CLEAR'],
    actions: ['UNPAUSE'], note: 'Whole rail paused — fail closed; unpause needs two distinct humans',
  },
  {
    kind: 'REQUOTE', reasons: ['RATE_EXPIRED', 'RATE_CHANGED'],
    actions: ['REQUOTE', 'REFUND', 'WRITE_OFF'], note: 'Quote no longer honourable at the locked rate',
  },
  {
    kind: 'UNMATCHED_FILL', reasons: ['FILL_AFTER_EXPIRY', 'FILL_MISPOSTED', 'FILL_TERMS_MISMATCH'],
    actions: ['ADOPT_FILL', 'REVERSE_FILL'], note: 'Delta D-1: a fill arrived that matches no live pricing code; closes by ADOPT_FILL or REVERSE_FILL (P12) and blocks REQUOTE',
  },
  { kind: 'FILL_TIMEOUT', reasons: ['NO_FILL_BY_TIMEOUT'], actions: ['REQUOTE', 'REFUND', 'WRITE_OFF'], note: 'Pricing code expired with no fill' },
  {
    kind: 'CONSENT_MISSING', reasons: ['NO_CONSENT_RECORD', 'CONSENT_BINDING_MISMATCH', 'CONSENT_ALREADY_USED'],
    actions: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'], note: 'Consent port could not produce a bound record',
  },
  { kind: 'HISTORY_WRITE_FAILED', reasons: ['HISTORY_APPEND_FAILING_PAST_AGE'], actions: ['CLOSE_HISTORY_GAP'], note: 'Client history append failing past its maximum age (D-4)' },
  { kind: 'UNDERPAYMENT', reasons: ['CONFIRMED_BELOW_EXPECTED'], actions: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'], note: 'D1 name: PAYIN_MISMATCH' },
  { kind: 'OVERPAYMENT', reasons: ['CONFIRMED_ABOVE_EXPECTED'], actions: ['ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'], note: 'D1 name: PAYIN_MISMATCH' },
  { kind: 'LATE_PAYIN', reasons: ['PAYIN_AFTER_QUOTE_EXPIRY', 'PAYIN_AFTER_PAYMENT_CLOSED'], actions: ['REQUOTE', 'ACCEPT_WITH_CONSENT', 'REFUND', 'WRITE_OFF'], note: 'D1 name: PAYIN_MISMATCH' },
  { kind: 'STUCK_PAYOUT', reasons: ['NO_TERMINAL_STATE', 'PARTNER_TIMEOUT'], actions: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'], note: 'D1 name: STUCK' },
  { kind: 'RETURNED_PAYOUT', reasons: ['PARTNER_RETURNED', 'BENEFICIARY_REJECTED'], actions: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'], note: 'D1 name: PARTNER_RETURN — F-17 partner failure after Arc leg confirmed' },
  { kind: 'UNRESOLVED_SUBMIT', reasons: ['MARKER_SET_NO_EXTERNAL_REF', 'DFNS_TIMEOUT', 'DFNS_5XX', 'HASHLESS_FAILED'], actions: ['RETRY_AS_NEW_PAYMENT', 'REFUND', 'WRITE_OFF'], note: 'F-6: crash/timeout after markSubmit — resolve only via externalId' },
]

export const OP_ACTIONS = [
  { id: 'REQUOTE', note: 'Issue a new pricing code; moves exactly the requoted amount (P14); consent-bound' },
  { id: 'ACCEPT_WITH_CONSENT', note: 'Accept a mismatched pay-in against a recorded consent; consent-bound' },
  { id: 'REFUND', note: 'Release the reservation to the payer (P6/P13); only after a D-6 not-sent proof' },
  { id: 'RETRY_AS_NEW_PAYMENT', note: 'A retry is a new payment — never a resubmission; only after a D-6 proof' },
  { id: 'WRITE_OFF', note: 'Recognise a loss (P15); loss account is configured, never defaulted; capped per payment' },
  { id: 'RELEASE_QUARANTINE', note: 'Lift a quarantine after the cause is resolved (D1: LIFT_QUARANTINE)' },
  { id: 'UNPAUSE', note: 'Lift a whole-rail pause — requires two distinct authenticated humans (MC-19)' },
  { id: 'ADOPT_FILL', note: 'Adopt an unmatched conversion fill into the books; consent-bound' },
  { id: 'REVERSE_FILL', note: 'Reverse an unmatched fill by unwinding the booked conversion exactly (P12); consent-bound' },
  { id: 'CLOSE_HISTORY_GAP', note: 'Close a client-history gap with a documented correction entry' },
]

export const NOT_SENT_PROOFS = [
  { id: 'APPROVER_DENIAL', note: 'Proof (a1): DFNS shows the transfer was Rejected by policy, never signed' },
  { id: 'ABORT_ACCEPTED', note: 'Proof (a2): DFNS accepted an operator abort while unsigned' },
  { id: 'NONCE_CONSUMED_ELSEWHERE', note: 'Proof: the nonce was consumed by a different, recorded transaction' },
  { id: 'NONCE_RESOLVED', note: 'Proof (c): reserved-nonce resolution after a hash-less Failed (F-3b)' },
  { id: 'RECEIPT_STATUS_0_BOTH_SOURCES', note: 'Proof (b): a status-0 receipt seen by both read sources' },
]

export const OPS_RULES = [
  'Options are server-side only: built by trusted code when the case opens. Operators never type an amount (CLAUDE.md "Binding").',
  'Money-moving actions require two distinct authenticated humans (maker–checker).',
  'Consent-bound actions (REQUOTE, ACCEPT_WITH_CONSENT, ADOPT_FILL) bind the consent to an optionDigest: amounts, quote id, rate ratio, expiry, settlement-instruction digest.',
  'Refunds and retries are allowed only after a D-6 not-sent proof. An externalId lookup finding nothing is NOT a proof.',
  'P6 is posted once per payment; refunds and write-offs are capped per payment.',
  'A ledger read-back per account must match before a case closes.',
  'Every case opening and every action — applied or refused — lands in the append-only hash-chained audit log.',
  'Deterministic ids: case-<digest32> / dec-<digest32>.',
  'Balanced single-asset single-unit legs are validated by legsProblem before any posting.',
]

export const D1_NAME_MAP = [
  { formal: 'STUCK_PAYOUT', d1: 'STUCK' },
  { formal: 'RETURNED_PAYOUT', d1: 'PARTNER_RETURN' },
  { formal: 'UNDERPAYMENT / OVERPAYMENT / LATE_PAYIN', d1: 'PAYIN_MISMATCH' },
  { formal: 'RELEASE_QUARANTINE', d1: 'LIFT_QUARANTINE' },
]
