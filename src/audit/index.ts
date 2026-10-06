/**
 * U13 Audit and observability. SKELETON: interfaces and stubs only.
 *
 * Append-only, hash-chained audit log of every decision; no PII in any
 * record, trace, metric or log (KICKOFF U13). `callId` joins to the CBS audit
 * trail (CONTRACT §1.2, P8.4).
 */
export interface AuditRecord {
  readonly seq: bigint;
  readonly at: string;
  readonly actor: string;
  readonly decision: string;
  readonly subjectRef: string;
  readonly callId?: string;
  readonly prevHash: string;
  readonly hash: string;
}

export interface AuditLog {
  append(entry: Omit<AuditRecord, 'seq' | 'prevHash' | 'hash'>): Promise<AuditRecord>;
  verifyChain(): Promise<boolean>;
}

export function createAuditLog(): AuditLog {
  throw new Error('not implemented: U13');
}
