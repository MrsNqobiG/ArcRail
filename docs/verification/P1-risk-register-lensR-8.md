VERIFICATION · lens: R (with the Lens A candidate, probe and regression sections the method requires) · target: P1-risk-register (docs/RISK_REGISTER.md v3 after fix block 3), R8 · commit: none (uncommitted working tree on main, no HEAD). Snapshot: RISK_REGISTER.md sha256 2b8b487d193587c7ac3cf1fa9511763e5f4e351c1f6b3c58dbe318caca1eed71, mtime 11:34:41 SAST. Run 2026-10-03 09:35-09:50 UTC.

Rubric applied: RUBRIC v2 after fix block 4 (mtime 11:24:48, older than the register), so MC-40 (a)-(f) and the MC-45 residual-match clause apply in full for the first time. Under the rubric's cut-off rule, the probe proposals below are dated after that rubric version. They go into the rubric queue and are not rubric defects. Sibling versions: THREAT_MODEL 11:13:20 and ADR-008 11:33:15 are older than the register; CONTRACT 11:34:19 has the same timestamp.

CHECKS:
R1 Top-entry count 3-6 (KICKOFF §5 P1 item 3) → PASS. Recounted by script: 6 `### RR-` headings; 25 sub-risks (1a-1c, 2a-2f, 3a/3d/3b/3c, 4a-4d, 5a-5c, 6a-6e); 10 RB rows (RB-10 is new); 4 RD rows, each defined once (:70-73).
R2 Every top entry has a detection; blind entries use [R]/[X] → PASS by label. Every sub-risk carries [R] or [X], or is routed to a named residual.
R3 Arc facts re-derived live, 2026-10-03 ~09:40 UTC, https://rpc.testnet.arc.io (MC-21) → PASS.
  - eth_chainId 0x4cef52 = 5,042,002 (C-01). Head 65,266,319.
  - Address-filtered eth_getLogs over a 10,000-block span → -32012 "requested range too large". Over a 9,999-block span → [] (C-40, 2a).
  - eth_call from 0x7099…79C8 (C-55) at value 0 → -32603 "Blocked address" (C-57, RB-1/DR-11).
  - Latest header: extraData 0x00000004a817c800 = 20,000,000,000; baseFee 20,000,000,000 (C-30/C-33, DR-16).
  - Pages re-fetched, all HTTP 200, 09:46 UTC:
    - https://docs.arc.io/integrate/exchanges/deposits.md:290 "`tx.from` is the relayer's address" (C-27, 2f) ✓
    - https://docs.arc.io/arc/concepts/opt-in-privacy.md:29 "Privacy features are on the roadmap and not yet available on Arc." (C-64, RB-2) ✓
    - https://docs.arc.io/arc/references/evm-differences.md: 0 occurrences of "Sending value to a precompile address reverts.", which is still at docs/sources/arc/arc_references_evm-differences.md:133 (RD-04 mutant reproduced) ✓
R4 Unit reconstruction (python3, exact integers) → PASS.
  - p=6 (k=10^12): 0→(0,0); 1→(0,1); 10^12−1→(0,999,999,999,999); 10^12→(1,0); 10^18→(1,000,000,0); 7,374,356,000,000,000→(7,374; 356,000,000,000); 1,234,567,890,123,456,789→(1,234,567; 890,123,456,789); (2^63−1)·10^12+10^12−1→(2^63−1; 999,999,999,999).
  - p=2 (k=10^16): 10^18→100; 15×10^15→(1, 5×10^15); 10^16−1→(0, all dust).
  - m·k + dust = w on every row.
