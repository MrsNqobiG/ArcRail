# CBS port requirements (Phase 0, step 4)

**Scope.** This lists what the Arc rail needs from *any* core banking system (CBS). No vendor is assumed (KICKOFF §1). Each requirement is derived from a cited Arc fact (`docs/constants.md` row `C-xx`) or a CLAUDE.md invariant, and nothing else. Anything that depends on the vendor goes to `docs/OPEN_QUESTIONS.md` (`Q-xx`).

**Invariant keys** (CLAUDE.md):
- **N1–N6**: the six non-negotiables, in order
- **I-INT**: integer arithmetic only, branded types
- **I-CONV**: one conversion module, explicit rounding, dust to a named suspense account
- **I-CONS**: conservation (debits = credits, on-chain delta matches)
- **I-ONCE**: exactly-once (deterministic idempotency keys, outbox/inbox, single nonce writer)
- **I-FAIL**: fail closed (drift, disagreement, unknown events or a failed invariant cause PAUSE and page a human)

**How to read each requirement.**
- **Min guarantee**: the weakest CBS behaviour the adapter can still be built safely on.
- **If absent**: what happens, or what the adapter must do instead. **BLOCKING** means the rail cannot meet its invariants without it.

---

## P1 Idempotent posting with caller-supplied keys

**Derived from:** I-ONCE; I-CONS; N4. Also C-50: finality is immediate, so the adapter will post to the CBS within about a second of an on-chain event. Retries after a timeout are therefore normal, not rare.

| # | Min guarantee | If absent |
|---|---|---|
| P1.1 | A posting call accepts a caller-supplied **idempotency key** (≥64 bytes, opaque). The adapter derives it deterministically from business IDs: for inbound, `(chainId, txHash, logIndex)` (C-20, C-22); for outbound, the payout instruction ID. | **BLOCKING** unless P1.4 exists. Without a key, a timeout followed by a retry can double-credit. |
| P1.2 | **Replaying the same key with the same payload** returns the original result and has no new effect. This holds for at least the adapter's maximum retry horizon (Q-C3). | Double postings. **BLOCKING.** |
| P1.3 | **Reusing a key with a different payload** returns a distinct, typed conflict error and has no effect. | Silent wrong postings on a bug. The adapter would have to hash the payload into the key; a partial mitigation only. |
| P1.4 | **Status by key**: `getPosting(key)` returns `posted / not-found / rejected(reason)`. | After an *ambiguous* failure (timeout, 5xx, connection reset) the adapter can't tell whether the posting happened. It must PAUSE that flow (I-FAIL) until a human resolves it. That is operationally expensive but safe. |
| P1.5 | **Multi-leg atomicity**: one posting holds N balanced legs, applied all-or-nothing. Unbalanced requests are rejected. | Half-applied journals break I-CONS. **BLOCKING.** |
| P1.6 | **Error classes the adapter can rely on**: (a) definite success, (b) definite failure with no effect (validation, insufficient funds, account blocked), (c) ambiguous. Only (c) may be retried blindly, with the same key. | If (b) and (c) can't be told apart, every (b) is treated as (c): retry, then PAUSE. Safe but slow. |
| P1.7 | **Value date / posting date** is returned, and so is a CBS journal ID the adapter can store. | Three-way reconciliation (P10) can only match by key. Acceptable if P1.4 exists. |

## P2 Precision and units

**Derived from:** C-10 (native 18 dp), C-11 (ERC-20 6 dp), C-14 and C-15 (truncation under-credits; credit at full precision), I-INT, I-CONV.

