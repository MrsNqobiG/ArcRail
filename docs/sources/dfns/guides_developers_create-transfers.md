> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create transfers via API

> Execute native asset, ERC-20, and NFT transfers programmatically using the DFNS transfer endpoint, with idempotency and policy support.

This guide covers how to create transfers, handle different asset types, and monitor transfer status using the DFNS API and SDK.

## Prerequisites

* Service account or authenticated user with `Wallets:Transfers:Create` permission
* DFNS SDK installed and configured
* Wallet with sufficient balance for the transfer and gas fees

## Creating a native token transfer

Send native tokens (ETH, MATIC, SOL, etc.):

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { DfnsApiClient } from '@dfns/sdk'

  const dfns = new DfnsApiClient({
    baseUrl: 'https://api.dfns.io',
    // Your signer configuration
  })

  const transfer = await dfns.wallets.createTransfer({
    walletId: 'wa-xxx-xxx',
    body: {
      kind: 'Native',
      to: '0x1234...recipient',
      amount: '1000000000000000000' // 1 ETH in wei
    }
  })

  console.log('Transfer ID:', transfer.id)
  console.log('Status:', transfer.status)
  ```

  ```go Go theme={null}
  import (
      dfns "github.com/dfns/dfns-sdk-go/v2"
  )

  // client, _ := dfns.NewClient(dfns.Options{...})

  transfer, err := client.Wallets.TransferAsset(ctx, "wa-xxx-xxx", map[string]any{
      "kind":   "Native",
      "to":     "0x1234...recipient",
      "amount": "1000000000000000000", // 1 ETH in wei
  })

  fmt.Printf("Transfer ID: %s\n", transfer.ID)
  fmt.Printf("Status: %s\n", transfer.Status)
  ```

  ```python Python theme={null}
  from dfns_sdk import DfnsClient, DfnsClientConfig

  # config = DfnsClientConfig(auth_token="...", signer=signer)

  with DfnsClient(config) as client:
      transfer = client.wallets.transfer_asset(
          "wa-xxx-xxx",
          body={
              "kind": "Native",
              "to": "0x1234...recipient",
              "amount": "1000000000000000000"  # 1 ETH in wei
          }
      )

      print(f"Transfer ID: {transfer['id']}")
      print(f"Status: {transfer['status']}")
  ```

  ```java Java theme={null}
  import co.dfns.sdk.*;

  // DfnsClient client = new DfnsClient(config);

  var transfer = client.wallets.transferAsset("wa-xxx-xxx", java.util.Map.of(
      "kind", "Native",
      "to", "0x1234...recipient",
      "amount", "1000000000000000000" // 1 ETH in wei
  ));

  System.out.printf("Transfer ID: %s%n", transfer.id());
  System.out.printf("Status: %s%n", transfer.status());
  ```
</CodeGroup>

### Request parameters

| Parameter | Required | Description |
| - | - | - |
| `kind` | Yes | Transfer type: `Native`, `Erc20`, `Erc721`, etc. |
| `to` | Yes | Recipient address |
| `amount` | Yes | Amount in base units (wei for ETH) |
| `externalId` | No | Your reference ID for tracking |

There is no `network` parameter — the network is inherited from the wallet (`walletId`) the transfer is created on.

## Creating an ERC-20 token transfer

Send ERC-20 tokens:

```typescript theme={null}
const transfer = await dfns.wallets.createTransfer({
  walletId: 'wa-xxx-xxx',
  body: {
    kind: 'Erc20',
    contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    to: '0x1234...recipient',
    amount: '1000000' // 1 USDC (6 decimals)
  }
})
```

<Note>
  Token amounts are in base units. USDC has 6 decimals, so 1 USDC = 1000000. ETH has 18 decimals, so 1 ETH = 1000000000000000000.
</Note>

## Creating an NFT transfer

Transfer ERC-721 NFTs:

```typescript theme={null}
const transfer = await dfns.wallets.createTransfer({
  walletId: 'wa-xxx-xxx',
  body: {
    kind: 'Erc721',
    contract: '0x...nft-contract',
    to: '0x1234...recipient',
    tokenId: '123'
  }
})
```

## Transfer with external ID

Use external IDs for your own tracking:

```typescript theme={null}
const transfer = await dfns.wallets.createTransfer({
  walletId: 'wa-xxx-xxx',
  body: {
    kind: 'Native',
    to: '0x1234...recipient',
    amount: '1000000000000000000',
    externalId: 'payout-2024-001' // Your reference
  }
})
```

## Checking transfer status

Get the status of a transfer:

```typescript theme={null}
const transfer = await dfns.wallets.getTransfer({
  walletId: 'wa-xxx-xxx',
  transferId: 'tr-xxx-xxx'
})

