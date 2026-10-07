VERIFICATION · lens: R · target: docs/NOVA_ARC_DESIGN_DELTA-1.md · commit: 2777414 (target tracked and unmodified at HEAD; pinned by sha256 prefix: DELTA-1 cf6f4f81303b60b9, KHUMO_ANSWERS 654f5f464684c3c0, NOVA_ARC_DESIGN d820d43d00644b86 = the R4-frozen hash)

Verifier: independent verifier subagent, 2026-10-07. Round 1 of the delta.

Judged against:
- docs/KHUMO_ANSWERS.md: each delta must follow from a quoted answer, never weaken a CLAUDE.md money invariant, keep D1 frozen, and be implementable behind ports with two fakes each;
- docs/NOVA_ARC_DESIGN.md (D1, frozen at R4, LEDGER.md:20);
- CLAUDE.md:24-32 (money invariants);
- docs/constants.md;
- the archived DFNS pages under docs/sources/dfns/.

Safety:
- No DFNS, Circle or VALR API was called. Nothing was signed or sent, and no network was touched. No .env file was read. No live re-fetch was made [archive-only].
- Scratch was a mkdtemp dir, `/tmp/verify-delta1-lJdHHI`, holding real-file copies (`find -type l` = 0). Node came from `.tools/node/bin` (v22.23.3).

## CHECKS

### Mechanical
- `npx tsc --noEmit` (repo-wide) → PASS. Exit 0, no diagnostics, 56 s.
- MC-01 float lint, `node tools/lint-money-floats.mjs` → PASS: "40 money-path files, 0 finding(s)".
- Semgrep, the pinned JS+TS rule sets (203 rules), over `src/journey/quote` + `src/nova-ports/conversion.ts` (the code D-1 rewrites) → PASS: 0 findings. The target itself is Markdown with no code files.
- Target tests → N/A. The delta is design text and has no tests yet. Baseline for the FX code D-1 replaces: `jquote-ports`, `jquote-compose`, `jquote-fakes`, `ports-conversion.contract` → PASS (4 files, 177 tests).
- Stryker → N/A. The target has no source files, and the only candidate code (`src/journey/quote/*`) is uncommitted work under active edit by other agents (git status `M`), so a score would not measure the target. Instead I planted my own mutants in /tmp copies (below). The full ci.sh was not run, as instructed.
- gitleaks on the target → PASS ("no leaks found").
- Grep of the target for secrets, tokens, 64-hex values, "mainnet" and chain 5042 → PASS: no hits. The text restates "testnet only" at :5.
- DFNS archive integrity → PASS. sha256 of `api-reference_idempotency.md` (51952fbf…), `api-reference_wallets_abort-transfer.md` (3dba876e…), `api-reference_wallets_list-transfers.md` (6ffd2d54…) and `guides_developers_create-transfers.md` (cfa4c413…) each equals its MANIFEST row (MANIFEST.md:198, 205, 215, 229).
- D1 frozen → PASS for the file. Its sha256 prefix d820d43d00644b86 is identical to the one pinned in NOVA-design-lensR-4. The content conflicts are under DEFECTS (B3, B4).

### Planted mutants (reconstruction, /tmp copies of `src/journey/quote/ports.ts`, `src/nova-ports/{conversion,ids}.ts`, `src/amounts/index.ts`, `src/network/types.ts`, compiled with the repo's tsc)

Rate and amount recomputed by hand. The request is ZAR 100000 cents FROM_EXACT, at a code rate of 10000/18 micro-USDC per cent.
- The convertible step is 18/gcd(10000,18) = 9.
- 100000 mod 9 = 1, so the remainder is 1 cent.
- to = 99999·10000/18 = 55,555,000 micro-USDC (55.555 USDC).
- `checkFxLock` → null (honest). Output: `honest 55555000n 1n null`.
- Boundary: 1 cent gives to = 0, which is refused ("nothing converts"). 9 cents gives 5,000 micro-USDC with remainder 0.

