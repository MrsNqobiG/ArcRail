VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 14 (standing grant, extra 1 of 3, LEDGER 2026-10-05), after fix block 10 · commit: none (uncommitted working tree; the repo has no commits)

Run window: 2026-10-05 10:20 UTC to 10:34 UTC. The guard hook was not loaded, so the verifier followed its rules by hand:
- read-only HTTPS GETs of documentation pages only, through `tools/source_drift.py` (33 URLs from MANIFEST: docs.arc.io, developers.circle.com, fic.gov.za, gov.za, resbank.co.za, inforegulator.org.za). I listed the URLs before running it; none is an RPC endpoint;
- no RPC call of any kind, so no mainnet endpoint and no signing or sending method;
- no .env file or key material read;
- the only file written is this report. The drift tool wrote to `/dev/stdout` (`--out /dev/stdout`), so no temp file was created.

## Versions (SHA-256 prefixes, pinned at 10:20:47 UTC, re-read at 10:33:23 UTC)

Target files, identical at start and end:
- 001 ce0106ea60d271e7 (**changed vs R13** 4afad822685390ce; fix block 10)
- 002 f56d8a71d580dbb6, 003 58b9836384c63ee1, 004 43554bbf083caec3, 005 08cdf2fb0dc482fa, 006 9a91b242428b25cc, 007 05c75efbf80b87d2: byte-identical to R13.

Siblings:

| Document | Start | End | Effect on this run |
|---|---|---|---|
| OPEN_QUESTIONS | 73ad9d4c159fffc1 | same | Q-D1 (:85) changed by fix block 10 vs R13 (ae2301c37a7fde75); used below |
| THREAT_MODEL | 6799bd758bfc8ffa | same | = R13 end version (v2 fix block 8) |
| RISK_REGISTER | b2eff1243c3f7e05 | same | changed vs R13 end; RR-3 heading (:38), RB-7 (:90) re-read |
| CONTRACT | d2f7242268548c19 | same | changed vs R13; signature rows :342, :344, :379, :405, :409, :428, :429 re-read, same text and line numbers as R13 cites |
| RUBRIC | 4d86338d957d6c46 | same | = R13 end version |
| constants | e494e7724fa544fb | same | unchanged |
| ADR-008 | 18ff96fcf0c21714 | **f81850e237aa7df6** | changed during this run (P1-adr-008 fix block 6). Lines used (:23, :28, :40, :41, :103) re-read at the end: same text |
| LEDGER | 9713ac4f69770662 | **d7772cef47b6c68e** | changed during this run. P1-adrs row re-read at the end: "Fix 10 … R14 pending", matching this run |

## Criteria and exclusions
Criteria: RUBRIC MC-03, MC-11 (exits), MC-21 (shared method, run by me), MC-43, MC-44, MC-45, the ADR rules, JL-1 to JL-6; CLAUDE.md N1, N2, N4, N5.
Routed, open CF items, not counted as defects: CF-9(b), CF-15 (CONTRACT §5.6 "below the threshold"), CF-20 (Goldsky in ADR-002), CF-21 (ADR-001 Q-D3 restatement and ADR-006 path). Queued rubric proposals are not applied as criteria.

## CHECKS

