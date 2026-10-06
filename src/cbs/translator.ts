/**
 * ACL posting translator (RUBRIC money-path item 10): CONTRACT §3
 * `postJournal`, the hold operations and `getResultByKey`, the §1.4
 * AMBIGUOUS resolution, and the §5.1 templates of the testnet inbound slice
 * (T1, T2, T8, unid; docs/PHASE2_SLICE_PLAN.md).
 *
 * Templates are balanced by construction and omit zero-amount legs (CONTRACT §5.1).
 * No JS number is used anywhere in this module (RUBRIC MC-01): retry timing
 * (`H_retry`, backoff, jitter) is injected through `RetryBudget`.
 */
import { randomUUID } from 'node:crypto';
import type { CbsMinor } from '../amounts/index.js';
import type { AccountRef, WalletRole } from '../registry/index.js';
import type { CallMeta, CbsMinorTag, CbsPort, GlRole, JournalLeg } from './port.js';
import { REJECTED_CODES } from './result.js';
import type { CbsResult, ResolvedResult } from './result.js';

export type TemplateId =
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | 'T6'
  | 'T8'
  | 'T9'
  | 'T10'
  | 'T11'
  | 'unid'
  | 'gas'
  | 'dust';

/**
 * Input of one template. `amount` is `m` for T1 and the item's current
 * `heldAmount` `h` for T2, T8 and unid (CONTRACT §5.1). `unit` is the CBS's own
 * unit tag `CBS_MINOR:<assetCode>:<p>` (CONTRACT §1.1: precision comes from the
 * CBS). `fee` is carried only by T4 (CONTRACT §5.1), so it must be 0 for every
 * slice template. `wallet` is T1's receiving wallet role and `accountRef` T2's
 * customer account. Missing or extra fields are refused at run time (fail
 * closed), since the field set depends on the template.
 */
export interface TemplateInput {
  readonly template: TemplateId;
  readonly amount: CbsMinor;
  readonly fee: CbsMinor;
  readonly unit?: CbsMinorTag;
  readonly wallet?: WalletRole;
  readonly accountRef?: AccountRef;
}

/** `CBS_MINOR:<assetCode>:<p>` with 0 ≤ p ≤ 18 (CONTRACT §1.1, C-10). */
const CBS_MINOR_TAG = /^CBS_MINOR:[A-Za-z0-9._-]+:(?:[0-9]|1[0-8])$/;
const WALLET_ROLES: readonly string[] = ['hot', 'gas', 'collection'];

const G5_INBOUND: GlRole = { role: 'G5', sub: 'inbound' };

/** The (debit, credit) accounts of a two-leg slice template (CONTRACT §5.1 table). */
function accountsOf(input: TemplateInput): readonly [GlRole, GlRole] {
  const { template, wallet, accountRef } = input;
  if (template !== 'T1' && wallet !== undefined) throw new RangeError(`buildLegs: ${template} takes no wallet`);
  if (template !== 'T2' && accountRef !== undefined) throw new RangeError(`buildLegs: ${template} takes no accountRef`);
  switch (template) {
    case 'T1':
      if (wallet === undefined || !WALLET_ROLES.includes(wallet)) throw new RangeError('buildLegs: T1 needs a walletRole (CONTRACT §1.2)');
      return [{ role: 'G2', wallet }, G5_INBOUND];
    case 'T2':
      if (typeof accountRef !== 'string' || accountRef === '') throw new RangeError('buildLegs: T2 needs an accountRef');
      return [G5_INBOUND, { role: 'G1', accountRef }];
    case 'T8':
      return [G5_INBOUND, { role: 'G7' }];
    case 'unid':
      return [G5_INBOUND, { role: 'G4', sub: 'unidentified' }];
    default:
      throw new RangeError(`buildLegs: template ${String(template)} is not in the testnet slice`);
  }
}

