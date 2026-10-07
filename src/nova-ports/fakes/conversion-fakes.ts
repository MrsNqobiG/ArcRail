/**
 * Test support: two structurally different in-memory ConversionPort fakes (§7.8).
 * They stand in for Nova's conversion engine; the package itself computes no
 * rate (CO-1 v3 D5). Integer only: a rate is a ratio of bigints.
 *
 * - FixedRateConversion: one fixed lot (ratio) per pair, Maps of quotes and
 *   executions, executions SETTLED at once.
 * - LadderConversion: the lot depends on the amount band; quotes, executions
 *   and states are arrays scanned on every call; executions stay PENDING until
 *   the test settles or fails them.
 *
 * Both quote by the same exact rule (exactConvert, whole lots, U1's checked
 * add and subtract only), expire quotes on a logical
 * clock (`advance`), consume a quote once, can inject AMBIGUOUS, and pass the
 * same contract tests (test/contract/ports-conversion.contract.test.ts).
 */
import { addCbsMinor, cbsMinor, subtractCbsMinor } from '../../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../../amounts/index.js';
import { ok, rejected } from '../ids.js';
import type { IdempotencyKey, LedgerAssetCode, PortResult } from '../ids.js';
import type { ConversionPort, ConversionState, Execution, ExecuteRejectCode, Quote, QuoteRejectCode, QuoteRequest, RatioQuote } from '../conversion.js';
import { afterCommit, faultBefore } from './faults.js';
import type { FaultPlan } from './faults.js';

const ZERO: CbsMinor = cbsMinor(0n);

/** A conversion lot: `from` minor units of the from-asset buy exactly `to` minor units of the to-asset. The rate is to/from. */
export interface Lot {
  readonly from: CbsMinor;
  readonly to: CbsMinor;
}

/** The lot as an exact ratio (to-asset minor units per from-asset minor unit). */
export function lotRate(lot: Lot): RatioQuote {
  return { numerator: lot.to, denominator: lot.from };
}

/**
 * The exact conversion, in whole lots, with U1's checked add and subtract only
 * (no re-brand of raw arithmetic, U1 rule). FROM_EXACT converts as many whole
 * lots of `amount` as fit and returns the rest as the remainder; TO_EXACT needs
 * a `to` amount of whole lots (else null). Null also when nothing converts.
 */
export function exactConvert(amount: CbsMinor, lot: Lot, side: QuoteRequest['side']): { readonly from: CbsMinor; readonly to: CbsMinor; readonly remainder: CbsMinor } | null {
  if (side === 'FROM_EXACT') {
    let rest = amount;
    let to = ZERO;
    while (rest >= lot.from) {
      rest = subtractCbsMinor(rest, lot.from);
      to = addCbsMinor(to, lot.to);
    }
    return to === ZERO ? null : { from: amount, to, remainder: rest };
  }
  let need = amount;
  let from = ZERO;
  while (need >= lot.to) {
    need = subtractCbsMinor(need, lot.to);
    from = addCbsMinor(from, lot.from);
  }
  return need !== ZERO || from === ZERO ? null : { from, to: amount, remainder: ZERO };
}

export interface PairConfig {
  readonly from: LedgerAssetCode;
  readonly fromPrecision: CbsPrecision;
  readonly to: LedgerAssetCode;
  readonly toPrecision: CbsPrecision;
}

interface QuoteRow {
  readonly key: IdempotencyKey;
  readonly canonical: string;
  readonly quote: Quote;
  readonly expiresAtTick: bigint;
}

interface ExecRow {
  readonly key: IdempotencyKey;
  readonly quoteId: string;
  readonly execution: Execution;
  readonly from: CbsMinor;
}

function canonicalQuote(req: QuoteRequest): string {
  return JSON.stringify([req.from, req.to, req.amount.toString(), req.side]);
}

function buildQuote(id: string, pair: PairConfig, rate: RatioQuote, c: NonNullable<ReturnType<typeof exactConvert>>, expires: bigint, provider: string): Quote {
  return {
    quoteId: id,
    from: { asset: pair.from, amount: c.from, precision: pair.fromPrecision },
    to: { asset: pair.to, amount: c.to, precision: pair.toPrecision },
    rate,
    remainder: c.remainder,
    expiresAt: `tick:${expires}`,
    provider,
  };
}

