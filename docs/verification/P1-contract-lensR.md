VERIFICATION · lens: R · target: P1-contract (docs/CONTRACT.md) · commit: none (uncommitted working tree, 2026-10-02)

Criteria used (docs/RUBRIC.md does not exist yet): KICKOFF_PROMPT.md §5 Phase 1 item 1; CLAUDE.md non-negotiables and money invariants; docs/discovery/cbs-port-requirements.md (P1–P11); docs/constants.md (C-xx). Phase 0 inputs are themselves unverified (LEDGER G0 note), so traceability checks are against unverified documents.

CHECKS:
- K1.1 every call and event has a schema → [inspection-only] PASS for §3 (14 ops) and §4 (6 names). Exception: submitPayoutInstruction (CONTRACT.md:99) has no response schema (see D11).
- K1.2 idempotency keys for every call → FAIL. The §1.3 table (CONTRACT.md:31-38) has no derivation for screen, createCase, submitMonitoringEvent or requestApproval, but CONTRACT.md:76 says "All of these are idempotent by `key`" (D1).
- K1.3 error semantics → PASS. §1.4 has 4 result classes and 11 REJECTED codes (recounted). Unknown code → AMBIGUOUS (CONTRACT.md:52), which fails closed. The AMBIGUOUS resolution path is incomplete (D5).
- K1.4 GL roles cover KICKOFF list (customer liability, treasury/hot, gas expense, suspense/dust, clearing) → PASS: G1, G2, G3, G4, G5 (CONTRACT.md:62-66), plus G6 and G7.
- K1.5 key format recomputed: "arc1-" + SHA-256 hex = 5 + 64 = 69 chars. Computed sha256("arc1|out|abc|reserve") gives a 69-char key → PASS. Also 69 >= 64 bytes, so it meets P1.1.
- K1.6 unit-mapping worked examples, recomputed with Python exact integer // and %:
  p=6, k=10^12: 0→0 r0; 1→0 r1; 999,999,999,999→0 r999,999,999,999; 10^12→1 r0; 10^18→1,000,000 r0; 1,000,000,500,000,000,000→1,000,000 r500,000,000,000; 21,000×20 gwei=420,000,000,000,000→420 r0; 7,374,356,000,000,000→7,374 r356,000,000,000; 9,223,372,036,854,775,807,999,999,999,999→2^63−1 r999,999,999,999 (and +1 wei gives m=2^63, which overflows i64, so the boundary is tight) → PASS (9/9)
  p=2, k=10^16: 10^18→100; 1.5×10^16→1 r5×10^15; 10^16−1→0 r(10^16−1); 7,374,356,000,000,000→0 r all → PASS (4/4)
  wei→USDC_UNITS: 1,234,567,890,123,456,789→1,234,567 r890,123,456,789 → PASS
  i64 capacity: p=18 9.223 USDC; p=6 9.223×10^12; p=2 9.223×10^16 → PASS
