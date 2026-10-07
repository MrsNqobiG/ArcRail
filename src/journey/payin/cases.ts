/** JPAYIN: opens OPS cases through the exported queue interface (never edits src/ops). */
import { cbsMinor, usdcUnits } from '../../amounts/index.js';
import type { OpenCaseInput, OpsQueue } from '../../ops/queue.js';
import type { CaseKind, CaseOption, Leg } from '../../ops/types.js';
import type { HoldReason, PayInConfig, PayInExpectation, PayInResult } from './types.js';

export type CaseOpener = Pick<OpsQueue, 'openCase'>;

const KIND_OF: Readonly<Record<HoldReason, CaseKind>> = {
  SIGNAL_CONFLICT: 'QUARANTINE',
  CONSENT_MISSING: 'QUARANTINE',
  BOOKED_ENTRY_MISMATCH: 'QUARANTINE',
  CONFIRMED_BELOW_EXPECTED: 'UNDERPAYMENT',
  CONFIRMED_ABOVE_EXPECTED: 'OVERPAYMENT',
  SUB_UNIT_REMAINDER: 'QUARANTINE',
  PAYIN_AFTER_QUOTE_EXPIRY: 'LATE_PAYIN',
};

/** QUARANTINE reasons are a closed set in OPS; map ours onto it. */
const QUARANTINE_REASON: Partial<Record<HoldReason, string>> = {
  SIGNAL_CONFLICT: 'SIGNAL_CONFLICT',
  CONSENT_MISSING: 'CONSENT_MISSING',
  BOOKED_ENTRY_MISMATCH: 'INVARIANT_FAILED',
  SUB_UNIT_REMAINDER: 'INVARIANT_FAILED',
};

function refundLegs(exp: PayInExpectation, cfg: PayInConfig, amount: bigint): Leg[] {
  const fiat = exp.method === 'FIAT';
  const asset = fiat ? cfg.fiatAsset : cfg.usdcAsset;
  const unit = fiat ? 'CBS_MINOR' : 'USDC_UNITS';
  const a = fiat ? cbsMinor(amount) : usdcUnits(amount);
  return [
    { account: cfg.refundDebit, side: 'DEBIT', asset, unit, amount: a },
    { account: cfg.refundCredit, side: 'CREDIT', asset, unit, amount: a },
  ];
}

/**
 * Hold: open the one case for (kind, subject) and report HELD. A failure to
 * open the case is still HELD (nothing moves), with `caseId` null.
 * `received` is the amount actually received (null when none is known).
 */
export async function hold(
  ops: CaseOpener,
  cfg: PayInConfig,
  exp: PayInExpectation,
  reason: HoldReason,
  received: bigint | null,
  evidenceRefs: readonly string[],
): Promise<PayInResult> {
  const kind = KIND_OF[reason];
  const fiat = exp.method === 'FIAT';
  const unit = fiat ? 'CBS_MINOR' : 'USDC_UNITS';
  const brand = (n: bigint): ReturnType<typeof cbsMinor> => (fiat ? cbsMinor(n) : (usdcUnits(n) as never));
  const options: CaseOption[] = [];
  let amounts: OpenCaseInput['amounts'] = null;
  const hasAmount = received !== null && received > 0n;
  if (kind === 'UNDERPAYMENT' || kind === 'OVERPAYMENT') {
    amounts = { unit, expected: brand(exp.expected), confirmed: brand(received as bigint) };
    options.push({ action: 'ACCEPT_WITH_CONSENT', optionId: 'accept-confirmed', unit, acceptedAmount: brand(received as bigint) });
  }
  if (kind === 'QUARANTINE') options.push({ action: 'RELEASE_QUARANTINE', optionId: 'release' });
  if (hasAmount) options.push({ action: 'REFUND', optionId: 'refund-received', template: 'P13_PAYIN_REFUND', legs: refundLegs(exp, cfg, received as bigint) });
  if (kind === 'LATE_PAYIN' && !hasAmount) return { kind: 'FAILED_CLOSED', code: 'EXPECTATION_INVALID', detail: 'late pay-in without an amount' };
  const input: OpenCaseInput = {
    kind,
    reason: kind === 'QUARANTINE' ? (QUARANTINE_REASON[reason] as string) : reason,
    subject: `payin:${exp.expectedPayInId}`,
    paymentId: exp.paymentId,
    clientUid: exp.clientUid,
    amounts,
    options,
    evidenceRefs: evidenceRefs.length > 0 ? evidenceRefs : [`payin:${exp.expectedPayInId}`],
  };
  const r = await ops.openCase(input);
  if (r.kind === 'OK') return { kind: 'HELD', reason, caseKind: kind, caseId: r.value.caseId, caseCode: 'OK' };
  return { kind: 'HELD', reason, caseKind: kind, caseId: null, caseCode: r.kind === 'REJECTED' ? r.code : r.cause };
}
