/**
 * HistoryPort test fakes (design delta 1, "Ports and fakes"): two structurally
 * different in-memory implementations that pass the same contract suite, and a
 * failure-injecting wrapper. Test-only: a production composition root uses
 * Nova's own history behind HistoryPort.
 *
 *  - ListHistory: an append-only list per client plus a key index.
 *  - EventSourcedHistory: one event log; every read folds the log, nothing else is stored.
 */

import { decideAppend, linkedPayments, makeRecord, matchesQuery, prepareQuery, refuseMutation } from './index.js';
import type { HistoryEntryInput, HistoryPort, HistoryQuery, HistoryRecord, HistoryRejectCode, PreparedEntry, PreparedQuery } from './index.js';
import type { AmbiguousCause, IdempotencyKey, NovaOwnerRef, PaymentId, PortResult } from '../nova-ports/ids.js';
import { ambiguous, ok } from '../nova-ports/ids.js';

function page(all: readonly HistoryRecord[], pq: { readonly value: PreparedQuery }): PortResult<readonly HistoryRecord[], 'INVALID'> {
  const own = all.filter((r) => r.entry.clientUid === pq.value.clientUid);
  const linked = linkedPayments(own, (pq.value.paymentId ?? '') as PaymentId);
  const out: HistoryRecord[] = [];
  let taken = 0n;
  for (const r of own) {
    if (taken >= pq.value.limit) break;
    if (!matchesQuery(r, pq.value, linked)) continue;
    out.push(r);
    taken += 1n;
  }
  return ok(out, false);
}

/** Fake A: per-client append-only lists and a key index. */
export class ListHistory implements HistoryPort {
  private readonly byKey = new Map<IdempotencyKey, HistoryRecord>();
  private readonly lists = new Map<NovaOwnerRef, HistoryRecord[]>();
  private readonly owners = new Map<PaymentId, NovaOwnerRef>();

  append(input: HistoryEntryInput): Promise<PortResult<HistoryRecord, HistoryRejectCode>> {
    const plan = decideAppend(input, (k) => this.byKey.get(k) ?? null, (p) => this.owners.get(p) ?? null);
    if (plan.kind === 'DONE') return Promise.resolve(plan.result);
    const list = this.lists.get(plan.prepared.entry.clientUid) ?? [];
    const rec = makeRecord(plan.prepared, BigInt(list.length) + 1n);
    list.push(rec);
    this.lists.set(rec.entry.clientUid, list);
    this.byKey.set(rec.key, rec);
    this.owners.set(rec.entry.paymentId, rec.entry.clientUid);
    return Promise.resolve(ok(rec, false));
  }

  list(query: HistoryQuery): Promise<PortResult<readonly HistoryRecord[], 'INVALID'>> {
    const pq = prepareQuery(query);
    if (pq.kind !== 'OK') return Promise.resolve(pq);
    return Promise.resolve(page(this.lists.get(pq.value.clientUid) ?? [], pq));
  }

  edit(key: string): Promise<PortResult<never, 'APPEND_ONLY'>> {
    return Promise.resolve(refuseMutation('edit', key));
  }

  remove(key: string): Promise<PortResult<never, 'APPEND_ONLY'>> {
    return Promise.resolve(refuseMutation('remove', key));
  }
}

interface Appended {
  readonly prepared: PreparedEntry;
}

/** Fake B: one event log. State is only ever the fold of that log. */
export class EventSourcedHistory implements HistoryPort {
  private readonly log: Appended[] = [];

  /** Folds the log into key -> record, numbering each client's entries in log order. */
  private fold(): { readonly byKey: Map<IdempotencyKey, HistoryRecord>; readonly all: HistoryRecord[] } {
    const byKey = new Map<IdempotencyKey, HistoryRecord>();
    const all: HistoryRecord[] = [];
    const counts = new Map<NovaOwnerRef, bigint>();
    for (const ev of this.log) {
      const client = ev.prepared.entry.clientUid;
      const seq = (counts.get(client) ?? 0n) + 1n;
      counts.set(client, seq);
      const rec = makeRecord(ev.prepared, seq);
      byKey.set(rec.key, rec);
      all.push(rec);
    }
    return { byKey, all };
  }

  append(input: HistoryEntryInput): Promise<PortResult<HistoryRecord, HistoryRejectCode>> {
    const state = this.fold();
    const plan = decideAppend(
      input,
      (k) => state.byKey.get(k) ?? null,
      (p) => this.log.find((ev) => ev.prepared.entry.paymentId === p)?.prepared.entry.clientUid ?? null,
    );
    if (plan.kind === 'DONE') return Promise.resolve(plan.result);
    this.log.push({ prepared: plan.prepared });
    const after = this.fold();
    return Promise.resolve(ok(after.byKey.get(plan.prepared.key) as HistoryRecord, false));
  }

  list(query: HistoryQuery): Promise<PortResult<readonly HistoryRecord[], 'INVALID'>> {
    const pq = prepareQuery(query);
    if (pq.kind !== 'OK') return Promise.resolve(pq);
    return Promise.resolve(page(this.fold().all, pq));
  }

  edit(key: string): Promise<PortResult<never, 'APPEND_ONLY'>> {
    return Promise.resolve(refuseMutation('edit', key));
  }

  remove(key: string): Promise<PortResult<never, 'APPEND_ONLY'>> {
    return Promise.resolve(refuseMutation('remove', key));
  }
}

/**
 * Failure injection around any HistoryPort. `failNext(n, cause)` makes the next n
 * appends return AMBIGUOUS without writing (history down). `loseAckNext(n)` makes
 * them write, then return AMBIGUOUS (the ack was lost): the outbox retry must replay.
 */
export class FailingHistory implements HistoryPort {
  private failures = 0n;
  private lostAcks = 0n;
  private cause: AmbiguousCause = 'UNAVAILABLE';
  /** Number of appends that reached the inner store. */
  reached = 0n;

  constructor(private readonly inner: HistoryPort) {}

  failNext(n: bigint, cause: AmbiguousCause = 'UNAVAILABLE'): void {
    this.failures = n;
    this.cause = cause;
  }

  loseAckNext(n: bigint, cause: AmbiguousCause = 'TIMEOUT'): void {
    this.lostAcks = n;
    this.cause = cause;
  }

  async append(input: HistoryEntryInput): Promise<PortResult<HistoryRecord, HistoryRejectCode>> {
    if (this.failures > 0n) {
      this.failures -= 1n;
      return ambiguous(this.cause);
    }
    this.reached += 1n;
    const r = await this.inner.append(input);
    if (this.lostAcks > 0n) {
      this.lostAcks -= 1n;
      return ambiguous(this.cause);
    }
    return r;
  }

  list(query: HistoryQuery): Promise<PortResult<readonly HistoryRecord[], 'INVALID'>> {
    return this.inner.list(query);
  }

  edit(key: string): Promise<PortResult<never, 'APPEND_ONLY'>> {
    return this.inner.edit(key);
  }

  remove(key: string): Promise<PortResult<never, 'APPEND_ONLY'>> {
    return this.inner.remove(key);
  }
}
