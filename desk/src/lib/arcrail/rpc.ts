import { createPublicClient, http, type PublicClient, type Hex } from "viem";
import {
  ARC_EXPLORER_API,
  ARC_RPCS,
  ARC_TESTNET_CHAIN_ID,
  ARC_WITNESS_RPCS,
  arcTestnet,
  rpcProvider,
} from "./arc-chain.ts";

export interface Witness {
  source: string;
  provider: string;
  kind: "rpc" | "explorer";
  ok: boolean;
  status?: "success" | "reverted" | "pending";
  blockNumber?: string;
  from?: string;
  to?: string | null;
  value?: string;
  error?: string;
}

export function clientFor(url: string): PublicClient {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(url, { timeout: 8_000, retryCount: 0 }),
  });
}

const chainPin = new Map<string, number>();

/** Known testnet URLs stay pinned for a minute so a proof does not re-ask eth_chainId five times. */
async function assertPinned(url: string, client: PublicClient): Promise<string | null> {
  const until = chainPin.get(url) ?? 0;
  if (until > Date.now()) return null;
  const chainId = await client.getChainId();
  if (chainId !== ARC_TESTNET_CHAIN_ID) return `chain ${chainId}`;
  chainPin.set(url, Date.now() + 60_000);
  return null;
}

let cached: { at: number; url: string; client: PublicClient } | null = null;

/** First endpoint that answers with chain id 5042002. Never calls mainnet. */
export async function healthyRpc(exclude?: string): Promise<{ url: string; client: PublicClient }> {
  const now = Date.now();
  if (!exclude && cached && now - cached.at < 20_000) {
    return { url: cached.url, client: cached.client };
  }
  const urls = ARC_RPCS.filter((url) => url !== exclude);
  const errors: string[] = [];
  try {
    const hit = await Promise.any(
      urls.map(async (url) => {
        const client = clientFor(url);
        const chainId = await client.getChainId();
        if (chainId !== ARC_TESTNET_CHAIN_ID) {
          throw new Error(`${url} reported ${chainId}`);
        }
        return { url, client };
      }),
    );
    if (!exclude) cached = { at: now, url: hit.url, client: hit.client };
    return hit;
  } catch (e) {
    if (e && typeof e === "object" && "errors" in e && Array.isArray((e as { errors: unknown[] }).errors)) {
      for (const inner of (e as { errors: unknown[] }).errors) {
        errors.push(inner instanceof Error ? inner.message.slice(0, 90) : "failed");
      }
    }
    throw new Error(`No Arc testnet RPC answered. ${errors.join(" | ") || "all providers failed"}`);
  }
}

async function rpcWitness(provider: string, url: string, hash: Hex): Promise<Witness> {
  const client = clientFor(url);
  try {
    const wrong = await assertPinned(url, client);
    if (wrong) return { source: url, provider, kind: "rpc", ok: false, error: wrong };
    const [txRes, receiptRes] = await Promise.allSettled([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ]);
    if (txRes.status === "rejected") {
      const reason = txRes.reason;
      return {
        source: url,
        provider,
        kind: "rpc",
        ok: false,
        error: reason instanceof Error ? reason.message.slice(0, 140) : "not found",
      };
    }
    const tx = txRes.value;
    let status: Witness["status"] = "pending";
    let blockNumber = tx.blockNumber?.toString();
    if (receiptRes.status === "fulfilled") {
      status = receiptRes.value.status;
      blockNumber = receiptRes.value.blockNumber.toString();
    }
    return {
      source: url,
      provider,
      kind: "rpc",
      ok: true,
      status,
      blockNumber,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
    };
  } catch (e) {
    return {
      source: url,
      provider,
      kind: "rpc",
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 140) : "rpc failed",
    };
  }
}

async function explorerWitness(hash: Hex): Promise<Witness> {
  const source = `${ARC_EXPLORER_API}/transactions/${hash}`;
  try {
    const res = await fetch(source, { signal: AbortSignal.timeout(8_000) });
    if (res.status === 404) return { source, provider: "explorer", kind: "explorer", ok: false, error: "not indexed" };
    if (!res.ok) return { source, provider: "explorer", kind: "explorer", ok: false, error: `http ${res.status}` };
    const body = (await res.json()) as {
      status?: string;
      result?: string;
      value?: string;
      block_number?: number;
      from?: { hash?: string };
      to?: { hash?: string } | null;
    };
    const mined = typeof body.block_number === "number";
    const status: Witness["status"] =
      body.result === "success" || body.status === "ok" ? "success" : body.status === "error" ? "reverted" : mined ? "success" : "pending";
    return {
      source: "https://explorer.testnet.arc.io",
      provider: "explorer",
      kind: "explorer",
      ok: true,
      status,
      blockNumber: mined ? String(body.block_number) : undefined,
      from: body.from?.hash,
      to: body.to?.hash ?? null,
      value: body.value,
    };
  } catch (e) {
    return {
      source: "https://explorer.testnet.arc.io",
      provider: "explorer",
      kind: "explorer",
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 140) : "explorer failed",
    };
  }
}

/** Ask every operator and the public explorer. Callers decide what "agree" means. */
export async function collectWitnesses(hash: Hex): Promise<Witness[]> {
  const rows = await Promise.all([
    ...ARC_WITNESS_RPCS.map((row) => rpcWitness(row.provider, row.url, hash)),
    explorerWitness(hash),
  ]);
  return rows;
}

/**
 * A second operator (not the broadcaster's provider) that already has the receipt.
 * Polls until `timeoutMs` because a load-balanced head can lag a second or two.
 */
export async function corroborate(
  hash: Hex,
  primaryUrl: string,
  timeoutMs = 18_000,
): Promise<{ url: string; client: PublicClient } | null> {
  const skip = rpcProvider(primaryUrl);
  const deadline = Date.now() + timeoutMs;
  const candidates = ARC_WITNESS_RPCS.filter((row) => row.provider !== skip);
  do {
    const found = await Promise.all(
      candidates.map(async (row) => {
        const client = clientFor(row.url);
        try {
          const wrong = await assertPinned(row.url, client);
          if (wrong) return null;
          await client.getTransactionReceipt({ hash });
          return { url: row.url, client };
        } catch {
          return null;
        }
      }),
    );
    const hit = found.find((row) => row !== null);
    if (hit) return hit;
    if (Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, 400));
  } while (Date.now() < deadline);
  return null;
}
