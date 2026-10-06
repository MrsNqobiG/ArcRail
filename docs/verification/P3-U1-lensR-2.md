VERIFICATION · lens: R · target: U1 (src/amounts/index.ts and its tests) · commit: 4ebdbed + uncommitted U1 fix block (working tree). Input hashes (sha256, first 12): src/amounts/index.ts a5bcc21c5b2c · test/unit/amounts-conversion.test.ts 4a3f4124951d · test/unit/amounts-rebrand-lint.ts 61d0096e2263 · test/unit/amounts-rebrand-lint.test.ts 3fa5b4460fa3 · test/unit/amounts.test.ts 35fbd9ad6dad · test/property/amounts-conversion.property.test.ts f5fcd19bd416 · test/property/amounts.property.test.ts 43907acd3334 · test/types/amount-mixing.typecheck.ts 2d0c94c23193 · test/unit/amount-mixing.test.ts 308731dd5e98 · docs/CONTRACT.md 3f1141e8e6f9 · docs/RUBRIC.md 62698867c785 · docs/MONEY_PATH.md eeaacb76ee24 (unchanged since round 1) · docs/constants.md e494e7724fa5.

This is verifier round 2 on U1: an independent Lens R pass, 2026-10-06.
- **Spec.** I checked U1 against:
  - the relayed U1 unit spec;
  - KICKOFF U1 row "asset registry (address, decimals, status)";
  - CONTRACT §1.1, §5.7 and §6/§6.1;
  - RUBRIC code items MC-01, MC-02, MC-03, MC-07, MC-08, MC-21, MC-34 and JL-1;
  - docs/constants.md;
  - the docs/MONEY_PATH.md Number allow-list.
- **Not relied on.** The module's header comments, the round-1 fix notes and the LEDGER. Every number below was re-run.
- **Guard rules, obeyed by hand:**
  - The only network calls were read-only Arc testnet RPC at https://rpc.testnet.arc.io: `eth_chainId`, plus `eth_call` for `decimals()` and `symbol()` on 0x3600…0000.
  - No mainnet endpoint, no signing or sending, and no .env or key file read.
  - Docs pages were fetched only by `tools/source_drift.py`, which wrote its output to /tmp.
- **Writes.** My only write is this report.
  - Mutants and plants lived in `mktemp -d /tmp/u1v2-mut-XXXXXX`. It held real copies of src/, test/, tools/ and docs/, asserted to be real files; only `node_modules` was a symlink. Each re-brand plant used its own `mkdtemp /tmp/u1v2-plant-*` holding a real `cpSync` copy of src/, asserted to be real files and under /tmp.
  - All of these are deleted, and none are left in /tmp.
  - After my run, src/amounts/index.ts still has the hash a5bcc21c5b2c and `git status` is unchanged.
  - Stryker used `--tempDirName .stryker-tmp-verify-U1`. Stryker removed it on exit, and I confirmed it is gone.

## CHECKS

