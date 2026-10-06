# ADR-004 Travel rule (FIC Directive 9) interoperability

**Status: PROPOSED. A human decides at G1.** KICKOFF §1: `undecided`. The Directive 9 facts below were **read by the agent from the archived primary text** (`docs/sources/fic/`, 2026-10-02). They are **not yet confirmed by Compliance** (Q-R3).

**Fix block 11** (LEDGER P1-adrs) adds the counterparty-acknowledgement requirement for hosted CASPs (CF-24, Q-D9). It **matches** THREAT_MODEL v2 fix block 8 residual 13 and DR-18, and OPEN_QUESTIONS Q-D9. It is not ahead of any sibling.

## Context
- Directive 9 (Gazette 51556, Notice 5543, 15 Nov 2024; "comes into operation on 30 April 2025", ¶9.1):
  - applies to every "qualifying transfer", defined as "a transaction in a business relationship involving a crypto asset which is any value above zero" (¶2.1.9);
  - below R5 000 per single transaction a reduced field set applies (¶4.5), and the originator information need not be verified for accuracy "unless there is a suspicion of money laundering or terrorist financing, in which case … [it] must verify the information pertaining to the originator" (¶4.6). A ZAR valuation is therefore needed (Q-R10);
  - the ordering CASP "may not execute a crypto asset transfer if it cannot comply" (¶4.8);
  - data goes "prior to, or simultaneously with" the transfer, and "Post facto transmission … is not permitted" (¶7.2, ¶7.3);
  - counterparty-CASP due diligence is required (¶4.7);
  - unhosted wallets need risk-based policies (¶8);
  - the bank as **recipient** CASP must verify the beneficiary's identity (¶6.2). It must take reasonable measures to identify **cross-border** transfers that lack the required information, and have risk-based policies on when to execute, suspend execution or return such **cross-border** transfers (¶6.4, ¶6.5; Q-R9).
- C-64: everything on-chain is public, so travel-rule data **must never go on-chain**. That includes Memo payloads (Q-P1, THREAT_MODEL L-4).
- CONTRACT §3 keeps the adapter PII-free: the originator payload stays in the travel-rule system and the adapter holds only `payloadRef`.
- Gate G-M 2 needs an interop test with at least one counterparty CASP.

## Options

| | A. Commercial travel-rule network or provider (hosted) | B. Self-hosted open protocol node (interoperable messaging protocol) | C. Bilateral manual exchange (email/portal) for a pilot with named counterparties |
|---|---|---|---|
| Counterparty reach | Widest, within that network | Depends on adoption by counterparties | A handful |
| Data residency (POPIA s72) | Usually offshore. Needs a PIA (L-8) | Stays in the bank | Stays in the bank |
| Unhosted-wallet handling | Often built in | Must be built | Manual |
| Effort | Integration | Highest | Lowest, but doesn't scale and is error-prone |
| Fit with "block send without complete data" | Status API | Status API | Human attestation only |
| Counterparty acknowledgement for hosted CASPs (Q-D9) | Unknown: depends on the network (Q-D9) | Unknown: depends on the protocol and on counterparty adoption (Q-D9) | Only if each named counterparty agrees to echo a digest (Q-D9) |

## Recommendation (for the human)
No recommendation on the specific provider or protocol until Q-R3 (field list) and Q-D5 (which counterparties the pilot merchants actually pay) are answered. The design rule is fixed whichever option is chosen: the orchestrator **blocks signing** until the travel-rule system returns `COMPLETE` for this `instructionId` (SEQUENCES F6). The travel-rule payload never passes through the adapter's logs or telemetry.

**Counterparty acknowledgement for hosted CASPs (Q-D9, THREAT_MODEL DR-18 limit, residual 13).** DR-18 can't catch a compromised provider that reports the CBS's digest but sends altered data. Only an acknowledgement from the receiving CASP, echoing a digest of the data it received, can catch that. Whichever option is chosen is assessed for this:
- **If it provides one:** Compliance's travel-rule operations compare the echoed digest with the digest of the payload sent, **for every transfer to a hosted CASP**. A mismatch → a PAUSE request on the monitor's operator channel (ADR-008), as residual 13 states.
- **If it doesn't:** hosted CASPs stay under residual 13, and the bank accepts that at G1.

Unhosted wallets have no receiving CASP to echo anything, so for them residual 13 always applies. No option has been assessed for this yet (Q-D9).

### Recommendation by phase
| Phase | Recommended |
|---|---|
| Testnet | A **stub travel-rule service** implementing the CONTRACT interface (`payloadRef`, COMPLETE/INCOMPLETE, digest) with synthetic data only, so the F6 and DR-18 paths can be exercised. No real personal data |
| Mainnet pilot | **Deferred (N5)** until Q-R3 is confirmed by Compliance (the directive text is now archived), Q-R9 (inbound obligations) and Q-D5 (counterparties) are answered. **The pilot is blocked** until then (G-M 2) |
| General availability | As chosen for the pilot |

## Questions this ADR raises
- **Q-D5:** Who are the expected counterparties: other CASPs, the merchants' own unhosted wallets, or exchanges? This decides whether network reach matters.
- **Q-D9:** Does the chosen travel-rule protocol or vendor give us a **counterparty acknowledgement**, meaning the receiving CASP echoes a digest of the data it received, so a compromised provider that sends altered data can be detected (THREAT_MODEL residual 13, DR-18)? The authoritative wording is the OPEN_QUESTIONS row.
