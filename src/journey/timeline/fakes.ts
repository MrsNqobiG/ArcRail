/**
 * JTIME: two structurally different Notifier fakes.
 * - EmailNotifier: renders subject/body text, resolves the recipient ref to a
 *   mailbox in a directory it owns, dedupes by key, outcome is synchronous.
 * - WebhookNotifier: posts a JSON payload signed with HMAC-SHA256 over the
 *   body to a configured endpoint with attempt counting; delivery is
 *   at-least-once (a replay re-posts nothing: a delivery log by key).
 * Test secrets are throwaway literals.
 */
import { createHmac } from 'node:crypto';
import type { DeliveryResult, Notification, Notifier } from './notifier.js';

export interface SentEmail {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly key: string;
}

export class EmailNotifier implements Notifier {
  readonly outbox: SentEmail[] = [];
  private readonly byKey = new Map<string, string>();
  failNext = 0n;
  constructor(private readonly directory: ReadonlyMap<string, string>) {}

  send(n: Notification): Promise<DeliveryResult> {
    const prior = this.byKey.get(n.key);
    if (prior !== undefined) return Promise.resolve({ kind: 'SENT', providerRef: prior, replayed: true });
    if (this.failNext > 0n) {
      this.failNext -= 1n;
      return Promise.resolve({ kind: 'FAILED', retryable: true });
    }
    const to = this.directory.get(n.recipientRef);
    if (to === undefined) return Promise.resolve({ kind: 'FAILED', retryable: false });
    const amt = n.amount === null ? '' : ` Amount: ${n.amount}.`;
    this.outbox.push({ to, subject: `Payment update: ${n.step}`, body: `Your payment ${n.paymentId} reached ${n.step}.${amt}`, key: n.key });
    const ref = `mail-${String(this.outbox.length)}`;
    this.byKey.set(n.key, ref);
    return Promise.resolve({ kind: 'SENT', providerRef: ref, replayed: false });
  }
}

export interface WebhookPost {
  readonly url: string;
  readonly body: string;
  readonly signature: string;
  readonly attempt: bigint;
}

export class WebhookNotifier implements Notifier {
  readonly posts: WebhookPost[] = [];
  private readonly delivered = new Map<string, string>();
  private readonly attempts = new Map<string, bigint>();
  /** Status codes returned by the endpoint, consumed in order; empty means 200. */
  responses: number[] = [];
  /** When true the transport throws (timeout). */
  throwNext = false;
  constructor(private readonly url: string, private readonly secret: string) {}

  send(n: Notification): Promise<DeliveryResult> {
    const prior = this.delivered.get(n.key);
    if (prior !== undefined) return Promise.resolve({ kind: 'SENT', providerRef: prior, replayed: true });
    const attempt = (this.attempts.get(n.key) ?? 0n) + 1n;
    this.attempts.set(n.key, attempt);
    if (this.throwNext) {
      this.throwNext = false;
      return Promise.reject(new Error('transport timeout'));
    }
    const body = JSON.stringify({ id: n.key, payment: n.paymentId, step: n.step, amount: n.amount, recipient: n.recipientRef });
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');
    this.posts.push({ url: this.url, body, signature, attempt });
    const code = this.responses.shift() ?? 200;
    if (code >= 200 && code < 300) {
      const ref = `wh-${signature.slice(0, 12)}`;
      this.delivered.set(n.key, ref);
      return Promise.resolve({ kind: 'SENT', providerRef: ref, replayed: false });
    }
    return Promise.resolve({ kind: 'FAILED', retryable: code >= 500 || code === 429 });
  }
}