/**
 * The legs of one slice template (CONTRACT §5.1), balanced by construction:
 * one debit and one credit of the same amount in the same unit. A zero-amount
 * leg is omitted (CONTRACT §3 "No zero-amount legs"), so a zero amount yields
 * no legs at all, and the caller posts nothing. Throws on a template outside
 * the slice, a missing or bad unit tag, a negative or non-bigint amount, a
 * non-zero fee, or a missing or extra wallet/accountRef (fail closed).
 */
export function buildLegs(input: TemplateInput): readonly JournalLeg[] {
  const { unit, amount, fee } = input;
  if (typeof unit !== 'string' || !CBS_MINOR_TAG.test(unit)) {
    throw new RangeError('buildLegs: unit must be CBS_MINOR:<assetCode>:<p> (CONTRACT §1.1)');
  }
  if (typeof amount !== 'bigint' || amount < 0n) throw new RangeError('buildLegs: amount must be a non-negative bigint');
  if (fee !== 0n) throw new RangeError('buildLegs: only T4 carries a fee (CONTRACT §5.1)');
  const [debit, credit] = accountsOf(input);
  if (amount === 0n) return [];
  const wire = { unit, value: amount.toString() };
  return [
    { glOrAccountRef: debit, side: 'DR', amount: wire },
    { glOrAccountRef: credit, side: 'CR', amount: wire },
  ];
}

type Req<Op extends keyof CbsPort> = Parameters<CbsPort[Op]>[0];
type Ok<Op extends keyof CbsPort> = Extract<Awaited<ReturnType<CbsPort[Op]>>, { readonly kind: 'OK' }>['value'];

/**
 * The `H_retry` horizon of CONTRACT §1.4 step 1, with its backoff and jitter.
 * `next()` waits the next backoff interval and resolves `true`, or resolves
 * `false` once `H_retry` is spent. One budget is created per keyed operation.
 */
export interface RetryBudget {
  next(): Promise<boolean>;
}

export interface TranslatorOptions {
  /** A fresh budget per keyed operation. Default: no retries (straight to `getResultByKey`). */
  readonly retryBudget?: () => RetryBudget;
  /** A new `callId` per transport attempt (CONTRACT §1.2). Default: `crypto.randomUUID`. */
  readonly newCallId?: () => string;
}

/**
 * Every keyed CBS write the money path makes goes through here, so that each
 * one comes back resolved (CONTRACT §1.4): never AMBIGUOUS.
 */
export interface PostingTranslator {
  /** CONTRACT §3 `postJournal` for one §5.1 template. */
  postJournal(req: Req<'postJournal'>, meta: CallMeta): Promise<ResolvedResult<Ok<'postJournal'>>>;
  /** CONTRACT §3 `placeHold` (T3). */
  placeHold(req: Req<'placeHold'>, meta: CallMeta): Promise<ResolvedResult<Ok<'placeHold'>>>;
  /** CONTRACT §3 `settleHold` (T4). */
  settleHold(req: Req<'settleHold'>, meta: CallMeta): Promise<ResolvedResult<Ok<'settleHold'>>>;
  /** CONTRACT §3 `releaseHold` (T5). */
  releaseHold(req: Req<'releaseHold'>, meta: CallMeta): Promise<ResolvedResult<Ok<'releaseHold'>>>;
  /**
   * CONTRACT §1.4 "Resolving AMBIGUOUS": retry `call` with the same key and
   * payload for at most `H_retry`, then `getResultByKey(key)`; APPLIED → OK,
   * REJECTED → REJECTED, NOT_FOUND → one final call, anything else → UNRESOLVED.
   * `call` receives the `CallMeta` of each transport attempt: the caller's
   * `meta` first, then a fresh `callId` per attempt.
   */
  resolveAmbiguous<T>(req: Req<'getResultByKey'>, call: (meta: CallMeta) => Promise<CbsResult<T>>, meta: CallMeta): Promise<ResolvedResult<T>>;
}

