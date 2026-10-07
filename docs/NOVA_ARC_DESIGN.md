# Nova × Arc via DFNS: package design (D1 now, D2 next)

Status: **DRAFT, design block (CO-1 v3 step 7 shape), not verified.** It needs a verifier pass before any unit is generated from it. Fix block 1 (2026-10-06) addresses every defect in `docs/verification/NOVA-design-lensR-1.md` (B1–B4, m1–m12); it is not self-verified. Author: design agent, 2026-10-06, branch `co1-v3/nova-arc-d1`.

**Fix block 2 (2026-10-06)** answers `docs/verification/NOVA-design-lensR-2.md` (B1–B2, m1–m9); it is not self-verified.
- **B1:** proof (a) now covers only a transfer DFNS shows was never signed: `Rejected` by policy, or an abort DFNS accepted. Any other hash-less `Failed` needs the new proof (c), reserved-nonce resolution. The sending wallet goes on a nonce hold until that resolution. F-3b now has a nonce-burn procedure. Changed: §6.5, §8.4, §8.6, P6, F-3b, F-4, F-5, §13.3, and new question Q-N20.
- **B2:** GL-2 now has one sub-account per wallet. P4 credits the sending wallet. A new template, P10, posts ours-to-ours moves. P8 covers only funding from outside the registry. Changed: §6.1, §7.2, §7.3, §9.1, §9.2.
- **Minor fixes:**
  - m1, m2, m3: §8.2, F-5, DFNS_SETUP §4/§5, Q-N15.
  - m4: §6.7.
  - m5: `CANCELLED_ONCHAIN_REPLACED` (§7.3, §13).
  - m6: P2R.
  - m7: §7.1, §10.2.
  - m8: §7.3, §9.1.
  - m9: §4.1, §6.5, §10.3, §10.4.

