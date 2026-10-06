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

# Block confirmation and transaction finality

When you submit a transaction to CPN, it is initially in the `pending` state and
waiting to be broadcast to the blockchain. Once the transaction is broadcast to
the blockchain, it transitions to the `broadcasted` state, and the transaction
is waiting to be included in a block.

CPN monitors each block of supported blockchains and the status of CPN
transactions on those chains, updating the status as necessary.

## Block confirmation

Block confirmation is the process of validating and adding transactions to a
block on a blockchain. Each time a new block is added to a blockchain, it
confirms the previous blocks.

Without a sufficient number of confirmations, transactions are vulnerable to
alteration through blockchain reorganization. Blockchain reorganization occurs
when validators discard one or more blocks that were previously part of the
canonical chain and replace them with a different set of blocks, rewriting part
of the chain.

<Note>
  **Note:** Blockchain reorganizations can happen for a variety of reasons. It's
  an engineering best practice to expect reorganizations and make your system
  resilient to them.
</Note>

Each additional block confirmation added after a block makes that block less
likely to be removed in a reorganization. Each block confirmation adds
confidence that the transaction is permanently included in the blockchain.

## Confirmation number

For a given block, the confirmation number is the number of subsequent blocks
added to the blockchain.

For a given transaction included in a block, CPN waits for a set number of
blocks (in addition to the original) to be added to the chain before it
considers the transaction final. This number varies across supported
blockchains. When a sufficient number of blocks are appended after the original
block, CPN updates the status of the transaction to `completed` and notifies
both the OFI and BFI of the status change.

<Note>
  **Note:** Even if a transaction is visible on a block explorer, it doesn't
  necessarily mean that the transaction is considered `completed` by CPN,
  because it's possible that it hasn't reached the number of block confirmations
  for finality.
</Note>

## Reorganization risk

Although Circle may broadcast transactions initiated through CPN to the
blockchain network, Circle cannot guarantee that the transaction is recorded or
permanently confirmed by the network. Transactions over CPN may be dependent on
underlying blockchain networks that Circle does not control, and CPN
Participants assume all risks associated with the blockchain network operations
and any operating changes, including in the unlikely event of a deep
reorganization or other invalidation of previously confirmed transactions.

Circle shall not be liable for any loss or damage arising from issues with, or
any delays, reversals, or failures of transactions caused by such operations and
operating changes.
