VERIFICATION · lens: R · target: P1-threat-model (docs/THREAT_MODEL.md, version 2 after fix block 7; round 11 = grace round 1 of 2) · commit: none (uncommitted working tree; `git log` → "branch 'main' does not have any commits yet"; sha256(docs/THREAT_MODEL.md) = e134eede2f943abff008222b3c0496a7c333830a5ccec9a9ab4786b288285be5, mtime 2026-10-05 11:54:55 +0200, unchanged during this pass)

Criteria: CLAUDE.md; .claude/agents/verifier.md; docs/RUBRIC.md as on disk (sha256 4387ef43…, mtime 11:59:04, v2 fix block 10).
Prior report: P1-threat-model-lensR-10.md (D1–D7).

Siblings moved during this pass. Each was re-read at about 12:04, and the verdict uses that state:
- ADR-008 went from fix block 4 (mtime 2026-10-03, read at about 11:59) to **fix block 5** (12:03:30, sha256 18ff96fc…).
- LEDGER went to 12:03:42 (sha256 ca51d9bc…). It now holds CF-23, closes CF-18 and CF-19, and queues the R10 probes.
- CONTRACT and OPEN_QUESTIONS changed at 12:02:49.
- RISK_REGISTER is unchanged: v3 fix block 4, 2026-10-03 11:49:23, sha256 10a99078….
- ADR-001 is at 11:52:05. ADR-004 and ADR-006 are unchanged since 2026-10-03.

Under the MC-40 label clause, a sibling changed after THREAT_MODEL is the defective party wherever they disagree.

Live evidence, 2026-10-05 about 10:04 UTC:
- **Source drift.** `tools/source_drift.py` was run by this verifier. Its sha256 5504b5e7…80e1 matches the version reviewed in P1-rubric-lensR-13.md, and the source was re-read here: stdlib only, read-only. Output went to the session scratchpad, not to the repo. Result: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33", exit 0. Every URL was identical.
- **Chain.** Read-only JSON-RPC against https://rpc.testnet.arc.io (chain 5042002) only, using eth_chainId, eth_getBlockByNumber, eth_call and eth_getCode. No signing or sending method was used, no mainnet endpoint, and no .env or keys were read.

CHECKS
- K1 Structure recount → PASS. `^| T-` = 36: S5, T6, R3, I3, D6, E5, N2, B2, SC4. That is +1 against R10, the new T-I3. `^| L-` = 8. `^| DR-` = 28, with DR-01 to DR-28 each appearing once (DR-21 still sits after DR-27, which is cosmetic). Executor block :52-58: every DR-01 to DR-28 is assigned. The monitor has 23 DR ids, DR-16 part (2) and DR-26 part (1) among them, plus RD-01 and RD-03, for 25 entries. That matches ADR-008 fix 5 :48 "25 entries". The "DR-00" grep hit is a substring of ADR-00x.
- K2 Coverage → PASS. STRIDE 6/6, plus B7, B8 and B5. LINDDUN has 7 categories in 8 rows. Boundaries B1–B9.
- K3 MC-21 → PASS. Quotes were checked against the archive the tool compared:
  - evm-differences, newest archive `arc_references_evm-differences.REFETCH-later.md`: :201 "The next block's base fee is in the parent header's `extra_data`" (DR-16(2)); :204 "silently dropped by the mempool. They produce no error" (DR-16(1), residual 11).
  - gas-and-fees: :39 "Maximum base fee | 20,000 Gwei" (T-N2); :65 "may remain pending indefinitely or fail outright"; :126 "`transaction underpriced`".
  - usdc-system-events: :78-79 "Zero-value transfers emit no log." / "Self-transfers (`from == to`) emit no log." (C-24, used in K8 D7).
  - deposits: :290 "`tx.from` is the relayer's address" (T-S4, DR-22).
  - eip3009: :48-49 and :65, chainId `5042002`, verifyingContract `0x3600…0000`, name "USDC" (T-E5).
  - rpc-endpoints: :105 and :118 `-32012`; :43-44 `-32014` (T-D1).
  - indexing-events: :158 Zero5 (T-N1).
