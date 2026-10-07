/**
 * JORCH test support (tests and demos only; nothing in the money path imports
 * this): scripted port doubles, a double-entry ledger fake whose residual must
 * be zero, and a minimal quote fixture. Throwaway literals only.
 */
import type { JourneyQuote } from '../quote/compose.js';
import type { Hex32, NovaOwnerRef, PaymentId } from '../../nova-ports/ids.js';
import type { PayInMethod, PayoutMethod } from '../../status/journey.js';
import { journeyLegs } from '../../status/journey.js';
import type {
  ArcSendPort, ArcSendResult, CasePort, ConversionStep, ConvertResult, FundsPort, FundsResult, JourneyOrder, OrchPayInResult, PayInPort, PayoutPort, PayoutResult,
} from './ports.js';

/** Returns scripted results in order; the last one repeats. Counts calls. */
class Script<T> {
  calls = 0;
  constructor(private readonly results: T[]) {}
  next(): T {
    const i = Math.min(this.calls, this.results.length - 1);
    this.calls += 1;
    return this.results[i] as T;
  }
  push(...r: T[]): void {
    this.results.push(...r);
  }
}

export class ScriptedPayIn implements PayInPort {
  private readonly s: Script<OrchPayInResult>;
  constructor(results: OrchPayInResult[]) {
    this.s = new Script(results);
  }
  get calls(): number {
    return this.s.calls;
  }
  settle(): Promise<OrchPayInResult> {
    return Promise.resolve(this.s.next());
  }
}

export class ScriptedConversion implements ConversionStep {
  private readonly s: Script<ConvertResult>;
  constructor(results: ConvertResult[]) {
    this.s = new Script(results);
  }
  get calls(): number {
    return this.s.calls;
  }
  convert(): Promise<ConvertResult> {
    return Promise.resolve(this.s.next());
  }
}

export class ScriptedArc implements ArcSendPort {
  private readonly s: Script<ArcSendResult>;
  constructor(results: ArcSendResult[]) {
    this.s = new Script(results);
  }
  get calls(): number {
    return this.s.calls;
  }
  send(): Promise<ArcSendResult> {
    return Promise.resolve(this.s.next());
  }
}

export class ScriptedPayout implements PayoutPort {
  private readonly s: Script<PayoutResult>;
  constructor(results: PayoutResult[]) {
    this.s = new Script(results);
  }
  get calls(): number {
    return this.s.calls;
  }
  advance(): Promise<PayoutResult> {
    return Promise.resolve(this.s.next());
  }
}

export interface OpenedCase {
  readonly kind: string;
  readonly reason: string;
  readonly subject: string;
  readonly paymentId: PaymentId;
  readonly caseId: string;
}

/** Dedupes by subject, like the real queue (a case id is derived from kind and subject). */
export class CaptureCases implements CasePort {
  readonly opened: OpenedCase[] = [];
  down = false;
  open(req: Parameters<CasePort['open']>[0]): Promise<{ readonly caseId: string | null }> {
    if (this.down) return Promise.resolve({ caseId: null });
    const found = this.opened.find((c) => c.kind === req.kind && c.subject === req.subject);
    if (found !== undefined) return Promise.resolve({ caseId: found.caseId });
    const caseId = `case-${String(this.opened.length + 1)}`;
    this.opened.push({ kind: req.kind, reason: req.reason, subject: req.subject, paymentId: req.paymentId, caseId });
    return Promise.resolve({ caseId });
  }
}

/**
 * Double-entry ledger fake. Every posting debits one account and credits
 * another by the same bigint, so `residual()` (sum of all balances) is 0 by
 * construction; tests assert it AND the named balances.
 * payer / reserved / clearing / fees are the accounts; `world` is the outside.
 */
export class FakeFunds implements FundsPort {
  readonly balances = new Map<string, bigint>();
  readonly postings: { readonly key: string; readonly debit: string; readonly credit: string; readonly amount: bigint }[] = [];
  private readonly done = new Set<string>();
  reserveResult: FundsResult = 'OK';
  settleResult: FundsResult = 'OK';
  refundResult: FundsResult = 'OK';

  constructor(
    private readonly payerAmount: bigint,
    private readonly fee: bigint,
  ) {}

