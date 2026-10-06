VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md, sha256 29b498fe7f500395…), re-verification R3 after fix block 2 · commit: none (no HEAD; uncommitted working tree, verified 2026-10-03)

Criteria: KICKOFF_PROMPT.md §3, §4; CLAUDE.md; docs/RISK_REGISTER.md; docs/CONTRACT.md (v3); docs/THREAT_MODEL.md; docs/constants.md; every report in docs/verification/.

CHECKS
- K1 Structure and counts, recounted by grep → PASS. 37 MC rows (MC-01..08, 10..24, 30..34, 40..48) and 6 JL rows, each a one-line question. Money-path closed list: 10 items (RUBRIC.md:18-27), including U7 (:22) and U3 (:23).
- K2 Ledger agreement → FAIL (minor). LEDGER.md:28 intent column says "MC-01…MC-47 + JL-1…JL-6", but MC-48 exists (RUBRIC.md:88); the recount gives 37 MC. Status column says "draft (fix blocks 1/2 used)", while the verdict column of the same row says "Fix 2 (last; adds MC-48)" and RUBRIC.md:3 says "Fix blocks 1 and 2 applied". See D5.
- K3 Arc constants, re-fetched with curl from docs.arc.io on 2026-10-03 → PASS.
  - https://docs.arc.io/arc/references/rpc-endpoints.md: :64 "| **Chain ID (Testnet)** | `5042002` |"; :105-108 "`eth_getLogs` returns error `-32012` when the requested block range exceeds 10,000 blocks … ≤9,999-block chunks"; :43-44 "safely retry requests that return `-32014` after a brief backoff".
  - https://docs.arc.io/arc/references/evm-differences.md :203 "**The minimum base fee is 20 Gwei.**"
  - https://docs.arc.io/arc/references/usdc-system-events.md :35-36 give the emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (18) and `0x3600…0000` (6); :39 "emits **two** logs".
  - https://docs.arc.io/arc/references/gas-and-fees.md :126 "`transaction underpriced`".
  - https://docs.arc.io/arc/concepts/transaction-memos.md :22 gives the Memo contract `0x5294E992…e505`.
  - `-32602` and `-32603 "Blocked address"` appear on none of the six pages (grep exit 1). That matches C-41 and C-57, which mark them as undocumented (Q-A4, Q-A13).
  - Diff against docs/sources/arc/: five pages are identical. evm-differences differs only by the removed precompile sentence, which is already recorded as Q-A14. No quote that the rubric relies on drifted (RB-5 / MC-21 behaviour reproduced).
- K4 MC-03 conversions, recomputed by integer divmod → PASS. All values match CONTRACT.md:399-418.
  - p=6: 0→(0,0); 1→(0,1); 999,999,999,999→(0,999,999,999,999); 10^12→(1,0); 10^18→(1,000,000,0); 1,000,000,500,000,000,000→(1,000,000, 500,000,000,000); 420,000,000,000,000 (=21,000×20 gwei)→(420,0); 7,374,356,000,000,000→(7,374, 356,000,000,000); (2^63−1)·10^12+10^12−1→(9,223,372,036,854,775,807, 999,999,999,999).
  - The next value up (2^63·10^12) gives m=2^63, which exceeds the signed 64-bit range, so the §6 overflow guard must PAUSE.
  - p=2: 10^18→(100,0); 1.5·10^16→(1,5·10^15); 10^16−1→(0,10^16−1); 1 wei→(0,1); 1 USDC base unit (10^12 wei)→(0,10^12), all of it dust.
  - Native→ERC-20: 1,234,567,890,123,456,789→(1,234,567, 890,123,456,789). The uint256 maximum round-trips exactly. p=18 caps a signed 64-bit balance at about 9.22 USDC, as CONTRACT.md:420 says.
- K5 MC-04, CBS identity `CBS_G2+G3 = G1+G4+G5+G6+G7`, re-traced over all 13 template rows of CONTRACT.md:334-346 → PASS.
  - T4: LHS −A, RHS −(A+fee)+fee = −A. T9: −R on both sides. Gas: +n−n on the LHS. Dust: +n on both sides.
  - With fee=0, T4 has no G6 leg. T1 is posted only if m>0 (:229). A dust batch posts only when ⌊D/k⌋≥1. So there are no zero-amount legs.
