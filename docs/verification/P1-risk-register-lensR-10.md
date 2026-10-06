VERIFICATION · lens: R (with the candidate, probe and regression sections used in earlier rounds) · target: P1-risk-register (docs/RISK_REGISTER.md v3 after fix block 5), round 10 · commit: none (uncommitted working tree on main, no HEAD).

Snapshot verified: RISK_REGISTER.md sha256 b2eff1243c3f7e0511a4bb0d538723d33ec2344c647df4920aa052752b722340 (mtime 12:18:38 SAST). Run 2026-10-05 10:21-10:45 UTC.

Pinned at the start of the pass (10:21:15 UTC, sha256 prefixes):
- THREAT_MODEL 6799bd75 (v2 fix block 8)
- RUBRIC 4d86338d (v2 fix block 11)
- CONTRACT d2f72422
- LEDGER aa57dfc6
- OPEN_QUESTIONS 73ad9d4c
- ADR-001 ce0106ea
- ADR-003 58b98363
- ADR-004 43554bbf
- ADR-008 cbcb32de
- constants e494e772
- SEQUENCES 660310b6
- GATES 8a7cc182
- G1_PACKET b7f8f4f2

Re-hashed at the end (10:44:57 UTC). These changed during the pass:
- **RISK_REGISTER itself** → 41554ef7 (12:42:00). Its header is unchanged ("Fix blocks 1 to 5"). The visible change is that the "Directive 9 text" derived-from line was removed. All five defects below are still present, verbatim, in the new version (rows 2d :33, 3a :40, 3e :44, RB-12 :92, RB-14 :94).
- THREAT_MODEL → c0c95894 (12:43:25; header still "v2 fix block 8"; DR-01 still "Needs CF-5(f), CF-5(h) and CF-5(i)"; T-N1 unchanged; still no 4b/RB-12/CF-5(b) residual)
- LEDGER → 889173fb
- ADR-008 → f81850e2 (fix block 6, 12:21:20; it now cites "RISK_REGISTER v3 fix block 5")
- ADR-001 → 13801fb7
- ADR-004 → f083a1bb
- OPEN_QUESTIONS → 9fedbc8b
- SEQUENCES → 84ee2528
- G1_PACKET → cbce0ec6

Unchanged: RUBRIC, CONTRACT, constants, GATES, ADR-002/003/005/006/007.

Versions compared: RUBRIC v2 fix block 11, applied in full. The target's "Derived from" lines name THREAT_MODEL v2 fix 8, CONTRACT v3 fix G, ADR-001/003 fix 9, ADR-008 fix 5 and RUBRIC v2 fix 11.
- CONTRACT (now fix H, 12:20:08), ADR-001 (fix 10, 12:20:33) and ADR-008 (fix 6) were all edited **after** the target (12:18:38). Under the MC-40 label clause ("a sibling document changed afterwards makes the sibling the defective one"), those deltas are not target defects.
- THREAT_MODEL fix 8 (12:17:02) predates the target, so the target is responsible for any disagreement with it.

CHECKS:
K1 KICKOFF §5 P1 item 3 (3–6 top entries, each with a detection; blind entries use [R]/[X]) → PASS.
  - Recounted: 6 `### RR-` entries, 26 sub-risks (1a–1c, 2a–2f, 3a/3d/3b/3c/3e, 4a–4d, 5a–5c, 6a–6e), 14 RB rows (RB-1…RB-10, RB-12…RB-15; RB-11 retired, with no dangling reference outside verification reports), and 4 RD rows, each defined once.
K2 Live Arc facts the register relies on, re-derived on 2026-10-05 ~10:25 UTC against https://rpc.testnet.arc.io (read-only calls only) → PASS.
  - eth_chainId 0x4cef52 = 5,042,002 (C-01).
  - eth_getLogs: to−from = 9,999 → []; to−from = 10,000 → -32012 "requested range too large" (C-40, 2a).
  - eth_getLogs on the system emitter 0xffffFFFf…FfFE over 9,999 blocks → -32602 "query exceeds max results 2000" (C-41, 2a).
  - eth_call value 0 from C-55 0x7099…79C8 → -32603 "Blocked address". Controls from a random empty address: value 0 → "0x"; value 1 wei → -32003 "revert: OutOfFunds" (C-57, RB-1/DR-11 zero-value probe).
  - Latest header: extraData 0x00000004a817c800 = 20,000,000,000 = baseFee (C-30/C-33, DR-16/RB-15).
  - 0x3600… decimals() = 6 (C-11).
