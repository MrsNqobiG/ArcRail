/**
 * In-memory CBS stub for the testnet inbound slice (docs/PHASE2_SLICE_PLAN.md,
 * "CBS stub"). It stands in for the core banking system behind `CbsPort`, and
 * is used by tests only. It is NOT on the money path: no listed path imports
 * it (docs/MONEY_PATH.md); it plays the CBS, whose own rules it enforces.
 *
 * Implemented (CONTRACT v3 §1.4 result model and §3 rules):
 * - `postJournal` for T1, T2, T8 and unid: balanced per unit, unit tag equal to
 *   the CBS's own (`UNIT_MISMATCH`), no zero-amount leg (`ZERO_AMOUNT`), a
 *   required ref missing → `INVALID`, the §3 account binding (a G1 leg must be
 *   T2 to the account the CBS issued `refs.address` to, else
 *   `BINDING_MISMATCH`), account status, and no normal-side balance below 0
 *   (`INSUFFICIENT_FUNDS`). Any other journal with a G1 leg →
 *   `BINDING_MISMATCH` (the stub holds no payout-instruction or disposition
 *   record to bind T3/T5 fallbacks or T11 to). Any other journal without a G1
 *   leg (T4 fallback, T6, T9, T10, gas, dust) → `NOT_PERMITTED`: outside the slice.
 * - `screen`, `getAccountStanding`, `createCase`, `submitMonitoringEvent`,
 *   `getResultByKey`, `listJournals` (with `refs` as posted), `getBalancesAsOf`
 *   and `listIssuedAddresses` (the issuance record of CONTRACT §3 T2 binding;
 *   not in `CbsPort` yet, CF-5(h), Q-C18).
 * - Idempotency on every keyed op: same key and same payload → the recorded
 *   result again (OK or REJECTED, no new effect); same key, different payload
 *   (or another op) → `CONFLICT{key}`.
 * - Fault injection: AMBIGUOUS or a timeout (an AMBIGUOUS after a delay), each
 *   either before the effect (nothing applied) or after it (applied, response
 *   lost); and a REJECTED with an unclassified code.
 *
 * Every other `CbsPort` operation is outside the slice and rejects its promise
 * (a transport error, which the translator reads as AMBIGUOUS: fail closed).
 *
 * Journal sequence: journals are numbered 1, 2, … in posting order; a CBS
 * cut-off is a journal sequence (CONTRACT §1.2 `cbsCutoff`). `listJournals`
 * returns `fromCutoff < seq ≤ toCutoff`; `getBalancesAsOf` sums `seq ≤ cutoff`.
 */
import type { AccountRef } from '../registry/index.js';
import { TESTNET_CHAIN_ID, isCanonicalAddress, isDecimalString, isId, isIdempotencyKey, isTxHash } from './keys.js';
import type { IdempotencyKey } from './keys.js';
import type { CallMeta, CaseReason, CbsMinorTag, CbsPort, GlRole, JournalLeg, JournalRefs, ScreenVerdict } from './port.js';
import type { CbsResult, RejectedCode } from './result.js';

/** Every operation the stub answers (the `CbsPort` ops plus `listIssuedAddresses`). */
export type StubOp = keyof CbsPort | 'listIssuedAddresses';

export interface AccountStatus {
  readonly active: boolean;
  readonly kycValid: boolean;
  readonly frozen: boolean;
  readonly closed: boolean;
}

export interface IssuedAddress {
  /** `0x` + 40 lowercase hex. */
  readonly address: string;
  readonly accountRef: AccountRef;
}

export interface FaultSpec {
  readonly op: StubOp;
  /** Only calls carrying this key (keyed ops). Default: any call of `op`. */
  readonly key?: string;
  /**
   * `AMBIGUOUS`: an immediate AMBIGUOUS. `TIMEOUT`: an AMBIGUOUS after `delayMs`.
   * `UNKNOWN_CODE`: a REJECTED with a code outside the CONTRACT §1.4 list (no effect).
   */
  readonly kind: 'AMBIGUOUS' | 'TIMEOUT' | 'UNKNOWN_CODE';
  /** AMBIGUOUS/TIMEOUT: true = the effect is applied and only the response is lost. Default false. */
  readonly applied?: boolean;
  /** How many matching calls fail. Default 1. */
  readonly times?: number;
  /** TIMEOUT only. Default 0. */
  readonly delayMs?: number;
}

