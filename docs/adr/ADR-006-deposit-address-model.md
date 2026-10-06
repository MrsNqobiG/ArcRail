# ADR-006 Deposit address model

**Status: PROPOSED. A human decides at G1.**

**Fix block 11** (LEDGER P1-adrs) puts collection addresses on a dedicated, hardened branch (CF-21). It **matches** THREAT_MODEL v2 fix block 8 (T-I2, DR-04) and OPEN_QUESTIONS Q-D3 and Q-D1(h). It is not ahead of any sibling.

## Context and correction to KICKOFF
KICKOFF says "Arc has no native memo." Primary sources show a **predeployed Memo contract** at `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` on testnet and mainnet (C-62). However:
- "The `Memo` contract must be invoked directly by an externally owned account (EOA). Smart contract wallets aren't supported as the direct caller." (https://docs.arc.io/arc/concepts/transaction-memos.md, accessed 2026-10-02)
- The memo is attached by the **sender**. A third-party payer using an ordinary wallet won't attach our reference. So **for inbound attribution, Arc effectively has no memo we can depend on.** KICKOFF's working assumption holds for inbound, but the wording is wrong (Q-P1).
- Memo content is public and permanent (C-64). It may only ever carry an opaque reference, never PII (L-4).

Other facts:
- Addresses use the standard Ethereum derivation `m/44'/60'/0'/0/x` (C-56). **Collection (deposit) addresses don't use that plain path.** They come from a **dedicated, hardened account-level branch** (`m/44'/60'/a'/0/x`, with a hardened account index `a'` used for nothing else, fixed at the key ceremony). **Only that branch's xpub is exported**, to the independent monitor, so it can derive collection addresses itself (THREAT_MODEL DR-04). The branch is hardened so that a leaked xpub, even together with a leaked child private key, exposes only that branch, never the hot or gas wallets (THREAT_MODEL T-I2). Whether the HSM or custodian can do this is Q-D3 (HSM) and Q-D1(h) (custodian).
- A native send costs about 21,000 gas. At the 20 gwei floor that is **420,000,000,000,000 wei = 0.00042 USDC** (C-30, C-35, CONTRACT §6.1).
- Every on-chain flow is public (C-64, L-1, L-5).
- The deposits guide recommends "one unique address per user" (https://docs.arc.io/integrate/exchanges/deposits.md, accessed 2026-10-02).

## Options

| | A. Per-merchant address (long-lived) | B. Per-payment / invoice address (single-use) | C. Shared address + Memo reference | D. Shared address, attribution by known sender address |
|---|---|---|---|---|
| Inbound attribution | Exact: address → accountRef | Exact: address → invoice → accountRef | **Only if the payer calls Memo.** Third parties won't | Only if the payer's address is pre-registered. Payers can't be forced |
| Linkability (L-1) | One merchant's whole volume is linkable | Lowest | All merchants pooled, but memos link payments | Pooled |
| Registry size (U5) | Number of merchants | Number of invoices (grows without bound) | 1 | 1 plus a sender list |
| Sweeps (gas, T6) | Optional | Usually needed | None | None |
| Unidentified-inbound rate (G4) | Low | Low (payment after expiry → case) | **High** | High |
| Signer load (ADR-001) | Moderate | High: many keys or derivations. Cost depends on custody: with an HSM, on BIP-32 derivation inside it (Q-D3); with a custodian, on per-address fees and limits (Q-D2) | Minimal | Minimal |
| Fit with KICKOFF use case (merchant settlement) | Good | Good for e-commerce checkout | Poor | Poor |

## Recommendation (for the human)
**A, per-merchant deposit addresses, for the pilot,** with an option to add **B** for e-commerce flows later. **C and D are not recommended** for inbound, because attribution would depend on payer behaviour we can't control.

For outbound, the Memo contract *may* be used to attach an opaque 32-byte `memoId` for counterparty reconciliation. It must be a **random value generated per instruction and stored in the adapter's memo table**, never derived from or hashed from `instructionId` or any other identifier (THREAT_MODEL L-4: hashes of low-entropy IDs can be brute-forced). That is a separate decision. The hot wallet is an EOA, which Memo requires.

Sweep policy (if any) is a U11 decision: whether to sweep, the threshold, and the cadence. It trades gas cost against two risks:
- **hot-wallet concentration** (RR-3), which sweeping increases;
- **issuer blocklist freeze of deposit addresses** (RISK_REGISTER RB-1), which sweeping *reduces*, because funds sitting on a blocklisted deposit address are frozen whatever the hot balance is.

### Recommendation by phase
| Phase | Recommended |
|---|---|
| Testnet | **A**, a handful of synthetic merchants |
| Mainnet pilot | **A**, with the sweep policy decided (U11) |
| General availability | **A**, plus **B** for e-commerce if Product asks for it. C and D: no |
