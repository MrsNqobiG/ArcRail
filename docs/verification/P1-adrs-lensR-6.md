VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 6, after reframe fix block 2 · commit: none (uncommitted working tree)

ADR SHA-256 prefixes 001…007:
- d3445e3f9287a380, a17ab99739fcae16, 9f73f03bebac8f5e, 43554bbf083caec3, 08cdf2fb0dc482fa, cf0e830be68c281e, 05c75efbf80b87d2.
- Hashed at the start and again at the end of the run (about 09:05–09:18 UTC, 2026-10-03). The hashes were stable.
- Against R5, only ADR-003 and ADR-006 changed. The other five are byte-identical to R5.

Concurrency notice: other files changed while this run was in progress, so they are not frozen inputs.
- OPEN_QUESTIONS.md (new Q-A16; rows shifted by one line), RUBRIC.md (MC-24 now includes the replay rule; v2 fix block 3), LEDGER.md, THREAT_MODEL.md (DR-25 added), CONTRACT.md (all sections shifted) and a new docs/adr/ADR-008-independent-monitor.md were all modified or created during the run.
- ADR-008 is outside this target (ADR-001…007) and was not verified.
- Every finding below was re-checked against both the pre-edit and the post-edit text of the criteria files and holds for both.

Criteria: KICKOFF §1, §5 P1.4, §6, §9; CLAUDE.md; RUBRIC.md (MC-03, MC-21, MC-43, MC-44, MC-45, ADR rules, JL-1…JL-6); constants.md; THREAT_MODEL.md; RISK_REGISTER.md; CONTRACT.md; OPEN_QUESTIONS.md; docs/sources/.

CHECKS:
- R5 D1 (reverse resolution of Q-D3 and Q-D7)
  - Q-D7: OPEN_QUESTIONS lists "ADR-001, ADR-003". ADR-003:8 ("… otherwise the custodian is the single writer (Q-D7)"), ADR-003:17 (row label "when the adapter is the writer, ADR-001 / Q-D7") and ADR-003:34 (verbatim Q-D7 text) now cover it.
  - Q-D3: OPEN_QUESTIONS lists "ADR-001, ADR-006". ADR-006:26 ("… Q-D3") now covers it.
  - ADR-003:8 is consistent with ADR-001:12 on who writes the nonce under A and B.
  - Result: PASS.
- Q-D reverse resolution, all 7 rows: every ADR named in a row's ADR column mentions that Q-id (D1→001, D2→001, D3→001+006, D4→003, D5→004, D6→005, D7→001+003). Other register rows that cite ADRs also resolve: Q-P1→ADR-006, Q-A9→ADR-002 rule 6 (:34), Q-A12→ADR-002. Result: PASS.
- MC-44 forward resolution (script): every ID cited in the 7 ADRs resolves to exactly one definition. That covers 15 C-ids, 22 Q-ids, T-E2/E3/E5/I1/S2/S5/T1, L-1/3/4/5/8, DR-01/12/13/17/18, RB-1/7, RR-3, CF-1/5, MC-17. The CONTRACT anchors §1.3, §3, §4, §5.0, §6 and §6.1 still exist after the concurrent CONTRACT edit (:58, :147, :170, :195, :458, :470). SEQUENCES S1–S5 and F1–F7 headings exist (SEQUENCES.md:33–411). CONTRACT T9 exists. G-M 2/5/8 match KICKOFF §9. P6.2 matches cbs-port-requirements.md:91. Result: PASS, except D2 (content of the ADR-001 reference at ADR-006:26).
- MC-21 re-fetch: on 2026-10-03, 11 docs.arc.io pages were fetched live, all HTTP 200: node-requirements, rpc-endpoints, custody, transaction-memos, deposits, compliance-vendors, withdrawals, contract-addresses, opt-in-privacy, llms.txt, and evm-differences (compared with the REFETCH-later copy). All 11 are byte-identical to the archive. I recomputed the 38 MANIFEST SHA-256 rows: 0 mismatches. Result: PASS.
- MC-21 quotes: I extracted every double-quoted string in the 7 ADRs and searched for it, normalised, in docs/sources/, KICKOFF and CLAUDE.md. Everything resolves except two strings.
  - "Blocked address" (ADR-007:8) is the C-57 observed string, which is not in the docs by definition.
  - "block send without complete data" (ADR-004:26) is not verbatim; see C-5.
  - ADR-003:3 quotes KICKOFF.md:108 exactly.
  - Result: PASS.
