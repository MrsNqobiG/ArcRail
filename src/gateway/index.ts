/**
 * F2 Thin signing gateway (NOVA_ARC_DESIGN §8.1, §8.4; kit-v3 CLAUDE.md
 * "Approvals happen in Dfns").
 *
 * DFNS holds the keys, runs the policies and collects the human approvals. This
 * gateway is only the set of checks DFNS cannot make, run before every
 * `POST /wallets/{walletId}/transfers`. Every check fails closed:
 *
 *  - check 1, chain pin: proposed chain ID = 5042002 (C-01), and the DFNS wallet
 *    reports network `ArcTestnet`, status `Active`, no vault, and the bound
 *    address [DF:get-wallet]. A wallet on `Arc` (mainnet) is NETWORK_DISABLED (§11);
 *  - check 2, binding and open reservation: the stored binding digest recomputes;
 *    what the caller proposes equals the binding; the body is built from the
 *    binding only (CLAUDE.md "Binding"). The reservation is open: the payment and
 *    its ARC_TRANSFER leg are not terminal, no P6 is pending, Nova's P1 journal
 *    `pay:<id>:p1` exists and the release journal `pay:<id>:p6` does not (an
 *    AMBIGUOUS answer counts as "exists"). Otherwise RESERVATION_NOT_OPEN;
 *  - check 3, one DFNS request per payment (R3-B2) and the submit marker (R3-B1):
 *    `attempt` is the literal 1, the externalId is `deriveExternalId(paymentId)`,
 *    and the leg's `SubmitMarker` is committed through `markSubmit` BEFORE the
 *    POST. The record is then always read back, and the POST is sent only if it
 *    holds our marker and is still not QUARANTINED, unresolved and open (a view
 *    can be stale, Lens R m1). A re-POST of an UNRESOLVED leg sends only bytes
 *    whose sha256 equals the marker's `bodyDigest`;
 *  - check 4, wrapper-call rule: plain value transfers only; a contract call is
 *    refused unless allow-listed and decoded (./wrapper.ts), and even then D1 has
 *    no allow-listed DFNS route to send it;
 *  - check 5, rail state and wallet nonce hold: not PAUSED, payment not
 *    QUARANTINED, indexer healthy with an agreed head, and no active nonce hold
 *    on the sending wallet, read from the store on every submission;
 *  - check 6, destination: a destination that is a COMPANY-owned registry wallet,
 *    or a customer wallet whose owner is not the payment's receiver, is
 *    DESTINATION_NOT_ALLOWED (checked here through `WalletRegistryPort.findByAddress`,
 *    because it is not Arc-specific); then the network adapter's precheck;
 *  - check 7, fee pre-check on `GET /networks/fees` against our ceiling (Q-N8).
 *
 * Once the marker is set, a DFNS request may exist, so no outcome of this gateway
 * ever ends the leg: REFUSED, RETRY_LATER and AMBIGUOUS after the marker leave the
 * leg UNRESOLVED (the store refuses a terminal stage or P6 with LEG_UNRESOLVED),
 * and refusals of a re-POST quarantine the payment (F-6).
 *
 * Layout: the design (§3) places this file at `src/dfns/gateway.ts`; this
 * package's file layout puts the gateway at `src/gateway/`, the only directory
 * besides `src/dfns/` allowed to import `src/dfns/**`. The boundary is enforced by
 * test/unit/dfns-boundary.test.ts until tools/ carries the dependency lint rule.
 *
 * The receiver's choice (payout to a stablecoin wallet or, later, fiat through a
 * payout partner) only changes the bound `to` address; the gateway checks the
 * binding the same way for both.
 */
import type { NativeWei, UsdcUnits } from '../amounts/index.js';
import { nativeWeiToUsdcUnits, usdcUnitsToNativeWei } from '../amounts/index.js';
import type { DfnsClient, DfnsResult } from '../dfns/client.js';
import {
  type DfnsTransfer,
  type DfnsTransferBody,
  ARC_TESTNET_CHAIN_ID,
  DFNS_ARC_MAINNET,
  DFNS_ARC_TESTNET,
  EVM_ADDRESS,
  ONLY_ATTEMPT,
  deriveExternalId,
  lpDigestHex,
  transferBodyDigest,
} from '../dfns/types.js';
import { idempotencyKey, isPaymentId } from '../nova-ports/ids.js';
import type { PortResult } from '../nova-ports/ids.js';
import type { LedgerPort } from '../nova-ports/ledger.js';
import type { WalletRegistryPort } from '../nova-ports/wallet-registry.js';
import type { Stage } from '../status/index.js';
import { type Address, type Hex, type WrapperRule, USDC_ERC20_ADDRESS, verifyWrapperCall } from './wrapper.js';

