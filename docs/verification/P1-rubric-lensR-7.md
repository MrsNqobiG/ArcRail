VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md v2 after v2 fix block 3; sha256 44ec12a94ddf…5d22925c8, mtime 2026-10-03 11:11:17 +0200) · commit: none (no HEAD; `git log` → "does not have any commits yet"; uncommitted working tree, verified 2026-10-03 09:11–09:16 UTC)

Criteria: KICKOFF_PROMPT.md §3, §4; CLAUDE.md; docs/RISK_REGISTER.md (sha 04bb02d9…); docs/CONTRACT.md; docs/THREAT_MODEL.md; docs/adr/; docs/constants.md; docs/LEDGER.md; every report in docs/verification/. Snapshot note: while I was verifying, CONTRACT.md (11:15:38, sha d3aad774 → b286d672), THREAT_MODEL.md (11:13:20, sha 094fd8c0 → 3cfd08e0), the new adr/ADR-008-independent-monitor.md (11:13:38), OPEN_QUESTIONS.md and LEDGER.md (11:13:49) were edited by other blocks. RUBRIC.md did not change during the run. Artefacts newer than RUBRIC.md are not held against it. CF items in LEDGER are not counted as rubric defects.

CHECKS
- K1 Counts recounted by grep → PASS. 37 MC rows (MC-01..08, 10..24, 30..34, 40..48), 6 JL rows, 10 money-path items (RUBRIC.md:18-27), import-graph closure rule at :29. LEDGER frozen units: 0 (`| frozen` gives 0 hits).
- K2 LEDGER row for this unit vs RUBRIC → FAIL. LEDGER.md:33 (as of 11:13:49) still says "draft v2, fix blocks 2 of 2 used … R6 pending. **If R6 fails → next ladder step for v2: regenerate (last regen)**". Missing: the R6 verdict (NEGATIVE, 0+3, in P1-rubric-lensR-6.md) and fix block 3. RUBRIC.md:126 says "Changes since then come only from verifier findings, each logged in LEDGER under P1-rubric", so for fix block 3 that claim is false. By contrast, the P1-threat-model row (LEDGER.md:31) was updated with its R5 verdict and Fix 2. See D4.
- K3 Arc constants re-fetched live with curl, 2026-10-03 09:13 UTC, all HTTP 200 → PASS.
  - https://docs.arc.io/arc/references/rpc-endpoints.md :64 "| **Chain ID (Testnet)** | `5042002` |"; :108 "≤9,999-block chunks."; :44 "safely retry requests that return `-32014` after a brief backoff."
  - https://docs.arc.io/arc/references/evm-differences.md :203 "**The minimum base fee is 20 Gwei.**"
  - https://docs.arc.io/arc/references/usdc-system-events.md :35 `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` … 18; :36 `0x3600000000000000000000000000000000000000` … 6; :39 "A single ERC-20 `transfer()` emits **two** logs".
  - https://docs.arc.io/arc/references/gas-and-fees.md :64 "Set `maxFeePerGas` to at least **20 Gwei**."
  - https://docs.arc.io/arc/concepts/opt-in-privacy.md :29 "Privacy features are on the roadmap and not yet available on Arc." This is C-64, which MC-41's new example relies on.
  - `cmp` against docs/sources/arc/: rpc-endpoints, usdc-system-events, gas-and-fees, opt-in-privacy and custody are byte-identical. evm-differences equals the `.REFETCH-later` copy, which is the Q-A14 drift already on record. `-32602`, `-32603` and "Blocked address" get 0 hits on all live pages, consistent with C-41 and C-57 (constants.md:62, :75) being marked "not in docs".
