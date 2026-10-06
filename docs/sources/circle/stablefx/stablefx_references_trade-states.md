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

# StableFX trade states

> Learn about the different states a StableFX trade can be in

StableFX trades can be in a number of states that indicate the progress of the
trade. Most of these states have a corresponding notification that is sent to
subscribers over [webhooks](/api-reference/webhooks) (if configured).

| State | Description |
| - | - |
| `pending` | Trade is in an initial or transitional state where it's being created, processed, or sent to the exchange provider. The trade has not yet been confirmed by the provider. |
| [`confirmed`](/api-reference/stablefx/all/trade-confirmed) | Trade has been successfully confirmed by the exchange provider and is awaiting signatures from both the taker and maker parties to proceed with onchain recording. |
| [`pending_settlement`](/api-reference/stablefx/all/trade-pending-settlement) | Trade has been recorded onchain and is awaiting funding from both the taker and maker parties. This state indicates the trade is in progress but not yet fully funded. |
| [`taker_funded`](/api-reference/stablefx/all/trade-taker-funded) | The taker party has successfully delivered their funds onchain. The trade is now waiting for the maker party to deliver their funds to complete the exchange. |
| [`maker_funded`](/api-reference/stablefx/all/trade-maker-funded) | The maker party has successfully delivered their funds onchain. The trade is now waiting for the taker party to deliver their funds to complete the exchange. |
| [`refunded`](/api-reference/stablefx/all/trade-refunded) | Funds delivered onchain have been returned to the respective parties because the trade was canceled or only one party funded before the deadline. This is a terminal state—the trade does not proceed further. |
| `breaching` | The trade's maturity date has passed and the system is actively processing a breach. This is a transitional state indicating the trade is being expired because at least one party did not deliver by the deadline. |
| [`breached`](/api-reference/stablefx/all/trade-breached) | The maturity date passed without full settlement—at least one party did not deliver funds. This is a terminal state—the trade has expired and does not proceed. |
| [`failed`](/api-reference/stablefx/all/trade-failed) | The trade has expired before being recorded onchain. This is a terminal state indicating the trade timed out during the signature collection phase and was never broadcast to the blockchain. |
| [`complete`](/api-reference/stablefx/all/trade-completed) | The StableFX contract has successfully settled token fund transfers between the taker, maker, and fee recipient. This is a terminal state indicating successful trade completion. |

<Note>
  Terminal states (`complete`, `failed`, `breached`, `refunded`) are final—trades
  cannot transition out of them.

  States linked to an API reference page have a corresponding webhook
  notification. `pending` and `breaching` are transitional states with no webhook.
</Note>
