/**
 * LedgerPort (docs/NOVA_ARC_DESIGN.md §7.2, §9): Nova `services/ledger`.
 *
 * The package owns no ledger. It sends balanced journals to Nova's ledger
 * through this port, which Nova implements. Amounts are U1 `CbsMinor` at
 * Nova's per-asset precision [A-01]; sums use U1's checked helpers only.
 *
 * evaluateJournal is the one decision procedure for a journal: "checked by us
 * AND by Nova" [A-05]. Both in-memory fakes call it over their own storage, and
 * Nova's adapter must pass the same contract tests [A-34].
 *
 * Rules:
 * - the template ids are exactly §7.2 `PostingTemplateId` (§9.2 rows);
 * - `refs.paymentId` is null for the rail-level journals P5, P8, P9 and P10,
 *   may be null for P4 (gas of a transaction not sent for a payment: an
 *   internal move, a DFNS cancel or a replacement), and is set for every other
 *   template (§7.2 `JournalRefs`);
 * - every journal has ≥ 2 legs, every amount > 0, both sides present, and
 *   Σ debits = Σ credits in integer minor units (§9.2);
 * - P7_COMPENSATE is the only way to undo a journal (REVERSED, CO-1 v3 step 6):
 *   it must name an existing, not yet compensated P2, P2I or P3 journal of the
 *   same payment and mirror its legs exactly with sides swapped (§9.2 P7
 *   "mirror of the original P2/P3 legs"). Nothing happens on-chain;
 * - P6_RELEASE is bound to the payment's reservation like P7 to its original
 *   (§9.2 P6, §9.3 "P1 = P6", "clearing is released exactly once"): the
 *   payment must have a P1 in the same asset whose legs P6 mirrors exactly,
 *   and nothing may have released it yet (no P2, P2I or P6 of the payment).
 *   While the payment's USDC is at a payout partner (P2P), P6 needs the
 *   partner's return (P2R) or the claim (P11) first (F-17);
 * - a CUSTOMER account (GL-1, a liability) can never go below zero:
 *   INSUFFICIENT_FUNDS, checked in the same atomic write [A-09];
 * - no account total may pass CBS_MINOR_MAX: refused as INVALID_JOURNAL (a
 *   typed refusal, never a thrown overflow).
 *
 * Deviations from the §7.2 signatures, each a strengthening the rules above
 * need (a design delta must record them; the design is frozen): `getBalance`
 * returns debit and credit totals (LedgerBalance), not a signed net;
 * JournalReceipt adds `template` and `refs` (so a P7 receipt can evidence
 * REVERSED); LedgerRejectCode adds INVALID_JOURNAL and ALREADY_COMPENSATED;
 * LedgerView adds `paymentJournals` (the P6 binding). The P3 fee's own P7
 * (F > 0) needs a second key, `pay:<id>:p7f`, beside the design's single
 * `pay:<id>:p7`.
 */
import { addCbsMinor, cbsMinor, CbsMinorOverflowError } from '../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../amounts/index.js';
import { isIdempotencyKey, ok, rejected } from './ids.js';
import type { Hex32, IdempotencyKey, KeyConflict, LedgerAssetCode, NetworkId, NovaAccountRef, PaymentId, PortResult } from './ids.js';

const ZERO: CbsMinor = cbsMinor(0n);

/** GL roles (§9.1; kit-v3 naming GL-1…GL-7). Mapping to Nova accounts is config [A-06]. */
export type GlRole = 'GL-1' | 'GL-2' | 'GL-3' | 'GL-4' | 'GL-5' | 'GL-6' | 'GL-7';
export type Side = 'DEBIT' | 'CREDIT';

export type LedgerAccount =
  | { readonly kind: 'CUSTOMER'; readonly account: NovaAccountRef }
  | { readonly kind: 'ROLE'; readonly role: GlRole; readonly sub: string };

export interface LedgerLeg {
  readonly account: LedgerAccount;
  readonly side: Side;
  /** > 0, in minor units of the journal's asset at its precision. */
  readonly amount: CbsMinor;
}

/** Exactly §7.2 `PostingTemplateId`, in the design's order (§9.2 rows; P4D, P9D are sub-ledger entries, not Nova journals). */
export const POSTING_TEMPLATES = Object.freeze([
  'P1_RESERVE',
  'P2_SETTLE_EXTERNAL',
  'P2I_SETTLE_INTERNAL',
  'P2P_PARTNER_FUNDED',
  'P2R_PARTNER_RETURN',
  'P3_FEE',
  'P4_GAS',
  'P5_DUST_SWEEP',
  'P6_RELEASE',
  'P7_COMPENSATE',
  'P8_EXTERNAL_FUNDING',
  'P9_UNIDENTIFIED_RECEIPT',
  'P10_INTERNAL_MOVE',
  'P11_PARTNER_CLAIM',
] as const);
export type PostingTemplateId = (typeof POSTING_TEMPLATES)[number];

