/** JTIME: timeline licensing, ARRIVED rule, dedupe, notifiers, handler. Throwaway literals only. */
import { describe, expect, it } from 'vitest';
import {
  EmailNotifier, WebhookNotifier, SYSTEM_EMITTER, buildTimeline, createJourneyHandler, formatUnits, hasArrived, notifySteps, safeNotifier, stepsFor, viewOf,
} from '../../src/journey/timeline/index.js';
import type { Fact, JourneyRecord, Notifier, TimelineContext } from '../../src/journey/timeline/index.js';
import { beneficiaryRef, fiatCode, paymentId } from '../../src/nova-ports/ids.js';
import type { NetworkAddress, NetworkId } from '../../src/nova-ports/ids.js';
import type { LegState } from '../../src/status/index.js';
import type { PayInMethod, PayoutMethod } from '../../src/status/journey.js';
import { journeyLegs } from '../../src/status/journey.js';

const NET = 'ARC' as unknown as NetworkId;
const PID = paymentId(`pay-${'a1'.repeat(16)}`);
const WALLET = `0x${'12'.repeat(20)}` as NetworkAddress;
const OTHER = `0x${'34'.repeat(20)}` as NetworkAddress;
const TX = `0x${'ab'.repeat(32)}` as const;
const PAYINS: Record<string, PayInMethod> = {
  FIAT: { method: 'FIAT', currency: fiatCode('ZAR') },
  STABLE: { method: 'STABLECOIN_BALANCE', asset: 'USDC', network: NET },
};
const PAYOUTS: Record<string, PayoutMethod> = {
  FIAT: { method: 'FIAT_BANK', currency: fiatCode('ZAR'), beneficiaryRef: beneficiaryRef('b1') },
  STABLE: { method: 'STABLECOIN_WALLET', asset: 'USDC', network: NET, beneficiaryRef: beneficiaryRef('b2') },
};

let n = 0;
function fact(kind: Fact['kind'], source: Fact['source'], over: Partial<Fact> = {}): Fact {
  n += 1;
  return { kind, source, factId: `f:${String(n)}`, occurredAt: `2026-10-07T10:00:${String(10 + n).padStart(2, '0')}Z`, ...over };
}
function arc(to: NetworkAddress = WALLET, over: Record<string, unknown> = {}): Fact {
  return fact('ARC_CONFIRMED', 'CHAIN', { chain: { chainId: 5042002n, txHash: TX, logIndex: 1n, emitter: SYSTEM_EMITTER, to, confirmed: true, units: 5_000_000n, ...over } as NonNullable<Fact['chain']> });
}
function ctx(i: string, o: string): TimelineContext {
  return { payIn: PAYINS[i] as PayInMethod, payout: PAYOUTS[o] as PayoutMethod, receiverAddress: WALLET, chainId: 5042002n };
}
const done = (t: ReturnType<typeof buildTimeline>) => t.filter((s) => s.state === 'DONE').map((s) => s.step);

describe('four combinations', () => {
  const cases: [string, string, string[]][] = [
    ['STABLE', 'STABLE', ['FUNDS_RESERVED', 'SENT', 'SETTLED_ON_ARC', 'ARRIVED']],
    ['STABLE', 'FIAT', ['FUNDS_RESERVED', 'SENT', 'SETTLED_ON_ARC', 'PAYOUT_STARTED', 'ARRIVED']],
    ['FIAT', 'STABLE', ['FUNDS_RESERVED', 'PAYIN_RECEIVED', 'CONVERTED', 'SENT', 'SETTLED_ON_ARC', 'ARRIVED']],
    ['FIAT', 'FIAT', ['FUNDS_RESERVED', 'PAYIN_RECEIVED', 'CONVERTED', 'SENT', 'SETTLED_ON_ARC', 'PAYOUT_STARTED', 'ARRIVED']],
  ];
  for (const [i, o, steps] of cases) {
    it(`${i} -> ${o}`, () => {
      expect(stepsFor(ctx(i, o).payIn, ctx(i, o).payout)).toEqual(steps);
      const facts: Fact[] = [
        fact('RESERVED', 'LEDGER'), fact('PAYIN_CONFIRMED', 'PARTNER'), fact('CONVERTED', 'PARTNER'), fact('ARC_SUBMITTED', 'LEDGER'),
        arc(), fact('PAYOUT_STARTED', 'PARTNER'), fact('PAYOUT_COMPLETE', 'PARTNER'),
      ];
      const t = buildTimeline(ctx(i, o), facts);
      expect(done(t)).toEqual(steps);
      for (const s of t) expect(s.licensedBy).not.toBeNull();
    });
  }
});

