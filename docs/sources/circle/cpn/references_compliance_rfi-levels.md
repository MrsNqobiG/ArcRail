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

# RFI levels

Requests for information (RFI) can have one of three levels, which indicate the
required information that must be passed to satisfy the RFI. The levels vary
depending on if the sender is an individual or a business.

## Individual

The following sections outline the requirements for each level if the sender is
an individual (natural person).

### Level 1

Level 1 requires the following information:

| Field | Description |
| - | - |
| `ADDRESS` | Individual's full address |
| `NAME` | Individual's full name |
| `DATE_OF_BIRTH` | Individual's date of birth |
| `NATIONAL_IDENTIFICATION_NUMBER` | Unique government-issued ID (tax ID, national ID, or other) |
| `SOURCE_OF_FUNDS` | Source of funds for transactions |
| `METHOD_OF_VERIFICATION` | The method of verification (electronic, by document, or other) |

### Level 2

Level 2 requires all of the information required for level 1, plus the following
information:

| Field | Description |
| - | - |
| `NATIONALITY` | Nationality of the individual |
| `EMAIL` | Contact email address |
| `PHONE` | Primary phone number |
| `OCCUPATION` | Employment or professional activity |

### Level 3

Level 3 requires all the information required for levels 1 and 2, plus the
following information:

| Field | Description |
| - | - |
| `ID_DOC_TYPE` | Type of ID provided (passport, national ID, or others) |
| `ID_DOCUMENT` | Copy of the provided ID |
| `PROOF_OF_ADDRESS` | Utility bill, bank statement, or lease agreement |
| `ADDITIONAL_DOCS` | Any additional documents for enhanced due diligence |

## Business

The following sections outline the requirements for each level if the sender is
a business.

### Level 1

Level 1 requires the following information:

| Field | Description |
| - | - |
| `NAME` | Legal registered name of the business |
| `TRADE_NAME` | Doing Business As (DBA) or trade name |
| `NATIONAL_IDENTIFICATION_NUMBER` | Business identification number (tax ID) |
| `DATE_OF_FORMATION` | Date of company formation |
| `COUNTRY_OF_FORMATION` | Country where the entity was formed |
| `ENTITY_TYPE` | Business structure (LLC, corporation, partnership, others) |
| `INDUSTRY_TYPE` | Classification of business activity |
| `ADDRESS` | Registered place of business |
| `METHOD_OF_VERIFICATION` | The method of verification |
| `SOURCE_OF_FUNDS` | Business funding sources |

### Level 2

Level 2 requires all of the information required for level 1, plus the following
information:

| Field | Description |
| - | - |
| `AUTHORIZED_SIGNATORIES` | List of individuals with signature authorization |
| `BENEFICIARY_OWNERSHIP` | Whether any individuals or entities have significant ownership (directly or indirectly own >= 25%) of the company |
| `BENEFICIARY_OWNERS` | List of individuals with significant ownership (directly or indirectly owning >= 25%) of the company |
| `INTERMEDIARY_BENEFICIARY_OWNERS` | List of intermediary beneficiary owners with significant ownership (directly or indirectly own >= 25%) of the company |
| `WEBSITE` | Business website URL |
| `EMAIL` | Business contact email |
| `PHONE` | Business contact phone number |

### Level 3

Level 3 requires all the information required for levels 1 and 2, plus the
following information:

| Field | Description |
| - | - |
| `FORMATION_DOCUMENT` | Articles of incorporation or certificate of formation |
| `PROOF_OF_ADDRESS` | Utility bill, lease agreement, or bank statement |
| `ORG_STRUCTURE` | Document of the organization structure of the business |
| `INVOICE` | Underlying invoice for the payment |
| `BENEFICIAL_OWNERS_IDENTITY_DOCUMENTS` | Beneficial owners ID documents |
