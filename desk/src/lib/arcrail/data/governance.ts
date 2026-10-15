import type { GateRow, AdrRow, RubricItem } from './types'

export const PHASES = [
  { id: '0', name: 'Discovery (read-only)', scope: 'Arc constants, CBS port requirements, open questions', status: 'Done — G0 passed in chat; Phase 0 docs never independently verified', color: 'amber' },
  { id: '1', name: 'Design', scope: 'CONTRACT, sequences, threat model, ADRs, rubric, risk register', status: 'Closed — 8 units frozen; G1 approved in chat (testnet only), superseded by G1b', color: 'amber' },
  { id: '2', name: 'Skeleton + CI', scope: 'Layout, branded types, test harness, CI (mutation, SAST, SCA, SBOM, signing)', status: 'Built — Lens R round 4 deferred; cosign/SLSA pending hosted CI', color: 'amber' },
  { id: '3', name: 'Units, one per block', scope: 'U1–U15 (kit) / NOVA code units; each verified then frozen', status: 'D1 scope delivered + D2–D6 adapter cores — U1–U13 committed 2026-10-13 (2edde2f), the D2–D6 decision cores committed 2026-10-15 (035e950), every local gate green (2,979 tests); U14–U20, Nova-side wiring and the hosted-CI stages are post-D1 scope', color: 'emerald' },
  { id: '4', name: 'Perfecting loop', scope: 'Lens R → Lens A → Lens H on the assembled rail', status: 'Not started', color: 'slate' },
  { id: '5', name: 'Testnet demo + verdict', scope: 'End-to-end on Arc testnet, evidence pack, G3', status: 'Not started', color: 'slate' },
]

export const BUILD_STATUS = {
  changeOrder: 'CO-1 v3',
  milestone: 'D1 / M1 build + D2–D6 adapter-side decision cores',
  state: 'COMPLETE — built, verified, committed',
  commit: '035e950',
  branch: 'co1-v3/units-u4-u13',
  date: '2026-10-15',
  diff: 'D1: 2edde2f, 63 files, +5,757/−330 · D2–D6 cores: 035e950, 16 files, +1,316/−6',
  scope: 'U4–U13 (ingestion, registry, inbound, policy, compliance, signer, outbound, gas treasury, recon, audit) + the gateway custody split (F2c rail-view / F2d payment-view) + the U1 discipline sweep, on top of the D1 vertical slice merged at adacf00; plus the D2–D6 adapter-side decision cores (2026-10-15): deterministic CSV statement export, balance cross-check, ADR-006-A invoice matching + HMAC payment links, Directive 9 travel-rule tiers, HMAC-SHA256 signed outbound webhooks, and the gated Memo builder',
  gates: [
    'typecheck + build emit clean',
    'MC-01 money lint — 0 findings over the money-path files (incl. the new cores)',
    'rebrand rule — repository src/ clean (re-run green 2026-10-15)',
    '2,328 unit + 24 property + 480 contract + 8 demo = 2,840 green in the live 2026-10-15 run; + 139 rebrand pinning (full 2026-10-12, unchanged lint) = 2,979',
    '0 blocking defects at the verifier pass',
  ],
  remains: 'U14–U20, the hosted-CI stages (Stryker / Semgrep / OSV / SBOM / cosign), the ARC_E2E testnet run, Nova-side wiring for D2–D6 (wallets table, invoices table, HTTP server, live partners), and every human gate signature (D1 sign-off, G-P, G-M) — all deliberately outside this change order.',
}

