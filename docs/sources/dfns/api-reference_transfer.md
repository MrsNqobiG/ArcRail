> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Transfer

> Reference for the TransferRequest object used by the DFNS transfer endpoint to send native assets, tokens, and NFTs across supported networks.

A transfer is a Wallet Transfer Request to move an asset from a wallet to a destination address.

A transfer request creates an action that moves native tokens or on-chain assets (ERC-20, ERC-721, SPL, etc.) from a specified wallet to a recipient. It requires the transfer payload (kind, destination, amount, and any asset-specific fields), appropriate permissions, and may trigger policies (approvals, screening, fee sponsorship). The API returns a transfer object with status, txHash, fees, and timestamps.

Use Transfer when you want a high-level, tracked asset transfer.

## Speed up and cancel

If a transfer is stuck in the mempool (status `Broadcasted`), you can speed it up or cancel it:

* [Speed Up Transfer](/api-reference/wallets/speed-up-transfer): Rebroadcasts the transfer with higher fees
* [Cancel Transfer](/api-reference/wallets/cancel-transfer): Replaces the transfer with a zero-value transaction (EVM only)

These endpoints work for:

* **EVM networks**: Both speed-up and cancel are available
* **Bitcoin**: Only speed-up is available (via RBF)

<Note>
  Success is not guaranteed. If the original transaction confirms before the replacement is mined, the speed-up or cancel will fail.
</Note>

**What endpoint should I use for my transactions?**

* **Transfer:** call the Transfer Asset endpoint for native tokens, ERC-20/721, SPL, Cardano assets, etc. It creates a wallet transfer request, requires user action signing, supports fee sponsorship, idempotency via externalId, policy approvals, status tracking, and indexing (txHash, dateConfirmed).
* **Broadcast (Sign & Broadcast):** use the Broadcast Transaction endpoint when you’ve built a raw/serialized transaction (or need to call arbitrary smart contract functions, mint, deploy contracts). This endpoint signs the transaction with the wallet key and broadcasts it; it also returns request status and txHash. See [Broadcast](/api-reference/broadcast).
* **Sign (Generate Signature):** use Generate Signature only when you need an off-chain signature (no broadcast). Note this wallet endpoint is deprecated in favor of the Keys API; it does not submit anything to the chain. See [Sign](/api-reference/sign).

## Transfer request object


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.