R5 MC-43 regulatory statements (5a-5c) → PASS.
  - All 9 fic/, fsca/, sarb/ and popia/ hashes recomputed; each matches MANIFEST.
  - 5c quote found in the SARB extract: "4.5.2 Stablecoins … The SARB is thus unlikely to consider foreign currency-pegged stablecoins as payment instruments for domestic transactions. 4.5.3". It sits under ¶4.5 "The revision of the NPS Act will include provisions …" ✓
  - Archive-status claim at :54 matches MANIFEST:42-50. POPIA is archived and its text is not extractable (MANIFEST:50, Q-T8 at OPEN_QUESTIONS:103). MANIFEST has no Schedule 1 or FIC Act entry ✓. **R7 D-22 CLOSED.**
R6 MC-40 re-trace of the RD rows, including the new (e)/(f) →
  - RD-01 PASS. 10^18 wei at adapter p=6 → m = 1,000,000; a CBS at p=2 renders 10000.00; tag 2 ≠ 6 → PAUSE before posting.
    - (e) Two executors are named. ADR-008:61 maps the monitor's inputs (CBS responses; the configured `p` as subject).
    - (f) The PAUSE is in CONTRACT.md:25. 1a is a configuration bug, so the adapter-side gate is in-domain-acceptable.
    - The label disagreement with THREAT_MODEL:38 is declared ("This register is ahead on that point") and routed (LEDGER CF-11(b)). **R7 D-25 CLOSED.**
  - RD-02 PASS ([X]): adapter p=2 → 100 minor → a CBS at p=6 shows 0.000100.
  - RD-03 PASS on the mutant: hot 10^20 wei, move X = 5×10^18 hot→gas, T6 posted twice → per-role residuals +5×10^18 / −5×10^18, aggregate 0. The PAUSE is tracked as CF-5(b) (allowed by (f)).
  - RD-04 [inspection-only] PASS on the mutant (re-fetch above). Executor and action are resolved only through MC-21; see A6.
R7 MC-40 / MC-41, sub-risks changed by fix block 3 →
  - 2f PASS for MC-41: [P] U4 counts as [R] for the bug variant. DR-22's reference input is now tracked as CF-5(i) (ADR-008:22, OPEN_QUESTIONS Q-C18:57, LEDGER CF-9(d)). **R7 D-24 CLOSED.** But its residual pointer is wrong (D-27).
  - 6e PASS. "Valid only once CF-11(a)" plus RB-10 (G1 residual until CF-11(a)). LEDGER:41 CF-11(a) exists. **R7 D-23 CLOSED.**
R8 MC-40 (e)/(f) on every relied-upon detection of the top six →
  - 1b DR-06, 2c DR-06, 4a/4c DR-07, 3b DR-13: monitor (THREAT_MODEL:38). Actions are in CONTRACT §5.7 ("Any failure → PAUSE") and §5.0 (drift cell → PAUSE). PASS.
  - 3b DR-12: CONTRACT:331 → PASS.
  - 3a DR-01 and 3d DR-25: monitor; PAUSE by signer-enforced attestation (ADR-008:83). PASS, residual until CF-5(f).
  - 2a/2b/2d DR-10, 3c DR-14/DR-15, 6c DR-21: monitor. PAUSE appears in THREAT_MODEL §D, not in the CONTRACT tables. Counted as PASS on the reading that the PAUSE action is CONTRACT §1.6 (A7).
  - **6a DR-19 and 6b DR-20: FAIL.** No action is specified anywhere (D-26).
  - 2e DR-23: residual until CF-5(h) (RB-7). Its QUARANTINE domain is discussed at A5.
R9 MC-44 references → PASS on resolution, one content FAIL (D-27).
  - Script-resolved: every DR id against THREAT_MODEL §D; RD-01..04; Q-A14, A16, C10, R1, R2, R3, R6, R8, R9, R10, R11, R12, R13, T3, T8; MC-01, 02, 08, 15, 21, 23, 24, 32, 34, 40, 41, 43; C-27, C-41, C-57, C-64, M-1, M-9.
  - CF-5(b), (e), (f), (g), (h) resolve in LEDGER:37; CF-5(i) at LEDGER:40; CF-11(a)/(b) at LEDGER:41.
