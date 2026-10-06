VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md v2 after v2 fix block 1; sha256 7df141f02078…2bf86d7, mtime 2026-10-03 10:46:55) · commit: none (no HEAD; uncommitted working tree, verified 2026-10-03)

Criteria: KICKOFF_PROMPT.md §3, §4; CLAUDE.md; docs/RISK_REGISTER.md (sha256 04bb02d9…); docs/CONTRACT.md (sha256 d3aad774…, mtime 10:42:43); docs/THREAT_MODEL.md; docs/adr/; docs/constants.md; docs/LEDGER.md; every report in docs/verification/, including the three written after rubric R4 or alongside it: P1-contract-lensR-4.md (00:45), P1-risk-register-lensR-5.md (10:44), P1-adrs-lensR-4.md (10:46:29).

CHECKS
- K1 Structure and counts, recounted by grep → PASS.
  - 37 MC rows (MC-01..08, 10..24, 30..34, 40..48) and 6 JL rows.
  - The closed money-path list has 10 items (RUBRIC.md:18-27).
  - The import-graph closure rule is present (:29).
  - LEDGER.md:31 "MC-01…MC-48 + JL-1…JL-6, closed money-path list with import-graph closure … draft v2, fix block 1 of 2 used … R5 pending" matches the recount and RUBRIC.md:130.
- K2 Arc constants re-fetched with curl on 2026-10-03 (all HTTP 200) → PASS.
  - https://docs.arc.io/arc/references/rpc-endpoints.md :64 "| **Chain ID (Testnet)** | `5042002` |"; :105-108 "`eth_getLogs` returns error `-32012` when the requested block range exceeds 10,000 blocks … ≤9,999-block chunks."; :43-44 "You can safely retry requests that return `-32014` after a brief backoff."
  - https://docs.arc.io/arc/references/evm-differences.md :203 "**The minimum base fee is 20 Gwei.**"
  - https://docs.arc.io/arc/references/usdc-system-events.md :35 emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (18); :36 `0x3600000000000000000000000000000000000000` (6); :39 "A single ERC-20 `transfer()` emits **two** logs".
  - https://docs.arc.io/arc/references/gas-and-fees.md :126 "`transaction underpriced` | `maxFeePerGas` is lower than the 20 Gwei minimum base fee floor".
  - `-32602`, `-32603` and "Blocked address" have 0 hits on all 7 fetched pages. That matches C-41 and C-57 (undocumented; Q-A4, Q-A13).
  - The live pages are byte-identical (cmp) to docs/sources/arc/ for rpc-endpoints, usdc-system-events, gas-and-fees and connect-to-arc. evm-differences equals the .REFETCH-later copy (Q-A14 drift, already recorded). MC-21 behaviour reproduced.
- K3 MC-03 / CONTRACT §6.1 recomputed by Python bigint divmod → PASS. Every value matches CONTRACT.md:443-462.
  - p=6: 0→(0,0); 1→(0,1); k−1→(0,999,999,999,999); k→(1,0); 10^18→(1,000,000,0); 1,000,000,500,000,000,000→(1,000,000, 500,000,000,000); 420,000,000,000,000→(420,0); 7,374,356,000,000,000→(7,374, 356,000,000,000); (2^63−1)·10^12+10^12−1→(9,223,372,036,854,775,807, 999,999,999,999). Odd dust 123,456,789,012,345,678,901→(123,456,789, 12,345,678,901).
  - p=2: 10^18→(100,0); 1.5·10^16→(1, 5·10^15); 10^16−1→(0, 10^16−1); 7,374,356·10^9→(0, all dust).
  - Native→units: 1,234,567,890,123,456,789→(1,234,567, 890,123,456,789). uint256 max has remainder 913,129,639,935. m = 2^63 exceeds signed 64-bit, so the §6 guard must PAUSE.
  - m·k+d = w holds for every value.