K3 MC-21 shared method → PASS.
  - The verifier ran tools/source_drift.py itself (sha256 5504b5e7…80e1, which matches the version reviewed in P1-rubric-lensR-13; source re-read here: stdlib only, read-only). Output went to stdout only, not to a file.
  - Result: 40 archives, integrity failures 0; 33 URLs, drifted 0, fetch errors 0.
  - Quotes checked against the compared (newest) archives:
    - deposits.md "`tx.from` is the relayer's address" (C-27, 2f) ✓
    - opt-in-privacy.md "Privacy features are on the roadmap and not yet available on Arc." (C-64, RB-2) ✓
    - rpc-endpoints.md:98/:106-108/:118 (10,000-block cap, ≤9,999 chunks) ✓
    - usdc-system-events.md emitter (5 hits) and :39 "emits **two** logs" ✓
  - RD-04 mutant reproduced: "Sending value to a precompile address reverts" appears 0 times in evm-differences.REFETCH-later.md (the compared archive, identical to live) and once in the older archive.
K4 Units, by exact integer reconstruction (python) → PASS.
  - p=6, k=10^12: 0→(0,0); 1→(0,1); k−1→(0,k−1); k→(1,0); 10^18→(1,000,000; 0); 1,000,000,500,000,000,000→(1,000,000; 5×10^11); 7,374,356,000,000,000→(7,374; 356×10^9); (2^63−1)k+k−1→(9,223,372,036,854,775,807; k−1).
  - p=2, k=10^16: 10^18→100; 10^16−1→all dust; 7,374,356×10^9→all dust.
  - m·k+dust = w on every row. Every row equals CONTRACT §6.1 (:537-560).
K5 MC-40 re-trace of the §RD rows →
  - RD-01 PASS. 10^18 wei at adapter p=6 gives m=1,000,000. A CBS at p=2 shows 10000.00. Tag 2≠6 → PAUSE before posting (CONTRACT §1.1:25). The executors (adapter pre-posting gate plus monitor) match THREAT_MODEL:53/:55 and ADR-008:76.
  - RD-02 PASS ([X], supplementary for 1a). Adapter p=2 gives m=100, which a CBS at p=6 shows as 0.000100.
  - RD-03 PASS on the mutant. Hot 10^20, move X=5×10^18 hot→gas, T6 posted twice: per-role residuals hot +5×10^18, gas −5×10^18, aggregate 0. CONTRACT §5.7:457 is still "per-role diagnostic", so its PAUSE is tracked as CF-5(b) with G1 residual RB-12 (MC-40(f) → PASS in this document; see D-35 for the sibling side). [inspection-only] the executor is named in THREAT_MODEL:53 (monitor) and ADR-008:77, not in the RD row.
  - RD-04 PASS (K3). Executor and action come through MC-21.
K6 MC-40(a) and MC-41 for every blind sub-risk →
  - PASS: 1a RD-01; 1b DR-06(1); 1c [P]+DR-06; 2a DR-10; 2b [P] MC-15; 2c DR-06 mutant (2); 3b DR-12/DR-13; 3c [P] MC-23 + DR-14/DR-15; 4a DR-07; 4d [X] with owner, cadence, input and action; 5a/5b [X] with owner, cadence and action; 6a DR-19; 6c [P] MC-32; 6d [P] MC-23 + DR-15.
    - **2c re-traced:** a hot→gas move X also booked as inbound gives T1 G2 +X while the chain total is unchanged → residual −5×10^18 → PAUSE. **R9 D-33 CLOSED.**
  - Residual-backed: 2e, 2f, 3a, 3d, 6b and 6c rely on RB-7; 3e on RB-13; 4b on RB-12; 6e on RB-10. Each names its closing CF item or question → PASS on MC-41.
  - **FAIL 2d (D-36).**
  - **3e: FAIL at its closure condition (D-37).**
K7 MC-40(b)–(f) for the relied-upon detections → PASS. Every monitor detection has the monitor as executor (THREAT_MODEL:53), with PAUSE through the attestation (:51, :61) and a dead-man stop (ADR-008:99-100). DR-20 runs in the egress proxy, which fails closed. DR-19's sink-silence path → see C-B.
K8 MC-43 for 5a–5c → PASS.
  - The 5c quote was found under ¶4.5.2 of the SARB extract (whitespace-normalised). "In a future NPS Act revision" is a faithful paraphrase of ¶4.5.
  - The 5b archive claims were diffed against MANIFEST:42-50: Directive 9, GN1350, PCC 57 (contains "Item 22"), the SARB communication and POPIA ("text not extractable", Q-T8) are present; Schedule 1 and the FIC Act are absent ✓.
