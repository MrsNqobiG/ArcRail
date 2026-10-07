/**
 * Lens R m3 and m4 for src/dfns/webhook.ts.
 *  - m3: the whole path, webhook → `DfnsClient.getTransfer` → sink, runs against
 *    both DFNS fakes (the stateful simulator and the recorded replayer), and both
 *    delivery-log fakes, instead of a hand-written reader stub.
 *  - m4: a configuration that would switch an authenticity layer off (empty
 *    secret, empty source-IP list) fails closed at construction.
 * The webhook secret, bearer token and signing key are throwaway values
 * generated at test time.
 */
import { createHmac, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type DfnsClientConfig, type DfnsCredentials, type DfnsHttpClient, DfnsClient } from '../../src/dfns/client.js';
import { EXAMPLE_TIMESTAMP_SENT, errorBody, transferFixture, webhookEventText } from '../../src/dfns/fakes/fixtures.js';
import { RecordedDfns, ok200 } from '../../src/dfns/fakes/recorded.js';
import { DfnsSimulator } from '../../src/dfns/fakes/simulator.js';
import { LogDeliveryLog, MapDeliveryLog } from '../../src/dfns/fakes/stores.js';
import { transferBodyDigest } from '../../src/dfns/types.js';
import {
  type DfnsSignalSink,
  type DfnsTransferSignal,
  type DfnsWebhookConfig,
  type SinkOutcome,
  type WebhookDeliveryLogPort,
  DfnsWebhookHandler,
  WebhookConfigError,
} from '../../src/dfns/webhook.js';

const W = 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx';
const TO = '0xb282dc7cde21717f18337a596e91ded00b79b25f';
const HASH = `0x${'cd'.repeat(32)}`;
const DFNS_IP = '35.181.116.68';
const CONFIG: DfnsClientConfig = { baseUrl: 'https://api.dfns.io', userAgent: 'nova-arc-rail/test', listPageLimit: 2n, maxListPages: 1n };
const clock = { nowSeconds: (): bigint => EXAMPLE_TIMESTAMP_SENT + 5n };

class Sink implements DfnsSignalSink {
  readonly inbox = new Map<string, string>();
  readonly applied: DfnsTransferSignal[] = [];
  async apply(s: DfnsTransferSignal): Promise<SinkOutcome> {
    const held = this.inbox.get(s.dedupeKey);
    if (held !== undefined) return held === s.payloadDigest ? 'DUPLICATE' : 'SIGNAL_CONFLICT';
    this.inbox.set(s.dedupeKey, s.payloadDigest);
    this.applied.push(s);
    return 'APPLIED';
  }
}

function keys(): { creds: DfnsCredentials; token: string; credId: string; check: (c: string, s: { clientData: string; signature: string }) => boolean } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const token = randomBytes(24).toString('base64url');
  const credId = `cred-${randomBytes(4).toString('hex')}`;
  return {
    token,
    credId,
    creds: {
      authToken: async () => token,
      signUserActionChallenge: async ({ challenge, credId: c }) => {
        const clientData = Buffer.from(JSON.stringify({ type: 'key.get', challenge, origin: 'https://nova.test', crossOrigin: false }));
        return { credId: c, clientData: clientData.toString('base64url'), signature: sign(null, clientData, privateKey).toString('base64url') };
      },
    },
    check: (c, s) => {
      const data = Buffer.from(s.clientData, 'base64url');
      return (JSON.parse(data.toString('utf8')) as { challenge: string }).challenge === c && verify(null, data, publicKey, Buffer.from(s.signature, 'base64url'));
    },
  };
}

function wire(http: DfnsHttpClient, creds: DfnsCredentials, log: WebhookDeliveryLogPort) {
  const secret = randomBytes(32);
  const sink = new Sink();
  const client = new DfnsClient(CONFIG, http, creds);
  const handler = new DfnsWebhookHandler({ secret, allowedSourceIps: [DFNS_IP] }, clock, log, client, sink);
  const deliver = (eventId: string, kind: string, hint: Record<string, unknown>) => {
    const body = webhookEventText({ id: eventId, kind }, hint);
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    return handler.handle({ rawBody: Buffer.from(body, 'utf8'), headers: { 'x-dfns-webhook-signature': signature }, sourceIp: DFNS_IP });
  };
  return { client, sink, deliver };
}