- K4 Live chain → PASS.
  - eth_chainId 0x4cef52 = 5,042,002.
  - Block 65,608,080: baseFeePerGas 20,000,000,000; extraData 0x00000004a817c800 = 20,000,000,000 (C-33, DR-16(2)).
  - DR-11 premise, with fresh E = 0x…c0ffee01 and O = 0x…c0ffee02:
    - zero-value E→O → "0x";
    - 1 wei E→O → {-32003, "revert: OutOfFunds"};
    - zero-value from C-55 (0x7099…79C8) → {-32603, "Blocked address"}.
  - DR-14 premise: eth_getCode(C-55) = 0xef0100b8b08cdb4e…; eth_getCode(E) = "0x".
- K5 Numbers → PASS. Python divmod, asserting m·k + r = w and 0 ≤ r < k:
  - At p=6, k=10^12: 0→(0,0); 1→(0,1); 10^12−1→(0, 10^12−1); 10^12→(1,0); 10^18→(10^6,0); 7,374,356,000,000,000→(7,374; 356,000,000,000); 2^256−1→(…584007; 913,129,639,935).
  - At p=2, k=10^16: 10^16−1→(0; all dust); 10^18→(100,0); 7,374,356,000,000,000→(0; all dust); 2^256−1→(…945758; 4,007,913,129,639,935).
  - Gas: 21,000 × 20 gwei = 420,000,000,000,000 → (420, 0) at p=6.
  - T-T5 "1 USDC = 10^18 wei" holds.
- K6 Topic0 → PASS. Computed with an independent pure-Python Keccak-256, self-checked with keccak("") = c5d24601…5d85a470. Transfer = 0xddf252ad…f523b3ef. Approval = 0x8c5be1e5…c8c7c3b925 (DR-15).
- K7 Per-detection re-trace (MC-40):
  - DR-01 content binding → PASS. Rebuilt from CONTRACT §1.3: A=125,050 at p=2 gives amountWei 1,250,500,000,000,000,000,000 and digest 22b4acb17c541dae…. Each change gives a different digest: destination 0x22…22 → d92ce532…; value +1 wei → f0dbc3fc…; instructionId PAY-0002 → 6cab3995…. With a same-amount destination swap, DR-06 stays at residual 0, so "only DR-01 catches it" (:78) holds. The cancel-class input gap is D7.
  - DR-06 → PASS. Mutant (1): W=10^18 gives residual 999,999,000,000,000,000,000,000 ≠ 0. Mutant (2): an internal move booked as inbound gives residual X ≠ 0.
  - DR-10, DR-11, DR-14, DR-15 and DR-16 → PASS (K3–K6).
  - DR-19 → exercise path, proxy use and BINDING_MISMATCH avoidance all PASS (R10 D5 is closed as asked). The coverage of the named mutant FAILS: see D4.
  - DR-02, DR-03, DR-04, DR-05, DR-07, DR-08, DR-09, DR-12, DR-13, DR-17, DR-18, DR-20 to DR-28 → PASS. Their text was re-read; apart from DR-01, DR-19 and DR-20/21 it is unchanged since R10.
