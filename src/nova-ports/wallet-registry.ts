/**
 * WalletRegistryPort (docs/NOVA_ARC_DESIGN.md §7.4): Nova's `wallets` table.
 *
 * The package creates no wallets and holds no keys: DFNS creates the wallet
 * (custody is the company's existing DFNS org), Nova's table records it, and
 * this port only reads and records rows [A-20, A-21].
 *
 * Testnet only: `custody.dfnsNetwork` is the literal 'ArcTestnet' (DFNS network
 * name, [DF:networks]); adding 'Arc' is a mainnet-gate change (§11). The
 * runtime check in decideRegister refuses anything else, fail closed.
 */
import { normaliseAddress, ok, rejected } from './ids.js';
import type { IdempotencyKey, KeyConflict, NetworkAddress, NetworkId, NovaOwnerRef, PortResult, WalletRef } from './ids.js';

/** CUSTOMER_DEPOSIT from D2. */
export type WalletRole = 'TREASURY_HOT' | 'GAS_FLOAT' | 'CUSTOMER_DEPOSIT';
export type WalletStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface WalletCustody {
  readonly provider: 'DFNS';
  readonly walletId: string;
  readonly dfnsNetwork: 'ArcTestnet';
}

export interface WalletRecord {
  readonly walletRef: WalletRef;
  readonly owner: NovaOwnerRef | 'COMPANY';
  readonly network: NetworkId;
  readonly role: WalletRole;
  /** Lower-case (§7.1) [A-22]. */
  readonly address: NetworkAddress;
  readonly custody: WalletCustody;
  readonly status: WalletStatus;
}

export type NewWallet = Omit<WalletRecord, 'walletRef'>;

export type RegisterRejectCode = KeyConflict | 'ADDRESS_TAKEN' | 'INVALID_ADDRESS' | 'NETWORK_DISABLED' | 'INVALID_CUSTODY';

export interface WalletRegistryPort {
  get(ref: WalletRef): Promise<PortResult<WalletRecord, 'NOT_FOUND'>>;
  /** `address` is normalised to lower case before lookup (§7.1); a malformed address finds nothing. */
  findByAddress(network: NetworkId, address: NetworkAddress): Promise<PortResult<WalletRecord | null, never>>;
  list(network: NetworkId, role?: WalletRole): Promise<PortResult<readonly WalletRecord[], never>>;
  /** D2: records an ARC wallet DFNS created at onboarding; idempotent per key and per (owner, network, role) (§7.4). */
  register(key: IdempotencyKey, w: NewWallet): Promise<PortResult<WalletRecord, RegisterRejectCode>>;
}

function canonicalWallet(w: NewWallet): string {
  return JSON.stringify([w.owner, w.network, w.role, w.address.toLowerCase(), w.custody.provider, w.custody.walletId, w.custody.dfnsNetwork, w.status]);
}

/** What a registry must be able to read to judge a registration. */
export interface WalletView {
  byKey(key: IdempotencyKey): { readonly canonical: string; readonly record: WalletRecord } | null;
  byAddress(network: NetworkId, address: NetworkAddress): WalletRecord | null;
  /** The wallet already recorded for (owner, network, role), if any (§7.4: register is idempotent per that triple). */
  byOwnerRole(owner: NovaOwnerRef | 'COMPANY', network: NetworkId, role: WalletRole): { readonly canonical: string; readonly record: WalletRecord } | null;
}

/** What to insert when a registration is accepted. */
export interface WalletInsert {
  readonly insert: NewWallet;
  readonly canonical: string;
}

/**
 * §7.4 register: replay or key conflict, then address, custody and uniqueness
 * checks, then one wallet per (owner, network, role): the same wallet again
 * replays, another wallet for that triple is KEY_CONFLICT. Returns the final
 * result (replay or refusal), or the row to insert.
 */
export function decideRegister(key: IdempotencyKey, w: NewWallet, view: WalletView): PortResult<WalletRecord, RegisterRejectCode> | WalletInsert {
  const canonical = canonicalWallet(w);
  const prior = view.byKey(key);
  if (prior !== null) {
    return prior.canonical === canonical
      ? ok(prior.record, true)
      : rejected('KEY_CONFLICT', `key ${key} reused with a different wallet`);
  }
  const address = normaliseAddress(w.address);
  if (address === null) return rejected('INVALID_ADDRESS', w.address);
  if (w.custody.dfnsNetwork !== 'ArcTestnet') return rejected('NETWORK_DISABLED', String(w.custody.dfnsNetwork));
  if (w.custody.provider !== 'DFNS' || w.custody.walletId === '') return rejected('INVALID_CUSTODY', 'DFNS wallet id required');
  const sibling = view.byOwnerRole(w.owner, w.network, w.role);
  if (sibling !== null) {
    return sibling.canonical === canonical
      ? ok(sibling.record, true)
      : rejected('KEY_CONFLICT', `${w.owner} already has an ${w.network} ${w.role} wallet (${sibling.record.walletRef})`);
  }
  if (view.byAddress(w.network, address) !== null) return rejected('ADDRESS_TAKEN', address);
  return { insert: { ...w, address }, canonical };
}
