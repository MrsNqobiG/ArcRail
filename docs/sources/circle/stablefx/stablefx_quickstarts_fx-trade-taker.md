> ## Documentation Index
> Fetch the complete documentation index at: https://developers.circle.com/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> Before reading these docs, install the relevant Circle Skill to get pre-loaded context — skills are LLM-optimized and cover architecture decisions, correct flows, and common pitfalls. In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle. With Vercel Skills CLI: run npx skills add circlefin/skills. Available skills: use-usdc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md (balances, transfers, approvals on EVM and Solana); EURC has no skill — see https://developers.circle.com/stablecoins/what-is-eurc.md; bridge-stablecoin https://github.com/circlefin/skills/blob/master/plugins/circle/skills/bridge-stablecoin/SKILL.md (crosschain transfers via CCTP, USDC, EURC, and third-party assets); use-arc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md (Arc chain config, contract deployment, USDC bridging — Arc docs: https://docs.arc.io/llms.txt); use-circle-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-circle-wallets/SKILL.md (choose wallet type); use-developer-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md (custodial wallets for payouts and treasury); use-user-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md (embedded wallets with Web2 login); use-modular-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md (smart contract wallets with passkeys and ERC-4337); use-gateway https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-gateway/SKILL.md (unified USDC balance, nanopayments); use-smart-contract-platform https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-smart-contract-platform/SKILL.md (deploy, interact, monitor contracts). Pair any skill with the Circle MCP server for live SDK signatures, contract addresses, and chain IDs: {"mcpServers":{"circle":{"url":"https://api.circle.com/v1/codegen/mcp"}}}.
> Read the product overview first. Each product has an overview explaining when and why to use it. Read it before quickstarts.
> Pick the right wallet type. Developer-controlled (you hold keys), user-controlled (end user holds keys via PIN/social login), or modular (smart contract wallets with passkeys). See https://developers.circle.com/wallets.md.
> Use CCTP V2 for crosschain transfers. CCTP natively transfers USDC and EURC via burn-and-mint, and supports permissionless wrapping of third-party assets via lock-and-mint. V1 is legacy; always use V2 unless V1 is specified or the chain requires it (Noble, Sui, and Aptos still require V1). Migration guide: https://developers.circle.com/cctp/migration-from-v1-to-v2.md.
> Use Bridge Kit for frontend bridging. Wraps CCTP with a simpler SDK for user-facing apps. Use CCTP directly for backend transfers.
> Gas Station vs Paymaster. Gas Station sponsors gas for Circle Wallet transactions. Paymaster lets users pay gas in USDC. Different use cases — read both overviews.
> Gateway Nanopayments for sub-cent payments. Gasless USDC micropayments down to $0.000001 via x402 and batched settlement. For pay-per-request APIs, AI agent payments, streaming.
> Look up USDC addresses per chain. Never hardcode — use https://developers.circle.com/stablecoins/usdc-contract-addresses.md.
> Prefer SDKs over raw API calls. Node.js and Python SDKs handle auth, retries, and errors.
> API key required. Bearer token in Authorization header. Testnet and mainnet use separate keys and may use different base URLs depending on the product.
> Set up webhooks when available. Most operations are async. Webhooks deliver transaction confirmations and state changes.
> When calling list endpoints, paginate using pageSize and pageAfter until no nextPageAfter cursor is returned—stopping at the first page silently misses records.
> Building an AI agent? Start with the Agent Stack—Circle CLI, agent wallets, and nanopayments built for autonomous use cases: https://developers.circle.com/agent-stack.md.

# Quickstart: Create an FX trade as a taker

> Use the StableFX API to create an FX trade on the taker side

This guide walks you through the steps to create and execute a trade from the
taker side on StableFX.

## Prerequisites

Before you begin this quickstart, ensure you have:

* Generated a StableFX API key. See
  [Generate a StableFX API key](/stablefx/howtos/get-api-key).
* Set up a web3 provider or wallet that supports EIP-712 signatures and Permit2
* Granted a token allowance to the `Permit2` contract. See
  [How-to: Grant USDC Allowance to Permit2](/stablefx/howtos/grant-usdc-allowance-permit2)
  for more information.
* Installed cURL on your development machine

This quickstart provides API request examples in cURL format, along with example
responses.

## Part 1: Request a tradable quote

Request a tradable quote for a USDC to EURC trade using the
[create a quote](/api-reference/stablefx/all/create-quote) endpoint. Provide a
value for the `amount` parameter in either the `to` or `from` fields, but not
both. Set `type` to `tradable` to receive an executable quote that includes
EIP-712 typed data for signing. Include a `recipientAddress` for the wallet that
receives the destination currency after the trade settles.

```shell theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/quotes \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "from": {
    "currency": "USDC",
    "amount": "1000.00"
  },
  "to": {
    "currency": "EURC"
  },
  "tenor": "instant",
  "type": "tradable",
  "recipientAddress": "0xYOUR_WALLET_ADDRESS"
}
'
```