console.log('Status:', transfer.status)
// 'Pending', 'Executing', 'Broadcasted', 'Confirmed', 'Failed', 'Rejected'
```

### Transfer statuses

| Status | Description |
| - | - |
| `Pending` | Transfer created, awaiting policy approval |
| `Executing` | Approved; being signed and constructed for broadcast |
| `Broadcasted` | Transaction sent to the network |
| `Confirmed` | Transaction confirmed on the blockchain |
| `Failed` | Signing/broadcast failed, or execution reverted on-chain |
| `Rejected` | Blocked by policy or approval rejected |

For what to do when a transfer is stuck in a given status, see [Troubleshooting stuck transfers](/guides/developers/transaction-monitoring#troubleshooting-stuck-transfers).

## Controlling fees and retrying a gas-failed transfer

The transfer endpoint estimates gas for you. The only fee control it exposes is the optional `priority` field, which accepts `Slow`, `Standard` (default), or `Fast` — under the hood this drives [Estimate Fees](/api-reference/networks/estimate-fees) to pick the fee level. Explicit gas overrides such as `gasLimit` or `maxFeePerGas` are **not** accepted on a transfer request; those exist only on the [Sign & Broadcast Transaction](/api-reference/wallets/sign-and-broadcast-transaction) endpoint (transaction `kind: 'Eip1559'`), where you assemble the raw transaction yourself.

You set `priority` when you create a transfer:

```typescript theme={null}
const transfer = await dfns.wallets.createTransfer({
  walletId: 'wa-xxx-xxx',
  body: {
    kind: 'Native',
    to: '0x1234...recipient',
    amount: '1000000000000000000',
    priority: 'Fast', // raise the fee level
  },
})
```

### Unsticking a transfer that is already in flight

<Warning>
  Never submit a second Transfer Asset request to "retry" a transfer that has not reached a terminal status. If the original later gets mined, you will have sent the funds twice. Only create a new transfer once the previous one is `Confirmed`, `Failed`, or `Rejected`.
</Warning>

To change the fee of — or get rid of — a transfer that is already in progress, act on **that** transfer instead of creating a new one. On EVM networks:

* **[Speed Up Transfer](/api-reference/wallets/speed-up-transfer)** — for a transfer stuck in `Broadcasted` (in the mempool but not yet mined). Rebroadcasts the same transfer at a higher fee (the greater of a 10% bump or the Fast level) to get it mined. Use this when you still want the transfer to go through.
* **[Cancel Transfer](/api-reference/wallets/cancel-transfer)** — for a transfer stuck in `Broadcasted` that you want to void. Submits a replacement 0-value transaction to your own wallet at the same nonce, nullifying the original. Use this when you no longer want the transfer to land.
* **[Abort Transfer](/api-reference/wallets/abort-transfer)** — for a transfer stuck in `Executing` (approved but not yet broadcast). Marks it `Failed` without any on-chain action, freeing reserved inputs such as Bitcoin UTXOs.

The safe recovery sequence for a stalled transfer is: **cancel or abort it first** so it settles to a terminal status, **then** submit a fresh transfer if you still need to move the funds. Speeding up keeps the original transfer — it does not create a duplicate. See [Troubleshooting stuck transfers](/guides/developers/transaction-monitoring#troubleshooting-stuck-transfers) for the recommended action per status. The raw-transaction flow has the equivalent [Speed Up Transaction](/api-reference/wallets/speed-up-transaction), [Cancel Transaction](/api-reference/wallets/cancel-transaction), and [Abort Transaction](/api-reference/wallets/abort-transaction) endpoints.

<Note>
  If you need full control over gas (custom `gasLimit`, `maxFeePerGas`, `maxPriorityFeePerGas`, or replace-by-fee), build the transaction yourself and use [Sign & Broadcast Transaction](/api-reference/wallets/sign-and-broadcast-transaction) with `kind: 'Eip1559'` instead of the transfer endpoint.
</Note>

## Listing transfers

List transfers for a wallet:

```typescript theme={null}
const transfers = await dfns.wallets.listTransfers({
  walletId: 'wa-xxx-xxx'
})

