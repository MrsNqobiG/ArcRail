VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md v2 reframe, sha256 230cdd69b179…b342e882, mtime 00:22:57) · commit: none (no HEAD; uncommitted working tree, verified 2026-10-03)

Criteria: KICKOFF_PROMPT.md §3, §4; CLAUDE.md; docs/RISK_REGISTER.md; docs/CONTRACT.md; docs/THREAT_MODEL.md; docs/constants.md; docs/LEDGER.md; every report in docs/verification/.
Note: docs/CONTRACT.md changed during this run (mtime 10:42:19, sha256 fefb870fa1dd…19382ec; it now has drift cells at :304-305, SIGNED send-time rows :292-296, case-return RET_* states :329-340). Rubric items that apply to CONTRACT were run against this current version.

CHECKS
- K1 Structure and counts, recounted by grep → PASS. 37 MC rows (MC-01..08, 10..24, 30..34, 40..48), 6 JL rows, each a one-line question. Money-path closed list: 10 items (RUBRIC.md:18-27).
- K2 Ledger agreement for the P1-rubric row → PASS. LEDGER.md:28 "MC-01…MC-48 + JL-1…JL-6, closed money-path list (10 items) … draft v2 (fix blocks 2/2 used) … R3 NEG 1 blocking … + 4 minor … Plateau step 1 REFRAME → v2 … R4 pending" matches the recount and RUBRIC.md:3. Cross-unit follow-up CF-3 is stale (see D5).
- K3 Arc constants re-fetched with curl on 2026-10-03 → PASS.
  - https://docs.arc.io/arc/references/rpc-endpoints.md :64 "| **Chain ID (Testnet)** | `5042002` |"; :105-108 "`eth_getLogs` returns error `-32012` when the requested block range exceeds 10,000 blocks … Log-driven clients must page through history in ≤9,999-block chunks."; :43-44 "You can safely retry requests that return `-32014` after a brief backoff."
  - https://docs.arc.io/arc/references/evm-differences.md :203 "**The minimum base fee is 20 Gwei.**"
  - https://docs.arc.io/arc/references/usdc-system-events.md :35 emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` 18; :36 `0x3600000000000000000000000000000000000000` 6; :39 "emits **two** logs".
  - https://docs.arc.io/arc/references/gas-and-fees.md :126 "`transaction underpriced` | `maxFeePerGas` is lower than the 20 Gwei minimum base fee floor".
  - `-32602` and `"Blocked address"`: 0 hits on all four pages, matching C-41 and C-57 (undocumented, Q-A4, Q-A13).
  - All four live pages are byte-identical to docs/sources/arc/ (diff -q). MC-21 / RB-5 reproduced, no drift.
- K4 MC-03 conversions recomputed by integer divmod (python3 bigint) → PASS, all equal to CONTRACT §6.1.
  - p=6: 0→(0,0); 1→(0,1); 999,999,999,999→(0,999,999,999,999); 10^12→(1,0); 10^18→(1,000,000,0); 1,000,000,500,000,000,000→(1,000,000,500,000,000,000); 420,000,000,000,000→(420,0); 7,374,356,000,000,000→(7,374,356,000,000,000); 9,223,372,036,854,775,807,999,999,999,999→(2^63−1, 999,999,999,999). Next value 2^63·10^12 → m=2^63, outside signed 64-bit, so the §6 overflow guard must PAUSE.
  - p=2: 10^18→(100,0); 1.5·10^16→(1,5·10^15); 10^16−1→(0,10^16−1); 1 wei→(0,1); 10^12 wei (1 USDC base unit)→(0,10^12), all dust.
  - Native→ERC-20: 1,234,567,890,123,456,789→(1,234,567, 890,123,456,789). uint256 max round-trips exactly.
