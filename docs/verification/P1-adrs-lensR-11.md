VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 11 (grace round 1 of 2), after fix block 7 · commit: none (uncommitted working tree; the repo has no commits)

Run window: 2026-10-05 08:50 UTC to 09:47 UTC. The guard hook was not loaded, so the verifier followed its rules by hand:
- one read-only HTTPS fetch of a docs.arc.io page (custody.md);
- no RPC call of any kind and no mainnet endpoint;
- no signing or sending method;
- no .env file or key material read.

ADR SHA-256 prefixes, the same at the start (08:50 UTC) and the end (09:46 UTC):
- 001 328b22779bb220be (**changed vs R10** fb7ea1a3eeb1d781; fix block 7)
- 002 f56d8a71d580dbb6, 003 9f73f03bebac8f5e, 004 43554bbf083caec3, 005 08cdf2fb0dc482fa, 006 9a91b242428b25cc, 007 05c75efbf80b87d2. All are byte-identical to R10.
- ADR-008 e268da84dd5370ca, the same as R10.

Sibling versions (MC-40 label clause, version pinning). **Four siblings changed during this run**, because other units' fix blocks were running at the same time:

| Document | At start (08:50 UTC) | At end (09:46 UTC) | Effect on this run |
|---|---|---|---|
| OPEN_QUESTIONS | 90fda9f7 | 525b8030 (09:26 UTC) | The Q-D1 row is unchanged; it moved from line 84 to line 85. Q-D3 now asks for a hardened-branch xpub (CF-21) |
| THREAT_MODEL | 36256acea1726124 | 6da9415a (09:34 UTC, threat-model Fix 6) | Line numbers shift by +1 from row T-I2 onward. **The citations below are to the end version** |
| RUBRIC | 099157bf | bc53ce25 (09:44 UTC, fix block 9) | The MC-45 and ADR rules applied below are unchanged |
| LEDGER | 0f35c02e | 0b322828 | It added CF-21 |

Unchanged siblings: CONTRACT 6e0c6cdd66eb17b6, RISK_REGISTER 10a99078e3df4ec4, constants e494e7724fa544fb.

Criteria applied:
- RUBRIC MC-03, MC-11 (resolution exits), MC-21, MC-43, MC-44, MC-45, the ADR rules, and JL-1 to JL-6;
- CLAUDE.md, and KICKOFF §1, §5 P1.4, §6 and §9.

