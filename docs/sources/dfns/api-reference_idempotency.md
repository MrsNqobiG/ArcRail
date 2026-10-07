> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Idempotency

> Use the externalId field to prevent duplicate transactions, safely retry requests, and track DFNS API calls across signing and transfer endpoints.

## Transfer / Transaction / Signature Idempotency

When using either one of these Wallet endpoints:

* [Transfer Asset](/api-reference/wallets/transfer-asset)
* [Broadcast Transaction](/api-reference/wallets/sign-and-broadcast-transaction)

you can optionally specify an `externalId` in the request body. This can be helpful for you if you want to create an ID on your side before the request, and store it on the created entity (Transfer Request, Transaction Request, Signature Request), in the `externalId` field. It can also be helpful if you need to re-submit the same API call, in case a network error (or other) prevented you to get our server's response, even if your request has actually been processed by DFNS.

## How it works

* If you re-submit the same request (same url, same body, including same `externalId`), then we will respond with a `200` response containing the entity which was already created when you submitted it for the first time.
* Otherwise, if you re-use the same `externalId` to make a new request to the API (same `externalId`, but different body, or using a different wallet), the request will fail with a `409` ("Conflict") response, containing a body such as:

```json theme={null}
{
  "error": {
    "id": "...",
    "status": 409,
    "message": "Conflicting transfer with same externalId",
    "details": {
      "duplicate": { "id": "...", "externalId": "..." }
  }
}
```

## Terminal states and externalId

Once a transfer or transaction reaches a terminal status (`Confirmed`, `Failed`, or `Rejected`), the `externalId` is permanently bound to that entity. This applies even if the transaction failed on-chain.

If you resubmit a request with the same `externalId` after the original request has reached a terminal state, DFNS returns the existing entity with a `200` response—it does not create a new transaction or retry the failed one.

<Note>
  A `Failed` status does not always mean the transaction reached the blockchain. A transfer can fail **on-chain** (signed, broadcast, and included in a block, then reverted, for example on insufficient balance or a contract revert) or **off-chain**, before broadcast (for example when you [abort](/api-reference/wallets/abort-transfer) it, or if construction or signing fails). The `txHash` tells the two apart: present means it was broadcast on-chain, absent means it failed off-chain.

  In both cases the transfer did not move your assets, so you can safely retry with a new `externalId`. DFNS automatically frees any nonce it reserved for the failed transfer, so your next transfer reuses it and retries are never held up.
</Note>

## Retrying failed transfers

If a transfer fails and you need to retry, you must use a new `externalId`. The original `externalId` cannot be reused to create a new transfer.

**Recommended pattern:** Append a retry suffix to your base ID to maintain traceability:

```
// Original attempt
externalId: "payout-2024-001"

// Retry attempts
externalId: "payout-2024-001-retry-1"
externalId: "payout-2024-001-retry-2"
```

This allows you to:

* Track all attempts related to the same logical operation
* Correlate webhook events across retries
* Maintain audit trails in your system


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.