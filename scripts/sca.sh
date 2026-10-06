#!/usr/bin/env bash
# SCA (RUBRIC MC-33): osv-scanner on package-lock.json, OFFLINE only, against
# the OSV npm database fetched by scripts/fetch-osv-db.sh. Fails if the
# database is missing, changed since fetch, or 7+ days old; if any finding is
# HIGH, CRITICAL or of unknown severity (tools/osv-gate.mjs); and if the gate
# does not catch a known-CRITICAL and a HIGH-only fixture lockfile (self-tests).
# Called by scripts/ci.sh; runnable alone: bash scripts/sca.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.tools/node/bin:$PATH"
OSV="$ROOT/.tools/bin/osv-scanner"
OSV_DB="$ROOT/.tools/osv-db"
OSV_DB_MAX_AGE_DAYS=7
SCA_DIR=""
trap 'rm -rf "$SCA_DIR"' EXIT
step() { printf '\n==> %s\n' "$1"; }

step "SCA: osv-scanner $("$OSV" --version | head -1 | awk '{print $3}') offline on package-lock.json (fails on HIGH/CRITICAL/unknown)"
[ -f "$OSV_DB/osv-scalibr/npm/all.zip" ] && [ -f "$OSV_DB/FETCHED" ] \
  || { echo "FAIL: OSV database missing; run scripts/fetch-osv-db.sh"; exit 1; }
want_sha="$(grep '^sha256=' "$OSV_DB/FETCHED" | cut -d= -f2)"
got_sha="$(sha256sum "$OSV_DB/osv-scalibr/npm/all.zip" | cut -d' ' -f1)"
[ "$want_sha" = "$got_sha" ] || { echo "FAIL: OSV database changed since it was fetched"; exit 1; }
fetched="$(grep '^fetched_epoch=' "$OSV_DB/FETCHED" | cut -d= -f2)"
age_days=$(( ($(date -u +%s) - fetched) / 86400 ))
[ "$age_days" -lt "$OSV_DB_MAX_AGE_DAYS" ] \
  || { echo "FAIL: OSV database is $age_days days old (max $((OSV_DB_MAX_AGE_DAYS - 1))); run scripts/fetch-osv-db.sh"; exit 1; }
echo "OSV npm database: $(grep '^fetched_utc=' "$OSV_DB/FETCHED" | cut -d= -f2), age ${age_days}d, sha256 ${got_sha:0:16}…"
# One offline scan covers the repo lockfile and the two self-test fixtures, so the
# 200 MB database is loaded once:
#   CRITICAL:  minimist 1.2.5, GHSA-xvch-5gv4-984h (CVSS 9.8)
#   HIGH only: json5 2.2.1, GHSA-9c47-m6qq-7p4h (HIGH, CVSS 7.1, just above the 7.0 line)
SCA_DIR="$(mktemp -d)"
fixture_lock() { # $1 package, $2 version
  printf '{"name":"fixture","version":"0.0.0","lockfileVersion":3,"requires":true,"packages":{"":{"name":"fixture","version":"0.0.0","dependencies":{"%s":"%s"}},"node_modules/%s":{"version":"%s","resolved":"https://registry.npmjs.org/%s/-/%s-%s.tgz"}}}\n' \
    "$1" "$2" "$1" "$2" "$1" "$1" "$2"
}
mkdir -p "$SCA_DIR/critical" "$SCA_DIR/high" reports
fixture_lock minimist 1.2.5 > "$SCA_DIR/critical/package-lock.json"
fixture_lock json5 2.2.1 > "$SCA_DIR/high/package-lock.json"
rc=0
OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY="$OSV_DB" "$OSV" scan source --offline --offline-vulnerabilities --all-packages \
  --format json -L "$ROOT/package-lock.json" -L "$SCA_DIR/critical/package-lock.json" -L "$SCA_DIR/high/package-lock.json" \
  > "$SCA_DIR/all.json" 2>/dev/null || rc=$?
[ "$rc" -le 1 ] || { echo "FAIL: osv-scanner error (exit $rc)"; exit 1; }
# Split per lockfile. Every source must be one of the three, and each must be
# present with at least one package (so a dropped source can't pass as clean).
node -e '
  const fs = require("node:fs");
  const [all, out, ...srcs] = process.argv.slice(1);
  const r = JSON.parse(fs.readFileSync(all, "utf8"));
  const names = ["repo", "critical", "high"];
  for (const res of r.results ?? []) {
    if (!srcs.includes(res.source?.path)) { console.error(`FAIL: unexpected scan source ${res.source?.path}`); process.exit(1); }
  }
  srcs.forEach((src, i) => {
    const results = (r.results ?? []).filter((x) => x.source?.path === src);
    const pkgs = results.flatMap((x) => x.packages ?? []).length;
    if (pkgs === 0) { console.error(`FAIL: no packages scanned for ${src}`); process.exit(1); }
    fs.writeFileSync(`${out}/${names[i]}.json`, JSON.stringify({ results }));
    console.log(`scanned ${names[i]}: ${pkgs} package(s)`);
  });' "$SCA_DIR/all.json" "$SCA_DIR" "$ROOT/package-lock.json" "$SCA_DIR/critical/package-lock.json" "$SCA_DIR/high/package-lock.json"
cp "$SCA_DIR/repo.json" reports/osv.json
node tools/osv-gate.mjs < reports/osv.json

step "SCA self-test: the CRITICAL and the HIGH-only fixture must each fail the gate"
for sev in CRITICAL HIGH; do
  f="$SCA_DIR/$(printf '%s' "$sev" | tr 'A-Z' 'a-z').json"
  # The fixture must be what it claims: a $sev finding, and for HIGH no CRITICAL
  # label and no CVSS >= 9, so it tests HIGH alone.
  node -e '
    const fs = require("node:fs");
    const [file, sev] = process.argv.slice(1);
    const r = JSON.parse(fs.readFileSync(file, "utf8"));
    const vulns = r.results.flatMap((x) => x.packages ?? []).flatMap((p) => (p.vulnerabilities ?? []).map((v) => ({ v, g: (p.groups ?? []).find((g) => (g.ids ?? []).includes(v.id)) })));
    const labels = vulns.map(({ v }) => String(v.database_specific?.severity ?? "").toUpperCase());
    if (!labels.includes(sev)) { console.error(`FAIL: ${sev} fixture has no ${sev} finding (database empty?): ${labels}`); process.exit(1); }
    if (sev === "HIGH" && (labels.includes("CRITICAL") || vulns.some(({ g }) => /^(9|10)/.test(String(g?.max_severity ?? ""))))) {
      console.error("FAIL: HIGH fixture also carries a CRITICAL finding"); process.exit(1);
    }' "$f" "$sev"
  if node tools/osv-gate.mjs < "$f" >/dev/null; then
    echo "FAIL: the SCA gate passed the $sev fixture"; exit 1
  fi
  echo "caught: $sev fixture ($( [ "$sev" = CRITICAL ] && echo 'minimist@1.2.5 GHSA-xvch-5gv4-984h' || echo 'json5@2.2.1 GHSA-9c47-m6qq-7p4h, CVSS 7.1'))"
done
rm -rf "$SCA_DIR"
