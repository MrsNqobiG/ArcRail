<!-- Saved by the main agent with the Write tool, verbatim from the verifier's returned output. The verifier couldn't write it: the PreToolUse guard (rule 1) matched the mainnet chain-ID digits in the report text inside a Bash command. See OPEN_QUESTIONS Q-T7. -->

VERIFICATION · lens: R · target: P1-adr-008 (docs/adr/ADR-008-independent-monitor.md, mtime 2026-10-03 11:13:38) · commit: none (uncommitted working tree; `git rev-parse HEAD` → "unknown revision", repo has no commits)

Note: docs/CONTRACT.md changed during this pass (mtime 11:15:38, after ADR-008). CONTRACT line numbers below are from that snapshot.

CHECKS:
- ADR rule: options, trade-offs, recommendation → PASS. Three options A/B/C (ADR-008:18-25). Trade-offs are given in the options table, which the ADR R1 Probe F relaxation allows (RUBRIC:91).
- ADR rule: per-phase recommendation (RUBRIC:92) → PASS. Testnet, mainnet pilot and GA rows are present (ADR-008:31-33). The pilot row names its blocker ("Blocked until CF-5(f) and CF-5(h)"). That list is incomplete, see D2.
- ADR rule: prose agrees with the phase table (RUBRIC:93) → PASS. The only recommendation is the table. Consequences (:36-38) assume B, which matches all three rows.
- KICKOFF §5 Phase 1 item 4, "Do not decide" → PASS. ":3 Status: PROPOSED. A human decides at G1."
- KICKOFF §5 Phase 1 item 4, ADR list → PASS. KICKOFF:106-112 lists exactly 7 ADRs (counted 001…007). ADR-008:3 says it is extra and says why. Item 4 does not forbid extra ADRs.
- MC-21 (Arc values) → PASS (N/A). ADR-008 cites no Arc constant, address, error code or chain ID. Checked by grep for hex addresses, gwei, RPC error codes and chain IDs: no hits.
- MC-43 (regulatory statements) → PASS (N/A). There are none.
- MC-44, re-traced reference by reference:
  · ":3 threat-model R5 verifier (D1, blocking)" → P1-threat-model-lensR-5.md:90 "D1 · … · blocking" → PASS
  · ":7-10 T-S1/T-T2/T-E1/T-E2" → THREAT_MODEL:49, :59, :91, :92, and :34 lists the same four as compromised-adapter threats → PASS
  · ":12 RISK_REGISTER RR-3" → RISK_REGISTER:32-37 covers T-S1 (3a) and T-E2. It doesn't cover T-T2 or T-E1, but the parenthetical cites the group together with THREAT_MODEL → PASS (see C-c)
  · ":13 KICKOFF U12 quote" → KICKOFF:144 → PASS (the ellipsis is faithful)
  · ":14 CLAUDE.md quote" → CLAUDE.md "Fail closed: any reconciliation drift, … pauses outbound movement and pages a human." → PASS
  · ":21, :32, :38 CF-5(f), CF-5(h)" → LEDGER:37 (f) listPayoutInstructions/listApprovals, (h) listIssuedAddresses → PASS. Neither operation is in CONTRACT §3 yet (grep: 0 hits), and both are correctly tracked as CF/Q-C18.
  · ":23 G1 residual 8" → THREAT_MODEL:181 → PASS
  · ":32 DR-01, DR-23, DR-25 can't run" → THREAT_MODEL:176 residual 6, and DR-25's input listApprovals at :163 → PASS
  · ":37 Signer interface (U9)" → KICKOFF:142 → PASS
  · ":38 Q-C18", ":41 Q-D8" → OPEN_QUESTIONS:57, :91 → PASS
  · ":41 JL-5" → RUBRIC:103 → PASS
  · ":36 U12 moves out of the adapter" → still referenced as an adapter-internal unit at CONTRACT:119 "(U12)" and SEQUENCES:20/:427 → FAIL (minor), see D8
