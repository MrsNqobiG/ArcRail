# Arc Rail: build status for collaborators

**As of 2026-10-05, 15:36 SAST.** Repo: `~/arc-rail` (WSL). No git commits yet. Read `CLAUDE.md` (standing rules) and `docs/LEDGER.md` (history, decisions, open follow-ups) first.

## What we're building
An **Arc Rail Adapter**: Circle's **Arc** blockchain added as a USDC settlement rail beside an existing core banking system (CBS). The CBS stays the system of record for customers, accounts, balances, KYC/AML and the GL. The adapter talks to it only through `docs/CONTRACT.md`. Arc facts we rely on are cited in `docs/constants.md`:
- USDC is the gas token: 18 dp native, 6 dp ERC-20 at `0x3600…`;
- two Transfer logs per transfer;
- BFT finality;
- a 20 gwei fee floor;
- a Circle blocklist;
- testnet chain ID 5042002.

## Where we are: Phase 1 (design) is closing. No production code yet.
| Phase | Scope | Status |
|---|---|---|
| 0 Discovery | Arc constants, CBS port requirements, open questions | Done (G0 passed; the Phase 0 docs were never independently verified) |
| **1 Design** | Contract, sequences, threat model, risk register, ADRs, rubric | **Closing.** The close-out workflow `wf_f952c38c-c25` has applied fixes to all 7 units; its 7 fresh verifier passes are running (0/7 verdicts at 15:36) |
| 2 Skeleton and CI | Layout, types, harness, CI (mutation, SAST, SCA, SBOM, signing) | Not started; blocked on **G1** |
| 3 Units U1–U15 | Rail code, one verified unit at a time | Not started |
| 4 Perfecting loop | Whole-rail verification | Not started |
| 5 Testnet demo and evidence pack | End-to-end on Arc testnet | Not started |
| Mainnet | — | **Disabled** until all 8 G-M gates in `docs/GATES.md` are signed by named humans |

**Estimate: about 15–20% of the total build.** The design is nearly done; all code, tests and evidence remain.

## Phase 1 exit rule (operator, 2026-10-05)
A unit freezes once a verifier pass finds **zero blocking** defects. Any minor defects still open go to the G1 packet for a human to accept. Units with blocking defects get one more fix-and-verify round.

## Documents (`docs/`)
| Doc | Content | State |
|---|---|---|
| `CONTRACT.md` v3 | Adapter↔CBS operations and events; idempotency keys; result model; PAUSE/QUARANTINE; state machines for inbound, outbound, case return and internal moves; GL templates T1–T11; reconciliation identity; maximum ages | Being verified. The last pass had 1 blocking defect (T11 binding after a re-screen), which has been fixed |
| `SEQUENCES.md` v2 | Mermaid diagrams S1–S5 and F1–F7, each step labelled with the CONTRACT row it implements | First verification running |
| `THREAT_MODEL.md` v2 | STRIDE + LINDDUN; 29 detections (DR-01…DR-29); G1 residuals | Being verified (the last pass had 0 blocking) |
| `RISK_REGISTER.md` v3 | Top 6 risks, blindness per sub-risk, RB-1…RB-15 | Being verified (the last pass had 0 blocking) |
| `adr/ADR-001…008` | Custody and signing; chain access; orchestration; travel rule; screening; deposit addresses; stack; independent monitor | Being verified (the last passes had 0 blocking) |
| `RUBRIC.md` | Verification criteria MC-01…MC-48 and JL-1…JL-6 | Being verified; its proposal queue is being processed |
| `G1_PACKET.md` | The decisions a human signs at G1, including the testnet choice per ADR | Draft; completed when Phase 1 closes |
| `GATES.md` | G0–G3 and G-M 1–8 | All unsigned except G0 |
| `PHASE2_SLICE_PLAN.md` | The first code slice (after G1) | Plan |
| `OPEN_QUESTIONS.md`, `constants.md`, `sources/` (+ `MANIFEST.md`) | Questions for humans; cited Arc facts; archived primary sources with hashes | Live |

**Tooling** (`.tools/`, gitignored, checksum-verified): Arc Foundry, Node.js v22.23.3, gitleaks 8.30.1. Source-drift check: `python3 tools/source_drift.py`.

## What remains
1. **Close Phase 1:** finish the current verification round (plus a second round if needed). Then a **human signs G1**: chooses the testnet option per ADR, accepts the open minor items, and acknowledges the MC-07 rewording. About 1–3M tokens; today or tomorrow.
2. **Testnet vertical slice** (`PHASE2_SLICE_PLAN.md`):
   - TypeScript + viem skeleton;
   - U1 amounts and conversion;
   - U2 config, with mainnet disabled;
   - U3 chain reads;
   - U4 ingestion;
   - U6 inbound;
   - U9 signer interface and `MockSigner`;
   - a CBS stub.

   Goal: an inbound deposit credited end to end with residual 0, and its failure paths tested. About 3–6M tokens, 3–5 h of agent time.
3. **Rest of Phases 2–5:**
   - full CI (mutation ≥ 90 %, Semgrep, osv-scanner, SBOM, cosign, SLSA);
   - units U5, U7, U8, U10–U15;
   - the independent monitor service;
   - outbound on testnet (needs testnet funds, Q-T2);
   - the perfecting loop;
   - the evidence pack.

   About 20–50M tokens; days to weeks.
4. **Mainnet:** the 8 G-M gates must be signed by humans and external parties:
   - FSCA authorisation;
   - a travel-rule interop test;
   - an exchange-control legal opinion;
   - an independent security review;
   - a key ceremony and key-compromise drill;
   - Joint Standard 2 evidence and a POPIA impact assessment;
   - bank-partner sign-off;
   - a staged rollout plan.

## Biggest open dependencies (where help is most useful)
- **Which CBS?** It decides ADR-007 (TypeScript by default, Kotlin if the CBS is JVM-centric), Q-C18 (read operations for the monitor), Q-C19 (account and amount binding) and the idempotency guarantees.
- **Custody:** a bank HSM (FIPS 140-3 L3) or a regulated custodian (Q-D1 a–h, Q-D3).
- **Independent monitor:** is it acceptable to Ops and Infra (Q-D8)?
- **Stablecoin strategy:** under the SARB stance (Q-R13).
- **Testnet:** funding and RPC access (Q-T2, Q-T6).

## Rules for collaborators (`CLAUDE.md`)
- **Testnet only (5042002).** Never configure, sign for or send to mainnet (5042).
- **No secrets** in the repo. Sign only through the `Signer` interface; tests use throwaway keys.
- **Integer money only**, with branded types and the single conversion module. Dust goes to suspense.
- **No LLM or agent in the money path.** Never guess an Arc, CBS or legal fact: cite it, or add an open question.
- **Read-only on the CBS until G1.** Compliance sign-off is human-only.
- **Every change gets an independent, fresh-context verifier pass**, recorded in `LEDGER.md`.
- **Run Claude Code from `~/arc-rail`.** Otherwise `CLAUDE.md`, the guard hook and the verifier agents don't load.