export type { Address, Hex, WrapperRule } from './wrapper.js';

/** Fee floor, 20 gwei in wei, C-30. The configured ceiling may not be below it. */
export const ARC_FEE_FLOOR_WEI = 20_000_000_000n;
/** Maximum base fee, 20,000 gwei in wei, C-31. The configured ceiling may not be above it. */
export const ARC_MAX_BASE_FEE_WEI = 20_000_000_000_000n;

/** Terminal stages (§13.1). */
const TERMINAL: readonly Stage[] = ['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'];
const isTerminal = (s: Stage): boolean => TERMINAL.includes(s);

// ---------------------------------------------------------------------------
// The binding, the leg and the ports the gateway reads (implemented by Nova, §7).
// ---------------------------------------------------------------------------

/** Structurally the §7.3 `TransferBinding`. */
export interface GatewayBinding {
  readonly network: string;
  readonly asset: string;
  readonly fromWallet: string;
  readonly fromAddress: Address;
  readonly dfnsWalletId: string;
  readonly to: Address;
  readonly amount: NativeWei;
  readonly digest: Hex;
}

/** §7.3 `SubmitMarker`: "a DFNS request may exist". Committed before the POST and never cleared. */
export interface SubmitMarker {
  /** `deriveExternalId(paymentId)`, the only externalId this leg will ever use. */
  readonly externalId: string;
  /** sha256 of the exact serialised POST body; every re-POST sends these same bytes. */
  readonly bodyDigest: Hex;
  readonly markedAt: string;
  /** A head both RPC sources agree on at marking; lower bound of the F-3b nonce search. */
  readonly markedAtBlock: bigint;
}

/** The payment's ARC_TRANSFER leg as §7.3 `LegRecord` holds it. */
export interface GatewayArcLeg {
  readonly stage: Stage;
  /** Always the literal 1 (R3-B2): no type admits a second DFNS request for one payment. */
  readonly attempt: 1n;
  readonly submit: SubmitMarker | null;
  /** The DFNS transfer id once known; null while the leg is UNRESOLVED or unsent. */
  readonly externalRef: string | null;
  /** A P6 outbox item is enqueued for this leg and not yet posted. */
  readonly p6Pending: boolean;
}

export interface GatewayPaymentView {
  readonly paymentId: string;
  /** Optimistic-concurrency version (§7.3), passed to `markSubmit`. */
  readonly version: bigint;
  /** Payment-level stage (§4.2). */
  readonly stage: Stage;
  readonly quarantined: boolean;
  /** The receiver's Nova owner ref when resolved to one of our customers (§7.5a); null for an outside address. */
  readonly receiver: string | null;
  readonly leg: GatewayArcLeg;
  readonly binding: GatewayBinding;
}

export type MarkSubmitRejectCode = 'NOT_FOUND' | 'VERSION_CONFLICT' | 'LEG_TERMINAL' | 'MARKER_CONFLICT';

/** The active wallet nonce holds (§7.3 `WalletNonceHold`), as check 5 needs them. */
export interface GatewayNonceHold {
  readonly holdId: string;
  readonly dfnsTransferId: string;
}

/**
 * The slice of §7.3 `PaymentStorePort` the gateway uses: the payment as stored, `markSubmit`
 * and `listActiveHolds`, with the §7.3 signatures and the §7.1 result model.
 */
export interface GatewayStorePort {
  getForSubmit(paymentId: string): Promise<PortResult<GatewayPaymentView, 'NOT_FOUND'>>;
  markSubmit(paymentId: string, expectedVersion: bigint, marker: SubmitMarker): Promise<PortResult<unknown, MarkSubmitRejectCode>>;
  listActiveHolds(wallet: string): Promise<PortResult<readonly GatewayNonceHold[], never>>;
}

