VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md v2 after v2 fix block 11, extra round 1 of 3 under the operator's standing grant; sha256 4d86338d957d6c46…, mtime 2026-10-05 12:09:03 +0200, unchanged from 10:09 to 10:17 UTC) · commit: none (no HEAD; `git log` → "your current branch 'main' does not have any commits yet"; uncommitted working tree)

Criteria: KICKOFF_PROMPT.md §3; CLAUDE.md; .claude/agents/verifier.md; docs/RUBRIC.md; docs/LEDGER.md; docs/CONTRACT.md (sha256 d6768590…, 12:02:49 +0200, **changed since R14's baed1fbe…**, so K6 and K7 were redone against it); docs/OPEN_QUESTIONS.md; docs/sources/MANIFEST.md (c0e75501…) and the archives; tools/source_drift.py (sha256 5504b5e7076f186c49874d5738d3ca8fd77e9cf66bd6bf607d5586ffd38980e1); P1-rubric-lensR-14.md.

Session notes:
- The guard hook was not loaded, so I applied its rules myself. I made **no RPC calls** (testnet or mainnet), signed and sent nothing, and read no .env or key files.
- The only network access was the HTTPS GETs of public documentation and regulator pages that `tools/source_drift.py` makes for the URLs in MANIFEST.
- I wrote no file except this report. I ran the drift tool with `--out /dev/stdout`, and I diffed URL lists with process substitution, so no temp files were created.
- LEDGER changed during my run, from afad884c… (12:09:03 +0200, written in the same instant as this RUBRIC) to d4e56405… (12:16:03 +0200). The only change I found is a new queue row, P1-threat-model-lensR-11, which was queued **after** fix block 11. My checks use the 12:09:03 version unless I say otherwise.
- My task prompt described the target as "v2 after fix block 11; extra round under the operator's standing grant recorded in LEDGER 2026-10-05". I relied on that only after confirming it against RUBRIC :3 and :229, and LEDGER :13 and :38.

CHECKS
- K1 Counts, recounted → PASS.
  - 37 MC rows (`grep -c "^| MC-"`) and 6 JL rows.
  - Tags: 18 (both) and 19 (code), the same as R13 and R14.
  - The money-path list has 10 items (:18-27).
  - I parsed the file with markdown-it-py (commonmark plus `table`). Each table has its expected body-row count:
    - the five MC tables, at maps [33,43], [45,57], [59,66], [68,75] and [77,88], have 8, 10, 5, 5 and 9 rows;
    - the JL table [96,104] has 6;
    - the register [178,227] has 47.
  - The register's first cells run 1 … 47 with no gaps. Exactly one row is not adopted (row 31), which matches :237.
  - The file now has 237 lines. Every anchor sits where R14 found it (:63 MC-21, :91 rules, :99-104 JL, :176 register heading, :227 row 47). The only additions are the fix-block-11 paragraph and its blank line (:229-230), which pushed fix 10 to :231, fix 9 to :233 and so on.
- K2 MC-21, by reconstruction under its own method → PASS.
  - The tool's SHA-256 is 5504b5e7…80e1, the version R13 K2 read in full and found sound. That hash match is the route MC-21 allows. I re-read the tool in full anyway (108 lines): its only network call is `urlopen` (:33-34), and its only write goes to `--out`.
  - I ran it myself at 2026-10-05 10:09 UTC: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33", exit 0. It covers 40 archived files, and every hash matches.
  - Arc and Circle URLs cited in docs/*.md, docs/adr and docs/discovery (19 distinct) were diffed against the 33 MANIFEST URLs with `comm -23`: none is missing.
  - Quotes checked against **the archive the tool compared** (named in each report row), as :63 requires:
    - rpc-endpoints :64 "| **Chain ID (Testnet)** | `5042002` |"; :105 "returns error `-32012`"; :108 "≤9,999-block chunks"; :43-44 "`-32014`";
    - gas-and-fees :38 "| **Minimum base fee (testnet)** | 20 Gwei |";
    - usdc-system-events :35 emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` with 18, and :36 `0x3600…0000` with 6;
    - cctp supported-chains-and-domains :141 "| 26 | Arc |";
    - opt-in-privacy :29 "not yet available on Arc".
  - For evm-differences the tool compared `…evm-differences.REFETCH-later.md`, and for node-providers `…node-providers.REFETCH-2026-10-05.md`. Both are reported identical, so R14 K3's older-archive treatment still holds.
  - No code exists yet (there is no src/ or infra/), so "grep code for literals" is N/A.
- K3 Closure of R14 D1 (queue-rule sentence) → PASS.
  - :163 now reads: "A fix block that **processes the queue** takes every proposal queued before it; later proposals wait in the LEDGER queue. Fix block 8 processed every proposal queued before it. **Fix blocks 9, 10 and 11 were scoped by the operator to named defects and processed no queued proposals.**"
  - The old sentence "Each rubric fix block processes the proposals queued **before** it" is gone (grep → 0).
  - I re-derived the claim:
    - `grep -c` in RUBRIC for any of the 7 queued report names (contract R9/R10, threat-model R9/R10, ADRs R10/R11/R12) → 0;
    - LEDGER :41 says "Emptied by RUBRIC v2 fix block 8 (register rows 41–47)";
    - all 7 rows in the 12:09:03 queue predate fix block 11, by mtime: 10:47, 10:50, 11:24, 11:50, 11:53, 11:54 and 12:06 +0200;
    - none was processed, so the sentence is true for fix blocks 9, 10 and 11.
  - The conflict R14 found between the rule and the "not defects of the rubric version" sentence is gone: processing is now a property of a fix block that "processes the queue", not a duty of every fix block.
  - The freeze gate is unchanged ("can be frozen only with an empty queue", repeated as "freezes only when that queue is empty").
- K4 MC-44 on the references fix block 11 introduced → PASS.
  - :3 "(then v2 fix blocks 1 to 11)".
  - :229 "operator's standing grant of up to 3 extra rounds, LEDGER 2026-10-05" resolves by content to LEDGER :13, the only "Standing grant" row ("… gets **up to 3 more** fix-and-verify rounds without asking").
  - The grant's precondition holds: R14's verdict had 0 blocking defects (R14 :118).
  - "fixed the rubric R14 defect D1" resolves to R14 :115-116.
  - LEDGER :38 agrees: "R14 NEG 0+1 (queue-rule sentence vs fix blocks 9 and 10) → standing grant, extra 1 of 3 → **Fix 11** · R15 pending".
- K5 MC-44 on the rubric's references into the changed CONTRACT → PASS.
  - CONTRACT changed after R14, so I re-resolved the references MC-11 and MC-12 rely on:
    - :224 "Results not shown in a row follow §1.5" (MC-11(i));
    - the §1.4 `H_retry` bounded retry horizon, ending in UNRESOLVED and then the §1.5 fail-closed outcomes (MC-12(a));
    - the §1.6 rail-wide chain conditions, RPC disagreement and chain stall, both PAUSE (MC-11(vi));
    - the §1.7 in-flight gate (MC-11 interleavings);
    - §1.3 key table, §5.0–§5.8 and §6.1 headings, all present at :58, :227-486 and :535.
- K6 MC-03 vs CONTRACT §6.1 (:535-562), recomputed with Python bigint `divmod` → PASS.
  - All 9 rows at p = 6 and all 4 rows at p = 2 match, including the dust values.
  - Max `w` + 1 gives m = 2⁶³, so the overflow guard (:533) fires.
  - uint256 max gives remainder 913,129,639,935, with m > i64 max.
  - 1,234,567,890,123,456,789 wei gives (1,234,567, 890,123,456,789), which matches :560.
  - 21,000 × 20 gwei = 420,000,000,000,000. 167,599 × 44 gwei = 7,374,356,000,000,000.
  - Odd values:
    - 2,718,281,828,459,045,235,360,287 gives (2,718,281,828,459, 45,235,360,287) at p = 6 and (271,828,182, 8,459,045,235,360,287) at p = 2;
    - 10¹²+7 gives (1, 7);
    - 3·10¹⁶−1 gives (29,999, 999,999,999,999) at p = 6 and (2, 9,999,999,999,999,999) at p = 2.
  - Capacity: (2⁶³−1)/10¹⁸ ≈ 9.22, /10⁶ ≈ 9.22×10¹², /10² ≈ 9.22×10¹⁶, which matches :562.
- K7 MC-10 keys vs CONTRACT §1.3 (:58-82, JCS of a string array, SHA-256) → PASS.
  - K.recv(5042002, 0xab×32, "0", "0") = arc1-970ee4c76bbeae19300510816cb88b62eb947aefe9baa8fac99ac454f3b0785b. It is 69 characters, the same as R11–R14.
  - These distinct inputs gave distinct keys: `Ab` vs `ab`; `["a|b","reserve"]` vs `["a","b|reserve"]`; attempt "0" vs "1".
- K8 Probe G arithmetic (:111) → PASS. A = 1,000 minor at p = 6 gives A·k = 10¹⁵ wei, so the residual is −10¹⁵ wei.
- K9 KICKOFF §3 exit bars (KICKOFF :42-46) → PASS.
  - Branch coverage → MC-07 (G1 human ack at :123). Mutation → MC-08. Drift exactly 0 → MC-05. SAST/SCA/secrets → MC-33. Facts cited → MC-21/MC-43. Matrix statuses (:48) → MC-42/MC-48.
  - All of these IDs are present (K1).
- K10 CLAUDE.md coverage → PASS. None of the mapped rows changed in fix block 11.
  - N1→MC-20/23; N2→MC-33; N3→MC-45; N4→MC-34; N5→MC-21/43; N6→MC-42.
  - I-INT→MC-01/02; I-CONV→MC-03; I-CONS→MC-04/05; I-ONCE→MC-10/14/18/24; I-FAIL→MC-05/11(vi)/17/18.
- K11 Queue rule against the rubric's own record → PASS.
  - Every fix block from 6 on now has a stated queue outcome:
    - 6: over-claimed; its log was replaced by the register (:172);
    - 7: "processed every queued proposal" (:174);
    - 8: "processed every proposal queued before it" (:163);
    - 9 to 11: "processed no queued proposals" (:163).
  - Each statement matches LEDGER :41 and the grep in K3.
  - The proposal queued after fix block 11 (threat-model R11, LEDGER at 12:16:03) is correctly outside fix block 11's scope.
- K12 Probe G re-run on the current artefact → no new pass-through found.
  - The new wording makes queue processing optional for a given fix block. A bad rubric could therefore defer proposals indefinitely, but it can **never freeze** while the queue is non-empty (:163, said twice).
  - Deferred proposals stay visible in LEDGER, so nothing is silently dropped.
- K13 Probe F re-run on the current artefact → no new false fail.
  - A good later fix block that skips the queue would make the "9, 10 and 11" list incomplete but not false, and its own log paragraph records its scope.
  - The open Probe F proposals in other units' reports (TM R9, R10, R11; contract R9, R10; ADRs R10–R12) are queued in LEDGER, so under :163 they are not defects of this version.
- K14 Regression. No unit is frozen, so I chose two substitutes as far as possible from the fix-block-11 edits (:3, :163, :229):
  - (a) MC-03 vs CONTRACT §6.1 → PASS (K6), against the **changed** CONTRACT;
  - (b) MC-10 keys vs CONTRACT §1.3 → PASS (K7).
- K15 JL-1..JL-6 (:96-104) → [inspection-only] PASS. Each is a one-line question tied to a CLAUDE.md duty, and they are at the same lines as in R14.
- K16 ADR-specific rules (:90-94) → [inspection-only] PASS. They are at the same lines as in R14.

CANDIDATES (Lens A style, recorded for traceability)
- C1 · The fix blocks are attributed to operator scoping.
  - Evidence: RUBRIC :163 "**Fix blocks 9, 10 and 11 were scoped by the operator to named defects** …".
  - Criteria: JL-2 and JL-4 (does it attribute a decision to a human?).
  - **DISMISSED.**
    - LEDGER :17, :16 and :13 record the operator choosing "One extra fix + verify", "Another extra fix + verify" and a standing grant of "fix-and-verify rounds" for a unit "whose last verdict has 0 blocking defects".
    - Each choice answered a verdict that listed named defects (R12 0+3, R13 0+2, R14 0+1, per LEDGER :38).
    - CLAUDE.md :28 says "A block does exactly one job: … one fix". A "fix" round authorised on a defect list is therefore scoped to that list.
    - No LEDGER entry has the operator asking for the queue to be processed in these rounds.
    - The claim changes no check outcome, because the freeze gate is independent of it.
- C2 · The freeze condition is stated twice in :163: "can be frozen only with an empty queue" and "freezes only when that queue is empty".
  - Criterion: MC-44.
  - **DISMISSED.** The two statements say the same thing and don't conflict. This is cosmetic.
- C3 · The register heading still says "(fix blocks 6 to 9)" (:176) after fix blocks 10 and 11.
  - Criterion: MC-44.
  - **DISMISSED.** Neither fix block added or changed a register row. The register logs proposals, and fix blocks 10 and 11 fixed defects, logged at :229 and :231. R14 C3 reached the same verdict.
- C4 · The fix-block log at :229-235 is reverse-chronological (11, 10, 9, 8), while :132-174 log fix blocks 1–7 in chronological order.
  - Criterion: JL-4.
  - **DISMISSED.** Each paragraph names its fix block and its defects, so the order doesn't mislead. R14 C2 reached the same verdict.
- C5 · "LEDGER 2026-10-05" (:229) matches five LEDGER rows.
  - Criterion: MC-44.
  - **DISMISSED.** Only :13 is the standing grant, which :229 names, so the reference resolves by content. R13 and R14 accepted the same form.

DEFECTS
- none

VERDICT: POSITIVE (zero real defects)

Note for the operator:
- Fix block 11 closed R14 D1 (K3, K11). The queue rule now says which fix blocks processed the queue, and every statement in it was re-derived against LEDGER.
- No conversion, key, Arc-constant or source-integrity check regressed. K6 and K7 were redone against the CONTRACT that changed after R14. The drift tool, run by me, is clean: 0/0/0 over 33 URLs and 40 archives.
- **This POSITIVE does not make the rubric freezable.** :163 requires an empty LEDGER queue, and as of 12:16 it holds **8 entries**: contract R9 and R10; TM R9, R10 and R11; ADRs R10, R11 and R12. A queue-processing fix block must run, and then be verified, before any freeze.
- Streak counting under CLAUDE.md (3 consecutive POSITIVE passes: Lens R, Lens A, Lens H) is for the main agent to record.
- The MC-07 Probe F rewording still needs human acknowledgement at G1.

Phase 1 · units frozen 0/11 · streak 1/3 (P1-rubric, pending main-agent record) · rounds used 10/10 + grace 2/2 + extra 3 (P1-rubric; standing grant 1 of 3) · regen budget left 1
