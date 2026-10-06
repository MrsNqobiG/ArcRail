VERIFICATION · lens: R (with candidate and probe sections, as in earlier rounds) · target: P1-risk-register (docs/RISK_REGISTER.md v3 after fix block 6, the Phase-1 close-out fix block, round 1) · commit: none (uncommitted working tree, no HEAD)

Snapshot verified: RISK_REGISTER.md sha256 48930790cea9523b747b073f7f5acfc07827306a110f927beaa71679b822523e (mtime 2026-10-05 14:55:28 +0200). It was unchanged from the start to the end of the pass. Run 2026-10-05 13:19–13:46 UTC.

Exit rule applied (operator, LEDGER 2026-10-05): a unit freezes when a pass finds zero BLOCKING defects; minor defects carry to the G1 packet.
- Blocking means money can be lost, misposted, or moved without the required control, or a fail-closed path is missing.
- Everything else is minor.

Guard rules followed by hand, because the hook isn't loaded in this session:
- Arc testnet (5042002) read-only RPC only. No signing or sending methods. No mainnet endpoint.
- No .env files or keys were read.
- No temp files were written. The drift tool wrote to /dev/stdout, and PDF text was extracted in memory.

Pinned at start (13:19:55 UTC, sha256 prefixes):
- THREAT_MODEL 4971e7c4 (header "v2 fix block 9", mtime 15:09, newer than the target)
- RUBRIC 62698867 (v2 fix blocks 1–12, mtime 14:58, newer than the target)
- CONTRACT d48f622c (fix I, 14:57)
- LEDGER aaf57367
- OPEN_QUESTIONS 01528f20
- SEQUENCES d3f68f8b
- G1_PACKET ebfaa55f
- GATES 8a7cc182
- constants e494e772
- PHASE2_SLICE_PLAN f5810a7d
- ADR-001 ee09a22e (fix 11, 14:57)
- ADR-002 fe254a6e
- ADR-003 58b98363
- ADR-004 176c0a38
- ADR-005 08cdf2fb
- ADR-006 8614d5fe
- ADR-007 05c75efb
- ADR-008 164d5277 (fix 7, 14:58)
- MANIFEST 1b8e9d32

Re-hashed at end (13:46:13 UTC):
- Changed: LEDGER → d8fe3330 (15:37), GATES → 6f8be479. New file: docs/STATUS.md (6aff9f5d).
  - In LEDGER, the P1-risk-register row and CF-40 still read as at the pin ("fix block 6 used … R11 pending"; CF-40 says RISK_REGISTER cites it as "CF-26").
  - STATUS.md:36 says "RB-1…RB-15", but the register has RB-16. Routed; not a target defect.
- Unchanged: every other file, including the target.

Version basis:
- The target names THREAT_MODEL v2 fix 8, CONTRACT v3 fix G, ADR-001/003 fix 9, ADR-008 fix 5 and RUBRIC v2 fix 11.
- THREAT_MODEL (fix 9), RUBRIC (fix 12), CONTRACT (fix I), ADR-001 (fix 11) and ADR-008 (fix 7) all have mtimes after the target.
  - Under the MC-40 label clause, deltas that those newer versions introduce are not target defects when the newer document declares itself ahead or LEDGER routes the fix.
  - THREAT_MODEL fix 9 declares itself ahead on DR-19 (CF-38(b)).
- Rubric items are run from RUBRIC on disk (fix 12), as verifier.md requires ("Run every item in docs/RUBRIC.md"). This follows R10's practice of applying rules that postdate the target.

CHECKS:
K1 KICKOFF §5 P1 item 3 (3–6 top entries, each with a detection; blind entries use [R]/[X]) → PASS.
  - Recounted: 6 `### RR-` entries; 26 sub-risks (1a–1c, 2a–2f, 3a/3d/3b/3c/3e, 4a–4d, 5a–5c, 6a–6e); 15 RB rows (RB-1…RB-10, RB-12…RB-16; RB-11 retired); 4 RD rows, each defined once.
