/**
 * JPAYOUT: ONE contract suite for the send-time controls. Both screening fakes (deny-list, risk score) and
 * both local USDC blocklist fakes (mutable set, event mirror) run through the same checks, alone at the
 * port and combined (2 x 2) through `PayoutService` for a STABLECOIN_WALLET payout and the FIAT_BANK
 * partner funding send. All fakes are test support; no real provider or list is used.
 */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cbsMinor, usdcUnits } from '../../src/amounts/index.js';
import { PayoutService } from '../../src/journey/payout/index.js';
import type { D1PaymentsPort, PayoutCase, PayoutRequest } from '../../src/journey/payout/index.js';
import { FakePartner } from '../../src/journey/payout/partner/fake.js';
import { DenyListScreeningFake, RiskScoreScreeningFake } from '../../src/journey/payout/screening-fakes.js';
import { TRAVEL_RULE_NOT_APPLICABLE_TESTNET } from '../../src/journey/recipients/index.js';
import type { AddressScreeningPort, RecipientRef } from '../../src/journey/recipients/index.js';
import type { BlocklistView } from '../../src/network/arc/adapter.js';
import { EventMirrorBlocklist, SetBlocklist } from '../../src/network/arc/blocklist-fakes.js';
import { fiatCode, normaliseAddress, novaOwnerRef, ok } from '../../src/nova-ports/ids.js';
import type { Hex32, IdempotencyKey, NetworkAddress, NetworkId } from '../../src/nova-ports/ids.js';

const addr = (s: string): NetworkAddress => normaliseAddress(s) as NetworkAddress;
const DEST = addr('0x' + '11'.repeat(20));
const SETTLE = addr('0x' + '22'.repeat(20));
const OTHER = addr('0x' + '44'.repeat(20));
const TX = ('0x' + 'ab'.repeat(32)) as Hex32;
const AS_OF = 1_000n;
const MAX_AGE = 60_000n;

interface ScreeningHarness {
  readonly port: AddressScreeningPort;
  block(a: NetworkAddress): void;
  outage(): void;
}
interface BlocklistHarness {
  readonly view: BlocklistView;
  block(a: NetworkAddress): void;
}

const SCREENINGS: readonly (readonly [string, () => ScreeningHarness])[] = [
  [
    'DenyListScreeningFake',
    () => {
      const port = new DenyListScreeningFake();
      return { port, block: (a) => port.deny(a), outage: () => { port.down = true; } };
    },
  ],
  [
    'RiskScoreScreeningFake',
    () => {
      const scores = new Map<string, bigint>();
      let down = false;
      const port = new RiskScoreScreeningFake((a) => (down ? -1n : (scores.get(a) ?? 10n)));
      return { port, block: (a) => { scores.set(a, 95n); }, outage: () => { down = true; } };
    },
  ],
];

const BLOCKLISTS: readonly (readonly [string, () => BlocklistHarness])[] = [
  [
    'SetBlocklist',
    () => {
      const view = new SetBlocklist(AS_OF);
      return { view, block: (a) => view.block(a) };
    },
  ],
  [
    'EventMirrorBlocklist',
    () => {
      const view = new EventMirrorBlocklist(AS_OF);
      return { view, block: (a) => view.sync([{ kind: 'Blocklisted', account: a }], AS_OF) };
    },
  ],
];

class Payments implements D1PaymentsPort {
  readonly creates: { key: IdempotencyKey; to: NetworkAddress }[] = [];
  async create(key: IdempotencyKey, req: { to: NetworkAddress }) {
    this.creates.push({ key, to: req.to });
    return ok({ paymentId: `pay-${this.creates.length}` }, false);
  }
  async get() {
    return ok({ state: 'PENDING' as const, to: DEST, amount: usdcUnits(1n), txHash: TX }, false);
  }
}

function service(s: ScreeningHarness, b: BlocklistHarness, now: bigint = AS_OF) {
  const payments = new Payments();
  const cases: PayoutCase[] = [];
  const gate = { homeCountry: 'ZA', homeCurrency: 'ZAR', legalOpinionRecorded: false, testnetDemo: false };
  const recipients = () => ({ country: 'ZA', currency: fiatCode('ZAR') });
  const svc = new PayoutService({
    payments,
    partner: new FakePartner({ secret: randomBytes(32), recipients, gate, isFunded: () => true, settlementNetwork: { chainId: 5042002n } as never, newId: () => 'x' }),
    screening: s.port,
    blocklist: b.view,
    blocklistMaxAgeMs: MAX_AGE,
    clock: () => now,
    travelRule: TRAVEL_RULE_NOT_APPLICABLE_TESTNET,
    cases: { open: async (c) => { cases.push(c); } },
    recipients,
    gate,
    chainId: 5042002n,
    network: 'ARC' as unknown as NetworkId,
    partnerSettlementAddress: SETTLE,
  });
  return { svc, payments, cases };
}

