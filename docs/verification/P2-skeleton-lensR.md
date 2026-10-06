VERIFICATION · lens: R · target: P2-skeleton · commit: none (uncommitted working tree, branch `main` has no commits; file hashes at check time: src/chain/config/index.ts sha256 551b2868ac1d3ce9…, src/cbs/port.ts 20fae32e18bae297…, scripts/ci.sh a4cd19779ee2aee9…)

Verifier: independent Lens R pass, 2026-10-05. Inputs: KICKOFF_PROMPT.md "Phase 2", docs/PHASE2_SLICE_PLAN.md, docs/RUBRIC.md (MC-01, MC-02, MC-07/08, MC-20, MC-21, MC-33, MC-34, money-path list), docs/CONTRACT.md §1–§4 and §6, docs/constants.md, docs/GATES.md, the code and the tests. The author's LEDGER summary was not relied on; every number below was re-run.

Guard rules obeyed by hand (hook not loaded): only Arc testnet (5042002) read-only RPC (`eth_chainId`, `eth_getBlockByNumber`); no mainnet endpoint; no signing or sending; no .env or key file read (the one fake key fixture was printed masked). No file under src/, test/ or the repo root was edited. Mutants were planted only in a scratch copy under /tmp, which was diffed back to identical and deleted. All /tmp scratch files were deleted. Running `scripts/ci.sh` regenerated the git-ignored outputs `dist/`, `reports/mutation/` and `sbom.cdx.json`, as the author's own run did. `npm ci` reinstalled `node_modules/`. `git status` is unchanged.

## CHECKS

### Build, tests, CI (re-run, not read)
- C1 `npm ci` (Node v22.23.3 / npm 10.9.9 from .tools/node) → PASS: exit 0, "added 383 packages".
- C2 `npx tsc --noEmit` → PASS: exit 0. This includes test/types/amount-mixing.typecheck.ts.
- C3 `npx vitest run` → PASS: 5 files, 124/124 tests. The verbose recount also gives 124, which matches the LEDGER row.
- C4 `bash scripts/ci.sh` → PASS, exit 0, "CI PASSED". Stages that ran: typecheck; emit to dist/; vitest 124/124; Stryker 60 mutants, 60 killed, 0 survived, 0 no-cov, score 100.00 ≥ break 90; gitleaks 8.30.1 "no leaks found" over ~64 MB; SBOM "CycloneDX 1.6, 355 components". Four stages print SKIPPED: osv-scanner, Semgrep, cosign, SLSA.
- C5 The CI script fails on real failures → [inspection-only] PASS. It runs under `set -euo pipefail`. Stryker has `break: 90`. gitleaks exits 1 on a finding, confirmed in C6. `skipped_tool` returns 1 when the tool is installed but not wired in.
- C6 gitleaks really detects secrets → PASS. A throwaway random hex "PRIVATE_KEY" plus an aws_secret line, planted in /tmp, gave exit 1 and "leaks found: 2". The scratch copy was deleted.
- C7 The .gitleaksignore entries are false positives → [inspection-only] PASS. test-guard.sh:27 is a deny-test fixture (`t deny Write … 'const PRIVATE_KEY = "<MASKED>"'`). The other four entries are archived docs, a vendored Node header and report prose.

### Dependencies pinned by hash (KICKOFF, MC-33)
- C8 Every direct dependency is pinned exactly → PASS. All 8 entries in dependencies, devDependencies and overrides match `^\d+\.\d+\.\d+$` and equal the lockfile version.
- C9 Every lockfile package has an integrity hash → PASS. The script read lockfileVersion 3. All 406 package entries carry `integrity` (all sha512) and a `resolved` URL on registry.npmjs.org. There are 0 links and 0 non-registry sources.
- C10 Direct dependencies were published at least 7 days before 2026-10-05 (README claim) → PASS for the 8 direct packages, from `npm view … time`: the newest is viem 2.56.9 on 2026-09-24. Transitive packages were not checked.
- C11 Toolchain checksums → PASS. `.tools/node.sha256` (df450af8…02de) equals nodejs.org SHASUMS256 for node-v22.23.3-linux-x64.tar.xz. `.tools/gl.sha256` (551f6fc8…70eb) equals the gitleaks v8.30.1 release checksums. Both were re-fetched. The tarballs are no longer on disk, so the installed binaries can't be re-hashed against them.
- C12 Hash pinning has no gap at install time → FAIL (minor, m6). `node_modules/libxmljs2` (dev dependency, via @cyclonedx/cyclonedx-npm) has `"install": "prebuild-install || node-gyp rebuild"`. `npm ci` ran it (ignore-scripts=false) and fetched `build/Release/xmljs.node`, a native binary that no lockfile hash covers. ci.sh also never runs `npm ci`, so the pipeline doesn't enforce the lockfile against the existing node_modules.
- C13 SCA proxy → [informational] `npm audit`: 0 critical, 0 high, 2 moderate (qs 6.15.1 via typed-rest-client 2.3.1 via @stryker-mutator/core; dev only). This is not a substitute for the required SCA stage (D2).

