# Risk register

**Version 3**, regenerated (LEDGER: v1 failed three rounds → v2 reframe failed → v3 regeneration, regen budget 2 → 1). **Fix blocks 1 to 6 applied** after R5 to R10 (`docs/verification/P1-risk-register-lensR-5.md` … `-lensR-10.md`); fix block 6 answers R10 D-34 to D-38. Fix block 2 syncs with THREAT_MODEL v2 fix block 2, which adds the **independent monitor (ADR-008)**: the detections below marked "in the monitor" run outside the adapter, and their PAUSE is enforced by the signer.

**Single source of truth for detections.** Every [R] detection is defined **once**: either in THREAT_MODEL §D (`DR-xx`), or, for detections that exist only here, in §RD below (`RD-xx`). Each definition gives the independent input and one concrete mutant it catches (RUBRIC MC-40). This register only maps risks to those definitions, so labels can't drift between the two documents.

**Labels:** [R], [X], [P], [A] and [I], exactly as defined in THREAT_MODEL (header). A risk is **blind** if it wouldn't show up as an error in normal operation. **Blindness is labelled per sub-risk** (column "Blind?"); an entry's heading only summarises it (RUBRIC MC-41). An [X] that a blind sub-risk relies on states its owner, cadence, input and action (RUBRIC MC-40).

**Siblings:** every "matches" or "mirrors" claim below refers to the versions listed above. **This version (v3 fix block 6) is ahead of THREAT_MODEL v2 fix block 8** on two G1 residuals that THREAT_MODEL doesn't list yet: **4b / RB-12** (a duplicate T6 stays undetected until the CONTRACT change CF-5(b)) and **2d / RB-16** (DR-10 has no hard-fork mutant, so 2d rests on an event-driven [X] only). Both are routed as LEDGER **CF-40**. It is ahead of no other sibling. Every blind sub-risk has an [R] or [X] detection valid under MC-40, or is listed as a G1 residual with what closes it. [P] counts only for sub-risks that come from a bug in the tested preventive control (MC-41).

Derived from:
- Phase 0 findings (`docs/constants.md` M-1 to M-9, C-41, C-57, the 2026-10-02 doc drift Q-A14);
- THREAT_MODEL **v2 fix block 8**;
- CONTRACT **v3 fix block G**;
- ADR-001 and ADR-003 **fix block 9**, ADR-004 as of ADRs fix block 9, ADR-008 **fix block 5**;
- RUBRIC **v2 fix block 11**;
- the Directive 9 text (`docs/sources/fic/`).

## Top six

### RR-1 Unit or precision error mis-states money · Blind sub-risks: see column · High / Critical · Owner: Engineering
| Sub-risk | Blind? | Detections |
|---|---|---|
| 1a Adapter `p` ≠ CBS `p` | yes | [R] RD-01. [X] RD-02 |
| 1b Wrong conversion within a consistent `k` | yes | [R] DR-06 |
| 1c 6/18-dp mix or float in code | yes | [P] U1 property tests, mutation ≥ 90% (MC-08), compile-fail tests (MC-02), float lint (MC-01). [R] DR-06 |

