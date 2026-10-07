/**
 * OPS in-memory fakes: two structurally different ones per port, passing one
 * contract suite (test/unit/ops-ports.test.ts). Tests and demos only. Each
 * seeding helper is plain data; nothing here reads a secret or a network.
 */

import { ambiguous, ok, rejected } from '../nova-ports/ids.js';
import type { IdempotencyKey, PortResult } from '../nova-ports/ids.js';
import { lpDigestHex } from '../nova-ports/ids.js';
import type { AuditEntry } from './audit.js';
import type {
  AuditStorePort,
  CaseStorePort,
  ConsentBinding,
  JournalGuard,
  ConsentCode,
  ConsentPort,
  OpsJournal,
  OpsLedgerCode,
  OpsLedgerPort,
  PaymentFacts,
  PaymentFactsPort,
  PostedJournal,
  RailControlKind,
  RailControlPort,
  RetryCode,
  StaffDirectoryPort,
} from './ports.js';
import { debitTotal } from './types.js';
import type { CaseRecord } from './types.js';

// ---- case store ----------------------------------------------------------------------------

/** Fake A: one mutable map. */
export class MapCaseStore implements CaseStorePort {
  private readonly m = new Map<string, CaseRecord>();
  async get(caseId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND'>> {
    const r = this.m.get(caseId);
    return r === undefined ? rejected('NOT_FOUND', caseId) : ok(r, false);
  }
  async put(rec: CaseRecord, expectedVersion: bigint | null): Promise<PortResult<CaseRecord, 'VERSION_CONFLICT'>> {
    const cur = this.m.get(rec.caseId);
    if ((cur?.version ?? null) !== expectedVersion) return rejected('VERSION_CONFLICT', rec.caseId);
    this.m.set(rec.caseId, rec);
    return ok(rec, false);
  }
  async listOpen(): Promise<PortResult<readonly CaseRecord[], never>> {
    return ok([...this.m.values()].filter((r) => r.status === 'OPEN'), false);
  }
  async listByPayment(paymentId: string): Promise<PortResult<readonly CaseRecord[], never>> {
    return ok([...this.m.values()].filter((r) => r.paymentId === paymentId), false);
  }
}

/** Fake B: an append-only log of versions; reads fold the log. */
export class LogCaseStore implements CaseStorePort {
  readonly log: CaseRecord[] = [];
  private latest(caseId: string): CaseRecord | undefined {
    return this.log.filter((r) => r.caseId === caseId).at(-1);
  }
  async get(caseId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND'>> {
    const r = this.latest(caseId);
    return r === undefined ? rejected('NOT_FOUND', caseId) : ok(r, false);
  }
  async put(rec: CaseRecord, expectedVersion: bigint | null): Promise<PortResult<CaseRecord, 'VERSION_CONFLICT'>> {
    if ((this.latest(rec.caseId)?.version ?? null) !== expectedVersion) return rejected('VERSION_CONFLICT', rec.caseId);
    this.log.push(rec);
    return ok(rec, false);
  }
  async listOpen(): Promise<PortResult<readonly CaseRecord[], never>> {
    const ids = [...new Set(this.log.map((r) => r.caseId))];
    return ok(ids.map((id) => this.latest(id) as CaseRecord).filter((r) => r.status === 'OPEN'), false);
  }
  async listByPayment(paymentId: string): Promise<PortResult<readonly CaseRecord[], never>> {
    const ids = [...new Set(this.log.map((r) => r.caseId))];
    return ok(ids.map((id) => this.latest(id) as CaseRecord).filter((r) => r.paymentId === paymentId), false);
  }
}

// ---- consent -------------------------------------------------------------------------------

function checkBinding(rec: ConsentBinding, b: ConsentBinding): ConsentCode | null {
  if (rec.clientUid !== b.clientUid) return 'WRONG_CLIENT';
  return rec.paymentId === b.paymentId && rec.caseId === b.caseId && rec.digest === b.digest ? null : 'BINDING_MISMATCH';
}

/** Fake A: a map with a mutable used-flag. */
export class FlagConsentStore implements ConsentPort {
  private readonly m = new Map<string, { binding: ConsentBinding; used: boolean }>();
  grant(ref: string, binding: ConsentBinding): void {
    this.m.set(ref, { binding, used: false });
  }
  async consume(consentRef: string, binding: ConsentBinding): Promise<PortResult<void, ConsentCode>> {
    const e = this.m.get(consentRef);
    if (e === undefined) return rejected('NOT_FOUND', consentRef);
    const bad = checkBinding(e.binding, binding);
    if (bad !== null) return rejected(bad, consentRef);
    if (e.used) return rejected('ALREADY_USED', consentRef);
    e.used = true;
    return ok(undefined, false);
  }
}