- K4 MC-03 vs CONTRACT §6.1, recomputed with Python bigint divmod → PASS (13/13 rows, m·k+d = w for every row).
  - p=6, k=10^12: 0→(0,0); 1→(0,1); k−1→(0,999,999,999,999); k→(1,0); 10^18→(1,000,000,0); 1,000,000,500,000,000,000→(1,000,000, 500,000,000,000); 420,000,000,000,000→(420,0) = 21,000×20 gwei; 7,374,356,000,000,000→(7,374, 356,000,000,000); (2^63−1)·10^12+(10^12−1)→(9,223,372,036,854,775,807, 999,999,999,999). One more wei gives m = 2^63, which overflows i64, so the guard must PAUSE.
  - Odd dust: 123,456,789,012,345,678,901→(123,456,789, 12,345,678,901).
  - p=2, k=10^16: 10^18→(100,0); 1.5·10^16→(1, 5·10^15); 10^16−1→(0, 10^16−1); 7,374,356·10^9→(0, all dust).
  - wei→units: 1,234,567,890,123,456,789→(1,234,567, 890,123,456,789). uint256 max mod 10^12 = 913,129,639,935.
  - Capacity: p=6 gives 9,223,372,036,854 USDC; p=2 about 9.22·10^16; p=18 about 9.22. All match §6.1.
- K5 MC-10 recomputed (compact JSON over string arrays = JCS, SHA-256) → PASS.
  - Keys are 69 characters. `Ab`≠`ab`. `["a|b","reserve"]`≠`["a","b|reserve"]`.
  - Case-return IDs: caseId "a", seq 0 → `cr-401faa7ae9e8bc9facfafc42f579d569`; seq 1 → `cr-f44d5ef09dc9959791d061a74772a1bb`; a 128-character caseId → `cr-f61bf387095fd1b1216f039f582a307e`; a 126-character caseId using `._:-` → `cr-2b31f8015b76bad4fab794a6d3b306b1`. All are 35 characters and match `^[A-Za-z0-9._:-]{1,128}$`.
- K6 Closure of R6 D1 (MC-24 replay) → PASS. RUBRIC.md:66 now reads "keeps a consumed-approval record: a given `payloadDigest` is signed at most once, except for a same-nonce replacement or cancel of the same instruction", with the test "A replayed genuine approval at a different nonce → refused".
  - Re-run of R6's bad build (a signer that verifies the assertion but keeps no consumed set): the new test fails it. Mutant "delete the consumed-set lookup" → the replay test goes red.
  - The exception is coherent: CONTRACT §1.3 (:87) computes `payloadDigest` over {amountWei, asset, chainId, destination, instructionId}, and "Nonce and fees are left out on purpose", so a same-nonce fee bump keeps the digest.
  - Consistent with LEDGER CF-5(g) and with THREAT_MODEL T-T1 "Replay rule" (:58). See C3 for a remaining gap.
- K7 Closure of R6 D2 (MC-41 and inherent residuals) → PASS. RUBRIC.md:81 accepts "an inherent residual … listed as a G1 residual with its cited cause". Re-traced on the current THREAT_MODEL: L-1 (:125) and L-5 (:129) are both [I]; residual 2 (:172) reads "L-1 and L-5 (public flows) are inherent until Arc privacy goes live (C-64)"; C-64 is constants.md:90 and was re-fetched verbatim in K3. MC-41 no longer fails the good row.
- K8 Closure of R6 D3 (RR R5 Probe F(1) credit) → PASS. :152 credits "the risk-register R5 Probe F part (1)" → MC-40's last sentence. The source exists at P1-risk-register-lensR-5.md:76.
- K9 MC-44 on the fix-block-3 references → PASS.
  - "threat-model R4 Probe G on approval replay" → P1-threat-model-lensR-4.md:64 "MC-24 adds 'an approval (payloadHash) is signed for at most one nonce'".
  - "threat-model R4 Probe F on [I]" → :65.
  - "LEDGER 2026-10-03" → LEDGER.md:13 (operator quote "Allow all extra fix blocks necessary and correct rubrics defects").
  - CF-5(g) → LEDGER.md:36. "CONTRACT §1.3" → CONTRACT.md:58/87.
- K10 Every probe proposal in docs/verification/ is adopted or logged as rejected (RUBRIC.md:7 "every Phase 1 verifier report in `docs/verification/` (each probe proposal below is credited to its report)"; :154 "Not adopted, with reasons: none"; :156 "Rejected proposals: none") → FAIL.
  - Four reports were written after the R6 input and before fix block 3 (10:55–11:00, versus RUBRIC 11:11:17). Together they contain 11 rubric proposals (counting TM R5 (d) and (e) separately), and none appears in RUBRIC.md. A grep of RUBRIC.md for "risk-register R6", "contract R5", "threat-model R5" and "ADR R5" returns 0 hits.
  - The list is in D1.
