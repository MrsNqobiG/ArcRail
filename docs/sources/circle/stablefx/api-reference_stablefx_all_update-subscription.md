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

# Update a notification subscription

> Update a notification subscription by configuring an endpoint to receive notifications.




## OpenAPI

````yaml openapi/stablefx.yaml patch /v2/stablefx/notifications/subscriptions/{id}
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
  /v2/stablefx/notifications/subscriptions/{id}:
    patch:
      tags:
        - Webhook Subscriptions
      summary: Update a notification subscription
      description: >
        Update a notification subscription by configuring an endpoint to receive
        notifications.
      operationId: updateSubscription
      parameters:
        - $ref: '#/components/parameters/Id-2'
        - $ref: '#/components/parameters/XRequestId'
      requestBody:
        $ref: '#/components/requestBodies/UpdateSubscription'
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Subscription-2'
          description: Successfully updated webhook subscription
          headers:
            X-Request-Id:
              $ref: '#/components/headers/XRequestId'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/NotAuthorized'
        '404':
          $ref: '#/components/responses/NotFound'
      security:
        - BearerAuth: []
components:
  parameters:
    Id-2:
      name: id
      description: The universally unique identifier of the resource.
      in: path
      required: true
      schema:
        type: string
        format: uuid
        example: b3d9d2d5-4c12-4946-a09d-953e82fae2b0
    XRequestId:
      name: X-Request-Id
      description: >-
        Developer-provided parameter used to identify this request. Useful when
        communicating with Circle Support.
      in: header
      schema:
        $ref: '#/components/schemas/XRequestId'
  requestBodies:
    UpdateSubscription:
      content:
        application/json:
          schema:
            type: object
            required:
              - name
              - enabled
            properties:
              name:
                type: string
                description: Name of the subscription.
                example: Trades Webhook
              enabled:
                type: boolean
                description: >-
                  Whether the subscription is enabled. `true` indicates the
                  subscription is active.
                example: true
      required: true
      description: Schema for the request payload to update a subscription.
  schemas:
    Subscription-2:
      title: SubscriptionResponse
      type: object
      properties:
        data:
          $ref: '#/components/schemas/Subscription'
    XRequestId:
      type: string
      description: >-
        A unique identifier, which can be helpful for identifying a request when
        communicating with Circle support.
      example: 2adba88e-9d63-44bc-b975-9b6ae3440dde
      format: uuid
    Subscription:
      type: object
      title: Subscription
      description: Contains information about a webhook notification subscription.
      required:
        - id
        - name
        - endpoint
        - enabled
        - createDate
        - updateDate
      properties:
        id:
          $ref: '#/components/schemas/Id'
        name:
          type: string
          description: Name of the webhook notification subscription.
          example: Transactions Webhook
        endpoint:
          type: string
          description: >-
            URL of the endpoint subscribing to notifications. Must be enabled to
            receive notifications.
          example: https://example.org/handler/for/notifications
        enabled:
          type: boolean
          description: >-
            Whether the subscription is enabled. `true` indicates the
            subscription is enabled.
          example: true
        createDate:
          $ref: '#/components/schemas/CreateDate'
        updateDate:
          $ref: '#/components/schemas/UpdateDate'
        notificationTypes:
          type: array
          description: The notification types on which a notification will be sent.
          items:
            $ref: '#/components/schemas/NotificationType'
          example:
            - '*'
        restricted:
          type: boolean
          description: >-
            Whether the webhook is restricted to specific notification types. An
            unrestricted webhook will notify on all notification types. A
            restricted webhook will only notify on the notification types in the
            `notificationTypes` field.
          example: false
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
    Id:
      type: string
      format: uuid
      description: System-generated unique identifier of the resource.
      example: c4d1da72-111e-4d52-bdbf-2e74a2d803d5
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
    NotificationType:
      type: string
      description: >
        The type of notification that can be subscribed to. 

        Supports wildcard patterns (e.g., 'stablefx.trade.*') to subscribe to
        all notifications within a category.

        The '*' wildcard can be used to subscribe to all notifications.
      enum:
        - '*'
        - stablefx.trade.*
        - stablefx.trade.confirmed
        - stablefx.trade.pendingSettlement
        - stablefx.trade.makerFunded
        - stablefx.trade.makerDelegateFunded
        - stablefx.trade.takerFunded
        - stablefx.trade.takerDelegateFunded
        - stablefx.trade.completed
        - stablefx.trade.refunded
        - stablefx.trade.failed
        - stablefx.trade.breached
        - stablefx.contract.*
        - stablefx.contract.recordTrade.failed
        - stablefx.contract.makerDeliver.failed
        - stablefx.contract.makerDelegateDeliver.failed
        - stablefx.contract.takerDeliver.failed
        - stablefx.contract.takerDelegateDeliver.failed
      example: stablefx.trade.confirmed
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
  responses:
    BadRequest:
      content:
        application/json:
          schema:
            type: object
            title: BadRequestResponse
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
            example:
              code: 400
              message: Bad request.
      description: Request cannot be processed due to a client error.
      headers:
        X-Request-Id:
          $ref: '#/components/headers/XRequestId'
    NotAuthorized:
      content:
        application/json:
          schema:
            type: object
            title: NotAuthorizedResponse
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
            example:
              code: 401
              message: Malformed authorization.
      description: >-
        Request has not been applied because it lacks valid authentication
        credentials.
      headers:
        X-Request-Id:
          $ref: '#/components/headers/XRequestId'
    NotFound:
      content:
        application/json:
          schema:
            type: object
            title: NotFoundResponse
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
            example:
              code: 404
              message: Not found.
      description: Specified resource was not found.
      headers:
        X-Request-Id:
          $ref: '#/components/headers/XRequestId'
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