| # | Check | Result | Evidence |
|---|---|---|---|
| K1 | tsc | PASS | `npx tsc --noEmit -p tsconfig.json` → exit 0 (Node v22.23.3 from .tools/node/bin). |
| K2 | U1 tests | PASS | `vitest run --config test/amounts.vitest.config.ts` → 5 files, 215 tests passed. `vitest run test/unit/amount-mixing.test.ts test/unit/money-path.test.ts test/unit/money-float-lint.test.ts test/unit/smoke.test.ts` → 4 files, 227 tests passed. |
| K3 | MC-07 coverage of src/amounts/index.ts (U1 tests only, v8) | PASS | Statements 67/67, branches 18/18, functions 26/26, lines 67/67. No COVERAGE_EXCLUSIONS row needed. |
| K4 | MC-08 mutation | PASS | `npx stryker run test/amounts.stryker.config.json --mutate src/amounts/index.ts --tempDirName .stryker-tmp-verify-U1 --reporters clear-text` → 134 mutants: 134 killed, 0 survived, 0 timeout, 0 no-coverage. Score 100.00 (break 90). I used the U1-narrowed vitest config so that other units being edited in parallel can't break the initial run. |
| K5 | My own mutants (planted in the /tmp copy; U1 conversion, constructor and property suites run per mutant) | PASS | All 22 killed (failing-test count in brackets): M1 ceiling rounding (18) · M2 CBS dust dropped (17) · M3 guard `>=` (17) · M4 guard removed (12) · M5 MAX = 2⁶⁴−1 (5) · M6 `addCbsMinor` returns `(a + b) as CbsMinor` (4) · M7 p upper bound 19 (2) · M8 `placesOf` skips re-validation (1) · M9 display fraction not zero-padded (13) · M10 `hiddenWei` dropped (2) · M11 `assetForUnit` uses `in` instead of `hasOwn` (2) · M12 status never checked (1) · M13 ERC-20 address last byte changed (1) · M14 ERC-20 remainder dropped (7) · M15 k one decade off (28) · M16 outbound `cbsMinor` re-check removed (4) · M17 zero refused (38) · M18 overflow clamps to MAX instead of throwing (12) · M19 `formatCbsMinor` skips re-check (2) · M20 subtract operands unchecked (2) · M21 precision catch rethrows the native error (8) · M22 native decimals 17 (40). |
| K6 | CONTRACT §6.1 rows, recomputed by Python integer division (independent of the module) | PASS | **p = 6, k = 10¹²:** all 9 rows match CONTRACT and `ROWS_P6` digit for digit, including 9,223,372,036,854,775,807,999,999,999,999 → m 9,223,372,036,854,775,807, dust 999,999,999,999. **p = 2, k = 10¹⁶:** all 4 rows match. **ERC-20:** 1,234,567,890,123,456,789 → 1,234,567 units, remainder 890,123,456,789. **Other values:** 21,000 × 20 gwei = 420,000,000,000,000; 2⁶³ − 1 = 9,223,372,036,854,775,807. **Capacity:** 9.22 USDC at p 18, 9.22 × 10¹² at p 6, 9.22 × 10¹⁶ at p 2. **Display, recomputed:** 12345 at p 2 → "123.45"; 2⁶³ − 1 at p 6 → "9223372036854.775807"; 7 at p 18 → "0.000000000000000007". |
| K7 | k = 10^(18 − p), m = ⌊W/k⌋, dust = W mod k, bigint only | PASS | index.ts:261-262 `10n ** (USDC_NATIVE.decimals - decimals)`; :267-269 `wei / k`, `wei % k`. Every call re-validates `p` through `placesOf` (:256-258); M8 is killed. Boundary tests run at p = 0, 17 and 18. A property test agrees with a string-shift reference that uses no division. |
| K8 | Explicit rounding policy; remainders returned, never dropped | PASS | `ROUNDING_POLICY = 'FLOOR_REMAINDER_RETURNED'` (:227). The three inexact paths each return their remainder: `dustWei`, `remainderWei` and `hiddenWei`. Properties checked: m × k + dust = w, 0 ≤ dust < k, dust = 0 exactly when k divides w. M2, M10 and M14 are killed. |
| K9 | Overflow guard, fail closed (round-1 D3 re-check) | PASS | The bound now lives in the `cbsMinor` constructor (:106-112), so it covers every CbsMinor route. I reconstructed the boundary at each route: the constructor (MAX accepted; MAX + 1 and 2⁶⁴ refused); `nativeWeiToCbsMinor` (m = 2⁶³ refused, with `minor` = 2⁶³ on the error); `cbsMinorToNativeWei` with a cast input above MAX (refused before any wei is produced); `addCbsMinor(MAX, 1)` (refused); `subtractCbsMinor` and `formatCbsMinor` with a cast input above MAX (refused). M3, M4, M5, M6, M16, M18, M19 and M20 are all killed. The header claim at :22-27 now matches the behaviour. |
| K10 | Asset registry values, status and C-ids (MC-21; round-1 D5 re-check) | PASS | `USDC_NATIVE`: 18n, no address, ENABLED, the credit view. `USDC_ERC20`: 6n at 0x3600…0000, ENABLED, not a credit view. chainId '5042002'. Both are deep-frozen. `assetForUnit` uses `Object.hasOwn`, so 'toString' and '__proto__' are refused. `assertAssetEnabled` refuses DISABLED. **Re-derived:** `tools/source_drift.py` (sha256 5504b5e7…80e1, the same version reviewed in P1-rubric-lensR-13/15 and round 1), run by me with output to /tmp, reported 0 integrity failures, 2 drifted URLs, 0 fetch errors and 33 URLs checked. The two drifted URLs are Circle's cctp supported-chains page and llms.txt, and U1 cites neither. U1's four URLs (rpc-endpoints, evm-differences, contract-addresses, deposits) are all identical (HTTP 200). The quotes for C-01, C-05, C-10, C-11, C-13 and C-14 are in the archive at evm-differences.REFETCH-later.md:80-85 and rpc-endpoints.md:64-65; C-12 is at contract-addresses.md:48 and C-15 at deposits.md:208-210. **Live testnet:** `eth_chainId` 0x4cef52 = 5042002; `decimals()` = 6; `symbol()` = "USDC". |
| K11 | Property tests (fast-check) | PASS | The properties cover: round trips m→w→m and u→w→u; w→(m, dust)→w; conservation; dust bounds; monotonicity; the overflow boundary for every p; `addCbsMinor` throwing exactly when a + b > MAX; `subtractCbsMinor` undoing `addCbsMinor`; ERC-20/CBS equality at p = 6; display against a string reference; `formatNativeWei` never above 6 dp and conserving value; the `cbsPrecision` domain over doubles. Each runs 300 to 2000 cases. |
| K12 | MC-01 type-aware lint | PASS | `node tools/lint-money-floats.mjs` → "13 money-path files, 0 finding(s)". A planted `(Number(w) / 1e18).toFixed(6)` in a /tmp copy of the module gave 6 findings. |
| K13 | MC-01 Semgrep layer on U1's money-path file (round-1 D1 re-check) | PASS | `semgrep scan --metrics=off --disable-version-check --no-git-ignore --error --quiet --config tools/semgrep/mc01-money-float.yml src/amounts/index.ts` → exit 0; a run without `--quiet` reports 13 rules on 1 file, 0 findings. `p % 1` is gone: integrality is now decided by `BigInt(p)` (:244-248). The same plant fired mc01-float-literal, -literal-operand, -to-fixed and -number-parse. |
| K14 | MONEY_PATH Number allow-list rows for U1 | PASS | Three rows, unchanged since round 1 (file hash eeaacb76ee24): `CbsPrecision`, `cbsPrecision(0)` and `cbsPrecision`. Each one is the CBS precision p (an integer 0..18, used only as decimal places and as the exponent source for k), not an amount, so each reason is sound. money-path.test.ts resolves each row to one declaration (passes in K2). The type-aware lint confirms that no other `number` appears in the module. |
| K15 | MC-03 single conversion module (import graph plus grep) | PASS on the code; see D1 and D2 for the controls | A grep of src/ outside src/amounts for `10n **`, 10¹² literals, `parse/formatUnits`, `parse/formatEther`, `parse/formatGwei`, `1e12`/`1e18`, `as CbsMinor/UsdcUnits/NativeWei` and constructor calls finds only src/chain/config/index.ts:93-94 `nativeWei(<literal>)`. Every other src import of amounts is `import type`. The re-brand rule passes on the repo (K2). |
| K16 | U1 re-brand rule, my own plants (round-1 D2 re-check) | PASS for the round-1 cases; new gaps → D1, D2 | Every round-1 evasion is now flagged and pinned by a test: object, array and nested destructuring, generic `v as T`, an `any` variable, an `any`-returning helper. My further plants: static field, async return and `BigInt.asUintN(64, a + b)` were flagged (REBRAND-ARITH), and the `arguments` cast was flagged (REBRAND-CAST). **Not flagged:** see D1 (cross-unit constructor re-brand) and D2 (the rest). |
| K17 | MC-02 compile-fail | PASS for the listed pairs; see D1 | amount-mixing.test.ts strips all 25 tagged directives and recompiles. Each line fails with exactly its tagged TS code, and nothing untagged fails (K2). |
| K18 | CONTRACT §6 "any → display" row (round-1 D4 re-check) | PASS with D3 | `formatCbsMinor`, `formatUsdcUnits` and `formatNativeWei` (:300-330) use bigint `/`, `%` and string padding only. The native amount is floored to 6 dp, and the wei below that is returned as `hiddenWei`. M9 and M10 are killed. |
| K19 | MC-34 no LLM or agent import | PASS | src/amounts/index.ts has no import statements. |
| K20 | JL-1 fail-closed | [inspection-only] PASS | Every refusal throws: negative → RangeError; non-bigint or non-number → TypeError; bad p → RangeError; overflow → `CbsMinorOverflowError` ("reject and PAUSE"); unknown or disabled view → `AssetUnavailableError`. Nothing clamps or returns a default (M18 proves a clamp would be caught). The PAUSE itself is the caller's job. |

