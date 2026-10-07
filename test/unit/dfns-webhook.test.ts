/**
 * F3 DFNS webhooks (src/dfns/webhook.ts): HMAC over the raw body, timestamp
 * window, source IP, event replay, entity dedupe, out-of-order delivery and the
 * GET re-read, run against both inbox fakes. The webhook secret is generated at
 * test time. Bodies derive from the archived `wallet.transfer.requested` example
 * [DF:events].
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { DfnsResult } from '../../src/dfns/client.js';
import { EXAMPLE_TIMESTAMP_SENT, transferFixture, webhookEventText } from '../../src/dfns/fakes/fixtures.js';
import { LogDeliveryLog, MapDeliveryLog } from '../../src/dfns/fakes/stores.js';
import { parseJson } from '../../src/dfns/json.js';
import { type DfnsTransfer, decodeTransfer, transferDedupeKey, transferPayloadDigest } from '../../src/dfns/types.js';
import {
  type DfnsSignalSink,
  type DfnsTransferSignal,
  type DfnsWebhookConfig,
  type DfnsWebhookRequest,
  type SinkOutcome,
  type WebhookDeliveryLogPort,
  DfnsWebhookHandler,
  TRANSFER_EVENT_KINDS,
  WEBHOOK_MAX_BODY_BYTES,
  WEBHOOK_TOLERANCE_SECONDS,
  verifyDfnsSignature,
} from '../../src/dfns/webhook.js';

const XFR = 'xfr-20g4k-nsdpo-mg6arrifgvid4orn';
const WAL = 'wa-5pfuu-9euek-h0odgb6snva8ph3k';
const HASH = `0x${'ab'.repeat(32)}`;
const DFNS_IP = '35.181.116.68';

/** A reader that returns whatever state the test puts in `current`. */
class Reader {
  current: Record<string, unknown> = transferFixture();
  calls = 0;
  fail: DfnsResult<DfnsTransfer> | null = null;
  async getTransfer(walletId: string, transferId: string): Promise<DfnsResult<DfnsTransfer>> {
    this.calls += 1;
    expect(walletId).toBe(WAL);
    expect(transferId).toMatch(/^xfr-/);
    return this.fail ?? { kind: 'OK', value: decodeTransfer(parseJson(JSON.stringify(this.current))) };
  }
}

/**
 * Stands in for the orchestrator's `applySignal` (§7.3): an atomic inbox keyed by the §10.3
 * dedupe key. `failNext` makes the next call NOT_COMMITTED with nothing applied.
 */
class Sink implements DfnsSignalSink {
  readonly inbox = new Map<string, string>();
  readonly applied: DfnsTransferSignal[] = [];
  calls = 0;
  failNext = false;
  forced: SinkOutcome | null = null;
  async apply(signal: DfnsTransferSignal): Promise<SinkOutcome> {
    this.calls += 1;
    if (this.failNext) {
      this.failNext = false;
      return 'NOT_COMMITTED';
    }
    if (this.forced !== null) return this.forced;
    const held = this.inbox.get(signal.dedupeKey);
    if (held !== undefined) return held === signal.payloadDigest ? 'DUPLICATE' : 'SIGNAL_CONFLICT';
    this.inbox.set(signal.dedupeKey, signal.payloadDigest);
    this.applied.push(signal);
    return 'APPLIED';
  }
}

function setup(makeLog: () => WebhookDeliveryLogPort, allowedSourceIps: readonly string[] = [DFNS_IP]) {
  const secret = randomBytes(32);
  const config: DfnsWebhookConfig = { secret, allowedSourceIps };
  const reader = new Reader();
  const clock = { now: EXAMPLE_TIMESTAMP_SENT + 10n, nowSeconds(): bigint { return this.now; } };
  const log = makeLog();
  const sink = new Sink();
  const handler = new DfnsWebhookHandler(config, clock, log, reader, sink);
  const sign = (body: string, key: Buffer = secret): string => `sha256=${createHmac('sha256', key).update(body).digest('hex')}`;
  const request = (body: string, signature: string | undefined = sign(body), sourceIp = DFNS_IP): DfnsWebhookRequest => ({
    rawBody: Buffer.from(body, 'utf8'),
    headers: { 'x-dfns-webhook-signature': signature },
    sourceIp,
  });
  let n = 0;
  /** A distinct delivery (new event id, as DFNS retries are [DF:events]). */
  const delivery = (kind = 'wallet.transfer.requested', over: Record<string, unknown> = {}): DfnsWebhookRequest => {
    n += 1;
    return request(webhookEventText({ id: `wh-${n}`, kind, ...over }));
  };
  return { handler, reader, clock, sign, request, delivery, config, log, sink };
}

