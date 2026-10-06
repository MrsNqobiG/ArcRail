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

# StableFX risk buffers

> Understand how risk buffers protect counterparties during StableFX trade execution

Risk buffers add a layer of protection to StableFX trades. During trade
execution, StableFX can hold a portion of the trade's notional value as buffer
from the taker, maker, or both in escrow.

This buffer manages counterparty risk, meaning one party fails to fund the trade
after agreeing to it. By holding funds in escrow upfront, StableFX ensures both
sides commit to the trade. This reduces exposure and improves settlement
integrity.

## Risk buffer calculation

StableFX defines risk buffer settings per maker and currency pair. Each setting
controls how much of the taker's and maker's notional amounts are reserved as
buffers for that trading pair.

| Parameter | Description |
| - | - |
| Taker risk buffer % | Percentage of the sell currency amount held as the taker's buffer. |
| Taker risk buffer min | Minimum value of the taker's risk buffer in absolute terms. |
| Maker risk buffer % | Percentage of the buy currency amount held as the maker's buffer. |
| Maker risk buffer min | Minimum value of the maker's risk buffer in absolute terms. |

A value of 0% is valid for any risk buffer. If no setting exists for a given
maker-taker pair, both risk buffers default to 0.

When a taker requests a quote, StableFX:

1. Retrieves the risk buffer configuration for the maker and currency pair.
2. Calculates both taker and maker risk buffers based on the configuration
   parameters.
3. Returns the taker's risk buffer in the quote response as the `collateral`
   parameter.

This gives the taker full visibility into the total funds required before trade
execution.

## Trade broadcast

After StableFX registers signatures for both the taker and maker, it broadcasts
the [`recordTrade`](/stablefx/references/contract-interfaces) function to the
settlement contract. This function withdraws trade collateral from each trader's
wallet using the Permit2 protocol.

<Warning>
  Both traders must have sufficient balance for their collateral amount specified
  on the quote and
  [Permit2 approval](/stablefx/howtos/grant-usdc-allowance-permit2) for their
  funding token to successfully record the trade onchain.
</Warning>

## Where to find the risk buffer

The risk buffer amount appears in several places:

* **Create Quote API response**: Returned as the `collateral` field for the
  taker. See [Create a quote](/api-reference/stablefx/all/create-quote).
* **Get Trade API response**: Makers can find the `collateral` field in the
  trade response. See
  [Get a trade](/api-reference/stablefx/all/get-trade-by-id).
* **Typed data for signing**: Available in the `message.permitted.amount` field
  of the EIP-712 typed data.

The currency of the collateral is always the currency that the trader is
responsible for funding.

## How risk buffers affect settlement

### Breach scenarios

If a trade reaches maturity but remains unsettled, StableFX calls the escrow
contract's breach function to expire the trade. The outcome depends on which
party has funded:

**Neither party funds**

If neither the taker nor the maker funds before expiry, the smart contract
returns both parties' risk buffers from escrow. No breach compensation is
applied.

**One party funds**

If only one party funds the trade before expiry, the non-funding party is
treated as the breaching party. The contract:

* Awards the non-funding party's risk buffer to the funding party as
  compensation.
* Returns the funding party's own buffer and trade funds to them.

This keeps the process fair regardless of which side funds first. The party who
funds is protected, while the party who doesn't bears the cost of their
collateral.

### Funding

Parties are only required to fund the difference between their collateral and
the trade amount. This calculation is built into the StableFX Fund APIs.
