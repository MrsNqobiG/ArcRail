/**
 * OPS ports (types only). Nova implements them; the package owns no ledger,
 * case store, consent store, payment store or audit store (D-2, "extend, never
 * parallel"). Each port has two structurally different in-memory fakes in
 * `fakes.ts`, both passing one contract suite (test/unit/ops-ports.test.ts).
 * Every call returns a PortResult and never throws for a business outcome.
 */

import type { IdempotencyKey, PortResult } from '../nova-ports/ids.js';
import type { CaseRecord, Leg, NotSentProof, TemplateId } from './types.js';
import type { AuditEntry } from './audit.js';

/** Case store with compare-and-set on `version`. A first write has `expectedVersion` null. */
export interface CaseStorePort {
  get(caseId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND'>>;
  put(rec: CaseRecord, expectedVersion: bigint | null): Promise<PortResult<CaseRecord, 'VERSION_CONFLICT'>>;
  listOpen(): Promise<PortResult<readonly CaseRecord[], never>>;
}

/** What a consent is bound to (D-3): client, payment, case and the digest of the exact option. */
export interface ConsentBinding {
  readonly clientUid: string;
  readonly paymentId: string;
  readonly caseId: string | null;
  readonly digest: string;
}

export type ConsentCode = 'NOT_FOUND' | 'WRONG_CLIENT' | 'ALREADY_USED' | 'BINDING_MISMATCH';

/** Client consent records live in Nova (DA-6; where is open question DQ-4). Single use. Referenced by id only. */
export interface ConsentPort {
  consume(consentRef: string, binding: ConsentBinding): Promise<PortResult<void, ConsentCode>>;
}

export interface OpsJournal {
  readonly template: TemplateId;
  readonly legs: readonly Leg[];
}

/** The ledger's own read-back of what it booked. The queue never trusts its own request totals. */
export interface PostedJournal {
  readonly journalRef: string;
  readonly debits: bigint;
  readonly credits: bigint;
}

export type OpsLedgerCode = 'KEY_CONFLICT' | 'INVALID_JOURNAL';

export interface OpsLedgerPort {
  /** Idempotent on the key. The same key with a different journal is KEY_CONFLICT. */
  post(key: IdempotencyKey, journal: OpsJournal): Promise<PortResult<PostedJournal, OpsLedgerCode>>;
}

/** Nova staff authentication [A-35]. Null for an unknown id or a service account; otherwise the canonical staff id. */
export interface StaffDirectoryPort {
  canonical(raw: string): Promise<string | null>;
}

export type ArcLegState = 'NONE' | 'UNRESOLVED' | 'SENT' | 'PROVEN_NOT_SENT';

/** Server-side facts about the payment (never operator input). */
export interface PaymentFacts {
  readonly terminal: boolean;
  readonly p6Posted: boolean;
  readonly arcLeg: ArcLegState;
  /** Set when `arcLeg` is PROVEN_NOT_SENT. */
  readonly proof: NotSentProof | null;
}

export type RetryCode = 'NOT_FOUND' | 'KEY_CONFLICT';

export interface PaymentFactsPort {
  facts(paymentId: string): Promise<PortResult<PaymentFacts, 'NOT_FOUND'>>;
  /**
   * Creates the one retry payment, linked to the original (answer 28). The key is
   * `retry:<originalPaymentId>`; a repeat returns the first retry (replayed: true).
   */
  createRetry(key: IdempotencyKey, originalPaymentId: string): Promise<PortResult<{ readonly newPaymentId: string }, RetryCode>>;
}

export type RailControlKind = 'RELEASE_QUARANTINE' | 'UNPAUSE';

/** The D1 two-person lifts, applied by Nova's own store. Idempotent on `decisionId`. */
export interface RailControlPort {
  apply(kind: RailControlKind, subject: string, decisionId: string, approvers: readonly [string, string]): Promise<PortResult<void, 'NOT_FOUND'>>;
}

/** Append-only. There is no update and no delete. */
export interface AuditStorePort {
  /** Appends exactly entry `seq`. A `seq` that is not the next one is SEQ_CONFLICT. */
  append(entry: AuditEntry): Promise<PortResult<void, 'SEQ_CONFLICT'>>;
  tail(): Promise<PortResult<AuditEntry | null, never>>;
  all(): Promise<PortResult<readonly AuditEntry[], never>>;
}