- K4 MC-10 recomputed → PASS. Keys are 69 characters. `Ab`≠`ab`; `["a|b","reserve"]`≠`["a","b|reserve"]`. Case-return ID for caseId "a" = `cr-401faa7ae9e8bc9facfafc42f579d569` and for a 128-character caseId = `cr-f61bf387095fd1b1216f039f582a307e`. Both are 35 characters and both match `^[A-Za-z0-9._:-]{1,128}$`.
- K5 Probe G arithmetic (RUBRIC.md:109) → PASS. A=1000 minor at p=6 dropped from Rout with no T4 gives residual −1,000,000,000,000,000 wei = −A·k.
- K6 MC-44 on RUBRIC.md, by script → PASS. Every cited ID resolves to exactly 1 definition: C-14/20/22/30/33/40/41/42/57, M-1/6/8/9, CF-1, DR-11, L-2/3/4/6, T-E2/E5/R3/T1, Q-A1/A14/P1, RR-1/3/6, P3.4. Semantics re-traced: C-14 is the truncation warning, M-6 is dropped/replaced, M-8 is float samples, P3.4 is hold expiry, and DR-11 has the healthy `0x` signal (THREAT_MODEL.md:140). All match the citing text.
- K7 Closure of R4 D1 (MC-12(b) list-based) → PASS. I applied the property test (bounded, fail-closed, itemised; plus the PAUSE rule for money that is final but not posted) to every CONTRACT §5.8 row, :399-421:
  - PAUSE: DETECTED (Rin), CANCELLING, SIGNED, BROADCAST without receipt, Rout/Rmove, D/F ≥ k, notifications, QUARANTINED. Each case that the PAUSE rule covers is PAUSE.
  - QUARANTINE (escalates per :112): RECEIVED/SCREENING, ACCEPTED, SUSPENSE_ASSIGNING, and APPROVED after 2×A_sign.
  - Terminal with balanced postings: RESERVED…SIMULATING and AWAITING_APPROVAL → T5 (one balanced template). PROPOSED → ABANDONED (none, nothing signed).
  - Named-owner held state with a case: RET_SCREENING…RET_AWAITING_APPROVAL → `createCase PENDING_AGE` → HELD_IN_CLEARING/SUSPENSE (Compliance).
  - The three rows that failed in R4 (:407, :408, :417) now pass. No correct row fails.
- K8 Closure of R4 D2 (MC-40/41 blind to an invalid detection) → PASS. I applied MC-40 (a)-(c) to RISK_REGISTER:
  - 3a (:35): DR-01's inputs don't exist in CONTRACT §3, so (c) requires a CF item plus a residual. Both are present: CF-5(f) (LEDGER.md:35) and RB-7 (:81).
  - 2c (:29): DR-13 has been removed per (a).
  - The R4 Probe G bad register (3a passing on a non-instantiating mutant) would now FAIL (a) and (c).
- K9 Closure of R4 D3/D4/D5 →
  - D4 PASS (:29 closure).
  - D5 PASS (LEDGER.md:38 CF-3 closed; MC-23 :65 and ADR-001:9 both say "No Memo shape").
  - D3 PARTLY. See D2 below.
- K10 KICKOFF §3 exit bars → PASS. Branch coverage→MC-07; mutation→MC-08; drift 0→MC-05; scans→MC-33; citations→MC-21/MC-43; matrix columns→MC-48/MC-42.
- K11 CLAUDE.md coverage → PASS.
  - N1→MC-20, MC-23; N2→MC-33; N3→MC-45; N4→MC-34; N5→MC-21, MC-43; N6→MC-42.
  - I-INT→MC-01/02; I-CONV→MC-03; I-CONS→MC-04/05; I-ONCE→MC-10/14/18; I-FAIL→MC-11/12/19, JL-1.
- K12 MC-47 class derivation applied to CONTRACT → PASS. The routing branches of §5.3–§5.6 give 8 classes (customer, bank-owned, unidentified, mint, dust-only, payout, case return, internal), and §5.2 (:217-224) has the same 8 rows.
- K13 Every verifier probe proposal is adopted or logged as rejected (RUBRIC.md:7 "each probe proposal below is credited to its report"; :143 "Rejected proposals: none") → FAIL. See C1, C2 / D1, D2.
- K14 Probe G re-run against the current CONTRACT → YES, demonstrated live. See D1.
- K15 Probe F re-run → no false fail on the current artefacts. The literal MC-21 "inline (URL + archive path)" and the MC-43 "quoted" wording fail good ADR text. ADR R4 avoided this only by applying a reading that the rubric does not carry (see D2).
- K16 Regression. LEDGER.md:21-31 lists 0 frozen units, so I re-derived two substitutes furthest from the v2 fix-block edits (which touched :12, :29, :80-81 and :130-143):
  - (a) MC-23 (:65) vs THREAT_MODEL T-E5 (:85) and ADR-001:9 → PASS. The refusal sets are equal: {EIP-712 incl. EIP-3009/permits, personal_sign, EIP-7702, approve/permit calldata, deploys}, "No Memo shape" until Q-P1, empty `data`, and chain ID 5042002 only (also T-E2 :82).
  - (b) P0-constants rows that the rubric relies on (C-30, C-40, C-42, C-20/C-22) → PASS. The quotes were re-found verbatim in today's live pages (K2).
