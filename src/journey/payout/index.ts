/**
 * JPAYOUT: the payout leg of a journey. The receiver chooses the method.
 *
 * - STABLECOIN_WALLET: USDC over Arc to the receiver's wallet through the D1 payments module
 *   (`D1PaymentsPort`, a narrow local shape: src/payments exports the D1 `PaymentOrchestrator`, not a port of
 *   this shape, so the composition root wires an adapter to it. DEFERRED, owner JORCH).
 *   Before ANY send (a retry included) the destination goes through `screenWalletRecipient`: the local USDC
 *   blocklist copy first (refused when unavailable, future-dated or older than `blocklistMaxAgeMs`), then the
 *   screening port, then the travel-rule hook, all fail closed. A rejection means NO send and a QUARANTINE
 *   case. ARRIVED only when the payment is read back CONFIRMED and equals the server-side record (address
 *   and amount), never from the send call.
 * - Travel rule: the hook is required. The explicit testnet no-op (`TRAVEL_RULE_NOT_APPLICABLE_TESTNET`) is
 *   refused at construction on any chain other than Arc testnet 5042002 (configure or fail closed).
 *   Unhosted-wallet policy lives behind the hook (OPEN: docs/OPEN_QUESTIONS.md Q-R3, Q-R9).
 * - FIAT_BANK: through the `PayoutPartner` port (JPARTNER) and its opaque `RecipientRef`. Cross-border
 *   (recipient country or currency differs from home) is refused BEFORE any funding while the gate is
 *   OFF (legal opinion not recorded); the labelled testnet demo flag opens the stub path only on 5042002.
 *   USDC funds the partner's settlement address (screened like any send), then the partner is asked to pay,
 *   bound to the funding transaction WE read back (never a caller-supplied hash).
 *   ARRIVED only while the partner's tracker says `arrived` (an authentic, applied PAID); a later conflict
 *   or return withdraws it. FAILED / RETURNED outcomes open REFUND_DUE / CLAIM / REFUND_FAILED cases;
 *   duplicate callbacks have one effect; an authentic callback we cannot attribute opens a QUARANTINE case.
 * - An unknown create outcome (throw or AMBIGUOUS) is UNRESOLVED, never FAILED: it opens an
 *   UNRESOLVED_SUBMIT case and is retried only with the same deterministic key (re-screened first).
 *   Callers must never refund on UNRESOLVED.
 *
 * Restart (in-memory state, DEFERRED: persistent inbox/outbox, MC-18, as the partner tracker): after a
 * restart `record()` returns null, which means "unknown to this process", NEVER "not sent": the caller must
 * not refund or re-route on it. Re-running `start()` with the same request re-screens and replays the same
 * deterministic key (D1 payments returns the existing payment). Partner callbacks for payouts created
 * before the restart are refused by the partner (UNKNOWN_PAYOUT) and open a QUARANTINE case here. A case
 * whose `open` failed is held in `pendingCases()` and retried on every later call; it is lost on restart.
 *
 * Case kinds and D1 / src/ops (D-2) names: QUARANTINE and UNRESOLVED_SUBMIT are the D1 kinds; REFUND_DUE,
 * REFUND_RECEIVED, REFUND_FAILED and CLAIM are F-17 PARTNER_RETURN (ops RETURNED_PAYOUT) work; CONFLICT is
 * QUARANTINE / SIGNAL_CONFLICT; RFI_OPEN and PAYMENT_FAILED have no D1 kind yet. `PayoutCasePort` is a local
 * seam: wiring it to `CaseStorePort` (src/ops) is DEFERRED to the integrator (the reason codes here are not
 * yet in `REASONS`).
 *
 * Errors and cases carry fixed codes and ids only: no bank details, no addresses, no free text.
 * Money path rule MC-01: no `number`.
 */