### RR-2 Ingestion or attribution error (missed, double-counted or misattributed transfer) · Blind sub-risks: see column · Medium / Critical · Owner: Engineering
| Sub-risk | Blind? | Detections |
|---|---|---|
| 2a Missed log (paging at the 10,000-block or 2,000-result cap) | yes | [R] DR-10 (ranges are U12's reconciliation cut-offs, never the pager's pages) |
| 2b Double count from the two emitters | yes | [R] DR-10. [P] ERC-20 fixture gives exactly one credit (MC-15) |
| 2c Misclassification (internal move booked as inbound) | yes | [R] DR-06 over all bank wallets, **mutant (2)** in THREAT_MODEL §D: an internal move booked as an inbound T2 makes the residual non-zero. (DR-13 is **not** a detection for 2c, because it *is* the classifier under test) |
| 2d Hard fork changes event semantics (T-N1; Zero5 precedent, C-26) | yes | [X] **arc-node upgrade review:** **owner** Engineering (which owns the approved digest list, DR-27); **cadence** before every new arc-node digest is approved, because arc-node runs only an approved digest (RB-3), so a fork's new semantics reach our ingestion only through an upgrade we approve; **input** the target version's arc-node `BREAKING_CHANGES.md` and CHANGELOG (linked from the archived Arc pages in `docs/sources/arc/`); **action** any change to event emitters, topics or transfer semantics blocks the digest approval until U4's event mapping and fixtures cover it. [R] DR-10 is supplementary here: its mutant (a pager skip) is an instance of 2a, not of 2d. Because this cadence is event-driven, not tied to the age of the money (MC-40 [X] clause), 2d is **G1 residual RB-16** until THREAT_MODEL gives DR-10 a 2d mutant (CF-40) |
| 2e **Credit to the wrong customer**: registry `address → accountRef` mapping swapped (T-T2) | yes | [R] DR-23 (in the monitor; **needs CF-5(h)**, until then RB-7). [X] Customer statements and complaints |
| 2f Relayed deposit attributed to the relayer (T-S4, C-27) | yes | [R] DR-22 (in the monitor; every relayed item plus a sample). Its reference input, the CBS's own screening and monitoring records, **needs CF-5(i)**; until then 2f relies on [P] U4 relayed-transfer fixtures (RB-7) |

### RR-3 Unauthorised outflow · Blind sub-risks: see column · Low / Critical · Owner: Security
| Sub-risk | Blind? | Detections |
|---|---|---|
| 3a **Compromised adapter or orchestrator** fabricates an instruction (or labels a payout as an internal move) and gets it signed | yes | [R] **DR-01 in the independent monitor**: it classifies every signing-log entry itself against the CBS's own instruction, approval and disposition records and Treasury's list, and its PAUSE is enforced by the signer's attestation check (THREAT_MODEL B9, ADR-008). **Needs CF-5(f), CF-5(h) and CF-5(i)** (`listPayoutInstructions`, `listApprovals`, `listCaseDispositions`, and `listIssuedAddresses` for the wallet set S that DR-01's cancel class relies on), as in THREAT_MODEL DR-01. Until then there is **no [R] detection**; DR-06/DR-07 stay at 0 when a fabricated transaction is posted consistently (THREAT_MODEL residual 6). G1 residual RB-7. Preventive: the signer's sign-time assertion check, OPEN until Q-C10 (residual 4) |
| 3d **Approval replay**: a genuine approval is signed again at a new nonce | yes | Preventive: the signer's consumed-approval rule (CF-5(g), MC-24). [R] DR-25 (in the monitor; needs CF-5(f)). [R] DR-06 after the fact |
| 3b Key theft or a signature outside the signer's logged flow | yes | [R] DR-12. [R] DR-13 |
| 3c Off-chain signature drain (EIP-3009, permit, 7702) | yes | [P] Signer refusal fixtures (MC-23). [R] DR-14. [R] DR-15 |
| 3e **Wrong-account binding:** a compromised adapter places a payout hold, settles it, or posts an inbound credit, on an uninvolved customer's account (as in THREAT_MODEL T-T7); every reconciliation stays at 0 (ADR-008 R5 C-1) | yes | **Preventive:** the CBS binds every customer-account leg (hold, settlement, inbound credit) to its own instruction or issuance record and returns `BINDING_MISMATCH` → PAUSE (CONTRACT §3, fixes F and G; **needs Q-C19**). [R] **DR-29** (in the monitor; THREAT_MODEL T-T7): joins each CBS journal's customer-account legs to the CBS's own records. **Needs CF-5(f), (h), (i) and journal legs in `listJournals`**. Until Q-C19 and those inputs exist: **G1 residual RB-13** |

