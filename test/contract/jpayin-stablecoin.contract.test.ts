/**
 * JPAYIN contract: STABLECOIN pay-in, one scenario suite over two structurally
 * different chain sources (the Arc indexer over in-memory chains, and FAKENET)
 * and both OPS rigs. Per-transfer detection, never balance deltas.
 */
import { describe, expect, it } from 'vitest';
import { nativeWei, usdcUnits } from '../../src/amounts/index.js';
import { settlementDigest, StablecoinPayIn } from '../../src/journey/payin/index.js';
import type { ChainSource, StablecoinExpectation } from '../../src/journey/payin/index.js';
import { InMemoryArcChain, ManualTiming, MapIndexerStore, erc20TransferTx, fakeAddress, nativeTransferTx } from '../../src/indexer/fakes.js';
import { ArcIndexer } from '../../src/indexer/indexer.js';
import { FakeNetAdapter } from '../../src/network/fake/adapter.js';
import { loadArcNetworkParams } from '../../src/network/arc/config.js';
import type { NetworkAddress } from '../../src/network/types.js';
import { CLIENT, PAY, SETTLE, SUSPENSE, USDC, ZAR, makeRig } from '../unit/ops-support.js';
import type { Variant } from '../unit/ops-support.js';

const params = loadArcNetworkParams({
  chainId: 5042002n,
  dfnsNetwork: 'ArcTestnet',
  singleSourceTestnetOnly: false,
  stallAfterMs: 30_000n,
  startBlock: 1n,
  blocklistMaxAgeMs: 60_000n,
  headRegressionToleranceBlocks: 5n,
});
const cfg = { fiatAsset: ZAR, usdcAsset: USDC, refundDebit: SUSPENSE, refundCredit: SETTLE };
const DEP = fakeAddress('deposit-1');
const PAYER = fakeAddress('payer');
const OTHER = fakeAddress('other-deposit');
const EXPIRY = 1_000_000n;
const WEI = 1_000_000_000_000n;

interface Chain {
  source: ChainSource;
  /** One ERC-20/native transfer of `units` USDC (6 dp) in its own block. */
  send(label: string, from: NetworkAddress, to: NetworkAddress, units: bigint): void;
  /** Same transfer delivered again (duplicate log). */
  redeliver(label: string): void;
  /** A raw wei amount (sub-unit remainder). */
  sendWei(label: string, from: NetworkAddress, to: NetworkAddress, wei: bigint): void;
}

function arcChain(): Chain {
  const a = new InMemoryArcChain('own');
  const b = new InMemoryArcChain('ref');
  const ix = new ArcIndexer({ params, sources: [a, b], store: new MapIndexerStore(), timing: new ManualTiming() });
  const mine = (tx: ReturnType<typeof erc20TransferTx>): void => {
    a.mine([tx]);
    b.mine([tx]);
  };
  return {
    source: ix,
    send: (l, f, t, u) => mine(erc20TransferTx(params, l, f, t, u)),
    sendWei: (l, f, t, w) => mine(nativeTransferTx(params, l, f, t, w)),
    redeliver: () => undefined, // the indexer dedupes at the source; a repeated poll is the duplicate path
  };
}

function fakeNet(): Chain {
  const n = new FakeNetAdapter();
  const hashes = new Map<string, `0x${string}`>();
  return {
    source: n,
    send: (l, f, t, u) => void hashes.set(l, n.settle(f, t, nativeWei(u * WEI))),
    sendWei: (l, f, t, w) => void hashes.set(l, n.settle(f, t, nativeWei(w))),
    redeliver: (l) => n.redeliver(hashes.get(l) as `0x${string}`),
  };
}

const exp = (over: Partial<StablecoinExpectation> = {}): StablecoinExpectation => ({
  method: 'STABLECOIN',
  paymentId: PAY,
  clientUid: CLIENT,
  expectedPayInId: 'pi-s1',
  expected: usdcUnits(10_000_000n),
  quoteExpiresAtMs: EXPIRY,
  settlementConsentRef: 'consent-s1',
  settlementInstructionsRef: 'instr-1',
  depositAddress: DEP,
  ...over,
});

