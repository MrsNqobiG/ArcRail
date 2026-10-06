<!-- Saved by the main agent with the Write tool, verbatim from the verifier's returned output. The verifier could not write it: the PreToolUse guard (rule 2, broadcast detection) matched words in the report text inside a Bash heredoc. See OPEN_QUESTIONS Q-T7. -->

VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md, sha256 f22757d0…71eed8d), re-verification R2 after fix block 1 · commit: none (no HEAD; uncommitted working tree, verified 2026-10-02/03)

CHECKS
- K1 Structure (mechanical checks plus judgment lenses with one-line anchors) → PASS. I recounted by grep: 36 MC rows (MC-01..08, 10..24, 30..34, 40..47) and 6 JL rows, each a single-sentence question.
- K2 Ledger count agreement → FAIL. LEDGER.md:28 still says "M-01…M-43 + J-1…J-6 … draft … R1 pending". Round 1 (NEGATIVE) and fix block 1 are not logged, although RUBRIC.md:119 says every change is "logged in LEDGER under P1-rubric". See D8.
- K3 Arc constants, re-fetched with curl on 2026-10-02 → PASS.
  - rpc-endpoints.md:64 "| **Chain ID (Testnet)** | `5042002` |"; :98 "Block range limit: 10,000 blocks"; :108 "≤9,999-block chunks"; :43-44 "safely retry requests that return `-32014` after a brief backoff".
  - evm-differences.md:203 "**The minimum base fee is 20 Gwei.**"
  - usdc-system-events.md:35-36 give the emitter and `0x3600…` with 18 and 6 decimals; :39 says a transfer emits "**two** logs".
  - transaction-memos.md:22 gives the Memo contract `0x5294E992…e505`.
  - `-32602` and `-32603 "Blocked address"` appear on none of these pages (grep exit 1). That matches C-41 and C-57, which mark them as undocumented.
  - gas-and-fees.md:126 documents a `transaction underpriced` error at send time.
- K4 MC-03 conversions recomputed by integer divmod → PASS.
  - p=6: 0, 1, k−1, k, 10^18, 1.0000005 USDC, 420,000,000,000,000 (= 21,000 × 20 gwei), 7,374,356,000,000,000, and the signed 64-bit maximum.
  - p=2: 10^18, 1.5·10^16, 10^16−1, and the same gas fee.
  - Native → ERC-20: 1,234,567,890,123,456,789 gives (1,234,567, 890,123,456,789).
  - The uint256 maximum round-trips exactly.
  - All values match CONTRACT.md:399-418.
- K5 MC-04 CBS identity, all 13 template rows re-traced → PASS.
- K6 MC-10 keys recomputed → PASS. Case variants and delimiter variants give different keys; keys are 69 characters; the case-return ID `cr-a10731e69584dabdb073ba9c79c1ae34` is 35 characters.
- K7 Probe G arithmetic re-traced on the v3 identity → PASS. The residual is −A·k, as stated.
- K8 Probe F patch 2 (exclusions file named, flagged for human acknowledgement at G1, 2 of 2 patches used) → PASS.
- K9 Every § and ID reference in RUBRIC.md resolves → PASS. MC-47's reference target is too coarse (D5).
- K10 MC-23 against THREAT_MODEL.md:71 T-E5 → PASS. Round-1 D1 is closed.
- K11 KICKOFF §3 exit bars → FAIL. MC-05 is weaker than "drift exactly 0 … in every test scenario" (D1), and nothing checks the compliance-matrix evidence columns (D9).
- K12 Money-path closed list → FAIL. U7 and U3 are missing (D2).
- K13 MC-12 against the round-1 D3 fix and contract R2 Probe G (b) → FAIL (D3).
- K14 MC-11 outcome list → FAIL, minor (D4).
- K15 Every verifier probe proposal folded in → FAIL. I re-traced them all. Contract R2 G(b), "every reconciliation pending term has a maximum age", is absent and not listed as rejected.
- K16 Round-1 defects:

  | Defect | Status | Where it stands |
  |---|---|---|
  | D1 | Closed | |
  | D2 | Partly closed | See D4 |
  | D3 | Partly closed | See D3 |
  | D4 | Partly closed | See K15 |
  | D5 | Partly closed | See D2 |
  | D6 | Closed | |
  | D7 | Closed | |
  | D8 | Closed | |

- K17 MC-42 → PASS. K18 MC-20 → PASS.
- K19 Rubric against RISK_REGISTER → FAIL, minor. RB-5 says "Re-fetch every cited page … (MC-21)", but MC-21 only re-fetches "every **inline** quote" (D6).
- K20 Probe G re-run (would a bad build pass?) → FAIL, three ways:
  - (i) U11 skips gas on status-0 receipts. The residual becomes −g, reconciliation pauses, and MC-05 still passes.
  - (ii) U7 uses `Number()` or calls an LLM risk scorer and passes MC-01, MC-07, MC-08 and MC-34.
  - (iii) The §5.8 rows for Rout/Rmove and for D/F ≥ k are deleted and MC-12 still passes.
