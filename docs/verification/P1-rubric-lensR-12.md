VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md v2 after v2 fix block 8, grace round 2 of 2, final; sha256 099157bfc28289d8…, mtime 2026-10-05 10:42:58 +0200, unchanged during the run 08:44–08:55 UTC) · commit: none (no HEAD; `git status` → "your current branch 'main' does not have any commits yet"; uncommitted working tree)

Criteria: KICKOFF_PROMPT.md §3, §4; CLAUDE.md; .claude/agents/verifier.md; docs/RISK_REGISTER.md; docs/CONTRACT.md (sha256 6e0c6cdd…, the same hash as in R11); docs/THREAT_MODEL.md (36256ace…); docs/adr/; docs/constants.md; docs/sources/MANIFEST.md; docs/LEDGER.md (f928e6df…, mtime 10:42:58 +0200, edited together with RUBRIC); every report in docs/verification/.
Session note: the guard hook was not loaded. This run made **no RPC calls** (testnet or mainnet), signed nothing, and read no .env or key files. The only network access was HTTPS GETs of the public documentation and regulator pages listed in MANIFEST (through `tools/source_drift.py`), plus two independent `curl` GETs of docs.arc.io pages. I ran the drift tool with `--out` pointed at my scratchpad, not at docs/.

CHECKS
- K1 Counts, recounted by grep → PASS.
  - 37 MC rows (`grep -c "^| MC-"`) and 6 JL rows.
  - Tags: 18 (both) + 19 (code). That is unchanged from R11.
  - The money-path list has 10 items (:18-27).
  - The register has 47 rows (`grep -cE "^\| [0-9]+ \| "`), numbered 1–47 with no gaps (awk NR check).
  - Exactly one row has a non-adopted decision (row 31), which matches :232.
  - LEDGER rubric queue: "(none yet)", which matches :163 "the queue is empty as of this version".
