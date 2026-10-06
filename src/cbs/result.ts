/**
 * CBS port: result model (CONTRACT §1.4, §1.5). Types only.
 */

/** CONTRACT §1.4 REJECTED codes (closed list). An unknown code is treated as AMBIGUOUS. */
export const REJECTED_CODES = Object.freeze([
  'INVALID',
  'UNIT_MISMATCH',
  'CHAIN_NOT_ENABLED',
  'UNKNOWN_ACCOUNT',
  'ACCOUNT_BLOCKED',
  'ACCOUNT_CLOSED',
  'INSUFFICIENT_FUNDS',
  'UNBALANCED',
  'ZERO_AMOUNT',
  'NOT_PERMITTED',
  'HOLD_NOT_FOUND',
  'HOLD_STATE',
  'BINDING_MISMATCH',
] as const);

export type RejectedCode = (typeof REJECTED_CODES)[number];

/** Every adapter→CBS call returns exactly one of these (CONTRACT §1.4). */
export type CbsResult<T> =
  | { readonly kind: 'OK'; readonly value: T }
  | { readonly kind: 'REJECTED'; readonly code: RejectedCode }
  | { readonly kind: 'CONFLICT'; readonly key: string }
  | { readonly kind: 'AMBIGUOUS'; readonly detail: string };

/** Output of the AMBIGUOUS resolution procedure (CONTRACT §1.4). */
export type ResolvedResult<T> =
  | Exclude<CbsResult<T>, { readonly kind: 'AMBIGUOUS' }>
  | { readonly kind: 'UNRESOLVED' };

/** Operation classes (CONTRACT §1.5). */
export type OperationClass = 'DECISION' | 'RELEASE' | 'FACT' | 'DECISION_THEN_FACT' | 'NOTIFICATION';
