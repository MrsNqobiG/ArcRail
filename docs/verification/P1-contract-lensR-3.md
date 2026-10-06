VERIFICATION · lens: R · target: P1-contract (docs/CONTRACT.md v2, reframed) · commit: none (no commits in repo; working tree, CONTRACT.md sha256 5cdf0e8ead10628d401334c13cc186bb49242d96e52aa877b6a1c3ad38d41030, 2026-10-02)

Criteria (docs/RUBRIC.md does not exist yet): KICKOFF_PROMPT.md §5 Phase 1 item 1; CLAUDE.md non-negotiables and money invariants; docs/discovery/cbs-port-requirements.md (P1-P11); docs/constants.md (C-xx); docs/THREAT_MODEL.md. Caveat: per LEDGER G0, these Phase 0 criteria documents are themselves unverified.

CHECKS:
Prior Lens R-2 defects, each re-checked against v2:
- N1 createCase key lacks round → PARTIAL. K.case now has `round` (:53). Recomputed: SCREENING_HIT keys for round 0 and 1 differ. But :58 fixes round at "0" for non-screening reasons, and STANDING_INELIGIBLE recurs after RELEASE (:183, :186, :187). Recomputed: the two keys are identical. → new defect E3
- N2 hold expiry vs unbounded T5 → PASS. :122 "The hold has no expiry ... An expiring hold is never acceptable". Residual traceability drift: see E16
- N3 post-finality REJECTED → PASS. Fact class (:89), T1 REJECTED → PAUSE (:179), T4 REJECTED → PAUSE (:229), T9 (:249), batches (:262), T6 (:255). Rin, Rout and Rmove each have an A_post age (:295-297)
- N4 getResultByKey REJECTED / repeated AMBIGUOUS → PASS (:79, :80)
- N5 mint row → PASS. :166 quote re-fetched verbatim at usdc-system-events.md l.71 "* **Mint:** `Transfer(0x0, recipient, amount)`". A mint to a customer now routes through §5.1
- N6 hold excludes fee → PASS (:197, :208)
- N7 §7 omits Q-C6/Q-C10 → PASS (:356, :360)
- N8 repeat RETURN collides → PASS for uniqueness (:247, dispositionSeq). New length defect: see E10
- N9 dust per role → PASS (D[walletRole], :260)
- N10 pipe shorthand → PASS (no pipe-joined keys remain; only the explanatory sentence at :37)
- CF-1 checkerAssertion folded in → PASS (:130). Encoding gap: see E17

Rubric (KICKOFF Ph1.1, CLAUDE.md), by reconstruction:
- K1.1 every call/event has a schema → [inspection-only] PASS. Recounted: 16 ops in §3, 7 names in §4
- K1.2 keys → recomputed key(["arc1","in","5042002",0x+ab*32,"0","recv"]) = arc1-860c82bc…3cc2, length 69 → PASS. Case-sensitivity ("Ab" vs "ab") and pipe-in-ID keys differ → PASS. Uniqueness across repeated events → FAIL (E3). Key inputs defined for every subject → FAIL (E15). Method note: Python json.dumps(sort_keys, compact) is equal to JCS only for ASCII strings. All key inputs are regex-constrained ASCII, so the result holds
- K1.3 error semantics → PARTIAL. 4 results, 12 REJECTED codes, unknown code → AMBIGUOUS, and the AMBIGUOUS sub-machine always terminates (re-traced: retry → getResultByKey → at most one final call → UNRESOLVED). FAIL on the internal contradiction for Notification UNRESOLVED (E4) and the unhandled simulation result (E11)
- K1.4 GL roles: customer liability G1, treasury G2, gas G3, suspense/dust G4, clearing G5 present, plus G6 and G7 → PASS for coverage. FAIL on the naming rule (E6)
- K1.5 unit mapping, recomputed with exact integer // and %:
  p=6 (k=10^12): 0→0 r0 · 1→0 r1 · 999,999,999,999→0 r999,999,999,999 · 10^12→1 r0 · 10^18→1,000,000 r0 · 1,000,000,500,000,000,000→1,000,000 r500,000,000,000 · 21,000×20×10^9=420,000,000,000,000→420 r0 · 7,374,356,000,000,000→7,374 r356,000,000,000 · (2^63−1)·10^12+(10^12−1)→9,223,372,036,854,775,807 r999,999,999,999 → 9/9 PASS. +1 wei past that gives m=2^63, which overflows, so the stated maximum is tight. Extra: uint256 max → m≈1.16×10^65, which trips the overflow guard (:317); 3 wei → 0 r3
  p=2 (k=10^16): 10^18→100 · 1.5×10^16→1 r5×10^15 · 10^16−1→0 r(all) · 7,374,356×10^9→0 r(all) → 4/4 PASS
  wei→USDC_UNITS 1,234,567,890,123,456,789→1,234,567 r890,123,456,789 → PASS. i64 capacity (2^63−1)/10^p = 9.22 / 9.22×10^12 / 9.22×10^16 → PASS
