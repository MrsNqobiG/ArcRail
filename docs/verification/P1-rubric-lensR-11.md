VERIFICATION · lens: R · target: P1-rubric (docs/RUBRIC.md v2 after v2 fix block 7, grace round 1 of 2; sha256 ee81f232c9733aa8…, mtime 2026-10-03 12:14:31 +0200, unchanged from the start of the run (2026-10-03 10:14 UTC) through the resumed session (2026-10-05 08:31 UTC)) · commit: none (no HEAD; `git log` → "your current branch 'main' does not have any commits yet"; uncommitted working tree)

Criteria: KICKOFF_PROMPT.md §3, §4; CLAUDE.md; docs/RISK_REGISTER.md; docs/CONTRACT.md (sha256 6e0c6cdd…, unchanged during the run); docs/THREAT_MODEL.md; docs/adr/; docs/constants.md; docs/LEDGER.md; every report in docs/verification/.
Moving inputs: LEDGER.md changed during the run (12:14:39 → 12:24:19 +0200; sha256 now afc6959b…). Its rubric queue gained two rows (P1-threat-model-lensR-8, P1-adrs-lensR-9). Both reports postdate fix block 7, so under the queue rule (RUBRIC.md:163) they are not defects of this version and are not counted. THREAT_MODEL.md also changed (12:24:06); not used as a criterion for any finding below.
Session note: the session restarted mid-run and the guard hook was not loaded on resume. This run made no RPC calls at all (testnet or mainnet), signed nothing, and read no .env or key files. The only network access was HTTPS GETs of docs.arc.io pages.

CHECKS
- K1 Counts recounted by grep → PASS. 37 MC rows (`grep -c "^| MC-"`: MC-01..08, 10..24, 30..34, 40..48). 6 JL rows. 10 money-path items (:18-27). Tags: 18 (both) + 19 (code), 0 (design)-only. That is one more (both) than R10 (17/20), which matches MC-17 moving from (code) to (both) (:55). Proposal register rows: 40 (`grep -cE "^\| [0-9]+ \| [a-z0-9-]+-lensR-[0-9]+:"`), numbered 1–40 with no gaps. :222 says "Not adopted: row 31", and exactly one row (31) has a non-adopted decision. LEDGER frozen units: `grep -c "| frozen"` → 0. LEDGER :33 "MC-01…MC-48 + JL-1…JL-6" matches.
- K2 Arc constants re-fetched live → PASS. Full fetch with quotes at 2026-10-03 10:18 UTC (all HTTP 200). Re-fetched at 2026-10-05 08:34 UTC (all HTTP 200, every cited string still present).
  - https://docs.arc.io/arc/references/rpc-endpoints.md :64 "| **Chain ID (Testnet)** | `5042002` |"; :105 "`eth_getLogs` returns error `-32012` when the requested block range exceeds"; :108 "≤9,999-block chunks."; :44 "safely retry requests that return `-32014` after a brief backoff."
  - https://docs.arc.io/arc/references/usdc-system-events.md :35 "| **Native USDC** (system, EIP-7708) | `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` | `Transfer` | 18 |"; :36 "| **ERC-20 USDC** (NativeFiatToken) | `0x3600000000000000000000000000000000000000` | `Transfer` | 6 |"; :39 "A single ERC-20 `transfer()` emits **two** logs".
  - https://docs.arc.io/arc/references/evm-differences.md :203 "**The minimum base fee is 20 Gwei.**"; https://docs.arc.io/arc/references/gas-and-fees.md :38 "| **Minimum base fee (testnet)** | 20 Gwei |".
  - https://docs.arc.io/arc/references/contract-addresses.md :207 Testnet tab, :210 "| **TokenMessengerV2** | 26 |", :212 "| **MessageTransmitterV2** | 26 |" (constants C-60).
  - https://docs.arc.io/arc/concepts/opt-in-privacy.md :29 "Privacy features are on the roadmap and not yet available on Arc." (C-64).
