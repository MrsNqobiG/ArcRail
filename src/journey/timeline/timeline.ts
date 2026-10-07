/**
 * JTIME: journey timeline builder. Pure and deterministic.
 * - every step that is shown as DONE carries the fact that licenses it;
 * - a step without its licensing fact is PENDING with licensedBy null;
 * - ARRIVED is licensed ONLY by the payout's final confirmation: for a
 *   STABLECOIN_WALLET payout, our own confirmed system-emitter log to the
 *   receiver wallet; for a FIAT_BANK payout, the partner's payout-complete
 *   confirmation. The Arc confirmation of a fiat journey never shows ARRIVED;
 * - duplicate facts (same kind) collapse to one step (earliest, then factId).
 */
import type { NetworkAddress } from '../../nova-ports/ids.js';
import type { PayInMethod, PayoutMethod } from '../../status/journey.js';
import { isWellFormedFact } from './facts.js';
import type { Fact, FactKind } from './facts.js';

export type StepKind = 'FUNDS_RESERVED' | 'PAYIN_RECEIVED' | 'CONVERTED' | 'SENT' | 'SETTLED_ON_ARC' | 'PAYOUT_STARTED' | 'ARRIVED';
export type StepState = 'DONE' | 'PENDING';

export interface TimelineStep {
  readonly step: StepKind;
  readonly state: StepState;
  /** The licensing fact, null while PENDING. */
  readonly licensedBy: { readonly kind: FactKind; readonly factId: string } | null;
  readonly at: string | null;
}

/** Fact that licenses each step (the ARRIVED rule is payout dependent). */
const STEP_FACT: Readonly<Record<Exclude<StepKind, 'ARRIVED'>, FactKind>> = Object.freeze({
  FUNDS_RESERVED: 'RESERVED',
  PAYIN_RECEIVED: 'PAYIN_CONFIRMED',
  CONVERTED: 'CONVERTED',
  SENT: 'ARC_SUBMITTED',
  SETTLED_ON_ARC: 'ARC_CONFIRMED',
  PAYOUT_STARTED: 'PAYOUT_STARTED',
});

/** Ordered steps for a pay-in x payout pair. */
export function stepsFor(payIn: PayInMethod, payout: PayoutMethod): readonly StepKind[] {
  return Object.freeze([
    'FUNDS_RESERVED',
    ...(payIn.method === 'STABLECOIN_BALANCE' ? [] : (['PAYIN_RECEIVED'] as const)),
    ...(payIn.method === 'FIAT' ? (['CONVERTED'] as const) : []),
    'SENT',
    'SETTLED_ON_ARC',
    ...(payout.method === 'FIAT_BANK' ? (['PAYOUT_STARTED'] as const) : []),
    'ARRIVED',
  ] as StepKind[]);
}

export interface TimelineContext {
  readonly payIn: PayInMethod;
  readonly payout: PayoutMethod;
  /** Receiver wallet for a STABLECOIN_WALLET payout, from the server-side record. */
  readonly receiverAddress: NetworkAddress | null;
  /** Expected Arc chain id (server side). */
  readonly chainId: bigint;
}

function before(a: Fact, b: Fact): boolean {
  return a.occurredAt === b.occurredAt ? a.factId < b.factId : a.occurredAt < b.occurredAt;
}

function earliest(facts: readonly Fact[]): Fact | undefined {
  return facts.reduce<Fact | undefined>((best, f) => (best === undefined || before(f, best) ? f : best), undefined);
}

function licenses(step: StepKind, f: Fact, ctx: TimelineContext): boolean {
  if (!isWellFormedFact(f)) return false;
  if (step === 'ARRIVED') {
    if (ctx.payout.method === 'FIAT_BANK') return f.kind === 'PAYOUT_COMPLETE' && f.source === 'PARTNER';
    const c = f.chain;
    return (
      f.kind === 'ARC_CONFIRMED' && c !== undefined && ctx.receiverAddress !== null &&
      c.to.toLowerCase() === ctx.receiverAddress.toLowerCase() && c.chainId === ctx.chainId
    );
  }
  if (step === 'SETTLED_ON_ARC') {
    // The Arc leg's own confirmation, on the expected chain. Never shown as arrival for fiat payouts.
    return f.kind === 'ARC_CONFIRMED' && f.chain !== undefined && f.chain.chainId === ctx.chainId;
  }
  return f.kind === STEP_FACT[step];
}

/** Build the timeline. Unknown or malformed facts are ignored (they license nothing). */
export function buildTimeline(ctx: TimelineContext, facts: readonly Fact[]): readonly TimelineStep[] {
  return Object.freeze(
    stepsFor(ctx.payIn, ctx.payout).map((step): TimelineStep => {
      const hit = earliest(facts.filter((f) => licenses(step, f, ctx)));
      return hit === undefined
        ? { step, state: 'PENDING', licensedBy: null, at: null }
        : { step, state: 'DONE', licensedBy: { kind: hit.kind, factId: hit.factId }, at: hit.occurredAt };
    }),
  );
}

export function hasArrived(steps: readonly TimelineStep[]): boolean {
  return steps.some((s) => s.step === 'ARRIVED' && s.state === 'DONE');
}