- Live gas row re-fetched 2026-10-02 from https://rpc.testnet.arc.io eth_getTransactionReceipt 0x0e8279a4…24695: status 0x1, gasUsed 167,599, effectiveGasPrice 44,000,000,000 → 7,374,356,000,000,000. Log 0 from 0xffff…fffe = 9,176,065,000,000,000,000; log 1 from 0x3600… = 9,176,065 (ratio 10^12) → PASS
- Chain identity §5.6, simulated numerically over 12 steps: customer inbound detect/T1/T2, dust-only 3 wei, payout with fee 250 (status 1, T4), status-0 gas, gas batch, k−1 dust plus dust batch, bank-owned T1+T8. Residual 0 at every step. CBS identity G2+G3 = G1+G4+G5+G6+G7 held 0 at every step. G7 ≥ G3 held → PASS
- CBS template effect table (:274-286) re-traced for T1, T2, T3fb, T4, T4fb, T5fb, T6, T8, T9, unid, gas, dust: each moves both sides equally → PASS
- payloadHash recomputed: JCS of {amountWei:"10^18", asset:"USDC", chainId:"5042002", destination:0x11…11, instructionId:"P1"} → f0585e32…27af. Deterministic → PASS
- C-01 re-fetched rpc-endpoints.md l.64 "| **Chain ID (Testnet)** | `5042002` |" → PASS. N1: whole file read, the only chain-ID literal is 5042002 (:29) → [inspection-only] PASS
- C-10/C-13 evm-differences.md l.81, l.83; C-22/C-24/C-25 usdc-system-events.md l.39, l.78-79, l.130; C-54 evm-differences.md l.121 → PASS (re-fetched 2026-10-02)
- Precompile citation :140 "Sending value to a precompile address reverts", https://docs.arc.io/arc/references/evm-differences.md → FAIL. Not on that page. Not anywhere in https://docs.arc.io/llms-full.txt (1,585,617 bytes, fetched 2026-10-02); "precompile" appears 48 times, never with this sentence. Not in constants.md (E1)
- I-INT (string amounts, regex :18) → PASS. I-CONV (only U1 converts, :25, :307) → PASS
- I-FAIL → PARTIAL. Fact REJECTED → PAUSE and recon terms have age limits → PASS. The :11 claim "Every pending item has a maximum age" → FAIL (E8)
- P6 compliance hooks per inbound class → FAIL (E2)
- N3 (:5) → PASS. P9.1 / no PII (:28, :120, :133) → [inspection-only] PASS
- §7 open items: 16 listed (recounted), all present and OPEN in OPEN_QUESTIONS.md (incl. Q-C17, Q-R8) → PASS

