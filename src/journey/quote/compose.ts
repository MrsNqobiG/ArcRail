/**
 * JQUOTE: the all-in journey quote (docs/NOVA_ARC_DESIGN.md §4.1 "Quote").
 *
 * Operator goal: a user sends a payment in a traditional currency, the
 * conversion happens, the journey is reported, and it lands in the receiver's
 * account. Operator correction: the PAYER picks the pay-in method (fiat or
 * stablecoin) and the RECEIVER picks the payout method (fiat bank account or
 * stablecoin wallet; resolved server-side through ReceiverPort, never from the
 * payer's request).
 *
 * One quote per payment. It composes ONLY the legs the two choices need
 * (`journeyLegs`, src/status/journey.ts):
 * - CONVERT_IN, only when the payer picks FIAT: fiat→USDC through an
 *   FxLocker (the fill desk, fill.ts: a Nova pricing code whose own
 *   `expiresAt` is the rate lock, design delta 1 D-1; this package computes
 *   no rate);
 * - ARC_TRANSFER, always: USDC on Arc, with the network fee allowance in the
 *   native 18-dp view (C-10) split by U1 into ledger minor units and sub-minor
 *   dust (dust goes to suspense with a record, never dropped);
 * - PAYOUT, only when the receiver picks FIAT_BANK: USDC→payout currency and
 *   the partner's fee via PayoutQuotePort.
 * It returns the all-in recipient amount, the customer fee `F` (design §9.2:
 * Raayl's platform fee plus any network fee charged to the payer, which goes
 * through `F` and never after the fact, K-12), the expiry (the earliest of
 * our own TTL and every rate lock) and the rate locks themselves. The Arc
 * amount `A` and `F` are the two numbers P1 reserves (A + F).
 *
 * Rules: integer bigint only (MC-01); only U1's checked add/subtract and
 * conversions on U1 amounts (no re-brand of raw arithmetic); idempotency keys
 * derived from the request id, so a retried request replays the same locks;
 * every port answer is checked by an exact identity before use, and the
 * composed quote is re-checked by `checkConservation` (fail closed: a failed
 * check throws `QuoteIntegrityError`, and the caller QUARANTINEs). Feature
 * flags are honoured (`journeyEnabled`): a method is never silently switched.
 * Cross-border (a fiat leg in a currency other than the home currency) is
 * refused unless the explicitly labelled testnet demo mode is set, and even
 * then only when the settlement network adapter itself is pinned to Arc
 * testnet (chain ID 5042002, C-01) and only through a payout partner that the
 * composition root declares non-LIVE (stub or fake), until a legal opinion is
 * recorded (CO-1 v3 D5).
 */
import { addCbsMinor, cbsMinor, cbsMinorToNativeWei, nativeWei, nativeWeiToCbsMinor, subtractCbsMinor } from '../../amounts/index.js';
import type { CbsMinor, CbsPrecision, NativeWei } from '../../amounts/index.js';
import type { RatioQuote, QuoteRequest } from '../../nova-ports/conversion.js';
import { ambiguous, idempotencyKey, ledgerAssetCode, lpDigestHex, ok, rejected } from '../../nova-ports/ids.js';
import type { AssetId, FiatCode, IdempotencyKey, LedgerAssetCode, NetworkId, PortResult } from '../../nova-ports/ids.js';
import type { NetworkAdapter } from '../../network/types.js';
import { journeyEnabled, journeyLegs } from '../../status/journey.js';
import type { JourneyFlags, PayInMethod, PayoutMethod } from '../../status/journey.js';
import type { LegKind } from '../../status/index.js';
import { fiatFromLedger, fiatText } from './fiat.js';
import type { FiatAmount } from './fiat.js';
import { checkFxLock, checkPayoutQuote, remainderBelowOneUnit } from './ports.js';
import type { Clock, FxLock, FxLocker, PartnerKind, PayoutQuote, PayoutQuotePort, PayoutQuoteRequest } from './ports.js';

// ---------------------------------------------------------------------------
// Configuration and request.
// ---------------------------------------------------------------------------

/** The settlement stablecoin. A parameter; only USDC is implemented (EURC etc. later). */
export interface SettlementAsset {
  readonly network: NetworkId;
  readonly asset: AssetId;
  /** Nova ledger asset code of the stablecoin [A-03]. */
  readonly ledgerCode: LedgerAssetCode;
  /** Nova ledger precision p of the stablecoin [A-01]. */
  readonly precision: CbsPrecision;
}

/**
 * Cross-border switch. OFF until a legal opinion is recorded (CO-1 v3 D5);
 * there is deliberately no production "ON" value. The demo mode is testnet
 * only (chain ID 5042002, C-01): both this config literal and the chain ID the
 * settlement network adapter is pinned to must be 5042002, and it serves only
 * a payout partner the composition root declares non-LIVE.
 */
export type CrossBorderConfig =
  | { readonly mode: 'OFF' }
  | { readonly mode: 'TESTNET_DEMO_STUB_ONLY'; readonly chainId: 5042002n };

/** Who bears the network fee. The company by default (GL-3); charging the payer goes through the quote, never after the fact (K-12). */
export type GasCharging = 'COMPANY_ABSORBS' | 'CHARGED_TO_PAYER';