K9 MC-44 references → PASS on resolution, FAIL on content (D-34).
  - Resolved by script against their sources: 22 DR ids (THREAT_MODEL §D); 21 Q ids (topic checked per row); 12 MC ids; C-27, C-41, C-57, C-64; M-1, M-9; 20 T-/L- ids; CF-5(b),(e)–(i) and CF-24 (LEDGER); all RB ids; THREAT_MODEL residual numbers 4, 6–13; and "ADR-008 R5 C-1" (adr-008-lensR-5:76).
K10 MC-45 and the MC-40 label clause (residual lists per sub-risk; sibling claims re-checked against THREAT_MODEL fix 8) →
  - Agree: residual 1 → RB-1; 2 → RB-2; 3 → RB-3; 4 → 3a/RB-7; 5 and 13 → RB-6; 6 → RB-7 (the DR list matches exactly: DR-01, DR-04, DR-20 address set, DR-21, DR-22, DR-23, DR-25, DR-28, DR-29) and RB-13; 7 → RB-8; 8 → RB-9; 9 → RB-10 (Q-D4); 10 and 12 → RB-14; 11 → RB-15. **R9 D-30 and D-32 CLOSED.**
  - **FAIL:** 4b/RB-12 has no THREAT_MODEL counterpart, while the register says it is "not ahead of any sibling" (D-35).
  - **FAIL:** 3a's CF list is behind DR-01 (D-34).
  - **FAIL:** RB-14's labels for T-I2 (D-38).
K11 CF-17 checklist (LEDGER:65), item by item → all applied: RB-10/Q-D4 ✓, RB-11 closed ✓, RB-7 DR list ✓, RB-1 [A] DR-16 two executors ✓, 2c mutant (2) ✓, RB-14 (T-I2/T-I3, residuals 10 and 12) ✓, RB-9 owners/T-T6 ✓, RB-15 ✓, RB-6 hosted/unhosted (Q-D9, CF-24) ✓, 3e/DR-29/RB-13 ✓, 6b/6c CF-5(h) ✓. CF-16(c) ✓ (3e under RR-3).
K12 Judgment lenses [inspection-only]:
  - JL-1 PASS. Every blind path stops or is a named residual.
  - JL-2 PASS. Every entry has an owner.
  - JL-4 PASS.
  - JL-6 PASS. RR-6 covers 6a–6e.
K13 Code-phase items (MC-01/02/05/07/08/14/15/16/18/19/20/22–24/30–34/42/48) → N/A. This is a Phase 1 document with no src/ and no tests. Mutant reasoning is in K4–K6.

CANDIDATES:
C-A · RISK_REGISTER.md:41 3a "**Needs CF-5(f) and CF-5(i)** (`listPayoutInstructions`, `listApprovals`, `listCaseDispositions`)" vs THREAT_MODEL.md:166 DR-01 "**Needs CF-5(f), CF-5(h) and CF-5(i)**: CF-5(h) for the wallet set S that the cancel class relies on" · MC-44, MC-40 label clause (the register claims to mirror THREAT_MODEL fix 8 and to be "not ahead") · **REAL (minor)**.
  - RB-7's closure condition includes CF-5(h), so the residual can't lapse early. Same class as R9 D-29.
