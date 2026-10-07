/**
 * JTIME: licensing facts. A timeline step is shown as done only when a fact of
 * the required kind and source licenses it. A fact is a ledger, chain or
 * partner observation that was already authenticated and deduplicated upstream;
 * this file re-checks the shape and the source (fail closed).
 * Money: bigint units only, no floats.
 */
import type { Hex32, NetworkAddress } from '../../nova-ports/ids.js';

export type FactSource = 'LEDGER' | 'CHAIN' | 'PARTNER';

/** Closed list of facts. */
export type FactKind =
  | 'RESERVED' // LEDGER: pay-in funds reserved in Nova's ledger
  | 'PAYIN_CONFIRMED' // CHAIN (stablecoin deposit) or PARTNER (fiat pay-in): money received
  | 'CONVERTED' // PARTNER: fiat pay-in converted to USDC (fill)
  | 'ARC_SUBMITTED' // LEDGER: our outbox recorded the signed submit (not a confirmation)
  | 'ARC_CONFIRMED' // CHAIN: our own confirmed system-emitter Transfer log
  | 'PAYOUT_STARTED' // PARTNER: off-ramp partner accepted the payout
  | 'PAYOUT_COMPLETE'; // PARTNER: partner's payout-complete confirmation

export const FACT_KINDS: readonly FactKind[] = Object.freeze([
  'RESERVED', 'PAYIN_CONFIRMED', 'CONVERTED', 'ARC_SUBMITTED', 'ARC_CONFIRMED', 'PAYOUT_STARTED', 'PAYOUT_COMPLETE',
]);

/** EIP-7708 system emitter (CLAUDE.md "Canonical log"). */
export const SYSTEM_EMITTER = '0xfffffffffffffffffffffffffffffffffffffffe';

export interface Fact {
  readonly kind: FactKind;
  readonly source: FactSource;
  /** Deterministic dedupe key from the business event, `[a-z0-9:-]{1,128}`. */
  readonly factId: string;
  readonly occurredAt: string;
  /** CHAIN facts: chain evidence. */
  readonly chain?: {
    readonly chainId: bigint;
    readonly txHash: Hex32;
    readonly logIndex: bigint;
    readonly emitter: string;
    readonly to: NetworkAddress;
    readonly confirmed: boolean;
    readonly units: bigint;
  };
}

/** Which source may license which kind. */
export const SOURCE_FOR_KIND: Readonly<Record<FactKind, readonly FactSource[]>> = Object.freeze({
  RESERVED: ['LEDGER'],
  PAYIN_CONFIRMED: ['CHAIN', 'PARTNER'],
  CONVERTED: ['PARTNER'],
  ARC_SUBMITTED: ['LEDGER'],
  ARC_CONFIRMED: ['CHAIN'],
  PAYOUT_STARTED: ['PARTNER'],
  PAYOUT_COMPLETE: ['PARTNER'],
});

const ID_RE = /^[a-z0-9:-]{1,128}$/;
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** Structural validity: a malformed fact licenses nothing. */
export function isWellFormedFact(f: Fact): boolean {
  if (!FACT_KINDS.includes(f.kind)) return false;
  if (!SOURCE_FOR_KIND[f.kind].includes(f.source)) return false;
  if (!ID_RE.test(f.factId) || !TS_RE.test(f.occurredAt)) return false;
  if (f.kind === 'ARC_CONFIRMED') {
    const c = f.chain;
    if (c === undefined) return false;
    if (!c.confirmed || c.emitter.toLowerCase() !== SYSTEM_EMITTER) return false;
    if (typeof c.units !== 'bigint' || c.units <= 0n) return false;
    if (typeof c.logIndex !== 'bigint' || c.logIndex < 0n || typeof c.chainId !== 'bigint') return false;
  }
  if (f.kind === 'PAYIN_CONFIRMED' && f.source === 'CHAIN' && (f.chain === undefined || !f.chain.confirmed)) return false;
  return true;
}