- K17 Judgment lenses JL-1..JL-6 → [inspection-only] PASS. Each is a one-line question tied to a CLAUDE.md or KICKOFF §6 duty.

CANDIDATES (Lens A)
- C1 · RUBRIC.md:49 MC-11 "Every state has an action for every outcome from every source that can reach it" (no rule for delegated rows) and RUBRIC.md:39 MC-04 (template balance and validity only), vs P1-contract-lensR-4.md:67 Probe G "(1) MC-11 is satisfied syntactically by delegation … Proposed patch: MC-11 must instantiate every delegated row for the delegating flow and check each action's preconditions and target state against that flow's own state set. (2) MC-04 … also re-traces the G5/G4 itemisation … over every template, including the failure mutants". Both are absent from RUBRIC.md (grep "delegat" = 0 hits; "itemis" appears only in MC-12). Criteria: KICKOFF §4 Probe G, MC-11, I-CONS · **REAL**.
  - The live demonstration on the current CONTRACT is a set of delegations that a cell-filling MC-11 accepts:
    - CONTRACT.md:340 "RET_SIGNED | send results | exactly the §5.4 SIGNED and CANCELLING rows, **except** that "T5 (condition 3) → RELEASED" becomes …". This imports :298 "CANCELLING | the **original** transaction is final instead (status 1) | … Rout, then T4 as in BROADCAST | SETTLED". For a case return there is "No hold … no G1 debit" (:321), so T4 (settleHold or the DR G5.outbound fallback) has no valid precondition. SETTLED is not a case-return state, `heldAmount` is never reduced, and T9/T10 never posts.
    - CONTRACT.md:344 "PAUSED … as §5.4 PAUSED, with "T5" replaced by "→ source held state"". This imports :306 "`SETTLED` (proof of a status-1 receipt supplied → T4)", which is the same wrong template.
    - CONTRACT.md:353 "Internal move BROADCAST | stuck or no receipt | as for §5.4 BROADCAST, using F4". This imports :303 "our same-nonce cancel is final | gas to F. T5 (condition 3) | RELEASED". An internal move has no hold and no RELEASED state.
  - Every MC item passes this: MC-11 (cells filled), MC-04 (templates balance), MC-44 (§5.4 does contain the cited rows), and in code MC-05 (the test asserts "the cell's specified next state", which here is the wrong one).
  - At runtime the wrong T4 probably ends in REJECTED HOLD_NOT_FOUND → Fact → PAUSE, so money stops. But a build implemented to this spec passes the rubric with a wrong posting path on a money-path module (U10).
  - This is exactly the class the rubric was patched against in R4 (detections validated by form, not by instantiation), now on actions.
- C2 · Provenance log, RUBRIC.md:131-143. Criteria: KICKOFF §4 ("log both probes"; derive fresh); the rubric's own claim at :7 · **REAL (minor)**.
  - (i) :133 "the risk-register R4 Probe F (preventive checks aren't relabelled)". The actual R4 Probe F (P1-risk-register-lensR-4.md:55) is "each [R] that a row relies on to satisfy MC-41 names a mutant; others are marked 'supplementary'". That content is neither adopted (MC-40 :80 still says "Every **[R]** detection names one concrete mutant") nor rejected. The "preventive" content belongs to RR R5 Probe F(1).
  - (ii) :138 "threat-model R3 Probe G (healthy-signal check …) is covered by DR-11's healthy `0x` signal and MC-40 (b)". DR-11 is the artefact, not a rubric check. MC-40(b) is about the compromised component writing inputs or scope, and says nothing about healthy-path responses. So a TM that states only the failure signal still passes MC-40 and MC-41. This is a rejection labelled as "covered", with a reason that doesn't reconstruct.
  - (iii) Contract R4 Probe G (1) and (2) (see C1) are not listed.
  - (iv) ADR R4 Probe G ("recommendation prose and phase table name the same option per phase; regulatory paraphrases keep every scope qualifier") and Probe F (MC-21 archive resolvable through MANIFEST; MC-43 faithful ¶-pinpointed paraphrase), P1-adrs-lensR-4.md:40-41, are not listed. That report landed 26 s before RUBRIC.md was saved, so this is a timing gap, not negligence. It still has to be logged.
  - So ":143 Rejected proposals: none" and ":7 each probe proposal … credited" are false by grep.
