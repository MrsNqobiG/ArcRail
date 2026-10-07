/**
 * JORCH thin adapters onto the real unit interfaces that now exist. Each maps a
 * closed result union onto the orchestrator's own closed union, field by field;
 * nothing is invented and an unknown shape fails closed.
 *  - OPS (src/ops): `CasePort` over `OpsQueue.openCase`; the server-side options
 *    come from `toInput` (trusted composition-root code, never an operator).
 *  - JPAYIN (src/journey/payin): `PayInPort` over JPAYIN's `PayInPort.settle`;
 *    the expectation is built server-side from the payment by `expectationOf`.
 *  - OPS: `DecisionPort` is `OpsQueue.getCase` as is (`opsDecisions` proves it at compile time).
 */
import type { OpenCaseInput, OpsCode, OpsQueue } from '../../ops/queue.js';
import type { CaseRecord } from '../../ops/types.js';
import type { PortResult } from '../../nova-ports/ids.js';
import type { PayInExpectation, PayInPort as JPayInPort, PayInResult } from '../payin/types.js';
import type { CasePort, DecisionPort, JourneyOrder, OrchPayInResult, PayInPort } from './ports.js';

export type CaseOpenRequest = Parameters<CasePort['open']>[0];

/** A refused or ambiguous open is a null case id: the journey stays held and the next advance tries again. */
export function opsCasePort(queue: { openCase(input: OpenCaseInput): Promise<PortResult<CaseRecord, OpsCode>> }, toInput: (req: CaseOpenRequest) => OpenCaseInput): CasePort {
  return {
    open: async (req) => {
      const r = await queue.openCase(toInput(req));
      return { caseId: r.kind === 'OK' ? r.value.caseId : null };
    },
  };
}

export function fromJPayIn(r: PayInResult): OrchPayInResult {
  switch (r.kind) {
    case 'PENDING':
      return { kind: 'PENDING' };
    case 'EXPIRED':
      return { kind: 'EXPIRED' };
    case 'CONFIRMED':
      return { kind: 'CONFIRMED', amount: r.amount, evidenceRef: r.evidenceRef };
    case 'HELD':
      return { kind: 'HELD', reason: r.reason, caseId: r.caseId, caseKind: r.caseKind };
    case 'FAILED_CLOSED':
      return { kind: 'FAILED_CLOSED', detail: `${r.code}: ${r.detail}` };
  }
}

/** The JPAYIN method must match the journey's pay-in; a mismatch fails closed (never settles on the wrong rail). */
export function payInFromJPayIn(port: Pick<JPayInPort, 'method' | 'settle'>, expectationOf: (order: JourneyOrder) => PayInExpectation | null): PayInPort {
  return {
    settle: async (order, nowMs) => {
      const want = order.quote.payIn.method === 'FIAT' ? 'FIAT' : 'STABLECOIN';
      if (port.method !== want) return { kind: 'FAILED_CLOSED', detail: 'pay-in port method does not match the journey' };
      const exp = expectationOf(order);
      if (exp === null) return { kind: 'FAILED_CLOSED', detail: 'no server-side pay-in expectation for the payment' };
      if (exp.paymentId !== order.paymentId || exp.clientUid !== order.clientUid || exp.method !== want) return { kind: 'FAILED_CLOSED', detail: 'pay-in expectation belongs to another payment' };
      return fromJPayIn(await port.settle(exp, nowMs));
    },
  };
}

/** The real OPS queue read back as the orchestrator's decision source (no mapping needed: same `CaseRecord`). */
export function opsDecisions(queue: Pick<OpsQueue, 'getCase'>): DecisionPort {
  return { getCase: (caseId) => queue.getCase(caseId) };
}
