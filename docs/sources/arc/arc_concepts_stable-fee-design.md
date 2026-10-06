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

# Stable fee design

> Arc's fee market uses EWMA-smoothed base fees denominated in USDC and minimal priority fees, keeping transaction costs predictable and resistant to short-term demand spikes.

Arc's fee market builds on [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559)
but replaces per-block base fee recalculation with an exponentially weighted
moving average (EWMA) of block utilization. This smoothing mechanism ensures
that short demand spikes do not propagate into sudden fee jumps, keeping
transaction costs stable and easy to estimate. The base fee floor targets
approximately \$0.001 per ERC-20 transfer under normal conditions.

For why Arc uses USDC as its gas token, see
[Stablecoin native model](/arc/concepts/stablecoin-native-model). For runtime
parameters and RPC calls, see [Gas and fees](/arc/references/gas-and-fees). Any
relayer, paymaster, or funded wallet account must hold USDC, the native token of
Arc.

## How EWMA fee adjustment works

Standard EIP-1559 recalculates the base fee every block based on whether the
previous block exceeded or fell short of a target gas utilization. This approach
can produce sharp fee swings when a single block fills quickly.

Arc replaces this per-block step function with an EWMA over a configurable
smoothing window. Instead of reacting fully to one block's utilization, the
protocol blends recent utilization into a running average. The base fee then
adjusts proportionally to the smoothed signal rather than the raw per-block
value.

```text theme={null}
utilization_ewma(n) = alpha * block_utilization(n) + (1 - alpha) * utilization_ewma(n - 1)

base_fee(n) = adjust(base_fee(n - 1), utilization_ewma(n - 1), target_utilization)
# adjust() scales base_fee proportionally to (utilization_ewma / target_utilization),
# clamped to [minimum_base_fee, maximum_base_fee]
```

* `alpha` controls how quickly the average responds to new data. A smaller alpha
  means more smoothing and slower reaction to spikes.
* `target_utilization` is the equilibrium point the protocol steers toward. When
  the EWMA exceeds the target, the base fee rises; when it falls under the
  target, the base fee decreases.

The result is a fee curve that trends toward equilibrium gradually, making cost
estimation straightforward even during bursts of activity.

## Key parameters

| Parameter | Value | Notes |
| :- | :- | :- |
| **Base fee floor** | \~\$0.001 per ERC-20 transfer | Design-time target under normal load |
| **Testnet minimum base fee** | 20 Gwei | Transactions under this threshold are rejected from the mempool |
| **Maximum base fee** | 20,000 Gwei | Hard ceiling that bounds worst-case cost |
| **Gas throughput** | 30M gas/block (\~60M gas/sec at 0.5 s block time) | Protocol-level capacity limit |
| **Smoothing method** | EWMA of block utilization | Replaces EIP-1559 per-block recalculation |

<Info>
  These parameters reflect the current testnet configuration and may be adjusted
  before mainnet launch. See [Gas and fees](/arc/references/gas-and-fees) for
  the latest runtime values.
</Info>

## Priority fees

Like standard EIP-1559, Arc transactions include a priority fee (tip) in
addition to the base fee. The tip incentivizes the sequencer to include a
transaction promptly. Under normal network conditions, a minimal or zero tip is
sufficient because the base fee alone covers inclusion.

Set `maxPriorityFeePerGas` to `0` for most transactions. During periods of
sustained congestion, a small tip can signal higher urgency. Query
`eth_maxPriorityFeePerGas` on the Arc RPC for a recommended value.

Unlike standard EIP-1559, Arc doesn't burn the base fee. Both the base fee and
the priority fee are credited to the block's beneficiary.

## Why smoothing matters

Without smoothing, a single high-utilization block can double the base fee
instantly, and a series of empty blocks can drop it just as fast. This
volatility forces developers to build retry logic, fee-bumping heuristics, and
complex estimation strategies.

With EWMA smoothing:

* **Gradual adjustment.** Fees move in small increments, so a short burst of
  transactions does not cause a sudden price shock.
* **Bounded range.** The hard ceiling at 20,000 Gwei ensures that even sustained
  congestion cannot push fees to extreme levels.
* **Simple estimation.** You can call `eth_gasPrice`, `eth_feeHistory`, or
  `eth_maxPriorityFeePerGas` on the Arc RPC and trust that the returned values
  will remain accurate for a reasonable submission window.

## Developer benefits

Building on Arc's stable fee design simplifies cost management and removes
common integration challenges.

<CardGroup cols={2}>
  <Card title="Predictable costs" icon="dollar-sign">
    ERC-20 transfers target \~\$0.001, and EWMA smoothing keeps fees stable. You
    can quote costs to users with confidence.
  </Card>

  <Card title="Congestion resistant" icon="gauge-high">
    Short-term demand spikes are absorbed by the smoothing window, so fees don't
    surprise your users during traffic bursts.
  </Card>

  <Card title="Enterprise ready" icon="building">
    Dollar-denominated, bounded fees mean transaction costs map directly to a
    known USDC amount. No post-hoc conversion is needed for cost tracking or
    reconciliation.
  </Card>

  <Card title="Flexible fee payment" icon="coins">
    Sponsor transactions on behalf of users through [account
    abstraction](/arc/tools/account-abstraction) or accept fees in multiple
    stablecoins without custom workarounds.
  </Card>
</CardGroup>