K2 Live Arc facts the register relies on, re-derived 13:20–13:22 UTC against https://rpc.testnet.arc.io (read-only) → PASS.
  - eth_chainId 0x4cef52 = 5,042,002.
  - Head 65,631,911. eth_getLogs over 9,999 blocks → []; over 10,000 blocks → -32012 "requested range too large" (C-40, 2a).
  - eth_getLogs on 0xffff…fffe over 9,999 blocks → -32602 "query exceeds max results 2000" (C-41, 2a).
  - eth_call value 0 from C-55 0x7099…79C8 → -32603 "Blocked address" (C-57, RB-1/DR-11).
  - Control from a random fresh address 0x35f8…388d: value 0 → "0x"; value 1 wei → -32003 "revert: OutOfFunds" (C-57 note: the zero-value probe is required). The first control address, 0x1111…1111, holds a balance on testnet, so it answers "0x" at 1 wei. That is why a random address was used.
  - Latest header extraData 0x00000004a817c800 = 20,000,000,000 = baseFeePerGas (C-30/C-33; DR-16, RB-15).
  - 0x3600… decimals() = 6 (C-11).
K3 MC-21 shared method → PASS.
  - tools/source_drift.py sha256 5504b5e7…80e1 matches the version reviewed in P1-rubric-lensR-13. It writes a file only with `--out`, so it was run with `--out /dev/stdout`.
  - Result: 36 archives, integrity failures 0; 33 URLs, drifted 0, fetch errors 0.
  - The 2d input claim ("linked from the archived Arc pages in docs/sources/arc/") is confirmed: arc_references_usdc-system-events.md:121-122 and arc_tutorials_run-an-arc-node.md:28-30 link CHANGELOG.md and BREAKING_CHANGES.md.
K4 Units, by exact integer reconstruction (python, stdout only) → PASS.
  - p=6, k=10^12: 0→(0,0); 1→(0,1); k−1→(0,k−1); k→(1,0); 10^18→(1,000,000; 0); 1,000,000,500,000,000,000→(1,000,000; 5×10^11); 7,374,356×10^9→(7,374; 3.56×10^11); (2^63−1)k+k−1→(2^63−1; k−1). m·k+d = w on every row.
  - p=2, k=10^16: 10^18→100; 10^16−1→all dust; 7,374,356×10^9→all dust.
K5 MC-40 re-trace of the §RD rows →
  - RD-01 PASS. 10^18 wei at adapter p=6 gives m=1,000,000, which a CBS at p=2 shows as 10,000.00. The tag says 2, not 6 → PAUSE before posting (CONTRACT §1.1:33). Executors: THREAT_MODEL:80 and :83, ADR-008:76.
  - RD-02 PASS ([X], supplementary).
  - RD-03 PASS on the mutant. Hot 10^20, gas 10^19, move X = 5×10^18 with 420,000 gwei of gas, T6 posted twice → per-role residuals hot +5×10^18, gas −5×10^18, aggregate 0. The PAUSE is tracked as CF-5(b) (CONTRACT §5.7:471 is still "per-role diagnostic"), with G1 residual RB-12. [inspection-only] The executor is named in THREAT_MODEL:80 (monitor) and ADR-008:77, not in the RD row.
  - RD-04 PASS (K3).
