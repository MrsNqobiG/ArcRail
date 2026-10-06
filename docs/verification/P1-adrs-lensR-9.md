VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 9, after reframe fix block 5 · commit: none (uncommitted working tree)

ADR SHA-256 prefixes 001…007, hashed at the start (10:02 UTC) and end (10:08 UTC) of this run, stable:
f3fa9e36b43b7431, f56d8a71d580dbb6, 9f73f03bebac8f5e, 43554bbf083caec3, 08cdf2fb0dc482fa, 9a91b242428b25cc, 05c75efbf80b87d2.
Against R8, only ADR-001 changed. ADR-002…007 are byte-identical to the R8 hashes. ADR-008 = e268da84dd5370ca, the same as the end of R8.

Criteria: KICKOFF §1, §5 P1.4, §6, §9; CLAUDE.md; RUBRIC.md (v2 + fix block 6: MC-03, MC-21, MC-43, MC-44, MC-45 incl. signer-rules-vs-CONTRACT-signature-rows, protocol re-trace, boundary values and the vendor-qualification clause; ADR rules; JL-1…JL-6); constants.md; THREAT_MODEL.md; RISK_REGISTER.md; CONTRACT.md; OPEN_QUESTIONS.md; docs/sources/; agreement with ADR-008. Issues already routed as CF items (CF-9(b) for CONTRACT §5.0:211, CF-15 for CONTRACT §5.6:389) are not counted.

CHECKS:
- R8 D1 (limits vendor-qualified): ADR-001:54 now has "(g) enforce **per-transaction and daily caps** inside the custodian's own boundary (item 3)". The recommendation (:44) and the phase table (:50) both say "(a)–(g)", and their lists are set-equal (7 named items ↔ 7 letters). OPEN_QUESTIONS:84 (g) matches. This now agrees with ADR-008:81, THREAT_MODEL residual 4 and RISK_REGISTER RB-7. → PASS for caps. **Duty 3's chain-ID pin is still not qualified** → FAIL (D2)
- R8 D2 (move-cap scope): ADR-001:13 "every move counts against a **per-move cap** and a **daily move cap**. A move above the per-move cap is refused". This agrees with ADR-008:39 ("within the move caps (ADR-001 duty 6)"), THREAT_MODEL DR-01 (:153) and OPEN_QUESTIONS (f) "for every move". → PASS in duty 6. **The option table :31 still says "below-threshold move rule"** → FAIL (D3)
- R8 D3 (threshold boundary), checked with T = threshold, C = per-move cap:
  - X = T−1 → "at or below" → no checker. X = T → no checker. X = T+1 → "strictly above" → checker.
  - X = C → allowed ("above the per-move cap is refused" means ≤ C passes). X = C+1 → refused.
  - Every value falls in exactly one branch. ADR-008 "within" (≤) and OPEN_QUESTIONS "checker strictly above the threshold" use the same predicate.
  - CONTRACT §5.6:389 still says "below the threshold". That is routed by CF-15.
  → PASS
- R8 D4 (attestation PAUSE semantics). ADR-001:12 duty 5, re-traced case by case against ADR-008:95–97:
  - fresh ALL_CLEAR with seq > max → sign (both documents agree);
  - stale ALL_CLEAR → ignored, then refuse if nothing valid is in force (agree);
  - replayed attestation, seq ≤ max → ignored / "rejects" (agree);
  - fresh PAUSE with seq > max → stops signing and overrides an unexpired ALL_CLEAR (agree);
  - out-of-sequence PAUSE → ignored by both;
  - stale PAUSE with seq > max → ignored by ADR-001. This is equivalent in effect, because a monotone sequence plus timestamps means any earlier ALL_CLEAR has also expired (C-8);
  - missing attestation → refuse (agree).
  → duty 5 PASS. **ADR-001:54 Q-D1 (d) is unchanged: "require the monitor's fresh `ALL_CLEAR` attestation before signing (ADR-008)"**, without the full protocol that is in OPEN_QUESTIONS:84 and ADR-008:120 → FAIL (D1)
