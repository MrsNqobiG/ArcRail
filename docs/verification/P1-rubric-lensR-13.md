VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md v2 after v2 fix block 9, operator-authorised extra grace round; sha256 bc53ce25ee66ce6b…, mtime 2026-10-05 11:44:51 +0200, unchanged from 09:45 to 09:53 UTC) · commit: none (no HEAD; `git log` → "your current branch 'main' does not have any commits yet"; uncommitted working tree)

Criteria: KICKOFF_PROMPT.md §3 and §4; CLAUDE.md; .claude/agents/verifier.md; docs/RUBRIC.md; docs/LEDGER.md; docs/CONTRACT.md (sha256 baed1fbe…, changed since R12); docs/sources/MANIFEST.md and the archives; tools/source_drift.py (sha256 5504b5e7076f186c49874d5738d3ca8fd77e9cf66bd6bf607d5586ffd38980e1); every report in docs/verification/.

Session notes:
- The guard hook was not loaded, so I applied its rules myself. I made **no RPC calls** (testnet or mainnet), signed and sent nothing, and read no .env or key files.
- The only network access was HTTPS GETs of public documentation and regulator pages. These were the pages listed in MANIFEST, fetched through `tools/source_drift.py` with `--out` pointed at my scratchpad, plus six independent `curl` GETs of docs.arc.io pages.
- LEDGER changed during the run: its sha256 went from 0b322828… (11:44:51 +0200) to 4cc5b85c… (11:52:14 +0200). Another verifier queued P1-adrs-lensR-11. My checks use the 11:44:51 version unless I say otherwise.
- My task prompt included a description of the target ("v2 after fix block 9; operator-authorised extra grace round …"). I relied on it only after confirming it against RUBRIC :3, :229 and LEDGER :13.

CHECKS
- K1 Counts, recounted → PASS, except the queue-state claim (K11).
  - MC rows: 37 (`grep -c "^| MC-"`). JL rows: 6.
  - Tags: 18 (both) and 19 (code), unchanged from R12.
  - The money-path list has 10 items (:18-27).
  - Register:
    - It has 47 rows, numbered 1–47 with no gaps (awk NR check).
    - Exactly one row is not adopted (row 31), which matches :233.
    - All 47 rows parse as one table body. I parsed RUBRIC with markdown-it-py 3.0.0 (commonmark plus `table`, already installed). The register table spans source map [178, 227] and has 47 body rows; the last three have first cells 45, 46 and 47. Every other table parses to its expected row count (8, 10, 5, 5, 9 MC rows and 6 JL rows, 37 + 6).
