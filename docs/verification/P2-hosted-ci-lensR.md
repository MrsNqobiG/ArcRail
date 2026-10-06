VERIFICATION · lens: R · target: hosted-CI block (.github/workflows/ci.yml, .github/workflows/release-sign.yml, docs/CI.md, scripts/ci.sh cosign/SLSA/G2 stages, scripts/install-tools-phase2.sh, tools/g2-precondition.mjs + .d.mts, test/unit/g2-precondition.test.ts, docs/verification/tooling-phase2.md "Hosted CI") · commit: uncommitted working tree on HEAD 3830371 (not pushed)

Date: 2026-10-06. Verifier: independent subagent, fresh context. Requirements checked: KICKOFF §5 Phase 2 (lines 122-123: "artefact signing (cosign); SLSA provenance"; line 166: SLSA L3, Sigstore/cosign), RUBRIC MC-33 and MC-42, docs/GATES.md G2 row, CLAUDE.md rules 1, 2 and 6, and the rule that signing never runs on ordinary pushes.

Scope limits: the full `scripts/ci.sh` was not run, because other agents are editing src/ in parallel. Nothing was pushed and no workflow ran on GitHub, so OIDC, Fulcio, Rekor and the SLSA generator's runtime behaviour are checked by reading pinned sources only. All scratch work was done in real-file copies under /tmp (`/tmp/lensr-ci`, `/tmp/lensr-g2`, `/tmp/lensr-boot`, `/tmp/lensr-rep`). The one exception is `/tmp/lensr-g2/node_modules`, a read-only symlink used to resolve vitest. All of it was deleted afterwards. A `cmp` confirmed that `tools/g2-precondition.mjs` in the repo was never modified. No RPC was used. Nothing was signed or sent. No .env file or key was read.

## CHECKS

### A. Action pins (re-resolved with `git ls-remote`, then the GitHub API)
- A1 actions/checkout v7.0.1 → `3d3c42e5aac5ba805825da76410c181273ba90b1` (ls-remote; no peeled `^{}` line, so a lightweight tag). The API returns a commit object dated 2026-07-17. Release published 2026-07-20. **PASS**.
- A2 actions/setup-node v7.0.0 → `820762786026740c76f36085b0efc47a31fe5020`, commit 2026-07-14, release 2026-07-14. **PASS**.
- A3 actions/upload-artifact v7.0.1 → `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`, commit 2026-04-10, release 2026-04-10. **PASS**.
- A4 actions/download-artifact v8.0.1 → `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c`, commit 2026-03-11, release 2026-03-11. Its `action.yml` at that SHA has `digest-mismatch` default `'error'`, as the doc claims. **PASS**.
- A5 sigstore/cosign-installer v4.1.2 → `6f9f17788090df1f26f669e9d70d6ae9567deba6`, commit 2026-05-07 ("Bump cosign to 3.0.6"), release 2026-05-07. **PASS**.
- A6 slsa-framework/slsa-github-generator v2.1.0 → `f7dd8c54c2067bafc12ca7a55595d5ee9b75204a`, commit 2025-02-24, release 2025-02-24. It is referenced by tag, which SLSA requires; the exception is documented. **PASS**.
- A7 7-day publication-age rule: the newest pin is checkout v7.0.1 (2026-07-20), well over 7 days before 2026-10-06. **PASS**.
- A8 Every `uses:` in both workflows is a full 40-hex SHA, except the local `./.github/workflows/ci.yml` and the SLSA generator tag. Confirmed by grep. **PASS**.

### B. Tool hashes (re-fetched from official sources)
- B1 cosign v3.0.6 `cosign-linux-amd64` = `c956e5df…3f4c74`. Three sources agree:
  - `cosign_checksums.txt` from the v3.0.6 release;
  - the GitHub release asset digest;
  - `bootstrap_linux_amd64_sha` in cosign-installer's `action.yml` at `6f9f1778` (line 108), where `bootstrap_version='v3.0.6'`, the input default is `v3.0.6`, and the install directory is added to `$GITHUB_PATH`.

  The workflow's re-check line (`echo "<sha>  $(command -v cosign)" | sha256sum -c`) has the two-space separator `sha256sum -c` expects. **PASS**.
