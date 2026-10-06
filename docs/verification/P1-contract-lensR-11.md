VERIFICATION · lens: R · target: P1-contract (docs/CONTRACT.md v3 after fix block G; grace round 1 of 2) · commit: none (the repo has no commits; working tree only). CONTRACT.md sha256 d6768590a827999ca5d3773b7a55d349faa2f050858dc02ad468a94d9806f8c6, 585 lines, mtime 2026-10-05 12:02:49 +0200.

Criteria: CLAUDE.md; docs/RUBRIC.md v2 after fix block 10 (sha256 4387ef43…, mtime 11:59:04). Also used: OPEN_QUESTIONS.md (Q-A7, Q-C17, Q-C19; mtime 12:02:49), RISK_REGISTER.md (mtime 2026-10-03), THREAT_MODEL.md, ADR-008, LEDGER.md, constants.md, docs/sources/MANIFEST.md, and the R10 report (P1-contract-lensR-10.md). I did not use the author's fix notes as evidence.

The guard hook was not loaded, so I followed its rules by hand. Network use was limited to: read-only eth_chainId and eth_getTransactionReceipt on https://rpc.testnet.arc.io (testnet 5042002); and HTTP GETs of the documentation URLs in MANIFEST, made by tools/source_drift.py. I called no signing or sending method and no mainnet endpoint, and I read no .env or key files. Scratch computations ran as inline python and wrote no files.

