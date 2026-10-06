#!/usr/bin/env bash
# CI for the Arc Rail Adapter (Phase 2 skeleton). Fails on any real failure.
#
# Stages, in order:
#   1 install         npm ci --ignore-scripts (lockfile integrity; no install scripts run)
#   2 build           typecheck (src + tests) and emit dist/
#   3 test            vitest: unit, property, contract (port vs CONTRACT); e2e skipped unless ARC_E2E=1
#   4 coverage        MC-07: 100% lines/branches/functions/statements per money-path file
#   5 lint            MC-01 type-aware float lint on the money path
#   6 SAST            Semgrep: vendored JS/TS security rules + the MC-01 Semgrep layer,
#                     and a self-test that a planted float fails the MC-01 Semgrep layer
#   7 SCA             osv-scanner, offline DB only; fails on HIGH/CRITICAL/unknown severity,
#                     and a self-test that a known-CRITICAL lockfile fails
#   8 mutation        Stryker on the money-path modules (break threshold 90)
#   9 secrets         gitleaks (--no-git: the repo has no commits yet)
#  10 SBOM            CycloneDX 1.6 from package-lock.json, runtime dependencies only (`npm run sbom`),
#                     every component with its lockfile SHA-512 (distribution hash)
#  11 signing, provenance   SKIPPED here: they run keyless (GitHub OIDC) in
#                     .github/workflows/release-sign.yml, never locally or in ci.yml (docs/CI.md).
#                     G2 precondition (tools/g2-precondition.mjs): a signed G2 row in docs/GATES.md
#                     must cite a release-sign run (https://github.com/MrsNqobiG/ArcRail/actions/runs/<id>),
#                     or CI fails
#
# Network: only stage 1 (registry.npmjs.org, or the npm cache), plus the tool
# installer if a pinned tool is missing (it only re-verifies hashes otherwise). The OSV database
# is fetched separately by scripts/fetch-osv-db.sh; osv-scanner here runs
# --offline, so the package list is never sent anywhere. Tools come from
# scripts/install-tools-phase2.sh (pinned, checksum-verified).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.tools/node/bin:$PATH"
export SEMGREP_ENABLE_VERSION_CHECK=0 SEMGREP_SEND_METRICS=off
# The Semgrep venv is verified file by file (tools/verify-venv.py); never let Python add unverified bytecode.
export PYTHONDONTWRITEBYTECODE=1

SEMGREP="$ROOT/.tools/semgrep-venv/bin/semgrep"
SEMGREP_RULES="$ROOT/.tools/semgrep-rules/a84ff9cc2453ca91d581380de4b8b3f272f6f4be"

step() { printf '\n==> %s\n' "$1"; }

PLANT_DIR=""
trap 'rm -rf "$PLANT_DIR"' EXIT

delegated_g2() {
  # $1 = step name, $2 = binary name
  step "$1"
  if command -v "$2" >/dev/null 2>&1; then
    echo "FAIL: $2 is installed here, but this stage runs only in .github/workflows/release-sign.yml;"
    echo "remove it from this environment's PATH so a local or ci.yml run can't pass for a signing run."
    return 1
  fi
  echo "SKIPPED: runs in .github/workflows/release-sign.yml (hosted CI, keyless)"
  echo "  Keyless signing and SLSA provenance need a CI workload identity (GitHub OIDC); none exists"
  echo "  here, and no long-lived signing key is ever created. G2 evidence = a cited release-sign run."
}

step "toolchain and tool integrity"
node --version
npm --version
bash scripts/install-tools-phase2.sh

step "install: npm ci --ignore-scripts (lockfile integrity, no install scripts)"
npm ci --ignore-scripts --no-audit --no-fund

step "build: typecheck (tsc --noEmit, src + tests, includes MC-02 compile-fail file)"
npx tsc --noEmit -p tsconfig.json

step "build: emit (tsc -p tsconfig.build.json -> dist/)"
rm -rf dist
npx tsc -p tsconfig.build.json

step "test: unit + property + contract (+ e2e, skipped unless ARC_E2E=1)"
npx vitest run

step "coverage: MC-07, 100% per money-path file (docs/MONEY_PATH.md, docs/COVERAGE_EXCLUSIONS.md)"
rm -rf coverage
npx vitest run --coverage

step "lint: MC-01 type-aware float lint on the money path"
node tools/lint-money-floats.mjs

mapfile -t MONEY_PATHS < <(node -e 'import("./tools/money-path.mjs").then((m) => console.log(m.readMoneyPath().paths.join("\n")))')
[ "${#MONEY_PATHS[@]}" -gt 0 ] || { echo "FAIL: no money-path files"; exit 1; }

step "SAST: Semgrep $("$SEMGREP" --version --disable-version-check) (vendored JS/TS rules; any finding fails)"
"$SEMGREP" scan --metrics=off --disable-version-check --no-git-ignore --error --quiet \
  --config "$SEMGREP_RULES/javascript" --config "$SEMGREP_RULES/typescript" \
  src test tools scripts vitest.config.ts

