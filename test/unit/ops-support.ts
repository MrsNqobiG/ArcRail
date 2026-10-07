import { cbsMinor, usdcUnits } from '../../src/amounts/index.js';
import { ledgerAssetCode, novaAccountRef, paymentId } from '../../src/nova-ports/ids.js';
import { AuditLog } from '../../src/ops/audit.js';
import {
  AliasStaffDirectory,
  ArrayAuditStore,
  FlagConsentStore,
  LogCaseStore,
  LogConsentStore,
  LogLedger,
  LogPaymentFacts,
  LogRailControl,
  MapCaseStore,
  MapLedger,
  MapPaymentFacts,
  RuleStaffDirectory,
  SeqMapAuditStore,
  SetRailControl,
} from '../../src/ops/fakes.js';
import { OpsQueue } from '../../src/ops/queue.js';
import type { OpenCaseInput, OpsActionRequest, OpsConfig, OpsDeps } from '../../src/ops/queue.js';
import type { PaymentFacts } from '../../src/ops/ports.js';
import type { CaseOption, Leg } from '../../src/ops/types.js';

type Opt<A extends CaseOption['action']> = Extract<CaseOption, { action: A }>;

export const PAY = paymentId(`pay-${'a'.repeat(32)}`);
export const CLIENT = 'client-uid-1';
export const ALICE = 'staff:alice';
export const BOB = 'staff:bob';
export const LOSS = novaAccountRef('loss-account');
export const CLIENT_ACC = novaAccountRef('client-liability');
export const SETTLE = novaAccountRef('settlement');
export const SUSPENSE = novaAccountRef('suspense');
export const USDC = ledgerAssetCode('USDC');
export const ZAR = ledgerAssetCode('ZAR');

export const EV = ['evidence-1'];
const CAPS = {
  refundCap: { unit: 'USDC_UNITS' as const, amount: 1000n },
  writeOffCap: { unit: 'CBS_MINOR' as const, amount: 1000n },
  returnClaimed: false,
};
export const FACTS_NONE: PaymentFacts = { terminal: true, p6Posted: false, arcLeg: 'NONE', proof: null, ...CAPS };
export const FACTS_NONE_P6: PaymentFacts = { ...FACTS_NONE, p6Posted: true };
export const FACTS_UNRESOLVED: PaymentFacts = { terminal: false, p6Posted: false, arcLeg: 'UNRESOLVED', proof: null, ...CAPS };
/** Proven never sent and P6 not yet posted (refundable). */
export const FACTS_PROVEN: PaymentFacts = { terminal: true, p6Posted: false, arcLeg: 'PROVEN_NOT_SENT', proof: 'ABORT_ACCEPTED', ...CAPS };
/** Proven never sent with P6 already posted by the proof (retryable, not refundable). */
export const FACTS_PROVEN_P6: PaymentFacts = { ...FACTS_PROVEN, p6Posted: true };
export const FACTS_SENT: PaymentFacts = { terminal: true, p6Posted: false, arcLeg: 'SENT', proof: null, ...CAPS };
export const SETTLEMENT = 'a'.repeat(64);

export function legs(amount: bigint, from = CLIENT_ACC, to = SETTLE): Leg[] {
  return [
    { account: from, side: 'DEBIT', asset: USDC, unit: 'USDC_UNITS', amount: usdcUnits(amount) },
    { account: to, side: 'CREDIT', asset: USDC, unit: 'USDC_UNITS', amount: usdcUnits(amount) },
  ];
}

export const OPT = {
  requote: (reserved = 1000n, requoted = 900n): Opt<'REQUOTE'> => ({
    action: 'REQUOTE',
    optionId: 'o-requote',
    unit: 'USDC_UNITS',
    asset: USDC,
    reserved: usdcUnits(reserved),
    requoted: usdcUnits(requoted),
    legs: legs(requoted),
    quoteId: 'quote-new',
    rateNum: 18n,
    rateDen: 1n,
    expiresAt: '2026-10-07T12:00:00Z',
    settlementDigest: SETTLEMENT,
  }),
  accept: (amount = 900n): Opt<'ACCEPT_WITH_CONSENT'> => ({
    action: 'ACCEPT_WITH_CONSENT',
    optionId: 'o-accept',
    unit: 'USDC_UNITS',
    acceptedAmount: usdcUnits(amount),
    quoteId: null,
    settlementDigest: SETTLEMENT,
  }),
  adopt: (ref = 'booked-1', amount = 900n): Opt<'ADOPT_FILL'> => ({
    action: 'ADOPT_FILL',
    optionId: 'o-adopt',
    bookedEntryRef: ref,
    unit: 'USDC_UNITS',
    asset: USDC,
    adoptedAmount: usdcUnits(amount),
    quoteId: 'quote-adopted',
    rateNum: 18n,
    rateDen: 1n,
    expiresAt: '2026-10-07T12:00:00Z',
    settlementDigest: SETTLEMENT,
  }),
  reverse: (ref = 'booked-1', amount = 900n): Opt<'REVERSE_FILL'> => ({ action: 'REVERSE_FILL', optionId: 'o-reverse', bookedEntryRef: ref, legs: legs(amount, SETTLE, CLIENT_ACC) }),
  closeHistory: (): Opt<'CLOSE_HISTORY_GAP'> => ({ action: 'CLOSE_HISTORY_GAP', optionId: 'o-history' }),
  refundP6: (amount = 500n): Opt<'REFUND'> => ({ action: 'REFUND', optionId: 'o-refund', template: 'P6', legs: legs(amount) }),
  refundP13: (amount = 500n): Opt<'REFUND'> => ({ action: 'REFUND', optionId: 'o-refund13', template: 'P13_PAYIN_REFUND', legs: legs(amount) }),
  retry: (): Opt<'RETRY_AS_NEW_PAYMENT'> => ({ action: 'RETRY_AS_NEW_PAYMENT', optionId: 'o-retry' }),
  writeOff: (amount = 70n): Opt<'WRITE_OFF'> => ({
    action: 'WRITE_OFF',
    optionId: 'o-writeoff',
    unit: 'CBS_MINOR',
    asset: ZAR,
    amount: cbsMinor(amount),
    creditAccount: SUSPENSE,
  }),
  release: (): Opt<'RELEASE_QUARANTINE'> => ({ action: 'RELEASE_QUARANTINE', optionId: 'o-release' }),
  unpause: (): Opt<'UNPAUSE'> => ({ action: 'UNPAUSE', optionId: 'o-unpause' }),
};

