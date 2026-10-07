/**
 * TEST SUPPORT (not a money path). Two structurally different in-memory fakes
 * for each store port of this unit: `WebhookDeliveryLogPort` (../webhook.ts) and
 * `GatewayStorePort` (../../gateway/index.ts). The "Map" fakes index by key;
 * the "Log" fakes keep one append-only list and answer every query by scanning
 * it (latest entry wins), the way an event-sourced table would. The gateway
 * store fakes share one decision (`decideMarkSubmit`, the §7.3 `markSubmit`
 * rules) and take a `FaultPlan` (ops `getForSubmit`, `markSubmit`,
 * `listActiveHolds`) so AMBIGUOUS is tested before and after a commit.
 */
import { ok, rejected } from '../../nova-ports/ids.js';
import type { PortResult } from '../../nova-ports/ids.js';
import { afterCommit, faultBefore } from '../../nova-ports/fakes/faults.js';
import type { FaultPlan } from '../../nova-ports/fakes/faults.js';
import type { GatewayNonceHold, GatewayPaymentView, GatewayStorePort, MarkSubmitRejectCode, SubmitMarker } from '../../gateway/index.js';
import type { WebhookDeliveryLogPort } from '../webhook.js';

// ---------------------------------------------------------------------------
// WebhookDeliveryLogPort fakes.
// ---------------------------------------------------------------------------

export class MapDeliveryLog implements WebhookDeliveryLogPort {
  private readonly events = new Map<string, string>();
  private readonly marks = new Map<string, { rank: bigint; status: string }>();

  async eventDigest(eventId: string): Promise<string | null> {
    return this.events.get(eventId) ?? null;
  }

  async recordEvent(eventId: string, digest: string): Promise<void> {
    if (!this.events.has(eventId)) this.events.set(eventId, digest);
  }

  async highWater(transferId: string): Promise<{ rank: bigint; status: string } | null> {
    return this.marks.get(transferId) ?? null;
  }

  async raiseHighWater(transferId: string, rank: bigint, status: string): Promise<void> {
    const before = this.marks.get(transferId);
    if (before === undefined || rank > before.rank) this.marks.set(transferId, { rank, status });
  }
}

type DeliveryEntry = { readonly t: 'EVENT'; readonly eventId: string; readonly digest: string } | { readonly t: 'MARK'; readonly transferId: string; readonly rank: bigint; readonly status: string };

export class LogDeliveryLog implements WebhookDeliveryLogPort {
  readonly log: DeliveryEntry[] = [];

  async eventDigest(eventId: string): Promise<string | null> {
    const e = this.log.find((x): x is Extract<DeliveryEntry, { t: 'EVENT' }> => x.t === 'EVENT' && x.eventId === eventId);
    return e?.digest ?? null;
  }

  async recordEvent(eventId: string, digest: string): Promise<void> {
    if ((await this.eventDigest(eventId)) === null) this.log.push({ t: 'EVENT', eventId, digest });
  }

  async highWater(transferId: string): Promise<{ rank: bigint; status: string } | null> {
    let best: { rank: bigint; status: string } | null = null;
    for (const e of this.log) if (e.t === 'MARK' && e.transferId === transferId && (best === null || e.rank > best.rank)) best = { rank: e.rank, status: e.status };
    return best;
  }

  async raiseHighWater(transferId: string, rank: bigint, status: string): Promise<void> {
    const before = await this.highWater(transferId);
    if (before === null || rank > before.rank) this.log.push({ t: 'MARK', transferId, rank, status });
  }
}

// ---------------------------------------------------------------------------
// GatewayStorePort fakes.
// ---------------------------------------------------------------------------

const TERMINAL = ['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'];

/** Markers are equal when they commit the same externalId and the same body bytes. */
export function sameMarker(a: SubmitMarker, b: SubmitMarker): boolean {
  return a.externalId === b.externalId && a.bodyDigest.toLowerCase() === b.bodyDigest.toLowerCase();
}

/**
 * §7.3 `markSubmit`, shared by both fakes: idempotent for an equal marker, MARKER_CONFLICT for a
 * different one, then the version check, then LEG_TERMINAL for a terminal leg or payment or a
 * pending P6. Returns the record to store, or the final result.
 */
export function decideMarkSubmit(
  v: GatewayPaymentView | null,
  expectedVersion: bigint,
  marker: SubmitMarker,
): { readonly store: GatewayPaymentView } | PortResult<GatewayPaymentView, MarkSubmitRejectCode> {
  if (v === null) return rejected('NOT_FOUND', 'no such payment');
  const held = v.leg.submit;
  if (held !== null) return sameMarker(held, marker) ? ok(v, true) : rejected('MARKER_CONFLICT', `marker ${held.externalId} already set`);
  if (v.version !== expectedVersion) return rejected('VERSION_CONFLICT', `at version ${v.version}`);
  if (TERMINAL.includes(v.stage) || TERMINAL.includes(v.leg.stage) || v.leg.p6Pending) return rejected('LEG_TERMINAL', `leg ${v.leg.stage}`);
  return { store: { ...v, version: v.version + 1n, leg: { ...v.leg, submit: marker } } };
}