- K3 MC-03 vs CONTRACT §6.1 (:520-545), recomputed with Python bigint divmod → PASS 13/13 rows, with m·k + d = w for each row.
  - Extra values, p = 6 / p = 2: 13 wei → (0, 13) / (0, 13); 10¹²+7 → (1, 7) / (0, 1,000,000,000,007); 31,415,926,535,897,932,384,626 → (31,415,926,535, 897,932,384,626) / (3,141,592, 6,535,897,932,384,626).
  - uint256 max → p = 6 remainder 913,129,639,935, m > i64 max, so the :518 overflow guard must PAUSE. 2⁶³·10¹² → m = 2⁶³, the first value over the guard. :534's row is the largest w with m = 2⁶³−1.
  - wei→units: 1,234,567,890,123,456,789 → (1,234,567, 890,123,456,789), matching :545. 21,000 × 20 gwei = 420,000,000,000,000 (:532). 167,599 × 44 gwei = 7,374,356,000,000,000 (:533).
- K4 MC-10 keys recomputed against CONTRACT §1.3 (compact JSON of string arrays, SHA-256) → PASS.
  - K.recv(5042002, 0xab×32, "0", attempt "0") = arc1-970ee4c76bbeae19300510816cb88b62eb947aefe9baa8fac99ac454f3b0785b. That is 69 characters and equals contract R7's value.
  - `Ab` ≠ `ab`; `["a|b","reserve"]` ≠ `["a","b|reserve"]`; attempt "0" ≠ "1".
  - crId values: ("a","0") cr-401faa7ae9e8bc9facfafc42f579d569; ("a","1") cr-f44d5ef09dc9959791d061a74772a1bb; ("Z"×128,"0") cr-f61bf387095fd1b1216f039f582a307e; ("a:b","0") cr-86784d86… ≠ ("a","b:0") cr-d16694b5…; ("._:-"×32, "9"×40) cr-cf4b89ec6e9fcd0e476e267e8d2450e0. All are 35 characters and all match `^[A-Za-z0-9._:-]{1,128}$`. MC-10's "derived ID at maximum input length" clause holds.
