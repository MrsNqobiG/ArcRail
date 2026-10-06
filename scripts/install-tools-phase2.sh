#!/usr/bin/env bash
# Install the Phase 2 CI tools into .tools/ (git-ignored), each pinned and
# verified against its published SHA-256 before use, and re-verify EVERY
# recorded tool hash on every run (scripts/ci.sh calls this first):
#   node 22.23.3 (whole install tree), gitleaks 8.30.1, osv-scanner, uv,
#   the Semgrep venv (tools/verify-venv.py: lock = installed set, every file
#   against the lock-hashed wheels or a pin or the install-time manifest, no
#   unlisted file, pyvenv.cfg, semgrep-core) and the semgrep-rules tree.
# A tool that is missing is installed (node and gitleaks come from Phase 0:
# missing → FAIL). A tool that is present but differs → FAIL; it is never
# silently reinstalled, so tampering can't be papered over.
# Provenance and versions: docs/verification/tooling-phase2.md.
#
# Network: github.com release assets and codeload (pinned commit), and PyPI
# for Semgrep's hash-locked wheels. Nothing else. No keys, no signing.
#
#   osv-scanner 2.6.0    SCA (offline DB from scripts/fetch-osv-db.sh)
#   uv 0.12.19           Python package installer, used only to build the Semgrep venv
#   semgrep 1.178.0      SAST; every wheel hash-locked in tools/semgrep/requirements.txt
#   semgrep-rules @ a84ff9cc (develop, 2026-09-22): javascript/ and typescript/ rule packs
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
T="$ROOT/.tools"
# Scratch for downloads and the uv cache: deleted on exit, so third-party test
# fixtures inside them (fake secrets in rule tests) never sit in the tree that
# gitleaks scans.
DL="$(mktemp -d "$T/dl.XXXXXX")"
trap 'rm -rf "$DL"' EXIT
mkdir -p "$T/bin"

OSV_VER="v2.6.0"
OSV_SHA="ca69b3d3cd08f889a49dc0a383122f71cc528b83803671df5fd874d97485b108"   # osv-scanner_linux_amd64, from osv-scanner_SHA256SUMS
UV_VER="0.12.19"
UV_TGZ_SHA="23bf5552d220e0842b65c862097b2ebaeba0064b74eda5e565e77fd25969d8c8" # uv-x86_64-unknown-linux-gnu.tar.gz, from its .sha256
UV_BIN_SHA="242e462a63f5a3c0421d68557006193ecbfb61321cba0fe8542213ac62d92563" # extracted uv binary
RULES_COMMIT="a84ff9cc2453ca91d581380de4b8b3f272f6f4be"
RULES_TGZ_SHA="b227c2d234ffd9c84c4dbd6619a5897a7192637c141baeace3bfc37b0715a887" # codeload tarball of RULES_COMMIT
RULES_TREE_SHA="906f567684f42fa6c0a5723344897179b0cf2b002c50c895a49124cc076ca3c3" # sorted sha256sum of the extracted rule files
SEMGREP_VER="1.178.0"
# Phase 0 tools (docs/verification/tooling.md), re-derived on 2026-10-05 from the
# official archives (nodejs.org SHASUMS256 df450af8…02de; gitleaks checksums 551f6fc8…70eb):
NODE_TREE_SHA="1842bae06071b49add6c3151d09eb7db9406ac57e98d36502fd73e3d99e1b27e" # node-v22.23.3-linux-x64/ tree (tree_sha below)
GITLEAKS_SHA="88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509"   # gitleaks binary in gitleaks_8.30.1_linux_x64.tar.gz

verify() { # $1 file, $2 expected sha256
  local got
  got="$(sha256sum "$1" | cut -d' ' -f1)"
  [ "$got" = "$2" ] || { echo "FAIL: sha256 mismatch for $1: got $got, want $2"; exit 1; }
}
fetch() { # $1 url, $2 dest
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 -o "$2" "$1"
}
rules_tree_sha() {
  (cd "$1" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)
}
tree_sha() { # files by content, symlinks by target
  (cd "$1" && { find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum; find . -type l -printf 'L %p -> %l\n' | LC_ALL=C sort; } | sha256sum | cut -d' ' -f1)
}

# Phase 0 tools: verify only.
[ -d "$T/node-v22.23.3-linux-x64" ] || { echo "FAIL: .tools/node-v22.23.3-linux-x64 missing (Phase 0 install, tooling.md)"; exit 1; }
[ "$(readlink "$T/node")" = "node-v22.23.3-linux-x64" ] || { echo "FAIL: .tools/node must link to node-v22.23.3-linux-x64"; exit 1; }
[ "$(tree_sha "$T/node-v22.23.3-linux-x64")" = "$NODE_TREE_SHA" ] || { echo "FAIL: node install tree differs from the official archive"; exit 1; }
[ -x "$T/bin/gitleaks" ] || { echo "FAIL: .tools/bin/gitleaks missing (Phase 0 install, tooling.md)"; exit 1; }
verify "$T/bin/gitleaks" "$GITLEAKS_SHA"