export interface QuoteConfig {
  readonly settlement: SettlementAsset;
  /** The domestic currency; a fiat leg in any other currency is cross-border (ZAR for Raayl [A-03]). */
  readonly homeCurrency: FiatCode;
  readonly flags: JourneyFlags;
  readonly crossBorder: CrossBorderConfig;
  /** Our own quote lifetime, > 0. The quote expires at the earliest of this and every rate lock. */
  readonly ttlMs: bigint;
  readonly gasCharging: GasCharging;
  /**
   * Raayl's customer (platform) fee per payment, settlement-asset ledger minor
   * units, posted to GL-6 by P3 (design §9.2 `F`); 0 for none. A flat amount
   * supplied by Raayl: its fee model is not known yet (K-12), so this package
   * computes no fee.
   */
  readonly platformFeeMinor: CbsMinor;
}

/** The settlement network adapter's own pinned identity (`NetworkAdapter.network`, `.chainId`). */
export type SettlementNetworkPin = Pick<NetworkAdapter, 'network' | 'chainId'>;

/**
 * A payout partner as wired by the composition root. `kind` is the root's own
 * declaration; the port's self-declared `partnerKind` must agree with it, or
 * the quote fails closed (QuoteIntegrityError).
 */
export interface WiredPayoutPartner {
  readonly port: PayoutQuotePort;
  readonly kind: PartnerKind;
}

export interface QuoteDeps {
  readonly clock: Clock;
  /** The settlement network adapter (its pinned network and chain ID), never a config value. */
  readonly settlementNetwork: SettlementNetworkPin;
  /** Required for a FIAT pay-in; null refuses such a quote (METHOD_NOT_ENABLED). The fill desk's locker for this payment (D-1). */
  readonly fx: FxLocker | null;
  /** Required for a FIAT_BANK payout; null refuses such a quote (METHOD_NOT_ENABLED). */
  readonly payout: WiredPayoutPartner | null;
  /** Upper bound of the network fee of one transfer, native 18-dp view (from the gas unit, U11). */
  networkFeeAllowanceWei(network: NetworkId): NativeWei;
}

/** Money in one of the two kinds of asset a journey touches. */
export type JourneyMoney =
  | { readonly kind: 'FIAT'; readonly fiat: FiatAmount }
  | { readonly kind: 'STABLECOIN'; readonly asset: AssetId; readonly minor: CbsMinor };

/** `SEND_EXACT`: the payer's debit is fixed. `RECEIVE_EXACT`: what the receiver gets is fixed. */
export type QuoteSide = 'SEND_EXACT' | 'RECEIVE_EXACT';

export interface JourneyQuoteRequest {
  /** Server-generated business id of this quote request; every idempotency key is derived from it. */
  readonly requestId: string;
  /** The payer's choice. */
  readonly payIn: PayInMethod;
  /** The receiver's choice, resolved server-side (ReceiverPort), never from the payer's request. */
  readonly payout: PayoutMethod;
  readonly side: QuoteSide;
  /** In the pay-in asset (SEND_EXACT) or the payout asset (RECEIVE_EXACT); > 0. */
  readonly amount: JourneyMoney;
}

// ---------------------------------------------------------------------------
// The quote.
// ---------------------------------------------------------------------------

export interface ConvertInLine {
  readonly leg: 'CONVERT_IN';
  readonly fxQuoteId: string;
  readonly provider: string;
  /** USDC minor units per fiat minor unit. */
  readonly rate: RatioQuote;
  readonly from: FiatAmount;
  /** USDC ledger minor units. */
  readonly to: CbsMinor;
  /** Fiat not converted; Nova's engine posts it to its suspense [A-51]. */
  readonly remainder: FiatAmount;
  readonly expiresAtMs: bigint;
}

export interface ArcTransferLine {
  readonly leg: 'ARC_TRANSFER';
  readonly network: NetworkId;
  readonly asset: AssetId;
  /** The receiver's wallet (STABLECOIN_WALLET) or the payout partner's settlement address (FIAT_BANK) [A-52]. */
  readonly destination: 'RECEIVER_WALLET' | 'PARTNER_SETTLEMENT';
  /** USDC ledger minor units moved on Arc. */
  readonly amount: CbsMinor;
  /** The same amount in the native 18-dp view, exact (U1 `cbsMinorToNativeWei`). */
  readonly amountWei: NativeWei;
  /** Network fee allowance, native 18-dp view. */
  readonly gasAllowanceWei: NativeWei;
  /** Whole minor units of the allowance charged to the payer (0 when the company absorbs gas). */
  readonly gasChargeMinor: CbsMinor;
  /** Allowance wei below one minor unit, not covered by the charge (0 when the company absorbs gas). */
  readonly gasDustWei: NativeWei;
}

export interface PayoutLine {
  readonly leg: 'PAYOUT';
  readonly payoutQuoteId: string;
  readonly partnerKind: PartnerKind;
  /** Payout-currency minor units per USDC minor unit. */
  readonly rate: RatioQuote;
  /** USDC ledger minor units sent to the partner (equals the Arc transfer amount). */
  readonly source: CbsMinor;
  readonly gross: FiatAmount;
  readonly fee: FiatAmount;
  /** What the recipient receives. */
  readonly net: FiatAmount;
  readonly expiresAtMs: bigint;
}