export interface GatewayRailPort {
  /** `agreedHead`: the latest block both RPC sources agree on, or null when there is none. */
  getRailState(): Promise<{ readonly paused: boolean; readonly indexerHealthy: boolean; readonly agreedHead: bigint | null }>;
}

export interface GatewayClock {
  /** ISO 8601 UTC, for `SubmitMarker.markedAt`. */
  nowIso(): string;
}

/** The network adapter's pre-submit check (§5.1 `precheck`): blocklist, zero address, self-transfer… */
export type NetworkPrecheck = (intent: {
  readonly from: Address;
  readonly to: Address;
  readonly amount: NativeWei;
}) => Promise<{ readonly ok: true } | { readonly ok: false; readonly code: string }>;

export type GatewayDfns = Pick<DfnsClient, 'getWallet' | 'getFees' | 'getTransfer' | 'createTransfer'>;

export interface GatewayConfig {
  /** Must be 5042002 (C-01). The composition root passes `ARC_TESTNET.chainId`. */
  readonly chainId: bigint;
  /** D1 sends `Native` until DFNS answers Q-N1. */
  readonly transferKind: 'Native' | 'Erc20';
  /** Our fee ceiling (Q-N8), between C-30 and C-31. */
  readonly feeCeilingWei: NativeWei;
  /** Allow-listed wrapper contracts. Empty in D1. */
  readonly wrapperAllowList: readonly WrapperRule[];
}

export interface GatewayDeps {
  readonly store: GatewayStorePort;
  readonly rail: GatewayRailPort;
  /** Nova's LedgerPort (§7.2): only `getJournalByKey` is read. */
  readonly ledger: Pick<LedgerPort, 'getJournalByKey'>;
  /** Nova's WalletRegistryPort (§7.4): only `findByAddress` is read. */
  readonly registry: Pick<WalletRegistryPort, 'findByAddress'>;
  readonly precheck: NetworkPrecheck;
  readonly clock: GatewayClock;
  readonly dfns: GatewayDfns;
}

// ---------------------------------------------------------------------------
// The submission and its outcome.
// ---------------------------------------------------------------------------

/** What the orchestrator proposes. It must equal the stored binding; it is never sent as is. */
export type ProposedTransfer =
  | { readonly kind: 'NATIVE'; readonly chainId: bigint; readonly to: Address; readonly amount: NativeWei }
  | { readonly kind: 'ERC20'; readonly chainId: bigint; readonly token: Address; readonly to: Address; readonly amount: UsdcUnits }
  | { readonly kind: 'CONTRACT_CALL'; readonly chainId: bigint; readonly target: Address; readonly data: Hex; readonly value: NativeWei };

/** No attempt field: a payment has exactly one DFNS transfer request (§8.4 check 3, R3-B2). */
export interface SubmitRequest {
  readonly paymentId: string;
  readonly proposed: ProposedTransfer;
}

export type RefusalCode =
  | 'RAIL_PAUSED'
  | 'INDEXER_UNHEALTHY'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_QUARANTINED'
  | 'BINDING_INVALID'
  | 'BINDING_MISMATCH'
  | 'CHAIN_ID_MISMATCH'
  | 'NETWORK_DISABLED'
  | 'TRANSFER_KIND_NOT_ENABLED'
  | 'CONTRACT_CALL_NOT_ALLOWED'
  | 'CALL_ROUTE_NOT_ENABLED'
  | 'RESERVATION_NOT_OPEN'
  | 'LEG_INCONSISTENT'
  | 'WALLET_NONCE_HOLD'
  | 'WALLET_NOT_FOUND'
  | 'WALLET_NOT_ACTIVE'
  | 'WALLET_IS_VAULT'
  | 'WALLET_ADDRESS_MISMATCH'
  | 'DESTINATION_NOT_ALLOWED'
  | 'NETWORK_PRECHECK'
  | 'FEES_UNEXPECTED'
  | 'MARKER_CONFLICT'
  | 'EXTERNAL_ID_CONFLICT'
  | 'DFNS_REJECTED';

export type RetryCode =
  | 'STORE_AMBIGUOUS'
  | 'LEDGER_AMBIGUOUS'
  | 'HOLDS_AMBIGUOUS'
  | 'REGISTRY_AMBIGUOUS'
  | 'MARKER_NOT_COMMITTED'
  | 'LEG_CHANGED'
  | 'DFNS_UNAVAILABLE'
  | 'FEE_ABOVE_CEILING'
  | 'DFNS_RETRYABLE';

