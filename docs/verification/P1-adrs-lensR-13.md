VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 13 (operator-authorised extra round, LEDGER 2026-10-05), after fix block 9 · commit: none (uncommitted working tree; the repo has no commits)

Run window: 2026-10-05 10:09 UTC to 10:18 UTC. The guard hook was not loaded, so the verifier followed its rules by hand:
- read-only HTTPS GETs of documentation pages only, through `tools/source_drift.py` (33 URLs from MANIFEST: docs.arc.io, developers.circle.com, fic.gov.za, gov.za, resbank.co.za, inforegulator.org.za). I listed the URLs before running it; none is an RPC endpoint;
- no RPC call of any kind, so no mainnet endpoint and no signing or sending method;
- no .env file or key material read;
- the only file written in the repo is this report. The drift tool's output went to /tmp/drift-lensR13.md.

## Versions

ADR SHA-256 prefixes, identical at start (10:09 UTC) and end (10:17 UTC):
- 001 4afad822685390ce (**changed vs R12** b38638549b8ac4fc; fix block 9, mtime 10:08:31 UTC)
- 003 58b9836384c63ee1 (**changed vs R12** 9f73f03bebac8f5e; fix block 9, same mtime)
- 002 f56d8a71d580dbb6, 004 43554bbf083caec3, 005 08cdf2fb0dc482fa, 006 9a91b242428b25cc, 007 05c75efbf80b87d2: byte-identical to R12.

Fix block 9 also changed OPEN_QUESTIONS (Q-D1 parenthetical; same mtime) and LEDGER (CF-23 closed).

Siblings (MC-40 label clause, version pinning). Five changed during this run because other units' blocks were running:

| Document | Start (10:09) | End (10:17) | Effect on this run |
|---|---|---|---|
| OPEN_QUESTIONS | 7759487ba78d5321 | ae2301c37a7fde75 | Q-D1 (:85) parenthetical and Q-D4 (:88) re-read at the end: unchanged in the parts used |
| THREAT_MODEL | e134eede2f943abf | 6799bd758bfc8ffa (v2 fix block 8) | T-T6 moved :83 → :85, T-T1 :78 → :80; both re-read at the end, same control text. The header (:5) still says it is "ahead of ADR-001 … (T-T6, routed as CF-23)" |
| RISK_REGISTER | 10a99078e3df4ec4 | 241eb1b46745fac6 | RB-7 :85, RB-10 :87 re-read; not used for a verdict below |
| RUBRIC | 4387ef4325c2f11e | 4d86338d957d6c46 | MC-21 (:63), MC-44 (:84), MC-45 (:85) re-read at the end; no change in their text used here |
| LEDGER | 1af0cb676135f87a | d4e564055b1ca008 | P1-adrs row and CF-23 (closed) re-read |

Unchanged: CONTRACT d6768590a827999c, ADR-008 18ff96fcf0c21714, constants e494e7724fa544fb.

## Criteria and exclusions

Criteria: RUBRIC MC-03, MC-11 (exits), MC-21 (shared method, run by me), MC-43, MC-44, MC-45, the ADR rules, JL-1 to JL-6; CLAUDE.md N1, N2, N4, N5.

Routed, open CF items, not counted as defects: CF-9(b), CF-19 (closed), CF-20 (Goldsky in ADR-002), CF-21 (ADR-001 Q-D3 restatement and ADR-006 path).

## CHECKS

### R12 D1: ADR-003 Q-D4 restatement → PASS
- ADR-003:33 now reads: "… serialisable transactions, or row locking with a transactional outbox, and a **row-level read audit log that the application identity can't alter** (THREAT_MODEL DR-26, residual 9). The authoritative wording is the OPEN_QUESTIONS row."
- Clause by clause against OPEN_QUESTIONS:88: database run and supported = "run and support operationally"; serialisable or row locking = equal; transactional outbox = equal; row-level read audit log the application identity can't alter = equal; DR-26 = equal. Set-equal **and** explicitly deferring.
- References resolve: DR-26 (THREAT_MODEL:187, "Contingent on row-level read auditing (Q-D4); until then G1 residual 9"), residual 9 (THREAT_MODEL:206, "Registry theft … only once the database provides row-level read auditing (Q-D4)").

