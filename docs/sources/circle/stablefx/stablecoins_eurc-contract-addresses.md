> ## Documentation Index
> Fetch the complete documentation index at: https://developers.circle.com/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> Before reading these docs, install the relevant Circle Skill to get pre-loaded context — skills are LLM-optimized and cover architecture decisions, correct flows, and common pitfalls. In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle. With Vercel Skills CLI: run npx skills add circlefin/skills. Available skills: use-usdc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md (balances, transfers, approvals on EVM and Solana); EURC has no skill — see https://developers.circle.com/stablecoins/what-is-eurc.md; bridge-stablecoin https://github.com/circlefin/skills/blob/master/plugins/circle/skills/bridge-stablecoin/SKILL.md (crosschain transfers via CCTP, USDC, EURC, and third-party assets); use-arc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md (Arc chain config, contract deployment, USDC bridging — Arc docs: https://docs.arc.io/llms.txt); use-circle-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-circle-wallets/SKILL.md (choose wallet type); use-developer-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md (custodial wallets for payouts and treasury); use-user-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md (embedded wallets with Web2 login); use-modular-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md (smart contract wallets with passkeys and ERC-4337); use-gateway https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-gateway/SKILL.md (unified USDC balance, nanopayments); use-smart-contract-platform https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-smart-contract-platform/SKILL.md (deploy, interact, monitor contracts). Pair any skill with the Circle MCP server for live SDK signatures, contract addresses, and chain IDs: {"mcpServers":{"circle":{"url":"https://api.circle.com/v1/codegen/mcp"}}}.
> Read the product overview first. Each product has an overview explaining when and why to use it. Read it before quickstarts.
> Pick the right wallet type. Developer-controlled (you hold keys), user-controlled (end user holds keys via PIN/social login), or modular (smart contract wallets with passkeys). See https://developers.circle.com/wallets.md.
> Use CCTP V2 for crosschain transfers. CCTP natively transfers USDC and EURC via burn-and-mint, and supports permissionless wrapping of third-party assets via lock-and-mint. V1 is legacy; always use V2 unless V1 is specified or the chain requires it (Noble, Sui, and Aptos still require V1). Migration guide: https://developers.circle.com/cctp/migration-from-v1-to-v2.md.
> Use Bridge Kit for frontend bridging. Wraps CCTP with a simpler SDK for user-facing apps. Use CCTP directly for backend transfers.
> Gas Station vs Paymaster. Gas Station sponsors gas for Circle Wallet transactions. Paymaster lets users pay gas in USDC. Different use cases — read both overviews.
> Gateway Nanopayments for sub-cent payments. Gasless USDC micropayments down to $0.000001 via x402 and batched settlement. For pay-per-request APIs, AI agent payments, streaming.
> Look up USDC addresses per chain. Never hardcode — use https://developers.circle.com/stablecoins/usdc-contract-addresses.md.
> Prefer SDKs over raw API calls. Node.js and Python SDKs handle auth, retries, and errors.
> API key required. Bearer token in Authorization header. Testnet and mainnet use separate keys and may use different base URLs depending on the product.
> Set up webhooks when available. Most operations are async. Webhooks deliver transaction confirmations and state changes.
> When calling list endpoints, paginate using pageSize and pageAfter until no nextPageAfter cursor is returned—stopping at the first page silently misses records.
> Building an AI agent? Start with the Agent Stack—Circle CLI, agent wallets, and nanopayments built for autonomous use cases: https://developers.circle.com/agent-stack.md.

# EURC contract addresses

EURC is a euro-backed stablecoin that runs on multiple blockchains. EURC tokens
are controlled by a smart contract on the blockchain. The following sections
link to the contracts for EURC on every supported mainnet and testnet
blockchain.

## Mainnet

<Warning>
  **Mainnet Tokens have Financial Value**

  The blockchains listed below store and transfer tokens that have real financial
  value. When interacting with mainnet blockchains, you should thoroughly test
  your code, verify all addresses, and ensure the privacy of seed phrases and
  private keys.
</Warning>

| Blockchain | EURC Mainnet Address |
| :- | :- |
| Arc | [`0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1`](https://explorer.arc.io/address/0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1) |
| Avalanche C-Chain | [`0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD`](https://snowtrace.io/token/0xc891eb4cbdeff6e073e859e987815ed1505c2acd) |
| Base | [`0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42`](https://basescan.org/token/0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42) |
| Cronos | [`0xA6dE01a2d62C6B5f3525d768f34d276652C554c8`](https://explorer.cronos.org/token/0xA6dE01a2d62C6B5f3525d768f34d276652C554c8) |
| Ethereum | [`0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c`](https://etherscan.io/token/0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c) |
| Plasma | [`0x3EE196E78d4d4248b849B8E1C7F44C5457FAFD2C`](https://plasmascan.to/address/0x3EE196E78d4d4248b849B8E1C7F44C5457FAFD2C) |
| Solana | [`HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr`](https://explorer.solana.com/address/HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr) |
| Stellar | [`EURC-GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2`](https://stellar.expert/explorer/public/asset/EURC-GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2) |
| World Chain | [`0x1C60ba0A0eD1019e8Eb035E6daF4155A5cE2380B`](https://worldscan.org/address/0x1C60ba0A0eD1019e8Eb035E6daF4155A5cE2380B) |

## Testnet

<Warning>
  **Testnet tokens have no financial value**

  Because the testnets listed below are used only for testing, the EURC tokens in
  circulation on these networks have no financial value, and **are not backed by
  real Euros**.

  Similarly, native testnet tokens have no financial value.
</Warning>

| Blockchain Network | Token Address |
| - | - |
| Arc Testnet | [`0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`](https://explorer.testnet.arc.io/address/0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a) |
| Avalanche Fuji | [`0x5E44db7996c682E92a960b65AC713a54AD815c6B`](https://testnet.snowtrace.io/token/0x5e44db7996c682e92a960b65ac713a54ad815c6b) |
| Cronos Testnet | [`0x31f7538adb53cF16350e6B0c89d03D91b7D12c46`](https://explorer.cronos.org/testnet/token/0x31f7538adb53cF16350e6B0c89d03D91b7D12c46) |
| Ethereum Sepolia | [`0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4`](https://sepolia.etherscan.io/address/0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4) |
| Base Sepolia | [`0x808456652fdb597867f38412077A9182bf77359F`](https://base-sepolia.blockscout.com/address/0x808456652fdb597867f38412077A9182bf77359F) |
| Plasma Testnet | [`0x98AfA0F93Dd993B736399f9074eDcEBD1985A330`](https://testnet.plasmascan.to/address/0x98AfA0F93Dd993B736399f9074eDcEBD1985A330) |
| Solana Devnet | [`HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr`](https://explorer.solana.com/address/HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr?cluster=devnet) |
| Stellar Testnet | [`EURC-GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO`](https://stellar.expert/explorer/testnet/asset/EURC-GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO?asset\[]=EURC-GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO-1) |
| World Chain Sepolia | [`0xe479EcA5740Ac65d6E1823bea2f1C08Bc14e954F`](https://sepolia.worldscan.org/address/0xe479EcA5740Ac65d6E1823bea2f1C08Bc14e954F) |