### R13 D1: credential set in the signed configuration → PASS
- ADR-001:24 now reads "That configuration is the checkers' FIDO2 credentials (item 1, Security), its copy of Treasury's list (items 2 and 6), every cap and fee limit (items 3 and 6, Treasury with Risk), and the monitor's attestation public key (item 5, Security)."
- Forward to THREAT_MODEL T-T6 (:85): of T-T6's ten artefact classes, the ones the **signer** trusts are Treasury's list and caps, the FIDO2 credential registry and the monitor's attestation key. The others belong to the monitor (honeytokens, canaries, WORM anchor, IdP trust, xpub), the egress proxy (address set) or deployment tooling (DR-27 digest list, :191). Set-equal with ADR-001:24.
- Owners: T-T6 "Treasury (list, caps), Security (… credential registry, attestation key …)". ADR-001:24 names the same; "with Risk" is ADR-001's consistent co-owner since R10 D2.
- ADR-to-ADR: ADR-008:103 (monitor) and ADR-001:24 (signer) now both load the credential set only when signed and pinned.
- Q-D1 parenthetical (OPEN_QUESTIONS:85): "for (a), (b), (d), (f) and (g): the policy configuration, meaning the checkers' FIDO2 credentials, Treasury's list, the caps and fee limits, and the monitor's public key". Letter mapping re-derived: credentials → (a); Treasury's list → (b), (f); caps and fee limits → (f), (g); monitor key → (d). Union = {a, b, d, f, g} = the label. The artefact list is set-equal with ADR-001:24.
- So the two parts R13 named (credentials, scope label) are fixed. See D1 for a third clause of the same bullet that Q-D1 still doesn't ask about.

### MC-45 vendor qualification, clause by clause, ADR-001:24 ↔ Q-D1 parenthetical → FAIL (D1)
ADR-001:24 has three clauses:

| ADR-001:24 clause | Q-D1 parenthetical | Result |
|---|---|---|
| load only when signed by its bank owner and matching the pinned version | "loaded only when signed by its bank owner and pinned to a version" | equal |
| unsigned or unexpected version → refuse to sign | "and refused otherwise" | equal |
| "It reports the hash of each loaded version, so each owner can re-attest it daily" | — | **missing** |

The hash report is the signer's input to T-T6's [X] detection ("input = the hash reported by the monitor, the signer and the egress proxy"). Under option B the signer is the custodian's engine, so only the custodian can report what it actually loaded; the bank's record of what it uploaded is not evidence of the deployed version. ADR-001 doesn't say where else this is enforced. MC-45: "a clause that asks about only part of a duty covers only that part". R13's table said the parenthetical "covers the three listed artefacts by content" and did not compare this clause.

### MC-45 / JL-2: every parameter of the signer's duties has an own copy and an owner → FAIL (D2)
Each value the six duties compare against, re-derived from ADR-001:8–23:

| Duty | Parameter | Own copy, never from the orchestrator | Named owner | In the signed configuration (:24) | Q-D1 |
|---|---|---|---|---|---|
| 1 | checkers' FIDO2 credentials | "credentials the signer holds" (:8) | Security (:24) | yes | (a) + parenthetical |
| 2, 6 | Treasury's list | "the signer's own copy" (:11, :23) | Treasury | yes | (b), (f) |
| 3 | value caps, fee limits | "its own copy of every cap" (:20) | Treasury with Risk | yes | (g) |
| 3 | chain-ID pin 5042002 | fixed value (:20) | n/a (code, MC-20/MC-23) | n/a | (g) |
| 5 | monitor's attestation key | "the signer's own trust store" (:22) | Security | yes | (d) |
| 6 | per-move and daily move caps | own copy (:20 "here and in item 6") | Treasury with Risk | yes | (f), (g) |
| 6 | **approval threshold** for moves ("at or below … no checker; strictly above … needs one", :23) | **not stated** | **none** | **no** ("every cap and fee limit"; a threshold is neither) | (f) states the rule only; (g)'s "own copy … never taken from the orchestrator" covers caps only |

- Re-trace with a compromised orchestrator: CONTRACT §5.6:428 has U7 decide "policy ALLOW (or approved above threshold)" and then "sign through the signer (ADR-001 duty 6 …)". If the signer's threshold comes from the request or from the adapter's U7 configuration, the adapter can declare any move "at or below" and the signer signs it with no checker assertion. That defeats duty 6's checker rule, which ADR-001:7 says the signer must enforce "itself", because it "must not trust the orchestrator".
- Internal contradiction: ADR-001:24's first sentence covers "the configuration its duties depend on", but the closed list after "That configuration is" leaves the threshold out.
- No detection backs it up: DR-01 Move (THREAT_MODEL:166) and ADR-008 Rmove (:40) check `to` on Treasury's list and the move caps, not whether a move above the threshold had a checker.
- JL-2: the threshold is a limit an approver or Risk must own; the caps (R10 D2) and fee ceilings (R11 D1) were given owners for the same reason.
- Bound: moves go only to Treasury's list and stay within the per-move and daily move caps, so no value leaves the bank → **minor**.