- B2 slsa-verifier v2.7.1 `slsa-verifier-linux-amd64` = `946dbec7…350339`. Sources: the `SHA256SUM.md` entry for v2.7.1 on slsa-verifier `main`, and the release asset digest. I downloaded the binary and its sha256 matched. `verify-artifact --help` lists `--provenance-path`, `--source-uri`, `--source-branch` and `--source-tag`. `cli/slsa-verifier/verify.go` at v2.7.1, line 27: `SUCCESS = "PASSED: SLSA verification passed"`. Release date 2025-06-27. **PASS**.
- B3 actionlint v1.7.12, checked before I used it: `actionlint_1.7.12_linux_amd64.tar.gz` passes `sha256sum -c` against the release's `actionlint_1.7.12_checksums.txt` (`8aca8db9…a3d8`), which equals the asset digest. The extracted binary is byte-identical (`cmp`) to `.tools/ci-check/actionlint`. The tag resolves to `914e7df21a07ef503a81201c76d2b11c789d3fca`. **PASS**.
- B4 shellcheck v0.11.0: the tarball sha256 `8c3be12b…7198` equals the GitHub asset digest (the release publishes no checksum file). The extracted binary is byte-identical to `.tools/ci-check/shellcheck`. **PASS**.
- B5 The node v22.23.3 archive sha `df450af8…02de` matches the line in nodejs.org `SHASUMS256.txt`. The gitleaks 8.30.1 archive sha `551f6fc8…70eb` matches the line in `gitleaks_8.30.1_checksums.txt`. **PASS**.

### C. Lint
- C1 actionlint 1.7.12 with shellcheck integrated, run on both workflows: 0 parse errors, 0 errors, exit 0. **PASS**.
- C2 `shellcheck -S warning` on `scripts/ci.sh` and `scripts/install-tools-phase2.sh`: clean. At the default severity there are only two SC2016 *info* notes (JS deliberately inside single quotes, ci.sh:131 and :152). `bash -n` passes on both. **PASS**.

### D. Triggers, permissions, secrets (traced from the YAML)
- D1 Signing never runs on ordinary pushes. `release-sign.yml` `on:` is only `workflow_dispatch` and `push: tags: ['v*']`. With only `tags` set, branch pushes do not trigger it. `ci.yml` has no `id-token` anywhere. `delegated_g2` in ci.sh fails if `cosign` or `slsa-verifier` is on PATH. **PASS**.
- D2 `pull_request` can't reach `id-token: write`. `pull_request` appears only in `ci.yml`, whose top-level permissions are `contents: read`. The workflows use no `pull_request_target`, `workflow_run` or `issue_comment` trigger (grep). The `build` job that calls ci.yml grants `contents: read` only. **PASS**.
- D3 No secrets and no long-lived keys. There are no `secrets.` references and no `GITHUB_TOKEN` or `token:` inputs. `persist-credentials: false` is set on both checkouts. Signing is keyless only (`cosign sign-blob --yes --bundle`; the generator uses Fulcio). **PASS**.
- D4 Script injection: every `${{ }}` sits in `env:`, `with:`, `outputs:` or `concurrency`, never inline in a `run:` script. **PASS**.
- D5 Per-job permissions, checked against the generator source at v2.1.0. The `generator` job needs id-token, contents: read and actions: read. `detect-env` needs id-token. `upload-assets` needs `contents: write` and runs only `if: inputs.upload-assets && startsWith(github.ref,'refs/tags/')…`. So the `provenance` job's `actions: read`, `id-token: write` and `contents: write` are the minimum GitHub accepts for this reusable workflow. The minimum holds for `g2-evidence`. `sign` and `verify-provenance` each carry an unused `contents: read` (defect m3). **[inspection-only] PASS with m3**.
- D6 Testnet only. Neither workflow nor docs/CI.md mentions an RPC, `arc.io`, 5042, `ARC_E2E` or `.env`. **PASS**.

