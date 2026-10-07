/**
 * F3 `POST /webhooks/dfns`: authenticity check, dedupe and ordering for DFNS
 * webhooks (NOVA_ARC_DESIGN §8.7, §10.3; failure paths F-13, F-14).
 *
 * A DFNS webhook is a hint, never evidence. The handler:
 *  1. caps the body size and checks the source IP against the configured
 *     DFNS webhook origin list [DF:regions "Webhook origin IP"] (a second layer);
 *  2. requires `X-DFNS-WEBHOOK-SIGNATURE: sha256=<64 hex>` and compares
 *     HMAC-SHA256(secret, raw body bytes) in constant time [DF:webhooks-guide].
 *     Raw bytes only: DFNS's example HMACs a re-serialisation (Q-N4); until DFNS
 *     confirms, a mismatch fails closed and never falls back;
 *  3. parses the body without floats and rejects `|now − timestampSent| ≥ 300 s`
 *     (the example's REPLAY_ATTACK_TOLERANCE) [DF:webhooks-guide];
 *  4. drops a replay of the same event id (same bytes) without any further call;
 *     DFNS retries carry a new id [DF:events "Deliveries & Retries"], so they are
 *     deduplicated on the entity instead (step 6). Event ids are recorded only
 *     after step 6 committed (see `WebhookDeliveryLogPort`);
 *  5. for `wallet.transfer.*` [DF:events], re-reads the transfer with
 *     `GET /wallets/{walletId}/transfers/{transferId}` and uses only that result,
 *     so a body forged with a leaked secret cannot inject a state DFNS does not hold;
 *  6. refuses a state older than one already committed (DFNS "doesn't guarantee
 *     delivery of events in the order in which they're generated" [DF:events
 *     "Webhook Event Ordering"]), then hands the signal, keyed
 *     `dfns:transfer:<id>:<status>` with the §10.3 projection digest, to the
 *     `DfnsSignalSink`, whose `applySignal` dedupes and applies it atomically.
 *
 * The result carries the HTTP status to answer. DFNS treats anything other than
 * 200 as a failed delivery and retries [DF:events]; we answer 200 only after the
 * sink committed, 401 for authenticity failures, and 503 when the re-read or the
 * sink failed so that DFNS retries. Nothing here completes a payment (§2 rule 6):
 * the signal's source is `DFNS_POLL`.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { DfnsResult } from './client.js';
import { type JsonObject, asObject, parseJson, reqInteger, reqString } from './json.js';
import {
  type DfnsStageSignal,
  type DfnsTransfer,
  TRANSFER_ID,
  WALLET_ID,
  mapTransferStatus,
  transferDedupeKey,
  transferPayloadDigest,
  transferStatusRank,
} from './types.js';

/** Webhook event kinds for transfers [DF:events "Supported Webhook Events"]. */
export const TRANSFER_EVENT_KINDS: readonly string[] = [
  'wallet.transfer.requested',
  'wallet.transfer.failed',
  'wallet.transfer.rejected',
  'wallet.transfer.broadcasted',
  'wallet.transfer.confirmed',
];

/** Largest body accepted, in bytes (our cap; DFNS documents none). */
export const WEBHOOK_MAX_BODY_BYTES = 262_144n;
/** Replay tolerance in seconds: `REPLAY_ATTACK_TOLERANCE = 5 * 60` [DF:webhooks-guide]. */
export const WEBHOOK_TOLERANCE_SECONDS = 300n;

/**
 * The handler's own delivery log (Nova's PostgreSQL). It is NOT the §7.3 inbox that
 * `applySignal` dedupes in: it holds only `dfns:event:<eventId>` replay records and a
 * per-transfer high-water mark, keyed in their own namespace, so they can never make
 * `applySignal` (or the poller, which uses the same §10.3 keys) see a state as DUPLICATE.
 *
 * Ordering contract (NOVA_ARC_DESIGN §7.3 `applySignal`, §8.7 rule 7): the handler only
 * READS this log before handing the signal to the `DfnsSignalSink`, and WRITES it only after
 * the sink has committed. So a crash between the two loses nothing: DFNS retries (with a new
 * event id [DF:events]), the re-read reaches the sink again, and the sink's own inbox answers
 * DUPLICATE if the state was already committed.
 */
