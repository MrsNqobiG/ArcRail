/**
 * Contract tests for this unit's store ports: both fakes of `WebhookDeliveryLogPort`
 * and both fakes of `GatewayStorePort` (src/dfns/fakes/stores.ts) must pass the
 * same suite. Nova's real implementations are to run it too (A-34).
 */
import { describe, expect, it } from 'vitest';
import { nativeWei } from '../../src/amounts/index.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { type GatewayStoreFake, LogDeliveryLog, LogGatewayStore, MapDeliveryLog, MapGatewayStore } from '../../src/dfns/fakes/stores.js';
import type { WebhookDeliveryLogPort } from '../../src/dfns/webhook.js';
import type { GatewayPaymentView, SubmitMarker } from '../../src/gateway/index.js';

describe.each([
  ['MapDeliveryLog', (): WebhookDeliveryLogPort => new MapDeliveryLog()],
  ['LogDeliveryLog', (): WebhookDeliveryLogPort => new LogDeliveryLog()],
] as const)('WebhookDeliveryLogPort contract: %s', (_n, make) => {
  it('records an event id once and keeps the first digest', async () => {
    const p = make();
    expect(await p.eventDigest('e')).toBeNull();
    await p.recordEvent('e', 'd1');
    await p.recordEvent('e', 'd2');
    expect(await p.eventDigest('e')).toBe('d1');
    expect(await p.eventDigest('f')).toBeNull();
  });
  it('the high-water mark only rises, per transfer', async () => {
    const p = make();
    expect(await p.highWater('x')).toBeNull();
    await p.raiseHighWater('x', 2n, 'Executing');
    await p.raiseHighWater('x', 1n, 'Pending');
    await p.raiseHighWater('x', 2n, 'Other');
    expect(await p.highWater('x')).toEqual({ rank: 2n, status: 'Executing' });
    await p.raiseHighWater('x', 4n, 'Confirmed');
    await p.raiseHighWater('x', 3n, 'Broadcasted');
    expect(await p.highWater('x')).toEqual({ rank: 4n, status: 'Confirmed' });
    expect(await p.highWater('y')).toBeNull();
  });
});

const ADDR = '0x00e3495cf6af59008f22ffaf32d4c92ac33dac47' as const;
const view = (over: Partial<GatewayPaymentView> = {}, leg: Partial<GatewayPaymentView['leg']> = {}): GatewayPaymentView => ({
  paymentId: 'pay-1',
  version: 1n,
  stage: 'CREATED',
  quarantined: false,
  receiver: null,
  leg: { stage: 'CREATED', attempt: 1n, submit: null, externalRef: null, p6Pending: false, ...leg },
  binding: { network: 'ARC', asset: 'USDC', fromWallet: 'w', fromAddress: ADDR, dfnsWalletId: 'wa', to: ADDR, amount: nativeWei(1n), digest: '0x00' },
  ...over,
});
const marker = (externalId = 'nv1-a', bodyDigest: `0x${string}` = '0xaa'): SubmitMarker => ({ externalId, bodyDigest, markedAt: '2026-10-06T00:00:00.000Z', markedAtBlock: 7n });

describe.each([
  ['MapGatewayStore', (f?: FaultPlan): GatewayStoreFake => new MapGatewayStore(f)],
  ['LogGatewayStore', (f?: FaultPlan): GatewayStoreFake => new LogGatewayStore(f)],
] as const)('GatewayStorePort contract: %s', (_n, make) => {
  it('getForSubmit returns the stored record or NOT_FOUND', async () => {
    const s = make();
    expect(await s.getForSubmit('pay-1')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    s.put(view());
    expect(await s.getForSubmit('pay-1')).toEqual({ kind: 'OK', value: view(), replayed: false });
  });
  it('markSubmit commits once, bumps the version, is idempotent for an equal marker and refuses a different one', async () => {
    const s = make();
    expect(await s.markSubmit('pay-1', 1n, marker())).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    s.put(view());
    expect(await s.markSubmit('pay-1', 1n, marker())).toMatchObject({ kind: 'OK', replayed: false });
    expect(s.current('pay-1')).toMatchObject({ version: 2n, leg: { submit: marker() } });
    expect(await s.markSubmit('pay-1', 1n, { ...marker(), markedAt: 'later', markedAtBlock: 9n })).toMatchObject({ kind: 'OK', replayed: true });
    expect(await s.markSubmit('pay-1', 2n, marker('nv1-a', '0xbb'))).toMatchObject({ kind: 'REJECTED', code: 'MARKER_CONFLICT' });
    expect(await s.markSubmit('pay-1', 2n, marker('nv1-b'))).toMatchObject({ kind: 'REJECTED', code: 'MARKER_CONFLICT' });
    expect(s.current('pay-1')?.leg.submit).toEqual(marker());
  });
  it('markSubmit checks the version, then refuses a terminal leg or payment and a pending P6', async () => {
    const s = make();
    s.put(view({ version: 3n }));
    expect(await s.markSubmit('pay-1', 2n, marker())).toMatchObject({ kind: 'REJECTED', code: 'VERSION_CONFLICT' });
    for (const v of [view({}, { stage: 'REJECTED' }), view({ stage: 'EXPIRED' }), view({}, { p6Pending: true }), view({}, { stage: 'COMPLETED' }), view({}, { stage: 'CANCELLED' })]) {
      s.put(v);
      expect(await s.markSubmit('pay-1', 1n, marker()), `${v.stage}/${v.leg.stage}/${String(v.leg.p6Pending)}`).toMatchObject({ kind: 'REJECTED', code: 'LEG_TERMINAL' });
    }
  });
  it('AMBIGUOUS before the commit applies nothing; after the commit the marker is there', async () => {
    const f = new FaultPlan();
    const s = make(f);
    s.put(view());
    f.arm('markSubmit', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await s.markSubmit('pay-1', 1n, marker())).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    expect(s.current('pay-1')?.leg.submit).toBeNull();
    f.arm('markSubmit', 'AFTER_COMMIT', 'TRANSPORT');
    expect(await s.markSubmit('pay-1', 1n, marker())).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    expect(s.current('pay-1')?.leg.submit).toEqual(marker());
    f.arm('getForSubmit', 'BEFORE_COMMIT', 'UNAVAILABLE');
    expect(await s.getForSubmit('pay-1')).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
    f.arm('listActiveHolds', 'BEFORE_COMMIT', 'UNAVAILABLE');
    expect(await s.listActiveHolds('w')).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
  });
  it('lists the active holds of one wallet; a lifted hold is gone', async () => {
    const s = make();
    expect(await s.listActiveHolds('w')).toEqual({ kind: 'OK', value: [], replayed: false });
    s.placeHold('w', 'hold-1', 'xfr-1');
    s.placeHold('w', 'hold-2', 'xfr-2');
    s.placeHold('v', 'hold-3', 'xfr-3');
    expect(await s.listActiveHolds('w')).toMatchObject({ kind: 'OK', value: [{ holdId: 'hold-1', dfnsTransferId: 'xfr-1' }, { holdId: 'hold-2', dfnsTransferId: 'xfr-2' }] });
    s.liftHold('hold-1');
    expect(await s.listActiveHolds('w')).toMatchObject({ kind: 'OK', value: [{ holdId: 'hold-2', dfnsTransferId: 'xfr-2' }] });
    expect(await s.listActiveHolds('v')).toMatchObject({ kind: 'OK', value: [{ holdId: 'hold-3' }] });
  });
});
