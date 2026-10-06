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

# How-to: Connect your wallet

> Connect an EVM-compatible wallet to the StableFX Console for signing and funding trades.

Connect an EVM-compatible wallet (such as MetaMask or a WalletConnect-supported
wallet) to the [StableFX Console](/stablefx/concepts/console-overview) for
signing trades and funding settlements onchain. The console uses
[Dynamic.xyz](https://www.dynamic.xyz/) for wallet connection and supports any
wallet that can sign EIP-712 typed data.

## Prerequisites

Before you begin:

* You have a Circle account with StableFX access. Contact your Circle
  representative if you do not have one.
* You have an EVM-compatible wallet (such as MetaMask or any
  WalletConnect-supported wallet).
* You have the wallet browser extension installed and unlocked, or a mobile
  wallet with WalletConnect support.

## Supported wallets

The console supports wallets that are compatible with the EVM and can sign
EIP-712 typed data (a standard for structured, human-readable signing requests
used by DeFi applications). Common options include:

* **MetaMask** (browser extension or mobile)
* **WalletConnect**-compatible wallets (Rainbow, Trust Wallet, Coinbase Wallet,
  etc.)
* **Hardware wallets** connected through MetaMask (Ledger, Trezor)

## Network requirements

Your wallet must be configured for the correct network:

| Environment | Network | Chain ID | RPC URL |
| - | - | - | - |
| Mainnet | Arc | `5042` | `https://rpc.mainnet.arc.io` |
| Testnet | Arc Testnet | `5042002` | `https://rpc.testnet.arc.io` |

<Note>
  If your wallet does not have the Arc network configured, the console may
  prompt you to add it automatically. Alternatively, you can add it manually in
  your wallet's network settings.
</Note>

<Frame caption="The wallet provider selector powered by Dynamic.xyz">
  <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/wallet-connect-providers.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=7adaeac9e35d4f0d6ddaa34b0b4679b4" width="370" height="456" data-path="stablefx/images/wallet-connect-providers.png" />
</Frame>

## Connect during a trade flow

The most common way to connect your wallet is during the trade flow:

<Steps>
  <Step title="Start a trade">
    Open the trade form and configure your trade (currencies, amount, and
    tenor—the settlement period for the trade). Click **Continue**.
  </Step>

  <Step title="Connect wallet">
    The **Select Wallet** panel appears. Click **Connect Wallet** to open the
    wallet selector.
  </Step>

  <Step title="Choose your wallet">
    Select your wallet provider from the list. If using a browser extension like
    MetaMask, the extension popup appears. If using WalletConnect, scan the QR
    code with your mobile wallet.
  </Step>

  <Step title="Approve the connection">
    In your wallet, approve the connection request from the StableFX Console.
  </Step>

  <Step title="Confirm your address">
    The console displays your connected wallet address. Verify it is correct and
    click **Continue** to proceed to trade confirmation.

    <Frame caption="A connected Arc Wallet ready for trading">
      <img src="https://mintcdn.com/circle-167b8d39/HM4XcUeNobQEQ2YB/stablefx/images/select-wallet.png?fit=max&auto=format&n=HM4XcUeNobQEQ2YB&q=85&s=b4d34dcce4658759b08c5d4220635d2a" width="510" height="250" data-path="stablefx/images/select-wallet.png" />
    </Frame>
  </Step>
</Steps>

## Token requirements

Before you can sign and fund trades, your wallet needs:

### Sufficient token balance

Your wallet must hold enough tokens to cover:

* The **trade amount** (the currency you are selling)
* The **collateral** (risk buffer), if applicable

The console checks your balance before allowing you to proceed.

### Permit2 approval

StableFX uses the [Permit2](https://github.com/Uniswap/permit2) contract for
gas-efficient token transfers. You must approve the Permit2 contract to spend
your tokens.

* **First-time setup**: The console detects if you have not approved Permit2 and
  prompts you to do so during the trade flow. Your wallet displays a standard
  ERC-20 approval transaction.
* **One-time per token**: You only need to approve Permit2 once per token. After
  approval, all subsequent trades use Permit2 signatures (no additional onchain
  approval transactions).
* **Manual approval**: You can also approve Permit2 ahead of time. See
  [Grant USDC allowance to Permit2](/stablefx/howtos/grant-usdc-allowance-permit2).

The Permit2 contract address is `0x000000000022D473030F116dDEE9F6B43aC78BA3`.

## Wallet persistence

Your wallet connection persists across page loads in the same browser session.
If you close the browser or clear cookies, you will need to reconnect.

The wallet address used for a trade is recorded as the **signer address** in the
trade details. You must use the same wallet to fund the trade.

## Troubleshooting

| Issue | Solution |
| - | - |
| Wallet not appearing in selector | Ensure the browser extension is installed and unlocked, or refresh the page. |
| Wrong network | Switch your wallet to the Arc network (testnet or mainnet). The console may prompt you to switch automatically. |
| Insufficient balance | Add tokens to your wallet. On testnet, use the [Circle Faucet](https://faucet.circle.com/) to obtain USDC and EURC. |
| Permit2 approval fails | Ensure you have enough ETH (or the native Arc token) for gas fees. Try resetting your wallet's transaction history if the nonce is stale. |
| Signature rejected | If you reject a signature in your wallet, the console displays an error. You can retry by clicking the sign button again. |

Once your wallet is connected and funded, you are ready to execute trades. For a
guided walkthrough of your first trade, see
[Execute your first trade in the console](/stablefx/quickstarts/console-first-trade).
For the full taker trade creation flow, see
[Create a trade in the console](/stablefx/howtos/create-trade-console).
