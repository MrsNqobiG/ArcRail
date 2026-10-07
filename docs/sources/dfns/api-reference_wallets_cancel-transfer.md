> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Cancel Transfer

> Cancels an EVM transfer by creating a replacement transaction with the same nonce. The new transaction sends 0 value to the same address, effectively nullifying the original transfer.
  
  This endpoint works for:
  - EVM-compatible networks (Ethereum, Polygon, BSC, etc.)
  - Transfers that are in 'Broadcasted' status (pending inclusion in a block)
  - Transfers that are in 'Failed' status, but failed off-chain (before being broadcasted to the network)
  
  The cancellation works by:
  1. Extracting the nonce from the original transfer's signed data
  2. Creating a new transaction to the same wallet address with 0 amount
  3. Using the same nonce to either:
     - Replace the original transaction in the mempool (if it was broadcasted)
     - Consume the nonce that was reserved but not used (if the transfer failed off-chain)
  
  Note: For transfers that were broadcasted on-chain, success is not guaranteed as it depends on network conditions and whether the original transaction has already been mined.



## OpenAPI

````yaml /openapi.yaml post /wallets/{walletId}/transfers/{transferId}/cancel
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
  /wallets/{walletId}/transfers/{transferId}/cancel:
    post:
      tags:
        - Wallets
      summary: Cancel Transfer
      description: >-
        Cancels an EVM transfer by creating a replacement transaction with the
        same nonce. The new transaction sends 0 value to the same address,
        effectively nullifying the original transfer.
          
          This endpoint works for:
          - EVM-compatible networks (Ethereum, Polygon, BSC, etc.)
          - Transfers that are in 'Broadcasted' status (pending inclusion in a block)
          - Transfers that are in 'Failed' status, but failed off-chain (before being broadcasted to the network)
          
          The cancellation works by:
          1. Extracting the nonce from the original transfer's signed data
          2. Creating a new transaction to the same wallet address with 0 amount
          3. Using the same nonce to either:
             - Replace the original transaction in the mempool (if it was broadcasted)
             - Consume the nonce that was reserved but not used (if the transfer failed off-chain)
          
          Note: For transfers that were broadcasted on-chain, success is not guaranteed as it depends on network conditions and whether the original transaction has already been mined.
      operationId: cancelTransfer
      parameters:
        - schema:
            type: string
            minLength: 1
            maxLength: 64
            description: Wallet id.
          required: true
          description: Wallet id.
          name: walletId
          in: path
        - schema:
            type: string
            minLength: 1
            maxLength: 64
            description: Transfer id.
          required: true
          description: Transfer id.
          name: transferId
          in: path
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TransactionRequest'
      security:
        - authenticationToken: []
          userActionSignature: []
