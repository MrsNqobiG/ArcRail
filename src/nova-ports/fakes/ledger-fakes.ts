/**
 * Test support: two structurally different in-memory LedgerPort fakes (§7.8).
 *
 * - MapLedger keeps running debit/credit totals per (account, asset) in a Map,
 *   receipts in a Map keyed by idempotency key and journals per payment in a Map.
 * - EventLogLedger keeps only an append-only journal array; balances are
 *   recomputed by folding the whole log on every read, and keys and journal ids
 *   are found by linear scan.
 *
 * Both judge every journal with the shared evaluateJournal, can inject
 * AMBIGUOUS on every operation (FaultPlan), and pass the same
 * contract tests (test/contract/ports-ledger.contract.test.ts). Neither is a
 * ledger of record: they stand in for Nova's `services/ledger` in tests.
 */
import { addCbsMinor, cbsMinor } from '../../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../../amounts/index.js';
import { ok, rejected } from '../ids.js';
import type { IdempotencyKey, LedgerAssetCode, PortResult } from '../ids.js';
import { accountKey, canonicalJournal, evaluateJournal } from '../ledger.js';
import type { JournalReceipt, JournalRequest, LedgerAccount, LedgerBalance, LedgerPort, LedgerRejectCode, LedgerView, Side } from '../ledger.js';
import { afterCommit, faultBefore } from './faults.js';
import type { FaultPlan } from './faults.js';

export interface OpeningBalance {
  readonly account: LedgerAccount;
  readonly asset: LedgerAssetCode;
  readonly side: Side;
  readonly amount: CbsMinor;
}

export interface LedgerFakeConfig {
  readonly assets: readonly { readonly asset: LedgerAssetCode; readonly precision: CbsPrecision }[];
  readonly accounts: readonly { readonly account: LedgerAccount; readonly status: 'OPEN' | 'CLOSED' }[];
  /** Must balance per asset (Σ DEBIT = Σ CREDIT), or the constructor throws. */
  readonly opening?: readonly OpeningBalance[];
  readonly faults?: FaultPlan;
}

const ZERO: CbsMinor = cbsMinor(0n);
const EMPTY: LedgerBalance = Object.freeze({ debits: ZERO, credits: ZERO });

function addToSide(b: LedgerBalance, side: Side, amount: CbsMinor): LedgerBalance {
  return side === 'DEBIT' ? { debits: addCbsMinor(b.debits, amount), credits: b.credits } : { debits: b.debits, credits: addCbsMinor(b.credits, amount) };
}

function checkOpening(opening: readonly OpeningBalance[]): void {
  const totals = new Map<string, LedgerBalance>();
  for (const o of opening) totals.set(o.asset, addToSide(totals.get(o.asset) ?? EMPTY, o.side, o.amount));
  for (const [asset, t] of totals) {
    if (t.debits !== t.credits) throw new RangeError(`opening balances for ${asset} do not balance`);
  }
}

function assetPrecision(cfg: LedgerFakeConfig, asset: LedgerAssetCode): { readonly precision: CbsPrecision } | null {
  return cfg.assets.find((a) => a.asset === asset) ?? null;
}

function statusOf(cfg: LedgerFakeConfig, account: LedgerAccount): 'OPEN' | 'CLOSED' | null {
  return cfg.accounts.find((a) => accountKey(a.account) === accountKey(account))?.status ?? null;
}

abstract class FakeLedgerBase implements LedgerPort {
  protected readonly cfg: LedgerFakeConfig;

  constructor(cfg: LedgerFakeConfig) {
    checkOpening(cfg.opening ?? []);
    this.cfg = cfg;
  }

  protected abstract view(): LedgerView;
  protected abstract commit(req: JournalRequest): JournalReceipt;
  protected abstract findByKey(key: IdempotencyKey): JournalReceipt | null;

  async getAssetPrecision(asset: LedgerAssetCode): Promise<PortResult<CbsPrecision, 'ASSET_UNKNOWN'>> {
    const before = faultBefore(this.cfg.faults, 'getAssetPrecision');
    if (before !== null) return before;
    const known = assetPrecision(this.cfg, asset);
    return known === null ? rejected('ASSET_UNKNOWN', asset) : ok(known.precision, false);
  }

  async postJournal(req: JournalRequest): Promise<PortResult<JournalReceipt, LedgerRejectCode>> {
    const before = faultBefore(this.cfg.faults, 'postJournal');
    if (before !== null) return before;
    const refused = evaluateJournal(req, this.view());
    if (refused !== null) return refused;
    return afterCommit(this.cfg.faults, 'postJournal', ok(this.commit(req), false));
  }

  /** A read: AMBIGUOUS can be injected before it (gateway check 2 counts that as "exists" and refuses). */
  async getJournalByKey(key: IdempotencyKey): Promise<PortResult<JournalReceipt | null, never>> {
    return faultBefore(this.cfg.faults, 'getJournalByKey') ?? ok(this.findByKey(key), false);
  }