export type GatewayOutcome =
  /** DFNS holds the transfer request. `replayed`: the leg already knew it (no POST). The caller stores `transfer.id` as `externalRef`. */
  | { readonly kind: 'SUBMITTED'; readonly externalId: string; readonly transfer: DfnsTransfer; readonly replayed: boolean }
  /**
   * Not sent, or sent and refused. `quarantine`: the caller must QUARANTINE the payment and page
   * (§2 rule 5). `dfnsTransferId`: a DFNS entity exists for this leg and must be linked in the
   * case even though its answer was refused (m4); null otherwise.
   */
  | { readonly kind: 'REFUSED'; readonly code: RefusalCode; readonly detail: string; readonly quarantine: boolean; readonly dfnsTransferId: string | null }
  /** Not sent; nothing is wrong with the payment. Try the same submission later. */
  | { readonly kind: 'RETRY_LATER'; readonly code: RetryCode; readonly detail: string }
  /** The POST may or may not have reached DFNS. The leg is UNRESOLVED: resolve only through the marker's externalId (F-6). */
  | { readonly kind: 'AMBIGUOUS'; readonly externalId: string; readonly detail: string };

export class GatewayConfigError extends Error {
  override readonly name = 'GatewayConfigError';
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

function refused(code: RefusalCode, detail: string, quarantine: boolean, dfnsTransferId: string | null = null): GatewayOutcome {
  return { kind: 'REFUSED', code, detail, quarantine, dfnsTransferId };
}

function retry(code: RetryCode, detail: string): GatewayOutcome {
  return { kind: 'RETRY_LATER', code, detail };
}

function dfnsDetail(r: Exclude<DfnsResult<unknown>, { readonly kind: 'OK' }>): string {
  return r.kind === 'REJECTED' ? `${r.code}: ${r.detail}` : `${r.cause}: ${r.detail}`;
}

function portDetail(r: Exclude<PortResult<unknown, string>, { readonly kind: 'OK' }>): string {
  return r.kind === 'REJECTED' ? `${r.code}: ${r.detail}` : r.cause;
}

/**
 * The binding digest: `0x` + sha256(lp('nv1-binding') ‖ lp(paymentId) ‖ lp('1') ‖
 * lp(network) ‖ lp(asset) ‖ lp(fromWallet) ‖ lp(fromAddress) ‖ lp(dfnsWalletId) ‖ lp(to) ‖
 * lp(amount)), addresses lower-cased, numbers in decimal (§7.3 "digest": the binding
 * fields + paymentId + attempt, which is always 1; `lp` as in §10.2). The payment store
 * writes it with this function and the gateway recomputes it.
 */
export function computeBindingDigest(paymentId: string, b: Omit<GatewayBinding, 'digest'>): Hex {
  return `0x${lpDigestHex([
    'nv1-binding',
    paymentId,
    ONLY_ATTEMPT.toString(10),
    b.network,
    b.asset,
    b.fromWallet,
    b.fromAddress.toLowerCase(),
    b.dfnsWalletId,
    b.to.toLowerCase(),
    b.amount.toString(10),
  ])}`;
}

/** Why DFNS's answer does not echo our request, or null when it does (§8.4 check 2; m4). */
export function echoMismatch(t: DfnsTransfer, walletId: string, body: DfnsTransferBody): string | null {
  const e = t.requestBody;
  const to = e.get('to');
  const contract = e.get('contract');
  if (t.externalId !== body.externalId) return `externalId ${String(t.externalId)}`;
  if (t.walletId !== walletId) return `wallet ${t.walletId}`;
  if (t.network !== DFNS_ARC_TESTNET) return `network ${t.network}`;
  if (e.get('kind') !== body.kind) return 'kind';
  if (typeof to !== 'string' || !same(to, body.to)) return 'recipient';
  if (e.get('amount') !== body.amount) return 'amount';
  if (body.kind === 'Erc20' ? typeof contract !== 'string' || !same(contract, body.contract) : contract !== undefined) return 'contract';
  return null;
}

export class SigningGateway {
  private readonly config: GatewayConfig;

