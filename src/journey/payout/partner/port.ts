/**
 * JPARTNER PayoutPartner port: the FIAT_BANK payout rail (the receiver's choice).
 *
 * The partner does not exist yet (Circle CPN with the bank as sending
 * institution, or a local payout partner: agreement pending). So there is a
 * port, a CPN-shaped STUB (`cpn-stub.ts`) and a clearly labelled FAKE
 * (`fake.ts`). Both run through one shared decision core (`tracker.ts`).
 *
 * ARRIVED for a FIAT_BANK payout is licensed ONLY by the partner's
 * payout-complete confirmation, received through `verifyCallback` (authentic)
 * and recorded by the tracker. A forged, duplicated or out-of-order callback
 * can never license it.
 *
 * Bank details never cross this port: only the opaque `recipientRef`.
 *
 * Recorded deviations and deferrals. THIS HEADER IS THE RECORD: they are not in
 * docs/NOVA_ARC_DESIGN.md section 7.5 / F-17 or the LEDGER, and the integrator
 * must carry them into a design delta before JPAYOUT wires this port.
 *  - No `getPayout` poll and no maximum age for PENDING at this port (design F-17
 *    names `getPayout` / verified callback). A payout whose callbacks never
 *    arrive stays PENDING. The poll path and the max-age page are DEFERRED to
 *    the real adapter (they need the partner's status API, which the archived CPN
 *    docs do not let us shape without inventing fields). OWNER: JPAYOUT or
 *    JORCH must close this before FIAT_BANK is enabled (MC-12a).
 *  - The registry of created payouts, the funding-consumption set, the dedupe
 *    state and the reports are in memory only. After a restart a callback fails
 *    closed (UNKNOWN_PAYOUT) and the one-funding-one-payout control and the
 *    REFUND_DUE reports are lost; a persistent inbox/outbox (MC-18) is DEFERRED to
 *    Nova's PaymentStorePort wiring and must be closed before any non-demo use.
 *  - CPN creates the payment first and funds it afterwards through a payment
 *    transaction (quickstarts_integrate-with-cpn-ofi.md, "2.3"); this port
 *    requires the funding fact before create (stricter, fail closed). Whether the
 *    real flow can honour that order is open (OPEN_QUESTIONS Q-N12).
 *  - Second port shape: this port sits beside `src/nova-ports/payout.ts`
 *    `PayoutPartnerPort` (design 7.5), and `PartnerKind` here (CPN_STUB /
 *    FAKE_PARTNER) sits beside JQUOTE's `PartnerKind` (LIVE / STUB / TEST_FAKE,
 *    quote/ports.ts). Mapping for the composition root: CPN_STUB and FAKE_PARTNER
 *    are both non-LIVE (STUB and TEST_FAKE respectively); a LIVE partner has no
 *    adapter here. JPAYOUT reconciles the two ports; until then this one is
 *    the only one with callbacks and a tracker.
 *  - Amount typing: `amount` is `CbsMinor` as design 7.5 types it, but CLAUDE.md
 *    wants one `FiatMinor<CCY>` per payout currency. DECISION RECORDED, not
 *    resolved: the runtime backstop is the `isFunded` binding (currency and amount
 *    are bound to Nova's server-side quote) plus the recipient-currency check.
 *    JPAYOUT should move to JQUOTE's `FiatAmount<C>` when it wires this port.
 *  - RFI events (a payment cannot proceed until the OFI answers) are surfaced as
 *    `RFI_OPEN` reports: work for Ops, not noise.
 */
import type { CbsMinor } from '../../../amounts/index.js';
import type { FiatCode, Hex32, IdempotencyKey, KeyConflict, NetworkId, PortResult } from '../../../nova-ports/ids.js';
import type { RecipientRef } from '../../recipients/index.js';
import type { CallbackApplyRejectCode, CallbackOutcome, PayoutReport } from './tracker.js';

/** Labels what is behind the port so a stub or fake can never pass for a real partner. */
export type PartnerKind = 'CPN_STUB' | 'FAKE_PARTNER';

export interface PartnerPayoutRequest {
  readonly recipientRef: RecipientRef;
  readonly currency: FiatCode;
  /** > 0, in the payout currency's ledger minor units (typing: see the header). */
  readonly amount: CbsMinor;
  /** The Arc transaction that funded the partner. It can license one payout only. */
  readonly funding: { readonly network: NetworkId; readonly txHash: Hex32 };
}

