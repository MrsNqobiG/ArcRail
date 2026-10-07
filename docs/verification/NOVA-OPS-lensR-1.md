VERIFICATION · lens: R · target: OPS (src/ops/types.ts, ports.ts, audit.ts, queue.ts, fakes.ts; test/unit/ops-actions.test.ts, ops-audit.test.ts, ops-cases.test.ts, ops-ports.test.ts, ops-support.ts) · commit: HEAD 8448431. The OPS files are from 07e9950 and did not change during the run. sha256 prefixes: types 63cc6c54, ports da651d6a, audit 58eadf1b, queue d4e2b20d, fakes e5b59c66, ops-actions 519f1f4d, ops-audit d9eb3996, ops-cases b5ba5164, ops-ports f06a34a4, ops-support 4ae46dd6 · date: 2026-10-07 14:55-15:15 SAST

Judged against:
- docs/NOVA_ARC_DESIGN_DELTA-1.md D-2 (:54-92), D-6 (:140-147), the D-1 UNMATCHED_FILL rule (:32-35), the D-3 consent binding (:105), A-2 (:166) and "Ports and fakes" (:159).
- docs/KHUMO_ANSWERS.md answers 27, 28, 29, 35 and 37 (:36-46).
- D1 docs/NOVA_ARC_DESIGN.md §7.3 (:482-605), §8.4 check 3 (:792-812) and the operator-decision row (:1040).
- The CLAUDE.md money rules and docs/RUBRIC.md MC-01, MC-07, MC-08 and MC-44.

Ground rules kept:
- D1 was not edited.
- No DFNS, Circle or VALR API was called. No .env file was read. No network egress.
- Scratch was a mkdtemp `/tmp/ops-mut-I5uG` with real-file copies of src, the OPS tests and node_modules. `find -lname '/*'` was empty. `diff -r src/ops` against the repo was identical after every mutant.
- Stryker ran with `--tempDirName .stryker-tmp-verify-OPS --cleanTempDir false`, so nothing was deleted.

## CHECKS

