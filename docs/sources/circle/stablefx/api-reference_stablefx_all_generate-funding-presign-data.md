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

# Generate funding presign data

> Returns the Permit2 EIP-712 payload that the trader must sign for funding operations. `fundingMode` net and net_delegate options are supported for maker funding requests only.

When `fundingMode` is `delegate` or `net_delegate`, the response instead contains two typed-data payloads: one for the trader to sign (a zero-amount authorization) and one for the funder to sign (carrying the actual delivery amount). Both require `funderAddress` and `recipientAddress`. `delegate` supports both maker and taker, and returns single-trade typed data for one contract trade ID or batch typed data for more than one. `net_delegate` is maker-only, requires every given trade to already be `taker_funded`, nets deliverables minus receivables across the given contract trade IDs into a single payment obligation, and always returns batch typed data — even for a single contract trade ID.




## OpenAPI

````yaml openapi/stablefx.yaml post /v1/exchange/stablefx/signatures/funding/presign
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
  /v1/exchange/stablefx/signatures/funding/presign:
    post:
      tags:
        - Signatures
      summary: Generate funding presign data
      description: >
        Returns the Permit2 EIP-712 payload that the trader must sign for
        funding operations. `fundingMode` net and net_delegate options are
        supported for maker funding requests only.


        When `fundingMode` is `delegate` or `net_delegate`, the response instead
        contains two typed-data payloads: one for the trader to sign (a
        zero-amount authorization) and one for the funder to sign (carrying the
        actual delivery amount). Both require `funderAddress` and
        `recipientAddress`. `delegate` supports both maker and taker, and
        returns single-trade typed data for one contract trade ID or batch typed
        data for more than one. `net_delegate` is maker-only, requires every
        given trade to already be `taker_funded`, nets deliverables minus
        receivables across the given contract trade IDs into a single payment
        obligation, and always returns batch typed data — even for a single
        contract trade ID.
      operationId: generateFundingPresignData
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/FundingPresign'
      responses:
        '200':
          description: Funding presign data generated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FundingPresign-2'
      security:
        - BearerAuth: []