- K21 Probe F re-run (would a good build fail?) → FAIL. MC-34's fixed endpoint list fails a correct U10 that calls the signer or custodian, OpenTelemetry or OpenBao (D7).
  - MC-12, read literally, also flags outbound SCREENING and the item-level PAUSED state in CONTRACT v3. That is a correct catch against the contract, not a rubric defect, so I routed it to P1-contract.
- K22 Regression check of frozen units → N/A. LEDGER lists no frozen units.

CANDIDATES
- C1 · RUBRIC.md:38 "Reconciliation residual = 0 wei, or PAUSE, for every (state × outcome) cell" vs KICKOFF.md:44 "drift of exactly 0 base units … in every test scenario" · §3 exit bar, Probe G · REAL. In v3, failure cells already keep the residual at 0 through itemisation (CONTRACT.md:101). "or PAUSE" therefore only hides bugs (K20 i).
- C2 · RUBRIC.md:16-25, the closed list without U7 or U3 · KICKOFF §3, CLAUDE.md N4, round-1 D5 "at least U1, U3, U4, U6, U7…" · REAL. CONTRACT.md:261 "RESERVED | policy DENY → T5" shows the policy engine makes money decisions. MC-01, 07, 08 and 34 are all scoped by this list.
- C3 · RUBRIC.md:48 "Every non-terminal state … List the states from §5 and diff against the §5.8 rows" vs round-1 D3 fix "…and every §5.6 term is among them" and P1-contract-lensR-2.md:64 (b) · Probe G, contract R2 N3 defect class · REAL. CONTRACT.md:371 (Rout/Rmove) and :373 (D/F) are not states. RUBRIC.md:123 "Rejected proposals: none" is therefore false.
- C4 · RUBRIC.md:47, MC-11's outcome list has no send-time result and no "nonce consumed by another of our transactions" · constants M-4 "Treat RPC rejection … as normal outcomes", Q-A13 · REAL, minor. A_broadcast and A_stuck already end in PAUSE as a backstop.
- C5 · RUBRIC.md:85 "Diff the classes in §5.0 against the §5.2 matrix" · contract R3 E2 · REAL, minor. §5.0 has only internal, outbound and inbound, so dropping the bank-owned inbound row from §5.2 still passes.
- C6 · RUBRIC.md:61 "re-fetches every inline quote" vs RB-5 · MC-45 · REAL, minor.
- C7 · RUBRIC.md:73 "no network calls except to the declared CBS, nodes, screening and TR endpoints" · Probe F · REAL, minor.
- C8 · LEDGER.md:28 is stale vs RUBRIC.md:119 · KICKOFF §4 · REAL, minor.
- C9 · MC-42 and MC-43 check only statuses and quotes · KICKOFF.md:48 file:line and evidence columns · REAL, minor.
- C10 · Should U8 be on the money-path list? · DISMISSED. The screening and travel-rule gates run inside U6 and U10, which are on the list.
- C11 · MC-15 vs pre-Zero5 backfill (C-26) · DISMISSED. Backfill only; a new rail has no pre-Zero5 deposits.
- C12 · MC-22 might hard-code 20 gwei · DISMISSED. "read from chain parameters" covers it.

DEFECTS
- D1 · RUBRIC.md:38 MC-05 · R / KICKOFF §3, Probe G · blocking. Require a residual of exactly 0 in every cell, and require the test to check the cell's next state. A non-zero residual is allowed only in scenarios that inject drift, and there PAUSE must fire.
- D2 · RUBRIC.md:16-25 · R / KICKOFF §3, N4 · blocking. Add U7 (limits, thresholds, cross-border flag, allow-lists) and U3 (quorum, disagreement, paging) to the list.
- D3 · RUBRIC.md:48 MC-12 and :120-123 · R / Probe G, contract R2 G(b) · blocking. Require an age row and a PAUSE for every pending term: Rin, Rout, Rmove, D[r], F[r], the G5/G4 items and outstanding notifications. Credit the proposal, or list it as rejected with a reason.
- D4 · RUBRIC.md:47 MC-11 · minor. Add send-time outcomes (`transaction underpriced`, `-32603 "Blocked address"`, `-32014`), "same-nonce replacement or cancel is final", and "nonce used with no receipt for our hashes".
- D5 · RUBRIC.md:85 MC-47 · minor. Derive the class set from the branches of §5.3–§5.6, not from §5.0.
- D6 · RUBRIC.md:61 MC-21 · minor. Re-fetch quotes both inline and in constants.md.
- D7 · RUBRIC.md:73 MC-34 · minor. Use a declared egress allow-list that includes the signer, the telemetry collector and the secret store.
- D8 · docs/LEDGER.md:28 · minor. Update the IDs and counts and record the round-1 verdict, fix block 1 and this verdict.
- D9 · RUBRIC.md:80-81 · minor. Add a check that every IMPLEMENTED or EVIDENCED compliance row has a file:line that resolves and a test or evidence item that exists.

VERDICT: NEGATIVE (9 defects: 3 blocking, 6 minor)
