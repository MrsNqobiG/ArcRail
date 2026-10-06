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

# Get a trade

> Returns a trade specified by the ID path parameter



## OpenAPI

````yaml openapi/stablefx.yaml get /v1/exchange/stablefx/trades/{tradeId}
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
  /v1/exchange/stablefx/trades/{tradeId}:
    get:
      tags:
        - Trades
      summary: Get a trade
      description: Returns a trade specified by the ID path parameter
      operationId: getTradeById
      parameters:
        - in: path
          name: tradeId
          required: true
          description: The ID of the trade.
          schema:
            $ref: '#/components/schemas/Id'
        - in: query
          name: type
          required: true
          description: The type of trader.
          schema:
            $ref: '#/components/schemas/Type'
      responses:
        '200':
          description: Trade retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TradeDetail'
      security:
        - BearerAuth: []
components:
  schemas:
    Id:
      type: string
      format: uuid
      description: System-generated unique identifier of the resource.
      example: c4d1da72-111e-4d52-bdbf-2e74a2d803d5
    Type:
      type: string
      description: The type of trader.
      enum:
        - maker
        - taker
    TradeDetail:
      type: object
      description: Detailed trade information including contract transactions
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
        collateral:
          $ref: '#/components/schemas/Amount'
          description: >-
            Collateral amount required for the trade, denominated in the `from`
            currency.
        settlementTransactionHash:
          $ref: '#/components/schemas/SettlementTransactionHash'
        maturity:
          $ref: '#/components/schemas/Maturity'
        tenor:
          $ref: '#/components/schemas/Tenor'
        completeDate:
          $ref: '#/components/schemas/CompleteDate'
        signerAddress:
          $ref: '#/components/schemas/SignerAddress'
        contractTransactions:
          $ref: '#/components/schemas/ContractTransactions'
        providerTradeId:
          type:
            - string
            - 'null'
          description: >-
            The liquidity provider's own trade identifier (e.g. Talos
            MarketTradeID). Populated for makers on Talos-backed trades once the
            LP has confirmed the trade; absent for takers and non-Talos
            exchanges.
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
    SignerAddress:
      type:
        - string
        - 'null'
      description: The wallet address of the signer.
      example: '0xf0e7ccf7817b30fa0dd6bdeaea3ad54c140647b2'
    ContractTransactions:
      type: object
      description: Collection of contract functions associated with a trade
      properties:
        recordTrade:
          $ref: '#/components/schemas/ContractTransaction'
        takerDeliver:
          $ref: '#/components/schemas/ContractTransaction'
        makerDeliver:
          $ref: '#/components/schemas/ContractTransaction'
        breach:
          $ref: '#/components/schemas/ContractTransaction'
          description: Only present for breached trades.
    Currency:
      type: string
      description: Currency code
      enum:
        - USDC
        - EURC
    ContractTransaction:
      type: object
      description: A blockchain transaction associated with a trade
      properties:
        status:
          type: string
          description: The status of the transaction
          enum:
            - pending
            - success
            - failed
          example: success
        txHash:
          type: string
          description: The transaction hash on the blockchain
          example: '0x522a01ed8750423ab213a3d4618f231e0984874509521e98977f017b452cd455'
        errorDetails:
          type:
            - string
            - 'null'
          description: Error details if the transaction failed
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