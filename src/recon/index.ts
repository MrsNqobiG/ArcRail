/**
 * U12 Three-way reconciliation and circuit breaker. Money path (RUBRIC item 9).
 * SKELETON: types and stubs only.
 *
 * Chain ↔ adapter ↔ CBS at a fixed cadence and on demand (CONTRACT §5.7).
 * Zero-tolerance drift → automatic PAUSE; unpause needs two humans (CONTRACT §1.6).
 */
export interface ReconResult {
  readonly blockNumber: bigint;
  readonly cbsCutoff: string;
  /** Signed residual in wei: chain side minus ledger side. Must be exactly 0. */
  readonly residualWei: bigint;
}

export type RailState =
  | { readonly kind: 'RUNNING' }
  | { readonly kind: 'PAUSED'; readonly pauseSeq: bigint; readonly reason: string };

export interface CircuitBreaker {
  state(): RailState;
  pause(reason: string): Promise<RailState>;
  /** Two distinct human approvers are required (CONTRACT §1.6). */
  unpause(approverA: string, approverB: string): Promise<RailState>;
}

export interface Reconciler {
  run(): Promise<ReconResult>;
}

export function createReconciler(): Reconciler {
  throw new Error('not implemented: U12');
}

export function createCircuitBreaker(): CircuitBreaker {
  throw new Error('not implemented: U12');
}
