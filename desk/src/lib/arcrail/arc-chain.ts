import { defineChain } from "viem";

/** Arc testnet only. Mainnet chain 5042 is intentionally absent. */
export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_EXPLORER = "https://explorer.testnet.arc.io";
export const ARC_EXPLORER_API = "https://explorer.testnet.arc.io/api/v2";
export const ARC_EXPLORER_MIRROR = "https://testnet.arcscan.app";
export const ARC_FAUCET = "https://faucet.circle.com";

/**
 * Public endpoints from Circle's docs. No API key. No mainnet URL.
 * `.io` and `.network` aliases are the same operator — witnesses group them.
 */
export const ARC_RPCS = [
  "https://rpc.testnet.arc.io",
  "https://rpc.testnet.arc.network",
  "https://rpc.drpc.testnet.arc.io",
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.io",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.io",
  "https://rpc.quicknode.testnet.arc.network",
] as const;

/** One URL per operator. Two of these agreeing is an independent corroboration. */
export const ARC_WITNESS_RPCS = [
  { provider: "circle", url: "https://rpc.testnet.arc.io" },
  { provider: "drpc", url: "https://rpc.drpc.testnet.arc.io" },
  { provider: "blockdaemon", url: "https://rpc.blockdaemon.testnet.arc.io" },
  { provider: "quicknode", url: "https://rpc.quicknode.testnet.arc.io" },
] as const;

export function rpcProvider(url: string): string {
  if (url.includes("drpc")) return "drpc";
  if (url.includes("blockdaemon")) return "blockdaemon";
  if (url.includes("quicknode")) return "quicknode";
  if (url.includes("explorer.testnet.arc.io")) return "explorer";
  return "circle";
}

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [...ARC_RPCS] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: ARC_EXPLORER },
  },
  testnet: true,
});
