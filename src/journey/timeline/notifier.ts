/**
 * JTIME: Notifier port. Email is the real channel today; WhatsApp is a later
 * adapter behind this same port. A notification carries no PII: only an opaque
 * recipient reference, a step code and a decimal-string amount. The adapter
 * resolves the reference to an address inside its own boundary.
 * A send never throws into the caller and never touches money state.
 */
export interface Notification {
  /** `ntf:<paymentId>:<step>`; the adapter dedupes on it. */
  readonly key: string;
  readonly recipientRef: string;
  readonly paymentId: string;
  readonly step: string;
  /** Decimal string, never a float. */
  readonly amount: string | null;
}

export type DeliveryResult =
  | { readonly kind: 'SENT'; readonly providerRef: string; readonly replayed: boolean }
  | { readonly kind: 'FAILED'; readonly retryable: boolean };

export interface Notifier {
  send(n: Notification): Promise<DeliveryResult>;
}

/** Wrap a notifier so that a throw or a malformed result becomes FAILED. Fail closed on the notification, never on money. */
export function safeNotifier(inner: Notifier): Notifier {
  return {
    async send(n) {
      try {
        const r = await inner.send(n);
        if (r.kind === 'SENT' || r.kind === 'FAILED') return r;
        return { kind: 'FAILED', retryable: true };
      } catch {
        return { kind: 'FAILED', retryable: true };
      }
    },
  };
}
