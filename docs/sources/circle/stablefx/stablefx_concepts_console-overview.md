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

# StableFX Console

> A self-service interface for trading stablecoins, managing API keys, and settling trades onchain—no code required.

The [StableFX](/stablefx) Console gives you a browser-based alternative to the
API—useful for manual trading, onboarding verification, and exploring the
platform before automating with code. To get started immediately, see
[Execute your first trade](/stablefx/quickstarts/console-first-trade).

<CardGroup cols={2}>
  <Card title="Live FX Rates" icon="chart-line">
    View real-time exchange rates for all supported currency pairs, updated
    every 30 seconds.
  </Card>

  <Card title="Trade Execution" icon="arrow-right-arrow-left">
    Request quotes, lock rates, and create trades through a guided side-panel
    workflow.
  </Card>

  <Card title="Wallet Connection" icon="wallet">
    Connect an EVM-compatible wallet to sign trades and fund settlements
    directly from the console.
  </Card>

  <Card title="Trade Management" icon="table">
    View, filter, and manage your trade history. Settle individual trades or
    batch-fund multiple trades at once.
  </Card>
</CardGroup>

## Who is the console for?

The console serves two primary user types:

* **Takers** request quotes, create trades, and fund settlements. This is the
  primary trading experience.
* **Makers** review confirmed trades, sign them to confirm intent, and fund
  their side of the settlement.

You can switch between Taker and Maker views at any time using the account type
dropdown in the sidebar navigation, where the Taker view is labeled **Trade**
and the Maker view is labeled **Fulfill**. For details on what each role can
access, see
[Roles and permissions](/stablefx/references/console-roles-permissions).

<Note>
  The console requires an active StableFX account. If you haven't onboarded yet,
  contact your Circle representative or visit the console to begin the
  onboarding process. To complete onboarding and execute your first trade, see
  [Get started with the console](/stablefx/quickstarts/console-first-trade).
</Note>

## Console pages

<Frame caption="The StableFX Console home page in sandbox mode">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/console-home-page.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=ba99e3874e60dc43086f11137830524f" width="1412" height="1250" data-path="stablefx/images/console-home-page.png" />
</Frame>

The console has four main areas:

| Page | Route | Description |
| - | - | - |
| **Home** | `/fx/home` | Dashboard with onboarding status, live rates, and a quick-access trade form. |
| **Overview** | `/fx/overview` | Live rates card and a preview of your recent trades. |
| **Trades** | `/fx/trades` | Full trade history with filtering, sorting, pagination, and batch settlement. |
| **Onboarding** | `/fx/onboarding/kyb` | Complete your KYB verification to unlock trading capabilities. |

## How trading works in the console

Trading in the console follows the same three-phase model as the API, presented
as a guided workflow in a side panel:

<Steps>
  <Step title="Request a quote">
    Enter the currency pair, amount, and settlement tenor. The console fetches a
    live quote and displays the exchange rate, fees, and collateral
    requirements.
  </Step>

  <Step title="Connect wallet and sign">
    Connect an EVM-compatible wallet (such as MetaMask). The console prompts you
    to sign EIP-712 typed data to authorize the trade and any required token
    approvals via the Permit2 contract. See [Connect your
    wallet](/stablefx/howtos/connect-wallet-console) for setup instructions.
  </Step>

  <Step title="Fund and settle">
    After both parties have signed, fund your side of the trade. The console
    generates Permit2 signature data, which you sign with your wallet. Once both
    sides are funded, the FxEscrow smart contract on Arc settles the trade
    automatically.
  </Step>
</Steps>

For detailed step-by-step instructions, see:

* [Create a trade as a taker](/stablefx/howtos/create-trade-console): Request a
  quote, sign, and create a trade through the console.
* [Fulfill a trade as a maker](/stablefx/howtos/fulfill-trade-console): Sign and
  fund confirmed trades from the maker view.
* [Settle trades](/stablefx/howtos/settle-trades-console): Fund individual or
  batch trades for onchain settlement.

<Frame caption="The Trades page with filtering, multiple currency pairs, and status indicators">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/trades-table-full.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=57dcddf3eb767f04598eda3b997dda78" width="1006" height="704" data-path="stablefx/images/trades-table-full.png" />
</Frame>

## Console vs. API

The console and the [StableFX API](/stablefx) provide the same underlying
capabilities. Choose the approach that fits your workflow:

| | Console | API |
| - | - | - |
| **Best for** | Manual trading, testing, exploring StableFX | Automated trading, programmatic integration |
| **Authentication** | Browser session (Circle account login) | API key (`Bearer` token) |
| **Wallet signing** | Built-in wallet connection (Dynamic.xyz) | Your own signing infrastructure |
| **Batch settlement** | Visual multi-select and one-click funding | `POST /v1/exchange/stablefx/fund` with multiple contract trade IDs |
| **Rate streaming** | Auto-refreshing rates card (30-second interval) | Poll `POST /v1/exchange/stablefx/quotes` with `type: reference` |

<Tip>
  You can use both the console and the API with the same StableFX account.
  Trades created via the API appear in the console, and vice versa.
</Tip>

## Supported currencies

The console supports the same currency pairs as the StableFX API. One side of
every trade must be USDC.

See [Supported currencies](/stablefx/references/supported-currencies) for the
current list.
