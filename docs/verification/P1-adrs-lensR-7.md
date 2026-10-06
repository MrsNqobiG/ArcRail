VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 7, after reframe fix block 3 · commit: none (uncommitted working tree)

ADR SHA-256 prefixes 001…007, hashed at start (09:26 UTC) and end (09:35 UTC) of this run, stable:
8df3c752d4d01298, a17ab99739fcae16, 9f73f03bebac8f5e, 43554bbf083caec3, 08cdf2fb0dc482fa, 9a91b242428b25cc, 05c75efbf80b87d2.
Against R6, only ADR-001 and ADR-006 changed (the other five are byte-identical to the R6 hashes).

Concurrency notice: ADR-008 (11:33 local), CONTRACT.md (11:34), RISK_REGISTER.md (11:34), OPEN_QUESTIONS.md (11:33) and LEDGER.md (11:34) changed during this run. CONTRACT lines shifted by about +10 (for example the §5.0 signing-log sentence moved from :204 to :210, the §5.6 PROPOSED row from :376 to :386). Every finding below was re-checked against both the pre-edit and the post-edit text and holds for both. Line numbers below are post-edit.

Criteria: KICKOFF §1, §5 P1.4, §6, §9; CLAUDE.md; RUBRIC.md (MC-03, MC-21, MC-43, MC-44, MC-45, ADR rules, JL-1…JL-6); constants.md; THREAT_MODEL.md; RISK_REGISTER.md; CONTRACT.md; OPEN_QUESTIONS.md; docs/sources/; ADR-008 where 001…007 must agree with it.

CHECKS:
- R6 D1 (replay rule): ADR-001:11 adds duty 4 "a consumed-approval record, durable and shared across signer instances … at most once, except for a same-nonce replacement or cancel of the same instruction". It matches THREAT_MODEL T-T1 (:58), RUBRIC MC-24 (durable and shared) and CF-5(g). The stated reason ("payloadDigest deliberately excludes nonce and fees") re-traces to CONTRACT:87 "Nonce and fees are left out on purpose". Q-D1 (e) at ADR-001:51 and the pilot row ADR-001:47 "Q-D1 (a)–(e)". → PASS
- R6 D2 (ADR-006 vs ADR-001 on signer load): ADR-006:26 now reads "with an HSM, on BIP-32 derivation inside it (Q-D3); with a custodian, on per-address fees and limits (Q-D2)", which is set-equal to ADR-001:32. → PASS
- Q-D reverse trace (all 8 Q-D rows, post-edit OPEN_QUESTIONS:84–91): D1→ADR-001 (+ADR-008), D2→001, D3→001+006, D4→003, D5→004, D6→005, D7→001+003, D8→ADR-008 (out of scope). Each named ADR mentions its Q-id. OPEN_QUESTIONS Q-D1 (a)–(e) is the same wording as ADR-001:51. → PASS
- MC-44 forward resolution (script over all 7 ADRs): 57 distinct IDs (15 C-, 25 Q-, 7 T-, 5 L-, 5 DR-, RB-1/7, RR-3, CF-1/5, MC-17/24). 0 unresolved. Spot content checks: C-30 floor 20 gwei, C-35 ≈21,000 gas, C-56 custody chain-ID/HD path, C-62 Memo address, C-68 relays. → PASS, except D2 (description of Q-D1 at ADR-001:41)
- MC-21 re-fetch (2026-10-03 09:31 UTC, HTTP 200 each): node-requirements, rpc-endpoints, integrate/exchanges/custody, transaction-memos, deposits, compliance-vendors, withdrawals, contract-addresses, gas-and-fees, run-an-arc-node, and llms.txt. All 11 are byte-identical to docs/sources/arc/. MANIFEST: recomputed 38/38 SHA-256 rows, 0 mismatches. → PASS
- MC-21 quotes: I extracted every double-quoted string (≥6 chars) from the 7 ADRs and searched for it, normalised, in docs/sources/ text files plus KICKOFF and CLAUDE.md. Results:
  - Everything resolves except 4 strings.
  - "Blocked address" (ADR-007:8) is the C-57 observed string, which is not in the docs by definition.
  - "block send without complete data" (ADR-004:26) is a KICKOFF control label, not an Arc or regulatory fact (R6 C-5, unchanged).
  - The two Directive 9 strings are covered under MC-43 below.
  - Spot checks: "No Arc-specific MPC protocol modifications are needed" is at custody.md:184; the Memo EOA sentence is at transaction-memos.md:85; "offering analytics, wallet screening, and monitoring tools" is at compliance-vendors.md:18.
  → PASS
