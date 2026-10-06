VERIFICATION · lens: R · target: P1-adr-008 (docs/adr/ADR-008-independent-monitor.md, mtime 2026-10-03 11:44:08, sha256 b029fc11feb02e08…, after fix block 3) · commit: none (uncommitted working tree; `git rev-parse HEAD` → "unknown revision", repo has no commits)

Snapshot for MC-45 version ordering. Siblings were edited **during** this run; the target was not.
- Older than the target: SEQUENCES 10-02 23:23 · ADR-003 11:08:36 · RISK_REGISTER 11:34:41 · ADR-001/ADR-002/OPEN_QUESTIONS 11:41:55 · RUBRIC 11:42:21.
- Target: ADR-008 11:44:08.
- **Newer than the target:** THREAT_MODEL 11:45:44 (fix 3) · LEDGER 11:45:44 · CONTRACT 11:48:25 (fix D).
Under the MC-40 version clause, a disagreement with a newer sibling that doesn't say it is ahead counts against the sibling, so it is routed, not counted here.

CHECKS:
- ADR rule: options, trade-offs, recommendation → PASS. 4 options A/B/C/D counted at :70-76. Trade-offs are in the table (RUBRIC:91 relaxation).
- ADR rule: per-phase recommendation (RUBRIC:92) → PASS. Testnet/pilot/GA rows at :99-101. Pilot blockers are named (:100).
- ADR rule: prose agrees with phase table (RUBRIC:93) → PASS. Consequences :104-106 assume B or D, which matches every row.
- KICKOFF §5 Phase 1 item 4 "Do not decide" → PASS (:3 "Status: PROPOSED. A human decides at G1.").
- KICKOFF U12 (KICKOFF:144) → PASS. The quote at :13 is faithful. Three-way is kept (:41), and so is two-human unpause (:90).
- KICKOFF §6 (KICKOFF:168-171, :183) → PASS. Separate identity and credentials (:72), a mutually authenticated channel (:86), and controls on the monitor's copy of address↔account links (:93).
- CLAUDE.md "fail closed … pages a human" → [inspection-only] FAIL. The protocol is sound (:87-89), but the monitor never ages claimed in-flight items, so a compromised adapter can hold a posting gap open forever with residual 0 (D1).
- MC-21 → PASS (N/A). A grep of ADR-008 for hex literals, gwei, RPC codes and 4+-digit numbers returned nothing (exit 1).
- MC-43 → PASS (N/A). The only regulatory reference (POPIA PIA, :93) is routed to Q-R12.
- Fix-block-3 recount vs LEDGER:29 → PASS, 6/6 located:
  · content binding → :33-36;
  · S from reference inputs → :38;
  · two-way registry check → :39;
  · adapter inputs by category → :28;
  · CF-5(i) consistency → :3, :22, :100, :106;
  · freshness at issuance → :79.
- R3 defects re-traced:
  · D1 → FIXED for option B, end to end. :34 plus THREAT_MODEL:153 DR-01 now bind content. Recomputed with p=2, k=10^16, A=1000 minor, w=10^19 wei:
    - approval digest(w, M, I) = ba09df4de35dbbd4…;
    - redirect digest(w, X, I) = cb36b7dd1a698b4d…;
    - overpay digest(10^21, M, I) = 3418888f05474067…;
    - each ≠ the approval digest → PAUSE.
  · D1, option-D part → NOT FIXED (see D2).
  · D2 → FIXED (:106; LEDGER:45 CF-5(i)).
  · D3 → FIXED. All 19 map subject entries resolve to :25, :27 or :28.
  · D4 → FIXED (:38, :39).