import { createHash } from 'node:crypto';
import type { CbsMinor, UsdcUnits } from '../../amounts/index.js';
import type { BlocklistView } from '../../network/arc/adapter.js';
import { idempotencyKey, normaliseAddress, rejected, ok } from '../../nova-ports/ids.js';
import type { FiatCode, Hex32, IdempotencyKey, NetworkAddress, NetworkId, NovaOwnerRef, PortResult } from '../../nova-ports/ids.js';
import { TRAVEL_RULE_NOT_APPLICABLE_TESTNET, screenWalletRecipient } from '../recipients/index.js';
import type { AddressScreeningPort, RecipientRef, TravelRuleHook, WalletRecipientRejectCode } from '../recipients/index.js';
import type { CrossBorderGate, PayoutPartner, RecipientLookup } from './partner/port.js';
import type { CallbackApplyRejectCode, CallbackOutcome, PayoutReportKind } from './partner/tracker.js';
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

export type PayoutCaseKind = 'QUARANTINE' | 'UNRESOLVED_SUBMIT' | 'PAYMENT_FAILED' | PayoutReportKind;

export interface PayoutCase {
  /** Our payout id, or `cb-<digest>` for a callback we cannot attribute to one. */
  readonly payoutId: string;
  readonly kind: PayoutCaseKind;
  /** A fixed machine code: never free text, never personal data. */
  readonly reason: string;
}

/** Ops queue seam: one case per (payoutId, kind, reason). */
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
  | 'SCREENING' //        accepted, screening in flight: nothing sent yet
  | 'HELD' //             screening/blocklist/travel-rule said no: nothing was sent
  | 'UNRESOLVED' //       the create outcome is unknown: money may have moved; retry with the same key only
  | 'SENT' //             STABLECOIN: payment created, awaiting confirmation
  | 'FUNDING' //          FIAT: funding payment created, awaiting confirmation
  | 'PARTNER_PENDING' //  FIAT: partner payout created, awaiting its PAID callback
  | 'ARRIVED' //          licensed by the final confirmation only
  | 'FAILED'; //          payment failed, mismatched, or partner failed/returned/conflicted: see cases

export type PayoutRejectCode =
  | 'KEY_CONFLICT'
  | 'AMOUNT_INVALID'
  | 'CROSS_BORDER_DISABLED'
  | 'BENEFICIARY_INVALID'
  | 'CURRENCY_MISMATCH'
  | 'PARTNER_FUNDING_ADDRESS_INVALID'
  | WalletRecipientRejectCode
  | 'PAYMENT_REJECTED'
  | 'PAYMENT_OUTCOME_UNKNOWN'
  | 'PAYMENT_MISMATCH'
  | 'PARTNER_REJECTED'
  | 'PARTNER_CONFLICT';

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
  /** Maximum age of the local blocklist copy, milliseconds, > 0 (explicit: no default). */
  readonly blocklistMaxAgeMs: bigint;
  /** Milliseconds since the epoch. */
  readonly clock: () => bigint;
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
  /** The address and amount we bound, server side (set once screening passed). */
  bound: { readonly to: NetworkAddress; readonly amount: UsdcUnits } | null;
}

type StartResult = PortResult<PayoutRecord, PayoutRejectCode>;

const ARC_TESTNET = 5042002n;

/** Fixed-text configuration error (fail closed at startup; never carries input). */
export class PayoutConfigError extends Error {
  override readonly name = 'PayoutConfigError';
  constructor(readonly code: 'TRAVEL_RULE_NOT_CONFIGURED' | 'BLOCKLIST_MAX_AGE_INVALID') {
    super(code === 'TRAVEL_RULE_NOT_CONFIGURED' ? 'travel-rule hook must be configured off Arc testnet' : 'blocklist max age must be > 0');
  }
}

function canonicalOf(r: PayoutRequest): string {
  return r.method === 'STABLECOIN_WALLET'
    ? JSON.stringify([r.method, r.payoutId, r.payer, normaliseAddress(r.address) ?? r.address, r.amount.toString()])
    : JSON.stringify([r.method, r.payoutId, r.payer, r.recipientRef, r.currency, r.amount.toString(), r.fundingAmount.toString()]);
}

function digest32(s: string | Uint8Array): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

