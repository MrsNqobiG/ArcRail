/**
 * Unit PAY: D1 orchestrator (src/payments) and HTTP edge (src/http), end to end over the fakes:
 * fake Nova ports (store, ledger, registry, receivers, gas-dust), the DFNS simulator behind the real DfnsClient,
 * the real SigningGateway, and the Arc network adapter over two in-memory RPC sources and the indexer.
 * Throwaway credentials only. Testnet only (5042002 / ArcTestnet).
 */
import { generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision, nativeWei } from '../../src/amounts/index.js';
import type { CbsMinor } from '../../src/amounts/index.js';
import { type DfnsCredentials, DfnsClient } from '../../src/dfns/client.js';
import { DfnsSimulator } from '../../src/dfns/fakes/simulator.js';
import { SigningGateway } from '../../src/gateway/index.js';
import { ArcIndexer } from '../../src/indexer/indexer.js';
import { InMemoryArcChain, MapIndexerStore, ManualTiming, fakeAddress, nativeTransferTx } from '../../src/indexer/fakes.js';
import type { ChainTx } from '../../src/indexer/fakes.js';
import { ArcNetworkAdapter } from '../../src/network/arc/adapter.js';
import { SetBlocklist } from '../../src/network/arc/blocklist-fakes.js';
import { loadArcNetworkParams } from '../../src/network/arc/config.js';
import { CounterDustStore } from '../../src/nova-ports/fakes/gas-dust-fakes.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { MapLedger } from '../../src/nova-ports/fakes/ledger-fakes.js';
import { MapPaymentStore } from '../../src/nova-ports/fakes/payment-store-fakes.js';
import { MapReceivers } from '../../src/nova-ports/fakes/receiver-fakes.js';
import { MapWalletRegistry } from '../../src/nova-ports/fakes/wallet-fakes.js';
import { beneficiaryRef, idempotencyKey, ledgerAssetCode, novaAccountRef, novaOwnerRef, walletRef } from '../../src/nova-ports/ids.js';
import type { Hex32, NetworkAddress, PaymentId } from '../../src/nova-ports/ids.js';
import type { LedgerAccount } from '../../src/nova-ports/ledger.js';
import { arcLeg, deriveCaseId } from '../../src/nova-ports/payment-store.js';
import type { CaseKind } from '../../src/nova-ports/payment-store.js';
import {
  CLEARING,
  FEE_INCOME,
  GAS_EXPENSE,
  PaymentOrchestrator,
  clearingOpen,
  customerAccount,
  deriveRequestIds,
  gatewayPrecheckFor,
  gatewayRailFor,
  gatewayStoreFor,
  gasKey,
  walletAccount,
  walletResidual,
} from '../../src/payments/index.js';
import { type Principal, type PaymentsHttpDeps, createPaymentHandler, getPaymentHandler, parseDecimalAmount } from '../../src/http/index.js';

const P6 = cbsPrecision(6);
const USDC = ledgerAssetCode('USDC');
const W = 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx';
const HOT_ADDR = '0x00e3495cf6af59008f22ffaf32d4c92ac33dac47' as NetworkAddress;
const TO = fakeAddress('pay-receiver');
const OTHER = fakeAddress('pay-other');
const PAYER = novaOwnerRef('payer-1');
const PAYER_ACCT = novaAccountRef('acct-payer-1');
const BEN = beneficiaryRef('ben-1');
const OPENING = 10_000_000n; // 10 USDC in the payer's balance and in the hot wallet
const WEI_PER_MINOR = 1_000_000_000_000n;
const FEE = 50_000n;
const principal: Principal = { kind: 'PAYER', owner: PAYER, account: PAYER_ACCT };

function credentials() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const token = randomBytes(24).toString('base64url');
  const credId = `cred-${randomBytes(4).toString('hex')}`;
  const creds: DfnsCredentials = {
    authToken: async () => token,
    signUserActionChallenge: async ({ challenge, credId: c }) => {
      const clientData = Buffer.from(JSON.stringify({ type: 'key.get', challenge, origin: 'https://nova.test', crossOrigin: false }));
      return { credId: c, clientData: clientData.toString('base64url'), signature: sign(null, clientData, privateKey).toString('base64url') };
    },
  };
  const check = (c: string, s: { clientData: string; signature: string }) => {
    const data = Buffer.from(s.clientData, 'base64url');
    return (JSON.parse(data.toString('utf8')) as { challenge: string }).challenge === c && verify(null, data, publicKey, Buffer.from(s.signature, 'base64url'));
  };
  return { token, credId, creds, check };
}

interface WorldOpts {
  readonly payerOpening?: bigint;
  readonly blocked?: readonly NetworkAddress[];
  readonly registerDestination?: boolean;
}

