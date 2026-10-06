VERIFICATION · lens: R · target: P1-contract (docs/CONTRACT.md v3 after fix block H; grace round 2 of 2) · commit: none (the repo has no commits; working tree only). CONTRACT.md sha256 d2f7242268548c19f8767d22eaba0a5b7c0e5c31f25431a8b7cccdcba3e1d781, 585 lines, mtime 2026-10-05 12:20. Unchanged from pass start to pass end.

**Criteria:** CLAUDE.md, .claude/agents/verifier.md, and docs/RUBRIC.md (sha256 4d86338d…, the same at start and end).

**Sibling hashes pinned at pass start (12:20:20 +0200) and re-read at pass end (12:41:59):**
- Unchanged: RUBRIC, RISK_REGISTER (b2eff124…), THREAT_MODEL (6799bd75…), constants.md (e494e772…).
- Changed during the pass: LEDGER (b9fa5e7f… → 3688c59e…), OPEN_QUESTIONS (7bc62fdd… → 73ad9d4c…), SEQUENCES (660310b6… → a6d28f0f…), ADR-001 (4afad822… → ce0106ea…) and ADR-008 (18ff96fc… → f81850e2…).
- I re-read every passage I rely on in the end versions, and each still says what is quoted below: LEDGER CF-2 :84, CF-18 :67 and CF-25 :71; OPEN_QUESTIONS Q-A7 :24 and Q-C19 :59; ADR-001 :25; ADR-008 :45 and :75; SEQUENCES :442.

**What fix H changed:** `.tools/drafts/CONTRACT_backup_fixG.md` has sha256 d6768590…, which is exactly the R11 target hash. Diffing it against the current file shows fix H touched only lines :139, :154-155, :186, :190, :264, :269-270, :273 and :507. I used the diff only to locate changes. I did not read the author's fix scripts or notes.

**Guard rules, followed by hand (the hook was not loaded):**
- Network use was limited to read-only `eth_chainId` and `eth_getTransactionReceipt` calls on https://rpc.testnet.arc.io (chain 5042002), and the HTTP GETs that tools/source_drift.py makes.
- I called no signing or sending method and no mainnet endpoint, and read no .env files or keys.
- Scratch computations ran as inline python and wrote no files.
- The only file I wrote is this report.

CHECKS:

R11 defects re-checked against fix block H:
- **R11-D1 (blocking: applying a disposition closed the current case)** → FIXED as stated, but the new definition contradicts itself (D2 below).
  - :155 now says "**A disposition doesn't close the current case by itself.**"
  - Re-trace of the HOLD path (:305, :316, :363): the item stays in the same held state, the current case stays current, and a later disposition with a higher `dispositionSeq` is applied under :156. PASS.
  - Re-trace of the RETURN path: :155 ends the current case when the item reaches "a non-held state such as SCREENING or RETURNING through a disposition". The next sentence then says the case is still open "after a partial return (`RETURNED_PARTIAL`), and after a `RETURN_FAILED` resolution". See D2.