- MC-43 Directive 9 (ADR-004 is byte-identical to R6): I decoded the archived PDF's Flate streams myself (stdlib) and re-found:
  - ¶4.5 ("single transaction of less than R5 000 … at a minimum");
  - ¶4.6 verbatim ("unless there is a suspicion of money laundering or terrorist financing, in which case, the ordering crypto asset service provider must verify the information pertaining to the originator"), where ADR-004's "[it]" is a faithful substitution;
  - ¶4.8 ("may not execute a crypto asset transfer if it cannot comply with the requirements referred to in paragraphs 4.1 to 4.[7]");
  - ¶7.2 ("prior to, or simultaneously with the transfer");
  - ¶7.3 ("post facto transmission … is not permitted");
  - ¶9.1 ("comes into operation 30 April 2025").
  The ¶2.1.9 definition ("any value above zero") was NOT recovered by my decoder: the definitions page tail is in a stream it couldn't map. It is present in the agent-produced Directive-9.extracted.txt:28, and R6 recovered it independently from the PDF. → [inspection-only] PASS for ¶2.1.9; PASS for the rest
- MC-03 arithmetic (exact integers, Python):
  - ADR-006:13: 21,000 × 20·10⁹ = 420,000,000,000,000 wei. That is 21/50000 USDC = 0.00042, and divmod by 10¹² gives (420, 0).
  - CONTRACT §6.1, p=6, all 9 rows reproduce: 0→(0,0); 1→(0,1); k−1→(0,k−1); k→(1,0); 10¹⁸→(10⁶,0); 1.0000005 USDC→(10⁶, 5·10¹¹); 420·10¹²→(420,0); 7,374,356·10⁹→(7,374, 356·10⁹); (2⁶³−1)k+k−1→(2⁶³−1, k−1).
  - CONTRACT §6.1, p=2, all 4 rows reproduce.
  - Wei→units: 1,234,567,890,123,456,789 → (1,234,567, 890,123,456,789).
  - Odd dust: 123,456,789,012,345,678,901 → p=6 (123,456,789, 12,345,678,901); p=2 (12,345, 6,789,012,345,678,901).
  - Max uint256 at p=6 → remainder 913,129,639,935, and m overflows signed 64-bit (guarded by CONTRACT §6 PAUSE).
  - Signed-64 capacity is 9.22 / 9.22·10¹² / 9.22·10¹⁶ USDC.
  → PASS
- Count and topics: 7 target files, one-to-one with KICKOFF.md:106–112. → PASS
- Do not decide: "Status: PROPOSED. A human decides at G1." appears exactly once in each of the 7 files. The single decision-word hit is ADR-001:9 "until Q-P1/ADR-006 is decided", which is not a decision. → PASS
- Options, trade-offs and per-phase recommendation: option counts are 3, 3, 3, 3, 3, 4, 4. ADR-001…006 each have 3 phase rows. ADR-007:29 says "the same in all phases" with a reason (RUBRIC ADR rule, R6 Probe F relaxation). → [inspection-only] PASS, except D2 (ADR-001 prose vs table)
- MC-45 backward trace from every THREAT_MODEL, RISK_REGISTER, CONTRACT and SEQUENCES cell naming ADR-001…007 (script; 22 hits):
  - THREAT_MODEL:50 (ADR-002, Q-A12) → ADR-002:14
  - :58 T-T1 (ADR-001, U9, incl. replay) → ADR-001:8, :11
  - :76 (ADR-002 rule 5) → ADR-002:33
  - :85 (sweep, ADR-006) → ADR-006:34–36
  - :92 T-E2 (ADR-001, U9) → ADR-001:8–10
  - :93 T-E3 → ADR-001 options
  - :95 T-E5 (Q-P1/ADR-006) → ADR-001:9
  - :106 T-B1 (ADR-005 C) → ADR-005:23
  - :125 L-1 → ADR-006:22
  - :127 L-3 (ADR-002 B) → ADR-002 rule 2
  - RISK_REGISTER:79 → ADR-006:34
  - CONTRACT:210 → ADR-001:12
  - CONTRACT:363 → ADR-003:8
  - SEQUENCES:9/10/24 → ADR-002/004
  - Owner cells all PASS. Detection cells THREAT_MODEL:107/:157 → see C-5.
  → PASS on owner cells
- MC-45 against ADR-008 (ADR-to-ADR agreement): → FAIL (D1, D4). Agreeing parts:
  - ADR-008:96 pilot block "Q-D1 (c) … and (d)" is consistent with ADR-001:47 "(a)–(e)";
  - ADR-008:62 RD-03/DR-12 inputs are consistent with ADR-002 rule 2 (own nodes only);
  - ADR-008:89 privacy is consistent with ADR-006/L-2.
