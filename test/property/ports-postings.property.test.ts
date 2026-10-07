/**
 * PORTS unit, property tests (docs/NOVA_ARC_DESIGN.md §9.2 "every row balances:
 * Σ DR = Σ CR, all amounts > 0, integers"; §7.8 two fakes, one contract).
 *
 * For random multi-leg journals in integer minor units (amounts from 1 to
 * 2^40; the U1 overflow bound has its own boundary test): both fakes make the same
 * decision; a balanced journal is accepted and conserves Σ debits = Σ credits
 * over all accounts, to the base unit; any journal off by one base unit is
 * UNBALANCED and changes nothing; a P7 mirror nets every account to its
 * pre-journal totals plus the same amount on both sides.
 */
import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cbsMinor, CBS_MINOR_MAX, cbsPrecision } from '../../src/amounts/index.js';
import { EventLogLedger, MapLedger } from '../../src/nova-ports/fakes/ledger-fakes.js';
import type { LedgerFakeConfig } from '../../src/nova-ports/fakes/ledger-fakes.js';
import { idempotencyKey, ledgerAssetCode, paymentId } from '../../src/nova-ports/ids.js';
import { mirrorLegs } from '../../src/nova-ports/ledger.js';
import type { JournalRequest, LedgerAccount, LedgerLeg, LedgerPort } from '../../src/nova-ports/ledger.js';

const USDC = ledgerAssetCode('USDC');
const p6 = cbsPrecision(6);
const ROLES: readonly LedgerAccount[] = [
  { kind: 'ROLE', role: 'GL-2', sub: 'arc.hot' },
  { kind: 'ROLE', role: 'GL-3', sub: 'arc' },
  { kind: 'ROLE', role: 'GL-4', sub: 'arc.gasDust' },
  { kind: 'ROLE', role: 'GL-5', sub: 'arc.outbound' },
  { kind: 'ROLE', role: 'GL-6', sub: 'payments' },
];
const cfg: LedgerFakeConfig = { assets: [{ asset: USDC, precision: p6 }], accounts: ROLES.map((account) => ({ account, status: 'OPEN' })) };
/** One payment per key: a payment posts P2 at most once (R-1 m2). */
const pidOf = (key: string) => paymentId('pay-' + createHash('sha256').update(key).digest('hex').slice(0, 32));

const amount = fc.bigInt({ min: 1n, max: 1n << 40n });
/** A balanced journal: debit amounts split arbitrarily, credits split differently, same total. */
const balanced = fc
  .tuple(fc.array(fc.tuple(fc.nat({ max: ROLES.length - 1 }), amount), { minLength: 1, maxLength: 4 }), fc.array(fc.nat({ max: ROLES.length - 1 }), { minLength: 1, maxLength: 4 }))
  .map(([debits, creditIdx]) => {
    const total = debits.reduce((s, [, a]) => s + a, 0n);
    const n = BigInt(creditIdx.length);
    const legs: LedgerLeg[] = debits.map(([i, a]) => ({ account: ROLES[i]!, side: 'DEBIT', amount: cbsMinor(a) }));
    creditIdx.forEach((i, j) => {
      let share = total / n;
      if (j === 0) share += total % n;
      if (share > 0n) legs.push({ account: ROLES[i]!, side: 'CREDIT', amount: cbsMinor(share) });
    });
    return legs;
  });

const journal = (legs: readonly LedgerLeg[], key: string, template: JournalRequest['template'] = 'P2_SETTLE_EXTERNAL', compensates: string | null = null, payKey: string = key): JournalRequest => ({
  key: idempotencyKey(key),
  template,
  asset: USDC,
  precision: p6,
  legs,
  refs: { paymentId: pidOf(payKey), network: 'ARC', txHash: null, logIndex: null, dfnsTransferId: null, compensates },
});

async function totals(l: LedgerPort): Promise<{ debits: bigint; credits: bigint; per: string[] }> {
  let debits = 0n;
  let credits = 0n;
  const per: string[] = [];
  for (const a of ROLES) {
    const r = await l.getBalance(a, USDC);
    if (r.kind !== 'OK') throw new Error('balance');
    debits += r.value.debits;
    credits += r.value.credits;
    per.push(`${r.value.debits}/${r.value.credits}`);
  }
  return { debits, credits, per };
}

describe('postings property: both fakes agree and conserve to the base unit', () => {
  it('balanced journals are accepted and conserve; off-by-one is UNBALANCED and changes nothing', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(balanced, { minLength: 1, maxLength: 6 }), fc.nat(), async (journals, pick) => {
        const fakes = [new MapLedger(cfg), new EventLogLedger(cfg)];
        for (const [i, legs] of journals.entries()) {
          const results = await Promise.all(fakes.map((f) => f.postJournal(journal(legs, `pay:prop:${i}`))));
          expect(results.map((r) => r.kind)).toEqual(['OK', 'OK']);
        }
        const [ta, tb] = await Promise.all(fakes.map(totals));
        expect(ta).toEqual(tb);
        expect(ta!.debits).toBe(ta!.credits);
        expect(ta!.debits).toBe(journals.flat().filter((l) => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0n));

        const legs = journals[pick % journals.length]!;
        const off = legs.map((l, j) => (j === 0 ? { ...l, amount: cbsMinor(l.amount + 1n) } : l));
        for (const f of fakes) {
          expect(await f.postJournal(journal(off, 'pay:prop:off'))).toMatchObject({ kind: 'REJECTED', code: 'UNBALANCED' });
          expect(await totals(f)).toEqual(ta);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('a P7 mirror adds the same amount to both sides of every touched account (nothing on-chain)', async () => {
    await fc.assert(
      fc.asyncProperty(balanced, async (legs) => {
        for (const f of [new MapLedger(cfg), new EventLogLedger(cfg)]) {
          const posted = await f.postJournal(journal(legs, 'pay:prop:orig'));
          if (posted.kind !== 'OK') throw new Error('post');
          const comp = await f.postJournal(journal(mirrorLegs(legs), 'pay:prop:p7', 'P7_COMPENSATE', posted.value.journalId, 'pay:prop:orig'));
          expect(comp.kind).toBe('OK');
          for (const a of ROLES) {
            const r = await f.getBalance(a, USDC);
            if (r.kind !== 'OK') throw new Error('balance');
            expect(r.value.debits).toBe(r.value.credits);
          }
        }
      }),
      { numRuns: 60 },
    );
  });

  it('totals at the U1 bound: exactly CBS_MINOR_MAX is accepted, one more is refused', async () => {
    const hot = ROLES[0]!;
    const clr = ROLES[3]!;
    for (const f of [new MapLedger(cfg), new EventLogLedger(cfg)]) {
      const max: LedgerLeg[] = [
        { account: hot, side: 'DEBIT', amount: cbsMinor(CBS_MINOR_MAX - 1n) },
        { account: hot, side: 'DEBIT', amount: cbsMinor(1n) },
        { account: clr, side: 'CREDIT', amount: cbsMinor(CBS_MINOR_MAX) },
      ];
      expect((await f.postJournal(journal(max, 'pay:prop:max'))).kind).toBe('OK');
      const over: LedgerLeg[] = [max[0]!, { account: hot, side: 'DEBIT', amount: cbsMinor(2n) }, max[2]!];
      expect(await f.postJournal(journal(over, 'pay:prop:over'))).toMatchObject({ kind: 'REJECTED', code: 'INVALID_JOURNAL' });
    }
  });
});
