VERIFICATION · lens: R · target: docs/NOVA_ARC_DESIGN_DELTA-1.md (revision 2, after the round-1 fix block) · commit: 2777414 (the target is modified in the working tree and uncommitted, so it is pinned by sha256 prefix: DELTA-1 5b852687eb2c3809; KHUMO_ANSWERS 654f5f464684c3c0 and NOVA_ARC_DESIGN d820d43d00644b86, both unchanged since round 1 and equal to the R4-frozen hash)

Verifier: independent verifier subagent, 2026-10-07. Round 2 of the delta.

Judged against:
- docs/KHUMO_ANSWERS.md;
- docs/NOVA_ARC_DESIGN.md (D1, frozen at R4);
- CLAUDE.md:24-32 (money invariants);
- docs/constants.md;
- the archived DFNS pages under docs/sources/dfns/;
- the round-1 report, docs/verification/NOVA-delta1-lensR-1.md.

Safety:
- No DFNS, Circle or VALR API was called. Nothing was signed or broadcast, and no network was touched. No .env file was read. Every fact was checked against the archive only, with no live re-fetch.
- Scratch was a mkdtemp dir, `/tmp/verify-delta1b-Ajudm8`, holding real-file copies (`find -type l` = 0). Node came from `.tools/node/bin` (v22.23.3).
- The full ci.sh was not run.

## CHECKS

