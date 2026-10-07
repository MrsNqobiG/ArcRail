/**
 * Unit NET: Arc network configuration loader (NOVA_ARC_DESIGN §5.2, §6.3, §11).
 *
 * The only place Arc network parameters are built. Every Arc value comes from
 * U2 (`src/chain/config`, cited there by C-id); this file adds only the DFNS
 * network names (DF:networks) and the operator choices that have no default
 * because they are human decisions (stall threshold Q-A7, start block Q-A6,
 * blocklist age Q-N6).
 *
 * TESTNET ONLY. Mainnet is present only as `DFNS_ARC_NETWORKS.mainnet` with
 * `enabled: false` and as U2's `ARC_MAINNET_DISABLED`. A request for it runs
 * U2's gate check and is refused anyway (`resolveChain`). The single-source
 * flag (§6.3) combined with the mainnet chain ID or the DFNS network `Arc`
 * throws here, before any indexer or gateway can be constructed.
 *
 * Not on the money path list: it converts U2's number-typed constants to
 * `bigint` once and does no arithmetic on amounts. U2's own controls (MC-20
 * mainnet gate tests, MC-21 cited constants) cover the values it reads.
 */
import { ARC_MAINNET_DISABLED, ARC_TESTNET, resolveChain } from '../../chain/config/index.js';
import type { Hex32 } from '../../chain/config/index.js';
import type { NetworkAddress } from '../types.js';
import type { ArcNetworkParams, RetryPolicy } from './params.js';

/** DFNS network names for Arc (DF:networks, docs/sources/dfns/networks_index.md: "| Arc | ArcTestnet | 1 | N/A | 10 | | |"). */
export const DFNS_ARC_NETWORKS = Object.freeze({
  testnet: Object.freeze({ name: 'ArcTestnet', enabled: true }),
  mainnet: Object.freeze({ name: 'Arc', enabled: false }),
} as const);

/** DFNS indexes Arc after this many blocks (DF:networks "Confirmation Delay" column): why our indexer is canonical. */
export const DFNS_ARC_CONFIRMATION_DELAY_BLOCKS = 10n;

/** Proposed in NOVA_ARC_DESIGN §6.2: initial 250 ms, cap 8 s, 8 attempts. Ours, not Arc's (Q-N6). */
export const PROPOSED_RETRY: RetryPolicy = Object.freeze({ initialMs: 250n, capMs: 8_000n, maxAttempts: 8n });

/**
 * Proposed head-regression tolerance (blocks): a load-balanced backend a few
 * blocks behind (C-42) is not a failure. Ours, not Arc's (Q-N6 family). Only
 * a proposal: the loader has no default (lensR-1 m5), because the value sets
 * how far a source may go backwards before it is stopped, an operator decision
 * like `stallAfterMs`. The operator passes it explicitly.
 */
export const PROPOSED_HEAD_REGRESSION_TOLERANCE_BLOCKS = 5n;

export interface ArcConfigInput {
  /** Must be C-01. The mainnet chain ID (C-02) is refused through U2's gate. */
  readonly chainId: bigint;
  /** Must be `ArcTestnet`. `Arc` (mainnet) is refused. */
  readonly dfnsNetwork: string;
  readonly singleSourceTestnetOnly: boolean;
  readonly stallAfterMs: bigint;
  readonly startBlock: bigint;
  readonly blocklistMaxAgeMs: bigint;
  readonly confirmations?: bigint;
  readonly retry?: RetryPolicy;
  /** Required, no default (lensR-1 m5); `PROPOSED_HEAD_REGRESSION_TOLERANCE_BLOCKS` is the proposal. */
  readonly headRegressionToleranceBlocks: bigint;
  /** Test fixtures only; production uses U2's default gates file. */
  readonly gatesFile?: string | URL;
}

export class ArcConfigError extends Error {
  override readonly name = 'ArcConfigError';
}