/** Rail-level templates: never tied to a payment (§7.2 JournalRefs). */
export const RAIL_LEVEL_TEMPLATES: readonly PostingTemplateId[] = Object.freeze(['P5_DUST_SWEEP', 'P8_EXTERNAL_FUNDING', 'P9_UNIDENTIFIED_RECEIPT', 'P10_INTERNAL_MOVE']);

/** Templates whose paymentId may be either: P4 of a transaction not sent for a payment has none (§7.2 JournalRefs, §9.2 P4). */
export const PAYMENT_OPTIONAL_TEMPLATES: readonly PostingTemplateId[] = Object.freeze(['P4_GAS']);

/** What a P7 may compensate: the settlement journals of a SETTLED payment (§9.2 P7 "mirror of the original P2/P3 legs"). */
export const COMPENSABLE_TEMPLATES: readonly PostingTemplateId[] = Object.freeze(['P2_SETTLE_EXTERNAL', 'P2I_SETTLE_INTERNAL', 'P3_FEE']);

/** What releases a payment's P1 reservation from GL-5 clearing (§9.3): settlement or release, exactly once. */
export const RELEASING_TEMPLATES: readonly PostingTemplateId[] = Object.freeze(['P2_SETTLE_EXTERNAL', 'P2I_SETTLE_INTERNAL', 'P6_RELEASE']);

export interface JournalRefs {
  /** null for P5, P8, P9, P10; null or set for P4; set for every other template. */
  readonly paymentId: PaymentId | null;
  readonly network: NetworkId | null;
  readonly txHash: Hex32 | null;
  readonly logIndex: bigint | null;
  readonly dfnsTransferId: string | null;
  /** journalId compensated by P7; null for every other template. */
  readonly compensates: string | null;
}

export interface JournalRequest {
  readonly key: IdempotencyKey;
  readonly template: PostingTemplateId;
  readonly asset: LedgerAssetCode;
  /** Must equal Nova's precision for `asset`, else PRECISION_MISMATCH (RUBRIC MC-06). */
  readonly precision: CbsPrecision;
  readonly legs: readonly LedgerLeg[];
  readonly refs: JournalRefs;
}

/** §7.2 receipt, extended with the template and refs so a P7 receipt can evidence a REVERSED status. */
export interface JournalReceipt {
  readonly journalId: string;
  readonly key: IdempotencyKey;
  readonly postedAt: string;
  readonly template: PostingTemplateId;
  readonly refs: JournalRefs;
}

export type LedgerRejectCode =
  | KeyConflict
  | 'INVALID_JOURNAL'
  | 'UNBALANCED'
  | 'INSUFFICIENT_FUNDS'
  | 'ACCOUNT_UNKNOWN'
  | 'ACCOUNT_CLOSED'
  | 'ASSET_UNKNOWN'
  | 'PRECISION_MISMATCH'
  | 'BINDING_MISMATCH'
  | 'ALREADY_COMPENSATED';

/**
 * Debit and credit totals of one account in one asset. Totals, not a signed
 * net: a `CbsMinor` is never negative (U1), and the net side depends on the
 * account's normal side (GL_NORMAL_SIDE).
 */
export interface LedgerBalance {
  readonly debits: CbsMinor;
  readonly credits: CbsMinor;
}

export interface LedgerPort {
  getAssetPrecision(asset: LedgerAssetCode): Promise<PortResult<CbsPrecision, 'ASSET_UNKNOWN'>>;
  postJournal(req: JournalRequest): Promise<PortResult<JournalReceipt, LedgerRejectCode>>;
  getJournalByKey(key: IdempotencyKey): Promise<PortResult<JournalReceipt | null, never>>;
  getBalance(account: LedgerAccount, asset: LedgerAssetCode): Promise<PortResult<LedgerBalance, 'ACCOUNT_UNKNOWN' | 'ASSET_UNKNOWN'>>;
}

/** Normal side per GL role (§9.1). A CUSTOMER account is GL-1 (credit-normal). */
export const GL_NORMAL_SIDE: Readonly<Record<GlRole, Side>> = Object.freeze({
  'GL-1': 'CREDIT',
  'GL-2': 'DEBIT',
  'GL-3': 'DEBIT',
  'GL-4': 'CREDIT',
  'GL-5': 'CREDIT',
  'GL-6': 'CREDIT',
  'GL-7': 'CREDIT',
});

/** Stable string identity of an account (storage key in fakes). */
export function accountKey(a: LedgerAccount): string {
  return a.kind === 'CUSTOMER' ? `CUSTOMER:${a.account}` : `ROLE:${a.role}:${a.sub}`;
}

