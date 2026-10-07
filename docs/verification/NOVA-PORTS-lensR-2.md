VERIFICATION · lens: R · target: PORTS (src/nova-ports/**, src/status/** and their tests) after fix block 1 · commit: a1fa1e6 + working tree

Snapshot verified: HEAD a1fa1e6, plus the uncommitted working-tree edits to two files:
- src/nova-ports/payment-store.ts, md5 56669185…4028;
- test/property/ports-postings.property.test.ts, md5 1e012c3f…fe34.

Every other PORTS source and test file equals HEAD. The fix to NOVA-PORTS-lensR-1 landed in 62df8a6 and in those two working-tree edits. The md5 of every PORTS file was the same at the start and at the end of this pass. The pass ran 2026-10-07 15:34–15:55 SAST.

Verifier: an independent verifier subagent with a fresh context.

Inputs used:
- docs/NOVA_ARC_DESIGN.md: §7.3 (putCase), §9.1–§9.3, §10.2, §12 F-17 and §13.2–§13.3;
- docs/NOVA_ARC_DESIGN_DELTA-1.md (PORTS signature deviations);
- CLAUDE.md money rules;
- docs/constants.md;
- the archived DFNS and Arc pages under docs/sources/, checked against MANIFEST.md;
- the code and the tests.

I did not trust the author's comments, commit messages or test names.

Method:
- Node v22.23.3 from .tools/node/bin.
- No network calls. No .env reads. No secrets. No DFNS, Circle or VALR API call. Nothing was signed or broadcast.
- Three mkdtemp real-file copies were made with tar, using anchored excludes for ./.git, ./.env*, ./.tools, ./reports, ./coverage, ./dist and ./.stryker-tmp*. Each copy has 30 symlinks, all under node_modules/.bin, and none resolves into the repo.
  - /tmp/verify-ports2b-IeCj95: checks, Stryker and probes.
  - /tmp/verify-ports2m-jp8svt: hand mutants. Each mutant was restored after its run, and the md5s were re-checked.
  - /tmp/verify-ports2-9UgZnI: a first copy, abandoned. An unanchored `dist` exclude had stripped node_modules/*/dist from it, and it was not used for any result.
- Stryker ran with `--tempDirName .stryker-tmp-verify-PORTS2`, with the repo config's vitest config limited to the 14 PORTS test files. It never used the default temp dir, and the full ci.sh was not run.

## Status of the previous pass's defects (NOVA-PORTS-lensR-1)

| Previous | Now |
|---|---|
| B1 (MC-07): payment-store.ts:1002 branch unreachable and uncovered | **Fixed.** The null arm is gone: `if (late && partnerCase !== null)` (payment-store.ts:1001), and the null case falls through to the shared refusals (:1005, :1008). Coverage over the 34 test files that load PORTS (1371 tests) is 100/100/100/100 for all 10 PORTS money-path files. Hand mutant M16, which reinstates a null arm, survives. That is expected: the branch is unreachable. |
| m1: a PARTNER_RETURN case with a value ≠ A strands the payment | **Fixed.** decidePutCase refuses BINDING_MISMATCH unless the subject payment exists and `c.expected.value === subjectPayment.binding.amount` (:1044–1046). Both fakes pass the payment in: MapPaymentStore `this.#records.get(c.subject)` (payment-store-fakes.ts:395) and EventSourcedPaymentStore `this.#fold(c.subject)` (:858). Probe S1 on both fakes: A/2 and A + 1 wei are refused; a wrong-value log is not claimed (`claimedBy` null, so it goes to P9); the exact-A log is claimed; closeFailedPayout after a restart returns APPLIED. The contract test is renamed and asserts this (ports-payment-store.contract.test.ts:1318). |
| m2: the ledger does not enforce exactly-once for P2, P2I, P2P, P11 and P2R | **Fixed for the listed templates** (ledger.ts:286–289, :302–324). Probes L1, L2, L9 and L10 on both fakes: a P2 after P6, a P2 twice, a P2I twice, and a P2 or P6 after a P7 are each refused BINDING_MISMATCH. A late P2R after P11 is still accepted (F-17). Hand mutants M3–M8 are all killed. **Residual:** P3 and the template accounts are still unbound (n1). |
| m3: moves and funding not built | Open, and it fails closed. Carried as m3. |
| m4: signature drift not recorded in a design delta | **Fixed.** NOVA_ARC_DESIGN_DELTA-1.md:173–177 (B-1, B-2, B-3) records every deviation the previous pass listed, plus the new putCase BINDING_MISMATCH and the once-per-payment rule. One small header drift remains (n3). |
| m5: compensation trusts the caller's receipts | Open [inspection-only]. Carried as m5. |
| m6: test gaps | **Fixed.** Every gap the previous pass named now has a test: H4 (a lone P2R as a first close), the payout-failure gate, caseKey `expected`, the externalId regex anchors, and the literal §10.2 vectors (ports-payment-store.contract.test.ts:232–233, :1338–1371). Hand mutants M9 and M13 are killed. Stryker no longer reports survivors at the old :988, :993, :1017, :714, :437, :442 or :448. |

## CHECKS

- **`npx tsc --noEmit` on the copy: PASS for the target; the repo-wide run FAILS outside the target.**
  - The run exits 2 with one error, in src/journey/payin/cases.ts:60: `ACCEPT_WITH_CONSENT` is missing `quoteId`/`settlementDigest` against the OPS `CaseOption` type.
  - No PORTS file has an error (N1).
- **Target tests: PASS**, 440/440. These are the 14 files: 7 port contract suites, ports-fakes, ports-ids, ports-journey, ports-status, ports-store-decide, ports-postings.property, and mainnet-gate.
- **Downstream regression: PASS**, 1371/1371. These are the 34 test files that import src/nova-ports or src/status.
- **MC-01 float lint** (`node tools/lint-money-floats.mjs`): **PASS**, exit 0, "52 money-path files, 0 finding(s)".
- **Semgrep MC-01 layer** (tools/semgrep/mc01-money-float.yml, `--no-git-ignore`) on the 10 PORTS money-path files: **PASS**, 13 rules, 10 files, 0 findings.
- **Vendored Semgrep JS/TS rules (a84ff9cc…)** on src/nova-ports, src/status and the PORTS tests: **PASS**, 203 rules, 31 files, 0 findings.
- **gitleaks 8.30.1** (`--no-git`, on a /tmp copy of the PORTS sources and tests): **PASS**, "no leaks found".
  - A grep for `process.env`, `fetch(`, URLs, Bearer, apiKey, mnemonic, privateKey and token in src/nova-ports and src/status finds nothing.
- **MC-07 branch coverage: PASS**, 100% lines, branches, functions and statements on each PORTS money-path file (conversion, gas-dust, ids, ledger, payment-store, payout, receiver, wallet-registry, status/index, status/journey).
- **MC-08 Stryker: PASS**, 96.87% (break 90).
  - Command: `npx stryker run stryker.ports.json --mutate 'src/nova-ports/*.ts,src/nova-ports/fakes/*.ts,src/status/index.ts,src/status/journey.ts' --tempDirName .stryker-tmp-verify-PORTS2 --reporters clear-text,json`.
  - 4669 mutants: 4521 killed, 2 timeouts, 145 survived, 1 no coverage.
  - Per file: gas-dust, payout and journey 100; status/index 99.42; ledger 98.71; wallet-registry 98.00; conversion 97.96; payment-store 97.87 (up from 96.93); receiver 94.74; ids 90.91; fakes 91.77–98.28.
  - Logic survivors, read one by one:
    - payment-store.ts:
      - :1001 `partnerCase !== null` → true is the unreachable arm (equivalent; M16);
      - :1044 `?.` → `.` is equivalent, because `expected` is non-null for a PARTNER_RETURN (thrown at :1038);
      - :458, :587, :601, :665, :798, :880, :881, :936 and :1078 are equivalent;
      - :562 and :636 are equivalent or stricter (decisionRule re-checks the subject; a non-link decision carries no txHash);
      - :921 and :952 turn a typed refusal into a thrown TypeError on a null decision. That state is unreachable once `seen` is non-null (a recorded `op:` row implies the decision), and it fails closed.
    - ledger.ts: :322 (`req.template === 'P11…'` → true) only makes the rule stricter; :352 is two equal P2P legs; :362 and :363 are the seen-set.
    - ids.ts :136–155 (7 survivors) are flagged `static: true`. They are artefacts of the Stryker vitest runner, not test gaps: by hand, M22 (lpDigestHex returns undefined), M23 (no length prefix) and M24 (byte length doubled) are all killed by the §10.2 literal-vector tests.
- **Hand mutants:** 24 run, each restored. **23 killed, 1 survived.**
  - Killed:
    - putCase: M1 binding check removed; M2 missing payment allowed; M14 and M15, either fake not passing the payment;
    - ledger exactly-once: M3 same-template check; M4 release after release; M5 P11 after P2R; M6, M7 and M8, P2P, P2I or P2R dropped from the list; M18 the P6-after-P2P rule;
    - F-17 close: M9 (H4: late close without P11 enqueued); M10 evidence source unchecked; M11 claimed log unchecked; M13 payout-failure gate;
    - claim: M12 value not compared; M17 an ambiguous match claims the first;
    - status: M19 CONFIRMING → PENDING; M20 REVERSED off COMPLETED; M21 EXPIRED → PENDING;
    - ids: M22, M23, M24.
  - Survived: M16, which is equivalent (unreachable).
- **Integer units, by hand and then by probe through U1: PASS.**
  - At p = 6 (k = 10^12), wei → (minor, dust): 0 → (0, 0); 1 → (0, 1); 10^12 → (1, 0); 123,456,789,012,345 → (123, 456,789,012,345); 999,999,999,999 → (0, 999,999,999,999); 10^18 → (1,000,000, 0).
  - At p = 2 (k = 10^16): 10^18 + 7 → (100, 7).
  - At p = 18: 5 → (5, 0).
  - `cbsMinorToNativeWei(1,000,000, p6)` = 10^18. This is the test binding amount that putCase now compares; 1 → 10^12.
  - All match the hand values.
- **Both fakes pass the same contract tests: PASS.**
  - Each of the 7 port suites has exactly one `describe.each(FACTORIES)` over two structurally different fakes, with no `it` outside it: MapLedger/EventLogLedger; MapPaymentStore/EventSourcedPaymentStore; MapWalletRegistry/ListWalletRegistry; FixedRateConversion/LadderConversion; ImmediatePayout/AsyncCallbackPayout; CounterDustStore/LedgerRowDustStore; MapReceivers/VersionedReceivers.
  - Every probe below gave the same output on both fakes of each pair.
- **Postings always balance in integer units: PASS.**
  - checkJournalShape (ledger.ts:205–228) requires ≥ 2 legs, every amount > 0, both sides present, and Σ DR = Σ CR with U1 checked addition; an overflow is a typed INVALID_JOURNAL.
  - The property test passes. After the edit, each key is its own payment, so P2 once per payment holds, and the P7 still targets the original's payment.
- **Postings bound per payment:**
  - P1, P2, P2I, P2P, P11 and P2R once each; P2/P2I/P6 release once; P11 not after P2R; P6 mirroring P1; P11/P2R equal to the P2P amount: **PASS**.
  - P3 once, P3 not after P6, and the template GL accounts: **not enforced** (n1).
- **REVERSED only through compensating entries: PASS.**
  - `toTransactionStatus` returns REVERSED only for COMPLETED with `compensatedBy` (status/index.ts:151–157); M20 is killed.
  - The ledger's P7 must mirror an uncompensated P2, P2I or P3 of the same payment (ledger.ts:273–281).
  - After a P7, probe L9 shows a new P2 and a P6 are both refused.
  - The compensation receipts come from the caller [inspection-only] (m5).
- **Stage → TransactionStatus mapping, tested exhaustively: PASS.**
  - STATUS_BY_STAGE (status/index.ts:95–105) re-read row by row against §13.2 (design :1116–1127):
    - CREATED, PENDING_APPROVAL → PENDING;
    - APPROVED, SUBMITTED, CONFIRMING → PROCESSING;
    - COMPLETED → SETTLED, or REVERSED only with P7;
    - REJECTED, EXPIRED, CANCELLED → FAILED.
  - The reason lists are 9 + 3 + 2, equal to §13.2. Legal (stage, reason) pairs: 5 + 1 + 9 + 3 + 2 = 20, pinned in test/unit/ports-status.test.ts.
  - src/status is unchanged since 8448431. Mutants M19, M20 and M21 are killed.
- **Mainnet only as a disabled entry: PASS.**
  - `WalletCustody.dfnsNetwork` is the literal `'ArcTestnet'` (wallet-registry.ts:22), and decideRegister refuses anything else (:83).
  - The only `'Arc'` in PORTS is a comment (:9). There is no `5042` chain ID.
  - mainnet-gate.test.ts passes.
- **Inbound dedupe and authenticity at the store: PASS.**
  - One inbox. A changed digest is SIGNAL_CONFLICT (decideClaim :1075).
  - A claimed key is refused for any other subject (:1077).
  - The close needs the inbox row with a matching digest (:998) and the case's `matchedLog` (:963).
  - The authenticity of the sources sits upstream [inspection-only].
- **DFNS/Arc facts the unit cites, re-checked against the archive** (sha256 recomputed and equal to MANIFEST): **PASS.**
  - `ArcTestnet` [DF:networks]: dfns/networks_index.md:34 "| Arc | ArcTestnet | 1 | N/A | 10 | | |". sha256 1330da14…a253 = MANIFEST:96.
  - Chain ID 5042002: arc/arc_references_rpc-endpoints.md:64 "| **Chain ID (Testnet)** | `5042002` |". sha256 80324031…3095 = MANIFEST:24.
  - "DFNS rejects only from Pending" (status/index.ts:207): dfns/guides_developers_transaction-monitoring.md:38 "Pending --> Rejected". sha256 90d71b9f…c56c = MANIFEST:109.
  - externalId of at most 50 characters (`nv1-` + 40 hex = 44): dfns/api-reference_wallets_transfer-asset.md:163–166 "maxLength: 50". sha256 674d5346…66ae = MANIFEST:217.
  - No invented fact was found.
- **§10.2 vectors, recomputed outside the code** (Python, with `lp` = 4-byte big-endian length ‖ UTF-8):
  - `caseId(PARTNER_RETURN, pay-0101…01)` = case-298bb3c40459c5208026e9b2b8706ba9;
  - `caseId(NONCE_BURN, …)` = case-24000f25d403b300f81f60582dcf4bb2.
  - Both equal the literals in the contract test.
- **Gate tests outside the target (not counted, N1):**
  - money-path.test.ts "Stryker mutate (MC-08)" fails: MONEY_PATH.md now lists src/journey/quote/fill.ts, which is not in stryker `mutate`.
  - money-float-lint.test.ts fails 2 planted-copy tests, with 16 findings in src/gateway/wrapper.ts.
  - tsc fails in src/journey/payin/cases.ts.
  - No PORTS file is involved in any of them.

## Probes (scratch only; identical output on both fakes of each pair)

```
PaymentStore (MapPaymentStore, EventSourcedPaymentStore)
S1  FIAT_BANK, PAYOUT REJECTED/PAYOUT_FAILED after Arc COMPLETED, A = 1e18 wei
    putCase expected 5e17 → REJECTED BINDING_MISMATCH; expected 1e18+1 → REJECTED BINDING_MISMATCH
    putCase expected 1e18 → OK; claimInbound(wrong log, 5e17) → claimedBy null (P9)
    claimInbound(log, 1e18) → MATCHED; restart; closeFailedPayout(log, [p2r, p6]) → OK APPLIED
S2  STABLECOIN_WALLET payment, Arc COMPLETED (SETTLED); OPEN_PARTNER_CASE decision; putCase expected = A → OK
    claimInbound(log of A from 0x9a… to 0xaa…) → MATCHED (not P9); closeFailedPayout → REJECTED ILLEGAL_TRANSITION
S3  payout failed, case claimed the log; closeFailedPayout(log, [p2r]) as a first close → REJECTED; outbox []
S4  putCase expected = 1,000,000 (A in minor units, not wei) → REJECTED BINDING_MISMATCH

Ledger (MapLedger, EventLogLedger)
L1  P1 300, P6 300, then P2 → REJECTED "already released by P6_RELEASE"
L2  P1, P2, P2 under another key → REJECTED "posts P2_SETTLE_EXTERNAL once"
L10 P2I twice → REJECTED
L9  P1, P2, a P7 with mirrored legs in the other order → REJECTED (order-sensitive mirror, which fails closed); then P2 and P6 → REJECTED
L6  P1 305, P2 300, P3 5, P3 5 again under pay:a:p3-again → OK. GL-5 clearing DR 310 / CR 305, GL-6 CR 10
L6b P1 305, P6 305, then P3 5 → OK. Clearing DR 310 / CR 305
L5  P2P, then P11 with DR CUSTOMER payer / CR GL-2 arc.hot → OK
L7  P1, P2P, P2 (PAID, CR partner), then P2R → OK. partner DR 40 / CR 80
L8  P2P, P11, then late P2R crediting `partner` instead of `partnerClaim` → OK. partner DR 40 / CR 80, partnerClaim DR 40 / CR 0
```

## DEFECTS

**n1** · src/nova-ports/ledger.ts:302–308 (`ONCE_PER_PAYMENT` omits `P3_FEE`) and :280–296 (no per-template account check) · design §9.2 "P3_FEE | With P2/P2I", §9.3 "`P1 = P2 + P3` or `P1 = P6` (clearing nets to zero per payment)", §10.2 "one per template" · Lens R, postings bound per payment · **minor**

Why minor: this is defence in depth, the same ruling as R-1 m2.
- §10.2 gives a payment exactly one P3 key (`pay:<id>:p3`), and src/payments/postings.ts:84 derives only that key, so a second P3 needs a key no code path makes.
- The store refuses any change after P6 ("nothing changes after a failure", payment-store.ts:648).
- A clearing drift PAUSEs.

What the probes show:
- Probes L6 and L6b, identical on both fakes:
  - a second P3 under another key is accepted;
  - a P3 after P6 is accepted;
  - either leaves GL-5 clearing at DR 310 / CR 305 and double-counts the fee income.
- The template accounts are still unchecked:
  - L5: a P11 debiting a CUSTOMER account and crediting `arc.hot` is accepted;
  - L8: a late P2R crediting `partner` instead of `partnerClaim` leaves `partner` at DR 40 / CR 80 and the claim open;
  - L7: a P2R after P2 (payout PAID) over-credits `partner`.
- Nova's adapter must reproduce this contract [A-34].

Fix:
- add `P3_FEE` to the once-per-payment rule, and refuse P3 once a P6 exists (P3 goes only with P2/P2I);
- refuse P11 and P2R once a P2 exists;
- optionally check each payment template's GL roles against §9.2 (for example, P2R after P11 must credit `partnerClaim.*`);
- add L6 to L8 to ports-ledger.contract.

**n2** · src/nova-ports/payment-store.ts:1029–1048 (decidePutCase checks the subject payment's existence and amount, but not its state) · design §12 F-17 "Payout partner fails after Arc leg confirmed … Ops opens a `PARTNER_RETURN` case record", §6.1 claim order (P8, then F-17 case, then P9) · Lens R, fail-closed/binding · **minor**

Why minor: it fails closed and needs a two-person decision.

What probe S2 shows, on both fakes:
- A two-person-approved PARTNER_RETURN case opens on a SETTLED STABLECOIN_WALLET payment that has no PAYOUT leg. The same holds for a FIAT_BANK payment whose payout is still live.
- The case then claims a matching inbound log of value A (MATCHED), so the log is not P9. But closeFailedPayout refuses the payment for ever, because its PAYOUT leg has not failed.

Effect: the log's USDC is in our wallet with no posting, so the chain invariant drifts and the rail PAUSEs.

Fix:
- in putCase, refuse a PARTNER_RETURN unless the subject is a FIAT_BANK payment whose PAYOUT leg is in a failure stage after the Arc leg COMPLETED (the predicate at :986–989);
- add the S2 case to the contract.

**n3** · src/nova-ports/payment-store.ts:73–87 and src/nova-ports/ledger.ts:12–43 (header deviation and rule lists) · Lens R, design traceability · **minor**

- NOVA_ARC_DESIGN_DELTA-1.md:173 says "the code headers of src/nova-ports/ledger.ts and payment-store.ts list the same".
- But the payment-store.ts header does not list putCase's new BINDING_MISMATCH, and the ledger.ts header Rules do not state the once-per-payment rule.
- Fix: add both lines.

**m3** (carried, R-1 m3) · payment-store.ts:84–87 · ApprovedMoveRecord, ApprovedFundingRecord, putMove, getMove, putFunding and funding claims in claimInbound are not built · §7.3, §9.2 P8/P10 · **minor** (fails closed: an unclaimed inbound log is the caller's P9).

**m5** (carried, R-1 m5) · payment-store.ts:758–787 · recordCompensation checks the keys and refs of the caller's P7 and original receipts, but cannot check that the ledger posted them · **minor** [inspection-only].

**N1 (outside the target, not counted)**
- tsc fails in src/journey/payin/cases.ts:60, against the OPS `CaseOption`.
- money-path.test.ts: src/journey/quote/fill.ts is in MONEY_PATH.md but not in the stryker `mutate`.
- money-float-lint.test.ts: 2 planted-copy tests report 16 findings in src/gateway/wrapper.ts.
- All of them must be green before any full CI run.

## VERDICT

NEGATIVE (5 defects, all minor: n1, n2, n3, m3, m5. 0 blocking.)
- B1, m1, m2 (for the templates the previous pass listed), m4 and m6 are fixed.
- No money path is missing a control or a fail-closed path. No inbound signal is trusted without dedupe. No DFNS or Arc fact is invented. No secret or real API call is present. Every mandatory lint on the target passes.
