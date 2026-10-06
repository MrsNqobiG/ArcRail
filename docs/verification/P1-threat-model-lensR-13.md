VERIFICATION · lens: R · target: P1-threat-model (docs/THREAT_MODEL.md, version 2 after fix block 9, the Phase 1 close-out round 1) · commit: none (uncommitted working tree; `git status` → "No commits yet"; sha256(docs/THREAT_MODEL.md) = 4971e7c4f25d13e1b015d16c46487b077d9c59b1e48ec2065ab39bdcc153a735, mtime 2026-10-05 15:09:59 +0200, unchanged from pass start to pass end)

Criteria: CLAUDE.md; .claude/agents/verifier.md; docs/RUBRIC.md (sha256 62698867…, v2 fix block 12, unchanged during the pass). Phase 1 exit rule in force (LEDGER 2026-10-05): the unit freezes when a pass finds zero BLOCKING defects. Blocking = money can be lost, misposted or moved without the required control, or a fail-closed path is missing.
Prior report: P1-threat-model-lensR-12.md (D1–D6).
Session constraints obeyed by hand (the guard hook was not loaded): Arc testnet (5042002) read-only RPC only; no signing or sending method; no mainnet endpoint; no .env or key read; no temp files written. The only file written is this report.

## Sibling pins (start 2026-10-05 15:19:46 +0200; end 15:37:21 +0200)
| Sibling | Pinned sha256 (start) | End of pass |
|---|---|---|
| CONTRACT (v3 fix block I) | d48f622c… | unchanged |
| RISK_REGISTER (v3 fix block 6) | 48930790… | unchanged |
| ADR-001 (fix block 11) | ee09a22e… | unchanged |
| ADR-006 (fix block 11) | 8614d5fe… | unchanged |
| ADR-008 (fix block 7) | 164d5277… | unchanged |
| OPEN_QUESTIONS | 01528f20… | unchanged |
| RUBRIC (v2 fix block 12) | 62698867… | unchanged |
| LEDGER | aaf57367… | **d8fe3330…**: adds the operator row "G1 approved in chat" (:14). Nothing in the change routes or affects any defect below |
| GATES | 8a7cc182… | **6f8be479…**: G1 row annotated; still "NOT SIGNED" |
| STATUS.md | absent | **new** (6aff9f5d…, a collaborator status page) |
| ADR-002…005, ADR-007, SEQUENCES, G1_PACKET, PHASE2_SLICE_PLAN, constants, MISSION | pinned | unchanged |

THREAT_MODEL is newer than every sibling it makes claims about (15:09:59, versus 14:54–14:58 for those siblings), so its sibling claims are judged against the pinned versions.