- MC-45 against CONTRACT/SEQUENCES signing rows: → FAIL (D3)
- MC-45 fail-closed per dependency: screening ADR-005:25–27; travel rule ADR-004:29; nodes ADR-002 rules 1 and 6; custodian or HSM down means no signature. → [inspection-only] PASS
- CLAUDE.md N1/N2 scans (script, mainnet ID assembled at run time): testnet chain ID 2 hits (ADR-001 only); mainnet chain ID 0; mainnet hostnames 0; 64-hex strings 0; key-material words 0. gitleaks, semgrep, trivy and osv-scanner are not on PATH, so no scanner ran. → [inspection-only] PASS
- N4 / JL-2: ADR-005 vendor scores never yield CLEAR, and the threshold is human-owned (Q-D6, default none). → [inspection-only] PASS
- KICKOFF §6/§9: FIPS 140-3 L3, segmented signer VM with no inbound internet, Proxmox, PIA rows, G-M 2/5/8. → [inspection-only] PASS
- JL-1, JL-3, JL-5, JL-6: ADR-003 C adds no new cluster; the random memo is at ADR-006:32; address reads go only to own nodes. → [inspection-only] PASS
- Regression check (LEDGER lists 0 frozen units). Substitutes chosen as farthest from the ADR-001/006 edits, both byte-identical since 00:23:
  - (1) ADR-005: C-53/C-55 re-derived (contract-addresses.md:369 blocklisted test address; "blocklisted address reverts" at evm-differences.md:127, deposits.md:296); C-63 Multicall3From at contract-addresses.md:282/289; C-27 "tx.from is the relayer's address" at deposits.md:290; vendor quote at compliance-vendors.md:18; fail-closed paths re-traced. → PASS
  - (2) ADR-007: withdrawals.md has 5 viem and 1 ethers hits; Reth at llms.txt:23 and :25; the C-10…C-68 range exists. → PASS

CANDIDATES (Lens A, run for completeness):
- C-1 · ADR-001 not aligned with its own Q-D1 (c)/(d) or with ADR-008 on the signing log and attestation. Evidence:
  - ADR-001:12 "The signing boundary itself must write an append-only log of `(payloadHash, nonce, txHash)` for every signature, readable by U12 directly, not through the orchestrator. … With B, the custodian must provide an equivalent log keyed by our `payloadHash` (Q-D1(c))."
  - ADR-001:28 "| Independent signing log | Built in our policy engine | Custodian-provided, keyed by our `payloadHash` (Q-D1(c)) |".
  - Versus ADR-001:51, Q-D1 (c): "`(payloadHash, nonce, txHash, instructionId)` **pushed to the independent monitor** (ADR-008)", and (d) "require the monitor's fresh `ALL_CLEAR` attestation".
  - ADR-001:7 "must enforce four things itself" lists no attestation check.
  - ADR-008:24 "Signing log `(payloadHash, nonce, txHash, instructionId)` | Reference | Pushed by the signer"; ADR-008:101 "That changes ADR-001's 'readable by U12 directly' into a push, and adds `instructionId` (CF-9)".
  - THREAT_MODEL DR-01 (:140) classifies entries by `instructionId`.
  - Criteria: MC-45 (ADRs touching the same control agree), MC-44.
  - Verdict: REAL.
  - Reason: inside ADR-001 the qualification test (Q-D1 (c)) demands a pushed 4-tuple, while the option A build description (:12, :28) specifies a pulled 3-tuple. Option A built as written cannot feed DR-01, which needs `instructionId`. CF-9(b) routes this change to "CONTRACT §5.0, ADR-001", so the ADR-001 half belongs to this unit, not another one. Fix 3 applied it to Q-D1 only.
- C-2 · ADR-001 prose vs phase table. Evidence:
  - ADR-001:41 "If it doesn't, **B**, provided Q-D1 (custodian-side verification of `payloadHash` and approval) is answered yes."
  - ADR-001:47 "otherwise **B** if Q-D1 (a)–(e) are all yes. **If neither holds, the pilot is blocked**".
  - Criteria: RUBRIC ADR rule (ADR R4 Probe G: prose and phase table must agree), MC-44.
  - Verdict: REAL.
  - Reason: the prose describes Q-D1 as approval verification only. After Fix 3, Q-D1 has five parts (shape, log, attestation, replay), and the prose omits the "blocked" outcome. A G1 reader of the prose can accept a custodian lacking (b)–(e). This is the same class as R6 D1, and Fix 3 updated the table but not the prose.