describe('licensing', () => {
  it('no facts: every step PENDING with no licence', () => {
    const t = buildTimeline(ctx('FIAT', 'FIAT'), []);
    expect(t.every((s) => s.state === 'PENDING' && s.licensedBy === null && s.at === null)).toBe(true);
  });
  it('a fact from the wrong source licenses nothing', () => {
    const t = buildTimeline(ctx('STABLE', 'STABLE'), [fact('RESERVED', 'PARTNER'), fact('ARC_SUBMITTED', 'CHAIN')]);
    expect(done(t)).toEqual([]);
  });
  it('a step licensed only by its own kind (SENT does not imply settled)', () => {
    expect(done(buildTimeline(ctx('STABLE', 'STABLE'), [fact('ARC_SUBMITTED', 'LEDGER')]))).toEqual(['SENT']);
  });
  it('unconfirmed, wrong-emitter, wrong-chain or zero-amount logs license nothing', () => {
    for (const bad of [{ confirmed: false }, { emitter: `0x${'ee'.repeat(20)}` }, { chainId: 1n }, { units: 0n }]) {
      expect(done(buildTimeline(ctx('STABLE', 'STABLE'), [arc(WALLET, bad)]))).toEqual([]);
    }
  });
});

describe('ARRIVED only on the payout final confirmation', () => {
  it('wallet payout: Arc log to a different address is not ARRIVED', () => {
    const t = buildTimeline(ctx('STABLE', 'STABLE'), [arc(OTHER)]);
    expect(hasArrived(t)).toBe(false);
  });
  it('wallet payout: partner payout-complete cannot license ARRIVED', () => {
    expect(hasArrived(buildTimeline(ctx('STABLE', 'STABLE'), [fact('PAYOUT_COMPLETE', 'PARTNER')]))).toBe(false);
  });
  it('wallet payout: confirmed log to receiver wallet licenses ARRIVED', () => {
    expect(hasArrived(buildTimeline(ctx('STABLE', 'STABLE'), [arc()]))).toBe(true);
  });
  it('fiat payout: Arc confirmation alone is not ARRIVED', () => {
    const t = buildTimeline(ctx('STABLE', 'FIAT'), [arc(), fact('PAYOUT_STARTED', 'PARTNER')]);
    expect(hasArrived(t)).toBe(false);
    expect(done(t)).toContain('SETTLED_ON_ARC');
  });
  it('fiat payout: payout-started is not ARRIVED; payout-complete from non-partner is ignored', () => {
    expect(hasArrived(buildTimeline(ctx('STABLE', 'FIAT'), [fact('PAYOUT_STARTED', 'PARTNER'), fact('PAYOUT_COMPLETE', 'LEDGER')]))).toBe(false);
  });
  it('fiat payout: partner payout-complete licenses ARRIVED', () => {
    expect(hasArrived(buildTimeline(ctx('STABLE', 'FIAT'), [fact('PAYOUT_COMPLETE', 'PARTNER')]))).toBe(true);
  });
  it('wallet payout with no receiver address fails closed', () => {
    expect(hasArrived(buildTimeline({ ...ctx('STABLE', 'STABLE'), receiverAddress: null }, [arc()]))).toBe(false);
  });
});