export interface CallRecord {
  readonly op: StubOp;
  readonly callId: unknown;
  readonly key?: unknown;
}

export interface JournalRecord {
  readonly seq: bigint;
  readonly journalId: string;
  readonly key: IdempotencyKey;
  readonly valueDate: string;
  readonly narrative: string;
  readonly legs: readonly JournalLeg[];
  readonly refs: JournalRefs;
  readonly postedAt: string;
}

export interface ScreeningRecord {
  readonly key: IdempotencyKey;
  readonly screeningRef: string;
  readonly verdict: ScreenVerdict;
  readonly request: unknown;
}

export interface CaseRecord {
  readonly key: IdempotencyKey;
  readonly caseId: string;
  readonly reason: CaseReason;
  readonly request: unknown;
}

export interface MonitoringRecord {
  readonly key: IdempotencyKey;
  readonly request: unknown;
}

export interface CbsStubConfig {
  /** The CBS's own unit tag for USDC, `CBS_MINOR:<assetCode>:<p>` (CONTRACT §1.1). */
  readonly unit: CbsMinorTag;
  /** Clock for `postedAt`, `asOf`. Default: the system clock, ISO 8601. */
  readonly now?: () => string;
  /** Verdict for an address with no configured verdict. Default CLEAR. */
  readonly defaultVerdict?: ScreenVerdict;
}

/** CONTRACT §3 `createCase` reasons (closed list). */
export const CASE_REASONS: readonly CaseReason[] = Object.freeze([
  'SCREENING_HIT',
  'SCREENING_REVIEW',
  'UNIDENTIFIED_INBOUND',
  'MINT_UNATTRIBUTED',
  'TRAVEL_RULE_INCOMPLETE',
  'TR_HASH_CHANGED',
  'RECON_DRIFT',
  'BLOCKLIST_REVERT',
  'BLOCKLIST_PRECHECK',
  'STANDING_INELIGIBLE',
  'APPROVAL_REJECTED',
  'APPROVAL_EXPIRED',
  'APPROVAL_MISMATCH',
  'CANCEL_FINAL',
  'POSTING_REJECTED',
  'SIGNER_REFUSED',
  'CANCEL_BLOCKED',
  'LATE_DISPOSITION',
  'PENDING_AGE',
  'QUARANTINE',
  'PAUSE',
] as const satisfies readonly CaseReason[]);

const UNIT_TAG = /^CBS_MINOR:([A-Za-z0-9._-]+):(?:[0-9]|1[0-8])$/;
const ANY_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const VALUE_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const WALLET_ROLES: readonly string[] = ['hot', 'gas', 'collection'];

type Outcome = { readonly kind: 'OK'; readonly value: unknown } | { readonly kind: 'REJECTED'; readonly code: RejectedCode };

type ResultByKey = Extract<Awaited<ReturnType<CbsPort['getResultByKey']>>, { readonly kind: 'OK' }>['value'];

interface KeyRecord {
  readonly op: StubOp;
  readonly fingerprint: string;
  readonly outcome: Outcome;
}

interface ActiveFault {
  readonly spec: FaultSpec;
  remaining: number;
}

const isObject = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNonEmptyString = (x: unknown): x is string => typeof x === 'string' && x !== '';

/** A 20-byte hex address, any case, not 0x0 (CONTRACT §1.2). */
const isAddress = (x: unknown): x is string => typeof x === 'string' && ANY_ADDRESS.test(x) && isCanonicalAddress(x.toLowerCase());

/** A `subjectRef`: the JCS string of a non-empty array of strings (CONTRACT §1.2). */
function isSubjectRef(x: unknown): boolean {
  if (typeof x !== 'string') return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(x);
  } catch {
    return false;
  }
  return Array.isArray(parsed) && parsed.length > 0 && parsed.every((e) => typeof e === 'string') && JSON.stringify(parsed) === x;
}

