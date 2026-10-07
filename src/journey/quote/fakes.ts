/**
 * Test support for JQUOTE (not a money-path module; nothing in src imports it
 * at run time except tests): a manual clock, and two structurally different
 * in-memory fakes per quote port. Integer only; every amount comes from the
 * shared exact lot rule `exactConvert` (src/nova-ports/fakes/conversion-fakes.ts),
 * which uses U1's checked add and subtract only, so no raw arithmetic is
 * re-branded here.
 *
 * FxLocker doubles (what the composer consumes; in production the locker is
 * the fill desk, fill.ts, over Nova's FxPort):
 * - LotTableFx: one lot per pair, Maps, request limit.
 * - BandedFx: lot by amount band, arrays scanned on every call.
 * FxPort fakes (stand in for Nova's pricing codes and manual fills, design
 * delta 1 D-1 "Ports and fakes"; both price by the same honest lot rule):
 * - QueuedFillFx (fake A, event-queue model): codes in Maps; a test emits
 *   fill events into a queue and releases them with `deliver`, so an event
 *   can be delayed or never arrive. Its booked entries live in a separate
 *   `MapBookedEntries` read-back the test fills.
 * - LedgerBackedFx (fake B, ledger-backed model): codes and journals in
 *   arrays; `fillAtDesk` posts balanced journals into its own ledger first and
 *   derives the FILLED event from them, so the read-back is real.
 * Both sign events with HMAC-SHA256 under a throwaway key generated at
 * construction (never a real secret), or model the unanswered scheme (DQ-1).
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
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { addCbsMinor, cbsMinor, subtractCbsMinor } from '../../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../../amounts/index.js';
import type { Quote, QuoteRejectCode, QuoteRequest } from '../../nova-ports/conversion.js';
import type { LedgerAccount, LedgerLeg } from '../../nova-ports/ledger.js';
import { exactConvert, lotRate } from '../../nova-ports/fakes/conversion-fakes.js';
import type { Lot } from '../../nova-ports/fakes/conversion-fakes.js';
import type { RatioQuote } from '../../nova-ports/conversion.js';
import { afterCommit, faultBefore } from '../../nova-ports/fakes/faults.js';
import type { FaultPlan } from '../../nova-ports/fakes/faults.js';
import { ok, rejected } from '../../nova-ports/ids.js';
import type { FiatCode, IdempotencyKey, LedgerAssetCode, PortResult } from '../../nova-ports/ids.js';
import type {
  BookedEntry,
  BookedJournal,
  Clock,
  ExpiryReader,
  FillAuthCode,
  FillEvent,
  FilledEvent,
  FxLock,
  FxLocker,
  FxPort,
  FxRejectCode,
  LedgerReadBackPort,
  PayoutQuote,
  PayoutQuotePort,
  PayoutQuoteRejectCode,
  PayoutQuoteRequest,
  PricingCode,
  RawFillEvent,
} from './ports.js';

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
// FxLocker doubles.
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

/** FxLocker double A: one lot per pair; Maps. */
export class LotTableFx implements FxLocker {
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

/** FxLocker double B: lot by amount band; arrays scanned on every call. */
export class BandedFx implements FxLocker {
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

// ---------------------------------------------------------------------------
// FxPort fakes (design delta 1 D-1): pricing codes, manual fills, signed events.
// ---------------------------------------------------------------------------

/** Header the fakes put their HMAC in. A fake name: Nova's real scheme is open question DQ-1. */
export const FAKE_FILL_SIGNATURE_HEADER = 'x-fake-fill-signature';

/** Reads the fakes' expiry text `ms:<epoch ms>`; null otherwise. */
export const msExpiryReader: ExpiryReader = (s) => (/^ms:\d{1,20}$/.test(s) ? BigInt(s.slice(3)) : null);

/** HMAC-SHA256 under a throwaway key generated at construction; never a real secret. */
class FakeFillSigner {
  readonly #key = randomBytes(32);

