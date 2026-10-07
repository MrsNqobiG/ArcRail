/**
 * HIST unit: HistoryPort contract suite (design delta 1, D-4; answers 18, 28, 30).
 * Both fakes run the same suite. Test values are throwaway literals.
 */
import { describe, expect, it } from 'vitest';
import { EventSourcedHistory, FailingHistory, ListHistory } from '../../src/history/fakes.js';
import { HISTORY_KINDS, entryDigest, historyKey, linkedPayments, matchesQuery, prepareEntry, prepareQuery } from '../../src/history/index.js';
import type { HistoryEntryInput, HistoryPort, HistoryRecord } from '../../src/history/index.js';
import { idempotencyKey, ledgerAssetCode, novaOwnerRef, paymentId } from '../../src/nova-ports/ids.js';
import type { PaymentId, PortResult } from '../../src/nova-ports/ids.js';

const FACTORIES: readonly (readonly [string, () => HistoryPort])[] = [
  ['ListHistory', () => new ListHistory()],
  ['EventSourcedHistory', () => new EventSourcedHistory()],
];

const UID = novaOwnerRef('client-uid-1');
const UID2 = novaOwnerRef('client-uid-2');
const P1 = paymentId(`pay-${'a1'.repeat(16)}`);
const P2 = paymentId(`pay-${'b2'.repeat(16)}`);
const P3 = paymentId(`pay-${'c3'.repeat(16)}`);
const T0 = '2026-10-07T10:00:00Z';
const HASH = `0x${'ab'.repeat(32)}` as const;

function leg(over: Record<string, unknown> = {}): HistoryEntryInput {
  return {
    clientUid: UID, paymentId: P1, eventId: 'ev-1', kind: 'LEG', code: 'LEG_SUBMITTED', occurredAt: T0, leg: 'ARC_TRANSFER',
    ...over,
  } as HistoryEntryInput;
}