CANDIDATES (Lens A form):
E1 · CONTRACT.md:140 "`INVALID_DESTINATION` (... or a precompile, which the docs say reverts: \"Sending value to a precompile address reverts\", https://docs.arc.io/arc/references/evm-differences.md)" · CLAUDE.md N5 and "cite it in docs/constants.md"; KICKOFF §3 "every Arc ... fact cited, or listed in OPEN_QUESTIONS" · REAL · The quoted sentence could not be re-derived from the cited page or from the docs full text. It is presented as a verbatim quote, so it is an invented citation. The rejection itself is conservative, but the behaviour claim, and which addresses count as a precompile, are unverified and belong in OPEN_QUESTIONS.
E2 · CONTRACT.md:180 "RECEIVED | `to` is bank-owned | T8 `postJournal DR G5.inbound m · CR G7 m` (`K.avail`) | → AVAILABLE" and :181 (unidentified: `K.unid` plus createCase only); only :177 and :185 call `screen`/`K.mon` · P6.1 "Called (a) before inbound funds become available"; P6.3 "the adapter sends **every** inbound and outbound movement"; KICKOFF U6 "screening before funds are made available"; CLAUDE N5 · REAL · External funds to a bank-owned wallet become available (G7) with no sanctions/TFS screen and no monitoring event. Unidentified inbound is not screened or monitored either. No OPEN_QUESTIONS entry records an exemption, so the contract quietly assumes one. A forged bank-owned registry flag (THREAT_MODEL T-T2) would also route funds around screening.
E3 · CONTRACT.md:58 "For cases that aren't about screening, `round` is `\"0\"`." with :183 "standing not eligible | `createCase STANDING_INELIGIBLE`", :186, :187 "r = r + 1, then re-run the RECEIVED row"; also :218/:237 TRAVEL_RULE_INCOMPLETE · I-ONCE · REAL · Recomputed: the second STANDING_INELIGIBLE key after a RELEASE equals the first. With the same payload the CBS returns the old, already-disposed caseId (P1.2), and the item waits in HELD_IN_CLEARING. That state has no adapter age (:190, :303), so it is stranded without a page. With a different payload the result is CONFLICT → PAUSE.
E4 · CONTRACT.md:91 "Notification ... `REJECTED` or `UNRESOLVED` → page Compliance ops" vs :83 "`CONFLICT` and `UNRESOLVED` always mean **PAUSE and page**" and :159 · K1.3 error semantics (internal consistency) · REAL · Two incompatible rules. In addition, createCase REJECTED at :184 leaves an item in HELD_IN_CLEARING with no caseId, so no CaseDisposition can ever arrive.
E5 · CONTRACT.md:198 "T4 | settleHold → `DR G1 (A+fee) · CR G2.hot A · CR G6 fee`", :201 "`fee = 0` unless Q-C8 says otherwise" vs :120 "No zero-amount legs" and :73 `ZERO_AMOUNT`; G6 is "conditional, Q-C8" (:106) · I-CONS, K1.3 · REAL · Read literally, with the default fee=0, every T3/T4/T5 carries a zero G6 leg, or a leg to an account that doesn't exist. T4 is a Fact op, so every payout would be REJECTED after finality and PAUSE the rail. Needs "omit fee legs when fee = 0 / G6 absent".
E6 · CONTRACT.md:102 "`gl.treasury.<walletRole>` | ... | `hot`, `gas`, `depositAddr`" vs :97 "None of the names may contain \"deposit\"" · KICKOFF §8 (never label USDC as deposits in ledger names) · REAL · The config/GL key `gl.treasury.depositAddr` contains "deposit".
E7 · CONTRACT.md:141 PayoutOutcome states include "PAUSED"; rows :225 "APPROVED | not eligible | T5 | RELEASED", :230 (status 0), :232 (cancel final), :236 (RETURN) emit no PayoutOutcome, and no row emits PAUSED · K1.1 events with semantics · REAL · On these paths the CBS never learns the instruction's outcome. The PAUSED enum value is never produced.
E8 · CONTRACT.md:11 "Every pending item has a maximum age (§5.7)" vs §5.7 table :293-301 (covers DETECTED, Rout, Rmove, D/F, AWAITING_APPROVAL, standing, BROADCAST) · I-FAIL · REAL · ACCEPTED, RESERVED, APPROVED, SIGNED, RECEIVED and PROPOSED have no age. A stalled RESERVED holds customer funds indefinitely without a page.
E9 · CONTRACT.md:248 "The §5.3 states from RESERVED onwards ... A failed check opens a case and returns the item to HELD_IN_CLEARING" (RESERVED includes "standing not eligible", :217); :247 "R ≤ the G5 amount still held"; :181 "→ SUSPENSE" with no SUSPENSE rows · I-FAIL / completeness of flows · REAL · (a) A RETURN for an inbound held as STANDING_INELIGIBLE re-checks the same ineligible standing and loops back to HELD_IN_CLEARING. (b) Unidentified funds in G4 have no disposition rows and no return path, because §5.4 draws only from G5. (c) After T9 OK the next state is unspecified, and the remainder "`⌊W/k⌋ − R`" (:249) is wrong after a second partial return.
E10 · CONTRACT.md:247 "`instructionId = \"case:\" + caseId + \":\" + dispositionSeq`" vs :32 regex `^[A-Za-z0-9._:-]{1,128}$` (caseId alone may be 128) · I-ONCE · REAL · Recomputed: a 128-char caseId with seq "12" gives a 136-char ID, which fails the contract's own regex, and no action is defined.
E11 · CONTRACT.md:217 "RESERVED | policy DENY, standing not eligible, simulation revert" vs constants C-57 "returns **JSON-RPC error `-32603` \"Blocked address\"**, not an EVM revert" · K1.3, I-FAIL · REAL · The most likely simulation failure (blocklisted destination) is not a revert and has no row.
E12 · CONTRACT.md:170 "A `to` address that isn't bank-controlled isn't ours, so the log is ignored." vs :167 "bank-controlled | external | outbound ... **No match → PAUSE**" · THREAT_MODEL T-E2 detection, RR-3 · REAL · Read literally, :170 ignores every outbound log and disables the T-E2 outflow match. It should say "neither `from` nor `to`".
E13 · CONTRACT.md:143 "→ **PAUSE** that instruction", :148 "the affected account or instruction is PAUSED" vs :158 "\"PAUSE\" always means ... stop outbound signing for the whole rail" · internal consistency · REAL · The scope of PAUSE is defined two ways.
E14 · CONTRACT.md:144 "`ScreeningOutcome` ... Resolves `REVIEW`" vs :184/:218 "screen HIT or REVIEW → createCase" · K1.1 · REAL · No flow row consumes ScreeningOutcome, so the event's semantics are undefined.
E15 · CONTRACT.md:59 "`subjectRef` is ... `[\"in\",…]`, `[\"out\",instructionId]` or `[\"recon\",cutoff]`" vs createCase reasons PENDING_AGE/RECON_DRIFT for Rmove items, D/F batches and moves (:126, :291) · I-ONCE · REAL · K.case can't be derived for move or batch subjects. The format of `cutoff` (block number vs journal cut-off) is also unspecified.
E16 · CONTRACT.md:122 "An expiring hold is never acceptable (P3.4)" and :372 vs cbs-port-requirements.md:54 P3.4 "or an expiry the adapter can configure that is longer than ..." · traceability · REAL · The contract is stricter than the requirement it cites. P3.4 (cross-unit) needs updating so the two agree.
E17 · CONTRACT.md:130 "WebAuthn/FIDO2 assertion by the checker whose challenge is `payloadHash`" with :61 defining payloadHash as lowercase hex · P7.1 determinism · REAL (fails closed) · It is not specified whether the challenge is the 32 raw bytes or the 64 ASCII characters. Two conforming implementations would disagree, and the signer would then refuse and PAUSE.
X-a · K.appr reuse when re-entering RESERVED · I-ONCE · DISMISSED · Re-entry to RESERVED is only from HELD_FOR_CASE (:234, :237), which comes before approval. Every AWAITING_APPROVAL exit is terminal or forward (:220-223).
X-b · SIGNED row :227 has no branch for a broadcast rejected by RPC · I-FAIL · DISMISSED · The item still enters BROADCAST, then F4 at T_pending, then A_stuck = 30 min → PAUSE (:301). It fails closed.
X-c · PayoutOutcome eventId not derived from business IDs · I-ONCE · DISMISSED · It is emitted "from the adapter outbox" (:141). The row and its eventId are persisted once and redelivered unchanged.

