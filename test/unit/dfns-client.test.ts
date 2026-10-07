/**
 * F1 DFNS client (src/dfns/client.ts) against two structurally different fake
 * DFNS servers: the stateful simulator and the strict recorded-exchange replayer
 * (src/dfns/fakes/*). Nothing here reaches a network. The bearer token and the
 * service-account key are throwaway values generated at test time.
 */
import { type KeyObject, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  type DfnsClientConfig,
  type DfnsCredentials,
  type DfnsHttpOutcome,
  type DfnsHttpRequest,
  DfnsClient,
  DfnsClientError,
  assertAllowedRequest,
  classify,
} from '../../src/dfns/client.js';
import { errorBody, feesFixture, transferFixture, walletFixture } from '../../src/dfns/fakes/fixtures.js';
import { RecordedDfns, UnexpectedDfnsRequest, ok200 } from '../../src/dfns/fakes/recorded.js';
import { DfnsSimulator } from '../../src/dfns/fakes/simulator.js';
import { type DfnsTransferBody, DfnsBodyError, decodeWallet, transferBodyDigest } from '../../src/dfns/types.js';

const W = 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx';
const TO = '0xb282dc7cde21717f18337a596e91ded00b79b25f';
const CONFIG: DfnsClientConfig = { baseUrl: 'https://api.dfns.io', userAgent: 'nova-arc-rail/test', listPageLimit: 2n, maxListPages: 3n };

/** Throwaway service-account key and token, created per test run, never persisted. */
function testCredentials(): { creds: DfnsCredentials; token: string; credId: string; publicKey: KeyObject; signed: string[] } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const token = randomBytes(24).toString('base64url');
  const credId = `cred-${randomBytes(4).toString('hex')}`;
  const signed: string[] = [];
  const creds: DfnsCredentials = {
    authToken: async () => token,
    signUserActionChallenge: async ({ challenge, credId: c }) => {
      signed.push(challenge);
      // clientData per DF:flows "Sign the challenge" (its shape is Q-N7; the signer owns it).
      const clientData = Buffer.from(JSON.stringify({ type: 'key.get', challenge, origin: 'https://nova.test', crossOrigin: false }));
      return { credId: c, clientData: clientData.toString('base64url'), signature: sign(null, clientData, privateKey).toString('base64url') };
    },
  };
  return { creds, token, credId, publicKey, signed };
}

function simulator() {
  const t = testCredentials();
  const sim = new DfnsSimulator(t.token, t.credId, (challenge, s) => {
    const data = Buffer.from(s.clientData, 'base64url');
    const parsed = JSON.parse(data.toString('utf8')) as { challenge: string };
    return parsed.challenge === challenge && verify(null, data, t.publicKey, Buffer.from(s.signature, 'base64url'));
  });
  sim.addWallet();
  return { sim, client: new DfnsClient(CONFIG, sim, t.creds), ...t };
}

const nativeBody = (externalId = 'nv1-a', amount = '1000000000000000000') => ({ kind: 'Native' as const, to: TO, amount, externalId });
/** The submit marker's bodyDigest for `b`; '0x' for a body that cannot be serialised (the client refuses it first). */
const digestOf = (b: DfnsTransferBody): string => {
  try {
    return transferBodyDigest(b);
  } catch {
    return '0x';
  }
};

