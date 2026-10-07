# Design delta 1: the Raayl team's round-1 answers

**Status: PROPOSED.** A fresh verifier (Lens R) checks it before any code changes. Source: [KHUMO_ANSWERS.md](KHUMO_ANSWERS.md), round 1, 2026-10-07. [NOVA_ARC_DESIGN.md](NOVA_ARC_DESIGN.md) (D1, frozen at R4) stays frozen. This delta changes only the **journey layer**, which the operator added on 2026-10-06. It touches D1 only where a Nova port gains a field, and every such change is listed below.

Rules that don't change: the money invariants in CLAUDE.md, fail closed, exactly once, integer amounts, no LLM in the money path, testnet only.

## D-1 Conversion is a pricing code, then a manual fill (answers 32–34)

**Fact (answers):**
- A "get code" function writes a pricing code to `otc-codes`. It expires in 5 minutes and is pricing only: an aggregated feed plus a spread.
- A human fills the trade in the OTC desk UI, and the backend books the journal entries.
- There is no VALR integration, no VALR sandbox, and no automated execution.

**Change:**
- `FxPort` becomes two asynchronous steps:
  - `getPricingCode(pair, side, amount) → { codeId, rate (integer ratio), expiresAt }`;
  - `awaitFill(codeId) → FILLED{ bookedEntryRef, filledAmount } | REJECTED | EXPIRED`, delivered as a signed, deduplicated event through the port. It is never polled from a UI.
- The journey quote's rate lock equals the code's expiry (5 minutes). The journey never executes on an expired code.
- When a fill arrives after expiry, or at a different amount or rate than quoted, it creates a **requote case** (D-2) instead of being accepted.
- No VALR adapter is built. Both test fakes model the human fill as a delayed event that may never come.

**Tests:**
- expiry at exactly 5 minutes (just before, at, and after);
- a fill after expiry;
- a fill amount that differs from the quote;
- a duplicate fill event;
- a fill that never arrives (timeout → case).

## D-2 Manual intervention for every process (answers 29, 37)

**Change:** add an **operator case queue** (`src/ops/**`). Each of the following opens a case with a reason code:
- every HOLD or QUARANTINE;
- every requote;
- under- and overpayments;
- late pay-ins;
- a stuck or returned payout;
- an unresolved DFNS submission.

**Operator actions:**
- `REQUOTE`;
- `ACCEPT_WITH_CONSENT`;
- `REFUND`;
- `RETRY_AS_NEW_PAYMENT` (only when the original is proven not sent);
- `WRITE_OFF`.

**Rules:**
- Each action records the actor, the time, a reason and the evidence references.
- `REQUOTE` and `ACCEPT_WITH_CONSENT` need a **client consent record** (`consentRef`) captured outside the package and referenced by ID.
- `WRITE_OFF`, unpausing the rail and releasing a QUARANTINE need **two different humans**.
- An action never changes amounts from client input; it only selects among server-side options.
- Every action produces balanced, integer postings (or none) and an audit event.
- A case can't be closed while its money is unbalanced.

## D-3 Fiat pay-in through the internal ledger, with oversight (answer 35)

**Change:**
- A fiat pay-in is confirmed only by a **human-reviewed internal-ledger entry**, delivered through `PayInPort` as a signed, deduplicated event that carries `bookedEntryRef` and the reviewer.
- The client must have agreed to the **settlement instructions** (`settlementConsentRef`) before the journey moves money onward.
- With no consent, the journey holds and opens a case.

## D-4 Client transaction history and documents (answers 28, 30)

**Change:**
- Every journey leg, failure, retry (each one a new payment, linked to the original) and operator action is written to the client's **transaction history** under the client UID, through a `HistoryPort`.
- Supporting documents are attached **by reference ID only**. The package stores no documents, and nothing goes on-chain.
- History is append-only and records corrections as new entries. This matches answer 18: reversal postings, never edit or delete.

## D-5 Ledger account types (answer 17)

**Change:**
- GL roles map by configuration onto Raayl's four account types:

  | GL role | Raayl account type |
  |---|---|
  | customer liability | Client |
  | suspense, dust, unidentified, in-flight deposits | Suspense |
  | company USDC, per-wallet `arc.<w>`, partner-held | Settlement |
  | fee income | Revenue |

- **Gas expense has no account type yet.** Until F-3 is answered, gas postings go to a **configured account that must be set explicitly**. With none set, startup fails closed. It is never silently defaulted to Suspense or Revenue.
- The dust destination stays OPEN (F-4). Its configured account must also be set explicitly.

## D-6 Retry safety (answers 27, 28)

**No change; the existing rule is restated.**
- The team's current practice on an unknown outcome is to retry. The package keeps the frozen design's rule: an unknown DFNS outcome (a timeout, a 5xx, a hash-less `Failed`) is **never** retried blindly.
- First prove that the original request was not created or will never broadcast: a DFNS lookup by `externalId`, a resolved nonce, or an accepted abort. Only then is `RETRY_AS_NEW_PAYMENT` allowed, as a new payment linked to the old one (answer 28).
- Unproven outcomes become a case (D-2).

## Out of scope for this delta

These are noted only:
- WhatsApp notifications (no number yet). Email remains the Notifier's real channel; a WhatsApp adapter can be added behind the same port later.
- Invoice matching by invoice UID (answer 36), which belongs to the invoices milestone.
