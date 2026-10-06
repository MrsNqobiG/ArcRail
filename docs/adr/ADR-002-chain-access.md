# ADR-002 Chain access: own nodes and an independent reference

**Status: PROPOSED. A human decides at G1.**

**Fix block 11** (LEDGER P1-adrs) adds the reference-RPC candidates from the 2026-10-05 re-fetch of the node-providers page (CF-20). It is not ahead of any sibling.

## Context (all from https://docs.arc.io/arc/references/node-requirements.md unless noted, accessed 2026-10-02)
- **Hardware:** "Memory | 64 GB+", "Storage | 1 TB+ NVMe SSD (TLC recommended)", "Network | Stable 24 Mbps+", Linux (Ubuntu 22.04+ or Debian 12+). Version: "Arc Testnet | v0.8.0".
- **Snapshot bootstrap only:** "An Arc node bootstraps from a snapshot; syncing from genesis is not supported." The testnet snapshot is about 68 GB (EL) plus 16 GB (CL) compressed. **So we must trust whoever produced the snapshot for history before it.**
- **Blocks come from relays:** "Your Consensus Layer connects to relay endpoints to fetch blocks from the network." The testnet relays listed are `rpc.testnet.arc.io`, `rpc.drpc.testnet.arc.io` and `rpc.blockdaemon.testnet.arc.io`. Three of the providers we might use as the "independent" reference are therefore also our block source (see below). Our node is not a validator. It "Fetches and verifies blocks".
- **Public-facing nodes:** the docs recommend `--public-api` for them. Ours won't be public-facing.
- **RPC limits** (C-40, C-41): 10,000-block range cap, and a 2,000-result cap observed on the public endpoint. Our own node's limits are configurable (Q-A11).
- **Privacy** (THREAT_MODEL L-3): third-party RPCs learn which addresses we query.

## What two sources actually give us
- **Our node** verifies blocks itself, using the consensus layer's verification. It therefore protects against a provider *fabricating* logs or receipts (T-S2), *if* block verification checks validator commit certificates. That is unverified (**Q-A12**).
- **A second source** protects against *our* node being wrong (a bug, a corrupted snapshot, a stale version) and gives a liveness signal (F7).
- They are **not fully independent** if the reference is one of the relay providers (Circle primary, dRPC, Blockdaemon, and on mainnet also QuickNode, C-68). The documented testnet relays don't include **QuickNode** (`https://rpc.quicknode.testnet.arc.io`, rpc-endpoints.md), so QuickNode is the more independent testnet reference candidate. It isn't on the sandbox allowlist (Q-T6). A relay that withholds blocks causes a stall (fail-safe, F7), not wrong data, provided Q-A12 holds.
- **Listed providers that aren't documented relays on either network** (C-68):
  - **Alchemy**: rpc-endpoints.md lists an API-keyed mainnet endpoint and no testnet endpoint.
  - **Goldsky**, newly listed on the node-providers page: "Low-latency RPCs for Arc over a global edge network", "Payable per request in USDC" via x402 (https://docs.arc.io/arc/tools/node-providers.md, accessed 2026-10-05, archived `sources/arc/arc_tools_node-providers.REFETCH-2026-10-05.md`, LEDGER CF-20). The archived docs give no Goldsky endpoint, don't say which networks it serves, and don't say whether any payment method other than x402 exists. Paying per request would be a USDC payment flow outside this design.

  Neither provider is assessed here. Both are candidates for the reference re-assessment at G-M (phase table).

## Options

| | A. One own node + an independent reference RPC | B. Two own nodes (separate hosts and relay sets) + an independent reference RPC | C. Provider-only (no own node) |
|---|---|---|---|
| Protection against fabricated data (T-S2) | Yes, if Q-A12 holds | Yes, if Q-A12 holds | **No.** The two providers would be compared with each other only |
| Address privacy (L-3) | Address-filtered queries go to our node | Same | **No.** Providers see our address set |
| Single node failure | Inbound stalls, outbound pauses | Continues on the second node | Depends on the provider |
| Proxmox cost | 1 VM: 64 GB RAM, 1 TB NVMe | 2 VMs | None |
| Archive needs | Depends on reconciliation look-back (Q-A11) | Same | Depends on the provider |

## Design rules whichever option is chosen
1. The ingestion cursor advances only when the **own node(s) and the reference agree** on block hash and log set at the same height (SEQUENCES F2).
2. Address-filtered queries go **only** to own nodes. The reference gets unfiltered range queries and block hashes (L-3).
3. Pin the arc-node version and image digest (U15). The node's RPC is reachable only from the **adapter and independent-monitor segments** (ADR-008), never from the internet.
4. Snapshot trust: record the snapshot source and hash in the evidence pack. Cross-check a sample of historical block hashes against the reference after bootstrap.
5. Run the Execution and Consensus Layers in **IPC mode on one host** ("IPC mode (default): Both processes run on the same host. Lower latency, no authentication required", node-requirements.md, accessed 2026-10-02). That way no Engine-API JWT secret exists to protect (THREAT_MODEL T-I1).
6. **Stall signal (answers Q-A9 as a proposal):** a WebSocket `newHeads` subscription on our own node(s), plus `eth_blockNumber` polling of the reference. A stall is declared only when both sources go silent (SEQUENCES F7).

## Recommendation by phase (for the human)
| Phase | Recommended | Reference RPC | Notes |
|---|---|---|---|
| Testnet (Phases 2–5) | **A**: one own node | **QuickNode testnet**, not a documented testnet relay (C-68). Needs the sandbox allowlist (Q-T6) | Ingestion stops whenever the single node is down. That is acceptable on testnet |
| Mainnet pilot (G-M 8, internal funds, low caps) | **B**: two own nodes on separate hosts | An independent reference **re-assessed at G-M**. On mainnet QuickNode *is* a relay (C-68), and so are Circle's primary, dRPC and Blockdaemon. The listed providers that are not documented relays, Alchemy and Goldsky (see above, CF-20), are assessed there. Using a relay as the reference is **not fully independent** and must be accepted explicitly at G-M | Address reads only to own nodes (rule 2) |
| General availability | **B** | As for the pilot, re-assessed at each G-M review | — |

## Questions this ADR raises
- **Q-A11:** Does a pruned (`--full`) node serve `eth_getLogs` and `eth_getBalance` at historical blocks far enough back for the reconciliation look-back? What `eth_getLogs` limits does our own node enforce by default?
- **Q-A12:** Does the consensus layer verify validator commit signatures on fetched blocks, or does it trust the relay?
- Sandbox: the third-party testnet RPCs aren't on the allowlist (Q-T6).
