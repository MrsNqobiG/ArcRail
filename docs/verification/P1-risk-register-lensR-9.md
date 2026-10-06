VERIFICATION · lens: R (with the Lens A candidate, probe and regression sections the method requires) · target: P1-risk-register (docs/RISK_REGISTER.md v3 after fix block 4), R9 · commit: none (uncommitted working tree on main, no HEAD). Snapshot: RISK_REGISTER.md sha256 10a99078e3df4ec4aec88b6d476a69d80ff19f45a014e028bd9c6b5b6d66c47c, mtime 11:49:23 SAST. Run 2026-10-03 ~09:50-10:05 UTC.

Versions compared: RUBRIC v2 after fix block 5 (11:42:21) applies in full, including the new MC-40(f) clause "with the sub-risk listed as a G1 residual until then". Siblings are all OLDER than the register: THREAT_MODEL 11:45:44 (v2 fix 3), ADR-008 11:44:08, CONTRACT 11:48:57, LEDGER 11:49:23. Under the MC-40 label clause, where the register disagrees with them and doesn't say it is ahead, the register is the defective document.

CHECKS:
R1 Top-entry count 3-6 (KICKOFF §5 P1 item 3) → PASS. Recounted by script: 6 `### RR-` headings, 25 sub-risks (1a-1c, 2a-2f, 3a/3d/3b/3c, 4a-4d, 5a-5c, 6a-6e), 11 RB rows (RB-1 to RB-11), and 4 RD rows, each defined once (:70-73).
R2 Every top entry has a detection. Blind entries use [R]/[X] → PASS by label. One MC-40 validity failure is listed separately (R8, D-33).
R3 Arc facts re-derived live on 2026-10-03 at ~09:50 UTC against https://rpc.testnet.arc.io (MC-21) → PASS.
  - eth_chainId 0x4cef52 = 5,042,002 (C-01).
  - Exact eth_getLogs boundary: to−from = 9,999 (10,000 blocks inclusive) → []; to−from = 10,000 → -32012 "requested range too large". This is consistent with C-40 "≤9,999" read as to−from, and with 2a.
  - eth_call from 0x7099…79C8 (C-55) with value 0 → -32603 "Blocked address" (C-57, RB-1/DR-11).
  - Latest header: extraData 0x00000004a817c800 = 20,000,000,000; baseFee 20,000,000,000 (C-30/C-33, DR-16).
  - 0x3600… decimals() = 6 (C-11).
  - Pages re-fetched, all HTTP 200:
    - rpc-endpoints.md:106-108/:118 (10,000-block limit, ≤9,999 chunks) ✓
    - deposits.md:290 "`tx.from` is the relayer's address" (C-27, 2f) ✓
    - opt-in-privacy.md:29 "Privacy features are on the roadmap and not yet available on Arc." (C-64, RB-2) ✓
    - usdc-system-events.md:35/:39 (emitter 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE; "emits **two** logs") ✓
    - evm-differences.md: "Sending value to a precompile address reverts." 0 occurrences live vs docs/sources/arc/arc_references_evm-differences.md:133 (RD-04 mutant reproduced) ✓
R4 Unit reconstruction (python3, exact integers) → PASS.
  - p=6, k=10^12:
    - 0→(0,0); 1→(0,1); 10^12−1→(0,999,999,999,999); 10^12→(1,0); 10^18→(1,000,000,0)
    - 1,000,000,500,000,000,000→(1,000,000; 500,000,000,000); 7,374,356,000,000,000→(7,374; 356,000,000,000)
    - (2^63−1)·10^12+10^12−1→(9,223,372,036,854,775,807; 999,999,999,999)
  - p=2, k=10^16: 10^18→100; 15×10^15→(1; 5×10^15); 10^16−1→(0; all dust); 7,374,356,000,000,000→(0; all dust).
  - m·k + dust = w on every row. Every row matches CONTRACT §6.1 (:497-520).
R5 MC-43 for 5a-5c → PASS.
  - All 9 fic/, fsca/, sarb/ and popia/ hashes were recomputed, and each matches MANIFEST.
  - The 5c quote was found after whitespace normalisation (the extractor splits words) in the SARB extract under ¶4.5.2: "…the SARB is thus unlikely to consider foreign currency-pegged stablecoins as payment instruments for domestic transactions".
  - The POPIA "archived, not extracted" status (MANIFEST, Q-T8) and "Still to archive: Schedule 1, FIC Act" (no MANIFEST entry) are correct.
