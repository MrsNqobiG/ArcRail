# Hosted CI (GitHub Actions)

Repo: `MrsNqobiG/ArcRail` (private), branch `main`. Two workflows live in `.github/workflows/`. Both are testnet-only, like everything else here: nothing in CI touches Arc, and there are no long-lived keys and no secrets. The only credential is the short-lived GitHub OIDC token that the signing jobs request.

## 1. `ci.yml`: the full pipeline on every change

- **Triggers:** `push` and `pull_request` to `main`. It can also be called by `release-sign.yml` (`workflow_call`).
- **Permissions:** `contents: read` only.
- **Runner:** `ubuntu-latest`, inside an Ubuntu 26.04 container pinned by digest (`ubuntu:26.04@sha256:da6fc2be…8a78`, tag `resolute-20260912`).
  - **Why a container:** the Semgrep venv is verified file by file (`tools/verify-venv.py`), against hashes derived with `/usr/bin/python3` 3.14.4. Those include `pyvenv.cfg`, which records the Python version and home. The host runner's Python is a different version, so it would fail that check.
  - **Packages:** the first step installs `ca-certificates` from the image's own sources. It then installs everything else (`python3.14=3.14.4-1ubuntu0.2`, `python3=3.14.3-0ubuntu2`, git, curl, xz-utils) from the Ubuntu snapshot `20260928T000000Z`, so versions can't drift. apt verifies the signed `InRelease` and every package hash.
- **Steps:**
  1. checkout;
  2. `setup-node` at 22.23.3 (no cache);
  3. `bash scripts/install-tools-phase2.sh`. On a clean runner this installs every tool from its pinned source, node and gitleaks included, and checks every hash;
  4. `bash scripts/fetch-osv-db.sh`;
  5. `bash scripts/ci.sh`.

  `ci.sh` puts the hash-verified `.tools/node` first on `PATH`, so the pipeline runs on the verified node, not the one `setup-node` installed.
