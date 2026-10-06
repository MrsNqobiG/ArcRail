VERIFICATION · lens: R · target: P1-threat-model (docs/THREAT_MODEL.md, version 2 after fix block 10, Phase 1 close-out round 2) · commit: none (uncommitted working tree; `git status` → "No commits yet"; sha256(docs/THREAT_MODEL.md) = 863dcfbfc105226948e0616de67b27268df0ad0aed3ca35cf06f2dde58ac7929, mtime 2026-10-05 16:37:20 +0200, unchanged from pass start to pass end)

Criteria: .claude/agents/verifier.md; docs/RUBRIC.md (sha256 62698867…, v2 fix block 12, unchanged during the pass). Phase 1 exit rule in force (LEDGER 2026-10-05): the unit freezes when a pass finds zero BLOCKING defects; minor defects are carried to the G1 packet. Blocking = money can be lost, misposted or moved without the required control, or a fail-closed path is missing; minor = everything else.
Prior report: P1-threat-model-lensR-13.md (D1 blocking, D2–D4 minor).
Session constraints obeyed by hand (the guard hook was not loaded): Arc testnet (5042002) read-only RPC only; no signing or sending method; no mainnet endpoint; no .env or key read; no temp files written. The only file written is this report.

## Sibling pins (start 2026-10-05 17:11:10 +0200; end 17:15:36 +0200)
| Sibling | sha256 (start) | End of pass | Header fix block |
|---|---|---|---|
| CONTRACT | 3f1141e8… (mtime 16:35:00) | unchanged | **v3 fix block J** |
| RISK_REGISTER | 48930790… | unchanged | v3 fix block 6 |
| ADR-001 | ee09a22e… | unchanged | fix block 11 |
| ADR-006 | 8614d5fe… | unchanged | fix block 11 |
| ADR-008 | 164d5277… | unchanged | fix block 7 |
| OPEN_QUESTIONS | 2a973005… (mtime 17:10:27) | unchanged | — |
| LEDGER | 1c993877… (mtime 17:10:31) | unchanged | — |
| RUBRIC | 62698867… | unchanged | v2 fix block 12 |
| GATES 6f8be479…, STATUS 6aff9f5d…, G1_PACKET 4bfdbe12…, SEQUENCES d3f68f8b…, PHASE2_SLICE_PLAN f5810a7d…, constants e494e772…, MISSION 0e2339ed…, ADR-002 fe254a6e…, ADR-003 58b98363…, ADR-004 176c0a38…, ADR-005 08cdf2fb…, ADR-007 05c75efb… | pinned | unchanged | — |

CONTRACT moved to fix block J (16:35) two minutes before THREAT_MODEL fix block 10 was saved (16:37), consistent with parallel fix blocks. THREAT_MODEL's header still pins CONTRACT at fix block I (see D1).

