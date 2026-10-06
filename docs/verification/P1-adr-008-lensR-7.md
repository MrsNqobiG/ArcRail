VERIFICATION · lens: R · target: P1-adr-008 (docs/adr/ADR-008-independent-monitor.md, after fix block 6; round 7) · commit: none (uncommitted working tree; repo has no commits)

**Version verified: sha256 f81850e237aa7df6…, mtime 2026-10-05 12:21:20 +0200.** The target changed during the pass. At pass start (12:21:09) the hash was 44de1dd7…; the file was written again at 12:21:11 and 12:21:20. I re-read the final version in full. The only difference from the text I first analysed is :48: "plus DR-29" is gone, and the CF-25 "ahead" sentence moved to the end of that paragraph. Every check below is against f81850e2.

**Sibling pins (sha256 at start → at end):**
- THREAT_MODEL 6799bd75… → same (header "v2 fix block 8", mtime 12:17:02);
- RISK_REGISTER b2eff124… → same (header "Fix blocks 1 to 5 applied", 12:18:38);
- CONTRACT d2f72422… → same (header has no fix-block label; LEDGER:33 says Fix H used, 12:20:08);
- ADR-001 ce0106ea… → same (no header label; LEDGER:34 says Fix 10, 12:20:33);
- OPEN_QUESTIONS 73ad9d4c…, RUBRIC 4d86338d…, G1_PACKET b7f8f4f2… → same;
- LEDGER aa57dfc6… → d7772cef… (12:23:21). The only addition is an operator-decision row (tech and infrastructure scope, English only). No CF row changed. The CF lines cited below (CF-15, CF-18, CF-25) are unchanged.

Every sibling except LEDGER predates the target, so a disagreement counts against the target unless the target says it is ahead or an open CF item routes it (MC-40 label clause).

**Guard hook not loaded; rules self-applied.** I made no RPC calls and no network fetches (MC-21 N/A, see below), and read no .env files or keys. **Stray-file disclosure:** one helper command wrote a scratch listing to /dev/shm/adr_map.txt. I deleted it straight away (confirmed absent), and no result depends on it. This report is the only file I left behind.