/** The common execute decision: replay or key conflict, live unused quote, funds. GO: execute this quote. */
function decideExecute(
  key: IdempotencyKey,
  quoteId: string,
  byKey: ExecRow | null,
  quote: QuoteRow | null,
  used: boolean,
  now: bigint,
  spent: CbsMinor,
  available: CbsMinor | null,
): PortResult<Execution, ExecuteRejectCode> | { readonly kind: 'GO'; readonly quote: Quote } {
  if (byKey !== null) return byKey.quoteId === quoteId ? ok(byKey.execution, true) : rejected('KEY_CONFLICT', `key ${key} reused with another quote`);
  if (quote === null || used || now > quote.expiresAtTick) return rejected('QUOTE_EXPIRED', `quote ${quoteId} is not live`);
  if (available !== null && addCbsMinor(spent, quote.quote.from.amount) > available) {
    return rejected('INSUFFICIENT_FUNDS', `${quote.quote.from.amount} > ${subtractCbsMinor(available, spent)}`);
  }
  return { kind: 'GO', quote: quote.quote };
}

export interface FixedRateConfig {
  readonly pairs: readonly (PairConfig & { readonly lot: Lot })[];
  readonly ttlTicks: bigint;
  /** Largest `amount` a quote accepts (LIMIT above it). */
  readonly limit: CbsMinor;
  /** From-asset budget across executions; INSUFFICIENT_FUNDS beyond it. Null: unlimited. */
  readonly available: CbsMinor | null;
  readonly faults?: FaultPlan;
}

/** Fake A: one fixed ratio per pair; Maps; SETTLED at once. */
export class FixedRateConversion implements ConversionPort {
  readonly #cfg: FixedRateConfig;
  readonly #quotes = new Map<string, QuoteRow>();
  readonly #quoteByKey = new Map<string, QuoteRow>();
  readonly #execByKey = new Map<string, ExecRow>();
  readonly #used = new Set<string>();
  readonly #states = new Map<string, ConversionState>();
  #spent: CbsMinor = ZERO;
  #now = 0n;
  #seq = 0n;

  constructor(cfg: FixedRateConfig) {
    this.#cfg = cfg;
  }

  advance(ticks: bigint): void {
    this.#now += ticks;
  }

