VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 10, after reframe fix block 6 · commit: none (uncommitted working tree; the repo has no commits)

Run window: started 2026-10-03 10:16 UTC, interrupted by a session restart, resumed 2026-10-05 08:31 UTC, ended 08:43 UTC. After the restart the guard hook was not loaded. The verifier followed its rules by hand: only read-only HTTPS fetches of docs.arc.io; no RPC call of any kind; no mainnet endpoint; no .env or key material read.

ADR SHA-256 prefixes, identical at 10:16 UTC on 10-03, 08:31 UTC on 10-05 and 08:43 UTC on 10-05 (stable for the whole run):
- 001 fb7ea1a3eeb1d781 (**changed vs R9** f3fa9e36b43b7431; fix block 6)
- 002 f56d8a71d580dbb6
- 003 9f73f03bebac8f5e
- 004 43554bbf083caec3
- 005 08cdf2fb0dc482fa
- 006 9a91b242428b25cc
- 007 05c75efbf80b87d2

ADR-002…007 are byte-identical to R9. ADR-008 is e268da84dd5370ca, the same as R9.

Sibling versions compared (MC-40 label clause, version pinning):
- THREAT_MODEL 36256acea1726124 and OPEN_QUESTIONS 0f0f4215872291b5. Both changed at 10:24 UTC on 10-03, mid-run (after the threat-model fix). **All THREAT_MODEL and OPEN_QUESTIONS citations below are to these versions.** THREAT_MODEL line numbers shifted by +6 against R9.
- CONTRACT 6e0c6cdd66eb17b6
- RISK_REGISTER 10a99078e3df4ec4
- RUBRIC ee81f232c9733aa8 (v2 fix block 7)
- LEDGER afc6959b1d8c3d53

Criteria applied:
- KICKOFF §1, §5 P1.4, §6, §9; CLAUDE.md;
- RUBRIC v2 fix block 7: MC-03, MC-11 (resolution exits), MC-21, MC-43, MC-44, MC-45, the ADR rules, JL-1…JL-6;
- constants.md, THREAT_MODEL, RISK_REGISTER, CONTRACT, OPEN_QUESTIONS, docs/sources/, ADR-008.

Issues already routed as CF items are not counted:
- CF-9(b): CONTRACT:230 tuple lacks `instructionId`;
- CF-15: CONTRACT §5.6:415 says "below the threshold";
- CF-18: payout and case-return cancel classification in DR-01.

CHECKS:
- **R9 D1 (Q-D1 (d) full protocol).** ADR-001:62 lists four clauses: "a fresh `ALL_CLEAR` before signing; reject equal or lower sequence numbers; a valid `PAUSE` overrides an unexpired `ALL_CLEAR`; attestations arrive on a direct channel".
  - Clause by clause against OPEN_QUESTIONS:84 (d): the sets are equal (4 ↔ 4).
  - Against ADR-008:95–96 (channel, sequence, override, stale/missing → refuse) and ADR-001 duty 5 (:16): they agree.
  - → PASS
