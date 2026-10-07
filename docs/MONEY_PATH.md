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
| `src/nova-ports/ids.ts` | 10 | PORTS Nova ports: identifiers, idempotency keys and the OK/REJECTED/AMBIGUOUS result model (NOVA_ARC_DESIGN §7.1) |
| `src/nova-ports/ledger.ts` | 10 | PORTS LedgerPort shapes and the one journal decision: §7.2 template ids, rail-level refs, balance, P7 mirror of P2/P2I/P3 only, P6 mirror of the payment's own P1 and released once (after P2R or P11 when P2P is posted), account totals and customer funds (NOVA_ARC_DESIGN §7.2, §9) |
| `src/nova-ports/wallet-registry.ts` | 10 | PORTS WalletRegistryPort shapes and registration decision, ArcTestnet only (NOVA_ARC_DESIGN §7.4) |
| `src/nova-ports/receiver.ts` | 10 | PORTS ReceiverPort: the receiver's chosen payout method and destination (NOVA_ARC_DESIGN §7.5a) |
| `src/nova-ports/payment-store.ts` | 7 | PORTS PaymentStorePort: payment working state, one inbox for signals, ranges and claims, submit marker, DFNS hash link, leg order, P6 only with a posted P1, the F-17 close (P6 with P11 or P2R) and Ops cases, REVERSED only via the P7 of P2/P2I (NOVA_ARC_DESIGN §7.3, §6.5, §8.4 check 3, §9.2, §12 F-17) |
| `src/status/index.ts` | 7 | PORTS status model: stage, stage → TransactionStatus table, §7.3 failure reasons, transitions with evidence and DFNS request state (NOVA_ARC_DESIGN §13) |
| `src/status/journey.ts` | 7 | PORTS journey: payer's pay-in choice × receiver's payout choice → legs (NOVA_ARC_DESIGN §4.1) |
| `src/nova-ports/gas-dust.ts` | 8 | PORTS GasDustStore: the 18-dp gas-dust and receipt-dust sub-ledger (P4D, P5, P9D), exact U1 splits, sweep decision (NOVA_ARC_DESIGN §7.3, §9.2) |
| `src/nova-ports/conversion.ts` | 10 | PORTS ConversionPort shapes (Nova's fiat↔USDC engine, the payer's fiat choice) and the exact integer quote check (NOVA_ARC_DESIGN §7.5) |
| `src/nova-ports/payout.ts` | 10 | PORTS PayoutPartnerPort shapes (the receiver's fiat choice), payout dedupe key (NOVA_ARC_DESIGN §7.5, §10.3) |
| `src/network/types.ts` | 6 | NET Network port: NetworkAdapter, ConfirmedTransfer, NetworkFailure, address/key/DFNS-amount helpers (NOVA_ARC_DESIGN §5.1) |
| `src/network/arc/params.ts` | 6 | NET Arc network parameter shape (types only; values built in `src/network/arc/config.ts` from U2) |
| `src/network/arc/adapter.ts` | 6 | NET ArcNetworkAdapter: Arc precheck, exact U1 amount, DFNS Native body (NOVA_ARC_DESIGN §5.2, §8.4 check 6, §8.5) |
| `src/indexer/rpc.ts` | 6 | NET indexer RPC source port and timing port (types only) |
| `src/indexer/fetch.ts` | 6 | NET indexer paging (C-40), split on -32012/-32602, -32014 backoff, stop on unknown errors (NOVA_ARC_DESIGN §6.2) |
| `src/indexer/indexer.ts` | 6 | NET Arc event indexer: two-source agreement, stall, exactly-once page commit, confirmTx (NOVA_ARC_DESIGN §6) |
| `src/indexer/decode.ts` | 2 | NET canonical system-emitter log decoding, ERC-20 cross-check, dedupe key and digest (NOVA_ARC_DESIGN §6.1, §10.3) |
| `src/indexer/store.ts` | 2 | NET indexer inbox and cursor port: atomic page commit (types only, NOVA_ARC_DESIGN §6.4) |
| `src/dfns/json.ts` | 4 | F0 money-safe JSON for DFNS bodies (numbers kept as text) |
| `src/dfns/types.ts` | 4 | F1a DFNS decoders, deterministic keys, DFNS status → stage mapping |
| `src/dfns/client.ts` | 4 | F1 DFNS signer adapter (injected HTTP client and user-action signer) |
| `src/dfns/webhook.ts` | 3 | F3 DFNS webhook HMAC verification, dedupe and ordering |
| `src/gateway/index.ts` | 4 | F2 thin signing gateway (checks before every DFNS transfer) |
| `src/gateway/wrapper.ts` | 4 | F2b wrapper-call rule (allow-list, inner-call decoding) |
| `src/journey/quote/fiat.ts` | 1 | JQUOTE `FiatMinor<CCY>` branded fiat amounts (one per currency), checked constructor and same-currency add/subtract, built on U1 patterns without modifying U1 |
| `src/journey/quote/ports.ts` | 10 | JQUOTE FxPort (Nova FX/OTC engine via ConversionPort, payer FIAT only) and PayoutQuotePort (off-ramp partner, receiver FIAT_BANK only) shapes and exact integer quote checks |
| `src/journey/quote/compose.ts` | 7 | JQUOTE all-in journey quote: only the legs each pay-in x payout combination needs, gas allowance split and dust records, expiry and rate locks, cross-border OFF, binding digest, conservation re-check (NOVA_ARC_DESIGN §4.1) |

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
| 10 | Nova LedgerPort `postJournal` decision (balanced, P7 mirror, funds) | `src/nova-ports/ledger.ts` | `evaluateJournal` |
| 10 | Nova ports result model (OK / REJECTED / AMBIGUOUS) | `src/nova-ports/ids.ts` | `PortResult` |
| 7 | stage → TransactionStatus mapping (ADR-013 input) | `src/status/index.ts` | `STATUS_BY_STAGE` |
| 7 | payment working state: inbox dedupe and legal leg transitions | `src/nova-ports/payment-store.ts` | `decideSignal` |
| 7 | journey legs from payer and receiver choices | `src/status/journey.ts` | `journeyLegs` |
| 8 | gas-dust sub-ledger sweep (P5) and exact splits (P4D, P9D) | `src/nova-ports/gas-dust.ts` | `decideSweep` |
| 10 | Nova ConversionPort quote exactness (integer ratio, remainder kept) | `src/nova-ports/conversion.ts` | `checkQuote` |
| 10 | Nova PayoutPartnerPort callback dedupe key | `src/nova-ports/payout.ts` | `payoutDedupeKey` |
| 7 | Arc leg submit marker (one DFNS request per payment) | `src/nova-ports/payment-store.ts` | `decideMarkSubmit` |
| 7 | F-17 release of a failed payout (P6 with P11 or P2R) | `src/nova-ports/payment-store.ts` | `decideClosePayout` |
| 6 | Network port (NOVA_ARC_DESIGN §5.1) | `src/network/types.ts` | `NetworkAdapter` |
| 6 | Arc network adapter precheck (§8.4 check 6) | `src/network/arc/adapter.ts` | `ArcNetworkAdapter` |
| 6 | Arc event indexer: two-source disagreement and stall → PAUSE (§6.3, §6.6) | `src/indexer/indexer.ts` | `ArcIndexer` |
| 6 | indexer log paging and RPC errors (C-40, C-41, C-42) | `src/indexer/fetch.ts` | `fetchLogs` |
| 2 | canonical log decoding and ERC-20 cross-check (C-20, C-22) | `src/indexer/decode.ts` | `unpairedErc20` |
| 2 | indexer exactly-once page commit (§6.4) | `src/indexer/store.ts` | `IndexerStore` |
| 4 | DFNS money-safe JSON (no float on any DFNS body) | `src/dfns/json.ts` | `parseJson` |
| 4 | DFNS status → stage mapping (input only, never completes) | `src/dfns/types.ts` | `mapTransferStatus` |
| 4 | DFNS closed request allow-list | `src/dfns/client.ts` | `assertAllowedRequest` |
| 3 | DFNS webhook authenticity and dedupe | `src/dfns/webhook.ts` | `DfnsWebhookHandler` |
| 4 | gateway: chain pin, binding, replay, fee ceiling | `src/gateway/index.ts` | `SigningGateway` |
| 4 | gateway: wrapper-call rule | `src/gateway/wrapper.ts` | `verifyWrapperCall` |
| 1 | `FiatMinor<CCY>` per payout currency | `src/journey/quote/fiat.ts` | `FiatMinor` |
| 10 | journey FX lock and partner payout quote exactness | `src/journey/quote/ports.ts` | `checkPayoutQuote` |
| 7 | all-in journey quote composition and conservation | `src/journey/quote/compose.ts` | `checkConservation` |

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