- K2 MC-21, by reconstruction under its own new method → PASS.
  - I read tools/source_drift.py in full (108 lines, stdlib only). It writes nothing except an optional `--out` file. It never edits archives.
  - Lines 55-64 recompute every archive's SHA-256 against MANIFEST. Lines 67-70 pick the newest archive per URL. Lines 75-93 byte-compare live with that newest archive.
  - No earlier verifier report records the tool's hash (grep). I record it here as reviewed and found sound: 5504b5e7…f1da.
  - I ran the tool myself at 2026-10-05 09:47 UTC: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33", exit 0.
  - All 40 MANIFEST data rows match the tool's ROW regex (42 table lines, of which 2 are the header and delimiter). The "Fetched" strings sort chronologically.
  - My report body is byte-identical to the shared 08:37 UTC report, apart from the timestamp line. I don't rely on that report.
  - Independent `curl` check: the live sha256 prefix equals the archive's for 5 pages:
    - rpc-endpoints 80324031894c8681;
    - usdc-system-events 69cc24d8d3a2381c;
    - gas-and-fees 93bf2194024f59ad;
    - opt-in-privacy da89bdcc91945f73;
    - contract-addresses 717d52261c1d1e1d.
  - Cited URLs (docs/*.md, excluding sources/ and verification/) diffed against MANIFEST URLs. The ones not in MANIFEST are the RPC and explorer endpoint values themselves, plus the arcup install URL. That URL appears only inside a quoted command (OPEN_QUESTIONS Q-A16) that comes from the archived run-an-arc-node page.
  - Quotes checked in the archives, which are identical to the live pages:
    - rpc-endpoints :64 "| **Chain ID (Testnet)** | `5042002` |", :105 "`eth_getLogs` returns error `-32012` when the requested block range exceeds", :108 "≤9,999-block chunks.", :44 "safely retry requests that return `-32014` after a brief backoff.";
    - usdc-system-events :35 (emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`, 18), :36 (`0x3600…0000`, 6), :39 "A single ERC-20 `transfer()` emits **two** logs";
    - gas-and-fees :38 "| **Minimum base fee (testnet)** | 20 Gwei |";
    - contract-addresses testnet tab :210 TokenMessengerV2 26, :212 MessageTransmitterV2 26;
    - opt-in-privacy :29 "Privacy features are on the roadmap and not yet available on Arc.";
    - the newest evm-differences archive (REFETCH-later) has the quotes for C-30 (:203), C-34 (:199), C-36 (:102) and C-52 (:207), and the line-wrapped quotes for C-10 (:80-82), C-13 (:82-83) and C-66 (:22-23, :105).
  - A wording gap in the method itself: C2 / D2.
- K3 MC-03 vs CONTRACT §6.1 (:535-560), recomputed with Python bigint divmod → PASS.
  - All 9 p = 6 rows and all 4 p = 2 rows match.
  - The max row plus 1 wei gives m = 2⁶³, so the overflow guard at :531 fires.
  - uint256 max gives remainder 913,129,639,935, and m > i64 max.
  - wei→units: 1,234,567,890,123,456,789 gives (1,234,567, 890,123,456,789), matching :558.
  - 21,000 × 20 gwei = 420,000,000,000,000. 167,599 × 44 gwei = 7,374,356,000,000,000.
  - Odd values:
    - 2,718,281,828,459,045,235,360,287 gives (2,718,281,828,459, 45,235,360,287) at p = 6 and (271,828,182, 8,459,045,235,360,287) at p = 2;
    - 10¹²+7 gives (1, 7) and (0, 10¹²+7);
    - 3·10¹⁶−1 gives (29,999, 999,999,999,999) and (2, 9,999,999,999,999,999).
  - p = 18 capacity: (2⁶³−1)/10¹⁸ ≈ 9.22, matching :560.
- K4 MC-10 keys vs CONTRACT §1.3 (:59-82) → PASS.
  - K.recv(5042002, 0xab×32, "0", "0") = arc1-970ee4c76bbeae19300510816cb88b62eb947aefe9baa8fac99ac454f3b0785b. It is 69 characters and the same as R11 and R12.
  - `Ab` ≠ `ab`; `["a|b","reserve"]` ≠ `["a","b|reserve"]`; attempt "0" ≠ "1".
- K5 Probe G arithmetic (:111) → PASS. A = 1,000 minor at p = 6 gives a residual of −10¹⁵ wei = −A·k.
- K6 Closure of R12 D1 (register form) → PASS.
  - There is no blank line inside the register (K1 parse).
  - The heading at :176 reads "### Proposal register (fix blocks 6 to 9)".
  - The legend at :177 defines "**Adopted (7)**, **(8)** and **(9)**".
  - Rows 42–46 now cite threat-model-lensR-8:73, :74 and adrs-lensR-9:141, :142, :144.
  - All 47 source pinpoints resolve to the proposal text. I printed each cited line by script. For example:
    - :73 "Probe G … No item requires a reference artefact … to be modelled itself";
    - adrs-9:144 "Probe F (would the rubric fail a good version?): YES.";
    - rubric-12:121 "C6 · The MC-21 shared method lets the verifier rely on a report it didn't produce."
- K7 Closure of R12 D2 (row 47's provenance) → PASS.
  - Row 47 (:227) cites "rubric-lensR-12:121 (C6, D2, D3), which superseded an unsourced fix-8 entry". R12 :121 is C6, :142 is D2 and :145 is D3.
  - :229 cites "LEDGER 2026-10-05", which resolves to LEDGER :13 (operator: "One extra fix + verify").
  - LEDGER :34 records R12 → Fix 9.
- K8 Closure of R12 D3 (who runs the tool) → PASS.
  - :63 now reads "the verifier **runs `tools/source_drift.py` itself during its pass**, after reading the tool or matching its SHA-256 to a version reviewed in an earlier verifier report. A report produced by anyone else, or earlier, is not evidence."
  - The phrase "at most one day old" is gone (grep → 0).
  - I re-ran R12's Probe G: the generator's 08:37 report is no longer evidence for a pass that starts later. Nuance: C3 (dismissed).
- K9 MC-44 on the references fix block 9 introduced → PASS.
  - "rubric-lensR-12:121" → the C6 line. "LEDGER 2026-10-05" → :13. "rubric R12 defects: D1 … D2 and D3" → R12 :140-147.
- K10 R12-quoted text carried over unchanged (I can't diff without git, so I grepped each phrase) → PASS.
  - :49(i) "counts as its row in every state it covers, as for events in (ii)".
  - :80 "plants artefacts", "its owner, its cadence", "appears as an asset in THREAT_MODEL", "or LEDGER routes the sibling's fix as an open CF item".
  - :85 "clause by clause", "explicitly defers to the OPEN_QUESTIONS wording", "1 base unit, or `k` wei".
  - :42 "Probe F rewording". :123 "needs explicit human acknowledgement at G1".
- K11 Queue state claim → FAIL. See D1.
  - :163 ends: "Fix block 8 processed every queued proposal, so the queue is empty as of this version."
  - LEDGER :37-43 at 11:44:51 +0200, the same timestamp as this RUBRIC version: "Emptied by RUBRIC v2 fix block 8 … Queued since then:", followed by 3 rows (P1-contract-lensR-9, P1-threat-model-lensR-9, P1-adrs-lensR-10). At 11:52 a 4th row (P1-adrs-lensR-11) was added.
  - These reports are dated 10:50, 11:24 and 10:47 +0200, all before fix block 9 (11:44).
  - The queue entries match each report's Probe G/F proposals (contract-9 :57-58, TM-9 :75-76, adrs-10 :200-206). Under :163 they are **not** defects of this version. The false claim about the queue's state is.
- K12 KICKOFF §3 exit bars (KICKOFF :42-46) → PASS.
  - Branch coverage → MC-07 (G1 human ack at :123). Mutation → MC-08. Drift exactly 0 → MC-05. SAST/SCA/secrets → MC-33. Facts cited → MC-21/MC-43. Matrix statuses (:48) → MC-42/MC-48.
- K13 CLAUDE.md coverage → PASS. Unchanged from R12 K15, because none of the mapped items changed apart from MC-21's method.
  - N1→MC-20/23; N2→MC-33; N3→MC-45; N4→MC-34; N5→MC-21/43; N6→MC-42.
  - I-INT→MC-01/02; I-CONV→MC-03; I-CONS→MC-04/05; I-ONCE→MC-10/14/18/24; I-FAIL→MC-05/11(vi)/17/18.
- K14 Probe G re-run on the current artefact → YES, once (D2).
  - The MC-21 shared-method shortcut ("For a URL reported **identical**, quotes are checked against the local archive") passes a quote that the live page no longer carries, whenever that URL has more than one archive.
  - Reconstructed on a real instance:
    - MANIFEST :20-21 hold two archives of evm-differences.md. The older one, at :132-133, holds "Sending value to a precompile address reverts."
    - My drift run reports that URL as "identical (HTTP 200)" against `…evm-differences.REFETCH-later.md` (report line 63).
    - Live `curl | grep -c` for that sentence → 0.
    - A document that cited the sentence with the 14:20 archive path (MANIFEST rule 1: "URL **and** the archive path") would pass when checked "against the local archive", but MC-21's own rule says it must revert to UNVERIFIED.
  - Today the sentence is correctly held as UNVERIFIED under Q-A14, so no current artefact is affected.
- K15 Probe F re-run on the current artefact → no new false fail.
  - The new MC-21 clause only requires the verifier to run a read-only tool, which fails no good document.
  - The one known near miss (the [X] cadence rule on non-money anchors) is TM R9 :76. It is queued in LEDGER, so under :163 it is not a defect of this version.
- K16 Regression. No unit is frozen, so I chose two substitutes as far as possible from the fix-block-9 edits (:63, :176-177, :222-229):
  - (a) MC-03 vs CONTRACT §6.1, which changed since R12 (hash) → PASS (K3);
  - (b) MC-10 keys vs CONTRACT §1.3 → PASS (K4).
- K17 JL-1..JL-6 (:96-104) → [inspection-only] PASS. Each is a one-line question tied to a CLAUDE.md duty.
- K18 ADR-specific rules (:90-94) → [inspection-only] PASS. They are unchanged.

CANDIDATES (Lens A)
- C1 · The queue is claimed empty.
  - Evidence: RUBRIC.md:163 "Fix block 8 processed every queued proposal, so the queue is empty as of this version." RUBRIC.md:3 "(then v2 fix blocks 1 to 9)", so "this version" is fix block 9. LEDGER.md:37 "Queued since then:" with 3 rows at fix-block-9 time (4 now). RUBRIC.md:163 "**The rubric can be frozen only with an empty queue.**"
  - Criteria: MC-44 (text says what it claims), the :163 queue rule, JL-4.
  - **REAL (minor).**
  - The sentence is the rubric's own statement of the condition that controls its freeze. Read at this version, it is false, and a reader who trusts it would treat the freeze precondition as met.
  - R12 K1 relied on this same sentence ("matches :163"), so the check is established practice and the drift is new to fix block 9.
- C2 · MC-21's "the local archive" is ambiguous when a URL has several archives.
  - Evidence:
    - RUBRIC.md:63 "The tool … byte-compares every live URL with its newest archive. For a URL reported **identical**, quotes are checked against the local archive".
    - MANIFEST :20-21 (two evm-differences archives).
    - The older archive :132-133 holds a sentence that is absent live (K14).
    - MC-21 itself says "A quote missing from the live page reverts the fact to UNVERIFIED".
  - Criteria: KICKOFF §4 Probe G; MC-21's own re-fetch duty.
  - **REAL (minor).** The shortcut is sound only for the archive the tool compared, which is the newest. A citation that names an older archive of the same URL is checked against bytes the live page no longer has.
  - The method text predates fix block 9 (R12 :123 quotes it), but fix block 9 rewrote this clause, so it is in scope.
  - The fix is one clause: "against the archive the tool compared (the newest for that URL, named in its report row); a quote found only in an older archive is treated as missing from the live page."
- C3 · The hash alternative accepts "a version reviewed", not one reviewed and found sound.
  - Evidence: :63 "matching its SHA-256 to a version reviewed in an earlier verifier report".
  - Criterion: Probe G.
  - **DISMISSED.**
    - No verifier report has ever recorded a hash of the tool (grep), so the alternative is unused today.
    - The tool has never been found defective.
    - "Reviewed" in a verifier report means checked, and a report that found the tool defective would itself be a NEGATIVE finding that any later verifier reads.
  - Advisory: "reviewed and found sound". This report records 5504b5e7…f1da as reviewed and sound.
- C4 · The tool's docstring contradicts MC-21.
  - Evidence: tools/source_drift.py:8 "Verifiers cite the report this writes, instead of each re-fetching every page." RUBRIC.md:63 "A report produced by anyone else, or earlier, is not evidence."
  - Criterion: cross-document consistency.
  - **DISMISSED** for this unit. The tool is not P1-rubric, and the rubric is the authority over verifier method.
  - Advisory: route a one-line docstring fix (tooling, outside any unit).
- C5 · LEDGER :37 "Emptied by RUBRIC v2 fix block 8 (register rows 41–47)", while row 47 is now "Adopted (9)".
  - Criterion: KICKOFF §4 Ledger.
  - **DISMISSED.** LEDGER is not the unit under verification, and the register itself (:227) is correct.
- C6 · MC-21's Source column doesn't credit rubric R12 C6.
  - Evidence: :63 Source "N5. Contract R3 Probe G and F. ADR R2 Probe F. Q-A14".
  - Criteria: :7 crediting, MC-44.
  - **DISMISSED.** :163 makes "The register, not prose, is the log", and row 47 credits R12. Other fixed items follow the same practice (MC-16's fix-6 change, R9 D4, isn't in its Source column either).

DEFECTS
- D1 · docs/RUBRIC.md:163, last sentence ("so the queue is empty as of this version") · Lens R / MC-44, :163 queue rule · minor.
  - Fix: replace it with "Fix block 8 processed every proposal queued before it; later proposals are in the LEDGER queue." The rubric then makes no claim about the queue's state that LEDGER can contradict.
- D2 · docs/RUBRIC.md:63 MC-21 shared method ("quotes are checked against the local archive") · Lens R / KICKOFF §4 Probe G, MC-21's own re-fetch duty · minor.
  - Fix: "against the archive the tool compared (the newest for that URL, named in its report row); a quote found only in an older archive of that URL is treated as missing from the live page."
  - D1 and D2 are independent single-sentence edits. They can go in one fix block, because neither touches the same text.

VERDICT: NEGATIVE (2 defects: 0 blocking, 2 minor)

Note for the operator:
- Fix block 9 closed all three R12 defects, each checked by reconstruction (K6–K8):
  - the register parses as one 47-row table, and every source pinpoint resolves;
  - row 47 is sourced to a verifier finding;
  - the verifier now runs the drift tool itself.
- No conversion, key or Arc-constant check regressed (K2–K5, K16), including against the changed CONTRACT.
- The two remaining defects are one sentence each. One is a stale claim that the queue is empty. The other is a Probe G gap in the MC-21 shortcut, reconstructed on the real evm-differences drift (Q-A14).
- Even at POSITIVE the rubric **cannot be frozen** while the LEDGER queue is non-empty (:163). It has 4 entries now (contract R9, TM R9, ADRs R10, ADRs R11).
- The MC-07 Probe F rewording still needs human acknowledgement at G1.

Phase 1 · units frozen 0/11 · streak 0/3 · rounds used 10/10 + grace 2/2 + extra 1 (P1-rubric) · regen budget left 1
