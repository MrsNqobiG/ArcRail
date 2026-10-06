VERIFICATION · lens: R · target: P1-contract (docs/CONTRACT.md v3 after fix block I; Phase-1 close-out round 1) · commit: none (the repo has no commits; working tree only). CONTRACT.md sha256 d48f622c28d3fbd752fd43b44d1e057352b3722a92f9dccdec16ed08b24d7351, 600 lines, mtime 2026-10-05 14:57. Unchanged from pass start to pass end.

**Criteria:** CLAUDE.md, .claude/agents/verifier.md, docs/RUBRIC.md (sha256 62698867…, the same at start and end), and the Phase 1 exit rule now in force (LEDGER :14, operator 2026-10-05): a unit freezes on a pass with zero BLOCKING defects. Blocking = money can be lost, misposted, or moved without the required control, or a fail-closed path is missing. Everything else is minor.

**Sibling hashes pinned at pass start (15:2x +0200) and re-read at pass end (15:37:53):**
- Unchanged: RUBRIC (62698867…), THREAT_MODEL (4971e7c4…), RISK_REGISTER (48930790…), OPEN_QUESTIONS (01528f20…), SEQUENCES (d3f68f8b…), constants.md (e494e772…), G1_PACKET, MISSION, PHASE2_SLICE_PLAN.
- Changed during the pass: LEDGER (aaf57367… → d8fe3330…) and GATES (8a7cc182… → 6f8be479…). docs/STATUS.md appeared (6aff9f5d…).
- I re-read every LEDGER passage I rely on in the end version, and each still says what is quoted below: :14 (exit rule), :79 (CF-39), :100 (CF-26).
- ADR-008 (164d5277…) and ADR-001 (ee09a22e…) were hashed only at the end. I rely on ADR-008 :24 and :75, which I read during the pass.

**What fix I changed:** there is no fix-H copy on disk. Only `.tools/drafts/CONTRACT_backup_fixG.md` (d6768590…, the R11 target) exists. Diffing it against the current file, and subtracting the fix-H lines R12 listed, shows that fix I touched:
- header :3–11;
- §1.7 :162–171 (current case, where a disposition acts, stale screening);
- §3 :200 (refs schema, `assignRef`, supersession, release-check qualifier, net-of-returns amount), :204 and :212;
- §5.2 :278–281;
- §5.3 :317, :318 and :322;
- §5.4 :378.

I used the diff only to locate changes. I did not read the author's notes or scripts.

**Guard rules, followed by hand (the hook was not loaded):**
- Network use was limited to read-only `eth_chainId` and `eth_getTransactionReceipt` calls on https://rpc.testnet.arc.io (chain 5042002), plus the HTTP GETs that tools/source_drift.py makes (run without `--out`, so stdout only).
- I called no signing or sending method and no mainnet endpoint, and read no .env files or keys.
- Scratch computations ran as inline python and wrote no files.
- The only file I wrote is this report.

CHECKS:

R12 defects re-checked against fix block I:
- **R12-D1 (blocking: T11 bound to the current case's ASSIGN, so every assignment through a REVIEW PAUSEs)** → FIXED.
  - :200: T11 carries `refs.assignRef`. The CBS checks it against "its **own** disposition record. That disposition must be an `ASSIGN` on a case whose subject equals `refs.subjectRef`". A later `ASSIGN`, `HOLD` or `RETURN` for the subject → `REJECTED{NOT_PERMITTED}`, which is a D-then-F business refusal → SUSPENSE with `POSTING_REJECTED` (:327).
  - :322 records `assignRef` at the SUSPENSE `ASSIGN`.
  - I re-traced it with an inline model of the :200 rule:
    - ASSIGN(W) on c1 → REVIEW (c2 current) → CLEAR → T11 cites (c1,1) → OK;
    - R11 superseded-ASSIGN mutant (W on c1, V on c2, the adapter cites c1) → NOT_PERMITTED;
    - stale HOLD on c1 after the ASSIGN → NOT_PERMITTED → SUSPENSE, then a new ASSIGN on c3 → OK;
    - partial RETURN then ASSIGN → OK.
  - Mint path: RELEASE → REVIEW → AWAITING_SCREENING → CLEAR → `unid` → SUSPENSE → ASSIGN → REVIEW → CLEAR → T11 → OK. No loop. PASS.
  - The second aspect (the CBS had no way to find the current case) is gone. The CBS now uses only `assignRef` plus its own record. Q-C19 (OPEN_QUESTIONS :59) names the "CBS decision order across those cases" that "later" needs.
- **R12-D2 (current-case definition contradicted partial returns)** → FIXED. :164 "stays current until a newer case replaces it, or until the item reaches a terminal state. **Nothing else ends it**". :165 lists RETURNED_PARTIAL and RETURN_FAILED explicitly, and :433 and :437 open no case. No contradiction remains.
- **R12-D3 (current-round outcome unhandled in held states; mint RELEASE loop)** → FIXED.
  - :317: a no-mapping RELEASE "re-run[s] SCREENING … REVIEW (every mint) → AWAITING_SCREENING, whose rows act on the outcome".
  - :318 and :378 cover the current round's outcome after a HOLD or an abandoned assignment.
  - A residual gap for RET_ states is D3 below (minor).
- **R12-D4 (release check fired on our own cancel)** → FIXED. :200: "no final status-1 transaction whose content matches that instruction's approval. The item's own same-nonce cancel … doesn't count". THREAT_MODEL DR-29 :222 matches.
- **R12-D5 (`refs.txHash` not in schema; `listJournals` returned no refs)** → FIXED.
  - The :200 schema now has `txHash?` and `assignRef?`.
  - :212 `listJournals` returns `refs`.
  - :204 settleHold carries `txHash`.
  - One wording slip remains (D4, minor).
- **R12-D6 (§5.2 cells)** → FIXED. :279 adds `POSTING_REJECTED (T8)`. :280 adds `SCREENING_HIT`, `SCREENING_REVIEW`, `STANDING_INELIGIBLE` and `POSTING_REJECTED (T11)`. :281 adds the mint's assignment reasons.

Rubric, mechanical (by reconstruction):
- **MC-03 unit mapping** → PASS.
  - All 13 §6.1 rows match by exact `divmod`.
  - (w_max + 1) // 10^12 = 2^63.
  - NATIVE_WEI→USDC_UNITS: 1,234,567,890,123,456,789 → (1,234,567, r 890,123,456,789).
  - 21,000 × 20 gwei = 420,000,000,000,000.
  - p = 6 boundaries: 3 → (0, 3); 10^12 + 1 → (1, 1); the m for uint256 max has 66 digits, which trips the CBS_MAX guard (:547).
- **MC-03 live anchor** → PASS. Read-only testnet calls at 2026-10-05 13:36 UTC:
  - `eth_chainId` = 5042002;
  - receipt 0x0e8279a4…24695 has status 0x1, gasUsed 167,599 and effectiveGasPrice 44,000,000,000. The product is 7,374,356,000,000,000 → (7,374, r 356,000,000,000), matching :562.
- **MC-04 templates and identities** → PASS. §5.1 (:254–267) and the §5.7 effect table (:476–490) have no leg changes in fix I.
  - Re-entry after a partial return: T2/T8/T11/`unid` post `h` (:269).
  - fee = 0 → no G6 leg.
  - G5/G4 itemisation (:495–496) is unchanged.
- **MC-05 drift cells** → PASS (unchanged): :246, :373, :374, :397–401, :436, :458.
- **MC-06** → PASS (:33, unchanged).
- **MC-10 keys and derived IDs** → PASS. Recomputed with JCS:
  - K.recv(5042002, 0xab×32, "0", "0") = arc1-970ee4c7…f3b0785b (69 characters);
  - K.assign attempt 0 ≠ attempt 1;
  - case-return IDs are 35 characters and match the grammar for caseId "X"×128 (cr-23a10a40…), ("a:b","0") vs ("a","b:0") (cr-86784d86… vs cr-d16694b5…) and dispositionSeq "9"×40.
  - `assignRef` is in the K.assign payload (not the key). A new ASSIGN after `NOT_PERMITTED` re-issues with attempt + 1 under :90–98 (getResultByKey → REJECTED). Correct.
- **MC-11 totality** → FAIL (minor, D3).
  - New global rules expanded: :164–169 (current case; where a disposition acts, with precedence over §4/§5.3 QUARANTINE), :171 (stale or unawaited screening).
  - Disposition states named at :167 match the §5 rows that name a `CaseDisposition`: :313, :315–321, :322, :328–330, :346, :376–379.
  - The "exit that can succeed" re-trace passes for HOLD, partial return, RETURN_FAILED, abandoned assignment, NOT_PERMITTED → new ASSIGN, and mint RELEASE.
  - Gap: the sender screening outcome arriving in RETURNING/RET_ states (D3).
- **MC-11(vi)** → PASS (:145–147; :521 "two or more own nodes" now matches Q-A7 :24).
- **MC-12 ages** → PASS. No new waiting state. :522 and :533 are unchanged, and the D2 reading (held item with no case) is gone.
- **MC-13** → PASS. T5 conditions :383–388 unchanged. The release check adds a check and releases nothing.
- **MC-17(a)** → PASS (:244–246 unchanged).
- **MC-17(b)** → **FAIL (D1, blocking).** I re-traced every G1-leg writer and every adapter-chosen lookup key:
  - placeHold, settleHold, releaseHold, T3/T4/T5 fallbacks and T2: PASS (unchanged from R12).
  - T11 `refs.assignRef`: PASS (above).
  - New: fix I made the DR-29 amount bound for T2/T8/T11/`unid` depend on `refs.caseId` of T9/T10 (:200 "joined to the item through `refs.caseId` and that case's subject"). That is an adapter-chosen lookup key, and no executor ties it to the case-return transfer. Wrong-record mutant: see D1.
- **MC-21 Arc quotes** → PASS. tools/source_drift.py sha256 5504b5e7…80e1, the version reviewed in P1-rubric-lensR-13/15 and used in contract R11/R12. I ran it myself: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33". The inline :220 custody quote and the cited C-ids are unchanged since R12, and the tool shows no drift.
- **MC-44 references** → FAIL (minor, D2).
  - A script resolved all 96 cited DR/RR/RB/CF/Q/T/L/C/P IDs in the siblings.
  - All `createCase` reasons are in the 21-entry closed list (:206).
  - But the header's "routed as LEDGER **CF-26**" (:11) resolves to an unrelated item (LEDGER :100, QUARANTINE-resolution channel). The item meant is CF-39 (LEDGER :79, which says so).
- **MC-45** → PASS.
  - Q-C19 (:59) matches :200 clause by clause, including NOT_PERMITTED and the cross-case decision order.
  - ADR-008 :75 lists `refs.assignRef` and `refs.caseId`.
  - THREAT_MODEL DR-29 :222 matches all four header points.
  - The D1 gap is common to all three (cross-unit note).
- **MC-46 event values** → PASS (unchanged).
- **MC-47 movement classes** → PASS both ways. 8 branch classes, 8 rows. Every §5.3–§5.6 `createCase` reason appears in its class's §5.2 cell.
- **N1 testnet only** → PASS: 5042002 only, at :38 and :112.
- **I-INT / I-CONV** → PASS (:27, :34, §6).
- **Not applicable:** MC-01/02/07/08/14/15/16/18/19/20/22–25/30–34/48 (code), MC-40/41/42/43 (other units).

Judgment lenses:
- **JL-1 fail-closed** → FAIL (D1): a misattributed case return produces no PAUSE anywhere.
- **JL-2 human-owned** → [inspection-only] PASS. Compliance's ASSIGN through a REVIEW and the RELEASE of a mint now complete. A re-decision supersedes the earlier ASSIGN.
- **JL-3 03:00 operability** → [inspection-only] PASS. A superseded ASSIGN now comes as `NOT_PERMITTED` with a `POSTING_REJECTED` case, not as an integrity PAUSE.
- **JL-4 auditability** → FAIL (part of D1): a T9/T10 journal's `caseId` can't be traced to its chain transfer.
- **JL-5, JL-6** → [inspection-only] PASS.

CANDIDATES (Lens R; recorded for transparency):
- **C1 · REAL.**
  - Evidence:
    - :200 "The expected amount is the item's `h` (§5.1): `m = ⌊W/k⌋` from the log, less `R` for every T9 or T10 already posted for that item. Those case returns are joined to the item through `refs.caseId` and that case's subject."
    - :200 "T9/T10 carry `instructionId` (the case-return ID) and the `caseId` of the `RETURN` disposition … A required ref that is missing → `REJECTED{INVALID}`". Missing is the only CBS check on T9/T10 refs. The binding paragraph covers G1 legs only, and T9/T10 have none (:262–263).
    - :200 "Every settlement (`settleHold`, or the T4 fallback …) must match a final status-1 transaction". T9/T10 aren't named, and their refs carry no `txHash`.
    - THREAT_MODEL :222 DR-29 nets "each joined through `refs.caseId` to a case whose subject is the item".
    - DR-01 :194 binds the on-chain case-return **transfer** to its disposition, but not the T9/T10 **journal's** `caseId`.
  - Criteria: MC-17(b) ("binds which record it cites (which instruction or case) to the chain fact"; "a lookup key the adapter can choose counts as an adapter-chosen value unless …"; "re-trace a wrong-record mutant"), JL-1, JL-4.
  - Inline model, p = 2, k = 10^16:
    - I1 and I2 each W = 10^20 (m = 10,000).
    - Compliance returns R = 2,500 from I1. The transfer is genuine (cr-ID from (c_I1, seq)) and DR-01 passes.
    - The compromised adapter posts I1's T9 with `refs.caseId` = c_I2, a genuine case on I2. Then T2(I1) = 10,000 and T2(I2) = 7,500.
    - DR-29 expects I1 = 10,000 and I2 = 7,500, so both match. G5 = 0, chain residual = 0, and the G1 accounts are correct per the issuance record.
    - Customer A is over-credited 2,500 and customer B under-credited 2,500. The model printed exactly this.
    - The T10 variant does the same to T11 or `unid`.
  - Before fix I, DR-29 compared with `m`, so this flow false-PAUSED (fail closed). Fix I introduced the adapter-chosen key into an amount binding.
  - Severity: **blocking**. Money is misposted between customers with every control at 0. This is the same class as R11-D2, where a settle cited another customer's paid transaction.
- **C2 · REAL.**
  - Evidence: :11 "All of these are routed as LEDGER **CF-26**". LEDGER :100 CF-26 is the QUARANTINE-resolution channel item, and LEDGER :79 says "CONTRACT's fix-block-I header cites this item as "CF-26" … the contract unit renumbers its citation at its next fix block".
  - Criterion: MC-44.
  - Severity: minor. LEDGER redirects the reader.
- **C3 · REAL.**
  - Evidence:
    - :313 inbound AWAITING_SCREENING `RETURN` → "exactly as the HELD_IN_CLEARING rows" → RETURNING while the sender REVIEW is still outstanding;
    - :171 "Only an outcome for the current round can resolve a REVIEW, and only in a state that awaits it (AWAITING_SCREENING, SUSPENSE_ASSIGNING). The held-state rows … apply this rule";
    - :410 RET_SCREENING screens `returnDestination` at "round r", the same r.
  - Criterion: MC-11(ii) (every §4 event that can arrive in the state, split by correlation).
  - That `ScreeningOutcome` can arrive in RET_SCREENING … RET_AWAITING_APPROVAL (up to `A_approval`, 24 h). None of those states has a row for it.
  - "Current round" is also ambiguous between the inbound item's sender screen and its case return's destination screen, which share r. :318 covers the outcome only once the item is back in a held state.
  - Severity: minor. No row moves money, the case return still needs its own screen and approval, and :171 at least says the outcome can't resolve anything there.
- **C4 · REAL.**
  - Evidence: :212 "For a `settleHold` journal, it holds the outbound instruction's `subjectRef`, `instructionId` and `txHash`, taken from the request". The :204 request is `{key, holdId, instructionId, txHash, legs}`, with no `subjectRef`.
  - Criterion: MC-04/MC-17 schema completeness. [inspection-only]
  - It can be derived as `["out",instructionId]` (:56), so nothing is lost.
  - Severity: minor.
- **C5 · DISMISSED.**
  - Evidence: :200 "a later `ASSIGN`, `HOLD` or `RETURN` for the same subject, on any of its cases", while `dispositionSeq` orders only within one case (:169).
  - Criterion: MC-11, MC-17(b).
  - Q-C19 (OPEN_QUESTIONS :59) explicitly asks for "a CBS decision order across those cases". The order is the CBS's own, so the adapter can't choose it.
- **C6 · DISMISSED.**
  - Evidence: DR-29 compares each T2/T11 with `h` but doesn't net earlier T2/T11, so a duplicate T11 (attempt + 1) matches `h` twice.
  - Criterion: MC-17(b).
  - :498 and THREAT_MODEL DR-07 :200 (G5/G4 itemisation in the monitor; its mutant is "a duplicate T2") catch it: G4 goes negative against an itemised 0 → PAUSE.
- **C7 · DISMISSED.**
  - Evidence: :11 "ahead of THREAT_MODEL v2 fix block 8 … ahead of ADR-008 fix block 6", while THREAT_MODEL is at fix 9 and ADR-008 at fix 7, both now matching (THREAT_MODEL :21–27).
  - Criterion: MC-40 label agreement.
  - The claims are true of the versions they name, and the newer siblings say they match. Under MC-40 this is not a defect.

DEFECTS:
- **D1** · CONTRACT.md:200 (net-of-returns amount via `refs.caseId`; T9/T10 refs unchecked; settlement-vs-chain clause omits T9/T10), with :262–263 and :433 · R / MC-17(b), JL-1, JL-4 · **blocking**
  - The DR-29 amount bound for T2/T8/T11/`unid` subtracts every T9/T10 "joined to the item through `refs.caseId`". Nothing ties that `caseId` to the journal's own case-return `instructionId` or to its on-chain transfer.
  - A compromised adapter can attribute a genuine case return of item I1 to another held item I2. It then credits I1's customer the full `m` and I2's customer `m − R`. DR-29, G5 itemisation and both identities all stay at 0, so money is misposted between customers.
  - Fix direction: bind each T9/T10 to its chain fact.
    - The CBS rejects (`BINDING_MISMATCH`) a T9/T10 unless `refs.instructionId` = `"cr-" + first32hex(SHA-256(canonical(["arc1","cr",refs.caseId,dispositionSeq])))` for a `RETURN` disposition in its own record on that case, whose subject is the inbound item and whose `returnAmount` equals the journal's R.
    - T9/T10 also carry `refs.txHash`, and DR-29 joins `(instructionId, txHash)` to a final status-1 receipt whose signing-log entry carries that `instructionId`, with `to` = `returnDestination` and value = R × k.
    - DR-29 nets only T9/T10 journals that pass this join.
- **D2** · CONTRACT.md:11 · R / MC-44 · **minor**: the header routes fix I's sibling work to "LEDGER CF-26", but CF-26 is an unrelated item. The intended item is CF-39.
- **D3** · CONTRACT.md:171 with :313 and :410–437 · R / MC-11(ii) · **minor**
  - A sender `ScreeningOutcome` for a REVIEW still outstanding when an AWAITING_SCREENING `RETURN` moved the item into RETURNING has no row in RETURNING or the RET_ states.
  - "Current round" is ambiguous between the item's sender screen and its case return's destination screen, which share r.
- **D4** · CONTRACT.md:212 vs :204 · R / MC-04 schema completeness · **minor**: `listJournals` says a settleHold journal's `subjectRef` is "taken from the request", but the settleHold request has no `subjectRef`. It is derivable as `["out",instructionId]`.

VERDICT: NEGATIVE (4 defects: 1 blocking, 3 minor).

Fix block I closed all six R12 defects. R12-D1, the blocking one, is closed by reconstruction: legitimate assignments through a REVIEW bind, and superseded ASSIGNs are refused as a business refusal. But the net-of-returns amount check that fix I added, which removes R12's false PAUSE after a partial return, keys on an adapter-supplied `refs.caseId` that nothing binds. That reopens a wrong-record misposting path (D1), so under the operator's exit rule P1-contract does not freeze this round. D2–D4 are minor and can be carried to the G1 packet.

Notes for the rubric proposal queue:
- **Probe G:** when a binding is made *net* of other journals (subtracting returns, fees or earlier partial postings), MC-17(b)'s wrong-record mutant must also be re-traced through **each netted journal's cited record**, not only the journal under check. D1 passed every per-journal check.
- **Probe F:** an "ahead of fix block N" claim stays valid after the sibling moves to N + 1 and says it matches (C7). Only a claim the newer sibling contradicts is a defect.

Cross-unit notes (not counted against this unit):
- THREAT_MODEL DR-29 (:222) and ADR-008 :75 inherit D1: both net T9/T10 through `refs.caseId` with no join to the case-return transfer. DR-29's "A netted T9 or T10 with no matching chain outflow … DR-06 catches it" covers a fabricated return, not a misattributed genuine one.
- LEDGER's CF-39 should gain the D1 fix for THREAT_MODEL, ADR-008 and Q-C19 (a CBS check of T9/T10 `caseId` against the `cr-` derivation).

Regression (unchanged areas):
- §6 unit mapping (13/13 rows, boundaries, live receipt): PASS.
- §1.2/§1.3 keys and derived IDs: PASS.
- §5.0 matching: PASS.
- §5.1 templates and §5.7 effect table and itemisation: PASS.
- §5.8 age set: PASS.
