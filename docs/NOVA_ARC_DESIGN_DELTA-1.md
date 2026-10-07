# Design delta 1: the Raayl team's round-1 answers

**Status: PROPOSED (revision 2, after Lens R round 1).** A fresh verifier checks it before any code changes. Source: [KHUMO_ANSWERS.md](KHUMO_ANSWERS.md), round 1, 2026-10-07. The answers are **recorded, not verified** (KHUMO_ANSWERS line 3), so every Nova fact below is an assumption with an ID (DA-n, listed in "Assumptions and open questions") and is not a verified fact. [NOVA_ARC_DESIGN.md](NOVA_ARC_DESIGN.md) (D1, frozen at R4) is **not edited**. This delta changes the **journey layer** (added by the operator on 2026-10-06) and **lists, in "D1 amendments", every place where D1 must change when the delta is adopted**. Until those amendments are adopted into a new D1 revision by a human, D1 text governs wherever it conflicts with this delta.

Rules that don't change: the money invariants in CLAUDE.md, fail closed, exactly once, integer amounts (bigint, branded types), no LLM in the money path, testnet only (chain ID 5042002, DFNS `ArcTestnet`).

**Principle: extend, never parallel.** The delta adds no second case system, no second ledger and no second consent store. Cases and decisions reuse D1 `CaseRecord`, `OperatorDecision` and the case store (D1 :529-605). Everything the delta needs from Nova is a port with two structurally different in-memory fakes (see "Ports and fakes").

## D-1 Conversion is a pricing code, then a manual fill (answers 32-34)

**Assumptions (DA-1..DA-4, not verified):**
- DA-1: a "get code" function writes a pricing code to `otc-codes`; the code carries its own `expiresAt` (the answer says about 5 minutes). The package reads `expiresAt` from the code, as `ExpiryReader` does today. It never fixes a duration. 5 minutes appears only in tests.
- DA-2: the code is pricing only: an aggregated feed plus a spread.
- DA-3: a human fills the trade in the OTC desk UI and Nova's backend books general ledger entries (answer 33). There is no VALR integration, no sandbox, no automated execution.
- DA-4: Nova can emit an event when a human fills a code (answer 33 says no such event exists today). Building it is Nova's work, and the shape below is what we require from it.

**Change:**
- `FxPort` becomes two asynchronous steps:
  - `getPricingCode(key: IdempotencyKey, pair, side, amount) -> { codeId, rate (integer ratio num/den, bigint), expiresAt }`. The key is derived deterministically from the payment id and quote id (D1 §10.2 style). A retried call with the same key returns the same code and writes no second `otc-codes` row. The same key with different arguments is `KEY_CONFLICT`.
  - `awaitFill(codeId)` resolves to `FILLED | REJECTED | EXPIRED`, delivered as an inbound event (see authenticity below). It is never polled from a UI.
