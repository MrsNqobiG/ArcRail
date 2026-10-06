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

# Create a trade

> Accepts a quote and creates a trade.



## OpenAPI

````yaml openapi/stablefx.yaml post /v1/exchange/stablefx/trades
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
    post:
      tags:
        - Trades
      summary: Create a trade
      description: Accepts a quote and creates a trade.
      operationId: createTrade
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTrade'
      responses:
        '200':
          description: Trade created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Trade'
      security:
        - BearerAuth: []
components:
  schemas:
    CreateTrade:
      type: object
      description: >-
        Request body for creating a trade. Accepts a quote and submits a signed
        taker Permit2 message to create the trade. The taker signs the
        `typedData` payload returned by the presign endpoint and includes the
        signed message, signature, and signer address.
      required:
        - idempotencyKey
        - quoteId
        - address
        - message
        - signature
      properties:
        idempotencyKey:
          $ref: '#/components/schemas/IdempotencyKey'
        quoteId:
          $ref: '#/components/schemas/Id'
        address:
          $ref: '#/components/schemas/BlockchainAddress'
          description: The wallet address signing the trade presign data.
        message:
          $ref: '#/components/schemas/TakerPermit2Message'
          description: >-
            The taker Permit2 message derived from the quote response
            typedData.message.
        signature:
          type: string
          description: The signature generated from signing the trade presign data.
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
    IdempotencyKey:
      type: string
      description: >-
        Universally unique identifier (UUID v4) idempotency key. This key is
        utilized to ensure exactly-once execution of mutating requests. To
        create a UUIDv4 go to
        [uuidgenerator.net](https://www.uuidgenerator.net). If the same key is
        reused, it will be treated as the same request and the original response
        will be returned.
      example: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
      format: uuid
    Id:
      type: string
      format: uuid
      description: System-generated unique identifier of the resource.
      example: c4d1da72-111e-4d52-bdbf-2e74a2d803d5
    BlockchainAddress:
      type: string
      description: A blockchain address
      example: '0x1234567890abcdef1234567890abcdef12345678'
    TakerPermit2Message:
      type: object
      description: >-
        The taker Permit2 message for trade creation. Contains the signed
        Permit2 witness transfer data including taker-specific witness details
        with consideration, recipient, and fee.
      required:
        - permitted
        - spender
        - nonce
        - deadline
        - witness
      properties:
        permitted:
          $ref: '#/components/schemas/TokenPermissions'
        spender:
          type: string
          description: The address of the StableFX contract
          example: '0xa8f94168b4981840ba27d423f4ad6332bedee006'
        nonce:
          type: string
          description: >-
            A unique nonce for the signature to prevent replay attacks, as a
            string representation of a uint256
          example: '309585810'
        deadline:
          type: string
          format: epoch
          description: >-
            The validity period for the signature in epoch seconds, as a string
            representation of a uint256
          example: '1770302983'
        witness:
          type: object
          description: Witness data containing taker trade details
          required:
            - consideration
            - recipient
            - fee
          properties:
            consideration:
              $ref: '#/components/schemas/TradeSignatureConsideration'
            recipient:
              type: string
              description: The address of the recipient of the trade
              example: '0x1f531ce3c418bbd830d06138a9e5b5eacfdfb3d6'
            fee:
              type: string
              description: The fee for the trade, as a string representation of a uint256
              example: '80000'
    ContractTradeId:
      type: string
      description: The ID of the trade on the contract.
      pattern: ^[0-9]+$
      example: '24'
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
    TokenPermissions:
      type: object
      description: Token permissions for Permit2
      required:
        - token
        - amount
      properties:
        token:
          type: string
          description: The token contract address
          example: 0xTOKEN
        amount:
          type: string
          description: >-
            The amount of tokens permitted, as a string representation of a
            uint256.
          example: '1000'
    TradeSignatureConsideration:
      type: object
      description: EIP-712 typed data for a StableFX trade created from a quote.
      properties:
        quoteId:
          type: string
        base:
          type: string
        quote:
          type: string
        baseAmount:
          type: string
        quoteAmount:
          type: string
        maturity:
          type: string
          format: epoch
          description: >-
            The settlement maturity timestamp for the trade, as a string
            representation of a uint256
          example: '1716153600'
    Currency:
      type: string
      description: Currency code
      enum:
        - USDC
        - EURC
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