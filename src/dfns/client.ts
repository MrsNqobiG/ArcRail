/**
 * F1 DFNS signer adapter: a thin client over an injected HTTP transport and an
 * injected user-action signing function (NOVA_ARC_DESIGN §8.2, §8.3).
 *
 * This module never opens a socket and never holds a key. The composition root
 * injects `DfnsHttpClient` (the transport) and `DfnsCredentials` (the bearer
 * token reader and the challenge signer, both backed by the secret store at
 * runtime, CLAUDE.md rule 2). Tests inject fakes; nothing here calls DFNS.
 *
 * Closed allow-list. Only the method + path templates of §8.2 can be sent
 * (`assertAllowedRequest`). Cancel, speed-up, abort and every other path are
 * refused inside the client, before the transport sees them (§8.2 "DFNS
 * permission fact that limits this").
 *
 * Headers [DF:api-index "API format & HTTP headers"]: `Authorization: Bearer`
 * [DF:transfer securitySchemes `authenticationToken`], `Content-Type:
 * application/json`, a non-empty `User-Agent`; and `X-DFNS-USERACTION` on the
 * state-changing transfer call [DF:transfer securitySchemes `userActionSignature`].
 *
 * User-action signing [DF:flows "Asymmetric Keys signing flow"; DF:action-init;
 * DF:action-sig]: the transfer body is serialised once, that exact text is the
 * `userActionPayload` of the challenge and the body of the POST, so the bytes we
 * sign are the bytes we send (§8.3).
 *
 * Results: OK, REJECTED (DFNS answered and did not apply it; `retryable` says
 * whether the same request may be tried again later) or AMBIGUOUS (outcome
 * unknown: resolve by `findTransferByExternalId`, never by a fresh request).
 */
import { type JsonValue, jsonObject, canonicalJson, parseJson } from './json.js';
import {
  type DfnsBaseUrl,
  type DfnsEip1559Fees,
  type DfnsTransfer,
  type DfnsTransferBody,
  type DfnsWallet,
  type DfnsWalletAssets,
  DFNS_ARC_TESTNET,
  DfnsBodyError,
  DFNS_BASE_URLS,
  TRANSFER_ID,
  WALLET_ID,
  decodeChallenge,
  decodeFees,
  decodeTransfer,
  decodeTransferPage,
  decodeUserAction,
  bodyTextDigest,
  decodeWallet,
  decodeWalletAssets,
  transferBodyText,
} from './types.js';

// ---------------------------------------------------------------------------
// Injected dependencies.
// ---------------------------------------------------------------------------

export type HttpMethod = 'GET' | 'POST';

export interface DfnsHttpRequest {
  readonly method: HttpMethod;
  /** Absolute URL: the configured base URL plus an allow-listed path. */
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
}

/** What the transport saw. `status` is a bigint (MC-01); header names are lower-case. */
export type DfnsHttpOutcome =
  | { readonly kind: 'RESPONSE'; readonly status: bigint; readonly headers: Readonly<Record<string, string>>; readonly body: string }
  | { readonly kind: 'TIMEOUT' }
  | { readonly kind: 'TRANSPORT_ERROR'; readonly detail: string };

/** The injected HTTP transport. The production one is Nova's (K-00c); tests use fakes. */
export interface DfnsHttpClient {
  send(req: DfnsHttpRequest): Promise<DfnsHttpOutcome>;
}

/** A signed user-action challenge for credential kind `Key` [DF:action-sig "Key Credential"]. */
export interface SignedChallenge {
  readonly credId: string;
  readonly clientData: string;
  readonly signature: string;
}

/**
 * The injected secrets. The token and the private key live in the secret store and are
 * read only at runtime by the running service; this module never sees the key itself.
 * The `clientData` encoding is the signer's concern (Q-N7).
 */
export interface DfnsCredentials {
  authToken(): Promise<string>;
  signUserActionChallenge(input: { readonly challenge: string; readonly credId: string }): Promise<SignedChallenge>;
}

export interface DfnsClientConfig {
  readonly baseUrl: DfnsBaseUrl;
  readonly userAgent: string;
  /** Page size for List Transfers, 1–500 [DF:list-transfers `limit`]. */
  readonly listPageLimit: bigint;
  /** Most pages `findTransferByExternalId` reads before answering AMBIGUOUS. */
  readonly maxListPages: bigint;
}

// ---------------------------------------------------------------------------
// Results.
// ---------------------------------------------------------------------------

export type DfnsRejectCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'PAYMENT_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'GONE'
  | 'PRECONDITION_FAILED'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'CLIENT_ERROR'
  | 'USER_ACTION_FAILED';

