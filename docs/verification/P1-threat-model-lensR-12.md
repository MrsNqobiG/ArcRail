VERIFICATION · lens: R · target: P1-threat-model (docs/THREAT_MODEL.md, version 2 after fix block 8; round 12 = grace round 2 of 2) · commit: none (uncommitted working tree; `git log` → "branch 'main' does not have any commits yet"; sha256(docs/THREAT_MODEL.md) = 6799bd758bfc8ffa3ff1f811c518ab814c35811a96a1c73facd12c92bdb4c982, mtime 2026-10-05 12:17:02 +0200, unchanged from pass start to pass end)

Criteria: CLAUDE.md; .claude/agents/verifier.md; docs/RUBRIC.md (sha256 4d86338d…, v2 fix block 11, unchanged during the pass).
Prior report: P1-threat-model-lensR-11.md (D1–D7).

## Sibling pins (taken at 2026-10-05 10:17:14 UTC = 12:17:14 +0200, 12 s after THREAT_MODEL's mtime)
| Sibling | Pinned sha256 (start) | End of pass (12:38:28 +0200) |
|---|---|---|
| RISK_REGISTER | 10a99078… (v3 fix block 4; same hash as the R11 pin) | **b2eff124…** (v3 fix block 5, mtime 12:18:38) |
| LEDGER | d4e56405… | **3688c59e…** (changed several times; adds CF-25) |
| CONTRACT | d6768590… | **d2f72422…** (fix H, mtime 12:20:08) |
| ADR-001 | 4afad822… (mtime 12:08:31, ADRs fix 9) | **ce0106ea…** (fix 10, mtime 12:20:33) |
| ADR-008 | 18ff96fc… (fix 5) | **f81850e2…** (fix 6, mtime 12:21:20; says it is ahead of THREAT_MODEL on DR-29 settlement/release checks, CF-25) |
| OPEN_QUESTIONS | ae2301c3… | **73ad9d4c…** (mtime 12:20:33) |
| ADR-002…007, constants, SEQUENCES, GATES, G1_PACKET, MISSION, RUBRIC | unchanged | unchanged |

Six siblings changed after THREAT_MODEL and during this pass. Sibling claims are judged at the **pinned** versions. Under the MC-40 label clause, any disagreement that a later sibling change introduced is that sibling's defect. Evidence read before the changes: CONTRACT §3 :186/:188/:190/:198 and §5.1 :241-255, ADR-008 :22/:45/:60/:75/:121, OPEN_QUESTIONS Q-C19/Q-D9, and the whole of LEDGER. These were all read before 12:19:45.

## Live evidence (2026-10-05, about 10:22–10:25 UTC)
- **Source drift.** This verifier ran `tools/source_drift.py`. Its sha256 5504b5e7…80e1 matches the version reviewed in P1-rubric-lensR-13.md and P1-threat-model-lensR-11.md, and its I/O was re-read: stdlib only, and with no `--out` it writes nothing. Result: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33", exit 0.
- **Chain.** Read-only JSON-RPC to https://rpc.testnet.arc.io (chain 5042002) only, using eth_chainId, eth_getBlockByNumber, eth_call, eth_getCode and eth_getBalance. No signing or sending method was used, no mainnet endpoint was contacted, and no .env file or key was read. Python urllib got HTTP 403, so curl was used.

## CHECKS
- K1 Structure recount → PASS.
  - `^| T-` = 37: S5, T7, R3, I3, D6, E5, N2, B2, SC4. That is +1 against R11 (T-T7).
  - `^| L-` = 8. `^| DR-` = 29, with DR-01…DR-29 each appearing once.
  - Executor block :52-58: every DR-01…DR-29 is assigned. DR-16 and DR-26 appear twice, as split parts.
  - The monitor line has 24 DR ids plus RD-01 and RD-03 = 26 entries. This matches ADR-008's map: 26 rows, DR-01…DR-29 minus DR-02/09/18/20/27, plus RD-01 and RD-03.
