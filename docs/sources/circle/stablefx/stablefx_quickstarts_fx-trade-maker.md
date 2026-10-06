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

# Quickstart: Fulfill an FX trade as a maker

> Use the StableFX API to fulfill an FX trade on the maker side

This guide walks you through the steps to fulfill and execute a trade from the
maker side on StableFX.

## Prerequisites

Before you begin this quickstart, ensure you have:

* Generated a StableFX API key. See
  [Generate a StableFX API key](/stablefx/howtos/get-api-key).
* Set up a web3 provider or wallet that supports EIP-712 signatures
* Granted a USDC allowance to the `Permit2` contract. See
  [How-to: Grant USDC Allowance to Permit2](/stablefx/howtos/grant-usdc-allowance-permit2)
  for more information.
* cURL installed on your development machine

This quickstart provides API request examples in cURL format, along with example
responses.

## Part 1: Query for available trades

Query for trades with the `confirmed` status using the
[get trades](/api-reference/stablefx/all/list-trades) endpoint. These are trades
created by takers that are ready for maker fulfillment.

```shell theme={null}
curl --request GET \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/trades?type=maker&status=confirmed \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}'
```

**Response**

```json theme={null}
{
  "data": [
    {
      "id": "c2558cd1-98b5-4ccd-90b8-96891512af20",
      "contractTradeId": "b4cdae0f-9285-48bf-8abf-109ae0177621",
      "status": "confirmed",
      "rate": "0.915",
      "from": {
        "currency": "USDC",
        "amount": "1000.00"
      },
      "to": {
        "currency": "EURC",
        "amount": "915.00"
      },
      "createDate": "2025-08-07T11:01:00Z",
      "updateDate": "2025-08-07T11:01:00Z",
      "quoteId": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5"
    }
  ],
  "pagination": {
    "next": "",
    "previous": ""
  }
}
```

## Part 2: Select a trade to fulfill

Choose a trade from the available confirmed trades that you want to fulfill as a
maker. You'll need the trade ID for the subsequent steps.

## Part 3: Confirm trade intent

Confirm your trade intent through the StableFX API before submitting the trade
on the blockchain.

### 3.1. Generate maker signature data

To submit the trade onchain, you must first sign the trade intent with an
EIP-712 signature. To get the data to sign, call the
[generate trade presign data](/api-reference/stablefx/all/generate-trade-signature-data)
endpoint. Your request must include the ID of the trade you want to fulfill.

```shell theme={null}
curl --request GET \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/signatures/presign/${stablefx_trade_id} \
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

### 3.2. Sign the data

Using an EIP-712 compatible wallet or application, sign the data returned in the
previous step.

### 3.3. Submit the trade signature

Confirm your trade intent by submitting the signed data to the
[submit trade signature](/api-reference/stablefx/all/register-trade-signature)
endpoint. This request must include the trade ID, the address of the wallet that
signed the payload, the typed data `details`, and the `signature`.

```shell theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/signatures \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "tradeId": "${stablefx_trade_id}",
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

If the signed data is accepted, the API returns a blank `200` response.

## Part 4: Submit the funds onchain

Next, you need to deliver the funds onchain to complete the trade. The StableFX
API can handle the onchain transaction for you using the `Permit2` contract.

### 4.1. Get the funding signature data

To use the StableFX API to deliver the funds onchain, you must first sign the
funding typed data with an EIP-712 signature. To get the data to sign, call the
[generate funding presign data](/api-reference/stablefx/all/generate-funding-presign-data)
endpoint. Your request must include the contract ID of the trade and the side of
the trade that you are taking. The following is an example request:

```shell theme={null}
curl --request POST \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/signatures/funding/presign \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "contractTradeIds": ["${stablefx_trade_id}"],
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

The `deliverables` array lists the token and amount you must deliver as the
maker. The `receivables` array lists the token and amount you receive after
settlement.

### 4.2. Sign the funding data

Using a `Permit2`-compliant EIP-712 compatible wallet or application, sign the
data returned in the previous step.

### 4.3. Submit the funding signature

To deliver the funds onchain, you must submit the maker-specific `Permit2` data
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
  "type": "maker",
  "signature": "0xsignature",
  "permit2": {
    "permitted": {
      "token": "0xTOKEN1",
      "amount": "915"
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

### 4.4. Confirm the trade is funded

To confirm that the trade is funded, call the
[get a trade by ID](/api-reference/stablefx/all/get-trade-by-id) endpoint. The
trade is funded when the status is `maker_funded`.

```shell theme={null}
curl --request GET \
  --url https://api-sandbox.circle.com/v1/exchange/stablefx/trades/${stablefx_trade_id} \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}'
```
