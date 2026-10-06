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

# How-to: Create a trade in the Console

> Request a quote, sign with your wallet, and execute a trade from the StableFX Console.

Create a taker trade in the StableFX Console by requesting a quote, connecting
your wallet, locking the exchange rate, and signing the trade. Use this workflow
when you want to execute a trade through the console UI without integrating with
the StableFX API directly.

## Prerequisites

Before you begin:

* You have an active StableFX account with **Taker** access.
* You have connected an EVM-compatible wallet to Arc (testnet or mainnet).
* You have a sufficient token balance for the trade amount plus collateral.
* You have granted Permit2 contract approval for the token you are selling. See
  [Grant USDC allowance to Permit2](/stablefx/howtos/grant-usdc-allowance-permit2).

<Frame caption="The trade form side panel">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/trade-form.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=51c31998faf89b6d42cb51c91cd393c9" width="510" height="520" data-path="stablefx/images/trade-form.png" />
</Frame>

## Open the trade form

You can start a new trade from multiple entry points:

* **Home page**: Click **Trade** in the trade card.
* **Overview page**: Click **New Trade** in the toolbar.
* **Trades page**: Click **New Trade** in the top-right corner.

The trade form opens in a side panel on the right.

## Configure the trade

### Select currencies

Choose the **From** and **To** currencies using the dropdowns. One side of every
pair must be USDC.

Supported pairs include:

* USDC / EURC
* EURC / USDC

<Note>
  Additional currency pairs (such as USDC/MXNB and USDC/AUDF) may be available
  depending on your account configuration and the current StableFX network.
</Note>

### Enter the amount

Enter an amount in either the **From** or **To** field—not both. The console
fetches a reference quote and auto-fills the other side based on the current
exchange rate.

* Amounts support up to **6 decimal places**.
* There is a minimum trade amount enforced by the API. If your amount is too
  low, the console displays an error.
* The quote refreshes automatically every **3 seconds** while the form is open.

### Choose a settlement tenor

Select how quickly the trade should settle:

| Tenor | Settlement window | Description |
| - | - | - |
| **Instant** | 30 minutes | Both parties must fund in 30 minutes of trade creation. |
| **Hourly** | 1 hour | Settlement deadline is 1 hour after trade creation. |
| **Daily** | 24 hours | Settlement deadline is 24 hours after trade creation. |

<Tip>
  Shorter tenors reduce counterparty risk but require faster funding. `instant`
  is a good default for your first trade.
</Tip>

### Review the rate

The **Quote Rate Card** at the bottom of the form shows the current exchange
rate. This is a reference rate—the final rate is locked when you create the
trade in the confirmation step.

## Connect your wallet

Click **Continue** to proceed to wallet selection.

If you haven't connected a wallet yet, see
[Connect your wallet to the StableFX Console](/stablefx/howtos/connect-wallet-console)
for step-by-step instructions. The console uses
[Dynamic.xyz](https://www.dynamic.xyz/) for wallet connection and supports any
EVM-compatible wallet.

Once connected, verify that the displayed wallet address is correct and click
**Continue**.

<Warning>
  Your connected wallet must have:

  * Sufficient balance for the trade amount **plus** collateral (risk buffer).
  * An active Permit2 approval for the token you are selling. The console prompts
    you to approve if needed.
</Warning>

## Lock the rate and create the trade

<Frame caption="The trade confirmation panel showing rate, fee, collateral, and settlement path">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/trade-confirmation.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=f8eddcdcd41ccf3f3ffecd258e86db14" width="507" height="850" data-path="stablefx/images/trade-confirmation.png" />
</Frame>

The confirmation panel shows a live **tradable quote** with the exact terms of
the trade:

* **Rate**: The current exchange rate, refreshing every 3 seconds.
* **From / To amounts**: The exact token amounts for both sides.
* **Fee**: The trading fee, denominated in the "to" currency.
* **Collateral**: The risk buffer amount held temporarily to cover potential
  non-settlement (denominated in the "from" currency), if applicable. See
  [Risk buffers](/stablefx/concepts/risk-buffers).
* **Settlement tenor**: The selected settlement window.
* **Expiration**: When the quote expires.

When you are ready:

1. Click **Lock Rate & Continue**.
2. If this is your first trade with this token, your wallet prompts you to
   approve the Permit2 contract (a one-time ERC-20 approval).
3. Your wallet then prompts you to sign **EIP-712 typed data**. This signature
   authorizes the trade at the displayed rate. Review the details in your wallet
   and confirm.

The console submits the signed trade and displays the result:

<Frame caption="Trade confirmed—awaiting maker signature">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/trade-confirmed-status.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=db28ec1cb0e92ae5c578206786a95f9c" width="510" height="340" data-path="stablefx/images/trade-confirmed-status.png" />
</Frame>

* **Success**: The trade is created with status `pending_settlement`. You can
  proceed to [fund the trade](/stablefx/howtos/settle-trades-console).
* **Failure**: If the quote expired or another error occurred, the console
  displays an error message. You can retry with a new quote.

## Alternative: manual signature

If you prefer to sign the typed data outside the console (for example, using a
hardware wallet or a custom signing tool):

1. In the confirmation panel, click **Sign manually** to view the raw EIP-712
   typed data.
2. Copy the typed data and sign it with your preferred tool.
3. Paste the resulting signature back into the console and submit.

## See also

* [Trade states](/stablefx/references/trade-states): Full state machine and
  status definitions.
* [Settle trades in the console](/stablefx/howtos/settle-trades-console): Fund
  individual or batch trades after creation.
* [Fulfill a trade as a maker](/stablefx/howtos/fulfill-trade-console): The
  maker-side workflow for signing and funding.
* [Grant USDC allowance to Permit2](/stablefx/howtos/grant-usdc-allowance-permit2):
  Set up the onchain token approval.
* [Console overview](/stablefx/concepts/console-overview): Console features,
  pages, and how trading works.
