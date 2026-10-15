/**
 * Pre-sign checks for a native USDC transfer on Arc testnet.
 * Pure: no RPC, no key. Fail closed. Mainnet chain 5042 is refused by name.
 */

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_MAINNET_CHAIN_ID = 5042;
/** 1.000000 USDC in native wei (18 dp). */
export const MAX_TRANSFER_WEI = 1_000_000_000_000_000_000n;
/** 5.000000 USDC rolling hour, native wei. */
export const HOUR_CAP_WEI = 5_000_000_000_000_000_000n;
/** Leave this on the sender so the next transfer can still pay gas. */
export const GAS_RESERVE_WEI = 2_000_000_000_000_000n; // 0.002 USDC
export const MIN_TRANSFER_WEI = 1_000_000_000_000n; // 0.000001 USDC

const ZERO = `0x${"0".repeat(40)}`;
const PRECOMPILE = /^0x0{36}[0-9a-f]{4}$/;
const RESERVED = new Set([
  "0x3600000000000000000000000000000000000000",
  "0x3600000000000000000000000000000000000001",
  "0x3600000000000000000000000000000000000002",
  "0x3600000000000000000000000000000000000003",
  "0x3600000000000000000000000000000000000004",
]);

/**
 * Static subset of public OFAC SDN Ethereum addresses as republished on
 * 2026-10-09 (Lazarus Group / DPRK3, GARANTEX EUROPE OU, SUEX OTC).
 * Tornado Cash identifiers are omitted: OFAC removed them on 21 March 2025.
 * This is a demo control, not a maintained screening feed.
 */
export const SANCTIONS_AS_OF = "2026-10-09";
const SANCTIONED = new Set([
  "0xa0e1c89ef1a489c9c7de96311ed5ce5d32c20e4b",
  "0xf7b31119c2682c88d88d455dbb9d5932c65cf1be",
  "0x53b6936513e738f44fb50d2b9476730c0ab3bfc1",
  "0x3e37627deaa754090fbfbb8bd226c1ce66d255e9",
  "0x3cffd56b47b7b41c56258d9c7731abadc360e073",
  "0x35fb6f6db4fb05e6a4ce86f2c93691425626d4b1",
  "0x098b716b8aaf21512996dc57eb0615e2383e2f96",
  "0x08723392ed15743cc38513c4925f5e6be5c17243",
  "0xf4377eda661e04b6dda78969796ed31658d602d4",
  "0xb338962b92cd818d6aef0a32a9ecd01212a71f33",
  "0xd8500c631dc32fa18645b7436344a99e4825e10e",
  "0x8dce2aac0de82bdcaf6b4373b79f94331b8e4995",
  "0x7ff9cfad3877f21d41da833e2f775db0569ee3d9",
  "0x7ced75026204ac29c34bea98905d4c949f27361e",
  "0x57ec89a0c056163a0314e413320f9b3abe761259",
  "0xe7aa314c77f4233c18c6cc84384a9247c0cf367b",
  "0x308ed4b7b49797e1a98d3818bff6fe5385410370",
  "0x2f389ce8bd8ff92de3402ffce4691d17fc4f6535",
  "0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff",
]);

export const LEGAL_NOTICE =
  "Technology demonstration only. It can broadcast a capped native transfer of Arc testnet USDC on chain 5042002. Those tokens have no monetary value and are not legal tender in South Africa or anywhere else. This desk does not take deposits, exchange fiat, hold customer assets, give financial advice, or offer a crypto-asset service to the public. It is not an FSCA-licensed crypto-asset service provider, not an accountable institution registered with the Financial Intelligence Centre, and not a payment under the National Payment System Act. A business that advises on, intermediates, or safeguards customer crypto assets in South Africa still needs its own FAIS authorisation, FIC registration, a POPIA programme, a maintained sanctions feed, and exchange-control advice. Nothing on this screen is that authorisation, and nothing on this screen is legal advice.";