- **R9 D2 (chain-ID pin vendor-qualified).** ADR-001:65 (g) reads "per-transaction and daily caps **and the chain-ID pin to 5042002**". This is set-equal to OPEN_QUESTIONS:84 (g). The options table :35 also says "caps with the chain-ID pin … Q-D1(g)". → PASS. (The prose gloss at :48 omits the pin: candidate C-3, DISMISSED.)
- **R9 D3 (stale option row).** ADR-001:35 now reads "Monitor attestation (full protocol), internal-move rule for every move, and caps with the chain-ID pin | … | Q-D1(d), Q-D1(f), Q-D1(g)". No "below-threshold" text remains; grep finds 0 hits for "below-threshold" in ADR-001. → PASS
- **R9 D4 (`to` binding and case returns), re-traced against every CONTRACT row that requests a signature:**
  - **§5.4 payout:** duty 2 :10 says `to` and value equal the approval's destination and amount. CONTRACT:104 `payloadDigest` contains `destination` and `amountWei`, so the binding can be computed. → defined.
  - **§5.5:391 case return:** RET_SIMULATING success → `requestApproval` (:387) → APPROVED with `checkerAssertion`. Duty 2 binds `to` and value to the approved digest, and the disposition chose `returnDestination` (CONTRACT:375). The signer can sign, so the path has an exit that can succeed. ADR-008/DR-01 (THREAT_MODEL:160) case-return branch has the same binding. → defined, consistent.
  - **Same-nonce replacements (F4):** same `to` and value → duty 2 payout branch plus the duty 4 exemption. → defined.
  - **§5.6:415 internal moves:** the `to` must be on Treasury's list (duty 2 :11, duty 6 :17). Sweep collection → hot: `to` = hot, which is on the list. → defined.
  - **Cancels (§5.4, §5.5 RET_SIGNED, §5.6:418):** "zero-value self-send to the same wallet" must have its `to` on Treasury's list. That holds for hot and gas. **It fails for a `collection` sender** (CONTRACT:40 walletRole `collection`; §5.6 "sweep"). Collection addresses are **not** on Treasury's list: THREAT_MODEL DR-04 :163 "Hot and gas wallets are checked against Treasury's list (DR-24) instead"; DR-24 :182 mutant "A collection address is flagged bank-owned … → not on Treasury's list → … PAUSE"; ADR-008:40 "S … Treasury's bank-owned list ∪ the collection addresses in `listIssuedAddresses`". → **FAIL (D1)**
  - The R9 D4 case-return failure is fixed: PASS. A new failure in the same re-trace is D1.
- **MC-45 owner-cell backward trace and residuals:**
  - THREAT_MODEL residual 4 (:195) "nor does the destination allow-list … read by U7 from the CBS" agrees with ADR-001:10 "a policy check owned by merchant onboarding … not a signer duty".
  - T-E2 (:112) "destination allow-list" is satisfied by the signer's copy of Treasury's list for moves and cancels (C-6, DISMISSED).
  - T-E5 (:115) "allow-listed `to`, empty `data`, chain ID 5042002", no Memo, refusal list: agrees with duty 2 and duty 3.
  - T-T1 (:77) replay rule: agrees with duty 4.
  - RISK_REGISTER 3a/3b/RB-7: agree.
  - **Residual 4 and RB-7 use "the signer's per-transaction and daily limits" as the only damage bound for a compromised adapter. ADR-001 duty 3 and duty 6 never say where the signer's caps come from or who owns them.** → **FAIL (D2)**
- **MC-45 vendor qualification, duty by duty:**
  - 1 → (a); 2 → (b); 3 → (g) caps **and** pin; 4 → (e); 5 → (d); 6 → (f); signing log → (c); nonce writer → Q-D7.
  - ADR-001:68 "(a)–(g) cover the six duties" holds: 7 letters ↔ 6 duties plus the signing log.
  - → PASS. The D1 defect is inherited by (b) and (f) ("moves and cancels go to Treasury's list", OPEN_QUESTIONS:84), so the fix must also reach Q-D1.
- **MC-45 boundary values:**
  - Threshold T: X=T−1 → no checker; X=T → no checker ("at or below"); X=T+1 → checker ("strictly above").
  - Per-move cap C: X=C → allowed; X=C+1 → refused ("above the per-move cap is refused").
  - A zero-value cancel: 0 ≤ T and 0 ≤ C.
  - Every integer falls in exactly one branch; Q-D1 (f) "checker strictly above the threshold" uses the same predicate.
  - Duty 3's payout caps state no boundary; "cap" is read as an inclusive maximum, the same predicate as duty 6 (C-7, DISMISSED).
  - → PASS