### Module layout, interfaces and branded types (KICKOFF Phase 2, slice plan "Skeleton")
- C14 Module per unit → PASS. U1–U13 plus src/cbs all exist. The smoke test checks each module's exact export set, and every stub throws `not implemented: <unit>` (31 stubs, re-run).
- C15 MC-02: mixing CbsMinor, UsdcUnits and NativeWei fails to compile → PASS by reconstruction. The test strips the 25 `@ts-expect-error MIX:` directives, recompiles, and requires each tagged line to fail with exactly its TS code: TS2322 or TS2345 for all 6 ordered pairs, by assignment and by argument; TS2367 for the 3 equality pairs; TS2322 for the 3 cross-type sums; plus bigint and number posing as a brand. My own mutant M7 (NativeWei given the 'UsdcUnits' brand, scratch copy): `tsc` exit 2, and amount-mixing.test 5 failed. The harness catches a collapsed brand.
- C16 MC-01: no float on a money path → [grep] PASS for the current code. `parseFloat`, `Number(`, `toFixed`, `Math.` and float literals don't appear in src. The `number` types are an RPC error code, a chainId and the precision p, none of them amounts. **The required lint rule and a planted-float test are absent** (D3).
- C17 Unit conversions (CONTRACT §6.1) recomputed by exact integer division → PASS for the contract values: 9 rows at p = 6 and 4 at p = 2, plus the round trip m·k + dust = w for each; the USDC row (1,234,567,890,123,456,789 wei → 1,234,567 units, remainder 890,123,456,789); 21,000 × 20 gwei = 420,000,000,000,000; and i64-max·10¹² + (10¹² − 1) equal to the table's largest w. The code conversions are U1 stubs that throw, so they fail closed. There is nothing to compare yet.
- C18 Amount constructors → PASS (re-run). 0, 1 and 9,223,372,036,854,775,807,999,999,999,999 are kept exactly. −1 gives RangeError. A number or string gives TypeError. Property tests: 1,000 runs each over [0, 2²⁵⁶] and [−2²⁵⁶, −1]. Stryker: amounts 26/26 killed.

