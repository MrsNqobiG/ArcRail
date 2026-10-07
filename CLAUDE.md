# CLAUDE.md — Arc rail integration (standing rules, merged with kit v3 for Raayl, CO-1 v3)

**Raayl context.** Raayl is the product: customer, API, KYB/KYC, pricing, ledger and reconciliation. DFNS is the existing wallet, signing, policy and treasury layer. Arc is an additional USDC settlement network. VALR/OTC providers handle fiat↔USDC liquidity. Flow: Customer → Raayl → DFNS → Arc → Recipient (CO-1 v3). **Extend Raayl's existing code; never build a parallel system.** Verify each existing component by reading the code; never assume it exists.

This repo adds Circle's **Arc Network** as an additional settlement rail to an **existing core banking system (CBS)**. That is the whole job. The CBS stays the system of record for customers, accounts, balances, KYC/AML and the general ledger. We build an **Arc Rail Adapter** beside it, plus only the integration points in the CBS that a human has approved. For Raayl, "CBS" means Raayl's own ledger and services, which are the system of record; any bank core system Raayl relies on stays read-only.

**Custody is the company's existing DFNS organisation** (dfns.co; the team sometimes says "Defence"). We do not build a second wallet, custody or approval system.

## Non-negotiables
1. **Testnet only.** Arc testnet chain ID 5042002, DFNS network `ArcTestnet`. Never configure, sign for or broadcast to Arc mainnet (chain ID 5042, DFNS network `Arc`) until the gates it needs in docs/GATES.md are signed by named humans: G3 (the testnet demonstration and evidence pack), then every G-P pilot gate, then every G-M gate. Mainnet config may be recorded but stays disabled in code, and a CI test proves it. A hook enforces this; do not try to get around it, and report it if it blocks something legitimate.
2. **No secrets.**
   - Never read, print, log or commit private keys, mnemonics, DFNS tokens or keys, webhook secrets, API keys or real .env files.
   - Credentials are read **only by the running service, from the secret store, at runtime**.
   - You, the agent, never call the DFNS, Circle or VALR production APIs directly.
   - All signing goes through the `Signer` interface. Tests use `MockSigner` with throwaway keys generated at test time, or stubs, recorded fixtures, or sandboxes driven by CI with runtime credentials.
3. **Read-only on existing systems.**
   - Existing Raayl code and the CBS are read-only until gate G1b is signed. After that, change them only through PRs on a feature branch reviewed by a human (Khumo), never by pushing to main, and only through the integration points in docs/CONTRACT.md and the CBS's normal change process.
   - Read-only on the DFNS org: never create or modify DFNS users, policies, permissions or wallets. Write what is needed into docs/DFNS_SETUP.md for the DFNS admin.
4. **No LLM or agent in the money path.** Every money decision comes from deterministic, tested code.
5. **Never guess.** Any fact about Arc, Circle (StableFX, CPN), DFNS, VALR, Raayl, the CBS or South African regulation must be verified from a primary source or from the code, and cited with URL and date in docs/constants.md or the source archive (docs/sources/MANIFEST.md). Otherwise write it to docs/OPEN_QUESTIONS.md and ask. Never fill a gap with a plausible value.
6. **Compliance status is human-owned.** For each control you may set NOT STARTED, IMPLEMENTED or EVIDENCED. Only a named human may set SIGNED-OFF.
7. **Gates are recorded.** Every gate (G0, G1, G0b, G1b, G2, G3, D1–D7, G-P, G-M) lives in docs/GATES.md with name, role, date, commit SHA and the option chosen for each ADR. "Approved in chat" is recorded but is not signed until the signer's own signed commit is in that file. The agent never writes a signature for anyone.

