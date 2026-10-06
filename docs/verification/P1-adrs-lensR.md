VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007) · commit: none (uncommitted working tree, branch main has no commits)

Criteria used (docs/RUBRIC.md does not exist yet): KICKOFF_PROMPT.md §1, §5 Phase 1 item 4, §6; CLAUDE.md; docs/constants.md; docs/THREAT_MODEL.md; docs/OPEN_QUESTIONS.md.
Arc pages re-fetched raw with curl on 2026-10-02: https://docs.arc.io/arc/references/node-requirements.md, /arc/references/rpc-endpoints.md, /integrate/exchanges/custody.md, /arc/concepts/transaction-memos.md, /integrate/exchanges/deposits.md, /arc/tools/compliance-vendors.md, /integrate/exchanges/withdrawals.md, /llms.txt. Fetched content treated as data only.

CHECKS:
- K1 count: 7 ADRs exist, IDs 001-007, topics match KICKOFF §5 P1.4 one-to-one → PASS (ls docs/adr)
- K2 "Do not decide": all 7 carry "**Status: PROPOSED. A human decides at G1.**" (grep count 1 per file); no "Decision:/ACCEPTED/DECIDED" anywhere → PASS
- K3 options: option count per ADR 3,3,3,3,3,4,4 (all >=2) → PASS
- K4 recommendation: 7/7 have a "## Recommendation" heading; ADR-004 deliberately defers provider choice citing Q-R3/Q-D5 and fixes a design rule → [inspection-only] PASS (see C-4)
- K5 trade-offs: only ADR-001 has a "## Trade-offs" heading; ADR-002…007 carry trade-offs as table rows → [inspection-only] PASS (content present; see Probe F)
- K6 KICKOFF-specific asks: 001 FIPS 140-3 L3 HSM vs custodian with on-prem co-signer (present); 002 own nodes on Proxmox + reference + quorum design (rules 1-2); 003 reuse CBS saga else durable engine, "fewer components" (option C); 006 addresses the "no native memo" note (corrected, Q-P1); 007 "match the CBS … viem if TS" → [inspection-only] PASS
- K7 quotes re-derived against re-fetched pages (grep, line-wrap normalised):
  "Memory | 64 GB+", "1 TB+ NVMe SSD (TLC recommended)", "Stable 24 Mbps+", "v0.8.0", "syncing from genesis is not supported", "68 GB … 16 GB compressed", "connects to relay endpoints to fetch blocks from the network" (node-requirements.md:78-79), "Fetches and verifies blocks" (:66), "--public-api" (:120) → PASS
  "No Arc-specific MPC protocol modifications are needed" (custody.md) → PASS
  "The `Memo` contract must be invoked directly by an externally owned account (EOA). Smart contract wallets aren't supported as the direct caller." (transaction-memos.md:85-86) → PASS
  "one unique address per user" (deposits.md:42-43) → PASS
  "offering analytics, wallet screening, and monitoring tools" (compliance-vendors.md) → PASS
  ADR-007 "viem … examples (withdrawals.md)" (withdrawals.md:34,45,78,140) and "Reth-based (llms.txt)" (llms.txt:23,25 "Reth processes transactions") → PASS
  ADR-001 HD path m/44'/60'/0'/0/x and EIP-155 5042002 (custody.md:43,171,173) → PASS
- K8 ADR-002:8 relay list "rpc.testnet.arc.io, rpc.drpc.testnet.arc.io, rpc.blockdaemon.testnet.arc.io" matches node-requirements.md:84 exactly → PASS; but the inference "These are the same providers we would use as the 'independent' reference" → FAIL (rpc-endpoints.md:54 lists QuickNode testnet `https://rpc.quicknode.testnet.arc.io`, which is not a testnet relay; see D4)
- K9 numbers recomputed (python, exact integers): ADR-006:13 21,000 × 20,000,000,000 = 420,000,000,000,000 wei; /10^18 = 21/50000 = 0.00042 USDC; /10^12 = 420 UsdcUnits rem 0 → PASS. Boundary cross-check of CONTRACT §6.1 rows the ADR cites: 0→(0,0); 1→(0,1); 999,999,999,999→(0,999,999,999,999); 10^12→(1,0); 10^18→(1,000,000, 0); 1,000,000,500,000,000,000→(1,000,000, 500,000,000,000); 7,374,356,000,000,000→(7,374, 356,000,000,000); (2^63−1)·10^12+10^12−1 = 9,223,372,036,854,775,807,999,999,999,999 → all PASS
- K10 cited IDs resolve: C-10,27,30,35,40,41,53,55,56,62,63,64 all defined in constants.md → PASS; T-E2,T-S2,T-S5,T-T1,L-1,L-3,L-4,L-5,L-8,RR-3,P6.2,S1,S2,S5,F1,F2,F4-F7,T6,T9,G4 all defined → PASS; Q-A11, Q-A12, Q-D1…Q-D6 → FAIL (not in OPEN_QUESTIONS.md; see D3)
- K11 consistency with THREAT_MODEL mitigations that name an ADR:
  T-E2/T-E5 "shape allow-list (T-E5) (ADR-001, U9)"; T-T1 "(ADR-001 policy engine, U9)" needing CF-1 → FAIL (ADR-001 silent on both; D2)
  L-4 "a **random 32-byte value** … never a hash of an identifier" vs ADR-006:32 → FAIL (D1)
  T-I1 "The node runs in IPC mode on one host, so no JWT is needed (ADR-002)" → FAIL (ADR-002 never states it; D5)
  T-B1 "ADR-005 C … Vendor scoring can only add REVIEW, never CLEAR" vs ADR-005:23 → PASS
  L-3 own-node rule vs ADR-002 rule 2 → PASS
