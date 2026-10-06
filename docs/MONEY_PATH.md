# MONEY_PATH: source paths of the RUBRIC money-path modules

This file maps the RUBRIC closed money-path list (docs/RUBRIC.md, "Money-path modules", items 1–10) to source paths. MC-01 (float lint), MC-07 (100% reachable-branch coverage) and MC-08 (mutation ≥ 90%) apply to exactly the paths in the "Listed paths" table.

**Machine-read.** `test/unit/money-path.test.ts` parses the three tables below and fails CI if any of these holds:
- a listed path or anchor symbol is missing from the source;
- an item 1–10 has no path;
- `stryker.config.json` `mutate`, the coverage `include` in `vitest.config.ts` or the MC-01 lint (`tools/lint-money-floats.mjs`) don't cover exactly the listed paths;
- the import-graph closure of the listed paths reaches a module that is neither listed nor excluded;
- an excluded module is reached through a runtime import. Under `verbatimModuleSyntax`, only `import type` and `export type` are type-only. `import { type X }`, side-effect imports, `import()` and `require()` are runtime;
- a "Number allow-list" row doesn't name a declaration in a listed path. The MC-01 lint reads that table.

Edit the tables only through a LEDGER entry. The RUBRIC list itself can only grow (RUBRIC, "Money-path modules").

Status: Phase 2 skeleton. Most paths hold interfaces and `not implemented: <unit>` stubs. Each anchor below names the symbol where the part is implemented when its unit is generated.

## Listed paths

| Path | Item | Unit |
|---|---|---|
| `src/amounts/index.ts` | 1 | U1 amounts and the conversion module |
| `src/ingestion/index.ts` | 2 | U4 credit decision logic |
| `src/inbound/index.ts` | 3 | U6 inbound flow |
| `src/signer/index.ts` | 4 | U9 signer policy |
| `src/policy/index.ts` | 5 | U7 policy engine |
| `src/chain/client/index.ts` | 6 | U3 chain client |
| `src/outbound/index.ts` | 7 | U10 outbound and case-return orchestrator |
| `src/gas/index.ts` | 8 | U11 gas and dust accumulators and fee calculation |
| `src/recon/index.ts` | 9 | U12 reconciliation and circuit breaker |
| `src/cbs/translator.ts` | 10 | ACL posting translator |
| `src/cbs/port.ts` | 10 | CBS port request and response shapes the translator sends (CONTRACT §3) |
| `src/cbs/result.ts` | 10 | CONTRACT §1.4 result model, REJECTED codes and AMBIGUOUS output |
| `src/cbs/keys.ts` | 10 | CONTRACT §1.3 idempotency keys that every translator call carries |

## Named parts

Every named part of every item maps to at least one listed path and an anchor symbol in that path.

