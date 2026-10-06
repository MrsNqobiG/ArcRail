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

# How-to: Fulfill a trade as a maker

> Review, sign, and fund confirmed trades from the maker view in the StableFX Console.

As a maker in the StableFX Console, you switch to the maker view to see trades
where you are the counterparty, sign confirmed trades with your EVM wallet to
authorize fulfillment, then fund your side of the settlement so the FxEscrow
contract can settle the trade onchain.

## Prerequisites

Before you begin:

* You have an active StableFX account with
  [**Maker** access](/stablefx/references/console-roles-permissions).
* You have connected an EVM-compatible wallet to Arc (testnet or mainnet). See
  [Connect your wallet](/stablefx/howtos/connect-wallet-console).
* You have funded your wallet with sufficient token balance for the trade amount
  plus [collateral](/stablefx/concepts/risk-buffers).
* You have approved the Permit2 contract for your funding token. See
  [Grant USDC allowance to Permit2](/stablefx/howtos/grant-usdc-allowance-permit2).

## Switch to maker view

The account type dropdown in the left sidebar has two options: **Trade** opens
the taker view and **Fulfill** opens the maker view. The console defaults to
**Trade**. To switch:

1. Navigate to the **Overview** or **Trades** page.
2. In the left sidebar, click the **account type dropdown**.
3. Select **Fulfill**.

The page refreshes to show maker-specific data. The trades table now displays
trades where you are the counterparty.

<Note>
  Your account type selection is stored as a session preference. It persists
  across page loads but resets when you switch browsers or clear cookies.
</Note>

## Review confirmed trades

In the **Trades** page (maker view), look for trades with `confirmed` status.
These are trades where a taker has accepted a quote and created the trade, but
the maker has not yet signed.

Click on a confirmed trade to open the **Trade Details** side panel. The panel
has two tabs:

<Frame caption="Trade details showing amounts, rate, collateral, fee, and status">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/trade-details.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=4138fa1f1268bd84de8f9fc3e024c066" width="508" height="880" data-path="stablefx/images/trade-details.png" />
</Frame>

* **Details**: Shows the trade terms (currency pair, amounts, rate, fee,
  collateral, tenor, and maturity time).
* **Activity**: Shows the settlement path and onchain transaction history.

<Note>
  In the maker view, the console swaps the display of trade direction to match
  your perspective: the top of the trade card shows the currency and amount you
  are delivering, and the bottom shows what you receive. This is the inverse of
  the taker's view for the same trade.
</Note>

## Sign the trade

Signing a trade confirms your intent to fulfill it. This is required before
either party can fund.

<Steps>
  <Step title="Click Sign">
    In the trade details panel, click **Sign**. The console opens the signing flow.
  </Step>

  <Step title="Connect your wallet">
    If your wallet is not already connected, the console prompts you to
    [connect it](/stablefx/howtos/connect-wallet-console). The wallet address
    you connect is the address that will fund and receive settlement tokens.
  </Step>

  <Step title="Review and sign">
    Your wallet displays EIP-712 typed data containing the trade details. Review:

    * The token amounts and currencies
    * The trade ID and contract trade ID
    * The spender (FxEscrow contract address)

    Confirm the signature in your wallet.
  </Step>

  <Step title="Confirm submission">
    The console submits your signature. The trade status updates to
    `pending_settlement`, meaning both sides can now fund.
  </Step>
</Steps>

### Manual signature option

If you prefer to sign outside the console:

1. Click **Sign manually** to view the raw EIP-712 typed data (the "presign"
   data).
2. Copy the typed data and sign it with your preferred signing tool.
3. Return to the console, click **Register signature**, paste the signature, and
   submit.

<Tip>
  Makers who integrate via [Talos](/stablefx/concepts/maker-talos-integration)
  can receive trade notifications directly and sign via the API. The console
  provides a complementary manual interface.
</Tip>

## Fund the trade

After both parties have signed, the trade moves to `pending_settlement`. You can
now fund your side.

<Steps>
  <Step title="Open the trade">
    On the Trades page, click a trade with `pending_settlement` or
    `taker_funded` status.
  </Step>

  <Step title="Click Fund">
    In the trade details panel, click **Fund**. The funding side panel opens.
  </Step>

  <Step title="Choose funding mode">
    As a maker, you can choose a **funding mode**:

    * **Gross**: Fund each trade individually at its full amount.
    * **Net**: Fund the net position across multiple trades. To fund net across
      multiple trades, see
      [Settle trades in batch](/stablefx/howtos/settle-trades-console).
  </Step>

  <Step title="Review deliverables and receivables">
    The panel shows:

    * **Deliverables**: The tokens and amounts you send to the FxEscrow contract.
    * **Receivables**: The tokens and amounts you receive after settlement.
  </Step>

  <Step title="Sign and submit">
    Click **Fund Trade**. Your wallet prompts you to sign Permit2 typed data.
    Permit2 is a token-approval contract that lets you authorize token transfers
    with a single offchain signature rather than a separate onchain approve
    transaction. Confirm in your wallet.
  </Step>
</Steps>

Once you fund, the trade status updates:

* If the taker has already funded → trade moves to `complete`.
* If the taker has not funded yet → trade moves to `maker_funded`, and the taker
  must fund before the maturity deadline.
* If the maturity deadline passes before both sides fund → trade moves to
  `breaching` and then `breached`.

<Warning>
  **If your wallet rejects or the signing flow fails**: Close the panel and reopen
  the trade to restart the signing or funding step. No state is written onchain
  until you confirm in your wallet, so the trade remains in its current status.

  **If the trade reaches its maturity deadline before both parties fund**: The
  trade is no longer eligible for settlement and moves to `breached` status. You
  must create a new trade.
</Warning>

## See also

* [Settle trades in batch](/stablefx/howtos/settle-trades-console)
* [Trade states](/stablefx/references/trade-states)
* [Risk buffers](/stablefx/concepts/risk-buffers)