export const GATES: GateRow[] = [
  { code: 'G0', group: 'G', title: 'Discovery reviewed', requirement: 'Phase 0 discovery reviewed', status: 'CHAT RECORD', detail: 'PASSED IN CHAT 2026-10-02 ("continue"). Phase 0 left unverified: the Lens R run was stopped before it reported.' },
  { code: 'G1', group: 'G', title: 'Spec, threat model, ADR decisions', requirement: 'Phase 1 design packet (docs/G1_PACKET.md)', status: 'CHAT RECORD', detail: 'APPROVED IN CHAT 2026-10-05, testnet only ("g1 is ago"). Sandbox options per ADR chosen; production choices deferred. Superseded by G1b.' },
  { code: 'G0b', group: 'G', title: 'Raayl evidence map reviewed', requirement: 'Existing Raayl components with file:line evidence, Arc risk questions (a)–(f), gap list', status: 'NOT SIGNED', detail: 'Replaced for now by the README plus Khumo\'s answers, marked unverified until the code is seen.' },
  { code: 'G1b', group: 'G', title: 'Raayl design packet', requirement: 'Interfaces, sequences D1–D6 with failure paths, STRIDE + LINDDUN, risk register, ADR recs, Probes G/F. Supersedes G1; unlocks the D1 build on a feature branch', status: 'NOT SIGNED', detail: 'The design work (NOVA_ARC_DESIGN.md) exists on branch co1-v3/nova-arc-d1, merged to main.' },
  { code: 'G2', group: 'G', title: 'Phase 2 skeleton', requirement: 'Skeleton Lens R zero blocking + cosign & SLSA provenance run in hosted CI (release-sign.yml)', status: 'CHAT RECORD', detail: 'Accepted in chat 2026-10-05 under standing auto-accept (round 3: 0 blocking, 6 minor). Precondition not met: cosign/SLSA still SKIPPED pending hosted CI.' },
  { code: 'G3', group: 'G', title: 'Testnet demonstration + verdict', requirement: 'Phase 5 end-to-end demo and evidence pack (docs/EVIDENCE_PACK.md)', status: 'NOT SIGNED', detail: 'Not started.' },
  { code: 'D1', group: 'D', title: 'M1: Arc + DFNS transfer on testnet', requirement: 'network abstraction, disabled mainnet config (CI test), DFNS ArcTestnet wallet + balance, policy-approved transfer + broadcast, own event detection, ledger postings incl. gas/dust, GET /payments/:id', status: 'NOT SIGNED', detail: 'The D1 code is built and verified: U1–U13 + the gateway custody split committed 2026-10-13 (2edde2f) and the D2–D6 cores added 2026-10-15 (035e950) — 2,979 tests green. Remaining for the gate: the ARC_E2E testnet run, the hosted-CI stages (Stryker/Semgrep/OSV/SBOM/signing) and the human sign-off. This Explorer is the interactive demo of the D1 semantics.' },
  { code: 'D2', group: 'D', title: 'M2: Business USDC wallet on Arc', requirement: 'wallets table + onboarding seeding (network = ARC), per-transfer deposit detection, balance-poller as cross-check, hold/send/history/export', status: 'NOT SIGNED', detail: 'Adapter-side built (035e950, 2026-10-15): per-transfer deposit detection with gas-never-netted crediting (U4/U6 path), holds via the CBS port, send via the payments orchestrator + signing gateway, history via HIST, deterministic CSV export core (7 tests) and the balance cross-check core (zero tolerance, 6 tests). Nova-side remains: the wallets table extension, onboarding seeding and the DFNS create-wallet call — outside this package by design (ports only).' },
  { code: 'D3', group: 'D', title: 'M3: Payment requests', requirement: 'invoices + network = ARC, unambiguous matching (per-invoice address or unique reference amount, ADR-006), payment link/QR, "Payment received" notification', status: 'NOT SIGNED', detail: 'Matching rule built (035e950): ADR-006 option A — one deposit address serves one OPEN invoice, allocation idempotence, defensive ambiguity refusal, match relations EXACT/BELOW/ABOVE (13 tests) + HMAC-signed expiring payment links with no PII in the URL; "payment received" notifications via the JTIME notifier (deduped). Nova-side remains: the invoices table, merchant routes and the QR rendering.' },
  { code: 'D4', group: 'D', title: 'M4: Business settlement', requirement: 'beneficiaries, screening (local blocklist + ADR-005 vendor), Directive 9 travel rule (full set, reduced below R5,000, zero threshold), DFNS approvals, outbound Memo with non-PII reference hash', status: 'NOT SIGNED', detail: 'Built in-package (035e950): encrypted beneficiary store (redaction, retention), local blocklist + fail-closed screening, DFNS maker-checker approvals, the Directive 9 tier decision — R5,000 boundary + zero threshold, fail-closed config (11 tests; field lists stay Compliance-owned, Q-R3), and the outbound Memo builder (round-trip verified, gated OFF until D4 is signed, 5 tests). Remaining: the ADR-005 vendor adapter and the field-set contents (human-owned Compliance decisions).' },
  { code: 'D5', group: 'D', title: 'M5: ZAR↔USDC', requirement: 'reuse fx-v2, otc-routes, buildConversionPostings; move USDC both ways between liquidity venue and DFNS Arc wallets; cross-border OFF until a legal opinion', status: 'NOT SIGNED', detail: 'Conversion checks, fill desk and cross-border OFF (four fail-closed layers, tests across policy/jpayout/jquote/jorch) are built over the ConversionPort/FxPort/PayoutPartnerPort seams; the partner payout path (ARRIVED only on the authenticated PAID callback) covers the us→venue direction with the CPN-shaped stub. Remaining: Nova\'s live fx/otc engine adapters and a LIVE liquidity partner (external participation agreements).' },
  { code: 'D6', group: 'D', title: 'M6: API', requirement: 'POST /api/v1/payments (Idempotency-Key required), GET /api/v1/payments/:id, signed outbound webhooks, decimal strings at the API edge', status: 'NOT SIGNED', detail: 'Both handlers built and fully tested (the pay-d1 matrix: 403/400/409/422/503/200/201, decimal strings at the edge); the signed outbound webhook dispatcher is a real core (035e950): HMAC-SHA256 over t.body, terminal-stage-only events, at-least-once with dedupe, bounded retry with DEAD paging, 4xx REFUSED (10 tests). Remaining: Nova\'s HTTP server wiring (the framework adapter) and the production transport.' },
  { code: 'D7', group: 'D', title: 'M7: Multi-chain', requirement: 'More network adapters (Base, Ethereum, others); CCTP and Gateway later', status: 'NOT SIGNED', detail: '' },
  { code: 'G-P 1', group: 'GP', title: 'Legal sign-off', requirement: 'Existing licences cover the pilot, including any cross-border element (proposed, for Compliance to confirm)', status: 'NOT SIGNED', detail: 'Pilot gates are proposals for Compliance to confirm. The agent cannot clear them.' },
  { code: 'G-P 2', group: 'GP', title: 'FIC registration / RMCP', requirement: 'FIC registration/RMCP covering the rail, with travel-rule handling for the pilot flows', status: 'NOT SIGNED', detail: '' },
  { code: 'G-P 3', group: 'GP', title: 'Focused security review', requirement: 'Gateway, signer and orchestrator', status: 'NOT SIGNED', detail: '' },
  { code: 'G-P 4', group: 'GP', title: 'DFNS mainnet setup + drill', requirement: 'Mainnet service accounts, policies and approvers set up by two people with a written record; key-compromise drill run', status: 'NOT SIGNED', detail: '' },
  { code: 'G-P 5', group: 'GP', title: 'Monitor + recon proven', requirement: 'Monitor and reconciliation proven on testnet (from the evidence pack)', status: 'NOT SIGNED', detail: '' },
  { code: 'G-P 6', group: 'GP', title: 'Rollback/pause drill', requirement: 'Rollback/pause drill run', status: 'NOT SIGNED', detail: '' },
  { code: 'G-M 1', group: 'GM', title: 'FSCA authorisation + FIC registration', requirement: 'FSCA authorisation covering the crypto-asset services offered (or a mandate under a licensed FSP), and FIC Item 22 registration plus an RMCP that includes this rail', status: 'NOT SIGNED', detail: 'Mainnet (chain 5042) stays disabled in code until G3, every G-P and every G-M gate is signed by named humans. A CI test fails if mainnet is reachable while any G-M gate is unsigned (MC-20).' },
  { code: 'G-M 2', group: 'GM', title: 'Travel-rule interop test', requirement: 'Tested with at least one counterparty CASP', status: 'NOT SIGNED', detail: '' },
  { code: 'G-M 3', group: 'GM', title: 'Exchange-control legal opinion', requirement: 'Legal opinion on exchange control for the planned flows', status: 'NOT SIGNED', detail: '' },
  { code: 'G-M 4', group: 'GM', title: 'Independent security review', requirement: 'Independent security review of the adapter (and audits of any contracts)', status: 'NOT SIGNED', detail: '' },
  { code: 'G-M 5', group: 'GM', title: 'Key ceremony + drills', requirement: 'Key ceremony completed, signing policy approved, and a key-compromise drill run', status: 'NOT SIGNED', detail: '' },
  { code: 'G-M 6', group: 'GM', title: 'Joint Standard 2 + POPIA PIA', requirement: 'Joint Standard 2 evidence, and a POPIA PIA covering every vendor', status: 'NOT SIGNED', detail: '' },
  { code: 'G-M 7', group: 'GM', title: 'Bank-partner sign-off', requirement: 'Bank-partner sign-off for the ZAR legs', status: 'NOT SIGNED', detail: '' },
  { code: 'G-M 8', group: 'GM', title: 'Staged rollout plan', requirement: 'Internal funds with low caps, then pilot merchants, then general availability', status: 'NOT SIGNED', detail: '' },
]