async function world(opts: WorldOpts = {}) {
  const c = credentials();
  const sim = new DfnsSimulator(c.token, c.credId, c.check);
  const walletRec = sim.addWallet();
  const dfns = new DfnsClient({ baseUrl: 'https://api.dfns.io', userAgent: 'nova-arc-rail/test', listPageLimit: 50n, maxListPages: 4n }, sim, c.creds);

  const registry = new MapWalletRegistry();
  const reg = await registry.register(idempotencyKey('reg-hot'), { owner: 'COMPANY', network: 'ARC', role: 'TREASURY_HOT', address: HOT_ADDR, custody: { provider: 'DFNS', walletId: W, dfnsNetwork: 'ArcTestnet' }, status: 'ACTIVE' });
  if (reg.kind !== 'OK') throw new Error('register');
  const hotRef = reg.value.walletRef;
  if (opts.registerDestination === true) {
    const r = await registry.register(idempotencyKey('reg-dest'), { owner: novaOwnerRef('someone'), network: 'ARC', role: 'CUSTOMER_DEPOSIT', address: TO, custody: { provider: 'DFNS', walletId: 'wa-2aaaa-bbbbb-yyyyyyyyyyyyyyyy', dfnsNetwork: 'ArcTestnet' }, status: 'ACTIVE' });
    if (r.kind !== 'OK') throw new Error('register dest');
  }

  const receivers = new MapReceivers();
  receivers.set(BEN, { active: true, receiver: novaOwnerRef('receiver-1'), choice: { payout: { method: 'STABLECOIN_WALLET', asset: 'USDC', network: 'ARC', beneficiaryRef: BEN }, destination: { kind: 'ADDRESS', network: 'ARC', address: TO } } });

  const hot = walletAccount(hotRef);
  const accounts: LedgerAccount[] = [customerAccount(PAYER_ACCT), CLEARING, hot, FEE_INCOME, GAS_EXPENSE];
  const payerOpening = opts.payerOpening ?? OPENING;
  const faults = new FaultPlan();
  const ledger = new MapLedger({
    faults,
    assets: [{ asset: USDC, precision: P6 }],
    accounts: accounts.map((account) => ({ account, status: 'OPEN' as const })),
    opening: [
      { account: customerAccount(PAYER_ACCT), asset: USDC, side: 'CREDIT', amount: cbsMinor(payerOpening) },
      { account: hot, asset: USDC, side: 'DEBIT', amount: cbsMinor(payerOpening) },
    ],
  });

  const params = loadArcNetworkParams({ chainId: 5042002n, dfnsNetwork: 'ArcTestnet', singleSourceTestnetOnly: false, stallAfterMs: 30_000n, startBlock: 0n, blocklistMaxAgeMs: 60_000n, headRegressionToleranceBlocks: 5n });
  const chainA = new InMemoryArcChain('a');
  const chainB = new InMemoryArcChain('b');
  const timing = new ManualTiming(1_000_000n);
  const indexer = new ArcIndexer({ params, sources: [chainA, chainB], store: new MapIndexerStore(), timing });
  const blocklist = new SetBlocklist(1_000_000n, opts.blocked ?? []);
  const network = new ArcNetworkAdapter({ params, indexer, blocklist, clock: timing });
  chainA.mine();
  chainB.mine();

  const store = new MapPaymentStore(faults);
  const dust = new CounterDustStore(P6);
  const gateway = new SigningGateway(
    { chainId: 5042002n, transferKind: 'Native', feeCeilingWei: nativeWei(2_000_000_000_000n), wrapperAllowList: [] },
    { store: gatewayStoreFor(store), rail: gatewayRailFor(store, network), ledger, registry, precheck: gatewayPrecheckFor(network), clock: { nowIso: () => '2026-10-07T12:00:00.000Z' }, dfns },
  );
  const clock = { ambiguousElapsed: false };
  const timers = { ambiguousElapsed: (_since: string) => clock.ambiguousElapsed };
  const orchestrator = new PaymentOrchestrator(
    { precision: P6, asset: USDC, chainId: 5042002n, transferKind: 'Native', feeFor: () => cbsMinor(FEE) },
    { store, ledger, registry, receivers, network, dfns, gateway, dust, timers },
  );
  const mine = (tx: ChainTx): void => {
    chainA.mine([tx]);
    chainB.mine([tx]);
  };
  const http: PaymentsHttpDeps = {
    orchestrator,
    read: async (id) => {
      const r = await store.get(id);
      return r.kind === 'OK' ? r.value : r.kind === 'REJECTED' ? null : 'UNAVAILABLE';
    },
    precision: P6,
      };
  return { sim, dfns, registry, hotRef, hot, ledger, store, dust, network, params, gateway, orchestrator, mine, chainA, chainB, http, faults, clock, blocklist, walletRec, dependsOn: ledger };
}
type World = Awaited<ReturnType<typeof world>>;

const AMOUNT = 2_500_000n;
const create = (w: World, key = 'client-key-1', amount: bigint = AMOUNT) =>
  w.orchestrator.create({ payer: PAYER, payerAccount: PAYER_ACCT, clientKey: key, beneficiaryRef: BEN, amount: cbsMinor(amount) });

async function created(w: World, key = 'client-key-1'): Promise<PaymentId> {
  const out = await create(w, key);
  if (out.kind !== 'OK') throw new Error(`create ${JSON.stringify(out)}`);
  return out.record.paymentId;
}

