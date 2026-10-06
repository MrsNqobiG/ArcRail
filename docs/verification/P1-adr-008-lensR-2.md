VERIFICATION · lens: R · target: P1-adr-008 (docs/adr/ADR-008-independent-monitor.md, mtime 2026-10-03 11:24:07, after fix block 1) · commit: none (uncommitted working tree; `git rev-parse HEAD` → "unknown revision", repo has no commits)

Snapshot mtimes used for MC-45 version ordering: ADR-008 11:24:07 · THREAT_MODEL 11:13:20 · RISK_REGISTER 11:16:19 · CONTRACT 11:15:38 · RUBRIC 11:24:48 · ADR-001 11:25:35 · OPEN_QUESTIONS 11:25:35 · LEDGER 11:25:49 · SEQUENCES 2026-10-02 23:23.

CHECKS:
- ADR rule: options, trade-offs, recommendation → PASS. Four options A/B/C/D (ADR-008:37-43), counted. Trade-offs are in the options table (RUBRIC:91 relaxation).
- ADR rule: per-phase recommendation (RUBRIC:92) → PASS. Testnet, mainnet pilot and GA rows at ADR-008:60-62. The pilot row names its blockers. One cited blocker id is wrong, see D6.
- ADR rule: prose agrees with the phase table (RUBRIC:93) → PASS. The only recommendation is the table. Consequences (:65-67) assume B or D, which matches all three rows.
- KICKOFF §5 Phase 1 item 4, "Do not decide" → PASS. ADR-008:3 "Status: PROPOSED. A human decides at G1."
- KICKOFF §5 Phase 1 item 4, ADR list → PASS. KICKOFF:106-112 lists 7 ADRs. ADR-008:3 says it is extra and why. Item 4 sets no cap.
- KICKOFF U12 (KICKOFF:144) → PASS. The quote at ADR-008:13 is faithful. Three-way chain ↔ adapter ↔ CBS is kept, with the adapter as the checked party (:33). Two-human unpause is kept (:51).
- KICKOFF §6 (KICKOFF:183, address↔customer links are PI) → PASS. ADR-008:53-54 adds controls for the monitor's copy.
- CLAUDE.md "Fail closed … pages a human" → [inspection-only] PASS for the dead-man path (:48-50). The adapter→monitor PAUSE report path is open, see D5.
- MC-21 (Arc values) → PASS (N/A). A grep for hex addresses, gwei, RPC error codes, chain IDs and 4+-digit literals in ADR-008 finds nothing.
- MC-43 (regulatory statements) → PASS (N/A). The only regulatory reference is "POPIA PIA (… Q-R12)", which is routed to a Q-id and not asserted.
- Fix-block-1 item recount vs LEDGER:29, each re-located → PASS:
  · input model → :16-33;
  · preconditions → :46;
  · precedence, monotone sequence → :48;
  · direct channel → :47;
  · own paging → :50;
  · option D → :37-43;
  · privacy → :53-54;
  · single PAUSE authority → :51;
  · CF-9 → LEDGER:40. 9/9 present.
- R1 defects re-traced:
  · D1 → fixed (reference vs subject model, :17-27);
  · D2 → fixed in part (:61, :66; wrong sub-id, see D6);
  · D3 → fixed (:22 lists getBalancesAsOf, listJournals);
  · D4 → fixed (RISK_REGISTER:37 no longer says "read by U12 directly"; RB-7/RB-9 present);
  · D5 → fixed (:46-50);
  · D6 → partly; the replacement claim is again overstated, see D4;
  · D7 → fixed (:53-54);
  · D8 → fixed in the ADR (:51), with CONTRACT:119 and SEQUENCES:20/:427 still saying U12, tracked by CF-9(a) and flagged in the ADR ("must say this: CF-9").
