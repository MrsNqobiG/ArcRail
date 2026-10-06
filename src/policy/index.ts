/**
 * U7 Policy engine. Money path (RUBRIC item 5). SKELETON: types and stubs only.
 *
 * Deterministic ALLOW/DENY: allow-lists, per-tx/daily/velocity limits, asset
 * and destination rules, cross-border flag (OFF by default), approval
 * thresholds (KICKOFF U7). No LLM or agent decides (CLAUDE.md rule 4).
 */
import type { CbsMinor } from '../amounts/index.js';
import type { Address } from '../chain/config/index.js';
import type { AccountRef } from '../registry/index.js';

export type PolicyDenyReason =
  | 'PER_TX_LIMIT'
  | 'DAILY_LIMIT'
  | 'VELOCITY'
  | 'DESTINATION_NOT_ALLOWED'
  | 'ASSET_NOT_ALLOWED'
  | 'CROSS_BORDER_DISABLED';

export type PolicyDecision =
  | { readonly kind: 'ALLOW'; readonly needsChecker: boolean }
  | { readonly kind: 'DENY'; readonly reason: PolicyDenyReason };

export interface PolicyRequest {
  readonly instructionId: string;
  readonly accountRef: AccountRef;
  readonly amount: CbsMinor;
  readonly destination: Address;
  readonly crossBorder: boolean;
}

export interface PolicyEngine {
  evaluate(request: PolicyRequest): PolicyDecision;
}

export function createPolicyEngine(): PolicyEngine {
  throw new Error('not implemented: U7');
}
