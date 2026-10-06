# Tooling install evidence (Phase 2 skeleton fix block: SCA, SAST, coverage)

Date: 2026-10-05 · Host: WSL2 Ubuntu, x86_64 · Installer and verifier: `scripts/install-tools-phase2.sh`, which `scripts/ci.sh` runs first on every run.

**What every CI run re-verifies** (fix block 2, m13). A tool that is present but differs fails CI; it is never silently reinstalled.

| Tool | Check on every run | Reference value, and where it came from |
|---|---|---|
| Node 22.23.3 (Phase 0) | tree hash of the whole `.tools/node-v22.23.3-linux-x64/` (file contents, plus symlink targets) and the `.tools/node` link | `1842bae06071b49add6c3151d09eb7db9406ac57e98d36502fd73e3d99e1b27e`. Re-derived 2026-10-05: re-downloaded `node-v22.23.3-linux-x64.tar.xz`, `sha256sum -c` against nodejs.org SHASUMS256 (`df450af8…02de`, OK), extracted, same tree hash as the installed copy. `bin/node` = `fde6a4bf…348f48` in both. |
| gitleaks 8.30.1 (Phase 0) | sha256 of `.tools/bin/gitleaks` | `88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509`. Re-derived 2026-10-05: re-downloaded `gitleaks_8.30.1_linux_x64.tar.gz`, `sha256sum -c` against the release checksums (`551f6fc8…70eb`, OK), extracted binary identical. |
| osv-scanner 2.6.0 | sha256 of the binary | below |
| uv 0.12.19 | sha256 of the binary | below |
| Semgrep venv | `tools/verify-venv.py verify` (fix block 3, m19). The venv's own RECORD files are never read. (1) installed distributions = the 66 lock pins; (2) one wheel per pin is kept in `.tools/semgrep-wheels/` (outside the venv, 82 MB) and each wheel's sha256 must be one of the lock's hashes for its pin, on every run; (3) every file and symlink in the venv is classed W (equals the member of its lock-verified wheel: 2,618), S (console script rebuilt byte for byte from the wheel's entry_points.txt: 16), P (pinned: `pyvenv.cfg`, also parsed for `include-system-site-packages = false` and `home = /usr/bin`; uv's `_virtualenv.pth/.py`; `.gitignore`, `CACHEDIR.TAG`, `.lock`: 6), L (python links → `/usr/bin/python3`, `lib64 → lib`: 4) or M (installer metadata never executed: dist-info RECORD/INSTALLER/REQUESTED and uv's activate scripts: 208); anything else fails; (4) the tree equals the manifest `.tools/semgrep-venv.manifest.json` (2,852 entries, outside the venv), recorded at install time by `verify-venv.py record`, which refuses unless every W/S/P/L check already passes, and which pins the lock's sha256; (5) semgrep-core hash. Bytecode caches are deleted first and CI sets `PYTHONDONTWRITEBYTECODE=1`. Missing wheels are fetched by `verify-venv.py fetch` (pypi.org JSON + files.pythonhosted.org only) | semgrep-core `83223753…eca4`, re-derived from the PyPI wheel (sha256 `b7c4a4ba…41f2`). `pyvenv.cfg` `295c0c00…e72e`, `.gitignore` `684888c0…4fc1`, `CACHEDIR.TAG` `5953156d…31ae`, `_virtualenv.pth` `69ac3d8f…433d` and `_virtualenv.py` `cfb3db86…bf1a` were re-derived on 2026-10-06 by creating a fresh venv with the verified uv; `.lock` is the empty-file hash. Tamper test (scratch copy, re-recorded manifest), all killed: T5 (`semgrep/__init__.py` edited and its RECORD row rewritten), T5 + manifest rewritten, T7 (`include-system-site-packages = true`), T7 + manifest, a new `.pth` (also when added to the manifest as class M), `bin/semgrep` edited (also with manifest), semgrep-core byte, a wheel byte, a wheel removed, a wheel-derived file deleted, `bin/python` retargeted, the lock edited, an INSTALLER edit, a manifest entry removed. Limit: an INSTALLER (class M) edit together with its manifest entry survives; class M is never executed. |
| semgrep-rules | tree hash | below |
| OSV database | sha256 against `.tools/osv-db/FETCHED` and age < 7 days (in `scripts/sca.sh`) | below |

**Not verified:** the system Python 3.14.4 (`/usr/bin/python3`), which runs Semgrep's Python layer and `tools/verify-venv.py`. It comes from the OS package manager, outside `.tools/`.