export const GATE_RULES = [
  'Only a named human may sign a gate. The agent can create and maintain GATES.md but never writes SIGNED-OFF (CLAUDE.md rule 6).',
  'A signature counts only if its line comes from a commit authored and cryptographically signed by that human, with no agent co-author, and the signing key is anchored outside this repository (RUBRIC MC-42).',
  '"PASSED IN CHAT" and "APPROVED IN CHAT" record what the operator said and when; such a gate is still NOT SIGNED until the signer\'s own signed commit lands.',
  'Mainnet needs G3, then every G-P gate, then every G-M gate. The code check (REQUIRED_MAINNET_GATES) currently reads G-M 1–8 only — a TODO requires adding G-P and G3 rows before mainnet is ever enabled.',
]

export const ADRS: AdrRow[] = [
  {
    id: 'ADR-001', title: 'Custody and signing',
    options: ['A. HSM self-custody (FIPS 140-3 L3) + in-house policy engine', 'B. Regulated custodian + on-prem co-signer', 'C. Hybrid: custodian cold + HSM hot'],
    recommendation: 'A if the bank already runs L3 HSMs with key ceremony; else B if Q-D1(a)–(g) are all yes. Testnet: signer service with a throwaway key (MockSigner). Six signer duties are enforced at the signing boundary.',
  },
  {
    id: 'ADR-002', title: 'Chain access: own nodes + independent reference',
    options: ['A. 1 own node + reference RPC', 'B. 2 own nodes (separate hosts/relays) + reference', 'C. Provider-only'],
    recommendation: 'Testnet A (reference: QuickNode testnet); pilot/GA B (independent non-relay reference, CF-20). Address-filtered reads only to own nodes; stall = both sources silent.',
  },
  {
    id: 'ADR-003', title: 'Orchestration (durable execution)',
    options: ['A. CBS workflow/saga engine', 'B. Self-hosted durable engine (Temporal)', 'C. DB state machine: outbox + persisted state + scheduler'],
    recommendation: 'C — all phases; pure transition function, per-wallet nonce row lock. Re-assess A once the CBS is known (Q-C1); B only if flow types grow.',
  },
  {
    id: 'ADR-004', title: 'Travel rule (FIC Directive 9) interoperability',
    options: ['A. Commercial TR network/provider', 'B. Self-hosted open protocol node', 'C. Bilateral manual exchange for pilot'],
    recommendation: 'No provider recommendation until Q-R3/Q-D5. Fixed rule: signing is blocked until travel-rule COMPLETE; payload by reference only; counterparty acknowledgement assessed for hosted CASPs.',
  },
  {
    id: 'ADR-005', title: 'On-chain address screening',
    options: ['A. External analytics API', 'B. Self-hosted list matching (sanctions lists + Circle blocklist mirror)', 'C. A + B'],
    recommendation: 'C: B is the hard deterministic gate (always on, offline); A feeds REVIEW, never CLEAR. Verdict mapping is Compliance-owned versioned config; fail closed → REVIEW.',
  },
  {
    id: 'ADR-006', title: 'Deposit address model',
    options: ['A. Per-merchant address', 'B. Per-payment/invoice address', 'C. Shared + Memo', 'D. Shared + known sender'],
    recommendation: 'A for the pilot (B optional later for e-commerce; C/D not recommended). Outbound Memo allowed only as a random 32-byte memoId, never identifier-derived.',
  },
  {
    id: 'ADR-007', title: 'Language and stack',
    options: ['A. TypeScript (strict) + Node + viem', 'B. Rust + alloy', 'C. Kotlin/JVM + web3j', 'D. Go + go-ethereum'],
    recommendation: 'C if the CBS team is JVM-centric, otherwise A (TypeScript + viem). The repo is TypeScript + viem 2.56.9 (the only runtime dependency).',
  },
  {
    id: 'ADR-008', title: 'Independent monitor',
    options: ['A. Monitor inside adapter', 'B. Independent monitor, signer-enforced attestation', 'C. Independent, alerts only', 'D. B + pre-sign co-attestation'],
    recommendation: 'B — separate trust domain; an ALL_CLEAR attestation the signer requires (~120 s fabricated-payout window, ~16 min unposted-payout window, bounded by signer limits). Consider D if Risk wants prevention.',
  },
]