export type Variant = 'A' | 'B';

export function makeRig(variant: Variant, over: { config?: Partial<OpsConfig>; audit?: AuditLog; ledger?: OpsDeps['ledger']; consent?: OpsDeps['consent'] } = {}) {
  const a = variant === 'A';
  const cases = a ? new MapCaseStore() : new LogCaseStore();
  const consentStore = a ? new FlagConsentStore() : new LogConsentStore();
  const payments = a ? new MapPaymentFacts() : new LogPaymentFacts();
  const ledgerStore = a ? new MapLedger(payments) : new LogLedger(payments);
  const control = a ? new SetRailControl(['item-1', 'rail']) : new LogRailControl(['item-1', 'rail']);
  const staff = a
    ? new AliasStaffDirectory({ 'staff:alice': 'alice', 'Alice@x': 'alice', 'staff:bob': 'bob', 'staff:carol': 'carol' })
    : new RuleStaffDirectory();
  const auditStore = a ? new ArrayAuditStore() : new SeqMapAuditStore();
  let tick = 0;
  const clock = (): string => {
    tick += 1;
    return `2026-10-07T10:00:${String(tick).padStart(2, '0')}Z`;
  };
  const audit = over.audit ?? new AuditLog(auditStore, clock);
  const deps: OpsDeps = {
    cases,
    consent: over.consent ?? consentStore,
    ledger: over.ledger ?? ledgerStore,
    staff,
    payments,
    control,
    audit,
    clock,
    config: { decisionPathEnabled: true, lossAccount: LOSS, ...over.config },
  };
  const queue = new OpsQueue(deps);
  return { queue, cases, consentStore, ledgerStore, payments, control, staff, auditStore, audit, deps, variant };
}
export type Rig = ReturnType<typeof makeRig>;

export function openInput(over: Partial<OpenCaseInput> = {}): OpenCaseInput {
  return {
    kind: 'REQUOTE',
    reason: 'RATE_EXPIRED',
    subject: 'quote-1',
    paymentId: PAY,
    clientUid: CLIENT,
    amounts: null,
    options: [OPT.requote(), OPT.refundP6(), OPT.writeOff()],
    evidenceRefs: EV,
    ...over,
  };
}

export function req(caseId: string, action: OpsActionRequest['action'], optionId: string, over: Partial<OpsActionRequest> = {}): OpsActionRequest {
  return { caseId, action, optionId, approvers: [ALICE, BOB], reason: 'operator reviewed', evidenceRefs: EV, consentRef: null, confirmedDigests: [AUTO, AUTO], ...over };
}

const AUTO = '(auto)';

/** Runs an action with each approver confirming the stored option digest, unless the request sets its own digests. */
export async function exec(rig: Rig, r: OpsActionRequest, queue: OpsQueue = rig.queue) {
  const got = await rig.cases.get(r.caseId);
  const opt = got.kind === 'OK' ? got.value.options.find((o) => o.optionId === r.optionId && o.action === r.action) : undefined;
  const auto = r.confirmedDigests[0] === AUTO && r.confirmedDigests[1] === AUTO && opt !== undefined;
  return queue.execute(auto ? { ...r, confirmedDigests: [opt.digest, opt.digest] } : r);
}

/** Opens a case and returns its record (throws if refused). */
export async function open(rig: Rig, over: Partial<OpenCaseInput> = {}) {
  const r = await rig.queue.openCase(openInput(over));
  if (r.kind !== 'OK') throw new Error(`open refused: ${JSON.stringify(r)}`);
  return r.value;
}

/** Grants a consent bound to the exact option of the case. */
export function grantConsent(rig: Rig, ref: string, c: { caseId: string; clientUid: string; paymentId: string; options: readonly { optionId: string; digest: string }[] }, optionId: string, clientUid = c.clientUid): void {
  const o = c.options.find((x) => x.optionId === optionId);
  if (o === undefined) throw new Error('no option');
  rig.consentStore.grant(ref, { clientUid, paymentId: c.paymentId, caseId: c.caseId, digest: o.digest });
}