/**
 * Sub-unit amounts the quote sets aside or leaves uncharged. Never dropped.
 * - FX_REMAINDER: fiat below one convertible step of the FX rate; Nova's
 *   engine posts it to its own suspense [A-51].
 * - PAYOUT_REMAINDER: payer USDC below one convertible step of the partner's
 *   rate (the payer's value). Proposed suspense `GL-4 arc.quoteDust` is NOT a
 *   design §9.1 account yet; who owns it is a human decision (OPEN_QUESTIONS
 *   Q-N23, the K-13 analogue). Until decided, nothing downstream may sweep it.
 * - GAS_ALLOWANCE_SUBMINOR: the part of the network fee ALLOWANCE below one
 *   minor unit, not charged to the payer. It is not value held anywhere, so
 *   it is NON_POSTING: the real gas and its sub-minor dust are posted from
 *   the receipt by P4/P4D into GL-4 `arc.gasDust.<from>` (design §9.2).
 *   Posting this record too would double-count gas dust (Q-N23).
 */
export type DustRecord =
  | { readonly source: 'FX_REMAINDER'; readonly fiat: FiatAmount; readonly suspense: 'NOVA_FX_ENGINE_SUSPENSE' }
  | { readonly source: 'GAS_ALLOWANCE_SUBMINOR'; readonly wei: NativeWei; readonly posting: 'NON_POSTING' }
  | { readonly source: 'PAYOUT_REMAINDER'; readonly usdcMinor: CbsMinor; readonly suspense: 'GL-4 arc.quoteDust' };

/** Design §9.2 `F`, settlement-asset ledger minor units: what P1 reserves on top of the Arc amount `A`. */
export interface CustomerFee {
  /** Raayl's platform fee (GL-6 via P3). */
  readonly platformMinor: CbsMinor;
  /** Whole minor units of the network fee allowance charged to the payer (equals `arcTransfer.gasChargeMinor`). */
  readonly gasMinor: CbsMinor;
  /** F = platform + gas. */
  readonly totalMinor: CbsMinor;
}

export interface JourneyQuote {
  /** Deterministic digest of every field below: the binding a payment must carry unchanged. */
  readonly quoteId: string;
  readonly requestId: string;
  readonly side: QuoteSide;
  readonly payIn: PayInMethod;
  readonly payout: PayoutMethod;
  /** Exactly `journeyLegs(payIn, payout)`. */
  readonly legs: readonly LegKind[];
  /** What the payer is debited (the RESERVE leg). */
  readonly payer: JourneyMoney;
  /** All-in: what the receiver gets. */
  readonly recipient: JourneyMoney;
  /** recipient minor units per payer minor unit, all fees and conversions included. */
  readonly allInRate: RatioQuote;
  /** F of design §9.2; P1 reserves `arcTransfer.amount` (A) + `customerFee.totalMinor` (F). */
  readonly customerFee: CustomerFee;
  readonly convertIn: ConvertInLine | null;
  readonly arcTransfer: ArcTransferLine;
  readonly payoutLine: PayoutLine | null;
  readonly dust: readonly DustRecord[];
  readonly crossBorder: boolean;
  /** True only when served under the testnet demo cross-border mode. Never a production quote. */
  readonly demoOnly: boolean;
  readonly createdAtMs: bigint;
  /** Earliest of our TTL and every rate lock. */
  readonly expiresAtMs: bigint;
}

export type QuoteRefusal =
  | 'METHOD_NOT_ENABLED'
  | 'CROSS_BORDER_DISABLED'
  | 'ASSET_NOT_SUPPORTED'
  | 'AMOUNT_INVALID'
  | 'AMOUNT_TOO_SMALL'
  | 'NO_ROUTE'
  | 'LIMIT'
  | 'BELOW_MINIMUM'
  | 'KEY_CONFLICT'
  | 'BAD_EXPIRY'
  | 'BAD_CODE'
  | 'FILL_OUTSTANDING'
  | 'RATE_LOCK_EXPIRED';

/** A port answered with something that is not an exact quote, or the composed quote does not conserve value. Fail closed. */
export class QuoteIntegrityError extends Error {
  readonly code = 'QUOTE_INTEGRITY';

  constructor(detail: string) {
    super(`journey quote integrity: ${detail}`);
    this.name = 'QuoteIntegrityError';
  }
}

// ---------------------------------------------------------------------------
// Decisions.
// ---------------------------------------------------------------------------

/** Arc testnet chain ID (C-01): the only chain the cross-border demo may run on. */
const ARC_TESTNET_CHAIN_ID = 5042002n;

/** The fiat currency of a FIAT pay-in; null for a stablecoin pay-in. */
function payInCurrency(m: PayInMethod): FiatCode | null {
  return m.method === 'FIAT' ? m.currency : null;
}

/** The fiat currency of a FIAT_BANK payout; null for a stablecoin payout. */
function payoutCurrency(m: PayoutMethod): FiatCode | null {
  return m.method === 'FIAT_BANK' ? m.currency : null;
}

/** A fiat leg in any currency other than the home currency makes the payment cross-border. */
export function isCrossBorder(payIn: PayInMethod, payout: PayoutMethod, homeCurrency: FiatCode): boolean {
  const i = payInCurrency(payIn);
  const o = payoutCurrency(payout);
  return (i !== null && i !== homeCurrency) || (o !== null && o !== homeCurrency);
}

/**
 * Whether a cross-border payment may be quoted. OFF: never. Testnet demo:
 * only when both the config literal and the chain ID the settlement network
 * adapter is pinned to are 5042002 (C-01), only when the foreign leg is the
 * payout (a foreign fiat pay-in has no stub path) and only through a partner
 * the composition root declares non-LIVE.
 */