/** Fake B: immutable records plus a consumption log; "used" is derived by replaying the log. */
export class LogConsentStore implements ConsentPort {
  private readonly records: { ref: string; binding: ConsentBinding }[] = [];
  private readonly consumed: string[] = [];
  grant(ref: string, binding: ConsentBinding): void {
    this.records.push({ ref, binding });
  }
  async consume(consentRef: string, binding: ConsentBinding): Promise<PortResult<void, ConsentCode>> {
    const e = this.records.find((r) => r.ref === consentRef);
    if (e === undefined) return rejected('NOT_FOUND', consentRef);
    const bad = checkBinding(e.binding, binding);
    if (bad !== null) return rejected(bad, consentRef);
    if (this.consumed.includes(consentRef)) return rejected('ALREADY_USED', consentRef);
    this.consumed.push(consentRef);
    return ok(undefined, false);
  }
}

// ---- ledger --------------------------------------------------------------------------------

function journalDigest(j: OpsJournal): string {
  return lpDigestHex([
    j.template,
    j.paymentId,
    j.guard.arc,
    String(j.guard.p6Unposted),
    j.limit === null ? '-' : `${j.limit.bucket}:${j.limit.unit}:${j.limit.cap}`,
    ...j.legs.flatMap((l) => [l.account, l.side, l.asset, l.unit, l.amount.toString(10)]),
  ]);
}

function totals(j: OpsJournal): { debits: bigint; credits: bigint; lines: OpsJournal['legs'] } {
  let debits = 0n;
  let credits = 0n;
  for (const l of j.legs) {
    if (l.side === 'DEBIT') debits += l.amount;
    else credits += l.amount;
  }
  return { debits, credits, lines: j.legs.map((l) => ({ ...l })) };
}

/** What Nova's store enforces in the posting commit: the leg guard against the payment's current facts. */
async function guardProblem(facts: PaymentFactsPort | undefined, j: OpsJournal): Promise<OpsLedgerCode | null> {
  if (facts === undefined || (j.guard.arc === 'ANY' && !j.guard.p6Unposted)) return null;
  const r = await facts.facts(j.paymentId);
  if (r.kind !== 'OK') return 'LEG_GUARD';
  return guardHolds(r.value, j.guard) ? null : 'LEG_GUARD';
}

function guardHolds(f: PaymentFacts, g: JournalGuard): boolean {
  if (g.p6Unposted && f.p6Posted) return false;
  switch (g.arc) {
    case 'ANY':
      return true;
    case 'NONE':
      return f.arcLeg === 'NONE';
    case 'NOT_SENT':
      return f.arcLeg === 'NONE' || f.arcLeg === 'PROVEN_NOT_SENT';
    case 'NOT_UNRESOLVED':
      return f.arcLeg !== 'UNRESOLVED';
    default:
      return f.arcLeg === 'SENT' && f.returnClaimed;
  }
}

/** Fake A: a map keyed by idempotency key, with running per-payment totals. */
export class MapLedger implements OpsLedgerPort {
  private readonly m = new Map<string, { digest: string; posted: PostedJournal }>();
  private readonly running = new Map<string, bigint>();
  /** With a facts port, the guard is enforced at post time, as Nova's store does in the same commit. */
  constructor(private readonly facts?: PaymentFactsPort) {}
  async post(key: IdempotencyKey, journal: OpsJournal): Promise<PortResult<PostedJournal, OpsLedgerCode>> {
    const digest = journalDigest(journal);
    const e = this.m.get(key);
    if (e !== undefined) return e.digest === digest ? ok(e.posted, true) : rejected('KEY_CONFLICT', key);
    const bad = await guardProblem(this.facts, journal);
    if (bad !== null) return rejected(bad, key);
    const lim = journal.limit;
    const slot = lim === null ? '' : `${journal.paymentId}|${lim.bucket}`;
    if (lim !== null && (this.running.get(slot) ?? 0n) + debitTotal(journal.legs) > lim.cap) return rejected('LIMIT_EXCEEDED', key);
    const posted: PostedJournal = { journalRef: `jrnl-${this.m.size + 1}`, ...totals(journal) };
    this.m.set(key, { digest, posted });
    if (lim !== null) this.running.set(slot, (this.running.get(slot) ?? 0n) + debitTotal(journal.legs));
    return ok(posted, false);
  }
  get count(): number {
    return this.m.size;
  }
}

