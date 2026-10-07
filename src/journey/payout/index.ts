/**
 * JPAYOUT: the payout leg of a journey. The receiver chooses the method.
 *
 * - STABLECOIN_WALLET: USDC over Arc to the receiver's wallet through the D1 payments module
 *   (`D1PaymentsPort`, a narrow local shape until src/payments exports its own: wire it then).
 *   Before ANY send the destination goes through `screenWalletRecipient` (local USDC blocklist copy
 *   first, then the screening port, then the travel-rule hook, all fail closed). A rejection means
 *   NO send and a HOLD case. ARRIVED only when the payment is read back CONFIRMED and equals the
 *   server-side record (address and amount), never from the send call.
 * - FIAT_BANK: through the `PayoutPartner` port (JPARTNER) and its opaque `RecipientRef`. Cross-border
 *   (recipient country or currency differs from home) is refused BEFORE any funding while the gate is
 *   OFF (legal opinion not recorded); the labelled testnet demo flag opens the stub path only on 5042002.
 *   USDC funds the partner's settlement address (screened like any send), then the partner is asked to pay.
 *   ARRIVED only from the partner's authentic PAID callback (`partner.arrived`). FAILED / RETURNED
 *   outcomes open REFUND_DUE / CLAIM / REFUND_FAILED cases; duplicate callbacks have one effect.
 *
 * All state is in memory (DEFERRED: persistent inbox/outbox, MC-18, as the partner tracker). Errors and
 * cases carry fixed codes and ids only: no bank details, no addresses of receivers, no free text.
 * Money path rule MC-01: no `number`.
 */
import { createHash } from 'node:crypto';
import type { CbsMinor, UsdcUnits } from '../../amounts/index.js';
import type { BlocklistView } from '../../network/arc/adapter.js';
import { idempotencyKey, normaliseAddress, rejected, ok } from '../../nova-ports/ids.js';
import type { FiatCode, Hex32, IdempotencyKey, NetworkAddress, NetworkId, NovaOwnerRef, PortResult } from '../../nova-ports/ids.js';
import { screenWalletRecipient } from '../recipients/index.js';
import type { AddressScreeningPort, RecipientRef, TravelRuleHook, WalletRecipientRejectCode } from '../recipients/index.js';
import type { CrossBorderGate, PartnerPayoutState, PayoutPartner, RecipientLookup } from './partner/port.js';
import type { CallbackApplyRejectCode, CallbackOutcome } from './partner/tracker.js';
import type { CallbackRejectCode } from './partner/port.js';

export type PayoutMethod = 'STABLECOIN_WALLET' | 'FIAT_BANK';

/** Narrow shape of the D1 payments module (create a USDC payment over Arc via DFNS, read it back). */
export interface D1PaymentsPort {
  create(key: IdempotencyKey, req: { readonly payer: NovaOwnerRef; readonly to: NetworkAddress; readonly amount: UsdcUnits }): Promise<PortResult<{ readonly paymentId: string }, string>>;
  get(paymentId: string): Promise<
    PortResult<
      {
        readonly state: 'PENDING' | 'CONFIRMED' | 'FAILED';
        readonly to: NetworkAddress;
        readonly amount: UsdcUnits;
        readonly txHash: Hex32 | null;
      },
      'NOT_FOUND'
    >
  >;
}

export type PayoutCaseKind =
  | 'SCREEN_HOLD'
  | 'REFUND_DUE'
  | 'REFUND_RECEIVED'
  | 'REFUND_FAILED'
  | 'CLAIM'
  | 'RFI_OPEN'
  | 'CONFLICT'
  | 'UNKNOWN_EVENT'
  | 'PAYMENT_FAILED';

export interface PayoutCase {
  readonly payoutId: string;
  readonly kind: PayoutCaseKind;
  /** A fixed machine code: never free text, never personal data. */
  readonly reason: string;
}

