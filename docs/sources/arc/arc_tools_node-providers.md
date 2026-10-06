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

# Node providers

> Node providers for reliable RPC access, transaction submission, and data queries on Arc.

Connect to the Arc network through third-party RPC infrastructure partners
listed below. Each provider offers HTTP and WebSocket endpoints for submitting
transactions, querying blockchain data, and subscribing to events. You can also
use Arc's public endpoints directly.

| Connection type | Public endpoint |
| :- | :- |
| HTTP RPC (Mainnet) | `https://rpc.mainnet.arc.io` |
| HTTP RPC (Testnet) | `https://rpc.testnet.arc.io` |
| WebSocket (Testnet) | `wss://rpc.testnet.arc.io` |
| Chain ID (Mainnet) | `5042` |
| Chain ID (Testnet) | `5042002` |

## Providers

### [Alchemy](https://www.alchemy.com/arc)

Institutional-grade developer platform powering RPC, Data APIs, real-time
webhooks, and Wallet APIs for Arc.

### [Blockdaemon](https://www.blockdaemon.com/protocols/arc)

Institutional-grade node provider offering secure and compliant infrastructure
for Arc and other EVM chains.

### [dRPC](https://drpc.org/chainlist/arc-testnet-rpc)

RPC aggregator providing high-speed, load-balanced access to Arc nodes through a
multi-provider architecture.

### [QuickNode](https://www.quicknode.com/chains/arc)

High-performance blockchain infrastructure offering global endpoints and APIs
for developers.

<Info>
  You can connect directly to Arc's public RPC endpoint or through any of these
  infrastructure partners using your preferred SDK or web3 client.
</Info>

<Tip>
  You can also [run your own node](/arc/concepts/running-a-node) for independent
  verification and direct RPC access without third-party dependencies.
</Tip>