- K11 KICKOFF §3 exit bars → PASS. Branch coverage→MC-07 (with the Probe F rewording and the G1 human-ack flag at :123); mutation→MC-08; drift 0→MC-05; scans→MC-33; citations→MC-21/43; matrix→MC-42/48.
- K12 CLAUDE.md coverage → PASS. N1→MC-20/23; N2→MC-33; N3→MC-45; N4→MC-34; N5→MC-21/43; N6→MC-42; I-INT→MC-01/02; I-CONV→MC-03; I-CONS→MC-04/05; I-ONCE→MC-10/14/18/24; I-FAIL→MC-11/12/19, JL-1.
- K13 Probe G arithmetic (:111) → PASS. A=1000 minor at p=6 dropped from Rout with no T4 gives −10^15 wei = −A·k.
- K14 Probe G re-run on the current artefact → YES, two bad builds pass every MC item. See C2 and C3.
- K15 Probe F re-run → no false fail that matters. C5, C6 and C7 were examined and dismissed.
- K16 Regression. LEDGER has 0 frozen units, so I used the two substitutes furthest from the fix-block-3 edits (:3, :66, :81, :149-156):
  - (a) MC-03, the money-path conversions → PASS (K4). The §6.1 rows are unchanged in the 11:15 CONTRACT edit (CONTRACT.md:476-484 re-grepped).
  - (b) MC-16, MC-20 and MC-22, the Arc constants (9,999 paging, `-32014` retry, chain ID 5042002, 20 gwei floor) → PASS (K3).
- K17 JL-1..JL-6 → [inspection-only] PASS. Each is a one-line question tied to a CLAUDE.md or KICKOFF §6 duty.

CANDIDATES (Lens A)
- C1 · RUBRIC.md:7 "every Phase 1 verifier report in `docs/verification/` (each probe proposal below is credited to its report)"; :154 "Not adopted, with reasons: none."; :156 "Rejected proposals: none." · Criteria: KICKOFF §4 ("log both probes"; derive fresh); same class as R5 D2 and R6 D3 · **REAL (minor)**. Unlogged proposals, all written before RUBRIC.md:
  - P1-risk-register-lensR-6.md:110 MC-40 "(d) the action on a non-zero result (PAUSE, QUARANTINE, page) is specified in CONTRACT, or tracked as a CF item".
  - P1-risk-register-lensR-6.md:112 MC-41/45 diff of THREAT_MODEL residuals against RISK_REGISTER rows.
  - P1-risk-register-lensR-6.md:114-115 Probe F, label agreement pinned to a named THREAT_MODEL version.
  - P1-contract-lensR-5.md:67 MC-47 traces every §5.2 cell to the row that performs it.
  - P1-contract-lensR-5.md:68 MC-10 enumerates re-issue paths.
  - P1-contract-lensR-5.md:70 Probe F MC-12(a) "every state in which an item can wait".
  - P1-threat-model-lensR-5.md:70 MC-40 "(d) the detection's executor and its PAUSE/paging path are outside the compromise domain …; (e) a sampled scope must include every item carrying the mutant's discriminating feature".
  - P1-threat-model-lensR-5.md:71 Probe F "one concrete mutant per sub-risk".
  - P1-adrs-lensR-5.md:124 "ADRs that touch the same control agree with each other".
  - P1-adrs-lensR-5.md:125 Probe F MC-43 "URL resolvable through MANIFEST".
  - The prior verifier's precedent holds: a timing gap is not negligence, but every proposal "still has to be logged" (P1-rubric-lensR-5.md:66). Several of these are probably rejectable (see C5–C7), but none is logged, so :154 and :156 are false by grep.
