import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision, nativeWei } from '../../src/amounts/index.js';
import type { NativeWei } from '../../src/amounts/index.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { beneficiaryRef, fiatCode, ledgerAssetCode, lpDigestHex } from '../../src/nova-ports/ids.js';
import type { PortResult } from '../../src/nova-ports/ids.js';
import type { PayInMethod, PayoutMethod } from '../../src/status/journey.js';
import {
  checkConservation,
  composeJourneyQuote,
  crossBorderAllowed,
  isCrossBorder,
  isQuoteLive,
  QuoteIntegrityError,
  quoteCallKey,
  quoteDigest,
  quoteFields,
} from '../../src/journey/quote/compose.js';
import type { CrossBorderConfig, JourneyMoney, JourneyQuote, JourneyQuoteRequest, QuoteConfig, QuoteDeps, QuoteRefusal, SettlementAsset } from '../../src/journey/quote/compose.js';
import { fiatAmount } from '../../src/journey/quote/fiat.js';
import { LotTableFx, LotTablePayoutQuotes, ManualClock } from '../../src/journey/quote/fakes.js';
import type { FxPort, PartnerKind, PayoutQuote, PayoutQuotePort } from '../../src/journey/quote/ports.js';

// ---------------------------------------------------------------------------
// Fixture: USDC at ledger p = 6 on ARC; ZAR home; a ZAR->USDC lot of 37 cents
// -> 20_000 units; partner lots USDC->ZAR 20_000 -> 37 (fee 100 cents) and
// USDC->USD 10_000 -> 1 (fee 50 cents). Gas allowance 420 minor + 123 wei.
// ---------------------------------------------------------------------------

const P2 = cbsPrecision(2);
const P6 = cbsPrecision(6);
const ZAR = fiatCode('ZAR');
const USD = fiatCode('USD');
const USDC = ledgerAssetCode('USDC');
const K = 1_000_000_000_000n; // wei per USDC minor unit at p = 6
const GAS = nativeWei(420n * K + 123n);
const T0 = 1_000_000n;

const settlement: SettlementAsset = { network: 'ARC', asset: 'USDC', ledgerCode: USDC, precision: P6 };
const DEMO: CrossBorderConfig = { mode: 'TESTNET_DEMO_STUB_ONLY', chainId: 5042002n };

function cfg(over: Partial<QuoteConfig> = {}): QuoteConfig {
  return {
    settlement,
    homeCurrency: ZAR,
    flags: { fiatEnabled: true, stablecoinDepositEnabled: true },
    crossBorder: { mode: 'OFF' },
    ttlMs: 60_000n,
    gasCharging: 'COMPANY_ABSORBS',
    ...over,
  };
}

interface World {
  readonly clock: ManualClock;
  readonly fx: LotTableFx;
  readonly payout: LotTablePayoutQuotes;
  readonly fxFaults: FaultPlan;
  readonly payoutFaults: FaultPlan;
  readonly deps: QuoteDeps;
}

function world(gas: NativeWei = GAS, limits: { fx?: bigint; payout?: bigint } = {}): World {
  const clock = new ManualClock(T0);
  const fxFaults = new FaultPlan();
  const payoutFaults = new FaultPlan();
  const fx = new LotTableFx({
    clock,
    pairs: [{ from: ledgerAssetCode('ZAR'), fromPrecision: P2, to: USDC, toPrecision: P6, lot: { from: cbsMinor(37n), to: cbsMinor(20000n) } }],
    ttlMs: 30_000n,
    limit: cbsMinor(limits.fx ?? 10_000_000n),
    faults: fxFaults,
  });
  const payout = new LotTablePayoutQuotes({
    clock,
    source: USDC,
    sourcePrecision: P6,
    prices: new Map([
      [ZAR, { lot: { from: cbsMinor(20000n), to: cbsMinor(37n) }, fee: cbsMinor(100n) }],
      [USD, { lot: { from: cbsMinor(10000n), to: cbsMinor(1n) }, fee: cbsMinor(50n) }],
    ]),
    ttlMs: 20_000n,
    limit: cbsMinor(limits.payout ?? 100_000_000n),
    faults: payoutFaults,
  });
  return { clock, fx, payout, fxFaults, payoutFaults, deps: { clock, fx, payout, networkFeeAllowanceWei: (n) => (n === 'ARC' ? gas : nativeWei(0n)) } };
}

const BAL: PayInMethod = { method: 'STABLECOIN_BALANCE', asset: 'USDC', network: 'ARC' };
const DEP: PayInMethod = { method: 'STABLECOIN_DEPOSIT', asset: 'USDC', network: 'ARC' };
const FIAT_ZAR: PayInMethod = { method: 'FIAT', currency: ZAR };
const FIAT_USD: PayInMethod = { method: 'FIAT', currency: USD };
const BEN = beneficiaryRef('ben-1');
const WALLET: PayoutMethod = { method: 'STABLECOIN_WALLET', asset: 'USDC', network: 'ARC', beneficiaryRef: BEN };
const BANK_ZAR: PayoutMethod = { method: 'FIAT_BANK', currency: ZAR, beneficiaryRef: BEN };
const BANK_USD: PayoutMethod = { method: 'FIAT_BANK', currency: USD, beneficiaryRef: BEN };

const usdc = (n: bigint): JourneyMoney => ({ kind: 'STABLECOIN', asset: 'USDC', minor: cbsMinor(n) });
const fiat = (c: string, n: bigint): JourneyMoney => ({ kind: 'FIAT', fiat: fiatAmount(fiatCode(c), n) });

function request(payIn: PayInMethod, payout: PayoutMethod, side: JourneyQuoteRequest['side'], amount: JourneyMoney, requestId = 'req-1'): JourneyQuoteRequest {
  return { requestId, payIn, payout, side, amount };
}

