# Phase 2 testnet slice: plan (starts only after G1 is signed)

**Status: PLAN.** The operator chose "testnet slice after G1" on 2026-10-05 (LEDGER). Nothing here runs before G1 is signed. **Testnet only** (chain ID 5042002). Mainnet is configured as *disabled* and guarded by a gate check (KICKOFF U2, RUBRIC MC-20).

## Goal by 16:00 SAST
A working, tested **inbound vertical slice** on Arc testnet against a stand-in CBS:

> a USDC transfer to a test collection address on Arc testnet is detected from the canonical system-emitter log, deduplicated, converted with the single conversion module, and posted to the CBS stub as T1 then T2 under deterministic idempotency keys, with reconciliation residual 0 and every failure path failing closed.

Plus the outbound path up to signing with `MockSigner` against a **local** Arc Foundry anvil (no testnet funds needed), and the monitor's attestation check in the signer.

## Stack (ADR-007 A)
TypeScript (strict), viem, vitest + fast-check (property tests), Stryker (mutation), Node.js v22.23.3 from `.tools/node` (checksum-verified). Every dependency pinned by version **and** integrity hash in the lockfile.

## Units in the slice (KICKOFF Phase 3 numbering)
| Unit | Slice scope | Key tests |
|---|---|---|
| Skeleton | Module layout, branded types, interfaces (CBS port per CONTRACT §3, `Signer`, chain client), test harness, CI script (build, test, mutation on money modules, gitleaks, osv-scanner, SBOM). cosign and SLSA are stubbed with a TODO for G2 | Build and test green |
| U1 Amounts | `CbsMinor`, `UsdcUnits`, `NativeWei` brands; the single conversion module (k = 10^(18−p), m = ⌊W/k⌋, dust = W mod k); asset registry | Property tests: round trip, boundaries (CONTRACT §6.1 rows), dust; compile-fail tests for type mixing |
| U2 Chain config | Testnet config from cited constants (C-01, C-20, C-22, C-30, C-40); mainnet entry disabled behind a GATES.md check | Test fails if mainnet is reachable while any G-M gate is unsigned |
| U3 Chain client (reads) | Log paging ≤ 9,999 blocks, `-32012` split, `-32014` retry with jitter, unknown error → stop | Fault-injection tests |
| U4 Ingestion | Canonical credit from the system-emitter Transfer log (C-20), dedupe on (chainId, txHash, logIndex), ERC-20 log for cross-check only | Two-log fixture → exactly one credit; live testnet read of a real transfer |
| U6 Inbound | Detection commit, T1, screening stub, standing stub, T2/T8/unid, keys per CONTRACT §1.3, result model §1.4 | Every §5.3 row with residual 0, or PAUSE for drift cells |
| U9 Signer | `Signer` interface, `MockSigner` with a throwaway key generated at test time; shape allow-list; fee limits; attestation check | Refusal fixtures (MC-23, MC-24); stale or PAUSE attestation → refuse |
| CBS stub | In-memory CBS implementing the CONTRACT §3 operations used by the slice, with `BINDING_MISMATCH` | Contract tests |

## Explicitly out of the slice (later sessions)
U5 encryption, U7 policy engine beyond limits, U8 real screening and travel-rule integrations, U10 full outbound orchestration on testnet (needs testnet funds, Q-T2), U11–U15, the independent monitor service itself (only its attestation is simulated), cosign and SLSA provenance, independent security review. These are listed in the evidence notes at the end of the session, never implied done.

## Verification
Every unit gets a fresh verifier pass (Lens R) against this plan, CONTRACT v3 and RUBRIC v2. The slice is reported with its test, mutation and coverage numbers exactly as measured.
