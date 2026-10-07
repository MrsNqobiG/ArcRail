/**
 * Test support for JQUOTE (not a money-path module; nothing in src imports it
 * at run time except tests): a manual clock, and two structurally different
 * in-memory fakes per quote port. Integer only; every amount comes from the
 * shared exact lot rule `exactConvert` (src/nova-ports/fakes/conversion-fakes.ts),
 * which uses U1's checked add and subtract only, so no raw arithmetic is
 * re-branded here.
 *
 * FxPort (stands in for Nova's FX/OTC engine, reached in production through
 * `fxPortFromConversion` over Nova's ConversionPort):
 * - LotTableFx: one lot per pair, Maps, request limit.
 * - BandedFx: lot by amount band, arrays scanned on every call.
 * PayoutQuotePort (stands in for the off-ramp partner; LABELLED TEST_FAKE,
 * never LIVE):
 * - LotTablePayoutQuotes: one lot and one fee per currency, Maps.
 * - BandedPayoutQuotes: lot and fee by amount band, arrays scanned per call.
 *
 * All four are idempotent on the key (same request replays, another request
 * is KEY_CONFLICT), expire locks on the injected clock, and can inject
 * AMBIGUOUS through a FaultPlan. They pass the same contract tests
 * (test/unit/jquote-fakes.test.ts).
 */
import { addCbsMinor, cbsMinor, subtractCbsMinor } from '../../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../../amounts/index.js';
import type { Quote, QuoteRequest } from '../../nova-ports/conversion.js';
import { exactConvert, lotRate } from '../../nova-ports/fakes/conversion-fakes.js';
import type { Lot } from '../../nova-ports/fakes/conversion-fakes.js';
import type { RatioQuote } from '../../nova-ports/conversion.js';
import { afterCommit, faultBefore } from '../../nova-ports/fakes/faults.js';
import type { FaultPlan } from '../../nova-ports/fakes/faults.js';
import { ok, rejected } from '../../nova-ports/ids.js';
import type { FiatCode, IdempotencyKey, LedgerAssetCode, PortResult } from '../../nova-ports/ids.js';
import type { Clock, FxLock, FxPort, FxRejectCode, PayoutQuote, PayoutQuotePort, PayoutQuoteRejectCode, PayoutQuoteRequest } from './ports.js';

/** A clock the test moves by hand. */
export class ManualClock implements Clock {
  #now: bigint;

  constructor(startMs: bigint) {
    this.#now = startMs;
  }

  nowMs(): bigint {
    return this.#now;
  }

  advance(ms: bigint): void {
    this.#now += ms;
  }
}

// ---------------------------------------------------------------------------
// FxPort fakes.
// ---------------------------------------------------------------------------

/** Field names `fromPrec`/`toPrec` (not `…Precision`): the MC-01 Semgrep layer flags any `.toPrecision` member (verifier JQUOTE-R1 m3). */
export interface FxPair {
  readonly from: LedgerAssetCode;
  readonly fromPrec: CbsPrecision;
  readonly to: LedgerAssetCode;
  readonly toPrec: CbsPrecision;
}

/**
 * An honest engine's rate for a conversion: the lot rate while the remainder is
 * worth less than one target minor unit; otherwise the EFFECTIVE rate
 * (to / from) with remainder 0, so no value is hidden as dust (verifier
 * JQUOTE-R2 B1; `remainderBelowOneUnit` in ports.ts is what the composer checks).
 */
function honestRate(lot: Lot, c: { readonly from: CbsMinor; readonly to: CbsMinor; readonly remainder: CbsMinor }): { readonly rate: RatioQuote; readonly remainder: CbsMinor } {
  if (c.remainder * lot.to < lot.from) return { rate: lotRate(lot), remainder: c.remainder };
  return { rate: { numerator: c.to, denominator: c.from }, remainder: cbsMinor(0n) };
}

function fxCanonical(req: QuoteRequest): string {
  return JSON.stringify([req.from, req.to, req.amount.toString(), req.side]);
}

function fxLock(id: string, pair: FxPair, lot: Lot, req: QuoteRequest, expiresAtMs: bigint, provider: string): FxLock | null {
  const c = exactConvert(req.amount, lot, req.side);
  if (c === null) return null;
  const h = honestRate(lot, c);
  const quote: Quote = {
    quoteId: id,
    from: { asset: pair.from, amount: c.from, precision: pair.fromPrec },
    to: { asset: pair.to, amount: c.to, precision: pair.toPrec },
    rate: h.rate,
    remainder: h.remainder,
    expiresAt: `ms:${expiresAtMs}`,
    provider,
  };
  return { quote, expiresAtMs };
}

export interface LotTableFxConfig {
  readonly clock: Clock;
  readonly pairs: readonly (FxPair & { readonly lot: Lot })[];
  readonly ttlMs: bigint;
  /** Largest request amount (LIMIT above it). */
  readonly limit: CbsMinor;
  readonly faults?: FaultPlan;
}

