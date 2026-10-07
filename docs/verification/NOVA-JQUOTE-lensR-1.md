VERIFICATION · lens: R · target: JQUOTE (src/journey/quote/{fiat,ports,compose,fakes}.ts + test/unit/jquote-*.test.ts + test/types/fiat-mixing.typecheck.ts) · commit: 27774147e485ac38d084a429c2b6856a7a391cc3 (JQUOTE files modified in the working tree; src mtimes 12:48-12:49, tests up to 13:08; unchanged while this pass ran, 13:28-13:50 SAST 2026-10-07)

This is the round-2 re-verification. It replaces the round-1 report that was at this path, as the task instructed. Round-1 defects B1-B3 and m1-m7 are re-checked below.

Verifier: independent Lens R pass. No file under src/ or test/ was edited. Reconstruction ran in a mkdtemp copy, /tmp/verify-jquote-r2-Qb0mqz. It holds real-file copies of src, test, tools, the configs and node_modules, with no symlink pointing into the repo (`find -lname '*arc-rail*'` is empty).
- No network calls.
- No DFNS, Circle or VALR API calls.
- No .env file read.
- No signing or broadcast.

Judged against:
- the operator goal and correction (verbatim, in the task);
- NOVA_ARC_DESIGN.md §4.1 and §9;
- the CLAUDE.md money invariants;
- docs/constants.md and docs/RUBRIC.md;
- the archived Arc docs.

## CHECKS

### Mechanical (reconstruction)
- **C1 typecheck.** `npx tsc --noEmit` → PASS (exit 0). This includes test/types/fiat-mixing.typecheck.ts.
- **C2 unit tests.** `npx vitest run test/unit/jquote-*.test.ts` → PASS (5 files: 154 tests plus 12 fiat-mixing tests).
- **C3 MC-01 type-aware lint.** `node tools/lint-money-floats.mjs` → PASS ("46 money-path files, 0 finding(s)").
- **C4 Semgrep MC-01 layer.**
  - On fiat.ts, ports.ts and compose.ts → PASS (exit 0).
  - On fakes.ts → PASS (exit 0). The round-1 m3 false positive is gone: the fields are now `fromPrec`/`toPrec`.
- **C5 vendored Semgrep JS/TS rules** on the JQUOTE src, tests and typecheck file → PASS (exit 0).
- **C6 Stryker on the JQUOTE files only.** `npx stryker run --mutate 'src/journey/quote/fiat.ts,src/journey/quote/ports.ts,src/journey/quote/compose.ts' --tempDirName .stryker-tmp-verify-JQUOTE --reporters clear-text --concurrency 2` → PASS.
  - Overall 97.73 % (902 killed, 2 timeout, 21 survived, 0 no-coverage). compose 97.36, fiat 100, ports 99.21. The temp dir was cleaned.
  - Equivalent survivors:
    - the `'VALUE'` discriminant strings at :542/:551/:564/:568/:637/:639/:661, where only `'STOP'` is ever tested;
    - the `{kind:'STABLECOIN'}` plan literals at :513/:518, where only `=== 'FIAT'` is tested;
    - :496 `m.kind` (m.asset is undefined, so the result is still refused);
    - :524 (`payoutCurrency` is null first);
    - :473 `minBig` `<` → `<=`;
    - :561/:565/:647/:656 key labels and side strings. The keys stay distinct and deterministic, and the sides are asserted by the `poSides`/`fxSides` tests;
    - ports.ts:44 `denominator <= 0n` → `< 0n`. A zero denominator still returns 0.
  - Real test gaps: compose.ts:426 and :447 (`>=` → `>` on the remainder/step bound inside `checkConservation`) → minor m1.
  - Round-1 m5 survivors (`'NET_EXACT'`, `'TO_EXACT'`) are now killed.
