VERIFICATION · lens: R · target: PORTS (src/nova-ports/**, src/status/** and their tests) · commit: 7fe69e2 (branch co1-v3/nova-arc-d1; the target files are untracked working-tree files. payment-store.ts was last modified 2026-10-07 11:20 and payment-store-fakes.ts 11:07. This pass ran 2026-10-07 11:31–12:05 SAST)

Verifier: independent verifier subagent, fresh context. This pass re-verifies PORTS after fix 2 and replaces the 03:58 pass in this file.

Inputs used:
- docs/NOVA_ARC_DESIGN.md (frozen version, 2026-10-06 22:46): §4, §7.1–§7.8, §8.4 checks 2/3/5, §8.6, §9.1–§9.3, §10.2–§10.4, §12 F-17, §13;
- CLAUDE.md money rules, docs/constants.md, docs/MONEY_PATH.md;
- the archived DFNS and Arc pages under docs/sources/;
- the code and the tests.

The author's comments and summaries were not trusted.

Method: Node v22.23.3 from .tools/node/bin. There were no network calls, no .env reads and no secrets. All probes and mutants ran in a mkdtemp real-file copy (/tmp/verify-ports-r2-OW5DrV, made with tar and excluding .git, .env*, .tools and reports). I checked that none of its 30 symlinks (all in node_modules/.bin) resolves into the repo. Each mutant was restored after its run, and `diff -rq` of the copy's src against the repo is empty.

## Status of the previous pass's defects

| Previous defect | Now |
|---|---|
| B1: P6 accepted beside a live DFNS request | **Fixed for the Arc leg.** decideSignal:519 refuses a P6 unless the payment is FAILED after the signal. It gives LEG_UNRESOLVED when the leg is UNRESOLVED. Contract tests S1 and S2 cover it, and hand mutants M1 and M18 are killed. **The P6 rule is still too broad** for two other cases (new B1 and B2). |
| B2: operator decisions unchecked; unpause decision replayable | **Fixed.** recordDecision/getDecision go through the one inbox. The id must derive from the decision's content (§10.2). Approvers must be two different, non-empty ids. An OPERATOR_DECISION transition needs a recorded decision of the right kind for this payment (decisionKindFor, decisionRule). Unpause uses up a recorded UNPAUSE decision (probe Q7: a replay gives DECISION_CONSUMED). Mutants M2–M7, M10 and M20 are killed. Residual weaknesses are m2, m3 and m5. |
| B3: wallet nonce hold absent | **Fixed.** applySignal takes `placeHold` and writes it in the same commit. listActiveHolds, recordHoldObservation, recordHoldNonceTx and liftHold exist. The restart test (snapshot/restore and events/fromEvents) covers holds, markers, decisions, used-up unpauses, the inbox and the outbox. Mutants M8, M9, M19 and M21–M23 are killed. The lift rule is weaker than §8.4 check 5 (m1). |
| m1: ARC_LOG completes without a hash | Fixed (arcLinkRule:543; M12 killed) |
| m2: §7.3 move, funding and case operations absent | Open, now m7 |
| m3: F-18 relink; inbox claims differ between the fakes | Fixed (contract tests "F-18 …", S4 and S5) |
| m4: test gaps M21 (gas-dust:91) and M22 (payment-store:306); no restart test | Fixed. The gas-dust.ts:91 survivors are now only string literals, M13 (the old M22) is killed and a restart test exists. There are new gaps (m6). |
| m5: fault points on reads | Partly fixed. The payment-store fakes now have them. The gas-dust fakes' `balance` and `receiptDustTotal` still have none (m8). |
| m6: signature drift from §7 | Open, now m9 |
| m7: `register` not idempotent per (owner, network, role) | Fixed (wallet-registry.ts:85–90, `byOwnerRole`) |
| m8: compensation trusts caller receipts; paths differ from §3 | Open, now m10 |

## CHECKS

- `npx tsc --noEmit` (repo): **PASS**, exit 0.
- Target tests (repo): **PASS**. 7 contract files, 5 unit files and 1 property file, 352/352 tests.
- `test/unit/money-path.test.ts` (MC-08 recount gate, repo): **FAIL, outside the target.** It lists `src/journey/quote/{compose,fiat,ports}.ts` in docs/MONEY_PATH.md (edited 10:10 for another unit) but not in the stryker.config.json `mutate`. No PORTS row is involved. See N1, which is not counted against PORTS.
- MC-01 float lint `node tools/lint-money-floats.mjs`: **PASS**. 40 money-path files, 0 findings, including the 10 PORTS money-path files.
- Semgrep MC-01 layer (`tools/semgrep/mc01-money-float.yml`, `--no-git-ignore`) on the 10 PORTS money-path files: **PASS**. 13 rules, 0 findings.
- Vendored Semgrep JS/TS rules on src/nova-ports, src/status and the 13 PORTS test files: **PASS**. 203 rules, 31 targets, 0 findings.
- gitleaks (`--no-git`, run on a /tmp copy of the PORTS sources and tests): **PASS**, no leaks.
  - The only HMAC secret is `randomBytes(32)`, generated at test time (test/contract/ports-payout.contract.test.ts:20).
  - A grep for `fetch(`, URLs, DFNS/Circle/VALR hosts, `process.env`, key or token names and chain 5042 found only fake-HMAC parameter names.
- MC-07 coverage, PORTS tests only, run in the scratch copy: **PASS**. All 10 PORTS money-path files are at 100% statements, branches, functions and lines (coverage-summary.json).
- MC-08 Stryker: **PASS**, 95.50% overall (break 90).
  - Command: `npx stryker run <cfg> --mutate 'src/nova-ports/*.ts,src/nova-ports/fakes/*.ts,src/status/index.ts,src/status/journey.ts' --tempDirName .stryker-tmp-verify-PORTS --reporters clear-text`.
  - It ran in the scratch copy because other agents may be editing the repo. The vitest config included only the 13 PORTS test files (352 tests), which is stricter than the full suite.
  - Totals: 3734 mutants: 3564 killed, 2 timeout, 168 survived, 0 no-coverage.
  - Money-path files: journey 100, payout 100, index (status) 99.42, ledger 99.14, wallet-registry 98.00, conversion 97.96, ids 97.40, receiver 94.74, gas-dust 94.44, payment-store 92.24 (66 survivors).
  - Most survivors are error-detail strings or equivalent mutants. I re-planted the logic survivors by hand (m6).
- Hand mutants (26 in a real-file copy, each restored): **25 killed, 1 survived.**
  - Killed:
    - M1: P6 beside any change;
    - M2: decision subject not checked;
    - M3: decision kind not checked;
    - M4: relink by any decision;
    - M5: a used-up unpause decision accepted;
    - M6: an unrecorded unpause decision accepted;
    - M7: same approver accepted;
    - M8: hold on a hashed transfer;
    - M9: lift with a known nonce always allowed;
    - M10: underived decision id;
    - M11: key reused across payments;
    - M12: ARC_LOG without a hash moves the leg;
    - M13: a leg fails while a leg ahead is in flight;
    - M14: P7 of the fee reverses the payment;
    - M15: fee-floor drop before submit;
    - M16: denial while UNRESOLVED;
    - M17: markSubmit ignores a P6;
    - M18: LEG_UNRESOLVED code for P6;
    - M19: hold from any source;
    - M20: unpause by any kind;
    - M21: unknown-nonce close for another hold;
    - M22: observation window order;
    - M23: Map NOOP hold does not claim the key;
    - M24: version not checked;
    - M26: PAYOUT_FAILED from any source.
  - Survived: M25 (`&& rec.status !== 'FAILED'` added to the P6 rule). It is equivalent, because nothing changes after a failure, so a FAILED `rec` gives a FAILED `after`.
  - Stryker logic survivors re-planted by hand: S713a is killed (Stryker's per-test selection was conservative there). S496, S713b, S453, S581, S448 and S536 **survive** (m6).
- Integer units, recomputed by hand and by probe on both ledger fakes: **PASS**.
  - Opening: hot DR 1,000,000, payer CR 1,000,000.
  - Postings, in order:
    - P1 of 1,000,001 → INSUFFICIENT_FUNDS;
    - P1 of 1,000,000 → OK, and the same again replays;
    - 999,999 under the same key → KEY_CONFLICT;
    - P2+P3 (995,000 + 5,000) → OK;
    - a P7 that is not a mirror → BINDING_MISMATCH;
    - the P7 mirror → OK, and a second P7 → ALREADY_COMPENSATED;
    - 5,000 against 4,999 → UNBALANCED;
    - an amount of 0 → INVALID_JOURNAL.
  - My hand totals, with both fakes giving the same numbers:

    | Account | Debits | Credits |
    |---|---|---|
    | payer | 1,000,000 | 1,000,000 |
    | clearing | 1,000,000 | 2,000,000 |
    | hot | 1,995,000 | 995,000 |
    | fees | 5,000 | 5,000 |
    | **Total** | **4,000,000** | **4,000,000** |

  - U1 at p = 6 (k = 10^12), as (g, d) for G wei:

    | G (wei) | g (minor) | d (wei) |
    |---|---|---|
    | 0 | 0 | 0 |
    | 1 | 0 | 1 |
    | 10^12 | 1 | 0 |
    | 420,000,000,000,000 | 420 | 0 |
    | 123,456,789,012,345 | 123 | 456,789,012,345 |
    | 999,999,999,999 | 0 | 999,999,999,999 |
    | 10^18 | 1,000,000 | 0 |

    1 USDC = 1,000,000 minor = 10^18 wei. All match.
- DFNS/Arc facts the unit cites, re-checked against the archive with sha256 equal to the MANIFEST: **PASS**.
  - `ArcTestnet`: networks_index.md:34 "| Arc | ArcTestnet | 1 | N/A | 10 | | |". sha256 1330da14…a253 = MANIFEST:96.
  - Chain ID 5042002: arc_references_rpc-endpoints.md:64 "| **Chain ID (Testnet)** | `5042002` |". sha256 80324031…3095 = MANIFEST:24; constants C-01.
  - "DFNS rejects only from Pending" (status/index.ts:207): guides_developers_transaction-monitoring.md:38 "Pending --> Rejected" and :50 "Blocked by policy or approval rejected". sha256 90d71b9f…c56c = MANIFEST:109.
  - Abort only while unsigned in `Executing` (proof (a2), status/index.ts:202): api-reference_wallets_abort-transfer.md:7 "Aborts a transfer that is currently in 'Executing' status and has not yet been signed". sha256 3dba876e…566b = MANIFEST:205.
  - externalId of at most 50 characters (marker `nv1-` + 40 hex = 44): api-reference_wallets_transfer-asset.md:163–166. sha256 674d5346…66ae = MANIFEST:217.
  - No invented fact was found.
- Mainnet only as a disabled entry: **PASS**. `WalletCustody.dfnsNetwork` is the literal `'ArcTestnet'`, and decideRegister:83 returns NETWORK_DISABLED for anything else, with a test.
- Both fakes pass the same contract tests: **PASS**. 7 ports have one `describe.each(FACTORIES)` each, with two structurally different fakes per port (§7.8 names: MapLedger/EventLogLedger, MapPaymentStore/EventSourcedPaymentStore, MapWalletRegistry/ListWalletRegistry, FixedRateConversion/LadderConversion, ImmediatePayout/AsyncCallbackPayout, CounterDustStore/LedgerRowDustStore, MapReceivers/VersionedReceivers). Every probe below gave the same result on both store fakes.
- Postings always balance in integer units: **PASS** (checkJournalShape, checkTotals, the property test and the probes above).
- Postings are bound to the payment's state: **FAIL**. A P6 is accepted with no P1 behind it, and with a fiat-payout failure (B1, B2).
- REVERSED only through compensating entries: **PASS**.
  - toTransactionStatus returns REVERSED only for COMPLETED with `compensatedBy`, and throws otherwise.
  - decideCompensation needs SETTLED and the P7 of this payment's P2 or P2I (M14 killed).
  - The ledger binds P7 to an existing P2, P2I or P3 as a mirror, once only.
  - The receipts given to recordCompensation are trusted [inspection-only] (m10).
- Stage → TransactionStatus mapping table tested exhaustively: **PASS**.
  - test/unit/ports-status.test.ts:61 pins STATUS_BY_STAGE row for row against §13.2, with the reason lists exact (14).
  - :90 checks that exactly 20 legal (stage, reason) pairs exist, and :120 that the other 115 throw.
  - :213 compares decideTransition with an independent per-row oracle over 5 × 20 × 20 × 8 × 3 = 48,000 cases, with 0 mismatches.
  - I re-derived FAILURE_RULES, COMPLETION_RULES and PROGRESS_RULES against §13.3 and §8.6 by hand, and they agree.
- §13.3 UNRESOLVED rule: **PASS** (LEG_UNRESOLVED for every terminal target and every P6; contract "UNRESOLVED leg …", S1).
- Two-person controls at the store: **PASS** (above). There are residual weaknesses, m2, m3 and m5.
- Wallet nonce hold persisted with its signal, and surviving a restart: **PASS**. The lift rule is weaker than §8.4 check 5 (m1).
- Inbound dedupe at the store: **PASS**.
  - One inbox for signals, ranges, decisions and lifts.
  - A changed digest is SIGNAL_CONFLICT.
  - A key applied to one payment is refused for another.
  - A STALE signal does not claim a key (S5).
- Authenticity of DFNS, log and payout signals sits upstream (webhook verifier, indexer, `verifyCallback`) [inspection-only]. The payout fakes compare HMACs with `timingSafeEqual`.
- MC-06 precision gate at the port: **PASS** (PRECISION_MISMATCH and ASSET_UNKNOWN come before any write).

## Probes (both store fakes, both ledger fakes)

Every probe gave the same result on both fakes of each pair.

```
Q1  FIAT_BANK: Arc COMPLETED, PAYOUT SUBMITTED; PAYOUT_CALLBACK REJECTED/PAYOUT_FAILED with outbox [pay:<id>:p6]
    → OK APPLIED FAILED, outbox = [p6]   (no CLOSE_PARTNER_UNRETURNED decision, no P2R)
Q2  same payment already FAILED; recorded CLOSE_PARTNER_UNRETURNED decision signal with [p6, p11] → OK DUPLICATE, outbox = []
    a stale DFNS_POLL with [p6] → OK STALE, outbox = []   (accepted, then silently not enqueued)
R1  new payment; RESERVE REJECTED/INSUFFICIENT_FUNDS (LEDGER, so P1 was refused) with [p6] → OK APPLIED FAILED, outbox = [p6]
    RESERVE REJECTED/METHOD_NOT_ENABLED (INTERNAL) with [p6] → OK, outbox = [p6]
LP6 ledger: P1 of payment a (600,000) posted; P6 of payment b (no P1 ever) DR GL-5 arc.outbound / CR GL-1 other 500,000
    → OK on MapLedger and on EventLogLedger; other = 0 / 500,000
Q3  hold with nonce 7, one observation (block 5, nonce 8), nonceTx null; liftHold(evidence = ARC_LOG 'arc:anything') → LIFTED
Q4  LINK_HASH decision (evidenceDigest e1…) for P; applySignal links an arbitrary hash 0x99…, and ARC_LOG on 0x99… → SETTLED
Q5  UNPAUSE decision with approvers ['ann','ANN'] → recorded; with [' ', 'bob'] → recorded
Q6  markSubmit of P and of P2 with the same externalId nv1-cdcd… → both OK; findByExternalId → P
Q7  unpause(d) OK; pause again; unpause(d) → DECISION_CONSUMED; an UNPAUSE decision with subject = a payment id lifts the rail
Q8  CANCELLED_BY_OPERATOR before the marker with a LIFT_QUARANTINE decision → ILLEGAL_TRANSITION; with ABORT_ACCEPTED → OK
Q9  terminal DUPLICATE with [p6] on a FAILED Arc leg → OK DUPLICATE, outbox = []
```

## DEFECTS

**B1** · src/nova-ports/payment-store.ts:518–523 (the P6 rule checks only `after.status !== 'FAILED'`); src/nova-ports/ledger.ts:249–258 (evaluateJournal binds P7 to its original but gives P6 no binding to the payment's P1) · Lens R, design §9.2 P6, §9.3 ("P1 = P6", "clearing is released exactly once"), §7.7 ("release any reservation (P6)"), CLAUDE.md "Conservation" · **blocking** (money can be double-counted)
- The store accepts a release (P6, key `pay:<id>:p6`) with any change that leaves the payment FAILED. That includes a RESERVE failure, where Nova refused P1 or P1 was never attempted (R1: INSUFFICIENT_FUNDS from LEDGER, and METHOD_NOT_ENABLED).
- GL-5 `arc.outbound` is one pooled account (§9.1). Both ledger fakes post a P6 for a payment that has no P1 (LP6) and credit the payer from other payers' reservations.
- Failure scenario, on the D1-live journey STABLECOIN_BALANCE → STABLECOIN_WALLET:
  1. Nova refuses P1 with INSUFFICIENT_FUNDS.
  2. The orchestrator's generic "leg terminal → P6" commit is accepted by the store.
  3. P6 debits GL-5 and credits the payer A + F that was never debited.
  4. The payer's balance grows by A + F, and GL-5 falls short by the same amount for another payment.
  5. Reconciliation (§9.3) sees the drift only afterwards, by which time the credited funds may already be spent.
- Fix:
  - (1) The store refuses an outbox item with key `releaseKey(id)` unless the RESERVE leg is COMPLETED (P1 posted) and the failing leg is after RESERVE.
  - (2) evaluateJournal refuses a P6 unless the P1 under `pay:<paymentId>:p1` exists with the same paymentId and asset and exactly mirrored legs, and no P2, P2I or P6 has released it. This is the same pattern as the P7 binding.
  - Add contract tests for R1 and LP6 on both fakes.

**B2** · src/nova-ports/payment-store.ts:518–523 (P6 accepted with a PAYOUT-leg failure) and :524 together with fakes payment-store-fakes.ts:198–202 and :549–552 (on a no-change signal the outbox is dropped while OK is returned) · Lens R, design §12 F-17 ("`PAYOUT` → `REJECTED` / `PAYOUT_FAILED` … no P6 yet"), §9.2 P6 ("For `FIAT_BANK`, P6 also follows P2R … or comes with P11 on a two-person `CLOSE_PARTNER_UNRETURNED` decision"), §9.2 P11, §13.3 R3-m4 test · **blocking** (money moved without the required control)
- Q1: a verified PAYOUT_CALLBACK `PAYOUT_FAILED` may carry P6, so the payer is refunded A + F at once. The A USDC is still at the partner (GL-2 `partner.<id>`, posted by P2P), with no P11 claim, no partner return and no two-person decision.
- Q2: the two compliant paths cannot be expressed through the port:
  - a later P6 under a recorded CLOSE_PARTNER_UNRETURNED decision returns `OK DUPLICATE` and is silently not enqueued;
  - P2R → P6 meets the same fate.
- So the only release the store accepts for F-17 is the uncontrolled one, and a compliant orchestrator gets a false OK.
- Failure scenario: the partner reports FAILED but holds or later pays out the USDC. The company has refunded the payer without the two-person acceptance of the claim risk that F-17 requires, and has no `partnerClaim.<id>` record of the claim.
- FIAT_BANK is off in D1 (`D1_FLAGS.fiatEnabled = false`), which limits the exposure today. But this port contract is what Nova's adapter must reproduce [A-34].
- Fix:
  - Refuse P6 beside any PAYOUT-leg transition.
  - For a FIAT_BANK payment whose PAYOUT leg failed, accept P6 only in a commit that carries a recorded CLOSE_PARTNER_UNRETURNED decision for the payment, together with P11, or after the case's P2R.
  - Refuse an outbox item on a no-change signal instead of returning OK. Use a typed code such as ILLEGAL_TRANSITION, or add an explicit decision-carrying path.
  - Add the R3-m4 test.

**m1** · payment-store.ts:702–717 (`decideLift`) · §8.4 check 5 "When it lifts" · minor
- For a known n, the hold lifts on `firstAbove !== null` alone, with evidence from any source or key (Q3). The design also requires:
  - the nonce-n transaction located, with its gas posted (F-3b step 4a);
  - and, for a transfer that was not aborted, the rest of proof (c) or a two-person link.
- Design §7.3 gives liftHold only `NOT_FOUND`, so these conditions belong to the caller. That is why this is minor.
- Cheap hardening: require `nonceTx !== null` for a known n, and an evidence source of ARC_LOG, INTERNAL or OPERATOR_DECISION.
- The header (lines 45–48) states only the account-nonce part.

**m2** · payment-store.ts:439–444, 483–486 · §10.3 LINK_HASH projection (`txHash`, nonce, block hashes, binding digest) · minor [inspection-only]
- A LINK_HASH decision approves "a hash" for the payment, but the hash the transition links is not bound to the decision (Q4): the store sees only `evidenceDigest`.
- A caller bug could link and settle on a different hash than the two people approved.
- Fix: carry `txHash` in the LINK_HASH decision record, or have the store recompute the projection, and compare it with `t.txHash`.

**m3** · payment-store.ts:614–618 · §10.3 "two distinct staff identities" · minor
- Distinctness is exact string comparison, and "authenticated" means only "not the empty string". `['ann','ANN']` and `[' ', 'bob']` are both recorded (Q5).
- Approver ids should be canonical ids from Nova's staff authentication [A-35]. Refuse whitespace, and compare canonical forms.

**m4** · payment-store.ts:551–558 (`checkMarker`) · §7.3 SubmitMarker "deriveExternalId, the only externalId this leg will ever use" · minor
- The store checks only the format. Two payments can hold the same externalId (Q6), and findByExternalId then returns the first, so a DFNS entity could resolve the wrong payment.
- The gateway derives the id (src/gateway/index.ts:469), so this is defence in depth. Refuse an externalId that is already marked on another payment.

**m5** · payment-store.ts:662–670 (`decideUnpause`) · CLAUDE.md "Two humans must approve the unpause" · minor
- Any recorded UNPAUSE decision that has not been used lifts any pause, whatever its subject or incident (Q7).
- Bind the decision to the pause it lifts, for example subject = the pause incident id.

**m6** · tests · RUBRIC MC-08 test strength · minor
- payment-store.ts mutation score is 92.24% (66 survivors, mostly strings).
- Surviving logic mutants, confirmed by hand:
  - S496 (:496): progress gated by `legsAheadSettled` instead of `legsAheadCompleted`. §4.1 progress order is untested for a leg whose earlier leg is CREATED with no request: PAYOUT progress before the Arc leg, or RESERVE before AWAIT_DEPOSIT.
  - S713b (:713): an unknown-nonce lift with an `op:` key from a source other than OPERATOR_DECISION.
  - S453 (:453): `< 0n` → `<= 0n`. A hold for nonce 0 (a wallet's first transaction) would be refused, and no test notices.
  - S581 (:581): the marker is copied onto every leg.
  - S448 (:448): hold leg-kind guard.
  - S536 (:536): `leg.externalRef === null` guard.
- Add one test each.

**m7** · payment-store.ts (no `ApprovedMoveRecord`, `ApprovedFundingRecord`, `CaseRecord`, `putMove`, `getMove`, `putFunding`, `putCase`, `addCaseDecision` or `claimInbound`; applySignal, markSubmit and findByExternalId take a PaymentId only) · §7.3, §6.1, §9.2 P8/P10/P2R/P11, F-17, F-19 · minor (fails closed; carried over from m2)

**m8** · src/nova-ports/fakes/faults.ts:5 ("Every fake operation, reads included, consults its plan") vs gas-dust-fakes.ts (`balance` and `receiptDustTotal` have no fault point) · §7.8 · minor (carried over from m5)

**m9** · signature drift from §7 "exact signatures" · minor (carried over from m6)
- The code differs from the design here:
  - `liftHold` returns LiftRejectCode (design: `'NOT_FOUND'`);
  - `unpause` returns UnpauseRejectCode (design: DecisionRejectCode);
  - `commitRange` adds SIGNAL_CONFLICT;
  - `getBalance` returns `LedgerBalance`;
  - `JournalReceipt` gains `template` and `refs`;
  - LedgerRejectCode adds INVALID_JOURNAL and ALREADY_COMPENSATED;
  - MarkSubmitRejectCode adds NOT_READY;
  - InboundSignal adds the LEDGER and INTERNAL sources;
  - `recordCompensation` and `pendingOutbox` are added.
- Either update §7 or align the code.

**m10** · payment-store.ts:596–612 · minor (carried over from m8)
- `recordCompensation` trusts the caller's P7 and original receipts [inspection-only].
- The design gives one key `pay:<id>:p7`, while F > 0 needs two P7 journals.
- The paths differ from the §3 layout (`src/nova/ports.ts`, `src/payments/status.ts`).

**N1 (outside the target, not counted)** · docs/MONEY_PATH.md (rows for `src/journey/quote/compose.ts`, `fiat.ts` and `ports.ts`, added 10:10) vs stryker.config.json `mutate` · RUBRIC MC-08 recount gate
- test/unit/money-path.test.ts:79 fails in the working tree. This is the journey/quote unit's change, not PORTS. It must be fixed before any CI run.

## VERDICT

NEGATIVE (12 defects: 2 blocking, B1 and B2, and 10 minor, m1–m10; N1 is outside the target)
