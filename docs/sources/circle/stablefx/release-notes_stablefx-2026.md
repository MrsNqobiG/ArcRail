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

# Release notes - StableFX - 2026

> 2026 release notes for StableFX

## September 2026

<Update label="2026.09.16">
  ### Blockchain expansion

  Added Arc mainnet as a supported blockchain for StableFX.

  Updated topics:

  * [Technical guide](/stablefx/concepts/technical-guide)
  * [How-to: Connect a wallet in the console](/stablefx/howtos/connect-wallet-console)
  * [How-to: Create a trade in the console](/stablefx/howtos/create-trade-console)
  * [How-to: Fulfill a trade in the console](/stablefx/howtos/fulfill-trade-console)
</Update>

## July 2026

<Update label="2026.07.31">
  ### API additions

  [`GET /v1/exchange/stablefx/trades`](/api-reference/stablefx/all/list-trades)
  now supports page token navigation:

  * `pageAfter` and `pageBefore` query parameters navigate through trade history
    relative to the current `sortOrder`. Only one can be provided per request.
  * All successful responses include a `Link` header with `first` and `self`
    relations. `next` is included when more results follow and `prev` when a
    previous page exists. Follow the URLs in the header directly rather than
    building page token values yourself.
</Update>

<Update label="2026.07.22">
  ### API additions

  * [`GET /v1/exchange/stablefx/trades`](/api-reference/stablefx/all/list-trades)
    now accepts a `sortOrder` query parameter (`asc` or `desc`, default `desc`) to
    control the order in which trades are returned.
  * [`GET /v1/exchange/stablefx/trades/{tradeId}`](/api-reference/stablefx/all/get-trade-by-id)
    now returns a `providerTradeId` field. This field was already available in the
    list response.
</Update>

<Update label="2026.07.10">
  ### Breaking API changes

  Settlement Advance endpoints now use plural URL path segments. Update your
  integration to call the new paths.

  | Previous path | New path |
  | - | - |
  | `/v1/exchange/stablefx/settlementAdvance` | `/v1/exchange/stablefx/settlementAdvances` |
  | `/v1/exchange/stablefx/settlementAdvance/{advanceId}` | `/v1/exchange/stablefx/settlementAdvances/{advanceId}` |
  | `/v1/exchange/stablefx/settlementAdvance/credit` | `/v1/exchange/stablefx/settlementAdvances/credit` |
  | `/v1/exchange/stablefx/settlementAdvance/reserve` | `/v1/exchange/stablefx/settlementAdvances/reserve` |
  | `/v1/exchange/stablefx/settlementAdvance/reservation` | `/v1/exchange/stablefx/settlementAdvances/reservations` |
  | `/v1/exchange/stablefx/settlementAdvance/reservation/{id}` | `/v1/exchange/stablefx/settlementAdvances/reservations/{id}` |
  | `/v1/exchange/stablefx/settlementAdvance/repayment` | `/v1/exchange/stablefx/settlementAdvances/repayments` |
  | `/v1/exchange/stablefx/signatures/settlementAdvance/presign` | `/v1/exchange/stablefx/signatures/settlementAdvances/presign` |

  See the [StableFX API reference](/api-reference/stablefx) for the complete list
  of updated endpoints.

  ### API updates

  Trade schemas now include a `fee` field so you can see the fee applied to a
  trade directly in the trade response. See
  [Create a trade](/api-reference/stablefx/all/create-trade) and
  [Get a trade by ID](/api-reference/stablefx/all/get-trade-by-id).
</Update>

## June 2026

<Update label="2026.06.25">
  ### API updates

  Typed-data message fields that carry `uint256` onchain values now use the
  `string` type instead of `integer`. These values can exceed JavaScript's
  safe-integer range (2^53). Sending them as strings prevents precision loss and
  matches the data you sign.

  The change applies to the `nonce`, `deadline`, `fee`, and `amount` fields in the
  Permit2 message and witness schemas. You use these schemas when you sign
  StableFX trades and funding authorizations. Update your integration to send and
  parse these fields as strings.
</Update>

