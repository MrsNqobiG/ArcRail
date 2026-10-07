VERIFICATION · lens: R · target: JQUOTE (src/journey/quote/{compose,fiat,ports,fakes}.ts + test/unit/jquote-*.test.ts) · commit: 7fe69e270d5f886d92b92afd59645e5daa6de075 (JQUOTE files untracked working tree, read 2026-10-07 11:30 SAST)

Verifier: independent Lens R pass. No file under src/ or test/ was edited. Reconstruction ran in a mkdtemp copy (/tmp/verify-jquote-BCUd94, real-file copies, no symlinks into the repo, removed afterwards). No network calls, no DFNS/Circle/VALR API calls, no .env read.

Judged against: the operator product goal and correction (verbatim, in the task), NOVA_ARC_DESIGN.md §4.1 and §9, CLAUDE.md money invariants, docs/constants.md, docs/RUBRIC.md, and the archived Arc and CPN docs.

## CHECKS

### Mechanical (reconstruction)
- C1 typecheck `npx tsc --noEmit` → PASS (exit 0, 12 s).
- C2 unit tests `npx vitest run test/unit/jquote-*.test.ts` → PASS (4 files, 125 tests).
- C3 MC-01 type-aware lint `node tools/lint-money-floats.mjs` → PASS ("40 money-path files, 0 finding(s)"; compose.ts, fiat.ts and ports.ts are among the 40).
- C4 Semgrep MC-01 layer on the 3 money-path files (`tools/semgrep/mc01-money-float.yml`) → PASS (exit 0).
- C5 Semgrep MC-01 layer on fakes.ts (not a money-path file) → 1 finding: `mc01-to-fixed` at fakes.ts:72 `precision: pair.toPrecision`. This is a false positive (a property *named* toPrecision, not Number.prototype.toPrecision). CI does not scan fakes.ts, so CI is unaffected → minor m3.
- C6 vendored Semgrep JS/TS rules on JQUOTE src and tests → PASS (exit 0).
- C7 Stryker on JQUOTE only (`--mutate compose.ts,fiat.ts,ports.ts --tempDirName .stryker-tmp-verify-JQUOTE --reporters clear-text`) → PASS: 97.61 % (856 killed, 21 survived, 0 no-coverage). compose 97.15, fiat 100, ports 100. Survivors: 16 are equivalent (the `'VALUE'` discriminant goes to `''`, but only `'STOP'` is ever tested; the `'payout-1'`/`'fx'` key label goes to `''`, which still yields a distinct deterministic key; `minBig` `<` goes to `<=`; the sub-conditions at :373/:374/:417 are already decided by :347/:365 or by `m.asset`). The rest are test gaps: the side strings `'NET_EXACT'` (:566) and `'TO_EXACT'` (:575) can become `''` and survive → minor m5.
- C8 MC-08 config consistency `npx vitest run test/unit/money-path.test.ts` → **FAIL**. "Stryker mutate (MC-08)" expects `stryker.config.json` `mutate` to equal the MONEY_PATH.md listed paths. docs/MONEY_PATH.md:58-60 (mtime 10:10) adds `src/journey/quote/{fiat,ports,compose}.ts`, but stryker.config.json (mtime 2026-10-06 23:29) does not list them. `bash scripts/ci.sh` is red, and the JQUOTE files sit outside the MC-08 gate of the real pipeline → defect B2.
- C9 MC-07 coverage, 100 % per money-path file, using the repo's vitest coverage config → **FAIL**: "ERROR: Coverage for branches (99.58%) does not meet global threshold (100%) for src/journey/quote/compose.ts", uncovered line 608. Re-derived from coverage-final.json: branch 109 (`if (step.kind === 'STOP')`) has counts `[14, -4]`. The negative count is a v8 artefact of the awaited ternary on :607. Real execution is 14 STOP and 77 VALUE (the cond-expr at :607 has 81 + 10 = 91 runs). The code path is exercised, but the mandatory gate fails and COVERAGE_EXCLUSIONS.md has no entry for it → defect B3. fiat.ts and ports.ts: 100 %.
- C10 my own planted mutants, run against the jquote tests in the /tmp copy → 11/11 killed:
  - M1 the demo mode serves a LIVE partner (`partner !== 'LIVE'` dropped);
  - M2 lock expiry `<=` → `<`;
  - M3 gas sub-minor dust record suppressed;
  - M4 foreign fiat pay-in not cross-border;
  - M5 `fee > gross` check removed;
  - M6 second partner remainder accepted;
  - M7 `CBS_MINOR_MAX` bound removed;
  - M8 `usdcIn <= gas` → `<`;
  - M9 chain-ID check in the demo gate removed;
  - M10 FX lock dropped from expiry;
  - M11 gas always charged.