- MC-44, reference by reference:
  · :3 "threat-model R5 verifier (D1, blocking)" → P1-threat-model-lensR-5.md:90 "D1 · … · **blocking**" → PASS
  · :7-10 T-S1/T-T2/T-E1/T-E2 → THREAT_MODEL:49, :59, :91, :92 → PASS
  · :12 RR-3, RR-2 2e → RISK_REGISTER:34-37, :31 → PASS
  · :14 CLAUDE.md quote → PASS
  · :21 L-3 own nodes → THREAT_MODEL:127 → PASS
  · :22 CF-5(f), CF-5(h), Q-C18 → LEDGER:37, OPEN_QUESTIONS:57 → PASS
  · :23 DR-24 → THREAT_MODEL:162 → PASS
  · :25 Rin, Rout, D, F → CONTRACT:386-394 → PASS
  · :46 `A_post` → CONTRACT:429 and :449 define A_post as the age limit for a posting gap (Rin DETECTED; Rout/Rmove settle not OK), not as a chain-data freshness bound → FAIL, see D4
  · :51 CONTRACT §1.6 → CONTRACT:118-125; SEQUENCES F7 → SEQUENCES:411 → PASS
  · :54 DR-26, L-2, Q-R12 → THREAT_MODEL:164, :126; OPEN_QUESTIONS:71 → PASS. L-8 (THREAT_MODEL:132, "PIA per vendor") is loosely applied to an in-bank service → PASS, advisory
  · :66 ADR-001 "readable by U12 directly" → ADR-001:12 → PASS (the ADR says it is ahead, and CF-9(b) routes the change)
  · :70 Q-D8, JL-5 → OPEN_QUESTIONS:91, RUBRIC:103 → PASS
  · :61/:71 "Q-D1(d)" described as attestation **and** signing-log push → OPEN_QUESTIONS:84 and ADR-001:51 put the push in (c) and only the attestation in (d) → FAIL, see D6
  · :72 Q-C17 → OPEN_QUESTIONS:56 exists. A_attest and A_recon aren't in it yet; tracked by CF-9(c) → PASS
- MC-45 (a) forward: ADR agrees with THREAT_MODEL → FAIL. ADR-008:17 says the monitor "does read adapter records". THREAT_MODEL:31 (B9) says "Nothing from the adapter flows in", and :35 says "It takes no inputs from the adapter". ADR-008 is the newer document and has no "ahead" note for THREAT_MODEL. CF-9 (LEDGER:40) routes CONTRACT, SEQUENCES and ADR-001 changes, but not THREAT_MODEL. See D3.
- MC-45 (a) backward from owner cells naming ADR-008 → FAIL. THREAT_MODEL:38 assigns 19 detections to the monitor (counted: DR-01, 06, 07, 10, 12, 13, 14, 15, 17, 19, 20, 21, 22, 23, 24, 25, 26, RD-01, RD-03). I traced each detection's inputs (THREAT_MODEL:140-166, RISK_REGISTER:70-72) against the ADR-008:19-25 input set. 7 of 19 use an input that is not in that set (D1):
  · DR-01: CBS disposition records (also RISK_REGISTER:37, "disposition records");
  · DR-12: the adapter's local nonce, which isn't in the subject row;
  · DR-17: the official sanctions-list entry and the screening path;
  · DR-19: the logs and telemetry stream, and the canary mapping;
  · DR-20: captured network traffic;
  · DR-22: the screening and monitoring records' subject;
  · DR-26: the DB engine audit log and Security's honeytoken list.
  The other 12 resolve to declared inputs.