components:
  schemas:
    TransactionRequest:
      type: object
      properties:
        id:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^tx-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: Transaction id.
          example: tx-583hu-sp2p7-slvb9nqpa3hd8bus
        walletId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^wa-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: Wallet id.
          example: wa-5pfuu-9euek-h0odgb6snva8ph3k
        network:
          $ref: '#/components/schemas/Network'
        requester:
          $ref: '#/components/schemas/Requester'
        requestBody:
          oneOf:
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Transaction
                transaction:
                  anyOf:
                    - type: string
                      pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                    - type: object
                      properties: {}
                  description: >-
                    A JSON transaction object (recommended for EVM and other
                    compatible networks) or an unsigned hex-encoded transaction.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - transaction
              additionalProperties: false
              description: >
                Signs an unsigned transaction and broadcasts it to chain. This
                is the recommended transaction `kind` for EVM networks — use it
                instead of the deprecated `Evm` and `Eip1559` kinds. It accepts
                a JSON transaction object (type 0 legacy, 2 EIP-1559, or 4
                EIP-7702) as well as a hex-encoded raw transaction.

                For EVM transactions, you may use JSON objects:


                | Field                |
                Description                                                                                                                                                                                                                        
                | Type - Optional              |

                |----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------|

                | type                 | Ethereum transaction type. 0 for legacy
                transaction; 2 for EIP-1559 transaction; 4 for EIP-7702
                transaction. Default is 2 if
                undefined.                                                                                            
                | Integer (optional)           |

                | to                   | The destination address or target
                contract. Leave undefined when the transaction is a contract
                deployment.                                                                                                                         
                | String (optional)            |

                | value                | The amount of native tokens to transfer
                in minimum
                denomination.                                                                                                                                                                   
                | String (optional)            |

                | data                 | ABI encoded function call data in hex
                format. Can also be the encoded smart contract data when the
                transaction is a contract
                deployment.                                                                                           
                | String (optional)            |

                | nonce                | The transaction number to guarantee
                idempotency. If omitted, it will be provided automatically. Note
                the same nonce can be submitted multiple times with a higher
                maxFeePerGas to "overwrite" existing transactions in the
                mempool. | Integer or String (optional) |

                | gasLimit             | The maximum amount of gas that can be
                spent for executing the transaction. If omitted, it will be
                calculated
                automatically.                                                                                                        
                | String (optional)            |

                | gasPrice             | The amount of per unit gas. Only valid
                for a type 0 legacy transaction. If omitted, it will be
                calculated
                automatically.                                                                                                           
                | String (optional)            |

                | maxFeePerGas         | The maximum amount of per unit gas
                willing to be paid for the transaction. Valid for type 2 and
                type 4 transactions. If omitted, it will be calculated
                automatically.                                                              
                | String (optional)            |

                | maxPriorityFeePerGas | The maximum amount of per unit gas to
                be included as a tip to the validator. Valid for type 2 and type
                4 transactions. If omitted, it will be calculated
                automatically.                                                            
                | String (optional)            |

                | authorizationList    | A list that indicates what code the
                signer of each authorization desires to execute in the context
                of their EOA. Only valid for type 4
                transaction.                                                                                
                | Authorization (optional)     |


                For Starknet transactions, you may use invocation request
                objects
                (https://github.com/starkware-libs/starknet-specs/blob/v0.8.1/api/starknet_api_openrpc.json#L2621):


                | Field                         |
                Description                                                                                        
                | Type - Optional                  |

                |-------------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------|

                | calldata                      | **Array** of encoded function
                call
                parameters                                                      
                | **Array of Strings** (required)  |

                | nonce                         | Transaction nonce in hex
                format                                                                    
                | String (required)                |

                | version                       | Transaction version in hex
                format. Typically "0x3" for current
                transactions                         | String
                (required)                |

                | resourceBounds                | Gas bounds for L1, L2, and L1
                data
                gas                                                             
                | Object (required)                |

                | ↳ resourceBounds.l1Gas        | L1 gas configuration with
                maxAmount and
                maxPricePerUnit                                             |
                Object (required)                |

                | ↳ resourceBounds.l2Gas        | L2 gas configuration with
                maxAmount and
                maxPricePerUnit                                             |
                Object (required)                |

                | ↳ resourceBounds.l1DataGas    | L1 data gas configuration with
                maxAmount and
                maxPricePerUnit                                        | Object
                (required)                |

                | tip                           | Transaction tip in hex format.
                Typically
                "0x0"                                                      |
                String (required)                |

                | paymasterData                 | Paymaster data
                array                                                                               
                | Array of Strings (required)      |

                | accountDeploymentData         | Account deployment data
                array                                                                      
                | Array of Strings (required)      |

                | nonceDataAvailabilityMode     | Data availability mode for
                nonce. Typically "L1" for
                now                                            | String
                (required)                |

                | feeDataAvailabilityMode       | Data availability mode for
                fee. Typically "L1" for
                now                                              | String
                (required)                |


                For Concordium transactions, you may use JSON objects (from
                https://github.com/Concordium/concordium-node-sdk-js/blob/sdk/12.0.0-alpha.3/packages/sdk/src/transactions/Transaction.ts#L102)


                | Field                            |
                Description                                                                                                                                                 
                | Type - Optional

                |----------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------|

                | Header                           | Transaction header for the
                intermediary state of account transactions, i.e. prior to being
                signing.                                                         
                | Object (required)               |

                | ↳ Header.executionEnergyAmount   | The destination address or
                target contract. Leave undefined when the transaction is a
                contract
                deployment.                                                   |
                String/Number/BigInt (required) |

                | ↳ Header.numSignatures           | The number of signatures
                the transaction can hold. If "undefined", this will be defined
                at the time of
                signing                                               | Integer
                (optional)              |

                | ↳ Header.sender                  | The account address that is
                source of this
                transaction                                                                                                      
                | String (optional)               |

                | ↳ Header.nonce                   | The account
                nonce                                                                                                                                           
                | String/Number/BigInt (optional) |

                | ↳ Header.expiry                  | expiration of the
                transaction                                                                                                                               
                | Integer (optional)              |

                | Payload                          | The transaction account
                payload in JSON format
                (https://github.com/Concordium/concordium-node-sdk-js/blob/main/packages/sdk/src/accountTransactions.ts#L646)
                | Object (required)               |




                ```json

                {
                  "kind": "Transaction",
                  "transaction": {
                    "to": "0x00fb58432ef9d418bf6688bcf0a226d2fcaa18e2",
                    "data": "0x40d097c3000000000000000000000000d2f77f85a50cdd650ca562f3a180284e1d5b4934",
                    "maxFeePerGas": "1626000000000",
                    "maxPriorityFeePerGas": "1332000000000"
                  }
                }

                ```


                ```json

                {
                  "kind": "Transaction",
                  "transaction": {
                    "type": "INVOKE",
                    "calldata": [
                      "1",
                      "2009894490435840142178314390393166646092438090257831307886760648929397478285",
                      "232670485425082704932579856502088130646006032362877466777181098476241604910",
                      "3",
                      "296727860213112272332383824629975240127004024814636931420022890499591637514",
                      "1",
                      "0"
                    ],
                    "nonce": "0x51",
                    "version": "0x3",
                    "resourceBounds": {
                      "l1Gas": { "maxAmount": "0x0", "maxPricePerUnit": "0x239a01ff6e6c" },
                      "l2Gas": { "maxAmount": "0x1694a0", "maxPricePerUnit": "0x10c388d00" },
                      "l1DataGas": { "maxAmount": "0x120", "maxPricePerUnit": "0x98e8" }
                    },
                    "tip": "0x0",
                    "paymasterData": [],
                    "accountDeploymentData": [],
                    "nonceDataAvailabilityMode": "L1",
                    "feeDataAvailabilityMode": "L1",
                  }
                }

                ```


                ```json

                {
                  "kind": "Transaction",
                  "transaction": {
                    "header": {
                      "sender": undefined,
                      "nonce": undefined,
                      "expiry": undefined,
                      "executionEnergyAmount": 300
                    },
                    "payload": {
                      "type": "transferWithMemo",
                      "toAddress": "4HhAcToZs6rtxGcgsBRS3VcjeAECPTTSTFVUKS6rBSVEZAPL6d",
                      "memo": "000968656c6c6f20636364",
                      "amount": "1"
                    }
                  }
                }

                ```
              title: Transaction
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Psbt
                psbt:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                  description: The hex encoded PSBT.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - psbt
              additionalProperties: false
              description: Signs a partially signed Bitcoin / Litecoin transaction.
              title: PSBT
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - SignDocDirect
                signDoc:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - signDoc
              additionalProperties: false
              description: >-
                Signs an unsigned transaction using [sign mode
                direct](https://docs.cosmos.network/main/learn/advanced/transactions#sign_mode_direct-preferred).
              title: SignDocDirect
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - UserOperations
                userOperations:
                  type: array
                  items:
                    type: object
                    properties:
                      to:
                        type: string
                        pattern: ^0x[0-9a-fA-F]{40}$
                        description: The destination address or target contract.
                      value:
                        type: string
                        pattern: ^\d+$
                        description: >-
                          The amount of native tokens to transfer in minimum
                          denomination.
                      data:
                        type: string
                        pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                        description: ABI encoded function call data in hex format.
                    required:
                      - to
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    A fee sponsor id to sponsor the transaction fee by another
                    wallet. (read more
                    [here](https://docs.dfns.co/features/fee-sponsors))
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - userOperations
                - feeSponsorId
              additionalProperties: false
              description: >-
                Signs one or more user operations and broadcasts to chain using
                a sponsored transaction. Used for invoking arbitrary smart
                contract calls, including batch operations, with a [fee
                sponsor](https://docs.dfns.co/features/fee-sponsors).


                Can only be used with a fee sponsor. Unsponsored user operations
                are not supported.
              title: EVM Sponsored transaction
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - FunctionCall
                call:
                  type: object
                  properties: {}
                  description: Function call arguments
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - call
              additionalProperties: false
              description: Calls an on-chain function that mutates state.
              title: Function Call
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - TransferPreapproval
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
              additionalProperties: false
              description: Enable canton coin auto approval.
              title: Canton Transfer Preapproval
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Evm
                to:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{40}$
                value:
                  anyOf:
                    - type: string
                      pattern: ^\d+$
                    - type: string
                      pattern: ^0x[0-9a-fA-F]*$
                data:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                nonce:
                  anyOf:
                    - type: integer
                      minimum: 0
                    - type: string
                      pattern: ^\d+$
                    - type: string
                      pattern: ^0x[0-9a-fA-F]*$
                  description: The current nonce of the signer EOA.
                gasLimit:
                  anyOf:
                    - type: string
                      pattern: ^\d+$
                    - type: string
                      pattern: ^0x[0-9a-fA-F]*$
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
              additionalProperties: false
              description: >-
                Deprecated. Only support type 2 transactions. Use the new JSON
                format with `Transaction` kind instead which has support for
                legacy and type 4 transactions.
              title: <Deprecated> EVM Transaction
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - Eip1559
                to:
                  type: string
                  pattern: ^0x[0-9a-fA-F]{40}$
                value:
                  anyOf:
                    - type: string
                      pattern: ^\d+$
                    - type: string
                      pattern: ^0x[0-9a-fA-F]*$
                data:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                nonce:
                  anyOf:
                    - type: integer
                      minimum: 0
                    - type: string
                      pattern: ^\d+$
                    - type: string
                      pattern: ^0x[0-9a-fA-F]*$
                gasLimit:
                  anyOf:
                    - type: string
                      pattern: ^\d+$
                    - type: string
                      pattern: ^0x[0-9a-fA-F]*$
                maxFeePerGas:
                  anyOf:
                    - type: string
                      pattern: ^\d+$
                    - type: string
                      pattern: ^0x[0-9a-fA-F]*$
                maxPriorityFeePerGas:
                  anyOf:
                    - type: string
                      pattern: ^\d+$
                    - type: string
                      pattern: ^0x[0-9a-fA-F]*$
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
              additionalProperties: false
              description: >-
                Deprecated. Only support type 2 transactions. Use the new JSON
                format with `Transaction` kind instead which has support for
                legacy and type 4 transactions.
              title: <Deprecated> EVM EIP-1559
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - CreateSolanaNonceAccounts
                nonceAuthority:
                  type: string
                  description: >-
                    Optional Solana address. The wallet that will own the nonce
                    accounts (be their on-chain authority). When omitted, the
                    URL wallet bootstraps for itself. When set, the URL wallet
                    pays the rent and signs the bootstrap, but the resulting
                    accounts' authority is this address — used to bootstrap on
                    behalf of an offline wallet that can't sign within the
                    90-second blockhash window.
                count:
                  type: integer
                  exclusiveMinimum: 0
                  maximum: 8
                  description: >-
                    Optional. Number of nonce accounts to create in one
                    bootstrap transaction (1–8; capped by Solana max-tx-size
                    budget). Defaults to 1.
                priority:
                  type: string
                  enum:
                    - Slow
                    - Standard
                    - Fast
                  description: Priority for the bootstrap fee. Defaults to Standard.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
              additionalProperties: false
              description: >-
                Creates Solana durable-nonce accounts owned by the calling
                wallet (or by `nonceAuthority` for cross-bootstrap).
                Pre-populates the wallet's nonce account pool so subsequent
                transfers can use `useDurableNonce: true`.
              title: Create Solana Nonce Accounts
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - AcceptInboundAsset
                issuer:
                  type: string
                  description: Stellar (G-address) or XRPL (r-address) issuer of the asset.
                assetCode:
                  type: string
                  description: Stellar asset code (1–12 ASCII alphanumeric chars).
                currency:
                  type: string
                  description: XRPL IOU currency code.
                assetId:
                  type: string
                  pattern: ^\d+$
                  description: Algorand Standard Asset (ASA) id.
                tokenId:
                  type: string
                  description: Hedera token entity id, e.g. "0.0.456858".
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
              additionalProperties: false
              description: >-
                Accept a non-native asset into the wallet on chains that gate
                inbound holding at the protocol level. Maps to Stellar
                `ChangeTrust`, XRPL `TrustSet`, Algorand asset opt-in (a
                0-amount asset transfer to self), Hedera `TokenAssociate`, or
                Canton `TransferPreapproval`. The body fields differ per network
                — see the field descriptions.
              title: AcceptInboundAsset
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - SolanaCctpBurn
                usdcMint:
                  type: string
                  description: Source USDC SPL mint address.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: USDC amount to burn (6 decimals).
                destinationDomain:
                  type: integer
                  description: CCTP destination domain.
                mintRecipient:
                  type: string
                  description: >-
                    Destination recipient as a bytes32 0x-hex value (EVM address
                    left-padded).
                maxFee:
                  type: string
                  pattern: ^\d+$
                  description: Max fee Circle may deduct from the burn.
                minFinalityThreshold:
                  type: integer
                  description: CCTP min finality threshold (1000 Fast, 2000 Standard).
                useDurableNonce:
                  type: boolean
                  description: >-
                    Bind the burn to a durable nonce instead of a recent
                    blockhash.
                feeSponsorId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^fs-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    Fee sponsor that pays the burn network fee and the ephemeral
                    event-account rent.
                  example: fs-5vqdl-gliqk-b4rfukqauov1sp7j
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - usdcMint
                - amount
                - destinationDomain
                - mintRecipient
                - maxFee
                - minFinalityThreshold
              additionalProperties: false
              description: >-
                Builds and broadcasts Circle's CCTP v2 depositForBurnWithHook on
                a Solana source. bik constructs the instruction (reserving a
                durable nonce in-band when requested) and co-signs the ephemeral
                event account; the wallet's MPC key signs the owner.
              title: Solana CCTP Burn
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - StellarCctpApprove
                issuer:
                  type: string
                  description: USDC SEP-41 issuer (G… account).
                assetCode:
                  type: string
                  description: USDC asset code.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: >-
                    Allowance for the CCTP TokenMessengerMinter, in
                    Stellar-local 7-decimal units.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - issuer
                - assetCode
                - amount
              additionalProperties: false
              description: >-
                SEP-41 approve of Circle's CCTP TokenMessengerMinter as a USDC
                spender on a Stellar source — required before StellarCctpBurn,
                which pulls the funds via transfer_from. bik builds and
                simulates the Soroban invocation; the wallet signs the
                transaction.
              title: Stellar CCTP Approve
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - StellarCctpBurn
                issuer:
                  type: string
                  description: USDC SEP-41 issuer (G… account).
                assetCode:
                  type: string
                  description: USDC asset code.
                amount:
                  type: string
                  pattern: ^\d+$
                  description: USDC amount to burn, in Stellar-local 7-decimal units.
                destinationDomain:
                  type: integer
                  description: CCTP destination domain.
                mintRecipient:
                  type: string
                  description: >-
                    Destination recipient as a bytes32 0x-hex value (EVM address
                    left-padded).
                maxFee:
                  type: string
                  pattern: ^\d+$
                  description: Max fee Circle may deduct from the burn, in 7-decimal units.
                minFinalityThreshold:
                  type: integer
                  description: >-
                    CCTP min finality threshold (2000 Standard; Stellar has no
                    Fast tier).
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - issuer
                - assetCode
                - amount
                - destinationDomain
                - mintRecipient
                - maxFee
                - minFinalityThreshold
              additionalProperties: false
              description: >-
                Builds and broadcasts Circle's CCTP v2
                deposit_for_burn_with_hook on a Stellar source. Requires a prior
                StellarCctpApprove. bik builds and simulates the Soroban
                invocation; the wallet signs the transaction.
              title: Stellar CCTP Burn
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - StellarCctpClaim
                message:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                  description: The attested CCTP message, hex-encoded (from Circle IRIS).
                attestation:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                  description: Circle's attestation over the message, hex-encoded.
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - message
                - attestation
              additionalProperties: false
              description: >-
                Claims an attested inbound CCTP mint on a Stellar destination by
                calling mint_and_forward on Circle's CctpForwarder — Circle's
                Forwarding Service does not deliver to Stellar. The call is
                permissionless; this wallet only pays the Soroban fee, and the
                USDC is forwarded to the recipient encoded in the burn's hook.
              title: Stellar CCTP Claim
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - SettleOffer
                txHash:
                  type: string
                decision:
                  type: string
                  enum:
                    - Accept
                    - Reject
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - txHash
                - decision
              additionalProperties: false
              description: Transaction for accepting or refusing a transfer offer.
              title: Offer Settlement
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - ActivateAccount
                args:
                  type: object
                  properties: {}
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
              additionalProperties: false
              description: Transaction for activating an account after creation.
              title: Account Activation
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - CancelTransaction
                txHash:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                signedTx:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - signedTx
              additionalProperties: false
              description: Transaction cancelling a previously sent transaction.
              title: Transaction Cancellation
            - type: object
              properties:
                kind:
                  type: string
                  enum:
                    - SpeedUpTransaction
                txHash:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                signedTx:
                  type: string
                  pattern: ^(0x)?([0-9a-fA-F][0-9a-fA-F])*$
                externalId:
                  type: string
                  minLength: 1
                  maxLength: 50
                  description: >-
                    A unique ID from your system. It can be leveraged to be used
                    as an idempotency key (read more
                    [here](https://docs.dfns.co/api-reference/idempotency)).
              required:
                - kind
                - txHash
                - signedTx
              additionalProperties: false
              description: Transaction speeding up a previously sent transaction.
              title: Transaction Speed Up
        status:
          type: string
          enum:
            - Pending
            - Executing
            - Broadcasted
            - Confirmed
            - Failed
            - Rejected
        reason:
          type: string
        txHash:
          type: string
        fee:
          type: string
        approvalId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^ap-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          example: ap-2a9in-tt2a1-983lho480p35ejd0
        dateRequested:
          type: string
          format: date-time
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). When the transaction was requested.
          example: '2023-04-14T20:41:28.715Z'
        datePolicyResolved:
          type: string
          format: date-time
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). When the transaction was approved by policy reviewers.
          example: '2023-04-14T20:41:28.715Z'
        dateBroadcasted:
          type: string
          format: date-time
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). When the transaction was broadcasted to the blockchain.
          example: '2023-04-14T20:41:28.715Z'
        dateConfirmed:
          type: string
          format: date-time
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). When the transaction was confirmed on chain.
          example: '2023-04-14T20:41:28.715Z'
        externalId:
          type: string
        replacementId:
          type: string
          description: >-
            The id of the replacement transaction (cancel or speed-up) issued
            for this transaction.
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