- K8 R10 defect disposition:
  - **D1 CLOSED** as of the 12:03 sibling state.
    - B9 :44 declares the owner PAUSE-request channel as a monitor input, with one owner enough to stop and two people to unpause.
    - ADR-008 fix 5 :102 now defines the "Operator channel (owner PAUSE requests)", and :103 the "Artefact checks on load".
    - LEDGER CF-23 now routes the signer's duty to ADR-001.
    - Note: THREAT_MODEL (11:54:55) cited ADR-008 fix block 5 and CF-23 before either existed (ADR-008 was still at fix 4 at 11:59, and CF-23 was absent from LEDGER at 11:59). The citation is valid only because the siblings caught up afterwards.
  - **D2 PARTLY closed.** Residual 8 (:205) now includes "an artefact owner, such as Treasury for its list and caps, plus the adapter, T-T6". The :60 restatement that R10 D2 named was not widened (D1 below). The RB-9 mirror is not routed (D2 below).
  - **D3 NOT closed.** The header now names DR-20, DR-21, T-I3, T-T6 and residuals 8 and 10–13, but says "All routed as LEDGER CF-17", and LEDGER:58 CF-17 is unchanged (D2 below).
  - **D4 closed in substance.**
    - Residual 13 (:210) now covers hosted CASPs "until ADR-004 provides a counterparty acknowledgement".
    - Residual 12 (:209) adds "or between an advisory and the next daily scan".
    - What remains is that nothing tracks the item that closes residual 13 (D3 below).
  - **D5 closed as asked.** DR-19 :181 now says "the monitor resolves the canary address through the adapter's normal read-only address-lookup path … No deposit or posting is made, so CBS binding (`BINDING_MISMATCH`) is never touched", and that the proxy "blocks any request carrying a canary address". A successor finding is D4.
  - **D6 closed for the asset list and the T-I3 confidentiality threat.**
    - T-T6 :83 now lists the proxy's synced bank address set, the IdP trust configuration and the DB audit configuration, and names the egress proxy as a verifier.
    - T-I3 :99 covers the honeytoken and canary lists and the attestation key.
    - Successor findings are D5 and D6.
  - **D7 CLOSED.**
    - DR-01 :163 now has the "**Cancel (CF-18):** zero value, `to` = the sender … a collection address in the reference set S (ADR-001 duty 2)" class. ADR-001:12 duty 2 is indeed the cancel rule.
    - DR-13 cannot false-PAUSE on a cancel, because a cancel is a zero-value self-send and C-24 says such transfers emit no log (K3, archive :78-79).
    - LEDGER marks CF-18 CLOSED.
    - A successor input gap is D7.
- K9 MC-40 label clause, sibling claims re-checked → PASS for "ahead", FAIL for "routed" (D2).
  - "Ahead of RISK_REGISTER v3 fix block 4" (RR :3 "Fix blocks 1 to 4 applied") is true for every item named:
    - RB-1 still gives DR-16 as [R] (:79);
    - RB-7 (:85) lacks DR-04, DR-20, DR-21 and DR-28;
    - 6b (:61) has no CF-5(h);
    - RB-10 (:87) closes on CF-11(a), not Q-D4;
    - RB-11 (:88) still exists;
    - RB-9 (:89) lacks the artefact owners;
    - RB-6 (:84) lacks the hosted and unhosted split;
    - RR has no rows for T-I2, T-I3, T-T6 or residuals 10–13.
  - "Ahead of ADR-006 and ADR-001 (CF-21)": ADR-006 :26 still uses the plain path, and ADR-001 :77 Q-D3 lacks the xpub clause. True.
  - "Ahead of ADR-001 (CF-23)": ADR-001 has no duty to check signatures on load (grep for "on load", "signed by" and "pinned" returns 0). True. CF-23 is in LEDGER.
  - "ADR-008 fix block 5" now exists and defines the channel and checks. True.
  - "Ahead of ADR-008 fix block 4 … (CF-19)" is historically true. CF-19 is now closed by ADR-008 fix 5.
- MC-03 → PASS (K5). MC-21 → PASS (K3, K4). MC-42 → PASS (`grep -c SIGNED-OFF` = 0). MC-43 → PASS: the POPIA claims are flagged to Q-R12 at :144, :151 and :155.
- MC-44 → FAIL (D1, D2). Everything else resolves:
  - Q-ids, each found exactly once as a row in OPEN_QUESTIONS: A2, A5, A12, A15, A16, C10, D1, D3, D4, P1, R12, T3, T4.
  - CF-2, CF-5(e)–(i), CF-18, CF-19, CF-21 and CF-23 all exist in LEDGER.
  - C-ids, CONTRACT §1.3, §5.0, §5.4, §5.7 and §5.8, and ADR-001 duty 2.