describe('allow-list (§8.2)', () => {
  it.each([
    ['GET', `/wallets/${W}`],
    ['GET', '/networks/fees?network=ArcTestnet'],
    ['POST', `/wallets/${W}/transfers`],
    ['GET', `/wallets/${W}/transfers/xfr-20g4k-nsdpo-mg6arrifgvid4orn`],
    ['GET', `/wallets/${W}/transfers?limit=50`],
    ['GET', `/wallets/${W}/transfers?limit=500&paginationToken=abc%3D`],
    ['POST', '/auth/action/init'],
    ['POST', '/auth/action'],
  ] as const)('allows %s %s', (method, path) => {
    expect(() => assertAllowedRequest(method, path)).not.toThrow();
  });

  it.each([
    ['POST', `/wallets/${W}/transfers/xfr-20g4k-nsdpo-mg6arrifgvid4orn/cancel`],
    ['POST', `/wallets/${W}/transfers/xfr-20g4k-nsdpo-mg6arrifgvid4orn/speed-up`],
    ['POST', `/wallets/${W}/transfers/xfr-20g4k-nsdpo-mg6arrifgvid4orn/abort`],
    ['GET', '/networks/fees?network=Arc'],
    ['GET', '/networks/fees?network=ArcTestnet&x=1'],
    ['POST', `/wallets/${W}`],
    ['GET', `/wallets/${W}/transfers`],
    ['GET', `/wallets/${W}/transfers?limit=0`],
    ['GET', `/wallets/${W}/transfers?limit=5000`],
    ['GET', `/wallets/${W}/transfers?limit=5&paginationToken=a&b=c`],
    ['GET', '/wallets/wa-bad'],
    ['GET', `/x/wallets/${W}`],
    ['GET', '/x/networks/fees?network=ArcTestnet'],
    ['POST', `/x/wallets/${W}/transfers`],
    ['GET', `/x/wallets/${W}/transfers/xfr-20g4k-nsdpo-mg6arrifgvid4orn`],
    ['GET', `/x/wallets/${W}/transfers?limit=50`],
    ['POST', '/x/auth/action/init'],
    ['POST', '/x/auth/action'],
    ['GET', `/wallets/${W}x`],
    ['POST', `/wallets/${W}/transfersx`],
    ['GET', `/wallets/${W}/transfers/xfr-20g4k-nsdpo-mg6arrifgvid4ornx`],
    ['POST', '/auth/actionx'],
    ['POST', '/auth/action/init/x'],
    ['GET', '/auth/action'],
    ['POST', '/v2/policy-approvals/ap-2a9in-tt2a1-983lho480p35ejd0'],
  ] as const)('refuses %s %s', (method, path) => {
    expect(() => assertAllowedRequest(method, path)).toThrow(new DfnsClientError(`DFNS request not on the allow-list: ${method} ${path}`));
  });
});

describe('configuration', () => {
  const { creds } = testCredentials();
  const sim = new RecordedDfns([]);
  it.each([
    [{ baseUrl: 'https://api.dfns.ninja' }, 'unknown DFNS base URL'],
    [{ userAgent: ' ' }, 'User-Agent must not be empty'],
    [{ listPageLimit: 0n }, 'listPageLimit must be 1–500'],
    [{ listPageLimit: 501n }, 'listPageLimit must be 1–500'],
    [{ maxListPages: 0n }, 'maxListPages must be at least 1'],
  ])('refuses config %#: %s', (over, message) => {
    expect(() => new DfnsClient({ ...CONFIG, ...over } as DfnsClientConfig, sim, creds)).toThrow(message);
  });
  it('accepts the boundaries and the UAE region', () => {
    expect(() => new DfnsClient({ ...CONFIG, baseUrl: 'https://api.uae.dfns.io', listPageLimit: 500n, maxListPages: 1n }, sim, creds)).not.toThrow();
    expect(() => new DfnsClient({ ...CONFIG, listPageLimit: 1n }, sim, creds)).not.toThrow();
  });
  it('refuses malformed ids before sending anything', async () => {
    const c = new DfnsClient(CONFIG, sim, creds);
    await expect(c.getWallet('wa-x')).rejects.toThrow('walletId does not match');
    await expect(c.getTransfer(W, 'xfr-x')).rejects.toThrow('transferId does not match');
    await expect(c.getTransfer('w', 'xfr-20g4k-nsdpo-mg6arrifgvid4orn')).rejects.toThrow('walletId does not match');
    await expect(c.findTransferByExternalId('w', 'e')).rejects.toThrow('walletId');
    await expect(c.createTransfer('w', nativeBody(), digestOf(nativeBody()))).rejects.toThrow('walletId');
    await expect(c.createTransfer(W, nativeBody('e', '1.5'), digestOf(nativeBody('e', '1.5')))).rejects.toThrow(DfnsBodyError);
    expect(sim.seen).toHaveLength(0);
  });
  it('refuses a body whose digest is not the submit marker bodyDigest, before any request (§7.3)', async () => {
    const c = new DfnsClient(CONFIG, sim, creds);
    await expect(c.createTransfer(W, nativeBody(), digestOf(nativeBody('nv1-a', '2')))).rejects.toThrow('transfer body does not match the submit marker bodyDigest');
    await expect(c.createTransfer(W, nativeBody(), digestOf(nativeBody()).toUpperCase())).rejects.toThrow(DfnsBodyError);
    expect(sim.seen).toHaveLength(0);
  });
});