export function crossBorderAllowed(cfg: CrossBorderConfig, adapterChainId: bigint, payIn: PayInMethod, payout: PayoutMethod, homeCurrency: FiatCode, partner: PartnerKind | null): boolean {
  if (cfg.mode !== 'TESTNET_DEMO_STUB_ONLY' || cfg.chainId !== ARC_TESTNET_CHAIN_ID || adapterChainId !== ARC_TESTNET_CHAIN_ID) return false;
  const i = payInCurrency(payIn);
  if (i !== null && i !== homeCurrency) return false;
  return payoutCurrency(payout) !== null && partner !== null && partner !== 'LIVE';
}

/** Deterministic idempotency key of one port call of this request (`[a-z0-9:-]`, 70 characters). */
export function quoteCallKey(requestId: string, call: 'fx' | 'payout-1' | 'payout-2'): IdempotencyKey {
  return idempotencyKey(`jq:${call === 'fx' ? 'fx' : call === 'payout-1' ? 'p1' : 'p2'}:${lpDigestHex(['jquote', call, requestId])}`);
}

/** True while the quote may still be used: strictly before its expiry. */
export function isQuoteLive(q: JourneyQuote, nowMs: bigint): boolean {
  return nowMs < q.expiresAtMs;
}

const REQUEST_ID = /^\S{1,255}$/;

function moneyText(m: JourneyMoney): string {
  return m.kind === 'FIAT' ? `FIAT:${fiatText(m.fiat)}` : `STABLECOIN:${m.asset}:${m.minor.toString()}`;
}

function methodText(m: PayInMethod | PayoutMethod): string {
  switch (m.method) {
    case 'FIAT':
      return `FIAT:${m.currency}`;
    case 'FIAT_BANK':
      return `FIAT_BANK:${m.currency}:${m.beneficiaryRef}`;
    case 'STABLECOIN_WALLET':
      return `STABLECOIN_WALLET:${m.asset}:${m.network}:${m.beneficiaryRef}`;
    default:
      return `${m.method}:${m.asset}:${m.network}`;
  }
}

function dustText(d: DustRecord): string {
  switch (d.source) {
    case 'FX_REMAINDER':
      return `${d.source}:${fiatText(d.fiat)}:${d.suspense}`;
    case 'GAS_ALLOWANCE_SUBMINOR':
      return `${d.source}:${d.wei.toString()}:${d.posting}`;
    default:
      return `${d.source}:${d.usdcMinor.toString()}:${d.suspense}`;
  }
}

/** The dust records a quote must carry, in order: FX remainder, gas sub-minor allowance, then the payout remainder (if any). */
function dustRecords(convertIn: ConvertInLine | null, gasDustWei: NativeWei, payout: readonly DustRecord[]): readonly DustRecord[] {
  const fx: readonly DustRecord[] = convertIn !== null && convertIn.remainder.minor > 0n ? [{ source: 'FX_REMAINDER', fiat: convertIn.remainder, suspense: 'NOVA_FX_ENGINE_SUSPENSE' }] : [];
  const gas: readonly DustRecord[] = gasDustWei > 0n ? [{ source: 'GAS_ALLOWANCE_SUBMINOR', wei: gasDustWei, posting: 'NON_POSTING' }] : [];
  return Object.freeze([...fx, ...gas, ...payout]);
}

/** The canonical field list the quote id is the digest of. */
export function quoteFields(q: Omit<JourneyQuote, 'quoteId'>): readonly string[] {
  const c = q.convertIn;
  const a = q.arcTransfer;
  const p = q.payoutLine;
  return [
    'jquote-v1',
    q.requestId,
    q.side,
    methodText(q.payIn),
    methodText(q.payout),
    q.legs.join(','),
    moneyText(q.payer),
    moneyText(q.recipient),
    `${q.allInRate.numerator}/${q.allInRate.denominator}`,
    [q.customerFee.platformMinor.toString(), q.customerFee.gasMinor.toString(), q.customerFee.totalMinor.toString()].join('|'),
    c === null ? '-' : [c.fxQuoteId, c.provider, `${c.rate.numerator}/${c.rate.denominator}`, fiatText(c.from), c.to.toString(), fiatText(c.remainder), c.expiresAtMs.toString()].join('|'),
    [a.network, a.asset, a.destination, a.amount.toString(), a.amountWei.toString(), a.gasAllowanceWei.toString(), a.gasChargeMinor.toString(), a.gasDustWei.toString()].join('|'),
    p === null ? '-' : [p.payoutQuoteId, p.partnerKind, `${p.rate.numerator}/${p.rate.denominator}`, p.source.toString(), fiatText(p.gross), fiatText(p.fee), fiatText(p.net), p.expiresAtMs.toString()].join('|'),
    q.dust.map(dustText).join(','),
    `${q.crossBorder}`,
    `${q.demoOnly}`,
    q.createdAtMs.toString(),
    q.expiresAtMs.toString(),
  ];
}

/** `jq-` + sha256 over the length-prefixed canonical fields (§10.2 derivation). */
export function quoteDigest(q: Omit<JourneyQuote, 'quoteId'>): string {
  return `jq-${lpDigestHex(quoteFields(q))}`;
}

function usdcOf(m: JourneyMoney): CbsMinor | null {
  return m.kind === 'STABLECOIN' ? m.minor : null;
}

/**
 * Re-derives every amount relation of a composed quote (reconstruction, not
 * inspection). Null when the quote conserves value to the base unit; else why
 * not. The composer runs it on every quote before returning it.
 */
