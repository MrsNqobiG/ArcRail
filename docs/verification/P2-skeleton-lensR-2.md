VERIFICATION · lens: R · target: P2-skeleton (after fix block 1) · commit: none (uncommitted; branch `main` has no commits). Tree hash of src/ test/ tools/ scripts/ (sorted sha256sum, `__pycache__` excluded) = 4cb893f97fe9ade1…; src/chain/config/index.ts 96012c232038…; src/cbs/port.ts a69bbafc2535…; scripts/ci.sh 266b2c7378e9…

Verifier: independent Lens R pass, round 2, 2026-10-05.
- **Inputs:** KICKOFF_PROMPT.md Phase 2; docs/PHASE2_SLICE_PLAN.md; docs/RUBRIC.md (MC-01, MC-02, MC-07, MC-08, MC-17(b), MC-20, MC-21, MC-33, MC-34, the money-path list and import-graph closure); CONTRACT §1.1, §3 and §4; docs/constants.md; the code and the tests.
- **Not relied on:** the author's LEDGER line and tooling notes. Every number below was re-run.
- **Guard rules, obeyed by hand:**
  - Network: only Arc testnet (5042002) read-only RPC (`eth_chainId`, `eth_getBlockByNumber latest`). No mainnet endpoint, no signing or sending method, no .env or key file read.
  - Fixtures: the one secret fixture was a random hex generated in /tmp and deleted.
  - Writes: no file was edited under src/, test/, tools/, scripts/ or the repo root.
  - Mutants: all were planted in /tmp copies (`/tmp/vr2-work`, `/tmp/vr2-sca`). Each copy was diffed identical to the repo afterwards, and every /tmp scratch file was deleted.
  - Side effects of running `scripts/ci.sh`: it regenerated the git-ignored outputs (`dist/`, `coverage/`, `reports/`, `sbom.cdx.json`), and `npm ci --ignore-scripts` reinstalled `node_modules/`.
  - Stability: no in-scope file changed during the pass. I checked this by mtime (nothing newer than 18:14) and by the tree hash above. Other agents were active: `.tools/drafts/phase3_slice.js` changed at 18:17, but that file is out of scope.

## Closure of round-1 defects (by reconstruction)

