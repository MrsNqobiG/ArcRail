VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 8, after reframe fix block 4 · commit: none (uncommitted working tree)

ADR SHA-256 prefixes 001…007, hashed at the start (09:42 UTC) and end (09:54 UTC) of this run, stable:
e5b28a322356a4ca, f56d8a71d580dbb6, 9f73f03bebac8f5e, 43554bbf083caec3, 08cdf2fb0dc482fa, 9a91b242428b25cc, 05c75efbf80b87d2.
Against R7, only ADR-001 and ADR-002 changed. ADR-003 to ADR-007 are byte-identical to the R7 hashes.

Concurrency notice: during this run ADR-008 changed twice (734fa600… then e268da84…), and THREAT_MODEL (11:45 local), CONTRACT (11:48, contract Fix D: CF-12 closed, §5.6 rewritten), RISK_REGISTER (11:49), OPEN_QUESTIONS (11:54) and LEDGER (11:54) also changed. Every finding below was re-checked against the latest text. Line numbers are post-edit. ADR-008 now sits at :39 (Rmove), :81 (limits), :96 (override) and :120 (Q-D1 (d) full protocol). OPEN_QUESTIONS Q-D1 is at :84.

Criteria: KICKOFF §1, §5 P1.4, §6, §9; CLAUDE.md; RUBRIC.md (current v2 + fix block 5: MC-03, MC-21, MC-43, MC-44, MC-45 incl. the vendor-qualification clause, ADR rules, JL-1…JL-6); constants.md; THREAT_MODEL.md; RISK_REGISTER.md; CONTRACT.md; OPEN_QUESTIONS.md; docs/sources/; agreement with ADR-008.

CHECKS:
- R7 D1 (signing log and attestation in ADR-001):
  - ADR-001:14 now reads "`(payloadHash, nonce, txHash, instructionId)` … **pushes each entry to the independent monitor** (ADR-008), never through the orchestrator".
  - Duty 5 at :12 is the attestation check. Table row :30 reads "pushed to the monitor, with `instructionId`".
  - These match ADR-008:24/:105 and THREAT_MODEL B9 (:31).
  - The CONTRACT §5.0:211 3-tuple is routed to CONTRACT by CF-9(b), so it is not an ADR defect.
  → PASS
- R7 D2 (prose vs phase table): ADR-001:44 "B, provided Q-D1 (a)–(f) are all answered yes … If neither A's precondition nor all of Q-D1 holds, the mainnet pilot is blocked". ADR-001:50 "otherwise B if Q-D1 (a)–(f) are all yes. If neither holds, the pilot is blocked". These are set-equal. → PASS
- R7 D3 (below-threshold moves): duty 6 at ADR-001:13 states a class rule (`to` on the signer's own copy of Treasury's list, per-move cap, daily move cap). It is qualified as Q-D1 (f) at :54. CONTRACT §5.6:389 now cites "ADR-001 duty 6 for moves below the threshold". → PASS on the move class. See D2 and D3 for the scope and boundary of the rule.
- R7 D4 (ADR-002 RPC reach): ADR-002:31 "reachable only from the **adapter and independent-monitor segments** (ADR-008), never from the internet". This agrees with THREAT_MODEL B9 (:31, :35) and ADR-008:21 "own fetch from own nodes". → PASS
- MC-45 vendor-qualification clause ("Every vendor-qualification question (for example Q-D1) covers every signer-side control the ADR requires"):
  - I mapped the six duties plus the log and the nonce writer against Q-D1 (a)–(f) and Q-D7.
  - Duty 1 → (a). Duty 2 → (b). Duty 4 → (e). Duty 5 → (d). Duty 6 → (f). Signing log → (c). Nonce writer → Q-D7.
  - **Duty 3 (per-tx and daily caps, chain ID pin) → no question.**
  → FAIL (D1)
- MC-45 Q-D mirror (OPEN_QUESTIONS:84–91): each Q-D row's ADR column is mentioned in that ADR (D1→001+008, D2→001, D3→001+006, D4→003, D5→004, D6→005, D7→001+003). OPEN_QUESTIONS Q-D1 (d) now carries "with the full protocol (reject equal or lower sequence numbers, PAUSE overrides an unexpired ALL_CLEAR, …)", but ADR-001:54 (d) does not. → mirror direction PASS; content agreement FAIL (D4)
- MC-45 ADR-to-ADR (ADR-001…007 vs ADR-008):
  - Signing log tuple and push: agree.
  - Pilot block ADR-008:110 "Q-D1 (c) … and (d)" ⊂ ADR-001 "(a)–(f)": agree.
  - ADR-002 rule 2/3 vs monitor reads: agree.
  - Rmove cap scope (ADR-008:39 vs ADR-001:13): FAIL (D2).
  - Attestation PAUSE semantics (ADR-008:96 vs ADR-001:12): FAIL (D4).