  async quote(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<Quote, QuoteRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'quote');
    if (before !== null) return before;
    const prior = this.#quoteByKey.get(key);
    if (prior !== undefined) return prior.canonical === canonicalQuote(req) ? ok(prior.quote, true) : rejected('KEY_CONFLICT', `key ${key} reused with another request`);
    const pair = this.#cfg.pairs.find((x) => x.from === req.from && x.to === req.to);
    if (pair === undefined) return rejected('NO_ROUTE', `${req.from}->${req.to}`);
    if (req.amount > this.#cfg.limit) return rejected('LIMIT', `${req.amount} > ${this.#cfg.limit}`);
    const c = exactConvert(req.amount, pair.lot, req.side);
    if (c === null) return rejected('NO_ROUTE', 'amount does not convert exactly');
    this.#seq += 1n;
    const row: QuoteRow = { key, canonical: canonicalQuote(req), quote: buildQuote(`fq-${this.#seq}`, pair, lotRate(pair.lot), c, this.#now + this.#cfg.ttlTicks, 'fixed'), expiresAtTick: this.#now + this.#cfg.ttlTicks };
    this.#quotes.set(row.quote.quoteId, row);
    this.#quoteByKey.set(key, row);
    return afterCommit(this.#cfg.faults, 'quote', ok(row.quote, false));
  }

  async execute(key: IdempotencyKey, quoteId: string): Promise<PortResult<Execution, ExecuteRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'execute');
    if (before !== null) return before;
    const v = decideExecute(key, quoteId, this.#execByKey.get(key) ?? null, this.#quotes.get(quoteId) ?? null, this.#used.has(quoteId), this.#now, this.#spent, this.#cfg.available);
    if (v.kind !== 'GO') return v;
    const quote = v.quote;
    this.#seq += 1n;
    const execution: Execution = { conversionId: `fc-${this.#seq}`, journalIds: [`fx-${this.#seq}-from`, `fx-${this.#seq}-to`], state: 'SETTLED' };
    this.#used.add(quoteId);
    this.#spent = addCbsMinor(this.#spent, quote.from.amount);
    this.#execByKey.set(key, { key, quoteId, execution, from: quote.from.amount });
    this.#states.set(execution.conversionId, 'SETTLED');
    return afterCommit(this.#cfg.faults, 'execute', ok(execution, false));
  }

  async get(conversionId: string): Promise<PortResult<{ readonly state: ConversionState }, 'NOT_FOUND'>> {
    const before = faultBefore(this.#cfg.faults, 'get');
    if (before !== null) return before;
    const state = this.#states.get(conversionId);
    return state === undefined ? rejected('NOT_FOUND', conversionId) : ok({ state }, false);
  }
}

export interface LadderBand {
  /** Inclusive upper bound of the `amount` this band prices. */
  readonly upTo: CbsMinor;
  readonly lot: Lot;
}

export interface LadderConfig {
  readonly pairs: readonly (PairConfig & { readonly bands: readonly LadderBand[] })[];
  readonly ttlTicks: bigint;
  readonly available: CbsMinor | null;
  readonly faults?: FaultPlan;
}

/** Fake B: amount bands; arrays scanned on every call; PENDING until settled or failed by the test. */
export class LadderConversion implements ConversionPort {
  readonly #cfg: LadderConfig;
  #quotes: readonly QuoteRow[] = [];
  #execs: readonly ExecRow[] = [];
  #states: readonly { readonly id: string; readonly state: ConversionState }[] = [];
  #now = 0n;

  constructor(cfg: LadderConfig) {
    this.#cfg = cfg;
  }

  advance(ticks: bigint): void {
    this.#now += ticks;
  }

  /** Test hook: the engine finishes a PENDING conversion. */
  settle(conversionId: string, state: 'SETTLED' | 'FAILED'): void {
    this.#states = [...this.#states, { id: conversionId, state }];
  }

  async quote(key: IdempotencyKey, req: QuoteRequest): Promise<PortResult<Quote, QuoteRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'quote');
    if (before !== null) return before;
    const prior = this.#quotes.find((r) => r.key === key);
    if (prior !== undefined) return prior.canonical === canonicalQuote(req) ? ok(prior.quote, true) : rejected('KEY_CONFLICT', `key ${key} reused with another request`);
    const pair = this.#cfg.pairs.find((x) => x.from === req.from && x.to === req.to);
    if (pair === undefined) return rejected('NO_ROUTE', `${req.from}->${req.to}`);
    const band = pair.bands.find((b) => req.amount <= b.upTo);
    if (band === undefined) return rejected('LIMIT', `${req.amount} above every band`);
    const c = exactConvert(req.amount, band.lot, req.side);
    if (c === null) return rejected('NO_ROUTE', 'amount does not convert exactly');
    const expires = this.#now + this.#cfg.ttlTicks;
    const row: QuoteRow = { key, canonical: canonicalQuote(req), quote: buildQuote(`lq-${key}`, pair, lotRate(band.lot), c, expires, 'ladder'), expiresAtTick: expires };
    this.#quotes = [...this.#quotes, row];
    return afterCommit(this.#cfg.faults, 'quote', ok(row.quote, false));
  }

  async execute(key: IdempotencyKey, quoteId: string): Promise<PortResult<Execution, ExecuteRejectCode>> {
    const before = faultBefore(this.#cfg.faults, 'execute');
    if (before !== null) return before;
    const q = this.#quotes.find((r) => r.quote.quoteId === quoteId) ?? null;
    let spent = ZERO;
    for (const e of this.#execs) spent = addCbsMinor(spent, e.from);
    const used = this.#execs.some((e) => e.quoteId === quoteId);
    const v = decideExecute(key, quoteId, this.#execs.find((e) => e.key === key) ?? null, q, used, this.#now, spent, this.#cfg.available);
    if (v.kind !== 'GO') return v;
    const quote = v.quote;
    const execution: Execution = { conversionId: `lc-${key}`, journalIds: [`lx-${key}`], state: 'PENDING' };
    this.#execs = [...this.#execs, { key, quoteId, execution, from: quote.from.amount }];
    this.#states = [...this.#states, { id: execution.conversionId, state: 'PENDING' }];
    return afterCommit(this.#cfg.faults, 'execute', ok(execution, false));
  }

  async get(conversionId: string): Promise<PortResult<{ readonly state: ConversionState }, 'NOT_FOUND'>> {
    const before = faultBefore(this.#cfg.faults, 'get');
    if (before !== null) return before;
    let state: ConversionState | null = null;
    for (const s of this.#states) if (s.id === conversionId) state = s.state;
    return state === null ? rejected('NOT_FOUND', conversionId) : ok({ state }, false);
  }
}