const bal = async (w: World, a: LedgerAccount) => {
  const r = await w.ledger.getBalance(a, USDC);
  if (r.kind !== 'OK') throw new Error('balance');
  return { debits: r.value.debits as bigint, credits: r.value.credits as bigint };
};
const net = async (w: World, a: LedgerAccount) => {
  const b = await bal(w, a);
  return b.debits - b.credits;
};
const transfersPosted = (w: World) => w.sim.requests.filter((r) => r.method === 'POST' && r.url.endsWith('/transfers'));
const transferId = (w: World): string => String(w.sim.allTransfers()[0]?.['id']);
const journal = async (w: World, key: string) => {
  const r = await w.ledger.getJournalByKey(idempotencyKey(key));
  return r.kind === 'OK' ? r.value : 'AMBIGUOUS';
};
/** Σ debits = Σ credits over every account the rail touches (conservation). */
async function conserved(w: World): Promise<boolean> {
  let d = 0n;
  let c = 0n;
  for (const a of [customerAccount(PAYER_ACCT), CLEARING, w.hot, FEE_INCOME, GAS_EXPENSE]) {
    const b = await bal(w, a);
    d += b.debits;
    c += b.credits;
  }
  return d === c;
}

const toWei = (m: bigint): bigint => m * WEI_PER_MINOR;
const GAS_USED = 21_001n; // 21001 × 20 gwei = 420,020 gwei-units: 420 minor + 20,000,000,000 wei of dust at p = 6
const GAS_PRICE = 20_000_000_000n;
const GAS_WEI = GAS_USED * GAS_PRICE;
const broadcastTx = (w: World, label: string, to: NetworkAddress = TO, wei: bigint = toWei(AMOUNT), status = 1n): { hash: Hex32; tx: ChainTx } => {
  const base = nativeTransferTx(w.params, label, HOT_ADDR, to, wei);
  return { hash: base.hash, tx: { ...base, gasUsed: GAS_USED, effectiveGasPrice: GAS_PRICE, status } };
};

describe('D1 happy path: create, approve, broadcast, confirm, postings, COMPLETED / SETTLED', () => {
  it('runs end to end with gas dust and reconciles to residual 0', async () => {
    const w = await world();
    const id = await created(w);
    const first = await w.orchestrator.advance(id);
    // P1 posted, DFNS transfer created and waiting for approval.
    expect(first.record.stage).toBe('PENDING_APPROVAL');
    expect(first.record.status).toBe('PENDING');
    expect(await journal(w, `pay:${id}:p1`)).not.toBeNull();
    expect(await net(w, CLEARING)).toBe(-(AMOUNT + FEE)); // credit-normal: credits − debits = A + F
    expect(await net(w, customerAccount(PAYER_ACCT))).toBe(-(OPENING - AMOUNT - FEE));
    expect(transfersPosted(w)).toHaveLength(1);
    // The DFNS body is built from the server-side binding only.
    const body = w.sim.allTransfers()[0]?.['requestBody'] as Record<string, unknown>;
    expect(body['to']).toBe(TO);
    expect(body['amount']).toBe(toWei(AMOUNT).toString(10));

    // Approval (human, in DFNS): Executing = approved and being signed.
    w.sim.setStatus(transferId(w), 'Executing');
    expect((await w.orchestrator.advance(id)).record.stage).toBe('APPROVED');
    expect((await w.orchestrator.advance(id)).record.status).toBe('PROCESSING');

    // Broadcast: DFNS reports the hash; the chain has not shown it yet, so we wait, nothing posted.
    const { hash, tx } = broadcastTx(w, 'happy-1');
    w.sim.setStatus(transferId(w), 'Broadcasted', { txHash: hash, dateBroadcasted: '2026-10-07T12:01:00.000Z' });
    const waiting = await w.orchestrator.advance(id);
    expect(waiting.record.stage).toBe('CONFIRMING');
    expect(await journal(w, `pay:${id}:p2`)).toBeNull();

    // Chain confirms (both sources agree).
    w.mine(tx);
    const done = await w.orchestrator.advance(id);
    expect(done.record.stage).toBe('COMPLETED');
    expect(done.record.status).toBe('SETTLED');
    expect(arcLeg(done.record).txHash).toBe(hash);

    // Postings: P2 (A), P3 (F), P4 (g minor), dust d in the gas-dust sub-ledger; clearing nets to zero.
    expect(await journal(w, `pay:${id}:p2`)).not.toBeNull();
    expect(await journal(w, `pay:${id}:p3`)).not.toBeNull();
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
    const g = GAS_WEI / WEI_PER_MINOR;
    const d = GAS_WEI % WEI_PER_MINOR;
    expect(d).toBeGreaterThan(0n);
    expect(await journal(w, gasKey(5042002n, hash))).not.toBeNull();
    expect(await net(w, GAS_EXPENSE)).toBe(g);
    expect(await bal(w, FEE_INCOME)).toEqual({ debits: 0n, credits: FEE });
    expect(await clearingOpen({ ledger: w.ledger, asset: USDC })).toBe(0n);
    const dust = await w.dust.balance(w.hotRef);
    expect(dust).toMatchObject({ kind: 'OK', value: { gasDustWei: d } });
    expect(await net(w, w.hot)).toBe(OPENING - AMOUNT - g);
    expect(await conserved(w)).toBe(true);

    // Reconciliation: chain wei of the hot wallet vs the books, to the base unit.
    const chainWei = toWei(OPENING) - toWei(AMOUNT) - GAS_WEI;
    expect(await walletResidual({ ledger: w.ledger, dust: w.dust, precision: P6, asset: USDC }, w.hotRef, chainWei)).toEqual({ kind: 'OK', residualWei: 0n });
    // A wrong chain value is NOT hidden: a one-wei difference is a non-zero residual.
    expect(await walletResidual({ ledger: w.ledger, dust: w.dust, precision: P6, asset: USDC }, w.hotRef, chainWei + 1n)).toEqual({ kind: 'OK', residualWei: 1n });

    // Idempotent re-advance: nothing is posted twice, nothing changes.
    const again = await w.orchestrator.advance(id);
    expect(again.changed).toBe(false);
    expect(await bal(w, FEE_INCOME)).toEqual({ debits: 0n, credits: FEE });
    expect(transfersPosted(w)).toHaveLength(1);
  });

  it('DFNS Confirmed alone never completes: only our own chain read does', async () => {
    const w = await world();
    const id = await created(w);
    await w.orchestrator.advance(id);
    const { hash } = broadcastTx(w, 'cross-check');
    w.sim.setStatus(transferId(w), 'Confirmed', { txHash: hash, dateBroadcasted: '2026-10-07T12:01:00.000Z' });
    const r = await w.orchestrator.advance(id);
    expect(r.record.stage).toBe('CONFIRMING');
    expect(r.record.status).toBe('PROCESSING');
    expect(await journal(w, `pay:${id}:p2`)).toBeNull();
  });
});

