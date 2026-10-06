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

# Bring your own wallet for CPN

> How using your own wallet infrastructure fits into Circle Payments Network integrations.

Circle Payments Network (CPN) requires a blockchain wallet to sign and submit
USDC transfer transactions on behalf of your organization. Circle doesn't
require this wallet to be a [Circle Wallet](/wallets/dev-controlled.mdx).
Institutions that already custody USDC and operate keys through an in-house or
third-party wallet stack can use that existing infrastructure with CPN.
Originating Financial Institutions (OFIs) that hold their own USDC often choose
this Bring Your Own Wallet (BYOW) approach and it's available on all
[blockchains that CPN supports](/cpn/references/blockchains/supported-blockchains).

## When to bring your own wallet

Bring Your Own Wallet (BYOW) is a good fit when your organization:

* Already operates wallet infrastructure with established key-management
  procedures.
* Requires custody arrangements that are specific to your compliance or
  regulatory environment.
* Manages USDC balances and blockchain interactions through an existing
  third-party provider.

If none of these apply, you can have Circle host the operational wallet instead.
See how to
[Set up a Circle wallet for CPN payments](/cpn/guides/wallets/setup-circle-wallet-for-cpn-payments).

## Your responsibilities

When you bring your own wallet, you take on operational responsibilities that
Circle otherwise handles. The following table summarizes how those
responsibilities are divided.

| Responsibility | BYOW | Circle-hosted wallet |
| - | - | - |
| Key management and signing | You | Circle |
| Blockchain support and connectivity | You | Circle |
| Nonce handling | You | Circle |
| USDC balance management | You | You |
| Native gas token funding (where required) | You | Circle |

<Note>
  CPN Transactions V2 provides unsigned transaction data that includes nonce
  values, so you don't need to manage nonces directly. See the [Create
  Transaction V2](/api-reference/cpn/cpn-platform/create-transaction-v2)
  endpoint for details.
</Note>

Your wallet implementation must satisfy the technical expectations described in
[Wallet provider compatibility](/cpn/references/blockchains/wallet-provider-compatibility).

## How CPN works with your wallet

Regardless of which wallet option you choose, you interact with the same CPN
APIs. Payment creation, settlement, and reporting work identically; only the
custody and signing layer differs. Transactions V2 returns a complete unsigned
payload, including nonce values.

The interaction between CPN and your wallet follows this pattern:

1. You call the CPN
   [Create Transaction](/api-reference/cpn/cpn-platform/create-transaction-v2)
   endpoint to prepare unsigned transaction data for a payment.
2. CPN returns unsigned transaction data (the payload your wallet needs to
   sign).
3. Your wallet infrastructure signs the transaction using its own key-management
   system.
4. You submit the signed transaction back to CPN through the
   [Submit Transaction](/api-reference/cpn/cpn-platform/submit-transaction-v2)
   endpoint.
5. CPN validates the signed transaction and broadcasts it to the blockchain.
6. CPN sends [webhook notifications](/api-reference/webhooks) with transaction
   status updates.

<Note>
  CPN never accesses your private keys. It issues payment instructions that your
  wallet infrastructure executes by signing and submitting transactions to the
  appropriate blockchain.
</Note>

The same CPN transaction APIs apply whether you sign with Circle or with your
own keys, so migrating between a Circle-hosted wallet and BYOW does not require
changes to your CPN integration logic. For a full walkthrough, see the
[Integrate with CPN as an OFI](/cpn/quickstarts/integrate-with-cpn-ofi)
quickstart.