function okValue<T>(r: PortResult<T, string>, replayed = false): T {
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${JSON.stringify(r)}`);
  expect(r.replayed).toBe(replayed);
  return r.value;
}

function invalid(r: PortResult<unknown, string>, detail?: RegExp): void {
  expect(r.kind).toBe('REJECTED');
  if (r.kind === 'REJECTED') {
    expect(r.code).toBe('INVALID');
    if (detail) expect(r.detail).toMatch(detail);
  }
}

describe.each(FACTORIES)('HistoryPort contract: %s', (_name, make) => {
  it('appends a leg entry under the client UID with the derived key and per-client seq', async () => {
    const h = make();
    const a = okValue(await h.append(leg()));
    expect(a.key).toBe(`hist:${P1}:ev-1`);
    expect(a.seq).toBe(1n);
    expect(a.entry).toMatchObject({ clientUid: UID, paymentId: P1, kind: 'LEG', leg: 'ARC_TRANSFER', stage: null, documents: [] });
    const b = okValue(await h.append(leg({ eventId: 'ev-2' })));
    expect(b.seq).toBe(2n);
    const other = okValue(await h.append(leg({ clientUid: UID2, paymentId: P2, eventId: 'ev-1' })));
    expect(other.seq).toBe(1n);
    const listed = okValue(await h.list({ clientUid: UID }));
    expect(listed.map((r) => r.key)).toEqual([`hist:${P1}:ev-1`, `hist:${P1}:ev-2`]);
    expect(okValue(await h.list({ clientUid: UID2 })).length).toBe(1);
    expect(okValue(await h.list({ clientUid: novaOwnerRef('nobody') }))).toEqual([]);
  });

  it('is idempotent: the same event twice writes one entry and replays the first record', async () => {
    const h = make();
    const first = okValue(await h.append(leg()));
    const again = okValue(await h.append(leg()), true);
    expect(again).toEqual(first);
    expect(okValue(await h.list({ clientUid: UID })).length).toBe(1);
    // a replay does not consume a seq
    expect(okValue(await h.append(leg({ eventId: 'ev-2' }))).seq).toBe(2n);
  });

  it('the same key with a different body is KEY_CONFLICT and changes nothing', async () => {
    const h = make();
    await h.append(leg());
    for (const other of [{ code: 'LEG_OTHER' }, { occurredAt: '2026-10-07T10:00:01Z' }, { clientUid: UID2 }, { amount: { asset: ledgerAssetCode('USDC'), units: 1n } }]) {
      const r = await h.append(leg(other));
      expect(r).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT' });
    }
    const listed = okValue(await h.list({ clientUid: UID }));
    expect(listed.length).toBe(1);
    expect(listed[0]?.entry.code).toBe('LEG_SUBMITTED');
  });

  it('is append-only: edit and remove are refused, and returned records cannot change the store', async () => {
    const h = make();
    const rec = okValue(await h.append(leg({ documents: [{ id: 'doc-1' }] })));
    expect(await h.edit(rec.key)).toMatchObject({ kind: 'REJECTED', code: 'APPEND_ONLY' });
    expect(await h.remove(rec.key)).toMatchObject({ kind: 'REJECTED', code: 'APPEND_ONLY' });
    const e = await h.edit('hist:nope');
    expect(e.kind === 'REJECTED' && e.detail).toContain('hist:nope');
    const r = await h.remove('hist:nope');
    expect(r.kind === 'REJECTED' && r.detail).toContain('remove');
    expect(() => {
      (rec.entry as { code: string }).code = 'HACKED';
    }).toThrow();
    expect(() => {
      (rec.entry.documents as unknown as { id: string }[]).push({ id: 'x' });
    }).toThrow();
    expect(() => {
      (rec as { seq: bigint }).seq = 9n;
    }).toThrow();
    const again = okValue(await h.list({ clientUid: UID }));
    expect(again[0]?.entry.code).toBe('LEG_SUBMITTED');
    expect(again[0]?.entry.documents).toEqual([{ id: 'doc-1' }]);
    expect(again.length).toBe(1);
  });

  it('a correction is a new entry that points at the corrected one; the original stays', async () => {
    const h = make();
    await h.append(leg({ amount: { asset: ledgerAssetCode('USDC'), units: 100n } }));
    const fix = okValue(
      await h.append({
        clientUid: UID, paymentId: P1, eventId: 'fix-1', kind: 'CORRECTION', code: 'AMOUNT_CORRECTED', occurredAt: T0,
        corrects: idempotencyKey(`hist:${P1}:ev-1`), amount: { asset: ledgerAssetCode('USDC'), units: 90n },
        operator: { actor: 'op-7', reasonCode: 'WRONG_AMOUNT', caseRef: 'case-9' },
      }),
    );
    expect(fix.seq).toBe(2n);
    expect(fix.entry.corrects).toBe(`hist:${P1}:ev-1`);
    expect(fix.entry.operator).toEqual({ actor: 'op-7', reasonCode: 'WRONG_AMOUNT', caseRef: 'case-9' });
    const listed = okValue(await h.list({ clientUid: UID }));
    expect(listed[0]?.entry.amount?.units).toBe(100n);
    expect(listed[1]?.entry.amount?.units).toBe(90n);
  });

  it('a correction needs an existing target of the same client and payment', async () => {
    const h = make();
    await h.append(leg());
    const corr = (over: Record<string, unknown>): HistoryEntryInput =>
      ({ clientUid: UID, paymentId: P1, eventId: 'fix-1', kind: 'CORRECTION', code: 'FIXED', occurredAt: T0, corrects: `hist:${P1}:ev-1`, ...over }) as HistoryEntryInput;
    expect(await h.append(corr({ corrects: `hist:${P1}:missing` }))).toMatchObject({ kind: 'REJECTED', code: 'CORRECTS_NOT_FOUND' });
    // another client may not correct this client's entry
    expect(await h.append(corr({ clientUid: UID2 }))).toMatchObject({ kind: 'REJECTED', code: 'CORRECTS_NOT_FOUND' });
    // another payment's entry is refused as INVALID (not the same payment)
    invalid(await h.append(corr({ paymentId: P2 })), /same payment/);
    expect(okValue(await h.list({ clientUid: UID })).length).toBe(1);
    // a correction of a correction is allowed
    okValue(await h.append(corr({})));
    okValue(await h.append(corr({ eventId: 'fix-2', corrects: `hist:${P1}:fix-1` })));
  });

  it('a retry is a new payment linked to the original; both histories are kept', async () => {
    const h = make();
    await h.append(leg());
    await h.append({ clientUid: UID, paymentId: P1, eventId: 'fail-1', kind: 'FAILURE', code: 'LEG_FAILED', occurredAt: T0, stage: 'REJECTED', status: 'FAILED', reason: 'DFNS_FAILED' });
    const retry = okValue(await h.append({ clientUid: UID, paymentId: P2, eventId: 'retry-1', kind: 'RETRY', code: 'RETRY_STARTED', occurredAt: T0, retryOf: P1 }));
    expect(retry.entry).toMatchObject({ paymentId: P2, retryOf: P1 });
    await h.append(leg({ paymentId: P2, eventId: 'ev-1' }));
    await h.append(leg({ paymentId: P3, eventId: 'ev-1' }));
    const forOriginal = okValue(await h.list({ clientUid: UID, paymentId: P1 }));
    // answer 28: the retry payment's own later entries come with it
    expect(forOriginal.map((r) => r.key)).toEqual([`hist:${P1}:ev-1`, `hist:${P1}:fail-1`, `hist:${P2}:retry-1`, `hist:${P2}:ev-1`]);
    const forRetry = okValue(await h.list({ clientUid: UID, paymentId: P2 }));
    expect(forRetry.map((r) => r.key)).toEqual([`hist:${P2}:retry-1`, `hist:${P2}:ev-1`]);
    expect(okValue(await h.list({ clientUid: UID })).length).toBe(5);
  });

  it('a chain of retries is followed from the original, and an unrelated payment is not', async () => {
    const h = make();
    await h.append(leg());
    const retry = (paymentId: string, of: string, eventId = 'r') =>
      h.append({ clientUid: UID, paymentId, eventId, kind: 'RETRY', code: 'RETRY_STARTED', occurredAt: T0, retryOf: of } as HistoryEntryInput);
    okValue(await retry(P2, P1));
    okValue(await retry(P3, P2));
    await h.append(leg({ paymentId: P3, eventId: 'later' }));
    const P4 = paymentId(`pay-${'d4'.repeat(16)}`);
    await h.append(leg({ paymentId: P4 }));
    const keys = okValue(await h.list({ clientUid: UID, paymentId: P1 })).map((r) => r.key);
    expect(keys).toEqual([`hist:${P1}:ev-1`, `hist:${P2}:r`, `hist:${P3}:r`, `hist:${P3}:later`]);
    // the query from the middle of the chain does not reach back to the original
    expect(okValue(await h.list({ clientUid: UID, paymentId: P2 })).map((r) => r.key)).toEqual([`hist:${P2}:r`, `hist:${P3}:r`, `hist:${P3}:later`]);
    // another client's entries never join the chain
    okValue(await h.append(leg({ clientUid: UID2, paymentId: paymentId(`pay-${'e5'.repeat(16)}`) })));
    expect(okValue(await h.list({ clientUid: UID, paymentId: P1 })).length).toBe(4);
  });

  it('a retry names an existing payment of the same client; a payment belongs to one client', async () => {
    const h = make();
    await h.append(leg());
    const retry = (over: Record<string, unknown>) =>
      h.append({ clientUid: UID, paymentId: P2, eventId: 'r', kind: 'RETRY', code: 'RETRY_STARTED', occurredAt: T0, retryOf: P1, ...over } as HistoryEntryInput);
    expect(await retry({ clientUid: UID2 })).toMatchObject({ kind: 'REJECTED', code: 'RETRY_OF_NOT_FOUND' });
    expect(await retry({ retryOf: P3 })).toMatchObject({ kind: 'REJECTED', code: 'RETRY_OF_NOT_FOUND' });
    expect(await h.append(leg({ clientUid: UID2, eventId: 'ev-9' }))).toMatchObject({ kind: 'REJECTED', code: 'PAYMENT_CLIENT_MISMATCH' });
    expect(okValue(await h.list({ clientUid: UID2 }))).toEqual([]);
    expect(okValue(await h.list({ clientUid: UID })).length).toBe(1);
    okValue(await retry({}));
  });

  it('records failures with their reason and operator actions with actor and reason', async () => {
    const h = make();
    const f = okValue(await h.append({ clientUid: UID, paymentId: P1, eventId: 'f', kind: 'FAILURE', code: 'BLOCKED', occurredAt: T0, stage: 'REJECTED', reason: 'BLOCKLISTED_PRE_MEMPOOL', txHash: HASH }));
    expect(f.entry).toMatchObject({ stage: 'REJECTED', reason: 'BLOCKLISTED_PRE_MEMPOOL', txHash: HASH });
    const o = okValue(
      await h.append({
        clientUid: UID, paymentId: P1, eventId: 'o', kind: 'OPERATOR_ACTION', code: 'CANCELLED', occurredAt: T0,
        stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR', operator: { actor: 'op-1', reasonCode: 'CLIENT_ASKED' },
      }),
    );
    expect(o.entry.operator).toEqual({ actor: 'op-1', reasonCode: 'CLIENT_ASKED', caseRef: null });
  });

  it('attaches supporting documents by reference ID only, in order', async () => {
    const h = make();
    const r = okValue(await h.append(leg({ documents: [{ id: 'doc-b' }, { id: 'doc-a_1' }] })));
    expect(r.entry.documents).toEqual([{ id: 'doc-b' }, { id: 'doc-a_1' }]);
    const bad = (docs: unknown, eventId: string) => h.append(leg({ eventId, documents: docs }));
    invalid(await bad([{ id: 'doc-1', url: 'https://x.test/a.pdf' }], 'e1'), /nothing else/);
    invalid(await bad([{ id: 'doc-1', content: 'aGk=' }], 'e2'), /nothing else/);
    invalid(await bad([{ id: 'https://x.test/a.pdf' }], 'e3'), /opaque/);
    invalid(await bad([{ id: 'a@b.test' }], 'e4'), /opaque/);
    invalid(await bad([{ id: 'has space' }], 'e5'), /opaque/);
    invalid(await bad([{ id: '' }], 'e6'), /opaque/);
    invalid(await bad([{ id: 5 }], 'e7'), /opaque/);
    invalid(await bad(['doc-1'], 'e8'), /nothing else/);
    invalid(await bad('doc-1', 'e9'), /must be a list/);
    invalid(await bad({}, 'e9b'), /must be a list/);
    invalid(await bad(null, 'e9c'), /must be a list/);
    invalid(await bad([{ id: 'd' }, { id: 'd' }], 'e10'), /duplicate/);
    invalid(await bad(Array.from({ length: 17 }, (_, i) => ({ id: `d${i}` })), 'e11'), /too many/);
    okValue(await bad(Array.from({ length: 16 }, (_, i) => ({ id: `d${i}` })), 'e12'));
    expect(okValue(await h.list({ clientUid: UID })).length).toBe(2);
  });

  it('pages by cursor and limit, oldest first', async () => {
    const h = make();
    for (const n of ['a', 'b', 'c', 'd', 'e']) await h.append(leg({ eventId: `ev-${n}` }));
    const p1 = okValue(await h.list({ clientUid: UID, limit: 2n }));
    expect(p1.map((r) => r.seq)).toEqual([1n, 2n]);
    const p2 = okValue(await h.list({ clientUid: UID, after: 2n, limit: 2n }));
    expect(p2.map((r) => r.seq)).toEqual([3n, 4n]);
    expect(okValue(await h.list({ clientUid: UID, after: 4n })).map((r) => r.seq)).toEqual([5n]);
    expect(okValue(await h.list({ clientUid: UID, after: 5n }))).toEqual([]);
    expect((await h.list({ clientUid: UID, limit: 0n })).kind).toBe('REJECTED');
  });

  it('refuses malformed requests without writing', async () => {
    const h = make();
    for (const x of [null, 'x', [], { ...leg(), extra: 1 }, { ...leg(), name: 'Jane Doe' }]) {
      invalid(await h.append(x as unknown as HistoryEntryInput));
    }
    expect(await h.list({ clientUid: UID, bogus: 1n } as never)).toMatchObject({ kind: 'REJECTED', code: 'INVALID' });
    // ports never throw on a non-object query (m1)
    for (const q of [null, undefined, 'x', 5, []]) expect(await h.list(q as never)).toMatchObject({ kind: 'REJECTED', code: 'INVALID' });
    // inherited fields are not input (m11)
    const inherited = Object.create({ ...leg() }) as HistoryEntryInput;
    invalid(await h.append(inherited));
    invalid(await h.append(Object.create({ ...leg() }, { clientUid: { value: UID, enumerable: true } }) as HistoryEntryInput));
    expect(await h.list(Object.create({ clientUid: UID }) as never)).toMatchObject({ kind: 'REJECTED', code: 'INVALID' });
    // a null-prototype object is a plain record
    okValue(await h.append(Object.assign(Object.create(null) as object, leg()) as HistoryEntryInput));
    expect(okValue(await h.list({ clientUid: UID })).length).toBe(1);
  });
});

describe('FailingHistory (the outbox retries; history never blocks money)', () => {
  it.each(FACTORIES)('%s: a failed append writes nothing, the retry writes once', async (_n, make) => {
    const inner = make();
    const h = new FailingHistory(inner);
    h.failNext(2n, 'TRANSPORT');
    expect(await h.append(leg())).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    expect(await h.append(leg())).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    expect(h.reached).toBe(0n);
    expect(okValue(await inner.list({ clientUid: UID }))).toEqual([]);
    okValue(await h.append(leg()));
    expect(h.reached).toBe(1n);
    expect(okValue(await h.list({ clientUid: UID })).length).toBe(1);
  });

  it.each(FACTORIES)('%s: a lost ack is retried to a replay, one entry', async (_n, make) => {
    const h = new FailingHistory(make());
    h.loseAckNext(1n);
    expect(await h.append(leg())).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    okValue(await h.append(leg()), true);
    expect(okValue(await h.list({ clientUid: UID })).length).toBe(1);
    expect(await h.edit('k')).toMatchObject({ code: 'APPEND_ONLY' });
    expect(await h.remove('k')).toMatchObject({ code: 'APPEND_ONLY' });
  });

  it('the failure wrapper defaults: UNAVAILABLE for a down store, TIMEOUT for a lost ack', async () => {
    const h = new FailingHistory(new ListHistory());
    h.failNext(1n);
    expect(await h.append(leg())).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
    h.loseAckNext(1n);
    expect(await h.append(leg())).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
  });

  it.each(FACTORIES)('%s: edit and remove name the operation and the key', async (_n, make) => {
    const h = make();
    const e = await h.edit('hist:k1');
    const r = await h.remove('hist:k2');
    expect(e).toMatchObject({ kind: 'REJECTED', code: 'APPEND_ONLY' });
    expect(e.kind === 'REJECTED' && e.detail).toMatch(/edit of hist:k1 refused/);
    expect(r.kind === 'REJECTED' && r.detail).toMatch(/remove of hist:k2 refused/);
    const w = new FailingHistory(h);
    const we = await w.edit('hist:k3');
    expect(we.kind === 'REJECTED' && we.detail).toMatch(/edit of hist:k3/);
  });

  it('the two fakes agree on a mixed sequence', async () => {
    const seqs: string[][] = [];
    for (const [, make] of FACTORIES) {
      const h = make();
      const steps: HistoryEntryInput[] = [
        leg(), leg(), leg({ eventId: 'ev-2', clientUid: UID2 }), leg({ code: 'X' }),
        { clientUid: UID, paymentId: P2, eventId: 'r', kind: 'RETRY', code: 'RETRY', occurredAt: T0, retryOf: P1 },
      ];
      const out: string[] = [];
      for (const s of steps) {
        const r = await h.append(s);
        out.push(r.kind === 'OK' ? `OK:${r.value.seq}:${r.replayed}` : r.kind === 'REJECTED' ? `R:${r.code}` : 'A');
      }
      out.push(String((okValue(await h.list({ clientUid: UID, paymentId: P1 })) as HistoryRecord[]).length));
      seqs.push(out);
    }
    expect(seqs[0]).toEqual(seqs[1]);
  });
});

describe('prepareEntry validation', () => {
  const ok1 = (over: Record<string, unknown>) => prepareEntry(leg(over));

  it('accepts the base entry and normalises every optional field to null', () => {
    const p = okValue(prepareEntry(leg()));
    expect(p.entry).toEqual({
      clientUid: UID, paymentId: P1, eventId: 'ev-1', kind: 'LEG', code: 'LEG_SUBMITTED', occurredAt: T0, stage: null, status: null, reason: null,
      leg: 'ARC_TRANSFER', amount: null, txHash: null, retryOf: null, corrects: null, operator: null, documents: [],
    });
    expect(p.key).toBe(historyKey(P1, 'ev-1'));
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.entry)).toBe(true);
    expect(Object.isFrozen(p.entry.documents)).toBe(true);
  });

  it('checks identifiers, codes and the instant', () => {
    invalid(ok1({ clientUid: '' }), /clientUid/);
    invalid(ok1({ clientUid: 'a b' }), /clientUid/);
    invalid(ok1({ clientUid: 'jane@x.test' }), /clientUid/);
    invalid(ok1({ clientUid: 'x'.repeat(129) }), /clientUid/);
    invalid(ok1({ clientUid: 7 }), /clientUid/);
    okValue(ok1({ clientUid: 'x'.repeat(128) }));
    invalid(ok1({ paymentId: 'pay-1' }), /paymentId/);
    invalid(ok1({ paymentId: 5 }), /paymentId/);
    invalid(ok1({ eventId: '' }), /eventId/);
    invalid(ok1({ eventId: 'A' }), /eventId/);
    invalid(ok1({ eventId: 'a:b' }), /eventId/);
    invalid(ok1({ eventId: 'a'.repeat(65) }), /eventId/);
    okValue(ok1({ eventId: 'a'.repeat(64) }));
    invalid(ok1({ kind: 'EDIT' }), /kind/);
    invalid(ok1({ kind: 3 }), /kind/);
    invalid(ok1({ code: 'lower' }), /code/);
    invalid(ok1({ code: '1X' }), /code/);
    invalid(ok1({ code: 'A'.repeat(65) }), /code/);
    okValue(ok1({ code: 'A'.repeat(64) }));
    for (const t of ['2026-10-07', '2026-10-07 10:00:00Z', '2026-13-07T10:00:00Z', '2026-00-07T10:00:00Z', '2026-10-32T10:00:00Z', '2026-10-00T10:00:00Z', '2026-10-07T24:00:00Z', '2026-10-07T10:60:00Z', '2026-10-07T10:00:60Z', '2026-10-07T10:00:00+02:00', '2026-10-07T10:00:00.1234Z', '2026-10-07T10:00:00.Z', 'x2026-10-07T10:00:00Z', '2026-10-07T10:00:00Zx']) {
      invalid(ok1({ occurredAt: t }), /occurredAt/);
    }
    // calendar-invalid days (m10)
    for (const t of ['2026-02-31T10:00:00Z', '2026-02-29T10:00:00Z', '2026-04-31T10:00:00Z', '2026-06-31T10:00:00Z', '2026-09-31T10:00:00Z', '2026-11-31T10:00:00Z', '2100-02-29T10:00:00Z', '2026-02-30T10:00:00Z']) {
      invalid(ok1({ occurredAt: t }), /occurredAt/);
    }
    for (const t of ['2026-10-07T10:00:00Z', '2026-12-31T23:59:59.999Z', '2026-01-01T00:00:00.5Z', '2026-10-31T10:00:00Z', '2026-10-29T10:00:00Z', '2026-02-28T10:00:00Z', '2028-02-29T10:00:00Z', '2000-02-29T10:00:00Z', '2026-04-30T10:00:00Z', '2026-01-31T10:00:00Z', '2026-12-31T10:00:00Z', '2026-07-31T10:00:00Z']) okValue(ok1({ occurredAt: t }));
  });

  it('keeps stage, status and reason in line with the design table', () => {
    invalid(ok1({ stage: 'DONE' }), /stage/);
    invalid(ok1({ status: 'DONE' }), /status/);
    invalid(ok1({ reason: 'lower' }), /reason/);
    okValue(ok1({ stage: 'SUBMITTED', status: 'PROCESSING' }));
    okValue(ok1({ stage: 'CREATED', status: 'PENDING' }));
    okValue(ok1({ stage: 'COMPLETED', status: 'SETTLED' }));
    invalid(ok1({ stage: 'SUBMITTED', status: 'SETTLED' }), /maps to PROCESSING/);
    invalid(ok1({ stage: 'REJECTED', status: 'SETTLED', reason: 'DFNS_FAILED' }), /maps to FAILED/);
    // REVERSED is a compensating entry on a completed payment, not a stage
    okValue(ok1({ stage: 'COMPLETED', status: 'REVERSED' }));
    invalid(ok1({ stage: 'SUBMITTED', status: 'REVERSED' }), /maps to/);
    okValue(ok1({ status: 'REVERSED' }));
    // failure stages need a reason from their own list; other stages take none
    invalid(ok1({ stage: 'REJECTED' }), /reason is not allowed/);
    invalid(ok1({ stage: 'REJECTED', reason: 'QUOTE_EXPIRED' }), /reason is not allowed for stage REJECTED/);
    invalid(ok1({ stage: 'EXPIRED', reason: 'DFNS_FAILED' }), /stage EXPIRED/);
    invalid(ok1({ stage: 'CANCELLED', reason: 'APPROVAL_EXPIRED' }), /stage CANCELLED/);
    okValue(ok1({ stage: 'EXPIRED', reason: 'UNDER_FEE_FLOOR_DROPPED' }));
    okValue(ok1({ stage: 'REJECTED', status: 'FAILED', reason: 'BLOCKLISTED_PRE_MEMPOOL' }));
    invalid(ok1({ stage: 'SUBMITTED', reason: 'DFNS_FAILED' }), /only with a failure stage/);
    invalid(ok1({ stage: 'COMPLETED', reason: 'DFNS_FAILED' }), /only with a failure stage/);
    // a reason on an entry with no stage must still be a §13.2 reason (m7)
    invalid(ok1({ reason: 'FREE_CODE' }), /§13\.2/);
    okValue(ok1({ reason: 'DFNS_FAILED' }));
    okValue(ok1({ reason: 'QUOTE_EXPIRED' }));
    okValue(ok1({ reason: 'CANCELLED_BY_OPERATOR' }));
    // COMPLETED takes SETTLED or REVERSED only (m5)
    for (const st of ['PENDING', 'PROCESSING', 'FAILED']) invalid(ok1({ stage: 'COMPLETED', status: st }), /maps to SETTLED/);
  });

  it('holds failure entries to failure facts', () => {
    const f = (over: Record<string, unknown>) => prepareEntry({ ...leg(), kind: 'FAILURE', leg: undefined, ...over });
    invalid(f({}), /needs a reason/);
    invalid(f({ reason: 'WHATEVER' }), /§13\.2/);
    okValue(f({ reason: 'DFNS_FAILED' }));
    invalid(f({ reason: 'DFNS_FAILED', stage: 'SUBMITTED' }), /only with a failure stage/);
    invalid(f({ stage: 'COMPLETED', reason: 'DFNS_FAILED' }), /only with a failure stage/);
    invalid(f({ reason: 'DFNS_FAILED', status: 'SETTLED' }), /status FAILED/);
    invalid(f({ reason: 'DFNS_FAILED', status: 'PROCESSING' }), /status FAILED/);
    okValue(f({ reason: 'DFNS_FAILED', status: 'FAILED' }));
    okValue(f({ stage: 'EXPIRED', reason: 'QUOTE_EXPIRED' }));
  });

  it('a failure entry may not carry a plain non-failure stage even when it has no reason rule of its own', () => {
    invalid(prepareEntry({ ...leg(), kind: 'FAILURE', leg: undefined, reason: 'DFNS_FAILED', stage: 'CONFIRMING' }), /only with a failure stage/);
  });

  it('checks the leg, amount and tx hash', () => {
    for (const l of ['AWAIT_DEPOSIT', 'RESERVE', 'CONVERT_IN', 'ARC_TRANSFER', 'PAYOUT']) okValue(ok1({ leg: l }));
    invalid(prepareEntry({ ...leg(), leg: undefined }), /needs the leg/);
    invalid(ok1({ leg: 'TELEPORT' }), /leg is unknown/);
    okValue(prepareEntry({ ...leg(), kind: 'OPERATOR_ACTION', operator: { actor: 'a', reasonCode: 'R' }, leg: undefined }));
    const amt = (a: unknown) => ok1({ amount: a });
    okValue(amt({ asset: 'USDC', units: 0n }));
    okValue(amt({ asset: 'ZAR.cents-1', units: 12345678901234567890n }));
    invalid(amt({ asset: 'USDC', units: -1n }), /non-negative/);
    invalid(amt({ asset: 'USDC', units: 1 }), /non-negative/);
    invalid(amt({ asset: 'USDC', units: '1' }), /non-negative/);
    invalid(amt({ asset: 'USDC', units: 1n, extra: 1 }), /amount must be/);
    invalid(amt({ asset: '', units: 1n }), /asset/);
    invalid(amt({ asset: 'A'.repeat(33), units: 1n }), /asset/);
    okValue(amt({ asset: 'A'.repeat(32), units: 1n }));
    invalid(amt('1'), /amount must be/);
    invalid(amt(null), /amount must be/);
    invalid(amt([]), /amount must be/);
    okValue(ok1({ txHash: HASH }));
    invalid(ok1({ txHash: HASH.toUpperCase().replace('0X', '0x') }), /txHash/);
    invalid(ok1({ txHash: '0x12' }), /txHash/);
    invalid(ok1({ txHash: 5 }), /txHash/);
  });

  it('checks retry and correction links', () => {
    const retry = (over: Record<string, unknown>) => prepareEntry({ ...leg(), kind: 'RETRY', leg: undefined, retryOf: P2, ...over });
    okValue(retry({}));
    invalid(retry({ retryOf: undefined }), /names the original/);
    invalid(retry({ retryOf: 'pay-1' }), /names the original/);
    invalid(retry({ retryOf: 5 }), /names the original/);
    invalid(retry({ retryOf: P1 }), /new payment/);
    invalid(ok1({ retryOf: P2 }), /only for RETRY/);
    const corr = (over: Record<string, unknown>) => prepareEntry({ ...leg(), kind: 'CORRECTION', leg: undefined, corrects: `hist:${P1}:ev-0`, ...over });
    okValue(corr({}));
    invalid(corr({ corrects: undefined }), /names the entry key/);
    invalid(corr({ corrects: 'Not A Key' }), /names the entry key/);
    invalid(corr({ corrects: 5 }), /names the entry key/);
    invalid(corr({ corrects: `hist:${P2}:ev-0` }), /same payment/);
    invalid(corr({ corrects: `xhist:${P1}:ev-0` }), /same payment/);
    invalid(corr({ corrects: `hist:${P1}:ev-1` }), /itself/);
    invalid(ok1({ corrects: `hist:${P1}:ev-0` }), /only for CORRECTION/);
  });

  it('checks the operator block', () => {
    const op = (operator: unknown, kind = 'OPERATOR_ACTION') => prepareEntry({ ...leg(), kind, leg: undefined, operator, ...(kind === 'CORRECTION' ? { corrects: `hist:${P1}:ev-0` } : {}) });
    invalid(prepareEntry({ ...leg(), kind: 'OPERATOR_ACTION', leg: undefined }), /needs the operator/);
    okValue(op({ actor: 'op-1', reasonCode: 'WHY' }));
    okValue(op({ actor: 'op-1', reasonCode: 'WHY', caseRef: 'case-1' }));
    okValue(op({ actor: 'op-1', reasonCode: 'WHY' }, 'CORRECTION'));
    okValue(prepareEntry({ ...leg(), kind: 'CORRECTION', leg: undefined, corrects: `hist:${P1}:ev-0` }));
    invalid(ok1({ operator: { actor: 'op-1', reasonCode: 'WHY' } }), /only for OPERATOR_ACTION and CORRECTION/);
    invalid(op({ actor: 'a@b.test', reasonCode: 'WHY' }), /actor/);
    invalid(op({ actor: 'Jane Doe', reasonCode: 'WHY' }), /actor/);
    invalid(op({ actor: '', reasonCode: 'WHY' }), /actor/);
    invalid(op({ actor: 'x'.repeat(129), reasonCode: 'WHY' }), /actor/);
    okValue(op({ actor: 'x'.repeat(128), reasonCode: 'WHY' }));
    invalid(op({ actor: 'a', reasonCode: 'why' }), /reasonCode/);
    invalid(op({ actor: 'a', reasonCode: 'WHY', caseRef: 'has space' }), /caseRef/);
    invalid(op({ actor: 'a', reasonCode: 'WHY', caseRef: 5 }), /caseRef/);
    invalid(op({ actor: 'a', reasonCode: 'WHY', name: 'Jane' }), /operator must be/);
    invalid(op('op-1'), /operator must be/);
    invalid(op(null), /operator must be/);
  });

  it('the digest separates every field and the key encodes payment and event', () => {
    const base = okValue(prepareEntry(leg()));
    const d = (over: Record<string, unknown>) => okValue(prepareEntry(leg(over))).digest;
    const variants = [
      { clientUid: UID2 }, { paymentId: P2 }, { eventId: 'ev-2' }, { code: 'OTHER' }, { occurredAt: '2026-10-07T10:00:01Z' },
      { stage: 'SUBMITTED' }, { status: 'PROCESSING' }, { reason: 'DFNS_FAILED' }, { leg: 'PAYOUT' },
      { amount: { asset: 'USDC', units: 1n } }, { amount: { asset: 'USDC', units: 2n } }, { amount: { asset: 'ZAR', units: 1n } },
      { txHash: HASH }, { documents: [{ id: 'd' }] }, { documents: [{ id: 'd' }, { id: 'e' }] }, { documents: [{ id: 'e' }, { id: 'd' }] },
      { kind: 'OPERATOR_ACTION', operator: { actor: 'a', reasonCode: 'R' } },
      { kind: 'OPERATOR_ACTION', operator: { actor: 'a', reasonCode: 'R', caseRef: 'c' } },
      { kind: 'OPERATOR_ACTION', operator: { actor: 'b', reasonCode: 'R' } },
      { kind: 'OPERATOR_ACTION', operator: { actor: 'a', reasonCode: 'S' } },
      { kind: 'OPERATOR_ACTION', operator: { actor: 'a', reasonCode: 'R', caseRef: 'd' } },
      { kind: 'RETRY', retryOf: P2 }, { kind: 'RETRY', retryOf: P3 },
      { kind: 'CORRECTION', corrects: `hist:${P1}:a` }, { kind: 'CORRECTION', corrects: `hist:${P1}:b` },
    ];
    const seen = new Set<string>([base.digest]);
    for (const v of variants) seen.add(d(v));
    expect(seen.size).toBe(variants.length + 1);
    // field boundaries cannot be shifted
    expect(d({ code: 'AB', eventId: 'c' })).not.toBe(d({ code: 'A', eventId: 'bc' }));
    // the same body gives the same digest, and the digest is hex sha-256
    expect(d({})).toBe(base.digest);
    expect(base.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(entryDigest(base.entry)).toBe(base.digest);
    expect(historyKey(P1, 'ev-1')).toBe(`hist:${P1}:ev-1`);
    expect(base.key).toBe(`hist:${P1}:ev-1`);
  });

  it('exposes the closed list of kinds', () => {
    expect([...HISTORY_KINDS]).toEqual(['LEG', 'FAILURE', 'RETRY', 'CORRECTION', 'OPERATOR_ACTION']);
    expect(Object.isFrozen(HISTORY_KINDS)).toBe(true);
  });
});

describe('prepareQuery and matchesQuery', () => {
  const rec = (over: Partial<{ clientUid: string; paymentId: string; retryOf: string | null; seq: bigint }>): HistoryRecord => {
    const p = okValue(prepareEntry(over.retryOf ? { ...leg(), kind: 'RETRY', leg: undefined, retryOf: over.retryOf, clientUid: over.clientUid ?? UID, paymentId: over.paymentId ?? P1 } : leg({ clientUid: over.clientUid ?? UID, paymentId: over.paymentId ?? P1 })));
    return { key: p.key, seq: over.seq ?? 1n, digest: p.digest, entry: p.entry };
  };
  const q = (x: unknown) => okValue(prepareQuery(x));

  it('defaults and bounds', () => {
    expect(q({ clientUid: UID })).toEqual({ clientUid: UID, paymentId: null, after: 0n, limit: 100n });
    expect(q({ clientUid: UID, paymentId: P1, after: 3n, limit: 1000n })).toEqual({ clientUid: UID, paymentId: P1, after: 3n, limit: 1000n });
    expect(q({ clientUid: UID, limit: 1n }).limit).toBe(1n);
    for (const bad of [null, 'x', { clientUid: '' }, { clientUid: UID, paymentId: 'pay-1' }, { clientUid: UID, paymentId: 5 }, { clientUid: UID, after: -1n }, { clientUid: UID, after: 1 }, { clientUid: UID, limit: 0n }, { clientUid: UID, limit: 1001n }, { clientUid: UID, limit: 5 }, { clientUid: UID, extra: 1 }]) {
      invalid(prepareQuery(bad));
    }
  });

  it('matches by client, cursor and payment or retry link', () => {
    const none = new Set<PaymentId>();
    const base = q({ clientUid: UID });
    expect(matchesQuery(rec({}), base, none)).toBe(true);
    expect(matchesQuery(rec({ clientUid: UID2 }), base, none)).toBe(false);
    expect(matchesQuery(rec({ seq: 3n }), q({ clientUid: UID, after: 3n }), none)).toBe(false);
    expect(matchesQuery(rec({ seq: 4n }), q({ clientUid: UID, after: 3n }), none)).toBe(true);
    const link = (root: PaymentId, ...rs: HistoryRecord[]) => linkedPayments(rs, root);
    const retry = rec({ paymentId: P2, retryOf: P1 });
    expect(matchesQuery(rec({}), q({ clientUid: UID, paymentId: P1 }), link(P1))).toBe(true);
    expect(matchesQuery(rec({}), q({ clientUid: UID, paymentId: P2 }), link(P2))).toBe(false);
    expect(matchesQuery(retry, q({ clientUid: UID, paymentId: P1 }), link(P1, retry))).toBe(true);
    expect(matchesQuery(retry, q({ clientUid: UID, paymentId: P3 }), link(P3, retry))).toBe(false);
    // a chain is followed whatever the record order; a retry of an unlinked payment is not
    const second = rec({ paymentId: P3, retryOf: P2 });
    expect([...link(P1, second, retry)].sort()).toEqual([P1, P2, P3].sort());
    expect([...link(P2, second, retry)].sort()).toEqual([P2, P3].sort());
    expect([...link(P3, second, retry)]).toEqual([P3]);
  });
});
