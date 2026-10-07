VERIFICATION · lens: R · target: docs/NOVA_ARC_DESIGN_DELTA-1.md (revision 2, after the round-1 fix block) · commit: 07e9950 (target identical to HEAD; sha256 prefixes: DELTA-1 5b852687eb2c3809, KHUMO_ANSWERS 654f5f464684c3c0, NOVA_ARC_DESIGN d820d43d00644b86, the last equal to the R4-frozen hash)

Verifier: independent verifier subagent, 2026-10-07 14:31-14:45 SAST. Round 2 of the delta, re-run.

This file replaces an earlier round-2 report written at 13:44 on the same target bytes. That text is kept in git at commit 07e9950. Since then the code that the delta names (`checkFxLock`, `src/journey/quote/ports.ts`) has changed under JQUOTE R2 B1, so one earlier finding (B3) is re-judged below.

Judged against:
- docs/KHUMO_ANSWERS.md;
- docs/NOVA_ARC_DESIGN.md (D1, frozen at R4);
- CLAUDE.md:24-32 (money invariants);
- docs/constants.md;
- docs/RUBRIC.md (MC-01, MC-03, MC-04, MC-10, MC-11, MC-12, MC-19);
- the archived DFNS pages under docs/sources/dfns/ and docs/sources/MANIFEST.md.

Safety:
- No DFNS, Circle or VALR API was called. Nothing was signed or broadcast, and no network was used. No .env file was read.
- Scratch was a mkdtemp dir, `/tmp/verify-delta1b-nvH1mQ`, holding real-file copies (`find -type l` = 0). Node came from `.tools/node/bin` (v22.23.3).
- The full ci.sh was not run.

## CHECKS

### Mechanical
- `npx tsc --noEmit`, repo-wide → PASS, exit 0.
- MC-01 float lint, `node tools/lint-money-floats.mjs` → PASS: "51 money-path files, 0 finding(s)".
- Semgrep MC-01 (`tools/semgrep/mc01-money-float.yml`) → PASS: 13 rules, 0 findings, exit 0.
  - Scope: `src/nova-ports/conversion.ts` and `src/journey/quote/{ports,compose,fiat}.ts`, the code D-1 extends.
  - Self-test: `const f = 0.1 * 3` planted in a /tmp copy of conversion.ts gives 2 findings and exit 1, so the rule fires.
- Semgrep with the pinned JS and TS rule sets over the same 4 files → PASS: 203 rules, 0 findings.
- Target tests → N/A. The delta is design text and has no tests yet.
  - Baseline for the FX code that D-1 replaces: `test/unit/jquote-*.test.ts` (5 files) and `test/contract/ports-conversion.contract.test.ts` → PASS: 6 files, 204 tests.
- Stryker on the files the delta names → PASS: **99.41 %** (168 killed, 1 survived, 0 no-coverage, 0 timeout).
  - Command: `--mutate 'src/nova-ports/conversion.ts,src/journey/quote/ports.ts' --tempDirName .stryker-tmp-verify-delta1b --reporters clear-text --concurrency 1`, with `.stryker-tmp*` added to `ignorePatterns` so that other agents' sandboxes are not copied.
  - Per file: ports.ts 100 % (120/120); conversion.ts 97.96 % (48/49).
  - The survivor is `conversion.ts:76` `>` → `>=`. It is **equivalent**: `remainder == from.amount` makes the left side of :77 zero, so `to.amount` must be 0, which :75 has already refused ("nothing converts").
  - The temp dir was removed by Stryker, and no reports were written (clear-text only).
- gitleaks on a /tmp copy of the target → PASS ("no leaks found").
- Grep of the target for mainnet, `5042` other than 5042002, 40-hex addresses, secret, key, token, password and mnemonic → PASS.
  - The only hit is `paginationToken` at :145, a DFNS query-parameter name.
  - Testnet only is restated at :5 (5042002, `ArcTestnet`). It matches constants C-01 and the DFNS archive (`networks_index.md`).

### DFNS facts, re-checked in the archive [archive-only, no live re-fetch]
- The sha256 of each cited page equals its MANIFEST row, and the delta cites the right rows → PASS:
  - `api-reference_wallets_abort-transfer.md` 3dba876e…: row 205;
  - `api-reference_wallets_list-transfers.md` 6ffd2d54…: row 215;
  - `guides_developers_create-transfers.md` cfa4c413…: row 229.
