> **Raayl note (6 Oct):** for the Raayl project, `CHANGE_ORDER.md` (CO-1 v3) and the boss's strategy note take precedence over this template wherever they differ (milestones D1–D7 replace units U16–U20; liquidity comes from the existing OTC/VALR engine; Arc does not do fiat conversion).

# Claude Code kickoff prompt v2: Arc rail on the existing banking system

> **Which file to use:**
> - **Fresh repo:** fill in §1, then paste everything below the line into Claude Code from the repo root (with this kit's `CLAUDE.md` and `.claude/`).
> - **Project already running** (G0 passed, G1 approved in chat, Phase 2 started): do NOT paste this. Paste `CHANGE_ORDER.md` into the existing session instead. It merges these changes without losing work.
>
> Anything left as `<fill>` is unknown, and Claude Code will stop and ask.

---

## §1 Operator settings

- Core banking system (CBS): product/vendor and version `<fill>`; integration style (REST/SOAP/MQ/ISO 20022/files) `<fill>`; read-only code or API docs at `<fill>`; UAT environment `<fill or "none yet">`
- Custody: **company Dfns org**. Dfns admin `<fill name>`. Testnet service account requested: `<yes/no>`. Dfns API region (EU default or UAE) `<fill>`.
- Rand pay-in: `CBS UAT | payment-provider sandbox | labelled mock (approved by <name>)` → `<fill>`
- Quote/RFQ source: `Circle StableFX (sandbox) | bank FX desk | labelled stand-in` → `<fill>`
- Payout routes for the demo: `USDC to wallet` (required); `EURC via StableFX` `<yes/no>`; `fiat via CPN` `<yes/no; corridors>`
- Notifications: `CBS notification service | email (provider or self-hosted) | both` → `<fill>`; sending domain `<fill>`
- Chain access: own Arc testnet node `<URL or "none yet">`; reference RPC `https://rpc.testnet.arc.io`
- Screening provider `<fill or undecided>`; travel-rule provider `<fill or undecided>`
- Checkpoint: `pause` at every gate. Loop: cap `10`, grace `2`, regeneration budget `3`.

## §2 Mission

Enable Arc Network as an **additional settlement rail** on the bank's existing CBS, using the **company's Dfns org for custody**. Nothing is rebuilt: the CBS remains the system of record, and Dfns remains the custody and approval system.

**Primary journey (the boss's proof of concept).** A sender in South Africa:
1. pays in **rand**;
2. chooses **what the recipient receives**: USDC or another stablecoin in a wallet, or (when available) local currency in a bank account;
3. gets one **all-in quote** with an expiry;
4. the bank converts and sends over **Arc**;
5. sender and recipient follow every step on a **live status page** and by **email**.

**Secondary journeys:**
- merchants receiving USDC deposits that are credited in the CBS;
- bank treasury and gas management.

**Out of scope:** rebuilding KYC, ledger or custody; card acquiring; earned-wage access; accounting features; the ARC token; custom smart contracts (unless an ADR is approved); anything on mainnet before its gates are signed.

Copy this section verbatim into `docs/MISSION.md`; the cold-reader subagent reads only that file.

## §3 What "0% error" and "perfect compliance" mean here

No software can promise zero errors, and an AI agent cannot certify compliance. Do not claim either. Prove these instead.

**Zero undetected money errors.** Every CLAUDE.md invariant is enforced by types or code, proven by tests (including property-based and mutation tests), and checked at runtime, failing closed. Exit bars:
- 100% branch coverage on money-path modules;
- mutation score ≥90% on money-path modules;
- 0 base units of reconciliation drift across chain ↔ adapter ↔ CBS (and against the Dfns balance view as a cross-check) in every scenario;
- 0 high or critical SAST/SCA/secret findings;
- every external fact cited, or listed as open.

**Compliance by evidence.** `docs/COMPLIANCE_MATRIX.md` has these columns: source (URL + date) · control · file:line · test/evidence · owner · status. Only a named human sets SIGNED-OFF. Unverifiable items are marked UNVERIFIED, and you ask.

## §4 Operating discipline

Follow CLAUDE.md "How we work". In addition:
- **Fresh-context reviews.** Use the `verifier` subagent for Lens R and Lens A, and `cold-reader` for Lens H. Give them only the target and commit SHA, never your reasoning.
- **Living documents.** Maintain `docs/LEDGER.md`, `docs/RUBRIC.md` (derived fresh, not stock), `docs/RISK_REGISTER.md` (3–6 top entries; blind-risk entries detected by reconstruction or an external anchor) and `docs/GATES.md`.
- **Calibrate before generating.** Probe G: could a bad build pass the rubric? Probe F: could a good build fail it? Patch at most twice and log both.
- **Verdict.** ACCEPT only after a completed 3-pass streak, with certificate strength per layer. Otherwise STRUCTURAL CEILING: each gap with location, type, an escalation packet, and the BEST-ACHIEVED build.
- **Git.** Commit after every frozen unit and every gate. Never commit secrets (gitleaks runs in CI and pre-commit).

## §5 Phases and gates

### Phase 0: Discovery (read-only), then stop at G0
1. **Tooling.** Install Circle skills (`/plugin marketplace add circlefin/skills`, then `/plugin install circle-skills@circle`) and Arc Foundry. Confirm the `arc-docs` MCP server from `.mcp.json` is connected (the operator approves it). Use it, and docs.arc.io, to verify every instruction.
2. **Guardrails.** Run `bash .claude/hooks/test-guard.sh` and prove the blocks work by attempting each. All must be blocked:
   - reading `.env`;
   - a command referencing chain ID 5042;
   - a broadcast without a testnet RPC;
   - a curl to `api.dfns.io`.

   Record the results in `docs/verification/guardrails.md`.
3. **Constants and sources.** Re-derive every Arc, Dfns, StableFX and CPN fact you'll rely on into `docs/constants.md` and `docs/sources.md`, each with a quote.
4. **Map the CBS from evidence only** (file:line or spec section for every claim). Cover:
   - ledger/posting model; how a new rail or payment type is added;
   - minor-unit rules; idempotency and retry semantics;
   - events; holds; maker-checker;
   - screening, monitoring, cases and FIC reporting;
   - notification service; auth; secret store;
   - environments; CI/CD and change management; data residency.
5. **Map the Dfns setup from documentation and the admin's answers** (no API calls):
   - which permissions, policies, wallets and service accounts the rail needs → `docs/DFNS_SETUP.md`;
   - what can be enforced natively in Dfns, versus what the gateway must enforce.
6. Fill `docs/CBS_CAPABILITY_CHECKLIST.md` and `docs/OPEN_QUESTIONS.md`. **STOP at G0.**

### Phase 1: Design, then stop at G1

1. **`docs/CONTRACT.md`.** The adapter ↔ CBS contract. Every call and event has a schema, an idempotency key, and outcomes `OK` / `REJECTED{code}` / `CONFLICT` / `AMBIGUOUS`. Include:
   - GL roles GL-1 to GL-7;
   - posting templates for every leg (rand in; ZAR→USDC; optional swap; payout; fees; gas; refunds; dust);
   - unit mapping with worked boundary examples.
2. **Sequence diagrams (Mermaid)** for:
   - quote → pay-in → convert → route → notify, for each payout route;
   - inbound merchant deposit;
   - treasury and gas moves;
   - every failure and refund path: quote expiry; pay-in fails or is late; CBS timeout; RPC disagreement; stuck nonce; blocklist; screening hit; missing travel-rule data; swap rejected; payout institution rejects; chain stall; notification delivery failure.
3. **Threat model.** STRIDE plus LINDDUN across the CBS, Dfns, gateway, monitor, nodes, Circle APIs, pay-in, email, status page and supply chain, feeding the risk register.
4. **ADRs.** Recommend an option for each; do not decide.
   - ADR-001 custody = company Dfns org. Define the gateway scope (only what Dfns can't enforce) and data residency.
   - ADR-002 chain access (own nodes + reference RPC; quorum reads).
   - ADR-003 orchestration (reuse CBS workflow if present; otherwise a DB state machine for testnet).
   - ADR-004 travel rule. Note Directive 9's reduced field set below R5,000; verify the exact text.
   - ADR-005 address screening.
   - ADR-006 deposit address model.
   - ADR-007 language/stack.
   - ADR-008 independent monitor.
   - ADR-009 QuoteProvider (StableFX / bank desk / stand-in) and swap engine (StableFX vs App Kit Swap for USDC↔EURC; App Kit Swap does not cover ZARU; Dfns-with-viem-adapter compatibility is an open question).
   - ADR-010 payout routes and who chooses (sender picks vs claim link).
   - ADR-011 notifications (CBS service vs email; self-hosted vs provider).
   - ADR-012 rand pay-in method. The Arc Onramp widget is recorded as rejected for now: South Africa not listed, its own external KYC, and data residency.
   - Reference designs to cite: docs.arc.io exchange guides (deposits, withdrawals), custody guide, blocklist-monitoring guide, fee-display guide, node service and monitoring guides.
5. Write the rubric and risk register, run Probes G and F, and **STOP at G1**.

### Phase 2: Skeleton, CI and agnosticism, then stop at G2

One generation block:
- module layout with ports in `src/ports/{cbs,signer,quote,route,payin,notifier,screening,travelrule}`;
- branded types; a stub for every port plus a second, structurally different fake;
- test harness: unit, property, mutation, contract tests, Arc testnet E2E;
- a dependency-lint rule enforcing port isolation;
- CI running build and tests, mutation on money modules, Semgrep, osv-scanner/Trivy, gitleaks, CycloneDX SBOM, cosign signing and SLSA provenance;
- dependencies pinned by hash.

Then a verifier pass that **runs** the lint rule and both fakes' contract tests. **STOP at G2.**

### Phase 3: Units, one per block, each verified then frozen

**Order: build the PoC slice first.** The PoC slice runs U1, U2, U3, U17, U18, U9, U19 (USDC to wallet only), U10, U16 and U12, which proves the boss's demo end to end on testnet. Then build the remaining units.

| # | Unit | Must include |
|---|---|---|
| U1 | Amount and currency types | `CbsMinor`, `UsdcUnits`, `NativeWei`, `FiatMinor<CCY>`; one conversion module; asset and currency registry; property tests (round-trips, boundaries, dust) |
| U2 | Chain config | Testnet config; a mainnet entry that stays disabled unless the gates in GATES.md are signed (a CI test proves it) |
| U3 | Chain client | Own node + reference reads; disagreement → PAUSE; retries; log paging; stall detection |
| U4 | Ingestion | Canonical credits from the system-emitter log (per the Arc deposits guide); dedupe; ERC-20 log as cross-check; Dfns webhooks as a second cross-check; `Memo` events matched to transfer IDs; unknown-event quarantine |
| U5 | Address registry | Addresses created via Dfns; the address↔customer map is personal information (encrypted, access-logged, never on-chain or in logs) |
| U6 | Inbound deposit → CBS | Screening before availability; idempotent posting; compensation |
| U7 | Policy engine | Deterministic limits, allow-lists, route and corridor rules, cross-border flag (OFF by default), approval thresholds |
| U8 | Compliance hooks | CBS screening/monitoring/cases/FIC reporting; on-chain address screening; Directive 9 payload builder/validator (full and reduced sets, zero threshold); unhosted-wallet handling; CPN travel-rule data when that route is enabled; local USDC blocklist copy from `Blocklisted`/`UnBlocklisted` events, checked before every send; screening vendor per ADR-005 (Arc lists Chainalysis, Elliptic, TRM Labs) |
| U9 | Signer | Dfns adapter (`ArcTestnet`) using Dfns policies and approvals; thin gateway for chain-ID pin, monitor `ALL_CLEAR`, CBS binding and replay; wrapper-call rule from CLAUDE.md (allow-listed `Memo`/`Multicall3From`/swap/settlement contracts, with inner-call decoding and tampering tests); webhook HMAC verification; `docs/DFNS_SETUP.md` |
| U10 | Transfer orchestrator | Quote locked → pay-in confirmed → reserve in CBS → policy → screening (incl. local blocklist) → travel rule → `eth_call` simulation → Dfns approval → sign → broadcast → finality → route completion → settle in CBS; outbound transfers carry a non-PII `Memo` reference; later, merchant payout runs may batch via `Multicall3From`; every failure path is a tested refund |
| U11 | Gas treasury | Gas wallet limits, top-ups, fee ceilings, fee display (USDC + ZAR) |
| U12 | Reconciliation and circuit breaker | Chain ↔ adapter ↔ CBS (+ Dfns view), matched by `Memo` reference; zero-drift auto-pause; two-person unpause |
| U13 | Audit and observability | Hash-chained audit log; OpenTelemetry with no PII; SLOs and alerts |
| U14 | Exchange-control data | Capture likely FinSurv fields; cross-border flag stays OFF until legal sign-off |
| U15 | Runbooks | Node deployment; incident response; pause/unpause; Dfns credential rotation and webhook-secret rollover; key-compromise drill; regulator notification (Joint Standard 2 of 2024) |
| U16 | Communications | Notifier port; status page (SSE) + email; each state maps 1:1 to a message, licensed by a ledger/chain/route fact; "arrived" only after the route's final confirmation; unguessable expiring links; no PII in URLs; no action requests in emails; SPF/DKIM/DMARC documented; testnet banner everywhere |
| U17 | Rand pay-in | PayIn port; CBS UAT or provider sandbox adapter, or a mock that is clearly labelled and approved; signed and deduplicated notifications; late or failed pay-in → quote expiry/refund |
| U18 | Quote / RFQ | QuoteProvider port; StableFX sandbox adapter (stub until API key), bank-desk adapter, labelled stand-in; all-in quote composing every leg; expiry, rate lock, slippage rules |
| U19 | Payout routes | Route port: OnchainDirect (USDC to wallet), SwapThenWallet (StableFX), FiatPayout (CPN as the sending institution; stub until the participation agreement); recipient data per route (bank details are PII); route-specific states and refunds |
| U20 | Pilot profile | Mainnet pilot configuration: bank's own funds only; tiny per-transaction and daily caps; allow-listed recipients; separate Dfns service accounts and policies. Built but **disabled** until every G-P gate is signed |

For each unit: generation block, then verifier Lens R, then freeze (or up to 2 fixes, then the plateau ladder).

### Phase 4: Perfecting loop
Lens R, then A, then H, one per response, until 3 consecutive positive passes, within the round cap.

### Phase 5: Testnet demonstration and verdict, then stop at G3
End to end on Arc testnet, for each enabled route:
- quote;
- pay-in;
- conversion;
- send;
- arrival;
- status page and emails;
- every failure path, injected deliberately.

Produce `docs/EVIDENCE_PACK.md` and the verdict. **STOP at G3.**

## §6 Technical standard (verify versions at install time)

- **Secure development:** NIST SSDF; OWASP ASVS 5.0 L3 for APIs and the status page; SLSA L3; Sigstore/cosign; CycloneDX SBOM; pinned dependencies; Renovate.
- **Runtime:** mTLS and workload identity; least privilege; secrets in OpenBao or the CBS secret store (HSM-backed where available); separate Dfns service accounts per role and per environment; network-segmented Proxmox VMs; immutable backups.
- **Testing:** property-based tests; mutation tests; consumer-driven contract tests per port; deterministic fault injection (RPC lies/lag, duplicate or out-of-order webhooks, Dfns/StableFX/CPN timeouts, CBS timeouts, nonce gaps, chain stall, quote expiry mid-flow); Arc testnet E2E.
- **Contracts:** none of our own. Using Circle's StableFX contracts is an integration, scoped by an explicit Dfns policy exception, not a blanket permission.
- **AI:** no model in the money path. Any operational AI is self-hosted, propose-only, and has no signing or posting rights.
- **Data:** no PII on-chain or in telemetry. Every flow of personal data to an external party (Dfns, Circle, payout institutions, email provider) is listed for the POPIA s72 assessment.

## §7 Stop-and-ask triggers

Stop and ask when:
- the behaviour of the CBS, Dfns, StableFX or CPN is unclear;
- a doc contradicts this prompt;
- a regulatory point can't be verified;
- a CBS or Dfns change seems necessary;
- network access is needed outside the allowlist;
- a guardrail blocks legitimate work;
- an invariant can't be enforced;
- a route or corridor needs a partner agreement that doesn't exist yet.

## §8 South African regulatory control map

Verify every row against the primary source; counsel and Compliance sign off.

| Area | Build or evidence |
|---|---|
| FAIS: crypto assets are a financial product (FSCA GN 1350 of 2022); CASP licensing | Disclosures (irreversible, issuer can freeze, not legal tender, no deposit insurance); product rules only for licensed categories (ask which) |
| FIC Act Item 22; RMCP | Reuse CBS CDD; ≥5-year records (verify); STR/CTR routing; TFS screening including on-chain addresses |
| FIC Directive 9 (in force 30 Apr 2025, zero threshold) | Full and reduced (<R5,000) field sets per the Directive text; block sends without complete data; unhosted-wallet risk handling; counterparty due diligence; CPN travel-rule data on the fiat route |
| SARB/FSCA joint communication (28 May 2026) | Not legal tender. The SARB is "unlikely to consider foreign currency-pegged stablecoins as payment instruments for domestic transactions", so treat domestic USDC use as a strategic risk |
| Exchange control: draft Capital Flow Management Regulations and draft Crypto Asset Manual | Cross-border flag OFF until a legal opinion; capture data; FX quoting and authorised-dealer questions go to counsel |
| Joint Standard 2 of 2024; Joint Standard 1 of 2023 | Control mapping, incident runbook, testing evidence; confirm JS1 applies |
| POPIA (incl. s72) | PIA; data-flow inventory for Dfns, Circle, payout institutions and the email provider; minimisation; retention aligned to FICA |

## §9 Mainnet gates (the agent cannot clear these)

**Pilot (G-P), proposed for Compliance to confirm.** Bank's own funds, tiny caps, allow-listed recipients:
1. Legal sign-off that existing licences cover the pilot, including any cross-border element.
2. FIC registration/RMCP covering the rail, with travel-rule handling for the pilot's flows.
3. Focused security review of the gateway, signer and orchestrator.
4. Dfns mainnet service accounts, policies and approvers set up by two people, with a written record; key-compromise drill run.
5. Monitor and reconciliation proven on testnet (from the evidence pack).
6. Rollback/pause drill run.

**Full service (G-M):**
1. FSCA authorisation + FIC Item 22 + RMCP.
2. Travel-rule interop tested with a counterparty CASP.
3. Exchange-control legal opinion.
4. Independent security review.
5. Key ceremony + signing policy + drill.
6. Joint Standard 2 evidence + POPIA PIA for every vendor.
7. Bank-partner sign-off for ZAR legs.
8. Staged rollout plan.

CI fails if any mainnet configuration is reachable while the gates it needs are unsigned.

## §10 Footer (every response)

`phase · units frozen/total · streak n/3 · rounds used/10 · regen budget left`

Begin with Phase 0.