### E. Fail-closed verification (traced)
- E1 Shells. release-sign sets `defaults.run.shell: bash` at workflow level, and ci.yml sets it at job level. GitHub runs an explicit `bash` as `bash --noprofile --norc -eo pipefail`, so each `| tee` pipe (verify-provenance, g2-evidence) propagates a failure. Every multi-line step also runs `set -euo pipefail`. **PASS**.
- E2 Subject chain:
  1. `build` writes `SHA256SUMS` and its base64.
  2. `sign` checks the downloaded artefacts against those subjects (`cmp subjects.txt SHA256SUMS`, then `sha256sum -c`). download-artifact itself fails on any digest mismatch.
  3. The generator gets `base64-subjects` from the same job output.
  4. `verify-provenance` checks both artefacts against the provenance.

  If the release step were skipped, the hashes would be empty: download-artifact would find no `release-artifacts` artifact, and the generator would get empty subjects, so the run fails. The generator's `continue-on-error` defaults to false, and its `final` job exits 27 on failure. **PASS**.
- E3 cosign identity. `IDENTITY` is fixed to `https://github.com/MrsNqobiG/ArcRail/.github/workflows/release-sign.yml@${{ github.ref }}`. This matches the Fulcio SAN (job_workflow_ref) of the signing job. `git remote -v` gives `https://github.com/MrsNqobiG/ArcRail.git`, so the case matches. A mismatch would fail closed. The issuer is pinned. **PASS**.
- E4 Self-tests. A wrong identity (`ci.yml@ref`) and a tampered blob are each wrapped in `if …; then exit 1`. They run only after the positive verification has passed, so they can't pass vacuously because of an outage. The same pattern applies to slsa-verifier (wrong `--source-uri`, tampered SBOM). **PASS**.
- E5 slsa-verifier is called with `--source-uri github.com/MrsNqobiG/ArcRail`, plus `--source-tag` on tag runs or `--source-branch` otherwise, over both artefacts. Success also requires `grep -q 'PASSED: SLSA verification passed'`. **PASS**.
- E6 `g2-evidence` needs `[build, sign, verify-provenance]`. It re-checks `GITHUB_REPOSITORY` and re-greps PASSED. **PASS**.

### F. Container and apt snapshot (re-fetched)
- F1 Registry `HEAD /v2/library/ubuntu/manifests/resolute-20260912` → `docker-content-digest: sha256:da6fc2be…8a78`. The sha256 of the downloaded index gives the same value. Docker Hub `tag_last_pushed` is 2026-09-18 (18 days old). The amd64 manifest is `sha256:61ebaa5c…b8a6` and its layer is `sha256:09923199…e9e`; I recomputed both hashes over the downloaded bytes. The `26.04` tag now resolves to `f144425f…`, the same as `resolute-20260927`, pushed 2026-10-04 and under 7 days old. The digest pin overrides the tag, as intended. **PASS**.
- F2 The image layer contains `usr/share/keyrings/ubuntu-archive-keyring.gpg`, the file the snapshot source's `Signed-By` points to. Its `dpkg/status` has apt 3.2.0, gpgv and ubuntu-keyring, and no python3, git, curl, xz-utils or ca-certificates. **PASS**.
- F3 The `snapshot.ubuntu.com/ubuntu/20260928T000000Z` main/amd64 Packages indexes contain:
  - `python3 3.14.3-0ubuntu2` (resolute);
  - `python3.14 3.14.4-1ubuntu0.2` (resolute-updates and -security);
  - `git 1:2.53.0-1ubuntu1`, `curl 8.18.0-1ubuntu2.7` and `xz-utils 5.8.3-1`, all as cited.

  The snapshot's `InRelease` is PGP-signed. **PASS**.