- MC-40 → FAIL: (a)/(c) in D4; the [X] clause in D5; (b) in D6; (c) in D7; the label clause in D2. MC-41 → FAIL (D3). MC-45 → FAIL in part: the per-sub-risk residual 8 restatement (D1).
- MC-17(a), Phase 1 → PASS (K7 DR-01; cancels classified).
- MC-23 and MC-24 text against T-E5 and T-T1 → [inspection-only] PASS.
- MC-01, 02, 04–08, 10–16, 18–20, 22, 30–34 and 46–48 → N/A (code or CONTRACT properties).
- JL-1 Fail-closed → [inspection-only] PASS. The owner PAUSE channel is now defined (ADR-008 :102); attestation is a dead-man switch; the proxy fails closed; artefacts are refused on load.
- JL-2 to JL-5 → [inspection-only] PASS. JL-4 is conditional on Q-C10.
- JL-6 → [inspection-only] PASS-in-part. The proxy address set's confidentiality is in D6.
- Regression of frozen units → N/A by reconstruction (`grep "| frozen"` in LEDGER = 0). As a substitute, the two sections furthest from fix block 7 were re-checked, and both PASS:
  - T-E5, DR-14 and DR-15: EIP-712 domain in the archive (K3), Approval topic0 recomputed (K6), 7702 prefix re-observed on C-55 (K4).
  - T-T5, DR-06 and DR-10: conversions and residuals recomputed (K5, K7).

CANDIDATES (recorded for traceability)
- C1 · :60 "**Residual (G1 residual 8):** a **simultaneous** compromise of the adapter and the monitor, or of the signer." vs :205 residual 8 "(adapter and monitor; the signer; or **an artefact owner, such as Treasury for its list and caps, plus the adapter**, T-T6)" · MC-44, MC-45 · REAL → D1. R10 D2 named this restatement explicitly ("Widen residual 8 (and the :59 restatement)").
- C2 · :5 "…residuals 8 (artefact owners), 10 to 13, and the travel-rule residual (RB-6). All routed as LEDGER **CF-17**." vs LEDGER.md:58 · MC-44, MC-40 label clause · REAL → D2.
  - CF-17 routes only RB-1/DR-16 [A], DR-04 and DR-28 in RB-7, T-I2, DR-16/Q-A2, RB-10/Q-D4, RB-11 and 2c, and says RB-7 "matches the new residual 6 (DR-01, DR-04, DR-22, DR-23, DR-25)".
  - It does not route T-I3, T-T6, the residual 8 owners (RB-9), residuals 12 and 13, RB-6, or DR-20 and DR-21 (RB-7 and 6b).
- C3 · :210 "for hosted CASPs until ADR-004 provides a counterparty acknowledgement … RISK_REGISTER RB-6"; ADR-004 (grep "acknowledg" = 0); OPEN_QUESTIONS (grep "acknowledg" = 0; the only ADR-004 question, Q-D5, is about counterparty mix) · MC-41 ("listed as a G1 residual with the CF item or question that will close it"), MC-40(c) · REAL → D3. The unhosted part is inherent, with its cause stated, so it needs no CF. The hosted part depends on a decision nobody has asked for.
- C4 · :181 DR-19 mutant "A logger prints `accountRef` next to an address → the canary pair is found", with the exercise "the monitor resolves the canary address through the adapter's normal **read-only** address-lookup path … No deposit or posting is made" · MC-40(a)/(c) (the signal at the capture point for the named mutant) · REAL → D4.
  - Put the logger in the lookup function: detected.
  - Put it in the U6 credit step or the U10 payout step, the flows that actually handle real address↔account pairs: the canary row never passes through, so nothing is detected.
  - DR-19 is the only [R] for L-6 and RR 6a.