Mutants:
- **M1.** The human fills at 550/1 instead of 10000/18 (1 % worse), self-consistent: to = 55,000,000 and remainder 0.
  - `checkFxLock` returns **ACCEPTED**. The identity check cannot see a rate change.
  - Cross-multiplying against the code rate (550·18 ≠ 10000·1) catches it.
  - Under the delta's `FILLED{ bookedEntryRef, filledAmount }` there is no rate field, so that comparison cannot be made, and `filledAmount = 100000` → **ACCEPTED**.
  - The delta's own test list (:22-27) has "a fill amount that differs" but no "a fill at a different rate" test, so M1 survives the listed tests.
- **M2.** The from side is over-debited (101000 cents) while the to side equals the quote. `checkFxLock` refuses it ("quote does not keep the from amount exact"). Under the delta shape, if `filledAmount` is the to side → **ACCEPTED**.
- Both feed B1.

### Lens R items applied to a design delta
- **"Follows from a quoted answer"** → PASS for every delta's existence:
  - D-1 → 32, 33, 34 (KHUMO_ANSWERS:41-43);
  - D-2 → 29, 37 (:38, :46);
  - D-3 → 35 (:44);
  - D-4 → 28, 30 (:37, :39);
  - D-5 → 17 (:26);
  - D-6 → 27, 28 (:36-37).

  Details not sourced from any answer are listed in m3 and m6.
- **Never weakens a CLAUDE.md money invariant** → FAIL:
  - B3: the two-person control and the exactly-once rule on operator money actions;
  - B4: the double-send proof standard.
- **Keeps D1 frozen** → FAIL in content (B3, B4, m1). The delta says "every such change is listed below" (:3), and none is listed.
- **Implementable behind ports with two fakes each** → FAIL in part:
  - B2: the authenticity and dedupe contract of the new inbound events is unspecified;
  - B5: the consent check has no port;
  - m4: fakes are named only for FxPort.
- **MC-01 / integers** → PASS [inspection-only]. "rate (integer ratio)" is at :16, and no float appears in the target.
- **MC-04 (templates balance)** → FAIL (minor, m5). New REFUND, WRITE_OFF and requote postings have no templates to re-trace.
- **MC-10 (deterministic keys)** → FAIL: `getPricingCode` has no key (m7), and `RETRY_AS_NEW_PAYMENT` has no key (part of B3).
- **MC-11 / MC-12 (every state × outcome; max age)** → FAIL:
  - B1(b): a late fill after a requote;
  - m8: the timeout value for "fill never arrives" is not specified.
- **MC-19 (two-person unpause)** → PASS. :49 restates D1 :95/:511.
- **MC-21 / DFNS facts re-checked in the archive:**
  - "accepted abort" → PASS: abort-transfer.md:7 "Aborts a transfer that is currently in 'Executing' status and has not yet been signed".
  - "never retried blindly" → PASS: create-transfers.md:206 "Never submit a second Transfer Asset request to 'retry' a transfer that has not reached a terminal status".
  - "a DFNS lookup by `externalId`" as proof → **FAIL** (B4).
  - No Arc constant is used by the delta.
- **Fail closed:**
  - D-5 gas and dust: an account that must be set, with startup failing closed (:80-81) → PASS.
  - D-3, no consent → hold and case (:59) → PASS.
  - D-1, a fill that never arrives → case (:27) → PASS.
  - A fill that is refused but already booked → FAIL (B1).

## DEFECTS

### B1 · NOVA_ARC_DESIGN_DELTA-1.md:17, :19, :22-27 (D-1) · money correctness / exactly once · **blocking**

Evidence:
- :17 `awaitFill(codeId) → FILLED{ bookedEntryRef, filledAmount } | REJECTED | EXPIRED`
- :19 "When a fill arrives after expiry, or at a different amount or rate than quoted, it creates a **requote case** (D-2) instead of being accepted."
- KHUMO_ANSWERS:42 (answer 33) says the human fills in the OTC desk UI and "backend books general entries".

