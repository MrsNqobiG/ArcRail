VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md v2 after v2 fix block 2; sha256 3cc7b660a0d5…76cc3fa, mtime 2026-10-03 10:53:51) · commit: none (no HEAD; `git log` → "does not have any commits yet"; uncommitted working tree, verified 2026-10-03 08:56 UTC)

Criteria: KICKOFF_PROMPT.md §3, §4; CLAUDE.md; docs/RISK_REGISTER.md (sha256 04bb02d9…, unchanged since R5); docs/CONTRACT.md (sha256 d3aad774…, unchanged since R5); docs/THREAT_MODEL.md (sha256 094fd8c0…, mtime 10:50:53); docs/adr/ (ADR-001/004 mtime 10:51:17); docs/constants.md; docs/LEDGER.md; every report in docs/verification/. Every report predates RUBRIC.md (latest: P1-rubric-lensR-5.md 10:52:43), so all probe proposals were available to fix block 2. CF-7 and CF-8 are not counted as rubric defects.

CHECKS
- K1 Counts recounted by grep → PASS. 37 MC rows (MC-01..08, 10..24, 30..34, 40..48), 6 JL rows, 10 items in the money-path list (RUBRIC.md:18-27), import-graph closure rule at :29. LEDGER.md:31 "draft v2, fix blocks 2 of 2 used … R6 pending" matches. Frozen units in LEDGER: 0 of 11.
- K2 Arc constants re-fetched live with curl, 2026-10-03 08:56 UTC, all HTTP 200 → PASS.
  - https://docs.arc.io/arc/references/rpc-endpoints.md :64 "| **Chain ID (Testnet)** | `5042002` |"; :118 "Reduce the range to ≤9,999 blocks per request"; :44 "safely retry requests that return `-32014` after a brief backoff".
  - https://docs.arc.io/arc/references/evm-differences.md :203 "**The minimum base fee is 20 Gwei.**"
  - https://docs.arc.io/arc/references/usdc-system-events.md :35 `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` 18; :36 `0x3600000000000000000000000000000000000000` 6; :39 "A single ERC-20 `transfer()` emits **two** logs".
  - https://docs.arc.io/arc/references/gas-and-fees.md :126 "`transaction underpriced` | `maxFeePerGas` is lower than the 20 Gwei minimum base fee floor".
  - https://docs.arc.io/integrate/exchanges/custody.md :76 "contract is deployed at a precompile address:" (cited inline at CONTRACT.md:162).
  - https://docs.arc.io/arc/concepts/opt-in-privacy.md :29 "Privacy features are on the roadmap and not yet available on Arc." (C-64).
  - `cmp` against docs/sources/arc/: rpc-endpoints, usdc-system-events, gas-and-fees, opt-in-privacy and custody are byte-identical. evm-differences equals the `.REFETCH-later` copy, which is the Q-A14 drift already on record. `-32602`, `-32603` and "Blocked address" get 0 hits on every live page, consistent with C-41 and C-57 being UNVERIFIED (Q-A4, Q-A13).
- K3 MC-03 against CONTRACT §6.1, recomputed with Python bigint divmod → PASS (13/13 rows).
  - p=6: 0→(0,0); 1→(0,1); k−1→(0,999,999,999,999); k→(1,0); 10^18→(1,000,000,0); 1,000,000,500,000,000,000→(1,000,000, 500,000,000,000); 420,000,000,000,000→(420,0) (= 21,000×20 gwei); 7,374,356,000,000,000→(7,374, 356,000,000,000); (2^63−1)·10^12+10^12−1→(9,223,372,036,854,775,807, 999,999,999,999); next value → m = 2^63, which overflows i64, so the guard must PAUSE.
  - Odd dust: 123,456,789,012,345,678,901→(123,456,789, 12,345,678,901).
  - p=2: 10^18→(100,0); 1.5·10^16→(1, 5·10^15); 10^16−1→(0, 10^16−1); 7,374,356·10^9→(0, all dust); 1 wei→(0,1).
  - wei→units: 1,234,567,890,123,456,789→(1,234,567, 890,123,456,789). uint256 max has remainder 913,129,639,935.
  - Capacity: p=6 gives 9,223,372,036,854 USDC; p=2 gives about 9.22·10^16; p=18 gives about 9.22 USDC. All match §6.1. m·k+d = w for every row.