### Fee and cap re-trace (ADR-001:15–23, text unchanged since R12) → PASS
- Most a signature can debit: payout or return ≤ C_tx + F_max; move ≤ per-move cap + F_max; cancel ≤ F_max (zero value); per day ≤ C_day, with every signature's worst-case fee counted. Unchanged from R12/R13.
- Boundaries [inspection-only] PASS: threshold T−k / T / T+k → none / none / checker (:23); move cap C / C+k → allowed / refused; fee ceiling F_max / F_max + 1 wei → allowed / refused. Q-D1 (f) "checker strictly above the threshold" uses the same predicate.

### MC-45: signer rules against every CONTRACT row that requests a signature → PASS
CONTRACT changed since R13, but the rows are the same text at the same lines: §5.4 APPROVED sign (:342) / refuse → PAUSE (:344); cancel or replacement refused → PAUSE `SIGNER_REFUSED` (:379); §5.5 RET sign (:405) / refuse → PAUSE (:409); §5.6 PROPOSED sign (:428) / refuse → ABANDONED with a case (:429). Re-traced per wallet role (hot, gas, collection). A load-time refusal (unsigned configuration) reaches these same refusal rows → JL-1 PASS.

### MC-45: backward trace from owner cells → PASS apart from D2
- T-T6 names the signer as a verifier of the artefacts it trusts: now all present in ADR-001:24 (see above).
- T-T1 (:80) "against credentials it holds itself (ADR-001, U9)" = duty 1. T-E2 (:118) "approval verification (Q-C10), limits, destination allow-list, chain ID 5042002 only, shape allow-list" = duties 1–3; T-E5 (:121) = duty 2.
- Residual 4 (:202) and RB-7 (:90) rely on "the signer's per-transaction and daily limits, from its own copy owned by Treasury with Risk": true for value caps and fees. They don't rely on the threshold, so D2 doesn't make them false.

### MC-45: Q-D mirror and restatements → PASS
- Every Q-D row's ADR column is mirrored: D1 → 001; D2 → 001; D3 → 001, 006; D4 → 003; D5 → 004; D6 → 005; D7 → 001, 003. (Q-D8 → ADR-008, Q-D9 → ADR-004 per OPEN_QUESTIONS; Q-D9 comes from CF-24, routed.)
- Q-D1 summary (ADR-001:65) defers explicitly to the OPEN_QUESTIONS row; Q-D4 (ADR-003:33) is set-equal and defers; Q-D7 equal (ADR-001:76, ADR-003:34); Q-D5 equal (ADR-004:39 vs :89); Q-D6 mirrored with ADR-005:27; Q-A11 equal (ADR-002:44 vs :28); Q-A12 equal to the question text (:29).

