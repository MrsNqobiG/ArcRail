VERIFICATION · lens: R · target: docs/NOVA_ARC_DESIGN.md (after design fix block 3) + related edits in docs/DFNS_SETUP.md and docs/OPEN_QUESTIONS.md · commit: 7fe69e2 (targets untracked or modified; pinned by sha256 prefix: NOVA_ARC_DESIGN d820d43d00644b86, DFNS_SETUP 761fdf83fc01bac1, OPEN_QUESTIONS c2e226d2021cd0d1, KHUMO_QUESTIONS 2cea5a8f1dede89f (unchanged since round 2))

Verifier: independent verifier subagent, 2026-10-06. Round 4. It checks fix block 3, which answers `NOVA-design-lensR-3.md`.

Judged against:
- CO-1 v3 (docs/kit-v3/CHANGE_ORDER.md:87-95 D1, :131-135 Step 6);
- docs/LEDGER.md (2026-10-06 "Product journey defined by the operator");
- the CLAUDE.md money invariants (:24-32);
- docs/constants.md;
- the archived DFNS pages under docs/sources/dfns/.

Safety:
- No DFNS, Circle or VALR API was called. Nothing was signed or sent. No .env file was read. No live re-fetch was made [archive-only].
- Scratch files were written only to the session scratchpad: `step4a.py`, `snips4.ts` and `dfkeys.txt`.

## CHECKS

### Mechanical
- `npx tsc --noEmit`, the MC-01 float lint and vitest → NOT RUN. There is no Linux `node` on this shell's PATH; only `/mnt/c/Program Files/nodejs/npx` exists, and it failed with "node: command not found". The target is design text with no code, so this does not affect the verdict. It is recorded for the caller.
- Float grep over the 386 lines of the design's ```ts blocks (float literals, `Number(`, `parseFloat`, `parseInt`, `: number`, `Math.`) → PASS. The only hits are section numbers inside comments.
- gitleaks on docs/ → PASS ("no leaks found").
- Cross-references (shell loops, reconstructed):
  - every Q-xx in the design and DFNS_SETUP is a row in OPEN_QUESTIONS, including Q-N21 and Q-N22;
  - every C-xx is a row in constants.md;
  - every K-xx is a row in KHUMO_QUESTIONS;
  - every [A-xx] is in §15 (A-60/A-61 share one row);
  - every DF:key is in the §0.1 table, and each archived file exists and is in MANIFEST. The only hit is the column header `DF:key`;
  - every `§n.m` resolves, except §1.6, which is CONTRACT §1.6, as in round 3.
  → PASS.

### Prior defects (NOVA-design-lensR-3), re-checked by reconstruction

**R3-B1 (ambiguous POST) → FIXED.**

Mechanism:
- **Marker before the POST.** `markSubmit` commits a `SubmitMarker` holding `externalId`, `bodyDigest` and `markedAtBlock` before the POST (§8.4 check 3:798; §10.1:999).
- **Version guard.** It runs with `expectedVersion`. It refuses with `LEG_TERMINAL` if the leg is terminal or a P6 is enqueued (:500-501).
- **Store guard.** `applySignal` refuses with `LEG_UNRESOLVED` any terminal target and any P6 outbox item while the marker is set and `externalRef` is null (:487-497, :631).

Trace A, "created" (DFNS created the entity; the response was lost):
1. Marker committed (version v→v+1). The POST reaches DFNS; the entity is `Pending`; the response times out.
2. The leg is `CREATED`, UNRESOLVED (§8.6:883; F-6:1087).
3. The quote expires. F-16:1097 acts "only while the ARC_TRANSFER leg has no submit marker", so it is refused, and the store would answer `LEG_UNRESOLVED` anyway.
4. An operator asks to cancel. §13.3:1139 allows `CANCELLED_BY_OPERATOR` directly only with no marker, and :1140 gives "no terminal target at all" → refused.
5. No P6 exists at any point (P6:939 says "never while the Arc leg is UNRESOLVED").
6. The re-POST of the same bytes and `externalId` returns `200` with the entity. The archive matches: idempotency.md:20 says "same url, same body, including same `externalId`" … "a `200` response containing the entity which was already created".
7. `externalRef` is set and the leg moves to `PENDING_APPROVAL` (:1007).
8. From here:
   - an approver denial gives proof (a1) → `REJECTED`/`APPROVAL_DENIED` + P6, exactly once;
   - an approval gives `COMPLETED` + P2, with no P6.
   There is no refund-plus-send double count.