- **cosign and SLSA:** SKIPPED here. `ci.sh` prints `SKIPPED: runs in .github/workflows/release-sign.yml (hosted CI, keyless)`. If `cosign` or `slsa-verifier` is on `PATH`, those stages fail, so a local or `ci.yml` run can't pass itself off as a signing run.
- **Caching:** none. There is no `actions/cache`, and setup-node's `package-manager-cache` is `false`. Every run fetches and re-verifies each tool, so a poisoned cache can't feed a tool past its hash check.
- **Release artefacts:** only when `release-sign.yml` calls the workflow (`release-artifacts: true`). After the full pipeline passes, the same job builds:
  - `arc-rail-adapter-dist.tar.gz`: a reproducible tar of `dist/` (sorted, mtime 0, owner 0:0, `gzip -n`). `npm pack` isn't used: the package is private and has no `files` list, so `npm pack` follows `.gitignore`, which excludes `dist/`. Its tarball would hold the sources, `.claude/` and `docs/`, and none of the build.
  - `sbom.cdx.json`: the CycloneDX SBOM that `ci.sh` has just checked.
  - `SHA256SUMS`, plus its base64 (the SLSA generator's `base64-subjects`), passed out as the workflow output `hashes`.

## 2. `release-sign.yml`: keyless signing and SLSA provenance

- **Triggers:** only `workflow_dispatch` and tags matching `v*`, never ordinary pushes. The reason: Sigstore's transparency log is public (see §4), and this repo is private.
- **Permissions:** `permissions: {}` at the top; each job grants its own.

| Job | Permissions | What it does |
|---|---|---|
| `build` | `contents: read` | Calls `ci.yml` with `release-artifacts: true`: the same container, tools and full `ci.sh`, then the artefacts and their subjects |
| `sign` | `id-token: write`, `contents: read` | Checks the downloaded artefacts against `build`'s subjects (`cmp`, then `sha256sum -c`). Installs cosign v3.0.6 with `sigstore/cosign-installer` and re-checks the binary's sha256. For each artefact, runs `cosign sign-blob --yes --bundle <name>.sigstore.json <name>` (keyless, GitHub OIDC), then `cosign verify-blob --bundle <name>.sigstore.json --certificate-identity "https://github.com/MrsNqobiG/ArcRail/.github/workflows/release-sign.yml@<github.ref>" --certificate-oidc-issuer https://token.actions.githubusercontent.com <name>`. Any verification failure fails the job. Self-test: a wrong identity (`ci.yml@…`) and a tampered artefact must both be rejected. Uploads the bundles as the artifact `cosign-bundles` |
| `provenance` | `actions: read`, `id-token: write`, `contents: write` | `slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.1.0`, with `private-repository: true` and `provenance-name: arc-rail.intoto.jsonl`. `upload-assets` is true only for tag runs, which attach the provenance to the GitHub release. `contents: write` is there because GitHub checks the generator's upload job permissions at start-up, even on runs that skip it |
| `verify-provenance` | `contents: read` | Downloads the artefacts and the provenance. Installs slsa-verifier v2.7.1 from the official release, sha256-checked. Runs `slsa-verifier verify-artifact --provenance-path arc-rail.intoto.jsonl --source-uri github.com/MrsNqobiG/ArcRail` with `--source-tag <tag>` on tag runs or `--source-branch <branch>` otherwise, over both artefacts. Failure fails the workflow. Self-test: a wrong source repository and a tampered artefact must both fail. Uploads the artifact `provenance-verification` (the provenance and the verifier output) |
| `g2-evidence` | `contents: read` | Runs after `sign` and `verify-provenance`. Runs `node tools/g2-precondition.mjs docs/GATES.md` with no skipped stages. Writes `g2-evidence.md`: the run URL and the citation line to paste, event, ref, commit, artefact sha256 digests, bundle names and digests, the signer identity and issuer, the provenance digest, the slsa-verifier output, and the precondition result. Uploads it as the artifact `g2-evidence` and shows it in the run summary |

**Why the SLSA generator is referenced by tag.** Every other action is pinned by commit SHA. The SLSA generator is the one exception, by SLSA's own rule: builders and generators "MUST be referenced by tag in order for the slsa-verifier to be able to verify the ref of the trusted builder/generator's reusable workflow", and as `@vX.Y.Z` (slsa-github-generator README, "Referencing SLSA builders and generators"; slsa-verifier issue #12). The compensating control: `slsa-verifier` accepts the provenance only if it comes from the trusted generator at a release tag. Tag `v2.1.0` resolved to commit `f7dd8c54c2067bafc12ca7a55595d5ee9b75204a` (docs/verification/tooling-phase2.md).

## 3. How the operator triggers signing

Either:
- **Manual run:** GitHub → `MrsNqobiG/ArcRail` → **Actions** → **release-sign** → **Run workflow** → branch `main` → **Run workflow**. The signer identity is then `…/release-sign.yml@refs/heads/main`.
- **Tag:**
  ```
  git tag v0.1.0 && git push origin v0.1.0
  ```
  The signer identity is then `…/release-sign.yml@refs/tags/v0.1.0`, and the provenance is attached to the `v0.1.0` release.

`workflow_dispatch` can be started from any branch that contains the workflow. Cite only runs on `main` or on a `v*` tag for G2.

When the run finishes, open it and download the **g2-evidence** artifact (or read the run summary). Every job must be green.

## 4. What goes to the public Sigstore log

Sigstore's transparency log (Rekor) is public and append-only, so nothing written there can be removed. Each signing writes one entry: one per artefact from cosign, and one for the provenance from the SLSA generator. Each entry holds:
- **The Fulcio certificate**, which names:
  - the repository `MrsNqobiG/ArcRail` (so a private repo becomes discoverable);
  - the workflow path `.github/workflows/release-sign.yml`, the ref (`refs/heads/main` or `refs/tags/v…`) and the commit SHA;
  - the trigger event, the run ID and attempt, and the runner environment;
  - the repository and owner IDs.

  For the provenance, the certificate names the SLSA generator workflow, and the caller's details sit in the signed provenance.
- **The artefacts' sha256 digests and the signature.** The SLSA entry also carries the provenance itself: subjects with digests, the build's workflow inputs, the source repository, ref and commit.
- **Not included:** the artefacts' contents, source code, secrets or any personal information. Nothing goes on Arc; CI never touches the chain.

`private-repository: true` is the generator's explicit opt-in to this. Without it, the generator refuses to run for a private repo.

## 5. Verify an artefact locally

Download the run's `release-artifacts`, `cosign-bundles` and `provenance-verification` artifacts (or the release assets for a tag) into one directory. Then:

```sh
# cosign v3 (https://github.com/sigstore/cosign/releases; check the binary against cosign_checksums.txt)
REF=refs/heads/main            # or refs/tags/v0.1.0
for f in arc-rail-adapter-dist.tar.gz sbom.cdx.json; do
  cosign verify-blob --bundle "$f.sigstore.json" \
    --certificate-identity "https://github.com/MrsNqobiG/ArcRail/.github/workflows/release-sign.yml@$REF" \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com "$f"
done

# slsa-verifier v2.7.1 (linux-amd64 sha256 946dbec729094195e88ef78e1734324a27869f03e2c6bd2f61cbc06bd5350339)
slsa-verifier verify-artifact --provenance-path arc-rail.intoto.jsonl \
  --source-uri github.com/MrsNqobiG/ArcRail --source-branch main \
  arc-rail-adapter-dist.tar.gz sbom.cdx.json
# for a tag run use: --source-tag v0.1.0
```

To confirm the tarball is the code you expect, rebuild it from the same commit: `npx tsc -p tsconfig.build.json`, then the `tar … | gzip -9n` line in `ci.yml`. Compare `sha256sum`. The tar and gzip flags are set so the output is reproducible.

## 6. The G2 citation (exact format)

`tools/g2-precondition.mjs` runs as the last stage of `scripts/ci.sh` (with `--delegated=cosign,slsa`) and again in `release-sign.yml`'s `g2-evidence` job (with no stages). If the G2 row of `docs/GATES.md` is signed (any status not starting with `NOT SIGNED`), that same row must contain a release-sign run URL of exactly this form:

```
https://github.com/MrsNqobiG/ArcRail/actions/runs/<run-id>
```

- `<run-id>` is digits only.
- No job, attempt or other suffix (`…/runs/123/job/456` is rejected).
- The owner and repository spelling and case must match exactly.

Write it in the row as:

```
release-sign run https://github.com/MrsNqobiG/ArcRail/actions/runs/<run-id>
```

The `g2-evidence` artifact prints this line ready to paste. If a signed G2 row has no such URL, CI fails, locally and in `ci.yml`. A cosign or SLSA stage reported as plainly skipped (rather than delegated to release-sign) still fails a signed G2 too.

The check is offline, so it proves a citation is present, not that the cited run passed. The human signing G2 must cite a run whose jobs are all green and whose `g2-evidence` shows `PASSED: SLSA verification passed`. They must also record the signature per MC-42 (a signed commit by a named human). Tests: `test/unit/g2-precondition.test.ts`.

## 7. Operator setup in GitHub (one-off)

1. **Settings → Actions → General → Actions permissions:** allow actions. If the repo restricts which actions may run, allow `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact`, `sigstore/cosign-installer` and the reusable workflow `slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml`. The generator runs further actions internally (its own composite actions, and `actions/*` such as upload-artifact), so allow `slsa-framework/*` or choose "Allow all actions" for this repo.
2. **Settings → Actions → General → Workflow permissions:** "Read repository contents and packages permissions" is enough. The workflows ask for more per job (`id-token: write`; `contents: write` for the provenance job), and a job-level `permissions:` block takes effect even under the read-only default. If an organisation policy forbids `id-token: write` or `contents: write` for workflows, signing can't run.
3. **Private-repo minutes:** Actions minutes count against the account's private-repo quota. One `ci.yml` run includes Stryker and a 200 MB OSV download; expect tens of minutes.
4. **Tags (optional):** to stop arbitrary `v*` tags triggering signing, add a tag ruleset (Settings → Rules → Rulesets) that restricts who can create `v*` tags.