- C-3 · Approval-verification duty is unscoped against signing rows that carry no approval. Evidence:
  - ADR-001:7–8 "Whichever option is chosen, the signing boundary must enforce four things itself: 1. **Approval verification:** recompute `payloadHash` … and verify the checker's FIDO2 `checkerAssertion`".
  - CONTRACT:386 (§5.6) "| PROPOSED | policy ALLOW (or approved above threshold) | sign (signing log) and …".
  - SEQUENCES:164–167 "Pol-->>Gas: ALLOW (or REQUIRE_APPROVAL above threshold) … Gas->>Ops: approval if required … Orc->>Sig: sign".
  - RISK_REGISTER:37, 3a: "fabricates an instruction (or labels a payout as an internal move) and gets it signed".
  - CONTRACT §1.3:87 payloadDigest binds `instructionId`, but moves carry a `moveId` (CONTRACT:71).
  - Criteria: MC-45 (cross-document consistency), JL-1.
  - Verdict: REAL.
  - Reason: internal moves and gas top-ups below the threshold are signed with no checker assertion and no payloadHash. ADR-001 either forbids them (literal reading: S3 can't run) or leaves the exemption unspecified. ADR-001 doesn't say which rule the signing boundary applies to approval-exempt signatures (for example `to` on Treasury's bank-owned list held by the signer, DR-24, plus move limits). Q-D1 doesn't ask whether a custodian can enforce such a class rule. That rule is what decides whether the RR-3 3a "label a payout as a move" attack is prevented at the signer or only detected afterwards by DR-01.
  - Related note for P1-contract, not an ADR defect: §5.6 has no "signer refuses" row, which is an MC-11 empty cell.
- C-4 · ADR-002 rule 3 vs the monitor's trust domain. Evidence:
  - ADR-002:31 "Pin the arc-node version and image digest (U15). The node's RPC is reachable only from the adapter segment."
  - ADR-008:68 option B "Separate VM and network segment, identity, credentials and admins"; ADR-008:21 "Chain data … The monitor's **own fetch** from own nodes"; ADR-008:95 pilot "separate hosts".
  - THREAT_MODEL:31 B9 "The monitor reads own nodes"; THREAT_MODEL:35 "its own VM and network segment … **read-only** access to own nodes".
  - Criteria: MC-45 (ADR agrees with THREAT_MODEL on a control it owns; ADR-to-ADR agreement).
  - Verdict: REAL.
  - Reason: under ADR-002 as written, the monitor's segment cannot reach own nodes. The implementer must either break rule 3 or route the monitor's chain reference through the adapter segment. The second contradicts ADR-008's "own fetch" reference model (MC-40(b)). ADR-008:3 declares itself ahead of THREAT_MODEL B9 only, not of ADR-002, and ADR-002 owns the node-access rule.
- C-5 · ADR-004 is silent on counterparty acknowledgement. Evidence:
  - THREAT_MODEL:107 T-B2 "[X] Counterparty acknowledgement where ADR-004 provides one … the travel-rule system's own audit log ([X], contingent on ADR-004)"; :157 DR-18 "caught only by [X] counterparty acknowledgement … where ADR-004 provides one".
  - ADR-004:20–26 has no row on digest echo or acknowledgement.
  - Criterion: MC-45.
  - Verdict: DISMISSED.
  - Reason: MC-45's backward trace is defined over owner cells. These are detection cells, explicitly conditional ("where … provides one"), and the unhosted case is recorded as a residual. Silence doesn't contradict. Advisory: add a "counterparty acknowledgement (digest echo)" row to the ADR-004 options table, so the G1 chooser can see which options give T-B2 its [X] anchor.
- C-6 · ADR-006 outbound Memo has no per-phase line. Evidence:
  - ADR-006:32 "the Memo contract *may* be used … That is a separate decision".
  - THREAT_MODEL:95 "No Memo shape until Q-P1/ADR-006 is decided".
  - The phase table at ADR-006:39–43 is silent.
  - Criteria: RUBRIC ADR per-phase rule, MC-45.
  - Verdict: DISMISSED.
  - Reason: the default is fixed fail-closed in three places (ADR-001:9, MC-23, T-E5: no Memo shape unless later allowed), and Q-P1 (a) (OPEN, owner Operator) is the named vehicle. Accepting ADR-006 does not enable Memo. Advisory: add "outbound Memo: not enabled; decided via Q-P1 (a)" to the phase table.
- C-7 · ADR-001:15 "3b … DR-12 and DR-13, which match every outflow to an instruction or move and a signing-log entry". DR-12 (THREAT_MODEL:151) is a nonce comparison, not a match.
  - Criterion: MC-44.
  - Verdict: DISMISSED.
  - Reason: the clause describes the pair's joint effect, and RISK_REGISTER 3b maps exactly these two. DR-12's "nonce used by an unknown hash" is itself an outflow without a signing-log entry.
- C-8 · ADR-006:26 now cites Q-D2, but OPEN_QUESTIONS:85 Q-D2's ADR column lists only "ADR-001".
  - Criterion: MC-45 (Q-D mirror).
  - Verdict: DISMISSED for this unit.
  - Reason: MC-45 requires the Q-D column to be mirrored in the ADR, and that direction holds. The missing back-reference is OPEN_QUESTIONS bookkeeping (P0 unit). Advisory: add ADR-006 to Q-D2's column.

Probe G (would the rubric pass a bad version?): YES.
- C-3 survived six rounds because MC-45 traces ADRs against THREAT_MODEL, RISK_REGISTER and other ADRs, and THREAT_MODEL T-E2 uses the same unscoped "approval verification". Nothing type-checks an ADR's signing-boundary rules against the CONTRACT rows that actually request signatures.
- A bad ADR-001 that silently exempts internal moves from every check except limits passes every MC item.
- Proposed wording: "Every signing-boundary rule an ADR states is checked against every CONTRACT §5 row that requests a signature (payout, case return, internal move, same-nonce cancel or replacement). Each such signature is accepted by a stated rule or refused with that row's specified next state, and every vendor-qualification question used as a phase condition covers each class rule."

Probe F (would the rubric fail a good version?): YES.
- MC-43 says "Re-fetch and diff" for regulatory quotes, but a correct quote from a PDF whose text a verifier's tooling cannot decode (Directive 9 ¶2.1.9 this round; POPIA, Q-T8) cannot be diffed. A literal checker either fails a correct ADR-004 or silently downgrades the check.
- Suggested reading: "where the primary PDF is not machine-extractable with the available tooling, a hashed archived extraction plus the rendered-page pinpoint is acceptable, labelled [inspection-only], with the tooling gap tracked (Q-T8)".
- On this artefact ADR-004 passes only by that reading.

DEFECTS:
- D1 · docs/adr/ADR-001-custody-signing.md:7, :12, :28. The signing-log description (pulled 3-tuple "readable by U12") and the four-duty list (no attestation check) contradict the same ADR's Q-D1 (c)/(d) at :51 and ADR-008:24/:83/:101 (pushed 4-tuple with `instructionId`; signer refuses without fresh ALL_CLEAR). CF-9(b) routes this to ADR-001 itself.
  - Lens and criteria: R / MC-45, MC-44.
  - Severity: minor.
- D2 · docs/adr/ADR-001-custody-signing.md:41. The recommendation prose describes Q-D1 as "custodian-side verification of `payloadHash` and approval" and omits "pilot blocked", while the phase table at :47 requires Q-D1 (a)–(e).
  - Lens and criteria: R / RUBRIC ADR rule (prose agrees with the phase table), MC-44.
  - Severity: minor.
- D3 · docs/adr/ADR-001-custody-signing.md:7–8 and :51. Approval verification is stated for every signature with no scope. CONTRACT §5.6:386, SEQUENCES S3:164–167 and RISK_REGISTER 3a (:37) require the signer to sign internal moves and gas top-ups below the threshold with no checker approval. ADR-001 states no rule for approval-exempt signatures, and Q-D1 doesn't qualify a custodian for one.
  - Lens and criteria: R / MC-45, JL-1.
  - Severity: minor.
- D4 · docs/adr/ADR-002-chain-access.md:31 (rule 3). "The node's RPC is reachable only from the adapter segment" conflicts with THREAT_MODEL B9 (:31, :35) and ADR-008:21/:68, where the independent monitor in its own segment reads own nodes directly.
  - Lens and criteria: R / MC-45.
  - Severity: minor.

Severity rationale: no money moves before Phase 3, and each conflict fails closed if implemented literally (signer refuses, or monitor issues no ALL_CLEAR). Each can still mislead the G1 custody, chain-access or monitor decision.

R6 D1 and D2 are confirmed fixed by reconstruction. No blocking defect.

VERDICT: NEGATIVE (4 defects: 0 blocking, 4 minor)

Phase 1 · units frozen 0/10 · streak 0/3 · rounds used 7/10 (P1-adrs) · regen budget left 1