export type DfnsResult<T> =
  | { readonly kind: 'OK'; readonly value: T }
  | {
      readonly kind: 'REJECTED';
      readonly code: DfnsRejectCode;
      readonly httpStatus: bigint | null;
      readonly retryable: boolean;
      /** From `Retry-After` on 429 [DF:rate], in seconds; else null. */
      readonly retryAfterSeconds: bigint | null;
      readonly detail: string;
    }
  | { readonly kind: 'AMBIGUOUS'; readonly cause: 'TIMEOUT' | 'TRANSPORT' | 'UNAVAILABLE' | 'BAD_RESPONSE'; readonly detail: string };

/** Programming errors only: a request outside the allow-list, or bad configuration. */
export class DfnsClientError extends Error {
  override readonly name = 'DfnsClientError';
}

// ---------------------------------------------------------------------------
// Closed allow-list (§8.2).
//
// Recorded gap (§8.2 row "Approval detail"): `GET /v2/policy-approvals/{approvalId}`
// is named in the archive only by method, path and permission
// (`Policies:Evaluations:Read`) [DF:perms]; its response schema is not archived,
// so no decoder can be written without inventing fields (CLAUDE.md rule 5). It
// stays off this list. Consequence, per the design's own fallback (§8.6, Q-N3):
// every DFNS `Rejected` maps to REJECTED / APPROVAL_DENIED with
// `approvalUnverified: true` and pages, and an approval expiry is not reported
// as EXPIRED / APPROVAL_EXPIRED until the page is archived and this list grows.
// ---------------------------------------------------------------------------

const W = 'wa-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}';
const X = 'xfr-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}';
const ALLOWED: readonly { readonly method: HttpMethod; readonly path: RegExp }[] = [
  { method: 'GET', path: new RegExp(`^/wallets/${W}$`) }, // DF:get-wallet
  { method: 'GET', path: new RegExp(`^/wallets/${W}/assets$`) }, // DF:assets (no `netWorth`)
  { method: 'GET', path: /^\/networks\/fees\?network=ArcTestnet$/ }, // DF:fees
  { method: 'POST', path: new RegExp(`^/wallets/${W}/transfers$`) }, // DF:transfer
  { method: 'GET', path: new RegExp(`^/wallets/${W}/transfers/${X}$`) }, // DF:get-transfer
  { method: 'GET', path: new RegExp('^/wallets/' + W + "/transfers\\?limit=[1-9][0-9]{0,2}(&paginationToken=[A-Za-z0-9%._~!*'()-]+)?$") }, // DF:list-transfers
  { method: 'POST', path: /^\/auth\/action\/init$/ }, // DF:action-init
  { method: 'POST', path: /^\/auth\/action$/ }, // DF:action-sig
];

/** Throws unless (method, path) is one of the §8.2 templates. */
export function assertAllowedRequest(method: HttpMethod, path: string): void {
  if (!ALLOWED.some((a) => a.method === method && a.path.test(path))) {
    throw new DfnsClientError(`DFNS request not on the allow-list: ${method} ${path}`);
  }
}

// ---------------------------------------------------------------------------
// Response classification [DF:errors].
// ---------------------------------------------------------------------------

const REJECT_CODES: ReadonlyMap<bigint, DfnsRejectCode> = new Map([
  [400n, 'BAD_REQUEST'],
  [401n, 'UNAUTHORIZED'],
  [402n, 'PAYMENT_REQUIRED'],
  [403n, 'FORBIDDEN'],
  [404n, 'NOT_FOUND'],
  [409n, 'CONFLICT'],
  [410n, 'GONE'],
  [412n, 'PRECONDITION_FAILED'],
  [422n, 'UNPROCESSABLE'],
  [429n, 'RATE_LIMITED'],
]);

function retryAfter(headers: Readonly<Record<string, string>>): bigint | null {
  const v = headers['retry-after'];
  return v !== undefined && /^[0-9]{1,6}$/.test(v) ? BigInt(v) : null;
}

