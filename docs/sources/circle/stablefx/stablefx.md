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

# StableFX

> Institutional-grade stablecoin FX engine built on Arc

StableFX is an institutional-grade stablecoin FX engine built on Arc that
combines Request-for-Quote (RFQ) execution with onchain settlement. This
permissioned platform is designed for financial institutions including payment
service providers, fintechs, crypto OTC desks, and prime brokers.

StableFX supports USDC and EURC alongside partner stablecoins spanning major
global currencies. For the full list of supported tokens, see
[Supported currencies](/stablefx/references/supported-currencies).

## Key features

<CardGroup cols={3}>
  <Card title="Aggregated Liquidity" icon="chart-network">
    Access competitive rates from multiple liquidity providers through a single
    API call
  </Card>

  <Card title="24/7 Settlement" icon="clock">
    Trade and settle around the clock with sub-second finality on Arc
  </Card>

  <Card title="Simplified Operations" icon="layer-group">
    Replace multiple bilateral agreements with one integration
  </Card>
</CardGroup>

StableFX reduces settlement risk through smart contract escrow that ensures both
sides of a trade settle simultaneously or not at all. With API and SDK-based
integration, you can implement programmatic quote requests and automated
settlement directly into your institutional workflows.

## What you can build

As a vetted institution, you can integrate StableFX to power a range of
financial services. Here are some common use cases:

<AccordionGroup>
  <Accordion title="Cross-border payment flows" icon="globe">
    Build payment systems with real-time currency conversion and settlement that
    enable instant international transfers without traditional correspondent banking
    delays. Your customers can send funds across borders with sub-second finality
    and transparent pricing.
  </Accordion>

  <Accordion title="Institutional treasury management" icon="building-columns">
    Implement automated treasury operations for managing multi-currency stablecoin
    positions. Set up programmatic rebalancing rules and execute trades 24/7 to
    maintain optimal currency allocations across your organization.
  </Accordion>

  <Accordion title="Embedded FX liquidity services" icon="arrows-rotate">
    Offer FX liquidity directly in your platform without building your own matching
    engine or sourcing liquidity. Your customers get seamless access to competitive
    rates and instant settlement while you maintain control over the user
    experience.
  </Accordion>

  <Accordion title="Next-generation remittance solutions" icon="paper-plane">
    Eliminate T+2 settlement delays and counterparty risk by leveraging smart
    contract escrow. Build remittance services with guaranteed simultaneous
    settlement on both sides, reducing operational risk and capital requirements.
  </Accordion>
</AccordionGroup>

## How it works

StableFX operates on a Request-for-Quote (RFQ) model that combines offchain
execution with onchain settlement:

<Steps>
  <Step title="Request a quote">
    Takers request quotes through the API, specifying the currency pair and amount.
    Multiple liquidity providers compete to offer the best rate.
  </Step>

  <Step title="Execute the trade">
    Accept a quote through the API. Execution happens offchain for speed and
    efficiency.
  </Step>

  <Step title="Settle onchain">
    Settlement occurs automatically through smart contract escrow on Arc, ensuring
    payment-versus-payment where both sides settle or neither does.
  </Step>
</Steps>

<Note>
  The StableFX API handles both offchain and onchain steps, so you don't need to
  interact with smart contracts directly.
</Note>

## Get started

<Info>
  Reach out to your [Circle representative](mailto:sales@circle.com) to get an
  API key for StableFX.
</Info>

Try StableFX in the testing environment. Whether you're looking to consume
liquidity as a **taker** or provide liquidity as a **maker**, these quickstart
guides will help you integrate:

<CardGroup cols={2}>
  <Card title="Create an FX trade as a taker" icon="arrow-right-arrow-left" href="/stablefx/quickstarts/fx-trade-taker">
    Request and execute a USDC to EURC trade
  </Card>

  <Card title="Fulfill an FX trade as a maker" icon="coins" href="/stablefx/quickstarts/fx-trade-maker">
    Fulfill existing trades and provide liquidity
  </Card>

  <Card title="Use the StableFX Console" icon="browser" href="/stablefx/concepts/console-overview">
    Trade, settle, and manage your account from the browser. No code required.
  </Card>
</CardGroup>
