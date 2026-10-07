/**
 * JQUOTE fill desk (design delta 1, D-1), run against both FxPort fakes:
 * A (event queue, separate read-back) and B (ledger-backed, read-back of
 * what it posted). Cases go to a real OPS queue over OPS's own fakes.
 */
import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision, nativeWei } from '../../src/amounts/index.js';
import type { QuoteRequest } from '../../src/nova-ports/conversion.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { beneficiaryRef, fiatCode, idempotencyKey, ledgerAssetCode, lpDigestHex, novaAccountRef, paymentId } from '../../src/nova-ports/ids.js';
import type { PaymentId, PortResult } from '../../src/nova-ports/ids.js';
import type { LedgerAccount } from '../../src/nova-ports/ledger.js';
import type { OpenCaseInput, OpsCode } from '../../src/ops/queue.js';
import { CASE_KINDS, deriveCaseId, REASONS } from '../../src/ops/types.js';
import type { CaseRecord } from '../../src/ops/types.js';
import { composeJourneyQuote } from '../../src/journey/quote/compose.js';
import type { QuoteConfig, QuoteDeps } from '../../src/journey/quote/compose.js';
import { fiatAmount } from '../../src/journey/quote/fiat.js';
import { codeKey, fillCaseFor, FillDesk, FillDeskConfigError, fillDigest, opsFillCases } from '../../src/journey/quote/fill.js';
import type { CodeBinding, FillCasePort, FillCaseRequest, FillDecision, FillDeskConfig, FillDeskDeps } from '../../src/journey/quote/fill.js';
import { honestEntry, LedgerBackedFx, ManualClock, MapBookedEntries, msExpiryReader, QueuedFillFx } from '../../src/journey/quote/fakes.js';
import type { FillOverrides } from '../../src/journey/quote/fakes.js';
import type { FillEvent, FxLocker, FxPort, PricingCode, RawFillEvent } from '../../src/journey/quote/ports.js';

const ZAR = ledgerAssetCode('ZAR');
const EUR = ledgerAssetCode('EUR');
const USDC = ledgerAssetCode('USDC');
const P2 = cbsPrecision(2);
const P6 = cbsPrecision(6);
const T0 = 1_000_000n;
/** 5 minutes: the answer's "about 5 minutes" (DA-1), used only in tests. */
const TTL = 300_000n;
const TIMEOUT = 60_000n;
const EXP = T0 + TTL;

const PAY1 = paymentId(`pay-${'1'.repeat(32)}`);
const PAY2 = paymentId(`pay-${'2'.repeat(32)}`);
const CLIENT = 'client-uid-1';
const client: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acc-client-zar') };
const other: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acc-other-zar') };
const toAcc: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acc-client-usdc') };
const dust: LedgerAccount = { kind: 'ROLE', role: 'GL-4', sub: 'fxDust' };
const deskFrom: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'otcDeskZar' };
const deskTo: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'otcDeskUsdc' };
const accounts = { clientFrom: client, to: toAcc };

const binding = (pay: PaymentId = PAY1): CodeBinding => ({ paymentId: pay, clientUid: CLIENT, accounts });
const k1 = idempotencyKey('jq:fx:1');
const k2 = idempotencyKey('jq:fx:2');
const k3 = idempotencyKey('jq:fx:3');
/** 99,999 cents at 5000/9 (10000/18 reduced): 55,555,000 micro-USDC, remainder 0. */
const req: QuoteRequest = { from: ZAR, to: USDC, amount: cbsMinor(99_999n), side: 'FROM_EXACT' };
/** 100 euro cents at 1/3: 33 lots, 33 units, 1 cent of dust (worth 1/3 unit). */
const eurReq: QuoteRequest = { from: EUR, to: USDC, amount: cbsMinor(100n), side: 'FROM_EXACT' };

const PAIRS = [
  { from: ZAR, fromPrec: P2, to: USDC, toPrec: P6, lot: { from: cbsMinor(9n), to: cbsMinor(5000n) } },
  { from: EUR, fromPrec: P2, to: USDC, toPrec: P6, lot: { from: cbsMinor(3n), to: cbsMinor(1n) } },
];
const PRECISIONS = [
  [ZAR, P2],
  [EUR, P2],
  [USDC, P6],
] as const;

/**
 * A case port that applies OPS's own closed tables (CASE_KINDS, REASONS) and
 * case-id derivation, records every request, and can fail the next N opens
 * (AMBIGUOUS). The live OpsQueue is reached through `opsFillCases`.
 */
class RecordingCases implements FillCasePort {
  readonly requests: FillCaseRequest[] = [];
  readonly opened = new Map<string, FillCaseRequest>();
  failNext = 0n;

