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

# Get all trades

> Returns a cursor-paginated list of all trades, newest first by default.

Pagination is navigated through the `Link` response header, not the response body. Follow the
`next` relation to walk the collection and stop when it is no longer returned.

**Incremental sync with `updatedFrom`/`updatedTo`:** use these parameters to fetch only trades
whose status changed since your last poll. When either is provided without `from`/`to`, the
service widens the create-date window to cover the full available trade history so that trades
created long ago but recently updated are not silently excluded.




## OpenAPI

````yaml openapi/stablefx.yaml get /v1/exchange/stablefx/trades
openapi: 3.1.0
info:
  title: StableFX API
  description: >
    The StableFX API provides endpoints for trading stablecoins.


    ## Authentication

    All API requests require authentication using an API key.


    ## Base URL

    The base URL for all API endpoints is:
    `https://api.circle.com/v1/exchange/stablefx`
  version: 1.0.0
servers:
  - url: https://api.circle.com
    description: StableFX API server
security:
  - BearerAuth: []
tags:
  - name: Quotes
    description: Endpoints for creating and managing quotes
  - name: Trades
    description: Endpoints for creating and managing trades
  - name: Signatures
    description: Endpoints for retrieving presign typed data and registering signatures
  - name: Fees
    description: Endpoints for retrieving fees
  - name: Funding
    description: Endpoints for funding trades
  - name: Webhook Subscriptions
    description: Manage subscriptions to notifications
  - name: Settlement Advance
    description: Request, track, and repay settlement advances.
paths:
  /v1/exchange/stablefx/trades:
    get:
      tags:
        - Trades
      summary: Get all trades
      description: >
        Returns a cursor-paginated list of all trades, newest first by default.


        Pagination is navigated through the `Link` response header, not the
        response body. Follow the

        `next` relation to walk the collection and stop when it is no longer
        returned.


        **Incremental sync with `updatedFrom`/`updatedTo`:** use these
        parameters to fetch only trades

        whose status changed since your last poll. When either is provided
        without `from`/`to`, the

        service widens the create-date window to cover the full available trade
        history so that trades

        created long ago but recently updated are not silently excluded.
      operationId: listTrades
      parameters:
        - $ref: '#/components/parameters/Status'
        - $ref: '#/components/parameters/Asset'
        - $ref: '#/components/parameters/Id'
        - $ref: '#/components/parameters/Ids'
        - $ref: '#/components/parameters/PageSize'
        - in: query
          name: pageAfter
          required: false
          description: >
            Cursor -- returns the trades immediately following the trade with
            this id in the current

            sort order. With the default `sortOrder=desc` this advances towards
            older trades.


            Take the value from the `pageAfter` parameter of the `next` link in
            the `Link` response

            header. Cannot be combined with `pageBefore`.
          schema:
            type: string
            format: uuid
            example: 04a4892d-eef4-4df9-a5a4-4ccfc43497d6
        - in: query
          name: pageBefore
          required: false
          description: >
            Cursor -- returns the trades immediately preceding the trade with
            this id in the current

            sort order. With the default `sortOrder=desc` this navigates back
            towards newer trades.


            Take the value from the `pageBefore` parameter of the `prev` link in
            the `Link` response

            header. Cannot be combined with `pageAfter`.
          schema:
            type: string
            format: uuid
            example: 04a4892d-eef4-4df9-a5a4-4ccfc43497d6
        - $ref: '#/components/parameters/From'
        - $ref: '#/components/parameters/To'
        - $ref: '#/components/parameters/UpdatedFrom'
        - $ref: '#/components/parameters/UpdatedTo'
        - in: query
          name: type
          required: true
          description: The type of trade.
          schema:
            $ref: '#/components/schemas/Type'
        - in: query
          name: settlementTransactionHash
          required: false
          description: Filter trades by settlement transaction hash.
          schema:
            type: string
            pattern: ^0x[a-fA-F0-9]{64}$
            example: '0xf97c6a87511583d5c7e8e72f8e1fe38bfd24350edda78fddbe67125f3cf0a122'
        - in: query
          name: sortOrder
          required: false
          description: >-
            Sort order for trades by creation date. Defaults to `desc` (newest
            first).
          schema:
            type: string
            enum:
              - asc
              - desc
            default: desc
      responses:
        '200':
          description: Trade retrieved successfully
          headers:
            Link:
              $ref: '#/components/headers/Link'
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Trade'
      security:
        - BearerAuth: []