- C2 · RUBRIC.md:80 MC-40 (a)–(d). The four clauses cover the mutant's fit, input and scope independence, input existence and the healthy signal. **No clause covers what happens when the detection fires** · Criterion: KICKOFF §4 Probe G; CLAUDE.md "any reconciliation drift … pauses outbound movement and pages a human" · **REAL (minor)**.
  - Bad register, built by reconstruction: map RR-4 4b to RD-03 (RISK_REGISTER.md:72) but drop its "Any residual → PAUSE (CF-5(b))". CONTRACT.md:395 makes the per-role check "diagnostic".
  - That register passes (a): the duplicate-T6 mutant is a 4b instance. It passes (b): the inputs are `eth_getBalance` and CBS balances. It passes (c): both exist. It passes (d): the healthy signal is residual 0. MC-41 accepts it because the detection is "valid under MC-40". No other MC item reads detection actions in Phase 1.
  - The same applies to a detection whose executor or PAUSE path sits inside the compromise domain of the threat it serves. That is the TM R5 D1 class, which now drives ADR-008. MC-40(b) protects inputs and scope only, not the output.
  - Two independent verifiers (RR R6 Probe G(1), TM R5 Probe G) converged on this.
  - Minor rather than blocking, because JL-1 ("does money stop and does a human get paged, and is that what actually happens?") catches it on inspection, and TM R5 did catch it that way.