/** FxPort fake A: one lot per pair; Maps. */
export class LotTableFx implements FxPort {
  readonly #cfg: LotTableFxConfig;
  readonly #byKey = new Map<string, { readonly canonical: string; readonly lock: FxLock }>();
  #seq = 0n;

  constructor(cfg: LotTableFxConfig) {
    this.#cfg = cfg;
  }

  async lockRate(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<FxLock, FxRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'lockRate');
    if (before !== null) return before;
    const prior = this.#byKey.get(key);
    if (prior !== undefined) return prior.canonical === fxCanonical(req) ? ok(prior.lock, true) : rejected('KEY_CONFLICT', `key ${key} reused with another request`);
    const pair = this.#cfg.pairs.find((p) => p.from === req.from && p.to === req.to);
    if (pair === undefined) return rejected('NO_ROUTE', `${req.from}->${req.to}`);
    if (req.amount > this.#cfg.limit) return rejected('LIMIT', `${req.amount} > ${this.#cfg.limit}`);
    this.#seq += 1n;
    const lock = fxLock(`fx-${this.#seq}`, pair, pair.lot, req, this.#cfg.clock.nowMs() + this.#cfg.ttlMs, 'lot-table');
    if (lock === null) return rejected('NO_ROUTE', 'amount does not convert exactly');
    this.#byKey.set(key, { canonical: fxCanonical(req), lock });
    return afterCommit(this.#cfg.faults, 'lockRate', ok(lock, false));
  }
}

export interface FxBand {
  /** Inclusive upper bound of the request amount this band prices. */
  readonly upTo: CbsMinor;
  readonly lot: Lot;
}

export interface BandedFxConfig {
  readonly clock: Clock;
  readonly pairs: readonly (FxPair & { readonly bands: readonly FxBand[] })[];
  readonly ttlMs: bigint;
  readonly faults?: FaultPlan;
}

/** FxPort fake B: lot by amount band; arrays scanned on every call. */
export class BandedFx implements FxPort {
  readonly #cfg: BandedFxConfig;
  #rows: readonly { readonly key: string; readonly canonical: string; readonly lock: FxLock }[] = [];

  constructor(cfg: BandedFxConfig) {
    this.#cfg = cfg;
  }

  async lockRate(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<FxLock, FxRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'lockRate');
    if (before !== null) return before;
    const prior = this.#rows.find((r) => r.key === key);
    if (prior !== undefined) return prior.canonical === fxCanonical(req) ? ok(prior.lock, true) : rejected('KEY_CONFLICT', `key ${key} reused with another request`);
    const pair = this.#cfg.pairs.find((p) => p.from === req.from && p.to === req.to);
    if (pair === undefined) return rejected('NO_ROUTE', `${req.from}->${req.to}`);
    const band = pair.bands.find((b) => req.amount <= b.upTo);
    if (band === undefined) return rejected('LIMIT', `${req.amount} above every band`);
    const lock = fxLock(`bfx-${key}`, pair, band.lot, req, this.#cfg.clock.nowMs() + this.#cfg.ttlMs, 'banded');
    if (lock === null) return rejected('NO_ROUTE', 'amount does not convert exactly');
    this.#rows = [...this.#rows, { key, canonical: fxCanonical(req), lock }];
    return afterCommit(this.#cfg.faults, 'lockRate', ok(lock, false));
  }
}

// ---------------------------------------------------------------------------
// PayoutQuotePort fakes (TEST_FAKE: never a real partner).
// ---------------------------------------------------------------------------

/** A lot converts USDC minor units (`from`) into payout-currency minor units (`to`). The fee is in the payout currency. */
export interface PayoutPrice {
  readonly lot: Lot;
  readonly fee: CbsMinor;
}

function payoutCanonical(req: PayoutQuoteRequest): string {
  return JSON.stringify([req.source, req.currency, req.side, req.amount.toString()]);
}

/** The exact partner arithmetic shared by both fakes. */
function payoutQuote(id: string, req: PayoutQuoteRequest, price: PayoutPrice, sourcePrecision: CbsPrecision, expiresAtMs: bigint): PortResult<PayoutQuote, PayoutQuoteRejectCode> {
  let source: CbsMinor;
  let remainder: CbsMinor;
  let gross: CbsMinor;
  let rate = lotRate(price.lot);
  if (req.side === 'SOURCE_EXACT') {
    const c = exactConvert(req.amount, price.lot, 'FROM_EXACT');
    if (c === null || c.to <= price.fee) return rejected('BELOW_MINIMUM', `${req.amount} does not cover the fee`);
    const h = honestRate(price.lot, c);
    source = c.from;
    remainder = h.remainder;
    rate = h.rate;
    gross = c.to;
  } else {
    const c = exactConvert(addCbsMinor(req.amount, price.fee), price.lot, 'TO_EXACT');
    if (c === null) return rejected('NO_ROUTE', 'net plus fee does not convert exactly');
    source = c.from;
    remainder = c.remainder;
    gross = c.to;
  }
  const net = req.side === 'SOURCE_EXACT' ? subtractCbsMinor(gross, price.fee) : req.amount;
  return ok({ payoutQuoteId: id, sourceAsset: req.source, currency: req.currency, source, sourcePrecision, rate, remainder, gross, fee: price.fee, net, expiresAtMs }, false);
}

export interface LotTablePayoutConfig {
  readonly clock: Clock;
  readonly source: LedgerAssetCode;
  readonly sourcePrecision: CbsPrecision;
  readonly prices: ReadonlyMap<FiatCode, PayoutPrice>;
  readonly ttlMs: bigint;
  readonly limit: CbsMinor;
  readonly faults?: FaultPlan;
}

/** PayoutQuotePort fake A: one price per currency; Maps. */
export class LotTablePayoutQuotes implements PayoutQuotePort {
  readonly partnerKind = 'TEST_FAKE';
  readonly #cfg: LotTablePayoutConfig;
  readonly #byKey = new Map<string, { readonly canonical: string; readonly quote: PayoutQuote }>();
  #seq = 0n;

  constructor(cfg: LotTablePayoutConfig) {
    this.#cfg = cfg;
  }

  async quotePayout(key: IdempotencyKey, req: PayoutQuoteRequest): Promise<PortResult<PayoutQuote, PayoutQuoteRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'quotePayout');
    if (before !== null) return before;
    const prior = this.#byKey.get(key);
    if (prior !== undefined) return prior.canonical === payoutCanonical(req) ? ok(prior.quote, true) : rejected('KEY_CONFLICT', `key ${key} reused with another request`);
    const price = req.source === this.#cfg.source ? this.#cfg.prices.get(req.currency) : undefined;
    if (price === undefined) return rejected('NO_ROUTE', `${req.source}->${req.currency}`);
    if (req.amount > this.#cfg.limit) return rejected('LIMIT', `${req.amount} > ${this.#cfg.limit}`);
    this.#seq += 1n;
    const r = payoutQuote(`po-${this.#seq}`, req, price, this.#cfg.sourcePrecision, this.#cfg.clock.nowMs() + this.#cfg.ttlMs);
    if (r.kind !== 'OK') return r;
    this.#byKey.set(key, { canonical: payoutCanonical(req), quote: r.value });
    return afterCommit(this.#cfg.faults, 'quotePayout', r);
  }
}

export interface PayoutBand {
  readonly currency: FiatCode;
  /** Inclusive upper bound of the request amount this band prices. */
  readonly upTo: CbsMinor;
  readonly price: PayoutPrice;
}

export interface BandedPayoutConfig {
  readonly clock: Clock;
  readonly source: LedgerAssetCode;
  readonly sourcePrecision: CbsPrecision;
  readonly bands: readonly PayoutBand[];
  readonly ttlMs: bigint;
  readonly faults?: FaultPlan;
}

/** PayoutQuotePort fake B: price by currency and amount band; arrays scanned per call. */
export class BandedPayoutQuotes implements PayoutQuotePort {
  readonly partnerKind = 'TEST_FAKE';
  readonly #cfg: BandedPayoutConfig;
  #rows: readonly { readonly key: string; readonly canonical: string; readonly quote: PayoutQuote }[] = [];

  constructor(cfg: BandedPayoutConfig) {
    this.#cfg = cfg;
  }

  async quotePayout(key: IdempotencyKey, req: PayoutQuoteRequest): Promise<PortResult<PayoutQuote, PayoutQuoteRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'quotePayout');
    if (before !== null) return before;
    const prior = this.#rows.find((r) => r.key === key);
    if (prior !== undefined) return prior.canonical === payoutCanonical(req) ? ok(prior.quote, true) : rejected('KEY_CONFLICT', `key ${key} reused with another request`);
    if (req.source !== this.#cfg.source || !this.#cfg.bands.some((b) => b.currency === req.currency)) return rejected('NO_ROUTE', `${req.source}->${req.currency}`);
    const band = this.#cfg.bands.find((b) => b.currency === req.currency && req.amount <= b.upTo);
    if (band === undefined) return rejected('LIMIT', `${req.amount} above every band`);
    const r = payoutQuote(`bpo-${key}`, req, band.price, this.#cfg.sourcePrecision, this.#cfg.clock.nowMs() + this.#cfg.ttlMs);
    if (r.kind !== 'OK') return r;
    this.#rows = [...this.#rows, { key, canonical: payoutCanonical(req), quote: r.value }];
    return afterCommit(this.#cfg.faults, 'quotePayout', r);
  }
}
