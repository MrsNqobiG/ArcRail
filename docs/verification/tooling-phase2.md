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

## cosign and SLSA (m5): run in hosted CI (release-sign.yml), cited for G2
- **Locally and in `ci.yml`: SKIPPED.** `scripts/ci.sh` prints `SKIPPED: runs in .github/workflows/release-sign.yml (hosted CI, keyless)` for both stages. Keyless signing needs an OIDC workload identity, and there is none on a workstation. Generating a long-lived key would break CLAUDE.md rule 2 (no secrets). The stages still fail if `cosign` or `slsa-verifier` is on `PATH`.
- **In `.github/workflows/release-sign.yml`:** keyless `cosign sign-blob` and `verify-blob` with a pinned identity and issuer; SLSA generic-generator provenance; `slsa-verifier verify-artifact`. Each step has a negative self-test. Runs only on `workflow_dispatch` and `v*` tags. Full description: docs/CI.md.
- **G2 precondition** (`tools/g2-precondition.mjs`, 2026-10-06):
  - `ci.sh` passes `--delegated=cosign,slsa`.
  - A G2 row that is signed must cite, in that row, a release-sign run as `https://github.com/MrsNqobiG/ArcRail/actions/runs/<run-id>` (digits, no further path). Otherwise CI fails.
  - A stage passed as plainly skipped (not delegated) still fails a signed G2.
  - A missing or duplicated G2 row still fails.
  - `release-sign.yml`'s `g2-evidence` job runs the tool with no skipped stages.
  - Tests: `test/unit/g2-precondition.test.ts`, 30 tests on synthetic fixtures, including a CLI exit-code test.
  - Mutants, each in place and then restored byte for byte (`cmp`): citation check removed (18 tests fail), URL lookahead removed (3 fail), citation searched in the whole file instead of the G2 row (1 fails), skipped-stage check removed (8 fail).
  - The GATES.md wording of the precondition is the coordinator's to update; this block didn't edit GATES.md.

## Hosted CI (GitHub Actions), 2026-10-06

Workflows: `.github/workflows/ci.yml` and `.github/workflows/release-sign.yml`. Each action is pinned by full commit SHA, with the tag in a comment. The one exception is the SLSA reusable workflow, which SLSA requires by tag (below).

**SHA verification.** Each SHA comes from `git ls-remote https://github.com/<owner>/<repo> refs/tags/<tag> 'refs/tags/<tag>^{}'`. None of these tags printed a peeled `^{}` line, so all are lightweight tags pointing straight at a commit. Each was then confirmed to be a commit object with `curl https://api.github.com/repos/<owner>/<repo>/git/commits/<sha>`, which returned the commit and its date.

**Publication-age rule.** Each pin is at least 7 days old on 2026-10-06. Release dates come from the GitHub releases API.

