import { describe, expect, it } from 'vitest';
import { AuditLog, GENESIS_HASH, entryHash, verifyChain } from '../../src/ops/audit.js';
import type { AuditDraft, AuditEntry } from '../../src/ops/audit.js';
import { ArrayAuditStore, DownAuditStore, SeqMapAuditStore } from '../../src/ops/fakes.js';
import type { AuditStorePort } from '../../src/ops/ports.js';
import { ok, rejected } from '../../src/nova-ports/ids.js';

const draft = (over: Partial<AuditDraft> = {}): AuditDraft => ({
  type: 'ACTION_APPLIED',
  caseId: 'case-1',
  action: 'REFUND',
  optionId: 'o1',
  actors: ['staff:alice', 'staff:bob'],
  reason: 'why',
  evidenceRefs: ['e1', 'e2'],
  code: 'OK',
  refs: ['journal:j1'],
  ...over,
});

describe.each([
  ['array', () => new ArrayAuditStore()],
  ['seq-map', () => new SeqMapAuditStore()],
])('OPS audit log over the %s store', (_n, make) => {
  it('chains entries from genesis and verifies', async () => {
    const log = new AuditLog(make(), () => '2026-10-07T00:00:00Z');
    expect(await log.verify()).toBeNull();
    expect(await log.entries()).toEqual([]);
    expect(await log.record(draft())).toBe(true);
    expect(await log.record(draft({ type: 'ACTION_REFUSED', code: 'SAME_APPROVER' }))).toBe(true);
    const e = (await log.entries()) as readonly AuditEntry[];
    expect(e.map((x) => x.seq)).toEqual([1n, 2n]);
    expect(e[0]).toMatchObject({ prevHash: GENESIS_HASH, at: '2026-10-07T00:00:00Z', ...draft() });
    expect(e[1]?.prevHash).toBe(e[0]?.hash);
    expect(e[0]?.hash).toBe(entryHash({ ...e[0]!, hash: undefined } as never));
    expect(GENESIS_HASH).toBe('0'.repeat(64));
    expect(await log.verify()).toBeNull();
  });

  it('is append-only: entries are frozen copies, and any edit, removal or reorder breaks the chain', async () => {
    const log = new AuditLog(make(), () => 't');
    for (let i = 0; i < 3; i += 1) await log.record(draft({ caseId: `case-${i}` }));
    const e = [...((await log.entries()) as readonly AuditEntry[])];
    expect(Object.isFrozen(e[0])).toBe(true);
    expect(() => {
      (e[0] as { code: string }).code = 'X';
    }).toThrow(TypeError);
    expect(verifyChain(e)).toBeNull();
    const tamper = (i: number, patch: Partial<AuditEntry>) => verifyChain(e.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    expect(tamper(0, { reason: 'changed' })).toBe(1n);
    expect(tamper(1, { code: 'CHANGED' })).toBe(2n);
    expect(tamper(1, { actors: ['staff:mallory', 'staff:bob'] })).toBe(2n);
    expect(tamper(2, { refs: [] })).toBe(3n);
    expect(tamper(2, { evidenceRefs: [] })).toBe(3n);
    expect(tamper(0, { at: 'later' })).toBe(1n);
    expect(tamper(0, { type: 'ACTION_REFUSED' })).toBe(1n);
    expect(tamper(0, { action: null })).toBe(1n);
    expect(tamper(0, { optionId: null })).toBe(1n);
    expect(tamper(0, { caseId: 'case-x' })).toBe(1n);
    expect(tamper(1, { prevHash: GENESIS_HASH })).toBe(2n);
    expect(tamper(1, { seq: 5n })).toBe(2n);
    expect(verifyChain([e[1] as AuditEntry, e[2] as AuditEntry])).toBe(1n);
    expect(verifyChain([e[0] as AuditEntry, e[2] as AuditEntry])).toBe(2n);
    expect(verifyChain([e[1] as AuditEntry, e[0] as AuditEntry, e[2] as AuditEntry])).toBe(1n);
  });

  it('does not alias the caller draft', async () => {
    const log = new AuditLog(make(), () => 't');
    const d = draft();
    await log.record(d);
    (d.actors as string[]).push('mallory');
    (d.evidenceRefs as string[]).push('x');
    (d.refs as string[]).push('y');
    expect(await log.verify()).toBeNull();
    const e = (await log.entries()) as readonly AuditEntry[];
    expect(e[0]?.actors).toEqual(['staff:alice', 'staff:bob']);
  });

  it('hashes null action and option differently from a literal dash only by position', () => {
    const base = { seq: 1n, at: 't', type: 'CASE_OPENED' as const, caseId: 'c', action: null, optionId: null, actors: [], reason: 'r', evidenceRefs: [], code: 'OK', refs: [], prevHash: GENESIS_HASH };
    expect(entryHash(base)).toBe(entryHash({ ...base }));
    expect(entryHash(base)).not.toBe(entryHash({ ...base, action: 'REFUND' }));
    expect(entryHash(base)).not.toBe(entryHash({ ...base, optionId: 'o' }));
    expect(entryHash({ ...base, actors: ['x'] })).not.toBe(entryHash({ ...base, evidenceRefs: ['x'] }));
    expect(entryHash({ ...base, evidenceRefs: ['x'] })).not.toBe(entryHash({ ...base, refs: ['x'] }));
    expect(entryHash({ ...base, reason: 'x' })).not.toBe(entryHash({ ...base, code: 'x', reason: 'r' }));
  });
});

describe('OPS audit log fail-closed paths', () => {
  it('a down store: record is false and verify reports broken, never intact', async () => {
    const log = new AuditLog(new DownAuditStore(), () => 't');
    expect(await log.record(draft())).toBe(false);
    expect(await log.entries()).toBeNull();
    expect(await log.verify()).toBe(0n);
  });

  it('a store whose append is ambiguous is not retried into a double write', async () => {
    let appends = 0n;
    const store: AuditStorePort = {
      tail: async () => ok(null, false),
      all: async () => ok([], false),
      append: async () => {
        appends += 1n;
        return { kind: 'AMBIGUOUS', cause: 'TIMEOUT' };
      },
    };
    expect(await new AuditLog(store, () => 't').record(draft())).toBe(false);
    expect(appends).toBe(1n);
  });

  it('retries a lost sequence race a bounded number of times', async () => {
    const real = new ArrayAuditStore();
    let losses = 0n;
    const racy: AuditStorePort = {
      tail: () => real.tail(),
      all: () => real.all(),
      append: async (e) => {
        if (losses < 2n) {
          losses += 1n;
          await real.append({ ...e, hash: 'other-writer' });
          return rejected('SEQ_CONFLICT', 'lost');
        }
        return real.append(e);
      },
    };
    const log = new AuditLog(racy, () => 't');
    expect(await log.record(draft())).toBe(true);
    expect(((await real.all()) as { value: readonly unknown[] }).value).toHaveLength(3);
    const always: AuditStorePort = { tail: async () => ok(null, false), all: async () => ok([], false), append: async () => rejected('SEQ_CONFLICT', 'x') };
    let tails = 0n;
    const counting: AuditStorePort = { ...always, tail: async () => { tails += 1n; return ok(null, false); } };
    expect(await new AuditLog(counting, () => 't').record(draft())).toBe(false);
    expect(tails).toBe(5n);
  });
});