  constructor(
    config: GatewayConfig,
    private readonly deps: GatewayDeps,
  ) {
    if (config.chainId !== ARC_TESTNET_CHAIN_ID) throw new GatewayConfigError('chainId must be Arc testnet 5042002 (C-01): testnet only');
    if (config.feeCeilingWei < ARC_FEE_FLOOR_WEI || config.feeCeilingWei > ARC_MAX_BASE_FEE_WEI) {
      throw new GatewayConfigError('feeCeilingWei must be between 20 gwei (C-30) and 20,000 gwei (C-31)');
    }
    this.config = Object.freeze({ ...config, wrapperAllowList: Object.freeze([...config.wrapperAllowList]) });
  }

  /** Check the proposal against the binding (chain pin, kind, recipient, amount, wrapper-call rule). */
  private checkProposal(view: GatewayPaymentView, p: ProposedTransfer): GatewayOutcome | null {
    const b = view.binding;
    if (p.chainId !== this.config.chainId) return refused('CHAIN_ID_MISMATCH', `proposed chain ${p.chainId}, pinned ${this.config.chainId}`, true);
    if (p.kind === 'CONTRACT_CALL') {
      const v = verifyWrapperCall(
        { target: p.target, data: p.data, value: p.value },
        { paymentId: view.paymentId, to: b.to, amount: b.amount },
        this.config.wrapperAllowList,
      );
      if (!v.ok) return refused('CONTRACT_CALL_NOT_ALLOWED', `${v.reason}: ${v.detail}`, true);
      return refused('CALL_ROUTE_NOT_ENABLED', 'the call verifies, but D1 has no allow-listed DFNS route for contract calls', false);
    }
    if (p.kind === 'NATIVE') {
      if (this.config.transferKind !== 'Native') return refused('TRANSFER_KIND_NOT_ENABLED', 'Native transfers are not enabled', false);
      if (!same(p.to, b.to) || p.amount !== b.amount) return refused('BINDING_MISMATCH', 'proposed recipient or amount differs from the binding', true);
      return null;
    }
    if (this.config.transferKind !== 'Erc20') return refused('TRANSFER_KIND_NOT_ENABLED', 'Erc20 transfers are not enabled (Q-N1)', false);
    if (!same(p.token, USDC_ERC20_ADDRESS)) return refused('CONTRACT_CALL_NOT_ALLOWED', `token ${p.token} is not USDC (C-12)`, true);
    if (!same(p.to, b.to) || usdcUnitsToNativeWei(p.amount) !== b.amount) {
      return refused('BINDING_MISMATCH', 'proposed recipient or amount differs from the binding', true);
    }
    return null;
  }

  /**
   * The DFNS body, from the binding only (§8.5). For Erc20 the amount is exact: `checkProposal`
   * already required `units × 10¹² = binding.amount`, so the remainder is zero.
   */
  private body(b: GatewayBinding, externalId: string): DfnsTransferBody {
    if (this.config.transferKind === 'Native') return { kind: 'Native', to: b.to, amount: b.amount.toString(10), externalId };
    return { kind: 'Erc20', contract: USDC_ERC20_ADDRESS, to: b.to, amount: nativeWeiToUsdcUnits(b.amount).units.toString(10), externalId };
  }

  /** §8.4 check 2, the open-reservation part. Null when open. */
  private async reservationOpen(view: GatewayPaymentView): Promise<GatewayOutcome | null> {
    const id = view.paymentId;
    if (isTerminal(view.stage) || isTerminal(view.leg.stage)) {
      return refused('RESERVATION_NOT_OPEN', `payment ${view.stage}, leg ${view.leg.stage}: the payment is over; a retry is a new payment`, false);
    }
    if (view.leg.p6Pending) return refused('RESERVATION_NOT_OPEN', 'a P6 release is pending for this leg', false);
    const p1 = await this.deps.ledger.getJournalByKey(idempotencyKey(`pay:${id}:p1`));
    if (p1.kind !== 'OK') return retry('LEDGER_AMBIGUOUS', `pay:${id}:p1 ${portDetail(p1)}`);
    if (p1.value === null) return refused('RESERVATION_NOT_OPEN', `no reservation journal pay:${id}:p1`, true);
    const p6 = await this.deps.ledger.getJournalByKey(idempotencyKey(`pay:${id}:p6`));
    // AMBIGUOUS counts as "a release may exist" (§8.4 check 2).
    if (p6.kind !== 'OK') return refused('RESERVATION_NOT_OPEN', `pay:${id}:p6 is ${portDetail(p6)}; counted as released`, false);
    if (p6.value !== null) {
      return refused('RESERVATION_NOT_OPEN', `release journal pay:${id}:p6 exists while the leg reads ${view.leg.stage}: inconsistent record`, true);
    }
    return null;
  }

