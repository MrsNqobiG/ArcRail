# G1 decision packet (DRAFT, assembled while Phase 1 verification runs)

**Status: READY FOR DECISION.** Phase 1 is frozen (§1). Everything in §2 to §6 is **for a named human to decide**; the agent recommends but does not decide (KICKOFF Phase 1 item 4). Nothing here is SIGNED-OFF (CLAUDE.md rule 6). Signing G1 also unlocks the integration points in `docs/CONTRACT.md` for the CBS's normal change process (CLAUDE.md rule 3).

## 1. Unit status at G1 (from `docs/LEDGER.md`)
Phase 1 exit rule (operator, 2026-10-05): a unit freezes at its first pass with **zero blocking** defects; its remaining minor defects are listed in that pass's report for the operator to accept.

| Unit | Final pass | Blocking | Minor (accept at G1) | Status |
|---|---|---|---|---|
| Contract (CONTRACT.md) | `docs/verification/P1-contract-lensR-14.md` | 0 | 3 | **FROZEN** |
| Threat model | `docs/verification/P1-threat-model-lensR-14.md` | 0 | 3 | **FROZEN** |
| Risk register | `docs/verification/P1-risk-register-lensR-11.md` | 0 | 5 | **FROZEN** |
| ADRs 001–007 | `docs/verification/P1-adrs-lensR-15.md` | 0 | 4 | **FROZEN** |
| ADR-008 independent monitor | `docs/verification/P1-adr-008-lensR-8.md` | 0 | 5 | **FROZEN** |
| Rubric | `docs/verification/P1-rubric-lensR-16.md` | 0 | 4 | **FROZEN** |
| Sequence diagrams (SEQUENCES.md) | `docs/verification/P1-sequences-lensR-3.md` | 0 | 8 | **FROZEN** |
| P0 units (guardrails, tooling, constants, port requirements, open questions) | none (verifier run stopped at G0) | — | — | Unverified |

## 2. Architecture decisions (pick one option per ADR, per phase)
| ADR | Decision | Agent's recommendation (see the ADR for options and trade-offs) | Blocking questions |
|---|---|---|---|
| ADR-001 | Custody and signing | A (HSM self-custody) if the bank already runs FIPS 140-3 Level 3 HSMs with a key-ceremony practice; otherwise B (custodian) only if Q-D1 (a)–(g) are all yes; otherwise the mainnet pilot is blocked | Q-D1, Q-D2, Q-D3, Q-D7 |
| ADR-002 | Chain access | See ADR. New since drafting: Goldsky listed as an Arc RPC provider (LEDGER CF-20) | |
| ADR-003 | Orchestration | See ADR | Q-D4 |
| ADR-004 | Travel rule (FIC Directive 9) | See ADR | Q-D5, Q-R9, Q-R10 |
| ADR-005 | Address screening | See ADR | Q-D6 |
| ADR-006 | Deposit address model | See ADR | Q-P1, Q-D3 |
| ADR-007 | Language and stack | See ADR | |
| ADR-008 | **Independent monitor** (new; not in KICKOFF's list) | See ADR. The only proposed design in which a compromised adapter can't suppress its own detection | Q-D8 |

### 2a. Testnet choices to approve now (mainnet choices stay open until their questions are answered)
**Operator decision 2026-10-05: "for g1 - use sandbox options".** All rows below are approved as the sandbox configuration. Production choices are deferred to mainnet planning.
| ADR | Testnet choice (from the ADR's "Testnet" row) |
|---|---|
| ADR-001 | Signer service with a throwaway key generated at test time inside the service; `MockSigner` in unit tests; same `Signer` interface and checks |
| ADR-002 | One own node (A), plus a testnet reference RPC (Q-T6) |
| ADR-003 | Option C (see the ADR) |
| ADR-004 | Stub travel-rule service with synthetic data only |
| ADR-005 | Option B only: a self-hosted test list including C-55 and a canary entry; the vendor stubbed to REVIEW |
| ADR-006 | Option A: per-merchant addresses for a handful of synthetic merchants |
| ADR-007 | **A: TypeScript + viem** (the CBS stack is unknown, so KICKOFF's "match the CBS" can't apply yet). Node.js v22.23.3 LTS installed checksum-verified in `.tools/node` |
| ADR-008 | Option B: independent monitor with signer-enforced attestation; may share a host with the adapter on testnet, with separate identities and credentials |

**What G1 approval unlocks:** Phase 2 on **testnet only**, against a stand-in CBS. Mainnet stays disabled in code until every G-M gate in `docs/GATES.md` is signed (CLAUDE.md rule 1).

## 3. Strategic and regulatory questions the human must answer first
- **Q-R13:** SARB stance on foreign-currency-pegged stablecoins for domestic payments. It can change whether the mission proceeds at all.
- **Q-P1:** Memo contract scope in ADR-006. **Q-P2:** rephrasing the CLAUDE.md blocklist-revert wording.

## 4. Process items needing explicit acknowledgement
- **RUBRIC Probe F (MC-07):** "100% of *reachable* branches", with compiler-proven exhaustiveness guards excluded. This changes how a KICKOFF §3 exit bar is measured.
- **Ladder interpretation** (LEDGER): each ladder step produces a new version with fresh fix blocks. Operator decisions in force: "Full discipline to POSITIVE"; "Allow all extra fix blocks necessary and correct rubrics defects".
- **Guard hook (Q-T7, Q-T9):** false positives on text, and no block on agent writes of SIGNED-OFF.
- **Tooling gap (Q-T8):** POPIA PDFs not machine-extractable, so POPIA claims stay UNVERIFIED (Q-R12).
- **Session note, 2026-10-05:** a session ran with its working directory outside the repo, so the guard hook and the verifier agent definition weren't loaded. Verification continued through general-purpose agents loading `.claude/agents/verifier.md`, with the hook's rules restated in writing. No chain writes happen in Phase 1. Relaunch from `~/arc-rail` before Phase 2.

## 5. Residual risks to accept or reject
The authoritative lists are `docs/THREAT_MODEL.md` "Residual risks for the human at G1" and `docs/RISK_REGISTER.md` §RB. They are copied here once both units are final.

## 6. Signature block
| Gate | Name | Role | Date | Decision |
|---|---|---|---|---|
| G1 | | | | |
