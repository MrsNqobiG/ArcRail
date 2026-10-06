VERIFICATION · lens: R · target: P1-contract (docs/CONTRACT.md) · commit: none (no commits in repo; working tree, CONTRACT.md sha256 3ee19c14518eee2ee42f248ea562e322243e2928a9db2098dcf6e19918588b63, 2026-10-02)

Criteria (docs/RUBRIC.md does not exist yet): KICKOFF_PROMPT.md §5 Phase 1 item 1; CLAUDE.md non-negotiables and money invariants; docs/discovery/cbs-port-requirements.md (P1-P11); docs/constants.md (C-xx). Phase 0 inputs are still unverified (LEDGER G0 note).

CHECKS:
Prior defects (docs/verification/P1-contract-lensR.md), each re-checked:
- D1 keys for every keyed op → PASS. 9 keyed ops in §3 (postJournal, placeHold, releaseHold, settleHold, screen, createCase, submitMonitoringEvent, requestApproval, fileReportData), recounted. Each maps to a K row in §1.3 (CONTRACT.md:33-50) or to a T-template key.
- D2 internal moves double-booked as T1 → PASS. The from/to classification table (CONTRACT.md:136-143) says: "bank-controlled | bank-controlled | internal | ... **No T1 or T8.**"
- D3 release on "dropped" → PASS. CONTRACT.md:161-168 has three exhaustive release grounds, and :166 says "'dropped' or 'timed out' are **not** grounds for release". See new defect N2 for the hold-expiry side of the same risk.
- D4 lowercase and pipe-join collisions → PASS. JCS arrays, case-preserving regex (CONTRACT.md:26, :30). Recomputed with Python: key(["arc1","out","Ab","reserve"]) != key(["arc1","out","ab","reserve"]); key([...,"a|b","move"]) != key([...,"a","b|move"]).
- D5 lookup by key covers postings only → PASS. getResultByKey covers every keyed op (CONTRACT.md:67, :99). Residual gap in N4.
- D6 when D accrues → PASS. CONTRACT.md:145 "Local commit at detection ... in **one local transaction**". Re-traced: chain +W = D +(W mod k) + Rin +⌊W/k⌋k. On T1 OK, Rin −x and CBS_G2·k +x.
- D7 G7 outside scopes → PASS. P8.3 and P10.1 now say "G1–G7 (G7 added by CONTRACT §2)".
- D8 payloadHash serialisation → PASS. JCS, string values, lowercase destination (CONTRACT.md:55). Computed a sample hash d53173f5…cd54 deterministically. The two field orders at :55 and :107 are equivalent under JCS key sorting.
- D9 zero-amount inbound → PASS. "Dust-only inbound" (CONTRACT.md:153) posts no journal, and all of W goes to D.
- D10 truncated tx hash → PASS. The full hash is at CONTRACT.md:258. Re-ran live on 2026-10-02 at https://rpc.testnet.arc.io: eth_getTransactionReceipt gave status 0x1, gasUsed 167,599, effectiveGasPrice 44,000,000,000. 167,599 × 44×10⁹ = 7,374,356,000,000,000, which matches. Log 0 from 0xffff…fffe has value 9,176,065×10¹², and log 1 from 0x3600… has value 9,176,065. The factor of 10¹² is confirmed live.
- D11 submitPayoutInstruction response → PASS (CONTRACT.md:118: OK/CONFLICT/REJECTED with 5 codes).
- D12 G5 normal side → PASS ("Credit", CONTRACT.md:83).
- D13 P5.3/P6.6/P8.4 traceability → PASS. replayEvents :112, fileReportData :111, callId :27/:93, Q-R1 in §7.