- MC-45 (a) RISK_REGISTER → PASS. RR:3, :31, :37, :85, :87 agree with the ADR on monitor placement, signer enforcement, RB-7 and RB-9. RB-9's "Separate admins and change control per domain (ADR-008)" → ADR-008:39 and :61 → PASS.
- MC-45 ADR-to-ADR (ADR-001) → PASS. ADR-001:51 Q-D1 (c)/(d) carry the push and the attestation. ADR-001:12's 3-tuple "readable by U12" is flagged by ADR-008:66 and routed through CF-9(b).
- MC-45 Q-D column mirror → PASS. Q-D1 and Q-D8 list ADR-008 in their source column (OPEN_QUESTIONS:84, :91), and ADR-008:70-71 cites both.
- MC-45 (c) every cited Q-id exists → PASS (Q-C17, Q-C18, Q-D1, Q-D8, Q-R12).
- MC-45 (d) external dependencies fail closed → FAIL (minor). Reference-input loss gives no ALL_CLEAR (:49), and the monitor itself fails through the dead-man switch (:48). Not covered: the adapter→monitor PAUSE report (:51), and the inputs missing from the table (D1, D5).
- MC-40 (b) for the ADR's reconstruction rules (:27-31) → PASS. Rin, D, F, Rout, Rmove and the registry are each reconstructed from reference inputs, and adapter records are the subject only. The identity scope S is bounded by listIssuedAddresses plus Treasury's list (:31).
- MC-40 (e) declared input set → FAIL, see D1.
- MC-40 (f) PAUSE outside the compromise domain → PASS. The signer enforces it (:41, :47-48), and the adapter never relays (:47).
- MC-12 (b) new pending terms A_attest and A_recon → [inspection-only] PASS. Both are bounded and fail closed (no ALL_CLEAR → no signing).
- MC-19 (design side) → PASS (:51, two humans).
- MC-03/04/05/06/10/11/46/47/48 → N/A. A grep shows ADR-008 defines no amounts, templates, keys, states, events, movement classes or matrix rows.
- MC-01/02/07/08/14–20/22–24/30–34 → N/A (code items, Phase 2+). MC-42 → N/A.
- Internal consistency of the ADR's Rout rule → FAIL. :30 says "a CBS instruction **or** approval", but option D at :40 says "the CBS instruction **and** approval", and THREAT_MODEL:140 DR-01 requires both for a payout and a CaseDisposition for a case return. See D2.
- Stop-latency claim, recomputed → FAIL. :40 says "Further signing stops within A_attest" and :43 says "stops it after the first transaction". Worst case under the :46 preconditions: a fabricated tx is mined at t0, just after the monitor's chain fetch. ALL_CLEARs stay valid while the chain data is ≤ A_post old, so new ALL_CLEARs can be issued until t0 + A_post (15 min). The last one is honoured for A_attest (60 s). Signing can therefore continue for up to 900 s + 60 s = 960 s after the first fabricated tx: 16× the stated 60 s, bounded only by the daily limit. A_recon (300 s) bounds cycle age, not chain-data age. See D4.
- JL-1 Fail-closed → [inspection-only] FAIL (minor), see D4 and D5. The dead-man attestation, precedence, replay rejection and direct channel are sound.
- JL-2 Human-owned → [inspection-only] FAIL (minor). Reusing A_post as the chain-freshness bound means the human who sets A_post for posting gaps (Q-C17) is also, without knowing it, setting the monitor's chain staleness tolerance (D4). A_attest and A_recon are "proposed" and routed to Q-C17 → otherwise PASS.
- JL-3 03:00 operability → [inspection-only] PASS. There is a single PAUSE authority and display (:51). Advisory: say how the monitor's sequence counter survives a restart (if it resets, the signer rejects forever, which is fail-closed but blocks the exit).
- JL-4 Auditability → [inspection-only] PASS. Advisory: retention of the attestation history is unstated.
- JL-5 Fewest new parts → [inspection-only] PASS. One new service, justified against A and C, and put to Ops/Infra in Q-D8.
- JL-6 Privacy by default → [inspection-only] PASS (:53-54).
- Regression check of frozen units → N/A. Recounting LEDGER:22-33 gives 12 units, 0 frozen.