/** Canonical encoding of a request, for same-key comparison (§7.1). Bigints as decimal strings; fixed field order. */
export function canonicalJournal(req: JournalRequest): string {
  const r = req.refs;
  return JSON.stringify([
    req.key,
    req.template,
    req.asset,
    `${req.precision}`,
    req.legs.map((l) => [accountKey(l.account), l.side, l.amount.toString()]),
    [r.paymentId, r.network, r.txHash, r.logIndex === null ? null : r.logIndex.toString(), r.dfnsTransferId, r.compensates],
  ]);
}

/** Legs with sides swapped: the only shape a P7 compensation may have. */
export function mirrorLegs(legs: readonly LedgerLeg[]): readonly LedgerLeg[] {
  return legs.map((l) => ({ account: l.account, side: l.side === 'DEBIT' ? 'CREDIT' : 'DEBIT', amount: l.amount }));
}

function legsKey(legs: readonly LedgerLeg[]): string {
  return JSON.stringify(legs.map((l) => [accountKey(l.account), l.side, l.amount.toString()]));
}

/** The legs as a multiset (order-free), for the P6-mirrors-P1 check. */
function legSetKey(legs: readonly LedgerLeg[]): string {
  return JSON.stringify(legs.map((l) => JSON.stringify([accountKey(l.account), l.side, l.amount.toString()])).sort());
}

export type JournalShapeCode = 'INVALID_JOURNAL' | 'UNBALANCED';

/**
 * Stateless checks (§9.2 "every row balances: Σ DR = Σ CR, all amounts > 0,
 * integers"; §7.2 refs rules). Null when the journal is well-formed.
 */
export function checkJournalShape(req: JournalRequest): { readonly code: JournalShapeCode; readonly detail: string } | null {
  if (!isIdempotencyKey(req.key)) return { code: 'INVALID_JOURNAL', detail: 'malformed idempotency key' };
  if (!POSTING_TEMPLATES.includes(req.template)) return { code: 'INVALID_JOURNAL', detail: `unknown template ${String(req.template)}` };
  if (!PAYMENT_OPTIONAL_TEMPLATES.includes(req.template) && RAIL_LEVEL_TEMPLATES.includes(req.template) !== (req.refs.paymentId === null)) {
    return { code: 'INVALID_JOURNAL', detail: 'paymentId must be null for P5/P8/P9/P10 and set for every template but P4' };
  }
  if ((req.template === 'P7_COMPENSATE') !== (req.refs.compensates !== null)) {
    return { code: 'INVALID_JOURNAL', detail: 'refs.compensates must be set exactly for P7' };
  }
  if (req.legs.length < 2) return { code: 'INVALID_JOURNAL', detail: 'a journal needs at least two legs' };
  if (req.legs.some((l) => l.amount <= 0n)) return { code: 'INVALID_JOURNAL', detail: 'every leg amount must be > 0' };
  let debits: CbsMinor;
  let credits: CbsMinor;
  try {
    debits = sumSide(req.legs, 'DEBIT');
    credits = sumSide(req.legs, 'CREDIT');
  } catch (e) {
    if (e instanceof CbsMinorOverflowError) return { code: 'INVALID_JOURNAL', detail: 'journal total exceeds CBS_MINOR_MAX' };
    throw e;
  }
  if (debits === ZERO || credits === ZERO) return { code: 'UNBALANCED', detail: 'a journal needs both a debit and a credit' };
  if (debits !== credits) return { code: 'UNBALANCED', detail: `debits ${debits} != credits ${credits}` };
  return null;
}

/** What a ledger must be able to read to judge a journal. Each fake implements it over its own storage. */
export interface LedgerView {
  /** Null when the asset is unknown. */
  assetPrecision(asset: LedgerAssetCode): { readonly precision: CbsPrecision } | null;
  accountStatus(account: LedgerAccount): 'OPEN' | 'CLOSED' | null;
  journalByKey(key: IdempotencyKey): { readonly canonical: string; readonly receipt: JournalReceipt } | null;
  journalById(journalId: string): JournalRequest | null;
  isCompensated(journalId: string): boolean;
  /** Every journal posted with `refs.paymentId` = `paymentId`, in posting order. */
  paymentJournals(paymentId: PaymentId): readonly JournalRequest[];
  balance(account: LedgerAccount, asset: LedgerAssetCode): LedgerBalance;
}

/** Σ of one side's leg amounts (U1 checked addition; throws CbsMinorOverflowError above CBS_MINOR_MAX). */
export function sumSide(legs: readonly LedgerLeg[], side: Side): CbsMinor {
  let total = ZERO;
  for (const l of legs) if (l.side === side) total = addCbsMinor(total, l.amount);
  return total;
}

