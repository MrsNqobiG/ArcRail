VERIFICATION · lens: R · target: P1-threat-model (docs/THREAT_MODEL.md, version 2 reframe with detection register §D) · commit: none (uncommitted working tree; `git rev-parse HEAD` → "unknown revision"; sha256(docs/THREAT_MODEL.md) = ffb0f302591b745148187abe8f2a569921757d535c678393645e29ca743da9e4, mtime 00:22 local, unchanged during this run)

Criteria: KICKOFF_PROMPT.md §5 Phase 1 item 3, §6, §9; CLAUDE.md; docs/RUBRIC.md v2 (all 37 MC items + JL-1..6; esp. MC-40, MC-41, MC-43, MC-44, MC-45); CONTRACT.md v3 Fix A; RISK_REGISTER.md v3; docs/adr/; constants.md; OPEN_QUESTIONS.md; docs/sources/.
Note: CONTRACT, LEDGER, OPEN_QUESTIONS, RISK_REGISTER, RUBRIC and the ADRs were modified by another agent during this run. All cross-references below were re-read after those edits. Line numbers are for the current files.
Live evidence: read-only JSON-RPC against https://rpc.testnet.arc.io (eth_chainId → 0x4cef52 = 5042002), and raw curl re-fetches of docs.arc.io pages. System clock reported 2026-10-02 22:45 UTC and 2026-10-03 08:45 UTC during the run; access date recorded as 2026-10-03.

CHECKS
- K1 Structure recount → PASS. `^| T-` = 33, `^| L-` = 8 (41 rows); `^| DR-` = 21. Every [R] in the threat tables goes through a DR id (0 bare [R]). All of DR-01..DR-21 are defined once and referenced at least once. The claim at :5 holds.
- K2 STRIDE 6/6 and LINDDUN 7/7 → PASS. KICKOFF §5 P1.3 scope (CBS B1, signer B2, nodes/RPC B3, operators B4, supply chain B5) → PASS.
- K3 Label recount (awk over the detection column). Rows with no [R]/[X]: T-S5 [P], T-T4 [P][I], T-E4 [P], T-D3 [A], T-D4 [A], T-SC3 [I], L-1 [I], L-5 [I]. The [P] rows are control-bug sub-risks → PASS under MC-41. T-D3/T-D4 are non-blind [A] → PASS on substance, but the cited authority does not resolve (D5). T-SC3 → FAIL (D7). L-1/L-5 → DISMISSED (C12).
- K4 R3 defects re-traced. D1 (T-B2 hash from TR provider) → PASS on independence: DR-18 now compares a CBS-computed digest with the TR-reported digest. The tracking reference is wrong (D5). D2 (L-4 label) → PASS: :118 puts the memo table under "Preventive (not a detection)", detection [R] DR-21 + [P]; matches RISK_REGISTER:58 6c. D3 (POPIA) → PASS: :111 attributes every POPIA statement to KICKOFF and Q-R12 (OPEN_QUESTIONS:68, exists).
- K5 Arc facts re-fetched 2026-10-03 (raw curl) → PASS.
  - C-01: live eth_chainId 0x4cef52 = 5042002.
  - C-66: https://docs.arc.io/arc/references/evm-differences.md :23 "hard fork as its baseline, including features such as EIP-7702 (set-code"; :105.
  - C-67: https://docs.arc.io/integrate/relayers-and-paymasters/eip-3009-relayer.md :40 "signed data; the user never sends a transaction."; :46 `name` `USDC`; :47 `version` `2`; :49 `verifyingContract` 0x3600…0000. Live: name() on 0x3600 → "USDC"; version() → "2"; DOMAIN_SEPARATOR() → 0x3611…c6b0; nonces(addr) → 0 (EIP-2612 surface present).
  - C-62 / CallFrom: https://docs.arc.io/arc/concepts/transaction-memos.md :36 "as `msg.sender` for the target call"; :99 "The `CallFrom` precompile preserves the signing EOA as `msg.sender`".
  - C-65: https://docs.arc.io/arc/references/contract-addresses.md :342 Permit2 row verbatim; :266-267 "you need to grant a USDC allowance to the Permit2 contract".
  - C-64: https://docs.arc.io/arc/concepts/opt-in-privacy.md :29 "Privacy features are on the roadmap and not yet available on Arc."
  - C-27: https://docs.arc.io/integrate/exchanges/deposits.md :289-292 "`tx.from` is the relayer's address. Crediting from it assigns the deposit to the relayer, not the depositor."
  - C-30/C-33: https://docs.arc.io/arc/references/gas-and-fees.md :36 "EIP-1559 + EWMA smoothing", :38 "Minimum base fee (testnet) | 20 Gwei". Live: latest baseFeePerGas 0x4a817c800 = 20,000,000,000; extraData 0x00000004a817c800 = 20,000,000,000; eth_feeHistory over 1,025 blocks gives min = max = 20 gwei.
  - C-57 (DR-11 premise) reproduced live: value 0 from C-55 0x7099…79C8 → {"code":-32603,"message":"Blocked address"}. Value 0 from an empty random EOA 0x5a3b…f203 (balance 0x0, code 0x) → "0x". Value 1 from the same EOA → {"code":-32003,"message":"revert: OutOfFunds"}. So the value-0 probe gives the healthy "0x" on empty wallets, as DR-11 says. Side observation for constants: value 0 from an EOA *to* C-55 returned -32003 "out of gas: invalid operand…", not -32603, because C-55 has delegated code. DR-11 relies only on the from-side signal, so it is unaffected.
  - C-57 note (DR-14 premise): live eth_getCode(C-55) = 0xef0100b8b08cdb4ed6e011b630c24e3f382a57ef22138e, so a 7702 delegation is observable.
  - DR-15 signal: live eth_getLogs on 0x3600, topic0 0x8c5be1e5…c3b925 (Approval), last 2,000 blocks → 802 logs, 3 topics each (owner and spender indexed). The signal is real, but no constants/OQ row records it (D4).
