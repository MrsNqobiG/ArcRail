VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 5 after reframe fix block 1 · commit: none (uncommitted working tree; `git rev-parse HEAD` → "unknown revision"). ADR SHA-256 prefixes 001…007: d3445e3f9287a380, a17ab99739fcae16, b36c9e12b0a12ed7, 43554bbf083caec3, 08cdf2fb0dc482fa, 38418cd07fc49ad1, 05c75efbf80b87d2. Compared with R4, only ADR-001 and ADR-004 changed. The other five are byte-identical to the R4 hashes. Run 2026-10-03, about 08:50–09:05 UTC.

Criteria: KICKOFF_PROMPT.md §1, §5 P1.4, §6, §9; CLAUDE.md; docs/RUBRIC.md (MC-03, MC-21, MC-43, MC-44, MC-45, ADR rules at RUBRIC.md:90-92, JL-1…JL-6); constants.md; THREAT_MODEL.md v2; RISK_REGISTER.md v3 + fix 1; CONTRACT.md; OPEN_QUESTIONS.md; docs/sources/ (incl. fic/ PDF).
Re-fetch (2026-10-03, curl, all HTTP 200, content treated as data):
- docs.arc.io node-requirements, rpc-endpoints, custody, transaction-memos, deposits, compliance-vendors, withdrawals, contract-addresses, opt-in-privacy (.md) and /llms.txt: 10/10 byte-identical to the archive.
- evm-differences is byte-identical to the `.REFETCH-later` copy (Q-A14, as expected).
- MANIFEST SHA-256 rows recomputed: 38 files, 0 mismatches.
- FIC Directive 9 PDF re-fetched from the MANIFEST:42 URL: SHA-256 6494e47d…, identical to the archive.
- I extracted the PDF text independently (my own zlib/TJ extractor, not the agent's .extracted.txt).

CHECKS:
- R4 D1 (ADR-004 qualifiers), checked against my own PDF extraction:
  - ADR-004:7 ¶2.1.9 "a transaction in a business relationship involving a crypto asset which is any value above zero" matches. The PDF has a kerning split "tran saction", which is why the plain string search missed it.
  - ADR-004:8 ¶4.5 "single transaction of less than R5 000 … at a minimum" matches. The ¶4.6 suspicion exception is now quoted and matches the PDF ("unless there is a suspicion of money laundering or terrorist financing, in which case, the ordering crypto asset service provider must verify the information pertaining to the originator").
  - ADR-004:13 ¶6.2 (verification of the beneficiary's identity) matches. ¶6.4 "cross - border crypto asset transfers that lack the required information" matches. ¶6.5.1 "execute, suspend execution or return a cross -border crypto asset transfer" matches.
  - Result → PASS
- R4 D2 (ADR-001 RR-3 claim):
  - ADR-001:13 now credits "small hot balance" to T-E3. THREAT_MODEL.md:83 has "small hot balance" → resolves.
  - ADR-001:14-15: 3b → DR-12, DR-13 (RISK_REGISTER.md:36). 3a → DR-01, which "can't run until … CF-5(f)" (RB-7) (RISK_REGISTER.md:35, :81).
  - Result → PASS
- R4 D3 (payloadDigest):
  - ADR-001:8 "WebAuthn challenge is the 32 raw bytes of `payloadDigest` … not the hex `payloadHash`" equals CONTRACT.md:78, THREAT_MODEL.md:48 and MC-24.
  - ADR-001:50 Q-D1 (a)–(c) is semantically equal to OPEN_QUESTIONS.md:82 (a)–(c).
  - Result → PASS
- Count and topics: 7 files, 001–007, one-to-one with KICKOFF.md:106-112 → PASS
- Do not decide: "Status: PROPOSED. A human decides at G1." appears once per file (7/7). The 6 keyword hits are "undecided", "is decided" or "accepted explicitly at G-M", and none records a decision → PASS
- Options, trade-offs and per-phase recommendation (RUBRIC.md:90-92):
  - Option counts are 3,3,3,3,3,4,4.
  - Phase tables have 3 rows in ADR-001 to ADR-006. ADR-007:29 says "the same in all phases".
  - ADR-004 pilot row is an N5 deferral that names Q-R3, Q-R9 and Q-D5, with the binding rule at :29.
  - Prose and table agree per phase in all 7.
  - Result → [inspection-only] PASS
- MC-21 quotes: every double-quoted string in the 7 ADRs was searched in docs/sources/ with markdown and whitespace normalised.
  - 21 were found in the Arc/FIC archives, plus ¶2.1.9 after the kerning normalisation.
  - KICKOFF quotations: ADR-003:3, ADR-006:6, ADR-007:3 (KICKOFF.md:108, :111, :112).
  - "Blocked address" is the C-57 observed string.
  - "block send without complete data" is a table-label paraphrase of KICKOFF.md:204.
  - Result → PASS
- MC-21 live constants (also the regression substitute): C-10, C-27, C-30, C-35, C-53, C-55, C-56, C-62, C-63, C-64 quotes re-found in today's live pages, 10/10. Supporting context:
  - custody.md:166-170 "identical to Ethereum" supports ADR-001:6.
  - contract-addresses.md:282, :294-298 support ADR-005:8 (original-sender attribution).
  - node-requirements.md:49-51, :73-74, :78-85, :100-103 support ADR-002.
  - rpc-endpoints.md:54 gives the QuickNode testnet URL.
  - Result → PASS
- MC-03 arithmetic (python exact integers):
  - ADR-006:13: 21,000 × 20·10⁹ = 420,000,000,000,000 wei = 21/50000 USDC = 0.00042. divmod(·,10¹²) = (420, 0).
  - CONTRACT §6.1 at p=6: 0→(0,0); 1→(0,1); k−1→(0,k−1); k→(1,0); 10¹⁸→(1,000,000,0); 1,000,000,500,000,000,000→(1,000,000, 5·10¹¹); 7,374,356·10⁹→(7,374, 356·10⁹); (2⁶³−1)k+k−1→(9,223,372,036,854,775,807, 999,999,999,999).
  - CONTRACT §6.1 at p=2: 10¹⁸→(100,0); 1.5·10¹⁶→(1, 5·10¹⁵); 10¹⁶−1→(0, same); 7,374,356·10⁹→(0, same).
  - Odd dust: 123,456,789,012,345,678,901 → p=6 (123,456,789, 12,345,678,901), p=2 (12,345, 6,789,012,345,678,901). Round-trip m·k+d=w holds for all.
  - Max uint256 at p=6: remainder 913,129,639,935.
  - Wei→units: 1,234,567,890,123,456,789 → (1,234,567, 890,123,456,789).
  - Signed-64 capacity: p=18 ≈ 9.22, p=6 ≈ 9.22·10¹², p=2 ≈ 9.22·10¹⁶ USDC.
  - Every value matches CONTRACT §6.1 → PASS
- MC-44 forward resolution (script): every ID cited in the ADRs resolves to exactly 1 definition: 15 C-ids, 22 Q-ids, T-S2/S5/T1/E2/E3/E5/I1, L-1/3/4/5/8, DR-01/12/13/17/18, RR-3, RB-1, RB-7, CF-1, CF-5, MC-17, P6.2, U1/5/7/9/11/12/15, SEQUENCES S1/S2/S5/F1/F2/F4–F7, and CONTRACT T6/T9/G4/§1.3/§3/§4/§5.0/§6/§6.1. G-M 2/5/8 match KICKOFF §9 items 2, 5 and 8. CONTRACT.md:191 "(ADR-001 Context, "Signing log" …)" resolves to ADR-001:11 → PASS
- MC-44 reverse resolution (register → ADR):
  - Q-D1, D2, D4, D5, D6 each appear in the ADR the register names.
  - Q-D7 is attributed to "ADR-001, ADR-003" (OPEN_QUESTIONS.md:88), but ADR-003 has 0 mentions of Q-D7, custody or the signer.
  - Q-D3 is attributed to "ADR-001, ADR-006" (:84), but ADR-006 has 0 mentions of Q-D3.
  - Result → FAIL (D1)
- MC-43 Directive 9:
  - Gazette 51556 / Notice 5543 / 15 Nov 2024, ¶9.1, ¶4.7, ¶4.8, ¶7.2, ¶7.3 and ¶8.2 are all found in the PDF.
  - Citation form: archive path + date in ADR-004:3, URL via MANIFEST:42 (re-fetched, identical). Each statement is also registered as Q-R3, Q-R9 or Q-R10.
  - Result → PASS
- MC-45 cross-document checks against THREAT_MODEL, RISK_REGISTER and CONTRACT:
  - Shape allow-list in ADR-001:9 is set-equal to T-E5 (THREAT_MODEL.md:85) and MC-23.
  - Also re-traced: T-T1, T-E2, T-E3, T-S2 (ADR-002 rule 1 / DR-02), T-I1 (rule 5 vs archive :100-103), T-B1, T-B2, T-D5, L-1, L-3 (rule 2 and THREAT_MODEL.md:117 "With one own node …"), L-4 (ADR-006:32), DR-13, DR-17, DR-18 and RB-1.
  - Every other ADR mention in THREAT_MODEL, RISK_REGISTER, CONTRACT, SEQUENCES, RUBRIC, constants and port-reqs was re-traced (26 sites), and each resolves.
  - Result → PASS. Exception: ADR↔ADR consistency on the nonce writer → FAIL (D1)
- MC-45 fail-closed for each external dependency:
  - screening: ADR-005:25-27;
  - travel rule: ADR-004:29;
  - nodes: ADR-002 rules 1 and 6, plus the testnet row;
  - custodian or HSM down: no signature, so it fails safe by construction (RUBRIC.md:141 reading).
  - Result → [inspection-only] PASS
- CLAUDE.md N1/N2:
  - Integers matching 50xx… in the ADRs: {5042002: 2}. 64-hex strings: 0. Mainnet hostnames: 0.
  - ADR-001:45 testnet signer (throwaway key generated in-service, MockSigner) is consistent with N2.
  - gitleaks, semgrep, trivy and osv-scanner are not on PATH, so no scanner ran.
  - Result → [inspection-only] PASS
- N4 / JL-2: ADR-005 vendor scores can never produce CLEAR, and the threshold is human-owned, default none (Q-D6) → [inspection-only] PASS
- KICKOFF §6/§9: FIPS 140-3 L3, segmented signer VM with no inbound internet, Proxmox, residency + PIA rows, G-M 2/5/8 → [inspection-only] PASS
- JL-1, JL-3, JL-5, JL-6 → [inspection-only] PASS. ADR-003 C has no new cluster. ADR-002 rule 2 and ADR-006:32 random memo cover privacy.
- Regression check: LEDGER.md:18-31 lists 0 frozen units, so this is N/A. Substitutes, chosen as the units furthest from the fix-1 edits (ADR-001 and ADR-004), each checked by reconstruction:
  - (1) P0-constants: 10 quotes re-found live, and the archive is byte-identical → PASS;
  - (2) CONTRACT §6.1 boundary table: 20+ values recomputed → PASS.
  - ADR-002, 003, 005, 006 and 007 are byte-identical to their R4 versions, and their quotes and IDs were re-derived again above → PASS

CANDIDATES (Lens A, run for completeness):
- C-1 · Two pieces of evidence:
  - OPEN_QUESTIONS.md:88 "| Q-D7 | Under custodian custody, who assigns nonces? Can the adapter supply them? | ADR-001, ADR-003 |";
  - ADR-003:16 "Single nonce writer | … | One DB row lock per wallet, in the same transaction as the outbox" and ADR-003:22 "The nonce is held under a per-wallet row lock", stated without conditions, while ADR-001:12 says "With B the adapter must be able to supply the nonce, **or** the custodian becomes the single writer and nothing else may sign for that wallet (Q-D7)". The same class also covers OPEN_QUESTIONS.md:84 Q-D3 "ADR-001, ADR-006", with Q-D3 absent from ADR-006.
  - Criteria: MC-44, MC-45 (single-nonce-writer control, CLAUDE.md).
  - Verdict: REAL (minor).
  - Reason: ADR-003 already makes A conditional on "the nonce and outbox can stay in the adapter" (:22). It does not apply the same condition to ADR-001 option B. A G1 reader of ADR-003 gets an unconditional nonce design that ADR-001 B plus a "custodian owns nonces" answer to Q-D7 would invalidate, and the register says ADR-003 raises Q-D7 when it does not. This is fail-safe and the coupling is visible in ADR-001, so the severity is minor.
- C-2 · ADR-001:14 "3b (key theft …): DR-12 and DR-13, which match every outflow to an instruction or move and a signing-log entry" vs THREAT_MODEL.md:141 DR-12 = "`getTransactionCount` … vs the local nonce".
  - Criterion: MC-44.
  - Verdict: DISMISSED.
  - Reason: the ID mapping is exact (RISK_REGISTER.md:36). The relative clause describes DR-13's mechanism and reads as collective. The error runs in the conservative direction: it implies that DR-12 also needs the signing log, when it needs only chain state. Advisory: a gloss per ID.
- C-3 · ADR-001:11 "Signing log (… RISK_REGISTER 2c/3a/3b …)" vs RISK_REGISTER.md:29 "(DR-13 is **not** a detection for 2c, because it *is* the classifier under test)".
  - Criterion: MC-44.
  - Verdict: DISMISSED.
  - Reason: the ADR cites 2c as a place where the signing log matters, not as a detection. 2c names the signing-log matcher (CONTRACT §5.0 rule 1) as the component under test, so the reference still says what the ADR implies. Advisory: say "2c (as classifier input)".
- C-4 · ADR-001:40 "**B**, provided Q-D1 (custodian-side verification of `payloadHash` and approval) is answered yes" vs ADR-001:46 "B if Q-D1 (a)–(c) are all yes".
  - Criteria: JL-3, RUBRIC.md:92.
  - Verdict: DISMISSED.
  - Reason: "Q-D1 … answered yes" covers the whole question. The gloss names part (a) only, and the table pins (a)–(c). "verification of payloadHash" repeats step 1 (recompute payloadHash), not the challenge encoding, which :8 pins. Prose and table give the same option per phase.
- C-5 · LEDGER.md:34 "CF-1 · CONTRACT `getApproval` must return the checker's FIDO2 assertion over `payloadHash`", cited by ADR-001:8, which now says "not the hex `payloadHash`".
  - Criterion: MC-44.
  - Verdict: DISMISSED for this unit.
  - Reason: CF-1 resolves for what ADR-001 cites it for (a signer-held credential via getApproval). The stale encoding is LEDGER bookkeeping, like R4 C-9 (CF-3, since closed). Advisory: update the CF-1 text in LEDGER.
- C-6 · ADR-004:13 lists recipient duties ¶6.2, ¶6.4 and ¶6.5 but not ¶6.3 ("single transaction valued at less than R5 000 from an originator in a high-risk or other monitored jurisdiction, a recipient … must verify the accuracy of the beneficiary information", PDF).
  - Criterion: MC-43.
  - Verdict: DISMISSED.
  - Reason: the ADR does not claim completeness. ¶6.3 is carried in Q-R10 (OPEN_QUESTIONS.md:68), and inbound design is gated on Q-R9/CF-4. The pilot is blocked until Compliance confirms (ADR-004:35).
- C-7 · ADR-002:10 "Our own node's limits are configurable (Q-A11)".
  - Criterion: N5, MC-21.
  - Verdict: DISMISSED.
  - Reason: run-an-arc-node.md:213-214 documents configurable `--rpc.max-*` flags. The eth_getLogs default is routed to Q-A11, and no design rule depends on the value, because U3 pages ≤9,999 and bisects.
- C-8 · ADR-004:23 "Usually offshore. Needs a PIA (L-8)".
  - Criterion: N5.
  - Verdict: DISMISSED.
  - Reason: the claim is hedged, and its consequence (a PIA) applies to every vendor anyway (G-M 6, L-8).

Probe G (would the rubric wave through a bad version?): YES for one class. MC-45 compares each ADR only with THREAT_MODEL and RISK_REGISTER, and MC-44 is usually run from the citing text forward. A bad version in which two ADRs assign the same control (nonce writer, signing log, address derivation) to different components would pass, unless the verifier also resolves the register's ADR column backwards, as done here (D1). Suggested wording for the human: "ADRs that touch the same control agree with each other, and every Q-D row's ADR column is mirrored by that ADR." The R4 Probe G concern (prose vs table) was re-run and holds on this artefact (C-4).
Probe F (would the rubric fail a good version?): YES, on a literal reading of MC-43 ("URL + archive path + access date"). ADR-004 gives the archive path and date, and the URL only through MANIFEST:42, which was re-fetched today and is hash-identical. It passes only through the "or listed as Q-R…" branch. A faithful, well-archived citation would fail without that branch. Suggested reading: "URL resolvable through MANIFEST". This is the same as R4's MC-21 Probe F.

DEFECTS:
- D1 · docs/adr/ADR-003-orchestration.md:16, :22, :31-32 (nonce design not conditioned on ADR-001 B / Q-D7; Q-D7 absent) together with docs/OPEN_QUESTIONS.md:88 (Q-D7 attributed to ADR-003) and :84 (Q-D3 attributed to ADR-006, absent there) · R / MC-44, MC-45 (single-nonce-writer control) · minor

All 3 R4 defects (D1–D3) were confirmed fixed by reconstruction against the PDF, RISK_REGISTER v3 and CONTRACT §1.3. No blocking defect.

VERDICT: NEGATIVE (1 defect: 0 blocking, 1 minor)