## Live evidence (2026-10-05, about 17:12–17:14 +0200)
- **Source drift.** `tools/source_drift.py` sha256 5504b5e7…80e1 (same as reviewed in R11–R13; stdlib only, writes only with `--out`, not passed). Result: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33".
- **Chain** (https://rpc.testnet.arc.io, read-only, curl):
  - `eth_chainId` → 0x4cef52 = 5,042,002.
  - Latest block 65,644,278: baseFeePerGas 20,000,000,000; extraData 0x00000004a817c800 = 20,000,000,000 (C-33, DR-16(2)).
  - DR-11 premise: empty 0x…c0ffee01 → 0x…c0ffee04 zero-value `eth_call` → "0x"; 1 wei → {-32003, "revert: OutOfFunds"}; from C-55 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 zero-value → {-32603, "Blocked address"} (C-57).
  - DR-14 premise: `eth_getCode`(C-55) → 0xef0100b8b08cdb4e…; `eth_getCode`(empty) → "0x".

## CHECKS
- **K1 Structure recount → PASS.** `^| T-` = 37 rows (S5, T7 incl. T-T7, R3, I3, D6, E5, N2, B2, SC4). `^| L-` = 8. `^| DR-` = 29; DR-01…DR-29 each exactly once (DR-21 sits after DR-27, cosmetic). Executor block parsed by script: every DR assigned; split parts DR-16, DR-19, DR-26 appear twice each (one per part). Monitor line = 26 entries (24 DR + RD-01 + RD-03), matching ADR-008 :48.
- **K2 Coverage → PASS.** STRIDE 6/6 plus B7, B8, B5 tables; LINDDUN 7 categories in 8 rows; boundaries B1–B9.
- **K3 MC-21 → PASS.** Drift 0. Fix block 10 adds no new Arc constant (C-26 cited for DR-10 mutant (2) resolves in constants.md).
- **K4 Live chain → PASS** (above).
- **K5 Numbers → PASS.** Python `divmod`, asserting m·k + r = w, 0 ≤ r < k:
  - p=6, k=10¹²: 0→(0,0); 1→(0,1); 10¹²−1→(0,10¹²−1); 10¹²→(1,0); 10¹⁸→(10⁶,0); 7,374,356×10¹²→(7,374,356,0); 2²⁵⁶−1→(…584007, 913,129,639,935).
  - p=2, k=10¹⁶: 10¹⁶−1→(0, all dust); 10¹⁸→(100,0); 10²⁰→(10,000,0).
  - Gas 21,000 × 20 gwei → (420, 0) at p=6.
  - DR-29 re-trace (:231): m = 10,000; R = 2,500 → T2 = 7,500 and `unid` = 7,500; further T10 R = 500 → T11 = 7,000. As stated.
- **K6 R13 defect disposition:**
  - **D1 (blocking) CLOSED.** DR-29 (:231) now nets only a T9/T10 bound by (a) `refs.instructionId` = case-return ID recomputed from `refs.caseId` + a `RETURN`'s `dispositionSeq` (`listCaseDispositions`), (b) case subject = item, (c) both legs = `returnAmount` on the template GLs (CONTRACT :267-268 match), (d) a final status-1 signing-log transaction with that ID, `to` = `returnDestination`, value = R×k, (e) uniqueness per case-return ID. B9 (:92-96) and DR-29 now age **every final status-1 case-return transaction in the signing log** against `A_post` (CONTRACT §5.8 :533, Rout covers case returns :475) from the monitor's own finality block. "so DR-06 catches it" removed. Re-trace of the R13 C1 mutant (X m=10,000, Y m=6,000, genuine Y RETURN R=2,500; adapter withholds Y's T9 and posts a T9 citing a case it opened on X): X's case has no `RETURN` disposition (dispositions are human-only, CONTRACT :231) → (a) fails → PAUSE; Y's final case-return tx has no T9 within `A_post` → PAUSE; a T9 citing Y's case with `subjectRef` = X → (b) fails → PAUSE; citing Y's case correctly → nets only for Y, T2_X = 7,500 ≠ 10,000 → PAUSE. Also now independently blocked at the CBS by CONTRACT fix J (:205 `BINDING_MISMATCH`). Named as mutant (4).
  - **D2 CLOSED.** Header :9-14 lists five "ahead of RISK_REGISTER v3 fix block 6" points, each re-checked at the pinned RR: 6a "in the monitor" (RR :65); RB-14 omits the DB audit log (RR :95); 3e "journal legs" only (RR :45); RB-12/RB-16 ahead notes stale (RR :9, :93, :97); no residual-15 row. All routed (CF-38(b), CF-38(e), LEDGER :87, :102-106).
  - **D3 CLOSED.** DR-19 part (2) (:221) lists address issuance and routes the undefined interface as CF-38(f) (LEDGER :107); the deploy is blocked if a listed flow isn't completed, so an undriven issuance flow fails closed.
  - **D4 CLOSED.** `unid`'s log `to` must be in neither `listIssuedAddresses` nor Treasury's list (:231), consistent with CONTRACT §5.3; mutant (5).
  - R13 C5 (duplicated T-I2 sentence) fixed (:137).
- **K7 Per-detection re-trace (MC-40):**
  - DR-01 → PASS. Move and cancel fee conditions (`maxPriorityFeePerGas`, `gasLimit × maxFeePerGas`) and realised-debit caps now match ADR-008 :40-41/:52; mutant (2) (cancel with priority fee above ceiling) re-traced. Daily-cap day boundary stays open for ADR-001 (CF-38(c), stated at :20 and in DR-01).
  - DR-10 → PASS. Mutant (2) (fork changes the transfer-event emitter or topic; U4 quarantines unknown events; balance deltas unexplained → PAUSE) is an instance of T-N1 / RR 2d (MC-40(a)); input is own-node balance state (b, c).
  - DR-19 → PASS for both parts (executor, action, healthy signal, issuance flow).
  - DR-29 → PASS on settlements, releases, T9/T10 binding, case-return ageing, amount netting, address bindings, mutants (1)–(5). One divergence from CONTRACT J on the T9/T10 `txHash` join → D2 (minor).
  - DR-02 to -09, -11 to -18, -20 to -28 → PASS (text unchanged since R13, premises re-checked in K4/K5).
- **K8 MC-40 label clause, sibling claims at the pinned versions:**
  - RISK_REGISTER claims (:6-14) → PASS (K6 D2).
  - ADR-006/ADR-001 "matches" (:15-20) → PASS: ADR-001 :25, :29, :79 (threshold, items 3 and 6, Treasury with Risk); ADR-001 :5 still claims ahead on CF-36, correctly called stale.
  - ADR-008 fix block 7 claims (:31-37) → PASS: :75 DR-29 row has no Treasury's list; :94 ages claimed items only; :67 DR-19 unsplit; :40-41 fee conditions match.
  - **CONTRACT claims (:21-30) → FAIL (D1).** The header pins "CONTRACT v3 fix block I", but the CONTRACT on disk is fix block J, and the "ahead" claim about netting is false against it.
- **MC-44 → PASS.** Q-ids (A2, A5, A12, A15, A16, C10, C16, C19, D1, D3, D4, D9, P1, R12, T3, T4) each a row in OPEN_QUESTIONS. CF-ids (2, 5(b),(e)–(i), 15, 17, 18, 19, 21, 23, 24, 25, 26, 36, 37, 38(a)–(f), 39, 39(a), 40) each in LEDGER. C-ids resolve (C-1 hit is "R5 C-1"). CONTRACT §1.2, §1.3, §3, §5.0, §5.1, §5.3–§5.8 resolve.
- **MC-41 → PASS.** Every blind sub-risk maps to an [R]/[X] valid under MC-40 or a residual. T-N1 now rests on DR-10 mutant (2); its event-driven [X] is supplementary.
- **MC-45 → PASS with routing.** Residuals 14 ↔ RB-12; 6 ↔ RB-7/RB-13; DR-10 mutant (2) is a valid detection for RB-16's sub-risk; residual 15 has no RR row, routed CF-38(e).
- **MC-17(a) → PASS. MC-17(b) → PASS** (wrong-account and wrong-record mutants re-traced through DR-29 and CONTRACT J's CBS binding; `txHash` gap is audit-trail only, D2).
- **MC-12(d) → PASS** for payouts, case returns and claimed items. An unclaimed final internal move is not aged (D3, minor).
- **MC-03 → PASS (K5). MC-42 → PASS** (`SIGNED-OFF` count 0 in this document). **MC-43 → PASS** (POPIA statements flagged to Q-R12 at :184, :191, :195).
- MC-23, MC-24 text against T-E5 and T-T1 → [inspection-only] PASS.
- MC-01, 02, 04–08, 10, 11, 13–16, 18–20, 22, 25, 30–34 and 46–48 → N/A (code or CONTRACT properties).
- **JL-1 Fail-closed → [inspection-only] PASS.** Every new rule ends in PAUSE or a blocked deploy. **JL-4 → [inspection-only] PASS in part** (D2: T9/T10 `refs.txHash` not verified). JL-2, JL-3, JL-5, JL-6 → [inspection-only] PASS.
- **Regression of frozen units → N/A by reconstruction** (`| frozen` count in LEDGER = 0). Substitute: sections furthest from fix block 10 re-checked and PASS: T-E5/DR-11/DR-14 against the live chain (K4); T-T5/DR-06 against the conversions (K5).

## CANDIDATES (recorded for traceability)
- **C1** · :21 "**CONTRACT v3 fix block I.**"; :27-28 "This version is **ahead of CONTRACT fix block I** on three points: DR-29 nets only a T9 or T10 that it has bound … CONTRACT §3 nets 'every T9 or T10 already posted for that item' with no binding"; :231 "(CONTRACT fix block I)". The pinned CONTRACT (3f1141e8, header :3 "Version 3, fix block J") binds T9/T10 at the CBS (:205 "Case returns (T9/T10) bind to their own `RETURN` … → `REJECTED{BINDING_MISMATCH}` → PAUSE") and nets "Only a T9/T10 that passed the CBS's `RETURN` binding above **and** whose `(instructionId, txHash)` the monitor has joined". The header also does not mention CF-39(f) (LEDGER :81, open), which routes CONTRACT J's point 5 to THREAT_MODEL DR-29. Criterion: MC-40 label clause ("Every 'ahead', 'only' or 'matches' claim … is re-checked against that version"; "pinned to the sibling hashes on disk"). REAL → **D1 (minor)**: header accuracy; no money path is affected, because both documents now bind T9/T10.
- **C2** · :231 DR-29 "Settlements against the chain (CF-25). Every settlement (`settleHold`, or the T4 fallback) joins its `(instructionId, txHash)`…", and (d) "the signing log holds a final status-1 transaction with that `instructionId`…" without `refs.txHash`. CONTRACT J :205 "Every settlement (`settleHold`, the T4 fallback with `refs.txHash`, **or a T9/T10 with `refs.txHash`**) must match a final status-1 transaction for that instruction" and :217 "DR-29 joins every settlement, T9/T10 included, on `(instructionId, txHash)`"; LEDGER CF-39(f) (:81) asks the same of THREAT_MODEL DR-29. Re-trace: a T9 with correct `caseId`, `dispositionSeq`, `instructionId` and R, but whose `refs.txHash` names an unrelated transaction, passes (a)–(e), so the CBS record points an auditor at the wrong transaction. Money: none moves or is misposted, because the ID, amount and destination are bound to the chain fact through the signing log, and (e) prevents a second netting. Criteria: MC-45 / label agreement, MC-17(b) (cited record bound to the chain fact: met through `instructionId`), JL-4. REAL → **D2 (minor)**.
- **C3** · :92-96 "the monitor ages … every claimed in-flight item; every final status-1 payout and case-return transaction in the signing log, whether or not the adapter claims it"; residual 14 (:252) covers only a **duplicate** T6. Re-trace: a compromised adapter signs (through the normal path) and broadcasts a genuine internal move hot→gas of X, does not claim it in Rmove, and withholds T6. Chain total unchanged, CBS G2 total unchanged → DR-06 = 0; DR-13 matches the transfer to the move record and the signing-log entry; DR-07 sees no adapter journal to join; the B9 ageing does not cover moves. Only RD-03's per-role identity would see ±X, and it only diagnoses until CF-5(b). Effect: G2 sub-account balances misstated, no value leaves the bank and no customer account is touched (the same bound and the same closing condition as residual 14). Criteria: MC-12(d) (ageing beyond claimed items is not required by the rubric text, but the B9 rule now ages two of the three final outflow classes), MC-41/MC-45 (residual coverage). REAL → **D3 (minor)**: not a customer-money misposting; G2 split only.
- **C4** · :94 "every final status-1 … case-return transaction in the signing log … must have its T9 or T10 joined within `A_post`". A same-nonce cancel of a case return carries the `cr-` `instructionId` and is final status 1 with no T9/T10 (CONTRACT :442 RETURN_FAILED path), which could false-PAUSE (MC-40(d)). DISMISSED: DR-01 (:203) classifies such a transaction as a **Cancel** (zero value, `to` = sender), not as a **Case return** (`to` = `returnDestination`, value = R×k), so it is not a "case-return transaction"; the release-check bullet applies the same exclusion explicitly for payouts. A fail-closed false PAUSE would anyway not be blocking. Suggest stating the exclusion explicitly at the next edit.
- **C5** · Residual 15 (:253): a move strictly above the approval threshold without a checker is undetected after the fact. Considered against the blocking definition ("moved without the required control"). DISMISSED as blocking: the required control (the signer refuses such a move without a checker assertion, ADR-001 item 6, tested by MC-25(d)) exists. What is missing is the after-the-fact detection of a signer that skips it. That gap is listed as a G1 residual with its closing condition (CF-15, Q-C16, CF-37), as MC-41 allows. The move stays inside Treasury's list and the move caps, which DR-01 re-checks.
- **C6** · DR-19 part (2) (:221): the issuance flow's interface doesn't exist yet (CF-38(f)), and no G1 residual is listed for it (MC-40(c) "the sub-risk is listed as a residual until then"). DISMISSED: the detection's own fail-closed action ("the deploy is blocked if … a listed flow wasn't completed by any canary") means nothing deploys while the flow is undriven, so there is no undetected production window to list. This matches the R13 Probe F proposal queued in LEDGER :55.
- **C7** · Residual 6 (:241) lists DR-29's closing inputs as CF-5(f), (h), (i) only, while DR-29 also needs `listJournals` `legs`/`refs` and CF-38(d)'s subject field. DISMISSED, as in R12 C9 and R13 C6: DR-29's row states its full needs and "Until then residual 6".
- **C8** · §D order: DR-21 sits between DR-27 and DR-28. DISMISSED as cosmetic; every ID resolves once.

## DEFECTS
- **D1** · docs/THREAT_MODEL.md:21-30 (header "CONTRACT v3 fix block I" block) and :231 ("(CONTRACT fix block I)") · Lens R / MC-40 label clause · **minor**. The header pins CONTRACT at fix block I and claims to be ahead because "CONTRACT §3 nets 'every T9 or T10 already posted for that item' with no binding". CONTRACT on disk is fix block J (sha256 3f1141e8…), which binds T9/T10 at the CBS and nets only monitor-joined T9/T10 (:205, :217). Fix: re-pin to CONTRACT fix block J, record that DR-29 **matches** it on the T9/T10 binding and netting (CF-39(f)), and keep only the true ahead points (`unid` address check; `listCaseDispositions` subject, CF-38(d); issuance interface, CF-38(f)).
- **D2** · docs/THREAT_MODEL.md:231 (DR-29 "Settlements against the chain" and case-return (d)) · Lens R / MC-45, MC-17(b), JL-4 · **minor**. DR-29 does not join a T9/T10's `refs.txHash` to its transaction, while CONTRACT J (:205, :217) and LEDGER CF-39(f) say DR-29 joins every settlement, T9/T10 included, on `(instructionId, txHash)`. Fix: in (d), require that `refs.txHash` is the final status-1 transaction found there, and add T9/T10 to the settlement bullet. Effect today: audit-trail accuracy only (no money moved or misposted).
- **D3** · docs/THREAT_MODEL.md:92-96 (B9 ageing) and :252 (residual 14) · Lens R / MC-12(d), MC-41/MC-45 · **minor**. A genuine final internal move that the adapter neither claims (Rmove) nor posts (T6) is aged by no executor outside the adapter and is invisible to DR-06, DR-07 and DR-13. Fix: either extend the monitor's signing-log ageing to every final status-1 move (T6 within `A_post`), or widen residual 14 to "a duplicate **or withheld** T6" (same bound: no value leaves the bank; same closing condition: RD-03 PAUSE via CF-5(b)). Route the mirror to RISK_REGISTER 4b/RB-12 and ADR-008's Rmove rule.

## PROBES (for the LEDGER rubric proposal queue; not counted here)
- **Probe G (would a bad version pass?) → YES.** MC-12(d) only requires ageing of **claimed** items, so a version that ages payouts but not moves passes it (D3 was found only by tracing each final outflow class in the signing log). Proposed: "The monitor ages every final status-1 transaction class in the signing log (payout, case return, move) against its posting, whether or not the adapter claims it, or the unaged class is a G1 residual with its bound."
- **Probe F (would a good version fail?) → YES.** When two documents are fixed in parallel minutes apart, the MC-40 label clause fails the later-saved document for pinning the sibling version its author read, even though both now agree on substance (D1). Proposed: "A sibling pin that is one fix block stale is minor and is cured by re-pinning, if the claims about the substance still hold or now 'match' at the newer version; only a claim that is false against the newer version on substance is a defect."

## Cross-unit notes (not counted here)
- **X1** · CONTRACT J header (:12) says it is "ahead of" THREAT_MODEL fix block 9 on point 5. THREAT_MODEL fix block 10 now matches point 5 except the `txHash` join (D2). The CONTRACT unit should re-pin to THREAT_MODEL fix block 10.
- **X2** · LEDGER CF-39(f) (:81) should record THREAT_MODEL's part as taken once D2 lands.
- **X3** · ADR-008 :94 still ages only claimed items (CF-38(a), open). Under the zero-blocking exit rule it is carried to the G1 packet unless it lands.
- **X4** · LEDGER P1-threat-model row reads "R14 pending". This report is R14.

## VERDICT: NEGATIVE (3 defects: 0 blocking, 3 minor)
Under the Phase 1 exit rule (LEDGER 2026-10-05: freeze on zero BLOCKING defects), this pass finds zero blocking defects, so the unit qualifies to freeze. D1–D3 are carried to the G1 packet.