  async getBalance(account: LedgerAccount, asset: LedgerAssetCode): Promise<PortResult<LedgerBalance, 'ACCOUNT_UNKNOWN' | 'ASSET_UNKNOWN'>> {
    const before = faultBefore(this.cfg.faults, 'getBalance');
    if (before !== null) return before;
    if (statusOf(this.cfg, account) === null) return rejected('ACCOUNT_UNKNOWN', accountKey(account));
    if (assetPrecision(this.cfg, asset) === null) return rejected('ASSET_UNKNOWN', asset);
    return ok(this.view().balance(account, asset), false);
  }
}

/** Fake A: Maps of running totals and receipts. */
export class MapLedger extends FakeLedgerBase {
  readonly #balances = new Map<string, LedgerBalance>();
  readonly #byKey = new Map<string, { readonly canonical: string; readonly receipt: JournalReceipt }>();
  readonly #byId = new Map<string, JournalRequest>();
  readonly #compensated = new Set<string>();
  readonly #byPayment = new Map<string, readonly JournalRequest[]>();
  #seq = 0n;

  constructor(cfg: LedgerFakeConfig) {
    super(cfg);
    for (const o of cfg.opening ?? []) this.#apply(o.account, o.asset, o.side, o.amount);
  }

  #apply(account: LedgerAccount, asset: LedgerAssetCode, side: Side, amount: CbsMinor): void {
    const k = `${accountKey(account)}@${asset}`;
    this.#balances.set(k, addToSide(this.#balances.get(k) ?? EMPTY, side, amount));
  }

  protected view(): LedgerView {
    return {
      assetPrecision: (asset) => assetPrecision(this.cfg, asset),
      accountStatus: (account) => statusOf(this.cfg, account),
      journalByKey: (key) => this.#byKey.get(key) ?? null,
      journalById: (id) => this.#byId.get(id) ?? null,
      isCompensated: (id) => this.#compensated.has(id),
      paymentJournals: (pid) => this.#byPayment.get(pid) ?? [],
      balance: (account, asset) => this.#balances.get(`${accountKey(account)}@${asset}`) ?? EMPTY,
    };
  }

  protected commit(req: JournalRequest): JournalReceipt {
    this.#seq += 1n;
    const receipt: JournalReceipt = { journalId: `map-${this.#seq}`, key: req.key, postedAt: `map-clock-${this.#seq}`, template: req.template, refs: req.refs };
    for (const l of req.legs) this.#apply(l.account, req.asset, l.side, l.amount);
    this.#byKey.set(req.key, { canonical: canonicalJournal(req), receipt });
    this.#byId.set(receipt.journalId, req);
    if (req.refs.compensates !== null) this.#compensated.add(req.refs.compensates);
    // Rail-level journals file under 'null', which no PaymentId (`pay-` + hex) ever reads.
    const pid = `${req.refs.paymentId}`;
    this.#byPayment.set(pid, [...(this.#byPayment.get(pid) ?? []), req]);
    return receipt;
  }

  protected findByKey(key: IdempotencyKey): JournalReceipt | null {
    return this.#byKey.get(key)?.receipt ?? null;
  }
}

interface LogEntry {
  readonly receipt: JournalReceipt;
  readonly req: JournalRequest;
}

/** Fake B: an append-only journal log; every read is a fold or a scan. */
export class EventLogLedger extends FakeLedgerBase {
  #log: readonly LogEntry[] = [];
  #seq = 0n;
  readonly #opening: readonly OpeningBalance[];

  constructor(cfg: LedgerFakeConfig) {
    super(cfg);
    this.#opening = cfg.opening ?? [];
  }

  #fold(account: LedgerAccount, asset: LedgerAssetCode): LedgerBalance {
    const k = accountKey(account);
    let b = EMPTY;
    for (const o of this.#opening) if (o.asset === asset && accountKey(o.account) === k) b = addToSide(b, o.side, o.amount);
    for (const e of this.#log) {
      if (e.req.asset !== asset) continue;
      for (const l of e.req.legs) if (accountKey(l.account) === k) b = addToSide(b, l.side, l.amount);
    }
    return b;
  }

  protected view(): LedgerView {
    return {
      assetPrecision: (asset) => assetPrecision(this.cfg, asset),
      accountStatus: (account) => statusOf(this.cfg, account),
      journalByKey: (key) => {
        const e = this.#log.find((x) => x.req.key === key);
        return e === undefined ? null : { canonical: canonicalJournal(e.req), receipt: e.receipt };
      },
      journalById: (id) => this.#log.find((x) => x.receipt.journalId === id)?.req ?? null,
      isCompensated: (id) => this.#log.some((x) => x.req.refs.compensates === id),
      paymentJournals: (pid) => this.#log.filter((x) => x.req.refs.paymentId === pid).map((x) => x.req),
      balance: (account, asset) => this.#fold(account, asset),
    };
  }

  protected commit(req: JournalRequest): JournalReceipt {
    this.#seq += 1n;
    const n = this.#seq;
    const receipt: JournalReceipt = { journalId: `log-${n}`, key: req.key, postedAt: `log-clock-${n}`, template: req.template, refs: req.refs };
    this.#log = [...this.#log, { receipt, req }];
    return receipt;
  }

  protected findByKey(key: IdempotencyKey): JournalReceipt | null {
    return this.#log.find((x) => x.req.key === key)?.receipt ?? null;
  }
}
