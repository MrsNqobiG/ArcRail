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

# Node requirements

> System requirements, software, network endpoints, and ports for running an Arc node.

<Tip>
  For step-by-step setup instructions, see
  [Run an Arc Node](/arc/tutorials/run-an-arc-node).
</Tip>

## System requirements

| Component | Minimum |
| :- | :- |
| OS | Linux (Ubuntu 22.04+ or Debian 12+) |
| CPU | Higher clock speed over core count |
| Memory | 64 GB+ |
| Storage | 1 TB+ NVMe SSD (TLC recommended) |
| Network | Stable 24 Mbps+ bandwidth |

See [Reth system requirements](https://reth.rs/run/system-requirements/) for
more detail on Execution Layer configuration.

<Note>
  During sustained high load, such as startup or extended sync when the node is
  far behind, Execution Layer memory usage surges on some hardware. Systems that
  meet the listed requirements handle these surges without intervention. If you
  observe memory growth,
  [enable backpressure](/arc/tutorials/run-an-arc-node#enable-backpressure-under-memory-pressure)
  to throttle execution to the speed of disk writes.
</Note>

### Snapshot download size

An Arc node bootstraps from a snapshot; syncing from genesis is not supported.
Testnet snapshots are approximately **68 GB compressed for the Execution Layer**
and **16 GB compressed for the Consensus Layer**, extracting to roughly 103 GB
and 36 GB respectively. On a stable 100 Mbps connection the download takes 10–15
minutes; slower or metered connections can take hours.

## Required binaries

Every Arc node ships these three components. Install them with `arcup`
(pre-built binaries), build them from the
[`arc-node`](https://github.com/circlefin/arc-node) source, or run them in
Docker. See [Run an Arc node](/arc/tutorials/run-an-arc-node) for the full
walkthrough.

| Binary | Description |
| :- | :- |
| `arc-node-execution` | Execution Layer client (Reth-based). Executes transactions and serves RPC. |
| `arc-node-consensus` | Consensus Layer client (Malachite-based). Fetches and verifies blocks. |
| `arc-snapshots` | Downloads blockchain snapshots for faster initial sync. |

### Versions

| Network | Version |
| :- | :- |
| Arc Mainnet | v0.8.0 |
| Arc Testnet | v0.8.0 |

## Network endpoints

Your Consensus Layer connects to relay endpoints to fetch blocks from the
network. Specify multiple endpoints for redundancy.

| Network | Endpoints |
| :- | :- |
| Arc Mainnet | `https://rpc.mainnet.arc.io` <br /> `https://rpc.drpc.mainnet.arc.io` <br /> `https://rpc.blockdaemon.mainnet.arc.io` <br /> `https://rpc.quicknode.mainnet.arc.io` |
| Arc Testnet | `https://rpc.testnet.arc.io` <br /> `https://rpc.drpc.testnet.arc.io` <br /> `https://rpc.blockdaemon.testnet.arc.io` |

For developer RPC endpoints (connecting to Arc as an application, not running a
node), see [Connect to Arc](/arc/references/connect-to-arc).

## Exposed ports

| Port | Protocol | Mode | Description |
| :- | :- | :- | :- |
| 8545 | HTTP | Both | JSON-RPC API (Execution Layer) |
| 8551 | HTTP | RPC only | Engine API authentication |
| 9001 | HTTP | Both | Prometheus metrics (Execution Layer) |
| 29000 | HTTP | Both | Prometheus metrics (Consensus Layer) |
| 31000 | HTTP | Both | Consensus Layer RPC endpoint |

The Execution Layer and Consensus Layer communicate through either IPC sockets
or RPC. Choose one mode; they are mutually exclusive.

**IPC mode** (default): Both processes run on the same host. Lower latency, no
authentication required.

| Socket path | Purpose |
| :- | :- |
| `/run/arc/reth.ipc` | ETH RPC (Consensus Layer reads chain state) |
| `/run/arc/auth.ipc` | Engine API (Consensus Layer drives block import) |

**RPC mode**: Processes run on separate hosts. Uses HTTP on ports 8545 and 8551
with JWT authentication. Requires generating a shared JWT secret.

See
[Run an Arc node: Run on separate hosts](/arc/tutorials/run-an-arc-node#run-on-separate-hosts)
for configuration details.

## Recommended flags for public-facing nodes

If your node is reachable from the public internet, start the Execution Layer
with `--public-api`. This flag hides pending-transaction RPCs (a potential MEV
vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond the
safe set (`eth`, `net`, `web3`, `rpc`).

## Pruning

Both the Execution Layer and Consensus Layer accept the `--full` flag to enable
pruning. When bootstrapping from a pruned snapshot, `--full` is **required** on
the first Execution Layer start to reconcile internal database tables that would
otherwise fail a consistency check. After the initial startup completes, you may
restart without `--full` if you prefer not to prune.

EL pruning can increase memory usage on constrained machines. If you observe
memory pressure, lower the
[backpressure threshold](/arc/tutorials/run-an-arc-node#enable-backpressure-under-memory-pressure).
