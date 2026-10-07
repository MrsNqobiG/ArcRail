VERIFICATION · lens: R · target: JQUOTE (src/journey/quote/{fiat,ports,compose,fakes}.ts + test/unit/jquote-*.test.ts + test/types/fiat-mixing.typecheck.ts) · commit: 07e9950b1b2efea8cbdc004e729fad19d044fa1b (JQUOTE files clean at HEAD; src mtimes 12:48-14:07, unchanged while this pass ran, 14:30-14:50 SAST 2026-10-07)

This is the round-3 re-verification. It replaces the round-2 report at this path, as the task instructed. The round-2 report is still in git at commit 07e9950 (`git show 07e9950:docs/verification/NOVA-JQUOTE-lensR-1.md`). Round-2 defects B1 and m1 are re-checked below.

Verifier: independent Lens R pass. No file under src/ or test/ of the repo was edited.
- Reconstruction ran in two mkdtemp copies: /tmp/verify-jquote-r3-LMfrxF (tsc, tests, lint, Semgrep, coverage, Stryker) and /tmp/verify-jquote-r3-mut-HxIwX0 (planted mutants and probes). Both hold real-file copies; `find -lname '*arc-rail*'` is empty in both. Both are left in place (nothing deleted).
- No network calls. No DFNS, Circle or VALR API calls. No .env file read. No signing or broadcast.

Judged against:
- the operator goal and correction (verbatim, in the task);
- NOVA_ARC_DESIGN.md §4.1 ("Quote") and §9.2;
- the CLAUDE.md money invariants, docs/constants.md, docs/RUBRIC.md;
- the archived Arc docs and the archived CPN quote concept.

## CHECKS

### Mechanical (reconstruction)
- **C1 typecheck.** `npx tsc --noEmit -p tsconfig.json` → PASS (exit 0). This includes test/types/fiat-mixing.typecheck.ts.
- **C2 unit tests.** `npx vitest run test/unit/jquote-` → PASS (5 files, 176 tests).
- **C3 MC-01 type-aware lint.** `node tools/lint-money-floats.mjs` → PASS (exit 0, "51 money-path files, 0 finding(s)").
- **C4 Semgrep MC-01 layer** (`tools/semgrep/mc01-money-float.yml`, the ci.sh flags) on fiat.ts, ports.ts, compose.ts and fakes.ts → PASS (exit 0).
- **C5 vendored Semgrep JS/TS rules** (a84ff9cc…) on src/journey/quote, the jquote tests and the typecheck file → PASS (exit 0).
- **C6 MC-08 Stryker on the JQUOTE files only.** `npx stryker run --mutate 'src/journey/quote/fiat.ts,src/journey/quote/ports.ts,src/journey/quote/compose.ts' --tempDirName .stryker-tmp-verify-JQUOTE --reporters clear-text --concurrency 2` (in the /tmp copy) → PASS, exit 0.
  - Overall 97.60 % (893 killed, 0 timeout, 22 survived, 0 no-coverage). compose 97.08, fiat 100, ports 100. Temp dir cleaned.
  - Round-2 m1 survivors (compose.ts:426, :447 bound inside `checkConservation`) are now killed; ports.ts has no survivor.
  - Equivalent survivors (re-derived):
    - `'VALUE'` discriminants at :541/:550/:563/:567/:636/:638/:660, where only `'STOP'` is tested;
    - the `{kind:'STABLECOIN'}` plan literals at :512/:517, where only `=== 'FIAT'` is tested;
    - :495 `m.kind` (m.asset is undefined for FIAT, so it is still refused);
    - :523 (`payoutCurrency` is null first in `crossBorderAllowed`);
    - :472 `minBig` `<` → `<=`;
    - :560/:564/:646/:655 key labels (the keys stay distinct and deterministic);
    - :381 dust join separator; :350/:351 the PAYOUT_REMAINDER `dustText` branch (payout dust is compared with itself, and its amount is bound by the USDC in = out identity).
  - Real test gap: :347 (`dustText` of `FX_REMAINDER` → `''`) survives → minor m1.