- MC-45 backward trace from owner cells naming ADR-001…007:
  - THREAT_MODEL T-T1 (:71), T-E2 (:105), T-E3, T-E5 (:108), B9, L-1, L-3.
  - RISK_REGISTER 3a/3b (:37, :39).
  - CONTRACT §5.6:389, §5.0:211.
  - Each owner cell is found in the named ADR.
  → PASS on owner cells
- MC-44 forward resolution (script over all 7 ADRs): 58 distinct IDs (R7: 57; DR-24 added). 0 unresolved. Content spot checks:
  - DR-24 = Treasury's bank-owned list (THREAT_MODEL:175);
  - MC-24 = durable, shared replay record (RUBRIC:66);
  - CF-5(g) = replay rule;
  - RB-7 cites signer limits (RISK_REGISTER:85);
  - C-56 = HD path / chain ID;
  - C-68 = relays.
  → PASS (RISK_REGISTER "2c" citation at ADR-001:14: see candidate C-7)
- MC-21 re-fetch (2026-10-03 09:48 UTC, HTTP 200 each): node-requirements, rpc-endpoints, integrate/exchanges/custody, usdc-system-events, withdrawals and gas-and-fees are all byte-identical to docs/sources/arc/. Archive SHA-256 for node-requirements, rpc-endpoints and custody equals the MANIFEST rows 23, 24 and 32. → PASS
- MC-21 quotes (script: every "…" string of 6 or more characters in ADR-001…007, normalised, searched in docs/sources/ text plus KICKOFF and CLAUDE.md): everything resolves except the same 4 strings as R7, with the same dispositions.
  - ADR-007 "Blocked address" is C-57, not in the docs by definition.
  - ADR-004 "block send without complete data" is a KICKOFF control label.
  - Two Directive 9 strings: see MC-43.
  - ADR-002 host claims re-derived: testnet relays are rpc / drpc / blockdaemon (node-requirements.md:84); mainnet relays add quicknode (:83); QuickNode testnet RPC is listed at rpc-endpoints.md:54; "Fetches and verifies blocks" is at :66; "IPC mode (default)" is at :102.
  → PASS
- MC-43 Directive 9 (ADR-004 unchanged). The archived PDF SHA-256 6494e47d… equals MANIFEST row 42. I decoded the Flate streams myself (stdlib) and re-found:
  - ¶4.6 "unless there is a suspicion of money laundering or terrorist financing, in which case" and "must verify the information pertaining to the originator";
  - ¶4.8 "may not execute a crypto asset transfer if it cannot comply";
  - ¶7.2 "prior to, or simultaneously with";
  - ¶7.3 "is not permitted";
  - ¶9.1 "30 April 2025";
  - ¶4.5 "5 000".
  ¶2.1.9 "any value above zero" was not recovered by either my literal-string or my hex-operand decoder (CID glyphs; ToUnicode CMap not applied). It is present in the MANIFEST-hashed Directive-9.extracted.txt:28. → PASS except ¶2.1.9, which is [inspection-only] PASS
- MC-03 arithmetic (exact Python integers):
  - ADR-006:13: 21,000 × 20·10⁹ = 420,000,000,000,000 wei = 21/50000 USDC = 0.00042. divmod by 10¹² = (420, 0).
  - CONTRACT §6.1 at p=6: all 9 rows reproduce, including the boundaries:
    - 0 → (0, 0);
    - 1 wei → (0, 1);
    - k−1 → (0, k−1);
    - k → (1, 0);
    - max signed-64 m: (2⁶³−1)·k + k−1 → (2⁶³−1, k−1), and +1 base unit of m overflows.
  - CONTRACT §6.1 at p=2: all 4 rows reproduce.
  - Wei→units: 1,234,567,890,123,456,789 → (1,234,567, 890,123,456,789).
  - Odd dust: 123,456,789,012,345,678,901 → p=6 (123,456,789, 12,345,678,901); p=2 (12,345, 6,789,012,345,678,901).
  - uint256 max at p=6: m is 217 bits (PAUSE guard needed), dust 913,129,639,935.
  → PASS
- Count and topics: 7 target files, one-to-one with KICKOFF_PROMPT.md:106–112. → PASS
- Do not decide: "**Status: PROPOSED. A human decides at G1.**" appears exactly once in each of the 7 files. → PASS
- Options, trade-offs and per-phase recommendation (script):
  - Option counts: 3, 3, 3, 3, 3, 4, 4.
  - Phase rows: 3 each for ADR-001…006.
  - ADR-007:29 is "the same in all phases" with a reason (ADR rule).
  → [inspection-only] PASS for trade-off substance
