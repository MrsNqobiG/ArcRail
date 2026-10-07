> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Transfer Asset

> 
Transfer an asset out of the specified wallet to a destination address.
For all fungible token transfers, the transfer amount must be specified in the minimum denomination of that token.
For example, use the amount in Satoshi for a Bitcoin transfer, or the amount in Wei for an Ethereum transfer etc.

See the different options in the Body description below. You can also select your kind of transfers in the payload examples in the different languages.

<Tip>
Binance chains users can use ERC transfers for BEP tokens and Native transfers for BNB.
</Tip>

<Note>
Some blockchains may require additional steps before the transfer can be completed, such as creating a destination account (e.g., Stellar). Please refer to the specific blockchain documentation for any prerequisites or additional requirements.
</Note>
    



## OpenAPI

````yaml /openapi.yaml post /wallets/{walletId}/transfers
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
  /wallets/{walletId}/transfers:
    post:
      tags:
        - Wallets
      summary: Transfer Asset
      description: >-

        Transfer an asset out of the specified wallet to a destination address.

        For all fungible token transfers, the transfer amount must be specified
        in the minimum denomination of that token.

        For example, use the amount in Satoshi for a Bitcoin transfer, or the
        amount in Wei for an Ethereum transfer etc.


        See the different options in the Body description below. You can also
        select your kind of transfers in the payload examples in the different
        languages.


        <Tip>

        Binance chains users can use ERC transfers for BEP tokens and Native
        transfers for BNB.

        </Tip>


        <Note>

        Some blockchains may require additional steps before the transfer can be
        completed, such as creating a destination account (e.g., Stellar).
        Please refer to the specific blockchain documentation for any
        prerequisites or additional requirements.

        </Note>
            
      operationId: transferAsset
      parameters:
        - schema:
            type: string
            minLength: 1
            maxLength: 64
            description: The source wallet id (`wa-...`).
          required: true
          description: The source wallet id (`wa-...`).
          name: walletId
          in: path
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Native
                    to:
                      type: string
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of native tokens to transfer in minimum
                        denomination.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo or destination tag (supported networks only).
                    priority:
                      type: string
                      enum:
                        - Slow
                        - Standard
                        - Fast
                      description: >-
                        The priority that determines the fees paid for the
                        transfer. All EVM compatible networks and Bitcoin
                        support `priority`. Not supported for other networks. It
                        uses the [estimate
                        fees](https://docs.dfns.co/api-reference/networks/estimate-fees)
                        API to calculate the transfer fees. When not specified,
                        defaults to `Standard` priority.
                    createDestinationAccount:
                      type: boolean
                      description: >-
                        Whether to create the destination account on chains that
                        require account creation (e.g., Stellar). Only valid for
                        chains that require the receiver account to exist before
                        transfer.
                    offer:
                      type: boolean
                      description: >-
                        Optional field for Canton, if true it will create a
                        transfer offer.
                    expiresAt:
                      type: string
                      format: date-time
                      description: >-
                        Optional field for Canton, especially useful in the
                        context of offers
                    useDurableNonce:
                      type: boolean
                      description: >-
                        Optional Solana-only flag. When `true` the SOL transfer
                        is built as a durable-nonce transaction using one of the
                        wallet's nonce accounts (picked server-side). Use this
                        for offline-signing flows where the construct →
                        broadcast gap may exceed 90 seconds. The wallet's nonce
                        account pool must be pre-populated via `POST
                        /wallets/{id}/transactions` with `kind:
                        CreateSolanaNonceAccounts`.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer the native token of the network. All networks
                    support the native token type.
                  title: Native Asset
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Aip21
                    metadata:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{64}$
                      description: 'The asset metadata address. '
                    to:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{64}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - metadata
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer Aptos fungible asset that implement the [AIP-21
                    specification](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-21.md).
                  title: Aptos Fungible Asset (AIP-21)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Asa
                    assetId:
                      type: string
                      pattern: ^\d+$
                      description: 'The token asset id. '
                    to:
                      type: string
                      pattern: ^[A-Z0-9]{58}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo or destination tag.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - assetId
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer Algorand standard assets, or
                    [ASAs](https://developer.algorand.org/docs/get-details/asa/).
                  title: Algorand Standard Asset
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Asset
                    assetId:
                      type: string
                      description: 'The token asset id. '
                    to:
                      type: string
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - assetId
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer Cardano assets following [Mary
                    update](https://docs.cardano.org/about-cardano/evolution/upgrades/mary)
                  title: Cardano Asset
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Cip56
                    instrumentAdmin:
                      type: string
                      pattern: ^[a-zA-Z0-9-_]*::1220[a-f0-9]{64}$
                      description: The instrument admin address.
                    instrumentId:
                      type: string
                      description: The instrument id.
                    to:
                      type: string
                      pattern: ^[a-zA-Z0-9-_]*::1220[a-f0-9]{64}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo, recorded as the transfer reason on the ledger.
                    offer:
                      type: boolean
                      description: If true it will create a transfer offer.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - instrumentAdmin
                    - instrumentId
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer standard tokens that implement the [CIP-56
                    specification](https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md).
                  title: Canton Standard Token (CIP-56)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Cis2
                    to:
                      type: string
                      pattern: ^[1-9A-HJ-NP-Za-km-z]{50}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    tokenAddress:
                      type: string
                      description: >-
                        The token address following
                        (https://proposals.concordium.com/CIS/cis-2.html#token-address).
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - to
                    - amount
                    - tokenAddress
                  additionalProperties: false
                  description: >-
                    Transfer tokens that implement the [CIS-2
                    specification](https://proposals.concordium.software/CIS/cis-2.html).
                  title: CIS-2 Standard
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Cis7
                    to:
                      type: string
                      pattern: ^[1-9A-HJ-NP-Za-km-z]{50}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    tokenId:
                      type: string
                      description: The Cis7 token identifier.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo or destination tag.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - to
                    - amount
                    - tokenId
                  additionalProperties: false
                  description: >-
                    Transfer Concordium protocol level tokens.
                    (https://proposals.concordium.com/CIS/cis-7.html#cis-7-protocol-level-tokens-plts)
                  title: Concordium Protocol Level Token (CIS-7)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Coin
                    coin:
                      type: string
                      description: The coin identifier.
                    to:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{64}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - coin
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer Sui fungible assets that implement [coin
                    standard](https://docs.sui.io/standards/coin).
                  title: Sui Coin
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Erc20
                    contract:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{40}$
                      description: The ERC-20 contract address.
                    to:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{40}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    priority:
                      type: string
                      enum:
                        - Slow
                        - Standard
                        - Fast
                      description: >-
                        The priority that determines the fees paid for the
                        transfer.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - contract
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Send (initiate) an ERC-20 or BEP-20 token transfer. Use
                    request `kind: "Erc20"` on all EVM chains, including BNB
                    Smart Chain (BEP-20 tokens). Note: `Erc20` is the request
                    kind; the wallet-history and webhook event you read back
                    later is `Erc20Transfer`. Transfers fungible tokens that
                    implement the [ERC-20
                    specification](https://eips.ethereum.org/EIPS/eip-20).
                  title: EVM Fungible Token (ERC-20)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Erc721
                    contract:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{40}$
                      description: The ERC-721 contract address.
                    to:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{40}$
                      description: The destination address.
                    tokenId:
                      type: string
                      pattern: ^\d+$
                      description: The token to transfer.
                    priority:
                      type: string
                      enum:
                        - Slow
                        - Standard
                        - Fast
                      description: >-
                        The priority that determines the fees paid for the
                        transfer.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - contract
                    - to
                    - tokenId
                  additionalProperties: false
                  description: >-
                    Transfer non-fungible tokens that implement the [ERC-721
                    specification](https://eips.ethereum.org/EIPS/eip-721)
                  title: EVM Non Fungible Token (ERC-721)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Erc7984
                    contract:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{40}$
                      description: The ERC-7984 confidential token contract address.
                    to:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{40}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    priority:
                      type: string
                      enum:
                        - Slow
                        - Standard
                        - Fast
                      description: >-
                        The priority that determines the fees paid for the
                        transfer.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - contract
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer confidential tokens that implement the [ERC-7984
                    specification](https://eips.ethereum.org/EIPS/eip-7984). The
                    transfer amount is encrypted on-chain using Fully
                    Homomorphic Encryption (FHE).
                  title: EVM Confidential Token (ERC-7984)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Hip17
                    tokenId:
                      type: string
                      description: The token to transfer.
                    serialNumber:
                      type: string
                      pattern: ^\d+$
                    to:
                      type: string
                      pattern: >-
                        ^(0x[0-9a-fA-F]{40}|0\.0\.(\d+|[0-9a-fA-F]{40}|[0-9a-fA-F]{64,}))$
                      description: The destination address.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo or destination tag.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - tokenId
                    - serialNumber
                    - to
                  additionalProperties: false
                  description: ''
                  title: Hedera Non-Fungible Token (HIP-17)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Hts
                    tokenId:
                      type: string
                      description: The token to transfer.
                    to:
                      type: string
                      pattern: >-
                        ^(0x[0-9a-fA-F]{40}|0\.0\.(\d+|[0-9a-fA-F]{40}|[0-9a-fA-F]{64,}))$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - tokenId
                    - to
                    - amount
                  additionalProperties: false
                  description: ''
                  title: Hedera Tokens (HTS)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Iou
                    currency:
                      type: string
                      description: The IOU currency code.
                    issuer:
                      type: string
                      pattern: ^r[1-9A-HJ-NP-Za-km-z]{24,34}$
                      description: The IOU issuer address.
                    to:
                      type: string
                      pattern: ^r[1-9A-HJ-NP-Za-km-z]{24,34}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo or destination tag.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - currency
                    - issuer
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer XRPL IOU tokens with specified currency and issuer.
                    (https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens)
                  title: XRPL IOU Token
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Sep41
                    issuer:
                      type: string
                      pattern: ^(G[A-Z0-9]{55}|M[A-Z0-9]{68})$
                      description: The asset issuer address.
                    assetCode:
                      type: string
                      description: The asset code.
                    to:
                      type: string
                      pattern: ^(G[A-Z0-9]{55}|M[A-Z0-9]{68})$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo or destination tag.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - issuer
                    - assetCode
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer classic [Stellar
                    Assets](https://developers.stellar.org/docs/issuing-assets/anatomy-of-an-asset).
                    They all implement the [SEP-41 token
                    interface](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md).
                  title: Stellar Classic Assets (SEP-41)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Snip2
                    contract:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{64}$
                      description: The SNIP-2 (ERC-20-like) contract address.
                    to:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{64}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - contract
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer fungible tokens that implement the [SNIP-2
                    (ERC-20-like)
                    specification](https://github.com/starknet-io/SNIPs/blob/ea46a8777d8c8d53a43f45b7beb1abcc301a1a69/SNIPS/snip-2.md).
                  title: Starknet SNIP-2 (ERC-20 like)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Snip3
                    contract:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{64}$
                      description: The SNIP-3 (ERC-721) contract address.
                    to:
                      type: string
                      pattern: ^0x[0-9a-fA-F]{64}$
                      description: The destination address.
                    tokenId:
                      type: string
                      pattern: ^\d+$
                      description: The token to transfer.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - contract
                    - to
                    - tokenId
                  additionalProperties: false
                  description: >-
                    Transfer non-fungible tokens that implement the [SNIP-3
                    (ERC-721-like)
                    specification](https://github.com/starknet-io/SNIPs/blob/ea46a8777d8c8d53a43f45b7beb1abcc301a1a69/SNIPS/snip-3.md)
                  title: Starknet SNIP-3 (ERC-721-like)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Spl
                        - Spl2022
                    to:
                      type: string
                      pattern: ^[1-9A-HJ-NP-Za-km-z]{32,44}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    mint:
                      type: string
                      pattern: ^[1-9A-HJ-NP-Za-km-z]{32,44}$
                      description: The mint account address.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo or destination tag.
                    createDestinationAccount:
                      type: boolean
                      description: >-
                        If `true`, pay to create the associated token account
                        for the recipient if it doesn't exist. Defaults to
                        `false`.
                    useDurableNonce:
                      type: boolean
                      description: >-
                        Optional. When `true` the SPL transfer is built as a
                        durable-nonce transaction using one of the wallet's
                        nonce accounts (picked server-side). The wallet's nonce
                        account pool must be pre-populated via `POST
                        /wallets/{id}/transactions` with `kind:
                        CreateSolanaNonceAccounts`.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - to
                    - amount
                    - mint
                  additionalProperties: false
                  description: >-
                    Transfer [SPL tokens](https://spl.solana.com/token) or [SPL
                    2022 tokens](https://spl.solana.com/token-2022).
                  title: Solana Program Library Token (SPL and SPL 2022)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Tep74
                    to:
                      type: string
                      pattern: ^(?:[A-Za-z0-9\-_]{48}|\d+:[a-fA-F0-9]{64})$
                      description: The destination address.
                    master:
                      type: string
                      pattern: ^(?:[A-Za-z0-9\-_]{48}|\d+:[a-fA-F0-9]{64})$
                      description: The Jetton master contract address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo or destination tag.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - to
                    - master
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer
                    [Jetton](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)
                    tokens.
                  title: TON Jetton (TEP-74)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Trc10
                    tokenId:
                      type: string
                      pattern: ^\d+$
                      description: The token ID.
                    to:
                      type: string
                      pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - tokenId
                    - to
                    - amount
                  additionalProperties: false
                  description: Transfer TRON's TRC-10 fungible tokens
                  title: TRON Native Fungible Token (TRC-10)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Trc20
                    contract:
                      type: string
                      pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                      description: The smart contract address.
                    to:
                      type: string
                      pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - contract
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer fungible tokens that implement the TRC-20 smart
                    contract specification.
                  title: TRON Smart Contract Fungible Token (TRC-20)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Trc721
                    contract:
                      type: string
                      pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                      description: The smart contract address.
                    to:
                      type: string
                      pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                      description: The destination address.
                    tokenId:
                      type: string
                      pattern: ^\d+$
                      description: The token to transfer.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - contract
                    - to
                    - tokenId
                  additionalProperties: false
                  description: >-
                    Transfer non-fungible tokens that implement the TRC-721
                    smart contract specification.
                  title: TRON Non Fungible Token (TRC-721)
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Xls33
                    issuanceId:
                      type: string
                      description: The XLS-33 issuance identifier.
                    to:
                      type: string
                      pattern: ^r[1-9A-HJ-NP-Za-km-z]{24,34}$
                      description: The destination address.
                    amount:
                      type: string
                      pattern: ^\d+$
                      description: >-
                        The amount of tokens to transfer in minimum
                        denomination.
                    memo:
                      anyOf:
                        - type: string
                          maxLength: 64
                          pattern: ^[a-zA-Z0-9]+$
                        - type: string
                          enum:
                            - ''
                      description: The memo or destination tag.
                    externalId:
                      type: string
                      minLength: 1
                      maxLength: 50
                      description: >-
                        A unique ID from your system. It can be leveraged to be
                        used as an idempotency key. (read more
                        [here](https://docs.dfns.co/api-reference/idempotency))
                    travelRule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Notabene
                            beneficiaryVASPdid:
                              type: string
                            beneficiaryProof:
                              type: object
                              additionalProperties: {}
                            originator:
                              type: object
                              additionalProperties: {}
                            beneficiary:
                              type: object
                              additionalProperties: {}
                          required:
                            - kind
                            - originator
                            - beneficiary
                          additionalProperties: false
                          title: Notabene Travel Rule
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Sumsub
                          required:
                            - kind
                          additionalProperties: false
                          title: Sumsub Travel Rule
                      description: >-
                        A travel rule payload to associate with the transfer.
                        (read more
                        [here](https://docs.dfns.co/features/travel-rule))
                    feeSponsorId:
                      type: string
                      minLength: 1
                      maxLength: 64
                      pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                      description: >-
                        Id of the fee sponsor that will be used to pay for your
                        transfer fees, it might not be available for all
                        blockchains. (read more
                        [here](https://docs.dfns.co/features/fee-sponsors))
                      example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                  required:
                    - kind
                    - issuanceId
                    - to
                    - amount
                  additionalProperties: false
                  description: >-
                    Transfer XRPL XLS-33 Token with specified issuance ID.
                    (https://xrpl.org/docs/concepts/tokens/fungible-tokens/multi-purpose-tokens
                  title: XRPL XLS-33 Token
            examples:
              Native:
                value:
                  kind: Native
                  to: '0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb'
                  amount: '1'
              Asa:
                value:
                  kind: Asa
                  assetId: '10458941'
                  to: CJLKQWNTSQU64F4OBJSQK35THVI4KE4QIT3KEYB4CRBHQAIMO2CD6JWBCY
                  amount: '1'
              Cardano Asset:
                description: >-
                  Transfer Cardano assets following [Mary
                  update](https://docs.cardano.org/about-cardano/evolution/upgrades/mary)
                value:
                  kind: Asset
                  assetId: >-
                    c003c63129289a15b2d87216ce7366ea1832cfb9fc967f524ff1a8b564666e73636f696e
                  to: >-
                    addr_test1vqucg65d0c2fmjexgeenwz4acajyfxj8qqewu9xl5vmq32casygkx
                  amount: '1'
              Cip56:
                value:
                  kind: Cip56
                  instrumentAdmin: >-
                    dfnsdev1::12209b43bea8836d8cb65f3e05515f44b19daf1cf9110096e407c50fb7134e0823ea
                  instrumentId: DfnsToken2
                  to: >-
                    dfns1::122035ead564c650e3051c6bad8e01f319b9db0acbfd2e0acf1c05baebcef16cb468
                  amount: '100000000000'
              Cis2:
                value:
                  kind: Cis2
                  tokenAddress: 33ojRvaXs8J2
                  to: 4HhAcToZs6rtxGcgsBRS3VcjeAECPTTSTFVUKS6rBSVEZAPL6d
                  amount: '3'
              Coin:
                value:
                  kind: Coin
                  coin: >-
                    0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
                  to: >-
                    0x1d9c96adb0eda0b3beca44ed89143444b4147b30f06eef7bfc39cbbff848f6e5
                  amount: '1'
              Erc20:
                value:
                  kind: Erc20
                  contract: '0x6f14c02fc1f78322cfd7d707ab90f18bad3b54f5'
                  to: '0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb'
                  amount: '1'
              Erc20 Fee Sponsor:
                value:
                  kind: Erc20
                  contract: '0xF56636F7eD43068BEbe9D5Dc7486e70D10bCa5ac'
                  to: '0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb'
                  amount: '1000000000000000000'
                  feeSponsorId: fs-5c47l-bp7f9-82n9raruj5n3spbe
              Erc721:
                value:
                  kind: Erc721
                  contract: '0xc98f6a0670de5029faf44db6c35d935d534708cf'
                  to: '0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb'
                  tokenId: '1'
              Erc7984:
                value:
                  kind: Erc7984
                  contract: '0x593E77e7E2bEe748aa27942E1f2069b5B6902625'
                  to: '0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb'
                  amount: '1000000'
              Native Fee Sponsor:
                value:
                  kind: Native
                  to: '0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb'
                  amount: '1'
                  feeSponsorId: fs-5c47l-bp7f9-82n9raruj5n3spbe
              Native Offer:
                description: >-
                  Set `offer` field to `true` to create a transfer offer.
                  Currently only supported on Canton.
                value:
                  kind: Native
                  to: >-
                    dfns1::122035ead564c650e3051c6bad8e01f319b9db0acbfd2e0acf1c05baebcef16cb468
                  amount: '100000000000'
                  offer: true
              Cis7:
                value:
                  kind: Cis7
                  tokenId: USDR
                  to: 4HhAcToZs6rtxGcgsBRS3VcjeAECPTTSTFVUKS6rBSVEZAPL6d
                  amount: '1000000'
              Sep41:
                value:
                  kind: Sep41
                  issuer: GCIQLRAXSY4FDEMCEPOGQICBZKJZBRZURKSD75BFKASMFUKYMFAUQVQ5
                  assetCode: Dfns
                  to: GCVGVFCH2ECV2KIHJ46Q5NPFMTO5RAD3KGRJ3ZBHAZ37EMMAL7DOXXRS
                  amount: '1'
              Sep41 Fee Sponsor:
                value:
                  kind: Sep41
                  issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
                  assetCode: USDC
                  to: GC32HQJNYDEMOSFLA5JFW4AREK4IXV4PMAGHMNBNE7ZF4X4SIRGN5ACC
                  amount: '1'
                  feeSponsorId: fs-43hcm-1pa06-99i97tj9srfnnlla
              Snip2:
                description: >-
                  Transfer fungible tokens that implement the SNIP-2
                  (ERC-20-like) specification on Starknet
                value:
                  kind: Snip2
                  contract: >-
                    0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7
                  to: >-
                    0x00a7f1280ab53c49cb06878ba23496359bd94f2d786baee710ec1f34acd40a0a
                  amount: '1000000000000000000'
              Snip3:
                description: >-
                  Transfer non-fungible tokens that implement the SNIP-3
                  (ERC-721-like) specification on Starknet
                value:
                  kind: Snip3
                  contract: >-
                    0x0367b438f8b77137bdeccf457676677e134c82c92f9580eda85df4f61236c101
                  to: >-
                    0x00a7f1280ab53c49cb06878ba23496359bd94f2d786baee710ec1f34acd40a0a
                  tokenId: '1'
              Spl:
                value:
                  kind: Spl
                  mint: BhkGzPPoadnw1sAymCj2zNH3JuBe6Lk68hNAcFNhMGeH
                  to: 3U6stgsD1FmA7o3omUguritCU8iWmUM7Rs6KqAHHxHVZ
                  amount: '1'
              Tep74:
                value:
                  kind: Tep74
                  master: kQBFAGo2Af6omLixtgsqqte_QXpZfjbEe8VfsqW_cWLyFz-h
                  to: 0QAWf1Hx6ZFX6-IQ2zsZTthHWOMNQHmoKFbuhQRvV3F_b3yd
                  amount: '1'
              Trc10:
                value:
                  kind: Trc10
                  tokenId: '1005273'
                  to: TADDx31pdCFfp3XrYxp6fQGbRxriYFLTrx
                  amount: '1'
              Trc721:
                value:
                  kind: Trc721
                  contract: TKgnDMWHYmwH24REe9XnrnwcNCvtb53n8Q
                  to: TADDx31pdCFfp3XrYxp6fQGbRxriYFLTrx
                  tokenId: '0'
              Iou:
                value:
                  kind: Iou
                  currency: USD
                  issuer: rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq
                  to: rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe
                  amount: '1000000'
              Xls33:
                value:
                  kind: Xls33
                  issuanceId: ABCDEF123456789
                  to: rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe
                  amount: '1000000'
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TransferRequest'
      security:
        - authenticationToken: []
          userActionSignature: []
components:
  schemas:
    TransferRequest:
      type: object
      properties:
        id:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^xfr-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: Transfer id.
          example: xfr-20g4k-nsdpo-mg6arrifgvid4orn
        walletId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^wa-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: The source wallet for this tranfer.
          example: wa-5pfuu-9euek-h0odgb6snva8ph3k
        network:
          allOf:
            - $ref: '#/components/schemas/Network'
            - description: The blockchain network this transfer is on.
        requester:
          $ref: '#/components/schemas/Requester'
        requestBody:
          oneOf:
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Native
                to:
                  type: string
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: >-
                    The amount of native tokens to transfer in minimum
                    denomination.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo or destination tag (supported networks only).
                priority:
                  type: string
                  enum:
                    - Slow
                    - Standard
                    - Fast
                  description: >-
                    The priority that determines the fees paid for the transfer.
                    All EVM compatible networks and Bitcoin support `priority`.
                    Not supported for other networks. It uses the [estimate
                    fees](https://docs.dfns.co/api-reference/networks/estimate-fees)
                    API to calculate the transfer fees. When not specified,
                    defaults to `Standard` priority.
                createDestinationAccount:
                  type: boolean
                  description: >-
                    Whether to create the destination account on chains that
                    require account creation (e.g., Stellar). Only valid for
                    chains that require the receiver account to exist before
                    transfer.
                offer:
                  type: boolean
                  description: >-
                    Optional field for Canton, if true it will create a transfer
                    offer.
                expiresAt:
                  type: string
                  format: date-time
                  description: >-
                    Optional field for Canton, especially useful in the context
                    of offers
                useDurableNonce:
                  type: boolean
                  description: >-
                    Optional Solana-only flag. When `true` the SOL transfer is
                    built as a durable-nonce transaction using one of the
                    wallet's nonce accounts (picked server-side). Use this for
                    offline-signing flows where the construct → broadcast gap
                    may exceed 90 seconds. The wallet's nonce account pool must
                    be pre-populated via `POST /wallets/{id}/transactions` with
                    `kind: CreateSolanaNonceAccounts`.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                structured:
                  type: object
                  additionalProperties: {}
              required:
                - kind
                - to
                - amount
              additionalProperties: false
              title: Native Asset
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Erc20
                contract:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{40}$
                  description: The ERC-20 contract address.
                to:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{40}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                priority:
                  type: string
                  enum:
                    - Slow
                    - Standard
                    - Fast
                  description: The priority that determines the fees paid for the transfer.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                structured:
                  type: object
                  additionalProperties: {}
              required:
                - kind
                - contract
                - to
                - amount
              additionalProperties: false
              title: EVM Fungible Token (ERC-20)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Aip21
                metadata:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{64}$
                  description: 'The asset metadata address. '
                to:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{64}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - metadata
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer Aptos fungible asset that implement the [AIP-21
                specification](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-21.md).
              title: Aptos Fungible Asset (AIP-21)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Asa
                assetId:
                  type: string
                  pattern: ^\d+$
                  description: 'The token asset id. '
                to:
                  type: string
                  pattern: ^[A-Z0-9]{58}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo or destination tag.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - assetId
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer Algorand standard assets, or
                [ASAs](https://developer.algorand.org/docs/get-details/asa/).
              title: Algorand Standard Asset
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Asset
                assetId:
                  type: string
                  description: 'The token asset id. '
                to:
                  type: string
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - assetId
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer Cardano assets following [Mary
                update](https://docs.cardano.org/about-cardano/evolution/upgrades/mary)
              title: Cardano Asset
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Cip56
                instrumentAdmin:
                  type: string
                  pattern: ^[a-zA-Z0-9-_]*::1220[a-f0-9]{64}$
                  description: The instrument admin address.
                instrumentId:
                  type: string
                  description: The instrument id.
                to:
                  type: string
                  pattern: ^[a-zA-Z0-9-_]*::1220[a-f0-9]{64}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo, recorded as the transfer reason on the ledger.
                offer:
                  type: boolean
                  description: If true it will create a transfer offer.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - instrumentAdmin
                - instrumentId
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer standard tokens that implement the [CIP-56
                specification](https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md).
              title: Canton Standard Token (CIP-56)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Cis2
                to:
                  type: string
                  pattern: ^[1-9A-HJ-NP-Za-km-z]{50}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                tokenAddress:
                  type: string
                  description: >-
                    The token address following
                    (https://proposals.concordium.com/CIS/cis-2.html#token-address).
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - to
                - amount
                - tokenAddress
              additionalProperties: false
              description: >-
                Transfer tokens that implement the [CIS-2
                specification](https://proposals.concordium.software/CIS/cis-2.html).
              title: CIS-2 Standard
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Cis7
                to:
                  type: string
                  pattern: ^[1-9A-HJ-NP-Za-km-z]{50}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                tokenId:
                  type: string
                  description: The Cis7 token identifier.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo or destination tag.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - to
                - amount
                - tokenId
              additionalProperties: false
              description: >-
                Transfer Concordium protocol level tokens.
                (https://proposals.concordium.com/CIS/cis-7.html#cis-7-protocol-level-tokens-plts)
              title: Concordium Protocol Level Token (CIS-7)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Coin
                coin:
                  type: string
                  description: The coin identifier.
                to:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{64}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - coin
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer Sui fungible assets that implement [coin
                standard](https://docs.sui.io/standards/coin).
              title: Sui Coin
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Erc721
                contract:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{40}$
                  description: The ERC-721 contract address.
                to:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{40}$
                  description: The destination address.
                tokenId:
                  type: string
                  pattern: ^\d+$
                  description: The token to transfer.
                priority:
                  type: string
                  enum:
                    - Slow
                    - Standard
                    - Fast
                  description: The priority that determines the fees paid for the transfer.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - contract
                - to
                - tokenId
              additionalProperties: false
              description: >-
                Transfer non-fungible tokens that implement the [ERC-721
                specification](https://eips.ethereum.org/EIPS/eip-721)
              title: EVM Non Fungible Token (ERC-721)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Erc7984
                contract:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{40}$
                  description: The ERC-7984 confidential token contract address.
                to:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{40}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                priority:
                  type: string
                  enum:
                    - Slow
                    - Standard
                    - Fast
                  description: The priority that determines the fees paid for the transfer.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - contract
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer confidential tokens that implement the [ERC-7984
                specification](https://eips.ethereum.org/EIPS/eip-7984). The
                transfer amount is encrypted on-chain using Fully Homomorphic
                Encryption (FHE).
              title: EVM Confidential Token (ERC-7984)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Hip17
                tokenId:
                  type: string
                  description: The token to transfer.
                serialNumber:
                  type: string
                  pattern: ^\d+$
                to:
                  type: string
                  pattern: >-
                    ^(0x[0-9a-fA-F]{40}|0\.0\.(\d+|[0-9a-fA-F]{40}|[0-9a-fA-F]{64,}))$
                  description: The destination address.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo or destination tag.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - tokenId
                - serialNumber
                - to
              additionalProperties: false
              description: ''
              title: Hedera Non-Fungible Token (HIP-17)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Hts
                tokenId:
                  type: string
                  description: The token to transfer.
                to:
                  type: string
                  pattern: >-
                    ^(0x[0-9a-fA-F]{40}|0\.0\.(\d+|[0-9a-fA-F]{40}|[0-9a-fA-F]{64,}))$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - tokenId
                - to
                - amount
              additionalProperties: false
              description: ''
              title: Hedera Tokens (HTS)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Iou
                currency:
                  type: string
                  description: The IOU currency code.
                issuer:
                  type: string
                  pattern: ^r[1-9A-HJ-NP-Za-km-z]{24,34}$
                  description: The IOU issuer address.
                to:
                  type: string
                  pattern: ^r[1-9A-HJ-NP-Za-km-z]{24,34}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo or destination tag.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - currency
                - issuer
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer XRPL IOU tokens with specified currency and issuer.
                (https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens)
              title: XRPL IOU Token
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Sep41
                issuer:
                  type: string
                  pattern: ^(G[A-Z0-9]{55}|M[A-Z0-9]{68})$
                  description: The asset issuer address.
                assetCode:
                  type: string
                  description: The asset code.
                to:
                  type: string
                  pattern: ^(G[A-Z0-9]{55}|M[A-Z0-9]{68})$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo or destination tag.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - issuer
                - assetCode
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer classic [Stellar
                Assets](https://developers.stellar.org/docs/issuing-assets/anatomy-of-an-asset).
                They all implement the [SEP-41 token
                interface](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md).
              title: Stellar Classic Assets (SEP-41)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Snip2
                contract:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{64}$
                  description: The SNIP-2 (ERC-20-like) contract address.
                to:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{64}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - contract
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer fungible tokens that implement the [SNIP-2
                (ERC-20-like)
                specification](https://github.com/starknet-io/SNIPs/blob/ea46a8777d8c8d53a43f45b7beb1abcc301a1a69/SNIPS/snip-2.md).
              title: Starknet SNIP-2 (ERC-20 like)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Snip3
                contract:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{64}$
                  description: The SNIP-3 (ERC-721) contract address.
                to:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{64}$
                  description: The destination address.
                tokenId:
                  type: string
                  pattern: ^\d+$
                  description: The token to transfer.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - contract
                - to
                - tokenId
              additionalProperties: false
              description: >-
                Transfer non-fungible tokens that implement the [SNIP-3
                (ERC-721-like)
                specification](https://github.com/starknet-io/SNIPs/blob/ea46a8777d8c8d53a43f45b7beb1abcc301a1a69/SNIPS/snip-3.md)
              title: Starknet SNIP-3 (ERC-721-like)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Spl
                    - Spl2022
                to:
                  type: string
                  pattern: ^[1-9A-HJ-NP-Za-km-z]{32,44}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                mint:
                  type: string
                  pattern: ^[1-9A-HJ-NP-Za-km-z]{32,44}$
                  description: The mint account address.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo or destination tag.
                createDestinationAccount:
                  type: boolean
                  description: >-
                    If `true`, pay to create the associated token account for
                    the recipient if it doesn't exist. Defaults to `false`.
                useDurableNonce:
                  type: boolean
                  description: >-
                    Optional. When `true` the SPL transfer is built as a
                    durable-nonce transaction using one of the wallet's nonce
                    accounts (picked server-side). The wallet's nonce account
                    pool must be pre-populated via `POST
                    /wallets/{id}/transactions` with `kind:
                    CreateSolanaNonceAccounts`.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                structured:
                  type: object
                  additionalProperties: {}
              required:
                - kind
                - to
                - amount
                - mint
              additionalProperties: false
              title: Solana Program Library Token (SPL and SPL 2022)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Tep74
                to:
                  type: string
                  pattern: ^(?:[A-Za-z0-9\-_]{48}|\d+:[a-fA-F0-9]{64})$
                  description: The destination address.
                master:
                  type: string
                  pattern: ^(?:[A-Za-z0-9\-_]{48}|\d+:[a-fA-F0-9]{64})$
                  description: The Jetton master contract address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo or destination tag.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - to
                - master
                - amount
              additionalProperties: false
              description: >-
                Transfer
                [Jetton](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)
                tokens.
              title: TON Jetton (TEP-74)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Trc10
                tokenId:
                  type: string
                  pattern: ^\d+$
                  description: The token ID.
                to:
                  type: string
                  pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - tokenId
                - to
                - amount
              additionalProperties: false
              description: Transfer TRON's TRC-10 fungible tokens
              title: TRON Native Fungible Token (TRC-10)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Trc20
                contract:
                  type: string
                  pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                  description: The smart contract address.
                to:
                  type: string
                  pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - contract
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer fungible tokens that implement the TRC-20 smart
                contract specification.
              title: TRON Smart Contract Fungible Token (TRC-20)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Trc721
                contract:
                  type: string
                  pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                  description: The smart contract address.
                to:
                  type: string
                  pattern: ^T[1-9A-HJ-NP-Za-km-z]{33}$
                  description: The destination address.
                tokenId:
                  type: string
                  pattern: ^\d+$
                  description: The token to transfer.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - contract
                - to
                - tokenId
              additionalProperties: false
              description: >-
                Transfer non-fungible tokens that implement the TRC-721 smart
                contract specification.
              title: TRON Non Fungible Token (TRC-721)
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Xls33
                issuanceId:
                  type: string
                  description: The XLS-33 issuance identifier.
                to:
                  type: string
                  pattern: ^r[1-9A-HJ-NP-Za-km-z]{24,34}$
                  description: The destination address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: The amount of tokens to transfer in minimum denomination.
                memo:
                  anyOf:
                    - type: string
                      maxLength: 64
                      pattern: ^[a-zA-Z0-9]+$
                    - type: string
                      enum:
                        - ''
                  description: The memo or destination tag.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key. (read more
                    [here](https://docs.dfns.co/api-reference/idempotency))
                travelRule:
                  oneOf:
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Notabene
                        beneficiaryVASPdid:
                          type: string
                        beneficiaryProof:
                          type: object
                          additionalProperties: {}
                        originator:
                          type: object
                          additionalProperties: {}
                        beneficiary:
                          type: object
                          additionalProperties: {}
                      required:
                        - kind
                        - originator
                        - beneficiary
                      additionalProperties: false
                      title: Notabene Travel Rule
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - Sumsub
                      required:
                        - kind
                      additionalProperties: false
                      title: Sumsub Travel Rule
                  description: >-
                    A travel rule payload to associate with the transfer. (read
                    more [here](https://docs.dfns.co/features/travel-rule))
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Id of the fee sponsor that will be used to pay for your
                    transfer fees, it might not be available for all
                    blockchains. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
              required:
                - kind
                - issuanceId
                - to
                - amount
              additionalProperties: false
              description: >-
                Transfer XRPL XLS-33 Token with specified issuance ID.
                (https://xrpl.org/docs/concepts/tokens/fungible-tokens/multi-purpose-tokens
              title: XRPL XLS-33 Token
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
                  description: Corresponding asset price in USD at the time of transfer.
          required:
            - asset
          description: Additional metadata about the transfered asset.
        status:
          type: string
          enum:
            - Pending
            - Executing
            - Broadcasted
            - Confirmed
            - Failed
            - Rejected
          description: >-
            Transfer status.


            | Status | Definition |

            | --- | --- |

            | `Pending` | The request is pending approval due to a policy
            applied to the wallet. |

            | `Executing` | The request is approved and is in the process of
            being executed. note this status is only set for a short time
            between pending and broadcasted. |

            | `Broadcasted` | The transaction has been successfully written to
            the mempool. |

            | `Confirmed` | The transaction has been confirmed on-chain by our
            indexing pipeline. |

            | `Failed` | Indicates either system failure to complete the request
            or the transaction failed on chain. |

            | `Rejected` | The request has been rejected by a policy approval
            action. |
        reason:
          type: string
          description: The reason for a failed transfer.
        txHash:
          type: string
          description: The blockchain transaction hash for this transfer.
        fee:
          type: string
          description: The fee paid for this transfer in minimum denomination.
        dateRequested:
          type: string
          format: date-time
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). When the transfer was requested.
          example: '2023-04-14T20:41:28.715Z'
        datePolicyResolved:
          type: string
          format: date-time
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). When the transfer was approved by policy reviewers.
          example: '2023-04-14T20:41:28.715Z'
        dateBroadcasted:
          type: string
          format: date-time
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). When the transfer was broadcasted to the blockchain.
          example: '2023-04-14T20:41:28.715Z'
        dateConfirmed:
          type: string
          format: date-time
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). When the transfer was confirmed on chain.
          example: '2023-04-14T20:41:28.715Z'
        approvalId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^ap-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: The id of the approval request if this transfer triggered a policy.
          example: ap-2a9in-tt2a1-983lho480p35ejd0
        externalId:
          type: string
          description: The external id provided at transfer creation time.
        feeSponsorId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: The fee sponsor id used to pay for the transfer fees.
          example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
        replacementId:
          type: string
          description: >-
            The id of the replacement transaction (cancel or speed-up) issued
            for this transfer.
        details:
          type: object
          additionalProperties: {}
          description: >-
            Structured representation of the data used to construct the
            signature (e.g. nonce, gas parameters). Shape is blockchain
            specific.
      required:
        - id
        - walletId
        - network
        - requester
        - requestBody
        - metadata
        - status
        - dateRequested
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
    Requester:
      type: object
      properties:
        userId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^us-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: User id.
          example: us-6b58p-r53sr-rlrd3l5cj3uc4ome
        tokenId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^to-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: Token id.
          example: to-202a0-cdo33-o65mbt6q758lvvnt
      required:
        - userId
      description: The user who initiated the request.
  securitySchemes:
    authenticationToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >-
        **Bearer Token:** Used to authenticate API requests.

        More details how to generate the token: [Authentication
        flows](https://docs.dfns.co/api-reference/auth/login-flows)
    userActionSignature:
      type: apiKey
      in: header
      name: X-DFNS-USERACTION
      description: >-
        **User Action Signature:** Used to sign the change-inducing API
        requests.

        More details how to generate the token: [User Action Signing
        flows](https://docs.dfns.co/api-reference/auth/signing-flows)

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.