  sign(body: string): string {
    return createHmac('sha256', this.#key).update(body).digest('hex');
  }

  valid(body: string, headers: Readonly<Record<string, string>>): boolean {
    const got = headers[FAKE_FILL_SIGNATURE_HEADER];
    if (typeof got !== 'string' || !/^[0-9a-f]{64}$/.test(got)) return false;
    return timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(this.sign(body), 'hex'));
  }
}

/** Fake wire format: amounts as decimal strings (never JSON numbers). */
export function encodeFillEvent(e: FillEvent): string {
  if (e.kind !== 'FILLED') return JSON.stringify({ kind: e.kind, codeId: e.codeId });
  return JSON.stringify({
    kind: e.kind,
    codeId: e.codeId,
    from: e.from,
    to: e.to,
    fromAmount: e.fromAmount.toString(),
    toAmount: e.toAmount.toString(),
    rateNumerator: e.rate.numerator.toString(),
    rateDenominator: e.rate.denominator.toString(),
    remainder: e.remainder.toString(),
    bookedEntryRef: e.bookedEntryRef,
    filledAtMs: e.filledAtMs.toString(),
    reviewer: e.reviewer,
  });
}

const DIGITS = /^\d{1,40}$/;

function decodeFillEvent(body: string): FillEvent | null {
  let v: unknown;
  try {
    v = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const str = (k: string): string | null => (typeof o[k] === 'string' ? (o[k] as string) : null);
  const int = (k: string): bigint | null => {
    const x = str(k);
    return x !== null && DIGITS.test(x) ? BigInt(x) : null;
  };
  const codeId = str('codeId');
  if (codeId === null) return null;
  if (o['kind'] === 'REJECTED' || o['kind'] === 'EXPIRED') return { kind: o['kind'], codeId };
  if (o['kind'] !== 'FILLED') return null;
  const [from, to, bookedEntryRef, reviewer] = [str('from'), str('to'), str('bookedEntryRef'), str('reviewer')];
  const [fromAmount, toAmount, num, den, remainder, filledAtMs] = [int('fromAmount'), int('toAmount'), int('rateNumerator'), int('rateDenominator'), int('remainder'), int('filledAtMs')];
  if (from === null || to === null || bookedEntryRef === null || reviewer === null) return null;
  if (fromAmount === null || toAmount === null || num === null || den === null || remainder === null || filledAtMs === null) return null;
  return {
    kind: 'FILLED',
    codeId,
    from: from as LedgerAssetCode,
    to: to as LedgerAssetCode,
    fromAmount: cbsMinor(fromAmount),
    toAmount: cbsMinor(toAmount),
    rate: { numerator: num, denominator: den },
    remainder: cbsMinor(remainder),
    bookedEntryRef,
    filledAtMs,
    reviewer,
  };
}

/** `HMAC` signs and checks every event; `UNCONFIGURED` models DQ-1 unanswered: every event is refused. */
export type FakeFillScheme = 'HMAC' | 'UNCONFIGURED';

async function verifyWith(signer: FakeFillSigner, scheme: FakeFillScheme, rawBody: string, headers: Readonly<Record<string, string>>): Promise<PortResult<FillEvent, FillAuthCode>> {
  if (scheme === 'UNCONFIGURED') return rejected('SCHEME_UNCONFIGURED', 'the fill-event signature scheme is not known yet (DQ-1)');
  if (!signer.valid(rawBody, headers)) return rejected('BAD_SIGNATURE', 'signature missing or invalid');
  const e = decodeFillEvent(rawBody);
  return e === null ? rejected('MALFORMED', 'not a fill event') : ok(e, false);
}

/** The honest code rate for a request: the lot rate, or the effective rate when the remainder would be worth a target unit (as `honestRate`). */
function codeRateFor(lot: Lot, req: QuoteRequest): RatioQuote | null {
  const c = exactConvert(req.amount, lot, req.side);
  return c === null ? null : honestRate(lot, c).rate;
}

/** The code's honest quote amounts: whole lots of the code's own rate (the same rule the package derives by). */
function codeAmounts(req: QuoteRequest, rate: RatioQuote): { readonly from: CbsMinor; readonly to: CbsMinor; readonly remainder: CbsMinor } | null {
  return exactConvert(req.amount, { from: cbsMinor(rate.denominator), to: cbsMinor(rate.numerator) }, req.side);
}

export interface FillFxConfig {
  readonly clock: Clock;
  readonly pairs: readonly (FxPair & { readonly lot: Lot })[];
  /** How long a code lives (tests use 5 minutes, DA-1; the package never assumes it). */
  readonly ttlMs: bigint;
  /** Largest request amount (LIMIT above it). */
  readonly limit: CbsMinor;
  readonly faults?: FaultPlan;
  readonly scheme?: FakeFillScheme;
}

interface CodeRecord {
  readonly key: string;
  readonly canonical: string;
  readonly req: QuoteRequest;
  readonly code: PricingCode;
}

function pricingCanonical(req: QuoteRequest): string {
  return JSON.stringify([req.from, req.to, req.amount.toString(), req.side]);
}

/** Overrides a test applies to an otherwise honest FILLED event. */
export type FillOverrides = Partial<Omit<FilledEvent, 'kind' | 'codeId'>>;

/**
 * FxPort fake A, event-queue model: codes in Maps; events are emitted into a
 * per-code queue and handed to `awaitFill` only when the test calls
 * `deliver`, so they can be delayed or never arrive.
 */
export class QueuedFillFx implements FxPort {
  readonly #cfg: FillFxConfig;
  readonly #signer = new FakeFillSigner();
  readonly #byKey = new Map<string, CodeRecord>();
  readonly #byCode = new Map<string, CodeRecord>();
  readonly #queue = new Map<string, RawFillEvent[]>();
  readonly #waiters = new Map<string, ((e: RawFillEvent) => void)[]>();
  #seq = 0n;

  constructor(cfg: FillFxConfig) {
    this.#cfg = cfg;
  }

  async getPricingCode(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<PricingCode, QuoteRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'getPricingCode');
    if (before !== null) return before;
    const prior = this.#byKey.get(key);
    if (prior !== undefined) return prior.canonical === pricingCanonical(req) ? ok(prior.code, true) : rejected('KEY_CONFLICT', `key ${key} reused with another request`);
    const pair = this.#cfg.pairs.find((p) => p.from === req.from && p.to === req.to);
    if (pair === undefined) return rejected('NO_ROUTE', `${req.from}->${req.to}`);
    if (req.amount > this.#cfg.limit) return rejected('LIMIT', `${req.amount} > ${this.#cfg.limit}`);
    const rate = codeRateFor(pair.lot, req);
    if (rate === null) return rejected('NO_ROUTE', 'amount does not convert exactly');
    this.#seq += 1n;
    const rec: CodeRecord = { key, canonical: pricingCanonical(req), req, code: { codeId: `code-${this.#seq}`, rate, expiresAt: `ms:${this.#cfg.clock.nowMs() + this.#cfg.ttlMs}` } };
    this.#byKey.set(key, rec);
    this.#byCode.set(rec.code.codeId, rec);
    return afterCommit(this.#cfg.faults, 'getPricingCode', ok(rec.code, false));
  }

  async awaitFill(codeId: string): Promise<RawFillEvent> {
    return new Promise((resolve) => {
      this.#waiters.set(codeId, [...(this.#waiters.get(codeId) ?? []), resolve]);
    });
  }

  async verifyFillEvent(rawBody: string, headers: Readonly<Record<string, string>>): Promise<PortResult<FillEvent, FillAuthCode>> {
    const before = faultBefore(this.#cfg.faults, 'verifyFillEvent');
    if (before !== null) return before;
    return verifyWith(this.#signer, this.#cfg.scheme ?? 'HMAC', rawBody, headers);
  }

  /** Number of codes written (one per distinct key). */
  get codeCount(): bigint {
    return this.#seq;
  }

  /** The honest FILLED event for a code (the code's own quote at the code's own rate), with test overrides. */
  filled(codeId: string, f: { readonly bookedEntryRef: string; readonly filledAtMs: bigint; readonly reviewer?: string } & FillOverrides): FilledEvent {
    const rec = this.#byCode.get(codeId);
    const amounts = rec === undefined ? null : codeAmounts(rec.req, rec.code.rate);
    if (rec === undefined || amounts === null) throw new Error(`no code ${codeId}`);
    return {
      kind: 'FILLED',
      codeId,
      from: rec.req.from,
      to: rec.req.to,
      fromAmount: amounts.from,
      toAmount: amounts.to,
      rate: rec.code.rate,
      remainder: amounts.remainder,
      reviewer: 'desk-reviewer-1',
      ...f,
    };
  }

  /** Signs an event without queueing it (a redelivery, or a tampered copy). */
  sign(e: FillEvent): RawFillEvent {
    const rawBody = encodeFillEvent(e);
    return { rawBody, headers: { [FAKE_FILL_SIGNATURE_HEADER]: this.#signer.sign(rawBody) } };
  }

  /** Signs and queues an event; it reaches `awaitFill` only on `deliver`. */
  emit(e: FillEvent): RawFillEvent {
    const raw = this.sign(e);
    this.#queue.set(e.codeId, [...(this.#queue.get(e.codeId) ?? []), raw]);
    return raw;
  }

  /** Hands queued events to waiting `awaitFill` calls, one each, oldest first. */
  deliver(): void {
    for (const [codeId, events] of this.#queue) {
      const waiters = this.#waiters.get(codeId) ?? [];
      while (events.length > 0 && waiters.length > 0) (waiters.shift() as (e: RawFillEvent) => void)(events.shift() as RawFillEvent);
    }
  }
}

/** Fake A's read-back and precision lookup: entries the test puts by reference (Maps). */
export class MapBookedEntries implements LedgerReadBackPort {
  readonly #entries = new Map<string, BookedEntry>();
  readonly #precisions: ReadonlyMap<string, CbsPrecision>;
  readonly #faults: FaultPlan | undefined;

  constructor(precisions: ReadonlyMap<string, CbsPrecision>, faults?: FaultPlan) {
    this.#precisions = precisions;
    this.#faults = faults;
  }

  put(entry: BookedEntry): void {
    this.#entries.set(entry.bookedEntryRef, entry);
  }

  async getBookedEntry(ref: string): Promise<PortResult<BookedEntry, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'getBookedEntry');
    if (before !== null) return before;
    const e = this.#entries.get(ref);
    return e === undefined ? rejected('NOT_FOUND', ref) : ok(e, false);
  }

  async getAssetPrecision(asset: LedgerAssetCode): Promise<PortResult<CbsPrecision, 'ASSET_UNKNOWN'>> {
    const before = faultBefore(this.#faults, 'getAssetPrecision');
    if (before !== null) return before;
    const p = this.#precisions.get(asset);
    return p === undefined ? rejected('ASSET_UNKNOWN', asset) : ok(p, false);
  }
}

/** The honest booked entry of a fill: one balanced journal per asset (fake A's tests build it; fake B posts it). */
export function honestEntry(e: FilledEvent, a: { readonly clientFrom: LedgerAccount; readonly to: LedgerAccount; readonly dust: LedgerAccount; readonly deskFrom: LedgerAccount; readonly deskTo: LedgerAccount }, clientDebit?: CbsMinor): BookedEntry {
  const debit = clientDebit ?? e.fromAmount;
  const fromLegs: LedgerLeg[] = [
    { account: a.clientFrom, side: 'DEBIT', amount: debit },
    { account: a.deskFrom, side: 'CREDIT', amount: subtractCbsMinor(debit, e.remainder) },
  ];
  if (e.remainder > 0n) fromLegs.push({ account: a.dust, side: 'CREDIT', amount: e.remainder });
  const journals: BookedJournal[] = [
    { journalId: `${e.bookedEntryRef}-from`, asset: e.from, legs: fromLegs },
    {
      journalId: `${e.bookedEntryRef}-to`,
      asset: e.to,
      legs: [
        { account: a.deskTo, side: 'DEBIT', amount: e.toAmount },
        { account: a.to, side: 'CREDIT', amount: e.toAmount },
      ],
    },
  ];
  return { bookedEntryRef: e.bookedEntryRef, journals };
}

export interface LedgerBackedFxConfig extends FillFxConfig {
  readonly precisions: readonly (readonly [LedgerAssetCode, CbsPrecision])[];
  /** Nova's own OTC desk accounts the counter-legs post to (fake names). */
  readonly deskFrom: LedgerAccount;
  readonly deskTo: LedgerAccount;
}

/** How the desk books a fill in fake B. `clientDebit` (default the from amount) lets a test over-debit the client (mutant M2). */
export interface DeskFill {
  readonly accounts: { readonly clientFrom: LedgerAccount; readonly to: LedgerAccount; readonly dust: LedgerAccount };
  readonly filledAtMs: bigint;
  readonly reviewer?: string;
  readonly clientDebit?: CbsMinor;
  /** Fields of the emitted event that differ from what was booked (a lying event). */
  readonly event?: FillOverrides;
}

/**
 * FxPort fake B, ledger-backed model: codes, journals and events in arrays
 * scanned on every call. `fillAtDesk` books the journals first and derives
 * the FILLED event from them, then pushes it to `awaitFill` at once. It is
 * its own read-back (`getBookedEntry`), so check 4 reads what was posted.
 */
export class LedgerBackedFx implements FxPort, LedgerReadBackPort {
  readonly #cfg: LedgerBackedFxConfig;
  readonly #signer = new FakeFillSigner();
  #codes: readonly CodeRecord[] = [];
  #journals: readonly (BookedJournal & { readonly entry: string })[] = [];
  #outbox: readonly { readonly codeId: string; readonly raw: RawFillEvent }[] = [];
  #waiters: readonly { readonly codeId: string; readonly resolve: (e: RawFillEvent) => void }[] = [];

  constructor(cfg: LedgerBackedFxConfig) {
    this.#cfg = cfg;
  }

  async getPricingCode(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<PricingCode, QuoteRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'getPricingCode');
    if (before !== null) return before;
    const prior = this.#codes.find((c) => c.key === key);
    if (prior !== undefined) return prior.canonical === pricingCanonical(req) ? ok(prior.code, true) : rejected('KEY_CONFLICT', `key ${key} reused with another request`);
    const pair = this.#cfg.pairs.find((p) => p.from === req.from && p.to === req.to);
    if (pair === undefined) return rejected('NO_ROUTE', `${req.from}->${req.to}`);
    if (req.amount > this.#cfg.limit) return rejected('LIMIT', `${req.amount} > ${this.#cfg.limit}`);
    const rate = codeRateFor(pair.lot, req);
    if (rate === null) return rejected('NO_ROUTE', 'amount does not convert exactly');
    const code: PricingCode = { codeId: `otc-${key.slice(-12)}`, rate, expiresAt: `ms:${this.#cfg.clock.nowMs() + this.#cfg.ttlMs}` };
    this.#codes = [...this.#codes, { key, canonical: pricingCanonical(req), req, code }];
    return afterCommit(this.#cfg.faults, 'getPricingCode', ok(code, false));
  }

  async awaitFill(codeId: string): Promise<RawFillEvent> {
    const ready = this.#outbox.find((o) => o.codeId === codeId);
    if (ready !== undefined) {
      this.#outbox = this.#outbox.filter((o) => o !== ready);
      return ready.raw;
    }
    return new Promise((resolve) => {
      this.#waiters = [...this.#waiters, { codeId, resolve }];
    });
  }

  async verifyFillEvent(rawBody: string, headers: Readonly<Record<string, string>>): Promise<PortResult<FillEvent, FillAuthCode>> {
    const before = faultBefore(this.#cfg.faults, 'verifyFillEvent');
    if (before !== null) return before;
    return verifyWith(this.#signer, this.#cfg.scheme ?? 'HMAC', rawBody, headers);
  }

  async getBookedEntry(ref: string): Promise<PortResult<BookedEntry, 'NOT_FOUND'>> {
    const before = faultBefore(this.#cfg.faults, 'getBookedEntry');
    if (before !== null) return before;
    const journals = this.#journals.filter((j) => j.entry === ref).map(({ journalId, asset, legs }) => ({ journalId, asset, legs }));
    return journals.length === 0 ? rejected('NOT_FOUND', ref) : ok({ bookedEntryRef: ref, journals }, false);
  }

  async getAssetPrecision(asset: LedgerAssetCode): Promise<PortResult<CbsPrecision, 'ASSET_UNKNOWN'>> {
    const before = faultBefore(this.#cfg.faults, 'getAssetPrecision');
    if (before !== null) return before;
    const p = this.#cfg.precisions.find(([a]) => a === asset);
    return p === undefined ? rejected('ASSET_UNKNOWN', asset) : ok(p[1], false);
  }

  /** Number of codes written (one per distinct key). */
  get codeCount(): bigint {
    let n = 0n;
    for (const _ of this.#codes) n += 1n;
    return n;
  }

  /** A human fills the code at the desk: the journals are posted first, then the FILLED event is derived and pushed. */
  fillAtDesk(codeId: string, f: DeskFill): RawFillEvent {
    const rec = this.#codes.find((c) => c.code.codeId === codeId);
    const amounts = rec === undefined ? null : codeAmounts(rec.req, rec.code.rate);
    if (rec === undefined || amounts === null) throw new Error(`no code ${codeId}`);
    const ref = `je-${codeId}`;
    const booked: FilledEvent = {
      kind: 'FILLED',
      codeId,
      from: rec.req.from,
      to: rec.req.to,
      fromAmount: amounts.from,
      toAmount: amounts.to,
      rate: rec.code.rate,
      remainder: amounts.remainder,
      bookedEntryRef: ref,
      filledAtMs: f.filledAtMs,
      reviewer: f.reviewer ?? 'desk-reviewer-1',
    };
    const entry = honestEntry(booked, { ...f.accounts, deskFrom: this.#cfg.deskFrom, deskTo: this.#cfg.deskTo }, f.clientDebit);
    this.#journals = [...this.#journals, ...entry.journals.map((j) => ({ ...j, entry: ref }))];
    return this.#push({ ...booked, ...f.event });
  }

  /** The desk rejects or the code expires: nothing is booked. */
  closeAtDesk(codeId: string, kind: 'REJECTED' | 'EXPIRED'): RawFillEvent {
    return this.#push({ kind, codeId });
  }

  /** Signs an event without pushing it (a redelivery, or a tampered copy). */
  sign(e: FillEvent): RawFillEvent {
    const rawBody = encodeFillEvent(e);
    return { rawBody, headers: { [FAKE_FILL_SIGNATURE_HEADER]: this.#signer.sign(rawBody) } };
  }

  #push(e: FillEvent): RawFillEvent {
    const raw = this.sign(e);
    const w = this.#waiters.find((x) => x.codeId === e.codeId);
    if (w === undefined) this.#outbox = [...this.#outbox, { codeId: e.codeId, raw }];
    else {
      this.#waiters = this.#waiters.filter((x) => x !== w);
      w.resolve(raw);
    }
    return raw;
  }
}