- K6 MC-10 keys recomputed (JCS, then SHA-256) → PASS. `Ab`/`ab` give different keys, and `["a|b","reserve"]`/`["a","b|reserve"]` give different keys. Keys are 69 characters. The case-return ID `cr-a10731e69584dabdb073ba9c79c1ae34` is 35 characters.
- K7 Probe G arithmetic (RUBRIC.md:107) → PASS. With A=1000 at p=6, an item dropped from Rout with no T4 gives residual = −10^15 wei = −A·k.
- K8 Probe F patch 2 → PASS. The exclusions file is named (:116), human acknowledgement at G1 is flagged (:119), and the patch count is 2 of 2.
- K9 Every ID and § reference in RUBRIC.md resolves → PASS.
  - Every cited C-, M-, T-, L-, RR-, Q-, P-, I-, N- and CF- ID exists in its defining document.
  - The F-numbers match SEQUENCES: F3 is the blocklist revert and F4 is the stuck nonce (SEQUENCES.md:286, :318), as MC-13 needs.
  - The section targets say what the rubric claims: CONTRACT §1.3 (keys), §1.6 (two-person unpause), §3 (postJournal, holds, getResultByKey), §4 (ack and seq rules), §5.0 (classification), §5.1/§5.7 (templates, identity), §5.2 (coverage), §5.8 (ages).
- K10 Closure of the round-2 defects → PASS, except D8 (partly closed):

  | R2 defect | Status | Evidence |
  |---|---|---|
  | D1 | Closed | :40 "exactly 0 wei in every … cell … each test asserts the cell's specified next state" |
  | D2 | Closed | :22-23 |
  | D3 | Closed | :50(b) and :126 |
  | D4 | Closed | :49 send-time and nonce outcomes |
  | D5 | Closed | :87 branch-derived classes |
  | D6 | Closed | :63 "both inline and in constants.md" |
  | D7 | Closed | :75 egress allow-list |
  | D8 | Partly closed | See K2 and D5 |
  | D9 | Closed | :88 MC-48 |

- K11 Every verifier probe proposal folded in or rejected (RUBRIC.md:123-128 "Rejected proposals: none") → FAIL (minor). I re-traced all 14 reports.
  - Contract R2 G(a)→MC-11 and MC-05; (b)→MC-12(b); (c)→MC-13; (d)→MC-10.
  - Contract R3 G(a)→MC-21; (b)→MC-47; (c)→MC-46; (d)→MC-12(a); (f)→MC-04. **(e) is only half adopted:** "every key's inputs are defined for every subject kind **and fit the ID grammar**" (P1-contract-lensR-3.md:63). MC-10 (:48) has the first half but not the grammar half. See D4.
  - Contract R3 F→MC-21.
  - RR R1 G→MC-40. RR R2 G→MC-41. RR R3 G→MC-40 and MC-44. RR R3 F→MC-41 and MC-40 ("newer document says it is ahead").
  - ADR R1 G→MC-45. ADR R1 F→:90. ADR R2 F→MC-21.
  - TM R1 G and TM R2 G→MC-23.
  - The Probe F proposals of contract R2, RR R1/R2 and TM R1/R2 target KICKOFF wording or the register's or threat model's own structure. They have no rubric counterpart (see C6).
- K12 KICKOFF §3 exit bars → PASS. The mappings: branch coverage→MC-07; mutation score→MC-08; drift 0→MC-05; scans→MC-33; citations→MC-21 and MC-43; the matrix columns→MC-48 and MC-42.
- K13 CLAUDE.md coverage → PASS. N1→MC-20 and MC-23; N2→MC-33; N3→MC-45 (CBS dependency); N4→MC-34; N5→MC-21 and MC-43; N6→MC-42; I-INT→MC-01 and MC-02; I-CONV→MC-03; I-CONS→MC-04 and MC-05; I-ONCE→MC-10, MC-14 and MC-18; I-FAIL→MC-11, MC-12, MC-19 and JL-1.
- K14 MC-12(b) applied to CONTRACT v3 §5.8 by reconstruction → FAIL as a rubric item (Probe F). I built the set of G5/G4 items outside owned case states from CONTRACT.md:351-352 and compared each with its §5.8 expiry:

  | Item state | §5.8 expiry | Line |
  |---|---|---|
  | Inbound RECEIVED, SCREENING | QUARANTINE | :362 |
  | Fallback outbound RESERVED, TRAVEL_RULE, SIMULATING | T5 | :366 |
  | AWAITING_APPROVAL | T5 | :367 |
  | APPROVED | QUARANTINE | :368 |
  | RETURNING | "as there" | :377 |

  None of these is PAUSE, so MC-12(b) as worded fails the contract on 6 or more rows. See D1.