- **MC-45 ADR-to-ADR (ADR-008):**
  - signing-log tuple and push (ADR-001:18 ↔ ADR-008:24): agree;
  - attestation protocol (ADR-001:16/:62 ↔ ADR-008:95–96): agree;
  - Rmove `to` on Treasury's list and move caps (ADR-008:39 ↔ duty 6): agree;
  - pilot block on Q-D1 (c),(d) (ADR-008:110/:120) ⊂ ADR-001 "(a)–(g)": agree;
  - ADR-003:8 nonce writer ↔ ADR-001:19 ↔ Q-D7: agree.
  - → PASS
- **MC-45 Q-D mirror:** each Q-D row's ADR column (OPEN_QUESTIONS:84–91) is mentioned in that ADR: D1→001, 008; D2→001; D3→001, 006; D4→003; D5→004; D6→005; D7→001, 003. ADR-001:58 declares the OPEN_QUESTIONS row authoritative and maps every letter to a duty (a–h compared above). → PASS
- **MC-44 (ADR-001's cited IDs, resolved by grep):**
  - IDs checked: C-56, CF-1, CF-5(f), CF-5(g), DR-01, DR-04, DR-12, DR-13, DR-24, MC-17, MC-24, Q-D1(c/d/f/g), Q-D2, Q-D3, Q-D7, Q-P1, Q-R4, Q-T2, RB-7, RR-3, T-E2, T-E3, T-E5, T-T1.
  - 0 unresolved. "G-M 5" = KICKOFF §9 item 5 "Key ceremony completed, signing policy approved, and a key-compromise drill run". It matches its use at :54 and :40.
  - Content check: ADR-001:17 claims "A cancel is a zero-value self-send to the same wallet, **so it meets these conditions**". This is false for collection-role senders (D1).
  - → FAIL (D1); otherwise PASS
- **MC-21 re-fetch (2026-10-05 08:36–08:40 UTC, HTTP 200 each):** custody, connect-to-arc, node-requirements, rpc-endpoints, deposits, transaction-memos, gas-and-fees, compliance-vendors, withdrawals, contract-addresses and llms.txt are all **byte-identical** to docs/sources/arc/. The SHA-256 prefixes equal the MANIFEST rows (for example custody d70b6bea… = MANIFEST:32; node-requirements 7650b09a… = :23; transaction-memos 4101c3eb… = :17). → PASS
- **MC-21 quotes re-derived from the live pages:**
  - "No Arc-specific MPC protocol modifications are needed" (custody);
  - chain ID 5042002 (connect-to-arc:431/:452);
  - "Minimum base fee (testnet) | 20 Gwei" (gas-and-fees:38);
  - "approximately 21,000 gas units" (withdrawals:100);
  - Memo `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` (contract-addresses:281/:288);
  - "invoked directly by an externally owned account" (transaction-memos:85);
  - "unique address per user" (deposits:43);
  - from node-requirements: "64 GB+", "1 TB+ NVMe SSD (TLC recommended)", "Stable 24 Mbps+" (:31–33); "v0.8.0" (:74); "syncing from genesis is not supported" (:49); "Fetches and verifies blocks" (:66); "IPC mode (default): … no authentication required" (:102–103); testnet relays rpc/drpc/blockdaemon (:84; QuickNode only on mainnet :83);
  - QuickNode testnet (rpc-endpoints:54);
  - compliance-vendors "analytics, wallet screening, and monitoring tools" (:18);
  - viem (withdrawals:34);
  - Reth (llms.txt:25).
  - → PASS
- **MC-43:** ADR-004 is unchanged since R9 (43554bbf…). R9's ¶2.1.9 disposition carries over: the archive hash equals MANIFEST:42/:43. → [inspection-only] PASS (extracted text)
- **MC-03 arithmetic (exact Python integers):**
  - ADR-006:13: 21,000 × 20·10⁹ = 420,000,000,000,000 wei. divmod(·, 10¹²) = (420, 0), that is 420 USDC base units = 0.000420 USDC. → matches.
  - At p=6 (k=10¹²), w → (m, r):
    - 0 → (0, 0); 1 → (0, 1); k−1 → (0, 999,999,999,999); k → (1, 0);
    - 10¹⁸ → (1,000,000, 0);
    - 1,000,000,500,000,000,000 → (1,000,000, 500,000,000,000);
    - odd dust 123,456,789,012,345,678,901 → (123,456,789, 12,345,678,901);
    - (2⁶³−1)·k + k−1 → (9,223,372,036,854,775,807, 999,999,999,999).
  - At p=2 (k=10¹⁶): 10¹⁸ → (100, 0); odd dust → (12,345, 6,789,012,345,678,901).
  - Each value equals R9's independent run.
  - → PASS
- **Count and topics:** 7 target files, one-to-one with KICKOFF:106–112. → PASS
- **Do not decide:** "Status: PROPOSED. A human decides at G1." appears once in each of the 7 files (count = 1 ×7). → PASS
- **Options and phases (script):**
  - option counts 3, 3, 3, 3, 3, 4, 4;
  - phase rows: 3 each for ADR-001…006; ADR-007:29 "the same in all phases" with a reason (ADR rule);
  - ADR-001 prose (:48) and phase table (:54) both condition B on "Q-D1 (a)–(g)".
  - → PASS. Trade-off substance: [inspection-only] PASS
- **MC-45 fail-closed per dependency:** screening ADR-005:25–27; travel rule ADR-004:29; nodes ADR-002 rules 1 and 6; monitor ADR-001 duty 5; signer refusal → CONTRACT RET_SIGNED PAUSE, §5.6 ABANDONED. D1's refused cancel ends in CANCELLING "no receipt … by `A_stuck`" → PAUSE (fail-closed). → [inspection-only] PASS
- **CLAUDE.md N1/N2 scans (script; the mainnet ID was assembled at run time):**
  - testnet ID: 3 hits, all in ADR-001 (:6, :14, :65);
  - mainnet ID: 0;
  - `mainnet.arc.io` hostnames: 0;
  - 64-hex strings: 0.
  - gitleaks is not on PATH.
  - → [inspection-only] PASS
- **N4 / JL-2:** no ADR picks a threshold, cap or score value. **JL-2 exception: the owner of the signer's caps is unnamed (D2).**
- **KICKOFF §6/§9:** FIPS 140-3 L3 (ADR-001:28/:48), segmented VM with no inbound internet (:31), Proxmox (ADR-002:25), PIA (ADR-004/005), G-M 2/5/8 named. → [inspection-only] PASS
- **JL-1, JL-3, JL-5, JL-6:** ADR-003 C adds no cluster; random memo (ADR-006:32); own-node-only address reads (ADR-002 rule 2). → [inspection-only] PASS
- **Regression check:** LEDGER has 0 frozen units (12 unit rows, none frozen). I used substitutes farthest from the ADR-001 edit, not used in R8 (004/007) or R9 (005/003):
  - **(1) ADR-002** (byte-identical since R9):
    - all six quotes re-fetched and found (above);
    - C-68 (constants:76) matches the testnet relay list and "QuickNode is a relay on mainnet" (:40);
    - rule 2 matches THREAT_MODEL L-3 (:147);
    - rule 3's reach "adapter and independent-monitor segments" matches ADR-008:21 (monitor's own fetch from own nodes);
    - Q-A9, Q-A11, Q-A12, Q-T6 exist in OPEN_QUESTIONS.
    - → PASS
  - **(2) ADR-006** (byte-identical since R9):
    - the 420·10¹² wei arithmetic is recomputed (above);
    - the Memo address and the EOA quote are re-fetched;
    - "unique address per user" re-fetched;
    - C-35, C-62, C-64 resolve;
    - the random-memo rule matches THREAT_MODEL L-4 (:148);
    - recommendation A matches DR-04's collection-address model.
    - → PASS
  - Note: ADR-006:34–36 makes the sweep policy a U11 decision, and ADR-006:42 needs it decided for the pilot. That is exactly where D1 becomes live.

