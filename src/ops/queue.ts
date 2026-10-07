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
 * - A case closes only after the ledger's own read-back balances.
 * - Everything is audited, append-only. Fail closed: with the decision path not
 *   enabled (CF-31 open) no action is accepted.
 * - The client transaction history is unit HIST and is not written here.
 */

import { ambiguous, idempotencyKey, isPaymentId, lpDigestHex, ok, rejected } from '../nova-ports/ids.js';
import type { NovaAccountRef, PortResult } from '../nova-ports/ids.js';
import { AuditLog } from './audit.js';
import type { AuditType } from './audit.js';
import type { CaseStorePort, ConsentPort, OpsJournal, OpsLedgerPort, PaymentFacts, PaymentFactsPort, RailControlPort, StaffDirectoryPort } from './ports.js';
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
  optionDigest,
  optionProblem,
} from './types.js';
import type { CaseAmounts, CaseKind, CaseOption, CaseOutcome, Leg, CaseRecord, OpAction, OptionRecord, PendingDecision } from './types.js';

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
  readonly options: readonly CaseOption[];
  readonly evidenceRefs: readonly string[];
}

/** What an operator submits. There is deliberately no amount, account or destination here. */
export interface OpsActionRequest {
  readonly caseId: string;
  readonly action: OpAction;
  readonly optionId: string;
  readonly approvers: readonly [string, string];
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
  if (typeof refs !== 'object' || refs === null) return false;
  let n = 0n;
  for (const r of refs) {
    if (!isRef(r)) return false;
    n += 1n;
  }
  return n > 0n;
}

/** The approver ids as strings, for the audit record, whatever shape arrived. */
function textsOf(xs: readonly unknown[]): string[] {
  return typeof xs === 'object' && xs !== null ? [...xs].map(String) : [];
}

function notSentOk(f: PaymentFacts): boolean {
  return f.arcLeg === 'NONE' || (f.arcLeg === 'PROVEN_NOT_SENT' && f.proof !== null && NOT_SENT_PROOFS.includes(f.proof));
}