### RR-4 Ambiguous or duplicated CBS outcomes · Blind sub-risks: see column · Medium / High · Owner: CBS owner + Engineering
| Sub-risk | Blind? | Detections |
|---|---|---|
| 4a Duplicate posting of T2, T8, T11 or the T5 fallback | yes | [R] DR-07 (G5/G4 itemisation) |
| 4b Duplicate T6 (internal move posted twice) | yes | [R] RD-03. **Needs the CONTRACT change CF-5(b):** the per-role check must PAUSE, not only diagnose. Until then **G1 residual RB-12** |
| 4c Ambiguous outcome never resolved | no (CONTRACT §5.8 ages expire to PAUSE) | [R] DR-07 (key join). Ages in CONTRACT §5.8 |
| 4d CBS contract drift | yes | [X] Consumer-driven contract tests against the chosen CBS (Phase 2): **owner** CBS owner with Engineering; **cadence** every CI run and every CBS release; **input** the CBS's own test environment; **action** a failing test blocks the deploy |

### RR-5 Regulatory controls built on unverified or misread requirements · Blind sub-risks: see column · Medium / High · Owner: Compliance
| Sub-risk | Blind? | Detections |
|---|---|---|
| 5a Directive 9 obligations misread (fields, R5 000 tier, recipient-side duties, unhosted wallets) | yes | [X] Compliance confirmation of the agent's reading of the archived text (Q-R3, Q-R9, Q-R10). [X] Travel-rule interop test with a counterparty CASP (G-M 2). **Owner** Compliance; **cadence** at each gate and within 30 days of a new FIC publication (proposed; Q-R3); **action** a contradicted reading blocks the next gate |
| 5b TFS freeze vs return (Q-R8), FIC report types (Q-R1), retention (Q-R2), POPIA (Q-R12), Schedule 1 scope (Q-R11) | yes | [X] Compliance and counsel sign-off with primary-source quotes (MC-43). **Archived so far:** Directive 9, FSCA GN 1350/2022, FIC PCC 57 (Item 22 as quoted by the FIC), and the SARB/FSCA Joint Communication of 28 May 2026. **POPIA is archived, but its text isn't yet extracted or read** (Q-T8, Q-R12). **Still to archive:** gazetted Schedule 1 (Item 12), the FIC Act TFS and record-keeping sections. **Owner** Compliance with counsel; **cadence** at each gate; **action** an unconfirmed control stays UNVERIFIED in the compliance matrix and blocks its G-M gate |
| 5c **Policy direction against the asset:** the SARB is "unlikely to consider foreign currency-pegged stablecoins as payment instruments for domestic transactions" in a future NPS Act revision (Joint Communication ¶4.5.2; Q-R6, Q-R13) | no (a published policy direction) | [X] Counsel opinion on the domestic USDC merchant-settlement use case before G-M 1. [X] Watch SARB NPS Act revision publications at each gate |

### RR-6 Personal information leaks · Blind sub-risks: see column · Medium / High (irreversible on-chain) · Owner: Security + Privacy officer
| Sub-risk | Blind? | Detections |
|---|---|---|
| 6a PII or address↔account links in logs or telemetry | yes | [R] DR-19 (in the monitor; THREAT_MODEL §D gives its fail-closed action: quarantine the sink, page Security and the Privacy officer; and its heartbeat) |
| 6b Bank address leaked to a third-party RPC | yes | [R] DR-20 (Security egress proxy: blocks the request and pages Security; our own signed transactions are exempt; fails closed). Its bank address set needs the CBS issuance record (**CF-5(h)**); until then RB-7 |
| 6c Identifier-derived memo reaches the chain | yes | [R] DR-21 (in the monitor; needs CF-5(f) and CF-5(h), until then RB-7). [P] Generator-independent entropy and hash-match tests (MC-32) |
| 6d Memo shape abused to call `approve` (an outflow risk, listed here because it travels with the memo) | yes | [P] Signer refusal fixtures (MC-23). [R] DR-15 |
| 6e The address registry is stolen from the store (L-2) | yes | [R] DR-26 part (1) (monitor, DB row-level audit log) and part (2) (egress proxy). **Contingent on row-level read auditing (Q-D4)**; until then RB-10 |

## §RD Detections defined only in this register