components:
  schemas:
    FundingPresign:
      type: object
      description: Request body for generating funding presign data
      required:
        - contractTradeIds
        - type
      properties:
        contractTradeIds:
          type: array
          description: >-
            List of contract trade IDs. A single ID returns single-trade typed
            data for `delegate`; more than one returns batch typed data.
            `net_delegate` always returns batch typed data, including for a
            single ID.
          example:
            - '10'
            - '11'
            - '12'
          items:
            type: string
          minItems: 1
        type:
          $ref: '#/components/schemas/Type'
        fundingMode:
          allOf:
            - $ref: '#/components/schemas/FundingMode'
          description: >-
            Funding mode for the presign request. `net` and `net_delegate` are
            supported for maker funding requests only; `delegate` is supported
            for both maker and taker.
        funderAddress:
          type: string
          description: >-
            Address of the funder wallet that will deliver tokens on the
            trader's behalf. Required when `fundingMode` is `delegate` or
            `net_delegate`.
          example: '0x1234567890abcdef1234567890abcdef12345678'
        recipientAddress:
          type: string
          description: >-
            Address that receives the delivered tokens. Required when
            `fundingMode` is `delegate` or `net_delegate`.
          example: '0xabcdef1234567890abcdef1234567890abcdef12'
    FundingPresign-2:
      description: >-
        Response containing Permit2 EIP-712 typed data for funding operations.
        For `gross` and `net` funding modes, contains the trader's Permit2 typed
        data along with deliverables and receivables. For `delegate` funding
        mode with a single contract trade ID, contains separate single-trade
        typed-data payloads for the trader and the funder. For `delegate` with
        more than one contract trade ID, or for `net_delegate` (any trade
        count), contains separate batch typed-data payloads instead. No
        discriminator is defined because the response body carries no
        `fundingMode` field; the variant is determined by the
        `fundingMode`/`contractTradeIds` sent in the request, and the variants
        have mutually exclusive required properties.
      oneOf:
        - type: object
          title: TraderFundingPresign
          description: Presign data for `gross` and `net` funding modes.
          required:
            - typedData
            - deliverables
            - receivables
          properties:
            deliverables:
              type: array
              description: Aggregated assets that the trader needs to deliver.
              items:
                $ref: '#/components/schemas/CurrencyAmount'
            receivables:
              type: array
              description: >-
                Aggregated assets that the trader expects to receive after fee
                deduction.
              items:
                $ref: '#/components/schemas/CurrencyAmount'
            typedData:
              oneOf:
                - $ref: '#/components/schemas/SinglePermit2TypedData'
                - $ref: '#/components/schemas/BatchPermit2TypedData'
              discriminator:
                propertyName: primaryType
                mapping:
                  PermitWitnessTransferFrom: '#/components/schemas/SinglePermit2TypedData'
                  PermitWitnessBatchTransferFrom: '#/components/schemas/BatchPermit2TypedData'
        - type: object
          title: DelegateFundingPresign
          description: >-
            Presign data for `delegate` funding mode with a single contract
            trade ID.
          required:
            - traderPermitTypedData
            - funderPermitTypedData
          properties:
            traderPermitTypedData:
              allOf:
                - $ref: '#/components/schemas/Permit2TypedData'
              description: >-
                The trader's delegate-funding authorization typed data. The
                trader signs this zero-amount Permit2 payload to authorize the
                funder to deliver on their behalf.
            funderPermitTypedData:
              allOf:
                - $ref: '#/components/schemas/FunderPermit2TypedData'
              description: >-
                The funder's delegate-funding typed data. The funder signs this
                Permit2 payload, which carries the actual delivery amount.
        - type: object
          title: BatchDelegateFundingPresign
          description: >-
            Presign data for `delegate` funding mode with more than one contract
            trade ID, or for `net_delegate` (any trade count). The witnesses
            additionally bind `side` (`maker`/`taker`) and `flow`
            (`batch`/`net`) to prevent cross-side/cross-flow signature replay.
          required:
            - batchTraderPermitTypedData
            - batchFunderPermitTypedData
          properties:
            batchTraderPermitTypedData:
              allOf:
                - $ref: '#/components/schemas/BatchDelegateFundingPermit2TypedData'
              description: >-
                The trader's batch delegate-funding authorization typed data.
                The trader signs this zero-amount Permit2 payload to authorize
                the funder to deliver on their behalf across all of `ids`.
            batchFunderPermitTypedData:
              allOf:
                - $ref: >-
                    #/components/schemas/BatchDelegateFundingFunderPermit2TypedData
              description: >-
                The funder's batch delegate-funding typed data. The funder signs
                this Permit2 payload, which carries the actual delivery
                amount(s).
    Type:
      type: string
      description: The type of trader.
      enum:
        - maker
        - taker
    FundingMode:
      type: string
      description: >
        The funding mode for funding requests.

        - `gross`: the trader delivers the full amount for each trade.

        - `net`: the maker delivers the net difference across trades. Supported
        for maker funding requests only.

        - `delegate`: a funder wallet delivers tokens on the trader's behalf,
        one or more trades at a time, gross per trade (no netting). The trader
        signs a zero-amount Permit2 authorization and the funder signs the
        Permit2 transfer carrying the delivery amount. A single contract trade
        ID uses single-trade typed data; more than one uses batch typed data.

        - `net_delegate`: a funder wallet delivers tokens on the maker's behalf
        for the maker's net payment obligation across the given trades
        (deliverables minus receivables), using batch typed data even for a
        single trade ID. Supported for maker funding requests only, and only
        when every given trade is already `taker_funded`.
      enum:
        - gross
        - net
        - delegate
        - net_delegate
      default: gross
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
    SinglePermit2TypedData:
      type: object
      description: EIP-712 typed data structure for single Permit2 transfer
      required:
        - domain
        - types
        - primaryType
        - message
      properties:
        domain:
          $ref: '#/components/schemas/Permit2EIP712Domain'
        types:
          $ref: '#/components/schemas/SinglePermit2EIP712Types'
        primaryType:
          type: string
          description: The primary type for the EIP-712 signature
          example: PermitWitnessTransferFrom
        message:
          $ref: '#/components/schemas/Permit2SingleFundingMessage'
    BatchPermit2TypedData:
      type: object
      description: EIP-712 typed data structure for batch Permit2 transfer
      required:
        - domain
        - types
        - primaryType
        - message
      properties:
        domain:
          $ref: '#/components/schemas/Permit2EIP712Domain'
        types:
          $ref: '#/components/schemas/Permit2EIP712Types'
        primaryType:
          type: string
          description: The primary type for the EIP-712 signature
          example: PermitWitnessBatchTransferFrom
        message:
          $ref: '#/components/schemas/Permit2BatchFundingMessage'
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
    FunderPermit2TypedData:
      type: object
      description: EIP-712 Permit2 typed-data envelope for funder signing.
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
          example: DelegateFundingPermitWitnessTransferFrom
        domain:
          $ref: '#/components/schemas/Permit2EIP712Domain'
        message:
          $ref: '#/components/schemas/DelegateFundingFunderPermit2'
    BatchDelegateFundingPermit2TypedData:
      type: object
      description: >-
        EIP-712 Permit2 typed-data envelope for the trader's batch
        delegate-funding authorization signing.
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
          example: PermitBatchWitnessTransferFrom
        domain:
          $ref: '#/components/schemas/Permit2EIP712Domain'
        message:
          $ref: '#/components/schemas/BatchDelegateFundingPermit2'
    BatchDelegateFundingFunderPermit2TypedData:
      type: object
      description: >-
        EIP-712 Permit2 typed-data envelope for the funder's batch
        delegate-funding signing.
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
          example: PermitBatchWitnessTransferFrom
        domain:
          $ref: '#/components/schemas/Permit2EIP712Domain'
        message:
          $ref: '#/components/schemas/BatchDelegateFundingFunderPermit2'
    Currency:
      type: string
      description: Currency code
      enum:
        - USDC
        - EURC
    Amount:
      type: string
      pattern: ^\d+(?:\.\d{1,6})?$
      description: Amount of currency, formatted as a string with up to six decimal places.
      example: '100.00'
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
    SinglePermit2EIP712Types:
      type: object
      description: EIP-712 type definitions for single Permit2 transfer
      required:
        - EIP712Domain
        - TokenPermissions
        - SingleTradeWitness
        - PermitWitnessTransferFrom
      properties:
        EIP712Domain:
          type: array
          items:
            $ref: '#/components/schemas/EIP712TypeProperty'
          example:
            - name: name
              type: string
            - name: chainId
              type: uint256
            - name: verifyingContract
              type: address
        TokenPermissions:
          type: array
          items:
            $ref: '#/components/schemas/EIP712TypeProperty'
          example:
            - name: token
              type: address
            - name: amount
              type: uint256
        SingleTradeWitness:
          type: array
          items:
            $ref: '#/components/schemas/EIP712TypeProperty'
          example:
            - name: id
              type: uint256
        PermitWitnessTransferFrom:
          type: array
          items:
            $ref: '#/components/schemas/EIP712TypeProperty'
          example:
            - name: permitted
              type: TokenPermissions
            - name: spender
              type: address
            - name: nonce
              type: uint256
            - name: deadline
              type: uint256
            - name: witness
              type: SingleTradeWitness
    Permit2SingleFundingMessage:
      type: object
      description: The message data for Permit2 signature
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
          description: The spender contract address
          example: '0xffd21ca8F0876DaFAD7de09404E0c1f868bbf1AE'
        nonce:
          type: string
          description: The nonce for the permit, as a string representation of a uint256
          example: '42'
        deadline:
          type: string
          description: >-
            The deadline timestamp for the permit, as a string representation of
            a uint256
          example: '1735689600'
        witness:
          $ref: '#/components/schemas/SingleTradeWitness'
    Permit2EIP712Types:
      type: object
      description: Permit2 EIP-712 type definitions
      required:
        - EIP712Domain
        - TokenPermissions
        - BatchTradeWitness
        - PermitWitnessBatchTransferFrom
      properties:
        EIP712Domain:
          type: array
          items:
            $ref: '#/components/schemas/EIP712TypeProperty'
          example:
            - name: name
              type: string
            - name: chainId
              type: uint256
            - name: verifyingContract
              type: address
        TokenPermissions:
          type: array
          items:
            $ref: '#/components/schemas/EIP712TypeProperty'
          example:
            - name: token
              type: address
            - name: amount
              type: uint256
        BatchTradeWitness:
          type: array
          items:
            $ref: '#/components/schemas/EIP712TypeProperty'
          example:
            - name: ids
              type: uint256[]
        PermitWitnessBatchTransferFrom:
          type: array
          items:
            $ref: '#/components/schemas/EIP712TypeProperty'
          example:
            - name: permitted
              type: TokenPermissions[]
            - name: spender
              type: address
            - name: nonce
              type: uint256
            - name: deadline
              type: uint256
            - name: witness
              type: BatchTradeWitness
    Permit2BatchFundingMessage:
      type: object
      description: The message data for Permit2 batch signature
      required:
        - permitted
        - spender
        - nonce
        - deadline
        - witness
      properties:
        permitted:
          type: array
          description: Array of token permissions
          items:
            $ref: '#/components/schemas/TokenPermissions'
          example:
            - token: 0xTOKEN1
              amount: '1000'
            - token: 0xTOKEN2
              amount: '2000'
        spender:
          type: string
          description: The spender contract address
          example: '0xffd21ca8F0876DaFAD7de09404E0c1f868bbf1AE'
        nonce:
          type: string
          description: The nonce for the permit, as a string representation of a uint256
          example: '42'
        deadline:
          type: string
          description: >-
            The deadline timestamp for the permit, as a string representation of
            a uint256
          example: '1735689600'
        witness:
          $ref: '#/components/schemas/BatchTradeWitness'
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
    DelegateFundingFunderPermit2:
      type: object
      description: >-
        Permit2 PermitWitnessTransferFrom payload signed by the funder when
        delivering tokens on a trader's behalf. Unlike the trader's
        authorization payload, this permit carries the actual delivery amount in
        `permitted.amount`. The DelegateFundingWitness binds the funder's
        signature to a specific trade and recipient, and must agree with the
        trader's DelegateFundingAuthorization.
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
          $ref: '#/components/schemas/DelegateFundingWitness'
    BatchDelegateFundingPermit2:
      type: object
      description: >-
        Permit2 PermitBatchWitnessTransferFrom payload with
        BatchDelegateFundingAuthorization witness. Every `permitted[].amount` is
        always 0 -- Permit2 is used as an authorization carrier, no tokens
        transfer from the trader.
      required:
        - permitted
        - spender
        - nonce
        - deadline
        - witness
      properties:
        permitted:
          type: array
          description: One zero-amount entry per token in the witness's `tokenAmounts`.
          items:
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
          $ref: '#/components/schemas/BatchDelegateFundingAuthorization'
    BatchDelegateFundingFunderPermit2:
      type: object
      description: >-
        Permit2 PermitBatchWitnessTransferFrom payload signed by the funder when
        delivering tokens on a trader's behalf for a batch of trades. Unlike the
        trader's authorization payload, this permit carries the actual delivery
        amounts in `permitted[].amount`. The BatchDelegateFundingWitness binds
        the funder's signature to the same trades, recipient, side, and flow,
        and must agree with the trader's BatchDelegateFundingAuthorization.
      required:
        - permitted
        - spender
        - nonce
        - deadline
        - witness
      properties:
        permitted:
          type: array
          description: >-
            Per-token amounts actually delivered by the funder. Matches the
            witness's `tokenAmounts` (delegate) or the single net amount
            (net_delegate).
          items:
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
          $ref: '#/components/schemas/BatchDelegateFundingWitness'
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
    SingleTradeWitness:
      type: object
      description: Single trade witness data
      required:
        - id
      properties:
        id:
          type: string
          description: The trade ID
          example: '10'
    BatchTradeWitness:
      type: object
      description: Batch trade witness data with multiple IDs
      required:
        - ids
      properties:
        ids:
          type: array
          description: Array of trade IDs
          items:
            type: string
          example:
            - '10'
            - '11'
            - '12'
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
    DelegateFundingWitness:
      type: object
      description: >-
        DelegateFundingWitness signed by the funder when delivering tokens on a
        trader's behalf. Both the trader (via DelegateFundingAuthorization) and
        the funder independently commit to the same recipient, and the contract
        verifies agreement on-chain. The funder address is not part of the
        witness because Permit2 verifies the signer identity via the `owner`
        parameter.
      required:
        - id
        - recipient
      properties:
        id:
          type: string
          description: On-chain trade id (uint256).
          example: '987654321'
        recipient:
          type: string
          description: >-
            Address that receives the delivered tokens. Must match the recipient
            in the trader's DelegateFundingAuthorization.
          example: '0xabcdef1234567890abcdef1234567890abcdef12'
    BatchDelegateFundingAuthorization:
      type: object
      description: >-
        BatchDelegateFundingAuthorization witness binding the Permit2
        authorization to a specific set of trades, funder, recipient, and
        per-token amounts. Used for `fundingMode` `delegate` with more than one
        contract trade ID, and for `net_delegate` (any trade count).
      required:
        - ids
        - funder
        - recipient
        - tokenAmounts
        - side
        - flow
      properties:
        ids:
          type: array
          description: On-chain trade ids (uint256), as strings.
          items:
            type: string
          example:
            - '10'
            - '11'
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
        tokenAmounts:
          type: array
          description: >-
            Per-token amounts to be delivered by the funder, one entry per
            unique token (not per trade in `ids`) — for `delegate`, gross totals
            aggregated across the trades in `ids` that share that token; for
            `net_delegate`, a single entry holding the net payment obligation.
          items:
            $ref: '#/components/schemas/TokenPermissions'
        side:
          $ref: '#/components/schemas/FundingSide'
        flow:
          $ref: '#/components/schemas/FundingFlow'
    BatchDelegateFundingWitness:
      type: object
      description: >-
        BatchDelegateFundingWitness signed by the funder when delivering tokens
        on a trader's behalf for a batch of trades. Both the trader (via
        BatchDelegateFundingAuthorization) and the funder independently commit
        to the same recipient/side/flow, and the contract verifies agreement
        on-chain. The funder address is not part of the witness because Permit2
        verifies the signer identity via the `owner` parameter.
      required:
        - ids
        - recipient
        - side
        - flow
      properties:
        ids:
          type: array
          description: >-
            On-chain trade ids (uint256), as strings. Must match the trader's
            BatchDelegateFundingAuthorization.
          items:
            type: string
          example:
            - '10'
            - '11'
        recipient:
          type: string
          description: >-
            Address that receives the delivered tokens. Must match the recipient
            in the trader's BatchDelegateFundingAuthorization.
          example: '0xabcdef1234567890abcdef1234567890abcdef12'
        side:
          $ref: '#/components/schemas/FundingSide'
        flow:
          $ref: '#/components/schemas/FundingFlow'
    FundingSide:
      type: string
      description: >
        Which party a batch delegate-funding authorization/witness is binding:
        `"0"` (maker) or `"1"` (taker) leg of the trade(s). This is a
        `uint8`-typed EIP-712 witness field, serialized as the decimal-string
        ordinal (matching every other integer-typed field in the same message) —
        not the enum name. Prevents a signature collected for one side from
        being replayed against the other side's delivery.
      enum:
        - '0'
        - '1'
      example: '0'
    FundingFlow:
      type: string
      description: >
        Which settlement flow a batch delegate-funding authorization/witness is
        binding: `"0"` (batch — gross, per-trade delivery, `fundingMode`
        `delegate` with more than one contract trade ID) or `"1"` (net — netted
        across trades, `fundingMode` `net_delegate`). This is a `uint8`-typed
        EIP-712 witness field, serialized as the decimal-string ordinal
        (matching every other integer-typed field in the same message) — not the
        enum name. Prevents a signature collected for one flow from being
        replayed against the other flow's delivery.
      enum:
        - '0'
        - '1'
      example: '0'
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