- K5 Probe G arithmetic (:111) → PASS. A = 1,000 minor, p = 6, dropped from Rout without T4 → residual −1,000·10¹² = −10¹⁵ wei = −A·k.
- K6 Closure of R10 D1 (QUARANTINE in the enforcement domain) → PASS. :80(e) now reads "**The executor itself, the component that enforces its fail-closed action (PAUSE, QUARANTINE or other), and its paging path all sit outside the threat's compromise domain.** A detection of adapter compromise can't run in the adapter, report through it, or end in a QUARANTINE that the adapter enforces". Re-trace: R10's bad pre-CF-13 DR-23 (monitor detects, adapter-enforced QUARANTINE) now fails (e).
- K7 Closure of R10 D2 (global rules, interleavings) → PASS for events. :49(ii) "An event handled by a **stated global rule** … counts as that event's row in every state it covers, and is expanded like a delegation". :49(vii) "the results of every keyed operation still unresolved when the state is entered". Interleavings now cover "**any** §4 event … between the issue and the final result of **any** keyed effect … (postings, hold operations and their fallbacks, Decision calls)". :39 MC-04 has "an interleaving property test that injects every CONTRACT §4 event between the issue and the final result of every keyed effect". Re-run of R10's Probe F: CONTRACT :143 (§1.6 triggers for `HoldChanged`/`AccountStatusChanged`) and :147-148 (§1.7) now count as rows. **Operation results are not covered by the same rule; see C1.**
- K8 Closure of R10 D3 (MC-17 in Phase 1) → PASS. :55 is now "MC-17 (both)" with a "**Phase 1:** diff CONTRACT §5.0's match states against every §5 state in which signed bytes can exist; check that every outflow join in THREAT_MODEL and ADR-008 binds content". Sanity re-trace: CONTRACT :224-225 lists SIGNED, BROADCAST, CANCELLING, RET_SIGNED, RET_BROADCAST, RET_CANCELLING and PAUSED/QUARANTINED from these. Those are the states named in §5.4–§5.6, so the method is executable.
- K9 Closure of R10 D4 (proposal register) → FAIL in part. The register exists, with one row per proposal and a decision for each. Re-trace of its claims: see K11 and K12.
- K10 Closure of R10 D5 (signer-key trust anchor) → PASS. :82 "The signing key is trusted only through an anchor outside the repository that the agent can't write: the bank's identity directory, or the hosting platform's verified-key record for that person's account, read by CI at check time. A key or signer list that exists only inside the repository is not an anchor." R10's forgery (a throwaway key in a repo-local `allowed_signers`) now fails. Residual wording point: C4 (dismissed).
- K11 Register re-trace, row by row: each source line was read (report:line) and its "Landed in" text was located in RUBRIC → 37 of 40 PASS, 2 FAIL, 1 partial (dismissed).
  - PASS: rows 1–11, 13–17, 19–26, 28–40. Located text includes:
    - row 1: :39 "re-traced on re-entry after a partial movement, using the contract's literal amounts";
    - row 6: :49 "including the evidence it needs";
    - row 9: :49 "each split by correlation";
    - row 10: :49 "including cancels and replacements";
    - row 11: :50 "bounded by a stated retry horizon";
    - row 15: :80(b) "shared constants such as `k` are re-derived from their source";
    - row 20: :80 "named down to the fix block";
    - row 21: :80(f) "a CF item that is only an edit between Phase 1 documents needs no residual row";
    - row 23: :80(b) "Scope means the set over which the identity or join is closed";
    - rows 25 and 29: :80(e) "by category";
    - row 28: :55(b);
    - row 31: the not-adopted reason holds. MC-43 :83 marks a non-extractable quote UNVERIFIED with its Q-R, which fails no good document; Q-T8 (OPEN_QUESTIONS:103) confirms that Directive 9 is extractable and the POPIA PDFs are not;
    - rows 38 and 39: :80(c);
    - row 40: :85 "per sub-risk".
  - FAIL row 12 (risk-register-lensR-7:84): the proposal has two halves, and the second, "a detection that plants artefacts (canaries, honeytokens) names how each other detection excludes them", is not in MC-40(d). See C2.
  - FAIL row 18 (risk-register-lensR-9:91): "a named owner, **a cadence**, an existing input, and an action on a finding". The cadence is in no clause. See C3.
  - Partial row 27 (adr-008-lensR-4:118): the conditions "given separate identities and credentials, if the phase table says so" were dropped. See C5 (dismissed).
- K12 Register completeness against the reports queued before fix block 7 → FAIL. Every Probe G/F proposal in contract R6–R8, risk-register R7–R9, ADR-008 R2–R5, ADRs R7–R8 and threat-model R6–R7 has a row, except contract R7 Probe F (P1-contract-lensR-7.md:58). R10 C2 had explicitly cited that proposal ("also MC-11(i) for the §1.5 defaults"). `grep "contract-lensR-7:58"` in RUBRIC → 0. See C1.
- K13 MC-44 on the references fix block 7 introduced → PASS.
  - "contract R8 E4" resolves to P1-contract-lensR-8.md:43 (NOT_FOUND evidence).
  - "CONTRACT §1.6 or §1.7" resolves to CONTRACT :135, :146.
  - "U15" resolves to KICKOFF_PROMPT.md:147.
  - "ADR-001 for the signer" and "ADR-008 for the monitor" resolve to existing files.
  - The register's report:line pairs resolve to the quoted proposals (all 40 printed and read).
- K14 KICKOFF §3 exit bars → PASS.
  - 100% branch coverage → MC-07, with the Probe F rewording and the G1 human-ack flag (:123).
  - Mutation score ≥ 90% → MC-08.
  - Drift exactly 0 → MC-05.
  - 0 high SAST/SCA/secrets findings → MC-33.
  - Facts cited → MC-21/MC-43.
  - Matrix statuses → MC-42/MC-48.
