# Gates

**Only a named human may sign a gate.** The agent can create and maintain this file, but it never writes SIGNED-OFF here (CLAUDE.md rule 6; root `KICKOFF_PROMPT.md` §9 line 211: "The agent cannot clear these"). A signature counts only if its line comes from a commit authored and cryptographically signed by that human, with no agent co-author, and the signing key is anchored outside this repository (RUBRIC MC-42). Mainnet (chain ID 5042) stays disabled in code until G3, **every** G-P gate and **every** G-M gate below are SIGNED-OFF (CLAUDE.md rule 1, CO-1 v3 Step 8). A CI test fails if mainnet configuration is reachable while any G-M gate is unsigned (root `KICKOFF_PROMPT.md` §9 line 223, RUBRIC MC-20); the code check does not yet read G3 or the G-P rows (see the TODO below).

Status values: `NOT SIGNED` or `SIGNED-OFF` (name, role, date).

Chat decisions are recorded but are not signatures. `PASSED IN CHAT` and `APPROVED IN CHAT` record what the operator said and when; a gate in either state is still `NOT SIGNED` until its signer's own signed commit lands here (RUBRIC MC-42). Change order CO-1 v3 (`docs/kit-v3/CHANGE_ORDER.md`) adds the Raayl gates G0b and G1b, the demo gates D1–D7 (Step 5) and the proposed pilot gates G-P (Step 8, `docs/kit-v3/KICKOFF_PROMPT.md` §9). Mainnet needs G3 (testnet demonstration and evidence pack), then the G-P gates, then the G-M gates (CLAUDE.md rule 1, CO-1 v3 Step 8). Note that the mainnet check in code reads the G-M rows only.

**TODO (before mainnet is ever enabled):** `REQUIRED_MAINNET_GATES` in `src/chain/config/index.ts` lists G-M 1–8 only. The reviewed change that enables mainnet must first add every G-P row (and G3, per CLAUDE.md rule 1) to the required set and fail closed on any missing or unsigned one. Until then mainnet cannot be reached anyway: `resolveChain` refuses chain 5042 unconditionally because `ARC_MAINNET_DISABLED.enabled` is `false`.

Every gate also gets a record in the **Gate records** section at the end of this file: name, role, date, commit SHA, and the option chosen for each ADR the gate decides (CO-1 v3 Step 2). The tables keep their six-column layout because tools parse them: `tools/g2-precondition.mjs` reads the G2 row and `src/chain/config/index.ts` reads the G-M rows.

## Phase gates (checkpoint mode `pause`, KICKOFF)
| Gate | Meaning | Status | Name | Role | Date |
|---|---|---|---|---|---|
| G0 | Phase 0 discovery reviewed | NOT SIGNED. **PASSED IN CHAT on 2026-10-02.** The operator said "continue" (LEDGER, Gates table). The Phase 0 Lens R verifier run was stopped by the operator before it reported, so Phase 0 left **unverified** (LEDGER). For Raayl, discovery is redone at G0b | | | 2026-10-02 |
| G1 | Phase 1 spec, threat model and ADR decisions (`docs/G1_PACKET.md`). It would also have unlocked the CONTRACT integration points for the CBS's normal change process (superseded: CLAUDE.md rule 3 now keeps existing code read-only until G1b) | NOT SIGNED. **APPROVED IN CHAT on 2026-10-05, testnet only. Superseded by G1b** (CO-1 v3). The operator's words were "g1 is ago" (read as "G1 is a go") and "for g1 - use sandbox options" (LEDGER, Operator decisions, 2026-10-05). The sandbox options chosen per ADR (G1_PACKET §2a) are listed in the G1 record below. Production choices were deferred to mainnet planning, not decided | | | 2026-10-05 |
| G0b | Raayl evidence map reviewed (`docs/discovery/RAAYL_MAP.md`, CO-1 v3 Step 3): existing Raayl components with file:line evidence, the Arc risk questions (a)–(f), and the gap list | NOT SIGNED. LEDGER 2026-10-06 (Nova approach): "G0b is replaced for now by the README plus Khumo's answers, marked unverified until the code is seen" | | | |
| G1b | Raayl design packet (CO-1 v3 Step 7): interfaces between existing modules and the Arc adapter, sequence diagrams D1–D6 with failure paths, STRIDE + LINDDUN threat model, risk register, ADR recommendations (ADR-001, 002, 003, 005, 006, 007, 009, 010, 011, 013), Probes G and F. Supersedes G1. Unlocks the D1 build on a feature branch | NOT SIGNED | | | |
| G2 | Phase 2 skeleton. **Precondition:** the skeleton's Lens R pass has zero blocking defects, and artefact signing (cosign) and SLSA provenance have run in hosted CI (`.github/workflows/release-sign.yml`, see `docs/CI.md`). A SIGNED-OFF G2 row must cite that successful run as `https://github.com/MrsNqobiG/ArcRail/actions/runs/<id>`, from `main` or a `v*` tag; `scripts/ci.sh` fails a SIGNED-OFF row without that citation | NOT SIGNED. **Accepted in chat 2026-10-05 under the operator's standing auto-accept** (skeleton Lens R round 3: 0 blocking, 6 minor). The precondition is not yet met: cosign and SLSA are still SKIPPED pending hosted CI |  | | |
| G3 | Phase 5 testnet demonstration and verdict (`docs/EVIDENCE_PACK.md`) | NOT SIGNED | | | |