| ID | Status | Evidence |
|---|---|---|
| D1 port `refs.dispositionSeq` | **CLOSED** | `src/cbs/port.ts:57-65` `JournalRefs` = subjectRef, caseId?, dispositionSeq?, instructionId?, address?, txHash?, assignRef?. That matches CONTRACT §3 field for field, with the same `?` markers. `listJournals` returns the same type. My mutant P1 (field removed) was killed by the checker: "§3 postJournal request.refs: field "dispositionSeq" is in CONTRACT but missing from the port". |
| D2 no SCA stage | **CLOSED** | `scripts/sca.sh` is called from ci.sh:111. It runs osv-scanner 2.6.0 `scan source --offline --offline-vulnerabilities`. **Offline-only:** under `unshare -rn` (no network namespace) the stage passes, with the minimist self-test caught. With an empty cache dir and the network available, osv-scanner exits 127 with "no offline version", which shows it did not download. **Fails closed:** a missing DB, a hash mismatch and a DB 7 days old each exit 1 with the stated message. A hollow but valid zip, with the record's sha256 updated to match, is caught by the minimist self-test (exit 1). Scanner exit >1 gives `return 2`, and the stage stops under `set -e`. The gate logic was probed with crafted JSON: HIGH, CRITICAL, MODERATE+CVSS 7.0, unknown, unparseable score, MAL- without severity, empty input and missing `results` all fail. MODERATE 6.9 and LOW pass. |
| D3 no SAST / no MC-01 lint | **CLOSED as stated** | Semgrep 1.178.0 runs the vendored JS/TS rules (34 files, 0 findings, `--error`). The vendored rules work: my planted `eval(cmd)` gave `eval-detected`. The MC-01 Semgrep layer and the type-aware lint (13 files, 0 findings) both run in CI. The round-1 example `cbsMinor(BigInt(Math.floor(x*100)))` is caught by both layers (F10). **A new hole in the same control is D4 below.** |
| m1 coverage | **CLOSED** | `@vitest/coverage-v8` 4.1.11 is in place, with per-file thresholds of 100/100/100/100 over exactly the MONEY_PATH paths. The CI stage runs at ci.sh:70-72. coverage-summary.json lists all 13 files at 100% (37/37 statements, 4/4 branches, 32/32 functions). My plant CV1 (an uncovered branch in src/gas) made `vitest run --coverage` exit 1: "Coverage for branches (0%) does not meet global threshold (100%) for src/gas/index.ts". docs/COVERAGE_EXCLUSIONS.md exists. CV2 (`/* v8 ignore next */` with no row) was killed by money-path.test.ts. |
| m2 MONEY_PATH.md / keys.ts | **CLOSED** | MONEY_PATH.md lists 13 paths, including src/cbs/keys.ts, port.ts and result.ts. 37 named parts cover RUBRIC items 1–10, with each ADR-001 duty 1–6, config load and the signing-log writer for item 4; the hold ops, `getResultByKey` and AMBIGUOUS resolution for item 10. Stryker `mutate`, the coverage include and the lint file set equal the list (test). CV3 (an unlisted helper imported at runtime) was killed: "neither listed nor excluded". A remaining weakness is m12. |
| m3 contract / E2E projects | **CLOSED** | vitest.config.ts has the projects unit, property, contract and e2e. The e2e project makes one read-only `eth_chainId` call through `resolveChain(5042002)` and is skipped unless ARC_E2E=1. |
| m4 mainnet-gate test design | **CLOSED** | `resolveChain(chainId, gatesFile)` now accepts a fixture. Mutants G1–G9 were all killed. G1 is the round-1 survivor M6 (`throw` → `return ARC_TESTNET`): 1 failed. G2–G9 were: gate call removed, `includes('SIGNED-OFF')`, duplicates allowed, unexpected-row check removed, `||`→`&&`, testnet branch also accepting 5042, unreadable file passes, status column off by one. The tests against the real GATES.md check structure only, so they stay green after humans sign. |
| m5 cosign / SLSA | **OPEN (narrowed, minor)** | Honestly declared: ci.sh:40-50 and :138-139, README:45, tooling-phase2.md:105-109, slice plan:18. The stage fails if `cosign` or `slsa-verifier` is installed but not wired in. **Not enforced as a G2 item:** GATES.md:12 reads "\| G2 \| Phase 2 skeleton \| NOT SIGNED \|", which names no precondition, and nothing fails if G2 is signed while both stages print SKIPPED. |
| m6 install scripts | **CLOSED** | `.npmrc` has `ignore-scripts=true`, and ci.sh:58 runs `npm ci --ignore-scripts`. After my `npm ci --ignore-scripts`, `node_modules/libxmljs2/build` is absent. CI passes without it. |
| m7 CLAUDE.md Commands | **CLOSED** | I ran each command as written. The gitleaks `--no-git … --gitleaks-ignore-path` form gave "no leaks found", exit 0. The Semgrep line gave 33 files, 0 findings, exit 0. `node tools/lint-money-floats.mjs` gave 13 files, 0 findings. The "lint/SAST: tsc" mislabel is gone. |
| m8 port field fidelity | **CLOSED** | `JournalLeg.glOrAccountRef` is now named as in CONTRACT. `SubmitPayoutInstruction.amount: CbsMinorWireAmount` (unit `CBS_MINOR:${string}`). P10 (payout amount → `WireAmount`) was killed: "CONTRACT says CBS_MINOR, port unit type is UnitTag". P11 (`CbsMinorTag = UnitTag`) was killed. |
| m9 SBOM | **CLOSED** | `npm run sbom` is the only SBOM command (`--omit dev --package-lock-only`), and ci.sh:120 calls it. The output is CycloneDX 1.6 with 15 runtime components (viem's tree, plus the typescript peer), and 15/15 carry a SHA-512 `distribution` hash. `npm ls --omit dev` gives 15 plus the root. |

## CHECKS

### Build, tests, CI (re-run)
- C1 `npm ci --ignore-scripts` (Node v22.23.3, npm 10.9.9 from .tools/node) → PASS, exit 0.
- C2 `npx tsc --noEmit` → PASS, exit 0.
- C3 `npx vitest run` → PASS: 8 files passed and 1 skipped (e2e). 196 tests passed and 1 skipped (197). This matches the LEDGER self-report of 196.
- C4 `bash scripts/ci.sh` → PASS, exit 0, "CI PASSED". Stages in order:
  - tool integrity: "tools OK";
  - `npm ci --ignore-scripts`;
  - tsc and emit;
  - vitest 196 passed + 1 skipped;
  - coverage 100% on 13 files;
  - MC-01 lint: 0 findings;
  - Semgrep vendor rules: 0 findings;
  - Semgrep MC-01 layer: 0 findings;
  - Semgrep self-test: 4/4 caught;
  - SCA: 0 blocking and 3 report-only (qs 6.15.1 MODERATE CVSS 6.3, dev only), with minimist caught;
  - Stryker: 72 mutants, 72 killed, score 100.00 ≥ break 90 (amounts 26, keys 10, translator 4, client 4, gas 4, ingestion 4, outbound 4, recon 4, signer 8, inbound 2, policy 2);
  - gitleaks: "no leaks found" over ~64.3 MB;
  - SBOM: 15/15 hashed;
  - cosign and SLSA: SKIPPED with the stated reason.
- C5 gitleaks still detects secrets → PASS. A random 32-byte hex `PRIVATE_KEY`, planted in /tmp, gave "leaks found: 1" and exit 1.
- C6 .gitleaksignore suppresses exactly 5 real findings → PASS. I copied the 5 files into /tmp and ran gitleaks without the ignore file: exactly those 5 fingerprints were reported, at the same file:rule:line.

### Tool hashes re-derived from official sources (tooling-phase2.md)
- C7 osv-scanner v2.6.0 → PASS. The official `osv-scanner_SHA256SUMS` gives `osv-scanner_linux_amd64` = ca69b3d3…b108. The installed `.tools/bin/osv-scanner` has the same hash. The GitHub API dates the release 2026-09-14T02:55:16Z.
- C8 uv 0.12.19 → PASS. The official `.sha256` = 23bf5552…d8c8. I re-downloaded the tarball: same hash. The extracted binary is 242e462a…2563, equal to `.tools/bin/uv`. Published 2026-09-25T00:33:02Z.
- C9 Semgrep 1.178.0 → PASS. The PyPI JSON gives the manylinux_2_34_x86_64 wheel as b7c4a4ba…41f2 (uploaded 2026-09-23). That hash and the sdist hash (0267a4fb…) are both in `tools/semgrep/requirements.txt`. The file has 66 pinned packages and 873 `--hash` lines, and its sha256 is a0837cdc…2b6d, as documented. The installed semgrep-core is 83223753…eca4, as documented [no official reference for this value].
- C10 semgrep-rules @ a84ff9cc → PASS. The GitHub API confirms the commit, dated 2026-09-22T15:34:05Z. I re-downloaded the codeload tarball: b227c2d2…a887. I re-extracted the JS/TS rules myself: 205 YAML files plus LICENSE, tree hash 906f5676…a3c3, equal to the installed tree.
- C11 Node 22.23.3 and gitleaks 8.30.1 → PASS. nodejs.org SHASUMS256 gives df450af8…02de, and the gitleaks checksums file gives 551f6fc8…70eb. Both equal `.tools/*.sha256`.
- C12 OSV DB record → [partial] PASS. The zip's sha256 (1cf74866…602b) equals FETCHED, and `fetched_epoch` 1791215278 = 2026-10-05T15:47:58Z = `fetched_utc`. A live feed can't be re-derived against a published checksum (see O2).

### Dependencies (MC-33 "pinned")
- C13 Lockfile → PASS. lockfileVersion 3, 421 entries. All have a sha512 `integrity` and a registry.npmjs.org `resolved`. There are 0 links. All 9 direct dependencies and the override are exact versions and equal the lockfile.
- C14 7-day publication rule for the fix-block additions → PASS. Dates from `npm view`:
  - @vitest/coverage-v8 4.1.11: 2026-08-18
  - ast-v8-to-istanbul 1.0.7: 09-21
  - magicast 0.5.5: 09-11
  - nested @babel/* 7.29.x under magicast: ≤ 09-18
  - root @babel/* 8.0.6: 09-18 (the doc names the nested versions)
  - @bcoe/v8-coverage 1.0.2 and istanbul-reports 3.2.0: 2025
- C15 MC-34 → PASS. The lockfile has no LLM or agent SDK (pattern openai, anthropic, langchain, generative-ai, cohere, mistral, ollama, llamaindex, @ai-sdk). Money-path imports are internal only.

### MC-01 float lint (plants in /tmp copy, both layers + tsc)
- C16 The round-1 forms are caught → PASS. Caught by both layers: F7 `Number(w)`, F10 `Math.round`, F11 `x * 1.5`. Caught by the type-aware lint only: F12 `a / b` on numbers. The test plants 12 floats, and CI plants 4 into Semgrep.
- C17 Other ToNumber and float forms → **FAIL (blocking, D4)**. Every row below passes `tsc`, the type-aware lint (0 findings) and the Semgrep MC-01 layer (no results):

| Plant | Code |
|---|---|
| F1 | `nativeWei(BigInt(+hex))` |
| F2 | `cbsMinor(BigInt((+s * 100) \| 0))` |
| F3 | `globalThis.Math.floor(x * 100)` |
| F4 | `globalThis.Number(s)` |
| F5 | `JSON.parse(s) * 100` |
| F6 | `~~(x * 100)` |
| F8 | `x * 100 - (x * 100) % 1` |

  Recomputed in node:
  - `BigInt(+"0x1bc16d674ec80001")` = 2000000000000000000n against `BigInt(hex)` = 2000000000000000001n, so 1 wei is silently lost.
  - `BigInt(("1.15"*100)|0)` = 114n, not 115.

### MC-02 (re-planted)
- C18 Collapsed brand (NativeWei branded 'UsdcUnits') → PASS. `tsc` exits 2, and amount-mixing.test.ts reports 5 failed.

### CBS port vs CONTRACT §3/§4 and MC-17(b) port fields
- C19 Scripted diff → PASS. 16 §3 operations, 7 §4 rows, 21 case reasons, 13 REJECTED codes and 5 payout codes. `checkPortAgainstContract()` returns `[]`.
- C20 MC-17(b) binding fields → PASS. Re-traced against §3:
  - `placeHold` takes only `{key, instructionId}`, so the CBS takes account and amount from its own instruction.
  - `settleHold` carries holdId, instructionId, txHash and legs.
  - `postJournal.refs` carries instructionId, address, assignRef{caseId, dispositionSeq}, caseId, dispositionSeq and txHash.
  - My P3 mutant (an adapter-chosen `accountRef` added to the `placeHold` request) was killed as an extra field.
  - P5 (settleHold without instructionId), P7 (assignRef without dispositionSeq), P8 (`refs.instructionId` made required) and P9 (placeHold OK without amount) were killed.
- C21 Drift-checker blind spots → FAIL (minor, m11). These mutants survived `checkPortAgainstContract`:
  - P4: `legs: JournalLeg` (not an array);
  - P6: `CaseDisposition.returnAmount?: WireAmount` (any unit; CONTRACT §4 "`RETURN` requires `returnAmount` (CBS_MINOR, greater than 0)");
  - P12: `refs.txHash?: number`.
  - P2 (`dispositionSeq?: never`) is caught only because the test's own fixture `replaceOnce` throws.

### Mainnet lock (MC-20)
- C22 → PASS. Mutants G1–G9 were killed (see the m4 row). There is no SIGNED-OFF status cell in GATES.md, and every G-M row reads NOT SIGNED. The mainnet entry is `{name, enabled:false, chainId:5042}` and has no endpoint. Since `src/chain/config` is outside Stryker's scope, these mutants are the only mutation evidence for MC-20.

### Constants (MC-21)
- C23 Config literals recomputed → PASS. I recomputed:
  - keccak256("Transfer(address,address,uint256)") = 0xddf252ad…b3ef, equal to C-21;
  - `getAddress(0xff…fe)` = 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE, equal to C-20;
  - 20×10⁹ = 20,000,000,000 (C-30);
  - 20,000×10⁹ = 2×10¹³ (C-31).

  C-01, C-03, C-06, C-10, C-11, C-12, C-32, C-40, C-41, C-42 and C-60 equal their constants.md rows.
- C24 Live testnet, read-only → PASS. `eth_chainId` returned 5042002. Block 65,653,323 has baseFeePerGas 20,000,000,000, gasLimit 30,000,000 and extraData 0x00000004a817c800 (20 gwei).
- C25 Shared method → PASS with one drift, hand-checked. tools/source_drift.py has sha256 5504b5e7…80e1, the version reviewed in round 1, and I ran it to /tmp. Result: 0 integrity failures, 0 fetch errors, 33 URLs, 32 identical, 1 DRIFT. The drift is developers.circle.com/cctp/concepts/supported-chains-and-domains.md: Sui rows only (−1/+2 lines). I re-checked the C-60 quotes on the live pages: "| 26 | Arc |" is at line 143 of the Circle page, and "| **TokenMessengerV2** | 26 |" appears in docs.arc.io contract-addresses. Both are present (O1).

### Money-path list and closure
- C26 Recount → PASS. RUBRIC items 1–10 each have a listed path and at least one named part. All 37 anchors are found. The tools' file sets equal the 13 listed paths.
- C27 Closure → FAIL (minor, m12). CV4 rewrote `import type { AccountRef } from '../registry/index.js'` in src/policy as `import { type AccountRef } from …`, and money-path.test.ts still passes, 44/44. That is wrong, because I compiled it with this tsconfig (`verbatimModuleSyntax`) and the emitted `dist/policy/index.js` line 1 is `import {} from '../registry/index.js';`, a runtime load of an excluded module. Dynamic `import()` is not scanned either.

### Remaining stage checks
- C28 SAST offline → PASS. Semgrep under `unshare -rn`, with local rules only, exited 0.
- C29 SCA threshold regression → FAIL (minor, m10). I planted a mutant in a /tmp copy: `BLOCKING_LABELS={CRITICAL}`, CVSS cut-off 9, HIGH treated as report-only. `sca.sh` still passes, because the minimist fixture is CRITICAL with CVSS 9.8. The mutant gate also passes a crafted HIGH/7.5 finding (exit 0).
- C30 Tool re-verification claim → FAIL (minor, m13). tooling-phase2.md:3 says "it re-verifies every hash on each CI run". In fact:
  - install-tools-phase2.sh:65 re-checks the Semgrep venv by version string only.
  - semgrep-core's hash (83223753…) is recorded but never checked.
  - ci.sh never re-hashes the node or gitleaks binaries.
- C31 Repo hygiene → FAIL (minor, m14). `tools/__pycache__/source_drift.cpython-314.pyc` is in the tree, and .gitignore has no `__pycache__` entry. Committing `tools/**` would therefore commit a compiled binary.
- C32 README Phase 2 section and tooling-phase2.md counts → PASS. I checked these against what I ran: 205 rules, 66 locked packages, 3 qs advisories, 12 lint plants, 15 SBOM components, Stryker 72, 196 tests.
- C33 KICKOFF Phase 2 CI stage list → PASS except cosign and SLSA. Build and tests, mutation, SAST, SCA, gitleaks and SBOM are all present. cosign and SLSA are SKIPPED (m5).

## DEFECTS
- **D4** · tools/lint-money-floats.mjs:7-13, 27-33, 88-103 and tools/semgrep/mc01-money-float.yml · Lens R, RUBRIC MC-01 ("No floating-point type or operation on any money path … Lint rule plus a **grep for float types** … The lint must fail on a planted float") · **blocking**.
  - **What's wrong:** both layers recognise floats only by the names `Number`, `parseFloat`, `parseInt` and `Math`, by `toFixed` and its kin, by float literals, and by `/` or `**` on non-bigint operands.
  - **What gets through:** ToNumber by unary `+`, `number` arithmetic truncated by `| 0` or `~~`, `%`-based rounding, `globalThis.Math` and `globalThis.Number`, and `JSON.parse`. Each one passes tsc and both MC-01 layers.
  - **No float-type check:** the "grep for float types" is not implemented. The `number` type is allowed anywhere on a money path.
  - **Why blocking:** F1 `nativeWei(BigInt(+hex))` is the ordinary JS idiom for decoding an RPC hex quantity, which is exactly the work U3 and U4 do next. It silently drops wei above 2⁵³ (recomputed: off by 1 wei on 0x1bc16d674ec80001). So the required MC-01 stage lets a money-path float through with CI green.
  - **Fix:**
    - Flag prefix unary `+`.
    - Flag every arithmetic, bitwise or compound operator (`+ - * % | & ^ ~ << >> >>>`) with a non-bigint operand, unless an explicit, named allow-list covers it (chain ID, RPC codes, precision p).
    - Flag `Math`, `Number`, `parseFloat` and `parseInt` when reached through a property or element access (`globalThis.X`, `globalThis['X']`).
    - Flag `JSON.parse` on listed paths.
    - Implement the float-type grep: a `number`-typed declaration on a money path is allowed only from that allow-list.
    - Add F1–F6 and F8 to test/unit/money-float-lint.test.ts, and the unary `+` form to the ci.sh Semgrep self-test.
- **m5** · GATES.md:12, scripts/ci.sh:40-50 · KICKOFF Phase 2 (cosign, SLSA), MC-33 · minor (narrowed).
  - The deferral is honest.
  - It is not enforced where G2 is signed: the G2 row lists no precondition, and nothing fails if G2 is SIGNED-OFF while both stages print SKIPPED.
  - Fix: record "cosign and SLSA produced and verified in hosted CI (MC-33)" as a G2 precondition, and make `skipped_g2` fail once G2 is signed.
- **m10** · scripts/sca.sh:40-48, tools/osv-gate.mjs (no tests) · MC-33 "0 high or critical" · minor.
  - The gate is correct today: I checked every branch with crafted input.
  - The only self-test is a CRITICAL fixture, so a mutant that lets HIGH, CVSS 7–8.9 or unknown severity through passes CI (verified).
  - Fix: add a HIGH-only fixture, or unit tests on crafted JSON for HIGH, CVSS ≥ 7, unknown and MAL-.
- **m11** · test/contract/port-contract-check.ts:262-307 (`compareShape`) · CONTRACT §3/§4 fidelity · minor (the port is correct today).
  - The checker compares names, `?` markers, literals and nesting, but not types.
  - It doesn't require `legs` to be an array (P4 survived).
  - It doesn't check `CaseDisposition.returnAmount` = CBS_MINOR, which CONTRACT §4 states in prose (P6 survived).
  - It doesn't check field types (P12 survived).
- **m12** · test/unit/money-path.test.ts:84-104 (`importsOf`) · RUBRIC money-path import-graph closure · minor.
  - `import { type X } from` is classified as type-only, but under `verbatimModuleSyntax` it emits `import {} from '…'`, a runtime load of an excluded module (CV4 survived; emitted JS verified).
  - Dynamic `import()` is not scanned.
  - Fix: treat only `import type` / `export type` as type-only, and flag inline-type-only clauses and `import()`.
- **m13** · docs/verification/tooling-phase2.md:3; scripts/install-tools-phase2.sh:65; scripts/ci.sh:24 · MC-33 "pinned" and accuracy of evidence · minor.
  - "Re-verifies every hash on each CI run" is overstated: the Semgrep venv is checked by version only, semgrep-core's recorded hash is never checked, and node and gitleaks aren't re-hashed.
  - Fix: verify the recorded binary hashes on every run, or correct the claim.
- **m14** · tools/__pycache__/, .gitignore · repo hygiene (no unhashed binaries committed) · minor. Add `__pycache__/` to .gitignore and delete the .pyc.

## Observations (not defects of this unit)
- **O1.** CCTP supported-chains page drift (Sui rows only). The C-60 quotes are still live, but the archive should be refreshed so that `source_drift.py` returns to exit 0.
- **O2.** `.tools/osv-db/FETCHED` was modified at 18:07:41. That is after the zip (17:47) and after the last edit of fetch-osv-db.sh (17:50:45), so the record was not written by the current script in a single run. Its content is consistent: the sha256 matches the zip and the epoch equals `fetched_utc`. The 7-day freshness gate rests on this writable local record. That is hygiene, not a security boundary.
- **O3.** SCA covers package-lock.json only. The hash-locked Python Semgrep toolchain (66 packages) is not SCA-scanned. It is CI tooling, not shipped.
- **O4.** src/cbs/result.ts `REJECTED_CODES` produces 0 Stryker mutants (the smoke test is "covered 0"). Its content is pinned by the contract diff and by the unit test.
- **O5.** The MONEY_PATH anchor `getResultByKey` matches in translator.ts only inside a comment and a type argument (`Req<'getResultByKey'>`). The anchor test is a presence check.
- **O6.** The coverage `text` reporter prints no file rows. coverage-summary.json shows all 13 files at 100%.

VERDICT: NEGATIVE (7 defects: 1 blocking [D4], 6 minor [m5, m10, m11, m12, m13, m14]). Round-1 D1, D2, D3, m1–m4 and m6–m9 are closed by reconstruction; m5 stays open, narrowed.
