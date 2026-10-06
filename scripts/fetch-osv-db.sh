#!/usr/bin/env bash
# Fetch the public OSV vulnerability database for npm (OSV's official
# distribution, https://google.github.io/osv.dev/data/) into .tools/osv-db for
# osv-scanner's offline mode. Explicit, separate step: scripts/ci.sh never
# makes this call, and osv-scanner is never run in online mode, so the
# package list is never sent to api.osv.dev.
#
# The database is a live feed, so it has no published checksum. This script
# records the sha256, size, HTTP Last-Modified and fetch time of what it got in
# .tools/osv-db/FETCHED, and ci.sh refuses a database older than 7 days.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="https://osv-vulnerabilities.storage.googleapis.com/npm/all.zip"
DB="$ROOT/.tools/osv-db"
# osv-scanner 2.6 reads <dir>/osv-scalibr/<ecosystem>/all.zip (dir = OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY).
DEST="$DB/osv-scalibr/npm"
mkdir -p "$DEST"
tmp="$(mktemp "$DEST/all.zip.XXXXXX")"
trap 'rm -f "$tmp" "$tmp.hdr"' EXIT
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 -D "$tmp.hdr" -o "$tmp" "$URL"
# Sanity: a zip with OSV JSON records in it.
python3 - "$tmp" <<'PY'
import json, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
names = [n for n in z.namelist() if n.endswith('.json')]
if len(names) < 1000:
    sys.exit(f"FAIL: only {len(names)} records in the OSV npm database")
rec = json.loads(z.read(names[0]))
if 'id' not in rec or 'affected' not in rec and 'withdrawn' not in rec:
    sys.exit("FAIL: first record is not an OSV record")
print(f"records: {len(names)}")
PY
mv "$tmp" "$DEST/all.zip"
sha="$(sha256sum "$DEST/all.zip" | cut -d' ' -f1)"
lastmod="$(grep -i '^last-modified:' "$tmp.hdr" | tail -1 | cut -d' ' -f2- | tr -d '\r' || true)"
{
  echo "url=$URL"
  echo "fetched_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "fetched_epoch=$(date -u +%s)"
  echo "last_modified=$lastmod"
  echo "bytes=$(stat -c %s "$DEST/all.zip")"
  echo "sha256=$sha"
} > "$DB/FETCHED"
cat "$DB/FETCHED"
