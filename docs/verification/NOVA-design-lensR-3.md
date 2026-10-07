VERIFICATION · lens: R · target: docs/NOVA_ARC_DESIGN.md (after design fix block 2) + related edits in docs/DFNS_SETUP.md and docs/OPEN_QUESTIONS.md · commit: 7fe69e2 (targets untracked or modified; pinned by sha256 prefix: NOVA_ARC_DESIGN 0ddab19fbf704d8a, DFNS_SETUP e49f9af12c168eb3, OPEN_QUESTIONS cbba9a7186eb09ce, KHUMO_QUESTIONS 2cea5a8f1dede89f (unchanged since round 2))

Verifier: independent verifier subagent, 2026-10-06. Round 3, after fix block 2, which answers `NOVA-design-lensR-2.md`.

Judged against:
- CO-1 v3 (docs/kit-v3/CHANGE_ORDER.md): D1 scope and the Step 6 status model;
- the operator's journey goal in docs/LEDGER.md:14 (four pay-in × payout combinations; external bank payout through a partner stub; ARRIVED only on the payout's final confirmation);
- the CLAUDE.md money rules;
- docs/constants.md;
- the archived DFNS pages under docs/sources/dfns/.

Safety statement:
- No DFNS, Circle or VALR API was called. Nothing was signed or sent to a chain. No .env file was read. No live re-fetch was made [archive-only].
- Scratch scripts were kept in the session scratchpad (`xref.py`, `inv.mjs`, `snips.ts`). They read only real files under docs/.

## CHECKS

### Mechanical (run)
- `npx tsc --noEmit` → first run exit 2 (`Type '""' is not assignable to type '`0x${string}`'`), second run a few minutes later exit 0 → PASS. The first failure was in repo code that parallel unit agents were editing at the time, not in the target. It is recorded here for the caller only.
- MC-01 float lint `node tools/lint-money-floats.mjs` → PASS ("20 money-path files, 0 finding(s)").
- `vitest run --project unit --project property` → 24 tests failed in 3 files, 1,006 passed (1,030 tests in 24 files). Round 2 had 600 tests in 13 files. The repo's src/ and test/ are changing under parallel unit agents, so this result says nothing about the target, which is design text with no code. The failing file names were not captured. Flagged to the caller for follow-up; not counted as a defect of the target.
- The 268 lines of TypeScript in the design's ```ts blocks were extracted and grepped for float literals, `Number(`, `parseFloat`, `parseInt`, `: number` and `Math.`. Zero code hits; the only matches are section numbers inside comments → PASS [grep, not Semgrep, this round].
- gitleaks on docs/ → PASS ("no leaks found", two runs).

### Cross-references (script xref.py, reconstructed)
- Every Q-xx in the design and DFNS_SETUP resolves to a row in OPEN_QUESTIONS, including the new Q-N20 → PASS.
- Every C-xx resolves in constants.md, every K-xx in KHUMO_QUESTIONS, every [A-xx] in §15, and every CF-xx (CF-27, CF-31, CF-33) in SEQUENCES, CONTRACT or LEDGER → PASS.
- The §0.1 key table has 32 keys, all used, each with an existing archived file that is listed in MANIFEST → PASS. The only hit, `DF:key`, is the table's own column header.
- Every `§n.m` reference resolves to a heading (§1.6 is CONTRACT §1.6). Every DFNS_SETUP §n and every "design §/F-" reference resolves → PASS, except the nits listed in R3-m5.

### Prior defects (NOVA-design-lensR-2), re-checked by reconstruction

