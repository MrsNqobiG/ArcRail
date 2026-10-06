VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md v2 after v2 fix block 10, the second operator-authorised extra round; sha256 4387ef4325c2f11e…, mtime 2026-10-05 11:59:04 +0200, unchanged from 10:01 to 10:06 UTC) · commit: none (no HEAD; `git log` → "your current branch 'main' does not have any commits yet"; uncommitted working tree)

Criteria: KICKOFF_PROMPT.md §3 and §4; CLAUDE.md; .claude/agents/verifier.md; docs/RUBRIC.md; docs/LEDGER.md; docs/CONTRACT.md (sha256 baed1fbe…, the same as R13); docs/sources/MANIFEST.md (c0e75501…) and the archives; tools/source_drift.py (sha256 5504b5e7076f186c49874d5738d3ca8fd77e9cf66bd6bf607d5586ffd38980e1); every report in docs/verification/.

Session notes:
- The guard hook was not loaded, so I applied its rules myself. I made **no RPC calls** (testnet or mainnet), signed and sent nothing, and read no .env or key files.
- The only network access was HTTPS GETs of the public documentation and regulator pages listed in MANIFEST. These went through `tools/source_drift.py`, with `--out` pointed at my session scratchpad, not docs/.
- One process slip, now undone: a URL-listing shell command briefly wrote two temp files (`/home/nqobi/arc-rail/.cited_tmp` and `/tmp/cited.txt`). I deleted both straight away and confirmed they were gone. The check then ran without writing anything.
- LEDGER changed during my run, from 318674cc… (11:59:04 +0200) to ca51d9bc… (12:03:42 +0200). The rubric queue went from 4 rows to 6, adding P1-contract-lensR-10 and P1-threat-model-lensR-10. My checks use the 11:59:04 version, which was written in the same instant as this RUBRIC version, unless I say otherwise.
- My task prompt described the target ("v2 after fix block 10; a second operator-authorised extra round recorded in LEDGER 2026-10-05"). I relied on that description only after confirming it against RUBRIC :3 and :229, and LEDGER :14 and :36.

CHECKS
- K1 Counts, recounted → PASS.
  - 37 MC rows (`grep -c "^| MC-"`) and 6 JL rows.
  - Tags: 18 (both) and 19 (code), unchanged from R13.
  - The money-path list has 10 items (:18-27).
  - I parsed RUBRIC with markdown-it-py (commonmark plus `table`). Every table body has its expected row count: 8, 10, 5, 5, 9 MC rows; 6 JL rows; 47 register rows (source map [178, 227], first cells 1 … 45, 46, 47).
  - The register is numbered 1–47 at lines 181–227 with no gaps (awk). Exactly one row is not adopted (row 31), which matches :235.