| # | Min guarantee | If absent |
|---|---|---|
| P2.1 | The CBS can hold a **USDC asset/currency code** that is not ISO 4217 (USDC has none) and keep it separate from USD and ZAR balances. | No place to book USDC. **BLOCKING.** Mapping USDC onto a USD account is ruled out by the SARB/FSCA position (KICKOFF §8: not money, never labelled as a deposit). |
| P2.2 | Amounts are **integer minor units** at a **declared, fixed precision `p`** (0 ≤ `p` ≤ 18) for that code. The precision is read from configuration, not assumed. | Floats or a varying scale make I-INT impossible to prove at the boundary. **BLOCKING.** |
| P2.3 | **Range.** The CBS integer must hold `max_balance × 10^p`. With a signed 64-bit integer (max 9,223,372,036,854,775,807): `p = 18` gives about **9.22 USDC** (unusable), `p = 6` gives about 9.22 × 10¹² USDC, and `p = 2` gives about 9.22 × 10¹⁶ USDC. | `p` too high for the integer width means overflow. **BLOCKING** for that `p`. The adapter checks this at startup and refuses to run if it fails (I-FAIL). |
| P2.4 | **Rounding consequence (follows from P2.2 and C-15).** Unless `p = 18`, the CBS cannot hold every on-chain amount. The conversion module (I-CONV) then works as follows. **Inbound:** `cbsMinor = floor(wei / 10^(18−p))`, and the remainder `wei mod 10^(18−p)` goes to the **dust suspense** GL with a record. **Outbound:** only send multiples of `10^(18−p)` wei, so no dust is created. **Gas:** fees are in wei and not aligned to `p`, so they accrue in the adapter sub-ledger at 18 dp and are posted rounded, with the remainder carried in suspense. | No rounding policy at all would make the adapter round silently, which is forbidden. Who *owns* dust (bank income, customer, held for return) is a human decision (Q-C5). |
| P2.5 | **Worked boundaries (`p = 6`, for illustration only; real `p` is Q-C4):** 1 wei → 0 minor + 1 wei dust · 999,999,999,999 wei → 0 minor + 999,999,999,999 wei dust · 10¹² wei → 1 minor, 0 dust · 1 USDC = 10¹⁸ wei → 1,000,000 minor · 1.0000005 USDC = 1,000,000,500,000,000,000 wei → 1,000,000 minor + 500,000,000,000 wei dust. These are reconstructed by integer division; U1 property tests re-derive them. | — |

## P3 Holds and reservations for outbound

**Derived from:** I-CONS, I-ONCE, I-FAIL. Also C-53/M-1: a blocklist revert consumes gas and moves no value. Also the lifecycle doc: dropped transactions exist and pending ones can stay in the mempool "indefinitely" (constants M-6).

| # | Min guarantee | If absent |
|---|---|---|
| P3.1 | **Reserve** an amount on a customer USDC account, idempotent by key. Spendable balance drops at once; ledger balance does not change. | Without holds the customer can spend the same funds twice while a payout is in flight. The fallback is P3.5. |
| P3.2 | **Release** (cancel) a hold, idempotent. | Funds stay stuck after a failed or blocked payout. |
| P3.3 | **Settle** a hold: turn the reserved amount into a balanced posting (customer liability → in-flight/clearing → treasury), atomically and idempotently. | Settlement would need two calls with a gap between them, breaking I-CONS. |
| P3.4 | **No silent auto-expiry**, or an expiry the adapter can configure that is longer than its own pending-transaction timeout plus the reconciliation interval. | A hold expires while the transaction is still pending, the customer spends the funds again, and the transaction then lands: double spend. **BLOCKING** unless P3.5. |
| P3.5 | *Fallback if the CBS has no holds:* debit the customer straight into the **in-flight/clearing** GL (P4) when the payout is reserved, and reverse it on failure. | Works if P1 is complete. Customer statements show debit and reversal instead of a hold (UX and complaint risk, Q-C6). |

## P4 Named GL roles

**Derived from:** I-CONS, I-CONV (named dust suspense), C-25 (gas is paid from the same USDC balance, so it is a real expense), C-34, KICKOFF §8 (never label USDC as deposits or bank accounts).

The adapter needs these roles. The CBS supplies the actual account numbers (Q-C7).

| Role | Purpose | Naming constraint |
|---|---|---|
| G1 Customer USDC liability | One per merchant/customer. What the bank owes in USDC | Must not be called "deposit" or "bank account" (§8 SARB/FSCA) |
| G2 Treasury / hot-wallet asset | USDC the bank controls on-chain (hot wallet, deposit addresses, gas wallet) | Sub-accounts per wallet role are recommended so reconciliation (P10) can match per address set |
| G3 Gas expense | Network fees (`gasUsed × effectiveGasPrice`, C-25), including gas burnt by reverted transactions (C-53) | — |
| G4 Suspense / dust | Sub-`p` remainders (P2.4) and unidentified inbound funds (deposits to unknown or closed accounts) | Every entry carries a record ID |
| G5 In-flight / clearing | Funds between CBS and chain (inbound before screening clears; outbound between settle and finality) | Must net to zero at each reconciliation cut-off, except for listed in-flight items |
| G6 Fee income (only if the bank charges payout fees) | Customer-facing fees | Q-C8 |