- :143, the quote "Never submit a second Transfer Asset request to 'retry' a transfer that has not reached a terminal status", appears verbatim in create-transfers.md:206 (where the archive uses double quotes) → PASS.
- :144, "aborts a transfer in `Executing` status that has not yet been signed", matches abort-transfer.md:7 → PASS.
- :145 says List Transfers has only `limit` and `paginationToken` as query parameters. The archive's `in: query` entries are at list-transfers.md:52-53 and :64-65, and `walletId` is `in: path` (:42-43). `externalId` appears only in response bodies → PASS.
- :145, "An `externalId` resolution only finds the entity; it never proves its absence", matches D1 :803 ("A listing that does **not** show it proves nothing") and F-6 :1087 → PASS.
- The delta uses no Arc constant other than the chain ID.

### D1 citations, re-traced line by line
Each of these is PASS:
- :476 `InboundSignal.source`;
- :487-497 `LEG_UNRESOLVED`;
- :529-605 case store and `CaseRecord`;
- :537-546 `DecisionKind`;
- :555-558 `approvers`, `SAME_APPROVER`, `APPROVER_UNAUTHENTICATED`;
- :599 `CaseRecord.kind`;
- :631 `SIGNAL_CONFLICT` → QUARANTINE;
- :676 `ConversionPort.execute`;
- :684 `verifyCallback`;
- :796 one DFNS request, and a retry is a new payment after P6;
- :803 a listing proves nothing;
- :1025 payment id from payer plus client key;
- :1041 CF-31 gate;
- §9.1 at :910, §7.8 at :722, §4.1 FIAT rows at :152-154.

Exceptions:
- :144 cites :796-807 as "the proofs", but the proofs are at :814-835 (m2).
- :167 cites `ports.ts:85`; `fxPortFromConversion` is at :87 (m3).
- `compose.ts:322` (:27) is now the committed line at HEAD 07e9950, where `isQuoteLive` returns `nowMs < q.expiresAtMs`. The round-1 m3 is therefore resolved.

### Planted mutants (reconstruction)
Setup: /tmp copies of `src/journey/quote/ports.ts`, `src/nova-ports/{conversion,ids}.ts`, `src/amounts/index.ts` and `src/network/types.ts`, compiled with the repo's tsc to ESM and run against the **current** `checkFxLock`.

Hand reconstruction, at a code rate of 10000/18 micro-USDC per cent:
- floor(100000·10000/18) = floor(55,555,555.5…) = 55,555,555. The residue is 1e9 − 55,555,555·18 = 10, that is 10/10000 of a cent, which no integer remainder can hold.
- 99999·10000/18 = 55,555,000 exactly, with remainder 0.
- 1 cent is worth 555.5 micro-USDC, so a remainder of 1 cent is worth more than one target unit.