K6 MC-40(a) and MC-41 for every blind sub-risk →
  - PASS: 1a; 1b; 1c; 2a; 2b; 2c (re-traced: an internal move booked as T2 → residual −5×10^18 → PAUSE); 3b; 3c ([P] MC-23 counts as [R] because the drain needs a signer shape-rule bug; EIP-3009 emits no Approval, so DR-14 and DR-15 are not relied on for it); 4a; 5a and 5b (non-money; cadence "at each gate"); 6a; 6c; 6d.
  - Backed by residuals, each naming what closes it: 2e, 2f, 3a, 3d, 6b and 6c → RB-7; 3e → RB-13; 4b → RB-12; 6e → RB-10.
  - **2d PASS** (R10 D-36 closed). The [X] has an owner (Engineering, which owns the DR-27 list, THREAT_MODEL:219), a cadence, an input (K3) and an action. The cadence is event-driven, so 2d is listed as residual RB-16, which follows the MC-40 [X] money-age clause.
  - **FAIL 4d** (D-40). It relies only on an event-driven [X] and is not a residual, although the register treats the same cadence shape as a residual for 2d.
K7 MC-40(b)–(f) for the relied-upon detections → PASS.
  - Monitor detections have the monitor as executor (THREAT_MODEL:80), PAUSE through the attestation, and the signer stops when the attestation goes stale (ADR-001 item 5).
  - DR-20 runs in the egress proxy, which fails closed.
  - DR-27 refuses to start on a digest mismatch.
K8 MC-43 for 5a–5c → PASS.
  - The 5c quote "The SARB is thus unlikely to consider foreign currency-pegged stablecoins as payment instruments for domestic transactions" was re-extracted in memory from the SARB archive (whitespace-normalised). It sits between "4.5.2 Stablecoins" (offset 6128) and "4.5.3" (offset 6881), so the ¶4.5.2 pinpoint holds.
  - MANIFEST:45-46: the SARB archive is present; POPIA is "text not extractable"; Schedule 1 and the FIC Act are absent. This matches 5b.
K9 MC-44 references, by script →
  - Resolve: 22 DR ids, each defined once in THREAT_MODEL §D; 21 Q ids (topics checked for Q-A2, A16, C10, C19, D4, D9); 12 MC ids; 20 T-/L- ids; C-26/27/41/57/64; M-1/M-9; CF-5(b),(e)–(i); CF-24; THREAT_MODEL residuals 4 and 6–13; U4 "unknown-event quarantine" (KICKOFF:136, cited by RB-16).
  - **FAIL:** "CF-26" (4 citations) resolves to an unrelated item (D-39).
K10 MC-45 and the MC-40 label clause →
  - THREAT_MODEL residuals 1–13 map per sub-risk exactly as in R10 K10. The text of residuals 1–13 is unchanged in fix 9 apart from T-I3's scope.
  - The target's ahead note on 4b/RB-12 and 2d/RB-16 is acknowledged by THREAT_MODEL:19 and routed as open LEDGER CF-40 → PASS on the label clause. R10 D-35 is closed in substance (see D-39 for the number).
  - 3a lists CF-5(f), (h) and (i), the same as DR-01 at THREAT_MODEL:194. R10 D-34 closed.
  - 3e has the hold, settlement and inbound-credit paths, the same as T-T7 at THREAT_MODEL:145. R10 D-37 closed, but see D-43.
  - RB-14 labels follow each threat: T-I2 [I] (residual 10), T-I3 [X], T-B1 [X], T-SC2 [X]. T-T6 has moved to RB-9. R10 D-38 closed.
  - **FAIL:** RB-7's damage bound (D-41). **FAIL:** the bounds of RB-10 and RB-14 (D-42).
K11 Fix-block-6 checklist (LEDGER P1-risk-register row: CF-5(h) in 3a; ahead note and CF-40; 2d [X] fields and RB-16; 3e per T-T7; RB-14 per threat) → all applied. The CF number is wrong (D-39).
K12 Judgment lenses [inspection-only]:
  - JL-1 PASS. Every blind path either has a PAUSE or quarantine detection or is a named G1 residual. On a hard fork, a pinned node stalls → `A_stall` PAUSE (CONTRACT §1.6:147, §5.8:521), or DR-02 disagreement → PAUSE.
  - JL-2 PASS. Top-six entries have owners.
  - JL-4 PASS.
  - JL-6 PASS.