  /** The pay-in (or the client's own balance) lands in the payer account. */
  fund(amount: bigint = this.payerAmount): void {
    this.post(`fund:${String(this.postings.length)}`, 'world', 'payer', amount);
  }

  bal(a: string): bigint {
    return this.balances.get(a) ?? 0n;
  }

  residual(): bigint {
    let t = 0n;
    for (const v of this.balances.values()) t += v;
    return t;
  }

  private post(key: string, from: string, to: string, amount: bigint): void {
    if (this.done.has(key)) return;
    this.done.add(key);
    this.balances.set(from, this.bal(from) - amount);
    this.balances.set(to, this.bal(to) + amount);
    this.postings.push({ key, debit: to, credit: from, amount });
  }

  reserve(o: JourneyOrder): Promise<FundsResult> {
    if (this.reserveResult !== 'OK') return Promise.resolve(this.reserveResult);
    if (this.bal('payer') < this.payerAmount) return Promise.resolve('INSUFFICIENT_FUNDS');
    this.post(`p1:${o.paymentId}`, 'payer', 'reserved', this.payerAmount);
    return Promise.resolve('OK');
  }

  settle(o: JourneyOrder, _tx: Hex32): Promise<FundsResult> {
    if (this.settleResult !== 'OK') return Promise.resolve(this.settleResult);
    this.post(`p2:${o.paymentId}`, 'reserved', 'clearing', this.payerAmount - this.fee);
    if (this.fee > 0n) this.post(`p3:${o.paymentId}`, 'reserved', 'fees', this.fee);
    return Promise.resolve('OK');
  }

  refund(o: JourneyOrder, kind: 'RESERVE' | 'PAYIN'): Promise<FundsResult> {
    if (this.refundResult !== 'OK') return Promise.resolve(this.refundResult);
    if (this.bal('reserved') >= this.payerAmount) this.post(`p6:${o.paymentId}`, 'reserved', 'payer', this.payerAmount);
    if (kind === 'PAYIN') this.post(`p13:${o.paymentId}`, 'payer', 'world', this.bal('payer'));
    return Promise.resolve('OK');
  }
}

export const FX_ASSET_NOTE = 'quote fixture is a structural cast: JORCH reads only the fields below';

export interface FixtureOpts {
  readonly payIn: PayInMethod;
  readonly payout: PayoutMethod;
  readonly payer: bigint;
  readonly recipient: bigint;
  readonly arcAmount: bigint;
  readonly expiresAtMs: bigint;
  readonly convertExpiresAtMs?: bigint;
  readonly convertTo?: bigint;
  readonly crossBorder?: boolean;
  readonly quoteId?: string;
}

/** The fields JORCH reads from a JourneyQuote; everything else is deliberately absent (a cast, not a composed quote). */
export function fixtureQuote(o: FixtureOpts): JourneyQuote {
  const fiat = o.payIn.method === 'FIAT';
  const q = {
    quoteId: o.quoteId ?? 'q-1', requestId: 'req-1', side: 'SEND_EXACT', payIn: o.payIn, payout: o.payout, legs: journeyLegs(o.payIn, o.payout),
    payer: fiat ? { kind: 'FIAT', fiat: { currency: 'ZAR', minor: o.payer } } : { kind: 'STABLECOIN', asset: 'USDC', minor: o.payer },
    recipient: o.payout.method === 'FIAT_BANK' ? { kind: 'FIAT', fiat: { currency: 'ZAR', minor: o.recipient } } : { kind: 'STABLECOIN', asset: 'USDC', minor: o.recipient },
    arcTransfer: { leg: 'ARC_TRANSFER', amount: o.arcAmount },
    convertIn: fiat ? { leg: 'CONVERT_IN', to: o.convertTo ?? o.arcAmount, expiresAtMs: o.convertExpiresAtMs ?? o.expiresAtMs } : null,
    crossBorder: o.crossBorder ?? false, expiresAtMs: o.expiresAtMs, createdAtMs: 0n,
  };
  return q as unknown as JourneyQuote;
}

export function orderOf(paymentId: PaymentId, clientUid: NovaOwnerRef, quote: JourneyQuote): JourneyOrder {
  return { paymentId, clientUid, quote, retryOf: null };
}