Everything is under `.tools/` (git-ignored). Each binary was verified against its published SHA-256 before use. Network use: release assets from github.com, a pinned-commit tarball from codeload.github.com, Semgrep's wheels from PyPI (hash-locked), npm packages from registry.npmjs.org, and the OSV database (below, approved by the coordinator for this block). No keys, no signing, no `.env` read.

**Publication-age rule.** As for the npm pins (README), each tool is the newest release published at least 7 days before 2026-10-05.

## osv-scanner (SCA)

| Item | Value |
|---|---|
| Release | `v2.6.0`, published 2026-09-14 (https://github.com/google/osv-scanner/releases/tag/v2.6.0) |
| Asset | `osv-scanner_linux_amd64` |
| Published SHA-256 (`osv-scanner_SHA256SUMS`) | `ca69b3d3cd08f889a49dc0a383122f71cc528b83803671df5fd874d97485b108` |
| `sha256sum -c` | `OK` |
| Installed | `.tools/bin/osv-scanner` (same hash) · `--version`: 2.6.0, commit `e840a6e8adb14b7777c78e26cfbf6e2abc1d1fc6`, built 2026-09-14T01:44:58Z |
| Provenance | The release also ships `multiple.intoto.jsonl` (SLSA provenance). It was **not** verified: that would need slsa-verifier, out of scope for this block. Integrity is checked, authenticity is not (same caveat as tooling.md). |

### OSV database (offline mode only)
- `scripts/fetch-osv-db.sh` fetches it in a separate, explicit step. `scripts/ci.sh` and `scripts/sca.sh` run `osv-scanner scan source --offline --offline-vulnerabilities`, so **the package list is never sent to api.osv.dev**.
- osv-scanner 2.6.0 reads `<OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY>/osv-scalibr/npm/all.zip`. The layout was found by test: `osv-scanner/npm/all.zip` is not read.

| Item | Value |
|---|---|
| URL | `https://osv-vulnerabilities.storage.googleapis.com/npm/all.zip` (OSV's official data distribution) |
| Fetched (UTC) | 2026-10-05T15:47:58Z (HTTP Last-Modified: Mon, 05 Oct 2026 13:47:42 GMT) |
| Size | 217,568,122 B, 229,905 OSV records |
| SHA-256 | `1cf748660e71f2a83f0c6b7c55e3e7a535799861c1c1c93bdfef881059a5602b` |

A live feed has no published checksum. The script records the hash above in `.tools/osv-db/FETCHED`. The SCA stage fails if the zip's hash no longer matches that record, if the database is missing, or if it is 7 or more days old.

`FETCHED` was rewritten at 18:07 on 2026-10-05 (verifier round 2, O2). That was my fail-closed test of this stage: I backed the file up, made it stale, then gave it a wrong hash, and restored the backup byte for byte with `cp`. Its content is the record `fetch-osv-db.sh` wrote at 15:47:58Z. The record is a local file that anyone can edit, so the 7-day check is hygiene, not a security boundary.

### Threshold (tools/osv-gate.mjs)
- **Fail:** GHSA label HIGH or CRITICAL, or a CVSS score ≥ 7.0.
- **Fail:** severity unknown (no label and no score), for example a malicious-package `MAL-` record.
- **Fail:** a score that is not a number, and input that isn't osv-scanner JSON with `results`.
- **Report only:** MODERATE or LOW below CVSS 7.0. These are printed on every run and listed below.
- **Unit tests** (`test/unit/osv-gate.test.ts`): crafted JSON for each branch, plus (fix block 3, m18) multi-result, multi-package, multi-vulnerability reports whose HIGH finding is never first. Mutants in a scratch copy: only-first-package (O12) fails 4 tests, only-first-vulnerability (O13) fails 5, only-first-result fails 2.
- **Self-tests, every CI run (`scripts/sca.sh`):** one offline scan covers the repo lockfile and two fixtures, and each fixture must fail the gate:
  - `minimist@1.2.5` (GHSA-xvch-5gv4-984h, CRITICAL, CVSS 9.8);
  - `json5@2.2.1` (GHSA-9c47-m6qq-7p4h, HIGH, CVSS 7.1). The script first checks that this fixture really is HIGH-only (no CRITICAL label, no CVSS ≥ 9).
- **Mutant proof:** a gate that treats HIGH as report-only (HIGH moved to the report list, cut-off raised to 9) passes the CRITICAL fixture but fails CI on the HIGH one. Tested in a scratch copy.
- **Dropped-source guard:** the scan uses `--all-packages`. Each of the three lockfiles must appear with at least one package, so a lockfile the scanner silently skipped can't pass as clean.

### Findings on 2026-10-05 (report only, dev toolchain only)

| Package | Advisory | Severity | Path |
|---|---|---|---|
| qs 6.15.1 | GHSA-4mjr-xmp4-gh2g (CVE-2026-82417) | MODERATE, CVSS 6.3 | @stryker-mutator/core 10.0.0 → typed-rest-client 2.3.1 → qs (dev) |
| qs 6.15.1 | GHSA-q8mj-m7cp-5q26 (CVE-2026-8723) | MODERATE, CVSS 6.3 | same |
| qs 6.15.1 | GHSA-x5fp-wj9c-mxmx (CVE-2026-82562) | MODERATE, CVSS 6.3 | same |

`npm audit` counts these as "2 moderate", because it counts packages: qs, plus typed-rest-client through it. OSV counts 3 advisories on qs. None of them reaches the runtime SBOM, which holds viem's tree only.

## uv (installer for Semgrep)

| Item | Value |
|---|---|
| Release | `0.12.19`, published 2026-09-25 (https://github.com/astral-sh/uv/releases/tag/0.12.19); the newer 0.12.20–0.12.23 are < 7 days old |
| Asset | `uv-x86_64-unknown-linux-gnu.tar.gz` |
| Published SHA-256 (`.sha256` asset, and in `sha256.sum`) | `23bf5552d220e0842b65c862097b2ebaeba0064b74eda5e565e77fd25969d8c8` |
| `sha256sum -c` | `OK` |
| Installed binary | `.tools/bin/uv`, SHA-256 `242e462a63f5a3c0421d68557006193ecbfb61321cba0fe8542213ac62d92563` |

## Semgrep (SAST)

| Item | Value |
|---|---|
| Version | `semgrep==1.178.0`, published to PyPI 2026-09-23. 1.179.0 (2026-10-02) is < 7 days old |
| Wheel | `semgrep-1.178.0-…-none-manylinux_2_34_x86_64.whl`, SHA-256 `b7c4a4ba5cad1a6b0e76f7143c164b3f2853b9d0f902f2db2f64006257c941f2` (PyPI digest, also in the lock) |
| Lock | `tools/semgrep/requirements.txt`: 66 packages, each with `--hash`, from `uv pip compile --generate-hashes --exclude-newer 2026-09-28T00:00:00Z` (so every transitive package is ≥ 7 days old too). File SHA-256 `a0837cdc189eabaf3355757870e57f6769f8ccc167c2a3a8fa2612ce23b2cb6d` |
| Install | `uv venv` (system Python 3.14.4, `UV_PYTHON_DOWNLOADS=never`) + `uv pip sync --require-hashes` → `.tools/semgrep-venv` |
| Installed | `semgrep --version` = 1.178.0. `semgrep-core` SHA-256 `83223753cbd6495b93e890058e7a41cc6b634f42dc75d2d5dc76ba3687a3eca4` |
| Network at scan time | none: `--metrics=off`, `--disable-version-check`, `SEMGREP_ENABLE_VERSION_CHECK=0`, local rule files only (no `p/…` registry configs) |

**Deviation from the brief.** The brief said `uv tool install semgrep==<exact>`. That command pins Semgrep's version but not its 65 dependencies' hashes. A venv built from a `--require-hashes` lock is stricter (MC-33 "dependencies pinned"), so that is used instead.

### Rules
- **Vendor rules:** `semgrep/semgrep-rules` at commit `a84ff9cc2453ca91d581380de4b8b3f272f6f4be` (develop, 2026-09-22). Its `main` branch is stale (2022). Codeload tarball SHA-256 `b227c2d234ffd9c84c4dbd6619a5897a7192637c141baeace3bfc37b0715a887`. Only the `javascript/` and `typescript/` YAML rules are kept (205 rules plus LICENSE), in `.tools/semgrep-rules/<commit>/`. Their tree hash (sorted `sha256sum` of the files, hashed) is `906f567684f42fa6c0a5723344897179b0cf2b002c50c895a49124cc076ca3c3`, and it is re-checked on every run. License: Semgrep Rules License v1.0, which permits internal use.
- **Scope and threshold:** `src test tools scripts vitest.config.ts`. **Any finding fails**, at any severity (`--error`). Result on 2026-10-05: 0 findings.
- **MC-01 Semgrep layer** (`tools/semgrep/mc01-money-float.yml`, run on the money-path files only). It flags:
  - Number/parseFloat/parseInt/Math, reached bare, as `X.Name` or as `X['Name']`;
  - globalThis/global/window/self/Reflect/Function/eval;
  - `JSON.parse` and any other route into `JSON`;
  - toFixed/toPrecision/toExponential;
  - unary `+` and `~`;
  - any arithmetic or bitwise operator with a non-bigint literal operand (a number without `n`, or a string);
  - decimal or exponent literals.

  It is syntactic. CI plants 17 forms in temp copies and requires each one's rule, including `nativeWei(BigInt(+hex))`, `BigInt(("1.15"*100)|0)`, `~~`, `%`-rounding, `globalThis.Math`, `globalThis['Number']` and (fix block 3, m15) `r.json()` (`mc01-json-call`), `(0).constructor` (`mc01-constructor`), `as number` and `<number>x` (`mc01-number-assertion`).
- **MC-01 type-aware layer** (`tools/lint-money-floats.mjs`, authoritative). It uses the TypeScript checker and adds:
  - any operator (`+ - * / % ** | & ^ << >> >>> ~`, compound forms, `++`/`--`, unary `-`) with a non-bigint operand;
  - `BigInt(x)` for number-typed `x`;
  - explicit `any`;
  - **the float-type grep:** a `number` type, declared or inferred, on any declaration;
  - (fix block 3, m15) `MC01-number-expr`: any expression of `number` (or `any`) type, wherever the type is declared (an excluded module, a library); `MC01-number-assertion`: `as`, `<T>` or `satisfies` with a type containing `number`; `MC01-json-parse` also covers `.json` (Response/Body); `MC01-constructor`: `.constructor`, however reached. The lint now builds its program from the repository tsconfig (lib ES2023, types node), so it sees the types tsc sees.

  The only exemption is the six-row "Number allow-list" in docs/MONEY_PATH.md, now keyed by **declaration identity** (`Name`, `Outer.member`, `fn(i)`), never by name: `CbsPrecision` (a brand: values of exactly that type are exempt, and only an allowed value may be asserted to it), `cbsPrecision`, `cbsPrecision(0)`, `Eip1559ValueSend.chainId`, `ChainReader.chainId`, `ReadResult.code`. Locals have no identity. Each row must resolve to exactly one declaration or the lint throws. `.length` of a string/array is exempt from `MC01-number-expr` only (it can be compared; arithmetic and `BigInt(...)` on it still fail). `/` and `**` get no exemption at all. `test/unit/money-float-lint.test.ts` plants 62 forms (38 + 24 for m15: Z1/Z2 and name-keyed variants, N1–N5, A1/A9/A12, A5/A10 and variants, A6/A7) plus A8 (number declared in the excluded registry, used in policy) and two allow-list resolution failures, in temp copies of real files; each must fail with its own rule. A guard test hashes the real src/ before and after the plant suite and fails on any change. Old-vs-new on the m15 forms (scratch copies): 19 of 20 survived the round-2 lint, all 20 fail the new one.

## npm additions
`@vitest/coverage-v8` 4.1.11, exact, published 2026-08-18. It matches vitest 4.1.11, and its peer dependency requires that exact version. New transitive packages, with publication dates checked with `npm view`, all ≥ 7 days old:
- @bcoe/v8-coverage 1.0.2
- ast-v8-to-istanbul 1.0.7 (2026-09-21)
- istanbul-lib-coverage 3.2.2
- istanbul-lib-report 3.0.1
- istanbul-reports 3.2.0
- html-escaper 2.0.2
- magicast 0.5.5 (2026-09-11)
- @babel/parser 7.29.9 (2026-09-18)
- @babel/types 7.29.8
- @babel/helper-string-parser 7.29.7 and @babel/helper-validator-identifier 7.29.7
- make-dir 4.0.0, supports-color 7.2.0, has-flag 4.0.0

Every lockfile entry still carries an `integrity` hash.

## Install scripts (m6)
- `.npmrc` sets `ignore-scripts=true` and `save-exact=true`, and CI runs `npm ci --ignore-scripts`. So libxmljs2's `prebuild-install || node-gyp rebuild` never runs, and no unhashed native binary is fetched.
- The build, the tests, Stryker and the SBOM all pass without it. libxmljs2 is only cyclonedx-npm's XML validator. The SBOM is JSON, and its JSON-schema validation (`--validate`, through ajv) still runs: the log shows "try validating BOM result", with no error.

## SBOM (m9)
- `npm run sbom` = `cyclonedx-npm --omit dev --package-lock-only --output-format JSON --output-file sbom.cdx.json --validate --output-reproducible`, and ci.sh calls exactly that script, so the two can't disagree.
- `--omit dev`: the SBOM describes the shipped artefact, which today means viem's tree, 15 components. The dev toolchain is covered by SCA over the whole lockfile.
- **Hashes.** cyclonedx-npm 6.0.1 has no option to fill `component.hashes`. It records the lockfile `integrity` (SHA-512 of the registry tarball) as `externalReferences[type=distribution].hashes`.
- That record only appears reliably with `--package-lock-only`. Without it, the tool reads `npm ls`, which drops `integrity` once vitest or Stryker has touched `node_modules` (observed: 15/15 hashed straight after `npm ci`, 0/15 after a test run).
- ci.sh fails if any component lacks a distribution hash. Result: 15/15.

## cosign and SLSA (m5): SKIPPED, enforced as a G2 precondition
- **Not done:** keyless cosign signing and SLSA provenance both need an OIDC workload identity (Fulcio and Rekor through a hosted CI token). None exists on this workstation.
- **No substitute:** generating a long-lived signing key would break CLAUDE.md rule 2 (no secrets) and give no meaningful identity.
- **CI behaviour:** both stages print SKIPPED with this reason. The script still fails if `cosign` or `slsa-verifier` is installed but not wired in.
- **Before G2:** hosted CI (for example GitHub Actions with `id-token: write`) must produce and verify both before G2 (RUBRIC MC-33).
- **Enforced:** `tools/g2-precondition.mjs` runs as the last CI stage. It fails if the G2 row of docs/GATES.md is anything but `NOT SIGNED…` while cosign or SLSA is SKIPPED. A missing or duplicated G2 row also fails. Tests: `test/unit/g2-precondition.test.ts`, on synthetic fixtures. The wording of the precondition in GATES.md is the coordinator's to add; this block didn't edit GATES.md.

## Fix block 3 (m16, m17)
- **m16, import closure** (`test/unit/money-path.test.ts`). Non-relative specifiers are now examined. On a listed path, only `viem` (and subpaths) and `node:crypto` may be imported (grow only through a LEDGER entry). Absolute and `file:` specifiers are path edges. `createRequire`, `createRequireFromPath`, `getBuiltinModule`, `import.meta.resolve`, `x.require` and `x._load` are untraceable loaders and fail. Every module in the closure is checked against an LLM/agent SDK denylist (openai, @openai/*, @anthropic-ai/*, langchain*, @langchain/*, @google/generative-ai, @google/genai, @google-cloud/vertexai, cohere-ai, ollama, @mistralai/*, ai, @ai-sdk/*, llamaindex, @llamaindex/*, @modelcontextprotocol/*, groq-sdk, @huggingface/inference, replicate, together-ai, @aws-sdk/client-bedrock*, @azure/openai, @azure-rest/ai-inference, portkey-ai). MC-34 dependency scan: the runtime graph of package.json (dependencies, optional and peer, recursively, resolved through package-lock.json the way Node resolves node_modules; aliases checked by `name` and registry URL; a missing dependency fails) holds no denylisted package. Plants are in-memory overrides of src/policy (nothing is written): C3, C3b, C7, C7b, C8 (absolute path), C8b (`file:` URL), C9–C12 (SDK imports, including type-only and dynamic), C13 (unlisted package), C14; plus 6 crafted lockfiles (direct, nested transitive, hoisted transitive, npm alias, peer, missing).
- **m17, port checker** (`test/contract/port-contract-check.ts`). Index signatures fail (except `Record<string, never>`), a required field whose type admits `undefined` fails, a method with more than one call signature fails (and every overload's request is compared), and parameters must be exactly `(req, meta: CallMeta{callId})` with no optional or rest parameter. New self-tests: P13, P14, P14b (rest), P15, P28 (overload after the original), P28b (overload first), P30, and a non-CallMeta second parameter. Against the round-2 checker (scratch copy), P13, P14, P14b, P15, P28, P30 and the CallMeta plant survived; all are killed now.