Rubric (KICKOFF Ph1.1, CLAUDE.md), by reconstruction:
- K1.1 every call/event has a schema → [inspection-only] PASS. §3 has 16 ops and §4 has 7 names (recounted).
- K1.2 idempotency keys → PASS for coverage (see D1). FAIL for uniqueness across repeated business events (N1, N8).
- K1.3 error semantics → FAIL. 4 result classes and 12 REJECTED codes (recounted). Unknown code → AMBIGUOUS. But REJECTED after on-chain finality has no defined action (N3), and the getResultByKey REJECTED state is unmapped (N4).
- K1.4 GL roles (customer liability, treasury, gas, suspense/dust, clearing) → PASS: G1-G5, plus G6 and G7 (CONTRACT.md:79-85).
- K1.5 key length: "arc1-" + 64 hex = 69 → PASS. Computed: arc1-58b8afe7…7807, length 69.
- K1.6 unit mapping, recomputed with exact integer // and %, k = 10^(18−p):
  p=6: 0→0 r0; 1→0 r1; 999,999,999,999→0 r999,999,999,999; 10¹²→1 r0; 10¹⁸→1,000,000 r0; 1,000,000,500,000,000,000→1,000,000 r500,000,000,000; 21,000×20×10⁹=420,000,000,000,000→420 r0; 7,374,356,000,000,000→7,374 r356,000,000,000; 9,223,372,036,854,775,807,999,999,999,999→2⁶³−1 r999,999,999,999. One wei past the last 10¹² boundary gives m = 2⁶³, which overflows, so the stated maximum is tight. → PASS 9/9
  p=2: 10¹⁸→100; 15×10¹⁵→1 r5×10¹⁵; 10¹⁶−1→0 r(10¹⁶−1); 7,374,356×10⁹→0 r(all) → PASS 4/4
  wei→USDC_UNITS: 1,234,567,890,123,456,789→1,234,567 r890,123,456,789 → PASS
  i64 capacity: (2⁶³−1)/10^p gives 9.223 (p=18), 9.223×10¹² (p=6), 9.223×10¹⁶ (p=2) → PASS
  Extra (not in the doc): uint256 max at p=6 → m far above 2⁶³, so the overflow guard at :243 applies. 3 wei at p=2 → 0 r3.
- K1.7 boundaries (0, 1, k−1, k, max, odd dust) → PASS
- C-01 re-fetched https://docs.arc.io/arc/references/rpc-endpoints.md (2026-10-02) line 64: "| **Chain ID (Testnet)** | `5042002` |" → PASS
- C-10/C-11/C-13 https://docs.arc.io/arc/references/evm-differences.md (2026-10-02) l.81 "a native interface (18 decimals) and an ERC-20 interface (6", l.83 "USDC, divide by 10¹²" → PASS
- C-20/C-22/C-24/C-25 https://docs.arc.io/arc/references/usdc-system-events.md (2026-10-02) l.35, l.39 "emits **two** logs", l.78 "Zero-value transfers emit no log.", l.130 "(`gasUsed × effectiveGasPrice`)" → PASS
- C-53/C-54 evm-differences.md l.121 "reverts with `\"Zero address not allowed\"`", l.128 "still consumes gas" → PASS
- C-15 https://docs.arc.io/integrate/exchanges/deposits.md l.209 "credit the raw 18-decimal value" → PASS
- C-30 evm-differences.md l.203 "The minimum base fee is 20 Gwei." → PASS
- Mint notation CONTRACT.md:143 "`0x0` (mint, C-26 notation)" → FAIL (citation). The notation is in usdc-system-events.md l.71 "**Mint:** `Transfer(0x0, recipient, amount)`". C-26 is the legacy 0x1800 precompile row (N5).
- CBS identity CBS_G2+G3 = G1+G4+G5+G6+G7, re-traced over 12 rows (T1, T2, T3fb, T4, T4fb, T5fb, T6, T7, T8, gas, dust, unid, T9) with G2/G3 debit-normal and the rest credit-normal → PASS
- Chain identity §5.3 re-traced: inbound, outbound (Rout), T9 (Rout), gas (F), dust, T6 (cancels in aggregate S), F3 status 0 (gas only), cancel self-send (no log per C-24, gas only) → PASS as algebra. FAIL as a detector for stale items (N3).
- I-INT (string amounts, regex at :12) → PASS. I-CONV (only U1 converts, :19, :233) → PASS.
- I-FAIL → FAIL (N2, N3). The rest is [inspection-only] PASS: CONFLICT→PAUSE, unknown code→AMBIGUOUS, unexpected HoldChanged→PAUSE, precision mismatch→PAUSE (:18), unmatched outbound/internal log→PAUSE (:141-142).
- N1: read the whole file; the only chain ID literal is 5042002 (:23). The guard blocks grepping for the mainnet ID → [inspection-only] PASS
- N3 (:5) → PASS. P9.1 / no PII (:22, :98, :106, :111) → [inspection-only] PASS
- §7 open items: 12 listed (Q-C1, C16, C3, C4, C5, C7, C8, C9, C14, C2, R1, R3), all present and OPEN in OPEN_QUESTIONS.md → PASS for existence. FAIL for completeness (N7).