export function checkConservation(q: JourneyQuote, settlement: SettlementAsset): string | null {
  if (q.legs.join(',') !== journeyLegs(q.payIn, q.payout).join(',')) return 'legs do not match the journey';
  if ((q.convertIn !== null) !== (q.payIn.method === 'FIAT')) return 'CONVERT_IN present iff the payer picks FIAT';
  if ((q.payoutLine !== null) !== (q.payout.method === 'FIAT_BANK')) return 'PAYOUT present iff the receiver picks FIAT_BANK';
  const a = q.arcTransfer;
  if (cbsMinorToNativeWei(a.amount, settlement.precision) !== a.amountWei) return 'Arc amount views disagree';
  if (a.amount <= 0n) return 'nothing moves on Arc';
  const gas = nativeWeiToCbsMinor(a.gasAllowanceWei, settlement.precision);
  const charged = a.gasChargeMinor !== 0n || a.gasDustWei !== 0n;
  if (charged && (gas.minor !== a.gasChargeMinor || gas.dustWei !== a.gasDustWei)) return 'gas charge is not the U1 split of the allowance';
  const f = q.customerFee;
  if (f.gasMinor !== a.gasChargeMinor) return 'customer fee does not carry the gas charge';
  if (addCbsMinor(f.platformMinor, f.gasMinor) !== f.totalMinor) return 'customer fee is not platform plus gas';

  // USDC that enters the Arc leg: converted from fiat, or debited directly.
  let usdcIn: CbsMinor | null;
  if (q.convertIn === null) {
    usdcIn = usdcOf(q.payer);
  } else {
    const c = q.convertIn;
    if (q.payer.kind !== 'FIAT' || q.payer.fiat.currency !== c.from.currency || q.payer.fiat.minor !== c.from.minor) return 'payer debit is not the converted amount';
    if (c.from.currency !== payInCurrency(q.payIn)) return 'payer debit is not in the pay-in currency';
    if ((c.from.minor - c.remainder.minor) * c.rate.numerator !== c.to * c.rate.denominator) return 'CONVERT_IN does not balance';
    if (!remainderBelowOneUnit(c.rate, c.remainder.minor)) return 'FX remainder is worth one target minor unit or more';
    usdcIn = c.to;
  }
  if (usdcIn === null) return 'payer debit is not in the settlement asset';

  // USDC out: Arc transfer (A) + customer fee (F) + payout remainder set aside.
  const payoutDust = q.dust.filter((d) => d.source === 'PAYOUT_REMAINDER');
  let out = addCbsMinor(a.amount, f.totalMinor);
  for (const d of payoutDust) out = addCbsMinor(out, d.usdcMinor);
  if (out !== usdcIn) return 'USDC in does not equal USDC out';

  if (q.payoutLine === null) {
    if (usdcOf(q.recipient) !== a.amount) return 'receiver amount is not the Arc amount';
  } else {
    const p = q.payoutLine;
    if (p.source !== a.amount) return 'partner is not funded with the Arc amount';
    if (p.source * p.rate.numerator !== p.gross.minor * p.rate.denominator) return 'PAYOUT does not balance';
    if (p.gross.minor - p.fee.minor !== p.net.minor) return 'net is not gross minus fee';
    if (q.recipient.kind !== 'FIAT' || q.recipient.fiat.currency !== p.net.currency || q.recipient.fiat.minor !== p.net.minor) return 'receiver amount is not the payout net';
    if (p.net.currency !== payoutCurrency(q.payout)) return 'receiver amount is not in the payout currency';
    if (payoutDust.some((d) => !remainderBelowOneUnit(p.rate, d.usdcMinor))) return 'payout remainder is worth one target minor unit or more';
  }
  // Dust: each record matches its leg; nothing set aside twice, nothing dropped.
  const expected = dustRecords(q.convertIn, a.gasDustWei, []).map(dustText).concat(payoutDust.map(dustText));
  if (q.dust.map(dustText).join(',') !== expected.join(',')) return 'dust records do not match the legs';
  if (payoutDust.length > 1 || payoutDust.some((d) => d.usdcMinor <= 0n || q.payoutLine === null)) return 'a payout remainder needs one positive record and a PAYOUT leg';

  if (q.allInRate.numerator !== moneyMinor(q.recipient) || q.allInRate.denominator !== moneyMinor(q.payer)) return 'all-in rate is not receiver over payer';
  if (q.quoteId !== quoteDigest(q)) return 'quote id is not the digest of its fields';
  if (q.expiresAtMs <= q.createdAtMs) return 'quote expires before it is created';
  if (q.convertIn !== null && q.expiresAtMs > q.convertIn.expiresAtMs) return 'quote outlives its FX lock';
  if (q.payoutLine !== null && q.expiresAtMs > q.payoutLine.expiresAtMs) return 'quote outlives its payout lock';
  return null;
}

// ---------------------------------------------------------------------------
// The composer.
// ---------------------------------------------------------------------------

type Refused = PortResult<never, QuoteRefusal>;

function refuse(code: QuoteRefusal, detail: string): Refused {
  return rejected(code, detail);
}

function minBig(a: bigint, b: bigint | null): bigint {
  return b !== null && b < a ? b : a;
}

/** The payer's side as the composer needs it: FIAT always has its FxPort. */
type PayInPlan = { readonly kind: 'FIAT'; readonly port: FxLocker; readonly currency: FiatCode } | { readonly kind: 'STABLECOIN' };
/** The receiver's side: FIAT_BANK always has its PayoutQuotePort. */
type PayoutPlan = { readonly kind: 'FIAT'; readonly port: PayoutQuotePort; readonly partner: PartnerKind; readonly currency: FiatCode } | { readonly kind: 'STABLECOIN' };