- K2 Arc constants (MC-21), checked by reconstruction → PASS.
  - Re-ran `python3 tools/source_drift.py` myself at 2026-10-05 08:51 UTC: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33". All 40 MANIFEST rows match the tool's ROW regex (41 table lines, of which 1 is the header). The body is byte-identical to the shared 08:37 UTC report.
  - I read the tool (stdlib only, read-only). It compares live bytes with the newest archive for each URL.
  - I checked it independently with `curl`. The live sha256 of rpc-endpoints.md and usdc-system-events.md equals the archive sha256 (80324031894c8681…, 69cc24d8d3a2381c…).
  - Every Arc/Circle doc URL cited in constants.md, CONTRACT, THREAT_MODEL, RISK_REGISTER, the ADRs, OPEN_QUESTIONS, discovery and RUBRIC is in MANIFEST. The only cited URLs that are not are the RPC/explorer endpoint values themselves.
  - Quotes, checked against the archives that are identical to the live pages:
    - arc_references_rpc-endpoints.md :64 "| **Chain ID (Testnet)** | `5042002` |"; :105 "`eth_getLogs` returns error `-32012` when the requested block range exceeds"; :108 "≤9,999-block chunks."; :44 "safely retry requests that return `-32014` after a brief backoff."
    - usdc-system-events.md :35 "| **Native USDC** (system, EIP-7708) | `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` | `Transfer` | 18 |"; :36 "| **ERC-20 USDC** (NativeFiatToken) | `0x3600000000000000000000000000000000000000` | `Transfer` | 6 |"; :39 "A single ERC-20 `transfer()` emits **two** logs".
    - gas-and-fees.md :38 "| **Minimum base fee (testnet)** | 20 Gwei |"; evm-differences.REFETCH-later.md :203 "**The minimum base fee is 20 Gwei.**"
    - contract-addresses.md :210 "| **TokenMessengerV2** | 26 |" and :212 "| **MessageTransmitterV2** | 26 |" (testnet tab).
    - opt-in-privacy.md :29 "Privacy features are on the roadmap and not yet available on Arc."
  - The method question (whether MC-21 may rely on someone else's report) is D3.
- K3 MC-03 vs CONTRACT §6.1 (:536-556), recomputed with Python bigint divmod → PASS.
  - All 9 p = 6 rows and all 4 p = 2 rows match.
  - Max row + 1 wei gives m = 2⁶³ (the overflow guard at :530 fires).
  - uint256 max: remainder 913,129,639,935, and m > i64 max.
  - wei→units: 1,234,567,890,123,456,789 → (1,234,567, 890,123,456,789), matching :558.
  - 21,000 × 20 gwei = 420,000,000,000,000; 167,599 × 44 gwei = 7,374,356,000,000,000.
  - Extra odd values, each satisfying m·k + d = w with 0 ≤ d < k:
    - 2,718,281,828,459,045,235,360,287 → (2,718,281,828,459, 45,235,360,287) at p = 6, and (271,828,182, 8,459,045,235,360,287) at p = 2;
    - 10¹²+7 → (1, 7) / (0, 1,000,000,000,007);
    - 3·10¹⁶−1 → (29,999, 999,999,999,999) / (2, 9,999,999,999,999,999).
- K4 MC-10 keys recomputed against CONTRACT §1.3 (JCS of a string array = compact JSON, SHA-256) → PASS.
  - K.recv(5042002, 0xab×32, "0", "0") = arc1-970ee4c76bbeae19300510816cb88b62eb947aefe9baa8fac99ac454f3b0785b. It is 69 characters, the same value as R11 and contract R7.
  - `Ab` ≠ `ab`; `["a|b","reserve"]` ≠ `["a","b|reserve"]`; attempt "0" ≠ "1".
- K5 Probe G arithmetic (:111) → PASS. A = 1,000 minor, p = 6 → residual −10¹⁵ wei = −A·k.
- K6 Closure of R11 D1 (global rule for operation results) → PASS.
  - :49(i) now reads "A result handled by a **stated global rule** (for example CONTRACT §5 "Results not shown in a row follow §1.5") counts as its row in every state it covers, as for events in (ii)". The quoted text is in CONTRACT :218 "Results not shown in a row follow §1.5: UNRESOLVED and CONFLICT → **PAUSE**", under §5 (:212). §1.5 is at :126.
  - I re-ran contract R7's Probe F: the MC-11 script now counts :218 as the UNRESOLVED/CONFLICT row in every §5 state, so a correct contract is no longer failed.
  - The register gains row 41 (contract-lensR-7:58). That line is the proposal: "likewise MC-11(i) for the §1.5 UNRESOLVED/CONFLICT defaults".
- K7 Closure of R11 D2 (planted artefacts) → PASS. :80(d) now reads "A detection that **plants artefacts** (canaries, honeytokens) names how each other detection excludes them". I re-ran R11 C2's Probe G: a TM whose DR-26 honeytokens are not excluded from the DR-04/DR-23 scans now fails (d). Wording point: C4 (dismissed).
- K8 Closure of R11 D3 ([X] cadence) → PASS.
  - :80 now reads "**An [X] detection that MC-41 relies on** must also meet (c), (e) and (f), and must state **its owner, its cadence** (how often the anchor is checked; it must be no slower than the age of the money it protects, or the sub-risk is a residual), its input, and its action on a finding." "Anchor" resolves to THREAT_MODEL :14 "[X] | External anchor".
  - I re-ran R11 C3's Probe G (RB-7 as an annual audit): annual is slower than every §5.8 age, so the blind sub-risks become G1 residuals and MC-41 no longer accepts the [X] as their detection.
  - Residual wording point: C5 (dismissed).
- K9 Register rows 41–46, re-traced clause by clause against the source lines → PASS 6/6.
  - Row 41: see K6.
  - Row 42: P1-threat-model-lensR-8.md:73 ("every reference input has an owner, and its integrity **and confidentiality** controls are stated; if its compromise amplifies another threat … that is a threat row"). It landed at :80(b): "**Every reference artefact** (… an xpub, a honeytoken list, a WORM anchor, a credential registry, Treasury's list) **appears as an asset in THREAT_MODEL**, with its confidentiality and integrity threats". The owner part is held by (c), "an artefact with a named owner". TM threat rows carry a control column (for example T-T2 :78), so controls follow. The amplification threat is an instance of "its confidentiality threats", as the current TM's T-I2 (:96, xpub plus child key → parent key) shows. [inspection-only] for "threat row implies control".
  - Row 43: :74. It landed at :80 "or LEDGER routes the sibling's fix as an open CF item". The proposal's qualifier "naming each disagreement" was dropped; see C3 (dismissed).
  - Row 44: P1-adrs-lensR-9.md:141. It landed at :85 "Each question clause is compared **clause by clause** with the duty it cites", together with the existing "or the ADR states where else it is enforced".
  - Row 45: :142. It landed at :85 "an ADR's restatement of a Q row matches it or explicitly defers to the OPEN_QUESTIONS wording".
  - Row 46: :144-146. It landed at :85 "± the smallest amount the flow can carry: 1 base unit, or `k` wei where amounts are multiples of `k`".
- K10 Register row 47 → FAIL. Its source "main agent, LEDGER 2026-10-05" resolves to no LEDGER entry. `grep 2026-10-05 LEDGER.md` matches only CF-9 ("Q-C17 done 2026-10-05") and CF-20 ("2026-10-05 source-drift run … No quoted text changed"). Neither proposes an MC-21 change, and the LEDGER :33 Fix 8 summary doesn't mention MC-21. See D2. The method itself: see D3.
- K11 Queue completeness → PASS.
  - The only reports on other units newer than fix block 7 (12:14 +0200, 2026-10-03) are P1-threat-model-lensR-8 (12:22) and P1-adrs-lensR-9 (12:11, queued in R11). Their Probe G/F proposals (TM :73, :74; ADRs :141, :142, :144) map to rows 42–46.
  - `grep -i "rubric\|MC-"` in both reports finds no other rubric-directed proposal; the cross-unit notes go to other units.
  - Contract R7:58 is row 41.
- K12 Register form → FAIL. See D1.
  - :221 is an empty line between row 40 and row 41.
  - The heading :176 still reads "(fix blocks 6 and 7)", and the legend :177 defines only "Adopted (6)" and "Adopted (7)", while rows 41–47 say "Adopted (8)".
  - Rows 42–46 cite a report and probe label but no line, and row 47 cites neither, whereas :163 defines a row as "(report and line → decision → where it landed)".
- K13 MC-44 on the references fix block 8 introduced → PASS, except row 47 (K10).
  - "CONTRACT §5 'Results not shown in a row follow §1.5'" → :218.
  - "rubric R11 D2, D3" (:230) → P1-rubric-lensR-11.md:115, :118.
  - "contract-lensR-7:58" → the proposal text.
  - threat-model-lensR-8 Probe G/F → :73/:74.
  - adrs-lensR-9 Probe G 1/2 and F → :141/:142/:144.
- K14 KICKOFF §3 exit bars (KICKOFF :42-46) → PASS.
  - Branch coverage → MC-07, with the G1 human-ack flag at :123.
  - Mutation → MC-08.
  - Drift exactly 0 → MC-05.
  - SAST/SCA/secrets → MC-33.
  - Facts cited → MC-21/MC-43.
  - Matrix statuses (:48) → MC-42/MC-48.
- K15 CLAUDE.md coverage → PASS.
  - N1→MC-20/23; N2→MC-33; N3→MC-45; N4→MC-34; N5→MC-21/43; N6→MC-42.
  - I-INT→MC-01/02; I-CONV→MC-03; I-CONS→MC-04/05; I-ONCE→MC-10/14/18/24; I-FAIL→MC-05/11(vi)/17/18.
  - Arc facts→MC-15/16/21/22/23/32.
- K16 Probe G re-run on the current artefact → YES (D3): MC-21's shared method accepts a third party's report up to one day old.
- K17 Probe F re-run on the current artefact → NO new false fail.
  - The new cadence clause sends an event-driven or slow [X] to the residual path, which MC-41 accepts.
  - The new (i) clause removes R11's false fail.
  - The planted-artefact clause only asks a good design to state an exclusion.
- K18 Regression. No unit is frozen, so I chose two substitutes as far as possible from the fix-block-8 edits (:49, :63, :80, :85, :163, :222-230):
  - (a) MC-03 vs CONTRACT §6.1 → PASS (K3);
  - (b) MC-10 keys vs CONTRACT §1.3 → PASS (K4).
- K19 JL-1..JL-6 (:96-104) → [inspection-only] PASS. Each is a one-line question tied to a CLAUDE.md duty.
- K20 ADR-specific rules (:90-94) → [inspection-only] PASS.

CANDIDATES (Lens A)
- C1 · The register's tail is outside the table, and its legend is stale.
  - Evidence: RUBRIC.md:220 "| 40 | threat-model-lensR-7:68 (Probe F) | …", :221 "" (empty), :222 "| 41 | contract-lensR-7:58 (Probe F) | …". :176 "### Proposal register (fix blocks 6 and 7)". :177 "**Adopted (6)** means … **Adopted (7)** means …". :163 "one row in the **proposal register** below (report and line → decision → where it landed)". Rows 42–46 cite "threat-model-lensR-8 (Probe G)" and similar, with no line.
  - Criteria: :163 register rule; MC-44; JL-4. Precedent: P1-adr-008-lensR-5 D4, "blank line splits the map", minor.
  - **REAL (minor).**
  - In the GFM spec, a table ends at the first empty line. Lines 222–228 have no header or delimiter row, so they are paragraph text, not register rows. I reconstructed this from the spec rule; no renderer is installed, and I installed none.
  - A script that parses the register table gets 40 rows, not 47, so the "register, not prose, is the log" claim (:163) fails for every fix-block-8 decision.
- C2 · Register row 47 has no verifiable source and bypasses the rubric's change channel.
  - Evidence: RUBRIC.md:228 "| 47 | main agent, LEDGER 2026-10-05 | MC-21 may use the shared `tools/source_drift.py` report …". :126 "Changes since then come only from verifier findings, each logged in LEDGER under P1-rubric." :163 "proposals in reports on **other** units are processed in batches". LEDGER: no 2026-10-05 entry proposes an MC-21 change (K10).
  - Criteria: :126; MC-44.
  - **REAL (minor).** The only rubric change in fix block 8 that alters a verifier method is the one whose source is the generator and whose cited LEDGER entry doesn't exist. Its substance is judged separately in C6.
- C3 · Row 43 drops "naming each disagreement".
  - Evidence: P1-threat-model-lensR-8.md:74 "or LEDGER routes the sibling fix as an open CF item **naming each disagreement**". RUBRIC.md:80 "or LEDGER routes the sibling's fix as an open CF item".
  - Criterion: register fidelity (R11 D2/D3 class).
  - **DISMISSED.** The clause only decides which of two documents carries a disagreement, not whether it is a defect. A disagreement that no CF item names is still attributed to the sibling ("makes the sibling the defective one") and fails that sibling's MC-45. No bad document set passes everything. On the current artefact, CF-17 and CF-19 name each item.
  - Advisory: restore the qualifier.
- C4 · The (d) examples now follow the planted-artefact sentence.
  - Evidence: :80(d) "… names how each other detection excludes them (for example, an outflow join must not PAUSE on internal moves or case returns; …)". Internal moves are legitimate flows, not planted artefacts.
  - Criterion: MC-44 (text says what it claims).
  - **DISMISSED.** Both requirements are stated unambiguously. Only the placement of the examples is off, and no reading weakens either requirement.
- C5 · "The age of the money it protects" is undefined.
  - Evidence: :80 "it must be no slower than the age of the money it protects". There is no definition in RUBRIC, CONTRACT, THREAT_MODEL or RISK_REGISTER (`grep "age of the money"` → only :80).
  - Criterion: Probe G.
  - **DISMISSED.** I tried the two hard cases:
    - an annual audit for an adapter drain (R11 C3);
    - monthly statements for a wrong-customer credit (T-E1).
  - In both, the protected money is an item with a §5.8 age (payout, inbound availability), every such age is far shorter than the cadence, and the sub-risk becomes a residual. I found no plausible reading under which a slow [X] closes a blind money sub-risk.
  - Advisory: "the shortest §5.8 age or limit period of the items the sub-risk affects".
- C6 · The MC-21 shared method lets the verifier rely on a report it didn't produce.
  - Evidence:
    - RUBRIC.md:63: "**Shared method:** run `tools/source_drift.py` (at most one day old). … For a URL reported **identical**, quotes are checked against the local archive".
    - Register row 47: "MC-21 may use the shared … report".
    - The 08:37 UTC report docs/verification/source-drift-2026-10-05.md was produced before this rubric version (10:42 +0200 = 08:42 UTC) and not by a verifier.
    - MANIFEST :3: evm-differences.md "**changed on 2026-10-02 between the two fetch times below**" (14:20 and 21:41 UTC, 7 h 21 m apart).
    - verifier.md :8 "Your inputs are only: the spec files …, the code, and the tests"; :15 "re-fetch the value from docs.arc.io".
    - KICKOFF §4 :54 "Do not pass them your reasoning or summaries."
  - Criteria: KICKOFF §4 Probe G; MC-21 ("The verifier re-fetches every quote"); KICKOFF §4 information hygiene.
  - **REAL (minor).**
  - Probe G, reconstructed: Arc removes a quoted sentence at 09:00. The generator's 08:37 report says "identical". A verifier at 20:00 cites that report, which is "at most one day old", and checks the quote against the archive. Result: PASS. MC-21 itself requires UNVERIFIED with an open question. The intra-day change in MANIFEST :3 shows the window is real for these pages.
  - The method also requires no review of the tool, which the generator wrote and can change. The tool is sound today (K2: read, re-run, and independently curl-checked), so nothing on the current artefact is affected.
- C7 · The LEDGER status column is stale.
  - Evidence: LEDGER.md:33 status "draft v2, fix block 7 used", while the verdict column of the same row records "**Fix 8, grace round 2 (last)**".
  - Criterion: KICKOFF §4 Ledger.
  - **DISMISSED** for this unit. LEDGER is not the unit under verification, and RUBRIC :3 states fix block 8 correctly.
  - Advisory: update the status cell.

DEFECTS
- D1 · docs/RUBRIC.md:221 (empty line splitting the register), :176-177 (heading and legend omit fix block 8), :223-228 (no line pinpoints) · Lens R / :163 register rule, MC-44, JL-4 · minor.
  - Fix: delete the empty line at :221; retitle the heading to "fix blocks 6 to 8" and define "Adopted (8)"; give rows 42–46 their report lines (TM R8 :73, :74; ADRs R9 :141, :142, :144).
- D2 · docs/RUBRIC.md:228 (row 47) against :126 and LEDGER · Lens R / :126 change channel, MC-44 · minor.
  - Problem: the MC-21 change is sourced to "main agent, LEDGER 2026-10-05", which resolves to no entry.
  - Fix: re-source it to a verifier finding (this report's C6 qualifies), or record it in LEDGER "Operator decisions" with the operator's words, and point the row at that.
- D3 · docs/RUBRIC.md:63 MC-21 "Shared method … (at most one day old)" · Lens R / KICKOFF §4 Probe G, MC-21's own re-fetch duty, KICKOFF §4 information hygiene · minor.
  - Problem: a verifier may cite a third party's report up to 24 h old, from a tool it hasn't checked. Arc pages have changed within 7.5 h.
  - Fix: "The verifier runs the tool itself during its pass (the report's timestamp is inside the pass), after reading the tool or matching its hash to the version a verifier last reviewed. A report produced by anyone else is not evidence."
  - D2 and D3 touch the same row and clause. They can go in one atomic fix of MC-21 plus its register row.

VERDICT: NEGATIVE (3 defects: 0 blocking, 3 minor)

Note for the operator:
- Fix block 8 closed all three R11 defects by reconstruction (K6–K8). Register rows 41–46 re-trace to their sources clause by clause (K9). The queue is genuinely empty (K11). No conversion, key or Arc-constant check regressed (K2–K4, K18).
- What remains is the form of the register (D1), and the provenance and trust of the MC-21 "shared method" that the generator added without a verifier proposal (D2, D3). The method is sound on today's artefact: the tool is correct, and live pages equal the archives.
- This was grace round 2 of 2 (final). Under LEDGER :33, a NEGATIVE here goes to a structural mark, decided by the human.
- The MC-07 Probe F rewording still needs human acknowledgement at G1.

Phase 1 · units frozen 0/11 · streak 0/3 · rounds used 10/10 + grace 2/2 (P1-rubric) · regen budget left 1
