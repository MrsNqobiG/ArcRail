/**
 * PAY: ledger journals P1, P2, P3, P4, P6 (docs/NOVA_ARC_DESIGN.md §9.2). Integer CbsMinor only.
 * Every journal balances (Σ DR = Σ CR) and carries refs to the payment.
 */
import { addCbsMinor, nativeWeiToCbsMinor } from '../amounts/index.js';
import type { CbsMinor, CbsPrecision, NativeWei } from '../amounts/index.js';
import type { Hex32, LedgerAssetCode, NovaAccountRef, WalletRef } from '../nova-ports/ids.js';
import type { JournalRefs, JournalRequest, LedgerAccount, LedgerLeg } from '../nova-ports/ledger.js';
import type { PaymentRecord } from '../nova-ports/payment-store.js';
import { arcLeg } from '../nova-ports/payment-store.js';
import { gasKey, ledgerKey, walletTag } from './keys.js';

export interface PostingConfig {
  readonly precision: CbsPrecision;
  readonly asset: LedgerAssetCode;
  readonly chainId: bigint;
}

export const CLEARING: LedgerAccount = { kind: 'ROLE', role: 'GL-5', sub: 'arc.outbound' };
export const FEE_INCOME: LedgerAccount = { kind: 'ROLE', role: 'GL-6', sub: 'payments' };
export const GAS_EXPENSE: LedgerAccount = { kind: 'ROLE', role: 'GL-3', sub: 'arc' };

/** GL-2 `arc.<w>`: the company USDC asset held in wallet `w` (§9.1). */
export function walletAccount(ref: WalletRef): LedgerAccount {
  return { kind: 'ROLE', role: 'GL-2', sub: `arc.${walletTag(ref)}` };
}

export function customerAccount(ref: NovaAccountRef): LedgerAccount {
  return { kind: 'CUSTOMER', account: ref };
}

const leg = (account: LedgerAccount, side: 'DEBIT' | 'CREDIT', amount: CbsMinor): LedgerLeg => ({ account, side, amount });

function refs(rec: PaymentRecord, txHash: Hex32 | null): JournalRefs {
  return { paymentId: rec.paymentId, network: rec.binding.network, txHash, logIndex: null, dfnsTransferId: arcLeg(rec).externalRef, compensates: null };
}

export function totalReserved(rec: PaymentRecord): CbsMinor {
  return addCbsMinor(rec.amount, rec.fee);
}

/** P1_RESERVE: DR GL-1 payer, CR GL-5 `arc.outbound`, A + F. */
export function p1Reserve(cfg: PostingConfig, rec: PaymentRecord): JournalRequest {
  const total = totalReserved(rec);
  return {
    key: ledgerKey(rec.paymentId, 'p1'),
    template: 'P1_RESERVE',
    asset: cfg.asset,
    precision: cfg.precision,
    legs: [leg(customerAccount(rec.payerAccount), 'DEBIT', total), leg(CLEARING, 'CREDIT', total)],
    refs: refs(rec, null),
  };
}

/** P6_RELEASE: DR GL-5, CR GL-1 payer, A + F (the exact mirror of P1). */
export function p6Release(cfg: PostingConfig, rec: PaymentRecord): JournalRequest {
  const total = totalReserved(rec);
  return {
    key: ledgerKey(rec.paymentId, 'p6'),
    template: 'P6_RELEASE',
    asset: cfg.asset,
    precision: cfg.precision,
    legs: [leg(CLEARING, 'DEBIT', total), leg(customerAccount(rec.payerAccount), 'CREDIT', total)],
    refs: refs(rec, null),
  };
}

/** P2_SETTLE_EXTERNAL: DR GL-5, CR GL-2 `arc.<from>`, A. */
export function p2Settle(cfg: PostingConfig, rec: PaymentRecord, txHash: Hex32): JournalRequest {
  return {
    key: ledgerKey(rec.paymentId, 'p2'),
    template: 'P2_SETTLE_EXTERNAL',
    asset: cfg.asset,
    precision: cfg.precision,
    legs: [leg(CLEARING, 'DEBIT', rec.amount), leg(walletAccount(rec.binding.fromWallet), 'CREDIT', rec.amount)],
    refs: refs(rec, txHash),
  };
}

/** P3_FEE: DR GL-5, CR GL-6 `payments`, F; null when F = 0 (leg omitted). */
export function p3Fee(cfg: PostingConfig, rec: PaymentRecord, txHash: Hex32): JournalRequest | null {
  if (rec.fee <= 0n) return null;
  return {
    key: ledgerKey(rec.paymentId, 'p3'),
    template: 'P3_FEE',
    asset: cfg.asset,
    precision: cfg.precision,
    legs: [leg(CLEARING, 'DEBIT', rec.fee), leg(FEE_INCOME, 'CREDIT', rec.fee)],
    refs: refs(rec, txHash),
  };
}

export interface GasSplit {
  readonly recognisedMinor: CbsMinor;
  readonly dustWei: NativeWei;
}

/** (g, d) = nativeWeiToCbsMinor(G, p): `G = g·k + d`, `0 ≤ d < k`. The one conversion module, no other rounding. */
export function splitGas(gasWei: NativeWei, p: CbsPrecision): GasSplit {
  const s = nativeWeiToCbsMinor(gasWei, p);
  return { recognisedMinor: s.minor, dustWei: s.dustWei };
}

/** P4_GAS: DR GL-3 `arc`, CR GL-2 `arc.<sending wallet>`, g; null when g = 0 (journal omitted). */
export function p4Gas(cfg: PostingConfig, rec: PaymentRecord, txHash: Hex32, recognisedMinor: CbsMinor): JournalRequest | null {
  if (recognisedMinor <= 0n) return null;
  return {
    key: gasKey(cfg.chainId, txHash),
    template: 'P4_GAS',
    asset: cfg.asset,
    precision: cfg.precision,
    legs: [leg(GAS_EXPENSE, 'DEBIT', recognisedMinor), leg(walletAccount(rec.binding.fromWallet), 'CREDIT', recognisedMinor)],
    refs: refs(rec, txHash),
  };
}
