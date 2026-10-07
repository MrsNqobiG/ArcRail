VERIFICATION · lens: R · target: JPARTNER (src/journey/payout/partner/**, src/journey/recipients/**, and their tests) · commit: 2777414 (HEAD) + uncommitted working tree (all JPARTNER files are untracked)

Verifier: independent verifier subagent, 2026-10-07. Inputs: the code, its tests, docs/NOVA_ARC_DESIGN.md, CLAUDE.md, docs/RUBRIC.md, docs/MONEY_PATH.md, docs/OPEN_QUESTIONS.md, docs/KHUMO_QUESTIONS.md, and the archived CPN docs under docs/sources/circle/cpn/. No network calls were made. No DFNS, Circle or VALR API was called. No .env file was read. Scratch work was done in /tmp/jpartner-verify-lZtWvR and /tmp/jpartner-leaks-XXXXXX, using real-file copies (no symlinks).

## CHECKS

### Reconstruction runs
- tsc --noEmit (repo): FAIL. There is 1 error, and it is outside this unit: `test/unit/jquote-ports.test.ts(7,41): Module '"../../src/journey/quote/ports.js"' has no exported member 'convertibleStep'` (JQUOTE, edited concurrently). Filtered for JPARTNER paths: 0 errors. See m11.
- JPARTNER tests (`test/contract/jpartner-partner.contract.test.ts`, `test/unit/jpartner-{adapters,details,recipients}.test.ts`): PASS, 4 files and 140/140 tests.
- MC-01 float lint (`node tools/lint-money-floats.mjs`): PASS. It reports "46 money-path files, 0 finding(s)", and the JPARTNER paths are among the 46 (docs/MONEY_PATH.md:61-66).
- Semgrep MC-01 (`tools/semgrep/mc01-money-float.yml`) on the 6 source files: PASS, 0 findings from 13 rules.
- Semgrep SAST (pinned js+ts rulesets) on the 6 source files and 5 test files: PASS, 0 findings from 203 rules.
- gitleaks on a real-file copy of the unit's source and tests: PASS, "no leaks found". Every key and secret in the tests is generated at runtime (`randomBytes`, `generateKeyPairSync('ed25519')`, `AesKms` key from `randomBytes(32)`).
- Egress grep (`https?://`, `fetch(`, circle/valr/dfns hosts) over src/journey/payout/partner and src/journey/recipients: PASS, no matches. Neither the stub nor the fake makes a network call.
- test/unit/money-path.test.ts (mandatory MONEY_PATH tooling check): FAIL, 3 failures, all caused by this unit. See B2 and B3.
  - "Stryker mutate (MC-08)": stryker.config.json `mutate` has 40 entries, while MONEY_PATH lists 46. The 6 JPARTNER paths are missing.
  - "import-graph closure ... no SDK or unlisted package": `src/journey/recipients/index.ts imports node:util, which is not on the money-path package allow-list`.
  - "allow-listed packages pass": the same node:util finding.
- Stryker on the unit's files only (`--mutate 'src/journey/payout/partner/*.ts,src/journey/recipients/index.ts' --tempDirName .stryker-tmp-verify-JPARTNER --reporters clear-text`): PASS. Score 97.92: 517 killed, 11 survived, 0 no-coverage, 0 timeout. By file: core 98.57, cpn-stub 96.30, fake 95.65, port 100, tracker 99.10, recipients 98.46. The temp dir was cleaned up.
  - I re-traced each of the 11 survivors, and all are equivalent mutants:
    - `catch {}` in cpn-stub.ts:296, recipients:328 and recipients:337: the variable stays undefined, which still fails closed through the next check.
    - `false ||` on `given === null` in fake.ts:385: `HEX64.test(null)` tests the string "null", which fails.
    - SECRET_HEX anchors in fake.ts:355: the input is always the hex encoding of a Buffer.
    - `true &&` in safeReason, tracker.ts:456: the regex accepts "null", but the function still returns null.
    - asObject label strings: these change only an error label.
    - `refundPaymentId?.` to `.`: the throw is caught and the result is still MALFORMED.
- MC-07 branch coverage: [inspection-only]. The v8 coverage reporter listed none of the JPARTNER files, even with an explicit `--coverage.include`, so 100% branch coverage could not be reconstructed. Stryker shows 0 NoCoverage mutants. See m12.

### Behavioural probes (my own mutants and scenarios, run on real-file copies compiled in /tmp/jpartner-verify-lZtWvR)
- PROBE1, one funding transaction reused across three keys: all three calls return OK, with three distinct payout ids, and the third payout's amount is 99,999,999,999 minor units. FAIL. See B1.
- PROBE2, the `localBlocklist` callback throws: `screenWalletRecipient` rejects with the raw exception ("stale") and never returns OK. It fails closed, but the result is untyped. See m8.
- PROBE3, FAILED then RETURNED, then FAILED (new event id), then PAID (new event id): the third call is treated as a replay. The PAID returns `applied:false, report:null`, so no CONFLICT is raised. See m5.
- Planted mutants reasoned against the suite: dropping `cb.state === current` in tracker.ts:498, dropping the quarantine check in `arrived` (tracker.ts:478), dropping `isFunded` (core.ts:178) and dropping `!g.testnetDemo` (core.ts:175). Each is killed by a named contract test, and Stryker confirms the matching operators are killed. PASS.

### CPN fact re-check against the archive (MC-21/MC-43 style; every claim in the cpn-stub.ts header)
- Envelope `{subscriptionId, notificationId, notificationType, notification, timestamp, version}`: PASS. Source: references_webhooks_webhook-events.md:36-48.
- Events `cpn.payment.cryptoFundsPending|fiatPaymentInitiated|completed|failed|delayed|inManualReview`: PASS. Source: webhook-events.md:76-81.
- Refund events `cpn.refund.created|failed|completed`: PASS. Source: webhook-events.md:113-115.
- Payment states CREATED, CRYPTO_FUNDS_PENDING, FIAT_PAYMENT_INITIATED, COMPLETED, FAILED: PASS. Source: concepts_payments_component-states-and-workflows.md:44-48.
- "COMPLETED: receiver may or may not have received": PASS. Sources: component-states:47 and webhook-events:78.
- Payment object has `id` and `status`: PASS. Source: quickstarts_integrate-with-cpn-ofi.md:552 ("2.3. Create a payment"), with id at :603 and status at :615.
- Refunds happen "when the BFI can't complete the transfer of fiat", and refund COMPLETED means the on-chain return is confirmed: PASS. Source: component-states:94 and :110.
- "Validate the signature with Circle-provided public keys": PASS. Source: concepts_api_api-integration.md:54-55.
- "The archive does not name the header, algorithm or signed bytes": PASS. A grep of the archive finds no header or algorithm.
- The IP allow-list is an additional layer: PASS. Source: webhook-events "Source IP addresses".
- "The Refund object's payment field is not in the archive": PASS. The only `paymentId` in the archive is on the Transaction object (quickstart:694 and :896). The stub injects the extractor and does not invent the field.
- Test-only inventions are labelled: `x-test-signature` and the refund `paymentId` (contract test lines 6 and 53), and the fake's wire format (fake.ts:338-343). PASS.
- No DFNS or Arc constant is cited or loaded by this unit. The only Arc-related rule it relies on is the "local USDC blocklist copy, checked before every send" rule (CLAUDE.md, C-28/C-53). PASS.

### Spec items
- PayoutPartner port with a CPN-shaped STUB and a clearly labelled FAKE, both run through one contract (`describe.each([stub, fake])`, with structurally different Ed25519 and HMAC adapters): PASS. A deviation from the design is noted in m4.
- Callback authenticity before anything else, with the forged/missing/tampered/throwing verifier all rejected as BAD_SIGNATURE: PASS. Covered by contract :234-247 and adapters :163.
- Callback dedupe on the partner event id and on `payout:<id>:<state>` (design §10.3 key shape, widened to RETURNED): PASS. Covered by contract :249-268.
- Out-of-order handling: an early RETURNED is refused and not remembered, and its redelivery is applied; a stale PENDING or PAID is a no-op: PASS. Covered by contract :270-291.
- Returned and failed payouts are reported: FAILED gives REFUND_DUE, RETURNED after FAILED gives REFUND_RECEIVED, and RETURNED after PAID gives CLAIM with ARRIVED withdrawn: PASS. Wording risk in m9.
- PAID/FAILED conflict: quarantine, one CONFLICT report, ARRIVED withdrawn, in either order: PASS. Covered by contract :314-326.
- ARRIVED is licensed only by an applied, authentic PAID (tracker.ts:477-479): PASS.
- Cross-border is refused by default and opened only by `legalOpinionRecorded` or the labelled testnet demo flag, with a test: PASS. Caveats in m6 and m7.
- BankRecipient: encrypted through the injected KeyManagement with the ref as AAD, ciphertext bound to the ref, opaque random 128-bit `rcp-` ref, fixed-message errors, and `Secret`/store redaction in JSON, toString and inspect: PASS. Covered by recipients tests :19-245 and the console/stdout capture at :157.
- PII never appears in partner outputs, reports or renders: PASS. Covered by contract :377-389.
- Retention: deletion at `expiresAt` on read and through `purgeExpired`, with explicit constructor input: PASS for the mechanics. The legal basis is m2.
- WalletRecipient: the local blocklist is checked first, then the screening port (two fakes), then the travel-rule hook, all failing closed: PASS. Structural caveat in m8.

### Judgment lenses
- JL-1 Fail-closed: FAIL because of B1, plus m5 and m10.
- JL-2 Human-owned decisions: [inspection-only] PASS with m2. The retention value is an explicit input, but its legal basis is asserted.
- JL-3 03:00 operability: [inspection-only] minor (m4). A payout whose callbacks never arrive has no poll or max-age at the port.
- JL-4 Auditability: [inspection-only] PASS. The reports carry the payout id and a machine reason only.
- JL-5 Fewest new parts: [inspection-only] PASS. The unit reuses dfns/json and nova-ports/ids.
- JL-6 Privacy by default: PASS. Only the opaque ref leaves the module, and partner reasons are restricted to machine tokens (`safeReason`).

## DEFECTS
- **B1** · src/journey/payout/partner/core.ts:130-131 (`isFunded: (funding: { network; txHash }) => boolean`) and :178 · JL-1 fail-closed, CLAUDE.md "Binding" and "Exactly once" · **blocking**.
  - The funding check is not bound to the payout. `isFunded` receives only `{network, txHash}`, with no amount, no payment and no idempotency key, and the core never records that a funding transaction was consumed.
  - PROBE1 shows the result: one confirmed Arc transfer licensed three payouts under keys k:1, k:2 and k:3, the last for 99,999,999,999 minor units.
  - The code claims a control ("the partner is never told to pay out before our own indexer confirmed the Arc transfer that funds it") that does not limit what the funding licenses. Money can be moved twice, or in any amount, against one funding fact.
  - Fix: consume each funding (network, txHash) exactly once (a second key reusing it is refused), and pass the amount and payment binding to the funding check. Add contract tests for funding reuse and for an over-amount payout.
- **B2** · src/journey/recipients/index.ts:19 (`import { inspect } from 'node:util';`) · mandatory MONEY_PATH import-closure check (test/unit/money-path.test.ts, MC-34 allow-list) · **blocking**.
  - The closure check fails twice. Fix: use `Symbol.for('nodejs.util.inspect.custom')` instead of the import, or record an approved allow-list change.
- **B3** · stryker.config.json `mutate` versus docs/MONEY_PATH.md:61-66 · MC-08 tooling check ("Stryker mutate (MC-08)" in test/unit/money-path.test.ts) · **blocking**.
  - The 6 JPARTNER paths are listed in MONEY_PATH but missing from `mutate`, so CI fails. The mutation score itself is 97.92 when run on these files.
- **m1** · src/journey/recipients/index.ts:11 and :291, src/journey/payout/partner/cpn-stub.ts:242 · MC-44 · minor.
  - These lines cite docs/KHUMO_QUESTIONS.md for retention, the unhosted-wallet policy and the CPN signature scheme, but that file has no such entries.
  - The real entries are docs/OPEN_QUESTIONS.md Q-R2 and Q-R12(d) (retention), Q-R3 and Q-R9 (unhosted wallets) and Q-N12 (callback authentication).
- **m2** · src/journey/recipients/index.ts:33-38 · MC-43, JL-2 · minor.
  - The comment says "five years, the usual record-keeping period under South Africa's FIC Act" with no primary-source quote. Q-R2 is OPEN and calls the figure "unverified".
  - Retention is also counted from record creation, not from the last transaction or the end of the relationship.
- **m3** · src/journey/payout/partner/core.ts:96-101 · CPN shape · minor.
  - The core requires funding to be confirmed before `createPayout`. The archived CPN quickstart creates the payment first (2.3) and funds it afterwards through a payment-specific transaction (quickstart:676).
  - On this point the stub is not CPN-shaped. Record it under Q-N12 or K-56.
- **m4** · src/journey/payout/partner/port.ts:56-71 versus NOVA_ARC_DESIGN §7.5 (`getPayout`) and F-17 ("getPayout FAILED / verified callback") · MC-12 · minor.
  - There is no poll path and no max age for PENDING, and the deviation from the design is not recorded.
- **m5** · src/journey/payout/partner/tracker.ts:496-502 · JL-1 · minor.
  - A contradictory final state after RETURNED (for example a PAID after FAILED and RETURNED, PROBE3) is silently treated as stale, with no CONFLICT report and no page.
- **m6** · src/journey/payout/partner/core.ts:103-105 and :175 · JL-1 · minor.
  - `testnetDemo` is honoured in the shared core, not bound to chain ID 5042002 or to the adapter kind. Any future real adapter that extends PartnerCore inherits it.
  - JQUOTE binds its own demo gate to the chain ID and the partner kind.
- **m7** · src/journey/payout/partner/core.ts:175 · spec "a foreign fiat receiver makes the payment cross-border" · minor.
  - Cross-border is decided by country only, so a home-country account in a foreign currency (for example a ZA account in USD) passes without a legal opinion.
  - The spec wording is ambiguous, so the decision should be recorded.
- **m8** · src/journey/recipients/index.ts:273-277 and :324 · minor.
  - `WalletRecipient` is an unbranded interface. "Only this module constructs it" is not enforced, so an unscreened `{kind:'WALLET', address}` type-checks.
  - Nothing ties screening to each send.
  - A throwing `localBlocklist` escapes as a raw exception rather than a typed REJECTED result (PROBE2).
- **m9** · src/journey/payout/partner/tracker.ts:427 ("close the payout (F-17 style release)") · design §9.2 P2R/P6 · minor.
  - The comment invites a release on the partner's word alone. P2R and P6 require the matching INBOUND log on the open F-17 case.
- **m10** · src/journey/payout/partner/cpn-stub.ts:315 · JL-1 · minor.
  - `cpn.refund.failed` is IGNORED, so a refund the partner failed to make raises no report for Ops.
- **m11** · test/unit/jquote-ports.test.ts:7 · tsc · minor for this unit, since the error is outside it.
  - The repo-wide `tsc --noEmit` is red because of a concurrent JQUOTE edit. It must be green before JPARTNER can be frozen.
- **m12** · MC-07 · minor.
  - Branch coverage of the JPARTNER files could not be reconstructed, because the v8 reporter omits them. Re-run at integration.
- **m13** · src/journey/payout/partner/core.ts:144-145, tracker.ts:460-464 · MC-18 · minor.
  - The registry and the dedupe state are held in memory only. After a restart the code fails closed with UNKNOWN_PAYOUT, but there is no persistent inbox yet. This needs to be stated as a deferred item.

## VERDICT
NEGATIVE (16 defects: 3 blocking, 13 minor)