export interface WebhookDeliveryLogPort {
  /** The raw-body digest recorded for this event id, or null. */
  eventDigest(eventId: string): Promise<string | null>;
  /** Record an event id after the sink committed (insert-if-absent; a held entry is kept). */
  recordEvent(eventId: string, digest: string): Promise<void>;
  /** The highest (rank, status) committed for this DFNS transfer, or null. */
  highWater(transferId: string): Promise<{ readonly rank: bigint; readonly status: string } | null>;
  /** Raise the mark to (rank, status) if `rank` is strictly higher than the stored rank. */
  raiseHighWater(transferId: string, rank: bigint, status: string): Promise<void>;
}

/** What the sink did with a signal. NOT_COMMITTED: unknown or failed; answer 503 so DFNS retries. */
export type SinkOutcome = 'APPLIED' | 'DUPLICATE' | 'STALE' | 'SIGNAL_CONFLICT' | 'NOT_COMMITTED';

/**
 * The orchestrator's entry point, backed by `PaymentStorePort.applySignal` (§7.3): it finds the
 * payment by the transfer's externalId, maps the status with the recorded abort evidence, and
 * atomically dedupes the signal in the §7.3 inbox and applies the leg transition.
 */
export interface DfnsSignalSink {
  apply(signal: DfnsTransferSignal): Promise<SinkOutcome>;
}

export interface WebhookClock {
  /** Unix time in whole seconds. */
  nowSeconds(): bigint;
}

export interface WebhookTransferReader {
  getTransfer(walletId: string, transferId: string): Promise<DfnsResult<DfnsTransfer>>;
}

export interface DfnsWebhookConfig {
  /** The webhook secret, read from the secret store at runtime ("returned only once" [DF:webhooks-guide]). */
  readonly secret: Buffer;
  /** DFNS webhook origin IPs for the configured region [DF:regions]. Must not be empty: the layer cannot be configured away. */
  readonly allowedSourceIps: readonly string[];
}

/** Configuration that would switch an authenticity layer off (Lens R m4). Thrown at construction. */
export class WebhookConfigError extends Error {
  override readonly name = 'WebhookConfigError';
}

export interface DfnsWebhookRequest {
  readonly rawBody: Buffer;
  /** Header names lower-case (Node's `IncomingMessage.headers`). */
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly sourceIp: string;
}

/** The signal handed to `applySignal` (§7.3 `InboundSignal`, source `DFNS_POLL`, §8.7 rule 6). */
export interface DfnsTransferSignal {
  readonly source: 'DFNS_POLL';
  readonly dedupeKey: string;
  readonly payloadDigest: string;
  readonly transfer: DfnsTransfer;
  /**
   * `mapTransferStatus(transfer, { abortAccepted: false })`. The handler cannot see operator
   * decisions, so a hash-less `Failed` is always FAILED_UNPROVEN here (never released); the sink
   * re-maps with the recorded ABORT_ACCEPTED decision, if any, before applying.
   */
  readonly mapped: DfnsStageSignal;
  /** The webhook event that woke us; audit only. */
  readonly eventId: string;
}

export type AuthFailure =
  | 'BODY_TOO_LARGE'
  | 'SOURCE_IP'
  | 'NO_SIGNATURE'
  | 'BAD_SIGNATURE_FORMAT'
  | 'SIGNATURE_MISMATCH'
  | 'STALE_TIMESTAMP';

