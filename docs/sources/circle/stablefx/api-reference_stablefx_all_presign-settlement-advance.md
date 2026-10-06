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

# Get settlement advance Permit2 typed data for signing

> Returns Permit2 typed-data the maker signs to authorize delegate funding
of their side of a trade. The witness is a `DelegateFundingAuthorization`
with `permitted.amount = 0` -- Permit2 is used purely as an authorization
carrier, no tokens transfer from the maker.

Stateless: no persistence, no side effects.




## OpenAPI

````yaml openapi/stablefx.yaml post /v1/exchange/stablefx/signatures/settlementAdvances/presign
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
  /v1/exchange/stablefx/signatures/settlementAdvances/presign:
    post:
      tags:
        - Signatures
      summary: Get settlement advance Permit2 typed data for signing
      description: >
        Returns Permit2 typed-data the maker signs to authorize delegate funding

        of their side of a trade. The witness is a
        `DelegateFundingAuthorization`

        with `permitted.amount = 0` -- Permit2 is used purely as an
        authorization

        carrier, no tokens transfer from the maker.


        Stateless: no persistence, no side effects.
      operationId: presignSettlementAdvance
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PresignSettlementAdvance'
      responses:
        '200':
          description: Typed-data ready for the maker to sign.
          headers:
            X-Request-Id:
              $ref: '#/components/headers/XRequestId'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SettlementAdvancePresign'
        '400':
          description: Invalid request or trade state.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Trade not found.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
      security:
        - BearerAuth: []
components:
  schemas:
    PresignSettlementAdvance:
      type: object
      description: Request body for getting settlement advance Permit2 typed-data.
      required:
        - tradeId
      properties:
        tradeId:
          type: string
          description: Trade identifier.
          example: trade-abc-123
    SettlementAdvancePresign:
      type: object
      description: Settlement advance Permit2 typed-data for maker signing.
      required:
        - advance
        - collateral
        - makerPermitTypedData
      properties:
        advance:
          $ref: '#/components/schemas/SettlementAdvanceCurrencyAmount'
        collateral:
          $ref: '#/components/schemas/SettlementAdvanceCurrencyAmount'
        makerPermitTypedData:
          $ref: '#/components/schemas/Permit2TypedData'
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
    XRequestId:
      type: string
      description: >-
        A unique identifier, which can be helpful for identifying a request when
        communicating with Circle support.
      example: 2adba88e-9d63-44bc-b975-9b6ae3440dde
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
    Permit2TypedData:
      type: object
      description: EIP-712 Permit2 typed-data envelope for trader signing.
      required:
        - types
        - primaryType
        - domain
        - message
      properties:
        types:
          type: object
          additionalProperties:
            type: array
            items:
              $ref: '#/components/schemas/EIP712TypeProperty'
        primaryType:
          type: string
          example: DelegateFundingAuthorizationPermitWitnessTransferFrom
        domain:
          $ref: '#/components/schemas/Permit2EIP712Domain'
        message:
          $ref: '#/components/schemas/DelegateFundingPermit2'
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
    EIP712TypeProperty:
      type: object
      description: A single property definition in EIP-712 types
      required:
        - name
        - type
      properties:
        name:
          type: string
          description: The name of the property
        type:
          type: string
          description: The type of the property
    Permit2EIP712Domain:
      type: object
      description: Permit2 EIP-712 domain separator
      required:
        - name
        - chainId
        - verifyingContract
      properties:
        name:
          type: string
          description: The name of the signing domain
          example: Permit2
        chainId:
          type: integer
          description: The chain ID of the network
          example: 11155111
        verifyingContract:
          type: string
          description: The address of the verifying contract
          example: '0xffd21ca8F0876DaFAD7de09404E0c1f868bbf1AE'
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
    DescriptiveErrorType:
      title: DescriptiveErrorType
      type: string
      enum:
        - MISSING_OR_INVALID_FIELD
      description: Type of descriptive error
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