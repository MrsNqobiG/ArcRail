VERIFICATION · lens: R · target: P2-skeleton (after fix block 2) · commit: none (uncommitted; branch `main` has no commits). Baseline: sorted sha256sum list of src/ test/ tools/ scripts/ (`__pycache__` excluded) hashes to 20510f14db0ee85e…. src/chain/config/index.ts 96012c232038… and src/cbs/port.ts a69bbafc2535… are unchanged since round 2. scripts/ci.sh 5ac1a615ad3d….

Verifier: independent Lens R pass, round 3, 2026-10-05, 19:10–22:06 SAST.
- **Inputs:** KICKOFF_PROMPT.md Phase 2; docs/PHASE2_SLICE_PLAN.md; docs/RUBRIC.md (MC-01, MC-02, MC-07, MC-08, MC-17(b), MC-20, MC-21, MC-33, MC-34, the money-path list and its closure); CONTRACT §1.1, §3 and §4; docs/constants.md; the code and the tests.
- **Not relied on:** the author's LEDGER line and tooling notes. I re-ran every number.
- **Guard rules, obeyed by hand:**
  - Network: Arc testnet (5042002) read-only RPC only (`eth_chainId`, `eth_getBlockByNumber latest`). No mainnet endpoint, no signing or sending method, no .env or key file read.
  - Other fetches: docs pages (via source_drift.py), and the PyPI JSON plus one wheel download.
  - Fixtures: the one secret fixture was a random hex generated in /tmp and deleted.
- **Writes:**
  - No file was edited under src/, test/, tools/, scripts/, docs/ (except this report) or the repo root.
  - Every mutant was planted in a /tmp copy: `/tmp/vr3` for source and tests, `/tmp/vr3t` for an 860 MB copy of the tools, `/tmp/vr3z`, `/tmp/vr3gl` and `/tmp/vr3gi`. All were deleted.
- **Stability:** at the end, the in-scope tree hash and the 15 config/doc hashes (package*, tsconfig*, vitest, stryker, MONEY_PATH, COVERAGE_EXCLUSIONS, GATES, README, CLAUDE.md, tooling-phase2, .gitignore, .gitleaksignore, .npmrc) equal the start values.
- **Side effects of `scripts/ci.sh`:**
  - It regenerated the git-ignored `dist/`, `coverage/`, `reports/` and `sbom.cdx.json`.
  - `npm ci` reinstalled `node_modules/`.
  - `tools/verify-venv.py` deletes `__pycache__` inside `.tools/semgrep-venv` (by design).

## Closure of round-2 defects (by reconstruction)

