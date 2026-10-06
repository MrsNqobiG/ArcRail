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

# Circle Payments Network

> Move and settle money globally through Circle Payments Network, a stablecoin payments network for accepting, converting, moving, and settling funds with USDC.

Circle Payments Network (CPN) is Circle's stablecoin payments network for global
money movement. Built and powered by Circle, the issuer of USDC, it gives
financial institutions and enterprises a single integration to accept, convert,
move, and settle funds.

Move money near-instantly, 24/7, on programmable stablecoin rails. Each payment
product handles a specific job, so you can pick what you need today and add more
as your business grows.

## Operating modes

Circle builds and powers every CPN payment. You choose who operates the payment
lifecycle, and you can change modes without re-integrating as your business
grows. The two modes differ in who holds the stablecoins and who owns licensing,
custody, and compliance.

* **Self-managed**: You operate your own stablecoin lifecycle, including
  custody, payouts, and compliance. Circle provides the rails, APIs, and
  routing. Choose this mode when you hold stablecoins directly and want control
  over the flow of funds.
* **Managed**: Circle handles licensing, custody, compliance, treasury, and
  settlement on your behalf. Choose this mode when you want stablecoin payments
  without holding digital assets or building onchain systems.

## Products

<CardGroup cols={3}>
  <Card title="Fiat Payouts" icon="building-columns" href="/cpn/fiat-payouts">
    Send cross-border fiat payouts through a network of payout partners. Request
    real-time FX quotes, settle in USDC onchain, and let partners deliver local
    fiat to the receiver.
  </Card>

  <Card title="Stablecoin Payments" icon="coins" href="/cpn/stablecoin-payments">
    Send USDC or EURC to third-party wallets with Stablecoin Payouts, and accept
    it from third parties onchain with Stablecoin Payins. Both support Address
    Book and Travel Rule data.
  </Card>

  <Card title="Managed Payments" icon="wallet" href="/cpn/managed-payments">
    Offer stablecoin payins, payouts, and digital asset accounts to your
    end-customers without holding digital assets. Circle runs custody,
    compliance, and onchain activity while you stay in fiat at the edge.
  </Card>
</CardGroup>

## Choose a product

The following table maps each product to its operating mode and primary use
case.

| Product | Operating mode | Use it to |
| - | - | - |
| Fiat Payouts | Self-managed | Settle cross-border payments in USDC and deliver local fiat to receivers through payout partners. |
| Stablecoin Payouts | Self-managed | Send USDC or EURC to third-party wallets you register and approve. |
| Stablecoin Payins | Self-managed | Accept USDC or EURC from third parties into a deposit address. |
| Managed Payments | Managed | Operate fully in fiat while Circle powers stablecoin payments behind the scenes. |

## Get started

<CardGroup cols={3}>
  <Card title="Integrate Fiat Payouts" icon="rocket" href="/cpn/quickstarts/integrate-with-cpn-ofi">
    Request a quote, create a payment, complete the onchain USDC transfer, and
    track status as an Originating Financial Institution.
  </Card>

  <Card title="Send a Stablecoin Payout" icon="paper-plane" href="/cpn/stablecoin-payments/howtos/send-stablecoin-payout">
    Register a recipient in the Address Book and send USDC or EURC onchain to a
    third party.
  </Card>

  <Card title="Receive a Stablecoin Payin" icon="arrow-down-long" href="/cpn/stablecoin-payments/howtos/receive-stablecoin-payin">
    Create a payment intent, share the deposit address, and confirm the payment
    when it settles.
  </Card>
</CardGroup>