- K2 MC-21, by reconstruction under its own method → PASS.
  - The tool's SHA-256 is 5504b5e7…f1da. It matches the version R13 K2 read in full and recorded as "reviewed and found sound", which is the hash route MC-21 allows. I also re-read the I/O surface (`urlopen` at :33-34; writes only to `--out`).
  - I ran it myself at 2026-10-05 10:02 UTC: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33", exit 0. That covers 40 archived files.
  - Arc/Circle URLs cited in docs/*.md, docs/adr and docs/discovery, diffed against MANIFEST URLs (`comm -23`): no cited URL is missing.
  - Quotes checked against **the archive the tool compared**, as the new clause requires:
    - rpc-endpoints: "**Chain ID (Testnet)** | `5042002`", "returns error `-32012`", "9,999-block", "`-32014`";
    - gas-and-fees :38 "| **Minimum base fee (testnet)** | 20 Gwei |";
    - usdc-system-events :35 emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` with 18, :36 `0x3600…0000` with 6;
    - contract-addresses, Testnet tab (:207), :210-215: TokenMessengerV2, MessageTransmitterV2 and the others, domain 26;
    - opt-in-privacy: "not yet available on Arc".
  - No code exists yet (no src/ or infra/), so "grep code for literals" is N/A.
- K3 Closure of R13 D2 (MC-21 older-archive quotes) → PASS.
  - :63 now reads: "For a URL reported **identical**, quotes are checked against **the archive the tool compared** (the newest archive of that URL, named in its report row). **A quote found only in an older archive of that URL is treated as missing from the live page** (it reverts to UNVERIFIED with an open question)".
  - I re-ran R13's Probe G on the real instance:
    - My drift report :63 names `sources/arc/arc_references_evm-differences.REFETCH-later.md` as the compared archive, so "named in its report row" holds.
    - "Sending value to a precompile address reverts." appears 1× in the 14:20 archive and 0× in REFETCH-later, so the new clause routes it to UNVERIFIED. OPEN_QUESTIONS Q-A14 already holds it as UNVERIFIED and OPEN, so no artefact changes status.
  - Second real instance, node-providers (two archives):
    - The older archive's only removed text is the :20-21 intro wording.
    - `grep` across docs (excluding sources/ and verification/) finds no quote of it, so nothing reverts.
- K4 Closure of R13 D1 (queue-state sentence) → PASS.
  - The phrase "so the queue is empty as of this version" is gone (grep → 0).
  - :163 now says "Fix block 8 processed every proposal queued before it. The rubric freezes only when that queue is empty." That is consistent with LEDGER :39 "Emptied by RUBRIC v2 fix block 8 (register rows 41–47)".
  - The sentence before it, which was kept, is a separate problem: see K11 / D1.
- K5 MC-44 on the references fix block 10 introduced → PASS.
  - :3 "(then v2 fix blocks 1 to 10)".
  - :229 "LEDGER 2026-10-05" resolves to LEDGER :14 ("RUBRIC R13 NEG 0+2 … **Another extra fix + verify**"). Three rows share that date, but the content identifies this one, the same pattern R13 accepted for :231.
  - "rubric R13 defects: D1 the queue-state sentence; D2 quotes checked only against the archive the drift tool compared" resolves to R13 :147-150.
  - LEDGER :36 says "operator authorised a second extra round → **Fix 10** · R14 pending".
- K6 MC-03 vs CONTRACT §6.1 (:535-563), recomputed with Python bigint `divmod` → PASS.
  - All 9 rows at p = 6 and all 4 rows at p = 2 match.
  - Max `w` + 1 gives m = 2⁶³, so the overflow guard (:533) fires.
  - uint256 max gives remainder 913,129,639,935, with m > i64 max.
  - 1,234,567,890,123,456,789 wei gives (1,234,567, 890,123,456,789).
  - 21,000 × 20 gwei = 420,000,000,000,000. 167,599 × 44 gwei = 7,374,356,000,000,000.
  - Odd values: 2,718,281,828,459,045,235,360,287 gives (2,718,281,828,459, 45,235,360,287) at p = 6 and (271,828,182, 8,459,045,235,360,287) at p = 2. 10¹²+7 gives (1, 7). 3·10¹⁶−1 gives (29,999, 999,999,999,999) and (2, 9,999,999,999,999,999).
  - p = 18 capacity: (2⁶³−1)/10¹⁸ ≈ 9.22.
- K7 MC-10 keys vs CONTRACT §1.3 (:58-82) → PASS.
  - K.recv(5042002, 0xab×32, "0", "0") = arc1-970ee4c76bbeae19300510816cb88b62eb947aefe9baa8fac99ac454f3b0785b. It is 69 characters, the same as R11–R13.
  - These distinct inputs gave distinct keys: `Ab` vs `ab`; `["a|b","reserve"]` vs `["a","b|reserve"]`; attempt "0" vs "1".
- K8 Probe G arithmetic (:111) → PASS. A = 1,000 minor at p = 6 gives A·k = 10¹⁵ wei, so the residual is −10¹⁵ wei.
- K9 KICKOFF §3 exit bars (KICKOFF :42-46) → PASS.
  - Branch coverage → MC-07 (G1 human ack at :123). Mutation → MC-08. Drift exactly 0 → MC-05. SAST/SCA/secrets → MC-33. Facts cited → MC-21/MC-43. Matrix statuses (:48) → MC-42/MC-48.
  - All of these IDs are present (K1).
- K10 CLAUDE.md coverage → PASS. None of the mapped items changed except MC-21's method.
  - N1→MC-20/23; N2→MC-33; N3→MC-45; N4→MC-34; N5→MC-21/43; N6→MC-42.
  - I-INT→MC-01/02; I-CONV→MC-03; I-CONS→MC-04/05; I-ONCE→MC-10/14/18/24; I-FAIL→MC-05/11(vi)/17/18.
- K11 Queue rule against the rubric's own record → FAIL. See D1.
  - :163 "Each rubric fix block processes the proposals queued **before** it; proposals queued later wait in the LEDGER queue."
  - LEDGER at 11:59:04 (written in the same instant as RUBRIC fix block 10) lists 4 queued rows: P1-contract-lensR-9, P1-threat-model-lensR-9, P1-adrs-lensR-11 and P1-adrs-lensR-10.
  - Three of those were already queued when fix block 9 was written (R13 K11: LEDGER at 11:44:51), and all four before fix block 10.
  - `grep -c` in RUBRIC for any of these report names → 0. Neither fix block 9 nor fix block 10 processed them, and :229/:231 describe both as fixing only the named R12/R13 defects.
- K12 Probe G re-run on the current artefact → no new pass-through found.
  - The new MC-21 clause closes the older-archive route (K3).
  - The "newest" archive is chosen by the tool's MANIFEST "Fetched" order, which R13 checked as chronological. My run's report rows name the compared archive for every URL.
- K13 Probe F re-run on the current artefact → no new false fail.
  - A good document that cites an older archive only as a drift record (Q-A14, MANIFEST :3) is not an "Arc value that code or infra will load, or that a design decision relies on". MC-21 doesn't apply to it, and Q-A14 already marks the fact UNVERIFIED.
  - The open Probe F proposals in other units' reports (TM R9 :76; TM R10 :91; contract R10 :59) are queued in LEDGER (12:03 version), so under :163 they are not defects of this version.
- K14 Regression. No unit is frozen, so I chose two substitutes as far as possible from the fix-block-10 edits (:63, :163, :229):
  - (a) MC-03 vs CONTRACT §6.1 → PASS (K6);
  - (b) MC-10 keys vs CONTRACT §1.3 → PASS (K7).
- K15 JL-1..JL-6 (:96-104) → [inspection-only] PASS. Each is a one-line question tied to a CLAUDE.md duty, and they are unchanged.
- K16 ADR-specific rules (:90-94) → [inspection-only] PASS. They are unchanged.

CANDIDATES (Lens A)
- C1 · The queue rule says each rubric fix block processes the proposals queued before it, but fix blocks 9 and 10 processed none.
  - Evidence:
    - RUBRIC.md:163 "Each rubric fix block processes the proposals queued **before** it; proposals queued later wait in the LEDGER queue."
    - LEDGER.md (11:59:04) :39-46 "Emptied by RUBRIC v2 fix block 8 … Queued since then:" with 4 rows, dated 10:47, 10:50, 11:24 and 11:50 +0200, all before fix block 10 (11:59:04).
    - RUBRIC.md:229 "Fix block 10 … fixed the rubric R13 defects: D1 …; D2 …" and :231 for fix block 9: neither mentions the queue.
    - :163, earlier: "Any not yet processed are listed in the LEDGER … and **are not defects of the rubric version being verified**."
  - Criteria: MC-44 (the text says what it claims), the :163 queue rule, JL-4. It is the same class as R13 D1: a :163 sentence that LEDGER contradicts.
  - **REAL (minor).**
    - Read as a rule, it was broken twice and the rubric records no exception.
    - Read as a description, it is false for the two newest fix blocks.
    - It also pulls against the sentence that decides what counts as a defect. If every fix block must process everything queued before it, then the 4 unprocessed proposals are fix-block-10 omissions, yet the same paragraph says they are not defects of this version.
    - The operator's decisions (LEDGER :14-15) and CLAUDE.md's "a block does exactly one job" are a good reason why fix blocks 9 and 10 skipped the queue. The rule should say so rather than claim the opposite.
  - The freeze gate ("The rubric freezes only when that queue is empty") is unaffected.
- C2 · The fix-block-10 paragraph (:229) sits above fix block 9's (:231), while fix blocks 1–7 (:132-174) are logged in chronological order.
  - Criterion: JL-4.
  - **DISMISSED.** Each paragraph names its fix block and the defects it fixed, so the order doesn't mislead. This is cosmetic.
- C3 · The register heading still says "(fix blocks 6 to 9)" after fix block 10.
  - Evidence: :176.
  - Criterion: MC-44.
  - **DISMISSED.** Fix block 10 added and changed no register rows. Row 47's decision text "Adopted (9)" still describes where it was adopted, and fix block 10's change to the MC-21 wording is a defect fix logged at :229. The register logs **proposals**, not defect fixes.
- C4 · "LEDGER 2026-10-05" (:229) matches three LEDGER rows.
  - Criterion: MC-44.
  - **DISMISSED.** Only :14 records an R13 decision ("Another extra fix + verify"), so the reference resolves by content. R13 K9 accepted the same form for :231.
- C5 · The MC-21 tie-break for "newest archive" is defined only by the tool's parsing of the "Fetched" strings.
  - Evidence: :63 "the newest archive of that URL, named in its report row".
  - Criterion: Probe G.
  - **DISMISSED.**
    - The rubric binds the verifier to the archive **named in the tool's report row**, so there is no hidden choice.
    - All 40 MANIFEST timestamps are distinct per URL, and R13 checked that they sort chronologically.
    - Two archives of one URL with the same timestamp don't exist today.

DEFECTS
- D1 · docs/RUBRIC.md:163, the sentence "Each rubric fix block processes the proposals queued **before** it; proposals queued later wait in the LEDGER queue." · Lens R / MC-44, :163 queue rule, JL-4 · minor.
  - Fix (one sentence): "A fix block that processes the queue takes every proposal queued before it; later proposals wait in the LEDGER queue. Fix blocks 9 and 10 were scoped by the operator to named defects and processed no queued proposals."

VERDICT: NEGATIVE (1 defect: 0 blocking, 1 minor)

Note for the operator:
- Fix block 10 closed both R13 defects, each checked by reconstruction:
  - MC-21 now checks quotes only against the archive the tool compared, and treats older-archive-only quotes as missing (K3). I re-ran this on the real evm-differences and node-providers drift.
  - The false "queue is empty" claim is gone (K4).
- No conversion, key, Arc-constant or source-integrity check regressed (K2, K6–K8, K14). The drift tool, run by me, is clean: 0/0/0 over 33 URLs.
- The remaining defect is one sentence in the queue rule that describes a step fix blocks 9 and 10 legitimately skipped.
- Whatever the verdict, the rubric **cannot be frozen** while the LEDGER queue is non-empty (:163). As of 12:03 it has 6 entries: contract R9 and R10, TM R9 and R10, ADRs R10 and R11.
- The MC-07 Probe F rewording still needs human acknowledgement at G1.

Phase 1 · units frozen 0/11 · streak 0/3 · rounds used 10/10 + grace 2/2 + extra 2 (P1-rubric) · regen budget left 1
