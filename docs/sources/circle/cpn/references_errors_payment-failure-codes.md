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

# Payment failure codes

When a payment fails, CPN provides a
[failure reason](/cpn/references/errors/payment-and-transaction-failure-reasons)
and a failure code. Depending on when the failure occurs, this information is
returned in the synchronous (API) or asynchronous (webhook) response. This
failure code can help you understand why the payment failed, and take
appropriate steps to resolve the issue. The following sections outline the
specific failure codes for failed payments.

## General

These codes apply when the failure reason is `OTHER`.

| Failure code | Description |
| - | - |
| `PM00001` | General error |

## Travel rule

These codes apply when the failure reason is `TRAVEL_RULE_FAILED`.

| Failure code | Description |
| - | - |
| `PM01000` | A general travel rule failure occurred during travel rule verification |
| `PM01001` | The originator address is missing data or doesn't meet required formatting or jurisdictional standards |
| `PM01002` | The beneficiary address is missing data or doesn't meet required formatting or jurisdictional standards |
| `PM01003` | The national ID or passport number provided for the originator is invalid, missing, or fails verification |
| `PM01004` | The national ID or passport number provided for the beneficiary is invalid, missing, or fails verification |

## Bank verification

These codes apply when the failure reason is `BANK_VERIFICATION_FAILED`.

| Failure code | Description |
| - | - |
| `PM02000` | General bank detail validation failure |
| `PM02001` | The beneficiary bank account details (SWIFT BIC, account alias, account number) are invalid, malformed, or not recognized by the bank or network |
| `PM02002` | The beneficiary bank account details provided don't match the registered beneficiary in the bank's records |
| `PM02003` | The receiving bank isn't supported |
| `PM02004` | The specified account type (checking, savings) isn't supported |
| `PM02005` | The beneficiary bank or payment participant is unavailable or offline |

## RFI verification

These codes apply when the failure reason is `RFI_VERIFICATION_FAILED`.

| Failure code | Description |
| - | - |
| `PM03000` | General RFI verification failure |
| `PM03001` | Missing or improperly formatted RFI documents |
| `PM03002` | Conflicting data in the RFI submission |
| `PM03003` | Expired or outdated RFI documents |
| `PM03004` | Rejected after manual compliance review |
| `PM03005` | RFI response or review not completed in allowed time |

## Existing RFI pending

These codes apply when the failure reason is `EXISTING_RFI_PENDING`.

| Failure code | Description |
| - | - |
| `PM04000` | An RFI exists on the customer in a non-terminal state |

## Onchain settlement

These codes apply when the failure reason is `ONCHAIN_SETTLEMENT_FAILED`.

| Failure code | Description |
| - | - |
| `PM05000` | General onchain settlement failure |
| `PM05001` | Received funds are invalid (wrong asset, insufficient amount, wrong blockchain) |

## Fiat settlement

These codes apply when the failure reason is `FIAT_SETTLEMENT_FAILED`.

| Failure code | Description |
| - | - |
| `PM06000` | General fiat settlement or payout failure |
| `PM06001` | Rejected by the receiving bank |
| `PM06002` | Rejected by the sending bank |
| `PM06003` | Destination account invalid or unregistered |
| `PM06004` | Destination account blocked |
| `PM06005` | Transaction amount exceeds permitted limit |
| `PM06006` | Beneficiary bank or payment participant unavailable or offline |
| `PM06007` | Currency unsupported or invalid |

## Compliance check

These codes apply when the failure reason is `COMPLIANCE_CHECK_FAILED`.

| Failure code | Description |
| - | - |
| `PM07000` | General compliance check failure |
| `PM07001` | Originator blocked or ineligible |
| `PM07002` | Beneficiary blocked or ineligible |
| `PM07003` | OFI compliance check failed.<br /><br />You may need to complete KYB before proceeding with further payments |
| `PM07004` | The beneficiary bank account failed compliance checks |

## Canceled

These codes apply when the failure reason is `CANCELLED`.

| Failure code | Description |
| - | - |
| `PM08000` | Funds were canceled by the originator |

## Payment expired

These codes apply when the failure reason is `PAYMENT_EXPIRED`.

| Failure code | Description |
| - | - |
| `PM09000` | Crypto funds not received in the expected time window |

## Onchain settlement cutoff

These codes apply when the failure reason is
`ONCHAIN_SETTLEMENT_CUTOFF_TIME_EXCEEDED`.

| Failure code | Description |
| - | - |
| `PM09001` | The signed transaction was submitted after the onchain settlement cutoff. The cutoff time is the payment's expiry time minus a blockchain-specific buffer. |