describe('classify [DF:errors]', () => {
  const resp = (status: bigint, body = '{}', headers: Record<string, string> = {}): DfnsHttpOutcome => ({ kind: 'RESPONSE', status, headers, body });
  const id = (v: unknown) => v;
  it('2xx decodes; a bad body is AMBIGUOUS BAD_RESPONSE', () => {
    expect(classify(resp(200n, '{"a":1}'), id)).toMatchObject({ kind: 'OK' });
    expect(classify(resp(202n, '{}'), id)).toMatchObject({ kind: 'OK' });
    expect(classify(resp(299n, '{}'), id)).toMatchObject({ kind: 'OK' });
    expect(classify(resp(200n, '{'), id)).toMatchObject({ kind: 'AMBIGUOUS', cause: 'BAD_RESPONSE' });
    const bad = classify(resp(201n, '[]'), decodeWallet);
    expect(bad).toMatchObject({ kind: 'AMBIGUOUS', cause: 'BAD_RESPONSE' });
    expect(bad.kind === 'AMBIGUOUS' ? bad.detail : '').toContain('201 with an undecodable body: JsonShapeError: wallet: expected an object');
  });
  it.each([
    [400n, 'BAD_REQUEST'],
    [401n, 'UNAUTHORIZED'],
    [402n, 'PAYMENT_REQUIRED'],
    [403n, 'FORBIDDEN'],
    [404n, 'NOT_FOUND'],
    [409n, 'CONFLICT'],
    [410n, 'GONE'],
    [412n, 'PRECONDITION_FAILED'],
    [422n, 'UNPROCESSABLE'],
    [418n, 'CLIENT_ERROR'],
    [499n, 'CLIENT_ERROR'],
  ] as const)('%s → REJECTED %s, not retryable', (status, code) => {
    expect(classify(resp(status, errorBody(Number(status), 'm')), id)).toEqual({
      kind: 'REJECTED',
      code,
      httpStatus: status,
      retryable: false,
      retryAfterSeconds: null,
      detail: errorBody(Number(status), 'm'),
    });
  });
  it('429 is retryable and carries Retry-After [DF:rate]', () => {
    expect(classify(resp(429n, 'x', { 'retry-after': '30' }), id)).toMatchObject({ code: 'RATE_LIMITED', retryable: true, retryAfterSeconds: 30n });
    expect(classify(resp(429n, 'x', { 'retry-after': 'Wed, 21 Oct 2015' }), id)).toMatchObject({ retryAfterSeconds: null });
    expect(classify(resp(429n, 'x', { 'retry-after': '1234567' }), id)).toMatchObject({ retryAfterSeconds: null });
    expect(classify(resp(429n, 'x', { 'retry-after': '123456' }), id)).toMatchObject({ retryAfterSeconds: 123456n });
    expect(classify(resp(429n, 'x'), id)).toMatchObject({ retryAfterSeconds: null });
  });
  it('Retry-After is read only on 429', () => {
    expect(classify(resp(503n, 'x', { 'retry-after': '30' }), id)).toMatchObject({ kind: 'AMBIGUOUS' });
    expect(classify(resp(400n, 'x', { 'retry-after': '30' }), id)).toMatchObject({ retryAfterSeconds: null });
  });
  it('the allow-list guards the transport itself (defence in depth)', async () => {
    const rec = new RecordedDfns([]);
    const c = new DfnsClient(CONFIG, rec, testCredentials().creds) as unknown as { send(m: string, p: string, b: null, u: null): Promise<unknown> };
    await expect(c.send('POST', `/wallets/${W}/transfers/xfr-20g4k-nsdpo-mg6arrifgvid4orn/cancel`, null, null)).rejects.toThrow(DfnsClientError);
    expect(rec.seen).toHaveLength(0);
  });
  it('a long error body is truncated to 500 characters', () => {
    const r = classify(resp(400n, 'y'.repeat(600)), id);
    expect(r.kind === 'REJECTED' ? r.detail : '').toBe('y'.repeat(500));
  });
  it('5xx, 3xx, 1xx, timeouts and transport errors are AMBIGUOUS', () => {
    expect(classify(resp(500n), id)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE', detail: 'HTTP 500' });
    expect(classify(resp(503n), id)).toMatchObject({ cause: 'UNAVAILABLE' });
    expect(classify(resp(302n), id)).toMatchObject({ cause: 'UNAVAILABLE' });
    expect(classify(resp(199n), id)).toMatchObject({ cause: 'UNAVAILABLE' });
    expect(classify(resp(300n), id)).toMatchObject({ cause: 'UNAVAILABLE' });
    expect(classify(resp(399n), id)).toMatchObject({ cause: 'UNAVAILABLE' });
    expect(classify(resp(500n), id)).toMatchObject({ kind: 'AMBIGUOUS' });
    expect(classify({ kind: 'TIMEOUT' }, id)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT', detail: 'no response' });
    expect(classify({ kind: 'TRANSPORT_ERROR', detail: 'ECONNRESET' }, id)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT', detail: 'ECONNRESET' });
  });
});

describe('fake #1: stateful simulator', () => {
  it('reads a wallet and the fees with the required headers', async () => {
    const { sim, client, token } = simulator();
    const w = await client.getWallet(W);
    expect(w).toEqual({ kind: 'OK', value: { id: W, network: 'ArcTestnet', address: '0x00e3495cf6af59008f22ffaf32d4c92ac33dac47', status: 'Active', vaultId: null } });
    const f = await client.getFees();
    expect(f).toMatchObject({ kind: 'OK', value: { network: 'ArcTestnet', standardMaxFeePerGas: 1626000000000n } });
    for (const r of sim.requests) {
      expect(r.method).toBe('GET');
      expect(r.body).toBeNull();
      expect(r.headers).toEqual({ authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'nova-arc-rail/test' });
    }
    expect(sim.requests.map((r) => r.url)).toEqual([`https://api.dfns.io/wallets/${W}`, 'https://api.dfns.io/networks/fees?network=ArcTestnet']);
  });

  it('missing wallet → REJECTED NOT_FOUND', async () => {
    const { client } = simulator();
    expect(await client.getWallet('wa-aaaaa-bbbbb-cccccccccccccccc')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND', httpStatus: 404n });
  });

  it('creates a transfer through the user-action flow: the signed payload is the sent body', async () => {
    const { sim, client, signed } = simulator();
    const r = await client.createTransfer(W, nativeBody(), digestOf(nativeBody()));
    expect(r.kind).toBe('OK');
    if (r.kind !== 'OK') return;
    expect(r.value).toMatchObject({ walletId: W, network: 'ArcTestnet', status: 'Pending', externalId: 'nv1-a' });
    const [init, action, post] = sim.requests;
    expect(init?.url).toBe('https://api.dfns.io/auth/action/init');
    const initBody = JSON.parse(init?.body ?? '') as Record<string, string>;
    expect(initBody).toEqual({ userActionServerKind: 'Api', userActionHttpMethod: 'POST', userActionHttpPath: `/wallets/${W}/transfers`, userActionPayload: post?.body });
    expect(action?.url).toBe('https://api.dfns.io/auth/action');
    const actionBody = JSON.parse(action?.body ?? '') as { challengeIdentifier: string; firstFactor: { kind: string; credentialAssertion: Record<string, string> } };
    expect(actionBody.firstFactor.kind).toBe('Key');
    expect(Object.keys(actionBody.firstFactor.credentialAssertion).sort()).toEqual(['clientData', 'credId', 'signature']);
    expect(signed).toHaveLength(1);
    expect(init?.headers['x-dfns-useraction']).toBeUndefined();
    expect(action?.headers['x-dfns-useraction']).toBeUndefined();
    expect(post?.headers['x-dfns-useraction']).toMatch(/^.+$/);
    expect(post?.body).toBe(`{"amount":"1000000000000000000","externalId":"nv1-a","kind":"Native","priority":"Standard","to":"${TO}"}`);
  });

  it('a resend with the same externalId and body returns the same entity; a different body is 409 [DF:idem]', async () => {
    const { sim, client } = simulator();
    const a = await client.createTransfer(W, nativeBody(), digestOf(nativeBody()));
    const b = await client.createTransfer(W, nativeBody(), digestOf(nativeBody()));
    expect(a.kind === 'OK' && b.kind === 'OK' && a.value.id === b.value.id).toBe(true);
    expect(sim.allTransfers()).toHaveLength(1);
    expect(await client.createTransfer(W, nativeBody('nv1-a', '2'), digestOf(nativeBody('nv1-a', '2')))).toMatchObject({ kind: 'REJECTED', code: 'CONFLICT', retryable: false });
  });

  it('a timeout after DFNS applied it is AMBIGUOUS, and findTransferByExternalId resolves it', async () => {
    const { sim, client } = simulator();
    sim.faults.push({ match: (r) => r.method === 'POST' && r.url.endsWith('/transfers'), outcome: 'APPLY_THEN_TIMEOUT' });
    expect(await client.createTransfer(W, nativeBody(), digestOf(nativeBody()))).toMatchObject({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    const found = await client.findTransferByExternalId(W, 'nv1-a');
    expect(found.kind === 'OK' && found.value?.externalId).toBe('nv1-a');
  });

  it('findTransferByExternalId pages, proves absence only after the last page, and is AMBIGUOUS past the page cap', async () => {
    const { client } = simulator();
    for (const e of ['e1', 'e2', 'e3', 'e4', 'e5']) expect((await client.createTransfer(W, nativeBody(e), digestOf(nativeBody(e)))).kind).toBe('OK');
    expect(await client.findTransferByExternalId(W, 'e5')).toMatchObject({ kind: 'OK', value: { externalId: 'e5' } });
    expect(await client.findTransferByExternalId(W, 'e3')).toMatchObject({ kind: 'OK', value: { externalId: 'e3' } });
    expect(await client.findTransferByExternalId(W, 'nope')).toEqual({ kind: 'OK', value: null });
    const capped = new DfnsClient({ ...CONFIG, maxListPages: 2n }, (client as unknown as { http: DfnsSimulator }).http, (client as unknown as { credentials: DfnsCredentials }).credentials);
    expect(await capped.findTransferByExternalId(W, 'nope')).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE', detail: 'externalId not found within 2 pages' });
    expect(await capped.findTransferByExternalId(W, 'e4')).toMatchObject({ kind: 'OK', value: { externalId: 'e4' } });
  });

  it('findTransferByExternalId turns a list failure into AMBIGUOUS', async () => {
    const { sim, client } = simulator();
    sim.faults.push({ match: () => true, outcome: { kind: 'RESPONSE', status: 403n, headers: {}, body: '' } });
    expect(await client.findTransferByExternalId(W, 'x')).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE', detail: 'list failed: FORBIDDEN' });
    sim.faults.push({ match: () => true, outcome: { kind: 'TIMEOUT' } });
    expect(await client.findTransferByExternalId(W, 'x')).toMatchObject({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
  });

  it('getTransfer reads state changes', async () => {
    const { sim, client } = simulator();
    const r = await client.createTransfer(W, nativeBody(), digestOf(nativeBody()));
    if (r.kind !== 'OK') throw new Error('create failed');
    sim.setStatus(r.value.id, 'Broadcasted', { txHash: `0x${'cd'.repeat(32)}` });
    expect(await client.getTransfer(W, r.value.id)).toMatchObject({ kind: 'OK', value: { status: 'Broadcasted', txHash: `0x${'cd'.repeat(32)}` } });
  });

  it('a failure before the transfer POST is USER_ACTION_FAILED and nothing is sent', async () => {
    const { sim, client } = simulator();
    sim.faults.push({ match: (r) => r.url.endsWith('/auth/action/init'), outcome: { kind: 'RESPONSE', status: 429n, headers: { 'retry-after': '7' }, body: '' } });
    expect(await client.createTransfer(W, nativeBody(), digestOf(nativeBody()))).toEqual({
      kind: 'REJECTED',
      code: 'USER_ACTION_FAILED',
      httpStatus: 429n,
      retryable: true,
      retryAfterSeconds: 7n,
      detail: 'user-action init failed, transfer not sent: RATE_LIMITED: ',
    });
    sim.faults.push({ match: (r) => r.url.endsWith('/auth/action'), outcome: { kind: 'TIMEOUT' } });
    expect(await client.createTransfer(W, nativeBody(), digestOf(nativeBody()))).toEqual({
      kind: 'REJECTED',
      code: 'USER_ACTION_FAILED',
      httpStatus: null,
      retryable: true,
      retryAfterSeconds: null,
      detail: 'user-action action failed, transfer not sent: TIMEOUT: no response',
    });
    expect(sim.allTransfers()).toHaveLength(0);
    expect(sim.requests.some((r) => r.url.endsWith('/transfers'))).toBe(false);
  });

  it('a wrong signature is refused by DFNS, so no transfer exists', async () => {
    const { sim } = simulator();
    const bad: DfnsCredentials = {
      authToken: async () => (sim as unknown as { authToken: string }).authToken,
      signUserActionChallenge: async ({ credId }) => ({ credId, clientData: Buffer.from('{"challenge":"other"}').toString('base64url'), signature: 'AA' }),
    };
    const r = await new DfnsClient(CONFIG, sim, bad).createTransfer(W, nativeBody(), digestOf(nativeBody()));
    expect(r).toMatchObject({ kind: 'REJECTED', code: 'USER_ACTION_FAILED', httpStatus: 401n });
    expect(sim.allTransfers()).toHaveLength(0);
  });

  it('a wrong bearer token is 401 UNAUTHORIZED', async () => {
    const { sim, creds } = simulator();
    const r = await new DfnsClient(CONFIG, sim, { ...creds, authToken: async () => 'wrong' }).getWallet(W);
    expect(r).toMatchObject({ kind: 'REJECTED', code: 'UNAUTHORIZED' });
  });
});

describe('fake #2: recorded exchanges from the archived DFNS examples', () => {
  const path = `/wallets/${W}/transfers`;
  const { creds } = testCredentials();

  it('getWallet and getFees decode the doc examples', async () => {
    const rec = new RecordedDfns([
      { method: 'GET', path: `/wallets/${W}`, respond: ok200(walletFixture()) },
      { method: 'GET', path: '/networks/fees?network=ArcTestnet', respond: ok200(feesFixture()) },
    ]);
    const c = new DfnsClient(CONFIG, rec, creds);
    expect(await c.getWallet(W)).toMatchObject({ kind: 'OK', value: { network: 'ArcTestnet', status: 'Active' } });
    expect(await c.getFees()).toMatchObject({ kind: 'OK', value: { standardMaxFeePerGas: 1626000000000n } });
    expect(rec.remaining()).toBe(0);
  });

  it('createTransfer runs exactly init → action → POST, and the POST carries the token from /auth/action', async () => {
    const userAction = randomBytes(16).toString('hex');
    let payload = '';
    const rec = new RecordedDfns([
      {
        method: 'POST',
        path: '/auth/action/init',
        check: (r: DfnsHttpRequest) => {
          payload = (JSON.parse(r.body ?? '') as { userActionPayload: string }).userActionPayload;
        },
        respond: ok200({ challenge: 'c-1', challengeIdentifier: 'ci-1', allowCredentials: { key: [{ type: 'public-key', id: 'cred-9' }], webauthn: [] } }),
      },
      {
        method: 'POST',
        path: '/auth/action',
        check: (r) => expect((JSON.parse(r.body ?? '') as { challengeIdentifier: string }).challengeIdentifier).toBe('ci-1'),
        respond: ok200({ userAction }),
      },
      {
        method: 'POST',
        path,
        check: (r) => {
          expect(r.headers['x-dfns-useraction']).toBe(userAction);
          expect(r.body).toBe(payload);
        },
        respond: (r) => ok200(transferFixture({ walletId: W, requestBody: JSON.parse(r.body ?? ''), externalId: 'nv1-a' })),
      },
    ]);
    const r = await new DfnsClient(CONFIG, rec, creds).createTransfer(W, nativeBody(), digestOf(nativeBody()));
    expect(r).toMatchObject({ kind: 'OK', value: { status: 'Pending', externalId: 'nv1-a' } });
    expect(rec.remaining()).toBe(0);
  });

  it('a 202 policy-pending answer with a TransferRequest body is OK; without one it is AMBIGUOUS (Q-N11)', async () => {
    const script = (respond: DfnsHttpOutcome) =>
      new RecordedDfns([
        { method: 'POST', path: '/auth/action/init', respond: ok200({ challenge: 'c', challengeIdentifier: 'i', allowCredentials: { key: [{ id: 'k' }] } }) },
        { method: 'POST', path: '/auth/action', respond: ok200({ userAction: 'u' }) },
        { method: 'POST', path, respond },
      ]);
    const body = JSON.stringify(transferFixture({ walletId: W }));
    expect(await new DfnsClient(CONFIG, script({ kind: 'RESPONSE', status: 202n, headers: {}, body }), creds).createTransfer(W, nativeBody(), digestOf(nativeBody()))).toMatchObject({ kind: 'OK' });
    expect(await new DfnsClient(CONFIG, script({ kind: 'RESPONSE', status: 202n, headers: {}, body: '{}' }), creds).createTransfer(W, nativeBody(), digestOf(nativeBody()))).toMatchObject({
      kind: 'AMBIGUOUS',
      cause: 'BAD_RESPONSE',
    });
    expect(await new DfnsClient(CONFIG, script({ kind: 'RESPONSE', status: 409n, headers: {}, body: errorBody(409, 'Conflicting transfer with same externalId') }), creds).createTransfer(W, nativeBody(), digestOf(nativeBody()))).toMatchObject({
      kind: 'REJECTED',
      code: 'CONFLICT',
    });
    expect(await new DfnsClient(CONFIG, script({ kind: 'RESPONSE', status: 502n, headers: {}, body: '' }), creds).createTransfer(W, nativeBody(), digestOf(nativeBody()))).toMatchObject({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
  });

  it('getTransfer and the paginated list use the documented paths', async () => {
    const rec = new RecordedDfns([
      { method: 'GET', path: `/wallets/${W}/transfers/xfr-20g4k-nsdpo-mg6arrifgvid4orn`, respond: ok200(transferFixture({ walletId: W })) },
      { method: 'GET', path: `/wallets/${W}/transfers?limit=2`, respond: ok200({ walletId: W, items: [transferFixture({ walletId: W })], nextPageToken: 'a b/c' }) },
      { method: 'GET', path: `/wallets/${W}/transfers?limit=2&paginationToken=a%20b%2Fc`, respond: ok200({ walletId: W, items: [transferFixture({ walletId: W, externalId: 'want' })] }) },
    ]);
    const c = new DfnsClient(CONFIG, rec, creds);
    expect(await c.getTransfer(W, 'xfr-20g4k-nsdpo-mg6arrifgvid4orn')).toMatchObject({ kind: 'OK', value: { status: 'Pending' } });
    expect(await c.findTransferByExternalId(W, 'want')).toMatchObject({ kind: 'OK', value: { externalId: 'want' } });
    expect(rec.remaining()).toBe(0);
  });

  it('the replayer itself fails loudly on an unscripted request', async () => {
    const c = new DfnsClient(CONFIG, new RecordedDfns([{ method: 'GET', path: '/networks/fees?network=ArcTestnet', respond: ok200(feesFixture()) }]), creds);
    await expect(c.getWallet(W)).rejects.toThrow(UnexpectedDfnsRequest);
    await expect(new DfnsClient(CONFIG, new RecordedDfns([]), creds).getFees()).rejects.toThrow('unscripted GET');
  });
});