- K4 MC-10 recomputed (JCS over string arrays, then SHA-256) → PASS. Keys are 69 characters. `Ab`≠`ab`; `["a|b","reserve"]`≠`["a","b|reserve"]`; an embedded `","` ≠ a split. Case-return IDs: caseId "a" → `cr-401faa7ae9e8bc9facfafc42f579d569`; a 128-character caseId → `cr-f61bf387095fd1b1216f039f582a307e`; a 126-character caseId using `.:-_` → `cr-d75369a14743e3829e33e99e19bac461`. All are 35 characters and match `^[A-Za-z0-9._:-]{1,128}$`. caseSeq 0 and 1 give different keys.
- K5 Closure of R5 D1 (MC-11 delegation), re-traced on CONTRACT → PASS. I expanded the delegated rows using the new MC-11 wording at RUBRIC.md:49 ("no T4/T5 or SETTLED/RELEASED in a flow with no hold"):
  - :340 RET_SIGNED imports :298 "Rout, then T4 … SETTLED", which doesn't type-check.
  - :344 imports :306 "SETTLED (… → T4)", which doesn't type-check.
  - :353 imports :303 "T5 (condition 3) | RELEASED", which doesn't type-check.
  - All three now count as empty cells. The rubric now catches the R5 Probe G build. The contract side is routed as CF-7(a).
- K6 Closure of R5 D1 part 2 (MC-04 itemisation) → PASS. I simulated the contract-R4 mutant: a case return of R=500 from clearing, posted with the T4 fallback instead of T9.
  - Correct T9 gives (chain identity, CBS identity, G5.inbound item, G5.outbound item) = (0, 0, 0, 0).
  - The mutant gives (0, 0, 0, −500).
  - Only the itemisation that MC-04 now requires (RUBRIC.md:39) catches it.
- K7 Closure of R5 D2 (provenance) → PARTLY.
  - Closed: RR R4 Probe F is credited correctly (:143) and adopted at :80 ("Supplementary [R] detections need no named mutant"). TM R3 Probe G → MC-40(d) (:144). Contract R4 G(1)(2) (:146). ADR R4 G/F (:147, :92-94).
  - Not closed: see C1, C2, C3.
- K8 MC-12(b) re-applied to CONTRACT §5.8 (CONTRACT is byte-identical to the R5 input, sha d3aad774) → PASS, same as R5 K7. No correct row fails, and every final-but-unposted item expires to PAUSE.
- K9 MC-44 on RUBRIC.md, by script → PASS. Each cited ID resolves to exactly one definition in its home document: C-14/20/22/30/33/40/41/42/57, M-1/6/8/9, CF-1, CF-5 (with (g) at LEDGER.md:35), L-2/3/4/6, T-E2/E5/R3/T1, Q-A1/A14/P1, RR-1/3/6, P3.4. "THREAT_MODEL T-T1 replay rule" (:150) resolves to THREAT_MODEL.md:48.
- K10 MC-47 against CONTRACT → PASS. The §5.3–§5.6 branches give 8 classes, and the §5.2 table (:212-224) has the same 8 rows.
- K11 KICKOFF §3 exit bars → PASS. Branch coverage→MC-07; mutation→MC-08; drift 0→MC-05; scans→MC-33; citations→MC-21/43; matrix→MC-42/48.
- K12 CLAUDE.md coverage → PASS. N1→MC-20/23; N2→MC-33; N3→MC-45; N4→MC-34; N5→MC-21/43; N6→MC-42; I-INT→MC-01/02; I-CONV→MC-03; I-CONS→MC-04/05; I-ONCE→MC-10/14/18; I-FAIL→MC-11/12/19, JL-1.
- K13 Probe G arithmetic (:111) → PASS. A=1000 minor at p=6, dropped from Rout with no T4, gives −10^15 wei = −A·k.
- K14 Every probe proposal is adopted or logged as rejected with a reason that reconstructs (:7, :149-153) → FAIL. See C1, C2, C3.
- K15 Probe G re-run → YES, a bad signer passes. See C1.
- K16 Probe F re-run → YES, MC-41 read literally fails the current, correct L-5 row. See C2.
- K17 Regression. LEDGER has 0 frozen units, so I used the two substitutes furthest from the fix-block-2 edits (:39, :49, :80, :142-153):
  - (a) MC-23 (:65) vs THREAT_MODEL T-E5 (:85, rewritten 10:50) and ADR-001:9 (rewritten 10:51) → PASS. The refusal sets are equal: {EIP-712 incl. EIP-3009/permits, personal_sign, EIP-7702, approve/permit calldata, deploys}, empty `data`, "No Memo shape" until Q-P1, and chain ID 5042002 only (T-E2 :82, ADR-001:10).
  - (b) MC-03 money-path conversions → PASS (K3).
