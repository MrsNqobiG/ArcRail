/**
 * Test support: two structurally different in-memory WalletRegistryPort fakes (§7.8).
 *
 * - MapWalletRegistry: Maps keyed by wallet ref, by idempotency key and by
 *   (network, address).
 * - ListWalletRegistry: one array of rows with linear scans, and an address
 *   index rebuilt from the whole array on every write.
 *
 * Both judge registrations with the shared decideRegister and pass the same
 * contract tests (test/contract/ports-wallet-registry.contract.test.ts).
 */
import { normaliseAddress, ok, rejected, walletRef } from '../ids.js';
import type { IdempotencyKey, NetworkAddress, NetworkId, PortResult, WalletRef } from '../ids.js';
import { decideRegister } from '../wallet-registry.js';
import type { NewWallet, RegisterRejectCode, WalletRecord, WalletRegistryPort, WalletRole, WalletView } from '../wallet-registry.js';
import { afterCommit, faultBefore } from './faults.js';
import type { FaultPlan } from './faults.js';

function addressKey(network: NetworkId, address: NetworkAddress): string {
  return `${network}:${address}`;
}

/** Fake A: Maps. */
export class MapWalletRegistry implements WalletRegistryPort {
  readonly #byRef = new Map<string, WalletRecord>();
  readonly #byKey = new Map<string, { readonly canonical: string; readonly record: WalletRecord }>();
  readonly #byAddress = new Map<string, WalletRecord>();
  readonly #faults: FaultPlan | undefined;
  #seq = 0n;

  constructor(faults?: FaultPlan) {
    this.#faults = faults;
  }

  async get(ref: WalletRef): Promise<PortResult<WalletRecord, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'get');
    if (before !== null) return before;
    const w = this.#byRef.get(ref);
    return w === undefined ? rejected('NOT_FOUND', ref) : ok(w, false);
  }

  async findByAddress(network: NetworkId, address: NetworkAddress): Promise<PortResult<WalletRecord | null, never>> {
    const before = faultBefore(this.#faults, 'findByAddress');
    if (before !== null) return before;
    const a = normaliseAddress(address);
    return ok(a === null ? null : (this.#byAddress.get(addressKey(network, a)) ?? null), false);
  }

  async list(network: NetworkId, role?: WalletRole): Promise<PortResult<readonly WalletRecord[], never>> {
    const before = faultBefore(this.#faults, 'list');
    if (before !== null) return before;
    return ok([...this.#byRef.values()].filter((w) => w.network === network && (role === undefined || w.role === role)), false);
  }

  async register(key: IdempotencyKey, w: NewWallet): Promise<PortResult<WalletRecord, RegisterRejectCode>> {
    const before = faultBefore(this.#faults, 'register');
    if (before !== null) return before;
    const view: WalletView = {
      byKey: (k) => this.#byKey.get(k) ?? null,
      byAddress: (n, a) => this.#byAddress.get(addressKey(n, a)) ?? null,
      byOwnerRole: (o, n, r) => [...this.#byKey.values()].find((x) => x.record.owner === o && x.record.network === n && x.record.role === r) ?? null,
    };
    const verdict = decideRegister(key, w, view);
    if ('kind' in verdict) return verdict;
    this.#seq += 1n;
    const record: WalletRecord = { ...verdict.insert, walletRef: walletRef(`mw-${this.#seq}`) };
    this.#byRef.set(record.walletRef, record);
    this.#byKey.set(key, { canonical: verdict.canonical, record });
    this.#byAddress.set(addressKey(record.network, record.address), record);
    return afterCommit(this.#faults, 'register', ok(record, false));
  }
}

interface Row {
  readonly key: IdempotencyKey;
  readonly canonical: string;
  readonly record: WalletRecord;
}

/** Fake B: an array of rows and an address index rebuilt on write. */
export class ListWalletRegistry implements WalletRegistryPort {
  #rows: readonly Row[] = [];
  #addressIndex: ReadonlyMap<string, WalletRecord> = new Map();
  readonly #faults: FaultPlan | undefined;

  constructor(faults?: FaultPlan) {
    this.#faults = faults;
  }

  #rebuild(): void {
    this.#addressIndex = new Map(this.#rows.map((r) => [addressKey(r.record.network, r.record.address), r.record]));
  }

  async get(ref: WalletRef): Promise<PortResult<WalletRecord, 'NOT_FOUND'>> {
    const before = faultBefore(this.#faults, 'get');
    if (before !== null) return before;
    const row = this.#rows.find((r) => r.record.walletRef === ref);
    return row === undefined ? rejected('NOT_FOUND', ref) : ok(row.record, false);
  }

  async findByAddress(network: NetworkId, address: NetworkAddress): Promise<PortResult<WalletRecord | null, never>> {
    const before = faultBefore(this.#faults, 'findByAddress');
    if (before !== null) return before;
    const a = normaliseAddress(address);
    return ok(a === null ? null : (this.#addressIndex.get(addressKey(network, a)) ?? null), false);
  }

  async list(network: NetworkId, role?: WalletRole): Promise<PortResult<readonly WalletRecord[], never>> {
    const before = faultBefore(this.#faults, 'list');
    if (before !== null) return before;
    const out: WalletRecord[] = [];
    for (const r of this.#rows) if (r.record.network === network && (role === undefined || r.record.role === role)) out.push(r.record);
    return ok(out, false);
  }

  async register(key: IdempotencyKey, w: NewWallet): Promise<PortResult<WalletRecord, RegisterRejectCode>> {
    const before = faultBefore(this.#faults, 'register');
    if (before !== null) return before;
    const view: WalletView = {
      byKey: (k) => this.#rows.find((r) => r.key === k) ?? null,
      byAddress: (n, a) => this.#rows.find((r) => r.record.network === n && r.record.address === a)?.record ?? null,
      byOwnerRole: (o, n, role) => this.#rows.find((r) => r.record.owner === o && r.record.network === n && r.record.role === role) ?? null,
    };
    const verdict = decideRegister(key, w, view);
    if ('kind' in verdict) return verdict;
    const record: WalletRecord = { ...verdict.insert, walletRef: walletRef(`lw-${key}`) };
    this.#rows = [...this.#rows, { key, canonical: verdict.canonical, record }];
    this.#rebuild();
    return afterCommit(this.#faults, 'register', ok(record, false));
  }
}
