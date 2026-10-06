VERIFICATION · lens: R (with the Lens A candidate, probe and regression sections the verifier method requires) · target: P1-risk-register (docs/RISK_REGISTER.md v3, regenerated), R5 · commit: none (uncommitted working tree on main, no HEAD; verified 2026-10-03)

Criteria: KICKOFF_PROMPT.md §4 and §5 Phase 1 item 3; CLAUDE.md; docs/RUBRIC.md (MC-40, MC-41, MC-44, plus MC-21/MC-43 where the register touches them); THREAT_MODEL.md v2 (§D DR-01..DR-21); CONTRACT.md v3; constants.md; OPEN_QUESTIONS.md; LEDGER.md (CF items); docs/sources/MANIFEST.md. Prior reports: lensR to lensR-4 (D-1 to D-17).

CHECKS:
R1 Top-entry count 3-6 (KICKOFF §5 P1 item 3) → PASS. Recounted: 6 `### RR-` headings (lines 17, 24, 32, 39, 47, 53); 20 sub-risks (3+4+3+4+2+4); 6 below-cut-off rows (RB-1..RB-6, lines 74-79); 4 §RD rows (RD-01..RD-04), each defined once and referenced once.
R2 Each top entry has a detection; blind entries use [R] or [X] → PASS at entry level; FAIL at sub-risk level for 3a (D-18).
R3 MC-41 per sub-risk → PASS 19/20, FAIL 3a. 1a RD-01 + RD-02 [X]; 1b DR-06; 1c [P] U1 (money-path item 1) + DR-06; 2a/2b/2d DR-10; 2c DR-06; 3a DR-01 (D-18); 3b DR-12/DR-13; 3c [P] MC-23 (U9, money-path item 4) + DR-14/DR-15; 4a DR-07; 4b RD-03; 4c DR-07; 4d/5a/5b [X]; 6a DR-19; 6b DR-20; 6c DR-21 + [P]; 6d [P] + DR-15.
R4 Arc facts re-derived live 2026-10-03 ~08:40 UTC against https://rpc.testnet.arc.io (MC-21) → PASS.
  - eth_chainId → 0x4cef52 = 5,042,002 (C-01). Head 65,188,420.
  - eth_getLogs span 10,000 → -32012 "requested range too large"; span 9,999 → [] (C-40). Unfiltered span 9,999 → -32602 "request exceeded max allowed range: query exceeds max results 2000, retry with the range 65168420-65168514" (C-41, Q-A4).
  - DR-11 / RB-1 zero-value probe: from C-55 0x7099…79C8 to 0x…dEaD, value 0 → -32603 "Blocked address"; from C-55 to a fresh empty address, value 0 → -32603; control (empty → 0x…bEEF), value 0 → "0x"; same control pair at value 1 wei → -32003 "revert: OutOfFunds" (confirms C-57's reason for probing at value 0).
  - Observation, not a register defect (route to P0-constants, C-57): calling TO C-55 at value 0 returns -32003 "out of gas: invalid operand to an opcode" (C-55 carries 7702 code 0xef0100b8b08cdb4ed6e011b630c24e3f382a57ef22138e). The to-direction gives -32603 only with value > 0. DR-11 probes each wallet as `from`, so its signal holds, but C-57's "to or from" holds only for value > 0.
  - https://docs.arc.io/arc/references/rpc-endpoints.md (fetched 2026-10-03 08:41 UTC) lines 105-108: "`eth_getLogs` returns error `-32012` when the requested block range exceeds … ≤9,999-block chunks." ✓ (C-40).
  - https://docs.arc.io/arc/references/evm-differences.md (same fetch) lines 127-128: "…blocklisted address reverts. An included transaction that reverts on a blocklist check still consumes gas." ✓ (C-53). No fetched page mentions "Blocked address" or -32603, so C-57 is still undocumented (Q-A13). The agent-instruction headers on fetched pages were treated as data (T-SC3).
R5 MC-40 RD mutants re-traced (python3 exact integers) →
  RD-01 PASS. W = 10^18; adapter p=6 → m = 1,000,000; a CBS at p=2 renders 10000.00. Tag p=2 ≠ configured p=6 → PAUSE before posting (CONTRACT:25). Independence depends on the ACL translator reading p from the CBS (Q-C4) [inspection-only].
  RD-02 PASS ([X]). Config 6 / CBS 2 → 10000.00; config 2 / CBS 6 → m = 100 → 0.000100. Both match line 66.
  RD-03 PASS. Hot holds 100 USDC; a move of X = 5×10^18 hot→gas, with T6 posted twice (Rmove back to 0 after OK). Per-role residuals: hot +5×10^18, gas −5×10^18. The aggregate over S is 0 (confirms that CONTRACT:327's aggregate check is blind to it). A single T6 gives [0, 0]. The PAUSE needs CF-5(b), which the row states.
  RD-04 PASS. "Sending value to a precompile address reverts." is at docs/sources/arc/arc_references_evm-differences.md:133. It is absent from the REFETCH-later copy and from today's live page, so the diff shows it.
R6 MC-40 DR mappings re-traced →
  1b DR-06 PASS. Outbound A = 10^6 minor sent as A×10^6 wei → residual 999,999,000,000,000,000. Ceil variant at W = 10^12+1 → −10^12. Equivalent mutant: a global k' = 10^6 used in both directions and in the identity gives residual 0. It is caught instead by the 1c [P] oracle (1 USDC = 10^18 wei; A×k' = 10^12) and by RD-02.
  1c [P] PASS. 2a DR-10 PASS: block 65,009,999 skipped inside a cut-off range → delta − Σ indexed = 2×10^18 ≠ 0. The scope is now U12's cut-offs (D-13 closed).
  2b DR-10 PASS (R4 trace unchanged). 2c DR-06 PASS (residual −5×10^18). 2c DR-13 FAIL (D-19). 2d DR-10 PASS.
  3a DR-01: mutant traced (fabricated I* → signing-log payloadHash* has no CBS instruction → PAUSE), but the input interface is missing (D-18).
  3b DR-12/DR-13 PASS (R4 trace; U4 is not the compromised component in 3b). 3c DR-14 PASS (getCode of a live 7702 account = 0xef0100…, re-observed today). DR-15 PASS (signed permit → Approval(owner = bank) → PAUSE).
  4a DR-07 PASS. Duplicate T2 with m = 10^6 → CBS identity 0 and chain residual 0, but G5 − Σ items = −10^6 → PAUSE. Duplicate T5-fallback, T8 and T11 each show −10^6 in their itemisation. T6 has been moved out of 4a (D-14 closed).
  4c DR-07 [inspection-only] PASS. An op that was applied but left unresolved leaves a CBS journal under a key whose adapter item is not OK → unmatched. If the item is also dropped from Rin, the DR-06 residual is +m×k.
  6a-6d PASS (DR-19/20/21 mutants as in R4; the text matches THREAT_MODEL L-2, L-3, L-4, L-6).
  RB-1 DR-11 PASS (live, R4). DR-16 PASS (C-33 extraData). RB-5 RD-04 PASS. RB-6 DR-18 mutant PASS, reference FAIL (D-20).
R7 MC-40 clause 2, labels agree with THREAT_MODEL → PASS. 1c ↔ T-T5; 2d ↔ T-N1; 3b ↔ T-E3; 3c ⊂ T-E5; 6a ↔ L-2/L-6; 6b ↔ L-3; 6c ↔ L-4; 6d ⊂ T-E5; RB-1 ↔ T-D5/T-N1/T-N2; RB-3 ↔ T-SC1; RB-4 ↔ T-D2; RB-6 ↔ T-B2. D-16 closed.
R8 MC-44 references → FAIL on one (D-20). Resolved: CONTRACT §1.1 (:25), §5.0 (:181), §5.7 (:317-354), §5.8 (:356); THREAT_MODEL header labels (:7-15), residual 4 (:158), every T-/L- id; SEQUENCES F7 (:411); ADR-006 sweep policy (:34-36); G-M 2 (KICKOFF §9 item 2); LEDGER CF-5(b) (:32). All 11 Q-ids, all 10 MC-ids and all 15 DR-ids resolve. Incoming references also resolve: CONTRACT:25 → RR-1, CONTRACT:354 → RR-4, ADR-001:11 → 2c/3a/3b, ADR-006:36 → RB-1, Q-A11 → "RR-2 balance-delta".
R9 THREAT_MODEL residuals carried → PASS. Residuals 1-5 map to RB-1, RB-2, RB-3, 3a (residual 4 now cited at :35) and RB-6.
R10 5b archive statement (MC-44/MC-43) → PASS. MANIFEST lists only the Directive 9 PDF and its extract under fic/, and line 51 now says exactly that. D-17 closed.
R11 Header history (line 3) vs LEDGER:27 → PASS (v1 → v2 reframe → v3, regen budget 2 → 1).
R12 Derived fresh, not stock (KICKOFF §4) → [inspection-only] PASS. R13 Ranking H/C, M/C, L/C, M/H, M/H, M/H → [inspection-only] PASS. R14 Review cadence and closure only via EVIDENCE_PACK (:81-83) → [inspection-only] PASS.

CANDIDATES (Lens A):
A1 · RISK_REGISTER.md:35 "[R] **DR-01** (join to the **CBS's own** instruction and approval records, read by U12 directly from the CBS)" vs CONTRACT.md:134-151 and CONTRACT.md:157 · MC-41 (sub-risk maps to a working [R]); CLAUDE.md rule 5 (an unverified CBS capability goes to OPEN_QUESTIONS); the register's own practice at :43 and :79 of flagging the CONTRACT change a detection needs · REAL ·
  - CONTRACT §3 (:134-151) defines these adapter→CBS reads: getAccountStanding, getResultByKey, getTravelRuleOriginator, getApproval{approvalId}, getBalancesAsOf, listJournals and replayEvents. None of them returns submitted payout instructions.
  - submitPayoutInstruction (:157) is a CBS → adapter call only. §4 events don't include it, so replayEvents can't return it either.
  - A grep over docs/ (excluding verification/) for an instruction listing finds only THREAT_MODEL:130 and this row.
  - cbs-port-requirements has no requirement that the CBS store and expose submitted instructions. LEDGER CF-1..CF-5 have no such item, and no Q-C asks whether a CBS can do it.
  - getApproval needs an approvalId, which only the orchestrator holds. U12 would need a listing, or a lookup by payloadHash.
  - Result: the only detection for the top Critical sub-risk reads from an interface that isn't in the contract going to G1, and nothing tracks the gap.
  - Fix: add "Needs CONTRACT change CF-x: a CBS read listing submitted payout instructions (and case dispositions) by cut-off, plus approvals by payloadHash", add a Q-C for it, and state that 3a stays blind until both CF-x and Q-C10 land.
A2 · RISK_REGISTER.md:29 "2c Misclassification (internal move booked as inbound) | [R] DR-06 (over all bank wallets). [R] DR-13" with THREAT_MODEL.md:142 DR-13 "(CONTRACT §5.0)" and CONTRACT.md:181 rule 1 · MC-40 (input not produced by the component checked; detection catches the mapped sub-risk) · REAL (minor) ·
  - Re-trace: a hot→gas move of X. The U4 mutant skips rule 1, so rule 3 books it as inbound.
  - (a) If DR-13 is §5.0 rule 1, as cited, it is the code that contains the bug and never runs.
  - (b) If U12 runs DR-13 separately, it sees a bank→bank Transfer that matches move moveId and its signing-log entry, so it finds a match and does not PAUSE.
  - Neither catches 2c. DR-06 does (residual −5×10^18), so MC-41 still holds, but the DR-13 mapping overstates coverage. Remove it from 2c.
A3 · RISK_REGISTER.md:79 "[R] DR-18 (needs CONTRACT CF-5(e) / CF-4)" vs LEDGER.md:32 CF-5 "(e) DR-18 needs `originatorDigest` from the CBS in `getTravelRuleOriginator`" and LEDGER.md:33 CF-4 "(a) an inbound travel-rule check … (b) the R5 000 tier … (c) … counterparty-CASP due diligence" · MC-44 · REAL (minor) ·
  - CF-4 says nothing about originatorDigest.
  - "/ CF-4" copies a stale reference from THREAT_MODEL.md:147 ("Needs the CONTRACT change in LEDGER CF-4") and :159.
  - The register's own Flag column on the same row ("until CF-5(e) is implemented") gets it right.
  - Fix: drop "/ CF-4". Route THREAT_MODEL :147 and :159 to P1-threat-model.
A4 · RISK_REGISTER.md:35 "Preventive: DR-03, the signer's assertion check" vs THREAT_MODEL.md:48 T-T1 "[R] DR-03" and THREAT_MODEL.md:17 "A preventive control is never labelled as a detection" · MC-40 clause 2 (labels agree) · DISMISSED ·
  - THREAT_MODEL itself puts the same signer re-verification in T-T1's Preventive control column (:48 "The signer re-verifies `payloadHash` and the checker's FIDO2 `checkerAssertion`").
  - DR-03 has a sign-time (preventive) part and an audit re-verification (detective) part. The register cites the sign-time part by name and doesn't count it toward MC-41.
  - No sub-risk's labels drift.
A5 · RISK_REGISTER.md:37 "3c Off-chain signature drain (EIP-3009, permit, 7702) | [P] Signer refusal fixtures (MC-23). [R] DR-14. [R] DR-15" vs THREAT_MODEL.md:85 T-E5 "[R] DR-14, DR-15, DR-13 (after the fact), DR-12 (7702 only, after the fact)" · MC-41 / MC-40 · DISMISSED ·
  - Re-trace of an EIP-3009 drain: transferWithAuthorization emits a Transfer but no Approval, and changes no code. Neither DR-14 nor DR-15 fires. DR-13 would, but 3c doesn't list it.
  - MC-41 still holds. 3c comes from a bug in the U9 shape allow-list (money-path item 4), so [P] MC-23 counts as [R], and its fixtures include "an EIP-3009 typed-data request" (THREAT_MODEL:85).
  - The row is a subset of THREAT_MODEL's, not a disagreement. Hint: add "[R] DR-13 (EIP-3009, after the fact)".
A6 · THREAT_MODEL.md:130 DR-01 "joins every signing-log entry to the CBS's own instruction record (`submitPayoutInstruction` as stored by the CBS)", as cited by RISK_REGISTER.md:35, vs CONTRACT.md:311 (internal moves are signed with a signing-log entry and have no CBS instruction) and CONTRACT.md:299 (the case-return instructionId is derived by the adapter from a CaseDisposition; there is no submitPayoutInstruction) · Probe F / JL-1 · REAL, out of unit (DR-01 is defined in THREAT_MODEL; route to P1-threat-model; not counted here) ·
  - Read literally, every gas top-up and every case return fails the join, causing a false PAUSE.
  - Needed scope:
    - outbound entries whose destination is not bank-controlled (classified independently) join to submitted instructions;
    - case-return entries join to the CaseDisposition (returnAmount, returnDestination);
    - bank→bank entries are left to DR-13.

PROBE G (would the rubric wave through a bad version of this register?): Yes, and this artefact shows it.
(1) DR-01 meets MC-40 literally (its input isn't produced by the orchestrator, and the mutant re-traces), yet CONTRACT gives it no interface to read that input (A1). Patch MC-40: "every input a detection reads from another system is a CONTRACT §3/§4 operation or a cited constant, or the row names the CF item and Q-id that will add it".
(2) MC-40 still checks only that each [R] has *some* mutant, not that it catches the sub-risk it is mapped to, so the 2c → DR-13 mapping passes (A2). The R4 Probe G patch ("the named mutant must instantiate the sub-risk") is not in RUBRIC.md:80. Patch: "for each sub-risk → detection mapping, the verifier re-traces a mutant of that sub-risk".
PROBE F (would it fail a good version?): Partly.
(1) MC-40 clause 2, read literally, would fail a register that correctly calls DR-03's sign-time check preventive, because THREAT_MODEL labels DR-03 [R] (A4). Reword: "labels agree per sub-risk → detection mapping; a register may cite a dual-role control by its preventive part".
(2) MC-41's "every detection signal is cited in constants.md or OPEN_QUESTIONS" would also fail a good register over standard EVM signals (eth_getBalance, the ERC-20 Approval topic). Limit it to Arc-specific or undocumented signals.
I applied the rubric as written. Neither point changes this verdict.

REGRESSION (two frozen units): LEDGER.md:18-28 shows 0 frozen units (every row is draft), so there is no frozen unit to check. Nearest substitutes, chosen furthest from this edit:
(1) P0-constants: C-01, C-40, C-41, C-53 and C-57 were re-derived live today (R4). All match constants.md:13, 61, 62, 72, 75, apart from the to-direction refinement noted in R4.
(2) CONTRACT §6.1 recomputed by divmod. All 13 rows match:
  - p=6: 0; 1; k−1; k; 1 USDC; 1.0000005 USDC; 420×10^12; 7,374,356×10^9; and (2^63−1)·10^12 + 10^12 − 1 → m = 2^63−1, dust 999,999,999,999.
  - p=2: 10^18 → 100; 15×10^15 → (1, 5×10^15); k−1; 7,374,356×10^9 → (0, all dust).
  - Also: 1,234,567,890,123,456,789 wei → (1,234,567; 890,123,456,789) ✓, and 21,000 × 20 gwei = 420,000,000,000,000 ✓.

Prior defects:
- D-12 PARTLY CLOSED: the actor and the independent input are now right, and residual 4 is carried. The missing input interface remains, now D-18.
- D-13 CLOSED.
- D-14 CLOSED in the register. CONTRACT:327 still says "diagnostic", which is tracked as CF-5(b).
- D-15 CLOSED: every [R] is a DR or RD with an independent input and a mutant.
- D-16 CLOSED.
- D-17 CLOSED.

DEFECTS:
D-18 · docs/RISK_REGISTER.md:35 (3a's only [R], DR-01, reads CBS instruction and approval records through an interface that CONTRACT v3 §3/§4 doesn't define. No CF item and no Q-C track it, unlike :43 and :79) · Lens R, MC-41 + CLAUDE.md rule 5 / KICKOFF §5 P1 item 3 · blocking
D-19 · docs/RISK_REGISTER.md:29 (2c maps DR-13, which can't catch a misclassified internal move) · Lens R, MC-40 · minor
D-20 · docs/RISK_REGISTER.md:79 ("CF-5(e) / CF-4": CF-4 has no originatorDigest item) · Lens R, MC-44 · minor

Routed out of unit (not counted): the A6 DR-01 scope → P1-threat-model; THREAT_MODEL:147/:159 "CF-4" → CF-5(e) → P1-threat-model; C-57 to-direction at value 0 → P0-constants.

VERDICT: NEGATIVE (3 defects: 1 blocking, 2 minor)
