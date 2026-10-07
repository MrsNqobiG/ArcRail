/**
 * PAY: the D1 payment orchestrator (docs/NOVA_ARC_DESIGN.md §10.1, §12, §13).
 *
 * Network-agnostic: it talks to NetworkAdapter, never to Arc code. Every step is idempotent (deterministic
 * keys, §10.2) and `advance` may be called any number of times for one payment. Money moves only through
 * LedgerPort; the ledger side of a stage change is enqueued in the SAME `applySignal` commit (outbox) and
 * posted by `drainOutbox`, so a crash never leaves a terminal stage without its journal.
 *
 * Rules enforced here:
 *  - Account, amount, recipient and route come from the server-side record and receiver port, never from the client.
 *  - P1 before any DFNS request; P2/P3/P4 only with the COMPLETED signal, which only our own chain read
 *    (ARC_LOG) can carry; P6 only on proof (§8.4 check 3) and only with the signal that fails the payment.
 *  - An unknown DFNS outcome (leg UNRESOLVED) is never ended or released. It is resolved through the submit
 *    marker's externalId: a lookup first, and only when that lookup completes and finds nothing is the SAME bytes
 *    re-sent through the gateway (DFNS answers an existing externalId with the existing entity [DF:idem]).
 *    Never a new externalId, never a new payment.
 *  - Anything unexplained (log differs from the binding, foreign gas payer, DFNS anomaly) pauses or holds; it
 *    never completes and never releases.
 */
import { nativeWei, nativeWeiToUsdcUnits } from '../amounts/index.js';
import type { CbsMinor, CbsPrecision } from '../amounts/index.js';
import type { DfnsClient } from '../dfns/client.js';
import { mapTransferStatus, transferDedupeKey, transferPayloadDigest } from '../dfns/types.js';
import type { DfnsTransfer } from '../dfns/types.js';
import { computeBindingDigest } from '../gateway/index.js';
import type { GatewayOutcome, ProposedTransfer, SigningGateway } from '../gateway/index.js';
import type { ConfirmedTransfer, NetworkAdapter } from '../network/types.js';
import type { GasDustStore } from '../nova-ports/gas-dust.js';
import { lpDigestHex, normaliseHex32 } from '../nova-ports/ids.js';
import type { BeneficiaryRef, Hex32, IdempotencyKey, LedgerAssetCode, NovaAccountRef, NovaOwnerRef } from '../nova-ports/ids.js';
import type { LedgerPort } from '../nova-ports/ledger.js';
import { arcLeg, releaseKey } from '../nova-ports/payment-store.js';
import type { InboundSignal, LegTransition, OutboxItem, PaymentRecord, PaymentStorePort, SignalOutcome, TransferBinding } from '../nova-ports/payment-store.js';
import type { ReceiverPort } from '../nova-ports/receiver.js';
import type { WalletRegistryPort } from '../nova-ports/wallet-registry.js';
import type { LegState, RejectedReason, SignalSource } from '../status/index.js';
import { isNonTerminal } from '../status/index.js';
import { gasKey, ledgerKey, deriveRequestIds } from './keys.js';
import { p1Reserve, p2Settle, p3Fee, p4Gas, p6Release, splitGas } from './postings.js';
import type { PostingConfig } from './postings.js';

export interface PaymentsConfig {
  readonly precision: CbsPrecision;
  readonly asset: LedgerAssetCode;
  /** Pinned Arc testnet chain id (C-01). */
  readonly chainId: bigint;
  readonly transferKind: 'Native' | 'Erc20';
  /** The customer fee F for an amount A, decided server-side (the quote). Default: no fee. */
  readonly feeFor?: (amount: CbsMinor) => CbsMinor;
}

export interface PaymentsDeps {
  readonly store: PaymentStorePort;
  readonly ledger: LedgerPort;
  readonly registry: WalletRegistryPort;
  readonly receivers: ReceiverPort;
  readonly network: NetworkAdapter;
  readonly dfns: Pick<DfnsClient, 'getTransfer' | 'findTransferByExternalId'>;
  readonly gateway: Pick<SigningGateway, 'submit'>;
  readonly dust: GasDustStore;
}

export interface CreateInput {
  readonly payer: NovaOwnerRef;
  readonly payerAccount: NovaAccountRef;
  /** The client's Idempotency-Key (1 to 255 printable ASCII). */
  readonly clientKey: string;
  readonly beneficiaryRef: BeneficiaryRef;
  readonly amount: CbsMinor;
}

