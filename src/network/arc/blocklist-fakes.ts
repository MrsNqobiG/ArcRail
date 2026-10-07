/**
 * Unit NET: two structurally different fakes of the Arc adapter's
 * `BlocklistView` port (test support only, not production code). They live
 * beside the Arc adapter because the USDC blocklist is an Arc rule (C-28);
 * the fake network (`src/network/fake`) knows nothing of Arc (m5).
 *
 * - `SetBlocklist`: a mutable set plus an "as of" time.
 * - `EventMirrorBlocklist`: an append-only list of `Blocklisted` /
 *   `UnBlocklisted` events (C-28, names unverified: Q-A5); each snapshot is a
 *   fold, and "as of" is the time of the last sync.
 */
import type { BlocklistSnapshot, BlocklistView } from './adapter.js';
import type { NetworkAddress } from '../types.js';

export class SetBlocklist implements BlocklistView {
  private readonly blocked = new Set<string>();
  private asOfMs: bigint;

  constructor(asOfMs: bigint, blocked: readonly NetworkAddress[] = []) {
    this.asOfMs = asOfMs;
    for (const a of blocked) this.blocked.add(a);
  }

  block(address: NetworkAddress): void {
    this.blocked.add(address);
  }

  refreshed(asOfMs: bigint): void {
    this.asOfMs = asOfMs;
  }

  async snapshot(): Promise<BlocklistSnapshot> {
    const copy = new Set(this.blocked);
    return { asOfMs: this.asOfMs, isBlocked: (a) => copy.has(a) };
  }
}

type BlocklistEvent = { readonly kind: 'Blocklisted' | 'UnBlocklisted'; readonly account: NetworkAddress };

export class EventMirrorBlocklist implements BlocklistView {
  private events: readonly BlocklistEvent[] = [];
  private syncedAtMs: bigint;

  constructor(syncedAtMs: bigint) {
    this.syncedAtMs = syncedAtMs;
  }

  /** Mirror a batch of events read up to `syncedAtMs`. */
  sync(events: readonly BlocklistEvent[], syncedAtMs: bigint): void {
    this.events = [...this.events, ...events];
    this.syncedAtMs = syncedAtMs;
  }

  async snapshot(): Promise<BlocklistSnapshot> {
    const events = this.events;
    const isBlocked = (a: NetworkAddress): boolean => {
      let blocked = false;
      for (const e of events) if (e.account === a) blocked = e.kind === 'Blocklisted';
      return blocked;
    };
    return { asOfMs: this.syncedAtMs, isBlocked };
  }
}
