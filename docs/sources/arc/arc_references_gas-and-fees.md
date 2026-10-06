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

# Gas and fees

> Runtime parameters for Arc gas pricing, including base fee bounds, EWMA smoothing, and best practices for submitting transactions.

Arc denominates all transaction fees in
[USDC](/arc/concepts/stablecoin-native-model), the native gas token. The fee
market uses an [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) pricing model
combined with exponentially weighted moving average (EWMA) smoothing -- a
technique that calculates the base fee from a weighted running average of recent
block utilization, giving more weight to recent blocks and less to older ones.
This produces stable, predictable gas costs.

For the mechanism design behind these parameters, see
[Stable fee design](/arc/concepts/stable-fee-design).

## Fee parameters

| Parameter | Value | Notes |
| :- | :- | :- |
| **Gas unit** | USDC (18 decimals) | Native gas accounting precision |
| **Pricing model** | EIP-1559 + EWMA smoothing | Replaces per-block recalculation with a moving average |
| **Base fee target** | \~\$0.001 per ERC-20 transfer | Design-time target under normal load |
| **Minimum base fee (testnet)** | 20 Gwei | Floor enforced by the protocol |
| **Maximum base fee** | 20,000 Gwei | Hard ceiling that bounds worst-case cost |
| **Gas throughput** | 30M gas/block (\~60M gas/sec at 0.5 s block time) | Protocol-level capacity limit |
| **Smoothing method** | EWMA of block utilization | Short spikes do not propagate into sudden fee jumps |

The EWMA smoothing window calculates each new base fee as a weighted blend of
the previous base fee and the latest block's gas utilization ratio. Because
older blocks carry exponentially decreasing weight, short traffic spikes raise
the fee only slightly, and the base fee returns to its target quickly once
utilization normalizes.

<Info>
  The 18-decimal precision in the preceding table applies to Arc's native gas
  accounting. USDC on Arc also provides a standard [ERC-20 interface with 6
  decimals](/arc/references/evm-differences#usdc-as-the-native-gas-token) for
  application-level transfers. These are not two separate tokens -- they share
  the same underlying balance. See [Contract
  addresses](/arc/references/contract-addresses#usdc) for the ERC-20 address.
</Info>

## Submitting transactions

Follow these practices to ensure timely transaction inclusion on Arc.

### Set an adequate max fee

Set `maxFeePerGas` to at least **20 Gwei**. Transactions submitted under this
floor may remain pending indefinitely or fail outright.

```typescript theme={null}
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.io");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const tx = await wallet.sendTransaction({
  to: recipient,
  value: ethers.parseUnits("1", 6), // 1 USDC via native send
  maxFeePerGas: ethers.parseUnits("20", "gwei"),
});
```

Set `maxPriorityFeePerGas` (the EIP-1559 tip) to incentivize sequencer
inclusion. A value of **0 Gwei** is accepted, but a small tip (for example, **1
Gwei**) can improve inclusion time during high-utilization periods.

### Fetch the current base fee

Query the Arc RPC before submitting to get the latest fee data. Two standard
methods are available:

| Method | Returns | Use case |
| :- | :- | :- |
| `eth_gasPrice` | Suggested gas price as a single value | Quick estimation for simple transactions |
| `eth_feeHistory` | Base fee and priority fee history over recent blocks | Fine-grained estimation when you need historical context |

```typescript theme={null}
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.io");

// Fetch current gas price
// Returns: hex string (e.g., "0x4a817c800" = 20 Gwei)
const gasPrice: string = await provider.send("eth_gasPrice", []);

// Fetch fee history for the last 5 blocks
// Returns: { baseFeePerGas: string[], gasUsedRatio: number[], reward: string[][] }
const feeHistory = await provider.send("eth_feeHistory", [
  "0x5", // block count
  "latest", // newest block
  [25, 50, 75], // percentiles
]);
```

Arc publishes the next block's base fee in the parent header's `extra_data`
field as an 8-byte big-endian value, so you can read it directly from the block
header.

### Display fees in USDC

Because Arc denominates gas in USDC, surface fee estimates to users in dollar
terms rather than raw Gwei. This avoids confusion and aligns with the
stablecoin-native model.

## Common errors

| Error | Cause | Resolution |
| :- | :- | :- |
| `transaction underpriced` | `maxFeePerGas` is lower than the 20 Gwei minimum base fee floor | Increase `maxFeePerGas` to at least `ethers.parseUnits("20", "gwei")` and resubmit |
| `intrinsic gas too low` | Gas limit is lower than the intrinsic cost of the transaction | Set the gas limit to at least 21,000 for simple transfers; use `eth_estimateGas` for contract calls |
| `insufficient funds for gas * price + value` | The sending account's USDC balance cannot cover both the transfer value and the gas fee | Fund the account with enough USDC to cover the total cost (value + maxFeePerGas x gasLimit) |

## Monitoring

View real-time gas metrics and recent averages using the
[Arc Gas Tracker](https://explorer.testnet.arc.io/gas-tracker). The tracker
displays current base fee, historical trends, and per-block utilization.

<Info>
  The parameters on this page reflect the current Arc Testnet configuration.
  Values such as the minimum base fee, maximum base fee, and throughput limits
  may change before mainnet launch.
</Info>
