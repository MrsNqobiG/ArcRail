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

# Request a settlement advance

> Submit the Permit2 signature generated from the presign endpoint along with
the witness payload. Funding runs asynchronously after this call returns.

Idempotent on `tradeId`: replays for the same trade either return the
in-progress settlement advance or short-circuit when the trade already
has a non-failed active settlement advance.

Calling `/reserve` first is optional. The request body is the same
whether or not a prior reservation exists.

**Collateral rounding**: when the repayment is complete and collateral is
released, Circle rounds the collateral amount to 2 decimal places.




## OpenAPI

````yaml openapi/stablefx.yaml post /v1/exchange/stablefx/settlementAdvances
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
  /v1/exchange/stablefx/settlementAdvances:
    post:
      tags:
        - Settlement Advance
      summary: Request a settlement advance
      description: >
        Submit the Permit2 signature generated from the presign endpoint along
        with

        the witness payload. Funding runs asynchronously after this call
        returns.


        Idempotent on `tradeId`: replays for the same trade either return the

        in-progress settlement advance or short-circuit when the trade already

        has a non-failed active settlement advance.


        Calling `/reserve` first is optional. The request body is the same

        whether or not a prior reservation exists.


        **Collateral rounding**: when the repayment is complete and collateral
        is

        released, Circle rounds the collateral amount to 2 decimal places.
      operationId: requestSettlementAdvance
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AcceptSettlementAdvance'
      responses:
        '200':
          description: Settlement advance requested; funding in progress.
          headers:
            X-Request-Id:
              $ref: '#/components/headers/XRequestId'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SettlementAdvanceAccepted'
        '400':
          description: >
            Invalid request, signature mismatch, duplicate settlement advance,
            or credit limit exceeded.


            Relevant error codes:

            - `301031` (`INSUFFICIENT_CREDIT_LINE_FUNDS`) — the requested
            advance amount exceeds one of
              two limits enforced at creation time:
              1. **USD headroom**: the USD-equivalent of the advance exceeds the credit line's remaining USD balance.
              2. **Available-in-currency**: the advance amount (in the requested currency) exceeds the
                 per-currency pool available for that stablecoin. Check the `availableInCurrencies` field
                 on the credit line before requesting.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Trade or credit line not found.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '422':
          description: >
            The quoted exchange rate diverges from the live reference rate by
            more than the

            configured risk margin.


            Relevant error codes:

            - `301098` (`STABLE_FX_QUOTE_PRICE_DIVERGENCE`) — quote rate is
            outside the acceptable
              spread from the current TER fiat reference rate. Submit a fresh quote and retry.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '429':
          description: >
            Settlement advance creation rate limit exceeded. The credit line has
            had too many

            advances created within the configured time window.


            Relevant error codes:

            - `301099` (`SETTLEMENT_ADVANCE_RATE_LIMITED`) — wait before
            retrying.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
      security:
        - BearerAuth: []
components:
  schemas:
    AcceptSettlementAdvance:
      type: object
      description: >-
        Request body for accepting a settlement advance by submitting a Permit2
        signature.
      required:
        - idempotencyKey
        - tradeId
        - permit2
        - signature
      properties:
        idempotencyKey:
          $ref: '#/components/schemas/IdempotencyKey'
        tradeId:
          type: string
          description: Trade identifier.
          example: trade-abc-123
        permit2:
          $ref: '#/components/schemas/DelegateFundingPermit2'
        signature:
          type: string
          description: >-
            Maker's Permit2 signature over the typed data (0x-prefixed, 65 bytes
            hex).
          example: 0x6f5a...c1b9
    SettlementAdvanceAccepted:
      type: object
      description: Settlement advance accepted; funding in progress.
      required:
        - advanceId
        - tradeId
        - status
      properties:
        advanceId:
          $ref: '#/components/schemas/Id'
        tradeId:
          $ref: '#/components/schemas/Id'
        status:
          $ref: '#/components/schemas/AdvanceCreditStatus'
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
    DelegateFundingPermit2:
      type: object
      description: >-
        Permit2 PermitWitnessTransferFrom payload with
        DelegateFundingAuthorization witness. The `permitted.amount` is always 0
        -- Permit2 is used as an authorization carrier, no tokens transfer from
        the trader.
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
          description: FxEscrow contract address.
          example: 0xFxEscrow000000000000000000000000000000000
        nonce:
          type: string
          description: Permit2 nonce, as a string representation of a uint256.
          example: '1234567890'
        deadline:
          type: string
          description: >-
            Permit2 deadline (unix timestamp), as a string representation of a
            uint256.
          example: '1782556800'
        witness:
          $ref: '#/components/schemas/DelegateFundingAuthorization'
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
    AdvanceCreditStatus:
      type: string
      description: >
        Lifecycle status of the credit advanced against a settlement.

        - `funds_reserved` -- credit reserved on the line, awaiting maker
        action.

        - `requested` -- maker submitted the request; Circle is moving funds.

        - `disbursed` -- funds delivered to the funder passthrough wallet.

        - `past_due` -- repayment window has elapsed without full repayment.

        - `paid` -- credit fully repaid.

        - `rejected` -- credit line rejected the advance request.

        - `expired` -- reservation expired before being consumed.

        - `canceled` -- maker or Circle canceled the advance.
      enum:
        - funds_reserved
        - requested
        - disbursed
        - past_due
        - paid
        - rejected
        - expired
        - canceled
      example: disbursed
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
    DelegateFundingAuthorization:
      type: object
      description: >-
        DelegateFundingAuthorization witness binding the Permit2 authorization
        to a specific trade, funder, recipient, token, and amount.
      required:
        - id
        - funder
        - recipient
        - token
        - amount
      properties:
        id:
          type: string
          description: On-chain trade id (uint256).
          example: '987654321'
        funder:
          type: string
          description: >-
            Address of the funder wallet (Circle-controlled) authorized to
            deliver tokens on the trader's behalf.
          example: 0xLLCFunderPW...address
        recipient:
          type: string
          description: Address that receives the delivered tokens.
          example: 0xLLCEscrowPW...address
        token:
          type: string
          description: ERC-20 contract address of the token to be delivered.
          example: 0xMXNB...address
        amount:
          type: string
          description: >-
            Amount to be delivered by the funder, in token units (uint256, no
            decimals). Tokens use 6 decimal places, so 5000.00 MXNB is
            represented as "5000000000".
          example: '5000000000'
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