- K5 MC-10 recomputed (JCS then SHA-256) → PASS. `Ab`≠`ab`; `["a|b","reserve"]`≠`["a","b|reserve"]`; key length 69. ID-grammar half (R3 D4) now present (RUBRIC.md:48). Case-return ID at minimum and at maximum (128-char) caseId: `cr-71301214…86a6` and `cr-c7782c0a…e996`, both 35 chars, both match `^[A-Za-z0-9._:-]{1,128}$`.
- K6 Probe G arithmetic (RUBRIC.md:107) → PASS. A=1000 minor at p=6 dropped from Rout with no T4 → residual −1,000,000,000,000,000 wei = −A·k.
- K7 MC-44 on RUBRIC.md itself → PASS. Every cited ID extracted by regex resolves: C-14/20/22/30/33/40/41/42/57 and M-1/6/8/9 (1 constants row each), T-E2/T-E5/T-R3/T-T1, L-2/3/4/6 (THREAT_MODEL), Q-A1/Q-A14/Q-P1 (OPEN_QUESTIONS), P3.4 (cbs-port-requirements:54), RR-1/3/6. Section targets re-traced on current CONTRACT: §1.3 keys, §1.6 PAUSE/two-person unpause, §3 ops, §4 events, §5.0 classification, §5.1 templates, §5.2 coverage, §5.3–§5.6 flows, §5.7 identity, §5.8 ages, §6.1 examples. All say what the rubric claims.
- K8 Closure of R3 defects → PASS for all five.
  - D1 MC-12(b) now split by phase (RUBRIC.md:50). Closed as worded for the R3 rows (:404, :412 T5 cond. 1; :403 QUARANTINE). New instances of the same class: see D1 below.
  - D2 MC-11 alphabet now has standing, CBS events, TR result, TR hash re-check (:49 (i), (ii), (iv)).
  - D3 MC-05 drift cells (:40); CONTRACT now names them (:304 "**Drift cell** (MC-05)", :305).
  - D4 MC-10 ID grammar (:48).
  - D5 LEDGER.md:28 updated (K2).
- K9 KICKOFF §3 exit bars → PASS. Branch coverage→MC-07; mutation→MC-08; drift 0→MC-05; scans→MC-33; citations→MC-21, MC-43; matrix columns→MC-48, MC-42.
- K10 CLAUDE.md coverage → PASS. N1→MC-20, MC-23; N2→MC-33; N3→MC-45; N4→MC-34; N5→MC-21, MC-43; N6→MC-42; I-INT→MC-01, MC-02; I-CONV→MC-03; I-CONS→MC-04, MC-05; I-ONCE→MC-10, MC-14, MC-18; I-FAIL→MC-11, MC-12, MC-19, JL-1.
- K11 MC-12(b) applied to current CONTRACT §5.8 by reconstruction (classify each pending item by phase, compare its expiry with the allowed set) → FAIL as a rubric item (Probe F). See D1.
- K12 MC-11 applied to current CONTRACT → PASS as a rubric item. The alphabet's send-time column is now populated by CONTRACT :292-296 (accepted, `-32603 "Blocked address"`, `transaction underpriced`, `-32014`, other). The rubric drove a real contract change.
- K13 Every verifier probe proposal folded in or listed as rejected (RUBRIC.md:7 "each probe proposal below is credited to its report"; :128 "Rejected proposals: none") → FAIL. Seven proposals from three reports dated 00:17 (before RUBRIC v2 at 00:22:57) are absent. Grep of RUBRIC.md for instantiate / supplementary / healthy / telescope / "per phase" / "let money move" / "non-blind" / "RR R4" / "TM R3" / "ADR R3" = 0 hits each. See D2, D3.
- K14 Probe G re-run (would this rubric pass a bad build or document?) → YES. See D2 (MC-40, RISK_REGISTER 3a) and D4 (MONEY_PATH.md scope).
- K15 Probe F re-run (would it fail a good build or document?) → YES. See D1.
- K16 Regression check. LEDGER.md:16-28 lists no frozen unit, so I instead re-derived the two closed rubric fixes furthest from the latest edit:
  - (a) MC-23 (R1 D1) vs THREAT_MODEL T-E5 and ADR-001:9 → PASS. Refusal sets are equal: {EIP-712 incl. EIP-3009/permits, personal_sign, EIP-7702, approve/permit calldata, deploys}, plus no Memo shape until Q-P1. MC-23 adds "any other chain ID", consistent with T-E2 "chain ID 5042002 only" (THREAT_MODEL:82).
  - (b) Money-path list (R2 D2) vs KICKOFF U1–U15 → PASS. Recount 10. Includes U7 (:22) and U3 (:23). Excluded units (U2, U5, U8, U13–U15) have their own checks (MC-20; MC-30/31; screening gates run inside U6/U10 per R2 C10).
- K17 Judgment lenses JL-1..JL-6 → [inspection-only] PASS. Each is a one-line question tied to a CLAUDE.md or KICKOFF §6 duty.

