VERIFICATION · lens: R · target: P1-adr-008 (docs/adr/ADR-008-independent-monitor.md, mtime 2026-10-03 11:54:16, sha256 e268da84dd5370ca…, after fix block 4) · commit: none (uncommitted working tree; `git rev-parse HEAD` → "unknown revision", repo has no commits)

Snapshot for the MC-40/MC-45 version clause. The target is newer than every sibling it is checked against:
- Older than the target: SEQUENCES 10-02 23:23 · ADR-001/ADR-002 11:41:55 · RUBRIC 11:42:21 · THREAT_MODEL 11:45:44 · CONTRACT 11:48:57 · RISK_REGISTER 11:49:23.
- Same block as the target: LEDGER 11:54:16, OPEN_QUESTIONS 11:54:23.
So any disagreement with a sibling counts against the target unless the target says it is ahead (or a CF item routes it).

CHECKS:
- ADR rule: options, trade-offs, recommendation → PASS. 4 options A/B/C/D counted at :78-84. Trade-offs are in the options table (RUBRIC:91 relaxation).
- ADR rule: per-phase recommendation (RUBRIC:92) → PASS. Testnet/pilot/GA rows at :109-111. The pilot blockers are named (:110: CF-5(f), (h), (i), Q-C18, Q-D1 (c)/(d)).
- ADR rule: prose agrees with the phase table (RUBRIC:93) → PASS. Consequences :114-116 assume B or D, and every row is B (or D).
- KICKOFF §5 Phase 1 item 4, "Do not decide" (KICKOFF:105) → PASS. :3 "Status: PROPOSED. A human decides at G1."
- KICKOFF U12 (KICKOFF:144) → PASS. The :13 quote is faithful with an ellipsis. Three-way is kept (:43), and so is two-human unpause (:99).
- KICKOFF §6 (KICKOFF:168, :171, :183) → PASS. Separate identity and credentials (:80), mutually authenticated channels (:95, :100), U5-equivalent controls on the monitor's copy of address↔account links (:103).
- CLAUDE.md quote at :14 vs CLAUDE.md "Fail closed" bullet → PASS (re-read; faithful with an ellipsis).
- R4 D1 (claimed items never aged) → FIXED for the un-posted variant, by re-trace with integers:
  · p=2, k=10^(18−2)=10^16. I1: 1000 minor → 10^19 wei (= 10^7 UsdcUnits). Gas 21000 × 20 gwei = 4.2×10^14 wei < k, so it stays in F.
  · The adapter leaves I1 in claimed Rout and releases the hold. Residual 0 every cycle.
  · :91 now says no claimed item may be older than its §5.8 age, measured from the finality block in the monitor's own fetch. CONTRACT:474 gives Rout A_post = 15 min = 900 s. The last ALL_CLEAR is issued at or before t_f + 900, and the signer honours it until before t_f + 900 + A_attest 60 = t_f + 960 s. → PAUSE.
  · Variant where the adapter drops I1 from Rout instead: residual = (−10^19 − 4.2×10^14) − (0 − 4.2×10^14) = −10^19 ≠ 0 → PAUSE.
  · Variant where the adapter inflates F or D to compensate: impossible, because :33-34 rebuild D and F from reference inputs.
  · The posted-to-the-wrong-account variant is NOT covered. See C-1 / D1.
