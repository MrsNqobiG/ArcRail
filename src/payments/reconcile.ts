/**
 * PAY: reconciliation hooks (docs/NOVA_ARC_DESIGN.md §9.2 chain invariant, §9.3).
 *
 * Chain, per DFNS wallet w:  on-chain wei(w) = GL-2 arc.<w> (minor) × k − GL-4 arc.gasDust.<w> (wei) + GL-2 arc.<w>.subminor (wei).
 * The residual is the chain value minus the right-hand side; 0 means the books agree to the base unit.
 */
import { cbsMinorToNativeWei, cbsMinor } from '../amounts/index.js';
import type { CbsPrecision } from '../amounts/index.js';
import type { LedgerAssetCode, WalletRef } from '../nova-ports/ids.js';
import type { GasDustStore } from '../nova-ports/gas-dust.js';
import type { LedgerPort } from '../nova-ports/ledger.js';
import { CLEARING, walletAccount } from './postings.js';

export interface ReconcileDeps {
  readonly ledger: Pick<LedgerPort, 'getBalance'>;
  readonly dust: Pick<GasDustStore, 'balance'>;
  readonly precision: CbsPrecision;
  readonly asset: LedgerAssetCode;
}

export type ReconcileResult = { readonly kind: 'OK'; readonly residualWei: bigint } | { readonly kind: 'UNAVAILABLE'; readonly detail: string };

/** chainWei − (ledger net asset × k − gas dust + sub-minor). 0n is a clean reconciliation; anything else must PAUSE. */
export async function walletResidual(deps: ReconcileDeps, wallet: WalletRef, chainWei: bigint): Promise<ReconcileResult> {
  const bal = await deps.ledger.getBalance(walletAccount(wallet), deps.asset);
  if (bal.kind !== 'OK') return { kind: 'UNAVAILABLE', detail: `ledger balance ${bal.kind}` };
  const dust = await deps.dust.balance(wallet);
  if (dust.kind !== 'OK') return { kind: 'UNAVAILABLE', detail: `dust balance ${dust.kind}` };
  // GL-2 is debit-normal: net asset = debits − credits, in minor units, then scaled to wei by the one conversion module.
  const net = bal.value.debits - bal.value.credits;
  const negative = net < 0n;
  const wei = cbsMinorToNativeWei(cbsMinor(negative ? -net : net), deps.precision);
  const ledgerWei = (negative ? -wei : wei) - dust.value.gasDustWei + dust.value.subminorWei;
  return { kind: 'OK', residualWei: chainWei - ledgerWei };
}

/** Clearing (GL-5 arc.outbound) is zero for a rail whose payments are all terminal: credits = debits. */
export async function clearingOpen(deps: Pick<ReconcileDeps, 'ledger' | 'asset'>): Promise<bigint | null> {
  const bal = await deps.ledger.getBalance(CLEARING, deps.asset);
  return bal.kind === 'OK' ? bal.value.credits - bal.value.debits : null;
}