| ID | Status | Evidence |
|---|---|---|
| D4 MC-01 float lint | **CLOSED** | I re-planted round-2 F1–F8 and F7/F12 in a /tmp copy, each in a different money-path file. All 9 are caught by **both** layers (type-aware lint and Semgrep MC-01). For example, F1 `BigInt(+hex)` → lint `MC01-unary-plus` + `MC01-bigint-from-number`, Semgrep `mc01-unary-plus`. F6 `~~` → `MC01-non-bigint-bitwise` / `mc01-bitwise-not`. F5 `JSON.parse(s)*100` → `MC01-json-parse` / `mc01-json-parse`. The float-type grep exists (`MC01-number-type`, plants t1–t6). The allow-list has exactly 6 rows, and the test pins them. The test has 38 plants (I recounted lines 37–76: 12 + 20 + 6). ci.sh has 13 Semgrep self-test plants, and all 13 are caught in the CI log. Residual gaps are a different class (m15). |
| m5 G2 not enforcing cosign/SLSA | **CLOSED as stated** | The GATES.md G2 row now names the precondition. ci.sh:164-165 runs `tools/g2-precondition.mjs docs/GATES.md cosign slsa`. Fixtures (/tmp): G2 `SIGNED-OFF` → exit 1; `Signed off` → 1; `**G2**` bold cell → 1 (row not found); row removed → 1; missing file → 1; the real GATES.md copy → 0. **The underlying MC-33 cosign/SLSA clause is still unmet.** It is carried as m20 (see also O1). |
| m10 OSV HIGH self-test | **CLOSED** | The round-2 mutant (labels {CRITICAL}, HIGH counted as report-only, CVSS cut-off 9) planted in /tmp was caught twice: osv-gate.test.ts had 5 failed, and sca.sh failed with "FAIL: the SCA gate passed the HIGH fixture". Further kills: O4 (unknown severity → report-only, 2 failed), O6 (`>7`, 1 failed), O11 (CLI always exits 0, caught by sca.sh CRITICAL fixture), O15 (`ok: true`, 9 failed). New survivors: m18. |
| m11 port checker names only | **CLOSED as stated** | P4 (legs not an array), P6 (returnAmount of any unit), P12 (txHash number) and P2 (never) are now self-tests that pass, so the checker detects each one. My new plants were also killed: P21 (optional method), P29 (`value: bigint`), P31 (`side: string`), P32 (refs ∪ Record), P33 (payout amount ∪ WireAmount), P34 (`dispositionSeq: DecimalString \| number`). New survivors: m17. |
| m12 closure `import { type }` | **CLOSED as stated** | In a /tmp copy of src/policy, these were killed by money-path.test.ts with "imports excluded src/registry/index.ts at runtime": C1 `import { type X }`, C2 `import('…')`, C4 side-effect import, C5 `export *`, C17 `import {}` and C22 a template-literal `import()`. C23 (type-only import of an unlisted module) → "neither listed nor excluded". New survivors: m16. |
| m13 tool re-verification claim | **CLOSED as stated** | The tamper set was planted in the /tmp/vr3t copy of `.tools` and run through `install-tools-phase2.sh`. All 12 failed with a named FAIL: T1 gitleaks byte, T2 node tree file, T2b node extra file, T4 semgrep `.py`, T6 sitecustomize.py, T13 `.pth`, T8 semgrep-core, T9 rule YAML, T10 uv, T11 osv-scanner, T12 `bin/semgrep`, T14 extra bin file. The restored control passed. I re-derived semgrep-core from the official wheel: the PyPI wheel sha256 is b7c4a4ba…41f2, and the member `semgrep-1.178.0.data/purelib/semgrep/bin/semgrep-core` sha256 is 83223753…eca4. That equals `SEMGREP_CORE_SHA256` and the installed file. New survivors: m19. |
| m14 `__pycache__` | **CLOSED** | `tools/__pycache__` is absent, and `.gitignore` has `__pycache__/` and `*.pyc`. No `__pycache__` exists outside `.tools/` and `node_modules/` at the end of the pass. I ran source_drift.py with `PYTHONDONTWRITEBYTECODE=1`. |

## CHECKS

### Build, tests, CI (re-run)
- C1 `npm ci --ignore-scripts` (Node v22.23.3, npm 10.9.9 from .tools/node) → PASS, exit 0, 398 packages.
- C2 `npx tsc --noEmit` → PASS, exit 0.
- C3 `npx vitest run` → PASS: 10 files passed and 1 skipped (e2e); 274 tests passed and 1 skipped (275). This matches the LEDGER self-report of 274.
- C4 `bash scripts/ci.sh` → PASS, exit 0, "CI PASSED". Stages:
  - tools: "semgrep venv ok: 66 distributions = lock, 2766 RECORD hashes match", then "tools OK (all hashes re-verified)";
  - npm ci;
  - tsc and emit;
  - vitest: 274 + 1 skipped;
  - coverage: coverage-summary.json has 13 files, every metric 100% (37/37 lines, 37/37 statements, 32/32 functions, 4/4 branches);
  - MC-01 lint: 13 files, 0 findings;
  - Semgrep vendor rules and the MC-01 layer: 0 findings;
  - Semgrep self-test: 13/13 caught;
  - SCA: repo 410 packages, 0 blocking, 3 report-only; CRITICAL fixture (minimist 1.2.5) and HIGH fixture (json5 2.2.1, GHSA-9c47-m6qq-7p4h, CVSS 7.1) both caught;
  - Stryker: 72/72 killed, score 100.00 ≥ break 90. I recounted from reports/mutation/mutation.json: 72 Killed of 72;
  - gitleaks: "no leaks found" (~64.4 MB);
  - SBOM: CycloneDX 1.6, 15/15 with a SHA-512;
  - cosign and SLSA: SKIPPED;
  - G2 precondition: ok.
