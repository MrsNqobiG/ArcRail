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

# Test your StableFX integration as a maker

> Test your integration with the StableFX API and smart contracts on the maker side

This tutorial walks you through the steps to test your StableFX integration as a
maker, covering successful trade creation, signature registration, and funding.
For failure scenarios, see
[Magic numbers for testing StableFX](/stablefx/references/testing-magic-numbers).

## Prerequisites

Before you begin, ensure that you have:

* Generated a StableFX API key. See
  [Generate a StableFX API key](/stablefx/howtos/get-api-key).
* Enabled your sandbox account as a registered maker by contacting
  [Circle Support](https://support.circle.com)
* Obtained testnet USDC and EURC in a supported wallet on Arc
* Installed cURL on your development machine

This guide provides API requests in cURL format, along with example responses.
In all examples, replace `${YOUR_API_KEY}` with your actual API key and any
other placeholder values with the appropriate data for your test.

## Part 1: Create a test trade

In sandbox, you create test trades by submitting a taker trade request using
your API key. This gives you a trade to sign and fund in the subsequent parts of
this tutorial.

### 1.1. Request a tradable quote

Request a quote for a trade from USDC to EURC using the
[create a quote](/api-reference/stablefx/all/create-quote) endpoint. Set `type`
to `tradable` to receive an executable quote. Include a `recipientAddress` for
the wallet that receives EURC after the trade settles:

```bash theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/quotes \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "from": {
    "currency": "USDC",
    "amount": "10"
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

The response includes the quote details and a `typedData` object containing the
Permit2 EIP-712 typed data you must sign before creating the trade.

```json theme={null}
{
  "id": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5",
  "rate": 0.915,
  "from": {
    "currency": "USDC",
    "amount": "10"
  },
  "to": {
    "currency": "EURC",
    "amount": "9.15"
  },
  "createdAt": "2025-01-01T12:04:05Z",
  "expiresAt": "2025-01-01T12:04:35Z",
  "fee": {
    "currency": "USDC",
    "amount": "0.01"
  },
  "typedData": {
    "domain": {
      "name": "Permit2",
      "chainId": 5042002,
      "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
    },
    "primaryType": "PermitWitnessTransferFrom",
    "message": {
      "permitted": {
        "token": "0x3600000000000000000000000000000000000000",
        "amount": 429000000
      },
      "spender": "0xa8f94168b4981840ba27d423f4ad6332bedee006",
      "nonce": 309585810,
      "deadline": 1770302983,
      "witness": {
        "consideration": {
          "quoteId": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5",
          "base": "0x3600000000000000000000000000000000000000",
          "quote": "0x4200000000000000000000000000000000000000",
          "baseAmount": "10",
          "quoteAmount": "9.15",
          "maturity": 1716153600
        },
        "recipient": "0xYOUR_WALLET_ADDRESS",
        "fee": 80000
      }
    }
  }
}
```

### 1.2. Sign the typed data

Using a Permit2 compliant, EIP-712 compatible wallet or signing library, sign
the `typedData` object returned in the quote response. Use the `domain`,
`types`, `primaryType`, and `message` fields to construct the EIP-712 signature.

After signing, you have a hex-encoded signature string (for example,
`0x1234...`).

### 1.3. Create the trade

Submit the quote acceptance using the
[create a trade](/api-reference/stablefx/all/create-trade) endpoint. Provide the
quote ID, your wallet address, the `message` from `typedData.message`, the
signature from the previous step, and a randomly generated
[idempotency key](/api-reference/idempotent-requests) in UUIDv4 format:

```bash theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/trades \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "quoteId": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5",
  "idempotencyKey": "${YOUR_IDEMPOTENCY_KEY}",
  "address": "0xYOUR_WALLET_ADDRESS",
  "message": {
    "permitted": {
      "token": "0x3600000000000000000000000000000000000000",
      "amount": 429000000
    },
    "spender": "0xa8f94168b4981840ba27d423f4ad6332bedee006",
    "nonce": 309585810,
    "deadline": 1770302983,
    "witness": {
      "consideration": {
        "quoteId": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5",
        "base": "0x3600000000000000000000000000000000000000",
        "quote": "0x4200000000000000000000000000000000000000",
        "baseAmount": "10",
        "quoteAmount": "9.15",
        "maturity": 1716153600
      },
      "recipient": "0xYOUR_WALLET_ADDRESS",
      "fee": 80000
    }
  },
  "signature": "0xYOUR_SIGNATURE"
}
'
```

After the trade is submitted and confirmed, it appears in the maker trade list
with the `confirmed` status.

## Part 2: Query for trades

After the trade you created in Part 1 is confirmed, query for maker trades with
the `confirmed` status using the
[get all trades](/api-reference/stablefx/all/list-trades) endpoint. The
following is an example request:

```bash theme={null}
curl --request GET \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/trades?type=maker&status=confirmed \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
```

**Response**

```json theme={null}
{
  "data": [
    {
      "id": "c2558cd1-98b5-4ccd-90b8-96891512af20",
      "contractTradeId": 42,
      "status": "confirmed",
      "rate": 0.915,
      "from": {
        "currency": "USDC",
        "amount": "10"
      },
      "to": {
        "currency": "EURC",
        "amount": "9.15"
      },
      "createDate": "2023-01-01T12:04:05Z",
      "updateDate": "2023-01-01T12:04:05Z",
      "quoteId": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5"
    }
  ],
  "pagination": {
    "next": "",
    "previous": ""
  }
}
```

## Part 3: Register your signature

Decide which trades to take from the maker side, and register your signature for
those trades.

### 3.1. Get the typed data for the trade

Using the `id` field from the response in the previous step, get the typed data
for the trade using the
[generate trade presign data](/api-reference/stablefx/all/generate-trade-signature-data)
endpoint. Include the required `recipientAddress` query parameter, which is the
address of the recipient of the settlement tokens. The following is an example
request:

```bash theme={null}
curl --request GET \
  --url 'https://api-sandbox.circle.com/v1/exchange/stablefx/signatures/presign/c2558cd1-98b5-4ccd-90b8-96891512af20?recipientAddress=0xYOUR_RECIPIENT_ADDRESS' \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}'