- K15 CLAUDE.md coverage → PASS.
  - Non-negotiables: N1→MC-20/23; N2→MC-33; N3→MC-45; N4→MC-34; N5→MC-21/43; N6→MC-42.
  - Money invariants: I-INT→MC-01/02; I-CONV→MC-03; I-CONS→MC-04/05; I-ONCE→MC-10/14/18/24; I-FAIL→MC-05/11(vi)/17/18.
  - Arc facts→MC-15/16/21/22/23/32.
- K16 Probe G re-run on the current artefact → YES (C2, C3).
- K17 Probe F re-run on the current artefact → YES (C1).
- K18 Regression. No unit is frozen, so two substitutes were chosen as far as possible from the fix-block-7 edits (:39, :48-50, :55, :80-82, :85, :163, :174-222):
  - (a) MC-03 conversions vs CONTRACT §6.1 → PASS (K3).
  - (b) MC-15/MC-16/MC-22/MC-23 Arc constants (system emitter, 0x3600 at 6 dp, testnet chain ID 5042002, `-32012`/`-32014`, ≤9,999 blocks, 20 gwei floor) → PASS (K2). The text of :53, :54, :64 and :65 is identical to what R10 quoted.
- K19 JL-1..JL-6 → [inspection-only] PASS. Each is a one-line question tied to a CLAUDE.md or KICKOFF §6 duty. Unchanged.
- K20 ADR-specific rules (:90-94) → [inspection-only] PASS. Unchanged.

CANDIDATES (Lens A)
- C1 · Fix 7 extended the global-rule clause to events but not to operation results.
  - Evidence: RUBRIC.md:49 MC-11 "(i) every result of every CONTRACT §3 operation the state calls (OK, REJECTED per code class, CONFLICT, UNRESOLVED, …)". The global-rule clause is attached to (ii) only: "An **event** handled by a stated global rule … counts as that event's row". Method: "**Delegated rows** ('as §x', 'exactly as', 'same as') are expanded". CONTRACT.md:218 "Results not shown in a row follow §1.5: UNRESOLVED and CONFLICT → **PAUSE**. Fact REJECTED → **PAUSE**." Source proposal: P1-contract-lensR-7.md:58 "MC-11(ii) read as needing per-state rows for globally handled events, **and likewise MC-11(i) for the §1.5 UNRESOLVED/CONFLICT defaults that :198 imports**".
  - Criteria: KICKOFF §4 Probe F; RUBRIC :163 ("Every proposal processed since fix block 6 has one row … Fix block 7 processed every queued proposal").
  - **REAL (minor).**
  - Probe F, reconstructed: the MC-11 script builds each §5 state's (i) alphabet from the operations it calls. CONTRACT §5 rows list OK and the specific REJECTED outcomes. UNRESOLVED and CONFLICT are handled once, by :218, which is a section-level sentence, not a row containing "as §x". As MC-11 is written, :218 is neither a delegated row nor a global rule for events, so the script reports an empty UNRESOLVED and CONFLICT cell for every state that calls an operation. That fails a contract whose fail-closed default (PAUSE) is the correct handling (contract R6–R8 judged it so).
  - The proposal is also absent from the register, so the "processed every queued proposal" claim (:163, :174) is false for this item.
  - Fix: extend the clause to (i): "an operation result handled by a stated global rule (for example CONTRACT §1.5 defaults via §5 :218) counts as that result's row in every state it covers". Add a register row for contract-lensR-7:58.
