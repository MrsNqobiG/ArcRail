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

# Payment and transaction failure reasons

When payments or transactions fail, you'll receive an object containing the
failure reason. Depending on when the failure occurs, this information is
returned in the synchronous (API) or asynchronous (webhook) response. The
following sections outline the reasons that each of these components might fail.

## Payments

When a payment fails in CPN there are no further actions you can take with that
payment ID. You should restart the payment workflow by requesting a new quote
and accepting it to create a new payment.

The payment failure notification includes a failure reason (listed below) and a
[failure code](/cpn/references/errors/payment-failure-codes) containing more
specific information about the failure. The failure code provides information
about how to resolve the issue and create a new payment.

| Failure reason | Description |
| - | - |
| `TRAVEL_RULE_FAILED` | The travel rule information included with the payment was rejected |
| `BANK_VERIFICATION_FAILED` | The bank information included with the payment was rejected |
| `RFI_VERIFICATION_FAILED` | The payment failed due to issues related to RFI handling or verification |
| `EXISTING_RFI_PENDING` | An RFI exists on the customer in a non-terminal state |
| `ONCHAIN_SETTLEMENT_FAILED` | The payment couldn't be processed due to an issue with the onchain settlement |
| `ONCHAIN_SETTLEMENT_CUTOFF_TIME_EXCEEDED` | The signed transaction was submitted after the onchain settlement cutoff |
| `FIAT_SETTLEMENT_FAILED` | The payment couldn't be completed due to routing or bank settlement issues |
| `COMPLIANCE_CHECK_FAILED` | The payment was rejected due to a compliance check failure |
| `CANCELLED` | The payment is canceled by the originator |
| `PAYMENT_EXPIRED` | The payment expired before a signed transaction was submitted |
| `OTHER` | General payment failure not covered by other reasons |

## Transactions

If an onchain transaction fails or becomes stuck, you can create a new
transaction or attempt to replace or accelerate the transaction. You may
continue to troubleshoot onchain transactions until the payment expires. Note
that only one transaction can be associated with a given payment, so you must
wait until the current transaction fails or attempt to replace it if you need to
update the transaction.

| Failure reason | Description |
| - | - |
| `CPN_PAYMENT_EXPIRED` | The payment corresponding to this transaction is expired.<br /><br />**Resolution**: Create a new payment and ensure the onchain transaction is completed in its valid time frame. |
| `SIGNED_TRANSACTION_EXPIRED` | (Solana only) The signed transaction is expired. Solana requires you to submit a signed transaction in 150 blocks (\~1 min).<br /><br />**Resolution:** Initiate a new transaction and submit it in the appropriate time frame. |
| `NONCE_TOO_LOW` | The nonce of the signed transaction is lower than the current wallet nonce.<br /><br />**Resolution:** Submit a new transaction using the latest nonce value for the wallet. |
| `INSUFFICIENT_GAS_BALANCE` | Not enough native tokens were available in the wallet to cover the gas fee for the transaction.<br /><br />**Resolution:** Fund the wallet with the appropriate amount of native tokens and initiate a new transaction. |
| `GAS_PRICE_TOO_LOW` | The specified gas fee is too low, which may prevent the transaction from being included in a block.<br /><br />**Resolution:** Create a new transaction with a higher gas fee. |
| `INSUFFICIENT_TOKEN_BALANCE` | The wallet does not have enough USDC in it for the transfer amount.<br /><br />**Resolution:** Fund the wallet with the appropriate amount of USDC for the payment, then initiate a new transaction. |
| `OUT_OF_GAS` | For EVM chains, the gas limit for the signed transaction is insufficient to cover the execution cost. For Solana, the allocated compute budget falls short of the transaction's requirements, preventing successful execution.<br /><br />**Resolution:** Create a new transaction with a higher gas limit. |
| `TX_REPLACEMENT_FAILED` | The transaction replacement failed because another transaction with the same nonce (and higher fee) is already the mempool or was mined first.<br /><br />If the replacement fails, the original transaction submitted to the blockchain is still executed. |
| `SOL_TX_ALREADY_IN_CACHE` | (Solana only) The transaction has already been broadcast and is present in the network's cache.<br /><br />**Resolution:** Wait for the current transaction's confirmation or failure before proceeding. |
| `TX_ALREADY_CONFIRMED` | The transaction was confirmed onchain before the current broadcast attempt.<br /><br />**Resolution:** If this was unexpected, open a support ticket for further investigation. |
| `FAILED_ONCHAIN` | The transaction failed execution on the blockchain.<br /><br />**Resolution:** Review the onchain error, correct any issues, and submit a new transaction. |
| `SOL_BLOCKHASH_EXPIRED` | (Solana only) The Solana blockhash assigned to the transaction has expired.<br /><br />**Resolution:** Initiate a new transaction. |
| `TRANSACTION_EXPIRED` | The transaction is expired and you aren't able to perform any further actions.<br /><br />**Resolution:** Initiate a new transaction. |