interface Plan {
  readonly payIn: PayInPlan;
  readonly payout: PayoutPlan;
  /** The exact side's amount in that side's ledger minor units (> 0). */
  readonly exactMinor: CbsMinor;
}

function exactAmount(req: JourneyQuoteRequest, s: SettlementAsset, exactCurrency: FiatCode | null): CbsMinor | Refused {
  const m = req.amount;
  if (exactCurrency !== null) {
    if (m.kind !== 'FIAT' || m.fiat.currency !== exactCurrency) return refuse('AMOUNT_INVALID', 'amount is not in the exact side currency');
    if (m.fiat.minor <= 0n) return refuse('AMOUNT_INVALID', 'amount must be positive');
    // Same ledger minor units [A-03]: the ledger view the ports speak.
    return cbsMinor(m.fiat.minor);
  }
  if (m.kind !== 'STABLECOIN' || m.asset !== s.asset) return refuse('AMOUNT_INVALID', 'amount is not in the settlement asset');
  if (m.minor <= 0n) return refuse('AMOUNT_INVALID', 'amount must be positive');
  return m.minor;
}

/** Validates the request against config, flags and wiring; the plan when it may be quoted. */
function planRequest(req: JourneyQuoteRequest, cfg: QuoteConfig, deps: QuoteDeps): Plan | Refused {
  const s = cfg.settlement;
  if (!REQUEST_ID.test(req.requestId)) return refuse('AMOUNT_INVALID', 'request id required');
  if (s.asset !== 'USDC') return refuse('ASSET_NOT_SUPPORTED', `${s.asset}: only USDC is implemented`);
  if (deps.settlementNetwork.network !== s.network) throw new QuoteIntegrityError('the settlement network adapter is not the configured settlement network');
  if (cfg.ttlMs <= 0n) return refuse('RATE_LOCK_EXPIRED', 'quote TTL must be positive');
  const { payIn, payout } = req;
  if (payIn.method !== 'FIAT' && (payIn.asset !== s.asset || payIn.network !== s.network)) return refuse('ASSET_NOT_SUPPORTED', 'pay-in asset or network is not the settlement asset');
  if (payout.method === 'STABLECOIN_WALLET' && (payout.asset !== s.asset || payout.network !== s.network)) return refuse('ASSET_NOT_SUPPORTED', 'payout asset or network is not the settlement asset');
  if (!journeyEnabled(payIn, payout, cfg.flags)) return refuse('METHOD_NOT_ENABLED', 'a chosen method is behind a closed flag');

  let inPlan: PayInPlan = { kind: 'STABLECOIN' };
  if (payIn.method === 'FIAT') {
    if (deps.fx === null) return refuse('METHOD_NOT_ENABLED', 'no FxPort wired');
    inPlan = { kind: 'FIAT', port: deps.fx, currency: payIn.currency };
  }
  let outPlan: PayoutPlan = { kind: 'STABLECOIN' };
  if (payout.method === 'FIAT_BANK') {
    if (deps.payout === null) return refuse('METHOD_NOT_ENABLED', 'no PayoutQuotePort wired');
    if (deps.payout.port.partnerKind !== deps.payout.kind) throw new QuoteIntegrityError('the payout port does not declare the partner kind the composition root wired');
    outPlan = { kind: 'FIAT', port: deps.payout.port, partner: deps.payout.kind, currency: payout.currency };
  }
  const partner = outPlan.kind === 'FIAT' ? outPlan.partner : null;
  if (isCrossBorder(payIn, payout, cfg.homeCurrency) && !crossBorderAllowed(cfg.crossBorder, deps.settlementNetwork.chainId, payIn, payout, cfg.homeCurrency, partner)) {
    return refuse('CROSS_BORDER_DISABLED', 'cross-border stays OFF until a legal opinion is recorded');
  }
  const exactSide = req.side === 'SEND_EXACT' ? inPlan : outPlan;
  const exactMinor = exactAmount(req, s, exactSide.kind === 'FIAT' ? exactSide.currency : null);
  if (typeof exactMinor !== 'bigint') return exactMinor;
  return { payIn: inPlan, payout: outPlan, exactMinor };
}

type Step<T> = { readonly kind: 'VALUE'; readonly value: T } | { readonly kind: 'STOP'; readonly result: Refused | PortResult<never, never> };

async function lockFx(fx: FxLocker, key: IdempotencyKey, req: QuoteRequest, precision: CbsPrecision): Promise<Step<FxLock>> {
  const r = await fx.lockRate(key, req);
  if (r.kind === 'AMBIGUOUS') return { kind: 'STOP', result: ambiguous(r.cause) };
  if (r.kind === 'REJECTED') return { kind: 'STOP', result: refuse(r.code, r.detail) };
  const why = checkFxLock(req, r.value, precision);
  if (why !== null) throw new QuoteIntegrityError(`FxPort: ${why}`);
  return { kind: 'VALUE', value: r.value };
}

async function quotePayout(port: PayoutQuotePort, key: IdempotencyKey, req: PayoutQuoteRequest, precision: CbsPrecision): Promise<Step<PayoutQuote>> {
  const r = await port.quotePayout(key, req);
  if (r.kind === 'AMBIGUOUS') return { kind: 'STOP', result: ambiguous(r.cause) };
  if (r.kind === 'REJECTED') return { kind: 'STOP', result: refuse(r.code, r.detail) };
  const why = checkPayoutQuote(req, r.value, precision);
  if (why !== null) throw new QuoteIntegrityError(`PayoutQuotePort: ${why}`);
  return { kind: 'VALUE', value: r.value };
}