## DEFECTS

| ID | Location | Lens + criterion | Severity |
|---|---|---|---|
| D1 | src/amounts/index.ts:106, :115, :120 (`cbsMinor(value: bigint)`, `usdcUnits(value: bigint)`, `nativeWei(value: bigint)`); test/types/amount-mixing.typecheck.ts (no constructor pair); test/unit/amounts-rebrand-lint.ts (no rule) | R · MC-02 "Mixing `CbsMinor`, `UsdcUnits` and `NativeWei` fails to compile" / CLAUDE.md "Mixing types is a compile error" / MC-03 | **blocking** |
| D2 | test/unit/amounts-rebrand-lint.ts:44-79 (taint rules and "Limits" L1-L3), :120-128 (`.ts` files only) | R · unit spec "lint rule or test that forbids re-branding raw arithmetic results outside the conversion module" / MC-03 | minor |
| D3 | src/amounts/index.ts:312-315 `formatCbsMinor`; test/unit/amounts-conversion.test.ts:251 `[7n, 18, '0.000000000000000007']` | R · CONTRACT §6 display row "Never show 18 dp to users" | minor |

**D1: a branded amount can be re-branded as another unit with no conversion, and nothing stops it.** Each brand constructor takes `value: bigint`. Every branded amount is a `bigint`, so passing one unit's value to another unit's constructor compiles and is not flagged.