- `FILLED` carries all of: `codeId` (echo), `pair`, `fromAmount`, `toAmount`, `rate` (num/den), `remainder` (dust in the from currency), `bookedEntryRef`, `filledAt` (Nova's own fill time), and `reviewer`. All amounts are branded integer bigints.
- **Exact checks on every FILLED**, in the conversion module (one module, extending `checkFxLock`/`checkQuote` in `src/nova-ports/conversion.ts`; no second implementation):
  1. `codeId` is one this package requested and still open.
  2. `pair`, `fromAmount`, `toAmount` and `remainder` equal the code's quote by the exact integer identity the current `checkFxLock` enforces (the from side is kept exact, `toAmount` equals the floor of the converted amount, and the remainder is the stated dust).
  3. `rate` equals the code's rate by **cross-multiplication** (`fill.num * code.den == code.num * fill.den`), never by comparing amounts alone. A fill at a different rate is refused even when it is self-consistent.
  4. `bookedEntryRef` is **read back through `LedgerPort`**: the referenced journals must balance, the client side must be debited exactly `fromAmount`, the to side credited exactly `toAmount`, and any remainder must be posted to the dust destination (D-5). A mismatch is `FILL_MISPOSTED`.
  5. `filledAt` is the authoritative timestamp for the expiry decision: `filledAt < expiresAt` is live and `filledAt >= expiresAt` is expired (the current code treats "now < expiresAt" as live, so "at" means expired, `compose.ts:322`). The package arrival time never decides expiry, so delivery latency cannot refuse a fill that was valid when it was made.
- **Authenticity and dedupe of the FILLED event:**
  - Authenticity: Nova signs the event; the package verifies it through `FxPort.verifyFillEvent(rawBody, headers)`, the same shape as D1 `PayoutPartnerPort.verifyCallback` (D1 :684). The scheme is unknown, so it is open question DQ-1. Until it is answered no fill is accepted: fail closed, the journey holds and opens a case.
  - New `InboundSignal.source` value `FX_FILL`. Dedupe key `fill:<codeId>`. Payload digest: sha256 over the canonical projection `(codeId, pair, fromAmount, toAmount, rate, remainder, bookedEntryRef, filledAt)`, never over the raw envelope (D1 §10.3 rule).
  - **At most one fill per `codeId`.** A second event with the same key and a different digest is `SIGNAL_CONFLICT` and QUARANTINEs the payment (D1 :631). Two humans filling one code is plausible for a manual desk, so this is enforced, not assumed.
- **A refused fill that is already booked** (a fill after expiry, `FILL_MISPOSTED`, or any failed check) is never silently dropped, because Nova booked it before the event reached us (answer 33). It opens a requote case (D-2) of kind `UNMATCHED_FILL` that carries `bookedEntryRef`. The case closes by exactly one of two paths, both two-person:
  - **ADOPT:** the requote consumes the already-filled conversion (the new quote is built from the booked fill, and no new code is requested for that money), or
  - **REVERSE:** a compensating reversal posting (answer 18, answer 19) unwinds the booked conversion (template `P12_FILL_REVERSAL`, balanced, in D-2).
  A requote may not request a new code while an `UNMATCHED_FILL` case for the same payment is open. This prevents two booked conversions for one payment (a double count of the client's fiat). A late fill that arrives after a requote already completed is the same `UNMATCHED_FILL` case, and the invariant "one booked conversion per payment, or a reversal for each extra" is checked when the case closes.
- The journey quote's rate lock equals the code's `expiresAt`. The journey never executes on an expired code.
- No VALR adapter is built. `ConversionPort.execute` (D1 :676) is an automated execution that answer 33 says doesn't exist; see D1 amendments A-3.
- **Fill timeout.** If no fill event arrives within `fillTimeoutAfterExpiry` (configured; value is open question DQ-2, no default), the journey opens a case. The timeout is measured from `expiresAt`, in injected clock time.

**Tests:**
- expiry at exactly `expiresAt` (just before, at, and after), judged by `filledAt`, with delivery delayed past expiry for a fill made before it;
- a fill after expiry (booked, so `UNMATCHED_FILL` with `bookedEntryRef`);
- a fill amount that differs from the quote;
- **a fill at a different rate that is self-consistent** (mutant M1: 550/1 instead of 10000/18, must be refused);
- **an over-debited from side with the to side equal to the quote** (mutant M2, must be refused through the `LedgerPort` read-back);
- a misposted `bookedEntryRef` (unbalanced, wrong client, wrong amount);
- a duplicate fill event (same key, same digest: no second effect);
- **a second distinct fill for one `codeId`** (`SIGNAL_CONFLICT`, QUARANTINE);
- **a late fill after a requote** (no second booked conversion; ADOPT and REVERSE paths each tested);
- a fill with an invalid signature (refused, no state change);
- a fill that never arrives (timeout, then a case);
- a retried `getPricingCode` with the same key (one row) and a different argument (`KEY_CONFLICT`).

## D-2 Manual intervention for every process (answers 29, 37)

**Change:** manual intervention uses D1's existing case store, `CaseRecord` and `OperatorDecision` (D1 :529-605). **No new case queue is built, and there is no `src/ops/**` parallel system.** What this delta adds is the closed set of new kinds (see D1 amendments A-2), a thin operator-action layer under `src/journey/ops/**` that only builds `OperatorDecision` values and hands them to the same store, and the templates below.

**Cases.** Each of the following opens a `CaseRecord` with a reason code:
- every QUARANTINE and every PAUSE (D1 terms; there is no "HOLD" kind, and a nonce hold keeps D1's `NonceHold`);
- every requote, and every `UNMATCHED_FILL` (D-1);
- under- and overpayments (including the D-3 confirmed-versus-expected comparison);
- late pay-ins;
- a stuck or returned payout (existing D1 kinds `STUCK` and `PARTNER_RETURN`);
- an unresolved DFNS submission (the existing D1 kind `UNRESOLVED_SUBMIT`).

**Operator actions.** Each is a `DecisionKind` in the closed set. **Every money-moving action is two-person**, exactly as D1: the decision carries `approvers: readonly [string, string]` of two distinct authenticated staff identities (never a service account), and the store refuses `SAME_APPROVER` and `APPROVER_UNAUTHENTICATED` (D1 :555-558). There is no single-human exception. Actions:
- `REQUOTE`;
- `ACCEPT_WITH_CONSENT`;
- `REFUND`;
- `RETRY_AS_NEW_PAYMENT`;
- `WRITE_OFF`;
- `ADOPT_FILL` and `REVERSE_FILL` (D-1);
- existing D1 actions (`LIFT_QUARANTINE`, unpause, and the others) unchanged.

**Gate on CF-31.** D1 :1041 says that until CF-31 closes, no decision-entry path is built, and every case that needs a decision stays QUARANTINED or PAUSED (fail closed). That still governs this delta. The operator-action layer is built behind that gate: with CF-31 open, the actions exist only as types and as fake-driven tests, and no entry path to a real store is wired.

**Rules:**
- Each action records the actors, the time, a reason and the evidence references.
- **REFUND** is allowed only as D1 template P6 (or a template that obeys §8.4 check 3), through `applySignal`, so the store's `LEG_UNRESOLVED` guard (D1 :487-497) applies. It is **never** allowed on an `ARC_TRANSFER` leg that is UNRESOLVED (submit marker set, `externalRef` null) or not yet proven never sent by the release proofs of D-6. The refund-only-after-proof rule is the reason an unresolved DFNS submission is a case that REFUND may not act on until D-6 resolves it. A REFUND of money that was never sent on Arc (a fiat-side pay-in refund with no Arc leg) is a separate template, `P13_PAYIN_REFUND`, below.
- **RETRY_AS_NEW_PAYMENT** has one deterministic key: the new payment's client `Idempotency-Key` is derived as `retry:<originalPaymentId>` (D1 §10.2 style; D1 derives a payment id from the payer plus the client key, D1 :1025). **At most one retry per original.** A second click or a redelivered action returns the first retry's payment (idempotent) and creates nothing. It is allowed only when the original is terminal with P6 posted, or proven not sent by D-6 (D1 :796). The new payment links to the old one (answer 28).
- **Client consent** is enforced by a `ConsentPort` (see B5 below and "Ports and fakes"), not by an operator-typed string. `REQUOTE` and `ACCEPT_WITH_CONSENT` are refused unless `ConsentPort.consume` returns a record that matches (see D-3 for the binding).
- **WRITE_OFF** needs two different humans. This is a **design control**, not an answer-required one (no answer asks for it; D1 requires two people for every decision anyway). It posts to a **configured loss account**, which must be set explicitly. Raayl has no expense account type (answer 17, the same gap as gas, F-3), so with none set the action is refused (configure or fail closed, as in D-5). It is never defaulted to Suspense or Revenue.
- An action never changes amounts from client input; it only selects among server-side options (CLAUDE.md "Binding").
- **Posting templates (MC-04).** Each is balanced and integer, with a re-trace test that debits equal credits:
  - `P6` (existing): release a reservation / refund the payer after a proof;
  - `P12_FILL_REVERSAL`: debit the booked to-side account, credit the booked from-side account, reversing the fill's journal exactly, plus the dust leg if any;
  - `P13_PAYIN_REFUND`: debit the Client liability for the confirmed pay-in, credit Settlement (the money leaves the company);
  - `P14_REQUOTE_REPRICE`: no money moves; it moves the reservation from the old quote to the new one with a zero-sum posting, and fails if the new quote exceeds the reservation;
  - `P15_WRITE_OFF`: debit the configured loss account, credit Client liability or Suspense for the written-off amount;
  - `ACCEPT_WITH_CONSENT`: posts nothing by itself; it selects an existing server-side option (an under/overpayment accepted as the new amount) and then runs the same templates as a normal payment.
  Each name is a proposal until a human adopts it into D1 (A-4).
- Every action produces balanced, integer postings (or none) and an audit event. A case can't be closed while its money is unbalanced.

## D-3 Fiat pay-in through the internal ledger, with oversight (answer 35)

**Assumptions (DA-5, DA-6):** DA-5: Nova's internal ledger can emit an event when a human-reviewed entry is booked for a fiat pay-in. DA-6: client consent records exist in Nova (answer 35: the client agrees to settlement instructions); where they live is open question DQ-4.

**Change:**
- A fiat pay-in is confirmed only by a **human-reviewed internal-ledger entry**, delivered through `PayInPort` as an inbound event with `bookedEntryRef`, `expectedPayInId`, `confirmedAmount`, `bookedBy`, `reviewer` and `confirmedAt`. **`reviewer` must differ from `bookedBy`** (the same person may not book and review).
- **Authenticity and dedupe:**
  - Authenticity: `PayInPort.verifyPayInEvent(rawBody, headers)`, same shape as the FILLED event. The scheme is open question DQ-1 (shared with D-1). Until answered, no pay-in is accepted (fail closed).
  - New `InboundSignal.source` value `PAYIN_CONFIRMATION`. Dedupe key `payin:<expectedPayInId>`. Payload digest over `(expectedPayInId, bookedEntryRef, confirmedAmount, bookedBy, reviewer, confirmedAt)`.
  - **At most one pay-in confirmation per expected pay-in.** A second event with the same key and a different digest is `SIGNAL_CONFLICT`, QUARANTINE.
- The package compares `confirmedAmount` with the expected pay-in **before** any under/overpayment case of D-2 is opened, and reads `bookedEntryRef` back through `LedgerPort` (balanced, right client, right amount). Equal means the journey continues. A difference opens the D-2 case and nothing moves onward.
- The client must have agreed to the settlement instructions before the journey moves money onward. The agreement is a consent record resolved by `ConsentPort` (not an operator string). **A consent is bound to** `(clientUid, paymentId, caseId or null, digest of the exact option consented to)`, where the digest covers the new code or quote, the amount, and the settlement instructions. `ConsentPort.consume(consentRef, binding)` is refused unless the record exists, belongs to the payment's client, is unused, and its bound digest equals the digest of the option being applied. A consent is **single-use**: consuming it twice is refused. The same rule serves `settlementConsentRef`, `REQUOTE` and `ACCEPT_WITH_CONSENT`.
- With no valid consent, the journey holds (a QUARANTINE of the item, D1 term) and opens a case. The pay-in event also changes the D1 FIAT row; see D1 amendments A-5.

**Tests:** a pay-in with an invalid signature; a duplicate pay-in event; a second distinct pay-in confirmation for one expected pay-in (`SIGNAL_CONFLICT`); `reviewer == bookedBy` (refused); confirmed amount differs from expected (case, nothing moves); a mismatched `bookedEntryRef`; consent missing, belonging to another client, already used, or bound to a different amount or option (each refused); a consent replayed across two cases.

## D-4 Client transaction history and documents (answers 28, 30)

**Assumption (DA-7):** each client has a UID, and Nova has a transaction history that accepts entries with supporting-document references (answer 30). Where it lives is open question DQ-5.

**Change:**
- Every journey leg, failure, retry (each one a new payment, linked to the original) and operator action is written to the client's **transaction history** under the client UID, through a `HistoryPort`.
- Each history write carries an **idempotency key** derived from the business event (`hist:<paymentId>:<eventId>`), so a redelivery writes nothing twice. The key conflicts with a different body: `KEY_CONFLICT`.
- **Relation to the money transaction.** The history write goes through the transactional **outbox** (CLAUDE.md "Exactly once"): the outbox item is enqueued in the same commit as the state transition, and the drainer calls `HistoryPort.append`. A failed history write is retried by the outbox and **never blocks or rolls back the money** (the ledger is the system of record; history is the audit view). A history write that stays failing past a configured age opens a case and is shown in reconciliation, so the gap is never silent.
- Supporting documents are attached **by reference ID only**. The package stores no documents, and nothing goes on-chain.
- History is append-only and records corrections as new entries. This matches answer 18: reversal postings, never edit or delete.

**Tests:** idempotent append; a failing history write leaves the money transition committed and the outbox item pending; the aged-failure case; two fakes agree on the contract.

## D-5 Ledger account types (answer 17)

**Change:** GL roles map by **configuration** onto Raayl's four account types. The mapping is a **configured default awaiting confirmation**, not a fact:

| GL role | Raayl account type | Basis |
|---|---|---|
| customer liability | Client | answer 17 |
| in-flight deposits, unidentified | Suspense | answer 19 (a suspense account holds deposits in flight) |
| dust | **unset** | answer 19 is cut off and answer 20 is "Unsure"; open as F-4. **Must be set explicitly** |
| company USDC | Settlement | assumption, DA-8 |
| per-wallet `arc.<w>` | Settlement (default) | answer 21 is "Unsure"; open as F-5; the per-wallet sub-account stays an assumption |
| partner-held | Settlement (default) | no answer behind it; assumption DA-9 |
| fee income | Revenue | answer 17 |

- **Gas expense has no account type yet** (F-3). Gas postings go to a **configured account that must be set explicitly**. The **dust** destination is likewise a configured account that must be set explicitly. The **write-off loss** account (D-2) is the same. With any of these unset, startup fails closed. None is ever silently defaulted to Suspense or Revenue.
- Config validation (D1 §9.1 GL-role validation) changes to match; see D1 amendments A-7.

## D-6 Retry safety (answers 27, 28)

**No change to D1; the existing rule is restated by reference, not rewritten.**
- The team's current practice on an unknown outcome is to retry (answer 27). The package keeps D1's rule: an unknown DFNS outcome (a timeout, a 5xx, a hash-less `Failed`) is **never** retried blindly (DFNS: "Never submit a second Transfer Asset request to 'retry' a transfer that has not reached a terminal status", archived `guides_developers_create-transfers.md`, MANIFEST row 229).
- **The proofs that release a retry are exactly D1 §8.4 check 3** (D1 :796-807), by reference: proof (a1) the approvers' denial, (a2) an abort DFNS accepted (archived `api-reference_wallets_abort-transfer.md`, MANIFEST row 205: aborts a transfer in `Executing` status that has not yet been signed), (b) the reserved nonce consumed by another transaction with no matching unlinked log, and (c) reserved-nonce resolution; or a status-0 receipt on both sources (F-3c). This delta adds no proof and removes none.
- **An `externalId` resolution only finds the entity; it never proves its absence.** Finding is by D1's three ways (a re-POST of the marker's exact bytes, a DFNS webhook, or a listing). Not finding the entity by a listing proves nothing (D1 :803, F-6, Q-N21). The archived List Transfers page has only `limit` and `paginationToken` as query parameters (`api-reference_wallets_list-transfers.md`, MANIFEST row 215), so there is no `externalId` filter and none may be assumed.
- Only after a proof, and only after the payment is terminal with P6 posted (D1 :796), is `RETRY_AS_NEW_PAYMENT` allowed, as a new payment with the deterministic key and the one-retry rule of D-2, linked to the old one (answer 28).
- Unproven outcomes stay in the existing `UNRESOLVED_SUBMIT` case and are never released by a single human (D-2).

## Ports and fakes

Each port has two structurally different in-memory fakes passing one shared contract test suite.

| Port | Fake A | Fake B (structurally different) |
|---|---|---|
| `FxPort` (D-1) | event-queue model: fills are delivered through a delayed queue the test drives, may never arrive | ledger-backed model: the fill is derived by posting into a fake `LedgerPort` and then emitting the event, so `bookedEntryRef` read-back is real |
| `PayInPort` (D-3) | push model: tests inject signed events | pull-then-confirm model: a fake internal ledger holds reviewed entries, and the event is generated from it |
| `ConsentPort` (D-3) | map-backed store with a used-flag | append-only log where "used" is derived by replaying consumption entries (no mutable flag) |
| `HistoryPort` (D-4) | append-only list keyed by idempotency key | event-sourced store where reads fold the log, and a failure-injecting wrapper |
| case store (D-2) | D1's existing store fakes (unchanged) | same, plus the new kinds |

The contract suites also cover authenticity (valid, invalid and missing signature), dedupe (same event twice, same key with a different digest) and fail-closed behaviour when the scheme is unconfigured.

## D1 amendments (the complete list; none is applied until a human adopts them)

- **A-1** `InboundSignal.source` (D1 :476) gains `FX_FILL` and `PAYIN_CONFIRMATION`, each with an authenticity rule, a dedupe key and a canonical projection in §10.3.
- **A-2** `CaseRecord.kind` (D1 :599) gains `UNMATCHED_FILL`, `REQUOTE`, `PAYIN_MISMATCH` (under, over or late), `CONSENT_MISSING`, `FILL_TIMEOUT`, `HISTORY_WRITE_FAILED`. `DecisionKind` (D1 :537-546) gains `REQUOTE`, `ACCEPT_WITH_CONSENT`, `REFUND`, `RETRY_AS_NEW_PAYMENT`, `WRITE_OFF`, `ADOPT_FILL`, `REVERSE_FILL`. `FailureReason` gains `FILL_MISPOSTED`, `REQUOTE_REQUIRED`, `WRITTEN_OFF`. All stay two-person and gated on CF-31.
- **A-3** `ConversionPort.execute` (D1 :676) is an automated execution that Nova does not have (answer 33). It is replaced by `FxPort.getPricingCode` plus `awaitFill`; `fxPortFromConversion` (`src/journey/quote/ports.ts:85`) is rewritten so FxPort no longer ties to `ConversionPort`. D1 §7.8 ConversionPort fakes (which model automatic execute) are replaced by the two FxPort fakes above.
- **A-4** Posting templates P12 to P15 are added to D1 §9 with MC-04 re-trace tests.
- **A-5** The D1 FIAT row (§4.1 "RESERVE (fiat)" from balance) changes: a fiat pay-in is confirmed by the `PayInPort` event, not assumed from a balance.
- **A-6** New ports `PayInPort`, `ConsentPort` and `HistoryPort` are added to D1 §7.
- **A-7** D1 §9.1 GL-role config validation requires the gas, dust and write-off accounts to be set (D-5).

## Assumptions and open questions (go to docs/KHUMO_QUESTIONS.md when this delta is adopted)

| ID | Item | Status |
|---|---|---|
| DA-1..DA-4 | the `otc-codes` shape and `expiresAt`, pricing-only code, manual fill and booking, a fill event | assumption, answers 32-34, not verified |
| DA-5, DA-6 | a reviewed-entry event for pay-ins; consent records exist | assumption, answers 35, not verified |
| DA-7 | client UID and a transaction history that accepts document references | assumption, answers 28, 30 |
| DA-8, DA-9 | company USDC and partner-held map to Settlement | assumption, no answer |
| DQ-1 | signature scheme for the fill and pay-in events from Nova | OPEN (like Q-N12) |
| DQ-2 | `fillTimeoutAfterExpiry` value | OPEN |
| DQ-3 | whether the booked fill carries the rate and remainder, or the package must derive them | OPEN |
| DQ-4 | where consent records live and how to look one up and mark it used | OPEN |
| DQ-5 | history API shape, idempotency support | OPEN |
| F-3, F-4, F-5 | gas account, dust account, per-wallet accounts | OPEN (KHUMO_ANSWERS follow-ups) |

## Out of scope for this delta

These are noted only:
- WhatsApp notifications (no number yet). Email remains the Notifier's real channel; a WhatsApp adapter can be added behind the same port later.
- Invoice matching by invoice UID (answer 36), which belongs to the invoices milestone.