**Response**

The response includes the standard quote fields and a `typedData` object
containing the Permit2 EIP-712 typed data you need to sign before creating the
trade.

```json theme={null}
{
  "id": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5",
  "rate": "0.9150",
  "from": {
    "currency": "USDC",
    "amount": "1000.00"
  },
  "to": {
    "currency": "EURC",
    "amount": "915.00"
  },
  "createdAt": "2025-08-07T11:00:00Z",
  "expiresAt": "2025-08-07T11:05:00Z",
  "fee": {
    "currency": "USDC",
    "amount": "1.50"
  },
  "typedData": {
    "domain": {
      "name": "Permit2",
      "chainId": 5042002,
      "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
    },
    "types": {
      "EIP712Domain": [
        { "name": "name", "type": "string" },
        { "name": "chainId", "type": "uint256" },
        { "name": "verifyingContract", "type": "address" }
      ],
      "Consideration": [
        { "name": "quoteId", "type": "string" },
        { "name": "base", "type": "address" },
        { "name": "quote", "type": "address" },
        { "name": "baseAmount", "type": "uint256" },
        { "name": "quoteAmount", "type": "uint256" },
        { "name": "maturity", "type": "uint256" }
      ],
      "TraderDetails": [
        { "name": "consideration", "type": "Consideration" },
        { "name": "recipient", "type": "address" },
        { "name": "fee", "type": "uint256" },
        { "name": "authorizer", "type": "address" }
      ],
      "TokenPermissions": [
        { "name": "token", "type": "address" },
        { "name": "amount", "type": "uint256" }
      ],
      "PermitWitnessTransferFrom": [
        { "name": "permitted", "type": "TokenPermissions" },
        { "name": "spender", "type": "address" },
        { "name": "nonce", "type": "uint256" },
        { "name": "deadline", "type": "uint256" },
        { "name": "witness", "type": "TraderDetails" }
      ]
    },
    "primaryType": "PermitWitnessTransferFrom",
    "message": {
      "permitted": {
        "token": "0x3600000000000000000000000000000000000000",
        "amount": 1000000000
      },
      "spender": "0xa8f94168b4981840ba27d423f4ad6332bedee006",
      "nonce": 309585810,
      "deadline": 1770302983,
      "witness": {
        "consideration": {
          "quoteId": "0x00000000000000000000000000000000c4d1da72111e4d52bdbf2e74a2d803d5",
          "base": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
          "quote": "0x3600000000000000000000000000000000000000",
          "baseAmount": "915000000",
          "quoteAmount": "1000000000",
          "maturity": 1752148800
        },
        "recipient": "0x379c868f6064d9c0564df05dcca170d64f8aa5e3",
        "fee": 80000,
        "authorizer": "0x0000000000000000000000000000000000000000"
      }
    }
  }
}
```

## Part 2: Sign and create the trade

### 2.1. Sign the typed data

Using a `Permit2`-compliant EIP-712 compatible wallet or application, sign the
`typedData` object returned in the quote response. Use the `domain`, `types`,
`primaryType`, and `message` fields to construct the EIP-712 signature.

After signing, you have a hex-encoded signature string (for example,
`0x1234...`). You use this signature in the next step to create the trade.

### 2.2. Create the trade

Accept the quote and create a trade on StableFX using the
[create a trade](/api-reference/stablefx/all/create-trade) endpoint. You need to
provide the quote ID, your wallet address, the `message` from the quote
response's `typedData.message` field, the `signature` from the previous step,
and a randomly generated idempotency key in UUIDv4 format.

```shell theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/trades \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "idempotencyKey": "${randomUUID}",
  "quoteId": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5",
  "address": "0xYOUR_WALLET_ADDRESS",
  "message": {
    "permitted": {
      "token": "0x3600000000000000000000000000000000000000",
      "amount": 1000000000
    },
    "spender": "0xa8f94168b4981840ba27d423f4ad6332bedee006",
    "nonce": 309585810,
    "deadline": 1770302983,
    "witness": {
      "consideration": {
        "quoteId": "0x00000000000000000000000000000000c4d1da72111e4d52bdbf2e74a2d803d5",
        "base": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
        "quote": "0x3600000000000000000000000000000000000000",
        "baseAmount": "915000000",
        "quoteAmount": "1000000000",
        "maturity": 1752148800
      },
      "recipient": "0x379c868f6064d9c0564df05dcca170d64f8aa5e3",
      "fee": 80000,
      "authorizer": "0x0000000000000000000000000000000000000000"
    }
  },
  "signature": "0xsignature"
}
'
```

**Response**

