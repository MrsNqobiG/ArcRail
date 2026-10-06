VERIFICATION · lens: R (plus the Lens A candidate, probe and regression sections the verifier method requires) · target: P1-risk-register (docs/RISK_REGISTER.md v3 after fix block 1), R6 · commit: none (uncommitted working tree on main, no HEAD). Snapshot verified 2026-10-03 08:50-08:52 UTC: RISK_REGISTER.md sha256 04bb02d9cc76397b6a2970060c8e0ded1892b5db1d2257948ad335bc03376127, mtime 10:46:28 SAST.

**Moving inputs.** THREAT_MODEL.md (10:50:53), OPEN_QUESTIONS.md (10:51:04) and LEDGER.md (10:51:25) changed during this run, after the register. LEDGER:29 records "P1-threat-model … v2 Fix 1 (DR-01 scoped and tied to CF-5(f); DR-22 to DR-24 added; DR-15/17/18 corrected; approval replay rule CF-5(g); residuals 6–7)". Cross-references below were checked against the **current** tree. Where the result differs from the threat-model version that was in place when the register was fixed, the check says so.

Criteria: KICKOFF §4, §5 P1 item 3; CLAUDE.md; RUBRIC MC-40, MC-41, MC-44 (and MC-21, MC-43); THREAT_MODEL §D and residuals; CONTRACT v3; constants.md; OPEN_QUESTIONS; LEDGER CF items; docs/sources (incl. sarb/).

CHECKS:
R1 Top-entry count 3–6 (KICKOFF §5 P1 item 3) → PASS. Recounted by script: 6 `### RR-` headings; 21 sub-risks (3+4+3+4+3+4; 5c is new); 7 RB rows (RB-7 new); 4 RD rows, each defined once. LEDGER:30 "Top 6 risks" matches.
R2 Each top entry has a detection, and blind entries use [R]/[X] → PASS. RR-1, RR-2, RR-5 and RR-6 are Blind; RR-3 and RR-4 are Partly blind. Every sub-risk has an [R] or [X], except 3a, which is explicitly a G1 residual (RB-7).
R3 MC-41 per sub-risk → PASS 21/21.
  - 1a: RD-01 + RD-02 [X]. 1b: DR-06. 1c: [P] U1 (money-path item 1) + DR-06.
  - 2a, 2b, 2d: DR-10. 2c: DR-06 only.
  - 3a: G1 residual with CF-5(f) and Q-C10 (RB-7). 3b: DR-12/DR-13. 3c: [P] MC-23 (U9, money-path item 4) + DR-14/DR-15.
  - 4a: DR-07. 4b: RD-03. 4c: DR-07. 4d: [X].
  - 5a, 5b, 5c: [X].
  - 6a: DR-19. 6b: DR-20. 6c: DR-21 + [P]. 6d: [P] + DR-15.
  - The Arc-specific signals used (−32603 "Blocked address", −32012, −32602 2,000-result cap, the system emitter) are cited at C-57, C-40, C-41, C-20. The Permit2 event names behind DR-15 are now tracked as Q-A15 (OPEN_QUESTIONS:31).
R4 Arc facts re-derived live, 2026-10-03 08:50 UTC, against https://rpc.testnet.arc.io (MC-21) → PASS.
  - eth_chainId → 0x4cef52 = 5,042,002 decimal (equals C-01). Head 65,259,735.
  - eth_getLogs, Memo-filtered: a 10,000-block span gives −32012 "requested range too large"; a 9,999-block span returns logs (C-40). An unfiltered 9,999-block span gives −32602 "query exceeds max results 2000, retry with the range 65239735-65239867" (C-41, Q-A4).
  - DR-11/RB-1 probe: eth_call from C-55 0x7099…79C8 to a fresh random address at value 0 → −32603 "Blocked address". Control (empty → 0x…bEEF) at value 0 → "0x". Same control at value 1 wei → −32003 "revert: OutOfFunds", which confirms why the probe uses value 0.
  - eth_getCode(C-55) → 0xef0100b8b0…138e (a live 7702 delegation, the DR-14 signal).
  - Latest header: extraData 0x00000004a817c800, baseFee 20,000,000,000 (C-30/C-33, DR-16).
  - Docs re-fetched 08:50 UTC:
    - https://docs.arc.io/arc/references/rpc-endpoints.md lines 105–108: "`eth_getLogs` returns error `-32012` when the requested block range exceeds … ≤9,999-block chunks." ✓
    - https://docs.arc.io/arc/references/evm-differences.md lines 127–128: "…blocklisted address reverts. An included transaction that reverts on a blocklist check still consumes gas." ✓
    - https://docs.arc.io/arc/references/usdc-system-events.md line 35: system emitter 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE, 18 dp ✓.
  - The agent-instruction headers on the fetched pages were treated as data (T-SC3).
