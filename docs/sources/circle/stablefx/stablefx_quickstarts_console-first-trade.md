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

# Execute your first trade in the Console

> Go from zero to your first StableFX trade using the console UI—no code required.

By the end of this quickstart, you will have requested a quote, signed a trade
with your wallet, and funded a settlement onchain.

## Prerequisites

Before you begin, ensure you have:

* Created a **Circle account** with StableFX access. If you don't have one,
  contact your Circle representative.
* Connected an **EVM-compatible wallet** (such as MetaMask or any
  WalletConnect-supported wallet) with a balance on the Arc network.
* Funded your wallet with **USDC or EURC** tokens on Arc.
* Granted **Permit2 approval** for your tokens. Permit2 is a smart contract that
  enables offchain signature-based token approvals, reducing the number of
  onchain transactions required. If you haven't done this, see
  [Granting USDC allowance with Permit2](/stablefx/howtos/grant-usdc-allowance-permit2).
  The console also prompts you during the trade flow if approval is missing.

<Note>
  For testnet, your wallet must be connected to Arc Testnet (chain ID `5042002`,
  RPC `https://rpc.testnet.arc.io`). You can obtain test USDC and EURC from the
  [Circle Faucet](https://faucet.circle.com/).
</Note>

## Step 1: Sign in and complete onboarding

<Steps>
  <Step title="Navigate to the console">
    Go to the [StableFX Console](https://hub.circle.com/fx/home) and sign in
    with your Circle account credentials.
  </Step>

  <Step title="Complete KYB verification">
    If this is your first time, the Home page displays your onboarding status.
    Click **Start onboarding** to begin the KYB (Know Your Business)
    verification process. You will be redirected to the onboarding portal to
    submit required documents.
  </Step>

  <Step title="Return to the console">
    Once your application is approved, return to the console. Your Home page now
    shows live FX rates and the trade form.

    <Frame caption="The StableFX Console home page with live rates and trade form">
      <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/console-home-page.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=ba99e3874e60dc43086f11137830524f" width="1412" height="1250" data-path="stablefx/images/console-home-page.png" />
    </Frame>
  </Step>
</Steps>

## Step 2: Request a quote

<Steps>
  <Step title="Open the trade form">
    On the Home page, locate the **Trade** card. You can also navigate to
    **Overview** or **Trades** and click the **New Trade** button.
  </Step>

  <Step title="Configure your trade">
    In the trade form side panel:

    * Select the **From** currency and enter the amount you want to sell (for
      example, `1000 USDC`).
    * Select the **To** currency (for example, `EURC`). One side of the pair
      must always be USDC.
    * Choose a **settlement tenor** (the time window in which both parties
      must fund the trade before it expires): `instant` (30 min), `hourly`
      (1 hr), or `daily` (24 hrs).

    The console automatically fetches a reference quote and displays the estimated
    exchange rate and the amount you will receive.
  </Step>

  <Step title="Continue to wallet selection">
    Click **Continue** to proceed to the wallet connection step.
  </Step>
</Steps>

## Step 3: Connect your wallet

<Steps>
  <Step title="Select or connect a wallet">
    The console prompts you to connect an EVM-compatible wallet. If you have already
    connected a wallet in a previous session, it may be pre-selected.

    Click **Connect Wallet** and follow the prompts from your wallet provider. For
    detailed instructions, see
    [Connecting your wallet to the console](/stablefx/howtos/connect-wallet-console).
  </Step>

  <Step title="Confirm the wallet">
    Verify that the displayed wallet address is correct, then click **Continue**.
  </Step>
</Steps>

<Warning>
  The wallet you connect must hold sufficient tokens for the trade amount plus
  any collateral (risk buffer). The console checks your balance before
  proceeding.
</Warning>

## Step 4: Lock the rate and create the trade

<Steps>
  <Step title="Review the tradable quote">
    The confirmation panel displays:

    * The live exchange **rate** (refreshed every 3 seconds)
    * The exact **amounts** for both sides of the trade
    * The **fee** (denominated in the "to" currency)
    * The **collateral** (risk buffer) amount, if applicable
    * The **settlement tenor** and expiration time
  </Step>

  <Step title="Approve the Permit2 contract">
    If this is your first trade with this token, the console prompts you to approve
    the Permit2 contract. Your wallet will display an ERC-20 approval transaction.
    Confirm it in your wallet.
  </Step>

  <Step title="Sign the trade">
    Click **Lock Rate & Continue**. Your wallet prompts you to sign EIP-712 typed
    data. This signature authorizes the trade at the locked rate. Confirm the
    signature in your wallet.

    The console submits the trade and displays the result.
  </Step>
</Steps>

<Warning>
  Quotes expire after a short window. If your wallet takes too long to confirm
  the signature, the console displays a "Quote expired" error. Click **Refresh
  Quote** to fetch a new rate, then sign again. If your wallet shows an
  insufficient-balance error, add funds to cover the trade amount plus any
  collateral before retrying.
</Warning>

## Step 5: Fund the trade

After the trade is created and both parties have signed, the trade moves to
`pending_settlement` status. You can now fund your side. The maker (your
counterparty) funds their side independently through their own console session.
For details, see
[Fulfill trades as a maker](/stablefx/howtos/fulfill-trade-console).

<Steps>
  <Step title="Open the trade">
    Navigate to the **Trades** page and find your trade. Click on it to open the
    trade details side panel.
  </Step>

  <Step title="Click Fund">
    If the trade is ready for funding, the **Fund** button is available. Click
    it.
  </Step>

  <Step title="Review deliverables and receivables">
    The funding panel shows:

    * **You deliver**: The token and amount you send to escrow.
    * **You receive**: The token and amount you receive after settlement.
  </Step>

  <Step title="Sign and submit funding">
    Click **Fund Trade**. Your wallet prompts you to sign Permit2 typed data.
    This signature authorizes the token transfer to the FxEscrow contract.
    Confirm it in your wallet.
  </Step>

  <Step title="Confirm settlement">
    Once both parties have funded, the FxEscrow contract settles the trade
    automatically. The trade status updates to `complete`, and you receive the
    settlement tokens in your wallet.
  </Step>
</Steps>

<Tip>
  You can monitor the trade status in real time on the Trades page. The status
  column updates automatically every 30 seconds, or you can click a trade to see
  live updates every 3 seconds. For more on managing trade settlement, see
  [Settle trades in the console](/stablefx/howtos/settle-trades-console).
</Tip>