export const ADRS_PLANNED = [
  'ADR-009 liquidity (existing OTC/VALR; StableFX later)', 'ADR-010 network abstraction', 'ADR-011 notifications/webhooks',
  'ADR-012 rand pay-in method (Arc Onramp widget rejected)', 'ADR-013 status mapping (src/status/index.ts is its input)',
]

export const VERIFICATION_LOOP = {
  lenses: [
    { id: 'Lens R', who: 'verifier subagent (fresh context)', what: 'Reconstruction — recompute, re-trace, re-fetch checkable properties; file:line evidence for every finding', verdicts: 'blocking / minor / POSITIVE' },
    { id: 'Lens A', who: 'verifier subagent (fresh context)', what: 'Judgment lenses (JL-1…JL-6) applied to the whole unit' },
    { id: 'Lens H', who: 'cold-reader subagent (sees only docs/MISSION.md + target)', what: 'Honesty lens — can a cold reader rebuild the intent from the record?' },
  ],
  rules: [
    'Generation blocks and verification blocks are separate and labelled; a block does exactly one job.',
    'After every generation block, delegate verification to a fresh-context verifier. Never verify your own block inline.',
    'Exit only after 3 consecutive POSITIVE passes. Cap 10 rounds, plus 2 grace rounds; regeneration budget 3.',
    'Plateau ladder: reframe → regenerate → structural mark.',
    'Unit freeze rule (operator 2026-10-05): zero blocking defects → freeze; minors go to the G1 packet for a human to accept.',
  ],
}

