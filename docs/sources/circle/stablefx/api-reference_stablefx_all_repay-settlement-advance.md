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

# Repay a settlement advance

> Records a repayment against the credit line backing a settlement advance.
Any excess would be balance of the Circle Mint account.

**Rounding**: for USDC and EURC repayments, the amount should be rounded
up to 2 decimal places. Other stablecoins (e.g. MXNB, QCAD, AUDF, ZARU)
are not subject to rounding.

Idempotent on `idempotencyKey`: replays with the same key and same
amount are no-ops.




## OpenAPI

````yaml openapi/stablefx.yaml post /v1/exchange/stablefx/settlementAdvances/repayments
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
  /v1/exchange/stablefx/settlementAdvances/repayments:
    post:
      tags:
        - Settlement Advance
      summary: Repay a settlement advance
      description: >
        Records a repayment against the credit line backing a settlement
        advance.

        Any excess would be balance of the Circle Mint account.


        **Rounding**: for USDC and EURC repayments, the amount should be rounded

        up to 2 decimal places. Other stablecoins (e.g. MXNB, QCAD, AUDF, ZARU)

        are not subject to rounding.


        Idempotent on `idempotencyKey`: replays with the same key and same

        amount are no-ops.
      operationId: repaySettlementAdvance
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RepaySettlementAdvance'
      responses:
        '201':
          description: Repayment recorded successfully.
          headers:
            X-Request-Id:
              $ref: '#/components/headers/XRequestId'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SettlementAdvanceRepayment'
        '400':
          description: Invalid request or repayment rejected.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Credit line not found.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '409':
          description: Idempotency key reused with different request parameters.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
      security:
        - BearerAuth: []
components:
  schemas:
    RepaySettlementAdvance:
      type: object
      description: Request body for repaying a settlement advance.
      required:
        - idempotencyKey
        - amount
      properties:
        idempotencyKey:
          $ref: '#/components/schemas/IdempotencyKey'
        amount:
          $ref: '#/components/schemas/SettlementAdvanceCurrencyAmount'
    SettlementAdvanceRepayment:
      type: object
      description: Settlement advance repayment.
      required:
        - id
        - amount
        - status
        - createDate
        - updateDate
      properties:
        id:
          $ref: '#/components/schemas/Id'
        amount:
          $ref: '#/components/schemas/SettlementAdvanceCurrencyAmount'
        status:
          $ref: '#/components/schemas/RepaymentStatus'
        createDate:
          $ref: '#/components/schemas/CreateDate'
        updateDate:
          $ref: '#/components/schemas/UpdateDate'
    Error:
      title: Error
      type: object
      required:
        - code
        - message
      properties:
        code:
          $ref: '#/components/schemas/ErrorCode'
        message:
          type: string
          description: Human-readable message that describes the error.
          example: Unknown error occurred
        errors:
          type: array
          description: Array of detailed error descriptions
          items:
            $ref: '#/components/schemas/DescriptiveError'
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
    SettlementAdvanceCurrencyAmount:
      type: object
      description: Currency and amount for settlement advance flows.
      required:
        - currency
        - amount
      properties:
        currency:
          $ref: '#/components/schemas/SettlementAdvanceCurrency'
        amount:
          $ref: '#/components/schemas/Amount'
    XRequestId:
      type: string
      description: >-
        A unique identifier, which can be helpful for identifying a request when
        communicating with Circle support.
      example: 2adba88e-9d63-44bc-b975-9b6ae3440dde
      format: uuid
    Id:
      type: string
      format: uuid
      description: System-generated unique identifier of the resource.
      example: c4d1da72-111e-4d52-bdbf-2e74a2d803d5
    RepaymentStatus:
      type: string
      description: Status of a settlement advance repayment.
      enum:
        - pending
        - completed
        - failed
      example: pending
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
    ErrorCode:
      title: ErrorCode
      type: integer
      description: The code that corresponds to the error.
      enum:
        - -1
        - 0
        - 1
        - 2
        - 3
        - 400
        - 401
        - 403
        - 404
    DescriptiveError:
      title: DescriptiveError
      type: object
      required:
        - error
        - message
      properties:
        error:
          $ref: '#/components/schemas/DescriptiveErrorType'
        location:
          type:
            - string
            - 'null'
          description: The key or path where the error occurred
        message:
          type: string
          description: Detailed description of the error
    SettlementAdvanceCurrency:
      type: string
      description: Currency code for settlement advance flows.
      example: USDC
    Amount:
      type: string
      pattern: ^\d+(?:\.\d{1,6})?$
      description: Amount of currency, formatted as a string with up to six decimal places.
      example: '100.00'
    DescriptiveErrorType:
      title: DescriptiveErrorType
      type: string
      enum:
        - MISSING_OR_INVALID_FIELD
      description: Type of descriptive error
  headers:
    XRequestId:
      description: >
        Circle-generated universally unique identifier (UUID v4). Useful for
        identifying a specific request when communicating with Circle Support.
      schema:
        $ref: '#/components/schemas/XRequestId'
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