- MC-45 signer rules vs every CONTRACT row that requests a signature (rubric fix 6; first round it applies to this unit):
  - §5.4:316 payout → duties 1–5 apply;
  - §5.4:320, §5.5:372, §5.6:392 cancels → duty 6 ("including same-nonce zero-value cancels"; 0 is within both caps, at or below the threshold, `to` is an own wallet);
  - §5.4/§5.5/§5.6 F4 same-nonce replacements → duty 4 exemption;
  - §5.6:389 moves → duty 6;
  - **§5.5:366 case return** (`to` = `returnDestination` chosen by the disposition, CONTRACT:187/:351): duty 2 requires an "allow-listed `to`", and ADR-001 never says which list that is or who owns it. **No defined outcome** → FAIL (D4)
- MC-45 vendor-qualification clause: duty 1 → (a), duty 2 → (b), duty 3 caps → (g), **duty 3 chain-ID pin → none**, duty 4 → (e), duty 5 → (d) (text weaker than the duty, see D1), duty 6 → (f), signing log → (c), nonce writer → Q-D7. → FAIL (D1, D2)
- MC-45 Q-D mirror (OPEN_QUESTIONS:84–91): each row's ADR column is mentioned in that ADR (D1→001, 008; D2→001; D3→001, 006; D4→003; D5→004; D6→005; D7→001, 003). Content: ADR-001's (d) is narrower than OPEN_QUESTIONS (d) → FAIL (D1). (f) is set-equal by reference to duty 6 → PASS
- MC-45 ADR-to-ADR with ADR-008:
  - signing-log tuple and push (ADR-001:14 vs ADR-008:24/:115) agree;
  - ADR-008:110 pilot block "Q-D1 (c) and (d)" ⊂ ADR-001 "(a)–(g)" agree;
  - Rmove caps agree;
  - ADR-002 rule 3 reach matches ADR-008:21;
  - ADR-003:8 nonce writer matches ADR-001:15 and Q-D7.
  → PASS. Exception: Q-D1 (d) text (D1)