9. **Race.** Quote expiry and `markSubmit` both carry `expectedVersion`, so exactly one wins. If expiry wins, `markSubmit` returns `VERSION_CONFLICT` or `LEG_TERMINAL` and no POST is sent. If the marker wins, the expiry re-reads the leg and is refused.
10. **Webhook first.** A webhook arriving before the re-POST resolves the leg through `findByExternalId` plus GET (:502-504, §8.7 step 6).
11. **Log first.** A log arriving first is a provisional candidate (§6.7:311, §10.4:1057), not an immediate PAUSE.

Trace B, "never arrived":
1. Marker committed; the POST is lost before DFNS.
2. The leg is UNRESOLVED. As in steps 3-5 of trace A, expiry and cancel are refused and no P6 is posted.
3. The re-POST is the first request DFNS sees and creates the entity. The design labels this "our reading" and puts it to DFNS as Q-N21 (OPEN_QUESTIONS:141). That is correctly an open question, not an invented fact.
4. Then trace A from step 7.
5. While the re-POST fails, the leg stays UNRESOLVED (:805). See R4-m1 for the case where it can never succeed.
6. **Crash between marker and POST:** `listUnresolvedSubmits` returns the leg at start-up (:513, :609).

→ PASS. Residual: R4-m1.

**R3-B2 (attempt + 1 after P6) → FIXED (option (i)).**

Mechanism:
- `LegRecord.attempt: 1n` (:437).
- `deriveExternalId` uses the fixed `lp('1')` (:1028). Length 4 + 40 = 44 ≤ 50; the archive gives `maxLength: 50` (transfer-asset.md:1008-1009).
- Check 2 (:787-793) refuses with `RESERVATION_NOT_OPEN` in four cases:
  - P1 is missing;
  - `pay:<id>:p6` exists, or the lookup is `AMBIGUOUS`;
  - the leg is terminal, or a P6 outbox item is pending;
  - the payment stage is terminal.

Each proof was traced to its terminal stage and P6, then to a resubmit:

| Proof | Terminal stage and P6 (same `applySignal` commit, :796) | Resubmit |
|---|---|---|
| (a1) DFNS `Rejected` | `REJECTED`/`APPROVAL_DENIED` or `EXPIRED`/`APPROVAL_EXPIRED` + P6 (§8.6:888-889) | Leg terminal and P6 enqueued or posted → check 2 refuses |
| (a2) Accepted abort | `CANCELLED`/`CANCELLED_BY_OPERATOR` + P6 (:890; §13.3:1142) | Refused as above. The wallet hold also refuses at check 5 |
| (b) Nonce consumed | `EXPIRED`/`UNDER_FEE_FLOOR_DROPPED` or `CANCELLED`/`CANCELLED_ONCHAIN_REPLACED` + P6 (:892; F-4; §13.3:1144) | Refused |
| (c) Reserved nonce resolved | `REJECTED`/`DFNS_FAILED` or `BLOCKLISTED_PRE_MEMPOOL` + P6 (:891; §13.3:1143; F-3b) | Refused |
| Status 0 | `REJECTED`/`ONCHAIN_REVERTED` + P4 + P6 (F-3c) | Refused |

Further checks:
- **Re-POST.** A re-POST also runs check 2 (:805), so an UNRESOLVED re-POST can never follow a release.
- **Moves.** P10 moves use `getMove` and a non-terminal leg. A retry needs a new `APPROVE_MOVE` decision, which gives a new `moveId` (:793, :1027).
- **Tests.** The required tests are listed at :1177-1182, including "the fake transport records zero requests". See the ordering nit in R4-m4(a).

→ PASS.

| Prior | Status | Evidence |
|---|---|---|
| R3-m1 reverted original's gas | FIXED (residuals R4-m2, R4-m3) | F-3b step 4a (:1080) searches the hold window and branches (i)-(iv). Branch (iii) posts P4/P4D and records `ONCHAIN_REVERTED`. Test at :1164. Q-A11 is extended (OPEN_QUESTIONS:28) |
| R3-m2 ports and decision signal | FIXED | :515-535 add the `recordDecision`, hold, move, funding and case operations. `OperatorDecision` (:548-557) requires two distinct approvers. The `OPERATOR_DECISION` source is at :476. Authenticity and dedupe `op:<decisionId>` are at :1041, with the evidence projection at :1051. Durability and a restart test are at :607-610 and :1185 |
| R3-m3 company-owned destination | FIXED | §4.1:159; check 6:863; `DESTINATION_NOT_ALLOWED` in the enum (:418) and in §13.2:1125; P2I:932; test :1188 |
| R3-m4 F-17 second branch | FIXED | P11 (:945), key `:p11` (:1027) and §9.3:961. Reconstructed: P1 (DR payer A+F / CR GL-5), P2P (DR partner A / CR arc.hot A), P6 (DR GL-5 A+F / CR payer), P11 (DR partnerClaim A / CR partner A). So GL-5 = 0, partner = 0 and partnerClaim = A. A later P2R (DR arc.<to> A / CR partnerClaim A) takes the claim to 0, with no second P6. Every journal balances |
| R3-m5 wording and citations | FIXED (one leftover in R4-m4(b)) | §6.5:288 "only **automatic** way"; §6.5:295 and §10.4:1057 include `CREATED` with a marker; :437 cites §8.4 check 3 and §10.2; :775 cites Bearer to DF:transfer securitySchemes, which matches transfer-asset.md:4924-4927 |
| R3-m6 admin hand-off | FIXED | DFNS_SETUP §2 now carries Q-N15 (2) with `Wallets:Transactions:*`, Q-N20 (1)-(4) and Q-N21. The §8 hand-back row lists all of them |

