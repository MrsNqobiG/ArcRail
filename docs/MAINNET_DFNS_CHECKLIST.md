# Mainnet with Dfns: what we need

**Status: CHECKLIST (planning).** Mainnet (Arc chain ID 5042) stays disabled in code until every G-M gate in `docs/GATES.md` is signed by a named human. This list assumes the company's existing **Dfns** account as the custodian, which is **ADR-001 option B**. Items marked *confirm* are questions for Dfns (OPEN_QUESTIONS Q-D10, Q-D11). They are not verified facts.

## A. Dfns (custody and signing)
1. Arc support. **Mainnet: confirmed by the operator on 2026-10-06** (citation pending, Q-D10). *Confirm* testnet (5042002) and native USDC as the 18-decimal gas token.
2. Dfns production organisation, with a separate org or environment for testnet.
3. Wallets on Arc:
   - hot wallet (payouts);
   - gas wallet (network fees);
   - collection wallets, one per merchant (*confirm* per-wallet fees and limits).
4. A service account (machine identity) for the rail and its API token. *Confirm* how Dfns authenticates and signs API requests, and which credential the service account must hold. The credential is stored in the bank's vault, never in code.
5. Dfns policy engine. *Confirm* each of these:
   - (a) can it verify **our** FIDO2 checker approval over the exact payment, or does Dfns's own approval quorum stand in for it?
   - (b) allowed shapes only: plain USDC value sends on chain 5042; it refuses contract calls, approvals, permits, typed-data signing and EIP-7702 authorisations;
   - (c) destination allow-lists: payouts only to the approved destination, moves only to Treasury's own wallets;
   - (d) signing is blocked unless the independent monitor's latest `ALL_CLEAR` is fresh;
   - (e) the same approval is never signed twice (replay protection);
   - (f) internal-move rules: Treasury list, per-move and daily caps, and a second approver above a threshold;
   - (g) per-transaction and daily caps that **include network fees**, a fee ceiling, and the chain ID pinned to 5042;
   - (h) export of an xpub for the collection wallets.

   Anything Dfns can't enforce runs in a **bank-run pre-sign policy service** in front of Dfns, inside the signing trust zone (ADR-001: "or the ADR states where else it is enforced").
6. Signing log: Dfns pushes each signature (payment hash, nonce, tx hash, our instruction ID) directly to the monitor, for example by webhook. The webhook signing secret goes in the vault.
7. Nonce assignment: the adapter, or Dfns (Q-D7)?
8. Dfns due diligence: licensing, hosting and data residency (POPIA cross-border), fees, SLA, incident process (Q-D2, Q-R4).

## B. Our own keys and credentials (never in the repo; vault or HSM)
9. The independent monitor's attestation signing key, in an HSM. The signing side trusts only its public key.
10. Checkers' FIDO2 security keys for payment approvals: at least two people, registered with the bank's identity system.
11. Owner signing keys for the trusted lists (Treasury: wallet list and caps; Security: decoy lists and the credential registry), under two-person change control.
12. mTLS client certificates: the rail to the CBS, and the monitor to the CBS as a **separate** identity.
13. Database credentials, with row-level read auditing enabled (Q-D4).
14. Gate signers' personal signing keys (SSH or GPG, verified on GitHub) for `docs/GATES.md`.

## C. Network access
15. Our own Arc mainnet node(s), running the pinned arc-node release on Proxmox.
16. A reference RPC provider account for mainnet, as the second data source. The API key goes in the vault.
17. Mainnet USDC to fund the gas wallet, booked to the bank's own funding account (G7).

## D. Compliance services
18. Sanctions and address-screening provider: production account and credentials.
19. Travel-rule provider or network (FIC Directive 9): production account and credentials, plus at least one counterparty for the interop test.
20. The real core banking system integration: binding checks, the monitor's read APIs, approvals and cases (Q-C19, Q-C18).

## E. Sign-offs before any real money (`docs/GATES.md`, G-M 1–8)
21. FSCA authorisation, and FIC registration with an RMCP covering this rail.
22. A travel-rule test with a counterparty exchange.
23. An exchange-control legal opinion.
24. An independent security review of the rail and its Dfns integration.
25. Key ceremony and signing-policy approval (the Dfns wallet and policy setup), plus a key-compromise drill.
26. Joint Standard 2 evidence, and a POPIA impact assessment covering Dfns and every other vendor.
27. Bank-partner sign-off for the rand legs.
28. A staged rollout plan: internal funds and low caps, then pilot merchants, then general availability.

## F. Decisions for leadership
29. Approve Dfns as the custody option (ADR-001 B) once A1–A8 are confirmed.
30. The USD-stablecoin strategy for domestic payments (Q-R13).
31. Which core banking system and team the rail integrates with.
