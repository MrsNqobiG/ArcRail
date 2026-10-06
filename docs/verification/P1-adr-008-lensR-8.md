VERIFICATION · lens: R · target: P1-adr-008 (docs/adr/ADR-008-independent-monitor.md, after fix block 7; round 8) · commit: none (uncommitted working tree; repo has no commits)

**Version verified: sha256 164d52772d7cae7c…, mtime 2026-10-05 14:58:44 SAST.** The hash was the same at the start of the pass (15:19 SAST) and at the end (15:36 SAST).

**Sibling pins (sha256 at start → at end; every one unchanged):**
- THREAT_MODEL 4971e7c4… (header "v2 fix block 9", mtime 15:09:59). **This is newer than the target.** ADR-008 pins THREAT_MODEL **fix block 8**, which is no longer on disk.
- CONTRACT d48f622c… (header "Version 3, fix block I", 14:57:19).
- ADR-001 ee09a22e… (header "Fix block 11", 14:57:18).
- RISK_REGISTER 48930790… (header "Fix blocks 1 to 6", 14:55:28).
- OPEN_QUESTIONS 01528f20… (15:16:20, newer than the target).
- LEDGER aaf57367… (15:18:49, newer than the target). CF-25 is now **CLOSED**, and CF-38 is new.
- RUBRIC 62698867…, SEQUENCES d3f68f8b…, G1_PACKET ebfaa55f….

THREAT_MODEL, OPEN_QUESTIONS and LEDGER changed after the target. Under the MC-40 label clause, where one of them now disagrees with ADR-008, the sibling is the defective one if it says it is ahead or if LEDGER routes the fix as an open CF item. I checked that claim for each case below.

**Guard hook not loaded; I applied its rules myself.** I made no RPC calls and no network fetches (MC-21 is N/A, see below). I read no .env files or keys and wrote no temp files. **Disclosure:** the Claude Code harness saved one oversized command output (the RUBRIC listing) under ~/.claude/projects/…/tool-results/. The harness wrote that file, not me, and nothing depends on it. This report is the only file I wrote.

**Phase 1 exit rule in force** (operator, LEDGER 2026-10-05): a unit freezes when a pass finds zero BLOCKING defects. Blocking means money can be lost, misposted or moved without the required control, or a fail-closed path is missing. Everything else is minor.

CHECKS:
- **R7 D1** (the "ahead only on DR-29" claim was broken by DR-01) → **FIXED.** :3 now names two detections, DR-29 (CF-25(a)–(c)) and DR-01 (CF-25(d)). I re-checked this against the sibling's own record. THREAT_MODEL fix 9, at :32, says: "ADR-008 fix block 7 is **ahead of this version** on DR-01's fee conditions … routed as **CF-38(c)**". The DR-29 half no longer holds on disk, because THREAT_MODEL fix 9, at :27, now **matches** it. That is the sibling changing afterwards, and the sibling says so, so it doesn't count against this unit (routed R-1). → PASS
- **R7 D2** (fee limits and the duty-3 daily cap were undeclared inputs) → **FIXED.**
  - :23 declares "ADR-001 duty 3's **daily cap** and its two **fee limits**", owner-signed (Treasury with Risk).
  - :52, the DR-01 row, lists them along with "own-node transactions (fee fields)".
  - :103 includes "caps and fee limits" among the artefacts checked on load.
  - → PASS
