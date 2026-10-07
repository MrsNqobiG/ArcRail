> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Estimate Fees

> Gets real-time fee details for a given network, allowing users to make decisions based on their preferences for transaction speed/priority. Three levels of priority will be displayed: `slow`, `standard`, `fast`.

Legacy (pre-London) EVM networks such as Ethereum Classic do not support EIP-1559 fee estimation and are not listed here. When broadcasting on those networks, omit `priority` and a legacy `gasPrice` is filled automatically.



## OpenAPI

````yaml /openapi.yaml get /networks/fees
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
  /networks/fees:
    get:
      tags:
        - Networks
      summary: Estimate Fees
      description: >-
        Gets real-time fee details for a given network, allowing users to make
        decisions based on their preferences for transaction speed/priority.
        Three levels of priority will be displayed: `slow`, `standard`, `fast`.


        Legacy (pre-London) EVM networks such as Ethereum Classic do not support
        EIP-1559 fee estimation and are not listed here. When broadcasting on
        those networks, omit `priority` and a legacy `gasPrice` is filled
        automatically.
      operationId: estimateFees
      parameters:
        - schema:
            type: string
            enum:
              - Bitcoin
              - BitcoinSignet
              - BitcoinTestnet4
              - Litecoin
              - LitecoinTestnet
              - Dogecoin
              - DogecoinTestnet
              - ArbitrumOne
              - ArbitrumSepolia
              - Arc
              - ArcTestnet
              - Areum
              - AvalancheC
              - AvalancheCFuji
              - Base
              - BaseSepolia
              - Bob
              - BobSepolia
              - Bsc
              - BscTestnet
              - Berachain
              - BerachainBepolia
              - Celo
              - CeloSepolia
              - Codex
              - CodexSepolia
              - Ethereum
              - EthereumSepolia
              - EthereumHoodi
              - FlareC
              - FlareCCoston2
              - FlowEvm
              - FlowEvmTestnet
              - Ink
              - InkSepolia
              - Optimism
              - OptimismSepolia
              - Plasma
              - PlasmaTestnet
              - Plume
              - PlumeSepolia
              - Polygon
              - PolygonAmoy
              - Rayls
              - RaylsTestnet
              - Robinhood
              - RobinhoodSepolia
              - SeiPacific1
              - SeiAtlantic2
              - Sonic
              - SonicTestnet
              - Tempo
              - TempoModerato
              - Tsc
              - TscTestnet1
              - Xdc
              - XdcApothem
              - XLayer
              - XLayerSepolia
              - Solana
              - SolanaDevnet
          required: true
          name: network
          in: query
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                oneOf:
                  - type: object
                    properties:
                      kind:
                        type: string
                        enum:
                          - Bitcoin
                      network:
                        type: string
                        enum:
                          - Bitcoin
                          - BitcoinSignet
                          - BitcoinTestnet4
                          - Litecoin
                          - LitecoinTestnet
                          - Dogecoin
                          - DogecoinTestnet
                      blockNumber:
                        type: number
                      slow:
                        type: object
                        properties:
                          feeRate:
                            type: string
                            description: >-
                              Fee rate denominated in satoshis (the lowest
                              denomination) per virtual byte.
                            example: '12'
                          blockHorizon:
                            type: number
                            description: >-
                              Target number of blocks within which a transaction
                              at this fee rate is expected to confirm.
                            example: 2
                        required:
                          - feeRate
                          - blockHorizon
                      standard:
                        type: object
                        properties:
                          feeRate:
                            type: string
                            description: >-
                              Fee rate denominated in satoshis (the lowest
                              denomination) per virtual byte.
                            example: '12'
                          blockHorizon:
                            type: number
                            description: >-
                              Target number of blocks within which a transaction
                              at this fee rate is expected to confirm.
                            example: 2
                        required:
                          - feeRate
                          - blockHorizon
                      fast:
                        type: object
                        properties:
                          feeRate:
                            type: string
                            description: >-
                              Fee rate denominated in satoshis (the lowest
                              denomination) per virtual byte.
                            example: '12'
                          blockHorizon:
                            type: number
                            description: >-
                              Target number of blocks within which a transaction
                              at this fee rate is expected to confirm.
                            example: 2
                        required:
                          - feeRate
                          - blockHorizon
                    required:
                      - kind
                      - network
                      - blockNumber
                      - slow
                      - standard
                      - fast
                    title: Bitcoin
                  - type: object
                    properties:
                      kind:
                        type: string
                        enum:
                          - Eip1559
                      network:
                        type: string
                        enum:
                          - ArbitrumOne
                          - ArbitrumSepolia
                          - Arc
                          - ArcTestnet
                          - Areum
                          - AvalancheC
                          - AvalancheCFuji
                          - Base
                          - BaseSepolia
                          - Bob
                          - BobSepolia
                          - Bsc
                          - BscTestnet
                          - Berachain
                          - BerachainBepolia
                          - Celo
                          - CeloSepolia
                          - Codex
                          - CodexSepolia
                          - Ethereum
                          - EthereumClassic
                          - EthereumClassicMordor
                          - EthereumSepolia
                          - EthereumHoodi
                          - FlareC
                          - FlareCCoston2
                          - FlowEvm
                          - FlowEvmTestnet
                          - Ink
                          - InkSepolia
                          - Optimism
                          - OptimismSepolia
                          - Plasma
                          - PlasmaTestnet
                          - Plume
                          - PlumeSepolia
                          - Polygon
                          - PolygonAmoy
                          - Rayls
                          - RaylsTestnet
                          - Robinhood
                          - RobinhoodSepolia
                          - SeiPacific1
                          - SeiAtlantic2
                          - Sonic
                          - SonicTestnet
                          - Tempo
                          - TempoModerato
                          - Tsc
                          - TscTestnet1
                          - Xdc
                          - XdcApothem
                          - XLayer
                          - XLayerSepolia
                      blockNumber:
                        type: number
                      slow:
                        type: object
                        properties:
                          maxPriorityFeePerGas:
                            type: string
                            description: >-
                              Maximum priority fee (tip) per unit of gas,
                              denominated in wei (the lowest denomination).
                            example: '1500000000'
                          maxFeePerGas:
                            type: string
                            description: >-
                              Maximum total fee per unit of gas, denominated in
                              wei (the lowest denomination).
                            example: '1626000000000'
                        required:
                          - maxPriorityFeePerGas
                          - maxFeePerGas
                      standard:
                        type: object
                        properties:
                          maxPriorityFeePerGas:
                            type: string
                            description: >-
                              Maximum priority fee (tip) per unit of gas,
                              denominated in wei (the lowest denomination).
                            example: '1500000000'
                          maxFeePerGas:
                            type: string
                            description: >-
                              Maximum total fee per unit of gas, denominated in
                              wei (the lowest denomination).
                            example: '1626000000000'
                        required:
                          - maxPriorityFeePerGas
                          - maxFeePerGas
                      fast:
                        type: object
                        properties:
                          maxPriorityFeePerGas:
                            type: string
                            description: >-
                              Maximum priority fee (tip) per unit of gas,
                              denominated in wei (the lowest denomination).
                            example: '1500000000'
                          maxFeePerGas:
                            type: string
                            description: >-
                              Maximum total fee per unit of gas, denominated in
                              wei (the lowest denomination).
                            example: '1626000000000'
                        required:
                          - maxPriorityFeePerGas
                          - maxFeePerGas
                      baseFeePerGas:
                        type: string
                        description: >-
                          Base fee per unit of gas of the latest block,
                          denominated in wei (the lowest denomination).
                        example: '1000000000'
                    required:
                      - kind
                      - network
                      - blockNumber
                      - slow
                      - standard
                      - fast
                      - baseFeePerGas
                    description: >-
                      For EIP-1559, we  provide 2 different fields for each
                      strategy: `maxFee` (per Gas) and `maxPriorityFee` (per
                      Gas). To compute these estimations, we look at the block
                      history, compute three different percentiles for the
                      rewards offered by the transactions in the blocks, and
                      then calculate the average for each strategy.
                    title: EVM EIP-1559
                  - type: object
                    properties:
                      kind:
                        type: string
                        enum:
                          - Solana
                      network:
                        type: string
                        enum:
                          - Solana
                          - SolanaDevnet
                      blockNumber:
                        type: number
                      slow:
                        type: object
                        properties:
                          computeUnitPrice:
                            type: string
                            description: >-
                              Price per compute unit, denominated in
                              micro-lamports (the lowest denomination).
                            example: '10000'
                        required:
                          - computeUnitPrice
                      standard:
                        type: object
                        properties:
                          computeUnitPrice:
                            type: string
                            description: >-
                              Price per compute unit, denominated in
                              micro-lamports (the lowest denomination).
                            example: '10000'
                        required:
                          - computeUnitPrice
                      fast:
                        type: object
                        properties:
                          computeUnitPrice:
                            type: string
                            description: >-
                              Price per compute unit, denominated in
                              micro-lamports (the lowest denomination).
                            example: '10000'
                        required:
                          - computeUnitPrice
                    required:
                      - kind
                      - network
                      - blockNumber
                      - slow
                      - standard
                      - fast
                    title: Solana
      security:
        - authenticationToken: []
components:
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