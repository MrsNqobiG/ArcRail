VERIFICATION · lens: R · target: P1-sequences (docs/SEQUENCES.md, v2 fix block 1, the Phase-1 close-out round-1 fix block; sha256 d3f68f8b662f9ef05035a72e02fde2d4705c7e7992c9a717b874207f08d5ce05, mtime 2026-10-05 14:54, unchanged from pass start 15:19:45 to pass end 15:51:12 +02:00) · commit: none (no HEAD; `git log` → "your current branch 'main' does not have any commits yet"; uncommitted working tree)

Criteria: .claude/agents/verifier.md; docs/RUBRIC.md (62698867…, v2 fix block 12); docs/CONTRACT.md; docs/LEDGER.md (P1-sequences row, CF-2, CF-9, CF-26…CF-39, operator rows 2026-10-05); docs/THREAT_MODEL.md; docs/adr/ADR-001, ADR-008; docs/constants.md; docs/OPEN_QUESTIONS.md; KICKOFF_PROMPT.md §5 Phase 1 item 2. First Lens R verdict on SEQUENCES v2 (v1 reports `-lensR.md`, `-lensR-2.md` are superseded).

Severity rule in force (operator, LEDGER 2026-10-05): **blocking** = money can be lost, misposted, or moved without the required control, or a fail-closed path is missing; **minor** = everything else. A unit freezes on a pass with zero blocking defects, and its minors go to the G1 packet.