export const RUBRIC: RubricItem[] = [
  { id: 'MC-01', group: 'Money correctness', text: 'No floating-point type or operation on any money path. Type-aware lint + Semgrep layer with 17 planted floats as a self-test.' },
  { id: 'MC-02', group: 'Money correctness', text: 'Mixing CbsMinor, UsdcUnits, NativeWei fails to compile — compile-fail tests per forbidden pair (@ts-expect-error with tagged error codes).' },
  { id: 'MC-03', group: 'Money correctness', text: 'Exactly one conversion module; remainders are returned, never dropped (FLOOR_REMAINDER_RETURNED).' },
  { id: 'MC-04', group: 'Money correctness', text: 'Every template balances per unit; CBS identity holds; re-trace on re-entry after partial movement.' },
  { id: 'MC-05', group: 'Money correctness', text: 'Reconciliation residual exactly 0 wei in every state×outcome cell of the CONTRACT §5 flows and F1–F7; drift cells must assert non-zero + PAUSE.' },
  { id: 'MC-06', group: 'Money correctness', text: 'Precision p comes from the CBS; mismatch PAUSEs before posting; known-amount onboarding test.' },
  { id: 'MC-07', group: 'Money correctness', text: '100% reachable-branch coverage on money-path modules (docs/MONEY_PATH.md).' },
  { id: 'MC-08', group: 'Money correctness', text: 'Mutation score ≥ 90% on money-path modules (Stryker, break threshold 90).' },
  { id: 'MC-11', group: 'Exactly-once & fail-closed', text: 'Every state has an action for every outcome from every source — the alphabet is derived from CONTRACT, including interleavings; no dead-end resolution paths.' },
  { id: 'MC-12', group: 'Exactly-once & fail-closed', text: 'Every wait state has a maximum age with a fail-closed expiry.' },
  { id: 'MC-15', group: 'Exactly-once & fail-closed', text: 'Credit only from the system emitter (C-20); dedupe on (chainId, txHash, logIndex).' },
  { id: 'MC-16', group: 'Exactly-once & fail-closed', text: 'Log paging ≤ 9,999 blocks; −32012 split; −32602 bisection; unknown error stops ingestion; −32014 retry; −32603 classified exactly.' },
  { id: 'MC-17', group: 'Exactly-once & fail-closed', text: 'Every bank→external/bank→bank transfer matches exactly one instruction or move by content, plus one signing-log entry; CBS postings bind account+amount to the CBS record.' },
  { id: 'MC-19', group: 'Exactly-once & fail-closed', text: 'Unpause needs two distinct authenticated humans.' },
  { id: 'MC-20', group: 'Chain, signing & gates', text: 'CI test fails if mainnet config is reachable while any G-M gate is unsigned.' },
  { id: 'MC-23', group: 'Chain, signing & gates', text: 'Signer shape allow-list — only EIP-1559 type-2, chain ID 5042002, allow-listed to, empty data; refuse EIP-712/3009/7702/approve/deploys/other chain IDs.' },
  { id: 'MC-24', group: 'Chain, signing & gates', text: 'Signer verifies checkerAssertion over the 32 raw bytes of payloadDigest, plus a durable consumed-approval record (replay).' },
  { id: 'MC-30', group: 'Privacy & security', text: 'No PII and no address↔customer link in logs, traces or metrics.' },
  { id: 'MC-33', group: 'Privacy & security', text: '0 high/critical SAST/SCA/gitleaks findings; SBOM (CycloneDX); cosign + SLSA provenance in CI.' },
  { id: 'MC-34', group: 'Privacy & security', text: 'No LLM or agent in the money path; egress allow-list only.' },
  { id: 'MC-40', group: 'Evidence & honesty', text: 'Every [R] detection names one concrete mutant; the executor sits outside the compromise domain; fail-closed action specified.' },
  { id: 'MC-42', group: 'Evidence & honesty', text: 'Compliance statuses are NOT STARTED / IMPLEMENTED / EVIDENCED / UNVERIFIED, and SIGNED-OFF only by a named human with git provenance (GPG/SSH-signed commit, no agent co-author).' },
  { id: 'MC-43', group: 'Evidence & honesty', text: 'Every regulatory statement is quoted from a primary source resolving via MANIFEST to a hashed archive.' },
]

