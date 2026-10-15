import { createWalletClient, http, isAddress, type Hex, type PublicClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ARC_EXPLORER, ARC_FAUCET, arcTestnet } from "./arc-chain";
import { corroborate, collectWitnesses, healthyRpc } from "./rpc";
import {
  ARC_TESTNET_CHAIN_ID,
  GAS_RESERVE_WEI,
  HOUR_CAP_WEI,
  LEGAL_NOTICE,
  LEGAL_POINTS,
  MAX_TRANSFER_WEI,
  SANCTIONS_AS_OF,
  formatUsdc,
  parseUsdc,
  reviewTransfer,
  sweepAmount,
} from "./policy";
import { summariseWitnesses } from "./witness";
import { applyEvent } from "./engine";
import { db } from "./memory";

/*
 * Browser port of the operator desk's treasury. The two testnet keys are
 * created in this browser (viem generatePrivateKey, Web Crypto randomness),
 * kept in this browser's localStorage, and never sent anywhere: transactions
 * are signed here and only the signed bytes go to an Arc testnet RPC.
 */
const KEY_STORE = "arcrail-testnet-keys-v1";
const LOG_STORE = "arcrail-testnet-settlements-v1";
const LOG_LIMIT = 200;

function randomHex(bytes: number): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function appendLog(rec: SettlementRecord) {
  const all = readLog();
  all.push(rec);
  storageSet(LOG_STORE, JSON.stringify(all.slice(-LOG_LIMIT)));
}
const FEE_FLOOR = 20_000_000_000n;
const FEE_CEILING = 20_000_000_000_000n;

export interface TraceStep {
  at: string;
  level: "info" | "ok" | "fail";
  title: string;
  detail: string;
}

export interface SettlementRecord {
  id: string;
  at: string;
  from: string;
  to: string;
  amount: string;
  amountWei: string;
  txHash: string;
  blockNumber: string | null;
  status: "success" | "reverted" | "pending";
  gasUsed: string | null;
  gasUsdc: string | null;
  paymentId: string | null;
  attached: boolean;
  explorerUrl: string;
  mirrorUrl: string;
  providers: string[];
  corroborated: boolean;
}

interface Keys {
  desk: Hex;
  receiver: Hex;
}

const spends: { at: number; wei: bigint }[] = [];
const byRequest = new Map<string, SettlementRecord>();
const byPayment = new Map<string, SettlementRecord>();
let sendLock: Promise<unknown> = Promise.resolve();
let memoryKeys: Keys | null = null;
let keyStore: "browser" | "memory" = "memory";