/** Stable JSON (object members sorted): the payload fingerprint for CONFLICT detection. */
function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (isObject(x)) {
    const names = Object.keys(x)
      .filter((n) => x[n] !== undefined)
      .sort();
    return `{${names.map((n) => `${JSON.stringify(n)}:${stable(x[n])}`).join(',')}}`;
  }
  return String(JSON.stringify(x));
}

/** The ledger account a GL role names (one balance per sub-account), or null if the role is malformed. */
function accountKey(g: unknown): string | null {
  if (!isObject(g)) return null;
  switch (g.role) {
    case 'G1':
      return isNonEmptyString(g.accountRef) ? `G1:${g.accountRef}` : null;
    case 'G2':
      return typeof g.wallet === 'string' && WALLET_ROLES.includes(g.wallet) ? `G2:${g.wallet}` : null;
    case 'G4':
      return g.sub === 'dust' || g.sub === 'unidentified' ? `G4:${g.sub}` : null;
    case 'G5':
      return g.sub === 'inbound' || g.sub === 'outbound' ? `G5:${g.sub}` : null;
    case 'G3':
    case 'G6':
    case 'G7':
      return g.role;
    default:
      return null;
  }
}

/** Debit-normal accounts (CONTRACT §2): G2 and G3. Every other role is credit-normal. */
const isDebitNormal = (account: string): boolean => account.startsWith('G2') || account === 'G3';

/** Change of the normal-side balance of `account` for one leg. */
function delta(account: string, side: 'DR' | 'CR', value: bigint): bigint {
  return (side === 'DR') === isDebitNormal(account) ? value : -value;
}

const ambiguous = (detail: string): { readonly kind: 'AMBIGUOUS'; readonly detail: string } => ({ kind: 'AMBIGUOUS', detail });
const rejected = (code: RejectedCode): { readonly kind: 'REJECTED'; readonly code: RejectedCode } => ({ kind: 'REJECTED', code });

export class CbsStub implements CbsPort {
  readonly unit: CbsMinorTag;
  readonly assetCode: string;
  readonly #now: () => string;
  readonly #defaultVerdict: ScreenVerdict;
  readonly #accounts = new Map<string, AccountStatus>();
  readonly #issued = new Map<string, AccountRef>();
  readonly #verdicts = new Map<string, ScreenVerdict>();
  readonly #keys = new Map<string, KeyRecord>();
  readonly #journals: JournalRecord[] = [];
  readonly #balances = new Map<string, bigint>();
  readonly #screenings: ScreeningRecord[] = [];
  readonly #cases: CaseRecord[] = [];
  readonly #monitoring: MonitoringRecord[] = [];
  readonly #calls: CallRecord[] = [];
  readonly #faults: ActiveFault[] = [];
  #journalSeq = 0n;
  #screenSeq = 0n;
  #caseSeq = 0n;

  constructor(config: CbsStubConfig) {
    const asset = typeof config.unit === 'string' ? UNIT_TAG.exec(config.unit)?.[1] : undefined;
    if (asset === undefined) throw new RangeError('CbsStub: unit must be CBS_MINOR:<assetCode>:<p> with 0 ≤ p ≤ 18');
    this.unit = config.unit;
    this.assetCode = asset;
    this.#now = config.now ?? (() => new Date().toISOString());
    this.#defaultVerdict = config.defaultVerdict ?? 'CLEAR';
  }

  // -------------------------------------------------------------------------
  // Test set-up and inspection (not part of CbsPort).
  // -------------------------------------------------------------------------