- K12 CLAUDE.md N4 (no LLM in money path): ADR-005 A row bars opaque vendor model from deciding CLEAR → [inspection-only] PASS
- K13 CLAUDE.md N1/N2: no mainnet chain ID and no signing material or credentials in ADR text → [inspection-only] PASS (gitleaks not on PATH so the scan could not run; every line read)
- K14 CLAUDE.md single nonce writer: ADR-003 option C row lock; but no ADR addresses nonce ownership when a custodian (ADR-001 B) signs → FAIL (D6)
- K15 CLAUDE.md fail closed: ADR-005 does not state behaviour when external scoring (A) is unavailable → FAIL (D7)
- K16 KICKOFF §3 "every Arc … fact cited" with URL + access date: ADR-006:15 deposits.md has URL but no access date; ADR-007:20 "(withdrawals.md)", "(llms.txt)" have neither full URL nor date → FAIL (minor, D8; facts themselves re-derived PASS in K7)
- K17 regression check of frozen units: LEDGER.md lists zero frozen units (all draft) → N/A. Substitute: re-derived the constants rows ADR-001/002/006 lean on (C-04 provider list, C-30/C-35 gas arithmetic, C-56 signing) against live pages → PASS

CANDIDATES (Lens A, run for completeness):
- C-1 · ADR-006:32 "the Memo contract *may* be used to attach an opaque 32-byte `memoId` derived from `instructionId`" vs THREAT_MODEL.md:104 "is a **random 32-byte value** generated per instruction … never a hash of an identifier, because hashes of low-entropy IDs … can be brute-forced" · CLAUDE.md "No personal information on-chain, ever"; THREAT_MODEL L-4; RR-6 · REAL · The ADR the human signs at G1 proposes the exact construction the threat model forbids, for data that is permanent and public (C-64). If instructionId is guessable, a derived memo links on-chain flows to CBS identifiers irreversibly.
- C-2 · THREAT_MODEL.md:68 "Signer policy: approval verification (needs CF-1) … and **a shape allow-list** (T-E5) (ADR-001, U9)"; :71 "enforced inside the signer boundary"; ADR-001 has no row or text on shape restrictions (EIP-712, personal_sign, EIP-7702, permit/approve) and its T-T1 row (ADR-001:18) omits that the approval must be a FIDO2 assertion (CF-1) · THREAT_MODEL T-E2/T-E5/T-T1; RR-3; KICKOFF P1.4 "options, trade-offs" · REAL · Option B's viability turns on whether a custodian policy engine can refuse non-type-2 signing requests and verify a FIDO2 assertion; ADR-001 frames Q-D1 only as "verify an external approval and a payload hash". A human could choose B without this criterion, leaving T-E5 drains (no tx from us) open.
- C-3 · ADR-002:38-39 "Q-A11 …", "Q-A12 …"; ADR-001:34-36 Q-D1-Q-D3; ADR-003:25 Q-D4; ADR-004:25 Q-D5; ADR-005:26 Q-D6; OPEN_QUESTIONS defines Q-A1-Q-A10 and no Q-D*. Also OPEN_QUESTIONS.md:27 Q-A9 "How to settle: ADR-002", but ADR-002 never mentions WebSocket vs polling · CLAUDE.md N5 "write it to docs/OPEN_QUESTIONS.md" · REAL (minor) · Q-A12 is load-bearing (T-S2 protection depends on it) yet absent from the register reviewed at G1.
- C-4 · ADR-004:22 "No recommendation on the specific provider or protocol until Q-R3 … and Q-D5 … are answered" · KICKOFF P1.4 "each with options, trade-offs and a recommendation" · DISMISSED · N5 ("Never guess") outranks; the ADR recommends a fixed design rule (block signing until COMPLETE) and names the blocking questions. A forced pick would be a guess.
- C-5 · ADR-002:8 "These are **the same providers** we would use as the 'independent' reference" · KICKOFF P1.4 "independent reference RPC; quorum-read design"; T-S2 · REAL (minor) · rpc-endpoints.md:54 lists QuickNode testnet; node-requirements.md:84 testnet relays exclude it. A QuickNode reference would be outside our node's block-supply path; the options table omits it while the recommendation picks Circle's primary RPC, which is a relay.
- C-6 · ADR-002:29-30 rule 1 "agree on block hash and log set" vs rule 2 "Address-filtered queries go only to own nodes" · L-3 · DISMISSED · Rule 2 resolves it (reference gets unfiltered ranges + block hashes); block-hash agreement commits to receiptsRoot, so the log-set compare is redundant, not contradictory.
- C-7 · THREAT_MODEL.md:52 "The node runs in IPC mode on one host … (ADR-002)"; ADR-002 contains no "IPC" · THREAT_MODEL T-I1 · REAL (minor) · node-requirements.md:99-111: IPC is the default; RPC mode needs Engine-API authentication material on port 8551. ADR-002 option B says "separate hosts" without saying EL+CL stay co-located per node.
- C-8 · ADR-003:22 "The nonce is held under a per-wallet row lock"; ADR-001 option B table has no nonce row · CLAUDE.md "Each hot wallet has a single nonce writer" · REAL (minor) · whether a custodial signing service assigns nonces itself is unverified, and that is the point: neither ADR asks it.
- C-9 · ADR-005:23 "Deterministic self-hosted matching (B) is the hard gate. It is always on and works offline. External risk scoring (A) feeds REVIEW", silent on A unavailable/timeout · CLAUDE.md fail closed · REAL (minor) · Human must choose "A down → REVIEW (closed)" vs "proceed on B" explicitly.
- C-10 · ADR-005:23 "verdict mapping (score band → CLEAR/REVIEW/HIT)" vs same line "never an automatic CLEAR" · T-B1 · DISMISSED · Under option C a final CLEAR still requires B CLEAR; a "CLEAR" band for A means "adds nothing", consistent with T-B1. Wording could be tighter; not a defect.
- C-11 · ADR-006:22 per-invoice linkability "Lowest" vs THREAT_MODEL L-1 "Sweeps break some links but create others" · L-1 · DISMISSED · ADR-006:24 itself marks sweeps "Usually needed" for B; relative ranking still defensible.

