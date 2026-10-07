/**
 * TEST SUPPORT (not a money path). Fake DFNS #1: a stateful simulator behind the
 * `DfnsHttpClient` port. It enforces the documented contract the client relies on:
 *  - bearer token on every call, non-empty User-Agent [DF:api-index];
 *  - the user-action flow: a challenge bound to (method, path, payload), signed,
 *    exchanged for a single-use token that must accompany exactly that request
 *    [DF:flows; DF:action-init; DF:action-sig];
 *  - `externalId` idempotency: same body → the existing entity with 200, a
 *    different body → 409 [DF:idem];
 *  - statuses Pending → Executing → Broadcasted → Confirmed / Failed / Rejected [DF:transfer].
 * Faults can be injected per request. It never touches a network.
 */
import { randomBytes } from 'node:crypto';
import type { DfnsHttpClient, DfnsHttpOutcome, DfnsHttpRequest } from '../client.js';
import { errorBody, feesFixture, walletAssetsFixture, walletFixture } from './fixtures.js';

export interface SimulatedChallengeCheck {
  /** Verify a signed challenge (tests verify a real signature from a throwaway key). */
  (challenge: string, signed: { readonly credId: string; readonly clientData: string; readonly signature: string }): boolean;
}

export type Fault = { readonly match: (req: DfnsHttpRequest) => boolean; readonly outcome: DfnsHttpOutcome | 'APPLY_THEN_TIMEOUT' };

interface StoredTransfer {
  body: string;
  record: Record<string, unknown>;
}

const json = (status: bigint, body: unknown, headers: Record<string, string> = {}): DfnsHttpOutcome => ({
  kind: 'RESPONSE',
  status,
  headers,
  body: JSON.stringify(body),
});
const err = (status: bigint, message: string): DfnsHttpOutcome => ({ kind: 'RESPONSE', status, headers: {}, body: errorBody(Number(status), message) });
const id = (prefix: string): string => `${prefix}-${randomBytes(3).toString('hex').slice(0, 5)}-${randomBytes(3).toString('hex').slice(0, 5)}-${randomBytes(8).toString('hex').slice(0, 16)}`;

export class DfnsSimulator implements DfnsHttpClient {
  readonly requests: DfnsHttpRequest[] = [];
  readonly wallets = new Map<string, Record<string, unknown>>();
  readonly faults: Fault[] = [];
  feeStandardMaxFeePerGas = '1626000000000';
  feeNetwork = 'ArcTestnet';
  private readonly transfers = new Map<string, StoredTransfer>();
  private readonly challenges = new Map<string, { challenge: string; method: string; path: string; payload: string; credId: string }>();
  private readonly userActions = new Map<string, { method: string; path: string; payload: string }>();

  constructor(
    private readonly authToken: string,
    private readonly credId: string,
    private readonly checkSignature: SimulatedChallengeCheck,
  ) {}

  addWallet(over: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
    const w = walletFixture(over);
    this.wallets.set(String(w['id']), w);
    return w;
  }

  transfer(transferId: string): Record<string, unknown> {
    const t = this.transfers.get(transferId);
    if (t === undefined) throw new Error(`no transfer ${transferId}`);
    return t.record;
  }

  allTransfers(): Record<string, unknown>[] {
    return [...this.transfers.values()].map((t) => t.record);
  }

  /** Move a transfer to a new status with extra fields (approve, broadcast, confirm, fail, reject). */
  setStatus(transferId: string, status: string, extra: Readonly<Record<string, unknown>> = {}): void {
    Object.assign(this.transfer(transferId), { status, ...extra });
  }

  async send(req: DfnsHttpRequest): Promise<DfnsHttpOutcome> {
    this.requests.push(req);
    const faultAt = this.faults.findIndex((f) => f.match(req));
    const fault = faultAt >= 0 ? this.faults.splice(faultAt, 1)[0] : undefined;
    if (fault !== undefined && fault.outcome !== 'APPLY_THEN_TIMEOUT') return fault.outcome;
    const out = this.route(req);
    return fault === undefined ? out : { kind: 'TIMEOUT' };
  }