- K6 Numbers recomputed (python integer divmod) → PASS.
  - p=6, k=10^12: 0→(0,0); 1→(0,1); 999,999,999,999→(0,999,999,999,999); 10^12→(1,0); 10^18→(1,000,000,0); 1,234,567,890,123,456,789→(1,234,567, 890,123,456,789).
  - uint256 max 2^256−1 → m = 115792089237316195423570985008687907853269984665640564039457584007, dust 913,129,639,935.
  - p=2, k=10^16: 1,234,567,890,123,456,789→(123, 4,567,890,123,456,789); k−1→(0,k−1).
  - Every row satisfies m·k + dust = w. T-T5 "1 USDC = 10¹⁸ wei" holds. DR-06 mutant residual for A = 1 USDC at p=6: 10^18 − 10^12 = 999,999,000,000,000,000 wei ≠ 0. 21,000 × 20 gwei = 420,000,000,000,000 (CONTRACT §6.1).
- K7 DR re-trace (every mutant), MC-40:
  - DR-01 → FAIL (D1).
  - DR-02 → PASS. A fabricated log in one RPC response differs from the other source. Q-A12 caveat noted at T-S2 (C3).
  - DR-03 → PASS for the stated mutant: a changed `to` changes the recomputed digest at CONTRACT:75. Replay gap: D6.
  - DR-04 → PASS for the stated mutant (address swap). Other T-T2 sub-risks: D8.
  - DR-05 → PASS. A resend under the same key with an edited payload → CONFLICT from the CBS (CONTRACT §1.4), an input independent of the adapter. A pre-first-send edit is also caught by DR-06.
  - DR-06 → PASS with caveat (C4).
  - DR-07 → PASS. A non-G1..G7 leg is visible in the CBS's own listJournals. A duplicate T2 leaves G5 below Σ heldAmount (CONTRACT §5.7 itemisation).
  - DR-08 → PASS.
  - DR-09 → PASS. The pattern half catches a logged token, the canary half catches use.
  - DR-10 → PASS for the pager mutant. FAIL as used by T-S4 (D2).
  - DR-11 → PASS (live, K5).
  - DR-12 → PASS (C5).
  - DR-13 → PASS. A drain from a stolen key has no signing-log entry, and CONTRACT:187 rule 2 PAUSEs.
  - DR-14 → PASS (live 0xef0100…).
  - DR-15 → PASS on mechanism. EIP-2612 permit and approve-in-Memo (CallFrom keeps the bank as msg.sender) both emit Approval(owner = bank) on 0x3600. Permit2 needs a prior 0x3600 allowance, which emits Approval. Citation fails (D4).
  - DR-16 → PASS on the stated mutant (C6).
  - DR-17 → FAIL in part (D3).
  - DR-18 → independence PASS; references FAIL (D5).
  - DR-19 → PASS. DR-20 → PASS. DR-21 → PASS (SHA-256(accountRef) equals the scanner-computed hash).
  - Labels agree with RISK_REGISTER v3 by construction: RR maps to DR ids (RISK_REGISTER:5).