const wallet = (id: string, to: NetworkAddress = DEST): PayoutRequest => ({ method: 'STABLECOIN_WALLET', payoutId: id, payer: novaOwnerRef('owner-1'), address: to, amount: usdcUnits(5_000_000n) });
const fiat = (id: string): PayoutRequest => ({
  method: 'FIAT_BANK',
  payoutId: id,
  payer: novaOwnerRef('owner-1'),
  recipientRef: ('rcp-' + 'a'.repeat(32)) as RecipientRef,
  currency: fiatCode('ZAR'),
  amount: cbsMinor(9000n),
  fundingAmount: usdcUnits(5_000_000n),
});

describe.each(SCREENINGS)('AddressScreeningPort contract: %s', (_name, make) => {
  it('answers CLEAR for an unknown address, BLOCKED once blocked, and only CLEAR/BLOCKED/UNAVAILABLE or a throw', async () => {
    const s = make();
    expect(await s.port.screen(DEST)).toBe('CLEAR');
    s.block(DEST);
    expect(await s.port.screen(DEST)).toBe('BLOCKED');
    expect(await s.port.screen(OTHER)).toBe('CLEAR');
    s.outage();
    const answer = await s.port.screen(OTHER).catch(() => 'THREW');
    expect(['UNAVAILABLE', 'THREW']).toContain(answer);
  });
});

describe.each(BLOCKLISTS)('BlocklistView contract: %s', (_name, make) => {
  it('a snapshot is a point-in-time copy dated by asOfMs; a later block applies to the next snapshot only', async () => {
    const b = make();
    const before = await b.view.snapshot();
    expect(before.asOfMs).toBe(AS_OF);
    expect(before.isBlocked(DEST)).toBe(false);
    b.block(DEST);
    expect(before.isBlocked(DEST)).toBe(false);
    const after = await b.view.snapshot();
    expect(after.isBlocked(DEST)).toBe(true);
    expect(after.isBlocked(OTHER)).toBe(false);
  });
});

for (const [sName, makeS] of SCREENINGS) {
  for (const [bName, makeB] of BLOCKLISTS) {
    describe(`PayoutService send-time controls: ${sName} x ${bName}`, () => {
      for (const [leg, req, target] of [
        ['STABLECOIN_WALLET', wallet, DEST],
        ['FIAT_BANK funding', fiat, SETTLE],
      ] as const) {
        it(`${leg}: a clear destination is sent exactly once to the screened address`, async () => {
          const t = service(makeS(), makeB());
          expect((await t.svc.start(req('a'))).kind).toBe('OK');
          expect(t.payments.creates.map((c) => c.to)).toEqual([target]);
          expect(t.cases).toEqual([]);
        });
        it(`${leg}: on the local blocklist -> BLOCKLISTED, no send, QUARANTINE case`, async () => {
          const b = makeB();
          b.block(target);
          const t = service(makeS(), b);
          expect(await t.svc.start(req('a'))).toMatchObject({ kind: 'REJECTED', code: 'BLOCKLISTED' });
          expect(t.payments.creates).toEqual([]);
          expect(t.cases).toEqual([{ payoutId: 'a', kind: 'QUARANTINE', reason: 'BLOCKLISTED' }]);
        });
        it(`${leg}: screening BLOCKED -> SCREENING_BLOCKED, no send`, async () => {
          const s = makeS();
          s.block(target);
          const t = service(s, makeB());
          expect(await t.svc.start(req('a'))).toMatchObject({ code: 'SCREENING_BLOCKED' });
          expect(t.payments.creates).toEqual([]);
        });
        it(`${leg}: screening outage -> SCREENING_UNAVAILABLE, no send (fail closed)`, async () => {
          const s = makeS();
          s.outage();
          const t = service(s, makeB());
          expect(await t.svc.start(req('a'))).toMatchObject({ code: 'SCREENING_UNAVAILABLE' });
          expect(t.payments.creates).toEqual([]);
        });
        it(`${leg}: a stale or future-dated blocklist copy -> no send (fail closed)`, async () => {
          for (const now of [AS_OF + MAX_AGE + 1n, AS_OF - 1n]) {
            const t = service(makeS(), makeB(), now);
            expect(await t.svc.start(req('a'))).toMatchObject({ code: 'SCREENING_UNAVAILABLE' });
            expect(t.payments.creates).toEqual([]);
          }
        });
      }
      it('the blocklist is re-read before EVERY send: a block between two payouts stops the second', async () => {
        const b = makeB();
        const t = service(makeS(), b);
        expect((await t.svc.start(wallet('a'))).kind).toBe('OK');
        b.block(DEST);
        expect(await t.svc.start(wallet('b'))).toMatchObject({ code: 'BLOCKLISTED' });
        expect(t.payments.creates).toHaveLength(1);
      });
    });
  }
}
