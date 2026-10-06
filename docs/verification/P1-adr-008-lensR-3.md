VERIFICATION · lens: R · target: P1-adr-008 (docs/adr/ADR-008-independent-monitor.md, mtime 2026-10-03 11:33:15, sha256 734fa600…a561, after fix block 2) · commit: none (uncommitted working tree; `git rev-parse HEAD` → "unknown revision", repo has no commits)

Snapshot used for MC-45 version ordering (siblings were edited during this run; the target was not): ADR-008 11:33:15 · OPEN_QUESTIONS 11:33:15 · THREAT_MODEL 11:13:20 · RISK_REGISTER 11:34:41 (fix block 3) · CONTRACT 11:34:19 · LEDGER 11:34:41 · RUBRIC 11:24:48 · ADR-001 11:25:35 · SEQUENCES 2026-10-02 23:23.

CHECKS:
- ADR rule: options, trade-offs, recommendation → PASS. 4 options A/B/C/D counted at ADR-008:66-72. Trade-offs are in the table (RUBRIC:91 relaxation).
- ADR rule: per-phase recommendation (RUBRIC:92) → PASS. Testnet/pilot/GA rows at :95-97. Pilot blockers are named (:96).
- ADR rule: prose agrees with phase table (RUBRIC:93) → PASS. Consequences (:100-102) assume B or D, matching every row.
- KICKOFF §5 Phase 1 item 4 "Do not decide" → PASS (:3 "Status: PROPOSED. A human decides at G1.").
- KICKOFF U12 (KICKOFF:144) → PASS. The :13 quote is faithful, three-way kept (:37), two-human unpause kept (:86).
- KICKOFF §6 (KICKOFF:183) → PASS (:89 controls on the monitor's copy of address↔account links).
- CLAUDE.md fail closed and pages a human → [inspection-only] PASS for the protocol itself (:83-86 dead-man switch, precedence, own paging, adapter self-stop plus flag read). The detection coverage behind it has a gap, see D1.
- MC-21 → PASS (N/A). A grep of ADR-008 for hex literals, gwei, RPC codes and 4+-digit numbers returned nothing (exit 1).
- MC-43 → PASS (N/A). The only regulatory reference is the POPIA PIA, which is routed to Q-R12.
- MC-40(e) reference side, recounted → PASS. THREAT_MODEL:38 monitor list (19 IDs) diffed against the ADR-008:44-62 map rows (19 IDs): IDENTICAL. Every reference input named in the map is in the :21-26 table. Checked per row: DR-01, 06, 07, 10, 12, 13, 14, 15, 17, 19, 20, 21, 22, 23, 24, 25, 26, RD-01, RD-03.
- MC-40(e) subject side → FAIL (minor), see D3. The map and protocol use 4 subject inputs that the :27-28 rows do not enumerate.
- MC-40(b) scope → FAIL (minor), see D4. The wallet set S, over which every chain-side detection iterates, is not stated to come from reference inputs.
- MC-40(f) → PASS. PAUSE is enforced by the signer (:70, :83), and the adapter never relays (:82).
- MC-12(b) for A_attest, A_cycle, A_fresh → PASS. Each is bounded, and its expiry fails closed (no ALL_CLEAR → no signature). They are new names distinct from A_post (:81), which answers the R2 Probe G concern. They are not yet in Q-C17 (OPEN_QUESTIONS:56), which is tracked by CF-9(c) (LEDGER:40).
- MC-19 design → PASS (:86).
- MC-44, reference by reference:
  · :3 threat-model R5 D1 blocking → P1-threat-model-lensR-5.md:90 "· **blocking**" → PASS
  · :7-10 T-S1/T-T2/T-E1/T-E2 → THREAT_MODEL:49/59/91/92 → PASS
  · :12 RR-3, RR-2 2e → RISK_REGISTER:34-40, :31 → PASS
  · :14 CLAUDE.md quote → PASS
  · :21 L-3 → THREAT_MODEL:127 → PASS
  · :22 CF-5(f)/(h) → LEDGER:37 → PASS. CF-5(i) → defined only as a parenthetical inside CF-9(d) (LEDGER:40), not in the CF-5 list (a)–(h) at LEDGER:37 → PASS by resolution, advisory
  · :22 Q-C18 → OPEN_QUESTIONS:57, which lists listCaseDispositions and the screening/monitoring records → PASS
  · :23 DR-24 → THREAT_MODEL:162 → PASS
  · :28 Rin, Rout, Rmove, D, F → CONTRACT §5.7 → PASS
  · :81 A_post → CONTRACT §5.8 → PASS
  · :86 CONTRACT §1.6 and SEQUENCES F7 → CONTRACT:125, SEQUENCES:411-430 ("Rec … two-person unpause (U12)") → PASS (ahead, CF-9(a))
  · :89 DR-26, L-2, L-8, Q-R12 → PASS (L-8 is per-vendor, loose, advisory as in R2)
  · :96 and :106 Q-D1 (c)/(d) → OPEN_QUESTIONS:84 (c) push, (d) attestation → PASS (R2 D6 fixed)
  · :101 ADR-001 "readable by U12 directly" → ADR-001:12 → PASS (ahead, CF-9(b))
  · :105 Q-D8, JL-5 → OPEN_QUESTIONS:91, RUBRIC:103 → PASS
- ADR internal consistency, CF-5(i) → FAIL (minor), see D2. :22 and :96 require CF-5(i), but Consequences :102 lists only CF-5(f) and CF-5(h).
- MC-45 (a) THREAT_MODEL forward → PASS for B9 and :35, which carry the :3 "ahead" note plus CF-10 (LEDGER:42). It FAILs (minor, part of D2) for DR-01's prerequisite: THREAT_MODEL:140 and residual 6 (:176) say DR-01 needs CF-5(f) only, while ADR-008 (newer) makes the case-return branch need listCaseDispositions (CF-5(i)). The :3 ahead note covers only B9's wording.
- MC-45 (a) backward from owner cells → PASS on placement: THREAT_MODEL:31-40, :181; RISK_REGISTER:3, :37, :88 RB-9 → ADR-008:68, :96. It FAILs on the claim of what B detects, see D1. THREAT_MODEL residual 4 (:174) says a compromised adapter can misuse approvals until Q-C10, while ADR-008:72 says B "Detects and stops it after the first transaction".
- MC-45 RISK_REGISTER (newer than the target) → PASS: RR:32 (DR-22 needs CF-5(i)) and RR:70 (RD-01 two executors) agree with the ADR map. Routed, not counted against this unit: RR:37 3a and RR:85 RB-7 still name only CF-5(f)/(h) as DR-01's prerequisites.
- MC-45 ADR-to-ADR (ADR-001) → PASS. ADR-001:51 Q-D1 (c)/(d) match. ADR-001:12's 3-tuple is flagged at :101 and routed by CF-9(b).
- MC-45 Q-D mirror → PASS. Q-D1 and Q-D8 list ADR-008 (OPEN_QUESTIONS:84, :91), and ADR-008:105-106 cites both.
- MC-45 (c) cited Q-ids exist → PASS (Q-C17, Q-C18, Q-D1, Q-D8, Q-R12).
- MC-45 (d) dependencies fail closed → PASS. Reference input lost → no ALL_CLEAR (:84). Monitor down → dead-man switch (:83). Adapter report lost → flag read, with "unreadable" treated as PAUSE (:86). CBS, nodes and the screening service are reference inputs, so they are covered by :84.
- Stop-window claim (:69, "at most about 120 s"), recomputed → [inspection-only on the reading] PASS. A fabricated tx is final at t0, and the last chain fetch f is just before t0.
  · Reading 1: preconditions evaluated at ALL_CLEAR issuance T (the text labels them "Preconditions for ALL_CLEAR"). Then T ≤ f + A_fresh < t0 + 30 s, and the last ALL_CLEAR is honoured until T + A_attest < t0 + 90 s. 90 ≤ 120, so the claim holds.
  · Reading 2: freshness measured at cycle finish c. Then c < t0 + 30, re-issue continues until c + A_cycle < t0 + 90, and the last ALL_CLEAR is honoured until < t0 + 150 s, which exceeds 120 s.
  · Reading 1 is the plain reading, so this is not counted (see C-5). It holds only for a payout with no CBS instruction behind it; for a redirected genuine payout there is no stop at all (D1).
- R2 defects re-traced:
  · D1 → FIXED (19/19 map, reference side complete);
  · D2 → FIXED (:33 "and");
  · D3 → FIXED (:3 ahead note, CF-10 at LEDGER:42);
  · D4 → FIXED (new ages; bound recomputed above);
  · D5 → FIXED (:86 self-stop plus flag read);
  · D6 → FIXED (:96, :106 match OPEN_QUESTIONS:84).
- JL-1 Fail-closed → [inspection-only] FAIL, see D1 (a payout redirected under a genuine instructionId never trips any monitor check).
- JL-2 Human-owned → [inspection-only] PASS. The new ages are "proposed" and routed to Q-C17 (:81, :107).
- JL-3 03:00 operability → [inspection-only] PASS. There is a single PAUSE display (:86). Advisory (carried from R2): the monitor's sequence counter after a restart.
- JL-4 Auditability → [inspection-only] PASS. Advisory: retention of attestation history.
- JL-5 Fewest new parts → [inspection-only] PASS (Q-D8).
- JL-6 Privacy → [inspection-only] PASS (:89).
- MC-01…08, 10, 11, 13–20, 22–24, 30–34, 42, 46–48 → N/A (no amounts, templates, keys, states, events or code in this ADR; a grep confirms).
- Regression check of frozen units → N/A by recount. LEDGER:22-33 lists 12 units, 0 frozen.

CANDIDATES:
- C-1 · ADR-008:33 "Rout: each needs a final status-1 receipt **and** a signing-log entry **and** the CBS instruction **and** approval (or, for a case return, the CBS case disposition)"; :72 B "**Detects and stops it after the first transaction**", D "**Prevents** it"; :69 D "co-signs a per-transaction token the signer requires". A grep shows ADR-008 never compares destination, amount or payloadHash (payloadHash appears only as a signing-log field, :24, :101). CONTRACT:93 shows that payloadDigest binds amountWei, destination and instructionId. CONTRACT:174 and :180 show that the CBS instruction and CaseDisposition carry destination and amount. · JL-1, MC-45 backward (THREAT_MODEL residual 4 :174, T-E2 :92), MC-40(a) · REAL · The join is on existence (instructionId), not on content.
  Re-trace, with Q-C10 open (so the signer cannot verify the assertion; ADR-008's pilot blockers at :96 don't include Q-C10). Take p = 2, k = 10^16. A genuine instruction I pays 10.00 USDC = 1000 minor to merchant M, with a genuine CBS approval. A compromised adapter has the signer sign a value transfer of 1000×10^16 = 10^19 wei to an attacker address under instructionId I. The monitor then finds:
  · a status-1 receipt ✓;
  · a signing-log entry with I ✓;
  · listPayoutInstructions has I ✓;
  · listApprovals has I ✓;
  · so Rout is supported.
  The identity gives chain −10^19 − g and RHS −Rout(10^19) − F(g), so the residual is 0. After T4 posts 1000 minor (×k = 10^19), the residual is still 0. DR-01, DR-06, DR-07 and DR-25 all pass, so B never detects it, and each genuine payout can be redirected up to the daily limit, every day, until [X] merchant complaints arrive.
  Variant: value 10^21 wei (1000 USDC). The residual is 0 while Rout is claimed at the chain value, and becomes −(10^21 − 10^19) = 990 USDC only after T4. Detection is then bounded by the A_post age (15 min), not the ~120 s.
  The same applies to case returns: the disposition's returnDestination and returnAmount are not compared.
  Under D, a token that isn't bound to payloadHash doesn't prevent this. The monitor already holds every input needed to close the gap: recompute payloadDigest from the final tx's `to` and value plus the signing-log instructionId, and require it to equal the CBS approval's payloadHash (case return: `to` = returnDestination and value = returnAmount×k).
  Blocking: it is a design-rule gap in the ADR's core reconciliation join, against the threat the ADR exists for (T-E2, :10). The G1 decision table (:72) tells the decider that B covers it, and no residual names it as a monitor gap.
- C-2 · ADR-008:102 "The CBS must offer the read operations in CF-5(f) and CF-5(h) (Q-C18)" vs :22 "(CF-5(f), CF-5(h), **CF-5(i)**, Q-C18)" and :96 "Blocked until: CF-5(f), CF-5(h) and CF-5(i) exist"; THREAT_MODEL:140 "Needs CF-5(f); can't run until then" and :176 residual 6, with no "ahead" note in ADR-008 for these (the :3 note names only B9 wording) · internal consistency, MC-45 + MC-40 version clause · REAL · minor. The Consequences section omits a prerequisite that the pilot row makes blocking, and the TM's DR-01/residual 6 prerequisite list is stale against the newer ADR with no ahead note or CF routing (CF-10 covers B9 and the monitor section, not §D DR-01 or residual 6).
- C-3 · ADR-008:27-28 subject rows enumerate "Adapter logs and telemetry, the adapter's local nonce, its screening and monitoring requests" and "in-flight items (Rin, Rout, Rmove), accumulators (D, F), the index, registry rows, the adapter's journal list". These are used but not enumerated: :61 RD-01 "Adapter's configured `p`" (configuration, not store); :46 DR-07 "itemised G5/G4 items" (held items in HELD_IN_CLEARING, SUSPENSE and fallback outbound, which are none of Rin/Rout/Rmove); :49 DR-13 "Adapter's move records" (all moves, wider than Rmove, which is final-but-unposted only, CONTRACT §5.7); :86 "the adapter's PAUSE flag" · MC-40(e) "every input is in that executor's declared input set (ADR-008 input model)" · REAL · minor. All four are subject inputs, so independence is unaffected. But the declared set and the map disagree, and MC-40(e) is mechanical.
- C-4 · ADR-008:35 "Registry rows: against `listIssuedAddresses` and Treasury's list." The ADR doesn't say where the wallet set S comes from: the set the own-node balance fetch, log fetch, nonce check (DR-12) and `eth_getCode` (DR-14, "every bank EOA") iterate over. Nor does it say whether the registry comparison is two-way · MC-40(b) "a compromised version of the checked component can write neither the detection's reference inputs nor its scope" · REAL · minor. Re-trace: a compromised adapter deletes registry row W (an issued collection address). If S = the adapter's registry, deposits to W fall under CONTRACT §5.0 rule 4 ("not ours. Ignore it"), W's balance leaves S, no Rin is claimed or reconstructed, and the residual is 0, so customer deposits go uncredited and undetected. If S = listIssuedAddresses ∪ Treasury's list (both already reference inputs, :22-23), then W's balance and logs are in S, Rin is reconstructed from the own fetch with no CBS T1, the residual is non-zero, and the monitor PAUSEs. One sentence fixes it. The R2 report PASSed this by reading S into :31; the current text doesn't state it.
- C-5 · ADR-008:69 "within `A_cycle` … of finality, plus up to `A_attest` … so **at most about 120 s**" vs :76-77 preconditions · JL-1 claim accuracy · DISMISSED. The recomputation above gives ≤ 90 s under the plain reading (preconditions checked at issuance), so the stated bound is a safe upper bound. Only a non-natural reading (freshness at cycle finish) gives 150 s. Advisory: say "A_fresh is measured at issuance".
- C-6 · ADR-008:52 DR-17 subject "The screening path (called by the monitor)" vs THREAT_MODEL:156 mutant "Screening is wired to a stub" · MC-40(a) · DISMISSED. DR-17 is mapped to T-B1 (THREAT_MODEL:106, "A screening provider returns a false or stale CLEAR"), which is a provider-side sub-risk. The monitor calling the provider with its own identity exercises exactly the provider-side mutant, which MC-40(a) requires. A stub in the adapter's own client wiring would not be a T-B1 instance, and it surfaces in DR-22 (:56) as a missing CBS screening record for the subject.
- C-7 · ADR-008:44 DR-01 subject "—" vs THREAT_MODEL:140 "a **move** is an entry whose `to` is on Treasury's bank-owned list (DR-24) **and matches a move record**" · MC-45 · DISMISSED. THREAT_MODEL's DR-01 input column (:140, "CBS instruction, approval and disposition records; Treasury's list") is identical to the ADR row's reference column. The move-record join is adapter-side and is carried by DR-13 (:49) in the ADR map. A move to a Treasury-listed wallet keeps funds in the bank.
- C-8 · ADR-008:22 labels "the CBS's own monitoring and screening records" as **Reference**, although their subject field is written via the adapter's own `screen` call (CONTRACT:159) · MC-40(b) · DISMISSED. For DR-22's named mutant (a U4 bug that attributes from `tx.from`), the buggy component can't make the CBS record disagree with its own attribution. The decisive reference is the monitor's own log fetch (:56), and the scope is the monitor's own (THREAT_MODEL:160).

PROBE G (would the rubric wave through a bad version?): YES. C-1 is found only by judgment (JL-1). MC-17 (code) asks that every outflow "matches exactly one instruction or move and one signer signing-log entry", and MC-40(b)/(e) ask that inputs be reference and declared. An ID-only join satisfies all three, so a version with no content binding passes every mechanical item. Proposed (cut-off rule RUBRIC:163, so this goes to the next rubric revision; not counted here): MC-17/MC-40 "an outflow join binds content. The checker recomputes payloadDigest from the final transaction's `to` and value and the instructionId, and compares it with the CBS approval's payloadHash (case return: the disposition's destination and amount). Matching on IDs alone does not pass." Routed to P1-rubric.

PROBE F (would it fail a good version?): YES, partly. MC-40(e) "every input is in that executor's declared input set" read literally requires every **subject** input to be enumerated. A good ADR that declares subject inputs by category ("any record in the adapter store or config, read-only, never evidence") would fail, even though subject inputs carry no evidential weight. Proposed: "every **reference** input is enumerated in the declared set; subject inputs may be declared by category, provided none is used as evidence." D3 is still counted, because this ADR chose enumeration and its own enumeration is incomplete. Routed to P1-rubric.

DEFECTS:
- D1 · ADR-008:33-34 (reconstruction join), :69 and :72 (options B and D claims) vs CONTRACT:93, THREAT_MODEL:92, :174 · R, JL-1 + MC-45 backward + MC-40(a) · blocking
- D2 · ADR-008:102 vs :22, :96; ADR-008:3 ahead note vs THREAT_MODEL:140, :176 · R, internal consistency + MC-45 version clause · minor
- D3 · ADR-008:27-28 vs :46, :49, :61, :86 · R, MC-40(e) · minor
- D4 · ADR-008:30-35 (scope of S and direction of the registry comparison) · R, MC-40(b) · minor

Routed (not counted against this unit):
- P1-threat-model: T-T1 (:58) claims "[R] DR-06 (after the fact)", but a same-amount destination swap leaves DR-06 at 0 (C-1 re-trace).
- P1-risk-register: RR:37 3a and RR:85 RB-7 should list CF-5(i) for DR-01's case-return branch (RR is newer than the target).
- LEDGER: CF-5's list (a)–(h) at :37 should carry (i), not only the parenthetical in CF-9(d).
- P1-rubric: the Probe G and Probe F proposals above.

VERDICT: NEGATIVE (4 defects: 1 blocking, 3 minor)