## Demo gates (D1–D7, CO-1 v3 Step 5)
Each milestone extends existing Raayl code and ends at its demo gate, with an evidence note. Everything is testnet only (`ArcTestnet`). The rows summarise `docs/kit-v3/CHANGE_ORDER.md` Step 5, which is the authoritative text.
| Gate | Milestone | Status | Name | Role | Date |
|---|---|---|---|---|---|
| D1 | M1: Arc + DFNS transfer on testnet. A `network` abstraction (`network = ARC`, `asset = USDC`); Arc testnet config, with mainnet config present but disabled (CI test); a DFNS `ArcTestnet` wallet and balance query; a transfer with DFNS policy approval, then broadcast; confirmation from our own event detection (system-emitter log), with DFNS events as a cross-check; ledger postings via existing postings code (gas in USDC, dust handled); status via `GET /payments/:id` | NOT SIGNED | | | |
| D2 | M2: Business USDC wallet on Arc. Extend the `wallets` table and onboarding seeding for `network = ARC` (Arc addresses are standard EVM addresses, so DFNS creates them); detect deposits from per-transfer events, with `balance-poller.ts` as a reconciliation cross-check, not the crediting source (unless G0b proves it is already per-transfer); hold, send, history and export | NOT SIGNED | | | |
| D3 | M3: Payment requests. Extend existing `invoices` with `network = ARC`; a matching rule that cannot be ambiguous: a per-invoice address or a unique reference amount (decided in ADR-006), because external payers won't attach memos; payment link/QR (format verified before use); a "Payment received" notification | NOT SIGNED | | | |
| D4 | M4: Business settlement. Beneficiary management; screening (local USDC blocklist copy plus the ADR-005 vendor); FIC Directive 9 travel-rule data: the full set, and the reduced set below R5,000 (verify the text), and the zero threshold applies; DFNS approvals; an outbound `Memo` with a non-PII reference hash | NOT SIGNED | | | |
| D5 | M5: ZAR↔USDC. Reuse `fx-v2.ts`, `otc-routes.ts` and `buildConversionPostings`; move USDC between the liquidity venue and DFNS Arc wallets, both ways; cross-border flag OFF until a legal opinion is recorded | NOT SIGNED | | | |
| D6 | M6: API. `POST /api/v1/payments` (`Idempotency-Key` required), `GET /api/v1/payments/:id`; signed outbound webhooks; decimal strings at the API edge, integer base units inside | NOT SIGNED | | | |
| D7 | M7: Multi-chain. More network adapters (Base, Ethereum, others); CCTP and Gateway later | NOT SIGNED | | | |