function lock<T>(fn: () => Promise<T>): Promise<T> {
  const run = sendLock.then(fn, fn);
  sendLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function loadKeys(): Keys {
  if (memoryKeys) return memoryKeys;
  const KEY_RE = /^0x[0-9a-f]{64}$/;
  try {
    const raw = storageGet(KEY_STORE);
    if (raw) {
      const parsed = JSON.parse(raw) as Keys;
      if (KEY_RE.test(parsed.desk ?? "") && KEY_RE.test(parsed.receiver ?? "")) {
        memoryKeys = parsed;
        keyStore = "browser";
        return parsed;
      }
    }
  } catch {
    /* unreadable: mint fresh keys below */
  }
  const fresh: Keys = { desk: generatePrivateKey(), receiver: generatePrivateKey() };
  memoryKeys = fresh;
  keyStore = storageSet(KEY_STORE, JSON.stringify(fresh)) ? "browser" : "memory";
  return fresh;
}

function accounts() {
  const keys = loadKeys();
  return {
    desk: privateKeyToAccount(keys.desk),
    receiver: privateKeyToAccount(keys.receiver),
  };
}

function readLog(): SettlementRecord[] {
  try {
    const parsed = JSON.parse(storageGet(LOG_STORE) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as SettlementRecord[]) : [];
  } catch {
    return [];
  }
}

function hourSpent(): bigint {
  const cut = Date.now() - 60 * 60 * 1000;
  const seen = new Set<string>();
  let logged = 0n;
  for (const r of readLog()) {
    if (r.status !== "success" || !r.txHash || seen.has(r.txHash)) continue;
    seen.add(r.txHash);
    if (Number.isNaN(Date.parse(r.at)) || Date.parse(r.at) < cut) continue;
    logged += BigInt(r.amountWei || "0");
  }
  const mem = spends.filter((s) => s.at >= cut).reduce((a, s) => a + s.wei, 0n);
  return logged > mem ? logged : mem;
}

function remember(rec: SettlementRecord, wei: bigint, requestId?: string, paymentId?: string | null) {
  if (rec.status === "success" && wei > 0n) spends.push({ at: Date.now(), wei });
  if (requestId) byRequest.set(requestId, rec);
  if (paymentId) byPayment.set(paymentId, rec);
  appendLog(rec);
}

function loadLog() {
  for (const rec of readLog()) {
    if (rec.id) byRequest.set(rec.id, rec);
    if (rec.paymentId) byPayment.set(rec.paymentId, rec);
  }
}
loadLog();

function findInFlight(from: string, to: string, amountWei: bigint): SettlementRecord | undefined {
  const want = amountWei.toString();
  const seen = new Set<string>();
  let best: SettlementRecord | undefined;
  for (const rec of [...byRequest.values(), ...readLog()]) {
    if (!rec.txHash || seen.has(rec.txHash)) continue;
    seen.add(rec.txHash);
    if (rec.status === "reverted") continue;
    if (rec.from.toLowerCase() !== from.toLowerCase()) continue;
    if (rec.to.toLowerCase() !== to.toLowerCase()) continue;
    if (rec.amountWei !== want) continue;
    if (!best || Date.parse(rec.at) > Date.parse(best.at)) best = rec;
  }
  return best;
}

function step(trace: TraceStep[], level: TraceStep["level"], title: string, detail: string) {
  trace.push({ at: new Date().toISOString(), level, title, detail });
}

async function head(client: PublicClient) {
  const [chainId, block] = await Promise.all([
    client.getChainId(),
    client.getBlock({ blockTag: "latest" }),
  ]);
  return {
    chainId,
    chainIdOk: chainId === ARC_TESTNET_CHAIN_ID,
    blockNumber: block.number.toString(),
    blockHash: block.hash,
    ageSeconds: Math.max(0, Math.floor(Date.now() / 1000) - Number(block.timestamp)),
    txCount: block.transactions.length,
    baseFeeGwei: block.baseFeePerGas ? (Number(block.baseFeePerGas) / 1e9).toFixed(3) : null,
  };
}

let statusCache: { at: number; value: Awaited<ReturnType<typeof loadStatus>> } | null = null;

export async function treasuryStatus(fresh = false) {
  if (!fresh && statusCache && Date.now() - statusCache.at < 8_000) return statusCache.value;
  const value = await loadStatus();
  statusCache = { at: Date.now(), value };
  return value;
}

async function loadStatus() {
  const { desk, receiver } = accounts();
  let chain: Awaited<ReturnType<typeof head>> | null = null;
  let rpc = ARC_RPC_LABEL;
  let error: string | undefined;
  let deskBal = 0n;
  let recvBal = 0n;
  try {
    const healthy = await healthyRpc();
    rpc = healthy.url;
    chain = await head(healthy.client);
    if (!chain.chainIdOk) throw new Error(`RPC reported chain ${chain.chainId}, not ${ARC_TESTNET_CHAIN_ID}`);
    [deskBal, recvBal] = await Promise.all([
      healthy.client.getBalance({ address: desk.address }),
      healthy.client.getBalance({ address: receiver.address }),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "rpc failed";
  }
  const byHash = new Map<string, SettlementRecord>();
  for (const rec of readLog()) if (rec.txHash) byHash.set(rec.txHash, rec);
  const recent = [...byHash.values()].slice(-12).reverse();
  return {
    mode: "testnet-broadcast" as const,
    mainnet: "disabled" as const,
    network: "Arc Testnet",
    rpc,
    explorer: ARC_EXPLORER,
    faucet: ARC_FAUCET,
    legal: LEGAL_NOTICE,
    legalPoints: LEGAL_POINTS,
    sanctionsAsOf: SANCTIONS_AS_OF,
    keyStore,
    chain,
    error,
    caps: {
      perTx: formatUsdc(MAX_TRANSFER_WEI),
      perHour: formatUsdc(HOUR_CAP_WEI),
      gasReserve: formatUsdc(GAS_RESERVE_WEI),
      spentThisHour: formatUsdc(hourSpent()),
    },
    desk: {
      address: desk.address,
      balance: formatUsdc(deskBal),
      balanceWei: deskBal.toString(),
      funded: deskBal > GAS_RESERVE_WEI,
    },
    receiver: {
      address: receiver.address,
      balance: formatUsdc(recvBal),
      balanceWei: recvBal.toString(),
    },
    settlements: recent,
    rules: [
      "EIP-1559 type-2 only. Chain id 5042002 is baked into the signature. Chain 5042 is refused.",
      "Empty calldata. Native USDC value transfer. No contract call.",
      "Destination cannot be zero, self, a precompile, an Arc system contract, or a static SDN address.",
      "Cap 1 USDC per transfer, 5 USDC per hour, 0.002 USDC held back for gas.",
      "A second operator, or the public explorer together with an RPC, must return the same receipt before the ledger is told the payment settled.",
      "Both private keys were created in this browser and never leave it. Only signed transactions are sent.",
    ],
  };
}

const ARC_RPC_LABEL = "https://rpc.testnet.arc.io";

export interface SendInput {
  to?: string;
  amount?: string;
  paymentId?: string | null;
  requestId?: string;
  from?: "desk" | "receiver";
  /** Operator confirmed the testnet notice. Required before any signature. */
  ack?: boolean;
}

export interface SendResult {
  ok: boolean;
  code?: string;
  error?: string;
  trace: TraceStep[];
  settlement?: SettlementRecord;
  replay?: boolean;
}

export function sendTestnet(input: SendInput): Promise<SendResult> {
  return lock(() => sendInner(input));
}

async function sendInner(input: SendInput): Promise<SendResult> {
  const trace: TraceStep[] = [];
  if (input.ack !== true) {
    step(trace, "fail", "Notice", "The testnet notice was not confirmed. Nothing was signed.");
    return {
      ok: false,
      code: "ACK_REQUIRED",
      error: "Confirm the testnet notice before a signature is created.",
      trace,
    };
  }
  const requestId = input.requestId?.slice(0, 80) || randomHex(8);
  const prior = byRequest.get(requestId);
  if (prior?.status === "success" && prior.corroborated) {
    step(trace, "ok", "Replay", "Same request id. No second transaction.");
    return { ok: true, replay: true, trace, settlement: prior };
  }
  if (prior?.txHash && prior.status === "success" && !prior.corroborated) {
    return reconfirm(prior, trace);
  }
  if (prior?.status === "reverted") {
    step(trace, "fail", "Replay", "This request id already reverted on chain. No second transaction.");
    return { ok: false, code: "REVERTED", error: "Transaction reverted", trace, settlement: prior, replay: true };
  }
  if (input.paymentId && byPayment.get(input.paymentId)) {
    const existing = byPayment.get(input.paymentId)!;
    step(trace, "ok", "Already settled", `Payment ${input.paymentId} already has ${existing.txHash}.`);
    return { ok: true, replay: true, trace, settlement: existing };
  }

  const { desk, receiver } = accounts();
  const source = input.from === "receiver" ? receiver : desk;
  const dest = (input.to ?? (source === desk ? receiver.address : desk.address)).trim();
  step(
    trace,
    "info",
    "Intent",
    `${source === desk ? "Desk" : "Receiver"} → ${dest} · ${input.amount ?? "0.01"} testnet USDC · chain ${ARC_TESTNET_CHAIN_ID}`,
  );

  let amountWei: bigint;
  try {
    amountWei = parseUsdc(input.amount ?? "0.01");
  } catch (e) {
    const detail = e instanceof Error ? e.message : "bad amount";
    step(trace, "fail", "Amount refused", detail);
    return { ok: false, code: "AMOUNT_NOT_REPRESENTABLE", error: detail, trace };
  }

  if (input.paymentId) {
    const linked = await db.payment.findUnique({ where: { id: input.paymentId } });
    if (!linked) {
      step(trace, "fail", "Payment", `No payment ${input.paymentId}. Nothing was signed.`);
      return { ok: false, code: "PAYMENT_NOT_FOUND", error: "Payment id is not in this desk.", trace };
    }
    const principal = BigInt(linked.amountMinor) * 10n ** 12n;
    if (principal !== amountWei) {
      const detail = `Payment ${input.paymentId} is ${formatUsdc(principal)} USDC. The transfer is ${formatUsdc(amountWei)}. They must match, or leave the payment id empty.`;
      step(trace, "fail", "Amount mismatch", detail);
      return { ok: false, code: "AMOUNT_MISMATCH", error: detail, trace };
    }
    if (linked.stage !== "APPROVED") {
      const detail = `Payment is ${String(linked.stage)}, not APPROVED. Approve it first, or send without a payment id. Nothing was signed.`;
      step(trace, "fail", "Not approved", detail);
      return { ok: false, code: "PAYMENT_NOT_APPROVED", error: detail, trace };
    }
  }

  const screened = reviewTransfer({
    chainId: ARC_TESTNET_CHAIN_ID,
    from: source.address,
    to: dest,
    amountWei,
    balanceWei: amountWei + GAS_RESERVE_WEI,
    data: "0x",
    spentThisHourWei: hourSpent(),
  });
  if (!screened.ok) {
    step(trace, "fail", screened.code, screened.detail);
    return { ok: false, code: screened.code, error: screened.detail, trace };
  }

  let balance: bigint;
  let primaryUrl: string;
  let client: PublicClient;
  try {
    const healthy = await healthyRpc();
    primaryUrl = healthy.url;
    client = healthy.client;
    const chainId = await client.getChainId();
    step(
      trace,
      chainId === ARC_TESTNET_CHAIN_ID ? "ok" : "fail",
      "Chain pin",
      `${primaryUrl} returned eth_chainId ${chainId}. Required ${ARC_TESTNET_CHAIN_ID}. Mainnet is not contacted.`,
    );
    if (chainId !== ARC_TESTNET_CHAIN_ID) {
      return { ok: false, code: "CHAIN_PIN", error: `RPC chain is ${chainId}`, trace };
    }
    balance = await client.getBalance({ address: source.address });
    step(trace, "info", "Balance", `${source.address} holds ${formatUsdc(balance)} testnet USDC`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "rpc failed";
    step(trace, "fail", "RPC", detail);
    return { ok: false, code: "RPC", error: detail, trace };
  }

  if (!isAddress(dest)) {
    step(trace, "fail", "Destination", "Not an EVM address.");
    return { ok: false, code: "INVALID_DESTINATION", error: "Not an EVM address.", trace };
  }

  const review = reviewTransfer({
    chainId: ARC_TESTNET_CHAIN_ID,
    from: source.address,
    to: dest,
    amountWei,
    balanceWei: balance,
    data: "0x",
    spentThisHourWei: hourSpent(),
  });
  if (!review.ok) {
    step(trace, "fail", review.code, review.detail);
    return { ok: false, code: review.code, error: review.detail, trace };
  }

  let gas: bigint;
  let maxFee: bigint;
  try {
    const block = await client.getBlock({ blockTag: "latest" });
    const base = block.baseFeePerGas ?? FEE_FLOOR;
    maxFee = base * 2n;
    if (maxFee < FEE_FLOOR) maxFee = FEE_FLOOR;
    if (maxFee > FEE_CEILING) {
      step(trace, "fail", "Fee ceiling", `Base fee implies maxFee ${maxFee} wei, above the ceiling.`);
      return { ok: false, code: "FEE_CEILING", error: "Base fee above ceiling", trace };
    }
    gas = await client.estimateGas({
      account: source.address,
      to: review.to as Hex,
      value: amountWei,
      data: "0x",
    });
    const reserve = gas * maxFee;
    if (balance < amountWei + reserve) {
      const detail = `Balance is ${formatUsdc(balance)} USDC. This send needs ${formatUsdc(amountWei)} plus ${formatUsdc(reserve)} at the current base fee. Nothing was signed.`;
      step(trace, "fail", "INSUFFICIENT_FUNDS", detail);
      return { ok: false, code: "INSUFFICIENT_FUNDS", error: detail, trace };
    }
    step(trace, "ok", "Simulation", `eth_estimateGas returned ${gas.toString()}. Worst-case gas is ${formatUsdc(reserve)} USDC. The key has not been used.`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "simulation failed";
    step(trace, "fail", "Simulation", detail.slice(0, 300));
    return { ok: false, code: "SIMULATION_FAILED", error: detail.slice(0, 300), trace };
  }
  step(trace, "ok", "Policy", "Native transfer, empty calldata, under the caps, destination allowed, sanctions screen clear.");

  const open = findInFlight(source.address, review.to, amountWei);
  if (open && open.id !== requestId) {
    const age = Date.now() - Date.parse(open.at);
    if (!open.corroborated || age < 15_000) {
      step(trace, "info", "In flight", `Same amount to the same address is already at ${open.txHash}. Not signing a second one.`);
      return reconfirm(open, trace);
    }
  }

  const wallet = createWalletClient({
    account: source,
    chain: arcTestnet,
    transport: http(primaryUrl, { timeout: 20_000, retryCount: 0 }),
  });
  try {
    const hash = await wallet.sendTransaction({
      account: source,
      chain: arcTestnet,
      to: review.to as Hex,
      value: amountWei,
      data: "0x",
      gas,
      type: "eip1559",
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: 0n,
    });
    step(trace, "ok", "Broadcast", `${primaryUrl} accepted ${hash}. Waiting for a receipt.`);
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 45_000, confirmations: 1 });
    const tx = await client.getTransaction({ hash });
    if (tx.value !== amountWei || tx.to?.toLowerCase() !== review.to) {
      step(trace, "fail", "Receipt mismatch", "The transaction body does not match the signed intent. The ledger was not updated.");
      return { ok: false, code: "RECEIPT_MISMATCH", error: "Transaction body diverged from the intent", trace };
    }
    const second = await corroborate(hash, primaryUrl);
    const providers = [primaryUrl];
    let corroborated = false;
    if (second) {
      const again = await second.client.getTransactionReceipt({ hash });
      const againTx = await second.client.getTransaction({ hash });
      const same =
        again.status === receipt.status &&
        again.blockNumber === receipt.blockNumber &&
        againTx.value === amountWei &&
        againTx.to?.toLowerCase() === review.to &&
        againTx.from.toLowerCase() === source.address.toLowerCase();
      if (!same) {
        step(trace, "fail", "Providers disagree", `${second.url} did not return the same receipt as ${primaryUrl}. The ledger was not updated.`);
        return { ok: false, code: "PROVIDER_DIVERGENCE", error: "Two RPCs disagree", trace };
      }
      providers.push(second.url);
      corroborated = true;
      step(trace, "ok", "Second provider", `${second.url} returned the same receipt in block ${again.blockNumber.toString()}.`);
    } else {
      const witnesses = await collectWitnesses(hash);
      const summary = summariseWitnesses(witnesses);
      const sameBody =
        summary.corroborated &&
        summary.status === "success" &&
        summary.blockNumber === receipt.blockNumber.toString() &&
        summary.value === amountWei.toString() &&
        (summary.to ?? "").toLowerCase() === review.to &&
        (summary.from ?? "").toLowerCase() === source.address.toLowerCase();
      if (sameBody) {
        providers.push("https://explorer.testnet.arc.io");
        corroborated = true;
        step(trace, "ok", "Explorer agrees", `The public explorer and an RPC both show block ${summary.blockNumber}.`);
      } else {
        step(trace, "info", "Second source", "No other operator or the explorer has agreed yet. The hash is saved. Retrying will not sign again.");
      }
    }
    const gasWei = receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n);
    const gasMinor = Number(gasWei / 10n ** 12n);
    const rec: SettlementRecord = {
      id: requestId,
      at: new Date().toISOString(),
      from: source.address,
      to: review.to,
      amount: formatUsdc(amountWei),
      amountWei: amountWei.toString(),
      txHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
      gasUsdc: formatUsdc(gasWei),
      paymentId: input.paymentId ?? null,
      attached: false,
      explorerUrl: `${ARC_EXPLORER}/tx/${hash}`,
      mirrorUrl: `https://testnet.arcscan.app/tx/${hash}`,
      providers,
      corroborated,
    };
    if (receipt.status !== "success") {
      step(trace, "fail", "Reverted", `Included in block ${rec.blockNumber} but the receipt status is reverted. The ledger was not updated.`);
      remember(rec, 0n, requestId, null);
      statusCache = null;
      return { ok: false, code: "REVERTED", error: "Transaction reverted", trace, settlement: rec };
    }
    if (!corroborated) {
      step(trace, "fail", "Not corroborated", "The transfer is on the first provider, but a second source has not agreed. The ledger was not updated. Retry uses the same hash and does not sign again.");
      remember(rec, 0n, requestId, null);
      statusCache = null;
      return { ok: false, code: "UNCORROBORATED", error: "Waiting for a second source", trace, settlement: rec };
    }
    step(trace, "ok", "Receipt", `Success in block ${rec.blockNumber}. Gas ${rec.gasUsdc} USDC (${rec.gasUsed} gas). Value ${tx.value.toString()} wei.`);
    if (input.paymentId) {
      rec.attached = await attachPayment(input.paymentId, hash, gasMinor, trace);
    }
    remember(rec, amountWei, requestId, input.paymentId);
    statusCache = null;
    return { ok: true, trace, settlement: rec };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "broadcast failed";
    step(trace, "fail", "Broadcast failed", detail.slice(0, 400));
    return { ok: false, code: "BROADCAST_FAILED", error: detail.slice(0, 400), trace };
  }
}

async function reconfirm(prior: SettlementRecord, trace: TraceStep[]): Promise<SendResult> {
  step(trace, "info", "Recheck", `Already broadcast ${prior.txHash}. Asking a second source before any new signature.`);
  try {
    const second = await corroborate(prior.txHash as Hex, prior.providers[0] ?? "");
    let agreedUrl = second?.url;
    let blockNumber = prior.blockNumber;
    let status = prior.status;
    if (second) {
      const receipt = await second.client.getTransactionReceipt({ hash: prior.txHash as Hex });
      blockNumber = receipt.blockNumber.toString();
      status = receipt.status;
    } else {
      const witnesses = await collectWitnesses(prior.txHash as Hex);
      const summary = summariseWitnesses(witnesses);
      if (summary.corroborated && summary.blockNumber) {
        agreedUrl = "https://explorer.testnet.arc.io";
        blockNumber = summary.blockNumber;
        status = summary.status === "reverted" ? "reverted" : "success";
      }
    }
    if (!agreedUrl) {
      step(trace, "fail", "Still one source", "A second operator has not returned this receipt yet. Nothing new was signed.");
      return { ok: false, code: "UNCORROBORATED", error: "Waiting for a second source", trace, settlement: prior };
    }
    if (status !== "success") {
      step(trace, "fail", "Reverted", "A second source shows a reverted receipt. The ledger was not updated.");
      return { ok: false, code: "REVERTED", error: "Transaction reverted", trace, settlement: prior };
    }
    const next: SettlementRecord = {
      ...prior,
      corroborated: true,
      providers: [...new Set([...(prior.providers ?? []), agreedUrl])],
      blockNumber,
      status: "success",
    };
    byRequest.set(prior.id, next);
    if (prior.paymentId) byPayment.set(prior.paymentId, next);
    appendLog(next);
    step(trace, "ok", "Second source", `${agreedUrl} confirmed block ${next.blockNumber}.`);
    statusCache = null;
    return { ok: true, replay: true, trace, settlement: next };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "recheck failed";
    step(trace, "fail", "Recheck failed", detail.slice(0, 300));
    return { ok: false, code: "UNCORROBORATED", error: detail.slice(0, 300), trace, settlement: prior };
  }
}

async function attachPayment(paymentId: string, txHash: string, gasMinor: number, trace: TraceStep[]): Promise<boolean> {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p) {
    step(trace, "info", "Ledger", `No rehearsal payment ${paymentId}. The chain transfer still stands.`);
    return false;
  }
  if (p.stage !== "APPROVED") {
    step(trace, "info", "Ledger", `Payment is ${String(p.stage)}, not APPROVED, so the journal was left alone. The chain transfer still stands.`);
    return false;
  }
  await db.payment.update({ where: { id: paymentId }, data: { txHash, live: true, gasMinor } });
  await applyEvent(paymentId, "broadcast", { txHash, live: true });
  await applyEvent(paymentId, "onchain", { txHash, live: true });
  await applyEvent(paymentId, "confirm", { txHash, gasMinor, live: true });
  step(trace, "ok", "Ledger", `Payment ${paymentId} marked SETTLED against the corroborated receipt.`);
  return true;
}

export async function sweepReceiver(requestId?: string, ack?: boolean): Promise<SendResult> {
  const { desk, receiver } = accounts();
  const { client } = await healthyRpc();
  const chainId = await client.getChainId();
  if (chainId !== ARC_TESTNET_CHAIN_ID) {
    return {
      ok: false,
      code: "CHAIN_PIN",
      error: `RPC chain is ${chainId}`,
      trace: [],
    };
  }
  const balance = await client.getBalance({ address: receiver.address });
  const planned = sweepAmount(balance, hourSpent());
  if (!planned.ok) {
    return { ok: false, code: planned.code, error: planned.detail, trace: [] };
  }
  return sendTestnet({
    from: "receiver",
    to: desk.address,
    amount: formatUsdc(planned.amountWei),
    requestId: requestId ?? `sweep-${Date.now()}`,
    ack,
  });
}
