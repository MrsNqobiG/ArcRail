VERIFICATION · lens: A · target: P1-rubric (docs/RUBRIC.md v2 after v2 fix block 11; sha256 4d86338d957d6c461151409632242fb2f0e83d2bbe282cdabac107c984febb8d, as expected; mtime 2026-10-05 12:09:03 +0200, unchanged through the run, which ended 10:42 UTC) · commit: none (no HEAD; `git log` → "your current branch 'main' does not have any commits yet"; uncommitted working tree)

Criteria: .claude/agents/verifier.md; CLAUDE.md; KICKOFF_PROMPT.md §3 and the U1–U15 table; docs/RUBRIC.md; docs/LEDGER.md; docs/CONTRACT.md (sha256 d2f72422…, mtime 12:20:08 +0200, **changed since R15's d6768590…**, so the regression checks were redone against it); docs/adr/ADR-001-custody-signing.md (ce0106ea…); docs/adr/ADR-005, ADR-008; docs/constants.md; docs/OPEN_QUESTIONS.md; docs/GATES.md; docs/G1_PACKET.md; docs/sources/MANIFEST.md and the archives; tools/source_drift.py (sha256 5504b5e7…80e1); P1-rubric-lensR-2, -4, -5, -7, -15 (for earlier dispositions); the other units' latest reports (for the queue check).

Session notes:
- The guard hook was not loaded, so I applied its rules myself. The only RPC calls were **read-only calls to Arc testnet** `https://rpc.testnet.arc.io` (`eth_chainId` → `0x4cef52` = 5042002, checked first; `eth_blockNumber`; `eth_getLogs`; `eth_call`; `eth_getBlockByNumber`). No mainnet endpoint, no signing or sending method, no .env or key files.
- Other network access: the HTTPS GETs that `tools/source_drift.py` makes for the 33 MANIFEST URLs.
- I wrote no file except this report. The drift tool ran with `--out /dev/stdout`, and URL lists were diffed with process substitution.
- LEDGER changed during my run (12:20:33 → 12:42:00 +0200, now 3688c59e…). The newer version adds three queue rows (see C5). I use the newer version for the queue, and name it where it matters.

CHECKS
- K1 Target identity and counts → PASS. sha256 starts 4d86338d, as given. 37 MC rows, 6 JL rows, 18 (both) + 19 (code), 47 register rows, exactly one "Not adopted" (row 31, matching :237). Recounted by grep.
- K2 MC-21 shared method, run by me → PASS. Tool hash 5504b5e7…80e1 matches the version R13 read in full. Run at 2026-10-05 ≈10:35 UTC: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33". All 19 distinct docs.arc.io / developers.circle.com URLs cited in docs/*.md, docs/adr and docs/discovery are in MANIFEST (`comm -23` empty). Quotes the rubric relies on, checked in the archive the tool compared:
  - rpc-endpoints :64 "| **Chain ID (Testnet)** | `5042002` |"; :105 "`eth_getLogs` returns error `-32012` when the requested block range exceeds"; :108 "≤9,999-block chunks."; :43-44 "`-32014`";
  - gas-and-fees :38 "| **Minimum base fee (testnet)** | 20 Gwei |"; evm-differences.REFETCH-later :203 "**The minimum base fee is 20 Gwei.**";
  - usdc-system-events :35 (`0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`, 18) and :36 (`0x3600…0000`, 6);
  - cctp supported-chains-and-domains :141 "| 26 | Arc |"; opt-in-privacy :29 "not yet available on Arc"; contract-addresses :369 Blocklisted `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`.
- K3 Arc behaviours the rubric names, re-observed live on testnet (read-only, head ≈ 65,610,255) → PASS.
  - MC-16 / C-40: `eth_getLogs` with `toBlock − fromBlock = 10000` → `{"code":-32012,"message":"requested range too large"}`; with 9999 → `[]`.
  - MC-11(iii) / MC-16 / C-57 (undocumented, Q-A13): `eth_call` from `0x7099…79C8` with value 0 → `{"code":-32603,"message":"Blocked address"}`; control pair `0x…dEaD → 0x…bEEF` → `"0x"`.
  - MC-22 / C-30 / C-33: latest block `baseFeePerGas` `0x4a817c800` = 20,000,000,000 wei; `extraData` `0x00000004a817c800` (same value, 8-byte big-endian).
  - C-41 (`-32602` result cap) was not re-provoked; it stays UNVERIFIED under Q-A4, which is how MC-21 treats an observed-only fact.
- K4 MC-44 sweep of every ID the rubric cites → PASS. All 44 distinct IDs resolve to a row that says what the rubric claims: C-14, C-20, C-22, C-30, C-33, C-40, C-41, C-42, C-57, C-64 (constants :28-90); M-1, M-6, M-8, M-9 (:96-104); L-2…L-6, T-E2, T-E5, T-R3, T-T1 (THREAT_MODEL :80-156); RR-1, RR-3, RR-6 (RISK_REGISTER :21, :38, :62); P3.4 (cbs-port-requirements :54, "No silent auto-expiry"); Q-P1, Q-T8, Q-D1, Q-A1, Q-A14 (OPEN_QUESTIONS); G4/G5/G6 and T4 "only if fee > 0" (CONTRACT :170-172, :244), which MC-04's "fee = 0 means no G6 leg" matches; G-M 1–8 (GATES :15-25); CONTRACT §1.3-§1.7, §5.0-§5.8, §6.1 headings and "Results not shown in a row follow §1.5" (1 hit) in the changed CONTRACT.
- K5 MC-07 Probe F rewording routed to the human → PASS. G1_PACKET :34 "**RUBRIC Probe F (MC-07):** '100% of *reachable* branches' … This changes how a KICKOFF §3 exit bar is measured" — matches RUBRIC :123.
- K6 Signer duties vs the closed money-path list and the MC items → **FAIL** (C1, D1).
- K7 Probe G re-run on the actual artefact → **YES, a bad build passes** (D1). Detail under PROBES.
- K8 Probe F re-run on the actual artefact → no new false fail found. Detail under PROBES.
- K9 Regression, by reconstruction. No unit is frozen (LEDGER), so I used two substitutes as far as possible from fix block 11's edits (:3, :163, :229), both against the **changed** CONTRACT d2f72422:
  - (a) MC-03 vs CONTRACT §6.1 (:535-562), Python bigint `divmod` → PASS. Every p = 6 row (0; 1; k−1; k; 1 USDC; 1.0000005 USDC → (1,000,000, 500,000,000,000); 420,000,000,000,000 → (420, 0); 7,374,356,000,000,000 → (7,374, 356,000,000,000); the i64 boundary → (9,223,372,036,854,775,807, 999,999,999,999)) and every p = 2 row matches. 21,000 × 20 gwei = 420,000,000,000,000; 167,599 × 44 gwei = 7,374,356,000,000,000; 1,234,567,890,123,456,789 wei → (1,234,567, 890,123,456,789); uint256 max → remainder 913,129,639,935 with m > i64 max. Probe G arithmetic (:111): 1,000 minor × 10¹² = 10¹⁵ wei.
  - (b) MC-10 vs CONTRACT §1.3 (:58-72) → PASS. `K.recv` for (5042002, 0xab×32, "0", attempt "0") = arc1-970ee4c76bbeae19300510816cb88b62eb947aefe9baa8fac99ac454f3b0785b, 69 characters, the same as R11–R15. `Ab` vs `ab`, `["a|b","reserve"]` vs `["a","b|reserve"]` and attempt "0" vs "1" all give distinct keys.
- K10 JL-1…JL-6 (:96-104) → [inspection-only] PASS. Unchanged one-line anchors.

CANDIDATES
- C1 · The signer's monitor-attestation duty has no check and falls outside the closed money-path definition.
  - Evidence:
    - RUBRIC :17 "'Money-path module' means **exactly** the code implementing:" and :21 "4. U9 signer policy (shape allow-list, assertion check, limits);".
    - RUBRIC :80 MC-40(f): "**Enforcement fails closed when the executor goes silent** (for example, the signer stops when the monitor's attestation goes stale)". This is the only mention of attestation in the rubric (`grep -c -i attestation` → 1).
    - ADR-001 :22 duty 5: "**Monitor attestation (ADR-008):** sign only while holding a valid, fresh `ALL_CLEAR` … A valid, fresh **`PAUSE` is accepted and immediately stops signing**, overriding any unexpired `ALL_CLEAR`. Attestations that are stale or out of sequence … are **ignored**. With no valid `ALL_CLEAR` in force, the signer refuses." ADR-001 :42 "Monitor attestation (full protocol) … | Built in our policy engine".
    - ADR-001 :21 duty 4 (the consumed-approval replay record) is also not in item 4's parenthetical, though MC-24 tests it.
  - Criteria: KICKOFF §3 exit bars via MC-07/MC-08 (money-path scope); I-FAIL / JL-1; Probe G.
  - **REAL.**
    - Item 4 defines signer policy "exactly" as three duties. ADR-001 has six, and duty 5 is the enforcement point that MC-40(f) itself uses to make every monitor detection fail closed. Under ADR-008 the monitor is the single PAUSE authority, so this duty is what stops outbound money.
    - No MC item tests duty 5. MC-23 tests shape, MC-24 tests the assertion and replay, MC-22 tests the fee floor, and MC-19 tests two-person unpause. None injects a stale `ALL_CLEAR`, an out-of-sequence attestation, a `PAUSE` that should override an unexpired `ALL_CLEAR`, or no attestation at all.
    - The import-graph closure (:29) is only a partial safety net. It runs **downward** from listed paths. If the signer's entry point calls the policy module and a separate attestation module, the attestation module is not imported by any listed path, so it escapes MC-07/MC-08. Even when it is pulled in, a Phase 2 MONEY_PATH.md that leaves it out still recounts as complete against item 4's parenthetical.
    - The earlier dismissal does not cover this. R7 C8 dismissed a similar point "for this version" because ADR-008 was newer and PROPOSED, and left a forward hint. That hint was never routed to LEDGER (no CF item or queue row mentions it). Since then, MC-40(f) has come to rely on the attestation explicitly, and ADR-001 (attestation since ADRs fix 4) states it as an unconditional duty. The rubric already writes checks against PROPOSED designs (MC-23 Memo rule, MC-24 replay record from CF-5(g), MC-08 "ADR-007 tool"), so PROPOSED status is no reason to omit one.
    - None of the 11 LEDGER queue rows (12:42:00) mentions attestation, `ALL_CLEAR` or U9 (grep → 0). It is not queued.
- C2 · MC-01 covers "display" (:36), but the closed list has no display item.
  - Criteria: MC-44 / MC-01 scope.
  - **DISMISSED.** CONTRACT :523 "## 6. Unit mapping (U1 is the only implementation)" includes :531 "| any → display | Integer formatting only. Never show 18 dp to users (KICKOFF U11) |". Display conversion is therefore U1 code, and U1 is money-path item 1 (:18). MC-03's single-module import check also forces any display conversion through U1.
- C3 · :29 "explicitly excluded there with a reason" sets no acceptance criterion for the reason, and :29 names MC-01, MC-07 and MC-08 as what an excluded helper would escape, but not MC-34 (N4).
  - Criteria: Probe G; N4.
  - **DISMISSED.**
    - The closure is over "every module that a listed path imports, directly or indirectly". That includes third-party packages, so an LLM SDK reached from a money path must appear in MONEY_PATH.md, listed (MC-34 then fails) or visibly excluded for the verifier to judge.
    - MC-34's egress capture test runs against a declared allow-list, whichever module makes the call.
    - KICKOFF :182 allows operations AI only when it is self-hosted and only proposes.
    - R5 C5 reached the same verdict on the reason clause, and no new evidence changes it.
- C4 · MC-16 (:54) requires "bisection on `-32602`" but sets no floor. A single block holding more than 2,000 matching logs (C-41) cannot be bisected, and a bad build could skip that block.
  - Criteria: Probe G; I-FAIL.
  - **DISMISSED.** A skipped block of deposits leaves `Σ chainBalanceWei(S, t)` above `CBS_G2×k + D − F + Rin − Rout` (CONTRACT :452-458: "The residual must be **exactly 0 wei**, otherwise PAUSE"). MC-05 requires a zero-residual or drift-cell PAUSE test in every cell, so the miss fails closed through reconciliation. A floor clause would be a hint, not a defect.
- C5 · At 12:20:33 the LEDGER queue listed 8 reports. Three newer reports carrying rubric proposals were missing: P1-adr-008-lensR-6 :101/:103, P1-contract-lensR-11 :110-112 and P1-adrs-lensR-13 :165-169.
  - Criterion: RUBRIC :163 ("Any not yet processed are listed in the LEDGER … The rubric can be frozen only with an empty queue").
  - **DISMISSED.** All three postdate fix block 11 (12:15:19, 12:17:40 and 12:19:58, against RUBRIC 12:09:03), so under :163 they are not defects of this version. LEDGER is not my target either. LEDGER at 12:42:00 now lists all 11, so routing has caught up.
- C6 · GATES :10 G0 reads "Passed by the operator's 'continue'", with no name, role or date and no signed commit. Does MC-42 (:82) catch a gate marked passed without SIGNED-OFF wording?
  - Criteria: MC-42, N6, Probe G.
  - **DISMISSED.**
    - MC-42 covers "every line that sets SIGNED-OFF **or signs a gate**", whatever the wording, and MC-20 "accepts a gate only on that evidence". So a "Passed" G-M row can't unlock mainnet.
    - G0 is not a mainnet gate. LEDGER :8 records it openly as an operator decision with Phase 0 left unverified.
    - Whether G0 needs a signed commit is a GATES/G1 matter, not a rubric gap.

PROBES
- Probe G (would the rubric wave through a bad version?) → **YES.**
  - Scenario: a Phase 2 signer whose attestation check compares freshness with the wrong operator, or accepts an `ALL_CLEAR` whose sequence is ≤ the highest seen, or lets an unexpired `ALL_CLEAR` override a fresh `PAUSE`.
  - The adapter-side PAUSE tests (MC-05, MC-11(vi), MC-19) pass, because they assert the PAUSE state, not that the signer refuses afterwards.
  - MC-23 and MC-24 pass, because they test shape and approvals.
  - MC-07 and MC-08 pass if the attestation module is outside MONEY_PATH.md, which item 4's "exactly … (shape allow-list, assertion check, limits)" allows.
  - Result: outbound signing continues while the monitor has paused. → D1.
  - Also tried, no pass-through found:
    - relabelling an awkward cell as a "drift cell" (MC-05 still demands PAUSE, so the abuse fails closed);
    - the MC-16 single-block floor (C4, caught by §5.7);
    - a display float (C2, U1 by CONTRACT §6).
- Probe F (would the rubric fail a good version?) → **NO new false fail.**
  - MC-01's grep for `Number(` would hit a legitimate `Number(logIndex)`, but the Check column scopes the rule to amounts, fees, conversions and display, so the verifier doesn't fail it.
  - A good build that fails closed on a `-32602` with an unexpected message meets MC-16's "unknown or unclassified error stops ingestion".
  - A staged SIGNED expiry whose last stage is PAUSE passes MC-12(b) (R5 C3).
  - The MC-44 forward-reference Probe F in P1-adr-008-lensR-6 :103 is queued (LEDGER 12:42:00), so under :163 it is not counted here.

DEFECTS
- D1 · docs/RUBRIC.md :21 (money-path item 4) and the MC-20…MC-24 block (:59-66), with :80 MC-40(f) relying on the missing control · Lens A / KICKOFF §3 exit bars (MC-07, MC-08 scope), I-FAIL, Probe G · **minor**.
  - Problem: item 4 defines signer policy "exactly" as "shape allow-list, assertion check, limits". That leaves out ADR-001 duty 5, the monitor-attestation protocol, which is the enforcement MC-40(f) relies on for every monitor detection, and duty 4, the replay record. No MC item tests duty 5, so a signer that keeps signing on a stale or overridden `ALL_CLEAR` passes the rubric.
  - Why minor and not blocking: it is a (code)-phase gap, the import-graph closure catches it whenever the attestation code sits beneath a listed path, and the fix is one item's wording plus one test clause.
  - Fix hint:
    - item 4 → "U9 signer policy: every ADR-001 signer duty (assertion check, shape allow-list, limits and fee ceilings, replay record, monitor-attestation protocol, internal-move rule, signed-configuration load)";
    - add to MC-24, or a new MC-25 (code): negative tests for no `ALL_CLEAR`, a stale `ALL_CLEAR`, sequence ≤ highest seen, and a fresh `PAUSE` over an unexpired `ALL_CLEAR` → refuse; a fresh, in-sequence `ALL_CLEAR` → sign.

VERDICT: NEGATIVE (1 defect: 0 blocking, 1 minor)

Notes for the operator:
- This resets the P1-rubric streak (R15 POSITIVE was 1/3). D1 is a new Probe G finding, not a regression: R15's checks all still reconstruct, including against the CONTRACT that changed after R15.
- The rubric is under the standing grant (extra 1 of 3 used, by fix block 11). D1 has 0 blocking defects, so a fix block 12 fits the grant without asking.
- Freeze still needs an empty queue. LEDGER now lists **11** queued reports (12:42:00), not the 8 R15 counted.
- Forward hint R7 C8 was never routed to LEDGER. D1 supersedes it.

Phase 1 · units frozen 0/11 · streak 0/3 (P1-rubric, reset by this pass; pending main-agent record) · rounds used 10/10 + grace 2/2 + extra 3 (P1-rubric; standing grant 1 of 3) · regen budget left 1
