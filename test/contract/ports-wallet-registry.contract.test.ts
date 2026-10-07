/**
 * PORTS unit: WalletRegistryPort contract suite (docs/NOVA_ARC_DESIGN.md §7.4, §11).
 * Runs unchanged against both in-memory fakes; Nova's adapter must pass it too [A-34].
 */
import { describe, expect, it } from 'vitest';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { ListWalletRegistry, MapWalletRegistry } from '../../src/nova-ports/fakes/wallet-fakes.js';
import { idempotencyKey, novaOwnerRef, walletRef } from '../../src/nova-ports/ids.js';
import type { NetworkAddress, PortResult } from '../../src/nova-ports/ids.js';
import type { NewWallet, WalletCustody, WalletRecord, WalletRegistryPort } from '../../src/nova-ports/wallet-registry.js';

type Factory = (faults?: FaultPlan) => WalletRegistryPort;
const FACTORIES: readonly (readonly [string, Factory])[] = [
  ['MapWalletRegistry', (f) => new MapWalletRegistry(f)],
  ['ListWalletRegistry', (f) => new ListWalletRegistry(f)],
];

const lower = `0x${'ab'.repeat(20)}` as NetworkAddress;
const mixed = `0x${'AB'.repeat(20)}` as NetworkAddress;
const hot: NewWallet = {
  owner: 'COMPANY',
  network: 'ARC',
  role: 'TREASURY_HOT',
  address: mixed,
  custody: { provider: 'DFNS', walletId: 'wa-hot', dfnsNetwork: 'ArcTestnet' },
  status: 'ACTIVE',
};
const gas: NewWallet = { ...hot, role: 'GAS_FLOAT', address: `0x${'cd'.repeat(20)}`, custody: { ...hot.custody, walletId: 'wa-gas' } };
const cust: NewWallet = { ...hot, owner: novaOwnerRef('user-1'), role: 'CUSTOMER_DEPOSIT', address: `0x${'ef'.repeat(20)}`, custody: { ...hot.custody, walletId: 'wa-u1' } };
const fake: NewWallet = { ...hot, network: 'FAKENET', address: `0x${'12'.repeat(20)}`, custody: { ...hot.custody, walletId: 'wa-fake' } };
const K = idempotencyKey('wallet:hot');