export type WebhookOutcome =
  | { readonly kind: 'AUTH_FAILED'; readonly http: 401n | 413n; readonly reason: AuthFailure; readonly alert: true }
  | { readonly kind: 'MALFORMED'; readonly http: 400n; readonly detail: string; readonly alert: true }
  | { readonly kind: 'REPLAYED_EVENT'; readonly http: 200n; readonly eventId: string }
  | { readonly kind: 'EVENT_ID_CONFLICT'; readonly http: 200n; readonly eventId: string; readonly alert: true }
  | {
      readonly kind: 'IGNORED';
      readonly http: 200n;
      readonly eventKind: string;
      readonly alert: boolean;
      /**
       * Set on `policy.approval.*`: the §8.7 rule 5 approval projection (`dfns:approval:<id>:<status>`)
       * needs `GET /v2/policy-approvals/{approvalId}`, whose response schema is not archived, so it is
       * not in the D1 allow-list (client.ts "Recorded gap", Lens R-1 m2). No money effect: every
       * `Rejected` transfer maps to REJECTED with `approvalUnverified` and pages (§8.6, Q-N3).
       */
      readonly gap: 'APPROVAL_DETAIL_NOT_IN_D1' | null;
    }
  | { readonly kind: 'REREAD_FAILED'; readonly http: 503n; readonly detail: string }
  | { readonly kind: 'NOT_COMMITTED'; readonly http: 503n; readonly dedupeKey: string }
  | { readonly kind: 'SIGNAL'; readonly http: 200n; readonly signal: DfnsTransferSignal }
  | { readonly kind: 'DUPLICATE'; readonly http: 200n; readonly dedupeKey: string }
  | { readonly kind: 'STALE'; readonly http: 200n; readonly dedupeKey: string; readonly seen: string }
  | { readonly kind: 'SIGNAL_CONFLICT'; readonly http: 200n; readonly dedupeKey: string; readonly alert: true };

const SIGNATURE = /^sha256=([0-9a-f]{64})$/;
/** Kinds we subscribe to but only alert on (approvals arrive as hints; their GET is not in the D1 allow-list). */
const HINT_ONLY_PREFIX = 'policy.approval.';

/** True for a zero-byte key (compared as text, so no `number` enters this money path, MC-01). */
const emptyKey = (b: Buffer): boolean => b.toString('hex') === '';

function authFailed(reason: AuthFailure): WebhookOutcome {
  if (reason === 'BODY_TOO_LARGE') return { kind: 'AUTH_FAILED', http: 413n, reason, alert: true };
  return { kind: 'AUTH_FAILED', http: 401n, reason, alert: true };
}

function malformed(detail: string): WebhookOutcome {
  return { kind: 'MALFORMED', http: 400n, detail, alert: true };
}

/** Steps 1–2: size, source IP and HMAC over the raw bytes. Returns null when authentic. */
export function verifyDfnsSignature(req: DfnsWebhookRequest, config: DfnsWebhookConfig): AuthFailure | null {
  // latin1 maps each byte to one UTF-16 unit, so the string length is the byte count.
  if (BigInt(`${req.rawBody.toString('latin1').length}`) > WEBHOOK_MAX_BODY_BYTES) return 'BODY_TOO_LARGE';
  // An empty list admits no source (fail closed); the handler refuses it at construction too.
  if (!config.allowedSourceIps.includes(req.sourceIp)) return 'SOURCE_IP';
  const header = req.headers['x-dfns-webhook-signature'];
  if (header === undefined) return 'NO_SIGNATURE';
  const m = SIGNATURE.exec(header);
  if (m === null) return 'BAD_SIGNATURE_FORMAT';
  // Anyone can compute an HMAC under an empty key, so an empty secret verifies nothing.
  if (emptyKey(config.secret)) return 'SIGNATURE_MISMATCH';
  const expected = createHmac('sha256', config.secret).update(req.rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(`${m[1]}`, 'hex')) ? null : 'SIGNATURE_MISMATCH';
}

export class DfnsWebhookHandler {
  constructor(
    private readonly config: DfnsWebhookConfig,
    private readonly clock: WebhookClock,
    private readonly deliveries: WebhookDeliveryLogPort,
    private readonly dfns: WebhookTransferReader,
    private readonly sink: DfnsSignalSink,
  ) {
    if (emptyKey(config.secret)) throw new WebhookConfigError('the webhook secret is empty: an HMAC under an empty key authenticates anyone');
    if (config.allowedSourceIps.length === 0) throw new WebhookConfigError('allowedSourceIps is empty: name the DFNS webhook origin IPs of the region [DF:regions]');
  }

