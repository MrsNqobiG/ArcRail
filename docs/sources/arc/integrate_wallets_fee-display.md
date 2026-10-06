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

# How to: Display Transaction Fees

> Fetch, calculate, and display transaction fees as USD amounts in your wallet UI.

Arc uses USDC as its native gas token, so fees are inherently denominated in
USD. The `eth_gasPrice` and `eth_feeHistory` RPCs return values in USDC wei (18
decimals). The EWMA fee smoothing model keeps fees predictable—dramatic spikes
are unlikely. Display fees as `$X.XX` (or `~$0.01`), never as "Gwei" or "ETH."

## Prerequisites

Before you begin:

* You have an RPC endpoint for Arc.
* You are using an EIP-1559-compatible library (viem, ethers.js, or equivalent).
* You understand that Arc's native currency is USDC.

## Steps

### Step 1. Fetch the current gas price

Use `eth_gasPrice` for a single value or `eth_feeHistory` for historical base
fees and priority fee percentiles.

```typescript theme={null}
import { createPublicClient, http, formatUnits } from "viem";
import { arc } from "viem/chains";

const client = createPublicClient({
  chain: arc,
  transport: http("https://rpc.arc.circle.com"),
});

// Simple: current gas price in USDC wei
const gasPrice = await client.getGasPrice();
console.log("Gas price (wei):", gasPrice);

// Detailed: recent base fee history
const feeHistory = await client.getFeeHistory({
  blockCount: 4,
  rewardPercentiles: [25, 50, 75],
});
console.log("Latest base fee (wei):", feeHistory.baseFeePerGas.at(-1));
```

### Step 2. Estimate gas for the transaction

Use `eth_estimateGas` to determine how much gas your transaction requires.

```typescript theme={null}
// Native USDC transfer: ~21,000 gas
const simpleTransferGas = 21_000n;

// ERC-20 token transfer or contract call: use estimateGas
const contractGas = await client.estimateGas({
  account: "0xYourAddress",
  to: "0xContractAddress",
  data: encodedCalldata,
});
```

Typical gas costs:

| Transaction type | Approximate gas |
| - | - |
| Native USDC send | 21,000 |
| ERC-20 transfer | \~65,000 |
| Contract interaction | Varies—always estimate |

### Step 3. Build EIP-1559 fee parameters

Arc supports EIP-1559 transactions. Set `maxFeePerGas` and
`maxPriorityFeePerGas`:

```typescript theme={null}
const latestBlock = await client.getBlock();
const baseFee = latestBlock.baseFeePerGas!;

// 2x base fee is generous—Arc's EWMA smoothing keeps fees stable
const maxFeePerGas = baseFee * 2n;

// Priority fee of 0 is acceptable on Arc (validators don't require tips)
const maxPriorityFeePerGas = 0n;
```

<Warning>
  Set `maxFeePerGas` to at least 20 Gwei. Arc enforces a hard floor:
  transactions with `maxFeePerGas` lower than 20 Gwei are rejected with no error
  receipt. The EWMA smoothing model keeps fees gradual and predictable.
</Warning>

### Step 4. Calculate the maximum fee in USD

Multiply the gas limit by `maxFeePerGas`, then convert from 18-decimal USDC wei
to a dollar amount.

```typescript theme={null}
function calculateMaxFeeUsd(gasLimit: bigint, maxFeePerGas: bigint): string {
  const maxCostWei = gasLimit * maxFeePerGas;
  // USDC has 18 decimals as the native gas token on Arc
  // Since 1 USDC = $1, the numeric value IS the USD cost
  const usdCost = formatUnits(maxCostWei, 18);
  return usdCost;
}

// Example: simple transfer
const maxFee = calculateMaxFeeUsd(21_000n, maxFeePerGas);
console.log(`Max fee: $${Number(maxFee).toFixed(6)}`);
```

### Step 5. Format fees for display

Show fees as a dollar amount. Use `~` to indicate the value is an estimate.

```typescript theme={null}
function formatFeeDisplay(gasLimit: bigint, maxFeePerGas: bigint): string {
  const maxCostWei = gasLimit * maxFeePerGas;
  const usdValue = Number(formatUnits(maxCostWei, 18));

  if (usdValue < 0.01) {
    return "< $0.01";
  }
  return `~$${usdValue.toFixed(2)}`;
}
```

<Warning>
  Standard libraries like ethers.js and viem label the native currency as "ETH"
  by default. You must override this in your UI. Displaying "0.00042 ETH"
  instead of "\~\$0.01" confuses users and misrepresents the cost.
</Warning>

## Worked examples

### Simple USDC transfer

```typescript theme={null}
// Given: base fee = 20 Gwei (minimum), gas limit = 21,000
const baseFee = 20_000_000_000n; // 20 Gwei in wei
const gasLimit = 21_000n;
const maxFeePerGas = baseFee * 2n; // 40 Gwei

const maxCostWei = gasLimit * maxFeePerGas;
// 21,000 * 40,000,000,000 = 840,000,000,000,000 wei
// = 0.00000084 USDC = $0.00000084

const display = formatFeeDisplay(gasLimit, maxFeePerGas);
// Output: "< $0.01"
```

### Contract interaction

```typescript theme={null}
// Given: base fee = 500,000 Gwei (0.0005 USDC), gas limit = 65,000
const baseFee = 500_000_000_000_000n; // 500,000 Gwei in wei
const gasLimit = 65_000n;
const maxFeePerGas = baseFee * 2n; // 1,000,000 Gwei

const maxCostWei = gasLimit * maxFeePerGas;
// 65,000 * 1,000,000,000,000,000 = 65,000,000,000,000,000,000 wei
// = 0.065 USDC = $0.065

const display = formatFeeDisplay(gasLimit, maxFeePerGas);
// Output: "~$0.07"
```

<Tip>
  Users are only charged `gasUsed * effectiveGasPrice`. The difference between
  `maxFeePerGas` and the actual effective gas price is refunded. It's safe to
  show the maximum estimate in your UI with language like "Max fee" or "Up to."
</Tip>

## See also

* [Transaction lifecycle](/integrate/wallets/transaction-lifecycle)