- C5 gitleaks still detects → PASS. A random 32-byte `PRIVATE_KEY` planted in /tmp gave "leaks found: 1" and exit 1.
- C6 .gitleaksignore is exact → PASS. With the 5 listed files copied to /tmp and scanned without the ignore file, gitleaks reports exactly those 5 file:rule:line fingerprints.

### MC-01 (two layers, plants in /tmp copies; each survivor below was also checked to pass `tsc` with the real tsconfig)
- C7 D4 forms → PASS (see the closure table).
- C8 New forms → FAIL (minor, m15). These pass `tsc`, the type-aware lint (0 findings) and the Semgrep layer (no results):

| Plant | Where | Code | Why it gets through |
|---|---|---|---|
| Z1 | amounts | `const p = s as number; return cbsMinor(BigInt(p));` (s: unknown) | The allow-list is keyed by name. Any declaration named `p` or `_p` in amounts is exempt, a local included. |
| Z2 | amounts | `(p: number, _p: number) => cbsMinor(BigInt((p * _p) \| _p))` | `_p` normalises to `p`. A truncating float conversion made only of allow-listed names and no literal passes both layers. A3, the same form with literal `100`, is caught by Semgrep `mc01-literal-operand`. |
| N1 | amounts | `nativeWei(BigInt(String(a as number)))` | `number` inside a type assertion is not a declaration, so MC01-number-type doesn't see it. The bigint argument is a string. |
| N2 | amounts | `nativeWei(BigInt((a as number).toString()))` | Same. |
| A6, A7 | amounts | `BigInt(String(dv.getFloat64(0)))`, `` BigInt(`${dv.getFloat64(0)}`) `` | An inline number-typed library result, stringified. |
| A1, A9, A12 | amounts, translator | `BigInt(((await r.json()) as {result:string}).result)`, `const body: unknown = await r.json()` then cast | `Response.json()` is `JSON.parse`, but `MC01-json-parse` matches only the `JSON` identifier. |
| A5, A10 | amounts | `((0).constructor as …)(hex)`, `((() => 0n).constructor as …)('…')` | `.constructor` reaches Number and Function without naming them. |
| A8 | registry + policy | `interface Limits { perTxMinor: number }` in registry; `a > l.perTxMinor` in policy | `number` declared in an excluded (type-only) module isn't grepped. A relational operator with a number operand isn't checked. |

  Recomputed losses (node):
  - `BigInt(JSON.parse("2000000000000000001"))` = 2000000000000000000n, so 1 base unit is lost silently.
  - `BigInt((1.15*100)|1)` = 115n, but `(1.15*100)|0` = 114.

- C9 MC-01 RUBRIC wording ("Lint rule plus a grep for float types and `Number(`/`parseFloat`; the lint must fail on a planted float") → PASS. Both layers fail on every planted round-1 and round-2 form.

### MC-02
- C10 Collapsed brand (NativeWei branded 'UsdcUnits', /tmp copy) → PASS. `tsc` exits 2, and amount-mixing.test.ts reports 5 failed (23 passed).

### Money-path list and closure
- C11 Recount → PASS. 13 listed paths. Items 1–10 each have a path and at least one part, and 36 named parts are each anchored. `stryker.mutate`, the coverage `include` and the lint file set all equal the 13 paths: money-path.test.ts passed in CI, I compared the stryker.config.json list by eye, and the lint reported 13 files.
- C12 Closure → PASS for relative edges (m12 closed). FAIL (minor, m16) for non-relative specifiers:
  - C3 `createRequire(import.meta.url)('../registry/index.js')`, C7 `process.getBuiltinModule('node:module').createRequire(…)(…)` and C8 an absolute-path import of an excluded module all survive.
  - `importsOf` drops every specifier that doesn't start with `.`.
- C13 Excluded modules → PASS. Today both excluded modules (chain/config, registry) are reached only through `import type`. I re-grepped every listed path's imports: all are `import type`, and listed paths have no non-relative imports.