The defect has three parts:
- **(a) The required check cannot run.** FILLED carries one amount and no rate, no from/to pair, no remainder and no codeId echo. So the rule at :19 ("different … rate") cannot be applied. Neither can the exact integer identity that the current FxPort enforces (`checkFxLock` / `checkQuote`, src/nova-ports/conversion.ts:70-78). Mutants M1 and M2 above are both ACCEPTED under the delta shape. Nor does the delta say that `bookedEntryRef` is read back through LedgerPort to confirm that the booked journals balance and equal the code. A misposted fill (client over-debited, or credited at a worse rate) is accepted, and the Arc leg then sends against it.
- **(b) A refused fill is already booked, and nothing owns it.** The fill is booked by Nova before the event reaches us (answer 33). "Instead of being accepted" therefore leaves a booked fiat→USDC conversion that no journey owns. The delta specifies:
  - no compensating (reversal) posting (answer 18 requires reversal postings);
  - no rule that the requote must consume the already-filled conversion rather than ask for a new one.

  So a late fill that arrives after the timeout case has been REQUOTEd produces **two** booked conversions for one payment. That is a double count of the client's fiat. The delta also does not say which timestamp decides "after expiry": the fill time in Nova, or the arrival time at the package. Delivery latency alone can therefore refuse a fill that was valid when it was made.
- **(c) The tests miss both.** The test list has no rate-mismatch test (M1) and no late-fill-after-requote test.

Required:
- FILLED carries codeId, pair, from amount, to amount, rate and remainder, each checked exactly against the code;
- `bookedEntryRef` is verified through LedgerPort;
- a refused-but-booked fill goes to a defined path (case plus reversal posting, or adoption by the requote) with a named authoritative timestamp;
- tests cover a rate mismatch and a late fill after a requote.

### B2 · :17, :57 (D-1 FILLED; D-3 pay-in event) · inbound authenticity and dedupe (CLAUDE.md:29) · **blocking**

Evidence:
- :17 "delivered as a signed, deduplicated event through the port";
- :57 "delivered through `PayInPort` as a signed, deduplicated event that carries `bookedEntryRef` and the reviewer".

What is missing:
- **No verification method.** No signature scheme, no verify method (compare D1 `PayoutPartnerPort.verifyCallback(rawBody, headers)` at NOVA_ARC_DESIGN:684 with its open question Q-N12), and no open question for the scheme. The answers show that no such event exists in Nova today (answers 33 and 35).
- **No dedupe definition.** There is no dedupe key, no §10.3 projection, and no `InboundSignal.source` value: D1 :476 has no pay-in source.
- **One fill per code is not enforced.** "Deduplicated" read as event-id dedupe lets a **second, distinct** FILLED for the same `codeId` through: two humans filling one code is plausible for a manual desk. A second distinct pay-in confirmation for one expected pay-in gets through the same way. The delta must state that at most one fill per codeId, and one pay-in confirmation per expected pay-in, is accepted, and that a differing second one is `SIGNAL_CONFLICT` → QUARANTINE. The listed test "a duplicate fill event" (:26) covers only redelivery of the same event.

As written, an implementer must invent the authenticity and dedupe identity of two money-moving signals.

### B3 · :39-52 (D-2) versus NOVA_ARC_DESIGN:515-516, :548-557, :1041, :939, :1087 · weakens D1 controls; parallel system; exactly once · **blocking**

Evidence:
- :49 "`WRITE_OFF`, unpausing the rail and releasing a QUARANTINE need **two different humans**". By implication REFUND, REQUOTE, ACCEPT_WITH_CONSENT and RETRY_AS_NEW_PAYMENT need only one.