/**
 * Partner-side state of one payout. RETURNED: the money came back to us (refund of a failed payout, or a return after PAID).
 * REFUND_FAILED: the partner could not return the money; Ops must chase it (never silently dropped).
 */
export type PartnerPayoutState = 'PENDING' | 'PAID' | 'FAILED' | 'RETURNED' | 'REFUND_FAILED';

export type CreatePayoutRejectCode =
  | KeyConflict
  | 'AMOUNT_INVALID'
  | 'NOT_FUNDED'
  | 'FUNDING_ALREADY_USED'
  | 'FUNDING_INVALID'
  | 'BENEFICIARY_INVALID'
  | 'CURRENCY_MISMATCH'
  | 'CROSS_BORDER_DISABLED';

/**
 * IGNORED: authentic, and one of the ENUMERATED known non-payout types (RFI progress, on-chain transaction notices, refund created).
 * UNKNOWN_EVENT: authentic, but a type this adapter does not know. The caller MUST quarantine and page on UNKNOWN_EVENT and MALFORMED:
 * a terminal signal may be hiding behind it.
 */
export type CallbackRejectCode = 'BAD_SIGNATURE' | 'MALFORMED' | 'IGNORED' | 'UNKNOWN_EVENT';

/** What an authentic callback says, in our terms. `eventId` is the partner's own id of the notification. */
export interface PartnerCallback {
  readonly eventId: string;
  readonly payoutId: string;
  readonly state: PartnerPayoutState;
  /** A short machine reason (`[A-Za-z0-9_.-]{1,64}`) or null; never free text. */
  readonly reason: string | null;
  /** 'RFI': a compliance request from the partner; no state change, an Ops report. */
  readonly notice?: 'RFI';
}

export interface PayoutPartner {
  readonly kind: PartnerKind;
  /** Exactly-once create: the same key and request replays the same payout; the same key with another request is KEY_CONFLICT. */
  createPayout(key: IdempotencyKey, req: PartnerPayoutRequest): Promise<PortResult<{ readonly payoutId: string }, CreatePayoutRejectCode>>;
  /** Authenticity check over the raw body, then decode. Pure: it records nothing. */
  verifyCallback(rawBody: Uint8Array, headers: Readonly<Record<string, string>>): PortResult<PartnerCallback, CallbackRejectCode>;
  /** verifyCallback, then the tracker: authenticity first, then dedupe, ordering and reporting. */
  handleCallback(
    rawBody: Uint8Array,
    headers: Readonly<Record<string, string>>,
  ): PortResult<CallbackOutcome, CallbackRejectCode | CallbackApplyRejectCode>;
  /** True only after an applied, authentic PAID: the one licence of ARRIVED for FIAT_BANK. */
  arrived(payoutId: string): boolean;
  /** Refund / claim / conflict reports raised so far, oldest first. */
  reports(): readonly PayoutReport[];
}

/** The cross-border gate (spec: OFF until a legal opinion is recorded; a labelled testnet demo flag may enable the stub path). */
export interface CrossBorderGate {
  /** Two-letter country the payout institution is domiciled in; a payout to any other country is cross-border. */
  readonly homeCountry: string;
  /**
   * ISO 4217 currency of the home country. Decision (spec: a foreign fiat receiver makes the payment cross-border):
   * a payout is cross-border if the recipient's country OR currency differs from home, so a home-country
   * account in a foreign currency is cross-border too.
   */
  readonly homeCurrency: string;
  /** True only when a legal opinion has been recorded (docs/GATES.md). Default false. */
  readonly legalOpinionRecorded: boolean;
  /** Testnet demo switch, honoured only by a STUB or FAKE adapter AND only when the core is pinned to Arc testnet chain ID 5042002 (C-01). Default false. */
  readonly testnetDemo: boolean;
}

/** Where the adapter finds routing facts of a recipient (no PII). Throws like `BankRecipientStore.meta`. */
export type RecipientLookup = (ref: string) => { readonly country: string; readonly currency: FiatCode };

/** What a funding check is bound to: the payout it would license (Binding: server-side facts, never caller-echoed). */
export interface FundingBinding {
  readonly key: IdempotencyKey;
  readonly recipientRef: RecipientRef;
  readonly currency: FiatCode;
  readonly amount: CbsMinor;
}

/** Canonical encoding of a request, for same-key comparison. */
export function canonicalRequest(req: PartnerPayoutRequest): string {
  return JSON.stringify([req.recipientRef, req.currency, req.amount.toString(), req.funding.network, req.funding.txHash]);
}
