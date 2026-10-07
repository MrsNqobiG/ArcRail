/**
 * PORTS unit, status model (docs/NOVA_ARC_DESIGN.md §13; CO-1 v3 step 6).
 *
 * The stage → TransactionStatus table and the transition rules are checked by
 * reconstruction: the oracle below re-derives every verdict from the design
 * text, row by row (§13.2 table, §13.3 transition table and its paragraph,
 * §8.4 check 3 proofs, §8.6, §6.5, §4.1), written as a switch over the design's
 * rows and independently of src/status's rule tables. The whole product
 * legs × states × states × sources × DFNS-request states is compared.
 */
import { describe, expect, it } from 'vitest';
import {
  CANCELLED_REASONS,
  decideTransition,
  DFNS_REQUEST_STATES,
  EXPIRED_REASONS,
  isFailureStage,
  isLegalState,
  isNonTerminal,
  NON_TERMINAL_STAGES,
  paymentState,
  REASONS_BY_STAGE,
  REJECTED_REASONS,
  SIGNAL_SOURCES,
  skippedStages,
  STATUS_BY_STAGE,
  toTransactionStatus,
} from '../../src/status/index.js';
import type { DfnsRequest, FailureReason, LegKind, LegState, SignalSource, Stage, TransactionStatus } from '../../src/status/index.js';

const STAGES: readonly Stage[] = ['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'CONFIRMING', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'];
const LEGS: readonly LegKind[] = ['AWAIT_DEPOSIT', 'RESERVE', 'CONVERT_IN', 'ARC_TRANSFER', 'PAYOUT'];
const SOURCES: readonly SignalSource[] = ['ARC_LOG', 'DFNS_WEBHOOK', 'DFNS_POLL', 'CONVERSION', 'PAYOUT_CALLBACK', 'OPERATOR_DECISION', 'LEDGER', 'INTERNAL'];
const REQUESTS: readonly DfnsRequest[] = ['NONE', 'UNRESOLVED', 'KNOWN'];

/** §7.3 FailureReason and the §13.2 rows, written out from the design. */
const DESIGN_REJECTED = ['APPROVAL_DENIED', 'BLOCKLISTED_PRECHECK', 'BLOCKLISTED_PRE_MEMPOOL', 'ONCHAIN_REVERTED', 'DFNS_FAILED', 'INSUFFICIENT_FUNDS', 'PAYOUT_FAILED', 'METHOD_NOT_ENABLED', 'DESTINATION_NOT_ALLOWED'] as const;
const DESIGN_EXPIRED = ['APPROVAL_EXPIRED', 'QUOTE_EXPIRED', 'UNDER_FEE_FLOOR_DROPPED'] as const;
const DESIGN_CANCELLED = ['CANCELLED_BY_OPERATOR', 'CANCELLED_ONCHAIN_REPLACED'] as const;
const ALL_REASONS: readonly FailureReason[] = [...DESIGN_REJECTED, ...DESIGN_EXPIRED, ...DESIGN_CANCELLED];

/** Every (stage, reason) pair, legal or not. */
const ALL_PAIRS = STAGES.flatMap((stage) => [null, ...ALL_REASONS].map((reason) => ({ stage, reason })));

/** The 20 legal states. */
const LEGAL: readonly LegState[] = [
  { stage: 'CREATED', reason: null },
  { stage: 'PENDING_APPROVAL', reason: null },
  { stage: 'APPROVED', reason: null },
  { stage: 'SUBMITTED', reason: null },
  { stage: 'CONFIRMING', reason: null },
  { stage: 'COMPLETED', reason: null },
  ...DESIGN_REJECTED.map((reason) => ({ stage: 'REJECTED', reason }) as const),
  ...DESIGN_EXPIRED.map((reason) => ({ stage: 'EXPIRED', reason }) as const),
  ...DESIGN_CANCELLED.map((reason) => ({ stage: 'CANCELLED', reason }) as const),
];

const key = (s: { stage: Stage; reason: FailureReason | null }): string => `${s.stage}/${String(s.reason)}`;