/** Ops queue seam: one case per (payoutId, kind). */
export interface PayoutCasePort {
  open(c: PayoutCase): Promise<void>;
}

export type StablecoinPayoutRequest = {
  readonly method: 'STABLECOIN_WALLET';
  /** Our own payout id (server-side; the key and the binding derive from it). */
  readonly payoutId: string;
  readonly payer: NovaOwnerRef;
  readonly address: string;
  readonly amount: UsdcUnits;
};

export type FiatPayoutRequest = {
  readonly method: 'FIAT_BANK';
  readonly payoutId: string;
  readonly payer: NovaOwnerRef;
  readonly recipientRef: RecipientRef;
  readonly currency: FiatCode;
  /** Fiat amount the receiver gets. */
  readonly amount: CbsMinor;
  /** USDC sent to the partner's settlement address to fund the payout. */
  readonly fundingAmount: UsdcUnits;
};
export type PayoutRequest = StablecoinPayoutRequest | FiatPayoutRequest;

export type PayoutStatus =
  | 'HELD' //             screening/blocklist/travel-rule said no: nothing was sent
  | 'SENT' //             STABLECOIN: payment created, awaiting confirmation
  | 'FUNDING' //          FIAT: funding payment created, awaiting confirmation
  | 'PARTNER_PENDING' //  FIAT: partner payout created, awaiting its PAID callback
  | 'ARRIVED' //          licensed by the final confirmation only
  | 'FAILED' //           payment failed or partner failed/returned: see cases
  | 'REFUSED'; //         cross-border off, etc.: nothing was sent

export type PayoutRejectCode =
  | 'KEY_CONFLICT'
  | 'AMOUNT_INVALID'
  | 'CROSS_BORDER_DISABLED'
  | 'BENEFICIARY_INVALID'
  | 'CURRENCY_MISMATCH'
  | 'PARTNER_FUNDING_ADDRESS_INVALID'
  | WalletRecipientRejectCode
  | 'PAYMENT_REJECTED'
  | 'PARTNER_REJECTED';

export interface PayoutRecord {
  readonly payoutId: string;
  readonly method: PayoutMethod;
  readonly status: PayoutStatus;
  readonly code: PayoutRejectCode | null;
}

export interface PayoutServiceDeps {
  readonly payments: D1PaymentsPort;
  readonly partner: PayoutPartner;
  readonly screening: AddressScreeningPort;
  /** The local copy of the USDC blocklist, consulted before EVERY send. */
  readonly blocklist: BlocklistView;
  readonly travelRule: TravelRuleHook;
  readonly cases: PayoutCasePort;
  readonly recipients: RecipientLookup;
  readonly gate: CrossBorderGate;
  /** The settlement network's chain id, from the adapter's own pin; the demo gate needs 5042002n. */
  readonly chainId: bigint;
  readonly network: NetworkId;
  /** Where the partner is funded in USDC (its settlement address). */
  readonly partnerSettlementAddress: string;
}

interface Entry {
  readonly canonical: string;
  status: PayoutStatus;
  code: PayoutRejectCode | null;
  readonly req: PayoutRequest;
  paymentId: string | null;
  partnerPayoutId: string | null;
  /** The address and amount we bound, server side. */
  readonly bound: { readonly to: NetworkAddress; readonly amount: UsdcUnits } | null;
}

const ARC_TESTNET = 5042002n;
const CASE_KINDS: Readonly<Partial<Record<string, PayoutCaseKind>>> = {
  REFUND_DUE: 'REFUND_DUE',
  REFUND_RECEIVED: 'REFUND_RECEIVED',
  REFUND_FAILED: 'REFUND_FAILED',
  CLAIM: 'CLAIM',
  RFI_OPEN: 'RFI_OPEN',
  CONFLICT: 'CONFLICT',
};