- K1.7 boundaries present (0, 1 base unit, k−1, k, max representable, odd dust) → PASS
- C-01 testnet chain ID 5042002. Re-fetched https://docs.arc.io/arc/references/rpc-endpoints.md (2026-10-02): "Chain ID (Testnet)** | `5042002` |" → PASS
- C-10/C-11 18 dp / 6 dp. Re-fetched https://docs.arc.io/arc/references/evm-differences.md (2026-10-02) line 81: "one balance: a native interface (18 decimals) and an ERC-20 interface (6" → PASS
- C-13 factor 10^12: same page, "divide by 10¹²" → PASS
- C-20 system emitter: https://docs.arc.io/arc/references/usdc-system-events.md (2026-10-02): "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` | `Transfer` | 18 |" → PASS
- C-22 two logs: same page, "emits **two** logs" → PASS. This supports the CONTRACT.md:40 decision to key on system-emitter logs only.
- C-24 / C-25: same page, "Zero-value transfers emit no log", "gasUsed × effectiveGasPrice" → PASS
- C-53 / C-54: evm-differences.md lines 120-128, "still consumes gas", "`0x0` reverts with \"Zero address not allowed\"" → PASS
- C-15: https://docs.arc.io/integrate/exchanges/deposits.md line 209, "and credit the raw 18-decimal value. Don't truncate to 6-decimal ERC-20 units" → PASS
- T8 CCTP-mint detectability (not cited in CONTRACT) → PASS after re-derivation. usdc-system-events.md lines 27-29: "The native system emitter logs a `Transfer` for every explicit USDC transfer—native sends, ERC-20 transfers, mints, and burns", and line 71: "Mint: `Transfer(0x0, recipient, amount)`".
- CBS-side identity CBS_G2 + G3 = G1+G4+G5+G6+G7, re-traced for all 11 template rows (T1, T2, T3fb, T4, T4fb, T5fb, T6, T7, T8, gas, dust, unidentified) → PASS. Each row changes both sides by the same amount, or changes neither side.
- Chain-side identity (§5.3), re-traced per event: inbound W (chain +W = k·⌊W/k⌋ + W mod k); outbound A (−A·k via T4 or Rout); gas f (−f via F; a batch moves n·k from F to G2, and G2·k − F is invariant); dust batch (G2·k + D is invariant) → PASS, with the D-timing caveat in D6 and the internal-move gap in D2.
- I-INT (amounts are strings, regex `^(0|[1-9][0-9]*)$`, no JSON numbers; CONTRACT.md:12) → PASS
- I-CONV (only U1 converts; dust is never dropped; CONTRACT.md:18, 137) → PASS
- I-FAIL (CONFLICT→PAUSE, unknown code→AMBIGUOUS, unexpected HoldChanged→PAUSE, residual≠0→PAUSE, G7<ΣG3→PAUSE) → [inspection-only] PASS
- N1 (only 5042002 accepted; CONTRACT.md:22). Searching for the mainnet ID is blocked by the guard hook, so I read the whole file → [inspection-only] PASS
- N3 (no CBS change authorised; CONTRACT.md:5) → PASS
- P9.1 / no PII (opaque accountRef, PII-free narrative, travel-rule data held only by reference; CONTRACT.md:21, 81, 89) → [inspection-only] PASS
- Port-requirement traceability P1–P11 → FAIL for P5.3 (event replay from offset), P6.6 (FIC reporting route) and P8.4 (per-call audit join). None of these appears as an op, a field or an open item in §7 (D13).
- Count: the open items in §7 (10) all exist as OPEN in OPEN_QUESTIONS.md (Q-C1, C3, C4, C5, C7, C8, C9, C14, C16, R3) → PASS
- Citation re-derivability: CONTRACT.md:208 "gas from live testnet tx `0x0e8279a4…24695`". The hash is truncated here and in constants.md, so the live check cannot be re-run → FAIL (D10)

CANDIDATES (Lens A): not run. This is a Lens R pass. Each defect below carries its evidence in the same form a Lens A candidate would.