### CBS port vs CONTRACT §3/§4 and MC-17(b)
- C14 Scripted diff → PASS. `checkPortAgainstContract()` returns `[]`. The model has 16 ops, 7 §4 rows, 21 reasons, 13 REJECTED codes and 5 payout codes (contract test). The port file is unchanged since round 2, so round-2 C20 (placeHold `{key, instructionId}`, settleHold carrying instructionId and txHash, refs fields) still holds.
- C15 Drift-checker blind spots → FAIL (minor, m17). These mutants survive, and together they type-check:
  - P13 `placeHold` request gains an index signature `[k: string]: unknown`;
  - P14 a third parameter `accountRef?: AccountRef`;
  - P15 required `refs.subjectRef: SubjectRef | undefined`;
  - P28 a second `placeHold` overload carrying `accountRef` and `amount`;
  - P30 the `settleHold` OK response gains an index signature.

  P13, P14 and P28 reopen the round-2 P3 route (an adapter-chosen account or amount on `placeHold`) through syntax the checker doesn't compare. It compares only `getPropertiesOfType`, only `signatures[0]` and only parameter 0, and `nonNullable` hides `| undefined`.

### Mainnet lock (MC-20)
- C16 → PASS. The config file is unchanged since round 2. I re-planted in /tmp, and each mutant was killed by mainnet-gate.test.ts:
  - G1 `throw` → `return ARC_TESTNET` (1 failed);
  - G3 `includes('SIGNED-OFF')` (1 failed);
  - G6 `||` → `&&` (3 failed);
  - G10 gate call removed (1 failed).

  GATES.md has no SIGNED-OFF status cell, and all 8 G-M rows read NOT SIGNED. The mainnet entry is `{name, enabled:false, chainId:5042}` with no endpoint.

### Constants (MC-21)
- C17 Recomputed → PASS:
  - keccak256("Transfer(address,address,uint256)") = 0xddf252ad…b3ef (C-21);
  - `getAddress(0xff…fe)` = 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE (C-20);
  - 20×10⁹ (C-30) and 2×10¹³ (C-31).

  Config literals equal the constants.md rows C-01, C-03, C-05, C-06, C-10, C-11, C-12, C-32, C-40, C-41, C-42, C-56 and C-60.
- C18 Live testnet, read-only → PASS. `eth_chainId` = 0x4cef52 = 5042002. Block 65,676,462 has baseFeePerGas 20,000,000,000, gasLimit 30,000,000 and extraData 0x00000004a817c800 (= 20,000,000,000).
- C19 Shared method → PASS with drift, hand-checked. tools/source_drift.py sha256 is 5504b5e7076f186c…, the version reviewed in rounds 1–2. I ran it to /tmp: integrity failures 0, fetch errors 0, 33 URLs, 2 DRIFT.
  - The CCTP supported-chains page has Sui rows only.
  - developers.circle.com/llms.txt has 2 added Sui lines and no removals.
  - I re-checked the C-60 quote live: "| 26 | Arc |" is at line 143. No in-scope quote depends on a removed line (O2).
- C20 Literal grep outside config → PASS [inspection-only for intent]. The only Arc literals outside src/chain/config are the type-level chain-ID pins `'5042002'` / `5042002` (keys, port, ingestion, signer, chain client) and comments. They are unchanged since round 2.

### Supply chain and tools (MC-33, MC-34)
- C21 Lockfile and pins → PASS. package-lock.json and package.json are unchanged since round 2 (mtimes 17:41 and 18:05, before round 2 ended), so round-2 C13/C14 (421 entries, all sha512, exact pins, 7-day rule) hold. `.npmrc` has `ignore-scripts=true` and `save-exact=true`.
- C22 Tool integrity on every run → PASS (m13 closed). Residual: m19.
- C23 SCA gate → PASS (m10 closed). Residual: m18.
- C24 MC-34 → PASS [scan by verifier]:
  - The lockfile has no LLM or agent SDK (round-2 pattern; lockfile unchanged).
  - Listed paths import only relative modules.
  - There is still no automated import scan (part of m16).
  - The egress allow-list test applies once a unit has egress.