- MC-45 fail-closed per dependency: screening ADR-005:25–27; travel rule ADR-004:29; nodes ADR-002 rules 1 and 6; monitor ADR-001 duty 5; custodian or HSM down means no signature. → [inspection-only] PASS
- CLAUDE.md N1/N2 scans (script; mainnet chain ID assembled at run time):
  - testnet chain ID: 2 hits (ADR-001);
  - mainnet chain ID: 0;
  - hostnames: docs.arc.io and testnet RPC hosts only, 0 mainnet hostnames;
  - 64-hex strings: 0.
  - A keyword scan for key-material terms was **blocked by the PreToolUse guard hook**, because the regex itself contains the watched words. This is a false positive of the Q-T7 class. I did not work around it, so it is reported here. gitleaks, semgrep, trivy and osv-scanner are not on PATH.
  → [inspection-only] PASS
- N4 / JL-2: ADR-005 vendor scores never yield CLEAR. The threshold is human-owned (Q-D6, default none). Signer caps and thresholds are policy values, not chosen in the ADR. → [inspection-only] PASS
- KICKOFF §6/§9: FIPS 140-3 L3, segmented signer VM with no inbound internet (ADR-001:27), Proxmox (ADR-002:25), PIA rows, G-M 2/5/8. → [inspection-only] PASS
- JL-1, JL-3, JL-5, JL-6: ADR-003 C adds no cluster; random memo at ADR-006:32; address reads only to own nodes (ADR-002 rule 2). → [inspection-only] PASS. JL-1 exception: D4.
- Regression check. LEDGER lists 0 frozen units, so I used substitutes farthest from the ADR-001/002 edits, both byte-identical since R7:
  - (1) ADR-004: Directive 9 pinpoints re-derived from the PDF as above; ¶4.6 qualifier kept with the "[it]" substitution (ADR rule: qualifiers kept); fail-closed rule at :29 re-traced to CONTRACT §5.4:305 (TRAVEL_RULE incomplete → HELD_FOR_CASE). → PASS
  - (2) ADR-007: withdrawals.md has 5 viem and 1 ethers hits; Reth is at llms.txt:25; C-57, C-62, C-63 and C-65…C-67 exist with the stated subjects (constants.md:75, :85–:89). → PASS

CANDIDATES (Lens A, run for completeness):
- C-1 · Signer limits are not vendor-qualified.
  - Evidence:
    - ADR-001:10 "3. **Limits:** per-tx and daily caps, and chain ID pinned to 5042002."
    - ADR-001:54 Q-D1 (a)–(f) and ADR-001:44 "(a)–(f) … assertion verification, shape allow-list, pushed signing log, monitor attestation, replay rule, and the below-threshold move rule". No limits.
    - The option table ADR-001:28–31 has no limits row for B.
    - OPEN_QUESTIONS:84 is likewise silent.
    - Load-bearing elsewhere: THREAT_MODEL:187 residual 4 "The signer's **per-transaction and daily limits** cap the damage"; RISK_REGISTER:85 RB-7; ADR-008:81 "The loss in that window is bounded by the signer's per-transaction and daily limits".
  - Criterion: MC-45 vendor-qualification clause.
  - Verdict: REAL.
  - Reason: under option B, a custodian that satisfies (a)–(f) but enforces no per-tx or daily cap qualifies for the pilot. Yet three documents rely on exactly those caps to bound the residual-4 / RB-7 / ADR-008 window loss. The orchestrator-side U7 limits sit in the compromise domain, so they don't substitute.
- C-2 · Move-cap scope differs between ADR-001 and ADR-008/THREAT_MODEL.
  - Evidence:
    - ADR-001:13 "CONTRACT §5.6 signs moves below the approval threshold with no checker. The signer allows that **only** if … the amount is within a per-move cap … Anything above the threshold needs a checker assertion as in item 1." The caps are conditions of the approval-exempt path only.
    - ADR-008:39 "Rmove: each needs … an amount within the move caps (ADR-001 duty 6)". THREAT_MODEL:153 DR-01 "**Move:** `to` is on Treasury's list, and the amount is within the move caps … Anything else → **PAUSE**". Both apply to every move.
  - Criteria: MC-45 (ADRs and THREAT_MODEL agree on a shared control), MC-40(d) (no PAUSE on legitimate flows).
  - Verdict: REAL.
  - Reason: an approved above-threshold sweep whose amount exceeds the per-move cap is permitted by ADR-001 and then classified "anything else → PAUSE" by the monitor. The two only agree if the per-move cap is at least every approved move, which no document states. ADR-008 cites ADR-001 duty 6 as the definition, so ADR-001 is the document that must state the cap's scope (all moves, or exempt moves only). The other side must then follow.