describe('duplicates', () => {
  it('the same fact twice, or two facts of one kind, give one step', () => {
    const r = fact('RESERVED', 'LEDGER');
    const t = buildTimeline(ctx('STABLE', 'STABLE'), [r, r, fact('RESERVED', 'LEDGER')]);
    expect(t.filter((s) => s.step === 'FUNDS_RESERVED')).toHaveLength(1);
    expect(t.find((s) => s.step === 'FUNDS_RESERVED')?.licensedBy?.factId).toBe(r.factId);
  });
  it('result is independent of fact order', () => {
    const fs = [fact('RESERVED', 'LEDGER'), fact('RESERVED', 'LEDGER'), arc()];
    expect(buildTimeline(ctx('STABLE', 'STABLE'), fs)).toEqual(buildTimeline(ctx('STABLE', 'STABLE'), [...fs].reverse()));
  });
});

function record(i: string, o: string, facts: Fact[], legs?: LegState[], over: Partial<JourneyRecord> = {}): JourneyRecord {
  const pi = PAYINS[i] as PayInMethod;
  const po = PAYOUTS[o] as PayoutMethod;
  const states: LegState[] = legs ?? journeyLegs(pi, po).map(() => ({ stage: 'CREATED', reason: null }) as LegState);
  return {
    paymentId: PID, ownerRef: 'owner-1', payIn: pi, payout: po, legs: states, compensatedBy: null, facts,
    send: { code: 'USDC', units: 5_000_000n, decimals: 6n }, receive: { code: 'USDC', units: 4_990_000n, decimals: 6n },
    receiverAddress: WALLET, chainId: 5042002n, ...over,
  };
}
const completed = (k: number): LegState[] => Array.from({ length: k }, () => ({ stage: 'COMPLETED', reason: null }) as LegState);

describe('amounts and view', () => {
  it('formatUnits is exact', () => {
    expect(formatUnits(1n, 6n)).toBe('0.000001');
    expect(formatUnits(12_345_678n, 6n)).toBe('12.345678');
    expect(formatUnits(5n, 0n)).toBe('5');
    expect(() => formatUnits(-1n, 6n)).toThrow();
  });
  it('status and stage come from src/status', () => {
    const v = viewOf(record('STABLE', 'STABLE', [arc()], completed(2)));
    expect(v.stage).toBe('COMPLETED');
    expect(v.status).toBe('SETTLED');
    expect(v.send.amount).toBe('5.000000');
    expect(viewOf(record('STABLE', 'STABLE', [], completed(2), { compensatedBy: 'p7-1' })).status).toBe('REVERSED');
    const f = viewOf(record('STABLE', 'STABLE', [], [{ stage: 'COMPLETED', reason: null }, { stage: 'REJECTED', reason: 'ONCHAIN_REVERTED' }]));
    expect(f.status).toBe('FAILED');
    expect(f.reason).toBe('ONCHAIN_REVERTED');
  });
  it('stage COMPLETED without the final fact does not show ARRIVED', () => {
    const v = viewOf(record('STABLE', 'FIAT', [arc()], completed(3)));
    expect(v.timeline.find((s) => s.step === 'ARRIVED')?.state).toBe('PENDING');
  });
  it('wrong leg count fails closed', () => {
    expect(() => viewOf(record('FIAT', 'FIAT', [], completed(2)))).toThrow();
  });
});