Probe G (would these criteria pass a bad contract?): yes, again. KICKOFF Ph1.1 passes this artefact despite an invented docs quote (E1) and a screening bypass (E2). Add to RUBRIC.md: (a) every inline docs quote in any spec is re-fetched verbatim, with URL and date, or it fails; (b) a coverage matrix of inbound/outbound class × {screen, monitor, case}, each cell either filled or backed by a Q-xx; (c) every event enum value has at least one emitting row; (d) every state of every machine has either an age or an explicit "unbounded, owner X"; (e) every key's inputs are defined for every subject kind and fit the ID grammar; (f) every template leg is valid at the default config (fee = 0, optional GLs absent).
Probe F (would they fail a good contract?): yes, in one place. CLAUDE.md "cite it in docs/constants.md" would fail a good contract that quotes the docs inline with a URL (e.g. the correct mint quote at :166), because that quote is not a constants.md row. Word it as "re-derivable verbatim from a primary source, inline or in constants.md".

Regression check (LEDGER shows no frozen units). Instead I re-derived the two areas furthest from the reframe's edits (§1.5 and §5 tables): §6 unit mapping (14/14 rows plus live receipt) → PASS; §2 GL roles with §5.6 template effects and a numeric identity simulation → PASS (the naming defect E6 is new in this reading).