/** Map one HTTP outcome to a result, decoding a 2xx body with `decode`. */
export function classify<T>(outcome: DfnsHttpOutcome, decode: (v: JsonValue) => T): DfnsResult<T> {
  if (outcome.kind === 'TIMEOUT') return { kind: 'AMBIGUOUS', cause: 'TIMEOUT', detail: 'no response' };
  if (outcome.kind === 'TRANSPORT_ERROR') return { kind: 'AMBIGUOUS', cause: 'TRANSPORT', detail: outcome.detail };
  const s = outcome.status;
  if (s >= 200n && s <= 299n) {
    try {
      return { kind: 'OK', value: decode(parseJson(outcome.body)) };
    } catch (e: unknown) {
      return { kind: 'AMBIGUOUS', cause: 'BAD_RESPONSE', detail: `${s} with an undecodable body: ${String(e)}` };
    }
  }
  if (s >= 400n && s <= 499n) {
    const code = REJECT_CODES.get(s) ?? 'CLIENT_ERROR';
    return {
      kind: 'REJECTED',
      code,
      httpStatus: s,
      retryable: code === 'RATE_LIMITED',
      retryAfterSeconds: code === 'RATE_LIMITED' ? retryAfter(outcome.headers) : null,
      detail: outcome.body.slice(0, 500),
    };
  }
  // 5xx and anything unexpected: DFNS may or may not have applied it [DF:errors "500"].
  return { kind: 'AMBIGUOUS', cause: 'UNAVAILABLE', detail: `HTTP ${s}` };
}

// ---------------------------------------------------------------------------
// The client.
// ---------------------------------------------------------------------------

export class DfnsClient {
  private readonly config: DfnsClientConfig;

  constructor(
    config: DfnsClientConfig,
    private readonly http: DfnsHttpClient,
    private readonly credentials: DfnsCredentials,
  ) {
    if (!DFNS_BASE_URLS.includes(config.baseUrl)) throw new DfnsClientError(`unknown DFNS base URL ${config.baseUrl}`);
    if (!/\S/.test(config.userAgent)) throw new DfnsClientError('User-Agent must not be empty [DF:api-index]');
    if (config.listPageLimit < 1n || config.listPageLimit > 500n) throw new DfnsClientError('listPageLimit must be 1–500 [DF:list-transfers]');
    if (config.maxListPages < 1n) throw new DfnsClientError('maxListPages must be at least 1');
    this.config = Object.freeze({ ...config });
  }