### F-3b step 4a search, exact integers (step4a.py)

`count(b)` = `eth_getTransactionCount(wallet, b)` = the number of wallet transactions mined in blocks ≤ b. So "account nonce > n" means nonce n is used, and "≤ n" means it is unused, which matches proof (b)/(c) and the `lastAtOrBelow`/`firstAbove` definitions (:569-570). The transaction is in (L, F]; including L in the search is harmless.

| Case | L, count(L) | F, count(F) | Binary search | Scan |
|---|---|---|---|---|
| n = 41 | 1,000,050, 41 | 1,000,120, 42 | 1,000,087 | [1,000,087] |
| n = 0 | 1,000,000, 0 | 1,000,001, 1 | 1,000,001 | [1,000,001] |
| Count jumps 7 → 10 in the F block | 1,000,119, 7 | 1,000,120, 10 | 1,000,120 | [1,000,120] |
| Hold starts late; L = `markedAtBlock` | 1,000,000, 12 | 1,000,500, 13 | 1,000,010 | [1,000,010] |
| n consumed **before** `markedAtBlock` | 1,000,000, 21 | 1,000,500, 21 | precondition fails | [] |

The window and the binary search are correct, with no off-by-one. The last case shows the design does not state its lower-bound assumption and has no "not found" branch → R4-m2. That branch fails closed.

### CO-1 v3 D1 and the Step 6 status model (fresh pass)
- **D1.** Network abstraction with FAKENET; mainnet entry present and disabled, with CI tests (a)-(e); `ArcTestnet` wallet check and balance read; transfer under POL-1 approval; confirmation from our own system-emitter log; postings with gas and dust; `GET /payments/:id` with decimal strings. → PASS.
- **Stage list.** Exact (:412-413). → PASS.
- **FailureReason.** It now has 14 values (:415-418). §13.2 maps 9 to REJECTED, 3 to EXPIRED and 2 to CANCELLED, a total of 14, one to one. The table is total. → PASS.
- **Required failures.** Blocklisted pre-mempool and the under-floor drop both go to FAILED with a reason, and each is released only on proof. → PASS.
- **REVERSED.** Set only through P7 (:1102). → PASS.

### Operator journey (LEDGER, 2026-10-06)
- All four combinations are covered.
- The payer picks the pay-in. The payout is the receiver's choice, resolved server-side and frozen.
- The FIAT_BANK leg goes through the PayoutPartnerPort stub. ARRIVED is set only on the partner's authenticated final confirmation.
- The cross-border flag stays OFF.
- The F-17 branches are now both posted (P2R, or P6 plus P11).
→ PASS.

### CLAUDE.md money rules
| Rule | Result |
|---|---|
| Integers only, one conversion module | PASS |
| Quote legs posted separately | PASS |
| Gas and dust posted | PASS. Step 4a closes the reverted-original gap |
| Conservation | PASS. P11 reconstructed above |
| Deterministic keys | PASS. `:p11`; `externalId` fixed per payment |
| Outbox and inbox; single nonce writer (DFNS) | PASS |
| Authenticity and dedupe | PASS. Every source, including `OPERATOR_DECISION`, has an authenticity rule and a dedupe key. The re-POST response and the listing are our own authenticated calls. A webhook is only a hint and is confirmed by GET |
| Fail closed | PASS. Every new gap found this round fails closed (R4-m1, R4-m2, R4-m3) |
| Binding | PASS |
| REVERSED | PASS |

