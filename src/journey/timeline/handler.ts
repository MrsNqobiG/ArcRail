/**
 * JTIME: framework-agnostic GET /journeys/:id handler plus the step notifier.
 * Amounts leave as decimal strings built from bigint units (no floats).
 * The stage and TransactionStatus come from src/status (paymentState +
 * toTransactionStatus); this file maps nothing itself.
 */
import { isPaymentId } from '../../nova-ports/ids.js';
import type { NetworkAddress } from '../../nova-ports/ids.js';
import type { PayInMethod, PayoutMethod } from '../../status/journey.js';
import { journeyLegs } from '../../status/journey.js';
import { paymentState, toTransactionStatus } from '../../status/index.js';
import type { LegState, Stage, TransactionStatus } from '../../status/index.js';
import type { Fact } from './facts.js';
import type { Notifier } from './notifier.js';
import { buildTimeline } from './timeline.js';
import type { TimelineStep } from './timeline.js';

export interface AmountRecord {
  readonly code: string;
  readonly units: bigint;
  readonly decimals: number;
}

/** Server-side journey record (the only source of amounts, wallet and methods). */
export interface JourneyRecord {
  readonly paymentId: string;
  readonly ownerRef: string;
  readonly payIn: PayInMethod;
  readonly payout: PayoutMethod;
  /** One state per leg, in journeyLegs order. */
  readonly legs: readonly LegState[];
  readonly compensatedBy: string | null;
  readonly facts: readonly Fact[];
  readonly send: AmountRecord;
  readonly receive: AmountRecord;
  readonly receiverAddress: NetworkAddress | null;
  readonly chainId: number;
}

export interface JourneyReader {
  get(paymentId: string, ownerRef: string): Promise<JourneyRecord | null>;
}

/** Integer bigint to a decimal string. Throws on a bad scale or a negative value. */
export function formatUnits(units: bigint, decimals: number): string {
  if (typeof units !== 'bigint' || units < 0n || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new RangeError('bad amount');
  }
  if (decimals === 0) return units.toString();
  const s = units.toString().padStart(decimals + 1, '0');
  return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}

export interface JourneyView {
  readonly id: string;
  readonly status: TransactionStatus;
  readonly stage: Stage;
  readonly reason: string | null;
  readonly send: { readonly code: string; readonly amount: string };
  readonly receive: { readonly code: string; readonly amount: string };
  readonly timeline: readonly TimelineStep[];
}

/** Build the view. Throws TypeError on an inconsistent record (the handler maps it to 500, fail closed). */
export function viewOf(r: JourneyRecord): JourneyView {
  if (r.legs.length !== journeyLegs(r.payIn, r.payout).length) {
    throw new TypeError('legs do not match journey');
  }
  const state = paymentState(r.legs);
  const status = toTransactionStatus(state, r.compensatedBy);
  return {
    id: r.paymentId,
    status,
    stage: state.stage,
    reason: state.reason,
    send: { code: r.send.code, amount: formatUnits(r.send.units, r.send.decimals) },
    receive: { code: r.receive.code, amount: formatUnits(r.receive.units, r.receive.decimals) },
    timeline: buildTimeline({ payIn: r.payIn, payout: r.payout, receiverAddress: r.receiverAddress, chainId: r.chainId }, r.facts),
  };
}

export interface HttpRequest {
  readonly method: string;
  readonly path: string;
  /** Authenticated caller, set by the framework adapter. */
  readonly callerRef: string | null;
}
export interface HttpResponse {
  readonly status: 200 | 400 | 401 | 404 | 405 | 500;
  readonly body: unknown;
}

const ROUTE = /^\/journeys\/([^/]+)$/;

export function createJourneyHandler(reader: JourneyReader): (req: HttpRequest) => Promise<HttpResponse> {
  return async (req) => {
    const m = ROUTE.exec(req.path);
    if (m === null) return { status: 404, body: { error: 'NOT_FOUND' } };
    if (req.method !== 'GET') return { status: 405, body: { error: 'METHOD_NOT_ALLOWED' } };
    if (req.callerRef === null) return { status: 401, body: { error: 'UNAUTHENTICATED' } };
    const id = m[1] as string;
    if (!isPaymentId(id)) return { status: 400, body: { error: 'BAD_ID' } };
    try {
      const rec = await reader.get(id, req.callerRef);
      // Not found and not yours look the same.
      if (rec === null || rec.ownerRef !== req.callerRef) return { status: 404, body: { error: 'NOT_FOUND' } };
      return { status: 200, body: viewOf(rec) };
    } catch {
      return { status: 500, body: { error: 'INTERNAL' } };
    }
  };
}

/**
 * Notify the owner of each DONE step. Reads money state, never writes it; any
 * notifier failure is reported in the result and nothing else changes.
 */
export async function notifySteps(
  notifier: Notifier,
  rec: JourneyRecord,
  view: JourneyView,
): Promise<readonly { readonly step: string; readonly delivered: boolean }[]> {
  const out: { step: string; delivered: boolean }[] = [];
  for (const s of view.timeline) {
    if (s.state !== 'DONE') continue;
    let delivered = false;
    try {
      const r = await notifier.send({
        key: `ntf:${rec.paymentId}:${s.step.toLowerCase()}`,
        recipientRef: rec.ownerRef,
        paymentId: rec.paymentId,
        step: s.step,
        amount: s.step === 'ARRIVED' ? view.receive.amount : null,
      });
      delivered = r.kind === 'SENT';
    } catch {
      delivered = false;
    }
    out.push({ step: s.step, delivered });
  }
  return out;
}