| Item | Named part | Path | Anchor |
|---|---|---|---|
| 1 | branded amount types | `src/amounts/index.ts` | `CbsMinor` |
| 1 | conversion module (CONTRACT §6) | `src/amounts/index.ts` | `nativeWeiToCbsMinor` |
| 2 | classification (CONTRACT §5.0) | `src/ingestion/index.ts` | `LogClass` |
| 2 | dedupe on (chainId, txHash, logIndex) | `src/ingestion/index.ts` | `LogId` |
| 2 | canonical source (system emitter, C-20) | `src/ingestion/index.ts` | `CanonicalTransfer` |
| 3 | inbound flow (CONTRACT §5.3) | `src/inbound/index.ts` | `InboundFlow` |
| 4 | ADR-001 duty 1: approval and assertion check | `src/signer/index.ts` | `ApprovalEvidence` |
| 4 | ADR-001 duty 2: shape allow-list | `src/signer/index.ts` | `Eip1559ValueSend` |
| 4 | ADR-001 duty 3: limits and fee ceilings with the chain-ID pin | `src/signer/index.ts` | `FEE_CEILING` |
| 4 | ADR-001 duty 4: consumed-approval replay record | `src/signer/index.ts` | `APPROVAL_REPLAYED` |
| 4 | ADR-001 duty 5: monitor-attestation protocol | `src/signer/index.ts` | `MonitorAttestation` |
| 4 | ADR-001 duty 6: internal-move rule | `src/signer/index.ts` | `MOVE_NOT_ON_TREASURY_LIST` |
| 4 | signed-configuration load | `src/signer/index.ts` | `CONFIG_UNSIGNED` |
| 4 | signing-log writer | `src/signer/index.ts` | `SigningLogEntry` |
| 5 | limits and thresholds | `src/policy/index.ts` | `PER_TX_LIMIT` |
| 5 | velocity | `src/policy/index.ts` | `VELOCITY` |
| 5 | allow-lists | `src/policy/index.ts` | `DESTINATION_NOT_ALLOWED` |
| 5 | cross-border flag | `src/policy/index.ts` | `CROSS_BORDER_DISABLED` |
| 6 | quorum and disagreement detection | `src/chain/client/index.ts` | `DISAGREEMENT` |
| 6 | log paging (C-40) | `src/chain/client/index.ts` | `pageBlockRange` |
| 7 | outbound orchestrator (CONTRACT §5.4) | `src/outbound/index.ts` | `OutboundOrchestrator` |
| 7 | case-return orchestrator (CONTRACT §5.5) | `src/outbound/index.ts` | `CaseReturnState` |
| 7 | nonce writer | `src/outbound/index.ts` | `NonceWriter` |
| 8 | gas and dust accumulators (CONTRACT §5.7) | `src/gas/index.ts` | `Accumulators` |
| 8 | fee calculation (C-25) | `src/gas/index.ts` | `receiptFeeWei` |
| 9 | reconciliation | `src/recon/index.ts` | `Reconciler` |
| 9 | circuit breaker | `src/recon/index.ts` | `CircuitBreaker` |
| 10 | `postJournal` and the §5.1 templates | `src/cbs/translator.ts` | `buildLegs` |
| 10 | `postJournal` request shape and refs | `src/cbs/port.ts` | `JournalRefs` |
| 10 | hold operation `placeHold` | `src/cbs/translator.ts` | `placeHold` |
| 10 | hold operation `settleHold` | `src/cbs/translator.ts` | `settleHold` |
| 10 | hold operation `releaseHold` | `src/cbs/translator.ts` | `releaseHold` |
| 10 | `getResultByKey` | `src/cbs/translator.ts` | `getResultByKey` |
| 10 | AMBIGUOUS resolution (CONTRACT §1.4) | `src/cbs/translator.ts` | `resolveAmbiguous` |
| 10 | AMBIGUOUS output and REJECTED codes | `src/cbs/result.ts` | `ResolvedResult` |
| 10 | idempotency keys (CONTRACT §1.3) | `src/cbs/keys.ts` | `deriveKey` |

## Excluded from the import-graph closure

These modules are reached from listed paths through `import type` only. Type-only imports are erased at compile time, so no code of theirs runs on a money path today. The test fails as soon as a listed path imports one of them at runtime, and that forces a LEDGER decision: list it, or keep it out with a new reason.

| Path | Reached from | Reason |
|---|---|---|
| `src/chain/config/index.ts` | signer, policy, outbound, ingestion, chain client, registry (`Address`, `Hex32`) | Types only. U2's own controls cover its values and gate logic: MC-21 (constants cited and re-derived) and MC-20 (mainnet gate tests). |
| `src/registry/index.ts` | gas, outbound, policy, cbs/port, cbs/keys (`WalletRole`, `AccountRef`) | Types only. U5 is not in the RUBRIC list. Re-decide in a LEDGER entry when U5 lands and a listed path calls it at runtime. |

## Number allow-list

RUBRIC MC-01 "grep for float types": on a listed path, the `number` type may appear only on the declarations named here, each as (declaring file, declaration identity). The identity names one declaration node, not a name: `Name` (a top-level declaration), `Outer.member` (a member of a top-level interface, class or type alias) or `fn(i)` (parameter i, 0-based, of top-level function `fn`). Locals have no identity and can never be listed. Each row must resolve to exactly one declaration, or the lint fails. A listed type alias is a brand: a value whose type is exactly that alias is exempt too, and only an allowed value may be asserted to it. Only these may be number operands of an operator or of `BigInt(...)`, and no amount ever may. The lint `tools/lint-money-floats.mjs` enforces this. Grow this table only through a LEDGER entry.

| Path | Declaration | Meaning |
|---|---|---|
| `src/amounts/index.ts` | `CbsPrecision` | The CBS precision p, in decimal places (CONTRACT §1.1, Q-C4), as a brand. Not an amount. Every `p: CbsPrecision` parameter of the conversion functions is covered by the brand. |
| `src/amounts/index.ts` | `cbsPrecision(0)` | The raw p argument of the checked constructor `cbsPrecision`. |
| `src/amounts/index.ts` | `cbsPrecision` | The checked constructor of p. It returns `CbsPrecision`. |
| `src/signer/index.ts` | `Eip1559ValueSend.chainId` | The EIP-155 chain-ID pin, 5042002 (C-01, C-56). |
| `src/chain/client/index.ts` | `ChainReader.chainId` | The chain ID of the reader, 5042002 (C-01). |
| `src/chain/client/index.ts` | `ReadResult.code` | A JSON-RPC error code, for example −32012, −32014 or −32602 (C-40, C-41, C-42). |