## Pilot gates (G-P, `docs/kit-v3/KICKOFF_PROMPT.md` §9 lines 211–217, quoted): proposed, for Compliance to confirm
`docs/kit-v3/KICKOFF_PROMPT.md` §9 line 211: "Pilot (G-P), proposed for Compliance to confirm. Bank's own funds, tiny caps, allow-listed recipients". Each requirement below is **proposed, for Compliance to confirm**. Compliance may change, add or remove rows. The agent cannot clear these.
| Gate | Requirement | Status | Name | Role | Date |
|---|---|---|---|---|---|
| G-P 1 | "Legal sign-off that existing licences cover the pilot, including any cross-border element." (proposed, for Compliance to confirm) | NOT SIGNED | | | |
| G-P 2 | "FIC registration/RMCP covering the rail, with travel-rule handling for the pilot's flows." (proposed, for Compliance to confirm) | NOT SIGNED | | | |
| G-P 3 | "Focused security review of the gateway, signer and orchestrator." (proposed, for Compliance to confirm) | NOT SIGNED | | | |
| G-P 4 | "Dfns mainnet service accounts, policies and approvers set up by two people, with a written record; key-compromise drill run." (proposed, for Compliance to confirm) | NOT SIGNED | | | |
| G-P 5 | "Monitor and reconciliation proven on testnet (from the evidence pack)." (proposed, for Compliance to confirm) | NOT SIGNED | | | |
| G-P 6 | "Rollback/pause drill run." (proposed, for Compliance to confirm) | NOT SIGNED | | | |

## Mainnet gates (G-M, root `KICKOFF_PROMPT.md` §9 lines 214–221, quoted)
The rows quote the root `KICKOFF_PROMPT.md`. `docs/kit-v3/KICKOFF_PROMPT.md` §9 lines 219–227 gives a shorter wording of the same eight gates; the root wording is kept.
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

## Gate records
One record per gate, added when the gate is decided. Fields:
- **Gate**: the table name (for example `G1b`, `D1`, `G-P 3`).
- **Decision**: the state (`PASSED IN CHAT`, `APPROVED IN CHAT`, or a signature written by the signer), and the decider's exact words, quoted.
- **Name** and **Role**: of each human who decides. The agent never fills these in for someone else.
- **Date**: ISO date (YYYY-MM-DD).
- **Commit SHA**: the commit holding the reviewed material at decision time. For a signature, this is also the signer's own signed commit (RUBRIC MC-42).
- **ADR options chosen**: the option chosen for each ADR the gate decides, or "none" if the gate decides no ADR.

### G0
- Decision: PASSED IN CHAT. Operator, verbatim: "continue" (LEDGER, Gates table). Phase 0 left unverified because the Lens R verifier run was stopped before it reported. Q-P1 and Q-P2 were still OPEN at the time.
- Name: not recorded. Role: operator.
- Date: 2026-10-02.
- Commit SHA: none. The decision predates the repository's first commit, `4ebdbed2d5aa1864054b9b36ec51f96d832c0800` (initial import, 2026-10-06). That commit contains the Phase 0 documents, possibly with later edits.
- ADR options chosen: none (G0 decides no ADR).

### G1 (superseded by G1b)
- Decision: APPROVED IN CHAT, testnet only. Operator, verbatim: "g1 is ago" (read as "G1 is a go") and "for g1 - use sandbox options" (LEDGER, Operator decisions, 2026-10-05). Never signed; CO-1 v3 supersedes it with G1b.
- Name: not recorded. Role: operator.
- Date: 2026-10-05.
- Commit SHA: none. The decision predates the repository's first commit, `4ebdbed2d5aa1864054b9b36ec51f96d832c0800` (initial import, 2026-10-06). That commit contains `docs/G1_PACKET.md`, possibly with later edits.
- ADR options chosen (sandbox options, G1_PACKET §2a):
  - ADR-001: a signer service with a throwaway key generated at test time inside the service; `MockSigner` in unit tests; the same `Signer` interface and checks.
  - ADR-002: one own node (A), plus a testnet reference RPC (Q-T6).
  - ADR-003: option C.
  - ADR-004: a stub travel-rule service with synthetic data only.
  - ADR-005: option B only, a self-hosted test list including C-55 and a canary entry, with the vendor stubbed to REVIEW.
  - ADR-006: option A, per-merchant addresses for a handful of synthetic merchants.
  - ADR-007: A, TypeScript + viem.
  - ADR-008: option B, an independent monitor with signer-enforced attestation. On testnet it may share a host with the adapter, with separate identities and credentials.
  - Production choices (custody A/B, the real CBS, the Q-R13 strategy) were deferred to mainnet planning, not decided.

### Template (copy for each later gate)
- Decision:
- Name:
- Role:
- Date:
- Commit SHA:
- ADR options chosen:
