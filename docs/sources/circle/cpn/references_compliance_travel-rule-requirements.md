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

# Travel rule requirements

Travel rule information is required during payment creation to provide
appropriate regulatory information to the BFI. The following sections outline
the required data that must be securely transmitted to the BFI when a payment is
created. See [JSON Schema](/cpn/concepts/api/json-schema) for more information
on how to validate your API response to the travel rule requirements.

<Note>
  **Note:** Depending on the geography of the payment route, additional travel
  rule information may be required to initiate the payment. This additional data
  are specified in the data object returned by the [payment creation
  endpoint](/api-reference/cpn/cpn-platform/create-payment).
</Note>

## OFI

| Field | Description |
| - | - |
| `ORIGINATOR_FINANCIAL_INSTITUTION_NAME` | OFI's business name |
| `ORIGINATOR_FINANCIAL_INSTITUTION_ADDRESS` | OFI's business address |

## Individual

| Field | Description |
| - | - |
| `ORIGINATOR_NAME` | Sender's full name |
| `ORIGINATOR_ACCOUNT_NUMBER` | Sender's account number reference (originator's wallet address or account number for an OFI virtual or funding account) |
| `ORIGINATOR_ADDRESS` | Sender's address |
| `ORIGINATOR_DATE_OF_BIRTH` | Sender's date of birth |
| `ORIGINATOR_NATIONALITY` | Sender's nationality |
| `ORIGINATOR_NATIONAL_IDENTIFICATION_NUMBER` | Sender's national ID or passport number |
| `BENEFICIARY_NAME` | Recipient's full name |
| `BENEFICIARY_ADDRESS` | Recipient's address |
| `BENEFICIARY_DATE_OF_BIRTH` | Recipient's date of birth |
| `BENEFICIARY_NATIONALITY` | Recipient's nationality |
| `BENEFICIARY_NATIONAL_IDENTIFICATION_NUMBER` | Recipient's national ID or passport number |

## Business

| Field | Description |
| - | - |
| `ORIGINATOR_NAME` | Sender's legal registered business name |
| `ORIGINATOR_ACCOUNT_NUMBER` | Sender's account number reference (originator's wallet address or account number for an OFI virtual or funding account) |
| `ORIGINATOR_ADDRESS` | Sender's registered place of business |
| `ORIGINATOR_DATE_OF_FORMATION` | Sender's date of company formation |
| `ORIGINATOR_COUNTRY_OF_FORMATION` | Sender's country where the entity was formed |
| `ORIGINATOR_NATIONAL_IDENTIFICATION_NUMBER` | Sender's business registration or tax ID |
| `BENEFICIARY_NAME` | Recipient's legal registered business name |
| `BENEFICIARY_ADDRESS` | Recipient's registered place of business |
| `BENEFICIARY_DATE_OF_FORMATION` | Recipient's date of company formation |
| `BENEFICIARY_COUNTRY_OF_FORMATION` | Recipient's country where the entity was formed |
| `BENEFICIARY_NATIONAL_IDENTIFICATION_NUMBER` | Recipient's business registration or tax ID |