CANDIDATES:
- C-1 · ADR-008:19-25 (input table) vs THREAT_MODEL:38 "Runs in the monitor: DR-01, … DR-17, DR-19, DR-20 (CI and runtime), … DR-22, … DR-26"; THREAT_MODEL:140 DR-01 "a case return is an entry whose instructionId is a case-return ID matching a CBS CaseDisposition"; :156 DR-17 "The official sanctions list entry"; :158 DR-19 "Canary mapping"; :159 DR-20 "Captured network traffic"; :164 DR-26 "DB audit log; Security's honeytoken list"; RISK_REGISTER:37 "against the CBS's own instruction, approval and disposition records"; RUBRIC MC-40(e) "every input is in that executor's declared input set (ADR-008 input model)" · MC-45 backward trace, MC-40(e), MC-40(c), MC-45(d) · REAL · 7 of 19 monitor detections have inputs outside the declared set, among them the only [R] detections for RR-6 6a (DR-19), 6b (DR-20) and 6e (DR-26), and the case-return branch of DR-01 (the [R] for RR-3 3a). Under MC-40(e) these detections are invalid, so MC-41 fails for those blind sub-risks. For DR-01 there is no CBS disposition read in CONTRACT §3 under any name, in CF-5(f)/(h) or in Q-C18. `replayEvents` (CONTRACT:168) could serve, but the ADR doesn't name it. Without it, DR-01 either PAUSEs on every legitimate case return (MC-40(d)) or takes dispositions from the adapter, which would make them evidence (MC-40(b)). The :49 fail-closed rule can't cover inputs the table doesn't list. Blocking: it is the same class as R1 D1 (the input model doesn't support the detections assigned to the monitor), and MC-40(e) makes this table normative.
- C-2 · ADR-008:30 "Rout and Rmove: each needs a final status-1 receipt **and** a signing-log entry **and** a CBS instruction or approval" vs ADR-008:40 "the monitor checks the CBS instruction and approval for **each** payout" and THREAT_MODEL:140 "a payout is an entry whose instructionId matches a CBS instruction (listPayoutInstructions) and a CBS approval (listApprovals)" · MC-45 · REAL · For a payout, the ADR's rule accepts an approval without a CBS instruction. That is exactly the T-S1 shape: an invented instruction plus a checker approval obtained from an adapter-written summary. DR-01 as defined in THREAT_MODEL still catches it, so there is no end-to-end bypass, and severity is minor. But the ADR disagrees with the TM and with its own option D, and a builder following ADR-008:30 would build the weaker join.
- C-3 · ADR-008:17 "the monitor **does read adapter records**" vs THREAT_MODEL:31 "Nothing from the adapter flows in" and :35 "It takes no inputs from the adapter"; LEDGER:40 CF-9 (a)–(c) name CONTRACT, SEQUENCES, ADR-001 and Q-C17, not THREAT_MODEL · MC-45, MC-40 version clause ("A sibling document changed afterwards makes the sibling the defective one, unless the newer document says it is ahead") · REAL · ADR-008 (11:24) is newer than THREAT_MODEL (11:13). It carries "ahead" notes for CONTRACT/SEQUENCES (:51) and ADR-001 (:66), but none for THREAT_MODEL B9/§monitor. Minor.
- C-4 · ADR-008:40 "**After** the first fabricated transaction is signed and seen on-chain. Further signing stops within `A_attest`"; :43 "Detects and stops it after the first transaction"; :46 "chain no older than `A_post`" vs CONTRACT:429 "Inbound DETECTED (Rin) | `A_post` 15 min | PAUSE" and :449 "Final status 1, settle not OK (Rout, Rmove) | `A_post` 15 min" · JL-1 claim accuracy, MC-44, JL-2 · REAL · Recomputed above: up to 960 s of further signing, not 60 s, and possibly several fabricated transactions, not one. A_post is a posting-gap age, borrowed here as a chain-freshness bound looser than A_recon. Minor, because the ADR does state that the daily limit bounds the loss.
- C-5 · ADR-008:51 "the adapter's own PAUSE conditions (CONTRACT §1.6) are **reported to the monitor**, which then issues `PAUSE`. The monitor is the single place that shows whether the rail is paused" · JL-1, MC-45(d) · REAL · This is a new adapter→monitor channel whose loss is invisible: the monitor can't tell a missing report from no PAUSE. The ADR doesn't say whether the adapter also stops its own signing requests locally (CONTRACT:119 "stop all outbound signing"), or how a report is delivered (outbox, at-least-once, with an acknowledgement). Under the "single PAUSE authority" reading, a dropped report leaves signing running while an honest adapter has hit a PAUSE condition. Minor.
- C-6 · ADR-008:71 "**Q-D1(d)** (added to Q-D1): … require the monitor's attestation before signing, **and push its signing log (with instructionId)** to the monitor?"; :61 "Q-D1(d) is answered yes" vs OPEN_QUESTIONS:84 "(c) provide an append-only signing log … pushed to the independent monitor; (d) require the monitor's fresh ALL_CLEAR attestation" (ADR-001:51 is the same) · MC-44, ADR per-phase blocker · REAL · The cited sub-item doesn't say what the ADR claims, and the pilot blocker leaves out Q-D1(c), without which the monitor has no signing log (DR-01, DR-13, DR-25 can't run). ADR-001's pilot row, which requires (a)–(e), blocks custodian B anyway, so the impact is limited. Minor.
- C-a · ADR-008 no longer states the simultaneous-compromise residual (R1 version had it; THREAT_MODEL:181 residual 8, RISK_REGISTER:87 RB-9 both cite ADR-008) · MC-45 backward · DISMISSED · The owner cells cite ADR-008 for the mitigation "separate admins and change control", which is at ADR-008:39 and :61. The scope word "alone" at :43 keeps the residual's premise. Nothing disagrees.
- C-b · ADR-008:48 freshness depends on timestamps, with no clock-sync requirement stated · JL-1 · DISMISSED · Skew fails closed in the stale direction. In the forward direction it extends an ALL_CLEAR only when the monitor itself is wrong, which is residual 8. A Phase 2 detail.
- C-c · ADR-008:54 "inclusion in the POPIA PIA (L-8, Q-R12)": L-8 is a per-vendor cross-border PIA, and the monitor is in-bank · MC-44 · DISMISSED · The claim (do a PIA) is routed to Q-R12, and L-8's control is a PIA. A loose but not false reference. Advisory.
- C-d · ADR-008:22 cites CF-5(f)/(h) for getBalancesAsOf/listJournals, which already exist (CONTRACT:165-166) · MC-44 · DISMISSED · The CF ids are attached to the new reads in the same list, and the existing two need none.