What D1 (frozen) says:
- every `OperatorDecision` carries `approvers: readonly [string, string]` ("two DISTINCT authenticated staff identities", :556), and the store refuses `SAME_APPROVER` (:557, :1041);
- "Until [CF-31] closes, **no** decision-entry path is built, and every case that needs a decision stays QUARANTINED or PAUSED (fail closed)" (:1041);
- releases such as P6 and P11 after a submit marker require proofs or two-person decisions (:939, :945);
- the case store and its closed kinds already exist: `CaseRecord`, `putCase`, `UNRESOLVED_SUBMIT` (:529-530, :597-605).

What D-2 does:
- adds `src/ops/**` with its own case queue and actions, without reference to these records or to CF-31. That is a parallel case system (CLAUDE.md:3 "never build a parallel system"), and it opens a decision-entry path that D1 forbids until CF-31 closes.
- makes REFUND, which releases a payer's funds, a single-human action.
- does not forbid REFUND on an `ARC_TRANSFER` leg that is UNRESOLVED (submit marker set, no DFNS entity known) or not yet proven never sent, and it lists "an unresolved DFNS submission" (:37) as a case that REFUND may act on. A REFUND posted by `src/ops` rather than as P6 through `applySignal` also bypasses the store's `LEG_UNRESOLVED` guard (:487-497).

Concrete loss: a single operator refunds the payer on an unresolved submission, and DFNS then executes the original. The money is both sent and refunded.

`RETRY_AS_NEW_PAYMENT` also has no deterministic key: D1 derives a payment id from the payer plus the client's key (:1025). Two operator clicks, or a redelivered action, create two new payments, which is a double send.

Required:
- reuse D1 `CaseRecord` and `OperatorDecision`, extending the closed kinds explicitly as D1 changes;
- keep every money-moving decision two-person, or state and justify the exception against D1;
- REFUND only as P6, or a template that obeys §8.4 check 3, and never on an UNRESOLVED or unproven leg;
- one deterministic key per retry, at most one retry per original;
- gate the decision-entry path on CF-31.

### B4 · :86-87 (D-6) versus NOVA_ARC_DESIGN:1087 (F-6), OPEN_QUESTIONS:141 (Q-N21), archive list-transfers.md:43-65 · invented DFNS fact; weakens the double-send rule · **blocking**

Evidence:
- :87 "First prove that the original request was not created or will never broadcast: **a DFNS lookup by `externalId`**, a resolved nonce, or an accepted abort."
- D1 F-6 (:1087): "Not appearing in a listing proves nothing (Q-N21)."
- Q-N21 (OPEN) asks "Is there a lookup by `externalId`?" and rules "never by its absence from a listing".
- The archived List Transfers page has only the query parameters `limit` and `paginationToken` (list-transfers.md:43-65). There is no externalId filter.

So the delta:
- presents an undocumented DFNS capability as fact;
- makes "not found by externalId" a release proof, which the frozen design explicitly refuses;
- drops D1 proofs (a1) (approver denial) and (b) (nonce consumed) from its restatement.

Under its own heading "No change; the existing rule is restated" (:85), this restatement would license exactly the blind retry that answer 27 risks: DFNS creates the entity late, the lookup misses it, and both payments send.

Required: restate D1 §8.4 check 3 verbatim by reference. The proofs are (a1), (a2), (b) and (c), or a status-0 receipt on both sources. An externalId resolution only **finds** the entity, never proves its absence.

### B5 · :48, :58 (D-2, D-3) · money moved without the required control (client consent, answers 35 and 37) · **blocking**

Evidence:
- :48 "`REQUOTE` and `ACCEPT_WITH_CONSENT` need a **client consent record** (`consentRef`) captured outside the package and referenced by ID";
- :58 "`settlementConsentRef`".

What is missing:
- no port (and no fakes) to resolve a consentRef;
- no rule that it exists, belongs to the payment's client, is unused, and is **bound** to the specific case, new code or quote, amount and settlement instructions.

As written, any operator-typed string satisfies the control, and one consent can be replayed across cases or amounts. The consent control that answers 35 and 37 require is therefore not enforced. Required: a ConsentPort (two structurally different fakes) that returns a consent record bound to (clientUid, paymentId, caseId, a digest of the exact option consented to). The action is refused unless the record matches, and a consent is single-use.