  async open(r: FillCaseRequest): Promise<PortResult<CaseRecord, OpsCode>> {
    this.requests.push(r);
    if (this.failNext > 0n) {
      this.failNext -= 1n;
      return { kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' };
    }
    if (!CASE_KINDS.includes(r.kind) || !REASONS[r.kind].includes(r.reason)) return { kind: 'REJECTED', code: 'REASON_INVALID', detail: `${r.kind}:${r.reason}` };
    const caseId = deriveCaseId(r.kind, r.subject);
    const replayed = this.opened.has(caseId);
    this.opened.set(caseId, r);
    return { kind: 'OK', value: { caseId } as unknown as CaseRecord, replayed };
  }
}

interface FillOpts {
  readonly filledAtMs: bigint;
  readonly clientDebit?: ReturnType<typeof cbsMinor>;
  readonly event?: FillOverrides;
  readonly booked?: { readonly clientFrom: LedgerAccount; readonly to: LedgerAccount; readonly dust: LedgerAccount };
}

interface Rig {
  readonly clock: ManualClock;
  readonly fx: FxPort & { readonly codeCount: bigint; sign(e: FillEvent): RawFillEvent };
  readonly faults: FaultPlan;
  readonly ledger: FillDeskDeps['ledger'];
  readonly cases: RecordingCases;
  desk(cfg?: Partial<FillDeskConfig>, deps?: Partial<FillDeskDeps>): FillDesk;
  /** A human fills the code and Nova books it; returns the signed event (A: queued; B: pushed). */
  fill(codeId: string, o: FillOpts): RawFillEvent;
  close(codeId: string, kind: 'REJECTED' | 'EXPIRED'): RawFillEvent;
  /** Releases queued events (A); B pushes at once. */
  deliver(): void;
}

function rigA(scheme: 'HMAC' | 'UNCONFIGURED' = 'HMAC'): Rig {
  const clock = new ManualClock(T0);
  const faults = new FaultPlan();
  const fx = new QueuedFillFx({ clock, pairs: PAIRS, ttlMs: TTL, limit: cbsMinor(100_000_000n), faults, scheme });
  const ledger = new MapBookedEntries(new Map(PRECISIONS), faults);
  return finish(clock, faults, fx, ledger, {
    fill(codeId, o) {
      const ref = `je-${codeId}`;
      const booked = fx.filled(codeId, { bookedEntryRef: ref, filledAtMs: o.filledAtMs });
      ledger.put(honestEntry(booked, { ...(o.booked ?? { ...accounts, dust }), deskFrom, deskTo }, o.clientDebit));
      return fx.emit({ ...booked, ...o.event });
    },
    close: (codeId, kind) => fx.emit({ kind, codeId }),
    deliver: () => fx.deliver(),
  });
}

function rigB(scheme: 'HMAC' | 'UNCONFIGURED' = 'HMAC'): Rig {
  const clock = new ManualClock(T0);
  const faults = new FaultPlan();
  const fx = new LedgerBackedFx({ clock, pairs: PAIRS, ttlMs: TTL, limit: cbsMinor(100_000_000n), faults, scheme, precisions: PRECISIONS, deskFrom, deskTo });
  return finish(clock, faults, fx, fx, {
    fill: (codeId, o) => fx.fillAtDesk(codeId, { accounts: o.booked ?? { ...accounts, dust }, filledAtMs: o.filledAtMs, ...(o.clientDebit === undefined ? {} : { clientDebit: o.clientDebit }), ...(o.event === undefined ? {} : { event: o.event }) }),
    close: (codeId, kind) => fx.closeAtDesk(codeId, kind),
    deliver: () => undefined,
  });
}

function finish(clock: ManualClock, faults: FaultPlan, fx: Rig['fx'], ledger: FillDeskDeps['ledger'], drive: Pick<Rig, 'fill' | 'close' | 'deliver'>): Rig {
  const cases = new RecordingCases();
  return {
    clock,
    fx,
    faults,
    ledger,
    cases,
    desk: (cfg = {}, deps = {}) =>
      new FillDesk({ fillTimeoutAfterExpiryMs: TIMEOUT, dustAccount: dust, usdcPrecision: P6, ...cfg }, { fx, ledger, cases, clock, readExpiry: msExpiryReader, ...deps }),
    ...drive,
  };
}

const RIGS: [string, (scheme?: 'HMAC' | 'UNCONFIGURED') => Rig][] = [
  ['fake A (event queue)', rigA],
  ['fake B (ledger-backed)', rigB],
];

async function lockOk(locker: FxLocker, key = k1, r: QuoteRequest = req) {
  const x = await locker.lockRate(key, r);
  if (x.kind !== 'OK') throw new Error(`expected OK, got ${JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`);
  return x;
}

function kindOf(d: FillDecision): string {
  return d.kind;
}

describe('codeKey and caseReasonFor', () => {
  it('derives the Nova key from the payment id and the quote request key', () => {
    expect(codeKey(PAY1, k1)).toBe(`fxc:${lpDigestHex(['jquote-fx-code', PAY1, k1])}`);
    expect(codeKey(PAY2, k1)).not.toBe(codeKey(PAY1, k1));
    expect(codeKey(PAY1, k2)).not.toBe(codeKey(PAY1, k1));
  });

  it('maps each cause to an OPS kind and a reason in OPS\'s closed REASONS table', () => {
    const want: [Parameters<typeof fillCaseFor>[0], string, string][] = [
      ['FILLED_AFTER_EXPIRY', 'UNMATCHED_FILL', 'FILL_AFTER_EXPIRY'],
      ['CODE_SUPERSEDED', 'UNMATCHED_FILL', 'FILL_AFTER_EXPIRY'],
      ['FILL_MISPOSTED', 'UNMATCHED_FILL', 'FILL_MISPOSTED'],
      ['CODE_NOT_OPEN', 'UNMATCHED_FILL', 'FILL_TERMS_MISMATCH'],
      ['PAIR_MISMATCH', 'UNMATCHED_FILL', 'FILL_TERMS_MISMATCH'],
      ['AMOUNT_MISMATCH', 'UNMATCHED_FILL', 'FILL_TERMS_MISMATCH'],
      ['RATE_MISMATCH', 'UNMATCHED_FILL', 'FILL_TERMS_MISMATCH'],
      ['FILL_TIMEOUT', 'FILL_TIMEOUT', 'NO_FILL_BY_TIMEOUT'],
      ['EXPIRED', 'REQUOTE', 'RATE_EXPIRED'],
      ['REJECTED', 'REQUOTE', 'RATE_CHANGED'],
      ['SIGNAL_CONFLICT', 'QUARANTINE', 'SIGNAL_CONFLICT'],
    ];
    for (const [cause, kind, reason] of want) {
      expect(fillCaseFor(cause)).toEqual({ kind, reason });
      expect(REASONS[fillCaseFor(cause).kind]).toContain(reason);
    }
  });

  it('opsFillCases hands OPS the input the trusted root builds from the request', async () => {
    const seen: OpenCaseInput[] = [];
    const toInput = (r: FillCaseRequest): OpenCaseInput => ({ kind: r.kind, reason: r.reason, subject: r.subject, paymentId: r.paymentId, clientUid: r.clientUid, amounts: null, options: [{ action: 'RELEASE_QUARANTINE', optionId: 'o-release' }], evidenceRefs: r.evidenceRefs });
    const port = opsFillCases({ openCase: async (i) => (seen.push(i), { kind: 'OK', value: { caseId: 'case-x' } as unknown as CaseRecord, replayed: false }) }, toInput);
    const r: FillCaseRequest = { kind: 'QUARANTINE', reason: 'SIGNAL_CONFLICT', subject: 'fill-conflict:c', paymentId: PAY1, clientUid: CLIENT, bookedEntryRef: null, evidenceRefs: ['fill:c'] };
    expect(await port.open(r)).toMatchObject({ kind: 'OK', value: { caseId: 'case-x' } });
    expect(seen).toEqual([toInput(r)]);
  });

  it('digests the canonical projection only: the reviewer and the envelope do not change it; every other field does', () => {
    const f = { kind: 'FILLED', codeId: 'c', from: ZAR, to: USDC, fromAmount: cbsMinor(9n), toAmount: cbsMinor(5000n), rate: { numerator: 5000n, denominator: 9n }, remainder: cbsMinor(0n), bookedEntryRef: 'je', filledAtMs: 1n, reviewer: 'r1' } as const;
    const d = fillDigest(f);
    expect(fillDigest({ ...f, reviewer: 'r2' })).toBe(d);
    for (const over of [{ codeId: 'd' }, { from: EUR }, { to: EUR }, { fromAmount: cbsMinor(10n) }, { toAmount: cbsMinor(1n) }, { rate: { numerator: 1n, denominator: 9n } }, { rate: { numerator: 5000n, denominator: 1n } }, { remainder: cbsMinor(1n) }, { bookedEntryRef: 'jf' }, { filledAtMs: 2n }]) {
      expect(fillDigest({ ...f, ...over })).not.toBe(d);
    }
    expect(fillDigest({ kind: 'REJECTED', codeId: 'c' })).toBe(lpDigestHex(['fx-fill-v1', 'REJECTED', 'c']));
    expect(fillDigest({ kind: 'EXPIRED', codeId: 'c' })).not.toBe(fillDigest({ kind: 'REJECTED', codeId: 'c' }));
  });
});

describe('FillDesk configuration fails closed', () => {
  it('refuses to start with the fill timeout unset (DQ-2) or negative, or the dust destination unset (D-5)', () => {
    const r = rigA();
    expect(() => r.desk({ fillTimeoutAfterExpiryMs: null })).toThrow(new FillDeskConfigError('fillTimeoutAfterExpiryMs is unset (DQ-2): set it explicitly'));
    expect(() => r.desk({ fillTimeoutAfterExpiryMs: -1n })).toThrow(new FillDeskConfigError('fillTimeoutAfterExpiryMs must not be negative'));
    expect(() => r.desk({ dustAccount: null })).toThrow(new FillDeskConfigError('the dust destination is unset (D-5, F-4): set it explicitly'));
    expect(r.desk({ fillTimeoutAfterExpiryMs: 0n })).toBeInstanceOf(FillDesk);
    const e = new FillDeskConfigError('x');
    expect([e.code, e.name, e.message]).toEqual(['FILL_DESK_CONFIG', 'FillDeskConfigError', 'fill desk configuration: x']);
  });

  it('refuses a binding without a payment id or client uid', () => {
    const desk = rigA().desk();
    expect(() => desk.lockerFor({ ...binding(), paymentId: 'pay-1' as PaymentId })).toThrow(TypeError);
    expect(() => desk.lockerFor({ ...binding(), clientUid: '' })).toThrow('code binding needs a payment id and a client uid');
  });
});

describe.each(RIGS)('FillDesk locker (getPricingCode): %s', (_n, make) => {
  it('requests one code, derives its quote at the code rate, and locks the rate until the code expiresAt', async () => {
    const r = make();
    const locker = r.desk().lockerFor(binding());
    const x = await lockOk(locker);
    expect(x.replayed).toBe(false);
    expect(x.value.expiresAtMs).toBe(EXP);
    expect(x.value.quote).toMatchObject({ from: { asset: ZAR, amount: 99_999n, precision: P2 }, to: { asset: USDC, amount: 55_555_000n, precision: P6 }, rate: { numerator: 5000n, denominator: 9n }, remainder: 0n, provider: 'otc-code', expiresAt: `ms:${EXP}` });
    expect(r.fx.codeCount).toBe(1n);
    // The same key and request replays the same lock and writes no second code.
    expect(await locker.lockRate(k1, req)).toEqual({ kind: 'OK', value: x.value, replayed: true });
    expect(r.fx.codeCount).toBe(1n);
    expect(await locker.lockRate(k1, { ...req, amount: cbsMinor(9n) })).toEqual({ kind: 'REJECTED', code: 'KEY_CONFLICT', detail: `key ${k1} reused with another request` });
  });

  it('a TO_EXACT code with dust-free whole lots; a FROM_EXACT code keeps sub-unit dust', async () => {
    const r = make();
    const t = await lockOk(r.desk().lockerFor(binding()), k1, { ...req, side: 'TO_EXACT', amount: cbsMinor(55_555_000n) });
    expect(t.value.quote).toMatchObject({ from: { amount: 99_999n }, remainder: 0n });
    const e = await lockOk(r.desk().lockerFor(binding(PAY2)), k1, eurReq);
    expect(e.value.quote).toMatchObject({ from: { amount: 100n }, to: { amount: 33n }, remainder: 1n });
  });

  it('passes NO_ROUTE, LIMIT and AMBIGUOUS through; after an AMBIGUOUS commit the retry replays the same code', async () => {
    const r = make();
    const locker = r.desk().lockerFor(binding());
    expect(await locker.lockRate(k1, { ...req, from: ledgerAssetCode('GBP') })).toMatchObject({ kind: 'REJECTED', code: 'NO_ROUTE' });
    expect(await locker.lockRate(k1, { ...req, to: EUR })).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'ZAR->EUR' });
    expect(await locker.lockRate(k2, { ...req, amount: cbsMinor(100_000_008n) })).toEqual({ kind: 'REJECTED', code: 'LIMIT', detail: '100000008 > 100000000' });
    r.faults.arm('getPricingCode', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await locker.lockRate(k3, req)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    r.faults.arm('getPricingCode', 'AFTER_COMMIT', 'TRANSPORT');
    expect(await locker.lockRate(k3, req)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    const again = await lockOk(locker, k3);
    expect(again.replayed).toBe(true);
    expect(r.fx.codeCount).toBe(1n);
  });

  it('refuses when the ledger does not know an asset; AMBIGUOUS when the precision lookup is unknown (no code written)', async () => {
    const r = make();
    const locker = r.desk().lockerFor(binding());
    r.faults.arm('getAssetPrecision', 'BEFORE_COMMIT', 'UNAVAILABLE');
    expect(await locker.lockRate(k1, req)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
    expect(r.fx.codeCount).toBe(0n);
    const desk = r.desk({}, { ledger: { getBookedEntry: r.ledger.getBookedEntry.bind(r.ledger), getAssetPrecision: async (a) => (a === USDC ? { kind: 'AMBIGUOUS', cause: 'TIMEOUT' } : r.ledger.getAssetPrecision(a)) } });
    expect(await desk.lockerFor(binding()).lockRate(k1, req)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    const unknownTo = r.desk({}, { ledger: { getBookedEntry: r.ledger.getBookedEntry.bind(r.ledger), getAssetPrecision: async (a) => (a === USDC ? { kind: 'REJECTED', code: 'ASSET_UNKNOWN', detail: a } : r.ledger.getAssetPrecision(a)) } });
    expect(await unknownTo.lockerFor(binding()).lockRate(k1, req)).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'ZAR->USDC: asset unknown to the ledger' });
    const unknownFrom = r.desk({}, { ledger: { getBookedEntry: r.ledger.getBookedEntry.bind(r.ledger), getAssetPrecision: async (a) => (a === ZAR ? { kind: 'REJECTED', code: 'ASSET_UNKNOWN', detail: a } : r.ledger.getAssetPrecision(a)) } });
    expect(await unknownFrom.lockerFor(binding()).lockRate(k1, req)).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'ZAR->USDC: asset unknown to the ledger' });
    expect(r.fx.codeCount).toBe(0n);
  });
});