export const LEGAL_POINTS = [
  "Arc testnet only. Chain 5042002 is pinned into the signature. Mainnet chain 5042 is not configured and is refused by name.",
  "Testnet USDC has no monetary value. It is not money, not legal tender, and not a domestic payment under the National Payment System Act (SARB and FSCA joint communication, 28 May 2026).",
  "No financial advice, no intermediary service, no fiat exchange, no customer deposits. Crypto assets are financial products under FAIS Notice 1350 of 2022 only when a person renders financial services in respect of them. This desk does not.",
  "No personal information is collected. Wallet addresses and transaction hashes are public chain data. That is the POPIA minimum: do not ask for what the transfer does not need.",
  "A static public OFAC SDN subset (republished 2026-10-09) is refused. Tornado Cash identifiers are not in it — OFAC removed them on 21 March 2025. This is a demo control, not a live screening feed.",
  "International sanctions and anti-money-laundering rules apply to real value. This desk moves none. It will not be pointed at a third-party remittance, a payout, or a cross-border payment.",
  "Your two testnet keys are created in this browser and stay in it; nobody else, including us, can see or use them. Each transfer is capped at 1 testnet USDC, and 5 per rolling hour, with gas held back. Clearing this site's data deletes the keys and any testnet USDC on them.",
] as const;

export interface TransferReview {
  chainId: number;
  from: string;
  to: string;
  amountWei: bigint;
  balanceWei: bigint;
  data?: string;
  spentThisHourWei: bigint;
  /** Worst-case gas the sender must still hold. Defaults to the static reserve. */
  gasReserveWei?: bigint;
}

export type Review =
  | { ok: true; to: string; from: string }
  | { ok: false; code: string; detail: string };

export function formatUsdc(wei: bigint): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n) / 10n ** 12n;
  return `${neg ? "-" : ""}${whole.toString()}.${frac.toString().padStart(6, "0")}`;
}

/** Exact. At most 6 decimal places. No floats. */
export function parseUsdc(raw: string): bigint {
  const s = raw.trim();
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(s);
  if (!m) {
    throw Object.assign(new Error("Amount must be a positive decimal with at most 6 places"), {
      code: "AMOUNT_NOT_REPRESENTABLE",
    });
  }
  const frac = (m[2] ?? "").padEnd(6, "0");
  return BigInt(m[1]) * 10n ** 18n + BigInt(frac) * 10n ** 12n;
}