export const RUBRIC_META = {
  mechanical: '38 mechanical checks (MC-01…MC-48, intentional numbering gaps) in 5 groups',
  judgment: 'JL-1…JL-6 judgment lenses',
  lenses: [
    { id: 'JL-1', name: 'Fail-closed', text: 'When unsure, does money stop and does a human get paged?' },
    { id: 'JL-2', name: 'Human-owned decisions', text: 'Are sign-offs, approvals and compliance decisions owned by named humans?' },
    { id: 'JL-3', name: '03:00 operability', text: 'Can a tired operator at 3 a.m. do the right thing with this design?' },
    { id: 'JL-4', name: 'Auditability', text: 'Is every number traceable to a chain fact, a key, or a human decision?' },
    { id: 'JL-5', name: 'Fewest new parts', text: 'Does this add the minimum number of new components?' },
    { id: 'JL-6', name: 'Privacy by default', text: 'Is personal information minimised and kept off-chain by default?' },
  ],
}

export const CI_STAGES = [
  { n: 0, name: 'Toolchain & tool integrity', detail: 'node --version; install-tools-phase2.sh; checksum-verified tools' },
  { n: 1, name: 'Install', detail: 'npm ci --ignore-scripts — exactly what package-lock.json pins (integrity hashes)' },
  { n: 2, name: 'Build', detail: 'tsc --noEmit + emit dist/ via tsconfig.build.json (incl. the MC-02 compile-fail file)' },
  { n: 3, name: 'Test', detail: 'vitest run — unit + property + contract; e2e only when ARC_E2E=1' },
  { n: 4, name: 'Coverage', detail: 'MC-07: 100% reachable-branch coverage per money-path file' },
  { n: 5, name: 'Lint', detail: 'MC-01 type-aware float lint (tools/lint-money-floats.mjs)' },
  { n: 6, name: 'SAST', detail: 'Semgrep (vendored rules) + MC-01 Semgrep layer with 17 planted floats as self-test' },
  { n: 7, name: 'SCA', detail: 'osv-scanner offline DB (fails HIGH/CRITICAL/unknown; known-CRITICAL self-test)' },
  { n: 8, name: 'Mutation', detail: 'Stryker, break threshold 90 (MC-08)' },
  { n: 9, name: 'Secrets', detail: 'gitleaks --no-git --redact' },
  { n: 10, name: 'SBOM', detail: 'CycloneDX 1.6, runtime deps, SHA-512 distribution hash per component' },
  { n: 11, name: 'Signing / provenance', detail: 'cosign + SLSA SKIPPED locally (delegated to release-sign.yml keyless GitHub OIDC); fails if the tools appear on local PATH while unwired' },
  { n: 12, name: 'G2 precondition', detail: 'tools/g2-precondition.mjs — a signed G2 row must cite a hosted release-sign run URL' },
]