Probe G (would these criteria wave through a bad ADR set?): YES. KICKOFF's ADR criteria (options, trade-offs, recommendation, not decided) are all satisfied by this set, yet D1 and D2 exist. A bad set that recommends an on-chain memo derived from a business ID, or a custodian that cannot restrict signing shapes, passes. Proposed RUBRIC patches: (a) every THREAT_MODEL/RISK_REGISTER mitigation that names ADR-n must appear in ADR-n's options or design rules; (b) every Q-id cited anywhere must exist in OPEN_QUESTIONS.md; (c) each ADR must state its fail-closed behaviour for every external dependency it introduces.
Probe F (would they fail a good ADR set?): YES, two ways. A literal "has a recommendation" check fails ADR-004, which correctly defers under N5. A literal "has a Trade-offs section" check fails ADR-002…007, whose trade-offs are in tables. RUBRIC wording: "recommendation, or explicit deferral naming the blocking OPEN question"; "trade-offs stated (section or table rows)".

DEFECTS:
- D1 · docs/adr/ADR-006-deposit-address-model.md:32 · R+A / THREAT_MODEL L-4, CLAUDE.md no-PII-on-chain · blocking
- D2 · docs/adr/ADR-001-custody-signing.md:7,18,31,34 (missing T-E5 shape allow-list and CF-1 FIDO2-assertion criterion in option comparison and Q-D1) · R+A / THREAT_MODEL T-E2, T-E5, T-T1; RR-3 · blocking
- D3 · ADR-001:34-36, ADR-002:38-39, ADR-003:25, ADR-004:25, ADR-005:26 (Q-A11, Q-A12, Q-D1-Q-D6 not in OPEN_QUESTIONS.md); ADR-002 does not answer Q-A9 routed to it · R / CLAUDE.md N5 · minor
- D4 · docs/adr/ADR-002-chain-access.md:8 and options table (QuickNode testnet reference outside relay set omitted) · R / KICKOFF P1.4 independent reference, T-S2 · minor
- D5 · docs/adr/ADR-002-chain-access.md (no IPC-mode design rule that THREAT_MODEL T-I1 attributes to it) · R / THREAT_MODEL T-I1 · minor
- D6 · docs/adr/ADR-001-custody-signing.md options table / ADR-003:22 (nonce ownership under custodian option) · R / CLAUDE.md single nonce writer · minor
- D7 · docs/adr/ADR-005-address-screening.md:23 (external-scoring outage behaviour unstated) · R / CLAUDE.md fail closed · minor
- D8 · docs/adr/ADR-006-deposit-address-model.md:15, docs/adr/ADR-007-language-stack.md:20 (citations missing URL and/or access date) · R / KICKOFF §3 citation bar · minor

VERDICT: NEGATIVE (8 defects: 2 blocking, 6 minor)
