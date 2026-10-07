/**
 * F2 signing gateway (src/gateway/index.ts) and the wrapper-call rule
 * (src/gateway/wrapper.ts). The gateway runs against the DFNS client over both
 * fake DFNS servers, and in two structurally different worlds: (Map store,
 * MapLedger, MapWalletRegistry) and (Log store, EventLogLedger,
 * ListWalletRegistry), with the Nova ledger and registry fakes of src/nova-ports.
 * Every refusal path of §8.4 is exercised, including the open-reservation rule
 * (R3-B2), the submit marker (R3-B1), the wallet nonce hold and the
 * destination rule. Throwaway credentials only.
 */
import { createHash, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { encodeFunctionData, getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { type NativeWei, cbsMinor, cbsPrecision, nativeWei, usdcUnits } from '../../src/amounts/index.js';
import { ARC_TESTNET } from '../../src/chain/config/index.js';
import { type DfnsCredentials, DfnsClient } from '../../src/dfns/client.js';
import { feesFixture, transferFixture, walletFixture } from '../../src/dfns/fakes/fixtures.js';
import { RecordedDfns, ok200 } from '../../src/dfns/fakes/recorded.js';
import { DfnsSimulator } from '../../src/dfns/fakes/simulator.js';
import { type GatewayStoreFake, LogGatewayStore, MapGatewayStore } from '../../src/dfns/fakes/stores.js';
import { parseJson } from '../../src/dfns/json.js';
import { type DfnsTransferBody, decodeTransfer, deriveExternalId, lpDigestHex, transferBodyDigest } from '../../src/dfns/types.js';
import { FaultPlan } from '../../src/nova-ports/fakes/faults.js';
import { EventLogLedger, MapLedger } from '../../src/nova-ports/fakes/ledger-fakes.js';
import type { LedgerFakeConfig } from '../../src/nova-ports/fakes/ledger-fakes.js';
import { ListWalletRegistry, MapWalletRegistry } from '../../src/nova-ports/fakes/wallet-fakes.js';
import { idempotencyKey, ledgerAssetCode, novaAccountRef, novaOwnerRef, paymentId } from '../../src/nova-ports/ids.js';
import type { JournalRequest, LedgerAccount, LedgerPort } from '../../src/nova-ports/ledger.js';
import type { WalletRegistryPort } from '../../src/nova-ports/wallet-registry.js';
import {
  ARC_FEE_FLOOR_WEI,
  ARC_MAX_BASE_FEE_WEI,
  type Address,
  type GatewayArcLeg,
  type GatewayConfig,
  type GatewayDeps,
  type GatewayOutcome,
  type GatewayPaymentView,
  type Hex,
  type ProposedTransfer,
  type SubmitRequest,
  GatewayConfigError,
  SigningGateway,
  computeBindingDigest,
  echoMismatch,
} from '../../src/gateway/index.js';
import { MEMO_ADDRESS, USDC_ERC20_ADDRESS, deriveMemoId, verifyWrapperCall } from '../../src/gateway/wrapper.js';

const W = 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx';
const FROM: Address = '0x00e3495cf6af59008f22ffaf32d4c92ac33dac47';
const TO: Address = getAddress('0xb282dc7cde21717f18337a596e91ded00b79b25f');
const OTHER: Address = '0x1111111111111111111111111111111111111111';
const PID = 'pay-0123456789abcdef0123456789abcdef';
const PID2 = 'pay-fedcba9876543210fedcba9876543210';
const ONE_USDC = nativeWei(1_000_000_000_000_000_000n);
const CHAIN = BigInt(ARC_TESTNET.chainId);
const HEAD = 4_200_000n;
const NOW = '2026-10-06T12:00:00.000Z';
const FROM_WALLET = 'wallet-row-1';

const CONFIG: GatewayConfig = { chainId: CHAIN, transferKind: 'Native', feeCeilingWei: nativeWei(2_000_000_000_000n), wrapperAllowList: [] };

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

function view(over: Partial<GatewayPaymentView> = {}, bindingOver: Partial<GatewayPaymentView['binding']> = {}, legOver: Partial<GatewayArcLeg> = {}, id = PID): GatewayPaymentView {
  const base = { network: 'ARC', asset: 'USDC', fromWallet: FROM_WALLET, fromAddress: FROM, dfnsWalletId: W, to: TO, amount: ONE_USDC, ...bindingOver };
  return {
    paymentId: id,
    version: 1n,
    stage: 'CREATED',
    quarantined: false,
    receiver: null,
    leg: { stage: 'CREATED', attempt: 1n, submit: null, externalRef: null, p6Pending: false, ...legOver },
    binding: { ...base, digest: computeBindingDigest(id, base) },
    ...over,
  };
}

// --- Nova ledger (src/nova-ports fakes): P1 = DR GL-1 payer, CR GL-5 clearing; P6 the reverse (§9.2).
const USDC = ledgerAssetCode('USDC');
const payer: LedgerAccount = { kind: 'CUSTOMER', account: novaAccountRef('acct-payer') };
const clearing: LedgerAccount = { kind: 'ROLE', role: 'GL-5', sub: 'arc.outbound' };
const hot: LedgerAccount = { kind: 'ROLE', role: 'GL-2', sub: 'arc.hot' };
const LEDGER_CFG: LedgerFakeConfig = {
  assets: [{ asset: USDC, precision: cbsPrecision(6) }],
  accounts: [payer, clearing, hot].map((account) => ({ account, status: 'OPEN' as const })),
  opening: [
    { account: hot, asset: USDC, side: 'DEBIT', amount: cbsMinor(10_000_000n) },
    { account: payer, asset: USDC, side: 'CREDIT', amount: cbsMinor(10_000_000n) },
  ],
};
const journal = (id: string, template: 'P1_RESERVE' | 'P6_RELEASE'): JournalRequest => {
  const amount = cbsMinor(1_000_000n);
  const [dr, cr] = template === 'P1_RESERVE' ? [payer, clearing] : [clearing, payer];
  return {
    key: idempotencyKey(`pay:${id}:${template === 'P1_RESERVE' ? 'p1' : 'p6'}`),
    template,
    asset: USDC,
    precision: cbsPrecision(6),
    legs: [
      { account: dr, side: 'DEBIT', amount },
      { account: cr, side: 'CREDIT', amount },
    ],
    refs: { paymentId: paymentId(id), network: 'ARC', txHash: null, logIndex: null, dfnsTransferId: null, compensates: null },
  };
};
async function post(l: LedgerPort, id: string, template: 'P1_RESERVE' | 'P6_RELEASE'): Promise<void> {
  const r = await l.postJournal(journal(id, template));
  if (r.kind !== 'OK') throw new Error(`posting ${template} failed: ${JSON.stringify(r)}`);
}

type Kit = { readonly store: (f: FaultPlan) => GatewayStoreFake; readonly ledger: (f: FaultPlan) => LedgerPort; readonly registry: (f: FaultPlan) => WalletRegistryPort };
const KITS: readonly (readonly [string, Kit])[] = [
  ['Map store + MapLedger + MapWalletRegistry', { store: (f) => new MapGatewayStore(f), ledger: (f) => new MapLedger({ ...LEDGER_CFG, faults: f }), registry: (f) => new MapWalletRegistry(f) }],
  ['Log store + EventLogLedger + ListWalletRegistry', { store: (f) => new LogGatewayStore(f), ledger: (f) => new EventLogLedger({ ...LEDGER_CFG, faults: f }), registry: (f) => new ListWalletRegistry(f) }],
];

async function world(kit: Kit, opts: { view?: GatewayPaymentView | null; config?: Partial<GatewayConfig>; p1?: boolean } = {}) {
  const c = credentials();
  const sim = new DfnsSimulator(c.token, c.credId, c.check);
  sim.addWallet();
  const dfns = new DfnsClient({ baseUrl: 'https://api.dfns.io', userAgent: 'nova-arc-rail/test', listPageLimit: 50n, maxListPages: 4n }, sim, c.creds);
  const faults = new FaultPlan();
  const store = kit.store(faults);
  const ledger = kit.ledger(faults);
  const registry = kit.registry(faults);
  const v = opts.view === undefined ? view() : opts.view;
  if (v !== null) store.put(v);
  if (opts.p1 ?? true) await post(ledger, PID, 'P1_RESERVE');
  const state = {
    paused: false,
    indexerHealthy: true,
    agreedHead: HEAD as bigint | null,
    precheck: { ok: true } as { ok: true } | { ok: false; code: string },
    prechecked: [] as unknown[],
    /** sim.requests.length at each markSubmit call: proves the marker is committed before the POST. */
    markedAfterRequests: [] as number[],
  };
  const markSubmit = store.markSubmit.bind(store);
  const deps: GatewayDeps = {
    store: {
      getForSubmit: (id) => store.getForSubmit(id),
      listActiveHolds: (w) => store.listActiveHolds(w),
      markSubmit: async (id, ver, m) => {
        state.markedAfterRequests.push(sim.requests.length);
        return markSubmit(id, ver, m);
      },
    },
    rail: { getRailState: async () => ({ paused: state.paused, indexerHealthy: state.indexerHealthy, agreedHead: state.agreedHead }) },
    ledger,
    registry,
    precheck: async (intent) => {
      state.prechecked.push(intent);
      return state.precheck;
    },
    clock: { nowIso: () => NOW },
    dfns,
  };
  const gateway = new SigningGateway({ ...CONFIG, ...opts.config }, deps);
  return { gateway, sim, state, store, ledger, registry, faults, deps, creds: c };
}

const native = (over: Partial<Extract<ProposedTransfer, { kind: 'NATIVE' }>> = {}): ProposedTransfer => ({ kind: 'NATIVE', chainId: CHAIN, to: TO, amount: ONE_USDC, ...over });
const submit = (g: SigningGateway, proposed: ProposedTransfer = native(), id = PID) => g.submit({ paymentId: id, proposed });
const refusal = (o: GatewayOutcome) => {
  if (o.kind === 'REFUSED') expect(o.detail, o.code).not.toBe('');
  return o.kind === 'REFUSED' ? [o.code, o.quarantine] : o.kind === 'RETRY_LATER' ? [o.kind, o.code] : [o.kind];
};
const posts = (sim: DfnsSimulator) => sim.requests.filter((r) => r.method === 'POST' && r.url.endsWith('/transfers'));
const nativeBody = (id = PID): DfnsTransferBody => ({ kind: 'Native', to: TO, amount: '1000000000000000000', externalId: deriveExternalId(id) });

describe('configuration', () => {
  const deps = {} as GatewayDeps;
  it('pins chain ID 5042002 (C-01): testnet only', () => {
    expect(() => new SigningGateway({ ...CONFIG, chainId: 1n }, deps)).toThrow(GatewayConfigError);
    expect(() => new SigningGateway({ ...CONFIG, chainId: CHAIN + 1n }, deps)).toThrow('chainId must be Arc testnet 5042002');
    expect(() => new SigningGateway(CONFIG, deps)).not.toThrow();
  });
  it('the fee ceiling stays between the floor (C-30) and the max base fee (C-31)', () => {
    expect(ARC_FEE_FLOOR_WEI).toBe(ARC_TESTNET.feeFloorWei);
    expect(ARC_MAX_BASE_FEE_WEI).toBe(ARC_TESTNET.maxBaseFeeWei);
    expect(() => new SigningGateway({ ...CONFIG, feeCeilingWei: nativeWei(ARC_FEE_FLOOR_WEI - 1n) }, deps)).toThrow('feeCeilingWei must be between');
    expect(() => new SigningGateway({ ...CONFIG, feeCeilingWei: nativeWei(ARC_MAX_BASE_FEE_WEI + 1n) }, deps)).toThrow('feeCeilingWei must be between');
    expect(() => new SigningGateway({ ...CONFIG, feeCeilingWei: nativeWei(ARC_FEE_FLOOR_WEI) }, deps)).not.toThrow();
    expect(() => new SigningGateway({ ...CONFIG, feeCeilingWei: nativeWei(ARC_MAX_BASE_FEE_WEI) }, deps)).not.toThrow();
  });
  it('copies the configuration (later caller mutation has no effect)', async () => {
    const list = [{ contract: MEMO_ADDRESS, decoder: 'MEMO' as const }];
    const { gateway } = await world(KITS[0]![1], { config: { wrapperAllowList: list } });
    list.length = 0;
    expect(refusal(await submit(gateway, memoCall()))).toEqual(['CALL_ROUTE_NOT_ENABLED', false]);
  });
});

describe('R3-B2 types: one DFNS request per payment', () => {
  it('no type admits attempt ≠ 1 and a submission carries no attempt', () => {
    const leg: GatewayArcLeg = { stage: 'CREATED', attempt: 1n, submit: null, externalRef: null, p6Pending: false };
    // @ts-expect-error attempt is the literal 1n (§7.3)
    const two: GatewayArcLeg = { ...leg, attempt: 2n };
    // @ts-expect-error SubmitRequest has no attempt field
    const req: SubmitRequest = { paymentId: PID, proposed: native(), attempt: 2n };
    expect([leg.attempt, two.attempt, req.paymentId]).toEqual([1n, 2n, PID]);
  });
});

describe('computeBindingDigest', () => {
  const b = view().binding;
  it('is sha256 over the length-prefixed fields with the fixed attempt 1, addresses lower-cased', () => {
    expect(computeBindingDigest(PID, b)).toBe(`0x${lpDigestHex(['nv1-binding', PID, '1', 'ARC', 'USDC', FROM_WALLET, FROM, W, TO.toLowerCase(), '1000000000000000000'])}`);
    expect(computeBindingDigest(PID, { ...b, to: TO.toLowerCase() as Address, fromAddress: FROM.toUpperCase().replace('0X', '0x') as Address })).toBe(b.digest);
  });
  it('changes with every field and with the payment id', () => {
    const d = b.digest;
    expect(computeBindingDigest(PID2, b)).not.toBe(d);
    for (const over of [{ network: 'X' }, { asset: 'X' }, { fromWallet: 'X' }, { fromAddress: OTHER }, { dfnsWalletId: 'X' }, { to: OTHER }, { amount: nativeWei(1n) }]) {
      expect(computeBindingDigest(PID, { ...b, ...over }), Object.keys(over).join()).not.toBe(d);
    }
  });
});

describe('echoMismatch (m4)', () => {
  const body = nativeBody();
  const t = (over: Record<string, unknown> = {}, req: Record<string, unknown> = {}) =>
    decodeTransfer(parseJson(JSON.stringify(transferFixture({ walletId: W, externalId: body.externalId, requestBody: { kind: 'Native', to: TO, amount: body.amount, priority: 'Standard', externalId: body.externalId, ...req }, ...over }))));
  it('accepts the exact echo, recipient case-insensitively', () => {
    expect(echoMismatch(t(), W, body)).toBeNull();
    expect(echoMismatch(t({}, { to: TO.toLowerCase() }), W, body)).toBeNull();
  });
  it.each([
    [{ externalId: 'nv1-else' }, {}, 'externalId nv1-else'],
    [{ externalId: undefined }, {}, 'externalId null'],
    [{ walletId: 'wa-aaaaa-bbbbb-cccccccccccccccc' }, {}, 'wallet wa-aaaaa-bbbbb-cccccccccccccccc'],
    [{ network: 'Arc' }, {}, 'network Arc'],
    [{}, { kind: 'Erc20' }, 'kind'],
    [{}, { to: OTHER }, 'recipient'],
    [{}, { to: 7 }, 'recipient'],
    [{}, { amount: '2' }, 'amount'],
    [{}, { contract: USDC_ERC20_ADDRESS }, 'contract'],
  ] as const)('refuses a mismatch %#', (over, req, why) => {
    expect(echoMismatch(t(over, req), W, body)).toBe(why);
  });
  it('Erc20: the contract must be echoed', () => {
    const erc: DfnsTransferBody = { kind: 'Erc20', contract: USDC_ERC20_ADDRESS, to: TO, amount: '1000000', externalId: body.externalId };
    const base = { kind: 'Erc20', amount: '1000000' };
    expect(echoMismatch(t({}, { ...base, contract: USDC_ERC20_ADDRESS.toLowerCase() }), W, erc)).toBeNull();
    expect(echoMismatch(t({}, base), W, erc)).toBe('contract');
    expect(echoMismatch(t({}, { ...base, contract: OTHER }), W, erc)).toBe('contract');
    expect(echoMismatch(t({}, { ...base, contract: 1 }), W, erc)).toBe('contract');
  });
});

const memoCall = (over: { target?: Address; inner?: Hex; memoId?: Hex; memoData?: Hex; to?: Address; amount?: bigint; innerTarget?: Address; value?: NativeWei; suffix?: string } = {}): ProposedTransfer => {
  const inner = over.inner ?? encodeFunctionData({ abi: ERC20, functionName: 'transfer', args: [over.to ?? TO, over.amount ?? 1_000_000n] });
  const data = encodeFunctionData({ abi: MEMO, functionName: 'memo', args: [over.innerTarget ?? USDC_ERC20_ADDRESS, inner, over.memoId ?? deriveMemoId(PID), over.memoData ?? '0x'] });
  return { kind: 'CONTRACT_CALL', chainId: CHAIN, target: over.target ?? MEMO_ADDRESS, data: `${data}${over.suffix ?? ''}` as Hex, value: over.value ?? nativeWei(0n) };
};
const ERC20 = [{ type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const;
const APPROVE = [{ type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const;
const MEMO = [{ type: 'function', name: 'memo', stateMutability: 'nonpayable', inputs: [{ name: 'target', type: 'address' }, { name: 'data', type: 'bytes' }, { name: 'memoId', type: 'bytes32' }, { name: 'memoData', type: 'bytes' }], outputs: [] }] as const;

describe('wrapper-call rule (verifyWrapperCall)', () => {
  const allow = [{ contract: MEMO_ADDRESS, decoder: 'MEMO' as const }];
  const expectB = { paymentId: PID, to: TO, amount: ONE_USDC };
  const check = (p: ProposedTransfer, list = allow) => {
    if (p.kind !== 'CONTRACT_CALL') throw new Error('not a call');
    return verifyWrapperCall({ target: p.target, data: p.data, value: p.value }, expectB, list);
  };

  it('accepts an allow-listed Memo wrapping a USDC transfer that equals the binding', () => {
    expect(check(memoCall())).toEqual({ ok: true, innerTarget: USDC_ERC20_ADDRESS, recipient: TO, amount: usdcUnits(1_000_000n) });
    expect(check(memoCall({ target: MEMO_ADDRESS.toLowerCase() as Address })).ok).toBe(true);
  });
  it('derives a non-PII memo id from the payment id', () => {
    expect(deriveMemoId(PID)).toBe(`0x${lpDigestHex(['nv1-memo', PID])}`);
    expect(deriveMemoId('pay-other')).not.toBe(deriveMemoId(PID));
  });
  it.each([
    ['not allow-listed (empty list)', () => check(memoCall(), []), 'NOT_ALLOW_LISTED'],
    ['Multicall3From has no decoder, so it is never allow-listed', () => check(memoCall({ target: '0x522fAf9A91c41c443c66765030741e4AaCe147D0' })), 'NOT_ALLOW_LISTED'],
    ['native value on the call', () => check(memoCall({ value: nativeWei(1n) })), 'VALUE_NOT_ZERO'],
    ['not a memo call', () => check({ kind: 'CONTRACT_CALL', chainId: CHAIN, target: MEMO_ADDRESS, data: '0xdeadbeef', value: nativeWei(0n) }), 'UNDECODABLE'],
    ['trailing bytes after the memo call', () => check(memoCall({ suffix: '00' })), 'NON_CANONICAL'],
    ['memo data attached', () => check(memoCall({ memoData: '0x01' })), 'MEMO_DATA_NOT_EMPTY'],
    ['memo id of another payment', () => check(memoCall({ memoId: deriveMemoId('pay-other') })), 'MEMO_ID_MISMATCH'],
    ['tampered inner target (not USDC)', () => check(memoCall({ innerTarget: OTHER })), 'INNER_TARGET'],
    ['nested memo (inner target is Memo)', () => check(memoCall({ innerTarget: MEMO_ADDRESS })), 'INNER_TARGET'],
    ['tampered inner function (approve)', () => check(memoCall({ inner: encodeFunctionData({ abi: APPROVE, functionName: 'approve', args: [TO, 1_000_000n] }) })), 'INNER_FUNCTION'],
    ['extra inner call appended', () => check(memoCall({ inner: (encodeFunctionData({ abi: ERC20, functionName: 'transfer', args: [TO, 1_000_000n] }) + encodeFunctionData({ abi: ERC20, functionName: 'transfer', args: [OTHER, 5n] }).slice(2)) as Hex })), 'NON_CANONICAL'],
    ['swapped inner recipient', () => check(memoCall({ to: OTHER })), 'INNER_RECIPIENT'],
    ['changed inner amount', () => check(memoCall({ amount: 1_000_001n })), 'INNER_AMOUNT'],
    ['inner amount one unit short', () => check(memoCall({ amount: 999_999n })), 'INNER_AMOUNT'],
  ])('refuses: %s', (_n, run, reason) => {
    const v = run();
    expect(v.ok).toBe(false);
    expect(v.ok ? '' : v.reason).toBe(reason);
    expect(v.ok ? '' : v.detail.length > 0).toBe(true);
  });
  it('accepts an approved settlement contract as inner target only when configured', () => {
    const p = memoCall({ innerTarget: OTHER });
    if (p.kind !== 'CONTRACT_CALL') throw new Error('x');
    expect(verifyWrapperCall({ target: p.target, data: p.data, value: p.value }, expectB, allow, [OTHER]).ok).toBe(true);
    expect(verifyWrapperCall({ target: p.target, data: p.data, value: p.value }, expectB, allow, [USDC_ERC20_ADDRESS, OTHER]).ok).toBe(true);
    expect(verifyWrapperCall({ target: p.target, data: p.data, value: p.value }, expectB, allow, [USDC_ERC20_ADDRESS]).ok).toBe(false);
  });
});

describe.each(KITS)('SigningGateway with %s and DFNS fake #1 (simulator)', (_name, kit) => {
  it('submits a bound Native transfer built from the binding only, committing the submit marker before the POST', async () => {
    const { gateway, sim, state, store } = await world(kit);
    const out = await submit(gateway, native({ to: TO.toLowerCase() as Address }));
    expect(out.kind).toBe('SUBMITTED');
    if (out.kind !== 'SUBMITTED') return;
    expect(out.replayed).toBe(false);
    expect(out.externalId).toBe(deriveExternalId(PID));
    expect(out.transfer).toMatchObject({ walletId: W, status: 'Pending', externalId: out.externalId });
    const posted = posts(sim);
    expect(posted).toHaveLength(1);
    const text = `{"amount":"1000000000000000000","externalId":"${out.externalId}","kind":"Native","priority":"Standard","to":"${TO}"}`;
    expect(posted[0]?.body).toBe(text);
    expect(state.prechecked).toEqual([{ from: FROM, to: TO, amount: ONE_USDC }]);
    expect(sim.requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      `GET /wallets/${W}`,
      'GET /networks/fees',
      'POST /auth/action/init',
      'POST /auth/action',
      `POST /wallets/${W}/transfers`,
    ]);
    // Marked after the wallet and fee reads, before init/action/POST.
    expect(state.markedAfterRequests).toEqual([2]);
    expect(store.current(PID)).toMatchObject({
      version: 2n,
      leg: { submit: { externalId: out.externalId, bodyDigest: `0x${createHash('sha256').update(text).digest('hex')}`, markedAt: NOW, markedAtBlock: HEAD } },
    });
  });

  it('once the DFNS id is stored as externalRef, a second submit reads it back and never POSTs', async () => {
    const { gateway, sim, store } = await world(kit);
    const first = await submit(gateway);
    if (first.kind !== 'SUBMITTED') throw new Error(first.kind);
    const cur = store.current(PID)!;
    store.put({ ...cur, leg: { ...cur.leg, externalRef: first.transfer.id, stage: 'PENDING_APPROVAL' }, stage: 'PENDING_APPROVAL' });
    const before = posts(sim).length;
    const again = await submit(gateway);
    expect(again).toMatchObject({ kind: 'SUBMITTED', replayed: true, externalId: deriveExternalId(PID) });
    expect(again.kind === 'SUBMITTED' && again.transfer.id).toBe(first.transfer.id);
    expect(posts(sim)).toHaveLength(before);
    expect(sim.allTransfers()).toHaveLength(1);
  });

  it('resolved leg: a recorded transfer that does not echo, a different id, a missing marker, or an unreadable transfer', async () => {
    const w = await world(kit);
    const first = await submit(w.gateway);
    if (first.kind !== 'SUBMITTED') throw new Error(first.kind);
    const cur = w.store.current(PID)!;
    w.store.put({ ...cur, leg: { ...cur.leg, externalRef: first.transfer.id } });
    w.sim.faults.push({ match: (r) => r.url.includes('/transfers/'), outcome: { kind: 'TIMEOUT' } });
    expect(await submit(w.gateway)).toEqual({ kind: 'RETRY_LATER', code: 'DFNS_UNAVAILABLE', detail: 'get transfer: TIMEOUT: no response' });
    w.sim.setStatus(first.transfer.id, 'Pending', { requestBody: { ...(w.sim.transfer(first.transfer.id)['requestBody'] as object), to: OTHER } });
    expect(await submit(w.gateway)).toMatchObject({ kind: 'REFUSED', code: 'BINDING_MISMATCH', quarantine: true, dfnsTransferId: first.transfer.id });
    w.sim.faults.push({ match: (r) => r.url.includes('/transfers/'), outcome: ok200(transferFixture({ walletId: W, id: 'xfr-aaaaa-bbbbb-cccccccccccccccc' })) });
    const other = await submit(w.gateway);
    expect(refusal(other)).toEqual(['BINDING_MISMATCH', true]);
    expect(other.kind === 'REFUSED' ? other.detail : '').toBe('recorded DFNS transfer differs: id xfr-aaaaa-bbbbb-cccccccccccccccc');
    w.store.put({ ...cur, leg: { ...cur.leg, submit: null, externalRef: first.transfer.id } });
    expect(refusal(await submit(w.gateway))).toEqual(['LEG_INCONSISTENT', true]);
    w.store.put({ ...cur, leg: { ...cur.leg, submit: { ...cur.leg.submit!, externalId: 'nv1-x' }, externalRef: first.transfer.id } });
    expect(refusal(await submit(w.gateway))).toEqual(['LEG_INCONSISTENT', true]);
  });

  it.each([
    ['created, response lost', 'APPLY_THEN_TIMEOUT' as const],
    ['never arrived', { kind: 'TIMEOUT' } as const],
  ])('R3-B1 ambiguous POST (%s): AMBIGUOUS, the leg stays UNRESOLVED, and the re-POST sends the marker bytes and leaves one entity', async (_n, outcome) => {
    const { gateway, sim, store } = await world(kit);
    sim.faults.push({ match: (r) => r.method === 'POST' && r.url.endsWith('/transfers'), outcome });
    const out = await submit(gateway);
    expect(out).toMatchObject({ kind: 'AMBIGUOUS', externalId: deriveExternalId(PID) });
    expect(out.kind === 'AMBIGUOUS' ? out.detail : '').toContain('leg UNRESOLVED');
    const marker = store.current(PID)!.leg.submit!;
    expect(marker.externalId).toBe(deriveExternalId(PID));
    const again = await submit(gateway);
    expect(again).toMatchObject({ kind: 'SUBMITTED', replayed: false });
    expect(sim.allTransfers()).toHaveLength(1);
    const [a, b] = posts(sim);
    expect(b?.body).toBe(a?.body);
    expect(`0x${createHash('sha256').update(b?.body ?? '').digest('hex')}`).toBe(marker.bodyDigest);
    expect(store.current(PID)!.version).toBe(2n);
  });

  it('a re-POST never sends a rebuilt different body: a config change after marking is MARKER_CONFLICT, no POST', async () => {
    const w = await world(kit);
    w.sim.faults.push({ match: (r) => r.method === 'POST' && r.url.endsWith('/transfers'), outcome: { kind: 'TIMEOUT' } });
    await submit(w.gateway);
    const erc = new SigningGateway({ ...CONFIG, transferKind: 'Erc20' }, w.deps);
    const before = w.sim.requests.length;
    const out = await erc.submit({ paymentId: PID, proposed: { kind: 'ERC20', chainId: CHAIN, token: USDC_ERC20_ADDRESS, to: TO, amount: usdcUnits(1_000_000n) } });
    expect(refusal(out)).toEqual(['MARKER_CONFLICT', true]);
    expect(posts(w.sim)).toHaveLength(1);
    expect(w.sim.requests.slice(before).some((r) => r.method === 'POST')).toBe(false);
    const cur = w.store.current(PID)!;
    w.store.put({ ...cur, leg: { ...cur.leg, submit: { ...cur.leg.submit!, externalId: 'nv1-other' } } });
    expect(refusal(await submit(w.gateway))).toEqual(['MARKER_CONFLICT', true]);
  });

  it('m1: a committed marker is read back exactly once; a re-POST checks the marker itself, not only the store', async () => {
    const w = await world(kit);
    let reads = 0;
    const counted: GatewayDeps = { ...w.deps, store: { ...w.deps.store, getForSubmit: async (id) => (reads++, w.store.getForSubmit(id)) } };
    expect((await new SigningGateway(CONFIG, counted).submit({ paymentId: PID, proposed: native() })).kind).toBe('SUBMITTED');
    expect(reads).toBe(2);
    // A lax store that would accept any marker: the gateway still refuses to re-POST a different body.
    const lax = await world(kit, { view: view({}, {}, { submit: { externalId: deriveExternalId(PID), bodyDigest: '0xbeef', markedAt: NOW, markedAtBlock: HEAD } }) });
    let marks = 0;
    const laxDeps: GatewayDeps = { ...lax.deps, store: { ...lax.deps.store, markSubmit: async () => (marks++, { kind: 'OK', value: null, replayed: false }) } };
    const out = await new SigningGateway(CONFIG, laxDeps).submit({ paymentId: PID, proposed: native() });
    expect(out).toMatchObject({ kind: 'REFUSED', code: 'MARKER_CONFLICT', quarantine: true });
    expect(out.kind === 'REFUSED' ? out.detail : '').toContain('a re-POST must send the marker bytes');
    expect(marks).toBe(0);
    expect(posts(lax.sim)).toHaveLength(0);
  });

  it('a move id (or any non-payment id) is refused even when the store holds a record for it', async () => {
    const MOV = 'mov-0123456789abcdef0123456789abcdef';
    const w = await world(kit, { view: view({}, {}, {}, MOV) });
    const out = await submit(w.gateway, native(), MOV);
    expect(out).toEqual({ kind: 'REFUSED', code: 'PAYMENT_NOT_FOUND', detail: `${MOV} is not a payment id`, quarantine: false, dfnsTransferId: null });
    expect(w.sim.requests).toHaveLength(0);
  });

  it('markSubmit AMBIGUOUS before the commit: read-back shows no marker → no POST', async () => {
    const w = await world(kit);
    w.faults.arm('markSubmit', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await submit(w.gateway)).toEqual({ kind: 'RETRY_LATER', code: 'MARKER_NOT_COMMITTED', detail: 'markSubmit TIMEOUT; read-back shows no marker' });
    expect(posts(w.sim)).toHaveLength(0);
    expect(w.store.current(PID)!.leg.submit).toBeNull();
  });

  it('markSubmit AMBIGUOUS after the commit: read-back shows our marker → POST', async () => {
    const w = await world(kit);
    w.faults.arm('markSubmit', 'AFTER_COMMIT', 'TRANSPORT');
    expect((await submit(w.gateway)).kind).toBe('SUBMITTED');
    expect(posts(w.sim)).toHaveLength(1);
  });

  it('markSubmit AMBIGUOUS and the read-back AMBIGUOUS too → no POST', async () => {
    const w = await world(kit);
    w.faults.arm('markSubmit', 'BEFORE_COMMIT', 'TIMEOUT');
    w.faults.arm('getForSubmit', 'BEFORE_COMMIT', 'UNAVAILABLE');
    // The first getForSubmit consumes the armed read fault: arm it after the first read instead.
    const g = w.deps.store.getForSubmit;
    let reads = 0;
    const deps: GatewayDeps = { ...w.deps, store: { ...w.deps.store, getForSubmit: async (id) => (reads++ === 0 ? { kind: 'OK', value: w.store.current(id)!, replayed: false } : g(id)) } };
    const out = await new SigningGateway(CONFIG, deps).submit({ paymentId: PID, proposed: native() });
    expect(out).toEqual({ kind: 'RETRY_LATER', code: 'STORE_AMBIGUOUS', detail: 'markSubmit TIMEOUT; read-back UNAVAILABLE' });
    expect(posts(w.sim)).toHaveLength(0);
  });

  it('markSubmit AMBIGUOUS and a read-back showing a different marker (a concurrent writer) → MARKER_CONFLICT, no POST', async () => {
    const w = await world(kit);
    let reads = 0;
    const theirs = { externalId: deriveExternalId(PID), bodyDigest: '0xbeef' as Hex, markedAt: NOW, markedAtBlock: HEAD };
    const deps: GatewayDeps = {
      ...w.deps,
      store: {
        ...w.deps.store,
        markSubmit: async () => ({ kind: 'AMBIGUOUS', cause: 'TIMEOUT' }),
        getForSubmit: async () => ({ kind: 'OK', value: reads++ === 0 ? view() : view({}, {}, { submit: theirs }), replayed: false }),
      },
    };
    const out = await new SigningGateway(CONFIG, deps).submit({ paymentId: PID, proposed: native() });
    expect(out).toEqual({ kind: 'REFUSED', code: 'MARKER_CONFLICT', detail: 'read-back shows a different submit marker', quarantine: true, dfnsTransferId: null });
    expect(posts(w.sim)).toHaveLength(0);
    reads = 0;
    const sameId = { ...deps, store: { ...deps.store, getForSubmit: async () => ({ kind: 'OK' as const, value: reads++ === 0 ? view() : view({}, {}, { submit: { ...theirs, bodyDigest: transferBodyDigest(nativeBody()) as Hex, externalId: 'nv1-x' } }), replayed: false }) } };
    expect(refusal(await new SigningGateway(CONFIG, sameId).submit({ paymentId: PID, proposed: native() }))).toEqual(['MARKER_CONFLICT', true]);
  });

  it('markSubmit refusals: VERSION_CONFLICT (stale view, read-back), LEG_TERMINAL, MARKER_CONFLICT, NOT_FOUND', async () => {
    const stale = async (stored: GatewayPaymentView | null, seen: GatewayPaymentView) => {
      const w = await world(kit, { view: stored });
      let reads = 0;
      const deps: GatewayDeps = { ...w.deps, store: { ...w.deps.store, getForSubmit: async (id) => (reads++ === 0 ? { kind: 'OK', value: seen, replayed: false } : w.store.getForSubmit(id)) } };
      const out = await new SigningGateway(CONFIG, deps).submit({ paymentId: PID, proposed: native() });
      expect(posts(w.sim)).toHaveLength(0);
      return out;
    };
    const ours = { externalId: deriveExternalId(PID), bodyDigest: transferBodyDigest(nativeBody()) as Hex, markedAt: 'x', markedAtBlock: 1n };
    expect(await stale(view({ version: 2n }), view())).toEqual({ kind: 'RETRY_LATER', code: 'MARKER_NOT_COMMITTED', detail: 'markSubmit VERSION_CONFLICT: at version 2; read-back shows no marker' });
    expect(refusal(await stale(view({ version: 2n }, {}, { submit: { ...ours, bodyDigest: '0xbad' } }), view()))).toEqual(['MARKER_CONFLICT', true]);
    expect(refusal(await stale(view({ version: 2n }, {}, { submit: { ...ours, externalId: 'nv1-x' } }), view()))).toEqual(['MARKER_CONFLICT', true]);
    expect(refusal(await stale(view({}, {}, { stage: 'REJECTED', reason: undefined } as never), view()))).toEqual(['RESERVATION_NOT_OPEN', false]);
    expect(refusal(await stale(null, view()))).toEqual(['PAYMENT_NOT_FOUND', false]);
    // A different marker already set while our view has none: the store refuses before the version check.
    const otherMarker = await stale(view({}, {}, { submit: { ...ours, externalId: 'nv1-x' } }), view());
    expect(refusal(otherMarker)).toEqual(['MARKER_CONFLICT', true]);
    expect(otherMarker.kind === 'REFUSED' ? otherMarker.detail : '').toContain('markSubmit: ');
    // Our own marker already committed (equal): idempotent, so the POST goes.
    const w = await world(kit, { view: view({}, {}, { submit: ours }) });
    let reads = 0;
    const deps: GatewayDeps = { ...w.deps, store: { ...w.deps.store, getForSubmit: async (id) => (reads++ === 0 ? { kind: 'OK', value: view(), replayed: false } : w.store.getForSubmit(id)) } };
    expect((await new SigningGateway(CONFIG, deps).submit({ paymentId: PID, proposed: native() })).kind).toBe('SUBMITTED');
  });

  it('R3-B2: a terminal leg or payment, a pending P6, or a posted P6 refuses before any DFNS call', async () => {
    for (const [v, q] of [
      [view({}, {}, { stage: 'REJECTED' }), false],
      [view({}, {}, { stage: 'EXPIRED' }), false],
      [view({}, {}, { stage: 'CANCELLED' }), false],
      [view({}, {}, { stage: 'COMPLETED' }), false],
      [view({ stage: 'REJECTED' }), false],
      [view({}, {}, { p6Pending: true }), false],
    ] as const) {
      const w = await world(kit, { view: v });
      const out = await submit(w.gateway);
      expect(refusal(out), `${v.stage}/${v.leg.stage}`).toEqual(['RESERVATION_NOT_OPEN', q]);
      expect(w.sim.requests).toHaveLength(0);
      expect(w.state.markedAfterRequests).toHaveLength(0);
    }
    // P6 posted and the leg terminal: refused, no DFNS call.
    const done = await world(kit, { view: view({ stage: 'REJECTED' }, {}, { stage: 'REJECTED' }) });
    await post(done.ledger, PID, 'P6_RELEASE');
    expect(refusal(await submit(done.gateway))).toEqual(['RESERVATION_NOT_OPEN', false]);
    expect(done.sim.requests).toHaveLength(0);
  });

  it('R3-B2: P6 exists while the leg reads non-terminal → refused and QUARANTINE (inconsistent record)', async () => {
    const w = await world(kit);
    await post(w.ledger, PID, 'P6_RELEASE');
    const out = await submit(w.gateway);
    expect(refusal(out)).toEqual(['RESERVATION_NOT_OPEN', true]);
    expect(out.kind === 'REFUSED' ? out.detail : '').toContain('inconsistent record');
    expect(w.sim.requests).toHaveLength(0);
  });

  it('B2: P1 missing → refused and QUARANTINE; P1 AMBIGUOUS → retry; P6 AMBIGUOUS counts as released', async () => {
    const none = await world(kit, { p1: false });
    expect(refusal(await submit(none.gateway))).toEqual(['RESERVATION_NOT_OPEN', true]);
    const w = await world(kit);
    w.faults.arm('getJournalByKey', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await submit(w.gateway)).toEqual({ kind: 'RETRY_LATER', code: 'LEDGER_AMBIGUOUS', detail: `pay:${PID}:p1 TIMEOUT` });
    let calls = 0;
    const deps: GatewayDeps = {
      ...w.deps,
      ledger: { getJournalByKey: async (k) => (calls++ === 1 ? { kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' } : w.ledger.getJournalByKey(k)) },
    };
    const out = await new SigningGateway(CONFIG, deps).submit({ paymentId: PID, proposed: native() });
    expect(out).toEqual({ kind: 'REFUSED', code: 'RESERVATION_NOT_OPEN', detail: `pay:${PID}:p6 is UNAVAILABLE; counted as released`, quarantine: false, dfnsTransferId: null });
    expect(posts(w.sim)).toHaveLength(0);
  });

  it('R3-B2: a retry is a new payment with a new id, new keys and a new externalId; the old payment stays refused', async () => {
    const w = await world(kit, { view: view({ stage: 'REJECTED' }, {}, { stage: 'REJECTED' }) });
    await post(w.ledger, PID, 'P6_RELEASE');
    w.store.put(view({}, {}, {}, PID2));
    await post(w.ledger, PID2, 'P1_RESERVE');
    const fresh = await submit(w.gateway, native(), PID2);
    expect(fresh).toMatchObject({ kind: 'SUBMITTED', externalId: deriveExternalId(PID2) });
    expect(deriveExternalId(PID2)).not.toBe(deriveExternalId(PID));
    expect(refusal(await submit(w.gateway))).toEqual(['RESERVATION_NOT_OPEN', false]);
    expect(w.sim.allTransfers().map((t) => t['externalId'])).toEqual([deriveExternalId(PID2)]);
  });

  it('B3: an active nonce hold on the sending wallet refuses every submission (re-POSTs too), read from the store each time', async () => {
    const w = await world(kit);
    w.store.placeHold(FROM_WALLET, 'hold-1', 'xfr-20g4k-nsdpo-mg6arrifgvid4orn');
    const out = await submit(w.gateway);
    expect(out).toEqual({ kind: 'REFUSED', code: 'WALLET_NONCE_HOLD', detail: `wallet ${FROM_WALLET} held by hold-1 (DFNS transfer xfr-20g4k-nsdpo-mg6arrifgvid4orn)`, quarantine: false, dfnsTransferId: null });
    expect(w.sim.requests).toHaveLength(0);
    // A "restarted" gateway over the same store still refuses.
    expect(refusal(await new SigningGateway(CONFIG, w.deps).submit({ paymentId: PID, proposed: native() }))).toEqual(['WALLET_NONCE_HOLD', false]);
    // An UNRESOLVED leg's re-POST is refused too.
    const cur = w.store.current(PID)!;
    w.store.put({ ...cur, leg: { ...cur.leg, submit: { externalId: deriveExternalId(PID), bodyDigest: transferBodyDigest(nativeBody()) as Hex, markedAt: NOW, markedAtBlock: HEAD } } });
    expect(refusal(await submit(w.gateway))).toEqual(['WALLET_NONCE_HOLD', false]);
    expect(posts(w.sim)).toHaveLength(0);
    // A hold on another wallet does not block; lifting this one does.
    w.store.liftHold('hold-1');
    w.store.placeHold('wallet-row-2', 'hold-2', 'xfr-x');
    expect((await submit(w.gateway)).kind).toBe('SUBMITTED');
  });

  it('B3: holds AMBIGUOUS → retry, nothing sent', async () => {
    const w = await world(kit);
    w.faults.arm('listActiveHolds', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await submit(w.gateway)).toEqual({ kind: 'RETRY_LATER', code: 'HOLDS_AMBIGUOUS', detail: 'listActiveHolds TIMEOUT' });
    expect(w.sim.requests).toHaveLength(0);
  });

  it('Lens R-1 m1: a hold placed while the marker commits (concurrent applySignal) stops the POST; the marker stays for a later re-POST', async () => {
    const w = await world(kit);
    const XH = 'xfr-20g4k-nsdpo-mg6arrifgvid4orn';
    const deps: GatewayDeps = {
      ...w.deps,
      store: {
        ...w.deps.store,
        markSubmit: async (id, ver, m) => {
          const r = await w.deps.store.markSubmit(id, ver, m);
          w.store.placeHold(FROM_WALLET, 'hold-race', XH);
          return r;
        },
      },
    };
    const out = await new SigningGateway(CONFIG, deps).submit({ paymentId: PID, proposed: native() });
    expect(out).toEqual({
      kind: 'REFUSED',
      code: 'WALLET_NONCE_HOLD',
      detail: `after the submit marker: wallet ${FROM_WALLET} held by hold-race (DFNS transfer ${XH})`,
      quarantine: false,
      dfnsTransferId: null,
    });
    expect(posts(w.sim)).toHaveLength(0);
    expect(w.state.markedAfterRequests).toHaveLength(1);
    expect(w.store.current(PID)?.leg.submit).toMatchObject({ externalId: deriveExternalId(PID), bodyDigest: transferBodyDigest(nativeBody()) });
    // Released: the next submit re-POSTs exactly the marker bytes, once, with no second markSubmit.
    w.store.liftHold('hold-race');
    expect(await submit(w.gateway)).toMatchObject({ kind: 'SUBMITTED', externalId: deriveExternalId(PID), replayed: false });
    expect(posts(w.sim)).toHaveLength(1);
    expect(w.state.markedAfterRequests).toHaveLength(1);
  });

  it('Lens R-1 m1: holds unreadable after the marker → retry, no POST', async () => {
    const w = await world(kit);
    let reads = 0;
    const deps: GatewayDeps = {
      ...w.deps,
      store: { ...w.deps.store, listActiveHolds: async (x) => (reads++ === 0 ? w.store.listActiveHolds(x) : { kind: 'AMBIGUOUS', cause: 'UNAVAILABLE' }) },
    };
    const out = await new SigningGateway(CONFIG, deps).submit({ paymentId: PID, proposed: native() });
    expect(out).toEqual({ kind: 'RETRY_LATER', code: 'HOLDS_AMBIGUOUS', detail: 'after the submit marker: listActiveHolds UNAVAILABLE' });
    expect([reads, posts(w.sim).length]).toEqual([2, 0]);
  });

  it('m10: a company-owned destination, or a customer wallet not owned by the receiver, is DESTINATION_NOT_ALLOWED', async () => {
    const reg = async (w: Awaited<ReturnType<typeof world>>, owner: string, role: 'TREASURY_HOT' | 'GAS_FLOAT' | 'CUSTOMER_DEPOSIT') => {
      const r = await w.registry.register(idempotencyKey(`reg-${owner}-${role}`.toLowerCase().replace(/_/g, "-")), {
        owner: owner === 'COMPANY' ? 'COMPANY' : novaOwnerRef(owner),
        network: 'ARC',
        role,
        address: TO.toLowerCase() as Address,
        custody: { provider: 'DFNS', walletId: 'wa-zzzzz-zzzzz-zzzzzzzzzzzzzzzz', dfnsNetwork: 'ArcTestnet' },
        status: 'ACTIVE',
      });
      if (r.kind !== 'OK') throw new Error(JSON.stringify(r));
    };
    const company = await world(kit);
    await reg(company, 'COMPANY', 'GAS_FLOAT');
    const c = await submit(company.gateway);
    expect(refusal(c)).toEqual(['DESTINATION_NOT_ALLOWED', false]);
    expect(c.kind === 'REFUSED' ? c.detail : '').toContain('company moves are P10 only');
    expect(posts(company.sim)).toHaveLength(0);
    const stranger = await world(kit, { view: view({ receiver: 'user-b' }) });
    await reg(stranger, 'user-a', 'CUSTOMER_DEPOSIT');
    expect(refusal(await submit(stranger.gateway))).toEqual(['DESTINATION_NOT_ALLOWED', false]);
    const noReceiver = await world(kit);
    await reg(noReceiver, 'user-a', 'CUSTOMER_DEPOSIT');
    expect(refusal(await submit(noReceiver.gateway))).toEqual(['DESTINATION_NOT_ALLOWED', false]);
    const own = await world(kit, { view: view({ receiver: 'user-a' }) });
    await reg(own, 'user-a', 'CUSTOMER_DEPOSIT');
    expect((await submit(own.gateway)).kind).toBe('SUBMITTED');
    const amb = await world(kit);
    amb.faults.arm('findByAddress', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await submit(amb.gateway)).toEqual({ kind: 'RETRY_LATER', code: 'REGISTRY_AMBIGUOUS', detail: 'findByAddress TIMEOUT' });
    // On a re-POST of an UNRESOLVED leg the refusal quarantines instead (the leg is never ended, F-3a, F-6).
    const marked = await world(kit, { view: view({}, {}, { submit: { externalId: deriveExternalId(PID), bodyDigest: transferBodyDigest(nativeBody()) as Hex, markedAt: NOW, markedAtBlock: HEAD } }) });
    await reg(marked, 'COMPANY', 'TREASURY_HOT');
    expect(refusal(await submit(marked.gateway))).toEqual(['DESTINATION_NOT_ALLOWED', true]);
  });

  it('the network precheck (blocklist, zero address, self-transfer) can refuse; on a re-POST it quarantines', async () => {
    const w = await world(kit);
    w.state.precheck = { ok: false, code: 'RECIPIENT_BLOCKLISTED' };
    expect(await submit(w.gateway)).toEqual({ kind: 'REFUSED', code: 'NETWORK_PRECHECK', detail: 'RECIPIENT_BLOCKLISTED', quarantine: false, dfnsTransferId: null });
    expect(w.sim.allTransfers()).toHaveLength(0);
    const m = await world(kit, { view: view({}, {}, { submit: { externalId: deriveExternalId(PID), bodyDigest: transferBodyDigest(nativeBody()) as Hex, markedAt: NOW, markedAtBlock: HEAD } }) });
    m.state.precheck = { ok: false, code: 'SENDER_BLOCKLISTED' };
    expect(refusal(await submit(m.gateway))).toEqual(['NETWORK_PRECHECK', true]);
  });

  it('refuses a wrong chain ID in the proposal', async () => {
    const { gateway, sim } = await world(kit);
    expect(refusal(await submit(gateway, native({ chainId: 5042n })))).toEqual(['CHAIN_ID_MISMATCH', true]);
    expect(refusal(await submit(gateway, native({ chainId: 1n })))).toEqual(['CHAIN_ID_MISMATCH', true]);
    expect(sim.requests).toHaveLength(0);
  });

  it('refuses a DFNS wallet on mainnet (Arc) or another network', async () => {
    const a = await world(kit);
    a.sim.addWallet({ network: 'Arc' });
    expect(refusal(await submit(a.gateway))).toEqual(['NETWORK_DISABLED', true]);
    const b = await world(kit);
    b.sim.addWallet({ network: 'EthereumSepolia' });
    const out = await submit(b.gateway);
    expect(refusal(out)).toEqual(['CHAIN_ID_MISMATCH', true]);
    expect(out.kind === 'REFUSED' ? out.detail : '').toBe('wallet network EthereumSepolia is not ArcTestnet');
    expect(a.sim.allTransfers()).toHaveLength(0);
  });

  it('refuses a mismatched recipient or amount vs the payment record', async () => {
    const { gateway, sim } = await world(kit);
    expect(refusal(await submit(gateway, native({ to: OTHER })))).toEqual(['BINDING_MISMATCH', true]);
    expect(refusal(await submit(gateway, native({ amount: nativeWei(ONE_USDC + 1n) })))).toEqual(['BINDING_MISMATCH', true]);
    expect(refusal(await submit(gateway, native({ amount: nativeWei(ONE_USDC - 1n) })))).toEqual(['BINDING_MISMATCH', true]);
    expect(sim.requests).toHaveLength(0);
  });

  it('refuses a stored binding whose digest does not recompute (tampered record)', async () => {
    const v = view();
    const { gateway } = await world(kit, { view: { ...v, binding: { ...v.binding, to: OTHER } } });
    expect(refusal(await submit(gateway, native({ to: OTHER })))).toEqual(['BINDING_MISMATCH', true]);
    const w2 = await world(kit, { view: { ...v, binding: { ...v.binding, digest: `0x${'00'.repeat(32)}` } } });
    const out = await submit(w2.gateway);
    expect(out.kind === 'REFUSED' ? out.detail : '').toBe('stored binding digest does not recompute');
  });

  it.each([[{ network: 'BASE' }], [{ asset: 'EURC' }], [{ to: '0x12' as Address }], [{ fromAddress: 'nope' as Address }], [{ amount: nativeWei(0n) }]])('refuses an invalid binding %#', async (over) => {
    const { gateway } = await world(kit, { view: view({}, over) });
    expect(refusal(await submit(gateway))).toEqual(['BINDING_INVALID', true]);
  });

  it('refuses any contract call that is not allow-listed, including Memo and tampered calls', async () => {
    const { gateway, sim } = await world(kit);
    expect(refusal(await submit(gateway, memoCall()))).toEqual(['CONTRACT_CALL_NOT_ALLOWED', true]);
    expect(
      refusal(await submit(gateway, { kind: 'CONTRACT_CALL', chainId: CHAIN, target: USDC_ERC20_ADDRESS, data: encodeFunctionData({ abi: ERC20, functionName: 'transfer', args: [TO, 1_000_000n] }), value: nativeWei(0n) })),
    ).toEqual(['CONTRACT_CALL_NOT_ALLOWED', true]);
    expect(sim.requests).toHaveLength(0);
  });

  it('with Memo allow-listed, tampered inner calls are refused and a valid one still has no D1 route', async () => {
    const { gateway, sim } = await world(kit, { config: { wrapperAllowList: [{ contract: MEMO_ADDRESS, decoder: 'MEMO' }] } });
    for (const p of [memoCall({ to: OTHER }), memoCall({ amount: 2n }), memoCall({ innerTarget: OTHER }), memoCall({ suffix: 'ab' })]) {
      expect(refusal(await submit(gateway, p))).toEqual(['CONTRACT_CALL_NOT_ALLOWED', true]);
    }
    const out = await submit(gateway, memoCall());
    expect(refusal(out)).toEqual(['CALL_ROUTE_NOT_ENABLED', false]);
    expect(out.kind === 'REFUSED' ? out.detail : '').toContain('no allow-listed DFNS route');
    expect(sim.requests).toHaveLength(0);
  });

  it('an ERC20 proposal is refused while transferKind is Native', async () => {
    const { gateway } = await world(kit);
    expect(refusal(await submit(gateway, { kind: 'ERC20', chainId: CHAIN, token: USDC_ERC20_ADDRESS, to: TO, amount: usdcUnits(1_000_000n) }))).toEqual(['TRANSFER_KIND_NOT_ENABLED', false]);
  });

  it('Erc20 mode (Q-N1): sends USDC units to C-12; refuses Native, other tokens, mismatches and sub-unit dust', async () => {
    const erc = (over: Partial<Extract<ProposedTransfer, { kind: 'ERC20' }>> = {}): ProposedTransfer => ({ kind: 'ERC20', chainId: CHAIN, token: USDC_ERC20_ADDRESS, to: TO, amount: usdcUnits(1_000_000n), ...over });
    const { gateway, sim } = await world(kit, { config: { transferKind: 'Erc20' } });
    expect(refusal(await submit(gateway, native()))).toEqual(['TRANSFER_KIND_NOT_ENABLED', false]);
    expect(refusal(await submit(gateway, erc({ token: OTHER })))).toEqual(['CONTRACT_CALL_NOT_ALLOWED', true]);
    expect(refusal(await submit(gateway, erc({ to: OTHER })))).toEqual(['BINDING_MISMATCH', true]);
    expect(refusal(await submit(gateway, erc({ amount: usdcUnits(999_999n) })))).toEqual(['BINDING_MISMATCH', true]);
    expect((await submit(gateway, erc({ token: '0x3600000000000000000000000000000000000000' }))).kind).toBe('SUBMITTED');
    expect(JSON.parse(posts(sim)[0]?.body ?? '{}')).toEqual({ kind: 'Erc20', contract: USDC_ERC20_ADDRESS, to: TO, amount: '1000000', priority: 'Standard', externalId: deriveExternalId(PID) });
    const dust = await world(kit, { config: { transferKind: 'Erc20' }, view: view({}, { amount: nativeWei(ONE_USDC + 1n) }) });
    expect(refusal(await submit(dust.gateway, erc()))).toEqual(['BINDING_MISMATCH', true]);
  });

  it('rail state, missing agreed head, quarantine, non-payment ids and missing payments stop everything before any call', async () => {
    const w = await world(kit);
    w.state.paused = true;
    expect(refusal(await submit(w.gateway))).toEqual(['RAIL_PAUSED', false]);
    w.state.paused = false;
    w.state.indexerHealthy = false;
    expect(refusal(await submit(w.gateway))).toEqual(['INDEXER_UNHEALTHY', false]);
    w.state.indexerHealthy = true;
    w.state.agreedHead = null;
    expect(refusal(await submit(w.gateway))).toEqual(['INDEXER_UNHEALTHY', false]);
    w.state.agreedHead = HEAD;
    expect(refusal(await submit(w.gateway, native(), 'mov-0123456789abcdef0123456789abcdef'))).toEqual(['PAYMENT_NOT_FOUND', false]);
    expect(refusal(await submit(w.gateway, native(), PID2))).toEqual(['PAYMENT_NOT_FOUND', false]);
    w.store.put(view({}, {}, {}, PID2));
    const swapped: GatewayDeps = { ...w.deps, store: { ...w.deps.store, getForSubmit: async () => w.store.getForSubmit(PID2) } };
    expect(refusal(await new SigningGateway(CONFIG, swapped).submit({ paymentId: PID, proposed: native() }))).toEqual(['PAYMENT_NOT_FOUND', false]);
    w.faults.arm('getForSubmit', 'BEFORE_COMMIT', 'TIMEOUT');
    expect(await submit(w.gateway)).toEqual({ kind: 'RETRY_LATER', code: 'STORE_AMBIGUOUS', detail: 'TIMEOUT' });
    w.store.put(view({ quarantined: true }));
    expect(refusal(await submit(w.gateway))).toEqual(['PAYMENT_QUARANTINED', false]);
    expect(w.sim.requests).toHaveLength(0);
  });

  it('wallet checks: missing, unavailable, inactive, vault, wrong id, wrong or absent address', async () => {
    const missing = await world(kit, { view: view({}, { dfnsWalletId: 'wa-aaaaa-bbbbb-cccccccccccccccc' }) });
    expect(refusal(await submit(missing.gateway))).toEqual(['WALLET_NOT_FOUND', true]);
    const down = await world(kit);
    down.sim.faults.push({ match: () => true, outcome: { kind: 'TIMEOUT' } });
    expect(await submit(down.gateway)).toMatchObject({ kind: 'RETRY_LATER', code: 'DFNS_UNAVAILABLE', detail: 'get wallet: TIMEOUT: no response' });
    const forbidden = await world(kit);
    forbidden.sim.faults.push({ match: () => true, outcome: { kind: 'RESPONSE', status: 403n, headers: {}, body: 'no' } });
    expect(await submit(forbidden.gateway)).toMatchObject({ kind: 'RETRY_LATER', code: 'DFNS_UNAVAILABLE', detail: 'get wallet: FORBIDDEN: no' });
    for (const [over, code, q] of [
      [{ status: 'Inactive' }, 'WALLET_NOT_ACTIVE', false],
      [{ status: 'Archived' }, 'WALLET_NOT_ACTIVE', false],
      [{ vaultId: 'vlt-5vbsp-u62g1-ostmunqgds5o9tc2' }, 'WALLET_IS_VAULT', true],
      [{ address: OTHER }, 'WALLET_ADDRESS_MISMATCH', true],
      [{ address: FROM.toUpperCase().replace('0X', '0x') }, null, null],
    ] as const) {
      const w = await world(kit);
      w.sim.addWallet(over);
      const out = await submit(w.gateway);
      if (code === null) expect(out.kind).toBe('SUBMITTED');
      else expect(refusal(out)).toEqual([code, q]);
    }
    const noAddress = await world(kit);
    const wal = noAddress.sim.addWallet();
    delete wal['address'];
    expect(refusal(await submit(noAddress.gateway))).toEqual(['WALLET_ADDRESS_MISMATCH', true]);
    const otherId = await world(kit);
    otherId.sim.faults.push({ match: (r) => r.url.endsWith(`/wallets/${W}`), outcome: ok200(walletFixture({ id: 'wa-aaaaa-bbbbb-cccccccccccccccc' })) });
    expect(refusal(await submit(otherId.gateway))).toEqual(['WALLET_ADDRESS_MISMATCH', true]);
  });

  it('fee pre-check: above the ceiling waits; at the ceiling sends; fees for another network or unavailable fees do not send', async () => {
    const above = await world(kit);
    above.sim.feeStandardMaxFeePerGas = '2000000000001';
    expect(await submit(above.gateway)).toEqual({ kind: 'RETRY_LATER', code: 'FEE_ABOVE_CEILING', detail: 'standard maxFeePerGas 2000000000001 > ceiling 2000000000000' });
    expect(above.sim.allTransfers()).toHaveLength(0);
    expect(above.state.markedAfterRequests).toHaveLength(0);
    const at = await world(kit);
    at.sim.feeStandardMaxFeePerGas = '2000000000000';
    expect((await submit(at.gateway)).kind).toBe('SUBMITTED');
    const other = await world(kit);
    other.sim.faults.push({ match: (r) => r.url.includes('/networks/fees'), outcome: ok200(feesFixture('1', 'Arc')) });
    expect(refusal(await submit(other.gateway))).toEqual(['FEES_UNEXPECTED', false]);
    const down = await world(kit);
    down.sim.faults.push({ match: (r) => r.url.includes('/networks/fees'), outcome: { kind: 'RESPONSE', status: 500n, headers: {}, body: '' } });
    expect(await submit(down.gateway)).toEqual({ kind: 'RETRY_LATER', code: 'DFNS_UNAVAILABLE', detail: 'fees: UNAVAILABLE: HTTP 500' });
  });

  it('DFNS refusals on the POST: 409 quarantines, 429 and a failed user action wait, other 4xx refuse with the leg UNRESOLVED', async () => {
    const post = (r: { method: string; url: string }) => r.method === 'POST' && r.url.endsWith('/transfers');
    const conflict = await world(kit);
    conflict.sim.faults.push({ match: post, outcome: { kind: 'RESPONSE', status: 409n, headers: {}, body: '' } });
    expect(refusal(await submit(conflict.gateway))).toEqual(['EXTERNAL_ID_CONFLICT', true]);
    const limited = await world(kit);
    limited.sim.faults.push({ match: post, outcome: { kind: 'RESPONSE', status: 429n, headers: {}, body: 'slow' } });
    expect(await submit(limited.gateway)).toEqual({ kind: 'RETRY_LATER', code: 'DFNS_RETRYABLE', detail: 'RATE_LIMITED: slow' });
    expect(limited.store.current(PID)!.leg.submit).not.toBeNull();
    const ua = await world(kit);
    ua.sim.faults.push({ match: (r) => r.url.endsWith('/auth/action/init'), outcome: { kind: 'TIMEOUT' } });
    expect(refusal(await submit(ua.gateway))).toEqual(['RETRY_LATER', 'DFNS_RETRYABLE']);
    const bad = await world(kit);
    bad.sim.faults.push({ match: post, outcome: { kind: 'RESPONSE', status: 422n, headers: {}, body: 'archived' } });
    expect(await submit(bad.gateway)).toEqual({ kind: 'REFUSED', code: 'DFNS_REJECTED', detail: 'UNPROCESSABLE: archived; leg stays UNRESOLVED (F-6)', quarantine: true, dfnsTransferId: null });
  });

  it('m4: a DFNS answer that does not echo our request is refused, and the DFNS transfer id is returned for linking', async () => {
    for (const over of [{ externalId: 'nv1-someone-else' }, { walletId: 'wa-aaaaa-bbbbb-cccccccccccccccc' }, { network: 'Arc' }, { to: OTHER }, { amount: '2' }, { kind: 'Erc20' }, { contract: USDC_ERC20_ADDRESS }]) {
      const w = await world(kit);
      const ext = deriveExternalId(PID);
      const reqBody: Record<string, unknown> = { kind: 'Native', to: TO, amount: '1000000000000000000', priority: 'Standard', externalId: ext };
      const t = transferFixture({ walletId: W, externalId: ext, requestBody: reqBody });
      const { to, amount, kind, contract, ...rest } = over as { to?: string; amount?: string; kind?: string; contract?: string };
      Object.assign(t, rest);
      t['requestBody'] = { ...reqBody, ...(to === undefined ? {} : { to }), ...(amount === undefined ? {} : { amount }), ...(kind === undefined ? {} : { kind }), ...(contract === undefined ? {} : { contract }) };
      w.sim.faults.push({ match: (r) => r.method === 'POST' && r.url.endsWith('/transfers'), outcome: ok200(t) });
      const out = await submit(w.gateway);
      expect(refusal(out), JSON.stringify(over)).toEqual(['BINDING_MISMATCH', true]);
      expect(out.kind === 'REFUSED' ? out.dfnsTransferId : null).toBe(t['id']);
    }
  });
});

describe('SigningGateway with DFNS fake #2 (recorded exchanges)', () => {
  const kit = KITS[1]![1];
  const script = (c: ReturnType<typeof credentials>, ext: string, postOutcome: 'OK' | 'TIMEOUT') => {
    const userAction = randomBytes(12).toString('hex');
    return {
      userAction,
      steps: [
        { method: 'GET' as const, path: `/wallets/${W}`, respond: ok200(walletFixture()) },
        { method: 'GET' as const, path: '/networks/fees?network=ArcTestnet', respond: ok200(feesFixture()) },
        { method: 'POST' as const, path: '/auth/action/init', respond: ok200({ challenge: 'c', challengeIdentifier: 'ci', allowCredentials: { key: [{ id: c.credId }], webauthn: [] } }) },
        { method: 'POST' as const, path: '/auth/action', respond: ok200({ userAction }) },
        {
          method: 'POST' as const,
          path: `/wallets/${W}/transfers`,
          check: (r: { headers: Readonly<Record<string, string>> }) => expect(r.headers['x-dfns-useraction']).toBe(userAction),
          respond: postOutcome === 'TIMEOUT' ? { kind: 'TIMEOUT' as const } : (r: { body: string | null }) => ok200(transferFixture({ walletId: W, externalId: ext, network: 'ArcTestnet', requestBody: JSON.parse(r.body ?? '{}') })),
        },
      ],
    };
  };
  async function recordedWorld(steps: ConstructorParameters<typeof RecordedDfns>[0], c: ReturnType<typeof credentials>) {
    const w = await world(kit);
    const rec = new RecordedDfns(steps);
    const dfns = new DfnsClient({ baseUrl: 'https://api.dfns.io', userAgent: 'ua', listPageLimit: 50n, maxListPages: 1n }, rec, c.creds);
    return { ...w, rec, gateway: new SigningGateway(CONFIG, { ...w.deps, dfns }) };
  }

  it('runs exactly wallet → fees → (marker) → init → action → POST against the archived examples', async () => {
    const c = credentials();
    const ext = deriveExternalId(PID);
    const { steps } = script(c, ext, 'OK');
    const w = await recordedWorld(steps, c);
    expect(await w.gateway.submit({ paymentId: PID, proposed: native() })).toMatchObject({ kind: 'SUBMITTED', externalId: ext, replayed: false });
    expect(w.rec.remaining()).toBe(0);
    expect(w.store.current(PID)!.leg.submit?.externalId).toBe(ext);
  });

  it('R3-B1: a dropped POST response, then the re-POST of the same bytes with a fresh user action', async () => {
    const c = credentials();
    const ext = deriveExternalId(PID);
    const first = script(c, ext, 'TIMEOUT');
    const second = script(c, ext, 'OK');
    const w = await recordedWorld([...first.steps, ...second.steps], c);
    expect((await w.gateway.submit({ paymentId: PID, proposed: native() })).kind).toBe('AMBIGUOUS');
    expect(await w.gateway.submit({ paymentId: PID, proposed: native() })).toMatchObject({ kind: 'SUBMITTED', externalId: ext });
    expect(w.rec.remaining()).toBe(0);
    const bodies = w.rec.seen.filter((r) => r.method === 'POST' && r.url.endsWith('/transfers')).map((r) => r.body);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
    expect(`0x${createHash('sha256').update(bodies[0] ?? '').digest('hex')}`).toBe(w.store.current(PID)!.leg.submit?.bodyDigest);
  });
});

describe.each(KITS)('m1: the record is read back after the marker, on every path (%s)', (_name, kit) => {
  const ours = () => ({ externalId: deriveExternalId(PID), bodyDigest: transferBodyDigest(nativeBody()) as Hex, markedAt: NOW, markedAtBlock: HEAD });
  /** First read returns `first`; the read-back returns `second`. markSubmit answers OK without touching the store. */
  async function run(second: GatewayPaymentView | 'AMBIGUOUS', first: GatewayPaymentView = view()) {
    const w = await world(kit);
    let reads = 0;
    let marks = 0;
    const deps: GatewayDeps = {
      ...w.deps,
      store: {
        ...w.deps.store,
        markSubmit: async () => (marks++, { kind: 'OK', value: null, replayed: false }),
        getForSubmit: async () => {
          if (reads++ === 0) return { kind: 'OK', value: first, replayed: false };
          return second === 'AMBIGUOUS' ? { kind: 'AMBIGUOUS', cause: 'TIMEOUT' } : { kind: 'OK', value: second, replayed: false };
        },
      },
    };
    const out = await new SigningGateway(CONFIG, deps).submit({ paymentId: PID, proposed: native() });
    return { out, posted: posts(w.sim).length, reads, marks };
  }
  const marked = (over: Partial<GatewayPaymentView> = {}, bindingOver: Partial<GatewayPaymentView['binding']> = {}, legOver: Partial<GatewayArcLeg> = {}) =>
    view(over, bindingOver, { submit: ours(), ...legOver });

  it('the Lens R probe: a stale view, an equal marker committed concurrently, then QUARANTINED → refused, no POST', async () => {
    const w = await world(kit, { view: view({ version: 3n, quarantined: true }, {}, { submit: ours() }) });
    let reads = 0;
    const deps: GatewayDeps = { ...w.deps, store: { ...w.deps.store, getForSubmit: async (id) => (reads++ === 0 ? { kind: 'OK', value: view(), replayed: false } : w.store.getForSubmit(id)) } };
    const out = await new SigningGateway(CONFIG, deps).submit({ paymentId: PID, proposed: native() });
    expect(out).toEqual({
      kind: 'REFUSED',
      code: 'PAYMENT_QUARANTINED',
      detail: 'marker committed; read-back shows the payment QUARANTINED: a re-POST needs a LIFT_QUARANTINE decision first',
      quarantine: false,
      dfnsTransferId: null,
    });
    expect(posts(w.sim)).toHaveLength(0);
  });

  it('a re-POST of a held marker is read back too: QUARANTINED meanwhile → refused, no markSubmit, no POST', async () => {
    const r = await run(marked({ quarantined: true }), marked());
    expect(r.out).toMatchObject({ kind: 'REFUSED', code: 'PAYMENT_QUARANTINED', quarantine: false });
    expect(r.out.kind === 'REFUSED' ? r.out.detail : '').toMatch(/^marker held; read-back shows the payment QUARANTINED/);
    expect([r.posted, r.marks, r.reads]).toEqual([0, 0, 2]);
  });

  it('a read-back that fails or shows no marker never POSTs', async () => {
    const amb = await run('AMBIGUOUS');
    expect(amb.out).toEqual({ kind: 'RETRY_LATER', code: 'STORE_AMBIGUOUS', detail: 'marker committed; read-back TIMEOUT' });
    expect(amb.posted).toBe(0);
    const gone = await run(view(), marked());
    expect(gone.out).toEqual({ kind: 'RETRY_LATER', code: 'MARKER_NOT_COMMITTED', detail: 'marker held; read-back shows no marker' });
    expect(gone.posted).toBe(0);
  });

  it('a DFNS transfer recorded meanwhile → RETRY_LATER LEG_CHANGED (the next submit reads it back), no POST', async () => {
    const r = await run(marked({}, {}, { externalRef: 'xfr-20g4k-nsdpo-mg6arrifgvid4orn' }));
    expect(r.out).toEqual({
      kind: 'RETRY_LATER',
      code: 'LEG_CHANGED',
      detail: 'read-back shows DFNS transfer xfr-20g4k-nsdpo-mg6arrifgvid4orn recorded meanwhile; the next submit reads it back',
    });
    expect(r.posted).toBe(0);
  });

  it('a different binding on read-back → BINDING_MISMATCH, quarantine; the same digest in another hex case is the same binding', async () => {
    const r = await run(marked({}, { amount: nativeWei(2n) }));
    expect(r.out).toEqual({ kind: 'REFUSED', code: 'BINDING_MISMATCH', detail: 'read-back shows a different binding', quarantine: true, dfnsTransferId: null });
    expect(r.posted).toBe(0);
    const base = marked();
    const upper = { ...base, binding: { ...base.binding, digest: `0x${base.binding.digest.slice(2).toUpperCase()}` as Hex } };
    const ok = await run(upper);
    expect(ok.out.kind).toBe('SUBMITTED');
    expect(ok.posted).toBe(1);
  });

  it('a terminal payment, a terminal leg or a pending P6 under a marker → LEG_INCONSISTENT, quarantine, no POST', async () => {
    const payment = await run(marked({ stage: 'COMPLETED' }));
    expect(payment.out).toEqual({
      kind: 'REFUSED',
      code: 'LEG_INCONSISTENT',
      detail: 'read-back shows payment COMPLETED, leg CREATED, p6Pending false under a submit marker',
      quarantine: true,
      dfnsTransferId: null,
    });
    for (const v of [marked({}, {}, { stage: 'REJECTED' }), marked({}, {}, { p6Pending: true })]) {
      const r = await run(v);
      expect(refusal(r.out)).toEqual(['LEG_INCONSISTENT', true]);
      expect(r.posted).toBe(0);
    }
    expect(payment.posted).toBe(0);
  });

  it('a clean read-back POSTs once', async () => {
    const r = await run(marked());
    expect(r.out).toMatchObject({ kind: 'SUBMITTED', replayed: false });
    expect([r.posted, r.marks, r.reads]).toEqual([1, 1, 2]);
  });
});