- R4 D2 (option D token not bound) → FIXED. :81 "commits to `payloadDigest`, nonce and chain ID … refuses unless the token matches the exact transaction"; :84 "the token binds the approved content".
- R4 D3 (stale ADR-001 quote) → FIXED. :115 "ADR-001 already says this (duty list and "Signing log")" = ADR-001:14 "pushes each entry to the independent monitor … `(payloadHash, nonce, txHash, instructionId)`".
- R4 D4 (no exit for the adapter's PAUSE flag) → FIXED. :100 signed `RESUME` over a declared monitor→adapter link, plus a recorded resolution, with both shown in one on-call view.
- R4 D5 (Q-D1 (d) protocol) → FIXED in OPEN_QUESTIONS:84 and ADR-008:120. The ADR-001 mirror is stale; see C-5 / D5.
- R4 C-7 (map vs THREAT_MODEL executor list) → PASS by script. THREAT_MODEL:46 lists 24 IDs (22 DR + RD-01 + RD-03). The ADR map has 24 rows, and the symmetric difference is empty. DR-20 is correctly excluded (:46, THREAT_MODEL:49). The xpub input was added (:27).
- MC-40(e), every map input in the declared input set (:19-30) → FAIL. Five inputs aren't declared, and one doesn't exist (C-3 / D3).
- MC-40(c), inputs exist → FAIL for DR-16's "send results reported by the signer". No document gives the signer a send role (grep: only hit is ADR-008:56). CONTRACT:319 has the adapter sending the bytes (D3).
- Map renders as a table → FAIL. A blank line at :66 splits it. markdown-it (GFM tables) renders 16 table rows (DR-01 … DR-19). DR-21 … RD-03 (8 rows) render as a `<p>` of pipe text (C-4 / D4).
- MC-40(b) scope → PASS. S is built from reference inputs only (:40), and the registry is checked both ways (:41).
- MC-40(f) and fail-closed when the executor goes silent → PASS (:96 dead-man switch; :97 input loss → no ALL_CLEAR).
- MC-12(b), new ages A_attest/A_cycle/A_fresh → PASS. They are bounded and fail closed. They are not yet in Q-C17 (OPEN_QUESTIONS:56), which CF-9(c) tracks (LEDGER:48).
- MC-12 "final but not posted → PAUSE" with an executor outside the adapter → PASS for Rin/Rout/Rmove/D/F (:91), apart from the content gap in D1.
- Stop window for a fabricated payout (:81 "at most about 120 s"), recomputed → PASS. Final at 0. The last ALL_CLEAR built on a pre-finality fetch is issued before 0 + A_fresh 30, and honoured until before 30 + A_attest 60 = 90 s. 90 ≤ 120.
- Stop window for a genuine payout left un-posted → [inspection-only] FAIL (minor). It is 960 s, which the ADR doesn't state, and :84 "after the first transaction" overstates it (C-2 / D2).
- MC-21 → PASS (N/A). A grep of ADR-008 for hex literals ≥ 4 digits, gwei, `-320` codes and 4+-digit numbers returns nothing (exit 1).
- MC-43 → PASS (N/A). The only regulatory reference (POPIA PIA, :103) is routed to Q-R12.
- MC-44, reference by reference:
  · :3 "threat-model R5 verifier (D1, blocking)" → PASS.
  · **:3 "B9's wording "nothing from the adapter flows in"" → FAIL.** A grep of THREAT_MODEL finds no match. B9 (THREAT_MODEL:31) already has the reference / subject model. See D5.
  · :3 report list "-lensR.md, -lensR-2.md and -lensR-3.md" for "Fix blocks 1 to 4" → FAIL (minor). Fix 4 followed -lensR-4.md (D5).
  · :12 RR-3, RR-2 2e → PASS.
  · :21 L-3 → PASS.
  · :22 CF-5(f)/(h)/(i), Q-C18 → LEDGER:45, OPEN_QUESTIONS:57 → PASS.
  · :35 "verifier R3 D1" → PASS.
  · :36 CONTRACT §1.3 → CONTRACT:93 → PASS.
  · :39 ADR-001 duty 6 → ADR-001:13 → PASS.
  · :46 "24, per THREAT_MODEL's executor list" → PASS (counted).
  · :91 "CONTRACT §5.8 age", "T4/T9/T10" → CONTRACT:417, :474 → PASS.
  · :91 "verifier R4 D1" → lensR-4.md:121 → PASS.
  · :99 CONTRACT §1.6, SEQUENCES F7, CF-9 → PASS (tracked by LEDGER:48 (a)).
  · :103 L-2, L-8, DR-26, Q-R12 → PASS.
  · :115 CF-9(b) → CONTRACT:211 still has the 3-tuple, tracked → PASS.
  · :119-121 Q-D8, Q-D1, Q-C17 → PASS.
- MC-45 ADR-to-ADR:
  · ADR-001 duty 5 (ADR-001:12) = :96 → PASS.
  · ADR-001 duty 6 = :39 → PASS.
  · **ADR-001 Q-D1 (d) (ADR-001:53, "require the monitor's fresh `ALL_CLEAR` attestation") vs ADR-008:120 / OPEN_QUESTIONS:84 (full protocol) → FAIL**, not routed (D5).
  · ADR-002:31 node RPC reachable from the monitor segment → PASS.
- MC-45 vs THREAT_MODEL/RISK_REGISTER (older) → FAIL. Fix 4 added a monitor detection (the :91 ageing) and a monitor→adapter channel (:100). Neither is in THREAT_MODEL §D/B9 (B9 says the monitor "sends signed attestations **to the signer**") or RISK_REGISTER. There is no ahead note and no CF item (D5).
- MC-45 Q-D mirror → PASS (OPEN_QUESTIONS:84 and :91 list ADR-008, and the ADR has both at :119-120).
- MC-45 vendor-question coverage of signer-side controls → PASS (OPEN_QUESTIONS:84 (d) now lists sequence, precedence and direct channel).
- MC-45(d) dependencies fail closed → PASS (:97 input loss; :96 stale attestation; :99 "flag unreadable" → PAUSE).
- MC-19 design → PASS (:99 two humans).
- JL-1 Fail-closed → [inspection-only] FAIL (D1).
- JL-2 Human-owned → [inspection-only] PASS. Ages are "proposed" and routed to Q-C17 (:94, :121).
- JL-3 03:00 operability → [inspection-only] PASS. :100 has one view of both monitor state and adapter flag. The exit is two-person RESUME, consistent with CONTRACT:335/:468.
- JL-4 Auditability → [inspection-only] PASS, with the D4 rendering caveat.
- JL-5 Fewest new parts → [inspection-only] PASS (Q-D8).
- JL-6 Privacy → [inspection-only] PASS (:103).
- MC-01…08, 10, 11, 13–20, 22–24, 30–34, 42, 46–48 → N/A. There are no amounts, templates, keys, state tables, events or code in this ADR.
- Regression check of frozen units → N/A by recount. LEDGER:22-33 has 12 units, and 0 have status frozen.

CANDIDATES:
- C-1 · ADR-008:91 "an Rout item final for longer than `A_post` without its T4/T9/T10 in the CBS journals means PAUSE"; :35 "**The match binds content, not just IDs**", applied only chain ↔ approval (:36-37); :43 "A compromised adapter … gains nothing"; :84 B "Detects and stops it after the first transaction". CONTRACT:163 `placeHold {key, accountRef, amount}`, where the adapter supplies `accountRef` and nothing binds it to the instruction's `accountRef` (CONTRACT:181). CONTRACT:93: `payloadDigest` has no source account. · JL-1 (claim accuracy), MC-40(b) (the posting's content is written by the checked component and never compared with a reference), R3 D1 class (ID-only join), THREAT_MODEL T-E1 (named at :9) · **REAL**.
  Integer re-trace, hold mode, fee 0 (the G6 leg is omitted):
  · CBS instruction I1: accountRef C, 1000 minor, destination X. Genuine approval of digest(10^19 wei, X, I1).
  · The compromised adapter calls `placeHold{K.reserve(I1,0), accountRef: V, amount: 1000}`. V is an uninvolved Arc-product customer with funds.
  · The signer signs (approval genuine, shape and limits OK, ALL_CLEAR). The tx is final with status 1: hot Δ = −10^19 − 4.2×10^14.
  · `settleHold(H_V)` under K.settle(I1,0): DR G1[V] 1000, CR G2.hot 1000 → CBS_G2×k Δ = −10^19. F += 4.2×10^14.
  · Residual = (−10^19 − 4.2×10^14) − (−10^19 − 4.2×10^14) = 0.
  · DR-01: digest recomputed from (X, 10^19, I1) = approval → pass. DR-25: 1 tx per approval. DR-13: matched. DR-07: K.settle(I1,0) is in `listJournals`, legs in the G-set, and there is no G5 term in hold mode. :91: T4 present by key, so nothing ages. → ALL_CLEAR every cycle.
  · V loses 1000 minor per payout. C keeps its balance and receives 10 USDC at X. This repeats daily up to the signer's limits, and stops only on V's statement complaint ([X], THREAT_MODEL T-E1).
  · The inbound twin: T2 for a deposit of 25000 minor (2.5×10^20 wei) to merchant M's correct registry address, posted `CR G1[C]`. Residual 0. DR-23 passes because the registry is correct. Only [X] remains.
  The monitor already reads both references (`listPayoutInstructions` accountRef/amount, `listIssuedAddresses` address→accountRef, `listJournals` legs, :22) but never binds a posting's account and amount to them. Severity blocking: it is a repeatable theft path for the exact attacker ADR-008 exists for, it passes the new fix-4 precondition by ID alone, and it contradicts :43/:84, on which the G1 choice between B and D rests (D doesn't close it either).
  Counter-argument considered: THREAT_MODEL T-E1/T-T2 already list [X] customer and merchant complaints, so the risk isn't strictly blind. That limits blindness, not the ADR's overclaim.
