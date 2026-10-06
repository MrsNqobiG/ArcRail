VERIFICATION · lens: R (plus the Lens A candidate, probe and regression sections the verifier method requires) · target: P1-risk-register (docs/RISK_REGISTER.md v3 after fix block 2), R7 · commit: none (uncommitted working tree on main, no HEAD). Snapshot verified 2026-10-03 09:16-09:28 UTC: RISK_REGISTER.md sha256 5439f916c4ba360a2f403bebc6c3c82c293b706af318e3dfe3a5dc230ebf486b, mtime 11:16:19 SAST (unchanged at end of run).

**Moving inputs.** RUBRIC.md (11:24:48), OPEN_QUESTIONS.md (11:25:35) and LEDGER.md (11:25:49) changed during this run, after the register. RUBRIC v2 fix block 4 added MC-40 (e) executor/input-set and (f) fail-closed action, and a cut-off rule. **This report applies MC-40 (a)-(d) as it stood when the register was fixed (read at 09:16 UTC).** Where the new (e)/(f) would change a result, it is noted but not counted. THREAT_MODEL (11:13:20) and CONTRACT (11:15:38) are older than the register and were stable during the run.

Criteria: KICKOFF §4, §5 P1 item 3; CLAUDE.md; RUBRIC MC-40, MC-41, MC-44 (and MC-21, MC-43, MC-45); THREAT_MODEL §D, B9 section, residuals 1-8; ADR-008; CONTRACT v3; constants.md; OPEN_QUESTIONS; LEDGER CF items; docs/sources.