- K2 Coverage → PASS. STRIDE 6/6, plus B7, B8 and B5. LINDDUN has 7 categories in 8 rows. Boundaries B1–B9. T-T7 sits in the Elevation table (C7).
- K3 MC-21 → PASS. Every URL was reported identical, so quotes were checked against the newest archive of each:
  - evm-differences (`…REFETCH-later.md`): :201 `extra_data` (DR-16(2)); :204 "silently dropped by the mempool. They produce no error" (DR-16(1), residual 11).
  - gas-and-fees: :39 "Maximum base fee | 20,000 Gwei"; :65 "may remain pending indefinitely or fail outright"; :126 "`transaction underpriced`".
  - usdc-system-events: :78-79 zero-value and self-transfers emit no log; :35 system emitter.
  - deposits: :290 "`tx.from` is the relayer's address".
  - eip3009: :48-49 chainId `5042002` and verifyingContract `0x3600…0000`.
  - rpc-endpoints: :105/:118 `-32012`; :43-44/:119 `-32014`.
  - indexing-events: :158 Zero5.
  - The archives carry "Agent Instructions" blocks. They were treated as data (T-SC3).
- K4 Live chain → PASS.
  - eth_chainId 0x4cef52 = 5,042,002.
  - Block 65,610,407: baseFeePerGas 20,000,000,000; extraData 0x00000004a817c800 = 20,000,000,000 (C-33, DR-16(2)).
  - DR-11 premise, from the empty address 0x…c0ffee01 (balance 0x0) to 0x…c0ffee04:
    - zero-value → "0x";
    - 1 wei → {-32003, "revert: OutOfFunds"} (also reproduced from a second empty address);
    - zero-value from C-55 0x7099…79C8 → {-32603, "Blocked address"}.
  - Note: 0x…c0ffee03 now holds 0xe8d550ddef wei (someone funded it), so its 1-wei call returns "0x". The premise ("a 1-wei probe would falsely return -32003 on empty wallets") still holds for empty wallets.
  - DR-14 premise: eth_getCode(C-55) = 0xef0100b8b08cdb4e…; eth_getCode(empty) = "0x".
- K5 Numbers → PASS. Python divmod, asserting m·k + r = w and 0 ≤ r < k:
  - At p=6, k=10^12: 0→(0,0); 1→(0,1); 10^12−1→(0, 10^12−1); 10^12→(1,0); 10^18→(10^6,0); 7,374,356,000,000,000→(7,374; 356,000,000,000); 2^256−1→(…584007; 913,129,639,935).
  - At p=2, k=10^16: 10^16−1→(0; all dust); 10^18→(100,0); 7,374,356,000,000,000→(0; all dust); 2^256−1→(…945758; 4,007,913,129,639,935).
  - Gas: 21,000 × 20 gwei → (420, 0) at p=6.
  - T-T5 "1 USDC = 10^18 wei" holds.
