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

# Create a quote

> Creates a quote for a trade between two currencies. You should provide an `amount` for the `from` parameter or the `to` parameter, but not for both. Use `type:tradable` for an executable quote or `type:reference` for an indicative quote. Tradable quotes include presign `typedData` for signing.



## OpenAPI

````yaml openapi/stablefx.yaml post /v1/exchange/stablefx/quotes
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
  /v1/exchange/stablefx/quotes:
    post:
      tags:
        - Quotes
      summary: Create a quote
      description: >-
        Creates a quote for a trade between two currencies. You should provide
        an `amount` for the `from` parameter or the `to` parameter, but not for
        both. Use `type:tradable` for an executable quote or `type:reference`
        for an indicative quote. Tradable quotes include presign `typedData` for
        signing.
      operationId: createQuote
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateQuote'
      responses:
        '200':
          description: Quote created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreateQuote-2'
      security:
        - BearerAuth: []
components:
  schemas:
    CreateQuote:
      type: object
      description: Request body for creating an exchange quote
      required:
        - from
        - to
        - tenor
      properties:
        from:
          $ref: '#/components/schemas/CurrencyAmount'
        to:
          $ref: '#/components/schemas/CurrencyAmount'
        tenor:
          $ref: '#/components/schemas/Tenor'
        type:
          $ref: '#/components/schemas/QuoteType'
        recipientAddress:
          $ref: '#/components/schemas/BlockchainAddress'
          description: >-
            The address that should receive taker proceeds. Required for
            tradable quote requests.
    CreateQuote-2:
      type: object
      description: Quote for an FX transaction
      properties:
        id:
          $ref: '#/components/schemas/Id'
        rate:
          $ref: '#/components/schemas/Rate'
        to:
          $ref: '#/components/schemas/CurrencyAmount'
        from:
          $ref: '#/components/schemas/CurrencyAmount'
        createdAt:
          $ref: '#/components/schemas/CreateDate'
        expiresAt:
          $ref: '#/components/schemas/ExpireDate'
        fee:
          $ref: '#/components/schemas/Amount'
          description: The fee for the transaction, denominated in the 'to' currency.
        collateral:
          $ref: '#/components/schemas/Amount'
          description: >-
            Optional collateral amount required for the quote, denominated in
            the 'from' currency.
        typedData:
          $ref: '#/components/schemas/TradeTypedData'
          description: Permit2 EIP-712 typed data for signing before trade creation.
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
    Tenor:
      type: string
      description: The settlement schedule for the trade
      enum:
        - instant
        - hourly
        - daily
    QuoteType:
      type: string
      description: >-
        The quote type. Use tradable for executable quotes or reference for
        indicative quotes.
      enum:
        - reference
        - tradable
      default: tradable
    BlockchainAddress:
      type: string
      description: A blockchain address
      example: '0x1234567890abcdef1234567890abcdef12345678'
    Id:
      type: string
      format: uuid
      description: System-generated unique identifier of the resource.
      example: c4d1da72-111e-4d52-bdbf-2e74a2d803d5
    Rate:
      type: number
      format: double
      description: Exchange rate for the quote
      example: 0.915
    CreateDate:
      type: string
      format: date-time
      description: Date and time when the resource was created
      example: '2023-01-01T12:04:05Z'
    ExpireDate:
      type: string
      format: date-time
      description: Date and time when the resource expires
      example: '2023-01-01T12:04:05Z'
    Amount:
      type: string
      pattern: ^\d+(?:\.\d{1,6})?$
      description: Amount of currency, formatted as a string with up to six decimal places.
      example: '100.00'
    TradeTypedData:
      type: object
      description: EIP-712 typed data for trade registration
      required:
        - domain
        - types
        - primaryType
        - message
      properties:
        domain:
          $ref: '#/components/schemas/Permit2EIP712Domain'
        types:
          type: object
          description: EIP-712 types definition
          required:
            - EIP712Domain
            - Consideration
          properties:
            EIP712Domain:
              type: array
              items:
                type: object
                properties:
                  name:
                    type: string
                  type:
                    type: string
            Consideration:
              type: array
              items:
                type: object
                properties:
                  name:
                    type: string
                  type:
                    type: string
            TraderDetails:
              type: array
              description: >-
                Type definition for trader (maker or taker) trades. Replaces the
                legacy TakerDetails and MakerDetails type definitions and adds
                the `authorizer` field.
              items:
                type: object
                properties:
                  name:
                    type: string
                  type:
                    type: string
              example:
                - name: consideration
                  type: Consideration
                - name: recipient
                  type: address
                - name: fee
                  type: uint256
                - name: authorizer
                  type: address
            TokenPermissions:
              type: array
              description: Type definition for token permissions
              items:
                type: object
                properties:
                  name:
                    type: string
                  type:
                    type: string
            PermitWitnessTransferFrom:
              type: array
              description: Type definition for permit witness transfer
              items:
                type: object
                properties:
                  name:
                    type: string
                  type:
                    type: string
        primaryType:
          type: string
          description: The primary type for the EIP-712 data to be signed
          enum:
            - PermitWitnessTransferFrom
          example: PermitWitnessTransferFrom
        message:
          $ref: '#/components/schemas/TradePermit2Message'
    Currency:
      type: string
      description: Currency code
      enum:
        - USDC
        - EURC
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
    TradePermit2Message:
      type: object
      description: The Permit2 message for trade registration
      required:
        - permitted
        - spender
        - nonce
        - deadline
        - witness
      properties:
        permitted:
          type: object
          description: Token permission details
          required:
            - token
            - amount
          properties:
            token:
              type: string
              description: The address of the token to be funded
              example: '0x3600000000000000000000000000000000000000'
            amount:
              type: string
              description: >-
                The prefunded risk buffer amount of tokens to be funded, as a
                string representation of a uint256
              example: '429000000'
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
          description: Witness data containing trade details
          required:
            - consideration
            - fee
            - authorizer
          properties:
            consideration:
              $ref: '#/components/schemas/TradeSignatureConsideration'
            recipient:
              type:
                - string
                - 'null'
              description: >-
                The address of the recipient of the trade. Only included in
                taker trades, null for maker trades.
              example: '0x1f531ce3c418bbd830d06138a9e5b5eacfdfb3d6'
            fee:
              type: string
              description: The fee for the trade, as a string representation of a uint256
              example: '80000'
            authorizer:
              type: string
              description: >-
                The authorizer is the address of the entity that authorizes the
                trade. For StableFX this does not need to be set and defaults to
                the zero-address sentinel.
              example: '0x0000000000000000000000000000000000000000'
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