describe('create is idempotent', () => {
  it('the same key twice is one payment, one reservation, one DFNS transfer', async () => {
    const w = await world();
    const a = await create(w);
    const b = await create(w);
    expect(a.kind === 'OK' && b.kind === 'OK' && a.record.paymentId === b.record.paymentId).toBe(true);
    expect(b.kind === 'OK' && b.replayed).toBe(true);
    const id = (a.kind === 'OK' ? a.record.paymentId : '') as PaymentId;
    await w.orchestrator.advance(id);
    await w.orchestrator.advance(id);
    expect(await net(w, CLEARING)).toBe(-(AMOUNT + FEE));
    expect(transfersPosted(w)).toHaveLength(1);
    expect(w.sim.allTransfers()).toHaveLength(1);
  });

  it('the same key with a different amount is refused (KEY_CONFLICT), nothing new is created', async () => {
    const w = await world();
    await created(w);
    const other = await create(w, 'client-key-1', AMOUNT + 1n);
    expect(other).toMatchObject({ kind: 'REFUSED', code: 'KEY_CONFLICT' });
  });

  it('the payment id is derived from (payer, key): another payer with the same key gets another payment', () => {
    const a = deriveRequestIds(novaOwnerRef('u1'), 'x');
    const b = deriveRequestIds(novaOwnerRef('u'), '1x');
    expect(a.paymentId).not.toBe(b.paymentId);
    expect(deriveRequestIds(novaOwnerRef('u1'), 'x').paymentId).toBe(a.paymentId);
  });
});

