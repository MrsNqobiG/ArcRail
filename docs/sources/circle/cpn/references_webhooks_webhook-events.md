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

# Webhook events

> Reference for CPN webhooks for OFIs: payment, RFI, transaction, and refund notification types and payloads.

Components of CPN send webhook notifications when events occur, typically for a
change in state. These webhook notifications are sent to the OFI so that they
can track and manage payments in CPN. The webhooks described in this topic are
specific to OFIs only.

All webhook notifications follow the same payload structure. The
`notificationType` field indicates the event type, and the `notification` field
contains the event-specific data object. The `notification` object schema
matches the `data` field returned by the corresponding API endpoint (see the
[API reference](/api-reference/cpn/cpn-platform/) for details).

```json JSON theme={null}
{
  "subscriptionId": "cd198ca6-9fc4-41d6-b6b1-8e2a9c975352",
  "notificationId": "0761b030-0c75-472a-b471-74d90a7e796c",
  // Event type, determines the structure of the notification object
  "notificationType": "cpn.payment.cryptoFundsPending",
  // Event-specific data object, structure varies by notificationType
  // See corresponding section below for the object schema (Payment, RFI, Transaction, or Refund)
  "notification": {
    // Object matching the event type
  },
  "timestamp": "2024-09-30T17:48:05.420577158Z",
  "version": 2
}
```

The following sections describe the webhook events by component.

## Source IP addresses

CPN webhook notifications are delivered from a static set of source IP
addresses. Allowlist these addresses at your firewall, load balancer, or cloud
security group as an additional layer of defense alongside
[signature verification](/api-reference/verify-webhook-signatures). The same IPs
apply to both mainnet and testnet:

* `35.169.154.32`
* `3.90.127.28`
* `3.230.111.7`
* `54.88.227.75`

For endpoint setup details, see
[Set up a webhook endpoint](/api-reference/webhook-endpoints).

## Payment events

The `notification` object has the same schema as the `data` field returned by
[Get Payment](/api-reference/cpn/cpn-platform/get-payment).

| Event name | Description | Trigger when |
| - | - | - |
| `cpn.payment.cryptoFundsPending` | The payment has been created and is waiting for funds to be deposited | The payment is ready to accept crypto funds |
| `cpn.payment.fiatPaymentInitiated` | The BFI has initiated the fiat payment to the receiver's bank account | The onchain transaction is confirmed by the BFI and the BFI initiated the fiat payment |
| `cpn.payment.completed` | The payment is fully processed | The fiat payment has been sent.<br /><br />Depending on the payment method, the receiver may or may not have received the transfer. At this point, the CPN payment is complete. |
| `cpn.payment.failed` | The payment failed due to errors in processing, insufficient funds, or compliance rejection | The payment can't proceed due to an issue |
| `cpn.payment.delayed` | There is a delay to the estimate of payment settlement time. No status has changed but an updated settlement time is included in the payload | The BFI has an internal issue such that fiat settlement takes longer to process than originally stated |
| `cpn.payment.inManualReview` | A manual review has been placed on the payment. The payment status itself remains `CREATED`. | A payment is created but placed under manual review |

## RFI events

The `notification` object has the same schema as the `data` field returned by
[Get RFI](/api-reference/cpn/cpn-platform/get-rfi).

| Event name | Description | Trigger when |
| - | - | - |
| `cpn.rfi.informationRequired` | Additional compliance information is needed before the payment can proceed | The BFI requests more information to proceed with the payment |
| `cpn.rfi.inReview` | The submitted RFI response is under review by the BFI | The OFI submits the required information through the API endpoint |
| `cpn.rfi.approved` | The RFI has been reviewed and approved, the payment can proceed | The BFI approves the submitted information |
| `cpn.rfi.rejected` | The RFI has been reviewed and rejected, the payment is failed | The BFI rejects the submitted information |

## Transaction events

The `notification` object has the same schema as the `data` field returned by
[Get Transaction](/api-reference/cpn/cpn-platform/get-transaction).

| Event name | Description | Trigger when |
| - | - | - |
| `cpn.transaction.broadcasted` | The signed transaction is sent to the blockchain for confirmation | The signed transaction has been broadcast |
| `cpn.transaction.completed` | The transaction was successfully included in a block | The blockchain confirms the transaction |
| `cpn.transaction.failed` | The transaction failed due to issues such as incorrect parameters or insufficient gas fees | The blockchain failed to confirm the transaction |

## Refund events

The `notification` object has the same schema as the `data` field returned by
[Get Refund](/api-reference/cpn/cpn-platform/get-refund).

| Event name | Description | Trigger when |
| - | - | - |
| `cpn.refund.created` | The BFI created a refund for the associated payment | The BFI initiated the refund.<br /><br />**Note:** Not all BFIs send this event. |
| `cpn.refund.failed` | The refund could not be processed | The BFI encountered an error processing the refund |
| `cpn.refund.completed` | The refund is complete | The BFI confirms that the refund was successfully returned to the refund address |

## Webhooks from other Circle products

The event types in the previous sections are delivered through **CPN**
subscriptions. When you also use **Programmable Wallets** or **Circle APIs** for
liquidity and treasury, you may configure additional webhook subscriptions for
those products. Payload shape and `notificationType` values differ from CPN
webhooks.

| Product area | Subscription endpoint | Reference |
| - | - | - |
| CPN payments | [Create subscription](/api-reference/cpn/common/create-subscription) (`POST /v2/cpn/notifications/subscriptions`) | This page and [Set up a webhook endpoint](/api-reference/webhook-endpoints) |
| Programmable Wallets | [Create subscription](/api-reference/wallets/common/create-subscription) (`POST /v2/notifications/subscriptions`) | [Inbound transaction](/api-reference/wallets/common/transactions-inbound) and [outbound transaction](/api-reference/wallets/common/transactions-outbound) webhook events |
| Circle APIs (liquidity) | [Create subscription](/api-reference/circle-mint/general/create-subscription) (`POST /v1/notifications/subscriptions`) | [Notifications data models](/circle-mint/references/webhook-notifications) |

CPN and other Circle products each enforce their own API keys and notification
contracts. Plan separate subscriber endpoints or routing logic if you need all
event types in one service.