  /** §8.4 check 6, the ownership part (not Arc-specific, so here rather than in the adapter). */
  private async destinationAllowed(view: GatewayPaymentView, quarantine: boolean): Promise<GatewayOutcome | null> {
    const found = await this.deps.registry.findByAddress('ARC', view.binding.to.toLowerCase() as Address);
    if (found.kind !== 'OK') return retry('REGISTRY_AMBIGUOUS', `findByAddress ${portDetail(found)}`);
    const w = found.value;
    if (w === null) return null;
    if (w.owner === 'COMPANY') return refused('DESTINATION_NOT_ALLOWED', `destination is company wallet ${w.walletRef}; company moves are P10 only`, quarantine);
    if (w.owner !== view.receiver) return refused('DESTINATION_NOT_ALLOWED', `destination wallet ${w.walletRef} is not owned by the payment's receiver`, quarantine);
    return null;
  }

  /**
   * §8.4 check 3: commit the submit marker, or verify the existing one, then read the record
   * back. Null when the POST may go.
   *
   * The read-back runs on every path, including `markSubmit` OK and a re-POST of a held marker.
   * `markSubmit` is idempotent for an equal marker without a version check (§7.3), so a view read
   * before a concurrent submitter committed the same marker and the payment was then QUARANTINED
   * would otherwise still POST (Lens R m1). The POST goes only if the record as stored now holds
   * our marker, is not QUARANTINED, is unresolved, open and bound to the same binding.
   */
  private async marker(view: GatewayPaymentView, marker: SubmitMarker): Promise<GatewayOutcome | null> {
    const held = view.leg.submit;
    let how = 'marker held';
    if (held !== null) {
      // Re-POST of an UNRESOLVED leg: only the marker's bytes, never a rebuilt different body.
      if (held.externalId !== marker.externalId || !same(held.bodyDigest, marker.bodyDigest)) {
        return refused('MARKER_CONFLICT', 'the body built now is not the body the marker committed; a re-POST must send the marker bytes', true);
      }
    } else {
      const r = await this.deps.store.markSubmit(view.paymentId, view.version, marker);
      if (r.kind === 'REJECTED' && r.code === 'LEG_TERMINAL') return refused('RESERVATION_NOT_OPEN', `markSubmit: ${r.detail}`, false);
      if (r.kind === 'REJECTED' && r.code === 'MARKER_CONFLICT') return refused('MARKER_CONFLICT', `markSubmit: ${r.detail}`, true);
      if (r.kind === 'REJECTED' && r.code === 'NOT_FOUND') return refused('PAYMENT_NOT_FOUND', `markSubmit: ${r.detail}`, false);
      // OK, AMBIGUOUS or VERSION_CONFLICT: the read-back decides.
      how = r.kind === 'OK' ? 'marker committed' : `markSubmit ${portDetail(r)}`;
    }
    const back = await this.deps.store.getForSubmit(view.paymentId);
    if (back.kind !== 'OK') return retry('STORE_AMBIGUOUS', `${how}; read-back ${portDetail(back)}`);
    const v = back.value;
    const now = v.leg.submit;
    if (now === null) return retry('MARKER_NOT_COMMITTED', `${how}; read-back shows no marker`);
    if (now.externalId !== marker.externalId || !same(now.bodyDigest, marker.bodyDigest)) {
      return refused('MARKER_CONFLICT', 'read-back shows a different submit marker', true);
    }
    if (v.quarantined) return refused('PAYMENT_QUARANTINED', `${how}; read-back shows the payment QUARANTINED: a re-POST needs a LIFT_QUARANTINE decision first`, false);
    if (!same(v.binding.digest, view.binding.digest)) return refused('BINDING_MISMATCH', 'read-back shows a different binding', true);
    if (v.leg.externalRef !== null) return retry('LEG_CHANGED', `read-back shows DFNS transfer ${v.leg.externalRef} recorded meanwhile; the next submit reads it back`);
    if (isTerminal(v.stage) || isTerminal(v.leg.stage) || v.leg.p6Pending) {
      return refused('LEG_INCONSISTENT', `read-back shows payment ${v.stage}, leg ${v.leg.stage}, p6Pending ${v.leg.p6Pending} under a submit marker`, true);
    }
    return null;
  }