export type CreateRefusal =
  | 'BENEFICIARY_UNKNOWN'
  | 'BENEFICIARY_INACTIVE'
  | 'NO_PAYOUT_PREFERENCE'
  | 'PREFERENCE_INVALID'
  | 'METHOD_NOT_ENABLED'
  | 'NO_HOT_WALLET'
  | 'AMOUNT_NOT_REPRESENTABLE'
  | 'KEY_CONFLICT';

export type CreateOutcome =
  | { readonly kind: 'OK'; readonly record: PaymentRecord; readonly replayed: boolean }
  | { readonly kind: 'REFUSED'; readonly code: CreateRefusal; readonly detail: string }
  /** A port outcome is unknown. Nothing was decided; repeat the same request (same key) to resolve it. */
  | { readonly kind: 'RETRY'; readonly detail: string };

export interface StepResult {
  readonly record: PaymentRecord;
  readonly changed: boolean;
  readonly note: string;
}

/** A port refused something the orchestrator cannot continue past (fail closed). */
export class PaymentFault extends Error {
  override readonly name = 'PaymentFault';
  constructor(
    readonly code: string,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

type Applied = { readonly record: PaymentRecord; readonly outcome: SignalOutcome | 'REFUSED' | 'AMBIGUOUS'; readonly detail: string };

const ARC = 'ARC_TRANSFER' as const;

function digestOf(fields: readonly string[]): Hex32 {
  return `0x${lpDigestHex(fields)}`;
}

export class PaymentOrchestrator {
  private readonly posting: PostingConfig;

  constructor(
    private readonly cfg: PaymentsConfig,
    private readonly d: PaymentsDeps,
  ) {
    if (cfg.chainId !== 5042002n) throw new PaymentFault('CHAIN_ID', 'chainId must be Arc testnet 5042002 (C-01): testnet only');
    this.posting = { precision: cfg.precision, asset: cfg.asset, chainId: cfg.chainId };
  }

  // -------------------------------------------------------------------------------------------------
  // Create (idempotent per payer + client key).
  // -------------------------------------------------------------------------------------------------

  async create(input: CreateInput): Promise<CreateOutcome> {
    const ids = deriveRequestIds(input.payer, input.clientKey);
    const requestDigest = digestOf(['nv1-request-digest', input.payerAccount, input.beneficiaryRef, input.amount.toString(10)]);
    const prior = await this.d.store.getByRequestKey(input.payer, ids.requestKey);
    if (prior.kind !== 'OK') return { kind: 'RETRY', detail: 'request lookup outcome unknown' };
    if (prior.value !== null) {
      // The record is the truth: the same key with the same request returns it, a different request is a conflict.
      if (prior.value.requestDigest !== requestDigest) return { kind: 'REFUSED', code: 'KEY_CONFLICT', detail: 'idempotency key reused with a different request' };
      return { kind: 'OK', record: prior.value, replayed: true };
    }

    const resolved = await this.d.receivers.resolvePayout(input.beneficiaryRef);
    if (resolved.kind === 'AMBIGUOUS') return { kind: 'RETRY', detail: `receiver lookup ${resolved.cause}` };
    if (resolved.kind === 'REJECTED') return { kind: 'REFUSED', code: resolved.code, detail: resolved.detail };
    const payout = resolved.value;
    const dest = payout.destination;
    if (payout.payout.method !== 'STABLECOIN_WALLET' || dest.kind !== 'ADDRESS') return { kind: 'REFUSED', code: 'METHOD_NOT_ENABLED', detail: 'D1 pays STABLECOIN_WALLET receivers only' };
    if (dest.network !== this.d.network.network || payout.payout.network !== this.d.network.network) {
      return { kind: 'REFUSED', code: 'METHOD_NOT_ENABLED', detail: `payout network ${payout.payout.network} is not ${this.d.network.network}` };
    }

    const wallets = await this.d.registry.list(this.d.network.network, 'TREASURY_HOT');
    if (wallets.kind !== 'OK') return { kind: 'RETRY', detail: 'wallet registry outcome unknown' };
    const hot = wallets.value.filter((w) => w.status === 'ACTIVE' && w.owner === 'COMPANY');
    const wallet = hot[0];
    if (wallet === undefined || hot.length !== 1) return { kind: 'REFUSED', code: 'NO_HOT_WALLET', detail: 'exactly one ACTIVE company TREASURY_HOT wallet is required' };

    let wei;
    try {
      wei = this.d.network.toNetworkAmount(input.amount, this.cfg.precision);
    } catch {
      return { kind: 'REFUSED', code: 'AMOUNT_NOT_REPRESENTABLE', detail: 'amount is not representable on this network' };
    }
    const fee = this.cfg.feeFor === undefined ? (0n as CbsMinor) : this.cfg.feeFor(input.amount);
    const base = { network: this.d.network.network, asset: 'USDC' as const, fromWallet: wallet.walletRef, fromAddress: wallet.address, dfnsWalletId: wallet.custody.walletId, to: dest.address, amount: wei };
    const binding: TransferBinding = { ...base, digest: computeBindingDigest(ids.paymentId, base) as Hex32 };

    const created = await this.d.store.create({
      paymentId: ids.paymentId,
      requestKey: ids.requestKey,
      requestDigest,
      payer: input.payer,
      payerAccount: input.payerAccount,
      payIn: { method: 'STABLECOIN_BALANCE', asset: 'USDC', network: this.d.network.network },
      payout: payout.payout,
      beneficiaryRef: input.beneficiaryRef,
      payoutPreferenceVersion: payout.preferenceVersion,
      amount: input.amount,
      fee,
      quoteId: null,
      binding,
      legs: ['RESERVE', ARC],
    });
    if (created.kind === 'AMBIGUOUS') return { kind: 'RETRY', detail: `create ${created.cause}` };
    if (created.kind === 'REJECTED') return { kind: 'REFUSED', code: 'KEY_CONFLICT', detail: created.detail };
    return { kind: 'OK', record: created.value, replayed: created.replayed };
  }

  // -------------------------------------------------------------------------------------------------
  // Advance: one step at a time until nothing changes.
  // -------------------------------------------------------------------------------------------------

  async advance(id: PaymentRecord['paymentId']): Promise<StepResult> {
    let last = await this.step(id);
    for (let i = 0n; last.changed && i < 16n; i += 1n) last = await this.step(id);
    return last;
  }

  async step(id: PaymentRecord['paymentId']): Promise<StepResult> {
    const got = await this.d.store.get(id);
    if (got.kind !== 'OK') throw new PaymentFault('STORE', `get ${id}: ${got.kind}`);
    const rec = got.value;
    await this.drainOutbox();
    if (!isNonTerminal(rec.stage)) return { record: rec, changed: false, note: 'terminal' };
    const reserve = rec.legs.find((l) => l.kind === 'RESERVE');
    if (reserve !== undefined && reserve.stage === 'CREATED') return this.reserveStep(rec);
    const arc = arcLeg(rec);
    if (arc.externalRef === null) return this.submitStep(rec);
    if (arc.txHash !== null && (arc.stage === 'SUBMITTED' || arc.stage === 'CONFIRMING')) return this.chainStep(rec);
    return this.dfnsStep(rec);
  }

  // ---- RESERVE (P1) --------------------------------------------------------------------------------

  private async reserveStep(rec: PaymentRecord): Promise<StepResult> {
    // Checks that need no money: they end the Arc leg before P1, so there is nothing to release.
    const refusal = await this.preReserveRefusal(rec);
    if (refusal === 'WAIT') return { record: rec, changed: false, note: 'BLOCKLIST_STALE: waiting' };
    if (refusal !== null) {
      const a = await this.apply(rec, 'INTERNAL', `internal:pay:${rec.paymentId}:${refusal.toLowerCase()}`, { leg: ARC, to: { stage: 'REJECTED', reason: refusal } }, []);
      return this.result(a, refusal);
    }
    const posted = await this.d.ledger.postJournal(p1Reserve(this.posting, rec));
    if (posted.kind === 'AMBIGUOUS') {
      const back = await this.d.ledger.getJournalByKey(ledgerKey(rec.paymentId, 'p1'));
      if (back.kind !== 'OK' || back.value === null) return { record: rec, changed: false, note: 'P1 outcome unknown: resolve by key' };
    } else if (posted.kind === 'REJECTED') {
      if (posted.code !== 'INSUFFICIENT_FUNDS') throw new PaymentFault('LEDGER', `P1 refused: ${posted.code} ${posted.detail}`);
      const a = await this.apply(rec, 'LEDGER', `ledger:pay:${rec.paymentId}:p1:insufficient`, { leg: 'RESERVE', to: { stage: 'REJECTED', reason: 'INSUFFICIENT_FUNDS' } }, []);
      return this.result(a, 'INSUFFICIENT_FUNDS');
    }
    const a = await this.apply(rec, 'LEDGER', `ledger:pay:${rec.paymentId}:p1`, { leg: 'RESERVE', to: { stage: 'COMPLETED', reason: null } }, []);
    return this.result(a, 'RESERVED');
  }

  private async preReserveRefusal(rec: PaymentRecord): Promise<RejectedReason | 'WAIT' | null> {
    const b = rec.binding;
    // A destination the registry knows is a Nova or company wallet; P2I (internal settle) is not built, so refuse (fail closed).
    const known = await this.d.registry.findByAddress(b.network, b.to);
    if (known.kind !== 'OK') return 'WAIT';
    if (known.value !== null) return 'DESTINATION_NOT_ALLOWED';
    const pre = await this.d.network.precheck({ network: b.network, asset: b.asset, from: b.fromAddress, to: b.to, amount: b.amount });
    if (pre.kind === 'OK') return null;
    if (pre.code === 'SENDER_BLOCKLISTED' || pre.code === 'RECIPIENT_BLOCKLISTED') return 'BLOCKLISTED_PRECHECK';
    if (pre.code === 'BLOCKLIST_STALE') return 'WAIT';
    return 'DESTINATION_NOT_ALLOWED';
  }

  // ---- ARC leg: submit through the gateway ---------------------------------------------------------

  private proposed(rec: PaymentRecord): ProposedTransfer {
    const b = rec.binding;
    if (this.cfg.transferKind === 'Native') return { kind: 'NATIVE', chainId: this.cfg.chainId, to: b.to, amount: b.amount };
    const u = nativeWeiToUsdcUnits(b.amount);
    return { kind: 'ERC20', chainId: this.cfg.chainId, token: '0x3600000000000000000000000000000000000000', to: b.to, amount: u.units };
  }

  private async submitStep(rec: PaymentRecord): Promise<StepResult> {
    const leg = arcLeg(rec);
    if (leg.submit !== null) {
      // UNRESOLVED: a DFNS request may exist. Resolve through the marker's externalId before anything else.
      const found = await this.d.dfns.findTransferByExternalId(rec.binding.dfnsWalletId, leg.submit.externalId);
      if (found.kind === 'OK' && found.value !== null) return this.applyDfns(rec, found.value);
      if (found.kind !== 'OK') return { record: rec, changed: false, note: 'UNRESOLVED: lookup by externalId did not complete; no retry' };
      // The lookup completed and shows nothing. Listing absence is not proof either (Q-N21), so the only
      // permitted retry is the gateway's re-POST of the marker's own bytes, which DFNS deduplicates by externalId.
    }
    const out = await this.d.gateway.submit({ paymentId: rec.paymentId, proposed: this.proposed(rec) });
    return this.afterSubmit(rec, out);
  }

  private async afterSubmit(rec: PaymentRecord, out: GatewayOutcome): Promise<StepResult> {
    if (out.kind === 'SUBMITTED') {
      const fresh = await this.reread(rec);
      return this.applyDfns(fresh, out.transfer);
    }
    if (out.kind === 'RETRY_LATER') return { record: await this.reread(rec), changed: false, note: `RETRY_LATER ${out.code}` };
    if (out.kind === 'AMBIGUOUS') return { record: await this.reread(rec), changed: false, note: `UNRESOLVED ${out.detail}` };
    // REFUSED. Only a refusal with no submit marker proves no DFNS request exists, so only then may the leg end.
    const fresh = await this.reread(rec);
    const noRequest = arcLeg(fresh).submit === null;
    const reason = out.code === 'DESTINATION_NOT_ALLOWED' ? 'DESTINATION_NOT_ALLOWED' : out.code === 'NETWORK_PRECHECK' ? this.precheckReason(out.detail) : null;
    if (noRequest && reason !== null) {
      const a = await this.apply(fresh, 'INTERNAL', `internal:pay:${rec.paymentId}:${reason.toLowerCase()}`, { leg: ARC, to: { stage: 'REJECTED', reason } }, this.releaseOutbox(fresh));
      return this.result(a, `REFUSED ${out.code}`);
    }
    return { record: fresh, changed: false, note: `REFUSED ${out.code}${out.quarantine ? ' (quarantine)' : ''}` };
  }

  private precheckReason(code: string): RejectedReason | null {
    if (code === 'SENDER_BLOCKLISTED' || code === 'RECIPIENT_BLOCKLISTED') return 'BLOCKLISTED_PRECHECK';
    if (code === 'BLOCKLIST_STALE') return null;
    return 'DESTINATION_NOT_ALLOWED';
  }

  // ---- ARC leg: DFNS state -------------------------------------------------------------------------

  private async dfnsStep(rec: PaymentRecord): Promise<StepResult> {
    const leg = arcLeg(rec);
    const got = await this.d.dfns.getTransfer(rec.binding.dfnsWalletId, leg.externalRef as string);
    if (got.kind !== 'OK') return { record: rec, changed: false, note: `DFNS read ${got.kind}` };
    return this.applyDfns(rec, got.value);
  }

  private async applyDfns(rec: PaymentRecord, t: DfnsTransfer): Promise<StepResult> {
    const leg = arcLeg(rec);
    const sameEntity = leg.externalRef === null || leg.externalRef === t.id;
    if (leg.submit === null || t.externalId !== leg.submit.externalId || t.walletId !== rec.binding.dfnsWalletId || !sameEntity) {
      await this.d.store.pause(`DFNS transfer ${t.id} does not match payment ${rec.paymentId}`, 'pay-orchestrator');
      return { record: rec, changed: false, note: 'DFNS entity mismatch: rail paused' };
    }
    const m = mapTransferStatus(t, { abortAccepted: false });
    const key = transferDedupeKey(t);
    const dig = transferPayloadDigest(t) as Hex32;
    switch (m.kind) {
      case 'STAGE': {
        const txHash = m.txHash === null ? undefined : normaliseHex32(m.txHash) ?? undefined;
        const a = await this.applySource(rec, 'DFNS_POLL', key, dig, { leg: ARC, to: { stage: m.stage, reason: null }, externalRef: t.id, ...(txHash === undefined ? {} : { txHash }) }, []);
        return this.result(a, `DFNS ${t.status}`);
      }
      case 'NEVER_SIGNED': {
        // Proof (a1): DFNS rejected from Pending. P6 goes with the signal that fails the leg.
        const hold = m.nonceHold === null ? {} : { placeHold: { wallet: rec.binding.fromWallet, dfnsTransferId: t.id, subject: rec.paymentId, nonce: m.nonceHold.nonce, aborted: m.nonceHold.aborted } };
        const a = await this.applySource(rec, 'DFNS_POLL', key, dig, { leg: ARC, to: { stage: m.stage, reason: m.reason } as LegState, externalRef: t.id, ...hold }, this.releaseOutbox(rec));
        return this.result(a, `DFNS ${t.status} (${m.proof})`);
      }
      case 'FAILED_UNPROVEN': {
        // Not proof: nothing released. Record the nonce hold (quarantines the payment and the wallet) at the current stage.
        const to = { stage: leg.stage, reason: null } as LegState;
        const a = await this.applySource(rec, 'DFNS_POLL', key, dig, { leg: ARC, to, externalRef: t.id, placeHold: { wallet: rec.binding.fromWallet, dfnsTransferId: t.id, subject: rec.paymentId, nonce: m.nonceHold.nonce, aborted: false } }, []);
        return { record: a.record, changed: a.record.version !== rec.version, note: `QUARANTINED: ${m.detail}` };
      }
      case 'HOLD_FOR_INDEXER': {
        const txHash = normaliseHex32(m.txHash);
        if (txHash === null) return { record: rec, changed: false, note: 'DFNS txHash malformed' };
        const a = await this.applySource(rec, 'DFNS_POLL', key, dig, { leg: ARC, to: { stage: 'CONFIRMING', reason: null }, externalRef: t.id, txHash }, []);
        return this.result(a, 'DFNS Failed with txHash: the chain decides');
      }
      case 'ANOMALY':
        return { record: rec, changed: false, note: `QUARANTINED: ${m.detail}` };
    }
  }

  // ---- ARC leg: our own chain read decides ---------------------------------------------------------

  private async chainStep(rec: PaymentRecord): Promise<StepResult> {
    const leg = arcLeg(rec);
    const txHash = leg.txHash as Hex32;
    if (leg.stage === 'SUBMITTED') {
      const a = await this.apply(rec, 'INTERNAL', `internal:pay:${rec.paymentId}:confirming`, { leg: ARC, to: { stage: 'CONFIRMING', reason: null } }, []);
      return this.result(a, 'watching the hash');
    }
    const read = await this.d.network.confirmTx(txHash);
    if (read.kind === 'FAILED') {
      const f = read.failure.kind;
      if (f === 'RPC_DISAGREEMENT' || f === 'UNKNOWN_EVENT' || f === 'CURSOR_CONFLICT') await this.d.store.pause(`network read failed: ${f}`, 'pay-orchestrator');
      return { record: rec, changed: false, note: `network read failed: ${f}` };
    }
    const conf = read.value;
    // No receipt yet: wait. A timer never releases (F-4); the operator path is outside this unit.
    if (conf === null) return { record: rec, changed: false, note: 'no receipt yet' };
    const b = rec.binding;
    if (conf.gas.payer !== b.fromAddress) {
      await this.d.store.pause(`gas payer ${conf.gas.payer} is not the sending wallet`, 'pay-orchestrator');
      return { record: rec, changed: false, note: 'gas payer is not our wallet: rail paused' };
    }
    const gasWei = nativeWei(conf.gas.gasUsed * conf.gas.effectiveGasPrice);
    const gasItem = this.gasOutbox(rec, txHash, gasWei);
    if (conf.receiptStatus === 0n) {
      // F-3c: included and reverted. Gas is consumed (P4), the money did not leave: proof by receipt on both sources (P6).
      const a = await this.applySource(rec, 'ARC_LOG', `arc:revert:${this.cfg.chainId}:${txHash}`, digestOf(['nv1-revert', txHash, '0']), { leg: ARC, to: { stage: 'REJECTED', reason: 'ONCHAIN_REVERTED' }, txHash }, [gasItem, ...this.releaseOutbox(rec)]);
      return this.result(a, 'ONCHAIN_REVERTED');
    }
    const match = conf.transfers.filter((x) => x.from === b.fromAddress && x.to === b.to && x.amount === b.amount);
    const [only] = match;
    if (only === undefined || match.length !== 1 || conf.transfers.some((x) => x.from === b.fromAddress && !match.includes(x))) {
      // F-10 / F-11: the chain shows something other than the binding. Never complete, never release.
      await this.d.store.pause(`chain transfer for ${txHash} differs from the binding`, 'pay-orchestrator');
      return { record: rec, changed: false, note: 'binding breach: rail paused' };
    }
    const outbox: OutboxItem[] = [{ key: ledgerKey(rec.paymentId, 'p2'), topic: 'P2', payload: `${rec.paymentId}|${txHash}` }];
    if (rec.fee > 0n) outbox.push({ key: ledgerKey(rec.paymentId, 'p3'), topic: 'P3', payload: `${rec.paymentId}|${txHash}` });
    outbox.push(gasItem);
    const a = await this.applySource(rec, 'ARC_LOG', this.logKey(only), this.logDigest(only), { leg: ARC, to: { stage: 'COMPLETED', reason: null }, txHash }, outbox);
    return this.result(a, 'confirmed on chain');
  }

  private logKey(t: ConfirmedTransfer): string {
    return `arc:${t.chainId}:${t.txHash}:${t.logIndex}`;
  }

  /** §10.3 projection of an Arc log: chain, tx, log index, block, from, to, value, receipt status. */
  private logDigest(t: ConfirmedTransfer): Hex32 {
    return digestOf(['nv1-arc-log', `${t.chainId}`, t.txHash, `${t.logIndex}`, t.blockHash, t.from, t.to, t.amount.toString(10), `${t.receiptStatus}`]);
  }

  // -------------------------------------------------------------------------------------------------
  // Outbox: ledger postings that go with a stage change.
  // -------------------------------------------------------------------------------------------------

  private releaseOutbox(rec: PaymentRecord): OutboxItem[] {
    return [{ key: releaseKey(rec.paymentId), topic: 'P6', payload: rec.paymentId }];
  }

  private gasOutbox(rec: PaymentRecord, txHash: Hex32, gasWei: bigint): OutboxItem {
    return { key: gasKey(this.cfg.chainId, txHash), topic: 'P4', payload: `${rec.paymentId}|${txHash}|${gasWei.toString(10)}` };
  }

  /** Posts every enqueued journal. Idempotent by key; a refused journal pauses the rail (fail closed). */
  async drainOutbox(): Promise<void> {
    const pending = await this.d.store.pendingOutbox();
    if (pending.kind !== 'OK') return;
    for (const item of pending.value) {
      const [idText, txHash, gasText] = item.payload.split('|');
      const got = await this.d.store.get(idText as PaymentRecord['paymentId']);
      if (got.kind !== 'OK') continue;
      const rec = got.value;
      const th = txHash as Hex32;
      const journal =
        item.topic === 'P2' ? p2Settle(this.posting, rec, th) : item.topic === 'P3' ? p3Fee(this.posting, rec, th) : item.topic === 'P6' ? p6Release(this.posting, rec) : null;
      if (item.topic === 'P4') {
        await this.postGas(rec, th, nativeWei(BigInt(gasText as string)), item.key);
        continue;
      }
      if (journal === null) continue;
      await this.post(journal);
    }
  }

  private async post(journal: ReturnType<typeof p6Release>): Promise<void> {
    const r = await this.d.ledger.postJournal(journal);
    if (r.kind === 'REJECTED') {
      await this.d.store.pause(`ledger refused ${journal.template} ${journal.key}: ${r.code}`, 'pay-orchestrator');
      throw new PaymentFault('LEDGER', `${journal.template} ${journal.key}: ${r.code} ${r.detail}`);
    }
  }

  private async postGas(rec: PaymentRecord, txHash: Hex32, gasWei: ReturnType<typeof nativeWei>, key: IdempotencyKey): Promise<void> {
    const split = splitGas(gasWei, this.cfg.precision);
    const journal = p4Gas(this.posting, rec, txHash, split.recognisedMinor);
    if (journal !== null) await this.post(journal);
    if (split.dustWei > 0n) {
      const r = await this.d.dust.record(key, { chainId: this.cfg.chainId, txHash, wallet: rec.binding.fromWallet, gasWei, recognisedMinor: split.recognisedMinor, dustWei: split.dustWei });
      if (r.kind === 'REJECTED') {
        await this.d.store.pause(`gas dust refused for ${txHash}: ${r.code}`, 'pay-orchestrator');
        throw new PaymentFault('DUST', `${txHash}: ${r.code}`);
      }
    }
  }

  // -------------------------------------------------------------------------------------------------
  // applySignal plumbing.
  // -------------------------------------------------------------------------------------------------

  private async reread(rec: PaymentRecord): Promise<PaymentRecord> {
    const r = await this.d.store.get(rec.paymentId);
    return r.kind === 'OK' ? r.value : rec;
  }

  private apply(rec: PaymentRecord, source: SignalSource, dedupeKey: string, t: LegTransition, outbox: readonly OutboxItem[]): Promise<Applied> {
    return this.applySource(rec, source, dedupeKey, digestOf(['nv1-signal', dedupeKey, t.leg, t.to.stage, String(t.to.reason)]), t, outbox);
  }

  private async applySource(rec: PaymentRecord, source: SignalSource, dedupeKey: string, payloadDigest: Hex32, t: LegTransition, outbox: readonly OutboxItem[]): Promise<Applied> {
    const signal: InboundSignal = { source, dedupeKey, payloadDigest };
    const r = await this.d.store.applySignal(rec.paymentId, rec.version, signal, t, outbox);
    if (r.kind === 'OK') return { record: r.value.record, outcome: r.value.outcome, detail: r.value.outcome };
    const fresh = await this.reread(rec);
    if (r.kind === 'AMBIGUOUS') return { record: fresh, outcome: 'AMBIGUOUS', detail: r.cause };
    return { record: fresh, outcome: 'REFUSED', detail: `${r.code}: ${r.detail}` };
  }

  private async result(a: Applied, note: string): Promise<StepResult> {
    if (a.outcome === 'APPLIED') await this.drainOutbox();
    const after = a.outcome === 'APPLIED' ? await this.reread(a.record) : a.record;
    return { record: after, changed: a.outcome === 'APPLIED', note: a.outcome === 'APPLIED' || a.outcome === 'DUPLICATE' || a.outcome === 'STALE' ? note : `${note} [${a.outcome}: ${a.detail}]` };
  }
}