Issues already routed as open CF items are not counted:
- CF-9(b);
- CF-15 (CONTRACT §5.6:414 says "below the threshold");
- CF-18, extended to collection-wallet cancels;
- CF-19;
- CF-20 (Goldsky in ADR-002, still open: fix block 7 didn't take it);
- **CF-21** (new mid-run, from threat-model R9 D5): ADR-001:73 restates Q-D3 without the xpub-export clause, and ADR-006:12 / ADR-001:12 point to the plain `m/44'/60'/0'/0/x` path rather than the hardened collection branch in THREAT_MODEL T-I2:97. **LEDGER routes both, so they are not ADR defects in this round** (MC-40 "routed as an open CF item").

CHECKS:
- **R10 D1 (cancels from collection wallets).** The cancel rule is now at ADR-001:12: "**same-nonce cancel** (of a payout, case return or move): zero value, and `to` **equals the sending wallet**. The sender is on Treasury's list, or is a collection address the signer derives itself". I re-traced it **once per sending `walletRole`** (CONTRACT:40), using R10's Probe G(1) method:
  - **hot** (§5.4:339 payout cancel; §5.5:397 return cancel; §5.6:417 cancel of a hot→gas top-up; SEQUENCES:162): `to` = hot, which is on Treasury's list → signs;
  - **gas**: the same → signs;
  - **collection** (a §5.6 sweep collection→hot, then :417): `to` = the collection address, which the signer derives itself → signs. **This was R10's failing case.**
  - This agrees with CONTRACT:339 ("shape-allowed: empty data, `to` = own wallet").
  - It agrees with the authoritative OPEN_QUESTIONS:85 Q-D1 (b): "a same-nonce cancel is a zero-value self-send whose sender is on Treasury's list or is a collection address the signer derives itself". The sets are equal.
  - The monitor-side classification is routed as CF-18 (extended).
  - → PASS. The wording tension in duty 6 is C-3, DISMISSED.
- **R10 D2 (who owns the signer's caps).** ADR-001:15: "The signer holds **its own copy** of every cap (here and in item 6), set by a named human owner (**Treasury, with Risk**) under the signer's change control. Caps are **never taken from the orchestrator**: residual 4 and RB-7 rely on them".
  - THREAT_MODEL:44 says Treasury publishes the move caps, so it agrees.
  - The backward trace reaches residual 4 (THREAT_MODEL:196) and RB-7 (RISK_REGISTER:85). Both still say "per-transaction and daily limits cap the damage", and now have a named owner and a source outside the adapter.
  - JL-2 is satisfied for the **value** caps → PASS for the payout caps.
  - **Partial:** the **vendor-qualification** clause covers the source rule only for item 3's caps, not item 6's move caps (D2 below).
- **MC-45: do the signer's limits bound the damage (boundary re-trace with exact integers).** Residual 4 and RB-7 need "the signer's per-transaction and daily limits cap the damage". I re-traced the total debit of every signature class the signer accepts. **This check fails (D1).**
  - Debit of an EIP-1559 type-2 send = value + gasUsed × effective gas price, where the effective gas price is min(maxFeePerGas, baseFee + maxPriorityFeePerGas). This is standard EVM semantics (no citation needed, per MC-41).
  - Arc documents the tip: "Set `maxPriorityFeePerGas` (the EIP-1559 tip) to incentivize sequencer inclusion" (archived gas-and-fees.md:80). Arc caps the **base** fee only: "Maximum base fee | 20,000 Gwei | Hard ceiling that bounds worst-case cost" (gas-and-fees.md:39, C-31). Base fee and tips go to the block beneficiary (C-34).
  - ADR-001 duties 2, 3 and 6 constrain `to`, `value`, `data`, the chain ID and the value caps. **No duty bounds `maxFeePerGas`, `maxPriorityFeePerGas` or `gasLimit`**, and ADR-001:18 adds that cancels "count against no cap". A grep for maxFeePerGas, fee cap, ceiling and tip across ADR-001…008, THREAT_MODEL, RISK_REGISTER, CONTRACT, OPEN_QUESTIONS and LEDGER finds no signer-side fee bound and no fee-anomaly detection.
  - Worked case (Python integers), a hot wallet holding B = 1,000 USDC = 10²¹ wei. A compromised adapter requests a "cancel": value 0, `to` = hot, gas 21,000, maxFeePerGas = maxPriorityFeePerGas = ⌊B/21,000⌋ = 47,619,047,619,047,619 wei.
    - Every duty passes: shape, `to` = sender on Treasury's list, zero value, no cap, and no checker needed (zero is at or below the threshold).
    - The upfront check is 21,000 × 47,619,047,619,047,619 = 999,999,999,999,999,999,000 ≤ B.
    - The charge is the same at any base fee from 20 gwei to 20,000 gwei, because the effective price equals maxFeePerGas. So **999.999999999999999 USDC leaves the hot wallet against 0 counted against any cap.**
    - No forged approval is needed.
    - The same holds for a payout at value = cap with an unbounded tip (debit = cap + fee > cap).
  - Boundary: a value cap C admits X = C and refuses X = C + k (CONTRACT amounts are multiples of k). The **total** debit stays unbounded at every X.
  - → **FAIL (D1)**
- **MC-45 vendor qualification, clause by clause:**

  | Duty | Q-D1 letter (OPEN_QUESTIONS:85) | Result |
  |---|---|---|
  | 1 | (a) | equal |
  | 2, incl. the new collection cancel | (b) | equal |
  | 3, value caps and chain-ID pin, plus own copy, owner Treasury with Risk, never from the orchestrator | (g) "per-transaction and daily caps … from its own copy of the caps set by … (Treasury with Risk), never from the orchestrator" | equal **for item 3's caps** |
  | 3's clause "(here **and in item 6**)", the per-move and daily move caps | (f) asks for "per-move and daily caps" **with no source clause**. (g)'s "the caps" refers back to "per-transaction and daily caps" | **not covered (D2)** |
  | 4 | (e) | equal |
  | 5 | (d) | equal |
  | 6 | (f) | equal except the source clause above |
  | signing log | (c) | equal |
  | nonce writer | Q-D7 | covered |
  | none (not a duty) | (h) | — |

  ADR-001's own summary at :59 explicitly defers to the OPEN_QUESTIONS wording, so the ADR side passes the restatement rule. The gap is in the authoritative row that ADR-001 owns through Q-D1 → **FAIL (D2)**. Separately, **no Q-D1 letter asks about a fee bound** (part of D1).
- **MC-45: boundaries of the value threshold and caps:**
  - threshold T: X = T−k → no checker; X = T → no checker ("at or below", :18); X = T+k → checker ("strictly above"). Q-D1 (f) uses the same predicate.
  - move cap C: X = C → allowed; C+k → refused ("above the per-move cap is refused").
  - A zero-value cancel: no cap, no checker.
  - Every multiple of k falls into exactly one branch → PASS (value only; fees are D1).
- **MC-45 ADR-to-ADR (ADR-008):**
  - the signing-log tuple and push (ADR-001:19 ↔ ADR-008:24): agree;
  - the attestation protocol (ADR-001:17 ↔ ADR-008:95–96): agree;
  - Rmove `to` on Treasury's list plus caps (ADR-008:39 ↔ duty 6): agree;
  - ADR-003 nonce writer ↔ ADR-001:20 ↔ Q-D7: agree.
  - A collection cancel is not a move under ADR-008:39, and its classification is routed (CF-18).
  - → PASS
- **MC-45 owner-cell backward trace:**
  - T-E2 (THREAT_MODEL:113): approval verification, limits, destination allow-list, chain ID, shape;
  - T-E5 (:116);
  - T-T1 (:77);
  - RR-3 3a/3b;
  - residual 4 (:196) agrees with ADR-001:10 that the per-merchant list sits in U7.
  - Limits: owner now named (PASS), but they don't bound fees (D1).
- **MC-45 Q-D mirror:** each Q-D row's ADR column is still mentioned in the named ADR: D1→001, 008; D2→001; D3→001, 006; D4→003; D5→004; D6→005; D7→001, 003. The Q-D3 restatement gap is CF-21, which is routed → PASS (excluding CF-21).
- **MC-44, IDs resolved by fixed-string grep:**
  - Checked: C-56, CF-1, CF-5(f)/(g), DR-01, DR-04, DR-12, DR-13, DR-24, MC-17, MC-24, Q-D1, Q-D2, Q-D3, Q-D7, Q-P1, Q-R4, Q-T2, RB-7, RR-3, T-E2, T-E3, T-E5, T-T1, "THREAT_MODEL residual 4" (:196), "item 6", and ADR-006.
  - 0 unresolved.
  - CF-5(g) = "approval replay rule … except for a same-nonce replacement or cancel of the same instruction", which matches duty 4 (:16).
  - → PASS
- **MC-21, using the shared method:**
  - `docs/verification/source-drift-2026-10-05.md` (08:37 UTC, under one day old): 0 integrity failures, 0 drifted URLs, 0 errors across 33 URLs. Every URL the ADRs cite is **identical**.
  - I recomputed the archive SHA-256 values myself for 11 files. Each has exactly one MANIFEST match: custody d70b6bea, node-requirements 7650b09a, compliance-vendors 0bde1b28, deposits f2528524, transaction-memos 4101c3eb, withdrawals 6afb2ad4, llms.txt b7146b0b, connect-to-arc e251cbda, gas-and-fees 93bf2194, contract-addresses 717d5226, rpc-endpoints 80324031.
  - Spot re-fetch of custody.md at 09:41 UTC: HTTP 200, d70b6bea…, identical.
  - These 18 quotes are present verbatim in the archives (whitespace and markup normalised):
    - "No Arc-specific MPC protocol modifications are needed";
    - the Memo EOA sentence;
    - "one unique address per user";
    - "analytics, wallet screening, and monitoring tools";
    - 5042002;
    - the Memo address 0x5294…e505;
    - "Minimum base fee (testnet) | 20 Gwei";
    - "Hard ceiling that bounds worst-case cost";
    - the `maxPriorityFeePerGas` tip sentence;
    - "syncing from genesis is not supported";
    - "64 GB+";
    - "1 TB+ NVMe SSD (TLC recommended)";
    - "Stable 24 Mbps+";
    - v0.8.0;
    - "approximately 21,000 gas units";
    - viem;
    - Reth;
    - rpc.quicknode.testnet.arc.io.
  - → PASS
- **MC-43 (ADR-004, byte-identical since R9), against Directive-9.extracted.txt:** "comes into operation on 30 April 2025", "may not execute a crypto asset transfer if it cannot comply", "prior to, or simultaneously with", "Post facto transmission", "unless there is a suspicion of money laundering or terrorist financing", "must verify the information pertaining to the originator" and "R5 000" were all found. ¶2.1.9 "a tran saction in a business relationship involving a crypto asset which is any value above zero" and ¶6.4 / ¶6.5.1 "cross -border" were found **with extraction artefacts** (the archived PDF hash matches MANIFEST per the drift report). → [inspection-only] PASS (extracted text)
- **MC-03 arithmetic (exact Python integers):**
  - ADR-006:13: 21,000 × 20·10⁹ = 420,000,000,000,000 wei; divmod(·, 10¹²) = (420, 0) → 0.00042 USDC. It matches.
  - At p = 6 (k = 10¹²):

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
  - Each value equals R10's.
  - → PASS
- **Count and topics:** 7 target files, one-to-one with KICKOFF:106–112 → PASS.
- **Do not decide:** "Status: PROPOSED. A human decides at G1." appears exactly once in each file (×7) → PASS.
- **Options and phases (script):**
  - option counts 3, 3, 3, 3, 3, 4, 4;
  - 3 phase rows each in ADR-001…006; ADR-007:29 "the same in all phases" with a reason;
  - ADR-001's prose (:49) and table (:55) both condition B on "Q-D1 (a)–(g)".
  - → PASS. Trade-off substance: [inspection-only] PASS.
- **MC-45 fail-closed per dependency:** screening (ADR-005), travel rule (ADR-004:29), nodes (ADR-002), monitor (duty 5), signer refusal (CONTRACT :337, :395, :415) → [inspection-only] PASS.
- **CLAUDE.md N1/N2 scans** (the mainnet ID was assembled at run time):
  - testnet ID: 3 hits, all in ADR-001;
  - mainnet ID: 0;
  - mainnet hostnames: 0;
  - 64-hex strings: 0;
  - gitleaks is not on PATH.
  - → [inspection-only] PASS
- **N4 / JL-2:** no ADR picks a threshold, cap or score. The cap owner is now named (Treasury, with Risk). **No owner or value exists for a fee ceiling** (part of D1).
- **JL-1:** the cancel path for collection wallets now has an exit that can succeed (PASS). The fee path doesn't fail closed: funds leave with no cap and no detection (D1).
- **JL-3, JL-5, JL-6, KICKOFF §6/§9:** unchanged since R10 → [inspection-only] PASS.
- **Counts vs LEDGER:** 12 unit rows, 0 frozen. **Note for LEDGER (not an ADR defect):** the P1-adrs Status column still reads "reframed, fix block 3 used", but its verdict column records Fix 7.
- **Regression check:** there are no frozen units, so I used the two ADRs farthest from the ADR-001 edit that weren't used in R9 or R10.
  - **(1) ADR-004** (byte-identical since R9): all Directive 9 quotes re-derived (above). Q-R3, Q-R9, Q-R10 and Q-D5 exist (OPEN_QUESTIONS:69–71, :89). SEQUENCES F6 (:386) and THREAT_MODEL DR-18 exist. G-M 2 is named in KICKOFF §9 (:211). The design rule "blocks signing until … `COMPLETE`" matches CONTRACT §5.4:326–327 → PASS.
  - **(2) ADR-007** (byte-identical since R8): viem (withdrawals) and Reth (llms.txt) found in the archives. C-10, C-57 and C-62…C-68 resolve in constants (:24, :75, :76, :85–:90) with the stated topics (Memo, Multicall3From, Privacy, Permit2, EIP-7702, EIP-3009). Q-C1 exists. KICKOFF:112 reads "match the CBS unless there is a reason not to; viem if TypeScript" → PASS.

CANDIDATES (Lens A, run for completeness):
- **C-1 · The signer bounds value but not fees; cancels count against no cap**
  - Evidence:
    - ADR-001:15 "3. **Limits:** per-tx and daily caps, and **chain ID pinned to 5042002** … residual 4 and RB-7 rely on them as the damage bound if the adapter is compromised";
    - ADR-001:18 "Cancels follow the cancel rule in item 2: zero value and `to` = the sender. They count against no cap.";
    - THREAT_MODEL:196 "The signer's **per-transaction and daily limits** cap the damage";
    - RISK_REGISTER:85 "The signer's per-transaction and daily limits cap the damage per transaction and per day";
    - archived gas-and-fees.md:80 "Set `maxPriorityFeePerGas` (the EIP-1559 tip)".
  - Criteria: MC-45 (agreement with THREAT_MODEL and RISK_REGISTER on the controls it owns; caps checked at the boundary), JL-1, JL-2.
  - Verdict: **REAL**.
  - Reason:
    - The worked case above debits about 1,000 USDC with 0 counted against any cap and no approval. The fee goes to the block beneficiary (C-34), so it is lost to the bank whether or not anyone gains from it.
    - Residual 4 and RB-7 tell the G1 human that the signer's limits bound the damage. For fee spend, that statement is false.
    - This **existed before** fix block 7 (no earlier ADR version had a fee bound), and all ten previous rounds missed it. Fix block 7's "They count against no cap" makes it explicit.
    - Fix in ADR-001 duty 3:
      - a signer-held, owner-set (Treasury with Risk) ceiling on `gasLimit × maxFeePerGas` per signature, plus a ceiling on `maxPriorityFeePerGas`. For example: `gasLimit` = 21,000 for empty-data sends, and `maxFeePerGas` ≤ C-31's 20,000 gwei plus a tip cap. That gives at most 0.42 USDC + tip per signature;
      - fees count against the daily cap, cancels and replacements included;
      - a matching clause in Q-D1 (g).
    - Optionally, require the cancel nonce to equal a nonce already in the signer's own signing log (see C-5).
- **C-2 · Q-D1 doesn't qualify the move caps' source**
  - Evidence:
    - ADR-001:15 "its own copy of every cap (here **and in item 6**)";
    - OPEN_QUESTIONS:85 (f) "(destination on its own copy of Treasury's list, per-move and daily caps, checker strictly above the threshold)";
    - (g) "enforce **per-transaction and daily caps** … from its own copy of the caps set by the bank's named owner (Treasury with Risk), never from the orchestrator".
  - Criterion: MC-45 ("Each question clause is compared clause by clause with the duty it cites: a clause that asks about only part of a duty covers only that part").
  - Verdict: **REAL**.
  - Reason:
    - ADR-001's own wording distinguishes item 3's caps from item 6's ("here and in item 6"). (g)'s "the caps" refers back to "per-transaction and daily caps", so it covers item 3 only, and (f) has no source clause.
    - A custodian whose move caps are set through an API the orchestrator's credentials can reach would answer yes to (f) and (g).
    - The impact is low: moves can only go to Treasury's list, and the monitor checks Rmove against Treasury's published caps (ADR-008:39). It is still the same class of gap as R9 D2 (the chain-ID pin not vendor-qualified).
    - Fix: (f) "per-move and daily move caps, from the same owned copy (g)", or make (g) say "every cap in (f) and (g)".
- **C-3 · Duty 6's opening clause conflicts with the cancel rule**
  - Evidence: ADR-001:18 "6. **Internal moves** (CONTRACT §5.6), **including same-nonce zero-value cancels:** every move needs a `to` on **the signer's own copy of Treasury's bank-owned wallet list** … Cancels follow the cancel rule in item 2".
  - Criteria: MC-44 (internal consistency), MC-45.
  - Verdict: DISMISSED.
  - Reason:
    - Read literally, "including … cancels: every move needs a `to` on Treasury's list" would refuse a collection-wallet cancel. But the same item then states the specific rule for cancels ("follow … item 2", "count against no cap"). Item 2 (:12) states the collection case and its purpose ("That way a sweep from a collection wallet can be cancelled"), and the authoritative Q-D1 (b) agrees.
    - The specific rule governs.
    - Advisory: reword the heading to "Internal moves (CONTRACT §5.6); their cancels follow item 2".
- **C-4 · "A collection address the signer derives itself" when the HSM can't do BIP-32 (Q-D3 = no)**
  - Evidence: ADR-001:12; OPEN_QUESTIONS Q-D3.
  - Criterion: MC-11 (a resolution exit that can succeed).
  - Verdict: DISMISSED.
  - Reason: the signer signs with the sender's own key, so it computes the sender's address from a key it holds, whether that key was derived or generated. The cancel still has an exit. Which branch or path applies is CF-21, which is routed.
- **C-5 · The signer doesn't check that a "same-nonce" cancel's nonce is one it already signed**
  - Evidence: ADR-001:12 names a "same-nonce cancel" but states no nonce check.
  - Criterion: JL-1.
  - Verdict: DISMISSED as a separate defect.
  - Reason: with zero value, its only effects are consuming a nonce (the adapter is the nonce writer under A anyway) and gas. The gas part is D1, and D1's fix covers it. The monitor sees the entry in the signing log (CF-18 classification).
- **C-6 · The recommendation prose (:49) glosses (g) without the pin or the cap owner**
  - Verdict: DISMISSED, as R10 C-3: the binding condition is the letter range "Q-D1 (a)–(g)", and :59 defers to the authoritative row.
- **C-7 · The cap owner is "Treasury, with Risk" in ADR-001 but "Treasury" in THREAT_MODEL:44**
  - Criterion: MC-45.
  - Verdict: DISMISSED.
  - Reason: Treasury owns the caps in both. Risk is an added co-approver, which doesn't contradict. Advisory: state that the signer's copy and the monitor's input are the same Treasury publication, so a divergence becomes a monitor PAUSE (fail closed).

Probe G (would the rubric wave through a bad version of this artifact?): YES.
- MC-23 and MC-45 test the signer's limits and caps on **value** only. MC-22 bounds the fee from **below** only.
- Ten rounds passed an ADR whose stated damage bound ignores fees (C-1).
- Proposed for MC-45 (or MC-23): "every signer cap bounds the **total debit** of a signature (value + gasLimit × maxFeePerGas, tip included). Every signature class exempt from a cap (cancels, replacements, zero-value sends) is re-traced for its **maximum** possible debit. A residual that cites a cap as its damage bound is checked against that maximum."

Probe F (would the rubric fail a good version?): YES, if MC-45's clause-by-clause rule were read to need each source or owner clause repeated in every letter.
- A Q row that states "every cap in (f) and (g) comes from its own owner-set copy, never from the orchestrator" **once** is a good design (one statement, nothing to drift).
- Suggested reading: "a shared clause stated once satisfies every letter its scope **names explicitly**." On this artifact the reading doesn't help: (g)'s "the caps" names only its own caps (C-2).

DEFECTS:
- **D1** · docs/adr/ADR-001-custody-signing.md:15 (duty 3) and :18 (duty 6, "They count against no cap"); mirrored by the missing fee clause in OPEN_QUESTIONS:85 Q-D1 (g).
  - Problem: the signer's limits bound value only. No duty bounds `gasLimit`, `maxFeePerGas` or `maxPriorityFeePerGas`, and cancels are exempt from every cap. A compromised adapter can debit an entire wallet as fees through a zero-value self-send, with no approval (worked case: 999.999999999999999 of 1,000 USDC).
  - This contradicts the damage bound that THREAT_MODEL residual 4 (:196) and RISK_REGISTER RB-7 (:85) attribute to the signer's limits.
  - Lens and criteria: R / MC-45 (controls it owns, boundary), JL-1, JL-2.
  - Severity: minor (Phase 1 design text; no money moves before Phase 3). **Fix it first.**
- **D2** · OPEN_QUESTIONS:85 Q-D1 (f)/(g), the authoritative row for ADR-001:59–66.
  - Problem: the source and owner rule for the **move** caps (ADR-001:15 "every cap (here and in item 6) … never taken from the orchestrator") isn't vendor-qualified. (g)'s source clause covers only "per-transaction and daily caps", and (f) has none.
  - Lens and criteria: R / MC-45 (vendor qualification clause by clause).
  - Severity: minor.

Severity rationale:
- Both defects are in the text, and no money moves before Phase 3.
- D1 is material: it is a loss path that bypasses the stated damage bound and every approval, and the G1 human would accept residual 4 on a false premise. It is still a localised omission in one duty and one Q-D1 letter, so it ranks with the R10 D2 precedent (the cap-owner gap that voided the same bound) as minor.
- D2 has low impact because moves stay inside the bank.
- Both fixes sit in ADR-001 duty 3 and the Q-D1 (f)/(g) row, so one atomic fix block on this unit can fix both.

Status of R10 defects, confirmed by reconstruction:
- D1 (collection-wallet cancels): **fixed**, re-traced per wallet role.
- D2 (cap owner): **fixed** for the value caps in ADR-001 and Q-D1 (g); not yet vendor-qualified for the move caps (new D2).

VERDICT: NEGATIVE (2 defects: 0 blocking, 2 minor)

Phase 1 · units frozen 0/12 · streak 0/3 · rounds used 10/10 + grace 1/2 (P1-adrs) · regen budget left: per LEDGER (not changed by this pass)