- C2 · Register row 12 claims an adoption whose second half is not in the text.
  - Evidence: RUBRIC.md:192 register row 12 "Legitimate flows include other detections' scans; **planted artefacts name their exclusions** | Adopted (6) | MC-40(d)". MC-40(d) (:80) reads in full: "its healthy signal is specified, and it doesn't fire on legitimate flows, including other detections' own scans (for example, an outflow join must not PAUSE on internal moves or case returns; a blocklist probe must not report 'blocked' for an empty wallet)." `grep -i plant` matches only :36 (MC-01 lint) and :192 (the register row itself). `grep -i "honeytoken\|exclu"` finds nothing in MC-40. Source: P1-risk-register-lensR-7.md:84 "a detection that plants artefacts (canaries, honeytokens) names how each other detection excludes them."
  - Criteria: KICKOFF §4 Probe G; register fidelity (R10 D4 class).
  - **REAL (minor).**
  - Probe G, reconstructed: take a TM where DR-26 plants honeytoken registry rows and neither DR-26 nor DR-04/DR-23/DR-24 says how the scans exclude them (the pre-CF-11(a) state, RR R7 A2). Under (d), each detection's healthy signal is specified on its own, and DR-26 itself doesn't fire on another detection's scan. The failure is DR-04/DR-23 firing on a planted row, which is an artefact, not a "scan" or a "legitimate flow". A literal (d) passes it, and nothing requires the exclusion to be named. The current THREAT_MODEL already names the exclusion (CF-11(a), closed by threat-model Fix 3), but that is the TM's doing, not the rubric's.
  - Fix: add to (d) "a detection that plants artefacts (canaries, honeytokens) names how each other detection excludes them".
- C3 · Register row 18 drops the cadence from the proposal it records as adopted.
  - Evidence: RUBRIC.md:198 register row 18 "An [X] relied on for MC-41 meets MC-40 (c), (e), (f) | Adopted (7)". :80 "**An [X] detection that MC-41 relies on** must also meet (c), (e) and (f)." None of (c), (e) or (f) requires a cadence (`grep -i "cadence\|how often"` → 0). Source: P1-risk-register-lensR-9.md:88-91: "2d … and RB-7 … name nobody who watches, **how often**, or what happens on a finding … Patch: 'an [X] detection relied on for MC-41 meets MC-40 (c), (e) and (f): a named owner, **a cadence**, an existing input, and an action on a finding'".
  - Criteria: KICKOFF §4 Probe G; register fidelity.
  - **REAL (minor).**
  - Probe G, reconstructed: take RB-7 rewritten as "[X] Annual external audit of customer complaints; executor: Internal Audit; input: complaints register (owner: Customer Ops); action: PAUSE via a two-person instruction". (c) passes (the input exists and has an owner). (e) passes (a named executor outside the adapter domain; the inputs are listed). (f) passes (the action is specified). So the blind sub-risks 3a/3d/2e/2f "map to a valid [X]" under MC-41, although a compromised adapter can drain to the signer's daily limit every day for a year before the check runs. The proposer named "how often" as one of the three gaps, and the adoption keeps the other two.
  - Fix: add to the [X] clause "… and states its cadence; for a blind money sub-risk the cadence is no longer than the age of the matching §5.8 term or one daily-limit period", or record the cadence as not adopted with a reason.
- C4 · The MC-42 anchor doesn't say where the person→account binding comes from.
  - Evidence: RUBRIC.md:82 "the hosting platform's verified-key record for **that person's account**". The text doesn't say where the binding of "named human" to platform account comes from. If it came from an agent-writable file (for example GATES.md), the anchor would be indirect.
  - Criteria: CLAUDE.md N6; MC-40(b) principle.
  - **DISMISSED.** Exploiting it needs an external platform account with verified keys, operated by the agent. The agent holds no such credentials, and creating one is outside its sandbox and task. The R10 D5 forgery (repo-local keys only) is closed (K10). Advisory: say "that person's account, as recorded by the bank's identity directory or org membership managed by bank admins".