/**
 * A SOURCE_EXACT payout quote that leaves a remainder is re-quoted once for
 * the convertible amount (source − remainder), so the partner is funded with
 * exactly what it converts; the remainder is set aside as dust. A second
 * remainder is a partner that cannot quote exactly: refused (NO_ROUTE).
 */
async function payoutForSource(port: PayoutQuotePort, requestId: string, base: Pick<PayoutQuoteRequest, 'source' | 'currency'>, usdc: CbsMinor, precision: CbsPrecision): Promise<Step<{ readonly quote: PayoutQuote; readonly dust: CbsMinor }>> {
  const first = await quotePayout(port, quoteCallKey(requestId, 'payout-1'), { ...base, side: 'SOURCE_EXACT', amount: usdc }, precision);
  if (first.kind === 'STOP') return first;
  const dust = first.value.remainder;
  if (dust === 0n) return { kind: 'VALUE', value: { quote: first.value, dust } };
  const second = await quotePayout(port, quoteCallKey(requestId, 'payout-2'), { ...base, side: 'SOURCE_EXACT', amount: subtractCbsMinor(usdc, dust) }, precision);
  if (second.kind === 'STOP') return second;
  if (second.value.remainder !== 0n) return { kind: 'STOP', result: refuse('NO_ROUTE', 'partner cannot quote an exact source amount') };
  return { kind: 'VALUE', value: { quote: second.value, dust } };
}

function fxRequest(currency: FiatCode, s: SettlementAsset, side: QuoteRequest['side'], amount: CbsMinor): QuoteRequest {
  return { from: ledgerAssetCode(currency), to: s.ledgerCode, amount, side };
}

function convertLine(lock: FxLock, currency: FiatCode): ConvertInLine {
  const q = lock.quote;
  return {
    leg: 'CONVERT_IN',
    fxQuoteId: q.quoteId,
    provider: q.provider,
    rate: q.rate,
    from: fiatFromLedger(currency, q.from.amount),
    to: q.to.amount,
    remainder: fiatFromLedger(currency, q.remainder),
    expiresAtMs: lock.expiresAtMs,
  };
}

function payoutLine(q: PayoutQuote, partnerKind: PartnerKind): PayoutLine {
  return {
    leg: 'PAYOUT',
    payoutQuoteId: q.payoutQuoteId,
    partnerKind,
    rate: q.rate,
    source: q.source,
    gross: fiatFromLedger(q.currency, q.gross),
    fee: fiatFromLedger(q.currency, q.fee),
    net: fiatFromLedger(q.currency, q.net),
    expiresAtMs: q.expiresAtMs,
  };
}

/** A side's amount as journey money: fiat in that side's currency, or the settlement stablecoin. */
function money(side: PayInPlan | PayoutPlan, minor: CbsMinor, s: SettlementAsset): JourneyMoney {
  return side.kind === 'FIAT' ? { kind: 'FIAT', fiat: fiatFromLedger(side.currency, minor) } : { kind: 'STABLECOIN', asset: s.asset, minor };
}

function moneyMinor(m: JourneyMoney): bigint {
  return m.kind === 'FIAT' ? m.fiat.minor : m.minor;
}

interface Composed {
  readonly payerMinor: CbsMinor;
  readonly recipientMinor: CbsMinor;
  readonly arcAmount: CbsMinor;
  readonly convertIn: ConvertInLine | null;
  readonly payoutLine: PayoutLine | null;
  readonly payoutDust: CbsMinor;
}

/** SEND_EXACT: payer debit fixed; work forward. */
async function composeSend(req: JourneyQuoteRequest, plan: Plan, s: SettlementAsset, feeMinor: CbsMinor): Promise<Step<Composed>> {
  let convertIn: ConvertInLine | null = null;
  let usdcIn = plan.exactMinor;
  if (plan.payIn.kind === 'FIAT') {
    const fx = await lockFx(plan.payIn.port, quoteCallKey(req.requestId, 'fx'), fxRequest(plan.payIn.currency, s, 'FROM_EXACT', plan.exactMinor), s.precision);
    if (fx.kind === 'STOP') return fx;
    convertIn = convertLine(fx.value, plan.payIn.currency);
    usdcIn = convertIn.to;
  }
  if (usdcIn <= feeMinor) return { kind: 'STOP', result: refuse('AMOUNT_TOO_SMALL', 'the amount does not cover the customer fee') };
  const afterFee = subtractCbsMinor(usdcIn, feeMinor);
  if (plan.payout.kind === 'FIAT') {
    const po = await payoutForSource(plan.payout.port, req.requestId, { source: s.ledgerCode, currency: plan.payout.currency }, afterFee, s.precision);
    if (po.kind === 'STOP') return po;
    const pq = po.value.quote;
    return { kind: 'VALUE', value: { payerMinor: plan.exactMinor, recipientMinor: pq.net, arcAmount: pq.source, convertIn, payoutLine: payoutLine(pq, plan.payout.partner), payoutDust: po.value.dust } };
  }
  return { kind: 'VALUE', value: { payerMinor: plan.exactMinor, recipientMinor: afterFee, arcAmount: afterFee, convertIn, payoutLine: null, payoutDust: ZERO_MINOR } };
}

