#!/usr/bin/env bash
# Re-runnable self-test for guard.sh. Exit code 0 = all cases behave as expected.
cd "$(dirname "$0")"
pass=0; fail=0
t() { # expect(deny|allow) tool json_input_fragment description
  out="$(printf '%s' "$3" | bash ./guard.sh)"
  if printf '%s' "$out" | grep -q '"deny"'; then got=deny; else got=allow; fi
  if [ "$got" = "$1" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL ($1 expected, got $got): $4"; fi
}
B() { jq -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
W() { jq -nc --arg p "$1" --arg c "$2" '{tool_name:"Write",tool_input:{file_path:$p,content:$c}}'; }
t deny  Bash "$(B 'cast send 0xabc --rpc-url https://rpc.mainnet.arc.io')" "mainnet rpc"
t deny  Bash "$(B 'cast chain-id --rpc-url $RPC --chain 5042')" "chain id 5042"
t deny  Bash "$(B 'cast send 0xabc "transfer()" --chain-id 0x13B2')" "hex chain id"
t deny  Bash "$(B 'pnpm run deploy --network mainnet')" "mainnet flag"
t deny  Bash "$(B 'forge script Deploy.s.sol --broadcast')" "broadcast without rpc"
t deny  Bash "$(B 'cat .env')" "read .env"
t deny  Bash "$(B 'source .env.local && pnpm test')" "read .env.local"
t deny  Bash "$(B 'ls secrets/')" "secrets dir"
t deny  Bash "$(B 'openssl ec -in signer.pem')" "pem"
t allow Bash "$(B 'cast chain-id --rpc-url https://rpc.testnet.arc.io')" "testnet read"
t allow Bash "$(B 'forge script Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast')" "local broadcast"
t allow Bash "$(B 'cast send 0xabc --rpc-url https://rpc.testnet.arc.io')" "testnet send"
t allow Bash "$(B 'echo chain 5042002 is testnet')" "testnet chain id not confused with 5042"
t allow Bash "$(B 'cp .env.example .env.example.bak')" ".env.example allowed"
t allow Bash "$(B 'pnpm test --filter ledger')" "ordinary command"
t deny  Write "$(W 'src/config.ts' 'const PRIVATE_KEY = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"')" "hard-coded key"
t deny  Write "$(W '.env' 'X=1')" "write .env"
t allow Write "$(W '.env.example' 'ARC_RPC_URL=')" "write .env.example"
t allow Write "$(W 'test/fixtures/tx.json' '{"hash":"0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"}')" "tx hash fixture allowed"
t allow Write "$(W 'docs/constants.md' '| Mainnet chain id | 5042 |')" "documenting constants allowed"
t deny  Edit '{"tool_name":"Edit","tool_input":{"file_path":"a.ts","old_string":"x","new_string":"mnemonic: \"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\""}}' "key via Edit"
t deny  MultiEdit '{"tool_name":"MultiEdit","tool_input":{"file_path":"a.ts","edits":[{"old_string":"x","new_string":"signer_key=0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}]}}' "key via MultiEdit"
t deny  Bash "$(B 'curl -s https://api.dfns.io/wallets')" "agent calling Dfns API"
t deny  Bash "$(B 'curl https://api.uae.dfns.io/auth/action/init')" "agent calling Dfns UAE API"
t deny  Bash "$(B 'curl https://api.circle.com/v1/exchange/stablefx/quotes')" "agent calling Circle prod API"
t allow Bash "$(B 'curl -s https://docs.dfns.co/networks.md')" "reading Dfns docs"
t deny  Write "$(W 'src/dfns.ts' 'const DFNS_AUTH_TOKEN = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.abc"')" "hard-coded Dfns token"
t deny  Write "$(W 'src/hooks.ts' 'webhook_secret: "whsec_9f8e7d6c5b4a3f2e1d0c9b8a"')" "hard-coded webhook secret"
t allow Write "$(W 'src/dfns.ts' 'const token = await secrets.get("dfns/service-account/token")')" "secret read at runtime"
t allow Write "$(W 'docs/DFNS_SETUP.md' 'Dfns network names: Arc (mainnet, gated), ArcTestnet')" "documenting Dfns networks"
t deny  Bash "$(B 'curl https://api.valr.com/v1/orders/market')" "agent calling VALR API"
t deny  Write "$(W 'src/valr.ts' 'const VALR_API_SECRET = "4f1c9a7e2b6d8f0a3c5e7b9d1f2a4c6e"')" "hard-coded VALR secret"
echo "guard self-test: $pass passed, $fail failed"; [ "$fail" -eq 0 ]