function canonicalOf(r: PayoutRequest): string {
  return r.method === 'STABLECOIN_WALLET'
    ? JSON.stringify([r.method, r.payoutId, r.payer, normaliseAddress(r.address) ?? r.address, r.amount.toString()])
    : JSON.stringify([r.method, r.payoutId, r.payer, r.recipientRef, r.currency, r.amount.toString(), r.fundingAmount.toString()]);
}

function keyFor(payoutId: string, leg: 'send' | 'fund'): IdempotencyKey {
  return idempotencyKey(`payout-${leg}-${createHash('sha256').update(payoutId).digest('hex').slice(0, 32)}`);
}

export class PayoutService {
  readonly #d: PayoutServiceDeps;
  readonly #entries = new Map<string, Entry>();
  readonly #openedCases = new Set<string>();
  /** partner payout id -> our payout id */
  readonly #byPartnerId = new Map<string, string>();

  constructor(deps: PayoutServiceDeps) {
    this.#d = deps;
  }

  record(payoutId: string): PayoutRecord | null {
    const e = this.#entries.get(payoutId);
    return e === undefined ? null : { payoutId, method: e.req.method, status: e.status, code: e.code };
  }

  /** Start a payout. Exactly once per payoutId; the same id with another request is KEY_CONFLICT. */
  async start(req: PayoutRequest): Promise<PortResult<PayoutRecord, PayoutRejectCode>> {
    const canonical = canonicalOf(req);
    const prior = this.#entries.get(req.payoutId);
    if (prior !== undefined) {
      return prior.canonical === canonical ? ok(this.record(req.payoutId) as PayoutRecord, true) : rejected('KEY_CONFLICT', 'payout id reused with another request');
    }
    if (req.method === 'STABLECOIN_WALLET') return this.#startWallet(req, canonical);
    return this.#startFiat(req, canonical);
  }

