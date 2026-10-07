VERIFICATION · lens: R · target: PORTS (src/nova-ports/**, src/status/** and their tests) · commit: 2777414 + working tree (branch co1-v3/nova-arc-d1; the PORTS files were committed in 348972d, and payment-store.ts plus five PORTS contract tests carry uncommitted edits. payment-store.ts was last modified 2026-10-07 12:47, ledger.ts 12:27 and payment-store-fakes.ts 12:25. This pass ran 2026-10-07 13:45–14:10 SAST)

Verifier: independent verifier subagent, fresh context. This pass re-verifies PORTS after the fix to the 11:31–12:05 pass (B1, B2, m1–m10). It replaces that pass in this file.

Inputs used:
- docs/NOVA_ARC_DESIGN.md: §6.1, §7.1–§7.8, §9.1–§9.3, §12 F-17, §13.1–§13.3;
- CLAUDE.md money rules, docs/MONEY_PATH.md, docs/constants.md;
- the archived DFNS and Arc pages under docs/sources/, checked against docs/sources/MANIFEST.md;
- the code and the tests.

The author's comments and summaries were not trusted.

Method:
- Node v22.23.3 from .tools/node/bin.
- No network calls, no .env reads and no secrets.
- Stryker ran in a mkdtemp real-file copy (/tmp/verify-ports-r3-5bmVvY). Probes and hand mutants ran in a second copy (/tmp/verify-ports-r3p-Vc9P50). Both copies were made with tar and exclude .git, .env*, .tools, reports and the Stryker temp dirs.
- Each copy has 30 symlinks, all in node_modules/.bin, and none resolves into the repo.
- Every hand mutant was restored after its run.

## Status of the previous pass's defects

| Previous defect | Now |
|---|---|
| B1: P6 with no P1 behind it | **Fixed.** The store refuses P6 unless the RESERVE leg ahead of the failing leg is COMPLETED (payment-store.ts:583–588). The ledger binds P6 to the payment's P1: it must be the exact mirror, in the same asset, and released only once (ledger.ts:295–307). Probes C6 and C4 confirm this, and hand mutants M2, M3, M4 and M7 are killed. |
| B2: P6 on a PAYOUT failure; no-change signals silently drop the outbox | **Fixed.** applySignal refuses P6 with any PAYOUT-leg transition (:585) and refuses P11 and P2R outright (:669–671). A no-change signal must find its outbox already enqueued, or it is refused (:572–575). The F-17 close goes through closeFailedPayout, with P11 under a recorded CLOSE_PARTNER_UNRETURNED decision on the open case, or with P2R on the log the case claimed. The ledger also gates P6 behind P2R or P11 when P2P is posted. Mutants M1, M6 and M9–M19 are killed. **New, in the fix:** the claimed return is not bound to the payment's amount (B1 below). |
| m1: lift rule weaker than §8.4 check 5 | Fixed. The hold now needs `nonceTx` and an ARC_LOG, INTERNAL or OPERATOR_DECISION source (:891–895). M22 and M23 are killed. |
| m2: LINK_HASH not bound to the hash | Fixed. The decision carries `txHash`, decideDecision checks it and decisionRule compares it (:836, :562). M25 is killed. |
| m3: approver distinctness | Mostly fixed: approvers are compared after NFKC and upper-casing, and whitespace is refused. A residue remains (m5 below). M20 is killed. |
| m4: externalId shared by two payments | Fixed. MARKER_CONFLICT (:739); probe m4 on both fakes; M24 is killed. |
| m5: unpause decision bound to nothing | Fixed. WRONG_INCIDENT is checked against `RailState.incident` (:860). M21 is killed. |
| m6: test-strength gaps S496, S713b, S453, S581, S448, S536 | Tests added (contract "test-strength gaps from mutation (m6)"). For the current survivors see the Stryker line below. |
| m7: §7.3 move, funding and case operations absent | Partly fixed: cases, claimInbound, addCaseDecision and getCase now exist. Moves and funding are still absent and fail closed. Carried as m7. |
| m8: no fault points on gas-dust reads | Fixed (gas-dust-fakes.ts:115, :121, :205, :209). |
| m9: signature drift from §7 | Open. The header lists the deviations and says "a design delta must record them", but NOVA_ARC_DESIGN_DELTA-1.md does not record them. Carried as m8. |
| m10: compensation trusts the caller's receipts | Still [inspection-only]. The keys are now checked: `pay:<id>:p7` and `:p2`/`:p2i` (:774–780; M28 is killed). Carried as m9. |

## CHECKS

- `npx tsc --noEmit` (repo): **PASS**, exit 0.
- Target tests: **PASS**.
  - Repo: 7 contract files, 5 unit files and 1 property file, all passing.
  - Scratch copy (PORTS-only config): 13 files, 382/382 tests.
- `test/unit/money-path.test.ts` (MC-08 recount gate, repo): **FAIL, outside the target.** All 3 failures belong to the JPARTNER unit:
  - `src/journey/payout/partner/*.ts` and `src/journey/recipients/index.ts` are listed in MONEY_PATH.md but not in the stryker `mutate`;
  - `src/journey/recipients/index.ts` imports `node:util`.
  - No PORTS row is involved (N1).
- MC-01 float lint `node tools/lint-money-floats.mjs`: **PASS**, exit 0. 46 money-path files and 0 findings, including the 10 PORTS money-path files.
- Semgrep MC-01 layer (`tools/semgrep/mc01-money-float.yml`, `--no-git-ignore`) on the 10 PORTS money-path files: **PASS**. 13 rules, 10 targets, 0 findings.
- Vendored Semgrep JS/TS rules on src/nova-ports, src/status and the PORTS tests: **PASS**. 203 rules, 31 targets, 0 findings.
- gitleaks (`--no-git`, on a /tmp copy of the PORTS sources and tests): **PASS**, no leaks.
  - A grep for `fetch(`, URLs, `process.env`, key or token names, `Bearer` and chain 5042 found nothing in PORTS.
- MC-08 Stryker, in the scratch copy: **PASS**, 96.63% overall (break 90). 4486 mutants: 4333 killed, 2 timeout, 150 survived, 1 no coverage.
  - Per file: journey, gas-dust and payout 100; status/index 99.42; ledger 98.97; wallet-registry 98.00; conversion 97.96; payment-store 97.17 (35 survivors); receiver 94.74; ids 90.91; fakes 91.77–98.28.
  - Most survivors are string literals.
  - Command: `npx stryker run stryker.ports.json --mutate 'src/nova-ports/*.ts,src/nova-ports/fakes/*.ts,src/status/index.ts,src/status/journey.ts' --tempDirName .stryker-tmp-verify-PORTS --reporters clear-text,json`.
  - The config is the repo's, with the vitest config limited to the 13 PORTS test files.
- Hand mutants (29 in a real-file copy, each restored): **28 killed, 1 survived.**
  - Killed:
    - M1: no F-17 P2P gate on P6;
    - M2: P6 after a release;
    - M3: P6 asset unchecked;
    - M4: P6 legs compared unmirrored;
    - M5: no customer funds check;
    - M6: P6 on a PAYOUT failure;
    - M7: P6 without P1;
    - M8: P6 beside a non-failing change;
    - M9: close on any payout reason;
    - M10: decision not on the case;
    - M11: P11 on a MATCHED case;
    - M12: P2R without a claim;
    - M13: both P11 and P2R;
    - M14: evidence digest unchecked;
    - M15: decision kind or subject unchecked;
    - M16: an ambiguous claim takes the first case;
    - M17: putCase without OPEN_PARTNER_CASE;
    - M18: P11/P2R through applySignal;
    - M19: a no-change signal silently OK;
    - M20: no case fold for approvers;
    - M21: unpause for any incident;
    - M22: lift without nonceTx;
    - M23: lift from any source;
    - M24: externalId reuse;
    - M25: LINK_HASH hash not compared;
    - M26: PAYOUT_FAILED from INTERNAL;
    - M27: REVERSED without COMPLETED;
    - M28: P7 key unchecked.
  - Survived: M29, where the ledger's P6 binds to the *last* P1 of a payment instead of the first. Nothing tests a payment with two P1 journals (m2).
- Integer units, recomputed by hand and then by probe through U1 `nativeWeiToCbsMinor`: **PASS**.
  - At p = 6 (k = 10^12), as (g, d):

    | G (wei) | g (minor) | d (wei) |
    |---|---|---|
    | 0 | 0 | 0 |
    | 1 | 0 | 1 |
    | 10^12 | 1 | 0 |
    | 420,000,000,000,000 | 420 | 0 |
    | 123,456,789,012,345 | 123 | 456,789,012,345 |
    | 999,999,999,999 | 0 | 999,999,999,999 |
    | 10^18 | 1,000,000 | 0 |

  - At p = 2 (k = 10^16): 10^18 + 7 wei → (100, 7).
  - At p = 18: 5 → (5, 0).
  - `cbsMinorToNativeWei(1, 6)` = 10^12.
  - `checkSplit` accepts (123, 456,789,012,345) and refuses (124, 0) and (0, 10^12).
  - All match the hand values.
- Ledger postings, probed on both ledger fakes, which agree:
  - P6 for another payment, P6 to another customer, P6 with split legs, and P6 after P2 → all BINDING_MISMATCH.
  - P6 after P2P and before P2R/P11 → BINDING_MISMATCH (F-17).
- DFNS/Arc facts the unit cites, re-checked against the archive with sha256 equal to the MANIFEST: **PASS**.
  - `ArcTestnet`: dfns/networks_index.md:34 "| Arc | ArcTestnet | 1 | N/A | 10 | | |". sha256 1330da14…a253 = MANIFEST:96.
  - Chain ID 5042002: arc/arc_references_rpc-endpoints.md:64 "| **Chain ID (Testnet)** | `5042002` |". sha256 80324031…3095 = MANIFEST:24.
  - "DFNS rejects only from Pending" (status/index.ts:207): dfns/guides_developers_transaction-monitoring.md:38 "Pending --> Rejected" and :50. sha256 90d71b9f…c56c = MANIFEST:109.
  - externalId of at most 50 characters (marker `nv1-` + 40 hex = 44): dfns/api-reference_wallets_transfer-asset.md:163–166 "maxLength: 50". sha256 674d5346…66ae = MANIFEST:217.
  - No invented fact was found.
- Mainnet only as a disabled entry: **PASS**. `dfnsNetwork` is the literal `'ArcTestnet'`, and decideRegister (wallet-registry.ts:83) returns NETWORK_DISABLED for anything else.
- Both fakes pass the same contract tests: **PASS**. Each of the 7 port suites has one `describe.each(FACTORIES)` over two structurally different fakes:
  - MapLedger / EventLogLedger;
  - MapPaymentStore / EventSourcedPaymentStore;
  - MapWalletRegistry / ListWalletRegistry;
  - FixedRateConversion / LadderConversion;
  - ImmediatePayout / AsyncCallbackPayout;
  - CounterDustStore / LedgerRowDustStore;
  - MapReceivers / VersionedReceivers.

  Every probe below gave the same result on both fakes of each pair.
- Postings always balance in integer units: **PASS** (checkJournalShape, checkTotals, the property test and the probes).
- Postings bound to the payment's state:
  - P1/P6/P7: **PASS**.
  - F-17 P2R: **FAIL**, because the claimed return is not bound to A (B1).
  - P11 amount: unbound (m3).
- REVERSED only through compensating entries: **PASS**.
  - toTransactionStatus returns REVERSED only for COMPLETED with `compensatedBy`.
  - decideCompensation needs SETTLED and the `pay:<id>:p7` receipt compensating `pay:<id>:p2`/`:p2i`.
  - Mutants M27 and M28 are killed.
  - The receipts are the caller's [inspection-only] (m9).
- Stage → TransactionStatus mapping table tested exhaustively: **PASS**.
  - STATUS_BY_STAGE (status/index.ts:95–105) equals §13.2 row for row; I re-read it against the design.
  - test/unit/ports-status.test.ts:61 pins the table, and :77 pins the reason lists.
  - :88 checks exactly 20 legal pairs. My count: 5 non-terminal + COMPLETED + 9 + 3 + 2 = 20.
  - :213 runs the full leg × state × state × source × request oracle with 0 mismatches.
- Inbound dedupe and authenticity at the store: **PASS**.
  - One inbox for signals, ranges, decisions, lifts and claims.
  - A changed digest is SIGNAL_CONFLICT.
  - A key claimed by a case or a payment is refused for any other subject (probe C2: a claimed log offered to applySignal → SIGNAL_CONFLICT).
  - The authenticity of the sources sits upstream [inspection-only].

## Probes (both store fakes; outputs identical)

```
C1  FIAT_BANK, PAYOUT REJECTED/PAYOUT_FAILED; binding.amount = 1e18 wei (A).
    putCase(PARTNER_RETURN, expected.value = 5e17, OPEN_PARTNER_CASE decision) → OK
    claimInbound(log, value 5e17) → claimedBy = case (MATCHED)
    closeFailedPayout(log, [pay:<id>:p2r, pay:<id>:p6]) → OK APPLIED
C1b putCase with subject ≠ the case id's subject → KEY_CONFLICT (bound by deriveCaseId)
C2  branch 2 closed (P11 + P6). A later exact return: claimInbound → MATCHED;
    closeFailedPayout(log, [p2r]) → ILLEGAL_TRANSITION "already released";
    applySignal(log, …, [p2r]) → SIGNAL_CONFLICT. No way to enqueue the §9.2 "P2R credits partnerClaim"
C3  FIAT_BANK, RESERVE COMPLETED (P1 posted), Arc leg CREATED with no marker;
    PAYOUT REJECTED/METHOD_NOT_ENABLED with [p6] → refused "the USDC is at the partner" (it is not);
    without [p6] → APPLIED, payment FAILED; closeFailedPayout → refused (not PAYOUT_FAILED);
    any later P6 → "nothing changes after a failure"
C3b Arc COMPLETED (P2P), PAYOUT CANCELLED/CANCELLED_BY_OPERATOR on ABORT_ACCEPTED → APPLIED, FAILED;
    the F-17 close is refused (reason is not PAYOUT_FAILED)
m4  markSubmit of payment 2 with payment 1's externalId → MARKER_CONFLICT
m3  ['ann','ANN'] SAME_APPROVER; [' ','bob'] APPROVER_UNAUTHENTICATED; ['ａｎｎ','ann'] SAME_APPROVER;
    ['ann​','ann'] → recorded (APPLIED)
```

Ledger probes (MapLedger and EventLogLedger identical):

```
C4  P1 300,000 (pay:a:p1) OK; a second P1 200,000 for the same payment (pay:a:p1-again) OK;
    P6 300,000 OK; P6 200,000 → BINDING_MISMATCH. Clearing is left at 200,000 with no release path
C5  P1 500,000; P2P 500,000; P6 → BINDING_MISMATCH (F-17); P11 of 1 → OK; P6 500,000 → OK.
    partner.p1 is left at DR 500,000 / CR 1
```

## DEFECTS

**B1** · src/nova-ports/payment-store.ts:955–959 (`closeByReturn` checks only `c.matchedLog === evidence.dedupeKey`) and :1013–1027 (`decidePutCase` takes `expected` from the caller and binds it neither to the payment nor to the OPEN_PARTNER_CASE decision's evidence) · Lens R, design §9.2 P2R ("whose `(from, to, value)` matches exactly an open F-17 case record … with `value = cbsMinorToNativeWei(A, p)`. A return of any other value does not match; it goes to P9"), §12 F-17 (same text), CLAUDE.md "Binding … amount … always taken from the server-side transfer record" · **blocking** (money can be misposted without the required control)
- The store accepts a P2R + P6 close on a log whose value is not A. This is probe C1, on both fakes: a case with `expected.value` = A/2 is put, the A/2 log is claimed and the close is APPLIED.
- The P2R journal then books A from GL-2 `partner.<id>` back to `arc.<to>` (the ledger does not bind P2R's amount either), while only A/2 arrived on-chain.
- Consequences:
  - `partner.<id>` nets to zero, so the A/2 the partner still holds disappears from the books instead of becoming a claim;
  - `arc.<to>` is overstated by A/2.
- The chain invariant (§9.2) drifts and PAUSEs the rail, but only after the payer's P6 refund and the P2R have been posted.
- No other unit enforces the rule. A grep of src/ for PARTNER_RETURN, closeFailedPayout, claimInbound and putCase outside src/nova-ports finds no caller. The port is the only place it can live, and the comparator is at hand: `rec.binding.amount` is cbsMinorToNativeWei(A, p) for the Arc leg to the partner.
- FIAT_BANK is off in D1, which limits exposure today, but this is the contract Nova's adapter must reproduce [A-34].
- Fix:
  - In decideClosePayout's P2R branch, refuse unless `partnerCase.expected !== null && partnerCase.expected.value === rec.binding.amount`. Better still, also check it at putCase by reading the payment, so a wrong case can never be claimed and the log goes to P9 as §9.2 says.
  - Optionally bind `expected` to the OPEN_PARTNER_CASE decision, the way the LINK_HASH decision now carries its `txHash`.
  - Add a contract test for an A/2 case on both fakes.

**m1** · payment-store.ts:585 (`if (t.leg === 'PAYOUT') return …`) and :981 (the close requires `reason === 'PAYOUT_FAILED'`) · §7.7 "release any reservation (P6)", §9.3 "P1 = P6" · minor (fails closed: no money moves, but the payer's A + F is frozen)
- The P6 refusal keys on the leg, not on whether P2P was posted.
- Probe C3: with P1 posted and the Arc leg not started, a PAYOUT failure (METHOD_NOT_ENABLED from INTERNAL) is accepted. P6 is refused with a false reason ("the USDC is at the partner"). After that, nothing can release the reservation.
- Probe C3b: after P2P, a PAYOUT ended by CANCELLED_BY_OPERATOR also has no close, because closeFailedPayout accepts only PAYOUT_FAILED.
- Fix:
  - Allow P6 with a PAYOUT failure when the Arc leg is not COMPLETED (no P2P).
  - Route every PAYOUT failure after a COMPLETED Arc leg to the F-17 close, or refuse those transitions.

**m2** · src/nova-ports/ledger.ts:295–301 (P6 binds to the first P1 found; nothing refuses a second P1 for one payment) · §9.3 "P1 = P6", §10.2 single P1 key · minor (the keys are derived by the caller)
- Probe C4: a second P1 under another key is accepted. The payer is debited twice, and the second reservation can never be released.
- Hand mutant M29 (bind to the last P1) survives: nothing tests this.
- Fix: refuse a P1 for a payment that already has one (BINDING_MISMATCH or KEY_CONFLICT), and add the test.

**m3** · ledger.ts:303 (the F-17 gate checks that P2R or P11 exists, not their amounts) · §9.2 P11 "A", §9.3 rail check "partnerClaim = Σ A" · minor
- Probe C5: a P11 of 1 minor unit unlocks P6, leaving `partner.<id>` at A − 1 with no claim recorded. The payer's refund is still correct.
- Fix: bind the P11 and P2R amounts to the payment's P2P (as P6 is bound to P1).

**m4** · payment-store.ts:982–985 (once P6 is enqueued, only the same close replays) · §9.2 P2R "If P11 was already posted … the credit is GL-2 `partnerClaim.<id>` instead, and no second P6 follows", §12 F-17 "A later exact return is claimed by it, and P2R then credits partnerClaim" · minor (fails closed: drift → PAUSE)
- Probe C2: after a branch-2 close, a later exact return is claimed by the case, but its P2R cannot be enqueued through any store operation.
- The returned USDC is then on-chain with no journal, and the chain invariant PAUSEs the whole rail.
- Fix: accept a P2R-only close on the claimed log when P11 is already enqueued for the payment.

**m5** · payment-store.ts:786 (`APPROVER_RE = /^\S+$/`) and :793–795 · §7.3 "two DISTINCT authenticated staff identities" · minor
- `'ann​'` and `'ann'` are recorded as two people (probe m3). The zero-width space is not `\s`, and NFKC keeps it.
- Restrict ids to Nova's canonical staff-id alphabet [A-35], for example `/^[A-Za-z0-9._@-]+$/`.

**m6** · payment-store.ts:56–58 (the header says "two ids equal after NFKC and lower-casing") vs :793–795 (the code upper-cases) · minor (stale comment).

**m7** · payment-store.ts:84–87 (no ApprovedMoveRecord, ApprovedFundingRecord, putMove, getMove, putFunding or funding claims) · §7.3, §9.2 P8/P10 · minor (fails closed; carried).

**m8** · signature drift from §7 "exact signatures" · minor (carried)
- The headers list it (payment-store.ts:73–87, ledger.ts:35–42): `LedgerBalance`, receipt `template`/`refs`, INVALID_JOURNAL, ALREADY_COMPENSATED, the `p7f` key, NOT_READY, the LiftRejectCode/UnpauseRejectCode additions, `incident`, `txHash`, `matchedLog`, closeFailedPayout, getCase, recordCompensation and pendingOutbox.
- NOVA_ARC_DESIGN_DELTA-1.md does not record them, although both headers say a design delta must.

**m9** · payment-store.ts:764–783 · minor (carried) [inspection-only]
- `recordCompensation` checks the keys and refs of the caller's P7 and original receipts but cannot check that they were posted. The P3 fee's P7 (`pay:<id>:p7f`) is outside the design's single `:p7` key.

**m10** · tests · RUBRIC MC-08 test strength · minor
- No test covers B1 (a case value other than A), m1 (a PAYOUT failure before P2P), m2 (two P1s, M29 survives), m3 (P11 amount) or m4 (a late P2R after P11).
- Stryker logic survivors (non-string), read [inspection-only]:
  - ledger.ts:296, `j.template === 'P1_RESERVE'` → `true`: P6 binds to the payment's first journal of any kind (the m2 gap);
  - payment-store.ts:917, the unknown-nonce lift's `source === 'OPERATOR_DECISION'` → `true`: a NONCE_UNKNOWN_CLOSE decision presented under another source would lift;
  - :716, `markedAtBlock < 0n` → `<= 0n`: block 0 is untested;
  - :876–877, the observation boundaries `>` / `<` → `>=` / `<=`, which are equivalent for equal blocks;
  - :948, :1056 and :1057, sub-conditions of the close and claim guards;
  - status/index.ts:167 and :270, which are equivalent.
- Add a test each for :296, :917 and :716.

**N1 (outside the target, not counted)** · docs/MONEY_PATH.md rows for `src/journey/payout/partner/*.ts` and `src/journey/recipients/index.ts` vs stryker.config.json `mutate`; `node:util` import in src/journey/recipients/index.ts · RUBRIC MC-08 recount gate and the import closure
- test/unit/money-path.test.ts has 3 failures. This is the JPARTNER unit's work in progress, not PORTS. It must be fixed before any CI run.

**N2 (outside this pass's yardstick, not counted)** · NOVA_ARC_DESIGN_DELTA-1.md A-2 adds CaseRecord kinds (`UNMATCHED_FILL`, `REQUOTE`, `PAYIN_MISMATCH`, …) and DecisionKinds that `CaseKind`/`DecisionKind` (payment-store.ts:261–290) do not have yet. This belongs to the PORTS delta-alignment block. It was not judged here: this pass was asked to judge against NOVA_ARC_DESIGN.md.

## VERDICT

NEGATIVE (11 defects: 1 blocking, B1, and 10 minor, m1–m10; N1 and N2 are outside the target)