**Minimum guarantee:** the adapter's service identity can post **only** to these accounts and to customer accounts linked to the Arc product (P8.3). **If absent:** a compromised adapter could post anywhere. **BLOCKING** for G1 (N3 and the threat model).

## P5 Event delivery (inbox/outbox)

**Derived from:** I-ONCE (transactional outbox/inbox), I-FAIL.

| # | Min guarantee | If absent |
|---|---|---|
| P5.1 | **Adapter → CBS:** requests come from the adapter's transactional outbox. The CBS only needs P1 (idempotent API). | — |
| P5.2 | **CBS → adapter:** at-least-once delivery of: posting outcomes; account status changes (frozen, closed, KYC lapsed); hold changes the adapter didn't make; sanctions/case outcomes. Each event has a **stable event ID**, and there is a **per-account sequence number** or equivalent ordering. | The adapter polls (P1.4 plus account status queries) at a fixed cadence. More load, and a lag window during which a frozen account could still receive a payout instruction. Mitigation: query account status synchronously before every outbound sign (P6.4). |
| P5.3 | Events can be **replayed from an offset or timestamp** (for recovery after adapter downtime). | Recovery relies on full reconciliation (P10). |

## P6 Sanctions/TFS screening, monitoring, case management, FIC reporting

**Derived from:** N5 (never guess regulation), KICKOFF §8 (FIC Act, Directive 9, TFS), C-53/C-55 (Circle's blocklist is the *issuer's* control, not the bank's screening), C-62/C-63 (Memo and Multicall3From preserve `msg.sender`, so attribution must use the original sender), C-64 (all on-chain data is public), N2/N5 and KICKOFF §6 (no PII on-chain or in telemetry).

| # | Min guarantee | If absent |
|---|---|---|
| P6.1 | **Synchronous screening call** for a party or transaction, with a deterministic result: `clear / hit / pending-review`. Called (a) before inbound funds become available and (b) before an outbound payout is signed. | Inbound funds would have to stay in G5 indefinitely. **BLOCKING** for go-live, not for testnet with synthetic data. |
| P6.2 | The CBS accepts **on-chain address screening results** from the provider chosen in ADR-005 as input to its TFS process and cases. | Address risk would be outside the bank's case trail (§8 FIC Act). |
| P6.3 | **Transaction-monitoring feed**: the adapter sends every inbound and outbound movement with opaque IDs and amounts, never chain data mixed with PII in logs. | — (CBS-specific format, Q-C9) |
| P6.4 | **Account and customer standing** query: `{accountActive, kycValid, frozen}`. Synchronous, before crediting and before signing. | Credits to frozen accounts, payouts from accounts with lapsed KYC. **BLOCKING.** |
| P6.5 | **Case creation** from the adapter (screening hit, unknown-sender deposit, travel-rule data missing), returning a case ID the adapter records. | Manual case creation from alerts; an audit-trail gap. |
| P6.6 | **FIC reporting route**: the adapter can supply the data for whatever report types apply. The report types and fields are unverified (Q-R1, Q-R2). | Reporting gap. **Compliance owns this.** |
| P6.7 | **Travel-rule (Directive 9) data**: for an outbound payout, the CBS supplies the originator data fields the directive requires. The field list is unverified (Q-R3). It goes to the ADR-004 solution, **never on-chain** (C-64). | Directive 9 is listed as "zero threshold" in §8 (unverified). Without complete data the payout is blocked. That is safe, but no payouts can go out. |

## P7 Maker-checker approval

**Derived from:** N4 (no LLM or agent in the money path; humans approve), I-FAIL, KICKOFF U10 (FIDO2-authenticated approvals, reuse the CBS's approvals if present).

| # | Min guarantee | If absent |
|---|---|---|
| P7.1 | An approval is **bound to an exact payload hash**: asset, amount in wei, destination address, chain ID `5042002` (C-01), payout ID. An approval can't be reused for a different payload. | Approval replay or substitution. The adapter would re-hash and reject a mismatch, but the CBS approval itself proves less. |
| P7.2 | **Maker ≠ checker**, both named staff identities, authenticated with FIDO2 or passkeys. | The adapter must run its own approval service with staff identity integration (Q-C10). More components, which goes against ADR-003's guidance. |
| P7.3 | Approval records are **queryable and immutable** (who, when, what hash, decision). | The audit trail exists only in the adapter (U13). |

## P8 Service identity and authn/authz at the port

**Derived from:** N2 (no secrets in code or logs), N3 (read-only until G1, then only through CONTRACT.md), KICKOFF §6 (mTLS, workload identity, least privilege, no shared credentials).

| # | Min guarantee | If absent |
|---|---|---|
| P8.1 | **Mutual TLS** with workload identity (a distinct service identity for the Arc adapter). | Shared credentials, against §6. **BLOCKING** for production. |
| P8.2 | Credentials come from the CBS's secret store or OpenBao, never from files in this repo (N2). | — (Q-C11) |
| P8.3 | **Least-privilege scopes**: post only to the G1–G7 (G7 added by CONTRACT §2) set (P4); hold, release and settle only on Arc-product accounts; read-only on customer standing; no other customer data. | See P4. **BLOCKING.** |
| P8.4 | **Per-call audit** on the CBS side (caller identity and key) that we can join to the adapter's hash-chained audit log (U13). | One-sided audit trail. |

## P9 Personal information at the boundary

**Derived from:** C-64 (everything on-chain is public), CLAUDE.md "No personal information on-chain, ever", KICKOFF §6 and §8 (POPIA; the address↔customer link is personal information).

| # | Min guarantee | If absent |
|---|---|---|
| P9.1 | The adapter works with **opaque CBS account IDs**. It never needs names, ID numbers or contact details, *except* the Directive 9 payload (P6.7), which goes only to the travel-rule solution. | PII spreads into the adapter. |
| P9.2 | Data residency: everything stays in the bank's facilities unless an approved ADR says otherwise (§6). | Q-C12 |

## P10 Reconciliation support

**Derived from:** I-CONS ("on-chain delta matches to the base unit"), I-FAIL (any drift triggers PAUSE), C-25 (gas from receipts), C-22 (count only the system emitter), C-15 (compare at 18 dp, so reconcile in wei).

| # | Min guarantee | If absent |
|---|---|---|
| P10.1 | **Balance as of a cut-off** (journal sequence or timestamp) for every G1–G7 (G7 added by CONTRACT §2) account. | Reconciliation compares moving targets and produces false drift and false PAUSEs. The adapter would have to quiesce outbound before each reconciliation. |
| P10.2 | **Journal listing by idempotency key or external reference** over a range. | Drift can be detected but not explained, so every PAUSE needs a manual investigation. |
| P10.3 | Adapter-side rule (no CBS dependency): `chain(wei) = adapter sub-ledger(wei)`, and `adapter(wei) = CBS(minor) × 10^(18−p) + dust suspense(wei)`, exactly. | — |

## P11 CBS availability and back-pressure

**Derived from:** C-50 (funds are final on-chain before the CBS knows about them), I-FAIL.

| # | Min guarantee | If absent |
|---|---|---|
| P11.1 | A documented **maintenance and outage window**, with the CBS's own behaviour then (rejects, queues or times out). | Inbound credits queue in the outbox while customers see "funds received on-chain, not credited". This is safe but needs ops messaging (Q-C13). Outbound is paused. |

---

## Summary: BLOCKING requirements (no safe fallback)

P1.1 (or P1.4) · P1.2 · P1.5 · P2.1 · P2.2 · P2.3 · P3.4 (or P3.5) · P4/P8.3 scoped posting rights · P6.4 · P8.1 (production). P6.1 is blocking for go-live only.

A CBS that can't provide these can't host this rail without a CBS change. Under N3, a CBS change needs gate G1 and the CBS's own change process.
