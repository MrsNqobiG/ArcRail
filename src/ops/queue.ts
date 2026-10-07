/**
 * OPS operator case queue (design delta 1, D-2; D-6 for retries).
 *
 * - Every HOLD, QUARANTINE, PAUSE, requote, under/overpayment, late pay-in,
 *   stuck or returned payout and unresolved DFNS submission is a case with a
 *   closed reason code.
 * - Operators select among server-side options; an action carries no amount.
 * - Every action needs two distinct authenticated staff identities, a reason
 *   and evidence references. REQUOTE and ACCEPT_WITH_CONSENT also consume a
 *   client consent bound to the exact option.
 * - REFUND and RETRY_AS_NEW_PAYMENT never act on an Arc leg that is not proven
 *   unsent (D-2, D-6: an `externalId` lookup that finds nothing proves nothing).
 *   A P6 is refused when the payment's P6 is already posted (a proof posts it,
 *   D1 §8.4 check 3); refunds and write-offs are capped per payment by the
 *   ledger in the same commit (`OpsJournal.limit`, `guard`).
 * - UNMATCHED_FILL closes by exactly one of ADOPT_FILL or REVERSE_FILL (D-1);
 *   no REQUOTE runs while one is open for the payment.
 * - A case closes only after the ledger's own read-back balances.
 * - Everything is audited, append-only. Fail closed: with the decision path not
 *   enabled (CF-31 open) no action is accepted.
 * - The client transaction history is unit HIST and is not written here.
 */

import { ambiguous, idempotencyKey, isPaymentId, lpDigestHex, ok, rejected } from '../nova-ports/ids.js';
import type { NovaAccountRef, PortResult } from '../nova-ports/ids.js';
import { AuditLog } from './audit.js';
import type { AuditType } from './audit.js';
import type { CaseStorePort, ConsentPort, JournalGuard, OpsJournal, OpsLedgerPort, PaymentFacts, PaymentFactsPort, PostedJournal, RailControlPort, StaffDirectoryPort } from './ports.js';
import {
  ALLOWED_ACTIONS,
  CASE_KINDS,
  CONSENT_ACTIONS,
  NOT_SENT_PROOFS,
  REASONS,
  amountOk,
  debitTotal,
  deriveCaseId,
  deriveDecisionId,
  isRef,
  legKeys,
  optionDigest,
  optionProblem,
  unitOk,
} from './types.js';
import type { AmountUnit, CaseAmounts, CaseExposure, CaseKind, CaseOption, CaseOutcome, Leg, CaseRecord, OpAction, OptionRecord, PendingDecision } from './types.js';

export type OpsCode =
  | 'NOT_ENABLED'
  | 'CASE_NOT_FOUND'
  | 'CASE_CLOSED'
  | 'CASE_CONFLICT'
  | 'CASE_PENDING_OTHER_DECISION'
  | 'INPUT_INVALID'
  | 'REASON_INVALID'
  | 'EVIDENCE_MISSING'
  | 'KIND_MISMATCH'
  | 'OPTION_INVALID'
  | 'OPTION_NOT_FOUND'
  | 'ACTION_NOT_ALLOWED'
  | 'APPROVER_UNAUTHENTICATED'
  | 'SAME_APPROVER'
  | 'CONSENT_MISSING'
  | 'CONSENT_REFUSED'
  | 'DIGEST_NOT_CONFIRMED'
  | 'REFUND_ALREADY_POSTED'
  | 'LIMIT_UNKNOWN'
  | 'LIMIT_EXCEEDED'
  | 'LOSS_ACCOUNT_SAME'
  | 'UNMATCHED_FILL_OPEN'
  | 'FILL_ALREADY_ACCOUNTED'
  | 'LOSS_ACCOUNT_UNSET'
  | 'FACTS_UNAVAILABLE'
  | 'LEG_UNRESOLVED'
  | 'LEG_NOT_PROVEN_UNSENT'
  | 'RETRY_NOT_ALLOWED'
  | 'LEDGER_REJECTED'
  | 'RETRY_REJECTED'
  | 'CONTROL_REJECTED'
  | 'UNBALANCED'
  | 'AUDIT_FAILED';