### CBS port against CONTRACT §3/§4 (scripted diff)
- C19 §3 operation set → PASS. The script parsed 16 §3 rows: getAccountStanding, postJournal, getResultByKey, placeHold, releaseHold, settleHold, screen, createCase, submitMonitoringEvent, getTravelRuleOriginator, requestApproval, getApproval, getBalancesAsOf, listJournals, fileReportData, replayEvents. `CbsPort` has exactly these 16 methods, and no extras.
- C20 §3 request and response fields per operation → PASS for 15 of 16 operations: no missing and no extra fields. The script resolved nested types too.
- C21 postJournal `refs` → **FAIL (blocking, D1)**. CONTRACT §3 gives `refs:{subjectRef, caseId?, dispositionSeq?, instructionId?, address?, txHash?, assignRef?:{caseId, dispositionSeq}}`. src/cbs/port.ts:38-45 `JournalRefs` has subjectRef, caseId, instructionId, address, txHash and assignRef, but **no top-level `dispositionSeq`**. `listJournals` returns the same `JournalRefs`, so the field is missing there as well.
- C22 legs naming → FAIL (minor, m8). CONTRACT says `legs:[{glOrAccountRef, side, amount}]`. port.ts:27-31 uses `account: GlRole`. The typed GlRole is richer than the contract's field, but the field name differs from the contract.
- C23 createCase reasons → PASS. CONTRACT has 21 and port.ts has 21, same set and same order.
- C24 §1.4 REJECTED codes → PASS. Both lists hold the same 13 codes in the same order, and the frozen array is tested.
- C25 §1.3 key tuples → [scripted and inspected] PASS. All 15 key names are present, each `K` matches the table, and `attempt` is the last element of each (K.scr, K.case, K.mon, K.appr and K.rpt have it appended). The §1.2 subject arrays (9) match.
- C26 §4 events → PASS. PayoutOutcome (8 states, same set), AccountStatusChanged, HoldChanged, ScreeningOutcome, ApprovalDecided and CaseDisposition have no missing or extra fields. Dispositions RELEASE, HOLD, RETURN, ASSIGN and CANCEL match the §5 rows. submitPayoutInstruction has the 5 REJECTED codes. One gap: its `amount` is typed `WireAmount` (any UnitTag), where §4 says `CBS_MINOR` (minor, m8).
- C27 §5 state names → [scripted, partial] PASS. Every non-terminal state in §5.3–§5.6 appears in the matching union. Terminal states match §1.7.

### Mainnet lock (MC-20; GATES.md)
- C28 No SIGNED-OFF row anywhere in the repo → PASS. `grep '| *SIGNED-OFF *|'` over all .md files outside node_modules finds nothing. GATES.md mentions SIGNED-OFF only in its prose (lines 3 and 5). All G-M 1–8 rows read NOT SIGNED.
- C29 The only mainnet references in code are `chainId: 5042` in the disabled entry and its test → PASS. No mainnet endpoint appears in src.
- C30 Gate logic re-traced against GATES.md → PASS. Rows are parsed by `^G-M\s*\d+$` on cell 0, with the status taken from cell 2 (the table is Gate | Requirement | Status | Name | Role | Date). Each required gate needs exactly 1 row with status `=== 'SIGNED-OFF'` and a non-empty name, role and date. An unexpected G-M row fails. An unreadable file fails. A bolded or otherwise reformatted gate cell drops out as missing, so it also fails closed. `resolveChain(5042)` runs the gate check and then throws unconditionally, and its return type is `TestnetChainConfig` only.
- C31 MC-20 test fails when mainnet is reachable while unsigned, and passes when all are signed → PASS by planted mutants (scratch copy, restored and diffed identical). M1 (`includes('SIGNED-OFF')`) killed. M2 (duplicates allowed) killed. M3 (unexpected-row check removed) killed. M4 (gate call removed from resolveChain) killed. M5 (`||` → `&&` on name, role and date) killed (3 tests). **M6 survived:** it replaced the unconditional mainnet `throw` (config/index.ts:207) with `return ARC_TESTNET`. No test exercises resolveChain with signed gates, because `DEFAULT_GATES_FILE` is hard-wired (minor, m4).
- C32 Content check versus MC-42 provenance → [inspection-only] observation. `assertMainnetAllowed` accepts a gate on the file's text alone. Its comment says MC-42 git provenance is a separate control, and that control doesn't exist in CI yet. The lock still holds, because of the unconditional throw (folded into m4).