CHECKS:
R10 defects re-checked against fix block G:
- R10-D1 (blocking: settleHold legs unbound) → FIXED for the wrong-account mutant. :190 now reads "`settleHold` | Fact | `{key, holdId, instructionId, legs:[…]}` … the CBS checks that the debit leg is **the hold's own account and amount** … Anything else → `REJECTED{BINDING_MISMATCH}` → PAUSE". I re-traced the R10 mutant (settle C's hold with `DR G1.V`): the CBS now rejects it, and BINDING_MISMATCH leads to PAUSE (:116). PASS. A different mutant survives at the same step: the adapter chooses *which* instruction it claims was paid. That is new defect D2.
- R10-D2 (T11/T2 binding scope) → PARTLY FIXED.
  - (i) :186 now says "the `accountRef` of the `ASSIGN` disposition **on the case of the same `refs.subjectRef`**", so another item's ASSIGN no longer passes. PASS for the cross-item case. A superseded ASSIGN on the same subject still passes (D3).
  - (ii)/(iii) :186 now says on-chain amounts and T2's `refs.address` "are the adapter's claim, bound **outside the adapter** by the monitor's journal-binding join (proposed DR-29, ADR-008 …)". PASS. DR-29 exists as proposed in ADR-008:75. But the cited "RISK_REGISTER RB-13" does not resolve (D6).
- R10-D3 (RETURN after a credit vs the terminal rule) → FIXED. :276 says "the item is then terminal … so the §1.7 terminal rule applies: recorded, `LATE_DISPOSITION`, page Compliance ops, no QUARANTINE". QUARANTINE is kept only for a non-terminal over-return.
- R10-D4 (placeHold echo quarantined) → FIXED. :209 `HoldChanged {…, key, …}`: "Caused by the adapter = its `key` is the key of one of the adapter's own hold operations (in flight or completed) and its `state` is the state that operation produces". A placeHold echo now matches by `K.reserve` whether placeHold is in flight or already OK. A new rule conflict appears on terminal items (D4).
- R10-D5 ("current case" undefined) → DEFINED at :155, but the definition creates the blocking dead end D1.
- R10-D6 (Q-C19, Q-A7, F2 citation) → PARTLY FIXED. §7 :567 now lists Q-C19 and Q-A7. `A_stall` is deferred to Q-A7 (:139, :507), and Q-C17 now defers its value to Q-A7 (OPEN_QUESTIONS:56), so ownership is consistent. Still open: the stall trigger definition differs between :139 and :507; the F2 "routed" claim has no LEDGER entry; Q-C19 does not ask about settleHold; RB-13 does not resolve (D6).
- R10-D7 (§5.2 case cells) → PARTLY FIXED. :269/:270 are much longer, but four reasons that their own rows open are still missing (D5).
- CF-22 (signer refuses a cancel or replacement) → FIXED. :379 "The signer refuses a cancel or a replacement … → **PAUSE** with `createCase SIGNER_REFUSED`. The original bytes may still land, so nothing is released". This applies to §5.4–§5.6 (:376).

Rubric, mechanical (by reconstruction):
- MC-03 unit mapping → PASS. I recomputed all 13 §6.1 rows by exact `divmod`, and all match. NATIVE_WEI→USDC_UNITS: 1,234,567,890,123,456,789 → (1,234,567, r 890,123,456,789). 21,000 × 20 gwei = 420,000,000,000,000. The signed-64-bit row is tight: (row + 1) // 10^12 = 2^63. Extra boundaries at p = 6: 3 → (0, 3); 10^12 + 1 → (1, 1); uint256 max → a 66-digit m, which trips the CBS_MAX guard (:533).
- MC-03 live anchor → PASS. Read-only testnet calls at 2026-10-05 10:13 UTC: eth_chainId = 0x4cef52 = 5042002. Receipt 0x0e8279a4…24695 has status 0x1, gasUsed 167,599 and effectiveGasPrice 44,000,000,000; their product is 7,374,356,000,000,000, which at p = 6 gives 7,374 r 356,000,000,000, matching :548. The emitter 0xffff…fffe log value is 9,176,065,000,000,000,000 and the 0x3600… log value is 9,176,065, a ratio of exactly 10^12 (C-10/C-11, C-20).
- MC-04 templates and identities → PASS for the template set, which is unchanged since R10 (§5.1 and the §5.7 effect table are identical in content). One fix-G change touches the templates: settleHold now carries `instructionId`. I ran two exact-integer simulations of the new mutants (D2, D3). In both, the CBS identity, the chain residual, the itemisations and G1 ≥ 0 all hold, which is why those mutants go undetected.
- MC-05 drift cells → PASS (unchanged): §5.0 unmatched outflow (:232); :359; :360; the :383-387 global rule; :422; :444.
- MC-06 → PASS (:25).
- MC-10 keys and derived IDs → PASS. Recomputed with JCS (compact JSON of string arrays):
  - K.recv(5042002, 0xab×32, "0", attempt "0") = arc1-970ee4c76bbeae19300510816cb88b62eb947aefe9baa8fac99ac454f3b0785b (69 characters).
  - K.avail attempt 0 ≠ attempt 1.
  - K.reserve("INS-1", "0") = arc1-8ad34742b0d6…
  - ["out","a:b"] ≠ ["out","a","b"].
  - The case-return ID is 35 characters and matches the ID grammar for caseId "X"×128 (cr-23a10a40…), for ("a:b","0") vs ("a","b:0") (cr-86784d86… vs cr-d16694b5…), and for dispositionSeq "9"×40 (cr-be81563a…).
- MC-11 totality → FAIL (D1, D4).
  - Global rules expanded: §1.6 chain conditions; the §1.7 gate with its RESUME clause; the terminal, current-case, stale-disposition and stale-screening rules; the :376-381 send-time rule; the :383-387 nonce-drift rule.
  - Delegations at :299, :332, :414, :416, :434 and :436 still type-check.
  - "Every resolution path has an exit that can succeed" fails: :155 closes the current case when any disposition is applied, including HOLD. Several rows then leave an item in a held state without opening a new case, and :156 makes every later disposition stale (D1).
  - Rule conflict: a `HoldChanged` the adapter didn't cause, arriving for a terminal instruction, has two actions (D4).
- MC-11(vi) → PASS (:137-140).
- MC-12 ages → (a) PASS: I re-counted 33 waiting states (inbound 7, outbound 13, case return 8, internal move 5), each with a §5.8 row or a named owner, plus QUARANTINED (:509). (b) FAIL: the HELD_IN_CLEARING, SUSPENSE and HELD_FOR_CASE expiry is "case escalation" by Compliance (:494). After D1 these states can be occupied with **no open case**, so the expiry is not "a held state with a named owner and an open case". (c) PASS: `A_stall` is single-use. (d) unchanged.
- MC-13 holds outlive nonce resolution → PASS. The T5 routes are unchanged since R10. The CF-22 refusal rule (:379) and the nonce-drift rule (:387 "Neither case settles or releases anything") release nothing.
- MC-17(a) → PASS (unchanged :231-232, :236).
- MC-17(b) → FAIL (D2, D3). I re-traced the wrong-account mutant through every operation that writes a G1 leg:
  - placeHold: bound to the CBS instruction (:189). PASS.
  - settleHold: the debit leg is bound to the hold (:190). PASS for that mutant. **But the choice of which instruction's hold to settle is the adapter's**: there is no txHash on settleHold or in the postJournal refs (:186, :190), no check that the hold was placed for `instructionId`, and DR-29 joins journals only to CBS records (ADR-008:45). D2.
  - T3/T5 fallbacks: PASS.
  - T2: account bound through `refs.address`; address and amount bound by the proposed DR-29. Stated. PASS.
  - T11: the subject-scoped ASSIGN lookup admits a superseded ASSIGN. D3.
- MC-21 Arc quotes → PASS. I ran tools/source_drift.py myself after reading all 108 lines (stdlib only; read-only; GETs only the MANIFEST URLs; sha256 5504b5e7…, the same hash reviewed in P1-adrs-lensR-12 and P1-rubric-lensR-13/14). I sent its output to stdout, not to the repo. Result: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33".
  - Every quote for the 17 C-ids that CONTRACT cites was checked against the newest archive of its URL, whitespace-normalised: C-01, C-05, C-10 (covers C-11), C-13, C-14, C-20, C-24 ×2, C-25, C-26, C-30, C-35, C-53, C-54, C-62 and C-63 are all found (C-10/13/14/30/53/54 in evm-differences.REFETCH-later.md, the newest archive).
  - C-57 is undocumented, as stated, and routed to Q-A13.
  - The inline quote at :206 matches custody.md archive lines 75-76: "the USDC contract is deployed at a precompile address".
- MC-44 references → FAIL (D6). By script, every DR/RR/T/L/CF/Q id in CONTRACT resolves in THREAT_MODEL, RISK_REGISTER, OPEN_QUESTIONS or LEDGER, except:
  - DR-29, which is marked "proposed" and is defined in ADR-008:75: acceptable;
  - **RB-13**, which is cited as existing (":186 Until that join exists, this is RISK_REGISTER RB-13") but is not in RISK_REGISTER (its highest row is RB-11; file mtime 2026-10-03).
  - The 21 closed-list reasons are unchanged, and every createCase names one. The 10 terminal states in §1.7 equal the 10 marked "(terminal)".
- MC-45 → PASS for the signature rows (unchanged). Partial for Q-C19: OPEN_QUESTIONS:59 restates the binding as placeHold plus postJournal (T3/T4/T5 fallbacks, T2, T11) and does not mention settleHold, which is now CONTRACT's hold-mode control (counted in D6).
- MC-46 event values → PASS. `HoldChanged.key` is consumed at :209. The 8 PayoutOutcome values, 5 CaseDisposition values and ScreeningOutcome CLEAR/HIT are unchanged.
- MC-47 movement classes → PASS forward (8 branch classes = 8 §5.2 rows). FAIL reverse (D5): I extracted the createCase reasons per section by script:
  - §5.4, the :376-381 rule and §5.8 open SIGNER_REFUSED (:379) and APPROVAL_EXPIRED (:510) for payouts, and both are absent from :269;
  - §5.5 with the :379 rule and §5.8 :502 opens SIGNER_REFUSED and PENDING_AGE, and both are absent from :270;
  - POSTING_REJECTED (:300, :313) is absent from the inbound cells :264-266.
- N1 testnet only → PASS. 5042002 appears only at :30 and :104, and there is no standalone mainnet ID.
- I-INT / I-CONV → PASS (string amounts :19; U1 the only converter :26, §6).
- Not applicable: MC-01/02/07/08/14/15/16/18/19/20/22/23/24/30–34/48 are code items (Phase 2), and MC-40/41/42/43 don't apply to CONTRACT.

Judgment lenses:
- JL-1 fail-closed → FAIL on D2: a misattributed settle reconciles to 0, so nothing stops. D1 doesn't move money, but it pages nobody about the freeze itself (only each stale disposition).
- JL-2 human-owned → FAIL on D1: a human HOLD decision silently becomes irreversible, which takes the decision away from Compliance.
- JL-3 03:00 operability → gap (D1): on-call sees an item held "for a case" that has no case.
- JL-4 auditability → FAIL on D2: a settle journal can't be traced to the chain transaction that justifies it, because no txHash reaches the CBS posting. Also D5.
- JL-5 → PASS.
- JL-6 → PASS.

CANDIDATES (recorded for transparency; Lens R):
- C1 · :155 "Applying a disposition from the current case closes it. An item in a held state therefore has exactly one current case: the one whose disposition it is waiting for." + :305 "HELD_IN_CLEARING | `HOLD` | none | HELD_IN_CLEARING" (also :316 SUSPENSE, :363 HELD_FOR_CASE) + :156 "A `CaseDisposition` whose `caseId` isn't the item's **current case** … changes **no** state, in every state" · MC-11 (exit that can succeed), MC-12(b), JL-2 · REAL.
  - Trace: HELD_FOR_CASE (hold on C's G1) → HOLD on case c is applied, so c closes and the item still sits in HELD_FOR_CASE. A later CANCEL or RELEASE on c is stale, because there is no current case. No row opens a new case. §5.8 :494 offers only "case escalation, no auto-move". The customer's hold is permanent.
  - The same dead end follows the partial return (:419 "otherwise the source held state", with no createCase, after the RETURN on c was applied), :303 ("HIT/REVIEW → stays, case continues", after RELEASE closed the case), and the :423 RETURN_FAILED resolution.
  - :156's "`dispositionSeq` … higher than the last one applied for that case" assumes several dispositions per case, which contradicts closing on the first.
  - In :303, an unattributed mint is re-screened as `CCTP_MINT`, which is always REVIEW, and HELD_IN_CLEARING has no row for a current-round ScreeningOutcome, so RELEASE can never succeed for it even if the case stayed open.
  - Blocking.
- C2 · :190 "`settleHold` | Fact | `{key, holdId, instructionId, legs:[…]}` … the debit leg is **the hold's own account and amount**, and … the credits … **per its own payout instruction**"; :186 refs `{subjectRef, caseId?, instructionId?, address?}` (no txHash); :186 adapter claims bound by DR-29 listed as "T2, T8, T11, `unid`, and T2's `refs.address`"; ADR-008:45 "DR-29 joins every CBS journal's customer-account legs to those same records" · MC-17(b), JL-1, JL-4 · REAL.
  - Hold mode: payouts X (customer C) and Y (customer V) have equal A. Y is signed and final with status 1. The adapter issues settleHold(hold_X) and releaseHold(hold_Y). Every check the CBS makes passes: X's hold, X's account, X's amount.
  - Exact-integer run (p = 6; C and V each funded with 1,000 USDC; A = 500 USDC; gas 7,374,356,000,000,000 wei): chain residual 0, CBS identity 0, G5 itemisation 0, G1 ≥ 0. G1.C falls to 500,000,000 while V keeps 1,000,000,000, and V's payout was paid.
  - DR-01 matches Y's signing-log entry to Y and so finds nothing. Nothing joins a settle journal to an outflow of the same instruction. The CBS's statement that "instruction X was paid" is the adapter's claim.
  - Blocking: the same consequence as R10-D1.
- C3 · :186 "the `accountRef` of the `ASSIGN` disposition **on the case of the same `refs.subjectRef`** for T11"; :308-310, :314 (an ASSIGN can be followed by a new ASSIGN on a later case of the same subject) · MC-17(b) · REAL.
  - Trace: ASSIGN(V) on c1 → V is ineligible → STANDING_INELIGIBLE c2 → ASSIGN(W) on c2. The adapter posts T11 to V. "The ASSIGN disposition" on a case of this subject exists (c1), so the CBS accepts it.
  - Exact run: G4 itemisation 0, CBS identity 0.
  - The binding should be to the latest ASSIGN applied on the item's current case.
  - Minor: the account was a human's choice at some point, and the fix is a one-word scope.
- C4 · :209 "Anything else → QUARANTINE that instruction" vs :154 "Events for a terminal item (… RELEASED, SETTLED …) are recorded … and change nothing. … This rule takes precedence over the 'invalid combination → QUARANTINE' rule of §4" · MC-11 (one action per cell) · REAL. A `HoldChanged` with no adapter key for a SETTLED or RELEASED payout (for example a manual CBS change to the hold) gets QUARANTINE plus paging under :209, but "record, change nothing" with no paging under :154. The precedence clause covers only the CaseDisposition rule. Under the second reading an unauthorised hold change on a finished payout pages no one. Minor.
- C5 · :269 lists 10 reasons with no SIGNER_REFUSED or APPROVAL_EXPIRED; :270 lists 11 reasons with no SIGNER_REFUSED or PENDING_AGE; :264-266 have no POSTING_REJECTED · MC-47, JL-4 · REAL. The reasons are opened at :379 (which applies to §5.4–§5.6), :510, :502, :300 and :313. Minor.
- C6 · :186 "this is RISK_REGISTER RB-13" (absent from RISK_REGISTER); OPEN_QUESTIONS:59 Q-C19 names placeHold and postJournal only, while §7 :567 lists "**Q-C19** (CBS account binding)" and the body cites Q-C19 nowhere; :138 "routed as part of SEQUENCES fix 2" (LEDGER has no such routing; CF-14 is closed and CF-2 covers other items); :139 "no new block on **own nodes** for `A_stall`" vs :507 "30 s with no new head on **two or more sources**" (sources include the reference, :138) · MC-44, MC-45, N5 · REAL. The two stall wordings trigger on different sets, for example one own node plus the reference stalled while a second own node advances. Minor.
- C7 · :190 credits "per its own payout instruction" vs `submitPayoutInstruction` (:206), which has no fee field · MC-04 · DISMISSED, as in R10-C9: the default fee is 0 (:257), and Q-C8 is listed.
- C8 · :155 "Every §5 row that opens a case" excludes §1.6 QUARANTINE and PAUSE cases · MC-11(ii) · DISMISSED as a separate defect. This resolves R10-D5's trace correctly (a QUARANTINE case doesn't displace the gating case). Its only harm is in combination with C1 (the :423 variant), where it is counted.

DEFECTS:
- D1 · CONTRACT.md:155 (with :156, :303, :305, :316, :363, :419, :423) · R / MC-11 (dead end), MC-12(b), JL-2 · applying any disposition closes the current case. HOLD, a partial return, a re-screen HIT/REVIEW after RELEASE, and a PAUSED RETURN_FAILED resolution then leave a held item with no current case, so every later disposition is stale and the item, together with a customer hold or G5/G4 funds, is frozen with no exit · **blocking**
- D2 · CONTRACT.md:190 and :186 (no txHash in settleHold or refs; the on-chain-claim list omits the settled instruction) · R / MC-17(b), JL-1, JL-4 · the adapter chooses which instruction a settle claims was paid. Settling C's equal-amount hold for V's on-chain payout and releasing V's hold reconciles to 0 everywhere (exact-integer run), and DR-29 as defined can't see it. Fix direction: settleHold, the T4 fallback and T9/T10 carry the settling txHash; the CBS checks that the hold was placed for `instructionId`; DR-29 joins each settle journal to a final status-1 outflow whose content matches that instruction · **blocking**
- D3 · CONTRACT.md:186 (T11 lookup) · R / MC-17(b) · "the ASSIGN disposition on the case of the same refs.subjectRef" accepts a superseded ASSIGN from an earlier case of the same subject (exact run: all checks 0). It should bind to the latest applied ASSIGN on the current case · minor
- D4 · CONTRACT.md:209 vs :154 · R / MC-11 · two actions for a non-adapter `HoldChanged` on a terminal instruction (QUARANTINE vs record-only with no paging); the precedence clause covers only CaseDisposition · minor
- D5 · CONTRACT.md:269-270 (and :264-266) · R / MC-47, JL-4 · §5.2 case cells still omit reasons their own rows open: payouts SIGNER_REFUSED and APPROVAL_EXPIRED; case returns SIGNER_REFUSED and PENDING_AGE; inbound POSTING_REJECTED · minor
- D6 · CONTRACT.md:186 (RB-13), :567 with OPEN_QUESTIONS:59 (Q-C19 lacks settleHold), :138 (unrouted "SEQUENCES fix 2" claim), :139 vs :507 (stall trigger) · R / MC-44, MC-45, N5 · references that don't resolve or don't cover the claim, and two stall definitions · minor

VERDICT: NEGATIVE (6 defects: 2 blocking, 4 minor).

Fix block G fixed R10-D1 (the wrong-account settle), D3, D4 and CF-22, and fixed D2, D6 and D7 in part. Two new blocking defects appear:
- D1 comes from the new current-case definition: closing on every disposition, including HOLD, freezes held items with no exit.
- D2 is the next step of the R9/R10 binding trace. The CBS now binds the settle to the hold's own account, but which instruction was actually paid on-chain is still the adapter's claim, with no txHash and no external join.

Notes for the rubric proposal queue:
- Probe G: MC-11's "exit that can succeed" should be re-traced after **every** disposition value, including non-moving ones (HOLD), and after every partial outcome.
- Probe G: MC-17(b) should re-trace the **choice of record** (which instruction or case a posting cites) as well as the record's account, through to the chain fact.

Cross-unit notes (not counted against this unit):
- OPEN_QUESTIONS Q-C19 should name settleHold and the subject-scoped ASSIGN.
- RISK_REGISTER RB-13 is pending fix 5 (LEDGER CF-16(c)).
- SEQUENCES F2 needs the two-person resolution step (no LEDGER CF item routes it).

Regression (unchanged areas): §6 unit mapping (13/13 rows, extra boundaries, live receipt); §1.2/§1.3 keys and derived IDs; §5.0 matching; §5.7 templates. All PASS.
