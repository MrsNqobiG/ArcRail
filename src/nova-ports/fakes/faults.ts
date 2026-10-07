/**
 * Test support: AMBIGUOUS injection for the in-memory fakes (§7.8). An armed
 * fault fires once, either before the write (nothing applied) or after it
 * (applied, but the caller is told the outcome is unknown), so the "resolve by
 * key lookup" path is tested both ways. Every fake operation, reads included,
 * consults its plan; a read only has a BEFORE_COMMIT point.
 */
import { ambiguous } from '../ids.js';
import type { AmbiguousCause, PortResult } from '../ids.js';

export type FaultPoint = 'BEFORE_COMMIT' | 'AFTER_COMMIT';

interface Armed {
  readonly op: string;
  readonly point: FaultPoint;
  readonly cause: AmbiguousCause;
}

export class FaultPlan {
  #armed: readonly Armed[] = [];

  /** Arms one AMBIGUOUS outcome for the next call of `op` at `point`. */
  arm(op: string, point: FaultPoint, cause: AmbiguousCause): void {
    this.#armed = [...this.#armed, { op, point, cause }];
  }

  /** Fires (and disarms) the first fault armed for `op` at `point`; null when none. */
  take(op: string, point: FaultPoint): AmbiguousCause | null {
    const hit = this.#armed.find((a) => a.op === op && a.point === point);
    if (hit === undefined) return null;
    this.#armed = this.#armed.filter((a) => a !== hit);
    return hit.cause;
  }
}

/** The BEFORE_COMMIT fault armed for `op`, as an AMBIGUOUS result (nothing applied); null when none. */
export function faultBefore(plan: FaultPlan | undefined, op: string): PortResult<never, never> | null {
  const cause = plan?.take(op, 'BEFORE_COMMIT') ?? null;
  return cause === null ? null : ambiguous(cause);
}

/** After a committed write: `result`, or AMBIGUOUS when an AFTER_COMMIT fault is armed for `op` (the write stays applied). */
export function afterCommit<T, C extends string>(plan: FaultPlan | undefined, op: string, result: PortResult<T, C>): PortResult<T, C> {
  const cause = plan?.take(op, 'AFTER_COMMIT') ?? null;
  return cause === null ? result : ambiguous(cause);
}
