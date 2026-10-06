# ADR-005 On-chain address screening (sanctions/TFS and risk)

**Status: PROPOSED. A human decides at G1.** KICKOFF §1: `undecided`.

## Context
- Arc lists compliance providers "offering analytics, wallet screening, and monitoring tools" (https://docs.arc.io/arc/tools/compliance-vendors.md, accessed 2026-10-02). Listing is not endorsement. No vendor is assessed here.
- Circle's USDC blocklist (C-53, C-55) is the **issuer's** control. It is not the bank's TFS screening and can't stand in for it.
- Attribution: transfers routed through Memo or Multicall3From must be attributed to the original sender (C-63, THREAT_MODEL T-S5). Relayed transfers must be attributed from the log's `from` (C-27).
- The screening result must feed the CBS's existing TFS and case process (P6.2, CONTRACT `screen` and `createCase`).
- Privacy (L-3 by analogy): any external screening API learns the addresses we care about.

## Options

| | A. External analytics API (per-address risk score plus sanctions exposure) | B. Self-hosted list matching (official sanctions lists' published crypto addresses, plus a Circle blocklist mirror) | C. A + B: B first, A for risk scoring |
|---|---|---|---|
| Sanctions coverage | Vendor-curated | Only addresses on official lists | Both |
| Indirect exposure (hops, clusters) | Yes | No | Yes |
| Data residency | Address queries leave the bank (PIA, L-8) | Stays in the bank | Split |
| Determinism (N4: no LLM in the money path) | The vendor's model is opaque. We consume a verdict, never a score threshold computed inside the money path without a pinned rule | Fully deterministic | Mixed |
| Cost | Per-query or licence | Engineering and list maintenance | Both |

## Recommendation (for the human)
**C.** Deterministic self-hosted matching (B) is the hard gate. It is always on and works offline. External risk scoring (A) feeds **REVIEW**, never an automatic CLEAR, subject to a PIA. The verdict mapping (score band → REVIEW/HIT, never CLEAR) is a versioned, tested config owned by Compliance.

**Fail-closed when dependencies are down:**
- If B (list matching) is unavailable or its list is stale (past its published update window) → no CLEAR. The outcome is **REVIEW**, and outbound holds.
- If A (vendor scoring) is unavailable → the outcome is **REVIEW**, unless Compliance has configured a written threshold below which B alone may CLEAR. That threshold is a human decision (Q-D6), and its default is "none".

### Recommendation by phase
| Phase | Recommended |
|---|---|
| Testnet | **B only**, using a test list that includes C-55 and a canary entry (THREAT_MODEL DR-17). Vendor A is stubbed to REVIEW |
| Mainnet pilot | **C**, subject to a PIA for A (L-8) and Q-D6 |
| General availability | **C** |

## Questions this ADR raises
- **Q-D6:** Which official sanctions sources does the bank's TFS programme use, and do they publish crypto addresses in a machine-readable form? (Owner: Compliance.)
