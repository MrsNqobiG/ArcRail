VERIFICATION · lens: R · target: P1-contract (docs/CONTRACT.md v3 after fix block J; Phase-1 close-out round 2) · commit: none (uncommitted working tree). CONTRACT.md sha256 3f1141e8e6f9c7fdb8b927d9408bb675134b116aeb61db782e77467a4d40b398, 605 lines, mtime 2026-10-05 16:35. It did not change between the start and end of the pass. This is the hash that LEDGER CF-39(f) asks SEQUENCES to re-pin to.

**Criteria:**
- .claude/agents/verifier.md
- docs/RUBRIC.md (sha256 62698867…, the same at start and end)
- The Phase 1 exit rule in force (LEDGER :16, operator 2026-10-05): a unit freezes on a pass with zero BLOCKING defects.
  - Blocking: money can be lost, misposted, or moved without the required control, or a fail-closed path is missing.
  - Minor: everything else.

**Sibling hashes.** Pinned at pass start (~17:05 SAST) and re-read at pass end (17:18 SAST). All were unchanged:

| File | sha256 (prefix) |
|---|---|
| LEDGER | 1c993877 |
| THREAT_MODEL | 863dcfbf (v2 fix block 10, edited at 16:37, just before this pass) |
| RISK_REGISTER | 48930790 |
| OPEN_QUESTIONS | 2a973005 |
| SEQUENCES | d3f68f8b |
| RUBRIC | 62698867 |
| constants | e494e772 |
| G1_PACKET | 4bfdbe12 |
| GATES | 6f8be479 |
| STATUS | 6aff9f5d |
| MISSION | 0e2339ed |
| PHASE2_SLICE_PLAN | f5810a7d |
| ADR-001 | ee09a22e |
| ADR-008 | 164d5277 |

**Locating fix J.** There is no fix-I copy on disk. I located fix J's changes from R13's defect list and the LEDGER P1-contract row (:37), and confirmed each in the file:
- header :3–12;
- §1.7 :173–176 (current round; case-return screen; RETURNING and the RET_ states);
- §3 :205 (T9/T10 `RETURN` binding; T9/T10 as settlements; netting only bound T9/T10) and :217 (`listJournals` `subjectRef` derived);
- §5.5 :409, :415 and :438;
- §5.6 :447 (move-approval threshold).

I did not read the author's notes or reasoning.

**Guard rules, followed by hand (the hook was not loaded):**
- Network use:
  - read-only `eth_chainId` and `eth_getTransactionReceipt` calls on https://rpc.testnet.arc.io (chain 5042002);
  - the HTTP GETs that tools/source_drift.py makes. It was run without `--out`, so it wrote to stdout only. Its hosts are docs.arc.io, developers.circle.com and four regulator sites.
- I called no signing or sending method and no mainnet endpoint, and read no .env files or keys.
- Scratch computations ran as inline python and wrote no temp files.
- The only file I wrote is this report.

CHECKS:

R13 defects re-checked against fix block J:
- **R13-D1 (blocking: DR-29 nets T9/T10 through an unbound, adapter-chosen `refs.caseId`) → FIXED.**
  - What fix J added:
    - :205: T9/T10 carry `instructionId`, `caseId`, `dispositionSeq` and `txHash`.
    - The CBS's "**own** disposition record must hold a `RETURN` with `refs.caseId` and `refs.dispositionSeq`, `refs.instructionId` must equal that disposition's case-return ID … and the journal's R must equal that disposition's `returnAmount`. Anything else → `REJECTED{BINDING_MISMATCH}` → PAUSE".
    - Settlements now include "a T9/T10 with `refs.txHash`", with content "`to` = the `RETURN` disposition's `returnDestination` and value = R × k".
    - Netting: "Only a T9/T10 that passed the CBS's `RETURN` binding above **and** whose `(instructionId, txHash)` the monitor has joined to its case-return transaction is netted … Its item is the subject of the case that `refs.caseId` names, taken from the CBS's own case record, not from the adapter".
  - I re-traced R13's wrong-record mutant by reconstruction, with p = 2, k = 10^16, I1 and I2 each W = 10^20, so m = 10,000. Compliance decides a genuine RETURN R = 2,500 on c_I1 (seq 1).
    - (a) T9 cites `caseId` c_I2, and c_I2 has no `RETURN` → the CBS refuses it (`BINDING_MISMATCH` → PAUSE).
    - (b) c_I2 has its own `RETURN` (seq s, R' = 2,500). The adapter sets `instructionId` = cr(c_I2,s) to pass the CBS, with I1's `txHash`. The signing-log entry of I1's transaction carries cr(c_I1,1) ≠ cr(c_I2,s), so the DR-29 join fails → PAUSE.
    - (c) T9 keeps cr(c_I1,1) but cites c_I2 → the CBS recomputes the `cr-` derivation and it doesn't match → `BINDING_MISMATCH`.
    - (d) The adapter withholds I1's T9 and posts I2's genuine T9. That nets only from I2. I1's Rout is never settled. The monitor ages it from its own finality block (THREAT_MODEL DR-29 fix 10: "every final status-1 case-return transaction … within `A_post`"; ADR-008 ages claimed items) → PAUSE.
  - Honest path: R = 2,500 then T2 = 7,500, and for the suspense path a further R = 500 then T11 = 7,000. The model printed m = 10,000, 7,500 and 7,000, which match DR-29's expected `h`. No false PAUSE.
  - CBS capability for this check: OPEN_QUESTIONS Q-C19 (:59) now carries the T9/T10 clause word for word ("its own disposition record has the `RETURN` … `refs.instructionId` is that disposition's case-return ID … R equals its `returnAmount`").
  - PASS.
- **R13-D2 (header cited CF-26) → FIXED.** :12 cites "LEDGER **CF-39(f)**" and "(CF-39(d))". LEDGER :81 CF-39 has parts (d) and (f) with the same content.
- **R13-D3 (sender outcome in RETURNING and the RET_ states; ambiguous "current round") → FIXED.**
  - :173 defines the current round per screen. For an inbound item it is the latest **sender** screen. For a payout it is the latest **destination** screen. "A case return's destination screen … has its own subject and `screeningRef`, so it is never the item's current round. It is never awaited either".
  - :415: the case return is keyed `["out",instructionId]`, round "0".
  - :176: an outcome that arrives in RETURNING or a RET_ state is recorded and changes no state.
  - K.scr recomputed: each cr-ID gives a distinct key.
- **R13-D4 (`listJournals` settleHold `subjectRef`) → FIXED.** :217 "`subjectRef` = `["out",instructionId]` (§1.2), which the CBS derives from that `instructionId` because the request carries no `subjectRef`".

Rubric, mechanical (by reconstruction):
- **MC-03 unit mapping** → PASS.
  - All 13 §6.1 rows match by exact `divmod` (9 rows at p = 6, 4 at p = 2).
  - (w_max + 1) // 10^12 = 2^63.
  - 1,234,567,890,123,456,789 wei → (1,234,567, r 890,123,456,789).
  - 21,000 × 20 gwei = 420,000,000,000,000.
  - Boundaries: 3 → (0, 3); 10^12 + 1 → (1, 1); the `m` for uint256 max has 66 digits, which trips the CBS_MAX guard (:552).
- **MC-03 live anchor** → PASS. Read-only testnet calls at 2026-10-05 15:15 UTC:
  - `eth_chainId` = 0x4cef52 = 5042002;
  - receipt 0x0e8279a4…24695 has status 0x1, gasUsed 167,599 and effectiveGasPrice 44,000,000,000. The product is 7,374,356,000,000,000 → (7,374, r 356,000,000,000), matching :567.
- **MC-04 templates and identities** → PASS.
  - §5.1 (:257–272) and the §5.7 effect table (:481–495) have no leg changes in fix J.
  - T9 is G5↓ G2↓ and T10 is G4↓ G2↓, balanced. The G5/G4 itemisation is unchanged (:500–501).
  - A T9 posted where a T10 was due leaves G4 itemised at m − R against a balance of m → PAUSE.
- **MC-05 drift cells** → PASS (unchanged): :251, :378–379, :402–406, :441, :463.
- **MC-06 precision from the CBS** → PASS (:34, unchanged).
- **MC-10 keys and derived IDs** → PASS. Recomputed with JCS:
  - K.recv(5042002, 0xab×32, "0", "0") = arc1-970ee4c7…f3b0785b (69 characters);
  - K.assign at attempt 0 ≠ attempt 1;
  - cr-IDs are 35 characters and match the ID grammar for caseId "X"×128 (cr-23a10a40…) and for dispositionSeq "9"×128;
  - ("a:b","0") ≠ ("a","b:0"), and ("Ab","1") ≠ ("ab","1");
  - K.settle for cr(c1,1) ≠ cr(c1,2).
- **MC-11 totality** → PASS.
  - The new global rules were expanded: :173–176 (current round, case-return screen never awaited, outcomes in RETURNING/RET_ states recorded).
  - Every `ScreeningOutcome` that can arrive in RETURNING through RET_CANCELLING now has a rule. Dispositions there are recorded (:169).
  - The T9/T10 `BINDING_MISMATCH` result is covered by the global rule (:125 PAUSE in every class) and the RET_BROADCAST row (:438).
  - The "exit that can succeed" re-trace passes for a partial return then a second RETURN, which gets a new dispositionSeq, so a new cr-ID, so a fresh K.scr and K.settle.
- **MC-11(vi) RPC disagreement and stall** → PASS (:146–148, unchanged).
- **MC-12 ages** → PASS. No new waiting state. The RET_ rows at :521–524 are unchanged.
- **MC-13 hold release** → PASS. The T5 conditions (:388–393) are unchanged.
- **MC-17(a) outflow matching** → PASS (:249–251 unchanged; case returns are matched in RET_SIGNED, RET_BROADCAST and RET_CANCELLING).
- **MC-17(b) binding** → PASS. I re-traced every G1-leg writer and every adapter-chosen lookup key:
  - placeHold, settleHold, releaseHold, the T3/T4/T5 fallbacks, T2 and T11 (`assignRef`): unchanged since R13, PASS.
  - T9/T10 `refs.caseId`, `refs.dispositionSeq` and `refs.instructionId`: tied together by the CBS (`cr-` derivation and `returnAmount`). `refs.txHash` is joined to the chain fact by the monitor (DR-29).
  - Wrong-record mutants (a) to (d) above all PAUSE.
- **MC-21 Arc quotes** → PASS. tools/source_drift.py has sha256 5504b5e7…80e1, the version used in R11 to R13. I ran it myself: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33". The inline :225 custody quote and the cited C-ids are unchanged.
- **MC-44 references** → PASS.
  - These resolve: "contract R13 D1/D3/D4", CF-39(d)/(f), Q-C19, Q-A7, "§5.3, SUSPENSE `ASSIGN` row".
  - All `createCase` reasons used in §5.3–§5.6 are in the 21-entry closed list (:211). A script extracted them per section, and none fell outside the list.
- **MC-45 cross-document** → FAIL (minor; D1, D2 and D3 below).
  - Q-C19 matches :205 clause by clause.
  - ADR-008 :45 ("unsuperseded `ASSIGN`") supports header :12's claim that it matches points 1 to 4.
  - THREAT_MODEL fix block 10, edited in parallel at 16:37, now goes further than CONTRACT and differs from it on T9/T10 (D1, D2). ADR-001 duty 6 differs from §5.6 at the boundary (D3).
- **MC-46 event values** → PASS.
  - Every `PayoutOutcome` state is emitted, including RETURNED, RETURNED_PARTIAL and RETURN_FAILED (:438).
  - Every `CaseDisposition` value (RELEASE, HOLD, RETURN, ASSIGN, CANCEL) is consumed.
- **MC-47 movement classes** → PASS both ways.
  - 8 branch classes, 8 rows in §5.2.
  - Every §5.3–§5.6 reason is in its class's cell. CANCEL_BLOCKED and SIGNER_REFUSED reach case returns through the global send-time rule (:395–398).
- **N1 testnet only** → PASS: only "5042002" (:39, :113).
- **I-INT / I-CONV** → PASS (:28, :35, §6).
- **Not applicable:**
  - code items: MC-01/02/07/08/14/15/16/18/19/20/22–25/30–34/48;
  - other units: MC-40 to MC-43.

Judgment lenses:
- **JL-1 fail-closed** → PASS. Every T9/T10 misattribution PAUSEs at the CBS or at DR-29. The residual differences in D1 fail closed or are covered by the signer's replay rule.
- **JL-2 human-owned** → [inspection-only] PASS. R and the destination come only from the disposition (:409). Every case-return transfer also has a maker-checker approval.
- **JL-3 03:00 operability** → [inspection-only] PASS.
- **JL-4 auditability** → PASS. A T9/T10 journal now traces through its `txHash` to the chain, and through `caseId` and `dispositionSeq` to the human decision.
- **JL-5 fewest new parts, JL-6 privacy** → [inspection-only] PASS. Fix J adds no component and no PII. `refs` hold IDs and hashes only.

CANDIDATES (Lens R; recorded for transparency):
- **C1 · REAL (minor).**
  - Evidence:
    - CONTRACT :205 `refs:{subjectRef, …}` is required, and T9/T10 refs list `instructionId`, `caseId`, `dispositionSeq` and `txHash`, but no `subjectRef` value is stated.
    - The §1.2 table (:56) gives "outbound instruction (incl. case return) | `["out",instructionId]`". :217 and :415 use that form for settlements and for the case-return screen.
    - THREAT_MODEL DR-29 (:231) case-return check (b): "that case's subject is the item (`refs.subjectRef`)".
  - Criteria: MC-04 schema completeness, MC-45.
  - Under the §1.2 reading, a T9's `subjectRef` is `["out",cr-…]`, never equal to the case's `["in",…]` subject, so DR-29 (b) would PAUSE every case return. CONTRACT itself takes the item from the CBS case record (:205), so its own rule is sound.
  - Severity: minor. The inconsistency fails closed (a false PAUSE). No money moves wrongly.
- **C2 · REAL (minor).**
  - Evidence:
    - Header :12: "This version is **ahead of both** [THREAT_MODEL fix block 9, ADR-008 fix block 7] on point 5".
    - THREAT_MODEL fix block 10 (:28, :231) already carries point 5. It also adds:
      - (e) "no other posted T9 or T10 cites the same case-return ID";
      - monitor ageing of every final case-return transaction to its T9/T10 within `A_post`;
      - the `unid` log-`to` check;
      - `listCaseDispositions` with each case's subject.
    - LEDGER CF-38(d) (:89–100) routes all of these to "CONTRACT §3", and also asks for the text change: CONTRACT §3's "less `R` for every T9 or T10 already posted for that item" → "every bound T9 or T10".
    - CONTRACT :205 nets "each such **transaction** … once", which is per transaction, not per case-return ID, and doesn't mention CF-38(d).
  - Criteria: MC-45, MC-40 label clause.
  - Adjudication. I re-traced a duplicate-ID mutant: two final transactions under one cr-ID, each with its own T9.
    - It would pass the CONTRACT text, but it needs the signer to sign one `payloadDigest` twice. ADR-001 duty 4 (the replay rule, :23) forbids that.
    - DR-29 (e) catches it in the executing spec.
    - Two T9s on one transaction leave the chain identity unbalanced (2R booked against R moved).
    - A withheld T9 is aged by the monitor (DR-29 fix 10; ADR-008).
  - Severity: minor. The control exists in the executor's spec (THREAT_MODEL DR-29), and CF-38(d) is an open, routed item. The THREAT_MODEL edit landed just before this pass.
- **C3 · REAL (minor).**
  - Evidence:
    - §5.6 :447 "ADR-001 duty 6 for moves **below** the threshold". ADR-001 :25: "A move **at or below** the approval threshold needs no checker assertion; a move **strictly above** it needs one".
    - :447 "If the two differ, the signer refuses". That holds only when the policy engine's threshold is higher than the signer's. When it is lower, the policy asks for an approval the signer doesn't need, and the signer signs. That direction is stricter, not a refusal.
  - Criterion: MC-45 (thresholds checked at the boundary). [inspection-only]
  - Severity: minor. ADR-001 decides, from the signer's own copy, and a move at the threshold is valid under both texts. No move escapes a control.
- **C4 · DISMISSED.**
  - Evidence: :205 "the journal's R must equal that disposition's `returnAmount`". The CBS doesn't bound Σ R ≤ m per item. A RETURN recorded without effect in a RET_ state (:169) stays in the CBS record and could be executed later by a compromised adapter.
  - Criteria: MC-17(b), JL-1.
  - Dismissed: every case-return transfer needs its own maker-checker approval over amount and destination (:420, :424) and its own signer replay check (ADR-001 duty 4). The recorded RETURN is a genuine Compliance decision. An honest adapter QUARANTINEs a RETURN above `heldAmount` (:295).
- **C5 · DISMISSED.**
  - Evidence: :173 a case return's destination screen "is never awaited". A REVIEW → source held state (:417). Its later `ScreeningOutcome CLEAR` is stale, so Compliance has to issue a new `RETURN`, which gets a fresh screen.
  - Criteria: MC-11 (an exit that can succeed), JL-3.
  - Dismissed [inspection-only]: the funds stay held in a state with an owner and an open case (§5.8 :513). The new `RETURN` re-screens. Whether a cleared address then screens CLEAR depends on the screening provider (ADR-005). No money moves.
- **C6 · DISMISSED.**
  - Evidence: header :12 says ahead of THREAT_MODEL "fix block 9", while THREAT_MODEL is now at fix block 10.
  - Criterion: MC-40 label clause.
  - Dismissed: under R13's Probe F note, a claim about a named older version stays true. The substantive gap is C2.

DEFECTS:
- **D1** · CONTRACT.md:205 (T9/T10 `refs`) with :56, against THREAT_MODEL :231 DR-29 (b) · R / MC-04, MC-45 · **minor**.
  - T9/T10 `refs.subjectRef` is required but not specified. The §1.2 reading (`["out",instructionId]`) makes DR-29's check that "the case's subject is the item (`refs.subjectRef`)" fail on every case return: a false PAUSE, so it fails closed.
  - Fix direction: state that T9/T10 `refs.subjectRef` is the inbound item's `["in",…]`, or have DR-29 take the item from the CBS case record, as :205 does.
- **D2** · CONTRACT.md:205 (netting) and :12 (header ahead note) · R / MC-45, MC-40 · **minor**.
  - CF-38(d) is not taken or acknowledged:
    - the "one T9/T10 per case-return ID" rule;
    - "every bound T9 or T10" wording;
    - monitor ageing of every final case-return transaction to its T9/T10;
    - the `unid` log-`to` check;
    - `listCaseDispositions` returning each case's subject.
  - The "ahead of both on point 5" note is now matched or exceeded by THREAT_MODEL fix block 10.
  - Not blocking: the signer's replay rule (ADR-001 duty 4) and DR-29 (e) prevent or detect a duplicate, and DR-29 ages withheld returns.
- **D3** · CONTRACT.md:447 vs ADR-001:25 · R / MC-45 boundary · **minor**.
  - "below the threshold" vs "at or below".
  - "If the two differ, the signer refuses" is true in one direction only.

VERDICT: NEGATIVE (3 defects: **0 blocking**, 3 minor).

Fix block J closes all four R13 defects. R13-D1, the blocking one, is closed by reconstruction. A genuine case return can no longer be netted from another item: the CBS ties `instructionId` to its own `RETURN` through the `cr-` derivation and `returnAmount`, and DR-29 ties `(instructionId, txHash)` to the signed transfer. Every wrong-record variant I built PAUSEs. The three remaining defects are minor cross-document and wording differences. Each either fails closed or is covered by a control in a sibling (the signer's replay rule, DR-29 (e)). **Under the operator's exit rule (zero blocking → freeze), P1-contract freezes at this version (sha256 3f1141e8…). D1 to D3 go to the G1 packet.**

Notes for the rubric proposal queue:
- **Probe G:** once a netted journal is bound, also re-trace a **duplicate** of that bound journal: two final transactions under one derived ID, or two journals on one transaction. Binding each journal individually doesn't exclude this. Here it was caught only by the signer's replay rule and a sibling check (C2).
- **Probe F:** a required `refs` field whose value differs by template (`subjectRef` of T9/T10) should be stated per template. Otherwise each sibling picks its own reading (C1).

Cross-unit notes (not counted against this unit):
- THREAT_MODEL DR-29 (b) should not depend on T9/T10 `refs.subjectRef` until CONTRACT states it (D1). Its own (a) and (d) already bind the item through `listCaseDispositions`.
- ADR-008 fix block 7 :45/:75 still nets "every T9 or T10 already posted … (joined through `refs.caseId`)". The open CF-39(f) and CF-38(d) cover this.

Regression (unchanged areas, by reconstruction):
- §6 unit mapping (13/13 rows, boundaries, live receipt): PASS.
- §1.2/§1.3 keys and derived IDs: PASS.
- §5.0 matching: PASS.
- §5.1 templates, the §5.7 effect table and itemisation: PASS.
- §5.8 age set: PASS.