| ID | Detection | Independent input | Mutant it catches |
|---|---|---|---|
| RD-01 | Every amount the CBS returns carries a unit tag from the **CBS's own** asset config. **Two executors:** (1) the **adapter's ACL** compares `p` on every response and refuses to post before any mismatch reaches a posting (a pre-posting gate, CONTRACT §1.1); (2) **the monitor** independently compares `p` on the CBS responses it reads itself, and PAUSEs through the attestation. | The CBS's asset configuration | Adapter configured `p=6`, CBS at `p=2` → the tag says 2 → PAUSE, before 1 USDC can show up as 10,000.00 |
| RD-02 ([X]) | Known-amount onboarding test: exactly 1 USDC (10¹⁸ wei) on testnet; a human confirms the CBS screen shows exactly 1 USDC at the CBS's own precision | A human reading the CBS's own UI | Same `p` mismatch → the screen shows 10,000.00 (or 0.000100) → onboarding fails |
| RD-03 | **Per-role identity with `Rmove`** at each reconciliation cut-off: for each G2 sub-account, chain balance of that wallet set = CBS_G2[role]×k + D[role] − F[role] + Rin[role] − Rout[role] ± Rmove. Any residual → PAUSE (CF-5(b)) | `eth_getBalance` per wallet set | T6 posted twice for a hot→gas move of X → CBS_G2[gas] is X too high and CBS_G2[hot] X too low, while the chain shows a single move → per-role residuals ±X → PAUSE |
| RD-04 | Re-fetch every cited page and diff against `docs/sources/` at every gate (MC-21) | The live published page | A cited sentence is removed from docs.arc.io (it happened on 2026-10-02, Q-A14) → the diff shows it → the fact reverts to UNVERIFIED |

## Below cut-off (tracked, not top six)

