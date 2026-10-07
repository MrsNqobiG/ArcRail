# Questions for Khumo (Nova / Raayl codebase)

We don't have Nova's code. The Arc package ([NOVA_ARC_DESIGN.md](NOVA_ARC_DESIGN.md)) talks to Nova only through small ports that Nova implements. Every row below is something the design **assumes** about Nova. Each one stays unverified until Khumo answers it, ideally with a `file:line` pointer, and nothing in code may treat it as fact before then (CLAUDE.md rule 5).

**How to answer:** fill in the "Answer" column (a short answer plus `file:line` where possible). "Don't know yet" is a fine answer. If the honest answer is "it doesn't exist", say so: that tells us what the port adapter must add.

The `A-xx` tag is the assumption's ID in the design, and `K-xx` is this question's ID. Status: OPEN · ANSWERED (who, date) · NOT APPLICABLE.

> **Round 1 answers received 2026-10-07:** see [KHUMO_ANSWERS.md](KHUMO_ANSWERS.md) (verbatim answers, our reading, K-ID mapping) and [NOVA_ARC_DESIGN_DELTA-1.md](NOVA_ARC_DESIGN_DELTA-1.md). Rows below keep their OPEN status until the answers are confirmed in round 2.

## 0. Repo and conventions

| ID | Question | Why we ask | Answer | Status |
|---|---|---|---|---|
| K-00a | Where should this package live in the pnpm monorepo: a new `libs/arc-rail` workspace package imported by `services/ledger` and `services/checkout`, or a new service? | Decides the composition root and how Nova wires the ports | | OPEN |
| K-00b | Exact Node version (20.x), TypeScript version and `module` setting (ESM or CJS), and test runner (Vitest, Jest, other)? | The package targets Node 20 and must build inside Nova's toolchain | | OPEN |
| K-00c | How does Nova call DFNS today: the official DFNS SDK, or its own HTTP client? Which service account(s), which permissions, which region host? | We must reuse, not duplicate, the existing DFNS access (extend, never parallel) | | OPEN |
| K-00d | Does Nova already receive DFNS webhooks? If yes: which route, how is the HMAC verified, and how are duplicates handled? | The design adds `POST /webhooks/dfns`; if a handler exists we extend it instead | | OPEN |
| K-00e | How are networks and chains represented today (enum, table, string)? Are they hard-coded anywhere (for example in `balance-poller.ts` or the `wallets` seeding)? | G0b (d); the network abstraction must fit what exists | | OPEN |
| K-00f | Where do secrets come from at runtime (env from a secret manager, Vault, cloud KMS)? We never read them; we need the interface name | `SecretPort` implementation | | OPEN |
| K-00g | What does CI run on a PR (lint, tests, type-check, anything money-specific)? | So our CI checks (float lint, Semgrep MC-01, contract tests) slot into Nova's | | OPEN |

## 1. LedgerPort (`services/ledger`)

