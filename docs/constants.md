# Arc constants (Phase 0, step 3)

Every Arc value used by this repo must appear here with a primary source. Code loads values from this table (U2) and nothing else.

- Access date for every row: **2026-10-02**. Pages were fetched raw (`curl`, not via a summariser), and the quotes are verbatim.
- **Live check** is an independent check against Arc **testnet** (`https://rpc.testnet.arc.io`) using `arc-cast` 1.7.1-dev on 2026-10-02 at around head block 65,130,478. "—" means no live check was possible or it wasn't applicable.
- Mainnet values are recorded **for the gate check only** and must never be wired to anything that signs or broadcasts (CLAUDE.md rule 1).

## Network

| ID | Constant | Value | Source URL | Quote | Live check |
|---|---|---|---|---|---|
| C-01 | Testnet chain ID | `5042002` | https://docs.arc.io/arc/references/rpc-endpoints.md | "\| **Chain ID (Testnet)** \| `5042002` \|" | `arc-cast chain-id` → `5042002` ✅ |
| C-02 | Mainnet chain ID (gated, do not use) | `5042` | https://docs.arc.io/arc/references/rpc-endpoints.md | "\| **Chain ID (Mainnet)** \| `5042` \|" | — (never queried, by rule) |
| C-03 | Testnet primary RPC (HTTP / WS) | `https://rpc.testnet.arc.io` / `wss://rpc.testnet.arc.io` | https://docs.arc.io/arc/references/rpc-endpoints.md | "\| **Primary (Circle)** \| `https://rpc.testnet.arc.io` \| `wss://rpc.testnet.arc.io` \|" | HTTP answered ✅ |
| C-04 | Testnet third-party RPCs (Blockdaemon and dRPC are also **relays** our node fetches blocks from (C-68), so they are not independent of it. QuickNode is not a testnet relay. See ADR-002) | Blockdaemon `https://rpc.blockdaemon.testnet.arc.io`; dRPC `https://rpc.drpc.testnet.arc.io`; QuickNode `https://rpc.quicknode.testnet.arc.io` | https://docs.arc.io/arc/references/rpc-endpoints.md | "\| **Blockdaemon** \| `https://rpc.blockdaemon.testnet.arc.io` \|" (and the dRPC and QuickNode rows) | — (not on sandbox allowlist) |
| C-05 | Native currency symbol | `USDC` | https://docs.arc.io/arc/references/rpc-endpoints.md | "\| **Currency symbol** \| USDC \|" | — |
| C-06 | Testnet explorer | `https://explorer.testnet.arc.io` | https://docs.arc.io/arc/references/rpc-endpoints.md | "\| **Testnet explorer** \| [explorer.testnet.arc.io](https://explorer.testnet.arc.io) \|" | — |

## USDC: one balance, two views

| ID | Constant | Value | Source URL | Quote | Live check |
|---|---|---|---|---|---|
| C-10 | Native USDC decimals (`NativeWei`) | `18` | https://docs.arc.io/arc/references/evm-differences.md | "USDC on Arc has two interfaces that share one balance: a native interface (18 decimals) and an ERC-20 interface (6 decimals)" | Native and ERC-20 log values in tx `0x0e8279a4fc99863c702f3b2d408e77897cf8076aa5caa1901e3f94ceaed24695` differ by exactly 10¹² ✅ |
| C-11 | ERC-20 USDC decimals (`UsdcUnits`) | `6` | same | same | `decimals()` → `6` ✅ |
| C-12 | ERC-20 USDC address (testnet and mainnet) | `0x3600000000000000000000000000000000000000` | https://docs.arc.io/arc/references/contract-addresses.md | "\| **USDC** \| [`0x3600000000000000000000000000000000000000`](https://explorer.testnet.arc.io/…) \| Optional ERC-20 interface for interacting with the native USDC balance. Uses 6 decimals. \|" | `symbol()` → `"USDC"` ✅ |
| C-13 | Native→display factor | 10¹² | https://docs.arc.io/arc/references/evm-differences.md | "To display a native value as USDC, divide by 10¹²." | ✅ (see C-10) |
| C-14 | Truncation warning (drives the dust policy) | ERC-20 view truncates below 10⁻⁶ USDC | same | "Don't use the 6-decimal value when crediting or recording balances; truncation at the 6-decimal boundary records less than was transferred. A zero `balanceOf` doesn't mean the native balance is zero." | — |
| C-15 | Credit at full precision | Credit the raw 18-dp value | https://docs.arc.io/integrate/exchanges/deposits.md | "Store and credit the raw 18-decimal value. Don't truncate to 6-decimal ERC-20 units: amounts smaller than 1×10⁻⁶ USDC are valid and spendable as gas." | — |