export interface OpsConfig {
  /** CF-31 gate: false until a human opens the decision-entry path. Fail closed. */
  readonly decisionPathEnabled: boolean;
  /** The WRITE_OFF loss account. Null (unset) refuses WRITE_OFF; it is never defaulted (D-2, D-5). */
  readonly lossAccount: NovaAccountRef | null;
}

export interface OpsDeps {
  readonly cases: CaseStorePort;
  readonly consent: ConsentPort;
  readonly ledger: OpsLedgerPort;
  readonly staff: StaffDirectoryPort;
  readonly payments: PaymentFactsPort;
  readonly control: RailControlPort;
  readonly audit: AuditLog;
  readonly clock: () => string;
  readonly config: OpsConfig;
}

/** Opened by server code from a verified signal, never by an operator. */
export interface OpenCaseInput {
  readonly kind: CaseKind;
  readonly reason: string;
  readonly subject: string;
  readonly paymentId: string;
  readonly clientUid: string;
  /** Required for UNDERPAYMENT and OVERPAYMENT, null otherwise. */
  readonly amounts: CaseAmounts | null;
  /** Required for UNMATCHED_FILL (the already booked fill entry), null otherwise. */
  readonly bookedEntryRef?: string | null;
  /** The most a REFUND or WRITE_OFF of this case may move; null for no extra bound. */
  readonly exposure?: CaseExposure | null;
  readonly options: readonly CaseOption[];
  readonly evidenceRefs: readonly string[];
}

/** What an operator submits. There is deliberately no amount, account or destination here. */
export interface OpsActionRequest {
  readonly caseId: string;
  readonly action: OpAction;
  readonly optionId: string;
  readonly approvers: readonly [string, string];
  /** Each approver confirms the digest of the exact option they saw (D1 :1040), in the same order as `approvers`. */
  readonly confirmedDigests: readonly [string, string];
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly consentRef: string | null;
}

const REASON_MAX = 500n;

function strLen(s: string): bigint {
  let n = 0n;
  for (const _ of s) n += 1n;
  return n;
}

function evidenceOk(refs: readonly string[]): boolean {
  if (!Array.isArray(refs)) return false;
  let n = 0n;
  for (const r of refs) {
    if (!isRef(r)) return false;
    n += 1n;
  }
  return n > 0n;
}

/** The ids as strings, for the audit record, whatever shape arrived. */
function textsOf(xs: readonly unknown[]): string[] {
  return Array.isArray(xs) ? xs.map(String) : [];
}

function notSentOk(f: PaymentFacts): boolean {
  return f.arcLeg === 'NONE' || (f.arcLeg === 'PROVEN_NOT_SENT' && f.proof !== null && NOT_SENT_PROOFS.includes(f.proof));
}

/** D1 F-17: a returned payout whose return was claimed counts as unsent money (it is back in our wallet). */
function returnedOk(kind: CaseKind, f: PaymentFacts): boolean {
  return kind === 'RETURNED_PAYOUT' && f.arcLeg === 'SENT' && f.returnClaimed;
}

function unsentCode(kind: CaseKind, f: PaymentFacts): 'LEG_UNRESOLVED' | 'LEG_NOT_PROVEN_UNSENT' | null {
  if (notSentOk(f) || returnedOk(kind, f)) return null;
  return f.arcLeg === 'UNRESOLVED' ? 'LEG_UNRESOLVED' : 'LEG_NOT_PROVEN_UNSENT';
}

function legUnit(legs: readonly Leg[]): AmountUnit {
  return (legs[0] as Leg).unit;
}

function absDiff(a: bigint, b: bigint): bigint {
  return a > b ? a - b : b - a;
}

type Facts = PaymentFacts | null;

export class OpsQueue {
  constructor(private readonly d: OpsDeps) {}

  async getCase(caseId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND'>> {
    return this.d.cases.get(caseId);
  }

  async listOpen(): Promise<PortResult<readonly CaseRecord[], never>> {
    return this.d.cases.listOpen();
  }