- **R7 D3** (DR-29's `txHash` and hold inputs were untracked) → **FIXED.**
  - :75 now reads `listJournals` `(journalId, key, legs, refs, postedAt)`, using `refs.instructionId`/`txHash`/`address`/`assignRef`/`caseId`, with "No hold read".
  - CONTRACT:212 returns exactly `{journalId, key, legs, refs, postedAt}`.
  - CONTRACT:200's `refs` schema has `txHash`, `assignRef` and `caseId`. It says T9/T10 carry `caseId`, and the T4 fallback carries `txHash`.
  - CONTRACT:204: `settleHold` records `instructionId` and `txHash`, and `listJournals` returns them as `refs`.
  - :121 and Q-C18 (OPEN_QUESTIONS:57) now ask for `listJournals` with `refs`.
  - → PASS
- Header claim "**matches CONTRACT fix block I** on DR-29", re-traced clause by clause against CONTRACT:200–212:
  - `refs` joins: :75 = CONTRACT:212.
  - T11 is bound to the cited `refs.assignRef`: :45 "the unsuperseded `ASSIGN` disposition the journal cites" = CONTRACT:200 (cited, own record, same subject; superseded → `NOT_PERMITTED`).
  - The release check ignores the item's own cancel: :45 "the item's own zero-value cancel isn't a payment" = CONTRACT:202.
  - Amounts are net of posted T9/T10: :45 "less `R` for every T9 or T10 already posted for that item (joined through the journal's `refs.caseId`)" = CONTRACT:202.
  - → PASS
- Header claim "**matches ADR-001 fix block 11** duties 3 and 6 on the caps and fee limits DR-01 re-checks" → **FAIL** (D1):
  - The fee-limit half matches: :40 `maxPriorityFeePerGas` ceiling and `gasLimit × maxFeePerGas` ceiling = ADR-001:18-19.
  - The daily-cap assignment doesn't match. :40-41 count a **move cancel's** fee toward the **daily move cap**. ADR-001:25 (duty 6) says cancels "count against no **value** cap, but **their fees count against the daily cap and the fee limits of item 3**".
  - :41 sums "every signing-log entry's final transaction" (internal moves included) against duty 3's daily cap. ADR-001:17 and :25 don't say whether move values count against duty 3's daily value cap at all.
- **Cap boundary re-trace** (MC-45, integers in wei; p = 2, k = 10^16; per-move cap C = 10^21; G = 21000; M = 40 gwei; worst-case fee G·M = 8.4×10^14; realised fee g·e = 21000 × 21 gwei = 4.41×10^14):
  - Move v = C − 8.4×10^14: the signer accepts (total = C). The monitor's realised debit is C − 3.99×10^14 ≤ C, so it passes and there's no false PAUSE.
  - Fee-field check: `gasLimit × maxFeePerGas` = 8.4×10^14 at a ceiling W = 8.4×10^14 passes; at W + 1 wei it PAUSEs. A `maxPriorityFeePerGas` at its ceiling P passes; at P + 1 it PAUSEs. These are transaction parameters read from own nodes, the same quantities the signer bounds (this takes the R7 Probe G advisory). → PASS
  - Move-cancel mismatch (D1): a move M1 of value k = 10^16 has worst-case total 1.0084×10^16, counted by the signer against the daily move cap DM. Its same-nonce cancel lands with realised fee 21000 × 600 gwei = 1.26×10^16, counted by the signer against D3, not DM. The monitor drops M1, which isn't final, and adds 1.26×10^16 to its DM sum, a net +2.5×10^15 over the signer's DM ledger. A day the signer filled to within 2.5×10^15 of DM therefore PAUSEs at the monitor. That is a false PAUSE: fail-closed, so minor.
- MC-40(e), map coverage, by script: rows :52-77 give 26 IDs; THREAT_MODEL:80's monitor executor list gives 26 IDs. The sets are identical except "DR-19" vs "DR-19 part (1)". THREAT_MODEL fix 9 split DR-19 after this ADR was written and routes the change to ADR-008 as **CF-38(a)** (open). The table is contiguous. The :48 exclusions (DR-20, DR-26(2), DR-16(1)) match THREAT_MODEL:83-84. DR-19 part (2) (CI) is missing from :48's exclusion list: CF-38(a). → PASS (with routed R-1)
- MC-40(e), every reference input in the declared set → PASS: each map row's reference cell traces to :21-28. DR-29 lacks "Treasury's list" (T8's `to`, THREAT_MODEL:222), which THREAT_MODEL fix 9 added after this ADR and routes as CF-38(a).
- MC-40(e), every channel that triggers or suppresses the fail-closed action is declared with its authentication → **FAIL** (D2): CONTRACT §1.6 (:149) makes the exit from every item QUARANTINE "a two-person resolution **recorded by the monitor**" (`RESUME`, `CONFIRM_APPLIED`/`CONFIRM_ABSENT`, `RELEASE`, `ESCALATE`). CONTRACT:146 does the same for the RPC-disagreement cursor freeze. ADR-008 declares only the rail-level `RESUME` (:105). The monitor→adapter channel that carries item resolutions, `RELEASE` (T5) among them, has no declaration or authentication here. LEDGER **CF-26** (open) tracks it.
- MC-40(b), the checked component can't write the reference inputs → **FAIL** (D3), as a declaration gap. :24 says the signing log is "**Pushed by the signer** directly to the monitor", but neither :24 nor :98-105 states that channel's authentication, while the other three channels are declared "mutually authenticated" (:98, :102, :105). Re-trace with forged entries on an unauthenticated push:
  - A key-theft drain (T-E3) plus a forged entry defeats DR-13 (:63) for that transaction.
  - DR-01 still classifies the forged entry against the CBS: no instruction or approval means PAUSE. The only drain shapes that pass DR-01 are a move to Treasury's list or a zero-value self-cancel, and neither takes value out of the bank.
  - So this doesn't lose money, and it is minor.
- MC-45, the protocol re-traced case by case against ADR-001 duty 5, THREAT_MODEL B9 and RUBRIC MC-25(a) → **FAIL** (D4):
  - ADR-001:24 has the signer verify each attestation "against the monitor's key in the signer's own trust store".
  - THREAT_MODEL:78 says it is "signed with its own key", and T-I3 (:129) says that key is "generated and used inside an HSM, never exported".
  - MC-25(a) tests "an attestation not signed by the monitor key".
  - ADR-008's own protocol (:98-99) gives only channel mutual authentication, a sequence number and a timestamp. It never says the attestation is signed or where the attestation key lives.
  - The behaviour still fails closed (a missing or unverifiable attestation means the signer refuses), so this is minor.
- MC-12(b)/(d), ageing → PASS. :94 ages claimed items from the monitor's own finality block. Windows recomputed:
  - fabricated payout: the last `ALL_CLEAR` was issued with chain data fetched before t_f, so it was issued before t_f + 30 and is honoured until before t_f + 90, which is within the stated "at most about 120 s" (`A_cycle` 60 + `A_attest` 60);
  - unposted genuine payout: t_f + 900 (`A_post`, CONTRACT:528) + 60 = 960 s ≈ 16 min, as at :84 and :87.
  - MC-12(c) → PASS: `A_attest`/`A_cycle`/`A_fresh` are new names; Q-C17 (OPEN_QUESTIONS:56) gives 60/60/30 s, which matches :91-99.
- MC-45 / CLAUDE.md fail-closed, the monitor's own chain source going stale → **FAIL** (D5), as an ambiguity:
  - :92 requires reference inputs "no older than `A_fresh` … for chain data", but doesn't say whether age means **fetch time** or the **age of the head block** (block timestamp, or lag against a second source).
  - :100 covers only an **unavailable** input. ADR-008 states no stall or lag check on its own nodes. CONTRACT §1.6's chain-stall PAUSE (CONTRACT:147, :521) is an adapter condition, which a compromised adapter wouldn't report.
  - Re-trace under the fetch-time reading: the monitor's own node freezes at block B. The monitor cuts its reconciliation at B, everything reconciles at 0, and `ALL_CLEAR` keeps flowing. Payouts broadcast through the reference RPC (THREAT_MODEL L-3 allows signed transactions there) stay invisible. The "about 120 s" window at :84 and :87 then has no bound beyond the signer's daily limits.
  - Under the block-age reading, the stale head fails `A_fresh` and no `ALL_CLEAR` is issued. That is fail-closed.
  - The natural reading of "chain data no older than 30 s" is the data's age, and the signer's preventive limits still bound the loss, so this is classed **minor**. It is the most consequential of this pass's minor defects, and it should go to the G1 packet as an explicit item.
- MC-40(d), healthy flows don't fire it → PASS, except the D1 false PAUSE (fail-closed). Unclaimed paid payouts and released holds: CONTRACT offers no hold read. A paid instruction whose hold is released through `releaseHold` and which is dropped from the claims leaves the chain short by A×k + fee while CBS G2 is unchanged. That gives residual ≠ 0 and no `ALL_CLEAR` (:93). If the item is still claimed, :94 PAUSEs at 960 s. THREAT_MODEL fix 9's signing-log-wide `A_post` rule (CF-38(a)) would catch it sooner, but nothing fails open without it.
- MC-17(a), content binding of outflow joins → PASS:
  - payout: the digest is recomputed from the final transaction's `to` and value plus `instructionId` (CONTRACT:112), equal to the approval's `payloadHash` (:37);
  - case return: `returnDestination` and `returnAmount × k` (:38);
  - move: Treasury's list, caps and fee fields (:40);
  - cancel class (:41) = THREAT_MODEL:194.
- MC-17(b), wrong-account and wrong-record mutants (p = 2, k = 10^16) → PASS, contingent on Q-C19 (RB-13):
  - `placeHold{instructionId I2}` puts the hold on V. `settleHold{H_V, I2, tx1}`, where tx1 is I1's payout: the CBS accepts. DR-29 finds tx1's signing-log `instructionId` I1 ≠ I2 → PAUSE.
  - T2 with `refs.address` = A_V for a log to A_C: DR-29 finds `refs.address` ≠ the log's `to` → PAUSE. With A_C, the CBS binds C's account, and anything else is `BINDING_MISMATCH` → PAUSE.
  - T11 citing another subject's `ASSIGN`: the CBS checks the subject → `BINDING_MISMATCH`. Swapping `subjectRef` as well creates a duplicate T11 for that subject → DR-07, and the true item ages out.
  - T9 citing another item's `caseId`: "for that item" (:45) needs the case's subject to equal the item (CONTRACT:202).
  - An inflated T9 R′: the chain outflow is pinned by DR-01 to `returnAmount × k`, so DR-06's residual ≠ 0 → PAUSE.
- MC-40(b) scope → PASS: S comes from reference inputs only (:42), and the registry is checked both ways (:43).
- MC-40(f), and fail-closed when the executor goes silent → PASS:
  - :99 stale or missing attestation → refuse;
  - :100 input lost → no `ALL_CLEAR`;
  - :103 unsigned artefact → no `ALL_CLEAR`;
  - :104 "flag unreadable" → PAUSE.
- MC-44, reference by reference → PASS:
  - :3 CF-25(a)–(d): LEDGER:70-77 keeps the entry "so those references resolve", and (d) still states the fee and day-boundary items, though CF-25 is now closed (routed R-2);
  - :12 T-S1/T-T2/T-E1/T-E2, RR-3, RR-2 2e;
  - :22 CF-5(f)/(h)/(i), Q-C18;
  - :29 CF-19(c);
  - :36 "verifier R3 D1";
  - :37 CONTRACT §1.3;
  - :40-41 ADR-001 duties 2/3/6, CF-18;
  - :45 CONTRACT §3 fixes F–I, Q-C19, RB-13 (RISK_REGISTER:94), "ADR-008 R5 C-1", T-E1 [X];
  - :94 §5.8, "verifier R4 D1";
  - :97 Q-C17;
  - :102 T-T6/T-B1/T-SC2/T-I3/DR-26(2)/residual 13;
  - :103 CF-23;
  - :104 §1.6, SEQUENCES F7, CF-9;
  - :120 CF-9(b);
  - :124-126 Q-D8 (OPEN_QUESTIONS:92), Q-D1 (:85), Q-C17.
- MC-45, Q-D1 (c)/(d) restatement at :125 = OPEN_QUESTIONS:85 (c), (d), clause by clause → PASS.
- MC-45, every external dependency fails closed → PASS for "unavailable" (CBS, nodes, screening :100; signer :99; paging :101). Stale chain data is D5.
- ADR rules → PASS:
  - options table with trade-offs (:81-87);
  - per-phase recommendation, with the pilot blockers named (:114-116);
  - the prose agrees with the table (:119-121).
- KICKOFF quote at :13 = KICKOFF_PROMPT.md:144 (faithful, with an ellipsis) → PASS. CLAUDE.md quote at :14 = CLAUDE.md:18 → PASS. Status PROPOSED (:3) → PASS.
- MC-21 → N/A. A grep of the target for `5042`, `gwei`, hex literals of 4+ digits and `-32xxx` returned nothing (exit 1). `gasUsed` and `effectiveGasPrice` are standard EIP-1559 fields (MC-41).
- MC-43 → N/A. The POPIA mention (:108) is routed to Q-R12.
- JL-1 Fail-closed → [inspection-only] PASS, except D5 (ambiguous staleness basis).
- JL-2 Human-owned → [inspection-only] PASS: the ages are "proposed" (Q-C17); unpause needs two humans; a stop needs one owner.
- JL-3 03:00 operability → [inspection-only] PASS: one on-call view (:105). Item-QUARANTINE resolutions at the monitor aren't described here (D2).
- JL-4 Auditability → [inspection-only] PASS.
- JL-5 Fewest new parts → [inspection-only] PASS (Q-D8).
- JL-6 Privacy → [inspection-only] PASS (:108).
- MC-01–08, 10, 11, 13–16, 18, 20, 22–25, 30–34, 42, 46–48 → N/A: this ADR has no templates, keys, state tables, events or code.
- Regression check of frozen units → N/A (Lens R). Recount: LEDGER:30-41 has 12 units, and 0 are frozen.

DEFECTS:
- D1 · ADR-008:3 ("matches ADR-001 fix block 11 duties 3 and 6 on the caps and fee limits"), :40 ("realised debits of all moves **and their cancels** within the daily move cap"), :41 (cancel fee "the daily move cap for a move"; duty-3 sum "of **every** signing-log entry's final transaction") vs ADR-001:25 (cancel fees count against **item 3's** daily cap; no value cap), with ADR-001 silent on whether move values count against duty 3's daily cap. The monitor and the signer count the same signature against different caps: a false PAUSE is reachable (re-trace above), and the monitor never re-checks move-cancel fees against D3 · R, MC-45 (caps at the boundary; "matches" claim) + MC-40(d) · **minor**
- D2 · ADR-008:104-105 declare only the rail-level `RESUME`. CONTRACT:149 and :146 route every item-QUARANTINE resolution (including `RELEASE` → T5) and the RPC-disagreement resolution through "a two-person resolution recorded by the monitor", and ADR-008 doesn't declare that monitor→adapter channel or its authentication. Tracked as LEDGER CF-26 (open) · R, MC-40(e) channel clause · **minor** (undefined means no resolution reaches the adapter, so the QUARANTINE holds and escalates to PAUSE at `A_quarantine`; it fails closed)
- D3 · ADR-008:24 / :98-105: the signer→monitor signing-log push (a **reference** input) has no stated authentication, unlike the operator, attestation and `RESUME` channels. An unauthenticated push lets a party other than the signer write a reference input (DR-13 bypass for one transaction). DR-01 still PAUSEs every value-moving forgery · R, MC-40(b)/(e) · **minor**
- D4 · ADR-008:98-99: the attestation protocol never states that attestations are **signed by the monitor's HSM-held key**, on which ADR-001:24 (duty 5), THREAT_MODEL:78/:129 and RUBRIC MC-25(a) rely. Only channel mutual authentication is given · R, MC-45 (protocol re-traced case by case) · **minor**
- D5 · ADR-008:92, :100, :84/:87: `A_fresh` for chain data doesn't say whether it measures fetch time or head-block age, and the monitor has no stated stall or lag check on its own nodes. Under the fetch-time reading, a frozen monitor node keeps `ALL_CLEAR` flowing while blind, and the stated ~120 s stop window doesn't hold · R, MC-45 (every dependency fails closed) + CLAUDE.md chain-stall rule (RUBRIC MC-11(vi)) + MC-40(c) (signal at the capture point) · **minor** (the natural reading is data age; signer limits bound the loss). **Carry to G1 as the highest-priority minor.** Suggested fix: define chain-data age by the head block's timestamp, and require the head to be within `A_fresh` of a second source (the reference RPC's unfiltered head, L-3-safe). Otherwise no `ALL_CLEAR`.

Routed (not counted against this unit):
- R-1 · ADR-008 (next touch) or G1 packet: re-pin to THREAT_MODEL **v2 fix block 9**. Drop the now-stale "ahead on DR-29" half of :3 and :48, because THREAT_MODEL:27 now matches. Take **CF-38(a)**: Treasury's list in the DR-29 row, the signing-log-wide `A_post` check, DR-19 part (1) in the map, and DR-19 part (2) (CI) in :48's exclusions. Also take **CF-39(a)**: name the superseded-`ASSIGN` → `NOT_PERMITTED` path in :45.
- R-2 · LEDGER and threat-model: closing CF-25 re-routed only "DR-01 fee conditions" as CF-38(c). CF-25(d)'s other parts lost their open tracker:
  - ADR-001 must state the **day boundary** of its daily caps (cited by ADR-008:40);
  - THREAT_MODEL B9 (:72) must list ADR-001 duty 3's daily cap and fee limits among the monitor's inputs;
  - T-T6 (:113) must name the fee limits among Treasury's artefacts.
  Re-open them under CF-38 or a new CF.
- R-3 · ADR-001: state whether internal-move values (and move-cancel fees) count against duty 3's daily cap, the daily move cap, or both, so that ADR-008 D1 can be fixed to match.
- R-4 · RUBRIC queue (Probe G): MC-40(c)/MC-45 should require every **freshness** precondition on chain inputs to name its measure (fetch time vs head-block age vs cross-source lag). As written, MC-40(c) "carries the signal at its capture point" passes a monitor whose node is frozen but freshly read (D5).
- R-5 · RUBRIC queue (Probe F): none found. The R7 Probe F proposal (pin by LEDGER row plus hash when a header has no fix-block label) is no longer needed for CONTRACT and ADR-001, whose headers now carry labels.

PROBE G (would the rubric wave through a bad version?): YES. See R-4: a monitor whose "fresh" chain data comes from a stalled node passes MC-40(c), MC-45 and MC-12 as written.
PROBE F (would it fail a good version?): none observed in this pass.

VERDICT: NEGATIVE (5 defects: 0 blocking, 5 minor)

Phase 1 exit rule (operator, LEDGER 2026-10-05): **zero BLOCKING → P1-adr-008 freezes.** D1–D5 and R-1–R-3 are carried to the G1 packet. Phase 1 · units frozen 0/12 before this pass · rounds used 8 (P1-adr-008).