K13 Code-phase items (MC-01/02/05/07/08/14–16/18–20/22–25/30–34/42/48) → N/A for a Phase 1 document. Mutant reasoning is in K4–K6.

CANDIDATES:
C-A · RISK_REGISTER.md:9 "Both are routed as LEDGER **CF-26**", and the same at :34, :93 and :97. LEDGER:100 CF-26 is "CONTRACT §1.6 and ADR-008 … two-person QUARANTINE resolution …". LEDGER:70 CF-40: "RISK_REGISTER fix 6 cites this item as 'CF-26' … the risk-register unit renumbers its citations at its next fix block" · MC-44 · **REAL (minor)**. The reference doesn't resolve to text that says what the register claims. LEDGER's alias note reduces the confusion but doesn't make the reference correct.
C-B · :53 4d "[X] Consumer-driven contract tests … **cadence** every CI run and every CBS release" (blind, only [X], no residual) vs :34 2d "Because this cadence is event-driven, not tied to the age of the money (MC-40 [X] clause), 2d is G1 residual RB-16". Also :9 "Every blind sub-risk has an [R] or [X] detection valid under MC-40, or is listed as a G1 residual", and RUBRIC:81 "for a sub-risk that protects money it must be no slower than the age of that money, or the sub-risk is a residual" · MC-40 [X] clause → MC-41 · **REAL (minor)**.
  - RR-4 protects money, and the cadence has the same event-driven shape the register itself rejects for 2d.
  - Not blocking: the money effects of CBS drift (duplicates, unit change, ambiguous outcomes) fail closed through DR-07 itemisation, RD-01 and DR-06 (CONTRACT §5.7:498, §1.1:33).
C-C · :90 RB-7 lists "swaps an account mapping (2e), misattributes a relayed deposit (2f), or leaks through paths DR-20/DR-21 can't yet see (6b, 6c)", with "Why below cut-off: The signer's per-transaction and daily limits … cap the damage" · MC-45 ("a residual that cites a cap as its damage bound is checked against that maximum") · **REAL (minor)**.
  - The signer caps bound only signatures (ADR-001:22). A wrong-customer credit (2e) is a CBS posting, and a relayer misattribution (2f) affects screening and travel-rule subjects. Neither involves a signature. The 6b/6c disclosures are privacy harms that no cap bounds.
  - Not blocking: the misposting path of 2e is the same "inbound credit on an uninvolved customer's account" that 3e/RB-13 states honestly ("[X] Customer statements and complaints only"), with the preventive CBS binding (Q-C19). So the human at G1 still sees the true exposure.
  - THREAT_MODEL residual 6 (:232-235) carries the same "signer limits cap the damage" wording for T-T2. Routed.
C-D · :92 RB-10 "Encryption at rest and access logging (U5) limit the exposure"; :95 RB-14 "secret-store custody of the xpub … HSM-held, never-exported attestation key …" · MC-45 ("Every preventive control that a G1 residual relies on as its bound names its configuration source and human owner, outside the threat's compromise domain"; RUBRIC register row 57, fix 12) · **REAL (minor)**.
  - Neither row names an owner or configuration source. THREAT_MODEL:128 names "Owner: Security" for T-I2.
  - RB-10's "access logging (U5)" sits in the adapter's own domain (U5 is the registry unit, KICKOFF:137), and differs from THREAT_MODEL residual 9 "access review" (:238).
  - Privacy only, so minor.
C-E · :45 3e "the CBS binds every customer-account leg (hold, settlement, inbound credit) to its own **instruction or issuance record**" vs CONTRACT:200 "T11 carries `assignRef`, the `ASSIGN` disposition …" and RUBRIC MC-17(b) "(payout instruction, issuance record, case disposition)". Also :35 2e cites no preventive control and doesn't point to 3e/RB-13, although CONTRACT §3 binds T2's account to the issuance record (Q-C19) · MC-45 / MC-17(b) wording · **REAL (minor)**.
  - The T11 credit to G1 binds to the CBS's disposition record, which the 3e text omits. DR-29 covers T11 (THREAT_MODEL:222), so no detection is missing.
