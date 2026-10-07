/**
 * JPAYOUT test support only (never wired outside tests or the labelled testnet demo): two structurally
 * different FAKES of the `AddressScreeningPort` (recipients). They are not a screening provider and carry
 * no real list or score; both run through one contract suite (test/contract/jpayout-screening.contract.test.ts).
 *
 * - `DenyListScreeningFake`: a static deny-set; `down` makes every call throw (provider outage).
 * - `RiskScoreScreeningFake`: an injected score per address (bigint); score >= threshold is BLOCKED, a
 *   negative score means "no answer" (UNAVAILABLE). It counts calls.
 *
 * Money path rule MC-01: no `number`.
 */
import type { NetworkAddress } from '../../nova-ports/ids.js';
import type { AddressScreeningPort, ScreeningAnswer } from '../recipients/index.js';

export class DenyListScreeningFake implements AddressScreeningPort {
  readonly #deny: Set<string>;
  down = false;

  constructor(deny: readonly NetworkAddress[] = []) {
    this.#deny = new Set(deny);
  }

  deny(a: NetworkAddress): void {
    this.#deny.add(a);
  }

  async screen(a: NetworkAddress): Promise<ScreeningAnswer> {
    if (this.down) throw new Error('screening unavailable');
    return this.#deny.has(a) ? 'BLOCKED' : 'CLEAR';
  }
}

export class RiskScoreScreeningFake implements AddressScreeningPort {
  calls = 0n;

  constructor(
    readonly score: (a: NetworkAddress) => bigint,
    readonly threshold: bigint = 80n,
  ) {}

  async screen(a: NetworkAddress): Promise<ScreeningAnswer> {
    this.calls += 1n;
    const s = this.score(a);
    if (s < 0n) return 'UNAVAILABLE';
    return s >= this.threshold ? 'BLOCKED' : 'CLEAR';
  }
}
