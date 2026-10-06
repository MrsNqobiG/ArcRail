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

# How-to: Settle trades in the Console

> Fund individual trades or batch-settle multiple trades from the StableFX Console.

After you have [created a trade](/stablefx/howtos/create-trade-console) and
[both parties have signed](/stablefx/howtos/fulfill-trade-console), the trade
needs to be funded onchain for settlement to occur. The StableFX Console
provides two ways to fund: **individual funding** for a single trade, or **batch
funding** to settle multiple trades in a single transaction.

## Prerequisites

Before you begin:

* You have connected an EVM wallet with sufficient token balance.
* You have granted Permit2 approval for the funding token.
  [Permit2](https://docs.uniswap.org/contracts/permit2/overview) is a
  token-approval contract that lets you authorize token transfers with a single
  offchain signature rather than a separate onchain approve transaction.
* You have one or more trades in a fundable status (`pending_settlement`,
  `taker_funded`, or `maker_funded`, depending on your role). See
  [Trade states](/stablefx/references/trade-states) for a description of each
  status.

<Frame caption="Trade details with Settle Trade button for a pending settlement trade">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/trade-details-settle.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=0a4506196f7c1b4b9543537f3fb8794d" width="506" height="900" data-path="stablefx/images/trade-details-settle.png" />
</Frame>

## Individual trade funding

<Steps>
  <Step title="Navigate to Trades">
    Go to the **Trades** page from the sidebar navigation.
  </Step>

  <Step title="Open a fundable trade">
    Click on any trade that shows the **Fund** action. Fundable trades have one of
    these statuses:

    | Your role | Fundable when status is |
    | - | - |
    | Taker | `pending_settlement` or `maker_funded` |
    | Maker | `pending_settlement` or `taker_funded` |
  </Step>

  <Step title="Click Fund">
    In the trade details side panel, click **Fund** to open the funding flow.
  </Step>

  <Step title="Review and sign">
    The funding panel displays your deliverables (what you send to escrow) and
    receivables (what you get after settlement). Click **Fund Trade** and confirm
    the Permit2 signature in your wallet.

    <Frame caption="The funding panel showing delivering and receiving amounts">
      <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/fund-trade.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=20368605b5308f073aaddc23eca538e4" width="510" height="580" data-path="stablefx/images/fund-trade.png" />
    </Frame>
  </Step>
</Steps>

<Frame caption="Funding success confirmation">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/trade-funded-success.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=b49dac9bb8dbdc6300265653b76bd831" width="509" height="310" data-path="stablefx/images/trade-funded-success.png" />
</Frame>

## Batch funding

Batch funding lets you settle multiple trades in a single wallet signature. This
is especially useful for makers who accumulate many trades throughout a
settlement window.

<Steps>
  <Step title="Enter batch mode">
    <Frame caption="The Trades page with Batch fund button and filter controls">
      <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/trades-table.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=3dcec662ba5d9690d9fb89236efc5a0a" width="1035" height="589" data-path="stablefx/images/trades-table.png" />
    </Frame>

    On the **Trades** page, click **Batch fund** in the toolbar. The table
    switches to selection mode with checkboxes on each row.
  </Step>

  <Step title="Select trades">
    Check the trades you want to fund. Only trades in a fundable status appear as
    selectable. The console automatically filters out trades that are not eligible.
  </Step>

  <Step title="Review the batch">
    A summary bar at the bottom shows:

    * Number of selected trades
    * Total deliverables (aggregated by currency)
    * Total receivables (aggregated by currency)
  </Step>

  <Step title="Choose funding mode">
    If you are a **maker**, choose between:

    * **Gross**: Fund each trade at its full amount. The total deliverable is the
      sum of all individual trade amounts.
    * **Net**: Fund the net position across all selected trades. If you have
      offsetting trades (for example, selling USDC in one trade and buying USDC in
      another), the net amount is reduced accordingly.

    <Tip>
      Netting applies across all selected trades regardless of counterparty. You
      cannot net at the individual counterparty level.
    </Tip>

    If you are a **taker**, skip this step. Takers always fund in gross mode.
  </Step>

  <Step title="Sign and submit">
    Click **Fund All**. Your wallet prompts you to sign Permit2 batch typed data
    covering all selected trades. Confirm the signature.
  </Step>
</Steps>

## Funding modes explained

| Mode | Behavior | Best for |
| - | - | - |
| **Gross** | Each trade is funded at its full notional amount. | Takers (always gross), or makers who want explicit per-trade funding. |
| **Net** | Opposing positions in the same currency are offset. You fund only the net difference. | Makers with many trades in the same pair. Reduces capital requirements. |

<Note>
  Takers always fund in gross mode. The net funding option is available only to
  makers.
</Note>

## What happens after funding

Once you submit your funding signature:

1. The console broadcasts the transaction through the StableFX execution engine.
2. The FxEscrow smart contract on Arc receives and holds your tokens in escrow.
3. When both parties have funded, the contract settles the trade automatically:
   * The taker receives the "to" currency minus the taker fee.
   * The maker receives the "from" currency minus the maker fee.
   * Fees are sent to the fee wallet.

The trade status updates to `complete`, and the settlement tokens appear in your
wallet.

## Monitoring settlement

<Frame caption="The Activity tab showing settlement path progress">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/trade-activity-tab.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=8da7f038695b5a47120b503bf13010db" width="508" height="520" data-path="stablefx/images/trade-activity-tab.png" />
</Frame>

You can track each trade's onchain progress in the **Activity** tab of the trade
details panel. It shows:

* The contract trade ID
* Each onchain transaction (record, taker deliver, maker deliver, settle)
* Transaction hashes and timestamps
* Current status of each step

The trades table on the main page auto-refreshes every **30 seconds**. Click
into a specific trade for faster polling (every **3 seconds**).

## Handling breaches

If one or both parties fail to fund before the settlement deadline (determined
by the tenor, which is the agreed duration of the trade from creation to
settlement expiry), the trade enters a `breaching` state and eventually becomes
`breached`. See [Trade states](/stablefx/references/trade-states) for details on
these statuses.

When a trade is breached:

* The funded party's tokens are returned from escrow.
* Any collateral (risk buffer) from the non-funding party is forfeited.
* The trade cannot be retried. You must create a new trade.

See [Risk buffers](/stablefx/concepts/risk-buffers) for details on how
collateral protects against breaches.

## See also

* [Creating a trade](/stablefx/howtos/create-trade-console)
* [Fulfilling a trade](/stablefx/howtos/fulfill-trade-console)
* [Trade states](/stablefx/references/trade-states)
* [Risk buffers](/stablefx/concepts/risk-buffers)