  async handle(req: DfnsWebhookRequest): Promise<WebhookOutcome> {
    const auth = verifyDfnsSignature(req, this.config);
    if (auth !== null) return authFailed(auth);

    let event: JsonObject;
    let eventId: string;
    let eventKind: string;
    let sent: bigint;
    try {
      event = asObject(parseJson(req.rawBody.toString('utf8')), 'event');
      eventId = reqString(event, 'id', /^.{1,200}$/s);
      eventKind = reqString(event, 'kind', /^[a-z_.]{1,100}$/);
      sent = reqInteger(event, 'timestampSent');
    } catch (e: unknown) {
      return malformed(String(e));
    }
    let age = this.clock.nowSeconds() - sent;
    if (age < 0n) age = -age;
    if (age >= WEBHOOK_TOLERANCE_SECONDS) return authFailed('STALE_TIMESTAMP');

    const rawDigest = `0x${createHash('sha256').update(req.rawBody).digest('hex')}`;
    const seen = await this.deliveries.eventDigest(eventId);
    if (seen === rawDigest) return { kind: 'REPLAYED_EVENT', http: 200n, eventId };
    if (seen !== null) return { kind: 'EVENT_ID_CONFLICT', http: 200n, eventId, alert: true };

    if (!TRANSFER_EVENT_KINDS.includes(eventKind)) {
      await this.deliveries.recordEvent(eventId, rawDigest);
      const hint = eventKind.startsWith(HINT_ONLY_PREFIX);
      return { kind: 'IGNORED', http: 200n, eventKind, alert: !hint, gap: hint ? 'APPROVAL_DETAIL_NOT_IN_D1' : null };
    }

    let walletId: string;
    let transferId: string;
    try {
      const hint = asObject(asObject(event.get('data'), 'data').get('transferRequest'), 'data.transferRequest');
      walletId = reqString(hint, 'walletId', WALLET_ID);
      transferId = reqString(hint, 'id', TRANSFER_ID);
    } catch (e: unknown) {
      return malformed(String(e));
    }

    const read = await this.dfns.getTransfer(walletId, transferId);
    if (read.kind !== 'OK') {
      return { kind: 'REREAD_FAILED', http: 503n, detail: read.kind === 'REJECTED' ? read.code : read.cause };
    }
    const t = read.value;
    if (t.id !== transferId || t.walletId !== walletId) {
      return malformed(`re-read returned ${t.walletId}/${t.id}, not ${walletId}/${transferId}`);
    }

    const dedupeKey = transferDedupeKey(t);
    const rank = transferStatusRank(t.status);
    // The mark only ever holds committed states, so STALE here never drops an uncommitted one.
    const before = await this.deliveries.highWater(t.id);
    if (before !== null && before.rank > rank) return this.done(eventId, rawDigest, { kind: 'STALE', http: 200n, dedupeKey, seen: before.status });
    if (before !== null && before.rank === rank && before.status !== t.status) {
      // Two different terminal states for one transfer: DFNS contradicts itself.
      return this.done(eventId, rawDigest, { kind: 'SIGNAL_CONFLICT', http: 200n, dedupeKey, alert: true });
    }

    const signal: DfnsTransferSignal = {
      source: 'DFNS_POLL',
      dedupeKey,
      payloadDigest: transferPayloadDigest(t),
      transfer: t,
      mapped: mapTransferStatus(t, { abortAccepted: false }),
      eventId,
    };
    const applied = await this.sink.apply(signal);
    // 200 only after the sink's inbox commit (§8.7 rule 7); anything else makes DFNS retry.
    if (applied === 'NOT_COMMITTED') return { kind: 'NOT_COMMITTED', http: 503n, dedupeKey };
    if (applied === 'APPLIED' || applied === 'DUPLICATE') await this.deliveries.raiseHighWater(t.id, rank, t.status);
    if (applied === 'APPLIED') return this.done(eventId, rawDigest, { kind: 'SIGNAL', http: 200n, signal });
    if (applied === 'DUPLICATE') return this.done(eventId, rawDigest, { kind: 'DUPLICATE', http: 200n, dedupeKey });
    if (applied === 'STALE') return this.done(eventId, rawDigest, { kind: 'STALE', http: 200n, dedupeKey, seen: 'a later stage in the payment store' });
    return this.done(eventId, rawDigest, { kind: 'SIGNAL_CONFLICT', http: 200n, dedupeKey, alert: true });
  }

  /** Records the event id (after any sink commit) and returns the outcome. */
  private async done(eventId: string, rawDigest: string, outcome: WebhookOutcome): Promise<WebhookOutcome> {
    await this.deliveries.recordEvent(eventId, rawDigest);
    return outcome;
  }
}
