/**
 * U5 Address registry. SKELETON: interfaces and stubs only.
 *
 * The address↔customer map is personal information: encrypted, access-logged,
 * never on-chain and never in logs (KICKOFF U5). Deposit addresses are derived
 * via the `Signer` (ADR-006 option A on testnet, G1_PACKET §2a).
 */
import type { Address } from '../chain/config/index.js';

/** CONTRACT §1.2 `walletRole`. */
export type WalletRole = 'hot' | 'gas' | 'collection';

/** Opaque CBS account identifier, never personal data (CONTRACT §1.2, P9.1). */
export type AccountRef = string & { readonly __accountRef: true };

export interface BankWallet {
  readonly role: WalletRole;
  /** Decimal index within the role (CONTRACT §1.2 `walletIndex`). */
  readonly walletIndex: string;
  readonly address: Address;
}

export interface AddressRegistry {
  isBankControlled(address: Address): Promise<boolean>;
  walletFor(address: Address): Promise<BankWallet | null>;
  /** Access-logged lookup of the account a collection address was issued to. */
  accountForCollectionAddress(address: Address): Promise<AccountRef | null>;
}

export function createAddressRegistry(): AddressRegistry {
  throw new Error('not implemented: U5');
}
