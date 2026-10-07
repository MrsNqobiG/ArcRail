/**
 * Test support: two structurally different in-memory ReceiverPort fakes (§7.8).
 * They hold the RECEIVER's chosen payout method (fiat bank or stablecoin wallet).
 *
 * - MapReceivers: one current preference per beneficiary, overwritten in place;
 *   the version is a counter bumped on each change.
 * - VersionedReceivers: an append-only preference history; resolve returns the
 *   latest entry and its history position as the version.
 *
 * Both apply the shared checkResolvedPayout, can inject AMBIGUOUS before a
 * read (FaultPlan, op 'resolvePayout'), and pass the same contract tests
 * (test/contract/ports-receiver.contract.test.ts).
 */
import type { PayoutMethod } from '../../status/journey.js';
import { ok, rejected } from '../ids.js';
import type { BeneficiaryRef, NovaOwnerRef, PortResult } from '../ids.js';
import { checkResolvedPayout } from '../receiver.js';
import type { PayoutDestination, ReceiverPort, ReceiverResolveCode, ResolvedPayout } from '../receiver.js';
import { faultBefore } from './faults.js';
import type { FaultPlan } from './faults.js';

/** What the receiver has on file: their chosen method (or none yet) and where it lands. */
export interface ReceiverPreference {
  readonly active: boolean;
  readonly receiver: NovaOwnerRef | null;
  readonly choice: { readonly payout: PayoutMethod; readonly destination: PayoutDestination } | null;
}

function resolve(ref: BeneficiaryRef, pref: ReceiverPreference | null, version: string): PortResult<ResolvedPayout, ReceiverResolveCode> {
  if (pref === null) return rejected('BENEFICIARY_UNKNOWN', ref);
  if (!pref.active) return rejected('BENEFICIARY_INACTIVE', ref);
  if (pref.choice === null) return rejected('NO_PAYOUT_PREFERENCE', ref);
  const resolved: ResolvedPayout = { payout: pref.choice.payout, destination: pref.choice.destination, receiver: pref.receiver, preferenceVersion: version };
  const why = checkResolvedPayout(ref, resolved);
  return why === null ? ok(resolved, false) : rejected('PREFERENCE_INVALID', why);
}

/** Fake A: current preference per ref. */
export class MapReceivers implements ReceiverPort {
  readonly #prefs = new Map<string, { readonly pref: ReceiverPreference; readonly version: bigint }>();
  readonly #faults: FaultPlan | undefined;

  constructor(faults?: FaultPlan) {
    this.#faults = faults;
  }

  /** The receiver sets or changes their choice. */
  set(ref: BeneficiaryRef, pref: ReceiverPreference): void {
    const prior = this.#prefs.get(ref);
    this.#prefs.set(ref, { pref, version: prior === undefined ? 1n : prior.version + 1n });
  }

  async resolvePayout(ref: BeneficiaryRef): Promise<PortResult<ResolvedPayout, ReceiverResolveCode>> {
    const before = faultBefore(this.#faults, 'resolvePayout');
    if (before !== null) return before;
    const e = this.#prefs.get(ref);
    return resolve(ref, e?.pref ?? null, `v${e?.version ?? 0n}`);
  }
}

/** Fake B: append-only preference history. */
export class VersionedReceivers implements ReceiverPort {
  #history: readonly { readonly ref: BeneficiaryRef; readonly pref: ReceiverPreference }[] = [];
  readonly #faults: FaultPlan | undefined;

  constructor(faults?: FaultPlan) {
    this.#faults = faults;
  }

  /** The receiver sets or changes their choice (a new history entry). */
  set(ref: BeneficiaryRef, pref: ReceiverPreference): void {
    this.#history = [...this.#history, { ref, pref }];
  }

  async resolvePayout(ref: BeneficiaryRef): Promise<PortResult<ResolvedPayout, ReceiverResolveCode>> {
    const before = faultBefore(this.#faults, 'resolvePayout');
    if (before !== null) return before;
    let latest: ReceiverPreference | null = null;
    let position = 0n;
    let n = 0n;
    for (const h of this.#history) {
      n += 1n;
      if (h.ref === ref) {
        latest = h.pref;
        position = n;
      }
    }
    return resolve(ref, latest, `h${position}`);
  }
}
