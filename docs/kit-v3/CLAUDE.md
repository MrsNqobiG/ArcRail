# CLAUDE.md: Arc rail integration standing rules (v3, Raayl)

**Raayl context.** Raayl is the product: customer, API, KYB/KYC, pricing, ledger and reconciliation. DFNS is the wallet, signing and treasury layer. Arc is an additional USDC settlement network. VALR/OTC providers handle fiat↔USDC. **Extend Raayl's existing code; never build a parallel system.** Everything Arc-specific lives behind a network abstraction (`network = ARC`), so other networks can be added later. `REVERSED` means a compensating ledger entry, never an on-chain reversal.

This repo adds Circle's **Arc Network** as an additional settlement rail to the bank's **existing core banking system (CBS)**. The CBS stays the system of record for customers, accounts, balances, KYC/AML and the general ledger. We build an **Arc Rail Adapter** beside it, plus only the CBS integration points a human has approved.

**Custody is the company's existing Dfns organisation** (dfns.co; the team sometimes says "Defence"). We do not build a second custody or approval system.

## Non-negotiables
1. **Testnet only.** Arc testnet chain ID 5042002, Dfns network `ArcTestnet`. Never configure, sign for or broadcast to Arc mainnet (chain ID 5042, Dfns network `Arc`) until the required gates in docs/GATES.md are signed by named humans. A hook enforces this; report it if it blocks something legitimate. Never try to get around it.
2. **No secrets.**
   - Never read, print, log or commit private keys, mnemonics, Dfns tokens or keys, webhook secrets, API keys, or real .env files.
   - Credentials are read **only by the running service, from the secret store, at runtime**.
   - You, the agent, never call the Dfns, Circle or VALR production APIs directly.
   - Tests use stubs, recorded fixtures, or sandboxes driven by CI with runtime credentials.
3. **Read-only on the existing CBS and on the Dfns org.** Change the CBS only through docs/CONTRACT.md and its normal change process. Never create or modify Dfns users, policies, permissions or wallets. Instead, write what is needed into docs/DFNS_SETUP.md for the Dfns admin.
4. **No LLM or agent in the money path.** Every money decision comes from deterministic, tested code.
5. **Never guess.** Any Arc, Circle (StableFX, CPN), Dfns, CBS or South African regulatory fact must be verified from a primary source or the CBS code, with URL and date in docs/constants.md or docs/sources.md. Otherwise put it in docs/OPEN_QUESTIONS.md and ask.
6. **Compliance status is human-owned.** You may set NOT STARTED, IMPLEMENTED or EVIDENCED. Only a named human sets SIGNED-OFF.
7. **Gates are recorded.** Every gate (G0, G1, G1b, G2, G3, G-P, G-M) lives in docs/GATES.md with name, role, date, commit SHA, and the option chosen for each ADR. "Approved in chat" is not signed until it's recorded there.

## Money invariants (zero tolerance; enforced in code, tests and at runtime)
- **Integer arithmetic only.** Branded types: `CbsMinor` (CBS minor units, e.g. ZAR cents), `UsdcUnits` (ERC-20 view, 6 dp), `NativeWei` (native view, 18 dp), plus one `FiatMinor<CCY>` per payout currency. Mixing types is a compile error.
- **One conversion module.** Rounding policy is explicit. Dust goes to a named suspense account with a record, never silently dropped. Every quote leg (ZAR→USDC, any stablecoin swap, any fiat payout) is a separate, balanced posting.
- **Conservation.** Debits equal credits in the CBS and the adapter sub-ledger, and on-chain deltas match to the base unit.
- **Exactly once.** Deterministic idempotency keys, transactional outbox/inbox, one nonce writer per wallet. Inbound signals (Dfns webhooks, CPN and StableFX callbacks, pay-in notifications, chain logs) are each checked for authenticity (signature, HMAC or emitter) and deduplicated before use.
- **Fail closed.** Any reconciliation drift, RPC disagreement, unknown event or failed invariant triggers PAUSE (whole rail) or QUARANTINE (one item). Either way a human is paged, and two humans must approve the unpause.
- **Binding.** Account, amount, recipient and route are always taken from the server-side transfer record. Never echo them from client input.

