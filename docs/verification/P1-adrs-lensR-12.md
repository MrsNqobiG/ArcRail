VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 12 (grace round 2 of 2, final), after fix block 8 · commit: none (uncommitted working tree; the repo has no commits)

Run window: 2026-10-05 09:52 UTC to 10:04 UTC. The guard hook was not loaded, so the verifier followed its rules by hand:
- read-only HTTPS GETs of documentation pages only, through `tools/source_drift.py` (33 URLs from MANIFEST: docs.arc.io, developers.circle.com, fic.gov.za, gov.za, resbank.co.za, inforegulator.org.za). I listed the URLs before running it, and none of them is an RPC endpoint;
- no RPC call of any kind, so no mainnet endpoint and no signing or sending method;
- no .env file or key material read.
- The only file written in the repo is this report. The drift tool's output went to the session scratchpad.

## Versions

ADR SHA-256 prefixes, the same at the start (09:52 UTC) and the end (10:03 UTC):
- 001 b38638549b8ac4fc (**changed vs R11** 328b22779bb220be; fix block 8)
- 002 f56d8a71d580dbb6, 003 9f73f03bebac8f5e, 004 43554bbf083caec3, 005 08cdf2fb0dc482fa, 006 9a91b242428b25cc, 007 05c75efbf80b87d2. All are byte-identical to R11.

Fix block 8 also changed the authoritative Q-D1 row in OPEN_QUESTIONS (same mtime as ADR-001; LEDGER:29 records "Q-D1 (g) covers every cap incl. move caps"). So the change was not ADR-001 only.

Sibling versions (MC-40 label clause, version pinning). **Six siblings changed during this run**, because other units' fix blocks were running at the same time:

| Document | At start (09:52 UTC) | At end (10:03 UTC) | Effect on this run |
|---|---|---|---|
| OPEN_QUESTIONS | 37fae4b536baa8f0 | 0195ba241196d7dd | Q-D1 (:85) and Q-D4 (:88) were re-read at the end. Both are unchanged in the parts used below |
| CONTRACT | baed1fbe177436b9 | d6768590a827999c (contract fix G) | **CF-22 closed**: :379 "The signer refuses a cancel or a replacement (… fee limits or daily cap, ADR-001 duty 3) → PAUSE with `createCase SIGNER_REFUSED`" |
| THREAT_MODEL | 6da9415a6a3ec059 | e134eede2f943abf (threat-model fix 7) | Residual 4 moved from :196 to :198 and still reads "per-transaction and daily limits" |
| ADR-008 | e268da84dd5370ca | 18ff96fcf0c21714 | Rmove moved from :39 to :40, unchanged ("within the move caps (ADR-001 duty 6)") |
| RUBRIC | bc53ce25ee66ce6b | 4387ef4325c2f11e | The MC-45 restatement clause at :85 is unchanged |
| LEDGER | 4cc5b85ccb50fd1b | ca51d9bc331149cc | Added **CF-23** (to ADR-001: owner-signed, version-pinned signer artefacts) and closed CF-22 |

Note: CONTRACT's mtime (09:26 UTC) falls inside R11's run window, so R11's "CONTRACT unchanged 6e0c6cdd" was probably a start-only hash. I re-traced the CONTRACT signature rows against the current version below.

Unchanged siblings: RISK_REGISTER 10a99078e3df4ec4, constants e494e7724fa544fb.

## Criteria and exclusions

Criteria applied:
- RUBRIC MC-03, MC-11 (resolution exits), MC-21 (shared method, run by me), MC-43, MC-44, MC-45, the ADR rules, and JL-1 to JL-6;
- CLAUDE.md N1, N2, N4 and N5.

Routed, open CF items, which are not counted as defects:
- CF-9(b) (CONTRACT §5.0:236 still has the 3-tuple signing log);
- CF-18;
- CF-19;
- CF-20 (Goldsky in ADR-002);
- CF-21 (ADR-001 Q-D3 restatement and the ADR-006 path);
- **CF-23** (new mid-run, signer artefact verification in ADR-001).

## CHECKS

### R11 D1: fee limits, re-traced with exact Python integers → PASS

- ADR-001:15–18 adds:
  - "per-tx and daily **value** caps; **fee limits** on every signature, cancels and replacements included";
  - "a ceiling on `maxPriorityFeePerGas`";
  - "a ceiling on the worst-case fee `gasLimit × maxFeePerGas`";
  - "every signature's worst-case fee counted against the daily cap".