- C5 · Register row 27 drops the proposal's testnet conditions.
  - Evidence: RUBRIC.md:207 register row 27 "Monitor/adapter separation is phase-scoped | Adopted (6)". :80(e) "The monitor/adapter separation applies to pilot and GA, not to a shared testnet host." Source P1-adr-008-lensR-4.md:118 adds "Testnet may co-locate, **given separate identities and credentials, if the phase table says so**."
  - Criterion: register fidelity.
  - **DISMISSED.** The proposal's substance (phase scoping) landed. The dropped conditions only constrain testnet, which carries no value (CLAUDE.md N1, testnet only), and (e) applies in full to pilot and GA, where the money risk is. No bad pilot or GA design passes because of it. Advisory: restore the two conditions so the testnet attestation path is representative.
- C6 · CONTRACT's HoldChanged trigger doesn't name its states.
  - Evidence: RUBRIC.md:49(ii) "a **stated global rule** (a rule that names the event **and the states it applies to**…)"; CONTRACT.md:143 "Triggers for QUARANTINE: … a `HoldChanged` the adapter didn't cause". This trigger names no states.
  - Criterion: KICKOFF §4 Probe F.
  - **DISMISSED.** CONTRACT :147 scopes §1.7 to "all of §5", and :148 states the §1.6 triggers are "Never held", so the scope is stated (every state). A literal script reading :143 together with :147-148 finds the coverage, and the current CONTRACT doesn't fail. Advisory only.
- C7 · Two queued rows postdate fix block 7.
  - Evidence: LEDGER.md queue rows "P1-threat-model-lensR-8 …" and "P1-adrs-lensR-9 …" (added 12:24:19). P1-adrs-lensR-9.md:144-147 Probe F: "'Thresholds and caps are checked at the boundary (value = threshold, ±1 base unit)' … ±1 wei is an unreachable move amount"; that is a near-miss Probe F against MC-45 :85.
  - Criterion: KICKOFF §4 Probe F.
  - **DISMISSED** as a defect of this version. Both reports postdate fix block 7 (12:11:07 and after 12:14:31), and both are in the queue, so under :163 they are not defects of this version. They do block freezing until processed (:163 "can be frozen only with an empty queue").

DEFECTS
- D1 · docs/RUBRIC.md:49 MC-11(i) and register (:176-220, no row for contract-lensR-7:58) · Lens R / KICKOFF §4 Probe F; :163 completeness · minor.
  - Problem: the global-rule expansion was added for events (ii) but not for operation results (i). CONTRACT :218 handles UNRESOLVED/CONFLICT by a §1.5 global rule, so MC-11's script reports empty cells on a correct contract. The proposal (contract R7 Probe F, :58) has no register row.
  - Fix: extend the global-rule clause to (i), and add the register row.
- D2 · docs/RUBRIC.md:80 MC-40(d) vs register row 12 (:192) · Lens R / KICKOFF §4 Probe G; register fidelity · minor.
  - Problem: "planted artefacts name their exclusions" is recorded as adopted but is absent from the text.
  - Fix: add the sentence to (d).
- D3 · docs/RUBRIC.md:80 [X] clause vs register row 18 (:198) · Lens R / KICKOFF §4 Probe G; register fidelity · minor.
  - Problem: the proposal's cadence requirement was dropped without a recorded decision, so a rarely-run [X] covers a blind money sub-risk under MC-41.
  - Fix: require a stated cadence for an [X] that MC-41 relies on, or mark that part not adopted with a reason.

VERDICT: NEGATIVE (3 defects: 0 blocking, 3 minor)

Note for the operator: fix block 7 closed all five R10 defects (K6–K10). No conversion, key or Arc-constant check regressed (K2–K4, K18). What remains is in the new proposal register: 37 of 40 rows re-trace exactly, two rows record more than the text contains (D2, D3), and one queued proposal never got a row (D1). The next fix block should re-trace each row against the source report line (every clause of the proposal, not its first sentence) before writing "Adopted". This was grace round 1 of 2. The two post-fix-7 queue rows (TM R8, ADRs R9) must be processed before the rubric can freeze. The MC-07 Probe F rewording still needs human acknowledgement at G1.

Phase 1 · units frozen 0/11 · streak 0/3 · rounds used 10/10 + grace 1/2 (P1-rubric) · regen budget left 1
