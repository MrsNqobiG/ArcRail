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

# How-to: Fund a trade with a settlement advance

> Use your Settlement Advance credit line to fund the maker leg of a confirmed StableFX trade through delegate funding.

This guide shows how to use your Circle credit line to fund the maker leg of a
confirmed StableFX trade through delegate funding, instead of delivering your
own inventory. You sign a Permit2 authorization with amount `0`, Circle delivers
the advanced currency onchain on your behalf, and you repay the advance later.
For the reasoning behind credit lines, delegate funding, collateral, and fees,
see [Settlement advance](/stablefx/concepts/settlement-advance).

## Prerequisites

Before you begin, make sure you've:

* Been approved for a Settlement Advance credit line.
* Set up a wallet or application that supports Ethereum Improvement Proposal 712
  (EIP-712) signatures.
* Granted a USDC allowance to the `Permit2` contract. See
  [How-to: Grant USDC Allowance to Permit2](/stablefx/howtos/grant-usdc-allowance-permit2).
* Obtained the ID of a confirmed trade.
* Installed curl, or another HTTP client, on your development machine.
* Reviewed the Settlement Advance agreement in the
  [Mint Console](https://app.circle.com/credit/stablefx). Select **View
  agreement** on the StableFX Settlement Advance page to read the current
  version. Your use of Settlement Advance is governed by this agreement.

The examples use MXNB as the advanced base currency and USDC as the collateral
currency on Arc. Amounts use the shape
`{"currency": "USDC", "amount": "350000.00"}`.

## Steps

<Steps>
  <Step title="Check available credit">
    Call the get credit line endpoint to confirm how much credit you have available
    and the fee schedule that applies to advances, expressed in basis points (bps).

    ```bash theme={null}
    curl --request GET \
      --url https://api-sandbox.circle.com/v1/exchange/stablefx/settlementAdvance/credit \
      --header 'Accept: application/json' \
      --header 'Authorization: Bearer ${YOUR_API_KEY}'
    ```

    **Response**

    ```json theme={null}
    {
      "status": "active",
      "limit": {
        "currency": "USDC",
        "amount": "1000000.00"
      },
      "usage": {
        "used": "350000.00",
        "available": "650000.00",
        "availableInCurrencies": {
          "USDC": "650000.00",
          "MXNB": "11180000.00"
        },
        "outstandingTransfers": 3
      },
      "fees": {
        "recurringFee": "2",
        "drawFee": "10",
        "reservationFee": "5"
      },
      "createDate": "2025-08-07T11:01:00Z",
      "updateDate": "2025-08-07T11:01:00Z"
    }
    ```

    The `availableInCurrencies` map shows the available credit converted to each
    supported currency. Use it to confirm you have enough credit in the currency you
    plan to advance.
  </Step>

  <Step title="(Optional) Reserve credit">
    To hold capacity on your credit line before you fund a trade, reserve credit
    with the reserve endpoint. Provide an `idempotencyKey` and the `advance`
    currency and amount. A reservation holds the credit for about 15 minutes. You
    can have one active reservation per currency. While a reservation is active, a
    request for the same currency with a different `idempotencyKey` is rejected;
    cancel the active reservation first.

    This step is optional. If you don't need to reserve credit, skip to the next
    step.

    ```bash theme={null}
    curl --request POST \
      --url https://api-sandbox.circle.com/v1/exchange/stablefx/settlementAdvance/reserve \
      --header 'Accept: application/json' \
      --header 'Authorization: Bearer ${YOUR_API_KEY}' \
      --header 'Content-Type: application/json' \
      --data '
    {
      "idempotencyKey": "3a1f8e2c-9b4d-4f6a-8c2e-1d5b7a9f0c34",
      "advance": {
        "currency": "MXNB",
        "amount": "6020000.00"
      }
    }
    '
    ```

    **Response**

    ```json theme={null}
    {
      "id": "f9d2c4a1-7e3b-4a8c-9f01-2b6d8e4a5c70",
      "amount": {
        "currency": "MXNB",
        "amount": "6020000.00"
      },
      "status": "active",
      "expirationDate": "2025-08-07T11:16:00Z",
      "createDate": "2025-08-07T11:01:00Z"
    }
    ```
  </Step>

  <Step title="Get the Permit2 typed data to sign">
    Call the presign endpoint with the `tradeId` of the confirmed trade to get the
    Permit2 typed data to sign.

    ```bash theme={null}
    curl --request POST \
      --url https://api-sandbox.circle.com/v1/exchange/stablefx/signatures/settlementAdvance/presign \
      --header 'Accept: application/json' \
      --header 'Authorization: Bearer ${YOUR_API_KEY}' \
      --header 'Content-Type: application/json' \
      --data '
    {
      "tradeId": "${stablefx_trade_id}"
    }
    '
    ```

    **Response**

    ```json theme={null}
    {
      "advance": {
        "currency": "MXNB",
        "amount": "6020000.00"
      },
      "collateral": {
        "currency": "USDC",
        "amount": "350000.00"
      },
      "makerPermitTypedData": {
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
          "DelegateFundingAuthorization": [
            { "name": "id", "type": "uint256" },
            { "name": "funder", "type": "address" },
            { "name": "recipient", "type": "address" },
            { "name": "token", "type": "address" },
            { "name": "amount", "type": "uint256" }
          ],
          "PermitWitnessTransferFrom": [
            { "name": "permitted", "type": "TokenPermissions" },
            { "name": "spender", "type": "address" },
            { "name": "nonce", "type": "uint256" },
            { "name": "deadline", "type": "uint256" },
            { "name": "witness", "type": "DelegateFundingAuthorization" }
          ]
        },
        "primaryType": "DelegateFundingAuthorizationPermitWitnessTransferFrom",
        "message": {
          "permitted": {
            "token": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
            "amount": "0"
          },
          "spender": "0xa8f94168b4981840ba27d423f4ad6332bedee006",
          "nonce": "309585810",
          "deadline": "1770302983",
          "witness": {
            "id": "10",
            "funder": "0xa8f94168b4981840ba27d423f4ad6332bedee006",
            "recipient": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
            "token": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
            "amount": "6020000000000"
          }
        }
      }
    }
    ```

    Note the following about the response:

    * `primaryType` is `DelegateFundingAuthorizationPermitWitnessTransferFrom`.
    * The witness is a `DelegateFundingAuthorization` with `id` (the onchain trade
      ID), `funder`, `recipient`, `token`, and `amount`.
    * `permitted.amount` is always `0`. No tokens move from your wallet; Circle
      delivers the advanced currency on your behalf.
    * `spender` is the `FxEscrow` contract address.
    * The response also returns the `advance` and `collateral` amounts for the
      trade.
  </Step>

  <Step title="Sign the typed data">
    Using your EIP-712-capable wallet or application, sign the
    `makerPermitTypedData` returned in the previous step. The signature is a 65-byte
    hex string.

    For example, with a viem wallet client:

    ```typescript theme={null}
    const signature: `0x${string}` = await walletClient.signTypedData({
      domain: makerPermitTypedData.domain,
      types: makerPermitTypedData.types,
      primaryType: makerPermitTypedData.primaryType,
      message: makerPermitTypedData.message,
    });
    ```
  </Step>

  <Step title="Request the advance">
    Submit the signed authorization to the request advance endpoint. Include an
    `idempotencyKey`, the `tradeId`, the `permit2` witness payload, and the
    `signature`. The request is idempotent on `tradeId`, and funding runs
    asynchronously.

    ```bash theme={null}
    curl --request POST \
      --url https://api-sandbox.circle.com/v1/exchange/stablefx/settlementAdvance \
      --header 'Accept: application/json' \
      --header 'Authorization: Bearer ${YOUR_API_KEY}' \
      --header 'Content-Type: application/json' \
      --data '
    {
      "idempotencyKey": "7c9e6f3a-2d18-4b5c-a0e7-9f4d1b8c63a2",
      "tradeId": "${stablefx_trade_id}",
      "permit2": {
        "permitted": {
          "token": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
          "amount": "0"
        },
        "spender": "0xa8f94168b4981840ba27d423f4ad6332bedee006",
        "nonce": "309585810",
        "deadline": "1770302983",
        "witness": {
          "id": "10",
          "funder": "0xa8f94168b4981840ba27d423f4ad6332bedee006",
          "recipient": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
          "token": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
          "amount": "6020000000000"
        }
      },
      "signature": "0xsignature"
    }
    '
    ```

    **Response**

    ```json theme={null}
    {
      "advanceId": "b27d4e91-3c6a-4f02-8d15-7e9a0c4b1f83",
      "tradeId": "c2558cd1-98b5-4ccd-90b8-96891512af20",
      "status": "requested"
    }
    ```
  </Step>

  <Step title="Track the advance">
    Call the get advance endpoint with the `advanceId` to track the advance through
    its lifecycle. The response reports the `status`, the `advance` and `collateral`
    amounts, the `fees` object (`unpaid` and `total`), the `dueDate`, and any
    `repayments`. The `fees.total`, `paidDate`, and `dueDate` fields are omitted
    until the advance is paid.

    ```bash theme={null}
    curl --request GET \
      --url https://api-sandbox.circle.com/v1/exchange/stablefx/settlementAdvance/${advance_id} \
      --header 'Accept: application/json' \
      --header 'Authorization: Bearer ${YOUR_API_KEY}'
    ```

    **Response**

    ```json theme={null}
    {
      "advanceId": "b27d4e91-3c6a-4f02-8d15-7e9a0c4b1f83",
      "tradeId": "c2558cd1-98b5-4ccd-90b8-96891512af20",
      "status": "disbursed",
      "advance": {
        "currency": "MXNB",
        "amount": "6020000.00"
      },
      "collateral": {
        "currency": "USDC",
        "amount": "350000.00"
      },
      "fees": {
        "total": null,
        "unpaid": {
          "currency": "USDC",
          "amount": "12.50"
        }
      },
      "createDate": "2025-08-07T11:01:00Z",
      "updateDate": "2025-08-07T11:02:00Z",
      "paidDate": null,
      "dueDate": null,
      "repayments": []
    }
    ```

    To list multiple advances, call the list advances endpoint. It supports
    filtering by `status` and create-date range, and it paginates with the
    `pageBefore` and `pageAfter` parameters and a configurable `pageSize`.

    The delegate-funded webhooks confirm onchain delivery. The
    `stablefx.trade.makerDelegateFunded` event fires when Circle delivers the
    advanced currency, and the `stablefx.contract.makerDelegateDeliver.failed` event
    fires if delivery fails. To subscribe, see
    [How-to: Set up a webhook endpoint](/api-reference/webhook-endpoints). For the
    full set of trade states, see [Trade states](/stablefx/references/trade-states).
  </Step>

  <Step title="Repay the advance">
    Record a repayment against the credit line backing the advance by calling the
    repayment endpoint. Any excess beyond the outstanding balance is credited to
    your Circle Mint account balance. For USDC and EURC repayments, round the amount
    up to two decimal places; other stablecoins, such as MXNB, QCAD, AUDF, and ZARU,
    aren't subject to rounding. The request is idempotent on `idempotencyKey`: a
    successful request returns `201`, and reusing the same key with different
    parameters returns `409`.

    ```bash theme={null}
    curl --request POST \
      --url https://api-sandbox.circle.com/v1/exchange/stablefx/settlementAdvance/repayment \
      --header 'Accept: application/json' \
      --header 'Authorization: Bearer ${YOUR_API_KEY}' \
      --header 'Content-Type: application/json' \
      --data '
    {
      "idempotencyKey": "d4b8a1f6-5c2e-4a90-b7d3-0e6f8c1a92b5",
      "amount": {
        "currency": "MXNB",
        "amount": "6020000.00"
      }
    }
    '
    ```

    The repayment applies against your credit line rather than a specific advance,
    so the request body carries only the `idempotencyKey` and the `amount`.

    **Response**

    ```json theme={null}
    {
      "id": "a3f7c2e9-6b14-4d80-9c5a-2e8f1b0d473c",
      "amount": {
        "currency": "MXNB",
        "amount": "6020000.00"
      },
      "status": "pending",
      "createDate": "2025-08-14T11:02:00Z",
      "updateDate": "2025-08-14T11:02:00Z"
    }
    ```
  </Step>
</Steps>

## See also

* [Settlement advance](/stablefx/concepts/settlement-advance)
* [Quickstart: Fulfill an FX trade as a maker](/stablefx/quickstarts/fx-trade-maker)