- C-2 · ADR-008:84 B "**Detects and stops it after the first transaction**, limits bound the loss"; :81 gives only the fabricated-payout window (≈120 s); :91 ageing at A_post · JL-1 claim accuracy · **REAL** (minor) · Computed window for a genuine payout left un-posted: t_f + 900 + 60 = 960 s, 8× the stated 120 s. Every approved payout in that window (each needs only a genuine approval for a colluding customer whose hold is released) goes through. That is not "after the first transaction". The bound is honest only if the table states it.
- C-3 · ADR-008:51 DR-03 "Checkers' FIDO2 credentials"; :53 DR-05 subject "Adapter's outbox and audit chain"; :56 DR-16 "send results reported by the signer" and subject "Adapter's configured fee floor"; :39 "the move caps (ADR-001 duty 6)". The declared reference rows :21-28 and subject rows :29-30 contain none of: FIDO2 credentials, move caps, signer send results, outbox/audit chain, fee floor. The :24 signing log is the 4-tuple only. CONTRACT:319 has the adapter sending the bytes, and no document gives the signer a send role. · MC-40(e) "every input is in that executor's declared input set", MC-40(c) "every input exists" · **REAL** (minor) · Source and owner unstated for credentials and caps. If DR-16's underpriced signal can only come from the adapter, it is a subject input mislabelled as reference.
- C-4 · ADR-008:66 is an empty line inside the :48-74 table · RUBRIC MC-40(e) map completeness as read; JL-4 · **REAL** (minor) · markdown-it with GFM tables renders 16 rows. DR-21, DR-22, DR-23, DR-24, DR-25, DR-26, RD-01 and RD-03 render as a paragraph of pipe text, so a G1 reader sees 16 of the claimed 24.
- C-5 · ADR-008:3 "This ADR is **ahead of THREAT_MODEL** … B9's wording "nothing from the adapter flows in" … DR-01 needs CF-5(i) … content-binding rule (CF-10)". A THREAT_MODEL grep finds no such wording; B9 (:31), DR-01 (:153) and residual 6 (:189) already say all three; LEDGER:51 shows CF-10 CLOSED. Meanwhile, fix 4's own forward changes aren't in the note or in any CF item: (i) the :91 ageing detection (absent from THREAT_MODEL §D, B9 and the monitor section :44, and from RISK_REGISTER); (ii) the :100 monitor→adapter `RESUME` link (THREAT_MODEL:31 B9 has monitor → signer only); (iii) Q-D1 (d)'s full protocol vs ADR-001:53. :3 also omits -lensR-4.md from the reports behind "Fix blocks 1 to 4". · MC-44, MC-45 (+ MC-40 version clause: the newer document must say it is ahead) · **REAL** (minor) · The target is the newest document. LEDGER CF-9 (a)–(d) and CF-13 contain none of (i)–(iii).
- C-6 · ADR-008:91 ageing starts "from the finality block", so signed-but-unsent bytes (MC-12 list: "signed-not-broadcast") aren't aged by the monitor · MC-12 additional rule · DISMISSED · Re-trace: withheld bytes at nonce n block every later nonce. If the adapter re-signs n for another instruction, the withheld bytes are dead. If it sends them later, they become final → Rout → aged by :91 (or C-1). There is no extra loss path, and the adapter-side A_broadcast (CONTRACT:472) remains.
- C-7 · ADR-008:91 reuses CONTRACT's adapter age `A_post` on a different clock (the monitor's finality block) · queued MC-12(c) (LEDGER:40) · DISMISSED · The proposal is not yet in RUBRIC (cut-off rule, RUBRIC:163), and the meaning (final, not posted) is the same.
- C-8 · ADR-008:67 DR-21 "registry identifiers hashed by the monitor", source unnamed · MC-40(b) · DISMISSED (carried from R4 C-10) · `listIssuedAddresses` (:22) carries the accountRefs. Advisory: name it.
- C-9 · ADR-008:91 "T4 … in the CBS journals": in hold mode T4 is `settleHold`, and CONTRACT:173 `listJournals` doesn't say hold settlements appear · MC-40(c) · DISMISSED · CONTRACT:219 gives settleHold legs and key K.settle, and P10.2 maps `listJournals`. Advisory to P1-contract: state that hold settlements appear in `listJournals` with their key.

