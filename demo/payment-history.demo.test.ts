/**
 * DEMO ONLY, NOT REVIEWED (operator, 2026-10-07: "i want us to at least be able
 * to test the payment process with history by then"). Not a verification
 * artefact: no Lens R pass, not in CI, not counted by Stryker or coverage.
 *
 * What it shows: one Arc USDC payment walked through the parts built so far,
 * each step written to the client's transaction history.
 *   1. Ledger: P1 reserve (client -> GL-5 clearing), balanced, integer units.
 *   2. Signing gateway -> DFNS (in-memory simulator, throwaway keys): submit,
 *      submit marker before the POST, one POST only.
 *   3. DFNS status Broadcasted -> Confirmed, read back through the DFNS client.
 *   4. History: every step appended under the client UID, append-only,
 *      idempotent on replay; a refused payment releases with P6 and is recorded
 *      as a FAILURE.
 *
 * What it does NOT show (not built yet, lands with the full build):
 *   - the payment flow unit (PAY) that drives these steps itself;
 *   - confirmation from our own Arc indexer (here DFNS status stands in);
 *   - settlement postings (P2), gas (P4), fiat legs, payout, journey timeline.
 * Testnet chain ID only; no network, no real DFNS, no secrets.
 */
import { generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { cbsMinor, cbsPrecision, nativeWei } from '../src/amounts/index.js';
import { ARC_TESTNET } from '../src/chain/config/index.js';
import { type DfnsCredentials, DfnsClient } from '../src/dfns/client.js';
import { DfnsSimulator } from '../src/dfns/fakes/simulator.js';
import { MapGatewayStore } from '../src/dfns/fakes/stores.js';
import { deriveExternalId } from '../src/dfns/types.js';
import { type Address, type GatewayConfig, type GatewayPaymentView, SigningGateway, computeBindingDigest } from '../src/gateway/index.js';
import { ListHistory } from '../src/history/fakes.js';
import type { HistoryEntryInput, HistoryPort } from '../src/history/index.js';
import { FaultPlan } from '../src/nova-ports/fakes/faults.js';
import { MapLedger } from '../src/nova-ports/fakes/ledger-fakes.js';
import { MapWalletRegistry } from '../src/nova-ports/fakes/wallet-fakes.js';
import { idempotencyKey, ledgerAssetCode, novaAccountRef, novaOwnerRef, paymentId } from '../src/nova-ports/ids.js';
import type { JournalRequest, LedgerAccount, LedgerPort } from '../src/nova-ports/ledger.js';

const W = 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx';
const FROM: Address = '0x00e3495cf6af59008f22ffaf32d4c92ac33dac47';
const TO: Address = getAddress('0xb282dc7cde21717f18337a596e91ded00b79b25f');
const PID = 'pay-0123456789abcdef0123456789abcdef';
const CLIENT = novaOwnerRef('client-uid-demo');
const ONE_USDC_WEI = nativeWei(1_000_000_000_000_000_000n);
const CHAIN = BigInt(ARC_TESTNET.chainId);
const NOW = '2026-10-07T15:00:00.000Z';
const USDC = ledgerAssetCode('USDC');
const CONFIG: GatewayConfig = { chainId: CHAIN, transferKind: 'Native', feeCeilingWei: nativeWei(2_000_000_000_000n), wrapperAllowList: [] };

const payer: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acct-payer') };
const clearing: LedgerAccount = { kind: 'ROLE', role: 'GL-5', sub: 'arc.outbound' };
const hot: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'arc.hot' };

function credentials(): { creds: DfnsCredentials; token: string; credId: string; check: (c: string, s: { clientData: string; signature: string }) => boolean } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const token = randomBytes(24).toString('base64url');
  const credId = `cred-${randomBytes(4).toString('hex')}`;
  return {
    token,
    credId,
    creds: {
      authToken: async () => token,
      signUserActionChallenge: async ({ challenge, credId: c }) => {
        const clientData = Buffer.from(JSON.stringify({ type: 'key.get', challenge, origin: 'https://nova.test', crossOrigin: false }));
        return { credId: c, clientData: clientData.toString('base64url'), signature: sign(null, clientData, privateKey).toString('base64url') };
      },
    },
    check: (c, s) => {
      const data = Buffer.from(s.clientData, 'base64url');
      return (JSON.parse(data.toString('utf8')) as { challenge: string }).challenge === c && verify(null, data, publicKey, Buffer.from(s.signature, 'base64url'));
    },
  };
}

