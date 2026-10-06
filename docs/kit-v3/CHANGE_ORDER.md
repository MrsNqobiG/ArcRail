# Change order CO-1 v3 (Raayl): supersedes all earlier change orders

## Before you paste (you, not Claude Code)
1. Copy these kit files into the repo, replacing the old ones: `.claude/hooks/guard.sh`, `.claude/hooks/test-guard.sh`, `.claude/settings.json`, and `.mcp.json` (Arc docs MCP).
2. Put `CLAUDE.md`, `KICKOFF_PROMPT.md` and the boss's strategy note (save it as `RAAYL_STRATEGY.md`) in `docs/kit-v3/`, for reference only. Don't overwrite the repo's own `CLAUDE.md`; step 4 merges it.
3. Restart Claude Code and approve the `arc-docs` MCP server.

---

## Prompt (paste everything below)

OPERATOR: Change order CO-1 v3. This supersedes any earlier change order. It is a structural change: process it in its own blocks, verify each block with the `verifier` subagent, and never mix it with feature work.

### Context (source of truth: `docs/kit-v3/RAAYL_STRATEGY.md`)
- **The roles.**
  - **Raayl** is the product: customer, API, KYB/KYC, pricing, ledger and reconciliation.
  - **DFNS** is the existing wallet, signing, policy and treasury layer.
  - **Arc** is an additional USDC settlement network.
  - **VALR / OTC providers** are the fiat↔USDC liquidity.
- **Flow:** Customer → Raayl → DFNS → Arc → Recipient.
- **Principle: extend Raayl's existing code. Never build a parallel system.** According to the team, Raayl already has:
  - a `wallets` table (`user_id`, `deposit_address`), seeded at onboarding (`services/checkout/src/server.ts:197`);
  - `balance-poller.ts`, which polls DFNS per wallet and attributes deposits to the owning client;
  - an `invoices` table and routes (`/merchant/:id/invoices` in `checkout/src/server.ts`);
  - `buildConversionPostings` in `postings.ts`, `fx-v2.ts` for rates, and `otc-routes.ts`, which together form the ZAR↔USDC conversion engine;
  - `TransactionStatus` (`PENDING` / `PROCESSING` / `SETTLED` / `FAILED` / `REVERSED`) in `types.ts`.

  Verify every one of these by reading the code. Do not assume.

### Step 1: Safety and tooling (one block)
1. If there are no commits, run gitleaks, commit, and tag `pre-CO-1`. All further work goes on a feature branch with PRs reviewed by a human (Khumo). Never push to main.
2. Run `bash .claude/hooks/test-guard.sh`; it must print `32 passed, 0 failed`.
3. Prove the guardrails by attempting each of these. All must be blocked:
   - reading `.env`;
   - a shell command referencing chain ID 5042;
   - a broadcast without a testnet RPC;
   - `curl` to `api.dfns.io`;
   - `curl` to `api.valr.com`;
   - writing a fake DFNS token into `src/`.

   Record the results in `docs/verification/guardrails.md`.
4. Confirm the `arc-docs` MCP server is connected. Use it to verify and cite every Arc fact.

### Step 2: Record gates (one block)
In `docs/GATES.md`, record G0 (passed) and G1 (approved in chat, testnet only, superseded by G1b). Every future gate gets name, role, date, commit SHA and the ADR options chosen.

### Step 3: Evidence map of existing Raayl (read-only), then stop at G0b
Write `docs/discovery/RAAYL_MAP.md`. Every claim needs file:line evidence; mark anything unverified. Cover the components listed above, plus:
- how networks and chains are represented today;
- the DFNS client code and where DFNS policies and approvals are used;
- webhook handling;
- the ledger/postings model;
- tests;
- CI.

Then answer these Arc-specific risk questions with evidence:
- **(a) Precision.** At what scale and numeric type are USDC amounts stored in the ledger and postings? Are there floats anywhere on a money path? How would Arc gas, which is paid in USDC at 18-decimal native units, be posted without losing dust?
- **(b) Deposit detection.** Does `balance-poller.ts` attribute deposits from balance deltas or from individual transfers? What happens on Arc when:
  - gas is paid in USDC from the same wallet;
  - an inbound and an outbound transfer land in one poll window;
  - DFNS indexes with a 10-block delay?
- **(c) Invoice matching.** How is an incoming payment matched to an invoice today? What happens with two open invoices of the same amount on one address?
- **(d) Chain abstraction.** Is there one, or are chains hard-coded?
- **(e) `REVERSED`.** What does it mean today? On Arc nothing can be reversed on-chain.
- **(f) Conversion engine.** Precision, rounding, balanced postings, and which provider `otc-routes.ts` calls.

Produce a gap list: what Arc needs added to each component. **STOP at G0b.**

### Step 4: Merge the rules (one block)
Merge `docs/kit-v3/CLAUDE.md` into our `CLAUDE.md`, keeping everything still valid. Show me the diff. The merged rules must include:
- extend existing code instead of building parallel systems;
- testnet only (`ArcTestnet`) until the gates are signed;
- no secrets; no direct DFNS, Circle or VALR production API calls by you; read-only on the DFNS org;
- integer money on every path;
- Arc facts: two USDC decimal views, the system-emitter canonical log, the 20 gwei floor, the `eth_getLogs` cap, blocklist behaviour, no privacy, the `Memo` and `Multicall3From` contracts;
- authenticity checks and dedupe on every inbound signal;
- the wrapper-call signing rule;
- a network abstraction;
- `REVERSED` means a compensating ledger entry only, never an on-chain reversal;
- gate recording;
- GL roles named `GL-1`…`GL-7`;
- no LLM in the money path.

