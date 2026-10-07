VERIFICATION · lens: R · target: JPARTNER (src/journey/payout/partner/**, src/journey/recipients/**, and their tests) · commit: 07e9950 (the JPARTNER files are committed and clean in the working tree)

Verifier: independent verifier subagent, 2026-10-07 14:30-14:50 SAST. This is the second Lens R pass on JPARTNER. It is filed as `-2` so that the round-1 report (`NOVA-JPARTNER-lensR-1.md`, commit 07e9950) is not overwritten.

Inputs: the code, its tests, docs/NOVA_ARC_DESIGN.md (§4.1, §7.5, §7.8, §9.2, F-17), CLAUDE.md, docs/RUBRIC.md, docs/MONEY_PATH.md, docs/OPEN_QUESTIONS.md, docs/KHUMO_QUESTIONS.md, docs/constants.md, the archived CPN docs under docs/sources/circle/cpn/, and the archived Arc docs under docs/sources/arc/.

Safety: no network call was made, and no DFNS, Circle or VALR API was called. No .env file was read. Nothing was signed or broadcast. Scratch work used real-file copies (no symlinks; `find -type l` returned 0) in `/tmp/jpartner-verify2-mgJ04v` and `/tmp/jpartner-leaks-Yva8uO`.

## CHECKS

### Reconstruction runs
- `npx tsc --noEmit -p tsconfig.json` (whole repo): **PASS**, exit 0 and 0 errors. This fixes round-1 m11.
- JPARTNER tests (`test/contract/jpartner-partner.contract.test.ts`, `test/unit/jpartner-{adapters,details,recipients}.test.ts`): **PASS**, 4 files and 153/153 tests.
- `test/unit/money-path.test.ts`: **FAIL, 1 test, not caused by JPARTNER**.
  - The failing test is "Stryker mutate (MC-08)". `src/ops/{audit,ports,queue,types}.ts` are in MONEY_PATH but missing from `stryker.config.json` `mutate`. That belongs to the OPS unit, which is in progress concurrently.
  - All 6 JPARTNER paths are present in `mutate` (lines 41-46).
  - The import-closure checks pass: `node:util` is gone, and `recipients/index.ts:24` uses `Symbol.for('nodejs.util.inspect.custom')`. Round-1 B2 and B3 are fixed.
- MC-01 float lint (`node tools/lint-money-floats.mjs`): **PASS**, "51 money-path files, 0 finding(s)".
- Semgrep MC-01 (`tools/semgrep/mc01-money-float.yml`) on the 6 source files: **PASS**, 13 rules and 0 findings.
- Semgrep SAST (pinned javascript and typescript rulesets a84ff9cc) on the 6 source files and 5 test files: **PASS**, 203 rules and 0 findings.
- gitleaks on a real-file copy of src/journey/** and the JPARTNER tests: **PASS**, "no leaks found".
  - Every secret and key in the tests is generated at runtime: `randomBytes`, `generateKeyPairSync('ed25519')`, and an AES key from `randomBytes(32)`.
- Egress and secret grep (`https?://`, `fetch(`, `api.circle`, `valr`, `dfns.io|co`, `process.env`, `.env`) over the unit's sources and tests: **PASS**, no matches. Neither adapter makes a network call.
- MC-07 branch coverage (v8, `--coverage.include` on both directories, json-summary): **PASS**, 145/145 branches and 100% of statements.

  | File | Branches covered |
  |---|---|
  | core | 27/27 |
  | cpn-stub | 26/26 |
  | fake | 12/12 |
  | port | 0/0 |
  | tracker | 43/43 |
  | recipients | 37/37 |

  Round-1 m12 is fixed.
- Stryker on the 6 files only (`--mutate <6 files> --tempDirName .stryker-tmp-verify-JPARTNER --reporters clear-text`): **PASS**, score 96.97. There were 577 killed, 18 survived, 0 with no coverage and 0 timed out. The temp dir was removed afterwards.

  | File | Score |
  |---|---|
  | core | 97.87 |
  | cpn-stub | 96.70 |
  | fake | 95.71 |
  | port | 100 |
  | tracker | 95.45 |
  | recipients | 98.06 |

  I re-traced all 18 survivors. Each one is equivalent:
  - **Emptied `catch {}` blocks** (core:112, cpn-stub:80, recipients:352 and :361). The variable stays `undefined` and the next check still fails closed with NOT_FUNDED, BAD_SIGNATURE, SCREENING_UNAVAILABLE or TRAVEL_RULE_HOLD.
  - **`false ||` on `given === null`** (fake:53). `HEX64.test(null)` tests the string "null", which fails.
  - **Removed SECRET_HEX anchors** (fake:23). The input is always the full hex of a Buffer.
  - **`true &&` in safeReason** (tracker:51). "null" passes the regex, but the function still returns null.
  - **`true &&` in isScreenedWallet** (recipients:296). `WeakSet.has(null)` is false.
  - **Removed `refundPaymentId?.`** (cpn-stub:91). The TypeError is caught and the result is MALFORMED.
  - **asObject label strings**. These change only an error label.
  - **The `#final` mutants** (tracker:86 `&& true`, and tracker:117 `if (true)`, `if (false)`, `!==` and the call removed). They are equivalent because dedupe runs first. A rank-1 callback reaches `#contradicts` only when its state was never seen for that payout. In that case it is always the opposite final state, so `#contradicts` reduces to `RANK[cb.state] === 1n`, and `#final` is redundant state (see m12).

### Behavioural probes (my own scenarios, compiled from real-file copies in /tmp/jpartner-verify2-mgJ04v)
- **PROBE-A, one confirmed funding transaction with three spellings of its hash** (`0xabab…`, `0xABAB…`, `0xAbAb…`) under keys k:1, k:2 and k:3. The `isFunded` used is indexer-like and looks hashes up case-insensitively, as `src/indexer/indexer.ts:76/104` lower-cases them.
  - Result: `OK OK OK` with three distinct payout ids. **FAIL**, see B1.
- **PROBE-A2, malformed hash.** `txHash: 'not-a-hash'` passes the core unvalidated and is refused only by the injected `isFunded`. FAIL, part of B1.
- **PROBE-B, CPN stub with a signature verifier that returns a Promise resolving to `false`** (a cast; TypeScript rejects the uncast form).
  - Result: a forged `cpn.payment.completed` is applied (`applied:true`) and `arrived('pay-1') === true`. Any truthy non-boolean counts as authentic.
  - `test/unit/jpartner-adapters.test.ts:179-180` pins this truthy acceptance. See m1.
- **PROBE-C.** `BankRecipientStore.meta(ref)` returns the live row object. Assigning `expiresAt = 10n**18n` through a cast changes the stored expiry, which extends retention. See m6.
- **PROBE-D, by hand: an authentic callback of an unknown type.** `cpn.payment.other`, `''` and `CPN.PAYMENT.COMPLETED` all return `IGNORED` ("not a payout-state event"), the same code as a known RFI or transaction notice. The test at `jpartner-adapters.test.ts:157-160` pins this. **FAIL**, see B2.
- **Planted mutants reasoned against the suite**, one per critical branch:
  - Dropping the `#consumed` check (core:229) is killed by contract :221-229.
  - Dropping `=== true` on isFunded (core:232) is killed by Stryker. Dropping the binding argument is killed by contract :242-250.
  - Dropping `this.#quarantined` in `arrived` (tracker:75) is killed by contract :380-392.
  - Dropping the chain-ID clause of `demo` (core:224) is killed by contract :207-219.
  - Dropping the currency clause of `crossBorder` (core:223) is killed by contract :217-218.
  - Swapping the order of verifyCallback and the tracker in `handleCallback` (core:248-250) is killed by contract :285-298.
  - **PASS.**

### Re-check of every cited archive fact
- C-01, Arc testnet chain ID `5042002` (core.ts:179-180, port.ts:103): **PASS**. It is in `docs/sources/arc/arc_references_rpc-endpoints.md:64` ("| **Chain ID (Testnet)** | `5042002` |") and in constants.md:13. The test's mainnet probe value `5042n` matches rpc-endpoints.md:116.
- "Check the local blocklist copy before every send" (recipients:12-14, :284, :330): **PASS**. Sources are CLAUDE.md "Blocklist" and `docs/sources/arc/integrate_exchanges_custody.md:253` ("Check the blocklist before attempting to sign and broadcast").
- CPN envelope `{subscriptionId, notificationId, notificationType, notification, timestamp, version}` (cpn-stub header): **PASS**. Source: `references_webhooks_webhook-events.md:30-47`.
- CPN payment events (`cryptoFundsPending`, `fiatPaymentInitiated`, `completed`, `failed`, `delayed`, `inManualReview`): **PASS**. Source: webhook-events.md:76-81.
- CPN refund events (`created`, `failed`, `completed`): **PASS**. Source: webhook-events.md:113-115.
- CPN payment states CREATED, CRYPTO_FUNDS_PENDING, FIAT_PAYMENT_INITIATED, COMPLETED and FAILED: **PASS**. Source: `concepts_payments_component-states-and-workflows.md`, "Payment States" table.
- "COMPLETED: the receiver may or may not have received" the transfer: **PASS**. Sources: webhook-events.md:78 and the component-states table.
- Refunds happen when the BFI cannot complete the fiat transfer, and refund COMPLETED means the on-chain return is confirmed: **PASS**. Source: component-states, "Refunds" and "Refund states".
- The payment object has `id` and `status`: **PASS**. Source: `quickstarts_integrate-with-cpn-ofi.md:603` and `:615`.
- "Validate the signature with Circle-provided public keys": **PASS**. Source: `concepts_api_api-integration.md:54-55`.
- "The archive does not name the header, the algorithm or the signed bytes": **PASS**. Grepping for `x-circle`, `key-id`, `ecdsa` and `sha256` finds nothing. webhook-events.md:58 only links an unarchived `/api-reference/verify-webhook-signatures`.
- The IP allow-list is "an additional layer of defense": **PASS**. Source: webhook-events.md:52-62.
- "The Refund object's payment field is not in the archive": **PASS**. The only `paymentId` in the archive is on the Transaction object (quickstart:694 and :896). The extractor is injected, and the refund field is labelled as a test invention (contract test :6).
- CPN creates the payment first and funds it later (port.ts:25-28): **PASS** as a recorded deviation. Source: quickstart "2.3" and the `/payments/:paymentId/transactions` call at :676.
- No DFNS fact is cited or loaded by this unit.

### Spec items (the operator goal, the operator correction and the unit brief)
- PayoutPartner port with a CPN-shaped STUB citing only the archive, plus a clearly labelled FAKE. Both run through one contract (`describe.each([stub, fake])`), and the adapters are structurally different (Ed25519 with a CPN envelope, versus HMAC-SHA256 with a flat body): **PASS**.
- Callbacks are authenticity-checked before anything else. A forged, missing, tampered or throwing verifier gives BAD_SIGNATURE, and a forgery does not poison dedupe (contract :285-298): **PASS**, with the caveat in m1.
- Dedupe on the partner event id (scoped per payout) and on `payout:<id>:<state>` (contract :300-319): **PASS**.
- Out of order: an early RETURNED or REFUND_FAILED is refused and not remembered, and its redelivery is then applied. A late PENDING, PAID or FAILED is stale (contract :321-357): **PASS**.
- Failed and returned payouts are reported:

  | Event | Report |
  |---|---|
  | FAILED | REFUND_DUE |
  | RETURNED after FAILED | REFUND_RECEIVED |
  | RETURNED after PAID | CLAIM, and ARRIVED is withdrawn |
  | REFUND_FAILED | REFUND_FAILED |
  | Contradiction (also after RETURNED) | CONFLICT plus quarantine |

  **PASS.** Round-1 m5, m9 and m10 are fixed.
- ARRIVED is licensed only by an applied, authentic PAID on a payout that is not quarantined (tracker.ts:74-76): **PASS**.
  - Re-check against the archive: `cpn.payment.completed` means "the fiat payment has been sent … the receiver may or may not have received the transfer". This is the partner's payout-complete confirmation that the brief names. The stub header records the wording risk.
- MC-11 state × outcome matrix for the tracker (5 current states × 5 incoming states × new or replayed event id), traced by hand: every cell gives exactly one of replay, stale, conflict, OUT_OF_ORDER or apply. **PASS.**
- The cross-border gate is OFF by default. It is decided on the recipient's stored country OR currency, never on a caller claim. It opens only with `legalOpinionRecorded`, or with `testnetDemo` while pinned to chain ID 5042002. These cases are tested (contract :190-219, :457-461): **PASS**. Round-1 m6 and m7 are fixed. A residual is in m7.
- Funding binding: the check receives the key, recipient, currency and amount, and an over-amount payout is refused (contract :242-250). One funding licenses one payout (contract :221-229): **PARTIAL**, the reuse control can be bypassed (B1).
- BankRecipient (recipients tests :20-299): **PASS**.
  - It is encrypted through the injected KeyManagement, with the ref as AAD.
  - Only a 128-bit random `rcp-` ref leaves the module.
  - Errors carry fixed messages and a JSON form with only the code.
  - `Secret` and the store are redacted in JSON, String and inspect.
  - A console, stdout and stderr capture over a whole lifecycle shows no PII.
  - Nothing personal is in `meta`.
- Retention: deletion at `expiresAt` both on read and through `purgeExpired`, with the period as an explicit constructor input. Recomputed: `DEFAULT_RETENTION_MS` = 5 × 365 × 86 400 000 = 157 680 000 000 ms, which matches the test. Boundaries: created at 100 with retention 1000 is still served at 1099 and deleted at 1100; created at 0 with retention 100 is purged at 100 and not at 99. **PASS** for the mechanics; see m8.
- WalletRecipient (recipients :301-389): **PASS**.
  - The address is normalised.
  - The local blocklist is checked first, and a throwing blocklist gives a typed SCREENING_UNAVAILABLE.
  - The screening port runs next and is tested with two structurally different fakes.
  - The travel-rule hook runs last.
  - Every non-clear answer fails closed.
  - The registry-backed `isScreenedWallet` returns false for an object built by hand.

  Caveats are in m9 and m10.
- PII never appears in partner outputs, reports or renders. Free-text reasons are dropped (`safeReason`) (contract :430-455): **PASS**.

### Numbers and units
- This unit does no conversion. Amounts pass through as `CbsMinor`.
- Checked by hand: `amount <= 0n` is refused (0n and -1n are tested); 1n is accepted by the code. There is no upper bound, and the over-amount guard is the `isFunded` binding.
- Unit typing of the payout amount: see m4.

### Judgment lenses
- **JL-1 Fail-closed: FAIL** (B1, B2).
- **JL-2 Human-owned decisions: [inspection-only] PASS.** The retention value is an explicit input, and the 5-year placeholder is labelled UNVERIFIED with Q-R2 and Q-R12(d) cited (round-1 m2 is fixed).
- **JL-3 03:00 operability: [inspection-only] minor** (m3, m5). PENDING has no poll and no maximum age, and RFI events are dropped.
- **JL-4 Auditability: [inspection-only] minor** (m11). The reports carry the payout id and a machine reason only. `reveal` takes no purpose and leaves no access record.
- **JL-5 Fewest new parts: [inspection-only] minor** (m10). There is a second payout port beside `src/nova-ports/payout.ts`, a second screening port beside `src/compliance` `AddressScreener`, and a second `PartnerKind` vocabulary beside JQUOTE's.
- **JL-6 Privacy by default: PASS.**

## DEFECTS

- **B1** · src/journey/payout/partner/core.ts:228-229 (`const fundingId = \`${req.funding.network}:${req.funding.txHash}\`; if (this.#consumed.has(fundingId)) …`), with port.ts:44 typing `txHash: Hex32 = \`0x${string}\``, which is neither normalised nor validated · RUBRIC MC-10 ("collision-free under case … variation"), CLAUDE.md "Exactly once", JL-1 · **blocking**.
  - The one-funding-one-payout control (MONEY_PATH.md:63, "one funding licenses one payout") keys on the raw hash string. Different spellings of the same transaction hash are therefore different keys.
  - PROBE-A shows the effect. With an indexer-style, case-insensitive `isFunded` (our indexer lower-cases hashes, indexer.ts:76/104), one confirmed Arc transfer licensed three payouts.
  - PROBE-A2 shows that a malformed hash is not refused by the core.
  - `normaliseHex32` already exists in `src/nova-ports/ids.ts:100`.
  - Fix:
    - Normalise `txHash` with `normaliseHex32` before the replay comparison and the consumption check. Refuse a malformed hash (new code or NOT_FUNDED).
    - Use the normalised form in `canonicalRequest` too.
    - Consider keying by `(network, txHash, logIndex)` to match the indexer's per-transfer dedupe key (`transferDedupeKey`, network/types.ts:243).
    - Add a contract test: the same hash in a different case under a second key gives FUNDING_ALREADY_USED.
- **B2** · src/journey/payout/partner/cpn-stub.ts:228 (`return rejected('IGNORED', 'not a payout-state event');`) and port.ts:62-63 · CLAUDE.md "Fail closed" ("Any … unknown event … QUARANTINE (one item)" and page), RUBRIC MC-18 ("unknown type → QUARANTINE"), JL-1 · **blocking**.
  - An AUTHENTIC callback whose `notificationType` the stub does not recognise gets the same `IGNORED` code as a known non-payout event (RFI, transaction, `cpn.refund.created`). Examples are a new `cpn.payment.*` value, a different casing, or an empty type.
  - The port documents `IGNORED` as benign ("authentic, but not a payout-state event"), so the caller cannot tell an unknown event apart and has nothing to quarantine on.
  - The adapters test (:157-160) pins this for `cpn.payment.other`, `''` and `CPN.PAYMENT.COMPLETED`.
  - Combined with the recorded deferral that PENDING has no poll and no maximum age (port.ts:17-21), a payout whose terminal signal arrives under an unrecognised type sits PENDING forever, and no human is paged.
  - Fix:
    - Add a distinct reject code (for example `UNKNOWN_EVENT`) for authentic but unrecognised types. Keep `IGNORED` only for the enumerated known non-payout types (`cpn.rfi.*`, `cpn.transaction.*`, `cpn.refund.created`).
    - Document that the caller quarantines and pages on `UNKNOWN_EVENT` and `MALFORMED`.
    - Update the test.
- **m1** · src/journey/payout/partner/cpn-stub.ts:207-213 (`authentic = this.#o.verifySignature(rawBody, headers); … if (!authentic)`) · JL-1 · minor.
  - Any truthy value counts as authentic, including a Promise (PROBE-B: a forged PAID licensed ARRIVED). The test at `jpartner-adapters.test.ts:179-180` pins truthy acceptance.
  - TypeScript blocks the uncast async form, so this is defence in depth. Still, `isFunded` already uses `=== true` (core.ts:232), and the signature check should match.
  - Fix: `authentic = verifySignature(...) === true`, and change the test to expect BAD_SIGNATURE for a truthy non-boolean.
- **m2** · src/journey/payout/partner/port.ts:16-28 · MC-44 · minor.
  - The header calls its deviations "Recorded deviations and deferrals (docs/NOVA_ARC_DESIGN.md section 7.5, F-17)". Neither §7.5 nor F-17, nor the LEDGER or OPEN_QUESTIONS, records them: no `getPayout`, an in-memory registry, funding before create, and a second port shape.
  - K-56 is cited for the funding-before-create order, but K-56 asks whether fiat→fiat should route through Arc.
  - Fix: record the deviations in a design delta or ledger entry, and cite Q-N12 only (or a new question).
- **m3** · port.ts:17-21 versus design F-17 ("`getPayout` `FAILED` / verified callback") · MC-12(a) · minor.
  - PENDING is a waiting state with no maximum age and no named owner at this port. This is a recorded deferral, but it must be closed in JPAYOUT or JORCH before FIAT_BANK is enabled.
- **m4** · port.ts:41-42 (`readonly amount: CbsMinor; /** … in the payout currency's ledger minor units */`) · CLAUDE.md money invariants ("one `FiatMinor<CCY>` per payout currency. Mixing types is a compile error") · minor.
  - A USD payout amount is typed with the CBS (ZAR) brand, so a ZAR amount can be passed as a USD payout without a compile error.
  - JQUOTE already has `FiatMinor<C>` and `FiatAmount<C>` (src/journey/quote/fiat.ts:31-36).
  - Design §7.5 also types this field `CbsMinor`, so the design and CLAUDE.md conflict here. The `isFunded` binding is the runtime backstop.
  - Fix: take `FiatAmount<C>` (currency and amount together), or record the decision.
- **m5** · cpn-stub.ts:158-164 · JL-3 · minor.
  - `cpn.rfi.*` events are IGNORED. Per component-states "RFIs", the payment cannot proceed until the OFI answers. An RFI is therefore work for Ops, not noise, and dropping it leaves the payout PENDING with nobody told.
  - Fix: surface RFI events as an Ops report kind.
- **m6** · src/journey/recipients/index.ts:223-225 (`meta(ref) { return this.#live(ref).meta; }`) · JL-6 and retention · minor.
  - The live row object is returned. A caller that bypasses `readonly` can extend retention or change routing facts (PROBE-C).
  - Fix: return a frozen copy, or freeze `meta` when the row is created.
- **m7** · core.ts:174 and :224 (`settlementChainId?: bigint` … `this.#o.settlementChainId === ARC_TESTNET_CHAIN_ID`) · JL-1 · minor.
  - The demo gate trusts a bare bigint option. JQUOTE (compose.ts:120 `settlementNetwork`) takes the pinned network adapter instead ("never a config value").
  - Fix: take `SettlementNetworkPin`, so the chain ID comes from the adapter's own pin.
- **m8** · recipients/index.ts:245-255 · retention · minor.
  - Deletion after retention happens only on access or when `purgeExpired` is called. Nothing schedules the purge, so an unread row outlives its retention until someone runs it.
  - Fix: name the owner or scheduler (JTIME, OPS or the composition root) in the header and in an Ops runbook item.
- **m9** · recipients/index.ts:334-340 (`readonly travelRule?: TravelRuleHook;`) and :314-316 (`check(address)`) · FIC Directive 9 (OPEN_QUESTIONS Q-R3: "may not execute a crypto asset transfer if it cannot comply", ¶4.8) · minor.
  - The hook is optional, and with it absent a screened wallet is returned with no travel-rule check. It also receives only the address, so it cannot decide per transfer (by amount or originator).
  - A travel-rule control exists elsewhere (src/compliance `TravelRuleChecker`, outbound `TRAVEL_RULE`), which is why this is minor.
  - Fix: make the hook required (an explicit `NOT_APPLICABLE_TESTNET` value if needed), and pass the transfer context.
- **m10** · port.ts:36 and :74-89, recipients/index.ts:302-316 · JL-5 · minor.
  - JPARTNER adds a second payout port beside `src/nova-ports/payout.ts` `PayoutPartnerPort` (design §7.5, with `getPayout` and its two §7.8 fakes).
  - It adds a second screening port (`AddressScreeningPort`: CLEAR/BLOCKED/UNAVAILABLE) beside `src/compliance` `AddressScreener` (CLEAR/HIT/REVIEW).
  - It adds a second `PartnerKind` vocabulary (`CPN_STUB`/`FAKE_PARTNER`) beside JQUOTE's (`LIVE`/`STUB`/`TEST_FAKE`, quote/ports.ts:158), which `WiredPayoutPartner.kind` must agree with.
  - Fix: reconcile them, or record the mapping before JPAYOUT wires them together.
- **m11** · recipients/index.ts:227-237 (`reveal(ref)`) · JL-4 · minor.
  - The doc says "Decrypts for a stated purpose", but there is no purpose parameter and no access record. A PII access cannot be traced.
- **m12** · tracker.ts:59-60, :83-87 and :117 · simplification · minor.
  - `#final` is redundant: 5 of the Stryker survivors are equivalent mutants on it, as explained above.
  - Fix: remove it, or add a case it actually decides. That keeps the decision core minimal.
- **m13** · core.ts:237-239 · fail-closed ordering · minor.
  - `#consumed.set` runs before `newId()` and `#tracker.register()`. If an injected `newId` throws or repeats an id, the funding is consumed while no payout or key is recorded. The same key can then never be created (FUNDING_ALREADY_USED). This fails closed, but it strands the payout.
  - Default `randomUUID` is unaffected.
  - Fix: consume after a successful register.
- **m14** · tracker.ts:95 (`` `${cb.payoutId}:${cb.eventId}` ``) and :44-45 · MC-10 delimiter variation · minor.
  - The ids allow `:` (TOKEN `[\x21-\x7e]`), so the joined keys can collide when an injected `newId` produces ids with a colon. This is unreachable with the default UUID ids.
  - Fix: encode the key tuple, for example as a JSON array.
- **m15** · core.ts:190-193, tracker.ts:55-61 · MC-18 · minor (recorded deferral).
  - The registry, the funding-consumption set, the dedupe sets and the reports are held in memory. After a restart, B1's control and the REFUND_DUE reports are lost, and callbacks fail closed with UNKNOWN_PAYOUT.
  - port.ts:22-24 records this, but it must be closed before any non-demo use.

Context, not a JPARTNER defect: `test/unit/money-path.test.ts` "Stryker mutate (MC-08)" is red because the four `src/ops/*` paths are missing from `stryker.config.json`. The OPS unit must fix this before integration CI.

Round-1 status: B1 (funding unbound) is fixed but leaves the bypass in the new B1. B2 and B3 are fixed. m1, m2, m4 (recorded), m5, m6, m7, m8 (partly), m9, m10, m11 and m12 are fixed or recorded. m3 is recorded but mis-cited (now m2). m13 carries over as m15.

## VERDICT
NEGATIVE (17 defects: 2 blocking, 15 minor)