- C11 src/amounts untouched: `git diff --stat HEAD -- src/amounts` is empty, and the last commit touching it is fc5242d → PASS. FiatMinor reuses `CBS_MINOR_MAX` and the bigint brand pattern.
- C12 numbers by hand (3+ values, boundaries), re-derived and compared with the composer output in the /tmp copy:
  - (a) FIAT R100.10 → FIAT_BANK ZAR, gas charged. 10010 = 270·37 + 20 → 5 400 000 USDC units. Less 420 gas → 5 399 580 = 269·20000 + 19 580. Gross 269·37 = 9953, net 9953 − 100 = 9853. Conservation: 5 380 000 + 420 + 19 580 = 5 400 000 ✓. The test asserts exactly this.
  - (b) FIAT R100.00, same route: 10000 = 270·37 + 10 → 5 400 000; payout gross 9953, net 9853; dust [ZAR 10, 123 wei, 19 580 units] ✓ (verifier run R1).
  - (c) Gas allowance 420·10¹² + 123 wei at p = 6 (k = 10¹²) → 420 minor + 123 wei ✓ (C-10/C-13).
  - (d) Boundary: 1 base unit USDC → amountWei 10¹² ✓. Exactly 420 units with 420 charged → AMOUNT_TOO_SMALL; 421 → Arc amount 1 ✓.
  - (e) Overflow: fiatAmount above CBS_MINOR_MAX → RangeError (test plus M7).
- C13 compile-time currency mixing (MC-02 analogue, CLAUDE.md "Mixing types is a compile error"): planted a typecheck file in /tmp.
  - `FiatMinor<'ZAR'>` vs `CbsMinor`, vs `bigint` and vs `FiatMinor<'USD'>` → all compile errors ✓.
  - `addFiat(fiatAmount('ZAR',1n), fiatAmount('USD',1n))` and `subtractFiat(usd, zar)` **compile** (C is inferred as `'ZAR' | 'USD'`), contrary to the header claim at fiat.ts:9-11. The runtime `FiatCurrencyMismatchError` catches it (tested), so this fails closed → minor m1.
  - No compile-fail test exists for FiatMinor in test/types.
- C14 idempotency keys: `jq:{fx|p1|p2}:<sha256 hex>` = 70 chars, derived from requestId only ✓. Re-trace: a retry after AMBIGUOUS with the same requestId replays the same keyed calls (test :536). payout-2's amount depends on payout-1's replayed answer, so it is deterministic ✓.
- C15 Arc facts cited by JQUOTE, re-checked against the archive:
  - chain ID 5042002 (C-01) — docs/sources/arc/arc_references_connect-to-arc.md:431 "| **Chain ID** | 5042002 |" and arc_tools_node-providers.md:31 ✓;
  - native view 18 dp (C-10) — docs/sources/arc/arc_references_evm-differences.md:81 "one balance: a native interface (18 decimals) and an ERC-20 interface (6" ✓.
  - No DFNS fact is cited in the unit. No invented fact found.
