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

# Mainnet vs. testnet

> How Circle Payments Network (CPN) behavior differs between the mainnet and testnet environments, including authentication, blockchain identifiers, settlement, and pricing.

Circle Payments Network (CPN) runs in two environments: mainnet and testnet.
Mainnet moves real money between real institutions. Testnet simulates payments
with mock counterparties, for development and testing. Both share the same API,
so most of your code works unchanged between them. A few key behaviors still
diverge.

## Determine your environment

CPN doesn't use separate URLs for mainnet and testnet. Every request goes to the
same base URL. Your [API key](/api-reference/keys) sets the environment:

* Keys prefixed `TEST_API_KEY` authenticate testnet requests.
* Keys prefixed `LIVE_API_KEY` authenticate mainnet requests.

## Blockchain identifiers differ per environment

Every blockchain has a separate mainnet and testnet identifier. For example,
Ethereum uses `ETH` and `ETH-SEPOLIA`. Polygon PoS uses `MATIC` and
`MATIC-AMOY`. Solana uses `SOL` and `SOL-DEVNET`. See
[Supported blockchains](/cpn/references/blockchains/supported-blockchains) for
the full list of supported blockchains.

The `blockchain` value in a request must match your API key's environment. A
mainnet identifier with a testnet key, or the reverse, is rejected with a
validation error.

Mainnet and testnet run on separate networks. Related values differ too: token
and contract addresses (see
[Payment smart contract addresses](/cpn/references/blockchains/contract-addresses))
and transaction hashes. An OFI can reuse the same wallet address across
environments, but its balance and transaction history are tracked separately per
network.

CPN broadcasts a real onchain USDC transfer in both environments. On testnet,
that transfer settles on a testnet blockchain, so the USDC involved has no
real-world value.

## Payment settlement differs end-to-end

The biggest difference is what happens on the fiat leg, when a payment reaches
the Beneficiary Financial Institution (BFI):

* **On mainnet**, a payment settles to a real BFI. It pays out real fiat, using
  real travel rule, beneficiary bank, and
  [request for information (RFI)](/cpn/concepts/compliance/rfis) data.
* **On testnet, a payment never reaches a real BFI.** No real travel rule data
  is exchanged, and no real fiat payout occurs.

Because the final payout is mocked, some settlement artifacts are mocked too.
For example, a payment's
[`fiatNetworkPaymentRef`](/cpn/concepts/payments/payment-reference) doesn't
point to a real fiat network on testnet.

### Simulate outcomes with magic values

Testnet doesn't route to a real BFI. Instead, CPN offers
[magic values](/cpn/references/testing/magic-values) that trigger a chosen
outcome. Use them to test how your integration handles each payment stage. No
real counterparty is needed. Magic values only work on testnet. On mainnet, CPN
treats them as plain input.

## Validation and data differ by environment

* Testnet payments never reach a real institution. Use synthetic travel rule,
  beneficiary bank, and RFI data. Don't use real personal or business
  information.
* Request checks, such as required fields, formats, and limits, mirror mainnet
  closely. This keeps testnet reliable for integration tests.
* Pricing on testnet is approximate. Testnet tokens have no real market value:
  * Exchange rates are a rough estimate from mainnet market data. Expect the
    same trade to price differently on mainnet.
  * Gas rates on testnet are real, but testnet-specific. They move on their own.
    Don't use testnet fees to predict mainnet fees.

## Summary

| Aspect | Mainnet | Testnet |
| - | - | - |
| Onchain USDC transfer | Real, with real value | Real transaction, but no real-world value |
| Fiat payout | Real | Mocked; no real fiat moves |
| Blockchain identifiers | For example, `ETH`, `MATIC`, `SOL` | Separate ID per blockchain, for example `ETH-SEPOLIA`, `MATIC-AMOY`, `SOL-DEVNET` |
| Counterparty (BFI) | Real institution | Mock institution |
| Travel rule, beneficiary bank, and RFI data | Real | Synthetic data recommended |
| Magic values | Not applicable; only real outcomes happen | Supported, to test each payment stage |
| Exchange rates | Real market rates | Rough estimate of mainnet data |
| Gas rates | Real mainnet gas prices | Real, but testnet-only prices |