## Live evidence (2026-10-05, about 15:25–15:30 +0200)
- **Source drift.** This verifier ran `tools/source_drift.py` itself. Its sha256 5504b5e7…80e1 matches the version reviewed in P1-threat-model-lensR-11/-12 and P1-rubric-lensR-13. Its I/O was re-read (lines 14–20 and 40–41): stdlib only, and without `--out` it writes nothing. Result: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33".
- **Chain** (https://rpc.testnet.arc.io, read-only, by curl):
  - `eth_chainId` → 0x4cef52 = 5,042,002.
  - Latest block 65,632,589: baseFeePerGas 20,000,000,000; extraData 0x00000004a817c800 = 20,000,000,000 (C-33, DR-16(2)).
  - DR-11 premise: from the empty address 0x…c0ffee01 (balance 0x0) to 0x…c0ffee04, a zero-value `eth_call` → "0x" and a 1-wei call → {-32003, "revert: OutOfFunds"}. From C-55 0x7099…79C8, a zero-value call → {-32603, "Blocked address"}.
  - DR-14 premise: `eth_getCode`(C-55) → 0xef0100b8b08cdb4e…; `eth_getCode`(empty) → "0x".

## CHECKS
- **K1 Structure recount → PASS.**
  - `^| T-` = 37 rows (S5, T7, R3, I3, D6, E5, N2, B2, SC4). `^| L-` = 8. `^| DR-` = 29, with each of DR-01…DR-29 appearing exactly once.
  - Executor block (:79-86), parsed by script: every DR-01…DR-29 is assigned. Split parts appear once each: DR-16 (1)/(2), DR-19 (1)/(2), DR-26 (1)/(2), RD-01 (gate)/(own check).
  - The monitor line has 24 DR entries plus RD-01 and RD-03, so 26 entries. This matches ADR-008 :48 ("26 entries").
- **K2 Coverage → PASS.** STRIDE 6/6, plus B7, B8 and B5 tables. LINDDUN: 7 categories in 8 rows. Boundaries B1–B9.
- **K3 MC-21 → PASS.** Drift 0, so quotes were checked against the newest archives, as in R12 K3. Fix block 9 adds no new Arc constant.
- **K4 Live chain → PASS** (see live evidence).
- **K5 Numbers → PASS.** Python `divmod`, asserting m·k + r = w and 0 ≤ r < k:
  - At p=6, k=10¹²: 0→(0,0); 1→(0,1); 10¹²−1→(0, 10¹²−1); 10¹²→(1,0); 10¹⁸→(10⁶,0); 7,374,356,000,000,000→(7,374; 356,000,000,000); 2²⁵⁶−1→(…584007; 913,129,639,935).
  - At p=2, k=10¹⁶: 10¹⁶−1→(0, all dust); 10¹⁸→(100,0); 2²⁵⁶−1→(…945758; 4,007,913,129,639,935).
  - Gas: 21,000 × 20 gwei → (420, 0) at p=6.
  - DR-29 re-trace (:222): W=10²⁰ at k=10¹⁶ gives m=10,000. R=2,500 gives 7,500 for T2 and for `unid`. A further R=500 gives T11=7,000. All three as stated.
- **K6 Topic0 → PASS** (unchanged since R12 K6; DR-15's text is unchanged).
- **K7 R12 defect disposition:**
  - **D1 CLOSED.** :20 now reads "**matches** ADR-001 on the signer verifying owner-signed, version-pinned artefacts … CF-23, closed by ADRs fix 9", and names "ADRs fix block 11". ADR-001 :5 and ADR-006 :5 both say "Fix block 11 (LEDGER P1-adrs)". ADR-006 :14 (hardened branch) and ADR-001 :86 (Q-D3 xpub) match the "matches both" claim.
  - **D2 CLOSED.** :81 gives DR-19 part (2) to "CI and deployment pipeline (owner: Engineering), before every deploy … including its deploy block". DR-19 :212 is split into (1) and (2), each with an executor, inputs, action and healthy signal.
  - **D3 CLOSED for the five named flows.** Part (2) drives credit (T2), payout, case return from G5 (T9) and from G4 (T10), and suspense assignment (T11). Address issuance is still not covered (see D3 below).
  - **D4 CLOSED in the false-PAUSE direction.** DR-29 now nets the posted T9/T10, so a legitimate partial return matches (K5). The netting itself opens a new path (see D1 below).
  - **D5 CLOSED.** DR-29's scope now covers every G1-leg journal plus T8 and `unid`. T11 is bound by amount and by `refs.assignRef`.
  - **D6 CLOSED.** T-T6 (:113) and T-I3 (:129) now cover the DB row-level audit log and its configuration: confidentiality, controls, an [X] trail and residual 12.
- **K8 Per-detection re-trace (MC-40):**
  - DR-01, -03, -04, -05, -06, -10, -11, -14, -15, -16, -17 → PASS. Their text is unchanged since R12, which re-traced them, and their premises were re-checked in K4/K5.
  - DR-19 → PASS for parts (1) and (2) on executor, action and healthy signal. Coverage FAILS on one flow (D3).
  - DR-29:
    - settlements, releases, and the paid-without-settlement check → PASS. Each joins `(instructionId, txHash)` from `refs` (CONTRACT :200/:212). The A_post ageing for payouts matches CONTRACT :528.
    - named mutants (1)–(3) → PASS.
    - amount netting → **FAIL (D1, blocking)**.
    - `unid` address binding → FAIL (D4).
  - DR-02, -07, -08, -09, -12, -13, -18, -20 to -28 → PASS (text unchanged since R12).
- **K9 MC-40 label clause, sibling claims at the pinned versions:**
  - "RISK_REGISTER v3 fix block 6 carries every item this document was ahead on at fix block 8" (:6-17) → PASS. Each was checked: RB-1 [A] DR-16 two parts (RR :84); RB-6 (:89); RB-7 with DR-29 (:90); RB-9 with T-T6 and the owner (:98); RB-10/Q-D4 (:92); no RB-11; RB-13 (:94); RB-14 (:95); RB-15 (:96); 2c mutant (2) (:33); 6b/6c with CF-5(h) (:66-67).
  - "ahead … **only** on DR-19's split by executor" (:19) → **FAIL (D2)**.
  - "RISK_REGISTER … ahead of this version on 4b (RB-12) and 2d (RB-16), which it routes itself" → PASS. RR :9 says it is ahead. LEDGER CF-40 (open) routes it.
  - ADR-006 / ADR-001 "matches" (:20) → PASS. "ADR-001 fix block 11 is ahead … CF-36, CF-37" → PASS (ADR-001 :5, LEDGER :67-68).
  - CONTRACT fix block I "matches on four points" (:21-25) → PASS (CONTRACT :200, :212).
  - ADR-008 fix block 7 "matches on settlement/release/refs/net amounts" → PASS (ADR-008 :45, :75). "Ahead of ADR-008 on three points (CF-38(a))" → PASS: ADR-008 :75 has no Treasury list; :94 ages claimed items only; :67 has an unsplit DR-19. "ADR-008 ahead on DR-01 fee conditions (CF-38(c))" → PASS (ADR-008 :40-41, :52).
- **MC-44 → PASS.**
  - Q-ids cited (A2, A5, A12, A15, A16, C10, C19, D1, D3, D4, D9, P1, R12, T3, T4): each is a row in OPEN_QUESTIONS.
  - CF-ids cited (2, 5, 17, 18, 19, 21, 23, 24, 25, 36, 37, 38): each is in LEDGER. CF-5 letters (e)–(i) exist. CF-38 (a)–(c) exist.
  - C-ids resolve in constants.md: C-26, 27, 28, 30, 31, 33, 40, 41, 42, 51, 53, 57, 62–67. (Grep hits for C-1, C-19, C-20/23/24/32/34 are "R5 C-1", "Q-C19" and MC-ids, not constants.)
  - CONTRACT §3, §5.0, §5.3, §5.5, §5.7 and §5.8 resolve.
- **MC-03 → PASS (K5). MC-42 → PASS** (`SIGNED-OFF` count 0). **MC-43 → PASS**: the POPIA statements are flagged to Q-R12 at :175, :182 and :186.
- **MC-40 → FAIL:**
  - (b) and the MC-17(b) binding behind it: D1;
  - the label clause: D2;
  - (c) planted-artefact coverage: D3;
  - (a)/(b) scope: D4.
- **MC-41 → PASS.** Every blind sub-risk maps to an [R]/[X] detection or a residual. Residuals for 4b and 2d are routed (CF-40, open; see X2).
- **MC-45 → PASS with routing.** The per-sub-risk residual match with RISK_REGISTER holds except for RB-12 and RB-16, which are routed as CF-40.
- **MC-17(a) → PASS** (DR-01 content binding, DR-29 settlement join).
- **MC-17(b) → FAIL** for T9/T10 (D1): the cited case and its amount are not bound to the chain fact or to the RETURN disposition. FAIL in part for `unid` (D4).
- **MC-12(d) → FAIL in part** (D1): final case-return transactions are aged by the monitor only when the adapter claims them.
- MC-23, MC-24 text against T-E5 and T-T1 → [inspection-only] PASS.
- MC-01, 02, 04–08, 10, 11, 13–16, 18–20, 22, 25, 30–34 and 46–48 → N/A (code or CONTRACT properties).
- **JL-1 Fail-closed → FAIL in part** (D1: a cross-item misposting raises no PAUSE). **JL-6 → [inspection-only] PASS in part** (D3). JL-2 to JL-5 → [inspection-only] PASS. JL-4 is conditional on Q-C10.
- **Regression of frozen units → N/A by reconstruction** (`grep -c "| frozen"` LEDGER = 0). As a substitute, the sections furthest from fix block 9 were re-checked and both PASS:
  - T-E5, DR-11 and DR-14 against the live chain (K4);
  - T-T5, DR-06 and DR-10 against the conversions (K5).

## CANDIDATES (recorded for traceability)
- **C1** · :222 DR-29 "From `m`, subtract `R` for **every case return already posted for the item**: T9 from G5 and T10 from G4, each joined through `refs.caseId` to a case whose subject is the item … A netted T9 or T10 with no matching chain outflow moves G2 without the chain, so DR-06 catches it." Also :87 "the monitor ages every **claimed** in-flight item", and :222 "every final status-1 **payout** transaction in the signing log must have its settlement joined within `A_post`" (payouts only).
  - The CONTRACT premises:
    - :200 T9/T10 are GL-only (`DR G5 R · CR G2.hot R`, :262-263), so the CBS's account binding ("every leg on a customer account (G1)") does not apply. No CBS check ties a T9's `caseId` to a RETURN disposition or its R to `returnAmount`.
    - The adapter can open a case itself (`createCase`, :206), so it can obtain a `caseId` whose subject is any item.
  - **Re-trace** at p=2, k=10¹⁶. Item X (to customer X's issued address, m_X = 10,000) has no return. Item Y (m_Y = 6,000) has a genuine `RETURN` disposition with R = 2,500. A compromised adapter:
    1. sends Y's approved case return (it passes DR-01's case-return class and DR-13);
    2. withholds Y's T9 and does not claim Y's return in Rout;
    3. posts a T9 of 2,500 citing a case it opened on X;
    4. posts T2_X = 7,500, and later T2_Y = 6,000.
  - Results, computed:
    - DR-06: chain outflow 2.5×10¹⁹ wei and CBS G2 drop 2.5×10¹⁹ wei, so residual 0;
    - DR-07: the keys join, and G5 itemises (X 0, Y held until T2);
    - DR-29: X expected 10,000 − 2,500 = 7,500 = posted; Y expected 6,000 − 0 = 6,000 = posted;
    - no ageing fires: Y's return is final but unclaimed, and the A_post rule covers payouts only.
  - Outcome: customer X is under-credited by 2,500 and customer Y over-credited by 2,500. Total G1 = 13,500 either way, so every identity holds. Only X's complaint ([X], T-E1) remains.
  - Before fix block 9, T2_X = 7,500 would have PAUSEd against m = 10,000. The netting added by fix 9 is therefore what opens this path.
  - Criteria: MC-17(b) ("binds which record it cites (which instruction or case) to the chain fact"; "a lookup key the adapter can choose counts as an adapter-chosen value unless … a named executor outside the adapter joins it to the chain fact"); MC-40(b) (the netting uses adapter-chosen, CBS-unbound T9/T10 content as reference); MC-12(d); JL-1.
  - REAL → **D1 (blocking: customer money misposted with no required control)**.
- **C2** · :19 "This version is **ahead of RISK_REGISTER v3 fix block 6 only on DR-19's split by executor**" versus the pinned RISK_REGISTER:
  - RB-14 (:95) enumerates T-I3 as "the honeytoken and canary lists or the attestation key (T-I3)" and its [X] as "HSM key-use and secret-store audit". THREAT_MODEL fix 9 T-I3 (:129) adds the DB row-level audit log and its configuration, plus the "audit-log store access trails".
  - 3e (:45) lists DR-29's needs as "CF-5(f), (h), (i) and journal legs in `listJournals`". DR-29 (:222) now needs "`listJournals` with `legs` and `refs`" and covers T8/`unid` journals, which have no G1 leg.
  - Both are closing conditions or residual scope, and neither is routed (CF-38(b) covers only DR-19).
  - Criterion: MC-40 label clause ("Every 'ahead', 'only' or 'matches' claim … is re-checked against that version").
  - REAL → D2.
- **C3** · :212 DR-19 part (2) drives canaries "through **every flow in which an address and an `accountRef` meet**" and lists credit, payout, case return from G5 and from G4, and suspense assignment. Address **issuance** is missing. That is the U5 write path where a new collection address is bound to an `accountRef`, and DR-04's own mutant names it (:197 "hands an attacker-controlled address to a merchant at issuance").
  - Part (1) exercises only the "read-only address-lookup path".
  - Re-trace: a logger in the issuance code prints the new address with its `accountRef`. Part (1) is not on that path, part (2) never issues, so the mutant is not caught.
  - CONTRACT defines no issuance operation (grep: only `listIssuedAddresses`).
  - Criterion: MC-40(c) ("re-traced at every code site the sub-risk names (every flow that handles the protected data)").
  - REAL → D3 (minor: a privacy leak to the bank's own log sink, not a money path).
- **C4** · :222 DR-29 "Address and account" binds T2 (`refs.address` = log `to`, account from `listIssuedAddresses`) and T8 (log `to` on Treasury's list), but nothing for `unid`.
  - CONTRACT :306/:311/:317 post `unid` only when "`to` has **no mapping**".
  - Re-trace: a compromised adapter books a deposit to an issued collection address as `unid` (G5→G4) at the correct amount. DR-29's amount check matches, DR-06 and DR-07 hold, DR-28 checks only credited items, and the customer is not credited.
  - Criterion: MC-17(b), MC-40(a)/(b).
  - REAL → D4. Minor: the funds stay in the bank's G4 suspense, and only a human `ASSIGN` or `RETURN` can move them. They are not moved to another party.
- **C5** · T-I2 (:128) "Either links every bank and collection address to the bank (privacy, L-2). It links every collection address to the bank (privacy, L-2)." This is a duplicated sentence left over from an edit. Criterion: MC-44 / clarity. DISMISSED as cosmetic: both sentences are true and nothing resolves wrongly. Note it for the next edit.
- **C6** · Residual 6 (:232) gives DR-29's closing condition as "CF-5(f), CF-5(h) and CF-5(i)" only, whereas DR-29 also needs `listJournals` with `legs` and `refs`, and T-T7 needs Q-C19. Criterion: MC-45. DISMISSED, consistent with R12 C9. Residual 6 names DR-29, the DR-29 row (:222) states its full needs and "until then residual 6", and RISK_REGISTER RB-13 says "until Q-C19 and DR-29's inputs exist". The per-sub-risk match holds.
- **C7** · DR-19 (1) and DR-26 (2): the egress proxy "blocks any request carrying a canary address" or honeytoken address. If the adapter's ingestion ever puts registry addresses (canary or honeytoken rows included) into address-filtered own-node queries that pass through the proxy, a legitimate request would be blocked (MC-40(d)). DISMISSED [inspection-only]: L-3 routes address-specific reads only to own nodes. DR-20 defines the proxy's scope as requests "to a non-own endpoint". No CONTRACT or SEQUENCES flow sends registry-wide address queries. Phase 2 should keep a fixture for it.
- **C8** · :19 "RISK_REGISTER … ahead of this version on residuals for 4b (RB-12) and 2d (RB-16), which it routes itself", with no CF number given. RISK_REGISTER cites "CF-26", which LEDGER renumbers as CF-40. Criterion: MC-44. DISMISSED: the header cites no ID, so nothing fails to resolve, and LEDGER CF-40 routes the fix.

## DEFECTS
- **D1** · docs/THREAT_MODEL.md:222 (DR-29, "Amounts that start on-chain" and "A netted T9 or T10 … DR-06 catches it"), :87 (B9 ageing of claimed items only) · Lens R / MC-17(b), MC-40(b), MC-12(d), JL-1 · **severity blocking**.
  - **Defect.** DR-29 nets posted T9/T10 journals that nothing binds:
    - the CBS doesn't bind them, because they have no G1 leg;
    - the monitor doesn't bind them, because it joins them only to "a case whose subject is the item".
    The monitor also ages only payouts and claimed items, not every final case-return transaction.
  - **Effect.** A compromised adapter can book one item's genuine case-return outflow as a T9/T10 on another item and withhold the first item's own T9. Every identity stays at 0 and DR-29 matches on both items, so R is misposted between customers' accounts (re-trace in C1). Fix block 9's netting introduced this path.
  - **Fix: bind every netted (and every posted) T9/T10 in DR-29** (or in DR-01's case-return class):
    - `refs.instructionId` equals the case-return ID recomputed from `refs.caseId` and a `RETURN` disposition of that case (`listCaseDispositions`, CONTRACT §1.2);
    - R equals that disposition's `returnAmount`, and the case's subject is the item;
    - the signing log has a final status-1 transaction with that `instructionId` whose `to` = `returnDestination` and value = R × k (as DR-01).
  - **Also:** every final status-1 case-return transaction in the signing log must have its T9/T10 joined within `A_post`, aged from the monitor's own finality block, mirroring the payout rule.
  - **Alternative:** net from the chain facts (final case-return transactions for the item's cases), not from posted journals.
  - **Remove** "so DR-06 catches it". DR-06 pins the aggregate only.
  - **Route** the same change to CONTRACT §3 :200 (the netting sentence) and ADR-008 :45/:75, which restate the netting.
- **D2** · docs/THREAT_MODEL.md:19 · Lens R / MC-40 label clause · minor. The "ahead … only on DR-19's split" claim is false at the pinned RISK_REGISTER v3 fix block 6. Fix block 9 is also ahead on:
  - (a) T-I3's DB row-level audit log and configuration, and its audit-log-store [X] trail, which RB-14 (:95) doesn't enumerate;
  - (b) DR-29's inputs (`listJournals` `refs`) and its T8/`unid` scope, against 3e's (:45) "journal legs in `listJournals`".
  Neither is routed. List both points in the header and route them, for example as CF-38(d).
- **D3** · docs/THREAT_MODEL.md:212 (DR-19 part (2)) · Lens R / MC-40(c) · minor. The pre-deploy E2E canary drive omits **address issuance** (U5 binding a new collection address to an `accountRef`; named "at issuance" in DR-04 :197). A logger on that path is caught by neither part. Add issuance to part (2)'s flow list. Because CONTRACT defines no issuance operation, route the definition as a CF item (or state the U5 interface the harness drives).
- **D4** · docs/THREAT_MODEL.md:222 (DR-29, "Address and account") · Lens R / MC-17(b), MC-40(a)/(b) · minor. DR-29 binds T2's and T8's addresses but not `unid`'s. CONTRACT posts `unid` only for a `to` with no mapping (:306/:311/:317), so a `unid` whose log `to` is in `listIssuedAddresses` or on Treasury's list is never legitimate. Add: "`unid`'s log `to` is in neither `listIssuedAddresses` nor Treasury's list; otherwise PAUSE". Name a mutant for it (a customer deposit booked to suspense).

## PROBES (for the LEDGER rubric proposal queue; not counted here)
- **Probe G (would a bad version pass?) → YES.** MC-17(b)'s Phase 1 method re-traces a wrong-account mutant and a wrong-record mutant posting by posting. D1 needs a **cross-item compensation**: one item's genuine chain effect is booked to another item, and the first item's own posting is withheld. That passes every per-posting check and both identities, and was found only by tracing two items together.
  - Proposed: "For every detection that adjusts its expected value by other journals (returns, fees, re-entries), each adjusting journal must itself be bound to a reference fact by an executor outside the adapter. The verifier re-traces a two-item compensation mutant (a genuine chain effect of item Y booked to item X while Y's own posting is withheld). Every final chain outflow class in the signing log, not only payouts, is aged by the monitor whether or not the adapter claims it."
- **Probe F (would a good version fail?) → YES.** MC-40(c)'s "every code site the sub-risk names" can require a planted-artefact detection to drive a flow that no CONTRACT operation defines yet (D3, address issuance). A good THREAT_MODEL can't make a CONTRACT-based E2E suite drive an undefined operation.
  - Proposed: "A flow that no CONTRACT operation defines yet is covered if the detection row names it and routes its definition as an open CF item; the sub-risk is a G1 residual until the flow is driven."

## Cross-unit notes (not counted here)
- **X1** · CONTRACT §3 :200 ("less `R` for every T9 or T10 already posted for that item … joined … through `refs.caseId` and that case's subject") and ADR-008 :45/:75 carry the same unbound netting as D1. CONTRACT §3 also states no CBS binding for T9/T10's `caseId` against a `RETURN` disposition and its `returnAmount`, though the CBS holds both records. It could reject a T9/T10 whose cited case has no matching `RETURN` (MC-17(b) prefers the CBS's own record).
- **X2** · LEDGER CF-40 (THREAT_MODEL: residuals for 4b/RB-12, and a 2d mutant for DR-10 or a T-N1 residual) is still open. Under the zero-blocking exit rule it is carried to the G1 packet unless it lands.
- **X3** · LEDGER :14 records "G1 approved in chat". GATES :11 correctly keeps "NOT SIGNED" pending the operator's signed commit (MC-42). Phase 2 should not treat the chat message as the signature.
- **X4** · The LEDGER P1-threat-model row still reads "R13 pending". This report is R13.

## VERDICT: NEGATIVE (4 defects: 1 blocking, 3 minor)