- ADR-001:23 (duty 6): cancels "count against no **value** cap, but **their fees count against the daily cap and the fee limits of item 3**".
- R11's attack, a zero-value self-send from a hot wallet with B = 10²¹ wei, maxFeePerGas = ⌊B/21,000⌋ = 47,619,047,619,047,619:
  - its worst-case fee is 21,000 × 47,619,047,619,047,619 = 999,999,999,999,999,999,000 wei;
  - under any ceiling F_max below that, the signer refuses it;
  - **for example**, F_max = 21,000 × 20,000 gwei (C-31) = 420,000,000,000,000,000 wei = 0.42 USDC, and the attack value is above it, so it is refused.
- Maximum debit per signature class under the new text:

  | Class | Bound |
  |---|---|
  | payout or case return | ≤ C_tx + F_max |
  | move | ≤ per-move cap + F_max |
  | cancel | ≤ F_max |
  | replacement | ≤ its class bound |
  | per day | the worst-case fees of every signature, plus payout and return values, ≤ C_day |

  A cancel flood is bounded by C_day / F_max signatures; with the example values, C_day = 10²² gives 23,809.
- Standard EVM semantics (MC-41: no citation needed): the charge is gasUsed × min(maxFeePerGas, baseFee + tip) ≤ gasLimit × maxFeePerGas.
- Signer refusal of a replacement or cancel → PAUSE (CONTRACT :379, CF-22 closed), so the path fails closed.

### R11 D2: move-cap source, vendor-qualified → PASS

OPEN_QUESTIONS:85 (g) "all from its own copy of **every** cap, including the move caps of (f), set by the bank's named owner (Treasury with Risk) and never taken from the orchestrator".

### MC-45 vendor qualification, clause by clause (duty ↔ Q-D1 letter, OPEN_QUESTIONS:85) → PASS

| Duty | Letter | Result |
|---|---|---|
| 1 | (a) | equal |
| 2, including the collection cancel | (b) | equal |
| 3: value caps, fee ceilings (priority fee; gasLimit × maxFeePerGas), fees counted against the daily cap incl. cancels and replacements, chain-ID pin, own copy, owner Treasury with Risk, never from the orchestrator | (g) | equal clause for clause |
| 4 | (e) | equal |
| 5 | (d) | equal |
| 6, including cancel fees and the move-cap source | (f) + (g) "including the move caps of (f)", "cancels and replacements included" | equal |
| signing log | (c) | equal |
| nonce writer | Q-D7 | equal |
| — | (h) | not a duty |

### MC-45 signer rules against every CONTRACT row that requests a signature (current CONTRACT) → PASS

Rows checked:
- §5.4 APPROVED → sign (:342) and APPROVED "signer refuses" → PAUSE (:344);
- SIGNED blocked → self-send cancel (:346);
- BROADCAST "rebroadcast or replace" (:357);
- §5.5 RET_AWAITING_APPROVAL → sign, RET_SIGNED refuses → PAUSE (:409), RET_SIGNED cancel, RET_BROADCAST replacement "same `to`, value and data";
- §5.6 PROPOSED → sign, refuses → ABANDONED (:429), SIGNED cancel, BROADCAST replacement;
- cancel/replacement refusal → PAUSE (:379).

How the classes map to ADR-001's rules:
- a replacement keeps `to`, value and data, so it passes the payout, return or move bullet of duty 2, and duty 4 allows the same nonce;
- cancels follow the item 2 cancel rule;
- every class is subject to the duty 3 fee limits.

Re-traced once per sending wallet role (the R10 Probe G method): hot, gas and collection. The fee limits are role-independent. A collection-wallet cancel is still shape-allowed, and its fee counts against the daily cap.

### MC-45 boundaries → [inspection-only] PASS

| Check | X | Result |
|---|---|---|
| threshold T | T−k / T / T+k | none / none / checker (:23 "at or below" / "strictly above") |
| move cap C | C / C+k | allowed / refused |
| fee ceiling F_max ("ceiling", read as the inclusive maximum, like the caps) | F_max / F_max + 1 wei | allowed / refused |

A payout at value = C_tx with fee f > 0 debits C_tx + f. That is allowed by the per-tx **value** cap and counted at C_tx + worst-case fee against the daily cap (see C-1, DISMISSED).