describe('§13.2 stage → TransactionStatus table', () => {
  it('is exactly the design table, one row per stage', () => {
    expect(STATUS_BY_STAGE).toEqual({
      CREATED: 'PENDING',
      PENDING_APPROVAL: 'PENDING',
      APPROVED: 'PROCESSING',
      SUBMITTED: 'PROCESSING',
      CONFIRMING: 'PROCESSING',
      COMPLETED: 'SETTLED',
      REJECTED: 'FAILED',
      EXPIRED: 'FAILED',
      CANCELLED: 'FAILED',
    });
    expect(Object.keys(STATUS_BY_STAGE).sort()).toEqual([...STAGES].sort());
    expect(Object.isFrozen(STATUS_BY_STAGE)).toBe(true);
  });

  it('the reason lists are exactly the design lists (§7.3, §13.2): no reason missing, none added', () => {
    expect(REJECTED_REASONS).toEqual(DESIGN_REJECTED);
    expect(EXPIRED_REASONS).toEqual(DESIGN_EXPIRED);
    expect(CANCELLED_REASONS).toEqual(DESIGN_CANCELLED);
    expect(REASONS_BY_STAGE).toEqual({ REJECTED: DESIGN_REJECTED, EXPIRED: DESIGN_EXPIRED, CANCELLED: DESIGN_CANCELLED });
    expect(new Set(ALL_REASONS).size).toBe(14);
    expect(ALL_REASONS).toContain('CANCELLED_ONCHAIN_REPLACED');
    expect(ALL_REASONS).toContain('DESTINATION_NOT_ALLOWED');
    expect(ALL_REASONS as readonly string[]).not.toContain('CONVERSION_FAILED');
  });

  it('isLegalState accepts exactly the 20 legal (stage, reason) pairs', () => {
    const legal = new Set(LEGAL.map(key));
    expect(legal.size).toBe(20);
    for (const p of ALL_PAIRS) expect(isLegalState(p), key(p)).toBe(legal.has(key(p)));
    expect(isLegalState({ stage: 'NOPE' as Stage, reason: null })).toBe(false);
    expect(isLegalState({ stage: 'toString' as Stage, reason: null })).toBe(false);
  });

  it('every legal state maps to exactly one status; a failure stage is always FAILED with its reason', () => {
    for (const s of LEGAL) {
      const want: TransactionStatus =
        s.stage === 'COMPLETED' ? 'SETTLED' : isFailureStage(s.stage) ? 'FAILED' : s.stage === 'CREATED' || s.stage === 'PENDING_APPROVAL' ? 'PENDING' : 'PROCESSING';
      expect(toTransactionStatus(s, null), key(s)).toBe(want);
    }
  });

  it('blocklisted-sender pre-mempool rejection and under-floor drop are FAILED with a reason', () => {
    expect(toTransactionStatus({ stage: 'REJECTED', reason: 'BLOCKLISTED_PRE_MEMPOOL' }, null)).toBe('FAILED');
    expect(toTransactionStatus({ stage: 'EXPIRED', reason: 'UNDER_FEE_FLOOR_DROPPED' }, null)).toBe('FAILED');
    expect(toTransactionStatus({ stage: 'CANCELLED', reason: 'CANCELLED_ONCHAIN_REPLACED' }, null)).toBe('FAILED');
  });

  it('REVERSED only from COMPLETED with a compensating (P7) journal; never otherwise', () => {
    expect(toTransactionStatus({ stage: 'COMPLETED', reason: null }, 'jr-7')).toBe('REVERSED');
    for (const s of LEGAL) {
      if (s.stage === 'COMPLETED') continue;
      expect(() => toTransactionStatus(s, 'jr-7'), key(s)).toThrow(/compensation recorded on a/);
      expect(toTransactionStatus(s, null)).not.toBe('REVERSED');
    }
    expect(Object.values(STATUS_BY_STAGE)).not.toContain('REVERSED');
  });

  it('an illegal (stage, reason) pair throws (fail closed)', () => {
    const bad = ALL_PAIRS.filter((p) => !isLegalState(p));
    expect(bad.length).toBe(9 * 15 - 20);
    for (const p of bad) expect(() => toTransactionStatus(p as LegState, null), key(p)).toThrow(/illegal stage\/reason/);
  });

  it('stage, source and request classifiers', () => {
    expect(STAGES.filter(isNonTerminal)).toEqual(['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'CONFIRMING']);
    expect(STAGES.filter(isFailureStage)).toEqual(['REJECTED', 'EXPIRED', 'CANCELLED']);
    expect(NON_TERMINAL_STAGES).toEqual(['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'CONFIRMING']);
    expect(SIGNAL_SOURCES).toEqual(SOURCES);
    expect(DFNS_REQUEST_STATES).toEqual(REQUESTS);
  });
});

// ---------------------------------------------------------------------------
// §13.3 transitions: independent oracle, one case per design row.
// ---------------------------------------------------------------------------

const ORDER: readonly Stage[] = ['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'CONFIRMING'];
const inFlight = (s: Stage): boolean => s === 'SUBMITTED' || s === 'CONFIRMING';
const preSubmit = (s: Stage): boolean => s === 'CREATED' || s === 'PENDING_APPROVAL' || s === 'APPROVED';
const fromDfns = (src: SignalSource): boolean => src === 'DFNS_WEBHOOK' || src === 'DFNS_POLL';
/** The evidence each non-Arc leg moves on (§4.1, §7.5, §10.3). */
const OWN_SOURCE: Readonly<Record<Exclude<LegKind, 'ARC_TRANSFER'>, SignalSource>> = { AWAIT_DEPOSIT: 'ARC_LOG', RESERVE: 'LEDGER', CONVERT_IN: 'CONVERSION', PAYOUT: 'PAYOUT_CALLBACK' };

function forward(leg: LegKind, cur: Stage, tgt: Stage, src: SignalSource, req: DfnsRequest): boolean {
  if (leg !== 'ARC_TRANSFER') return req === 'NONE' && src === OWN_SOURCE[leg];
  if (req === 'NONE') return false; // no submit marker: no DFNS request exists, so no DFNS state can apply (§10.4)
  if (fromDfns(src)) return true; // §8.6 DFNS status → stage (forward jumps allowed, §13.3)
  if (req !== 'KNOWN' || tgt !== 'CONFIRMING') return false;
  if (src === 'OPERATOR_DECISION') return true; // §6.5 rule 1 two-person LINK_HASH: a forward jump to CONFIRMING
  return cur === 'SUBMITTED' && (src === 'ARC_LOG' || src === 'INTERNAL'); // our indexer has the hash on its watch list
}

function completes(leg: LegKind, cur: Stage, src: SignalSource, req: DfnsRequest): boolean {
  if (leg === 'ARC_TRANSFER') return inFlight(cur) && src === 'ARC_LOG' && req === 'KNOWN'; // §6.5
  if (req !== 'NONE') return false;
  if (leg === 'PAYOUT') return inFlight(cur) && src === 'PAYOUT_CALLBACK'; // §4.1 partner's final confirmation
  return src === OWN_SOURCE[leg];
}

function fails(leg: LegKind, cur: Stage, reason: FailureReason, src: SignalSource, req: DfnsRequest): boolean {
  const arc = leg === 'ARC_TRANSFER';
  if (!arc && req !== 'NONE') return false;
  if (req === 'UNRESOLVED') return false; // §13.3 "CREATED, UNRESOLVED: no terminal target at all"
  const noRequest = cur === 'CREATED' && req === 'NONE'; // §13.3 "CREATED with no submit marker"
  switch (reason) {
    case 'INSUFFICIENT_FUNDS':
      return noRequest && ((leg === 'RESERVE' && src === 'LEDGER') || (leg === 'CONVERT_IN' && src === 'CONVERSION'));
    case 'METHOD_NOT_ENABLED':
      return noRequest && src === 'INTERNAL';
    case 'BLOCKLISTED_PRECHECK':
    case 'DESTINATION_NOT_ALLOWED':
      return arc && noRequest && src === 'INTERNAL';
    case 'QUOTE_EXPIRED':
      return leg !== 'PAYOUT' && noRequest && (src === 'INTERNAL' || src === 'CONVERSION');
    case 'CANCELLED_BY_OPERATOR':
      // Directly only with no marker; after it only on proof (a2), an accepted abort recorded by two people.
      return src === 'OPERATOR_DECISION' && (noRequest || (arc && preSubmit(cur) && req === 'KNOWN'));
    case 'APPROVAL_DENIED':
    case 'APPROVAL_EXPIRED':
      return arc && (cur === 'CREATED' || cur === 'PENDING_APPROVAL') && fromDfns(src) && req === 'KNOWN'; // proof (a1)
    case 'DFNS_FAILED':
    case 'BLOCKLISTED_PRE_MEMPOOL':
      return arc && preSubmit(cur) && src === 'OPERATOR_DECISION' && req === 'KNOWN'; // only with proof (c); never on Failed alone
    case 'ONCHAIN_REVERTED':
      return arc && inFlight(cur) && src === 'ARC_LOG' && req === 'KNOWN';
    case 'UNDER_FEE_FLOOR_DROPPED':
      return arc && inFlight(cur) && src === 'INTERNAL' && req === 'KNOWN'; // proof (b)
    case 'CANCELLED_ONCHAIN_REPLACED':
      return arc && inFlight(cur) && src === 'OPERATOR_DECISION' && req === 'KNOWN'; // proof (b) + recorded DFNS cancel
    case 'PAYOUT_FAILED':
      return leg === 'PAYOUT' && inFlight(cur) && src === 'PAYOUT_CALLBACK';
  }
}

function oracle(leg: LegKind, cur: LegState, tgt: LegState, src: SignalSource, req: DfnsRequest): string {
  const curDone = !ORDER.includes(cur.stage);
  const tgtDone = !ORDER.includes(tgt.stage);
  if (curDone) {
    if (!tgtDone) return 'STALE';
    return cur.stage === tgt.stage && cur.reason === tgt.reason ? 'DUPLICATE' : 'ILLEGAL';
  }
  if (!tgtDone) {
    if (ORDER.indexOf(tgt.stage) <= ORDER.indexOf(cur.stage)) return 'STALE';
    return forward(leg, cur.stage, tgt.stage, src, req) ? 'APPLIED' : 'ILLEGAL';
  }
  const ok = tgt.reason === null ? completes(leg, cur.stage, src, req) : fails(leg, cur.stage, tgt.reason, src, req);
  return ok ? 'APPLIED' : 'ILLEGAL';
}

describe('§13.3 decideTransition', () => {
  it('matches the design oracle on every leg × state × state × source × DFNS-request state', () => {
    let n = 0;
    const mismatches: string[] = [];
    for (const leg of LEGS)
      for (const cur of LEGAL)
        for (const tgt of LEGAL)
          for (const src of SOURCES)
            for (const req of REQUESTS) {
              n += 1;
              const got = decideTransition(leg, cur, tgt, src, req);
              const want = oracle(leg, cur, tgt, src, req);
              if (got !== want) mismatches.push(`${leg} ${key(cur)} -> ${key(tgt)} via ${src} (${req}): got ${got}, want ${want}`);
            }
    expect(n).toBe(5 * 20 * 20 * 8 * 3);
    expect(mismatches).toEqual([]);
  });

  it('the Arc leg completes only from SUBMITTED/CONFIRMING on our own ARC_LOG, never on a DFNS webhook or poll', () => {
    const done: LegState = { stage: 'COMPLETED', reason: null };
    for (const s of ['SUBMITTED', 'CONFIRMING'] as const) {
      expect(decideTransition('ARC_TRANSFER', { stage: s, reason: null }, done, 'ARC_LOG', 'KNOWN')).toBe('APPLIED');
      for (const src of SOURCES.filter((x) => x !== 'ARC_LOG')) expect(decideTransition('ARC_TRANSFER', { stage: s, reason: null }, done, src, 'KNOWN')).toBe('ILLEGAL');
    }
    for (const s of ['CREATED', 'PENDING_APPROVAL', 'APPROVED'] as const) expect(decideTransition('ARC_TRANSFER', { stage: s, reason: null }, done, 'ARC_LOG', 'KNOWN')).toBe('ILLEGAL');
  });

  it('SETTLED is reachable only from ARC_LOG (stablecoin payout) or PAYOUT_CALLBACK (fiat payout), never from DFNS', () => {
    const done: LegState = { stage: 'COMPLETED', reason: null };
    for (const cur of LEGAL.filter((s) => ORDER.includes(s.stage)))
      for (const src of ['DFNS_WEBHOOK', 'DFNS_POLL'] as const)
        for (const req of REQUESTS) {
          expect(decideTransition('ARC_TRANSFER', cur, done, src, req)).toBe('ILLEGAL');
          expect(decideTransition('PAYOUT', cur, done, src, req)).toBe('ILLEGAL');
        }
  });

  it('a hash-less DFNS Failed alone (webhook or poll, no accepted abort, no proof (c)) never ends the Arc leg (B2)', () => {
    for (const reason of ['DFNS_FAILED', 'BLOCKLISTED_PRE_MEMPOOL'] as const)
      for (const stage of ['CREATED', 'PENDING_APPROVAL', 'APPROVED'] as const)
        for (const src of ['DFNS_WEBHOOK', 'DFNS_POLL', 'INTERNAL', 'ARC_LOG'] as const)
          for (const req of REQUESTS) expect(decideTransition('ARC_TRANSFER', { stage, reason: null }, { stage: 'REJECTED', reason }, src, req), `${reason} ${stage} ${src} ${req}`).toBe('ILLEGAL');
    for (const stage of ['PENDING_APPROVAL', 'APPROVED'] as const)
      for (const src of SOURCES.filter((s) => s !== 'OPERATOR_DECISION'))
        expect(decideTransition('ARC_TRANSFER', { stage, reason: null }, { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }, src, 'KNOWN')).toBe('ILLEGAL');
    expect(decideTransition('ARC_TRANSFER', { stage: 'APPROVED', reason: null }, { stage: 'REJECTED', reason: 'DFNS_FAILED' }, 'OPERATOR_DECISION', 'KNOWN')).toBe('APPLIED');
    expect(decideTransition('ARC_TRANSFER', { stage: 'APPROVED', reason: null }, { stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }, 'OPERATOR_DECISION', 'KNOWN')).toBe('APPLIED');
  });

  it('UNRESOLVED (marker set, no DFNS entity): no terminal target from any source (R3-B1)', () => {
    for (const cur of LEGAL.filter((s) => ORDER.includes(s.stage)))
      for (const tgt of LEGAL.filter((s) => !ORDER.includes(s.stage)))
        for (const src of SOURCES) expect(decideTransition('ARC_TRANSFER', cur, tgt, src, 'UNRESOLVED')).toBe('ILLEGAL');
  });

  it('pre-request reasons only while no DFNS request can exist; once the marker is set they are refused', () => {
    const pre: readonly LegState[] = [
      { stage: 'EXPIRED', reason: 'QUOTE_EXPIRED' },
      { stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK' },
      { stage: 'REJECTED', reason: 'DESTINATION_NOT_ALLOWED' },
      { stage: 'REJECTED', reason: 'METHOD_NOT_ENABLED' },
    ];
    for (const t of pre) {
      expect(decideTransition('ARC_TRANSFER', { stage: 'CREATED', reason: null }, t, 'INTERNAL', 'NONE')).toBe('APPLIED');
      expect(decideTransition('ARC_TRANSFER', { stage: 'CREATED', reason: null }, t, 'INTERNAL', 'KNOWN')).toBe('ILLEGAL');
    }
  });

  it('on-chain reasons only from SUBMITTED onward; off-chain reasons never from SUBMITTED onward', () => {
    for (const s of ['SUBMITTED', 'CONFIRMING'] as const) {
      for (const [reason, src] of [
        ['DFNS_FAILED', 'OPERATOR_DECISION'],
        ['BLOCKLISTED_PRE_MEMPOOL', 'OPERATOR_DECISION'],
        ['CANCELLED_BY_OPERATOR', 'OPERATOR_DECISION'],
      ] as const) {
        const stage = reason === 'CANCELLED_BY_OPERATOR' ? 'CANCELLED' : 'REJECTED';
        expect(decideTransition('ARC_TRANSFER', { stage: s, reason: null }, { stage, reason } as LegState, src, 'KNOWN')).toBe('ILLEGAL');
      }
      expect(decideTransition('ARC_TRANSFER', { stage: s, reason: null }, { stage: 'CANCELLED', reason: 'CANCELLED_ONCHAIN_REPLACED' }, 'OPERATOR_DECISION', 'KNOWN')).toBe('APPLIED');
    }
    expect(decideTransition('ARC_TRANSFER', { stage: 'APPROVED', reason: null }, { stage: 'CANCELLED', reason: 'CANCELLED_ONCHAIN_REPLACED' }, 'OPERATOR_DECISION', 'KNOWN')).toBe('ILLEGAL');
  });

  it('a forward jump from a source that does not evidence it is ILLEGAL (B1, probe P7)', () => {
    expect(decideTransition('ARC_TRANSFER', { stage: 'SUBMITTED', reason: null }, { stage: 'CONFIRMING', reason: null }, 'PAYOUT_CALLBACK', 'KNOWN')).toBe('ILLEGAL');
    expect(decideTransition('ARC_TRANSFER', { stage: 'CREATED', reason: null }, { stage: 'CONFIRMING', reason: null }, 'ARC_LOG', 'KNOWN')).toBe('ILLEGAL');
    expect(decideTransition('ARC_TRANSFER', { stage: 'CREATED', reason: null }, { stage: 'PENDING_APPROVAL', reason: null }, 'DFNS_POLL', 'NONE')).toBe('ILLEGAL');
    expect(decideTransition('PAYOUT', { stage: 'CREATED', reason: null }, { stage: 'SUBMITTED', reason: null }, 'DFNS_POLL', 'NONE')).toBe('ILLEGAL');
  });

  it('an illegal current or target state is ILLEGAL', () => {
    const bad = { stage: 'REJECTED', reason: null } as unknown as LegState;
    expect(decideTransition('RESERVE', bad, { stage: 'COMPLETED', reason: null }, 'LEDGER', 'NONE')).toBe('ILLEGAL');
    expect(decideTransition('RESERVE', { stage: 'CREATED', reason: null }, bad, 'LEDGER', 'NONE')).toBe('ILLEGAL');
  });

  it('no DFNS status sequence, with any intermediate state dropped or repeated, reaches ILLEGAL', () => {
    // DFNS transfer statuses as our stages (§8.6): Pending, Executing, Broadcasted, Confirmed (Confirmed never completes).
    const seq: readonly Stage[] = ['PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'CONFIRMING'];
    for (let mask = 0; mask < 1 << seq.length; mask += 1) {
      const kept = seq.filter((_, i) => (mask & (1 << i)) !== 0);
      for (const order of [kept, [...kept, ...kept], [...kept].reverse()]) {
        let cur: LegState = { stage: 'CREATED', reason: null };
        for (const s of order) {
          const v = decideTransition('ARC_TRANSFER', cur, { stage: s, reason: null } as LegState, 'DFNS_POLL', 'KNOWN');
          expect(v).not.toBe('ILLEGAL');
          if (v === 'APPLIED') cur = { stage: s, reason: null } as LegState;
        }
      }
    }
  });
});

describe('skippedStages', () => {
  it('lists the non-terminal stages a forward jump passes', () => {
    expect(skippedStages('PENDING_APPROVAL', 'CONFIRMING')).toEqual(['APPROVED', 'SUBMITTED']);
    expect(skippedStages('CREATED', 'APPROVED')).toEqual(['PENDING_APPROVAL']);
    expect(skippedStages('CREATED', 'PENDING_APPROVAL')).toEqual([]);
    expect(skippedStages('SUBMITTED', 'CREATED')).toEqual([]);
  });
  it('is empty when either end is terminal', () => {
    expect(skippedStages('CREATED', 'COMPLETED')).toEqual([]);
    expect(skippedStages('COMPLETED', 'CONFIRMING')).toEqual([]);
    expect(skippedStages('REJECTED', 'CREATED')).toEqual([]);
  });
});

describe('§4.2 paymentState', () => {
  const c = (stage: Stage): LegState => ({ stage, reason: null }) as LegState;
  it('needs at least one leg', () => {
    expect(() => paymentState([])).toThrow(/at least one leg/);
  });
  it('is COMPLETED only when every leg is COMPLETED', () => {
    expect(paymentState([c('COMPLETED'), c('COMPLETED')])).toEqual(c('COMPLETED'));
  });
  it('is the first leg that is not COMPLETED', () => {
    expect(paymentState([c('COMPLETED'), c('SUBMITTED'), c('CREATED')])).toEqual(c('SUBMITTED'));
    expect(paymentState([c('CREATED'), c('CREATED')])).toEqual(c('CREATED'));
  });
  it('a failed leg makes the payment terminal with its stage and reason', () => {
    const rej: LegState = { stage: 'REJECTED', reason: 'PAYOUT_FAILED' };
    const exp: LegState = { stage: 'EXPIRED', reason: 'QUOTE_EXPIRED' };
    expect(paymentState([c('COMPLETED'), c('COMPLETED'), rej])).toEqual(rej);
    expect(paymentState([c('CREATED'), exp, rej])).toEqual(exp);
    expect(paymentState([{ stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' }])).toEqual({ stage: 'CANCELLED', reason: 'CANCELLED_BY_OPERATOR' });
  });
});