describe('handler GET /journeys/:id', () => {
  const rec = record('STABLE', 'STABLE', [arc()], completed(2));
  const h = createJourneyHandler({ get: (id, owner) => Promise.resolve(id === PID && owner === 'owner-1' ? rec : null) });
  it('200 with timeline, status, stage; amounts are strings', async () => {
    const r = await h({ method: 'GET', path: `/journeys/${PID}`, callerRef: 'owner-1' });
    expect(r.status).toBe(200);
    const b = r.body as { status: string; stage: string; send: { amount: unknown }; timeline: unknown[] };
    expect(b.status).toBe('SETTLED');
    expect(b.stage).toBe('COMPLETED');
    expect(typeof b.send.amount).toBe('string');
    expect(b.timeline.length).toBe(4);
    expect(JSON.stringify(r.body, (_k, v: unknown) => v)).toBeTypeOf('string'); // no bigint in the body
  });
  it('401, 400, 404, 405', async () => {
    expect((await h({ method: 'GET', path: `/journeys/${PID}`, callerRef: null })).status).toBe(401);
    expect((await h({ method: 'GET', path: '/journeys/x', callerRef: 'owner-1' })).status).toBe(400);
    expect((await h({ method: 'GET', path: `/journeys/${PID}`, callerRef: 'someone-else' })).status).toBe(404);
    expect((await h({ method: 'GET', path: '/nope', callerRef: 'owner-1' })).status).toBe(404);
    expect((await h({ method: 'POST', path: `/journeys/${PID}`, callerRef: 'owner-1' })).status).toBe(405);
  });
  it('inconsistent record -> 500 without detail', async () => {
    const bad = createJourneyHandler({ get: () => Promise.resolve(record('FIAT', 'FIAT', [], completed(1))) });
    const r = await bad({ method: 'GET', path: `/journeys/${PID}`, callerRef: 'owner-1' });
    expect(r).toEqual({ status: 500, body: { error: 'INTERNAL' } });
  });
});

describe('notifier', () => {
  const rec = record('STABLE', 'STABLE', [fact('RESERVED', 'LEDGER'), arc()], [{ stage: 'CONFIRMING', reason: null }, { stage: 'CONFIRMING', reason: null }]);
  const snapshot = (r: JourneyRecord) => JSON.stringify(r, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
  it('email and webhook both deliver once per step and carry no address in the payload', async () => {
    const email = new EmailNotifier(new Map([['owner-1', 'someone@example.test']]));
    const hook = new WebhookNotifier('https://hook.example.test/n', 'throwaway-secret');
    for (const nf of [email, hook]) {
      const out1 = await notifySteps(nf, rec, viewOf(rec));
      const out2 = await notifySteps(nf, rec, viewOf(rec));
      expect(out1.every((o) => o.delivered)).toBe(true);
      expect(out2).toEqual(out1);
    }
    expect(email.outbox).toHaveLength(3);
    expect(hook.posts).toHaveLength(3);
    expect(hook.posts[0]?.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(hook.posts.every((p) => !p.body.includes('example.test'))).toBe(true);
    expect(email.outbox[0]?.to).toBe('someone@example.test');
  });
  it('failure and throw never change money state', async () => {
    const before = snapshot(rec);
    const email = new EmailNotifier(new Map());
    const hook = new WebhookNotifier('https://hook.example.test/n', 'throwaway-secret');
    hook.responses = [500, 500, 500];
    const thrower: Notifier = { send: () => Promise.reject(new Error('boom')) };
    for (const nf of [email, hook, thrower, safeNotifier(thrower)]) {
      const out = await notifySteps(nf, rec, viewOf(rec));
      expect(out.every((o) => !o.delivered)).toBe(true);
    }
    expect(snapshot(rec)).toBe(before);
    const v = viewOf(rec);
    expect(v.status).toBe('PROCESSING');
  });
  it('webhook retry after 500 delivers once; email transient failure retries', async () => {
    const hook = new WebhookNotifier('https://hook.example.test/n', 'throwaway-secret');
    hook.responses = [503];
    const m = { key: 'ntf:k:1', recipientRef: 'o', paymentId: PID, step: 'SENT', amount: null };
    expect(await hook.send(m)).toEqual({ kind: 'FAILED', retryable: true });
    expect((await hook.send(m)).kind).toBe('SENT');
    expect(((await hook.send(m)) as { replayed: boolean }).replayed).toBe(true);
    const email = new EmailNotifier(new Map([['o', 'a@example.test']]));
    email.failNext = 1n;
    expect((await email.send(m)).kind).toBe('FAILED');
    expect((await email.send(m)).kind).toBe('SENT');
  });
});