- Arc facts reconstructed from the archive:
  - The testnet relays are rpc.testnet, drpc and blockdaemon. Mainnet adds QuickNode (node-requirements.md:83–84), so ADR-002:16 and :40 are correct.
  - The QuickNode testnet URL is at rpc-endpoints.md:54.
  - "Fetches and verifies blocks" is at :66, the 68 GB / 16 GB snapshot sizes at :50–51, IPC mode at :102 and `--public-api` at :120.
  - Custody "identical to Ethereum" and `m/44'/60'/0'/0/x` are at custody.md:43–44 and :171–172.
  - Reth is at llms.txt:23 and :25. withdrawals.md has 5 viem hits and 1 ethers hit.
  - Result: PASS.
- MC-43 Directive 9: I re-extracted the archived PDF myself, decoding streams by declared /Length, and did not use the agent's .extracted.txt.
  - ¶2.1.9 is verbatim in the page-3 content stream: "'qualifying transfer' means a transaction in a business relationship involving a crypto asset which is any value above zero."
  - ¶4.5 ("single transaction of less than R5 000 … at a minimum"), ¶4.6 (the suspicion exception, verbatim), ¶4.7, ¶4.8 ("may not execute … if it cannot comply with … 4.1 to 4.7"), ¶6.2 (verification of the beneficiary's identity), ¶6.4 ("reasonable measures … to identify cross-border crypto asset transfers that lack the required information"), ¶6.5.1 ("execute, suspend execution or return a cross-border crypto asset transfer"), ¶7.2, ¶7.3, ¶8.2 and ¶9.1 all match ADR-004:6–13 with their qualifiers.
  - Gazette No. 51556, Notice 5543 and 15 November 2024 were found in the PDF.
  - Result: PASS.
- MC-03 arithmetic (exact integers, plus a hand check):
  - ADR-006:13: 21,000 × 20·10⁹ = 4.2·10¹⁴ wei. 4.2·10¹⁴ / 10¹⁸ = 0.00042 USDC (Fraction 21/50000). divmod by 10¹² = (420, 0).
  - CONTRACT §6.1 at p=6: all 9 rows reproduce: 0→(0,0); 1→(0,1); k−1; k→(1,0); 10¹⁸→(10⁶,0); 1.0000005 USDC→(10⁶, 5·10¹¹); 7,374,356·10⁹→(7,374, 356·10⁹); (2⁶³−1)k+k−1→(2⁶³−1, k−1). At w+1 the result exceeds the signed-64 maximum.
  - CONTRACT §6.1 at p=2: all 4 rows reproduce.
  - Wei→units: 1,234,567,890,123,456,789 → (1,234,567, 890,123,456,789).
  - Odd dust: 123,456,789,012,345,678,901 → p=6 (123,456,789, 12,345,678,901); p=2 (12,345, 6,789,012,345,678,901).
  - Max uint256 mod 10¹² = 913,129,639,935.
  - Signed-64 capacity: 9.22 / 9.22·10¹² / 9.22·10¹⁶ USDC.
  - Result: PASS.
- Count and topics: 7 target files, one-to-one with KICKOFF.md:106–112. ADR-008 is extra and out of scope. Result: PASS.
- Do not decide:
  - "**Status: PROPOSED. A human decides at G1.**" appears exactly once in each of the 7 files.
  - Decision-word scan: the 4 hits are "whichever option is chosen" (×3) and "until the language is chosen". None records a decision.
  - Result: PASS.
- Options, trade-offs and recommendation per phase (RUBRIC ADR rules):
  - Option counts are 3, 3, 3, 3, 3, 4, 4.
  - ADR-001 to ADR-006 each have a 3-row phase table (Testnet, Mainnet pilot, GA). ADR-007:29 says "the same in all phases".
  - ADR-004's pilot row is an N5 deferral that names Q-R3, Q-R9 and Q-D5, with a binding rule at :29.
  - ADR-003's prose (:23) and table (:28–30) agree on C/C/C, with re-assessment of A on the same condition.
  - Result: [inspection-only] PASS.
- MC-45 against THREAT_MODEL and RISK_REGISTER:
  - The shape allow-list (ADR-001:9) is set-equal to T-E5.
  - RR-3 3a/3b (ADR-001:14–15) equals RISK_REGISTER:35–36.
  - Small hot balance matches T-E3. RB-1 sweeping is consistent with ADR-006:36. L-3 is ADR-002 rule 2. T-I1 is ADR-002 rule 5. DR-17 matches the ADR-005:32 canary.
  - Result: FAIL (D1). THREAT_MODEL T-T1 assigns the signer's replay rule to "(ADR-001, U9)", and ADR-001 omits it.
- MC-45 fail-closed for each dependency:
  - screening: ADR-005:25–27;
  - travel rule: ADR-004:29;
  - nodes: ADR-002 rules 1 and 6;
  - custodian or HSM down: no signature, so it fails safe (RUBRIC:140 reading).
  - Result: [inspection-only] PASS.
- CLAUDE.md N1/N2 scans:
  - Testnet chain ID: 2 mentions (ADR-001:6, :10). Mainnet chain ID: 0. Mainnet hostnames: 0. 64-hex strings: 0.
  - The ADR-001:45 testnet signer uses a throwaway key generated in-service plus MockSigner.
  - gitleaks, semgrep, trivy and osv-scanner are not on PATH, so no scanner ran.
  - Result: [inspection-only] PASS.
- N4 / JL-2: ADR-005 vendor scores never yield CLEAR. The threshold is human-owned with default none (Q-D6). Result: [inspection-only] PASS.
- KICKOFF §6/§9: FIPS 140-3 Level 3, a segmented signer VM with no inbound internet, Proxmox, rows on residency and the PIA, G-M 2/5/8. Result: [inspection-only] PASS.
- JL-1, JL-3, JL-5, JL-6:
  - ADR-003 C adds no new cluster.
  - ADR-003:8 states the custodian-nonce case explicitly.
  - ADR-002 rule 2 and the ADR-006:32 random memo cover privacy.
  - Result: [inspection-only] PASS.
- Regression check: LEDGER lists 0 frozen units. Substitutes, chosen as farthest from the ADR-003/006 edits:
  - (1) ADR-002, byte-identical since 00:23. All 7 quotes were re-found in today's live node-requirements page. The relay and QuickNode facts were re-derived from the archive at :78–84 and rpc-endpoints:54. Result: PASS.
  - (2) ADR-007, byte-identical. Both citations (withdrawals.md viem/ethers, llms.txt Reth) were re-derived. The C-10/C-57/C-62..67 ranges exist. Result: PASS.

CANDIDATES (Lens A, run for completeness):
- C-1 · Missing replay rule in ADR-001.
  - Evidence:
    - ADR-001:7 "the signing boundary must enforce three things itself:" lists only (1) approval verification, (2) shape allow-list and (3) limits (:8–10).
    - ADR-001:46 pilot: "otherwise **B** if Q-D1 (a)–(c) are all yes".
    - ADR-001:50 Q-D1 (a)–(c) covers the assertion check, shape and signing log, with no single-use requirement.
    - THREAT_MODEL T-T1 (pre-edit :48, post-edit :58): "against credentials it holds itself (ADR-001, U9). **Replay rule:** the signer keeps a consumed-approval set, so a `payloadDigest` is signed at most once, except for a same-nonce replacement or cancel of the same instruction (CF-5(g))".
    - CONTRACT §1.3 (:87): "Nonce and fees are left out on purpose".
    - RUBRIC MC-24 now requires "A replayed genuine approval at a different nonce → refused".
  - Criteria: MC-45 (the ADR agrees with THREAT_MODEL on the controls it owns), MC-44.
  - Verdict: REAL.
  - Reason:
    - The digest excludes the nonce, so one genuine approval verifies at every nonce. The consumed-approval set is the only preventive control against signing it twice.
    - THREAT_MODEL names ADR-001 as the owner, but ADR-001 omits the control from its enumerated signing-boundary duties. It also leaves the control out of the custodian qualification test (Q-D1), even though a custodian policy engine would have to hold that state.
    - So a G1 reader following the pilot row can accept a custodian with no replay protection.
    - CF-5(g) routes the rule to CONTRACT only. It does not cover ADR-001's list or Q-D1, so this is an ADR defect, not a routed CF item.
    - The T-T1 text was present before the R5 run (THREAT_MODEL mtime 10:50 local), and R5 reported MC-45 PASS on T-T1, so R5 missed this.
- C-2 · ADR-006:26 versus ADR-001:31.
  - Evidence:
    - ADR-006:26 "| Signer load (ADR-001) | Moderate | High: many keys or derivations (cheap only if the HSM derives BIP-32 keys internally, Q-D3) |".
    - ADR-001:31 "| Many deposit addresses (ADR-006) | Cheap if the HSM supports HD derivation (Q-D3) | Depends on per-address fees and limits (Q-D2) | — |".
  - Criteria: MC-44 (the reference must say what the citing text claims), MC-45.
  - Verdict: REAL.
  - Reason:
    - "Only if" asserts that the cost is not cheap without bank-HSM derivation. The cited ADR-001 says that under custodian option B it "Depends on per-address fees and limits (Q-D2)".
    - The parenthetical was introduced by this fix block to satisfy the Q-D3 reverse trace, and it overstates the cited source.
    - Impact is low: it biases the deposit-model trade-off against B under custodian custody, and weakens no control.
- C-3 · ADR-003:8 "with option A (HSM self-custody) it is the adapter; with option B (custodian) it is the adapter only if …". This omits ADR-001 option C ("Split by wallet", ADR-001:26).
  - Criterion: MC-45.
  - Verdict: DISMISSED.
  - Reason: ADR-003:8 scopes the rule "per hot wallet" (the same as CLAUDE.md). Under C the hot wallet is on the bank HSM (ADR-001:21, "HSM for a small hot wallet"), so C reduces to the A case for every wallet the adapter writes nonces for.
- C-4 · ADR-003:8 "under a custodian-owned nonce, the per-wallet lock guards submission order rather than nonce assignment". The F4 same-nonce replacement path (CONTRACT T5 conditions) needs the adapter to control the nonce.
  - Criteria: MC-45, JL-1.
  - Verdict: DISMISSED.
  - Reason: ADR-003 explicitly says its options "assume the adapter is the writer". ADR-001:12 makes custodian ownership exclusive ("nothing else may sign for that wallet"), and the question stays open as Q-D7, which is attributed to both ADRs. The ADR claims no working F4 under custodian nonces, so this is a recorded open dependency, not a contradiction.
- C-5 · ADR-004:26 '| Fit with "block send without complete data" |' versus KICKOFF.md:204 "block outbound sends without complete data".
  - Criteria: MC-21, the ADR paraphrase rule.
  - Verdict: DISMISSED.
  - Reason: the string is not an Arc fact (MC-21) or a regulatory statement (MC-43 and the paraphrase rule). It labels KICKOFF's control column in a table that concerns outbound sending only. Advisory: quote it verbatim or drop the quotation marks.
- C-6 · LEDGER.md:28 still reads "**Fix 1** · R5 pending" for P1-adrs, although R5 has reported NEGATIVE and fix block 2 is applied.
  - Criterion: KICKOFF §4 ledger.
  - Verdict: DISMISSED for this unit.
  - Reason: this is LEDGER bookkeeping, not ADR content. Advisory: update the row together with this verdict.

Probe G (would the rubric pass a bad version?): YES.
- How C-1 got through: MC-45 says "each ADR agrees with THREAT_MODEL and RISK_REGISTER on the controls it owns". In practice it gets run forward, from the ADR's own list of controls. A control that THREAT_MODEL adds later, with an owner tag naming an ADR, passes unless the verifier also traces backwards from every "(ADR-00x)" owner cell. That is how R5 passed C-1.
- Proposed wording for the human: "For every THREAT_MODEL / RISK_REGISTER control whose owner cell names an ADR, that ADR states the control; and every vendor-qualification question an ADR uses as a phase condition (e.g. Q-D1) covers every signer-side control in that ADR."
- The R5 Probe G (ADR↔ADR consistency) is still not in the rubric text (MC-45 is unchanged), and C-2 is an instance of it.

Probe F (would the rubric fail a good version?): YES, on a literal reading of the per-phase requirement (RUBRIC.md:92), "states its recommendation per phase (testnet, mainnet pilot, general availability)".
- ADR-007 has no phase rows. It says, with a reason, that "The stack is the same in all phases". That is the correct recommendation, because changing language would invalidate the testnet evidence, but a checker counting phase rows fails it.
- Suggested reading: "a single recommendation explicitly stated to apply to all three phases, with the reason, satisfies the per-phase requirement".
- On this artefact it passes only by that reading.

DEFECTS:
- D1 · docs/adr/ADR-001-custody-signing.md:7–10, :46, :50. The signer replay rule (consumed-approval set, single use of a `payloadDigest` except for a same-nonce replacement or cancel) is missing from the signing-boundary duties and from the Q-D1 custodian qualification. THREAT_MODEL T-T1 names ADR-001 as owner, and CONTRACT §1.3 excludes the nonce from the digest.
  - Lens and criteria: R / MC-45, MC-44.
  - Severity: minor.
  - Why minor: no money moves before Phase 3. The (code) check MC-24 now tests replay refusal on whichever signer is built, so the gap cannot reach the money path undetected. It can mislead only the G1 custody decision.
- D2 · docs/adr/ADR-006-deposit-address-model.md:26. "cheap only if the HSM derives BIP-32 keys internally" contradicts ADR-001:31, where option B "Depends on per-address fees and limits (Q-D2)".
  - Lens and criteria: R / MC-44, MC-45.
  - Severity: minor.

R5 D1 is confirmed fixed by reconstruction. No blocking defect.

VERDICT: NEGATIVE (2 defects: 0 blocking, 2 minor)

Phase 1 · units frozen 0/10 · streak 0/3 · rounds used 6/10 (P1-adrs) · regen budget left 1