### Constants cited (MC-21; docs/constants.md)
- C33 Every value in ARC_TESTNET equals its constants.md row → PASS by recomputation. C-01 5042002. C-03 HTTP and WS URLs. C-05 USDC. C-06 the explorer URL. C-10 18. C-11 6. C-12 0x3600…0000. C-20 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE, re-checksummed with viem `getAddress`, identical. C-21: keccak256("Transfer(address,address,uint256)") recomputed as 0xddf252ad…b3ef. C-30 20×10⁹ = 20,000,000,000. C-31 20,000×10⁹ = 2×10¹³. C-32 30,000,000. C-40: 9,999 and −32012. C-41 −32602 (UNVERIFIED, Q-A4). C-42 −32014. C-56 EIP-155. C-60 26.
- C34 Live testnet re-derivation, read-only → PASS. `eth_chainId` on https://rpc.testnet.arc.io returned 0x4cef52 = 5042002. The latest block (65,646,027) has baseFeePerGas 20,000,000,000 (C-30), gasLimit 30,000,000 (C-32) and extraData 0x00000004a817c800, which is 20 gwei (C-33).
- C35 MC-21 shared method: the verifier ran tools/source_drift.py itself → PASS. Its sha256 5504b5e7…80e1 equals the version reviewed in earlier verifier reports. Run to /tmp: 0 integrity failures, 0 drifted URLs, 0 fetch errors, 33 URLs checked, all identical. Each code-loaded quote was found in the archive the tool compared: rpc-endpoints for C-01/02/03/05/06/40/42; evm-differences.REFETCH-later for C-10/11 (line-wrapped at :81) and C-30; contract-addresses for C-12 and C-60; usdc-system-events for C-20/21/22; gas-and-fees for C-31/32; custody for C-56; circle cctp for "| 26 | Arc |".
- C36 C-40 page size interpretation → [inspection-only] PASS. The config comment reads "≤9,999 blocks inclusive, i.e. to − from ≤ 9,998". That is conservative against the docs ("≤9,999-block chunks"). The live observation in C-40 is that to − from = 9,999 passed.

### Mutation (MC-08) and coverage (MC-07) configuration
- C37 The Stryker mutate set covers the RUBRIC money-path list → PASS at directory level. Item 1 → amounts, 2 → ingestion, 3 → inbound, 4 → signer, 5 → policy, 6 → chain/client, 7 → outbound, 8 → gas, 9 → recon, 10 → cbs/translator.ts. Break threshold 90 (score ≥ 90). docs/MONEY_PATH.md doesn't exist yet. Item 10's named parts (the hold operations, `getResultByKey`, the §1.4 AMBIGUOUS resolution) have no stub path, and src/cbs/keys.ts (idempotency keys) is neither listed nor excluded (minor, m2).
- C38 The mutation score is real → [re-run] PASS. 60/60 killed. Apart from the 26 amounts mutants, these are mostly stub-string and block mutants, as expected for a skeleton.
- C39 MC-07, 100% reachable-branch coverage → FAIL (minor, m1). No coverage provider is installed (no @vitest/coverage-*), vitest.config.ts has no coverage section, ci.sh has no coverage stage, and docs/COVERAGE_EXCLUSIONS.md is absent.

### Required CI stages (KICKOFF Phase 2; MC-33)
- C40 Build and tests → PASS (C2–C4).
- C41 Mutation on money modules → PASS (C37, C38).
- C42 gitleaks → PASS (C4, C6).
- C43 SBOM (CycloneDX) → PASS: generated and validated as CycloneDX 1.6 with components. Two gaps (minor, m9): 0 of 383 components carry hashes, and ci.sh includes dev dependencies while `npm run sbom` uses `--omit dev`.
- C44 SCA (osv-scanner or Trivy) → **FAIL (blocking, D2)**. The stage prints SKIPPED. The slice plan names osv-scanner inside the Skeleton row itself ("CI script (build, test, mutation on money modules, gitleaks, osv-scanner, SBOM)").
- C45 SAST (Semgrep) and the MC-01 float lint → **FAIL (blocking, D3)**. The stage prints SKIPPED, and no lint rule or float grep exists anywhere in CI.
- C46 cosign and SLSA provenance → FAIL (minor, m5). Both print SKIPPED. The slice plan explicitly stubs them "with a TODO for G2" and lists them under "Explicitly out of the slice". MC-33 can't pass at G2 until they exist.
- C47 Test harness includes "contract tests against the CBS, Arc testnet E2E" → FAIL (minor, m3). vitest.config.ts has only the `unit` and `property` projects.