  async openCase(input: OpenCaseInput): Promise<PortResult<CaseRecord, OpsCode>> {
    const bad = this.inputProblem(input);
    if (bad !== null) return rejected(bad[0], bad[1]);
    const options: OptionRecord[] = input.options.map((o) => ({ ...o, digest: optionDigest(o) }));
    const caseId = deriveCaseId(input.kind, input.subject);
    const bookedEntryRef = input.bookedEntryRef ?? null;
    const exposure = input.exposure ?? null;
    const inputDigest = lpDigestHex([
      'ops-open',
      input.kind,
      input.reason,
      input.subject,
      input.paymentId,
      input.clientUid,
      input.amounts === null ? '-' : `${input.amounts.unit}:${input.amounts.expected}:${input.amounts.confirmed}`,
      bookedEntryRef ?? '-',
      exposure === null ? '-' : `${exposure.unit}:${exposure.amount}`,
      ...options.map((o) => o.digest),
      ...input.evidenceRefs,
    ]);
    const existing = await this.d.cases.get(caseId);
    if (existing.kind === 'OK') {
      if (existing.value.inputDigest !== inputDigest) return rejected('CASE_CONFLICT', 'same kind and subject opened with different content');
      // A prior open may have stored the case and then failed to audit it: repair, never duplicate.
      const seen = await this.d.audit.entries();
      if (seen === null) return rejected('AUDIT_FAILED', 'the audit trail could not be read');
      if (!seen.some((e) => e.type === 'CASE_OPENED' && e.caseId === caseId) && !(await this.logOpened(existing.value))) {
        return rejected('AUDIT_FAILED', 'the case opening could not be audited');
      }
      return ok(existing.value, true);
    }
    if (existing.kind === 'AMBIGUOUS') return existing;
    const rec: CaseRecord = {
      caseId,
      kind: input.kind,
      reason: input.reason,
      subject: input.subject,
      paymentId: input.paymentId as CaseRecord['paymentId'],
      clientUid: input.clientUid,
      amounts: input.amounts,
      bookedEntryRef,
      exposure,
      consumedDigests: [],
      options,
      evidenceRefs: [...input.evidenceRefs],
      openedAt: this.d.clock(),
      status: 'OPEN',
      version: 1n,
      inputDigest,
      pending: null,
      outcome: null,
    };
    const put = await this.d.cases.put(rec, null);
    if (put.kind === 'REJECTED') return rejected('CASE_CONFLICT', 'the case was written concurrently; retry');
    if (put.kind === 'AMBIGUOUS') return put;
    if (!(await this.logOpened(put.value))) return rejected('AUDIT_FAILED', 'the case was stored but its opening could not be audited; open it again to repair');
    return ok(put.value, false);
  }

  private async logOpened(c: CaseRecord): Promise<boolean> {
    return this.d.audit.record({
      type: 'CASE_OPENED',
      caseId: c.caseId,
      action: null,
      optionId: null,
      actors: [],
      reason: `${c.kind}:${c.reason}`,
      evidenceRefs: c.evidenceRefs,
      code: 'OK',
      refs: [],
    });
  }

  private inputProblem(i: OpenCaseInput): [OpsCode, string] | null {
    if (!CASE_KINDS.includes(i.kind)) return ['KIND_MISMATCH', 'unknown case kind'];
    if (!REASONS[i.kind].includes(i.reason)) return ['REASON_INVALID', `reason ${JSON.stringify(i.reason)} is not a ${i.kind} reason`];
    if (!isRef(i.subject) || !isRef(i.clientUid) || typeof i.paymentId !== 'string' || !isPaymentId(i.paymentId)) {
      return ['INPUT_INVALID', 'subject, paymentId or clientUid malformed'];
    }
    if (!evidenceOk(i.evidenceRefs)) return ['EVIDENCE_MISSING', 'at least one well-formed evidence reference is required'];
    const booked = i.bookedEntryRef ?? null;
    if (i.kind === 'UNMATCHED_FILL' ? booked === null || !isRef(booked) : booked !== null) {
      return ['INPUT_INVALID', 'bookedEntryRef belongs to UNMATCHED_FILL cases, and is required there'];
    }
    const x = i.exposure ?? null;
    if (x !== null && (!unitOk(x.unit) || !amountOk(x.unit, x.amount))) return ['INPUT_INVALID', 'exposure must be a positive bigint in a known unit'];
    const a = i.amounts;
    const needsAmounts = i.kind === 'UNDERPAYMENT' || i.kind === 'OVERPAYMENT';
    if (!needsAmounts && a !== null) return ['INPUT_INVALID', 'amounts only belong to UNDERPAYMENT and OVERPAYMENT'];
    if (needsAmounts) {
      if (a === null || !unitOk(a.unit) || !amountOk(a.unit, a.expected) || !amountOk(a.unit, a.confirmed)) return ['INPUT_INVALID', 'expected and confirmed amounts are required'];
      if (i.kind === 'UNDERPAYMENT' ? a.confirmed >= a.expected : a.confirmed <= a.expected) {
        return ['KIND_MISMATCH', `confirmed amount does not make a ${i.kind}`];
      }
    }
    return this.optionsProblem(i, x);
  }