- **C7 MC-07 coverage** (`vitest --coverage` with the repo thresholds, per file, on the three money-path files) → PASS: statements, branches, functions and lines all at 100 %. Round-1 B3 is fixed: the awaited ternary became `if/else` at compose.ts:689-691.
- **C8 MC-08 config consistency** (`test/unit/money-path.test.ts`).
  - JQUOTE part → PASS. stryker.config.json `mutate` now lists `src/journey/quote/{fiat,ports,compose}.ts` (round-1 B2 fixed).
  - In the repo the test FAILS (3 tests), but only for the **JPARTNER** rows added to docs/MONEY_PATH.md:61-66. Those 6 paths are not in `mutate`, and `src/journey/recipients/index.ts` imports `node:util`, which is not on the allow-list.
  - Isolation: in the /tmp copy with the JPARTNER rows removed, money-path.test.ts gives 108/108 pass. This is not a JQUOTE defect. It is reported as observation O1 for routing to JPARTNER.
- **C9 my own planted mutants** in the /tmp copy, run against the jquote tests → **17/17 killed**:
  - M1 payout remainder bound removed (ports:177);
  - M2 FX remainder bound removed (ports:103);
  - M3 root/port partner-kind cross-check removed;
  - M4 adapter chain-ID check removed from the demo gate;
  - M5 settlement-network pin check removed;
  - M6 `usdcIn <= fee` → `<`;
  - M7 platform fee dropped from F;
  - M8 `NoInfer` removed from `addFiat` (killed by jquote-fiat-mixing: add-zar-usd and add-usd-zar);
  - M9 second partner remainder accepted;
  - M10 expiry `<=` → `<`;
  - M11 `demoOnly` forced false;
  - M12 foreign fiat pay-in allowed in the demo;
  - M13 `sourceAsset` check removed;
  - M14 F-carries-gas check removed;
  - M15 payout-lock expiry check removed;
  - M16 FX dust record suppressed;
  - M17 cross-border mode check removed.
- **C10 src/amounts untouched** → PASS. `git status` shows no change under src/amounts. fiat.ts reuses `CBS_MINOR_MAX` and the bigint brand pattern.
- **C11 numbers by hand, re-derived and compared with composer output** (/tmp copy; ZAR lot 37 c → 20 000 units, partner lot 20 000 units → 37 c, fee 100 c, gas allowance 420·10¹² + 123 wei):
  - (a) FIAT R100.10 → ZAR bank, SEND_EXACT, gas charged. Hand: 10010 = 270·37 + 20 → 5 400 000 units, FX remainder 20 c (< step 37). F = 420, gas dust 123 wei. Then 5 399 580 = 269·20000 + 19 580 → re-quote 5 380 000 → gross 9953, net 9853. Conservation: 5 380 000 + 420 + 19 580 = 5 400 000. Composer: identical, `checkConservation` null ✓.
  - (b) FIAT → wallet, RECEIVE_EXACT 1 000 000 units, company absorbs gas. Hand: 50 lots → payer 1850 c, remainder 0. amountWei = 10⁶·10¹² = 10¹⁸. Composer: identical ✓.
  - (c) Boundary: USDC 420 units with 420 charged → AMOUNT_TOO_SMALL. 421 → Arc amount 1, amountWei 10¹² ✓.
  - (d) Overflow: fiat above `CBS_MINOR_MAX` throws RangeError (fiat.ts:57; tested).
- **C12 compile-time currency mixing (MC-02 analogue)** → PASS. `addFiat`/`subtractFiat` across two literal currencies now fail with TS2345. The FiatMinor vs CbsMinor and bigint assignments fail with TS2322. Proof: test/types/fiat-mixing.typecheck.ts and its strip-and-recompile test. M8 shows the test is live (round-1 m1 fixed).
- **C13 idempotency keys** → PASS. `jq:{fx|p1|p2}:<sha256>` is derived from requestId only. payout-2's amount is a function of payout-1's replayed answer, so it is deterministic on retry.
- **C14 Arc facts cited, re-checked against the archive:**
  - C-01 chain ID 5042002: docs/sources/arc/arc_references_connect-to-arc.md:431 "| **Chain ID** | 5042002 |", and docs/constants.md:13 ✓;
  - C-10 native 18 dp: docs/sources/arc/arc_references_evm-differences.md:81 "one balance: a native interface (18 decimals) and an ERC-20 interface (6", and constants.md:24. Re-derived by C11(b): 1 USDC = 10¹⁸ wei ✓.
  - No DFNS fact is cited by the unit (grep "dfns" over src/journey/quote is empty).
