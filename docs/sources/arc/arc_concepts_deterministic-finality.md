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

# Deterministic finality and settlement

> Arc's deterministic finality delivers irreversible transaction settlement in under one second.

Arc provides deterministic finality: every transaction is either unconfirmed or
final, with no intermediate state. This guarantee comes from the network's
[consensus layer](/arc/concepts/consensus-layer), which uses a Byzantine Fault
Tolerant (BFT) consensus protocol—once more than two-thirds of validators sign
off on a block, that block is irreversible. Every transaction in a committed
block is immediately and irreversibly settled. There are no confirmation
windows, no reorganization risk, and no probabilistic uncertainty.

## Finality comparison

Arc's [Malachite BFT consensus](/arc/concepts/consensus-layer), a Byzantine
Fault Tolerant protocol, finalizes blocks in under one second. This is orders of
magnitude faster than the finality guarantees on other networks:

| Network | Finality | Notes |
| :- | :- | :- |
| **Arc** | \<1 s | Deterministic. Final on commit. |
| **Ethereum L1** | 12-15 min | Two epochs of attestations required for finality. |
| **Typical L2 rollup** | \~7 days | Withdrawal finality depends on the challenge or proof window to L1. |

## Use cases

Sub-second deterministic finality enables use cases that are impractical on
slower networks:

| Use case | How finality helps |
| :- | :- |
| Point-of-sale payments | A merchant can confirm payment and release goods without waiting for additional block confirmations. |
| Cross-border settlement | Transfers between counterparties finalize instantly, eliminating the settlement windows that introduce counterparty risk. |
| Institutional clearing | Trades and margin calls settle with immediate certainty, matching the expectations of traditional financial infrastructure. |
| Composable workflows | Multi-step onchain flows (such as swap-then-bridge) execute sequentially without polling or confirmation delays between steps. |

## Developer benefits

Deterministic finality simplifies application design by removing the edge cases
that probabilistic chains force you to handle.

<CardGroup cols={2}>
  <Card title="No reorg handling" icon="shield-check">
    You don't need retry logic, rollback mechanisms, or confirmation-count
    thresholds. A confirmed transaction stays confirmed.
  </Card>

  <Card title="Immediate offchain effects" icon="bolt">
    Safely trigger downstream actions (webhooks, database writes, notifications)
    once a block is committed, without waiting for additional confirmations.
  </Card>

  <Card title="Simplified state management" icon="toggle-on">
    Your application only needs to track two transaction states—unconfirmed and
    final—rather than tracking a sliding confirmation window.
  </Card>

  <Card title="Enterprise compliance" icon="file-certificate">
    Settlement finality is auditable and provable, meeting the assurance
    requirements of regulated financial institutions.
  </Card>
</CardGroup>