  private optionsProblem(i: OpenCaseInput, x: CaseExposure | null): [OpsCode, string] | null {
    if (!Array.isArray(i.options) || i.options.length === 0) return ['OPTION_INVALID', 'at least one option is required'];
    const seen = new Set<string>();
    const a = i.amounts;
    const loss = this.d.config.lossAccount;
    for (const o of i.options) {
      if (!ALLOWED_ACTIONS[i.kind].includes(o.action)) return ['ACTION_NOT_ALLOWED', `${o.action} is not an action of a ${i.kind} case`];
      const p = optionProblem(o);
      if (p !== null) return ['OPTION_INVALID', p];
      if (seen.has(o.optionId)) return ['OPTION_INVALID', 'duplicate optionId'];
      seen.add(o.optionId);
      if (a !== null && o.action === 'ACCEPT_WITH_CONSENT' && (o.unit !== a.unit || o.acceptedAmount !== a.confirmed)) {
        return ['OPTION_INVALID', 'ACCEPT_WITH_CONSENT must accept exactly the confirmed amount'];
      }
      if ((o.action === 'ADOPT_FILL' || o.action === 'REVERSE_FILL') && o.bookedEntryRef !== i.bookedEntryRef) {
        return ['OPTION_INVALID', `${o.action} must name the case's bookedEntryRef`];
      }
      const over = this.boundProblem(o, a, x, loss);
      if (over !== null) return ['OPTION_INVALID', over];
    }
    if (i.kind === 'UNMATCHED_FILL' && !(['ADOPT_FILL', 'REVERSE_FILL'] as const).every((act) => i.options.some((o) => o.action === act))) {
      return ['OPTION_INVALID', 'an UNMATCHED_FILL case needs both an ADOPT_FILL and a REVERSE_FILL option'];
    }
    return null;
  }

  /** Server-side bounds on what a REFUND or WRITE_OFF option may move. */
  private boundProblem(o: CaseOption, a: CaseAmounts | null, x: CaseExposure | null, loss: NovaAccountRef | null): string | null {
    if (o.action === 'REFUND') {
      const unit = legUnit(o.legs);
      const total = debitTotal(o.legs);
      if (a !== null && (unit !== a.unit || total > a.confirmed)) return 'a refund may not exceed the confirmed amount';
      if (x !== null && (unit !== x.unit || total > x.amount)) return 'a refund may not exceed the case exposure';
    }
    if (o.action === 'WRITE_OFF') {
      if (loss !== null && o.creditAccount === loss) return 'the write-off credit account may not be the loss account';
      if (a !== null && (o.unit !== a.unit || o.amount > absDiff(a.expected, a.confirmed))) return 'a write-off may not exceed the shortfall';
      if (x !== null && (o.unit !== x.unit || o.amount > x.amount)) return 'a write-off may not exceed the case exposure';
    }
    return null;
  }