/** Fake B: an append-only journal log; a key lookup and the running totals fold the log. */
export class LogLedger implements OpsLedgerPort {
  readonly log: { key: string; digest: string; journal: OpsJournal; ref: string }[] = [];
  constructor(private readonly facts?: PaymentFactsPort) {}
  async post(key: IdempotencyKey, journal: OpsJournal): Promise<PortResult<PostedJournal, OpsLedgerCode>> {
    const digest = journalDigest(journal);
    const prior = this.log.find((e) => e.key === key);
    if (prior !== undefined) return prior.digest === digest ? ok({ journalRef: prior.ref, ...totals(prior.journal) }, true) : rejected('KEY_CONFLICT', key);
    const bad = await guardProblem(this.facts, journal);
    if (bad !== null) return rejected(bad, key);
    const lim = journal.limit;
    if (lim !== null) {
      const so = this.log
        .filter((e) => e.journal.paymentId === journal.paymentId && e.journal.limit?.bucket === lim.bucket)
        .reduce((t, e) => t + debitTotal(e.journal.legs), 0n);
      if (so + debitTotal(journal.legs) > lim.cap) return rejected('LIMIT_EXCEEDED', key);
    }
    const ref = `jrnl-${this.log.length + 1}`;
    this.log.push({ key, digest, journal, ref });
    return ok({ journalRef: ref, ...totals(journal) }, false);
  }
  get count(): number {
    return this.log.length;
  }
}

// ---- staff directory -----------------------------------------------------------------------

/** Fake A: an alias table (several spellings, one person). */
export class AliasStaffDirectory implements StaffDirectoryPort {
  constructor(private readonly aliases: Readonly<Record<string, string>>) {}
  async canonical(raw: string): Promise<string | null> {
    return this.aliases[raw] ?? null;
  }
}

/** Fake B: a rule. `staff:<name>` is staff (case-insensitive); anything else, including `svc:`, is not. */
export class RuleStaffDirectory implements StaffDirectoryPort {
  async canonical(raw: string): Promise<string | null> {
    return /^staff:[a-z0-9._-]+$/i.test(raw) ? raw.toLowerCase() : null;
  }
}

// ---- payment facts and retries ---------------------------------------------------------------

/** Fake A: maps. */
export class MapPaymentFacts implements PaymentFactsPort {
  readonly facts_ = new Map<string, PaymentFacts>();
  readonly retries = new Map<string, string>();
  set(paymentId: string, f: PaymentFacts): void {
    this.facts_.set(paymentId, f);
  }
  async facts(paymentId: string): Promise<PortResult<PaymentFacts, 'NOT_FOUND'>> {
    const f = this.facts_.get(paymentId);
    return f === undefined ? rejected('NOT_FOUND', paymentId) : ok(f, false);
  }
  async createRetry(key: IdempotencyKey, originalPaymentId: string): Promise<PortResult<{ readonly newPaymentId: string }, RetryCode>> {
    if (!this.facts_.has(originalPaymentId)) return rejected('NOT_FOUND', originalPaymentId);
    if (key !== `retry:${originalPaymentId}`) return rejected('KEY_CONFLICT', key);
    const prior = this.retries.get(key);
    if (prior !== undefined) return ok({ newPaymentId: prior }, true);
    const id = `pay-${lpDigestHex(['retry', key]).slice(0, 32)}`;
    this.retries.set(key, id);
    return ok({ newPaymentId: id }, false);
  }
}

