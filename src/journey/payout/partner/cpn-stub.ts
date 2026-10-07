/**
 * CPN-SHAPED STUB payout partner (Circle Payments Network, Nova's bank as the
 * originating institution). A STUB: it makes no network call and holds no
 * credential, because the partner agreement is pending and we never call Circle
 * APIs from here. It fixes only the SHAPE a real adapter must keep, and every
 * fact in it is cited to the archived CPN docs (docs/sources/circle/cpn/):
 *
 *  - Callback envelope: `{subscriptionId, notificationId, notificationType,
 *    notification, timestamp, version}`; `notification` has the schema of the
 *    API object (Payment, RFI, Transaction or Refund)
 *    [references_webhooks_webhook-events.md].
 *  - Payment events and states: `cpn.payment.cryptoFundsPending`,
 *    `.fiatPaymentInitiated`, `.completed`, `.failed`, `.delayed`,
 *    `.inManualReview`; payment states CREATED, CRYPTO_FUNDS_PENDING,
 *    FIAT_PAYMENT_INITIATED, COMPLETED, FAILED
 *    [references_webhooks_webhook-events.md; concepts_payments_component-states-and-workflows.md].
 *  - A payment object carries `id` and `status` [quickstarts_integrate-with-cpn-ofi.md, "2.3. Create a payment"].
 *  - Refund events `cpn.refund.created|failed|completed`: a refund is the BFI
 *    returning the crypto to the OFI's refund address when it cannot deliver
 *    fiat [component-states-and-workflows.md "Refunds"; concepts_payments_payments.md].
 *  - Webhooks must be validated against Circle-provided public keys
 *    [concepts_api_api-integration.md "Security notes"]. The archive does not
 *    name the header, the algorithm or the signed bytes, so none is assumed:
 *    the signature check is an INJECTED function over the raw body and headers
 *    (open question, docs/OPEN_QUESTIONS.md Q-N12), and the source IP allow-list the
 *    docs list is a second layer for the HTTP edge, not for this class.
 *
 * Mapping to our PartnerPayoutState: `cpn.payment.completed` is PAID (the
 * partner's payout-complete confirmation; the docs note the receiver may not
 * yet hold the money for some payment methods, which is why ARRIVED is the
 * only user-visible claim and Nova words it accordingly); `cpn.payment.failed`
 * is FAILED; `cpn.refund.completed` is RETURNED; `cpn.refund.failed` is REFUND_FAILED (a report for Ops, never ignored); the other payment events are
 * PENDING (progress, no state change). Anything else, authentic or not, is
 * IGNORED. `completed` and `failed` are cross-checked against the object's
 * own `status` and refused if they disagree. The Refund object's field that
 * names its payment is NOT in the archive, so it is an injected extractor and
 * refund events fail closed (MALFORMED) without one.
 */
import { JsonObject, asObject, reqString } from '../../../dfns/json.js';
import { ok, rejected } from '../../../nova-ports/ids.js';
import type { PortResult } from '../../../nova-ports/ids.js';
import { PartnerCore, decodeBodyObject } from './core.js';
import type { PartnerCoreOptions } from './core.js';
import type { CallbackRejectCode, PartnerCallback, PartnerPayoutState } from './port.js';

export interface CpnStubOptions extends PartnerCoreOptions {
  /** Validates the callback against Circle's public keys (raw body, headers). Scheme unknown until the agreement. */
  readonly verifySignature: (rawBody: Uint8Array, headers: Readonly<Record<string, string>>) => boolean;
  /** Reads the payment id out of a Refund `notification` object; null when absent. Field unknown until the agreement. */
  readonly refundPaymentId?: (notification: JsonObject) => string | null;
}

const TOKEN = /^[\x21-\x7e]{1,128}$/;

/** Payment events that only report progress. */
const PROGRESS: readonly string[] = [
  'cpn.payment.cryptoFundsPending',
  'cpn.payment.fiatPaymentInitiated',
  'cpn.payment.delayed',
  'cpn.payment.inManualReview',
];

export class CpnStubPartner extends PartnerCore {
  readonly kind = 'CPN_STUB' as const;
  readonly #o: CpnStubOptions;

  constructor(o: CpnStubOptions) {
    super(o);
    this.#o = o;
  }

  protected formatId(token: string): string {
    return token;
  }

  verifyCallback(rawBody: Uint8Array, headers: Readonly<Record<string, string>>): PortResult<PartnerCallback, CallbackRejectCode> {
    let authentic: boolean;
    try {
      authentic = this.#o.verifySignature(rawBody, headers);
    } catch {
      authentic = false;
    }
    if (!authentic) return rejected('BAD_SIGNATURE', 'callback signature not valid');
    const env = decodeBodyObject(rawBody);
    if (env === null) return rejected('MALFORMED', 'body is not a JSON object');
    try {
      const type = reqString(env, 'notificationType');
      const eventId = reqString(env, 'notificationId', TOKEN);
      const n = asObject(env.get('notification'), 'notification');
      if (type === 'cpn.refund.completed' || type === 'cpn.refund.failed') {
        const id = this.#o.refundPaymentId?.(n) ?? null;
        if (id === null || !TOKEN.test(id)) return rejected('MALFORMED', 'refund names no payment');
        return ok({ eventId, payoutId: id, state: type === 'cpn.refund.failed' ? 'REFUND_FAILED' : 'RETURNED', reason: type }, false);
      }
      if (type === 'cpn.payment.completed') return this.#payment(eventId, n, 'PAID', 'COMPLETED', null);
      if (type === 'cpn.payment.failed') return this.#payment(eventId, n, 'FAILED', 'FAILED', type);
      if (PROGRESS.includes(type)) return this.#payment(eventId, n, 'PENDING', null, null);
      return rejected('IGNORED', 'not a payout-state event');
    } catch {
      return rejected('MALFORMED', 'callback fields missing or invalid');
    }
  }

  #payment(
    eventId: string,
    n: JsonObject,
    state: PartnerPayoutState,
    status: string | null,
    reason: string | null,
  ): PortResult<PartnerCallback, CallbackRejectCode> {
    const payoutId = reqString(n, 'id', TOKEN);
    if (status !== null && reqString(n, 'status') !== status) return rejected('MALFORMED', 'event type and payment status disagree');
    return ok({ eventId, payoutId, state, reason }, false);
  }
}