CHECKS:
- R6 D1 (RB-13 didn't exist) → FIXED. RISK_REGISTER:94 RB-13, "Wrong-account binding (3e) … G1 residual until Q-C19 and DR-29's inputs exist". This matches ADR-008:45 ("Until the CBS confirms it can bind (Q-C19) and DR-29's inputs exist, this path is G1 residual RB-13") and :87. Cross-checked against THREAT_MODEL:117 T-T7 ("G1 residual 6 (RISK_REGISTER RB-13)") and RISK_REGISTER:45 3e → PASS.
- R6 D2 (incomplete "ahead" note) → FIXED for ageing and RESUME: THREAT_MODEL:59 (ageing outside the adapter) and :60 (monitor→adapter `RESUME` channel). **The "only" claim is broken again by fix 6's own D4 change** (new D1 below).
- R6 D3 (binding scope overstated) → FIXED. I compared :45 clause by clause with CONTRACT:186/:188/:190:
  · holds, settlements, releases and fallbacks are bound to the instruction or hold;
  · T2 and T11 accounts are bound to issuance or the latest ASSIGN;
  · on-chain amounts (T2, T8, T11, unid) and T2's address are bound by DR-29 only;
  · the settlement and release checks are DR-29's (fix H).
  → PASS.
- R6 D4 (caps value-only; cancels "no cap") → FIXED vs ADR-001. Boundary re-trace, integers in wei:
  · Inputs: per-move cap C = 10^21; worst-case fee G·M = 21000 × 40 gwei = 8.4×10^14; actual fee g·e = 21000 × 21 gwei = 4.41×10^14.
  · v = C − 8.4×10^14: the signer accepts (= C). The monitor sees C − 3.99×10^14 ≤ C and passes, so there is no false PAUSE. In general, gasUsed ≤ gasLimit and effectiveGasPrice ≤ maxFeePerGas, so the monitor's realised debit is ≤ the signer's bound for every legitimate transaction.
  · v = C − 8.4×10^14 + k (k = 10^12): the signer refuses (C + 10^12 > C).
  · v = C with fee > 0: the monitor PAUSEs (C + f > C).
  · Cancels: :41 "its fee counts against the daily cap and must be within the fee limits" = ADR-001:23.
  · The fix introduced new D1 and D2.
- R6 D5 (undeclared subject inputs) → FIXED. :31 now has "its configured fee floor (DR-16 part (2)), its outbox and audit hash chain (DR-05)". I checked every subject cell in the map (:52-77) against :30-31 and all are covered: registry rows, outbox and audit chain, fee floor, Rin/Rout/D/F, journal list and G5/G4 items, index, local nonce, move records, logs and telemetry, screening and monitoring requests, bank-owned flags, `p`, per-role items → PASS.
- R6 D6 (DR-03 relied on the signer's log) → FIXED. :53 adds "the transaction itself, fetched from own nodes by the log's `txHash`". Re-trace of a buggy signer:
  · It signs X′ and logs X′'s hash → the digest is recomputed from X′ ≠ the approval → PAUSE.
  · It logs a hash that isn't on chain → the claimed item has no reference support → PAUSE (:33).
  · It doesn't log X′ → DR-13 → PAUSE.
  → PASS.
- R6 D7 (artefact checks incomplete) → FIXED. :103 adds the IdP trust configuration and the WORM anchor's verification key. Backward trace from THREAT_MODEL:85 T-T6: the artefacts the monitor itself loads (Treasury list and caps, honeytoken/canary lists, xpub, credential registry, IdP trust, WORM anchor) are all there. The digest list, proxy address set and attestation private key belong to other executors or are held in the HSM → PASS.
- ADR rules (options, trade-offs in the table, per-phase recommendation, prose = table) → PASS:
  · options at :81-87;
  · phases at :114-116, with pilot blockers named;
  · consequences at :119-121 assume B or D.
- KICKOFF "Do not decide" → PASS (:3 PROPOSED). KICKOFF U12 quote at :13 = KICKOFF_PROMPT.md:144 (faithful, with an ellipsis) → PASS. The CLAUDE.md quote at :14 = CLAUDE.md:18 → PASS.
- MC-17(b), wrong-account mutant re-traced against CONTRACT fixes F–H and the monitor's joins → PASS (contingent on Q-C19; RB-13). Values: p = 2, k = 10^16, I1 = (C, 1000 minor, X), I2 = V's genuine instruction.
  · `placeHold{K.reserve(I1,0), instructionId I2}` puts the hold on V.
  · `settleHold{K.settle(I1,0), H_V, I2, tx1}`: the CBS accepts, because the binding is to I2. DR-29 recomputes K.settle(I1,0) → I1 → account C ≠ leg V → PAUSE.
  · Keyed instead as K.settle(I2,0): there is no final status-1 transaction carrying I2 → PAUSE. I1 also has no T4, so :94 PAUSEs at t_f + 900 + 60 = 960 s.
  · Inbound twin: K.avail is recomputed from the monitor's own log, and the issuance record of the log's `to` ≠ the leg's account → PAUSE.
- Option windows recomputed → PASS:
  · fabricated payout: ALL_CLEAR issued before 0 + 30, honoured to < 90 s, which is ≤ 60 + 60 = 120 s;
  · unposted payout: A_post = 900 s (CONTRACT:514, OPEN_QUESTIONS:56) + 60 = 960 s ≈ 16 min (:84, :87).
- MC-12(b)/(d) → PASS. :94 ages claimed items from the monitor's own finality block → PAUSE. MC-12(c) → PASS: A_post keeps its meaning, and A_attest/A_cycle/A_fresh are new and listed in Q-C17 (OPEN_QUESTIONS:56, values 60/60/30 s match).
- MC-40(e) map coverage, by script → PASS. The THREAT_MODEL:53 monitor executor list has 26 IDs. The map at :50-77 has 26 rows, and the two sets are identical. The table is contiguous (no blank line between :50 and :77). The exclusions in :48 (DR-20 and DR-26(2) in the proxy, DR-16(1) in the adapter) match THREAT_MODEL:55-56.
- MC-40(e), every reference input in the declared set → **FAIL** on two rows:
  · DR-01's fee limits and the general daily cap (D2);
  · DR-29's `txHash` from `listJournals` and its "holds" (D3).
  The other rows trace to :21-28 (as in R6).
- MC-40(c), the inputs exist as CONTRACT operations or are tracked → **FAIL** for DR-29. CONTRACT:198 `listJournals` returns `{journalId, key, legs, postedAt}`, with no `txHash` and no `refs`. CONTRACT §3 (:185-200) has no hold read operation. Neither gap is tracked: :121, CF-25 (LEDGER:71) and Q-C18 (OPEN_QUESTIONS:57) don't name them (D3).
- MC-40(b) scope → PASS (S comes from reference inputs only, :42; registry checked both ways, :43). MC-40(b) artefacts are THREAT_MODEL assets → PASS (T-T6, T-I2, T-I3).
- MC-40(d) → PASS:
  · DR-01's new fee check can't fire on legitimate flows (realised debit ≤ the signer's bound, shown above);
  · the :45 wording "no released instruction was **paid** on-chain" doesn't PAUSE on a same-nonce cancel followed by T5 (see the routed note on CONTRACT:186).
- MC-40(f) and fail-closed when the executor goes silent → PASS:
  · :99 stale or missing attestation → refuse;
  · :100 input loss → no ALL_CLEAR;
  · :103 unsigned artefact → no ALL_CLEAR;
  · :104 "flag unreadable" → PAUSE.
- MC-40 label clause, the "ahead … only on DR-29's settlement and release checks" claim (:3, :48), re-checked against THREAT_MODEL v2 fix 8 → **FAIL** (D1).
- MC-17(a), content binding of outflow joins → PASS:
  · payout digest from the final transaction's `to` and value plus `instructionId` (CONTRACT §1.3);
  · case return `returnDestination` and `returnAmount × k`;
  · moves: Treasury list and caps;
  · cancel class = THREAT_MODEL:166.
- MC-19 design → PASS (:104, two humans).
- MC-21 → N/A. A grep of the target for `5042`, `gwei`, hex literals of 4+ digits and `-320` returned nothing (exit 1). `gasUsed` and `effectiveGasPrice` are standard EIP-1559 receipt fields (MC-41: no citation needed), so `tools/source_drift.py` wasn't needed.
- MC-43 → N/A. The POPIA reference (:108) is routed to Q-R12.
- MC-44, reference by reference → PASS:
  · :3 report list and pins (each sibling's header, or its LEDGER row where the header has no label);
  · :12 T-S1/T-T2/T-E1/T-E2, RR-3, RR-2 2e;
  · :22 CF-5(f)/(h)/(i) and Q-C18;
  · :29 CF-19(c) (closed, and the clause exists);
  · :36 "verifier R3 D1";
  · :37 CONTRACT §1.3;
  · :40-41 ADR-001 duties 2, 3 and 6 (ADR-001:9-23);
  · :41 CF-18;
  · :45 CONTRACT §3 fixes F–H, Q-C19, RB-13 and "ADR-008 R5 C-1";
  · :48 CF-25 (LEDGER:71, open);
  · :94 §5.8 and "verifier R4 D1";
  · :97 Q-C17;
  · :102 T-T6, T-B1, T-SC2, T-I3, DR-26(2) and residual 13;
  · :103 CF-23;
  · :104 CONTRACT §1.6, SEQUENCES F7 and CF-9;
  · :120 CF-9(b) (CONTRACT:236 still has the 3-tuple; tracked);
  · :124-126 Q-D8, Q-D1 and Q-C17.
  [inspection-only] advisory: ":3 … the `RESUME` channel (B9)". The B9 row (THREAT_MODEL:33) itself lists only monitor→signer. The channel is described in the monitor section that expands B9 (:60) (C-5).
- MC-45 ADR ↔ ADR-001 → PASS:
  · duty 5 = :99;
  · signing-log tuple;
  · cancel `to` = sender, with the sender on Treasury's list or in S;
  · caps and fees per the D4 re-trace;
  · the Q-D1 (c)/(d) restatement at :125 = OPEN_QUESTIONS:85.
- MC-45 ADR ↔ THREAT_MODEL → **FAIL**: the DR-01 move and cancel checks (D1). Everything else → PASS: input model = THREAT_MODEL:37-49; operator channel = :44; ageing = :59; RESUME = :60; T-T6 artefacts.
- MC-45 ADR ↔ CONTRACT → PASS for the binding scope (R6 D3 line). The DR-29 inputs vs CONTRACT:198 are D3.
- MC-45, every external dependency fails closed → PASS: CBS, nodes and screening (:100); the signer (:99); paging (:101).
- JL-1 Fail-closed → [inspection-only] PASS. Every gap ends in no ALL_CLEAR or PAUSE. D1–D3 are about declaration and agreement; none opens a fail-open path.
- JL-2 Human-owned → [inspection-only] PASS. Ages are "proposed" (Q-C17); unpause takes two humans; a PAUSE request needs one owner.
- JL-3 03:00 operability → [inspection-only] PASS (:105, one on-call view). The `RESUME` name advisory is still open (rubric queue, LEDGER:52).
- JL-4 Auditability → [inspection-only] PASS.
- JL-5 Fewest new parts → [inspection-only] PASS (Q-D8).
- JL-6 Privacy → [inspection-only] PASS (:108).
- MC-01–08, 10, 11, 13–16, 18, 20, 22–24, 30–34, 42, 46–48 → N/A. There are no templates, keys, state tables, events, statuses or code in this ADR.
- Regression check of frozen units → N/A by recount. LEDGER:25-38 has 12 units, and 0 are frozen.

CANDIDATES:
- C-1 · ADR-008:3 "This ADR is **ahead of THREAT_MODEL** only on DR-29's settlement and release checks"; :48 the same. ADR-008:40 "a **value plus fee** (`gasUsed × effectiveGasPrice` …) within the move caps, and its fee within the signer's fee limits"; :41 "**its fee counts against the daily cap** and must be within the fee limits". THREAT_MODEL:166 DR-01 (an owner cell naming ADR-008): "**Move:** `to` is on Treasury's list, and the amount is within the move caps"; its cancel bullet has no fee condition. · MC-40 label clause ("only"/"ahead" claims re-checked; the newer document must say it is ahead, or LEDGER must route it), MC-45 (backward trace from owner cells; caps at the boundary) · **REAL** (minor). Boundary: a move with v = C (per-move cap) and fee f > 0. THREAT_MODEL's DR-01 passes (C ≤ C). ADR-008's DR-01 PAUSEs (C + f > C). The same split applies to a cancel whose fee breaches the fee limits. The target is newer (12:21:20 vs 12:17:02), doesn't declare this divergence, and no open CF routes it (CF-15 is CONTRACT §5.6 only; CF-18 is closed and covers classification, not fees). Fix 6's D4 change caused it.
- C-2 · ADR-008:40 "its fee within the signer's fee limits (ADR-001 duties 3 and 6)"; :41 "its fee counts against the daily cap and must be within the fee limits (ADR-001 duty 3)". The declared input :23 is only "Treasury's list of bank-owned wallets **and its move caps** (per-move, daily)", and the DR-01 map row :52 is "Treasury's list and move caps". ADR-001:15-20: the fee limits (`maxPriorityFeePerGas` ceiling, `gasLimit × maxFeePerGas` ceiling) and the per-tx/daily caps are the signer's own copy, owned by Treasury with Risk. THREAT_MODEL:45 gives the monitor only "Treasury's move caps (per-move and daily)". · MC-40(e) (every reference input enumerated in the executor's declared set) · **REAL** (minor). The monitor now checks fees against limits it has no declared source for, and "the daily cap" for a payout's or case return's cancel is ADR-001 duty 3's general daily cap, which also isn't a monitor input. Fix 6 introduced it. Advisory for the fix: once the fee limits are declared, compare the transaction's own `maxPriorityFeePerGas` and `gasLimit × maxFeePerGas` (readable from the own-node transaction) with them, rather than the receipt fee. A receipt fee can't show a priority-fee-ceiling breach directly.
- C-3 · ADR-008:75 DR-29 reference inputs: "CBS journals **with their legs and `txHash`** (`listJournals`); CBS payout instructions **and holds**". CONTRACT:198 `listJournals` → `{journalId, key, legs, postedAt}` (no `txHash`, no `refs`); CONTRACT:190 says `txHash` is "recorded on the journal" but no read returns it. CONTRACT §3 (:185-200) has no hold read. ADR-008:22 declares no hold read. ADR-008:121 asks only for "journal legs in `listJournals`", which CONTRACT:198 already has. CF-25 (LEDGER:71) adds only "chain receipts and signing log" as DR-29 inputs. · MC-40(c) (every input exists as a CONTRACT operation, or is tracked as a CF item or question), MC-40(e), MC-44 · **REAL** (minor). The residual half of MC-40(c) is met (RB-13 "until … DR-29's inputs exist"), but the tracking half isn't: nothing routes `txHash` (or `refs`) into `listJournals` or a hold read. It's minor because the settlement check still runs by key: K.settle(I, attempt) is recomputable for each instruction, and the check is whether a final status-1 transaction carries I (re-trace in CHECKS). Only the exact `txHash` comparison has no source.
- C-4 · ADR-008:40 compares the realised fee (`gasUsed × effectiveGasPrice`) with caps that ADR-001:20 defines over the worst case (`value + gasLimit × maxFeePerGas`). · MC-45 (caps agree at the boundary) · DISMISSED. The monitor is an after-the-fact check of the realised debit. For every transaction the signer accepts, value + g·e ≤ value + G·M ≤ C, so legitimate flows never PAUSE (MC-40(d)). A signer cap bug that produces an actual overrun is caught (v = C, f > 0 → PAUSE). The only miss is a worst-case-only breach whose realised debit stays ≤ C, which moves no money beyond the cap. The fee-limit input is C-2.
- C-5 · ADR-008:3 "the `RESUME` channel (B9)" vs THREAT_MODEL:33 B9 "It sends signed attestations **to the signer**". · MC-44 · DISMISSED. The channel is in THREAT_MODEL:60, inside the "Independent monitor" section that expands B9 (THREAT_MODEL uses "(B9)" for the monitor design, for example :71 "Enforced through the monitor attestation (B9)"). Routed advisory for THREAT_MODEL: add monitor→adapter `RESUME` to B9's "Across it" cell.
- C-6 · CONTRACT:186 "every release (T5) of an instruction that has a signing-log entry must have **no final status-1 transaction** for that instruction" vs ADR-008:45 "no released instruction was **paid** on-chain". A winning same-nonce cancel is a final status-1 transaction carrying the payout's `instructionId` (ADR-008:41; THREAT_MODEL:166), and it's followed by a legitimate T5. · MC-40(d), MC-45 · DISMISSED for this unit. ADR-008's wording ("paid") is the correct one and doesn't false-PAUSE. CONTRACT's literal wording would. Routed to P1-contract.
- C-7 · ADR-008:3 pins "ADR-001 **fix block 10**" and "CONTRACT **v3 fix block H**", but neither sibling's header carries a fix-block label. · MC-40 label clause (versions named down to the fix block) · DISMISSED. LEDGER:33 and :34 record those fix blocks, and the cited content (ADR-001:15-24 fees and signed configuration; CONTRACT:190 `settleHold` with `txHash`) is present. Proposal below (Probe F).
- C-8 · THREAT_MODEL:5 "ahead of ADR-008 fix block 4 on the monitor's input list, DR-16 and DR-28 (routed as CF-19)" is stale (CF-19 closed by ADR-008 fix 5). LEDGER:38 still shows P1-risk-register at "fix block 3 used", while RISK_REGISTER:3 says fixes 1 to 5. LEDGER:65 CF-16(c) still says "drafted". · MC-40 label clause · DISMISSED for this unit. These are sibling and LEDGER staleness. ADR-008's pins follow the siblings' own headers, which are authoritative. Routed.

PROBE G (would the rubric wave through a bad version?): YES. When a monitor detection re-checks a preventive limit, MC-45 compares caps at the boundary but doesn't ask *which quantity* is compared. A monitor that checks only realised receipt fees against a ceiling defined on transaction parameters (`maxPriorityFeePerGas`) passes every rubric item, yet it can't see a priority-fee-ceiling breach as such (C-2 advisory). Proposal (for the LEDGER rubric queue): "MC-40/MC-45: a detection that re-checks a preventive limit names the quantity it compares (transaction parameters or realised receipt values); a limit defined on transaction parameters is re-checked on those parameters."

PROBE F (would it fail a good version?): YES, partly. The MC-40 label clause requires sibling versions "named down to the fix block", but CONTRACT and ADR-001 carry no fix-block label in their own headers, so a good ADR can pin them only through LEDGER (C-7). Proposal: "a sibling without a fix-block label in its header may be pinned by its LEDGER row, plus the hash read at the start of the pass."

DEFECTS:
- D1 · ADR-008:3, :48 ("ahead … only on DR-29's …") vs :40-41 (DR-01: move value plus fee within the caps; cancel fee against the daily cap and fee limits) and THREAT_MODEL:166 DR-01 ("the amount is within the move caps"; no cancel fee condition). Unrouted; the two disagree at v = C, f > 0 · R, MC-40 label clause + MC-45 (backward trace, boundary) · minor
- D2 · ADR-008:40-41, :23, :52 (fee limits and the duty-3 daily cap used by DR-01 aren't declared monitor reference inputs; only "move caps (per-move, daily)" are) · R, MC-40(e) · minor
- D3 · ADR-008:75 (DR-29 inputs "`txHash` (`listJournals`)" and "holds" aren't returned by any CONTRACT read (CONTRACT:198; no hold read), aren't in the declared CBS reads (:22), and aren't routed by :121, CF-25 or Q-C18) · R, MC-40(c)/(e) + MC-44 · minor

Routed (not counted against this unit):
- P1-threat-model: DR-01's move and cancel fee conditions (mirror ADR-001 duties 3 and 6, or the ADR-008 wording) once D1 is routed; B9's "Across it" cell should list monitor→adapter `RESUME` (C-5); the stale header note on ADR-008 fix block 4 / CF-19 (C-8).
- P1-contract: CONTRACT:186's release check should say "paid" (a value transfer), not "any final status-1 transaction", so that a winning cancel followed by T5 doesn't PAUSE (C-6). `refs.txHash` is cited at :186, but the `postJournal` `refs` schema has no `txHash`, and `listJournals` (:198) returns neither `txHash` nor `refs` (C-3).
- LEDGER: the P1-risk-register row and CF-16(c)/CF-17 status lag RISK_REGISTER fix 5 (C-8).
- LEDGER rubric queue: the Probe G and Probe F proposals above.

VERDICT: NEGATIVE (3 defects: 0 blocking, 3 minor)

Phase 1 · units frozen 0/12 · streak 0/3 · rounds used 7/10 (P1-adr-008) · regen budget left 1