## Money invariants (zero tolerance, enforced in code, tests and at runtime)
- **Integer arithmetic only.** No floats anywhere on a money path. Amounts are branded types: `CbsMinor` (CBS minor units, e.g. ZAR cents), `UsdcUnits` (ERC-20 view, 6 dp), `NativeWei` (native gas/value view, 18 dp), plus one `FiatMinor<CCY>` per payout currency. Mixing types is a compile error. At an API edge amounts are decimal strings; inside they are integer base units.
- **One conversion module.** Rounding policy is explicit. Sub-unit dust goes to a named suspense account with a record; it is never silently dropped. Every quote leg (ZAR→USDC, any stablecoin swap, any fiat payout) is a separate, balanced posting. Gas paid in USDC is posted too, dust included.
- **Conservation.** For every business event, debits equal credits in the CBS (or Raayl ledger) and in the adapter sub-ledger, and the on-chain delta matches to the base unit.
- **Exactly once.** Idempotency keys are derived deterministically from business IDs. Use a transactional outbox/inbox. Each hot wallet has a single nonce writer.
- **Authenticity and dedupe on every inbound signal.** DFNS webhooks, CPN and StableFX callbacks, pay-in notifications and chain logs are each checked for authenticity (signature, HMAC or emitter) and deduplicated before use.
- **Fail closed.** Any reconciliation drift, RPC disagreement, unknown event or failed invariant pauses outbound movement and pages a human: PAUSE (whole rail) or QUARANTINE (one item). Two humans must approve the unpause.
- **Binding.** Account, amount, recipient and route are always taken from the server-side transfer record. Never echo them from client input.
- **`REVERSED` means a compensating ledger entry only**, never an on-chain reversal. Nothing on Arc can be reversed on-chain.

## Network abstraction
- Everything Arc-specific lives behind a network abstraction (`network = ARC`, `asset = USDC`), inside the Arc adapter only, so other networks (Base, Ethereum, others) can be added later.
- Keep the existing public `TransactionStatus`; lifecycle detail goes in a separate `stage` field with an explicit, tested mapping to status.
- Agnosticism is tested: a lint rule keeps network-specific code inside its adapter, and a second, fake network adapter passes the same tests.

## Arc facts to respect (verify each against docs.arc.io before use, via the `arc-docs` MCP server in `.mcp.json`; cite it in docs/constants.md)
- **Two views of one USDC balance.** USDC is the native gas token: native view at **18 decimals**, and the ERC-20 at `0x3600000000000000000000000000000000000000` at **6 decimals**.
- **Canonical log.** One ERC-20 transfer emits two Transfer logs: the EIP-7708 native log from system emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (18 dp) and the ERC-20 log (6 dp). Credit from exactly one canonical source and dedupe on (chainId, txHash, logIndex).
- **Fees.** Fee floor 20 gwei (constants C-30). The docs disagree on what happens under the floor: silently dropped, rejected with `transaction underpriced`, or left pending indefinitely (constants M-4). Enforce the floor before signing, and treat an RPC rejection, a silent drop and a transaction that never confirms as normal outcomes. Maximum base fee 20,000 gwei. There is no documented priority-fee cap, so enforce our own fee ceiling.
- **RPC limits.** `eth_getLogs` is capped at 10,000 blocks (`-32012`), so page in ≤9,999. Retry `-32014` with backoff.
- **Blocklist.** Per the docs, a transaction from a blocklisted sender is rejected before the mempool: it never appears on-chain and no gas is consumed (constants C-58; not yet reproduced on testnet, Q-A13). Blocklist reverts can consume gas without a normal receipt. The docs disagree on whether such a revert leaves a `status: 0` receipt or none; that fact is open as Q-A1, and constants M-1 says to design for both cases until it is settled. (Q-P2, the operator question on rewording this line, is still OPEN.) Keep a local copy of the USDC blocklist from `Blocklisted`/`UnBlocklisted` events and check it before every send.
- **Finality.** Finality is deterministic (BFT), so there are no reorgs. Liveness can still stall: handle "no new blocks".
- **Privacy.** Privacy features are not live, so everything on-chain is public. **No personal information on-chain, ever.**
- **Memo.** The predeployed `Memo` contract (`0x5294E9927c3306DcBaDb03fe70b92e01cCede505`) attaches a reference to a transfer and emits it as an event. Use it only with a non-PII reference (a hash of our transfer ID).
- **Batching.** The predeployed `Multicall3From` (`0x522fAf9A91c41c443c66765030741e4AaCe147D0`) batches calls but keeps our wallet as `msg.sender` (constants C-63). The archived docs do not say whether it emits a batch-level event (constants M-10, open), so never rely on one: verify every inner transfer individually.
- **Webhooks.** Arc does not push webhooks. Use `POST /webhooks/dfns` (HMAC-verified) plus our own Arc event indexer.
- CCTP domain for Arc is 26.