- K18 JL-1..JL-6 → [inspection-only] PASS. Each is a one-line question tied to a CLAUDE.md or KICKOFF §6 duty.

CANDIDATES (Lens A)
- C1 · RUBRIC.md:150 "The threat-model R4 Probe G about MC-24 and approval replay is handled in the design (THREAT_MODEL T-T1 replay rule, CF-5(g)) and needs no new rubric item, because MC-24's refusal test covers it once CF-5(g) is in CONTRACT" vs RUBRIC.md:66 MC-24, whose reconstruction is only "Forged approval JSON → refused" · Criteria: KICKOFF §4 Probe G / log probes; I-ONCE · **REAL (minor)**.
  - A replay presents a genuine, unforged `checkerAssertion` over the same `payloadDigest` at a new nonce, so MC-24's only test can't see it.
  - Bad build: the U9 signer verifies the assertion correctly but keeps no consumed-approval set. It passes:
    - MC-24 (forged JSON refused);
    - MC-23 (the shape is a valid type-2 send);
    - MC-17 (:55 "Every … transfer matches exactly one instruction … and one signer signing-log entry", which is per transfer and not one-to-one, so the replay matches the old instruction plus its own new log entry);
    - MC-41, because replay is named only in T-T1's control column (THREAT_MODEL.md:48) and not as a sub-risk, so no detection or [P] test is forced;
    - MC-07/08, which have nothing to cover when the branch is absent.
  - After the fact, DR-06 sees chain −A·k with no CBS debit and PAUSEs, so the error is detected but not prevented. That, and T-T1 being OPEN until Q-C10 (residual 4), is why this is minor.
  - The stated reason for not adopting doesn't reconstruct. This is the same class as R5 D2(ii).
- C2 · RUBRIC.md:151 "The threat-model R4 Probe F (MC-41 vs [I] on accepted residuals) is already satisfied: MC-41 as revised in fix block 1 accepts a blind sub-risk listed as a G1 residual" vs RUBRIC.md:81 MC-41 "or is listed as a G1 residual **with the CF item or question that will close it**" · Criteria: Probe F; KICKOFF §4 · **REAL (minor)**.
  - Re-trace on the current TM, where L-5 is correct:
    - THREAT_MODEL.md:119 "L-5 | Detectability | Anyone can see the bank's wallet flows and balances | Accepted residual … | [I]".
    - RISK_REGISTER.md:7 says "A risk is **blind** if it wouldn't show up as an error in normal operation", and L-5 never does.
    - Residual 2 (THREAT_MODEL.md:159) cites only C-64, a constants row. `grep -i privacy OPEN_QUESTIONS.md` gives 0 hits, and no CF item exists.
  - So MC-41 as written fails L-5 (and L-1, unless the L-7 [X] route is accepted). The disposition drops the very qualifier that causes the false fail.
  - Either MC-41 accepts "inherent residual accepted at G1, with the fact that makes it inherent", or the rubric defines when an inherent property is not a blind sub-risk.
