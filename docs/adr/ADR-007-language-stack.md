# ADR-007 Language and stack

**Status: PROPOSED. A human decides at G1.** KICKOFF: "match the CBS unless there is a reason not to; viem if TypeScript". No CBS has been chosen (Q-C1), so there is no stack to match yet.

## What the stack must support (from CLAUDE.md, KICKOFF §3 and §6)
1. **Branded integer amount types** that make mixing `CbsMinor`, `UsdcUnits` and `NativeWei` a **compile error** (CLAUDE.md). Arbitrary-precision integers (CONTRACT §6 overflow guard).
2. Property-based testing, mutation testing with at least 90% score on money modules, and 100% branch coverage.
3. A mature Ethereum client library for EIP-1559 transactions, logs and receipts. Arc-specific differences are in C-10 to C-68 (notably C-57 the `-32603 "Blocked address"` simulation error, and C-62 to C-67 Memo, Multicall3From, Permit2, EIP-7702 and EIP-3009).
4. A SAST rule set (Semgrep) and SCA scanning (osv-scanner/Trivy), plus CycloneDX SBOM generation.
5. Being able to forbid floats in money code by lint or by type.

## Options

| | A. TypeScript (strict) on Node LTS + viem | B. Rust + alloy | C. Kotlin/JVM + web3j | D. Go + go-ethereum |
|---|---|---|---|---|
| Branded amounts | Nominal brands over `bigint`. Compile-time only, so runtime checks are needed at the boundary | Newtypes, zero cost, strongest | Value classes over `BigInteger` | Named types over `*big.Int`. Weaker: arithmetic needs explicit methods |
| Float ban | Lint rule (`number` banned in money modules). `bigint` and `number` can't be mixed implicitly | Clippy lints. Strong | Detekt or lint. `Double` must be banned | Vet or lint |
| Property testing | fast-check | proptest | jqwik / Kotest | rapid / gopter |
| Mutation testing | Stryker | cargo-mutants | PIT (mature) | go-mutesting (less mature) |
| Ethereum library | viem: the Arc docs show viem and ethers examples (https://docs.arc.io/integrate/exchanges/withdrawals.md, accessed 2026-10-02) | alloy: Arc's node is Reth-based (https://docs.arc.io/llms.txt, accessed 2026-10-02) | web3j | go-ethereum |
| Fit with a typical bank CBS team | Medium | Low (hiring) | **High** where the CBS is JVM-based | Medium |
| Supply chain surface | Large (npm) | Medium | Medium | Small |

## Recommendation (for the human)
- **If the CBS integration team is JVM-centric, C (Kotlin).** This follows KICKOFF's "match the CBS".
- **Otherwise, A (TypeScript + viem).** KICKOFF names viem, and it is the best-documented client for Arc.

### Recommendation by phase
The stack is **the same in all phases**. Changing language between testnet and mainnet would invalidate the testnet evidence. The choice is made once, at G1.

A has one known weakness: a TypeScript brand exists only at compile time, so U1 must validate units at every I/O boundary. It also has the largest npm supply-chain exposure, which is mitigated by hash-pinning, SCA and SBOM (Phase 2). **This ADR blocks Phase 2**, which can't start until the language is chosen.