function paymentView(): GatewayPaymentView {
  const base = { network: 'ARC', asset: 'USDC', fromWallet: 'wallet-row-1', fromAddress: FROM, dfnsWalletId: W, to: TO, amount: ONE_USDC_WEI };
  return {
    paymentId: PID,
    version: 1n,
    stage: 'CREATED',
    quarantined: false,
    receiver: null,
    leg: { stage: 'CREATED', attempt: 1n, submit: null, externalRef: null, p6Pending: false },
    binding: { ...base, digest: computeBindingDigest(PID, base) },
  } as GatewayPaymentView;
}

function journal(template: 'P1_RESERVE' | 'P6_RELEASE'): JournalRequest {
  const amount = cbsMinor(1_000_000n);
  const [dr, cr] = template === 'P1_RESERVE' ? [payer, clearing] : [clearing, payer];
  return {
    key: idempotencyKey(`pay:${PID}:${template === 'P1_RESERVE' ? 'p1' : 'p6'}`),
    template,
    asset: USDC,
    precision: cbsPrecision(6),
    legs: [
      { account: dr, side: 'DEBIT', amount },
      { account: cr, side: 'CREDIT', amount },
    ],
    refs: { paymentId: paymentId(PID), network: 'ARC', txHash: null, logIndex: null, dfnsTransferId: null, compensates: null },
  };
}

async function world(paused = false) {
  const c = credentials();
  const sim = new DfnsSimulator(c.token, c.credId, c.check);
  sim.addWallet();
  const dfns = new DfnsClient({ baseUrl: 'https://api.dfns.io', userAgent: 'nova-arc-rail/demo', listPageLimit: 50n, maxListPages: 4n }, sim, c.creds);
  const faults = new FaultPlan();
  const store = new MapGatewayStore(faults);
  const ledger: LedgerPort = new MapLedger({
    assets: [{ asset: USDC, precision: cbsPrecision(6) }],
    accounts: [payer, clearing, hot].map((account) => ({ account, status: 'OPEN' as const })),
    opening: [
      { account: hot, asset: USDC, side: 'DEBIT', amount: cbsMinor(10_000_000n) },
      { account: payer, asset: USDC, side: 'CREDIT', amount: cbsMinor(10_000_000n) },
    ],
    faults,
  });
  store.put(paymentView());
  const gateway = new SigningGateway(CONFIG, {
    store: { getForSubmit: (id) => store.getForSubmit(id), listActiveHolds: (w) => store.listActiveHolds(w), markSubmit: (id, v, m) => store.markSubmit(id, v, m) },
    rail: { getRailState: async () => ({ paused, indexerHealthy: true, agreedHead: 4_200_000n }) },
    ledger,
    registry: new MapWalletRegistry(faults),
    precheck: async () => ({ ok: true }),
    clock: { nowIso: () => NOW },
    dfns,
  });
  const history: HistoryPort = new ListHistory();
  return { sim, dfns, ledger, gateway, history };
}

async function record(h: HistoryPort, e: Omit<HistoryEntryInput, 'clientUid' | 'paymentId' | 'occurredAt'>): Promise<void> {
  const r = await h.append({ clientUid: CLIENT, paymentId: paymentId(PID), occurredAt: NOW, ...e } as HistoryEntryInput);
  if (r.kind !== 'OK') throw new Error(`history append failed: ${JSON.stringify(r)}`);
}