const KNOWN_CODES: ReadonlySet<string> = new Set<string>(REJECTED_CODES);
const KINDS: ReadonlySet<string> = new Set(['OK', 'REJECTED', 'CONFLICT', 'AMBIGUOUS']);
const UNRESOLVED = Object.freeze({ kind: 'UNRESOLVED' } as const);
const NO_RETRY = (): RetryBudget => ({ next: () => Promise.resolve(false) });

/**
 * One transport attempt, classified (CONTRACT §1.4): a thrown error, a
 * response that is not one of the four results, or a REJECTED code outside
 * the closed list is AMBIGUOUS.
 */
async function attempt<T>(call: (meta: CallMeta) => Promise<CbsResult<T>>, meta: CallMeta): Promise<CbsResult<T>> {
  let r: unknown;
  try {
    r = await call(meta);
  } catch {
    return { kind: 'AMBIGUOUS', detail: 'transport error' };
  }
  const kind: unknown = typeof r === 'object' && r !== null ? (r as { readonly kind?: unknown }).kind : undefined;
  if (typeof kind !== 'string' || !KINDS.has(kind)) return { kind: 'AMBIGUOUS', detail: 'unclassified response' };
  const result = r as CbsResult<T>;
  if (result.kind === 'REJECTED' && !KNOWN_CODES.has(result.code)) {
    return { kind: 'AMBIGUOUS', detail: `unknown REJECTED code ${String(result.code)}` };
  }
  return result;
}

export function createPostingTranslator(port: CbsPort, options: TranslatorOptions = {}): PostingTranslator {
  const retryBudget = options.retryBudget ?? NO_RETRY;
  const newCallId = options.newCallId ?? randomUUID;
  const fresh = (): CallMeta => ({ callId: newCallId() });

  async function resolveAmbiguous<T>(
    req: Req<'getResultByKey'>,
    call: (meta: CallMeta) => Promise<CbsResult<T>>,
    meta: CallMeta,
  ): Promise<ResolvedResult<T>> {
    // Step 1: the call, then retries with the same key and payload for at most H_retry.
    let r = await attempt(call, meta);
    const budget = retryBudget();
    while (r.kind === 'AMBIGUOUS' && (await budget.next())) r = await attempt(call, fresh());
    if (r.kind !== 'AMBIGUOUS') return r;

    // Step 2: getResultByKey. Unavailable or op not covered (any non-OK) → UNRESOLVED.
    const lookup = await attempt((m) => port.getResultByKey({ key: req.key }, m), fresh());
    if (lookup.kind !== 'OK') return UNRESOLVED;
    const { state, code } = lookup.value;
    if (state === 'REJECTED') return code !== undefined && KNOWN_CODES.has(code) ? { kind: 'REJECTED', code } : UNRESOLVED;
    if (state !== 'APPLIED' && state !== 'NOT_FOUND') return UNRESOLVED;

    // NOT_FOUND → one final call; its result is the output, AMBIGUOUS again → UNRESOLVED.
    // APPLIED → OK. The typed OK value comes from a replay with the same key and payload,
    // which §1.4 answers with the already-applied result ("OK: already applied under this
    // key with the same payload"); getResultByKey's own `result` is untyped and never cast.
    // Anything but OK on that replay contradicts APPLIED → UNRESOLVED (fail closed).
    const final = await attempt(call, fresh());
    if (final.kind === 'AMBIGUOUS') return UNRESOLVED;
    if (state === 'APPLIED' && final.kind !== 'OK') return UNRESOLVED;
    return final;
  }

  return {
    postJournal: (req, meta) => resolveAmbiguous({ key: req.key }, (m) => port.postJournal(req, m), meta),
    placeHold: (req, meta) => resolveAmbiguous({ key: req.key }, (m) => port.placeHold(req, m), meta),
    settleHold: (req, meta) => resolveAmbiguous({ key: req.key }, (m) => port.settleHold(req, m), meta),
    releaseHold: (req, meta) => resolveAmbiguous({ key: req.key }, (m) => port.releaseHold(req, m), meta),
    resolveAmbiguous,
  };
}
