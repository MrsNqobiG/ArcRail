/**
 * U2 Chain config.
 *
 * REAL in the skeleton. Every value below is copied from docs/constants.md and
 * cites its C-id. Code must load Arc values from here and nowhere else.
 *
 * TESTNET ONLY (CLAUDE.md rule 1). The mainnet entry exists only so that a
 * request for it fails closed: it is `enabled: false`, carries no endpoint,
 * and `resolveChain(5042)` runs the gate check and then refuses anyway,
 * because enabling mainnet is a code change made only after every G-M gate in
 * docs/GATES.md is SIGNED-OFF by a named human (RUBRIC MC-20, MC-42).
 */
import { readFileSync } from 'node:fs';
import type { NativeWei } from '../../amounts/index.js';
import { nativeWei } from '../../amounts/index.js';

export type Address = `0x${string}`;
export type Hex32 = `0x${string}`;

export interface TestnetChainConfig {
  readonly name: 'arc-testnet';
  readonly enabled: true;
  /** C-01 */
  readonly chainId: 5042002;
  /** C-03 (primary, Circle) */
  readonly rpcHttp: 'https://rpc.testnet.arc.io';
  /** C-03 */
  readonly rpcWs: 'wss://rpc.testnet.arc.io';
  /** C-06 */
  readonly explorer: 'https://explorer.testnet.arc.io';
  /** C-05 */
  readonly nativeSymbol: 'USDC';
  /** C-10: native view decimals (`NativeWei`) */
  readonly nativeDecimals: 18;
  /** C-12: ERC-20 USDC interface address (cross-check only, never a credit source) */
  readonly usdcErc20Address: Address;
  /** C-11: ERC-20 view decimals (`UsdcUnits`) */
  readonly usdcErc20Decimals: 6;
  /** C-20: EIP-7708 system emitter, the canonical credit source */
  readonly systemEmitter: Address;
  /** C-21: Transfer(address,address,uint256) topic0, both emitters */
  readonly transferTopic0: Hex32;
  /** C-22: one ERC-20 transfer() emits two Transfer logs (system 18 dp, ERC-20 6 dp) */
  readonly erc20TransferEmitsTwoLogs: true;
  /** C-30: fee floor, minimum maxFeePerGas, in wei */
  readonly feeFloorWei: NativeWei;
  /** C-31: maximum base fee, in wei */
  readonly maxBaseFeeWei: NativeWei;
  /** C-32: block gas limit */
  readonly blockGasLimit: 30_000_000n;
  /**
   * C-40: eth_getLogs rejects ranges over 10,000 blocks (-32012); page in
   * chunks of at most 9,999 blocks inclusive, i.e. toBlock − fromBlock ≤ 9,998.
   */
  readonly getLogsMaxBlocksPerPage: 9_999n;
  /** C-40 */
  readonly rpcErrorRangeTooLarge: -32012;
  /** C-42: head lag, retry after backoff */
  readonly rpcErrorHeadLag: -32014;
  /**
   * C-41 (NOT in docs; observed on the testnet primary endpoint only; Q-A4):
   * result cap of 2,000 logs per query, error -32602. UNVERIFIED.
   */
  readonly rpcErrorResultCapObserved: -32602;
  /** C-60: CCTP domain for Arc */
  readonly cctpDomain: 26;
  /** C-56: EIP-155 chain ID is required in every signature */
  readonly eip155Required: true;
}

export interface MainnetChainConfig {
  readonly name: 'arc-mainnet';
  /** Disabled in code. Changing this is a reviewed code change after every G-M gate is signed. */
  readonly enabled: false;
  /** C-02 (recorded for the gate check only; never wired to anything that signs or broadcasts) */
  readonly chainId: 5042;
}

export const ARC_TESTNET: TestnetChainConfig = Object.freeze({
  name: 'arc-testnet',
  enabled: true,
  chainId: 5042002, // C-01
  rpcHttp: 'https://rpc.testnet.arc.io', // C-03
  rpcWs: 'wss://rpc.testnet.arc.io', // C-03
  explorer: 'https://explorer.testnet.arc.io', // C-06
  nativeSymbol: 'USDC', // C-05
  nativeDecimals: 18, // C-10
  usdcErc20Address: '0x3600000000000000000000000000000000000000', // C-12
  usdcErc20Decimals: 6, // C-11
  systemEmitter: '0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE', // C-20
  transferTopic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // C-21
  erc20TransferEmitsTwoLogs: true, // C-22
  feeFloorWei: nativeWei(20_000_000_000n), // C-30: 20 gwei
  maxBaseFeeWei: nativeWei(20_000_000_000_000n), // C-31: 20,000 gwei
  blockGasLimit: 30_000_000n, // C-32
  getLogsMaxBlocksPerPage: 9_999n, // C-40
  rpcErrorRangeTooLarge: -32012, // C-40
  rpcErrorHeadLag: -32014, // C-42
  rpcErrorResultCapObserved: -32602, // C-41 (UNVERIFIED, Q-A4)
  cctpDomain: 26, // C-60
  eip155Required: true, // C-56
} as const);