# osv-scanner
if [ ! -x "$T/bin/osv-scanner" ]; then
  fetch "https://github.com/google/osv-scanner/releases/download/$OSV_VER/osv-scanner_linux_amd64" "$DL/osv-scanner_linux_amd64"
  verify "$DL/osv-scanner_linux_amd64" "$OSV_SHA"
  install -m 0755 "$DL/osv-scanner_linux_amd64" "$T/bin/osv-scanner"
fi
verify "$T/bin/osv-scanner" "$OSV_SHA"

# uv
if [ ! -x "$T/bin/uv" ]; then
  fetch "https://github.com/astral-sh/uv/releases/download/$UV_VER/uv-x86_64-unknown-linux-gnu.tar.gz" "$DL/uv.tar.gz"
  verify "$DL/uv.tar.gz" "$UV_TGZ_SHA"
  tar -xzf "$DL/uv.tar.gz" -C "$DL"
  install -m 0755 "$DL/uv-x86_64-unknown-linux-gnu/uv" "$T/bin/uv"
fi
verify "$T/bin/uv" "$UV_BIN_SHA"

# Semgrep: a venv from hash-locked wheels (uv pip sync --require-hashes), system python3.
export UV_CACHE_DIR="$DL/uv-cache" UV_PYTHON_DOWNLOADS=never
if [ ! -d "$T/semgrep-venv" ]; then
  "$T/bin/uv" venv --python /usr/bin/python3 "$T/semgrep-venv"
  VIRTUAL_ENV="$T/semgrep-venv" "$T/bin/uv" pip sync --require-hashes --python "$T/semgrep-venv/bin/python" "$ROOT/tools/semgrep/requirements.txt"
fi
# m19: the venv is checked against the lock-hashed wheels (kept outside the venv) and a
# manifest of every installed file recorded at install time (also outside the venv);
# its own RECORD files are never trusted. Missing wheels are fetched (PyPI, each
# verified against the lock); a missing manifest is recorded only if every
# wheel-derived, entry-point and pinned file already verifies (tools/verify-venv.py).
WHEELS="$T/semgrep-wheels"
MANIFEST="$T/semgrep-venv.manifest.json"
LOCK="$ROOT/tools/semgrep/requirements.txt"
if [ ! -d "$WHEELS" ]; then
  PYTHONDONTWRITEBYTECODE=1 python3 "$ROOT/tools/verify-venv.py" fetch "$T/semgrep-venv" "$LOCK" "$WHEELS"
fi
if [ ! -f "$MANIFEST" ]; then
  echo "semgrep venv manifest missing: recording it (install time) after full wheel/entry-point/pin verification"
  PYTHONDONTWRITEBYTECODE=1 python3 "$ROOT/tools/verify-venv.py" record "$T/semgrep-venv" "$LOCK" "$WHEELS" "$MANIFEST"
fi
PYTHONDONTWRITEBYTECODE=1 python3 "$ROOT/tools/verify-venv.py" verify "$T/semgrep-venv" "$LOCK" "$WHEELS" "$MANIFEST"
[ "$(PYTHONDONTWRITEBYTECODE=1 "$T/semgrep-venv/bin/semgrep" --version --disable-version-check)" = "$SEMGREP_VER" ] \
  || { echo "FAIL: semgrep --version is not $SEMGREP_VER"; exit 1; }

# semgrep-rules: javascript/ and typescript/ YAML rules at a pinned commit.
RULES="$T/semgrep-rules/$RULES_COMMIT"
if [ ! -d "$RULES" ]; then
  fetch "https://codeload.github.com/semgrep/semgrep-rules/tar.gz/$RULES_COMMIT" "$DL/semgrep-rules.tar.gz"
  verify "$DL/semgrep-rules.tar.gz" "$RULES_TGZ_SHA"
  tar -xzf "$DL/semgrep-rules.tar.gz" -C "$DL"
  mkdir -p "$RULES"
  (cd "$DL/semgrep-rules-$RULES_COMMIT" && find javascript typescript \( -name '*.yaml' -o -name '*.yml' \) ! -name '*.test.*' -print0 \
    | xargs -0 -I{} install -D -m 0644 {} "$RULES/{}")
  install -m 0644 "$DL/semgrep-rules-$RULES_COMMIT/LICENSE" "$RULES/LICENSE"
fi
[ "$(rules_tree_sha "$RULES")" = "$RULES_TREE_SHA" ] || { echo "FAIL: semgrep-rules tree hash mismatch"; exit 1; }

echo "tools OK (all hashes re-verified): node 22.23.3 tree, gitleaks 8.30.1, osv-scanner $OSV_VER, uv $UV_VER, semgrep $SEMGREP_VER venv, semgrep-rules $RULES_COMMIT"