- K6 Topic0 → PASS. Computed with an independent pure-Python Keccak-256, self-checked with keccak("") = c5d24601…5d85a470. Transfer = ddf252ad…f523b3ef. Approval = 8c5be1e5…c8c7c3b925 (DR-15).
- K7 Per-detection re-trace (MC-40):
  - DR-01 content binding → PASS. Rebuilt from CONTRACT §1.3 (JCS, all-string fields): A=125,050 at p=2 gives amountWei 1,250,500,000,000,000,000,000 and digest 22b4acb17c541dae…. Each change gives a different digest: destination 0x22…22 → d92ce532…; value +1 wei → f0dbc3fc…; instructionId PAY-0002 → 6cab3995…. "Only DR-01 catches" a same-amount swap (:80) holds, because DR-06 stays at 0. "Needs CF-5(f), CF-5(h) and CF-5(i)" (:166) closes R11 D7.
  - DR-06 → PASS. Mutant (1): W=10^18 gives residual ≠ 0. Mutant (2): a move booked as inbound gives residual X ≠ 0.
  - DR-10, DR-11, DR-14, DR-15 and DR-16 → PASS (K3–K6).
  - DR-19 → part (1) PASS. Part (2) FAILS on executor (D2) and coverage (D3).
  - DR-29 (new) → inputs and executor PASS:
    - `listJournals` already returns `legs` (CONTRACT :198);
    - CF-5(f/h/i) are routed;
    - the monitor is listed at :53;
    - the named mutant (C's payout settled against V) re-traced: V's debit leg joins C's instruction, account ≠ V, so PAUSE.
    - Amount handling FAILS: D4 (false PAUSE) and D5 (scope).
  - DR-02, -03, -04, -05, -07, -08, -09, -12, -13, -17, -18, -20 to -28 → PASS. Their text was re-read and is unchanged since R11 apart from the cross-references.
- K8 R11 defect disposition:
  - **D1 CLOSED.** :62 now reads "a simultaneous compromise of the adapter and the monitor; of the signer; or of an artefact owner (for example Treasury for its list and caps) plus the adapter (T-T6)", which matches residual 8 at :209.
  - **D2 CLOSED.** Pinned LEDGER CF-17 routes everything the :5 header lists: RB-1/DR-16; DR-04, DR-28, DR-20, DR-21 and DR-29 in RB-7; RB-10/Q-D4; RB-11; T-I2, T-I3, T-T6 and T-T7/DR-29 (RB-13); the residual-8 owners (RB-9); residuals 10–13; RB-6; 6b/6c with CF-5(h).
  - **D3 CLOSED.** Residual 13 (:214) cites Q-D9, which is an OPEN row in OPEN_QUESTIONS, and LEDGER CF-24, which is open.
  - **D4 PARTLY closed.** DR-19 (:184) adds "(2) Before every deploy, the testnet E2E suite sends canary deposits and payouts through the credit (U6) and payout (U10) flows". The case-return flow named in R11 D4 is still not covered, and neither is T11 assignment (D3). The new part has no declared executor (D2).
  - **D5 CLOSED.** The T-T6 input (:85) is now "the hash reported by the monitor, the signer and the egress proxy".
  - **D6 PARTLY closed.** T-T6 (:85) now states confidentiality for Treasury's list and the proxy set (T-I2), the honeytoken and canary lists and the attestation key (T-I3), the caps, the WORM anchor, the credential registry, the digest list and the IdP trust. The DB row-level audit log and the DB audit configuration are still missing (D6).
  - **D7 CLOSED** (K7 DR-01).
- K9 MC-40 label clause, sibling claims at the pinned versions:
  - "Ahead of RISK_REGISTER v3 fix block 4" → PASS. The pinned hash is the same as R11's, which R11 itemised. RB-13 and 3e are absent at fix block 4: LEDGER CF-16(c) says "in the drafted RISK_REGISTER fix 5". Fix block 5 landed at 12:18:38, after THREAT_MODEL, so later differences belong to RISK_REGISTER.
  - "Ahead of ADR-006 and ADR-001 … Q-D3 (CF-21)" → PASS. ADR-006 :26 still has no hardened branch. ADR-001 Q-D3 (:78) still has no xpub clause. CF-21 is open.
  - "Ahead of ADR-001 on the signer verifying owner-signed artefacts on load (T-T6, routed as CF-23)" → **FAIL** (D1).
  - "Defined in ADR-008 fix block 5" → PASS: the operator channel and the artefact checks.
  - "Ahead of ADR-008 fix block 4 … (CF-19)" → PASS. It names its version and is historically true.
- MC-44 → FAIL (D1). Everything else resolves:
  - Q-ids, each found exactly once as a row: A2, A5, A12, A15, A16, C10, C19, D1, D3, D4, D9, P1, R12, T3, T4.
  - CF-2, -5, -17, -18, -19, -21, -23, -24 all exist in LEDGER.
  - CONTRACT §3 (BINDING_MISMATCH, :116/:186), §1.3, §5.0, §5.4, §5.7 and §5.8; ADR-008 R5 C-1.
- MC-03 → PASS (K5). MC-21 → PASS (K3, K4). MC-42 → PASS (`grep -c SIGNED-OFF` = 0). MC-43 → PASS: the POPIA claims are flagged to Q-R12 at :147, :154 and :158.
- MC-40 → FAIL: (e) in D2; (a)/(b) in D3; (d) in D4; the (b) asset clause in D6; the label clause in D1 and D5.
- MC-41 → PASS. T-T7 is blind; it maps to [R] DR-29, with residual 6 / RB-13 until its inputs exist. Residual 13 has Q-D9.
- MC-45 → FAIL in part (D5). The per-sub-risk residual match with pinned RISK_REGISTER is routed (CF-17).
- MC-17(a) Phase 1 → PASS (DR-01, cancel class).
- MC-17(b) Phase 1 → FAIL in part (D5). Re-trace of the rubric's mutant ("a hold placed on an uninvolved customer"): `placeHold {key, instructionId}` (CONTRACT :188) takes the account from the CBS's own instruction, so the executor is the CBS (contingent on Q-C19). A hold that is settled is caught by DR-29. On-chain amounts of T8, `unid` and T11 are bound by nothing in THREAT_MODEL.
- MC-23 and MC-24 text against T-E5 and T-T1 → [inspection-only] PASS.
- MC-01, 02, 04–08, 10–16, 18–20, 22, 30–34 and 46–48 → N/A (code or CONTRACT properties).
- JL-1 Fail-closed → [inspection-only] PASS. D4 fails closed.
- JL-2 to JL-5 → [inspection-only] PASS. JL-4 is conditional on Q-C10.
- JL-6 → [inspection-only] PASS-in-part (D3, D6).
- Regression of frozen units → N/A by reconstruction (`grep "| frozen"` in LEDGER = 0). As a substitute, the two sections furthest from fix block 8 were re-checked, and both PASS:
  - T-E5, DR-14 and DR-15: EIP-712 domain in the archive (K3), Approval topic0 (K6), 7702 prefix on C-55 (K4).
  - T-T5, DR-06 and DR-10: conversions and residuals recomputed (K5, K7).

## CANDIDATES (recorded for traceability)
- **C1** · :5 "and **ahead of ADR-001** on the signer verifying owner-signed artefacts on load (T-T6, routed as **CF-23**)" vs pinned LEDGER :65 "~~**CF-23**~~ · **CLOSED** by ADRs fix 9" and :33 "**Fix 9** (… CF-23 signed, version-pinned signer configuration in ADR-001 and Q-D1)".
  - Pinned ADR-001 mtime 12:08:31 is before THREAT_MODEL's 12:17:02. ADR-001 :24 "**Signed configuration (THREAT_MODEL T-T6, CF-23).**" is present.
  - The claim also names no ADR-001 fix block.
  - Criterion: MC-40 label clause ("named down to the fix block … every 'ahead' … claim … re-checked against that version"), MC-44.
  - REAL → D1.
- **C2** · :184 DR-19 opens "**In the monitor.**" but part (2) is "Before every deploy, the testnet E2E suite … the scanner runs over that run's logs … A canary pair found → the deploy is blocked". :52 says "Every detection, or each named part of a detection, is run by exactly one of these", yet :53 lists DR-19 under Monitor only. The block (deploy tooling) is in no executor line.
  - Criterion: MC-40(e).
  - REAL → D2.
- **C3** · :184 part (2) exercises only "the credit (U6) and payout (U10) flows". The named mutant is "A logger prints `accountRef` next to an address". Re-trace with the logger placed in:
  - the case-return path (CONTRACT §5.5, started from HELD_IN_CLEARING :306 for an item sent to a mapped collection address) → not exercised → not caught;
  - the T11 assignment path (SUSPENSE_ASSIGNING :309, which binds a received address to an `ASSIGN` accountRef) → not exercised → not caught.
  - R11 D4 explicitly named "the credit, payout and case-return flows".
  - Criterion: MC-40(a)/(c), and MC-40(b) "A **sampled** scope must include every instance of the named mutant's class".
  - REAL → D3.
- **C4** · :194 DR-29 "the issuance record (address → account) and the monitor's own log fetch (address, amount) for T2 … Any mismatch → PAUSE" vs CONTRACT :255 "**`h` is the item's current `heldAmount`**, not the original `m`: they differ after a partial case return (`RETURNED_PARTIAL`, §5.5)".
  - Re-trace: p=2, k=10^16, inbound w=10^20, so m=10,000. HELD_IN_CLEARING → `RETURN` R=2,500 (:306) → RET_BROADCAST status 1 → T9 → heldAmount 7,500 (:419) → `RELEASE` → CLEAR → T2 posts 7,500 to G1. DR-29 compares 7,500 with log amount 10,000 → mismatch → PAUSE on a legitimate flow.
  - Criterion: MC-40(d).
  - REAL → D4. Minor, because it fails closed.
- **C5** · Pinned CONTRACT :186 "**Amounts that start on-chain** (T2, T8, T11, `unid`) … bound **outside the adapter** by the monitor's journal-binding join (proposed DR-29 …), which compares each journal's account, address and amount with the monitor's own log fetch" (ADR-008 :45 says the same) vs THREAT_MODEL :194: DR-29 covers only journals "with a customer-account (G1) leg", and for T11 only "the `ASSIGN` disposition" (the account).
  - T8 (G5→G7) and `unid` (G5→G4) have no G1 leg, so they are outside the join. The T11 amount is not compared.
  - CONTRACT is older than THREAT_MODEL (12:02:49 vs 12:17:02). THREAT_MODEL neither says it narrows the join nor is ahead on it. LEDGER CF-25 routes only the settlement and release checks.
  - Criterion: MC-45, MC-17(b), MC-40 label clause.
  - REAL → D5.
- **C6** · RUBRIC MC-40(b) "Every reference artefact … appears as an asset in THREAT_MODEL, with its confidentiality and integrity threats" vs B9 :47 (the "database engine's row-level audit log", a monitor reference input), T-T6 :85 (owner list "database audit configuration"), and the T-T6 confidentiality sentence, which covers every other artefact but not these two.
  - It gives no threat and no reason. R11 D6 named "the DB audit configuration".
  - A plausible harm: row-level read records of indexed per-address lookups identify registry rows, and so collection addresses, as the bank's (the T-I2 / L-2 harm). The read pattern may also reveal honeytoken rows (the T-I3 harm).
  - REAL → D6.
- **C7** · T-T7 (:117), a Tampering ID, sits in the Elevation table between T-E1 and T-E2. Criterion: MC-44. DISMISSED. Every reference to T-T7 (:5, :116, :194) resolves to the row. The placement is cosmetic, as was DR-21's order in R11.
- **C8** · T-T7 "places a payout hold … on an uninvolved customer's account" vs DR-29, which reads journals only (a non-fallback hold is not a journal, and a released hold never becomes one). Criterion: MC-40(c), MC-41. DISMISSED.
  - The account of a hold is taken by the CBS from its own instruction (`placeHold {key, instructionId}`, :188). MC-17(b) accepts the CBS as the executor.
  - Any money movement from a wrong hold passes through `settleHold`, which is a journal and is caught by DR-29.
  - A hold that is released moves no money, and the customer can see it ([X] at T-E1).
  - See cross-unit note X3 for ADR-008's wording.
- **C9** · Residual 6 (:204-207) lists DR-29 but its bullets omit wrong-account postings and Q-C19, whereas T-T7 says "Until Q-C19 and DR-29's inputs exist: G1 residual 6". Criterion: MC-45. DISMISSED. The residual names DR-29, T-T7 names residual 6, and RISK_REGISTER RB-13 carries the same condition, so the per-sub-risk match holds.
- **C10** · DR-19 part (2) with a debug-level logger that is off during E2E. Criterion: MC-40(c). DISMISSED. :184 "log levels are configuration under change control, with debug logging off in production". Enabling it is a change-controlled decision, not an instance of the named code mutant.
- **C11** · :5 "RB-11 (closed by fix block 4)" is ambiguous about which document's fix block. Criterion: MC-44. DISMISSED. R11 confirmed that RB-11 still existed in RISK_REGISTER fix block 4, so the phrase can only mean THREAT_MODEL fix 4 (CF-13(b)), and CF-17 routes the closure.
- **C12** · :5 "ahead of ADR-008 fix block 4 … (routed as CF-19)", where CF-19 is now closed. Criterion: label clause. DISMISSED. It names the sibling's version and is true of that version.

## DEFECTS
- **D1** · docs/THREAT_MODEL.md:5 · Lens R / MC-40 label clause, MC-44 · minor. The header says THREAT_MODEL is "ahead of ADR-001" on the signer's on-load artefact checks (CF-23). ADR-001 fix 9, before THREAT_MODEL fix 8, already carries them (ADR-001 :24), and LEDGER closed CF-23. Drop the clause, or restate it as "matches ADR-001 fix block 9". Name ADR-001's and ADR-006's fix blocks in the remaining ahead claims.
- **D2** · docs/THREAT_MODEL.md:184 (DR-19), :52-58 (executors) · Lens R / MC-40(e) · minor. DR-19 part (2) is run by the testnet E2E suite before every deploy, and its "deploy is blocked" action is enforced by deploy tooling. Neither is in the executor list, which assigns all of DR-19 to the monitor, and the row is headed "In the monitor". Split DR-19 into named parts. Assign part (2) and its blocking action to CI or deploy tooling, with its inputs listed.
- **D3** · docs/THREAT_MODEL.md:184 (DR-19 part (2)) · Lens R / MC-40(a)/(b) · minor. The E2E canary drive covers only U6 credit and U10 payout. The case-return flow (CONTRACT §5.5) and the T11 assignment path (§5.3 SUSPENSE_ASSIGNING) also handle address↔account pairs, and a logger there is not caught. Drive canary items through every flow that handles a mapped address: case return from G5 and G4, and `ASSIGN`/T11. Alternatively, name the detection that covers those sites.
- **D4** · docs/THREAT_MODEL.md:194 (DR-29, T2 branch) · Lens R / MC-40(d) · minor (fails closed). Comparing T2's amount with the monitor's own log fetch gives a false PAUSE after a legitimate partial case return (T2 posts `heldAmount` = m − R). Net the CBS's own T9 journals for the same item, so the expected amount = log amount ÷ k − Σ returns. State the healthy signal.
- **D5** · docs/THREAT_MODEL.md:194 (DR-29 scope) vs CONTRACT §3 :186 (pinned and current) and ADR-008 :45 · Lens R / MC-45, MC-17(b), MC-40 label clause · minor. CONTRACT says DR-29 binds the account, address and amount of T2, T8, T11 and `unid` against the monitor's own log fetch. THREAT_MODEL's DR-29 joins only G1-leg journals, so T8 and `unid` are out, and it binds T11 by account only. Either widen DR-29 to every journal whose amount starts on-chain (amount vs own log fetch net of returns; T11 also against the `unid` amount for the same item), or state the narrower scope and route CONTRACT/ADR-008 as a CF.
- **D6** · docs/THREAT_MODEL.md:85 (T-T6), :47 (B9) · Lens R / MC-40(b) asset clause · minor. The DB row-level audit log (a monitor reference input) and the DB audit configuration have no confidentiality threat or "none needed because…" statement. Add one. For example, the audit records name registry rows (the T-I2 / L-2 harm) and may reveal honeytoken rows by their read pattern (the T-I3 harm). Give the controls (the access-restricted log store, owned by Security) and the detection, or the reason none is needed.

## PROBES (for the LEDGER rubric proposal queue; not counted here)
- **Probe G (would a bad version pass?) → YES.** A join that compares an amount with an on-chain reference passes MC-40(d) unless the verifier happens to trace a flow that legitimately changes the amount (D4 nearly passed).
  - Proposed: "For every detection that compares an amount, the verifier re-traces each CONTRACT flow that changes the item's amount between the reference event and the compared record (partial returns, dust, fees, re-entries) and confirms the detection nets it."
- **Probe F (would a good version fail?) → YES.** MC-40(b)'s asset clause ("every reference artefact … with its confidentiality and integrity threats") can be read to cover live reads from a system of record (CBS read results) and per-event signed messages (IdP assertions, the pushed signing log). A good document that models only stored, owner-maintained artefacts could then be failed.
  - Proposed: "'Reference artefact' means a stored object maintained by a named owner and loaded by the executor (lists, keys, registries, anchors, third-party logs). Live reads from a system of record and per-event signed messages are inputs, not artefacts."

## Cross-unit notes (not counted here)
- **X1** · CONTRACT §3 :186 and ADR-008 :45 restate the DR-29 amount comparison "with the monitor's own log fetch". They carry the partial-return false PAUSE of D4 and should follow the same netting rule.
- **X2** · The LEDGER P1-threat-model intent column still says "DR-01…DR-28". DR-29 now exists.
- **X3** · ADR-008 :45 (fix 5 and fix 6) says a wrong-customer hold "stops at the CBS, or at the first reconciliation cycle after it". The monitor has no hold listing, so an unsettled hold is seen only by the CBS binding (C8).
- **X4** · RISK_REGISTER moved to fix block 5 during this pass (12:18:38), after THREAT_MODEL. Any differences from THREAT_MODEL fix 8 are RISK_REGISTER's to own. Its header :9 says "This version is not ahead of any sibling".
- **X5** · ADR-008 fix 6 (12:21:20) and LEDGER CF-25 (open) route DR-29's settlement and release checks against the chain into THREAT_MODEL. That is a routed sibling-ahead item, not a defect of this version, but it must land before freeze.

## VERDICT: NEGATIVE (6 defects: 0 blocking, 6 minor)
