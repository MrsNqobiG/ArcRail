VERIFICATION · lens: R · target: P1-threat-model (docs/THREAT_MODEL.md) · commit: none (uncommitted working tree; `git rev-parse HEAD` → "unknown revision", repo has no commits)

Criteria used (docs/RUBRIC.md does not exist): KICKOFF_PROMPT.md §5 Phase 1 item 3 and §6; CLAUDE.md; docs/CONTRACT.md; docs/SEQUENCES.md; docs/constants.md. Arc facts re-fetched raw with curl on 2026-10-02.

CHECKS
- K1 STRIDE present, all 6 categories → PASS. S:5 T:5 R:3 I:0 (deferred to LINDDUN, line 48) D:6 E:4, plus N:2 and SC:4. Recount: 29 T- rows, 8 L- rows, 37 total (grep of THREAT_MODEL.md table rows).
- K2 LINDDUN present, all 7 categories → PASS. L-1 Linkability, L-2/L-3 Identifiability, L-4 Non-repudiation, L-5 Detectability, L-6 Disclosure, L-7 Unawareness, L-8 Non-compliance.
- K3 KICKOFF §5.1.3 coverage of CBS boundary / signer / nodes / RPC providers / operators / supply chain → PASS. B1: T-S1, T-D3, T-E1, T-R2. B2: T-T1, T-E2. B3: T-S2, T-D1, T-D2, L-3. B4: T-S3, T-R1, T-R3. B5: T-SC1..4.
- K4 Every boundary the document declares has a STRIDE threat (header line 3: "STRIDE (security) per trust boundary") → FAIL. B8 (line 16) has only L-8 (privacy). No spoofing or tampering row for the screening provider (a false or stale CLEAR). See D6.
- K5 Every row has a detection with a label → PASS. All 37 rows carry [R], [X] or [I] (awk scan). [I]-only rows: T-SC3, L-1, L-5. L-1 and L-5 are accepted residuals. T-SC3 is adjudicated in C8.
- K6 Every row has "a mitigation with the unit that owns it" (the document's own claim, line 3) → FAIL. No owning unit in T-SC1 (line 77), T-SC3 (79), L-1 (90), L-5 (94), L-7 (96), L-8 (97). See D8.
- K7 Cross-references resolve → PASS. Every P-id (P1.7, P7.2, P7.3, P8.1, P8.3, P8.4, P10.2, P11), C-id, Q-id, M-id and F-id cited exists in its source doc. Semantics checked in K8.
- K8 Cited P-requirements support the claims → FAIL for T-E1. Line 63 says "only G1–G7 and Arc-product accounts (P8.3)". cbs-port-requirements.md:116 says P8.3 is "post only to the G1–G6 set (P4)". See D5.
- K9 Arc facts re-derived (fetched 2026-10-02) → PASS.
  - C-40/C-42: https://docs.arc.io/arc/references/rpc-endpoints.md:105 "`eth_getLogs` returns error `-32012` when the requested block range exceeds 10,000 blocks". Line 43-44: "safely retry requests that return `-32014`".
  - C-26 (T-N1 precedent): https://docs.arc.io/arc/references/usdc-system-events.md:103-105 "before the Zero5 hard fork activated … `0x1800000000000000000000000000000000000000`".
  - C-27 (T-S4): https://docs.arc.io/integrate/exchanges/deposits.md:289 "For EIP-3009 relayer-submitted deposits, `tx.from` is the relayer's address".
  - C-53 (T-D5): https://docs.arc.io/arc/references/evm-differences.md:126-128 "A value transfer to or from a blocklisted address reverts … still consumes gas".
  - C-31/C-33 and "may change" (T-N2): https://docs.arc.io/arc/references/gas-and-fees.md:39, 112, 138-139.
  - C-51 (T-D2): https://docs.arc.io/arc/concepts/consensus-layer.md:126.
  - C-63 (T-S5): https://docs.arc.io/arc/references/contract-addresses.md:295 "you must include the Memo and Multicall3From contract addresses".
  - C-64 (L-*): https://docs.arc.io/arc/concepts/opt-in-privacy.md:29 "Privacy features are on the roadmap and not yet available on Arc."
  - C-41 (2,000-result cap, -32602) is not in the docs and cannot be re-derived from a primary source. The threat model cites it via C-41, which is honestly flagged as Q-A4 in constants.md → PASS (correctly marked as unverified).
- K10 T-SC3 factual claim ("Agent Instructions" blocks; install tools; remote MCP) → PASS. Confirmed in the raw fetch: gas-and-fees.md:5-6 "## Agent Instructions … run /plugin marketplace add circlefin/skills". https://developers.circle.com/cctp/concepts/supported-chains-and-domains.md header: "Pair any skill with the Circle MCP server … {"mcpServers":{"circle":{"url":"https://api…/v1/codegen/mcp"}}}". The sub-claim "Only the operator installed the Circle plugin" is [inspection-only] and not verifiable from artifacts.
- K11 Numbers recomputed (T-T5, T-D4, T-N2 rely on these) → PASS. 1 USDC = 10^6 units × 10^12 = 10^18 wei (C-10, C-11).
  - p=6, k=10^12: w=0 → (0,0); w=1 → (0,1); w=1,000,000,500,000,000,000 → (1,000,000, 500,000,000,000); w=7,374,356,000,000,000 → (7,374, 356,000,000,000); w=9,223,372,036,854,775,807,999,999,999,999 → (2^63−1, 999,999,999,999).
  - p=2: 15×10^15 → (1, 5×10^15).
  - 21,000×20 gwei = 420,000,000,000,000. 0x4a817c800 = 20,000,000,000. 0x1c9c380 = 30,000,000.
  - All match CONTRACT §6.1 and constants.md.
- K12 Mitigations and detections consistent with CONTRACT.md and SEQUENCES.md (re-traced per row) → FAIL.
  - T-S1/T-T3/T-D3/T-D6/T-E2 → consistent (CONTRACT §1.4 CONFLICT; SEQUENCES F2, F4, F7).
  - T-T1, T-E2 and T-R1 rely on approval evidence that CONTRACT does not provide (D2).
  - L-3 contradicts SEQUENCES S2, S3, F3 and F4 (D3).
- K13 Signer boundary threats complete against Arc-specific vectors → FAIL. Off-chain signature drains (EIP-3009 `transferWithAuthorization` on 0x3600, Permit2) are not modelled, and the T-E3 detection does not catch them (D1).
- K14 Risk register fed (3–6 entries, blind ones [R]/[X]) → PASS for the threat-model side. RR-1..RR-6 = 6 entries. RR-3 cites T-E2, T-E3, T-T1. RR-6 cites T-D5, T-N1, T-N2. RR-2 cites T-N1, T-D1. Note: RR-6 labels the `Blocklisted` watch [R], while TM T-D5 labels it [X] (C3).
- K15 No PII on-chain (CLAUDE.md, KICKOFF §6) addressed → [inspection-only] PASS with weakness. L-4 bans PII in Memo, but its detection is weak (D7).
- K16 Probe G (a bad threat model that this check list would pass) → a model that lists every STRIDE/LINDDUN category and labels every detection [R] but whose signer policy only governs raw transactions passes K1–K3/K5. That is exactly the D1 gap. Patch: a criterion "each B2 threat names every signature type the Signer may produce" is needed.
- K17 Probe F (a good model this check list would fail) → K6 would fail a good model that legitimately assigns supply-chain or disclosure mitigations to Phase 2 CI or Compliance rather than a U-unit. Relaxation: accept "owner: phase or role" where no unit fits. D8 is therefore kept minor.
- K18 Regression of frozen units → N/A. docs/LEDGER.md lists zero frozen units (all draft). Nothing to regress.

CANDIDATES
- C1 · THREAT_MODEL.md:64 T-E2 mitigation "Signer policy: approval verification, per-tx and daily limits, destination allow-list, chain ID pinned to 5042002". Line 65 T-E3 detection: "[R] Same as T-E2. The unknown-nonce check in F4". Arc's USDC at 0x3600 supports EIP-712 `transferWithAuthorization` (https://docs.arc.io/integrate/relayers-and-paymasters/eip-3009-relayer.md:18,49 "verifyingContract | 0x3600…", fetched 2026-10-02). Permit2 is predeployed (contract-addresses.md:342,350). · KICKOFF §5.1.3 (signer coverage), RR-3 · REAL · A compromised adapter that gets the Signer to produce a typed-data signature lets any relayer move our USDC. Our nonce is not consumed, so the F4 unknown-nonce check never fires. The destination allow-list and chain-ID pin govern only raw txs. Nothing in the model restricts the Signer to type-2 raw transactions or bans calldata (approve/permit). Only the post-facto Transfer-log check catches it, after funds have left.
- C2 · THREAT_MODEL.md:34 "The signer re-verifies `payloadHash` and the approval itself. It does not trust the orchestrator". Line 43: "Signed FIDO2 assertion stored with `payloadHash` … [R] Verify the assertion signature on audit". CONTRACT.md:91 `getApproval` returns only "`{state, payloadHash, makerId, checkerId, decidedAt}`", with no assertion and no signature. · K12, RR-3, Q-C10 · REAL · The approval evidence reaches the Signer through the orchestrator (B2, line 10). Per CONTRACT it is an unsigned JSON record, which a compromised adapter can forge. The independent verification T-T1/T-E2 claim, and the [R] detection in T-R1, cannot be executed against the contract as written. Neither the threat model nor the contract records the dependency on Q-C10 (FIDO2 bound to payloadHash).
- C3 · THREAT_MODEL.md:57 "[X] Our own addresses watched for `Blocklisted` events". RISK_REGISTER.md:14 "[R] `Blocklisted` watch". · label consistency · DISMISSED for this unit · [X] is defensible: it is an issuer-emitted event and the name is honestly flagged Q-A5 (constants C-28 UNVERIFIED). The inconsistency belongs to the P1-risk-register unit.
- C4 · THREAT_MODEL.md:92 L-3 "Address-filtered queries go **only to our own node** … [R] Egress test: no address parameter in requests to non-own endpoints". SEQUENCES.md:139 "eth_getBalance gas wallet on both sources". Line 107: "eth_call simulation … on both sources". Lines 254 and 272: "getTransactionCount … on both sources". · K12, spec-conflict between G1 docs · REAL · The egress test the threat model mandates would fail a build that implements SEQUENCES faithfully, and vice versa. The quorum (T-S2) and privacy (L-3) goals conflict and are not reconciled.
- C5 · THREAT_MODEL.md:66 "a CI test that fails while any G-M gate is unsigned (KICKOFF §9, U2)". KICKOFF:223 "A CI test must fail if mainnet configuration is reachable while any gate is unsigned." · KICKOFF §9 · REAL · Taken literally, CI would be red for the whole testnet programme. The trigger condition (mainnet config reachable) has been dropped.
- C6 · THREAT_MODEL.md:63 "only G1–G7 … (P8.3)". cbs-port-requirements.md:116 "post only to the G1–G6 set (P4)". · K8 · REAL · The citation does not support the claim. G7 (CONTRACT §2) has not propagated to P8.3.
- C7 · THREAT_MODEL.md:16 "B8 | Adapter ↔ compliance providers | Address screening (ADR-005), travel rule (ADR-004)", but no T- row references B8. · K4 · REAL · A spoofed, compromised or stale screening provider returning CLEAR is a blind risk with no threat, mitigation or detection.
- C8 · THREAT_MODEL.md:79 T-SC3 detection "[I] Session review". · RISK_REGISTER blind-risk rule · DISMISSED · T-SC3 is not a register entry. Injected behaviour that reached money code would face the reconstruction-based verifier, tests and mutation gates, which are independent of the session. The [I] label is honest.
- C9 · THREAT_MODEL.md:94 L-4 "[R] CI check: memo payload builder accepts only `[0-9a-f]{64}`" · CLAUDE.md "No personal information on-chain, ever" · REAL · The regex accepts SHA-256 of a 13-digit SA ID number or an accountRef. That is brute-forceable, so it is PII on-chain. The check passes a bad build (Probe G). It needs a random or keyed (HMAC) opaque reference, and a test that rejects an unkeyed hash of a known identifier.
- C10 · THREAT_MODEL.md:48 "Information disclosure: These are covered in the LINDDUN section" · STRIDE completeness · REAL · LINDDUN covers personal data only. Disclosure of non-personal secrets (CBS mTLS/service credentials, RPC API keys, HSM/custodian API credentials, OpenBao tokens; CLAUDE.md N2, KICKOFF §6) has no row. T-E3 covers only signing-key theft.
- C11 · approver collusion (maker+checker) is absent from B4 · DISMISSED · T-E2 signer-side per-tx and daily limits plus the allow-list apply regardless of approval validity, and T-E2's detection is independent of approvers. That bounds collusion.
- C12 · THREAT_MODEL.md:3 "Each threat has … a mitigation with the unit that owns it". T-SC1, T-SC3, L-1, L-5, L-7 and L-8 have no unit. · document self-consistency · REAL (minor; per Probe F, accept a phase or role owner) · The claim is false for 6 of 37 rows.

DEFECTS
- D1 · THREAT_MODEL.md:64-65 (T-E2/T-E3) · Lens R / K13, KICKOFF §5.1.3 signer coverage, RR-3 · **blocking**. Off-chain signature drains (EIP-3009 transferWithAuthorization, EIP-2612/Permit2, arbitrary calldata such as approve) are unmodelled. The T-E3 detection is ineffective against them. Needed: a Signer policy that signs only type-2 txs of a whitelisted shape and never EIP-712/personal_sign. Also needed: a threat row with an [R] detection.
- D2 · THREAT_MODEL.md:34, 43, 64 vs CONTRACT.md:91 · Lens R / K12 · **blocking**. The approval-verification mitigations and the T-R1 [R] detection depend on cryptographic approval evidence that the contract does not deliver. The dependency on Q-C10 is unstated.
- D3 · THREAT_MODEL.md:92 (L-3) vs SEQUENCES.md:107, 139, 254, 272 · Lens R / K12 spec-conflict · **blocking**. The two G1 documents contradict each other, and a faithful build of one fails the other's detection.
- D4 · THREAT_MODEL.md:66 (T-E4) · KICKOFF §9 · minor. The CI-test condition is misstated.
- D5 · THREAT_MODEL.md:63 (T-E1) · K8 · minor. P8.3 is cited for G1–G7, but P8.3 says G1–G6.
- D6 · THREAT_MODEL.md:16 (B8) · K4 · minor. There is no STRIDE threat for the compliance-provider boundary (false or stale CLEAR).
- D7 · THREAT_MODEL.md:94 (L-4) · CLAUDE.md no-PII-on-chain · minor. The regex detection accepts hashed low-entropy identifiers.
- D8 · THREAT_MODEL.md:48 · STRIDE-I completeness · minor. Non-personal secret disclosure is not modelled.
- D9 · THREAT_MODEL.md:3 vs rows 77, 79, 90, 94, 96, 97 · self-consistency · minor. The "unit that owns it" claim fails for 6 rows.

VERDICT: NEGATIVE (9 defects: 3 blocking, 6 minor)