R6 MC-40 re-trace of the RD rows →
  - RD-01 PASS on the mutant. 10^18 wei at adapter p=6 → m=1,000,000. A CBS at p=2 renders 10000.00. Tag 2 ≠ 6 → PAUSE before posting (CONTRACT.md:25). The row's claim about THREAT_MODEL is now false (D-30).
  - RD-02 PASS ([X]): adapter p=2 → m=100 → a CBS at p=6 shows 0.000100.
  - RD-03 PASS on the mutant: hot 10^20, move X=5×10^18 hot→gas, T6 posted twice → per-role residuals hot +5×10^18, gas −5×10^18, aggregate 0. MC-40(f) residual clause FAILS (D-31).
  - RD-04 [inspection-only] PASS on the mutant (live diff above). Executor and action come through MC-21.
R7 MC-40(e)/(f) and MC-41 for every relied-upon detection →
  - 1b/2c DR-06, 4a/4c DR-07, 3b DR-12/DR-13, 2a DR-10, 3c DR-14/15, 6c DR-21, 6e DR-26: the executor is the monitor (THREAT_MODEL:46). The action is a monitor PAUSE through the attestation (THREAT_MODEL:52, ADR-008:79-90). The dead-man stop is ADR-008:87. PASS on (e)/(f).
  - 3a DR-01, 3d DR-25, 2e DR-23, 2f DR-22: needs CF-5(f)/(h)/(i). RB-7 is the G1 residual and its closure condition names CF-5(f), (h) and (i) plus Q-C10 → PASS. 3a's own text is stale (D-29).
  - 6a DR-19 and 6b DR-20: the actions are tracked as CF-13(a) (LEDGER:50) with RB-11 as the G1 residual until CF-13(a) → PASS. **R8 D-26 CLOSED.**
  - 4b RD-03: the action is tracked as CF-5(b). CONTRACT.md:418 is still "A per-role diagnostic check adds `±Rmove`". No G1 residual lists 4b → FAIL (D-31).
  - 2c DR-06: no named mutant is an instance of 2c → FAIL on MC-40(a) (D-33). Re-traced by hand: a hot→collection move of X misclassified as inbound posts a spurious T1 → CBS_G2·k rises by X while Σchain(S) is unchanged → residual −X → PAUSE. The detection is sound; the named mutant is missing.
R8 MC-40(a) mutant-to-sub-risk, every mapping → FAIL on 2c only (D-33).
  - 2b relies on [P] MC-15 (U4 is money-path item 2). 2d relies on [X] CHANGELOG. DR-10 is supplementary for both.
  - 4c is judged non-blind (CONTRACT §5.8:474 "Final status 1, settle not OK … A_post 15 min → PAUSE"). See A4.