My reconstruction, in a /tmp copy with `src/zz-x.ts`:
```ts
const uu: UsdcUnits = usdcUnits(5n);
export const x: NativeWei = nativeWei(uu);                  // 5 units (5 × 10⁻⁶ USDC) become 5 wei
export const y: CbsMinor = cbsMinor(nativeWei(10n ** 18n)); // 1 USDC becomes 10¹⁸ minor
```
`npx tsc --noEmit -p tsconfig.json` → exit 0. `lintRebrands` → no findings for either line, because there is no arithmetic.

At p = 6 the second line credits 10¹⁸ minor units, which is 10¹² USDC. It is below `CBS_MINOR_MAX` (about 9.22 × 10¹⁸), so the overflow guard does not fire either.

Why this is blocking and not a deliberate evasion like a cast:
- The call is the sanctioned constructor and looks safe.
- It is exactly the Arc two-view hazard (C-10/C-11/C-14): for example, `nativeWei(erc20Log.value)` in U4 ingestion.
- The control that U1 owns, MC-02's compile-time ban on mixing, does not cover this route. The MC-02 fixture tests assignment, argument passing, equality and raw sums, but not constructor arguments.
- So a misposting by a factor of 10¹² can reach the CBS before reconciliation notices.

**Fix: make the public constructors refuse an already-branded argument at compile time.** For example, type the parameter as `bigint & { readonly [amountUnit]?: never }`. I checked in /tmp that this turns `nativeWei(uu)` into TS2345 "Type '"NativeWei"' is not assignable to type 'never'". U1's own re-checks of an input that is already branded (`nativeWei(w)`, `cbsMinor(m)`, and so on) then need a private, un-exported checker. Then:
- add one MC-02 fixture line per ordered constructor pair (6 lines);
- either make the re-brand rule flag a constructor whose argument type carries a different brand, or record why the type change makes that rule unnecessary.