### Mechanical
- `npx tsc --noEmit`, repo-wide → **FAIL, not attributable to the target.**
  - All errors are TS2345 in `test/unit/jpartner-adapters.test.ts:208-228`.
  - That file is untracked and was written at 13:33, one minute before the run, by another agent's in-flight JPARTNER block.
  - The same compile with only that file excluded (a /tmp tsconfig that extends the repo's) → PASS, exit 0.
  - The target is Markdown and adds no code.
- MC-01 float lint, `node tools/lint-money-floats.mjs` → PASS: "46 money-path files, 0 finding(s)".
- Semgrep MC-01 layer (`tools/semgrep/mc01-money-float.yml`) → PASS, exit 0.
  - Scope: `src/nova-ports/conversion.ts` and `src/journey/quote/{ports,compose,fiat}.ts`, the code D-1 extends.
  - Self-test: a planted `0.1` in a /tmp copy of conversion.ts → 1 finding, exit 1. The rule therefore fires.
- Semgrep, the pinned JS+TS rule sets (203 rules), over the same files and the target → PASS: 0 findings.
- Target tests → N/A. The delta is design text and has no tests yet.
  - Baseline for the FX code D-1 replaces: `jquote-ports`, `jquote-compose`, `jquote-fakes`, `ports-conversion.contract` → PASS (4 files, 177 tests).
- Stryker on `src/nova-ports/conversion.ts` → PASS, 97.96 % (48 killed, 1 survived, 0 no-coverage). This is the module that the delta's check 2 must extend ("one module … no second implementation").
  - Command: `--mutate 'src/nova-ports/conversion.ts' --tempDirName .stryker-tmp-verify-delta1b --concurrency 1`.
  - The first two attempts aborted: one was killed under memory pressure, and one hit ENOENT copying another agent's `.stryker-tmp-PORTS` sandbox. The third run added `.stryker-tmp*` to `ignorePatterns`.
  - The survivor is `conversion.ts:76` `>` → `>=`. It is **equivalent**: `remainder == from.amount` forces `to.amount == 0` through the identity at :77, and :75 has already refused that ("nothing converts").
  - The temp dir is removed.
- gitleaks on a /tmp copy of the target → PASS ("no leaks found").
- Grep of the target for mainnet, `5042` (other than 5042002), long hex values, secrets and keys → PASS. The only hit is "paginationToken" at :145, a DFNS query-parameter name. Testnet only is restated at :5.

### DFNS facts, re-checked in the archive [archive-only]
- sha256 of each cited page equals its MANIFEST row:
  - `api-reference_wallets_abort-transfer.md` 3dba876e…: row 205;
  - `api-reference_wallets_list-transfers.md` 6ffd2d54…: row 215;
  - `guides_developers_create-transfers.md` cfa4c413…: row 229.

  The delta cites these rows exactly → PASS.
- :143 quote "Never submit a second Transfer Asset request to 'retry' a transfer that has not reached a terminal status" = create-transfers.md:206 → PASS.
- :144 "aborts a transfer in `Executing` status that has not yet been signed" = abort-transfer.md:7 → PASS.
- :145 List Transfers has only `limit` and `paginationToken` as query parameters. This matches list-transfers.md, whose only `in: query` parameters are at :52-53 and :64-65; `walletId` is a path parameter → PASS.
- :145 "An `externalId` resolution only finds the entity; it never proves its absence". This equals D1 :803 and F-6 (:1087) → PASS. **Round-1 B4 is resolved.**
- No Arc constant is used by the delta.

### D1 citations, re-traced line by line
Each of these is PASS: :476 (InboundSignal.source), :487-497 (LEG_UNRESOLVED), :529-605 (case store, CaseRecord), :537-546 (DecisionKind), :555-558 (approvers, SAME_APPROVER, APPROVER_UNAUTHENTICATED), :599 (CaseRecord.kind), :631 (SIGNAL_CONFLICT → QUARANTINE), :676 (ConversionPort.execute), :684 (verifyCallback), :796 (one DFNS request; retry is a new payment after P6), :803 (a listing proves nothing), :1025 (payment id from payer + client key), :1041 (CF-31 gate).

Exception: :796-807 is cited as "the proofs", but the proofs (a1)/(a2)/(b)/(c) are at :814-835 (m1).

### Planted mutants (reconstruction; /tmp copies of `src/journey/quote/ports.ts`, `src/nova-ports/{conversion,ids}.ts`, `src/amounts/index.ts`, `src/network/types.ts`, compiled with the repo's tsc)
The compile reported one TS2307 for a transitive type-only import (`chain/config`) that was not copied. Emit is unaffected.

Reconstruction by hand: ZAR 100000 cents FROM_EXACT, code rate 10000/18 micro-USDC per cent.
- The convertible step is 18/gcd(10000,18) = 9.
- 100000 mod 9 = 1.
- Identity: to = 99999·10000/18 = **55,555,000**, remainder 1 cent.
- floor(100000·10000/18) = **55,555,555**.

Driver output, one row per case. Columns: `checkFxLock` / the delta's check 3 (cross-multiplication) / the delta's check-2 gloss "toAmount equals the floor of the converted amount":

| Case | checkFxLock | check 3 (cross-mult) | check-2 gloss (floor) |
|---|---|---|---|
| honest fill (55,555,000; remainder 1) | null (accept) | true | **false (refuse)** |
| floor fill (55,555,555; remainder 0) | "conversion does not balance to the minor unit" | true | **true (accept)** |
| M1, 550/1, self-consistent (55,000,000; remainder 0) | **null (accept)** | **false (refuse)** | false |
| equivalent rate 20000/36 | null | true | false |
| M2, from 101000 against request 100000 | "does not keep the from amount exact" | true | false |
| 1 cent | "nothing converts" | – | – |
| 9 cents | null (5000 micro-USDC, remainder 0) | – | – |

Expiry rule `filledAt < expiresAt` at 299,999 / 300,000 / 300,001 → true / false / false, which matches `compose.ts:322` (`nowMs < q.expiresAtMs`, working tree).

Findings from the mutants:
- Check 3 catches M1. That is round-1 B1(a), resolved.
- The check-2 gloss contradicts the identity it names (B3).

### Round-1 defects, re-checked
- **B1** (fill fields, read-back, booked-but-refused path, authoritative timestamp, tests): resolved at :21-27, :32-35, :41-52. One new gap is in the ADOPT path (B1 below).
- **B2**: resolved. Authenticity uses `verifyFillEvent` and `verifyPayInEvent`, with DQ-1 failing closed. The new sources have dedupe keys and projections. One fill per `codeId` and one confirmation per expected pay-in are enforced as `SIGNAL_CONFLICT`.
- **B3**: resolved. The delta reuses `CaseRecord` and `OperatorDecision`, keeps every money action two-person with no exception, restricts REFUND to P6 through `applySignal`, sets `retry:<id>` with one retry per original, and gates on CF-31 (:56, :66, :75, :79-80).
- **B4**: resolved (see the DFNS facts above).
- **B5**: resolved. `ConsentPort.consume` is bound to (clientUid, paymentId, caseId, option digest) and is single-use (:105).
- **m1–m11**: resolved, except the residual gaps listed below as m4–m6 and m8.

### Lens R items applied to a design delta
- **Follows from a quoted answer** → PASS. Each Dn cites its answers, checked against KHUMO_ANSWERS:26-46, except DA-4's reading of answer 33 (m9).
- **Never weakens a CLAUDE.md money invariant** → FAIL:
  - B1: consent and exactness are bypassed on ADOPT;
  - B2: exactly once is missing for P12, P13 and P15;
  - B3: the gloss licenses silently dropped sub-unit value.
- **Keeps D1 frozen** → PASS. D1's sha256 is unchanged, and conflicts are routed through A-1..A-7. The amendment list is incomplete (m4, m5, m6).
- **Two fakes per port** → PASS. The table at :153-159 names structurally different fakes. The LedgerPort read-back fake is missing (m4).
- **MC-01, integers** → PASS [inspection-only]. Rates are num/den bigints, and there are no floats in the target.
- **MC-03, one conversion module** → PASS in intent (:22). The source of the expected amounts from a pricing-only code is unstated (m10).
- **MC-04, templates balance** → PASS [inspection-only]. P12, P13, P14 and P15 each balance as described.
- **MC-10, deterministic keys** → FAIL: P12, P13 and P15 have no ledger keys (B2).
- **MC-11 and MC-12, every state × outcome; max age** → PASS. The expiry boundary, the fill timeout (DQ-2) and the aged history failure are each specified. DQ-2 does not say "unset fails closed at startup" (m7).
- **MC-19, two-person unpause** → PASS (:66, :73).
- **Fail closed** → PASS:
  - DQ-1 unset means no fill or pay-in is accepted;
  - no consent means a hold and a case;
  - gas, dust and write-off accounts that are unset mean startup fails, or the action is refused;
  - a failing history write means a case.

## DEFECTS

### B1 · NOVA_ARC_DESIGN_DELTA-1.md:32-33, :72, :81 (D-1 ADOPT, D-2 consent) · money moved without the required control (answer 37 consent); misposting adopted · **blocking**

Evidence:
- :32 "A refused fill that is already booked (a fill after expiry, `FILL_MISPOSTED`, or any failed check) … opens a requote case … `UNMATCHED_FILL` … The case closes by exactly one of two paths, both two-person";
- :33 "**ADOPT:** the requote consumes the already-filled conversion (the new quote is built from the booked fill …)";
- :81 "`REQUOTE` and `ACCEPT_WITH_CONSENT` are refused unless `ConsentPort.consume` returns a record that matches". `ADOPT_FILL` (:72) is not in that rule.

The problem:
- ADOPT is open to **every** refused fill, including one refused by check 3 (rate) or check 4 (`FILL_MISPOSTED`, for example the client over-debited, M2). It needs only two staff approvers, with no client consent and no exactness condition.
- :92 ("can't be closed while its money is unbalanced") stops only unbalanced journals, not balanced-but-wrong ones.

Concrete case (driver row M1):
- The desk fills the code at 550/1 instead of 10000/18.
- Check 3 correctly refuses it, and UNMATCHED_FILL opens.
- Two staff ADOPT it.
- The client's R1000.00 becomes 55,000,000 micro-USDC instead of 55,555,000. That is 0.555 USDC lost at a rate the client never agreed to, and answer 37 requires "client reachout for change consents" for rate changes.
- An M2 over-debit adopted the same way leaves the client over-charged permanently.

Required:
- ADOPT_FILL is allowed only for a fill that passes checks 1-4 exactly and failed only check 5 (expiry), that is, a late fill at the code's own rate and amounts with a correct ledger read-back.
- Any adopted terms that differ from what the client consented to need `ConsentPort.consume` bound to the adopted fill's digest.
- A fill failing checks 2-4 closes only by REVERSE (P12).
- Add tests: "ADOPT of a rate-mismatched fill is refused" and "ADOPT of a FILL_MISPOSTED fill is refused".

### B2 · :84-90 (P12, P13, P15), :79, :166-168 (A-2, A-4) versus D1 §10.2 :1027 · exactly once (CLAUDE.md:28, MC-10); double count · **blocking**

Evidence:
- D1 :1027: "Ledger keys (one per template, so no two templates share a key)", for example `pay:<id>:p6`.
- The delta adds `P12_FILL_REVERSAL`, `P13_PAYIN_REFUND`, `P14_REQUOTE_REPRICE` and `P15_WRITE_OFF` (:86-89), and A-4 adds them to §9 only. **No ledger key is derived for any of them, and §10.2 is not amended.**
- `decisionId` includes `seq` (D1 :553, :1029). Two REFUND or WRITE_OFF decisions on one case (seq 1n and 2n) are therefore two distinct, valid decisions, and each posts.

Further:
- P13 is gated only by "money that was never sent on Arc (a fiat-side pay-in refund with no Arc leg)" (:79). There is no rule that P13 is refused while a booked conversion (a FILLED code) of that pay-in stands unreversed.
- Concrete case:
  - The pay-in is confirmed, and the code is filled and booked (fiat → USDC).
  - The Arc leg is not yet created.
  - Two staff approve REFUND, and P13 debits the client's fiat liability for the full confirmed amount and pays it out.
  - The client's USDC from the fill still stands.
  - The pay-in is therefore both refunded and converted: a double count. A second REFUND decision repeats it, because P13 has no key.

Required:
- Deterministic ledger keys per template in a §10.2 amendment. Examples: `pay:<paymentId>:p13`; `fill:<codeId>:p12`; `p15:<caseId>`; `p14:<paymentId>:<newQuoteId>`.
- At most one P13 per pay-in, and one P12 per fill.
- P13 refused while an unreversed booked fill exists for the pay-in, or while any `ARC_TRANSFER` leg of the payment has a submit marker (order: P12 first, then P13).
- Tests: a double REFUND decision posts once; P13 with a standing fill is refused.

### B3 · :24 (D-1 check 2) · exact money identity misstated; licenses silently dropped sub-unit value (CLAUDE.md:26, MC-03) · **blocking**

Evidence: :24 says "equal the code's quote by the exact integer identity the current `checkFxLock` enforces (the from side is kept exact, `toAmount` equals the floor of the converted amount, and the remainder is the stated dust)".

The parenthetical is not the identity `checkFxLock` enforces. That identity is `(from − remainder)·num = to·den` with `remainder < convertibleStep`, at ports.ts:98-104 and conversion.ts:77.

Reconstructed above:
- honest fill → to 55,555,000 with remainder 1 cent;
- floor(from·rate) → 55,555,555.

The gloss **refuses the honest fill and accepts the floor fill** (driver rows 1-2).

The floor fill debits 100000 cents and credits 55,555,555. The residue, 1e9 mod 18 = 10/18 of a micro-USDC, is posted nowhere. That is sub-unit value dropped without a record, which CLAUDE.md:26 forbids. The text is self-contradictory on the one exactness check the delta adds.

Required: delete the parenthetical, or replace it with the identity verbatim: from exact (FROM_EXACT), `(fromAmount − remainder)·num == toAmount·den`, `0 ≤ remainder < convertibleStep(rate)`, and remainder 0 for TO_EXACT. Add a test fixture with the honest 100000 → 55,555,000 / remainder 1 case and the floor fill (refused).

### m1 · :144 · citation and paraphrase of the release proofs · minor
- "exactly D1 §8.4 check 3 (D1 :796-807)": the proofs are at D1 :814-835, and :796-807 is the one-request rule, the marker and resolution.
- "(b) the reserved nonce consumed by another transaction" mislabels (b). D1 (b) is for a transfer **with** a `txHash` and also requires "neither source has a receipt for the transfer's `txHash`" (:824). "Reserved nonce" is (c).

The by-reference statement governs, so this is minor.

### m2 · :22 · location · minor
`checkFxLock` is in `src/journey/quote/ports.ts:98`, not `src/nova-ports/conversion.ts`. Only `checkQuote` is there, at :70.

### m3 · :27 · volatile citation · minor
`compose.ts:322` is the uncommitted working-tree line. At HEAD 2777414 the same function is at :250. Cite the function `isQuoteLive` instead.

### m4 · :26, :163-171 · amendment list incomplete (LedgerPort) · minor
Check 4 reads `bookedEntryRef` "back through `LedgerPort`". D1 LedgerPort (:396-401) has only `getJournalByKey(ourKey)`, and `JournalReceipt` (:391) carries no lines. A Nova-booked journal is not under our key, so the read-back needs a new LedgerPort method and fake support. The list claims to be "the complete list", but it has no amendment for this.

### m5 · :165, :167 (A-1, A-3) · minor
A-3 removes `ConversionPort.execute`, but A-1 does not dispose of the existing `CONVERSION` source (D1 :476) or its §10.3 row `conv:<conversionId>:<state>` (D1 :1039, :1050).

### m6 · :58-59, :166 (D-2 cases, A-2) · minor
- "every QUARANTINE and every PAUSE … opens a `CaseRecord` with a reason code": D1 `CaseRecord` (:597-604) has no reason-code field and no QUARANTINE/PAUSE kind, and A-2 adds neither.
- `caseId` = hash(kind, subject) (D1 :1029). Two UNMATCHED_FILL cases on one payment therefore collide unless the subject is the `codeId`, and the subject is not stated.

### m7 · :38 · minor
`fillTimeoutAfterExpiry` has "no default", but the delta does not say that an unset value fails closed at startup, as D-5 says for accounts.

### m8 · :80 versus :146 · minor
- :80 allows a retry when the original is "terminal with P6 posted, **or** proven not sent". :146 says "after a proof, **and** only after the payment is terminal with P6 posted". D1 :796 is the second. Make :80 say "and".
- `retry:<originalPaymentId>` sits in the payer's own client-key namespace, and the payer can see the payment id. A payer can therefore pre-create that key, and the operator retry then gets KEY_CONFLICT. This fails closed with no loss. A domain-separated derivation (D1 `lp('nv1-…')` style) avoids it.

### m9 · :15 (DA-4) · minor
"answer 33 says no such event exists today": KHUMO_ANSWERS:42 reads "doesn't exist" as **automated execution** not existing, not a fill event. The assumption stands, but the attribution overstates the answer.

### m10 · :19, :24 · MC-03 · minor
`getPricingCode` returns only `{codeId, rate, expiresAt}`. The expected `fromAmount`, `toAmount` and `remainder` ("the code's quote") must therefore be computed by the package. The delta should say they come from the one conversion module (U1, using the identity). DQ-3 covers only the fill side.

### m11 · minor (four small gaps)
- :21: `reviewer` on FILLED has no rule. Compare D-3's `reviewer ≠ bookedBy`.
- :89: P15 "credit Client liability **or** Suspense" has no selection rule.
- :99: D-3's `confirmedAmount` type (`FiatMinor<CCY>`) and who creates `expectedPayInId` are unstated.
- :127-135: the D-5 table omits GL-5 (`arc.outbound`) and GL-7 (funding), and uses descriptive names rather than GL-n (CLAUDE.md Naming).

### Note (outside the target, not counted)
KHUMO_ANSWERS:36, "Our reading" for answer 27, still says the design "first proves the original request was never created (DFNS lookup by `externalId` …)". D-6 and D1 F-6 refute that. The F-6 follow-up text sent to Raayl should not carry it.

VERDICT: NEGATIVE (14 defects: 3 blocking, 11 minor)

phase · Delta verify (Lens R round 2) · streak 0/3 · NEGATIVE