CHECKS:
R1 Top-entry count 3-6 (KICKOFF §5 P1 item 3) → PASS. Recounted by script: 6 `### RR-` headings; 25 sub-risks (RR-1 3, RR-2 6, RR-3 4, RR-4 4, RR-5 3, RR-6 5; new since R6: 2e, 2f, 3d, 6e); 9 RB rows (RB-8, RB-9 new); 4 RD rows, each defined once.
R2 Each top entry has a detection; blind entries use [R]/[X] → PASS by label. RR-1, RR-2, RR-5, RR-6 Blind; RR-3, RR-4 Partly blind. Every sub-risk carries an [R] or [X] label (3a's DR-01 is declared not runnable and routed to RB-7).
R3 MC-41 per sub-risk → 24/25 PASS, 1 FAIL (6e, see D-23).
  - 2e: DR-23 needs CF-5(h) (LEDGER CF-5(h) present) + [X] statements/complaints + RB-7 residual → PASS.
  - 2f: [P] U4 relayed fixtures count as [R] (U4 is money-path item 2, mutation-tested under MC-08; 2f is a U4 attribution bug) → PASS. DR-22 itself is invalid, see D-24.
  - 3a: DR-01 needs CF-5(f); listed in RB-7 with CF-5(f), CF-5(h), Q-C10 → PASS.
  - 3d: preventive CF-5(g)/MC-24; DR-25 needs CF-5(f), RB-7; DR-06 after the fact (valid for the signer-bug variant, re-traced in A5) → PASS.
  - 6e: sole detection DR-26 fails MC-40(d) → FAIL (D-23).
  - All R6-passed rows (1a-1c, 2a-2d, 3b, 3c, 4a-4d, 5a-5c, 6a-6d) unchanged in text → PASS (spot re-traces in R8).
R4 Arc facts re-derived live 2026-10-03 ~09:17 UTC against https://rpc.testnet.arc.io (MC-21) → PASS.
  - eth_chainId → 0x4cef52 = 76·65,536 + 239·256 + 82 = 5,042,002 (C-01). Head 65,263,639.
  - eth_getLogs (address-filtered) from H−20,000: to−from = 10,000 → −32012 "requested range too large"; to−from = 9,999 → [] (C-40). Unfiltered 9,999 span → −32602 "query exceeds max results 2000, retry with the range 65243639-65243826" (C-41).
  - RB-1/DR-11: eth_call from C-55 0x7099…79C8 to a fresh random address, value 0 → −32603 "Blocked address" (C-57). Control random→0x…bEEF value 0 → "0x"; value 1 wei → −32003 "revert: OutOfFunds" (why the probe is zero-value).
  - Latest header: extraData 0x00000004a817c800 = 20,000,000,000; baseFeePerGas 20,000,000,000 (C-30/C-33, DR-16).
  - Receipt 0x0e8279a4…24695: system emitter log 9,176,065,000,000,000,000 and 0x3600 log 9,176,065 (ratio exactly 10^12, C-10/C-20/C-22, 2b); gasUsed 167,599 × 44 gwei = 7,374,356,000,000,000 wei.
  - Docs re-fetched (HTTP 200, 2026-10-03 ~09:18 UTC): https://docs.arc.io/integrate/exchanges/deposits.md lines 289-291 "For EIP-3009 relayer-submitted deposits, `tx.from` is the relayer's address … Read the `from` field from the system" (C-27, 2f) ✓; https://docs.arc.io/arc/references/rpc-endpoints.md lines 105-108 (−32012, ≤9,999) ✓; https://docs.arc.io/arc/references/evm-differences.md lines 126-128 (blocklist reverts consume gas) ✓; https://docs.arc.io/arc/concepts/opt-in-privacy.md line 29 "Privacy features are on the roadmap and not yet available on Arc." (C-64, RB-2) ✓; https://docs.arc.io/arc/references/usdc-system-events.md line 35 (emitter, 18 dp) ✓. Agent-instruction headers on these pages treated as data (T-SC3).
R5 MC-43 regulatory statements (5a-5c) → quotes PASS; archive-status claim FAIL (D-22).
  - SARB PDF: I decompressed the content streams myself (70 streams). Text reads "…The SARB is thus unlikely to consider foreign currency-pegged stablecoins as payment instruments for domestic transactions. 4.5.3 …", preceded by "4.5.2 Stablecoins" and the ¶4.5 heading "The revision of the NPS Act will include provisions …". 5c quote, ¶ and "future NPS Act revision" ✓.
  - Archive hashes of every fic/, fsca/, sarb/ and popia/ file recomputed: all match MANIFEST:42-50.
  - **POPIA is archived**: docs/sources/popia/POPIA-Act-4-of-2013-inforegulator.pdf, mtime 10:47:54 SAST (before register fix block 2 at 11:16), MANIFEST:50. I re-fetched the live URL: HTTP 200, 394,590 bytes, sha256 67f2c460…a76f, identical to the archive. RISK_REGISTER.md:54 still lists "**Still to archive:** … POPIA" and omits it from "Archived so far" → FAIL (D-22). Schedule 1 and the FIC Act are indeed absent ✓.
R6 Unit and number reconstruction (python3, exact integers) → PASS.
  - CONTRACT §6.1, all 13 rows by divmod: p=6 (k=10^12): 0→(0,0); 1→(0,1); k−1→(0,999,999,999,999); k→(1,0); 10^18→(1,000,000,0); 1,000,000,500,000,000,000→(1,000,000; 500,000,000,000); 420,000,000,000,000→(420,0); 7,374,356,000,000,000→(7,374; 356,000,000,000); 9,223,372,036,854,775,807,999,999,999,999→(2^63−1; 999,999,999,999), and 2^63·10^12 exceeds signed 64-bit m. p=2 (k=10^16): 10^18→100; 15×10^15→(1, 5×10^15); k−1→(0,k−1); 7,374,356×10^9→(0, all dust). Round trip m·k + dust = w holds on every row.
  - 1,234,567,890,123,456,789 wei → (1,234,567; 890,123,456,789) ✓.
R7 MC-40 RD re-traces →
  - RD-01 PASS on the mutant: W = 10^18, adapter p=6 → m = 1,000,000; CBS at p=2 renders 10000.00; tag 2 ≠ 6 → PAUSE before posting (CONTRACT.md:25). Executor disagreement with THREAT_MODEL, see D-25.
  - RD-02 PASS ([X]): adapter p=2 → m = 100 → CBS p=6 shows 0.000100.
  - RD-03 PASS on the mutant: hot 100 USDC (10^20 wei), move X = 5×10^18 hot→gas, T6 posted twice: CBS_G2[hot] = 90×10^6, CBS_G2[gas] = 10×10^6 vs chain 95×10^18 / 5×10^18 → per-role residuals +5×10^18 / −5×10^18, aggregate 0. PAUSE still needs CF-5(b) (CONTRACT.md:395 "A per-role diagnostic check adds `±Rmove`"); routed (LEDGER CF-5(b)).
  - RD-04 PASS: "Sending value to a precompile address reverts." present at docs/sources/arc/arc_references_evm-differences.md:133, 0 occurrences in today's live page.
R8 MC-40 DR mappings (new and changed rows re-traced; unchanged rows spot-checked) →
  - 2e DR-23: mutant (registry accountRef A→B; CBS issuance says A → mismatch → QUARANTINE) is an instance of 2e; input listIssuedAddresses = CF-5(h), Q-C18 → PASS under (c) with RB-7.
  - 2f DR-22: (a) PASS; (c) FAIL, the comparison input "screening and monitoring records' subject" has no monitor-readable source (D-24).
  - 3a DR-01: unchanged status (CF-5(f), RB-7) → PASS.
  - 3d DR-25: mutant (two final transactions for one approval) instance of 3d; input listApprovals = CF-5(f) → PASS with RB-7. DR-06 after the fact: see A5.
  - 6e DR-26: mutant caught, inputs exist (DB audit log; Security's honeytoken list), but (d) FAIL (D-23).
  - RB-3 DR-27: mutant (tag re-pointed → digest differs → refuse to start) instance of RB-3; input owned by Engineering → PASS.
  - Spot re-traces: 1b DR-06 (×10^6 on A = 10^6 minor → residual 999,999,000,000,000,000) PASS; 2b DR-10 (both logs credited → excess 10^18) PASS; 4a DR-07 (duplicate T2, m = 10^6 → G5 −10^6 vs itemised 0) PASS.
R9 MC-44 references → PASS on resolution, one content FAIL (D-22). Script resolved: 19 DR ids (all present in THREAT_MODEL §D, incl. DR-21 at :166 out of order), RD-01..04 (each defined once), 14 Q-ids, 12 MC-ids, C-27/C-41/C-57/C-64, M-1/M-9, 14 T-/L- ids, CF-5(b)/(e)/(f)/(g)/(h) (all lettered in LEDGER CF-5). Manually resolved: CONTRACT §1.1 (:18-25), §5.8 (:424); THREAT_MODEL B9 (:31), residuals 4, 6, 7, 8 (:174-181); ADR-008; ADR-006:34-36 (sweep policy, U11); KICKOFF §9 item 2 (G-M 2 "Travel-rule integration tested with at least one counterparty CASP").
R10 THREAT_MODEL residuals carried (R6 R10 / D-21 re-check) → PASS. 1→RB-1; 2→RB-2; 3→RB-3; 4→3a ("OPEN until Q-C10 (residual 4)") and RB-7; 5→RB-6; 6→RB-7 (DR-01, DR-25, DR-23; "[X] Customer statements and complaints only"); 7→RB-8; 8→RB-9. RB-7 wording now agrees with THREAT_MODEL:176-179 ("not detected by any [R] check … only [X] customer statements and complaints remain"). D-21 CLOSED.
R11 Header (:3) vs LEDGER → [inspection-only] PASS for the register. Header claims fix blocks 1 and 2 after R5 and R6; both reports exist and fix block 2's changes address R6 D-21. LEDGER:32 was updated during this run (11:25:49) to "v3 Fix 2 … R7 pending" and now agrees.
R12 KICKOFF §4 "derive fresh" → [inspection-only] PASS. R13 Ranking → [inspection-only] PASS. R14 Review cadence, closure only via EVIDENCE_PACK (:89-91) → [inspection-only] PASS.
R15 Judgment lenses → [inspection-only] PASS for JL-1 (3a/3d/2e route to RB-7 rather than claiming coverage), JL-2 (owner per top entry; 5c to operator+counsel), JL-6 (RR-6 incl. 6e). JL-4/JL-5 not engaged by this unit.
R16 Tests and mutation → N/A. Phase 1 document unit; no src/ or test suite. Mutant reasoning is in R7, R8, A1-A8 and Probe G.

CANDIDATES (Lens A):
A1 · RISK_REGISTER.md:54 "**Archived so far:** Directive 9, FSCA GN 1350/2022, FIC PCC 57 (Item 22 as quoted by the FIC), and the SARB/FSCA Joint Communication of 28 May 2026. **Still to archive:** gazetted Schedule 1 (Item 12), the FIC Act TFS and record-keeping sections, POPIA" vs docs/sources/MANIFEST.md:50 "`sources/popia/POPIA-Act-4-of-2013-inforegulator.pdf` | https://inforegulator.org.za/… (**text not extractable** …; Q-T8) | 2026-10-03 | `67f2c460…`" and OPEN_QUESTIONS Q-R12 "The Act is archived (`docs/sources/popi…" · MC-43 (primary-source status), MC-44 (citing text says what the source says) · **REAL (minor)**.
  - Re-derived: the file exists, its hash matches MANIFEST, and the live URL returns byte-identical content today.
  - Archived at 10:47:54 SAST, 28 minutes before register fix block 2. R6 also missed it.
  - Correct status: POPIA archived, text not yet extracted or read (Q-T8, Q-R12).
A2 · RISK_REGISTER.md:64 "6e The address registry is stolen from the store (L-2) | [R] DR-26 (honeytoken rows watched through the DB's own audit log)" vs THREAT_MODEL.md:164 DR-26 "fake `address → accountRef` rows, planted by Security and known only to the monitor … An attacker dumps the registry table → honeytoken rows are read in bulk → alert and QUARANTINE", THREAT_MODEL.md:143 DR-04 "Re-derive every registry address from the signer (HD path) and compare", :161 DR-23 "Compare every registry `address → accountRef` mapping with … `listIssuedAddresses`", :162 DR-24 "Each reconciliation compares the registry's bank-owned flags" · MC-40(d) "its healthy signal is specified, and it doesn't fire on legitimate flows"; MC-41 · **REAL (minor)**.
  - Re-trace: DR-04, DR-23 and DR-24 each read every registry row every reconciliation cycle. So honeytoken rows are "read in bulk" by legitimate flows → DR-26 fires every cycle.
  - It also breaks the other detections. A fake address has no HD path → DR-04 mismatch → QUARANTINE. DR-04 doesn't run in the monitor (THREAT_MODEL:38), so it can't know the honeytokens. A fake accountRef isn't in the CBS issuance record → DR-23 mismatch → QUARANTINE, and no exclusion is specified.
  - DR-26 states no healthy signal: which reader identities or queries may touch honeytoken rows.
  - 6e is blind and DR-26 is its only detection, so 6e has no detection valid under MC-40 and isn't listed as a residual.
  - Minor rather than blocking: the failure is fail-closed (false QUARANTINE and alerts), not fail-open, and every input exists. This differs from R5 D-18, where the sole detection couldn't run at all.
A3 · RISK_REGISTER.md:32 "2f Relayed deposit attributed to the relayer (T-S4, C-27) | [R] DR-22 (in the monitor; every relayed item plus a sample)" vs THREAT_MODEL.md:160 DR-22 "the monitor … compares the log's `from` with the screening and monitoring records' subject" and THREAT_MODEL.md:35 "read-only access to own nodes, the CBS read operations (`getBalancesAsOf`, `listJournals`, `listPayoutInstructions`, `listApprovals`, `listIssuedAddresses` …) … It takes **no inputs from the adapter**" · MC-40(c) (applies to supplementary [R] too: "must still meet (b)–(d)") · **REAL (minor)**.
  - The screening subject goes to the CBS in `screen` (CONTRACT.md:159), and the monitoring counterparty in `submitMonitoringEvent` (:161). These are writes by the adapter.
  - No CONTRACT read returns them. `getResultByKey` returns `{verdict, screeningRef}`, not the subject. `ScreeningOutcome` (:178) carries `{eventId, screeningRef, verdict, at}`. Neither the monitor's read list (THREAT_MODEL:35) nor Q-C18 includes them, and the adapter is excluded as a source. No CF item or question tracks the gap.
  - The register marks 2e, 3a and 3d "needs CF-5(x)" but presents DR-22 as runnable.
  - MC-41 for 2f still holds through the [P] U4 fixtures, so minor. Under the newer MC-40(e) (executor input set) this would also fail.
A4 · RISK_REGISTER.md:70 RD-01 "The **adapter** compares its `p` on every response and PAUSEs before any posting (CONTRACT §1.1)" and :3 "the detections below marked 'in the monitor' run outside the adapter" (RD-01 is unmarked), vs THREAT_MODEL.md:38 "**Runs in the monitor:** … RD-01 (on CBS responses it reads itself), RD-03" · MC-40 last clause ("Labels agree across THREAT_MODEL and RISK_REGISTER, or the newer document says it is ahead"), MC-45 · **REAL (minor)**.
  - The register is the single definition point for RD-xx (:5) and is the newer document (11:16 vs 11:13). Its header says fix block 2 "syncs with THREAT_MODEL v2 fix block 2", yet it places RD-01 in the adapter while the threat model places it in the monitor, and it doesn't say it is ahead.
  - The disagreement matters. A monitor's PAUSE gates only signing (attestation at the signer), so it can't stop CBS postings "before any posting", which is the whole point of RD-01 (inbound T1/T2 credits need no signature).
  - The monitor also has no source for the adapter's configured `p`, since it takes no adapter inputs.
  - Fix: RD-01 names its executor(s) explicitly: the ACL, pre-posting, per CONTRACT §1.1, plus (optionally) a monitor re-check against an Engineering-owned expected-`p` artefact. Route the matching correction to THREAT_MODEL:38.
A5 · RISK_REGISTER.md:38 "3d … [R] DR-25 (in the monitor; needs CF-5(f)). [R] DR-06 after the fact" vs THREAT_MODEL.md:177 "a compromised orchestrator … replaying an approval … **is not detected by any [R] check**, because DR-06 and DR-07 stay at residual 0 when the fabricated transaction is posted consistently" · MC-40 label agreement · DISMISSED.
  - Re-trace, signer-bug variant: the consumed-approval rule fails and a second transaction for instruction I goes out at nonce n+1. The adapter posts one T4 for I. The chain then shows −2A·k against a CBS −A·k → DR-06 residual −A·k → PAUSE. That is a valid after-the-fact catch of a 3d instance (MC-40(a)).
  - The compromised-orchestrator variant (consistent posting) is the residual, and it is in RB-7 as the register says.
  - The register agrees with THREAT_MODEL T-T1 (:58 "[R] DR-06 (after the fact)"). The threat model is internally inconsistent between T-T1 and residual 6's wording; that is routed to P1-threat-model.
A6 · RISK_REGISTER.md:46 "4b … [R] RD-03. **Needs the CONTRACT change CF-5(b)**" vs CONTRACT.md:395 "A per-role diagnostic check adds `±Rmove`." · MC-40/MC-41 · DISMISSED. Unchanged since R6 A1. MC-40 (a)-(d) concern inputs and the healthy signal, both met. The PAUSE is tracked as CF-5(b) (LEDGER), and the CONTRACT Fix C is queued (LEDGER:27). Under the newer MC-40(f) it would also pass, because the action is tracked as a CF item and 4b is a bug, not a compromise.
A7 · RISK_REGISTER.md:85 RB-7 "The signer's per-transaction and daily limits cap the damage per transaction and per day" applied to 2e (mapping swap) · CLAUDE.md rule 5 / JL-1 · DISMISSED.
  - A swapped mapping mis-credits inbound deposits through CBS postings, which the signer doesn't gate. But the bank's realised loss needs the wrongly credited customer to withdraw, which goes through the signer → bounded per transaction and per day.
  - The rightful customer's claim is a liability correction, not a loss of funds. The claim holds for realised outflow.
A8 · LEDGER.md:32 at run start "draft v3, fix block 1 of 2 used … R6 pending" vs RISK_REGISTER.md:3 "**Fix blocks 1 and 2 applied** after R5 and R6" · R6 R11 (header vs LEDGER) · DISMISSED. The register's claim re-derives true (both reports exist; fix block 2's changes address D-21). LEDGER was corrected during this run (11:25:49: "v3 Fix 2 … R7 pending"). Not a register defect.

PROBE G (would the rubric wave through a bad version of this register?): Yes, in two ways.
(1) MC-40 is applied one detection at a time. A register can add a detection whose artefacts break the healthy signal of *other* detections, and each passes in isolation. Here, honeytoken rows (DR-26) make DR-04 and DR-23 QUARANTINE on every cycle (A2).
  - Patch MC-40(d): "legitimate flows include every other detection's reads and scans; a detection that plants artefacts (canaries, honeytokens) names how each other detection excludes them."
(2) MC-43/MC-21 re-fetch quotes, but nothing checks the register's own statements about **archive state** ("archived so far / still to archive"). A stale status passed R6 (A1).
  - Patch MC-43: "every claim about what is or isn't archived is diffed against docs/sources/MANIFEST.md."
(Executor input sets, the gap behind A3, are now covered by MC-40(e) in RUBRIC fix block 4, added after this register version.)
PROBE F (would it fail a good version?): Yes, in one way. MC-40 requires labels to agree with THREAT_MODEL. When the threat model contradicts itself (T-T1:58 lists DR-06 after the fact for replay; residual 6:177 says replay "is not detected by any [R] check"), a good register can't agree with both, and either choice fails literally (A5).
  - Reword: "labels agree with THREAT_MODEL's threat rows and §D; contradictions inside THREAT_MODEL are routed to it, not charged to the register."

REGRESSION (two frozen units): LEDGER:20-33 shows 0 frozen units. Substitutes, chosen for the oldest mtimes (furthest from today's 11:1x edits):
(1) P0-constants (constants.md, 00:20). C-01, C-10/C-20/C-22, C-27, C-30/C-33, C-40, C-41, C-53, C-57 and C-64 were re-derived live today (R4). All match constants.md:13, 24, 35, 37, 42, 49, 61, 62, 72, 75, 90.
(2) P1-sequences (SEQUENCES.md, 2026-10-02 23:23).
  - :48 "range of 9999 blocks max" → live: span 9,999 accepted, 10,000 rejected.
  - :52 "dedupe on (chainId, txHash, logIndex). Ignore ERC-20 0x3600 log" → the live receipt has both logs at logIndex 0 and 1 with a 10^12 ratio, so crediting both would double-count.
  - :131 "maxFeePerGas at least 20 gwei … chainId 5042002" → live baseFee 20,000,000,000 and chainId 0x4cef52.
  - :312 "(RISK_REGISTER RR-2)" → still resolves to the ingestion risk that carries the DR-10 balance-delta check.
  - No regression.

Prior defects: D-21 CLOSED (residual 6 T-T2 half → 2e + RB-7; residual 7 → RB-8; residual 8 → RB-9; RB-7 wording agrees with THREAT_MODEL:176-179).

DEFECTS:
D-22 · docs/RISK_REGISTER.md:54 (5b "Still to archive: … POPIA") · Lens R, MC-43/MC-44 · minor. POPIA is archived (MANIFEST:50, hash re-derived, live re-fetch identical). It should read "POPIA archived; text not yet extracted or read (Q-T8, Q-R12)".
D-23 · docs/RISK_REGISTER.md:64 (6e → DR-26) · Lens R, MC-40(d) → MC-41 · minor. DR-26 has no specified healthy signal. Honeytoken rows are read in bulk by DR-04, DR-23 and DR-24 every cycle, and make DR-04 and DR-23 QUARANTINE falsely. 6e's only detection is therefore invalid.
  - Fix: route a DR-26 healthy-signal and exclusion spec to P1-threat-model (allowed reader identities and queries; DR-04/DR-23/DR-24 exclusion). In the register, flag 6e "pending DR-26 spec" or list it as a residual until then.
D-24 · docs/RISK_REGISTER.md:32 (2f → DR-22 "in the monitor") · Lens R, MC-40(c) · minor. The input DR-22 compares against (the screening/monitoring subject) has no monitor-readable source in CONTRACT, THREAT_MODEL:35 or Q-C18, and no CF item tracks it. MC-41 for 2f still holds through [P].
  - Fix: a new CF item for a CBS read of screening/monitoring subjects (extend Q-C18). Mark 2f "DR-22 needs CF-…".
D-25 · docs/RISK_REGISTER.md:70 (RD-01 executor) vs THREAT_MODEL.md:38 · Lens R, MC-40 label agreement / MC-45 · minor. The register defines RD-01 as adapter-run (the only placement that can PAUSE before CBS postings); the threat model says it runs in the monitor. The register (newer, claiming sync) neither agrees nor says it is ahead.

Routed out of unit (not counted):
- THREAT_MODEL internal inconsistency T-T1 (:58) vs residual 6 (:177) on DR-06 for approval replay → P1-threat-model (A5).
- THREAT_MODEL:35/ADR-008 "takes no inputs from the adapter" vs DR-23/DR-24/DR-04 reading the adapter's registry → P1-threat-model / P1-adr-008: say that the registry is read directly from the store as the *subject under comparison* (wording now in MC-40(b)).
- THREAT_MODEL:174 residual 4 still says "limits and shape allow-list cap the damage" (R6 A3, not yet fixed) → P1-threat-model.
- RUBRIC Probe G (1)-(2) and Probe F rewording above → P1-rubric (dated after the rubric's fix block 4, so queued under its cut-off rule).

VERDICT: NEGATIVE (4 defects: 0 blocking, 4 minor)