C-B · :65 6a "DR-19 (in the monitor; … and its heartbeat)" vs THREAT_MODEL:184 "a missing heartbeat pages Security" (a silent scanner only pages; the sink isn't held) · MC-40(f) silent-executor clause · DISMISSED for this unit.
  - The executor is the monitor, and the monitor's silence stops signing (ADR-008:99-100).
  - The scanner-only-silent path belongs to THREAT_MODEL/ADR-008 (it was routed in R9 A7).
C-C · :51/:93 4b/RB-12 (G1 residual until CF-5(b)) and :9 "This version is not ahead of any sibling" vs THREAT_MODEL:198-214 residuals 1–13 (a grep finds no 4b, RB-12, CF-5(b) or duplicate-T6 entry; RD-03 appears only in the executor list :53) and LEDGER (no CF routing it) · MC-45 ("every sub-risk that one document lists as a G1 residual is a residual, or carries a valid detection, in the other"), MC-40 label clause ("ahead" claims re-checked) · **REAL (minor)**.
  - R9 D-31's fix required "Mirror it to THREAT_MODEL, or declare it ahead and route it". Neither was done.
C-D · :34 2d "| yes | [R] DR-10. [X] arc-node CHANGELOG / BREAKING_CHANGES |" vs THREAT_MODEL:175 DR-10's only mutant "Pager skips a block …", and RUBRIC.md:80 "(a) the mutant is an instance of the sub-risk it is mapped to" and "An [X] detection that MC-41 relies on … must state its owner, its cadence …, its input, and its action". Also the register's own :7 "An [X] that a blind sub-risk relies on states its owner, cadence, input and action" · MC-40(a), MC-40 [X] clause → MC-41 · **REAL (minor)**.
  - A pager skip is an instance of 2a, not of a hard fork. The CHANGELOG watch has no owner, cadence or action anywhere (a docs-wide grep finds it only in RR:34, RR:84 and THREAT_MODEL:126). So no detection valid under MC-40 backs blind 2d, and there is no residual.
  - The rule came from rubric register row 18 (fix 7), which postdates the R9 pass.
C-E · :45 3e "a compromised adapter places a payout hold, or posts an inbound credit, on an uninvolved customer's account" mapped to DR-29, whose only mutant (THREAT_MODEL:194) is "A compromised adapter **settles** customer C's payout against customer V's account". THREAT_MODEL:117 T-T7 reads "places a payout hold, **settles it**, or posts an inbound credit" · MC-40(a) (at RB-13's closure, 3e relies on DR-29), MC-45 (per-sub-risk match with residual 6/T-T7) · **REAL (minor)**.
  - After CONTRACT fix F, `placeHold {key, instructionId}` takes the account from the CBS's own record (CONTRACT:188). The live wrong-account path is the settlement one (CONTRACT:190; contract R10 D1, R11 D2), and 3e omits it.
C-F · :95 RB-14 Detections "[X] Owner re-attestation (T-T6), list-hash, SCA and HSM-audit checks (THREAT_MODEL)" for a risk stated as disclosure (T-I2, T-I3) and [X]-only windows, vs THREAT_MODEL:100 T-I2 "[I] Access review only. **G1 residual 10**" and :85 (the owner re-attestation compares deployed version hashes, which detects **tampering**, T-T6, not disclosure) · MC-40 label clause ("Labels agree across THREAT_MODEL and RISK_REGISTER") · **REAL (minor)**.
  - The row implies [X] coverage for xpub and address-set disclosure, which THREAT_MODEL says has only [I]. T-T6 belongs to RB-9 (CF-17).
C-G · :87 RB-4 "[A] `A_stall` (non-blind)" vs THREAT_MODEL:107 T-D2 "[X] Heads compared across two independent sources" · label clause · DISMISSED.
  - These are two different detections, each with its own label. [A] is allowed for a non-blind threat. No single detection carries conflicting labels.
C-H · Sibling deltas after the target: ADR-001:25 "RISK_REGISTER 2c/3a/3b" (RR 2c relies on DR-06, not the signing log) and ADR-001:31 "DR-01, which can't run until … CF-5(f)" (omits CF-5(h)/(i)); CONTRACT fix H; ADR-008 fix 6 · label clause · DISMISSED for this unit.
  - ADR-001 (12:20:33), CONTRACT (12:20:08) and ADR-008 (12:21:20) are all newer than the target, so they are the defective documents. Routed to P1-adrs.
C-I · LEDGER:37/38 P1-risk-register "draft v3, fix block 3 used … Fix 5 after threat-model R8 (CF-17)" vs RR:3 "Fix blocks 1 to 5 applied"; CF-17 and CF-16(c) are not marked done · MC-44 · DISMISSED for this unit. This is LEDGER bookkeeping, routed there.
C-J · :59 5b "SARB/FSCA Joint Communication of 28 May 2026" vs the extract header "signature dates are blank … '280526' in the file name suggests 28 May 2026" · MC-43 · DISMISSED. The date is used as an identifier, matching Q-R6 and KICKOFF §8; it is not a regulatory statement.

PROBE G (would the rubric wave through a bad version of this register?): Yes.
- MC-40(a) bites only on detections a sub-risk "relies on" now. A sub-risk parked as a G1 residual "until X" can name a detection whose mutant isn't an instance of it (C-E), and nothing checks that the residual's closure leads to a valid detection.
- Patch: "a residual's closing condition names a detection that is re-traced under MC-40(a)–(f) now, as if the condition held; and a mirrored sub-risk's wording covers every attack path of the threat row it cites."

PROBE F (would it fail a good version?): Yes.
- The MC-40 [X] cadence rule ("no slower than the age of the money it protects") would fail a good 2d anchor whose cadence is "at every arc-node upgrade". On a pinned node, a semantics change can reach our ingestion only through an upgrade we choose; otherwise our node stalls, which is non-blind and PAUSEs under CONTRACT §1.6.
- Reword: "an event-driven cadence (at every change of the anchored thing) satisfies the cadence rule when the risk can materialise only through that change."
- (Both probes are dated after RUBRIC v2 fix 11. They go into the rubric queue and are not defects.)

REGRESSION (two frozen units): LEDGER shows 0 frozen units. Substitutes were chosen for the oldest mtimes, furthest from today's edits.
(1) P0-constants (constants.md 00:20, e494e772…, unchanged at the end). Re-derived live (K2): C-01, C-11, C-30/C-33, C-40 (exact boundary), C-41 (2,000 results, -32602), C-55/C-57 (-32603, plus the 1-wei OutOfFunds control) and C-20/C-22 (archive identical to live). No regression.
(2) P1-sequences (SEQUENCES.md 2026-10-02 23:23, 660310b6… at the pin).
  - The 9,999-block paging, the (chainId, txHash, logIndex) dedupe and the ≥20 gwei / 5042002 rules agree with K2.
  - It changed during the pass (→ 84ee2528). Not re-verified here.

Prior defects (R9):
- D-29 CLOSED (CF-5(i) added), but see new D-34 (CF-5(h)).
- D-30 CLOSED.
- D-31 CLOSED in this document (RB-12), but see D-35 (no mirror).
- D-32 CLOSED.
- D-33 CLOSED.

DEFECTS:
D-34 · docs/RISK_REGISTER.md:41 (3a "Needs CF-5(f) and CF-5(i)") · R, MC-44 + MC-40 label clause · minor.
  - Fix: "Needs CF-5(f), CF-5(h) and CF-5(i)" (add `listIssuedAddresses`, for the cancel class's wallet set S), as in THREAT_MODEL DR-01.
D-35 · docs/RISK_REGISTER.md:51, :93 (4b/RB-12) with :9 ("not ahead of any sibling") · R, MC-45 + MC-40 label clause · minor.
  - Fix: declare the register ahead of THREAT_MODEL fix 8 on 4b/RB-12, and route a THREAT_MODEL residual (duplicate T6 undetected until CF-5(b)) as a LEDGER CF item.
D-36 · docs/RISK_REGISTER.md:34 (2d: DR-10's mutant isn't a hard-fork instance; the [X] CHANGELOG has no owner, cadence, input or action) · R, MC-40(a) + MC-40 [X] clause → MC-41 · minor.
  - Fix: give the [X] an owner (for example Engineering), a cadence (at every arc-node upgrade and on each Arc release note), an input and an action (block the upgrade or PAUSE). Or route a 2d mutant for DR-10 (the Zero5 precedent: the emitter changes → indexed logs stop explaining balance deltas → PAUSE) to THREAT_MODEL. Or list 2d as a G1 residual until then.
D-37 · docs/RISK_REGISTER.md:45 (3e omits the wrong-account settlement path, which T-T7 and DR-29's mutant use) · R, MC-40(a) at RB-13's closure, MC-45 · minor.
  - Fix: "places a payout hold, settles it, or posts an inbound credit, on an uninvolved customer's account", as in THREAT_MODEL T-T7.
D-38 · docs/RISK_REGISTER.md:95 (RB-14 lists T-T6 owner re-attestation as a detection for a disclosure risk and drops T-I2's [I] label) · R, MC-40 label clause · minor.
  - Fix: per threat: T-I2 "[I] access review only (residual 10)"; T-I3 "[X] HSM key-use and secret-store audit"; T-B1 "[X] list version/hash"; T-SC2 "[X] SCA feeds". Remove T-T6 re-attestation from RB-14; it belongs to RB-9.

Routed out of unit (not counted):
- ADR-001:25 and :31 (stale RR mappings; DR-01 needs CF-5(h)/(i)) → P1-adrs.
- LEDGER: the P1-risk-register row ("fix block 3 used", fix 5 not logged), and CF-17/CF-16(c) not marked done → LEDGER.
- THREAT_MODEL T-N1 carries the same un-owned [X] as 2d → P1-threat-model.
- Probes G and F → P1-rubric queue.

VERDICT: NEGATIVE (5 defects: 0 blocking, 5 minor)
