# Gates

**Only a named human may sign a gate.** The agent can create and maintain this file, but it never writes SIGNED-OFF here (CLAUDE.md rule 6; KICKOFF §9: "The agent cannot clear these"). A signature counts only if its line comes from a commit authored and cryptographically signed by that human, with no agent co-author, and the signing key is anchored outside this repository (RUBRIC MC-42). Mainnet (chain ID 5042) stays disabled in code until **every** G-M gate below is SIGNED-OFF. A CI test fails if mainnet configuration is reachable while any G-M gate is unsigned (KICKOFF §9, RUBRIC MC-20).

Status values: `NOT SIGNED` or `SIGNED-OFF` (name, role, date).

## Phase gates (checkpoint mode `pause`, KICKOFF)
| Gate | Meaning | Status | Name | Role | Date |
|---|---|---|---|---|---|
| G0 | Phase 0 discovery reviewed | Passed by the operator's "continue"; Phase 0 left **unverified** (LEDGER) | | | |
| G1 | Phase 1 spec, threat model and ADR decisions (`docs/G1_PACKET.md`). Also unlocks the CONTRACT integration points for the CBS's normal change process (CLAUDE.md rule 3) | NOT SIGNED. **Approved by the operator in chat on 2026-10-05 ("g1 is ago", read as "G1 is a go")** for the testnet choices in G1_PACKET §2a; formal sign-off awaits the operator's own signed commit (RUBRIC MC-42) | | | |
| G2 | Phase 2 skeleton. **Precondition:** the skeleton's Lens R pass has zero blocking defects, and artefact signing (cosign) and SLSA provenance have run in hosted CI (`.github/workflows/release-sign.yml`, see `docs/CI.md`). A SIGNED-OFF G2 row must cite that successful run as `https://github.com/MrsNqobiG/ArcRail/actions/runs/<id>`, from `main` or a `v*` tag; `scripts/ci.sh` fails a SIGNED-OFF row without that citation | NOT SIGNED. **Accepted in chat 2026-10-05 under the operator's standing auto-accept** (skeleton Lens R round 3: 0 blocking, 6 minor). The precondition is not yet met: cosign and SLSA are still SKIPPED pending hosted CI |  | | |
| G3 | Phase 5 testnet demonstration and verdict (`docs/EVIDENCE_PACK.md`) | NOT SIGNED | | | |

## Mainnet gates (G-M, KICKOFF §9, quoted)
| Gate | Requirement | Status | Name | Role | Date |
|---|---|---|---|---|---|
| G-M 1 | "FSCA authorisation covering the crypto-asset services offered (or a mandate under a licensed FSP), and FIC Item 22 registration plus an RMCP that includes this rail." | NOT SIGNED | | | |
| G-M 2 | "Travel-rule integration tested with at least one counterparty CASP." | NOT SIGNED | | | |
| G-M 3 | "Legal opinion on exchange control for the planned flows." | NOT SIGNED | | | |
| G-M 4 | "Independent security review of the adapter (and audits of any contracts)." | NOT SIGNED | | | |
| G-M 5 | "Key ceremony completed, signing policy approved, and a key-compromise drill run." | NOT SIGNED | | | |
| G-M 6 | "Joint Standard 2 evidence, and a POPIA PIA covering every vendor." | NOT SIGNED | | | |
| G-M 7 | "Bank-partner sign-off for the ZAR legs." | NOT SIGNED | | | |
| G-M 8 | "Staged rollout plan: internal funds with low caps, then pilot merchants, then general availability." | NOT SIGNED | | | |