### MC-45 backward trace from owner cells → PASS

- THREAT_MODEL residual 4 (:198) and RISK_REGISTER RB-7 (:85) both say "the signer's per-transaction and daily limits cap the damage". **This is now true for fees as well as value** (R11 D1 closed).
- T-T1 (:78), T-E2 and T-E5 agree with duties 1, 2 and 4.

### MC-45 ADR-to-ADR → PASS

- ADR-008:40 Rmove "an amount within the move caps (ADR-001 duty 6)";
- ADR-008 DR-01/DR-13 input rows (:52, :63) take Treasury's list and move caps;
- the signing log and attestation protocol are unchanged;
- ADR-003:8 nonce writer is set-equal to ADR-001:25 (A adapter; B adapter-supplied or custodian, Q-D7).

### MC-45 Q-D mirror and restatements (set-equal reading, per the RUBRIC:85 restatement clause) → FAIL (D1)

ADR column mentions:
- D1 → 001, 008;
- D2 → 001, 006;
- D3 → 001, 006;
- D4 → 003;
- D5 → 004;
- D6 → 005;
- D7 → 001, 003.

All are present.

Restatements:
- Q-D1 (ADR-001:64): explicitly defers ("the authoritative wording is the OPEN_QUESTIONS row") → PASS.
- Q-D7 (ADR-001:75, ADR-003:34): equal → PASS.
- Q-D2 (ADR-001:76) omits "(including per-address fees)", but ADR-001:45 states it with Q-D2. As a whole it mirrors the row → PASS.
- Q-D3: CF-21, routed.
- Q-D5 (ADR-004): equal.
- Q-D6 (ADR-005:37) omits the threshold clause, but ADR-005:27 states it with Q-D6 ("That threshold is a human decision (Q-D6), and its default is 'none'") → PASS.
- Q-A11 (ADR-002) equal; Q-A12 (ADR-002) equal to the question text.
- **Q-D4 (ADR-003:33) → FAIL (D1).**
  - ADR-003 says: "Which database does the bank run and support operationally? It must provide serialisable transactions, or row locking with a transactional outbox."
  - OPEN_QUESTIONS:88 adds: "Does its engine write a **row-level read audit log** that the application identity can't alter (THREAT_MODEL DR-26)?"
  - No text in ADR-001…007 mentions the audit-log clause or DR-26 (grep "audit log|read audit|DR-26": 0 hits), and ADR-003 has no deferral.
  - No CF item routes it (grep LEDGER for ADR-003 and Q-D4: only CF-17, which is about RISK_REGISTER RB-10).
  - R10 and R11 applied a mention-only reading of the Q-D mirror. That is exactly the reading that ADRs R9 Probe G(2) (register row 45) was adopted to stop.

### MC-44, IDs resolved by script → PASS

- Every Q-, C-, CF-, DR-, T-, RR-, RB- and MC- ID in ADR-001…007 was extracted and grepped in its home document: **0 unresolved** (C-10 … C-68, CF-1, CF-5, DR-01/04/12/13/17/18/24, MC-17, MC-24, Q-A9/11/12, Q-C1, Q-D1–Q-D7, Q-P1, Q-R3/4/9/10, Q-T2, Q-T6, RB-1, RB-7, RR-3, T-E2/E3/E5, T-I1, T-S2, T-S5, T-T1).
- G-M 2, 5 and 8 exist in GATES.md:19, :22, :25.
- CONTRACT §1.3, §3, §4, §5.0, §5.5, §5.6, §6 and §6.1 all exist with the claimed topics. §1.3:104 "Nonce and fees are left out on purpose" matches ADR-001:21.
- The new reference "ADRs R11 D1" resolves to P1-adrs-lensR-11 D1 (the fee limit).

### MC-21, shared method, run by me → PASS

