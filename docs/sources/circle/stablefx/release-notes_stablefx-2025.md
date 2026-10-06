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

# Release notes - StableFX - 2025

> 2025 release notes for StableFX

## November 2025

<Update label="2025.11.13">
  Launched StableFX, an institutional-grade stablecoin FX engine built on Arc that
  combines Request-for-Quote (RFQ) execution with onchain settlement.

  ### Documentation additions

  Added the following documentation to support the StableFX launch:

  * [StableFX overview](/stablefx)
  * [StableFX technical guide](/stablefx/concepts/technical-guide)
  * [Create an FX trade as a taker](/stablefx/quickstarts/fx-trade-taker)
  * [Fulfill an FX trade as a maker](/stablefx/quickstarts/fx-trade-maker)
  * [Grant USDC Allowance with Permit2](/stablefx/howtos/grant-usdc-allowance-permit2)
  * [Test StableFX Integration as a Taker](/stablefx/tutorials/test-stablefx-integration-taker)
  * [Test StableFX Integration as a Maker](/stablefx/tutorials/test-stablefx-integration-maker)
  * [StableFX contract interfaces](/stablefx/references/contract-interfaces)
  * [StableFX supported currencies](/stablefx/references/supported-currencies)

  ### API additions

  Added the following StableFX API endpoints:

  * [`POST /v1/stablefx/quotes`](/api-reference/stablefx/all/create-quote)
  * [`POST /v1/stablefx/trades`](/api-reference/stablefx/all/create-trade)
  * [`GET /v1/stablefx/trades`](/api-reference/stablefx/all/list-trades)
  * [`GET /v1/stablefx/trades/{tradeId}`](/api-reference/stablefx/all/get-trade-by-id)
  * [`POST /v1/stablefx/trades/{tradeId}/signature-data`](/api-reference/stablefx/all/generate-trade-signature-data)
  * [`POST /v1/stablefx/trades/{tradeId}/signatures`](/api-reference/stablefx/all/register-trade-signature)
  * [`POST /v1/stablefx/trades/{tradeId}/fund`](/api-reference/stablefx/all/fund-trade)
</Update>
