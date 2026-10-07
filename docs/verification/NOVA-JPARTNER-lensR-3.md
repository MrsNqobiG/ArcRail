VERIFICATION · lens: R · target: JPARTNER (src/journey/payout/partner/**, src/journey/recipients/**, and their tests) · commit: 8448431 (HEAD). The 6 JPARTNER source files are unchanged since 6ef160f. Two JPARTNER test files have uncommitted edits: test/unit/jpartner-adapters.test.ts (+1 line) and test/unit/jpartner-recipients.test.ts (+3/-2 lines). Both edits are included in every run below.

Verifier: independent verifier subagent, 2026-10-07, 14:57-15:15 SAST.

Filing note: the workflow asked for `NOVA-JPARTNER-lensR-2.md`. That file already holds the previous verifier's round-2 report (commit 07e9950, NEGATIVE with 2 blocking). I did not overwrite it, because the operator said not to delete anything. This pass reviews the code after the fixes for that report, so it is filed as `-3`.

Inputs:
- the code and its tests
- docs/NOVA_ARC_DESIGN.md (§7.5, F-17, §9.2)
- CLAUDE.md money rules
- docs/RUBRIC.md, docs/MONEY_PATH.md, docs/OPEN_QUESTIONS.md, docs/GATES.md and docs/constants.md
- the archived CPN docs (docs/sources/circle/cpn/) and Arc docs (docs/sources/arc/)

Safety:
- No network call was made, and no DFNS, Circle or VALR API was called.
- No .env file was read, and nothing was signed or broadcast.
- Scratch work used real-file copies in `/tmp/jpartner-verify3-2cqceY` (`find -type l` returned 0 for every copy).
- Stryker used `--tempDirName .stryker-tmp-verify-JPARTNER2`, and that directory was gone afterwards.

## CHECKS

### Reconstruction runs
- `npx tsc --noEmit -p tsconfig.json` (whole repo): **FAIL, not caused by JPARTNER.**
  - There are 47 errors, all in JQUOTE files that are being edited concurrently: `src/journey/quote/fakes.ts` (2), `test/unit/jquote-compose.test.ts` (30), `test/unit/jquote-fakes.test.ts` (13) and `test/unit/jquote-ports.test.ts` (1).
  - None of the errors is in a JPARTNER path.
  - JPARTNER depends on JQUOTE only through a type: `import type { SettlementNetworkPin } from '../../quote/compose.js'` (core.ts:173), which still resolves. See context note C1.
- JPARTNER tests (contract plus the adapters, details and recipients unit tests): **PASS**, 4 files and 165/165 tests.
- `test/unit/money-path.test.ts`: **1 failure, not caused by JPARTNER.**
  - The failing test is "Stryker mutate (MC-08)": `src/ops/{audit,ports,queue,types}.ts` are in MONEY_PATH but missing from `stryker.config.json`. That belongs to the OPS unit.
  - The 6 JPARTNER paths are present in both MONEY_PATH.md:61-66 and stryker.config.json:53-58.
  - The import-closure and allow-list checks pass.
- MC-01 float lint (`node tools/lint-money-floats.mjs`): **0 findings on JPARTNER files.** The repo-wide run reports "51 money-path files, 1 finding". The finding is `src/journey/quote/ports.ts:198:5 MC01-number-expr ladder.unshift(top): number` (JQUOTE, edited now). See C1.
- Semgrep MC-01 (`tools/semgrep/mc01-money-float.yml`) on the 6 source files: **PASS**, 13 rules and 0 findings.
- Semgrep SAST (pinned javascript and typescript rulesets a84ff9cc) on the 6 source files and 5 test files: **PASS**, 203 rules and 0 findings.
- gitleaks (`--no-git`) on a real-file copy of `src/journey/payout`, `src/journey/recipients` and the JPARTNER tests: **PASS**, "no leaks found".
  - Every key and secret in the tests is made at runtime: `randomBytes`, `generateKeyPairSync('ed25519')`, and an AES-GCM key from `randomBytes(32)`.
- Egress and secret grep (`https?://`, `fetch(`, `api.circle`, `valr`, `dfns.io|co`, `process.env`, `.env`) over the unit's sources and tests: **PASS**, no matches.
- MC-07 branch coverage (v8, `--coverage.include` on both directories, json-summary): **PASS**, 158/158 branches, with 100% of statements and functions.

  | File | Branches covered |
  |---|---|
  | core | 31/31 |
  | cpn-stub | 36/36 |
  | fake | 12/12 |
  | port | 0/0 |
  | tracker | 42/42 |
  | recipients | 37/37 |

- Stryker on the 6 files only (`--mutate <6 files> --tempDirName .stryker-tmp-verify-JPARTNER2 --reporters clear-text`): **PASS**, score 97.41 (break threshold 90). There were 657 mutants: 640 killed, 17 survived, 0 with no coverage and 0 timed out. The dry run ran 165 tests.

  | File | Score |
  |---|---|
  | core | 96.23 |
  | cpn-stub | 97.62 |
  | fake | 95.71 |
  | port | 100 |
  | tracker | 97.76 |
  | recipients | 98.17 |

  I re-traced all 17 survivors. 16 are equivalent:
  - **core:91**, `txHash === null ? req :` changed to `false ?`. A malformed hash is refused before anything is stored. Against a stored prior, `null` and a raw malformed string both differ from the stored normalised hash, so the result is KEY_CONFLICT either way.
  - **Emptied `catch {}` blocks** (core:117, cpn-stub:95, recipients:391 and :399). The variable stays `undefined`, and the next check still fails closed with NOT_FUNDED, BAD_SIGNATURE, SCREENING_UNAVAILABLE or TRAVEL_RULE_HOLD.
  - **asObject label strings** (core:157, cpn-stub:104, recipients:165). These change only the label of an error that is caught.
  - **`refundPaymentId?.` changed to `.`** (cpn-stub:106). The TypeError is caught and the result is MALFORMED.
  - **`false ||` on `given === null`** (fake:53). `HEX64.test(null)` tests the string "null", which fails.
  - **The two SECRET_HEX anchor mutants** (fake:23). The input is always the full hex of a Buffer.
  - **The `'payout'` prefix of the dedupe key** (tracker:46). It is a constant in every key.
  - **`true &&` in safeReason** (tracker:52). "null" passes the regex, but the function still returns null.
  - **`cb.state === current` changed to `false`** (tracker:101). A non-PENDING current state was set by an applied callback, which also added `payout:<id>:<state>` to `#seen`, so line 97 already returned. The clause is redundant (m8).
  - **`true &&` in isScreenedWallet** (recipients:324). `WeakSet.has(null)` is false.

  1 survivor is **not equivalent**: core:110, the FUNDING_INVALID detail string changed to `""`. No test asserts that detail (m7).

### Behavioural probes (my own scenarios, compiled with tsc from real-file copies in /tmp/jpartner-verify3-2cqceY/out)
- **PROBE-A, an authentic callback reusing the partner's event id with a contradicting state** (tracker, and FakePartner end to end).
  - `PAID` with event id `ev` is applied. `FAILED` with the same event id then returns `{applied:false, report:null, replayed:true}`.
  - Afterwards `arrived` is still **true**, there are 0 reports, there is no CONFLICT and no quarantine.
  - **FAIL**, see m1.
- **PROBE-B, CPN stub with a verifier that returns a Promise resolving to `false`.** Result: BAD_SIGNATURE, and `arrived` is false. **PASS** (round-2 m1 is fixed: `=== true`, cpn-stub.ts:224).
- **PROBE-C, the refund paths:**
  - PAID then REFUND_FAILED is applied as REFUND_FAILED with a report, and ARRIVED is withdrawn. Fail-closed enough.
  - FAILED, RETURNED, then RETURNED with a new event id is a replay.
  - RETURNED for a PENDING payout gives OUT_OF_ORDER and no report. See m5.
- **PROBE-D, funding on `FAKENET` with the core pinned to ARC chain 5042002.** Result: OK, and a payout is created. The core does not bind `funding.network` to the pinned settlement network (m2).
  - The same hash on another network counts as a different funding. That is correct, because it is a different transaction.
- **PROBE-E, a hand-built WalletRecipient.** `const forged: WalletRecipient = { kind:'WALLET', address, __screened: true }` **type-checks** under `--strict`. The runtime `isScreenedWallet(forged)` is false (m4).
- **PROBE-F, `TRAVEL_RULE_NOT_APPLICABLE_TESTNET` with an amount of 10^15 base units.** Result: OK. Nothing binds this "testnet only" hook to testnet (m3).
- **PROBE-G, a `localBlocklist` that returns `undefined`** (a cast). Result: OK, so it is treated as "not listed" (m3).
- **Planted mutants**, run against the copied suite with the repo's vitest (`--root` set to the sandbox). **All 14 were killed:**

  | Mutant | Tests failed |
  |---|---|
  | M1 no event-id dedupe | 3 |
  | M2 hash not lower-cased | 2 |
  | M3 truthy signature | 1 |
  | M4 unfrozen meta | 1 |
  | M5 UNKNOWN_EVENT returned as IGNORED | 1 |
  | M6 no quarantine check in `arrived` | 3 |
  | M7 funding consumed before register | 2 |
  | M8 demo flag on any chain | 2 |
  | M9 no reveal access record | 1 |
  | M10 purge `>` instead of `>=` | 1 |
  | M11 no RFI dedupe | 1 |
  | M12 error message echoes input | 4 |
  | M13 UNAVAILABLE screening accepted | 4 |
  | M14 currency half of the cross-border gate removed | 2 |

### Re-check of every cited archive fact
- **C-01, Arc testnet chain ID `5042002`** (core.ts:207, port.ts:129): **PASS**. Sources: `docs/sources/arc/arc_references_rpc-endpoints.md:64` ("| **Chain ID (Testnet)** | `5042002` |") and constants.md:13.
- **"Check the local blocklist before every send"** (recipients:12-14, :312, :368): **PASS**. Sources: CLAUDE.md "Blocklist" and `docs/sources/arc/integrate_exchanges_custody.md:253` ("Check the blocklist before attempting to sign and broadcast").
- **CPN envelope `{subscriptionId, notificationId, notificationType, notification, timestamp, version}`:** **PASS**. Source: `references_webhooks_webhook-events.md:35-48`.
- **Every CPN event name the stub uses:** **PASS**.
  - Event names used: payment ×6; RFI `informationRequired`, `inReview`, `approved`, `rejected`; transaction `broadcasted`, `completed`, `failed`; refund `created`, `failed`, `completed`.
  - Each name appears exactly as written in webhook-events.md:76-115. A grep of the archive shows no other `cpn.*.*` names. No event name is invented.
- **RFI semantics:** **PASS**. `informationRequired` ("needed before the payment can proceed") and `rejected` ("the payment is failed") are treated as needing action. `inReview` and `approved` are treated as no-ops.
- **Payment states CREATED, CRYPTO_FUNDS_PENDING, FIAT_PAYMENT_INITIATED, COMPLETED and FAILED:** **PASS**. Source: `concepts_payments_component-states-and-workflows.md:44-48`.
- **COMPLETED: "the receiver may or may not have received the transfer":** **PASS**. Sources: component-states:47 and webhook-events.md:78.
- **The payment object carries `id` and `status`:** **PASS**. Source: `quickstarts_integrate-with-cpn-ofi.md` §2.3, with `id` at :603 and `status` at :615.
- **Refunds happen when the BFI cannot complete the fiat transfer, and refund COMPLETED means confirmed on-chain:** **PASS**. Source: component-states "Refunds" (:94) and the refund states table (:108-110).
- **"Validate the signature with Circle-provided public keys":** **PASS**. Source: `concepts_api_api-integration.md:54-55`.
- **"The archive does not name the header, the algorithm or the signed bytes":** **PASS**. Only an unarchived link (`/api-reference/verify-webhook-signatures`) exists, at webhook-events.md:58.
- **The source IP allow-list is "an additional layer of defense":** **PASS**. Source: webhook-events.md:52-62.
- **Neither the Refund object's nor the RFI object's payment field is in the archive:** **PASS**.
  - The only `paymentId` in the archive is on the Transaction object (quickstart:694 and :896).
  - Both readers are injected extractors and fail closed (MALFORMED) without one.
  - The `paymentId` and `x-test-signature` names in the tests are labelled test inventions (contract test header).
- **The CPN payment is created first and funded afterwards** (port.ts:30-33): **PASS** as a recorded deviation. Sources: quickstart §2.3 and `/payments/:paymentId/transactions` at :676.
- **No DFNS fact is cited or loaded by this unit.** `src/dfns/json.js` is used only as a JSON helper.
- **Citations resolve (MC-44):** **PASS**.
  - Q-R2 (record-keeping period), Q-R12(d) (retention vs FICA), Q-R3 and Q-R9 (Directive 9, unhosted wallets) and Q-N12 (payout partner and callback authentication) exist in OPEN_QUESTIONS.md with the claimed subjects.
  - docs/GATES.md D5 and G-P 1 carry the cross-border legal opinion gate.

### Spec items (the operator goal, the operator correction and the unit brief)
- **One contract for both adapters:** **PASS**. The PayoutPartner port has a CPN-shaped STUB that cites only the archive and a clearly labelled FAKE, run through one contract (`describe.each([stub, fake])`). The adapters are structurally different: Ed25519 with a CPN envelope, versus HMAC-SHA256 with a flat body.
- **Authenticity is checked first:** **PASS**.
  - A forged, missing, tampered, throwing or non-boolean verifier gives BAD_SIGNATURE.
  - A forgery does not poison dedupe.
  - verifyCallback is pure.
- **Dedupe on the partner event id (per payout) and on `["payout", id, state]`, tuple-encoded:** **PASS**, with one gap (m1).
- **Out-of-order handling:** **PASS**.
  - An early RETURNED or REFUND_FAILED is refused and not remembered, and its redelivery is applied.
  - A late PENDING is stale.
  - A contradiction after RETURNED is a CONFLICT.
- **Failed and returned payouts are reported:** **PASS**.

  | Event | Report |
  |---|---|
  | FAILED | REFUND_DUE |
  | RETURNED after FAILED | REFUND_RECEIVED. The comment ties release to the matching INBOUND log (P2R and P6), never the partner's word. |
  | RETURNED after PAID | CLAIM, and ARRIVED is withdrawn |
  | REFUND_FAILED | REFUND_FAILED |
  | RFI needing action | RFI_OPEN (deduplicated on event id) |
  | Contradiction | CONFLICT plus quarantine |

- **Unknown authentic CPN event types return UNKNOWN_EVENT, distinct from IGNORED:** **PASS**. The port documents that the caller quarantines and pages on UNKNOWN_EVENT and MALFORMED. Round-2 B2 is fixed.
- **ARRIVED for FIAT_BANK is licensed only by an applied, authentic PAID on a payout that is not quarantined** (tracker.ts:73-75): **PASS**, except for m1.
- **Cross-border is OFF by default:** **PASS**.
  - It is decided on the recipient's stored country OR currency, never on a caller claim.
  - It opens only with `legalOpinionRecorded`, or with `testnetDemo` when the settlement pin's chain ID is 5042002.
  - Tests are at contract :192-221.
- **Funding:** **PASS**.
  - The hash is lower-cased and validated (FUNDING_INVALID) before both the consumption check and the canonical comparison.
  - One `(network, txHash)` licenses one payout.
  - `isFunded` must return exactly `true`, and it sees the key, recipient, currency and amount.
  - The funding is consumed only after register succeeds.
  - Round-2 B1 and m13 are fixed. Tests are at contract :223-303.
- **BankRecipient:** **PASS**.
  - It is encrypted through the injected KeyManagement, with the ref as AAD.
  - The ref is a random 128-bit `rcp-` ref.
  - Errors have fixed messages and a JSON form with only the code.
  - `Secret` and the store are redacted in JSON, String and inspect.
  - A console, stdout and stderr capture over a whole lifecycle shows no PII.
  - meta is frozen (round-2 m6 is fixed).
  - Every reveal records a purpose from a closed list and leaves an access record with no PII (round-2 m11 is fixed).
- **Retention:** **PASS** for the mechanics.
  - The period is an explicit constructor input. The five-year placeholder is labelled UNVERIFIED and cites Q-R2 and Q-R12(d).
  - Rows are deleted on access and by `purgeExpired`, and the purge owner is named in the header (round-2 m8 is recorded).
  - Recomputed: `DEFAULT_RETENTION_MS` = 5 × 365 × 86 400 000 = 157 680 000 000 ms, which matches the test.
  - Boundaries: a row is still served at expiry minus 1 and deleted at expiry, and purge uses `>=`. Mutant M10 is killed.
- **WalletRecipient:** **PASS**, with caveats m3 and m4.
  - The address is normalised.
  - The local blocklist is checked first, and a throwing blocklist gives SCREENING_UNAVAILABLE.
  - The screening port runs next and is tested with two structurally different fakes.
  - The travel-rule hook is required and receives the transfer context (round-2 m9 is fixed).
  - Every answer other than a clear one fails closed.
  - Recipients are tracked in a WeakSet registry.
- **PII never reaches the partner request (ref only), reports or renders:** **PASS**. Free text is dropped by `safeReason`. Tests are at contract :473-499.

### Numbers and units
- This unit does no conversion. Amounts pass through as `CbsMinor`.
- Checked by hand: 0n and -1n give AMOUNT_INVALID, and 1n is accepted.
- There is no upper bound in the core. The over-amount guard is the `isFunded` binding, which is tested (99 999 999 999 gives NOT_FUNDED).
- The amount is typed `CbsMinor` rather than `FiatMinor<C>`. This is recorded as a decision in port.ts:41-45 and carried forward (m9).

### Judgment lenses
- **JL-1 Fail-closed:** minor findings only (m1, m2, m3, m6).
- **JL-2 Human-owned decisions:** [inspection-only] PASS. Retention, cross-border and the demo flag are explicit inputs, and the placeholders are labelled UNVERIFIED with their Q-R.
- **JL-3 03:00 operability:** [inspection-only] minor (m5, m9). PENDING has no poll and no maximum age, which is a recorded deferral.
- **JL-4 Auditability:** [inspection-only] PASS. Reports carry the payout id and a machine reason, and reveals leave an access record.
- **JL-5 Fewest new parts:** [inspection-only] minor, recorded. There is a second payout port and a second `PartnerKind`, and the mapping is written down in port.ts:34-40.
- **JL-6 Privacy by default:** PASS.

## DEFECTS
There are no blocking defects. None of the findings below lets money be lost, misposted, double-counted or moved without its control by an outside party. No inbound signal is trusted without an authenticity check and dedupe. No DFNS, Arc or CPN fact is invented. No secret and no real API call is present. Every mandatory lint passes on the unit's own files.

- **m1** · src/journey/payout/partner/tracker.ts:88 and :97 (`const eventKey = JSON.stringify([cb.payoutId, cb.eventId]);` … `if (this.#seenEvents.has(eventKey) || this.#seen.has(key)) return ok({ … applied: false, report: null }, true);`) · CLAUDE.md "Fail closed" (failed invariant leads to QUARANTINE), and the tracker's own header ("PAID and FAILED for one payout: the payout is quarantined, ARRIVED is withdrawn, and Ops is told") · minor. **Fix before freeze.**
  - An authentic callback that reuses an event id the partner already used for that payout is dropped as a replay, whatever state it now claims ("a redelivery is a no-op whatever the body says").
  - PROBE-A: PAID(ev) and then FAILED(ev) leaves `arrived === true`, raises no REFUND_DUE, no CONFLICT and no quarantine.
  - This needs the partner to break its own notification-id contract, and a later `cpn.refund.completed` would still produce a CLAIM. That is why it is minor and not blocking. Round-1 m5 was the same class of finding and was rated the same way.
  - Fix:
    - Remember the state, or a digest of the decoded callback, for each `eventKey`.
    - Treat a redelivery as a replay only when it matches. A mismatch is a CONFLICT and quarantines the payout.
    - Add a contract test: same event id with PAID then FAILED gives a CONFLICT, and ARRIVED is withdrawn.
- **m2** · src/journey/payout/partner/core.ts:253-263 · CLAUDE.md "Binding", JL-1 · minor.
  - `funding.network` is never compared with `settlementNetwork.network`. The pin is used only for the demo gate, and it is optional.
  - PROBE-D: a FAKENET funding is accepted by a core pinned to ARC 5042002 whenever `isFunded` says yes.
  - The production composition root rejects FAKENET (ids.ts comment), and `isFunded` is our indexer, so this is defence in depth.
  - Fix: when a pin is given, refuse a funding whose network differs from it (FUNDING_INVALID), and consider making the pin required.
- **m3** · src/journey/recipients/index.ts:354 (`export const TRAVEL_RULE_NOT_APPLICABLE_TESTNET: TravelRuleHook = { check: () => Promise.resolve('NOT_REQUIRED') };`) and :384 (`if (deps.localBlocklist(a)) return …BLOCKLISTED`) · JL-1 · minor.
  - The "testnet only" travel-rule bypass is a plain exported value, not bound to chain ID 5042002. PROBE-F: a send of 10^15 base units passes with it. Compare the cross-border demo gate, which is pinned to the chain ID.
  - The blocklist result is tested for truthiness. A non-boolean "not found" value such as `undefined` (PROBE-G, a cast) counts as clear, while `isFunded` and `verifySignature` use `=== true`.
  - Fix:
    - Make the testnet hook a factory that takes the `SettlementNetworkPin` and throws or HOLDs off 5042002.
    - Treat the blocklist answer as clear only when it is exactly `false`.
- **m4** · src/journey/recipients/index.ts:306-318 (`readonly __screened: true;` and the doc "a hand-built `{kind:'WALLET', address}` neither type-checks nor passes the runtime check") · minor.
  - The brand is an ordinary property, so `{kind:'WALLET', address, __screened:true}` type-checks (PROBE-E). Only the runtime `isScreenedWallet` registry catches it, and no consumer calls it yet.
  - Fix: brand with a non-exported `unique symbol` key, and have the D1 send path require `isScreenedWallet` when it is wired.
- **m5** · src/journey/payout/partner/tracker.ts:113 and port.ts:82-87 · JL-3, MC-12(a) · minor.
  - A RETURNED for a payout still PENDING is OUT_OF_ORDER and is not remembered. That is correct while the partner redelivers the missing FAILED.
  - If that FAILED is lost for good, every refund redelivery is refused, with no report. The port tells callers to page only on UNKNOWN_EVENT and MALFORMED, not on a repeated OUT_OF_ORDER (PROBE-C).
  - Returned USDC would still surface as an unmatched INBOUND (P2R needs an open F-17 case), so nothing is posted wrongly.
  - Fix: document that the caller pages on OUT_OF_ORDER after N redeliveries or an age, or let the PENDING max-age deferral (port.ts:19-24) cover it explicitly.
- **m6** · src/journey/payout/partner/cpn-stub.ts:186-193 (`'cpn.transaction.failed'` in `KNOWN_IGNORED`) · JL-1 · minor.
  - Per webhook-events.md:104, `cpn.transaction.failed` means "The blockchain failed to confirm the transaction", which is the OFI's funding transaction.
  - Because this core requires our own indexer to confirm the funding before create, a CPN "transaction failed" for that payment contradicts our chain fact. CLAUDE.md treats that kind of disagreement as fail-closed, yet it is classified as a benign IGNORED.
  - Fix: map it to UNKNOWN_EVENT or a dedicated reconciliation-alert code, rather than IGNORED.
- **m7** · src/journey/payout/partner/core.ts:257 (`rejected('FUNDING_INVALID', 'funding transaction hash is malformed')`) · MC-08 test gap · minor.
  - This is the one non-equivalent Stryker survivor. `test/unit/jpartner-details.test.ts` "createPayout" does not assert the FUNDING_INVALID detail.
  - Fix: add it to the fixed-details test.
- **m8** · src/journey/payout/partner/tracker.ts:101 (`if (cb.state === current || to === 0n)`) · simplification · minor.
  - `cb.state === current` cannot be true at that point (equivalent Stryker survivor; reasoning above). Remove it so the decision core stays minimal and every clause is decidable by a test.
- **m9** · src/journey/payout/partner/port.ts:16-48 · MC-12(a), MC-18, MC-44 · minor, recorded deferrals carried forward.
  - The header says it is the only record of these items: no `getPayout` poll or PENDING maximum age, in-memory registry, dedupe and funding-consumption state, funding before create (Q-N12), a second port and `PartnerKind`, and `CbsMinor` instead of `FiatMinor<C>`.
  - None of these is yet in a design delta or the LEDGER. Each must be closed, or carried into a design delta, before JPAYOUT wires this port and before any non-demo FIAT_BANK use.

Context, not JPARTNER defects:
- **C1.** The repo-wide `tsc --noEmit` (47 errors) and the MC-01 lint (1 finding, `src/journey/quote/ports.ts:198`) are red because of the concurrent JQUOTE edits. Both must be green before JPARTNER is frozen. JPARTNER's only link to JQUOTE is the type-only `SettlementNetworkPin` import.
- **C2.** `test/unit/money-path.test.ts` "Stryker mutate (MC-08)" is red because the four `src/ops/*` paths are missing from `stryker.config.json`. The OPS unit owns this.

Round-2 status (from NOVA-JPARTNER-lensR-2.md):
- **Blocking:** B1 (funding hash spelling) is fixed. B2 (unknown event shown as IGNORED) is fixed.
- **Fixed minors:** m1 (truthy signature), m6 (mutable meta), m7 (bare chain-ID option, now `SettlementNetworkPin`), m9 (optional travel rule, no context), m11 (reveal purpose and access record), m12 (`#final`), m13 (consume ordering) and m14 (key delimiter).
- **Recorded minors:** m5 (RFI dropped, now RFI_OPEN) and m8 (purge owner named).
- **Carried as this report's m9:** m2, m3, m4, m10 and m15 (recorded deferrals).

## VERDICT
NEGATIVE (9 defects: 0 blocking, 9 minor)
