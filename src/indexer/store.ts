/**
 * Unit NET: the indexer's persistence port (types only).
 *
 * Exactly once (§6.4, CLAUDE.md "Exactly once": transactional inbox):
 * - The transfers of one page and the cursor advance of every address the
 *   page covered are committed in ONE atomic step. The inbox key is
 *   `ConfirmedTransfer.dedupeKey` (§10.3): a key already present with the same
 *   `payloadDigest` is a harmless re-delivery (not inserted again); the same
 *   key with a different digest is a conflict. A crash between fetch and
 *   commit re-fetches the same range.
 * - A committed transfer stays in the inbox, unacknowledged, until the
 *   consumer calls `acknowledge` after applying it. So a poll that commits
 *   page 1 and fails on page 2 loses nothing: page 1's transfers are read back
 *   with `unacknowledged` (verifier NOVA-NET-lensR-1 B1).
 * - Cursors are per (chainId, emitter, address), not per (chainId, emitter)
 *   as §6.4 sketches, so an address added to the set later is scanned from
 *   the start block instead of only above the shared cursor (m7). The inbox
 *   and the halt are per stream `(chainId, emitter)`.
 * - A sticky halt is stored with the stream, so a restart does not clear it;
 *   only `clearHalt` with two approvers does (m2).
 * - The liveness state (each source's highest head and when it last rose,
 *   and when any head last rose) is stored with the stream too, so a process
 *   that restarts more often than `stallAfterMs` still reports CHAIN_STALL
 *   and SOURCE_LAGGING (verifier NOVA-NET-lensR-1 re-run, m4).
 *
 * Nova implements this in its PostgreSQL beside `PaymentStorePort` [A-30];
 * two structurally different in-memory fakes are in `src/indexer/fakes.ts`.
 */
import type { ConfirmedTransfer, NetworkFailure } from '../network/types.js';

export type CommitOutcome =
  /** `inserted`: the dedupe keys that were new. Everything else in the page was a re-delivery. */
  | { readonly kind: 'COMMITTED'; readonly inserted: readonly string[] }
  /** A stored cursor is not its move's `expected`: a second writer exists. Nothing was applied. */
  | { readonly kind: 'CURSOR_CONFLICT'; readonly cursorKey: string; readonly expected: bigint | null; readonly actual: bigint | null }
  /** A key is already stored with a different digest. Nothing was applied. */
  | { readonly kind: 'SIGNAL_CONFLICT'; readonly key: string };

/** One cursor advance: `cursorKey` moves from `expected` (null: none yet) to `next`, the last block now indexed. */
export interface CursorMove {
  readonly cursorKey: string;
  readonly expected: bigint | null;
  readonly next: bigint;
}

export interface PageCommit {
  /** The inbox stream the transfers go to. */
  readonly streamKey: string;
  /** Every cursor this page advances; all or none move. */
  readonly cursors: readonly CursorMove[];
  readonly transfers: readonly ConfirmedTransfer[];
}

/** The highest head one source has reported and when its number last rose (ms on the indexer's clock). */
export interface SourceHeadState {
  readonly source: string;
  readonly number: bigint;
  readonly hash: string;
  readonly sinceMs: bigint;
}

/** Liveness of one stream (§6.6): the highest head of any source, when it last rose, and each source's own head. */
export interface LivenessState {
  readonly lastHead: bigint;
  readonly lastAdvanceMs: bigint;
  readonly sources: readonly SourceHeadState[];
}

/** Outcome of `acknowledge`. UNKNOWN_KEY: never committed in this stream; nothing was acknowledged. */
export type AckOutcome = { readonly kind: 'ACKED' } | { readonly kind: 'UNKNOWN_KEY'; readonly key: string };

export interface IndexerStore {
  /** The highest block whose whole range is committed for this cursor, or null. */
  loadCursor(cursorKey: string): Promise<bigint | null>;
  commitPage(commit: PageCommit): Promise<CommitOutcome>;
  /** Committed transfers of the stream not yet acknowledged, in commit order. */
  unacknowledged(streamKey: string): Promise<readonly ConfirmedTransfer[]>;
  /** Acknowledge every key, or none if one is unknown. Acknowledging twice is harmless. */
  acknowledge(streamKey: string, keys: readonly string[]): Promise<AckOutcome>;
  /** The stream's sticky halt, or null. */
  loadHalt(streamKey: string): Promise<NetworkFailure | null>;
  /** Persist a sticky halt (the first one is kept while halted). */
  recordHalt(streamKey: string, failure: NetworkFailure): Promise<void>;
  /** Clear the halt and record who approved it (two distinct approvers, checked by the caller). */
  clearHalt(streamKey: string, approvers: readonly [string, string]): Promise<void>;
  /** The stream's stored liveness state, or null (none yet, or reset by a resume). */
  loadLiveness(streamKey: string): Promise<LivenessState | null>;
  /** Replace the stream's liveness state; null resets it. */
  saveLiveness(streamKey: string, state: LivenessState | null): Promise<void>;
}