## Events

| ID | Constant | Value | Source URL | Quote | Live check |
|---|---|---|---|---|---|
| C-20 | Native system emitter (EIP-7708), **canonical credit source** | `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` | https://docs.arc.io/arc/references/usdc-system-events.md | "\| **Native USDC** (system, EIP-7708) \| `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` \| `Transfer` \| 18 \|" | Log at logIndex 0 from this emitter in tx `0x0e8279a4fc99863c702f3b2d408e77897cf8076aa5caa1901e3f94ceaed24695` ✅ |
| C-21 | Transfer topic0 (both emitters) | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` | same | "\| topic0 \| `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` \|" | `arc-cast keccak 'Transfer(address,address,uint256)'` matches ✅ |
| C-22 | One ERC-20 `transfer()` produces two logs | System log (18 dp) **and** ERC-20 log (6 dp) | same | "A single ERC-20 `transfer()` emits **two** logs … Match on the emitter address so you do not count the same movement twice" | Both seen in one receipt, system log first ✅ |
| C-23 | Native log ordering | System `Transfer` is emitted first in the tx | same | "The native `Transfer` log is emitted **first**, before any other logs in the transaction." | logIndex 0 ✅ (1 sample) |
| C-24 | No log for zero-value transfers or self-transfers | — | same | "Zero-value transfers emit no log." / "Self-transfers (`from == to`) emit no log." | — |
| C-25 | Gas is not a Transfer log | Fee = `gasUsed × effectiveGasPrice` from the receipt | same | "**Gas fees** are derived from the receipt (`gasUsed × effectiveGasPrice`)." | fee 7,374,356,000,000,000 wei recomputed from receipt ✅ |
| C-26 | Legacy testnet events before Zero5 (backfill only) | Emitter `0x1800000000000000000000000000000000000000`; `NativeCoinTransferred` topic0 `0x62f084c0…5a22` | same | "On testnet, before the Zero5 hard fork activated, native USDC movements emitted custom events from the NativeCoinAuthority precompile at `0x1800000000000000000000000000000000000000`" | — (activation block: Q-A6) |
| C-27 | Attribution for relayed transfers | Use `from` in the system `Transfer` log, not `tx.from` | https://docs.arc.io/integrate/exchanges/deposits.md | "For EIP-3009 relayer-submitted deposits, `tx.from` is the relayer's address. … Read the `from` field from the system emitter's `Transfer` event instead." | — |
| C-28 | Blocklist event names (ERC-20 contract) | `Blocklisted(address)`, `UnBlocklisted(address)` | https://docs.arc.io/integrate/infrastructure/indexing-events.md | "\| Address blocked \| `Blocklisted(address indexed account)` \|" | ⚠️ **UNVERIFIED.** No logs for either `Blocklisted` or `Blacklisted` in the last 9,999 blocks (Q-A5) |

## Fees and mempool

| ID | Constant | Value | Source URL | Quote | Live check |
|---|---|---|---|---|---|
| C-30 | Fee floor (`maxFeePerGas` minimum) | 20 gwei = `20_000_000_000` wei | https://docs.arc.io/arc/references/evm-differences.md | "**The minimum base fee is 20 Gwei.** Transactions with `maxFeePerGas` lower than 20 Gwei are silently dropped by the mempool." | `baseFeePerGas` = `0x4a817c800` = 20 gwei ✅ |
| C-31 | Maximum base fee | 20,000 gwei | https://docs.arc.io/arc/references/gas-and-fees.md | "\| **Maximum base fee** \| 20,000 Gwei \| Hard ceiling that bounds worst-case cost \|" | — |
| C-32 | Block gas limit | 30,000,000 | same | "\| **Gas throughput** \| 30M gas/block" | `gasLimit` = `0x1c9c380` = 30,000,000 ✅ |
| C-33 | Next base fee location | Parent header `extra_data`, 8-byte big-endian | same | "Arc publishes the next block's base fee in the parent header's `extra_data` field as an 8-byte big-endian value" | `extraData` = `0x00000004a817c800` = 20 gwei ✅ |
| C-34 | Base fee recipient | Paid to block beneficiary, not burned | https://docs.arc.io/arc/references/evm-differences.md | "**The base fee is paid to the block beneficiary, not burned.**" | — |
| C-35 | Typical gas units | Native send ≈21,000; ERC-20 `transfer()` ≈65,000 | https://docs.arc.io/integrate/exchanges/withdrawals.md | "A native USDC send uses approximately 21,000 gas units, while an ERC-20 `transfer()` call uses approximately 65,000." | Sample ERC-20 tx used 167,599 gas (it also moved EURC, so it is not comparable) |
| C-36 | Blob (type-3) transactions | Rejected | https://docs.arc.io/arc/references/evm-differences.md | "Not supported; the mempool rejects type-3 transactions" | — |

## RPC behaviour

| ID | Constant | Value | Source URL | Quote | Live check |
|---|---|---|---|---|---|
| C-40 | `eth_getLogs` block-range cap | 10,000 blocks; page in ≤9,999 | https://docs.arc.io/arc/references/rpc-endpoints.md | "`eth_getLogs` returns error `-32012` when the requested block range exceeds 10,000 blocks. … Log-driven clients must page through history in ≤9,999-block chunks." | `to−from = 10000` → `-32012 requested range too large` ✅; `to−from = 9999` passed the range check |
| C-41 | `eth_getLogs` **result cap** (not in docs) | 2,000 results per query, error `-32602` | **None in docs.** Observed only on the testnet primary endpoint | — | `-32602: request exceeded max allowed range: query exceeds max results 2000, retry with the range 65120745-65121300` ⚠️ (Q-A4) |
| C-42 | Head-lag error | `-32014`, retry after backoff | https://docs.arc.io/arc/references/rpc-endpoints.md | "it may return error `-32014` because it hasn't yet imported that block. You can safely retry requests that return `-32014` after a brief backoff." | Not observed (the quote is in the mainnet section; the troubleshooting table is general) |

## Finality, liveness, value rules

| ID | Constant | Value | Source URL | Quote | Live check |
|---|---|---|---|---|---|
| C-50 | Finality | Deterministic on inclusion; no reorgs | https://docs.arc.io/arc/concepts/deterministic-finality.md | "Every transaction in a committed block is immediately and irreversibly settled. There are no confirmation windows, no reorganization risk" | — |
| C-51 | Liveness condition | Blocks continue only while >⅔ validators are online and honest | https://docs.arc.io/arc/concepts/consensus-layer.md | "\| Liveness \| The network continues to produce blocks as long as more than two-thirds of validators are online and honest. \|" | — (basis for stall detection) |
| C-52 | Block time and timestamps | ~0.5 s; timestamps non-decreasing, not strictly increasing | https://docs.arc.io/arc/references/evm-differences.md | "Block timestamps are non-decreasing, not strictly increasing. … Use the block number for ordering" | — |
| C-53 | Blocklist enforcement | Value transfer to or from a blocklisted address reverts; gas is still consumed | same | "A value transfer to or from a blocklisted address reverts. An included transaction that reverts on a blocklist check still consumes gas." | — (receipt shape conflict: Q-A1) |
| C-54 | Zero-address sends | Value-bearing send to `0x0` reverts | same | "A value-bearing transfer to `0x0` reverts with `\"Zero address not allowed\"`" | — |
| C-55 | Testnet blocklisted test address | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | https://docs.arc.io/arc/references/contract-addresses.md | "\| **Blocklisted** \| 1 \| [`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`]" | — (used for failure-path E2E in Phase 5) |
| C-57 | Blocklisted address in simulation (**not in docs**) | `eth_call` / `eth_estimateGas` with value to or from a blocklisted address returns **JSON-RPC error `-32603` "Blocked address"**, not an EVM revert | **None in docs.** Observed live by the verifier and reproduced 2026-10-02 against the testnet primary RPC, using C-55 `0x7099…79C8` in both directions | — | `{"code":-32603,"message":"Blocked address"}` in both directions. A control address pair returned `"0x"` ✅ **Re-tested 2026-10-03 with a fresh random empty address `E`:**<br>• **value 0:** E→O `"0x"`; blocklisted→O `-32603 "Blocked address"`; blocklisted→E `-32603`<br>• **value 1 wei:** E→O `-32003 "revert: OutOfFunds"` (a false signal on any empty wallet)<br>⇒ **probe with value 0.** Also observed: C-55 carries an EIP-7702 delegation (`eth_getCode` = `0xef0100…`), so calls *to* it execute code. ⚠️ The stability of the code and message is unverified (Q-A13) |
| C-58 | Blocklisted **sender**: rejected before the mempool | A transaction from a blocklisted sender address is rejected at the pre-mempool stage: never on-chain, no gas consumed, so no receipt. (C-53 covers an *included* transfer that reverts on a blocklist check.) | https://docs.arc.io/integrate/exchanges/custody.md (archived `docs/sources/arc/integrate_exchanges_custody.md` lines 247–255, sha256 in MANIFEST) | "Transactions from blocklisted sender addresses are rejected at the pre-mempool stage—they never appear onchain." / "If a send fails with a blocklist rejection, it was not broadcast—no gas is consumed" | — (not reproduced: whether `eth_sendRawTransaction` rejects before inclusion is Q-A13; the receipt shape of an included blocklist revert is Q-A1) |
| C-68 | arc-node version and relay endpoints | Testnet and mainnet node version `v0.8.0`. Testnet relays: `https://rpc.testnet.arc.io`, `https://rpc.drpc.testnet.arc.io`, `https://rpc.blockdaemon.testnet.arc.io`. Mainnet relays also include QuickNode | https://docs.arc.io/arc/references/node-requirements.md (archived `docs/sources/arc/arc_references_node-requirements.md`) | "\| Arc Testnet \| v0.8.0 \|" / "Your Consensus Layer connects to relay endpoints to fetch blocks from the network." | — |
| C-56 | Signing | secp256k1, EIP-155 chain ID required, HD path `m/44'/60'/0'/0/x` | https://docs.arc.io/integrate/exchanges/custody.md | "**Chain ID in signature:** Required (EIP-155). Use `5042002` for testnet." | — |