### Step 5: Scope and milestones (decided by the operator)
Build in this order. Each milestone extends existing Raayl code and ends at a demo gate (D1–D7), recorded in `GATES.md`.

**D1 / M1: Arc + DFNS transfer on testnet**, the minimum viable integration.
- A `network` abstraction (`network = ARC`, `asset = USDC`), with all Arc-specific rules inside the Arc adapter only.
- Arc testnet config, plus mainnet config present but disabled by the gates (a CI test proves it).
- A DFNS `ArcTestnet` wallet and a balance query.
- A transfer with DFNS policy approval, then broadcast.
- Confirmation from our own event detection (system-emitter log), with DFNS events as a cross-check.
- Ledger postings via existing postings code (including gas in USDC, with dust handled).
- Status visible via `GET /payments/:id`.

**D2 / M2: Business USDC wallet on Arc.**
- Extend the `wallets` table and onboarding seeding for `network = ARC`. Arc addresses are standard EVM addresses, so DFNS creates them.
- Detect deposits from **per-transfer events**. Keep `balance-poller.ts` as a reconciliation cross-check, not the crediting source (unless G0b proves it is already per-transfer).
- Hold, send, history and export.

**D3 / M3: Payment requests.**
- Extend existing `invoices` with `network = ARC`.
- A matching rule that cannot be ambiguous: a per-invoice address or a unique reference amount (decided in ADR-006). External payers won't attach memos.
- Payment link/QR (verify the format before use) and a "Payment received" notification.

**D4 / M4: Business settlement.**
- Beneficiary management.
- Screening, using a local USDC blocklist copy plus the vendor chosen in ADR-005.
- FIC Directive 9 travel-rule data: full set, and the reduced set below R5,000 (verify the text). The zero threshold applies.
- DFNS approvals.
- An outbound `Memo` with a non-PII reference hash.

**D5 / M5: ZAR↔USDC.**
- Reuse `fx-v2.ts`, `otc-routes.ts` and `buildConversionPostings`. Arc is **not** responsible for fiat conversion.
- Add movement of USDC between the liquidity venue and DFNS Arc wallets, in both directions.
- The cross-border flag stays **OFF** until a legal opinion is recorded.

**D6 / M6: API.**
- `POST /api/v1/payments` (`Idempotency-Key` header required), `GET /api/v1/payments/:id`.
- Signed outbound webhooks (`payment.completed`, etc.).
- Amounts are decimal strings at the API edge and integer base units inside.

**D7 / M7: Multi-chain.** More network adapters (Base, Ethereum, and others). CCTP and Gateway come later.

**Corrections to the strategy note, applied:**
- Arc does not push webhooks. Replace `POST /webhooks/arc` with `POST /webhooks/dfns` (HMAC-verified) plus our own Arc event indexer.
- Mainnet chain ID 5042 is recorded in config, but it stays disabled until gates are signed.

**Not now:** a new wallet or custody system, DeFi, lending, tokenisation, custom smart contracts, yield, an exchange, consumer features, StableFX, CPN, and the Arc Onramp widget.

### Step 6: Status model (one block)
Keep the existing `TransactionStatus` as the public status; do not rename it. Add a `stage` field for the lifecycle: `CREATED`, `PENDING_APPROVAL`, `APPROVED`, `SUBMITTED`, `CONFIRMING`, `COMPLETED` / `REJECTED`, `EXPIRED`, `CANCELLED`. Add an explicit mapping table from stage to status, with tests. Also define:
- Arc-specific failures with no receipt: a blocklisted sender is rejected before the mempool, and transactions under the fee floor are dropped. Both go to `FAILED` with a reason.
- `REVERSED` = a compensating ledger entry only.

### Step 7: Design G1b (one block per document, each verified)
Update the design for Raayl:
- the interfaces between existing modules and the new Arc adapter;
- sequence diagrams for D1–D6, including every failure path;
- STRIDE + LINDDUN threat model (DFNS, VALR, Arc RPC, webhooks, invoices, wrapper-call smuggling);
- risk register (3–6 top entries; blind risks get reconstruction-based detection).

ADRs (recommend an option for each; don't decide):
- ADR-001 custody = existing DFNS;
- ADR-002 chain access (own node + reference RPC);
- ADR-003 orchestration (existing Raayl code);
- ADR-005 screening vendor (Arc lists Chainalysis, Elliptic and TRM Labs);
- ADR-006 deposit addresses and invoice matching;
- ADR-007 stack = existing TypeScript;
- ADR-009 liquidity = existing OTC/VALR (StableFX and App Kit Swap noted as later options);
- ADR-010 network abstraction;
- ADR-011 notifications and outbound webhooks;
- ADR-013 status mapping.

Rubric additions:
- agnosticism: the network-abstraction lint rule plus a second fake network adapter passing the same tests;
- precision: property tests covering 6/18-decimal values and gas dust;
- communication integrity: "completed" only after our own confirmed event;
- authenticity and dedupe on every inbound signal;
- wrapper-call decoding, with tamper tests.

Run Probes G and F. **STOP at G1b** with a one-page packet: what changes in which existing files, open questions, and what I'm approving.

### Step 8: Build
- After G1b, build D1 as a thin vertical slice on a feature branch: generation block, then verifier, then freeze, per unit.
- Each milestone ends at its demo gate with an evidence note.
- Mainnet needs the G-P pilot gates (proposed in `docs/kit-v3/KICKOFF_PROMPT.md` §9, for Compliance to confirm), then G-M.

### Unchanged constraints
- Testnet only.
- No secrets.
- No direct DFNS, Circle or VALR production API calls by you.
- Read-only on existing code until G1b, then changes only via PRs.
- Cite every external fact, or ask.

End each response with the status footer.
