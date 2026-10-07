import { describe, expect, it } from 'vitest';
import { idempotencyKey } from '../../src/nova-ports/ids.js';
import { GENESIS_HASH, entryHash } from '../../src/ops/audit.js';
import type { AuditEntry } from '../../src/ops/audit.js';
import {
  AliasStaffDirectory,
  ArrayAuditStore,
  DownAuditStore,
  FlagConsentStore,
  LogCaseStore,
  LogConsentStore,
  LogLedger,
  LogPaymentFacts,
  LogRailControl,
  MapCaseStore,
  MapLedger,
  MapPaymentFacts,
  RuleStaffDirectory,
  SeqMapAuditStore,
  SetRailControl,
} from '../../src/ops/fakes.js';
import type { CaseRecord } from '../../src/ops/types.js';
import type { ConsentBinding } from '../../src/ops/ports.js';
import { ALICE, BOB, CLIENT_ACC, PAY, SETTLE, USDC, FACTS_NONE, legs } from './ops-support.js';

const ANY = { arc: 'ANY', p6Unposted: false } as const;

function rec(id: string, version: bigint, status: 'OPEN' | 'CLOSED' = 'OPEN'): CaseRecord {
  return {
    caseId: id,
    kind: 'PAUSE',
    reason: 'RECON_DRIFT',
    subject: 's',
    paymentId: PAY,
    clientUid: 'c',
    amounts: null,
    bookedEntryRef: null,
    exposure: null,
    consumedDigests: [],
    options: [],
    evidenceRefs: ['e'],
    openedAt: 't',
    status,
    version,
    inputDigest: 'd',
    pending: null,
    outcome: null,
  };
}

describe.each([
  ['map', () => new MapCaseStore()],
  ['log', () => new LogCaseStore()],
])('OPS case store contract: %s fake', (_n, make) => {
  it('compare-and-set on version, and lists only open cases', async () => {
    const s = make();
    expect((await s.get('x')).kind).toBe('REJECTED');
    expect((await s.put(rec('x', 1n), 5n)).kind).toBe('REJECTED');
    expect((await s.put(rec('x', 1n), null)).kind).toBe('OK');
    expect((await s.put(rec('x', 1n), null)).kind).toBe('REJECTED');
    expect((await s.put(rec('x', 2n), 2n)).kind).toBe('REJECTED');
    expect((await s.put(rec('x', 2n), 1n)).kind).toBe('OK');
    const g = await s.get('x');
    expect(g.kind === 'OK' && g.value.version).toBe(2n);
    await s.put(rec('y', 1n), null);
    await s.put(rec('y', 2n, 'CLOSED'), 1n);
    const l = await s.listOpen();
    expect(l.kind === 'OK' && l.value.map((r) => r.caseId)).toEqual(['x']);
  });
});

describe.each([
  ['flag', () => new FlagConsentStore()],
  ['log', () => new LogConsentStore()],
])('OPS consent contract: %s fake', (_n, make) => {
  const b: ConsentBinding = { clientUid: 'c1', paymentId: PAY, caseId: 'case-1', digest: 'dg' };
  it('is single use, bound to client, payment, case and digest', async () => {
    const s = make();
    const code = async (ref: string, binding = b) => {
      const r = await s.consume(ref, binding);
      return r.kind === 'REJECTED' ? r.code : r.kind;
    };
    expect(await code('nope')).toBe('NOT_FOUND');
    s.grant('k1', b);
    expect(await code('k1', { ...b, clientUid: 'c2' })).toBe('WRONG_CLIENT');
    expect(await code('k1', { ...b, paymentId: `pay-${'b'.repeat(32)}` })).toBe('BINDING_MISMATCH');
    expect(await code('k1', { ...b, caseId: 'case-2' })).toBe('BINDING_MISMATCH');
    expect(await code('k1', { ...b, caseId: null })).toBe('BINDING_MISMATCH');
    expect(await code('k1', { ...b, digest: 'other' })).toBe('BINDING_MISMATCH');
    expect(await code('k1')).toBe('OK');
    expect(await code('k1')).toBe('ALREADY_USED');
  });
});

describe.each([
  ['map', () => new MapLedger()],
  ['log', () => new LogLedger()],
])('OPS ledger contract: %s fake', (_n, make) => {
  it('is idempotent on the key and rejects a changed journal', async () => {
    const l = make();
    const j = { template: 'P6', legs: legs(100n), paymentId: PAY, guard: ANY, limit: null } as const;
    const first = await l.post(idempotencyKey('k:1'), j);
    expect(first).toMatchObject({ kind: 'OK', replayed: false, value: { debits: 100n, credits: 100n } });
    const again = await l.post(idempotencyKey('k:1'), j);
    expect(again).toMatchObject({ kind: 'OK', replayed: true });
    expect(again.kind === 'OK' && first.kind === 'OK' && again.value.journalRef).toBe(first.kind === 'OK' && first.value.journalRef);
    expect(await l.post(idempotencyKey('k:1'), { template: 'P6', legs: legs(101n), paymentId: PAY, guard: ANY, limit: null })).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    expect(await l.post(idempotencyKey('k:1'), { template: 'P13_PAYIN_REFUND', legs: legs(100n), paymentId: PAY, guard: ANY, limit: null })).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    expect(await l.post(idempotencyKey('k:1'), { template: 'P6', legs: legs(100n, SETTLE, CLIENT_ACC), paymentId: PAY, guard: ANY, limit: null })).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    expect(l.count).toBe(1);
    const second = await l.post(idempotencyKey('k:2'), j);
    expect(second.kind === 'OK' && first.kind === 'OK' && second.value.journalRef !== first.value.journalRef).toBe(true);
    expect(l.count).toBe(2);
    expect(USDC).toBe('USDC');
  });
});