CANDIDATES (Lens A, run for completeness):
- **C-1 · Same-nonce cancels of collection-wallet sweeps are refused by the signer**
  - Evidence:
    - ADR-001:11 "**internal move or same-nonce cancel:** `to` must be on the signer's own copy of Treasury's list (item 6)".
    - ADR-001:17 "A cancel is a zero-value self-send to the same wallet, so it meets these conditions".
    - CONTRACT:40 "`walletRole`: `hot`, `gas` or `collection`"; CONTRACT §5.6 heading "Internal move (gas top-up, sweep)"; CONTRACT:418 "SIGNED | every source rejects with `"Blocked address"` | … sign a same-nonce zero-value self-send cancel | CANCELLING".
    - THREAT_MODEL:163 "Hot and gas wallets are checked against Treasury's list (DR-24) instead" (that is, collection addresses are not on it); THREAT_MODEL:182 mutant "A collection address is flagged bank-owned … → not on Treasury's list"; ADR-008:40 S = Treasury's list ∪ `listIssuedAddresses`.
  - Criteria: MC-45 (signer rules vs every CONTRACT signature row; ADR↔THREAT_MODEL agreement), MC-44 (":17 so it meets these conditions" is false), MC-11 (CONTRACT has no "signer refuses the cancel" outcome in §5.6 SIGNED/CANCELLING).
  - Verdict: **REAL**.
  - Reason: take a sweep from collection address A to the hot wallet that every source rejects with "Blocked address" (the hot wallet blocklisted, or a policy-level block).
    - The cancel is `to = A`. A is not on Treasury's list, so duty 2 and duty 6 refuse it.
    - CONTRACT has no row for that refusal. The item sits in CANCELLING until `A_stuck`, then PAUSE. This fails closed, but it is a false PAUSE from a legitimate path.
    - The rule existed before fix block 6 (R9 C-5 quoted it), so R9 missed it.
    - Fix in ADR-001 (duty 2 cancel branch and duty 6): a cancel's `to` must equal its sender, and the sender must be on Treasury's list **or** be a collection address derivable at its recorded index (DR-04 xpub). Mirror this in Q-D1 (b) and (f).
    - **Routing:** THREAT_MODEL DR-01 "Move: `to` is on Treasury's list" would also PAUSE such a cancel. Extend CF-18 to collection-wallet self-send cancels.