- I read `tools/source_drift.py` in full: stdlib only, GET-only, writes only to `--out`. SHA-256 5504b5e7…. No earlier report records a hash, so I reviewed it by reading it.
- Ran it 09:53–09:54 UTC: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33". Every URL is identical, so I checked quotes against the local archives (normalised for whitespace and markup), and each was found in at least one archive:
  - "No Arc-specific MPC protocol modifications are needed";
  - "one unique address per user";
  - "analytics, wallet screening, and monitoring tools";
  - 5042002;
  - 0x5294…;
  - "Minimum base fee (testnet) | 20 Gwei";
  - "Maximum base fee | 20,000 Gwei";
  - "Hard ceiling that bounds worst-case cost";
  - the `maxPriorityFeePerGas` tip sentence (gas-and-fees:80; this backs ADR-001:17 "the priority fee is not [bounded]");
  - "The minimum base fee is 20 Gwei" (C-30);
  - "The base fee is paid to the block beneficiary, not burned" (C-34);
  - "syncing from genesis is not supported";
  - "64 GB+";
  - "1 TB+ NVMe SSD (TLC recommended)";
  - "Stable 24 Mbps+";
  - v0.8.0;
  - "approximately 21,000 gas units";
  - viem;
  - Reth;
  - rpc.quicknode.testnet.arc.io.
- C-30 and C-31 in constants (:49, :50) match ADR-001:17's use.

### MC-43 (ADR-004, byte-identical since R9) → [inspection-only] PASS (extracted text)

All 7 quotes were re-found in `fic/Directive-9.extracted.txt`, once each:
- "comes into operation on 30 April 2025";
- "may not execute a crypto asset transfer if it cannot comply";
- "prior to, or simultaneously with";
- "Post facto transmission";
- "unless there is a suspicion of money laundering or terrorist financing";
- "must verify the information pertaining to the originator";
- "R5 000".

### MC-03 arithmetic (exact Python integers) → PASS

- ADR-006:13: 21,000 × 20·10⁹ = 420,000,000,000,000 wei; divmod(·, 10¹²) = (420, 0) → 0.00042 USDC. It matches.
- At p = 6 (k = 10¹²), (m, r) for each w:

  | w | (m, r) |
  |---|---|
  | 0 | (0, 0) |
  | 1 | (0, 1) |
  | k−1 | (0, 999,999,999,999) |
  | k | (1, 0) |
  | 10¹⁸ | (1,000,000, 0) |
  | 1,000,000,500,000,000,000 | (1,000,000, 500,000,000,000) |
  | 123,456,789,012,345,678,901 | (123,456,789, 12,345,678,901) |
  | (2⁶³−1)·k + k−1 | (9,223,372,036,854,775,807, 999,999,999,999) |

- At p = 2 (k = 10¹⁶): 10¹⁸ → (100, 0); 123,456,789,012,345,678,901 → (12,345, 6,789,012,345,678,901).
- Each value is identical to R11's.

### Structure and safety scans

- **Count and topics:** 7 target files → PASS.
- **Do not decide:** "Status: PROPOSED. A human decides at G1." appears exactly once in each file (×7) → PASS.
- **Options and phases (script):**
  - option counts 3, 3, 3, 3, 3, 4, 4;
  - 3 phase rows each in ADR-001…006; ADR-007:29 "the same in all phases" with a reason;
  - ADR-001's prose (:54) and table (:60) both condition B on "Q-D1 (a)–(g)".
  - → PASS. Trade-off substance: [inspection-only] PASS.
- **CLAUDE.md N1/N2 scans** (the mainnet ID was assembled at run time) → [inspection-only] PASS:
  - testnet ID: 3 hits, all in ADR-001 (:6, :20, :71);
  - mainnet ID: 0;
  - mainnet hostnames: 0;
  - 64-hex strings: 0;
  - gitleaks is not on PATH.

### Judgment lenses