- C3 · RUBRIC.md:66 MC-24 "keeps a consumed-approval record: a given `payloadDigest` is signed at most once …" with the reconstruction "A replayed genuine approval at a different nonce → refused" · Criterion: KICKOFF §4 Probe G; I-ONCE · **REAL (minor)**.
  - Bad build: U9 holds the consumed set in process memory, or one set per signer replica (ADR-001 HSM or custodian deployments typically run more than one instance).
  - The listed test runs in one process and passes. MC-08 mutation doesn't help, because a persistence omission is not a mutant of existing code. MC-14 concerns nonces, not approvals. MC-18 concerns the outbox and inbox, not the signer's state.
  - After a restart or failover, the same genuine approval signs a second payout at a new nonce. "At most once" is violated, and only DR-25 (THREAT_MODEL.md:163, monitor, after the fact, inputs pending CF-5(f)) sees it.
  - This has the same shape as R6 C1 (the check text is right but the method can't see the failure). Minor, because an after-the-fact detection exists and T-T1 stays OPEN until Q-C10 anyway (residual 4).
- C4 · LEDGER.md:33 "draft v2, fix blocks 2 of 2 used … R6 pending. If R6 fails → next ladder step for v2: regenerate (last regen)" vs RUBRIC.md:3 "(then v2 fix blocks 1, 2 and 3)", :149 "v2 fix block 3 (after rubric R6 …)" and :126 "each logged in LEDGER under P1-rubric" · Criteria: KICKOFF §4 Ledger (verdict column); RUBRIC's own :126 · **REAL (minor)**.
  - The R6 NEGATIVE verdict and fix block 3 are not in the unit's LEDGER row, which still points to a regenerate step that the operator decision at LEDGER.md:13 superseded.
  - LEDGER was rewritten at 11:13:49, after RUBRIC.md, and that edit updated the P1-threat-model row but not this one.
- C5 · RUBRIC.md:94 "for MC-21, a citation of URL plus access date is sufficient when MANIFEST maps that URL" (MC-21 only) vs MC-43 :83 "URL + archive path + access date" and ADR-004:3 "`docs/sources/fic/`, 2026-10-02", with no URL (the URL is only in MANIFEST.md:42) · Criterion: Probe F on MC-43 · **DISMISSED as a standalone false fail**.
  - ADR-004 passes through MC-43's "or listed as Q-R…" branch (Q-R3).
  - For a hypothetical unlisted citation, the cost of compliance is one URL string, already available in MANIFEST. That is a harmless near-miss, the same ruling as R6 C4.
  - It still counts under C1 as unlogged.
- C6 · RUBRIC.md:81 "An inherent residual (a property of the public chain or of the business itself, not a defect in our controls …)". Probe G: could an author label a control gap as inherent to escape the CF-item requirement? Probe F: is L-1 inherent, given that it follows from the ADR-006 address model? · **DISMISSED**.
  - The clause requires a "cited cause", and the verifier re-traces it.
  - L-1's linkability comes from on-chain publicity (C-64, residual 2 at THREAT_MODEL.md:172). The address model changes only its granularity, and the ADR-006 trade-off is itself a G1 human decision.
  - A control defect has no citable external cause, so it can't qualify.
- C7 · RUBRIC.md:80 "names **one concrete mutant**" with (a) "an instance of the sub-risk it is mapped to" (TM R5 Probe F: does this fail a detection shared by several sub-risks?) · **DISMISSED**.
  - Read literally, (a) is met by a shared mutant that is an instance of each mapped sub-risk.
  - Where it is not, failing the mapping is the correct result: TM R5 itself counted D8 and D9 only for that reason.
  - No good artefact is failed. It is still unlogged (C1).
- C8 · Money-path list RUBRIC.md:22-26 (U9 "shape allow-list, assertion check, limits"; U12 "reconciliation and circuit breaker") vs ADR-008 (11:13:38), where the signer refuses without a fresh monitor `ALL_CLEAR` attestation and the monitor runs outside the adapter · Criterion: MC-07, MC-08 and closure scope · **DISMISSED for this version**.
  - ADR-008 is newer than RUBRIC.md and is still PROPOSED.
  - The list is designed to grow by LEDGER entry (:29).
  - Forward hint: if ADR-008 B is chosen, add "monitor attestation check (U9)" and "independent monitor (U12 relocated)" to the list.
- C9 · RUBRIC.md:152 credits RR R5 Probe F(1) with the words "a sign-time preventive check isn't relabelled as a detection", but the source wording (P1-risk-register-lensR-5.md:76) is "labels agree per sub-risk → detection mapping; a register may cite a dual-role control by its preventive part" · Criterion: provenance fidelity · **DISMISSED**. This is a paraphrase of the adopted substance, which R6 K7 and C3 accepted. The source is resolvable and the effect on verdicts is nil. Cosmetic.

DEFECTS
- D1 · docs/RUBRIC.md:7, :154, :156 · Lens R / KICKOFF §4 (log probes) · minor.
  - Problem: 11 probe proposals from P1-risk-register-lensR-6, P1-contract-lensR-5, P1-threat-model-lensR-5 and P1-adrs-lensR-5 are neither adopted nor rejected.
  - Fix: log each one as adopted (with its target MC) or rejected with a reason that reconstructs.
- D2 · docs/RUBRIC.md:80 (MC-40) · Lens R / KICKOFF §4 Probe G, CLAUDE.md fail-closed · minor.
  - Problem: no clause requires a detection's fail-closed action (PAUSE, QUARANTINE, page) to exist in CONTRACT or a CF item, or requires its executor and PAUSE path to sit outside the compromise domain of the threats it is mapped to.
  - Fix: add the clause, or log a rejection that names the item that catches it mechanically.
- D3 · docs/RUBRIC.md:66 (MC-24) · Lens R / Probe G, I-ONCE · minor.
  - Problem: the consumed-approval record isn't required to be durable or shared across signer instances, and the only test runs in one process.
  - Fix: add "the record is durable and shared by every signer instance; test: replay after a signer restart, and replay to a second instance → refused".
- D4 · docs/LEDGER.md:33 (P1-rubric row), together with docs/RUBRIC.md:126 · Lens R / KICKOFF §4 Ledger · minor.
  - Problem: the R6 verdict (NEGATIVE 0+3) and v2 fix block 3 are not recorded. The row still says "fix blocks 2 of 2 used … R6 pending … regenerate".
  - Fix: update the row.

Routed out of unit (not counted):
- Forward to P1-rubric when ADR-008 is decided: extend the money-path list (C8).

VERDICT: NEGATIVE (4 defects: 0 blocking, 4 minor)

Note for the operator: all three R6 defects are closed by reconstruction (K6, K7, K8). Two of the four new defects (D1, D4) are record-keeping. D2 and D3 are substantive Probe G gaps; each is closed by one added clause. No conversion, key or constant check regressed.

Phase 1 · units frozen 0/11 · streak 0/3 · rounds used 7/10 (P1-rubric) · regen budget left 1
