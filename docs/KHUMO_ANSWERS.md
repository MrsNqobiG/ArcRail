# Answers from the Raayl team (round 1)

**Received:** 2026-10-07. The operator relayed them in chat as numbered answers to the 41-question "no repo access" list (numbering below). **Status: ANSWERS RECORDED, NOT VERIFIED.** They are written statements, not code evidence. Gate G0b is evidenced by these answers plus any snippets the team chooses to share. Only a named human may mark G0b passed.

Each row has three parts:
- **Answer (verbatim):** exactly as relayed, with typos left in.
- **Our reading:** the agent's interpretation, to be confirmed in the follow-up. Where a reading isn't certain it says **AMBIGUOUS**, and nothing is built on it.
- **K-ID:** the matching question in [KHUMO_QUESTIONS.md](KHUMO_QUESTIONS.md).

People named: **Khumo** and **Sherwin** both operate DFNS (answer 22). Sherwin is also the contact for the balance poller and webhook paths (7) and for destination screening (31).

| # | Question (short) | Answer (verbatim) | Our reading | K-ID | Status |
|---|---|---|---|---|---|
| 1 | Repo structure, package manager, Node | "monorepo: Node 20" | Monorepo on Node 20 confirmed. Package manager not stated (see 5) | K-00b | PARTIAL |
| 2 | How a new package is added | "shared package" | Our package goes in as a shared workspace package | K-00a | ANSWERED |
| 3 | What a change must pass; where CI runs | "still working on CI config - no linking or styling (language discrepency) being reviewed, tests no necessary" | Nova CI is still being set up. No lint or style gate yet; tests aren't required to merge. **Our package keeps its own tests and checks regardless** (CLAUDE.md money invariants) | K-00g | ANSWERED |
| 4 | Branch naming, PR conventions, reviewer | "feature - feat/(whatever it is you're adding), reflector/(what), test(/whatever) no pure CSS - styled components" | Branches `feat/…`, `refactor/…` ("reflector" read as refactor), `test/…`. UI uses styled-components, no plain CSS. Whether Khumo is required reviewer: not answered | — | PARTIAL |
| 5 | House rules (logging, errors, PII, style) | "Npm commands (disabled though)" | **AMBIGUOUS.** Possibly "npm scripts exist but are disabled". Logging, error-format and PII rules not answered | — | OPEN |
| 6 | Wallets and invoices in the checkout service? | "Yes" | Confirmed | — | ANSWERED |
| 7 | Balance poller: how deposits are attributed | "yes, mostly. on seperate paths... checkout server seperate webhook style (invoice id directly, server to server, doesn't workout which despite belongs to which invoice) certain node rule manipulated so it works but needs work - include Sherwin" | A poller exists on a separate path. The checkout server takes a server-to-server webhook keyed directly by invoice ID and **does not work out which deposit belongs to which invoice**. A workaround makes it work but "needs work". Confirms risk G0b-b: our per-transfer indexer is the right source for Arc pay-ins. Involve Sherwin | K-23 | ANSWERED |
| 8 | Postings module builds conversion entries? | "Yes otc routes server" | Conversion postings exist and live with the OTC routes server | K-50 | PARTIAL |
| 9 | FX rates and OTC in fx-v2 / otc-routes? | "Yes - in ethics FX/v2 rates module (don't read from the second one), quoting system + arc rates too" | Rates come from the FX v2 rates module (the other rates module must **not** be read). The quoting system should also carry Arc rates | K-50 | PARTIAL |
| 10 | TransactionStatus values and meanings | "Yes (types.ts)" | The five values are confirmed in `types.ts`. What each value means isn't given | K-31 | PARTIAL |
| 11–15 | Payment identity, duplicates, our own records, stage field, exactly-once | "C-11-15 (incomplete)" | Not answered yet | K-04, K-30, K-32, K-33 | OPEN |
| 16 | Amount storage, no floats | "No float in the money path - amounts are backend" | No floats on money paths. Type and scale (for example USDC 6 dp vs 18 dp) **not stated** | K-01, G0b-a | PARTIAL |
| 17 | Main ledger accounts, balancing | "Account Type (Client, Suspense, Settlement, Revenue)" | Four account types. **No expense type**, so where Arc gas is posted is open (follow-up F-3) | K-02, K-06 | PARTIAL |
| 18 | How fees are posted | "Build reversal postings - we don;'t edit or delete... no evidence of mutations" | **AMBIGUOUS numbering.** This reads as the answer to 19 (undo = reversal postings; entries never edited or deleted). Fee posting is still open | K-36, G0b-e | ANSWERED (as 19) |
| 19 | Undo a mistake / dust and suspense | "we have a suspense account for holding deposit in flight - but" | A suspense account holds deposits in flight. The sentence is cut off ("but…"). Dust destination not confirmed | K-06, K-13 | PARTIAL |
| 20 | Dust / per-wallet accounts | "Unsure" | Open | K-13 or K-06 | OPEN |
| 21 | Separate ledger account per Arc wallet | "Unsure" | Open. The design's per-wallet `arc.<w>` sub-account stays an assumption | K-06 | OPEN |
| 22 | DFNS wallets, service accounts, policies, admin | "no real accounts/wallets but we do have test ones .... most operationals done directly on DFNS dashboard. admin is notified for payments. wallet creation is smooth and shows admin everything. Khumo and Sherwin" | No production wallets yet, only test ones. Most operations are done by hand in the DFNS dashboard, and the admin is notified of payments. **Khumo and Sherwin** are the DFNS admins | K-00c, K-24 | ANSWERED |
| 23 | Separate ArcTestnet service account and wallet | "We can create a seperate Arc Testnest account" | **Yes.** Send them [DFNS_SETUP.md](DFNS_SETUP.md). This unblocks the live testnet run | Q-D10 | ANSWERED |
| 24 | DFNS failure handling today | "Will have a look" | Pending | — | OPEN |
| 25 | DFNS `externalId` used? | "Will have a look" | Pending | — | OPEN |
| 26 | — | "We will have a look" | Pending (numbering may be off by one around 18–26) | — | OPEN |
| 27 | Unknown outcome: hold, retry or ask a human? | "Retry" | Their current practice is to retry. **We don't blindly retry an unknown outcome:** that could send the money twice. The design (frozen, §SubmitMarker) first proves the original request was never created (DFNS lookup by `externalId` or a resolved nonce), and only then retries as a new payment. Follow-up F-6 checks they agree | — | ANSWERED, safety note |
| 28 | Retry: same payment or new one? | "New one, record everything for both including the failure and what was done rectify" | A retry is a **new payment**, matching design option (i). Both records are kept, including the failure and the fix | — | ANSWERED |
| 29 | External funding: how it's recorded | "Yep, internal ledger... insert functionalty for manual intervention for all processes" | Recorded in the internal ledger. **New requirement: manual intervention for every process** (delta D-2) | — | ANSWERED |
| 30 | Internal wallet-to-wallet moves recorded? | "Yes, also part of audit trail, each client has udi, needs to go into transaction history... including supporting docs needs" | Yes, as part of the audit trail. Each client has a UID; every movement must appear in the client's transaction history with supporting documents (delta D-4) | — | ANSWERED |
| 31 | Destination allow-list or screening | "Sherwin" | Ask Sherwin | — | OPEN (owner named) |
| 32 | How we request a fiat↔USDC conversion | "we have a git function that gets the code for stored in otc-table, otc-codes (expires in 5 mins), no automated," | A "get code" function stores a code in the OTC table (`otc-codes`). **The code expires in 5 minutes.** Conversion isn't automated | K-50, K-54 | ANSWERED |
| 33 | What a conversion returns | "gitcode (pricing only), aggregated feed, applies spread, OTC desk ui, filled in by human, backend books general entries..t. doesn't exist" | The code is **pricing only** (an aggregated feed plus a spread). Execution: a **human fills it in the OTC desk UI**, then the backend books the journal entries. An automated execution path **doesn't exist** | K-50, K-51 | ANSWERED |
| 34 | VALR test mode; USDC between VALR and DFNS | "OTC desk ui, filled in by human, backend books general entries..t. doesn't exist... no tests/sandbox from VALR (no VALR integration at all) no, manual entry just like VALR processes" | **No VALR integration and no VALR sandbox.** Conversions are entered by hand | K-53, K-52 | ANSWERED |
| 35 | Fiat pay-in arrival: how known, signed, deduped | "build/include it in an internal ledger system, has manual oversight and client involvement where logical, client needs agree to settlement instructions refine that" | No automated fiat pay-in signal today. **Build it into the internal ledger with manual oversight.** The client must agree to settlement instructions, and the flow must be refined (delta D-3) | K-57 | ANSWERED |
| 36 | Invoice matching, two invoices of the same amount | "each invoice has it's own uid that matches to its own amount... client, transaction and" | Each invoice has its own UID tied to its amount (and to the client and transaction). The two-same-amount case isn't directly answered | K-60, K-61, G0b-c | PARTIAL |
| 37 | Late, short or overpaid payments | "functionality needs to happen for us to manually intervention (requote for rate changes, under/over payments - client reachout for change consents" | Manual intervention: **requote when the rate changes**, and handle under/overpayments by **contacting the client for consent** to the change (delta D-2) | — | ANSWERED |
| 38 | Notifications and outbound webhooks | "emails, plus WhatsApp for otc but no whatsapp number yet" | Email today. WhatsApp planned for OTC (no number yet) | — | ANSWERED |
| 39 | Public API conventions | "emails" (and a blank second 39) | **AMBIGUOUS.** Possibly a repeat of 38. API auth, idempotency and error format still open | — | OPEN |
| 40 | Seed or fixture data | "local services rather" | **AMBIGUOUS.** Either "keep using our local stand-ins" (most likely) or "use local payout services rather than CPN". Asked in F-10 | — | AMBIGUOUS |
| 41 | G0b risk questions (a)–(f) | (not answered separately) | Partly covered by 7, 16, 18, 33 | G0b | PARTIAL |