for (const [cname, mk] of [['arc-indexer', arcChain], ['fakenet', fakeNet]] as const) {
  for (const v of ['A', 'B'] as const satisfies readonly Variant[]) {
    describe(`STABLECOIN pay-in (${cname}, rig ${v})`, () => {
      const setup = () => {
        const chain = mk();
        const r = makeRig(v);
        const pay = new StablecoinPayIn({ chain: chain.source, consent: r.deps.consent, ops: r.queue, config: cfg });
        const grant = (e = exp()): void => r.consentStore.grant('consent-s1', { clientUid: CLIENT, paymentId: PAY, caseId: null, digest: settlementDigest(e) });
        return { chain, r, pay, grant };
      };

      it('pending until a transfer arrives, then confirms on the exact amount, consuming consent once', async () => {
        const { chain, pay, grant } = setup();
        grant();
        expect(await pay.settle(exp(), 10n)).toEqual({ kind: 'PENDING' });
        chain.send('t1', PAYER, DEP, 10_000_000n);
        const r = await pay.settle(exp(), 20n);
        expect(r).toMatchObject({ kind: 'CONFIRMED', method: 'STABLECOIN', amount: 10_000_000n, consentRef: 'consent-s1' });
        expect(await pay.settle(exp(), 30n)).toEqual(r);
      });

      it('credits per transfer: outbound from the deposit address in the same window is never a credit and its gas is not netted', async () => {
        const { chain, pay, grant } = setup();
        grant();
        chain.send('in1', PAYER, DEP, 10_000_000n);
        chain.send('out1', DEP, OTHER, 3_000_000n); // a sweep paid by the deposit address
        const r = await pay.settle(exp(), 20n);
        expect(r).toMatchObject({ kind: 'CONFIRMED', amount: 10_000_000n });
      });

      it('a repeated poll (duplicate delivery) does not credit twice', async () => {
        const { chain, pay } = setup();
        chain.send('in1', PAYER, DEP, 6_000_000n);
        await pay.settle(exp(), 10n);
        const again = await pay.settle(exp(), 11n);
        expect(again).toMatchObject({ kind: 'HELD', reason: 'CONFIRMED_BELOW_EXPECTED' }); // 6, not 12
      });

      it('a re-delivered log of the same transfer is not credited twice', async () => {
        const { chain, pay, grant } = setup();
        grant();
        chain.send('in1', PAYER, DEP, 10_000_000n);
        chain.redeliver('in1');
        expect(await pay.settle(exp(), 20n)).toMatchObject({ kind: 'CONFIRMED', amount: 10_000_000n });
      });

      it('wrong amount holds with a reason and opens a case, consent untouched', async () => {
        for (const [units, reason, kind] of [[9_000_000n, 'CONFIRMED_BELOW_EXPECTED', 'UNDERPAYMENT'], [11_000_000n, 'CONFIRMED_ABOVE_EXPECTED', 'OVERPAYMENT']] as const) {
          const { chain, pay, grant, r } = setup();
          grant();
          chain.send('in1', PAYER, DEP, units);
          expect(await pay.settle(exp(), 20n)).toMatchObject({ kind: 'HELD', reason, caseKind: kind, caseCode: 'OK' });
          expect(await r.deps.consent.consume('consent-s1', { clientUid: CLIENT, paymentId: PAY, caseId: null, digest: settlementDigest(exp()) })).toMatchObject({ kind: 'OK' });
        }
      });

      it('a sub-unit remainder holds (never rounded away)', async () => {
        const { chain, pay, grant } = setup();
        grant();
        chain.sendWei('w1', PAYER, DEP, 10_000_000n * WEI + 1n);
        expect(await pay.settle(exp(), 20n)).toMatchObject({ kind: 'HELD', reason: 'SUB_UNIT_REMAINDER' });
      });

      it('first seen after quote expiry is LATE_PAYIN with a refund option; nothing at expiry is EXPIRED', async () => {
        const { chain, pay, grant } = setup();
        grant();
        expect(await pay.settle(exp(), EXPIRY + 1n)).toEqual({ kind: 'EXPIRED' });
        chain.send('late', PAYER, DEP, 10_000_000n);
        expect(await pay.settle(exp(), EXPIRY + 2n)).toMatchObject({ kind: 'HELD', reason: 'PAYIN_AFTER_QUOTE_EXPIRY', caseKind: 'LATE_PAYIN' });
      });

      it('missing consent holds', async () => {
        const { chain, pay } = setup();
        chain.send('in1', PAYER, DEP, 10_000_000n);
        expect(await pay.settle(exp({ settlementConsentRef: null }), 20n)).toMatchObject({ kind: 'HELD', reason: 'CONSENT_MISSING' });
      });

      it("another payment's deposit address is not credited", async () => {
        const { chain, pay } = setup();
        chain.send('x', PAYER, OTHER, 10_000_000n);
        expect(await pay.settle(exp(), 20n)).toEqual({ kind: 'PENDING' });
      });

      it('rejects a bad deposit address and the wrong method', async () => {
        const { pay } = setup();
        expect(await pay.settle(exp({ depositAddress: '0xABC' as NetworkAddress }), 1n)).toMatchObject({ kind: 'FAILED_CLOSED', code: 'EXPECTATION_INVALID' });
        expect(await pay.settle({ ...exp(), method: 'FIAT' } as never, 1n)).toMatchObject({ kind: 'FAILED_CLOSED', code: 'METHOD_UNSUPPORTED' });
      });
    });
  }
}

describe('STABLECOIN pay-in failure handling', () => {
  const r = makeRig('A');
  it('an indexer failure fails closed (never "no transfers")', async () => {
    const chain: ChainSource = {
      poll: async () => ({ kind: 'FAILED', failure: { kind: 'RPC_DISAGREEMENT', detail: 'x' } }),
      ack: async () => ({ kind: 'ACKED' }),
    };
    const pay = new StablecoinPayIn({ chain, consent: r.deps.consent, ops: r.queue, config: cfg });
    expect(await pay.settle(exp(), 1n)).toEqual({ kind: 'FAILED_CLOSED', code: 'INDEXER_FAILED', detail: 'RPC_DISAGREEMENT' });
  });
  it('the same dedupeKey with a different digest is SIGNAL_CONFLICT', async () => {
    let n = 0n;
    const t = (digest: string) => ({ network: 'ARC', chainId: 5042002n, txHash: `0x${'1'.repeat(64)}`, logIndex: 0n, blockNumber: 1n, blockHash: `0x${'2'.repeat(64)}`, from: PAYER, to: DEP, amount: nativeWei(10_000_000n * WEI), receiptStatus: 1n, gas: { payer: PAYER, gasUsed: 1n, effectiveGasPrice: 1n }, sources: 2n, dedupeKey: 'k1', payloadDigest: digest }) as never;
    const chain: ChainSource = { poll: async () => ({ kind: 'OK', value: [t(`d${n++}`)] }), ack: async () => ({ kind: 'ACKED' }) };
    const pay = new StablecoinPayIn({ chain, consent: r.deps.consent, ops: r.queue, config: cfg });
    await pay.settle(exp(), 1n);
    expect(await pay.settle(exp(), 2n)).toMatchObject({ kind: 'HELD', reason: 'SIGNAL_CONFLICT', caseKind: 'QUARANTINE' });
  });
});