PROBE G (would the rubric wave through a bad version?): YES, one gap. A version that borrows an existing named age (A_post) for a different bound passes MC-12 (the age exists and is bounded) and a literal MC-44 (A_post resolves to CONTRACT §5.8). Only a judgment lens catches the change of meaning. Proposed (not applied; under the RUBRIC:163 cut-off rule it goes to the next rubric revision): MC-12(c) "every named age used outside its CONTRACT §5.8 row is used with the same meaning; a new bound gets a new name and a Q-C17 entry". Routed to P1-rubric.

PROBE F (would the rubric fail a good version?): YES, partly. MC-40(b) "the scope is fixed in advance or chosen by an independent component" read literally fails a good ADR-008. The list of claimed items checked in :27-30 is chosen by the adapter. That is harmless, because the identity is closed over S (built from reference inputs, :31), so an unclaimed reference item shows up as a non-zero residual. Proposed wording: "scope means the set over which the identity or join is closed (wallet set, block range), not the list of claimed items, provided unclaimed reference items surface as a non-zero residual." Routed to P1-rubric.

DEFECTS:
- D1 · ADR-008:19-25, :49 vs THREAT_MODEL:38, :140, :156, :158, :159, :160, :164; RISK_REGISTER:37 · R, MC-45 (backward) + MC-40(e)/(c) · blocking
- D2 · ADR-008:30 vs ADR-008:40, THREAT_MODEL:140 · R, MC-45 · minor
- D3 · ADR-008:17 vs THREAT_MODEL:31, :35; LEDGER:40 (CF-9 omits THREAT_MODEL) · R, MC-45 + MC-40 version clause · minor
- D4 · ADR-008:40, :43, :46 vs CONTRACT:429, :449 · R, JL-1 claim accuracy + MC-44 + JL-2 · minor
- D5 · ADR-008:51 · R, JL-1 + MC-45(d) · minor
- D6 · ADR-008:61, :71 vs OPEN_QUESTIONS:84, ADR-001:51 · R, MC-44 + ADR per-phase blocker · minor

Routed (not counted): P1-rubric gets the Probe G (MC-12(c)) and Probe F (MC-40(b) scope wording) proposals. P1-threat-model: B9 (:31) and :35 should be reworded to the reference/subject model, which is what D3's "ahead" note or a CF-9(d) would route.

VERDICT: NEGATIVE (6 defects: 1 blocking, 5 minor)