- C-3 · Threshold equality is in neither branch.
  - Evidence:
    - ADR-001:13 "moves **below** the approval threshold with no checker … Anything **above** the threshold needs a checker assertion".
    - CONTRACT §5.6:389 "policy ALLOW (or approved **above** threshold) | sign through the signer (ADR-001 duty 6 for moves **below** the threshold …)".
  - Criteria: MC-45, JL-1. Boundary reconstruction (method: boundary values).
  - Verdict: REAL.
  - Reason: re-trace with X = threshold. CONTRACT requests a signature with no approval (not "above"). Duty 6 doesn't apply (not "below"). Item 1 has no assertion to verify. The signer's rule is undefined, and the CONTRACT/ADR pair is silent at exactly the threshold. This fails closed if the signer refuses (CONTRACT §5.6 "signer refuses" → ABANDONED). Even so, the boundary must be stated once (≤ or <) in the owner document so U7 and U9 tests use the same predicate.
- C-4 · ADR-001's attestation duty and Q-D1 (d) don't carry ADR-008's PAUSE-override protocol.
  - Evidence:
    - ADR-001:12 "refuse to sign without a fresh `ALL_CLEAR` attestation … **Reject** stale, out-of-sequence or `PAUSE` attestations."
    - ADR-001:54 (d) "**require the monitor's fresh `ALL_CLEAR` attestation** before signing (ADR-008)".
    - Versus ADR-008:96 "A `PAUSE` **overrides** any unexpired `ALL_CLEAR`"; ADR-008:120 and OPEN_QUESTIONS:84 (d) "with the full protocol (reject equal or lower sequence numbers, PAUSE overrides an unexpired ALL_CLEAR, attestations arrive on a direct channel)".
  - Criteria: MC-45 (ADR-to-ADR; Q-D mirror content; vendor-qualification clause), JL-1.
  - Verdict: REAL.
  - Reason: under ADR-001's wording, a signer that "rejects" (discards) a valid PAUSE keeps signing on its last unexpired ALL_CLEAR for up to `A_attest` (proposed 60 s) after the monitor has paused. That is fail-open at the exact moment money must stop. ADR-001's Q-D1 (d) now also differs from the OPEN_QUESTIONS and ADR-008 versions of the same question, so a custodian can be qualified on the weaker text. The concurrent ADR-008/OPEN_QUESTIONS edit made this a visible divergence. ADR-001 was stable throughout the run.
- C-5 · Cancel signatures are not named in ADR-001's rules. Evidence: CONTRACT §5.4:320, §5.5:372 and §5.6:392 "sign a same-nonce zero-value self-send cancel". ADR-001 duties 1 and 6 name approvals and moves only.
  - Criteria: MC-45, JL-1.
  - Verdict: DISMISSED.
  - Reason: the signer can't tell a move from a cancel by its bytes. A zero-value self-send satisfies the duty-6 predicate by construction: `to` is an own wallet on Treasury's list, and 0 is within both caps. Duty 4 exempts cancels from the replay rule. The cancel also never reaches CONTRACT §5.0 classification, because "Zero-value transfers emit no log" and "Self-transfers (`from == to`) emit no log" (C-24; usdc-system-events.md:78).
  - Advisory: name cancels explicitly in duty 6. Note for THREAT_MODEL/ADR-008 (not this unit): a cancel's signing-log entry must not hit DR-01 "anything else → PAUSE".
- C-6 · ADR-002:31 grants the monitor segment RPC reach, without saying "read-only methods". Evidence: THREAT_MODEL:35 "Its **reference** inputs (read-only)".
  - Criterion: MC-45.
  - Verdict: DISMISSED.
  - Reason: "read-only" in THREAT_MODEL describes the inputs, not an RPC method ACL. The monitor holds no signing capability, and the adapter segment has the same reach. There is no contradiction.
  - Advisory: restrict both segments to an RPC method allow-list (no admin/debug namespaces) in U15.
- C-7 · ADR-001:14 cites "RISK_REGISTER 2c/3a/3b" for the signing log, while RISK_REGISTER:29 says of 2c "DR-13 is **not** a detection for 2c, because it *is* the classifier under test".
  - Criterion: MC-44.
  - Verdict: DISMISSED.
  - Reason: ADR-001 cites 2c as context for the signing log, not as a detection claim. The signing log is an input to the §5.0 rule-1 classifier that 2c is about, so the reference says what the citing text implies.