/** An FxPort that rewrites the codes Nova returns (a malformed or unusable code). */
function rewriting(fx: FxPort, f: (c: PricingCode) => PricingCode): FxPort {
  return {
    getPricingCode: async (k, q) => {
      const x = await fx.getPricingCode(k, q);
      return x.kind === 'OK' ? { ...x, value: f(x.value) } : x;
    },
    awaitFill: (c) => fx.awaitFill(c),
    verifyFillEvent: (b, h) => fx.verifyFillEvent(b, h),
  };
}

describe.each(RIGS)('FillDesk refuses unusable codes but records them, so a fill on one is never dropped: %s', (_n, make) => {
  it('BAD_EXPIRY: an unreadable expiry is refused, never defaulted; the refusal replays without a second code', async () => {
    const r = make();
    const desk = r.desk({}, { readExpiry: () => null });
    const locker = desk.lockerFor(binding());
    const want = { kind: 'REJECTED', code: 'BAD_EXPIRY', detail: `unreadable expiry "ms:${EXP}"` };
    expect(await locker.lockRate(k1, req)).toEqual(want);
    expect(await locker.lockRate(k1, req)).toEqual(want);
    expect(r.fx.codeCount).toBe(1n);
    // An unusable code does not block a requote (the next code is asked for, and refused on its own expiry).
    expect(await locker.lockRate(k2, req)).toMatchObject({ kind: 'REJECTED', code: 'BAD_EXPIRY' });
    expect(r.fx.codeCount).toBe(2n);
    // A human fills it anyway: booked, so an unmatched fill (not adoptable), with a case.
    const replay = await r.fx.getPricingCode(codeKey(PAY1, k1), req);
    const codeId = replay.kind === 'OK' ? replay.value.codeId : '';
    const d = await desk.receive(r.fill(codeId, { filledAtMs: T0 + 1n }));
    expect(d).toMatchObject({ kind: 'UNMATCHED_FILL', refusal: 'CODE_NOT_OPEN', detail: `code ${codeId} is UNUSABLE`, adoptable: false });
    expect(r.cases.requests).toHaveLength(1);
    expect(await locker.lockRate(k3, req)).toEqual({ kind: 'REJECTED', code: 'FILL_OUTSTANDING', detail: `the booked fill of code ${codeId} is not adopted or reversed` });
  });

  it('BAD_CODE: a non-positive rate (recorded), a code with no usable id (not recorded), a code id bound to another request', async () => {
    const r = make();
    const zero = r.desk({}, { fx: rewriting(r.fx, (c) => ({ ...c, rate: { numerator: 0n, denominator: 9n } })) }).lockerFor(binding());
    expect(await zero.lockRate(k1, req)).toEqual({ kind: 'REJECTED', code: 'BAD_CODE', detail: 'the code rate is not a ratio of positive integers' });
    expect(await zero.lockRate(k1, req)).toEqual({ kind: 'REJECTED', code: 'BAD_CODE', detail: 'the code rate is not a ratio of positive integers' });
    const noId = r.desk({}, { fx: rewriting(r.fx, (c) => ({ ...c, codeId: 'a b' })) }).lockerFor(binding());
    expect(await noId.lockRate(k1, req)).toEqual({ kind: 'REJECTED', code: 'BAD_CODE', detail: 'the pricing code has no usable id' });
    const same = r.desk({}, { fx: rewriting(r.fx, (c) => ({ ...c, codeId: 'fixed-code' })) });
    expect((await same.lockerFor(binding()).lockRate(k1, req)).kind).toBe('OK');
    expect(await same.lockerFor(binding(PAY2)).lockRate(k2, req)).toEqual({ kind: 'REJECTED', code: 'BAD_CODE', detail: 'code fixed-code is already bound to another request' });
  });

  it('NO_ROUTE: the amount does not convert exactly at the code rate, or the derived quote fails checkFxLock', async () => {
    const r = make();
    const tiny = r.desk({}, { fx: rewriting(r.fx, (c) => ({ ...c, rate: { numerator: 1n, denominator: 100_000n } })) }).lockerFor(binding());
    expect(await tiny.lockRate(k1, req)).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'the amount does not convert exactly at the code rate' });
    // 10000/18 unreduced: 5,555 lots and 9 cents left, worth 5,000 units: withheld value, never dust.
    const coarse = r.desk({}, { fx: rewriting(r.fx, (c) => ({ ...c, rate: { numerator: 10_000n, denominator: 18n } })) }).lockerFor(binding(PAY2));
    expect(await coarse.lockRate(k1, req)).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'the code quote is not exact: remainder is worth one target minor unit or more' });
    // At another USDC precision the code quote is refused too.
    const p8 = r.desk({ usdcPrecision: cbsPrecision(8) }).lockerFor(binding(paymentId(`pay-${'3'.repeat(32)}`)));
    expect(await p8.lockRate(k1, req)).toEqual({ kind: 'REJECTED', code: 'NO_ROUTE', detail: 'the code quote is not exact: quote is at another USDC precision' });
  });
});