## DFNS facts (verify against docs.dfns.co; cite in the source archive)
- **Network names.** DFNS calls Arc mainnet `Arc` and testnet `ArcTestnet`. DFNS indexes Arc transactions after a 10-block confirmation delay, so **our own indexer is canonical** and DFNS events are a cross-check. "Completed" only after our own confirmed event.
- **Service accounts.** Our software authenticates as service accounts: a key pair (the private key stays in the secret store or HSM) plus an auth token.
- **Least privilege.** A new service account has no permissions. Use separate accounts for the adapter, the monitor (read-only) and the signing gateway.
- **Approvals happen in DFNS.** Human approvals use DFNS policies plus passkey (FIDO2) user-action signing. Only the checks DFNS cannot enforce go in our thin signing gateway: chain-ID pin, monitor `ALL_CLEAR`, account/amount/route binding to the server-side transfer record, and the replay rule.
- **Webhook verification.** Verify each DFNS webhook with HMAC-SHA256 (`X-DFNS-WEBHOOK-SIGNATURE`). The secret is shown only once at creation.

## Wrapper-call signing rule
Plain USDC value transfers are the default. Any contract call (`Memo`, `Multicall3From`, App Kit Swap, StableFX settlement) is allowed only if:
- the contract is allow-listed by exact address, in both DFNS policy and our gateway;
- the gateway **decodes the inner call(s)** and verifies that the target is the USDC contract (or the approved settlement contract), and that recipient and amount equal the server-side transfer record.

Tests must include tampered inner calls, which must be refused.

## How we work (phase discipline)
- Generation blocks and verification blocks are separate and labelled. A block does exactly one job: one unit, one fix, or one structural change, and structural changes travel alone. If more than two things could go wrong in a block, split it.
- After every generation block, delegate verification to the **verifier** subagent (fresh context). Never verify your own block inline.
- Edits replace whole named units. Units that pass are recorded as frozen in docs/LEDGER.md.
- Verify checkable properties by reconstruction (recompute, re-trace, re-fetch), not by inspection. Label inspection-only checks.
- Agnosticism is a tested property. CBS-, custody-, quote-, route-, pay-in-, notifier- and network-specific code lives only in its port adapter, enforced by a dependency lint rule. Each port has at least two structurally different implementations passing the same contract tests.
- Perfecting loop: Lens R (verifier), then Lens A (verifier), then Lens H (**cold-reader**). Exit only after 3 consecutive POSITIVE passes. Cap 10 rounds, plus 2 grace rounds. Regeneration budget 3. Plateau ladder: reframe, then regenerate, then structural mark.
- Every response ends with: `phase · units frozen/total · streak n/3 · rounds used/10 · regen budget left`

## Naming
- GL account roles are `GL-1` … `GL-7`, never `G1` … (to avoid clashing with gate names).
- Gates are `G0`, `G1`, `G0b`, `G1b`, `G2`, `G3`, `D1`…`D7`, `G-P 1`…, `G-M 1`… (docs/GATES.md).

## Commands (keep current)
- build: `npx tsc --noEmit && npm run build`  · test: `npx vitest run`  · mutation: `npx stryker run`  · coverage: `npx vitest run --coverage` · lint (MC-01 float lint): `node tools/lint-money-floats.mjs` · SAST: `.tools/semgrep-venv/bin/semgrep scan --metrics=off --error --config .tools/semgrep-rules/a84ff9cc2453ca91d581380de4b8b3f272f6f4be/javascript --config .tools/semgrep-rules/a84ff9cc2453ca91d581380de4b8b3f272f6f4be/typescript src test tools scripts` (tools: `bash scripts/install-tools-phase2.sh`) · SCA (offline osv-scanner): `bash scripts/sca.sh` (database: `bash scripts/fetch-osv-db.sh`) · full pipeline: `bash scripts/ci.sh` · secrets scan: `.tools/bin/gitleaks detect --no-git --source . --redact --gitleaks-ignore-path .gitleaksignore` · source drift: `python3 tools/source_drift.py --out docs/verification/source-drift-$(date +%F).md`  · guard self-test: `bash .claude/hooks/test-guard.sh`
