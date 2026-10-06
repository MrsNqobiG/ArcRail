# Arc rail kit for Claude Code

What's here:
- `KICKOFF_PROMPT.md`: fill in §1, then paste everything below its line into Claude Code
- `CLAUDE.md`: standing rules Claude Code loads every session
- `.claude/settings.json`: permission deny rules, strict OS sandbox, network allowlist, guard hooks
- `.claude/hooks/guard.sh` + `test-guard.sh`: blocks mainnet, unscoped broadcasts and secret access (22 self-tests)
- `.claude/agents/verifier.md`, `cold-reader.md`: fresh-context reviewers for the verification loop

Setup:
1. Create a new empty repo `arc-rail` and copy all of this in, including the hidden `.claude/` folder.
2. Install `jq` (the hook needs it), then run `chmod +x .claude/hooks/*.sh` and `bash .claude/hooks/test-guard.sh`. Expect "22 passed, 0 failed".
3. Give Claude Code read-only access to the existing banking system's code or API specs (e.g. `--add-dir` with a read-only checkout).
4. Run Claude Code from the repo root on Linux, macOS or WSL2. The sandbox refuses to start elsewhere, by design.
5. Fill in §1 of `KICKOFF_PROMPT.md` and paste it in. Reply "continue" at each gate.

If a package registry or tool host is blocked by the sandbox, add that domain to `sandbox.network.allowedDomains` deliberately. Don't turn the sandbox off.

## Phase 2 skeleton

**Testnet only** (Arc testnet, chain ID 5042002). The mainnet entry in `src/chain/config` is `enabled: false`, and `assertMainnetAllowed()` refuses unless every G-M row in `docs/GATES.md` is SIGNED-OFF (RUBRIC MC-20). Modules hold interfaces, types and `not implemented: <unit>` stubs. Only the branded amount types (`src/amounts`) and the testnet chain config with the mainnet gate check (`src/chain/config`) contain real code.

Use the checksum-verified Node from `.tools/node` (v22.23.3):

```bash
export PATH="$PWD/.tools/node/bin:$PATH"
npm ci --ignore-scripts     # exactly what package-lock.json pins (integrity hashes); .npmrc also sets ignore-scripts
npx tsc --noEmit            # typecheck src and tests, including the MC-02 compile-fail file
npm run build               # emit dist/ (tsconfig.build.json)
npx vitest run              # unit, property and contract projects; e2e is skipped unless ARC_E2E=1
npx vitest run --coverage   # MC-07: 100% per money-path file (docs/MONEY_PATH.md)
node tools/lint-money-floats.mjs   # MC-01 float lint on the money path
npx stryker run             # mutation on the money-path modules; fails below 90
bash scripts/install-tools-phase2.sh   # osv-scanner, uv, Semgrep, semgrep-rules (pinned, checksum-verified)
bash scripts/fetch-osv-db.sh           # OSV npm database for offline SCA (separate, explicit network step)
bash scripts/ci.sh          # everything: install, build, tests, coverage, MC-01 lint, Semgrep SAST, offline SCA, Stryker, gitleaks, SBOM
```

Layout: `src/amounts` (U1), `src/chain/config` (U2), `src/chain/client` (U3), `src/ingestion` (U4), `src/registry` (U5), `src/inbound` (U6), `src/policy` (U7), `src/compliance` (U8), `src/signer` (U9), `src/outbound` (U10), `src/gas` (U11), `src/recon` (U12), `src/audit` (U13), `src/cbs` (the CBS port: CONTRACT §3 operations, §4 events, §1.4 result model, §1.3 key types, posting translator).

Tests: `test/unit`, `test/property` (fast-check) and `test/types/amount-mixing.typecheck.ts`. That last file holds one `@ts-expect-error` per forbidden amount-type mix. `test/unit/amount-mixing.test.ts` strips the directives and recompiles, to prove that each line fails with its tagged TS error code and with nothing else.

Also: `test/contract` holds the scripted diff of the CBS port against docs/CONTRACT.md §3/§4, plus self-tests proving that the diff catches drift. `test/e2e` holds a read-only Arc testnet `eth_chainId` check, which runs only with `ARC_E2E=1`.

`scripts/ci.sh` prints `SKIPPED` only for cosign and SLSA. They are a G2 prerequisite because keyless signing needs a CI workload identity, and none exists locally. If either tool is installed but not wired in, the script fails. The script also fails if docs/GATES.md shows G2 as anything but NOT SIGNED while these stages are skipped (`tools/g2-precondition.mjs`). Tool versions and hashes are in `docs/verification/tooling-phase2.md`.

Dependencies are pinned exactly (no `^` or `~`). Every package was published at least 7 days before 2026-10-05, except where a constraint below says otherwise:
- `viem` 2.56.9 (runtime);
- `typescript` 6.0.3: 7.x has no JavaScript compiler API, which Stryker needs;
- `vitest` 4.1.11: `@stryker-mutator/vitest-runner` 10.0.0 never activates mutants under vitest 5, so every mutant shows as "survived";
- `fast-check` 4.10.2, `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` 10.0.0, `@cyclonedx/cyclonedx-npm` 6.0.1, `@types/node` 22.20.4;
- `@vitest/coverage-v8` 4.1.11: it must match vitest exactly.

`package.json` also has `"overrides": {"vitest": "4.1.11"}`. Without it, npm 10.9.9 crashes (`Cannot read properties of null (reading 'edgesOut')`) while it resolves vite 8's optional devtools peer `vitest@*`. No other dependency was added.