- C16 CPN citation (ports.ts header): docs/sources/circle/cpn/concepts_quotes.md (MANIFEST row :63, https://developers.circle.com/cpn/concepts/quotes.md, 2026-10-06 09:13 UTC, sha256 d26b6f…) says "Exchange rate lock … for a specified time window", "Two-way quotes … source amount and the destination amount", and "Cost breakdown … details of all applicable fees" ✓. The code uses no CPN field name. The fee currency is flagged as an assumption (K-52) ✓. "fee breakdown" paraphrases "Cost breakdown" ✓.
- C17 secrets and real calls: grep for fetch/http/api key/secret/token/privateKey/mnemonic/process.env over src/journey and the jquote tests → none ✓.

### Spec items (reconstruction against the operator goal, the correction and the computed task)
- S1 Four combinations, only the needed legs → PASS:
  - `legs` = `journeyLegs(payIn,payout)`, enforced by `checkConservation` :331-333;
  - CONVERT_IN iff FIAT pay-in, PAYOUT iff FIAT_BANK;
  - tests cover all four, SEND_EXACT and RECEIVE_EXACT each (:150-375);
  - port-call counts are asserted for wallet→wallet (fx 0, payout 0) and for the partner re-quote (2/1).
- S2 FX only through a port, never reimplemented → PASS. compose.ts computes no rate. It verifies `(from − rem)·num = to·den` only. `fxPortFromConversion` wraps Nova's ConversionPort.quote with the same key, and an unreadable expiry is refused (BAD_EXPIRY), never defaulted.
- S3 Asset is a parameter, USDC only → PASS (`SettlementAsset`, and `ASSET_NOT_SUPPORTED` for anything else).
- S4 Gas in USDC at 18 dp, dust to suspense → PASS, with a reservation (m2). The allowance is split by U1 `nativeWeiToCbsMinor`, the charge is floored, and the sub-minor is recorded.
- S5 Partner fee only when payout is FIAT_BANK; net = gross − fee checked → PASS.
- S6 All-in recipient amount, expiry = min(TTL, every lock), rate lock, refused when expired at compose time → PASS (tests :509-535, M2, M10).
- S7 Cross-border OFF by default, refused with a test; testnet demo is explicitly labelled and stub/fake only → PASS (tests :377-430; M1, M4, M9). [inspection-only] The demo gate trusts the port's self-declared `partnerKind` and the config literal chainId (m4).
- S8 Integer only → PASS (C3, C4, and test :799 "every amount is a bigint").
- S9 FxPort with two structurally different fakes passing one contract (`describe.each(fxMakers)`), plus two PayoutQuotePort fakes labelled TEST_FAKE → PASS.
- S10 PII → PASS [inspection-only]. The quote carries only the opaque `beneficiaryRef`. Nothing goes on-chain from this unit. Bank details never enter it.
- S11 Fail closed on port answers → **FAIL in part** (B1). Identities are checked, but the size of a remainder is not.

### Judgment lenses
- JL-1 fail-closed: the integrity errors throw `QuoteIntegrityError`. But a "remainder" of any size is accepted as dust (B1).
- JL-2 human-owned decisions: the code decides to keep the payer's payout remainder in a new account `GL-4 arc.quoteDust` that the design does not define (m2).
- JL-4 auditability: the quote id is the digest of every field and is re-checked ✓.
- JL-5 fewest new parts: reuses ConversionPort and U1 ✓.
- JL-6 privacy ✓.

## DEFECTS

### B1 · ports.ts:146-150 (`checkPayoutQuote`), ports.ts:74-80 (`checkFxLock`), compose.ts:479-488 (`payoutForSource`) · Lens R / MC-03 + CLAUDE.md "Sub-unit dust goes to a named suspense account" + JL-1 · severity **blocking**

A port's remainder is bounded only by `remainder ≤ source`, never by the sub-lot residue. The composer books any remainder as "dust" in suspense: it re-quotes the partner for `source − remainder` and records `PAYOUT_REMAINDER` to `GL-4 arc.quoteDust`. So non-dust payer value is diverted into a dust suspense account, and the composed quote passes `checkConservation`.

Reproduced in the /tmp copy:
- **A1.** Wallet → ZAR bank, SEND_EXACT 5 400 000 units. The partner's first answer is remainder 5 200 000, source 5 400 000, rate 37/20000, gross 370, fee 100, net 270. It satisfies `(5 400 000 − 5 200 000)·37 = 370·20000`. Result: OK. dust = [`PAYOUT_REMAINDER` 5 200 000 units → GL-4 arc.quoteDust], so 96 % of the payer's USDC is held as "dust". The recipient gets R2.70.
- **A2.** FIAT R100.00 → wallet. The FX answer is remainder 9963 cents, to 20 000 units. Result: OK, dust = [`FX_REMAINDER` ZAR 9963 → NOVA_FX_ENGINE_SUSPENSE]. The payer is debited R100.00 and the receiver gets 0.02 USDC.

Fix (in JQUOTE): refuse with `QuoteIntegrityError` any remainder that is not below the smallest convertible step, i.e. require `remainder < rate.denominator / gcd(rate.numerator, rate.denominator)`:
- in `checkPayoutQuote`;
- for FROM_EXACT in `checkFxLock` (JQUOTE's own wrapper, leaving PORTS' `checkQuote` untouched);
- with a test per port.

### B2 · stryker.config.json `mutate` vs docs/MONEY_PATH.md:58-60 · MC-08 / mandatory CI check (test/unit/money-path.test.ts:79) · severity **blocking**

The JQUOTE block registered its three files as money-path but did not add them to the Stryker `mutate` list. `money-path.test.ts` "Stryker mutate (MC-08)" fails, so ci.sh is red, and the real pipeline does not mutation-test JQUOTE. (By hand the score is 97.61 % ≥ 90, so only the registration is missing.)

Fix: add `src/journey/quote/fiat.ts`, `ports.ts` and `compose.ts` to `mutate`.

### B3 · compose.ts:607-608 · MC-07 (100 % reachable branches per money-path file; CI coverage step) · severity **blocking**

`npx vitest run --coverage` with the repo config fails the per-file threshold for compose.ts (branches 99.58 %, line 608). This is a v8 artefact: branch 109 has counts `[14, -4]` after the awaited ternary on :607. The path is exercised, but the mandatory gate fails and no COVERAGE_EXCLUSIONS.md entry covers it.

Fix: restructure, e.g. `let step; if (req.side === 'SEND_EXACT') step = await composeSend(…); else step = await composeReceive(…);`, then re-run coverage.

### m1 · fiat.ts:9-11, :73-81 · MC-02 analogue · minor

The header claims "Mixing currencies is a compile error when the currency is a literal type", but `addFiat(FiatAmount<'ZAR'>, FiatAmount<'USD'>)` and `subtractFiat` compile because C is inferred as the union. The runtime guard fails closed.

Fix: `b: FiatAmount<NoInfer<C>>`, plus a compile-fail test in test/types (none exists for FiatMinor).

### m2 · compose.ts:169-170, :286, :614 · JL-2 / design §9 consistency · minor

- `GAS_ALLOWANCE_SUBMINOR` names suspense `GL-4 arc.gasDust` (design §9: per wallet, `arc.gasDust.<from>`, posted by P4D on the real receipt). It is applied to an *allowance* remainder that is not value held anywhere. If a downstream unit posts quote dust records, gas dust is double-counted against P4D.
- `GL-4 arc.quoteDust` (payout remainder kept from the payer) is not a design account. Who owns it is a human decision (K-13 analogue).

Record both in the design or in OPEN_QUESTIONS, and label the gas record as non-posting.

### m3 · fakes.ts:72 · MC-01 Semgrep layer · minor

False positive `mc01-to-fixed` on the property `pair.toPrecision`. The file is not on the money path, so CI passes. Rename the field (e.g. `toPrec`), or narrow the rule to call expressions, before the file is ever listed.

### m4 · compose.ts:237-241 · JL-1 · minor [inspection-only]

The demo gate checks `cfg.chainId === 5042002n` (a config literal), never the chain ID the settlement network adapter is actually pinned to. It also trusts `partnerKind` as declared by the port object.

Fix: bind the gate to the network adapter's verified chain ID, and have the composition root, not the adapter, assert `partnerKind`.

### m5 · test/unit/jquote-compose.test.ts · MC-08 test strength · minor

Stryker survivors show that no test asserts the side the composer sends: `'NET_EXACT'` (:566) and `'TO_EXACT'` (:575) can be replaced by `''`. Mutated that way, `checkFxLock`'s "TO_EXACT must leave no remainder" guard is bypassed and nothing notices.

Two further gaps:
- the FIAT→wallet tests do not assert that the payout port was called 0 times;
- the sub-conditions at :373 and :374 are dead code.

### m6 · ports.ts:110-125 · minor

`PayoutQuote` has no source-asset field, so `checkPayoutQuote` cannot confirm that the partner priced USDC (only the currency and precision are checked).

### m7 · compose.ts:172-197 vs NOVA_ARC_DESIGN §4.1 "One quote per payment covers every conversion leg, the fee and the network fee allowance", and §9.3 / :957 (`F`) · minor

`JourneyQuote` has no platform fee `F`, and the gas charge is modelled separately from `F`. Conservation still holds, so no money is misposted, but downstream reservation of A + F cannot be bound to the quote.

## VERDICT: NEGATIVE (10 defects: 3 blocking, 7 minor)

phase · JQUOTE Lens R round 1 · streak 0/3