  /** Open a customer account (G1). Default status: active, KYC valid, not frozen, not closed. */
  openAccount(accountRef: AccountRef, status: Partial<AccountStatus> = {}): void {
    if (!isNonEmptyString(accountRef)) throw new RangeError('openAccount: accountRef must be a non-empty string');
    if (this.#accounts.has(accountRef)) throw new RangeError('openAccount: account already open');
    this.#accounts.set(accountRef, { active: true, kycValid: true, frozen: false, closed: false, ...status });
  }

  setAccountStatus(accountRef: AccountRef, status: Partial<AccountStatus>): void {
    const current = this.#accounts.get(accountRef);
    if (current === undefined) throw new RangeError('setAccountStatus: unknown account');
    this.#accounts.set(accountRef, { ...current, ...status });
  }

  /** Record that the CBS issued `address` to `accountRef` (the issuance record, CONTRACT §3 T2 binding). */
  issueAddress(address: string, accountRef: AccountRef): void {
    if (!isAddress(address)) throw new RangeError('issueAddress: address must be 20 bytes of hex, not 0x0');
    if (!this.#accounts.has(accountRef)) throw new RangeError('issueAddress: unknown account');
    const lower = address.toLowerCase();
    if (this.#issued.has(lower)) throw new RangeError('issueAddress: address already issued');
    this.#issued.set(lower, accountRef);
  }

  setScreeningVerdict(address: string, verdict: ScreenVerdict): void {
    this.#verdicts.set(address.toLowerCase(), verdict);
  }

  injectFault(spec: FaultSpec): void {
    this.#faults.push({ spec, remaining: spec.times ?? 1 });
  }

  /** The current CBS cut-off: the sequence of the last posted journal. */
  journalSeq(): bigint {
    return this.#journalSeq;
  }

  /** Current normal-side balance of a GL role (0 if never posted). */
  balanceOf(role: GlRole): bigint {
    const account = accountKey(role);
    if (account === null) throw new RangeError('balanceOf: malformed GL role');
    return this.#balances.get(account) ?? 0n;
  }

  journals(): readonly JournalRecord[] {
    return structuredClone(this.#journals);
  }

  screenings(): readonly ScreeningRecord[] {
    return structuredClone(this.#screenings);
  }

  cases(): readonly CaseRecord[] {
    return structuredClone(this.#cases);
  }

  monitoringEvents(): readonly MonitoringRecord[] {
    return structuredClone(this.#monitoring);
  }

  calls(): readonly CallRecord[] {
    return structuredClone(this.#calls);
  }

  // -------------------------------------------------------------------------
  // Call plumbing: call log, faults, idempotency.
  // -------------------------------------------------------------------------

  #takeFault(op: StubOp, key: unknown): FaultSpec | undefined {
    const active = this.#faults.find((f) => f.remaining > 0 && f.spec.op === op && (f.spec.key === undefined || f.spec.key === key));
    if (active === undefined) return undefined;
    active.remaining -= 1;
    return active.spec;
  }

  async #run<T>(op: StubOp, meta: CallMeta, key: unknown, effect: () => CbsResult<T>): Promise<CbsResult<T>> {
    const callId: unknown = isObject(meta) ? meta.callId : undefined;
    this.#calls.push(key === undefined ? { op, callId } : { op, callId, key });
    const fault = this.#takeFault(op, key);
    if (fault?.kind === 'UNKNOWN_CODE') return { kind: 'REJECTED', code: 'UNCLASSIFIED' as RejectedCode };
    const lostBeforeEffect = fault !== undefined && fault.applied !== true;
    // Every call carries a callId (CONTRACT §1.2); a call without one is refused before any effect.
    const result = lostBeforeEffect ? undefined : isNonEmptyString(callId) ? effect() : rejected('INVALID');
    if (fault === undefined) return result as CbsResult<T>;
    if (fault.kind === 'TIMEOUT') {
      await new Promise((resolve) => setTimeout(resolve, fault.delayMs ?? 0));
      return ambiguous('timeout');
    }
    return ambiguous('injected transport error');
  }

  /** A keyed write: idempotency (replay or CONFLICT), then validation, then the effect, recorded under the key. */
  #keyed<T>(op: StubOp, req: { readonly key: unknown }, validate: () => RejectedCode | null, apply: () => T): CbsResult<T> {
    const { key, ...payload } = req;
    if (!isIdempotencyKey(key)) return rejected('INVALID');
    const fingerprint = stable(payload);
    const seen = this.#keys.get(key as string);
    if (seen !== undefined) {
      if (seen.op !== op || seen.fingerprint !== fingerprint) return { kind: 'CONFLICT', key: key as string };
      return structuredClone(seen.outcome) as CbsResult<T>;
    }
    const code = validate();
    const outcome: Outcome = code === null ? { kind: 'OK', value: apply() } : { kind: 'REJECTED', code };
    this.#keys.set(key as string, { op, fingerprint, outcome: structuredClone(outcome) });
    return outcome as CbsResult<T>;
  }

  /** CONTRACT §1.1 wire amount: `{unit, value}` with a decimal value. `cbsOnly`: the unit must be the CBS's own tag. */
  #amountCode(amount: unknown, cbsOnly: boolean): RejectedCode | null {
    if (!isObject(amount) || !isDecimalString(amount.value) || typeof amount.unit !== 'string') return 'INVALID';
    if (amount.unit === this.unit) return null;
    if (!cbsOnly && (amount.unit === 'USDC_UNITS' || amount.unit === 'NATIVE_WEI')) return null;
    return 'UNIT_MISMATCH';
  }

  #refsCode(refs: unknown): RejectedCode | null {
    if (!isObject(refs) || !isSubjectRef(refs.subjectRef)) return 'INVALID';
    const { caseId, dispositionSeq, instructionId, address, txHash, assignRef } = refs;
    if (caseId !== undefined && !isId(caseId)) return 'INVALID';
    if (dispositionSeq !== undefined && !isDecimalString(dispositionSeq)) return 'INVALID';
    if (instructionId !== undefined && !isId(instructionId)) return 'INVALID';
    if (address !== undefined && !isAddress(address)) return 'INVALID';
    if (txHash !== undefined && !isTxHash(txHash)) return 'INVALID';
    if (assignRef !== undefined && !(isObject(assignRef) && isId(assignRef.caseId) && isDecimalString(assignRef.dispositionSeq))) return 'INVALID';
    return null;
  }

  // -------------------------------------------------------------------------
  // postJournal (CONTRACT §3) for the slice templates.
  // -------------------------------------------------------------------------

  #journalCode(req: Parameters<CbsPort['postJournal']>[0]): RejectedCode | null {
    if (typeof req.valueDate !== 'string' || !VALUE_DATE.test(req.valueDate) || typeof req.narrative !== 'string') return 'INVALID';
    const refsCode = this.#refsCode(req.refs);
    if (refsCode !== null) return refsCode;
    if (!Array.isArray(req.legs) || req.legs.length === 0) return 'INVALID';
    const legs: { account: string; side: 'DR' | 'CR'; value: bigint }[] = [];
    for (const leg of req.legs as readonly unknown[]) {
      if (!isObject(leg)) return 'INVALID';
      const side = leg.side;
      if (side !== 'DR' && side !== 'CR') return 'INVALID';
      const account = accountKey(leg.glOrAccountRef);
      if (account === null) return 'INVALID';
      const amountCode = this.#amountCode(leg.amount, true);
      if (amountCode !== null) return amountCode;
      const value = BigInt((leg.amount as { readonly value: string }).value);
      if (value === 0n) return 'ZERO_AMOUNT';
      legs.push({ account, side, value });
    }
    const debits = legs.filter((l) => l.side === 'DR').reduce((s, l) => s + l.value, 0n);
    const credits = legs.filter((l) => l.side === 'CR').reduce((s, l) => s + l.value, 0n);
    if (debits !== credits) return 'UNBALANCED';

    const bindingCode = this.#bindingCode(req, legs);
    if (bindingCode !== null) return bindingCode;

    for (const [account, change] of this.#deltas(legs)) {
      if ((this.#balances.get(account) ?? 0n) + change < 0n) return 'INSUFFICIENT_FUNDS';
    }
    return null;
  }

  #deltas(legs: readonly { account: string; side: 'DR' | 'CR'; value: bigint }[]): Map<string, bigint> {
    const out = new Map<string, bigint>();
    for (const l of legs) out.set(l.account, (out.get(l.account) ?? 0n) + delta(l.account, l.side, l.value));
    return out;
  }

  /** Template recognition, required refs and the §3 account binding. */
  #bindingCode(req: Parameters<CbsPort['postJournal']>[0], legs: readonly { account: string; side: 'DR' | 'CR' }[]): RejectedCode | null {
    // Debits first, then credits (each in request order), so the shape doesn't depend on leg order.
    const ordered = [...legs.filter((l) => l.side === 'DR'), ...legs.filter((l) => l.side === 'CR')];
    const shape = ordered.map((l) => `${l.side} ${l.account.startsWith('G1:') ? 'G1' : l.account}`).join(' · ');
    switch (shape) {
      case 'DR G2:hot · CR G5:inbound':
      case 'DR G2:gas · CR G5:inbound':
      case 'DR G2:collection · CR G5:inbound': // T1
      case 'DR G5:inbound · CR G7': // T8
      case 'DR G5:inbound · CR G4:unidentified': // unid
        return null;
      case 'DR G5:inbound · CR G1': {
        // T2: refs.address is required, and the CBS must have issued it to this G1 account.
        const address = req.refs.address;
        if (address === undefined) return 'INVALID';
        const accountRef = (ordered[1] as { readonly account: string }).account.slice('G1:'.length);
        if (this.#issued.get(address.toLowerCase()) !== accountRef) return 'BINDING_MISMATCH';
        const status = this.#accounts.get(accountRef) as AccountStatus;
        if (status.closed) return 'ACCOUNT_CLOSED';
        if (status.frozen || !status.active || !status.kycValid) return 'ACCOUNT_BLOCKED';
        return null;
      }
      default:
        return legs.some((l) => l.account.startsWith('G1:')) ? 'BINDING_MISMATCH' : 'NOT_PERMITTED';
    }
  }

  postJournal(req: Parameters<CbsPort['postJournal']>[0], meta: CallMeta): ReturnType<CbsPort['postJournal']> {
    return this.#run('postJournal', meta, req.key, () =>
      this.#keyed(
        'postJournal',
        req,
        () => this.#journalCode(req),
        () => {
          this.#journalSeq += 1n;
          const legs = req.legs.map((l) => ({ account: accountKey(l.glOrAccountRef) as string, side: l.side, value: BigInt(l.amount.value) }));
          for (const [account, change] of this.#deltas(legs)) this.#balances.set(account, (this.#balances.get(account) ?? 0n) + change);
          const record: JournalRecord = {
            seq: this.#journalSeq,
            journalId: `jrn-${this.#journalSeq}`,
            key: req.key,
            valueDate: req.valueDate,
            narrative: req.narrative,
            legs: structuredClone(req.legs),
            refs: structuredClone(req.refs),
            postedAt: this.#now(),
          };
          this.#journals.push(record);
          return { journalId: record.journalId, postedAt: record.postedAt };
        },
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Other keyed writes used by the slice.
  // -------------------------------------------------------------------------

  screen(req: Parameters<CbsPort['screen']>[0], meta: CallMeta): ReturnType<CbsPort['screen']> {
    return this.#run('screen', meta, req.key, () =>
      this.#keyed(
        'screen',
        req,
        () => {
          const { subject, role, direction, amount, context } = req;
          if (!isObject(subject) || (role !== 'sender' && role !== 'destination') || (direction !== 'inbound' && direction !== 'outbound')) return 'INVALID';
          if (subject.kind === 'ADDRESS' ? !isAddress(subject.value) : subject.kind !== 'CCTP_MINT' || !isNonEmptyString(subject.value)) return 'INVALID';
          if (!isSubjectRef(context)) return 'INVALID';
          return this.#amountCode(amount, false);
        },
        () => {
          // CONTRACT §3: CCTP_MINT can never return CLEAR synchronously, so it is always REVIEW.
          const verdict = req.subject.kind === 'CCTP_MINT' ? 'REVIEW' : (this.#verdicts.get(req.subject.value.toLowerCase()) ?? this.#defaultVerdict);
          this.#screenSeq += 1n;
          const screeningRef = `scr-${this.#screenSeq}`;
          this.#screenings.push({ key: req.key, screeningRef, verdict, request: structuredClone(req) });
          return { verdict, screeningRef };
        },
      ),
    );
  }

  createCase(req: Parameters<CbsPort['createCase']>[0], meta: CallMeta): ReturnType<CbsPort['createCase']> {
    return this.#run('createCase', meta, req.key, () =>
      this.#keyed(
        'createCase',
        req,
        () => {
          if (!CASE_REASONS.includes(req.reason) || !isSubjectRef(req.subjectRef)) return 'INVALID';
          if (!Array.isArray(req.evidenceRefs) || !req.evidenceRefs.every((e) => typeof e === 'string')) return 'INVALID';
          return this.#refsCode(req.refs);
        },
        () => {
          this.#caseSeq += 1n;
          const caseId = `case-${this.#caseSeq}`;
          this.#cases.push({ key: req.key, caseId, reason: req.reason, request: structuredClone(req) });
          return { caseId };
        },
      ),
    );
  }

  submitMonitoringEvent(req: Parameters<CbsPort['submitMonitoringEvent']>[0], meta: CallMeta): ReturnType<CbsPort['submitMonitoringEvent']> {
    return this.#run('submitMonitoringEvent', meta, req.key, () =>
      this.#keyed(
        'submitMonitoringEvent',
        req,
        () => {
          if (req.direction !== 'inbound' && req.direction !== 'outbound' && req.direction !== 'internal') return 'INVALID';
          if (!isNonEmptyString(req.class) || !isNonEmptyString(req.at)) return 'INVALID';
          if (!isTxHash(req.txHash) || !isAddress(req.counterpartyAddress)) return 'INVALID';
          if (req.chainId !== TESTNET_CHAIN_ID) return 'CHAIN_NOT_ENABLED';
          if (req.accountRef !== undefined && !this.#accounts.has(req.accountRef)) return 'UNKNOWN_ACCOUNT';
          return this.#amountCode(req.amount, false);
        },
        () => {
          this.#monitoring.push({ key: req.key, request: structuredClone(req) });
          return {};
        },
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Reads.
  // -------------------------------------------------------------------------

  getAccountStanding(req: Parameters<CbsPort['getAccountStanding']>[0], meta: CallMeta): ReturnType<CbsPort['getAccountStanding']> {
    return this.#run('getAccountStanding', meta, undefined, () => {
      if (req.asset !== this.assetCode) return rejected('UNIT_MISMATCH');
      const status = this.#accounts.get(req.accountRef);
      if (status === undefined) return rejected('UNKNOWN_ACCOUNT');
      if (status.closed) return rejected('ACCOUNT_CLOSED');
      return { kind: 'OK', value: { active: status.active, kycValid: status.kycValid, frozen: status.frozen, asOf: this.#now() } };
    });
  }

  getResultByKey(req: Parameters<CbsPort['getResultByKey']>[0], meta: CallMeta): ReturnType<CbsPort['getResultByKey']> {
    return this.#run<ResultByKey>('getResultByKey', meta, req.key, () => {
      if (!isIdempotencyKey(req.key)) return rejected('INVALID');
      const seen = this.#keys.get(req.key);
      if (seen === undefined) return { kind: 'OK', value: { state: 'NOT_FOUND', op: '' } };
      const { op, outcome } = structuredClone(seen);
      return outcome.kind === 'OK'
        ? { kind: 'OK', value: { state: 'APPLIED', op, result: outcome.value } }
        : { kind: 'OK', value: { state: 'REJECTED', op, code: outcome.code } };
    });
  }

  listJournals(req: Parameters<CbsPort['listJournals']>[0], meta: CallMeta): ReturnType<CbsPort['listJournals']> {
    return this.#run('listJournals', meta, undefined, () => {
      if (!isDecimalString(req.fromCutoff) || !isDecimalString(req.toCutoff)) return rejected('INVALID');
      const from = BigInt(req.fromCutoff);
      const to = BigInt(req.toCutoff);
      if (from > to) return rejected('INVALID');
      const keys = req.keys;
      if (keys !== undefined && !(Array.isArray(keys) && keys.every(isIdempotencyKey))) return rejected('INVALID');
      const journals = this.#journals
        .filter((j) => j.seq > from && j.seq <= to && (keys === undefined || keys.includes(j.key)))
        .map((j) => structuredClone({ journalId: j.journalId, key: j.key, legs: j.legs, refs: j.refs, postedAt: j.postedAt }));
      return { kind: 'OK', value: { journals } };
    });
  }