  private route(req: DfnsHttpRequest): DfnsHttpOutcome {
    if (req.headers['authorization'] !== `Bearer ${this.authToken}`) return err(401n, 'unauthorized');
    if (!/\S/.test(req.headers['user-agent'] ?? '')) return err(400n, 'user-agent required');
    const url = new URL(req.url);
    const path = url.pathname + url.search;
    let m: RegExpExecArray | null;

    if (req.method === 'POST' && path === '/auth/action/init') {
      const b = JSON.parse(req.body ?? '{}') as Record<string, string>;
      const challenge = randomBytes(32).toString('base64url');
      const challengeIdentifier = randomBytes(24).toString('base64url');
      this.challenges.set(challengeIdentifier, {
        challenge,
        method: String(b['userActionHttpMethod']),
        path: String(b['userActionHttpPath']),
        payload: String(b['userActionPayload']),
        credId: this.credId,
      });
      return json(200n, {
        challenge,
        challengeIdentifier,
        supportedCredentialKinds: [{ kind: 'Key', factor: 'first', requiresSecondFactor: false }],
        userVerification: 'required',
        attestation: 'direct',
        allowCredentials: { key: [{ type: 'public-key', id: this.credId }], webauthn: [] },
        externalAuthenticationUrl: '',
      });
    }
    if (req.method === 'POST' && path === '/auth/action') {
      const b = JSON.parse(req.body ?? '{}') as { challengeIdentifier: string; firstFactor: { kind: string; credentialAssertion: { credId: string; clientData: string; signature: string } } };
      const c = this.challenges.get(b.challengeIdentifier);
      this.challenges.delete(b.challengeIdentifier);
      if (c === undefined || b.firstFactor.kind !== 'Key' || b.firstFactor.credentialAssertion.credId !== c.credId) return err(401n, 'bad challenge');
      if (!this.checkSignature(c.challenge, b.firstFactor.credentialAssertion)) return err(401n, 'bad signature');
      const userAction = randomBytes(24).toString('base64url');
      this.userActions.set(userAction, { method: c.method, path: c.path, payload: c.payload });
      return json(200n, { userAction });
    }
    if (req.method === 'GET' && path === `/networks/fees?network=${this.feeNetwork}`) return json(200n, feesFixture(this.feeStandardMaxFeePerGas, this.feeNetwork));
    if (req.method === 'GET' && (m = /^\/wallets\/([^/?]+)$/.exec(path)) !== null) {
      const w = this.wallets.get(`${m[1]}`);
      return w === undefined ? err(404n, 'wallet not found') : json(200n, w);
    }
    if (req.method === 'GET' && (m = /^\/wallets\/([^/?]+)\/assets$/.exec(path)) !== null) {
      const w = this.wallets.get(`${m[1]}`);
      return w === undefined ? err(404n, 'wallet not found') : json(200n, walletAssetsFixture(`${m[1]}`, { network: w['network'] }));
    }
    if (req.method === 'GET' && (m = /^\/wallets\/([^/?]+)\/transfers\/([^/?]+)$/.exec(path)) !== null) {
      const t = this.transfers.get(`${m[2]}`);
      return t === undefined || t.record['walletId'] !== m[1] ? err(404n, 'transfer not found') : json(200n, t.record);
    }
    if (req.method === 'GET' && (m = /^\/wallets\/([^/?]+)\/transfers$/.exec(url.pathname)) !== null) {
      const walletId = `${m[1]}`;
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const start = Number(url.searchParams.get('paginationToken') ?? '0');
      const all = this.allTransfers().filter((t) => t['walletId'] === walletId);
      const items = all.slice(start, start + limit);
      const next = start + limit < all.length ? { nextPageToken: String(start + limit) } : {};
      return json(200n, { walletId, items, ...next });
    }
    if (req.method === 'POST' && (m = /^\/wallets\/([^/?]+)\/transfers$/.exec(path)) !== null) {
      const walletId = `${m[1]}`;
      const ua = this.userActions.get(req.headers['x-dfns-useraction'] ?? '');
      if (ua === undefined) return err(403n, 'X-DFNS-USERACTION required');
      this.userActions.delete(req.headers['x-dfns-useraction'] ?? '');
      if (ua.method !== 'POST' || ua.path !== path || ua.payload !== req.body) return err(403n, 'user action does not match the request');
      const wallet = this.wallets.get(walletId);
      if (wallet === undefined) return err(404n, 'wallet not found');
      const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
      const externalId = body['externalId'];
      const prior = [...this.transfers.values()].find((t) => t.record['externalId'] === externalId);
      if (prior !== undefined) {
        if (prior.body === req.body && prior.record['walletId'] === walletId) return json(200n, prior.record);
        return err(409n, 'Conflicting transfer with same externalId');
      }
      const transferId = id('xfr');
      const record: Record<string, unknown> = {
        id: transferId,
        walletId,
        network: wallet['network'],
        requester: { userId: id('us') },
        requestBody: body,
        metadata: { asset: { quotes: { USD: 1 } } },
        status: 'Pending',
        dateRequested: new Date(0).toISOString(),
        externalId,
      };
      this.transfers.set(transferId, { body: req.body ?? '', record });
      return json(200n, record);
    }
    return err(404n, `no route ${req.method} ${path}`);
  }
}