  async execute(req: OpsActionRequest): Promise<PortResult<CaseOutcome, OpsCode>> {
    let actors = textsOf(req.approvers);
    const refuse = async (code: OpsCode, detail: string): Promise<PortResult<never, OpsCode>> => {
      await this.log('ACTION_REFUSED', req, actors, code, []);
      return rejected(code, detail);
    };
    if (!this.d.config.decisionPathEnabled) return refuse('NOT_ENABLED', 'CF-31 is open: no decision-entry path is enabled');
    const got = await this.d.cases.get(req.caseId);
    if (got.kind === 'AMBIGUOUS') return got;
    if (got.kind === 'REJECTED') return refuse('CASE_NOT_FOUND', 'no such case');
    const c = got.value;
    if (c.status === 'CLOSED') {
      const out = c.outcome;
      if (out !== null && out.action === req.action && out.optionId === req.optionId) {
        await this.log('ACTION_REPLAYED', req, actors, 'OK', []);
        return ok(out, true);
      }
      return refuse('CASE_CLOSED', 'the case is closed by another decision');
    }
    if (!ALLOWED_ACTIONS[c.kind].includes(req.action)) return refuse('ACTION_NOT_ALLOWED', `${req.action} is not an action of a ${c.kind} case`);
    const opt = c.options.find((o) => o.optionId === req.optionId && o.action === req.action);
    if (opt === undefined) return refuse('OPTION_NOT_FOUND', 'no such server-side option for this action');
    const staff = await this.staffProblem(req);
    if (staff.kind === 'BAD') return refuse(staff.code, staff.detail);
    actors = staff.ids;
    const d = req.confirmedDigests;
    if (!Array.isArray(d) || d.length !== 2 || d[0] !== opt.digest || d[1] !== opt.digest) {
      return refuse('DIGEST_NOT_CONFIRMED', 'each approver must confirm the digest of the exact option');
    }
    if (typeof req.reason !== 'string' || req.reason.trim() === '' || strLen(req.reason) > REASON_MAX) return refuse('REASON_INVALID', 'a reason of 1 to 500 characters is required');
    if (!evidenceOk(req.evidenceRefs)) return refuse('EVIDENCE_MISSING', 'at least one well-formed evidence reference is required');
    const decisionId = deriveDecisionId(c.caseId, req.action, opt.optionId);
    if (c.pending !== null && c.pending.decisionId !== decisionId) return refuse('CASE_PENDING_OTHER_DECISION', 'another decision is in progress on this case');
    const pre = await this.precondition(c, opt, req);
    if (pre.kind === 'BAD') return refuse(pre.code, pre.detail);
    if (!(await this.log('ACTION_AUTHORIZED', req, actors, 'OK', []))) return rejected('AUDIT_FAILED', 'the action could not be audited; nothing was done');
    return this.run(c, opt, req, decisionId, actors, staff.ids, pre.facts);
  }

  /** Canonical, authenticated and distinct (D-2 "two distinct authenticated staff identities"). */
  private async staffProblem(req: OpsActionRequest): Promise<{ kind: 'OK'; ids: [string, string] } | { kind: 'BAD'; code: OpsCode; detail: string }> {
    const a = Array.isArray(req.approvers) && req.approvers.length === 2 ? req.approvers : null;
    if (a === null || typeof a[0] !== 'string' || typeof a[1] !== 'string') return { kind: 'BAD', code: 'APPROVER_UNAUTHENTICATED', detail: 'exactly two approvers are required' };
    const first = await this.d.staff.canonical(a[0]);
    const second = await this.d.staff.canonical(a[1]);
    if (first === null || second === null) return { kind: 'BAD', code: 'APPROVER_UNAUTHENTICATED', detail: 'both approvers must be authenticated staff, never a service account' };
    return first === second ? { kind: 'BAD', code: 'SAME_APPROVER', detail: 'two different people must approve' } : { kind: 'OK', ids: [first, second] };
  }