describe('failure paths: right stage and status, and no money lost', () => {
  it('F: insufficient funds: RESERVE REJECTED, no DFNS request, nothing moved', async () => {
    const w = await world({ payerOpening: 1_000_000n });
    const id = await created(w);
    const r = await w.orchestrator.advance(id);
    expect(r.record).toMatchObject({ stage: 'REJECTED', reason: 'INSUFFICIENT_FUNDS', status: 'FAILED' });
    expect(w.sim.requests.filter((q) => q.url.includes('/transfers'))).toHaveLength(0);
    expect(await journal(w, `pay:${id}:p1`)).toBeNull();
    expect(await net(w, customerAccount(PAYER_ACCT))).toBe(-1_000_000n);
    expect(await clearingOpen({ ledger: w.ledger, asset: USDC })).toBe(0n);
  });

  it('F-1: approval denied: REJECTED / APPROVAL_DENIED, P6 returns A + F, clearing is zero', async () => {
    const w = await world();
    const id = await created(w);
    await w.orchestrator.advance(id);
    w.sim.setStatus(transferId(w), 'Rejected');
    const r = await w.orchestrator.advance(id);
    expect(r.record).toMatchObject({ stage: 'REJECTED', reason: 'APPROVAL_DENIED', status: 'FAILED' });
    expect(await journal(w, `pay:${id}:p6`)).not.toBeNull();
    expect(await net(w, customerAccount(PAYER_ACCT))).toBe(-OPENING);
    expect(await clearingOpen({ ledger: w.ledger, asset: USDC })).toBe(0n);
    expect(await conserved(w)).toBe(true);
    // The payment is over: a further advance posts nothing and sends nothing.
    await w.orchestrator.advance(id);
    expect(transfersPosted(w)).toHaveLength(1);
    expect(await net(w, customerAccount(PAYER_ACCT))).toBe(-OPENING);
  });

  it('F-3a: blocklisted recipient caught by the precheck: REJECTED / BLOCKLISTED_PRECHECK before P1, no DFNS request', async () => {
    const w = await world({ blocked: [TO] });
    const id = await created(w);
    const r = await w.orchestrator.advance(id);
    expect(r.record).toMatchObject({ stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK', status: 'FAILED' });
    expect(await journal(w, `pay:${id}:p1`)).toBeNull();
    expect(w.sim.requests.filter((q) => q.url.includes('/transfers'))).toHaveLength(0);
    expect(await net(w, customerAccount(PAYER_ACCT))).toBe(-OPENING);
  });

  it('a destination that is a wallet we know is refused before P1: DESTINATION_NOT_ALLOWED', async () => {
    const w = await world({ registerDestination: true });
    const id = await created(w);
    const r = await w.orchestrator.advance(id);
    expect(r.record).toMatchObject({ stage: 'REJECTED', reason: 'DESTINATION_NOT_ALLOWED', status: 'FAILED' });
    expect(await journal(w, `pay:${id}:p1`)).toBeNull();
    expect(w.sim.allTransfers()).toHaveLength(0);
  });

  it('F-3c: included but reverted: REJECTED / ONCHAIN_REVERTED, gas posted (P4 + dust), P6 refunds A + F, residual 0', async () => {
    const w = await world();
    const id = await created(w);
    await w.orchestrator.advance(id);
    const { hash, tx } = broadcastTx(w, 'reverted', TO, toWei(AMOUNT), 0n);
    w.sim.setStatus(transferId(w), 'Broadcasted', { txHash: hash, dateBroadcasted: '2026-10-07T12:01:00.000Z' });
    w.mine(tx);
    const r = await w.orchestrator.advance(id);
    expect(r.record).toMatchObject({ stage: 'REJECTED', reason: 'ONCHAIN_REVERTED', status: 'FAILED' });
    expect(await journal(w, `pay:${id}:p6`)).not.toBeNull();
    expect(await journal(w, `pay:${id}:p2`)).toBeNull();
    expect(await journal(w, gasKey(5042002n, hash))).not.toBeNull();
    expect(await net(w, customerAccount(PAYER_ACCT))).toBe(-OPENING);
    expect(await clearingOpen({ ledger: w.ledger, asset: USDC })).toBe(0n);
    expect(await conserved(w)).toBe(true);
    const chainWei = toWei(OPENING) - GAS_WEI; // the money did not move; the gas did
    expect(await walletResidual({ ledger: w.ledger, dust: w.dust, precision: P6, asset: USDC }, w.hotRef, chainWei)).toEqual({ kind: 'OK', residualWei: 0n });
  });

  it('F-3b: hash-less Failed is not proof: QUARANTINED with a nonce hold, nothing released, no resubmission', async () => {
    const w = await world();
    const id = await created(w);
    await w.orchestrator.advance(id);
    w.sim.setStatus(transferId(w), 'Failed');
    const r = await w.orchestrator.advance(id);
    expect(r.note).toContain('QUARANTINED');
    expect(r.record.stage).toBe('PENDING_APPROVAL');
    expect(r.record.status).toBe('PENDING');
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
    expect(await net(w, CLEARING)).toBe(-(AMOUNT + FEE));
    const holds = await w.store.listActiveHolds(w.hotRef);
    expect(holds.kind === 'OK' && holds.value.some((h) => h.subject === id)).toBe(true);
    await w.orchestrator.advance(id);
    expect(transfersPosted(w)).toHaveLength(1);
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
  });

  it('F-10: a chain transfer that differs from the binding never completes and pauses the rail', async () => {
    const w = await world();
    const id = await created(w);
    await w.orchestrator.advance(id);
    const { hash, tx } = broadcastTx(w, 'tampered', OTHER);
    w.sim.setStatus(transferId(w), 'Broadcasted', { txHash: hash, dateBroadcasted: '2026-10-07T12:01:00.000Z' });
    w.mine(tx);
    const r = await w.orchestrator.advance(id);
    expect(r.record.stage).toBe('CONFIRMING');
    expect(r.note).toContain('rail paused');
    const rail = await w.store.getRailState();
    expect(rail.kind === 'OK' && rail.value.paused).toBe(true);
    expect(await journal(w, `pay:${id}:p2`)).toBeNull();
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
    expect(await net(w, CLEARING)).toBe(-(AMOUNT + FEE));
  });

  it('a paused rail stops new submissions at the gateway: no DFNS request', async () => {
    const w = await world();
    await w.store.pause('test', 'tester');
    const id = await created(w);
    const r = await w.orchestrator.advance(id);
    expect(r.record.stage).toBe('CREATED');
    expect(r.note).toContain('RAIL_PAUSED');
    expect(w.sim.allTransfers()).toHaveLength(0);
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
  });
});

describe('unknown DFNS outcome: never retried blindly, never released', () => {
  const isPost = (r: { method: string; url: string }) => r.method === 'POST' && r.url.endsWith(`/wallets/${W}/transfers`);

  it('response lost AFTER DFNS created it: resolved by lookup of the externalId, no second POST, no release', async () => {
    const w = await world();
    w.sim.faults.push({ match: isPost, outcome: 'APPLY_THEN_TIMEOUT' });
    const id = await created(w);
    const first = await w.orchestrator.advance(id);
    expect(first.note).toContain('UNRESOLVED');
    expect(first.record.stage).toBe('CREATED');
    expect(first.record.status).toBe('PENDING');
    const leg = arcLeg(first.record);
    expect(leg.submit).not.toBeNull();
    expect(leg.externalRef).toBeNull();
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
    expect(w.sim.allTransfers()).toHaveLength(1);
    const posts = transfersPosted(w).length;
    const second = await w.orchestrator.advance(id);
    expect(second.record.stage).toBe('PENDING_APPROVAL');
    expect(arcLeg(second.record).externalRef).toBe(transferId(w));
    expect(transfersPosted(w)).toHaveLength(posts); // found by lookup: no new POST
    expect(w.sim.allTransfers()).toHaveLength(1);
  });

  it('request lost BEFORE DFNS saw it: only after the lookup completes empty, the SAME bytes are re-sent: still one transfer', async () => {
    const w = await world();
    w.sim.faults.push({ match: isPost, outcome: { kind: 'TIMEOUT' } });
    const id = await created(w);
    const first = await w.orchestrator.advance(id);
    expect(first.note).toContain('UNRESOLVED');
    expect(w.sim.allTransfers()).toHaveLength(0);
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
    const externalId = arcLeg(first.record).submit?.externalId;
    const second = await w.orchestrator.advance(id);
    expect(second.record.stage).toBe('PENDING_APPROVAL');
    expect(w.sim.allTransfers()).toHaveLength(1);
    expect(w.sim.allTransfers()[0]?.['externalId']).toBe(externalId);
  });

  it('lookup itself unknown: no re-POST at all', async () => {
    const w = await world();
    w.sim.faults.push({ match: isPost, outcome: 'APPLY_THEN_TIMEOUT' });
    const id = await created(w);
    await w.orchestrator.advance(id);
    const posts = transfersPosted(w).length;
    w.sim.faults.push({ match: (r) => r.method === 'GET' && r.url.includes(`/wallets/${W}/transfers`), outcome: { kind: 'TIMEOUT' } });
    const r = await w.orchestrator.advance(id);
    expect(r.note).toContain('no retry');
    expect(transfersPosted(w)).toHaveLength(posts);
    expect(r.record.stage).toBe('CREATED');
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
  });
});

describe('quarantine and fail-closed paths (§8.4 check 3, F-6, F-18)', () => {
  const isPost = (r: { method: string; url: string }) => r.method === 'POST' && r.url.endsWith(`/wallets/${W}/transfers`);
  const caseOpen = async (w: World, kind: CaseKind, id: PaymentId) => {
    const c = await w.store.getCase(deriveCaseId(kind, id));
    return c.kind === 'OK' && c.value.state === 'OPEN';
  };
  const quarantinedView = async (w: World, id: PaymentId) => {
    const v = await gatewayStoreFor(w.store).getForSubmit(id);
    return v.kind === 'OK' && v.value.quarantined;
  };

  it('F-6: unresolved after A_ambiguous: UNRESOLVED_SUBMIT case, QUARANTINED, no re-POST, nothing released', async () => {
    const w = await world();
    w.sim.faults.push({ match: isPost, outcome: { kind: 'TIMEOUT' } });
    const id = await created(w);
    await w.orchestrator.advance(id);
    const posts = transfersPosted(w).length;
    w.clock.ambiguousElapsed = true;
    const r = await w.orchestrator.advance(id);
    expect(r.note).toContain('QUARANTINED (UNRESOLVED_SUBMIT)');
    expect(await caseOpen(w, 'UNRESOLVED_SUBMIT', id)).toBe(true);
    expect(await quarantinedView(w, id)).toBe(true);
    const again = await w.orchestrator.advance(id);
    expect(again.note).toContain('no re-POST until LIFT_QUARANTINE');
    expect(transfersPosted(w)).toHaveLength(posts);
    expect(w.sim.allTransfers()).toHaveLength(0);
    expect(again.record.stage).toBe('CREATED');
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
    expect(await net(w, CLEARING)).toBe(-(AMOUNT + FEE));
    const rail = await w.store.getRailState();
    expect(rail.kind === 'OK' && rail.value.paused).toBe(false);
  });

  it('F-6: an entity DFNS already holds is still found by lookup after A_ambiguous (lookups always run)', async () => {
    const w = await world();
    w.sim.faults.push({ match: isPost, outcome: 'APPLY_THEN_TIMEOUT' });
    const id = await created(w);
    await w.orchestrator.advance(id);
    w.clock.ambiguousElapsed = true;
    const r = await w.orchestrator.advance(id);
    expect(r.record.stage).toBe('PENDING_APPROVAL');
    expect(await caseOpen(w, 'UNRESOLVED_SUBMIT', id)).toBe(false);
  });

  it('a gateway refusal flagged quarantine on a re-POST (409) opens an UNRESOLVED_SUBMIT case; later steps never POST', async () => {
    const w = await world();
    w.sim.faults.push({ match: isPost, outcome: { kind: 'TIMEOUT' } });
    w.sim.faults.push({ match: isPost, outcome: { kind: 'RESPONSE', status: 409n, headers: {}, body: JSON.stringify({ error: { message: 'conflict' } }) } });
    const id = await created(w);
    await w.orchestrator.advance(id);
    const r = await w.orchestrator.advance(id);
    expect(r.note).toContain('QUARANTINED (UNRESOLVED_SUBMIT)');
    expect(await caseOpen(w, 'UNRESOLVED_SUBMIT', id)).toBe(true);
    const posts = transfersPosted(w).length;
    const again = await w.orchestrator.advance(id);
    expect(again.note).toContain('PAYMENT_QUARANTINED');
    expect(transfersPosted(w)).toHaveLength(posts);
    expect(again.record.stage).toBe('CREATED');
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
  });

  it('a quarantine refusal with no marker (binding mismatch) pauses the rail and sends nothing', async () => {
    const w = await world();
    const id = await created(w);
    // DFNS reports another address for the bound wallet: WALLET_ADDRESS_MISMATCH, quarantine, before any marker.
    Object.assign(w.walletRec, { address: OTHER });
    const r = await w.orchestrator.advance(id);
    expect(r.note).toContain('rail paused');
    const rail = await w.store.getRailState();
    expect(rail.kind === 'OK' && rail.value.paused).toBe(true);
    expect(transfersPosted(w)).toHaveLength(0);
    expect(arcLeg(r.record).submit).toBeNull();
  });

  it('F-18: a DFNS replacement is never applied: REPLACEMENT case, QUARANTINED, nothing released', async () => {
    const w = await world();
    const id = await created(w);
    await w.orchestrator.advance(id);
    w.sim.setStatus(transferId(w), 'Pending', { replacementId: 'xfr-replacement-1' });
    const r = await w.orchestrator.advance(id);
    expect(r.note).toContain('QUARANTINED (REPLACEMENT)');
    expect(await caseOpen(w, 'REPLACEMENT', id)).toBe(true);
    expect(await quarantinedView(w, id)).toBe(true);
    expect(r.record.stage).toBe('PENDING_APPROVAL');
    expect(await journal(w, `pay:${id}:p6`)).toBeNull();
  });

  it('P1 posted but its stage change lost: a later precheck refusal never strands the reservation (P6 follows)', async () => {
    const w = await world();
    const id = await created(w);
    w.faults.arm('applySignal', 'BEFORE_COMMIT', 'TIMEOUT');
    const first = await w.orchestrator.step(id);
    expect(first.changed).toBe(false);
    expect(await journal(w, `pay:${id}:p1`)).not.toBeNull();
    // The recipient is blocklisted afterwards. P1 exists, so RESERVE completes and the gateway refuses with P6.
    w.blocklist.block(TO);
    const r = await w.orchestrator.advance(id);
    expect(r.record.legs.find((l) => l.kind === 'RESERVE')?.stage).toBe('COMPLETED');
    expect(r.record).toMatchObject({ stage: 'REJECTED', reason: 'BLOCKLISTED_PRECHECK', status: 'FAILED' });
    expect(await journal(w, `pay:${id}:p6`)).not.toBeNull();
    expect(await clearingOpen({ ledger: w.ledger, asset: USDC })).toBe(0n);
    expect(await net(w, customerAccount(PAYER_ACCT))).toBe(-OPENING);
    expect(w.sim.allTransfers()).toHaveLength(0);
  });

  it('P1 lookup unknown: RESERVE waits, posts nothing and ends nothing', async () => {
    const w = await world();
    const id = await created(w);
    w.faults.arm('getJournalByKey', 'BEFORE_COMMIT', 'UNAVAILABLE');
    const r = await w.orchestrator.step(id);
    expect(r.note).toContain('P1 lookup outcome unknown');
    expect(r.record.stage).toBe('CREATED');
  });
});

describe('HTTP edge', () => {
  const post = (w: World, body: unknown, key: string | null = 'http-key-1', p: Principal | null = principal) => createPaymentHandler(w.http, { principal: p, idempotencyKey: key === null ? undefined : key, body });

  it('POST /payments then GET /payments/:id: amounts are decimal strings, status plus stage, 201 then 200 on replay', async () => {
    const w = await world();
    const r1 = await post(w, { beneficiaryRef: 'ben-1', amount: '2.5' });
    expect(r1.status).toBe(201);
    const v = r1.body as { id: string; status: string; stage: string; amount: string; fee: string; legs: { kind: string; stage: string; status: string }[]; network: string };
    expect(v).toMatchObject({ status: 'PENDING', stage: 'PENDING_APPROVAL', amount: '2.500000', fee: '0.050000', network: 'ARC' });
    expect(v.legs.map((l) => l.kind)).toEqual(['RESERVE', 'ARC_TRANSFER']);
    expect(typeof v.amount).toBe('string');
    const r2 = await post(w, { beneficiaryRef: 'ben-1', amount: '2.5' });
    expect(r2.status).toBe(200);
    expect((r2.body as { id: string }).id).toBe(v.id);
    expect(w.sim.allTransfers()).toHaveLength(1);

    // Settle it and read it back.
    const { hash, tx } = broadcastTx(w, 'http-1');
    w.sim.setStatus(transferId(w), 'Broadcasted', { txHash: hash, dateBroadcasted: '2026-10-07T12:01:00.000Z' });
    w.mine(tx);
    await w.orchestrator.advance(v.id as PaymentId);
    const got = await getPaymentHandler(w.http, { principal, id: v.id });
    expect(got.status).toBe(200);
    expect(got.body).toMatchObject({ status: 'SETTLED', stage: 'COMPLETED', reason: null });
    const arcView = (got.body as { legs: { kind: string; txHash: string | null; status: string }[] }).legs.find((l) => l.kind === 'ARC_TRANSFER');
    expect(arcView).toMatchObject({ txHash: hash, status: 'SETTLED' });
  });

  it('same key, different amount is 409; the client cannot choose payer account, wallet, destination or fee', async () => {
    const w = await world();
    expect((await post(w, { beneficiaryRef: 'ben-1', amount: '2.5' })).status).toBe(201);
    expect((await post(w, { beneficiaryRef: 'ben-1', amount: '2.6' })).status).toBe(409);
    const w2 = await world();
    const r = await post(w2, { beneficiaryRef: 'ben-1', amount: '1', to: OTHER, destination: OTHER, fromWallet: 'x', payerAccount: 'acct-other', fee: '0' }, 'k2');
    expect(r.status).toBe(201);
    expect(w2.sim.allTransfers()[0]?.['requestBody']).toMatchObject({ to: TO });
    expect(await net(w2, customerAccount(PAYER_ACCT))).toBe(-(OPENING - 1_000_000n - FEE));
  });

  it('rejects a bad Idempotency-Key, bad body and bad amounts with 400, and creates nothing', async () => {
    const w = await world();
    for (const key of [null, '', 'k'.repeat(256), 'tab\tkey', 'naïve']) expect((await post(w, { beneficiaryRef: 'ben-1', amount: '1' }, key)).status, `key ${String(key)}`).toBe(400);
    for (const body of [null, [], 'x', {}, { beneficiaryRef: 'ben-1' }, { beneficiaryRef: '', amount: '1' }, { beneficiaryRef: 'a b', amount: '1' }]) expect((await post(w, body)).status).toBe(400);
    for (const amount of [1, 2.5, '', '0', '0.0', '-1', '+1', '1e3', '1.5e0', '1,5', ' 1', '1 ', '.5', '5.', '01', '1.0000001', '0x10', 'NaN', null, {}, 9999999999999999999999999999]) {
      expect((await post(w, { beneficiaryRef: 'ben-1', amount })).status, `amount ${String(amount)}`).toBe(400);
    }
    expect(w.sim.allTransfers()).toHaveLength(0);
    expect(await net(w, CLEARING)).toBe(0n);
  });

  it('unknown beneficiary 404, unauthenticated 403, and only the payer may read a payment (others get 404)', async () => {
    const w = await world();
    expect((await post(w, { beneficiaryRef: 'nope', amount: '1' })).status).toBe(404);
    expect((await post(w, { beneficiaryRef: 'ben-1', amount: '1' }, 'k', null)).status).toBe(403);
    const r = await post(w, { beneficiaryRef: 'ben-1', amount: '1' });
    const id = (r.body as { id: string }).id;
    const stranger: Principal = { kind: 'PAYER', owner: novaOwnerRef('someone-else'), account: novaAccountRef('acct-else') };
    expect((await getPaymentHandler(w.http, { principal: stranger, id })).status).toBe(404);
    expect((await getPaymentHandler(w.http, { principal: { kind: 'STAFF' }, id })).status).toBe(200);
    expect((await getPaymentHandler(w.http, { principal: null, id })).status).toBe(403);
    expect((await getPaymentHandler(w.http, { principal, id: 'pay-nothing' })).status).toBe(404);
    expect((await getPaymentHandler(w.http, { principal, id: `pay-${'0'.repeat(32)}` })).status).toBe(404);
  });

  it('a failed payment reads FAILED with its stage and reason', async () => {
    const w = await world({ payerOpening: 1_000_000n });
    const r = await post(w, { beneficiaryRef: 'ben-1', amount: '2.5' });
    expect(r.body).toMatchObject({ status: 'FAILED', stage: 'REJECTED', reason: 'INSUFFICIENT_FUNDS' });
  });
});

describe('parseDecimalAmount', () => {
  it('is exact: no floats, no rounding', () => {
    expect(parseDecimalAmount('2.5', P6)).toEqual({ ok: true, minor: 2_500_000n });
    expect(parseDecimalAmount('0.000001', P6)).toEqual({ ok: true, minor: 1n });
    expect(parseDecimalAmount('123456789.123456', P6)).toEqual({ ok: true, minor: 123_456_789_123_456n });
    expect(parseDecimalAmount('7', cbsPrecision(2))).toEqual({ ok: true, minor: 700n });
    expect(parseDecimalAmount('0.005', cbsPrecision(2)).ok).toBe(false);
  });
});

describe('configuration', () => {
  it('refuses any chain id but Arc testnet 5042002', async () => {
    const w = await world();
    const cfg = (chainId: bigint) => () => new PaymentOrchestrator({ precision: P6, asset: USDC, chainId, transferKind: 'Native' }, (w.orchestrator as unknown as { d: ConstructorParameters<typeof PaymentOrchestrator>[1] }).d);
    expect(cfg(5042n)).toThrow('testnet only');
    expect(cfg(5042002n)).not.toThrow();
    expect(walletRef('x')).toBe('x');
  });
});

export type { CbsMinor };