**D2: the re-brand rule has undocumented gaps.** The header (:67-78) says the rule's limits are only L1-L3. In /tmp plants, each a real copy of src/ plus one planted module, the rule returned **no finding** for each of these.

Taint routes that do not reach a parameter:
- a setter: `set v(x: bigint) { this.w = nativeWei(x); }` … `c.v = a + b`;
- a default parameter: `function f(v: bigint = a + b) { return nativeWei(v); }`;
- a tagged template: ``tag`${a + b}` `` with `tag(_s, v) { return nativeWei(v); }``;
- `br.call(undefined, a + b)`, `br.apply(undefined, [a + b])` and `br.bind(undefined, a + b)()`, where `br(v) { return nativeWei(v); }`.

A second conversion that uses no bigint arithmetic, so it is never tainted:
- by string shifting: `usdcUnits(BigInt(wa.toString().slice(0, -12) || '0'))`;
- through a library: `nativeWei(parseUnits('1.5', 18))` (viem is a dependency);
- through floats in a src file outside MONEY_PATH: `nativeWei(BigInt(Math.floor(Number(wa) / 1e12)))`. The rule leaves number arithmetic to MC-01 (:64-65), but MC-01 scans only money-path files, so neither layer covers this case.

Files outside the scan:
- `listSourceFiles` collects only `*.ts` (:125), so a `src/**/*.mts` or `*.cts` module is not scanned. Its `nw(7n + 3n)` was not flagged.

Today the real src has none of these: K15's grep is clean. Each one needs deliberate code, and the compiler still blocks every implicit mix except D1. **Fix:** close the cheap ones:
- treat a setter's parameter as the target of a tainted property write;
- treat parameter initializers as declarations;
- treat a tagged template's substitutions as arguments;
- follow `.call`, `.apply` and `.bind` on a src function;
- scan `.mts` and `.cts`;
- flag any brand constructor whose argument comes from `BigInt(<string or number expression>)` or a library call outside the conversion module, or list these as named limits with a test pinning each one, as was done for L1.

**D3: `formatCbsMinor` shows 18 decimal places at p = 18.** CONTRACT §6 says "Never show 18 dp to users (KICKOFF U11)". `formatCbsMinor(cbsMinor(7n), cbsPrecision(18))` returns "0.000000000000000007", and the test at amounts-conversion.test.ts:251 pins this. The practical impact is nil: §6.1 marks p = 18 as "unusable", and the CBS sets p. But the formatter contradicts the literal row it implements. **Fix:** either cap CBS display at 6 dp, floored, with the hidden remainder returned as `formatNativeWei` does, or add a CONTRACT note (routed to the contract owner) that the rule applies to the native view only.

**Observations (not defects).**
- **Q-C4.** `CBS_MINOR_MAX` is still fixed at 2⁶³ − 1, while CONTRACT §6 defines CBS_MAX as the CBS integer maximum (Q-C4, still open). The comment at :73-76 now says this correctly. Track the value under Q-C4.
- **Duplicate C-12 address.** C-12 is now held in two places: `USDC_ERC20.address` (amounts :176) and `usdcErc20Address` (src/chain/config/index.ts:88, U2). They agree today. Consider making one derive from the other when U2 is next touched.
- **Round-1 fixes.** D1 (Semgrep), D3 (overflow on every route), D4 (display row) and D5 (registry status) are fixed. D2 is fixed for every case it reported, and new gaps are recorded above as D1 and D2.

VERDICT: NEGATIVE (3 defects: 1 blocking, 2 minor)