/**
 * The full decision for postJournal, in order: replay or key conflict; shape;
 * asset and precision; accounts; P7 compensation binding; P6 release binding;
 * account totals and customer funds.
 * Returns the final result (a replay or a refusal), or null meaning "write it
 * atomically now".
 */
export function evaluateJournal(req: JournalRequest, view: LedgerView): PortResult<JournalReceipt, LedgerRejectCode> | null {
  const prior = view.journalByKey(req.key);
  if (prior !== null) {
    return prior.canonical === canonicalJournal(req)
      ? ok(prior.receipt, true)
      : rejected('KEY_CONFLICT', `key ${req.key} reused with a different journal`);
  }
  const shape = checkJournalShape(req);
  if (shape !== null) return rejected(shape.code, shape.detail);
  const known = view.assetPrecision(req.asset);
  if (known === null) return rejected('ASSET_UNKNOWN', `asset ${req.asset}`);
  if (known.precision !== req.precision) return rejected('PRECISION_MISMATCH', `asset ${req.asset}`);
  for (const l of req.legs) {
    const status = view.accountStatus(l.account);
    if (status === null) return rejected('ACCOUNT_UNKNOWN', accountKey(l.account));
    if (status === 'CLOSED') return rejected('ACCOUNT_CLOSED', accountKey(l.account));
  }
  if (req.refs.compensates !== null) {
    const original = view.journalById(req.refs.compensates);
    if (original === null || !COMPENSABLE_TEMPLATES.includes(original.template)) {
      return rejected('BINDING_MISMATCH', 'P7 must compensate an existing P2, P2I or P3 journal');
    }
    if (view.isCompensated(req.refs.compensates)) return rejected('ALREADY_COMPENSATED', req.refs.compensates);
    const mirrors = original.asset === req.asset && original.refs.paymentId === req.refs.paymentId && legsKey(mirrorLegs(original.legs)) === legsKey(req.legs);
    if (!mirrors) return rejected('BINDING_MISMATCH', 'P7 legs must mirror the original journal');
  }
  if (req.template === 'P6_RELEASE') {
    const why = releaseRule(req, view.paymentJournals(req.refs.paymentId as PaymentId));
    if (why !== null) return rejected('BINDING_MISMATCH', why);
  }
  return checkTotals(req, view);
}

/**
 * §9.2 P6, §9.3: a release mirrors this payment's P1 (same asset, the same
 * legs with sides swapped) and is the only release of it; with the USDC at a
 * payout partner (P2P) it follows P2R or comes after P11 (F-17). Null when it holds.
 */
function releaseRule(req: JournalRequest, journals: readonly JournalRequest[]): string | null {
  const p1 = journals.find((j) => j.template === 'P1_RESERVE');
  if (p1 === undefined || p1.asset !== req.asset || legSetKey(mirrorLegs(p1.legs)) !== legSetKey(req.legs)) {
    return "P6 must mirror this payment's P1 reservation (§9.2 P6, §9.3 P1 = P6)";
  }
  const released = journals.find((j) => RELEASING_TEMPLATES.includes(j.template));
  if (released !== undefined) return `the reservation was already released by ${released.template} (§9.3: exactly once)`;
  const posted = (t: PostingTemplateId): boolean => journals.some((j) => j.template === t);
  if (posted('P2P_PARTNER_FUNDED') && !posted('P2R_PARTNER_RETURN') && !posted('P11_PARTNER_CLAIM')) {
    return 'F-17: the USDC is at the payout partner; P6 follows P2R or comes after P11';
  }
  return null;
}

/** Per account touched: the new totals stay ≤ CBS_MINOR_MAX, and a CUSTOMER that is debited does not go below zero. */
function checkTotals(req: JournalRequest, view: LedgerView): PortResult<never, LedgerRejectCode> | null {
  const seen = new Set<string>();
  for (const l of req.legs) {
    const k = accountKey(l.account);
    if (seen.has(k)) continue;
    seen.add(k);
    const own = req.legs.filter((m) => accountKey(m.account) === k);
    const debit = sumSide(own, 'DEBIT');
    const b = view.balance(l.account, req.asset);
    let debits: CbsMinor;
    let credits: CbsMinor;
    try {
      debits = addCbsMinor(b.debits, debit);
      credits = addCbsMinor(b.credits, sumSide(own, 'CREDIT'));
    } catch (e) {
      if (e instanceof CbsMinorOverflowError) return rejected('INVALID_JOURNAL', `${k} totals would exceed CBS_MINOR_MAX`);
      throw e;
    }
    if (l.account.kind === 'CUSTOMER' && debit !== ZERO && debits > credits) return rejected('INSUFFICIENT_FUNDS', k);
  }
  return null;
}