```json theme={null}
{
  "id": "c2558cd1-98b5-4ccd-90b8-96891512af20",
  "contractTradeId": "24",
  "from": {
    "currency": "USDC",
    "amount": "1000.00"
  },
  "to": {
    "currency": "EURC",
    "amount": "915.00"
  },
  "status": "pending_settlement",
  "createDate": "2025-08-07T11:01:00Z",
  "updateDate": "2025-08-07T11:01:00Z",
  "quoteId": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5",
  "rate": "0.9150"
}
```

Verify that the response contains `"status": "pending_settlement"`. This
confirms that the trade was created and is awaiting funding from both parties.

## Part 3: Submit the funds onchain

Deliver the funds onchain to complete the trade. The StableFX API can handle the
onchain transaction for you using the `Permit2` contract.

### 3.1. Get the funding signature data

To use the StableFX API to deliver the funds onchain, you must first sign the
funding typed data with an EIP-712 signature. To get the data to sign, call the
[generate funding presign data](/api-reference/stablefx/all/generate-funding-presign-data)
endpoint. Your request must include the contract ID of the trade (the
`contractTradeId` value from the Part 2 response) and the side of the trade that
you are taking. The following is an example request:

```shell theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/signatures/funding/presign \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "contractTradeIds": ["${stablefx_contract_trade_id}"],
  "type": "taker"
}
'
```

**Response**

```json theme={null}
{
  "typedData": {
    "domain": {
      "name": "Permit2",
      "chainId": 11155111,
      "verifyingContract": "0xffd21ca8F0876DaFAD7de09404E0c1f868bbf1AE"
    },
    "types": {
      "EIP712Domain": [
        {
          "name": "name",
          "type": "string"
        },

        {
          "name": "chainId",
          "type": "uint256"
        },

        {
          "name": "verifyingContract",
          "type": "address"
        }
      ],
      "TokenPermissions": [
        {
          "name": "token",
          "type": "address"
        },

        {
          "name": "amount",
          "type": "uint256"
        }
      ],
      "SingleTradeWitness": [
        {
          "name": "id",
          "type": "uint256"
        }
      ],
      "PermitWitnessTransferFrom": [
        {
          "name": "permitted",
          "type": "TokenPermissions"
        },

        {
          "name": "spender",
          "type": "address"
        },

        {
          "name": "nonce",
          "type": "uint256"
        },

        {
          "name": "deadline",
          "type": "uint256"
        },

        {
          "name": "witness",
          "type": "SingleTradeWitness"
        }
      ]
    },
    "primaryType": "PermitWitnessTransferFrom",
    "message": {
      "permitted": {
        "token": "0xTOKEN",
        "amount": "1000"
      },
      "spender": "0xffd21ca8F0876DaFAD7de09404E0c1f868bbf1AE",
      "nonce": "42",
      "deadline": "1735689600",
      "witness": {
        "id": "10"
      }
    }
  },
  "deliverables": [
    {
      "currency": "USDC",
      "amount": "1000.00"
    }
  ],
  "receivables": [
    {
      "currency": "EURC",
      "amount": "915.00"
    }
  ]
}
```

### 3.2. Sign the funding data

Using a `Permit2`-compliant EIP-712 compatible wallet or application, sign the
data from the `typedData` field returned in the previous step.

### 3.3. Submit the funding signature

To deliver the funds onchain, you must submit the taker-specific `Permit2` data
along with your signature to the
[fund trade](/api-reference/stablefx/all/fund-trade) endpoint. The endpoint
allows you to submit either a single object or a batch of objects along with the
required signatures.

The following is an example request for a single trade:

```shell theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/fund \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "type": "taker",
  "signature": "0xsignature",
  "permit2": {
    "permitted": {
      "token": "0xTOKEN1",
      "amount": "1000"
    },
    "spender": "0xTOKEN1",
    "nonce": "123456",
    "deadline": 1752149700,
    "witness": {
      "id": "123456"
    }
  }
}
'
```

If the signed data is accepted, the API returns a blank `200` response.

<Note>
  It's not required to submit the funding transaction through the StableFX API.
  You can submit the transaction onchain using your own web3 provider or wallet.
</Note>

### 3.4. Confirm the trade is funded

To confirm that the trade is funded, call the
[get a trade by ID](/api-reference/stablefx/all/get-trade-by-id) endpoint. A
trade is funded when the status is `taker_funded`.

```shell theme={null}
curl --request GET \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/trades/${stablefx_trade_id} \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}'
```

**Response**

```json theme={null}
{
  "id": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5",
  "contractTradeId": "24",
  "status": "taker_funded",
  "rate": 0.915,
  "from": {
    "currency": "USDC",
    "amount": "1000"
  },
  "to": {
    "currency": "EURC",
    "amount": "915"
  },
  "createDate": "2023-01-01T12:04:05Z",
  "updateDate": "2023-01-01T12:04:05Z",
  "quoteId": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5"
}
```
