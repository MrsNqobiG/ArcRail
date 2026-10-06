/**
 * U8 Compliance hooks. SKELETON: interfaces and stubs only.
 *
 * Routes to the CBS's existing screening, monitoring, case and reporting
 * functions (CONTRACT §3 `screen`, `submitMonitoringEvent`, `createCase`,
 * `fileReportData`), plus on-chain address screening (ADR-005 option B on
 * testnet: a self-hosted list including C-55 and a canary; vendor stubbed to
 * REVIEW) and the Directive 9 travel-rule payload check (ADR-004 stub on
 * testnet; field list Q-R3). The adapter never holds travel-rule fields.
 */
import type { Address } from '../chain/config/index.js';

export type AddressScreenVerdict = 'CLEAR' | 'HIT' | 'REVIEW';

export interface AddressScreener {
  screenAddress(address: Address): Promise<AddressScreenVerdict>;
}

/** Travel-rule reference as returned by `getTravelRuleOriginator` (CONTRACT §3). */
export interface TravelRuleRef {
  readonly payloadRef: string;
  readonly payloadHashTR: string;
}

export interface TravelRuleChecker {
  /** Re-check `payloadHashTR` before signing (THREAT_MODEL T-B2). */
  verifyUnchanged(stored: TravelRuleRef, current: TravelRuleRef): boolean;
}

export function createAddressScreener(): AddressScreener {
  throw new Error('not implemented: U8');
}

export function createTravelRuleChecker(): TravelRuleChecker {
  throw new Error('not implemented: U8');
}
