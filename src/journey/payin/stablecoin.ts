/**
 * JPAYIN, STABLECOIN method. USDC arriving at the payment's Arc deposit
 * address is detected PER TRANSFER from the indexer's confirmed transfers
 * (canonical log, (chainId, txHash, logIndex) dedupe), never from balance
 * deltas. Gas-aware: a transfer's credit is its own amount; gas paid by the
 * deposit address (an outbound sweep) is never netted into a credit.
 * Outbound and inbound transfers arrive in one window; only inbound ones to
 * the deposit address are credited. A wrong total, or a sub-unit remainder,
 * holds with a reason; a pay-in first seen after quote expiry is late.
 */
import { nativeWeiToUsdcUnits, usdcUnits } from '../../amounts/index.js';
import type { NetworkAdapter, ConfirmedTransfer } from '../../network/types.js';
import type { ConsentPort } from '../../ops/ports.js';
import { hold } from './cases.js';
import type { CaseOpener } from './cases.js';
import { assertConfig, expectationProblem, settlementDigest } from './types.js';
import type { PayInConfig, PayInExpectation, PayInPort, PayInResult, StablecoinExpectation } from './types.js';

/** What JPAYIN needs of the indexer: `ArcIndexer` and any `NetworkAdapter` satisfy it. */
export type ChainSource = Pick<NetworkAdapter, 'poll' | 'ack'>;

interface Credit {
  readonly dedupeKey: string;
  readonly digest: string;
  readonly units: bigint;
  readonly remainderWei: bigint;
  readonly firstSeenMs: bigint;
  readonly evidenceRef: string;
}

export interface StablecoinPayInDeps {
  readonly chain: ChainSource;
  readonly consent: ConsentPort;
  readonly ops: CaseOpener;
  readonly config: PayInConfig;
}

export class StablecoinPayIn implements PayInPort {
  readonly method = 'STABLECOIN' as const;
  /** Credits per deposit address, one per transfer dedupeKey. */
  private readonly credits = new Map<string, Map<string, Credit>>();
  private readonly conflicts = new Set<string>();
  private readonly done = new Map<string, Extract<PayInResult, { kind: 'CONFIRMED' }>>();
  private readonly cfg: PayInConfig;

  constructor(private readonly d: StablecoinPayInDeps) {
    this.cfg = assertConfig(d.config);
  }

  async settle(exp: PayInExpectation, nowMs: bigint): Promise<PayInResult> {
    if (exp.method !== 'STABLECOIN') return { kind: 'FAILED_CLOSED', code: 'METHOD_UNSUPPORTED', detail: 'StablecoinPayIn settles STABLECOIN only' };
    const bad = expectationProblem(exp);
    if (bad !== null) return { kind: 'FAILED_CLOSED', code: 'EXPECTATION_INVALID', detail: bad };
    const s: StablecoinExpectation = exp;
    const doneKey = `payin:${s.expectedPayInId}`;
    const confirmed = this.done.get(doneKey);
    if (confirmed !== undefined) return confirmed;

    const polled = await this.d.chain.poll(new Set([s.depositAddress]));
    if (polled.kind === 'FAILED') return { kind: 'FAILED_CLOSED', code: 'INDEXER_FAILED', detail: polled.failure.kind };
    const mine = new Map(this.credits.get(s.depositAddress) ?? []);
    const ackKeys: string[] = [];
    for (const t of polled.value) {
      if (t.to !== s.depositAddress && t.from !== s.depositAddress) continue; // someone else's transfer: not ours to ack
      ackKeys.push(t.dedupeKey);
      if (t.to !== s.depositAddress) continue; // outbound (sweep or refund): never a credit, and its gas is not netted
      if (!this.record(mine, t, nowMs)) this.conflicts.add(s.depositAddress);
    }
    this.credits.set(s.depositAddress, mine);
    // Recorded before ack: a crash between the two only re-delivers (dedupe makes it idempotent).
    if (ackKeys.length > 0) await this.d.chain.ack(ackKeys);

    const all = [...mine.values()];
    const evidence = all.map((c) => c.evidenceRef);
    if (this.conflicts.has(s.depositAddress)) return hold(this.d.ops, this.cfg, s, 'SIGNAL_CONFLICT', null, evidence);
    if (all.length === 0) return nowMs > s.quoteExpiresAtMs ? { kind: 'EXPIRED' } : { kind: 'PENDING' };

    let total = 0n;
    for (const c of all) total += c.units;
    if (all.some((c) => c.remainderWei !== 0n)) return hold(this.d.ops, this.cfg, s, 'SUB_UNIT_REMAINDER', total, evidence);
    if (all.some((c) => c.firstSeenMs > s.quoteExpiresAtMs)) return hold(this.d.ops, this.cfg, s, 'PAYIN_AFTER_QUOTE_EXPIRY', total, evidence);
    if (total < s.expected) return hold(this.d.ops, this.cfg, s, 'CONFIRMED_BELOW_EXPECTED', total, evidence);
    if (total > s.expected) return hold(this.d.ops, this.cfg, s, 'CONFIRMED_ABOVE_EXPECTED', total, evidence);
    if (s.settlementConsentRef === null) return hold(this.d.ops, this.cfg, s, 'CONSENT_MISSING', total, evidence);
    const used = await this.d.consent.consume(s.settlementConsentRef, { clientUid: s.clientUid, paymentId: s.paymentId, caseId: null, digest: settlementDigest(s) });
    if (used.kind === 'AMBIGUOUS') return { kind: 'PENDING' };
    if (used.kind === 'REJECTED') return hold(this.d.ops, this.cfg, s, 'CONSENT_MISSING', total, evidence);
    const res = { kind: 'CONFIRMED', method: 'STABLECOIN', amount: usdcUnits(total), evidenceRef: evidence.join(','), consentRef: s.settlementConsentRef } as const;
    this.done.set(doneKey, res);
    return res;
  }

  /** Records one inbound transfer. False when the same dedupeKey arrives with a different digest (SIGNAL_CONFLICT). */
  private record(into: Map<string, Credit>, t: ConfirmedTransfer, nowMs: bigint): boolean {
    const seen = into.get(t.dedupeKey);
    if (seen !== undefined) return seen.digest === t.payloadDigest; // duplicate log: no second credit
    const { units, remainderWei } = nativeWeiToUsdcUnits(t.amount);
    into.set(t.dedupeKey, {
      dedupeKey: t.dedupeKey,
      digest: t.payloadDigest,
      units,
      remainderWei,
      firstSeenMs: nowMs,
      evidenceRef: `${t.txHash}:${t.logIndex}`,
    });
    return true;
  }
}