- **C-2 · The signer's caps have no stated source or owner**
  - Evidence:
    - ADR-001:14 "3. **Limits:** per-tx and daily caps"; ADR-001:17 "every move counts against a **per-move cap** and a **daily move cap**".
    - ADR-001:9 states a source rule for destinations only: "The signer never takes a destination list from the orchestrator".
    - THREAT_MODEL:195 residual 4: "Until then a compromised adapter could forge an approval. **The signer's per-transaction and daily limits cap the damage.**"
    - RISK_REGISTER:85 RB-7: "The signer's per-transaction and daily limits cap the damage per transaction and per day".
    - THREAT_MODEL:44 names Treasury as publisher of the **move** caps, but only as a monitor input. No document names who sets the payout caps (grep for "per-tx", "daily cap", "daily limit" across THREAT_MODEL, RISK_REGISTER, CONTRACT, OPEN_QUESTIONS and ADR-008 finds no owner).
  - Criteria: MC-45 (ADR agrees with THREAT_MODEL and RISK_REGISTER on the controls it owns; T-E2 :112 names ADR-001 for "limits"), JL-2 (limits are a human decision; the owner is unnamed), JL-1.
  - Verdict: **REAL**.
  - Reason:
    - The damage bound in residual 4 and RB-7 holds only if a compromised adapter can't raise the caps.
    - ADR-001 gives the destination list an explicit out-of-adapter source (Treasury, the signer's own copy) but says nothing for the caps. Read by contrast, the caps could be configured through the orchestrator.
    - Fix: duty 3 and duty 6 state that the signer holds its own copy of the caps, set by a named human owner (for example Treasury/Risk) through a channel outside the adapter, never taken from the orchestrator. Q-D1 (g) and (f) say "inside its own boundary", which covers option B only if the configuration is also outside the adapter.
- **C-3 · The recommendation prose glosses (g) without the chain-ID pin**
  - Evidence: ADR-001:48 "… the internal-move rule, and per-transaction/daily caps".
  - Criteria: ADR rule (prose agrees with the table), MC-45.
  - Verdict: DISMISSED.
  - Reason: the binding condition in both the prose and the table (:54) is the letter range "Q-D1 (a)–(g) are all answered yes". (g)'s text (:65) and its authoritative row (OPEN_QUESTIONS:84) include the pin, and :58 declares the OPEN_QUESTIONS row authoritative. A custodian lacking the pin fails (g), so the qualification outcome is unchanged. Advisory: add "and the chain-ID pin" to the :48 gloss.
- **C-4 · Duty 5 doesn't state the direct channel**
  - Evidence: ADR-001:16 states verification against the monitor's key, PAUSE override and sequence rule, but no channel. Q-D1 (d) :62 and ADR-008:95 require "a direct channel".
  - Criteria: MC-45 (ADR-to-ADR).
  - Verdict: DISMISSED.
  - Reason: duty 5 cites ADR-008, whose :95 defines the channel as a monitor-to-signer push. The signer-side check that matters for authenticity, the monitor's key in the signer's own trust store, is stated. An adapter relay could only delay a PAUSE, and that is bounded by `A_attest`. The vendor question (d) asks for the channel, so B is qualified on it. No contradiction.
- **C-5 · The options table has no explicit replay-rule (e) row for option B**
  - Evidence: ADR-001:32–35 cite Q-D1 generically, then (c), (d), (f), (g).
  - Criterion: MC-45 internal agreement.
  - Verdict: DISMISSED.
  - Reason: row :32 "Approval check (T-T1)" covers replay, because T-T1 (THREAT_MODEL:77) includes the replay rule. That row's B cell cites "Q-D1" as a whole. Omitting a letter is not a contradiction, and the recommendation conditions on (a)–(g).
- **C-6 · T-E2 lists a "destination allow-list" as signer policy, but ADR-001 removed the per-merchant signer list**
  - Evidence: THREAT_MODEL:112 "Signer policy: approval verification (Q-C10), limits, destination allow-list, chain ID 5042002 only …"; ADR-001:10 "It is not a signer duty".
  - Criterion: MC-45 backward trace.
  - Verdict: DISMISSED.
  - Reason: the signer does hold a destination allow-list (its own copy of Treasury's list, for moves and cancels), and residual 4 (:195) explicitly places the per-merchant list in U7. The wording is satisfiable. Optional THREAT_MODEL wording tidy-up.
- **C-7 · Duty 3 states no boundary for the payout caps**
  - Evidence: ADR-001:14 "per-tx and daily caps".
  - Criterion: MC-45 boundary clause.
  - Verdict: DISMISSED.
  - Reason: a cap is an inclusive maximum (X = cap allowed, cap+1 refused). This is the same predicate duty 6 spells out ("above the per-move cap is refused"), and neither reading makes any amount fail open.
- **C-8 · The daily cap may count a same-nonce replacement twice**
  - Evidence: ADR-001:14 and :15.
  - Criterion: JL-1.
  - Verdict: DISMISSED.
  - Reason: double-counting can only refuse earlier (fail-closed), and at most one of the same-nonce pair can land.

Probe G (would the rubric wave through a bad version of this artifact?): YES.
- **(1)** MC-45 "An ADR's signer rules are checked against every CONTRACT row that requests a signature" can be satisfied **per row**, and C-1 hides inside one row (§5.6 cancel) whose outcome depends on the **sending wallet role**. R9 and fix block 6 both passed the cancel rule.
  - Proposed: "each signature row is re-traced **once per sending `walletRole`** (CONTRACT §1.2), and any list membership the signer checks is resolved against the list's defining document."
- **(2)** MC-40(b) keeps a detection's reference inputs and scope out of the compromised component's reach. No item applies that test to a **preventive control's configuration**, even when a residual uses it as its only damage bound (C-2).
  - Proposed for MC-45: "every preventive control that a G1 residual relies on as its bound names its configuration source and human owner, outside the threat's compromise domain."

Probe F (would the rubric fail a good version?): YES, if R9's Probe G(2) proposal ("an ADR's restatement of a Q-row is set-equal to OPEN_QUESTIONS") were applied literally.
- ADR-001:58–65 summarises Q-D1 by reference ("(b) … (item 2)", "(f) … (item 6)") and declares the OPEN_QUESTIONS row authoritative. That is a good design: one source of truth, no duplicated text to drift.
- A literal set-equality test would fail it, because (b) and (f) don't repeat the clauses that items 2 and 6 contain.
- Suggested reading: "a restatement that names the authoritative row, and maps each letter to a duty containing every clause of that letter, satisfies the mirror."
- On this artifact, the reading changes nothing: all eight letters map to clause-complete duties.

DEFECTS:
- **D1** · docs/adr/ADR-001-custody-signing.md:11 (duty 2, cancel branch) and :17 (duty 6, "so it meets these conditions"), mirrored in OPEN_QUESTIONS:84 Q-D1 (b)/(f).
  - The same-nonce zero-value self-send cancel of a sweep from a `collection` wallet (CONTRACT:40, §5.6:418) has `to` = a collection address. Collection addresses are not on Treasury's list (THREAT_MODEL:163, :182; ADR-008:40), so the signer refuses the cancel. CONTRACT has no outcome for that refusal, and the item reaches PAUSE only via `A_stuck`.
  - Lens and criteria: R / MC-45 (signer rules vs CONTRACT signature rows; ADR↔THREAT_MODEL), MC-44, MC-11.
  - Severity: minor (fails closed).
  - Routing: extend CF-18 to collection-wallet cancels in DR-01.
- **D2** · docs/adr/ADR-001-custody-signing.md:14 (duty 3) and :17 (duty 6).
  - The signer's per-transaction, daily, per-move and daily-move caps have no stated configuration source or human owner outside the adapter's compromise domain. THREAT_MODEL residual 4 (:195) and RISK_REGISTER RB-7 (:85) rely on them as the only damage bound for a compromised adapter, and T-E2 (:112) assigns "limits" to ADR-001.
  - Lens and criteria: R / MC-45 (controls it owns agree with THREAT_MODEL/RISK_REGISTER), JL-2.
  - Severity: minor.

Severity rationale:
- No money moves before Phase 3.
- D1 fails closed: a false PAUSE on a legitimate sweep-cancel path.
- D2 is a missing statement, not a contradicting one. Its risk is that an implementation lets the orchestrator configure caps, which would void the residual-4 bound. The bound is already a G1 residual for a human to accept.
- Both defects sit in ADR-001 duties 3, 2 and 6 (and Q-D1 (b), (f), (g)), so one atomic fix block on one unit can fix both. That block must also touch the OPEN_QUESTIONS Q-D1 row, since it is the authoritative wording.

Status of R9 defects, confirmed by reconstruction:
- D1: fixed;
- D2: fixed (letter and table);
- D3: fixed;
- D4: fixed for case returns (the exit can now succeed).
The new D1 is a pre-existing gap in the cancel rule that R9 did not detect.

VERDICT: NEGATIVE (2 defects: 0 blocking, 2 minor)

Phase 1 · units frozen 0/12 (LEDGER has 12 unit rows; R9's footer said /10, which doesn't match the ledger) · streak 0/3 · rounds used 10/10 (P1-adrs; next is grace) · regen budget left 1