- **C15 CPN citation** (ports.ts:13-19) → PASS. Unchanged from round 1. docs/sources/circle/cpn/concepts_quotes.md has the rate lock, two-way quotes and cost breakdown. No CPN field name is used. The fee currency is flagged as an assumption (K-52).
- **C16 secrets and real calls** → PASS. grep for fetch(, http(s)://, process.env, apiKey, secret, privateKey, mnemonic and Bearer over src/journey/quote, the jquote tests and the typecheck file → none.

### Spec items (reconstruction against the operator goal, the correction and the computed task)
- **S1 four combinations, only the needed legs** → PASS.
  - `legs = journeyLegs(payIn, payout)`, enforced by `checkConservation` :404-406. CONVERT_IN iff FIAT pay-in, PAYOUT iff FIAT_BANK.
  - All four are tested for SEND_EXACT and RECEIVE_EXACT.
  - Port-call counts of 0 are asserted for legs not needed (test :164-165, :450-451, :902).
- **S2 FX only through a port** → PASS. compose.ts computes no rate. `fxPortFromConversion` wraps Nova's `ConversionPort.quote` with the same key, and an unreadable expiry gives BAD_EXPIRY.
- **S3 asset is a parameter, USDC only** → PASS (`ASSET_NOT_SUPPORTED`, compose.ts:505).
- **S4 gas in USDC at 18 dp, dust handled** → PASS.
  - The U1 split is used.
  - The allowance sub-minor record is `NON_POSTING` (round-1 m2 addressed).
  - The real gas dust is P4D's job. The open ownership question is recorded as Q-N23.
- **S5 partner fee only for FIAT_BANK** → PASS. `net = gross − fee` and `fee ≤ gross` are checked, and `sourceAsset` is checked (round-1 m6 fixed).
- **S6 all-in amount, F, expiry, rate lock** → PASS.
  - `CustomerFee` F = platform + charged gas (round-1 m7 fixed).
  - Expiry = min(TTL, FX lock, payout lock), refused if not after now. Killed mutants M10 and M15.
- **S7 cross-border OFF by default** → PASS.
  - It is refused with a test (:392, :409, :909).
  - The demo is gated on the config literal and on the settlement adapter's own `chainId`. ArcNetworkAdapter refuses params other than 5042002/ArcTestnet at construction (src/network/arc/adapter.ts:87).
  - The partner kind is declared by the composition root and cross-checked against the port.
  - Killed mutants: M3, M4, M12 and M17. Round-1 m4 is fixed.
- **S8 integer only** → PASS (C3, C4).
- **S9 FxPort with two fakes** → PASS. LotTableFx and BandedFx are structurally different and share one contract (`describe.each`). The two payout fakes are labelled TEST_FAKE.
- **S10 PII** → [inspection-only] PASS. Only the opaque `beneficiaryRef` enters the quote and its digest. There are no bank details and nothing goes on-chain.
- **S11 fail closed on port remainders** → **FAIL** (B1, below). The round-1 fix bounds a remainder by the *step* of the rate the port itself chose, not by its value.

### Judgment lenses
- **JL-1 fail-closed** → FAIL in part (B1). Every other integrity path throws `QuoteIntegrityError`. Killed mutants: M1, M2, M5, M13 and M14.
- **JL-2 human-owned decisions** → PASS. `arc.quoteDust` ownership and the NON_POSTING gas record are recorded in OPEN_QUESTIONS Q-N23. But Q-N23's own premise is false (see B1).
- **JL-4 auditability** → PASS. The quote id is a digest of every field, and `checkConservation` re-checks it.
- **JL-5 fewest new parts** → PASS. It reuses ConversionPort and U1.
- **JL-6 privacy** → PASS [inspection-only].

## DEFECTS

### B1 · ports.ts:103 (`checkFxLock`), ports.ts:177 (`checkPayoutQuote`), compose.ts:426/:447 (`checkConservation`), compose.ts:560-568 (`payoutForSource`) · Lens R S11 / JL-1 / CLAUDE.md "Sub-unit dust goes to a named suspense account" · severity **blocking**

**The problem.** The round-1 fix accepts any remainder that is `< convertibleStep(rate) = denominator / gcd(numerator, denominator)`. The step is a property of the rate representation, and the port chooses that representation. So the value a remainder may hold is bounded only by `numerator/gcd` target minor units, and grows with the rate's precision.

- The header claim at ports.ts:23-25 ("the sub-unit residue that cannot become a whole minor unit of the target asset") is false.
- OPEN_QUESTIONS Q-N23 ("at most one payout minor unit's worth") is false too.
- Even the test fixture breaks that claim. C11(a) sets aside 19 580 USDC units, worth 19 580·37/20 000 = 36.2 ZAR cents.

**Reproduced in the /tmp copy** (company absorbs gas, platform fee 0, all quotes `checkConservation` = null, result OK):

- **A1, an honest fake at a realistic 4-dp partner rate.** `LotTablePayoutQuotes` lot is 100 USDC → R1845.23 (rate 184523/10⁸, step 10⁸ units). Wallet → ZAR bank, SEND_EXACT 150 USDC.
  - Result: Arc amount 100 USDC, recipient R1844.23.
  - Dust: `PAYOUT_REMAINDER` **50 000 000 units (50 USDC)** → GL-4 `arc.quoteDust`.
- **A2, a crafted or buggy partner answer.** Rate 3/(2·10⁸), source 399.999999 USDC.
  - Result: Arc amount 200 USDC, recipient **3 cents**.
  - Dust: `PAYOUT_REMAINDER` **199.999999 USDC** → `arc.quoteDust`.
  - In general a port can divert just under half of any SEND_EXACT amount this way.
- **A3, the FX side.** `LotTableFx` lot is R1845.23 → 100 USDC. FIAT R3000.00 → wallet.
  - Result: the payer is debited R3000.00 and the receiver gets 100 USDC.
  - Dust: `FX_REMAINDER` **R1154.77** → `NOVA_FX_ENGINE_SUSPENSE`.

Payer value far above sub-unit dust is booked into dust suspense: misposting. `arc.quoteDust` has no decided owner (Q-N23).

**Fix (in JQUOTE).** Bound a remainder by its **value**, not by the rate's step: accept a remainder only when it is worth less than one target minor unit at the quoted rate, `remainder × rate.numerator < rate.denominator`. Otherwise throw `QuoteIntegrityError`.
- Apply this in `checkFxLock` (FROM_EXACT), in `checkPayoutQuote` and in the two `checkConservation` guards.
- An honest engine or partner can always meet this by reporting its effective rate (`to/from`, or `gross/source`) with remainder 0. Adjust the fakes and fixtures to do so.
- Add tests A1-A3 as refusals.
- Correct the wording at ports.ts:23-26 and in Q-N23.
- Alternatively, record a human decision (K-51 / Q-N23) on a configured absolute cap and test it. Until then the unit must fail closed.

### m1 · test/unit/jquote-compose.test.ts vs compose.ts:426, :447 · MC-08 test strength · minor

Stryker survivors show that no test feeds `checkConservation` a quote whose FX or payout remainder equals the step exactly. The `>=` → `>` mutants survive. These guards are second lines behind the port checks, which are killed (M1, M2). Add boundary cases. They must be re-done anyway under B1's value bound.

### Observation O1 (not a JQUOTE defect; route to JPARTNER) · docs/MONEY_PATH.md:61-66 vs stryker.config.json, src/journey/recipients/index.ts

The repo-level `test/unit/money-path.test.ts` is red: 3 tests fail.
- The JPARTNER money-path rows are not in Stryker `mutate`.
- `recipients/index.ts` imports `node:util`, which is not on the allow-list.

This makes `scripts/ci.sh` red, independent of JQUOTE. With those rows removed, the test passes 108/108.

### Round-1 items
| Item | Status |
|---|---|
| B1 | **Not fixed.** Re-raised above, at a lower magnitude but still unbounded. |
| B2 | Fixed (C8). |
| B3 | Fixed (C7). |
| m1 | Fixed (C12). |
| m2 | Addressed (NON_POSTING, Q-N23). |
| m3 | Fixed (C4). |
| m4 | Fixed (S7). |
| m5 | Fixed (C6; port-call counts asserted). |
| m6 | Fixed (S5). |
| m7 | Fixed (S6). |

## VERDICT: NEGATIVE (2 defects: 1 blocking, 1 minor)

phase · JQUOTE Lens R round 2 (report path -1 as instructed) · streak 0/3
