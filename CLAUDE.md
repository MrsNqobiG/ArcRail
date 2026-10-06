# CLAUDE.md — Arc rail integration (standing rules)

This repo adds Circle's **Arc Network** as an additional settlement rail to an **existing core banking system (CBS)**. That is the whole job. The CBS stays the system of record for customers, accounts, balances, KYC/AML and the general ledger. We build an **Arc Rail Adapter** beside it, plus only the integration points in the CBS that a human has approved.

## Non-negotiables
1. **Testnet only.** Arc testnet chain ID 5042002. Never configure, sign for or broadcast to Arc mainnet (chain ID 5042) until every gate in docs/GATES.md is signed by a named human. A hook enforces this; do not try to get around it, and report it if it blocks something legitimate.
2. **No secrets.** Never read, print, log or commit private keys, mnemonics, API keys or real .env files. All signing goes through the `Signer` interface. Tests use `MockSigner` with throwaway keys generated at test time.
3. **Read-only on the existing banking system** until gate G1 is signed. After that, change it only through the integration points listed in docs/CONTRACT.md, and only through its normal change process.
4. **No LLM or agent in the money path.** Every money decision comes from deterministic, tested code.
5. **Never guess.** If a fact about Arc, Circle, the CBS or South African regulation is not verified from a primary source or from the CBS code, write it to docs/OPEN_QUESTIONS.md and ask. Never fill a gap with a plausible value.
6. **Compliance status is human-owned.** For each control you may set NOT STARTED, IMPLEMENTED or EVIDENCED. Only a named human may set SIGNED-OFF.

## Money invariants (zero tolerance, enforced in code, tests and at runtime)
- Integer arithmetic only. No floats anywhere on a money path. Amounts are branded types: `CbsMinor` (CBS minor units), `UsdcUnits` (ERC-20 view, 6 dp), `NativeWei` (native gas/value view, 18 dp). Mixing types is a compile error.
- Conversions happen in exactly one module. Rounding policy is explicit. Sub-unit dust goes to a named suspense account with a record; it is never silently dropped.
- Conservation: for every business event, debits = credits in the CBS and in the adapter sub-ledger, and the on-chain delta matches to the base unit.
- Exactly-once: idempotency keys are derived deterministically from business IDs. Use a transactional outbox/inbox. Each hot wallet has a single nonce writer.
- Fail closed: any reconciliation drift, RPC disagreement, unknown event or failed invariant pauses outbound movement and pages a human.

## Arc facts to respect (verify each against docs.arc.io before use; cite it in docs/constants.md)
- USDC is the native gas token, so one balance has two views: native at **18 decimals**, and the ERC-20 at `0x3600000000000000000000000000000000000000` at **6 decimals**.
- One ERC-20 transfer emits two Transfer logs: the EIP-7708 native log from system emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (18 dp) and the ERC-20 log (6 dp). Credit from exactly one canonical source and dedupe on (chainId, txHash, logIndex).
- Fee floor 20 gwei. `eth_getLogs` is capped at 10,000 blocks, so page in ≤9,999. Retry `-32014` with backoff. Blocklist reverts can consume gas without a normal receipt.
- Finality is deterministic (BFT), so there are no reorgs. Liveness can still stall: handle "no new blocks".
- CCTP domain for Arc is 26. Privacy features are not live, so everything on-chain is public. **No personal information on-chain, ever.**

## How we work (phase discipline)
- Generation blocks and verification blocks are separate and labelled. A block does exactly one job: one unit, one fix, or one structural change, and structural changes travel alone. If more than two things could go wrong in a block, split it.
- After every generation block, delegate verification to the **verifier** subagent (fresh context). Never verify your own block inline.
- Edits replace whole named units. Units that pass are recorded as frozen in docs/LEDGER.md.
- Verify checkable properties by reconstruction (recompute, re-trace, re-fetch), not by inspection. Label inspection-only checks.
- Perfecting loop: Lens R (verifier), then Lens A (verifier), then Lens H (**cold-reader**). Exit only after 3 consecutive POSITIVE passes. Cap 10 rounds, plus 2 grace rounds. Regeneration budget 3. Plateau ladder: reframe, then regenerate, then structural mark.
- Every response ends with: `phase · units frozen/total · streak n/3 · rounds used/10 · regen budget left`

## Commands (fill in during Phase 0)
- build: `npx tsc --noEmit && npm run build`  · test: `npx vitest run`  · mutation: `npx stryker run`  · coverage: `npx vitest run --coverage` · lint (MC-01 float lint): `node tools/lint-money-floats.mjs` · SAST: `.tools/semgrep-venv/bin/semgrep scan --metrics=off --error --config .tools/semgrep-rules/a84ff9cc2453ca91d581380de4b8b3f272f6f4be/javascript --config .tools/semgrep-rules/a84ff9cc2453ca91d581380de4b8b3f272f6f4be/typescript src test tools scripts` (tools: `bash scripts/install-tools-phase2.sh`) · SCA (offline osv-scanner): `bash scripts/sca.sh` (database: `bash scripts/fetch-osv-db.sh`) · full pipeline: `bash scripts/ci.sh` · secrets scan: `.tools/bin/gitleaks detect --no-git --source . --redact --gitleaks-ignore-path .gitleaksignore` · source drift: `python3 tools/source_drift.py --out docs/verification/source-drift-$(date +%F).md`  · guard self-test: `bash .claude/hooks/test-guard.sh`
