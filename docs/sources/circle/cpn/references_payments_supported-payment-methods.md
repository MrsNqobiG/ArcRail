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

# Supported payment methods

CPN supports multiple payment methods for transferring funds to recipients in
different countries. The available payment methods depend on the destination
country and are determined by the payment rails available in that region.

You can discover available payment methods for specific routes using the
[configurations overview endpoint](/api-reference/cpn/cpn-platform/get-payment-configurations-overview)
or the [list routes endpoint](/api-reference/cpn/cpn-platform/list-routes).

<Note>
  **Note:** Payment method availability may vary based on your account
  configuration and the specific payment route. Always use the [list routes
  endpoint](/api-reference/cpn/cpn-platform/list-routes) to verify available
  payment methods for your specific use case.
</Note>

## Settlement times

Payment methods have different settlement characteristics:

* **Instant payments** (for example `PIX`, `SPEI`, `IMPS`): Typically settle in
  seconds to minutes
* **Batched payments** (for example `WIRE`, `CHATS`): May take 1-2 business days
  depending on the route

Actual settlement times are provided in the quote response via the
`fiatSettlementTime` field.

## Payment methods by region

The following sections detail payment methods available for specific destination
countries and regions.

### Argentina

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### Brazil

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `PIX` | BRL | Brazil's instant payment system that enables real-time transfers 24/7 | 5 minutes |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### Chile

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### China

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `CIPS` | CNY | China's Cross-Border Interbank Payment System for international RMB transfers | 1-2 business days |
| `WIRE` | CNY, USD | Wire transfer for international payments | 1-2 business days |

### Colombia

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `BANK-TRANSFER` | COP | Bank transfer for domestic payments in Colombia, processed through the ACH network | 1-2 business days |
| `NEQUI` | COP | Colombia's digital wallet and instant payment system | 5 minutes |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### European Union

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `WIRE` | USD | Wire transfer for international payments to European countries | 1-2 business days |

<Note>
  **Note:** SEPA payments will attempt instant SEPA first, which delivers in
  minutes. If instant SEPA is not available for the transaction, it will fall
  back to regular SEPA, which takes 1 business day.
</Note>

<Note>
  **Note:** WIRE is available for the following countries: Andorra, Austria,
  Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland,
  France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Liechtenstein,
  Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Romania,
  Slovakia, Slovenia, Spain, Sweden, Switzerland, and United Kingdom.
</Note>

### Hong Kong

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `CHATS` | HKD, USD | Hong Kong's Clearing House Automated Transfer System for interbank transfers | Same day |
| `FPS` | HKD | Hong Kong's Faster Payment System for real-time payments | 5 minutes |
| `WIRE` | HKD, USD | Wire transfer for international payments | 1-2 business days |

### India

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `IMPS` | INR | India's Immediate Payment Service for instant interbank transfers | 5 minutes |
| `NEFT` | INR | India's National Electronic Funds Transfer for scheduled batch transfers | Same day |
| `RTGS` | INR | India's Real Time Gross Settlement for high-value transfers | 5 minutes |

### Japan

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### Kenya

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### Mexico

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `SPEI` | MXN | Mexico's electronic interbank payment system operated by Banco de México | 5 minutes |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### Nigeria

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `BANK-TRANSFER` | NGN | Nigeria's NIBSS (Nigeria Inter-Bank Settlement System) instant payment system for real-time interbank transfers | 5 minutes |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### Singapore

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `BANK-TRANSFER` | SGD | Bank transfer for domestic payments in Singapore, may be processed through FAST (Fast And Secure Transfers) or MEPS RTGS (Real-Time Gross Settlement) | 30 minutes |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### South Africa

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### South Korea

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### Taiwan

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `WIRE` | USD | Wire transfer for international payments | 1-2 business days |

### United States

| Payment Method | Currency | Description | Approximate Processing Time |
| - | - | - | - |
| `FEDWIRE` | USD | US Federal Reserve's wire transfer system for same-day settlement | Same day |

## Payment method characteristics

### Limits

Each payment method has minimum and maximum transfer limits that vary by:

* Destination country
* Destination currency
* Payment method type

Use the [list routes endpoint](/api-reference/cpn/cpn-platform/list-routes) to
retrieve specific limits for your payment route. When using V2 transactions,
pass `transactionVersion=VERSION_2` so returned crypto min limits include a
chain-specific buffer for fees (for example, gas fee), paid in USDC from the
source amount.
