/**
 * JPARTNER core: what every PayoutPartner adapter shares, so a stub and a fake
 * can differ only in how a callback is authenticated and decoded.
 *
 * createPayout is exactly-once on the idempotency key (the same key with the
 * same request replays the same payout, another request is KEY_CONFLICT), and
 * fails closed, in this order: key conflict, amount, recipient, currency,
 * cross-border gate, funding. The recipient is known by `recipientRef` only; its
 * routing facts (country, currency) come from `RecipientLookup`, never from
 * the caller. Funding is a chain fact asked of an injected `isFunded`: the
 * partner is never told to pay out before our own indexer confirmed the Arc
 * transfer that funds it, and that transfer is consumed by the first payout it
 * licenses (a second key reusing it is FUNDING_ALREADY_USED).
 *
 * Cross-border (a recipient country or currency other than `gate.homeCountry` / `gate.homeCurrency`) stays OFF
 * until `gate.legalOpinionRecorded`; the only other way is the labelled
 * testnet demo flag, which adapters honour only because they are a STUB or a
 * FAKE. Money path rule MC-01: no `number`.
 */
import { randomUUID } from 'node:crypto';
import { asObject, parseJson } from '../../../dfns/json.js';
import type { JsonObject } from '../../../dfns/json.js';
import { normaliseHex32, ok, rejected } from '../../../nova-ports/ids.js';
import type { Hex32, IdempotencyKey, NetworkId, PortResult } from '../../../nova-ports/ids.js';
import { canonicalRequest } from './port.js';
import type { SettlementNetworkPin } from '../../quote/compose.js';
import type {
  CallbackRejectCode,
  CreatePayoutRejectCode,
  CrossBorderGate,
  PartnerCallback,
  FundingBinding,
  PartnerKind,
  PartnerPayoutRequest,
  PayoutPartner,
  RecipientLookup,
} from './port.js';
import { PayoutTracker } from './tracker.js';
import type { CallbackApplyRejectCode, CallbackOutcome, PayoutReport } from './tracker.js';

export interface PartnerCoreOptions {
  readonly recipients: RecipientLookup;
  readonly gate: CrossBorderGate;
  /**
   * Chain fact: our own indexer saw the funding Arc transfer confirmed AND that it funds exactly this payout
   * (the binding carries the key, recipient, currency and amount; Nova checks them against its server-side
   * quote and the transfer's value). Anything but a clean true fails closed.
   */
  readonly isFunded: (funding: { readonly network: NetworkId; readonly txHash: Hex32 }, binding: FundingBinding) => boolean;
  /**
   * The settlement network adapter's own pin (as JQUOTE takes it, never a config value). The testnet demo gate is
   * honoured only when the pin's chain ID is 5042002 (C-01); left out, the demo gate is never honoured.
   */
  readonly settlementNetwork?: SettlementNetworkPin;
  /** Payout id source; defaults to a random UUID. Injectable for tests. */
  readonly newId?: () => string;
}

/** Arc testnet, C-01. The only chain the demo gate may open. */
const ARC_TESTNET_CHAIN_ID = 5042002n;

interface Created {
  readonly canonical: string;
  readonly payoutId: string;
}

export abstract class PartnerCore implements PayoutPartner {
  abstract readonly kind: PartnerKind;
  readonly #o: PartnerCoreOptions;
  readonly #tracker = new PayoutTracker();
  readonly #created = new Map<string, Created>();
  /** Funding (network, txHash) already consumed, to the key that consumed it: one funding licenses one payout. */
  readonly #consumed = new Map<string, string>();

  protected constructor(o: PartnerCoreOptions) {
    this.#o = o;
  }

  /** Authenticity check over the raw body, then decode. Pure: it records nothing. */
  abstract verifyCallback(rawBody: Uint8Array, headers: Readonly<Record<string, string>>): PortResult<PartnerCallback, CallbackRejectCode>;