/** RECEIVE_EXACT: receiver amount fixed; work backward. */
async function composeReceive(req: JourneyQuoteRequest, plan: Plan, s: SettlementAsset, feeMinor: CbsMinor): Promise<Step<Composed>> {
  let payout: PayoutLine | null = null;
  let arcAmount = plan.exactMinor;
  if (plan.payout.kind === 'FIAT') {
    const po = await quotePayout(plan.payout.port, quoteCallKey(req.requestId, 'payout-1'), { source: s.ledgerCode, currency: plan.payout.currency, side: 'NET_EXACT', amount: plan.exactMinor }, s.precision);
    if (po.kind === 'STOP') return po;
    payout = payoutLine(po.value, plan.payout.partner);
    arcAmount = payout.source;
  }
  const usdcNeeded = addCbsMinor(arcAmount, feeMinor);
  let convertIn: ConvertInLine | null = null;
  let payerMinor = usdcNeeded;
  if (plan.payIn.kind === 'FIAT') {
    const fx = await lockFx(plan.payIn.port, quoteCallKey(req.requestId, 'fx'), fxRequest(plan.payIn.currency, s, 'TO_EXACT', usdcNeeded), s.precision);
    if (fx.kind === 'STOP') return fx;
    convertIn = convertLine(fx.value, plan.payIn.currency);
    payerMinor = fx.value.quote.from.amount;
  }
  return { kind: 'VALUE', value: { payerMinor, recipientMinor: plan.exactMinor, arcAmount, convertIn, payoutLine: payout, payoutDust: ZERO_MINOR } };
}

const ZERO_MINOR: CbsMinor = cbsMinor(0n);
const ZERO_WEI: NativeWei = nativeWei(0n);

/**
 * Composes the all-in quote for one request. Returns OK with a checked
 * quote, REJECTED with a refusal (no lock is used; any lock taken simply
 * expires), or AMBIGUOUS when a port's outcome is unknown: retry with the
 * SAME request id, which replays the same keyed port calls (exactly once).
 * Throws `QuoteIntegrityError` when a port answer or the composed quote fails
 * its exact check (fail closed: QUARANTINE and page).
 */
export async function composeJourneyQuote(req: JourneyQuoteRequest, cfg: QuoteConfig, deps: QuoteDeps): Promise<PortResult<JourneyQuote, QuoteRefusal>> {
  const plan = planRequest(req, cfg, deps);
  if ('kind' in plan) return plan;
  const s = cfg.settlement;
  const createdAtMs = deps.clock.nowMs();

  // Network fee allowance, split by U1 into whole minor units and dust.
  const gasAllowanceWei = deps.networkFeeAllowanceWei(s.network);
  const split = nativeWeiToCbsMinor(gasAllowanceWei, s.precision);
  const charged = cfg.gasCharging === 'CHARGED_TO_PAYER';
  const gasChargeMinor = charged ? split.minor : ZERO_MINOR;
  const gasDustWei = charged ? split.dustWei : ZERO_WEI;
  const customerFee: CustomerFee = { platformMinor: cfg.platformFeeMinor, gasMinor: gasChargeMinor, totalMinor: addCbsMinor(cfg.platformFeeMinor, gasChargeMinor) };

  let step: Step<Composed>;
  if (req.side === 'SEND_EXACT') step = await composeSend(req, plan, s, customerFee.totalMinor);
  else step = await composeReceive(req, plan, s, customerFee.totalMinor);
  if (step.kind === 'STOP') return step.result;
  const { convertIn, payoutLine: payout, arcAmount, payoutDust } = step.value;

  const expiresAtMs = minBig(minBig(createdAtMs + cfg.ttlMs, convertIn?.expiresAtMs ?? null), payout?.expiresAtMs ?? null);
  if (expiresAtMs <= deps.clock.nowMs()) return refuse('RATE_LOCK_EXPIRED', 'a rate lock expired before the quote was composed');

  const payoutDustRecords: readonly DustRecord[] = payoutDust > 0n ? [{ source: 'PAYOUT_REMAINDER', usdcMinor: payoutDust, suspense: 'GL-4 arc.quoteDust' }] : [];
  const dust = dustRecords(convertIn, gasDustWei, payoutDustRecords);

  const payer = money(plan.payIn, step.value.payerMinor, s);
  const recipient = money(plan.payout, step.value.recipientMinor, s);
  // Cross-border reaches here only under the testnet demo mode (planRequest refuses it otherwise).
  const crossBorder = isCrossBorder(req.payIn, req.payout, cfg.homeCurrency);
  const body: Omit<JourneyQuote, 'quoteId'> = {
    requestId: req.requestId,
    side: req.side,
    payIn: req.payIn,
    payout: req.payout,
    legs: journeyLegs(req.payIn, req.payout),
    payer,
    recipient,
    allInRate: { numerator: moneyMinor(recipient), denominator: moneyMinor(payer) },
    customerFee,
    convertIn,
    arcTransfer: {
      leg: 'ARC_TRANSFER',
      network: s.network,
      asset: s.asset,
      destination: plan.payout.kind === 'FIAT' ? 'PARTNER_SETTLEMENT' : 'RECEIVER_WALLET',
      amount: arcAmount,
      amountWei: cbsMinorToNativeWei(arcAmount, s.precision),
      gasAllowanceWei,
      gasChargeMinor,
      gasDustWei,
    },
    payoutLine: payout,
    dust,
    crossBorder,
    demoOnly: crossBorder,
    createdAtMs,
    expiresAtMs,
  };
  const quote: JourneyQuote = Object.freeze({ quoteId: quoteDigest(body), ...body });
  const why = checkConservation(quote, s);
  if (why !== null) throw new QuoteIntegrityError(why);
  return ok(quote, false);
}