DEFECTS:
- E1 · CONTRACT.md:140 · R / N5, constants citation · invented docs quote for precompile revert · blocking
- E2 · CONTRACT.md:180-181 · R / P6.1, P6.3, N5 · bank-owned and unidentified inbound skip screening and monitoring, with no Q-xx · blocking
- E3 · CONTRACT.md:58 · R / I-ONCE · STANDING_INELIGIBLE (and travel-rule) case key collides across rounds · minor
- E4 · CONTRACT.md:83/:91/:159 · R / K1.3 · Notification UNRESOLVED: PAUSE vs page-only; createCase REJECTED leaves a case-less hold · minor
- E5 · CONTRACT.md:198-201 · R / I-CONS, K1.3 · zero or absent G6 leg at default fee = 0 → REJECTED after finality · minor
- E6 · CONTRACT.md:102 · R / KICKOFF §8 · `depositAddr` in a GL key · minor
- E7 · CONTRACT.md:141, :225/:230/:232/:236 · R / K1.1 · PayoutOutcome missing on 4 RELEASED paths; PAUSED never emitted · minor
- E8 · CONTRACT.md:11 vs :293-301 · R / I-FAIL · six states have no maximum age · minor
- E9 · CONTRACT.md:247-249, :181 · R / I-FAIL · case-return loop for ineligible standing; no SUSPENSE exit; T9 next state and remainder undefined · minor
- E10 · CONTRACT.md:247 vs :32 · R / I-ONCE · derived case instructionId can exceed 128 characters · minor
- E11 · CONTRACT.md:217 · R / C-57 · "Blocked address" simulation error unhandled · minor
- E12 · CONTRACT.md:170 · R / T-E2 · ignore rule contradicts the outbound row · minor
- E13 · CONTRACT.md:143, :148 · R / consistency · PAUSE scope · minor
- E14 · CONTRACT.md:144 · R / K1.1 · orphan ScreeningOutcome · minor
- E15 · CONTRACT.md:59 · R / I-ONCE · subjectRef undefined for moves and batches; cutoff format · minor
- E16 · CONTRACT.md:122 vs port-reqs P3.4 · R / traceability · cross-unit drift · minor
- E17 · CONTRACT.md:130 · R / P7.1 · WebAuthn challenge encoding unspecified · minor

VERDICT: NEGATIVE (17 defects: 2 blocking, 15 minor). Prior R-2 blocking defects N2 and N3 are resolved, and N4-N10 are resolved. N1 is only partly resolved (now E3).
