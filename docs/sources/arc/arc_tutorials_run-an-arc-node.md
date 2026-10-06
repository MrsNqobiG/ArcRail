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

# Run an Arc node

> Set up and run an Arc node to independently verify the blockchain and serve a local RPC endpoint. Choose between pre-built binaries, building from source, or Docker Compose.

<View title="v0.8.0 (latest)" icon="tag">
  <Warning>
    **v0.8.0 upgrade required.** Testnet operators must upgrade before timestamp
    `1788447600` (2026-09-03 15:00:00 UTC), when Zero8 activates. Mainnet operators
    must upgrade before timestamp `1789052400` (2026-09-10 15:00:00 UTC), when
    Zero7/Zero8 activate. Earlier versions are not supported after those timestamps.

    This release includes breaking changes. See
    [CHANGELOG.md](https://github.com/circlefin/arc-node/blob/main/CHANGELOG.md#v080)
    and
    [BREAKING\_CHANGES.md](https://github.com/circlefin/arc-node/blob/main/BREAKING_CHANGES.md#v080)
    for migration details before upgrading.
  </Warning>

  An Arc node syncs blocks from the network and serves a local JSON-RPC endpoint
  so you can independently verify every block and transaction. It runs two
  processes: the Execution Layer (EL), which executes transactions and maintains
  state, and the Consensus Layer (CL), which fetches finalized blocks from relay
  endpoints (trusted HTTP servers that distribute signed block data), verifies
  their signatures, and passes them to the EL. For a deeper explanation of how
  these components fit together, see
  [Running a node](/arc/concepts/running-a-node).

  Arc Testnet and Mainnet nodes run the same procedure; the Docker Compose path
  currently supports testnet only. Network-specific configuration values are
  called out at each step.

  Choose the install path that fits your environment.

  <Tabs>
    <Tab title="arcup">
      Install pre-built Arc binaries using the `arcup` script. This is the fastest
      path and requires no Rust toolchain or build dependencies.

      ## Prerequisites

      Before you begin, ensure that you've:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux or macOS machine that meets the minimum system requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install with `arcup`

      `arcup` installs the Arc binaries under `$ARC_HOME` (default `~/.arc`). Export
      `ARC_HOME` first if you want to install somewhere else; otherwise the default
      applies for both the installer and the environment file:

      ```shell theme={null}
      export ARC_HOME="${ARC_HOME:-$HOME/.arc}"
      curl -L https://raw.githubusercontent.com/circlefin/arc-node/main/arcup/install | bash
      ```

      The installer places `arc-node-execution`, `arc-node-consensus`,
      `arc-snapshots`, and `arcup` itself into `$ARC_HOME/bin`. Load the produced
      environment file so the binaries are on your `PATH`:

      ```shell theme={null}
      source "$ARC_HOME/env"
      ```

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      Each command prints a version string. To update the binaries later, run `arcup`.

      ## Step 2: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 3: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 4: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis. For testnet, replace `arc-mainnet` with `arc-testnet`.

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-mainnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. The download takes 10–15 minutes on a stable 100 Mbps
        connection; slower or metered connections can take hours. Ensure you have
        sufficient free disk space (at least 150 GB recommended), a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      <Note>
        Starting with v0.8.0, Circle provides snapshots in Reth V2 storage format. A
        fresh install from these snapshots does not require the V1→V2 data migration
        described in the [Migrate to V2 storage](#migrate-to-v2-storage) section.
      </Note>

      ## Step 5: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 6: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to. For testnet, replace `--chain arc-mainnet` with
      `--chain arc-testnet` and `--rpc.forwarder https://rpc.mainnet.arc.io/` with
      `--rpc.forwarder https://rpc.testnet.arc.io/`.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-mainnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.mainnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain` | Yes | Selects the genesis configuration bundled in the binary. Use `arc-testnet` for Testnet or `arc-mainnet` for Mainnet. |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |
      | `--rpc.max-connections` | Recommended for public-facing nodes | Maximum concurrent RPC connections. Default `250` (lowered from `500` in v0.7.1). Raise only if clients see `MaxConnections` errors |
      | `--rpc.max-subscriptions-per-connection` | Recommended for public-facing nodes | Maximum subscriptions per single WebSocket connection. Default `32` (lowered from `1024` in v0.7.1). Raise only if clients see `TooManySubscriptions` errors |

      On high-traffic public endpoints, raise `--rpc.max-connections` (default 250)
      and `--rpc.max-subscriptions-per-connection` (default 32) if clients see
      `MaxConnections` or `TooManySubscriptions` errors. The defaults bound WebSocket
      log-fanout memory growth and should only be raised, not lowered.

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. When `--full` is used, EL pruning runs on a
        128-block interval (changed from 5000 in v0.7.3); pass
        `--prune.block-interval=5000` explicitly to retain the previous schedule.
        `--chain arc-mainnet` uses the bundled genesis configuration; replace with
        `--chain /path/to/genesis.json` if you have a custom genesis file. See
        [reth node](https://reth.rs/cli/reth/node/) for additional flags.
      </Note>

      ## Step 7: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network. For
      testnet, use these `--follow.endpoint` values instead:

      * `--follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io`
      * `--follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io`
      * `--follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket`

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.mainnet.arc.io,wss=rpc.mainnet.arc.io \
        --follow.endpoint https://rpc.drpc.mainnet.arc.io,wss=rpc.drpc.mainnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.mainnet.arc.io,wss=rpc.blockdaemon.mainnet.arc.io/websocket \
        --follow.endpoint https://rpc.quicknode.mainnet.arc.io,wss=rpc.quicknode.mainnet.arc.io \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 8: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds. The block number increases as the node
      syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are missing after 30 seconds, the EL
        did not start. Review its terminal output for a panic or configuration error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Build from source">
      Build Arc binaries from the [`arc-node`](https://github.com/circlefin/arc-node)
      repository. Use this path to audit the build, run on an unsupported platform, or
      pin to a specific commit.

      ## Prerequisites

      Before you begin, ensure that you've:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux, macOS, or Windows machine that meets the minimum system
        requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install build dependencies

      Install [Rust](https://rust-lang.org/tools/install/) if you don't have it:

      ```shell theme={null}
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
      source ~/.cargo/env
      ```

      Install the platform packages required to build the EL database bindings:

      * **Ubuntu:** `sudo apt-get install libclang-dev pkg-config build-essential`
      * **macOS:** `brew install llvm pkg-config`, then
        `export LIBCLANG_PATH="$(brew --prefix llvm)/lib"`
      * **Windows:** `choco install llvm` or `winget install LLVM.LLVM`

      ## Step 2: Clone the repository

      Clone the [`arc-node`](https://github.com/circlefin/arc-node) repository and
      check out the version for your target network. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      git clone https://github.com/circlefin/arc-node.git
      cd arc-node
      git checkout v0.8.0
      git submodule update --init --recursive
      ```

      ## Step 3: Build and install

      The following commands build three Arc node binaries: `arc-node-execution`,
      `arc-node-consensus`, and `arc-snapshots`:

      ```shell theme={null}
      cargo install --path crates/node
      cargo install --path crates/malachite-app
      cargo install --path crates/snapshots
      ```

      `cargo install` places compiled binaries into `~/.cargo/bin`, which is added to
      `PATH` by loading `~/.cargo/env`. To install elsewhere, add `--root $BASE_DIR`
      to each command (for instance, `--root /usr/local` places them under
      `/usr/local/bin`).

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      ## Step 4: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 5: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 6: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis. For testnet, replace `arc-mainnet` with `arc-testnet`.

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-mainnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. The download takes 10–15 minutes on a stable 100 Mbps
        connection; slower or metered connections can take hours. Ensure you have
        sufficient free disk space (at least 150 GB recommended), a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      <Note>
        Starting with v0.8.0, Circle provides snapshots in Reth V2 storage format. A
        fresh install from these snapshots does not require the V1→V2 data migration
        described in the [Migrate to V2 storage](#migrate-to-v2-storage) section.
      </Note>

      ## Step 7: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 8: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to. For testnet, replace `--chain arc-mainnet` with
      `--chain arc-testnet` and `--rpc.forwarder https://rpc.mainnet.arc.io/` with
      `--rpc.forwarder https://rpc.testnet.arc.io/`.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-mainnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.mainnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain` | Yes | Selects the genesis configuration bundled in the binary. Use `arc-testnet` for Testnet or `arc-mainnet` for Mainnet. |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |
      | `--rpc.max-connections` | Recommended for public-facing nodes | Maximum concurrent RPC connections. Default `250` (lowered from `500` in v0.7.1). Raise only if clients see `MaxConnections` errors |
      | `--rpc.max-subscriptions-per-connection` | Recommended for public-facing nodes | Maximum subscriptions per single WebSocket connection. Default `32` (lowered from `1024` in v0.7.1). Raise only if clients see `TooManySubscriptions` errors |

      On high-traffic public endpoints, raise `--rpc.max-connections` (default 250)
      and `--rpc.max-subscriptions-per-connection` (default 32) if clients see
      `MaxConnections` or `TooManySubscriptions` errors. The defaults bound WebSocket
      log-fanout memory growth and should only be raised, not lowered.

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. When `--full` is used, EL pruning runs on a
        128-block interval (changed from 5000 in v0.7.3); pass
        `--prune.block-interval=5000` explicitly to retain the previous schedule.
        `--chain arc-mainnet` uses the bundled genesis configuration; replace with
        `--chain /path/to/genesis.json` if you have a custom genesis file. See
        [reth node](https://reth.rs/cli/reth/node/) for additional flags.
      </Note>

      ## Step 9: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network. For
      testnet, use these `--follow.endpoint` values instead:

      * `--follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io`
      * `--follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io`
      * `--follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket`

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.mainnet.arc.io,wss=rpc.mainnet.arc.io \
        --follow.endpoint https://rpc.drpc.mainnet.arc.io,wss=rpc.drpc.mainnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.mainnet.arc.io,wss=rpc.blockdaemon.mainnet.arc.io/websocket \
        --follow.endpoint https://rpc.quicknode.mainnet.arc.io,wss=rpc.quicknode.mainnet.arc.io \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 10: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds. The block number increases as the node
      syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are missing after 30 seconds, the EL
        did not start. Review its terminal output for a panic or configuration error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Docker">
      Run the Arc node from pre-built Docker images using Docker Compose. Init
      containers handle snapshot download and CL initialization on the first run.

      <Note>
        The Docker Compose configuration currently targets Arc Testnet. To run a mainnet
        node, use the `arcup` install path or build from source.
      </Note>

      ## Prerequisites

      Before you begin, ensure that you've:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux machine that meets the minimum system requirements
      * Installed
        [Docker Engine 24+ with BuildKit](https://docs.docker.com/engine/install/) and
        [Docker Compose v2](https://docs.docker.com/compose/install/)

      ## Step 1: Set environment variables

      The Compose file reads images from environment variables. Set the version, data
      directory, and image references. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      export ARC_VERSION=0.8.0
      export ARC_HOME=~/.arc
      export ARC_EXECUTION_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-execution:$ARC_VERSION
      export ARC_CONSENSUS_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-consensus:$ARC_VERSION
      ```

      To build images locally instead of pulling from Cloudsmith, see
      [Installation: Docker](https://github.com/circlefin/arc-node/blob/main/docs/installation.md#docker)
      in the `arc-node` repository.

      ## Step 2: Prepare the data directory

      Create `$ARC_HOME` on the host before starting Docker Compose. If you skip this,
      Docker creates it as `root` and the snapshot init container fails with
      permission errors:

      ```shell theme={null}
      mkdir -p "${ARC_HOME:-$HOME/.arc}"
      ```

      ## Step 3: Download the Compose file

      Fetch the `docker-compose.yml` for your release into a working directory:

      ```shell theme={null}
      curl -O https://raw.githubusercontent.com/circlefin/arc-node/v${ARC_VERSION}/deployments/docker-compose.yml
      ```

      ## Step 4: Start the node

      From the directory containing `docker-compose.yml`:

      ```shell theme={null}
      docker compose up -d
      ```

      On the first run, init containers automatically:

      1. Download the latest testnet snapshots (approximately 84 GB compressed; see
         [snapshot download size](/arc/references/node-requirements#snapshot-download-size))
      2. Initialize the consensus layer private key
      3. Prepare the shared IPC socket volume

      Subsequent runs detect that initialization is already complete and start
      immediately. The init container runs as `root` so it can set file ownership for
      the EL and CL services (UID 999). No manual `chown` is needed.

      ## Step 5: Verify the node is syncing

      On the first run, wait for the snapshot init container to finish:

      ```shell theme={null}
      docker compose logs -f arc-snapshots
      ```

      Once the EL and CL containers are up, wait roughly 30 seconds, then query the
      latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the logs:

      ```shell theme={null}
      docker compose logs -f
      ```

      The containers expose Prometheus metrics on the host at `localhost:9001/`
      (Execution Layer, root path) and `localhost:29000/metrics` (Consensus Layer). To
      scrape these endpoints with a local stack, see
      [Set up Prometheus and Grafana for an Arc node](/arc/tutorials/set-up-node-monitoring).

      ## Step 6: Stop and reset

      To stop the node while preserving data:

      ```shell theme={null}
      docker compose down
      ```

      Node data persists in `~/.arc/` (or the path set by `$ARC_HOME`). To remove all
      data and start fresh:

      ```shell theme={null}
      docker compose down -v
      rm -rf ~/.arc
      ```

      <Warning>
        `docker compose down -v` removes the named sockets volume, and `rm -rf ~/.arc`
        permanently deletes the consensus layer private key, which is your node's
        network identity and can't be recovered.
      </Warning>
    </Tab>
  </Tabs>

  ## Run on separate hosts

  The preceding tabs describe running the Execution Layer and Consensus Layer on
  the same host, communicating through IPC sockets. To run them on separate hosts,
  swap IPC for authenticated RPC. This section applies to the binary install paths
  (`arcup` and source build); the Docker path is single-host by default.

  <Warning>
    The RPC/HTTP transport between the Consensus Layer and Execution Layer is
    deprecated in v0.8.0 and will be removed in v0.9.0. IPC is the recommended
    transport for single-host deployments. Multi-host deployments should plan to
    migrate before v0.9.0.
  </Warning>

  ### Generate a JWT secret

  The EL and CL authenticate to each other with a shared JWT secret. Generate it
  once, then securely copy it to both hosts:

  ```shell theme={null}
  openssl rand -hex 32 | tr -d "\n" > "$ARC_HOME/jwtsecret"
  chmod 600 "$ARC_HOME/jwtsecret"
  ```

  ### Execution layer flags for RPC mode

  Remove the IPC flags (`--ipcpath`, `--auth-ipc`, `--auth-ipc.path`) from the EL
  command and add:

  ```shell theme={null}
  --authrpc.addr 0.0.0.0 \
  --authrpc.port 8551 \
  --authrpc.jwtsecret "$ARC_HOME/jwtsecret"
  ```

  <Warning>
    `--authrpc.addr 0.0.0.0` exposes port 8551 on every network interface. Restrict
    access with a firewall rule or private network—the Engine API controls block
    production and must not be reachable from the public internet.
  </Warning>

  ### Consensus layer flags for RPC mode

  Remove `--eth-socket` and `--execution-socket` from the CL command, and add:

  ```shell theme={null}
  --eth-rpc-endpoint http://<EL_HOST>:8545 \
  --execution-endpoint http://<EL_HOST>:8551 \
  --execution-jwt "$ARC_HOME/jwtsecret"
  ```

  Replace `<EL_HOST>` with the IP address or `hostname` of the EL host.

  <Note>
    IPC and RPC are mutually exclusive. Use one or the other, not both.
  </Note>

  ## Tune backpressure

  The preceding tabs start the Consensus Layer with backpressure enabled at the
  default threshold (`16`). Backpressure throttles execution to match the speed of
  disk writes, bounding Execution Layer memory growth during startup or extended
  sync when the node is far behind.

  If you observe sustained memory pressure on a host that meets the
  [node requirements](/arc/references/node-requirements), restart the Consensus
  Layer with a lower threshold:

  ```shell theme={null}
  --execution-persistence-backpressure \
  --execution-persistence-backpressure-threshold=10
  ```

  ## Migrate to V2 storage

  v0.8.0 upgrades Reth to v2.2.0, which introduces a V2 on-disk storage layout for
  the Execution Layer. **Migration is not required for v0.8.0 but will be required
  for v0.9.0.** Migrating now is recommended so the next upgrade does not require
  it.

  **Fresh installs** bootstrapped from the Circle-provided snapshots are already
  in V2 format. No migration is needed.

  **Upgrading from v0.7.x** requires either restoring from a V2 snapshot (the
  simplest path) or migrating the existing `datadir` in place:

  * Restoring from a V2 snapshot: stop the node, clear `$ARC_EXECUTION`, and
    re-run the snapshot download steps in this guide.
  * Migrating in place: use `arc-node-execution db migrate-v2` as described in the
    following section.

  ### Migrate in place

  1. Stop the CL first, then stop the EL. Note the current head block number.

  2. Run the migration. `--datadir` must precede `migrate-v2`:

     ```shell theme={null}
     arc-node-execution db \
       --datadir "$ARC_EXECUTION" \
       --chain arc-mainnet \
       migrate-v2
     ```

     Pass `--chain arc-testnet` if your node is on testnet. A successful run exits
     with
     `Migration complete. You should now restart the node and let it run the pipeline to rebuild the remaining data.`

  3. Restart the EL alone (keep the CL stopped) with the pruning flag that matches
     your `datadir` (`--full`, `--minimal`, or omit for archive). Using the wrong
     flag causes a rebuild failure:

     ```shell theme={null}
     arc-node-execution node \
       --chain arc-mainnet \
       --datadir "$ARC_EXECUTION" \
       --full \
       --disable-discovery \
       --http \
       --http.api eth,net,web3,txpool,trace,debug
     ```

     The node rebuilds index tables cleared during migration. Wait until it
     returns to the head block number you noted in step 1.

  4. Verify the rebuilt node is at tip (`eth_syncing` returns `false`) and that
     re-running `migrate-v2` is a no-op (`Storage is already v2, nothing to do`).

  5. Start the CL and confirm live execution resumes.

  If the migration fails and you need to roll back, restore from a v0.7.x
  snapshot.
</View>

<View title="v0.7.3" icon="tag">
  <Warning>
    **v0.7.3 is outdated.** Testnet operators must upgrade to v0.8.0 before
    timestamp `1788447600` (2026-09-03 15:00:00 UTC), and mainnet operators before
    timestamp `1789052400` (2026-09-10 15:00:00 UTC). Use the v0.8.0 view for
    current setup instructions and migration details.
  </Warning>

  An Arc node syncs blocks from the network and serves a local JSON-RPC endpoint
  so you can independently verify every block and transaction. It runs two
  processes: the Execution Layer (EL), which executes transactions and maintains
  state, and the Consensus Layer (CL), which fetches finalized blocks from relay
  endpoints (trusted HTTP servers that distribute signed block data), verifies
  their signatures, and passes them to the EL. For a deeper explanation of how
  these components fit together, see
  [Running a node](/arc/concepts/running-a-node).

  Choose the install path that fits your environment.

  <Tabs>
    <Tab title="arcup">
      Install pre-built Arc binaries using the `arcup` script. This is the fastest
      path and requires no Rust toolchain or build dependencies.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux or macOS machine that meets the minimum system requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install with `arcup`

      `arcup` installs the Arc binaries under `$ARC_HOME` (default `~/.arc`). Export
      `ARC_HOME` first if you want to install somewhere else; otherwise the default
      applies for both the installer and the environment file:

      ```shell theme={null}
      export ARC_HOME="${ARC_HOME:-$HOME/.arc}"
      curl -L https://raw.githubusercontent.com/circlefin/arc-node/main/arcup/install | bash
      ```

      The installer places `arc-node-execution`, `arc-node-consensus`,
      `arc-snapshots`, and `arcup` itself into `$ARC_HOME/bin`. Load the produced
      environment file so the binaries are on your `PATH`:

      ```shell theme={null}
      source "$ARC_HOME/env"
      ```

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      Each command prints a version string. To update the binaries later, run `arcup`.

      ## Step 2: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 3: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 4: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 5: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 6: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |
      | `--rpc.max-connections` | Recommended for public-facing nodes | Maximum concurrent RPC connections. Default `250` (lowered from `500` in v0.7.1). Raise only if clients see `MaxConnections` errors |
      | `--rpc.max-subscriptions-per-connection` | Recommended for public-facing nodes | Maximum subscriptions per single WebSocket connection. Default `32` (lowered from `1024` in v0.7.1). Raise only if clients see `TooManySubscriptions` errors |

      On high-traffic public endpoints, raise `--rpc.max-connections` (default 250)
      and `--rpc.max-subscriptions-per-connection` (default 32) if clients see
      `MaxConnections` or `TooManySubscriptions` errors. The defaults bound WebSocket
      log-fanout memory growth and should only be raised, not lowered.

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. `--chain arc-testnet` uses the bundled
        genesis configuration; replace with `--chain /path/to/genesis.json` if you have
        a custom genesis file. See [reth node](https://reth.rs/cli/reth/node/) for
        additional flags.
      </Note>

      ## Step 7: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 8: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are missing after 30 seconds, the EL
        did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Build from source">
      Build Arc binaries from the [`arc-node`](https://github.com/circlefin/arc-node)
      repository. Use this path to audit the build, run on an unsupported platform, or
      pin to a specific commit.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux, macOS, or Windows machine that meets the minimum system
        requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install build dependencies

      Install [Rust](https://rust-lang.org/tools/install/) if you don't have it:

      ```shell theme={null}
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
      source ~/.cargo/env
      ```

      Install the platform packages required to build the EL database bindings:

      * **Ubuntu:** `sudo apt-get install libclang-dev pkg-config build-essential`
      * **macOS:** `brew install llvm pkg-config`, then
        `export LIBCLANG_PATH="$(brew --prefix llvm)/lib"`
      * **Windows:** `choco install llvm` or `winget install LLVM.LLVM`

      ## Step 2: Clone the repository

      Clone the [`arc-node`](https://github.com/circlefin/arc-node) repository and
      check out the version for your target network. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      git clone https://github.com/circlefin/arc-node.git
      cd arc-node
      git checkout v0.7.3
      git submodule update --init --recursive
      ```

      ## Step 3: Build and install

      The following commands build three Arc node binaries: `arc-node-execution`,
      `arc-node-consensus`, and `arc-snapshots`:

      ```shell theme={null}
      cargo install --path crates/node
      cargo install --path crates/malachite-app
      cargo install --path crates/snapshots
      ```

      `cargo install` places compiled binaries into `~/.cargo/bin`, which is added to
      `PATH` by loading `~/.cargo/env`. To install elsewhere, add `--root $BASE_DIR`
      to each command (for instance, `--root /usr/local` places them under
      `/usr/local/bin`).

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      ## Step 4: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 5: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 6: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 7: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 8: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |
      | `--rpc.max-connections` | Recommended for public-facing nodes | Maximum concurrent RPC connections. Default `250` (lowered from `500` in v0.7.1). Raise only if clients see `MaxConnections` errors |
      | `--rpc.max-subscriptions-per-connection` | Recommended for public-facing nodes | Maximum subscriptions per single WebSocket connection. Default `32` (lowered from `1024` in v0.7.1). Raise only if clients see `TooManySubscriptions` errors |

      On high-traffic public endpoints, raise `--rpc.max-connections` (default 250)
      and `--rpc.max-subscriptions-per-connection` (default 32) if clients see
      `MaxConnections` or `TooManySubscriptions` errors. The defaults bound WebSocket
      log-fanout memory growth and should only be raised, not lowered.

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. `--chain arc-testnet` uses the bundled
        genesis configuration; replace with `--chain /path/to/genesis.json` if you have
        a custom genesis file. See [reth node](https://reth.rs/cli/reth/node/) for
        additional flags.
      </Note>

      ## Step 9: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 10: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are missing after 30 seconds, the EL
        did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Docker">
      Run the Arc node from pre-built Docker images using Docker Compose. Init
      containers handle snapshot download and CL initialization on the first run.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux machine that meets the minimum system requirements
      * Installed
        [Docker Engine 24+ with BuildKit](https://docs.docker.com/engine/install/) and
        [Docker Compose v2](https://docs.docker.com/compose/install/)

      ## Step 1: Set environment variables

      The Compose file reads images from environment variables. Set the version, data
      directory, and image references. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      export ARC_VERSION=0.7.3
      export ARC_HOME=~/.arc
      export ARC_EXECUTION_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-execution:$ARC_VERSION
      export ARC_CONSENSUS_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-consensus:$ARC_VERSION
      ```

      To build images locally instead of pulling from Cloudsmith, see
      [Installation: Docker](https://github.com/circlefin/arc-node/blob/main/docs/installation.md#docker)
      in the `arc-node` repository.

      ## Step 2: Prepare the data directory

      Create `$ARC_HOME` on the host before starting Docker Compose. If you skip this,
      Docker creates it as `root` and the snapshot init container fails with
      permission errors:

      ```shell theme={null}
      mkdir -p "${ARC_HOME:-$HOME/.arc}"
      ```

      ## Step 3: Download the Compose file

      Fetch the `docker-compose.yml` for your release into a working directory:

      ```shell theme={null}
      curl -O https://raw.githubusercontent.com/circlefin/arc-node/v${ARC_VERSION}/deployments/docker-compose.yml
      ```

      ## Step 4: Start the node

      From the directory containing `docker-compose.yml`:

      ```shell theme={null}
      docker compose up -d
      ```

      On the first run, init containers automatically:

      1. Download the latest testnet snapshots (approximately 84 GB compressed; see
         [snapshot download size](/arc/references/node-requirements#snapshot-download-size))
      2. Initialize the consensus layer private key
      3. Prepare the shared IPC socket volume

      Subsequent runs detect that initialization is already complete and start
      immediately. The init container runs as `root` so it can set file ownership for
      the EL and CL services (UID 999). No manual `chown` is needed.

      ## Step 5: Verify the node is syncing

      On the first run, wait for the snapshot init container to finish:

      ```shell theme={null}
      docker compose logs -f arc-snapshots
      ```

      Once the EL and CL containers are up, wait roughly 30 seconds, then query the
      latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the logs:

      ```shell theme={null}
      docker compose logs -f
      ```

      The containers expose Prometheus metrics on the host at `localhost:9001/`
      (Execution Layer, root path) and `localhost:29000/metrics` (Consensus Layer). To
      scrape these endpoints with a local stack, see
      [Set up Prometheus and Grafana for an Arc node](/arc/tutorials/set-up-node-monitoring).

      ## Step 6: Stop and reset

      To stop the node while preserving data:

      ```shell theme={null}
      docker compose down
      ```

      Node data persists in `~/.arc/` (or the path set by `$ARC_HOME`). To remove all
      data and start fresh:

      ```shell theme={null}
      docker compose down -v
      rm -rf ~/.arc
      ```

      <Warning>
        `docker compose down -v` removes the named sockets volume, and `rm -rf ~/.arc`
        permanently deletes the consensus layer private key -- your node's network
        identity. It cannot be recovered.
      </Warning>
    </Tab>
  </Tabs>

  ## Run on separate hosts

  The preceding tabs describe running the Execution Layer and Consensus Layer on
  the same host, communicating through IPC sockets. To run them on separate hosts,
  swap IPC for authenticated RPC. This section applies to the binary install paths
  (`arcup` and source build); the Docker path is single-host by default.

  ### Generate a JWT secret

  The EL and CL authenticate to each other with a shared JWT secret. Generate it
  once, then securely copy it to both hosts:

  ```shell theme={null}
  openssl rand -hex 32 | tr -d "\n" > "$ARC_HOME/jwtsecret"
  chmod 600 "$ARC_HOME/jwtsecret"
  ```

  ### Execution layer flags for RPC mode

  Remove the IPC flags (`--ipcpath`, `--auth-ipc`, `--auth-ipc.path`) from the EL
  command and add:

  ```shell theme={null}
  --authrpc.addr 0.0.0.0 \
  --authrpc.port 8551 \
  --authrpc.jwtsecret "$ARC_HOME/jwtsecret"
  ```

  <Warning>
    `--authrpc.addr 0.0.0.0` exposes port 8551 on every network interface. Restrict
    access with a firewall rule or private network -- the Engine API controls block
    production and must not be reachable from the public internet.
  </Warning>

  ### Consensus layer flags for RPC mode

  Remove `--eth-socket` and `--execution-socket` from the CL command, and add:

  ```shell theme={null}
  --eth-rpc-endpoint http://<EL_HOST>:8545 \
  --execution-endpoint http://<EL_HOST>:8551 \
  --execution-jwt "$ARC_HOME/jwtsecret"
  ```

  Replace `<EL_HOST>` with the IP address or hostname of the EL host.

  <Note>
    IPC and RPC are mutually exclusive. Use one or the other, not both.
  </Note>

  ## Enable backpressure under memory pressure

  The preceding tabs start the Consensus Layer with backpressure enabled at the
  default threshold (`16`). Backpressure throttles execution to match the speed of
  disk writes, bounding Execution Layer memory growth during startup or extended
  sync when the node is far behind.

  If you observe sustained memory pressure on a host that meets the
  [node requirements](/arc/references/node-requirements), lower the threshold to
  `10` for more aggressive throttling. First, add the `reth` namespace to the EL
  `--http.api` flag so the CL can read backpressure metrics:

  ```shell theme={null}
  --http.api eth,net,web3,txpool,trace,debug,reth
  ```

  Then restart the CL with the lower threshold:

  ```shell theme={null}
  --execution-persistence-backpressure \
  --execution-persistence-backpressure-threshold=10
  ```
</View>

<View title="v0.7.2" icon="tag">
  <Info>
    **v0.7.2: Arc Testnet hardfork activates 2026-06-18 14:00:00 UTC.** The Zero7
    hardfork activates at Unix timestamp `1781791200`. Testnet nodes must be on
    v0.7.2 by that timestamp; earlier versions stop syncing after activation. For
    the full upgrade notes, see
    [CHANGELOG.md](https://github.com/circlefin/arc-node/blob/main/CHANGELOG.md) and
    [BREAKING\_CHANGES.md](https://github.com/circlefin/arc-node/blob/main/BREAKING_CHANGES.md#v072).
  </Info>

  An Arc node syncs blocks from the network and serves a local JSON-RPC endpoint
  so you can independently verify every block and transaction. It runs two
  processes: the Execution Layer (EL), which executes transactions and maintains
  state, and the Consensus Layer (CL), which fetches finalized blocks from relay
  endpoints (trusted HTTP servers that distribute signed block data), verifies
  their signatures, and passes them to the EL. For a deeper explanation of how
  these components fit together, see
  [Running a node](/arc/concepts/running-a-node).

  Choose the install path that fits your environment.

  <Tabs>
    <Tab title="arcup">
      Install pre-built Arc binaries using the `arcup` script. This is the fastest
      path and requires no Rust toolchain or build dependencies.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux or macOS machine that meets the minimum system requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install with `arcup`

      `arcup` installs the Arc binaries under `$ARC_HOME` (default `~/.arc`). Export
      `ARC_HOME` first if you want to install somewhere else; otherwise the default
      applies for both the installer and the environment file:

      ```shell theme={null}
      export ARC_HOME="${ARC_HOME:-$HOME/.arc}"
      curl -L https://raw.githubusercontent.com/circlefin/arc-node/main/arcup/install | bash
      ```

      The installer places `arc-node-execution`, `arc-node-consensus`,
      `arc-snapshots`, and `arcup` itself into `$ARC_HOME/bin`. Load the produced
      environment file so the binaries are on your `PATH`:

      ```shell theme={null}
      source "$ARC_HOME/env"
      ```

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      Each command prints a version string. To update the binaries later, run `arcup`.

      ## Step 2: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 3: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 4: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 5: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 6: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |
      | `--rpc.max-connections` | Recommended for public-facing nodes | Maximum concurrent RPC connections. Default `250` (lowered from `500` in v0.7.1). Raise only if clients see `MaxConnections` errors |
      | `--rpc.max-subscriptions-per-connection` | Recommended for public-facing nodes | Maximum subscriptions per single WebSocket connection. Default `32` (lowered from `1024` in v0.7.1). Raise only if clients see `TooManySubscriptions` errors |

      On high-traffic public endpoints, raise `--rpc.max-connections` (default 250)
      and `--rpc.max-subscriptions-per-connection` (default 32) if clients see
      `MaxConnections` or `TooManySubscriptions` errors. The defaults bound WebSocket
      log-fanout memory growth and should only be raised, not lowered.

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. `--chain arc-testnet` uses the bundled
        genesis configuration; replace with `--chain /path/to/genesis.json` if you have
        a custom genesis file. See [reth node](https://reth.rs/cli/reth/node/) for
        additional flags.
      </Note>

      ## Step 7: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 8: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are not present after 30 seconds, the
        EL did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Build from source">
      Build Arc binaries from the [`arc-node`](https://github.com/circlefin/arc-node)
      repository. Use this path to audit the build, run on an unsupported platform, or
      pin to a specific commit.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux, macOS, or Windows machine that meets the minimum system
        requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install build dependencies

      Install [Rust](https://rust-lang.org/tools/install/) if you don't have it:

      ```shell theme={null}
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
      source ~/.cargo/env
      ```

      Install the platform packages required to build the EL database bindings:

      * **Ubuntu:** `sudo apt-get install libclang-dev pkg-config build-essential`
      * **macOS:** `brew install llvm pkg-config`, then
        `export LIBCLANG_PATH="$(brew --prefix llvm)/lib"`
      * **Windows:** `choco install llvm` or `winget install LLVM.LLVM`

      ## Step 2: Clone the repository

      Clone the [`arc-node`](https://github.com/circlefin/arc-node) repository and
      check out the version for your target network. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      git clone https://github.com/circlefin/arc-node.git
      cd arc-node
      git checkout v0.7.2
      git submodule update --init --recursive
      ```

      ## Step 3: Build and install

      The following commands build three Arc node binaries: `arc-node-execution`,
      `arc-node-consensus`, and `arc-snapshots`:

      ```shell theme={null}
      cargo install --path crates/node
      cargo install --path crates/malachite-app
      cargo install --path crates/snapshots
      ```

      `cargo install` places compiled binaries into `~/.cargo/bin`, which is added to
      `PATH` by loading `~/.cargo/env`. To install elsewhere, add `--root $BASE_DIR`
      to each command (for instance, `--root /usr/local` places them under
      `/usr/local/bin`).

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      ## Step 4: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 5: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 6: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 7: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 8: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |
      | `--rpc.max-connections` | Recommended for public-facing nodes | Maximum concurrent RPC connections. Default `250` (lowered from `500` in v0.7.1). Raise only if clients see `MaxConnections` errors |
      | `--rpc.max-subscriptions-per-connection` | Recommended for public-facing nodes | Maximum subscriptions per single WebSocket connection. Default `32` (lowered from `1024` in v0.7.1). Raise only if clients see `TooManySubscriptions` errors |

      On high-traffic public endpoints, raise `--rpc.max-connections` (default 250)
      and `--rpc.max-subscriptions-per-connection` (default 32) if clients see
      `MaxConnections` or `TooManySubscriptions` errors. The defaults bound WebSocket
      log-fanout memory growth and should only be raised, not lowered.

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. `--chain arc-testnet` uses the bundled
        genesis configuration; replace with `--chain /path/to/genesis.json` if you have
        a custom genesis file. See [reth node](https://reth.rs/cli/reth/node/) for
        additional flags.
      </Note>

      ## Step 9: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 10: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are not present after 30 seconds, the
        EL did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Docker">
      Run the Arc node from pre-built Docker images using Docker Compose. Init
      containers handle snapshot download and CL initialization on the first run.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux machine that meets the minimum system requirements
      * Installed
        [Docker Engine 24+ with BuildKit](https://docs.docker.com/engine/install/) and
        [Docker Compose v2](https://docs.docker.com/compose/install/)

      ## Step 1: Set environment variables

      The Compose file reads images from environment variables. Set the version, data
      directory, and image references. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      export ARC_VERSION=0.7.2
      export ARC_HOME=~/.arc
      export ARC_EXECUTION_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-execution:$ARC_VERSION
      export ARC_CONSENSUS_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-consensus:$ARC_VERSION
      ```

      To build images locally instead of pulling from Cloudsmith, see
      [Installation: Docker](https://github.com/circlefin/arc-node/blob/main/docs/installation.md#docker)
      in the `arc-node` repository.

      ## Step 2: Prepare the data directory

      Create `$ARC_HOME` on the host before starting Docker Compose. If you skip this,
      Docker creates it as `root` and the snapshot init container fails with
      permission errors:

      ```shell theme={null}
      mkdir -p "${ARC_HOME:-$HOME/.arc}"
      ```

      ## Step 3: Download the Compose file

      Fetch the `docker-compose.yml` for your release into a working directory:

      ```shell theme={null}
      curl -O https://raw.githubusercontent.com/circlefin/arc-node/v${ARC_VERSION}/deployments/docker-compose.yml
      ```

      ## Step 4: Start the node

      From the directory containing `docker-compose.yml`:

      ```shell theme={null}
      docker compose up -d
      ```

      On the first run, init containers automatically:

      1. Download the latest testnet snapshots (approximately 84 GB compressed; see
         [snapshot download size](/arc/references/node-requirements#snapshot-download-size))
      2. Initialize the consensus layer private key
      3. Prepare the shared IPC socket volume

      Subsequent runs detect that initialization is already complete and start
      immediately. The init container runs as `root` so it can set file ownership for
      the EL and CL services (UID 999). No manual `chown` is needed.

      ## Step 5: Verify the node is syncing

      On the first run, wait for the snapshot init container to finish:

      ```shell theme={null}
      docker compose logs -f arc-snapshots
      ```

      Once the EL and CL containers are up, wait roughly 30 seconds, then query the
      latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the logs:

      ```shell theme={null}
      docker compose logs -f
      ```

      The containers expose Prometheus metrics on the host at `localhost:9001/`
      (Execution Layer, root path) and `localhost:29000/metrics` (Consensus Layer). To
      scrape these endpoints with a local stack, see
      [Set up Prometheus and Grafana for an Arc node](/arc/tutorials/set-up-node-monitoring).

      ## Step 6: Stop and reset

      To stop the node while preserving data:

      ```shell theme={null}
      docker compose down
      ```

      Node data persists in `~/.arc/` (or the path set by `$ARC_HOME`). To remove all
      data and start fresh:

      ```shell theme={null}
      docker compose down -v
      rm -rf ~/.arc
      ```

      <Warning>
        `docker compose down -v` removes the named sockets volume, and `rm -rf ~/.arc`
        permanently deletes the consensus layer private key -- your node's network
        identity. It cannot be recovered.
      </Warning>
    </Tab>
  </Tabs>

  ## Run on separate hosts

  The tabs above describe running the Execution Layer and Consensus Layer on the
  same host, communicating through IPC sockets. To run them on separate hosts,
  swap IPC for authenticated RPC. This section applies to the binary install paths
  (`arcup` and source build); the Docker path is single-host by default.

  ### Generate a JWT secret

  The EL and CL authenticate to each other with a shared JWT secret. Generate it
  once, then securely copy it to both hosts:

  ```shell theme={null}
  openssl rand -hex 32 | tr -d "\n" > "$ARC_HOME/jwtsecret"
  chmod 600 "$ARC_HOME/jwtsecret"
  ```

  ### Execution layer flags for RPC mode

  Remove the IPC flags (`--ipcpath`, `--auth-ipc`, `--auth-ipc.path`) from the EL
  command and add:

  ```shell theme={null}
  --authrpc.addr 0.0.0.0 \
  --authrpc.port 8551 \
  --authrpc.jwtsecret "$ARC_HOME/jwtsecret"
  ```

  <Warning>
    `--authrpc.addr 0.0.0.0` exposes port 8551 on every network interface. Restrict
    access with a firewall rule or private network -- the Engine API controls block
    production and must not be reachable from the public internet.
  </Warning>

  ### Consensus layer flags for RPC mode

  Remove `--eth-socket` and `--execution-socket` from the CL command, and add:

  ```shell theme={null}
  --eth-rpc-endpoint http://<EL_HOST>:8545 \
  --execution-endpoint http://<EL_HOST>:8551 \
  --execution-jwt "$ARC_HOME/jwtsecret"
  ```

  Replace `<EL_HOST>` with the IP address or hostname of the EL host.

  <Note>
    IPC and RPC are mutually exclusive. Use one or the other, not both.
  </Note>

  ## Enable backpressure under memory pressure

  The tabs above start the Consensus Layer with backpressure enabled at the
  default threshold (`16`). Backpressure throttles execution to match the speed of
  disk writes, bounding Execution Layer memory growth during startup or extended
  sync when the node is far behind.

  If you observe sustained memory pressure on a host that meets the
  [node requirements](/arc/references/node-requirements), lower the threshold to
  `10` for more aggressive throttling. First, add the `reth` namespace to the EL
  `--http.api` flag so the CL can read backpressure metrics:

  ```shell theme={null}
  --http.api eth,net,web3,txpool,trace,debug,reth
  ```

  Then restart the CL with the lower threshold:

  ```shell theme={null}
  --execution-persistence-backpressure \
  --execution-persistence-backpressure-threshold=10
  ```
</View>

<View title="v0.7.1" icon="tag">
  <Info>
    **v0.7.1: Arc Testnet hardfork activates 2026-05-27 15:08:37 UTC.** The Zero5
    and Zero6 hardforks activate at Unix timestamp `1779894517`. Testnet nodes must
    be on v0.7.1 by that timestamp; earlier versions stop syncing after activation.
    This release also tightens two Execution Layer RPC defaults
    (`--rpc.max-connections` and `--rpc.max-subscriptions-per-connection`). See
    [Step 6](#step-6-start-the-execution-layer) for guidance on raising them. For
    the full upgrade notes, see
    [CHANGELOG.md](https://github.com/circlefin/arc-node/blob/main/CHANGELOG.md) and
    [BREAKING\_CHANGES.md](https://github.com/circlefin/arc-node/blob/main/BREAKING_CHANGES.md#v071).
  </Info>

  An Arc node syncs blocks from the network and serves a local JSON-RPC endpoint
  so you can independently verify every block and transaction. It runs two
  processes: the Execution Layer (EL), which executes transactions and maintains
  state, and the Consensus Layer (CL), which fetches finalized blocks from relay
  endpoints (trusted HTTP servers that distribute signed block data), verifies
  their signatures, and passes them to the EL. For a deeper explanation of how
  these components fit together, see
  [Running a node](/arc/concepts/running-a-node).

  Choose the install path that fits your environment.

  <Tabs>
    <Tab title="arcup">
      Install pre-built Arc binaries using the `arcup` script. This is the fastest
      path and requires no Rust toolchain or build dependencies.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux or macOS machine that meets the minimum system requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install with `arcup`

      `arcup` installs the Arc binaries under `$ARC_HOME` (default `~/.arc`). Export
      `ARC_HOME` first if you want to install somewhere else; otherwise the default
      applies for both the installer and the environment file:

      ```shell theme={null}
      export ARC_HOME="${ARC_HOME:-$HOME/.arc}"
      curl -L https://raw.githubusercontent.com/circlefin/arc-node/main/arcup/install | bash
      ```

      The installer places `arc-node-execution`, `arc-node-consensus`,
      `arc-snapshots`, and `arcup` itself into `$ARC_HOME/bin`. Load the produced
      environment file so the binaries are on your `PATH`:

      ```shell theme={null}
      source "$ARC_HOME/env"
      ```

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      Each command prints a version string. To update the binaries later, run `arcup`.

      ## Step 2: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 3: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 4: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 5: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 6: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |
      | `--rpc.max-connections` | Recommended for public-facing nodes | Maximum concurrent RPC connections. Default `250` (lowered from `500` in v0.7.1). Raise only if clients see `MaxConnections` errors |
      | `--rpc.max-subscriptions-per-connection` | Recommended for public-facing nodes | Maximum subscriptions per single WebSocket connection. Default `32` (lowered from `1024` in v0.7.1). Raise only if clients see `TooManySubscriptions` errors |

      On high-traffic public endpoints, raise `--rpc.max-connections` (default 250)
      and `--rpc.max-subscriptions-per-connection` (default 32) if clients see
      `MaxConnections` or `TooManySubscriptions` errors. The defaults bound WebSocket
      log-fanout memory growth and should only be raised, not lowered.

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. `--chain arc-testnet` uses the bundled
        genesis configuration; replace with `--chain /path/to/genesis.json` if you have
        a custom genesis file. See [reth node](https://reth.rs/cli/reth/node/) for
        additional flags.
      </Note>

      ## Step 7: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 8: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are not present after 30 seconds, the
        EL did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Build from source">
      Build Arc binaries from the [`arc-node`](https://github.com/circlefin/arc-node)
      repository. Use this path to audit the build, run on an unsupported platform, or
      pin to a specific commit.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux, macOS, or Windows machine that meets the minimum system
        requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install build dependencies

      Install [Rust](https://rust-lang.org/tools/install/) if you don't have it:

      ```shell theme={null}
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
      source ~/.cargo/env
      ```

      Install the platform packages required to build the EL database bindings:

      * **Ubuntu:** `sudo apt-get install libclang-dev pkg-config build-essential`
      * **macOS:** `brew install llvm pkg-config`, then
        `export LIBCLANG_PATH="$(brew --prefix llvm)/lib"`
      * **Windows:** `choco install llvm` or `winget install LLVM.LLVM`

      ## Step 2: Clone the repository

      Clone the [`arc-node`](https://github.com/circlefin/arc-node) repository and
      check out the version for your target network. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      git clone https://github.com/circlefin/arc-node.git
      cd arc-node
      git checkout v0.7.1
      git submodule update --init --recursive
      ```

      ## Step 3: Build and install

      The following commands build three Arc node binaries: `arc-node-execution`,
      `arc-node-consensus`, and `arc-snapshots`:

      ```shell theme={null}
      cargo install --path crates/node
      cargo install --path crates/malachite-app
      cargo install --path crates/snapshots
      ```

      `cargo install` places compiled binaries into `~/.cargo/bin`, which is added to
      `PATH` by loading `~/.cargo/env`. To install elsewhere, add `--root $BASE_DIR`
      to each command (for instance, `--root /usr/local` places them under
      `/usr/local/bin`).

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      ## Step 4: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 5: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 6: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 7: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 8: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |
      | `--rpc.max-connections` | Recommended for public-facing nodes | Maximum concurrent RPC connections. Default `250` (lowered from `500` in v0.7.1). Raise only if clients see `MaxConnections` errors |
      | `--rpc.max-subscriptions-per-connection` | Recommended for public-facing nodes | Maximum subscriptions per single WebSocket connection. Default `32` (lowered from `1024` in v0.7.1). Raise only if clients see `TooManySubscriptions` errors |

      On high-traffic public endpoints, raise `--rpc.max-connections` (default 250)
      and `--rpc.max-subscriptions-per-connection` (default 32) if clients see
      `MaxConnections` or `TooManySubscriptions` errors. The defaults bound WebSocket
      log-fanout memory growth and should only be raised, not lowered.

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. `--chain arc-testnet` uses the bundled
        genesis configuration; replace with `--chain /path/to/genesis.json` if you have
        a custom genesis file. See [reth node](https://reth.rs/cli/reth/node/) for
        additional flags.
      </Note>

      ## Step 9: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 10: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are not present after 30 seconds, the
        EL did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Docker">
      Run the Arc node from pre-built Docker images using Docker Compose. Init
      containers handle snapshot download and CL initialization on the first run.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux machine that meets the minimum system requirements
      * Installed
        [Docker Engine 24+ with BuildKit](https://docs.docker.com/engine/install/) and
        [Docker Compose v2](https://docs.docker.com/compose/install/)

      ## Step 1: Set environment variables

      The Compose file reads images from environment variables. Set the version, data
      directory, and image references. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      export ARC_VERSION=0.7.1
      export ARC_HOME=~/.arc
      export ARC_EXECUTION_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-execution:$ARC_VERSION
      export ARC_CONSENSUS_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-consensus:$ARC_VERSION
      ```

      To build images locally instead of pulling from Cloudsmith, see
      [Installation: Docker](https://github.com/circlefin/arc-node/blob/main/docs/installation.md#docker)
      in the `arc-node` repository.

      ## Step 2: Prepare the data directory

      Create `$ARC_HOME` on the host before starting Docker Compose. If you skip this,
      Docker creates it as `root` and the snapshot init container fails with
      permission errors:

      ```shell theme={null}
      mkdir -p "${ARC_HOME:-$HOME/.arc}"
      ```

      ## Step 3: Download the Compose file

      Fetch the `docker-compose.yml` for your release into a working directory:

      ```shell theme={null}
      curl -O https://raw.githubusercontent.com/circlefin/arc-node/v${ARC_VERSION}/deployments/docker-compose.yml
      ```

      ## Step 4: Start the node

      From the directory containing `docker-compose.yml`:

      ```shell theme={null}
      docker compose up -d
      ```

      On the first run, init containers automatically:

      1. Download the latest testnet snapshots (approximately 84 GB compressed; see
         [snapshot download size](/arc/references/node-requirements#snapshot-download-size))
      2. Initialize the consensus layer private key
      3. Prepare the shared IPC socket volume

      Subsequent runs detect that initialization is already complete and start
      immediately. The init container runs as `root` so it can set file ownership for
      the EL and CL services (UID 999). No manual `chown` is needed.

      ## Step 5: Verify the node is syncing

      On the first run, wait for the snapshot init container to finish:

      ```shell theme={null}
      docker compose logs -f arc-snapshots
      ```

      Once the EL and CL containers are up, wait roughly 30 seconds, then query the
      latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the logs:

      ```shell theme={null}
      docker compose logs -f
      ```

      The containers expose Prometheus metrics on the host at `localhost:9001/`
      (Execution Layer, root path) and `localhost:29000/metrics` (Consensus Layer). To
      scrape these endpoints with a local stack, see
      [Set up Prometheus and Grafana for an Arc node](/arc/tutorials/set-up-node-monitoring).

      ## Step 6: Stop and reset

      To stop the node while preserving data:

      ```shell theme={null}
      docker compose down
      ```

      Node data persists in `~/.arc/` (or the path set by `$ARC_HOME`). To remove all
      data and start fresh:

      ```shell theme={null}
      docker compose down -v
      rm -rf ~/.arc
      ```

      <Warning>
        `docker compose down -v` removes the named sockets volume, and `rm -rf ~/.arc`
        permanently deletes the consensus layer private key -- your node's network
        identity. It cannot be recovered.
      </Warning>
    </Tab>
  </Tabs>

  ## Run on separate hosts

  The tabs above describe running the Execution Layer and Consensus Layer on the
  same host, communicating through IPC sockets. To run them on separate hosts,
  swap IPC for authenticated RPC. This section applies to the binary install paths
  (`arcup` and source build); the Docker path is single-host by default.

  ### Generate a JWT secret

  The EL and CL authenticate to each other with a shared JWT secret. Generate it
  once, then securely copy it to both hosts:

  ```shell theme={null}
  openssl rand -hex 32 | tr -d "\n" > "$ARC_HOME/jwtsecret"
  chmod 600 "$ARC_HOME/jwtsecret"
  ```

  ### Execution layer flags for RPC mode

  Remove the IPC flags (`--ipcpath`, `--auth-ipc`, `--auth-ipc.path`) from the EL
  command and add:

  ```shell theme={null}
  --authrpc.addr 0.0.0.0 \
  --authrpc.port 8551 \
  --authrpc.jwtsecret "$ARC_HOME/jwtsecret"
  ```

  <Warning>
    `--authrpc.addr 0.0.0.0` exposes port 8551 on every network interface. Restrict
    access with a firewall rule or private network -- the Engine API controls block
    production and must not be reachable from the public internet.
  </Warning>

  ### Consensus layer flags for RPC mode

  Remove `--eth-socket` and `--execution-socket` from the CL command, and add:

  ```shell theme={null}
  --eth-rpc-endpoint http://<EL_HOST>:8545 \
  --execution-endpoint http://<EL_HOST>:8551 \
  --execution-jwt "$ARC_HOME/jwtsecret"
  ```

  Replace `<EL_HOST>` with the IP address or hostname of the EL host.

  <Note>
    IPC and RPC are mutually exclusive. Use one or the other, not both.
  </Note>

  ## Enable backpressure under memory pressure

  The tabs above start the Consensus Layer with backpressure enabled at the
  default threshold (`16`). Backpressure throttles execution to match the speed of
  disk writes, bounding Execution Layer memory growth during startup or extended
  sync when the node is far behind.

  If you observe sustained memory pressure on a host that meets the
  [node requirements](/arc/references/node-requirements), lower the threshold to
  `10` for more aggressive throttling. First, add the `reth` namespace to the EL
  `--http.api` flag so the CL can read backpressure metrics:

  ```shell theme={null}
  --http.api eth,net,web3,txpool,trace,debug,reth
  ```

  Then restart the CL with the lower threshold:

  ```shell theme={null}
  --execution-persistence-backpressure \
  --execution-persistence-backpressure-threshold=10
  ```
</View>

<View title="v0.7.0" icon="tag">
  <Warning>
    **Upgrade required by 2026-05-27 15:08:37 UTC.** The Zero5 and Zero6 hardforks
    activate at Unix timestamp `1779894517`. v0.7.0 stops syncing on Arc Testnet
    after activation. Switch the view at the top of this page to **v0.7.1 (latest)**
    and follow those instructions before the deadline. See
    [BREAKING\_CHANGES.md](https://github.com/circlefin/arc-node/blob/main/BREAKING_CHANGES.md#v071)
    for migration details.
  </Warning>

  An Arc node syncs blocks from the network and serves a local JSON-RPC endpoint
  so you can independently verify every block and transaction. It runs two
  processes: the Execution Layer (EL), which executes transactions and maintains
  state, and the Consensus Layer (CL), which fetches finalized blocks from relay
  endpoints (trusted HTTP servers that distribute signed block data), verifies
  their signatures, and passes them to the EL. For a deeper explanation of how
  these components fit together, see
  [Running a node](/arc/concepts/running-a-node).

  Choose the install path that fits your environment.

  <Tabs>
    <Tab title="arcup">
      Install pre-built Arc binaries using the `arcup` script. This is the fastest
      path and requires no Rust toolchain or build dependencies.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux or macOS machine that meets the minimum system requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install with `arcup`

      `arcup` installs the Arc binaries under `$ARC_HOME` (default `~/.arc`). Export
      `ARC_HOME` first if you want to install somewhere else; otherwise the default
      applies for both the installer and the environment file:

      ```shell theme={null}
      export ARC_HOME="${ARC_HOME:-$HOME/.arc}"
      curl -L https://raw.githubusercontent.com/circlefin/arc-node/main/arcup/install | bash
      ```

      The installer places `arc-node-execution`, `arc-node-consensus`,
      `arc-snapshots`, and `arcup` itself into `$ARC_HOME/bin`. Load the produced
      environment file so the binaries are on your `PATH`:

      ```shell theme={null}
      source "$ARC_HOME/env"
      ```

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      Each command prints a version string. To update the binaries later, run `arcup`.

      ## Step 2: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 3: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 4: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 5: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 6: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. `--chain arc-testnet` uses the bundled
        genesis configuration; replace with `--chain /path/to/genesis.json` if you have
        a custom genesis file. See [reth node](https://reth.rs/cli/reth/node/) for
        additional flags.
      </Note>

      ## Step 7: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 8: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are not present after 30 seconds, the
        EL did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Build from source">
      Build Arc binaries from the [`arc-node`](https://github.com/circlefin/arc-node)
      repository. Use this path to audit the build, run on an unsupported platform, or
      pin to a specific commit.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux, macOS, or Windows machine that meets the minimum system
        requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install build dependencies

      Install [Rust](https://rust-lang.org/tools/install/) if you don't have it:

      ```shell theme={null}
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
      source ~/.cargo/env
      ```

      Install the platform packages required to build the EL database bindings:

      * **Ubuntu:** `sudo apt-get install libclang-dev pkg-config build-essential`
      * **macOS:** `brew install llvm pkg-config`, then
        `export LIBCLANG_PATH="$(brew --prefix llvm)/lib"`
      * **Windows:** `choco install llvm` or `winget install LLVM.LLVM`

      ## Step 2: Clone the repository

      Clone the [`arc-node`](https://github.com/circlefin/arc-node) repository and
      check out the version for your target network. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      git clone https://github.com/circlefin/arc-node.git
      cd arc-node
      git checkout v0.7.0
      git submodule update --init --recursive
      ```

      ## Step 3: Build and install

      The following commands build three Arc node binaries: `arc-node-execution`,
      `arc-node-consensus`, and `arc-snapshots`:

      ```shell theme={null}
      cargo install --path crates/node
      cargo install --path crates/malachite-app
      cargo install --path crates/snapshots
      ```

      `cargo install` places compiled binaries into `~/.cargo/bin`, which is added to
      `PATH` by loading `~/.cargo/env`. To install elsewhere, add `--root $BASE_DIR`
      to each command (for instance, `--root /usr/local` places them under
      `/usr/local/bin`).

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      ## Step 4: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 5: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 6: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 7: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 8: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --full \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--full` | First start | Required on the first start from a pruned snapshot; optional after |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |
      | `--public-api` | Recommended for public-facing nodes | Hides pending-tx RPCs (a potential MEV vector) and warns if `--http.api` or `--ws.api` exposes namespaces beyond `eth`, `net`, `web3`, `rpc` |

      <Note>
        The `--full` flag is required on the first start when bootstrapping from a
        pruned snapshot. It reconciles internal database tables that would otherwise
        fail a consistency check. After the initial startup completes, restart without
        `--full` if you prefer not to prune. `--chain arc-testnet` uses the bundled
        genesis configuration; replace with `--chain /path/to/genesis.json` if you have
        a custom genesis file. See [reth node](https://reth.rs/cli/reth/node/) for
        additional flags.
      </Note>

      ## Step 9: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --full \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io/websocket \
        --execution-persistence-backpressure \
        --execution-persistence-backpressure-threshold=16 \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--full` | Recommended | Enables CL pruning to bound disk growth |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--execution-persistence-backpressure` | Recommended | Throttles execution to match disk-write speed, bounding EL memory growth |
      | `--execution-persistence-backpressure-threshold` | Recommended | Threshold for backpressure. Default `16` (must be `> 0`). Lower if you observe memory pressure |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 10: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are not present after 30 seconds, the
        EL did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Docker">
      Run the Arc node from pre-built Docker images using Docker Compose. Init
      containers handle snapshot download and CL initialization on the first run.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux machine that meets the minimum system requirements
      * Installed
        [Docker Engine 24+ with BuildKit](https://docs.docker.com/engine/install/) and
        [Docker Compose v2](https://docs.docker.com/compose/install/)

      ## Step 1: Set environment variables

      The Compose file reads images from environment variables. Set the version, data
      directory, and image references. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      export ARC_VERSION=0.7.0
      export ARC_HOME=~/.arc
      export ARC_EXECUTION_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-execution:$ARC_VERSION
      export ARC_CONSENSUS_IMAGE=docker.cloudsmith.io/circle/arc-network/arc-consensus:$ARC_VERSION
      ```

      To build images locally instead of pulling from Cloudsmith, see
      [Installation: Docker](https://github.com/circlefin/arc-node/blob/main/docs/installation.md#docker)
      in the `arc-node` repository.

      ## Step 2: Prepare the data directory

      Create `$ARC_HOME` on the host before starting Docker Compose. If you skip this,
      Docker creates it as `root` and the snapshot init container fails with
      permission errors:

      ```shell theme={null}
      mkdir -p "${ARC_HOME:-$HOME/.arc}"
      ```

      ## Step 3: Download the Compose file

      Fetch the `docker-compose.yml` for your release into a working directory:

      ```shell theme={null}
      curl -O https://raw.githubusercontent.com/circlefin/arc-node/v${ARC_VERSION}/deployments/docker-compose.yml
      ```

      ## Step 4: Start the node

      From the directory containing `docker-compose.yml`:

      ```shell theme={null}
      docker compose up -d
      ```

      On the first run, init containers automatically:

      1. Download the latest testnet snapshots (approximately 84 GB compressed; see
         [snapshot download size](/arc/references/node-requirements#snapshot-download-size))
      2. Initialize the consensus layer private key
      3. Prepare the shared IPC socket volume

      Subsequent runs detect that initialization is already complete and start
      immediately. The init container runs as `root` so it can set file ownership for
      the EL and CL services (UID 999). No manual `chown` is needed.

      ## Step 5: Verify the node is syncing

      On the first run, wait for the snapshot init container to finish:

      ```shell theme={null}
      docker compose logs -f arc-snapshots
      ```

      Once the EL and CL containers are up, wait roughly 30 seconds, then query the
      latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the logs:

      ```shell theme={null}
      docker compose logs -f
      ```

      The containers expose Prometheus metrics on the host at `localhost:9001/`
      (Execution Layer, root path) and `localhost:29000/metrics` (Consensus Layer). To
      scrape these endpoints with a local stack, see
      [Set up Prometheus and Grafana for an Arc node](/arc/tutorials/set-up-node-monitoring).

      ## Step 6: Stop and reset

      To stop the node while preserving data:

      ```shell theme={null}
      docker compose down
      ```

      Node data persists in `~/.arc/` (or the path set by `$ARC_HOME`). To remove all
      data and start fresh:

      ```shell theme={null}
      docker compose down -v
      rm -rf ~/.arc
      ```

      <Warning>
        `docker compose down -v` removes the named sockets volume, and `rm -rf ~/.arc`
        permanently deletes the consensus layer private key -- your node's network
        identity. It cannot be recovered.
      </Warning>
    </Tab>
  </Tabs>

  ## Run on separate hosts

  The tabs above describe running the Execution Layer and Consensus Layer on the
  same host, communicating through IPC sockets. To run them on separate hosts,
  swap IPC for authenticated RPC. This section applies to the binary install paths
  (`arcup` and source build); the Docker path is single-host by default.

  ### Generate a JWT secret

  The EL and CL authenticate to each other with a shared JWT secret. Generate it
  once, then securely copy it to both hosts:

  ```shell theme={null}
  openssl rand -hex 32 | tr -d "\n" > "$ARC_HOME/jwtsecret"
  chmod 600 "$ARC_HOME/jwtsecret"
  ```

  ### Execution layer flags for RPC mode

  Remove the IPC flags (`--ipcpath`, `--auth-ipc`, `--auth-ipc.path`) from the EL
  command and add:

  ```shell theme={null}
  --authrpc.addr 0.0.0.0 \
  --authrpc.port 8551 \
  --authrpc.jwtsecret "$ARC_HOME/jwtsecret"
  ```

  <Warning>
    `--authrpc.addr 0.0.0.0` exposes port 8551 on every network interface. Restrict
    access with a firewall rule or private network -- the Engine API controls block
    production and must not be reachable from the public internet.
  </Warning>

  ### Consensus layer flags for RPC mode

  Remove `--eth-socket` and `--execution-socket` from the CL command, and add:

  ```shell theme={null}
  --eth-rpc-endpoint http://<EL_HOST>:8545 \
  --execution-endpoint http://<EL_HOST>:8551 \
  --execution-jwt "$ARC_HOME/jwtsecret"
  ```

  Replace `<EL_HOST>` with the IP address or hostname of the EL host.

  <Note>
    IPC and RPC are mutually exclusive. Use one or the other, not both.
  </Note>

  ## Enable backpressure under memory pressure

  The tabs above start the Consensus Layer with backpressure enabled at the
  default threshold (`16`). Backpressure throttles execution to match the speed of
  disk writes, bounding Execution Layer memory growth during startup or extended
  sync when the node is far behind.

  If you observe sustained memory pressure on a host that meets the
  [node requirements](/arc/references/node-requirements), lower the threshold to
  `10` for more aggressive throttling. First, add the `reth` namespace to the EL
  `--http.api` flag so the CL can read backpressure metrics:

  ```shell theme={null}
  --http.api eth,net,web3,txpool,trace,debug,reth
  ```

  Then restart the CL with the lower threshold:

  ```shell theme={null}
  --execution-persistence-backpressure \
  --execution-persistence-backpressure-threshold=10
  ```
</View>

<View title="v0.6.0" icon="tag">
  <Warning>
    **Upgrade required by 2026-05-27 15:08:37 UTC.** The Zero5 and Zero6 hardforks
    activate at Unix timestamp `1779894517`. v0.6.0 is two releases behind and stops
    syncing on Arc Testnet after activation. Switch the view at the top of this page
    to **v0.7.1 (latest)** and follow those instructions before the deadline. See
    [BREAKING\_CHANGES.md](https://github.com/circlefin/arc-node/blob/main/BREAKING_CHANGES.md#v071)
    for migration details.
  </Warning>

  An Arc node syncs blocks from the network and serves a local JSON-RPC endpoint
  so you can independently verify every block and transaction. It runs two
  processes: the Execution Layer (EL), which executes transactions and maintains
  state, and the Consensus Layer (CL), which fetches finalized blocks from relay
  endpoints (trusted HTTP servers that distribute signed block data), verifies
  their signatures, and passes them to the EL. For a deeper explanation of how
  these components fit together, see
  [Running a node](/arc/concepts/running-a-node).

  Choose the install path that fits your environment.

  <Note>
    Docker support was added in v0.7.0. Use **v0.7.1 (latest)** for a Docker-based
    install.
  </Note>

  <Tabs>
    <Tab title="arcup">
      Install pre-built Arc binaries using the `arcup` script. This is the fastest
      path and requires no Rust toolchain or build dependencies.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux or macOS machine that meets the minimum system requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install with `arcup`

      `arcup` installs the Arc binaries under `$ARC_HOME` (default `~/.arc`). Export
      `ARC_HOME` first if you want to install somewhere else; otherwise the default
      applies for both the installer and the environment file:

      ```shell theme={null}
      export ARC_HOME="${ARC_HOME:-$HOME/.arc}"
      curl -L https://raw.githubusercontent.com/circlefin/arc-node/main/arcup/install | bash
      ```

      The installer places `arc-node-execution`, `arc-node-consensus`,
      `arc-snapshots`, and `arcup` itself into `$ARC_HOME/bin`. Load the produced
      environment file so the binaries are on your `PATH`:

      ```shell theme={null}
      source "$ARC_HOME/env"
      ```

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      Each command prints a version string. To update the binaries later, run `arcup`.

      ## Step 2: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 3: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 4: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 5: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 6: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |

      <Note>
        `--chain arc-testnet` uses the bundled genesis configuration; replace with
        `--chain /path/to/genesis.json` if you have a custom genesis file. See
        [reth node](https://reth.rs/cli/reth/node/) for additional flags.
      </Note>

      ## Step 7: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 8: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are not present after 30 seconds, the
        EL did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>

    <Tab title="Build from source">
      Build Arc binaries from the [`arc-node`](https://github.com/circlefin/arc-node)
      repository. Use this path to audit the build, run on an unsupported platform, or
      pin to a specific commit.

      ## Prerequisites

      Before you begin, confirm that you have:

      * Reviewed the [node requirements](/arc/references/node-requirements) for
        hardware, software, and network endpoints
      * Prepared a Linux, macOS, or Windows machine that meets the minimum system
        requirements
      * Installed [Foundry](https://book.getfoundry.sh/getting-started/installation)
        (optional, provides the `cast` command used to verify your node)

      ## Step 1: Install build dependencies

      Install [Rust](https://rust-lang.org/tools/install/) if you don't have it:

      ```shell theme={null}
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
      source ~/.cargo/env
      ```

      Install the platform packages required to build the EL database bindings:

      * **Ubuntu:** `sudo apt-get install libclang-dev pkg-config build-essential`
      * **macOS:** `brew install llvm pkg-config`, then
        `export LIBCLANG_PATH="$(brew --prefix llvm)/lib"`
      * **Windows:** `choco install llvm` or `winget install LLVM.LLVM`

      ## Step 2: Clone the repository

      Clone the [`arc-node`](https://github.com/circlefin/arc-node) repository and
      check out the version for your target network. See
      [node requirements](/arc/references/node-requirements#versions) for the current
      version:

      ```shell theme={null}
      git clone https://github.com/circlefin/arc-node.git
      cd arc-node
      git checkout v0.6.0
      git submodule update --init --recursive
      ```

      ## Step 3: Build and install

      The following commands build three Arc node binaries: `arc-node-execution`,
      `arc-node-consensus`, and `arc-snapshots`:

      ```shell theme={null}
      cargo install --path crates/node
      cargo install --path crates/malachite-app
      cargo install --path crates/snapshots
      ```

      `cargo install` places compiled binaries into `~/.cargo/bin`, which is added to
      `PATH` by loading `~/.cargo/env`. To install elsewhere, add `--root $BASE_DIR`
      to each command (for instance, `--root /usr/local` places them under
      `/usr/local/bin`).

      Verify the installation:

      ```shell theme={null}
      arc-snapshots --version
      arc-node-execution --version
      arc-node-consensus --version
      ```

      ## Step 4: Set environment variables

      The remaining steps use a small set of variables to keep paths consistent. Write
      them to a file and source it:

      ```shell theme={null}
      cat << "EOF" > ~/.arc_env
      ARC_HOME="${ARC_HOME:-$HOME/.arc}"

      # Linux runtime directory:
      ARC_RUN="/run/arc"

      # macOS runtime directory (uncomment if on macOS):
      #ARC_RUN="$ARC_HOME/run"

      ARC_EXECUTION=$ARC_HOME/execution
      ARC_CONSENSUS=$ARC_HOME/consensus
      EOF

      source ~/.arc_env
      ```

      ## Step 5: Create data directories

      Create the data directories for the EL and CL, plus the runtime directory used
      for IPC sockets:

      ```shell theme={null}
      mkdir -p "$ARC_EXECUTION" "$ARC_CONSENSUS"
      sudo install -d -o $USER "$ARC_RUN"
      ```

      On macOS, replace the second command with `mkdir -p "$ARC_RUN"` after
      uncommenting the macOS line in `~/.arc_env`.

      <Note>
        When running as a systemd service, the `RuntimeDirectory=arc` directive creates
        `/run/arc` automatically. You can skip the second command in that case.
      </Note>

      ## Step 6: Download blockchain snapshots

      Download snapshots so the node starts syncing from a recent block height rather
      than from genesis:

      ```shell theme={null}
      arc-snapshots download \
        --chain=arc-testnet \
        --execution-path "$ARC_EXECUTION" \
        --consensus-path "$ARC_CONSENSUS"
      ```

      This command fetches the latest snapshot URLs from
      `https://snapshots.arc.network`, downloads the snapshots, and extracts them into
      `$ARC_EXECUTION` and `$ARC_CONSENSUS`.

      <Warning>
        Snapshots are large. Testnet snapshots are approximately **68 GB EL + 16 GB CL
        compressed** (around 103 GB and 36 GB extracted). The download takes 10–15
        minutes on a stable 100 Mbps connection; slower or metered connections can take
        hours. Ensure you have at least 150 GB of free disk space, a stable network
        connection, and available CPU. The terminal stops producing output during
        extraction. This is expected.
      </Warning>

      ## Step 7: Initialize the consensus layer

      Generate the CL private key file used for network identity. This is a one-time
      setup step:

      ```shell theme={null}
      arc-node-consensus init --home "$ARC_CONSENSUS"
      ```

      ## Step 8: Start the execution layer

      Start the Execution Layer. This creates the IPC sockets that the Consensus Layer
      connects to.

      ```shell theme={null}
      arc-node-execution node \
        --chain arc-testnet \
        --datadir "$ARC_EXECUTION" \
        --disable-discovery \
        --ipcpath "$ARC_RUN/reth.ipc" \
        --auth-ipc \
        --auth-ipc.path "$ARC_RUN/auth.ipc" \
        --http \
        --http.addr 127.0.0.1 \
        --http.port 8545 \
        --http.api eth,net,web3,txpool,trace,debug \
        --metrics 127.0.0.1:9001 \
        --enable-arc-rpc \
        --rpc.forwarder https://rpc.testnet.arc.io/
      ```

      The EL starts and waits for blocks. Log output shows that the IPC sockets exist
      at `$ARC_RUN/reth.ipc` and `$ARC_RUN/auth.ipc`.

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--chain arc-testnet` | Yes | Selects the Arc Testnet genesis configuration bundled in the binary |
      | `--datadir` | Yes | Path to the EL data directory |
      | `--disable-discovery` | Yes | Disables P2P peer discovery (Arc uses relay endpoints instead) |
      | `--ipcpath` / `--auth-ipc` | Yes (IPC mode) | Paths for the IPC sockets the CL connects to |
      | `--http` / `--http.addr` | Yes | Enables the JSON-RPC endpoint on the specified address and port |
      | `--http.api` | Recommended | RPC namespaces to expose |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |
      | `--enable-arc-rpc` | Yes | Enables Arc-specific RPC methods |
      | `--rpc.forwarder` | Recommended | Routes submitted transactions to an RPC node for broadcast |

      <Note>
        `--chain arc-testnet` uses the bundled genesis configuration; replace with
        `--chain /path/to/genesis.json` if you have a custom genesis file. See
        [reth node](https://reth.rs/cli/reth/node/) for additional flags.
      </Note>

      ## Step 9: Start the consensus layer

      Open a separate terminal and start the Consensus Layer. The CL connects to the
      EL through the IPC sockets and begins fetching blocks from the network.

      ```shell theme={null}
      arc-node-consensus start \
        --home "$ARC_CONSENSUS" \
        --eth-socket "$ARC_RUN/reth.ipc" \
        --execution-socket "$ARC_RUN/auth.ipc" \
        --rpc.addr 127.0.0.1:31000 \
        --follow \
        --follow.endpoint https://rpc.testnet.arc.io,wss=rpc.testnet.arc.io \
        --follow.endpoint https://rpc.drpc.testnet.arc.io,wss=rpc.drpc.testnet.arc.io \
        --follow.endpoint https://rpc.blockdaemon.testnet.arc.io,wss=rpc.blockdaemon.testnet.arc.io \
        --metrics 127.0.0.1:29000
      ```

      | Flag | Required | Description |
      | :- | :- | :- |
      | `--home` | Yes | Path to the CL data directory (contains keys and state) |
      | `--eth-socket` | Yes (IPC mode) | Path to the Execution Layer ETH RPC IPC socket |
      | `--execution-socket` | Yes (IPC mode) | Path to the Execution Layer Engine API IPC socket |
      | `--rpc.addr` | Recommended | CL RPC listen address and port |
      | `--follow` | Yes | Enables block-following mode through relay endpoints |
      | `--follow.endpoint` | Yes | Relay endpoint URLs. Specify multiple for redundancy. Format: `https://host,wss=host` |
      | `--metrics` | Recommended | Enables Prometheus metrics on the specified address and port |

      ## Step 10: Verify the node is syncing

      After both layers start, wait roughly 30 seconds, then query the local JSON-RPC
      endpoint for the latest block height:

      ```shell theme={null}
      curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1 }'
      ```

      The `result` field is a hexadecimal block number that increases over time. If it
      stays at `0x0`, check the CL logs for errors.

      If you have [Foundry](https://book.getfoundry.sh/getting-started/installation)
      installed, you can run the same check with `cast`:

      ```shell theme={null}
      cast block-number --rpc-url http://localhost:8545
      ```

      Run it several times over a few seconds -- the block number increases as the
      node syncs.

      If the block number stays at `0x0` or the node does not start as expected, check
      these common causes:

      * **IPC socket files missing.** The EL writes sockets at `$ARC_RUN/reth.ipc` and
        `$ARC_RUN/auth.ipc` on startup. If they are not present after 30 seconds, the
        EL did not start -- review its terminal output for a panic or configuration
        error.
      * **CL cannot connect to the EL.** Start the EL first. If the CL was launched
        before the EL was ready, restart the CL.
      * **Snapshot extraction incomplete.** `arc-snapshots download` runs silently
        during extraction. If it was interrupted, `$ARC_EXECUTION` or `$ARC_CONSENSUS`
        may be partially populated. Re-run the download to overwrite the existing
        files. If you clear the directories first, note that `$ARC_CONSENSUS` also
        holds the CL private key written by `arc-node-consensus init`. Re-run that
        command after clearing, or your node loses its network identity.
      * **Path mismatch between EL and CL.** `$ARC_RUN` must resolve to the same
        directory in both shells. Re-source `~/.arc_env` in any terminal that lost its
        environment.

      Once your node is syncing steadily, you can
      [deploy it as a systemd service](/arc/tutorials/deploy-node-as-service) for
      production use, or
      [set up Prometheus and Grafana](/arc/tutorials/set-up-node-monitoring) to view
      the pre-built dashboards.
    </Tab>
  </Tabs>

  ## Run on separate hosts

  The tabs above describe running the Execution Layer and Consensus Layer on the
  same host, communicating through IPC sockets. To run them on separate hosts,
  swap IPC for authenticated RPC. This section applies to the binary install paths
  (`arcup` and source build).

  ### Generate a JWT secret

  The EL and CL authenticate to each other with a shared JWT secret. Generate it
  once, then securely copy it to both hosts:

  ```shell theme={null}
  openssl rand -hex 32 | tr -d "\n" > "$ARC_HOME/jwtsecret"
  chmod 600 "$ARC_HOME/jwtsecret"
  ```

  ### Execution layer flags for RPC mode

  Remove the IPC flags (`--ipcpath`, `--auth-ipc`, `--auth-ipc.path`) from the EL
  command and add:

  ```shell theme={null}
  --authrpc.addr 0.0.0.0 \
  --authrpc.port 8551 \
  --authrpc.jwtsecret "$ARC_HOME/jwtsecret"
  ```

  <Warning>
    `--authrpc.addr 0.0.0.0` exposes port 8551 on every network interface. Restrict
    access with a firewall rule or private network -- the Engine API controls block
    production and must not be reachable from the public internet.
  </Warning>

  ### Consensus layer flags for RPC mode

  Remove `--eth-socket` and `--execution-socket` from the CL command, and add:

  ```shell theme={null}
  --eth-rpc-endpoint http://<EL_HOST>:8545 \
  --execution-endpoint http://<EL_HOST>:8551 \
  --execution-jwt "$ARC_HOME/jwtsecret"
  ```

  Replace `<EL_HOST>` with the IP address or hostname of the EL host.

  <Note>
    IPC and RPC are mutually exclusive. Use one or the other, not both.
  </Note>

  ## Enable backpressure under memory pressure (alpha)

  Backpressure is an alpha feature in v0.6.0 that throttles execution to match the
  speed of disk writes, bounding Execution Layer memory growth. Enable it only if
  you observe sustained memory pressure on a host that meets the
  [node requirements](/arc/references/node-requirements).

  First, add the `reth` namespace to the EL `--http.api` flag so the CL can read
  backpressure metrics:

  ```shell theme={null}
  --http.api eth,net,web3,txpool,trace,debug,reth
  ```

  Then start the CL with backpressure enabled at threshold `10`:

  ```shell theme={null}
  --execution-persistence-backpressure \
  --execution-persistence-backpressure-threshold=10
  ```
</View>