### DFNS facts (every one cited in the changed text, re-checked against the archive)
| Claim | Archive | Result |
|---|---|---|
| Re-submit "in case a network error (or other) prevented you to get our server's response, even if your request has actually been processed by DFNS" | idempotency.md:16 | PASS, verbatim |
| "same url, same body, including same `externalId`" → `200` "containing the entity which was already created" | idempotency.md:20 | PASS, verbatim |
| Different body or different wallet → `409` | idempotency.md:21 | PASS |
| After terminal: "returns the existing entity with a `200` response—it does not create a new transaction or retry the failed one"; `externalId` permanently bound | idempotency.md:37-39 | PASS, verbatim |
| "automatically frees any nonce it reserved for the failed transfer"; txHash absent = off-chain | idempotency.md:42-44 | PASS |
| A re-POST that never arrived creates the entity | Not stated in the archive. The design labels it "our reading" and asks Q-N21 | PASS (not presented as fact) |
| The user-action signature travels in the `X-DFNS-USERACTION` header | transfer-asset.md:2482-2483, :4933-4936 | PASS |
| `Authorization: Bearer` from the `authenticationToken` scheme | transfer-asset.md:4924-4927 | PASS |
| List Transfers takes only `limit` and `paginationToken` (`nextPageToken`); no `externalId` filter | list-transfers.md:44-65, :79-82 | PASS |
| `202` means policy pending | error-codes.md:141-143 | PASS |
| Resources "released only once the transaction is confirmed, cancelled, or identified as failed"; cancel "to burn the reserved nonce and unblock subsequent transactions" | networks_evm.md:81, :85 | PASS |
| Status transitions Pending→Executing→Broadcasted→Confirmed, Pending→Rejected, Executing→Failed, Broadcasted→Failed | transaction-monitoring.md:37-40 | PASS |
| `Executing` "only set for a short time" | transfer-asset.md:4698 | PASS |
| `amount` `^\d+$`; `externalId` 1-50 characters | transfer-asset.md:107, :1008-1009 | PASS |
| `txHash`, `dateBroadcasted`, `replacementId`, `details`, `requestBody` fields | get-transfer.md:87, :2293, :2313, :2344, :2349 | PASS |
| Abort is `PUT …/abort`, "without any blockchain interaction"; cancel is `POST …/cancel` | abort-transfer.md:11, :17; cancel-transfer.md:41-42 | PASS |
| `GET /v2/policy-approvals/{approvalId}` under `Policies:Evaluations:Read` | roles-and-permissions.md:768-772 | PASS |

The round-3 table (permissions, policies, webhooks, regions, signing) was spot-checked and is unchanged. No invented DFNS endpoint, field, header or state was found [archive-only].

### Arc facts
Every C-id used resolves to its constants.md row with a matching value: C-01 5042002, C-20 emitter, C-21 topic0, C-24, C-25, C-30 20 gwei, C-31 20,000 gwei, C-40 10,000, C-53 "still consumes gas", C-54, C-55 and C-62..C-65. → PASS [archive-only].

### Judgment lenses
- JL-1 fail-closed: PASS. Both blocking defects are closed, and no new path releases or sends without a proof. [judgment]
- JL-2 human-owned: PASS. [judgment]
- JL-3 03:00 operability: R4-m1 and R4-m2, dead ends with no defined exit. [judgment]
- JL-4 auditability: R4-m3. [judgment]
- JL-5 fewest new parts: PASS. The new records are needed. [judgment]
- JL-6 privacy: PASS. [judgment]

## DEFECTS

**R4-m1 · NOVA_ARC_DESIGN.md:805 (§8.4 check 3 re-POST rules, "It stays non-terminal however long it takes"), :1087 (F-6), :537-546 (DecisionKind), OPEN_QUESTIONS.md:141 (Q-N21 "A 'no' to (2) costs only operability: an unresolved leg waits for a successful re-POST") · JL-3 · minor**

An UNRESOLVED leg has no exit if the re-POST can never succeed. Examples:
- a deterministic `400`, `401` or `403` on the same bytes;
- the wallet is no longer `Active`, so check 1 refuses every re-POST;
- the rail stays PAUSED.

In these cases:
- no webhook or listing will ever show an entity;
- there is no `DecisionKind` that closes an `UNRESOLVED_SUBMIT` case;
- so the payer's A + F stays in GL-5 indefinitely.

This fails closed and no money is lost, but there is no runbook end. Q-N21's note understates the problem: the wait is unbounded, not just slow.

Fix: add a two-person close, for example `UNRESOLVED_SUBMIT_CLOSE`, gated on DFNS's written answer to Q-N21 for that `externalId` and on the account nonce showing no consumption. Its outcome is a terminal stage plus P6. Until Q-N21 is answered it stays unavailable.