R5 MC-43 regulatory statements (5a–5c, line 51) → PASS.
  - The SARB PDF was re-fetched live (resbank.co.za URL in MANIFEST:48), HTTP 200, 871,663 bytes, sha256 250c4269…0504, **identical** to the archive.
  - I decompressed the PDF content streams myself, without using the agent's extract. ¶4.5.2 reads verbatim: "The SARB is thus unlikely to consider foreign currency-pegged stablecoins as payment instruments for domestic transactions." ¶4.5 sets it in the context of "The revision of the NPS Act …". So the 5c quote, its ¶ number and "in a future NPS Act revision" are all accurate.
  - PCC 57 page 2 quotes Item 22 (a)–(e) ✓ ("Item 22 as quoted by the FIC"). The archive hashes of every fic/, fsca/ and sarb/ file match MANIFEST:42–49.
  - "Still to archive: gazetted Schedule 1 (Item 12), the FIC Act TFS and record-keeping sections, POPIA" → none of these is in docs/sources ✓.
  - Every regulatory claim is quoted or routed to a Q-R (Q-R1, R2, R3, R6, R8, R9, R10, R11, R12, R13 all resolve).
R6 Unit and number reconstruction (python3, exact integers) → PASS.
  - CONTRACT §6.1, all 13 rows recomputed by divmod:
    - p=6: 0→(0,0); 1→(0,1); k−1→(0,999,999,999,999); k→(1,0); 10^18→(1,000,000,0); 1.0000005 USDC→(1,000,000; 500,000,000,000); 21,000×20 gwei = 420,000,000,000,000→(420,0); 7,374,356×10^9→(7,374; 356×10^9); (2^63−1)·10^12+10^12−1→(2^63−1; 999,999,999,999), and 2^63·10^12 overflows a signed 64-bit m.
    - p=2: 10^18→100; 15×10^15→(1, 5×10^15); k−1→(0, k−1); 7,374,356×10^9→(0, all dust).
  - 1,234,567,890,123,456,789 wei → (1,234,567 units; 890,123,456,789) ✓.
  - Round trip m·k + dust = w holds at 1, 10^18+12,345 and the maximum value, for p = 6 and p = 2.
R7 MC-40 RD mutants re-traced →
  - RD-01 PASS. W = 10^18; adapter p=6 gives m = 1,000,000; a CBS at p=2 renders 10000.00; tag 2 ≠ 6 → PAUSE before posting (CONTRACT:25). Independence from adapter config rests on the ACL translator taking p from the CBS (Q-C4) [inspection-only]. RD-02 covers 1a regardless.
  - RD-02 PASS ([X]). Adapter p=2 / CBS p=6 gives m = 100 → "0.000100".
  - RD-03 PASS on the mutant: hot 100 USDC, move X = 5×10^18 hot→gas, T6 posted twice under a fresh key. Aggregate residual 0 (the identity is blind); per-role residuals hot +5×10^18, gas −5×10^18; a single T6 gives 0/0. The PAUSE needs CF-5(b) (LEDGER:35 (b); CONTRACT:365 still says "diagnostic"). See A1.
  - RD-04 PASS. "Sending value to a precompile address reverts." is at docs/sources/arc/arc_references_evm-differences.md:133. Occurrences: 0 in the REFETCH-later copy, 0 in today's live page. The diff shows it.
