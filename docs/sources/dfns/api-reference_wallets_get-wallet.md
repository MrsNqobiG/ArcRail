> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Wallet

> Retrieves a Wallet information by its ID.



## OpenAPI

````yaml /openapi.yaml get /wallets/{walletId}
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
  /wallets/{walletId}:
    get:
      tags:
        - Wallets
      summary: Get Wallet
      description: Retrieves a Wallet information by its ID.
      operationId: getWallet
      parameters:
        - schema:
            type: string
            minLength: 1
            maxLength: 64
            description: The wallet to retrieve.
          required: true
          description: The wallet to retrieve.
          name: walletId
          in: path
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Wallet'
      security:
        - authenticationToken: []
components:
  schemas:
    Wallet:
      type: object
      properties:
        id:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^wa-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: ID of the wallet.
          example: wa-5pfuu-9euek-h0odgb6snva8ph3k
        network:
          type: string
          description: Network this wallet is bound to.
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
        address:
          type: string
          description: Wallet address on its corresponding network.
        signingKey:
          type: object
          properties:
            id:
              type: string
              minLength: 1
              maxLength: 64
              pattern: ^key-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
              description: Key id.
              example: key-01snl-t56gb-j8tsok0vn802p80i
            scheme:
              $ref: '#/components/schemas/KeyScheme'
            curve:
              $ref: '#/components/schemas/KeyCurve'
            publicKey:
              type: string
              description: Hex-encoded value of the public key.
              example: >-
                e2375c8c9e87bfcd0be8f29d76c818cabacd51584f72cb2222d49a13b036d84d3d
            delegatedTo:
              type: string
              minLength: 1
              maxLength: 64
              pattern: ^us-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
              description: The end user ID the key (and wallet) is delegated to.
              example: us-6b58p-r53sr-rlrd3l5cj3uc4ome
          required:
            - id
            - scheme
            - curve
            - publicKey
          description: Details about the key underlying the wallet.
        status:
          type: string
          enum:
            - Active
            - Inactive
            - Archived
          description: Wallet status.
        dateCreated:
          type: string
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date string when
            wallet was created.
          example: '2023-04-14T20:41:28.715Z'
        dateDeleted:
          type: string
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date string when
            wallet was deleted.
          example: '2023-04-14T20:41:28.715Z'
        name:
          type: string
          maxLength: 100
          description: Wallet nickname.
        custodial:
          type: boolean
          description: >-
            Whether the wallet is owned by an end user (non-custodial), or by
            your organization (custodial).
        externalId:
          type: string
          maxLength: 100
          description: >-
            User-defined value that can be used to correlate the entity with an
            external system.
        tags:
          type: array
          items:
            type: string
            pattern: ^[a-zA-Z0-9_.:/+-]{1,100}$
            description: Wallet Tag.
          maxItems: 10
          description: List of tags.
        validatorId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^cv-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: '@deprecated use `networkInfo.validatorId` instead.'
          deprecated: true
        networkInfo:
          type: object
          properties:
            nonceAccounts:
              type: array
              items:
                type: string
              description: Confirmed Solana durable-nonce accounts owned by this wallet.
            validatorId:
              type: string
              minLength: 1
              maxLength: 64
              pattern: ^cv-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
              description: >-
                Id of the validator on which the wallet is created for Canton
                networks.
              example: cv-7jeof-m584r-p35ucm37ko3cqgts
          description: >-
            Additional chain-dependent information about the wallet. Only
            returned by Get Wallet.
        vaultId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^vlt-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: >-
            The vault controlling this wallet, absent for ordinary wallets. A
            vault wallet is read-only, its funds move through the vault
            endpoints, and it carries its vault name and tags as its own.
          example: vlt-5vbsp-u62g1-ostmunqgds5o9tc2
      required:
        - id
        - network
        - signingKey
        - status
        - dateCreated
        - custodial
        - tags
      example:
        id: wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx
        network: Ethereum
        address: '0x00e3495cf6af59008f22ffaf32d4c92ac33dac47'
        name: trading hot wallet
        signingKey:
          id: key-6ece3-9l565-xxxxxxxxxxxxxxxx
          scheme: ECDSA
          curve: secp256k1
          publicKey: e2375c8c9e87bfcd0be8f29d76c818cabacd51584f72cb2222d49a13b036d84d3d
        status: Active
        dateCreated: '2023-04-14T20:41:28.715Z'
        custodial: true
        tags: []
    KeyScheme:
      type: string
      description: The cryptographic scheme for the key.
      enum:
        - ECDSA
        - EdDSA
        - Schnorr
    KeyCurve:
      type: string
      enum:
        - ed25519
        - secp256k1
        - stark
      description: The elliptic curve for the key.
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