export function reviewTransfer(input: TransferReview): Review {
  if (input.chainId === ARC_MAINNET_CHAIN_ID) {
    return { ok: false, code: "MAINNET_DISABLED", detail: "Chain 5042 is mainnet. This desk will not sign it." };
  }
  if (input.chainId !== ARC_TESTNET_CHAIN_ID) {
    return {
      ok: false,
      code: "CHAIN_PIN",
      detail: `Refusing chain ${input.chainId}. Only Arc testnet ${ARC_TESTNET_CHAIN_ID} is allowed.`,
    };
  }
  const from = normalize(input.from);
  const to = normalize(input.to);
  if (!from) return { ok: false, code: "INVALID_SOURCE", detail: "Sender is not a 20-byte address." };
  if (!to) return { ok: false, code: "INVALID_DESTINATION", detail: "Recipient is not a 20-byte address." };
  if (to === ZERO) return { ok: false, code: "INVALID_DESTINATION", detail: "Zero address is refused." };
  if (to === from) return { ok: false, code: "INVALID_DESTINATION", detail: "A self-transfer emits no USDC log." };
  if (PRECOMPILE.test(to)) return { ok: false, code: "INVALID_DESTINATION", detail: "Precompile range is refused." };
  if (RESERVED.has(to)) return { ok: false, code: "INVALID_DESTINATION", detail: "Arc system contracts are not payment destinations." };
  if (SANCTIONED.has(to) || SANCTIONED.has(from)) {
    return {
      ok: false,
      code: "SANCTIONS_HIT",
      detail: `Address is on the desk's static OFAC SDN subset (as of ${SANCTIONS_AS_OF}). No transaction was signed.`,
    };
  }
  const data = (input.data ?? "0x").toLowerCase();
  if (data !== "0x" && data !== "0x0") {
    return { ok: false, code: "CALLDATA_REFUSED", detail: "Only a native value transfer (empty calldata) is allowed." };
  }
  if (input.amountWei <= 0n) return { ok: false, code: "AMOUNT_NOT_POSITIVE", detail: "Amount must be greater than zero." };
  if (input.amountWei < MIN_TRANSFER_WEI) {
    return { ok: false, code: "AMOUNT_TOO_SMALL", detail: "Minimum send is 0.000001 USDC." };
  }
  if (input.amountWei > MAX_TRANSFER_WEI) {
    return {
      ok: false,
      code: "AMOUNT_CAP",
      detail: `Per-transfer cap is ${formatUsdc(MAX_TRANSFER_WEI)} USDC. Asked for ${formatUsdc(input.amountWei)}.`,
    };
  }
  if (input.spentThisHourWei + input.amountWei > HOUR_CAP_WEI) {
    return {
      ok: false,
      code: "HOUR_CAP",
      detail: `Hourly cap is ${formatUsdc(HOUR_CAP_WEI)} USDC. Already sent ${formatUsdc(input.spentThisHourWei)} this hour.`,
    };
  }
  const reserve = input.gasReserveWei ?? GAS_RESERVE_WEI;
  const need = input.amountWei + reserve;
  if (input.balanceWei < need) {
    return {
      ok: false,
      code: "INSUFFICIENT_FUNDS",
      detail: `Balance is ${formatUsdc(input.balanceWei)} USDC. This send needs ${formatUsdc(input.amountWei)} plus ${formatUsdc(reserve)} held back for gas. Fund the desk at https://faucet.circle.com (Arc Testnet).`,
    };
  }
  return { ok: true, to, from };
}

function normalize(addr: string): string | null {
  const s = addr.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(s)) return null;
  return s;
}

/** Largest legal sweep: under the per-transfer cap, the hourly room, and the gas reserve. */
export function sweepAmount(
  balanceWei: bigint,
  spentThisHourWei: bigint,
): { ok: true; amountWei: bigint } | { ok: false; code: string; detail: string } {
  if (balanceWei <= GAS_RESERVE_WEI) {
    return {
      ok: false,
      code: "NOTHING_TO_SWEEP",
      detail: `Receiver holds ${formatUsdc(balanceWei)} USDC, which does not cover a sweep plus ${formatUsdc(GAS_RESERVE_WEI)} held back for gas.`,
    };
  }
  const spendable = ((balanceWei - GAS_RESERVE_WEI) / 10n ** 12n) * 10n ** 12n;
  if (spendable < MIN_TRANSFER_WEI) {
    return {
      ok: false,
      code: "NOTHING_TO_SWEEP",
      detail: `Only ${formatUsdc(spendable)} USDC is free after the gas reserve. Minimum sweep is ${formatUsdc(MIN_TRANSFER_WEI)}.`,
    };
  }
  const room = HOUR_CAP_WEI - (spentThisHourWei > HOUR_CAP_WEI ? HOUR_CAP_WEI : spentThisHourWei);
  if (room < MIN_TRANSFER_WEI) {
    return {
      ok: false,
      code: "HOUR_CAP",
      detail: `Hourly cap is ${formatUsdc(HOUR_CAP_WEI)} USDC and ${formatUsdc(spentThisHourWei)} is already sent. Nothing left to sweep this hour.`,
    };
  }
  let amount = spendable;
  if (amount > MAX_TRANSFER_WEI) amount = MAX_TRANSFER_WEI;
  if (amount > room) amount = room;
  return { ok: true, amountWei: amount };
}