- MC-40(e) declared input set → PASS. Every reference input in the :48-66 map is in :21-26. Every subject input is in :25, :27 or :28.
- MC-40(b) scope → PASS for S (:38) and the registry (:39). Advisory on Rout-scoped binding: see C-6.
- MC-40(f) → PASS. The signer enforces it (:74, :87), and the adapter never relays (:86).
- MC-12(b), new ages A_attest/A_cycle/A_fresh → PASS. They are bounded, and expiry gives no ALL_CLEAR, so the signer refuses. They are not yet in Q-C17 (OPEN_QUESTIONS:56), which CF-9(c) tracks.
- MC-12 rule for money final on-chain but not yet posted (Rin, Rout, Rmove, D/F ≥ k) → FAIL, see D1. The §5.8 PAUSE expiries (CONTRACT:452, :474, :476) run only in the adapter. The ALL_CLEAR preconditions (:79-83) contain no age test, and the adapter is the attacker in ADR-008's threat model.
- Stop window (:73 "at most about 120 s"), recomputed with integers → PASS. A fabricated tx is final at t0 = 0. The last ALL_CLEAR built on a pre-t0 fetch must be issued before 0 + A_fresh = 30 s, and it is honoured until before 30 + A_attest = 90 s. 90 ≤ 120, so the stated bound is conservative. This holds only for items DR-01 sees, not for D1's scenario.
- MC-44, reference by reference:
  · :3 threat-model R5 D1 blocking → P1-threat-model-lensR-5.md:90 → PASS
  · :7-10 → THREAT_MODEL T-S1/T-T2/T-E1/T-E2 rows → PASS
  · :12 RR-3, RR-2 2e → RISK_REGISTER:34-40, :31 → PASS
  · :14 CLAUDE.md quote → PASS
  · :21 L-3 → PASS
  · :22 CF-5(f)/(h)/(i), Q-C18 → LEDGER:45, OPEN_QUESTIONS:57 → PASS
  · :23 DR-24 → PASS
  · :33 "verifier R3 D1" → P1-adr-008-lensR-3.md:91 → PASS
  · :34 CONTRACT §1.3 payloadDigest → CONTRACT:93 → PASS
  · :37 ADR-001 duty 6 → ADR-001 item 6 (per-move and daily caps) → PASS
  · :85 A_post → CONTRACT §5.8 → PASS
  · :90 CONTRACT §1.6 / SEQUENCES F7 / CF-9 → PASS (ahead, CF-9(a); CONTRACT:125 still "(U12)")
  · :93 L-2, L-8, DR-26, Q-R12 → PASS
  · :100, :110 Q-D1 (c)/(d) → OPEN_QUESTIONS:84 → PASS on resolution (coverage is D5)
  · **:105 ADR-001 "readable by U12 directly" → FAIL**. A grep of ADR-001 finds no match. ADR-001:14 (11:41:55, older than the target) already says the log is pushed with instructionId. See D3.
  · :109 Q-D8, JL-5 → PASS
- MC-45 forward vs RISK_REGISTER (older) → PASS. RR 3a and RB-7 list only CF-5(f)/(h), which the :3 ahead note covers.
- MC-45 forward/backward vs THREAT_MODEL (newer) → routed, not counted (C-7, C-8).
- MC-45 ADR-to-ADR → PASS:
  · ADR-001 duty 5 (:12, "Reject stale, out-of-sequence or PAUSE attestations") = :87;
  · ADR-001 duty 6 = :37;
  · ADR-002:31 monitor segment = :72.
- MC-45 Q-D mirror → PASS (OPEN_QUESTIONS:84, :91).
- MC-45 cited Q-ids exist → PASS (Q-C17, Q-C18, Q-D1, Q-D8, Q-R12).
- MC-45 vendor-question coverage of signer-side controls → FAIL, see D5.
- MC-45(d) dependencies fail closed → PASS (:88 input loss; :87 dead-man; :90 flag unreadable → PAUSE).
- MC-19 design → PASS (:90 two humans).
- JL-1 Fail-closed → [inspection-only] FAIL (D1, and D2 for the option-D claim).
- JL-2 Human-owned → [inspection-only] PASS. The ages are "proposed" and routed to Q-C17 (:85, :111).
- JL-3 03:00 operability → [inspection-only] FAIL (minor), see D4.
- JL-4 Auditability → [inspection-only] PASS. Advisory, carried from R2: retention of attestation history.
- JL-5 Fewest new parts → [inspection-only] PASS (Q-D8).
- JL-6 Privacy → [inspection-only] PASS (:93).
- MC-01…08, 10, 11, 13–20, 22–24, 30–34, 42, 46–48 → N/A. The ADR has no amounts, templates, keys, state tables, events or code.
- Regression check of frozen units → N/A by recount. LEDGER:22-33 lists 12 units, 0 frozen.