- MC-45 backward trace from owner cells naming ADR-001…007: THREAT_MODEL T-T1 (:71), T-E2 (:105), T-E3 (:106), T-E5 (:108), T-B1 (:120, ADR-005 C), B8, B9, L-1/L-3/L-4; RISK_REGISTER 3a/3b (:37/:39), RB-7 (:85). Every owner cell is found in the named ADR. Exception: T-E2's "destination allow-list" (ADR-001, U9) against residual 4 (:187) "the destination allow-list, which the compromised adapter controls" (see D4).
- MC-44 (script over all 7 ADRs): 59 distinct IDs (C-, Q-, DR-, RD-, RB-, RR-, T-, L-, CF-, MC-, P#.#). 0 unresolved. Content agreement: Q-D1(f) is "for every move" but the ADR-001:31 citing text says "below-threshold" → FAIL (D3)
- MC-21 re-fetch (2026-10-03 10:03 UTC, HTTP 200 each). custody, node-requirements, rpc-endpoints, transaction-memos, deposits, compliance-vendors, withdrawals, gas-and-fees, connect-to-arc, contract-addresses and llms.txt are all byte-identical to docs/sources/arc/. Live SHA-256 prefixes equal MANIFEST rows 17, 18, 19, 22, 23, 24, 26, 32, 33, 34, 39. → PASS
- MC-21 constants re-derived from the live pages:
  - chain ID 5042002 (connect-to-arc.md:431/:452/:475; custody C-56);
  - "Minimum base fee (testnet) | 20 Gwei" (gas-and-fees.md:38) and llms.txt:8 "20 Gwei `maxFeePerGas` floor";
  - Memo `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` (contract-addresses.md:281/:288, transaction-memos.md:22);
  - testnet relays rpc/drpc/blockdaemon (node-requirements.md:84), QuickNode testnet only in rpc-endpoints.md:54;
  - "Fetches and verifies blocks" :66; "v0.8.0" :74; "syncing from genesis is not supported" :49; "64 GB+", "1 TB+ NVMe", "24 Mbps+" :31–33;
  - "No Arc-specific MPC protocol modifications are needed" custody.md:184; "must be invoked directly by an externally owned account" transaction-memos.md:85; "unique address per user" deposits.md:43; "analytics, wallet screening, and monitoring tools" compliance-vendors.md:18.
  → PASS
- MC-21/MC-43 quote script (every "…" string of 6 or more characters in ADR-001…007, normalised, searched in docs/sources/ text plus KICKOFF and CLAUDE.md). 3 unresolved, each with a known disposition:
  - ADR-004:7 ¶2.1.9: present at Directive-9.extracted.txt:28. The extractor split "tran saction"; the file's SHA-256 8a6a7087… equals MANIFEST:43, and the PDF 6494e47d… equals MANIFEST:42;
  - ADR-004:26 "block send without complete data" is a KICKOFF §8 control label (KICKOFF:204 "block outbound sends without complete data"), not a source quote;
  - ADR-007:8 "Blocked address" is C-57, observed live, and constants.md:75 says it is not in the docs.
  → PASS (¶2.1.9 [inspection-only] via extracted text)
- MC-03 arithmetic (exact Python integers):
  - ADR-006:13: 21,000 × 20·10⁹ = 420,000,000,000,000 wei = 21/50000 USDC = 0.00042. divmod(·, 10¹²) = (420, 0).
  - CONTRACT §6.1 at p=6 (k=10¹²): 0→(0,0); 1→(0,1); k−1→(0,k−1); k→(1,0); 10¹⁸→(10⁶,0); 1,000,000,500,000,000,000→(1,000,000, 500,000,000,000); 7,374,356,000,000,000→(7,374, 356,000,000,000); (2⁶³−1)·k+k−1→(2⁶³−1, k−1).
  - At p=2 (k=10¹⁶): 15·10¹⁵→(1, 5·10¹⁵); k−1→(0,k−1); 7,374,356·10⁹→(0, all).
  - Odd dust: 123,456,789,012,345,678,901 → p=6 (123,456,789, 12,345,678,901); p=2 (12,345, 6,789,012,345,678,901).
  - uint256 max → m exceeds int64 at both p (overflow guard needed).
  → PASS
- Count and topics: 7 target files, one-to-one with KICKOFF:106–112. → PASS
- Do not decide: "Status: PROPOSED. A human decides at G1." appears exactly once in each of the 7 files (grep -c = 1 ×7). → PASS
- Options and phases (script): option counts 3, 3, 3, 3, 3, 4, 4. Phase rows 3 each for ADR-001…006. ADR-007:29 is "the same in all phases" with a reason (ADR rule). ADR-001 prose (:44) and table (:50) agree. → PASS. Trade-off substance [inspection-only] PASS
- MC-45 fail-closed per dependency: screening ADR-005:25–27 (REVIEW → outbound holds; CONTRACT:166 REVIEW waits for ScreeningOutcome); travel rule ADR-004:29; nodes ADR-002 rules 1 and 6; monitor ADR-001 duty 5; signer refusal → CONTRACT :318/:370 PAUSE, :390 ABANDONED. → [inspection-only] PASS
- CLAUDE.md N1/N2 scans (script; mainnet ID assembled at run time):
  - testnet ID: 2 hits (ADR-001 only);
  - mainnet ID: 0;
  - mainnet hostnames: 0;
  - 64-hex strings: 0.
  No key-material keyword scan was attempted, because of the known Q-T7 guard false positive. gitleaks is not on PATH. → [inspection-only] PASS
- N4 / JL-2: thresholds, caps and the ADR-005 Q-D6 threshold stay policy or human-owned; no ADR picks a value. → [inspection-only] PASS
- KICKOFF §6/§9: FIPS 140-3 L3 (ADR-001:24/:44), segmented signer VM with no inbound internet (:27), Proxmox (ADR-002:25), PIA (ADR-004/005), G-M 2/5/8 named. → [inspection-only] PASS
- JL-1, JL-3, JL-5, JL-6: ADR-003 C adds no cluster; random memo (ADR-006:32); own-node-only address reads (ADR-002 rule 2). → [inspection-only] PASS. JL-1 exception: D1 (vendor qualified on a protocol without PAUSE override).
- Regression check. LEDGER has 0 frozen units, so I used substitutes farthest from the ADR-001 edit, both byte-identical since R7. R8 used ADR-004/007.
  - (1) ADR-005: compliance-vendors quote re-fetched (:18); C-27, C-53, C-55, C-63 subjects re-checked (constants.md:42, :72, :74, :86); recommendation C matches THREAT_MODEL T-B1 (:120) "self-hosted list matching is the hard gate. Vendor scoring adds REVIEW only"; testnet canary = DR-17 (:170); Q-D6 mirrored (OPEN_QUESTIONS:89); fail-closed REVIEW re-traced to CONTRACT:166/:185. → PASS
  - (2) ADR-003: the nonce-writer statement (:8) is set-equal to ADR-001:15 (A adapter; B adapter-supplied or custodian, Q-D7); option C row lock + outbox matches I-ONCE; Q-D4 and Q-D7 mirrored (OPEN_QUESTIONS:87, :90); prose (:23) and phase table (:28–30) agree. → PASS

CANDIDATES (Lens A, run for completeness):
- C-1 · ADR-001's Q-D1 (d) lacks the full attestation protocol.
  - Evidence:
    - ADR-001:54 "(d) **require the monitor's fresh `ALL_CLEAR` attestation** before signing (ADR-008)".
    - OPEN_QUESTIONS:84 (d) "… with the full protocol (reject equal or lower sequence numbers, PAUSE overrides an unexpired ALL_CLEAR, attestations arrive on a direct channel)". ADR-008:120 says the same.
    - ADR-001's own duty 5 (:12) now requires PAUSE override and sequence rejection.
  - Criteria: MC-45 (Q-D content mirror; vendor qualification covers every signer-side control; ADR-to-ADR), JL-1.
  - Verdict: REAL.
  - Reason: this is the unfixed half of R8 D4. Fix 5 changed duty 5 only. A custodian answering yes to ADR-001's (d) is qualified for the pilot (:44, :50) without PAUSE override, and a signer that keeps signing on an unexpired ALL_CLEAR for up to `A_attest` after a PAUSE is fail-open.
- C-2 · The chain-ID pin is not vendor-qualified.
  - Evidence:
    - ADR-001:10 "3. **Limits:** per-tx and daily caps, and chain ID pinned to 5042002."
    - ADR-001:54 "(g) enforce **per-transaction and daily caps** inside the custodian's own boundary (item 3)". :44 "and per-transaction/daily caps".
    - Duty 2 (:9) and Q-D1 (b) don't mention chain ID either. THREAT_MODEL T-E5 (:108) puts "chain ID 5042002" inside the shape allow-list, but ADR-001's shape duty doesn't.
  - Criterion: MC-45 vendor-qualification clause.
  - Verdict: REAL.
  - Reason: R8 D1 named "per-tx and daily caps, chain-ID pin". Fix 5 qualified only the caps. A multi-chain custodian could satisfy (a)–(g) and still sign the same key's transactions for other EIP-155 chain IDs. ADR-001 states no other place where the pin is enforced under option B.
- C-3 · The option-table row is stale.
  - Evidence: ADR-001:31 "| Monitor attestation and below-threshold move rule | … | Custodian policy engine must support them (Q-D1(d), Q-D1(f))". Duty 6 (:13) and Q-D1 (f) (OPEN_QUESTIONS:84 "for every move") now cover every move. The table also has no row for Q-D1 (g) limits under B.
  - Criteria: MC-44 (the citing text claims "below-threshold" but the target says every move), MC-45 (internal agreement).
  - Verdict: REAL.
  - Reason: the options table is where the ADR rule lets trade-offs live, and option B's requirements there are now narrower than the recommendation's (a)–(g). The cost is small but it is a textual contradiction a G1 reader acts on.
- C-4 · The signer's `to` allow-list has no source or owner, and case returns are undefined under duty 2.
  - Evidence:
    - ADR-001:9 "sign only EIP-1559 type-2 transactions to **allow-listed `to`**". ADR-001:7 "the signer **must not trust the orchestrator** … must enforce six things itself".
    - CONTRACT §5.5:366 "RET_AWAITING_APPROVAL | APPROVED … | assign nonce …; the signer verifies and signs". CONTRACT:351 "`R = returnAmount` and the destination are **from the disposition**".
    - THREAT_MODEL residual 4 (:187) "nor does the destination allow-list, **which the compromised adapter controls**. The per-merchant destination allow-list is owned by merchant onboarding in the CBS … and is read by U7".
    - THREAT_MODEL T-E2 (:105) lists "destination allow-list" as signer policy owned by ADR-001.
  - Criteria: MC-45 (signer rules vs every CONTRACT signature row; owner-cell backward trace; ADR↔THREAT_MODEL agreement), MC-11 (resolution exits that can succeed), JL-1.
  - Verdict: REAL.
  - Reason: re-tracing the case-return signature against duty 2 gives one of two results.
    - (i) If the list is a signer-held per-merchant list, a disposition-chosen `returnDestination` is not on it. Every case return is refused → PAUSE (:370), so the case-return path has no exit that can succeed.
    - (ii) If the list is fed by the adapter or U7, as residual 4 says, duty 2's allow-list contradicts :7 "enforce … itself" and is not a signer-side control at all.
    ADR-001 must say which list it is (source, owner, trust domain) and how case-return destinations satisfy it, for example by being covered by the duty-1 approval binding.
- C-5 · Payout and case-return cancels are signed under duty 6, but ADR-008/DR-01 content binding would PAUSE them.
  - Evidence:
    - ADR-001:13 "including same-nonce zero-value cancels … A cancel is a zero-value self-send to the same wallet".
    - ADR-008:36 "the monitor recomputes `payloadDigest` … from the final transaction's own `to` and `value` plus the `instructionId`". ADR-008:43 "Content binding applies to every signing-log entry".
    - THREAT_MODEL DR-01 (:153) "Anything else → PAUSE".
  - Criteria: MC-40(d), MC-45.
  - Verdict: DISMISSED for this unit.
  - Reason: ADR-001 now defines the signer rule for cancels (R8 C-5's advisory is resolved). What follows from the logged `instructionId` (a payout ID on a zero-value self-send) is a classification rule for the monitor, which ADR-008 and THREAT_MODEL own. The outcome is a false PAUSE (fail-closed). **Routing advice:** open a CF item for ADR-008/THREAT_MODEL DR-01 so that a zero-value self-send signing-log entry is classified as a cancel of its instruction's nonce, not as a payout content mismatch.
- C-6 · Splitting gets around the move-approval threshold.
  - Evidence: ADR-001:13 "A move above the per-move cap is refused (it must be split). A move **at or below** the approval threshold needs no checker assertion".
  - Criteria: JL-1, JL-2.
  - Verdict: DISMISSED.
  - Reason: every move, split or not, counts against the daily move cap (:13), and destinations are limited to Treasury's bank-owned list held by the signer (DR-24). Splitting changes who approves, not the maximum exposure. The residual (concentration into the hot wallet, RR-3) is bounded by the daily move cap.
  - Advisory: U7 could add a daily cumulative no-checker sub-cap.
- C-7 · Duty 3 pins chain ID 5042002, but options A and B are recommended for the mainnet pilot.
  - Evidence: ADR-001:10, :50.
  - Criterion: ADR per-phase rule.
  - Verdict: DISMISSED.
  - Reason: CLAUDE.md N1 forbids configuring the mainnet ID before G-M. Changing the pin is the gated U2 config change (MC-20). As written it fails closed (the signer refuses mainnet).
- C-8 · Duty 5 ignores a stale PAUSE, while ADR-008:96 says "stale or `PAUSE` attestation → the signer refuses".
  - Criteria: MC-45 protocol re-trace.
  - Verdict: DISMISSED.
  - Reason: with monotone sequence numbers and timestamps from one issuer, a PAUSE that is stale implies every lower-sequence ALL_CLEAR is also expired, so in both texts the signer refuses. No case produces a different outcome.

Probe G (would the rubric wave through a bad version?): YES, in two ways.
- (1) MC-45 vendor qualification is satisfied by a question letter that cites the duty ("(item 3)") while asking about only part of it (C-2). Proposed: "each vendor-qualification letter is compared **clause by clause** with the duty it cites; a cited duty with an unasked clause fails unless another enforcement point is stated."
- (2) The MC-45 Q-D mirror checks that a Q-D row's ADR **mentions** the question, not that the ADR's restatement is **set-equal** to the OPEN_QUESTIONS row. C-1 passes a mention-only reading. Proposed: "where an ADR restates a Q-row, its text is set-equal to OPEN_QUESTIONS (or explicitly defers to it)."

Probe F (would the rubric fail a good version?): YES.
- MC-45's "Thresholds and caps are checked at the boundary (value = threshold, ±1 base unit)". Internal moves are multiples of `k` (CONTRACT §5.6:389 "X is a multiple of `k`"), so "threshold ± 1 wei" is an unreachable move amount. A literal reading would ask a good ADR to define behaviour for impossible inputs.
- Suggested reading: "±1 of the smallest amount the flow can carry (k wei for moves and payouts)".
- On this artefact, the reading changes nothing: the ADR-001 predicates are total over all integers.

DEFECTS:
- D1 · docs/adr/ADR-001-custody-signing.md:54, Q-D1 (d). Missing the full attestation protocol (sequence rejection, PAUSE overrides an unexpired ALL_CLEAR, direct channel) that is in duty 5 (:12), OPEN_QUESTIONS:84 and ADR-008:120. This is the residual of R8 D4.
  - Lens and criteria: R / MC-45 (Q-D mirror content, vendor qualification, ADR-to-ADR), JL-1.
  - Severity: minor.
- D2 · docs/adr/ADR-001-custody-signing.md:44, :54 (g). Duty 3's chain-ID pin (:10) is in no Q-D1 letter, and no alternative enforcement point is stated for option B. This is the residual of R8 D1.
  - Lens and criteria: R / MC-45 vendor-qualification clause.
  - Severity: minor.
- D3 · docs/adr/ADR-001-custody-signing.md:31. The option-table row says "below-threshold move rule" while duty 6 and Q-D1 (f) cover every move, and option B has no row for Q-D1 (g) limits.
  - Lens and criteria: R / MC-44, MC-45.
  - Severity: minor.
- D4 · docs/adr/ADR-001-custody-signing.md:9 (duty 2), together with :7. The `to` allow-list has no stated source or owner. Re-traced against CONTRACT §5.5:366 (case return to a disposition-chosen `returnDestination`), the signer outcome is undefined. Either every case return is refused (→ PAUSE, no succeeding exit), or the list is adapter-fed, as THREAT_MODEL residual 4 (:187) says, which contradicts "enforce … itself" and T-E2 (:105).
  - Lens and criteria: R / MC-45 (signer rules vs CONTRACT signature rows; owner-cell trace), MC-11, JL-1.
  - Severity: minor.

Severity rationale: no money moves before Phase 3. D2 and D3 are qualification and wording gaps. D1 could qualify a custodian whose stop arrives late by up to `A_attest`, which is bounded by the caps that (g) now qualifies. D4 fails closed in both readings: a false PAUSE, or a non-independent control that the threat model already lists as residual 4. All four sit in ADR-001 (duties 2 and 3, the options table, Q-D1), so they can be fixed in one atomic block on one unit.

R8 D1 (caps part), D2 and D3 are confirmed fixed by reconstruction. R8 D4 is fixed in duty 5 but not in Q-D1 (d). No blocking defect.

VERDICT: NEGATIVE (4 defects: 0 blocking, 4 minor)

Phase 1 · units frozen 0/10 · streak 0/3 · rounds used 9/10 (P1-adrs) · regen budget left 1