### m1 · :3 versus D1 · keep-D1-frozen bookkeeping (MC-44) · minor

:3 says "touches D1 only where a Nova port gains a field, and every such change is listed below". None is listed, yet the delta needs:
- new `InboundSignal.source` values (D1 :476);
- new `CaseRecord.kind` and `DecisionKind` values (:537-546, :599);
- requote and write-off `FailureReason`s;
- a disposition for `ConversionPort.execute` (D1 :676). That is an automated execution answer 33 says "doesn't exist", while `fxPortFromConversion` (src/journey/quote/ports.ts:85) ties FxPort to ConversionPort;
- D1 §7.8 ConversionPort fakes, which model automatic execute;
- the D1 FIAT row (§4.1 "RESERVE (fiat)" from balance), which D-3's external fiat pay-in changes;
- D1 §9.1 GL-role config validation, which D-5 changes.

### m2 · :73-81 (D-5) · internal inconsistency / unsourced mapping · minor

- The table maps "dust" to Suspense (:76), then :81 says "The dust destination stays OPEN (F-4)".
- The per-wallet `arc.<w>` → Settlement mapping rests on answer 21 "Unsure" (KHUMO_ANSWERS:30).
- "partner-held" → Settlement has no answer behind it.

Each row should be marked as a configured default awaiting F-4 or F-5, not as a fact.

### m3 · :9 "Fact (answers)" versus KHUMO_ANSWERS:3 "ANSWERS RECORDED, NOT VERIFIED" · CLAUDE.md rule 5 · minor

The 5-minute expiry should be read from the code's `expiresAt` (as `ExpiryReader` does today), not fixed. 5 minutes belongs only in tests. The new Nova facts the delta relies on carry no [A-xx]/K-ID, as D1 §0 requires: `codeId`, `otc-codes` shape, `bookedEntryRef`, reviewer identity, client UID, and where consent records live.

### m4 · :20, D-3, D-4, D-2 · two fakes per port (CLAUDE.md:71) · minor

Fakes are named only for FxPort ("Both test fakes", :20), and they are not structurally differentiated. PayInPort, HistoryPort, the case store and the consent lookup (B5) have no fakes named.

### m5 · :51 (D-2) · MC-04 · minor

"Every action produces balanced, integer postings" names no templates for REFUND, WRITE_OFF or ACCEPT_WITH_CONSENT. WRITE_OFF needs a loss or expense account, but Raayl has no expense type (answer 17), the same gap as gas. It should be configure-or-fail-closed like :80.

### m6 · :49 · minor

Two humans for WRITE_OFF is stronger than any answer requires. It is acceptable, but unsourced; label it a design control.

### m7 · :16 · MC-10 · minor

`getPricingCode(pair, side, amount)` takes no idempotency key, while D1 principle 4 says every write is keyed and today's `lockRate(key, …)` is. A retried call writes a second `otc-codes` row, which a human could also fill (feeds B2).

### m8 · :23, :27 · MC-12 · minor

- The boundary rule for "at exactly 5 minutes" is not stated. Today's code treats `now < expiresAtMs` as live (compose.ts:322), so "at" means expired.
- The "fill never arrives" timeout has no value or Q-ID.

### m9 · :32 · MC-44 · minor

"every HOLD" is not a D1 term. D1 has QUARANTINE, PAUSE and wallet nonce holds.

### m10 · :64-66 (D-4) · minor

The HistoryPort write has no idempotency key, and its relation to the money transaction is not specified: outbox, or what happens when the history write fails.

### m11 · :57 (D-3) · minor

"Human-reviewed" does not require the reviewer to differ from whoever booked the entry, and does not say that the confirmed amount is compared to the expected pay-in before the under/overpayment case of D-2.

VERDICT: NEGATIVE (16 defects: 5 blocking, 11 minor)

phase · Delta verify (Lens R round 1) · streak 0/3 · NEGATIVE
