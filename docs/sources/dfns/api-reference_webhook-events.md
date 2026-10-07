> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Webhook Events

> Reference for every webhook event emitted by DFNS, including wallet, transfer, signature, policy, and authentication events with example payloads.

When an event occurs in the system which a Webhook is subscribed to, we create a Webhook Event object containing data around the event that happened. We then:

1. Send the event to your Webhook endpoint
2. Capture a trace of the event so you can later check all Webhook Events sent to your webhooks (through [List Webhook Events](/api-reference/webhooks/list-webhook-events) or [Get Webhook Event](/api-reference/webhooks/get-webhook-event) endpoints)

<Warning>
  We only keep a trace of Webhook Events in our system for a **retention period of 31 days**. Past that, they are discarded, so you cannot see them using [List Webhook Events](/api-reference/webhooks/list-webhook-events) or [Get Webhook Event](/api-reference/webhooks/get-webhook-event) endpoints.
</Warning>

Here's an example of a Webhook Event of kind "`wallet.transfer.requested`" delivered to your webhook:

```json theme={null}
{
  "id": "wh-xxx-xxxxxxx",
  "kind": "wallet.transfer.requested",
  "date": "2023-12-04T10:02:22.280Z",
  "data": {
    "transferRequest": {
      "id": "xfr-1vs8g-c1ub1-xxxxxxxxxxxxxxxx",
      "walletId": "wa-39abb-e9kpk-xxxxxxxxxxxxxxxx",
      "network": "EthereumSepolia",
      "requester": {
        "userId": "us-3v1ag-v6b36-xxxxxxxxxxxxxxxx",
        "tokenId": "to-7mkkj-c831n-xxxxxxxxxxxxxxxx",
       },
      "requestBody": {
        "kind": "Native",
        "to": "0xb282dc7cde21717f18337a596e91ded00b79b25f",
        "amount": "1000000000"
      },
      "dateRequested": "2023-05-08T19:14:25.568Z",
      "status": "Pending"
    }
  },
  "status": "200",
  "timestampSent": 1701684144,
}
```

## Supported Webhook Events