describe.each([
  ['MapDeliveryLog', () => new MapDeliveryLog()],
  ['LogDeliveryLog', () => new LogDeliveryLog()],
] as const)('m3: webhook → DfnsClient.getTransfer → sink, with %s', (_n, makeLog) => {
  it('fake #1 (simulator): the signal is what DFNS holds, not what the (leaked-secret) body claims; replays and stale states never reach the sink twice', async () => {
    const k = keys();
    const sim = new DfnsSimulator(k.token, k.credId, k.check);
    sim.addWallet();
    const { client, sink, deliver } = wire(sim, k.creds, makeLog());
    const body = { kind: 'Native' as const, to: TO, amount: '1000000000000000000', externalId: 'nv1-e2e' };
    const created = await client.createTransfer(W, body, transferBodyDigest(body));
    if (created.kind !== 'OK') throw new Error(created.kind);
    const id = created.value.id;
    sim.setStatus(id, 'Broadcasted', { txHash: HASH, dateBroadcasted: '2026-10-06T12:00:01.000Z' });
    const before = sim.requests.length;

    const claim = transferFixture({ id, walletId: W, status: 'Confirmed', txHash: `0x${'ee'.repeat(32)}` });
    const out = await deliver('wh-e2e-1', 'wallet.transfer.confirmed', claim);
    expect(out.kind).toBe('SIGNAL');
    if (out.kind !== 'SIGNAL') return;
    expect(out.signal.dedupeKey).toBe(`dfns:transfer:${id}:Broadcasted`);
    expect(out.signal.mapped).toEqual({ kind: 'STAGE', stage: 'SUBMITTED', txHash: HASH, crossCheckOnly: false });
    expect(out.signal.transfer.externalId).toBe('nv1-e2e');
    const reread = sim.requests.slice(before);
    expect(reread.map((r) => [r.method, r.url, r.headers['authorization']])).toEqual([['GET', `https://api.dfns.io/wallets/${W}/transfers/${id}`, `Bearer ${k.token}`]]);

    // The same event again: dropped before any DFNS call.
    expect((await deliver('wh-e2e-1', 'wallet.transfer.confirmed', claim)).kind).toBe('REPLAYED_EVENT');
    expect(sim.requests).toHaveLength(before + 1);
    // A DFNS retry (new id) of the same state: DUPLICATE in the sink.
    expect((await deliver('wh-e2e-2', 'wallet.transfer.broadcasted', claim)).kind).toBe('DUPLICATE');
    // DFNS moves on; then a late `requested` arrives out of order: the GET shows the newer state only.
    sim.setStatus(id, 'Confirmed');
    expect((await deliver('wh-e2e-3', 'wallet.transfer.confirmed', claim)).kind).toBe('SIGNAL');
    expect((await deliver('wh-e2e-4', 'wallet.transfer.requested', claim)).kind).toBe('DUPLICATE');
    expect(sink.applied.map((s) => s.transfer.status)).toEqual(['Broadcasted', 'Confirmed']);
    expect(sink.applied[1]?.mapped).toEqual({ kind: 'STAGE', stage: 'CONFIRMING', txHash: HASH, crossCheckOnly: true });
  });

  it('fake #2 (recorded): the archived example re-read, then a 404 and a timeout answer 503 so DFNS retries', async () => {
    const k = keys();
    const fixture = transferFixture({ status: 'Executing' });
    const path = `/wallets/${String(fixture['walletId'])}/transfers/${String(fixture['id'])}`;
    const rec = new RecordedDfns([
      { method: 'GET', path, check: (r) => expect(r.headers['authorization']).toBe(`Bearer ${k.token}`), respond: ok200(fixture) },
      { method: 'GET', path, respond: { kind: 'RESPONSE', status: 404n, headers: {}, body: errorBody(404, 'not found') } },
      { method: 'GET', path, respond: { kind: 'TIMEOUT' } },
    ]);
    const { sink, deliver } = wire(rec, k.creds, makeLog());
    const hint = transferFixture({ status: 'Confirmed' });
    const out = await deliver('wh-r-1', 'wallet.transfer.confirmed', hint);
    expect(out.kind === 'SIGNAL' ? out.signal.mapped : out).toEqual({ kind: 'STAGE', stage: 'APPROVED', txHash: null, crossCheckOnly: false });
    expect(await deliver('wh-r-2', 'wallet.transfer.confirmed', hint)).toEqual({ kind: 'REREAD_FAILED', http: 503n, detail: 'NOT_FOUND' });
    expect(await deliver('wh-r-3', 'wallet.transfer.confirmed', hint)).toEqual({ kind: 'REREAD_FAILED', http: 503n, detail: 'TIMEOUT' });
    expect(rec.remaining()).toBe(0);
    expect(sink.applied).toHaveLength(1);
  });
});

describe('m4: the handler refuses a configuration that switches an authenticity layer off', () => {
  const make = (config: DfnsWebhookConfig) => () => new DfnsWebhookHandler(config, clock, new MapDeliveryLog(), { getTransfer: async () => ({ kind: 'AMBIGUOUS', cause: 'TIMEOUT', detail: '' }) }, new Sink());
  it('an empty secret', () => {
    expect(make({ secret: Buffer.alloc(0), allowedSourceIps: [DFNS_IP] })).toThrow(WebhookConfigError);
    expect(make({ secret: Buffer.alloc(0), allowedSourceIps: [DFNS_IP] })).toThrow('the webhook secret is empty: an HMAC under an empty key authenticates anyone');
  });
  it('an empty source-IP list', () => {
    expect(make({ secret: randomBytes(32), allowedSourceIps: [] })).toThrow('allowedSourceIps is empty: name the DFNS webhook origin IPs of the region [DF:regions]');
  });
  it('a one-byte secret and one IP are accepted (DFNS documents no secret length)', () => {
    expect(make({ secret: randomBytes(1), allowedSourceIps: [DFNS_IP] })).not.toThrow();
  });
  it('the error is named', () => {
    expect(new WebhookConfigError('x').name).toBe('WebhookConfigError');
  });
});