  private async precondition(c: CaseRecord, opt: OptionRecord, req: OpsActionRequest): Promise<{ kind: 'OK'; facts: Facts } | { kind: 'BAD'; code: OpsCode; detail: string }> {
    const bad = (code: OpsCode, detail: string) => ({ kind: 'BAD' as const, code, detail });
    const consumed = c.pending?.consentConsumed === true || c.consumedDigests.includes(opt.digest);
    if (CONSENT_ACTIONS.includes(opt.action) && !consumed && (req.consentRef === null || !isRef(req.consentRef))) {
      return bad('CONSENT_MISSING', `${opt.action} needs the client's recorded consent`);
    }
    if (opt.action === 'WRITE_OFF') {
      const loss = this.d.config.lossAccount;
      if (loss === null) return bad('LOSS_ACCOUNT_UNSET', 'no loss account is configured; WRITE_OFF is refused');
      if (opt.creditAccount === loss) return bad('LOSS_ACCOUNT_SAME', 'the write-off credit account may not be the loss account');
    }
    if (opt.action === 'REQUOTE' || opt.action === 'ADOPT_FILL') {
      const all = await this.d.cases.listByPayment(c.paymentId);
      if (all.kind !== 'OK') return bad('FACTS_UNAVAILABLE', 'the payment cases could not be read');
      const others = all.value.filter((x) => x.caseId !== c.caseId);
      if (opt.action === 'REQUOTE' && others.some((x) => x.kind === 'UNMATCHED_FILL' && x.status === 'OPEN')) {
        return bad('UNMATCHED_FILL_OPEN', 'no new code while an UNMATCHED_FILL case of this payment is open');
      }
      if (opt.action === 'ADOPT_FILL' && others.some((x) => x.status === 'CLOSED' && (x.outcome?.action === 'REQUOTE' || x.outcome?.action === 'ADOPT_FILL'))) {
        return bad('FILL_ALREADY_ACCOUNTED', 'a conversion for this payment is already accounted for; reverse this fill instead');
      }
    }
    if (opt.action !== 'WRITE_OFF' && opt.action !== 'REFUND' && opt.action !== 'RETRY_AS_NEW_PAYMENT') return { kind: 'OK', facts: null };
    const r = await this.d.payments.facts(c.paymentId);
    if (r.kind !== 'OK') return bad('FACTS_UNAVAILABLE', 'the payment facts could not be read');
    const f = r.value;
    if (opt.action === 'WRITE_OFF') {
      if (f.arcLeg === 'UNRESOLVED') return bad('LEG_UNRESOLVED', 'the Arc leg may have been sent; resolve it first');
      return this.capProblem(f.writeOffCap, opt.unit, opt.amount, f, bad);
    }
    if (opt.action === 'REFUND') {
      if (opt.template === 'P6' && f.p6Posted) return bad('REFUND_ALREADY_POSTED', 'P6 is already posted for this payment');
      if (opt.template === 'P13_PAYIN_REFUND') {
        if (f.arcLeg !== 'NONE') return bad('LEG_NOT_PROVEN_UNSENT', 'P13 refunds only a pay-in that has no Arc leg');
      } else {
        const code = unsentCode(c.kind, f);
        if (code !== null) return bad(code, 'the Arc leg is not proven never sent (D-6)');
      }
      return this.capProblem(f.refundCap, legUnit(opt.legs), debitTotal(opt.legs), f, bad);
    }
    if (!(f.terminal && f.p6Posted)) return bad('RETRY_NOT_ALLOWED', 'the original must be terminal with P6 posted');
    const code = unsentCode(c.kind, f);
    return code === null ? { kind: 'OK', facts: f } : bad(code, 'the Arc leg is not proven never sent (D-6)');
  }

  private capProblem(
    cap: { readonly unit: AmountUnit; readonly amount: bigint } | null,
    unit: AmountUnit,
    amount: bigint,
    f: PaymentFacts,
    bad: (code: OpsCode, detail: string) => { kind: 'BAD'; code: OpsCode; detail: string },
  ): { kind: 'OK'; facts: Facts } | { kind: 'BAD'; code: OpsCode; detail: string } {
    if (cap === null) return bad('LIMIT_UNKNOWN', 'the per-payment limit is unknown; refused');
    if (cap.unit !== unit || amount > cap.amount) return bad('LIMIT_EXCEEDED', 'the amount exceeds what this payment may move');
    return { kind: 'OK', facts: f };
  }

  private journalFor(c: CaseRecord, opt: OptionRecord, facts: Facts, loss: NovaAccountRef | null): OpsJournal | null {
    const paymentId = c.paymentId as string;
    const any: JournalGuard = { arc: 'ANY', p6Unposted: false };
    switch (opt.action) {
      case 'REQUOTE':
        return { template: 'P14_REQUOTE_REPRICE', legs: opt.legs, paymentId, guard: any, limit: null };
      case 'REVERSE_FILL':
        return { template: 'P12_FILL_REVERSAL', legs: opt.legs, paymentId, guard: any, limit: null };
      case 'REFUND': {
        const f = facts as PaymentFacts;
        const cap = f.refundCap as { unit: AmountUnit; amount: bigint };
        const guard: JournalGuard =
          opt.template === 'P13_PAYIN_REFUND' ? { arc: 'NONE', p6Unposted: false } : { arc: returnedOk(c.kind, f) ? 'RETURN_CLAIMED' : 'NOT_SENT', p6Unposted: opt.template === 'P6' };
        return { template: opt.template, legs: opt.legs, paymentId, guard, limit: { bucket: 'REFUND', unit: cap.unit, cap: cap.amount } };
      }
      case 'WRITE_OFF': {
        const cap = (facts as PaymentFacts).writeOffCap as { unit: AmountUnit; amount: bigint };
        return {
          template: 'P15_WRITE_OFF',
          legs: [
            { account: loss as NovaAccountRef, side: 'DEBIT', asset: opt.asset, unit: opt.unit, amount: opt.amount },
            { account: opt.creditAccount, side: 'CREDIT', asset: opt.asset, unit: opt.unit, amount: opt.amount },
          ],
          paymentId,
          guard: { arc: 'NOT_UNRESOLVED', p6Unposted: false },
          limit: { bucket: 'WRITE_OFF', unit: cap.unit, cap: cap.amount },
        };
      }
      default:
        return null;
    }
  }