**R4-m2 · NOVA_ARC_DESIGN.md:1080 (F-3b step 4a "Search the hold's window: from … `lastAtOrBelow` block (or the leg's `markedAtBlock` …) to its `firstAbove` block"), :449-450 (`markedAtBlock` "lower bound of the F-3b nonce search") · MC-04, JL-3 · minor**

Step 4a has two gaps:
- **Unstated assumption.** It assumes that nonce n was still unused at `markedAtBlock`, that is `count(markedAtBlock) ≤ n`, but never states this.
- **No "not found" branch.** It defines branches (i)-(iv) and "no source can serve the window", but nothing for a search that is served and finds no nonce-n transaction.

The integer case above has `count(1,000,000) = 21` with n = 20, so the search window [1,000,000, 1,000,500] contains no nonce-20 transaction. The hold then never lifts and P6 is never posted. This fails closed, but it is a permanent rail stop with no defined step.

It is reachable only if DFNS hands out a nonce already consumed on-chain, which is DFNS-anomalous, so it is minor.

Fix:
- check `count(markedAtBlock) ≤ n` when the window is built;
- if the check fails, or the search finds nothing, widen the lower bound by binary search on `eth_getTransactionCount` down to the indexer start block. The count is monotone, so this always terminates;
- otherwise record an explicit "not found" outcome: stay held and page.

**R4-m3 · NOVA_ARC_DESIGN.md:288-291 (§6.5 rule 1: a `LINK_HASH` decision needs "rule 2 holds on both sources", allowed "only in two cases: a speed-up replacement (F-18), or a hash-less DFNS `Failed` transfer whose signed original landed (F-3b)") vs :1080 (step 4a (iii) "Two people link `h` to this leg (`LINK_HASH` …)" for a reverted original; step 5 and F-18 "once the cancel's hash is linked"), :1051 (`LINK_HASH` evidence projection) · MC-44 consistency, JL-4 · minor**

Rule 2 needs a canonical log with the bound `from`, `to` and `value`. Neither of these has one:
- a status-0 original emits no log;
- a 0-value self-transfer cancel emits no log (C-24).

So a `LINK_HASH` that follows §6.5 rule 1 literally cannot be recorded for step 4a (iii), or for linking a cancel's hash to post its gas. The `LINK_HASH` evidence projection also has no receipt status and no transaction `to`/`value`.

Impact:
- A literal implementation keeps these legs held forever. That fails closed, but the R3-m1 fix becomes unusable.
- A loose implementation weakens rule 1 for every link. Money stays safe, because `COMPLETED` still needs rules 2 and 3.

Fix: give rule 1 a second evidence form, or define separate decision kinds:
- a "nonce-consumer link" whose evidence is the same nonce and the receipt status on both sources, plus the transaction's `to`/`value` (for (iii)), or `to = from` and value 0 (for a cancel);
- that link can lead only to `ONCHAIN_REVERTED`/P6 or to gas posting, never to `COMPLETED`.

**R4-m4 · wording and stale references · MC-44 / MC-21 · minor**

- **(a) Check order.** §8.4:786-793 lists check 1, a DFNS `GET /wallets/{walletId}`, before check 2. The R3-B2 test (:1177) requires "the fake transport records zero requests", and check 2 says "refused before any DFNS call". Only the §10.1 diagram (:996-997) puts check 2 first. State in §8.4 that check 2 runs before any DFNS call.
- **(b) Stale citation.** OPEN_QUESTIONS.md:140 (Q-N20, "Blocks" column) still cites "Design §8.4 rule 3 proof (c)". Fix block 3 says the term was replaced everywhere; it should read "check 3".
- **(c) Stale table list.** KHUMO_QUESTIONS.md:53 (K-30), the question that goes to Khumo, still lists only "payments, payment legs, inbound-signal inbox, outbox, indexer cursor, rail state". A-30 in the design (:633) now also covers submit markers, operator decisions, nonce holds, and move, funding and case records. Update K-30 so Khumo's answer covers them.

## VERDICT

NEGATIVE (4 defects, all minor: R4-m1 to R4-m4; 0 blocking).

All round-3 defects are closed. Both blocking defects were verified by reconstruction:
- **R3-B1.** In both the "created" and "never arrived" traces, through quote expiry and operator cancel, no P6 or terminal stage is possible while the leg is UNRESOLVED. This is enforced by the orchestrator, by §13.3 and by the store's `LEG_UNRESOLVED`.
- **R3-B2.** Every proof, (a1), (a2), (b), (c) and status 0, ends at a terminal stage with P6, and check 2 then refuses any resubmit.

R3-m1 to R3-m6 are fixed.

The four new minor defects are operability dead ends and consistency gaps. Each fails closed, and none can lose, misplace or double-count money.