step "SAST: Semgrep MC-01 layer on the ${#MONEY_PATHS[@]} money-path files"
"$SEMGREP" scan --metrics=off --disable-version-check --no-git-ignore --error --quiet \
  --config tools/semgrep/mc01-money-float.yml "${MONEY_PATHS[@]}"

step "SAST self-test: each planted float in a temp copy must fail the MC-01 Semgrep layer"
PLANT_DIR="$(mktemp -d)"
# One temp copy of src/amounts/index.ts per plant: "<rule>|<code>". Each copy must
# produce its own rule. One Semgrep run scans them all.
PLANTS=(
  "mc01-number-parse|export const p = Number('1');"
  "mc01-math|export const p = (x: number) => cbsMinor(BigInt(Math.floor(x * 100)));"
  "mc01-to-fixed|export const p = (x: number) => x.toFixed(2);"
  "mc01-float-literal|export const p = 0.1;"
  "mc01-unary-plus|declare const hex: string; export const p = nativeWei(BigInt(+hex));"
  "mc01-literal-operand|export const p = BigInt((\"1.15\" as unknown as number * 100) | 0);"
  "mc01-literal-operand|declare const x: number; export const p = x * 100 - (x * 100) % 1;"
  "mc01-bitwise-not|declare const x: number; export const p = ~~(x * 100);"
  "mc01-global-object|declare const x: number; export const p = globalThis.Math.floor(x);"
  "mc01-math|declare const x: number; export const p = globalThis.Math.floor(x);"
  "mc01-number-parse|declare const s: string; export const p = globalThis['Number'](s);"
  "mc01-json-parse|declare const s: string; export const p = JSON.parse(s) * 100;"
  "mc01-literal-plus|declare const x: number; export const p = x + 1;"
  "mc01-json-call|declare const r: Response; export const p = async () => BigInt(((await r.json()) as { v: string }).v);"
  "mc01-constructor|declare const hex: string; export const p = ((0).constructor as (s: string) => string)(hex);"
  "mc01-number-assertion|declare const a: unknown; export const p = nativeWei(BigInt(String(a as number)));"
  "mc01-number-assertion|declare const a: unknown; export const p = nativeWei(BigInt(String(<number>a)));"
)
i=0
for plant in "${PLANTS[@]}"; do
  i=$((i + 1))
  cp src/amounts/index.ts "$PLANT_DIR/plant$i.ts"
  printf '\n%s\n' "${plant#*|}" >> "$PLANT_DIR/plant$i.ts"
done
"$SEMGREP" scan --metrics=off --disable-version-check --no-git-ignore --json --quiet \
  --config tools/semgrep/mc01-money-float.yml "$PLANT_DIR" > "$PLANT_DIR/results.json" || true
i=0
for plant in "${PLANTS[@]}"; do
  i=$((i + 1))
  rule="${plant%%|*}"
  if ! node -e '
    const r = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    if (r.errors.length > 0) { console.error(JSON.stringify(r.errors)); process.exit(2); }
    process.exit(r.results.some((x) => x.path.endsWith(`/plant${process.argv[2]}.ts`) && x.check_id.endsWith(process.argv[3])) ? 0 : 1);' \
    "$PLANT_DIR/results.json" "$i" "$rule"; then
    echo "FAIL: plant $i ($rule) was not caught: ${plant#*|}"; exit 1
  fi
  echo "caught: $rule  <- ${plant#*|}"
done
rm -rf "$PLANT_DIR"

bash scripts/sca.sh

step "mutation: Stryker on money-path modules (break threshold 90)"
npx stryker run

step "secrets: gitleaks"
.tools/bin/gitleaks detect --no-git --source . --redact --gitleaks-ignore-path .gitleaksignore

step "SBOM: CycloneDX, runtime dependencies (npm run sbom)"
npm run --silent sbom
node -e '
const s = JSON.parse(require("node:fs").readFileSync("sbom.cdx.json", "utf8"));
if (s.bomFormat !== "CycloneDX" || !Array.isArray(s.components) || s.components.length === 0) {
  console.error("FAIL: SBOM is empty or not CycloneDX"); process.exit(1);
}
const all = [];
(function walk(cs) { for (const c of cs ?? []) { all.push(c); walk(c.components); } })(s.components);
// cyclonedx-npm has no option for component.hashes; it records the lockfile
// integrity (SHA-512 of the registry tarball) on the "distribution" reference.
const missing = all.filter((c) => !(c.externalReferences ?? []).some((e) => e.type === "distribution" && (e.hashes ?? []).length > 0));
if (missing.length > 0) {
  console.error(`FAIL: ${missing.length} SBOM component(s) without a distribution hash: ${missing.map((c) => c.name).join(", ")}`);
  process.exit(1);
}
console.log(`SBOM ok: CycloneDX ${s.specVersion}, ${all.length} runtime components, ${all.length} with a SHA-512 distribution hash`);
'

delegated_g2 "signing: cosign (G2)" cosign
delegated_g2 "provenance: SLSA (G2)" slsa-verifier

step "G2 precondition: a signed G2 row must cite the release-sign run that signed and verified (MC-33)"
node tools/g2-precondition.mjs docs/GATES.md --delegated=cosign,slsa

printf '\nCI PASSED\n'
