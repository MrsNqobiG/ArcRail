> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Wallet History

> Retrieves a list of historical on chain activities for the specified wallet.

The list reflects the indexed on-chain activity: it includes confirmed transactions only.

If you need to list your on-going or failed transactions please use the related endpoints (
[List Transfers](https://docs.dfns.co/api-reference/wallets/list-transfers) or
[List Transactions](https://docs.dfns.co/api-reference/wallets/list-transactions)
depending on the API you are using).



## OpenAPI

````yaml /openapi.yaml get /wallets/{walletId}/history
openapi: 3.1.0
info:
  version: 2.0.155
  title: Dfns
servers:
  - url: https://api.dfns.io
    description: Default - Europe
  - url: https://api.uae.dfns.io
    description: UAE
  - url: https://api.dfns.ninja
    description: <Deprecated> Staging
security: []
paths:
  /wallets/{walletId}/history:
    get:
      tags:
        - Wallets
      summary: Get Wallet History
      description: >-
        Retrieves a list of historical on chain activities for the specified
        wallet.


        The list reflects the indexed on-chain activity: it includes confirmed
        transactions only.


        If you need to list your on-going or failed transactions please use the
        related endpoints (

        [List
        Transfers](https://docs.dfns.co/api-reference/wallets/list-transfers) or

        [List
        Transactions](https://docs.dfns.co/api-reference/wallets/list-transactions)

        depending on the API you are using).
      operationId: getWalletHistory
      parameters:
        - schema:
            type: string
            minLength: 1
            maxLength: 64
            description: Wallet you want to get the history from.
          required: true
          description: Wallet you want to get the history from.
          name: walletId
          in: path
        - schema:
            type: integer
            minimum: 1
            maximum: 500
            default: 50
            description: Maximum number of items to return.
          required: false
          description: Maximum number of items to return.
          name: limit
          in: query
        - schema:
            type: string
            minLength: 1
            description: >-
              Opaque token used to retrieve the next page. Returned as
              `nextPageToken` from the previous request.
          required: false
          description: >-
            Opaque token used to retrieve the next page. Returned as
            `nextPageToken` from the previous request.
          name: paginationToken
          in: query
        - schema:
            type: string
            enum:
              - In
              - Out
            description: Transfer direction.
          required: false
          description: Transfer direction.
          name: direction
          in: query
        - schema:
            type: string
            enum:
              - NativeTransfer
              - Aip21Transfer
              - AsaTransfer
              - AssetTransfer
              - Cip56Transfer
              - Cis2Transfer
              - Cis7Transfer
              - CoinTransfer
              - Erc20Transfer
              - Erc721Transfer
              - Erc7984Transfer
              - HederaErc20Transfer
              - HederaErc721Transfer
              - Hip17Transfer
              - HtsTransfer
              - IouTransfer
              - LockedCoinTransfer
              - Sep41Transfer
              - Snip2Transfer
              - Snip3Transfer
              - SplTransfer
              - Spl2022Transfer
              - Tep74Transfer
              - Trc10Transfer
              - Trc20Transfer
              - Trc721Transfer
              - UtxoTransfer
              - Xls33Transfer
            description: Blockchain event kind.
          required: false
          description: Blockchain event kind.
          name: kind
          in: query
        - schema:
            type: string
            minLength: 1
          required: false
          name: contract
          in: query
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/WalletHistoryEvent'
                    description: Current page items.
                  nextPageToken:
                    type: string
                    description: >-
                      token to use as `paginationToken` to request the next
                      page.
                  walletId:
                    type: string
                    minLength: 1
                    maxLength: 64
                    pattern: ^wa-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                    description: Wallet id.
                    example: wa-5pfuu-9euek-h0odgb6snva8ph3k
                  network:
                    $ref: '#/components/schemas/Network'
                required:
                  - items
                  - walletId
                  - network
      security:
        - authenticationToken: []
components:
  schemas:
    WalletHistoryEvent:
      oneOf:
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - NativeTransfer
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            memo:
              type: string
            liquidityPool:
              type: string
            balanceId:
              type: string
            symbol:
              type: string
              description: '@deprecated use metadata.asset.symbol instead'
            decimals:
              type: number
              description: '@deprecated use metadata.asset.decimals instead'
            verified:
              type: boolean
              description: '@deprecated use metadata.asset.verified instead'
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - value
            - symbol
            - decimals
          title: Native Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Aip21Transfer
            metadataAddress:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - metadataAddress
            - from
            - to
            - value
          title: Aptos Fungible Asset (AIP-21) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - AsaTransfer
            assetId:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            optIn:
              type: boolean
            optOut:
              type: boolean
            clawback:
              type: boolean
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - assetId
            - from
            - to
            - value
          title: Algorand Standard Asset Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - AssetTransfer
            assetId:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - assetId
            - value
          title: Cardano Asset Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Cip56Transfer
            instrumentId:
              type: string
            instrumentAdmin:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            memo:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - instrumentId
            - instrumentAdmin
            - from
            - to
            - value
          title: Canton Standard Token (CIP-56) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - CoinTransfer
            coin:
              type: string
            from:
              type: string
            tos:
              type: array
              items:
                type: string
            value:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - coin
            - from
            - value
          title: Sui Coin Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Cis2Transfer
            from:
              type: string
            to:
              type: string
            value:
              type: string
            tokenAddress:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - value
            - tokenAddress
          title: Concordium CIS2 Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Cis7Transfer
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            tokenId:
              type: string
            memo:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - value
            - tokenId
          title: Concordium CIS7 Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Erc20Transfer
            contract:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            symbol:
              type: string
              description: '@deprecated use metadata.asset.symbol instead'
            decimals:
              type: number
              description: '@deprecated use metadata.asset.decimals instead'
            verified:
              type: boolean
              description: '@deprecated use metadata.asset.verified instead'
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - contract
            - from
            - to
            - value
            - decimals
          title: EVM Fungible Token (ERC-20) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Erc721Transfer
            contract:
              type: string
            from:
              type: string
            to:
              type: string
            tokenId:
              type: string
            fee:
              type: string
            symbol:
              type: string
              description: '@deprecated use metadata.asset.symbol instead'
            verified:
              type: boolean
              description: '@deprecated use metadata.asset.verified instead'
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - contract
            - from
            - to
            - tokenId
          title: EVM Non Fungible Token (ERC-721) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Erc7984Transfer
            contract:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            symbol:
              type: string
              description: '@deprecated use metadata.asset.symbol instead'
            decimals:
              type: number
              description: '@deprecated use metadata.asset.decimals instead'
            verified:
              type: boolean
              description: '@deprecated use metadata.asset.verified instead'
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - contract
            - from
            - to
            - value
            - decimals
          title: EVM Confidential Token (ERC-7984) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - HederaErc20Transfer
            contract:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            transactionId:
              type: string
            evmTxHash:
              type: string
              description: >-
                EVM keccak256 hash of the HIP-410 inner tx. Absent on
                legacy-migrated rows.
            symbol:
              type: string
              description: '@deprecated use metadata.asset.symbol instead'
            decimals:
              type: number
              description: '@deprecated use metadata.asset.decimals instead'
            verified:
              type: boolean
              description: '@deprecated use metadata.asset.verified instead'
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - contract
            - from
            - to
            - value
            - decimals
          title: Hedera EVM Fungible Token (ERC-20) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - HederaErc721Transfer
            contract:
              type: string
            from:
              type: string
            to:
              type: string
            tokenId:
              type: string
            fee:
              type: string
            transactionId:
              type: string
            evmTxHash:
              type: string
              description: >-
                EVM keccak256 hash of the HIP-410 inner tx. Absent on
                legacy-migrated rows.
            symbol:
              type: string
              description: '@deprecated use metadata.asset.symbol instead'
            verified:
              type: boolean
              description: '@deprecated use metadata.asset.verified instead'
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - contract
            - from
            - to
            - tokenId
          title: Hedera EVM Non Fungible Token (ERC-721) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Hip17Transfer
            tokenId:
              type: string
            serialNumber:
              type: string
            from:
              type: string
            to:
              type: string
            fee:
              type: string
            transactionId:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - tokenId
            - serialNumber
          title: HIP17 Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - HtsTransfer
            tokenId:
              type: string
            froms:
              type: array
              items:
                type: string
            tos:
              type: array
              items:
                type: string
            value:
              type: string
            fee:
              type: string
            transactionId:
              type: string
            evmTxHash:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - froms
            - tos
            - value
          title: HTS Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - IouTransfer
            currency:
              type: string
            issuer:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            memo:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - currency
            - issuer
            - value
          title: XRPL IOU Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - LockedCoinTransfer
            coin:
              type: string
            from:
              type: string
            tos:
              type: array
              items:
                type: string
            value:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - coin
            - from
            - value
          title: Locked Coin Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Xls33Transfer
            issuanceId:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            memo:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - issuanceId
            - value
          title: XRPL XLS-33 Token Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Sep41Transfer
            issuer:
              type: string
            assetCode:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            memo:
              type: string
            liquidityPool:
              type: string
            balanceId:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - issuer
            - assetCode
            - from
            - to
            - value
          title: Stellar Classic Assets (SEP-41) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Snip2Transfer
            contract:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - contract
            - from
            - to
            - value
          title: Snip2 Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Snip3Transfer
            contract:
              type: string
            from:
              type: string
            to:
              type: string
            tokenId:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - contract
            - from
            - to
            - tokenId
          title: Snip3 Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - SplTransfer
                - Spl2022Transfer
            from:
              type: string
            to:
              type: string
            mint:
              type: string
            value:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - mint
            - value
          title: Solana Program Library Token (SPL and SPL 2022) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Tep74Transfer
            master:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
            memo:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - master
            - from
            - value
          title: TON Jetton (TEP-74) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Trc10Transfer
            tokenId:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - tokenId
            - from
            - to
            - value
          title: TRON Native Fungible Token (TRC-10) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Trc20Transfer
            contract:
              type: string
            from:
              type: string
            to:
              type: string
            value:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - contract
            - from
            - to
            - value
          title: TRON Smart Contract Fungible Token (TRC-20) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - Trc721Transfer
            contract:
              type: string
            from:
              type: string
            to:
              type: string
            tokenId:
              type: string
            fee:
              type: string
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - contract
            - from
            - to
            - tokenId
          title: TRON Non Fungible Token (TRC-721) Transfer
        - type: object
          properties:
            walletId:
              type: string
            direction:
              type: string
              enum:
                - In
                - Out
            network:
              $ref: '#/components/schemas/Network'
            blockNumber:
              type: number
            txHash:
              type: string
            index:
              type: string
            timestamp:
              type: string
            status:
              type: string
              enum:
                - Included
                - Confirmed
            metadata:
              type: object
              properties:
                asset:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
                fee:
                  type: object
                  properties:
                    symbol:
                      type: string
                    decimals:
                      type: integer
                      description: >-
                        Number of decimals used by the asset, see [this
                        guide](https://docs.dfns.co/guides/developers/displaying-balances)
                        for more details.
                    verified:
                      type: boolean
                      description: Whether the asset is verified by DFNS as legitimate.
                    quotes:
                      type: object
                      properties:
                        EUR:
                          type: number
                        USD:
                          type: number
                      description: >-
                        Corresponding asset price in USD at the time of
                        transfer.
              required:
                - asset
            kind:
              type: string
              enum:
                - UtxoTransfer
            assetId:
              type: string
              description: Only set for Cardano asset transfers.
            froms:
              type: array
              items:
                type: string
            tos:
              type: array
              items:
                type: string
            value:
              type: string
            fee:
              type: string
            outputs:
              type: array
              items:
                type: object
                properties:
                  index:
                    type: number
                  address:
                    type: string
                  value:
                    type: string
                required:
                  - index
                  - address
                  - value
              description: >-
                Outbound transfers only: per-recipient outputs of the
                transaction, change excluded.
          required:
            - walletId
            - direction
            - network
            - blockNumber
            - txHash
            - timestamp
            - status
            - metadata
            - kind
            - froms
            - tos
            - value
          title: UTXO Transfer
      example:
        kind: Erc20Transfer
        walletId: wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx
        network: Ethereum
        direction: Out
        blockNumber: 19036906
        timestamp: '2024-01-18T23:03:59.000Z'
        status: Confirmed
        txHash: '0x8e88793607610a83798eb5ec6dde861f3e459c7e4a22e78b0d2e675b86d0d1e7'
        index: '134'
        contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
        from: '0xea09cf8a006493566f8a8fd3d0b32ebff5939d6a'
        to: '0xc42754e6f79f15082613b2b4ebead83dcf8116b6'
        value: '1000000'
        decimals: 6
        fee: '1542993669053672'
        metadata:
          asset:
            symbol: USDC
            decimals: 6
            verified: true
          fee:
            symbol: ETH
            decimals: 18
            verified: true
    Network:
      type: string
      title: Network
      enum:
        - Algorand
        - AlgorandTestnet
        - Aptos
        - AptosTestnet
        - ArbitrumOne
        - ArbitrumSepolia
        - Arc
        - ArcTestnet
        - Areum
        - AvalancheC
        - AvalancheCFuji
        - Base
        - BaseSepolia
        - Berachain
        - BerachainBepolia
        - Bitcoin
        - BitcoinSignet
        - BitcoinTestnet4
        - BitcoinCash
        - Bob
        - BobSepolia
        - Bsc
        - BscTestnet
        - Canton
        - CantonTestnet
        - Cardano
        - CardanoPreprod
        - Concordium
        - ConcordiumTestnet
        - Celo
        - CeloSepolia
        - Codex
        - CodexSepolia
        - CosmosHub4
        - CosmosIcsTestnet
        - Dogecoin
        - DogecoinTestnet
        - Ethereum
        - EthereumClassic
        - EthereumClassicMordor
        - EthereumSepolia
        - EthereumHoodi
        - FlareC
        - FlareCCoston2
        - FlowEvm
        - FlowEvmTestnet
        - Hedera
        - HederaTestnet
        - Ink
        - InkSepolia
        - InternetComputer
        - Ion
        - IonTestnet
        - Iota
        - IotaTestnet
        - Kusama
        - KusamaAssetHub
        - Litecoin
        - LitecoinTestnet
        - Movement
        - MovementTestnet
        - Near
        - NearTestnet
        - Optimism
        - OptimismSepolia
        - Origyn
        - Plasma
        - PlasmaTestnet
        - Plume
        - PlumeSepolia
        - Paseo
        - PaseoAssetHub
        - Polkadot
        - PolkadotAssetHub
        - Polygon
        - PolygonAmoy
        - Polymesh
        - PolymeshTestnet
        - Rayls
        - RaylsTestnet
        - Robinhood
        - RobinhoodSepolia
        - SeiAtlantic2
        - SeiPacific1
        - Solana
        - SolanaDevnet
        - Sonic
        - SonicTestnet
        - Starknet
        - StarknetSepolia
        - Stellar
        - StellarTestnet
        - Sui
        - SuiTestnet
        - Tezos
        - TezosShadownet
        - Tempo
        - TempoModerato
        - Tsc
        - TscTestnet1
        - Ton
        - TonTestnet
        - Tron
        - TronNile
        - Westend
        - WestendAssetHub
        - Xdc
        - XdcApothem
        - XLayer
        - XLayerSepolia
        - XrpLedger
        - XrpLedgerTestnet
  securitySchemes:
    authenticationToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >-
        **Bearer Token:** Used to authenticate API requests.

        More details how to generate the token: [Authentication
        flows](https://docs.dfns.co/api-reference/auth/login-flows)

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.