describe('constants', () => {
  it('tolerance, size cap and subscribed kinds', () => {
    expect(WEBHOOK_TOLERANCE_SECONDS).toBe(300n);
    expect(WEBHOOK_MAX_BODY_BYTES).toBe(262144n);
    expect(TRANSFER_EVENT_KINDS).toEqual(['wallet.transfer.requested', 'wallet.transfer.failed', 'wallet.transfer.rejected', 'wallet.transfer.broadcasted', 'wallet.transfer.confirmed']);
  });
});

describe('verifyDfnsSignature: authenticity before parsing', () => {
  const s = setup(() => new MapDeliveryLog());
  const body = webhookEventText();
  it('accepts the exact raw-body HMAC', () => {
    expect(verifyDfnsSignature(s.request(body), s.config)).toBeNull();
  });
  it('fails closed on a forged, missing or malformed signature', () => {
    expect(verifyDfnsSignature(s.request(body, s.sign(body, randomBytes(32))), s.config)).toBe('SIGNATURE_MISMATCH');
    expect(verifyDfnsSignature({ ...s.request(body), headers: {} }, s.config)).toBe('NO_SIGNATURE');
    expect(verifyDfnsSignature(s.request(body, s.sign(body).toUpperCase()), s.config)).toBe('BAD_SIGNATURE_FORMAT');
    expect(verifyDfnsSignature(s.request(body, s.sign(body).replace('sha256=', 'sha1=')), s.config)).toBe('BAD_SIGNATURE_FORMAT');
    expect(verifyDfnsSignature(s.request(body, `${s.sign(body)}0`), s.config)).toBe('BAD_SIGNATURE_FORMAT');
    expect(verifyDfnsSignature(s.request(body, ` ${s.sign(body)}`), s.config)).toBe('BAD_SIGNATURE_FORMAT');
    expect(verifyDfnsSignature(s.request(body, s.sign(body).slice(0, -1)), s.config)).toBe('BAD_SIGNATURE_FORMAT');
  });
  it('does not accept the HMAC of a re-serialisation (Q-N4: raw bytes only)', () => {
    const spaced = body.replace('"kind":', '"kind": ');
    expect(verifyDfnsSignature(s.request(spaced, s.sign(body)), s.config)).toBe('SIGNATURE_MISMATCH');
  });
  it('m6: the HMAC is over the raw bytes, whitespace and all (no trim, no decode)', () => {
    const padded = Buffer.from(`\n ${body} \n`, 'utf8');
    const rawSig = `sha256=${createHmac('sha256', s.config.secret).update(padded).digest('hex')}`;
    expect(verifyDfnsSignature({ rawBody: padded, headers: { 'x-dfns-webhook-signature': rawSig }, sourceIp: DFNS_IP }, s.config)).toBeNull();
    // A signature over the trimmed text does not verify the padded bytes.
    expect(verifyDfnsSignature({ rawBody: padded, headers: { 'x-dfns-webhook-signature': s.sign(body) }, sourceIp: DFNS_IP }, s.config)).toBe('SIGNATURE_MISMATCH');
  });
  it('m6: non-UTF-8 bytes are hashed as received, not as decoded text', () => {
    const raw = Buffer.concat([Buffer.from(body, 'utf8'), Buffer.from([0xff, 0xfe, 0x80])]);
    const rawSig = `sha256=${createHmac('sha256', s.config.secret).update(raw).digest('hex')}`;
    expect(verifyDfnsSignature({ rawBody: raw, headers: { 'x-dfns-webhook-signature': rawSig }, sourceIp: DFNS_IP }, s.config)).toBeNull();
    const decoded = Buffer.from(raw.toString('utf8'), 'utf8');
    const decodedSig = `sha256=${createHmac('sha256', s.config.secret).update(decoded).digest('hex')}`;
    expect(decoded.equals(raw)).toBe(false);
    expect(verifyDfnsSignature({ rawBody: raw, headers: { 'x-dfns-webhook-signature': decodedSig }, sourceIp: DFNS_IP }, s.config)).toBe('SIGNATURE_MISMATCH');
  });
  it('a body modified after signing fails', () => {
    expect(verifyDfnsSignature(s.request(body.replace('Pending', 'Confirmed'), s.sign(body)), s.config)).toBe('SIGNATURE_MISMATCH');
  });
  it('checks the source IP; m4: an empty list admits no source (fail closed)', () => {
    expect(verifyDfnsSignature(s.request(body, s.sign(body), '10.0.0.1'), s.config)).toBe('SOURCE_IP');
    expect(verifyDfnsSignature(s.request(body, s.sign(body), DFNS_IP), { ...s.config, allowedSourceIps: [] })).toBe('SOURCE_IP');
    expect(verifyDfnsSignature(s.request(body, s.sign(body), DFNS_IP), { ...s.config, allowedSourceIps: ['10.0.0.1', DFNS_IP] })).toBeNull();
  });
  it('m4: an empty secret verifies nothing, even a signature made with the empty key', () => {
    const empty = Buffer.alloc(0);
    expect(verifyDfnsSignature(s.request(body, s.sign(body, empty)), { ...s.config, secret: empty })).toBe('SIGNATURE_MISMATCH');
  });
  it('caps the body at 256 KiB', () => {
    const at = 'x'.repeat(262144);
    expect(verifyDfnsSignature(s.request(at, s.sign(at)), s.config)).toBeNull();
    const over = 'x'.repeat(262145);
    expect(verifyDfnsSignature(s.request(over, s.sign(over)), s.config)).toBe('BODY_TOO_LARGE');
    const multibyte = 'é'.repeat(131073);
    expect(verifyDfnsSignature(s.request(multibyte, s.sign(multibyte)), s.config)).toBe('BODY_TOO_LARGE');
  });
});