| ID | Tag | Question | Answer | Status |
|---|---|---|---|---|
| K-01 | A-01 | How are amounts stored: column type (`bigint`, `numeric(p,s)`, text) and **precision per asset**? What precision does USDC have (6? 18? something else)? Is ZAR stored in cents? | | OPEN |
| K-02 | A-02 | How is a ledger account identified (UUID, code, per-user account row)? Is there one USDC account per customer? | | OPEN |
| K-03 | A-03 | What asset/currency codes exist (for example `USDC`, `ZAR`)? Is USDC one asset regardless of chain, or one per chain? | | OPEN |
| K-04 | A-04 | Does posting accept a **caller-supplied idempotency key**? What happens on the same key with the same body, and with a different body? Is there a "get result by key" lookup? How long are keys kept? | | OPEN |
| K-05 | A-05 | Does the ledger itself reject a journal whose debits ≠ credits? | | OPEN |
| K-06 | A-06 | What are the actual accounts for: customer USDC liability (GL-1), company USDC asset (GL-2, with one sub-account per holding location: each DFNS wallet on Arc, and USDC held at a payout partner), gas/network fee expense (GL-3), suspense (GL-4, including unidentified receipts to company wallets from D1), clearing/in-flight (GL-5), fee income (GL-6), company-owned USDC funding (GL-7)? Can they be configured rather than hard-coded? | | OPEN |
| K-07 | A-07 | Is a multi-leg journal written atomically (one DB transaction)? | | OPEN |
| K-08 | A-08 | Are there **holds/reservations**? If not, is "debit customer to a clearing account, release on failure" acceptable for customer statements? | | OPEN |
| K-09 | A-09 | Is the insufficient-funds check done inside the same transaction as the debit (no race between check and post)? | | OPEN |
| K-10 | A-10 | What does the `reconcile` command compare, and against what (DFNS balances, chain, provider statements)? Can it take our journals' refs (`paymentId`, `txHash`, `logIndex`, DFNS transfer id)? | | OPEN |
| K-11 | A-11 | Can the ledger hold an amount at **18 decimal places** for one account (the gas-dust suspense, GL-4)? If not, we keep that remainder in a small table in Nova's Postgres and post only whole minor units. | | OPEN |
| K-12 | — | Who pays Arc gas: the company (expense), or the customer (fee in the quote)? Is there an existing fee model for DFNS sends today? | | OPEN |
| K-13 | — | Deposit dust (D2), and the sub-minor part of unidentified receipts to company wallets (D1): amounts below USDC's ledger precision that arrive on-chain. Who owns them: kept in suspense for the sender, company income, or returned on request? | | OPEN |

## 2. WalletRegistryPort (`wallets` table, onboarding seeding)

| ID | Tag | Question | Answer | Status |
|---|---|---|---|---|
| K-20 | A-20 | Exact schema of `wallets` (we were told `user_id`, `deposit_address`; seeded at `services/checkout/src/server.ts:197`). Is there a `network`/`chain` column, a DFNS wallet id column, a status column? | | OPEN |
| K-21 | A-21 | Is the company's own treasury (hot) wallet a row in `wallets`, or configured elsewhere? | | OPEN |
| K-22 | A-22 | Are addresses stored lower-case, checksummed, or as received? | | OPEN |
| K-23 | A-23 | Does `balance-poller.ts` attribute deposits from **balance deltas** or from **individual transfers** (DFNS wallet history)? How often does it poll? (G0b (b)) | | OPEN |
| K-24 | — | When onboarding creates a DFNS wallet, which service account and which DFNS network names does it use today? Is wallet creation done by Nova code or by an admin by hand? | | OPEN |

## 3. PaymentStorePort (our working state in Nova's Postgres)

| ID | Tag | Question | Answer | Status |
|---|---|---|---|---|
| K-30 | A-30 | May the package add its own tables (payments, payment legs, inbound-signal inbox, outbox, indexer cursor, rail state) through Nova's normal migration tool? Which tool (Prisma, Knex, node-pg-migrate, raw SQL)? | | OPEN |
| K-31 | A-31 | Is `TransactionStatus` in `types.ts` exactly `PENDING` / `PROCESSING` / `SETTLED` / `FAILED` / `REVERSED`? Which code reads it (dashboard, API, reports)? | | OPEN |
| K-32 | A-32 | Is there already a payments/transactions table that an Arc payment should be a row in (so we extend it with `stage`, `network`, legs), rather than a new table? | | OPEN |
| K-33 | A-33 | Is there a transactional outbox (or job queue) today? Which one? | | OPEN |
| K-34 | A-34 | Will Nova's real port adapters run our shared contract-test suites in Nova's CI? | | OPEN |
| K-35 | A-35 | Who may read `GET /payments/:id` (the payer only, the merchant, staff)? How does Nova authenticate API and dashboard requests today? | | OPEN |
| K-36 | — | What does `REVERSED` mean today, and what creates it? (G0b (e)) | | OPEN |

## 4. Beneficiaries, conversion and payout (journey: payer picks, receiver picks)