```

**Response**

```json theme={null}
{
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
      "TokenPermissions": [
        { "name": "token", "type": "address" },
        { "name": "amount", "type": "uint256" }
      ],
      "Consideration": [
        { "name": "quoteId", "type": "bytes32" },
        { "name": "base", "type": "address" },
        { "name": "quote", "type": "address" },
        { "name": "baseAmount", "type": "uint256" },
        { "name": "quoteAmount", "type": "uint256" },
        { "name": "maturity", "type": "uint256" }
      ],
      "TraderDetails": [
        { "name": "consideration", "type": "Consideration" },
        { "name": "fee", "type": "uint256" },
        { "name": "authorizer", "type": "address" }
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
        "amount": 429000000
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
        "fee": 80000,
        "authorizer": "0x0000000000000000000000000000000000000000"
      }
    }
  }
}
```

### 3.2. Sign the typed data

Using your wallet, sign the typed data returned from the previous step.

### 3.3. Submit the signed data

Submit the signed data to the
[submit a trade signature](/api-reference/stablefx/all/register-trade-signature)
endpoint. The following example submits the signed data from the previous step:

```bash theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/signatures \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "tradeId": "c2558cd1-98b5-4ccd-90b8-96891512af20",
  "address": "0xYOUR_WALLET_ADDRESS",
  "details": {
    "permitted": {
      "token": "0x3600000000000000000000000000000000000000",
      "amount": 429000000
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
      "fee": 80000,
      "authorizer": "0x0000000000000000000000000000000000000000"
    }
  },
  "signature": "0xsignature"
}
'
```

## Part 4: Fund the taker side

Because you created the trade in Part 1 using your own API key, you are also the
taker. You must fund the taker side of the trade before you can fund the maker
side in Part 5.

### 4.1. Get the taker funding signature data

Call the
[generate funding presign data](/api-reference/stablefx/all/generate-funding-presign-data)
endpoint with `"type": "taker"` and the `contractTradeId` from the Part 2
response:

```bash theme={null}
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

### 4.2. Sign the taker funding data

Using a Permit2 compliant, EIP-712 compatible wallet or signing library, sign
the `typedData` object from the response.

### 4.3. Submit the taker funding

Submit the signed data to the
[fund trades](/api-reference/stablefx/all/fund-trade) endpoint with
`"type": "taker"`:

```bash theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/fund \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "type": "taker",
  "signature": "0xYOUR_SIGNATURE",
  "permit2": {
    "permitted": {
      "token": "0xTOKEN",
      "amount": "10"
    },
    "spender": "0xSPENDER",
    "nonce": 123456,
    "deadline": 1752149700,
    "witness": {
      "id": "${stablefx_contract_trade_id}"
    }
  }
}
'
```

If the signed data is accepted, the API returns a blank `200` response and the
trade moves to the `taker_funded` status.

## Part 5: Fund the maker side

Use the following steps to fund the maker side of the trade onchain.

### 5.1. Get trades that are ready for funding

Before you send funds onchain, you should confirm that the trade is ready for
funding. To do this, call the
[get all trades](/api-reference/stablefx/all/list-trades) endpoint. You should
filter the response by the `taker_funded` status.

### 5.2. Get the funding signature data

To use the StableFX API to deliver the funds onchain, you must first sign the
funding typed data with an EIP-712 signature. To get the data to sign, call the
[generate funding presign data](/api-reference/stablefx/all/generate-funding-presign-data)
endpoint. Your request must include the contract ID of the trade and the side of
the trade that you are taking (`"type": "maker"`). The following is an example
request:

```bash theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/signatures/funding/presign \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
  {
  "contractTradeIds": ["${stablefx_contract_trade_id}"],
  "type": "maker"
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
      "currency": "EURC",
      "amount": "915.00"
    }
  ],
  "receivables": [
    {
      "currency": "USDC",
      "amount": "1000.00"
    }
  ]
}
```

### 5.3. Fund the trade with the StableFX API

The StableFX API can handle the onchain transaction for you through the
[fund trades](/api-reference/stablefx/all/fund-trade) endpoint. You must submit
the maker-specific funding data along with your signature.

```bash theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/fund \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "type": "maker",
  "signature": "0xsignature",
  "permit2": {
    "permitted": {
      "token": "0xTOKEN1",
      "amount": "9.15"
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
  You can submit the transaction onchain using your own web3 provider or wallet by
  calling the appropriate maker contract methods directly.
</Note>

## Testing trade batches

Note that the query for trades endpoint returns multiple trades. This can be
useful for testing a batch integration. If you are testing batching, you need to
get the `contractTradeId` for each trade that you'd like to fund. You should
complete [part 3](#part-3-register-your-signature) for each trade that you'd
like to fund.

Once you have the array of IDs, and your signature is submitted for each trade,
you can use the same [fund trades](/api-reference/stablefx/all/fund-trade)
endpoint to fund multiple trades by submitting the permit2 data for each trade
along with the appropriate signatures.