- C-1 `npx tsc --noEmit` → exit 2 overall, but **0 errors in OPS files**. All 37 errors are in JQUOTE files that other agents are editing at the same time (src/journey/quote/compose.ts, fakes.ts, test/unit/jquote-*.ts). They are not charged to OPS.
- C-2 OPS tests (`npx vitest run test/unit/ops-*.test.ts`) → PASS, 127/127, 4 files. The suite also passes in the /tmp copy.
- C-3 MC-01 float lint `node tools/lint-money-floats.mjs` → 0 findings in src/ops. The run exits 1 because of findings in src/journey/quote/*, which were being edited concurrently. OPS: PASS.
- C-4 Semgrep MC-01 layer on the 4 OPS money-path files (types, ports, audit, queue) → PASS, exit 0. fakes.ts has 4 `mc01-literal-plus` hits (136, 152, 253, 269: `size + 1`), but fakes.ts is not in MONEY_PATH.md, so CI does not scan it with this layer. Note only.
- C-5 Vendored Semgrep JS/TS SAST on src/ops and the OPS tests → PASS, exit 0. gitleaks on src/ops and each OPS test → "no leaks found". There are no keys, tokens or secrets. Test ids are throwaway literals.
- C-6 No real API calls and no LLM → PASS. The imports are only `../nova-ports/ids`, `../amounts` and `node:crypto` (via ids). There is no fetch, http or process.env. Nothing wires OpsQueue outside tests (grep over src, demo and scripts). `decisionPathEnabled: true` appears only in test/unit/ops-support.ts:104.
- C-7 MC-08 registration (test/unit/money-path.test.ts) → **FAIL**: "Stryker mutate (MC-08)" shows `- "src/ops/audit.ts"`, `- "src/ops/ports.ts"`, `- "src/ops/queue.ts"` and `- "src/ops/types.ts"`. They are listed in docs/MONEY_PATH.md:68-71 but missing from stryker.config.json `mutate`. See D-B4.
- C-8 MC-08 score (Stryker `--mutate 'src/ops/types.ts,src/ops/audit.ts,src/ops/queue.ts,src/ops/fakes.ts'`, 1 393 mutants, 8 min 31 s) → **FAIL**, Stryker exit 1:

  | File | Score | Killed | Timeout | Survived | Other |
  |---|---|---|---|---|---|
  | types.ts | 98.97 % | 289 | | 3 | |
  | audit.ts | 90.28 % | 64 | 1 | 7 | |
  | **queue.ts** | **88.53 %** | 625 | | 81 | |
  | fakes.ts | 82.04 % | | | 57 | 1 no-cov |
  | **Run total** | **89.30 %** | | | | below `break: 90` |

  The 4 listed money-path files together score 979/1070 = 91.5 %. Most queue.ts survivors are refusal-detail string literals. The logical survivors are 135:68 (`f.proof !== null` → true), 238:11 (`a !== null` → true), 262 (closed-case replay operands), 285:52 and 286:23/51 (approver shape guards), and audit.ts:58 (seq and prevHash checks). See D-B5 and D-m10.
- C-9 MC-07 coverage (`--coverage.include='src/ops/**'`, per-file 100 % thresholds, report written to a mkdtemp) → the 4 money-path files reach 100 % statements, branches, functions and lines: PASS. fakes.ts has 98.82 % branches (line 277). It is not money-path, so this is a note only.
- C-10 Planted mutants (my own, in the /tmp copy, full OPS suite each, file restored after each) → **23/24 KILLED**:
  - M1 consent check dropped: KILLED
  - M2 same-approver off: KILLED
  - M3 raw (non-canonical) compare: KILLED
  - M4 loss account not required: KILLED
  - M5 read-back compares only debits = credits: KILLED
  - M6 retry ignores P6: KILLED
  - M7 proof list ignored: KILLED
  - M8 P13 on a proven leg: KILLED
  - M9 CF-31 gate off: KILLED
  - M10 retry key from decisionId: KILLED
  - M11 consent binding drops caseId: KILLED
  - M12 AUTHORIZED audit not required: KILLED
  - M13 write-off on an UNRESOLVED leg: KILLED
  - M14 refund bound off: KILLED
  - M15 accept amount not pinned: KILLED
  - M16 requote above reservation allowed: KILLED
  - M17 digest drops legs: KILLED
  - M18 audit hash omits actors: KILLED
  - **M19 verifyChain ignores prevHash: SURVIVED** (not equivalent: delete entry k, re-number and re-hash the rest, and the chain still verifies)
  - M20 closed replay ignores optionId: KILLED
  - M21 pending-other-decision off: KILLED
  - M22 second approver may be non-staff: KILLED
  - M23 legs balance check off: KILLED
  - M24 consent consumed twice: KILLED
- C-11 Every action exists and is tested → PASS. REQUOTE (ops-actions:31-97), ACCEPT_WITH_CONSENT (:100-110), REFUND P6 and P13 (:113-161), RETRY_AS_NEW_PAYMENT (:164-218), WRITE_OFF (:221-255), RELEASE_QUARANTINE and UNPAUSE (:258-279). ADOPT_FILL and REVERSE_FILL (delta :72) do not exist: D-B2.
- C-12 Missing consent is refused → PASS. CONSENT_MISSING for null, `''` and `'has space'` (:53-62). An unknown, foreign, used or differently bound consent is refused, and the claim is released (:64-97). Single use across two cases is tested. M1, M11 and M24 are killed. The binding content itself is incomplete: D-B3.
- C-13 The same human twice is refused → PASS. SAME_APPROVER compares the canonical ids from StaffDirectoryPort, including alias spellings (`Alice@x`, `staff:Alice`) (queue.ts:284-291; ops-actions:289-298). A service account or an unknown id gives APPROVER_UNAUTHENTICATED (:300-310). Every action is two-person, including WRITE_OFF, UNPAUSE and RELEASE_QUARANTINE. M2, M3 and M22 are killed.
- C-14 Amounts never come from input → PASS. OpsActionRequest has no amount, account or legs (queue.ts:100-109). A hostile request that carries `amount`, `destination`, `legs` or `journal` still posts the stored option (ops-actions:321-332). The option must exist on the case under that action (:334-342).
- C-15 A case cannot close while unbalanced → PASS. After `post`, the ledger's read-back must satisfy `debits === credits === debitTotal(legs)` (queue.ts:371-375). Otherwise the result is UNBALANCED, the case stays OPEN with its claim, and other decisions are blocked (ops-actions:345-373). M5 is killed. The read-back compares totals only: D-m7.
- C-16 The audit is append-only → PASS with gaps:
  - The audit is a hash chain (audit.ts:36-63). The stores expose no update or delete (fakes.ts:250-279). Entries are frozen copies (ops-audit:40-77).
  - If the AUTHORIZED write fails, nothing is done (queue.ts:279; ops-actions:455-465).
  - Gaps: the APPLIED write result is ignored (D-m3), and M19 survives (D-m10).
- C-17 D-6 rule: RETRY_AS_NEW_PAYMENT needs proof that the original was not sent → PASS for OPS's own check:
  - It requires `terminal && p6Posted` (queue.ts:305) **and** either no Arc leg or PROVEN_NOT_SENT with a proof in NOT_SENT_PROOFS (queue.ts:134-141).
  - NOT_SENT_PROOFS (types.ts:183-189) are exactly D1 §8.4 check 3 (a1), (a2), (b) and (c), plus the status-0 receipt (D1 :812, F-3c). `EXTERNAL_ID_NOT_FOUND` is refused (ops-actions:185-204).
  - The key is `retry:<paymentId>` (queue.ts:381). Reconstruction: 6 + 36 = 42 characters, charset `[a-z0-9:-]`, inside KEY_RE.
  - At most one retry per original holds through the port, and a second case replays it (ops-actions:166-183).
  - M6, M7 and M10 are killed.
- C-18 REFUND is only allowed after a proof → PARTIAL. P6 needs NONE or PROVEN_NOT_SENT with a listed proof. P13 needs `arcLeg === 'NONE'` (queue.ts:302-309). There is no per-payment refund state and no check against an already-posted P6: D-B1.
- C-19 WRITE_OFF is configure-or-fail-closed → PASS. A null `lossAccount` gives LOSS_ACCOUNT_UNSET and is never defaulted (queue.ts:297; ops-actions:240-245). An UNRESOLVED leg is refused (:247-249). M4 and M13 are killed.
- C-20 CF-31 gate → PASS. When `decisionPathEnabled` is false, every action is NOT_ENABLED and audited (queue.ts:255; ops-actions:412-419). Nothing outside tests enables it (C-6).
- C-21 Reason codes for every case → PASS. REASONS is a closed list per kind, and any other reason is REASON_INVALID (types.ts:69-80; queue.ts:211; ops-cases:181-192, 210-243). The kind set itself deviates from the delta: D-m1 and D-m2.
- C-22 OPS does not write HIST → PASS (no import of src/history).
- C-23 DFNS/Arc facts re-checked against the archive → PASS. OPS cites only:
  - "an `externalId` lookup that finds nothing proves nothing" (queue.ts:12, types.ts:182). The archived `api-reference_wallets_list-transfers.md` (sha256 6ffd2d54…3173, equal to MANIFEST row 215) has only `limit` (:52) and `paginationToken` (:64) as query parameters, so there is no externalId filter. This matches D1 :803 and Q-N21.
  - The proof names. The abort proof matches `api-reference_wallets_abort-transfer.md` :7, "Aborts a transfer that is currently in 'Executing' status and has not yet been signed" (sha256 3dba876e…566b, equal to row 205).
  - The no-blind-retry rule matches `guides_developers_create-transfers.md` :206, "Never submit a second Transfer Asset request to 'retry' a transfer that has not reached a terminal status" (sha256 cfa4c413…4e82, equal to row 229).
  - No fact is invented. There are no chain IDs, addresses or network config in src/ops.
- C-24 Every delta element follows from a quoted answer → PASS:
  - The case queue and actions: answer 29, "insert functionalty for manual intervention for all processes", and answer 37, "requote for rate changes, under/over payments - client reachout for change consents".
  - Retry as a new payment: answer 28, "New one, record everything for both".
  - The retry safety note: answer 27, "Retry".
  - Consent: answer 35, "client needs agree to settlement instructions".
  - WRITE_OFF's two-person rule is a declared design control (delta :82). OPS does not cite AMBIGUOUS answer 18.
- C-25 OPEN items not built on → PASS [inspection-only]. DQ-4 (where consent lives) is used only through ConsentPort with fakes. F-3 (no expense account) leads to WRITE_OFF being refused while the loss account is unset. CF-31 is gated. DQ-1 and DQ-2 are not used.
- C-26 Two structurally different fakes per port → PASS. Map vs log for the case store, consent, ledger, payment facts, rail control and audit; alias vs rule for staff. All run one `describe.each` suite (ops-ports.test.ts).
- C-27 Behavioural probes (in /tmp, against the copy) → results cited in the defects:
  - P1: REFUND P6 is OK while the facts say `p6Posted: true`.
  - P2: 3 refunds on one payment across 3 cases.
  - P3: a FILL_AFTER_EXPIRY case closes by REQUOTE.
  - P4: a TypeError is thrown on non-iterable approvers or evidence.
  - P5: a bogus amounts unit is accepted.
  - P6: a write-off credits the loss account itself, and P14 legs are accepted unrelated to the reservation.
  - P7: the action returns OK with no APPLIED audit entry.
  - P8: a HOLD/NONCE_HOLD is lifted by UNPAUSE.
  - P9: a consent is burned by a ledger refusal.
  - P10: the control port receives raw approver spellings.
  - P11: the REQUOTE digest has no quote or code id.

## DEFECTS

- **D-B1** · Location: src/ops/queue.ts:298-317 and 361-378 (REFUND and WRITE_OFF post straight to OpsLedgerPort), and the existence of src/ops/** as a separate case system.
  - Criterion: Lens R, CLAUDE.md "Exactly once" and "Conservation"; delta D-2 :56, "manual intervention uses D1's existing case store, `CaseRecord` and `OperatorDecision` … **No new case queue is built, and there is no `src/ops/**` parallel system**"; delta D-2 :79, "REFUND is allowed only as D1 template P6 … **through `applySignal`**, so the store's `LEG_UNRESOLVED` guard (D1 :487-497) applies".
  - Severity: **blocking** (money can be double-counted).
  - What OPS does instead: it keeps its own CaseRecord and CaseStorePort (types.ts:161-178, ports.ts:119-123). These are parallel to D1's in src/nova-ports/payment-store.ts:276-300 and 394-396. OPS posts refunds with no payment-level state transition.
  - Consequences, reconstructed:
    - (a) **A second P6.** D1 §8.4 check 3 (:796) says every proof "ends the payment: the leg goes terminal and P6 is enqueued in the same `applySignal` commit". So when the facts say PROVEN_NOT_SENT, P6 is already posted. Yet OPS REFUND P6 succeeds with `{terminal: true, p6Posted: true, arcLeg: 'PROVEN_NOT_SENT'}`: probe P1, and the suite asserts it at ops-actions.test.ts:114-121 with FACTS_PROVEN, `p6Posted: true`. The payer is refunded twice.
    - (b) **No per-payment refund bound.** Each case derives its own ledger key `ops:<decisionId>`, so three cases on one payment each refund. Probe P2: QUARANTINE P13 500, REQUOTE P13 500 and LATE_PAYIN P6 500 are all OK, with 3 journals. ops-actions.test.ts:123-129 also passes two refunds on one payment.
    - (c) The check-then-post on PaymentFactsPort is not atomic with the store's LEG_UNRESOLVED guard. A submit marker committed between `facts()` (queue.ts:299) and `post()` (:364) is not seen.
  - Fix: route REFUND, WRITE_OFF and RETRY through D1's PaymentStorePort (applySignal and recordDecision), as delta D-2 :56 and :79 require, with the operator-action layer under src/journey/ops/** building OperatorDecision values. At minimum, refuse REFUND P6 when `p6Posted` is true, and bound refunds per payment.
- **D-B2** · Location: src/ops/types.ts:23-33 and 69-94 (no `UNMATCHED_FILL` kind, no `ADOPT_FILL` or `REVERSE_FILL` action, no `P12_FILL_REVERSAL` template; `FILL_AFTER_EXPIRY` is a REQUOTE reason with actions REQUOTE, REFUND and WRITE_OFF).
  - Criterion: delta D-1 :32-35, "It opens a requote case (D-2) of kind `UNMATCHED_FILL` that carries `bookedEntryRef`. The case closes by exactly one of two paths, both two-person: ADOPT … or REVERSE … This prevents two booked conversions for one payment (a double count of the client's fiat)". Delta D-2 :60 and :72 list both the case and the actions under D-2. A-2 :166.
  - Severity: **blocking** (double count).
  - Probe P3: a REQUOTE/FILL_AFTER_EXPIRY case closes by REQUOTE (P14) with no `bookedEntryRef`. The already-booked fill is neither adopted nor reversed.
  - `grep -rn "UNMATCHED_FILL\|ADOPT_FILL\|REVERSE_FILL\|P12_FILL" src` finds nothing, so no other unit provides it.
  - Fix: add the kind with `bookedEntryRef`, ADOPT_FILL and REVERSE_FILL (two-person), P12, and the "no new code while UNMATCHED_FILL is open" rule. Remove FILL_AFTER_EXPIRY from REQUOTE.
- **D-B3** · Location: src/ops/types.ts:111-134 and 273-287 (`optionDigest` covers optionId, action, unit, asset, amounts and legs only; the REQUOTE and ACCEPT_WITH_CONSENT options carry no quote or code id and no settlement instructions; CaseOutcome, queue.ts:400-408, names no quote).
  - Criterion: delta D-3 :105, "A consent is **bound to** `(clientUid, paymentId, caseId or null, digest of the exact option consented to)`, where the digest covers **the new code or quote, the amount, and the settlement instructions**". Answer 35: "client needs agree to settlement instructions".
  - Severity: **blocking** (money moves without the required control).
  - Probe P11: the REQUOTE option keys are `[action, optionId, unit, asset, reserved, requoted, legs]`. A consent therefore binds amounts only. The journey can execute any new quote or rate, and any settlement instructions, under it.
  - Fix: put the quote or code id (and rate, expiresAt) and the settlement-instruction digest into the option and its digest, and return the quote id in the outcome.
- **D-B4** · Location: stryker.config.json `mutate` (missing the 4 OPS files) vs docs/MONEY_PATH.md:68-71.
  - Criterion: MC-08 registration. The CI test test/unit/money-path.test.ts:77-79 fails.
  - Severity: **blocking** (a mandatory CI check fails, and CI's mutation gate would never mutate OPS).
  - Fix: add src/ops/types.ts, ports.ts, audit.ts and queue.ts to `mutate`.
- **D-B5** · Location: src/ops/queue.ts (Stryker 88.53 %, 81 survivors).
  - Criterion: MC-08, "Mutation score ≥ 90% on money-path modules".
  - Severity: **blocking** under the per-module reading (the same reading as NOVA-HIST-lensR-1 C-6). The targeted run also breaks the `break: 90` threshold (89.30 %, exit 1). The 4 listed files together score 91.5 %.
  - Most survivors are refusal-detail strings that no test asserts.
  - Fix: assert `detail` on refusals, and add tests for the logical survivors (D-m10).
- D-m1 · Location: src/ops/types.ts:25, 71 and 85 (`HOLD` kind; HOLD/NONCE_HOLD may take UNPAUSE, REFUND and WRITE_OFF).
  - Criterion: delta D-2 :59, "there is no 'HOLD' kind, and a nonce hold keeps D1's `NonceHold`".
  - Severity: minor.
  - Probe P8: a NONCE_HOLD case is "unpaused" through RailControlPort by two humans. Whether that lifts a D1 nonce hold without D1's evidence (liftedBy, F-3b) depends entirely on Nova's adapter. D1's own `decideUnpause` would refuse a non-pause subject.
  - Related: the kind and action names diverge from D1 and A-2. STUCK_PAYOUT vs `STUCK`, RETURNED_PAYOUT vs `PARTNER_RETURN`, UNDER/OVERPAYMENT and LATE_PAYIN vs `PAYIN_MISMATCH`, RELEASE_QUARANTINE vs `LIFT_QUARANTINE`.
- D-m2 · Location: src/ops/types.ts:23-33.
  - Criterion: A-2 :166 kinds `FILL_TIMEOUT`, `HISTORY_WRITE_FAILED` and `CONSENT_MISSING` (CONSENT_MISSING exists only as a QUARANTINE reason).
  - Severity: minor.
  - The journey cannot open a fill-timeout case (delta :38) or the aged history-failure case (D-4 :117, carried from NOVA-HIST-lensR-1 D-m6). openCase returns KIND_MISMATCH, so the gap is silent unless the caller pauses.
- D-m3 · Location: src/ops/queue.ts:410 (`await this.log('ACTION_APPLIED', …)`, result ignored) and :342 (ACTION_PENDING likewise).
  - Criterion: delta D-2 :78 and :92, "Every action produces … an audit event".
  - Severity: minor.
  - Probe P7: the audit store fails after AUTHORIZED. The WRITE_OFF still posts a journal and returns OK, and the audit holds only `ACTION_AUTHORIZED`, with no journalRef or newPaymentId.
- D-m4 · Location: src/ops/queue.ts:284-291 and 392; ports.ts:159-162.
  - Criterion: D1 :1040, "Each approver confirms the same `evidenceDigest`, so neither can approve content the other did not see"; delta :66, "exactly as D1".
  - Severity: minor, because CF-31 fails closed.
  - The request carries no per-approver confirmation of the option digest. StaffDirectoryPort.canonical is a directory lookup, not an authentication proof.
  - Probe P10: the control port and the audit receive the raw spellings `['staff:ALICE','staff:bob']`, not the canonical ids.
- D-m5 · Location: src/ops/queue.ts:119-127 and 130-132.
  - Criterion: ports never throw (ports.ts:111).
  - Severity: minor.
  - Probe P4: `execute` with `approvers: {}` throws `TypeError: xs is not iterable` (before the refusal is audited). `execute` or `openCase` with `evidenceRefs: {}` throws `refs is not iterable`. No money moves.
- D-m6 · Location: src/ops/queue.ts:216-224 and types.ts:243-266 (option and amount content).
  - Severity: minor (options are server-built).
  - `CaseAmounts.unit` is not validated (probe P5: `'FOO'` is accepted).
  - The WRITE_OFF `creditAccount` may equal the loss account, giving a no-op journal (probe P6).
  - The P14 legs are not tied to `reserved` or `requoted` (probe P6: 999 999 units of legs on a 1 000 reservation), against delta :88 ("moves the reservation from the old quote to the new one").
  - The WRITE_OFF amount is not bounded by the case's shortfall. Refunds are bounded only when `amounts` is set.
- D-m7 · Location: src/ops/queue.ts:371-375.
  - Criterion: CLAUDE.md "Fail closed … failed invariant … pages a human".
  - Severity: minor.
  - An UNBALANCED read-back leaves the case pending but raises no QUARANTINE or page.
  - The read-back compares totals only, not the booked accounts. Compare D-1 :26, which requires a per-account read-back.
- D-m8 · Location: src/ops/queue.ts:338-340 and 353-369.
  - Severity: minor (fails closed).
  - `release()` clears `consentConsumed` after a LEDGER_REJECTED or CONTROL_REJECTED, so the consumed consent is lost and the client must consent again. Probe P9: the second attempt gives `consent refused: ALREADY_USED`.
  - A concurrent second call of the same decision can `release()` the claim of the in-flight first call.
- D-m9 · Location: src/ops/types.ts:7-8, "Assumptions about Nova (DA-5, DA-6, DQ-4 and CF-31) are listed in docs/KHUMO_QUESTIONS.md".
  - Criterion: MC-44 citation.
  - Severity: minor.
  - `grep -c` in KHUMO_QUESTIONS.md gives 0 for each of DA-5, DA-6, DQ-4 and CF-31. They are in the delta's table (:173-186) and in D1. Cite those instead.
- D-m10 · Location: test gaps.
  - Severity: minor.
  - Own mutant M19 (verifyChain without the prevHash check) survives. Stryker's logical survivors:
    - queue.ts:135:68 (`f.proof !== null`)
    - :238:11 (`a !== null`; an ACCEPT option on a case without amounts would then throw)
    - :262 (replay operands)
    - :285:52 and :286:23/51 (approver shape guards)
    - audit.ts:58:9/26
  - fakes.ts: Stryker 82.04 % and 98.82 % branch coverage at line 277 (not money-path).
- D-m11 · Location: src/ops/queue.ts:192-206 and audit.ts:87.
  - Severity: minor.
  - CASE_OPENED is audited before the case `put`, so a failed put leaves an audit entry for a case that does not exist.
  - `Object.freeze` is shallow, so `actors`, `evidenceRefs` and `refs` inside a stored entry stay mutable. verifyChain would detect a change.
- D-m12 · Location: src/ops/queue.ts:308-309 with ALLOWED_ACTIONS RETURNED_PAYOUT (types.ts:92).
  - Severity: minor (fail closed).
  - A returned payout's Arc leg is SENT, so REFUND on a RETURNED_PAYOUT case is always LEG_NOT_PROVEN_UNSENT, and RETRY is refused too. The returned funds can then only be written off. D1's PARTNER_RETURN path (claimInbound, D1 :509-511) is not connected.

## VERDICT: NEGATIVE (17 defects: 5 blocking, 12 minor)

**Blocking defects:**
- D-B1: a refund is posted outside D1's store, so P6 can be posted twice and a payment refunded several times.
- D-B2: there is no UNMATCHED_FILL ADOPT or REVERSE path, so a booked fill can be double-counted.
- D-B3: a consent is not bound to the quote or the settlement instructions.
- D-B4: OPS is not registered in the Stryker `mutate` list.
- D-B5: queue.ts has a mutation score of 88.53 %.

**What holds** (reconstructed and mutation-tested, 23/24 own mutants killed):
- two distinct canonical approvers;
- consent single use and bound to client, payment, case and option digest;
- no amounts from input;
- the ledger read-back gate before close;
- refund and retry only after a D-6 proof;
- `retry:<original>` with one retry per original;
- configure-or-fail-closed WRITE_OFF;
- the CF-31 gate;
- the hash-chained append-only audit.

There is no secret, no real API call and no invented DFNS or Arc fact.