  /** §8.4 check 5: any active nonce hold on the source wallet refuses; an unreadable hold list retries. */
  private async holdCheck(wallet: string, when: string): Promise<GatewayOutcome | null> {
    const holds = await this.deps.store.listActiveHolds(wallet);
    if (holds.kind !== 'OK') return retry('HOLDS_AMBIGUOUS', `${when}listActiveHolds ${portDetail(holds)}`);
    const hold = holds.value[0];
    if (hold !== undefined) return refused('WALLET_NONCE_HOLD', `${when}wallet ${wallet} held by ${hold.holdId} (DFNS transfer ${hold.dfnsTransferId})`, false);
    return null;
  }

  async submit(req: SubmitRequest): Promise<GatewayOutcome> {
    const { deps } = this;
    const rail = await deps.rail.getRailState();
    if (rail.paused) return refused('RAIL_PAUSED', 'outbound movement is paused', false);
    if (!rail.indexerHealthy || rail.agreedHead === null) return refused('INDEXER_UNHEALTHY', 'the Arc indexer is stalled, disagreeing or has no agreed head', false);
    // Payments only. A P10 move gets its own check 2 (the approved move record) when P10 is built.
    if (!isPaymentId(req.paymentId)) return refused('PAYMENT_NOT_FOUND', `${req.paymentId} is not a payment id`, false);

    const got = await deps.store.getForSubmit(req.paymentId);
    if (got.kind === 'AMBIGUOUS') return retry('STORE_AMBIGUOUS', got.cause);
    if (got.kind === 'REJECTED' || got.value.paymentId !== req.paymentId) return refused('PAYMENT_NOT_FOUND', req.paymentId, false);
    const view = got.value;
    if (view.quarantined) return refused('PAYMENT_QUARANTINED', `${req.paymentId}: a re-POST needs a LIFT_QUARANTINE decision first`, false);
    const b = view.binding;
    if (b.network !== 'ARC' || b.asset !== 'USDC' || !EVM_ADDRESS.test(b.to) || !EVM_ADDRESS.test(b.fromAddress) || b.amount <= 0n) {
      return refused('BINDING_INVALID', 'binding is not an ARC/USDC transfer of a positive amount between EVM addresses', true);
    }
    if (!same(computeBindingDigest(view.paymentId, b), b.digest)) return refused('BINDING_MISMATCH', 'stored binding digest does not recompute', true);

    const proposal = this.checkProposal(view, req.proposed);
    if (proposal !== null) return proposal;

    const reservation = await this.reservationOpen(view);
    if (reservation !== null) return reservation;

    const externalId = deriveExternalId(view.paymentId);
    const body = this.body(b, externalId);
    const leg = view.leg;
    if (leg.externalRef !== null) {
      // Resolved: DFNS already holds the entity. Never POST again; read it.
      if (leg.submit === null || leg.submit.externalId !== externalId) return refused('LEG_INCONSISTENT', 'DFNS transfer recorded without a matching submit marker', true);
      const existing = await deps.dfns.getTransfer(b.dfnsWalletId, leg.externalRef);
      if (existing.kind !== 'OK') return retry('DFNS_UNAVAILABLE', `get transfer: ${dfnsDetail(existing)}`);
      const bad = existing.value.id === leg.externalRef ? echoMismatch(existing.value, b.dfnsWalletId, body) : `id ${existing.value.id}`;
      if (bad !== null) return refused('BINDING_MISMATCH', `recorded DFNS transfer differs: ${bad}`, true, leg.externalRef);
      return { kind: 'SUBMITTED', externalId, transfer: existing.value, replayed: true };
    }
    const markerSet = leg.submit !== null;

    const held = await this.holdCheck(b.fromWallet, '');
    if (held !== null) return held;

    const wallet = await deps.dfns.getWallet(b.dfnsWalletId);
    if (wallet.kind === 'REJECTED' && wallet.code === 'NOT_FOUND') return refused('WALLET_NOT_FOUND', b.dfnsWalletId, true);
    if (wallet.kind !== 'OK') return retry('DFNS_UNAVAILABLE', `get wallet: ${dfnsDetail(wallet)}`);
    const w = wallet.value;
    if (w.network === DFNS_ARC_MAINNET) return refused('NETWORK_DISABLED', 'wallet is on Arc mainnet; mainnet is disabled (§11)', true);
    if (w.network !== DFNS_ARC_TESTNET) return refused('CHAIN_ID_MISMATCH', `wallet network ${w.network} is not ${DFNS_ARC_TESTNET}`, true);
    if (w.id !== b.dfnsWalletId) return refused('WALLET_ADDRESS_MISMATCH', `DFNS returned wallet ${w.id}`, true);
    if (w.status !== 'Active') return refused('WALLET_NOT_ACTIVE', `wallet status ${w.status}`, false);
    if (w.vaultId !== null) return refused('WALLET_IS_VAULT', `wallet is controlled by vault ${w.vaultId}`, true);
    if (w.address === null || !same(w.address, b.fromAddress)) return refused('WALLET_ADDRESS_MISMATCH', 'DFNS wallet address differs from the binding', true);

    // A refused re-POST of an UNRESOLVED leg never ends the leg: QUARANTINE (F-3a, F-6).
    const destination = await this.destinationAllowed(view, markerSet);
    if (destination !== null) return destination;
    const pre = await deps.precheck({ from: b.fromAddress, to: b.to, amount: b.amount });
    if (!pre.ok) return refused('NETWORK_PRECHECK', pre.code, markerSet);

    const fees = await deps.dfns.getFees();
    if (fees.kind !== 'OK') return retry('DFNS_UNAVAILABLE', `fees: ${dfnsDetail(fees)}`);
    if (fees.value.network !== DFNS_ARC_TESTNET) return refused('FEES_UNEXPECTED', `fees for ${fees.value.network}`, false);
    if (fees.value.standardMaxFeePerGas > this.config.feeCeilingWei) {
      return retry('FEE_ABOVE_CEILING', `standard maxFeePerGas ${fees.value.standardMaxFeePerGas} > ceiling ${this.config.feeCeilingWei}`);
    }

    const bodyDigest = transferBodyDigest(body) as Hex;
    const marked = await this.marker(view, { externalId, bodyDigest, markedAt: deps.clock.nowIso(), markedAtBlock: rail.agreedHead });
    if (marked !== null) return marked;
    // §8.4 check 3 (c) and check 5: a hold placed while the marker was committed (a concurrent
    // `applySignal` with `placeHold`) must stop this POST too, so read holds again immediately
    // before it (Lens R-1 m1). The marker stays; the leg is UNRESOLVED and a later submit re-POSTs
    // only the marker bytes once the hold is released.
    const heldNow = await this.holdCheck(b.fromWallet, 'after the submit marker: ');
    if (heldNow !== null) return heldNow;

    const created = await deps.dfns.createTransfer(b.dfnsWalletId, body, bodyDigest);
    if (created.kind === 'AMBIGUOUS') return { kind: 'AMBIGUOUS', externalId, detail: `leg UNRESOLVED: ${dfnsDetail(created)}` };
    if (created.kind === 'REJECTED') {
      if (created.code === 'CONFLICT') return refused('EXTERNAL_ID_CONFLICT', `409 for ${externalId} [DF:idem]`, true);
      if (created.retryable) return retry('DFNS_RETRYABLE', dfnsDetail(created));
      return refused('DFNS_REJECTED', `${dfnsDetail(created)}; leg stays UNRESOLVED (F-6)`, true);
    }
    const t = created.value;
    const bad = echoMismatch(t, b.dfnsWalletId, body);
    if (bad !== null) return refused('BINDING_MISMATCH', `DFNS answered transfer ${t.id} that does not echo our request: ${bad}`, true, t.id);
    return { kind: 'SUBMITTED', externalId, transfer: t, replayed: false };
  }
}
