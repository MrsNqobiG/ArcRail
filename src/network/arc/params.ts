/**
 * Unit NET: the shape of the Arc network parameters (types only).
 *
 * The values are built in exactly one place, `src/network/arc/config.ts`,
 * from U2 `ARC_TESTNET` (`src/chain/config`, every value cited there by C-id)
 * plus the DFNS network names (DF:networks). Money-path modules import this
 * shape with `import type` only and receive the value by injection, so U2's
 * number-typed constants (chain IDs, RPC codes) are converted to `bigint`
 * once, outside the money path.
 */
import type { NativeWei } from '../../amounts/index.js';
import type { Hex32 } from '../../chain/config/index.js';
import type { NetworkAddress } from '../types.js';

/** Capped exponential backoff with jitter for -32014 and transport errors (C-42). Values are ours (Q-N6). */
export interface RetryPolicy {
  readonly initialMs: bigint;
  readonly capMs: bigint;
  /** Total attempts, including the first. At least 1. */
  readonly maxAttempts: bigint;
}

export interface ArcNetworkParams {
  readonly network: 'ARC';
  readonly asset: 'USDC';
  /** Always true here: a disabled network never gets a params value (mainnet is refused at load). */
  readonly enabled: true;
  /** C-01 */
  readonly chainId: 5042002n;
  /** DF:networks ("| Arc | ArcTestnet | 1 | N/A | 10 | | |") */
  readonly dfnsNetwork: 'ArcTestnet';
  /** C-20, lower-cased: the canonical credit source. */
  readonly systemEmitter: NetworkAddress;
  /** C-12, lower-cased: the ERC-20 view, cross-check only. */
  readonly usdcErc20: NetworkAddress;
  /** C-21, lower-cased. */
  readonly transferTopic0: Hex32;
  /** C-40: inclusive page size, so `to − from ≤ maxBlocksPerPage − 1`. */
  readonly maxBlocksPerPage: bigint;
  /** C-40: range too large; split. */
  readonly rangeTooLargeCode: bigint;
  /** C-41 (observed, undocumented, Q-A4): result cap; bisect. */
  readonly resultCapCode: bigint;
  /** C-42: head lag; retry with backoff. */
  readonly headLagCode: bigint;
  readonly retry: RetryPolicy;
  /** No new head from any source for this long → CHAIN_STALL (Q-A7, a human decision; no default). */
  readonly stallAfterMs: bigint;
  /**
   * How far one source's head may fall below the highest head it has reported
   * before it is stopped. The public endpoint is load-balanced, so a backend
   * behind the one that answered last is normal (C-42; docs/sources/arc/arc_references_rpc-endpoints.md lines 40, 119). A
   * smaller fall only lowers the agreed head (nothing new is confirmed) and is
   * left to the lag check. Ours, not Arc's (proposed value; Q-N6 family).
   */
  readonly headRegressionToleranceBlocks: bigint;
  /** Extra blocks below the agreed head before a log counts (C-50: 0 by default; Q-N5). */
  readonly confirmations: bigint;
  /** First block indexed when no cursor exists (after Zero5, Q-A6; no default). */
  readonly startBlock: bigint;
  /** §6.3: one source may confirm only with this flag, on testnet only. */
  readonly singleSourceTestnetOnly: boolean;
  /** Maximum age of the local blocklist copy (`A_blocklist`, Q-N6; no default). */
  readonly blocklistMaxAgeMs: bigint;
  /** Destinations refused by precheck (our own rule): the system emitter and the USDC ERC-20 contract. */
  readonly reservedDestinations: readonly NetworkAddress[];
  /** C-30 fee floor, carried for consumers (the gateway's fee pre-check). */
  readonly feeFloorWei: NativeWei;
  /** C-31 maximum base fee, carried for consumers. */
  readonly maxBaseFeeWei: NativeWei;
}
