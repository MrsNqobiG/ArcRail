/**
 * OPS audit: an append-only, hash-chained record of every case opening and
 * every operator action, refused or applied (D-2 "Each action records the
 * actors, the time, a reason and the evidence references"). Corrections are
 * new entries. There is no update and no delete anywhere in this module.
 */

import { lpDigestHex } from '../nova-ports/ids.js';
import type { AuditStorePort } from './ports.js';

export type AuditType = 'CASE_OPENED' | 'ACTION_REFUSED' | 'ACTION_AUTHORIZED' | 'ACTION_PENDING' | 'ACTION_APPLIED' | 'ACTION_REPLAYED';

export interface AuditEntry {
  readonly seq: bigint;
  readonly at: string;
  readonly type: AuditType;
  readonly caseId: string;
  readonly action: string | null;
  readonly optionId: string | null;
  readonly actors: readonly string[];
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  /** A refusal code, or `OK`. */
  readonly code: string;
  /** Journal ref, new payment id or consent ref, whichever applies; never an amount typed by an operator. */
  readonly refs: readonly string[];
  readonly prevHash: string;
  readonly hash: string;
}

export type AuditDraft = Omit<AuditEntry, 'seq' | 'at' | 'prevHash' | 'hash'>;

export const GENESIS_HASH = '0'.repeat(64);

/** The hash covers every other field and the previous hash, so any edit or removal breaks the chain. */
export function entryHash(e: Omit<AuditEntry, 'hash'>): string {
  return lpDigestHex([
    e.prevHash,
    e.seq.toString(10),
    e.at,
    e.type,
    e.caseId,
    e.action ?? '-',
    e.optionId ?? '-',
    ...e.actors.map((a) => `a:${a}`),
    `r:${e.reason}`,
    ...e.evidenceRefs.map((x) => `e:${x}`),
    `c:${e.code}`,
    ...e.refs.map((x) => `f:${x}`),
  ]);
}

/** Null when the whole chain verifies; else the sequence number of the first broken entry. */
export function verifyChain(entries: readonly AuditEntry[]): bigint | null {
  let prev = GENESIS_HASH;
  let seq = 1n;
  for (const e of entries) {
    if (e.seq !== seq || e.prevHash !== prev || e.hash !== entryHash(e)) return seq;
    prev = e.hash;
    seq += 1n;
  }
  return null;
}

const ATTEMPTS = 5n;

export class AuditLog {
  constructor(
    private readonly store: AuditStorePort,
    private readonly clock: () => string,
  ) {}

  /** Appends one entry. Returns false when it could not be written (the caller fails closed). */
  async record(draft: AuditDraft): Promise<boolean> {
    for (let i = 0n; i < ATTEMPTS; i += 1n) {
      const tail = await this.store.tail();
      if (tail.kind !== 'OK') return false;
      const base = {
        ...draft,
        actors: [...draft.actors],
        evidenceRefs: [...draft.evidenceRefs],
        refs: [...draft.refs],
        seq: tail.value === null ? 1n : tail.value.seq + 1n,
        at: this.clock(),
        prevHash: tail.value === null ? GENESIS_HASH : tail.value.hash,
      };
      const r = await this.store.append(Object.freeze({ ...base, hash: entryHash(base) }));
      if (r.kind === 'OK') return true;
      if (r.kind !== 'REJECTED') return false;
    }
    return false;
  }

  /** Null when the store cannot be read. */
  async entries(): Promise<readonly AuditEntry[] | null> {
    const all = await this.store.all();
    return all.kind === 'OK' ? all.value : null;
  }

  /** Null when the chain is intact. An unreadable store reports 0n (broken), never intact. */
  async verify(): Promise<bigint | null> {
    const all = await this.entries();
    return all === null ? 0n : verifyChain(all);
  }
}