  /** The ledger key: P12 is one per booked entry, whatever case asks; every other journal is one per decision. */
  private ledgerKey(opt: OptionRecord, decisionId: string): string {
    return opt.action === 'REVERSE_FILL' ? `ops-p12:${lpDigestHex(['ops-p12', opt.bookedEntryRef]).slice(0, 32)}` : `ops:${decisionId}`;
  }

  private readBackProblem(p: PostedJournal, j: OpsJournal): string | null {
    if (p.debits !== p.credits || p.debits !== debitTotal(j.legs)) return 'totals';
    const want = legKeys(j.legs);
    const got = legKeys(p.lines);
    return want.length === got.length && want.every((k, n) => k === got[n]) ? null : 'lines';
  }

  private async run(
    c0: CaseRecord,
    opt: OptionRecord,
    req: OpsActionRequest,
    decisionId: string,
    actors: readonly string[],
    approvers: readonly [string, string],
    facts: Facts,
  ): Promise<PortResult<CaseOutcome, OpsCode>> {
    let c = c0;
    const store = async (next: Omit<CaseRecord, 'version'>): Promise<boolean> => {
      const r = await this.d.cases.put({ ...next, version: c.version + 1n }, c.version);
      if (r.kind === 'OK') c = r.value;
      return r.kind === 'OK';
    };
    // Only the call that made the claim may release it; a concurrent call of the same decision must not.
    const claimedHere = c.pending === null;
    const release = async (): Promise<void> => {
      if (claimedHere) await store({ ...c, pending: null });
    };
    const consumed = c.pending?.consentConsumed === true || c.consumedDigests.includes(opt.digest);
    if (c.pending === null) {
      const claim: PendingDecision = { decisionId, consentConsumed: consumed };
      if (!(await store({ ...c, pending: claim }))) return rejected('CASE_CONFLICT', 'the case changed; reload and retry');
    }
    let refs: readonly string[] = [];
    if (CONSENT_ACTIONS.includes(opt.action) && !consumed) {
      const consentRef = req.consentRef as string;
      const used = await this.d.consent.consume(consentRef, { clientUid: c.clientUid, paymentId: c.paymentId, caseId: c.caseId, digest: opt.digest });
      if (used.kind === 'AMBIGUOUS') return used;
      if (used.kind === 'REJECTED') {
        await release();
        await this.log('ACTION_REFUSED', req, actors, 'CONSENT_REFUSED', [used.code]);
        return rejected('CONSENT_REFUSED', `consent refused: ${used.code}`);
      }
      refs = [...refs, `consent:${consentRef}`];
      if (!(await store({ ...c, pending: { decisionId, consentConsumed: true }, consumedDigests: [...c.consumedDigests, opt.digest] }))) {
        return rejected('CASE_CONFLICT', 'consent consumed but the case changed; a new consent is needed');
      }
    }
    let journalRef: string | null = null;
    const journal = this.journalFor(c, opt, facts, this.d.config.lossAccount);
    if (journal !== null) {
      const posted = await this.d.ledger.post(idempotencyKey(this.ledgerKey(opt, decisionId)), journal);
      if (posted.kind === 'AMBIGUOUS') return posted;
      if (posted.kind === 'REJECTED') {
        await release();
        await this.log('ACTION_REFUSED', req, actors, 'LEDGER_REJECTED', [posted.code]);
        return rejected('LEDGER_REJECTED', `the ledger refused the journal: ${posted.code}`);
      }
      const p = posted.value;
      const mismatch = this.readBackProblem(p, journal);
      if (mismatch !== null) return this.unbalanced(c, req, actors, decisionId, p.journalRef, mismatch);
      journalRef = p.journalRef;
      refs = [...refs, `journal:${p.journalRef}`];
    }
    let newPaymentId: string | null = null;
    if (opt.action === 'RETRY_AS_NEW_PAYMENT') {
      const r = await this.d.payments.createRetry(idempotencyKey(`retry:${c.paymentId}`), c.paymentId);
      if (r.kind === 'AMBIGUOUS') return r;
      if (r.kind === 'REJECTED') {
        await release();
        await this.log('ACTION_REFUSED', req, actors, 'RETRY_REJECTED', [r.code]);
        return rejected('RETRY_REJECTED', `the retry was refused: ${r.code}`);
      }
      newPaymentId = r.value.newPaymentId;
      refs = [...refs, `retry:${newPaymentId}`];
    }
    if (opt.action === 'RELEASE_QUARANTINE' || opt.action === 'UNPAUSE') {
      const r = await this.d.control.apply(opt.action, c.subject, decisionId, approvers);
      if (r.kind === 'AMBIGUOUS') return r;
      if (r.kind === 'REJECTED') {
        await release();
        await this.log('ACTION_REFUSED', req, actors, 'CONTROL_REJECTED', [r.code]);
        return rejected('CONTROL_REJECTED', `the control action was refused: ${r.code}`);
      }
    }
    const outcome: CaseOutcome = {
      decisionId,
      action: opt.action,
      optionId: opt.optionId,
      journalRef,
      newPaymentId,
      acceptedAmount: opt.action === 'ACCEPT_WITH_CONSENT' ? opt.acceptedAmount : opt.action === 'ADOPT_FILL' ? opt.adoptedAmount : null,
      quoteId: opt.action === 'REQUOTE' || opt.action === 'ADOPT_FILL' || opt.action === 'ACCEPT_WITH_CONSENT' ? opt.quoteId : null,
      bookedEntryRef: opt.action === 'ADOPT_FILL' || opt.action === 'REVERSE_FILL' ? opt.bookedEntryRef : null,
      closedAt: this.d.clock(),
    };
    // The money is done. The APPLIED record comes before the close; if it cannot be written the case stays
    // pending and the same decision is repeated safely (every step above is idempotent).
    if (!(await this.log('ACTION_APPLIED', req, actors, 'OK', refs))) return ambiguous('UNAVAILABLE');
    if (!(await store({ ...c, status: 'CLOSED', pending: null, outcome }))) return ambiguous('UNAVAILABLE');
    return ok(outcome, false);
  }

