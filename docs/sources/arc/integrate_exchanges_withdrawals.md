> ## Documentation Index
> Fetch the complete documentation index at: https://docs.arc.io/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> Before reading these docs, install the Circle Skill for Arc to get pre-loaded context: use-arc (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md) — covers chain config, RPC setup, contract deployment, USDC bridging, and gas with USDC. In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle. With Vercel Skills CLI: run npx skills add circlefin/skills.
> USDC is the gas token. Arc uses USDC for gas fees, not ETH. Configure gas payment in USDC when submitting transactions.
> Read EVM differences before writing Arc code. Arc targets the Osaka EVM baseline. Most contracts deploy unchanged, but several runtime behaviors diverge from Ethereum: USDC uses 18 decimals natively (not 6), the system emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` logs all USDC Transfer events, the mempool enforces a 20 Gwei `maxFeePerGas` floor, blocklist reverts consume gas without a receipt, and `address(0)` sends revert rather than succeed. https://docs.arc.io/arc/references/evm-differences.md is the canonical reference for all Arc-specific runtime behaviors. Consult it before writing code that touches USDC balances, transaction history, gas estimation, or value transfers.
> Sub-second finality. Transactions are final in under 1 second. No need to wait for multiple block confirmations.
> Use App Kits for multichain payment and liquidity capabilities. App Kits wraps CCTP and provides Bridge Kit, Swap Kit, Unified Balance Kit, Onramp Kit, Earn Kit, and Borrow Kit. Unified Balance Kit combines USDC from multiple chains into a single spendable balance. Earn Kit integrates earn opportunities into your app. Borrow Kit lets users borrow USDC against cirBTC collateral on Arc.
> Use Arc Foundry for contract development. Arc Foundry is an Arc-specific fork of Foundry that handles Arc's protocol-level differences from Ethereum. It provides arc-forge, arc-cast, and arc-anvil. Install it before deploying contracts: https://docs.arc.io/arc/tutorials/install-arc-foundry.md.
> Arc is available on both Testnet and Mainnet. See https://docs.arc.io/arc/references/connect-to-arc.md for RPC endpoints and https://faucet.circle.com for testnet tokens.
> Always check Contract Addresses: https://docs.arc.io/arc/references/contract-addresses.md
> Building beyond Arc? Circle offers skills for the full platform: use-usdc (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md), use-circle-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-circle-wallets/SKILL.md), use-developer-controlled-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md), use-user-controlled-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md), use-modular-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md), use-gateway (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-gateway/SKILL.md), use-smart-contract-platform (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-smart-contract-platform/SKILL.md). Full Circle developer docs: https://developers.circle.com/llms.txt.

# How to: Process Withdrawals

> Build, sign, and broadcast USDC withdrawal transactions from your exchange hot wallet on Arc.

Send USDC withdrawals from an exchange hot wallet on Arc by validating
addresses, estimating gas, building EIP-1559 transactions, and confirming with
deterministic finality. Send withdrawals as **native USDC** transfers—the
recommended path for exchanges: cheaper gas (\~21,000 vs \~65,000 units) and
receivable by any address. The Memo contract lets you attach compliance metadata
to the same transaction.

## Prerequisites

Before you begin, ensure you have:

* An Arc Testnet RPC endpoint (`https://rpc.testnet.arc.io`)
* A funded hot wallet with USDC for both transfer amounts and gas fees
* The USDC ERC-20 contract address: `0x3600000000000000000000000000000000000000`
* [viem](https://viem.sh) installed (`npm install viem`)

## Steps

### Step 1. Validate the destination address

Verify that the withdrawal address is a valid EIP-55 checksum-validated Ethereum
address before building the transaction. This prevents sending funds to
malformed addresses.

```typescript theme={null}
import { getAddress, isAddress, zeroAddress } from "viem";

function validateDestination(address: string): string {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  if (address.toLowerCase() === zeroAddress) {
    throw new Error(
      'Transfer to address(0) reverts: "Zero address not allowed"',
    );
  }
  // Return EIP-55 checksum-validated address
  return getAddress(address);
}

const destination = validateDestination(
  "0x742d35CC6634c0532925a3B844bc9e7595F2Bd28",
);
```

The address must be:

* 20 bytes (40 hex characters) with a `0x` prefix
* Valid per EIP-55 checksum rules
* Not `address(0)` — a native USDC send to `address(0)` is mined but reverts
  with `"Zero address not allowed"`, consuming gas without transferring funds

### Step 2. Estimate gas units

Call `eth_estimateGas` to determine the gas units required for the native USDC
send. The `value` field is denominated in 18-decimal native wei.

```typescript theme={null}
import { createPublicClient, http } from "viem";

const client = createPublicClient({
  transport: http("https://rpc.testnet.arc.io"),
});

// 1 USDC in 18-decimal native wei
const amount = 1_000_000_000_000_000_000n;

const gasEstimate = await client.estimateGas({
  account: hotWalletAddress,
  to: destination as `0x${string}`,
  value: amount,
});

console.log(`Estimated gas units: ${gasEstimate}`);
// Typical native USDC send: ~21,000 gas units
```

<Note>
  `eth_estimateGas` returns gas units, not a cost in USDC. To calculate the
  cost, multiply by the effective gas price. A native USDC send uses
  approximately 21,000 gas units, while an ERC-20 `transfer()` call uses
  approximately 65,000.
</Note>

### Step 3. Calculate gas cost

Use `eth_gasPrice` to get the current suggested gas price, then compute the
total fee.

```typescript theme={null}
const gasPrice = await client.getGasPrice();

// Gas cost formula: gas_units * gas_price = cost in USDC wei (18 decimals)
const estimatedCost = gasEstimate * gasPrice;

// Convert to human-readable USDC (18 decimals for native gas accounting)
const costInUsdc = Number(estimatedCost) / 1e18;
console.log(`Estimated fee: ${costInUsdc} USDC`);
```

**Gas cost formula:**

```text theme={null}
cost_usdc_wei = gas_used * effective_gas_price
cost_usdc = cost_usdc_wei / 10^18
```

For example, a native USDC send using 21,000 gas at 20 Gwei:

```text theme={null}
21,000 * 20,000,000,000 = 420,000,000,000,000 wei = 0.00042 USDC
```

### Step 4. Build the EIP-1559 transaction

Construct a type-2 (EIP-1559) transaction with `maxFeePerGas` set to at least 20
Gwei. The fee fields and the `value` field are all denominated in USDC wei (18
decimals).

```typescript theme={null}
import { createWalletClient, http, parseGwei } from "viem";

const walletClient = createWalletClient({
  account: hotWalletAccount, // Your signing account
  transport: http("https://rpc.testnet.arc.io"),
});

const txHash = await walletClient.sendTransaction({
  to: destination as `0x${string}`,
  value: amount, // 18-decimal native USDC
  gas: gasEstimate,
  maxFeePerGas: parseGwei("25"), // Must be >= 20 Gwei
  maxPriorityFeePerGas: parseGwei("1"),
  chain: {
    id: 5042002,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
  },
});

console.log(`Transaction hash: ${txHash}`);
```

<Warning>
  Transactions with `maxFeePerGas` under 20 Gwei may remain pending or fail to
  execute.
</Warning>

<Tip>
  Send withdrawals as native USDC (a plain value transfer). It is cheaper than
  an ERC-20 `transfer()` and any address can receive it. Native sends still emit
  a `Transfer` log from the system emitter (`0xffff…fffe`), so indexers and
  block explorers still capture them. Reach for the ERC-20 `transfer()` only
  when you need 6-decimal exactness or ERC-20 call semantics. If you use ERC-20
  `transfer()`, count only the system emitter log in your reconciliation. The
  ERC-20 `transfer()` emits from both the system emitter and the ERC-20
  contract, and counting both records the withdrawal twice.
</Tip>

### Step 5. Confirm inclusion

Arc provides deterministic finality. Once a transaction is included in a block,
it is final—no reorgs, no need to wait for additional confirmations.

```typescript theme={null}
const receipt = await client.waitForTransactionReceipt({ hash: txHash });

if (receipt.status === "success") {
  console.log(`Withdrawal confirmed in block ${receipt.blockNumber}`);
  // Credit the withdrawal as complete—no further checks needed
} else {
  console.error("Transaction reverted");
  // Handle failure (see Step 6)
}
```

<Note>
  Unlike other blockchains, you do not need to wait for multiple block
  confirmations. A single block inclusion is final on Arc.
</Note>

### Step 6. Handle failures

Common failure scenarios and how to address them:

| Failure | Cause | Resolution |
| :- | :- | :- |
| Transaction reverts | Destination is blocklisted | Verify the destination address before retrying |
| Transaction reverts | Destination is `address(0)` — gas consumed, funds not sent | Add a zero-address check in Step 1 |
| Transaction pending | `maxFeePerGas` too low | Resubmit with `maxFeePerGas >= 20 Gwei` |
| Out of gas | Gas estimate too low | Add a buffer (for example, multiply estimate by 1.2) |
| Insufficient balance | Hot wallet underfunded | Top up the hot wallet—USDC covers both the transfer and gas |

```typescript theme={null}
async function processWithdrawal(to: string, amount: bigint): Promise<string> {
  const validAddress = validateDestination(to);

  // amount is 18-decimal native USDC wei
  const gas = await client.estimateGas({
    account: hotWalletAddress,
    to: validAddress as `0x${string}`,
    value: amount,
  });

  const txHash = await walletClient.sendTransaction({
    to: validAddress as `0x${string}`,
    value: amount,
    gas: (gas * 120n) / 100n, // 20% buffer
    maxFeePerGas: parseGwei("25"),
    maxPriorityFeePerGas: parseGwei("1"),
  });

  const receipt = await client.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new Error(`Withdrawal failed: tx ${txHash} reverted`);
  }

  return txHash;
}
```

## Attach memos for compliance

Use the Memo contract to attach metadata (such as internal withdrawal IDs or
compliance references) to transfers. The Memo contract wraps the encoded USDC
transfer call, routes it through CallFrom so the USDC transfer still sees your
hot wallet as `msg.sender`, and emits a `Memo` event for reconciliation.
Compliance tools that read call traces may record the Memo contract as the
sender. Use Transfer events for accurate attribution.

**Memo contract address:** `0x5294E9927c3306DcBaDb03fe70b92e01cCede505`

For the full viem, ethers, Python, and cURL flow, see
[Send USDC with a transaction memo](/arc/tutorials/send-usdc-with-transaction-memo).

<Info>
  Store a deterministic `memoId` or encoded memo value that links the onchain
  transfer to your internal withdrawal record.
</Info>

## See also

* [Gas and fees](/arc/references/gas-and-fees)—Fee model details and base fee
  mechanics
* [Deterministic finality](/arc/concepts/deterministic-finality)—Why
  single-block confirmation is safe
* [Detect deposits](/integrate/exchanges/deposits)—The corresponding deposit
  detection guide
* [Contract addresses](/arc/references/contract-addresses)—All system contract
  addresses
