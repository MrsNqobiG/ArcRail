/**
 * HTTP edge for D1 payments (docs/NOVA_ARC_DESIGN.md §10.1, §10.5). Framework-agnostic: plain request in,
 * `{ status, body }` out; the web framework adapter is Nova's.
 *
 *   POST /payments        header Idempotency-Key, body { beneficiaryRef, amount }
 *   GET  /payments/:id    -> { id, status, stage, reason, payIn, payout, amount, fee, legs[], network, version }
 *
 * Binding: the payer's account, the payout method, the destination and the sending wallet come from the
 * authenticated principal, the receiver port and the wallet registry, never from the body. The body carries only
 * the beneficiary reference and the amount as a decimal string. Amounts leave as decimal strings (formatCbsMinor).
 */
import { formatCbsMinor } from '../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../amounts/index.js';
import { beneficiaryRef, isPaymentId } from '../nova-ports/ids.js';
import type { NovaAccountRef, NovaOwnerRef, PaymentId } from '../nova-ports/ids.js';
import type { PaymentRecord } from '../nova-ports/payment-store.js';
import { STATUS_BY_STAGE } from '../status/index.js';
import type { Stage } from '../status/index.js';
import { isClientIdempotencyKey } from '../payments/keys.js';
import type { CreateRefusal, PaymentOrchestrator } from '../payments/orchestrator.js';
import { PaymentFault } from '../payments/orchestrator.js';
import { parseDecimalAmount } from './amount.js';

export type Principal =
  | { readonly kind: 'PAYER'; readonly owner: NovaOwnerRef; readonly account: NovaAccountRef }
  /** Nova staff roles may read any payment (A-35); they never create one here. */
  | { readonly kind: 'STAFF' };

export interface HttpResponse {
  readonly status: 200 | 201 | 400 | 403 | 404 | 409 | 422 | 500 | 503;
  readonly body: unknown;
}

export interface PaymentsHttpDeps {
  readonly orchestrator: Pick<PaymentOrchestrator, 'create' | 'advance'>;
  readonly read: (id: PaymentId) => Promise<PaymentRecord | null | 'UNAVAILABLE'>;
  readonly precision: CbsPrecision;
  /** Explorer link for a transaction hash, or null. The tx path format is not in docs/constants.md (only the C-06 base), so it is configured, never assumed. */
  readonly explorerTxUrl?: (txHash: string) => string | null;
}

const fail = (status: HttpResponse['status'], code: string, message: string): HttpResponse => ({ status, body: { error: { code, message } } });

const REFUSAL_STATUS: Readonly<Record<CreateRefusal, HttpResponse['status']>> = {
  BENEFICIARY_UNKNOWN: 404,
  BENEFICIARY_INACTIVE: 422,
  NO_PAYOUT_PREFERENCE: 422,
  PREFERENCE_INVALID: 422,
  METHOD_NOT_ENABLED: 422,
  NO_HOT_WALLET: 503,
  AMOUNT_NOT_REPRESENTABLE: 400,
  KEY_CONFLICT: 409,
};

function text(m: CbsMinor, p: CbsPrecision): string {
  const d = formatCbsMinor(m, p);
  // p > 6 would hide minor units; D1 runs at USDC's 6 places. Refuse to show a rounded amount.
  if (d.hiddenMinor !== 0n) throw new PaymentFault('PRECISION', 'amount cannot be shown exactly at 6 places');
  return d.text;
}

export function paymentView(rec: PaymentRecord, p: CbsPrecision, explorer: PaymentsHttpDeps['explorerTxUrl']): unknown {
  return {
    id: rec.paymentId,
    status: rec.status,
    stage: rec.stage,
    reason: rec.reason,
    payIn: rec.payIn,
    payout: rec.payout,
    amount: text(rec.amount, p),
    fee: text(rec.fee, p),
    legs: rec.legs.map((l) => ({
      kind: l.kind,
      stage: l.stage,
      reason: l.reason,
      status: STATUS_BY_STAGE[l.stage as Stage],
      txHash: l.txHash,
      explorerUrl: l.txHash === null || explorer === undefined ? null : explorer(l.txHash),
    })),
    network: rec.binding.network,
    version: rec.version.toString(10),
  };
}

/** POST /payments. 201 on a new payment, 200 on a replay of the same request, 409 on the same key with a different request. */
export async function createPaymentHandler(
  deps: PaymentsHttpDeps,
  req: { readonly principal: Principal | null; readonly idempotencyKey: string | undefined; readonly body: unknown },
): Promise<HttpResponse> {
  if (req.principal === null) return fail(403, 'UNAUTHENTICATED', 'sign in required');
  if (req.principal.kind !== 'PAYER') return fail(403, 'FORBIDDEN', 'only a payer creates a payment');
  const key = req.idempotencyKey;
  if (key === undefined || !isClientIdempotencyKey(key)) return fail(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key must be 1 to 255 printable ASCII characters');
  const body = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'BODY_INVALID', 'body must be an object');
  const fields = body as Record<string, unknown>;
  // Only these two fields are read. Anything else (payer, account, wallet, destination, fee) is ignored, never echoed or used.
  const ref = fields['beneficiaryRef'];
  if (typeof ref !== 'string' || !/^\S{1,255}$/.test(ref)) return fail(400, 'BENEFICIARY_INVALID', 'beneficiaryRef must be a non-empty string without spaces');
  const amount = parseDecimalAmount(fields['amount'], deps.precision);
  if (!amount.ok) return fail(400, 'AMOUNT_INVALID', amount.reason);
  try {
    const out = await deps.orchestrator.create({ payer: req.principal.owner, payerAccount: req.principal.account, clientKey: key, beneficiaryRef: beneficiaryRef(ref), amount: amount.minor });
    if (out.kind === 'RETRY') return fail(503, 'TRY_AGAIN', 'outcome unknown; repeat the same request with the same Idempotency-Key');
    if (out.kind === 'REFUSED') return fail(REFUSAL_STATUS[out.code], out.code, out.detail);
    const advanced = await deps.orchestrator.advance(out.record.paymentId);
    return { status: out.replayed ? 200 : 201, body: paymentView(advanced.record, deps.precision, deps.explorerTxUrl) };
  } catch (e) {
    if (e instanceof PaymentFault) return fail(500, 'PAYMENT_FAULT', e.code);
    throw e;
  }
}

/** GET /payments/:id. Only the payer (and staff) may read it; anyone else gets 404, so existence is not disclosed. */
export async function getPaymentHandler(deps: PaymentsHttpDeps, req: { readonly principal: Principal | null; readonly id: string }): Promise<HttpResponse> {
  if (req.principal === null) return fail(403, 'UNAUTHENTICATED', 'sign in required');
  if (!isPaymentId(req.id)) return fail(404, 'NOT_FOUND', 'no such payment');
  const rec = await deps.read(req.id as PaymentId);
  if (rec === 'UNAVAILABLE') return fail(503, 'TRY_AGAIN', 'store unavailable');
  if (rec === null || (req.principal.kind === 'PAYER' && rec.payer !== req.principal.owner)) return fail(404, 'NOT_FOUND', 'no such payment');
  return { status: 200, body: paymentView(rec, deps.precision, deps.explorerTxUrl) };
}