- K15 MC-11 outcome alphabet, rebuilt from the CONTRACT §5 and §1.6 rows → FAIL (minor). Outcome sources that occur in CONTRACT but are missing from the alphabet at RUBRIC.md:49:

  | Missing source | Where CONTRACT uses it |
  |---|---|
  | travel-rule result (COMPLETE / incomplete) | :267-268 |
  | account standing (eligible / ineligible) | :237, :261, :273, :277 |
  | TR hash unchanged / changed | :276-277 |
  | CBS events `HoldChanged` not caused by us and `AccountStatusChanged` to frozen or closed | :108, :160 |

  See D2.
- K16 MC-05 against the CONTRACT cells → FAIL (minor), Probe F ambiguity.
  - CONTRACT.md:284 says "BROADCAST | nonce used, no receipt for any of our hashes (Q-A1) | **PAUSE**".
  - In that cell the chain balance falls by gas with no receipt to feed F (constants M-1: "blocklist reverts consume gas without a receipt"), or by an unknown transaction's outflow. Either way the residual is necessarily ≠ 0.
  - MC-05 says "exactly 0 wei in every (state × outcome) cell". It does not say whether such a cell counts as a "scenario that deliberately injects drift". See D3.
- K17 Probe G re-run (would this rubric pass a bad build?) → partly.
  - Caught: the R2 bad builds. (i) U11 skipping gas on status 0 gives −g in a non-drift cell, which MC-05 fails. (ii) U7 using `Number()` or an LLM is caught by MC-01 and MC-34, now that U7 is on the list. (iii) A deleted Rout row in §5.8 is caught by MC-12(b).
  - Not caught: (iv) a TRAVEL_RULE state with no "incomplete" or provider-error row passes MC-11, because the alphabet has no TR source (D2). Only the age row bounds it. (v) A derived ID longer than 128 characters, or outside the grammar, passes MC-10 (D4).
- K18 Probe F re-run (would this rubric fail a good build?) → YES.
  - Via D1: CONTRACT v3's AWAITING_APPROVAL→T5 after A_approval is correct. Nothing has been signed, and releasing the hold is the safe compensation. Yet MC-12(b) demands PAUSE, which would turn every un-approved payout into a rail-wide stop.
  - Via D3: ambiguity on the Q-A1 cell.
- K19 Regression check of frozen units → N/A. LEDGER.md:16-28 lists no unit with status frozen.
- K20 Judgment lenses JL-1..JL-6 → [inspection-only] PASS. Each anchor is one line, tied to a CLAUDE.md or KICKOFF §6 duty (fail-closed, N6/human decisions, operability, audit, fewest parts, privacy).

CANDIDATES
- C1 · RUBRIC.md:50 "(b) **Every pending reconciliation term or item** has a §5.8 row whose expiry is **PAUSE**: … G5/G4 items outside owned case states" vs CONTRACT.md:367 "Outbound AWAITING_APPROVAL | `A_approval` 24 h | T5 (condition 1), RELEASED" and :362 "Inbound RECEIVED, SCREENING | `A_decide` 15 min | QUARANTINE" · KICKOFF §4 Probe F · **REAL**.
  - Fallback-mode outbound items are G5 items (CONTRACT.md:351 "`gl.clearing.outbound` balance equals Σ (A+fee) of fallback-mode outbound items"), so the clause applies to them.
  - T5 before SIGNED is a balanced compensation that removes the item from G5 with nothing on-chain. QUARANTINE escalates to PAUSE by §1.6 (:107). Both are bounded and fail-closed, yet both fail the literal check.
  - The source proposal (P1-contract-lensR-2.md:64(b)) was aimed at post-finality Fact terms (N3), not at Decision-stage items.