describe.each([
  ['MapDeliveryLog', () => new MapDeliveryLog()],
  ['LogDeliveryLog', () => new LogDeliveryLog()],
] as const)('DfnsWebhookHandler with %s', (_name, makeInbox) => {
  it('a genuine webhook becomes a DFNS_POLL signal built from the re-read, never from the body', async () => {
    const s = setup(makeInbox);
    s.reader.current = transferFixture({ status: 'Broadcasted', txHash: HASH });
    const out = await s.handler.handle(s.delivery('wallet.transfer.requested'));
    expect(out.kind).toBe('SIGNAL');
    if (out.kind !== 'SIGNAL') return;
    expect(out.http).toBe(200n);
    const t = decodeTransfer(parseJson(JSON.stringify(s.reader.current)));
    expect(out.signal).toEqual({
      source: 'DFNS_POLL',
      dedupeKey: `dfns:transfer:${XFR}:Broadcasted`,
      payloadDigest: transferPayloadDigest(t),
      transfer: t,
      mapped: { kind: 'STAGE', stage: 'SUBMITTED', txHash: HASH, crossCheckOnly: false },
      eventId: 'wh-1',
    });
    expect(s.reader.calls).toBe(1);
    expect(s.sink.applied).toEqual([out.signal]);
  });

  it('B5: a hash-less Failed reaches the sink as FAILED_UNPROVEN (never released, nonce hold), whatever the body claims', async () => {
    const s = setup(makeInbox);
    s.reader.current = transferFixture({ status: 'Failed', details: { nonce: 9 } });
    const out = await s.handler.handle(s.delivery('wallet.transfer.failed'));
    expect(out.kind === 'SIGNAL' ? out.signal.mapped : null).toMatchObject({ kind: 'FAILED_UNPROVEN', quarantine: true, nonceHold: { dfnsTransferId: XFR, nonce: 9n, aborted: false } });
  });

  it('m2: 200 only after the sink committed; a NOT_COMMITTED sink answers 503 and records nothing', async () => {
    const s = setup(makeInbox);
    s.reader.current = transferFixture({ status: 'Confirmed', txHash: HASH });
    s.sink.failNext = true;
    const body = webhookEventText({ id: 'wh-once', kind: 'wallet.transfer.confirmed' });
    expect(await s.handler.handle(s.request(body))).toEqual({ kind: 'NOT_COMMITTED', http: 503n, dedupeKey: `dfns:transfer:${XFR}:Confirmed` });
    expect(await s.log.eventDigest('wh-once')).toBeNull();
    expect(await s.log.highWater(XFR)).toBeNull();
    // Nothing was marked, so an older state is not STALE and the same event id is not a replay.
    s.reader.current = transferFixture({ status: 'Pending' });
    expect((await s.handler.handle(s.delivery())).kind).toBe('SIGNAL');
    s.reader.current = transferFixture({ status: 'Confirmed', txHash: HASH });
    expect((await s.handler.handle(s.request(body))).kind).toBe('SIGNAL');
    expect(s.sink.applied.map((x) => x.transfer.status)).toEqual(['Pending', 'Confirmed']);
  });

  it('m2: a crash after the sink commit and before the delivery log write loses nothing (DFNS retry → DUPLICATE)', async () => {
    const s = setup(makeInbox);
    const record = s.log.recordEvent.bind(s.log);
    let crash = true;
    s.log.recordEvent = async (id: string, d: string) => {
      if (crash) {
        crash = false;
        throw new Error('crash');
      }
      return record(id, d);
    };
    await expect(s.handler.handle(s.delivery())).rejects.toThrow('crash');
    expect(s.sink.applied).toHaveLength(1);
    expect(await s.handler.handle(s.delivery('wallet.transfer.requested', { deliveryAttempt: 2, retryOf: 'wh-1' }))).toEqual({ kind: 'DUPLICATE', http: 200n, dedupeKey: `dfns:transfer:${XFR}:Pending` });
    expect(s.sink.applied).toHaveLength(1);
  });

  it('m2: the delivery log never holds a §10.3 dedupe key, so it cannot make applySignal or the poller see DUPLICATE', async () => {
    const s = setup(makeInbox);
    await s.handler.handle(s.delivery());
    expect(await s.log.eventDigest(`dfns:transfer:${XFR}:Pending`)).toBeNull();
    expect([...s.sink.inbox.keys()]).toEqual([`dfns:transfer:${XFR}:Pending`]);
  });

  it('the sink decides DUPLICATE, STALE and SIGNAL_CONFLICT too', async () => {
    const s = setup(makeInbox);
    s.sink.forced = 'STALE';
    expect(await s.handler.handle(s.delivery())).toEqual({ kind: 'STALE', http: 200n, dedupeKey: `dfns:transfer:${XFR}:Pending`, seen: 'a later stage in the payment store' });
    expect(await s.log.highWater(XFR)).toBeNull();
    s.sink.forced = 'SIGNAL_CONFLICT';
    expect(await s.handler.handle(s.delivery())).toEqual({ kind: 'SIGNAL_CONFLICT', http: 200n, dedupeKey: `dfns:transfer:${XFR}:Pending`, alert: true });
    expect(await s.log.highWater(XFR)).toBeNull();
    s.sink.forced = 'DUPLICATE';
    expect((await s.handler.handle(s.delivery())).kind).toBe('DUPLICATE');
    expect(await s.log.highWater(XFR)).toEqual({ rank: 1n, status: 'Pending' });
  });

  it('forged: wrong secret → 401, no re-read', async () => {
    const s = setup(makeInbox);
    const body = webhookEventText();
    expect(await s.handler.handle(s.request(body, s.sign(body, randomBytes(32))))).toEqual({ kind: 'AUTH_FAILED', http: 401n, reason: 'SIGNATURE_MISMATCH', alert: true });
    expect(await s.handler.handle({ ...s.request(body), headers: {} })).toMatchObject({ http: 401n, reason: 'NO_SIGNATURE' });
    expect(await s.handler.handle(s.request(body, s.sign(body), '1.2.3.4'))).toMatchObject({ http: 401n, reason: 'SOURCE_IP' });
    const big = 'x'.repeat(262145);
    expect(await s.handler.handle(s.request(big))).toEqual({ kind: 'AUTH_FAILED', http: 413n, reason: 'BODY_TOO_LARGE', alert: true });
    expect(s.reader.calls).toBe(0);
  });

  it('forged with a leaked secret: the body claims Confirmed, DFNS holds Pending → the signal is Pending', async () => {
    const s = setup(makeInbox);
    const forged = webhookEventText({ kind: 'wallet.transfer.confirmed' }, transferFixture({ status: 'Confirmed', txHash: HASH }));
    const out = await s.handler.handle(s.request(forged));
    expect(out.kind === 'SIGNAL' ? out.signal.transfer.status : out.kind).toBe('Pending');
    expect(out.kind === 'SIGNAL' ? out.signal.mapped : null).toEqual({ kind: 'STAGE', stage: 'PENDING_APPROVAL', txHash: null, crossCheckOnly: false });
  });

  it('replayed: a stale timestamp is 401; the same event id again is a no-op', async () => {
    const s = setup(makeInbox);
    const body = webhookEventText({ id: 'wh-replay' });
    expect((await s.handler.handle(s.request(body))).kind).toBe('SIGNAL');
    expect(await s.handler.handle(s.request(body))).toEqual({ kind: 'REPLAYED_EVENT', http: 200n, eventId: 'wh-replay' });
    expect(s.reader.calls).toBe(1);
    // Lens R-1 m4: the delivery log holds 0x + the lowercase sha256 hex of the raw bytes, nothing else.
    expect(await s.log.eventDigest('wh-replay')).toBe(`0x${createHash('sha256').update(Buffer.from(body, 'utf8')).digest('hex')}`);
    expect(await s.log.eventDigest('wh-replay')).toMatch(/^0x[0-9a-f]{64}$/);
    s.clock.now = EXAMPLE_TIMESTAMP_SENT + 300n;
    expect(await s.handler.handle(s.request(body))).toEqual({ kind: 'AUTH_FAILED', http: 401n, reason: 'STALE_TIMESTAMP', alert: true });
    s.clock.now = EXAMPLE_TIMESTAMP_SENT - 300n;
    expect(await s.handler.handle(s.request(body))).toMatchObject({ reason: 'STALE_TIMESTAMP' });
  });

  it('the timestamp window is |now − sent| < 300 on both sides', async () => {
    const s = setup(makeInbox);
    s.clock.now = EXAMPLE_TIMESTAMP_SENT + 299n;
    expect((await s.handler.handle(s.delivery())).kind).toBe('SIGNAL');
    s.clock.now = EXAMPLE_TIMESTAMP_SENT - 299n;
    expect((await s.handler.handle(s.delivery())).kind).toBe('DUPLICATE');
    s.clock.now = EXAMPLE_TIMESTAMP_SENT - 301n;
    expect((await s.handler.handle(s.delivery())).kind).toBe('AUTH_FAILED');
  });

  it('same event id with different bytes is an alerting conflict', async () => {
    const s = setup(makeInbox);
    expect((await s.handler.handle(s.request(webhookEventText({ id: 'wh-x' })))).kind).toBe('SIGNAL');
    expect(await s.handler.handle(s.request(webhookEventText({ id: 'wh-x', date: '2024-01-01T00:00:00.000Z' })))).toEqual({
      kind: 'EVENT_ID_CONFLICT',
      http: 200n,
      eventId: 'wh-x',
      alert: true,
    });
  });

  it('Lens R-1 m4: same event id, bytes that differ only in invalid UTF-8 (same decoded text) → conflict, never a silent replay', async () => {
    const s = setup(makeInbox);
    const text = webhookEventText({ id: 'wh-bytes', date: 'MARK' });
    const [pre, post] = text.split('MARK') as [string, string];
    const raw = (b: number): Buffer => Buffer.concat([Buffer.from(pre, 'utf8'), Buffer.from([b]), Buffer.from(post, 'utf8')]);
    const req = (buf: Buffer): DfnsWebhookRequest => ({
      rawBody: buf,
      headers: { 'x-dfns-webhook-signature': `sha256=${createHmac('sha256', s.config.secret).update(buf).digest('hex')}` },
      sourceIp: DFNS_IP,
    });
    expect(raw(0xff).toString('utf8')).toBe(raw(0xfe).toString('utf8'));
    expect((await s.handler.handle(req(raw(0xff)))).kind).toBe('SIGNAL');
    expect(await s.handler.handle(req(raw(0xfe)))).toEqual({ kind: 'EVENT_ID_CONFLICT', http: 200n, eventId: 'wh-bytes', alert: true });
    expect(await s.handler.handle(req(raw(0xff)))).toEqual({ kind: 'REPLAYED_EVENT', http: 200n, eventId: 'wh-bytes' });
  });

  it('a DFNS retry (new event id, same state) dedupes on the entity', async () => {
    const s = setup(makeInbox);
    expect((await s.handler.handle(s.delivery())).kind).toBe('SIGNAL');
    expect(await s.handler.handle(s.delivery('wallet.transfer.requested', { deliveryAttempt: 2, retryOf: 'wh-1' }))).toEqual({
      kind: 'DUPLICATE',
      http: 200n,
      dedupeKey: `dfns:transfer:${XFR}:Pending`,
    });
  });

  it('out of order: a newer state first, then an older one → STALE', async () => {
    const s = setup(makeInbox);
    s.reader.current = transferFixture({ status: 'Broadcasted', txHash: HASH });
    expect((await s.handler.handle(s.delivery('wallet.transfer.broadcasted'))).kind).toBe('SIGNAL');
    s.reader.current = transferFixture({ status: 'Pending' });
    expect(await s.handler.handle(s.delivery('wallet.transfer.requested'))).toEqual({
      kind: 'STALE',
      http: 200n,
      dedupeKey: `dfns:transfer:${XFR}:Pending`,
      seen: 'Broadcasted',
    });
    s.reader.current = transferFixture({ status: 'Confirmed', txHash: HASH });
    expect((await s.handler.handle(s.delivery('wallet.transfer.confirmed'))).kind).toBe('SIGNAL');
    s.reader.current = transferFixture({ status: 'Broadcasted', txHash: HASH });
    expect((await s.handler.handle(s.delivery('wallet.transfer.broadcasted'))).kind).toBe('STALE');
  });

  it('ordering is per transfer: a newer state of one transfer does not make another transfer stale', async () => {
    const s = setup(makeInbox);
    s.reader.current = transferFixture({ status: 'Confirmed', txHash: HASH });
    expect((await s.handler.handle(s.delivery())).kind).toBe('SIGNAL');
    const other = 'xfr-20g4k-nsdpo-mg6arrifgvid4orx';
    s.reader.current = transferFixture({ id: other });
    const out = await s.handler.handle(s.request(webhookEventText({ id: 'wh-other' }, transferFixture({ id: other }))));
    expect(out.kind === 'SIGNAL' ? out.signal.dedupeKey : out.kind).toBe(`dfns:transfer:${other}:Pending`);
  });

  it('out of order: the late broadcasted webhook after confirmation re-reads Confirmed → DUPLICATE', async () => {
    const s = setup(makeInbox);
    s.reader.current = transferFixture({ status: 'Confirmed', txHash: HASH });
    expect((await s.handler.handle(s.delivery('wallet.transfer.confirmed'))).kind).toBe('SIGNAL');
    expect((await s.handler.handle(s.delivery('wallet.transfer.broadcasted'))).kind).toBe('DUPLICATE');
  });

  it('two different terminal states for one transfer → SIGNAL_CONFLICT', async () => {
    const s = setup(makeInbox);
    s.reader.current = transferFixture({ status: 'Confirmed', txHash: HASH });
    expect((await s.handler.handle(s.delivery())).kind).toBe('SIGNAL');
    s.reader.current = transferFixture({ status: 'Failed', txHash: HASH });
    expect(await s.handler.handle(s.delivery())).toEqual({ kind: 'SIGNAL_CONFLICT', http: 200n, dedupeKey: `dfns:transfer:${XFR}:Failed`, alert: true });
  });

  it('same state key with different content (a speed-up changed the hash, F-18) → SIGNAL_CONFLICT', async () => {
    const s = setup(makeInbox);
    s.reader.current = transferFixture({ status: 'Broadcasted', txHash: HASH });
    expect((await s.handler.handle(s.delivery())).kind).toBe('SIGNAL');
    s.reader.current = transferFixture({ status: 'Broadcasted', txHash: `0x${'cd'.repeat(32)}` });
    expect(await s.handler.handle(s.delivery())).toEqual({ kind: 'SIGNAL_CONFLICT', http: 200n, dedupeKey: `dfns:transfer:${XFR}:Broadcasted`, alert: true });
  });

  it('unknown kinds are stored and ignored; approvals are hints without an alert', async () => {
    const s = setup(makeInbox);
    expect(await s.handler.handle(s.delivery('wallet.created'))).toEqual({ kind: 'IGNORED', http: 200n, eventKind: 'wallet.created', alert: true, gap: null });
    expect(await s.handler.handle(s.delivery('policy.approval.resolved'))).toEqual({ kind: 'IGNORED', http: 200n, eventKind: 'policy.approval.resolved', alert: false, gap: 'APPROVAL_DETAIL_NOT_IN_D1' });
    expect(s.reader.calls).toBe(0);
  });

  it.each(TRANSFER_EVENT_KINDS)('handles %s by re-reading', async (kind) => {
    const s = setup(makeInbox);
    expect((await s.handler.handle(s.delivery(kind))).kind).toBe('SIGNAL');
  });

  it('a failed re-read answers 503 so DFNS retries', async () => {
    const s = setup(makeInbox);
    s.reader.fail = { kind: 'AMBIGUOUS', cause: 'TIMEOUT', detail: '' };
    expect(await s.handler.handle(s.delivery())).toEqual({ kind: 'REREAD_FAILED', http: 503n, detail: 'TIMEOUT' });
    s.reader.fail = { kind: 'REJECTED', code: 'NOT_FOUND', httpStatus: 404n, retryable: false, retryAfterSeconds: null, detail: '' };
    expect(await s.handler.handle(s.delivery())).toEqual({ kind: 'REREAD_FAILED', http: 503n, detail: 'NOT_FOUND' });
  });

  it('a re-read that returns a different transfer is malformed', async () => {
    const s = setup(makeInbox);
    s.reader.current = transferFixture({ id: 'xfr-20g4k-nsdpo-mg6arrifgvid4orx' });
    const out = await s.handler.handle(s.delivery());
    expect(out).toMatchObject({ kind: 'MALFORMED', http: 400n, alert: true });
    expect(out.kind === 'MALFORMED' ? out.detail : '').toBe(`re-read returned ${WAL}/xfr-20g4k-nsdpo-mg6arrifgvid4orx, not ${WAL}/${XFR}`);
    s.reader.current = transferFixture({ walletId: 'wa-5pfuu-9euek-h0odgb6snva8ph3x' });
    expect(await s.handler.handle(s.delivery())).toMatchObject({ kind: 'MALFORMED' });
  });

  it.each([
    ['not JSON', 'not json'],
    ['an array', '[]'],
    ['no id', JSON.stringify({ kind: 'wallet.transfer.requested', timestampSent: 1701684150 })],
    ['empty id', webhookEventText({ id: '' })],
    ['bad kind', webhookEventText({ kind: 'Wallet Transfer' })],
    ['float timestamp', webhookEventText({ timestampSent: 1701684150.5 })],
    ['string timestamp', webhookEventText({ timestampSent: '1701684150' })],
    ['no data', webhookEventText({ data: null })],
    ['no transferRequest', webhookEventText({ data: {} })],
    ['bad transfer id', webhookEventText({}, transferFixture({ id: 'xfr-1' }))],
    ['bad wallet id', webhookEventText({}, transferFixture({ walletId: 'wa-1' }))],
  ])('a signed but malformed body (%s) is 400 with an alert', async (_n, body) => {
    const s = setup(makeInbox);
    const out = await s.handler.handle(s.request(body));
    expect(out).toMatchObject({ kind: 'MALFORMED', http: 400n, alert: true });
    expect(s.reader.calls).toBe(0);
  });

  it('long event ids and kinds are bounded', async () => {
    const s = setup(makeInbox);
    expect((await s.handler.handle(s.request(webhookEventText({ id: 'i'.repeat(200) })))).kind).toBe('SIGNAL');
    expect((await s.handler.handle(s.request(webhookEventText({ id: 'j'.repeat(201) })))).kind).toBe('MALFORMED');
    expect((await s.handler.handle(s.request(webhookEventText({ id: 'k1', kind: `a${'.b'.repeat(49)}c` })))).kind).toBe('IGNORED');
    expect((await s.handler.handle(s.request(webhookEventText({ id: 'k2', kind: 'a'.repeat(101) })))).kind).toBe('MALFORMED');
  });

  it('the dedupe key and digest equal those of a direct GET of the same state (webhook and poll dedupe to one)', async () => {
    const s = setup(makeInbox);
    const out = await s.handler.handle(s.delivery());
    const t = decodeTransfer(parseJson(JSON.stringify(transferFixture())));
    expect(out.kind === 'SIGNAL' ? [out.signal.dedupeKey, out.signal.payloadDigest] : []).toEqual([transferDedupeKey(t), transferPayloadDigest(t)]);
  });
});