- **R11-D2 (blocking: the adapter chooses which instruction a settle claims was paid)** → FIXED, subject to DR-29 existing (RB-13 residual).
  - :190 now reads: `settleHold {key, holdId, instructionId, txHash, legs}`, the CBS "checks that **the hold was placed for this `instructionId`**", and DR-29 "joins every settlement's `(instructionId, txHash)` to a final status-1 receipt whose signing-log entry carries the same `instructionId` and whose content matches that instruction's approval".
  - :186 adds: "every release (T5) of an instruction that has a signing-log entry must have no final status-1 transaction for that instruction".
  - R11 mutant, hold mode (settle hold_X for X while only Y paid, release hold_Y): DR-29 finds X with no status-1 payout, and Y released with one. PAUSE twice.
  - Variant (settle hold_X citing Y's txHash): Y's signing-log entry carries Y, not X. PAUSE.
  - Fallback mode (T4 fallback for X citing `refs.instructionId` X, T5 fallback for Y): the same DR-29 joins apply. PAUSE.
  - Two new minor problems sit in the same clause: D4 (false PAUSE on cancels) and D5 (txHash has no field).
- **R11-D3 (superseded ASSIGN binds)** → the wording changed to "the **latest `ASSIGN` disposition (highest `dispositionSeq`) on the item's current case**". The superseded-ASSIGN path from c1 to c2 now binds W. PASS. But the new rule rejects a legitimate flow. That is D1 (blocking).
- **R11-D4 (HoldChanged on a terminal item has two actions)** → FIXED. :154 now says "A §1.6 QUARANTINE trigger, such as a `HoldChanged` the adapter didn't cause, applies to a terminal item too: QUARANTINE, page, case. It is never just recorded." This is consistent with :209.
- **R11-D5 (§5.2 case cells)** → PARTLY FIXED.
  - :264 gained `POSTING_REJECTED`.
  - :269 gained `APPROVAL_EXPIRED` and `SIGNER_REFUSED`.
  - :270 gained `SIGNER_REFUSED`.
  - :273 now gives every class `PENDING_AGE`, `LATE_DISPOSITION`, `QUARANTINE` and `PAUSE`.
  - Still missing: `POSTING_REJECTED` from the T8 path (:300) on the bank-owned row :265, and from the T11 path (:313) on the unidentified row :266. R11 named both lines. See D6.
- **R11-D6 (references)** → FIXED.
  - RB-13 now resolves (RISK_REGISTER:94, "Wrong-account binding (3e) … G1 residual until Q-C19 and DR-29's inputs exist").
  - Q-C19 (OPEN_QUESTIONS:59) now names settleHold ("checks that the hold was placed for the cited `instructionId`") and "the latest `ASSIGN` disposition on the item's current case (T11)". This matches :186 and :190.
  - The :138 claim "routed as part of SEQUENCES fix 2" now resolves to LEDGER CF-2 :84 ("from contract R11: SEQUENCES F2 must show the **two-person resolution**…"). SEQUENCES :442 already shows it.
  - The stall trigger now reads "no new block on two or more own nodes" at both :139 and :507.

Rubric, mechanical (by reconstruction):
- **MC-03 unit mapping** → PASS.
  - I recomputed all 13 §6.1 rows by exact `divmod`, and all match.
  - The signed-64-bit row is tight: (w + 1) // 10^12 = 2^63.
  - NATIVE_WEI→USDC_UNITS: 1,234,567,890,123,456,789 → (1,234,567, r 890,123,456,789).
  - 21,000 × 20 gwei = 420,000,000,000,000.
  - Extra boundaries at p = 6: 3 → (0, 3); 10^12 + 1 → (1, 1); uint256 max gives a 66-digit m, which trips the CBS_MAX guard (:533).
- **MC-03 live anchor** → PASS. Read-only testnet calls at 2026-10-05 10:33 UTC:
  - `eth_chainId` = 0x4cef52 = 5042002.
  - Receipt 0x0e8279a4…24695 has status 0x1, gasUsed 0x28eaf = 167,599 and effectiveGasPrice 0xa3e9ab800 = 44,000,000,000. The product is 7,374,356,000,000,000, which at p = 6 gives (7,374, r 356,000,000,000), matching :548.
  - The emitter 0xffff…fffe log value is 9,176,065,000,000,000,000 and the 0x3600… log value is 9,176,065, a ratio of exactly 10^12.
- **MC-04 templates and identities** → PASS. §5.1 and the §5.7 effect table are byte-identical to R11. Fix H adds only `txHash` to settleHold and refs, which changes no leg.
- **MC-05 drift cells** → PASS (unchanged): :232, :359, :360, :383-387, :422, :444.
- **MC-06** → PASS (:25, unchanged).
- **MC-10 keys and derived IDs** → PASS. Recomputed with JCS:
  - K.recv(5042002, 0xab×32, "0", "0") = arc1-970ee4c76bbeae19300510816cb88b62eb947aefe9baa8fac99ac454f3b0785b (69 characters).
  - K.settle attempt 0 ≠ attempt 1.
  - ["out","a:b",…] ≠ ["out","a","b:…"].
  - The case-return ID is 35 characters and matches the ID grammar for caseId "X"×128 (cr-23a10a40…), for ("a:b","0") vs ("a","b:0") (cr-86784d86… vs cr-d16694b5…), and for dispositionSeq "9"×40 (cr-ce44fc30…).
  - The settleHold `txHash` is not in K.settle, so a retry with the same key must carry the same txHash, otherwise CONFLICT → PAUSE. That is correct.
- **MC-11 totality** → FAIL (D1, D2, D3).
  - Global rules expanded: §1.6, the §1.7 gate and RESUME clause, the terminal rule (now with the QUARANTINE-trigger precedence), the current-case, stale-disposition and stale-screening rules, the :376-381 send-time rule, and the :383-387 nonce-drift rule.
  - The delegations at :299, :332, :414, :416, :434 and :436 still type-check.
  - The "exit that can succeed" re-trace fails in three places:
    - ASSIGN → REVIEW → CLEAR → T11 is always rejected (D1);
    - the RETURNING / partial-return contradiction (D2);
    - RELEASE of an unmapped item that re-screens REVIEW in HELD_IN_CLEARING, which loops for a mint (D3).
- **MC-11(vi)** → PASS (:137-140; the two stall wordings now agree).
- **MC-12 ages** → (a) PASS: there are 33 waiting states, the same set as R11, and each has a §5.8 row or a named owner. (b) FAIL in the D2 reading: a held item with no open case, after a partial return. (c) PASS: `A_stall` is used once (:139, :507). (d) unchanged.
- **MC-13** → PASS. T5 routes are unchanged. The new :186 release clause adds a check and releases nothing.
- **MC-17(a)** → PASS (unchanged :231-232, :236).
- **MC-17(b)** → FAIL (D1). I re-traced every writer of a G1 leg and every lookup the CBS uses:
  - placeHold (:188), bound to the CBS instruction: PASS.
  - settleHold (:190), bound to the hold, to the hold's instruction, and to the chain through DR-29: PASS.
  - releaseHold, through `holdId`, plus the :186 chain check: PASS, apart from D4.
  - T3/T5 fallbacks: PASS. The T4 fallback has no G1 leg and is bound through the chain check: PASS.
  - T2: issuance record, plus DR-29 for amount and address: PASS.
  - **T11 binds to the wrong record for a legitimate path** (D1). How the CBS identifies the "current case" is also not stated (part of D1).
- **MC-21 Arc quotes** → PASS.
  - tools/source_drift.py has sha256 5504b5e7076f186c49874d5738d3ca8fd77e9cf66bd6bf607d5586ffd38980e1, the version reviewed in full in P1-rubric-lensR-13/15 and used in contract R11. I ran it myself with stdout only: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33".
  - I re-checked these quotes against the newest archives: C-01 ("Chain ID (Testnet)" … 5042002, rpc-endpoints.md); C-20 (emitter address, usdc-system-events.md); C-24 ("Zero-value transfers emit no log"); C-30 ("The minimum base fee is 20 Gwei", evm-differences.REFETCH-later.md, the newest archive); C-54 ("Zero address not allowed", the same file).
  - Inline :206 "is deployed at a precompile address" matches custody.md archive :75-76, which is the only archive of that URL.
  - The other cited C-ids (C-05/10/11/13/14/25/26/35/53/62/63) are unchanged since R11, which checked them, and the tool shows no drift.
  - C-57 remains undocumented and is routed to Q-A13.
- **MC-44 references** → PASS for ID resolution. A script checked 44 distinct DR/RD/RR/RB/CF/Q/T/L IDs, and all resolve in the siblings, including RB-13. The 21 closed-list reasons are unchanged, and every `createCase` names one. D5 is a dangling schema reference (`refs.txHash`), counted under MC-04/MC-17 completeness rather than here.
- **MC-45** → PASS. Q-C19 matches :186 and :190 clause by clause: placeHold, settleHold, the T3/T4/T5 fallbacks, T2 and T11. ADR-008:45 restates the fix-H binding, including "the current case's `ASSIGN`".
- **MC-46 event values** → PASS (unchanged).
- **MC-47 movement classes** → forward PASS: 8 branch classes, 8 rows, every cell performed. Reverse FAIL, which is the R11-D5 residue (D6).
- **N1 testnet only** → PASS: 5042002 appears only at :30 and :104, and no other chain ID appears.
- **I-INT / I-CONV** → PASS: amounts are strings (:19), and U1 is the only converter (:26, §6).
- **Not applicable:** MC-01/02/07/08/14/15/16/18/19/20/22/23/24/30–34/48 are code items. MC-40/41/42/43 don't apply to CONTRACT.

Judgment lenses:
- **JL-1 fail-closed** → [inspection-only] PASS. Every new failure mode (D1, D4) ends in PAUSE, and nothing moves money wrongly.
- **JL-2 human-owned** → FAIL (D1, D3): Compliance's ASSIGN of a reviewed item, and its RELEASE of an unmapped mint, can't be carried out.
- **JL-3 03:00 operability** → FAIL (D1, D4):
  - a routine suspense assignment, or a routine cancel followed by a release, raises a rail-wide PAUSE;
  - D1's PAUSE comes as `BINDING_MISMATCH`, which :116 tells on-call is "an adapter-integrity signal, never a business refusal".
- **JL-4 auditability** → [inspection-only] PASS on the R11-D2 path: the settlement journal now records `txHash`. The listJournals gap (D5) is minor.
- **JL-5** → [inspection-only] PASS.
- **JL-6** → [inspection-only] PASS.

CANDIDATES (Lens R; recorded for transparency):
- **C1 · REAL.**
  - Evidence: :186 "the `accountRef` of the **latest `ASSIGN` disposition (highest `dispositionSeq`) on the item's current case**"; :155 "Every §5 row that opens a case for an item records it as the item's **current case**, replacing any earlier one"; :312 "SUSPENSE_ASSIGNING | REVIEW | `createCase SCREENING_REVIEW`. On `ScreeningOutcome` CLEAR (and still eligible) → T11 → ASSIGNED"; :116 "**`BINDING_MISMATCH` → PAUSE in every class**"; :191 "`kind:"CCTP_MINT"` … is always REVIEW".
  - Criteria: MC-17(b), MC-11 (exit that can succeed), JL-2, JL-3.
  - Trace, reconstructed with an inline model of the :155 and :186 rules:
    - c1 `UNIDENTIFIED_INBOUND` (:292) → `ASSIGN(W)` on c1 (:308) → screen → REVIEW → `createCase SCREENING_REVIEW` c2, which becomes current under :155 → `ScreeningOutcome CLEAR` → T11 → the CBS looks for the latest ASSIGN on the current case c2. There is none, so `REJECTED{BINDING_MISMATCH}` → rail-wide PAUSE.
    - The model printed: plain CLEAR path → binds to W; REVIEW then CLEAR → binds to None.
    - A REVIEW is resolved by `ScreeningOutcome`, never by an ASSIGN on c2, so this path can't succeed.
    - For every unattributed mint the sender is `0x0`, so the screen is `CCTP_MINT`, which is always REVIEW. **Every mint assignment from SUSPENSE therefore ends in a rail-wide PAUSE.** The §5.2 mint gate "T2, T8 or T11" (:267) can't be reached through T11.
    - Re-issuing (a QUARANTINE `RESUME` with attempt + 1, or a new ASSIGN on c2) loops: a mint's re-screen is REVIEW again → c3 → mismatch again. The only exit is RETURN.
  - Second aspect: the CBS receives no definition of "the item's current case" (:155 is adapter state). The only case reference in the request is the adapter's `refs.caseId` (:186). If the CBS uses that, the adapter picks the case, and the R11-D3 superseded-ASSIGN mutant survives (cite c1 when W was assigned on c2).
  - Severity: blocking. This is the same class as contract R5 C1, where a re-issue meets a deterministic rejection and loops. It also halts every payout rail-wide on a routine flow.
- **C2 · REAL.**
  - Evidence: :155 "The current case stays current until the item **leaves the held state family it waits in** (it reaches a terminal state, or a non-held state such as SCREENING or **RETURNING** through a disposition) … So after `HOLD`, after a partial return (`RETURNED_PARTIAL`), and after a `RETURN_FAILED` resolution, the item is back in a held state and its current case is still open"; :419 the partial-return row opens no case; :423 the `RETURN_FAILED` resolution opens no case.
  - Criteria: MC-11 (one action per cell; exit), MC-12(b).
  - Under the definition, RETURN → RETURNING ends case c. After RETURNED_PARTIAL or RETURN_FAILED the item is back in HELD_IN_CLEARING or SUSPENSE with no current case, so every later disposition is stale under :156. That is the R11-D1 dead end for the remaining G5/G4 funds. The sentence that follows asserts the opposite.
  - Severity: minor. The text names both paths and states the intended result explicitly, so a specific-over-general reading gives the right behaviour. The defect is the contradiction.
- **C3 · REAL.**
  - Evidence: :303 "`RELEASE`, `to` has **no mapping** (including an unattributed mint) | r := r + 1, re-screen. … HIT/REVIEW → stays, case continues"; :304 "a late `ScreeningOutcome` for an earlier REVIEW | recorded on the open case, no state change"; :191 CCTP_MINT is always REVIEW. The same gap reaches HELD_IN_CLEARING via :299 (AWAITING_SCREENING `HOLD` → "exactly as the HELD_IN_CLEARING rows") and HELD_FOR_CASE via :332 and :363-364, with the current round's REVIEW still pending.
  - Criteria: MC-11 (exit that can succeed; no dead-end loops), JL-2.
  - No row handles the **current** round's `ScreeningOutcome` in HELD_IN_CLEARING or HELD_FOR_CASE. At best :304 records it. So RELEASE → REVIEW → CLEAR does nothing, and a further RELEASE re-screens again; for a mint that is always REVIEW, which loops.
  - R11 C1 recorded this, and fix H did not touch :303 or :304.
  - Severity: minor. RETURN and HOLD remain as exits, funds stay itemised, and a non-mint re-screen can return CLEAR synchronously.
- **C4 · REAL.**
  - Evidence: :186 "every release (T5) of an instruction that has a signing-log entry must have no final status-1 transaction for that instruction"; ADR-001:25, where the signing log is `(payloadHash, nonce, txHash, instructionId)` "for every signature"; LEDGER CF-18 :67, where cancels "carry the cancelled item's `instructionId`"; :358 and :351, where T5 (condition 3) follows *our same-nonce cancel is final*.
  - Criteria: MC-11 (the legitimate flow gets a fail-closed action), JL-3.
  - A zero-value self-send cancel succeeds with status 1 and carries the instruction's ID, so the clause as written PAUSEs on every legitimate cancel → release.
  - :190's settlement clause has the right qualifier ("whose content matches that instruction's approval"), and ADR-008:45 says "no released instruction was paid on-chain". The CONTRACT release clause lacks it.
  - Severity: minor, because it fails closed.
- **C5 · REAL.**
  - Evidence: :186 "Every settlement (T4, or its fallback, with `refs.txHash`)" against the :186 request schema `refs:{subjectRef, caseId?, instructionId?, address?}`, which has no txHash; :190 "`txHash` is recorded on the journal"; :198 `listJournals` → `{journalId, key, legs, postedAt}`, with no txHash and no refs; ADR-008:75, where the DR-29 input is "CBS journals **with their legs and `txHash`** (`listJournals`)".
  - Criteria: MC-04/MC-17 completeness, MC-44.
  - The T4 fallback has no field for the txHash it must carry, and no CONTRACT read returns a journal's txHash to the monitor. The monitor can still join on instructionId by recomputing K.settle, so the stated `(instructionId, txHash)` join is unsupported but the protection isn't lost.
  - Severity: minor.
- **C6 · REAL.**
  - Evidence: :265 "Inbound → bank-owned wallet | … | HIT, REVIEW"; :266 "unidentified | … | always (`UNIDENTIFIED_INBOUND`)". Against these: :300 "T2 or T8 REJECTED → `createCase POSTING_REJECTED`" and :313 "T11 REJECTED → `createCase POSTING_REJECTED`".
  - Criteria: MC-47 (reverse), JL-4.
  - This is the R11-D5 residue (R11 named :300 and :313 against :264-266).
  - Observation, not counted separately: per class, :266 and :267 also omit the reasons their SUSPENSE_ASSIGNING and cleared-mint rows open (`SCREENING_HIT`/`SCREENING_REVIEW` :293/:311/:312, `STANDING_INELIGIBLE` :296/:310, and `UNIDENTIFIED_INBOUND` for a mint :297/:303).
  - Severity: minor.
- **C7 · DISMISSED.**
  - Evidence: :248-249, where T9/T10 are `K.settle` postings with GL-only legs, and :186's chain check names only "T4, or its fallback".
  - Criterion: MC-17(b).
  - A compromised adapter could attribute case return cr-2's final transfer to cr-1, leaving item I2 shown as still held. MC-17(b) binds **account and amount**:
    - T9/T10 accounts are fixed GL roles, not adapter-chosen customers;
    - a wrong amount leaves a non-zero chain residual (§5.7).
  - Attribution between held items is an itemisation question outside MC-17(b) as written. It is noted for the queued R11 Probe G ("choice of record").
- **C8 · DISMISSED.**
  - Evidence: :236 "The signer's signing log records `(payloadHash, nonce, txHash)`", while :190 relies on the entry carrying `instructionId`.
  - Criterion: MC-44.
  - This is routed as open LEDGER CF-9(b) (Fix I) and is already in ADR-001:25. The instructionId can also be derived from `payloadHash` through the approval.
- **C9 · DISMISSED.**
  - Evidence: :507 "`A_stall`: 30 s, as proposed in **Q-A7**" with the trigger "two or more own nodes", while Q-A7 (OPEN_QUESTIONS:24) proposes "30 s with no new head on ≥2 sources".
  - Criterion: MC-44.
  - The cited claim (the 30 s value) is what Q-A7 says, and CONTRACT is now internally consistent. The "sources" wording belongs to OPEN_QUESTIONS (cross-unit note).
- **C10 · DISMISSED.**
  - Evidence: :186 "(proposed DR-29, ADR-008; THREAT_MODEL routing CF-16(b))", while THREAT_MODEL:194 now defines DR-29 and CF-16(b) is done.
  - Criterion: MC-44.
  - This is stale wording, not a false claim: DR-29 is still pending G1.

DEFECTS:
- **D1** · CONTRACT.md:186 (T11 binding), with :155, :312, :116 and :191 · R / MC-17(b), MC-11, JL-2, JL-3 · **blocking**
  - Binding T11 to "the latest ASSIGN on the item's current case" rejects every legitimate assignment that passes through a screening REVIEW. The REVIEW opens a new current case that carries no ASSIGN, so the result is `BINDING_MISMATCH` and a rail-wide PAUSE.
  - It happens deterministically for every unattributed mint, because CCTP_MINT is always REVIEW. Re-issue loops.
  - The CBS is also given no way to identify the current case except the adapter's `refs.caseId`.
  - Fix direction: bind T11 to the latest ASSIGN for the subject that the CBS finds **from its own case records** (highest disposition across that subject's cases, or the ASSIGN that started the current assignment attempt), independent of `refs.caseId` and of later screening cases.
- **D2** · CONTRACT.md:155 (with :419, :423, :156) · R / MC-11, MC-12(b) · **minor**
  - The current-case definition ends the case when the item enters RETURNING, but the next sentence says it is still open after RETURNED_PARTIAL and RETURN_FAILED.
  - Under the definition, the remaining G5/G4 funds sit in a held state with no current case (the R11-D1 dead end).
- **D3** · CONTRACT.md:303-304 (also via :299/:305 and :332/:363-364) · R / MC-11, JL-2 · **minor**
  - No row acts on the current round's `ScreeningOutcome` in HELD_IN_CLEARING or HELD_FOR_CASE.
  - RELEASE of an unmapped item that re-screens REVIEW can't complete, and for a mint it is a dead-end loop.
  - This was noted in R11 C1 and is unchanged.
- **D4** · CONTRACT.md:186 (release clause) · R / MC-11, JL-3 · **minor**
  - "No final status-1 transaction for that instruction" fires on every legitimate same-nonce cancel → T5 (condition 3), because cancels carry the instructionId.
  - The clause needs the payout-content qualifier that :190 uses.
- **D5** · CONTRACT.md:186 (`refs.txHash`) and :198 (`listJournals`) · R / MC-04, MC-17 completeness, MC-44 · **minor**
  - `refs.txHash` is used but not in the refs schema.
  - No read returns a journal's txHash, yet :190 and ADR-008:75 state a join on it.
- **D6** · CONTRACT.md:265-266 · R / MC-47, JL-4 · **minor**
  - The §5.2 cells still omit `POSTING_REJECTED` from the T8 path (:300) and the T11 path (:313). This is the R11-D5 residue.

VERDICT: NEGATIVE (6 defects: 1 blocking, 5 minor).

Fix block H closed both R11 blocking defects as R11 stated them, plus R11-D4 and R11-D6. R11-D3 is closed for its mutant but replaced by D1: the new T11 binding record is the item's current case, which a REVIEW replaces with a case that has no ASSIGN. R11-D5 is partly fixed. This is grace round 2 of 2, so under LEDGER the blocking defect goes to the operator.

Notes for the rubric proposal queue:
- **Probe G:** MC-17(b) should re-trace every binding rule against **every legitimate path that reaches the posting**, not only the wrong-account mutant. D1 is a binding rule that passed the mutant re-trace but rejects a legitimate flow.
- **Probe F:** for postings with GL-only legs (T9/T10), MC-17(b)'s account-and-amount binding is met when the amount is pinned by the chain identity. Attribution between held items belongs to the itemisation checks (MC-04), so a good contract shouldn't fail MC-17(b) on it.

Cross-unit notes (not counted against this unit):
- THREAT_MODEL DR-29 (:194) still binds T11 to "the `ASSIGN` disposition on the same subject's case". It should follow the corrected D1 rule. CF-25 covers only the settlement and release checks.
- CF-25 (LEDGER:71) repeats D4's wording ("no released instruction has a final status-1 transaction").
- OPEN_QUESTIONS Q-A7 says "≥2 sources", while CONTRACT says "two or more own nodes".

Regression (unchanged areas):
- §6 unit mapping (13/13 rows, extra boundaries, live receipt): PASS.
- §1.2/§1.3 keys and derived IDs: PASS.
- §5.0 matching: PASS.
- §5.7 templates and effect table (identical to R11): PASS.
- §5.8 age set (33 waiting states): PASS.