- C2 · RUBRIC.md:49 MC-11 list (CBS result, send-time, receipt, nonce, policy, screening, simulation, approval, signer, disposition, age) vs CONTRACT.md:268 "TRAVEL_RULE | incomplete", :261 "standing ineligible", :277 "TR hash changed", :108 HoldChanged/AccountStatusChanged → QUARANTINE · MC-11 / JL-1 · **REAL (minor)**. The script "builds the alphabet per state" from a list that lacks these sources. The lead clause "every source that can reach it" and the age rows reduce the impact.
- C3 · RUBRIC.md:40 "Reconciliation residual is exactly 0 wei in every (state × outcome) cell" vs CONTRACT.md:284 (Q-A1 cell) and constants.md:96 M-1 · KICKOFF §3 exit bar, Probe F · **REAL (minor)**. A correct build must show a non-zero residual plus PAUSE in that cell. The rubric doesn't classify the cell as drift-injecting, so two verifiers could disagree.
- C4 · RUBRIC.md:48 MC-10 "Every subject kind has defined key inputs" vs P1-contract-lensR-3.md:63 (e) "…and fit the ID grammar", and RUBRIC.md:123 "adopted: the contract R2/R3 … probe proposals" · KICKOFF §4 · **REAL (minor)**. The adoption claim is partly false. The CONTRACT.md:39 case-return ID fits today (35 characters, recomputed), but nothing checks it.
- C5 · LEDGER.md:28 "MC-01…MC-47 … draft (fix blocks 1/2 used)" vs RUBRIC.md:3 and :88 · KICKOFF §4 ledger · **REAL (minor)**.
- C6 · The contract R2 Probe F ("≥64 bytes" key length; §7 completeness), RR R1 F (below-cut-off list), RR R2 F ("review" definition, display strings) and TM R1/R2 F (owner by phase or role, one-hop owner) are neither credited in RUBRIC.md nor listed as rejected (:128 "Rejected proposals: none") · KICKOFF §4 · **DISMISSED**. None of them maps to a rubric item. They relax KICKOFF wording or a register's or threat model's internal criteria, and they were applied in those documents (RISK_REGISTER.md:15, :24, :74; the register has a below-cut-off section). There is nothing in the rubric to relax.
- C7 · ADR R2 Probe G cites C-2 (a testnet-only rationale used for a mainnet-era recommendation), and no MC item catches that · MC-45 · **DISMISSED**. The report's actual proposal was to adopt R1 (a) and (b) (P1-adrs-lensR-2.md:42), which MC-45 does. C-2 was an example, not a proposal, and it was fixed in the ADR (LEDGER.md:24 "QuickNode testnet-only").
- C8 · RUBRIC.md:54 MC-16 "bisection on `-32602`", where -32602 is not in the docs (re-fetch: grep exit 1) · CLAUDE.md N5 "Never guess" · **DISMISSED**. It is an observed fact, cited as such (constants.md:62 C-41, with the live error text and Q-A4), and it is High severity in constants M-2. The rubric relies on it with its UNVERIFIED status intact.
- C9 · MC-12(a) flags outbound SCREENING (no row at CONTRACT.md:366) and the item-level PAUSED/QUARANTINED states · rubric Probe G · **DISMISSED as a rubric defect**. This is the rubric working correctly against the contract (already routed to P1-contract in R2 K21). It is still open in CONTRACT v3.
- C10 · MC-13's source cell (:51) does not credit contract R2 Probe G(c) · traceability · **DISMISSED**. Cosmetic. The content is present, and :123 credits contract R2 as a whole.

DEFECTS
- D1 · RUBRIC.md:50 MC-12(b) · R / KICKOFF §4 Probe F · **blocking**.
  - Problem: the literal check fails CONTRACT v3's correct age rows (:362, :366-368).
  - Fix: require PAUSE for the post-finality and accumulator terms (Rin, Rout, Rmove, D≥k, F≥k, notifications, G5/G4 items after on-chain finality). For pre-signing G5 items, also accept QUARANTINE that escalates to PAUSE within `A_quarantine`, or a balanced compensation (T5 condition 1) that removes the item from the term.
- D2 · RUBRIC.md:49 MC-11 · R / JL-1, Probe G · minor. Add these outcome sources: travel-rule result (complete, incomplete, provider error), standing (eligible, ineligible, stale), TR-hash re-check (unchanged, changed), and CBS events (`HoldChanged` not caused by us; `AccountStatusChanged` to frozen or closed).
- D3 · RUBRIC.md:40 MC-05 · R / KICKOFF §3, Probe F · minor. Name the cells where a non-zero residual is inherent: nonce consumed with no receipt for our hashes (Q-A1, M-1), and an unknown-hash outflow. Require PAUSE there and the exact residual equal to the unexplained movement. All other cells stay at exactly 0.
- D4 · RUBRIC.md:48 MC-10 (and the claim at :123) · R / KICKOFF §4 · minor. Add "every key input and every derived ID (for example the case-return `instructionId`) satisfies the CONTRACT §1.2 ID grammar for all inputs", or list the half that isn't adopted as rejected, with a reason.
- D5 · docs/LEDGER.md:28 · R / KICKOFF §4 ledger · minor. The intent says MC-01…MC-47, but MC-48 exists (37 MC in total). The status "fix blocks 1/2 used" should be 2/2, and should record that round 3 is NEGATIVE.

VERDICT: NEGATIVE (5 defects: 1 blocking, 4 minor)

Note for the operator: P1-rubric has used both fix blocks (RUBRIC.md:3). By LEDGER.md:28 and the KICKOFF §5 Phase 3 rule, the next step is plateau step 1 (reframe), not a third fix block.

Phase 1 · units frozen 0/10 · streak 0/3 · rounds used 3/10 (P1-rubric) · regen budget left 2