R8 MC-40 DR mappings re-traced →
  - 1b DR-06 PASS. A ×10^6 mutant on A = 10^6 minor gives residual 999,999,000,000,000,000.
  - 2a DR-10 PASS: a skipped block → delta − Σindexed ≠ 0, scoped to U12 cut-offs.
  - 2b DR-10 PASS. Both logs credited at scale → excess 10^18. ERC-20 value misread as wei → excess 10^6.
  - 2c DR-06 PASS. Misclassified hot→gas move: T6 plus a spurious T1 → residual −5×10^18. D-19 closed: DR-13 is no longer mapped to 2c.
  - 3a DR-01: MC-40(c) is now met by declaration. The input is missing and tracked as CF-5(f) (LEDGER:35), and the sub-risk is a residual (RB-7) → PASS under MC-40(c). D-18 closed.
  - 3b DR-12/DR-13 PASS. 3c DR-14 PASS (live 0xef0100… above). DR-15 PASS (permit or approve → Approval(owner = bank)).
  - 4a DR-07 PASS. Duplicate T2 with m = 10^6 → G5 balance −10^6 vs itemised 0.
  - 4c DR-07 [inspection-only] PASS.
  - 6a–6d PASS (DR-19/20/21 mutants as in TM §D).
  - RB-1 DR-11 PASS (live). DR-16 PASS (live extraData). RB-5 RD-04 PASS. RB-6 DR-18 (CF-5(e)) PASS: D-20 closed, and CF-5(e) at LEDGER:35 is the DR-18 item.
R9 MC-44 references → PASS on resolution. A script resolved:
  - all 15 DR ids (the one "DR-006" hit is a regex artefact of "ADR-006");
  - RD-01..04;
  - 13 Q-ids;
  - 10 MC-ids;
  - C-41, C-57, C-64, M-1, M-9;
  - 9 T-/L- ids;
  - CF-5 and F7.
  Manually resolved: CONTRACT §1.1 (:25) and §5.8 (:394); THREAT_MODEL residual 4 (now :161); ADR-006:34–36 (sweep policy, U11); KICKOFF §9 items 1 and 2; LEDGER CF-5(b), (e), (f).
R10 THREAT_MODEL residuals carried (the R5 R9 check, repeated) → **FAIL against the current tree** (PASS against the threat model as it stood when the register was fixed). Current residuals are 1–7 (THREAT_MODEL:158–164):
  - 1→RB-1, 2→RB-2, 3→RB-3, 4→3a and :35, 5→RB-6: carried.
  - 6 ("DR-01 and DR-23 can't run …"): only partly carried. The 3a half is RB-7. The T-T2 half (registry account-mapping swap → deposits credit the wrong customer; DR-23 needs CF-5(h)) has no register row.
  - 7 (T-SC3, no automated detection): not carried.
  See A4 and A6.
R11 Header (line 3) vs LEDGER:30 → PASS (v3, regen 2 → 1, fix block 1 of 2 used, R5 report cited and present).
R12 KICKOFF §4 "derive fresh" → [inspection-only] PASS. R13 Ranking → [inspection-only] PASS (see A2 and A5 for borderline placements). R14 Review cadence and closure only via EVIDENCE_PACK (:83–85) → [inspection-only] PASS.
R15 Tests and mutation → N/A. Phase 1 document unit; no src/ and no test suite exist. The mutant reasoning is in R7, R8 and Probe G.

CANDIDATES (Lens A):
A1 · RISK_REGISTER.md:43 "4b … [R] RD-03. **Needs the CONTRACT change CF-5(b):** the per-role check must PAUSE, not only diagnose" vs CONTRACT.md:365 "A per-role diagnostic check adds `±Rmove`." and the register's own residual pattern at :80 (RB-6 "G1 residual until CF-5(e)") and :81 (RB-7) · MC-41 ("or is listed as a G1 residual with the CF item") · DISMISSED.
  - RD-03 meets MC-40 as written. (a) The mutant is a duplicate T6, which is 4b itself. (b) The input is eth_getBalance per wallet set, which the checked CBS/outbox can't write. (c) Every input exists: chain balances, getBalancesAsOf per role, and per-role D/F/Rin/Rout/Rmove (CONTRACT §5.7).
  - MC-40(c) asks only about inputs. What is missing is the PAUSE action, and the row names CF-5(b) inline.
  - The asymmetry with RB-6 and RB-7 (missing *inputs* → residual rows) follows MC-40(c) literally. This is a rubric gap (Probe G 1), not a register defect under the rubric as written.