export const UNIT_LEDGER = [
  { unit: 'P0-guardrails / tooling / constants / port-reqs / open-questions', status: 'draft', note: 'Phase 0 run stopped by operator; unverified' },
  { unit: 'P1-contract (CONTRACT.md v3 fix J)', status: 'FROZEN 2026-10-05', note: '14 verifier rounds, zero blocking' },
  { unit: 'P1-adrs (ADR-001…007)', status: 'FROZEN 2026-10-05', note: '15 rounds' },
  { unit: 'P1-adr-008', status: 'FROZEN 2026-10-05', note: '8 rounds' },
  { unit: 'P1-sequences (S1–S5, F1–F7)', status: 'FROZEN 2026-10-05', note: '' },
  { unit: 'P1-threat-model', status: 'FROZEN 2026-10-05', note: '14 rounds' },
  { unit: 'P1-risk-register', status: 'FROZEN 2026-10-05', note: '11 rounds' },
  { unit: 'P1-rubric', status: 'FROZEN 2026-10-05', note: 'first POSITIVE at round 15; 12 fix blocks' },
  { unit: 'P2-skeleton', status: 'built', note: 'Lens R round 4 deferred; cosign/SLSA pending hosted CI' },
  { unit: 'P3-U1 (src/amounts)', status: 'FROZEN 2026-10-06', note: '' },
  { unit: 'P3-NOVA D1 slice (chain · net · ports · journey · pay · ops · http · status)', status: 'FROZEN 2026-10-07', note: 'PR #1 (adacf00) merged after human review: D1 design (NOVA_ARC_DESIGN.md) + the vertical-slice modules' },
  { unit: 'P3-U4–U13 + gateway custody split (F2c/F2d/PAY rail port) + U1 sweep', status: 'FROZEN 2026-10-13', note: 'Commit 2edde2f on co1-v3/units-u4-u13 (63 files, +5,757/−330). Verifier pass green: tsc + build emit + MC-01 0 findings + rebrand repo-clean + unit 2,272 + property 24 + contract 480 + demo 8; pinning 139/139 (2026-10-12, byte-identical tree). Also fixes the TS2345 present at main HEAD.' },
  { unit: 'P3-D2–D6 adapter-side decision cores', status: 'FROZEN 2026-10-15', note: 'Commit 035e950 (16 files, +1,316/−6): history export, balance cross-check, invoice matching + payment links, travel-rule tiers, signed webhooks, gated memo builder + GATES evidence notes, MONEY_PATH rows, Stryker scope. Audit-verified: three test-side inconsistencies found and fixed before the commit; tsc + build + MC-01 + rebrand repo-clean + unit 2,328 (69 files) + property 24 + contract 480 + demo 8 green; pinning 139 cited 2026-10-12 (unchanged lint), repo-clean invariant re-run green 2026-10-15.' },
]