CANDIDATES (Lens R pass; listed with Lens A evidence form):
N1 · CONTRACT.md:47 "| `createCase` | `[\"arc1\",\"case\",reason,subjectRef]` |" and :52 "A case disposition of `RELEASE` that re-runs screening increments it" (only `round` in the screen key) · I-ONCE "keys derived deterministically from business IDs" · REAL · After RELEASE re-screening, a second HIT on the same instruction or log gives the same createCase key. With the same payload, the CBS returns the old, already-disposed caseId, so no new case is opened and the flow waits for a disposition that never comes. With different evidenceRefs it gets CONFLICT, then PAUSE. Either way a legitimate second case can't be opened. TRAVEL_RULE_INCOMPLETE (F6 resume) is affected in the same way.
N2 · CONTRACT.md:100 "`expiresAt` must be null, or later than the adapter's pending timeout plus the reconciliation interval (P3.4)" vs :166 "'dropped' or 'timed out' are **not** grounds for release ... It stays under F4 ... until one of the three conditions above holds" and :168 (no-receipt case PAUSED for a human, with no time limit) · P3.4 failure mode "the customer spends the funds again, and the transaction then lands: double spend"; I-CONS · REAL · Under the contract's own T5 rule the hold lifetime is unbounded, yet :100 allows a finite expiry tied to T_pending. A CBS auto-expiry while the tx is in F4 frees the funds and the tx can still land. HoldChanged→PAUSE (:121) only detects this after the fact, and only if events exist (Q-C14).
N3 · CONTRACT.md:63 "REJECTED ... Don't retry. Follow the flow's compensation path"; :198-199 "Rin ... T1 not yet posted", "Rout ... T4 or T9 not yet posted"; :208 "itemised" with no age bound · CLAUDE.md I-FAIL; RR-1/RR-4 [R] detection · REAL · T1, T4 and T9 are posted after on-chain finality, so there is no compensation path. If the CBS returns REJECTED (e.g. ACCOUNT_CLOSED or HOLD_STATE on settleHold), no action is defined. The item stays in Rin/Rout forever, the §5.3 residual stays exactly 0, and nothing PAUSEs. The bank has paid out on-chain without reducing G1, and reconciliation can't see it.
N4 · CONTRACT.md:65 "`APPLIED` → record. `NOT_FOUND` → one more retry with the same key. Unknown or unreachable → **PAUSE**" vs :99 getResultByKey `state:"APPLIED"|"NOT_FOUND"|"REJECTED"` · P1.4/P1.6, I-FAIL · REAL · The REJECTED state has no action. It is also unspecified what happens when the "one more retry" is itself AMBIGUOUS (loop or PAUSE).
N5 · CONTRACT.md:143 "`0x0` (mint, C-26 notation) | bank-controlled | inbound (for example a CCTP mint) | T1, then T8" vs :140 (external→bank: "T1, then T2, T8 or unidentified") and :174 "Without that mark the funds go to `G4.suspense.unidentified`" · I-CONS internal consistency; constants citation · REAL · A mint to a customer-mapped deposit address (CCTP mintRecipient = a customer address) is routed to T8 by the table, but T8 itself sends it to unidentified suspense. The customer is never credited through T2. The row also cites the wrong constant (C-26 is the legacy precompile). The outcome is fail-safe (suspense), so this is minor.
N6 · CONTRACT.md:172 "T7 Customer fee ... added to the T4 journal as `DR G1 F · CR G6 F`" vs :155 "T3 ... `placeHold(G1(accountRef), A)`" · P3.1, I-CONS (G1 ≥ 0, :229) · REAL (conditional on Q-C8) · The hold covers A but settle debits A+F. The customer can spend F while the payout is in flight, so G1 can go negative at settle. That trips the :229 PAUSE (fail-closed), but only after the fact.
N7 · CONTRACT.md:277 §7 list omits Q-C6 and Q-C10, while :155/:159 depend on the P3.5 no-holds fallback (Q-C6) and :107-108 depend on CBS maker-checker binding a payload hash with FIDO2 (Q-C10) · CLAUDE.md N5, traceability · REAL · minor
N8 · CONTRACT.md:177 "`instructionId = \"case:\" + caseId`", :178 "key `…|ret|{caseId}|settle` ... `R ≤ ⌊W/k⌋`, and any remainder stays in G5 under the case" · I-ONCE · REAL · A second RETURN disposition for the remainder reuses the same instructionId and ret key, giving OK-already-applied or CONFLICT. caseId (CBS-assigned) also has no grammar, but it is embedded in instructionId, which must match `^[A-Za-z0-9._:-]{1,128}$` (:26).
N9 · CONTRACT.md:184 "`DR G2.<wallet> ⌊D/k⌋ · CR G4.suspense.dust`" with one scalar D, vs :187 "**one accumulator per paying wallet role**" for F · I-CONS per-role reconciliation (:190) · REAL · minor · D aggregates dust across hot, gas and deposit wallets but posts to one unspecified G2 sub-account. The aggregate check holds, but per-role G2 balances drift.
N10 · CONTRACT.md:147,149,151,155,157,161,170,174,178,184 key shorthand "`…|recv`", "`…|tre|{moveId}|move`", "`…|dust|{batchSeq}`" vs §1.3 "A JSON array of strings has no delimiter ambiguity" · I-ONCE (the D4 regression vector) · REAL · minor · Stale pipe notation invites implementers to rebuild the pipe-joined keys that D4 removed.
N11 · CONTRACT.md:141 "must match exactly one instruction (T4, or F3 if status 0)" for a *log* · I-CONS · DISMISSED · A reverted tx emits no logs, so the status-0 branch can never be reached from a log. F3 is driven from the receipt (SEQUENCES F3), so this is a harmless redundancy.
N12 · CONTRACT.md:55 `"asset"` value encoding in payloadHash · P7.1 · DISMISSED · The only asset value defined in the contract is the literal `asset:"USDC"` (:118), and amountWei = A×k (:158). Two implementations can derive the same hash.
X1 (out of target: P1-sequences) · SEQUENCES.md:200 "getPostingByKey K" / :201 "POSTED" vs CONTRACT.md:65/:99 getResultByKey/APPLIED; SEQUENCES.md:253-257 (no-receipt branch, then `releaseHold T5`) vs CONTRACT.md:168 "the instruction is **PAUSED for a human**. It is neither settled nor released" · REAL in P1-sequences. CONTRACT.md:279 relies on F1 for P11. Not counted in this verdict.