  /** The ledger's read-back differs from the request: the case stays open and a human is paged through a QUARANTINE case. */
  private async unbalanced(c: CaseRecord, req: OpsActionRequest, actors: readonly string[], decisionId: string, journalRef: string, what: string): Promise<PortResult<never, OpsCode>> {
    const logged = await this.log('ACTION_PENDING', req, actors, 'UNBALANCED', [`journal:${journalRef}`]);
    const paged = await this.openCase({
      kind: 'QUARANTINE',
      reason: 'INVARIANT_FAILED',
      subject: `unbalanced:${decisionId}`,
      paymentId: c.paymentId,
      clientUid: c.clientUid,
      amounts: null,
      options: [{ action: 'RELEASE_QUARANTINE', optionId: 'release' }],
      evidenceRefs: [`journal:${journalRef}`, `readback:${what}`],
    });
    if (!logged || paged.kind !== 'OK') return rejected('AUDIT_FAILED', `the ledger read-back (${what}) does not match; the case stays open but the page-out failed`);
    return rejected('UNBALANCED', `the ledger read-back (${what}) does not match; the case stays open and a QUARANTINE case pages a human`);
  }

  private async log(type: AuditType, req: OpsActionRequest, actors: readonly string[], code: string, refs: readonly string[]): Promise<boolean> {
    return this.d.audit.record({
      type,
      caseId: String(req.caseId),
      action: String(req.action),
      optionId: String(req.optionId),
      actors,
      reason: typeof req.reason === 'string' ? req.reason : '',
      evidenceRefs: textsOf(req.evidenceRefs),
      code,
      refs,
    });
  }
}