### Other applicable items
- C48 MC-34: no LLM or agent SDK → PASS. The src imports are only internal modules and `node:fs`. The lockfile packages matching "agent" are HTTP agents (agent-base, https-proxy-agent, …), not LLM SDKs. The egress allow-list file is absent; no module has egress yet (observation O3).
- C49 No secrets in code → PASS. There is no `process.env`, `.env`, `privateKey` or mnemonic in src, test or scripts. `MockSigner` is a stub that throws.
- C50 The CLAUDE.md Commands line is runnable and correct → FAIL (minor, m7). `secrets scan: gitleaks detect` doesn't run as written: `command -v gitleaks` finds nothing. Run as `.tools/bin/gitleaks detect --source .` in git mode on this commit-less repo, it reported "0 commits scanned … no leaks found" with exit 0, a false green. The working command is the one in ci.sh (`--no-git … --gitleaks-ignore-path`). The same line labels `npx tsc --noEmit` as "lint/SAST", which it isn't.
- C51 The README "Phase 2 skeleton" section is accurate → PASS. Commands, layout, the SKIPPED stages and the pins all match what was run. The 7-day publication claim holds for the direct packages (C10).
- C52 Counts against LEDGER P2-skeleton → PASS. tsc pass, vitest 124/124, Stryker 60 mutants at 100%, gitleaks clean with 5 listed false positives, SBOM 355 components, 4 SKIPPED: all re-derived identically.

## DEFECTS
- **D1** · src/cbs/port.ts:38-45 (`JournalRefs`, also returned by `listJournals` at :190-204) · Lens R, CONTRACT §3 `postJournal` refs and the T9/T10 `RETURN` binding (contract R13 D1, MC-17(b), money-path item 10) · **blocking**.
  - **What's wrong:** `dispositionSeq` is missing. CONTRACT requires T9/T10 to carry `refs.caseId` **and** `refs.dispositionSeq` of the `RETURN` disposition. The CBS uses both to bind a case return to its own `RETURN`, recomputing `cr-` + SHA-256(["arc1","cr",caseId,dispositionSeq]) and checking R = returnAmount. DR-29 joins T9/T10 to their item through the same pair.
  - **Effect now:** with `exactOptionalPropertyTypes`, the translator can't express the field.
  - **Effect against a conforming CBS:** every T9/T10 is `REJECTED{INVALID}` → PAUSE. That fails closed.
  - **Why blocking:** the in-repo CBS stub and the Phase 2 contract tests will be written against this port, and they can't implement or test the `RETURN` binding. So the wrong-record mutant (a genuine return netted from another item, which misposts two customers "with every control at 0") would pass them.
  - **Fix:** add `readonly dispositionSeq?: DecimalString` to `JournalRefs`, and a test that reconciles the refs field set with CONTRACT §3.
- **D2** · scripts/ci.sh:60 (`skipped_tool "vulnerabilities: osv-scanner"`) · Lens R, KICKOFF Phase 2 "SCA (osv-scanner/Trivy)", MC-33, PHASE2_SLICE_PLAN Skeleton row · **blocking**.
  - **What's wrong:** there is no SCA stage. The slice plan puts osv-scanner inside the skeleton's own scope, not among the deferred items.
  - **Effect:** CI goes green with a dependency that has a high or critical advisory. MC-33 requires 0 high or critical findings.
  - **Today's state:** `npm audit` currently shows 0 high and 0 critical, so no present advisory has slipped through. The gate itself is missing.
- **D3** · scripts/ci.sh:61 (`skipped_tool "SAST: Semgrep"`) plus the absence of any MC-01 lint · Lens R, KICKOFF Phase 2 "SAST (Semgrep)", MC-01 ("The lint must fail on a planted float"), MC-33 · **blocking**.
  - **What's wrong:** CI has no SAST stage, and no float lint or grep runs on the money-path modules. src/amounts/index.ts:17-22 itself defers the re-brand lint to U1.
  - **Effect:** the bigint brands stop implicit mixing, but `cbsMinor(BigInt(Math.floor(x * 100)))` compiles and passes every current stage. U1, the next unit and the conversion module, could put a float on a money path with CI green.
  - **Context:** CLAUDE.md's "lint/SAST: `npx tsc --noEmit`" isn't a substitute.
- **m1** · vitest.config.ts, scripts/ci.sh · MC-07 / KICKOFF §3 "100% branch coverage on money-path modules" · minor.
  - No coverage provider, threshold or CI stage exists, and docs/COVERAGE_EXCLUSIONS.md is absent.
  - Mutation at ≥ 90% (no-cov mutants count as survivors) bounds the gap, but it doesn't reach 100% branch coverage.
  - Needed before the first money-path unit freezes.