C-F · :65 6a "[R] DR-19 (in the monitor; …)" vs THREAT_MODEL:212 (fix 9) "Two parts, each with its executor … (2) CI and deployment pipeline, before every deploy" · MC-40(e) and (c) planted-artefact clause · DISMISSED for this unit.
  - THREAT_MODEL fix 9 (15:09) is newer than the target (14:55), declares itself ahead (:19), and LEDGER routes the register's edit as open CF-38(b).
  - Part (1) still runs in the monitor with the action the register quotes, so the register's statement is true of part (1). Carried as a tracked item for the next register fix block.
C-G · :95 RB-14 T-I3 "the honeytoken and canary lists or the attestation key" vs THREAT_MODEL:129 (fix 9), where T-I3 now also covers the database engine's row-level audit log and its configuration · label clause · DISMISSED for this unit; the sibling is newer.
  - THREAT_MODEL:19 says it is ahead of the register "only on DR-19's split". That "only" claim misses the T-I3 widening. Routed to P1-threat-model.
C-H · :97 RB-16 "unknown events are quarantined (U4)" · MC-44 · DISMISSED.
  - KICKOFF:136 U4 has "unknown-event quarantine". [inspection-only] A moved emitter (the Zero5 shape) would be filtered out rather than quarantined. Its money effect, an unexplained balance rise, still fails closed through DR-06 and DR-10, so no fail-closed path is missing.
C-I · :13-17 "Derived from" names CONTRACT fix G, ADR-001 fix 9 and ADR-008 fix 5, while CONTRACT fix H, ADR-001 fix 10 and ADR-008 fix 6 already existed at 12:20–12:21 (R10 header), before fix block 6 (14:55) · MC-40 label clause · DISMISSED.
  - The clause requires claims to be compared at the named versions, not at the newest one. No register claim is falsified by those versions; the 3e and 3a claims were re-checked against CONTRACT fix I and DR-01.
  - ADR-001:37 ("DR-01, which can't run until … CF-5(f)") and :33 ("RISK_REGISTER 2c/3a/3b") are stale against the register. ADR-001 is newer (14:57), so this is routed to P1-adrs, as in R10.