**B1 (hash-less DFNS `Failed` release) → FIXED.** Re-trace:
1. **§8.6:734.** A `Failed` with no `txHash` and no accepted abort leaves the stage unchanged (`CREATED`/`PENDING_APPROVAL`/`APPROVED`), QUARANTINEs the payment and puts the wallet on a nonce hold. "**nothing is released on this status**".
2. **§8.4 rule 3.**
   - (a) is now limited to (a1) DFNS `Rejected`, which is reached only from `Pending` (archive: monitoring.md:38, :50), and (a2) an abort that DFNS accepted. The archive says abort works only for a transfer "currently in 'Executing' status and has not yet been signed" and sets `Failed` (abort-transfer.md:7).
   - :664-667 states that a hash-less `Failed` without an accepted abort is **not** proof.
   - (c) needs all of these: nonce `n` from `details` (get-transfer.md:2349-2355, "e.g. nonce"); an account nonce above `n` at a block both sources agree on; and no matching unlinked log up to that block, with the indexer complete to it.
   - If the nonce is unknown → QUARANTINE (:681).
3. **P6:782.** P6 needs proof (a), (b) or (c), or a status-0 receipt on both sources. It never fires on a DFNS status alone or on a timer.
4. **F-3b:912.** "P6 **only after proof (c)**". The 5-step nonce-burn procedure ends in either proof (c) → `REJECTED` + P6, or a matching log → two-person link → `COMPLETED` with no P6.
5. **§13.3:977, :982, :993-995.** `REJECTED`/`DFNS_FAILED` is reachable only with proof (c). Tests assert that the leg never goes terminal and never posts P6 in three cases: no proof, an unknown nonce, or a matching log present.

Soundness, reconstructed:
- Once `eth_getTransactionCount` at block B is greater than n, no transaction with nonce n can be included after B.
- No canonical log with the binding's `(from, to, value)` up to B means the bytes did not land with value. Zero-value and self transfers are refused before submission, so a value transfer always emits a log (C-24).
- So release on proof (c) cannot be followed by a late inclusion.

Race re-traced:
- A new transfer Q is submitted before the hold starts and gets the freed n (idempotency.md:44). Then either Q lands, or P's signed original lands.
- If Q lands: P passes proof (c) and Q completes.
- If P's original lands: P's log is a matching unlinked log for P. P is held, then linked by two people and completes. Q's hash has no receipt and the nonce is above it, so Q passes proof (b) and gets P6.
- Each nonce lands once, so there is no double count.
- If P and Q share `(to, value)`, both stay held. That fails closed.

WALLET_NONCE_HOLD (§8.4 check 5:685-706):
- It starts on any hash-less `Failed`, aborted or not, and on any hash-less terminal whose `details` shows a nonce.
- It lifts only when the account nonce is above n. A non-aborted transfer also needs the rest of proof (c) or a two-person link. With no parseable n, only a two-person decision with DFNS's answer can lift it (Q-N20).