components:
  parameters:
    Status:
      name: status
      description: The status of the trade to filter by.
      in: query
      required: false
      schema:
        $ref: '#/components/schemas/TradeStatus'
    Asset:
      name: asset
      description: Filter trades by one or more asset currencies.
      in: query
      required: false
      schema:
        type: array
        items:
          $ref: '#/components/schemas/Currency'
        minItems: 1
      style: form
      explode: true
    Id:
      name: id
      description: Filter trades by a single trade ID or ID prefix.
      in: query
      required: false
      schema:
        type: string
        minLength: 1
        maxLength: 36
    Ids:
      name: ids
      description: Filter trades by one or more trade IDs.
      in: query
      required: false
      schema:
        type: array
        items:
          type: string
          format: uuid
        minItems: 1
      style: form
      explode: true
    PageSize:
      name: pageSize
      description: >
        Limits the number of items to be returned.


        Some collections have a strict upper bound that will disregard this
        value. In case the specified value is higher

        than the allowed limit, the collection limit will be used.


        If avoided, the collection will determine the page size itself.
      in: query
      schema:
        type: integer
        default: 50
        maximum: 200
        minimum: 1
    From:
      name: from
      description: >-
        Queries items created since the specified date-time (inclusive) in ISO
        8601 format.
      in: query
      schema:
        type: string
        format: date-time
        example: '2023-01-01T12:04:05Z'
    To:
      name: to
      description: >-
        Queries items created before the specified date-time (inclusive) in ISO
        8601 format.
      in: query
      schema:
        type: string
        format: date-time
        example: '2023-01-01T12:04:05Z'
    UpdatedFrom:
      name: updatedFrom
      description: >
        Filters trades to those whose `updateDate` is greater than or equal to
        the specified date-time

        (inclusive), in ISO 8601 format.
      in: query
      required: false
      schema:
        type: string
        format: date-time
        example: '2025-01-01T00:00:00Z'
    UpdatedTo:
      name: updatedTo
      description: >
        Filters trades to those whose `updateDate` is less than or equal to the
        specified date-time

        (inclusive), in ISO 8601 format.
      in: query
      required: false
      schema:
        type: string
        format: date-time
        example: '2025-06-01T00:00:00Z'
  schemas:
    Type:
      type: string
      description: The type of trader.
      enum:
        - maker
        - taker
    Trade:
      type: object
      description: A StableFX trade created from a quote.
      properties:
        id:
          $ref: '#/components/schemas/Id'
        contractTradeId:
          $ref: '#/components/schemas/ContractTradeId'
        status:
          $ref: '#/components/schemas/TradeStatus'
        rate:
          $ref: '#/components/schemas/Rate'
        from:
          $ref: '#/components/schemas/CurrencyAmount'
        to:
          $ref: '#/components/schemas/CurrencyAmount'
        fee:
          $ref: '#/components/schemas/Amount'
          description: >-
            Trade fee charged to the requesting party (matching the `type`
            parameter — taker or maker), denominated in the `to` currency.
        createDate:
          $ref: '#/components/schemas/CreateDate'
        updateDate:
          $ref: '#/components/schemas/UpdateDate'
        quoteId:
          $ref: '#/components/schemas/Id'
        settlementTransactionHash:
          $ref: '#/components/schemas/SettlementTransactionHash'
        maturity:
          $ref: '#/components/schemas/Maturity'
        tenor:
          $ref: '#/components/schemas/Tenor'
        completeDate:
          $ref: '#/components/schemas/CompleteDate'
        providerTradeId:
          type:
            - string
            - 'null'
          description: >-
            The liquidity provider's own trade identifier. Populated for makers
            once the LP has confirmed the trade; absent for takers.
    TradeStatus:
      type: string
      enum:
        - pending
        - complete
        - confirmed
        - pending_settlement
        - taker_funded
        - maker_funded
        - refunded
        - breaching
        - breached
    Currency:
      type: string
      description: Currency code
      enum:
        - USDC
        - EURC
    Id:
      type: string
      format: uuid
      description: System-generated unique identifier of the resource.
      example: c4d1da72-111e-4d52-bdbf-2e74a2d803d5
    ContractTradeId:
      type: string
      description: The ID of the trade on the contract.
      pattern: ^[0-9]+$
      example: '24'
    Rate:
      type: number
      format: double
      description: Exchange rate for the quote
      example: 0.915
    CurrencyAmount:
      type: object
      description: Currency and amount details for a foreign exchange transaction
      required:
        - currency
      properties:
        currency:
          $ref: '#/components/schemas/Currency'
        amount:
          $ref: '#/components/schemas/Amount'
    Amount:
      type: string
      pattern: ^\d+(?:\.\d{1,6})?$
      description: Amount of currency, formatted as a string with up to six decimal places.
      example: '100.00'
    CreateDate:
      type: string
      format: date-time
      description: Date and time when the resource was created
      example: '2023-01-01T12:04:05Z'
    UpdateDate:
      type: string
      format: date-time
      description: Date and time when the resource was last updated
      example: '2023-01-01T12:04:05Z'
    SettlementTransactionHash:
      type:
        - string
        - 'null'
      description: The hash of the settlement transaction on-chain.
      pattern: ^0x[a-fA-F0-9]{64}$
      example: '0xf97c6a87511583d5c7e8e72f8e1fe38bfd24350edda78fddbe67125f3cf0a122'
    Maturity:
      type:
        - string
        - 'null'
      format: date-time
      description: The date when the trade has matured.
      example: '2023-01-01T12:04:05Z'
    Tenor:
      type: string
      description: The settlement schedule for the trade
      enum:
        - instant
        - hourly
        - daily
    CompleteDate:
      type:
        - string
        - 'null'
      format: date-time
      description: The time/date the trade was completed.
      example: '2023-01-01T12:04:05Z'
  headers:
    Link:
      required: true
      description: >
        Cursor pagination links for the collection, emitted as one relation per
        `Link` header value.


        `first` and `self` are always returned. `prev` is returned when a
        previous page exists and `next`

        when more results follow; the absence of `next` means the last page has
        been reached.


        Each URL replays the filters from the original request and carries the
        `pageAfter` or `pageBefore`

        cursor together with `pageSize`. Follow these URLs instead of assembling
        cursors yourself.
      schema:
        type: string
      example: >-
        <https://api.circle.com/v1/exchange/stablefx/trades?type=taker&pageSize=50&pageAfter=04a4892d-eef4-4df9-a5a4-4ccfc43497d6>;
        rel="next"
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: PREFIX:ID:SECRET
      description: >-
        Circle's API Keys are formatted in the following structure
        "PREFIX:ID:SECRET". All three parts are requred to make a successful
        request.

````