- C3 · RUBRIC.md:80 "A sign-time **preventive** check isn't relabelled as a detection" has no credit. :135 credits only "the risk-register R5 Probe F (standard EVM signals need no citation)", which is part (2). Part (1) at P1-risk-register-lensR-5.md:76 ("labels agree per sub-risk → detection mapping; a register may cite a dual-role control by its preventive part") is neither credited nor listed as rejected. Fix block 2 removed the old mis-credit (:143) but didn't re-attach the content to its real source, as R5 C2(i) pointed out. Criteria: KICKOFF §4 (log probes); the rubric's own :7 "each probe proposal below is credited to its report" and :153 "Rejected proposals: none beyond the two" · **REAL (minor)**. The substance appears to be adopted, so this is provenance only.
- C4 · RUBRIC.md:94 "Relaxation (ADR R4 Probe F): for MC-21, a citation of URL plus access date is sufficient when MANIFEST maps that URL", which sits under "ADR-specific rules", vs CONTRACT.md:162 "https://docs.arc.io/integrate/exchanges/custody.md, archived" (no archive path, no access date) · Probe F (a good non-ADR citation fails MC-21's literal "inline (URL + archive path)") · **DISMISSED**.
  - CONTRACT:162 has no access date, so it fails under either reading. That's a CONTRACT citation gap (hint for P1-contract), not a false fail.
  - For a hypothetical dated non-ADR citation, the cost of compliance is one archive path string. This is a harmless near-miss, like contract R4's Probe F.
  - I verified the quote live (K2) and the MANIFEST mapping (MANIFEST.md:32, sha d70b6bea…).
- C5 · RUBRIC.md:80 MC-40 "(or the newer document says it is ahead)" · MC-44/45 decidability · **DISMISSED**. "Says it is ahead" requires an explicit statement in the newer document, which a verifier can check. It does not rely on mtime inference.
- C6 · RUBRIC.md:3 status line lists only the R1–R3 reports · traceability · **DISMISSED**. Cosmetic. That line describes the reframe, and the v2 fix-block logs (:132, :142) name R4 and R5.

DEFECTS
- D1 · docs/RUBRIC.md:150 (with :66 MC-24 and :55 MC-17) · Lens R / KICKOFF §4 Probe G, I-ONCE · minor.
  - Problem: the "not adopted" reason doesn't reconstruct, and a signer with no single-use approval rule passes every MC item.
  - Fix: add to MC-24 "a replayed genuine approval (same `payloadDigest`) at a different nonce → refused; the same-nonce replacement or cancel → allowed". Or log a rejection whose reason names the item that actually catches it.
- D2 · docs/RUBRIC.md:151 (with :81 MC-41) · Lens R / KICKOFF §4 Probe F · minor.
  - Problem: "already satisfied" misquotes MC-41, and MC-41 literally fails THREAT_MODEL L-5 (and L-1).
  - Fix: let MC-41 accept an inherent residual accepted at G1 with its cited cause (for example C-64), or define "blind" so that inherent public-chain properties are excluded. Then correct :151.
- D3 · docs/RUBRIC.md:80, :135, :153 · Lens R / KICKOFF §4 (log probes) · minor.
  - Problem: RR R5 Probe F(1) is neither credited nor rejected, so :7 and :153 are false by grep.
  - Fix: credit it in the MC-40 Source column and the log, or reject it with a reason.

Routed out of unit (not counted):
- P1-contract: CONTRACT.md:162 inline citation has no access date or archive path (C4).
- P1-threat-model: approval replay appears only in T-T1's control column and not as a named sub-risk with its own detection (C1). This reinforces TM R4 D6.

VERDICT: NEGATIVE (3 defects: 0 blocking, 3 minor)

Note for the operator: both R5 defects are closed in substance by reconstruction (K5, K6). The delegation and itemisation patches now catch the live CF-7 rows and the contract-R4 mutant. The three remaining defects are all in the probe-disposition log, where two dispositions give reasons that don't reconstruct. Each fix is a single-line edit. P1-rubric v2 has used 2 of 2 fix blocks, so per LEDGER.md:31 the next ladder step is regenerate (the last regen), unless the human directs otherwise at G1. The Probe F rewording of MC-07 still needs human acknowledgement at G1.

Phase 1 · units frozen 0/11 · streak 0/3 · rounds used 6/10 (P1-rubric) · regen budget left 1