Probe G (would these criteria pass a bad contract?): yes. KICKOFF Ph1.1 checks only that schemas, keys, error semantics, GL roles and examples are present. N2 and N3 (double spend through hold expiry; a post-finality REJECTED hidden by a pending term with no age bound) passed the first Lens R round unnoticed. RUBRIC.md should add: (a) a (result × flow-state) action matrix where every post-finality posting's non-OK result means PAUSE and page; (b) every reconciliation pending term (Rin, Rout, D, F, in-flight G5) has a maximum age that triggers PAUSE; (c) hold lifetime ≥ nonce resolution; (d) a key-uniqueness check across repeated business events (re-screening, multiple dispositions).
Probe F (would they fail a good contract?): yes, in two places. (1) Reading P1.1's "≥64 bytes" as a required key *length* would fail a good contract that uses 32-byte raw keys. It is a CBS capacity requirement. (2) The §7 completeness check would fail a good contract that tracks dependencies in OPEN_QUESTIONS only. Word both as "the CBS accepts keys of at least 64 bytes" and "each dependency is traceable".
Regression check (no units are frozen; LEDGER.md shows none). Instead I re-derived the two sections furthest from the fix edits: §6 unit mapping (14/14 rows recomputed, plus the live fee) → PASS; §2 GL roles vs P4 plus G7 and the normal sides used by the 12-row identity → PASS.

DEFECTS:
- N2 · CONTRACT.md:100 · R / P3.4, I-CONS · finite hold expiry contradicts unbounded T5 precondition → double-spend window · blocking
- N3 · CONTRACT.md:63 with :198-199, :208 · R / I-FAIL, RR-4 · post-finality REJECTED on T1/T4/T9 has no action, and Rin/Rout have no age bound, so recon stays at 0 and never pauses · blocking
- N1 · CONTRACT.md:47 · R / I-ONCE · createCase key has no round or sequence · minor
- N4 · CONTRACT.md:65 · R / P1.4, I-FAIL · getResultByKey REJECTED unmapped; repeat-AMBIGUOUS after NOT_FOUND unspecified · minor
- N5 · CONTRACT.md:143 · R / I-CONS consistency, citation · mint row hard-codes T8 and cites C-26 instead of usdc-system-events.md l.71 · minor
- N6 · CONTRACT.md:155/:172 · R / P3.1 · hold excludes customer fee · minor
- N7 · CONTRACT.md:277 · R / N5 traceability · §7 omits Q-C6, Q-C10 · minor
- N8 · CONTRACT.md:177-178 · R / I-ONCE · repeat RETURN collides; caseId grammar undefined · minor
- N9 · CONTRACT.md:184 · R / I-CONS per-role · dust batch posts to unspecified single wallet · minor
- N10 · CONTRACT.md:147-184 · R / I-ONCE · stale pipe-key shorthand · minor
- X1 · SEQUENCES.md:200-201, :253-257 · cross-unit drift · minor (route to P1-sequences; not counted)

VERDICT: NEGATIVE (10 defects: 2 blocking, 8 minor; plus 1 out-of-target finding X1). All 13 prior defects D1-D13 are resolved.