R10 MC-45 residual lists, THREAT_MODEL:171-181 vs the register →
  - Residuals 1→RB-1, 2→RB-2, 4→3a/RB-7, 5→RB-6, 6→RB-7, 7→RB-8 and 8→RB-9 agree.
  - The wording differences in residual 4 (allow-list) and residual 6 (replay) are routed as CF-11(c)/(d).
  - **FAIL: RB-10 and the widened RB-3 have no THREAT_MODEL counterpart** (D-28).
R11 Header :3 vs LEDGER:32 → [inspection-only] PASS. Fix blocks 1-3 are stated; LEDGER says "Fix 3 (CF-5(i), CF-11, RB-10) · R8 pending". The header cites the R5 and R6 report paths but not -lensR-7.md (A9).
R12 KICKOFF §4 "derive fresh", ranking, and review cadence (:90-92) → [inspection-only] PASS.
R13 Judgment lenses → [inspection-only].
  - JL-1 PASS, except 6a/6b, which have no fail-closed action (D-26).
  - JL-2 PASS: an owner for every top entry.
  - JL-6 PASS: RR-6 covers 6a-6e.
R14 Tests and mutation → N/A. This is a Phase 1 document unit with no src/ and no test suite. Mutant reasoning is in R6, R8 and A4-A5.

CANDIDATES (Lens A):
A1 · RISK_REGISTER.md:60-61 "6a PII or address↔account links in logs or telemetry | [R] DR-19" / "6b Bank address leaked to a third-party RPC | [R] DR-20" vs THREAT_MODEL.md:158 "… → the canary pair is found" and :159 "… → address found in the request" (ADR-008:53-54 give inputs only; CONTRACT has no DR-19/DR-20 trigger) · MC-40(f) "its fail-closed action is specified in CONTRACT (or tracked as a CF item)" → MC-41 · **REAL (minor)**.
  - Both are the sole detection of a blind sub-risk.
  - Neither names any action: no PAUSE, QUARANTINE, page or case. This is exactly the "check that only logs" case that risk-register R6 Probe G(1) introduced (f) for.
  - No CF item tracks it, and 6a/6b aren't listed as residuals.
A2 · RISK_REGISTER.md:32 "… **needs CF-5(i)**; until then 2f relies on [P] U4 relayed-transfer fixtures (RB-7)" vs :85 RB-7 "A compromised adapter fabricates an instruction (RR-3 3a), replays an approval (3d) or swaps an account mapping (2e) **while DR-01, DR-25 and DR-23 can't run** (CF-5(f), CF-5(h)) … **G1 residual** until CF-5(f), CF-5(h) and Q-C10" · MC-44 (the reference must say what the citing text claims), MC-41 (the residual must name the CF item that closes it) · **REAL (minor)**.
  - RB-7 doesn't mention 2f, DR-22 or CF-5(i).
  - Its closure condition would retire the residual even if CF-5(i) were never delivered.
A3 · RISK_REGISTER.md:87 "RB-10 | Registry theft (6e) while DR-26 can't run cleanly (CF-11(a)) … **G1 residual** until CF-11(a)" and :81 RB-3 "Arc Foundry (T-SC1) and arc-node … (T-SC4, Q-A16) … **G1 residual** until Q-T3 and Q-A16" vs THREAT_MODEL.md:173 "3. **T-SC1** stays open until Q-T3 is answered." (THREAT_MODEL has no residual for registry theft or T-SC4) · MC-45 "The residual lists of THREAT_MODEL and RISK_REGISTER match each other" · **REAL (minor)**.
  - The register is the newer document. Unlike the RD-01 case (:70), it doesn't say it is ahead on these residuals.
  - CF-11(a)-(d) (LEDGER:41) don't route the residual additions to THREAT_MODEL.