### MC-44: IDs resolved by script → PASS
- 67 distinct IDs extracted from ADR-001…007 (C-, CF-, DR-, RD-, T-, L-, RR-, RB-, MC-, P#.#, Q-, G-M n) and matched against definition rows or headings in their home documents: **0 unresolved** (RR-3 resolves as the heading at RISK_REGISTER:38).
- New citation content: ADR-001:24 "item 1, Security" agrees with T-T6's owner list; "CF-23" (LEDGER:68, closed by ADRs fix 9) still says what the citing text claims.
- G-M 2, 5, 8 at GATES.md :19, :22, :25.

### MC-21: shared method, run by me → PASS
- `tools/source_drift.py` SHA-256 5504b5e7076f186c49874d5738d3ca8fd77e9cf66bd6bf607d5586ffd38980e1, equal to the version reviewed in P1-rubric-lensR-13 and ADRs R12/R13. Re-read in full (108 lines): `urlopen` GET only, writes only to `--out`.
- Ran 10:23:50–10:24:12 UTC: 40 archives, integrity all "match"; "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33"; exit 0.
- Every ADR quote checked by script against **the archive the tool compared** for its URL (whitespace and markup normalised), all found: custody.md ("No Arc-specific MPC protocol modifications are needed"); gas-and-fees.md ("Minimum base fee (testnet) | 20 Gwei", "Maximum base fee | 20,000 Gwei", :38–39); node-requirements.md (64 GB+, 1 TB+ NVMe SSD (TLC recommended), Stable 24 Mbps+, v0.8.0, the snapshot sentence, the relay sentence, "Fetches and verifies blocks", the IPC-mode sentence, the three testnet relays, `--public-api`, Ubuntu 22.04, Debian 12, 68 GB, 16 GB); rpc-endpoints.md (`https://rpc.quicknode.testnet.arc.io`); compliance-vendors.md; transaction-memos.md (the EOA sentence, `0x5294E9927c3306DcBaDb03fe70b92e01cCede505`); deposits.md ("one unique address per user"); withdrawals.md (viem, ethers); llms.txt (Reth).
- Constants used by the ADRs exist with the stated subjects: C-10 (:24), C-27 (:42), C-30 (:49), C-31 (:50), C-35 (:54), C-40 (:61), C-41 (:62), C-53, C-55, C-56 (:77), C-57 (:75), C-62 (:85), C-63, C-64 (:90), C-65 to C-67, C-68 (:76).

### MC-43 (ADR-004, byte-identical since R9) → [inspection-only] PASS (extracted text)
`fic/Directive-9.extracted.txt` (MANIFEST:43, derived from the hashed PDF at :42), found by script: "comes into operation on 30 April 2025" (¶9.1), "which is any value above zero" (¶2.1.9), "may not execute a crypto asset transfer if it cannot comply" (¶4.8), "prior to, or simultaneously with" (¶7.2), "Post facto transmission" (¶7.3), the ¶4.6 suspicion clause and "must verify the information pertaining to the originator", "less than R5 000" (¶4.5), Gazette 51556 / Notice 5543. ¶6.4 and ¶6.5.1 keep the "cross-border" qualifier (extraction split "cross -border"); ¶6.2 is the beneficiary verification paragraph.

### MC-03 arithmetic (exact Python integers) → PASS
- ADR-006:13: 21,000 × 20·10⁹ = 420,000,000,000,000 wei; divmod(·, 10¹²) = (420, 0) → 0.000420 USDC.
- p = 6 (k = 10¹²): 0 → (0, 0); 1 → (0, 1); k−1 → (0, 999,999,999,999); k → (1, 0); 10¹⁸ → (1,000,000, 0); 1,000,000,500,000,000,000 → (1,000,000, 500,000,000,000); 123,456,789,012,345,678,901 → (123,456,789, 12,345,678,901); (2⁶³−1)·k + k−1 → (9,223,372,036,854,775,807, 999,999,999,999).
- p = 2 (k = 10¹⁶): 10¹⁸ → (100, 0); 123,456,789,012,345,678,901 → (12,345, 6,789,012,345,678,901). Identical to R13.

### Structure and safety scans (script) → PASS
- "Status: PROPOSED. A human decides at G1." exactly once in each of the 7 files.
- Option columns 3, 3, 3, 3, 3, 4, 4. Phase rows 3 in ADR-001…006; ADR-007:29 "the same in all phases" with a reason. ADR-001 prose (:55) and table (:61) both condition B on "Q-D1 (a)–(g)".
- N1/N2: testnet ID 5042002 at ADR-001 :6, :20, :72; mainnet chain ID 0 hits; mainnet hostnames 0; 64-hex strings 0. gitleaks not on PATH → [inspection-only].

### Judgment lenses
- JL-1: unsigned configuration → refuse → CONTRACT PAUSE / ABANDONED rows → PASS.
- JL-2 / N4: caps, fee limits, credentials, list and key have named owners; no ADR picks a value. **Exception: the move-approval threshold has no owner (D2).**
- JL-3, JL-5, JL-6: unchanged since R12 → [inspection-only] PASS.
- JL-4: the hash report gives owners an audit hook under option A; under B it isn't vendor-qualified (D1).
- Counts vs LEDGER: 12 unit rows, 0 frozen; P1-adrs row "fix block 10 used", "R14 pending" → PASS.

### Regression check (no frozen units; substitutes farthest from the ADR-001 edit and not used in R12 (005/003) or R13 (002/004)): ADR-006 and ADR-007
- **ADR-006** (byte-identical since R13) → PASS: Memo quote and address found in the compared archive and equal to C-62; C-56 path; fee arithmetic as above (C-30, C-35); deposits quote found; Q-P1, L-1, L-4, L-5, RR-3, RB-1, CONTRACT §6.1 (:535) resolve; the outbound memo rule (random per instruction, never derived from IDs) agrees with THREAT_MODEL L-4 and T-E5; Q-D3 mirrored (:26); prose "A for the pilot, B later for e-commerce" agrees with the phase table. CF-21 routed.
- **ADR-007** (byte-identical since R13) → PASS: viem/ethers and Reth quotes found in the compared archives; C-10, C-57, C-62 to C-67 exist with the stated subjects; the five stack requirements trace to CLAUDE.md (branded types, float ban) and RUBRIC MC-01/02/07/08/33; single recommendation for all phases with a reason (ADR rule, R6 Probe F).

## CANDIDATES (Lens A, run for completeness)

**C-1 · Q-D1 doesn't ask for the loaded-version hash report** → **REAL (D1)**
- Evidence: ADR-001:24 "It reports the hash of each loaded version, so each owner can re-attest it daily."; OPEN_QUESTIONS:85 "is loaded only when **signed by its bank owner and pinned to a version**, and refused otherwise, THREAT_MODEL T-T6"; THREAT_MODEL:85 T-T6 [X] "input = the hash reported by the monitor, the signer and the egress proxy".
- Criterion: MC-45 (vendor-qualification coverage, clause by clause).

**C-2 · The move-approval threshold has no own copy, no owner, and isn't in the signed configuration** → **REAL (D2)**
- Evidence: ADR-001:23 "A move **at or below** the approval threshold needs no checker assertion; a move **strictly above** it needs one"; :20 "The signer holds **its own copy** of every cap … Caps are **never taken from the orchestrator**"; :24 "That configuration is … every cap and fee limit …"; CONTRACT:428 "policy ALLOW (or approved above threshold)".
- Criteria: MC-45 (agreement with T-E2 "approval verification … limits" enforced by the signer; Q-D1 coverage), JL-2.

**C-3 · Chain-ID pin not in the signed configuration** → DISMISSED. ADR-001:20 pins a fixed value; MC-23 and MC-20 make it a code constant whose change to mainnet is G-M-gated, not an owner-signed parameter.

**C-4 · Collection-address derivation input not in the signed configuration** → DISMISSED. ADR-001:12 has the signer derive "itself" from its own key material. A forged derivation could only admit a zero-value self-send from a key the signer already holds, so the exposure is the fee, which duty 3 bounds.

**C-5 · Where the consumed-approval record is stored, and who can write it, is unstated** → DISMISSED. It is signer state, not configuration ("the signer keeps", T-T1 :80), and DR-25 in the monitor detects a replay after the fact.

**C-6 · Stale "routed / ahead" notes about CF-23** (THREAT_MODEL:5 "ahead of ADR-001 … (T-T6, routed as CF-23)"; ADR-008:103 "The signer's equivalent duty is routed to ADR-001 (CF-23)") → DISMISSED for this unit. ADR-001 now has the duty, so the stale claims belong to THREAT_MODEL and ADR-008.

**C-7 · ADR-007:7 "100% branch coverage" vs MC-07 "reachable branches"** → DISMISSED. It lists the tooling the stack must support (KICKOFF §3 wording). The measurement rule belongs to MC-07, and the requirement doesn't contradict it.

**Probe G (would the rubric wave through a bad version?): YES.** THREAT_MODEL T-T6 lists "Treasury's wallet list and caps", not the threshold. So an ADR and a threat model that **both** leave out a scalar parameter of a signer duty agree with each other, and MC-45 passes. Only JL-2 caught D2. Proposed (extends the queued R13 Probe G from artefacts to parameters): "for each signer or monitor duty, list every value it compares against (lists, caps, thresholds, keys, credentials, pins); each must have a stated source that isn't the orchestrator, a named owner, coverage by the load-time signature rule, and coverage by the vendor-qualification question."

**Probe F (would the rubric fail a good version?): mildly.** MC-44 "resolves to a section that says what the citing text claims", read literally, could fail a good ADR that cites a **closed** CF item for provenance (ADR-001:24 "CF-23"), because the target is struck through. Here it passes, since LEDGER:68 keeps the requirement text. Suggested: "a closed CF item cited for provenance resolves if its entry still states the requirement or names the citing document as the closer."

## DEFECTS

**D1** · docs/OPEN_QUESTIONS.md:85 (Q-D1 parenthetical) against docs/adr/ADR-001-custody-signing.md:24
- Problem: ADR-001's signed-configuration duty has three clauses: load when signed and pinned, refuse otherwise, and report each loaded version's hash for the owners' re-attestation (T-T6 [X] input). Q-D1 asks about the first two only, so under option B nobody asks whether the custodian can report what it actually loaded. ADR-001 doesn't name another place where this is enforced.
- Lens and criterion: R / MC-45 (vendor-qualification coverage, clause by clause).
- Severity: **minor.** Loading is still signature- and pin-checked; only the after-the-fact [X] input for the signer under option B is missing (combined owner compromise is residual 8). Fix: add "and reports the hash of each loaded version to the owners" to the Q-D1 parenthetical.

**D2** · docs/adr/ADR-001-custody-signing.md:20, :23, :24 (with OPEN_QUESTIONS:85 (f)/(g))
- Problem: duty 6's approval threshold ("at or below → no checker; strictly above → checker") is the only duty parameter with no stated source, no named owner and no place in the signed configuration. The own-copy rule (:20) and the signed-configuration list (:24) cover caps and fee limits only, and Q-D1 doesn't require the custodian to hold its own copy. A compromised orchestrator that supplies or alters the threshold can get moves of any size up to the per-move cap signed with no checker. DR-01/Rmove don't check approvals on moves.
- Lens and criterion: R / MC-45 (signer-enforced controls, T-E2; vendor-qualification coverage) and JL-2 (an unowned limit).
- Severity: **minor.** Destinations stay on Treasury's list and amounts stay within the move caps, so no value leaves the bank. Fix: state that the signer holds its own copy of the move-approval threshold, owned by a named human (for the human to name; Treasury with Risk is the existing pattern), include it in :24's list and in Q-D1 (f)/(g) and the parenthetical. Route to THREAT_MODEL T-T6 ("list, caps **and threshold**") and to ADR-008/DR-01 (moves above the threshold must join to an approval) as CF items.

## Status of R13 defects (confirmed by reconstruction)
- D1 (signed configuration omits the FIDO2 credential set; Q-D1 scope label): **fixed.** Credentials are in ADR-001:24 and Q-D1, with owner Security, and the label {a, b, d, f, g} equals the letter union of the listed artefacts.

## VERDICT

VERDICT: NEGATIVE (2 defects: 0 blocking, 2 minor)

Phase 1 · units frozen 0/12 · streak 0/3 · rounds used 10/10 + grace 2/2 + operator extra 1 + standing-grant extra 1 of 3 (P1-adrs) · regen budget left: per LEDGER (not changed by this pass)
