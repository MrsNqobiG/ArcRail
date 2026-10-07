VERIFICATION · lens: R · target: PORTS (src/nova-ports/**, src/status/** and their tests) · commit: 8448431 (the PORTS files, their tests, stryker.config.json, docs/MONEY_PATH.md and vitest.config.ts are identical to 07e9950, where the fix to the previous pass landed; the working tree has no PORTS edits. This pass ran 2026-10-07 14:45–15:15 SAST)

Verifier: independent verifier subagent, fresh context. This pass re-verifies PORTS after the fix to the 13:45–14:10 pass (B1 and m1–m10). It replaces that pass in this file; the previous text is in git at 07e9950.

Inputs used:
- docs/NOVA_ARC_DESIGN.md: §7.1–§7.8, §9.1–§9.3, §12 (F-17 and the closing paragraph), §13.1–§13.3;
- CLAUDE.md money rules, docs/constants.md, docs/RUBRIC.md, docs/COVERAGE_EXCLUSIONS.md;
- the archived DFNS and Arc pages under docs/sources/, checked against docs/sources/MANIFEST.md;
- the code and the tests.

The author's comments, commit messages and test names were not trusted.

Method:
- Node v22.23.3 from .tools/node/bin.
- No network calls, no .env reads, no secrets, no DFNS, Circle or VALR API call.
- Stryker ran in a mkdtemp real-file copy (/tmp/verify-ports-r4-u2uMqS), with `--tempDirName .stryker-tmp-verify-PORTS`. Probes, hand mutants and coverage ran in a second copy (/tmp/verify-ports-r4p-ZTHpNb).
- Both copies were made with tar, excluding .git, .env*, .tools, reports, coverage, dist and the Stryker temp dirs. Each has 30 symlinks, all inside node_modules/.bin, and none resolves into the repo.
- Every PORTS file in the first copy was compared with `git show HEAD:<file>`: all identical.
- Every hand mutant was restored after its run. The md5 of payment-store.ts, ledger.ts and payment-store-fakes.ts equals HEAD's afterwards.

## Status of the previous pass's defects

| Previous defect | Now |
|---|---|
| B1: a P2R close not bound to A | **Fixed at the close.** closeByReturn refuses unless `c.expected.value === rec.binding.amount` (payment-store.ts:962). The ledger now binds every P2R and P11 leg to the payment's P2P amount and asset (ledger.ts:286–289, :320–326). Probe S1 on both store fakes: the A/2 close is refused. Hand mutant H1 (value unchecked) is killed by contract :1316. **Residual:** a wrong-value case still claims the wrong log (m1 below). |
| m1: P6 keyed on the PAYOUT leg; no close after a non-PAYOUT_FAILED payout failure | **Fixed.** P6 is refused with a PAYOUT failure only when the Arc leg is COMPLETED (:587). closeFailedPayout accepts any failure stage of the PAYOUT leg after the Arc leg COMPLETED (:988). Probe S2 (C3b: PAYOUT CANCELLED/CANCELLED_BY_OPERATOR after Arc COMPLETED) now closes with P11 + P6 on both fakes. H5, H6, H7 and H8 are killed. |
| m2: a second P1 for one payment | **Fixed** (ledger.ts:283–285). H9 is killed by ledger contract :348, which also pins M29. **Residual:** the same rule is missing for P2, P2I, P2P, P11 and P2R (m2 below). |
| m3: P11 and P2R amounts unbound | **Fixed** (ledger.ts:320–326). H10, H11, H12 and H16 are killed by ledger contract :367. |
| m4: no late P2R after P11 | **Fixed** (payment-store.ts:993, :1001–1004; the event-sourced fake now replays the close against the prior outbox, payment-store-fakes.ts:534). H2, H3, H15 and H18 are killed by contract :1353. H4 survives (m6 below). |
| m5: zero-width approver ids | **Fixed.** `APPROVER_RE = /^[A-Za-z0-9._@-]+$/` (:790). Probe S4: `'ann​'`, `'ａｎｎ'` and `'bob '` → APPROVER_UNAUTHENTICATED; `['ann','ANN']` → SAME_APPROVER; `'a.b@x-y_z'` is accepted. H13 is killed. |
| m6: stale comment | **Fixed** (:56–58 now says upper-casing). |
| m7: moves and funding absent | Open, fails closed. Carried as m3. |
| m8: signature drift not recorded in a design delta | Open. NOVA_ARC_DESIGN_DELTA-1.md still records none of the deviations both headers list. Carried as m4. |
| m9: compensation trusts the caller's receipts | Open [inspection-only]. Carried as m5. |
| m10: test gaps | Tests were added for B1, m1, m2, m3 and m4. New gaps: m6 below. |

## CHECKS

- `npx tsc --noEmit` (copy of HEAD): **PASS**, exit 0.
- Target tests (13 PORTS files: 7 contract, 5 unit, 1 property, config limited to them): **PASS**, 394/394.
- Downstream consumers of the ports (ops-*, jquote-*, jpartner-*, hist-history, dfns-gateway, dfns-fakes, jpartner contract; 16 files): **PASS**, 660/660. This is a regression check only.
- MC-01 float lint `node tools/lint-money-floats.mjs`: **PASS**, exit 0, "51 money-path files, 0 finding(s)", including the 10 PORTS money-path files.
- Semgrep MC-01 layer (`tools/semgrep/mc01-money-float.yml`, `--no-git-ignore`) on the 10 PORTS money-path files: **PASS**. 13 rules, 10 files, 0 findings.
- Vendored Semgrep JS/TS rules (a84ff9cc…) on src/nova-ports, src/status and the PORTS tests: **PASS**. 203 rules, 31 files, 0 findings.
- gitleaks (`--no-git`, on a /tmp copy of the PORTS sources and tests): **PASS**, "no leaks found".
  - A grep for `process.env`, `fetch(`, URLs, Bearer, key, token and mnemonic names found only the payout fakes' HMAC `secret`, a `Uint8Array` the test generates at run time.
  - The import closure is only amounts, status, network/types, the ports themselves and `node:crypto`. No LLM or agent SDK (MC-34).
- **MC-07 branch coverage (100% per money-path file, `vitest.config.ts` thresholds, scripts/ci.sh coverage stage): FAIL.**
  - Coverage of src/nova-ports/*.ts and src/status/*.ts, over all 27 test files that import them (1037 tests): every file is at 100% except **payment-store.ts, with 99.78% branches; line 1002 is uncovered.**
  - That branch is unreachable through the port (B1 below), and docs/COVERAGE_EXCLUSIONS.md has no rows.
- MC-08 Stryker (copy; repo config with the vitest config limited to the 13 PORTS test files): **PASS**, 96.60% (break 90). 4616 mutants: 4457 killed, 2 timeouts, 155 survived, 2 no coverage.
  - Per file: gas-dust, payout and journey 100; status/index 99.42; ledger 98.84; wallet-registry 98.00; conversion 97.96; payment-store 96.93 (39 survived, 1 no coverage); receiver 94.74; ids 90.91; fakes 91.77–98.28.
  - Command: `npx stryker run stryker.ports.json --mutate 'src/nova-ports/*.ts,src/nova-ports/fakes/*.ts,src/status/index.ts,src/status/journey.ts' --tempDirName .stryker-tmp-verify-PORTS --reporters clear-text,json` (concurrency 2).
- Hand mutants (18, in the copy, each restored): **16 killed, 2 survived.**
  - Killed: H1 P2R value unchecked; H2 late close without "P2R not yet enqueued"; H3 late close with any outbox containing P2R; H5 the m1 revert; H6 the PAYOUT gate removed; H7 the close limited to PAYOUT_FAILED; H8 the close without arcDone; H9 P1 uniqueness off; H10 P11/P2R without a P2P; H11 `some` → `every` on the amounts; H12 asset unchecked; H13 approver regex `\S+`; H15 the event-sourced replay ignoring the outbox; H16 the amount rule only for P11; H17 the claimed-log check removed; H18 the late path skipping closeByReturn.
  - Survived:
    - H14 (`toUpperCase` → `toLowerCase`): an equivalent mutant, because the ids are ASCII-only after `APPROVER_RE`;
    - H4 (late close without "P11 enqueued"): a real test gap (m6).
- Integer units, recomputed by hand and then by probe through U1 `nativeWeiToCbsMinor`: **PASS**.
  - At p = 6 (k = 10^12), as (minor, dust wei): 0 → (0, 0); 1 → (0, 1); 10^12 → (1, 0); 123,456,789,012,345 → (123, 456,789,012,345); 999,999,999,999 → (0, 999,999,999,999); 10^18 → (1,000,000, 0).
  - At p = 2 (k = 10^16): 10^18 + 7 → (100, 7).
  - At p = 18: 5 → (5, 0).
  - `cbsMinorToNativeWei`: A = 1,000,000 at p = 6 → 10^18, which is the test binding amount that the B1 fix compares; 1 → 10^12.
  - `checkSplit` accepts (123, 456,789,012,345) and refuses (124, 0).
  - All match the hand values.
- Both fakes pass the same contract tests: **PASS**.
  - Each of the 7 port suites has exactly one `describe.each(FACTORIES)` over two structurally different fakes: MapLedger/EventLogLedger; MapPaymentStore/EventSourcedPaymentStore; MapWalletRegistry/ListWalletRegistry; FixedRateConversion/LadderConversion; ImmediatePayout/AsyncCallbackPayout; CounterDustStore/LedgerRowDustStore; MapReceivers/VersionedReceivers.
  - Every probe below gave the same result on both fakes of each pair.
- Postings balance in integer units: **PASS**.
  - checkJournalShape (ledger.ts:205–228): ≥ 2 legs, every amount > 0, both sides present, Σ DR = Σ CR with U1 checked addition. Overflow is a typed INVALID_JOURNAL.
  - The property test passes.
- Postings bound to the payment:
  - P1 (once), P6 (mirror of P1, once, after P2R or P11 when P2P exists), P7 (mirror, once), and P11/P2R (amount A of P2P): **PASS**;
  - P2, P2I, P2P, P11 and P2R exactly once per payment, and P2 after P6: **not enforced at the ledger** (m2).
- REVERSED only through compensating entries: **PASS** (unchanged since the last pass; re-run).
  - `toTransactionStatus` returns REVERSED only for COMPLETED with `compensatedBy` (status/index.ts:151–157).
  - decideCompensation needs SETTLED and the `pay:<id>:p7` receipt compensating `pay:<id>:p2`/`:p2i` (payment-store.ts:768–787).
  - The ledger's P7 must mirror an uncompensated P2, P2I or P3 (ledger.ts:274–282).
  - The receipts are the caller's [inspection-only] (m5).
- Stage → TransactionStatus mapping, tested exhaustively: **PASS**.
  - STATUS_BY_STAGE (status/index.ts:95–105) re-read against §13.2 row by row: CREATED and PENDING_APPROVAL → PENDING; APPROVED, SUBMITTED and CONFIRMING → PROCESSING; COMPLETED → SETTLED, or REVERSED only with P7; REJECTED, EXPIRED and CANCELLED → FAILED.
  - The reason lists equal §13.2's (9 + 3 + 2).
  - My count of legal (stage, reason) pairs is 5 + 1 + 9 + 3 + 2 = 20. test/unit/ports-status.test.ts:88 pins exactly 20, :61 pins the table, and :213 runs the full leg × state × state × source × request oracle.
  - status/index.ts is unchanged since 2026-10-06, and its Stryker score is 99.42 (2 equivalent survivors).
- Mainnet only as a disabled entry: **PASS**.
  - `WalletCustody.dfnsNetwork` is the literal `'ArcTestnet'` (wallet-registry.ts:22), and decideRegister returns NETWORK_DISABLED for anything else (:83).
  - No `5042` or `'Arc'` network value appears in PORTS.
  - test/unit/mainnet-gate.test.ts passes.
- Inbound dedupe and authenticity at the store: **PASS**.
  - One inbox. A changed digest is SIGNAL_CONFLICT.
  - A claimed key is refused for any other subject.
  - The late P2R needs the claimed log's inbox row with a matching digest (:999).
  - The authenticity of the sources sits upstream [inspection-only].
- DFNS/Arc facts the unit cites, re-checked against the archive (sha256 recomputed = MANIFEST): **PASS**.
  - `ArcTestnet`: dfns/networks_index.md:34 "| Arc | ArcTestnet | 1 | N/A | 10 | | |". sha256 1330da14…a253 = MANIFEST:96.
  - Chain ID 5042002 (constants C-01): arc/arc_references_rpc-endpoints.md:64 "| **Chain ID (Testnet)** | `5042002` |". sha256 80324031…3095 = MANIFEST:24.
  - "DFNS rejects only from Pending" (status/index.ts:207): dfns/guides_developers_transaction-monitoring.md:38 "Pending --> Rejected". sha256 90d71b9f…c56c = MANIFEST:109.
  - externalId of at most 50 characters (the marker `nv1-` + 40 hex = 44): dfns/api-reference_wallets_transfer-asset.md:163–165 "maxLength: 50". sha256 674d5346…66ae = MANIFEST:217.
  - No invented fact was found.
- Gate tests outside the target (not counted, N1):
  - test/unit/money-path.test.ts fails 1 test: `src/ops/{audit,ports,queue,types}.ts` are listed in MONEY_PATH.md but not in the stryker `mutate`. This is the OPS unit's work in progress.
  - test/unit/money-float-lint.test.ts fails 2 planted-copy tests. The planted copies report 16 findings in src/gateway/wrapper.ts:121–161, while the lint on the real tree is clean.
  - No PORTS file is involved in either.

## Probes (scratch only; the output was identical on both fakes of each pair)

```
Ledger (MapLedger, EventLogLedger)
L1  P1 300 OK; P6 300 OK; P2 300 (pay:a:p2) after P6 → OK. GL-5 clearing DR 600 / CR 300 (released twice)
L2  P1 300; P2 300 OK; P2 300 again under pay:a:p2-again → OK. Clearing DR 600 / CR 300
L3  P2P 200 twice (two keys) OK; P11 200 twice OK; P2R 200 twice OK. partner DR 400 / CR 400, partnerClaim DR 400 / CR 400
L4  P2P 200; P2R 200 crediting partner OK; then P11 200 → OK. partner DR 200 / CR 400 (an asset account below zero)
L5  P11 200 with DR CUSTOMER payer / CR arc.hot (not the §9.2 accounts) → OK

PaymentStore (MapPaymentStore, EventSourcedPaymentStore)
S1  FIAT_BANK, PAYOUT REJECTED/PAYOUT_FAILED, A = 1e18 wei. A two-person-approved case with expected.value = 5e17:
    claimInbound(log, 5e17) → claimedBy = case, MATCHED (the log is NOT sent to P9)
    closeFailedPayout(log, [p2r, p6]) → ILLEGAL_TRANSITION "expects a return of 5e17, not … 1e18"   (B1 fixed)
    claimInbound(second log, value 1e18) → claimedBy null (the case is no longer OPEN: P9)
    CLOSE_PARTNER_UNRETURNED + [p11, p6] → ILLEGAL_TRANSITION "case … is MATCHED"; the payment cannot close
S2  Arc COMPLETED; PAYOUT CANCELLED/CANCELLED_BY_OPERATOR (ABORT_ACCEPTED) → APPLIED; F-17 close [p11, p6] → OK   (m1 fixed)
S3  RESERVE COMPLETED, Arc marker set; PAYOUT METHOD_NOT_ENABLED with [p6] → ILLEGAL_TRANSITION (a live request ahead)
S4  approvers: see the m5 row above
S5  after [p11, p6]: late [p2r] on the decision → refused "needs the Arc log"; claim; late [p2r] on the log → OK;
    same key with another payload → refused; [p2r, p6] again → OK (replay, nothing new).
    outbox = [p11, p6, p2r]
```

## DEFECTS

**B1** · src/nova-ports/payment-store.ts:1002, `const lateWhy = partnerCase === null ? 'no PARTNER_RETURN case' : closeByReturn(…)` · Lens R, RUBRIC MC-07 (100% of reachable branches per money-path file, enforced as a hard per-file threshold in vitest.config.ts:47–58 and the scripts/ci.sh coverage stage), docs/COVERAGE_EXCLUSIONS.md · **blocking** (a mandatory mechanical gate fails; no money risk)
- Coverage over every test that loads PORTS (27 files, 1037 tests) leaves payment-store.ts at 99.78% branches, with line 1002 uncovered. All other PORTS money-path files are at 100%.
- The branch cannot be reached through the port:
  - `late` needs `pay:<id>:p11` already enqueued;
  - P11 is enqueued only by closeByClaim, which runs only after `partnerCase === null` was refused (:1008);
  - a case is never deleted, and both fakes rebuild cases on restart.
- It is not a compiler-proven exhaustiveness guard, so COVERAGE_EXCLUSIONS.md does not allow it to be excluded.
- `npx vitest run --coverage` therefore fails for payment-store.ts, and scripts/ci.sh fails with it.
- Stryker shows the same branch as survivors (:1002 ConditionalExpression and StringLiteral).
- Fix: drop the null arm. For example, compute `late` only when `partnerCase !== null`, or move the `partnerCase === null` refusal (:1008) above the late branch so both paths share it. Re-run coverage.

**m1** · payment-store.ts:1028–1041 (decidePutCase does not compare `expected.value` with the subject payment's `binding.amount`) and :1061–1075 (decideClaim matches any OPEN case by its own `expected`) · design §9.2 P2R "with `value = cbsMinorToNativeWei(A, p)`. A return of any other value does not match; it goes to P9 and the case stays open", §12 F-17 (same) · minor (fails closed: no wrong posting is possible after the B1 fix, but the payment is stranded)
- Probe S1, on both fakes: a two-person-approved case with value A/2 claims the A/2 log, which is then neither P9 nor closable.
- The case goes MATCHED, so:
  - the P11 branch is refused ("case … is MATCHED");
  - the P2R branch is refused (value ≠ A);
  - the exact return of A later finds no OPEN case and goes to P9.
- The payer's A + F stays frozen in GL-5. The unposted A/2 receipt drifts the chain invariant and PAUSEs the rail.
- The B1 contract test (:1316) is named "the log goes to P9", but it asserts the opposite (`claimedBy` MATCHED). The name is inaccurate.
- The same unbound value also breaks branch 2: with a P11 close on such a case, the later exact return never matches it.
- Fix:
  - refuse a PARTNER_RETURN case at putCase unless `expected.value` equals the subject payment's `binding.amount` (read the payment in the same commit); or make decideClaim match only cases whose value equals their payment's `binding.amount`;
  - rename or fix the :1316 test, and add a test that the exact-A return still closes after a wrong-value log.

**m2** · src/nova-ports/ledger.ts:283–293 (exactly-once is enforced for P1 and P6 only; `RELEASING_TEMPLATES` is consulted only in releaseRule, :307) · design §9.3 "clearing is released exactly once, either by P2 or P2I … or by P6 … A payment is never released twice", §9.2 P2P/P11/P2R "A" per payment · minor (defence in depth: the store's state machine and the deterministic §10.2 keys prevent these upstream, and reconciliation drift PAUSEs. Consistent with the previous pass's P1 ruling)
- Probes L1–L4, identical on both ledger fakes:
  - P2 after P6 is accepted, leaving GL-5 at DR 600 / CR 300;
  - P2 twice under two keys is accepted;
  - P2P, P11 and P2R are each accepted twice;
  - P11 after a P2R that credited `partner` leaves `partner` at DR 200 / CR 400.
- L5: the template's accounts are not checked (a P11 debiting a CUSTOMER account and crediting `arc.hot` is accepted).
- Nova's adapter must reproduce this contract [A-34], so the gap would carry into the real ledger.
- Fix: refuse a second P2, P2I, P2P, P11 or P2R for a payment (BINDING_MISMATCH), and any P2/P2I once a P6 exists, as P6 is refused once a P2/P2I exists. Optionally check each payment template's GL roles against §9.2. Add the L1–L4 cases to ports-ledger.contract.

**m3** (carried m7) · payment-store.ts:84–87 · no ApprovedMoveRecord, ApprovedFundingRecord, putMove, getMove or putFunding, and no funding claims in claimInbound · §7.3, §9.2 P8/P10 · minor (fails closed: an unclaimed inbound log is the caller's P9).

**m4** (carried m8) · payment-store.ts:73–87 and ledger.ts:35–42 list the deviations from §7 "exact signatures", each saying "a design delta must record them" · minor
- The deviations: LedgerBalance, receipt `template`/`refs`, INVALID_JOURNAL, ALREADY_COMPENSATED, the `:p7f` key, NOT_READY, the extra unpause and lift codes, `incident`, `txHash`, `matchedLog`, closeFailedPayout, getCase, recordCompensation and pendingOutbox.
- A grep of NOVA_ARC_DESIGN_DELTA-1.md for any of them finds none.

**m5** (carried m9) · payment-store.ts:758–787 · recordCompensation checks the keys and refs of the caller's P7 and original receipts, but cannot check that the ledger posted them · minor [inspection-only]. The P3 fee's own P7 (`pay:<id>:p7f`) is outside the design's single `:p7` key.

**m6** · tests · RUBRIC MC-08 test strength · minor
- **H4 / Stryker :993:16–65 survives.** Without "P11 already enqueued", the late branch accepts a P2R-only close in branch 1, before any P6. No test offers `[p2r]` alone to closeFailedPayout before a close.
- **Stryker :988:7–60 survives.** Dropping `payout === undefined || !isFailureStage(payout.stage)` leaves only `!arcDone`.
  - closeFailedPayout would then enqueue P6 with P11 for a SETTLED stablecoin payment, or for a fiat payout still live after the Arc leg COMPLETED.
  - With L1 (the ledger accepts a P2 after P6), a later PAID would settle a payment whose payer was already refunded.
  - The code is right today, but no test pins it. Add both cases (a live PAYOUT at SUBMITTED with Arc COMPLETED, and a SETTLED stablecoin payment), each refused.
- **Stryker :1017:75–109 survives** (caseKey ignores `expected`). putCase with the same id but a different `expected` would replay OK instead of KEY_CONFLICT. Add the test.
- **Stryker :714 survives** (the regex loses an anchor). An externalId with trailing characters would be accepted, for example 45+ characters, against DFNS's `maxLength: 50`. Add a test.
- **Stryker :437, :442 and :448 survive.** The p11 and p2r key formats and the `nv1-case` caseId derivation are not pinned to §10.2 vectors (the tests use the same helpers). Add one literal vector each.
- The other logic survivors were read [inspection-only] and are equivalent:
  - :587 (only PAYOUT can fail after Arc COMPLETED);
  - :962 (optional chaining on a PARTNER_RETURN case);
  - :880/:881 (equal blocks);
  - :798 (ASCII ids);
  - ledger.ts:323 (two equal P2P legs) and :333/:334.

**N1 (outside the target, not counted)**
- test/unit/money-path.test.ts: src/ops/* are in MONEY_PATH.md but not in the stryker `mutate` (OPS work in progress).
- test/unit/money-float-lint.test.ts: 2 planted-copy tests see 16 findings in src/gateway/wrapper.ts:121–161.
- Both must be green before any full CI run.

## VERDICT

NEGATIVE (7 defects: 1 blocking, B1, the MC-07 coverage gate; 6 minor, m1–m6. N1 is outside the target)