| ID | Risk | Why below cut-off | Detections | Flag |
|---|---|---|---|---|
| RB-1 | **Issuer or network acts against our wallets** (T-D5, T-N1, T-N2). Partly blind: a blocklisted collection address makes payers' transfers revert on *their* side, and funds already on it are frozen | Can't be prevented. Exposure is limited by the sweep policy (ADR-006, U11; still undecided) | [R] DR-11 (**zero-value** probe; signal `-32603 "Blocked address"`, C-57). [A] DR-16 (two parts: adapter send results, monitor headers; contingent on Q-A2, THREAT_MODEL residual 11). [X] arc-node CHANGELOG | **G1 residual: the bank must accept it** |
| RB-2 | Public linkability and detectability of flows (L-1, L-5) | Inherent until privacy is live (C-64) | [X] Merchant disclosure sign-off (L-7) | **G1 residual** |
| RB-3 | Tampered tooling or node software: Arc Foundry (T-SC1) and arc-node, whose documented install is `curl … \| bash` with images pulled by tag (T-SC4, Q-A16) | Arc Foundry is test-only. arc-node is built from a pinned source commit or pulled by approved digest | [R] DR-27 (approved-digest check at every start). [X] Signed provenance if any exists (Q-T3, Q-A16) | **G1 residual** until Q-T3 and Q-A16 are answered |
| RB-4 | Chain stall (T-D2) | Fails safe: no new block on own nodes for `A_stall` → PAUSE (CONTRACT §1.6) | [A] `A_stall` (non-blind) | — |
| RB-5 | Doc drift: Arc docs change after we cite them (Q-A14) | Archived copies keep citations re-derivable | [R] RD-04 | — |
| RB-6 | Travel-rule provider alters the transmitted data (T-B2) | Signing is blocked until COMPLETE | [R] DR-18 (needs CONTRACT CF-5(e)). [X] counterparty acknowledgement where ADR-004 provides one | **G1 residual** until CF-5(e); **for unhosted wallets permanently**, and **for hosted CASPs until ADR-004 provides a counterparty acknowledgement** (Q-D9, CF-24; THREAT_MODEL residual 13) |
| RB-7 | A compromised adapter fabricates an instruction (3a), replays an approval (3d), swaps an account mapping (2e), misattributes a relayed deposit (2f), or leaks through paths DR-20/DR-21 can't yet see (6b, 6c), **while DR-01, DR-04, DR-20 (address set), DR-21, DR-22, DR-23, DR-25, DR-28 and DR-29 can't run** (CF-5(f), CF-5(h), CF-5(i); DR-04 also needs an exportable xpub, Q-D3/Q-D1(h)) | The signer's per-transaction and daily limits, from its own copy owned by Treasury with Risk (ADR-001), cap the damage | [X] Customer statements and complaints only. Matches THREAT_MODEL residual 6 | **G1 residual** until CF-5(f), CF-5(h), CF-5(i), Q-D3/Q-D1(h) and Q-C10 |
| RB-8 | Prompt injection into the **build** agent through fetched docs (T-SC3) | Build-time only. No AI in the money path (MC-34) | [X] Human review of every phase at G0–G3; fresh-context verifiers (THREAT_MODEL residual 7) | **G1 residual** |
| RB-10 | Registry theft (6e) while the database has no row-level read audit | Encryption at rest and access logging (U5) limit the exposure | [I] DB access review | **G1 residual** until Q-D4 (THREAT_MODEL residual 9) |
| RB-12 | Duplicate T6 (4b) while the per-role check only diagnoses | Rmove is itemised (CONTRACT §5.7) | [R] RD-03 once CF-5(b) is in CONTRACT | **G1 residual** until CF-5(b). Ahead of THREAT_MODEL v2 fix block 8, which lists no residual for it (CF-40) |
| RB-13 | Wrong-account binding (3e) | CBS binding (CONTRACT §3, fix F) once Q-C19 confirms the CBS can do it | [X] Customer statements and complaints only | **G1 residual** until Q-C19 and DR-29's inputs exist (THREAT_MODEL residual 6) |
| RB-14 | Reference-artefact or key exposure: disclosure of the xpub or the bank address set (T-I2), or of the honeytoken and canary lists or the attestation key (T-I3); [X]-only windows for stale sanctions lists, malicious dependencies and secret-artefact access (T-B1, T-SC2, T-I3) | Dedicated hardened collection branch and secret-store custody of the xpub (T-I2); lists only in secret stores and an HSM-held, never-exported attestation key (T-I3); daily [X] checks | Per threat, as in THREAT_MODEL: T-I2 **[I] access review only** (residual 10); T-I3 [X] HSM key-use and secret-store audit; T-B1 [X] list version and hash; T-SC2 [X] SCA feeds. (Owner re-attestation of deployed hashes detects **tampering**, T-T6, not disclosure; it belongs to RB-9) | **G1 residual** (THREAT_MODEL residuals 10, 12) |
| RB-15 | DR-16 contingent on Q-A2: if Arc silently drops below-floor transactions, a raised fee floor is seen only at `A_stuck` | Fails closed at `A_stuck` | [A] DR-16 | **G1 residual** until Q-A2 (THREAT_MODEL residual 11) |
| RB-16 | Hard fork changes event semantics (2d, T-N1) while its only relied-upon detection is the event-driven [X] arc-node upgrade review | arc-node runs only an approved digest (DR-27, RB-3), so new semantics arrive only through an approved upgrade; unknown events are quarantined (U4); a pinned node that doesn't follow a fork stops agreeing with the chain, which PAUSEs (`A_stall` or RPC disagreement, CONTRACT §1.6) | [X] arc-node upgrade review (2d). [R] DR-10 supplementary | **G1 residual** until THREAT_MODEL gives DR-10 a 2d mutant, for example the transfer-event emitter or topic changes at a fork (Zero5 precedent, C-26), so the indexed logs stop explaining the balance deltas → PAUSE (CF-40). Ahead of THREAT_MODEL v2 fix block 8 |
| RB-9 | **Simultaneous compromise of two trust domains** (adapter and monitor, or the signer) defeats the independent monitor (THREAT_MODEL residual 8, including an artefact owner plus the adapter, T-T6) | Separate admins and change control per domain (ADR-008) | [X] Separate audit trails per domain, reviewed by Security | **G1 residual** |

## Review cadence
- Re-rank at every gate (G1, G2, G3). Add a row whenever a verifier finds a defect class that no row covers.
- A risk closes only when its detection has evidence in `docs/EVIDENCE_PACK.md` (Phase 5). The register itself never closes a risk.