function positive(name: string, v: bigint): bigint {
  if (v <= 0n) throw new ArcConfigError(`${name} must be positive`);
  return v;
}

/**
 * Build the Arc network parameters. Throws `ArcConfigError` (or U2's
 * `MainnetGateError`) for anything but Arc testnet with valid operator values.
 */
export function loadArcNetworkParams(input: ArcConfigInput): ArcNetworkParams {
  const mainnetId = BigInt(ARC_MAINNET_DISABLED.chainId);
  const testnetId = BigInt(ARC_TESTNET.chainId);
  const wantsMainnet = input.chainId === mainnetId || input.dfnsNetwork === DFNS_ARC_NETWORKS.mainnet.name;
  if (wantsMainnet && input.singleSourceTestnetOnly) {
    throw new ArcConfigError('singleSourceTestnetOnly is refused with the Arc mainnet entry (§6.3, §11 test e)');
  }
  if (wantsMainnet) {
    // Runs U2's gate check, then refuses: mainnet is disabled in code.
    resolveChain(ARC_MAINNET_DISABLED.chainId, input.gatesFile);
  }
  if (input.chainId !== testnetId) throw new ArcConfigError(`chain ${input.chainId} is not enabled`);
  if (input.dfnsNetwork !== DFNS_ARC_NETWORKS.testnet.name) {
    throw new ArcConfigError(`DFNS network ${input.dfnsNetwork} does not match chain ${input.chainId}`);
  }
  const chain = resolveChain(ARC_TESTNET.chainId, input.gatesFile);
  const retry = input.retry ?? PROPOSED_RETRY;
  positive('retry.initialMs', retry.initialMs);
  if (retry.capMs < retry.initialMs) throw new ArcConfigError('retry.capMs must be at least retry.initialMs');
  positive('retry.maxAttempts', retry.maxAttempts);
  const confirmations = input.confirmations ?? 0n;
  if (confirmations < 0n) throw new ArcConfigError('confirmations must not be negative');
  if (input.startBlock < 0n) throw new ArcConfigError('startBlock must not be negative');
  const { headRegressionToleranceBlocks } = input;
  if (typeof headRegressionToleranceBlocks !== 'bigint') throw new ArcConfigError('headRegressionToleranceBlocks is required (no default)');
  if (headRegressionToleranceBlocks < 0n) throw new ArcConfigError('headRegressionToleranceBlocks must not be negative');
  // U2 values are fixed, cited constants; the indexer compares lower-case hex.
  const topic0 = chain.transferTopic0.toLowerCase() as Hex32;
  const systemEmitter = chain.systemEmitter.toLowerCase() as NetworkAddress;
  const usdcErc20 = chain.usdcErc20Address.toLowerCase() as NetworkAddress;
  return Object.freeze({
    network: 'ARC',
    asset: 'USDC',
    enabled: true,
    chainId: 5042002n,
    dfnsNetwork: 'ArcTestnet',
    systemEmitter,
    usdcErc20,
    transferTopic0: topic0,
    maxBlocksPerPage: chain.getLogsMaxBlocksPerPage,
    rangeTooLargeCode: BigInt(chain.rpcErrorRangeTooLarge),
    resultCapCode: BigInt(chain.rpcErrorResultCapObserved),
    headLagCode: BigInt(chain.rpcErrorHeadLag),
    retry: Object.freeze({ ...retry }),
    stallAfterMs: positive('stallAfterMs', input.stallAfterMs),
    headRegressionToleranceBlocks,
    confirmations,
    startBlock: input.startBlock,
    singleSourceTestnetOnly: input.singleSourceTestnetOnly,
    blocklistMaxAgeMs: positive('blocklistMaxAgeMs', input.blocklistMaxAgeMs),
    reservedDestinations: Object.freeze([systemEmitter, usdcErc20]),
    feeFloorWei: chain.feeFloorWei,
    maxBaseFeeWei: chain.maxBaseFeeWei,
  } as const);
}
