/**
 * PAY: adapters that let the F2 SigningGateway read the real PaymentStorePort (§8.4, §7.3).
 * The gateway sees a narrow view; this file builds it from the payment record, never from client input.
 */
import type { GatewayDeps, GatewayNonceHold, GatewayPaymentView, GatewayStorePort, MarkSubmitRejectCode, NetworkPrecheck } from '../gateway/index.js';
import type { NetworkAdapter } from '../network/types.js';
import { ok, rejected } from '../nova-ports/ids.js';
import type { PaymentId, PortResult, WalletRef } from '../nova-ports/ids.js';
import { arcLeg, deriveCaseId, releaseKey } from '../nova-ports/payment-store.js';
import type { CaseKind, PaymentStorePort } from '../nova-ports/payment-store.js';

type Hex = `0x${string}`;

/** Ops case kinds that QUARANTINE one payment (§8.4 check 3 re-POST rules, F-5, F-6, F-18). */
export const QUARANTINE_CASES: readonly CaseKind[] = ['UNRESOLVED_SUBMIT', 'REPLACEMENT', 'STUCK'];

/** NONE: no case. QUARANTINED: an OPEN case and no LIFT_QUARANTINE decision on it. LIFTED: two people lifted it. UNKNOWN: unreadable (counts as quarantined). */
export type CaseState = 'NONE' | 'QUARANTINED' | 'LIFTED' | 'UNKNOWN';

export async function caseState(store: PaymentStorePort, kind: CaseKind, paymentId: string): Promise<CaseState> {
  const c = await store.getCase(deriveCaseId(kind, paymentId));
  if (c.kind === 'REJECTED') return 'NONE';
  if (c.kind !== 'OK') return 'UNKNOWN';
  if (c.value.state !== 'OPEN') return 'LIFTED';
  for (const id of c.value.decisions) {
    const d = await store.getDecision(id);
    if (d.kind === 'AMBIGUOUS') return 'UNKNOWN';
    if (d.kind === 'OK' && d.value.kind === 'LIFT_QUARANTINE') return 'LIFTED';
  }
  return 'QUARANTINED';
}

/** QUARANTINED by an Ops case (any kind above); an unreadable case counts as quarantined (fail closed). */
export async function quarantinedByCase(store: PaymentStorePort, paymentId: string): Promise<boolean> {
  for (const kind of QUARANTINE_CASES) {
    const s = await caseState(store, kind, paymentId);
    if (s === 'QUARANTINED' || s === 'UNKNOWN') return true;
  }
  return false;
}

export function gatewayStoreFor(store: PaymentStorePort): GatewayStorePort {
  return {
    async getForSubmit(paymentId: string): Promise<PortResult<GatewayPaymentView, 'NOT_FOUND'>> {
      const r = await store.get(paymentId as PaymentId);
      if (r.kind !== 'OK') return r;
      const rec = r.value;
      const leg = arcLeg(rec);
      const holds = await store.listActiveHolds(rec.binding.fromWallet);
      if (holds.kind !== 'OK') return { kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' };
      const outbox = await store.pendingOutbox();
      if (outbox.kind !== 'OK') return { kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' };
      const b = rec.binding;
      const byCase = await quarantinedByCase(store, rec.paymentId);
      return ok(
        {
          paymentId: rec.paymentId,
          version: rec.version,
          stage: rec.stage,
          // A payment is quarantined while a nonce hold names it (hash-less Failed, F-3b, F-18) or an Ops case
          // quarantines it (UNRESOLVED_SUBMIT, REPLACEMENT, STUCK) and no LIFT_QUARANTINE decision lifted it (F-6).
          quarantined: byCase || holds.value.some((h) => h.subject === rec.paymentId),
          // D1 never names the receiver to the gateway: a destination the registry knows is refused (fail closed).
          receiver: null,
          leg: { stage: leg.stage, attempt: leg.attempt, submit: leg.submit, externalRef: leg.externalRef, p6Pending: outbox.value.some((o) => o.key === releaseKey(rec.paymentId)) },
          binding: { network: b.network, asset: b.asset, fromWallet: b.fromWallet, fromAddress: b.fromAddress as Hex, dfnsWalletId: b.dfnsWalletId, to: b.to as Hex, amount: b.amount, digest: b.digest as Hex },
        },
        false,
      );
    },
    async markSubmit(paymentId, expectedVersion, marker): Promise<PortResult<unknown, MarkSubmitRejectCode>> {
      const r = await store.markSubmit(paymentId as PaymentId, expectedVersion, { ...marker, bodyDigest: marker.bodyDigest.toLowerCase() as Hex });
      if (r.kind === 'REJECTED' && r.code === 'NOT_READY') return rejected('LEG_TERMINAL', r.detail);
      return r.kind === 'REJECTED' ? { kind: 'REJECTED', code: r.code === 'NOT_READY' ? 'LEG_TERMINAL' : r.code, detail: r.detail } : r;
    },
    async listActiveHolds(wallet: string): Promise<PortResult<readonly GatewayNonceHold[], never>> {
      const r = await store.listActiveHolds(wallet as WalletRef);
      return r.kind === 'OK' ? ok(r.value.map((h) => ({ holdId: h.holdId, dfnsTransferId: h.dfnsTransferId })), false) : r;
    },
  };
}

/** Rail state for the gateway: paused flag from the store, indexer health and agreed head from the network adapter. */
export function gatewayRailFor(store: PaymentStorePort, network: NetworkAdapter): GatewayDeps['rail'] {
  return {
    async getRailState() {
      const rail = await store.getRailState();
      const head = await network.head();
      // An unreadable rail state counts as paused (fail closed).
      const paused = rail.kind !== 'OK' || rail.value.paused;
      return head.kind === 'OK' ? { paused, indexerHealthy: true, agreedHead: head.value.number } : { paused, indexerHealthy: false, agreedHead: null };
    },
  };
}

/** The gateway's network precheck is the network adapter's own (blocklist, reserved destinations, amount). */
export function gatewayPrecheckFor(network: NetworkAdapter): NetworkPrecheck {
  return async (intent) => {
    const r = await network.precheck({ network: network.network, asset: 'USDC', from: intent.from, to: intent.to, amount: intent.amount });
    return r.kind === 'OK' ? { ok: true } : { ok: false, code: r.code };
  };
}