<Update label="2026.06.24">
  ### API additions

  Added the following endpoints to read Settlement Advance reservations:

  * [`GET /v1/exchange/stablefx/settlementAdvance/reservation`](/api-reference/stablefx/all/list-settlement-advance-reservations)
  * [`GET /v1/exchange/stablefx/settlementAdvance/reservation/{reservationId}`](/api-reference/stablefx/all/get-settlement-advance-reservation)
</Update>

<Update label="2026.06.08">
  Added Settlement Advance, which lets a maker borrow local stablecoin inventory
  against a Circle-issued credit line to fund and instantly settle a confirmed
  StableFX trade.

  ### Documentation additions

  The following documentation was created:

  * [StableFX settlement advance](/stablefx/concepts/settlement-advance)
  * [How-to: Fund a trade with a settlement advance](/stablefx/howtos/fund-trade-settlement-advance)

  ### API additions

  Added the following endpoints to support Settlement Advance:

  * [`GET /v1/exchange/stablefx/settlementAdvance/credit`](/api-reference/stablefx/all/get-settlement-advance-credit)
  * [`POST /v1/exchange/stablefx/settlementAdvance/reserve`](/api-reference/stablefx/all/reserve-settlement-advance)
  * [`POST /v1/exchange/stablefx/signatures/settlementAdvance/presign`](/api-reference/stablefx/all/presign-settlement-advance)
  * [`POST /v1/exchange/stablefx/settlementAdvance`](/api-reference/stablefx/all/request-settlement-advance)
  * [`GET /v1/exchange/stablefx/settlementAdvance/{advanceId}`](/api-reference/stablefx/all/get-settlement-advance-detail)
  * [`GET /v1/exchange/stablefx/settlementAdvances`](/api-reference/stablefx/all/list-settlement-advances)
  * [`POST /v1/exchange/stablefx/settlementAdvance/repayment`](/api-reference/stablefx/all/repay-settlement-advance)
</Update>

## April 2026

<Update label="2026.04.14">
  ### Documentation additions

  Added the following new topic for StableFX API limits:

  * [StableFX API rate limits](/stablefx/references/api-rate-limits)
</Update>

## February 2026

<Update label="2026.02.06">
  ### Documentation additions

  Added the following new topic to document the StableFX trade lifecycle:

  * [StableFX trade states](/stablefx/references/trade-states)
</Update>

<Update label="2026.02.04">
  Added StableFX webhook documentation and subscription management API references.

  ### Documentation additions

  The following documentation was created:

  * [How-to: Set up a webhook endpoint](/api-reference/webhook-endpoints)
  * [How-to: Verify webhook signatures](/api-reference/verify-webhook-signatures)

  ### API additions

  Added the following endpoints to support StableFX webhook subscriptions:

  * [`POST /v1/stablefx/notifications/subscriptions`](/api-reference/stablefx/all/create-subscription)
  * [`GET /v1/stablefx/notifications/subscriptions`](/api-reference/stablefx/all/get-subscriptions)
  * [`GET /v1/stablefx/notifications/subscriptions/{id}`](/api-reference/stablefx/all/get-subscription)
  * [`PUT /v1/stablefx/notifications/subscriptions/{id}`](/api-reference/stablefx/all/update-subscription)
  * [`DELETE /v1/stablefx/notifications/subscriptions/{id}`](/api-reference/stablefx/all/delete-subscription)
  * [`GET /v1/stablefx/notifications/signatures/{notificationId}`](/api-reference/stablefx/all/get-notification-signature)
</Update>

## January 2026

<Update label="2026.01.22">
  Updated StableFX documentation to reflect the latest API environments.

  ### Documentation updates

  The following documentation was updated:

  * [StableFX technical guide](/stablefx/concepts/technical-guide)
  * [Fulfill an FX trade as a maker](/stablefx/quickstarts/fx-trade-maker)
  * [Create an FX trade as a taker](/stablefx/quickstarts/fx-trade-taker)
  * [Test StableFX Integration as a Maker](/stablefx/tutorials/test-stablefx-integration-maker)
  * [Test StableFX Integration as a Taker](/stablefx/tutorials/test-stablefx-integration-taker)
</Update>
