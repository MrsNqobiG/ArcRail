import { isHex, type Hex } from "viem";
import { ARC_EXPLORER, ARC_EXPLORER_MIRROR, ARC_TESTNET_CHAIN_ID } from "./arc-chain.ts";
import { formatUsdc } from "./policy.ts";
import { collectWitnesses, healthyRpc, type Witness } from "./rpc.ts";
import { summariseWitnesses } from "./witness.ts";

/** Read-only probe. Signing lives in treasury.server.ts and never touches mainnet. */
export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.io";
export { ARC_TESTNET_CHAIN_ID, ARC_EXPLORER };

export interface ChainProbe {
  mode: "read-only";
  broadcasts: false;
  why: string;
  rpc: string;
  ok: boolean;
  error?: string;
  chainId?: number;
  expectedChainId: number;
  chainIdOk?: boolean;
  blockNumber?: string;
  blockHash?: string;
  timestamp?: number;
  ageSeconds?: number;
  txCount?: number;
  baseFeeGwei?: string;
  tx?: TxProof;
}

export interface TxProof {
  hash: string;
  found: boolean;
  onChain: boolean;
  corroborated: boolean;
  verdict: string;
  status?: "success" | "reverted" | "pending";
  blockNumber?: string;
  from?: string;
  to?: string | null;
  value?: string;
  explorerUrl?: string;
  mirrorUrl?: string;
  agreed: number;
  witnesses: Witness[];
}

const WHY =
  "This route only reads Arc testnet. It asks four RPC operators and the public explorer, then reports whether they agree. It does not sign. Broadcasts go through the testnet settle desk, which is capped, chain-pinned to 5042002, and refuses mainnet 5042.";

export async function probeChain(tx?: string | null): Promise<ChainProbe> {
  const base: ChainProbe = {
    mode: "read-only",
    broadcasts: false,
    why: WHY,
    rpc: ARC_TESTNET_RPC,
    ok: false,
    expectedChainId: ARC_TESTNET_CHAIN_ID,
  };
  try {
    const { url, client } = await healthyRpc();
    const [chainId, block] = await Promise.all([client.getChainId(), client.getBlock({ blockTag: "latest" })]);
    const now = Math.floor(Date.now() / 1000);
    const ts = Number(block.timestamp);
    const head: ChainProbe = {
      ...base,
      rpc: url,
      ok: true,
      chainId,
      chainIdOk: chainId === ARC_TESTNET_CHAIN_ID,
      blockNumber: block.number.toString(),
      blockHash: block.hash,
      timestamp: ts,
      ageSeconds: Math.max(0, now - ts),
      txCount: block.transactions.length,
      baseFeeGwei: block.baseFeePerGas ? (Number(block.baseFeePerGas) / 1e9).toFixed(3) : undefined,
    };
    if (!tx) return head;
    return { ...head, tx: await proveHash(tx) };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "rpc failed" };
  }
}

export async function proveHash(raw: string): Promise<TxProof> {
  const hash = raw.trim();
  if (!isHex(hash) || hash.length !== 66) {
    return {
      hash,
      found: false,
      onChain: false,
      corroborated: false,
      agreed: 0,
      witnesses: [],
      verdict: "Not a 32-byte transaction hash. A rehearsal payment id is computed locally and is not a transaction.",
    };
  }
  const witnesses = await collectWitnesses(hash as Hex);
  const summary = summariseWitnesses(witnesses);
  const found = witnesses.some((row) => row.ok);
  const explorerUrl = `${ARC_EXPLORER}/tx/${hash}`;
  const mirrorUrl = `${ARC_EXPLORER_MIRROR}/tx/${hash}`;
  let verdict: string;
  if (!found) {
    verdict = "No Arc testnet operator or the explorer has this hash. It was not submitted, or it was dropped.";
  } else if (!summary.included) {
    verdict = "Seen by a provider, but no receipt yet. It is not settled.";
  } else if (summary.status === "reverted") {
    verdict = summary.corroborated
      ? `Reverted in block ${summary.blockNumber}. ${summary.agreed} sources agree.`
      : `One source shows a revert in block ${summary.blockNumber}. A second source has not agreed.`;
  } else if (summary.corroborated) {
    verdict = `Included on Arc testnet in block ${summary.blockNumber}. ${summary.agreed} independent sources returned the same receipt.`;
  } else {
    verdict = `One source shows success in block ${summary.blockNumber}. A second source has not agreed yet — do not treat it as settled.`;
  }
  return {
    hash,
    found,
    onChain: summary.included && summary.status === "success",
    corroborated: summary.corroborated && summary.status === "success",
    agreed: summary.agreed,
    status: (summary.status as TxProof["status"]) ?? (found ? "pending" : undefined),
    blockNumber: summary.blockNumber,
    from: summary.from,
    to: summary.to,
    value: summary.value,
    explorerUrl,
    mirrorUrl,
    witnesses,
    verdict,
  };
}

export interface NativeSample {
  hash: string;
  value: string;
  valueUsdc: string;
  from: string;
  to: string;
  blockNumber: string;
}

/** A recent plain native transfer already on Arc testnet. Read-only. Not one of ours. */
export async function sampleNativeTransfer(): Promise<NativeSample | null> {
  const { client } = await healthyRpc();
  const latest = await client.getBlock({ blockTag: "latest" });
  const nums = Array.from({ length: 16 }, (_, i) => latest.number - BigInt(i));
  const blocks = await Promise.all(
    nums.map((blockNumber) => client.getBlock({ blockNumber, includeTransactions: true })),
  );
  for (const block of blocks) {
    for (const tx of block.transactions) {
      if (typeof tx === "string") continue;
      if (tx.value > 0n && (tx.input === "0x" || tx.input === "0x0") && tx.to) {
        return {
          hash: tx.hash,
          value: tx.value.toString(),
          valueUsdc: formatUsdc(tx.value),
          from: tx.from,
          to: tx.to,
          blockNumber: block.number.toString(),
        };
      }
    }
  }
  return null;
}
