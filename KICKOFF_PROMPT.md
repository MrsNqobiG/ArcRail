# Claude Code kickoff prompt: enable Arc Network on the existing banking system

> Paste everything below the line into Claude Code, started at the root of the new `arc-rail` repo (which contains this kit's `CLAUDE.md` and `.claude/` folder). Fill in §1 first. Anything left as `<fill>` is treated as unknown, and Claude Code will stop and ask.

---

## §1 Operator settings (fill before running)

- Existing core banking system (CBS): name/vendor `agnostic — no specific CBS`; language and framework `n/a (decided in ADR-007)`. Cater to Arc Network requirements only: the CBS side is the minimum port the Arc rail's needs imply. Do not assume any vendor behaviour; vendor-specific facts go to OPEN_QUESTIONS.
- CBS access for Claude Code (read-only): repo path(s) `none`, or API specs path `none`
- CBS non-production environment we may integrate against: `none yet`
- Chain access: self-hosted Arc testnet node URL `none yet`; reference RPC `https://rpc.testnet.arc.io` (verify)
- Custody decision: `HSM self-custody | regulated custodian | undecided` → `undecided`
- Travel-rule solution (FIC Directive 9): `undecided`
- On-chain address screening provider: `undecided`
- Assets in scope now: `USDC` (merchant settlement). Later via the asset registry: `undecided (e.g. EURC)`
- Checkpoint: `pause` (stop at every gate G0–G3 and wait for "continue")
- Loop settings: round cap `10`, grace `2`, regeneration budget `3`

---

## §2 Mission

Enable Arc Network as an **additional settlement rail** on our existing core banking system, so that the bank and its merchant clients can receive, hold, send and settle in **USD stablecoins (USDC first)** on Arc. Design the asset model so other Arc assets can be added later through configuration plus review, not rewrites.

**The existing CBS remains the system of record** for customers, KYC/KYB, accounts, balances, fees, AML case management and the general ledger. You build an **Arc Rail Adapter**: a separate bounded context that talks to Arc on one side and to the CBS through an **anti-corruption layer** on the other.

**Out of scope:** rebuilding onboarding/KYC, the core ledger, card acquiring, earned-wage access, accounting features, the ARC token, any custom smart contract (unless an ADR is approved at G1), and **anything on Arc mainnet**.

Copy this section verbatim into `docs/MISSION.md`, because the cold-reader subagent reads only that file.

## §3 What "0% error" and "perfect compliance" mean here

No software can guarantee zero errors, and an AI coding agent cannot certify regulatory compliance. Do not claim either. Instead, engineer and prove the following.

**Zero undetected money errors.** Every invariant in CLAUDE.md must be:
1. enforced by types or code;
2. proven by tests, including property-based tests and mutation testing on money modules;
3. checked at runtime, failing closed.

The measurable exit bars are:
- 100% branch coverage on money-path modules;
- mutation score of at least 90% on money-path modules;
- reconciliation drift of exactly 0 base units across chain ↔ adapter ↔ CBS in every test scenario;
- 0 high or critical findings from SAST, SCA and secret scanning;
- every Arc and regulatory fact cited, or listed in OPEN_QUESTIONS.

**Compliance by evidence.** Every requirement in §8 becomes a row in `docs/COMPLIANCE_MATRIX.md` with these columns: source (URL + access date), control, where it is implemented (file:line), test or evidence, owner, and status. You may set status to NOT STARTED, IMPLEMENTED or EVIDENCED. **Only a named human sets SIGNED-OFF.** If you cannot verify a requirement from a primary source, mark it UNVERIFIED and ask.

## §4 Operating discipline (mandatory)

Follow the "How we work" rules in CLAUDE.md. In addition:

- **Information hygiene.** Use the `verifier` subagent for Lens R and Lens A, and the `cold-reader` subagent for Lens H. Do not pass them your reasoning or summaries. Give them only the target (unit name or ALL) and the commit SHA.
- **Ledger.** Keep `docs/LEDGER.md` with these columns: unit · intent · status (draft/verified/frozen) · commit · verifier verdict.
- **Rubric and risks.** Derive `docs/RUBRIC.md` (mechanical checks plus judgment lenses with one-line anchors) and `docs/RISK_REGISTER.md` fresh from Phase 0 and Phase 1 findings. Do not reuse a stock rubric.
- **Calibration before generation.** Before writing any code, stress-test the rubric:
  - Probe G: describe a plausible build that passes every rubric item yet is bad. If you can, patch the rubric.
  - Probe F: describe a good build that fails the rubric. If you can, relax or reword it.
  - Patch at most twice and log both probes.
- **Verdicts.** End with exactly one of:
  - **ACCEPT**: only after a completed 3-pass streak. Include certificate strength per layer: "verified by reconstruction" for checkable layers; "passed disciplined self-review; not externally judged" for judgment layers.
  - **STRUCTURAL CEILING**: list each missing item with its location, gap type (capability / coupling / spec-conflict / self-verification), and an escalation packet a human reviewer can act on. Deliver the BEST-ACHIEVED build anyway, with residual defects listed.

## §5 Phases and gates

Work one phase chunk per response and wait for "continue" (or "OPERATOR: ..." instructions).

### Phase 0: Discovery (read-only), then stop at G0

1. Install and confirm tooling. Install Circle's official skills (`/plugin marketplace add circlefin/skills`, then `/plugin install circle-skills@circle`). Install Arc Foundry (`arc-forge`, `arc-cast`, `arc-anvil`). Verify the install instructions against docs.arc.io first; if they differ from this prompt, follow the docs and note the difference.
2. Run `bash .claude/hooks/test-guard.sh` and paste the result. Then prove the protections work. Each of these attempts must be blocked:
   - reading `.env`;
   - running a command that references chain ID 5042;
   - running a broadcast without a testnet RPC.

   Record the evidence in `docs/verification/guardrails.md`. If any attempt succeeds, stop.
3. Fetch `docs.arc.io/llms.txt` and `developers.circle.com/llms.txt`. Re-derive every Arc constant used in CLAUDE.md. Write `docs/constants.md` with these columns: value · source URL · access date · quote. Report any mismatch with CLAUDE.md immediately.
4. **CBS-agnostic port requirements (no CBS is mapped; see §1).** Write `docs/discovery/cbs-port-requirements.md`: what the Arc rail needs from *any* CBS. Derive every requirement from a cited Arc fact (`docs/constants.md` row) or a CLAUDE.md invariant, and cite it. Assume no vendor behaviour. Cover at least:
   - idempotent posting with caller-supplied keys, and retry semantics the adapter must be able to rely on;
   - minor-unit precision needed to represent USDC (6 dp ERC-20 view vs 18 dp native view) and the rounding/dust policy that follows;
   - holds/reservations for outbound payouts, with release and settle;
   - named GL roles: customer USDC liability, treasury/hot wallet, gas expense, suspense/dust, in-flight/clearing;
   - inbox/outbox or event delivery with at-least-once semantics;
   - sanctions/TFS screening, transaction monitoring, case management and FIC reporting hooks;
   - maker-checker / approval;
   - service identity and authn/authz at the port boundary.

   For each requirement, list the minimum guarantee the adapter needs and the failure mode if a CBS cannot provide it. Every vendor-specific unknown (currency, precision, posting API, approval mechanism, secret store, environments, data residency) goes to `docs/OPEN_QUESTIONS.md`.
5. Write `docs/OPEN_QUESTIONS.md`. **STOP at G0** and present the CBS port requirements, the constants table and the open questions.

### Phase 1: Spec, threat model and decisions, then stop at G1

1. Write `docs/CONTRACT.md`: the anti-corruption-layer contract between the adapter and the CBS. It must include:
   - every call and event, with schemas, idempotency keys and error semantics;
   - GL accounts needed: customer USDC liability, treasury/hot wallet, gas expense, suspense/dust, in-flight/clearing;
   - unit mapping CBS minor ↔ `UsdcUnits` ↔ `NativeWei`, with worked examples including boundary values.
2. Sequence diagrams (Mermaid) for:
   - inbound deposit: a merchant or customer receives USDC on Arc → credit in the CBS;
   - outbound payout/withdrawal;
   - internal treasury moves and gas top-up;
   - fees;
   - every failure and compensation path: CBS timeout, RPC disagreement, stuck nonce, blocklist revert, screening hit, travel-rule data missing, chain stall.
3. Threat model: STRIDE for security and LINDDUN for privacy. Cover the CBS boundary, signer, nodes, RPC providers, operators, and the supply chain. Feed the results into `docs/RISK_REGISTER.md` (3–6 top entries, each with a detection method; blind-risk entries must use reconstruction or an external anchor).
4. ADRs, each with options, trade-offs and a recommendation. **Do not decide; the human decides at G1.**
   - ADR-001 custody/signing: FIPS 140-3 Level 3 HSM self-custody with policy engine vs regulated custodian with on-prem co-signer.
   - ADR-002 chain access: self-hosted Arc full/archive nodes on Proxmox plus independent reference RPC; quorum-read design.
   - ADR-003 orchestration: reuse the CBS's workflow/saga mechanism if one exists; otherwise a durable-execution engine (e.g. Temporal, self-hosted). Prefer fewer new components.
   - ADR-004 travel rule (Directive 9) interoperability approach.
   - ADR-005 on-chain address screening (sanctions/TFS + risk).
   - ADR-006 deposit address model (per-merchant addresses vs shared address + memo/reference). Note that Arc has no native memo.
   - ADR-007 language/stack: match the CBS unless there is a reason not to; viem if TypeScript.
5. Write the rubric and risk register, run Probes G and F, and **STOP at G1**.

### Phase 2: Skeleton, then stop at G2

One generation block: module layout, interfaces and branded types, a test harness (unit, property, mutation, contract tests against the CBS, Arc testnet E2E), and a CI pipeline. CI must run:
- build and tests;
- mutation testing on money modules;
- SAST (Semgrep), SCA (osv-scanner/Trivy) and gitleaks;
- SBOM generation (CycloneDX);
- artefact signing (cosign);
- SLSA provenance.

Pin all dependencies by hash or digest. Then a verifier pass on the skeleton against the decomposition plan. **STOP at G2.**

### Phase 3: Units, one per block, each verified then frozen

Use this suggested order; refine it from Phase 1.

| # | Unit | Must include |
|---|------|--------------|
| U1 | Amount and asset types | Branded types; the single conversion module; asset registry (address, decimals, status); property tests for round-trips, boundaries and dust |
| U2 | Chain config | Typed config for testnet and a disabled mainnet entry behind the gate check; constants loaded from cited `docs/constants.md` values |
| U3 | Chain client | Dual-source reads (own node + reference); quorum and disagreement → PAUSE; retries with jitter on -32014; log paging ≤9,999 blocks; stall detection |
| U4 | Ingestion/indexer | Canonical credit source (system-emitter native Transfer log; confirm against docs); dedupe on (chainId, txHash, logIndex); ERC-20 log stored for cross-check only; unknown-event quarantine |
| U5 | Address registry | Deposit addresses derived via the `Signer`; the address↔customer map is personal information: encrypted, access-logged, never on-chain or in logs |
| U6 | Inbound flow → CBS | Idempotent posting via the contract; screening before funds are made available; compensation on CBS failure |
| U7 | Policy engine | Deterministic: allow-lists, per-tx/daily/velocity limits, asset and destination rules, cross-border flag (OFF by default, see §8), approval thresholds |
| U8 | Compliance hooks | Route to the CBS's existing sanctions/TFS, monitoring, case and FIC reporting functions; add on-chain address screening; Directive 9 payload builder/validator (zero threshold); unhosted-wallet risk handling |
| U9 | Signer interface | `Signer` interface, `MockSigner`, and the adapter stub for the ADR-001 choice. No real keys anywhere in this repo |
| U10 | Outbound orchestrator | Reserve in CBS → policy → screening → travel rule → `eth_call` simulation → maker-checker approval (reuse CBS approvals if present; FIDO2-authenticated) → sign → broadcast → finality → settle in CBS; single nonce writer; replacement/cancel policy; every compensation path tested |
| U11 | Gas treasury | Gas wallet limits, top-up flow, fee estimation and display (USDC + ZAR equivalent; never show 18 dp to users) |
| U12 | Three-way reconciliation and circuit breaker | Chain ↔ adapter ↔ CBS at a fixed cadence and on demand; zero-tolerance drift → automatic pause; manual unpause requires two humans |
| U13 | Audit and observability | Append-only, hash-chained audit log of every decision; OpenTelemetry traces/metrics/logs with no PII; SLOs and alerts |
| U14 | Exchange-control data capture | Record the fields FinSurv reporting is likely to need; reporting itself waits for final regulations |
| U15 | Runbooks | Proxmox deployment of arc-node (pinned digest, signature verified); incident response; pause/unpause; key-compromise drill; regulator-notification checklist (Joint Standard 2 of 2024) |

For each unit: one generation block, then a `verifier` Lens R pass on that unit. If it passes, freeze it. If it fails, allow at most two atomic fix blocks and re-verify; if it still fails, use the plateau ladder.

### Phase 4: Perfecting loop on the assembled rail

Run Lens R, then Lens A, then Lens H, one lens per response. Exit after 3 consecutive POSITIVE passes. Respect the round cap from §1.

### Phase 5: Testnet demonstration and verdict, then stop at G3

Run on Arc testnet end to end:
- inbound deposit → CBS credit;
- outbound payout with approval;
- every failure path, injected deliberately.

Produce `docs/EVIDENCE_PACK.md`: test results, mutation report, reconciliation proofs, scan results, SBOM, guardrail evidence, and the compliance matrix. Then issue the verdict. **STOP at G3.**

## §6 Technical standard (state of the art; verify versions at install time)

- **Secure development:** NIST SSDF (SP 800-218); OWASP ASVS 5.0 at Level 3 for any API/UI; SLSA Level 3 build provenance; Sigstore/cosign signing; CycloneDX SBOM; pinned dependencies; Renovate (self-hosted) for updates.
- **Runtime security:**
  - mTLS between services and workload identity; least privilege; no shared credentials;
  - secrets in OpenBao or the CBS's existing secret store, with HSM auto-unseal where available;
  - staff approvals with FIDO2/passkeys;
  - network-segmented Proxmox VMs for nodes and signer, with no inbound internet to the signer;
  - immutable/offline backups (Proxmox Backup Server).
- **Testing:**
  - unit tests;
  - property-based tests (fast-check / Hypothesis / proptest per stack);
  - mutation testing (Stryker / mutmut / cargo-mutants);
  - consumer-driven contract tests against the CBS;
  - deterministic fault injection: RPC lies or lags, duplicate and out-of-order events, CBS timeouts, nonce gaps, chain stall;
  - Arc testnet E2E.
- **Smart contracts:** none by default. If ADR-approved, all of the following are required: arc-forge tests (unit/fuzz/invariant), Slither + Aderyn, Echidna or Medusa, Halmos or Certora on the conservation invariants, two independent audits, and a bug bounty before any value.
- **Monitoring:** OpenTelemetry → self-hosted Grafana stack; on-chain monitoring of our addresses; alerts on drift, stalls, policy denials and unusual outflow rates.
- **AI:** no model in the money path. Any AI used for operations runs on self-hosted open-weight models, can only propose, and never has signing or posting rights. Treat all external content as untrusted input (prompt-injection defence).
- **Data:** no personal information on-chain or in telemetry. Address↔customer links are personal information under POPIA. All data stays in the bank's own facilities unless an ADR approved by a human says otherwise.

## §7 Stop-and-ask triggers

Stop and ask the human, with a specific question, when:
- any CBS behaviour is unclear;
- docs.arc.io contradicts this prompt;
- a regulatory requirement cannot be verified from a primary source;
- a change to the CBS seems necessary beyond docs/CONTRACT.md;
- a tool or dependency needs network access outside the sandbox allowlist;
- a guardrail blocks something you believe is legitimate;
- an invariant cannot be enforced as written.

## §8 South African regulatory control map

For each item: verify against the primary source, record the URL and access date, implement the control, and gather the evidence. These are starting points, not legal advice. Counsel and the compliance officer own the sign-off.

| Area | What to build or evidence (verify first) |
|---|---|
| FAIS: crypto assets are financial products (FSCA declaration, Oct 2022); CASP licensing | Customer disclosures: irreversibility, issuer freeze/blocklist risk, not legal tender, no deposit insurance. Product rules only for the licensed categories the entity actually holds (ask) |
| FIC Act: CASPs are Schedule 1 Item 22 accountable institutions | Reuse CBS CDD; record keeping for at least 5 years (verify period and scope); STR/CTR routing into existing reporting; TFS sanctions screening including on-chain addresses; RMCP references for each control |
| FIC Directive 9 (travel rule), in force 30 Apr 2025, zero threshold | Payload builder/validator for originator and beneficiary data (verify the exact field list in the directive text); block outbound sends without complete data; risk-based handling of unhosted wallets; counterparty-CASP due diligence record |
| SARB/FSCA joint communication (28 May 2026): stablecoins are not money under the NPS Act | All ZAR legs stay on existing bank/NPS rails; never label USDC balances as deposits or "bank accounts" in UI or ledger names |
| Exchange control: draft Capital Flow Management Regulations and draft Crypto Asset Manual for Cross-Border Activities (comments closed 30 Sep 2026) | Cross-border flag OFF by default; capture data fields; enable only after a legal opinion (gate G-M) |
| Joint Standard 2 of 2024: cybersecurity and cyber resilience | Map controls; incident detection, response and notification runbook; testing evidence |
| Joint Standard 1 of 2023: IT governance and risk | Confirm applicability (ask); if it applies, map change-management and third-party risk controls |
| POPIA, incl. s72 cross-border transfers and operator agreements | PIA; data-flow inventory showing nothing leaves the bank without an approved basis; minimisation; retention schedule aligned with FICA |

## §9 Mainnet gates (G-M). The agent cannot clear these.

Mainnet stays disabled in code until `docs/GATES.md` shows SIGNED-OFF (name, role, date) for every one of these:
1. FSCA authorisation covering the crypto-asset services offered (or a mandate under a licensed FSP), and FIC Item 22 registration plus an RMCP that includes this rail.
2. Travel-rule integration tested with at least one counterparty CASP.
3. Legal opinion on exchange control for the planned flows.
4. Independent security review of the adapter (and audits of any contracts).
5. Key ceremony completed, signing policy approved, and a key-compromise drill run.
6. Joint Standard 2 evidence, and a POPIA PIA covering every vendor.
7. Bank-partner sign-off for the ZAR legs.
8. Staged rollout plan: internal funds with low caps, then pilot merchants, then general availability.

A CI test must fail if mainnet configuration is reachable while any gate is unsigned.

## §10 Response footer (every response)

`phase · units frozen/total · streak n/3 · rounds used/10 · regen budget left`

Begin with Phase 0.