- MC-45 (a): the ADR agrees with THREAT_MODEL → FAIL. The ADR repeats THREAT_MODEL:31/:35 ("no inputs from the adapter"), but THREAT_MODEL:38 assigns the monitor detections whose inputs are adapter state (D1). The ADR's input list also omits getBalancesAsOf/listJournals (D3).
- MC-45 (b): the ADR agrees with RISK_REGISTER → FAIL. RISK_REGISTER:35 "read by U12 directly from the CBS" and :81 RB-7 don't mention the monitor, the attestation or residual 8, and there's no "newer document is ahead" note (D4).
- MC-45 (c): every cited Q-id exists → PASS (Q-C18, Q-D8).
- MC-45 (d): every external dependency has a stated fail-closed behaviour → FAIL (minor). The monitor itself is covered. The behaviour when the monitor's own inputs fail (CBS reads, own nodes, Treasury list, signer push) is not stated (D5).
- MC-40 (b), re-traced for the detections ADR-008 moves → FAIL in part. With "Nothing from the adapter" the monitor can't compute DR-06's Rin/Rout/D/F terms. If it reads them from the adapter, a compromised adapter writes an input (a fabricated Rout item explains a drain). Neither reading is specified (D1).
- MC-40 (c), inputs exist → PASS. The missing CBS reads are tracked (CF-5(f)/(h), Q-C18, residual 6).
- MC-12 (b), new pending item A_attest → [inspection-only] PASS. It is bounded (60 s proposed) and fails closed.
- MC-19 (design side) → PASS. Two-human unpause is kept (:36).
- MC-03/04/05/06/10/11/46/47/48 → N/A. ADR-008 defines no amounts, templates, keys, states, events, movement classes or matrix rows (checked by grep).
- MC-01/02/07/08/14–20/22–24/30–34 → N/A (code items, Phase 2+). MC-42 → N/A.
- JL-1 Fail-closed → [inspection-only] FAIL in part. The dead-man attestation is correct. Paging, the ALL_CLEAR preconditions and PAUSE precedence are unspecified (D5).
- JL-2 Human-owned → [inspection-only] PASS. A_attest is "proposed". Advisory: route it to Q-C17.
- JL-3 03:00 operability → [inspection-only] FAIL (minor). There are two PAUSE authorities and no single place that shows which one is active or how to exit each (D8).
- JL-4 Auditability → [inspection-only] PASS. Retention of attestations is unstated (advisory).
- JL-5 Fewest new parts → [inspection-only] PASS. The new service is justified against A and C, and Q-D8 puts it to Ops and Infra.
- JL-6 Privacy by default → [inspection-only] FAIL (minor), see D7.