  /** The adapter's own payout id from a fresh unique token (the fake prefixes it; the CPN stub keeps the bare UUID shape). */
  protected abstract formatId(token: string): string;

  async createPayout(
    key: IdempotencyKey,
    req: PartnerPayoutRequest,
  ): Promise<PortResult<{ readonly payoutId: string }, CreatePayoutRejectCode>> {
    // Funding identity: lower-cased hash, so one transaction cannot license two payouts by spelling (MC-10).
    const txHash = normaliseHex32(req.funding.txHash);
    const canonical = canonicalRequest(txHash === null ? req : { ...req, funding: { network: req.funding.network, txHash } });
    const prior = this.#created.get(key);
    if (prior !== undefined) {
      return prior.canonical === canonical ? ok({ payoutId: prior.payoutId }, true) : rejected('KEY_CONFLICT', 'key reused with another request');
    }
    if (req.amount <= 0n) return rejected('AMOUNT_INVALID', 'amount must be positive');
    let meta: { readonly country: string; readonly currency: string };
    try {
      meta = this.#o.recipients(req.recipientRef);
    } catch {
      return rejected('BENEFICIARY_INVALID', 'recipient unknown or deleted');
    }
    if (meta.currency !== req.currency) return rejected('CURRENCY_MISMATCH', 'payout currency differs from the recipient account');
    const g = this.#o.gate;
    const crossBorder = meta.country !== g.homeCountry || meta.currency !== g.homeCurrency;
    const demo = g.testnetDemo && this.#o.settlementNetwork?.chainId === ARC_TESTNET_CHAIN_ID;
    if (crossBorder && !g.legalOpinionRecorded && !demo) {
      return rejected('CROSS_BORDER_DISABLED', 'cross-border payouts are off until a legal opinion is recorded');
    }
    if (txHash === null) return rejected('FUNDING_INVALID', 'funding transaction hash is malformed');
    const funding = { network: req.funding.network, txHash };
    const fundingId = JSON.stringify([funding.network, funding.txHash]);
    if (this.#consumed.has(fundingId)) return rejected('FUNDING_ALREADY_USED', 'funding transfer already licenses another payout');
    let funded: boolean;
    try {
      funded = this.#o.isFunded(funding, { key, recipientRef: req.recipientRef, currency: req.currency, amount: req.amount }) === true;
    } catch {
      funded = false;
    }
    if (!funded) return rejected('NOT_FUNDED', 'funding transfer not confirmed by our indexer');
    // Consume only after the payout is registered: a throwing or repeating newId must not strand the funding.
    const payoutId = this.formatId((this.#o.newId ?? randomUUID)());
    this.#tracker.register(payoutId);
    this.#consumed.set(fundingId, key);
    this.#created.set(key, { canonical, payoutId });
    return ok({ payoutId }, false);
  }

  handleCallback(
    rawBody: Uint8Array,
    headers: Readonly<Record<string, string>>,
  ): PortResult<CallbackOutcome, CallbackRejectCode | CallbackApplyRejectCode> {
    const v = this.verifyCallback(rawBody, headers);
    if (v.kind !== 'OK') return v;
    return this.#tracker.apply(v.value);
  }

  arrived(payoutId: string): boolean {
    return this.#tracker.arrived(payoutId);
  }

  reports(): readonly PayoutReport[] {
    return this.#tracker.reports();
  }
}

/** Case-insensitive header lookup (HTTP header names are case-insensitive); the first match wins. */
export function headerValue(headers: Readonly<Record<string, string>>, name: string): string | null {
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === want) return v;
  return null;
}

/** The raw body as a money-safe JSON object, or null when it is not UTF-8 JSON with an object at the top. */
export function decodeBodyObject(rawBody: Uint8Array): JsonObject | null {
  try {
    return asObject(parseJson(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)), 'callback');
  } catch {
    return null;
  }
}