- C3 · RUBRIC.md:50 MC-12(b) "money that is already final on-chain but not yet posted (… signed-not-broadcast, broadcast-without-receipt): the expiry must be **PAUSE**", vs CONTRACT.md:415 "BROADCAST without a final receipt | `T_pending` → F4. `A_stuck` 30 min | PAUSE" (a staged expiry). Criterion: Probe F (would a good staged design, e.g. SIGNED → same-nonce cancel → CANCELLING → PAUSE at A_stuck, fail?) · **DISMISSED**. The rubric's own enumerated "broadcast-without-receipt" case is satisfied only by the staged reading, where the final stage is PAUSE. Applied consistently, a staged SIGNED expiry whose last stage is PAUSE also passes. No current row is failed.
- C4 · RUBRIC.md:80 "A sign-time **preventive** check isn't relabelled as a detection", vs THREAT_MODEL.md:41/:48/:57 "[R] DR-03", whose mutant (:132) is "recomputed digest ≠ signed challenge → refusal and PAUSE" (a sign-time refusal). Criterion: Probe F on MC-40 · **DISMISSED as a rubric defect**. Here the rubric is working correctly. THREAT_MODEL.md:17 states the same rule ("A preventive control is never labelled as a detection"), and RISK_REGISTER.md:35 already cites DR-03 as "Preventive". The disagreement is THREAT_MODEL's. Routed to P1-threat-model: T-T1/T-S3 should either name DR-03's audit re-verification part as the detection, with its own mutant, or drop the [R].
- C5 · RUBRIC.md:29 "either in MONEY_PATH.md or explicitly excluded there with a reason". Criterion: Probe G (could a fee helper be excluded with a bogus reason?) · **DISMISSED**. The verifier reads each exclusion, and MC-34, MC-01 and the R4 D4 fix wording are met. A stronger test (an excluded module must not accept or return a branded amount type, MC-02) is a hint, not a defect.
- C6 · RUBRIC.md:14 "**(design)** items apply from Phase 1", while no item is tagged (design), only (both) or (code). Criterion: MC-44 · **DISMISSED**. Cosmetic. "(both)" is unambiguous.
- C7 · MC-12(a) applied to CONTRACT finds no §5.8 row for "RETURNING (start)" (:327) or for the case-return CANCELLING state imported by :340. MC-05 lists "an unmatched outflow" as a drift cell, but CONTRACT names only :304-305 as drift cells (§5.0 rules 1-2 PAUSE are not named). Criterion: rubric function · **DISMISSED as a rubric defect**. These are the rubric correctly finding contract gaps. Routed to P1-contract.

DEFECTS
- D1 · docs/RUBRIC.md:49 (MC-11), with :39 (MC-04) · R / KICKOFF §4 Probe G, I-CONS · **blocking**.
  - Problem: delegated rows ("exactly as §5.x", "as there", "as for §5.4 BROADCAST") are counted as filled cells without instantiating their actions in the delegating flow. On the current CONTRACT this waves through T4 → SETTLED for case returns (:340→:298, :344→:306) and T5 → RELEASED for internal moves (:353→:303).
  - Fix: adopt contract R4 Probe G(1): "MC-11 expands every delegated row into the delegating flow and checks that each action's preconditions (hold exists, G1 account exists, the template's source GL) and next state belong to that flow's own state and template set". Also adopt G(2), or log a rejection with a reason: "MC-04 re-traces the §5.7 G5/G4 itemisation, not only the two identities, over every template and failure mutant".
- D2 · docs/RUBRIC.md:7, :133, :138, :143 · R / KICKOFF §4 (log probes; derive fresh) · minor.
  - Correct the RR R4 Probe F attribution, and adopt or reject its "supplementary [R]" rewording.
  - Relabel the TM R3 Probe G disposition as rejected, with a reason that holds. MC-40(b) does not cover healthy-path signals.
  - Log contract R4 Probe G (1)(2) and ADR R4 Probe G/F.
  - Then ":143 Rejected proposals" must list every rejection.

Routed out of unit (not counted):
- P1-contract: the three wrong delegations (:340, :344, :353); the missing §5.8 rows for RETURNING and case-return CANCELLING; the unmatched-outflow drift cell left unnamed.
- P1-threat-model: [R] DR-03 labelling (T-T1, T-S3, T-R1).

VERDICT: NEGATIVE (2 defects: 1 blocking, 1 minor)

Note for the operator: R4's two blocking defects (D1 MC-12(b), D2 MC-40) are closed by reconstruction. The new blocking defect comes from a probe proposal (contract R4, 00:45) that predates rubric R4 and that R4's verifier also missed. P1-rubric v2 has 1 fix block left. D1 and D2 are both small textual changes to MC-11/MC-04 and to the log, so they can travel in one fix block only if the operator accepts that the provenance edit is not a structural change. Otherwise, split them.

Phase 1 · units frozen 0/11 · streak 0/3 · rounds used 5/10 (P1-rubric) · regen budget left 1