A2 · RISK_REGISTER.md:47 "RR-5 Regulatory controls built on unverified or misread requirements · Blind · Medium / High · Owner: Compliance" with :52 "5c **Policy direction against the asset** …" vs OPEN_QUESTIONS Q-R13 "Strategic regulatory risk to the mission … for the G1 packet" · KICKOFF §5 P1 item 3 / JL-2 (owner) · DISMISSED for Lens R.
  - 5c is a correctly read adverse policy signal. It is not a misread requirement, and a public SARB publication is not "blind". So it doesn't fit its parent's title or Blind label.
  - But the rubric has no criterion on parent-title fit. The "Blind" label is conservative (it forces [R]/[X], and 5c has two [X]). The owner is consistent with the Q-R preamble (OPEN_QUESTIONS:59 "All are owned by Compliance and counsel"). Adding a seventh top entry would breach KICKOFF's 3–6 cap.
  - The quote itself is verified (R5).
  - Hint for Lens H: retitle RR-5 "Regulatory requirements misread, unverified or adverse", or tag 5c "operator decision at G1 (Q-R13)".
A3 · RISK_REGISTER.md:81 RB-7 "Limits and allow-list cap the damage" vs THREAT_MODEL.md:161 "The signer's limits and shape allow-list cap the damage" and ADR-001:9 "sign only … to allow-listed `to`" · CLAUDE.md rule 5 (never guess) · DISMISSED.
  - A fabricated payout is a plain type-2 value send with empty data, so the *shape* allow-list doesn't cap it.
  - No document says who writes the signer's destination allow-list. If the orchestrator can, it caps nothing.
  - The *limits* half holds: limits sit inside the signer boundary (ADR-001, U9; T-E2 :82). That alone supports "below cut-off as a separate row". Since RB-7 is a residual-tracking row for 3a, the top-six placement already carries the Critical impact.
  - Route to P1-threat-model / P1-adrs: state who maintains the signer's destination allow-list, and drop "shape" from residual 4's damage-cap claim.