  private async send(method: HttpMethod, path: string, body: string | null, userAction: string | null): Promise<DfnsHttpOutcome> {
    assertAllowedRequest(method, path);
    const token = await this.credentials.authToken();
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': this.config.userAgent,
    };
    if (userAction !== null) headers['x-dfns-useraction'] = userAction;
    return this.http.send({ method, url: `${this.config.baseUrl}${path}`, headers, body });
  }

  /** `GET /wallets/{walletId}` [DF:get-wallet]. */
  async getWallet(walletId: string): Promise<DfnsResult<DfnsWallet>> {
    requireId(walletId, WALLET_ID, 'walletId');
    return classify(await this.send('GET', `/wallets/${walletId}`, null, null), decodeWallet);
  }

  /**
   * `GET /wallets/{walletId}/assets` [DF:assets], the D1 balance read (§8.2 "Balance"). `netWorth`
   * is never requested. DFNS returns "the latest balance recorded by the DFNS indexer, not a live
   * read from the chain" (docs/sources/dfns/guides_developers_displaying-balances.md "Balance
   * freshness"), so this is for display and reconciliation cross-checks only, never a crediting
   * source (our own indexer is canonical, CLAUDE.md "DFNS facts").
   */
  async getWalletAssets(walletId: string): Promise<DfnsResult<DfnsWalletAssets>> {
    requireId(walletId, WALLET_ID, 'walletId');
    return classify(await this.send('GET', `/wallets/${walletId}/assets`, null, null), (v) => decodeWalletAssets(v, walletId));
  }

  /** `GET /networks/fees?network=ArcTestnet` [DF:fees]. Testnet only. */
  async getFees(): Promise<DfnsResult<DfnsEip1559Fees>> {
    return classify(await this.send('GET', `/networks/fees?network=${DFNS_ARC_TESTNET}`, null, null), decodeFees);
  }

  /** `GET /wallets/{walletId}/transfers/{transferId}` [DF:get-transfer]. */
  async getTransfer(walletId: string, transferId: string): Promise<DfnsResult<DfnsTransfer>> {
    requireId(walletId, WALLET_ID, 'walletId');
    requireId(transferId, TRANSFER_ID, 'transferId');
    return classify(await this.send('GET', `/wallets/${walletId}/transfers/${transferId}`, null, null), decodeTransfer);
  }

  /**
   * Look for the transfer created with `externalId`, by paging List Transfers [DF:list-transfers].
   *
   * OK(transfer): DFNS holds an entity with this externalId; it resolves an UNRESOLVED leg
   * (§8.4 check 3). OK(null): every page was read and none showed it. That is NOT proof that no
   * entity exists: DFNS does not document List Transfers as complete and immediately consistent
   * (Q-N21), so "a listing that does not show it proves nothing" (§8.4 check 3). Its only safe
   * use is to go on to an identical re-POST of the marker's bytes; it never ends a leg and never
   * allows P6. A page cap or any failure is AMBIGUOUS.
   */
  async findTransferByExternalId(walletId: string, externalId: string): Promise<DfnsResult<DfnsTransfer | null>> {
    requireId(walletId, WALLET_ID, 'walletId');
    let token: string | null = null;
    for (let page = 1n; page <= this.config.maxListPages; page += 1n) {
      const query: string = token === null ? '' : `&paginationToken=${encodeURIComponent(token)}`;
      const r = classify(
        await this.send('GET', `/wallets/${walletId}/transfers?limit=${this.config.listPageLimit.toString(10)}${query}`, null, null),
        decodeTransferPage,
      );
      if (r.kind !== 'OK') return r.kind === 'AMBIGUOUS' ? r : { kind: 'AMBIGUOUS', cause: 'UNAVAILABLE', detail: `list failed: ${r.code}` };
      const hit = r.value.items.find((t) => t.externalId === externalId);
      if (hit !== undefined) return { kind: 'OK', value: hit };
      if (r.value.nextPageToken === null) return { kind: 'OK', value: null };
      token = r.value.nextPageToken;
    }
    return { kind: 'AMBIGUOUS', cause: 'UNAVAILABLE', detail: `externalId not found within ${this.config.maxListPages} pages` };
  }

  /**
   * `POST /wallets/{walletId}/transfers` with a user-action signature [DF:transfer; DF:flows].
   * `expectedBodyDigest` is the submit marker's `bodyDigest` (§7.3): the body is serialised once
   * and nothing is sent unless sha256 of those exact bytes equals it, so the bytes signed and
   * POSTed are the bytes the marker committed (a mismatch throws `DfnsBodyError`, a programming
   * error; no request is made).
   * A failure before the transfer POST is REJECTED `USER_ACTION_FAILED` (nothing was sent,
   * retryable). The POST itself: 409 is an `externalId` conflict [DF:idem] (not retryable);
   * a timeout, transport error, 5xx or undecodable 2xx is AMBIGUOUS. A `202` is decoded like
   * a `200` (Q-N11); if its body is not a TransferRequest it is AMBIGUOUS.
   */
  async createTransfer(walletId: string, body: DfnsTransferBody, expectedBodyDigest: string): Promise<DfnsResult<DfnsTransfer>> {
    requireId(walletId, WALLET_ID, 'walletId');
    const path = `/wallets/${walletId}/transfers`;
    const text = transferBodyText(body);
    if (bodyTextDigest(text) !== expectedBodyDigest) throw new DfnsBodyError('transfer body does not match the submit marker bodyDigest');

    const initText = canonicalJson(
      jsonObject([
        ['userActionServerKind', 'Api'],
        ['userActionHttpMethod', 'POST'],
        ['userActionHttpPath', path],
        ['userActionPayload', text],
      ]),
    );
    const challenge = classify(await this.send('POST', '/auth/action/init', initText, null), decodeChallenge);
    if (challenge.kind !== 'OK') return userActionFailed('init', challenge);

    const signed = await this.credentials.signUserActionChallenge({ challenge: challenge.value.challenge, credId: challenge.value.credId });
    const actionText = canonicalJson(
      jsonObject([
        ['challengeIdentifier', challenge.value.challengeIdentifier],
        [
          'firstFactor',
          jsonObject([
            ['kind', 'Key'],
            [
              'credentialAssertion',
              jsonObject([
                ['credId', signed.credId],
                ['clientData', signed.clientData],
                ['signature', signed.signature],
              ]),
            ],
          ]),
        ],
      ]),
    );
    const action = classify(await this.send('POST', '/auth/action', actionText, null), decodeUserAction);
    if (action.kind !== 'OK') return userActionFailed('action', action);

    return classify(await this.send('POST', path, text, action.value), decodeTransfer);
  }
}

function requireId(value: string, pattern: RegExp, what: string): void {
  if (!pattern.test(value)) throw new DfnsClientError(`${what} does not match ${pattern.source}`);
}

function userActionFailed(step: string, r: Exclude<DfnsResult<unknown>, { readonly kind: 'OK' }>): DfnsResult<never> {
  const detail = r.kind === 'REJECTED' ? `${r.code}: ${r.detail}` : `${r.cause}: ${r.detail}`;
  return {
    kind: 'REJECTED',
    code: 'USER_ACTION_FAILED',
    httpStatus: r.kind === 'REJECTED' ? r.httpStatus : null,
    retryable: true,
    retryAfterSeconds: r.kind === 'REJECTED' ? r.retryAfterSeconds : null,
    detail: `user-action ${step} failed, transfer not sent: ${detail}`,
  };
}
