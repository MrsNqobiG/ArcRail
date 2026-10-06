> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# EVM networks

> Network-specific features for Ethereum and EVM-compatible chains on DFNS, including EIP-1559, EIP-712 signing, smart contract reads, and tokens.

DFNS supports Ethereum and many EVM-compatible networks. This guide covers features common to all EVM chains.

## Supported EVM networks

DFNS supports numerous EVM-compatible networks including:

| Network | Type |
| - | - |
| Ethereum | Mainnet |
| Polygon | Layer 2 |
| Arbitrum One | Layer 2 |
| Base | Layer 2 |
| Optimism | Layer 2 |
| Avalanche C-Chain | Layer 1 |
| BNB Smart Chain | Layer 1 |
| Fantom Opera | Layer 1 |
| Celo | Layer 1 |

See the [complete list of supported networks](/networks).

## Gas and fees

All EVM transactions require **gas**, paid in the network's native token (ETH, MATIC, etc.).

<Warning>
  Gas must always be paid in the native token, even when transferring other tokens. Ensure your wallet has sufficient native token balance before initiating any transaction.
</Warning>

### Fee priority

Use the `priority` field in the [Transfer Asset](/api-reference/wallets/transfer-asset) endpoint to control gas prices:

| Priority | Description |
| - | - |
| `Slow` | Lower gas price, may take longer to confirm |
| `Standard` | Current market gas price |
| `Fast` | Higher gas price for faster confirmation |

## Transfers

Use the [Transfer Asset](/api-reference/wallets/transfer-asset) endpoint for all EVM transfers:

* **Native tokens**: Use `kind: Native` with amount in wei (1 ETH = 10^18 wei)
* **ERC-20 tokens**: Use `kind: Erc20` with the token's `contract` address
* **ERC-721 NFTs**: Use `kind: Erc721` with the NFT's `contract` address and `tokenId`
* **ERC-7984 confidential tokens**: Use `kind: Erc7984` with the token's `contract` address (see [below](#confidential-tokens-erc-7984))

<Note>
  The transfer request body has **no `network` field**. The network is determined by the wallet you submit the transfer to — each wallet (`wa-...`) is created on one network. To send BNB, for example, submit `kind: Native` to a wallet on BNB Smart Chain. The network identifiers are `Bsc` (mainnet) and `BscTestnet` (testnet); there is no `BscMainnet`.
</Note>

## Smart contract interactions

For complex smart contract interactions beyond simple transfers, use the [Broadcast Transaction](/api-reference/wallets/sign-and-broadcast-transaction) endpoint with `kind: Transaction`. For fee-sponsored smart contract calls, use `kind: UserOperations` with a fee sponsor.

## Nonce management

On EVM networks, every transaction from an account must include a sequential **nonce**. Transactions execute in strict nonce order — if nonce `5` is pending, nonce `6` cannot confirm until `5` does. This makes the nonce a scarce, ordered resource that must be managed carefully under concurrency.

### Deterministic nonce allocation

DFNS manages nonces through a dedicated orchestration layer instead of relying on RPC queries. Nonces are reserved and allocated atomically across concurrent requests in an internal database. Once a nonce is assigned to a transaction, it cannot be reused.

This guarantees that every transaction is constructed and serialized in the correct order, even under high volume. If a transaction fails or is replaced, the system handles the state update automatically.

### Transaction resource reservation

Every EVM transaction in DFNS explicitly reserves the resources it needs before broadcast:

* **Standard transactions** reserve a specific nonce to ensure strict sequencing.
* **Fee-sponsored transactions** (`UserOperations`) reserve multiple nonces to coordinate between fee sponsors and smart accounts.

Resources are locked before broadcast and released only once the transaction is confirmed, cancelled, or identified as failed. Transactions that cannot succeed are stopped early, before entering the execution pipeline.

## Speed up and cancel

EVM transactions can be sped up or cancelled while they are pending in the mempool (status `Broadcasted`). Cancellation also works on aborted transactions (status `Aborted`) to burn the reserved nonce and unblock subsequent transactions.

Both operations use Ethereum's nonce-based transaction replacement:

* **Speed up**: Creates a new transaction with the same parameters but higher gas fees (10% bump or current Fast fees, whichever is higher). The higher-fee transaction replaces the original in the mempool.
* **Cancel**: Creates a zero-value self-transfer with the same nonce and higher gas. When mined, it consumes the nonce and invalidates the original transaction.

<Warning>
  Success is not guaranteed. If the original transaction confirms before the replacement is mined, the operation will fail. Network congestion and timing affect the outcome.
</Warning>

These features are available via the API:

| Operation | [Transfer](/api-reference/transfer) | [Raw transactions](/api-reference/broadcast) |
| - | - | - |
| Speed up | [Speed Up Transfer](/api-reference/wallets/speed-up-transfer) | [Speed Up Transaction](/api-reference/wallets/speed-up-transaction) |
| Cancel | [Cancel Transfer](/api-reference/wallets/cancel-transfer) | [Cancel Transaction](/api-reference/wallets/cancel-transaction) |

## Confidential tokens (ERC-7984)

DFNS supports [ERC-7984](https://eips.ethereum.org/EIPS/eip-7984) confidential tokens powered by [Zama's FHE](https://docs.zama.ai/fhevm). These tokens encrypt balances and transfer amounts on-chain using Fully
Homomorphic Encryption — no one can see your holdings by inspecting the blockchain.

### Delegate decrypt rights to DFNS

Because balances are encrypted, DFNS needs explicit permission from each wallet to decrypt and display them. Without delegation, balances appear as encrypted handles (eg. `0xe9d6af...`) instead of plaintext
amounts.

To enable decryption, call `delegateForUserDecryption` on the [Zama ACL contract](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl) from your DFNS wallet. This is a **one-time transaction per wallet per token
contract**.

| Parameter | Value |
| - | - |
| `delegate` | The DFNS delegatee address (see below) |
| `contractAddress` | The ERC-7984 token contract you want DFNS to read |
| `expirationDate` | Unix timestamp for when the delegation expires |

The ACL contract address is `0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D` on both Sepolia and Mainnet.

See the full working example in the DFNS TypeScript SDK: [delegate-fhe-decrypt](https://github.com/dfns/dfns-sdk-ts/tree/m/examples/libs/ethersjs/v6/delegate-fhe-decrypt)

Once the delegation transaction is confirmed, DFNS automatically decrypts balances and transfer amounts for that wallet and token.

#### DFNS delegatee addresses

| Environment | Delegatee Address |
| - | - |
| Sepolia | `0x1f4252accc541a7a37868e02031b85ea00245d73` |
| Mainnet | `0x1f4252accc541a7a37868e02031b85ea00245d73` |

## SDK integration

For full transaction control, use the DFNS SDK with [viem](https://viem.sh/) or [ethers.js](https://docs.ethers.org/). See complete examples:

* [viem examples](https://github.com/dfns/dfns-sdk-ts/tree/m/examples/libs/viem)
* [ethers.js examples](https://github.com/dfns/dfns-sdk-ts/tree/m/examples/libs/ethersjs)

## Related resources

* [EVM broadcast examples](/api-reference/broadcast/evm)
* [EVM signing examples](/api-reference/sign/evm)
* [Viem integration](/guides/developers/viem-integration)
* [Account abstraction](/advanced/account-abstraction-on-evms)
* [Supported networks](/networks)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.