DEFECTS:
- D1 · CONTRACT.md:31-38 vs :76 "All of these are idempotent by `key`" and :86-90 (screen, createCase, submitMonitoringEvent, requestApproval take `key`) · R / KICKOFF Ph1.1 "every call ... with ... idempotency keys" and CLAUDE.md I-ONCE "idempotency keys are derived deterministically from business IDs" · No canonical string is defined for these four ops, so implementers will invent keys (risk: duplicate screenings, cases and approvals on retry) · blocking
- D2 · CONTRACT.md:114 "T1 Inbound received (detected on a system-emitter log `W` wei to a bank-controlled address" with no exclusion when `from` is also bank-controlled; CONTRACT.md:130 "T6 ... `DR G2.<to> X · CR G2.<from> X`" · R / I-CONS · A gas top-up or sweep (hot→gas wallet) emits a system log to a bank-controlled address. T1 fires (G2↑ X, G5↑ X) on top of T6, and then T8 or unidentified-suspense follows. The chain sum over S is unchanged while CBS_G2 rises by X. Result: a guaranteed §5.3 drift and PAUSE on every internal move, or a false G7/G4 booking. In-flight T6 is also missing from the Rin/Rout terms when S is a single wallet role · blocking
- D3 · CONTRACT.md:128 "T5 Outbound release (rejected before broadcast, blocklist revert, dropped, cancelled): `releaseHold`" · R / I-CONS, P3.4 failure mode "the customer spends the funds again, and the transaction then lands: double spend"; constants M-6 (dropped txs exist; replacement uses the same nonce) · "Dropped" has no precondition that the nonce has been consumed by a different, final transaction. Releasing the hold while a signed transaction can still be mined lets the customer spend the funds twice. Reconciliation would catch it only after the fact · blocking
- D4 · CONTRACT.md:27 "Canonical strings are `|`-joined and always lowercase" · R / I-ONCE · No grammar is given for instructionId, moveId, step or batchSeq. Lowercasing merges IDs that differ only in case, so two distinct payouts with the same payload would get "OK already applied" on reserve and no hold. `|` inside moveId or step can produce colliding canonical strings ("a|b"+"c" vs "a"+"b|c") · minor
- D5 · CONTRACT.md:50 "Then call `getPostingByKey`" vs :82, where getPostingByKey returns only `{state, journalId?, code?}` · R / P1.4, P1.6 · The outcome of an AMBIGUOUS placeHold, releaseHold, screen, createCase or requestApproval cannot be resolved by key. Each one ends in PAUSE (fail-closed, but every timeout becomes a manual incident) · minor
- D6 · CONTRACT.md:115 "The dust `W mod k` goes to the adapter's dust accumulator" vs :149 "Rin ... at their posting amount ⌊W/k⌋×k" · R / I-CONS reconciliation exactness · The contract doesn't say whether D accrues at detection or at T1 posting. If D accrues at posting, W mod k sits in neither Rin nor D before T1, and the residual is non-zero (a false PAUSE) · minor
- D7 · CONTRACT.md:68 (G7) and :76 "The scopes are under P8.3" vs cbs-port-requirements.md P8.3 "post only to the G1–G6 set" and P10.1 "every G1–G6 account" · R / P8.3, P10.1 traceability · G7 (and T8 posting to it) is outside the scoped posting rights and the as-of balance requirement the contract cites · minor
- D8 · CONTRACT.md:90 "`payloadHash = SHA-256` over canonical `{asset, amountWei, destination, chainId, instructionId}`" · R / P7.1 · The canonical serialisation is undefined (field order, encoding, address case: EIP-55 per :24 vs "always lowercase" per :27), so independent implementations can compute different hashes · minor
- D9 · CONTRACT.md:12 (value "0" allowed) with T1/T2 :115-118 · R / I-CONV · For inbound W < k (any amount below 0.01 USDC when p=2), ⌊W/k⌋ = 0. The contract doesn't say whether zero-amount T1/T2 journals are posted, skipped, or "dust only". A CBS rejecting zero legs would give REJECTED/INVALID with no inbound compensation path · minor
- D10 · CONTRACT.md:208 "`0x0e8279a4…24695`" · R / constant citation must be re-derivable · The truncated tx hash cannot be re-queried · minor
- D11 · CONTRACT.md:99 submitPayoutInstruction gives only "Idempotent by `instructionId`... gets `CONFLICT`" · R / KICKOFF Ph1.1 "schemas ... and error semantics" · There is no OK response schema, no REJECTED codes (unit mismatch, chain, policy) and no ack semantics for the §4 events · minor
- D12 · CONTRACT.md:66 "G5 Clearing / in-flight | ... | — |" (no normal side) vs :162 "with all accounts at their normal-side balances", which puts G5 on the credit side · R / internal consistency of the I-CONS check · minor
- D13 · contract-wide (absent) · R / port-requirement traceability (CONTRACT.md:3 "Every requirement traces to ...") · P5.3 (replay from offset), P6.6 (FIC reporting route; Q-R1 not listed in §7) and P8.4 (per-call audit join) have no op, field or open item · minor

VERDICT: NEGATIVE (13 defects: 3 blocking, 10 minor)