describe.each(RIGS)('FillDesk fills (D-1 checks 1-5): %s', (_n, make) => {
  async function opened(r: Rig, desk = r.desk(), pay: PaymentId = PAY1, key = k1, q = req) {
    const x = await lockOk(desk.lockerFor(binding(pay)), key, q);
    return { desk, codeId: x.value.quote.quoteId, lock: x.value };
  }

  it('accepts an honest fill made before expiry; the journey proceeds only on it', async () => {
    const r = make();
    const { desk, codeId } = await opened(r);
    expect(desk.acceptedFill(PAY1)).toBeNull();
    const d = await desk.receive(r.fill(codeId, { filledAtMs: EXP - 1n }));
    expect(d).toMatchObject({ kind: 'FILL_ACCEPTED', codeId, paymentId: PAY1, duplicate: false, fill: { fromAmount: 99_999n, toAmount: 55_555_000n, bookedEntryRef: `je-${codeId}` } });
    expect(desk.acceptedFill(PAY1)).toMatchObject({ codeId });
    expect(desk.acceptedFill(PAY2)).toBeNull();
    expect(desk.bookedConversionProblem(PAY1)).toBeNull();
    expect(r.cases.requests).toHaveLength(0);
    // A booked conversion blocks a second code for the payment.
    expect(await desk.lockerFor(binding()).lockRate(k2, req)).toEqual({ kind: 'REJECTED', code: 'FILL_OUTSTANDING', detail: `the payment has a booked conversion (code ${codeId})` });
  });

  it('accepts a fill with dust posted exactly to the dust destination', async () => {
    const r = make();
    const { desk, codeId } = await opened(r, r.desk(), PAY1, k1, eurReq);
    expect(await desk.receive(r.fill(codeId, { filledAtMs: T0 }))).toMatchObject({ kind: 'FILL_ACCEPTED', fill: { remainder: 1n } });
  });

  it('expiry is judged by Nova filledAt: just before is live even when delivered after expiry and after the timeout; at and after is not', async () => {
    const r = make();
    const { desk, codeId } = await opened(r);
    r.clock.advance(TTL + TIMEOUT + 5n);
    expect(await desk.sweepTimeouts()).toHaveLength(1);
    expect(await desk.receive(r.fill(codeId, { filledAtMs: EXP - 1n }))).toMatchObject({ kind: 'FILL_ACCEPTED' });
    for (const at of [EXP, EXP + 1n]) {
      const s = make();
      const o = await opened(s);
      const d = await o.desk.receive(s.fill(o.codeId, { filledAtMs: at }));
      expect(d).toMatchObject({ kind: 'UNMATCHED_FILL', refusal: 'FILLED_AFTER_EXPIRY', adoptable: true, bookedEntryRef: `je-${o.codeId}`, detail: `filled at ${at}, code expired at ${EXP}` });
      expect(o.desk.acceptedFill(PAY1)).toBeNull();
      expect(s.cases.requests).toEqual([
        { kind: 'UNMATCHED_FILL', reason: 'FILL_AFTER_EXPIRY', subject: `fill:${o.codeId}`, paymentId: PAY1, clientUid: CLIENT, bookedEntryRef: `je-${o.codeId}`, evidenceRefs: [`fill:${o.codeId}`, `booked:je-${o.codeId}`, 'refusal:FILLED_AFTER_EXPIRY'] },
      ]);
      expect((d as { caseId: string }).caseId).toBe(deriveCaseId('UNMATCHED_FILL', `fill:${o.codeId}`));
    }
  });

  it('refuses a fill whose amounts differ from the quote, and M1: a self-consistent fill at 550/1', async () => {
    const r = make();
    const { desk, codeId } = await opened(r);
    const d = await desk.receive(r.fill(codeId, { filledAtMs: T0, event: { rate: { numerator: 550n, denominator: 1n }, toAmount: cbsMinor(54_999_450n) } }));
    expect(d).toMatchObject({ kind: 'UNMATCHED_FILL', refusal: 'AMOUNT_MISMATCH', adoptable: false });
    expect(r.cases.requests[0]).toMatchObject({ kind: 'UNMATCHED_FILL', reason: 'FILL_TERMS_MISMATCH', bookedEntryRef: `je-${codeId}`, evidenceRefs: [`fill:${codeId}`, `booked:je-${codeId}`, 'refusal:AMOUNT_MISMATCH'] });
    const s = make();
    const o = await opened(s);
    expect(await o.desk.receive(s.fill(o.codeId, { filledAtMs: T0, event: { rate: { numerator: 550n, denominator: 1n } } }))).toMatchObject({ refusal: 'RATE_MISMATCH', adoptable: false });
    const p = make();
    const o2 = await opened(p);
    expect(await o2.desk.receive(p.fill(o2.codeId, { filledAtMs: T0, event: { to: EUR } }))).toMatchObject({ refusal: 'PAIR_MISMATCH', adoptable: false });
  });

  it('M2: an over-debited client with the to side equal to the quote is FILL_MISPOSTED (read-back), as is a wrong client or a missing entry', async () => {
    const cases: [FillOpts, string][] = [
      [{ filledAtMs: T0, clientDebit: cbsMinor(100_008n) }, 'client is not debited exactly the from amount'],
      [{ filledAtMs: T0, booked: { clientFrom: other, to: toAcc, dust } }, 'client is not debited exactly the from amount'],
      [{ filledAtMs: T0, booked: { clientFrom: client, to: other, dust } }, 'to side is not credited exactly the to amount'],
    ];
    for (const [o, why] of cases) {
      const r = make();
      const x = await opened(r);
      expect(await x.desk.receive(r.fill(x.codeId, o))).toMatchObject({ kind: 'UNMATCHED_FILL', refusal: 'FILL_MISPOSTED', detail: why, adoptable: false });
      expect(x.desk.adopt(x.codeId)).toEqual({ kind: 'REJECTED', code: 'NOT_ADOPTABLE', detail: 'FILL_MISPOSTED: closes only by a reversal (P12)' });
    }
    const r = make();
    const x = await opened(r);
    expect(await x.desk.receive(r.fill(x.codeId, { filledAtMs: T0, event: { bookedEntryRef: 'je-missing' } }))).toMatchObject({ refusal: 'FILL_MISPOSTED', detail: 'booked entry je-missing not found' });
  });

  it('a read-back with an unknown outcome decides nothing (RETRY); the redelivery decides', async () => {
    const r = make();
    const { desk, codeId } = await opened(r);
    const raw = r.fill(codeId, { filledAtMs: T0 });
    r.faults.arm('getBookedEntry', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await desk.receive(raw)).toEqual({ kind: 'RETRY', detail: 'the booked entry read-back outcome is unknown' });
    expect(desk.acceptedFill(PAY1)).toBeNull();
    expect(await desk.receive(raw)).toMatchObject({ kind: 'FILL_ACCEPTED', duplicate: false });
  });

  it('a duplicate event has no second effect; a second, different event for the code is SIGNAL_CONFLICT and quarantines the payment', async () => {
    const r = make();
    const { desk, codeId } = await opened(r);
    const raw = r.fill(codeId, { filledAtMs: T0 });
    expect(await desk.receive(raw)).toMatchObject({ kind: 'FILL_ACCEPTED', duplicate: false });
    expect(await desk.receive(raw)).toMatchObject({ kind: 'FILL_ACCEPTED', duplicate: true });
    // The same projection under another envelope (another reviewer) is the same event.
    expect(await desk.receive(r.fx.sign({ ...(await decoded(r, raw)), reviewer: 'desk-reviewer-2' }))).toMatchObject({ kind: 'FILL_ACCEPTED', duplicate: true });
    expect(r.cases.requests).toHaveLength(0);
    const second = r.fx.sign({ ...(await decoded(r, raw)), filledAtMs: T0 + 7n });
    const first = fillDigest(await decoded(r, raw));
    const c = await desk.receive(second);
    expect(c).toMatchObject({ kind: 'SIGNAL_CONFLICT', codeId, paymentId: PAY1, duplicate: false });
    expect(r.cases.requests).toEqual([{ kind: 'QUARANTINE', reason: 'SIGNAL_CONFLICT', subject: `fill-conflict:${codeId}`, paymentId: PAY1, clientUid: CLIENT, bookedEntryRef: null, evidenceRefs: [`fill:${codeId}`, `first-digest:${first}`] }]);
    expect((c as { caseId: string }).caseId).toMatch(/^case-/);
    expect(desk.isQuarantined(PAY1)).toBe(true);
    expect(desk.isQuarantined(PAY2)).toBe(false);
    expect(desk.acceptedFill(PAY1)).toBeNull();
    expect(await desk.lockerFor(binding()).lockRate(k2, req)).toEqual({ kind: 'REJECTED', code: 'FILL_OUTSTANDING', detail: 'the payment is quarantined (SIGNAL_CONFLICT)' });
    // A REJECTED after a FILLED is a conflict too (at most one outcome per code).
    expect(await desk.receive(r.fx.sign({ kind: 'REJECTED', codeId }))).toMatchObject({ kind: 'SIGNAL_CONFLICT' });
    // A conflict on a code this package never requested has no payment to quarantine.
    const u1 = r.fx.sign({ kind: 'EXPIRED', codeId: 'stranger' });
    expect(await desk.receive(u1)).toEqual({ kind: 'UNKNOWN_CODE', codeId: 'stranger', duplicate: false });
    expect(await desk.receive(u1)).toEqual({ kind: 'UNKNOWN_CODE', codeId: 'stranger', duplicate: true });
    expect(await desk.receive(r.fx.sign({ kind: 'REJECTED', codeId: 'stranger' }))).toEqual({ kind: 'SIGNAL_CONFLICT', codeId: 'stranger', paymentId: null, caseId: null, duplicate: false });
  });

  it('authenticity first: an invalid or missing signature is refused with no state change', async () => {
    const r = make();
    const { desk, codeId } = await opened(r);
    const raw = r.fill(codeId, { filledAtMs: T0 });
    const tampered: RawFillEvent = { rawBody: raw.rawBody.replace('"filledAtMs":"', '"filledAtMs":"1'), headers: raw.headers };
    expect(await desk.receive(tampered)).toEqual({ kind: 'REFUSED', code: 'BAD_SIGNATURE', detail: 'signature missing or invalid' });
    expect(await desk.receive({ rawBody: raw.rawBody, headers: {} })).toEqual({ kind: 'REFUSED', code: 'BAD_SIGNATURE', detail: 'signature missing or invalid' });
    expect(await desk.receive({ rawBody: raw.rawBody, headers: { 'x-fake-fill-signature': 'zz' } })).toMatchObject({ code: 'BAD_SIGNATURE' });
    expect(await desk.receive({ rawBody: raw.rawBody, headers: { 'x-fake-fill-signature': '0'.repeat(64) } })).toMatchObject({ code: 'BAD_SIGNATURE' });
    expect(await desk.receive({ rawBody: '{}', headers: r.fx.sign({ kind: 'REJECTED', codeId }).headers })).toMatchObject({ code: 'BAD_SIGNATURE' });
    expect(r.cases.requests).toHaveLength(0);
    // Nothing changed: the genuine event is still accepted as the first outcome.
    expect(await desk.receive(raw)).toMatchObject({ kind: 'FILL_ACCEPTED', duplicate: false });
  });

  it('an authentic event that is not a fill event, or fails the shape check, is MALFORMED; an unknown verify outcome is RETRY', async () => {
    const r = make();
    const { desk, codeId } = await opened(r);
    expect(await desk.receive(r.fx.sign({ kind: 'PAID', codeId } as unknown as FillEvent))).toEqual({ kind: 'REFUSED', code: 'MALFORMED', detail: 'not a fill event' });
    const good = await decoded(r, r.fill(codeId, { filledAtMs: T0 }));
    expect(await desk.receive(r.fx.sign({ ...good, rate: { numerator: 0n, denominator: 9n } }))).toEqual({ kind: 'REFUSED', code: 'MALFORMED', detail: 'rate must be a ratio of positive integers' });
    r.faults.arm('verifyFillEvent', 'BEFORE_COMMIT', 'TRANSPORT');
    expect(await desk.receive(r.fx.sign(good))).toEqual({ kind: 'RETRY', detail: 'the authenticity check outcome is unknown (TRANSPORT)' });
    expect(await desk.receive(r.fx.sign(good))).toMatchObject({ kind: 'FILL_ACCEPTED' });
  });

  it('REJECTED and EXPIRED book nothing: a requote case, and a new code may be requested at once', async () => {
    for (const kind of ['REJECTED', 'EXPIRED'] as const) {
      const r = make();
      const { desk, codeId } = await opened(r);
      const raw = r.close(codeId, kind);
      const d = await desk.receive(raw);
      expect(d).toMatchObject({ kind: 'REQUOTE_REQUIRED', codeId, paymentId: PAY1, outcome: kind, duplicate: false });
      expect(r.cases.requests).toEqual([{ kind: 'REQUOTE', reason: kind === 'EXPIRED' ? 'RATE_EXPIRED' : 'RATE_CHANGED', subject: `code:${codeId}`, paymentId: PAY1, clientUid: CLIENT, bookedEntryRef: null, evidenceRefs: [`code:${codeId}`, `outcome:${kind}`] }]);
      expect(await desk.receive(raw)).toMatchObject({ kind: 'REQUOTE_REQUIRED', duplicate: true });
      expect(r.cases.requests).toHaveLength(1);
      expect(desk.bookedConversionProblem(PAY1)).toBeNull();
      expect((await desk.lockerFor(binding()).lockRate(k2, req)).kind).toBe('OK');
      expect(await desk.sweepTimeouts()).toEqual([]);
    }
  });

  it('with the signature scheme unanswered (DQ-1) no fill is accepted: the journey holds and the fill window ends in a case', async () => {
    const r = make('UNCONFIGURED');
    const { desk, codeId } = await opened(r);
    const d = await desk.receive(r.fill(codeId, { filledAtMs: T0 }));
    expect(d).toEqual({ kind: 'REFUSED', code: 'SCHEME_UNCONFIGURED', detail: 'the fill-event signature scheme is not known yet (DQ-1)' });
    expect(desk.acceptedFill(PAY1)).toBeNull();
    r.clock.advance(TTL + TIMEOUT);
    expect(await desk.sweepTimeouts()).toMatchObject([{ codeId, paymentId: PAY1 }]);
  });
});