A4 · RISK_REGISTER.md:21 "1b Wrong conversion within a consistent `k` | [R] DR-06" vs CLAUDE.md "Conversions happen in exactly one module" and CONTRACT.md:25 "both of its sides use the same `k`" · MC-40(b)/MC-41 · DISMISSED.
  - Recomputed: a global k' = 10^6 shared by U1 and the monitor gives m = 10^12 and a monitor-side CBS_G2·k' = 10^18 = chain → residual 0, so DR-06 misses that variant.
  - But MC-40 requires one named mutant. The named single-expression mutant is caught (A = 10^6 minor → residual 999,999,000,000,000,000). 1c's [P] U1 oracle and RD-02 catch the global variant.
  - This is a rubric gap (Probe G 1), not a register defect.
A5 · RISK_REGISTER.md:31 "2e … [R] DR-23 (in the monitor; **needs CF-5(h)**, until then RB-7)" vs THREAT_MODEL.md:161 DR-23 "→ mismatch → QUARANTINE" and CONTRACT.md:126 (a QUARANTINE stops the item in the adapter; ADR-008:83 attestations carry only ALL_CLEAR/PAUSE) · MC-40(f) "a detection of adapter compromise can't rely on a PAUSE the adapter enforces" · DISMISSED for this unit.
  - 2e is currently a residual (RB-7), so MC-41 holds today.
  - Once CF-5(h) lands, DR-23's QUARANTINE would be enforced by the compromised adapter. The monitor's escalation to PAUSE comes only after `A_quarantine` (4 h).
  - Closure needs EVIDENCE_PACK evidence (:92), so the residual can't lapse silently.
  - Routed to P1-threat-model: DR-23 should PAUSE through the attestation.
A6 · RISK_REGISTER.md:73 RD-04 "Re-fetch every cited page and diff against `docs/sources/` at every gate (MC-21)" · MC-40(e) (executor named, input set) and (f) (action in CONTRACT) · DISMISSED.
  - Executor and action resolve through the cited MC-21 ("The verifier re-fetches every quote … reverts the fact to UNVERIFIED with an open question").
  - Doc drift has no CONTRACT action and no ADR-008 input set. A literal fail here would be a Probe F case.
A7 · RISK_REGISTER.md:27 "2a … [R] DR-10" vs CONTRACT.md:133 "Triggers for PAUSE are named in the tables" (no DR-10, DR-14, DR-15 or DR-21 trigger in any CONTRACT table) · MC-40(f) · DISMISSED for this unit.
  - THREAT_MODEL §D:149 specifies "→ PAUSE", and the PAUSE action is defined at CONTRACT §1.6.
  - The incomplete trigger list is a CONTRACT matter. Route it with CF-9(a): CONTRACT §1.6 should list or refer to the monitor's §D triggers.
A8 · LEDGER.md:37 CF-5 lists only (a)-(h), while RISK_REGISTER.md:32 cites "CF-5(i)" · MC-44 · DISMISSED. CF-5(i) is defined at LEDGER:40 (CF-9(d)), OPEN_QUESTIONS Q-C18 and ADR-008:22. It resolves, and the gap is ledger bookkeeping.
A9 · RISK_REGISTER.md:3 "**Fix blocks 1, 2 and 3 applied** after R5, R6 and R7 (`docs/verification/P1-risk-register-lensR-5.md`, `-lensR-6.md`)", plus RB-10 sitting before RB-9 (:87-88) · MC-44 · DISMISSED. Every cited path resolves, and the -lensR-7.md report exists. The missing citation and the row order are Lens H polish.

PROBE G (would the rubric wave through a bad version of this register?): Yes, in two ways.
(1) MC-40(b) protects reference inputs from a *compromised* component, but not from **shared code**. CLAUDE.md mandates one conversion module, so a monitor that converts through U1 inherits a global-k bug. DR-06 is then blind to it, yet 1b passes (A4).
  - Patch MC-40(b): "a reference computation must not import the module under check; any shared constant (for example k) is re-derived from its source."
