#!/usr/bin/env bash
# PreToolUse guard for the Arc rail integration repo.
# Denies: anything aimed at Arc MAINNET, unscoped broadcasts, access to secrets,
# and writing private keys / secret files. Requires jq on PATH.
# This is a seatbelt, not the security boundary: the OS sandbox, permission deny
# rules, the signer service and the mainnet gate in code are the real controls.
set -u
input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // ""')"

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

case "$tool" in
  Bash|PowerShell)
    cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""')"
    lc="$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')"

    # 1. Mainnet endpoints, chain id 5042 (0x13b2), or a mainnet network flag.
    if printf '%s' "$lc" | grep -Eq 'rpc\.mainnet\.arc\.|arc-mainnet|mainnet\.arc\.(io|network)'; then
      deny "Arc mainnet endpoint referenced. Mainnet is gated (see docs/GATES.md); use Arc testnet (5042002) or local anvil."
    fi
    if printf '%s' "$lc" | grep -Eq '(^|[^0-9])5042([^0-9]|$)|0x13b2([^0-9a-f]|$)'; then
      deny "Arc mainnet chain id 5042 referenced in a shell command. To read docs/constants.md use the Read or Grep tool instead."
    fi
    if printf '%s' "$lc" | grep -Eq "(--network|--chain|network=|chain=)[ =]?[\"']?(arc[-_]?)?mainnet"; then
      deny "Mainnet network flag in a shell command. Mainnet is gated (see docs/GATES.md)."
    fi

    # 2. Broadcasting is only allowed against testnet or a local node.
    if printf '%s' "$lc" | grep -Eq 'cast (send|publish|mktx)|forge script[^|;&]*--broadcast|eth_sendrawtransaction|--broadcast'; then
      if ! printf '%s' "$lc" | grep -Eq 'rpc\.testnet\.arc\.|127\.0\.0\.1|localhost|anvil'; then
        deny "Broadcast without an explicit Arc testnet or local RPC URL. Pass --rpc-url for testnet (5042002) or anvil."
      fi
    fi

    # 3. Secrets: .env files (not .env.example/.sample/.template), key material, secrets dirs.
    cleaned="$(printf '%s' "$lc" | sed -E 's/\.env\.(example|sample|template)//g')"
    if printf '%s' "$cleaned" | grep -Eq '(^|[^a-z0-9_])\.env([^a-z0-9_]|$)|\.env\.[a-z]|(^|[ /])secrets/|\.pem([^a-z]|$)|\.p12([^a-z]|$)|\.key([^a-z]|$)|id_(rsa|ed25519)|keystore|mnemonic'; then
      deny "Command touches secret material (.env, keys, secrets/, keystore, mnemonic). Secrets are only accessed by the signer/OpenBao services, never by the agent."
    fi
    ;;

  Write|Edit|MultiEdit|NotebookEdit)
    path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')"
    body="$(printf '%s' "$input" | jq -r '[.tool_input.content, .tool_input.new_string, ((.tool_input.edits // []) | map(.new_string) | .[])] | map(select(. != null)) | join("\n")')"
    lp="$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')"
    if printf '%s' "$lp" | grep -Eq '(^|/)\.env($|\.)' && ! printf '%s' "$lp" | grep -Eq '\.env\.(example|sample|template)$'; then
      deny "Writing a real .env file is blocked. Put placeholders in .env.example; real values live in OpenBao."
    fi
    if printf '%s' "$lp" | grep -Eq '(^|/)secrets/|\.pem$|\.p12$|\.key$|keystore'; then
      deny "Writing key or secret files is blocked."
    fi
    if printf '%s' "$body" | grep -Eiq "(private[_ -]?key|priv[_-]?key|secret[_-]?key|signer[_-]?key|mnemonic|seed[_ -]?phrase)[\"' ]*[:=][ \"']*(0x)?[0-9a-f]{64}"; then
      deny "Content looks like a hard-coded private key. Use the signer interface; tests use the mock signer with a generated throwaway key."
    fi
    ;;
esac
exit 0