### CF-23: signed, version-pinned signer configuration (ADR-001:24) → FAIL (D1)
- ADR-001:24: "The signer loads the configuration its duties depend on only when it is signed by its bank owner and matches the pinned version. **That configuration is** its copy of Treasury's list (items 2 and 6), every cap and fee limit (items 3 and 6, Treasury with Risk), and the monitor's attestation public key (item 5, Security). An unsigned or unexpected version → the signer refuses to sign (fail closed). It reports the hash of each loaded version, so each owner can re-attest it daily."
- Forward trace to THREAT_MODEL T-T6 (:85): the threat covers every "reference artefact the monitor, **the signer** or the egress proxy trusts", including "**the FIDO2 credential registry**"; the control: "The monitor, the signer and the egress proxy verify the signature and the pinned version on load". Owner of the credential registry: Security.
- The signer does trust a FIDO2 credential set: ADR-001:8 item 1 verifies `checkerAssertion` "against credentials the signer holds"; THREAT_MODEL T-T1 (:80) "against credentials it holds itself (ADR-001, U9)"; CONTRACT:196 "The signer verifies it against its own registered credential for `checkerId`".
- ADR-001:24 enumerates "that configuration" as a closed list of three artefacts; item 1's credentials are not in it, so the signer's credential copy is neither signature-checked on load nor hash-reported for T-T6's daily re-attestation ("input = the hash reported by the monitor, the signer and the egress proxy").
- ADR-to-ADR (MC-45): ADR-008:103 makes the **monitor** check "the credential registry" on load. The two ADRs disagree on the same artefact class under the same control.
- Vendor qualification (MC-45, clause by clause): the Q-D1 parenthetical (OPEN_QUESTIONS:85) covers "Treasury's list, the caps and fee limits, and the monitor's public key". It omits the credentials as well, and its scope label "for (b), (f) and (g)" omits (a) (credentials) and (d) (the monitor key it does list). So under option B nobody asks the custodian to verify a signed credential set.
- Effect: anyone able to write the signer's credential store (without the Security owner's signing key) can register a credential for a `checkerId`. A compromised orchestrator can then present self-made "checker" assertions, which item 2 makes "the authority" for payout and case-return destinations. Bounded by the caps (residual 4) and detected after the fact by DR-03 (monitor, against its own signed registry copy) and DR-01 content binding, so **minor**.
- The other three artefacts trace correctly: owners Treasury (list, caps; "with Risk" is ADR-001's consistent co-owner since item 3) and Security (attestation key) match T-T6; fail-closed "refuses to sign" matches T-T6 "no signing"; the hash report matches T-T6's [X] input. Refusal outcomes are covered by CONTRACT :344, :379, :409 (PAUSE) and :429 (move → ABANDONED with a case).
- Forward from CF-23 as routed (LEDGER:65 "Treasury's list and caps, the monitor's attestation public key"): fully implemented. The gap is between T-T6 (the source CF-23 cites) and CF-23's own list, which fix block 9 carried over.

### R11/R12 fee and cap re-trace (ADR-001:15–23, unchanged text) → PASS
- Lines :15–:23 carry the same text R12 traced (the new bullet is :24). The R12 table still holds: payout/return ≤ C_tx + F_max; move ≤ per-move cap + F_max; cancel ≤ F_max; per day ≤ C_day including every worst-case fee.
- Q-D1 (g) (OPEN_QUESTIONS:85) still covers value caps, both fee ceilings, fees against the daily cap incl. cancels and replacements, the chain-ID pin, own copy, owner Treasury with Risk, and the move caps of (f).

### MC-45 vendor qualification, duty ↔ Q-D1 letter → FAIL (part of D1)
| Duty | Letter | Result |
|---|---|---|
| 1 | (a) | equal |
| 2 incl. collection cancel | (b) | equal |
| 3 | (g) | equal |
| 4 | (e) | equal |
| 5 | (d) | equal |
| 6 | (f) + (g) | equal |
| signing log | (c) | equal |
| signed configuration (:24) | parenthetical "for (b), (f) and (g)" | covers the three listed artefacts by content; mislabelled scope (lists the (d) key but not (d)); no credential set (D1) |
| nonce writer | Q-D7 | equal |
| — | (h) | not a duty |

### MC-45 signer rules against every CONTRACT row that requests a signature → PASS
CONTRACT unchanged since R12. §5.4 APPROVED sign / refuse → PAUSE (:344); SIGNED cancel; BROADCAST replace; §5.5 RET rows (:409); §5.6 PROPOSED sign / refuse → ABANDONED (:429); cancel/replacement refusal → PAUSE (:379). Re-traced per wallet role (hot, gas, collection). The new load-time refusal reaches these same refusal rows.

### MC-45 boundaries → [inspection-only] PASS
Unchanged from R12: threshold T−k/T/T+k → none/none/checker (:23); move cap C/C+k → allowed/refused; fee ceiling F_max / F_max + 1 wei → allowed/refused.

### MC-45 backward trace from owner cells → FAIL (part of D1)
- THREAT_MODEL T-T6 names "the signer" as a verifier of every artefact it trusts; ADR-001 omits one (D1).
- THREAT_MODEL residual 4 (:198) and RISK_REGISTER RB-7 still rely on the signer's limits: true for value and fees.
- T-T1, T-E2, T-E5 agree with duties 1, 2 and 4.

### MC-45 Q-D mirror and restatements → PASS
- Every Q-D row's ADR column is mirrored: D1 → 001; D2 → 001; D3 → 001, 006; D4 → 003; D5 → 004; D6 → 005; D7 → 001, 003.
- Q-D1 (ADR-001:65) defers explicitly; Q-D4 (ADR-003:33) set-equal and defers (R12 D1 fixed); Q-D7 equal (ADR-001:76, ADR-003:34); Q-D2 mirrored with :46; Q-D5 (ADR-004) equal to OPEN_QUESTIONS:89; Q-D6 mirrored with ADR-005:27; Q-A11 equal; Q-A12 equal to the question text; Q-D3 routed (CF-21).

### MC-44, IDs resolved by script → PASS
- 64 distinct IDs extracted from ADR-001…007 (C-, CF-, DR-, T-, L-, RR-, RB-, MC-, P, Q-) and grepped in their home documents: **0 unresolved**. New ones: T-T6, CF-23 (ADR-001:24), DR-26 and residual 9 (ADR-003:33) each say what the citing text claims.
- G-M 2, 5, 8 at GATES.md :19, :22, :25.

### MC-21, shared method, run by me → PASS
- `tools/source_drift.py` SHA-256 5504b5e7076f186c49874d5738d3ca8fd77e9cf66bd6bf607d5586ffd38980e1, equal to the version recorded as reviewed and sound in P1-rubric-lensR-13 (and read by ADRs R12). I also re-read its I/O surface (`urlopen` GET only, writes only to `--out`).
- Ran 10:10:24–10:10:42 UTC: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33".
- Every quote checked against **the archive the tool compared** for that URL (its report row), normalised for whitespace and markup; all found:
  - custody.md: "No Arc-specific MPC protocol modifications are needed";
  - gas-and-fees.md: "Minimum base fee (testnet) | 20 Gwei", "Maximum base fee | 20,000 Gwei", "Hard ceiling that bounds worst-case cost", the `maxPriorityFeePerGas` tip text (:80);
  - node-requirements.md: "Memory | 64 GB+", "Storage | 1 TB+ NVMe SSD (TLC recommended)", "Network | Stable 24 Mbps+", "Arc Testnet | v0.8.0", the snapshot sentence, the relay sentence, "Fetches and verifies blocks", the IPC-mode sentence, the three testnet relays, `--public-api`, Ubuntu 22.04 / Debian 12, 68 GB / 16 GB (:50–51);
  - rpc-endpoints.md: `https://rpc.quicknode.testnet.arc.io`;
  - compliance-vendors.md: "offering analytics, wallet screening, and monitoring tools";
  - transaction-memos.md: the EOA-caller sentence and `0x5294E9927c3306DcBaDb03fe70b92e01cCede505`;
  - deposits.md: "one unique address per user";
  - withdrawals.md: viem and ethers; arc llms.txt: Reth.
- constants.md unchanged; C-30/C-31 (:49, :50) match ADR-001:17's use.

### MC-43 (ADR-004, byte-identical since R9) → [inspection-only] PASS (extracted text)
In `fic/Directive-9.extracted.txt` (MANIFEST:43, derived from the hashed PDF at :42): "comes into operation on 30 April 2025" (1), "may not execute a crypto asset transfer if it cannot comply" (1, ¶4.8), "prior to, or simultaneously with" (1, ¶7.2), "Post facto transmission … is not permitted" (¶7.3), "unless there is a suspicion of money laundering or terrorist financing, in which case" and "must verify the information pertaining to the originator" (¶4.6), "R5 000" (¶4.5 "less than R5 000"), ¶2.1.9 definition (present with an extraction split "tran saction"), ¶6.4/¶6.5 keep the "cross-border" qualifier.

### MC-03 arithmetic (exact Python integers) → PASS
- ADR-006:13: 21,000 × 20·10⁹ = 420,000,000,000,000 wei; divmod(·, 10¹²) = (420, 0) → 0.00042 USDC.
- p = 6 (k = 10¹²): 0 → (0, 0); 1 → (0, 1); k−1 → (0, 999,999,999,999); k → (1, 0); 10¹⁸ → (1,000,000, 0); 1,000,000,500,000,000,000 → (1,000,000, 500,000,000,000); 123,456,789,012,345,678,901 → (123,456,789, 12,345,678,901); (2⁶³−1)·k + k−1 → (9,223,372,036,854,775,807, 999,999,999,999).
- p = 2 (k = 10¹⁶): 10¹⁸ → (100, 0); 123,456,789,012,345,678,901 → (12,345, 6,789,012,345,678,901). Identical to R12.

### Structure and safety scans (script)
- 7 target files; "Status: PROPOSED. A human decides at G1." once in each → PASS.
- Option columns 3, 3, 3, 3, 3, 4, 4; three phase rows in ADR-001…006; ADR-007 "the same in all phases" with a reason → PASS. ADR-001 prose (:55) and table (:61) both condition B on "Q-D1 (a)–(g)" → PASS. Trade-off substance [inspection-only] PASS.
- N1/N2 (mainnet ID assembled at run time): testnet ID at ADR-001 :6, :20, :72; mainnet ID 0; mainnet hostnames 0; 64-hex strings 0; gitleaks not on PATH → [inspection-only] PASS.

### Judgment lenses
- JL-1: unsigned or unexpected configuration → refuse to sign → CONTRACT PAUSE / ABANDONED-with-case rows → PASS.
- JL-2 / N4: configuration owners are named humans (Treasury with Risk; Security); no ADR picks a value → [inspection-only] PASS.
- JL-3, JL-5, JL-6: unchanged since R12 → [inspection-only] PASS.
- JL-4: the hash report gives owners an audit hook, except for the credential set (D1) → [inspection-only] PASS apart from D1.
- Counts vs LEDGER: 12 unit rows, 0 frozen; the P1-adrs row reads "fix block 9 used (operator-authorised)" and "R13 pending", matching this run → PASS.

### Regression check (no frozen units; substitutes farthest from the ADR-001/003 edits and not used in R11 (004/007) or R12 (005/003)): ADR-002 and ADR-004
- **ADR-002** (byte-identical since R8) → PASS: all node-requirements and rpc-endpoints quotes found in the compared archives; C-40 (:61), C-41 (:62), C-68 (:76) have the stated subjects; Q-A11 equal to OPEN_QUESTIONS:28; Q-A12 equal to the question text (:29); SEQUENCES F2 (:261) and F7 (:411) exist; T-S2 (:72), L-3, T-I1 agree with rules 1, 2, 5; Q-A9 (:33) records the rule-6 proposal. CF-20 routed.
- **ADR-004** (byte-identical since R9) → PASS: quotes and ¶ pinpoints as above; Q-D5 equal to OPEN_QUESTIONS:89; Q-R3 (:69), Q-R9 (:70), Q-R10 (:71, cites ¶4.5/4.6) resolve; G-M 2 exists; DR-18 (:183) is the digest check named in the testnet row.

## CANDIDATES (Lens A, run for completeness)

**C-1 · ADR-001:24 omits the signer's FIDO2 credential set from the signed configuration**
- Evidence: ADR-001:24 "That configuration is its copy of Treasury's list …, every cap and fee limit …, and the monitor's attestation public key"; ADR-001:8 "against credentials the signer holds"; THREAT_MODEL:85 T-T6 "a reference artefact the monitor, the signer or the egress proxy trusts: … the FIDO2 credential registry … The monitor, the signer and the egress proxy verify the signature and the pinned version on load"; ADR-008:103 includes "the credential registry"; OPEN_QUESTIONS:85 parenthetical lists only three artefacts.
- Criterion: MC-45 (agreement with THREAT_MODEL on owned controls, both ways; ADR-to-ADR; vendor-qualification coverage).
- Verdict: **REAL** (D1). The closed enumeration excludes an artefact T-T6 requires the signer to verify; ADR-008 verifies the same class at the monitor; Q-D1 inherits the gap.

**C-2 · Q-D1 parenthetical scope label "for (b), (f) and (g)" omits (d), though it lists the monitor's key**
- Evidence: OPEN_QUESTIONS:85.
- Criterion: MC-45 clause by clause.
- Verdict: **DISMISSED as a separate defect.** The content names the monitor's key, so a "yes" covers it; the label is cosmetic, it sits in OPEN_QUESTIONS (not this unit), and the fix travels with D1 (relabel "(a), (b), (d), (f) and (g)").

**C-3 · ADR-001:24 omits T-T6's "two-person change control"**
- Evidence: T-T6 "signed by its owner under two-person change control"; ADR-001:20 "under the signer's change control"; :24 "signed by its bank owner".
- Criterion: MC-45.
- Verdict: **DISMISSED.** Two-person change control is the owner's process; T-T6 itself has the signer verify "the signature" (singular), which ADR-001 matches. Advisory: say "signed by its owner under two-person change control (T-T6)".

**C-4 · ADR-003 states the audit log as "must provide" while THREAT_MODEL accepts its absence as residual 9**
- Evidence: ADR-003:33 "It must provide … a row-level read audit log"; THREAT_MODEL:187 "until then G1 residual 9".
- Criterion: MC-45.
- Verdict: **DISMISSED.** Not contradictory: the ADR states the requirement, the threat model states the interim residual, and ADR-003 defers explicitly to the OPEN_QUESTIONS wording. The "must" for serialisable/row locking was already accepted in R1–R12.

**C-5 · Re-attestation cadence "daily" vs T-T6 "daily and at every change"; hash-report channel unstated**
- Evidence: ADR-001:24 "so each owner can re-attest it daily"; T-T6 [X] "cadence daily and at every change".
- Criterion: MC-45; MC-40(e).
- Verdict: **DISMISSED.** The cadence belongs to the owners' [X] control in T-T6, which ADR-001 only motivates; a channel through the adapter matters only for the combined compromise, which is residual 8.

**C-6 · ADR-001 options row :42, recommendation :55 and Q-D1 summary :65–75 don't mention the signed configuration**
- Criterion: MC-45 restatement; ADR prose/table rule.
- Verdict: **DISMISSED** (same class as R12 C-2): :65 defers explicitly, and the binding condition in prose and table is the letter range "(a)–(g)", to which the OPEN_QUESTIONS parenthetical attaches. Advisory: add "signed, pinned configuration" to :42, :55 and the :65 summary.

**C-7 · THREAT_MODEL header still says it is "ahead of ADR-001 … (T-T6, routed as CF-23)"**
- Evidence: THREAT_MODEL:5 (v2 fix block 8); LEDGER CF-23 closed by ADRs fix 9.
- Criterion: MC-40 label clause.
- Verdict: **DISMISSED for this unit.** The stale claim is THREAT_MODEL's; route it to that unit (re-check after D1 is fixed, since the credential set would remain "ahead").

**Probe G (would the rubric wave through a bad version of this artifact?): YES.**
- MC-45 forward-traces an ADR against THREAT_MODEL "on the controls it owns", but nothing makes the verifier derive the **set of artefacts a component trusts** from that component's own duties. An ADR that lists a closed subset of its artefacts and matches the CF item that routed the fix passes a CF-driven check (as fix block 9 did against CF-23's list).
- Proposed: "for every component that verifies artefacts on load, derive its trusted-artefact set from every input its duties name (keys, credential sets, lists, caps), and diff against both the ADR's list and THREAT_MODEL T-T6; a CF item's own list is not the reference".