- C5 · :83 T-T6 lists "the egress proxy" among the verifiers of artefacts it loads (honeytoken and canary lists, "the proxy's synced bank address set"), but its [X] is "Each owner re-attests the **deployed** version hash … input = the hash reported by the monitor and the signer" · MC-40 [X] clause / (c) · REAL → D5. A tampered proxy set is blind: DR-20 silently stops blocking leaks for removed addresses. Its deployed version is never re-attested.
- C6 · RUBRIC MC-40(b) "Every reference artefact … appears as an asset in THREAT_MODEL, with its confidentiality and integrity threats" vs :83 (T-T6, integrity only, for Treasury's list and caps, the WORM anchor, the credential registry, the digest list, the proxy's bank address set and the IdP trust) and :99 (T-I3, confidentiality for the honeytoken and canary lists and the attestation key only) · MC-40(b) · REAL → D6.
  - The proxy's bank address set is Treasury's list ∪ every issued collection address. Disclosing it links every collection address to the bank: the same privacy harm T-I2 (:98) models for the xpub ("It links every collection address to the bank (privacy, L-2)").
  - No confidentiality threat, and no "not needed, because…" statement, is given for it or for the others.
  - The R10 Probe F relaxation is queued (LEDGER :46) and not adopted, and even it would require a stated reason.
- C7 · :163 DR-01 "**Cancel (CF-18):** … The sender may be on Treasury's list **or** a collection address in the reference set S" … "**Needs CF-5(f) and CF-5(i)**; can't run until then" vs :186 DR-24 "builds the scanned wallet set S from Treasury's list ∪ `listIssuedAddresses`" (which is CF-5(h)) · MC-40(c) (every input exists or is tracked) · REAL → D7.
  - DR-01's cancel class needs CF-5(h), and its row doesn't say so.
  - If CF-5(f) and CF-5(i) land before CF-5(h), DR-01 runs and PAUSEs on every legitimate cancel of a collection-wallet sweep. That is fail-closed, hence minor.
- C8 · :59 executor note "An item-level QUARANTINE requested by the monitor is **recorded by the monitor** and, if it isn't honoured, escalates to PAUSE" vs DR-11 and DR-22 QUARANTINE · MC-40(e) · DISMISSED. The executor is the monitor and the escalation is monitor-issued, so it is outside the adapter domain.
- C9 · Wrong-account postings by a compromised adapter (a hold on uninvolved customer V): T-E1 :116 has no DR-29 or CBS-binding control · MC-41 · DISMISSED for this version.
  - LEDGER CF-16(b) "THREAT_MODEL row and DR-29 still open" routes it as an open CF that is only an edit between Phase 1 documents. MC-40(f) says such a CF "needs no residual row", and the label clause excuses a sibling lag routed as an open CF.
  - The preventive control, CBS binding with `BINDING_MISMATCH` → PAUSE, is in CONTRACT fix F/G.
  - It must land before freeze (cross-unit note X1).
- C10 · :83 T-T6 [X] cadence "daily" vs residual 12 (:209), which lists [X]-only windows for T-B1, T-SC2 and T-I3 but not T-T6 · MC-40 [X] clause · DISMISSED. T-T6 states "On its own this lets nothing move". Its money harm needs an owner compromise plus an adapter compromise, which residual 8 already holds. A tamper without owner compromise is stopped preventively by the signature and pin check on load.