/** Fake B: an event log; facts and retries are folded from it. */
export class LogPaymentFacts implements PaymentFactsPort {
  readonly events: ({ t: 'FACTS'; id: string; f: PaymentFacts } | { t: 'RETRY'; key: string; id: string })[] = [];
  set(paymentId: string, f: PaymentFacts): void {
    this.events.push({ t: 'FACTS', id: paymentId, f });
  }
  async facts(paymentId: string): Promise<PortResult<PaymentFacts, 'NOT_FOUND'>> {
    for (const e of [...this.events].reverse()) if (e.t === 'FACTS' && e.id === paymentId) return ok(e.f, false);
    return rejected('NOT_FOUND', paymentId);
  }
  async createRetry(key: IdempotencyKey, originalPaymentId: string): Promise<PortResult<{ readonly newPaymentId: string }, RetryCode>> {
    const known = this.events.some((e) => e.t === 'FACTS' && e.id === originalPaymentId);
    if (!known) return rejected('NOT_FOUND', originalPaymentId);
    if (key !== `retry:${originalPaymentId}`) return rejected('KEY_CONFLICT', key);
    for (const e of this.events) if (e.t === 'RETRY' && e.key === key) return ok({ newPaymentId: e.id }, true);
    const id = `pay-${lpDigestHex(['retry', key]).slice(0, 32)}`;
    this.events.push({ t: 'RETRY', key, id });
    return ok({ newPaymentId: id }, false);
  }
}

// ---- rail control ----------------------------------------------------------------------------

/** Fake A: a set of applied decision ids. */
export class SetRailControl implements RailControlPort {
  readonly applied = new Set<string>();
  constructor(private readonly known: readonly string[]) {}
  async apply(_kind: RailControlKind, subject: string, decisionId: string): Promise<PortResult<void, 'NOT_FOUND'>> {
    if (!this.known.includes(subject)) return rejected('NOT_FOUND', subject);
    this.applied.add(decisionId);
    return ok(undefined, false);
  }
}

/** Fake B: a log of (kind, subject, decision, approvers); a repeat decision id is folded away. */
export class LogRailControl implements RailControlPort {
  readonly log: { kind: RailControlKind; subject: string; decisionId: string; approvers: readonly [string, string] }[] = [];
  constructor(private readonly known: readonly string[]) {}
  async apply(kind: RailControlKind, subject: string, decisionId: string, approvers: readonly [string, string]): Promise<PortResult<void, 'NOT_FOUND'>> {
    if (!this.known.includes(subject)) return rejected('NOT_FOUND', subject);
    if (!this.log.some((e) => e.decisionId === decisionId)) this.log.push({ kind, subject, decisionId, approvers });
    return ok(undefined, false);
  }
}

// ---- audit store -------------------------------------------------------------------------------

/** Fake A: an array. Exposes no way to change an entry. */
export class ArrayAuditStore implements AuditStorePort {
  private readonly a: AuditEntry[] = [];
  async append(entry: AuditEntry): Promise<PortResult<void, 'SEQ_CONFLICT'>> {
    if (entry.seq !== BigInt(this.a.length + 1)) return rejected('SEQ_CONFLICT', entry.seq.toString(10));
    this.a.push(entry);
    return ok(undefined, false);
  }
  async tail(): Promise<PortResult<AuditEntry | null, never>> {
    return ok(this.a.at(-1) ?? null, false);
  }
  async all(): Promise<PortResult<readonly AuditEntry[], never>> {
    return ok([...this.a], false);
  }
}

/** Fake B: a map keyed by sequence number. */
export class SeqMapAuditStore implements AuditStorePort {
  private readonly m = new Map<bigint, AuditEntry>();
  async append(entry: AuditEntry): Promise<PortResult<void, 'SEQ_CONFLICT'>> {
    if (entry.seq !== BigInt(this.m.size + 1) || this.m.has(entry.seq)) return rejected('SEQ_CONFLICT', entry.seq.toString(10));
    this.m.set(entry.seq, entry);
    return ok(undefined, false);
  }
  async tail(): Promise<PortResult<AuditEntry | null, never>> {
    return ok(this.m.get(BigInt(this.m.size)) ?? null, false);
  }
  async all(): Promise<PortResult<readonly AuditEntry[], never>> {
    const out: AuditEntry[] = [];
    for (let i = 1n; i <= BigInt(this.m.size); i += 1n) out.push(this.m.get(i) as AuditEntry);
    return ok(out, false);
  }
}

/** A store that is down: every call is AMBIGUOUS (fail-closed tests). */
export class DownAuditStore implements AuditStorePort {
  async append(): Promise<PortResult<void, 'SEQ_CONFLICT'>> {
    return ambiguous('UNAVAILABLE');
  }
  async tail(): Promise<PortResult<AuditEntry | null, never>> {
    return ambiguous('UNAVAILABLE');
  }
  async all(): Promise<PortResult<readonly AuditEntry[], never>> {
    return ambiguous('UNAVAILABLE');
  }
}
