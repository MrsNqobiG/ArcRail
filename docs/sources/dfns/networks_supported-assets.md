> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Supported assets

> Transfer kinds and asset standards supported by the DFNS transfer API across every network, including native tokens, fungible tokens, and NFTs.

The [Transfer API](/api-reference/wallets/transfer-asset) uses the `kind` field to specify the asset type. The table below lists all supported `kind` values by network.

For raw transactions (smart contract calls, DeFi interactions, etc.), use the [Broadcast API](/api-reference/wallets/sign-and-broadcast-transaction) instead — see the [broadcast examples](/api-reference/broadcast) for chain-specific formats.

## Transfer kinds by network

Every network supports `Native` for its base cryptocurrency. The table below lists additional token standards.

| Network | `kind` | Standard | Transfer type |
| - | - | - | - |
| Algorand | `Asa` | ASA | Algorand Standard Asset |
| Aptos | `Aip21` | AIP-21 | Aptos Fungible Asset (AIP-21) |
| Canton | `Cip56` | CIP-56 | Canton Standard Token (CIP-56) |
| Cardano | `Asset` | Asset | Cardano Asset |
| Concordium | `Cis2` | CIS-2 | CIS-2 Standard |
| Concordium | `Cis7` | CIS-7 | Concordium Protocol Level Token (CIS-7) |
| Ethereum | `Erc7984` | ERC-7984 | EVM Confidential Token (ERC-7984) |
| EVM chains | `Erc20` | ERC-20 | EVM Fungible Token (ERC-20) |
| EVM chains | `Erc721` | ERC-721 | EVM Non Fungible Token (ERC-721) |
| Hedera | `Hip17` | HIP-17 | Hedera Non-Fungible Token (HIP-17) |
| Hedera | `Hts` | HTS | Hedera Tokens (HTS) |
| ION | `Tep74` | TEP-74 | TON Jetton (TEP-74) |
| Movement | `Aip21` | AIP-21 | Aptos Fungible Asset (AIP-21) |
| Solana | `Spl` | SPL | Solana Program Library Token (SPL and SPL 2022) |
| Starknet | `Snip2` | SNIP-2 | Starknet SNIP-2 (ERC-20 like) |
| Starknet | `Snip3` | SNIP-3 | Starknet SNIP-3 (ERC-721-like) |
| Stellar | `Sep41` | SEP-41 | Stellar Classic Assets (SEP-41) |
| Sui | `Coin` | Coin | Sui Coin |
| TON | `Tep74` | TEP-74 | TON Jetton (TEP-74) |
| TRON | `Trc10` | TRC-10 | TRON Native Fungible Token (TRC-10) |
| TRON | `Trc20` | TRC-20 | TRON Smart Contract Fungible Token (TRC-20) |
| TRON | `Trc721` | TRC-721 | TRON Non Fungible Token (TRC-721) |
| XrpLedger (aka Ripple) | `Iou` | IOU | XRPL IOU Token |
| XrpLedger (aka Ripple) | `Xls33` | XLS-33 | XRPL XLS-33 Token |

<Note>
  Networks not listed (Bitcoin, Cosmos, IOTA, Kaspa, Polymesh, etc.) support `Native` transfers only. See each network's page under [Supported networks](/networks) for details.
</Note>

## Amount format

All amounts must be strings in the token's **minimum denomination** (e.g., wei for ETH, satoshis for BTC, lamports for SOL). For example, to send 1 ETH, set `amount` to `"1000000000000000000"`.

## Raw transactions

For anything beyond simple transfers — smart contract calls, DeFi interactions, batch operations — use the [Broadcast API](/api-reference/wallets/sign-and-broadcast-transaction) or the [Sign API](/api-reference/keys/generate-signature). These accept chain-specific transaction payloads and support any interaction the blockchain allows, as long as it uses a compatible cryptographic scheme (ECDSA, EdDSA, or Schnorr).


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.