- **C7 MC-07 coverage** (`vitest --coverage`, repo per-file 100 % thresholds, include src/journey/quote/**) → PASS: 453/453 statements, 380/380 branches, 68/68 functions, 329/329 lines.
- **C8 MC-08 config consistency** (`test/unit/money-path.test.ts`).
  - JQUOTE part → PASS. stryker.config.json `mutate` lists `src/journey/quote/{fiat,ports,compose}.ts`, matching docs/MONEY_PATH.md:58-60.
  - The repo test FAILS 1/121, only because the **OPS** rows (`src/ops/{audit,ports,queue,types}.ts`) are in MONEY_PATH.md but not in `mutate`. This is not a JQUOTE defect: observation O1, for routing to OPS. Round-2 O1 (JPARTNER rows) is resolved.
- **C9 my own planted mutants** (/tmp copy, run against the jquote tests) → **28/28 killed**:
  - M1 value bound `<` → `<=`;
  - M2 and M3, the FX and payout port value bounds removed (ports:105, :179);
  - M4 and M5, the FX and payout value bounds removed from `checkConservation` (:426, :446);
  - M6 TO_EXACT remainder-0 removed;
  - M7 NET_EXACT remainder-0 removed;
  - M8 second partner remainder accepted;
  - M9 fee guard `<=` → `<`;
  - M10 expiry refusal `<=` → `<`;
  - M11 foreign fiat pay-in allowed in the demo;
  - M12 a LIVE partner allowed in the demo;
  - M13 the adapter chain-ID check dropped;
  - M14 the root/port partner-kind cross-check removed;
  - M15 the USDC in = out check removed;
  - M16 fee > gross removed;
  - M17 the FX USDC precision check removed;
  - M18 platform fee dropped from F;
  - M19 the F-carries-gas check removed;
  - M20 the honest fake always answers at the lot rate (52 tests fail: the composer refuses the hidden remainder);
  - M21 the payout dust record dropped;
  - M22 the settlement-network pin check removed;
  - M23 `isCrossBorder` ignores the payout;
  - M24 **the round-2 step-style bound restored** (`remainder < denominator`, numerator ignored): 7 tests fail, including A1-A3;
  - M25 the `sourceAsset` check removed;
  - M26 the net > 0 check removed;
  - M27 the payout-lock expiry left out of the min (55 fail);
  - M28 the partner funded with the first quote's source.
- **C10 src/amounts untouched** → PASS. `git log -- src/amounts` last touched fc5242d (pre-JQUOTE); `git status` clean for src/amounts. fiat.ts reuses `CBS_MINOR_MAX` and the bigint brand pattern.
- **C11 numbers by hand, re-derived and compared with composer output** (probe file in the /tmp copy; fixture ZAR lot 37 c → 20 000 units, partner lot 20 000 units → 37 c, fee 100 c, gas allowance 420·10¹² + 123 wei):
  - (a) FIAT R100.10 → ZAR bank, SEND_EXACT, gas charged.
    - Hand: 10010 = 270·37 + 20. The 20 c are worth 20·20 000/37 ≈ 10 810 units, which is ≥ 1, so the engine quotes the effective rate 5 400 000/10 010 with remainder 0, and to = 5 400 000.
    - Less F = 420 gives 5 399 580 = 269·20 000 + 19 580. 19 580·37 ≥ 20 000, so the partner quotes the effective rate with gross 269·37 = 9953 and net 9853.
    - amountWei = 5 399 580·10¹². Gas dust is 123 wei (NON_POSTING).
    - Conservation: 5 399 580 + 420 = 5 400 000. Composer: identical ✓.
  - (b) USDC 1 005 000 → USD bank (demo), SEND_EXACT. 100 lots + 5 000 units. 5 000·1 < 10 000, so the remainder is worth ½ cent → dust 5 000, re-quote 1 000 000 → gross 100, fee 50, net 50. Composer: identical ✓ (test :290).
  - (c) Boundaries:
    - USDC 0 → AMOUNT_INVALID.
    - 1 unit → amountWei 10¹².
    - 420 units with 420 charged → AMOUNT_TOO_SMALL.
    - 421 → Arc amount 1 ✓.
  - (d) Value bound at its edge: payout remainder 9 999 at 1/10 000 is accepted and 10 000 is refused; FX remainder 999 c at 1/1000 is accepted and 1000 is refused ✓ (tests :814, :830).
  - (e) Round-2 attacks, recomputed:
    - A1: 50 000 000·184 523 ≥ 10⁸ → refused.
    - A2: 199 999 999·3 ≥ 2·10⁸ → refused.
    - A3: 115 477·10⁸ ≥ 184 523 → refused.
    - Each throws `QuoteIntegrityError` (tests :897-:919) ✓.
- **C12 compile-time currency mixing (MC-02 analogue)** → PASS (jquote-fiat-mixing: the strip-and-recompile test passes under C2; `NoInfer` gives TS2345 on cross-currency add/subtract).
- **C13 MC-10 idempotency keys** → PASS. The key is `jq:{fx|p1|p2}:<lp-sha256(['jquote', call, requestId])>`. It is length-prefixed, so delimiter-safe, and case-sensitive. payout-2's amount is a function of payout-1's replayed answer, so it is deterministic on retry.
- **C14 Arc facts cited, re-checked against the archive:**
  - C-01 chain ID 5042002 (compose.ts:282): docs/sources/arc/arc_references_connect-to-arc.md:431 "| **Chain ID** | 5042002 |", and docs/constants.md:13 ✓.
  - C-10 native 18 dp (compose.ts:16, via U1): docs/sources/arc/arc_references_evm-differences.md:81 "one balance: a native interface (18 decimals) and an ERC-20 interface (6", and constants.md:24. Re-derived by C11: 1 unit at p = 6 is 10¹² wei ✓.
  - No DFNS fact is cited by the unit (`grep -i dfns src/journey/quote` is empty).
- **C15 CPN citation** (ports.ts:11-19) → PASS. The sha256 of docs/sources/circle/cpn/concepts_quotes.md (d26b6fdc…) matches MANIFEST row 63. Lines 25-37 state the exchange-rate lock, two-way quotes and cost breakdown. No CPN field name is used. The fee currency is flagged as an assumption (K-52).
- **C16 secrets and real calls (MC-33, MC-34)** → PASS. A grep for fetch(, http(s)://, process.env, apiKey, secret, privateKey, mnemonic, Bearer and .env over src/journey/quote, the jquote tests and the typecheck file returns nothing. The JQUOTE imports are in-repo modules only.

### Spec items (reconstruction against the operator goal, the correction and the computed task)
- **S1 four combinations, only the needed legs** → PASS.
  - `legs = journeyLegs(payIn, payout)`, re-checked by `checkConservation` :404-406.
  - CONVERT_IN iff FIAT pay-in; PAYOUT iff FIAT_BANK.
  - All four combinations are tested for SEND_EXACT and RECEIVE_EXACT. Zero port calls are asserted for legs not needed (:966).
- **S2 FX only through a port** → PASS. compose.ts computes no rate. `fxPortFromConversion` wraps Nova's `ConversionPort.quote` with the same key, and an unreadable expiry gives BAD_EXPIRY.
- **S3 asset is a parameter, USDC only** → PASS (`ASSET_NOT_SUPPORTED`, compose.ts:504).
- **S4 gas in USDC at 18 dp, dust handled** → PASS.
  - The U1 split is used. The allowance sub-minor record is `NON_POSTING`.
  - The real gas dust belongs to P4D. Ownership stays open in Q-N23.
- **S5 partner fee only for FIAT_BANK** → PASS. `net = gross − fee`, `fee ≤ gross`, `net > 0` and `sourceAsset` are all checked (M16, M25, M26 killed).
- **S6 all-in amount, F, expiry, rate lock** → PASS.
  - F = platform + charged gas.
  - Expiry = min(TTL, FX lock, payout lock), refused when not after now (M10 and M27 killed).
- **S7 cross-border OFF by default** → PASS.
  - It is refused with a test (:409).
  - The demo is gated on the config literal, on the settlement adapter's own `chainId`, on a non-foreign pay-in and on a non-LIVE root-declared partner. M11-M14 and M23 are killed.
- **S8 integer only** → PASS (C3, C4).
- **S9 FxPort with two fakes** → PASS.
  - LotTableFx and BandedFx are structurally different and pass one shared contract.
  - Both payout fakes are labelled `TEST_FAKE`.
  - The fakes now answer honestly at the effective rate (M20 killed).
- **S10 PII** → [inspection-only] PASS. Only the opaque `beneficiaryRef` enters the quote and its digest. There are no bank details, and nothing goes on-chain (MC-30, MC-32 scope).
- **S11 fail closed on port remainders (round-2 B1)** → **PASS**.
  - `remainderBelowOneUnit` (ports.ts:47-51) bounds a remainder by its value: remainder × numerator < denominator.
  - The bound is enforced in `checkFxLock` :105, in `checkPayoutQuote` :179, and again in `checkConservation` :426/:446.
  - A1-A3 are tests that expect refusal. M2-M5 and M24 are killed.
  - The ports.ts header and Q-N23 wording are corrected.
  - A probe where payout-2 answers at a different (finer) rate than payout-1 is also refused. The dust is re-bounded at the final rate in `checkConservation`: "payout remainder is worth one target minor unit or more".
- **S12 MC-03 remainders returned, never dropped** → PASS. The FX remainder is in convertIn plus an FX_REMAINDER record. The payout remainder is a PAYOUT_REMAINDER record counted in USDC in = out. The gas sub-minor part is a NON_POSTING record. M21 is killed.

### Judgment lenses
- **JL-1 fail-closed** → PASS, with minor m3. Every integrity path throws. Two malformed port answers throw `RangeError` instead of `QuoteIntegrityError`: they still fail closed, but not with the documented error.
- **JL-2 human-owned decisions** → PASS. `arc.quoteDust` ownership, the NON_POSTING gas record and the flat F are recorded in OPEN_QUESTIONS Q-N23 (OPEN, Operator + Finance). The Q-N23 premise is now true: the dust is worth less than one payout minor unit.
- **JL-4 auditability** → PASS. The quote id is a digest of every field, and `checkConservation` re-checks it (m1 is a test gap in that re-check).
- **JL-5 fewest new parts** → PASS. The unit reuses ConversionPort and U1.
- **JL-6 privacy** → [inspection-only] PASS.

## DEFECTS

### m1 · test/unit/jquote-compose.test.ts vs compose.ts:347 (`dustText` FX_REMAINDER), :449-450 · MC-08 test strength · minor

**What survives.** The Stryker survivor compose.ts:347:14 (`return ''` for FX_REMAINDER) shows that no test refuses a quote whose FX_REMAINDER dust record differs from `convertIn.remainder`.

**Effect of the mutant.**
- The FX dust record's amount would be neither matched (:449-450) nor bound into the quote id.
- My probe P3 (/tmp copy) confirms the real code refuses such a quote: changing the record to R9.99 while convertIn keeps 10 c gives 'dust records do not match the legs'. No repo test asserts it.

**Fix.** Add that tamper case to the `checkConservation` tests.

### m2 · ports.ts:100-107 (`checkFxLock`) · JL-1 / MC-06 analogue · minor

`checkFxLock` checks `lock.quote.to.precision` against the USDC precision, but never checks `lock.quote.from.precision`, the fiat leg.

Probe P6: an FX answer with ZAR `from.precision` = 3 (the ledger's ZAR is p = 2 [A-03]) is accepted, and the composed result is OK.

No amount is scaled from that field today, because FiatAmount carries no precision. So there is no direct money effect. It is still a silent mismatch on an engine answer, where the USDC side refuses one.

**Fix.** Pass the home or pay-in currency's ledger precision and refuse a mismatch, or record why the fiat precision is out of scope.

### m3 · ports.ts:100-107, :170-185; compose.ts:29-31, :671 · JL-1 (documented fail-closed contract) · minor

A port answer with a negative `remainder` (probe P4, FX) or a negative `fee` (probe P5, partner) throws `RangeError: CbsMinor must not be negative`. It comes from U1's `subtractCbsMinor` or `fiatFromLedger`, not `QuoteIntegrityError`.

The unit documents that a port answer failing its exact check throws `QuoteIntegrityError` and that the caller QUARANTINEs on it. A caller keyed on that error class would treat these cases as generic errors.

It still fails closed: no quote is returned, and no money moves.

**Fix.** Check that `remainder`, `fee`, `gross` and `net` are not negative in `checkFxLock` and `checkPayoutQuote`, returning a reason. Alternatively, wrap the composer's port-answer handling so any throw becomes `QuoteIntegrityError`.

### Observation O1 (not a JQUOTE defect; route to OPS) · docs/MONEY_PATH.md vs stryker.config.json

`test/unit/money-path.test.ts` is red (1/121): `src/ops/{audit,ports,queue,types}.ts` are money-path rows but not in Stryker `mutate`. This makes `scripts/ci.sh` red, independent of JQUOTE. The JQUOTE rows are consistent.

### Round-2 items
| Item | Status |
|---|---|
| B1 (remainder bounded by step, not value) | **Fixed** (S11; M2-M5 and M24 killed; A1-A3 refused by tests and recomputed by hand) |
| m1 (`checkConservation` bound boundary tests) | **Fixed** (C6: :426/:447 killed; tests :814, :830) |
| O1 (JPARTNER money-path rows) | Resolved; a new O1 is raised for OPS |

## VERDICT: NEGATIVE (3 defects: 0 blocking, 3 minor)

phase · JQUOTE Lens R round 3 (report path -1 as instructed) · no blocking defect remains