/** The OK value; also asserts `replayed` (false unless a replay is expected). */
function okValue<T>(r: PortResult<T, string>, replayed = false): T {
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${r.kind}`);
  expect(r.replayed).toBe(replayed);
  return r.value;
}

describe.each(FACTORIES)('WalletRegistryPort contract: %s', (_name, make) => {
  it('records a DFNS-created ArcTestnet wallet with its address lower-cased', async () => {
    const w = make();
    const r = okValue(await w.register(K, hot));
    expect(r).toMatchObject({ owner: 'COMPANY', network: 'ARC', role: 'TREASURY_HOT', address: lower, status: 'ACTIVE', custody: hot.custody });
    expect(await w.get(r.walletRef)).toEqual({ kind: 'OK', value: r, replayed: false });
    expect(await w.get(walletRef('nope'))).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
  });

  it('exactly once: same key and wallet replays; same key, different wallet is KEY_CONFLICT', async () => {
    const w = make();
    const r = okValue(await w.register(K, hot));
    expect(await w.register(K, { ...hot, address: lower })).toEqual({ kind: 'OK', value: r, replayed: true });
    for (const changed of [{ ...hot, status: 'SUSPENDED' as const }, { ...hot, custody: { ...hot.custody, walletId: 'wa-x' } }, { ...hot, role: 'GAS_FLOAT' as const }, gas]) {
      expect(await w.register(K, changed)).toMatchObject({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: 'key wallet:hot reused with a different wallet' });
    }
    expect(okValue(await w.list('ARC'))).toHaveLength(1);
  });

  it('one wallet per (owner, network, role): the same wallet under another key replays; another wallet is KEY_CONFLICT (m7)', async () => {
    const w = make();
    const r = okValue(await w.register(K, hot));
    expect(await w.register(idempotencyKey('wallet:hot-again'), { ...hot, address: lower })).toEqual({ kind: 'OK', value: r, replayed: true });
    expect(await w.register(idempotencyKey('wallet:hot-2'), { ...hot, address: `0x${'99'.repeat(20)}`, custody: { ...hot.custody, walletId: 'wa-hot2' } })).toMatchObject({
      kind: 'REJECTED',
      code: 'KEY_CONFLICT',
      detail: `COMPANY already has an ARC TREASURY_HOT wallet (${r.walletRef})`,
    });
    okValue(await w.register(idempotencyKey('wallet:gas'), gas));
    okValue(await w.register(idempotencyKey('wallet:u1'), cust));
    okValue(await w.register(idempotencyKey('wallet:u2'), { ...cust, owner: novaOwnerRef('user-2'), address: `0x${'98'.repeat(20)}`, custody: { ...hot.custody, walletId: 'wa-u2' } }));
    okValue(await w.register(idempotencyKey('wallet:hot-fake'), fake));
    expect(okValue(await w.list('ARC'))).toHaveLength(4);
  });

  it('an address is registered once per network (case-insensitive): ADDRESS_TAKEN', async () => {
    const w = make();
    okValue(await w.register(K, hot));
    expect(await w.register(idempotencyKey('wallet:dup'), { ...gas, address: lower })).toMatchObject({ kind: 'REJECTED', code: 'ADDRESS_TAKEN', detail: lower });
    expect(await w.register(idempotencyKey('wallet:dup2'), { ...gas, address: mixed })).toMatchObject({ kind: 'REJECTED', code: 'ADDRESS_TAKEN' });
    okValue(await w.register(idempotencyKey('wallet:fake'), { ...fake, address: lower }));
  });

  it('fail closed: malformed address, non-testnet DFNS network, missing DFNS wallet id', async () => {
    const w = make();
    expect(await w.register(K, { ...hot, address: '0x1234' as NetworkAddress })).toMatchObject({ kind: 'REJECTED', code: 'INVALID_ADDRESS' });
    const mainnet = { ...hot.custody, dfnsNetwork: 'Arc' } as unknown as WalletCustody;
    expect(await w.register(K, { ...hot, custody: mainnet })).toMatchObject({ kind: 'REJECTED', code: 'NETWORK_DISABLED', detail: 'Arc' });
    expect(await w.register(K, { ...hot, custody: { ...hot.custody, walletId: '' } })).toMatchObject({ kind: 'REJECTED', code: 'INVALID_CUSTODY', detail: 'DFNS wallet id required' });
    const otherCustody = { ...hot.custody, provider: 'OTHER' } as unknown as WalletCustody;
    expect(await w.register(K, { ...hot, custody: otherCustody })).toMatchObject({ kind: 'REJECTED', code: 'INVALID_CUSTODY' });
    expect(okValue(await w.list('ARC'))).toEqual([]);
  });

  it('findByAddress normalises; another network or a malformed address finds nothing', async () => {
    const w = make();
    const r = okValue(await w.register(K, hot));
    expect(okValue(await w.findByAddress('ARC', mixed))).toEqual(r);
    expect(okValue(await w.findByAddress('ARC', lower))).toEqual(r);
    expect(okValue(await w.findByAddress('FAKENET', lower))).toBeNull();
    expect(okValue(await w.findByAddress('ARC', '0xzz'))).toBeNull();
    expect(okValue(await w.findByAddress('ARC', `0x${'99'.repeat(20)}`))).toBeNull();
  });

  it('list filters by network and optional role, in registration order', async () => {
    const w = make();
    const a = okValue(await w.register(K, hot));
    const b = okValue(await w.register(idempotencyKey('wallet:gas'), gas));
    const c = okValue(await w.register(idempotencyKey('wallet:u1'), cust));
    const d = okValue(await w.register(idempotencyKey('wallet:fake'), fake));
    expect(new Set([a.walletRef, b.walletRef, c.walletRef, d.walletRef]).size).toBe(4);
    expect(okValue(await w.list('ARC'))).toEqual([a, b, c]);
    expect(okValue(await w.list('ARC', 'GAS_FLOAT'))).toEqual([b]);
    expect(okValue(await w.list('ARC', 'CUSTOMER_DEPOSIT'))).toEqual([c]);
    expect(okValue(await w.list('FAKENET'))).toEqual([d]);
    expect(okValue(await w.list('FAKENET', 'GAS_FLOAT'))).toEqual([]);
  });

  it('AMBIGUOUS before commit records nothing; after commit the row exists and a retry replays', async () => {
    const f = new FaultPlan();
    const w = make(f);
    f.arm('register', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await w.register(K, hot)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    expect(okValue(await w.findByAddress('ARC', lower))).toBeNull();
    f.arm('register', 'AFTER_COMMIT', 'TRANSPORT');
    expect(await w.register(K, hot)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    const row = okValue(await w.findByAddress('ARC', lower)) as WalletRecord;
    expect(await w.register(K, hot)).toEqual({ kind: 'OK', value: row, replayed: true });
  });

  it('AMBIGUOUS can be injected before every read', async () => {
    const f = new FaultPlan();
    const w = make(f);
    const r = okValue(await w.register(K, hot));
    for (const [op, call] of [
      ['get', () => w.get(r.walletRef)],
      ['findByAddress', () => w.findByAddress('ARC', lower)],
      ['list', () => w.list('ARC')],
    ] as const) {
      f.arm(op, 'BEFORE_COMMIT', 'UNAVAILABLE');
      expect(await call(), op).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
      expect((await call()).kind, op).toBe('OK');
    }
  });
});