interface Hold extends GatewayNonceHold {
  readonly wallet: string;
}

/** Test-side controls shared by both store fakes. */
export interface GatewayStoreFake extends GatewayStorePort {
  put(view: GatewayPaymentView): void;
  placeHold(wallet: string, holdId: string, dfnsTransferId: string): void;
  liftHold(holdId: string): void;
  current(paymentId: string): GatewayPaymentView | null;
}

export class MapGatewayStore implements GatewayStoreFake {
  private readonly payments = new Map<string, GatewayPaymentView>();
  private readonly holds = new Map<string, Hold>();

  constructor(private readonly faults?: FaultPlan) {}

  put(view: GatewayPaymentView): void {
    this.payments.set(view.paymentId, view);
  }

  current(paymentId: string): GatewayPaymentView | null {
    return this.payments.get(paymentId) ?? null;
  }

  placeHold(wallet: string, holdId: string, dfnsTransferId: string): void {
    this.holds.set(holdId, { wallet, holdId, dfnsTransferId });
  }

  liftHold(holdId: string): void {
    this.holds.delete(holdId);
  }

  async getForSubmit(paymentId: string): Promise<PortResult<GatewayPaymentView, 'NOT_FOUND'>> {
    const f = faultBefore(this.faults, 'getForSubmit');
    if (f !== null) return f;
    const v = this.payments.get(paymentId);
    return v === undefined ? rejected('NOT_FOUND', paymentId) : ok(v, false);
  }

  async markSubmit(paymentId: string, expectedVersion: bigint, marker: SubmitMarker): Promise<PortResult<unknown, MarkSubmitRejectCode>> {
    const f = faultBefore(this.faults, 'markSubmit');
    if (f !== null) return f;
    const d = decideMarkSubmit(this.current(paymentId), expectedVersion, marker);
    if (!('store' in d)) return d;
    this.payments.set(paymentId, d.store);
    return afterCommit(this.faults, 'markSubmit', ok(d.store, false));
  }

  async listActiveHolds(wallet: string): Promise<PortResult<readonly GatewayNonceHold[], never>> {
    const f = faultBefore(this.faults, 'listActiveHolds');
    if (f !== null) return f;
    return ok([...this.holds.values()].filter((h) => h.wallet === wallet).map(({ holdId, dfnsTransferId }) => ({ holdId, dfnsTransferId })), false);
  }
}

type StoreEntry =
  | { readonly t: 'PUT'; readonly view: GatewayPaymentView }
  | { readonly t: 'HOLD'; readonly hold: Hold }
  | { readonly t: 'LIFT'; readonly holdId: string };

export class LogGatewayStore implements GatewayStoreFake {
  readonly log: StoreEntry[] = [];

  constructor(private readonly faults?: FaultPlan) {}

  put(view: GatewayPaymentView): void {
    this.log.push({ t: 'PUT', view });
  }

  current(paymentId: string): GatewayPaymentView | null {
    let v: GatewayPaymentView | null = null;
    for (const e of this.log) if (e.t === 'PUT' && e.view.paymentId === paymentId) v = e.view;
    return v;
  }

  placeHold(wallet: string, holdId: string, dfnsTransferId: string): void {
    this.log.push({ t: 'HOLD', hold: { wallet, holdId, dfnsTransferId } });
  }

  liftHold(holdId: string): void {
    this.log.push({ t: 'LIFT', holdId });
  }

  async getForSubmit(paymentId: string): Promise<PortResult<GatewayPaymentView, 'NOT_FOUND'>> {
    const f = faultBefore(this.faults, 'getForSubmit');
    if (f !== null) return f;
    const v = this.current(paymentId);
    return v === null ? rejected('NOT_FOUND', paymentId) : ok(v, false);
  }

  async markSubmit(paymentId: string, expectedVersion: bigint, marker: SubmitMarker): Promise<PortResult<unknown, MarkSubmitRejectCode>> {
    const f = faultBefore(this.faults, 'markSubmit');
    if (f !== null) return f;
    const d = decideMarkSubmit(this.current(paymentId), expectedVersion, marker);
    if (!('store' in d)) return d;
    this.log.push({ t: 'PUT', view: d.store });
    return afterCommit(this.faults, 'markSubmit', ok(d.store, false));
  }

  async listActiveHolds(wallet: string): Promise<PortResult<readonly GatewayNonceHold[], never>> {
    const f = faultBefore(this.faults, 'listActiveHolds');
    if (f !== null) return f;
    const active: GatewayNonceHold[] = [];
    for (const e of this.log) {
      if (e.t === 'HOLD' && e.hold.wallet === wallet) active.push({ holdId: e.hold.holdId, dfnsTransferId: e.hold.dfnsTransferId });
      if (e.t === 'LIFT') active.splice(0, active.length, ...active.filter((h) => h.holdId !== e.holdId));
    }
    return ok(active, false);
  }
}