## Arc facts (verify each against docs.arc.io before use; cite in docs/constants.md)
- **USDC has two views of one balance.** USDC is the native gas token: native view at 18 dp, ERC-20 view at `0x3600000000000000000000000000000000000000` at 6 dp.
- **Each ERC-20 transfer produces two Transfer logs:** the EIP-7708 one from system emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (18 dp) and the ERC-20 one (6 dp). Credit from exactly one canonical source and dedupe on (chainId, txHash, logIndex).
- **Fees.** Fee floor 20 gwei; maximum base fee 20,000 gwei; no documented priority-fee cap, so enforce our own fee ceiling.
- **RPC limits.** `eth_getLogs` is capped at 10,000 blocks (`-32012`), so page in ≤9,999. Retry `-32014` with backoff.
- **Blocklist.** Blocklist reverts can consume gas.
- **Finality.** Deterministic BFT finality, no reorgs. Liveness can stall, so handle "no new blocks".
- **Privacy.** Privacy features are not live; everything on-chain is public. **No personal information on-chain, ever.**
- **Memos.** The predeployed `Memo` contract (`0x5294E9927c3306DcBaDb03fe70b92e01cCede505`) attaches a reference to a transfer and emits it as an event. We use it only with a non-PII reference (a hash of our transfer ID).
- **Batching.** The predeployed `Multicall3From` (`0x522fAf9A91c41c443c66765030741e4AaCe147D0`) batches calls but keeps our wallet as `msg.sender`. It emits no batch event, so every inner transfer is verified individually.
- **Blocklist.** A blocklisted sender is rejected before the mempool (no gas, no receipt). Keep a local copy of the USDC blocklist from `Blocklisted`/`UnBlocklisted` events and check it before every send.
- **Docs access.** Use the Arc docs MCP server (`arc-docs`, configured in `.mcp.json`) to look up and cite Arc facts.

## Dfns facts (verify against docs.dfns.co; cite in docs/sources.md)
- **Network names.** Dfns calls Arc mainnet `Arc` and testnet `ArcTestnet`. Dfns indexes Arc transactions after a 10-block confirmation delay, so **our own indexer is canonical** and Dfns events are a cross-check.
- **Service accounts.** Our software authenticates as service accounts: a key pair (the private key stays in the secret store or HSM) plus an auth token.
- **Least privilege.** A new service account has no permissions. Use separate accounts for the adapter, the monitor (read-only) and the signing gateway.
- **Approvals happen in Dfns.** Human approvals use Dfns policies plus passkey (FIDO2) user-action signing. Only the checks Dfns cannot enforce go in our thin signing gateway: chain-ID pin, monitor `ALL_CLEAR`, CBS account/amount/route binding, and the replay rule.
- **Webhook verification.** Verify each Dfns webhook with HMAC-SHA256 (`X-DFNS-WEBHOOK-SIGNATURE`). The secret is shown only once at creation.

## Wrapper-call signing rule
Plain USDC value transfers are the default. Any contract call (`Memo`, `Multicall3From`, App Kit Swap, StableFX settlement) is allowed only if:
- the contract is allow-listed by exact address, in both Dfns policy and our gateway;
- the gateway **decodes the inner call(s)** and verifies that the target is the USDC contract (or the approved settlement contract), and that recipient and amount equal the CBS transfer record.

Tests must include tampered inner calls, which must be refused.

## How we work (phase discipline)
- **Blocks.** Generation blocks and verification blocks are separate and labelled. A block does one job: one unit, one fix, or one structural change, and structural changes travel alone. If more than two things could go wrong in a block, split it.
- **Fresh verification.** After every generation block, delegate verification to the **verifier** subagent (fresh context). Never verify your own block inline.
- **Edits and freezing.** Edits replace whole named units. Units that pass are frozen in docs/LEDGER.md.
- **Reconstruction.** Verify checkable properties by recomputing, re-tracing or re-fetching. Label anything that is inspection-only.
- **Agnosticism is a tested property.**
  - CBS-, custody-, quote-, route-, pay-in- and notifier-specific code lives only in its port adapter (`src/ports/*`), enforced by a dependency lint rule.
  - Each port has at least two structurally different implementations passing the same contract tests.
- **Perfecting loop.** Lens R (verifier), then Lens A (verifier), then Lens H (**cold-reader**). Exit after 3 consecutive POSITIVE passes. Cap 10 rounds plus 2 grace; regeneration budget 3. Plateau ladder: reframe, then regenerate, then structural mark.
- **Footer.** Every response ends with: `phase · units frozen/total · streak n/3 · rounds used/10 · regen budget left`

## Naming
- GL account roles are `GL-1` … `GL-7`, never `G1`… (to avoid clashing with gate names).
- Gates are `G0`, `G1`, `G1b`, `G2`, `G3`, `G-P1…`, `G-M1…`.

## Commands (keep current)
- build: `TBD`  · test: `TBD`  · mutation: `TBD`  · lint/SAST: `TBD`  · secrets: `gitleaks detect`  · guard self-test: `bash .claude/hooks/test-guard.sh`