describe('DEMO: Arc USDC payment with client history (stand-ins, not reviewed)', () => {
  it('reserve -> DFNS submit -> confirmed, every step in the client history', async () => {
    const { sim, dfns, ledger, gateway, history } = await world();
    const amount = { asset: USDC, units: 1_000_000n };

    // 1. Reserve the client's 1 USDC in the ledger (balanced, integer).
    expect((await ledger.postJournal(journal('P1_RESERVE'))).kind).toBe('OK');
    const clearingBal = await ledger.getBalance(clearing, USDC);
    expect(clearingBal).toMatchObject({ kind: 'OK', value: { credits: 1_000_000n } });
    await record(history, { eventId: 'reserve', kind: 'LEG', code: 'FUNDS_RESERVED', leg: 'RESERVE', amount });

    // 2. Submit through the signing gateway to DFNS (simulator).
    const out = await gateway.submit({ paymentId: PID, proposed: { kind: 'NATIVE', chainId: CHAIN, to: TO, amount: ONE_USDC_WEI } });
    expect(out.kind).toBe('SUBMITTED');
    if (out.kind !== 'SUBMITTED') return;
    expect(out.externalId).toBe(deriveExternalId(PID));
    expect(sim.requests.filter((r) => r.method === 'POST' && r.url.endsWith('/transfers'))).toHaveLength(1);
    await record(history, { eventId: 'submitted', kind: 'LEG', code: 'TRANSFER_SUBMITTED', leg: 'ARC_TRANSFER', amount });

    // 3. DFNS reports broadcast then confirmation (stand-in for our Arc indexer).
    const txHash = `0x${'ab'.repeat(32)}` as const;
    sim.setStatus(out.transfer.id, 'Broadcasted', { txHash });
    sim.setStatus(out.transfer.id, 'Confirmed', { txHash });
    const read = await dfns.getTransfer(W, out.transfer.id);
    expect(JSON.stringify(read)).toContain('Confirmed');
    await record(history, { eventId: 'confirmed', kind: 'LEG', code: 'TRANSFER_CONFIRMED', leg: 'ARC_TRANSFER', amount, txHash });

    // 4. Replaying an event never writes twice.
    await record(history, { eventId: 'confirmed', kind: 'LEG', code: 'TRANSFER_CONFIRMED', leg: 'ARC_TRANSFER', amount, txHash });

    const listed = await history.list({ clientUid: CLIENT });
    expect(listed.kind).toBe('OK');
    if (listed.kind !== 'OK') return;
    const timeline = listed.value.map((r) => `${r.seq} ${r.entry.kind} ${r.entry.code}`);
    console.log(['', 'Client history (demo):', ...timeline.map((t) => `  ${t}`)].join('\n'));
    expect(timeline).toEqual(['1 LEG FUNDS_RESERVED', '2 LEG TRANSFER_SUBMITTED', '3 LEG TRANSFER_CONFIRMED']);
  });

  it('a paused rail sends nothing; the operator cancels, the reservation is released (P6), and both are in the history', async () => {
    const { sim, ledger, gateway, history } = await world(true);
    expect((await ledger.postJournal(journal('P1_RESERVE'))).kind).toBe('OK');
    await record(history, { eventId: 'reserve', kind: 'LEG', code: 'FUNDS_RESERVED', leg: 'RESERVE' });

    const out = await gateway.submit({ paymentId: PID, proposed: { kind: 'NATIVE', chainId: CHAIN, to: TO, amount: ONE_USDC_WEI } });
    expect(out.kind).not.toBe('SUBMITTED');
    expect(sim.requests.filter((r) => r.method === 'POST' && r.url.endsWith('/transfers'))).toHaveLength(0);
    await record(history, { eventId: 'refused', kind: 'FAILURE', code: `NOT_SENT_${out.kind}`, reason: 'CANCELLED_BY_OPERATOR' });

    expect((await ledger.postJournal(journal('P6_RELEASE'))).kind).toBe('OK');
    expect(await ledger.getBalance(clearing, USDC)).toMatchObject({ kind: 'OK', value: { debits: 1_000_000n, credits: 1_000_000n } });
    await record(history, { eventId: 'released', kind: 'LEG', code: 'FUNDS_RELEASED', leg: 'RESERVE' });

    const listed = await history.list({ clientUid: CLIENT });
    if (listed.kind !== 'OK') throw new Error('list failed');
    const timeline = listed.value.map((r) => `${r.seq} ${r.entry.kind} ${r.entry.code}`);
    console.log(['', 'Client history (demo, failure path):', ...timeline.map((t) => `  ${t}`)].join('\n'));
    expect(timeline).toEqual(['1 LEG FUNDS_RESERVED', `2 FAILURE NOT_SENT_${out.kind}`, '3 LEG FUNDS_RELEASED']);
  });
});