R9 MC-44 references → PASS on resolution, FAIL on content (D-29, D-30, D-32).
  - Script-resolved: every DR id against THREAT_MODEL §D; RD-01..04; Q-A14, A16, C10, R1-R3, R6, R8-R13, T3, T8; MC-01, 02, 08, 15, 21, 23, 24, 32, 34, 40, 41, 43; C-27, C-41, C-57, C-64, M-1, M-9; T-/L- ids; CF-5(b),(e)-(i), CF-11(a)/(b), CF-13(a)/(b).
  - (The script's DR-006/DR-008 hits are regex matches inside "ADR-006"/"ADR-008", not references.)
R10 MC-45 residual lists, THREAT_MODEL:183-194 vs the register →
  - These agree: 1→RB-1, 2→RB-2, 4→3a/RB-7, 5→RB-6, 7→RB-8, 8→RB-9.
  - RB-3 (T-SC4) and RB-11 are declared "ahead" (:70) and routed (CF-13(b)) → PASS. **R8 D-28 CLOSED** for those.
  - RB-10 depends on CF-11(a), which THREAT_MODEL has since delivered (D-30).
  - **FAIL:** RB-7 now covers 2f/DR-22/CF-5(i), which residual 6 doesn't, yet it still says "Matches THREAT_MODEL residual 6" (D-32).
R11 Header :3 vs LEDGER:32 → [inspection-only] PASS on content ("Fix blocks 1 to 4 applied after R5 to R8"). A duplicated stale parenthetical is left over (A6).
R12 KICKOFF §4 "derive fresh", ranking and review cadence (:91-93) → [inspection-only] PASS.
R13 Judgment lenses → [inspection-only].
  - JL-1 PASS, except 4b, which has no stop and no residual until CF-5(b) (D-31).
  - JL-2 PASS: an owner for every top entry.
  - JL-6 PASS: RR-6 covers 6a-6e, with routed actions.
R14 Tests and mutation → N/A. This is a Phase 1 document unit with no src/ and no test suite. Mutant reasoning is in R4, R6, R7 and A1-A8.

CANDIDATES (Lens A):
A1 · RISK_REGISTER.md:37 "**Needs CF-5(f)** (`listPayoutInstructions`, `listApprovals`). Until then there is **no [R] detection**" vs THREAT_MODEL.md:153 DR-01 "**Needs CF-5(f) and CF-5(i)**; can't run until then (residual 6)", ADR-008:48 (DR-01 reference inputs include "**case dispositions**"), and LEDGER.md:53 "RISK_REGISTER RR-3 3a and RB-7 must also list CF-5(i)" · MC-40(c) and the label clause (newer document disagrees without saying it is ahead), MC-44 · **REAL (minor)**.
  - The CF item routed *to this register* was applied to RB-7 (:85) but not to 3a.
  - Minor, because RB-7's closure condition includes CF-5(i), so the residual can't lapse early.
A2 · RISK_REGISTER.md:70 "THREAT_MODEL lists only (2); routed as CF-11(b). This register is ahead on that point." vs THREAT_MODEL.md:46 "Monitor: … RD-01 (its own check)" and :48 "Adapter: … RD-01 (its pre-posting gate)". Also RISK_REGISTER.md:64 "**Valid only once CF-11(a)** defines its healthy signal and excludes the honeytoken rows …" and :87 "RB-10 | Registry theft (6e) while DR-26 can't run cleanly (CF-11(a))" vs THREAT_MODEL.md:177 DR-26 "The monitor excludes them from its own scans (DR-04, DR-23, DR-24) … Healthy: zero such reads" · MC-44 (the claim about the cited section is false), MC-40 label clause, MC-45 · **REAL (minor)**.
  - Threat-model fix 3 (11:45:44) delivered CF-11(a) and (b) before register fix 4 (11:49:23). The register still says it is ahead on (b) and still holds 6e as a residual awaiting (a).
  - CF-13(b) therefore asks THREAT_MODEL to add a residual (RB-10) that no longer has a cause.
A3 · RISK_REGISTER.md:47 "4b Duplicate T6 … | [R] RD-03. **Needs the CONTRACT change CF-5(b):** the per-role check must PAUSE, not only diagnose" and :72 "Any residual → PAUSE (CF-5(b))" vs CONTRACT.md:418 "A per-role diagnostic check adds `±Rmove`." (still diagnostic) and RUBRIC.md:80 MC-40(f) "or tracked as a CF item, **with the sub-risk listed as a G1 residual until then**" · MC-40(f) → MC-41 · **REAL (minor)**.
  - No RB row (:79-89) names 4b, RD-03 or CF-5(b).
  - 4b is blind: the duplicate is invisible to the aggregate identity (re-traced in R6, aggregate 0) and no other detection is mapped to it.
  - The fix-block-5 clause predates this register version.
A4 · RISK_REGISTER.md:29 "2c Misclassification (internal move booked as inbound) | [R] DR-06 over all bank wallets." vs THREAT_MODEL.md:158 DR-06's only mutant "Conversion uses ×10⁶ instead of ×10¹² → CBS_G2×k ≠ chain" and RUBRIC.md:80 "(a) **the mutant is an instance of the sub-risk it is mapped to** … A shared mutant is acceptable if it is an instance of every sub-risk it is mapped to" · MC-40(a) → MC-41 · **REAL (minor)** for 2c.
  - RR-2 is "Blind" and DR-06 is 2c's sole detection, so it is relied upon. The ×10⁶ mutant is an instance of 1b, not of misclassification.
  - The substance holds: re-traced in R7, the residual is −X.
  - **DISMISSED for 4c → DR-07** (named mutant is a duplicate T2, an instance of 4a). 4c is non-blind, because unresolved ambiguous outcomes expire to PAUSE under CONTRACT §5.8 (:452, :473-474), so MC-41 doesn't require an [R] detection there.
A5 · RISK_REGISTER.md:85 RB-7 "… **or a relayed deposit is misattributed (2f)**, **while DR-01, DR-25, DR-23 and DR-22 can't run** (CF-5(f), CF-5(h), CF-5(i)) … Matches THREAT_MODEL residual 6" vs THREAT_MODEL.md:189 "6. **DR-01, DR-23 and DR-25 can't run** until …" (no DR-22, no 2f/T-S4). The "ahead" note at :70 lists only "RB-3's arc-node half …, RB-10 and RB-11", and LEDGER.md:50 CF-13(b) routes only those three · MC-45 "residual lists … match each other", MC-44 (the "Matches" claim is false) · **REAL (minor)**.
  - This is a regression introduced by fix block 4's D-27 fix: the same class as R8 D-28.
A6 · RISK_REGISTER.md:3 "… (`docs/verification/P1-risk-register-lensR-5.md` … `-lensR-8.md`) (`docs/verification/P1-risk-register-lensR-5.md`, `-lensR-6.md`)." The second parenthetical is a stale duplicate · MC-44 · DISMISSED. Every path resolves (all four reports exist). This is Lens H polish.
A7 · RISK_REGISTER.md:61 "the Security egress proxy **blocks** any request …" vs THREAT_MODEL.md:172 DR-20 "→ alert", and MC-40(f) "Enforcement fails closed when the executor goes silent" (CF-13(a) at LEDGER:50 says nothing about a silent proxy or scanner) · MC-40(f) · DISMISSED for this unit.
  - The disagreement is the declared routing (CF-13(a)), and RB-11 holds the residual until then, so MC-41 is met.
  - Routed note to P1-threat-model: when CF-13(a) is applied, state silent-executor behaviour for the DR-19 scanner (sink held if the scan is stale) and for the DR-20 proxy (inline, so silent means blocked).
A8 · RISK_REGISTER.md:42/:34 RR-3 and RR-4 "Partly blind", with no blind/non-blind marking per sub-risk, vs RUBRIC MC-41 "Every named **blind** sub-risk" · MC-41 · DISMISSED as a register defect.
  - Every sub-risk under RR-3/RR-4 except 4c (A4) and 4d ([X] contract tests) does carry [R], [X] or a residual, so no sub-risk is uncovered.
  - The rubric gap goes to Probe G(2).
A9 · LEDGER.md:51 "~~CF-10, CF-11~~ CLOSED by threat-model v2 Fix 3" while :52-53 still list CF-11 and CF-10 as open. LEDGER.md:35-41: the queue has no entries for the risk-register R8, contract R7, ADR-008 R3 or threat-model R6 probe proposals, all dated after rubric fix block 5 · MC-44 · DISMISSED for this unit. This is LEDGER and P1-rubric bookkeeping, routed there.

PROBE G (would the rubric wave through a bad version of this register?): Yes.
(1) MC-40 sets validity conditions only for [R]. MC-41 accepts any [X] for a blind sub-risk with no owner, cadence, input or action. The register shows this:
  - 2d "[X] arc-node CHANGELOG / BREAKING_CHANGES" (:30) and RB-7 "[X] Customer statements and complaints only" (:85) name nobody who watches, how often, or what happens on a finding.
  - A bad register could satisfy MC-41 everywhere with "[X] external audit".
  - Patch: "an [X] detection relied on for MC-41 meets MC-40 (c), (e) and (f): a named owner, a cadence, an existing input, and an action on a finding".
(2) MC-41 bites only on "named blind sub-risks", but blindness is labelled only per entry ("Partly blind", A8). A register could label every entry "Partly blind" and leave MC-41 nothing to check.
  - Patch: "blindness is labelled per sub-risk".
(3) The MC-40 label clause compares "at the same document versions" but defines no version identifier. The register cites "THREAT_MODEL v2" (:11) while THREAT_MODEL v2 has had three fix blocks. That is how D-30's stale "ahead" claim survives.
  - Patch: "Derived-from lines name each sibling to fix-block granularity, and every claim of the form 'X lists only …', 'ahead of X', 'matches X residual n' is re-checked against that version (MC-44)".

PROBE F (would it fail a good version?): Yes. MC-40(f)'s "with the sub-risk listed as a G1 residual until then" applies even when the CF item is a documentation edit between Phase 1 documents (CF-11(a), CF-13(a)). The forced residual must then be mirrored into THREAT_MODEL (MC-45, CF-13(b)), and removed from both once the sibling fix lands. A2 shows this churn: RB-10 is now a residual without a cause.
  - A good register that routed a doc-only CF item, and left LEDGER to track it, would fail.
  - Reword: "a G1 residual is required when the CF item needs a capability outside the Phase 1 documents (a CBS operation, a vendor answer, code), or is still open at G1. Doc-only CF items between Phase 1 documents are tracked in LEDGER and must be closed before G1."
(All three Probe G items and the Probe F item are dated after RUBRIC v2 fix block 5. Under the cut-off rule they go into the rubric queue and are not rubric defects.)

REGRESSION (two frozen units): LEDGER:20-33 shows 0 frozen units. Substitutes were chosen for the oldest mtimes, furthest from the 11:4x edits.
(1) P0-constants (constants.md, 00:20, sha256 e494e772…). Re-derived live today (R3): C-01, C-11 (decimals 6), C-20 (emitter on usdc-system-events.md:35), C-22 (two logs, :39), C-27, C-30/C-33, C-40 (exact boundary), C-57 and C-64 all match. No regression.
(2) P1-sequences (SEQUENCES.md, 2026-10-02 23:23, sha256 660310b6…). No regression.
  - :48 "range of 9999 blocks max": live, to−from 9,999 is accepted and 10,000 is rejected.
  - :52 "dedupe on (chainId, txHash, logIndex). Ignore ERC-20 0x3600 log for credit (C-22)" agrees with the live two-log text.
  - :131 "maxFeePerGas at least 20 gwei … chainId 5042002" agrees with live baseFee 20,000,000,000 and chainId 0x4cef52.

Prior defects:
- D-26 is CLOSED: CF-13(a) plus RB-11.
- D-27 is CLOSED: RB-7 now names 2f, DR-22 and CF-5(i) and closes on them. Its "Matches residual 6" tail is new defect D-32.
- D-28 is CLOSED for RB-3 and RB-11. The RB-10 part is superseded by D-30.

DEFECTS:
D-29 · docs/RISK_REGISTER.md:37 (3a "Needs CF-5(f)" only) · Lens R, MC-40(c) and label clause, MC-44 · minor.
  - Fix: "Needs CF-5(f) and CF-5(i)" (case dispositions), as LEDGER CF-10 requires.
D-30 · docs/RISK_REGISTER.md:70 ("THREAT_MODEL lists only (2) … This register is ahead on that point"), :64 and :87 (6e/RB-10 waiting on the already-delivered CF-11(a)) · Lens R, MC-44, MC-45 · minor.
  - Fix: re-sync with THREAT_MODEL v2 fix 3. Drop the RD-01 "ahead" sentence. Mark 6e/DR-26 valid. Retire RB-10 (or re-base it on a cause that still holds). Withdraw RB-10 from CF-13(b).
D-31 · docs/RISK_REGISTER.md:47 and :72 (4b relies on RD-03, whose PAUSE is only tracked as CF-5(b)), with no G1 residual among :79-89 · Lens R, MC-40(f) → MC-41, JL-1 · minor.
  - Fix: add an RB row, or extend an existing one: "duplicate T6 undetected while the per-role check is diagnostic; G1 residual until CF-5(b)". Mirror it to THREAT_MODEL, or declare it ahead and route it.
D-32 · docs/RISK_REGISTER.md:85 (RB-7 "Matches THREAT_MODEL residual 6", yet it adds 2f/DR-22/CF-5(i), which residual 6 lacks) · Lens R, MC-45, MC-44 · minor.
  - Fix: declare the register ahead on 2f in the "ahead" note, and extend CF-13(b) so residual 6 gains DR-22/2f (or align the wording).
D-33 · docs/RISK_REGISTER.md:29 (2c relies solely on DR-06, whose only named mutant, THREAT_MODEL.md:158, is a conversion error, an instance of 1b) · Lens R, MC-40(a) → MC-41 · minor.
  - Fix: name a 2c mutant for the DR-06 mapping, for example "hot→collection move X booked as T1 → residual −X → PAUSE". Either route it to THREAT_MODEL as a second DR-06 mutant (CF item) or note it in the 2c row.

Routed out of unit (not counted):
- Silent-executor behaviour for DR-19/DR-20 when CF-13(a) is applied (A7) → P1-threat-model.
- CF-10/CF-11 struck and unstruck duplicates, and the missing queue entries for risk-register R8, contract R7, ADR-008 R3 and threat-model R6 (A9) → LEDGER and P1-rubric.
- Probes G(1)-(3) and F → P1-rubric queue.

VERDICT: NEGATIVE (5 defects: 0 blocking, 5 minor)