/** Deterministic per (payout, leg): 'send' the STABLECOIN payment, 'fund' the FIAT funding payment, 'partner' the partner payout. */
function keyFor(payoutId: string, leg: 'send' | 'fund' | 'partner'): IdempotencyKey {
  return idempotencyKey(`payout-${leg}-${digest32(payoutId)}`);
}

export class PayoutService {
  readonly #d: PayoutServiceDeps;
  readonly #entries = new Map<string, Entry>();
  readonly #openedCases = new Set<string>();
  readonly #pendingCases = new Map<string, PayoutCase>();
  /** partner payout id -> our payout id */
  readonly #byPartnerId = new Map<string, string>();

  constructor(deps: PayoutServiceDeps) {
    if (deps.blocklistMaxAgeMs <= 0n) throw new PayoutConfigError('BLOCKLIST_MAX_AGE_INVALID');
    if (deps.travelRule === TRAVEL_RULE_NOT_APPLICABLE_TESTNET && deps.chainId !== ARC_TESTNET) throw new PayoutConfigError('TRAVEL_RULE_NOT_CONFIGURED');
    this.#d = deps;
  }

  record(payoutId: string): PayoutRecord | null {
    const e = this.#entries.get(payoutId);
    if (e === undefined) return null;
    // FIAT ARRIVED is re-derived from the partner's tracker at every read: a later conflict withdraws it.
    const withdrawn = e.status === 'ARRIVED' && e.req.method === 'FIAT_BANK' && (e.partnerPayoutId === null || !this.#d.partner.arrived(e.partnerPayoutId));
    return withdrawn ? { payoutId, method: e.req.method, status: 'FAILED', code: 'PARTNER_CONFLICT' } : { payoutId, method: e.req.method, status: e.status, code: e.code };
  }