  getBalancesAsOf(req: Parameters<CbsPort['getBalancesAsOf']>[0], meta: CallMeta): ReturnType<CbsPort['getBalancesAsOf']> {
    return this.#run('getBalancesAsOf', meta, undefined, () => {
      if (!isDecimalString(req.cutoff) || !Array.isArray(req.accounts)) return rejected('INVALID');
      const wanted = req.accounts.map((a) => accountKey(a));
      if (wanted.includes(null)) return rejected('INVALID');
      const cutoff = BigInt(req.cutoff);
      const applied = cutoff < this.#journalSeq ? cutoff : this.#journalSeq;
      const sums = new Map<string, bigint>();
      for (const j of this.#journals) {
        if (j.seq > applied) break;
        for (const l of j.legs) {
          const account = accountKey(l.glOrAccountRef) as string;
          sums.set(account, (sums.get(account) ?? 0n) + delta(account, l.side, BigInt(l.amount.value)));
        }
      }
      const balances = req.accounts.map((account) => ({
        account: structuredClone(account),
        amount: { unit: this.unit, value: (sums.get(accountKey(account) as string) ?? 0n).toString() },
      }));
      return { kind: 'OK', value: { balances, cutoffApplied: applied.toString() } };
    });
  }

  /** The CBS issuance record (CONTRACT §3 T2 binding, ADR-008 DR-23). Not in `CbsPort` yet (CF-5(h), Q-C18). */
  listIssuedAddresses(meta: CallMeta): Promise<CbsResult<{ readonly issued: readonly IssuedAddress[] }>> {
    return this.#run('listIssuedAddresses', meta, undefined, () => ({
      kind: 'OK',
      value: { issued: [...this.#issued].map(([address, accountRef]) => ({ address, accountRef })) },
    }));
  }

  // -------------------------------------------------------------------------
  // Outside the testnet slice: a transport error (the translator reads it as AMBIGUOUS).
  // -------------------------------------------------------------------------

  #outside(op: StubOp, meta: CallMeta): Promise<never> {
    this.#calls.push({ op, callId: isObject(meta) ? meta.callId : undefined });
    return Promise.reject(new Error(`CBS stub: ${op} is outside the testnet slice`));
  }

  placeHold(_req: Parameters<CbsPort['placeHold']>[0], meta: CallMeta): ReturnType<CbsPort['placeHold']> {
    return this.#outside('placeHold', meta);
  }

  releaseHold(_req: Parameters<CbsPort['releaseHold']>[0], meta: CallMeta): ReturnType<CbsPort['releaseHold']> {
    return this.#outside('releaseHold', meta);
  }

  settleHold(_req: Parameters<CbsPort['settleHold']>[0], meta: CallMeta): ReturnType<CbsPort['settleHold']> {
    return this.#outside('settleHold', meta);
  }

  getTravelRuleOriginator(_req: Parameters<CbsPort['getTravelRuleOriginator']>[0], meta: CallMeta): ReturnType<CbsPort['getTravelRuleOriginator']> {
    return this.#outside('getTravelRuleOriginator', meta);
  }

  requestApproval(_req: Parameters<CbsPort['requestApproval']>[0], meta: CallMeta): ReturnType<CbsPort['requestApproval']> {
    return this.#outside('requestApproval', meta);
  }

  getApproval(_req: Parameters<CbsPort['getApproval']>[0], meta: CallMeta): ReturnType<CbsPort['getApproval']> {
    return this.#outside('getApproval', meta);
  }

  fileReportData(_req: Parameters<CbsPort['fileReportData']>[0], meta: CallMeta): ReturnType<CbsPort['fileReportData']> {
    return this.#outside('fileReportData', meta);
  }

  replayEvents(_req: Parameters<CbsPort['replayEvents']>[0], meta: CallMeta): ReturnType<CbsPort['replayEvents']> {
    return this.#outside('replayEvents', meta);
  }
}

/** A fresh in-memory CBS stub. */
export function createCbsStub(config: CbsStubConfig): CbsStub {
  return new CbsStub(config);
}
