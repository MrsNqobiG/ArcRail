# Arc rail kit v2 for Claude Code

What's here:
- `PROCESS.md`: the total process; what the system does and how it gets built (read first)
- `CHANGE_ORDER.md`: paste into the **existing** Claude Code session (project already running)
- `KICKOFF_PROMPT.md`: v2 full prompt for a **fresh** repo
- `CLAUDE.md`: v2 standing rules (in a running project, merge it via the change order; don't overwrite)
- `.claude/settings.json`, `.claude/hooks/guard.sh` + `test-guard.sh`: sandbox, deny rules and guard hook (32 self-tests)
- `.claude/agents/verifier.md`, `cold-reader.md`: fresh-context reviewers

Setup:
1. Install `jq`, then run `chmod +x .claude/hooks/*.sh && bash .claude/hooks/test-guard.sh`. Expect "32 passed, 0 failed".
2. **Running project:** copy the hook, test and settings files into the repo, put `CLAUDE.md` and `KICKOFF_PROMPT.md` into `docs/kit-v2/`, then paste `CHANGE_ORDER.md`.
3. **Fresh repo:** copy everything in, fill §1 of `KICKOFF_PROMPT.md`, and paste it.
4. Run Claude Code from the repo root on Linux, macOS or WSL2; the sandbox refuses to start elsewhere, by design.