- C25 KICKOFF Phase 2 CI stage list → PASS except cosign and SLSA. Present: build and tests, mutation, SAST, SCA, gitleaks and SBOM. cosign and SLSA are SKIPPED (m20, declared, enforced at G2 sign-off).
- C26 README Phase 2 section, CLAUDE.md Commands line and tooling-phase2.md counts → PASS. I checked each against what I ran: 38 lint plants, 13 Semgrep plants, 6 allow-list rows, 66 venv distributions, 2,766 RECORD hashes, 15 SBOM components, Stryker 72, 274 tests. The CLAUDE.md commands match the scripts.

## DEFECTS
- **m15** · tools/lint-money-floats.mjs:29-36, 133, 148-158 (name-keyed allow-list) and 284-291 (number-type check on declarations only); rule `MC01-json-parse` (identifier only) · Lens R, RUBRIC MC-01 · **minor**.
  - **What gets through:** Z1, Z2, N1, N2, A1, A5–A10 and A12 pass tsc and both layers. Each passes a JS `number` into a money value.
  - **Why minor, not blocking:**
    - Every ordinary idiom from D4 is now caught in both layers, with conformant inputs.
    - Each survivor needs one of these: a type assertion that lies about the runtime type (`as number`, or a cast of `unknown`/`Response.json()`); an amount named after an allow-listed identifier (`p`, `_p`, `code`, `chainId`); a `.constructor` detour; or a `number` type declared outside the listed paths.
    - Wire amounts are decimal strings by CONTRACT §1.1, so the JSON-number cases also need a non-conforming counterparty.
  - **Fix:**
    - Allow-list by declaration, not by name. For example, exempt only the brand type `CbsPrecision` and specific parameter declarations, never locals.
    - Flag `number` in `as` and `satisfies` assertions, type arguments and property types reached from money-path operands.
    - Flag `.json()` calls (Body/Response) under MC01-json-parse.
    - Flag `.constructor` member access.
    - Grep `number` in excluded modules' exported types, or in relational operands.
    - Add Z1, Z2, N1, N2, A1, A5 and A8 as plants.
- **m16** · test/unit/money-path.test.ts:139-147 (`.filter((e) => e.spec.startsWith('.'))`) · RUBRIC money-path import-graph closure, MC-34 import scan · **minor**.
  - C3 (`createRequire`), C7 (`process.getBuiltinModule`) and C8 (an absolute-path import of an excluded module) load an excluded module at runtime and pass.
  - Non-relative specifiers are never examined, so there is also no automated MC-34 check that money-path modules import no LLM or agent SDK.
  - Deliberate-evasion class.
  - Fix: on listed paths, allow only an explicit list of non-relative specifiers (for example `viem`, `node:crypto`). Flag `node:module`, `createRequire` and `getBuiltinModule`, and treat absolute and `file:` specifiers as relative edges.
- **m17** · test/contract/port-contract-check.ts:352-395 (`compareShape`: index signatures not compared, `nonNullable` before the kind check) and 420-430 (only `signatures[0]`, only parameter 0) · CONTRACT §3 fidelity, MC-17(b) drift detection · **minor**.
  - P13, P14, P15, P28 and P30 survive and type-check.
  - Minor because the port itself is correct (unchanged since round 2) and the binding is executed by the CBS (CONTRACT §3 placeHold). The CBS stub's wrong-account fixture (MC-17(b) Phase 2) is the runtime control.
  - Fix:
    - Fail on any index signature in a request or response type.
    - Fail on more than one call signature, or on a parameter count other than 2 (`req`, `meta`).
    - Check that a required field's declared type excludes `undefined`.
- **m18** · tools/osv-gate.mjs:127-131 and test/unit/osv-gate.test.ts:9-23 (single-package, single-vulnerability fixtures) · MC-33 "0 high or critical" · **minor**.
  - O12 (evaluate only the first package of each result) and O13 (only the first vulnerability of each package) pass all 17 unit tests and both sca.sh self-tests.
  - The real scan covers 410 packages, so either mutant would pass a HIGH that isn't first.
  - The gate is correct today.
  - Fix: add a crafted report where the HIGH finding is the second package and the second vulnerability.