| ID | Tag | Question | Answer | Status |
|---|---|---|---|---|
| K-41 | A-41 | Is there a beneficiary/recipient record today (bank account or wallet address saved server-side)? **Where is the receiver's chosen payout method stored** (fiat bank account or stablecoin wallet): on the receiver's own account, on each beneficiary record the payer saves, or on a payment link/invoice the receiver issues? Is it versioned? The design never takes a destination **or a payout method** from the payer's request: the receiver picks how they receive (operator correction), so `ReceiverPort.resolvePayout` reads it from Nova's record. | | OPEN |
| K-50 | A-50 | Can `fx-v2.ts` (rates), `otc-routes.ts` and `buildConversionPostings` in `postings.ts` be called as one "quote then execute" service? What are their function signatures? | | OPEN |
| K-51 | A-51 | How are FX rates represented (float, decimal string, integer ratio)? How is rounding done, and where does the remainder go? (G0b (f)) | | OPEN |
| K-52 | A-52 | For a **fiat payout** to a receiver's bank account: who pays out today (VALR, an OTC desk, a bank partner), and do they receive USDC on-chain? On which network, to which address? Does the partner send a statement we can reconcile USDC held with them against, and do they return USDC when a payout fails? | | OPEN |
| K-53 | A-53 | Which provider(s) does `otc-routes.ts` call, and do they have a sandbox? (G0b (f)) | | OPEN |
| K-54 | A-54 | Does a conversion complete synchronously, or via a callback/webhook from the provider? How is that callback authenticated? | | OPEN |
| K-55 | A-55 | If a conversion has executed and the payment then fails (for example the DFNS approval is rejected), how is the conversion unwound today? | | OPEN |
| K-56 | — | For **fiat → fiat** payments (payer pays fiat, receiver gets fiat), should the money go through Arc at all, or does Nova already have a direct route? | | OPEN |
| K-57 | — | How does a payer fund a **fiat** pay-in today (bank deposit reconciled by Nova, card, other), and what event says the funds are available? | | OPEN |

## 5. InvoicePort (D3, later)

| ID | Tag | Question | Answer | Status |
|---|---|---|---|---|
| K-60 | A-60 | Schema of `invoices` and the routes under `/merchant/:id/invoices`: what fields identify the expected payment (address, amount, reference)? | | OPEN |
| K-61 | A-61 | How is an incoming payment matched to an invoice today, and what happens with two open invoices of the same amount on one address? (G0b (c)) | | OPEN |

## 6. G0b risk questions (CO-1 v3 step 3, verbatim intent)

These are the change order's Arc-specific risk questions. Each needs `file:line` evidence from Nova.

| ID | Question | Answer (with file:line) | Status |
|---|---|---|---|
| G0b-a | **Precision.** At what scale and numeric type are USDC amounts stored in the ledger and postings? Are there floats anywhere on a money path? How would Arc gas, paid in USDC at 18-decimal native units, be posted without losing dust? (See K-01, K-11, K-51) | | OPEN |
| G0b-b | **Deposit detection.** Does `balance-poller.ts` attribute deposits from balance deltas or from individual transfers? What happens on Arc when (1) gas is paid in USDC from the same wallet, (2) an inbound and an outbound transfer land in one poll window, (3) DFNS indexes with a 10-block delay? (See K-23) | | OPEN |
| G0b-c | **Invoice matching.** How is an incoming payment matched to an invoice today? What happens with two open invoices of the same amount on one address? (See K-61) | | OPEN |
| G0b-d | **Chain abstraction.** Is there one, or are chains hard-coded? (See K-00e) | | OPEN |
| G0b-e | **`REVERSED`.** What does it mean today? On Arc nothing can be reversed on-chain; the design uses it only for a compensating ledger entry. (See K-36) | | OPEN |
| G0b-f | **Conversion engine.** Precision, rounding, balanced postings, and which provider `otc-routes.ts` calls. (See K-50, K-51, K-53) | | OPEN |