**Fix block 3 (2026-10-06)** answers `docs/verification/NOVA-design-lensR-3.md` (R3-B1, R3-B2, R3-m1 to R3-m6); it is not self-verified.
- **R3-B1 (ambiguous POST):** before the DFNS transfer POST the gateway commits a durable **submit marker** on the leg, holding the DFNS `externalId`. From then on the leg counts as "a DFNS request may exist". No path may post P6 or reach a terminal stage while the marker is set and no DFNS entity is known; that includes `QUOTE_EXPIRED` and `CANCELLED_BY_OPERATOR`. The only way out is to re-POST the same bytes with the same `externalId`, or to find the entity by that `externalId`, and then to follow the existing proofs. Changed: §4.1, §6.5, §7.3 (`SubmitMarker`), §8.4 checks 2, 3 and 5, §8.6, §10.1, §10.4, F-6, F-16, §13.3 (rows and tests), and new question Q-N21.
- **R3-B2 (attempt + 1 after P6):** option (i) is adopted. Any proof (a), (b) or (c) ends the payment, with a terminal stage and P6. A payment has exactly **one** DFNS transfer request in its life (`attempt` is the literal `1n`). A retry is always a **new** payment, with a new id and new keys. Gateway check 2 refuses any leg that is terminal or has a `pay:<id>:p6` journal, not only one that lacks P1. Changed: §7.3, §8.4 checks 2 and 3, P6, F-4, §10.2, §13.3 tests.
- **Minor fixes:**
  - R3-m1: F-3b step 4a locates the nonce-`n` transaction, posts its gas and records `ONCHAIN_REVERTED` when it reverted (§8.4 check 5 adds the hold's nonce observations; Q-A11 extended).
  - R3-m2: §7.3 adds durable records and port operations for the wallet nonce hold, approved move and funding records, case records and two-person operator decisions. `OPERATOR_DECISION` is a new `InboundSignal` source with an authenticity rule and a dedupe key (§10.3), and it is tied to CF-31.
  - R3-m3: a payment whose destination is a company-owned wallet is refused with `DESTINATION_NOT_ALLOWED` (§4.1, §8.4 check 6, §13). P2I needs a customer receiver.
  - R3-m4: F-17's second branch is closed by P6 plus a new template, P11_PARTNER_CLAIM (§9.1, §9.2, §9.3, §10.2).
  - R3-m5: wording and citation fixes in §6.5, §7.3, §8.2, §10.4 and §13.3. The replay rule, item 3 of §8.4, is now cited as "§8.4 check 3" everywhere (earlier rounds called it "rule 3").
  - R3-m6: DFNS_SETUP §2 and §8 now carry Q-N15's `Wallets:Transactions:*` part, Q-N20 and Q-N21.

Nova is Raayl's codebase: a pnpm monorepo on Node 20 and PostgreSQL, with `services/ledger` (double-entry ledger, port 3000, has a reconcile command), `services/checkout` (payment links, merchant dashboard) and `libs/shared`. **We do not have Nova's code.** Every statement about Nova in this document is an assumption, tagged **[A-xx]**. Each tag maps to a question in [KHUMO_QUESTIONS.md](KHUMO_QUESTIONS.md), and nothing in code may treat it as fact until Khumo answers it (CLAUDE.md rule 5).

## 0. How to read this

| Tag | Meaning | Where it is resolved |
|---|---|---|
| **[A-xx]** | An assumption about Nova | KHUMO_QUESTIONS.md, row K-xx |
| **C-xx** | An Arc fact | docs/constants.md (cited, live-checked where marked) |
| **[DF:key]** | A DFNS fact | An archived page under `docs/sources/dfns/` (MANIFEST row; key table in §0.1) |
| **Q-xx** | An open question | docs/OPEN_QUESTIONS.md |

### 0.1 DFNS citation keys

Every key below is an archived file listed in `docs/sources/MANIFEST.md`. No DFNS endpoint, field, header or state appears in this document unless it is in one of these files.

| Key | Archived file (`docs/sources/dfns/…`) |
|---|---|
| DF:transfer | `api-reference_wallets_transfer-asset.md` |
| DF:get-transfer / DF:list-transfers | `api-reference_wallets_get-transfer.md` / `api-reference_wallets_list-transfers.md` |
| DF:abort / DF:cancel | `api-reference_wallets_abort-transfer.md` / `api-reference_wallets_cancel-transfer.md` |
| DF:get-wallet / DF:assets / DF:history | `api-reference_wallets_get-wallet.md` / `api-reference_wallets_get-wallet-assets.md` / `api-reference_wallets_get-wallet-history.md` |
| DF:create-transfers | `guides_developers_create-transfers.md` |
| DF:monitoring | `guides_developers_transaction-monitoring.md` |
| DF:idem | `api-reference_idempotency.md` |
| DF:errors / DF:rate | `api-reference_error-codes.md` / `api-reference_rate-limits.md` |
| DF:api-index / DF:regions | `api-reference_index.md` / `api-reference_regions.md` |
| DF:sa / DF:sign-req / DF:flows | `guides_developers_service-account.md` / `guides_developers_signing-requests.md` / `api-reference_auth_signing-flows.md` |
| DF:action-init / DF:action-sig / DF:cred-data | `api-reference_auth_create-user-action-challenge.md` / `api-reference_auth_create-user-action-signature.md` / `api-reference_auth_credentials-data.md` |
| DF:webhooks-guide / DF:events / DF:create-webhook | `guides_developers_webhooks.md` / `api-reference_webhook-events.md` / `api-reference_webhooks_create-webhook.md` |
| DF:policies / DF:create-policy | `core-concepts_policies.md` / `api-reference_policies_create-policy.md` |
| DF:perms | `core-concepts_roles-and-permissions.md` |
| DF:networks / DF:evm / DF:assets-list | `networks_index.md` / `networks_evm.md` / `networks_supported-assets.md` |
| DF:fees | `api-reference_networks_estimate-fees.md` |
| DF:gate-sa | `solutions_gate-service-account-signing.md` |

---

## 1. Scope

### 1.1 What the operator asked for (verbatim, binding)

> "the idea is for A user to just be able to send a payment in a traditional currency, and have the conversion happen and then have the journey reported to the user and then have it land in the receiver account"
>
> Correction: "(they pick)they can pay in traditional currency or stable coin and the receiver can receive in traditional currency or stable coin"

So a **payment is a journey with two independent choices**: the payer picks the pay-in method (fiat or stablecoin), and the receiver picks the payout method (fiat bank account or stablecoin wallet). Arc is the settlement leg between them. The package models all four combinations from day one; D1 makes only the stablecoin-to-stablecoin combination live, and keeps the fiat legs behind ports with fakes and a closed feature flag (§4).

### 1.2 Milestones covered here

| Milestone | In this design | Live in code |
|---|---|---|
| **D1** (CO-1 v3 step 5) | Network abstraction (`ARC`, `USDC`), Arc testnet config with mainnet present and disabled, DFNS `ArcTestnet` wallet and balance read, transfer with DFNS policy approval then broadcast, confirmation from our own indexer (system-emitter log) with DFNS events as cross-check, ledger postings through Nova's ledger (gas in USDC at 18 dp, dust to suspense), status via `GET /payments/:id`. Journey model with all four combinations; only USDC→USDC enabled | Yes |
| **D2** (next) | Arc wallets in Nova's `wallets` table and onboarding seeding; deposit detection from per-transfer events (our indexer), `balance-poller.ts` kept as a reconciliation cross-check; this is also what makes **stablecoin pay-in from an external wallet** possible | Design outline only (§14) |
| D3–D7 | Invoices, settlement/screening/travel rule, ZAR↔USDC, public API, multi-chain | Ports named, not designed |

### 1.3 Not in scope (CO-1 v3 "Not now")

No new wallet or custody system, no DeFi, lending, tokenisation, custom contracts, yield, exchange, consumer features, StableFX, CPN, Arc Onramp widget. The fiat payout partner port is **CPN-shaped but a stub** until an agreement exists (LEDGER 2026-10-06).

---

## 2. Principles this design enforces

1. **Extend, never parallel.** The package owns **no ledger, no wallets, no invoices, no FX engine and no payout rail.** It reaches Nova only through the ports in §7, which Nova implements. It does own its own *working state* (payment stages, inbox dedupe, indexer cursor), but even that is stored through `PaymentStorePort` in Nova's PostgreSQL [A-30], not in a database of its own. The one ledger-like exception is the 18-dp gas-dust suspense record (§9.2, `GasDustStore` in §7.3). It exists only if Nova's ledger cannot hold 18-dp amounts [A-11], and it is also stored in Nova's PostgreSQL.
2. **Two structurally different fakes per port**, passing one shared contract-test suite (§7.8). Same for the network abstraction: the Arc adapter and a second fake network adapter pass the same network contract tests (§5.3).
3. **Money**: integer `bigint` only, branded types from `src/amounts` (U1, frozen: reused, never modified). All unit conversion goes through U1's single conversion module (`nativeWeiToCbsMinor`, `cbsMinorToNativeWei`, `nativeWeiToUsdcUnits`, `usdcUnitsToNativeWei`). Rounding is U1's `FLOOR_REMAINDER_RETURNED`; every remainder is posted to a named suspense account (§9.2), never dropped.
4. **Exactly once.** Every write carries a deterministic idempotency key derived from business IDs (§10.2). Every inbound signal (chain log, DFNS webhook, DFNS poll result, payout callback, conversion result) is authenticity-checked and deduplicated before it changes state.
5. **Fail closed.** RPC disagreement, chain stall, unknown event, a binding mismatch or a broken invariant leads to PAUSE (whole rail, outbound) or QUARANTINE (one payment), and pages a human. Unpausing takes two humans.
6. **"Completed" only from our own evidence.** A payment's Arc leg reaches `COMPLETED` only on our indexer's confirmed system-emitter `Transfer` log that matches the bound recipient and amount, in the transaction whose hash DFNS reported for that payment's transfer (§6.5). The DFNS hash is only the **link** between the log and the payment; the **evidence** is always our own log. A DFNS `Confirmed` status or webhook never completes anything on its own, and a log alone never completes a payment it is not linked to by hash.
7. **Testnet only.** Arc testnet, chain ID 5042002 (C-01), DFNS network `ArcTestnet` [DF:networks]. Mainnet exists only as a disabled config entry (§11). Nothing in this package signs; DFNS signs, after DFNS policy approval.
8. **No personal information on-chain** (C-64). D1 sends plain value transfers with no memo.

---

## 3. Package layout (proposed, under `src/`)

New directories sit beside the existing skeleton. They reuse `src/amounts` (U1, frozen) and the existing `src/chain/config` gate logic (`ARC_MAINNET_DISABLED`, `resolveChain`, `assertMainnetAllowed`); they do not import the CBS-shaped `src/cbs/*`, which Nova replaces.

| Path | Unit | Money path? | Contents |
|---|---|---|---|
| `src/net/types.ts` | N1 | yes | `NetworkId`, `AssetId`, `NetworkAdapter` interface, `ConfirmedTransfer`, `NetworkFailure` |
| `src/net/arc/config.ts` | N2 | yes | Arc network parameters, loaded from constants (C-01, C-10, C-11, C-12, C-20, C-21, C-30, C-40), the DFNS network name, mainnet entry disabled |
| `src/net/arc/indexer.ts` | N3 | yes | Arc event indexer (§6) |
| `src/net/arc/adapter.ts` | N4 | yes | `ArcNetworkAdapter`: the only place Arc rules live |
| `src/net/fake/adapter.ts` | N5 | test support | Second network adapter (`FAKENET`), structurally different, same contract tests |
| `src/dfns/client.ts` | F1 | yes | Thin DFNS HTTP client behind `DfnsTransport` (fakeable); user-action signing |
| `src/dfns/gateway.ts` | F2 | yes | Pre-submit checks (chain pin, binding, replay, wrapper-call rule, pause state) |
| `src/dfns/webhook.ts` | F3 | yes | `POST /webhooks/dfns` verifier and deduper |
| `src/nova/ports.ts` | P1 | yes | Port interfaces (§7) and the shared `PortResult` error model |
| `src/nova/fakes/*` | P2 | test support | Two fakes per port |
| `src/payments/status.ts` | S1 | yes | Stage and status types and the mapping table (§8) |
| `src/payments/postings.ts` | S2 | yes | Posting templates (§9), building legs only through U1 |
| `src/payments/orchestrator.ts` | S3 | yes | D1 flow (§10) and the journey composer (§4) |
| `src/payments/http.ts` | S4 | no money arithmetic; formats via U1 | `GET /payments/:id` handler (Node 20 `node:http` compatible) |

Every "money path: yes" file must be added to `docs/MONEY_PATH.md` (listed paths, anchors, and the Number allow-list only for genuinely non-money numbers such as `chainId` and JSON-RPC error codes) in the same block that creates it. A dependency lint rule forbids importing `src/net/arc/**` or `src/dfns/**` from anywhere except their own directory and the composition root, so Arc and DFNS knowledge cannot leak (CO-1 v3 rubric "agnosticism").

Node 20 target: use only `node:crypto` (`createHmac`, `timingSafeEqual`, `createHash`, `sign`), global `fetch` (Node 18+), `AbortSignal.timeout`. No Node-22-only APIs.

---

## 4. The payment journey (payer picks, receiver picks)

### 4.1 Model

```ts
type PayInMethod =
  | { readonly method: 'STABLECOIN_BALANCE'; readonly asset: 'USDC'; readonly network: NetworkId }   // payer's USDC balance in Nova
  | { readonly method: 'STABLECOIN_DEPOSIT'; readonly asset: 'USDC'; readonly network: NetworkId }   // payer sends from an external wallet (D2)
  | { readonly method: 'FIAT'; readonly currency: FiatCode };                                        // payer's fiat balance in Nova (D5)

type PayoutMethod =
  | { readonly method: 'STABLECOIN_WALLET'; readonly asset: 'USDC'; readonly network: NetworkId; readonly beneficiaryRef: BeneficiaryRef }
  | { readonly method: 'FIAT_BANK'; readonly currency: FiatCode; readonly beneficiaryRef: BeneficiaryRef };  // via PayoutPartnerPort (stub)
```

**Who picks what.** The payer's create request carries only the payer's own choice (`PayInMethod`), the amount and a `beneficiaryRef`. It carries **no** `PayoutMethod`: the payout method is the **receiver's** choice, so it is read server-side from the receiver's (or beneficiary's) record through `ReceiverPort.resolvePayout` (§7.5a) [A-41], exactly as the destination is. A request that includes a payout method or a destination is a validation error (`PAYOUT_NOT_PAYER_CHOICE`, HTTP 400): no payment record is created and nothing is reserved. The resolved `PayoutMethod`, the destination address or bank account, and the receiver's preference version are frozen into the payment record and its binding (§7.3) at creation (CLAUDE.md "Binding"); a receiver who changes their preference later affects only new payments. If the receiver's chosen method is behind a closed flag, the payment is refused with `METHOD_NOT_ENABLED` (it is never silently switched to another method).

A payment is a list of **legs**. The composer adds only the legs the two choices need:

| Pay-in | Payout | Legs, in order | Live in |
|---|---|---|---|
| STABLECOIN_BALANCE | STABLECOIN_WALLET | `RESERVE` → `ARC_TRANSFER` (to receiver's address) | **D1** |
| STABLECOIN_DEPOSIT | STABLECOIN_WALLET | `AWAIT_DEPOSIT` → `RESERVE` → `ARC_TRANSFER` | D2 |
| FIAT | STABLECOIN_WALLET | `RESERVE` (fiat) → `CONVERT_IN` (fiat→USDC, ConversionPort) → `ARC_TRANSFER` | D5 |
| STABLECOIN_BALANCE / _DEPOSIT | FIAT_BANK | `RESERVE` → `ARC_TRANSFER` (to the payout partner's settlement address [A-52]) → `PAYOUT` (PayoutPartnerPort) | D5 + partner agreement |
| FIAT | FIAT_BANK | `RESERVE` (fiat) → `CONVERT_IN` → `ARC_TRANSFER` (to partner) → `PAYOUT` | D5 + partner; whether this combination should go via Arc at all is K-56 |

Rules:

- **Quote.** One quote per payment covers every conversion leg, the fee and the network fee allowance. Each quote leg is a separate balanced posting by Nova's conversion engine (`buildConversionPostings`) [A-50]. A quote has an expiry. If it expires while the `ARC_TRANSFER` leg has **no submit marker** (§7.3 `SubmitMarker`), the payment ends `EXPIRED` with reason `QUOTE_EXPIRED` and the reservation is released (P6). The marker is committed **before** the DFNS transfer POST (§8.4 check 3), so "no marker" is the only state that proves no DFNS request exists. Once the marker is set, a DFNS request may exist even if the POST timed out, and expiry alone never ends the leg and never posts P6 (§13.3). The leg is then resolved through DFNS by its `externalId` (F-6). After that, an expired quote is a reason for the DFNS approvers to deny (proof (a1)) or for an operator to abort (proof (a2)), never a release on its own.
- **Destination.** The resolved destination address must not be a company-owned wallet in the registry (owner `COMPANY`, for example `GAS_FLOAT` or `TREASURY_HOT`). Such a payment is refused with `DESTINATION_NOT_ALLOWED` (HTTP 422) before any record is created or anything is reserved. Moves between company wallets are P10 only (§9.2). If the destination is a customer-owned wallet of ours, `ResolvedPayout.receiver` must be non-null and equal to that wallet's owner, or the payment is refused the same way. The rule is checked again by gateway check 6 (§8.4), because the registry can change between creation and submission.
- **Completion.** The payment is `COMPLETED` only when its **last** leg completes: for `STABLECOIN_WALLET`, our indexer's confirmation of the Arc leg; for `FIAT_BANK`, the payout partner's authenticated final confirmation (the "ARRIVED" moment in the operator's journey). The journey report shows every leg's stage.
- **Feature flag.** `journey.fiat.enabled` and `journey.stablecoinDeposit.enabled` default to `false`. With a flag off, creating a payment whose pay-in method (payer's choice) or resolved payout method (receiver's choice) needs that flag is refused with `METHOD_NOT_ENABLED` before anything is reserved. The cross-border flag stays OFF until a legal opinion is recorded (CO-1 v3 D5).
- **Arc is not responsible for fiat conversion** (CO-1 v3 D5). `CONVERT_IN` and `PAYOUT` are Nova's (and the partner's) existing machinery, reached through ports.

### 4.2 Payment-level stage from leg stages

Each leg has its own `stage` (§13). The payment's `stage` is the stage of the first leg that is not `COMPLETED`; if every leg is `COMPLETED`, the payment is `COMPLETED`. A terminal non-success leg (`REJECTED`, `EXPIRED`, `CANCELLED`) makes the payment terminal with that leg's stage and reason. The public `status` is derived from the payment stage by the single table in §13.2.

---

## 5. Network abstraction

### 5.1 Interface

```ts
// src/net/types.ts
export type NetworkId = 'ARC' | 'FAKENET';           // grows per adapter (D7); FAKENET is test-only and rejected by the production composition root
export type AssetId = 'USDC';

export interface NetworkTransferIntent {               // what the payment binds to
  readonly network: NetworkId;
  readonly asset: AssetId;
  readonly from: NetworkAddress;                       // our custody wallet's address
  readonly to: NetworkAddress;
  readonly amount: NativeWei;                          // full-precision amount on the network's value view
}

export interface ConfirmedTransfer {
  readonly network: NetworkId;
  readonly chainId: bigint;
  readonly txHash: Hex32;
  readonly logIndex: bigint;
  readonly blockNumber: bigint;
  readonly blockHash: Hex32;
  readonly from: NetworkAddress;
  readonly to: NetworkAddress;
  readonly amount: NativeWei;
  readonly fee: NativeWei | null;                      // gasUsed × effectiveGasPrice when `from` is ours (C-25), else null
  readonly receiptStatus: 1n | 0n;
}

export type NetworkFailure =
  | { readonly kind: 'RPC_DISAGREEMENT'; readonly detail: string }
  | { readonly kind: 'CHAIN_STALL'; readonly lastHead: bigint; readonly sinceMs: bigint }
  | { readonly kind: 'UNKNOWN_EVENT'; readonly txHash: Hex32; readonly logIndex: bigint }
  | { readonly kind: 'RANGE_UNRECOVERABLE'; readonly from: bigint; readonly to: bigint };

export interface NetworkAdapter {
  readonly network: NetworkId;
  readonly asset: AssetId;
  /** Pre-submit checks only this network can make (Arc: chain pin, local blocklist, destination rules). */
  precheck(intent: NetworkTransferIntent): Promise<PortResult<void, NetworkPrecheckCode>>;
  /** Converts the business amount (ledger minor units at precision p) to the network's value view, exactly, via U1. */
  toNetworkAmount(minor: CbsMinor, p: CbsPrecision): NativeWei;
  /** Encodes the DFNS transfer body for this network and asset (Arc: §8.5, open question Q-N1). */
  dfnsTransferBody(intent: NetworkTransferIntent, externalId: string): DfnsTransferBody;
  /** Pull confirmed transfers touching `addresses` since the stored cursor; idempotent, resumable. */
  poll(addresses: ReadonlySet<NetworkAddress>): Promise<PortResult<readonly ConfirmedTransfer[], NetworkFailure['kind']>>;
  /** Look up one transaction by hash on two sources; null when neither source has it. */
  confirmTx(txHash: Hex32): Promise<PortResult<readonly ConfirmedTransfer[] | null, NetworkFailure['kind']>>;
  /** Liveness. */
  head(): Promise<PortResult<{ readonly number: bigint; readonly hash: Hex32 }, NetworkFailure['kind']>>;
}
```

`NetworkPrecheckCode` = `'CHAIN_ID_MISMATCH' | 'NETWORK_DISABLED' | 'SENDER_BLOCKLISTED' | 'RECIPIENT_BLOCKLISTED' | 'BLOCKLIST_STALE' | 'INVALID_DESTINATION' | 'AMOUNT_NOT_POSITIVE'`.

### 5.2 Where Arc rules live

Only `src/net/arc/**` knows: the two USDC views and their decimals (C-10, C-11), the ERC-20 address (C-12), the system emitter and canonical log (C-20, C-22), the `Transfer` topic (C-21), the fee floor (C-30), the `eth_getLogs` caps and errors (C-40, C-41, C-42), finality and stall behaviour (C-50, C-51), blocklist behaviour (C-53, C-55, C-57), zero-address and self-transfer rules (C-24, C-54), the DFNS network names `ArcTestnet`/`Arc` [DF:networks], and the DFNS 10-block indexing delay [DF:networks]. The orchestrator and postings see only `NetworkAdapter`, `NativeWei` and `ConfirmedTransfer`.

`ConfirmedTransfer.amount` is `NativeWei` because U1's full-precision brand is the only 18-dp type we have; a future network with different decimals gets its own brand in U1 by a LEDGER decision (U1 is frozen). This is noted as Q-N9.

### 5.3 Second adapter and contract tests

`FakeNetAdapter` (`src/net/fake/adapter.ts`) is structurally different on purpose: it has no logs and no blocks, just an in-memory append-only list of settled transfers with a monotonically increasing sequence number as its "cursor", a settable "stall" flag, a settable "disagreement" flag, and a 0-dp-based amount check (it rejects any amount that is not a multiple of 10¹² wei, to exercise a network whose value view is coarser). The shared suite `test/contract/network-adapter.contract.ts` runs against both and covers: exact amount round trip via U1; idempotent `poll` (same results twice, no duplicates); dedupe of a re-delivered transfer; cursor resume after a crash between fetch and commit; disagreement → `RPC_DISAGREEMENT`; stall → `CHAIN_STALL`; unknown event → `UNKNOWN_EVENT`; precheck refusals.

---

## 6. Arc event indexer (canonical source of truth for the chain)

DFNS indexes Arc only after a 10-block confirmation delay [DF:networks] ("| Arc | ArcTestnet | 1 | N/A | 10 | | |"), and its delivery is neither ordered nor unique [DF:events]. So **our indexer is canonical** and DFNS is the cross-check.

### 6.1 What is indexed

- **Canonical log:** `Transfer(address,address,uint256)` (topic0 C-21) emitted by the system emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (C-20) at **18 dp** (C-10). Credit and confirmation use this log only (C-22, C-15).
- **Attribution:** `from` and `to` come from the log's topics, never from `tx.from` (C-27).
- **Cross-check only:** the ERC-20 `Transfer` log from `0x3600…0000` (C-12, 6 dp) in the same transaction. If one is present with the same `from`/`to`, its value × 10¹² must equal the system log's value exactly (via `usdcUnitsToNativeWei`); a mismatch is `UNKNOWN_EVENT` → QUARANTINE. Its absence is not an error (sub-10⁻⁶ amounts and native sends are valid, C-15). Whether DFNS can send USDC as an ERC-20 call on Arc at all is Q-N1.
- **Not indexed:** legacy pre-Zero5 `NativeCoinTransferred` events from `0x1800…` (C-26). The indexer's start block is set after Zero5 (Q-A6), recorded in config.
- **Address set:** our DFNS wallet addresses from `WalletRegistryPort.list('ARC')` (§7.4). Two filtered queries per range: `topic1 = our address` (outbound) and `topic2 = our address` (inbound). In D1 the inbound query covers the company wallets (`TREASURY_HOT`, `GAS_FLOAT`), because anyone can send to a public address and an unexplained inbound would otherwise show up only as chain drift (§9.3); D2 adds `CUSTOMER_DEPOSIT` wallets. Zero-value and self-transfers (`from` = `to`) emit no log (C-24), so the orchestrator refuses both before submission.
- **Classification (one pure function, applied before any claim).** Every canonical log is classified from `(from ∈ ours, to ∈ ours)` using the wallet registry at that block, never by whichever consumer reads it first:

  | `from` ours? | `to` ours? | Class | Who may claim it |
  |---|---|---|---|
  | yes | no | `OUTBOUND` | only the outbound matcher (§10.4): an `ARC_TRANSFER` leg linked by DFNS hash |
  | yes | yes | `INTERNAL` | only the outbound matcher. The log must be linked by DFNS hash either to an `ARC_TRANSFER` leg (posted by P2I) or to an approved internal move record (posted by P10, for example a `GAS_FLOAT` → `TREASURY_HOT` top-up, §9.2). It is posted **only** by P2I or P10, never by P8: both wallets are ours, so the source wallet's GL-2 sub-account is credited, and funding (GL-7) is never credited. **Never** claimed by D2's deposit crediting, even when `to` is a deposit wallet |
  | no | yes | `INBOUND` | D1, in this order: (1) an approved funding record from **outside the wallet registry** whose `(from, to, value)` matches exactly (P8); (2) an open F-17 partner-return case record whose `(from, to, value)` matches exactly (P2R, §9.2); (3) otherwise the unidentified-receipt path (P9, §9.2). D2 adds customer deposit crediting for `CUSTOMER_DEPOSIT` wallets |
  | no | no | not fetched | — |

  The inbox key `(chainId, txHash, logIndex)` stays the single dedupe key, so a log can be claimed once; the classification decides **which** path may claim it, so the outcome never depends on timing.

### 6.2 Paging and RPC errors

| Condition | Source | Handling |
|---|---|---|
| Range size | C-40: cap 10,000 blocks, `-32012` above it | Request at most **9,999 blocks** per call (inclusive `[from, to]`, so `to − from ≤ 9,998`). 9,999 is the documented page size, one block below the 10,000 cap (C-40). Implement and reuse the existing U3 stub `pageBlockRange` in `src/chain/client` with `ARC_TESTNET.getLogsMaxBlocksPerPage` |
| `-32012` returned anyway | C-40 | Halve the range and retry; never widen. Record a metric |
| `-32602` "max results 2000" | C-41 (observed, undocumented, Q-A4) | Bisect the range by halves down to 1 block; do **not** parse the suggested range from the message. A single block that still overflows → `RANGE_UNRECOVERABLE` → PAUSE |
| `-32014` (head lag) | C-42 | Retry with capped exponential backoff with jitter (initial 250 ms, cap 8 s, max 8 attempts; values are ours, Q-N6). Exhausted → treat that source as lagging, which feeds stall/disagreement logic |
| Transport error or timeout | — | Retry the same range with backoff; the cursor does not move |
| Any other JSON-RPC error code | — | Stop that source (U3 rule "any unknown error → stop"), keep the cursor, page; with one source stopped the other alone cannot confirm (§6.3; the only exception is the testnet-only flag in §6.3), so outbound is PAUSED |

### 6.3 Two sources and disagreement

Each range is read from two sources: our own node and a reference RPC (ADR-002; C-03, C-04). They must return the same set of `(txHash, logIndex, value, from, to)` for the range, and the same block hash for every block that carries a match. Any difference → `RPC_DISAGREEMENT` → PAUSE outbound, freeze the cursor at the last agreed block, page a human; two humans resolve it (CONTRACT §1.6, CF-27). Until a second source is available in the sandbox (Q-T6), tests use two fake sources.

**Single-source exception (testnet only, explicit flag).** The live testnet slice may run from one source only when the config flag `arc.indexer.singleSourceTestnetOnly` is `true` (default `false`). The config loader accepts the flag only together with chain ID 5042002 (C-01) and DFNS network `ArcTestnet`; combined with the mainnet entry (C-02, DFNS `Arc`) it throws at load time, before any indexer or gateway is constructed. CI test (e) in §11 proves that. With the flag on, §6.5 rule 4 is satisfied by the one source, every confirmation and journal ref records `sources: 1`, and the evidence note is labelled single-source. Without the flag, one source can never confirm.

### 6.4 Exactly-once and the cursor

- **Dedupe key:** `(chainId, txHash, logIndex)` with `chainId` = 5042002 (C-01). It is the primary key of the inbox row written through `PaymentStorePort.applySignal` (§7.3). Re-reading a range is therefore harmless.
- **Cursor:** one per `(chainId, emitter)`, the highest block whose whole range has been committed. Logs and the cursor advance are committed in **one** transaction. A crash between fetch and commit re-fetches the same range.
- **Reorgs:** none on Arc (C-50), so the cursor never rewinds by design. If a source ever reports a different hash for a block below the cursor, that is `RPC_DISAGREEMENT`, not a reorg.

### 6.5 Confirmation rule (when the Arc leg is `COMPLETED`)

An outbound Arc leg is confirmed when **all** of these hold:

1. A canonical system-emitter `Transfer` log exists in transaction `txHash`, where `txHash` is the hash **DFNS reported for this payment's transfer** (`GET …/transfers/{id}` [DF:get-transfer]). That DFNS-reported hash is the only **automatic** way to satisfy this rule (it is the path of §10.1). The only other link is a two-person decision (`OPERATOR_DECISION` `LINK_HASH`, §7.3) recorded with on-chain evidence:
   - the transaction's nonce, from `eth_getTransactionByHash` on both sources, equals the nonce of this payment's DFNS transfer;
   - and rule 2 holds on both sources.
   That decision is allowed only in two cases: a speed-up replacement (F-18), or a hash-less DFNS `Failed` transfer whose signed original landed (F-3b).
   
   A log seen before DFNS reports a hash can only be a **provisional** link (§10.4). It needs exactly one candidate payment, it never completes anything, and it becomes evidence for this rule only when DFNS's hash for this transfer arrives and equals the log's transaction hash. Two or more candidates → no link at all (F-12).
   
   If DFNS never reports a hash within `A_xcheck` (Q-N6), the leg keeps its current stage. That stage is `CREATED` (with the submit marker set, §7.3), `PENDING_APPROVAL` or `APPROVED`, because without a DFNS hash the leg cannot reach `SUBMITTED` (§8.6). The payment is then QUARANTINED for a two-person link decision. It is never completed by elimination. A `CREATED` leg **without** a submit marker has no DFNS request, so a log can never be its candidate (§10.4); such a log is unknown at once (§6.7).
2. `from` = bound wallet address, `to` = bound recipient, `value` = bound `NativeWei` amount, **exactly**. Any difference is a binding breach → PAUSE (F-10).
3. The receipt has `status = 1`. A `status = 0` receipt (for example a blocklist revert that consumed gas, C-53) is **not** a confirmation: see F-3.
4. Both sources agree on the block hash, and the block is at or below the head both sources report (one source only under the testnet-only flag of §6.3). Because Arc finality is deterministic on inclusion (C-50), the default required depth is **0 extra blocks**; it is a config value (`arc.confirmations`) that Ops may raise (Q-N5).
5. The dedupe key is new (first sighting) or already linked to this same payment (re-delivery).

Gas for that transaction is `gasUsed × effectiveGasPrice` from the receipt (C-25), as `NativeWei`, posted per §9.

### 6.6 Liveness

No new head from **both** sources for `A_stall` (value is a human decision, Q-A7) → `CHAIN_STALL` → PAUSE new submissions. Payments already in `SUBMITTED`/`CONFIRMING` stay there; no timeout fires during a stall (§12 F-8).

### 6.7 Unknown outbound

A canonical log with `from` = one of our wallets is checked as follows:
- **Linked** by DFNS hash to a payment or to an approved internal move (P10): normal path.
- **Candidate** (unlinked, but its `(to, value)` equals one or more open payments whose Arc leg has a submit marker and no DFNS hash yet, §10.4):
  - with exactly one candidate it is a provisional link;
  - with two or more it is ambiguous (F-12) and is not linked at all.
  - Either way it is **exempt** from this section until `A_xcheck` (Q-N6) has passed since it was first seen. If it is still unlinked then, it becomes `UNKNOWN_EVENT` → PAUSE and page.
- **Anything else** is immediately `UNKNOWN_EVENT` → PAUSE and page: a send we did not request. This is the main detection for a DFNS-side or credential compromise, and it also catches a DFNS speed-up or cancel replacement whose hash differs from the one we linked (F-18), and any late inclusion of a transfer whose payment was already released (which proofs (a), (b) and (c) and the submit marker are built to rule out).

---

## 7. Nova ports (exact signatures)

### 7.1 Shared error model and identifiers

```ts
// src/nova/ports.ts
export type IdempotencyKey = string & { readonly __idempotencyKey: true };   // [a-z0-9:-], ≤ 128 chars, derived (§10.2)
export type PaymentId     = string & { readonly __paymentId: true };          // 'pay-' + 32 lower-case hex (§10.2); also within the IdempotencyKey charset
export type NovaAccountRef = string & { readonly __novaAccountRef: true };  // Nova's own account identifier [A-02]
export type NovaOwnerRef  = string & { readonly __novaOwnerRef: true };     // Nova user_id / merchant id [A-20]
export type WalletRef     = string & { readonly __walletRef: true };        // Nova wallets row id [A-20]
export type BeneficiaryRef = string & { readonly __beneficiaryRef: true };  // [A-41]
export type LedgerAssetCode = string & { readonly __ledgerAssetCode: true };// e.g. 'USDC', 'ZAR' [A-03]
export type FiatCode = string & { readonly __fiatCode: true };              // ISO 4217 alpha-3
export type NetworkAddress = `0x${string}`;                                 // lower-cased on entry
export type Hex32 = `0x${string}`;                                          // lower-cased on entry; must match ^0x[0-9a-f]{64}$

/** Every port call returns exactly one of three outcomes. Ports never throw for business outcomes. */
export type PortResult<T, Code extends string> =
  | { readonly kind: 'OK'; readonly value: T; readonly replayed: boolean }       // replayed: same key, same request, earlier result returned
  | { readonly kind: 'REJECTED'; readonly code: Code; readonly detail: string } // definitive business refusal; nothing was applied
  | { readonly kind: 'AMBIGUOUS'; readonly cause: 'TIMEOUT' | 'TRANSPORT' | 'UNAVAILABLE' };  // outcome unknown; resolve by key lookup, never by a fresh write

/** Every keyed write rejects a key reused with a different request. */
export type KeyConflict = 'KEY_CONFLICT';
```

**Normalisation on entry.** Every `NetworkAddress` and every `Hex32` (transaction and block hashes) is lower-cased at the boundary where it enters the package: the RPC response parser, the DFNS response and webhook parser, and the config loader. A value that does not match its pattern after lower-casing is refused as a malformed signal. This applies whether the value came from an RPC source or from DFNS. So one receipt always yields one `gas:` key, one `arc:` inbox key and one `unid:` key (§10.2, §10.3), and string comparison of hashes is exact.

Semantics shared by every keyed write:

- Same key, same canonical request → `OK` with `replayed: true` and the original result (no second effect).
- Same key, different request → `REJECTED KEY_CONFLICT` → QUARANTINE that payment.
- `AMBIGUOUS` → the caller calls the port's `…ByKey` lookup until it gets `OK` (found or definitively absent). Only "definitively absent" allows a retry with the **same** key. Ports must keep keys at least as long as our retry horizon `H_retry` [A-04].
- Thrown exceptions are programming errors only (they abort the unit of work, page, and are counted as AMBIGUOUS by the caller).

### 7.2 LedgerPort (Nova `services/ledger`)

```ts
export type GlRole = 'GL-1' | 'GL-2' | 'GL-3' | 'GL-4' | 'GL-5' | 'GL-6' | 'GL-7';   // §9.1
export type LedgerAccount =
  | { readonly kind: 'CUSTOMER'; readonly account: NovaAccountRef }                  // GL-1 sub-account
  | { readonly kind: 'ROLE'; readonly role: GlRole; readonly sub: string };          // resolved by Nova's GL map [A-06]

export interface LedgerLeg {
  readonly account: LedgerAccount;
  readonly side: 'DEBIT' | 'CREDIT';
  readonly amount: CbsMinor;            // > 0, in minor units of `asset` at `precision`
}

export type PostingTemplateId = 'P1_RESERVE' | 'P2_SETTLE_EXTERNAL' | 'P2I_SETTLE_INTERNAL' | 'P2P_PARTNER_FUNDED' | 'P2R_PARTNER_RETURN'
  | 'P3_FEE' | 'P4_GAS' | 'P5_DUST_SWEEP' | 'P6_RELEASE' | 'P7_COMPENSATE' | 'P8_EXTERNAL_FUNDING' | 'P9_UNIDENTIFIED_RECEIPT'
  | 'P10_INTERNAL_MOVE' | 'P11_PARTNER_CLAIM';

export interface JournalRefs {
  readonly paymentId: PaymentId | null;  // null only for rail-level journals: P5, P8, P9, P10, and P4 of a transaction not sent for a payment (an internal move)
  readonly network: NetworkId | null;
  readonly txHash: Hex32 | null;
  readonly logIndex: bigint | null;
  readonly dfnsTransferId: string | null;
  readonly compensates: string | null;   // journalId reversed by P7
}

export interface JournalRequest {
  readonly key: IdempotencyKey;
  readonly template: PostingTemplateId;
  readonly asset: LedgerAssetCode;
  readonly precision: CbsPrecision;     // must equal Nova's precision for `asset`, else PRECISION_MISMATCH
  readonly legs: readonly LedgerLeg[];  // ≥ 2; Σ debits = Σ credits (checked by us AND by Nova [A-05])
  readonly refs: JournalRefs;
}

export interface JournalReceipt { readonly journalId: string; readonly key: IdempotencyKey; readonly postedAt: string }

export type LedgerRejectCode = KeyConflict | 'UNBALANCED' | 'INSUFFICIENT_FUNDS' | 'ACCOUNT_UNKNOWN' | 'ACCOUNT_CLOSED'
  | 'ASSET_UNKNOWN' | 'PRECISION_MISMATCH' | 'BINDING_MISMATCH';

export interface LedgerPort {
  getAssetPrecision(asset: LedgerAssetCode): Promise<PortResult<CbsPrecision, 'ASSET_UNKNOWN'>>;
  postJournal(req: JournalRequest): Promise<PortResult<JournalReceipt, LedgerRejectCode>>;
  getJournalByKey(key: IdempotencyKey): Promise<PortResult<JournalReceipt | null, never>>;
  getBalance(account: LedgerAccount, asset: LedgerAssetCode): Promise<PortResult<CbsMinor, 'ACCOUNT_UNKNOWN' | 'ASSET_UNKNOWN'>>;
}
```

Assumptions: Nova's ledger stores amounts as integers at a fixed per-asset precision [A-01]; accounts are addressable by a stable reference [A-02]; there is an asset code for USDC [A-03]; a caller-supplied idempotency key with conflict detection exists or can be added [A-04]; Nova rejects unbalanced journals itself [A-05]; GL roles can be mapped to Nova accounts by config [A-06]; `postJournal` is atomic across all legs [A-07]; "reserve" is done by debit-to-clearing because Nova may have no holds [A-08]; `INSUFFICIENT_FUNDS` is checked inside the same transaction as the debit [A-09]; Nova's reconcile command can take our journals as input [A-10]; `buildConversionPostings` posts through the same ledger [A-50].

**Precision gate (RUBRIC MC-06).** At start-up, and before the first posting of every process, the orchestrator calls `getAssetPrecision('USDC')` and compares it with the configured `p`. Any difference, or `ASSET_UNKNOWN`, PAUSEs the rail before any `postJournal` call. A known-amount onboarding test runs in CI and once per environment at onboarding: with a ledger fake (and later Nova's adapter) reporting `p`, exactly 1 USDC (`10^p` minor) must round-trip through U1 to `10^18` wei and back with zero remainder, and a fake reporting a different `p` must PAUSE with **no** posting call made.

### 7.3 PaymentStorePort (our working state, stored in Nova's PostgreSQL)

```ts
export type TransactionStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'REVERSED';   // Nova types.ts, unchanged [A-31]
export type Stage = 'CREATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'SUBMITTED' | 'CONFIRMING'
  | 'COMPLETED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type LegKind = 'AWAIT_DEPOSIT' | 'RESERVE' | 'CONVERT_IN' | 'ARC_TRANSFER' | 'PAYOUT';
export type FailureReason =
  | 'APPROVAL_DENIED' | 'APPROVAL_EXPIRED' | 'QUOTE_EXPIRED' | 'CANCELLED_BY_OPERATOR' | 'CANCELLED_ONCHAIN_REPLACED'
  | 'BLOCKLISTED_PRECHECK' | 'BLOCKLISTED_PRE_MEMPOOL' | 'UNDER_FEE_FLOOR_DROPPED' | 'ONCHAIN_REVERTED'
  | 'DFNS_FAILED' | 'INSUFFICIENT_FUNDS' | 'PAYOUT_FAILED' | 'METHOD_NOT_ENABLED' | 'DESTINATION_NOT_ALLOWED';

export type MoveId = string & { readonly __moveId: true };   // 'mov-' + 32 lower-case hex (§10.2); an approved internal move (P10)

export interface TransferBinding {          // frozen at creation, hashed, re-checked before submit and at confirmation
  readonly network: NetworkId;
  readonly asset: AssetId;
  readonly fromWallet: WalletRef;
  readonly fromAddress: NetworkAddress;
  readonly dfnsWalletId: string;
  readonly to: NetworkAddress;
  readonly amount: NativeWei;
  readonly digest: Hex32;                   // sha256 over the canonical encoding of the fields above + paymentId + attempt
}

export interface LegRecord {
  readonly kind: LegKind;
  readonly stage: Stage;
  readonly reason: FailureReason | null;
  readonly attempt: 1n;                     // ARC_TRANSFER only; always 1n. A payment has exactly one DFNS transfer request;
                                            // a retry is a NEW payment with a new id and new keys (§8.4 check 3, §10.2)
  readonly submit: SubmitMarker | null;     // ARC_TRANSFER only; committed BEFORE the DFNS POST, never cleared (§8.4 check 3)
  readonly externalRef: string | null;      // DFNS transfer id, conversion id or payout id
  readonly txHash: Hex32 | null;
}

/** "A DFNS request may exist." Committed by `markSubmit` before the first DFNS transfer POST and never cleared.
 *  While it is set and `externalRef` is null, the leg is UNRESOLVED: no terminal stage and no P6 are possible (§13.3). */
export interface SubmitMarker {
  readonly externalId: string;              // deriveExternalId (§10.2), the only externalId this leg will ever use
  readonly bodyDigest: Hex32;               // sha256 of the exact serialised POST body; every re-POST sends these same bytes
  readonly markedAt: string;
  readonly markedAtBlock: bigint;           // a head both sources agree on at marking; lower bound of the F-3b nonce search
}

export interface PaymentRecord {
  readonly paymentId: PaymentId;
  readonly version: bigint;                 // optimistic concurrency
  readonly requestKey: IdempotencyKey;      // 'req-' + hex digest of (payer, client Idempotency-Key), length-prefixed (§10.2)
  readonly requestDigest: Hex32;            // canonical hash of the create request
  readonly payer: NovaOwnerRef;
  readonly payerAccount: NovaAccountRef;
  readonly payIn: PayInMethod;
  readonly payout: PayoutMethod;            // the RECEIVER's choice, resolved by ReceiverPort at creation, never from the request (§4.1)
  readonly beneficiaryRef: BeneficiaryRef;
  readonly payoutPreferenceVersion: string; // which version of the receiver's preference was frozen
  readonly amount: CbsMinor;                // what the receiver gets, in the payout asset's ledger precision
  readonly fee: CbsMinor;
  readonly quoteId: string | null;
  readonly binding: TransferBinding;
  readonly legs: readonly LegRecord[];
  readonly stage: Stage;                    // derived (§4.2), stored for querying
  readonly status: TransactionStatus;       // derived (§13.2), stored for Nova's existing readers
  readonly reason: FailureReason | null;
  readonly compensatedBy: string | null;    // P7 journalId when REVERSED
}

export interface InboundSignal {
  readonly source: 'ARC_LOG' | 'DFNS_WEBHOOK' | 'DFNS_POLL' | 'CONVERSION' | 'PAYOUT_CALLBACK' | 'OPERATOR_DECISION';
  readonly dedupeKey: string;               // §10.3
  readonly payloadDigest: Hex32;            // sha256 over the canonical projection defined per source in §10.3, never over raw envelopes
}

export type SignalOutcome = 'APPLIED' | 'DUPLICATE' | 'STALE';   // STALE: valid but older than current stage (out of order)

export interface PaymentStorePort {
  create(rec: PaymentRecord): Promise<PortResult<PaymentRecord, KeyConflict>>;
  get(id: PaymentId): Promise<PortResult<PaymentRecord, 'NOT_FOUND'>>;
  getByRequestKey(payer: NovaOwnerRef, key: IdempotencyKey): Promise<PortResult<PaymentRecord | null, never>>;
  /** Atomically: record the signal in the inbox (dedupe), apply the leg transition if legal and the version matches, enqueue outbox items,
   *  and write `placeHold` (if given) in the same transaction. `id` is a payment, or an approved internal move (P10), whose Arc leg uses
   *  the same stages and proofs. The store itself refuses, with LEG_UNRESOLVED, any terminal target and any P6 outbox item for a leg whose
   *  submit marker is set while `externalRef` is still null (R3-B1, §13.3). That is defence in depth behind the orchestrator's own rule. */
  applySignal(
    id: PaymentId | MoveId, expectedVersion: bigint, signal: InboundSignal,
    transition: { readonly leg: LegKind; readonly to: Stage; readonly reason: FailureReason | null; readonly externalRef?: string; readonly txHash?: Hex32;
                  readonly placeHold?: NewNonceHold },
    outbox: readonly OutboxItem[],
  ): Promise<PortResult<{ readonly outcome: SignalOutcome; readonly record: PaymentRecord | ApprovedMoveRecord },
     'NOT_FOUND' | 'VERSION_CONFLICT' | 'ILLEGAL_TRANSITION' | 'SIGNAL_CONFLICT' | 'LEG_UNRESOLVED'>>;
  /** Commits the submit marker; the gateway POSTs only after this returns OK (§8.4 check 3). Idempotent for an equal marker.
   *  LEG_TERMINAL: the leg is terminal or a P6 is enqueued. MARKER_CONFLICT: a different marker is already set. */
  markSubmit(id: PaymentId | MoveId, expectedVersion: bigint, marker: SubmitMarker)
    : Promise<PortResult<PaymentRecord | ApprovedMoveRecord, 'NOT_FOUND' | 'VERSION_CONFLICT' | 'LEG_TERMINAL' | 'MARKER_CONFLICT'>>;
  /** Finds the payment or move whose submit marker holds this externalId (used when a DFNS webhook or listing shows an entity
   *  whose POST response we never received). */
  findByExternalId(externalId: string): Promise<PortResult<PaymentRecord | ApprovedMoveRecord | null, never>>;
  /** Indexer cursor, committed with the signals of its range. */
  commitRange(cursorKey: string, toBlock: bigint, signals: readonly InboundSignal[]): Promise<PortResult<void, 'CURSOR_REGRESSION'>>;
  getCursor(cursorKey: string): Promise<PortResult<bigint | null, never>>;
  /** Rail-level flags, two-person unpause enforced by the store (two distinct approver ids). */
  getRailState(): Promise<PortResult<{ readonly paused: boolean; readonly reason: string | null }, never>>;
  pause(reason: string, actor: string): Promise<PortResult<void, never>>;
  unpause(decision: OperatorDecision): Promise<PortResult<void, DecisionRejectCode>>;   // decision kind UNPAUSE only
  listOpen(leg: LegKind, stage: Stage, limit: bigint): Promise<PortResult<readonly PaymentRecord[], never>>;   // for pollers and timeouts
  listUnresolvedSubmits(limit: bigint): Promise<PortResult<readonly (PaymentRecord | ApprovedMoveRecord)[], never>>;   // marker set, externalRef null (F-6)

  /** Two-person operator decisions (§10.3 source OPERATOR_DECISION). Recorded through the inbox like any signal. */
  recordDecision(signal: InboundSignal, d: OperatorDecision): Promise<PortResult<{ readonly outcome: SignalOutcome }, DecisionRejectCode>>;
  getDecision(decisionId: string): Promise<PortResult<OperatorDecision, 'NOT_FOUND'>>;

  /** Wallet nonce holds (§8.4 check 5). Created only through applySignal's `placeHold`, so a hold is never only in memory. */
  listActiveHolds(wallet: WalletRef): Promise<PortResult<readonly WalletNonceHold[], never>>;
  recordHoldObservation(holdId: string, obs: { readonly block: bigint; readonly accountNonce: bigint }): Promise<PortResult<WalletNonceHold, 'NOT_FOUND'>>;
  recordHoldNonceTx(holdId: string, txHash: Hex32): Promise<PortResult<WalletNonceHold, 'NOT_FOUND' | 'NONCE_TX_CONFLICT'>>;
  liftHold(holdId: string, evidence: InboundSignal): Promise<PortResult<WalletNonceHold, 'NOT_FOUND'>>;

  /** Approved internal moves (P10), approved external funding (P8) and Ops case records (F-3b, F-5, F-17, F-18, F-19). */
  putMove(rec: ApprovedMoveRecord): Promise<PortResult<ApprovedMoveRecord, KeyConflict | 'DECISION_MISSING'>>;
  getMove(id: MoveId): Promise<PortResult<ApprovedMoveRecord, 'NOT_FOUND'>>;
  putFunding(rec: ApprovedFundingRecord): Promise<PortResult<ApprovedFundingRecord, KeyConflict | 'DECISION_MISSING'>>;
  putCase(rec: CaseRecord): Promise<PortResult<CaseRecord, KeyConflict | 'DECISION_MISSING'>>;
  addCaseDecision(caseId: string, decisionId: string): Promise<PortResult<CaseRecord, 'NOT_FOUND' | 'DECISION_MISSING'>>;
  /** §6.1 INBOUND claim, in classification order: an OPEN funding record, then an OPEN PARTNER_RETURN case, whose (from, to, value)
   *  equals the log's exactly. Claiming marks the record MATCHED in the same transaction as the log's inbox row. */
  claimInbound(log: InboundSignal, triple: { readonly from: NetworkAddress; readonly to: NetworkAddress; readonly value: NativeWei })
    : Promise<PortResult<{ readonly claimedBy: ApprovedFundingRecord | CaseRecord | null }, 'SIGNAL_CONFLICT'>>;
}

export type DecisionKind =
  | 'LINK_HASH'                 // §6.5 rule 1: link a tx hash to a leg or move (F-3b, F-18)
  | 'ABORT_ACCEPTED'            // proof (a2): the operator's abort and DFNS's accepted response (F-2, F-5)
  | 'DFNS_CANCEL_ISSUED'        // a DFNS cancel issued for a nonce burn or a stuck transfer (F-3b, F-5, F-18)
  | 'NONCE_TX_LOCATED'          // F-3b step 4a: the nonce-n transaction found on both sources
  | 'NONCE_UNKNOWN_CLOSE'       // Q-N20: DFNS's written answer for one transfer with no parseable nonce
  | 'LIFT_QUARANTINE' | 'UNPAUSE'
  | 'APPROVE_MOVE' | 'APPROVE_FUNDING'
  | 'OPEN_PARTNER_CASE' | 'CLOSE_PARTNER_UNRETURNED'   // F-17
  | 'RESOLVE_UNIDENTIFIED';     // F-19

export interface OperatorDecision {
  readonly decisionId: string;                       // §10.2
  readonly kind: DecisionKind;
  readonly subject: string;                          // paymentId, moveId, fundingId, caseId or holdId, per kind
  readonly caseId: string | null;
  readonly seq: bigint;                              // 1n, 2n … for repeated decisions of one kind in one case
  readonly evidenceDigest: Hex32;                    // sha256 over the canonical evidence projection (§10.3)
  readonly approvers: readonly [string, string];     // two DISTINCT authenticated staff identities, never a service account (CF-31)
  readonly decidedAt: string;
}
export type DecisionRejectCode = 'SIGNAL_CONFLICT' | 'SAME_APPROVER' | 'APPROVER_UNAUTHENTICATED' | 'WRONG_KIND';

export interface NewNonceHold {
  readonly wallet: WalletRef;
  readonly dfnsTransferId: string;
  readonly subject: PaymentId | MoveId;
  readonly nonce: bigint | null;                     // n from DFNS `details`; null when unparseable (Q-N20)
  readonly aborted: boolean;                         // an ABORT_ACCEPTED decision exists for this transfer
}
export interface WalletNonceHold extends NewNonceHold {
  readonly holdId: string;                           // §10.2
  readonly lastAtOrBelow: { readonly block: bigint; readonly accountNonce: bigint } | null;  // latest agreed block with account nonce ≤ n
  readonly firstAbove: { readonly block: bigint; readonly accountNonce: bigint } | null;     // first agreed block with account nonce > n
  readonly nonceTx: Hex32 | null;                    // the nonce-n transaction, once located (F-3b step 4a)
  readonly state: 'ACTIVE' | 'LIFTED';
  readonly liftedBy: string | null;                  // dedupe key of the lifting evidence or decision
}

export interface ApprovedMoveRecord {                // P10; one DFNS transfer request per move, like a payment
  readonly moveId: MoveId;
  readonly version: bigint;
  readonly approval: string;                         // decisionId of an APPROVE_MOVE decision
  readonly source: WalletRef;                        // both COMPANY-owned registry wallets, source ≠ dest
  readonly dest: WalletRef;
  readonly amount: CbsMinor;                         // X
  readonly binding: TransferBinding;                 // built like a payment's, with moveId in place of paymentId
  readonly leg: LegRecord;                           // kind ARC_TRANSFER; same stages, marker and proofs as a payment's Arc leg
}

export interface ApprovedFundingRecord {             // P8
  readonly fundingId: string;                        // §10.2
  readonly approval: string;                         // decisionId of an APPROVE_FUNDING decision
  readonly from: NetworkAddress;                     // must NOT be in the wallet registry
  readonly to: WalletRef;                            // COMPANY-owned
  readonly amount: CbsMinor;                         // M; the expected value is cbsMinorToNativeWei(M, p)
  readonly state: 'OPEN' | 'MATCHED' | 'CLOSED';
  readonly matchedLog: string | null;                // arc:<chainId>:<txHash>:<logIndex>
}

export interface CaseRecord {
  readonly caseId: string;                           // §10.2
  readonly kind: 'PARTNER_RETURN' | 'NONCE_BURN' | 'REPLACEMENT' | 'STUCK' | 'UNRESOLVED_SUBMIT' | 'UNIDENTIFIED';
  readonly subject: string;                          // paymentId, moveId, or the arc:… key of a P9 log
  readonly expected: { readonly from: NetworkAddress; readonly to: NetworkAddress; readonly value: NativeWei } | null;  // PARTNER_RETURN only
  readonly state: 'OPEN' | 'MATCHED' | 'CLOSED';
  readonly decisions: readonly string[];             // decisionIds, in order
}
```

**Durability of the safety records (R3-m2).** Submit markers, nonce holds, move, funding and case records, and operator decisions are rows in Nova's PostgreSQL, behind this port and added through Nova's migration process [A-30]. Nothing on this list lives only in memory.
- A hold is written in the same transaction as the DFNS signal that starts it (`placeHold`). Gateway check 5 reads `listActiveHolds` from the store on every submission and never from a cache. So a restart cannot lose a hold, including the hold of an aborted transfer whose leg is already terminal.
- A marker is committed by `markSubmit` before the POST. A crash between marker and POST leaves an UNRESOLVED leg, which `listUnresolvedSubmits` returns at start-up; F-6 then resolves it.
- Both fakes (§7.8) implement every operation above and run the same contract suite. That suite includes a restart test: the fake's state is rebuilt from its storage, and holds, markers and records must survive.

```ts
/** Only if Nova cannot hold an 18-dp account (K-11). The package's 18-dp sub-ledger (§9.2), kept per sending/receiving wallet:
 *  GL-4 `arc.gasDust.<w>` (P4D, P5), GL-2 `arc.<w>.subminor` and GL-4 `arc.receiptDust` (P9D). Every entry balances on its own. */
export interface GasDustStore {
  /** P4D: sub-minor gas remainder of one receipt; `wallet` is the transaction's sending wallet (the one whose GL-2 sub-account P4 credits). */
  record(key: IdempotencyKey, e: { readonly chainId: bigint; readonly txHash: Hex32; readonly wallet: WalletRef; readonly gasWei: NativeWei; readonly recognisedMinor: CbsMinor; readonly dustWei: NativeWei })
    : Promise<PortResult<{ readonly balanceWei: NativeWei }, KeyConflict>>;
  /** P9D: sub-minor remainder of one unidentified inbound log; DR `arc.<wallet>.subminor`, CR `arc.receiptDust`, both `dustWei`. Same key as the P9 journal. */
  recordReceiptDust(key: IdempotencyKey, e: { readonly chainId: bigint; readonly txHash: Hex32; readonly logIndex: bigint; readonly wallet: WalletRef; readonly valueWei: NativeWei; readonly recognisedMinor: CbsMinor; readonly dustWei: NativeWei })
    : Promise<PortResult<{ readonly subminorWei: NativeWei; readonly receiptDustWei: NativeWei }, KeyConflict>>;
  /** Clears j·k wei of `wallet`'s gas dust for sweep number `seq`; called only after Nova's P5 journal with the same key is OK (replayed or new). */
  sweep(key: IdempotencyKey, wallet: WalletRef, seq: bigint, sweptMinor: CbsMinor, sweptWei: NativeWei)
    : Promise<PortResult<{ readonly balanceWei: NativeWei }, KeyConflict | 'INSUFFICIENT_DUST'>>;
  balance(wallet: WalletRef): Promise<PortResult<{ readonly gasDustWei: NativeWei; readonly subminorWei: NativeWei; readonly nextSeq: bigint }, never>>;
  /** Rail-wide total of GL-4 `arc.receiptDust`, for the unidentified-receipts invariant. */
  receiptDustTotal(): Promise<PortResult<{ readonly receiptDustWei: NativeWei }, never>>;
}
```

`SIGNAL_CONFLICT` = same `dedupeKey`, different `payloadDigest` → QUARANTINE (someone is replaying a key with different content). `LEG_UNRESOLVED` means a terminal target or a P6 was requested for a leg whose submit marker is set while no DFNS entity is known. It is a programming error: QUARANTINE and page. Illegal transitions (for example `COMPLETED` → `SUBMITTED`) are refused, which is how out-of-order DFNS webhooks are made harmless.

Assumptions: the package may add tables (payments, legs with submit markers, inbox, outbox, cursor, rail state, operator decisions, nonce holds, move, funding and case records) to Nova's PostgreSQL through Nova's migration process [A-30]; Nova's `TransactionStatus` is exactly those five values [A-31]; there is no existing payments table that this should extend instead [A-32] (if there is, the port is implemented over it); Nova has, or accepts, a transactional outbox [A-33].

### 7.4 WalletRegistryPort (Nova `wallets` table)

```ts
export type WalletRole = 'TREASURY_HOT' | 'GAS_FLOAT' | 'CUSTOMER_DEPOSIT';   // CUSTOMER_DEPOSIT from D2
export interface WalletRecord {
  readonly walletRef: WalletRef;
  readonly owner: NovaOwnerRef | 'COMPANY';
  readonly network: NetworkId;
  readonly role: WalletRole;
  readonly address: NetworkAddress;
  readonly custody: { readonly provider: 'DFNS'; readonly walletId: string; readonly dfnsNetwork: 'ArcTestnet' };
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
}
export interface WalletRegistryPort {
  get(ref: WalletRef): Promise<PortResult<WalletRecord, 'NOT_FOUND'>>;
  findByAddress(network: NetworkId, address: NetworkAddress): Promise<PortResult<WalletRecord | null, never>>;
  list(network: NetworkId, role?: WalletRole): Promise<PortResult<readonly WalletRecord[], never>>;
  /** D2: seeds an ARC wallet at onboarding; idempotent per (owner, network, role). DFNS creates the wallet; this only records it. */
  register(key: IdempotencyKey, rec: Omit<WalletRecord, 'walletRef'>): Promise<PortResult<WalletRecord, KeyConflict | 'ADDRESS_TAKEN'>>;
}
```

`dfnsNetwork` is typed as the literal `'ArcTestnet'`; adding `'Arc'` is a mainnet-gate change (§11). Every record read is re-checked against DFNS `GET /wallets/{walletId}` (`network`, `address`, `status` = `Active`) [DF:get-wallet] before the first transfer from it, and the result cached per process start.

Assumptions: `wallets` has `user_id` and `deposit_address` today and no `network` column [A-20]; the company treasury wallet is (or can be) a row in the same table [A-21]; addresses are stored lower-case or can be normalised [A-22]; `balance-poller.ts` polls DFNS per wallet and attributes deposits [A-23] (G0b (b)).

### 7.5 ConversionPort and PayoutPartnerPort (journey, D5; fakes only in D1)

```ts
export interface RatioQuote { readonly numerator: bigint; readonly denominator: bigint }   // never a float [A-51]
export interface Quote {
  readonly quoteId: string;
  readonly from: { readonly asset: LedgerAssetCode; readonly amount: CbsMinor; readonly precision: CbsPrecision };
  readonly to:   { readonly asset: LedgerAssetCode; readonly amount: CbsMinor; readonly precision: CbsPrecision };
  readonly rate: RatioQuote;
  readonly remainder: CbsMinor;             // rounding remainder, posted to suspense by Nova's engine [A-51]
  readonly expiresAt: string;
  readonly provider: string;                // e.g. the OTC route used [A-53]
}
export interface ConversionPort {   // Nova fx-v2.ts + otc-routes.ts + buildConversionPostings [A-50]
  quote(key: IdempotencyKey, req: { readonly from: LedgerAssetCode; readonly to: LedgerAssetCode; readonly amount: CbsMinor; readonly side: 'FROM_EXACT' | 'TO_EXACT' }): Promise<PortResult<Quote, KeyConflict | 'NO_ROUTE' | 'LIMIT'>>;
  execute(key: IdempotencyKey, quoteId: string): Promise<PortResult<{ readonly conversionId: string; readonly journalIds: readonly string[]; readonly state: 'SETTLED' | 'PENDING' }, KeyConflict | 'QUOTE_EXPIRED' | 'INSUFFICIENT_FUNDS'>>;
  get(conversionId: string): Promise<PortResult<{ readonly state: 'SETTLED' | 'PENDING' | 'FAILED' }, 'NOT_FOUND'>>;
}

export interface PayoutPartnerPort {   // CPN-shaped STUB until an agreement exists; no real partner API is assumed
  createPayout(key: IdempotencyKey, req: { readonly beneficiaryRef: BeneficiaryRef; readonly currency: FiatCode; readonly amount: CbsMinor; readonly funding: { readonly network: NetworkId; readonly txHash: Hex32 } }): Promise<PortResult<{ readonly payoutId: string }, KeyConflict | 'BENEFICIARY_INVALID' | 'NOT_FUNDED'>>;
  getPayout(payoutId: string): Promise<PortResult<{ readonly state: 'PENDING' | 'PAID' | 'FAILED'; readonly reason: string | null }, 'NOT_FOUND'>>;
  /** Authenticity check of a partner callback over the raw body; the scheme is unknown until the agreement (Q-N12). */
  verifyCallback(rawBody: Uint8Array, headers: Readonly<Record<string, string>>): PortResult<{ readonly dedupeKey: string }, 'BAD_SIGNATURE' | 'STALE'>;
}
```

### 7.5a ReceiverPort (the receiver's choice; D1 resolves `STABLECOIN_WALLET` only)

```ts
export type ReceiverResolveCode = 'BENEFICIARY_UNKNOWN' | 'BENEFICIARY_INACTIVE' | 'NO_PAYOUT_PREFERENCE';
export interface ResolvedPayout {
  readonly payout: PayoutMethod;               // the method the receiver chose (fiat bank account or stablecoin wallet)
  readonly destination:                        // where the money lands, from the server-side record only
    | { readonly kind: 'ADDRESS'; readonly network: NetworkId; readonly address: NetworkAddress }
    | { readonly kind: 'BANK'; readonly beneficiaryRef: BeneficiaryRef };   // bank details stay in Nova; the partner gets only the ref
  readonly receiver: NovaOwnerRef | null;      // set when the receiver is a Nova customer. If the address is one of our wallets, it must be
                                               // customer-owned with owner = receiver (then P2I); a COMPANY-owned address is refused (§4.1)
  readonly preferenceVersion: string;          // frozen into the payment record
}
export interface ReceiverPort {   // over Nova's beneficiary / recipient records [A-41]
  resolvePayout(beneficiaryRef: BeneficiaryRef): Promise<PortResult<ResolvedPayout, ReceiverResolveCode>>;
}
```

`NO_PAYOUT_PREFERENCE` refuses the payment before anything is reserved; the package never picks a payout method on the receiver's behalf. Where Nova stores the receiver's preference (per receiver account, per beneficiary record, per payment link) is K-41.

### 7.6 InvoicePort (D3, later)

Named now so D1 does not paint it out: `findOpenByAddress`, `findOpenByReference`, `markPaid(key, invoiceId, paymentId)`. Matching must be unambiguous (ADR-006; G0b (c)) [A-60, A-61].

### 7.7 Error handling across ports

| Outcome | Orchestrator action |
|---|---|
| `OK` (`replayed` either way) | Continue |
| `REJECTED` business code (`INSUFFICIENT_FUNDS`, `QUOTE_EXPIRED`, `NO_ROUTE`, `BENEFICIARY_INVALID`) | Leg terminal with the mapped reason; release any reservation (P6). Never for an `ARC_TRANSFER` leg whose submit marker is set: that leg ends only through DFNS and the proofs of §8.4 check 3 (§13.3) |
| `REJECTED KEY_CONFLICT`, `SIGNAL_CONFLICT`, `BINDING_MISMATCH`, `UNBALANCED` | QUARANTINE the payment and page; these mean a bug or tampering |
| `REJECTED PRECISION_MISMATCH` (or `getAssetPrecision` ≠ configured `p`) | **PAUSE the rail** and page, before any further posting call. A precision mismatch is a rail-wide fault, not a per-payment one (RUBRIC MC-06) |
| `AMBIGUOUS` | Resolve by key lookup with backoff; after `A_ambiguous` (Q-N6) still unresolved → QUARANTINE |

### 7.8 Two fakes per port

| Port | Fake A | Fake B (structurally different) |
|---|---|---|
| LedgerPort | `MapLedger`: `Map<account, bigint>` balances, `Map<key, receipt>` | `EventLogLedger`: append-only journal array; balances recomputed by folding the log on every read; keys found by scan |
| PaymentStorePort | `MapPaymentStore`: mutable records with version counters | `EventSourcedPaymentStore`: stores only signals and transitions; the record is a fold; inbox is a sorted array with binary search |
| WalletRegistryPort | `MapWalletRegistry` keyed by ref | `ListWalletRegistry`: array with linear scans and an address index rebuilt on write |
| ConversionPort | `FixedRateConversion` (ratio fixed per pair) | `LadderConversion` (rate depends on amount band; quotes expire by a logical clock) |
| PayoutPartnerPort | `ImmediatePayout` (PAID on first poll) | `AsyncCallbackPayout` (PENDING until a signed callback is injected; HMAC with a key generated at test time) |
| GasDustStore | `CounterDustStore` (one running bigint balance + key map) | `LedgerRowDustStore` (row per receipt/sweep; balance = fold) |
| ReceiverPort | `MapReceivers` (ref → current preference) | `VersionedReceivers` (append-only preference history; resolves the latest version and returns its version id) |
| SecretPort (§8.3) | `StaticTestSecrets` (keys generated at test start with `node:crypto`) | `RotatingTestSecrets` (rotates mid-test; old webhook secret must fail after rotation) |
| DfnsTransport (§8) | `ScriptedDfns` (scripted status sequence per transfer) | `StatefulDfns` (state machine Pending→Executing→Broadcasted→Confirmed with injectable policy outcome and failures; enforces externalId rules of [DF:idem]: same body and `externalId` → `200` with the existing entity, different body → `409`; can drop a POST's response **after** creating the entity, or drop the POST **before** it arrives, so the R3-B1 tests of §13.3 run both ways) |

Each fake can inject `AMBIGUOUS` (after-commit and before-commit variants) so the "resolve by key" path is tested both ways. The shared contract suites live in `test/contract/*.contract.ts` and are what Nova's real adapters must also pass [A-34].

---

## 8. DFNS signer adapter and thin gateway

### 8.1 What DFNS does and what we do

DFNS holds the keys, evaluates policies, collects human approvals (passkeys) and signs and broadcasts. We never sign a blockchain transaction. Our gateway is the thin set of checks DFNS cannot do for us (kit-v3 CLAUDE.md "Approvals happen in Dfns"): chain-ID pin, binding to Nova's record, the replay rule, the wrapper-call rule, and the rail PAUSE state.

### 8.2 Calls used in D1 (all cited)

| Purpose | Call | Permission [DF:perms] | Source |
|---|---|---|---|
| Wallet check | `GET /wallets/{walletId}` → `id`, `network`, `address`, `status` (`Active`/`Inactive`/`Archived`) | `Wallets:Read` | DF:get-wallet |
| Balance | `GET /wallets/{walletId}/assets` → `balance` (string, base units), `decimals`, `kind`; `quotes.USD` is a float and is **never read** | `Wallets:Read` | DF:assets |
| Fee estimate (pre-check only) | `GET /networks/fees?network=ArcTestnet` → `maxFeePerGas`, `maxPriorityFeePerGas` as wei strings per `slow`/`standard`/`fast` | Bearer token. The archived OpenAPI has a file-level `security: []`, but the operation itself declares `security: - authenticationToken: []`, which overrides it. DF:perms names no specific permission for it. We send our standard headers | DF:fees |
| Transfer | `POST /wallets/{walletId}/transfers`, body per §8.5 | `Wallets:Transfers:Create` | DF:transfer |
| Status | `GET /wallets/{walletId}/transfers/{transferId}` | `Wallets:Transfers:Read` | DF:get-transfer |
| Recovery listing | `GET /wallets/{walletId}/transfers?limit=…&paginationToken=…` (`nextPageToken`) | `Wallets:Transfers:Read` | DF:list-transfers |
| Approval detail (EXPIRED vs REJECTED) | `GET /v2/policy-approvals/{approvalId}` | `Policies:Evaluations:Read` | DF:perms |
| User action | `POST /auth/action/init` (`userActionHttpMethod`, `userActionHttpPath`, `userActionPayload`), then `POST /auth/action` (`challengeIdentifier`, `firstFactor`) → `userAction` | — | DF:action-init, DF:action-sig, DF:flows |

Not called automatically: `PUT …/transfers/{id}/abort` and `POST …/transfers/{id}/cancel` [DF:abort, DF:cancel]. They exist only as **operator-initiated** actions (two-person, CF-31) in the stuck-transfer path (F-5). `POST …/transfers/{id}/speed-up` is never called by us at all.

**DFNS permission fact that limits this.** DFNS grants **Cancel transfer** (`POST …/transfers/{transferId}/cancel`) and **Speed up transfer** (`POST …/transfers/{transferId}/speed-up`) under **two** permissions [DF:perms]:
- `Wallets:Transfers:Read` ("Transfers: Read"), the same permission that grants Get and List transfers;
- `Wallets:Transactions:Create` ("Transactions: Create"), which also grants Sign and broadcast transaction, Cancel transaction and Speed up transaction.

A third permission, `Wallets:Transactions:Read` ("Transactions: Read"), grants **Cancel transaction** and **Speed up transaction** on the transactions API, alongside Get and List transactions [DF:perms].

DFNS's managed role `ManagedDefaultEndUserAccess` includes all three in its initial permission set [DF:perms]. That role is assigned by default to new end users; we assign it to no service account.

Neither SA-1 nor SA-2 may hold `Wallets:Transactions:Create` or `Wallets:Transactions:Read` (DFNS_SETUP §4 "Must NOT have"). Cancel needs a user-action signature [DF:cancel, `userActionSignature`], which a service account can produce with its own key. So SA-1, which must read transfer status, can also cancel or speed up a transfer, and DFNS permissions alone cannot enforce "operator-initiated, two-person". What we do about it:

- Our DFNS client has a closed allow-list of method + path templates (the rows of the table above). A request to any other path, including `…/cancel`, `…/speed-up` and `…/abort`, is refused inside the client, and a test asserts it. This protects against our own bugs, not against a stolen SA-1 credential.
- The monitor identity (SA-2) does **not** get `Wallets:Transfers:Read`; it cross-checks through wallet history and webhook events instead (DFNS_SETUP §4).
- Whether DFNS evaluates cancel and speed-up as `Wallets:Sign` activity, so that POL-1 forces human approval on them, is asked as Q-N15. Q-N15 also asks whether the cancel and speed-up grants under `Wallets:Transactions:*` can be withheld. Until DFNS answers, the residual risk is recorded: a stolen SA-1 credential can speed up (a same-nonce replacement at "10% bump or current Fast fees, whichever is higher" [DF:evm, "Speed up and cancel"]; [DF:create-transfers]) or cancel a broadcast transfer. Speed-up bypasses gateway check 7's fee ceiling; only the post-confirmation `effectiveGasPrice` check pages. Either replacement changes the transaction hash, which §6.5 and §6.7 turn into QUARANTINE and PAUSE (F-18).

Every request sends `Authorization: Bearer <token>`, `Content-Type: application/json` and a non-empty `User-Agent` (`Authorization: Bearer` per the `authenticationToken` security scheme in [DF:transfer securitySchemes]; `Content-Type` and `User-Agent` per [DF:api-index]); state-changing calls also send `X-DFNS-USERACTION` [DF:transfer securitySchemes; DF:flows]. Base URL is a config value from {`https://api.dfns.io`, `https://api.uae.dfns.io`} [DF:regions]; the region is an admin answer (DFNS_SETUP §1). Because one DFNS environment serves mainnet and testnet [DF:regions], **testnet-only is enforced per wallet** (§8.4 check 1), not per host.

### 8.3 Service-account authentication

- The adapter authenticates as a DFNS service account: bearer token plus a private key used only to sign user-action challenges [DF:sa]. Key type Ed25519 or ECDSA P-256 (RSA ≥ 2048 also accepted), public key uploaded as PEM SPKI [DF:sa]. Token and private key are read **only at runtime** from the secret store through a `SecretPort`; tests generate throwaway keys with `node:crypto.generateKeyPairSync` at test time.
- Signing flow per state-changing call [DF:flows, DF:sign-req]: init the challenge with the exact method, path and JSON body we will send; sign; exchange for a single-use `userAction` token; send it. The challenge expires 15 minutes after issue and is single-use [DF:sign-req], so the body we sign is the body we send, byte for byte (we serialise once and reuse the bytes).
- Credential kind `Key` [DF:action-sig]. The `clientData` shape differs between two DFNS pages (Q-N7); the implementation keeps both encodings behind one function, picks the one DFNS confirms, and a contract test pins it.
- Rate limits: honour `Retry-After` on 429; limit is per organisation over 60 s [DF:rate].

### 8.4 Gateway checks (before every `POST …/transfers`)

1. **Chain-ID pin.** Config `chainId` = 5042002 (C-01) **and** DFNS `GET /wallets/{walletId}` returns `network` = `ArcTestnet` and `status` = `Active` **and** `address` = the binding's `fromAddress`. The transfer body has no network field [DF:evm], so the wallet check is the only pin available. A wallet on `Arc` (mainnet) is refused with `NETWORK_DISABLED` unless the mainnet gates pass (§11).
2. **Binding.** `walletId`, `to`, `amount`, asset kind are read **only** from the stored `PaymentRecord.binding`, never from the request or a webhook. The gateway recomputes `binding.digest` and compares; a mismatch → `BINDING_MISMATCH` → QUARANTINE. It also checks that the reservation is still **open**, so DFNS is never asked to move money Nova has not set aside or has already released. All of these must hold, or the submission is refused before any DFNS call:
   - the Nova reservation journal (P1) exists by key (`getJournalByKey('pay:<id>:p1')` returns a receipt);
   - **no** release journal exists: `getJournalByKey('pay:<id>:p6')` returns null. An `AMBIGUOUS` answer counts as "exists" and refuses;
   - the `ARC_TRANSFER` leg is **not terminal** (`COMPLETED`, `REJECTED`, `EXPIRED`, `CANCELLED`), and no P6 outbox item is pending for it;
   - the payment's stage is not terminal.

   A refusal here is `RESERVATION_NOT_OPEN`. If the leg looks non-terminal while a P6 journal exists, the record is inconsistent: QUARANTINE and page. For a P10 move, the P1 lookup is replaced by the approved move record (`getMove`), which must exist with its `APPROVE_MOVE` decision recorded, and the move's leg must not be terminal.
3. **Replay rule, submit marker and release proofs.**

   **One DFNS request per payment (R3-B2, option (i)).** `externalId` = `deriveExternalId(paymentId)` (§10.2; `attempt` is always `1n`). A payment's binding is submitted to DFNS as **one** transfer request in the payment's whole life. There is no attempt 2. Every proof below, (a), (b) or (c), and a status-0 receipt, **ends the payment**: the leg goes terminal and P6 is enqueued in the same `applySignal` commit. A retry is always a **new payment** with a new client `Idempotency-Key`, so it has a new `paymentId`, a new P1, new ledger keys, a new binding and a new `externalId` (§10.2). It is created by the payer, or by Ops on the payer's instruction, only after this payment is terminal with P6 posted. The same holds for a P10 move: a retry is a new approved move record with a new `moveId`.

   **Submit marker (R3-B1).** After checks 1, 2 and 4–7 pass, and **before** the `POST …/transfers`, the gateway commits the leg's `SubmitMarker` (§7.3) through `markSubmit`. The marker holds the `externalId`, the digest of the exact body bytes, and a head block both sources agree on. The POST is sent only after `markSubmit` returns `OK`. On `AMBIGUOUS` the gateway reads the record back: it POSTs only if the marker is there, and never otherwise. From that commit on, the leg is treated as "a DFNS request may exist":
   - **UNRESOLVED** (marker set, `externalRef` null). No path may post P6 or move the leg to a terminal stage. This includes `QUOTE_EXPIRED`, `CANCELLED_BY_OPERATOR`, every pre-request reason and every timer. The store enforces it too (`LEG_UNRESOLVED`, §7.3).
   - **How it resolves.** Only by finding the DFNS entity with this `externalId`, in one of three ways:
     - **Re-POST** the same bytes (same URL, same body, same `externalId`) with a fresh user-action signature, which travels in the `X-DFNS-USERACTION` header and not in the body [DF:transfer securitySchemes]. DFNS documents this for exactly our case: re-submitting "in case a network error (or other) prevented you to get our server's response, even if your request has actually been processed by DFNS". With "same url, same body, including same `externalId`" DFNS answers `200` "containing the entity which was already created"; after a terminal status DFNS "returns the existing entity with a `200` response—it does not create a new transaction or retry the failed one" [DF:idem]. If the first POST never reached DFNS, the re-POST is simply the first request DFNS sees, and it creates the entity (our reading; Q-N21 asks DFNS to confirm that no response class other than `200`/`202` creates an entity).
     - **A DFNS webhook** for a transfer whose `externalId` equals the marker's (`findByExternalId`), confirmed by GET (§8.7).
     - **A listing** (`GET /wallets/{walletId}/transfers` [DF:list-transfers]) that shows an entity with this `externalId`. A listing that does **not** show it proves nothing (Q-N21).
   - **After resolution** the entity's id is stored as `externalRef`, and the leg follows the normal path: §8.6 and the proofs below. An expired quote or an operator's wish to cancel is then carried out through DFNS: the approvers deny (proof (a1)), or an operator aborts while the transfer is unsigned (proof (a2)). Neither ever ends the leg directly.
   - **Re-POST rules.** A re-POST is not a new submission. It sends the marker's bytes only, never a rebuilt body, and checks that their digest equals `bodyDigest`. It runs checks 1, 2, 4, 6 and 7, the rail-PAUSE part of check 5 and the nonce-hold part of check 5, because a re-POST that reaches DFNS for the first time creates a transfer. While the payment is QUARANTINED, only the webhook and listing lookups run. A re-POST then needs a two-person `LIFT_QUARANTINE` decision first. A `409` [DF:idem] is QUARANTINE and page. An unresolved leg after `A_ambiguous` (Q-N6) is QUARANTINED and paged with an `UNRESOLVED_SUBMIT` case. It stays non-terminal however long it takes.

   **Release proofs.** P6, and every terminal stage after the marker, need exactly one of the three proofs below, or a status-0 receipt on both sources (F-3c). The same standard governs P6, F-3b, F-4 and §13.3.

   **"Matching unlinked log"**, used in (b) and (c): a canonical log from the sending wallet that meets all of these:
   - its `(to, value)` equals the binding;
   - it is not linked by DFNS hash to another payment or to an approved internal move;
   - it is in our indexer, complete up to the block in question.

   - **(a) Never signed.** DFNS shows that no signature exists for this transfer. Exactly two cases count:
     - **(a1)** DFNS `Rejected`. A transfer reaches it only from `Pending`, by a policy or approval rejection, before execution starts [DF:monitoring: `Pending → Rejected`, "Blocked by policy or approval rejected"].
     - **(a2)** DFNS `Failed` with no `txHash` and no `dateBroadcasted`, after an operator abort that DFNS accepted for this transfer id. An abort is accepted only for a transfer that "is currently in 'Executing' status and has not yet been signed" [DF:abort]. The accepted abort is recorded in the two-person case (F-2, F-5): transfer id, DFNS response status and time.
     
     A hash-less `Failed` without an accepted abort is **not** proof (a):
     - `Failed` also covers "system failure to complete the request" [DF:get-transfer];
     - a missing `txHash` shows only that the failure was off-chain [DF:idem];
     - DFNS cancels such a transfer by "Extracting the nonce from the original transfer's signed data" to "Consume the nonce that was reserved but not used" [DF:cancel]. So it may already hold signed bytes for a reserved nonce, and if those bytes reached a node they can still be mined.
   - **(b) Nonce consumed by another transaction.** The transfer has a `txHash`, and all of these hold at a block both sources agree on:
     - the account nonce of the sending wallet (`eth_getTransactionCount`) is above the transfer's nonce;
     - neither source has a receipt for the transfer's `txHash`;
     - there is **no** matching unlinked log. So the nonce was not used by a speed-up replacement that delivered the money (F-18).
     
     The nonce comes from DFNS `details` [DF:get-transfer] or from either source's view of the pending transaction. If we cannot establish it, there is no proof.
   - **(c) Reserved nonce resolved.** This applies to every other DFNS `Failed` with no `txHash`. It is proof (b) generalised to a transfer without a hash:
     - **Nonce.** Take the nonce `n` from the transfer's DFNS `details` ("Structured representation of the data used to construct the signature (e.g. nonce, gas parameters)" [DF:get-transfer]). It must parse as a non-negative integer; it is the only source, because without a hash neither RPC source can show the transaction.
     - **Check.** At a block `B` that both sources agree on, the account nonce of the sending wallet is above `n`, and there is **no** matching unlinked log up to `B`.
     - **What consumes `n`.** Typically one of two things:
       - an operator cancel that burns `n` (the nonce-burn step in F-3b);
       - DFNS reusing `n` for a transfer from the same wallet that was already in flight when the nonce hold of check 5 began. After that, no new submission can take `n`. DFNS says it "automatically frees any nonce it reserved for the failed transfer" [DF:idem]; Q-N20 asks which behaviour applies.
     - **If the original landed.** If a matching unlinked log exists, the signed original landed. Nothing is released: the hash is linked by the two-person decision of §6.5 rule 1, and the payment completes.
     - **Unknown nonce.** If `details` holds no parseable nonce, there is **no** proof: the payment is QUARANTINED, and only a two-person decision with DFNS's written answer for that transfer can close it (Q-N20).

   "No log seen yet" is **never** proof: a transaction can still land after any timer. Without (a), (b) or (c) the transfer stays open, and only a two-person decision with that evidence can close it. A broadcast transfer stays at `CONFIRMING`, QUARANTINED after `T_pending`. A hash-less `Failed` transfer keeps its stage and is QUARANTINED at once. Whatever the proof, its result is the end of **this** payment (terminal stage plus P6), never a second DFNS request for it. This follows DFNS: "Never submit a second Transfer Asset request to 'retry' a transfer that has not reached a terminal status" [DF:create-transfers], and after a terminal status the `externalId` is permanently bound [DF:idem].
4. **Wrapper-call rule.** D1 submits only plain value transfers (`kind` `Native`, or `Erc20` to C-12 if Q-N1 says so). Any other kind, any contract call (`Memo` C-62, `Multicall3From` C-63, Permit2 C-65) and any calldata is refused with `CONTRACT_CALL_NOT_ALLOWED`. When a later milestone enables one, it must be allow-listed by exact address in both the DFNS policy and our gateway, and the gateway must decode the inner call(s) and check target = USDC (C-12) or an approved settlement contract, recipient = binding `to`, amount = binding amount; tamper tests (swapped recipient, changed amount, extra inner call, different target) must all be refused (kit-v3 CLAUDE.md "Wrapper-call signing rule").
5. **Rail state and wallet nonce hold.** All of these must hold:
   - the rail is not PAUSED;
   - the payment is not QUARANTINED;
   - the indexer has been healthy (no stall, no disagreement) within the last `A_fresh`;
   - the sending wallet is not on a **nonce hold**. A violation is refused with `WALLET_NONCE_HOLD`.
   
   **When a hold starts.** A wallet goes on hold as soon as any DFNS transfer from it is seen as either of these:
   - `Failed` with no `txHash`, aborted or not;
   - terminal with no `txHash` and a nonce in `details`.
   
   **Where it lives.** The hold is a `WalletNonceHold` row (§7.3), written in the same transaction as the DFNS signal that starts it (`applySignal` with `placeHold`). This check reads the holds from the store (`listActiveHolds`) on every submission, never from memory. While the hold is active, the orchestrator reads the account nonce at agreed blocks and records each reading (`recordHoldObservation`). The latest block with account nonce ≤ `n` and the first block with account nonce > `n` bound the block window in which nonce `n` was used. The lower bound starts at the leg's `markedAtBlock`. F-3b step 4a searches that window.

   **When it lifts.** At a block both sources agree on, the account nonce must be above that transfer's nonce `n`, and the nonce-`n` transaction must be located and its gas posted, or shown to be a transaction already linked elsewhere (F-3b step 4a). For a non-aborted transfer, the rest of proof (c) must also hold, or a two-person link has been recorded (§6.5 rule 1). With no parseable `n`, the hold lifts only by a two-person decision with DFNS's answer (Q-N20).
   
   **Why we hold.** The archive gives two behaviours for an unused reserved nonce, and both need the hold:
   - **DFNS keeps `n` reserved.** Resources "are locked before broadcast and released only once the transaction is confirmed, cancelled, or identified as failed", and cancel exists "to burn the reserved nonce and unblock subsequent transactions" [DF:evm]. Then every later transfer from the wallet would be signed above a gap and never mined, so each one would become a stuck payment.
   - **DFNS frees `n` and reuses it** for the next transfer [DF:idem]. Then that next payment's transfer and a possibly-signed original compete for one nonce.
   
   **While the hold lasts:**
   - transfers from the wallet that are already broadcast simply wait, because their timers release nothing (F-4);
   - every new submission from the wallet is refused, and a page is raised;
   - the operator runs the nonce-burn step of F-3b.
   
   In D1 the only sending wallet for payments is `TREASURY_HOT`, so a hold stops outbound payments until the nonce is resolved.
6. **Network precheck.** `ArcNetworkAdapter.precheck`: destination not zero (C-54), not a self-transfer (`to` = the sending wallet's own address, which emits no log, C-24; a transfer to a **different** wallet of ours is allowed only when that wallet is customer-owned and its owner is the payment's `receiver`; it is classified `INTERNAL`, §6.1, and settled by P2I. A destination that is a COMPANY-owned registry wallet, or a customer wallet whose owner is not the receiver, is refused with `DESTINATION_NOT_ALLOWED`; company-to-company moves are P10 only, with their own approved move record, and for a P10 move the rule is reversed: both wallets must be COMPANY-owned. This ownership part is checked by the gateway through `WalletRegistryPort.findByAddress`, not by the network adapter, because it is not Arc-specific), not a precompile (Q-A14, our own rule), sender and recipient not on the local blocklist copy (C-28, C-53, Q-A5); a blocklist copy older than `A_blocklist` → `BLOCKLIST_STALE` (fail closed). D1 seeds the copy with the documented test address C-55 until the event mirror (Q-A5) exists.
7. **Fee pre-check.** DFNS transfers accept no gas override, only `priority` [DF:create-transfers]. We send `priority: 'Standard'` and, before submitting, read `GET /networks/fees`; if `standard.maxFeePerGas` (parsed as `bigint` from the wei string) exceeds our ceiling `arc.feeCeilingWei` (Q-N8; must be ≥ the 20 gwei floor C-30 and ≤ the 20,000 gwei max base fee C-31) the submission waits and is retried later, never sent. After confirmation, the receipt's `effectiveGasPrice` is checked against the same ceiling; a breach pages (it cannot be undone).

### 8.5 Transfer body

```ts
// Native (default until Q-N1 answers otherwise):
{ kind: 'Native', to: binding.to, amount: binding.amount.toString(10), priority: 'Standard', externalId }
// Erc20 (only if DFNS confirms ERC-20 on ArcTestnet, Q-N1):
{ kind: 'Erc20', contract: '0x3600000000000000000000000000000000000000', to: binding.to, amount: usdcUnits.toString(10), priority: 'Standard', externalId }
```

`amount` must match `^\d+$` [DF:transfer]; it is produced from a `bigint` with `toString(10)` and checked against that pattern before sending. For `Native`, the meaning of the amount on Arc (18-dp wei, C-10) is **unconfirmed by DFNS** (Q-N2), so D1's live slice is blocked on Q-N1/Q-N2; everything else runs against fakes. For `Erc20`, `amount` is `UsdcUnits` from `nativeWeiToUsdcUnits`, and a non-zero remainder is refused (the binding amount is built from ledger minor units, so with p ≤ 6 it is always exact). No `memo` is sent (C-64; Q-N10). `travelRule` and `feeSponsorId` are not sent in D1.

### 8.6 DFNS status → our stage (input only, never completes)

DFNS transfer statuses are `Pending`, `Executing`, `Broadcasted`, `Confirmed`, `Failed`, `Rejected`, with transitions Pending→Executing→Broadcasted→Confirmed, Pending→Rejected, Executing→Failed, Broadcasted→Failed [DF:transfer, DF:monitoring].

| DFNS status (from GET, or a verified webhook that we then confirm with GET) | Arc leg stage | Notes |
|---|---|---|
| (submit marker committed, POST sent, no DFNS entity known yet: response lost, timeout, transport error, 5xx, or a 4xx other than `409`) | `CREATED`, **UNRESOLVED** (§8.4 check 3) | A DFNS request may exist. No terminal stage, no P6 and no timer release. Resolved only through the `externalId`: re-POST of the same bytes, a webhook confirmed by GET, or a listing that shows the entity (F-6). A `409` → QUARANTINE |
| (POST returned, status `Pending`) | `PENDING_APPROVAL` | Policy approval pending. POST may also answer `202` for policy-pending per DF:errors; both are handled the same (Q-N11) |
| `Executing` | `APPROVED` | Policy resolved (`datePolicyResolved`), DFNS is constructing or signing. An operator abort is possible only here, and only while unsigned [DF:abort] |
| `Broadcasted` (with `txHash`) | `SUBMITTED`, then `CONFIRMING` once our indexer has the tx hash on its watch list | A later poll showing a different `txHash` or a `replacementId` [DF:get-transfer] for the same transfer → F-18 |
| `Confirmed` | stays `CONFIRMING` | **Cross-check only.** `COMPLETED` comes from §6.5. If DFNS says `Confirmed` and our indexer has nothing after `A_xcheck`, → QUARANTINE (F-9) |
| `Rejected` + approval `Denied` | `REJECTED`, `APPROVAL_DENIED` | Proof (a1) of §8.4 check 3 → P6 |
| `Rejected` + approval `Expired` (via `approvalId`) | `EXPIRED`, `APPROVAL_EXPIRED` | Proof (a1) of §8.4 check 3 → P6. Whether an auto-reject timeout shows up this way is Q-N3; until confirmed, an undeterminable case maps to `REJECTED` and pages |
| `Failed`, no `txHash`, `dateBroadcasted` absent, **after an operator abort DFNS accepted** for this transfer | `CANCELLED`, `CANCELLED_BY_OPERATOR` | Never signed [DF:abort]. This is proof (a2) of §8.4 check 3, so the reservation is released (P6). The wallet nonce hold (§8.4 check 5) still applies until the account nonce has passed any nonce shown in `details` |
| `Failed`, no `txHash`, any other case | Stage unchanged (`CREATED`, `PENDING_APPROVAL` or `APPROVED`); payment QUARANTINED; wallet nonce hold | It may be signed with a reserved nonce [DF:cancel], so **nothing is released on this status**. We run the F-3b nonce-burn procedure, which ends in one of two ways. If proof (c) of §8.4 check 3 holds, the leg goes to `REJECTED` with `DFNS_FAILED` (or `BLOCKLISTED_PRE_MEMPOOL` if `reason` or our precheck shows a blocklisted party), and P6 follows. If the signed original landed instead, its hash is linked by a two-person decision and the leg moves to `CONFIRMING`, then to `COMPLETED` by §6.5. **No DFNS status releases anything by itself.** Once the submit marker is set, every P6 needs proof (a), (b) or (c) of §8.4 check 3, or a status-0 receipt on both sources, and no P6 at all is possible while the leg is UNRESOLVED |
| `Failed` with a `txHash` (on-chain failure [DF:idem]), or after `Broadcasted` | `CONFIRMING` held; outcome decided by our indexer | Receipt `status 0` → `REJECTED`, `ONCHAIN_REVERTED` with gas posted; no receipt **and** proof (b) of §8.4 check 3 → `EXPIRED`, `UNDER_FEE_FLOOR_DROPPED` (F-4), or, when the nonce was consumed by a DFNS cancel recorded in a two-person case, `CANCELLED`, `CANCELLED_ONCHAIN_REPLACED` (F-18). Without proof (b) it stays `CONFIRMING` and is QUARANTINED; it is never released on a timer |

### 8.7 DFNS webhooks: `POST /webhooks/dfns` (cross-check and wake-up only)

1. Read the **raw** body bytes (size-capped). Reject without parsing if `X-DFNS-WEBHOOK-SIGNATURE` is missing or not `sha256=<64 hex>`.
2. Compute `HMAC-SHA256(secret, rawBody)` and compare with `crypto.timingSafeEqual` on equal-length buffers [DF:webhooks-guide]. DFNS's own example HMACs a re-serialised `JSON.stringify(parsed)` rather than the raw bytes (Q-N4); the verifier accepts **only** the raw-body match unless DFNS confirms otherwise, so a mismatch fails closed (401, alert), it never silently falls back.
3. Parse, then reject if `|now − timestampSent| ≥ 300 s` (DFNS example's tolerance) [DF:webhooks-guide].
4. Ingress allow-lists DFNS's webhook origin IP for the configured region (Europe: `35.181.116.68`) [DF:regions] as a second layer, not the only one.
5. **Dedupe on the entity, not the event id**: each retry is a new event with its own id, carrying `deliveryAttempt` and `retryOf` [DF:events]. The key is `dfns:transfer:<transferRequest.id>:<status>` for `wallet.transfer.*`, and `dfns:approval:<approvalId>:<status>` for `policy.approval.*`. Event id is stored for audit only. The `payloadDigest` is computed over the normalised entity projection of §10.3, never over the envelope, so a webhook and the follow-up GET of the same state produce the same digest.
6. The webhook body is a **hint**. The handler re-reads the transfer with `GET /wallets/{walletId}/transfers/{transferId}` and applies that result through `applySignal` (source `DFNS_POLL`). So a forged-but-valid-HMAC body (leaked secret) still cannot inject a state DFNS does not hold, and can never complete a payment (§2 rule 6).
7. Unknown or unsubscribed `kind` → 200, stored, alert, no state change. Answer exactly **200** only after the inbox commit: DFNS treats anything other than 200 as a failed delivery and retries, up to 5 total attempts over 24 hours [DF:events]. Verification failures answer 401 (F-13).

A poller (`listOpen('ARC_TRANSFER', …)` + `GET` transfer) runs anyway, so lost webhooks only add latency.

---

## 9. Ledger postings

### 9.1 GL roles (names per kit-v3 CLAUDE.md; mapping to Nova accounts is config [A-06])

| Role | Meaning | Normal side | Sub-accounts |
|---|---|---|---|
| GL-1 | Customer USDC liability (Nova customer balance) | Credit | one per Nova account [A-02] |
| GL-2 | Company USDC asset, one sub-account per holding location | Debit | `arc.<w>`: **one per DFNS wallet `w` on Arc** in the wallet registry, where `<w>` is the wallet tag of §10.2. In the templates, `arc.hot` is shorthand for `arc.<binding.fromWallet>`, the sending wallet of the payment (`TREASURY_HOT` in D1). `arc.<from>` and `arc.<to>` name the sub-account of a log's or transaction's sending or receiving wallet. `partner.<partnerId>`: USDC sent to a payout partner and not yet paid out (journey D5). `partnerClaim.<partnerId>`: USDC a partner holds after a failed payout whose payer was already refunded (P11, F-17), that is, our claim on the partner. In the 18-dp sub-ledger only: `arc.<w>.subminor`, the sub-minor part of unidentified receipts held on wallet `w` (P9D) |
| GL-3 | Network fee (gas) expense | Debit | `arc`; in the package's 18-dp gas-dust sub-ledger only: `arc.unrecognised` |
| GL-4 | Suspense | Credit (normally) | `arc.gasDust.<w>`: 18-dp remainder of gas paid by wallet `w` and not yet recognised at ledger precision, kept in the sub-ledger. `arc.unidentified`: inbound to a company wallet that matches nothing (from D1), and customer deposits that cannot be attributed (from D2). In the 18-dp sub-ledger only: `arc.receiptDust`, the sub-minor remainder of unidentified receipts |
| GL-5 | Clearing / in-flight | Credit | `arc.outbound` |
| GL-6 | Fee income | Credit | `payments` |
| GL-7 | Company-owned USDC funding, brought in **from outside the wallet registry** (it funds the gas float and the hot wallets) | Credit | — |

Ledger amounts are `CbsMinor` at Nova's USDC precision `p` [A-01], `k = 10^(18 − p)`. Network amounts are `NativeWei`. Conversions only via U1: outbound amounts are built **from** minor units (`cbsMinorToNativeWei`, exact), so the transfer amount never has dust; only gas does.

### 9.2 Templates (every row balances: Σ DR = Σ CR, all amounts > 0, integers)

`A` = amount to receiver (minor), `F` = customer fee (minor, may be 0 → leg omitted), `G` = gas in wei from the receipt, `(g, d) = nativeWeiToCbsMinor(G, p)` so `G = g·k + d`, `0 ≤ d < k`.

| ID | When | Debit | Credit | Amount |
|---|---|---|---|---|
| P1_RESERVE | Payment accepted, before DFNS is called | GL-1 payer | GL-5 `arc.outbound` | A + F |
| P2_SETTLE_EXTERNAL | Payment `COMPLETED`, receiver's payout `STABLECOIN_WALLET` external: on the Arc leg's `COMPLETED` (§6.5). Payout `FIAT_BANK`: on the `PAYOUT` leg's `PAID` (then the credit is GL-2 `partner.<id>`, not `arc.hot`) | GL-5 `arc.outbound` | GL-2 `arc.hot` (or `partner.<id>`) | A |
| P2I_SETTLE_INTERNAL | Arc leg `COMPLETED`, receiver is a Nova customer whose wallet is ours: the destination wallet is customer-owned and its owner equals `ResolvedPayout.receiver` (§4.1). A COMPANY-owned destination never reaches P2I; it is refused with `DESTINATION_NOT_ALLOWED` before P1 | GL-5 `arc.outbound` / GL-2 `arc.<receiverWallet>` | GL-1 receiver / GL-2 `arc.hot` | A / A |
| P2P_PARTNER_FUNDED | Arc leg `COMPLETED` when the receiver chose `FIAT_BANK` (USDC now at the payout partner, payout not yet made) | GL-2 `partner.<id>` | GL-2 `arc.hot` | A |
| P2R_PARTNER_RETURN | F-17 only. The partner returns the USDC: an `INBOUND` log from the partner's settlement address [A-52] to one of our wallets, whose `(from, to, value)` matches exactly an open F-17 case record approved by two people (§6.1), with `value = cbsMinorToNativeWei(A, p)`. A return of any other value does not match; it goes to P9 and the case stays open. If P11 was already posted for the payment (second branch of F-17), the credit is GL-2 `partnerClaim.<id>` instead, and no second P6 follows | GL-2 `arc.<to>` | GL-2 `partner.<id>` (or `partnerClaim.<id>` after P11) | A |
| P3_FEE | With P2/P2I | GL-5 `arc.outbound` | GL-6 `payments` | F |
| P4_GAS (Nova journal) | Receipt of **any** transaction one of our wallets sent (status 1 **or** 0). That covers a payment, an internal move (P10), a DFNS cancel or a speed-up replacement. The credit is **always the sending wallet's own sub-account**: the wallet whose account nonce the transaction used, which pays the gas | GL-3 `arc` | GL-2 `arc.<from>` | g (journal omitted if g = 0) |
| P4D_GAS_DUST (gas-dust sub-ledger, 18 dp, kept by the package [A-11]) | Same receipt | GL-3 `arc.unrecognised` (wei) | GL-4 `arc.gasDust.<from>` (wei) | d (omitted if d = 0) |
| P5_DUST_SWEEP (Nova journal + sub-ledger entry, one key, per wallet `w`) | GL-4 `arc.gasDust.<w>` balance ≥ k wei | Nova: GL-3 `arc` · sub-ledger: GL-4 `arc.gasDust.<w>` | Nova: GL-2 `arc.<w>` · sub-ledger: GL-3 `arc.unrecognised` | Nova: j = ⌊dust(w)/k⌋ minor · sub-ledger: j·k wei |
| P6_RELEASE | Leg terminal without funds leaving, **proven** per §8.4 check 3. Proof is one of: (a) never signed; (b) nonce consumed by another transaction, with no matching log; (c) reserved nonce resolved, with no matching log. P6 also follows `ONCHAIN_REVERTED`, a status-0 receipt on both sources. For `FIAT_BANK`, P6 also follows P2R, after the partner has returned the USDC, or comes with P11 on a two-person `CLOSE_PARTNER_UNRETURNED` decision (F-17). **Never** on a DFNS status alone, never on a timer, and never while the Arc leg is UNRESOLVED (submit marker set, no DFNS entity known, §8.4 check 3). **P6 ends the payment.** It is enqueued in the same `applySignal` commit that makes the leg terminal, and once it exists gateway check 2 refuses any further DFNS request for this payment. A retry is a new payment with its own P1 (§8.4 check 3) | GL-5 `arc.outbound` | GL-1 payer | A + F |
| P7_COMPENSATE | Business reversal of a SETTLED payment (status `REVERSED`) | mirror of the original P2/P3 legs with sides swapped, `refs.compensates` = original journal | | same amounts |
| P8_EXTERNAL_FUNDING | Company USDC brought in **from outside the wallet registry**, for example a testnet faucet or an external treasury address, to fund a company wallet (no fee sponsor in D1, so each sending wallet pays its own gas). Posted only on an `INBOUND` log (`from` ∉ registry) whose `(from, to, value)` matches an approved funding record exactly (CF-33; `ApprovedFundingRecord`, §7.3, claimed by `claimInbound`), with `value = cbsMinorToNativeWei(M, p)`. **Never** posted for an `INTERNAL` log: a move between two of our wallets is P10 | GL-2 `arc.<to>` | GL-7 | M, as approved |
| P9_UNIDENTIFIED_RECEIPT (Nova journal) | `INBOUND` log to a company wallet that matches no approved record and no open case (§6.1). The rail is **not** paused; Ops gets a case | GL-2 `arc.<to>` | GL-4 `arc.unidentified` | m, where `(m, r) = nativeWeiToCbsMinor(value, p)` (journal omitted if m = 0) |
| P9D_RECEIPT_DUST (18-dp sub-ledger, same key, `GasDustStore.recordReceiptDust`) | Same log | GL-2 `arc.<to>.subminor` (wei) | GL-4 `arc.receiptDust` (wei) | r (omitted if r = 0) |
| P10_INTERNAL_MOVE | An `INTERNAL` log (both wallets ours) linked by DFNS hash to an approved internal move record (CF-33; `ApprovedMoveRecord`, §7.3; for example `GAS_FLOAT` → `TREASURY_HOT`). The move is submitted through the same gateway checks as a payment, with its own binding. In check 2, the P1 reservation lookup is replaced by a lookup of the approved move record. Its amount is built from minor units, so `value = cbsMinorToNativeWei(X, p)` exactly and there is no dust. The move's gas is P4/P4D, credited to the source wallet | GL-2 `arc.<dest>` | GL-2 `arc.<source>` | X |
| P11_PARTNER_CLAIM | F-17 second branch only: the payout failed, the partner has not returned the USDC, and two people record `CLOSE_PARTNER_UNRETURNED` on the open `PARTNER_RETURN` case. It is posted with the payment's P6 under the same decision, so the payer is refunded at once and the partner's balance becomes a named claim. The case stays open for a later return (P2R credits the claim) | GL-2 `partnerClaim.<id>` | GL-2 `partner.<id>` | A |

Gas dust handling. Nova's ledger recognises gas only in whole minor units (P4). The sub-minor remainder `d` of every receipt goes to the named suspense account GL-4 `arc.gasDust.<from>` of the paying wallet (P4D). That account sits in a small 18-dp sub-ledger kept by the package, with one record per receipt (`txHash`, wallet, `G`, `g`, `d`). Whenever a wallet's suspense balance reaches one whole minor unit (k wei), P5 does two things for that wallet under one idempotency key: it recognises `j` minor units in Nova, and it clears `j·k` wei from suspense. Nothing is dropped. Every entry in both books balances on its own. The reconciliation invariants are:

- **Chain, per DFNS wallet `w`:** on-chain wei of `w` = GL-2 `arc.<w>` (Nova, minor) × k − GL-4 `arc.gasDust.<w>` (wei) + GL-2 `arc.<w>.subminor` (wei). A P10 move of `X` from source `s` to destination `t`, with gas `G = g·k + d`, works out as follows. For `s`: `−X·k − g·k − d` on both sides. For `t`: `+X·k` on both sides. GL-7 is untouched.
- **Expense:** Σ receipt gas `G` (wei) = GL-3 `arc` (Nova, minor) × k + Σ_w GL-4 `arc.gasDust.<w>` (wei).
- **Unidentified receipts:** Σ unidentified inbound value (wei) = GL-4 `arc.unidentified` (Nova, minor) × k + GL-4 `arc.receiptDust` (wei), less whatever Ops has resolved by a two-person case (return, or attribution in D2), each resolution being its own balanced entry in both books.

`arc.receiptDust` is never swept into income automatically: who owns sub-minor receipt dust is the same human question as deposit dust (K-13). Without P9/P9D, one unsolicited inbound transfer (anyone can send to a public address) would break the chain invariant and PAUSE the rail; with them it is a case, not an outage.

If `p = 18` [A-01], then `k = 1`, `d` and `r` are always 0, and P4D/P5/P9D never fire. If Nova's ledger can hold an 18-dp account itself, GL-4 lives in Nova instead of the package [A-11]; the invariants are the same.

Who pays gas: the company (GL-3), from the gas float funded by GL-7 (CONTRACT §2 rationale). Charging it to the customer goes through `F` in the quote, never by debiting GL-1 after the fact (K-12).

### 9.3 Reconciliation hooks

- Per payment: `P1 = P2 + P3` or `P1 = P6` (clearing nets to zero per payment). For `FIAT_BANK`, clearing stays open from P1 until one of two things happens: the payout is `PAID` (P2 + P3), or the partner has returned the USDC (P2R, then P6). Meanwhile the USDC sits in GL-2 `partner.<id>` via P2P, reconciled against the partner's statement (K-52). After P2R, `partner.<id>` nets to zero for that payment (P2P DR A, P2R CR A). In F-17's second branch the payment closes with P6 plus P11 instead: clearing nets to zero (`P1 = P6`), `partner.<id>` nets to zero (P2P DR A, P11 CR A), and `partnerClaim.<id>` holds A until a return (P2R CR A) or a write-off outside this package (Q-N22). Rail check: GL-2 `partnerClaim.<id>` = Σ A over payments with P11 and no P2R.
- Per payment, once terminal: clearing is released exactly once, either by P2 or P2I (each with P3 when F > 0) or by P6, and after P6 no further DFNS request exists for the payment (§8.4 check 2). A payment is never released twice and never submitted after release.
- Per internal move: one P10 per approved move record, plus the move's P4/P4D. Σ GL-2 over our wallets changes only by the gas.
- Per rail: GL-5 `arc.outbound` balance = Σ (A + F) of payments with a P1 and no P2/P6.
- Chain: the invariant above, per DFNS wallet, at a block both sources agree on; DFNS `GET …/assets` `balance` (string → `bigint`) is a third, delayed opinion (10 blocks [DF:networks]).
- Nova's reconcile command consumes our journal refs [A-10]. Any drift → PAUSE.

---

## 10. D1 flow

### 10.1 Sequence

```mermaid
sequenceDiagram
  autonumber
  participant C as Client (Nova checkout/API)
  participant O as Orchestrator (S3)
  participant R as ReceiverPort (Nova beneficiaries)
  participant PS as PaymentStorePort (Nova PG)
  participant L as LedgerPort (Nova ledger)
  participant G as Gateway (F2)
  participant D as DFNS
  participant H as Human approver (DFNS passkey)
  participant A as Arc (two RPC sources)
  participant I as Indexer (N3)

  C->>O: create payment (Idempotency-Key, payIn=STABLECOIN_BALANCE, beneficiaryRef, amount) — no payout method: that is the receiver's choice
  O->>R: resolvePayout(beneficiaryRef) → receiver's PayoutMethod (STABLECOIN_WALLET in D1), destination, preferenceVersion
  O->>PS: create (requestKey, payout + destination frozen, binding frozen, stage CREATED)
  O->>L: postJournal P1_RESERVE (key pay:<id>:p1)
  alt INSUFFICIENT_FUNDS
    O->>PS: leg RESERVE → REJECTED (INSUFFICIENT_FUNDS)
  end
  O->>G: submit(paymentId) — the payment's one and only DFNS request (attempt is always 1)
  G->>L: getJournalByKey pay:<id>:p1 (must exist) and pay:<id>:p6 (must NOT exist); leg not terminal (check 2)
  G->>D: GET /wallets/{walletId} (network ArcTestnet, Active, address)
  G->>D: GET /networks/fees?network=ArcTestnet (ceiling check)
  G->>PS: markSubmit(SubmitMarker{externalId, bodyDigest, markedAtBlock}) — committed BEFORE the POST; from here "a DFNS request may exist"
  G->>D: POST /auth/action/init + POST /auth/action (userAction)
  G->>D: POST /wallets/{walletId}/transfers {kind, to, amount, priority, externalId}
  alt response lost / timeout / 5xx / 4xx other than 409 (leg UNRESOLVED: no terminal stage, no P6)
    G->>D: re-POST the same bytes, same externalId, fresh userAction (F-6) — or a webhook/listing shows the entity
    D-->>G: 200 with the existing (or now created) TransferRequest
  end
  D-->>G: TransferRequest status Pending (policy)
  G->>PS: applySignal → ARC_TRANSFER PENDING_APPROVAL, externalRef = DFNS transfer id (leg resolved)
  H->>D: approve in DFNS (quorum)
  D-->>O: webhook wallet.transfer.broadcasted (HMAC) [hint]
  O->>D: GET /wallets/{walletId}/transfers/{id} (Broadcasted, txHash)
  O->>PS: applySignal → SUBMITTED, then CONFIRMING (txHash watched)
  I->>A: eth_getLogs (system emitter C-20, topic1 = hot wallet), ≤ 9,999 blocks, both sources
  I->>A: receipt(txHash): status, gasUsed, effectiveGasPrice
  I->>PS: commitRange + applySignal(ARC_LOG (5042002, txHash, logIndex)) → COMPLETED (log is in the tx whose hash DFNS reported, §6.5 rule 1)
  O->>L: P2_SETTLE (+P3_FEE) key pay:<id>:p2 / :p3
  O->>L: P4_GAS key gas:5042002:<txHash> (credit GL-2 arc.<sending wallet>; dust d → GL-4 arc.gasDust.<sending wallet>)
  D-->>O: webhook wallet.transfer.confirmed [cross-check only]
  C->>O: GET /payments/:id → status SETTLED, stage COMPLETED, legs[], txHash
```

### 10.2 Deterministic keys

| Key | Derivation |
|---|---|
| Request key and payment id | `h = sha256(lp('nv1-request') ‖ lp(payer) ‖ lp(clientIdempotencyKey))`, where `lp(x)` = 4-byte big-endian byte length of UTF-8 `x`, then the bytes (length-prefixed, so no two `(payer, key)` pairs encode alike: payer `u1` with key `x` and payer `u` with key `1x` differ). `requestKey` = `req-` + hex(h) (68 chars); `paymentId` = `pay-` + hex(h)[0..32] (36 chars). Both are lower-case `[a-z0-9-]`, inside the `IdempotencyKey` charset `[a-z0-9:-]`, so `pay:<paymentId>:p1` is valid. A replayed create returns the same payment. The client's `Idempotency-Key` must be 1–255 printable ASCII characters, else HTTP 400 |
| Wallet tag `<w>` (GL-2 and GL-4 sub-accounts, P5 key) | `wt` + hex(sha256(lp('nv1-wallet') ‖ lp(walletRef)))[0..32] → 34 chars, `[a-z0-9]`. Nova's `walletRef` charset is unknown [A-20], so it never appears in a key |
| Ledger keys (one per template, so no two templates share a key) | Per payment: `pay:<paymentId>:p1`, `:p2` (P2), `:p2i` (P2I), `:p2p` (P2P), `:p2r` (P2R), `:p3`, `:p6`, `:p7`, `:p11` (P11). These keys carry no attempt part because a payment has exactly one DFNS request (§8.4 check 3): `pay:<id>:p6` existing means the payment is over, and gateway check 2 refuses any further submission for it. A retry is a new payment, so all its keys differ. Per receipt: `gas:<chainId>:<txHash>` (P4 and P4D, one key). Per sweep: `dust:<chainId>:<w>:<sweepSeq>` (P5, Nova and sub-ledger, one key). Per log: `fund:<chainId>:<txHash>:<logIndex>` (P8), `unid:<chainId>:<txHash>:<logIndex>` (P9 and P9D, one key). Per move: `move:<moveId>` (P10), where `moveId` = `mov-` + hex(sha256(lp('nv1-move') ‖ lp(approvalRecordId)))[0..32]. `<txHash>` is the lower-cased `Hex32` (§7.1) and `<logIndex>` is decimal. The longest keys, `unid:` and `fund:` with chain ID 5042002, a 66-char hash and a log index of up to 20 digits, are at most 100 chars ≤ 128. So for `FIAT_BANK`, P2P (on the Arc leg's `COMPLETED`) and P2 (on `PAID`) have distinct keys |
| DFNS `externalId` (1–50 chars [DF:transfer]) | `deriveExternalId(paymentId)` = `nv1-` + hex(sha256(lp(paymentId) ‖ lp('1')))[0..40] → 44 chars. The `'1'` is the fixed `attempt` (always `1n`, §7.3); it is kept so existing derivations do not change, and no other value is ever used. One payment has one `externalId` for its whole life; it is committed in the submit marker before the POST (§8.4 check 3) and reused byte for byte by every re-POST. For a P10 move, `moveId` takes the place of `paymentId`; the `pay-`/`mov-` prefixes keep the two inputs distinct |
| Record and decision ids (§7.3) | `fundingId` = `fnd-` + hex(sha256(lp('nv1-funding') ‖ lp(approvalRecordId)))[0..32]; `caseId` = `case-` + hex(sha256(lp('nv1-case') ‖ lp(kind) ‖ lp(subject)))[0..32]; `holdId` = `hold-` + hex(sha256(lp('nv1-hold') ‖ lp(walletRef) ‖ lp(dfnsTransferId)))[0..32]; `decisionId` = `dec-` + hex(sha256(lp('nv1-decision') ‖ lp(kind) ‖ lp(subject) ‖ lp(caseId or '') ‖ lp(decimal(seq))))[0..32]. All are `[a-z0-9-]`, at most 37 chars |
| Inbox keys | §10.3 |

### 10.3 Inbound signal dedupe keys

| Source | Authenticity | Dedupe key |
|---|---|---|
| Arc log | Emitter = C-20, topic0 = C-21, two-source agreement, receipt status | `arc:<chainId>:<txHash>:<logIndex>` |
| DFNS webhook | HMAC-SHA256 raw body + timestamp window + IP allow-list | `dfns:transfer:<id>:<status>` / `dfns:approval:<id>:<status>` |
| DFNS poll | TLS + our authenticated request | same keys as webhook (a webhook and a poll of the same state dedupe to one) |
| Conversion result (D5) | Nova internal call [A-54] | `conv:<conversionId>:<state>` |
| Payout callback (D5) | `PayoutPartnerPort.verifyCallback` (Q-N12) | `payout:<payoutId>:<state>` |
| Operator decision (two-person) | Two **distinct** staff identities, each authenticated by Nova's staff authentication [A-35] through the channel that CF-31 defines. Neither may be a service account, and the store refuses `SAME_APPROVER`. Each approver confirms the same `evidenceDigest`, so neither can approve content the other did not see. CF-31 is still open (how the instruction reaches the adapter, who may give it, which identity check it carries). Until it closes, **no** decision-entry path is built, and every case that needs a decision stays QUARANTINED or PAUSED (fail closed) | `op:<decisionId>` (§10.2). The same decision delivered twice is `DUPLICATE`; different evidence under one id is `SIGNAL_CONFLICT` → QUARANTINE |

`payloadDigest` (§7.3) is `sha256` over a canonical encoding (keys sorted, absent fields as `null`, strings as received, no whitespace) of a **normalised projection**, never of a raw envelope:

| Source | Projection |
|---|---|
| Arc log | `chainId`, `txHash`, `logIndex`, `blockHash`, `from`, `to`, `value` (decimal string), receipt `status` |
| DFNS transfer (webhook `data.transferRequest`, or the `GET …/transfers/{id}` body) | TransferRequest fields `id`, `walletId`, `network`, `status`, `txHash`, `externalId`, `replacementId`, `requestBody` [DF:get-transfer]. Delivery fields (`id` of the event, `deliveryAttempt`, `retryOf`, `timestampSent`) and dates are excluded |
| DFNS approval | `approvalId`, `status` |
| Conversion / payout | `conversionId`/`payoutId`, `state`, amount fields as decimal strings |
| Operator decision | `decisionId`, `kind`, `subject`, `caseId`, `seq`, `evidenceDigest`. The evidence projection is per kind: for example `LINK_HASH` = (`txHash`, nonce, both sources' block hashes, the binding digest); `ABORT_ACCEPTED` = (DFNS transfer id, DFNS response status, time); `NONCE_TX_LOCATED` = (`holdId`, `txHash`, block, receipt status on both sources). Approver ids are excluded, so two orders of approval give one digest |

So a webhook and the follow-up GET of one DFNS state give the same digest (`DUPLICATE`), while a real content change under one key (for example a different `txHash` for a `Broadcasted` transfer after a speed-up) still gives `SIGNAL_CONFLICT` → QUARANTINE, which is the intended F-18 detection.

### 10.4 Matching a chain log to a payment

Primary (and the only completing link): DFNS-reported `txHash` → payment. Fallback (DFNS slower than our indexer, which is the normal case because of the 10-block delay): a log from our wallet whose `(to, amount)` equals exactly one open payment whose Arc leg has a **submit marker** and no DFNS `txHash` yet is linked **provisionally**. Such a leg is in `CREATED` (marker set, possibly still UNRESOLVED after an ambiguous POST, §8.4 check 3), `PENDING_APPROVAL` or `APPROVED`: without a hash it cannot reach `SUBMITTED` (§8.6). A `CREATED` leg **without** a marker has no DFNS request, so it is never a candidate, and a log matching only such legs is `UNKNOWN_EVENT` at once (§6.7). This includes a leg held after a hash-less DFNS `Failed` (§8.6, F-3b). A provisional link changes no stage and posts nothing; it becomes `COMPLETED` only when DFNS's `txHash` for that transfer arrives and equals the log's transaction hash (§6.5 rule 1, the same rule). If DFNS reports a different hash, the provisional link is dropped and the log is treated by §6.7. A provisional link of a hash-less `Failed` leg can never be confirmed by DFNS, because no hash will ever come. After `A_xcheck` it becomes `UNKNOWN_EVENT` (§6.7) and is resolved by the two-person link of §6.5 rule 1 (F-3b). Two or more candidate payments with the same `(to, amount)` → no provisional link; wait for DFNS's hash (F-12).

### 10.5 `GET /payments/:id`

Returns `{ id, status, stage, reason, payIn, payout, amount, fee, legs: [{ kind, stage, status, txHash, explorerUrl }], network: 'ARC', createdAt, updatedAt }`. Amounts are decimal **strings** formatted by U1 (`formatCbsMinor`), never numbers. Only the payer (and Nova staff roles) may read it [A-35]. `explorerUrl` uses C-06. No PII beyond what Nova already returns for its own transactions.

---

## 11. Mainnet: present, disabled

- Arc mainnet appears only as `ARC_MAINNET_DISABLED` (existing `src/chain/config`, chain ID per C-02) and as the DFNS network name `Arc` [DF:networks] in `src/net/arc/config.ts` with `enabled: false`.
- `resolveChain` / `assertMainnetAllowed` (existing, reading docs/GATES.md) guard every path that could select it. `WalletRecord.custody.dfnsNetwork` is the literal type `'ArcTestnet'`; a DFNS wallet whose `network` is `Arc` fails gateway check 1 with `NETWORK_DISABLED`.
- CI tests: (a) the mainnet entry exists and is disabled; (b) every resolver throws `MainnetGateError` while any G-M gate is unsigned; (c) the gateway refuses a fake DFNS wallet reporting `network: 'Arc'`; (d) no source file outside `src/net/arc/config.ts` and `src/chain/config` contains the mainnet chain ID; (e) loading a config with `arc.indexer.singleSourceTestnetOnly: true` together with the mainnet entry (chain ID per C-02 or DFNS network `Arc`) throws before any indexer or gateway exists, and with chain ID 5042002 and `ArcTestnet` it loads (§6.3).

---

## 12. Failure paths

| # | Failure | Detection | Leg stage / reason | Public status | Ledger | Rail action |
|---|---|---|---|---|---|---|
| F-1 | Approval rejected | DFNS `Rejected`; approval `Denied` (`GET /v2/policy-approvals/{id}`; webhook `policy.approval.resolved`) | `REJECTED` / `APPROVAL_DENIED` | FAILED | P6 | none |
| F-2 | Approval expired | `Rejected` with approval `Expired` (DFNS `autoRejectTimeout`, minutes [DF:create-policy]); our own `A_approval` timer as backstop | `EXPIRED` / `APPROVAL_EXPIRED` | FAILED | P6 (proof (a1)) | none. Our timer does **not** abort a DFNS transfer by itself. It pages an operator, who may abort (two-person) only while DFNS shows the transfer unsigned (`Executing`, [DF:abort]). The case records DFNS's acceptance of the abort. The `Failed` that follows is then proof (a2), giving `CANCELLED` / `CANCELLED_BY_OPERATOR` and P6. The wallet nonce hold (§8.4 check 5) applies until any nonce in `details` is consumed |
| F-3a | Blocklisted party caught by our precheck | Local blocklist copy (C-28, C-55) | `REJECTED` / `BLOCKLISTED_PRECHECK`, only while the leg has no submit marker. If a re-POST of an UNRESOLVED leg (F-6) is refused by the precheck, the leg is not ended: QUARANTINE, and resolve it by webhook or listing lookup | FAILED | P6 (no marker only) | Case for Compliance (D4) |
| F-3b | Blocklisted sender rejected before the mempool | DFNS `Failed` with no `txHash`, whose `reason` or our precheck shows a blocklisted party. The pre-mempool behaviour itself is a CO-1 v3 step 6 claim still open as Q-A13 (and Q-A1). C-53 describes a different case, included and then reverted (F-3c). A hash-less `Failed` is **not** proof that nothing was signed: DFNS cancel works on "Transfers that are in 'Failed' status, but failed off-chain" by "Extracting the nonce from the original transfer's signed data" [DF:cancel]. So F-3b needs proof (c) of §8.4 check 3 before any release. A transfer that has a `txHash` is never F-3b: it was broadcast or failed on-chain ([DF:idem]; `Broadcasted` = "Signed and sent to the network mempool" [DF:monitoring]). With no receipt and no log after `T_pending`, it is F-4 | Stage unchanged (QUARANTINED) until proof (c) and step 4a. Then `REJECTED` / `BLOCKLISTED_PRE_MEMPOOL`, or `REJECTED` / `ONCHAIN_REVERTED` via `CONFIRMING` if step 4a finds the reverted original. If the signed original landed instead: two-person link, then `COMPLETED` (§6.5 rule 1) | PROCESSING → FAILED | P6 **only after proof (c)** and step 4a. Gas: whatever transaction consumed nonce `n` has its gas posted (step 4a). A burn cancel's gas is P4/P4D, credited to the sending wallet once the cancel's hash is linked (F-18). A reverted original's gas is P4/P4D with reason `ONCHAIN_REVERTED` | QUARANTINE, wallet nonce hold (§8.4 check 5), page; our precheck missed it, so refresh the blocklist copy. **Nonce-burn procedure** (two people, CF-31; it applies to **every** hash-less `Failed` without an accepted abort, not only blocklist cases): (1) Read `n` from the transfer's DFNS `details` [DF:get-transfer]. If there is no parseable `n`, stay QUARANTINED with the hold on, and escalate to DFNS (Q-N20). (2) At a block both sources agree on, read the account nonce. If it is already above `n`, go to step 4. (3) Otherwise an operator calls DFNS Cancel on the failed transfer, which DFNS documents for exactly this case: "Consume the nonce that was reserved but not used" [DF:cancel]. If POL-2 or POL-3 would block the 0-value cancel (F-5, Q-N15), the DFNS admin first makes a policy change through the admin's own approval. Repeat step 2 until the account nonce is above `n`. (4) Check for a matching unlinked log up to that block (§8.4 check 3 (c)). If there is one, the signed original landed: two-person link (§6.5 rule 1), `COMPLETED`, no P6, and the hold lifts. If there is none, go to step 4a. (4a) **Locate the nonce-`n` transaction** (R3-m1). The account nonce is above `n`, so some transaction from the sending wallet used `n` and paid gas, even if it emitted no log. A reverted original emits no log but still consumes gas (C-53). Search the hold's window: from the hold's `lastAtOrBelow` block (or the leg's `markedAtBlock` if none was observed) to its `firstAbove` block (§8.4 check 5). If both sources serve the historical account nonce, first narrow the window by binary search on `eth_getTransactionCount(wallet, block)`. Then read each block's full transaction list on both sources and take the transaction whose sender is the wallet and whose nonce is `n`. Q-A11 asks whether our sources serve this history. Here the transaction's sender is used only to find who paid for nonce `n`; value attribution still comes only from the log (C-27). Both sources must return the same hash `h` in the same block, or this step fails as `RPC_DISAGREEMENT`. Record `h` (`recordHoldNonceTx`, decision `NONCE_TX_LOCATED`). Then, by what `h` is: (i) **our DFNS cancel** (the 0-value self-transfer of step 3): proof (c) holds, so `REJECTED` / `DFNS_FAILED` (or `BLOCKLISTED_PRE_MEMPOOL`), P6, and the cancel's gas per step 5; (ii) **a transaction already linked to another payment or move** (DFNS reused `n`, Q-N20): its gas is posted under that link, and proof (c) holds for this payment, which gets `REJECTED` and P6; (iii) **the signed original, reverted**: its `to` and `value` equal this binding and the receipt is `status 0` on both sources. Two people link `h` to this leg (`LINK_HASH`, a forward jump to `CONFIRMING`). The leg then ends `REJECTED` / `ONCHAIN_REVERTED`, which is the true reason, not `DFNS_FAILED` or `BLOCKLISTED_PRE_MEMPOOL`. P4/P4D post its gas, credited to the sending wallet, and P6 follows, exactly as F-3c; (iv) **anything else** (a transaction from our wallet that nobody requested): `UNKNOWN_EVENT` → PAUSE and page (§6.7), and nothing is released. The hold lifts and P6 is posted only after step 4a has identified `h` and its gas is posted, here or under its own link. If no source can serve the window, the case stays QUARANTINED, the hold stays on and the rail stays PAUSED (chain invariant), until a human completes the search with both sources. (5) Post the cancel's gas (P4/P4D) once its hash is linked. Until every nonce-consuming transaction's gas is posted, the chain invariant is off by that gas, so the rail stays PAUSED (as in F-18) |
| F-3c | Included but reverted (status 0, gas consumed) | Receipt `status 0` (C-53, M-1) | `REJECTED` / `ONCHAIN_REVERTED` | FAILED | P4 (gas) + P6 | Page |
| F-4 | Under-floor drop, or any broadcast transaction with no receipt | `txHash` known, no receipt and no log on either source by `T_pending` (C-30, M-4, Q-A2). DFNS `Failed` **with** a `txHash` is an on-chain failure and lands here too. A hash-less `Failed` is never F-4; it is F-3b's procedure | `EXPIRED` / `UNDER_FEE_FLOOR_DROPPED` once proof (b) of §8.4 check 3 holds; until then `CONFIRMING`. If the nonce was consumed by a recorded DFNS cancel, the stage is `CANCELLED` / `CANCELLED_ONCHAIN_REPLACED` (F-18) | PROCESSING → FAILED | P6 only after proof (b). A timer alone never releases | QUARANTINE until proven. **No resubmission of this payment, ever** (double-send risk [DF:create-transfers]). Proof (b) ends the payment with `EXPIRED` and P6, and a retry is a **new** payment with a new id, a new P1 and new keys (§8.4 check 3). Gateway check 2 refuses any submission for this payment once the leg is terminal or `pay:<id>:p6` exists. A late inclusion after proof is impossible by construction, because the nonce is consumed. A late inclusion before proof simply completes the payment |
| F-5 | Stuck (no terminal state, no inclusion) | `CONFIRMING` older than `A_stuck` | unchanged | PROCESSING | none | QUARANTINE. The operator decides between waiting and a DFNS cancel. A cancel is a 0-value same-nonce replacement "to the same address", i.e. our own wallet, and success is not guaranteed [DF:cancel]. If the cancel consumes the nonce, the leg ends `CANCELLED` / `CANCELLED_ONCHAIN_REPLACED` after proof (b), then P6 (F-18). **Caveat:** suppose DFNS evaluates cancel as `Wallets:Sign` activity (Q-N15). Then **both** value rules fail closed on a 0-value transaction [DF:policies, warning on value-transfer rules], so both would block the cancel:
- POL-2 (`TransactionAmountLimitNominal`, Block);
- POL-3 (`TransactionRecipientWhitelist`, Block). Our own wallet is also not on its allow-list.
See DFNS_SETUP §5. In that case this option, and the F-3b nonce burn, is unavailable without a DFNS admin policy change made through the admin's own approval. On Arc the cancel transaction emits no log (0-value self-transfer, C-24). Its effect is seen only as the consumed nonce (proof (b)), and its gas only from its receipt (F-18) |
| F-6 | DFNS 4xx/5xx/timeout on POST, or a crash after `markSubmit` and before the POST's response is stored | Transport result; at start-up, `listUnresolvedSubmits` (§7.3) | `CREATED`, **UNRESOLVED**: the submit marker is set and no DFNS entity is known (§8.4 check 3). No terminal stage, no P6, no timer release; a quote expiry or an operator cancel ends nothing here | PENDING | none | Resolve only through the marker's `externalId`. Re-POST the **same bytes** with the same `externalId` and a fresh user action: DFNS answers `200` with the entity it already created, or creates it if the first POST never arrived [DF:idem]. Alternatively a verified webhook for that `externalId` (confirmed by GET), or a listing that shows it [DF:list-transfers]. Not appearing in a listing proves nothing (Q-N21). Then follow §8.6 and the proofs of §8.4 check 3. A quote that expired meanwhile is handled by approver denial (a1) or abort (a2). `409` (same `externalId`, different body) → QUARANTINE. Unresolved after `A_ambiguous` → QUARANTINE, `UNRESOLVED_SUBMIT` case, page. The leg stays non-terminal, and a re-POST under QUARANTINE needs `LIFT_QUARANTINE` (two-person) |
| F-7 | RPC disagreement | §6.3 | unchanged | — | none | PAUSE outbound, freeze cursor, two-person resolution |
| F-8 | Chain stall | §6.6 | unchanged (timeouts suspended) | — | none | PAUSE new submissions |
| F-9 | DFNS `Confirmed` but no log from our indexer | After `A_xcheck` | `CONFIRMING` | PROCESSING | none | QUARANTINE + page (possible indexer gap or DFNS error) |
| F-10 | Log amount/recipient ≠ binding | §6.5 rule 2 | `CONFIRMING` | PROCESSING | none | **PAUSE** (binding breach) |
| F-11 | Unknown outbound log from our wallet | §6.7 | — | — | none | **PAUSE** |
| F-12 | Two open payments with identical `(to, amount)` | §10.4 | wait for DFNS hash | — | none | none (by design) |
| F-13 | Webhook forged | HMAC mismatch, bad header, stale timestamp, wrong source IP | none | — | none | 401, alert; repeated → page Security |
| F-14 | Webhook duplicated / out of order | Entity dedupe key; illegal transition → `STALE` | none | — | none | none |
| F-15 | Ledger `AMBIGUOUS` | Port result | unchanged | — | resolve by key | after `A_ambiguous` → QUARANTINE |
| F-16 | Quote expired (journey) | Clock vs `expiresAt`, acted on **only while the `ARC_TRANSFER` leg has no submit marker** (§7.3). The marker is committed before the DFNS POST, so "no marker" proves no DFNS request exists. With the marker set, expiry ends nothing (§13.3): the leg is resolved by its `externalId` (F-6), and then it ends only through DFNS approver denial (a1), an accepted abort (a2) or the other proofs | `EXPIRED` / `QUOTE_EXPIRED` (no marker only) | FAILED | P6 (+ Nova's conversion reversal, if executed [A-55]), no marker only | With the marker set: page Ops so the approvers can deny the DFNS approval |
| F-17 | Payout partner fails after Arc leg confirmed (journey) | `getPayout` `FAILED` / verified callback | `PAYOUT` → `REJECTED` / `PAYOUT_FAILED` | FAILED | The USDC stays in GL-2 `partner.<id>` (P2P) and the payer's `A + F` stays in GL-5 clearing: no P2/P3 were posted (they post only on `PAID`) and no P6 yet. Every unit is in a named account | QUARANTINE; Ops case. Ops opens a `PARTNER_RETURN` case record (§7.3) holding the expected return: `from` = the partner's settlement address [A-52], `to` = our wallet, `value = cbsMinorToNativeWei(A, p)`. It is approved by two people (`OPEN_PARTNER_CASE`). Then one of two branches: **(1) the partner returns the USDC.** The `INBOUND` log matching the case exactly is claimed by it (§6.1, `claimInbound`). P2R moves `A` from `partner.<id>` back to GL-2 `arc.<to>`, and then P6 refunds `A + F` to the payer. **(2) The payer is refunded without waiting for the partner** (this was "the refund is a new payment"). Two people record `CLOSE_PARTNER_UNRETURNED` on the case. Under that one decision the payment closes with P6 (`A + F` from GL-5 back to the payer's GL-1) and P11 (`A` from `partner.<id>` to `partnerClaim.<id>`), so clearing and `partner.<id>` both net to zero (§9.3). The payer's money is back in their Nova balance; if the payer wants it sent anywhere, that is an ordinary **new** payment with its own id, P1 and keys. The case stays open as a claim. A later exact return is claimed by it, and P2R then credits `partnerClaim.<id>` with no second P6. Writing off a claim that is never recovered is a Nova finance entry outside this package (Q-N22). In both branches the payment is terminal with P6, so gateway check 2 refuses any further DFNS request for it. It is never an on-chain reversal. A return of a different value does not match: it goes to P9, the case stays open, and the difference is resolved by a two-person entry |
| F-18 | DFNS speed-up or cancel replacement of a broadcast transfer. It can come from an operator, or from anyone holding a credential with `Wallets:Transfers:Read` or `Wallets:Transactions:Create` (§8.2) | DFNS GET shows `replacementId` or a changed `txHash` [DF:get-transfer] (→ `SIGNAL_CONFLICT`, §10.3); or a canonical log from our wallet in a transaction other than the linked hash (§6.7); or the nonce consumed with no receipt for our hash | `CONFIRMING` held, then `COMPLETED` (speed-up) or `CANCELLED` / `CANCELLED_ONCHAIN_REPLACED` (cancel) | PROCESSING → SETTLED or FAILED | none until resolved. The replacement's gas is posted by P4, credited to the sending wallet, from its receipt once its hash is linked | QUARANTINE the payment; an unlinked log PAUSEs the rail (§6.7). Two-person resolution with evidence (same nonce, binding match on both sources): a **speed-up** that delivered the money → link its hash and complete via §6.5; a **cancel** → proof (b), then `CANCELLED` / `CANCELLED_ONCHAIN_REPLACED` and P6. The DFNS cancel (`replacementId`) is named in the case record; without that record, the drop reads as `EXPIRED` / `UNDER_FEE_FLOOR_DROPPED`. Until the replacement's gas is posted, the chain invariant is off by that gas and the rail stays PAUSED. Fee-ceiling breach from a speed-up pages (§8.4 check 7 post-check) |
| F-19 | Unsolicited inbound to a company wallet | `INBOUND` log matching no approved record (§6.1) | — | — | P9 (+ P9D) to GL-4 `arc.unidentified` | No PAUSE. Ops case; return or attribution only by a two-person decision (a return is a new payment) |

`REVERSED` is never caused by any row above. It is set only when P7 (a compensating ledger entry) is posted for a `SETTLED` payment by an authorised business action; nothing happens on-chain (CO-1 v3 step 6). Any money actually sent back is a separate payment with its own id.

---

## 13. Stage → TransactionStatus mapping (ADR-013 input)

Implemented in `src/payments/status.ts` as one table, the only place the mapping exists.

### 13.1 Stages

`CREATED`, `PENDING_APPROVAL`, `APPROVED`, `SUBMITTED`, `CONFIRMING`, `COMPLETED`, `REJECTED`, `EXPIRED`, `CANCELLED`. The CO-1 v3 stage list has no `FAILED` stage, so every non-success terminal is one of `REJECTED`, `EXPIRED`, `CANCELLED` with a mandatory `FailureReason`. (Adding a `FAILED` stage is an ADR-013 option for the humans, Q-N13.)

### 13.2 Mapping

| Stage | Reason | TransactionStatus |
|---|---|---|
| CREATED | — | PENDING |
| PENDING_APPROVAL | — | PENDING |
| APPROVED | — | PROCESSING |
| SUBMITTED | — | PROCESSING |
| CONFIRMING | — | PROCESSING |
| COMPLETED | no P7 posted | SETTLED |
| COMPLETED | P7 compensating entry posted | REVERSED |
| REJECTED | any (`APPROVAL_DENIED`, `BLOCKLISTED_PRECHECK`, `BLOCKLISTED_PRE_MEMPOOL`, `ONCHAIN_REVERTED`, `DFNS_FAILED`, `INSUFFICIENT_FUNDS`, `PAYOUT_FAILED`, `METHOD_NOT_ENABLED`, `DESTINATION_NOT_ALLOWED`) | FAILED |
| EXPIRED | `APPROVAL_EXPIRED`, `QUOTE_EXPIRED`, `UNDER_FEE_FLOOR_DROPPED` | FAILED |
| CANCELLED | `CANCELLED_BY_OPERATOR`, `CANCELLED_ONCHAIN_REPLACED` | FAILED |

Tests: the table is total (every stage × legal reason has exactly one row); a terminal stage without a reason is unrepresentable; `REVERSED` is reachable only via P7; `SETTLED` is reachable only from an `ARC_LOG` signal (USDC payout) or a verified payout signal (fiat payout), never from `DFNS_WEBHOOK`/`DFNS_POLL`.

### 13.3 Legal transitions (per leg)

The non-terminal stages are ordered: `CREATED` (0) < `PENDING_APPROVAL` (1) < `APPROVED` (2) < `SUBMITTED` (3) < `CONFIRMING` (4). DFNS polls often skip a state (for example `Executing` is "only set for a short time between pending and broadcasted" [DF:transfer], so a poll can see `Pending` and then `Broadcasted`), so the table allows forward jumps:

| From | Legal targets |
|---|---|
| any non-terminal stage *s* | any **later** non-terminal stage (forward jump; for example `PENDING_APPROVAL → SUBMITTED`, `PENDING_APPROVAL → CONFIRMING`, `CREATED → APPROVED`) |
| `SUBMITTED`, `CONFIRMING` | `COMPLETED` (only with §6.5 evidence: a DFNS-reported hash, or the two-person hash link of §6.5 rule 1 for a hash-less `Failed` leg or a replacement. That link enters by a forward jump to `CONFIRMING`, so `COMPLETED` is still never reached from a stage before `SUBMITTED`) |
| `CREATED` **with no submit marker** (§7.3; the marker is committed before the DFNS POST, so no DFNS request can exist) | `REJECTED` with `INSUFFICIENT_FUNDS`, `METHOD_NOT_ENABLED`, `BLOCKLISTED_PRECHECK` or `DESTINATION_NOT_ALLOWED`; `EXPIRED` with `QUOTE_EXPIRED`; `CANCELLED` with `CANCELLED_BY_OPERATOR` |
| `CREATED`, **UNRESOLVED** (submit marker set, `externalRef` null: a DFNS request may exist, F-6) | **no terminal target at all**, and no P6. Only forward jumps, and only on a signal that carries the DFNS entity with the marker's `externalId`: the re-POST response, a webhook confirmed by GET, or a listing. Such a signal resolves the leg first (it sets `externalRef`), and then every other row applies. Timers, quote expiry and operator cancel requests are refused (`LEG_UNRESOLVED`, §7.3) and page |
| `CREATED`, `PENDING_APPROVAL` | `REJECTED` with `APPROVAL_DENIED`; `EXPIRED` with `APPROVAL_EXPIRED` (DFNS rejects only from `Pending` [DF:transfer]) |
| `CREATED`, `PENDING_APPROVAL`, `APPROVED` | `CANCELLED` with `CANCELLED_BY_OPERATOR` **only** on DFNS `Failed` with no `txHash` and no `dateBroadcasted` after an operator abort that DFNS accepted (proof (a2) of §8.4 check 3) |
| `CREATED`, `PENDING_APPROVAL`, `APPROVED` | `REJECTED` with `DFNS_FAILED` or `BLOCKLISTED_PRE_MEMPOOL` **only** on DFNS `Failed` with no `txHash` **and** proof (c) of §8.4 check 3 (reserved nonce resolved, F-3b). The `Failed` status alone is never enough |
| `SUBMITTED`, `CONFIRMING` | `REJECTED` with `ONCHAIN_REVERTED`; `EXPIRED` with `UNDER_FEE_FLOOR_DROPPED` (only with proof (b) of §8.4 check 3); `CANCELLED` with `CANCELLED_ONCHAIN_REPLACED` (only with proof (b) **and** a two-person case record naming the DFNS cancel that consumed the nonce, F-18) |
| `PAYOUT` leg, `SUBMITTED`/`CONFIRMING` | `REJECTED` with `PAYOUT_FAILED` |
| terminal (`COMPLETED`, `REJECTED`, `EXPIRED`, `CANCELLED`) | none (`REVERSED` is a status from P7, not a stage change) |

`CANCELLED` with `CANCELLED_BY_OPERATOR` is allowed only before `SUBMITTED`. Directly, by an operator, only while the leg has **no submit marker**. Once the marker is set, a DFNS request may exist, and the reason is allowed only on proof (a2), an accepted abort, which needs the DFNS entity (so never while UNRESOLVED). `CANCELLED` with `CANCELLED_ONCHAIN_REPLACED` is allowed only from `SUBMITTED`/`CONFIRMING`, on proof (b) and a recorded DFNS cancel. So an operator cancel of a broadcast transfer is reported as a cancel, not as a fee-floor drop. A quote that expires after the submit marker is set does not end the leg: the leg is resolved through its `externalId` (F-6), and then the approvers deny (a1) or the operator aborts (a2) (F-2, F-16). Off-chain reasons (`DFNS_FAILED`, `BLOCKLISTED_PRE_MEMPOOL`, `CANCELLED_BY_OPERATOR` after the marker) are refused from `SUBMITTED` onward. On-chain reasons (`ONCHAIN_REVERTED`, `UNDER_FEE_FLOOR_DROPPED`, `CANCELLED_ONCHAIN_REPLACED`) are refused before it. A leg held after a hash-less `Failed` leaves only by proof (c) with F-3b step 4a, giving `REJECTED`, or by a two-person hash link, giving a forward jump to `CONFIRMING` and then `COMPLETED` by §6.5, or `REJECTED` / `ONCHAIN_REVERTED` if the linked original reverted (F-3b step 4a (iii)).

**One request per payment (R3-B2).** Every terminal stage is final for the **payment**, not just for one try. No transition, signal or operator decision leads from a terminal leg, or from a payment with a `pay:<id>:p6` journal, to a new DFNS request: gateway check 2 refuses it before any DFNS call (`RESERVATION_NOT_OPEN`). A retry is a new payment.

**Applying one signal across several stages.** A signal names its target stage. If the target is a legal forward jump, `applySignal` moves the leg there in **one** atomic write and records every skipped stage in the leg's history with the same signal as its evidence (so the journey report still shows `APPROVED` with "passed via DFNS poll, Broadcasted"). Any timer or outbox item that belongs to a skipped stage is not created.

**Everything else.**
- Target earlier than, or equal to, the current non-terminal stage → `STALE` (an older or repeated state arriving late; no change).
- Current stage terminal and the signal asks for a non-terminal stage → `STALE`.
- Current stage terminal and the signal asks for the **same** terminal stage and reason → `DUPLICATE`.
- Current stage terminal and the signal asks for a **different** terminal stage or reason, or a reason that is not legal from the current stage → `ILLEGAL_TRANSITION` → QUARANTINE and page.

Tests cover every DFNS sequence the status enum allows, with every intermediate state dropped in turn, and assert that none of them reaches `ILLEGAL_TRANSITION`. Further tests:
- a hash-less `Failed` with no accepted abort and no proof (c) never reaches a terminal stage and never posts P6, whatever the timers do;
- the same with a `details` nonce that is missing or unparseable stays QUARANTINED;
- the same with a matching unlinked log present never releases;
- **(R3-m1)** a hash-less `Failed` whose signed original was included and reverted (status 0, no log): step 4a finds the nonce-`n` transaction in the hold's window on both sources, posts P4/P4D for its gas to the sending wallet, and ends the leg `REJECTED` / `ONCHAIN_REVERTED` via `CONFIRMING` with P6. The chain invariant holds afterwards, and the leg is never recorded as `DFNS_FAILED` or `BLOCKLISTED_PRE_MEMPOOL`. With only one source able to serve the window, the hold stays on and nothing is released.

**R3-B1 tests (ambiguous POST).** Each runs against both DFNS fakes (§7.8), once with the POST's response dropped **after** DFNS created the entity and once with the POST dropped **before** it arrived:
- the POST times out, then the quote expires and an operator asks to cancel. No terminal stage and **no P6** (the store returns `LEG_UNRESOLVED` if either is attempted). The leg stays `CREATED`, UNRESOLVED. The re-POST of the same bytes returns (or creates) exactly one DFNS entity with the marker's `externalId`, and the leg moves to `PENDING_APPROVAL`. An approver denial then gives `REJECTED` / `APPROVAL_DENIED` and P6 exactly once. In the "created" variant, an approval instead of a denial leads to broadcast and `COMPLETED`, with P2, not a refund;
- `markSubmit` returns `AMBIGUOUS` or `VERSION_CONFLICT`: no transfer POST is sent unless a read-back shows the marker committed;
- a crash after `markSubmit` and before the POST: at start-up `listUnresolvedSubmits` returns the leg. A re-POST with the stored bytes leaves at most one DFNS entity per `externalId`, and the body digest equals `bodyDigest`;
- a webhook for the marker's `externalId` arrives before any POST response: it resolves the leg through `findByExternalId` and GET;
- a listing that does not show the `externalId` changes nothing (no terminal stage, no P6);
- a `409` on re-POST → QUARANTINE, no terminal stage;
- a re-POST is refused while the rail is PAUSED, while the sending wallet is on a nonce hold, or while the payment is QUARANTINED without `LIFT_QUARANTINE`;
- a canonical log matching an UNRESOLVED leg's `(to, value)` is a provisional candidate (§10.4), not an immediate `UNKNOWN_EVENT`.

**R3-B2 tests (no resubmission after release).**
- after P6 (proofs (a1), (a2), (b), (c) and status 0, each in turn), a `submit` for the same payment is refused with `RESERVATION_NOT_OPEN` before any DFNS call (the fake transport records zero requests). No type allows `attempt` other than `1n`;
- a terminal leg whose P6 is still in the outbox → refused;
- `getJournalByKey('pay:<id>:p6')` → `AMBIGUOUS` → refused;
- a P6 journal exists while the leg reads non-terminal (inconsistent record) → refused, QUARANTINE, page;
- a terminal P10 move → `submit` refused; a retry needs a new move record with a new `moveId`;
- a retry as a new payment gets a new `paymentId`, new `pay:` keys and a new `externalId`. Every key of the old payment is unchanged and none is reused.

**R3-m2, R3-m3 and R3-m4 tests.**
- A nonce hold survives a store restart, including an aborted transfer whose leg is terminal. Check 5 refuses a submission after the restart.
- An `OPERATOR_DECISION` with two equal approver ids is refused (`SAME_APPROVER`). The same decision twice is `DUPLICATE`; different evidence under one `decisionId` is `SIGNAL_CONFLICT`.
- **(R3-m4)** A `FIAT_BANK` payout `FAILED`, branch (2) of F-17: one `CLOSE_PARTNER_UNRETURNED` decision posts P6 and P11 exactly once. GL-5 and `partner.<id>` net to zero, and `partnerClaim.<id>` = A. A later exact return is claimed by the case, and P2R credits `partnerClaim.<id>` with no second P6.
- A payment to a COMPANY-owned wallet is refused at creation with `DESTINATION_NOT_ALLOWED` and nothing is reserved. If the registry changes after creation, gateway check 6 refuses it, and the leg (no marker) ends `REJECTED` / `DESTINATION_NOT_ALLOWED` with P6.

---

## 14. D2 outline (next)

- `WalletRegistryPort.register` for `network = ARC` at onboarding; the DFNS admin or a provisioning service account with `Wallets:Create` creates the DFNS wallet (see the last paragraph of DFNS_SETUP §3; not granted in D1).
- Deposit detection from **per-transfer** canonical logs (§6 with `topic2 = our address`), only for logs classified `INBOUND` (§6.1); an `INTERNAL` log (from one of our wallets, for example a P2I settlement) is never credited as a deposit. Crediting GL-1 through Nova's ledger at full precision: `(m, d) = nativeWeiToCbsMinor(value, p)`, credit `m`, dust `d` to GL-4 (`arc.depositDust`, attributed per customer for later return policy, Q-C5 analogue K-13).
- `balance-poller.ts` stays as a reconciliation cross-check (compare its DFNS balance view with our per-transfer sum, 10 blocks behind), unless G0b (b) shows it already works per transfer [A-23].
- Enables pay-in method `STABLECOIN_DEPOSIT`.
- DFNS `wallet.blockchainevent.detected` webhook as a cross-check only [DF:events].

---

## 15. Assumption register (all → KHUMO_QUESTIONS.md)

| Tag | Assumption | K-row |
|---|---|---|
| A-01 | Ledger stores USDC as integers at a fixed precision p | K-01 |
| A-02 | Accounts have stable string references | K-02 |
| A-03 | An asset code exists for USDC (and ZAR) | K-03 |
| A-04 | Caller-supplied idempotency keys with conflict detection and a lookup | K-04 |
| A-05 | Nova rejects unbalanced journals | K-05 |
| A-06 | GL roles GL-1…GL-7 can be mapped to Nova accounts by config | K-06 |
| A-07 | Multi-leg journals are atomic | K-07 |
| A-08 | No holds; reserve by debit to clearing | K-08 |
| A-09 | Insufficient-funds check inside the posting transaction | K-09 |
| A-10 | Reconcile command can include our journals | K-10 |
| A-11 | Where GL-4's 18-dp dust balance lives | K-11 |
| A-20 | `wallets(user_id, deposit_address)`, no network column | K-20 |
| A-21 | Treasury wallet can be a row in `wallets` | K-21 |
| A-22 | Address normalisation | K-22 |
| A-23 | `balance-poller.ts` attributes from balance deltas | K-23 |
| A-30 | We may add tables via Nova migrations | K-30 |
| A-31 | `TransactionStatus` has exactly the five values | K-31 |
| A-32 | No existing payments table to extend | K-32 |
| A-33 | Transactional outbox exists or is acceptable | K-33 |
| A-34 | Nova will run our contract tests against its adapters | K-34 |
| A-35 | Authorisation model for `GET /payments/:id` | K-35 |
| A-41 | Beneficiaries/receivers are server-side records that hold the destination **and the receiver's chosen payout method** | K-41 |
| A-50 | `buildConversionPostings`/`fx-v2.ts`/`otc-routes.ts` can sit behind ConversionPort | K-50 |
| A-51 | Rates are integer ratios or decimal strings, not floats; remainder handled | K-51 |
| A-52 | Payout partner settles from an Arc address | K-52 |
| A-53 | Which provider `otc-routes.ts` calls | K-53 |
| A-54 | Conversion results are internal calls, not webhooks | K-54 |
| A-55 | How a conversion is undone if the payment fails after it | K-55 |
| A-60/61 | Invoice matching (D3) | K-60, K-61 |