DEFECTS
- D1 · docs/THREAT_MODEL.md:60 · Lens R / MC-44, MC-45 · minor. Widen the B9 restatement of residual 8 to match :205: "…or an artefact owner plus the adapter (T-T6)". Alternatively, replace it with a plain reference to residual 8.
- D2 · docs/THREAT_MODEL.md:5 vs docs/LEDGER.md:58 (CF-17) · Lens R / MC-44, MC-40 label clause · minor. Extend CF-17 to route T-I3, T-T6, the residual 8 owners (RB-9), residuals 12 and 13 (RB-6 split), and DR-20 and DR-21 in RB-7 and 6b. Alternatively, drop "All routed as LEDGER CF-17" for the items CF-17 does not carry.
- D3 · docs/THREAT_MODEL.md:210 (residual 13), :180 (DR-18), :130 (T-B2) · Lens R / MC-41, MC-40(c) · minor. Track the closing item for the hosted-CASP part: for example, a Q for ADR-004 ("does the chosen travel-rule solution return a counterparty-echoed digest per transfer?") or a CF routed to ADR-004. Cite it in residual 13.
- D4 · docs/THREAT_MODEL.md:181 (DR-19) · Lens R / MC-40(a), MC-40(c) · minor. Either scope the named mutant to code on the exercised lookup path, and name the detection that covers logging in the credit, payout and case-return flows (for example [P] MC-30, seeded-canary telemetry tests driven through every flow), or give the canary a way through those flows that doesn't post. Without one of these, DR-19 cannot catch its own mutant when the logger sits in U6 or U10.
- D5 · docs/THREAT_MODEL.md:83 (T-T6 detection) · Lens R / MC-40 [X] clause, MC-40(c) · minor. Add the egress proxy to the re-attestation input ("the hash reported by the monitor, the signer **and the egress proxy**"), or state why the proxy's loaded versions need no re-attestation.
- D6 · docs/THREAT_MODEL.md:83, :99 · Lens R / MC-40(b) asset clause · minor. State the confidentiality threat and controls for the proxy's synced bank address set; it is privacy-relevant, the same harm as T-I2. For the remaining artefacts (Treasury's list and caps, the WORM anchor, the FIDO2 public-credential registry, the digest list, the IdP trust and the DB audit configuration), either state a confidentiality threat or give the reason none is needed.
- D7 · docs/THREAT_MODEL.md:163 (DR-01) · Lens R / MC-40(c) · minor. DR-01's cancel class depends on S, which includes `listIssuedAddresses`. Change "Needs CF-5(f) and CF-5(i)" to "Needs CF-5(f), CF-5(h) and CF-5(i)", or state that collection-wallet cancels fall back to PAUSE until CF-5(h) lands.

PROBES (for the LEDGER rubric proposal queue; not counted here)
- Probe G (would a bad version pass?) → YES.
  - Today MC-40(c) is checked against "the named mutant", and an author can name a mutant that sits exactly on the one path the detection exercises. That is how D4 nearly passed. A planted-artefact detection (canary, honeytoken) could exercise one code path while the sub-risk lives in every path.
  - Proposed: "For a detection that plants an artefact, the verifier re-traces the named mutant at each code site the sub-risk names (every flow that handles the protected data), not only at the site the artefact is driven through."
- Probe F (would a good version fail?) → YES.
  - MC-40 label clause and MC-44: a document is judged against siblings whose content can change during the verification pass, as ADR-008 and LEDGER did here between 11:59 and 12:03. A citation that was false when the document was written can become true before the verdict, and the reverse.
  - Proposed: "Sibling claims are checked against the sibling versions on disk when the verifier starts; the report records each sibling's hash. A sibling change during the pass is noted and re-checked, but it is credited only if the sibling's own header names the fix block the claim cites."

Cross-unit notes (not counted here)
- X1 · CF-16(b): THREAT_MODEL still needs the T-T row for wrong-account postings and DR-29 (proposed in ADR-008 fix 5 :75). It must land before THREAT_MODEL can freeze.
- X2 · ADR-008 fix 5 :103 lists the artefacts the monitor checks on load ("Treasury's list and caps, the honeytoken and canary lists, the xpub, the credential registry"). It omits two that THREAT_MODEL T-T6 assigns to the monitor: the WORM anchor and the IdP trust configuration. ADR-008 is the newer document, so this is ADR-008's defect.
- X3 · ADR-001 :39 duty 6 "Internal moves …, **including same-nonce zero-value cancels:** every move needs a `to` on … Treasury's … list" conflicts with duty 2's collection-wallet cancel. It then says "Cancels follow the cancel rule in item 2". That is an ADR-001 wording issue.
- X4 · CONTRACT.md:236 still records the signing log as `(payloadHash, nonce, txHash)` without `instructionId` (CF-9(b) open). DR-01's new cancel class relies on `instructionId`.
- X5 · RISK_REGISTER RB-6, RB-7, RB-9, 6b, and new rows for T-I3 and T-T6, need the mirrors listed in D2.

VERDICT: NEGATIVE (7 defects: 0 blocking, 7 minor)