- **N4 / JL-2:** the fee ceilings are covered by "every cap (here and in item 6), set by a named human owner (Treasury, with Risk)" (:20) and by Q-D1 (g) "all from its own copy of every cap". No ADR picks a value → [inspection-only] PASS.
- **JL-1:** the fee path now fails closed (refusal at the ceilings or the daily cap → CONTRACT PAUSE, :344, :379, :409) → PASS.
- **JL-3, JL-5, JL-6:** unchanged since R11 → [inspection-only] PASS.
- **Counts vs LEDGER:** 12 unit rows, 0 frozen. The P1-adrs Status column now reads "fix block 8 used", which matches the verdict column (R11's note is resolved) → PASS.

### Regression check (no frozen units; substitutes farthest from the ADR-001 edit, not used in R10 (002/006) or R11 (004/007))

**(1) ADR-005** (byte-identical since R8) → PASS:
- the compliance-vendors quote is in the archive;
- C-27 (constants:42), C-53 (:72), C-55 (:74, the test blocklisted address used in the testnet row :32) and C-63 (:86) have the stated subjects;
- T-S5 (TM:73), T-B1 (:129) "ADR-005 C: self-hosted list matching is the hard gate" and DR-17 (:179, the canary in the testnet row) agree;
- P6.2 exists (cbs-port-requirements:91);
- CONTRACT `screen` and `createCase` exist (:191–192);
- the Q-D6 restatement is mirrored as a whole (:27 + :37).

**(2) ADR-003** (byte-identical since R8) → FAIL (D1):
- the nonce writer (:8) is set-equal to ADR-001:25;
- Q-D7 is equal;
- CONTRACT §1.3 and §4 resolve;
- the prose (:23) and phase table (:28–30) agree;
- **the Q-D4 restatement is not set-equal to OPEN_QUESTIONS:88 (D1).**

## CANDIDATES (Lens A, run for completeness)

**C-1 · "every cap bounds that total" vs per-tx value caps**
- Evidence: ADR-001:15 "per-tx and daily **value** caps"; :18 "every signature's worst-case fee counted against the daily cap"; :20 "So the most a signature can debit is **value + gasLimit × maxFeePerGas**, and every cap bounds that total"; OPEN_QUESTIONS:85 (g) "per-transaction and daily value caps … with fees counted against the daily cap".
- Criterion: MC-45 (boundary).
- Verdict: **DISMISSED**.
- Reason:
  - Read one cap at a time, the sentence would make the per-tx value cap bound value + fee. At X = C_tx with f > 0, that refuses, whereas the bullet allows it.
  - Read distributively, the sentence makes no sense for the fee ceiling, which can't bound value. So the sentence reads as collective ("the caps together bound the total"), and in that reading it is true: C_tx + F_max per transaction, and C_day per day.
  - The specific rules (the bullets, and the authoritative Q-D1 (g)) are unambiguous and agree. The specific rule governs, as in the R11 C-3 precedent.
  - Advisory: reword to "a signature debits at most its value cap + the fee ceiling, and the daily cap bounds the sum of values and worst-case fees".

**C-2 · Fee summaries in ADR-001 omit the new fee limits**
- Evidence: ADR-001:41 options row "caps with the chain-ID pin"; :54 "(… and per-transaction/daily caps)"; :71 "(g) enforce per-transaction and daily caps and the chain-ID pin".
- Criteria: MC-45 restatement; ADR rule (prose agrees with the table).
- Verdict: **DISMISSED**.
- Reason:
  - :64 explicitly defers to the OPEN_QUESTIONS row, which includes the fee limits.
  - The binding condition in the prose and the table is the letter range "Q-D1 (a)–(g)", and they agree with each other.
  - This is the same class as R10 C-3 and R11 C-6.
  - Advisory: add "fee limits" to :41, :54 and :71.

**C-3 · A replacement or cancel may have no fee headroom under the ceilings**
- Evidence: ADR-001:16–17 (ceilings), CONTRACT :357/:379.
- Criteria: MC-11 (exit that can succeed), JL-1.
- Verdict: **DISMISSED**.
- Reason:
  - If an original is signed at the tip or fee ceiling, a same-nonce replacement that must outbid it can't be signed.
  - The outcome is refused → PAUSE with SIGNER_REFUSED (CONTRACT :379, CF-22 closed). That is fail-closed with a two-person exit.
  - The ceiling values are human-owned (JL-2).
  - Advisory for the owner: set F_max ≥ 21,000 × C-31 plus tip headroom, and sign originals below the ceilings.

**C-4 · "Arc's base fee is bounded (C-30 floor 20 gwei…)" cites a testnet-only floor**
- Evidence: ADR-001:17; gas-and-fees:38 "Minimum base fee (testnet)".
- Criterion: MC-21.
- Verdict: **DISMISSED**.
- Reason: the damage bound depends only on the upper bound (C-31, which is not network-qualified) and on the signer's own ceilings. The floor is context, and the testnet is the scope.

**C-5 · ADR-003's Q-D4 restatement drops the DR-26 read-audit-log clause**
- Evidence:
  - ADR-003:33 "**Q-D4:** Which database does the bank run and support operationally? It must provide serialisable transactions, or row locking with a transactional outbox.";
  - OPEN_QUESTIONS:88 "… Does its engine write a **row-level read audit log** that the application identity can't alter (THREAT_MODEL DR-26)? | ADR-003, THREAT_MODEL";
  - RUBRIC:85 "an ADR's restatement of a Q row matches it or explicitly defers to the OPEN_QUESTIONS wording";
  - THREAT_MODEL residual 9 "Registry theft (L-2) is detected by DR-26 only once the database provides row-level read auditing (Q-D4)".
- Criterion: MC-45 (restatement set-equal or deferred; ADRs R9 Probe G(2), register row 45).
- Verdict: **REAL**.
- Reason:
  - The restatement isn't set-equal, it doesn't defer, and no other ADR text carries the clause.
  - It matters for ADR-003's own decision. Option C ("None beyond the adapter's own DB") puts the registry in the DB chosen through Q-D4, and whether DR-26 can ever run (THREAT_MODEL residual 9 / RB-10) depends on that DB.
  - A G1 human choosing C and a DB from ADR-003 alone would not see the requirement.
  - It isn't routed (no CF item names ADR-003 or the Q-D4 clause).
  - R10 and R11 missed it by applying a mention-only mirror check.

**C-6 · Signer artefacts (Treasury's list, caps, monitor key) aren't owner-signed or version-pinned in ADR-001**
- Evidence: LEDGER:61 CF-23.
- Verdict: **DISMISSED** as a defect this round: it is routed as open CF-23 (MC-40 "routed as an open CF item"). The LEDGER says it goes to the G1 packet.

**Probe G (would the rubric wave through a bad version of this artifact?): YES.**
- No MC item tests the signer's **value caps, fee ceilings or daily-cap fee accounting** in code:
  - MC-22 bounds maxFeePerGas from below only;
  - MC-23 tests shape;
  - MC-24 tests the assertion and replay.
- ADR-001's testnet row (:59) lists "same shape allow-list and assertion checks", not limits.
- So a Phase 2 U9 that drops the fee ceiling, or exempts cancels from the daily cap, would pass every MC item. MC-07 and MC-08 only measure the code that exists.
- Proposed (for MC-22 or a new MC): "signer limit tests at the boundary: a value at cap and at cap + k; worst-case fee at the ceiling and at the ceiling + 1 wei; a zero-value cancel whose fee would exceed the remaining daily cap → refused; a replacement counted against the daily cap".
- This complements R11's queued Probe G, which is design-side.

**Probe F (would the rubric fail a good version?): YES.**
- The MC-45 restatement clause, read per restatement, would fail ADR-005 (Q-D6 at :37 omits the threshold clause, which :27 states with Q-D6) and ADR-001 (Q-D2 at :76 omits per-address fees, which :45 states with Q-D2). In both, the ADR as a whole mirrors the row.
- Suggested reading: "the ADR's restatement **together with its other text citing the same Q-id** is set-equal to the row, or the ADR defers explicitly".
- On this artifact, that reading still fails ADR-003 Q-D4 (D1), because no ADR text carries the audit-log clause.

## DEFECTS

**D1** · docs/adr/ADR-003-orchestration.md:33 (Q-D4 restatement), against docs/OPEN_QUESTIONS.md:88
- Problem: the restatement omits the row-level read audit log clause (THREAT_MODEL DR-26, residual 9). It isn't set-equal and doesn't defer to OPEN_QUESTIONS, and it isn't routed as a CF item.
- Lens and criterion: R / MC-45 (an ADR's restatement of a Q row matches it or explicitly defers).
- Severity: **minor**. The fix is one line: append the clause, or add "(the authoritative wording is the OPEN_QUESTIONS row)". No money moves before Phase 3.

## Status of R11 defects (confirmed by reconstruction)

- D1 (no fee limit; a zero-value cancel drains the hot wallet as fees): **fixed**. The worked case is refused under any ceiling below its worst-case fee, and every class's maximum debit is bounded.
- D2 (Q-D1 doesn't source the move caps): **fixed** ((g) "including the move caps of (f)").

## VERDICT

VERDICT: NEGATIVE (1 defect: 0 blocking, 1 minor)

Phase 1 · units frozen 0/12 · streak 0/3 · rounds used 10/10 + grace 2/2 (P1-adrs) · regen budget left: per LEDGER (not changed by this pass)