### G. G2 precondition (tests run, mutants planted in /tmp copies)
- G1 `npx vitest run test/unit/g2-precondition.test.ts` (node 22.23.3 from .tools): **30/30 passed**. This matches the "30 tests" claim. **PASS**.
- G2 23 mutants of `tools/g2-precondition.mjs` in a /tmp copy, each run against the unmodified test file. **15 killed, 8 survived**.

  Killed (tests failing):

  | Mutant | Tests failing |
  |---|---|
  | M2 duplicate row allowed | 1 |
  | M3 status read from the Meaning cell | 3 |
  | M4 citation check removed | 18 |
  | M5 citation searched in the whole file | 1 |
  | M7 lookahead removed | 3 |
  | M8 case-insensitive URL | 1 |
  | M9 skipped threshold > 1 | 2 |
  | M10 skipped-stage check removed | 8 |
  | M11 unknown option accepted | 2 |
  | M12 empty stage name allowed | 1 |
  | M13 CLI always exits 0 | 1 |
  | M16 no cell trim | 28 |
  | M19 run id `\w+` | 2 |
  | M20 `https?` | 1 |
  | M22 bad arguments exit 0 | 1 |

  Survived:
  - **M1** `/^NOT SIGNED\b/` → `/NOT SIGNED/` (unanchored). Fails open: a row reading "SIGNED-OFF (was NOT SIGNED)" would count as unsigned. Not caught.
  - **M6** lookahead weakened to one character. `…/runs/123.html` would be accepted.
  - **M14 / M15** row found by `startsWith('G2')` or `includes('G2')`. Equivalent on the real file and fail-closed (a duplicate row fails).
  - **M17** status regex made case-insensitive. Arguably equivalent.
  - **M18** `\b` removed. Equivalent.
  - **M21** unreadable gates file exits 0. Fails open; not caught.
  - **M23** missing file argument exits 0. Fails open; not caught.

  The block's own mutant counts are reproduced exactly: 18, 3, 1 and 8 for M4, M7, M5 and M10. **PASS with m2**.
- G3 Direct CLI probes of the real tool:

  | Probe | Exit | Result |
  |---|---|---|
  | missing file | 1 | correct |
  | no arguments | 2 | correct |
  | option given as the file | 2 | correct |
  | real GATES.md, `--delegated=cosign,slsa` | 0 | correct |
  | real GATES.md, no stages | 0 | correct |
  | "SIGNED-OFF (was NOT SIGNED)" | 1 | correct |
  | duplicate row written `\|G2\|` without spaces | 1 | correct |
  | `**G2**` (bold first cell) | 1 | found 0 rows: fail-closed |
  | "SIGNED-OFF …/runs/0" (a fabricated run id) | 0 | accepted: see m1 |
  | "NOT SIGNED. Superseded: SIGNED-OFF by …" | 0 | the documented prefix rule, see candidate C4 |

  **PASS with m1**.
- G4 ci.sh wiring:
  - `delegated_g2` prints the SKIPPED text quoted in docs, and returns 1 if the binary is on PATH (`set -e` turns that into a CI failure).
  - The precondition runs as `node tools/g2-precondition.mjs docs/GATES.md --delegated=cosign,slsa`.
  - `g2-evidence` calls the tool with no stages.

  **PASS**.

### H. install-tools-phase2.sh, clean-runner bootstrap (re-run)
- H1 I copied the installer, `tools/verify-venv.py` and the lock to an empty /tmp tree and ran it: exit 0 in 4 m 33 s (the doc says 2 m 43 s; the difference is network). It printed `tools OK (all hashes re-verified)…` for node 22.23.3 tree, gitleaks 8.30.1, osv-scanner v2.6.0, uv 0.12.19, semgrep 1.178.0 venv and semgrep-rules a84ff9cc. No `.tools/dl.*` directory was left behind. **PASS**.
- H2 Each of these tamper cases exits 1:
  - one byte appended to a file in the node tree → `FAIL: node install tree differs from the official archive`;
  - the `.tools/node` link removed while the tree stays → `FAIL: .tools/node must link to …`. The tree's presence blocks a reinstall, so the tampering can't be papered over;
  - one byte appended to gitleaks → `FAIL: sha256 mismatch … want 88f91962…`.

  **PASS**.
- H3 Archive hashes are checked before extraction (`verify` comes before `tar`). Downloads use `--proto '=https' --tlsv1.2 --fail`. **PASS**.

### I. Release artefact recipe
- I1 I ran the `tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner | gzip -9n` recipe on a /tmp copy of `dist/`:
  - two runs gave the same sha256 (`274579d7…c744`);
  - after I changed every file's mtime, the output was still identical;
  - the base64 subjects round-trip byte for byte (`base64 -d | cmp`).

  **PASS**.

