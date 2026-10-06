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

# Magic values for testing

You can use specific values when you create a payment on testnet to get the CPN
API to return certain statuses. These magic values can be useful to test how
your integration handles specific states and situations of payments. Magic
values can be used in the sandbox environment.

The following sections outline the magic values you can pass to the sandbox API
and the effect that they have on the response from the API.

<Note>
  **Note:** All of the magic values listed in the following sections are case
  sensitive. The specified field must be set to the exact value in the table in
  order for them to work.
</Note>

## Create payment

You can test payments by providing magic values on the `ORIGINATOR_NAME` field
when making requests to the
[create a payment endpoint](/api-reference/cpn/cpn-platform/create-payment). The
following table outlines the magic values and their effects on the payment
response:

| Magic value | Response |
| - | - |
| `Failed` | Synchronous payment failure. Payment is returned with the `FAILED` status in the synchronous response. |
| `AsyncFailed` | Asynchronous payment failure. Payment is returned with the `CREATED` status in the synchronous response, followed by a webhook that updates the payment to the `FAILED` status. |
| `AsyncSuccess` | Asynchronous payment success. Payment is returned with the `CREATED` status in the synchronous response, followed by a webhook that updates the payment to the `CRYPTO_FUNDS_PENDING` status. |
| `CreateRfi` | Payment is returned with an active level 1 RFI in the synchronous response. |
| `CreateRfiL2` | Payment is returned with an active level 2 RFI in the synchronous response. |
| `CreateRfiL3` | Payment is returned with an active level 3 RFI in the synchronous response. |
| `AsyncRfi` | Payment is returned with the `CREATED` status in the synchronous response, followed by a webhook that creates an RFI on the payment. |
| `Delayed` | Payment is returned with the `CRYPTO_FUNDS_PENDING` status in the synchronous response. After an onchain transaction is received and after the `FIAT_PAYMENT_INITIATED` notification occurs, the fiat settlement time on the payment increases and a payment delayed webhook notifications is sent. The `COMPLETED` webhook is delayed by a few seconds. |
| `Expired` | Payment is returned with the `CRYPTO_FUNDS_PENDING` status in the synchronous response. After a few seconds the payment status is updated to `FAILED` with the reason `ONCHAIN_SETTLEMENT_CUTOFF_TIME_EXCEEDED`. |
| `FailThenRefundWithCompleted` | Payment is returned with the `CRYPTO_FUNDS_PENDING` status in the synchronous response. After an onchain transaction is received and after the `FIAT_PAYMENT_INITATED` notification occurs, the payment is moved to a `FAILED` state and a refund with the `COMPLETED` status is added to the payment.<br /><br />Using this magic value just fails the payment and sends the refund notification. It does not send the funds from the onchain transaction back. The `txHash` returned in the sandbox environment is a randomly generated transaction hash. |
| `FailThenRefundCreatedThenFailed` | Payment is returned with the `CRYPTO_FUNDS_PENDING` status in the synchronous response. After an onchain transaction is received, a `FIAT_PAYMENT_INITIATED` notification occurs, and the payment is moved to a `FAILED` state. A refund with the `CREATED` status is added to the payment, followed by a webhook that updates the refund to the `FAILED` state.<br /><br />This magic value simulates a scenario where the payment fails and an attempt to issue a refund is made, but the refund also fails, for example due to a downstream system error. |
| `FailThenRefundCreatedThenCompleted` | Payment is returned with the `CRYPTO_FUNDS_PENDING` status in the synchronous response. After an onchain transaction is received, a `FIAT_PAYMENT_INITIATED` notification occurs, and the payment is moved to a `FAILED` state. A refund with the `CREATED` status is added to the payment, followed by a webhook that updates the refund to the `COMPLETED` state.<br /><br />This value simulates a successful refund process after a failed payment. The original onchain funds are still not returned to the sender. The `txHash` used for testnet is randomly generated. |

## Submit RFI

You can test RFIs by providing magic values on the `NAME` field when making
requests to the [submit RFI data](/api-reference/cpn/cpn-platform/submit-rfi)
endpoint. The following table outlines the magic values and their effects on the
RFI response:

| Magic value | Response |
| - | - |
| `InReview` | Stuck RFI. RFI stays in the `IN_REVIEW` status. |
| `Rejected` | RFI is rejected. |

<Note>
  **Note:** Any value in the `NAME` field besides the values in the table
  results in an approved RFI.
</Note>
