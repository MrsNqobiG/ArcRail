> ## Documentation Index
> Fetch the complete documentation index at: https://docs.arc.io/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> Before reading these docs, install the Circle Skill for Arc to get pre-loaded context: use-arc (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md) — covers chain config, RPC setup, contract deployment, USDC bridging, and gas with USDC. In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle. With Vercel Skills CLI: run npx skills add circlefin/skills.
> USDC is the gas token. Arc uses USDC for gas fees, not ETH. Configure gas payment in USDC when submitting transactions.
> Read EVM differences before writing Arc code. Arc targets the Osaka EVM baseline. Most contracts deploy unchanged, but several runtime behaviors diverge from Ethereum: USDC uses 18 decimals natively (not 6), the system emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` logs all USDC Transfer events, the mempool enforces a 20 Gwei `maxFeePerGas` floor, blocklist reverts consume gas without a receipt, and `address(0)` sends revert rather than succeed. https://docs.arc.io/arc/references/evm-differences.md is the canonical reference for all Arc-specific runtime behaviors. Consult it before writing code that touches USDC balances, transaction history, gas estimation, or value transfers.
> Sub-second finality. Transactions are final in under 1 second. No need to wait for multiple block confirmations.
> Use App Kits for multichain payment and liquidity capabilities. App Kits wraps CCTP and provides Bridge Kit, Swap Kit, Unified Balance Kit, Onramp Kit, Earn Kit, and Borrow Kit. Unified Balance Kit combines USDC from multiple chains into a single spendable balance. Earn Kit integrates earn opportunities into your app. Borrow Kit lets users borrow USDC against cirBTC collateral on Arc.
> Use Arc Foundry for contract development. Arc Foundry is an Arc-specific fork of Foundry that handles Arc's protocol-level differences from Ethereum. It provides arc-forge, arc-cast, and arc-anvil. Install it before deploying contracts: https://docs.arc.io/arc/tutorials/install-arc-foundry.md.
> Arc is available on both Testnet and Mainnet. See https://docs.arc.io/arc/references/connect-to-arc.md for RPC endpoints and https://faucet.circle.com for testnet tokens.
> Always check Contract Addresses: https://docs.arc.io/arc/references/contract-addresses.md
> Building beyond Arc? Circle offers skills for the full platform: use-usdc (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md), use-circle-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-circle-wallets/SKILL.md), use-developer-controlled-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md), use-user-controlled-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md), use-modular-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md), use-gateway (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-gateway/SKILL.md), use-smart-contract-platform (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-smart-contract-platform/SKILL.md). Full Circle developer docs: https://developers.circle.com/llms.txt.

# How-to: Install Arc Foundry

> Set up Arc Foundry to build and deploy contracts on Arc.

Arc Foundry is an Arc-specific fork of [Foundry](https://getfoundry.sh/) that
supports
[Arc's protocol-level differences from Ethereum](/arc/references/evm-differences).
These steps install the `arc-forge`, `arc-cast`, and `arc-anvil` binaries.

After installing Arc Foundry, you're ready to
[deploy on Arc](/arc/tutorials/deploy-on-arc).

## Prerequisites

Before you begin, ensure that you've:

* Confirmed access to a Unix-like shell (macOS, Linux, or Windows with
  [WSL](https://learn.microsoft.com/en-us/windows/wsl/install))
* Installed a code editor such as [VS Code](https://code.visualstudio.com/)

## Steps

### Step 1. Download the archive

Precompiled binaries are available for Linux (x86\_64, arm64), macOS Apple
Silicon, and Windows with WSL (use the Linux binary). For Intel Mac, see
[building from source](https://github.com/circlefin/arc-foundry#building-from-source).

Download the archive for your platform from the
[Arc Foundry releases page](https://github.com/circlefin/arc-foundry/releases).

### Step 2. Extract and install the binaries

Extract the archive and move the binaries to a directory on your `PATH`:

```shell theme={null}
tar -xzf arc-foundry-<version>-<target>.tar.gz
mkdir -p ~/.local/bin
mv forge ~/.local/bin/arc-forge
mv cast  ~/.local/bin/arc-cast
mv anvil ~/.local/bin/arc-anvil
```

If `~/.local/bin` isn't already on your `PATH`, add it:

```shell theme={null}
export PATH="$HOME/.local/bin:$PATH"
```

Add that line to your shell profile (`.zshrc` or `.bash_profile`) to persist it
across sessions.

### Step 3. Verify the installation

```shell theme={null}
arc-forge --version
```

The command returns version information that shows Arc Foundry installed
successfully.

If you encounter issues with Arc Foundry commands or unexpected tool behavior,
see
[Troubleshoot with Arc Foundry](/arc/tutorials/troubleshoot-with-arc-foundry).