- MC-03 → PASS (K6). MC-04, MC-06, MC-10..MC-13, MC-46, MC-47 → N/A (CONTRACT properties; no TM claim contradicts them except DR-18's next state, D5).
- MC-21 → PASS for every Arc value in the TM: C-01/12/26/27/28/30/31/33/40/41/42/51/53/57/62..67 all exist (grep: 1 row each) and were re-derived in K5. The one exception is the DR-15 signal (D4).
- MC-41 → FAIL (D4 signal citation, D7 T-SC3 coverage, D8 T-T2 sub-risks).
- MC-42 → PASS (`grep -c SIGNED-OFF` = 0).
- MC-43 → PASS. No regulatory statement is unsourced: POPIA → Q-R12; s72 → Q-R12; FAIS → KICKOFF §8 pointer only.
- MC-44 → FAIL (D5). Every other id resolves: Q-A5/A12/C10/P1/R12/T3/T4 exist (grep 1 each); P1.7, P7.2, P7.3, P8.1, P8.3, P8.4, P11 exist in cbs-port-requirements.md (:31, :105, :106, :114, :116, :117, :138); ADR-002 rule 5 (IPC) and option B (two own nodes) match; constants M-5 and M-8 match T-T5; MC-19/20/23/32/34/40 match; CF-2 matches LEDGER:38; "see LEDGER" at :3 now resolves (LEDGER:29 records the reframe).
- MC-45 → PASS for the ADRs. ADR-001 Context 1-3 matches T-T1/T-E5 and DR-13. ADR-002 rules 2 and 5 match L-3 and T-I1. ADR-004 phase table names DR-18. ADR-005 testnet canary names DR-17. ADR-006 random memoId matches L-4. Fail-closed is stated for screening (T-B1/ADR-005), TR (T-B2), CBS (T-D3) and nodes (T-S2/T-D2). TM↔CONTRACT inconsistencies are counted under D1/D5.
- MC-01/02/05/07/08/14..20/22..24/30..34/48 → N/A (code, Phase 2). The TM text for MC-23 (T-E5) and MC-24 (T-T1) is consistent with the rubric [inspection-only].
- JL-1 fail-closed → [inspection-only] PASS. Every DR outcome is PAUSE, QUARANTINE or refusal. DR-01 over-fires (D1).
- JL-2 → [inspection-only] PASS. Residuals 1-5 go to the human at G1.
- JL-3 → [inspection-only] PASS with notes: DR-01 as written pages on every internal move (D1); DR-16 would alert under congestion (C6).
- JL-4 → [inspection-only] PASS, conditional on Q-C10 (residual 4).
- JL-5 → [inspection-only] PASS.
- JL-6 → [inspection-only] PASS (L-3, L-4, DR-19/20/21).
- Probe G (would the rubric pass a bad version of this TM?) → YES. MC-40 accepts a detection that names a mutant and an "independent input", even when (a) no CONTRACT/ADR interface delivers that input (DR-01: no CBS instruction read exists) and (b) its healthy path fires on legitimate flows (DR-01 on internal moves and case returns; DR-16 under EWMA congestion). MC-24 also passes a signer that accepts the same approval twice (D6). Proposed patch (for the rubric owner, not applied): MC-40 adds "the independent input is reachable through an interface defined in CONTRACT or an ADR, or a tracked CF; and the detection's healthy-path result is stated and does not fire on any legitimate flow". MC-24 adds "an approval (payloadHash) is signed for at most one nonce".
- Probe F (would the rubric fail a good version?) → YES. MC-41 as worded ("every named sub-risk maps to an [R] or [X]") fails a good TM that gives accepted inherent residuals (L-1, L-5) [I] and non-blind operational threats (T-D3, T-D4) [A]. That relaxation exists only in P1-threat-model-lensR-3.md:44 and RISK_REGISTER:7 ("Every blind sub-risk"), not in RUBRIC v2. Proposed rewording: "Every blind sub-risk …; non-blind ones may use [A] against a named baseline; inherent residuals accepted at G1 may carry [I]". Applied here as a relaxation.
- Regression of frozen units → N/A by reconstruction: `grep -c "| frozen" docs/LEDGER.md` = 0.

CANDIDATES
- C1 · THREAT_MODEL.md:130 DR-01 "U12 joins every signing-log entry to the **CBS's own** instruction record (`submitPayoutInstruction` as stored by the CBS) and approval record, read by U12 directly from the CBS"; CONTRACT.md:141-156 (the complete adapter→CBS op list) has no operation that returns CBS instruction records (submitPayoutInstruction is CBS→adapter only, :162); CONTRACT.md:349 internal moves "sign (signing log)" with approval only "above threshold"; CONTRACT.md:336 case returns "the signer verifies and signs (signing log)"; LEDGER.md:34-38 CF-1..CF-5 contain no such op; RISK_REGISTER.md:35 RR-3a relies on DR-01 alone · MC-40 (re-trace), MC-41, MC-45 · REAL (blocking).
  - (a) The input cannot be obtained under CONTRACT v3, and no CF tracks the missing op.
  - (b) As written, "every signing-log entry" includes internal moves and case returns, which have no submitPayoutInstruction record. Every gas top-up, sweep and case return would therefore PAUSE.
  - Re-trace of the invented-instruction mutant without DR-01: hold + approval + T4 all succeed. DR-13 matches the adapter's own instruction row. DR-06 balances (chain −A·k, CBS_G2 −A). DR-07 keys match. So nothing else catches it.
  - Severity differs from R3 D1 (minor), which had an [X] backstop. Here DR-01 is the only detection for a Critical-impact blind sub-risk.
- C2 · THREAT_MODEL.md:42 T-S4 "[R] DR-10 (an attribution error makes the balance-delta check unexplained)" · MC-40 re-trace · REAL (minor). DR-10 (:139) compares per-address balance(end) − balance(start) with Σ indexed logs − gas. Using tx.from (the relayer) instead of the log `from` changes who is screened or credited, not which logs are indexed to the bank address or their amounts. The delta still matches, so the mutant is not caught. The [P] U4 relayed-transfer fixtures remain the valid detection (control-bug sub-risk).
- C3 · THREAT_MODEL.md:131 DR-02 independence "A second source (own node vs reference)" vs constants C-04/C-68 (the reference relays feed our node) · MC-40 · DISMISSED. The stated mutant (a fabricated log in one RPC *response*) is caught. Relay-level fabrication depends on Q-A12, which T-S2 (:40) already discloses.
- C4 · THREAT_MODEL.md:135 DR-06 "Conversion uses ×10⁶ instead of ×10¹² → CBS_G2×k ≠ chain" vs CONTRACT §1.1 "both of its sides use the same k" · MC-40 · DISMISSED with caveat. If U12 computes CBS_G2×k through the same mutated function, the outbound part cancels. Inbound balances (m computed by division) still expose it: residual ≠ 0 once any inbound exists (K6: 999,999,000,000,000,000 wei per USDC). A uniform-k error is covered by RD-01 and the [P] U1 tests (:52).
- C5 · THREAT_MODEL.md:141 DR-12 "(F4)" vs SEQUENCES.md:327 F4 triggers only on "no receipt after T_pending" · MC-40 · DISMISSED. If a drain consumes nonce n while we are idle, our next tx at n gets no receipt. F4 then finds "nonce used by a hash we do not know" (:335) → PAUSE. DR-13 catches the drain immediately anyway.
- C6 · THREAT_MODEL.md:145 DR-16 "Compare the configured fee floor with the observed base fee" vs gas-and-fees.md:36 "EIP-1559 + EWMA smoothing" (the base fee legitimately rises above the floor) · MC-40, JL-3 · DISMISSED (note). The stated mutant (floor raised; observed ≥ new floor ≠ 20 gwei) is caught. Live: 1,025 blocks all at 20 gwei. Congestion would also raise the alert, but T-N2 is non-blind (sub-floor txs are dropped and handled by F4), and the action is an alert plus "no signing below observed". Wording hint: compare against the minimum observed over a window.
- C7 · THREAT_MODEL.md:146 DR-17 "The screening list goes stale or empty → canary returns CLEAR → PAUSE" · MC-40 re-trace · REAL (minor). A fixed canary drawn from the list is still present in a stale (not updated) list, so it returns HIT and nothing fires. Only "empty or wiped" is caught. Staleness is caught by the [X] at :96 (list version and hash vs the publisher), so coverage holds, but the DR's mutant claim is false for "stale".
- C8 · THREAT_MODEL.md:144 DR-15 signal "`Approval` log on `0x3600…` or Permit2" · MC-41 "Every detection signal is cited in constants.md or OPEN_QUESTIONS", CLAUDE.md N5 · REAL (minor). `grep Approval docs/constants.md docs/OPEN_QUESTIONS.md docs/sources/arc/*.md` → 0 hits. Live evidence exists (K5: 802 Approval logs, topic0 0x8c5be1e5…). [inspection-only, not re-fetched] Permit2's own events are `Approval(owner, token, spender, amount, expiration)` (different topic0) and `Permit`, and SignatureTransfer emits neither. The 0x3600 precondition still catches it, but the "or Permit2" half needs its own signal or should be dropped.
- C9 · THREAT_MODEL.md:14 "[A] … Allowed only for **non-blind** threats (rubric R3 Probe F relaxation)"; :147 DR-18 "**Needs the CONTRACT change in LEDGER CF-4**"; :159 "needs `originatorDigest` from the CBS (CF-4)"; vs P1-rubric-lensR-3.md:83-85 (rubric R3 Probe F is about MC-12(b)/MC-05, not [A]); LEDGER.md:36 CF-4 (inbound TR check, R5 000 tier, counterparty DD: no originatorDigest); LEDGER.md:35 "CF-5 … (e) DR-18 needs `originatorDigest`"; and DR-18 next state "HELD_FOR_CASE, no signature" vs CONTRACT.md:290 "ineligible, or TR hash changed | T5 (condition 1), case | RELEASED" and the CONTRACT field name `payloadHashTR` (:150) · MC-44, MC-45 · REAL (minor). There are three non-resolving references and one cross-document state conflict.
- C10 · THREAT_MODEL.md:48 T-T1 "The signer re-verifies `payloadHash` and the checker's FIDO2 `checkerAssertion`"; :132 DR-03; ADR-001 Context 1; CONTRACT.md:289 and :336. None of them limits an approval to one use · STRIDE completeness at B2 (KICKOFF §5 P1.3 "signer"), CLAUDE.md exactly-once · REAL (minor). The challenge is the fixed payloadDigest (CONTRACT:75), so a compromised orchestrator can re-submit an old (instructionId, destination, amount) with its stored assertion at a new nonce, and the signer verifies it again. Detection exists after the fact: CONTRACT:187 needs a match "in BROADCAST" (the old instruction is SETTLED), and DR-06 shows the chain falling with no CBS debit. Prevention is missing: "a payloadHash is signed for at most one nonce; F4 replacement re-signs only at that nonce".
- C11 · THREAT_MODEL.md:104 T-SC3 detection "[I] Session review" for a blind threat · MC-41; RISK_REGISTER.md:7 "Every blind sub-risk has at least one [R] or [X]" · REAL (minor). Applicable detections already exist (RD-04 re-fetch and diff against the SHA-256-pinned archive; fresh-context verifier reconstruction; human gates [X]) but aren't labelled.
- C12 · THREAT_MODEL.md:115 L-1 and :119 L-5 "[I]" vs RISK_REGISTER.md:75 RB-2 "[X] Merchant disclosure sign-off (L-7)" · MC-40 label agreement, MC-41 · DISMISSED. These are inherent properties of a public chain, not failure events (Probe F relaxation). L-1 already routes to L-7 (:115 "disclosure (L-7)"), whose [X] (:121) is what RB-2 cites.
- C13 · THREAT_MODEL.md:49 T-T2 "deposits credit the wrong customer, or a 'bank-owned' flag is forged" vs DR-04 (:133) input "Signer derivation" and mutant "address swapped" · MC-41 · REAL (minor). Re-derivation checks only the address column. An accountRef swap, or a bank-owned flag on an unchanged address, re-derives cleanly. The only remaining check is the registry hash chain, whose anchor is not stated to be outside B6 (cf. DR-05 "anchored at the previous checkpoint"). An attacker with store write access rewrites rows and links consistently. A flag forgery routes a customer deposit to T8 (G7), which DR-06 does not see (G2 rises either way).
- C14 · No B6 availability/loss threat (store loss or ransomware) although KICKOFF §6 lists immutable backups · KICKOFF §5 P1.3 / STRIDE-D · DISMISSED. Loss of outbox or sub-ledger state surfaces as a non-zero DR-06 residual (lost Rin/Rout items) → PAUSE. Registry addresses are re-derivable (DR-04). Backups belong to U15. Hint only.

DEFECTS
- D1 · docs/THREAT_MODEL.md:130 (DR-01), also :39 T-S1, :82 T-E2 · Lens R / MC-40 re-trace, MC-41, MC-45 · **blocking**. Required:
  - add a CF (CONTRACT read op, e.g. `getInstruction(instructionId)` / `listInstructions(cutoff)` returning the CBS-stored submitPayoutInstruction record) and cite it, as was done for DR-18;
  - scope DR-01 to outbound entries;
  - join case-return entries to the CBS's `CaseDisposition` record (caseId, dispositionSeq, returnAmount, returnDestination);
  - join internal moves to the treasury approval or policy record, or state that they are covered by DR-13 + RD-03 instead.
- D2 · docs/THREAT_MODEL.md:42 (T-S4) · Lens R / MC-40 · minor. Remove "[R] DR-10 (an attribution error …)", or replace it with a detection that actually depends on the sender, e.g. a fixture or reconciliation comparing the screened address with the system-log `from`.
- D3 · docs/THREAT_MODEL.md:146 (DR-17) · Lens R / MC-40 · minor. Either drop "stale" from the mutant, or make the canary the publisher's most recently added entry each cycle (then a stale list misses it).
- D4 · docs/THREAT_MODEL.md:144 (DR-15) · Lens R / MC-41 signal citation · minor. Add a constants row (or OQ) for the ERC-20 `Approval` event on 0x3600 (topic0 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925; live evidence above). Fix or remove the Permit2 half (Permit2's own `Approval`/`Permit` signatures, uncited).
- D5 · docs/THREAT_MODEL.md:14, :147, :159 · Lens R / MC-44, MC-45 · minor.
  - ":14 rubric R3 Probe F" → cite P1-threat-model-lensR-3.md Probe F, or get the relaxation adopted into RUBRIC MC-41.
  - "CF-4" → CF-5(e) (LEDGER:35).
  - Reconcile DR-18's outcome (HELD_FOR_CASE) with CONTRACT:290 (RELEASED). Reconcile `originatorDigest` with CONTRACT's `payloadHashTR`: say whether it replaces or adds to that field.
- D6 · docs/THREAT_MODEL.md:48 (T-T1), :85/:82 (T-E2) · Lens R / KICKOFF §5 P1.3 (signer boundary), CLAUDE.md exactly-once · minor. Add approval replay as a threat or a sub-clause. Preventive control: the signer refuses a payloadHash already in its signing log at a different nonce. Detection: CONTRACT:187 "in BROADCAST" + DR-06.
- D7 · docs/THREAT_MODEL.md:104 (T-SC3) · Lens R / MC-41 · minor. Give the blind threat an [R]/[X] (RD-04 re-fetch and diff, verifier reconstruction, G-gate human review), or argue in the row why it is non-blind.
- D8 · docs/THREAT_MODEL.md:49 (T-T2), :133 (DR-04) · Lens R / MC-41 · minor. State an independent input for the accountRef and bank-owned columns. Options: hash-chain head published outside B6 (e.g. to the CBS or WORM storage) at each checkpoint, or a periodic join of the registry against a CBS-held address↔accountRef record. Give a mutant (accountRef swapped on an unchanged address).

Cross-unit items (not counted against this unit):
- X1 · RUBRIC.md:80-81 MC-40/MC-41: Probe G and Probe F patches above.
- X2 · constants.md C-57: add the observation that a value-0 call *to* C-55 returns -32003 because of its delegated code, so to-side blocklist detection at value 0 is unverified for code-less targets.
- X3 · RISK_REGISTER.md:35 RR-3a depends solely on DR-01 (D1). RISK_REGISTER.md:79 RB-6 already cites CF-5(e) correctly.
- X4 · SEQUENCES "both sources" (CF-2) still open (SEQUENCES.md:122, :161, :307, :328).

VERDICT: NEGATIVE (8 defects: 1 blocking, 7 minor)