CANDIDATES:
- C-1 · ADR-008:21 "the signing log pushed by the signer. Nothing from the adapter" vs KICKOFF:144 U12 "Chain ↔ adapter ↔ CBS"; CONTRACT:391/:393-394 (Rin = "inbound items in DETECTED", Rout = "outbound and case-return items that are final with status 1 but whose T4/T9/T10 is not yet OK", D/F accumulators: all adapter state); THREAT_MODEL:146 DR-07 "Join adapter journals to listJournals"; :149 DR-10 "Σ indexed logs" (U4 index); :161 DR-23 "Compare every registry address → accountRef"; :162 DR-24 "the registry's bank-owned flags". THREAT_MODEL:38 assigns DR-06/07/10/23/24 to the monitor · MC-45, MC-40(b), JL-1 · REAL · The ADR's main premise is false for at least five of the detections it moves. The ADR doesn't say whether the monitor reads adapter state as the subject under check (valid under MC-40(b), but contradicts :21) or reconstructs Rin/Rout/D/F/index independently (not designed, and U12 would become two-way, a KICKOFF change that isn't acknowledged).
- C-2 · ADR-008:37 "The Signer interface (U9) gains a check for a valid attestation" and :32 "Blocked until CF-5(f) and CF-5(h)", vs ADR-001:11 "append-only log of (payloadHash, nonce, txHash) … readable by U12 directly", CONTRACT:204 (same 3-tuple), THREAT_MODEL:36 "the signer pushes each (payloadHash, nonce, txHash, instructionId)", and Q-D1 (a)–(c) with no attestation capability · MC-45, ADR per-phase rule, N5 · REAL · Under ADR-001 B the signer is a custodian whose ability to enforce an attestation, push its log and carry instructionId is unknown and not asked. The pilot row omits this blocker, and the consequences omit the change to the log schema and its direction.
- C-3 · ADR-008:21 "CBS read operations (CF-5(f), CF-5(h))" vs THREAT_MODEL:35 "(getBalancesAsOf, listJournals, listPayoutInstructions, listApprovals, listIssuedAddresses …)" · MC-45 · REAL · DR-06 and DR-07 need the CONTRACT:165-166 reads, which the ADR omits.
- C-4 · RISK_REGISTER:35 "read by U12 directly from the CBS"; :81 RB-7 "— (none until CF-5(f))"; no residual-8 row. P1-threat-model-lensR-5.md:104 X3 asked for the boundary to be named · MC-45 · REAL · RISK_REGISTER (10:46) predates ADR-008 (11:13) and has no "ahead" note.
- C-5 · ADR-008:22 "refuses to sign without a fresh ALL_CLEAR … A missing or stale attestation fails closed". It doesn't state the ALL_CLEAR preconditions (checks completed on fresh inputs), that a PAUSE overrides an unexpired ALL_CLEAR, the delivery channel (if the adapter relays attestations, it can withhold a PAUSE and replay an ALL_CLEAR for 60 s), or who pages. :14 quotes "pages a human", and threat-model R5 D1 (:90) asked for "an independent paging path" · MC-45(d), JL-1 · REAL · THREAT_MODEL:37 and B9 cover the override and the channel, so the ADR is weaker than the TM it owns. The preconditions and paging appear nowhere.
- C-6 · ADR-008:23 "Defeats a compromised adapter | … Yes" and :41 "it is the only design in which…", vs THREAT_MODEL:36 (the entry carries txHash, so DR-01 runs after signing) and OPEN_QUESTIONS:91 "the only proposed design" · JL-1, wording drift · REAL · Detection is after the fact. Transactions signed before the PAUSE lands are broadcast, bounded only by the signer limits (THREAT_MODEL:179). A pre-sign co-attestation option isn't listed.
- C-7 · ADR-008:21 the monitor ingests listIssuedAddresses (address↔account), vs KICKOFF §6 and THREAT_MODEL:126 L-2 (controls scoped to "U5, U13") · JL-6, RR-6 · REAL · This creates a new PI store in a new trust domain with no stated controls.
- C-8 · ADR-008:36 "two humans instruct the monitor to issue ALL_CLEAR again" vs CONTRACT:119 "Leaving PAUSE needs a two-person unpause (U12)", SEQUENCES:20 `Rec` = U12 and :427 "Rec->>Ops: request two-person unpause (U12)" · MC-44, JL-3 · REAL · Adapter-originated rail PAUSEs (CONTRACT §1.1, §1.5) remain, and their exit path is undefined once U12 moves.
- C-a · ADR-008:3 "Not one of KICKOFF's seven ADRs" · KICKOFF scope · DISMISSED · Item 4 lists the required ADRs and doesn't cap them. The addition is disclosed and has a cause.
- C-b · ADR-008:22 "A_attest, proposed 60 s" · JL-2 · DISMISSED · The value is "proposed" in a PROPOSED ADR and matches THREAT_MODEL:37 (advisory: add it to Q-C17).
- C-c · ADR-008:12 RR-3 cited for four threats, of which RR-3 covers two · MC-44 · DISMISSED · The parenthetical cites the group, and THREAT_MODEL:34 covers all four.
- C-d · ADR-008:31 testnet "B" while DR-01/23/25 can't run · per-phase rule · DISMISSED · The row claims only that the attestation path is exercised, and a CBS stub suffices.
- C-e · The monitor's attestation key custody is unspecified · N2 · DISMISSED · ADR-008:20 requires separate credentials and admins, and monitor key theft is residual 8.

PROBE G: YES. C-1 passes a literal MC-45, because ADR-008:21 and THREAT_MODEL:31/:35 agree with each other. The contradiction is inside THREAT_MODEL (B9 versus the §D definitions plus "Runs in the monitor"). No rubric item checks a detection's inputs against its executor's declared input set. Proposed MC-40 (e) (not applied): "every detection names its executor; every input is in that executor's declared input set; adapter state read by the monitor is labelled subject-under-check or reference". The threat-model R5 Probe G (P1-threat-model-lensR-5.md:70) has the same root and is logged in RUBRIC:142-156 as neither adopted nor rejected. That is routed to P1-rubric.

PROBE F: YES, partly. A good monitor must read the adapter records it checks, for example registry rows compared with listIssuedAddresses. A literal MC-40(b), "can write neither the detection's inputs", would fail it. Proposed rewording: "neither the detection's reference input nor its scope; the checked component's own records may be the subject under comparison". MC-45(d) needs no further relaxation, since D5 stands on the dead-man semantics.

DEFECTS:
- D1 · ADR-008:21, :36 vs THREAT_MODEL:38/:146/:149/:161/:162, CONTRACT:391-394 · R, MC-45 + MC-40(b) · blocking
- D2 · ADR-008:32, :37 vs ADR-001:11, CONTRACT:204, Q-D1 · R, MC-45 + ADR per-phase rule (N5) · minor
- D3 · ADR-008:21 vs THREAT_MODEL:35 · R, MC-45 · minor
- D4 · RISK_REGISTER:35, :81 vs ADR-008 · R, MC-45 · minor (fix in P1-risk-register)
- D5 · ADR-008:22 (:14) · R, MC-45(d) + JL-1 · minor
- D6 · ADR-008:23, :41 · R, JL-1 claim accuracy · minor
- D7 · ADR-008:21 vs KICKOFF §6, THREAT_MODEL:126 · R, JL-6 (RR-6) · minor
- D8 · ADR-008:36 vs CONTRACT:119, SEQUENCES:20/:427 · R, MC-44 + JL-3 · minor

Routed (not counted): P1-rubric. The threat-model R5 Probe G proposal is missing from the RUBRIC probe log (RUBRIC:149-156).

VERDICT: NEGATIVE (8 defects: 1 blocking, 7 minor)