CANDIDATES (Lens A)
- C1 · RUBRIC.md:50 "**before signing** (nothing irreversible yet): expiry may be PAUSE, **QUARANTINE that escalates to PAUSE**, or a **balanced compensation** (T5 condition 1). Never "no action"" vs CONTRACT.md:407 "Case return RET_SCREENING, RET_TRAVEL_RULE, RET_SIMULATING | `A_checks` 30 min | `createCase PENDING_AGE` → source held state (nothing broadcast)", :408 (RET_AWAITING_APPROVAL, same action), :417 "Internal move PROPOSED | `A_move` 30 min | ABANDONED" with action :350 "none (never broadcast)" · MC-12(b), KICKOFF §4 Probe F · **REAL**.
  - All three are pre-signing items, so the second bullet applies. None of the expiries is PAUSE, QUARANTINE or T5: case returns have "No hold, no standing check, no T5" (CONTRACT.md:322), and PROPOSED → ABANDONED's action is literally "none".
  - All three are correct designs. Nothing is signed. The case-return item goes back to a Compliance-owned held state with a case (bounded by a named owner, §5.8 :402). The abandoned move reserved and posted nothing.
  - Also: inbound RECEIVED/SCREENING (:400) and SUSPENSE_ASSIGNING (:406) are after the inbound transfer's finality but outside the enumerated "after finality" list. A verifier reading the first bullet's "after finality" literally demands PAUSE and fails the QUARANTINE rows. A verifier reading the parenthesis as closed finds no rule for them. Either way the check is not mechanically decidable.
  - This is the R3 D1 class surviving the reframe: the reference set of *acceptable expiry actions* is still hand-listed, not derived.
- C2 · RUBRIC.md:80 MC-40 "Every **[R]** detection names **one concrete mutant it catches**, and uses an input **not produced by the component it checks**" vs RISK_REGISTER.md:43 "3a Orchestrator compromise gets a valid signature | [R] Every bank→external or bank→bank `Transfer` must match an instruction or move **and** a signer signing-log entry (CONTRACT §5.0) | The signer's own signing log | A transaction signed outside the orchestrator flow → no instruction match → PAUSE" · MC-40/MC-41, Probe G, P1-risk-register-lensR-4.md:54 · **REAL**.
  - Re-traced: with T-T1 OPEN (THREAT_MODEL.md:158 "Until then a compromised adapter could forge an approval"), a compromised orchestrator writes the instruction record itself and obtains a genuine signature, so the signer logs it. The outflow then matches one instruction and one signing-log entry, and §5.0 does not PAUSE.
  - MC-40 literally passes: a mutant is named and caught, and the stated input (signing log) is not orchestrator-produced. MC-41 passes: 3a maps to an [R]. So the rubric waves through a Critical risk with no detection that sees its threat.
  - THREAT_MODEL DR-01 (:130, joining against "the **CBS's own** instruction record … not through the orchestrator") shows a valid detection exists. The register proposal "the named mutant must instantiate the sub-risk; … no input to the detection may be writable or requestable by the compromised component" and "scope must be independent or telescope from fixed anchors" (2a, cf. DR-10 :139) were neither adopted nor rejected.
- C3 · RUBRIC.md:128 "Rejected proposals: none" and :7 "each probe proposal below is credited to its report" vs P1-risk-register-lensR-4.md:55 (Probe F: mark supplementary [R]s), P1-threat-model-lensR-3.md:43 (Probe G: MC-41 must require the healthy-path response, live-observed `-32003 "revert: OutOfFunds"` on an empty wallet), :44 (Probe F: non-blind threshold alerts), :67 "X5 … for the rubric owner", P1-adrs-lensR-3.md:36 (Probe G: recommendation per phase, "log this for the human at G1"), :37 (Probe F: MC-45 "every external dependency whose outage could let money move") · KICKOFF §4 (derive fresh; log probes) · **REAL (minor)**. The claim at :128 is false by grep (K13). Adoption or a logged rejection would each satisfy the check. Neither exists.
- C4 · RUBRIC.md:29 "Phase 2 records the matching source paths in `docs/MONEY_PATH.md`. The verifier recounts that file against this list." · MC-01, MC-07, MC-08, MC-34 scope; Probe G · **REAL (minor)**.
  - The recount is by unit (10 entries), not by code. A build that puts U11's `gasUsed × effectiveGasPrice` in `src/lib/fees.*` (not listed) using `Number()` passes:
    - MC-01: grep is "in money-path modules";
    - MC-07 and MC-08: measured on the listed paths;
    - MC-05: fixture gas such as 4.2·10^14 < 2^53 survives a double; precision is lost only above about 9.007·10^15 wei (about 0.009 USDC).
  - Nothing requires the listed paths to be closed under import.