- C-8 · ADR-001:49, the testnet row, lists only "same shape allow-list and assertion checks". ADR-008 testnet B needs the attestation path exercised in E2E.
  - Criterion: MC-45.
  - Verdict: DISMISSED.
  - Reason: ADR-001:7 says the six duties apply "Whichever option is chosen", and the row's list is non-exclusive.
  - Advisory: say "all six duties" in the testnet row.

Probe G (would the rubric pass a bad version?): YES, in two ways.
- (1) No MC item forces boundary reconstruction of policy thresholds and caps that ADRs or CONTRACT state. A bad pair that writes "below → exempt, above → approval" passes every item (C-3). MC-03 covers conversions only.
  - Proposed: "Every threshold or cap stated in an ADR or CONTRACT is re-traced at value = threshold and ± 1 base unit, and each value falls in exactly one branch, with the same predicate in every document that states it."
- (2) MC-45's "ADRs touching the same control agree" is satisfied by matching nouns. A signer ADR that "rejects PAUSE attestations" matches ADR-008's "PAUSE → refuse" by keyword while inverting the override semantics (C-4).
  - Proposed: "For each protocol one ADR defines and another enforces, the enforcing ADR's rule is re-traced against every protocol case (fresh, stale, replayed, PAUSE after ALL_CLEAR, missing)."
- The ADR R7 proposal (signer rules checked against every CONTRACT row that requests a signature) is already queued. It would have forced C-5's advisory to be resolved explicitly.

Probe F (would the rubric fail a good version?): YES.
- MC-45's new clause "Every vendor-qualification question … covers every signer-side control the ADR requires", read literally, fails a good ADR that deliberately enforces one control outside the vendor, for example limits in a bank-run pre-sign policy proxy inside the signer trust domain, in front of a custodian.
- Suggested reading: "covers it, **or** the ADR states where else in the signer trust domain the control is enforced under that option".
- On this artefact the reading changes nothing: ADR-001 states no alternative enforcement point for limits under B, so C-1 stays REAL.

DEFECTS:
- D1 · docs/adr/ADR-001-custody-signing.md:44, :54 (and the option-B rows :28–:31). Q-D1 (a)–(f) and the option-B pilot condition omit duty 3 (per-tx and daily caps, chain-ID pin). THREAT_MODEL residual 4 (:187), RISK_REGISTER RB-7 (:85) and ADR-008:81 rely on those caps.
  - Lens and criteria: R / MC-45 vendor-qualification clause.
  - Severity: minor.
- D2 · docs/adr/ADR-001-custody-signing.md:13. Duty 6 scopes the per-move and daily move caps to approval-exempt moves only. ADR-008:39 ("ADR-001 duty 6") and THREAT_MODEL DR-01 (:153) apply them to every move, so approved above-cap moves would be signed and then PAUSEd.
  - Lens and criteria: R / MC-45 (ADR-to-ADR and ADR↔THREAT_MODEL), MC-40(d).
  - Severity: minor.
- D3 · docs/adr/ADR-001-custody-signing.md:13 together with CONTRACT §5.6:389. "Below" and "above" the threshold leave X = threshold in neither branch, so the signer rule is undefined at the boundary.
  - Lens and criteria: R / MC-45, JL-1.
  - Severity: minor.
- D4 · docs/adr/ADR-001-custody-signing.md:12 and :54 (d). "Reject … `PAUSE` attestations" and an unqualified "fresh ALL_CLEAR" don't carry ADR-008:96's "PAUSE overrides any unexpired ALL_CLEAR", or the full-protocol Q-D1 (d) in ADR-008:120 and OPEN_QUESTIONS:84.
  - Lens and criteria: R / MC-45 (ADR-to-ADR, Q-D content, vendor qualification), JL-1.
  - Severity: minor.

Severity rationale: no money moves before Phase 3. D1 and D4 bound or delay a stop rather than create a loss path on their own. D2 and D3 fail closed (false PAUSE, or refusal → ABANDONED). Each can still mislead the G1 custody decision or the U9 implementation. All four sit in one paragraph pair of ADR-001 (duties 3, 5, 6 and Q-D1), so they can be fixed in one atomic block on one unit.

R7 D1–D4 are confirmed fixed by reconstruction. No blocking defect.

VERDICT: NEGATIVE (4 defects: 0 blocking, 4 minor)

Phase 1 · units frozen 0/10 · streak 0/3 · rounds used 8/10 (P1-adrs) · regen budget left 1