PROBE G (would the rubric wave through a bad version?): YES, the C-1 version. MC-17 binds chain transfers to instructions, MC-04 checks balancing, MC-40(b) checks reference inputs exist, and MC-12 checks ageing. None requires that a **CBS posting's account and amount** be bound to the CBS's own reference record. Only JL-1 catches it. Proposal (cut-off rule, RUBRIC:163; routed to P1-rubric): "MC-17(b): every posting that debits or credits a customer (T2, T3/T4, T11, T5) is bound by content to the CBS's own record (the instruction's accountRef and amount; the issuance record's address→accountRef), checked by an executor outside the adapter."

PROBE F (would it fail a good version?): YES, partly. Read literally, MC-40(e) "every input is in that executor's declared input set" fails the DR-11 (`eth_call`), DR-16 (headers) and DR-21 (tx inputs) rows, because :21 lists chain data as "(logs, receipts, balances, nonces, code)". Declaring by category with a named source is a good design. I passed those rows by reading the parenthetical as examples. Proposal: "a declared input set may be stated by category with its source; an input satisfies MC-40(e) if it falls in a declared category". Also carried from R4: the testnet co-location reading of MC-40(e). R4's Probe G/F proposals are missing from the LEDGER queue (LEDGER:36-41). Routed.

DEFECTS:
- D1 · ADR-008:91 (ageing clears on "its T4" by key), :35-37 (binding stops at chain ↔ approval), :43, :84 vs CONTRACT:163, :93 · R, JL-1 + MC-40(b) · **blocking**
- D2 · ADR-008:81, :84 (the un-posted window of 960 s isn't stated; "after the first transaction") · R, JL-1 claim accuracy · minor
- D3 · ADR-008:39, :51, :53, :56 vs :19-30 and CONTRACT:319 · R, MC-40(c)/(e) · minor
- D4 · ADR-008:66 (blank line splits the map; 8 of 24 rows don't render) · R, MC-40(e)/JL-4 · minor
- D5 · ADR-008:3 (stale ahead note and report list), and fix-4 changes at :91, :100, :120 not routed (no ahead note, no CF item) vs THREAT_MODEL:31/:44, RISK_REGISTER, ADR-001:53 · R, MC-44 + MC-45 · minor

Routed (not counted against this unit):
- P1-threat-model / P1-risk-register: the C-1 sub-risk (customer posting to the wrong account by a compromised adapter, inbound and outbound) has no row and no [R] detection. RISK_REGISTER:92 says "Add a row whenever a verifier finds a defect class that no row covers".
- P1-contract: CBS-side binding of `placeHold`/`settleHold` and T2 `accountRef` to the instruction or issuance record would prevent C-1 at the source. `listJournals` should state that hold settlements appear (C-9).
- LEDGER: the R4 Probe G/F proposals aren't in the rubric proposal queue. The P1-adr-008 row should record R5.
- P1-rubric: the Probe G and Probe F proposals above.

VERDICT: NEGATIVE (5 defects: 1 blocking, 4 minor)

Phase 1 · units frozen 0/12 · streak 0/3 · rounds used 5/10 (P1-adr-008) · regen budget left 1
