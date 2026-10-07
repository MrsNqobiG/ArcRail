> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Wallet Assets

> Retrieves a list of assets owned by the specified wallet.  Return values vary by chain as shown below. Each asset includes its current USD market price (`quotes`); pass `netWorth=true` to also return the wallet's total USD value (net worth).



## OpenAPI

````yaml /openapi.yaml get /wallets/{walletId}/assets
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
  /wallets/{walletId}/assets:
    get:
      tags:
        - Wallets
      summary: Get Wallet Assets
      description: >-
        Retrieves a list of assets owned by the specified wallet.  Return values
        vary by chain as shown below. Each asset includes its current USD market
        price (`quotes`); pass `netWorth=true` to also return the wallet's total
        USD value (net worth).
      operationId: getWalletAssets
      parameters:
        - schema:
            type: string
            minLength: 1
          required: true
          name: walletId
          in: path
        - schema:
            type: string
            enum:
              - 'true'
            description: >-
              Set to `true` to include the total fiat value (net worth) of all
              assets held in the wallet.
          required: false
          description: >-
            Set to `true` to include the total fiat value (net worth) of all
            assets held in the wallet.
          name: netWorth
          in: query
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  walletId:
                    type: string
                  network:
                    $ref: '#/components/schemas/Network'
                  assets:
                    type: array
                    items:
                      allOf:
                        - oneOf:
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Native
                              required:
                                - kind
                              title: Native assets
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Aip21
                                metadata:
                                  type: string
                              required:
                                - kind
                                - metadata
                              title: Aptos Fungible Assets (AIP-21)
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Asa
                                assetId:
                                  type: string
                              required:
                                - kind
                                - assetId
                              title: Algorand Standard Assets (ASAs)
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Cis2
                                tokenAddress:
                                  type: string
                              required:
                                - kind
                                - tokenAddress
                              title: Concordium CIS-2 tokens
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Erc20
                                    - Snip2
                                    - Trc20
                                contract:
                                  type: string
                              required:
                                - kind
                                - contract
                              title: EVM ERC-20/Starknet SNIP-2/TRON TRC-20 tokens
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Erc7984
                                contract:
                                  type: string
                              required:
                                - kind
                                - contract
                              title: EVM ERC-7984 confidential tokens
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Hts
                                tokenId:
                                  type: string
                              required:
                                - kind
                                - tokenId
                              title: Hedera tokens (HTS)
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Iou
                                currency:
                                  type: string
                                issuer:
                                  type: string
                              required:
                                - kind
                                - currency
                                - issuer
                              title: XRP Ledger IOU tokens
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Cip56
                                instrumentId:
                                  type: string
                                instrumentAdmin:
                                  type: string
                              required:
                                - kind
                                - instrumentId
                                - instrumentAdmin
                              title: Canton CIP-56 tokens
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Coin
                                    - LockedCoin
                                coin:
                                  type: string
                              required:
                                - kind
                                - coin
                              title: Sui/IOTA Coin assets
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Xls33
                                issuanceId:
                                  type: string
                              required:
                                - kind
                                - issuanceId
                              title: XRP Ledger MPL (XLS-33) tokens
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Asset
                                assetId:
                                  type: string
                              required:
                                - kind
                                - assetId
                              title: Polymesh/Cardano assets
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Cis7
                                tokenId:
                                  type: string
                              required:
                                - kind
                                - tokenId
                              title: Concordium PLTs ( CIS-7 tokens)
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Sep41
                                issuer:
                                  type: string
                                assetCode:
                                  type: string
                              required:
                                - kind
                                - issuer
                                - assetCode
                              title: Stellar SEP-41 tokens
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Trc10
                                tokenId:
                                  type: string
                              required:
                                - kind
                                - tokenId
                              title: TRON TRC-10 tokens
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Spl
                                    - Spl2022
                                mint:
                                  type: string
                              required:
                                - kind
                                - mint
                              title: Solana SPL/SPL2022 tokens
                            - type: object
                              properties:
                                kind:
                                  type: string
                                  enum:
                                    - Tep74
                                master:
                                  type: string
                              required:
                                - kind
                                - master
                              title: TON TEP-74 Jetton
                        - type: object
                          properties:
                            symbol:
                              type: string
                            decimals:
                              type: number
                            verified:
                              type: boolean
                            balance:
                              type: string
                            quotes:
                              type: object
                              properties:
                                USD:
                                  type: number
                              description: >-
                                Current market price of the asset, keyed by fiat
                                currency (e.g. USD). Sourced from DFNS market
                                data.
                          required:
                            - decimals
                            - balance
                  netWorth:
                    type: object
                    properties:
                      USD:
                        type: number
                    description: >-
                      Total fiat value (net worth) of all assets held in the
                      wallet, keyed by currency (e.g. USD). Returned only when
                      the request includes `netWorth=true`.
                required:
                  - walletId
                  - network
                  - assets
      security:
        - authenticationToken: []
components:
  schemas:
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