async function quoteOk(req: JourneyQuoteRequest, c: QuoteConfig, deps: QuoteDeps): Promise<JourneyQuote> {
  const r = await composeJourneyQuote(req, c, deps);
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${JSON.stringify(r)}`);
  expect(r.replayed).toBe(false);
  expect(checkConservation(r.value, settlement)).toBeNull();
  expect(r.value.quoteId).toMatch(/^jq-[0-9a-f]{64}$/);
  expect(Object.isFrozen(r.value)).toBe(true);
  return r.value;
}

function refusal(code: QuoteRefusal, detail: string): PortResult<never, QuoteRefusal> {
  return { kind: 'REJECTED', code, detail };
}

/** Counts port calls and lets a test rewrite or replace answers. */
function spyFx(inner: FxPort, onCall?: (n: bigint) => void, rewrite?: (r: Awaited<ReturnType<FxPort['lockRate']>>) => Awaited<ReturnType<FxPort['lockRate']>>): FxPort & { calls: bigint } {
  const spy = {
    calls: 0n,
    async lockRate(...args: Parameters<FxPort['lockRate']>) {
      spy.calls += 1n;
      const r = await inner.lockRate(...args);
      onCall?.(spy.calls);
      return rewrite === undefined ? r : rewrite(r);
    },
  };
  return spy;
}

function spyPayout(inner: PayoutQuotePort, kind: PartnerKind = inner.partnerKind, rewrite?: (r: Awaited<ReturnType<PayoutQuotePort['quotePayout']>>, n: bigint) => Awaited<ReturnType<PayoutQuotePort['quotePayout']>>): PayoutQuotePort & { calls: bigint } {
  const spy = {
    partnerKind: kind,
    calls: 0n,
    async quotePayout(...args: Parameters<PayoutQuotePort['quotePayout']>) {
      spy.calls += 1n;
      const r = await inner.quotePayout(...args);
      return rewrite === undefined ? r : rewrite(r, spy.calls);
    },
  };
  return spy;
}

// ---------------------------------------------------------------------------
// The four combinations.
// ---------------------------------------------------------------------------

describe('JQUOTE stablecoin pay-in -> stablecoin wallet (no conversion, no payout)', () => {
  it('SEND_EXACT, company absorbs gas: payer = receiver = Arc amount, exact 18-dp view', async () => {
    const w = world();
    const fx = spyFx(w.fx);
    const po = spyPayout(w.payout);
    const q = await quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(5_000_000n)), cfg(), { ...w.deps, fx, payout: po });
    expect(fx.calls).toBe(0n);
    expect(po.calls).toBe(0n);
    expect(q.legs).toEqual(['RESERVE', 'ARC_TRANSFER']);
    expect(q.payer).toEqual(usdc(5_000_000n));
    expect(q.recipient).toEqual(usdc(5_000_000n));
    expect(q.allInRate).toEqual({ numerator: 5_000_000n, denominator: 5_000_000n });
    expect(q.arcTransfer).toEqual({
      leg: 'ARC_TRANSFER',
      network: 'ARC',
      asset: 'USDC',
      destination: 'RECEIVER_WALLET',
      amount: 5_000_000n,
      amountWei: 5_000_000n * K,
      gasAllowanceWei: GAS,
      gasChargeMinor: 0n,
      gasDustWei: 0n,
    });
    expect(q.convertIn).toBeNull();
    expect(q.payoutLine).toBeNull();
    expect(q.dust).toEqual([]);
    expect(q.crossBorder).toBe(false);
    expect(q.demoOnly).toBe(false);
    expect(q.createdAtMs).toBe(T0);
    expect(q.expiresAtMs).toBe(T0 + 60_000n);
    expect(q.side).toBe('SEND_EXACT');
    expect(q.requestId).toBe('req-1');
    expect(q.payIn).toBe(BAL);
    expect(q.payout).toBe(WALLET);
  });

  it('SEND_EXACT, gas charged to payer: whole minor units charged, sub-minor wei recorded as dust (never dropped)', async () => {
    const w = world();
    const q = await quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(5_000_000n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), w.deps);
    expect(q.recipient).toEqual(usdc(4_999_580n));
    expect(q.arcTransfer.amount).toBe(4_999_580n);
    expect(q.arcTransfer.gasChargeMinor).toBe(420n);
    expect(q.arcTransfer.gasDustWei).toBe(123n);
    expect(q.dust).toEqual([{ source: 'GAS_ALLOWANCE_SUBMINOR', wei: 123n, suspense: 'GL-4 arc.gasDust' }]);
    expect(q.allInRate).toEqual({ numerator: 4_999_580n, denominator: 5_000_000n });
  });

  it('a gas allowance of whole minor units leaves no dust record', async () => {
    const w = world(nativeWei(420n * K));
    const q = await quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(5_000_000n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), w.deps);
    expect(q.dust).toEqual([]);
    expect(q.arcTransfer.gasChargeMinor).toBe(420n);
  });

  it('RECEIVE_EXACT from a deposit, gas charged: payer pays receiver amount plus the charge', async () => {
    const w = world();
    const q = await quoteOk(request(DEP, WALLET, 'RECEIVE_EXACT', usdc(1_000_000n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), w.deps);
    expect(q.legs).toEqual(['AWAIT_DEPOSIT', 'RESERVE', 'ARC_TRANSFER']);
    expect(q.payer).toEqual(usdc(1_000_420n));
    expect(q.recipient).toEqual(usdc(1_000_000n));
    expect(q.arcTransfer.amount).toBe(1_000_000n);
  });

  it('refuses an amount that does not cover the charged network fee', async () => {
    const w = world();
    expect(await composeJourneyQuote(request(BAL, WALLET, 'SEND_EXACT', usdc(420n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), w.deps)).toEqual(
      refusal('AMOUNT_TOO_SMALL', 'the amount does not cover the network fee'),
    );
    const q = await quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(421n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), w.deps);
    expect(q.recipient).toEqual(usdc(1n));
  });
});

describe('JQUOTE fiat pay-in -> stablecoin wallet (CONVERT_IN only)', () => {
  it('SEND_EXACT R100.00: FX remainder recorded for Nova engine suspense; expiry is the FX lock', async () => {
    const w = world();
    const q = await quoteOk(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 10000n)), cfg(), w.deps);
    expect(q.legs).toEqual(['RESERVE', 'CONVERT_IN', 'ARC_TRANSFER']);
    expect(q.payer).toEqual(fiat('ZAR', 10000n));
    expect(q.recipient).toEqual(usdc(5_400_000n));
    expect(q.convertIn).toEqual({
      leg: 'CONVERT_IN',
      fxQuoteId: 'fx-1',
      provider: 'lot-table',
      rate: { numerator: 20000n, denominator: 37n },
      from: { currency: 'ZAR', minor: 10000n },
      to: 5_400_000n,
      remainder: { currency: 'ZAR', minor: 10n },
      expiresAtMs: T0 + 30_000n,
    });
    expect(q.dust).toEqual([{ source: 'FX_REMAINDER', fiat: { currency: 'ZAR', minor: 10n }, suspense: 'NOVA_FX_ENGINE_SUSPENSE' }]);
    expect(q.expiresAtMs).toBe(T0 + 30_000n);
    expect(q.payoutLine).toBeNull();
    expect(q.allInRate).toEqual({ numerator: 5_400_000n, denominator: 10000n });
  });

  it('SEND_EXACT with no FX remainder records no FX dust', async () => {
    const w = world();
    const q = await quoteOk(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 9990n)), cfg(), w.deps);
    expect(q.dust).toEqual([]);
    expect(q.convertIn?.remainder).toEqual({ currency: 'ZAR', minor: 0n });
  });

  it('RECEIVE_EXACT: FX quoted TO_EXACT for the receiver amount', async () => {
    const w = world();
    const q = await quoteOk(request(FIAT_ZAR, WALLET, 'RECEIVE_EXACT', usdc(5_400_000n)), cfg(), w.deps);
    expect(q.payer).toEqual(fiat('ZAR', 9990n));
    expect(q.recipient).toEqual(usdc(5_400_000n));
    expect(q.convertIn?.to).toBe(5_400_000n);
  });

  it('RECEIVE_EXACT that the engine cannot convert exactly: NO_ROUTE passed through', async () => {
    const w = world();
    expect(await composeJourneyQuote(request(FIAT_ZAR, WALLET, 'RECEIVE_EXACT', usdc(5_400_000n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), w.deps)).toEqual(
      refusal('NO_ROUTE', 'amount does not convert exactly'),
    );
  });
});

describe('JQUOTE stablecoin pay-in -> fiat bank (PAYOUT only)', () => {
  it('SEND_EXACT: a partner remainder is re-quoted once and set aside as dust; partner funded with exactly what it converts', async () => {
    const w = world();
    const po = spyPayout(w.payout);
    const q = await quoteOk(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(5_410_000n)), cfg(), { ...w.deps, payout: po });
    expect(po.calls).toBe(2n);
    expect(q.legs).toEqual(['RESERVE', 'ARC_TRANSFER', 'PAYOUT']);
    expect(q.arcTransfer.destination).toBe('PARTNER_SETTLEMENT');
    expect(q.arcTransfer.amount).toBe(5_400_000n);
    expect(q.payoutLine).toEqual({
      leg: 'PAYOUT',
      payoutQuoteId: 'po-2',
      partnerKind: 'TEST_FAKE',
      rate: { numerator: 37n, denominator: 20000n },
      source: 5_400_000n,
      gross: { currency: 'ZAR', minor: 9990n },
      fee: { currency: 'ZAR', minor: 100n },
      net: { currency: 'ZAR', minor: 9890n },
      expiresAtMs: T0 + 20_000n,
    });
    expect(q.recipient).toEqual(fiat('ZAR', 9890n));
    expect(q.dust).toEqual([{ source: 'PAYOUT_REMAINDER', usdcMinor: 10_000n, suspense: 'GL-4 arc.quoteDust' }]);
    expect(q.expiresAtMs).toBe(T0 + 20_000n);
  });

  it('SEND_EXACT with an exact partner amount quotes once', async () => {
    const w = world();
    const po = spyPayout(w.payout);
    const q = await quoteOk(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(5_400_000n)), cfg(), { ...w.deps, payout: po });
    expect(po.calls).toBe(1n);
    expect(q.payoutLine?.payoutQuoteId).toBe('po-1');
    expect(q.dust).toEqual([]);
  });

  it('RECEIVE_EXACT from a deposit: net exact, the partner prices the USDC needed', async () => {
    const w = world();
    const q = await quoteOk(request(DEP, BANK_ZAR, 'RECEIVE_EXACT', fiat('ZAR', 9890n)), cfg(), w.deps);
    expect(q.legs).toEqual(['AWAIT_DEPOSIT', 'RESERVE', 'ARC_TRANSFER', 'PAYOUT']);
    expect(q.payer).toEqual(usdc(5_400_000n));
    expect(q.recipient).toEqual(fiat('ZAR', 9890n));
    expect(q.payoutLine?.source).toBe(5_400_000n);
  });

  it('a partner whose second quote still leaves a remainder is refused (NO_ROUTE)', async () => {
    const w = world();
    const bad: PayoutQuote = {
      payoutQuoteId: 'x',
      currency: ZAR,
      source: cbsMinor(5_400_000n),
      sourcePrecision: P6,
      rate: { numerator: 37n, denominator: 20000n },
      remainder: cbsMinor(20_000n),
      gross: cbsMinor(9953n),
      fee: cbsMinor(100n),
      net: cbsMinor(9853n),
      expiresAtMs: T0 + 1n,
    };
    const po = spyPayout(w.payout, 'TEST_FAKE', (r, n) => (n === 2n ? { kind: 'OK', value: bad, replayed: false } : r));
    expect(await composeJourneyQuote(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(5_410_000n)), cfg(), { ...w.deps, payout: po })).toEqual(
      refusal('NO_ROUTE', 'partner cannot quote an exact source amount'),
    );
  });

  it('a second partner call that is AMBIGUOUS or REJECTED stops the quote', async () => {
    const w = world();
    const amb = spyPayout(w.payout, 'TEST_FAKE', (r, n) => (n === 2n ? { kind: 'AMBIGUOUS', cause: 'TRANSPORT' } : r));
    expect(await composeJourneyQuote(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(5_410_000n)), cfg(), { ...w.deps, payout: amb })).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
    const w2 = world();
    const rej = spyPayout(w2.payout, 'TEST_FAKE', (r, n) => (n === 2n ? { kind: 'REJECTED', code: 'LIMIT', detail: 'd' } : r));
    expect(await composeJourneyQuote(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(5_410_000n)), cfg(), { ...w2.deps, payout: rej })).toEqual(refusal('LIMIT', 'd'));
  });
});

describe('JQUOTE fiat pay-in -> fiat bank (CONVERT_IN and PAYOUT)', () => {
  it('SEND_EXACT with charged gas: every leg, every dust record, all in', async () => {
    const w = world();
    const q = await quoteOk(request(FIAT_ZAR, BANK_ZAR, 'SEND_EXACT', fiat('ZAR', 10010n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), w.deps);
    expect(q.legs).toEqual(['RESERVE', 'CONVERT_IN', 'ARC_TRANSFER', 'PAYOUT']);
    // 10010 cents = 270 lots (9990) + 20 remainder -> 5_400_000; less 420 gas = 5_399_580;
    // partner: 269 lots (5_380_000) + 19_580 remainder -> 9953 gross, 9853 net.
    expect(q.convertIn?.to).toBe(5_400_000n);
    expect(q.arcTransfer.amount).toBe(5_380_000n);
    expect(q.arcTransfer.gasChargeMinor).toBe(420n);
    expect(q.recipient).toEqual(fiat('ZAR', 9853n));
    expect(q.dust).toEqual([
      { source: 'FX_REMAINDER', fiat: { currency: 'ZAR', minor: 20n }, suspense: 'NOVA_FX_ENGINE_SUSPENSE' },
      { source: 'GAS_ALLOWANCE_SUBMINOR', wei: 123n, suspense: 'GL-4 arc.gasDust' },
      { source: 'PAYOUT_REMAINDER', usdcMinor: 19_580n, suspense: 'GL-4 arc.quoteDust' },
    ]);
    expect(q.expiresAtMs).toBe(T0 + 20_000n);
    expect(q.allInRate).toEqual({ numerator: 9853n, denominator: 10010n });
  });

  it('RECEIVE_EXACT with charged gas: work backward through the partner, then FX TO_EXACT', async () => {
    const w = world(nativeWei(20_000n * K + 7n));
    const q = await quoteOk(request(FIAT_ZAR, BANK_ZAR, 'RECEIVE_EXACT', fiat('ZAR', 9890n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), w.deps);
    expect(q.payoutLine?.source).toBe(5_400_000n);
    expect(q.convertIn?.to).toBe(5_420_000n);
    expect(q.payer).toEqual(fiat('ZAR', 271n * 37n));
    expect(q.recipient).toEqual(fiat('ZAR', 9890n));
    expect(q.dust).toEqual([{ source: 'GAS_ALLOWANCE_SUBMINOR', wei: 7n, suspense: 'GL-4 arc.gasDust' }]);
  });
});

// ---------------------------------------------------------------------------
// Cross-border: OFF until a legal opinion is recorded.
// ---------------------------------------------------------------------------

describe('JQUOTE cross-border flag', () => {
  it('refuses a foreign-currency bank payout by default, before any port is called', async () => {
    const w = world();
    const po = spyPayout(w.payout);
    expect(await composeJourneyQuote(request(BAL, BANK_USD, 'RECEIVE_EXACT', fiat('USD', 50n)), cfg(), { ...w.deps, payout: po })).toEqual(
      refusal('CROSS_BORDER_DISABLED', 'cross-border stays OFF until a legal opinion is recorded'),
    );
    expect(po.calls).toBe(0n);
  });

  it('the labelled testnet demo mode serves the stub/fake partner path, marked demoOnly', async () => {
    const w = world();
    const q = await quoteOk(request(DEP, BANK_USD, 'RECEIVE_EXACT', fiat('USD', 50n)), cfg({ crossBorder: DEMO }), w.deps);
    expect(q.crossBorder).toBe(true);
    expect(q.demoOnly).toBe(true);
    expect(q.payer).toEqual(usdc(1_000_000n));
    expect(q.recipient).toEqual(fiat('USD', 50n));
  });

  it('the demo mode never serves a LIVE partner, a foreign fiat pay-in, or another chain', async () => {
    const w = world();
    const live = spyPayout(w.payout, 'LIVE');
    const refused = refusal('CROSS_BORDER_DISABLED', 'cross-border stays OFF until a legal opinion is recorded');
    expect(await composeJourneyQuote(request(BAL, BANK_USD, 'RECEIVE_EXACT', fiat('USD', 50n)), cfg({ crossBorder: DEMO }), { ...w.deps, payout: live })).toEqual(refused);
    expect(await composeJourneyQuote(request(FIAT_USD, WALLET, 'SEND_EXACT', fiat('USD', 100n)), cfg({ crossBorder: DEMO }), w.deps)).toEqual(refused);
    const mainnet = { mode: 'TESTNET_DEMO_STUB_ONLY', chainId: 5042n } as unknown as CrossBorderConfig;
    expect(await composeJourneyQuote(request(BAL, BANK_USD, 'RECEIVE_EXACT', fiat('USD', 50n)), cfg({ crossBorder: mainnet }), w.deps)).toEqual(refused);
  });

  it('isCrossBorder: a fiat leg in a non-home currency', () => {
    expect(isCrossBorder(BAL, WALLET, ZAR)).toBe(false);
    expect(isCrossBorder(FIAT_ZAR, BANK_ZAR, ZAR)).toBe(false);
    expect(isCrossBorder(FIAT_USD, WALLET, ZAR)).toBe(true);
    expect(isCrossBorder(BAL, BANK_USD, ZAR)).toBe(true);
    expect(isCrossBorder(FIAT_USD, BANK_ZAR, ZAR)).toBe(true);
    expect(isCrossBorder(FIAT_ZAR, BANK_USD, ZAR)).toBe(true);
  });

  it('crossBorderAllowed truth table', () => {
    expect(crossBorderAllowed({ mode: 'OFF' }, BAL, BANK_USD, ZAR, 'TEST_FAKE')).toBe(false);
    const offWithChain = { mode: 'OFF', chainId: 5042002n } as unknown as CrossBorderConfig;
    expect(crossBorderAllowed(offWithChain, BAL, BANK_USD, ZAR, 'TEST_FAKE')).toBe(false);
    expect(crossBorderAllowed(DEMO, BAL, BANK_USD, ZAR, 'TEST_FAKE')).toBe(true);
    expect(crossBorderAllowed(DEMO, BAL, BANK_USD, ZAR, 'STUB')).toBe(true);
    expect(crossBorderAllowed(DEMO, FIAT_ZAR, BANK_USD, ZAR, 'STUB')).toBe(true);
    expect(crossBorderAllowed(DEMO, BAL, BANK_USD, ZAR, 'LIVE')).toBe(false);
    expect(crossBorderAllowed(DEMO, BAL, BANK_USD, ZAR, null)).toBe(false);
    expect(crossBorderAllowed(DEMO, FIAT_USD, BANK_USD, ZAR, 'STUB')).toBe(false);
    expect(crossBorderAllowed(DEMO, BAL, WALLET, ZAR, 'STUB')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Refusals before anything is locked.
// ---------------------------------------------------------------------------

describe('JQUOTE refusals (nothing locked)', () => {
  async function refusedWithoutCalls(req: JourneyQuoteRequest, c: QuoteConfig, code: QuoteRefusal, detail: string, deps?: (w: World) => QuoteDeps): Promise<void> {
    const w = world();
    const fx = spyFx(w.fx);
    const po = spyPayout(w.payout);
    const d = deps === undefined ? { ...w.deps, fx, payout: po } : deps(w);
    expect(await composeJourneyQuote(req, c, d)).toEqual(refusal(code, detail));
    expect(fx.calls).toBe(0n);
    expect(po.calls).toBe(0n);
  }

  it('request id', async () => {
    await refusedWithoutCalls(request(BAL, WALLET, 'SEND_EXACT', usdc(1n), ''), cfg(), 'AMOUNT_INVALID', 'request id required');
    await refusedWithoutCalls(request(BAL, WALLET, 'SEND_EXACT', usdc(1n), 'a b'), cfg(), 'AMOUNT_INVALID', 'request id required');
    await refusedWithoutCalls(request(BAL, WALLET, 'SEND_EXACT', usdc(1n), 'x'.repeat(256)), cfg(), 'AMOUNT_INVALID', 'request id required');
    await quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(1n), 'x'.repeat(255)), cfg(), world().deps);
  });

  it('only USDC is implemented as the settlement asset', async () => {
    const eurc = { ...settlement, asset: 'EURC' } as unknown as SettlementAsset;
    await refusedWithoutCalls(request(BAL, WALLET, 'SEND_EXACT', usdc(1n)), cfg({ settlement: eurc }), 'ASSET_NOT_SUPPORTED', 'EURC: only USDC is implemented');
  });

  it('quote TTL must be positive', async () => {
    await refusedWithoutCalls(request(BAL, WALLET, 'SEND_EXACT', usdc(1n)), cfg({ ttlMs: 0n }), 'RATE_LOCK_EXPIRED', 'quote TTL must be positive');
    const q = await quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(1n)), cfg({ ttlMs: 1n }), world().deps);
    expect(q.expiresAtMs).toBe(T0 + 1n);
  });

  it('pay-in and payout must be the settlement asset on the settlement network', async () => {
    const fake: PayInMethod = { method: 'STABLECOIN_BALANCE', asset: 'USDC', network: 'FAKENET' };
    const eurcIn = { method: 'STABLECOIN_DEPOSIT', asset: 'EURC', network: 'ARC' } as unknown as PayInMethod;
    const fakeOut: PayoutMethod = { ...WALLET, network: 'FAKENET' };
    const eurcOut = { ...WALLET, asset: 'EURC' } as unknown as PayoutMethod;
    await refusedWithoutCalls(request(fake, WALLET, 'SEND_EXACT', usdc(1n)), cfg(), 'ASSET_NOT_SUPPORTED', 'pay-in asset or network is not the settlement asset');
    await refusedWithoutCalls(request(eurcIn, WALLET, 'SEND_EXACT', usdc(1n)), cfg(), 'ASSET_NOT_SUPPORTED', 'pay-in asset or network is not the settlement asset');
    await refusedWithoutCalls(request(BAL, fakeOut, 'SEND_EXACT', usdc(1n)), cfg(), 'ASSET_NOT_SUPPORTED', 'payout asset or network is not the settlement asset');
    await refusedWithoutCalls(request(BAL, eurcOut, 'SEND_EXACT', usdc(1n)), cfg(), 'ASSET_NOT_SUPPORTED', 'payout asset or network is not the settlement asset');
  });

  it('closed feature flags refuse METHOD_NOT_ENABLED; a method is never switched', async () => {
    const off = { fiatEnabled: false, stablecoinDepositEnabled: false };
    const detail = 'a chosen method is behind a closed flag';
    await refusedWithoutCalls(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 100n)), cfg({ flags: off }), 'METHOD_NOT_ENABLED', detail);
    await refusedWithoutCalls(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(1n)), cfg({ flags: off }), 'METHOD_NOT_ENABLED', detail);
    await refusedWithoutCalls(request(DEP, WALLET, 'SEND_EXACT', usdc(1n)), cfg({ flags: off }), 'METHOD_NOT_ENABLED', detail);
    await quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(1n)), cfg({ flags: off }), world().deps);
  });

  it('a fiat method without its port wired is refused', async () => {
    await refusedWithoutCalls(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 100n)), cfg(), 'METHOD_NOT_ENABLED', 'no FxPort wired', (w) => ({ ...w.deps, fx: null }));
    await refusedWithoutCalls(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(1n)), cfg(), 'METHOD_NOT_ENABLED', 'no PayoutQuotePort wired', (w) => ({ ...w.deps, payout: null }));
    // A port that is not needed may be absent.
    await quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(1n)), cfg(), { ...world().deps, fx: null, payout: null });
  });

  it('the amount must be positive and in the asset of the exact side', async () => {
    const cur = 'amount is not in the exact side currency';
    const set = 'amount is not in the settlement asset';
    const pos = 'amount must be positive';
    await refusedWithoutCalls(request(FIAT_ZAR, WALLET, 'SEND_EXACT', usdc(100n)), cfg(), 'AMOUNT_INVALID', cur);
    await refusedWithoutCalls(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('USD', 100n)), cfg(), 'AMOUNT_INVALID', cur);
    await refusedWithoutCalls(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 0n)), cfg(), 'AMOUNT_INVALID', pos);
    await refusedWithoutCalls(request(BAL, BANK_ZAR, 'RECEIVE_EXACT', usdc(100n)), cfg(), 'AMOUNT_INVALID', cur);
    await refusedWithoutCalls(request(BAL, BANK_ZAR, 'SEND_EXACT', fiat('ZAR', 100n)), cfg(), 'AMOUNT_INVALID', set);
    await refusedWithoutCalls(request(FIAT_ZAR, WALLET, 'RECEIVE_EXACT', fiat('ZAR', 100n)), cfg(), 'AMOUNT_INVALID', set);
    const eurc = { kind: 'STABLECOIN', asset: 'EURC', minor: cbsMinor(1n) } as unknown as JourneyMoney;
    await refusedWithoutCalls(request(BAL, WALLET, 'SEND_EXACT', eurc), cfg(), 'AMOUNT_INVALID', set);
    await refusedWithoutCalls(request(BAL, WALLET, 'SEND_EXACT', usdc(0n)), cfg(), 'AMOUNT_INVALID', pos);
  });
});

// ---------------------------------------------------------------------------
// Rate lock, expiry, exactly-once and fail closed.
// ---------------------------------------------------------------------------

describe('JQUOTE rate lock and expiry', () => {
  it('a lock that expires while the quote is being composed is refused; one millisecond earlier it is not', async () => {
    const w = world();
    const late = spyFx(w.fx, () => w.clock.advance(30_000n));
    expect(await composeJourneyQuote(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 10000n)), cfg(), { ...w.deps, fx: late })).toEqual(
      refusal('RATE_LOCK_EXPIRED', 'a rate lock expired before the quote was composed'),
    );
    const w2 = world();
    const justInTime = spyFx(w2.fx, () => w2.clock.advance(29_999n));
    const q = await quoteOk(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 10000n)), cfg(), { ...w2.deps, fx: justInTime });
    expect(q.createdAtMs).toBe(T0);
    expect(q.expiresAtMs).toBe(T0 + 30_000n);
    expect(isQuoteLive(q, T0 + 29_999n)).toBe(true);
    expect(isQuoteLive(q, T0 + 30_000n)).toBe(false);
  });

  it('expiry is the earliest of our TTL and each lock', async () => {
    const short = await quoteOk(request(FIAT_ZAR, BANK_ZAR, 'SEND_EXACT', fiat('ZAR', 9990n)), cfg({ ttlMs: 5_000n }), world().deps);
    expect(short.expiresAtMs).toBe(T0 + 5_000n);
    const both = await quoteOk(request(FIAT_ZAR, BANK_ZAR, 'SEND_EXACT', fiat('ZAR', 9990n)), cfg(), world().deps);
    expect(both.expiresAtMs).toBe(T0 + 20_000n);
    const fxOnly = await quoteOk(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 9990n)), cfg({ ttlMs: 30_001n }), world().deps);
    expect(fxOnly.expiresAtMs).toBe(T0 + 30_000n);
    const ttlEqual = await quoteOk(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 9990n)), cfg({ ttlMs: 30_000n }), world().deps);
    expect(ttlEqual.expiresAtMs).toBe(T0 + 30_000n);
  });

  it('AMBIGUOUS from FX: retrying the same request id replays the same lock and yields the same quote', async () => {
    const w = world();
    w.fxFaults.arm('lockRate', 'AFTER_COMMIT', 'TIMEOUT');
    const req = request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 10000n));
    expect(await composeJourneyQuote(req, cfg(), w.deps)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
    const first = await quoteOk(req, cfg(), w.deps);
    const second = await quoteOk(req, cfg(), w.deps);
    expect(second).toEqual(first);
    expect(first.convertIn?.fxQuoteId).toBe('fx-1');
    const other = await quoteOk(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 10000n), 'req-2'), cfg(), w.deps);
    expect(other.convertIn?.fxQuoteId).toBe('fx-2');
    expect(other.quoteId).not.toBe(first.quoteId);
  });

  it('AMBIGUOUS from the partner (RECEIVE_EXACT) is returned as AMBIGUOUS', async () => {
    const w = world();
    w.payoutFaults.arm('quotePayout', 'BEFORE_COMMIT', 'UNAVAILABLE');
    expect(await composeJourneyQuote(request(BAL, BANK_ZAR, 'RECEIVE_EXACT', fiat('ZAR', 9890n)), cfg(), w.deps)).toEqual({ kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' });
    w.payoutFaults.arm('quotePayout', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await composeJourneyQuote(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(5_400_000n)), cfg(), w.deps)).toEqual({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' });
  });

  it('AMBIGUOUS from FX on RECEIVE_EXACT', async () => {
    const w = world();
    w.fxFaults.arm('lockRate', 'BEFORE_COMMIT', 'TRANSPORT');
    expect(await composeJourneyQuote(request(FIAT_ZAR, WALLET, 'RECEIVE_EXACT', usdc(5_400_000n)), cfg(), w.deps)).toEqual({ kind: 'AMBIGUOUS', cause: 'TRANSPORT' });
  });

  it('port refusals pass through with their code: LIMIT, BELOW_MINIMUM, KEY_CONFLICT, NO_ROUTE', async () => {
    expect(await composeJourneyQuote(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 10000n)), cfg(), world(GAS, { fx: 9999n }).deps)).toEqual(refusal('LIMIT', '10000 > 9999'));
    expect(await composeJourneyQuote(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(5_400_000n)), cfg(), world(GAS, { payout: 1n }).deps)).toEqual(refusal('LIMIT', '5400000 > 1'));
    expect(await composeJourneyQuote(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(40_000n)), cfg(), world().deps)).toEqual(refusal('BELOW_MINIMUM', '40000 does not cover the fee'));
    expect(await composeJourneyQuote(request(BAL, BANK_ZAR, 'RECEIVE_EXACT', fiat('ZAR', 1n)), cfg(), world().deps)).toEqual(refusal('NO_ROUTE', 'net plus fee does not convert exactly'));
    const w = world();
    await w.fx.lockRate(quoteCallKey('req-1', 'fx'), { from: ledgerAssetCode('ZAR'), to: USDC, amount: cbsMinor(37n), side: 'FROM_EXACT' });
    expect(await composeJourneyQuote(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 10000n)), cfg(), w.deps)).toEqual(
      refusal('KEY_CONFLICT', `key ${quoteCallKey('req-1', 'fx')} reused with another request`),
    );
  });

  it('a port answer that fails its exact check throws QuoteIntegrityError (fail closed)', async () => {
    const w = world();
    const tamperedFx = spyFx(w.fx, undefined, (r) => (r.kind === 'OK' ? { ...r, value: { ...r.value, quote: { ...r.value.quote, to: { ...r.value.quote.to, amount: cbsMinor(r.value.quote.to.amount + 1n) } } } } : r));
    await expect(composeJourneyQuote(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 10000n)), cfg(), { ...w.deps, fx: tamperedFx })).rejects.toThrow(
      new QuoteIntegrityError('FxPort: conversion does not balance to the minor unit'),
    );
    const tamperedPo = spyPayout(w.payout, 'TEST_FAKE', (r) => (r.kind === 'OK' ? { ...r, value: { ...r.value, net: cbsMinor(r.value.net + 1n) } } : r));
    await expect(composeJourneyQuote(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(5_400_000n)), cfg(), { ...w.deps, payout: tamperedPo })).rejects.toThrow(
      new QuoteIntegrityError('PayoutQuotePort: net is not gross minus fee'),
    );
    const e = new QuoteIntegrityError('x');
    expect(e.message).toBe('journey quote integrity: x');
    expect(e.name).toBe('QuoteIntegrityError');
    expect(e.code).toBe('QUOTE_INTEGRITY');
  });

  it('a clock that steps backward during composition fails the final conservation check (fail closed)', async () => {
    const w = world();
    const skew: FxPort = {
      lockRate: async (k, r) => {
        w.clock.advance(-50_000n);
        return w.fx.lockRate(k, r);
      },
    };
    await expect(composeJourneyQuote(request(FIAT_ZAR, WALLET, 'SEND_EXACT', fiat('ZAR', 10000n)), cfg(), { ...w.deps, fx: skew })).rejects.toThrow(
      new QuoteIntegrityError('quote expires before it is created'),
    );
  });

  it('the network fee allowance is asked for the settlement network', async () => {
    const w = world();
    const asked: string[] = [];
    await quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(5_000_000n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), {
      ...w.deps,
      networkFeeAllowanceWei: (n) => {
        asked.push(n);
        return GAS;
      },
    });
    expect(asked).toEqual(['ARC']);
  });
});

describe('JQUOTE idempotency keys', () => {
  it('derives one deterministic key per port call of a request', () => {
    const fx = quoteCallKey('req-1', 'fx');
    expect(fx).toBe(`jq:fx:${lpDigestHex(['jquote', 'fx', 'req-1'])}`);
    expect(quoteCallKey('req-1', 'payout-1')).toBe(`jq:p1:${lpDigestHex(['jquote', 'payout-1', 'req-1'])}`);
    expect(quoteCallKey('req-1', 'payout-2')).toBe(`jq:p2:${lpDigestHex(['jquote', 'payout-2', 'req-1'])}`);
    expect(quoteCallKey('req-2', 'fx')).not.toBe(fx);
  });
});

// ---------------------------------------------------------------------------
// Binding digest and conservation (reconstruction).
// ---------------------------------------------------------------------------

async function fullQuote(): Promise<JourneyQuote> {
  return quoteOk(request(FIAT_ZAR, BANK_ZAR, 'SEND_EXACT', fiat('ZAR', 10010n)), cfg({ gasCharging: 'CHARGED_TO_PAYER' }), world().deps);
}

async function plainQuote(): Promise<JourneyQuote> {
  return quoteOk(request(BAL, WALLET, 'SEND_EXACT', usdc(5_000_000n)), cfg(), world().deps);
}

function reseal(q: JourneyQuote): JourneyQuote {
  const { quoteId: _drop, ...body } = q;
  return { ...body, quoteId: quoteDigest(body) };
}

describe('JQUOTE quote fields (the binding digest input)', () => {
  it('lists every field of a full quote canonically', async () => {
    const q = await fullQuote();
    expect(quoteFields(q)).toEqual([
      'jquote-v1',
      'req-1',
      'SEND_EXACT',
      'FIAT:ZAR',
      'FIAT_BANK:ZAR:ben-1',
      'RESERVE,CONVERT_IN,ARC_TRANSFER,PAYOUT',
      'FIAT:ZAR:10010',
      'FIAT:ZAR:9853',
      '9853/10010',
      `fx-1|lot-table|20000/37|ZAR:10010|5400000|ZAR:20|${T0 + 30_000n}`,
      `ARC|USDC|PARTNER_SETTLEMENT|5380000|${5_380_000n * K}|${GAS}|420|123`,
      `po-2|TEST_FAKE|37/20000|5380000|ZAR:9953|ZAR:100|ZAR:9853|${T0 + 20_000n}`,
      'FX_REMAINDER:ZAR:20:NOVA_FX_ENGINE_SUSPENSE,GAS_ALLOWANCE_SUBMINOR:123:GL-4 arc.gasDust,PAYOUT_REMAINDER:19580:GL-4 arc.quoteDust',
      'false',
      'false',
      `${T0}`,
      `${T0 + 20_000n}`,
    ]);
    expect(q.quoteId).toBe(`jq-${lpDigestHex(quoteFields(q))}`);
  });

  it('lists a plain quote and a deposit/wallet quote', async () => {
    const q = await plainQuote();
    expect(quoteFields(q)).toEqual([
      'jquote-v1',
      'req-1',
      'SEND_EXACT',
      'STABLECOIN_BALANCE:USDC:ARC',
      'STABLECOIN_WALLET:USDC:ARC:ben-1',
      'RESERVE,ARC_TRANSFER',
      'STABLECOIN:USDC:5000000',
      'STABLECOIN:USDC:5000000',
      '5000000/5000000',
      '-',
      `ARC|USDC|RECEIVER_WALLET|5000000|${5_000_000n * K}|${GAS}|0|0`,
      '-',
      '',
      'false',
      'false',
      `${T0}`,
      `${T0 + 60_000n}`,
    ]);
    const d = await quoteOk(request(DEP, BANK_USD, 'RECEIVE_EXACT', fiat('USD', 50n)), cfg({ crossBorder: DEMO }), world().deps);
    const f = quoteFields(d);
    expect(f[3]).toBe('STABLECOIN_DEPOSIT:USDC:ARC');
    expect(f[13]).toBe('true');
    expect(f[14]).toBe('true');
  });
});

describe('JQUOTE checkConservation', () => {
  it('accepts every composed quote', async () => {
    expect(checkConservation(await fullQuote(), settlement)).toBeNull();
    expect(checkConservation(await plainQuote(), settlement)).toBeNull();
  });

  const full: [string, (q: JourneyQuote) => JourneyQuote, string][] = [
    ['legs', (q) => ({ ...q, legs: [...q.legs].reverse() }), 'legs do not match the journey'],
    ['no CONVERT_IN', (q) => ({ ...q, convertIn: null }), 'CONVERT_IN present iff the payer picks FIAT'],
    ['no PAYOUT', (q) => ({ ...q, payoutLine: null }), 'PAYOUT present iff the receiver picks FIAT_BANK'],
    ['wei view', (q) => ({ ...q, arcTransfer: { ...q.arcTransfer, amountWei: nativeWei(q.arcTransfer.amountWei + 1n) } }), 'Arc amount views disagree'],
    ['zero Arc amount', (q) => ({ ...q, arcTransfer: { ...q.arcTransfer, amount: cbsMinor(0n), amountWei: nativeWei(0n) } }), 'nothing moves on Arc'],
    ['gas charge', (q) => ({ ...q, arcTransfer: { ...q.arcTransfer, gasChargeMinor: cbsMinor(421n) } }), 'gas charge is not the U1 split of the allowance'],
    ['gas dust', (q) => ({ ...q, arcTransfer: { ...q.arcTransfer, gasDustWei: nativeWei(124n) } }), 'gas charge is not the U1 split of the allowance'],
    ['payer amount', (q) => ({ ...q, payer: fiat('ZAR', 10011n) }), 'payer debit is not the converted amount'],
    ['payer currency', (q) => ({ ...q, payer: fiat('USD', 10010n) }), 'payer debit is not the converted amount'],
    ['payer kind', (q) => ({ ...q, payer: usdc(10010n) }), 'payer debit is not the converted amount'],
    ['FX balance', (q) => ({ ...q, convertIn: q.convertIn === null ? null : { ...q.convertIn, remainder: fiatAmount(ZAR, 21n) } }), 'CONVERT_IN does not balance'],
    ['USDC out', (q) => ({ ...q, arcTransfer: { ...q.arcTransfer, amount: cbsMinor(5_380_001n), amountWei: nativeWei(5_380_001n * K) } }), 'USDC in does not equal USDC out'],
    ['partner funding', (q) => ({ ...q, payoutLine: q.payoutLine === null ? null : { ...q.payoutLine, source: cbsMinor(5_380_001n) } }), 'partner is not funded with the Arc amount'],
    ['PAYOUT balance', (q) => ({ ...q, payoutLine: q.payoutLine === null ? null : { ...q.payoutLine, gross: fiatAmount(ZAR, 9954n) } }), 'PAYOUT does not balance'],
    ['net', (q) => ({ ...q, payoutLine: q.payoutLine === null ? null : { ...q.payoutLine, net: fiatAmount(ZAR, 9852n) } }), 'net is not gross minus fee'],
    ['receiver amount', (q) => ({ ...q, recipient: fiat('ZAR', 9852n) }), 'receiver amount is not the payout net'],
    ['receiver currency', (q) => ({ ...q, recipient: fiat('USD', 9853n) }), 'receiver amount is not the payout net'],
    ['receiver kind', (q) => ({ ...q, recipient: usdc(9853n) }), 'receiver amount is not the payout net'],
    ['dust dropped', (q) => ({ ...q, dust: q.dust.filter((d) => d.source !== 'GAS_ALLOWANCE_SUBMINOR') }), 'dust records do not match the legs'],
    ['FX dust dropped', (q) => ({ ...q, dust: q.dust.filter((d) => d.source !== 'FX_REMAINDER') }), 'dust records do not match the legs'],
    ['dust reordered', (q) => ({ ...q, dust: [...q.dust].reverse() }), 'dust records do not match the legs'],
    [
      'payout dust split in two',
      (q) => ({
        ...q,
        dust: [...q.dust.filter((d) => d.source !== 'PAYOUT_REMAINDER'), { source: 'PAYOUT_REMAINDER', usdcMinor: cbsMinor(19_000n), suspense: 'GL-4 arc.quoteDust' }, { source: 'PAYOUT_REMAINDER', usdcMinor: cbsMinor(580n), suspense: 'GL-4 arc.quoteDust' }],
      }),
      'a payout remainder needs one positive record and a PAYOUT leg',
    ],
    ['zero payout dust', (q) => ({ ...q, dust: [...q.dust, { source: 'PAYOUT_REMAINDER', usdcMinor: cbsMinor(0n), suspense: 'GL-4 arc.quoteDust' }] }), 'a payout remainder needs one positive record and a PAYOUT leg'],
    ['pay-in currency', (q) => ({ ...q, payIn: FIAT_USD }), 'payer debit is not in the pay-in currency'],
    ['payout currency', (q) => ({ ...q, payout: BANK_USD }), 'receiver amount is not in the payout currency'],
    ['all-in numerator', (q) => ({ ...q, allInRate: { numerator: 9852n, denominator: 10010n } }), 'all-in rate is not receiver over payer'],
    ['all-in denominator', (q) => ({ ...q, allInRate: { numerator: 9853n, denominator: 10011n } }), 'all-in rate is not receiver over payer'],
    ['created = expiry', (q) => ({ ...q, createdAtMs: q.expiresAtMs }), 'quote expires before it is created'],
    ['created after expiry', (q) => ({ ...q, createdAtMs: q.expiresAtMs + 1n }), 'quote expires before it is created'],
    ['outlives payout lock', (q) => ({ ...q, expiresAtMs: q.expiresAtMs + 1n }), 'quote outlives its payout lock'],
    ['outlives FX lock', (q) => ({ ...q, convertIn: q.convertIn === null ? null : { ...q.convertIn, expiresAtMs: q.expiresAtMs - 1n } }), 'quote outlives its FX lock'],
  ];

  it.each(full)('refuses a full quote with a tampered %s', async (_name, tamper, why) => {
    expect(checkConservation(reseal(tamper(await fullQuote())), settlement)).toBe(why);
  });

  const plain: [string, (q: JourneyQuote) => JourneyQuote, string][] = [
    ['payer not in USDC', (q) => ({ ...q, payer: fiat('ZAR', 5_000_000n) }), 'payer debit is not in the settlement asset'],
    ['receiver amount', (q) => ({ ...q, recipient: usdc(4_999_999n) }), 'receiver amount is not the Arc amount'],
    ['receiver kind', (q) => ({ ...q, recipient: fiat('ZAR', 5_000_000n) }), 'receiver amount is not the Arc amount'],
    [
      'payout dust without a PAYOUT leg',
      (q) => ({
        ...q,
        recipient: usdc(4_999_995n),
        allInRate: { numerator: 4_999_995n, denominator: 5_000_000n },
        arcTransfer: { ...q.arcTransfer, amount: cbsMinor(4_999_995n), amountWei: nativeWei(4_999_995n * K) },
        dust: [{ source: 'PAYOUT_REMAINDER', usdcMinor: cbsMinor(5n), suspense: 'GL-4 arc.quoteDust' }],
      }),
      'a payout remainder needs one positive record and a PAYOUT leg',
    ],
    ['gas charged off-split', (q) => ({ ...q, arcTransfer: { ...q.arcTransfer, gasDustWei: nativeWei(123n) } }), 'gas charge is not the U1 split of the allowance'],
    ['gas charged minor only', (q) => ({ ...q, arcTransfer: { ...q.arcTransfer, gasChargeMinor: cbsMinor(420n) } }), 'gas charge is not the U1 split of the allowance'],
  ];

  it.each(plain)('refuses a plain quote with a tampered %s', async (_name, tamper, why) => {
    expect(checkConservation(reseal(tamper(await plainQuote())), settlement)).toBe(why);
  });

  it('a gas charge equal to the U1 split passes on a plain quote (USDC still conserved by the payer)', async () => {
    const q = await plainQuote();
    const charged = reseal({
      ...q,
      recipient: usdc(4_999_580n),
      allInRate: { numerator: 4_999_580n, denominator: 5_000_000n },
      arcTransfer: { ...q.arcTransfer, amount: cbsMinor(4_999_580n), amountWei: nativeWei(4_999_580n * K), gasChargeMinor: cbsMinor(420n), gasDustWei: nativeWei(123n) },
      dust: [{ source: 'GAS_ALLOWANCE_SUBMINOR', wei: nativeWei(123n), suspense: 'GL-4 arc.gasDust' }],
    });
    expect(checkConservation(charged, settlement)).toBeNull();
  });

  it('refuses a single zero payout-remainder record', async () => {
    const q = await quoteOk(request(BAL, BANK_ZAR, 'SEND_EXACT', usdc(5_400_000n)), cfg(), world().deps);
    const zero = reseal({ ...q, dust: [{ source: 'PAYOUT_REMAINDER', usdcMinor: cbsMinor(0n), suspense: 'GL-4 arc.quoteDust' }] });
    expect(checkConservation(zero, settlement)).toBe('a payout remainder needs one positive record and a PAYOUT leg');
  });

  it('refuses a quote whose id is not the digest of its fields', async () => {
    const q = await fullQuote();
    expect(checkConservation({ ...q, requestId: 'req-x' }, settlement)).toBe('quote id is not the digest of its fields');
    expect(checkConservation({ ...q, quoteId: `jq-${'0'.repeat(64)}` }, settlement)).toBe('quote id is not the digest of its fields');
  });
});

describe('JQUOTE money stays integer', () => {
  it('every amount in a composed quote is a bigint', async () => {
    const q = await fullQuote();
    const amounts: bigint[] = [
      q.arcTransfer.amount,
      q.arcTransfer.amountWei,
      q.arcTransfer.gasAllowanceWei,
      q.arcTransfer.gasChargeMinor,
      q.arcTransfer.gasDustWei,
      q.allInRate.numerator,
      q.allInRate.denominator,
    ];
    for (const a of amounts) expect(typeof a).toBe('bigint');
  });
});