Pass constraints honoured (guard hook not loaded): Read/Grep/Bash only. One Arc **testnet** read-only RPC call (`eth_chainId` to https://rpc.testnet.arc.io). No mainnet endpoint, no signing or sending method, no `.env` or key read. No temp files: the Mermaid lint and the arithmetic ran in memory (python stdin), and `tools/source_drift.py` ran in memory with `Path.write_text` patched, so nothing was written. The only file written is this report.

## Sibling pins (MC-40 label clause)

| File | Hash at start (15:19:45) | Hash at end (15:51:12) | SEQUENCES header pin |
|---|---|---|---|
| CONTRACT.md | `d48f622c28d3fbd752fd43b44d1e057352b3722a92f9dccdec16ed08b24d7351` (v3 fix block I) | same | `d2f72422…a3e1d781` (fix block H), **differs** |
| THREAT_MODEL.md | `4971e7c4f25d13e1b015d16c46487b077d9c59b1e48ec2065ab39bdcc153a735` (v2 fix block 9) | same | `6799bd75…bdb4c982` (fix block 8), **differs** |
| ADR-001 | `ee09a22e8df23da3d70a7360d8c4671b577fa05481215064a6885bf3a15cd1e0` (fix block 11) | same | `ce0106ea…dedb124a` (fix block 10), **differs** |
| ADR-008 | `164d52772d7cae7cda175479b2e228695116ffee271a8d5643ace5a7a134a73e` (fix block 7) | same | `f81850e2…d0e565ea` (fix block 6), **differs** |
| constants.md | e494e772…a58ebed3 | same | `e494e772…a58ebed3`, **matches** |
| LEDGER.md | aaf57367… | **d8fe3330…** (changed during the pass) | — |
| RUBRIC.md, OPEN_QUESTIONS.md, RISK_REGISTER.md | 62698867…, 01528f20…, 48930790… | same | — |

LEDGER changed during the pass. Its only change is a new operator-decision row (line 14). The P1-sequences row (:39) and CF-26 to CF-39 are byte-identical to the start, so no check below depends on the change. The pinned versions of the four changed siblings are no longer on disk (no git history; `.tools/drafts` holds only a fix-G CONTRACT backup), so the header's "matches the pinned siblings" claim can't be re-checked against those versions. It was re-checked against the current versions instead (see D1).

## CHECKS

### Mechanical (by reconstruction)
- K1 **Mermaid structure** (13 blocks): I re-ran my own in-memory lint. Every `alt`/`opt`/`loop` closes with `end`, every `else` sits inside an `alt`, every arrow and `Note over` names a declared participant, no message or label contains `;`, `#` or `%%`, and no line failed to parse. Problems: 0 in all 13 → PASS. Rendering: [inspection-only], no renderer ran.
- K2 **MC-03/MC-04 unit arithmetic** (integer division, p=6 and p=2): w=0 → m=0; w=1 → m=0 with rem 1 (S1 `m = 0` → DUST_ONLY path); w=k−1 → m=0; w=k → m=1; 1,000,000,500,000,000,000 → 1,000,000 rem 500,000,000,000; S4 gas 7,374,356,000,000,000 → n=7,374, carry 356,000,000,000 (p=2: n=0, the whole amount carries); max w for a signed 64-bit m → 9,223,372,036,854,775,807 rem k−1. S2 `A×k` for A ∈ {1, 10⁶, 2⁶³−1} round-trips exactly. S3 `X/k` with X=5×10¹⁸ → 5,000,000, exact because X mod k = 0. S5: three dust items of 4×10¹¹ → n=1, carry 2×10¹¹. All equal CONTRACT §6.1 → PASS.
- K3 **MC-04 identities re-traced through the diagrams.** Each movement satisfies `Σchain = CBS_G2×k + D − F + Rin − Rout` step by step:
  - S1 detection, then T1, then T2/T8/`unid`;
  - S2 status 1, then T4;
  - S3 move, then T6 (Rmove per role);
  - S4 gas batch; S5 dust batch;
  - F3 status 0 and cancel-final;
  - F4 settle.

  Residual 0 at every step, and the CBS-side identity balances per template → PASS (but see D2 and D4 for literal-reading hazards).
- K4 **CONTRACT row trace** (every bracketed label in S1–S5, F1–F7, against CONTRACT fix I on disk). Every drawn message carries the action and next state of the row it cites, except D1, D3, D4 and D5 → PASS with minors.
- K5 **MC-13 release rule**: each T5 drawn was traced to a stated condition.
  - Condition 1 (never broadcast): S2 :188, :205, :209; F3 :477; F5 :619; F6 :668.
  - Condition 2 (final status 0): F3 :501, :508.
  - Condition 3 (nonce consumed by our cancel): F3 :497, F4 note :562.

  No release on "dropped", "not seen" or "timed out" (F3 :512, :523; F4 :575). APPROVED past 2×`A_sign` goes to QUARANTINE, not release → PASS.
- K6 **MC-12 ages**: the ages in S1 :157, S2 :235-242, S3 :298, S4 :326, S5 :351, F1 :412 and F7 :694 were diffed against CONTRACT §5.8 :505-533 (value, expiry action and state). All match → PASS.
- K7 **MC-10 keys**: every key name used (`K.recv`, `K.avail`, `K.unid`, `K.reserve`, `K.settle`, `K.release`, `K.move`, `K.gas`, `K.dust`, `K.scr`, `K.mon`, `K.appr`) exists in CONTRACT §1.3 :70-86. The F1 attempt rule (:393-409) matches §1.3 :90-109 step for step (REJECTED → a+1; APPLIED → no re-issue; NOT_FOUND → QUARANTINE with CONFIRM_APPLIED/CONFIRM_ABSENT and no further lookup) → PASS.
- K8 **MC-17 binding**: S2 :180-184 (placeHold echo → PAUSE on a difference) and :227-228 (settleHold carries `instructionId`/`txHash`; BINDING_MISMATCH → PAUSE) match CONTRACT §3 :202-204. S1 :124 has T2 with `refs.address`, and :146 has DR-29/DR-23/DR-28 with CF-5(f)(h)(i), Q-C19, RB-13 and THREAT_MODEL residual 6. I traced both: THREAT_MODEL :145 T-T7 → residual 6 and RISK_REGISTER :94 RB-13 → PASS.
- K9 **MC-21 Arc constants**: SEQUENCES has no inline quotes and cites constants by ID only.
  - `tools/source_drift.py`: sha256 5504b5e7…80e1, the version reviewed in rubric R13/R15. I re-read it in full: its only network call is `urlopen`, and its only write is `--out`. I ran it with no write: integrity failures 0, drifted URLs 0, fetch errors 0, 33 URLs checked.
  - Quotes checked against the archives the tool compared (all identical): C-40 "`-32012` when the requested block range exceeds" and "≤9,999-block chunks" (rpc-endpoints.md); C-24 "Zero-value transfers emit no log." and "Self-transfers (`from == to`) emit no log." (usdc-system-events.md); C-60 "targeting Arc (domain `26`)" (cctp-bridging.md); C-50 "irreversible transaction settlement" (deterministic-finality.md); C-30 "20 Gwei `maxFeePerGas` floor" (gas-and-fees.md); C-51 "more than two-thirds" (consensus-layer.md).
  - C-01 re-derived on chain: `eth_chainId` on https://rpc.testnet.arc.io → `0x4cef52` = 5042002.
  - C-41 and C-57 are empirical (not in docs). SEQUENCES cites them with Q-A4 and Q-A13 as required.

  → PASS.
- K10 **MC-44 references and closed lists**: every `createCase` reason used is in the CONTRACT §3 closed list. The only all-caps token missing from CONTRACT is `ALL_CLEAR`, which is ADR-008's own term. Every Q-id cited exists in OPEN_QUESTIONS (Q-A1, A2, A4, A7, A10, A13, C2, C3, C5, C8, C15, C16, C17, C19, R3, R8, R9, R10, D9). Every CF id cited exists in LEDGER. The CONTRACT-silent marks were re-checked against fix I: CF-9(a), CF-15, CF-26 to CF-35, CF-5(b)(d)(e) and Q-R9/CF-4(a) are all still silent there → PASS except D8.
- K11 **Framing rule, omitted-row lists**: each §5.3/§5.4 row was diffed against the "drawn or listed as omitted" claims. All are covered except the gaps in D1, D2 and D7 → PASS with minors.
- K12 **MC-47 movement classes**: customer, bank-owned, unidentified, mint and dust-only (S1), payout (S2), internal (S3) and case return (F5 summary :642) → PASS.
- K13 **MC-45 signer and monitor steps** against ADR-001 duties 1–6 :8-25 and ADR-008 :89-105.
  - P0 (attestation preconditions, direct channel, sequence and PAUSE precedence, own paging, single PAUSE authority, operator channel, signed RESUME) matches.
  - S2 :213 lists all six applicable duties.
  - S3 :273 and F4 :545 are partial (D6).

  → PASS with minors.
- K14 **KICKOFF §5 item 2 coverage**: the mapping table (:715-729) was checked against KICKOFF_PROMPT.md :98-103. Inbound, outbound, internal/top-up, fees and the seven failure paths are each drawn → PASS.
- K15 **Privacy (JL-6)**: no `0x…` address of 6 or more hex characters and no personal data appear in SEQUENCES. Wallets are named by role → PASS.
- K16 **Phase-2 (code) items** MC-01, 02, 05, 07, 08, 14–16, 18–20, 22–25 and 30–34: not applicable to a Phase 1 view document. MC-41 and MC-42/43/48: no detections, sign-offs, regulatory quotes or matrix rows in this unit → N/A.

### Judgment lenses
- JL-1 Fail-closed: [inspection-only] PASS. Every drawn uncertainty ends in PAUSE, QUARANTINE or a held state with a case: AMBIGUOUS→UNRESOLVED, disagreement, stall, drift cells, signer refusal, CANCEL_BLOCKED, `A_stuck`. The gaps are undisclosed omissions (D2, D3, D7), not paths that release or move money.
- JL-2 Human-owned decisions: [inspection-only] PASS. Dispositions come only from `CMP` (F5 :594, :612; F6 :661); "The adapter never chooses a disposition" (:637); unpause is two-person (P0 :85, F2 :444, F7 :703).
- JL-3 03:00 operability: [inspection-only] PASS. P0 makes the monitor the single place that shows PAUSE state and the adapter flag.
- JL-4 Auditability: [inspection-only] PASS. Every money message cites a CONTRACT row, and the monitor joins (DR-01, DR-29) are shown.
- JL-5 Fewest new parts: N/A (a view document).
- JL-6 Privacy: PASS (K15).

## DEFECTS
- **D1** · SEQUENCES.md:3-13 (pin table and "matches the pinned siblings"), :601, :635 · MC-40 label clause, MC-44, framing rule · **minor**.
  - Four of the five pinned hashes no longer match disk. CONTRACT says it is ahead of SEQUENCES (CONTRACT :11), and LEDGER routes the catch-up to this unit as **CF-39(d), still open**, so the lag itself is legitimate. But the diagrams still state fix-H behaviour that fix I replaced:
    - F5 :601 says no-mapping RELEASE → "HIT or REVIEW → stays". CONTRACT :317 says HIT → `createCase SCREENING_HIT` → HELD_IN_CLEARING, and REVIEW → AWAITING_SCREENING. Read literally, SEQUENCES makes an unattributed mint (always REVIEW) a loop: it is never awaited, so it never reaches SUSPENSE.
    - F5 :635 says the current case "stays current until the item leaves its held state family". CONTRACT :164 says it ends only at a newer case or a terminal state, and "Nothing else ends it".
    - CONTRACT :318 and :378 handle the current round's ScreeningOutcome when a held state isn't awaiting it. SEQUENCES neither draws those rows nor lists them as omitted.
  - **Why minor:** in each case funds stay in G5 under a Compliance-owned case, with the RETURN and HOLD exits intact. Nothing is credited, released or signed.
- **D2** · SEQUENCES.md:113, :718 · CONTRACT §5.0 :244-248, framing rule (omitted rows listed) · **minor**.
  - The S1 classification step reads "to is bank-controlled → inbound [§5.0 rule 3]". It drops rule 3's qualifier "(`from` is external or `0x0`)" and the rule order (rules 1 and 2 first).
  - The §5.0 **unmatched-outflow drift cell → PAUSE** (CONTRACT :246) is neither drawn nor listed as omitted, although the mapping row claims §5.0 for S1.
  - A literal reading classifies an S3 hot→gas move as inbound (S1 :133 then routes it T1 + T8 → G7), which is RISK_REGISTER 2c.
  - **Why minor:** the cited label resolves to the correct rule. Even a literal implementation is caught by the §5.7 residual (X ≠ 0 → PAUSE; THREAT_MODEL DR-06 mutant (2)) before any outflow depends on it.
- **D3** · SEQUENCES.md:26, :127-128, :134, :185-186 · CONTRACT §1.4 :124 ("BINDING_MISMATCH → PAUSE in every class") · **minor**.
  - The S1 T2 and T8 REJECTED branches route every REJECTED code to POSTING_REJECTED → HELD_IN_CLEARING. The S2 placeHold REJECTED branch routes every code to RELEASED. The conventions line :26 lists the global overrides but leaves out BINDING_MISMATCH. Only F1's note (:418) states it.
  - **Why minor:** the fail-closed rule is in the document. A REJECTED call has no effect, so nothing is posted or moved either way.
- **D4** · SEQUENCES.md:564-565 vs :562 · CONTRACT §5.4 :369, :372 · **minor**.
  - F4's final alt, "one of our hashes is final with status 1 → settle as in S2 (T4)", doesn't exclude the item's own zero-value cancel. The opt note just above sends that same case to T5 condition 3.
  - **Why minor:** the label "[§5.4 … BROADCAST status 1]" resolves the ambiguity. A literal T4 against an unpaid payout leaves a residual of A×k → PAUSE (§5.7), and is also a DR-29 settlement mismatch.
- **D5** · SEQUENCES.md:392, :29, :625 · framing rule ("never states behaviour that CONTRACT doesn't") · **minor**. Three statements differ from CONTRACT:
  - :392 "UNRESOLVED or CONFLICT → PAUSE (P0) in every class" contradicts §1.5 :141, where a Notification UNRESOLVED is re-queued like REJECTED and only `A_notify` → PAUSE.
  - :29 "The §1.7 in-flight gate applies to all of them" contradicts §1.7 :160, which says QUARANTINE/PAUSE triggers and `AccountStatusChanged` are never held. The F5 note :636 corrects it.
  - :625 gives a held `ScreeningOutcome CLEAR` on a terminal item `createCase LATE_DISPOSITION`, but §1.7 :162 opens LATE_DISPOSITION only for a `CaseDisposition`.

  All three are stricter or noisier than CONTRACT, never more permissive.
- **D6** · SEQUENCES.md:545, :273 · MC-45 (ADR-001 duties) · **minor**.
  - F4's replacement signing step lists only duties 4, 3 and 5. It leaves out duty 1 (re-verify the approval) and duty 2 (`to` and value equal the approval), which is the control that stops a "replacement" redirecting funds.
  - S3's move signing step leaves out duty 6's threshold check, the signer's own copy (strictly above → checker assertion, ADR-001 :25).
  - **Why minor:** ADR-001 makes every duty unconditional on every signature, and RUBRIC MC-25(d) tests both at the signer. The view is incomplete, but no control is removed.
- **D7** · SEQUENCES.md:159 vs :641; :246, :249; F3 :489-495; F4 :548 · framing rule (omitted rows listed), MC-11 view coverage · **minor**. Undisclosed or contradictory omissions:
  - S1 :159 says the late-outcome row is "drawn in F5", but F5 :641 lists it as omitted.
  - S2 :249 defers "PAUSED" to P0, but P0 draws only the rail unpause, not the item resolutions `SETTLED`/`RELEASED` with proof (CONTRACT :375).
  - S2 :246 says AWAITING_SCREENING is drawn in F5/F6, but F5's outbound branch doesn't draw the AWAITING_SCREENING `ScreeningOutcome CLEAR/HIT` rows (CONTRACT :345).
  - The cancel and replacement send-time results other than "accepted" and "Blocked address" (transient → resend, underpriced or other → PAUSE, mixed; CONTRACT :390) are neither drawn nor listed in F3 or F4. F4 :548 also omits the REF send.
  - The QUARANTINE triggers `AccountStatusChanged` (frozen or closed during an active instruction) and an unexplained `HoldChanged` (CONTRACT :155, :223) appear in no diagram and no omitted list.
- **D8** · SEQUENCES.md:680 · framing rule (CONTRACT-silent marks cite an open Q or LEDGER item), MC-44 · **minor**. The mark cites **CF-24**, which LEDGER :86 shows as CLOSED in ADR-004 (not CONTRACT). The co-cited Q-D9 is OPEN, so the mark still resolves. Cite Q-D9 alone, or say that CF-24 landed in ADR-004.

No blocking defect was found. In particular, I traced no path that releases without a T5 condition (K5), credits without screening and standing (S1, F5), signs without an approval and a fresh ALL_CLEAR (S2, P0), or lets AMBIGUOUS, RPC disagreement, stall or nonce drift through without PAUSE or QUARANTINE (F1, F2, F4, F7).

## Probe proposals for RUBRIC (queue, not defects of this unit)
- Probe G: a view document can abbreviate a cited rule (D2: rule 3's qualifier dropped) and still pass every row-label check. Proposal: for each bracketed citation, check that the drawn text **implies no outcome the cited row excludes**, not only that the label resolves.
- Probe F: under the MC-40 label clause, a view whose pinned sibling versions are gone from disk (no git history) can't have its "matches" claim re-checked against those versions, and would fail even if correct. Proposal: let such a claim be re-checked against the current sibling, crediting routed CF items for the differences, as this report did.

VERDICT: NEGATIVE (8 defects: 0 blocking + 8 minor). Under the Phase 1 exit rule in force, zero blocking means the unit freezes and D1–D8 go to the G1 packet. D1 is LEDGER CF-39(d), already open against this unit.