describe('OPS staff directory contract', () => {
  it('alias fake: known spellings map to one canonical id, unknown is null', async () => {
    const s = new AliasStaffDirectory({ 'staff:alice': 'alice', 'Alice@x': 'alice' });
    expect(await s.canonical('staff:alice')).toBe('alice');
    expect(await s.canonical('Alice@x')).toBe('alice');
    expect(await s.canonical('svc:bot')).toBeNull();
  });
  it('rule fake: staff:<name> is canonical lower case, service accounts and junk are null', async () => {
    const s = new RuleStaffDirectory();
    expect(await s.canonical('staff:Alice')).toBe('staff:alice');
    expect(await s.canonical('svc:bot')).toBeNull();
    expect(await s.canonical('staff:')).toBeNull();
    expect(await s.canonical('xstaff:alice')).toBeNull();
    expect(await s.canonical('staff:alice x')).toBeNull();
  });
});

describe.each([
  ['map', () => new MapPaymentFacts()],
  ['log', () => new LogPaymentFacts()],
])('OPS payment facts and retry contract: %s fake', (_n, make) => {
  it('serves facts, and creates exactly one retry per original', async () => {
    const p = make();
    expect((await p.facts(PAY)).kind).toBe('REJECTED');
    expect(await p.createRetry(idempotencyKey(`retry:${PAY}`), PAY)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    p.set(PAY, FACTS_NONE);
    expect(await p.facts(PAY)).toMatchObject({ kind: 'OK', value: FACTS_NONE });
    p.set(PAY, { ...FACTS_NONE, terminal: false });
    expect(await p.facts(PAY)).toMatchObject({ kind: 'OK', value: { terminal: false } });
    expect(await p.createRetry(idempotencyKey('retry:other'), PAY)).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    const a = await p.createRetry(idempotencyKey(`retry:${PAY}`), PAY);
    const b = await p.createRetry(idempotencyKey(`retry:${PAY}`), PAY);
    expect(a).toMatchObject({ kind: 'OK', replayed: false });
    expect(b).toMatchObject({ kind: 'OK', replayed: true });
    expect(a.kind === 'OK' && b.kind === 'OK' && a.value.newPaymentId === b.value.newPaymentId).toBe(true);
  });
});

describe.each([
  ['set', () => new SetRailControl(['item-1'])],
  ['log', () => new LogRailControl(['item-1'])],
])('OPS rail control contract: %s fake', (_n, make) => {
  it('applies idempotently and rejects an unknown subject', async () => {
    const c = make();
    expect(await c.apply('UNPAUSE', 'nope', 'd1', [ALICE, BOB])).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    expect((await c.apply('UNPAUSE', 'item-1', 'd1', [ALICE, BOB])).kind).toBe('OK');
    expect((await c.apply('UNPAUSE', 'item-1', 'd1', [ALICE, BOB])).kind).toBe('OK');
    const n = c instanceof SetRailControl ? c.applied.size : (c as LogRailControl).log.length;
    expect(n).toBe(1);
  });
});

function entry(seq: bigint, prev: string): AuditEntry {
  const base = { seq, at: 't', type: 'CASE_OPENED' as const, caseId: 'c', action: null, optionId: null, actors: [], reason: 'r', evidenceRefs: [], code: 'OK', refs: [], prevHash: prev };
  return { ...base, hash: entryHash(base) };
}

describe.each([
  ['array', () => new ArrayAuditStore()],
  ['seq-map', () => new SeqMapAuditStore()],
])('OPS audit store contract: %s fake', (_n, make) => {
  it('appends only the next sequence number and has no update or delete', async () => {
    const s = make();
    expect(await s.tail()).toMatchObject({ kind: 'OK', value: null });
    expect((await s.append(entry(2n, GENESIS_HASH))).kind).toBe('REJECTED');
    const e1 = entry(1n, GENESIS_HASH);
    expect((await s.append(e1)).kind).toBe('OK');
    expect((await s.append(e1)).kind).toBe('REJECTED');
    const e2 = entry(2n, e1.hash);
    expect((await s.append(e2)).kind).toBe('OK');
    expect(await s.tail()).toMatchObject({ kind: 'OK', value: { seq: 2n } });
    const all = await s.all();
    expect(all.kind === 'OK' && all.value.map((e) => e.seq)).toEqual([1n, 2n]);
    expect(Object.keys(Object.getPrototypeOf(s)).filter((k) => /update|delete|remove|set|clear/i.test(k))).toEqual([]);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(s)).filter((k) => /update|delete|remove|clear/i.test(k))).toEqual([]);
  });
});

describe('OPS down audit store', () => {
  it('is ambiguous on every call', async () => {
    const s = new DownAuditStore();
    expect((await s.append()).kind).toBe('AMBIGUOUS');
    expect((await s.tail()).kind).toBe('AMBIGUOUS');
    expect((await s.all()).kind).toBe('AMBIGUOUS');
  });
});