## What this changes (design delta, proposed, not yet verified)

These answers mostly **confirm** the frozen design:
- no floats;
- reversal postings only;
- a suspense account for in-flight deposits;
- a retry is a new payment;
- deposit attribution via our own per-transfer indexer (the current poller can't attribute deposits);
- email notifications;
- a separate ArcTestnet DFNS account.

Five deltas need a design change. They're written up in [NOVA_ARC_DESIGN_DELTA-1.md](NOVA_ARC_DESIGN_DELTA-1.md), and each needs a fresh verifier before any code changes:

- **D-1 FX is quote-then-manual-fill.** FxPort becomes: get a pricing code (expires in 5 minutes), then wait for a human fill in the OTC desk, which is asynchronous and can take any time. A quote older than 5 minutes is never executed; it is requoted with the client's consent. No VALR adapter is built (there's no integration to wrap).
- **D-2 Manual intervention everywhere.** An operator work queue: every HOLD or QUARANTINE item, requote, under/overpayment and stuck payout becomes a case. Operators act on cases (requote, accept with client consent, refund, retry as a new payment, write off with two approvals). Every action is recorded with the actor and a reason. Nothing moves money without the recorded client consent where 35/37 require it.
- **D-3 Fiat pay-in through the internal ledger with oversight.** The fiat pay-in confirmation comes from a human-reviewed ledger entry (via the port). The client agrees to the settlement instructions before funds move.
- **D-4 Client transaction history and supporting documents.** Every leg is visible in the client's transaction history under their UID, with document references attached (stored outside the package, referenced by ID only, no PII on-chain).
- **D-5 Account-type mapping.** GL roles map onto Client / Suspense / Settlement / Revenue through configuration. The gas expense account and the dust destination remain open (F-3, F-4).

## Follow-up questions (round 2)

These are the copy-paste text in `Downloads/arc-followup-for-khumo.txt`:
- **F-1:** questions 11–15;
- **F-2:** amount type and scale;
- **F-3:** gas expense account;
- **F-4:** dust;
- **F-5:** per-wallet accounts;
- **F-6:** retry safety;
- **F-7:** DFNS failure handling and `externalId`;
- **F-8:** screening (Sherwin);
- **F-9:** API conventions;
- **F-10:** the meaning of "local services rather";
- **F-11:** the reviewer;
- **F-12:** the cut-off "but" in 19.
