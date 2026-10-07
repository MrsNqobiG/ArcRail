> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Transactions

> DFNS offers three ways to create a transaction, each balancing convenience and control: transfers, sign-and-broadcast, and raw signing with custom broadcast.

export const Youtube = props => {
  return <iframe className="w-full aspect-video rounded-xl" src={`https://www.youtube.com/embed/${props.videoId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen>
      </iframe>;
};

<Youtube videoId="Z4YRciX0nxM" />

| API | Supported Transaction Types | When to Use It |
| :- | :- | :- |
| Transfer API | Native Coins, Fungible Tokens (ERC-20), NFTs (ERC-721). | For simple, standardized "send" operations where convenience is key. |
| Sign / Sign & Broadcast API | Any valid transaction, including all simple transfers plus complex smart contract calls, minting, staking, etc. | For interacting with DeFi, DAO, or any custom smart contract where you need full control over the transaction data. |
| Smart contract interaction | Read-only queries and state-mutating function calls on imported contracts. | For calling specific contract functions by name using an imported ABI, with governance and auditability. |

## Transfer API

This is the simplest, most all-in-one method. You simply specify the high-level details of your transfer, like the recipient, amount, and asset, and the API handles the rest. It automatically builds the blockchain-specific transaction, signs it securely, and broadcasts it to the network.

The Transfer API abstracts away the complexities of different blockchain protocols, making it easy to send assets without needing to understand the underlying mechanics. See the list of [supported assets here](/networks/supported-assets).

<Tip>
  **Use this when:** You want maximum convenience and don't need to customize low-level transaction parameters like gas or nonce. 🤝
</Tip>

**From the Dashboard:**
Checkout the [related guide](/guides/transfer-assets).

**API Reference:**
[Transfer API](/api-reference/wallets/transfer-asset)

## Sign & Broadcast API

This method offers a middle ground. You construct the raw, unsigned transaction yourself, giving you full control over all its parameters (e.g., gas limits, nonce, contract call data). You then submit this raw transaction to the API, which securely signs it and broadcasts it to the network for you.

<Tip>
  **Use this when:** You need to define specific transaction details but want to offload the responsibility of secure signing and broadcasting. ⚙️
</Tip>

**API Reference:**
[Sign & Broadcast API](/api-reference/wallets/sign-and-broadcast-transaction)

## Smart contract interaction

DFNS wallets can call smart contracts natively using the Bring Your Own ABI (BYOABI) feature. Import a contract's ABI and address, and DFNS automatically discovers the available functions. You can then execute contract calls, mint, burn, pause, update parameters, all governed by [policies](/core-concepts/policies) like any other transaction.

* **From the dashboard:** Import a contract ABI, browse its functions, and execute read or write calls directly. No code required.
* **From the API:** Use `FunctionCall` in the [Sign & Broadcast API](/api-reference/wallets/sign-and-broadcast-transaction) for state-mutating calls, or the [Call Function](/api-reference/networks/call-function) endpoint for read-only queries.

Currently supported on Ethereum and EVM-compatible networks.

<Card title="Guide: Interacting with smart contracts" icon="file-contract" href="/guides/smart-contracts">
  Import ABIs, read contract state, and execute contract functions
</Card>

## Sign API

This is the most advanced option, providing you with maximum control. You construct the raw, unsigned transaction and send it to the API. The API's only job is to sign it with the secure key and return the signed transaction payload to you. You are then responsible for broadcasting it to the blockchain network yourself.

<Tip>
  **Use this when:** You need complete control over the transaction's lifecycle, such as managing your own broadcast strategy, using a private mempool, or submitting it to multiple nodes. 📡
</Tip>

**API Reference:**
[Sign API](/api-reference/keys/generate-signature)

## Fee estimation

Before submitting a transaction, you can estimate network fees using the [Estimate Fees](/api-reference/networks/estimate-fees) endpoint. It returns real-time fee data for three priority levels:

| Priority | Description |
| - | - |
| `Slow` | Lower fees, longer confirmation time |
| `Standard` | Balanced fees and confirmation time |
| `Fast` | Higher fees, faster confirmation |

This is useful for displaying fee previews to users before they confirm a transaction.

<Note>
  The Transfer API uses `Standard` priority by default. You can override this with the `priority` field in your transfer request. For EVM transactions, if you omit gas parameters in the Broadcast API, DFNS estimates them automatically.
</Note>

To avoid paying fees from the sender's wallet entirely, see [Fee Sponsors](/features/fee-sponsors).


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.