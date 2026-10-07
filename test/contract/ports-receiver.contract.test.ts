/**
 * PORTS unit: ReceiverPort contract suite (docs/NOVA_ARC_DESIGN.md §4.1, §7.5a).
 * The receiver picks how they receive (fiat bank account or stablecoin wallet);
 * the package reads it server-side and never picks on their behalf.
 */
import { describe, expect, it } from 'vitest';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { MapReceivers, VersionedReceivers } from '../../src/nova-ports/fakes/receiver-fakes.js';
import type { ReceiverPreference } from '../../src/nova-ports/fakes/receiver-fakes.js';
import { beneficiaryRef, fiatCode, novaOwnerRef } from '../../src/nova-ports/ids.js';
import type { BeneficiaryRef, PortResult } from '../../src/nova-ports/ids.js';
import type { ReceiverPort, ResolvedPayout } from '../../src/nova-ports/receiver.js';

interface Settable extends ReceiverPort {
  set(ref: BeneficiaryRef, pref: ReceiverPreference): void;
}
const FACTORIES: readonly (readonly [string, (faults?: FaultPlan) => Settable])[] = [
  ['MapReceivers', (f) => new MapReceivers(f)],
  ['VersionedReceivers', (f) => new VersionedReceivers(f)],
];

const ben = beneficiaryRef('ben-1');
const ben2 = beneficiaryRef('ben-2');
const ADDR = `0x${'ab'.repeat(20)}` as const;
const walletPref: ReceiverPreference = {
  active: true,
  receiver: novaOwnerRef('user-9'),
  choice: {
    payout: { method: 'STABLECOIN_WALLET', asset: 'USDC', network: 'ARC', beneficiaryRef: ben },
    destination: { kind: 'ADDRESS', network: 'ARC', address: ADDR },
  },
};
const bankPref: ReceiverPreference = {
  active: true,
  receiver: null,
  choice: { payout: { method: 'FIAT_BANK', currency: fiatCode('ZAR'), beneficiaryRef: ben }, destination: { kind: 'BANK', beneficiaryRef: ben } },
};

/** The OK value; also asserts `replayed` (false unless a replay is expected). */
function okValue<T>(r: PortResult<T, string>, replayed = false): T {
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${r.kind}`);
  expect(r.replayed).toBe(replayed);
  return r.value;
}

describe.each(FACTORIES)('ReceiverPort contract: %s', (_name, make) => {
  it('unknown, inactive and no-preference receivers are refused (never defaulted)', async () => {
    const r = make();
    expect(await r.resolvePayout(ben)).toMatchObject({ kind: 'REJECTED', code: 'BENEFICIARY_UNKNOWN' });
    r.set(ben, { ...walletPref, active: false });
    expect(await r.resolvePayout(ben)).toMatchObject({ kind: 'REJECTED', code: 'BENEFICIARY_INACTIVE' });
    r.set(ben, { ...walletPref, choice: null });
    expect(await r.resolvePayout(ben)).toMatchObject({ kind: 'REJECTED', code: 'NO_PAYOUT_PREFERENCE' });
  });

  it('resolves the receiver-chosen stablecoin wallet with its destination and receiver', async () => {
    const r = make();
    r.set(ben, walletPref);
    const out: ResolvedPayout = okValue(await r.resolvePayout(ben));
    expect(out.payout).toEqual(walletPref.choice?.payout);
    expect(out.destination).toEqual({ kind: 'ADDRESS', network: 'ARC', address: ADDR });
    expect(out.receiver).toBe('user-9');
    expect(out.preferenceVersion).not.toBe('');
  });

  it('resolves the receiver-chosen fiat bank account; bank details stay in Nova (ref only)', async () => {
    const r = make();
    r.set(ben, bankPref);
    const out = okValue(await r.resolvePayout(ben));
    expect(out.payout.method).toBe('FIAT_BANK');
    expect(out.destination).toEqual({ kind: 'BANK', beneficiaryRef: ben });
    expect(out.receiver).toBeNull();
  });

  it('a changed preference resolves to the new method with a new version; other receivers are unaffected', async () => {
    const r = make();
    r.set(ben, walletPref);
    r.set(ben2, { ...bankPref, choice: { payout: { ...bankPref.choice!.payout, beneficiaryRef: ben2 }, destination: { kind: 'BANK', beneficiaryRef: ben2 } } });
    const v1 = okValue(await r.resolvePayout(ben));
    r.set(ben, bankPref);
    const v2 = okValue(await r.resolvePayout(ben));
    expect(v2.payout.method).toBe('FIAT_BANK');
    expect(v2.preferenceVersion).not.toBe(v1.preferenceVersion);
    expect(okValue(await r.resolvePayout(ben)).preferenceVersion).toBe(v2.preferenceVersion);
    expect(okValue(await r.resolvePayout(ben2)).payout.beneficiaryRef).toBe(ben2);
  });

  it('an inconsistent record is PREFERENCE_INVALID (fail closed)', async () => {
    const r = make();
    r.set(ben, { ...walletPref, choice: { ...walletPref.choice!, destination: { kind: 'ADDRESS', network: 'FAKENET', address: ADDR } } });
    expect(await r.resolvePayout(ben)).toMatchObject({ kind: 'REJECTED', code: 'PREFERENCE_INVALID' });
    r.set(ben2, walletPref);
    expect(await r.resolvePayout(ben2)).toMatchObject({ kind: 'REJECTED', code: 'PREFERENCE_INVALID', detail: /another beneficiary/ });
  });

  it('AMBIGUOUS can be injected before a read; the next read answers', async () => {
    const f = new FaultPlan();
    const r = make(f);
    r.set(ben, walletPref);
    f.arm('resolvePayout', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await r.resolvePayout(ben)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    expect(okValue(await r.resolvePayout(ben)).payout.method).toBe('STABLECOIN_WALLET');
  });
});