## Cross-chain and extensions

| ID | Constant | Value | Source URL | Quote | Live check |
|---|---|---|---|---|---|
| C-60 | CCTP domain for Arc | `26` | https://docs.arc.io/arc/references/contract-addresses.md and https://developers.circle.com/cctp/concepts/supported-chains-and-domains.md | "\| **TokenMessengerV2** \| 26 \|" / "\| 26 \| Arc \|" | `MessageTransmitterV2.localDomain()` → `26` ✅ |
| C-61 | Testnet CCTP MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | https://docs.arc.io/arc/references/contract-addresses.md | "\| **MessageTransmitterV2** \| 26 \| [`0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`]" | answered ✅ |
| C-62 | Memo contract (testnet and mainnet) | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | https://docs.arc.io/arc/concepts/transaction-memos.md | "The predeployed `Memo` contract (`0x5294E9927c3306DcBaDb03fe70b92e01cCede505`) wraps the call and emits the metadata as events" | has code ✅ |
| C-63 | Multicall3From (attribution scope for screening) | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` | https://docs.arc.io/arc/references/contract-addresses.md | "If you maintain an offchain blocklist or compliance screening system, you must include the Memo and Multicall3From contract addresses." | — |
| C-65 | Permit2 (predeployed, testnet and mainnet) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | https://docs.arc.io/arc/references/contract-addresses.md | "\| **Permit2** \| [`0x000000000022D473030F116dDEE9F6B43aC78BA3`]… \| Universal contract for signature-based token approvals. Required for StableFX. \|" | — |
| C-66 | EIP-7702 set-code transactions supported | yes | https://docs.arc.io/arc/references/evm-differences.md | "Arc targets the **Osaka** hard fork as its baseline, including features such as EIP-7702 (set-code transactions)." / "EIP-7702 set-code transactions … all behave as on Ethereum." | — |
| C-67 | EIP-3009 `transferWithAuthorization` on USDC (an off-chain EIP-712 signature moves funds) | EIP-712 domain `name` `USDC`, `version` `2`, `chainId` `5042002`, `verifyingContract` `0x3600…0000` | https://docs.arc.io/integrate/relayers-and-paymasters/eip-3009-relayer.md | "The user signs an EIP-712 typed data message offchain. … The relayer submits the signed data; the user never sends a transaction." | — |
| C-64 | Privacy (APS) | **Not live.** Everything on-chain is public | https://docs.arc.io/arc/concepts/opt-in-privacy.md | "Privacy features are on the roadmap and not yet available on Arc." | — |

## Mismatch report against CLAUDE.md and KICKOFF_PROMPT.md

| # | CLAUDE.md / prompt says | Primary source says | Severity | Action |
|---|---|---|---|---|
| M-1 | "Blocklist reverts can consume gas without a normal receipt" | **The docs contradict each other.** llms.txt: "blocklist reverts consume gas without a receipt". Transaction lifecycle: "included in a block but marked as failed. It consumes gas and appears onchain with a `status: 0` receipt." | Medium | Design for both cases (missing receipt and `status: 0`). Confirm on testnet (Q-A1) |
| M-2 | "`eth_getLogs` is capped at 10,000 blocks, so page in ≤9,999" | Correct, but the testnet endpoint **also** caps results at 2,000 (`-32602`), which is not documented | **High** for U3/U4 | Paging must also shrink the block range when the result cap is hit (Q-A4) |
| M-3 | ADR-006: "Note that Arc has no native memo" | A **predeployed Memo contract** exists on both networks (C-62). It is not a transaction field: the *sender's* EOA must call it, so third-party payers can't be relied on to include a memo | Medium (prompt contradiction, §7 trigger) | Asked as Q-P1; ADR-006 must cover this |
| M-4 | "Fee floor 20 gwei" | Correct, but the docs disagree about what happens below it: "silently dropped … no error receipt" vs `transaction underpriced` (gas-and-fees.md) vs "may remain pending indefinitely or fail outright" | Low | Enforce the floor before signing. Treat RPC rejection *and* a silent drop as normal outcomes |
| M-5 | — (no CLAUDE.md claim) | **Docs defect.** gas-and-fees.md sample sends `value: ethers.parseUnits("1", 6), // 1 USDC via native send`. Native value is 18 dp, so that sends 10⁻¹² USDC | Info | Never copy doc snippets into money code. A U1 test asserts 1 USDC = 10¹⁸ wei |
| M-6 | — | **The docs contradict each other.** custody.md: "No need to handle 'dropped and replaced' scenarios". transaction-lifecycle.md: dropped transactions exist, and replacement uses the same nonce | Medium | Follow the conservative reading: U10 handles drop, replacement and cancel |
| M-7 | "Liveness can still stall" | Consistent: liveness needs >⅔ of validators (C-51). The docs give no stall threshold | Info | Stall threshold is ours to set (Q-A7) |
| M-8 | — | withdrawals.md and custody.md samples use `Number()/1e18` and `parseFloat` for USDC | Info | Floats are banned on money and display paths (CLAUDE.md). Lint rule in Phase 2 |
| M-9 | Prompt: Arc Foundry goes in `~/.local/bin` | The sandbox can't write there | Info | Installed to `./.tools/bin` (docs/verification/tooling.md) |
| M-10 | CLAUDE.md (CO-1 v3 merge): "`Multicall3From` … emits no batch event" | **Not in the archive.** The archived pages say only that it "Batches multiple calls like Multicall3, but preserves the original `msg.sender` in each subcall" (`arc_references_contract-addresses.md` lines 282, 289) and that it routes calls through the CallFrom precompile (`integrate_infrastructure_compliance.md` lines 42, 100–108). The batched-transactions page (llms.txt line 29) is not archived | Info | Open. CLAUDE.md now says the docs do not settle it and never relies on a batch event; every inner transfer is verified individually either way. To be raised in docs/OPEN_QUESTIONS.md by its owner |

No mismatch on: testnet chain ID, mainnet chain ID, ERC-20 address and 6 dp, native 18 dp, system emitter address, two-log behaviour, BFT finality and no reorgs, `-32014` retry, CCTP domain 26, privacy not live.