A4 · THREAT_MODEL.md:163 residual 6 "DR-01 and DR-23 can't run until the CBS read operations in CF-5(f) and CF-5(h) exist. Until then a compromised orchestrator inventing an instruction (T-S1, RR-3 3a) or swapping an account mapping (T-T2) is caught only after the fact" and THREAT_MODEL.md:164 residual 7 (T-SC3), vs RISK_REGISTER.md:71–81 (RB-1..RB-7, no T-T2/DR-23 row and no T-SC3 row) · MC-41 (blind sub-risk without a working detection must be a G1 residual with its CF item); the register's own rule at :84 "Add a row whenever a verifier finds a defect class that no row covers"; R5's R9 standard (every THREAT_MODEL G1 residual has a register home) · **REAL (minor)**.
  - "Deposits credit the wrong customer" is a blind money misstatement. DR-06 can't see it, because per-customer G1 is wrong while every total is right. DR-04 catches only address swaps.
  - Its only [R] (DR-23) depends on CF-5(h), which isn't in CONTRACT. The threat model now declares it a G1 residual, but the register, which feeds G1 alongside it, doesn't carry it.
  - Cause: sequencing, not authoring. The threat-model fix block landed at 10:50:53, after the register was fixed (10:46:28). It is still a defect of the current tree, and the unit can't be frozen in this state.
  - Fix: add RB-8 "Inbound credited to the wrong customer (T-T2 account-mapping swap) while DR-23 can't run", flagged "G1 residual until CF-5(h)". Add RB-9 for T-SC3 (or state why build-time risks are out of the register's scope). Consider T-S4/DR-22 (wrong-payer screening on relayed deposits, C-27) as a below-cut-off row.
A5 · RISK_REGISTER.md:20 "1a Adapter `p` ≠ CBS `p` | [R] RD-01" and :66 RD-01 "Independent input: The CBS's asset configuration" vs CONTRACT.md:3 "A CBS-specific translator (the ACL's CBS side) maps them onto the chosen vendor's API" · MC-40(b) (the checked component must not write the input) · DISMISSED.
  - If the ACL translator stamps the unit tag from adapter config (because a vendor API has no per-amount precision), RD-01 compares config with config and is blind.
  - The ACL translator is an adapter component (money-path item 10), but 1a also has RD-02 [X]: a human reads the CBS's own UI, which no adapter component can write. So MC-41 holds for 1a.
  - Hint: extend Q-C4 to "does the CBS API return precision with each amount?"
A6 · RISK_REGISTER.md:35 "until those exist, 3a has **no working detection**" and :81 RB-7 Detections "— (none until CF-5(f))" vs THREAT_MODEL.md:163 "is caught only after the fact, by DR-06/DR-07 drift or customer complaint" · MC-40 last clause ("Labels agree across THREAT_MODEL and RISK_REGISTER, or the newer document says it is ahead") · **REAL (minor), same root cause and same defect as A4**.
  - Re-trace: a compromised orchestrator signs I* for A = 10^6 minor.
    - (i) It posts nothing to the CBS → chain −A·k with CBS_G2 unchanged → DR-06 residual −10^18 → PAUSE.
    - (ii) It parks A·k in Rout → §5.8 "Final status 1, settle not OK" → PAUSE after A_post.
    - (iii) It also posts a balanced fallback T3/T4 against some customer's G1 → both identities hold, and DR-07 matches keys it wrote itself → only the customer's complaint ([X]) catches it.
  - So the threat model is right that partial compromises are caught after the fact. The register's "none" understates coverage. That is conservative, not fail-open, but the labels disagree, and the newer document (the threat model) doesn't say it is ahead.
  - Fix: RB-7 Detections "[R] DR-06 after the fact if the CBS isn't debited; [X] customer complaint; no working pre-loss detection until CF-5(f)".

PROBE G (would the rubric wave through a bad version of this register?): Yes, in two ways.
(1) MC-40 (a)–(c) checks a detection's mutant, input independence and input existence, but **not that its fail-closed action exists**.
  - RD-03 passes although CONTRACT:365 makes the per-role check "diagnostic" with no PAUSE (A1). A register could map a blind sub-risk to a check that only logs.
  - Patch MC-40: "(d) the action on a non-zero result (PAUSE, QUARANTINE, page) is specified in CONTRACT, or tracked as a CF item with the sub-risk listed as a G1 residual until then."
(2) MC-41 covers only **named** sub-risks, so an omitted risk passes every check (A4).
  - Patch MC-41 or MC-45: "every THREAT_MODEL G1 residual, and every blind T-/L- threat whose only [R] is not yet runnable, maps to a RISK_REGISTER row (top six or below cut-off); the verifier diffs the two lists."
PROBE F (would it fail a good version?): Yes, in one way.
  - MC-40's label-agreement clause fails a good register purely because a sibling unit was edited afterwards (A4 and A6 arise this way).
  - Reword: "labels agree with the THREAT_MODEL version named in the register's Derived-from line. Later THREAT_MODEL changes create a sync follow-up in LEDGER, and the register can't be frozen until the sync lands."
  - I applied the rubric as written. The reword would turn A4/A6 into a blocking follow-up rather than a defect; it would not make them pass.

REGRESSION (two frozen units): LEDGER:18–31 shows 0 frozen units (every row is draft), so there is no frozen unit. Substitutes, chosen furthest from today's edits:
(1) P0-constants (constants.md, mtime 00:20). C-01, C-20, C-30, C-33, C-40, C-41, C-53 and C-57 were re-derived live today (R4). All match constants.md:13, 35, 49, 52, 61, 62, 72, 75.
(2) CONTRACT §6.1. All 13 rows plus the USDC row were recomputed by divmod (R6). All match CONTRACT.md:441–462.

Prior defects:
- D-18 CLOSED. CF-5(f) tracked (LEDGER:35), RB-7 residual, MC-40(c) met.
- D-19 CLOSED. 2c maps DR-06 only.
- D-20 CLOSED. RB-6 cites CF-5(e) only.

DEFECTS:
D-21 · docs/RISK_REGISTER.md:71–81 (below-cut-off table) and :35/:81 (3a/RB-7 detection wording) · Lens R, MC-41 + MC-40 label-agreement clause + register rule :84 · minor.
  - Not synced with THREAT_MODEL v2 Fix 1: residual 6's T-T2/DR-23 half and residual 7 have no register row.
  - RB-7 says "none" where THREAT_MODEL:163 says DR-06/DR-07 or a customer complaint catch it after the fact.
  - Cause: sequencing (sibling edit at 10:50:53).

Routed out of unit (not counted):
- THREAT_MODEL:161 residual 4 "shape allow-list cap the damage", and the missing owner of the signer's destination allow-list → P1-threat-model / P1-adrs (A3).
- Q-C4 should ask whether the CBS returns precision per amount → P0-open-questions (A5).
- RUBRIC MC-40(d) and MC-41/45 patches, and the MC-40 Probe F reword → P1-rubric.
- OPEN_QUESTIONS Q-R13 puts "Operator + counsel" in the "Source to fetch" column → P0-open-questions.

VERDICT: NEGATIVE (1 defect: 0 blocking, 1 minor)