async function decoded(r: Rig, raw: RawFillEvent): Promise<Extract<FillEvent, { kind: 'FILLED' }>> {
  const v = await r.fx.verifyFillEvent(raw.rawBody, raw.headers);
  if (v.kind !== 'OK' || v.value.kind !== 'FILLED') throw new Error('expected a FILLED event');
  return v.value;
}

describe.each(RIGS)('FillDesk fill timeout, requote guard, late fills, ADOPT and REVERSE: %s', (_n, make) => {
  it('a fill that never arrives: one case at exactly expiresAt + timeout (injected clock), none before, none twice', async () => {
    const r = make();
    const desk = r.desk();
    const { value } = await lockOk(desk.lockerFor(binding()));
    const codeId = value.quote.quoteId;
    const pending = desk.awaitFill(codeId);
    r.clock.advance(TTL + TIMEOUT - 1n);
    expect(await desk.sweepTimeouts()).toEqual([]);
    // The guard holds the requote while a fill made before expiry may still arrive (verifier delta1 m12).
    expect(await desk.lockerFor(binding()).lockRate(k2, req)).toEqual({ kind: 'REJECTED', code: 'FILL_OUTSTANDING', detail: `the outcome of code ${codeId} is not known yet` });
    r.clock.advance(1n);
    const t = await desk.sweepTimeouts();
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ codeId, paymentId: PAY1 });
    expect(t[0]!.caseId).toMatch(/^case-/);
    expect(r.cases.requests).toEqual([{ kind: 'FILL_TIMEOUT', reason: 'NO_FILL_BY_TIMEOUT', subject: `fill-timeout:${codeId}`, paymentId: PAY1, clientUid: CLIENT, bookedEntryRef: null, evidenceRefs: [`code:${codeId}`, 'refusal:FILL_TIMEOUT'] }]);
    expect(await desk.sweepTimeouts()).toEqual([]);
    expect((await desk.lockerFor(binding()).lockRate(k2, req)).kind).toBe('OK');
    // The awaited fill never came.
    expect(await Promise.race([pending.then(() => 'arrived'), Promise.resolve('pending')])).toBe('pending');
  });

  it('a timeout case that cannot be opened is retried by the next sweep', async () => {
    const r = make();
    const desk = r.desk();
    const { value } = await lockOk(desk.lockerFor(binding()));
    r.clock.advance(TTL + TIMEOUT);
    r.cases.failNext = 1n;
    expect(await desk.sweepTimeouts()).toEqual([{ codeId: value.quote.quoteId, paymentId: PAY1, caseId: null }]);
    const again = await desk.sweepTimeouts();
    expect(again).toHaveLength(1);
    expect(again[0]!.caseId).toMatch(/^case-/);
    expect(await desk.sweepTimeouts()).toEqual([]);
  });

  it('a late fill after a requote is never a second booked conversion: REVERSE path', async () => {
    const r = make();
    const desk = r.desk();
    const a = (await lockOk(desk.lockerFor(binding()), k1)).value;
    r.clock.advance(TTL + TIMEOUT);
    const b = (await lockOk(desk.lockerFor(binding()), k2)).value;
    expect(await desk.receive(r.fill(b.quote.quoteId, { filledAtMs: r.clock.nowMs() }))).toMatchObject({ kind: 'FILL_ACCEPTED' });
    // Code A was filled before it expired, but delivered after the requote.
    const late = await desk.receive(r.fill(a.quote.quoteId, { filledAtMs: EXP - 1n }));
    expect(late).toMatchObject({ kind: 'UNMATCHED_FILL', refusal: 'CODE_SUPERSEDED', adoptable: true, detail: `code ${a.quote.quoteId} was superseded by a requote` });
    expect(r.cases.requests.at(-1)).toMatchObject({ kind: 'UNMATCHED_FILL', reason: 'FILL_AFTER_EXPIRY', subject: `fill:${a.quote.quoteId}`, bookedEntryRef: `je-${a.quote.quoteId}` });
    expect(desk.acceptedFill(PAY1)).toMatchObject({ codeId: b.quote.quoteId });
    expect(desk.bookedConversionProblem(PAY1)).toBe(`the booked fill of code ${a.quote.quoteId} is neither adopted nor reversed`);
    // ADOPT would double count the client's fiat: refused.
    expect(desk.adopt(a.quote.quoteId)).toEqual({ kind: 'REJECTED', code: 'CONVERSION_EXISTS', detail: `the payment already has a booked conversion (code ${b.quote.quoteId})` });
    expect(desk.recordReversal(a.quote.quoteId, 'p12-journal-1')).toEqual({ kind: 'OK', value: undefined, replayed: false });
    expect(desk.bookedConversionProblem(PAY1)).toBeNull();
    expect(desk.recordReversal(a.quote.quoteId, 'p12-journal-1')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
  });

  it('a late fill after a requote: ADOPT path (the requote consumes the booked fill; the newer code is superseded)', async () => {
    const r = make();
    const desk = r.desk();
    const a = (await lockOk(desk.lockerFor(binding()), k1)).value;
    r.clock.advance(TTL + TIMEOUT);
    const b = (await lockOk(desk.lockerFor(binding()), k2)).value;
    const late = await desk.receive(r.fill(a.quote.quoteId, { filledAtMs: EXP - 1n }));
    expect(late).toMatchObject({ refusal: 'CODE_SUPERSEDED', adoptable: true });
    // While unresolved, no new code may be requested.
    expect(await desk.lockerFor(binding()).lockRate(k3, req)).toEqual({ kind: 'REJECTED', code: 'FILL_OUTSTANDING', detail: `the booked fill of code ${a.quote.quoteId} is not adopted or reversed` });
    expect(desk.adopt(a.quote.quoteId)).toEqual({ kind: 'OK', value: a, replayed: false });
    expect(desk.acceptedFill(PAY1)).toMatchObject({ codeId: a.quote.quoteId });
    expect(desk.bookedConversionProblem(PAY1)).toBeNull();
    expect(desk.adopt(a.quote.quoteId)).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    // A fill of the superseded newer code is booked but never a second conversion.
    expect(await desk.receive(r.fill(b.quote.quoteId, { filledAtMs: r.clock.nowMs() }))).toMatchObject({ kind: 'UNMATCHED_FILL', refusal: 'CODE_SUPERSEDED' });
    expect(desk.adopt(b.quote.quoteId)).toMatchObject({ kind: 'REJECTED', code: 'CONVERSION_EXISTS' });
    expect(desk.bookedConversionProblem(PAY1)).toBe(`the booked fill of code ${b.quote.quoteId} is neither adopted nor reversed`);
  });

  it('ADOPT of a fill that failed only on expiry; never of a mismatched one or on a quarantined payment', async () => {
    const r = make();
    const desk = r.desk();
    const a = (await lockOk(desk.lockerFor(binding()))).value;
    await desk.receive(r.fill(a.quote.quoteId, { filledAtMs: EXP }));
    expect(desk.adopt('nope')).toEqual({ kind: 'REJECTED', code: 'NOT_FOUND', detail: 'no unresolved booked fill on code nope' });
    expect(desk.adopt(a.quote.quoteId)).toMatchObject({ kind: 'OK' });
    const s = make();
    const d2 = s.desk();
    const c = (await lockOk(d2.lockerFor(binding()))).value;
    const raw = s.fill(c.quote.quoteId, { filledAtMs: EXP });
    await d2.receive(raw);
    await d2.receive(s.fx.sign({ ...(await decoded(s, raw)), filledAtMs: EXP + 9n }));
    expect(d2.adopt(c.quote.quoteId)).toEqual({ kind: 'REJECTED', code: 'NOT_ADOPTABLE', detail: 'the payment is quarantined' });
    expect(d2.recordReversal(c.quote.quoteId, 'bad ref')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
    expect(d2.recordReversal('nope', 'p12')).toMatchObject({ kind: 'REJECTED', code: 'NOT_FOUND' });
  });

  it('an accepted code has no unmatched fill to adopt or reverse', async () => {
    const r = make();
    const desk = r.desk();
    const a = (await lockOk(desk.lockerFor(binding()))).value;
    await desk.receive(r.fill(a.quote.quoteId, { filledAtMs: T0 }));
    expect(desk.adopt(a.quote.quoteId)).toMatchObject({ code: 'NOT_FOUND' });
    expect(desk.recordReversal(a.quote.quoteId, 'p12')).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('a case that could not be opened is opened on the redelivery, with no second decision', async () => {
    const r = make();
    const desk = r.desk();
    const a = (await lockOk(desk.lockerFor(binding()))).value;
    const raw = r.fill(a.quote.quoteId, { filledAtMs: EXP });
    r.cases.failNext = 1n;
    expect(await desk.receive(raw)).toMatchObject({ kind: 'UNMATCHED_FILL', caseId: null, duplicate: false });
    const again = await desk.receive(raw);
    expect(again).toMatchObject({ kind: 'UNMATCHED_FILL', duplicate: true });
    expect((again as { caseId: string }).caseId).toMatch(/^case-/);
    expect(await desk.receive(raw)).toEqual(again);
    const s = make();
    const d2 = s.desk();
    const b = (await lockOk(d2.lockerFor(binding()))).value;
    const rej = s.close(b.quote.quoteId, 'REJECTED');
    s.cases.failNext = 1n;
    expect(await d2.receive(rej)).toMatchObject({ kind: 'REQUOTE_REQUIRED', caseId: null });
    expect(await d2.receive(rej)).toMatchObject({ kind: 'REQUOTE_REQUIRED', duplicate: true, caseId: expect.stringMatching(/^case-/) });
  });

  it('concurrent deliveries of one event decide once', async () => {
    const r = make();
    const desk = r.desk();
    const a = (await lockOk(desk.lockerFor(binding()))).value;
    const raw = r.fill(a.quote.quoteId, { filledAtMs: EXP });
    const [x, y] = await Promise.all([desk.receive(raw), desk.receive(raw)]);
    expect([kindOf(x), kindOf(y)]).toEqual(['UNMATCHED_FILL', 'UNMATCHED_FILL']);
    expect([x, y].map((d) => (d as { duplicate: boolean }).duplicate).sort()).toEqual([false, true]);
    expect(r.cases.requests).toHaveLength(1);
    // A concurrent delivery whose first decision is RETRY is RETRY too.
    const s = make();
    const d2 = s.desk();
    const b = (await lockOk(d2.lockerFor(binding()))).value;
    const raw2 = s.fill(b.quote.quoteId, { filledAtMs: T0 });
    s.faults.arm('getBookedEntry', 'BEFORE_COMMIT', 'TIMEOUT');
    const both = await Promise.all([d2.receive(raw2), d2.receive(raw2)]);
    expect(both.map(kindOf)).toEqual(['RETRY', 'RETRY']);
    expect(await d2.receive(raw2)).toMatchObject({ kind: 'FILL_ACCEPTED', duplicate: false });
  });

  it('awaitFill takes the event Nova pushes for the code and decides it', async () => {
    const r = make();
    const desk = r.desk();
    const a = (await lockOk(desk.lockerFor(binding()))).value;
    const waiting = desk.awaitFill(a.quote.quoteId);
    r.fill(a.quote.quoteId, { filledAtMs: T0 });
    r.deliver();
    expect(await waiting).toMatchObject({ kind: 'FILL_ACCEPTED', codeId: a.quote.quoteId });
  });
});

describe('FxPort fakes: delivery models differ', () => {
  it('fake A holds an event until delivered; fake B pushes it, or keeps it until awaited', async () => {
    const a = rigA();
    const da = a.desk();
    const ca = (await lockOk(da.lockerFor(binding()))).value.quote.quoteId;
    const wa = a.fx.awaitFill(ca);
    a.fill(ca, { filledAtMs: T0 });
    expect(await Promise.race([wa.then(() => 'arrived'), Promise.resolve('queued')])).toBe('queued');
    a.deliver();
    expect(await Promise.race([wa.then(() => 'arrived'), new Promise((res) => setTimeout(() => res('queued'), 5))])).toBe('arrived');
    const b = rigB();
    const db = b.desk();
    const cb = (await lockOk(db.lockerFor(binding()))).value.quote.quoteId;
    const raw = b.fill(cb, { filledAtMs: T0 });
    expect(await b.fx.awaitFill(cb)).toEqual(raw);
    expect(await Promise.race([b.fx.awaitFill(cb).then(() => 'arrived'), Promise.resolve('waiting')])).toBe('waiting');
  });

  it('fake B is its own read-back: NOT_FOUND for an unknown entry; A and B refuse fills of unknown codes', async () => {
    const b = rigB();
    expect(await b.ledger.getBookedEntry('je-none')).toEqual({ kind: 'REJECTED', code: 'NOT_FOUND', detail: 'je-none' });
    expect(() => b.fill('nope', { filledAtMs: T0 })).toThrow('no code nope');
    expect(() => rigA().fill('nope', { filledAtMs: T0 })).toThrow('no code nope');
    expect(await rigA().ledger.getAssetPrecision(ledgerAssetCode('GBP'))).toMatchObject({ kind: 'REJECTED', code: 'ASSET_UNKNOWN' });
    expect(await b.ledger.getAssetPrecision(ledgerAssetCode('GBP'))).toMatchObject({ kind: 'REJECTED', code: 'ASSET_UNKNOWN' });
  });
});

describe.each(RIGS)('the composer over the fill desk (rate lock = the code expiresAt): %s', (_n, make) => {
  const ZARF = fiatCode('ZAR');
  const cfg: QuoteConfig = {
    settlement: { network: 'ARC', asset: 'USDC', ledgerCode: USDC, precision: P6 },
    homeCurrency: ZARF,
    flags: { fiatEnabled: true, stablecoinDepositEnabled: true },
    crossBorder: { mode: 'OFF' },
    ttlMs: 600_000n,
    gasCharging: 'COMPANY_ABSORBS',
    platformFeeMinor: cbsMinor(0n),
  };
  const wallet = { method: 'STABLECOIN_WALLET', asset: 'USDC', network: 'ARC', beneficiaryRef: beneficiaryRef('ben-1') } as const;
  const deps = (r: Rig, desk: FillDesk, pay: PaymentId = PAY1): QuoteDeps => ({
    clock: r.clock,
    settlementNetwork: { network: 'ARC', chainId: 5042002n },
    fx: desk.lockerFor(binding(pay)),
    payout: null,
    networkFeeAllowanceWei: () => nativeWei(0n),
  });

  it('SEND_EXACT R999.99 -> 55.555000 USDC, expiring at the code expiry (before our own TTL); the journey proceeds only after an accepted fill', async () => {
    const r = make();
    const desk = r.desk();
    const q = await composeJourneyQuote({ requestId: 'req-1', payIn: { method: 'FIAT', currency: ZARF }, payout: wallet, side: 'SEND_EXACT', amount: { kind: 'FIAT', fiat: fiatAmount(ZARF, 99_999n) } }, cfg, deps(r, desk));
    if (q.kind !== 'OK') throw new Error(JSON.stringify(q.kind));
    expect(q.value.convertIn).toMatchObject({ to: 55_555_000n, provider: 'otc-code', expiresAtMs: EXP, rate: { numerator: 5000n, denominator: 9n } });
    expect(q.value.expiresAtMs).toBe(EXP);
    expect(q.value.recipient).toEqual({ kind: 'STABLECOIN', asset: 'USDC', minor: 55_555_000n });
    expect(desk.acceptedFill(PAY1)).toBeNull();
    const codeId = q.value.convertIn!.fxQuoteId;
    expect(await desk.receive(r.fill(codeId, { filledAtMs: EXP - 1n }))).toMatchObject({ kind: 'FILL_ACCEPTED', fill: { toAmount: q.value.convertIn!.to } });
    // The same request replays the same code; a requote for the converted payment is refused.
    const again = await composeJourneyQuote({ requestId: 'req-1', payIn: { method: 'FIAT', currency: ZARF }, payout: wallet, side: 'SEND_EXACT', amount: { kind: 'FIAT', fiat: fiatAmount(ZARF, 99_999n) } }, cfg, deps(r, desk));
    expect(again.kind === 'OK' && again.value.convertIn?.fxQuoteId).toBe(codeId);
    const requote = await composeJourneyQuote({ requestId: 'req-2', payIn: { method: 'FIAT', currency: ZARF }, payout: wallet, side: 'SEND_EXACT', amount: { kind: 'FIAT', fiat: fiatAmount(ZARF, 99_999n) } }, cfg, deps(r, desk));
    expect(requote).toEqual({ kind: 'REJECTED', code: 'FILL_OUTSTANDING', detail: `the payment has a booked conversion (code ${codeId})` });
  });

  it('RECEIVE_EXACT 55.555000 USDC costs R999.99; an amount that does not convert exactly at the code rate is refused (NO_ROUTE)', async () => {
    const r = make();
    const desk = r.desk();
    const q = await composeJourneyQuote({ requestId: 'req-1', payIn: { method: 'FIAT', currency: ZARF }, payout: wallet, side: 'RECEIVE_EXACT', amount: { kind: 'STABLECOIN', asset: 'USDC', minor: cbsMinor(55_555_000n) } }, cfg, deps(r, desk));
    expect(q.kind === 'OK' && q.value.payer).toEqual({ kind: 'FIAT', fiat: fiatAmount(ZARF, 99_999n) });
    const bad = await composeJourneyQuote({ requestId: 'req-1', payIn: { method: 'FIAT', currency: ZARF }, payout: wallet, side: 'RECEIVE_EXACT', amount: { kind: 'STABLECOIN', asset: 'USDC', minor: cbsMinor(55_555_001n) } }, cfg, deps(r, desk, PAY2));
    expect(bad).toMatchObject({ kind: 'REJECTED', code: 'NO_ROUTE' });
  });
});