- C5 · LEDGER.md:34 "**CF-3** · RUBRIC M-23 and ADR-001 Context item 2 still allow "the exact allowed Memo wrapper"" vs RUBRIC.md:65 "**No Memo shape** until Q-P1/ADR-006 is decided" and ADR-001:9 "**No Memo shape** is allowed until Q-P1/ADR-006 is decided" · KICKOFF §4 ledger · **REAL (minor)**. The follow-up asserts an open defect against this unit that no longer exists (both halves fixed). It could trigger a redundant fix block, or block freezing.
- C6 · RUBRIC.md:49 MC-11 (iii) is a hand-listed set of chain outcomes, while :3 says checks "derive their reference set from the contract itself". RPC disagreement and "no new blocks" are not in (iii) · CLAUDE.md fail-closed, JL-1 · **DISMISSED**. Chain-side outcomes can't be derived from CONTRACT §3/§4. Disagreement and stall are F2 and F7, and MC-05 requires a test per failure path that "asserts the cell's specified next state" (:40). MC-11's lead clause "every outcome from every source that can reach it" also governs.
- C7 · RUBRIC.md:121-128 ("After calibration") credits fix blocks 1 and 2 but not the reframe's adoption of R3 D1–D4 · traceability · **DISMISSED**. Cosmetic. Row-level credits exist (:40 "R3 D3", :48 "Rubric R3 D4", :49 "R3 D2", :50 "R3 D1 (Probe F)"), and :3 describes the reframe.
- C8 · RUBRIC.md:54 MC-16 "bisection on `-32602`", which is undocumented (0 hits live) · N5 · **DISMISSED**. Same as R3 C8. Cited as observed with UNVERIFIED status (constants C-41, Q-A4).

DEFECTS
- D1 · docs/RUBRIC.md:50 MC-12(b) · R / KICKOFF §4 Probe F · **blocking**.
  - Problem: the closed list of acceptable pre-signing expiries fails CONTRACT.md:407, :408 and :417, which are correct. The phase taxonomy can't classify post-finality inbound items awaiting a decision (:400, :406).
  - Fix: derive acceptability from properties, not a list. Before signing, any expiry is acceptable if it (1) is bounded, (2) moves the item out of automatic processing into PAUSE, QUARANTINE (escalating), a named-owner held state with a case, or a terminal state with balanced or no postings, and (3) leaves every reconciliation term itemised. Add an explicit bucket for "funds final on-chain, decision pending" items, with QUARANTINE that escalates to PAUSE allowed.
- D2 · docs/RUBRIC.md:80 MC-40 (with MC-41 at :81) · R / Probe G, RISK_REGISTER RR-3 3a, P1-risk-register-lensR-4.md:54 · **blocking**.
  - Problem: a Critical sub-risk with a detection that cannot see its threat passes both items.
  - Fix: add "the named mutant instantiates the sub-risk's threat; for a compromise sub-risk, no input or scope parameter of the detection is writable or requestable by the compromised component; scope parameters (ranges, cut-offs, item lists) are independent or telescope from fixed anchors". Or list the proposal as rejected with a reason for the G1 human.
- D3 · docs/RUBRIC.md:7, :128 · R / KICKOFF §4 · minor. Five probe proposals (RR R4 F; TM R3 G and F; ADR R3 G and F) are neither adopted nor logged as rejected, so "Rejected proposals: none" is false. Adopt each, or list it with its reason (the ADR R3 G is explicitly for the human at G1).
- D4 · docs/RUBRIC.md:29 · R / Probe G (scope of MC-01, MC-07, MC-08, MC-34) · minor. Require MONEY_PATH.md to be closed under import: every first-party module reachable from a listed path is itself listed or explicitly excluded with a reason. The verifier recomputes the closure from the import graph.
- D5 · docs/LEDGER.md:34 CF-3 · R / KICKOFF §4 ledger · minor. Mark CF-3 closed for RUBRIC (MC-23, RUBRIC.md:65) and ADR-001 (:9). It still uses the retired ID "M-23".

VERDICT: NEGATIVE (5 defects: 2 blocking, 3 minor)

Note for the operator: P1-rubric has used both fix blocks and plateau step 1 (reframe). By CLAUDE.md's plateau ladder the next step is step 2 (regenerate; regen budget 2 left per LEDGER.md:23), unless the human directs otherwise. D1 and D2 share a root cause: acceptable *actions* and *detection validity* are still judged against hand-listed sets, while the reframe derived only the *inputs* (alphabet, states) from the contract.

Phase 1 · units frozen 0/11 · streak 0/3 · rounds used 4/10 (P1-rubric) · regen budget left 2