export const ARC_MAINNET_DISABLED: MainnetChainConfig = Object.freeze({
  name: 'arc-mainnet',
  enabled: false,
  chainId: 5042, // C-02 (gated, do not use)
} as const);

/** The G-M gates that must all be SIGNED-OFF (docs/GATES.md, KICKOFF §9). A missing row fails closed. */
export const REQUIRED_MAINNET_GATES: readonly string[] = Object.freeze([
  'G-M 1',
  'G-M 2',
  'G-M 3',
  'G-M 4',
  'G-M 5',
  'G-M 6',
  'G-M 7',
  'G-M 8',
]);

export const DEFAULT_GATES_FILE: URL = new URL('../../../docs/GATES.md', import.meta.url);

export class MainnetGateError extends Error {
  override readonly name = 'MainnetGateError';
}

interface GateRow {
  readonly gate: string;
  readonly status: string;
  readonly name: string;
  readonly role: string;
  readonly date: string;
}

function parseGateRows(markdown: string): GateRow[] {
  const rows: GateRow[] = [];
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
    const gate = cells[0] ?? '';
    if (!/^G-M\s*\d+$/.test(gate)) continue;
    // Table columns: Gate | Requirement | Status | Name | Role | Date
    rows.push({
      gate: gate.replace(/\s+/g, ' '),
      status: cells[2] ?? '',
      name: cells[3] ?? '',
      role: cells[4] ?? '',
      date: cells[5] ?? '',
    });
  }
  return rows;
}

/**
 * Throws `MainnetGateError` unless every required G-M row in the gates file
 * has status exactly `SIGNED-OFF` with a non-empty name, role and date.
 * A missing, duplicated or unreadable row fails closed.
 *
 * This checks the file's content only. Whether a SIGNED-OFF line was really
 * written by the named human is the git-provenance control (RUBRIC MC-42),
 * which is separate and must also pass before mainnet is enabled.
 */
export function assertMainnetAllowed(gatesFile: string | URL = DEFAULT_GATES_FILE): void {
  let markdown: string;
  try {
    markdown = readFileSync(gatesFile, 'utf8');
  } catch (cause) {
    throw new MainnetGateError(`mainnet refused: cannot read gates file (${String(cause)})`);
  }
  const rows = parseGateRows(markdown);
  const problems: string[] = [];
  for (const required of REQUIRED_MAINNET_GATES) {
    const matches = rows.filter((r) => r.gate === required);
    if (matches.length !== 1) {
      problems.push(`${required}: expected exactly one row, found ${matches.length}`);
      continue;
    }
    const row = matches[0] as GateRow;
    if (row.status !== 'SIGNED-OFF') problems.push(`${required}: status is "${row.status}"`);
    else if (row.name === '' || row.role === '' || row.date === '') {
      problems.push(`${required}: SIGNED-OFF without name, role and date`);
    }
  }
  for (const row of rows) {
    if (!REQUIRED_MAINNET_GATES.includes(row.gate)) problems.push(`${row.gate}: unexpected gate row`);
  }
  if (problems.length > 0) {
    throw new MainnetGateError(`mainnet refused: ${problems.join('; ')}`);
  }
}

/**
 * The only way to obtain a chain config. Testnet resolves; mainnet runs the
 * gate check and is then refused because it is disabled in code, even when
 * every gate is signed (enabling it is a separate reviewed code change, and
 * MC-42 git provenance is a separate control); anything else is refused
 * (CONTRACT §1.2 CHAIN_NOT_ENABLED). `gatesFile` exists so tests can run the
 * mainnet path against generated fixtures; production uses the default.
 */
export function resolveChain(chainId: number, gatesFile: string | URL = DEFAULT_GATES_FILE): TestnetChainConfig {
  if (chainId === ARC_TESTNET.chainId) return ARC_TESTNET;
  if (chainId === ARC_MAINNET_DISABLED.chainId) {
    assertMainnetAllowed(gatesFile);
    throw new MainnetGateError('mainnet refused: disabled in code (enabled: false)');
  }
  throw new MainnetGateError(`chain ${chainId} is not enabled`);
}