function unsentCode(f: PaymentFacts): 'LEG_UNRESOLVED' | 'LEG_NOT_PROVEN_UNSENT' | null {
  if (notSentOk(f)) return null;
  return f.arcLeg === 'UNRESOLVED' ? 'LEG_UNRESOLVED' : 'LEG_NOT_PROVEN_UNSENT';
}

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
    const inputDigest = lpDigestHex([
      'ops-open',
      input.kind,
      input.reason,
      input.subject,
      input.paymentId,
      input.clientUid,
      input.amounts === null ? '-' : `${input.amounts.unit}:${input.amounts.expected}:${input.amounts.confirmed}`,
      ...options.map((o) => o.digest),
      ...input.evidenceRefs,
    ]);
    const existing = await this.d.cases.get(caseId);
    if (existing.kind === 'OK') {
      return existing.value.inputDigest === inputDigest ? ok(existing.value, true) : rejected('CASE_CONFLICT', 'same kind and subject opened with different content');
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
      options,
      evidenceRefs: [...input.evidenceRefs],
      openedAt: this.d.clock(),
      status: 'OPEN',
      version: 1n,
      inputDigest,
      pending: null,
      outcome: null,
    };
    const logged = await this.d.audit.record({
      type: 'CASE_OPENED',
      caseId,
      action: null,
      optionId: null,
      actors: [],
      reason: `${input.kind}:${input.reason}`,
      evidenceRefs: input.evidenceRefs,
      code: 'OK',
      refs: [],
    });
    if (!logged) return rejected('AUDIT_FAILED', 'the case opening could not be audited');
    const put = await this.d.cases.put(rec, null);
    if (put.kind === 'OK') return ok(put.value, false);
    return put.kind === 'REJECTED' ? rejected('CASE_CONFLICT', 'the case was written concurrently; retry') : put;
  }

  private inputProblem(i: OpenCaseInput): [OpsCode, string] | null {
    if (!CASE_KINDS.includes(i.kind)) return ['KIND_MISMATCH', 'unknown case kind'];
    if (!REASONS[i.kind].includes(i.reason)) return ['REASON_INVALID', `reason ${JSON.stringify(i.reason)} is not a ${i.kind} reason`];
    if (!isRef(i.subject) || !isRef(i.clientUid) || typeof i.paymentId !== 'string' || !isPaymentId(i.paymentId)) {
      return ['INPUT_INVALID', 'subject, paymentId or clientUid malformed'];
    }
    if (!evidenceOk(i.evidenceRefs)) return ['EVIDENCE_MISSING', 'at least one well-formed evidence reference is required'];
    const a = i.amounts;
    const needsAmounts = i.kind === 'UNDERPAYMENT' || i.kind === 'OVERPAYMENT';
    if (!needsAmounts && a !== null) return ['INPUT_INVALID', 'amounts only belong to UNDERPAYMENT and OVERPAYMENT'];
    if (needsAmounts) {
      if (a === null || !amountOk(a.unit, a.expected) || !amountOk(a.unit, a.confirmed)) return ['INPUT_INVALID', 'expected and confirmed amounts are required'];
      if (i.kind === 'UNDERPAYMENT' ? a.confirmed >= a.expected : a.confirmed <= a.expected) {
        return ['KIND_MISMATCH', `confirmed amount does not make a ${i.kind}`];
      }
    }
    return this.optionsProblem(i);
  }

  private optionsProblem(i: OpenCaseInput): [OpsCode, string] | null {
    if (typeof i.options !== 'object' || i.options.length === 0) return ['OPTION_INVALID', 'at least one option is required'];
    const seen = new Set<string>();
    for (const o of i.options) {
      if (!ALLOWED_ACTIONS[i.kind].includes(o.action)) return ['ACTION_NOT_ALLOWED', `${o.action} is not an action of a ${i.kind} case`];
      const p = optionProblem(o);
      if (p !== null) return ['OPTION_INVALID', p];
      if (seen.has(o.optionId)) return ['OPTION_INVALID', 'duplicate optionId'];
      seen.add(o.optionId);
      const a = i.amounts;
      if (a !== null && o.action === 'ACCEPT_WITH_CONSENT' && (o.unit !== a.unit || o.acceptedAmount !== a.confirmed)) {
        return ['OPTION_INVALID', 'ACCEPT_WITH_CONSENT must accept exactly the confirmed amount'];
      }
      const legs = o.action === 'REFUND' ? o.legs : null;
      if (a !== null && legs !== null && (legs.some((l: Leg) => l.unit !== a.unit) || debitTotal(legs) > a.confirmed)) {
        return ['OPTION_INVALID', 'a refund may not exceed the confirmed amount'];
      }
    }
    return null;
  }

  async execute(req: OpsActionRequest): Promise<PortResult<CaseOutcome, OpsCode>> {
    const actors = textsOf(req.approvers);
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
    if (staff !== null) return refuse(staff[0], staff[1]);
    if (typeof req.reason !== 'string' || req.reason.trim() === '' || strLen(req.reason) > REASON_MAX) return refuse('REASON_INVALID', 'a reason of 1 to 500 characters is required');
    if (!evidenceOk(req.evidenceRefs)) return refuse('EVIDENCE_MISSING', 'at least one well-formed evidence reference is required');
    const decisionId = deriveDecisionId(c.caseId, req.action, opt.optionId);
    if (c.pending !== null && c.pending.decisionId !== decisionId) return refuse('CASE_PENDING_OTHER_DECISION', 'another decision is in progress on this case');
    const pre = await this.precondition(c, opt, req);
    if (pre !== null) return refuse(pre[0], pre[1]);
    if (!(await this.log('ACTION_AUTHORIZED', req, actors, 'OK', []))) return rejected('AUDIT_FAILED', 'the action could not be audited; nothing was done');
    return this.run(c, opt, req, decisionId, actors);
  }

  /** Canonical, authenticated and distinct (D-2 "two distinct authenticated staff identities"). */
  private async staffProblem(req: OpsActionRequest): Promise<[OpsCode, string] | null> {
    const a = typeof req.approvers === 'object' && req.approvers !== null && req.approvers.length === 2 ? req.approvers : null;
    if (a === null || typeof a[0] !== 'string' || typeof a[1] !== 'string') return ['APPROVER_UNAUTHENTICATED', 'exactly two approvers are required'];
    const first = await this.d.staff.canonical(a[0]);
    const second = await this.d.staff.canonical(a[1]);
    if (first === null || second === null) return ['APPROVER_UNAUTHENTICATED', 'both approvers must be authenticated staff, never a service account'];
    return first === second ? ['SAME_APPROVER', 'two different people must approve'] : null;
  }

  private async precondition(c: CaseRecord, opt: OptionRecord, req: OpsActionRequest): Promise<[OpsCode, string] | null> {
    if (CONSENT_ACTIONS.includes(opt.action) && c.pending?.consentConsumed !== true && (req.consentRef === null || !isRef(req.consentRef))) {
      return ['CONSENT_MISSING', `${opt.action} needs the client's recorded consent`];
    }
    if (opt.action === 'WRITE_OFF' && this.d.config.lossAccount === null) return ['LOSS_ACCOUNT_UNSET', 'no loss account is configured; WRITE_OFF is refused'];
    if (opt.action !== 'WRITE_OFF' && opt.action !== 'REFUND' && opt.action !== 'RETRY_AS_NEW_PAYMENT') return null;
    const f = await this.d.payments.facts(c.paymentId);
    if (f.kind !== 'OK') return ['FACTS_UNAVAILABLE', 'the payment facts could not be read'];
    if (opt.action === 'WRITE_OFF') return f.value.arcLeg === 'UNRESOLVED' ? ['LEG_UNRESOLVED', 'the Arc leg may have been sent; resolve it first'] : null;
    if (opt.action === 'REFUND' && opt.template === 'P13_PAYIN_REFUND') {
      return f.value.arcLeg === 'NONE' ? null : ['LEG_NOT_PROVEN_UNSENT', 'P13 refunds only a pay-in that has no Arc leg'];
    }
    if (opt.action === 'RETRY_AS_NEW_PAYMENT' && !(f.value.terminal && f.value.p6Posted)) {
      return ['RETRY_NOT_ALLOWED', 'the original must be terminal with P6 posted'];
    }
    const code = unsentCode(f.value);
    return code === null ? null : [code, 'the Arc leg is not proven never sent (D-6)'];
  }

  private journalFor(opt: OptionRecord, loss: NovaAccountRef | null): OpsJournal | null {
    switch (opt.action) {
      case 'REQUOTE':
        return { template: 'P14_REQUOTE_REPRICE', legs: opt.legs };
      case 'REFUND':
        return { template: opt.template, legs: opt.legs };
      case 'WRITE_OFF':
        return {
          template: 'P15_WRITE_OFF',
          legs: [
            { account: loss as NovaAccountRef, side: 'DEBIT', asset: opt.asset, unit: opt.unit, amount: opt.amount },
            { account: opt.creditAccount, side: 'CREDIT', asset: opt.asset, unit: opt.unit, amount: opt.amount },
          ],
        };
      default:
        return null;
    }
  }

  private async run(c0: CaseRecord, opt: OptionRecord, req: OpsActionRequest, decisionId: string, actors: readonly string[]): Promise<PortResult<CaseOutcome, OpsCode>> {
    let c = c0;
    const store = async (next: Omit<CaseRecord, 'version'>): Promise<boolean> => {
      const r = await this.d.cases.put({ ...next, version: c.version + 1n }, c.version);
      if (r.kind === 'OK') c = r.value;
      return r.kind === 'OK';
    };
    const release = async (): Promise<void> => {
      await store({ ...c, pending: null });
    };
    const pending = async (code: OpsCode): Promise<void> => {
      await this.log('ACTION_PENDING', req, actors, code, []);
    };
    if (c.pending === null) {
      const claim: PendingDecision = { decisionId, consentConsumed: false };
      if (!(await store({ ...c, pending: claim }))) return rejected('CASE_CONFLICT', 'the case changed; reload and retry');
    }
    let refs: readonly string[] = [];
    if (CONSENT_ACTIONS.includes(opt.action) && c.pending?.consentConsumed !== true) {
      const consentRef = req.consentRef as string;
      const used = await this.d.consent.consume(consentRef, { clientUid: c.clientUid, paymentId: c.paymentId, caseId: c.caseId, digest: opt.digest });
      if (used.kind === 'AMBIGUOUS') return used;
      if (used.kind === 'REJECTED') {
        await release();
        await this.log('ACTION_REFUSED', req, actors, 'CONSENT_REFUSED', [used.code]);
        return rejected('CONSENT_REFUSED', `consent refused: ${used.code}`);
      }
      refs = [...refs, `consent:${consentRef}`];
      if (!(await store({ ...c, pending: { decisionId, consentConsumed: true } }))) return rejected('CASE_CONFLICT', 'consent consumed but the case changed; a new consent is needed');
    }
    let journalRef: string | null = null;
    const journal = this.journalFor(opt, this.d.config.lossAccount);
    if (journal !== null) {
      const posted = await this.d.ledger.post(idempotencyKey(`ops:${decisionId}`), journal);
      if (posted.kind === 'AMBIGUOUS') return posted;
      if (posted.kind === 'REJECTED') {
        await release();
        await this.log('ACTION_REFUSED', req, actors, 'LEDGER_REJECTED', [posted.code]);
        return rejected('LEDGER_REJECTED', `the ledger refused the journal: ${posted.code}`);
      }
      const p = posted.value;
      if (p.debits !== p.credits || p.debits !== debitTotal(journal.legs)) {
        await pending('UNBALANCED');
        return rejected('UNBALANCED', 'the ledger read-back does not balance; the case stays open');
      }
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
      const r = await this.d.control.apply(opt.action, c.subject, decisionId, req.approvers);
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
      acceptedAmount: opt.action === 'ACCEPT_WITH_CONSENT' ? opt.acceptedAmount : null,
      closedAt: this.d.clock(),
    };
    if (!(await store({ ...c, status: 'CLOSED', pending: null, outcome }))) return ambiguous('UNAVAILABLE');
    await this.log('ACTION_APPLIED', req, actors, 'OK', refs);
    return ok(outcome, false);
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