Each row lists four checks: `checkFxLock`, then cross-multiplication against 10000/18 (the delta's check 3), then the gloss of check 2 ("to = floor"), then `remainderBelowOneUnit`. The driver output was:

| Case | checkFxLock | check 3 | gloss | rem<1 unit |
|---|---|---|---|---|
| 100000 → 55,555,000, rem 1 | refuse ("remainder is worth one target minor unit or more") | true | false | false |
| floor fill 100000 → 55,555,555, rem 0 | refuse ("does not balance to the minor unit") | true | **true** | true |
| 99999 → 55,555,000, rem 0 | accept | true | true | true |
| **M1** 99999 @ 550/1 → 54,999,450 (self-consistent) | **accept** | **false (refuse)** | true | true |
| equivalent rate 20000/36 | accept | true | true | true |
| **M2** from 100008 against request 99999 | refuse ("does not keep the from amount exact") | true | true | true |
| 1 cent | refuse ("nothing converts") | – | – | – |
| 9 cents → 5000, rem 0 | accept | – | – | – |
| reverse direction 1,000,555 micro @ 18/10000 → 1800, rem 555 | accept | – | true | true |
| reverse direction 1,000,556, rem 556 (one unit withheld) | refuse | – | false | false |

Expiry `filledAt < expiresAt` at 299,999, 300,000 and 300,001 gives true, false and false. This matches `isQuoteLive` (compose.ts:321-322).

What the mutants show:
- Check 3 is necessary: `checkFxLock` alone accepts M1. Round-1 B1(a) stays resolved.
- With the current `remainderBelowOneUnit` rule, every row that `checkFxLock` accepts also satisfies the gloss "to = floor".
  - The earlier round-2 B3 found the gloss contradicting the code. That depended on the old `checkFxLock` (at 348972d, without `remainderBelowOneUnit`), which accepted the 100000 → 55,555,000, rem 1 case. The current code refuses that case.
  - The remaining gap: the gloss is weaker than the identity. It would accept the floor fill, which the code refuses. See m1.

### Round-1 defects, re-checked on the target text
- **B1** (fill fields, read-back, booked-but-refused path, authoritative timestamp, tests): resolved at :21-27, :32-35 and :41-52. A gap remains in the ADOPT path; see B1 below.
- **B2** (authenticity and dedupe): resolved for FILLED and pay-in events (:28-31, :100-103), and DQ-1 fails closed. A residual gap on REJECTED and EXPIRED is m11.
- **B3** (parallel case system, two-person rule, REFUND, retry key, CF-31): resolved (:56, :66, :75, :79-80).
- **B4** (DFNS facts): resolved (see above).
- **B5** (consent binding, single use): resolved at :105.

### Lens R items applied to a design delta
- **Follows from a quoted answer** → PASS. Each D-n cites answers that exist at KHUMO_ANSWERS:26-46. The exception is DA-4's reading of answer 33 (m9).
- **Never weakens a CLAUDE.md money invariant** → **FAIL**, on B1 (misposting or rate change adopted without the client's consent) and B2 (exactly once is missing on four new templates, and P13 can double count).
- **Keeps D1 frozen** → PASS.
  - D1's sha256 is unchanged, and conflicts are routed through A-1 to A-7.
  - The "complete list" of amendments is incomplete (m4, m5, m6).
- **Two fakes per port** → PASS [inspection-only] (:153-159). The LedgerPort read-back fake is missing (m4).
- **MC-01, integers** → PASS [inspection-only]. Rates are num/den bigints, and the target has no floats.
- **MC-03, one conversion module** → PASS in intent (:22, "no second implementation"). The source of the expected amounts is unstated (m10), and the check-2 gloss is weaker than the identity (m1).
- **MC-04, templates balance** → PASS [inspection-only] for P13, P14 and P15 as described. P12's wording is cross-currency (m13).
- **MC-10, every keyed op has a key** → **FAIL**: P12, P13, P14 and P15 have no ledger key (B2).
- **MC-11, every state × outcome** → PARTIAL. No action is given for an `awaitFill` result of REJECTED or EXPIRED (m11).
- **MC-12, maximum age** → PASS:
  - the fill timeout (DQ-2);
  - the aged history failure;
  - the expiry boundary.

  DQ-2 does not say that an unset value fails closed (m7).
- **MC-19, two-person** → PASS (:66, :73).
- **Fail closed** → PASS:
  - with DQ-1 unset, no fill or pay-in is accepted;
  - with no consent, the item is held and a case opens;
  - with the gas, dust or write-off account unset, startup fails or the action is refused;
  - a failing history write opens a case.

## DEFECTS

### B1 · NOVA_ARC_DESIGN_DELTA-1.md:32-33, :72, :81, :92 · ADOPT closes a misposted or re-priced fill without the required control (CLAUDE.md:26-27 conservation; answer 37 consent) · **blocking**

Evidence:
- :32: "A refused fill that is already booked (a fill after expiry, `FILL_MISPOSTED`, or any failed check) … opens a requote case (D-2) of kind `UNMATCHED_FILL` … The case closes by exactly one of two paths, both two-person".
- :33: "**ADOPT:** the requote consumes the already-filled conversion (the new quote is built from the booked fill …)".
- :81: "`REQUOTE` and `ACCEPT_WITH_CONSENT` are refused unless `ConsentPort.consume` returns a record that matches". `ADOPT_FILL` (:72) is not in that rule.
- :92: "A case can't be closed while its money is unbalanced". This stops unbalanced journals only. It does not stop balanced but misposted ones.

Reconstruction:
- ADOPT is open to a fill that failed **check 4**. One example is a booked journal that is balanced but debits another client's account, or debits the right client more than `fromAmount` (M2). Two staff can adopt it, and "the new quote is built from the booked fill" makes the misposting the payment's conversion.
  - The other client's money then funds this payment, and no consent from either client is required.
- ADOPT is also open to a fill that failed **check 3** (M1, 550/1 against 10000/18). From 99999 cents the client receives 54,999,450 micro-USDC instead of 55,555,000, a loss of 555,550 micro-USDC (about 0.56 USDC). That is a rate change, and answer 37 requires client consent for it. Consent applies only if ADOPT is read as a REQUOTE, which the text does not say.

Required:
- `ADOPT_FILL` is allowed only for a fill that passed checks 1-4 exactly and failed only check 5 (expiry), or check 1 because the code was superseded by a requote. The fill must be at the code's own rate and amounts, with a correct read-back.
- Any adopted terms that differ from what the client consented to need `ConsentPort.consume`, bound to the adopted fill's digest.
- A fill that fails check 2, 3 or 4 closes only by REVERSE (P12).
- Tests: ADOPT of a rate-mismatched fill is refused; ADOPT of a `FILL_MISPOSTED` fill (wrong client, over-debit) is refused.

### B2 · :84-90 (P12-P15), :79, :166-168 (A-2, A-4) against D1 §10.2 :1027 · no ledger keys for the new templates, and P13 is not ordered after a booked fill (CLAUDE.md:28 exactly once, MC-10; double count) · **blocking**

Evidence:
- D1 :1027 has "Ledger keys (one per template, so no two templates share a key)", for example `pay:<id>:p6`.
- The delta adds four templates at :86-89:
  - `P12_FILL_REVERSAL`;
  - `P13_PAYIN_REFUND`;
  - `P14_REQUOTE_REPRICE`;
  - `P15_WRITE_OFF`.
- A-4 (:168) adds them to §9 only. **No ledger key is derived for any of them, and §10.2 is not amended.**
- `decisionId` includes `seq` (D1 :553, :1029). So two `REFUND`, `REVERSE_FILL` or `WRITE_OFF` decisions on one case (seq 1n and 2n) are distinct and valid, and with no template key each one posts.

Further:
- P13 is gated only by "money that was never sent on Arc (a fiat-side pay-in refund with no Arc leg)" (:79).
- Re-traced sequence:
  1. The pay-in is confirmed, and the code is FILLED and booked, so the client's fiat side is debited `fromAmount` and the USDC side credited.
  2. No Arc leg exists yet, so P13 is allowed.
  3. Two staff approve REFUND, and P13 debits Client liability for the full confirmed pay-in and credits Settlement.
  4. The client's booked USDC still stands, so the same pay-in is both converted and refunded.
- Only Nova's own `INSUFFICIENT_FUNDS` check might stop it. That check is assumption A-09, not a rule of this design.

Required:
- Add a §10.2 amendment with one deterministic key per template, for example:
  - `fill:<codeId>:p12`;
  - `pay:<paymentId>:p13`;
  - `pay:<paymentId>:p14:<newQuoteId>`;
  - `p15:<caseId>`.
- At most one P12 per fill and one P13 per pay-in.
- P13 is refused while an unreversed booked fill exists for that pay-in (P12 comes first), or while any `ARC_TRANSFER` leg of the payment has a submit marker.
- Tests: two REFUND or REVERSE_FILL decisions post once; P13 with a standing fill is refused.

### m1 · :24 · the check-2 gloss is weaker than the identity it names (MC-03, CLAUDE.md:26) · minor (the round-2 B3 is downgraded)
- Text: "by the exact integer identity the current `checkFxLock` enforces (the from side is kept exact, `toAmount` equals the floor of the converted amount, and the remainder is the stated dust)".
- Under the current `checkFxLock`, which runs `checkQuote` at conversion.ts:77 and then `remainderBelowOneUnit` at ports.ts:105, the gloss is a **consequence** of the identity: every accepted driver row satisfies it.
- It is not sufficient. The floor fill (100000 → 55,555,555, rem 0) satisfies the gloss, but the identity refuses it, because the residue of 10/10000 cent cannot be posted as an integer.
- Not blocking, because the same sentence names the code identity as the authority and :22 forbids a second implementation.
- Fix: replace the parenthetical with the identity verbatim:
  - FROM_EXACT keeps `fromAmount` exact;
  - `(fromAmount − remainder)·num == toAmount·den`;
  - `remainder·num < den`;
  - remainder 0 for TO_EXACT.

  Add the floor fill as a refused test fixture.

### m2 · :144 · citation and paraphrase of the release proofs · minor
- "exactly D1 §8.4 check 3 (D1 :796-807)": the proofs are at :814-835.
- "(b) the reserved nonce consumed by another transaction" mislabels (b). D1 (b) applies to a transfer **with** a `txHash` and also needs "neither source has a receipt" (:824). The reserved nonce is (c).
- The by-reference statement governs, so this is minor.

### m3 · :22, :167 · code locations · minor
- `checkFxLock` is in `src/journey/quote/ports.ts:100`, not in `src/nova-ports/conversion.ts` (only `checkQuote` is there, at :70).
- `fxPortFromConversion` is at ports.ts:87, not :85.

### m4 · :26, :163-171 · the amendment list is incomplete: LedgerPort read-back · minor
- Check 4 reads `bookedEntryRef` "back through `LedgerPort`".
- D1 LedgerPort (:396-401) has only `getJournalByKey(key)`, and `JournalReceipt` (:391) has no legs.
- A journal booked by Nova is not under our key, so the read-back needs a new method and fake support. The "complete list" has no amendment for this.

### m5 · :165, :167 (A-1, A-3) · minor
A-3 removes `ConversionPort.execute`, but A-1 does not dispose of the `CONVERSION` source (D1 :476) or its §10.3 rows (D1 :1039, :1050).

### m6 · :58-59, :166 · minor
- "every QUARANTINE and every PAUSE … opens a `CaseRecord` with a reason code": D1 `CaseRecord` (:597-604) has no reason field and no QUARANTINE or PAUSE kind, and A-2 adds neither.
- `caseId` = hash(kind, subject) (D1 :1029). Two `UNMATCHED_FILL` cases on one payment collide unless the subject is the `codeId`, and the subject is not stated.

### m7 · :38 · minor
`fillTimeoutAfterExpiry` has "no default", but the delta does not say that an unset value fails closed at startup, as D-5 does for accounts.

### m8 · :80 against :146 · minor
- :80 allows a retry when the original is "terminal with P6 posted, **or** proven not sent". :146 says "after a proof, **and** only after … terminal with P6 posted". D1 :796 says the proof ends the payment with P6 in the same commit, so "and" is right.
- `retry:<originalPaymentId>` sits in the payer's own client-key namespace. A payer could pre-use that key, and the operator retry would then get `KEY_CONFLICT`. This fails closed with no loss. Domain separation in the style of D1's `lp('nv1-…')` avoids it.

### m9 · :15 (DA-4) · minor
"answer 33 says no such event exists today": answer 33's "doesn't exist" is read in KHUMO_ANSWERS:42 as **automated execution** not existing. The assumption stands, but its attribution overstates the answer.

### m10 · :19, :24 · MC-03 · minor
- `getPricingCode` returns only `{codeId, rate, expiresAt}`, so "the code's quote" amounts must be computed by the package. The delta should say they come from the one conversion module.
- Under the current rule, a FROM_EXACT amount whose `from·num` is not divisible by `den` has **no** valid quote at a rate with num ≥ den (driver row 1: 100000 cents at 10000/18). The design should state what happens then (refuse, or an effective-rate code). DQ-3 covers only the fill side.

### m11 · :20, :28-30, :165 · REJECTED and EXPIRED results of `awaitFill` are under-specified · minor
- :20 says `awaitFill` resolves to `FILLED | REJECTED | EXPIRED` "delivered as an inbound event (see authenticity below)". The dedupe key and projection (:30) and A-1 cover only FILLED fields.
- No journey action is given for REJECTED or EXPIRED (MC-11).
- With key `fill:<codeId>`, a REJECTED followed by a FILLED is `SIGNAL_CONFLICT`, which fails closed. So this is minor, but the projection and action should be stated.

### m12 · :35 · a requote can race a valid delayed fill · minor
- The guard "may not request a new code while an `UNMATCHED_FILL` case … is open" does not cover the window between `expiresAt` and the fill timeout. During that window a fill made before expiry may still arrive.
- If a requote's new code is filled and the old fill then arrives, there are two booked conversions. The close-time invariant (:35) forces a P12 reversal, so the company carries FX exposure, but the client is not harmed.
- Fix: no new code until the old code's outcome is known or `fillTimeoutAfterExpiry` has passed.

### m13 · :86, :88 · template wording · minor
- P12, "debit the booked to-side account, credit the booked from-side account", reads as one cross-currency journal. D1 `JournalRequest` has a single `asset` (:385). State one mirrored journal per asset.
- P14 "fails if the new quote exceeds the reservation" but does not say what happens to a surplus reservation when the new quote is lower.

### m14 · small gaps · minor
- :21: `reviewer` on FILLED has no rule (compare D-3's `reviewer ≠ bookedBy`).
- :89: P15 "credit Client liability **or** Suspense" has no selection rule.
- :99: the type of `confirmedAmount` (`FiatMinor<CCY>`) and who creates `expectedPayInId` are unstated.
- :127-135: the D-5 table omits GL-5 and GL-7 and uses descriptive names rather than GL-n (CLAUDE.md Naming).

### Note (outside the target, not counted)
KHUMO_ANSWERS:36, "Our reading" for answer 27, still says the design "first proves the original request was never created (DFNS lookup by `externalId` …)". D-6 :145 and D1 F-6 refute that, so the F-6 follow-up to Raayl should not carry it.

VERDICT: NEGATIVE (16 defects: 2 blocking, 14 minor)

phase · Delta verify (Lens R round 2) · streak 0/3 · NEGATIVE