### J. Rubric items
- J1 **MC-33** ("cosign-signed artefacts and SLSA provenance produced and verified in CI"; check: "`cosign verify` and the provenance verifier run in CI"). release-sign.yml runs keyless `cosign sign-blob` and `verify-blob` with a pinned identity and issuer. It also runs SLSA generic-generator provenance and then `slsa-verifier verify-artifact`. Each has a negative self-test and fails closed (E1–E6). It is not yet *evidenced*: no run has happened, since nothing is pushed. **[inspection-only] PASS (design)**; evidence is pending the first run.
- J2 **MC-42** (a SIGNED-OFF must come from a commit signed by the named human, verified by CI against an external anchor). This block does not implement it and says so (docs/CI.md §6: "They must also record the signature per MC-42"). A grep of tools/, scripts/ and the workflows finds no git-provenance check anywhere in CI. That gap is outside this block's deliverables, but the G2 citation check's soundness depends on it (see m1). **Noted; no separate defect charged to this block.**
- J3 **docs/GATES.md G2.** The row's wording ("A SIGNED-OFF G2 row must cite that successful run … from `main` or a `v*` tag; `scripts/ci.sh` fails a SIGNED-OFF row without that citation") is accurate about what ci.sh enforces (a citation exists). It does not claim that CI checks success or branch. **PASS (with m1)**.
- J4 **KICKOFF Phase 2**, cosign and SLSA: covered (J1). **PASS**.

### K. Documentation claims re-derived
- K1 Every SHA, date, hash, digest and package version in the "Hosted CI" table of tooling-phase2.md matches A–F. **PASS**.
- K2 docs/CI.md §2's per-job permissions table matches the YAML. The §5 local-verify commands match the workflow flags. **PASS**.
- K3 The tooling doc's claim that the setup-node node "only runs tools/g2-precondition.mjs in the g2-evidence job" holds. In ci.yml no step before `ci.sh` invokes node (install-tools and fetch-osv-db use only curl and python3), and ci.sh puts `.tools/node/bin` first on PATH. **PASS**.

## CANDIDATES
- **C1** `tools/g2-precondition.mjs:35`, `const RUN_URL = /https:\/\/github\.com\/MrsNqobiG\/ArcRail\/actions\/runs\/(\d+)(?![\w/.-]*[\w/-])/g;`, together with `scripts/ci.sh:173`, `node tools/g2-precondition.mjs docs/GATES.md --delegated=cosign,slsa`. Criterion: MC-33, the G2 precondition, and "required stage silently passing". **REAL (minor)**. Any syntactically valid run id passes, including `runs/0` (probe G3), a `ci.yml` run, a failed run, or a run on a non-main branch. Before this block, a signed G2 always failed while ci.sh skipped the stages; now a citation alone satisfies the check, and MC-42 is not enforced in CI (J2). It is not blocking:
  - the signing and provenance path in release-sign.yml cannot be skipped, forged or mis-verified (D, E);
  - the limit is stated in the tool header ("proves a citation exists, not that the cited run passed") and in docs/CI.md §6;
  - only a named human may write SIGNED-OFF (CLAUDE.md rule 6).