C-J · 3c "Off-chain signature drain (EIP-3009, …)" lists DR-14 and DR-15. Neither catches an EIP-3009 `transferWithAuthorization` drain, which leaves no Approval log, no code and no nonce use on our EOA · MC-40(a) · DISMISSED.
  - 3c relies on [P] MC-23 (a bug in the signer's shape rule; money-path item 4, mutation-tested), which counts as [R] under MC-41. DR-06 and DR-13 also catch the unbooked outflow.
C-K · :93 RB-12 "Why below cut-off: Rmove is itemised (CONTRACT §5.7)" · MC-45 bound clause · DISMISSED.
  - CF-5(b) is a Phase 1 document edit (MC-40(f) needs no residual row for it), and a duplicate T6 moves value only between G2 sub-accounts. The bank-wide total is unchanged and no customer is affected. Listing the residual is conservative.

PROBE G (would the rubric wave through a bad version of this register?): Yes.
- MC-45's cap-bound clause re-traces a residual's cited cap against "that maximum". A residual row that groups sub-risks of different harm types can cite a bound that applies to only some of them (C-C) and still pass if the verifier traces the cap against the outflow sub-risks only.
- Patch: "A residual row that groups several sub-risks states its bound per sub-risk, and each bound is re-traced against that sub-risk's own harm (outflow, misposting or disclosure). A bound that doesn't act on a sub-risk's harm counts as no bound for it."

PROBE F (would it fail a good version?): Yes.
- MC-44 fails a citation that LEDGER itself explicitly aliases at the cited number (LEDGER:100 → CF-40), even though a reader is sent to the right item in one step.
- Reword: "A reference that LEDGER explicitly re-maps at the cited ID, naming the correct item, passes until the citing unit's next fix block."
- (The event-driven [X] cadence point behind C-B is already queued from R10 Probe F, LEDGER:53. It isn't repeated.)
- Both proposals go to the rubric queue and are not defects.

REGRESSION (spot): P0-constants (constants.md e494e772, unchanged). C-01, C-11, C-30/C-33, C-40, C-41 and C-57 (with its 1-wei control) were re-derived live in K2. No regression.

Prior defects (R10):
- D-34 CLOSED.
- D-35 CLOSED in substance: an ahead note and routing exist, but the CF number is wrong (D-39).
- D-36 CLOSED.
- D-37 CLOSED.
- D-38 CLOSED.

DEFECTS:
D-39 · docs/RISK_REGISTER.md:9, :34, :93, :97 ("CF-26") · R, MC-44 · minor.
  - Fix: replace with "CF-40", as LEDGER:70 requires at the register's next fix block.
D-40 · docs/RISK_REGISTER.md:53 (4d relies on an event-driven [X] only and is not a residual), with :9 ("Every blind sub-risk has … or is listed as a G1 residual") · R, MC-40 [X] clause → MC-41 · minor.
  - Fix: list 4d as a G1 residual, like 2d/RB-16, until the rubric adopts the event-driven cadence rewording (queued R10 Probe F). Or tie the contract-test cadence to the money age.
D-41 · docs/RISK_REGISTER.md:90 (RB-7 cites signer limits as the damage bound for 2e, 2f, 6b and 6c, which the limits don't bound) · R, MC-45 cap-bound clause · minor.
  - Fix: state the bound per sub-risk. Keep the signer limits for 3a and 3d. For 2e, point to the CBS binding (Q-C19) and RB-13. For 2f, state "no bound; screening subject only". For 6b and 6c, state "none (disclosure)".
  - Route the same wording in THREAT_MODEL residual 6 to P1-threat-model.
D-42 · docs/RISK_REGISTER.md:92 (RB-10) and :95 (RB-14): the preventive controls cited as bounds name no configuration source or human owner, and RB-10's "access logging (U5)" sits in the adapter's domain · R, MC-45 (register row 57) · minor.
  - Fix: name the owners (for example Security for xpub custody, the attestation key and the DB encryption keys), and use THREAT_MODEL residual 9's "access review" wording.
D-43 · docs/RISK_REGISTER.md:45 (3e "instruction or issuance record" omits the case disposition record that binds T11) and :35 (2e cites no preventive control and no link to 3e/RB-13) · R, MC-45 / MC-17(b) · minor.
  - Fix: "… to its own instruction, issuance or case-disposition record …". Add to 2e: "Preventive: CBS binding of T2's account to its issuance record (CONTRACT §3, Q-C19); see 3e/RB-13".

Routed out of the unit (not counted):
- THREAT_MODEL residual 6, "signer limits cap the damage" for T-T2 (see D-41) → P1-threat-model.
- THREAT_MODEL:19's "only on DR-19's split" misses the T-I3 widening (C-G) → P1-threat-model.
- Tracked for the next register fix block: CF-38(b) (6a/DR-19 split by executor).
- ADR-001:33 and :37 are stale register mappings → P1-adrs.
- STATUS.md:36 "RB-1…RB-15" (the register has RB-16) → whoever maintains STATUS.
- Probes G and F → P1-rubric queue.

VERDICT: NEGATIVE (5 defects: 0 blocking, 5 minor). Under the operator's Phase 1 exit rule (zero blocking → freeze), this unit qualifies to FREEZE, and D-39 to D-43 carry to the G1 packet.