- **m2** · stryker.config.json:3,10-21; docs/MONEY_PATH.md absent · RUBRIC money-path list ("Phase 2 records the matching source paths in docs/MONEY_PATH.md", import-graph closure) · minor (the deferral is declared).
  - src/cbs/keys.ts (CONTRACT §1.3 keys) is neither listed nor excluded.
  - Item 10's hold operations, `getResultByKey` and AMBIGUOUS resolution have no path.
- **m3** · vitest.config.ts:5-21 · KICKOFF Phase 2 test harness ("contract tests against the CBS, Arc testnet E2E") · minor.
  - Only the `unit` and `property` projects exist.
  - There is no contract-test project and no testnet E2E project, even read-only, with the guard in place.
- **m4** · src/chain/config/index.ts:203-210 and test/unit/mainnet-gate.test.ts · MC-20 · minor. The lock holds today.
  - **Untested barrier:** the second barrier (`throw … disabled in code`, :207) is untested. Planted mutant M6 (`return ARC_TESTNET`) survived, because `resolveChain` hard-wires `DEFAULT_GATES_FILE` and can't be run against a signed fixture.
  - **"Passes otherwise" fails:** tests :47-50 and :124-126 assert that the real GATES.md is *unsigned*. So CI goes red once humans legitimately sign every G-M gate, which contradicts MC-20's "passes otherwise" unless the same reviewed change enables mainnet.
  - **Provenance gap:** `assertMainnetAllowed` accepts on the file text without MC-42 provenance. This is documented at :165-167.
- **m5** · scripts/ci.sh:62-63 · KICKOFF Phase 2 (cosign, SLSA), MC-33 · minor here. The deferral is sanctioned by PHASE2_SLICE_PLAN ("stubbed with a TODO for G2") and gates no code defect. It is a hard prerequisite for G2 and MC-33.
- **m6** · scripts/ci.sh:32, package-lock.json (`node_modules/libxmljs2` hasInstallScript) · KICKOFF "Pin all dependencies by hash" · minor (dev toolchain only).
  - libxmljs2's install script downloads a prebuilt native `xmljs.node` that no hash covers.
  - CI never runs `npm ci` (it only checks that node_modules exists), so the lockfile integrity isn't enforced by the pipeline.
  - Suggested: `npm ci --ignore-scripts` in CI, or pin and verify the prebuilt.
- **m7** · CLAUDE.md:36 (Commands) · CLAUDE.md "Commands" accuracy · minor.
  - `gitleaks detect` isn't on PATH. With the repo binary in git mode it scans 0 commits and reports a false "no leaks found".
  - "lint/SAST: `npx tsc --noEmit`" mislabels a typecheck.
  - Use the ci.sh gitleaks invocation.
- **m8** · src/cbs/port.ts:27-31 and src/cbs/events.ts:17-24 · CONTRACT §3/§4 field fidelity · minor.
  - `legs[].account` differs from CONTRACT's `glOrAccountRef`.
  - `submitPayoutInstruction.amount` accepts any `UnitTag`, where §4 says `CBS_MINOR`.
- **m9** · scripts/ci.sh:51 versus package.json:18 · MC-33 SBOM quality · minor. The SBOM components carry no hashes (0/383), and the two SBOM commands disagree on `--omit dev`.

## Observations (not defects of this unit)
- **O1.** PHASE2_SLICE_PLAN says "Nothing here runs before G1 is signed". GATES.md records G1 as NOT SIGNED, approved by the operator in chat, with formal signature pending (MC-42). The skeleton was generated on the chat approval. That is the operator's decision, and LEDGER records it.
- **O2.** `SignRefusal` (src/signer/index.ts:53-67) has no distinct reasons yet for a stale, out-of-sequence or wrong-key attestation (MC-25(a)) or for a config-version mismatch (MC-25(c)). For U9.
- **O3.** There is no egress allow-list file for MC-34 yet. It is needed before U3 adds network egress.
- **O4.** The amount constructors have no upper bound (2²⁵⁶ is accepted). For U1 and the CONTRACT §6 overflow guard.

VERDICT: NEGATIVE (12 defects: 3 blocking [D1, D2, D3], 9 minor [m1–m9])