- **C2** `test/unit/g2-precondition.test.ts`. Mutants M1 (`/NOT SIGNED/` unanchored), M21 (`cannot read` → `process.exit(0)`) and M23 (usage → `process.exit(0)`) all survive. Criterion: verifier method, "tests would fail if the code were wrong", and MC-33 fail-closed. **REAL (minor)**. The real code behaves correctly (G3), but nothing pins three fail-open directions.
- **C3** `.github/workflows/release-sign.yml:47-49`, `permissions:` with `id-token: write` and `contents: read` (sign), and `:157-158` with `contents: read` (verify-provenance). Criterion: least privilege per job. **REAL (minor)**. Neither job checks out the repo or calls the GitHub API: artefacts come through download-artifact's runtime token in the same run, and cosign and slsa-verifier come from public release URLs. Under `permissions: {}`, the grant is unused. [inspection-only] reasoning; it can only be confirmed on a hosted run.
- **C4** `tools/g2-precondition.mjs:51`, `const unsigned = /^NOT SIGNED\b/.test(status);`. A row "NOT SIGNED. Superseded: SIGNED-OFF by J. Doe" passes as unsigned (G3). Criterion: MC-33 fail-closed. **DISMISSED**. The rule is documented ("A status that doesn't start with `NOT SIGNED` counts as signed"). Such a row is self-contradictory and unsigned by its own first words. No other consumer reads G2 (the G-M check in `src/chain/config/index.ts:185` requires `status === 'SIGNED-OFF'` exactly).
- **C5** `.github/workflows/release-sign.yml:141`, `uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.1.0`. This is a mutable tag, not a SHA. Criterion: MC-33, "Dependencies pinned". **DISMISSED**. The SLSA README requires referencing by tag. I re-resolved the tag to `f7dd8c54…`. The exception and its compensating control are documented in the YAML, docs/CI.md and tooling-phase2.md.
- **C6** `release-sign.yml:18`, `workflow_dispatch:`. A collaborator can dispatch from any branch, including one with an edited release-sign.yml. Criterion: signing reachable from untrusted triggers. **DISMISSED**. Dispatch needs write access, so it is not an untrusted trigger. The bundle identity then names that branch (`@refs/heads/<branch>`), so it can't pass for `main`. docs/CI.md §3 says to cite only `main` or `v*` runs, and §7.4 recommends a tag ruleset. The enforcement gap is part of C1.
- **C7** `ci.yml:58-59`, `ca-certificates` installed unpinned from the image's default sources. Criterion: pinning. **DISMISSED**. The step is apt-signature-verified, it is disclosed in docs (tooling-phase2.md, "its exact version isn't pinned"), and it is not on the signing path.

## DEFECTS
- **m1** · `tools/g2-precondition.mjs:35,54` and `scripts/ci.sh:173` · Lens R, MC-33 / GATES G2 precondition (with MC-42 unenforced) · **minor**. The precondition accepts any well-formed `…/actions/runs/<digits>` URL. It does not check that the run is `release-sign.yml`, succeeded, or ran on `main` or a `v*` tag; `runs/0` passes. Suggested fix: in hosted `ci.yml`, add an online check of each cited run through the GitHub API (`actions: read`): `path == .github/workflows/release-sign.yml`, `conclusion == success`, `head_branch == main` or a `v*` tag event. Also implement the MC-42 git-provenance check in CI.
- **m2** · `test/unit/g2-precondition.test.ts` · Lens R, method (mutation) / MC-33 · **minor**. M1 (unanchored `NOT SIGNED`), M21 (unreadable file → exit 0) and M23 (no file argument → exit 0) survive, so three fail-open directions go untested. M6 (`…/runs/123.html` accepted) also survives. Suggested tests: a status like "SIGNED-OFF (was NOT SIGNED)" must fail without a citation; CLI exit 1 on a missing file and exit 2 with no arguments; `…/runs/123.html` must be rejected.
- **m3** · `.github/workflows/release-sign.yml:49` (sign) and `:158` (verify-provenance) · Lens R, least-privilege permissions · **minor**. `contents: read` is granted but unused. Remove it, or record why it is needed.

Observations, not charged to this block: the `scripts/ci.sh:15` header says "gitleaks (--no-git: the repo has no commits yet)", which is stale now that commits `4ebdbed` and `3830371` exist; it is outside the target stages. In the g2-evidence summary, `sed 's# \./#  #'` leaves three spaces between digest and name, which is cosmetic.

## VERDICT
**NEGATIVE (3 defects: 0 blocking, 3 minor)**

No blocking defect. Signing and provenance can't be skipped, forged or mis-verified inside release-sign.yml, and every verification step fails closed. No secret or long-lived key is used. Signing is reachable only through `workflow_dispatch` and `v*` tags (write access), never through `push` to a branch or through `pull_request`. Every pin, hash, digest and snapshot version re-derived exactly.

P2 hosted-CI block · units frozen/total: coordinator-owned · streak: coordinator-owned · rounds: coordinator-owned · regen budget: coordinator-owned