| Action / reusable workflow | Tag | Commit SHA | Released | Used in |
|---|---|---|---|---|
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-07-20 | ci, g2-evidence |
| actions/setup-node | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` | 2026-07-14 | ci, g2-evidence |
| actions/upload-artifact | v7.0.1 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | 2026-04-10 | ci (release only), sign, verify-provenance, g2-evidence |
| actions/download-artifact | v8.0.1 | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` | 2026-03-11 | sign, verify-provenance, g2-evidence (`digest-mismatch: error` is v8's default) |
| sigstore/cosign-installer | v4.1.2 | `6f9f17788090df1f26f669e9d70d6ae9567deba6` | 2026-05-07 | sign |
| slsa-framework/slsa-github-generator `generator_generic_slsa3.yml` | **v2.1.0 (by tag)** | tag resolves to `f7dd8c54c2067bafc12ca7a55595d5ee9b75204a` | 2025-02-24 | provenance |

**Why the SLSA generator is referenced by tag.** The slsa-github-generator README at v2.1.0 ("Referencing SLSA builders and generators") says builders and generators "MUST be referenced by tag in order for the slsa-verifier to be able to verify the ref of the trusted builder/generator's reusable workflow", and as `@vX.Y.Z`. It calls this "contrary to the GitHub best practice… intentional due to limits in GitHub Actions" (slsa-verifier issue #12). slsa-verifier accepts the provenance only from the trusted generator at a release tag. Generator inputs, outputs and job permissions were read from the workflow file at v2.1.0:
- inputs `base64-subjects`, `provenance-name`, `private-repository`, `upload-assets`;
- output `provenance-name`;
- the `generator` job needs `id-token: write`, `contents: read`, `actions: read`;
- the `upload-assets` job needs `contents: write`.

Its README "Private Repositories" section says `private-repository: true` is the opt-in to publishing a private repo's name to the public Rekor log, and that the generator errors without it.

**Tools fetched by the workflows:**

| Tool | Version | Source | Integrity check | How the reference value was verified |
|---|---|---|---|---|
| cosign | v3.0.6 (cosign-installer v4.1.2's default and bootstrap version, set explicitly) | github.com/sigstore/cosign release `cosign-linux-amd64` | The installer checks its hard-coded sha256 `c956e5dfcac53d52bcf058360d579472f0c1d2d9b69f55209e256fe7783f4c74`, and the workflow re-checks the installed binary with `sha256sum -c` | Same value in `https://github.com/sigstore/cosign/releases/download/v3.0.6/cosign_checksums.txt` (line `cosign-linux-amd64`) and in the installer's `action.yml` at `6f9f1778` |
| slsa-verifier | v2.7.1 (2025-06-27) | `https://github.com/slsa-framework/slsa-verifier/releases/download/v2.7.1/slsa-verifier-linux-amd64` | `sha256sum -c` against `946dbec729094195e88ef78e1734324a27869f03e2c6bd2f61cbc06bd5350339` | Two sources agree: `SHA256SUM.md` on slsa-verifier `main` (commit `30d0be3bbab553fc51557377baba2f7572dfc212`; the copy at the v2.7.1 tag predates the release and lists only ≤ v2.7.0), and the GitHub release asset digest. Downloaded here, `sha256sum -c` OK. `verify-artifact --help` shows the flags used (`--provenance-path`, `--source-uri`, `--source-branch`, `--source-tag`). Success string `PASSED: SLSA verification passed` read from `cli/slsa-verifier/verify.go` at v2.7.1 |
| Container image | `ubuntu:26.04@sha256:da6fc2be547864451aa253836dd926da33623312df4a9a243e35dc877c378a78` (tag `resolute-20260912`, pushed 2026-09-18; the newer `resolute-20260927` is < 7 days old) | Docker Hub `library/ubuntu` | Pinned by index digest | Registry `HEAD …/manifests/resolute-20260912` → `docker-content-digest` above. `sha256sum` of the downloaded index gives the same value. amd64 manifest `sha256:61ebaa5c…b8a6`, layer `sha256:09923199…e9e`. The layer's `dpkg/status` has no python3, git, curl, xz or ca-certificates, which is why the first step installs them |
| OS packages | Ubuntu snapshot `20260928T000000Z`: python3.14 `3.14.4-1ubuntu0.2`, python3 `3.14.3-0ubuntu2`, git `1:2.53.0-1ubuntu1`, curl `8.18.0-1ubuntu2.7`, xz-utils `5.8.3-1` (the same versions as this workstation) | `https://snapshot.ubuntu.com/ubuntu/20260928T000000Z/` | apt: signed `InRelease` (ubuntu-archive-keyring in the image), then package hashes. python3.14 and python3 pinned with `=`. The step fails unless `/usr/bin/python3` reports 3.14.4 | Resolved offline with `apt-get -s install` against the image's own `dpkg/status` and the snapshot indexes: 50 packages, no errors. `ca-certificates` (needed for HTTPS to the snapshot) comes first from the image's default sources, so its exact version isn't pinned |
| node | 22.23.3, used by `setup-node` | actions/node-versions manifest | None by us | The pipeline itself runs on the hash-verified `.tools/node`, which `ci.sh` puts first on `PATH`. The setup-node copy only runs `tools/g2-precondition.mjs` in the g2-evidence job |

**Clean-runner bootstrap** (`scripts/install-tools-phase2.sh`, 2026-10-06). On a clean runner `.tools/` doesn't exist (it is git-ignored), so the installer now also installs the Phase 0 tools:
- **node:** `node-v22.23.3-linux-x64.tar.xz` from nodejs.org, checked against `df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de` (the line in `https://nodejs.org/dist/v22.23.3/SHASUMS256.txt`, re-fetched 2026-10-06) before extraction. This happens only when both the node tree and the `.tools/node` link are absent; a partial install still fails.
- **gitleaks:** `gitleaks_8.30.1_linux_x64.tar.gz`, checked against `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` (the line in `gitleaks_8.30.1_checksums.txt`) before extraction.
- **Every run, as before:** the node tree hash and the gitleaks binary hash are re-verified. `mkdir -p .tools/bin` now runs before the scratch directory is created inside `.tools`.
- **Tested in a scratch copy** (installer, `verify-venv.py` and the lock only, no `.tools/`): full install in 2 m 43 s. Same node tree hash `1842bae0…b27e`; semgrep venv 66 = 66 = 66, 2,852 entries; a second run re-verified everything.
- **Fail-closed checks:** removing the `.tools/node` link alone → `FAIL: .tools/node must link to …`; one byte appended to the node tree → `FAIL: node install tree differs`.

**Release artefacts.**
- **Why not `npm pack`:** `npm pack --dry-run --json --ignore-scripts` lists 225 files and 0 under `dist/`. The package is private and has no `files` list, so npm follows `.gitignore`, which excludes `dist/`.
- **What is shipped instead:** `tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -cf - dist | gzip -9n`. Built twice here from the same `dist/`, both runs had identical sha256. The base64 subjects round-trip with `base64 -d | cmp`.

**Validation, 2026-10-06** (nothing pushed, nothing run on GitHub):
- **YAML:** both workflows parse with `python3 -c 'import yaml'` (PyYAML).
- **actionlint v1.7.12:** clean on both workflows, with shellcheck integrated. The binary is `actionlint_1.7.12_linux_amd64.tar.gz`, sha256 `8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8`, checked with `sha256sum -c` against the release's `actionlint_1.7.12_checksums.txt` (equal to the GitHub asset digest); tag `v1.7.12` = `914e7df21a07ef503a81201c76d2b11c789d3fca`.
- **shellcheck v0.11.0:** `shellcheck-v0.11.0.linux.x86_64.tar.xz`, sha256 `8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198`. The release publishes no checksum file, so this value is the GitHub release asset digest, and the download matched it. `shellcheck -S warning` is clean on `scripts/ci.sh` and `scripts/install-tools-phase2.sh`.
- **Syntax:** `bash -n` passes on every modified script.
- **Not run locally:** the full `scripts/ci.sh` (parallel Phase 3 work in `src/` and `test/`). The hosted jobs themselves (OIDC, Fulcio, Rekor) can only run on GitHub.

## Fix block 3 (m16, m17)
- **m16, import closure** (`test/unit/money-path.test.ts`). Non-relative specifiers are now examined. On a listed path, only `viem` (and subpaths) and `node:crypto` may be imported (grow only through a LEDGER entry). Absolute and `file:` specifiers are path edges. `createRequire`, `createRequireFromPath`, `getBuiltinModule`, `import.meta.resolve`, `x.require` and `x._load` are untraceable loaders and fail. Every module in the closure is checked against an LLM/agent SDK denylist (openai, @openai/*, @anthropic-ai/*, langchain*, @langchain/*, @google/generative-ai, @google/genai, @google-cloud/vertexai, cohere-ai, ollama, @mistralai/*, ai, @ai-sdk/*, llamaindex, @llamaindex/*, @modelcontextprotocol/*, groq-sdk, @huggingface/inference, replicate, together-ai, @aws-sdk/client-bedrock*, @azure/openai, @azure-rest/ai-inference, portkey-ai). MC-34 dependency scan: the runtime graph of package.json (dependencies, optional and peer, recursively, resolved through package-lock.json the way Node resolves node_modules; aliases checked by `name` and registry URL; a missing dependency fails) holds no denylisted package. Plants are in-memory overrides of src/policy (nothing is written): C3, C3b, C7, C7b, C8 (absolute path), C8b (`file:` URL), C9–C12 (SDK imports, including type-only and dynamic), C13 (unlisted package), C14; plus 6 crafted lockfiles (direct, nested transitive, hoisted transitive, npm alias, peer, missing).
- **m17, port checker** (`test/contract/port-contract-check.ts`). Index signatures fail (except `Record<string, never>`), a required field whose type admits `undefined` fails, a method with more than one call signature fails (and every overload's request is compared), and parameters must be exactly `(req, meta: CallMeta{callId})` with no optional or rest parameter. New self-tests: P13, P14, P14b (rest), P15, P28 (overload after the original), P28b (overload first), P30, and a non-CallMeta second parameter. Against the round-2 checker (scratch copy), P13, P14, P14b, P15, P28, P30 and the CallMeta plant survived; all are killed now.