- **m19** · tools/verify-venv.py:197-225, plus `.tools/semgrep-venv/pyvenv.cfg` (unchecked) · MC-33 "pinned"; tooling-phase2.md:5 "A tool that is present but differs fails CI" · **minor**.
  - T5 (edit `semgrep/__init__.py` and rewrite its RECORD row to the new hash) passes all checks.
  - T7 (`include-system-site-packages = true`) also passes.
  - The RECORD files are self-attesting and are not anchored to the lock or to a pinned hash.
  - Local-tamper class: whoever can write `.tools` can also edit ci.sh.
  - Fix: pin a sorted tree hash of site-packages (or of the 66 RECORD files) and of pyvenv.cfg, re-derived from a fresh `uv pip sync --require-hashes`.
- **m20** (residual of round-1/2 m5) · scripts/ci.sh:161-162 · KICKOFF Phase 2 ("artefact signing (cosign); SLSA provenance"), RUBRIC MC-33 ("cosign-signed artefacts and SLSA provenance produced and verified in CI") · **minor**.
  - Still SKIPPED.
  - Honestly declared (README, slice plan, tooling-phase2.md).
  - Since fix block 2, enforced so that formal G2 sign-off fails CI while either stage is SKIPPED.
  - Minor because nothing is released or deployed before G2, and the plan scopes these stages to hosted CI. The rubric clause itself is unmet until then.

No blocking defect:
- **Mainnet lock (MC-20):** mutants killed; no endpoint; all G-M rows NOT SIGNED.
- **Secrets:** gitleaks detects a planted key; the ignore list is exact.
- **Money-path safety properties:** MC-01 ordinary idioms caught in both layers; MC-02 compile-fail; MC-07 100%; MC-08 100%; closure on relative edges; CONTRACT port fields.
- **Required CI stages:** all present and failing closed, except the declared cosign/SLSA deferral (m20).

## Observations (not defects of this unit)
- **O1. G2 acceptance vs the G2 row's own precondition.** The resume point in LEDGER line 14 is "if zero blocking defects, accept G2 in chat".
  - The GATES.md G2 row states its precondition as zero blocking defects **and** "artefact signing (cosign) and SLSA provenance run in hosted CI rather than being SKIPPED".
  - The first half holds after this pass. The second does not (m20).
  - A chat acceptance that leaves the status cell starting with "NOT SIGNED" passes `g2-precondition.mjs` by design. The record of that acceptance should say explicitly that cosign and SLSA are still SKIPPED and remain a precondition of the formal G2 sign-off.
- **O2. Source drift.** Two URLs drifted: the CCTP supported-chains page (Sui rows) and developers.circle.com/llms.txt (+2 Sui lines, no removals). The C-60 quote is still live. Refresh the archives so `source_drift.py` returns to exit 0.
- **O3. The lint's compiler view differs from tsconfig.** The lint builds its program with the default lib (DOM included) and `types: []`; tsconfig uses `lib: ["ES2023"]` and `types: ["node"]`.
  - So `Response.json()` is `any` to the lint (and is flagged when declared) but `unknown` to tsc (and is not flagged).
  - Unresolved Node globals become error types (any), which is conservative.
  - Aligning the two views would make the lint's verdict match what compiles.
- **O4. Stryker coverage of chain/config.** Stryker lists the MC-20 tests as "covered 0" because src/chain/config is outside `mutate`. The MC-20 mutation evidence is the verifier's G-mutants (C16).
- **O5. Node tree hash provenance.** The node tree-hash reference (1842bae0…) is derived from an extracted tree. tooling-phase2.md says it equals a fresh extraction of the archive whose sha256 matched nodejs.org SHASUMS256 (re-derived in round 2, C11). I did not re-download Node in this round.
- **O6. JSON number re-check.** `BigInt(JSON.parse("2000000000000000001"))` = 2000000000000000000n. Whatever runtime wire validation U1/U6/the translator add (CONTRACT §1.1: decimal strings only, `typeof === 'string'` before `BigInt`) is the real control for the JSON-number cases in m15.

VERDICT: NEGATIVE (6 defects: 0 blocking, 6 minor [m15, m16, m17, m18, m19, m20]). Round-2 D4, m10, m11, m12, m13 and m14 are closed by reconstruction, and m5 is closed as stated (enforcement), with its underlying MC-33 clause carried as m20. Zero blocking defects, so the operator's exit rule is met. See O1 before recording G2.