  /** Cases whose `open` failed and are retried on every later call (in memory: lost on restart). */
  pendingCases(): readonly PayoutCase[] {
    return [...this.#pendingCases.values()];
  }

  /** Start a payout. Exactly once per payoutId; the same id with another request is KEY_CONFLICT. */
  async start(req: PayoutRequest): Promise<StartResult> {
    await this.#flushCases();
    const canonical = canonicalOf(req);
    const prior = this.#entries.get(req.payoutId);
    if (prior !== undefined) {
      if (prior.canonical !== canonical) return rejected('KEY_CONFLICT', 'payout id reused with another request');
      if (prior.status === 'UNRESOLVED') return this.#send(prior);
      if ((prior.status === 'HELD' || prior.status === 'FAILED') && prior.code !== null) return rejected(prior.code, 'payout already refused or failed');
      return ok(this.record(req.payoutId) as PayoutRecord, true);
    }
    if (req.method === 'STABLECOIN_WALLET') {
      if (req.amount <= 0n) return rejected('AMOUNT_INVALID', 'amount must be positive');
    } else {
      const refused = this.#fiatPrecheck(req);
      if (refused !== null) return refused;
    }
    const e: Entry = { canonical, status: 'SCREENING', code: null, req, paymentId: null, partnerPayoutId: null, bound: null };
    this.#entries.set(req.payoutId, e);
    return this.#send(e);
  }

  /** FIAT checks that refuse BEFORE any funding moves (nothing is recorded). */
  #fiatPrecheck(req: FiatPayoutRequest): StartResult | null {
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
    if (crossBorder && !g.legalOpinionRecorded && !demo) return rejected('CROSS_BORDER_DISABLED', 'cross-border payouts are off until a legal opinion is recorded');
    if (normaliseAddress(this.#d.partnerSettlementAddress) === null) return rejected('PARTNER_FUNDING_ADDRESS_INVALID', 'partner settlement address is malformed');
    return null;
  }

  /** Screen (every time, retries included), then create with the payout's deterministic key. */
  async #send(e: Entry): Promise<StartResult> {
    const r = e.req;
    const payoutId = r.payoutId;
    const target = r.method === 'STABLECOIN_WALLET' ? { address: r.address, amount: r.amount } : { address: this.#d.partnerSettlementAddress, amount: r.fundingAmount };
    const s = await this.#screen(r.payer, target.address, target.amount);
    if ('code' in s) {
      await this.#openCase({ payoutId, kind: 'QUARANTINE', reason: s.code });
      if (e.status === 'UNRESOLVED') return rejected(s.code, 'retry refused by screening: outcome of the first send still unknown');
      e.status = 'HELD';
      e.code = s.code;
      return rejected(s.code, 'payout held: nothing was sent');
    }
    if (e.bound !== null && (e.bound.to !== s.address || e.bound.amount !== target.amount)) {
      // Cannot happen with an unchanged request; refuse rather than send elsewhere under the same key.
      await this.#openCase({ payoutId, kind: 'QUARANTINE', reason: 'PAYMENT_MISMATCH' });
      return rejected('PAYMENT_MISMATCH', 'retry target differs from the bound record');
    }
    const bound = { to: s.address, amount: target.amount };
    e.bound = bound;
    const fiat = r.method === 'FIAT_BANK';
    let c: Awaited<ReturnType<D1PaymentsPort['create']>> | null;
    try {
      c = await this.#d.payments.create(keyFor(payoutId, fiat ? 'fund' : 'send'), { payer: r.payer, to: bound.to, amount: bound.amount });
    } catch {
      c = null;
    }
    if (c === null || c.kind === 'AMBIGUOUS') {
      e.status = 'UNRESOLVED';
      e.code = 'PAYMENT_OUTCOME_UNKNOWN';
      await this.#openCase({ payoutId, kind: 'UNRESOLVED_SUBMIT', reason: 'PAYMENT_OUTCOME_UNKNOWN' });
      return rejected('PAYMENT_OUTCOME_UNKNOWN', 'payment outcome unknown: retry with the same request, never refund');
    }
    if (c.kind === 'REJECTED') {
      e.status = 'FAILED';
      e.code = 'PAYMENT_REJECTED';
      await this.#openCase({ payoutId, kind: 'PAYMENT_FAILED', reason: 'PAYMENT_REJECTED' });
      return rejected('PAYMENT_REJECTED', 'payment rejected');
    }
    e.paymentId = c.value.paymentId;
    e.status = fiat ? 'FUNDING' : 'SENT';
    e.code = null;
    return ok(this.record(payoutId) as PayoutRecord, false);
  }

  async #screen(payer: NovaOwnerRef, address: string, amount: UsdcUnits): Promise<{ readonly address: NetworkAddress } | { readonly code: WalletRecipientRejectCode }> {
    let isBlocked: (a: NetworkAddress) => boolean;
    try {
      const snap = await this.#d.blocklist.snapshot();
      const now = this.#d.clock();
      // A future-dated or too-old copy is unusable: fail closed (as the Arc adapter's BLOCKLIST_STALE).
      if (snap.asOfMs > now || now - snap.asOfMs > this.#d.blocklistMaxAgeMs) throw new Error('blocklist stale');
      isBlocked = snap.isBlocked;
    } catch {
      isBlocked = () => {
        throw new Error('blocklist unavailable');
      };
    }
    const r = await screenWalletRecipient(address, { screening: this.#d.screening, localBlocklist: isBlocked, travelRule: this.#d.travelRule }, { amount, originator: payer });
    return r.kind === 'OK' ? { address: r.recipient.address } : { code: r.code };
  }

  /**
   * Re-read the payment (our own confirmation, never the send call) and move on:
   * STABLECOIN CONFIRMED -> ARRIVED; FIAT funding CONFIRMED -> partner payout created (PARTNER_PENDING),
   * bound to the transaction hash we read back. An UNRESOLVED payout is retried with the same key.
   * A payment that is not exactly the bound address and amount is never accepted.
   */
  async advance(payoutId: string): Promise<PayoutRecord | null> {
    await this.#flushCases();
    const e = this.#entries.get(payoutId);
    if (e === undefined) return null;
    if (e.status === 'UNRESOLVED') {
      await this.#send(e);
      return this.record(payoutId);
    }
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
      e.code = 'PAYMENT_MISMATCH';
      await this.#openCase({ payoutId, kind: 'QUARANTINE', reason: 'PAYMENT_MISMATCH' });
      return this.record(payoutId);
    }
    if (e.status === 'SENT') {
      e.status = 'ARRIVED';
      return this.record(payoutId);
    }
    // FIAT funding confirmed: the partner payout, bound to the server-side record and OUR read-back tx hash.
    const req = e.req as FiatPayoutRequest;
    const r = await this.#d.partner
      .createPayout(keyFor(payoutId, 'partner'), { recipientRef: req.recipientRef, currency: req.currency, amount: req.amount, funding: { network: this.#d.network, txHash: v.txHash } })
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
   * A partner callback: authenticity and dedupe are the partner port's; here the outcome is applied once.
   * ARRIVED comes only from `partner.arrived`. BAD_SIGNATURE, IGNORED and OUT_OF_ORDER change nothing.
   * UNKNOWN_EVENT, MALFORMED, UNKNOWN_PAYOUT and an authentic callback that is not ours open a QUARANTINE
   * case (a terminal signal may hide behind them). CONFLICT fails the payout and opens a CONFLICT case.
   */
  async handlePartnerCallback(
    rawBody: Uint8Array,
    headers: Readonly<Record<string, string>>,
  ): Promise<PortResult<CallbackOutcome, CallbackRejectCode | CallbackApplyRejectCode>> {
    await this.#flushCases();
    // Pure authenticity check first, only to attribute a later rejection to a payout id.
    const v = this.#d.partner.verifyCallback(rawBody, headers);
    const partnerId = v.kind === 'OK' ? v.value.payoutId : null;
    const ours = partnerId === null ? undefined : this.#byPartnerId.get(partnerId);
    const subject = ours ?? `cb-${digest32(partnerId ?? rawBody)}`;
    const r = this.#d.partner.handleCallback(rawBody, headers);
    if (r.kind === 'REJECTED') {
      if (r.code === 'UNKNOWN_EVENT' || r.code === 'MALFORMED' || r.code === 'UNKNOWN_PAYOUT') {
        await this.#openCase({ payoutId: subject, kind: 'QUARANTINE', reason: r.code });
      } else if (r.code === 'CONFLICT') {
        const e = ours === undefined ? undefined : this.#entries.get(ours);
        if (e !== undefined) {
          e.status = 'FAILED';
          e.code = 'PARTNER_CONFLICT';
        }
        await this.#openCase({ payoutId: subject, kind: 'CONFLICT', reason: 'SIGNAL_CONFLICT' });
      }
      return r;
    }
    if (r.kind !== 'OK') return r;
    const mine = this.#byPartnerId.get(r.value.payoutId);
    const e = mine === undefined ? undefined : this.#entries.get(mine);
    if (mine === undefined || e === undefined) {
      if (r.value.applied) await this.#openCase({ payoutId: `cb-${digest32(r.value.payoutId)}`, kind: 'QUARANTINE', reason: 'UNKNOWN_PAYOUT' });
      return r;
    }
    if (!r.value.applied) return r;
    const st = r.value.state;
    if (st === 'PAID' && this.#d.partner.arrived(r.value.payoutId)) {
      e.status = 'ARRIVED';
      e.code = null;
    } else if (st === 'FAILED' || st === 'RETURNED' || st === 'REFUND_FAILED') {
      e.status = 'FAILED';
      e.code = 'PARTNER_REJECTED';
    }
    const rep = r.value.report;
    if (rep !== null) await this.#openCase({ payoutId: mine, kind: rep.kind, reason: rep.reason ?? rep.kind });
    return r;
  }

  async #openCase(c: PayoutCase): Promise<void> {
    const k = JSON.stringify([c.payoutId, c.kind, c.reason]);
    if (this.#openedCases.has(k)) return;
    this.#openedCases.add(k);
    try {
      await this.#d.cases.open(c);
      this.#pendingCases.delete(k);
    } catch {
      // Fail closed: kept as pending and retried on every later call; the payout's status is unchanged by it.
      this.#openedCases.delete(k);
      this.#pendingCases.set(k, c);
    }
  }

  async #flushCases(): Promise<void> {
    for (const c of [...this.#pendingCases.values()]) await this.#openCase(c);
  }
}