export const BUILD_UNITS = [
  'U1 Amount/currency types', 'U2 Chain config', 'U3 Chain client', 'U4 Ingestion', 'U5 Address registry',
  'U6 Inbound deposit→CBS', 'U7 Policy engine', 'U8 Compliance hooks', 'U9 Signer', 'U10 Transfer orchestrator',
  'U11 Gas treasury', 'U12 Reconciliation & circuit breaker', 'U13 Audit & observability', 'U14 Exchange-control data',
  'U15 Runbooks', 'U16 Communications', 'U17 Rand pay-in', 'U18 Quote/RFQ', 'U19 Payout routes', 'U20 Pilot profile (built disabled)',
]

export const NOVA_UNITS = [
  { unit: 'AMOUNTS (U1)', detail: 'Branded CbsMinor, UsdcUnits, NativeWei, FiatMinor<CCY>; the only conversion module' },
  { unit: 'CHAIN (U2/U3)', detail: 'Config with the mainnet gate; chain client skeleton' },
  { unit: 'NET', detail: 'Indexer + Arc adapter + fake network (agnosticism tested)' },
  { unit: 'PORTS', detail: 'nova-ports: ledger, payment-store, wallet-registry, receiver, conversion, payout, gas-dust, ids' },
  { unit: 'INGESTION (U4) · REGISTRY (U5) · INBOUND (U6)', detail: 'Classification, dedupe, canonical source, PII-protected registry' },
  { unit: 'POLICY (U7) · COMPLIANCE (U8) · SIGNER (U9) · GATEWAY (F2)', detail: 'Deterministic policy; compliance hooks; signer duties; signing gateway checks' },
  { unit: 'OUTBOUND (U10) · GAS (U11) · RECON (U12) · AUDIT (U13)', detail: 'Orchestrator, gas/dust, three-way reconciliation, hash-chained audit' },
  { unit: 'CBS', detail: 'Anti-corruption layer: port, events, result model, keys, translator (T-templates)' },
  { unit: 'DFNS (F0–F3)', detail: 'Money-safe JSON, client, types, webhook verifier + fakes (simulator, recorded)' },
  { unit: 'JPAYIN · JQUOTE · JPARTNER · JPAYOUT · JTIME · JORCH', detail: 'Journey: pay-in, quote/fill desk, payout partner, timeline, orchestrator' },
  { unit: 'PAY · OPS · HIST · HTTP · STATUS', detail: 'D1 payment unit, ops console, client history, API handlers, status model' },
]