  async #screen(
    payoutId: string,
    payer: NovaOwnerRef,
    address: string,
    amount: UsdcUnits,
  ): Promise<{ readonly address: NetworkAddress } | { readonly code: WalletRecipientRejectCode }> {
    let isBlocked: (a: NetworkAddress) => boolean;
    try {
      isBlocked = (await this.#d.blocklist.snapshot()).isBlocked;
    } catch {
      isBlocked = () => {
        throw new Error('blocklist unavailable');
      };
    }
    const r = await screenWalletRecipient(address, { screening: this.#d.screening, localBlocklist: isBlocked, travelRule: this.#d.travelRule }, { amount, originator: payer });
    if (r.kind === 'OK') return { address: r.recipient.address };
    void payoutId;
    return { code: r.code };
  }

  async #hold(e: Entry, payoutId: string, code: PayoutRejectCode): Promise<PortResult<PayoutRecord, PayoutRejectCode>> {
    e.status = 'HELD';
    e.code = code;
    await this.#openCase({ payoutId, kind: 'SCREEN_HOLD', reason: code });
    return rejected(code, 'payout held: nothing was sent');
  }

  async #startWallet(req: StablecoinPayoutRequest, canonical: string): Promise<PortResult<PayoutRecord, PayoutRejectCode>> {
    if (req.amount <= 0n) return rejected('AMOUNT_INVALID', 'amount must be positive');
    const e: Entry = { canonical, status: 'HELD', code: null, req, paymentId: null, partnerPayoutId: null, bound: null };
    this.#entries.set(req.payoutId, e);
    const s = await this.#screen(req.payoutId, req.payer, req.address, req.amount);
    if ('code' in s) return this.#hold(e, req.payoutId, s.code);
    const bound = { to: s.address, amount: req.amount };
    const entry: Entry = Object.assign(e, { bound });
    return this.#create(entry, req.payoutId, req.payer, keyFor(req.payoutId, 'send'), bound, 'SENT');
  }

  async #create(e: Entry, payoutId: string, payer: NovaOwnerRef, key: IdempotencyKey, to: { to: NetworkAddress; amount: UsdcUnits }, next: PayoutStatus): Promise<PortResult<PayoutRecord, PayoutRejectCode>> {
    let r: Awaited<ReturnType<D1PaymentsPort['create']>>;
    try {
      r = await this.#d.payments.create(key, { payer, to: to.to, amount: to.amount });
    } catch {
      // Outcome unknown: nothing is recorded as sent; the same payoutId replays the same key.
      this.#entries.delete(payoutId);
      return rejected('PAYMENT_REJECTED', 'payment outcome unknown');
    }
    if (r.kind === 'AMBIGUOUS') {
      this.#entries.delete(payoutId);
      return rejected('PAYMENT_REJECTED', 'payment outcome unknown');
    }
    if (r.kind === 'REJECTED') {
      e.status = 'FAILED';
      e.code = 'PAYMENT_REJECTED';
      await this.#openCase({ payoutId, kind: 'PAYMENT_FAILED', reason: 'PAYMENT_REJECTED' });
      return rejected('PAYMENT_REJECTED', 'payment rejected');
    }
    e.paymentId = r.value.paymentId;
    e.status = next;
    return ok(this.record(payoutId) as PayoutRecord, false);
  }

  async #startFiat(req: FiatPayoutRequest, canonical: string): Promise<PortResult<PayoutRecord, PayoutRejectCode>> {
    if (req.amount <= 0n || req.fundingAmount <= 0n) return rejected('AMOUNT_INVALID', 'amount must be positive');
    let meta: { readonly country: string; readonly currency: string };
    try {
      meta = this.#d.recipients(req.recipientRef);
    } catch {
      return rejected('BENEFICIARY_INVALID', 'recipient unknown or deleted');
    }
    if (meta.currency !== req.currency) return rejected('CURRENCY_MISMATCH', 'payout currency differs from the recipient account');
    const g = this.#d.gate;
    const crossBorder = meta.country !== g.homeCountry || meta.currency !== g.homeCurrency;
    const demo = g.testnetDemo && this.#d.chainId === ARC_TESTNET;
    // Refused BEFORE any funding moves.
    if (crossBorder && !g.legalOpinionRecorded && !demo) return rejected('CROSS_BORDER_DISABLED', 'cross-border payouts are off until a legal opinion is recorded');
    const settle = normaliseAddress(this.#d.partnerSettlementAddress);
    if (settle === null) return rejected('PARTNER_FUNDING_ADDRESS_INVALID', 'partner settlement address is malformed');
    const e: Entry = { canonical, status: 'HELD', code: null, req, paymentId: null, partnerPayoutId: null, bound: { to: settle, amount: req.fundingAmount } };
    this.#entries.set(req.payoutId, e);
    const s = await this.#screen(req.payoutId, req.payer, settle, req.fundingAmount);
    if ('code' in s) return this.#hold(e, req.payoutId, s.code);
    return this.#create(e, req.payoutId, req.payer, keyFor(req.payoutId, 'fund'), { to: s.address, amount: req.fundingAmount }, 'FUNDING');
  }

  /**
   * Re-read the payment (our own confirmation, never the send call) and move on:
   * STABLECOIN CONFIRMED -> ARRIVED; FIAT funding CONFIRMED -> partner payout created (PARTNER_PENDING).
   * A payment that is not exactly the bound address and amount is never accepted.
   */
  async advance(payoutId: string, funding: { readonly txHash: Hex32 } | null = null): Promise<PayoutRecord | null> {
    const e = this.#entries.get(payoutId);
    if (e === undefined) return null;
    if ((e.status !== 'SENT' && e.status !== 'FUNDING') || e.paymentId === null || e.bound === null) return this.record(payoutId);
    let p: Awaited<ReturnType<D1PaymentsPort['get']>>;
    try {
      p = await this.#d.payments.get(e.paymentId);
    } catch {
      return this.record(payoutId);
    }
    if (p.kind !== 'OK') return this.record(payoutId);
    const v = p.value;
    if (v.state === 'FAILED') {
      e.status = 'FAILED';
      e.code = 'PAYMENT_REJECTED';
      await this.#openCase({ payoutId, kind: 'PAYMENT_FAILED', reason: 'PAYMENT_FAILED' });
      return this.record(payoutId);
    }
    if (v.state !== 'CONFIRMED') return this.record(payoutId);
    if (v.to !== e.bound.to || v.amount !== e.bound.amount || v.txHash === null) {
      e.status = 'FAILED';
      e.code = 'PAYMENT_REJECTED';
      await this.#openCase({ payoutId, kind: 'CONFLICT', reason: 'PAYMENT_MISMATCH' });
      return this.record(payoutId);
    }
    if (e.status === 'SENT') {
      e.status = 'ARRIVED';
      return this.record(payoutId);
    }
    // FIAT funding confirmed: the partner payout, bound to the server-side record.
    const req = e.req as FiatPayoutRequest;
    const r = await this.#d.partner
      .createPayout(keyFor(payoutId, 'send'), { recipientRef: req.recipientRef, currency: req.currency, amount: req.amount, funding: { network: this.#d.network, txHash: funding?.txHash ?? v.txHash } })
      .catch(() => null);
    if (r === null || r.kind === 'AMBIGUOUS') return this.record(payoutId);
    if (r.kind === 'REJECTED') {
      e.status = 'FAILED';
      e.code = r.code === 'CROSS_BORDER_DISABLED' ? 'CROSS_BORDER_DISABLED' : 'PARTNER_REJECTED';
      await this.#openCase({ payoutId, kind: 'REFUND_DUE', reason: e.code });
      return this.record(payoutId);
    }
    e.partnerPayoutId = r.value.payoutId;
    this.#byPartnerId.set(r.value.payoutId, payoutId);
    e.status = 'PARTNER_PENDING';
    return this.record(payoutId);
  }

  /**
   * A partner callback: authenticity and dedupe are the partner port's; here the outcome is applied
   * once. ARRIVED comes only from `partner.arrived`. BAD_SIGNATURE changes nothing; UNKNOWN_EVENT and
   * MALFORMED open a case (a terminal signal may hide behind them).
   */
  async handlePartnerCallback(
    rawBody: Uint8Array,
    headers: Readonly<Record<string, string>>,
  ): Promise<PortResult<CallbackOutcome, CallbackRejectCode | CallbackApplyRejectCode>> {
    const r = this.#d.partner.handleCallback(rawBody, headers);
    if (r.kind === 'REJECTED') {
      if (r.code === 'UNKNOWN_EVENT' || r.code === 'MALFORMED') await this.#openCase({ payoutId: 'unknown', kind: 'UNKNOWN_EVENT', reason: r.code });
      return r;
    }
    if (r.kind !== 'OK' || !r.value.applied) return r;
    const ours = this.#byPartnerId.get(r.value.payoutId);
    if (ours === undefined) return r;
    const e = this.#entries.get(ours) as Entry;
    const st: PartnerPayoutState = r.value.state;
    if (st === 'PAID' && this.#d.partner.arrived(r.value.payoutId)) e.status = 'ARRIVED';
    else if (st === 'FAILED' || st === 'RETURNED' || st === 'REFUND_FAILED') e.status = 'FAILED';
    const kind = r.value.report === null ? undefined : CASE_KINDS[r.value.report.kind];
    if (kind !== undefined && r.value.report !== null) await this.#openCase({ payoutId: ours, kind, reason: r.value.report.reason ?? kind });
    return r;
  }

  async #openCase(c: PayoutCase): Promise<void> {
    const k = JSON.stringify([c.payoutId, c.kind]);
    if (this.#openedCases.has(k)) return;
    this.#openedCases.add(k);
    try {
      await this.#d.cases.open(c);
    } catch {
      // Fail closed: a failed open is retried on the next signal, and the payout stays out of ARRIVED.
      this.#openedCases.delete(k);
    }
  }
}