for (const transfer of transfers.items) {
  console.log(`${transfer.id}: ${transfer.status}`)
}
```

## Handling policy approvals

If a transfer triggers a policy that requires approval, the transfer enters a `Pending` state:

```typescript theme={null}
const transfer = await dfns.wallets.createTransfer({
  walletId: 'wa-xxx-xxx',
  body: {
    kind: 'Native',
    to: '0x1234...recipient',
    amount: '100000000000000000000' // Large amount
  }
})

if (transfer.status === 'Pending') {
  console.log('Transfer requires approval')
  // The transfer will execute automatically once approved
}
```

See [managing policies](/guides/developers/manage-policies) for working with approvals programmatically.

## Monitoring with webhooks

Subscribe to transfer events for real-time updates:

```typescript theme={null}
// Subscribe to events
await dfns.webhooks.createWebhook({
  body: {
    url: 'https://your-app.com/webhooks/dfns',
    events: [
      'wallet.transfer.broadcasted',
      'wallet.transfer.confirmed',
      'wallet.transfer.failed'
    ],
    status: 'Enabled'
  }
})
```

Handle webhook events:

```typescript theme={null}
app.post('/webhooks/dfns', async (req, res) => {
  const event = req.body

  switch (event.kind) {
    case 'wallet.transfer.confirmed':
      await handleTransferConfirmed(event.data)
      break
    case 'wallet.transfer.failed':
      await handleTransferFailed(event.data)
      break
  }

  res.status(200).send('OK')
})
```

See [webhooks guide](/guides/developers/webhooks) for complete webhook setup.

## Polling for status

Alternative to webhooks - poll for transfer status:

```typescript theme={null}
async function waitForConfirmation(walletId: string, transferId: string) {
  while (true) {
    const transfer = await dfns.wallets.getTransfer({
      walletId,
      transferId
    })

    if (transfer.status === 'Confirmed') {
      return transfer
    }

    if (transfer.status === 'Failed') {
      throw new Error(`Transfer failed: ${transfer.error}`)
    }

    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}
```

See [transaction monitoring](/guides/developers/transaction-monitoring) for polling best practices.

## Error handling

Handle common errors:

```typescript theme={null}
try {
  const transfer = await dfns.wallets.createTransfer({
    walletId: 'wa-xxx-xxx',
    body: {
      kind: 'Native',
      to: '0x1234...recipient',
      amount: '1000000000000000000'
    }
  })
} catch (error) {
  if (error.status === 403) {
    console.error('Permission denied')
  } else if (error.status === 400) {
    console.error('Invalid request:', error.message)
  } else if (error.message.includes('insufficient balance')) {
    console.error('Insufficient balance for transfer')
  } else {
    console.error('Error creating transfer:', error)
  }
}
```

## Related documentation

<CardGroup cols={2}>
  <Card title="Transfer API" icon="book" href="/api-reference/transfer">
    Complete API reference
  </Card>

  <Card title="Monitor transactions" icon="chart-line" href="/guides/developers/transaction-monitoring">
    Polling patterns
  </Card>

  <Card title="Set up webhooks" icon="webhook" href="/guides/developers/webhooks">
    Real-time notifications
  </Card>

  <Card title="Manage policies via API" icon="shield" href="/guides/developers/manage-policies">
    Handle policy approvals
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.