→ PASS. Residuals: R3-m1 (gas of a status-0 original) and R3-m2 (the hold's storage).

**B2 (ours-to-ours move misposted) → FIXED.** Reconstructed with exact integers (inv.mjs, BigInt):
- **Setup.** P10 moves X = 5,000,000 minor (p = 6, k = 10^12) from source s (GAS_FLOAT) to destination t (TREASURY_HOT). Gas is the C-25 receipt, G = 7,374,356,000,000,000 wei, so (g, d) = (7,374, 356,000,000,000).
- **Source s.** On-chain delta = −X·k − G = −5,007,374,356,000,000,000. Book delta = P10 CR arc.s X, P4 CR arc.s g, P4D CR gasDust.s d = −X·k − g·k − d = −5,007,374,356,000,000,000. They are equal.
- **Destination t.** +5,000,000,000,000,000,000 on both sides.
- **GL-7** unchanged. Σ GL-2 over our wallets changed by exactly −g. This matches §9.2:791 and §9.3:804.

Full mixed run at p = 6, 2 and 18. Each loop applied:
- P8 funding of both wallets, then P10 moves with G ∈ {1, k−1, k−1, C-25 value, k, 3k+5, 420,000,000,000,000};
- automatic per-wallet P5 sweeps;
- an external payment (P1/P2/P3/P4/P4D);
- a P2I payment to a third (D2) wallet;
- a P9/P9D unidentified inbound of G+1;
- a FIAT_BANK payout that is PAID (P1/P2P/P2/P3);
- a FIAT_BANK payout that FAILED and was returned (P1/P2P/P2R/P6);
- a hash-less `Failed` resolved by a cancel burn (P4 on the cancel, then P6).

After every step, all of these held:
- the per-wallet chain invariant (wei = arc.<w>·k − gasDust.<w> + arc.<w>.subminor);
- the expense invariant (ΣG = GL-3·k + Σ_w gasDust.<w>);
- the unidentified-receipts invariant;
- dust < k after each sweep.

Every journal balanced with positive integers. At the end, GL-5 = 0 and partner = 0. The classifier refuses P8 on an INTERNAL log, and P8/P10 require INBOUND/INTERNAL respectively (§6.1:243-244, P8:784). → PASS.

| Prior | Status | Evidence |
|---|---|---|
| m1 fee-estimate auth | FIXED | §8.2:617 says "Bearer token … operation itself declares `security: - authenticationToken: []`". The archive matches: estimate-fees.md:27 (`security: []`) and :395-396 (`security: - authenticationToken: []`) |
| m2 cancel/speed-up grants | FIXED (residual R3-m6) | §8.2:626-634 and DFNS_SETUP:50-62 match roles-and-permissions.md: :1007-1011 (Transactions:Create grants Sign and broadcast, Cancel transaction, Cancel transfer, Speed up transaction, Speed up transfer); :1017-1020 (Transactions:Read); :1039-1042 (Transfers:Read). `ManagedDefaultEndUserAccess` "is assigned by default to any new EndUser" and holds all three (:83, :93). Both must-not lists are extended, and OPEN_QUESTIONS Q-N15:134 is extended |
| m3 POL-2 on 0-value, Q-N2 | FIXED | DFNS_SETUP:81 (side effect, citing Q-N2), :82 and F-5:915-918 name both POL-2 and POL-3. Archive: policies.md:68 |
| m4 ambiguous candidates | FIXED | §6.7:299-302 exempts them until `A_xcheck` |
| m5 cancel reported as drop | FIXED | `CANCELLED_ONCHAIN_REPLACED` is in the FailureReason enum (:404), §13.2:962, §13.3:978/:982, F-4, F-5 and F-18 |
| m6 partner return | FIXED (residual R3-m4) | P2R:777, §6.1:244 (case-record claim), F-17:930-933 and §9.3:803. Reconstructed above: partner nets to 0 and GL-5 nets to 0 |
| m7 keys and hash case | FIXED | §10.2:862 has distinct keys for P2I/P2P/P2R/P8/P9/P10 (`move:`). Recomputed lengths: `unid:`/`fund:` = 5+7+1+66+1+20 = 100 ≤ 128; `dust:` = 68; `gas:` = 78; `move:` = 41; externalId 44 ≤ 50 [DF:transfer]. `Hex32` is lower-cased on entry (§7.1:322, :334) |
| m8 subminor and port op | FIXED | §9.1:758 declares `arc.<w>.subminor`; `GasDustStore.recordReceiptDust` is at §7.3:486 |
| m9 rows and references | FIXED (nit in R3-m5) | §10.3:873-874 rows are inside the table; §4.1 cites §7.5a; §6.5:283 is reworded |

### CO-1 v3 D1 scope and Step 6 (fresh pass)
- D1 items:
  - network abstraction with FAKENET;
  - mainnet entry present but disabled, with CI tests (a)–(e);
  - DFNS `ArcTestnet` wallet check and balance read;
  - transfer under POL-1 approval;
  - confirmation from our own system-emitter log, with DFNS as cross-check only;
  - postings through Nova's ledger, with gas and dust posted;
  - `GET /payments/:id` returning decimal strings.
  → PASS.
- Step 6:
  - **Stage list and mapping.** The stage list is exact. Reconstructed: the 13 FailureReason values map one-to-one onto the §13.2 rows (8 REJECTED, 3 EXPIRED, 2 CANCELLED), so the table is total → PASS.
  - **Required failures.** "Blocklisted pre-mempool → FAILED with reason" and "under-floor drop → FAILED with reason" are both released only on proof → PASS.
  - **REVERSED** is set only through P7 → PASS.
- Exceptions: R3-B1 (pre-request terminal stages after an ambiguous POST) and R3-B2 (attempt+1 after P6).

### Operator journey (LEDGER:14)
- §4.1 covers all four combinations. The payer picks the pay-in. The receiver's payout is resolved server-side and frozen with a preference version. The FIAT_BANK leg goes through a CPN-shaped PayoutPartnerPort stub. Completion for FIAT_BANK comes only on the partner's authenticated final confirmation. The cross-border flag stays OFF → PASS.
- On the failed-payout path, the case-return branch is now posted (P2R). The "refund is a new payment" branch is not (R3-m4).

### CLAUDE.md money rules
- Integers only; one conversion module (U1); quote legs posted separately; gas and dust posted; conservation (reconstructed above); deterministic keys; two-person unpause; binding from the server-side record; REVERSED = P7 only → PASS.
- Authenticity and dedupe for Arc log, DFNS webhook, DFNS poll, conversion and payout signals (§10.3) → PASS. Two-person operator decisions have no defined signal (R3-m2).
- Fail closed → FAIL on R3-B1 and R3-B2.

### DFNS facts re-checked against the archive (every one cited in the changed text)
| Claim | Archive | Result |
|---|---|---|
| Abort only while `Executing` and unsigned; sets `Failed`; no blockchain interaction | abort-transfer.md:7, :11 | PASS |
| Cancel works on "'Failed' status, but failed off-chain (before being broadcasted to the network)"; "Extracting the nonce from the original transfer's signed data"; "Consume the nonce that was reserved but not used"; "0 value to the same address" | cancel-transfer.md:7-19 | PASS |
| `Failed` = "either system failure to complete the request or the transaction failed on chain" | abort-transfer.md:2297-2298 (same enum as get-transfer) | PASS |
| txHash absent = off-chain failure; "automatically frees any nonce it reserved for the failed transfer" | idempotency.md:42, :44 | PASS |
| externalId is bound permanently after a terminal status | idempotency.md:37-39 | PASS |
| `details` is "Structured representation of the data used to construct the signature (e.g. nonce, gas parameters)" | get-transfer.md:2349-2355 | PASS |
| Resources are "released only once the transaction is confirmed, cancelled, or identified as failed"; cancel "to burn the reserved nonce and unblock subsequent transactions" | networks_evm.md:81, :85 (the second quote's context is aborted transactions, as Q-N20 states) | PASS |
| Speed-up "10% bump or current Fast fees, whichever is higher"; cancel is a zero-value self-transfer | networks_evm.md:89-90 | PASS |
| Status diagram, `Pending → Rejected` "Blocked by policy or approval rejected", `Broadcasted` "Signed and sent to the network mempool" | transaction-monitoring.md:36-41, :47, :50 | PASS |
| `Executing` "only set for a short time between pending and broadcasted" | transfer-asset.md:4696-4698 | PASS |
| "Never submit a second Transfer Asset request to 'retry'…"; `priority` only; no gas override | create-transfers.md:187, :206 | PASS |
| Permission grants and `ManagedDefaultEndUserAccess` | roles-and-permissions.md:83, :93, :1000-1042 | PASS |
| Value rules fail closed on 0-value transactions and contract calls | policies.md:68 | PASS |
| "A transfer of an asset that is not listed does not trigger the rule"; minimum denomination | create-policy.md:1245, :1261, :1278 | PASS |
| Arc row "\| Arc \| ArcTestnet \| 1 \| N/A \| 10 \|" under a "Confirmation Delay" column | networks_index.md:34 | PASS |
| Webhook events, "anything else than a 200", "5 total attempts over 24 hours" | webhook-events.md:288-290 and the event names | PASS |
| Region host and webhook origin IP `35.181.116.68` | regions.md:24 | PASS |
| Challenge expires after 15 minutes, single use | signing-requests.md:32, :51 | PASS |
| "Delegated wallets bypass policies"; `Block` always wins; `serviceAccountsCanApprove` | policies.md:21, :73, :97 | PASS |
| `Authorization: Bearer` cited to [DF:api-index] | api-reference_index.md:24-28 lists only Content-type and User-agent. Bearer is in DF:transfer securitySchemes (transfer-asset.md:4924-4927) | Fact real, citation imprecise → R3-m5 |

No invented DFNS endpoint, field, header or state was found [archive-only]. The archive contains one contradiction that the design does not quote: networks_evm.md:70 says "Once a nonce is assigned to a transaction, it cannot be reused", while idempotency.md:44 says the nonce is freed and reused. Q-N20 (1) already asks which applies, and the design holds the wallet under both readings, so this is not a defect.

### Arc facts
Every C-id used (C-01…C-06, C-10…C-15, C-20…C-28, C-30, C-31, C-40…C-42, C-50, C-51, C-53…C-55, C-57, C-62…C-65) matches its constants.md row. This includes C-53, which says "An included transaction that reverts on a blocklist check still consumes gas"; that is used in R3-m1 → PASS [archive-only].

### Judgment lenses
- JL-1 fail-closed: B1 is closed soundly. New gaps: R3-B1 and R3-B2. [judgment]
- JL-2 human-owned: PASS. [judgment]
- JL-3 03:00 operability: R3-m1 (an unexplained PAUSE with no runbook step) and R3-m3. [judgment]
- JL-4 auditability: R3-m1 (a revert is reported as `DFNS_FAILED`) and R3-m2. [judgment]
- JL-5 fewest new parts: PASS. [judgment]
- JL-6 privacy: PASS. [judgment]

## DEFECTS

**R3-B1 · NOVA_ARC_DESIGN.md:147 (§4.1 Quote), :919 (F-6), :929 (F-16), :974 (§13.3 `CREATED` row), with :734 and §10.1:836-842 · CLAUDE.md "Fail closed" and "Exactly once", RUBRIC MC-13 · severity blocking**

The pre-request terminal rules depend on the condition "no DFNS request exists yet" (§13.3:974; §4.1:147 "if it expires before the DFNS transfer request … has been created"; F-16:929). The design never says how that condition is established after a POST whose outcome is unknown:
- **Stage stays `CREATED`.** The leg is `CREATED` while the gateway POSTs (§10.1:836-842; no marker is written before the POST). F-6:919 leaves the stage "unchanged" on a POST timeout or 5xx. §8.6:734 itself lists `CREATED` as a stage in which DFNS can later show the transfer as `Failed`. So `CREATED` does not imply that no request exists.
- **Release without proof.** From `CREATED`, §13.3:974 allows `EXPIRED`/`QUOTE_EXPIRED` and `CANCELLED`/`CANCELLED_BY_OPERATOR`, and both post P6 (F-16; P6:782) with no proof (a)/(b)/(c). The "Once a DFNS request exists, every P6 needs proof" rule (:734) does not apply to them.

Failure path:
1. The POST reaches DFNS but the response times out.
2. The quote expires, or an operator cancels at `CREATED`.
3. P6 refunds A + F to the payer.
4. Under POL-1 a human approves the still-live DFNS request, and DFNS broadcasts it.
5. The receiver gets A. The payment is terminal, so the log is not a candidate. §6.7 PAUSEs only after the money has left.

Result: the money is double-counted (refund plus send).

Fix:
- Before the first POST, persist in the same transaction a marker that a DFNS request may exist (for example `externalRef := externalId`, or a submit-attempted flag).
- Treat a leg with that marker as "DFNS request exists" for §4.1, F-16, §13.3 and P6.
- Resolve the ambiguity only by re-POSTing the same body and `externalId`. That returns the existing entity or creates it [DF:idem :16-20], after which the request exists. Never resolve it by elapsed time.
- Add a test: a POST times out, the quote expires and an operator cancels, and no P6 is posted.

**R3-B2 · NOVA_ARC_DESIGN.md:652-653 (§8.4 checks 2-3), :914 (F-4 "a new attempt only via §8.4 rule 3"), :782 (P6), :862 (§10.2 per-payment keys) · MC-13, "Binding" (reservation) · severity blocking**

Rule 3 allows "a new attempt (`attempt + 1`, new `externalId`) … only after the previous attempt is terminal **and** proven not on chain". F-4 offers that path explicitly. But every proof, (a), (b) or (c), also triggers P6 and makes the leg terminal (§8.6, F-3b, F-4, P6). So any reachable attempt + 1 comes after the reservation has been released.

Gateway check 2 does not catch this. It verifies only that "the Nova reservation journal (P1) exists by key" (`pay:<id>:p1`, which has no attempt part). A released P1 still exists, so DFNS is asked to move A that Nova no longer holds: the payer has been refunded and A leaves treasury again.
- §13.3:980 forbids transitions out of a terminal stage, but the POST goes out before `applySignal` is refused. Check 5 tests only for PAUSE and QUARANTINE, not for the stage.
- After the fact, detection is only §6.7's PAUSE.

Fix, either of:
- (i) State that in D1 a proof always ends the payment (P6, terminal) and a retry is a new payment. Remove attempt + 1 from rule 3 and F-4. Make check 2 refuse when the payment's leg is terminal or a `pay:<id>:p6` journal exists.
- (ii) Make attempt + 1 an alternative to P6. Keep the reservation, carry `attempt` in the P1/P6 keys, and make check 2 verify that the reservation is still open (no P6).

Add a test: after P6, a submit for attempt 2 is refused before any DFNS call.

**R3-m1 · NOVA_ARC_DESIGN.md:912 (F-3b steps 2-5), :674-681 (proof (c)) · MC-04 gas posting, JL-3, JL-4 · minor**

A hash-less `Failed` whose signed original was included and **reverted** emits no log, but still consumes nonce n and gas. C-53: "An included transaction that reverts on a blocklist check still consumes gas", which is exactly F-3b's blocklist case.
- **Release is correct.** Proof (c) holds and P6 follows, which is right because no value moved.
- **Gas is unposted.** Nothing ever learns that transaction's hash, so its gas is never posted. F-3b step 5 posts only a cancel's gas.
- **No runbook step.** The per-wallet chain invariant is then off by G, and the rail PAUSEs with no step that finds the transaction (for example by scanning the wallet's transactions for nonce n).
- **Wrong reason.** The reason recorded is `DFNS_FAILED`/`BLOCKLISTED_PRE_MEMPOOL` where `ONCHAIN_REVERTED` is true.

It fails closed. Add a step: when the account nonce is above n with no cancel and no reuse, locate the nonce-n transaction on both sources, post P4/P4D and record the true reason.

**R3-m2 · NOVA_ARC_DESIGN.md:451 (`InboundSignal.source`), :458-475 (PaymentStorePort), :685-706 (nonce hold), :784/:787 (approved funding and move records), :930 (F-17 case record) · CLAUDE.md "Authenticity and dedupe", MC-44 · minor**

Several new safety states and inputs have no port, signal source, dedupe key or authenticity definition:
- **No ports.** The wallet nonce hold, the approved move record (P10, and the check 2 lookup), the approved funding record (P8) and the F-17 case record have no port operation or type.
- **No signal source.** Two-person operator decisions are not an `InboundSignal` source, and §10.3 gives them no dedupe key. Examples are the F-3b hash link, the proof (c) close, F-18 resolution and abort acceptance. Their authenticity rests on CF-31, which is still open.

Money stays safe: posting keys are once-only, the link requires on-chain evidence, and every transfer still needs POL-1. But the implementer must invent all of these.

One concrete risk: if the hold lives only in memory, a restart loses it for an aborted transfer (its leg is terminal, so the hold cannot be re-derived from open legs).

Add a durable hold, record ports, and an `OPERATOR_DECISION` source with an authenticity check and dedupe key.

**R3-m3 · NOVA_ARC_DESIGN.md:707 (§8.4 check 6), :243 (§6.1 INTERNAL), :775 (P2I), :563 (`ResolvedPayout.receiver`) · MC-04 · minor**

Check 6 allows any transfer "to a **different** wallet of ours", which is classified INTERNAL and settled by P2I. P2I credits "GL-1 receiver" and assumes the receiver is a Nova customer.

The case where a beneficiary's address is a company wallet (owner `COMPANY`, for example GAS_FLOAT) and `receiver` is null is not defined:
- P2I has no GL-1 account to credit;
- P2 would credit the wrong books, because the money stayed in our wallet.

It fails closed (the chain invariant PAUSEs). Refuse in precheck a payment whose `to` is a company-owned wallet, or route it to P10.

**R3-m4 · NOVA_ARC_DESIGN.md:932 (F-17 "or the refund is a **new** payment"), :803 (§9.3) · MC-04 · minor**

F-17's alternative branch has no posting. If the partner never returns the USDC and Ops refunds through a new payment:
- the original payment's A + F stays in GL-5 and A stays in `partner.<id>`, with no closing template;
- §9.3's "P1 = P2 + P3 or P1 = P6" never holds for that payment;
- the funding source of the new refund payment is undefined.

Define the write-off or closing entries (two-person), or drop the branch.

**R3-m5 · wording and citation nits · MC-44 / MC-21 · minor**

- **§6.5:276.** "There is no automatic way to satisfy this rule" contradicts the automatic completion in §10.1:849. Read it as "no other automatic way".
- **§13.3:973.** "which needs a DFNS-reported hash" ignores the two-person link of §6.5 rule 1 for hash-less `Failed` legs. That link enters through `CONFIRMING`, so it is still never before `SUBMITTED`.
- **§6.5:283 and §10.4:889.** These say a hash-less leg is in `PENDING_APPROVAL` or `APPROVED`, but §8.6:734 also admits `CREATED`. A `CREATED` leg's log is never a candidate (§10.4), so it PAUSEs at once.
- **§7.3:423.** `attempt` cites §10.4; it should cite §8.4 rule 3 and §10.2.
- **§8.2:640.** `Authorization: Bearer` is cited to [DF:api-index], which lists only Content-type and User-agent (api-reference_index.md:24-28). Cite DF:transfer securitySchemes (transfer-asset.md:4924-4927).

**R3-m6 · DFNS_SETUP.md:30 (§2 Q-N15), :114 (§8 hand-back), OPEN_QUESTIONS.md:139 (Q-N20) · completeness of the admin hand-off · minor**

- **Q-N15.** DFNS_SETUP §2 Q-N15 (2) still asks only about `Wallets:Transfers:Read`. The `Wallets:Transactions:Create`/`:Read` part added to OPEN_QUESTIONS:134 is not in the text the admin sends to DFNS support.
- **Q-N20.** Q-N20 (owner "DFNS admin → DFNS support") is missing from DFNS_SETUP §2 and from the §8 hand-back checklist. The design makes DFNS's written answer the only way to close an unknown-nonce case (§8.4:681, F-3b step 1).

## VERDICT

NEGATIVE (8 defects: 2 blocking, R3-B1 and R3-B2; 6 minor, R3-m1 to R3-m6).

All round-2 defects are closed:
- B1 and B2 are verified by reconstruction (the trace above and the BigInt run at p = 6, 2 and 18);
- m1 to m9 are fixed, with three small residuals carried as R3-m4, R3-m5 and R3-m6.

The two new blocking defects are on the submit/release boundary, which earlier rounds did not examine:
- an ambiguous DFNS POST leaves a leg in `CREATED`, from which P6 needs no proof;
- `attempt + 1` is allowed after P6, and gateway check 2 does not see that the reservation was released.

Each needs a one-paragraph rule plus a test.
