VERIFICATION · lens: R · target: P1-adr-008 (docs/adr/ADR-008-independent-monitor.md, mtime 2026-10-05 12:03:30, sha256 18ff96fcf0c21714…, after fix block 5; round 6) · commit: none (uncommitted working tree; repo has no commits)

Snapshot for the MC-40/MC-45 version clause. The target is newer than every sibling it is checked against: RISK_REGISTER 10-03 11:49:23 (v3 fix block 4) · ADR-001 10-05 11:52:05 (fix 8) · THREAT_MODEL 11:54:55 (v2 fix 7) · RUBRIC 11:59:04 · CONTRACT and OPEN_QUESTIONS 12:02:49 (v3 fix G) · target 12:03:30 · LEDGER 12:03:42. The :3 version pins (THREAT_MODEL v2 fix 7, CONTRACT v3 fix G, ADR-001 fix 8, RISK_REGISTER v3 fix 4) match the siblings' own headers and the LEDGER rows. Any disagreement with a sibling therefore counts against the target, unless the target says it is ahead or an open CF item routes it.

The guard hook was not loaded in this session. No RPC calls or network fetches were made (MC-21 is N/A, see below). No .env files or keys were read.

CHECKS:
- ADR rule: options, trade-offs, recommendation → PASS. 4 options A–D (:81-87). Trade-offs are in the options table (RUBRIC:91).
- ADR rule: per-phase recommendation → PASS. Testnet, pilot and GA rows at :114-116. The pilot blockers are named (CF-5(f)/(h)/(i), Q-C18, Q-D1 (c)/(d)).
- ADR rule: prose agrees with the phase table → PASS. Every row is B (or D). The consequences at :119-121 assume B or D.
- KICKOFF "Do not decide" → PASS. :3 says "PROPOSED. A human decides at G1".
- KICKOFF U12 (KICKOFF:144) → PASS. Three-way reconciliation is kept (:45), and two-human unpause is kept (:104).
- CLAUDE.md fail-closed quote at :14 → PASS (CLAUDE.md:18, faithful with an ellipsis).
- R5 D1 (blocking: wrong-account posting reconciles to 0) → FIXED, contingent on Q-C19 / CF-16(b). Re-traced with integers: p=2, k=10^16, I1 = (C, 1000 minor, X), fee 0.
  · The original mutant is `placeHold{K.reserve(I1,0), accountRef V}`. It is no longer expressible: CONTRACT:188 has `placeHold {key, instructionId}`, and the CBS takes the account and A + fee from its own instruction. CONTRACT:190 binds settleHold's debit to the hold's account, and anything else is `BINDING_MISMATCH` → PAUSE (CONTRACT:116).
  · Indirection variant: the adapter names V's genuine instruction I2 (1000 minor, destination Y), so `placeHold{K.reserve(I1,0), instructionId I2}` puts H_V on V. I1's tx (10^19 wei to X) goes final, then `settleHold{K.settle(I1,0), H_V, I2}`. The CBS accepts, because the binding is to the I2 it was given. Residual = (−10^19 − gas) − (−10^19 − gas) = 0. DR-01: digest(X, 10^19, I1) = approval → pass. :94 ageing: a K.settle(I1,0) journal exists → pass.
  · DR-29 still catches it. `listJournals` returns only `{journalId, key, legs, postedAt}` (CONTRACT:198), with no `refs`, so the monitor can reach "the CBS's own record" only through the key. K.settle(I1,0) → I1 → accountRef C ≠ leg V → PAUSE.
  · If the adapter keys the journal K.settle(I2,0) instead, there is no T4 for I1, and :94 PAUSEs at t_f + 900 + 60 = 960 s.
  · The inbound twin (T2 to C for a deposit to M's address) is caught the same way: the key is recomputed from the monitor's own log, and the issuance record of the log's `to` (M) ≠ the leg's account (C).
  · [inspection-only] advisory: DR-29's join key is implied by the inputs, not stated (see C-8).
- R5 D2 (un-posted window) → FIXED. Recomputed:
  · Fabricated payout: the last ALL_CLEAR built on a pre-finality fetch is issued before 0 + A_fresh 30 and honoured until before 90 s. 90 ≤ the stated bound A_cycle 60 + A_attest 60 = 120 s.
  · Genuine payout left un-posted: 900 (A_post, CONTRACT:514) + 60 = 960 s = 16 min, matching ":84 about 16 min" and ":87".
  · "After the first transaction" is gone.
- R5 D3 (undeclared inputs) → PARTLY FIXED:
  · Fixed: move caps (:23), the FIDO2 registry (:28), own DB identity (:29). The signer no longer has send results (DR-16 part (2) uses headers only, :58).
  · Still open: subject inputs (D5).
- R5 D4 (map split) → FIXED. markdown-it (GFM tables) renders the map as one table, lines 49-77, with 27 tr = header + 26 rows. The input table renders 12 tr.
- R5 D5 (stale ahead note) → PARTLY FIXED:
  · Fixed: the report list (:3), the false B9 quotation (removed), and Q-D1(d) (ADR-001:68 now has the full protocol, matching OPEN_QUESTIONS:85 and ADR-008:125).
  · Still open: the ageing detection and the RESUME channel are still unrouted (D2).
- MC-40(e) map coverage, by script → PASS. The THREAT_MODEL:53 monitor executor list has 25 IDs. The ADR map has 26 rows. The symmetric difference is {DR-29}, which the ADR declares as proposed (:48). The excluded DR-20, DR-26 part (2) and DR-16 part (1) match THREAT_MODEL:55-56.
- MC-40(e) every reference input in the declared set (:19-31) → PASS row by row:
  · DR-01, DR-04, DR-08, DR-17, DR-21, DR-22, DR-23/24, DR-25, DR-26(1), DR-28 and DR-29 → :21-28.
  · RD-01 → CBS reads tagged with `p` (CONTRACT:25) = `getBalancesAsOf` and `listJournals` (:22).
- MC-40(e) subject inputs declared → FAIL. These are not in the subject categories at :30-31: DR-05 "outbox and audit chain" and DR-16(2) "configured fee floor" (D5).
- MC-40(b)/(c) DR-03 row → FAIL. Its only route to "the transaction actually signed" is the signer's own log, and it lists no own-node transaction (D6).
- MC-40(b) scope → PASS. S comes from reference inputs only (:42), and registry rows are checked both ways (:43).
- MC-40(b) reference artefacts are THREAT_MODEL assets → PASS. Treasury list and caps, honeytoken/canary lists, WORM anchor, FIDO2 registry and xpub are in T-T6/T-I2/T-I3. The DB audit log is engine-protected (T-T6).
- MC-40(f) and fail-closed when the executor goes silent → PASS:
  · :99 stale or missing attestation → refuse;
  · :100 input loss → no ALL_CLEAR;
  · :103 unsigned or unexpected artefact version → no ALL_CLEAR;
  · :104 "flag unreadable" → PAUSE.
- MC-12(b)/(d), claimed items aged by an independent executor → PASS. :94 ages from the monitor's own finality block. CONTRACT:491/:514 give `A_post` 15 min → PAUSE.
- MC-12(c) → PASS. A_post keeps the meaning "final, not posted", and A_attest/A_cycle/A_fresh are new and listed in Q-C17 (OPEN_QUESTIONS:56, values 60/60/30 s match).
- MC-17(a), content binding of outflow joins → PASS. Payout: digest recomputed from the final tx's `to` and value plus `instructionId` (CONTRACT:104 inputs amountWei, asset, chainId, destination, instructionId are all available to the monitor). Case return: `returnDestination` and `returnAmount × k`. Move: Treasury list and caps. Cancel class: :41 = THREAT_MODEL:163.
- MC-17(b), wrong-account mutant re-traced against CONTRACT §3 and the monitor's joins → PASS (see the R5 D1 line), contingent on Q-C19 and CF-16(b). The prose at :45 overstates what the CBS binds (D3).
- MC-19 design → PASS (:104, two humans).
- MC-21 → N/A. A grep of the ADR for `5042`, `gwei`, hex literals of 4+ digits and `-320` returned nothing (exit 1). There is no Arc value to re-fetch, so `tools/source_drift.py` was not needed for this unit.
- MC-43 → PASS (N/A). The POPIA reference (:108) is routed to Q-R12 (OPEN_QUESTIONS:72).
- MC-44, reference by reference:
  · :3 report list, version pins → PASS.
  · :9-12 T-S1/T-T2/T-E1/T-E2, RR-3, RR-2 2e → PASS.
  · :22 CF-5(f)/(h)/(i), Q-C18 → LEDGER:52, OPEN_QUESTIONS:57 → PASS.
  · :36 "verifier R3 D1" → PASS.
  · :37 CONTRACT §1.3 → CONTRACT:104 → PASS.
  · :40 ADR-001 duty 6 → ADR-001:23 → PASS for the reference, but the content disagrees (D4).
  · :41 CF-18 → LEDGER:59 → PASS.
  · :45 CONTRACT §3 fix F → CONTRACT:116/:186/:188/:190 → PASS. Q-C19 → OPEN_QUESTIONS:59 → PASS. CF-16(b) → LEDGER:57 → PASS. **"G1 residual RB-13" → FAIL**: no RB-13 exists in RISK_REGISTER (last ID RB-11), THREAT_MODEL, G1_PACKET or LEDGER (D1).
  · :94 "CONTRACT §5.8 age", "verifier R4 D1" → PASS.
  · :102 T-T6, T-B1, T-SC2, T-I3, DR-26 part (2), residual 13 → THREAT_MODEL:83, :129, :136, :99, :187, :210 → PASS.
  · :103 CF-23 → LEDGER:61 → PASS.
  · :104 CONTRACT §1.6, SEQUENCES F7, CF-9 → PASS.
  · :120 CF-9(b) → CONTRACT:236 still has the 3-tuple, tracked → PASS.
  · :124-126 Q-D8, Q-D1, Q-C17 → PASS.
- MC-45 ADR ↔ ADR-001:
  · duty 5 = :99 (sequence, PAUSE precedence, stale) → PASS. A stale PAUSE is ignored under ADR-001:22. This is equivalent, because an earlier ALL_CLEAR is then stale too.
  · Q-D1 (c)/(d) restatement (:125) = OPEN_QUESTIONS:85 → PASS.
  · **Caps → FAIL (D4).** ADR-001:20 "every cap bounds [value + gasLimit × maxFeePerGas]" and ADR-001:23 "[cancels'] fees count against the daily cap", versus ADR-008:40 "an amount within the move caps" and :41 "counts against no cap". Boundary (MC-45): a move with value = per-move cap C and fee f > 0 is refused by the signer (C + f > C) and accepted by the monitor (C ≤ C).
- MC-45 ADR ↔ THREAT_MODEL:
  · input model = B9 and the monitor section → PASS.
  · DR-01 cancel class → PASS.
  · Operator channel = THREAT_MODEL:44 → PASS.
  · **T-T6 artefact verification on load → FAIL (D7).** :103 omits the identity-provider trust configuration and the WORM anchor, which T-T6 (THREAT_MODEL:83) lists as artefacts the monitor relies on.
- MC-45 ADR ↔ CONTRACT: **binding scope → FAIL (D3).** :45 "takes the account and amount of every hold and customer-account leg from its own records" versus CONTRACT:186 "Amounts that start on-chain (T2, T8, T11, unid), and T2's refs.address, can't be checked by the CBS".
- MC-40 label clause, the "ahead … on one point" claim (:3) re-checked → FAIL (D2). The target is also ahead of THREAT_MODEL on the :94 ageing detection and the :105 monitor→adapter RESUME channel (THREAT_MODEL:33 B9 has monitor → signer only; there is no §D or executor entry for ageing; a grep finds no "RESUME" or "A_post" in THREAT_MODEL). It is also ahead of RISK_REGISTER on RB-13. No CF item routes the first two (CF-9 (a)–(d) and CF-16 don't name them).
- MC-45, every external dependency fails closed → PASS. CBS, nodes and screening (:100), the signer (dead-man switch, :99), and the paging path (:101).
- JL-1 Fail-closed → [inspection-only] PASS. Every gap ends in "no ALL_CLEAR" or PAUSE, and the windows are stated honestly. D3 is a claim-accuracy issue, not a fail-open path.
- JL-2 Human-owned → [inspection-only] PASS. Ages are "proposed" and routed to Q-C17. Unpause takes two humans, and a PAUSE request needs one owner.
- JL-3 03:00 operability → [inspection-only] PASS, with an advisory on the RESUME name (C-9).
- JL-4 Auditability → [inspection-only] PASS. The map renders in full.
- JL-5 Fewest new parts → [inspection-only] PASS (Q-D8).
- JL-6 Privacy → [inspection-only] PASS (:108).
- MC-01–08, 10, 11, 13–16, 18, 20, 22–24, 30–34, 42, 46–48 → N/A. There are no amounts, templates, keys, state tables, events, statuses or code in this ADR.
- Regression check of frozen units → N/A by recount. LEDGER:25-36 has 12 units, and 0 are frozen.

CANDIDATES:
- C-1 · ADR-008:45 "this path is G1 residual RB-13"; :87 "Wrong-account postings: see DR-29 and RB-13". RISK_REGISTER's residual IDs end at RB-11 (RISK_REGISTER:88). A grep for RB-13 across the repo hits only CONTRACT:186 and ADR-008. LEDGER:57 CF-16(c) says "in the drafted RISK_REGISTER fix 5", and no such draft is on disk. · MC-44 (the ID doesn't resolve), MC-45 (residual lists matched per sub-risk), MC-41 · **REAL** (minor). A G1 reader can't find the residual that this ADR says covers the open wrong-account path. CF-16(c) routes a RISK_REGISTER row, but the ADR states RB-13 as existing rather than "to be created (CF-16(c))".
- C-2 · ADR-008:3 "ahead of THREAT_MODEL on one point: … DR-29"; :94 the monitor's ageing precondition; :105 "the monitor sends a signed `RESUME` to the adapter over a declared monitor→adapter channel". THREAT_MODEL:33 B9: "It sends signed attestations to the signer"; THREAT_MODEL:53 (executor list) and §D have no ageing check. · MC-40 label clause ("only"/"ahead" claims re-checked; a newer document must say it is ahead or LEDGER must route it), MC-45 · **REAL** (minor). This was R5 D5 (i)/(ii), and fix 5 didn't route it. Also ahead of RISK_REGISTER (C-1).
- C-3 · ADR-008:45 "the CBS takes the account and amount of every hold and customer-account leg from its own records" vs CONTRACT:186 "Amounts that start on-chain (T2, T8, T11, unid), and T2's refs.address, can't be checked by the CBS. They are the adapter's claim, bound outside the adapter by … DR-29". · JL-1 claim accuracy, MC-45 (agreement with CONTRACT on the control the ADR owns) · **REAL** (minor). For inbound credits only DR-29 binds the amount and the address, so "stops at the CBS" is true only for holds and outbound legs. The next sentence ("or at the first reconciliation cycle") keeps the overall claim safe, so it is minor.
- C-4 · ADR-008:40 "an amount within the move caps (ADR-001 duty 6)"; :41 "It moves no value and counts against no cap"; ADR-001:20 "the most a signature can debit is value + gasLimit × maxFeePerGas, and every cap bounds that total"; ADR-001:23 "They count against no value cap, but their fees count against the daily cap and the fee limits of item 3". · MC-45 (ADRs on the same control agree; caps checked at the boundary) · **REAL** (minor). Boundary re-trace, per-move cap C (a multiple of k), move value C, fee f = 21000 × 20 gwei = 4.2×10^14 wei: the signer gets C + 4.2×10^14 > C → refuse; the monitor gets C ≤ C → accept. The monitor's check of the same cap is weaker than the control it double-checks, and :41 contradicts ADR-001 outright on cancel fees. The money impact is bounded by the signer's fee ceilings, hence minor.
- C-5 · ADR-008:55 DR-05 subject "Adapter's outbox and audit chain"; :58 DR-16(2) subject "Adapter's configured fee floor"; declared subject rows :30 "Adapter logs and telemetry, the adapter's local nonce, its screening and monitoring requests" and :31 "Adapter claims, by category: in-flight items …, its configured precision `p`, and its PAUSE flag". THREAT_MODEL:181 DR-19 also has the monitor exercise the adapter's read-only lookup path, which isn't declared either. · MC-40(e) (subject inputs declared, at least by category) · **REAL** (minor). This was R5 D3, which fix 5 fixed for reference inputs only. The :31 list enumerates config items (`p`) yet omits the fee floor, and the outbox and audit chain aren't an "adapter claim" category.
- C-6 · ADR-008:53 DR-03 reference inputs: "Checkers' FIDO2 credential registry (Security); CBS approvals with stored assertions (`listApprovals`); signing log", with no own-node transaction. THREAT_MODEL:165 DR-03 checks the challenge "against the recomputed payloadDigest of the transaction actually signed", with the mutant "after a signer bug". · MC-40(c) (the input carries the mutant's signal), MC-40(b) (the checked component, here the signer, writes the signing log) · **REAL** (minor). Under the listed inputs, the only representation of "the transaction actually signed" is the signer's own `payloadHash`. A buggy signer that logs the approved hash while signing other content passes DR-03 as mapped. The fix is to add "own-node transaction fetched by the signing log's `txHash`" to the row (DR-01 and DR-25 already list own receipts). DR-01 catches payouts independently, so this is minor.
- C-7 · ADR-008:103 "the monitor accepts a reference artefact (Treasury's list and caps, the honeytoken and canary lists, the xpub, the credential registry) only if it is signed by its owner and matches the pinned version" vs THREAT_MODEL:83 T-T6 "the WORM anchor … the identity-provider trust configuration … The monitor, the signer and the egress proxy verify the signature and the pinned version on load". · MC-45, backward trace from the T-T6 owner cell · **REAL** (minor). The monitor relies on IdP trust for DR-08 unpause and for operator-channel PAUSE requests (:102). A substituted IdP trust configuration combined with an adapter compromise allows a forged two-person unpause. The parenthetical reads as exhaustive.
- C-8 · ADR-008:45 "DR-29 joins every CBS journal's customer-account legs to those same records"; the join key is unstated. · MC-17(b), MC-40(c) · DISMISSED. CONTRACT:198 `listJournals` returns `{journalId, key, legs, postedAt}` with no `refs`, so a key join is the only one the declared inputs allow, and it catches the I2-indirection variant (re-trace above). Advisory: state "joined by the key the monitor recomputes from the instruction, issuance or log, never by the adapter's `refs`", so that a future `refs` field doesn't weaken it.
- C-9 · ADR-008:105 "signed `RESUME`" (rail-level flag clear) vs CONTRACT:84/:145 `RESUME` (closed-list item resolution: "back to the state it was quarantined from"). · MC-44 closed-list names, JL-3 · DISMISSED. The ADR qualifies the term (signed, monitor→adapter channel, after a two-person unpause), and CONTRACT §1.6 alignment is routed as CF-9(a). Advisory: rename it (for example `RAIL_RESUME`) when CF-9(a) lands.
- C-10 · ADR-008:40 Rmove checks `to` and caps only, while ADR-001:23 requires a checker assertion for a move strictly above the threshold, and the monitor doesn't check it. · MC-45 · DISMISSED. The value stays inside Treasury-listed wallets, and the combined Treasury-artefact plus adapter compromise is THREAT_MODEL residual 8.
- C-11 · Pilot row (:115) doesn't list Q-C19 / CF-16(b) as a blocker. · ADR per-phase rule · DISMISSED. The rule needs named blockers only where a phase is blocked. The open path is declared a G1 residual for the human (subject to C-1).

PROBE G (would the rubric wave through a bad version?): YES. MC-44 checks that a name used *from* a closed list is in that list, and MC-12(c) forbids reusing a *named age*. Nothing forbids reusing a closed-list name (`RESUME`) for a different message or action in another document (C-9). Proposal (for the LEDGER rubric queue): "MC-12(c)/MC-44: a name in any closed list (resolutions, reasons, states, ages) is never reused with a different meaning in another document."

PROBE F (would it fail a good version?): YES, partly. A good ADR that proposes a new detection, ahead of its siblings, needs to point at the residual the sibling *will* create. MC-44 as written fails any such forward ID (C-1), even when an open CF item routes it. Proposal: "a forward reference to a sibling ID passes MC-44 if it is marked as not yet created and names the open CF item that creates it."

DEFECTS:
- D1 · ADR-008:45, :87 ("G1 residual RB-13"; no RB-13 exists) · R, MC-44 + MC-45 (residual lists) · minor
- D2 · ADR-008:3 ("ahead … on one point") vs :94 ageing and :105 monitor→adapter RESUME channel, both absent from THREAT_MODEL B9/§D and unrouted; also ahead of RISK_REGISTER (RB-13) · R, MC-40 label clause + MC-45 · minor
- D3 · ADR-008:45 (CBS binds "account and amount of every … customer-account leg") vs CONTRACT:186 (on-chain amounts and T2 address not CBS-checkable) · R, JL-1 claim accuracy + MC-45 · minor
- D4 · ADR-008:40-41 (move caps on amount only; cancels "count against no cap") vs ADR-001:20, :23 (caps bound value + worst-case fee; cancel fees count) · R, MC-45 (ADR↔ADR, boundary) · minor
- D5 · ADR-008:55, :58 subject inputs (outbox/audit chain, configured fee floor) not in the declared subject set :30-31 · R, MC-40(e) · minor
- D6 · ADR-008:53 DR-03 lists no own-node transaction; the signer's log is the only route to "the transaction actually signed" · R, MC-40(b)/(c) · minor
- D7 · ADR-008:103 artefact-on-load list omits the IdP trust configuration and the WORM anchor (THREAT_MODEL T-T6) · R, MC-45 · minor

Routed (not counted against this unit):
- P1-risk-register: create RB-13 (CF-16(c)). CONTRACT:186 cites it too.
- P1-threat-model: DR-29 and its T-T row (CF-16(b)); the monitor's ageing check in §D or the executor list; the monitor→adapter RESUME channel in B9 (new CF item needed).
- P1-contract: §1.6 rail-level RESUME naming (with CF-9(a)).
- LEDGER rubric queue: the Probe G and Probe F proposals above.

VERDICT: NEGATIVE (7 defects: 0 blocking, 7 minor)

Phase 1 · units frozen 0/12 · streak 0/3 · rounds used 6/10 (P1-adr-008) · regen budget left 1
