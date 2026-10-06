# Tooling install evidence (Phase 0, step 1)

Date: 2026-10-02 (UTC 14:19 onward) · Host: WSL2 Ubuntu, x86_64

## Circle skills
Installed by the operator via `/plugin marketplace add circlefin/skills` and `/plugin install circle-skills@circle`. Result: `✓ Installed circle. Plugin is now active.` This matches the instruction on https://docs.arc.io/llms.txt (accessed 2026-10-02): "In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle."

Skills are secondary material. Facts in `docs/constants.md` are taken only from docs.arc.io, developers.circle.com or the live testnet.

## Arc Foundry
Source of instructions: https://docs.arc.io/arc/tutorials/install-arc-foundry.md (accessed 2026-10-02). The docs say to download a precompiled archive from https://github.com/circlefin/arc-foundry/releases, extract it, and rename `forge`/`cast`/`anvil` to `arc-forge`/`arc-cast`/`arc-anvil` in `~/.local/bin`.

| Item | Value |
|---|---|
| Release | `v0.8.0-2` (target of `/releases/latest` redirect) |
| Asset | `arc-foundry-v0.8.0-2-x86_64-unknown-linux-gnu.tar.gz` (82,602,629 B) |
| Published SHA-256 | `088bdb96a84418b757f9825d491e702792f1d1d1e29a9145af305a6600a79556` |
| `sha256sum -c` | `OK` |
| Contents | `forge`, `cast`, `anvil` |
| Version (all three) | `1.7.1-dev`, commit `d497beea7096ff2a8e583c8b307941f24a61b06b`, built 2026-09-18T15:31:46Z |
| Installed SHA-256 | arc-forge `8f27a76e…5d226` · arc-cast `9ef57cb0…6e650` · arc-anvil `f46abcf8…413d1` |

### Differences from the documented procedure
1. **Install location.** The sandbox only allows writes inside the repo, so the binaries are in `./.tools/bin/` (gitignored), not `~/.local/bin`. Invoke them as `./.tools/bin/arc-cast` and so on.
2. **Integrity only, not authenticity.** The `.sha256` file comes from the same GitHub release as the tarball. It proves the download was intact, not who built it. No signature or attestation was found on the release page. Phase 2 must pin by digest and look for Sigstore/SLSA provenance (see OPEN_QUESTIONS Q-T3).
3. `arc-anvil --network` takes a **rule-set family** (`ethereum, optimism, tempo, arc`), not a chain, so `--network arc` does not point at mainnet.