The list below shows which event kinds webhooks can subscribe to ⬇️ (see [Webhook Event Data](#webhook-event-data) section for details on each event kind)

| Event Enum | Description |
| - | - |
| `wallet.blockchainevent.detected` | A wallet event has been detected on chain (eg. a deposit). Note: This is only available for [Tier-1 chains](/networks#support-tiers). |
| `wallet.blockchain_event.transfer.included` | An incoming transfer has been detected in a block that is **not yet finalized** (pre-confirmation), before the network [confirmation delay](/networks/index) elapses. `wallet.blockchainevent.detected` follows once the transfer is confirmed. Available on networks that support early detection (see the [supported networks](/networks) table). |
| `wallet.created` | A wallet has been [created](/api-reference/wallets/create-wallet). |
| `wallet.exported` | A wallet has been exported (deprecated). |
| `wallet.delegated` | A wallet has been [delegated](/api-reference/keys/delegate-key). |
| `wallet.activated` | A wallet has been [activated](/api-reference/wallets/activate-wallet) (for example, a Canton wallet). |
| `wallet.signature.requested` | A [generate signature](/api-reference/keys/generate-signature) request has been created. |
| `wallet.signature.failed` | A [generate signature](/api-reference/keys/generate-signature) request has failed to process. |
| `wallet.signature.rejected` | A [generate signature](/api-reference/keys/generate-signature) request with a policy approval has been rejected. |
| `wallet.signature.signed` | A [generate signature](/api-reference/keys/generate-signature) request has completed. |
| `wallet.transaction.requested` | A [broadcast transaction](/api-reference/wallets/sign-and-broadcast-transaction) request has been created. |
| `wallet.transaction.failed` | A [broadcast transaction](/api-reference/wallets/sign-and-broadcast-transaction) request has failed to process. |
| `wallet.transaction.rejected` | A [broadcast transaction](/api-reference/wallets/sign-and-broadcast-transaction) request with a policy approval has been rejected. |
| `wallet.transaction.broadcasted` | A [broadcast transaction](/api-reference/wallets/sign-and-broadcast-transaction) request has been submitted to the mempool. |
| `wallet.transaction.confirmed` | A [broadcast transaction](/api-reference/wallets/sign-and-broadcast-transaction) request has been confirmed on chain. Note: This is only available for [Tier-1 chains](/networks#support-tiers). |
| `wallet.transfer.requested` | A [wallet transfer](/api-reference/wallets/transfer-asset) request has been created. |
| `wallet.transfer.failed` | A [wallet transfer](/api-reference/wallets/transfer-asset) request has failed to process. |
| `wallet.transfer.rejected` | A [wallet transfer](/api-reference/wallets/transfer-asset) request with a policy approval has been rejected. |
| `wallet.transfer.broadcasted` | A [wallet transfer](/api-reference/wallets/transfer-asset) request has been submitted to the mempool. |
| `wallet.transfer.confirmed` | A [wallet transfer](/api-reference/wallets/transfer-asset) request has been confirmed on chain. Note: This is only available for [Tier-1 chains](/networks#support-tiers). |
| `wallet.offer.received` | A new transfer [offer](/api-reference/wallets/list-offers) has been made to a wallet. |
| `wallet.offer.accepted` | A transfer [offer](/api-reference/wallets/accept-offer) has been accepted and settlement confirmed on chain. |
| `wallet.offer.rejected` | A transfer [offer](/api-reference/wallets/reject-offer) has been rejected and settlement confirmed on chain. |
| `wallet.offer.withdrawn` | A transfer offer has been withdrawn by the sender. |
| `wallet.tags.modified` | A wallet's tags have been modified. |
| `key.created` | A key has been [created](/api-reference/keys/create-key). |
| `key.delegated` | A key has been [delegated](/api-reference/keys/delegate-key). |
| `key.exported` | A key has been [exported](/api-reference/keys/export-key). |
| `key.deleted` | A key has been [deleted](/api-reference/keys/delete-key). |
| `policy.triggered` | A policy got triggered upon some activity (the policy rule got evaluated, and it triggered) |
| `policy.activity.resolved` | An activity governed by a policy has reached a final state. Fires once per activity; the payload `status` is `Cleared` or `Blocked`. |
| `policy.approval.pending` | A new [Approval](/core-concepts/policies#approval-process) process has been created and is pending. |
| `policy.approval.resolved` | A new [Approval](/core-concepts/policies#approval-process) process is finalized: its `status` resolves to `Approved` or `Denied` (the full [`ApprovalStatus`](/api-reference/policies/get-approval) enum is `Pending`, `Approved`, `Denied`, `Expired`). |
| `payout.action.required` | A [payout](/features/fiat-on-off-ramps) requires an action (for example, an approval) before it can proceed. |
| `swap.completed` | A swap has completed successfully. |
| `swap.failed` | A swap request has failed to process. |
| `vault.created` | A vault has been created. |
| `vault.updated` | A vault has been updated. |
| `vault.tags.modified` | Tags have been added to or removed from a vault. |
| `vault.event.created` | An entry has been appended to a vault's balance ledger: an incoming transfer was detected, quarantined funds were released, or an outgoing transfer was initiated, confirmed, aborted, rejected, or failed. |
| `webhook.event.retry.triggered` | An event kind DFNS emits when it automatically retries a webhook delivery that previously failed (see [Webhook Event Deliveries & Retries](#webhook-event-deliveries--retries)). This is a webhook event you receive, not an API method: there is no endpoint to manually trigger a webhook retry. |
| `address_watch.blockchain_event.transfer.confirmed` | A transfer touching one of your [watched addresses](/api-reference/address-watches/create-address-watch) has been confirmed on chain (eg. a deposit). |

## Webhook Event Data

Each webhook event has a "`data`" property, which shape depends on its kind. Here's an overview of the shape of the data for each kind:

* For `wallet.created`, `wallet.exported`, `wallet.delegated` see the [Get Wallet response](/api-reference/wallets/get-wallet):

```json data theme={null}
{ // Wallet object, as in "Create Wallet" endpoint response
  "wallet": {
    "id": "wa-xxx-xxxxxxxxx",
    ...
  }
}
```

* For `wallet.transfer.requested`, `wallet.transfer.failed`, `wallet.transfer.rejected`, `wallet.transfer.broadcasted`, `wallet.transfer.confirmed` see the [Get Transfer response](/api-reference/wallets/get-transfer):

```json data theme={null}
{ // Wallet Transfer Request object as in "Wallet Send Transfer" endpoint
  "transferRequest": {
    "id": "xfr-xxx-xxxxxxxxx",
    "walletId": "wa-xxx-xxxxxxxx",
    ...
  }
}
```

* For `wallet.transaction.requested`, `wallet.transaction.failed`, `wallet.transaction.rejected`, `wallet.transaction.broadcasted`, `wallet.transaction.confirmed` see the [Get Transaction response](/api-reference/wallets/get-transaction) :

```json data theme={null}
{ // Wallet Transaction Request as in "Wallet Broadcast Transaction" endpoint
  "transactionRequest": {
    "id": "tx-xxx-xxxxxxxxx",
    "walletId": "wa-xxx-xxxxxxxx",
    ...
  }
}
```

* For `wallet.signature.requested`, `wallet.signature.failed`, `wallet.signature.rejected`, `wallet.signature.signed` see the [Get Signature response](/api-reference/keys/generate-signature):

```json data theme={null}
{ // Wallet Signature Request object as in "Wallet Generate Signature" endpoint
  "signatureRequest": {
    "id": "sig-xxx-xxxxxxxxx",
    "walletId": "wa-xxx-xxxxxxxx",
    ...
  }
}
```

* For `wallet.offer.received`, `wallet.offer.accepted`, `wallet.offer.rejected`, `wallet.offer.withdrawn`, see the [Get Offer response](/api-reference/wallets/get-offer):

```json data theme={null}
{ // Offer object as in "Get Offer" endpoint
  "offer": {
    "id": "ofr-xxx-xxxxxxxxx",
    "walletId": "wa-xxx-xxxxxxxx",
    ...
  }
}
```

* For `wallet.tags.modified`:

```json data theme={null}
{
  "wallet": {
    "id": "wa-xxx-xxxxxxxxx",
    ...
  },
  "tagsAdded": ["tag1"],
  "tagsRemoved": ["tag2"]
}
```

* For `wallet.blockchainevent.detected` and `wallet.blockchain_event.transfer.included`, the data holds a blockchain event whose `status` is `"Confirmed"` (final) or `"Included"` (seen in a block that is not yet finalized, i.e. pre-confirmation). Various event kinds are available depending on the indexed chain:\\

| Kind | Chains |
| - | - |
| NativeTransfer | All |
| Aip21Transfer | Aptos |
| AsaTransfer | Algorand |
| CoinTransfer, LockedCoinTransfer | Iota |
| Erc20Transfer, Erc721Transfer | Evm |
| Tep74Transfer | Ton |
| Trc10Transfer, Trc20Transfer, Trc721Transfer | Tron |
| Sep41Transfer | Stellar |
| SplTransfer, Spl2022Transfer | Solana |
| UtxoTransfer | Bitcoin, Litecoin, Dogecoin, Kaspa |

<Note>
  These are **read-back event kinds** returned in wallet history and webhook payloads — not transfer request kinds. To *initiate* a transfer, use the request kind on [Transfer Asset](/api-reference/wallets/transfer-asset): for example, send an ERC-20 or BEP-20 token with `kind: "Erc20"` (the event you later read back is `Erc20Transfer`).
</Note>

for example, see the [Get History response](/api-reference/wallets/get-wallet-history):

```json data theme={null}
{ // Blockchain Event object as in "Wallet Get Wallet History" endpoint
  "blockchainEvent": {
    "kind": "Erc20Transfer",
    "status": "Confirmed", // "Included" for pre-confirmation events
    "contract": "0x......",
    "from": "0x......",
    "to": "0x......",
    "direction": "In",
    ...
  }
}
```

* For `policy.triggered`

```json data theme={null}
{
  "policyEvaluation": {
    "id": "plce-xxxxxxx",
    "triggered": true,
    "reason": "Transfer amount (USD 10000) is above limit (USD 5000). ",
    "date": "2024-06-28T09:09:54.437Z",

    "policy": { // policy object as in "Get Policy" endpoint
      "id": "plc-xxxxxxx",
      "name": "Accounting wallet transfer limit",
      ...,
    },

    "activity": {
      "kind": "Wallets:Sign"
      "transferRequest": { // transfer request object as in "Get Transfer" endpoint
        "id": "xfr-xxxxxxx",
        ...
      }
    },

    "context": { // its content depends on the kind of the policy rule
      "transactionAmount": {
        "value": "10000,
        "currency": "USD",
      },
    },
  }
}
```

<Note>
  The [Get Transaction](/api-reference/wallets/get-transaction) response does not contain a `policyId` field; it exposes `approvalId` and `datePolicyResolved` instead. To inspect the policy that acted on a transaction, use the `policy.triggered` webhook event above (its `data` holds the full policy object), or resolve the policy through the approval referenced by `approvalId`.
</Note>

* For `policy.approval.pending` and `policy.approval.resolved`, see the [List Approvals response](/api-reference/policies/get-approval):

```json data theme={null}
{ // Approval object
  "approval": {
    "activityId": "cr-2100g-xxxxxxxxx",
    ...
  }
}
```

* For `vault.event.created`, the data holds a single entry appended to the vault's balance ledger. There is **no** `txHash` on this payload; use `transferId` to correlate the entry with the related [transfer](/api-reference/wallets/get-transfer):

```json data theme={null}
{
  "vaultEvent": {
    "id": "vlt-evt-xxx-xxxxxxxxx",
    "vaultId": "vlt-xxx-xxxxxxxxx",
    "walletId": "wa-xxx-xxxxxxxx",
    // one of: IncomingTransfer, Unquarantine, OutgoingTransferInitiated,
    // OutgoingTransferConfirmed, OutgoingTransferAborted, OutgoingTransferRejected,
    // OutgoingTransferFailed, LockCreated, LockDeleted
    "kind": "IncomingTransfer",
    "timestamp": "2024-06-28T09:09:54.437Z",
    "transferId": "xfr-xxx-xxxxxxxxx", // present for transfer-related kinds
    "quarantineId": "vlt-qua-xxx-xxxxxxxxx", // present for quarantine-related kinds
    "lockId": "vlt-lck-xxx-xxxxxxxxx" // present for lock-related kinds
  }
}
```

## Webhook Event Ordering <a id="best-practices" />

DFNS doesn’t guarantee delivery of events in the order in which they’re generated. For example, when a wallet [Transfer](/api-reference/wallets/transfer-asset) is picked up on-chain by our blockchain indexers, we might generate the following events:

* `wallet.transfer.confirmed` - this event notifies you that the [Transfer Request](/api-reference/wallets/transfer-asset) that you made has been confirmed on chain
* `wallet.blockchainevent.detected`- this event notifies you of the new Blockchain Event detected and added to your [Wallet History](/api-reference/wallets/get-wallet-history) blockchain events

Your endpoint shouldn’t expect delivery of these events in this order, and needs to handle delivery accordingly.

## Webhook Event Deliveries & Retries

During an webhook event delivery attempt, if we cannot reach your webhook endpoint, or if your endpoint **returns anything else than a 200** status code in the response, we consider the delivery of this event has failed.

In such a case, DFNS is going to retry delivering it to your webhook, up to 5 total attempts over 24 hours, with an exponential backoff (delays from first attempt: 1m, 12min, 2h, 1d).

Every event delivery attempt will create a new Webhook Event, with its own unique ID, containing the same `data` than the previous event which failed delivering. So in the [List Webhook Events](/api-reference/webhooks/list-webhook-events) endpoint, every Webhook Event you will see is a unique delivery attempt (potentially of the same original event).

The event that your webhook handler will receive (in your server), will include the attempt number in the payload (`deliveryAttempt: 1` for the first attempt). Also, if it includes the field `retryOf: "whe-xxxxxxx"`, it indicates that this event you are receiving, is a "retry of" a previous Webhook Event which failed delivering.

Additionally, if you fetch Webhook Events we tried delivering, using the [List Webhook Events](/api-reference/webhooks/list-webhook-events) or [Get Webhook ](/api-reference/webhooks/get-webhook-event), you will be able to see the `deliveryFailed` boolean field indicating if delivery succeeded or not, as well as the `nextAttemptDate: "2024-01-24-xxxxxx"` date showing you around which time the next delivery attempt to your webhook will occur (if delivery failed).

If you want to fetch all Webhook Events which failed delivering to your webhook, you can use the [List Webhook Events](/api-reference/webhooks/list-webhook-events) with the query parameter `deliveryFailed=true`. And amongst all those returned, you can see those which failed delivering, and will not retry in future (because reached maximum retry attempt), by filtering those which have no `nextAttemptDate`.

If your webhook has been disabled or deleted when DFNS attempts a retry, future retries of that event are prevented. However, if you disable and then re-enable a webhook endpoint before DFNS can retry, you can still expect to see future retry attempts.

## Webhook Event object


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.