**Probe F (would the rubric fail a good version?): YES, mildly.**
- MC-45 "Every vendor-qualification question … covers every signer-side control the ADR requires", read literally, would fail a good ADR whose Q-D1 parenthetical attaches the signed-configuration clause to a letter range that doesn't name the letter of each artefact's duty (C-2), although the content covers it.
- Suggested: "coverage is judged by the clause's content; a scope label that is narrower than its content is advisory".

## DEFECTS

**D1** · docs/adr/ADR-001-custody-signing.md:24 (Signed configuration), with docs/OPEN_QUESTIONS.md:85 (Q-D1 parenthetical)
- Problem: the signed, version-pinned configuration is defined as Treasury's list, the caps and fee limits, and the monitor's key. It omits the FIDO2 credential set the signer verifies `checkerAssertion` against (item 1; T-T1; CONTRACT:196). THREAT_MODEL T-T6 requires the signer to verify every reference artefact it trusts, including "the FIDO2 credential registry", and ADR-008:103 makes the monitor do so. Q-D1 inherits the omission (and labels its scope "(b), (f) and (g)", without (a) or (d)).
- Lens and criterion: R / MC-45 (agreement with THREAT_MODEL on owned controls, traced both ways; ADR-to-ADR agreement; vendor-qualification coverage).
- Severity: **minor.** The caps bound the damage (residual 4) and DR-03/DR-01 detect a forged approval after the fact; no money moves before Phase 3. Fix: add "the checkers' FIDO2 credentials (item 1, Security)" to :24 and to the Q-D1 parenthetical, and relabel it "(a), (b), (d), (f) and (g)".

## Status of R12 defects (confirmed by reconstruction)
- D1 (ADR-003 Q-D4 restatement lacks the audit-log clause): **fixed**. Set-equal clause by clause, and it defers explicitly.

## VERDICT

VERDICT: NEGATIVE (1 defect: 0 blocking, 1 minor)

Phase 1 · units frozen 0/12 · streak 0/3 · rounds used 10/10 + grace 2/2 + operator extra 1 (P1-adrs) · regen budget left: per LEDGER (not changed by this pass)