CANDIDATES:
- C-1 · ADR-008:82 "the residual was exactly 0, and every claimed item was reference-supported"; :41 "A compromised adapter that adds a fabricated in-flight payout to make a theft balance gains nothing"; :90 the adapter's own PAUSE conditions run in the adapter. CONTRACT:474 "Final status 1, settle not OK (Rout, Rmove) | `A_post` 15 min | PAUSE" (also :452 Rin and :476 D/F) is an adapter state-machine expiry. Neither "age" nor A_post appears in the preconditions (grep). · MC-12 (money final but not posted must expire to PAUSE), MC-40(e) (adapter-compromise checks can't run in the adapter), JL-1 · **REAL**.
  Integer re-trace:
  · p=2, k=10^16. Customer C (attacker-controlled or colluding) has G1 = 1000 minor.
  · Genuine instruction I1 pays 1000 minor to X (C's own external address), with a genuine CBS approval of digest(10^19, X, I1). Hold H1 is placed.
  · The tx is final: value 10^19 wei, gas 21,000 × 20 gwei = 4.2×10^14 wei (< k, so it stays in F).
  · The compromised adapter never posts T4. It keeps I1 in its claimed Rout and calls `releaseHold(H1)`. In fallback mode it posts the T5 fallback instead: DR-07 joins it by key, and the itemisation accepts it once the adapter marks the item RELEASED.
  · Monitor each cycle: chain Δ = −10^19 − 4.2×10^14. RHS Δ = 0·k − 4.2×10^14 (F) − 10^19 (Rout). Residual 0 (computed).
  · The Rout item is fully supported: receipt status 1, signing-log entry, CBS instruction, CBS approval, digest equal, destination and amount equal. DR-25 sees one tx per approval. DR-07 has no journal in hold mode. → ALL_CLEAR.
  · C repeats. After n = 30 payouts the claimed Rout is 3×10^20 wei and the residual is still 0. The loss is n × 10 USDC, bounded only by the signer's daily limit, every day.
  Fix: an ALL_CLEAR precondition that no claimed Rin/Rout/Rmove item is older than its §5.8 age, measured from the finality block timestamp in the monitor's own fetch (D/F ≥ k against A_batch). The loss then drops to one payout. Blocking: it is a theft path for the exact attacker ADR-008 exists for, and it contradicts :41.
- C-2 · ADR-008:73 D: "**Before** signing: the monitor checks the CBS instruction and approval for **each** payout and co-signs a per-transaction token the signer requires"; :76 D "**Prevents** it". The text is unchanged from what R3 C-1 flagged ("Under D, a token that isn't bound to payloadHash doesn't prevent this"). · JL-1 claim accuracy, residue of R3 D1 (whose location included the option-D claims) · **REAL** · Q-C10 is open, so the signer can't verify the assertion.
  · The monitor checks that instruction I and approval I exist, then co-signs a token for I.
  · The adapter then submits w to X under that token, with a forged digest cb36b7dd….
  · Nothing in the ADR says the token commits to the approval's digest ba09df4d…, or that the signer compares it with the digest it recomputes from the tx (ADR-001 duty 1). The signer therefore signs, and D only *detects* after finality, exactly like B.
  Minor, because B is the recommended option and D is "consider".
- C-3 · ADR-008:105 "That changes ADR-001's "readable by U12 directly" into a push, and adds `instructionId` (CF-9)" vs ADR-001:14 "pushes each entry to the independent monitor … `(payloadHash, nonce, txHash, instructionId)`". A grep of ADR-001 for "readable by U12" returns no match. · MC-44 · **REAL** · ADR-001 (11:41:55) is older than the target (11:44:08), so the target carries the stale quote. The CONTRACT part of CF-9(b) is still open (CONTRACT:211 has the 3-tuple). Minor.
- C-4 · ADR-008:90 "the monitor still reads the adapter's PAUSE flag … every cycle and treats "flag set" or "flag unreadable" as PAUSE … Unpausing means two humans instructing the monitor" · JL-3 [inspection-only] · **REAL** · After a two-person unpause at the monitor, the adapter's flag is still set, so the monitor keeps issuing PAUSE.
  · No text says who clears the flag, or how.
  · No monitor→adapter channel is declared: attestations go to the signer only (:86).
  · A separate adapter-side unpause would contradict "single place".
  It fails closed, but the on-call engineer can't find the exit. Minor.
- C-5 · ADR-008:100 "Q-D1 (c) … and (d) (attestation required) are both answered yes"; OPEN_QUESTIONS:84 (d) "**require the monitor's fresh `ALL_CLEAR` attestation** before signing". The ADR requires these signer-side controls (:87, ADR-001:12): rejecting equal or lower sequence numbers, PAUSE overriding an unexpired ALL_CLEAR, the monitor key in the signer's own trust store, and a direct mutually authenticated channel (:86). · MC-45 "Every vendor-qualification question … covers every signer-side control the ADR requires" · **REAL** · "Fresh ALL_CLEAR" covers only staleness. A custodian answering (d) yes could keep honouring a prior ALL_CLEAR after a PAUSE, for up to A_attest = 60 s more. That widens the computed 90 s window to 150 s, which exceeds the stated "about 120 s". It could also accept attestations relayed by the adapter. Minor.
- C-6 · ADR-008:33-36: content binding is stated as a sub-rule of "Rout", and :36 says it "fails at the first reconciliation cycle after it is final". Rout is "final … but whose T4 … is not yet OK" (CONTRACT §5.7), and the adapter chooses when T4 posts. · MC-40(b) (the checked component controls the scope) · DISMISSED for this unit · Re-trace: redirect w to X under I1, then T4 one second after finality. Residual = (−10^19 − 4.2×10^14) − (−1000·10^16 − 4.2×10^14) = 0 (computed), and the item is never in Rout at a cycle. But DR-01, which the ADR assigns to the monitor (:48) and which THREAT_MODEL:153 (single source of truth, newer) now defines, "classifies every signing-log entry itself, and binds content". So digest cb36b7dd… ≠ ba09df4d… → PAUSE regardless of T4 timing. Advisory: say at :33-36 that DR-01 applies the binding to every final signing-log entry, and add own receipts to the :48 DR-01 row.
- C-7 · ADR-008:45 "Every detection THREAT_MODEL assigns to the monitor" (19 rows) vs THREAT_MODEL:46 (newer): 24 monitor detections. Diffed by script:
  · TM-only: DR-03, DR-04, DR-05, DR-08, DR-11, DR-16;
  · ADR-only: DR-20, now executed by Security's egress proxy (TM:49);
  · new reference input: the key-ceremony xpub (TM:39, DR-04), which is not in ADR :21-26.
  · MC-45, MC-40(e) · DISMISSED for this unit (version clause). THREAT_MODEL changed afterwards and says nowhere that it is ahead of ADR-008, and no CF routes the change to ADR-008. **Routed:** P1-threat-model (ahead note or CF item). ADR-008 needs a follow-up fix to add the 6 rows and the xpub input, and to drop DR-20.
- C-8 · ADR-008:3 "ahead of THREAT_MODEL and RISK_REGISTER on three points … (CF-10)" vs LEDGER:49 "CF-10, CF-11 · CLOSED by threat-model v2 Fix 3" · MC-45 · DISMISSED · The sibling changed afterwards. The note is still true for RISK_REGISTER (3a, RB-7). Routed as an advisory to the next ADR-008 block.
- C-9 · ADR-008:33 "(or, for a case return, the CBS case disposition)" leaves out the approval that CONTRACT:366 RET_AWAITING_APPROVAL obtains · MC-45 · DISMISSED · :35 binds `to` and value to the human disposition. Replay of a return is covered by the signer replay rule and by DR-25 over every `listApprovals` entry, and case-return approvals are among them.
- C-10 · ADR-008:59 DR-21 "registry identifiers hashed by the monitor": the source of the identifiers isn't named · MC-40(b) · DISMISSED · DR-21's mutant is a generator bug, not a registry edit, and `listIssuedAddresses` (:22) carries the accountRefs. Advisory: name it.

PROBE G (would the rubric wave through a bad version?): YES. Take C-1's version, where in-flight claims are reference-supported but never aged by the independent executor.
- MC-12 passes, because CONTRACT §5.8 has PAUSE expiries.
- MC-40(e) passes, because a §5.8 age is a state-machine expiry, not an [R] detection.
- MC-41 passes too.
Only JL-1 catches it. Proposed (cut-off rule, RUBRIC:163, so not counted here): MC-12(d): "for money final on-chain but not yet posted, the expiry is also enforced by an executor outside the adapter's compromise domain: a claimed item older than its age, measured from the reference finality timestamp, blocks the attestation." Routed to P1-rubric.

PROBE F (would it fail a good version?): YES, partly. MC-40(e) "the executor itself … sit[s] outside the threat's compromise domain", read without a phase qualifier, fails this ADR's testnet row (:99, monitor and adapter "may share a host"). That row is a good choice: testnet carries no value, and the purpose is to exercise the attestation path. I passed it by reading MC-40(e) as phase-scoped. Proposed: "MC-40(e) domain separation is required for mainnet pilot and GA. Testnet may co-locate, given separate identities and credentials, if the phase table says so." Routed to P1-rubric.

DEFECTS:
- D1 · ADR-008:79-83 (ALL_CLEAR preconditions), :41, :90 vs CONTRACT:452, :474, :476 · R, MC-12 + MC-40(e) + JL-1 · **blocking**
- D2 · ADR-008:73, :76 (option D token binding and "Prevents") · R, JL-1 claim accuracy (R3 D1 residue) · minor
- D3 · ADR-008:105 vs ADR-001:14 · R, MC-44 · minor
- D4 · ADR-008:90 (no exit for the adapter PAUSE flag) · R, JL-3 [inspection-only] · minor
- D5 · ADR-008:100, :110 vs OPEN_QUESTIONS:84 (d), ADR-008:86-87 · R, MC-45 vendor-question coverage · minor

Routed (not counted against this unit):
- P1-threat-model: TM:46/:49/:39 changed the monitor executor set and added the xpub input without an ahead note or CF item against ADR-008 (C-7).
- LEDGER: the P1-adr-008 status column (:29) still says "fix block 2 used" after Fix 3.
- P1-rubric: the Probe G and Probe F proposals above.

VERDICT: NEGATIVE (5 defects: 1 blocking, 4 minor)

Phase 1 · units frozen 0/12 · streak 0/3 · rounds used 4/10 (P1-adr-008) · regen budget left 1