(2) MC-40(f) speaks only of a PAUSE. A detection that answers adapter compromise with an item **QUARANTINE** passes, although only the adapter enforces it (A5).
  - Patch: "PAUSE or QUARANTINE".

PROBE F (would it fail a good version?): Yes. Read literally, MC-40(e)/(f) fail good detections whose executor is a gate-time verifier or a human, such as RD-04 and RD-02, because they have no ADR-008 input set and no CONTRACT action. They also fail monitor detections whose trigger is in THREAT_MODEL §D while the action (PAUSE) is defined in CONTRACT §1.6 (A6, A7).
  - Reword: "action specified in CONTRACT, THREAT_MODEL §D or RUBRIC, with PAUSE/QUARANTINE as defined in CONTRACT §1.6; executors include CI, verifier and human-at-gate, with their inputs listed in the detection row."

(Both probes are dated after RUBRIC v2 fix block 4. Under its cut-off rule they are queued, not counted as rubric defects.)

REGRESSION (two frozen units): LEDGER:20-33 shows 0 frozen units. Substitutes were chosen for the oldest mtimes, furthest from today's 11:3x edits.
(1) P0-constants (constants.md, 00:20). C-01 (:13), C-27 (:42), C-30/C-33 (:49, :52), C-40 (:61), C-57 (:75) and C-64 (:90) were re-derived live today (R3), and all match. No regression.
(2) P1-sequences (SEQUENCES.md, 2026-10-02 23:23). No regression.
  - :48 "range of 9999 blocks max": 9,999 accepted, 10,000 rejected live.
  - :52 "dedupe on (chainId, txHash, logIndex). Ignore ERC-20 0x3600 log": consistent with C-22 and with 2b's DR-10 trace.
  - :131 "maxFeePerGas at least 20 gwei … chainId 5042002": live baseFee 20,000,000,000 and chainId 0x4cef52.

Prior defects: D-22, D-23, D-24 and D-25 are CLOSED (R5, R7, R6 above).

DEFECTS:
D-26 · docs/RISK_REGISTER.md:60-61 (6a → DR-19, 6b → DR-20) · Lens R, MC-40(f) → MC-41 · minor.
  - The sole detections of two blind sub-risks specify no fail-closed action anywhere (THREAT_MODEL:158-159, ADR-008:53-54, CONTRACT). No CF item tracks it.
  - Fix: route a CF item to P1-threat-model/CONTRACT (for example: page Security, open a case, QUARANTINE the emitting component or route). In the register, mark 6a/6b "valid once CF-x", with a residual until then.
D-27 · docs/RISK_REGISTER.md:32 vs :85 · Lens R, MC-44/MC-41 · minor. 2f defers to RB-7, but RB-7 covers neither 2f, DR-22 nor CF-5(i), and would close without CF-5(i).
  - Fix: add 2f/DR-22/CF-5(i) to RB-7 and to its closure condition (or create a separate RB row).
D-28 · docs/RISK_REGISTER.md:81, :87 vs THREAT_MODEL.md:171-181 · Lens R, MC-45 · minor. RB-10 (registry theft until CF-11(a)) and RB-3's T-SC4/Q-A16 half have no THREAT_MODEL residual. The register neither says it is ahead nor routes the additions.
  - Fix: either state "ahead" and extend CF-11 with "(e) add residuals for 6e/RB-10 and T-SC4", or align the lists.

Routed out of unit (not counted): DR-23's QUARANTINE domain (A5) → P1-threat-model. CONTRACT §1.6 trigger list (A7) → CF-9(a). The CF-5(i) letter in the CF-5 bullet (A8) → LEDGER. Probes G(1)-(2) and F → P1-rubric queue.

VERDICT: NEGATIVE (3 defects: 0 blocking, 3 minor)
