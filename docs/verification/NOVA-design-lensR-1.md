VERIFICATION · lens: R · target: docs/NOVA_ARC_DESIGN.md + docs/KHUMO_QUESTIONS.md + docs/DFNS_SETUP.md · commit: 7fe69e2 (the three targets are untracked; pinned by sha256 prefix: NOVA_ARC_DESIGN d1a97f40ea5c835d, KHUMO_QUESTIONS 142ee8746a87a1f6, DFNS_SETUP 2a931930d0e27486)

Verifier: independent verifier subagent, 2026-10-06. Judged against CO-1 v3 (docs/kit-v3/CHANGE_ORDER.md) D1 scope and Step 6, CLAUDE.md and docs/kit-v3/CLAUDE.md money rules, docs/constants.md, docs/RUBRIC.md, docs/OPEN_QUESTIONS.md, and the archived DFNS pages under docs/sources/dfns/. The operator's binding correction for this run is: "(they pick)they can pay in traditional currency or stable coin and the receiver can receive in traditional currency or stable coin".

No DFNS, Circle or VALR API was called. Nothing was signed or broadcast. No .env file was read. The scratch directory was /tmp/verify-design-xdsn, holding real-file copies only. Public docs were re-fetched from docs.dfns.co only.

## CHECKS

### Mechanical (run)
- `npx tsc --noEmit` (Node from .tools/node/bin) → PASS (exit 0).
- MC-01 float lint `node tools/lint-money-floats.mjs` → PASS ("13 money-path files, 0 finding(s)"). The targets add no code, so this checks only that the repo stays green.
- Semgrep (pinned JS/TS rules) on the 3 target files → PASS (0 findings). This is trivially true for Markdown.
- Semgrep MC-01 rule (`tools/semgrep/mc01-money-float.yml`) on the 9 TypeScript snippets extracted from NOVA_ARC_DESIGN.md (copies in /tmp) → PASS (0 findings). Planted mutant `mutant-float.ts` (`0.0025`, `Number('1.5') * 1.01`) → **3 findings** (mc01-float-literal, mc01-number-parse, mc01-literal-operand), so the rule bites.
- gitleaks on docs/ → PASS ("no leaks found"). A manual grep of the targets for JWT, PEM, API-key and 32-byte hex patterns → none.
- Tests and Stryker → **N/A**. The target is design text only. None of the proposed paths (src/net, src/dfns, src/nova, src/payments) exist, so there are no files to `--mutate`. Instead, document-level mutants were planted in /tmp copies: Q-N12→Q-N99 and [A-41]→[A-49]. The cross-reference checker below caught both.

### Cross-references (reconstructed by script)
- Every Q-xx cited in the three targets has a row in OPEN_QUESTIONS.md → PASS. This includes Q-N1…Q-N19, Q-A1/2/4/5/6/7/13/14, Q-T6 and Q-C5.
- Every C-xx cited exists in constants.md → PASS.
- Every [A-xx] has a §15 register row and a K row tagged with it in KHUMO_QUESTIONS.md → PASS. A-60/61 share one combined row.
- Every K-xx cited in the design exists → PASS.
- CF-27/31/33 exist in LEDGER.md and SEQUENCES.md → PASS.
- Existing-code symbols the design reuses exist → PASS: `pageBlockRange`, `getLogsMaxBlocksPerPage: 9_999n`, `ARC_MAINNET_DISABLED`, `resolveChain`, `assertMainnetAllowed`, `MainnetGateError`, `ROUNDING_POLICY='FLOOR_REMAINDER_RETURNED'`, `nativeWeiToCbsMinor` (returns `{minor, dustWei}`), `cbsMinorToNativeWei`, `nativeWeiToUsdcUnits`, `usdcUnitsToNativeWei`, `formatCbsMinor` and `CbsPrecision`.
- MC-44 section references → FAIL (minor m10).

### Money reconstruction (by hand, k = 10^(18−p))
- p=6, k=10¹². Live receipt C-25 has G = 7,374,356,000,000,000 wei. Then g = ⌊G/k⌋ = 7,374 and d = 356,000,000,000. Check: 7,374·10¹² + 356·10⁹ = G → PASS.
- Boundary G = 1 wei gives g = 0 (P4 omitted) and d = 1. Boundary G = 10¹²−1 gives g = 0 and d = 999,999,999,999 → PASS (no zero-amount legs).
- Sweep: two receipts with d = 10¹²−1 each leave dust 2·10¹²−2 ≥ k. Then j = 1, P5 moves 1 minor in Nova and 10¹² wei in the sub-ledger, and the remainder is 10¹²−2.
  - Chain invariant: start hot = 10¹⁸ wei = 10⁶ minor. Before the sweep, chain = 10¹⁸−2·10¹²+2 = GL-2·k − dust = 10¹⁸ − (2·10¹²−2). After the sweep, (10⁶−1)·10¹² − (10¹²−2) is the same value → PASS.
  - Expense invariant: ΣG = 2·10¹²−2 = GL-3·k + dust = 10¹² + (10¹²−2) → PASS.
- Per-payment conservation: P1 (A+F) = P2 (A) + P3 (F), or P1 = P6. P4 (gas) is funded by GL-7 via P8 → PASS for P1–P8.
- ERC-20 body exactness:
  - p=2, A=12,345 → wei 1.2345·10²⁰ → units 123,450,000, remainder 0 → PASS.
  - p=8, A=1 → wei 10¹⁰ → units 0, remainder 10¹⁰ → refused, as §8.5 says → PASS.
- Keys: externalId = `nv1-` + 40 hex = 44 chars ≤ 50 [DF:transfer maxLength 50] → PASS.
- Keys: the payment-id derivation has no delimiter, and the key charset is inconsistent → FAIL (minor m3).

### CO-1 v3 D1 scope (re-traced item by item)
- Network abstraction `ARC`/`USDC`, with Arc rules only in the adapter (§5.2, plus a dependency lint, §3) → PASS.
- Testnet config, with mainnet present but disabled and CI tests (a)–(d) (§11) → PASS.
- DFNS `ArcTestnet` wallet and balance read (§8.2) → PASS.
- Transfer with DFNS policy approval, then broadcast (§8.2, §8.6, DFNS_SETUP POL-1) → PASS for the flow. The DFNS_SETUP control defects are B3 and B4.
- Confirmation from our own system-emitter log, with DFNS as cross-check (§2 rule 6, §6.5) → FAIL: the rule contradicts itself (B2).
- Postings via Nova's ledger, gas in USDC with dust handled (§9) → PASS (reconstructed above).
- `GET /payments/:id` (§10.5): decimal strings via U1 → PASS.
- Webhook replaced by HMAC-verified `POST /webhooks/dfns` plus our own indexer (§8.7) → PASS.
- "Not now" list respected. The fiat payout port is a stub only → PASS.

### CO-1 v3 Step 6 status model
- Public `TransactionStatus` kept, with the five values [A-31] → PASS.
- Stage list exactly CREATED…CANCELLED → PASS.
- One mapping table (§13.2), total over stage × reason → PASS.
- Blocklisted pre-mempool → REJECTED → FAILED, and under-floor drop → EXPIRED → FAILED, each with a reason → PASS for the mapping. The release rule behind F-3b fails (B1).
- `REVERSED` only via a P7 compensating entry, never on-chain (§12 note, §13.2) → PASS.
- Legal-transition table (§13.3) is incomplete for observed DFNS sequences → FAIL (minor m1).

### Operator journey correction (payer picks, receiver picks)
- Four combinations modelled (§4.1). Only USDC→USDC is live, the fiat legs sit behind ports and flags, and fiat→fiat is asked as K-56/Q-N19 → PASS.
- The receiver's choice is taken from the payer's request, not from the receiver → FAIL (minor m4).

### DFNS facts re-checked against the archive (docs/sources/dfns/…). Pages marked * were also re-fetched live from docs.dfns.co today, and the archive is byte-identical after trimming trailing whitespace.
- Arc row "| Arc | ArcTestnet | 1 | N/A | 10 | | |" (networks_index.md:34*) → PASS.
- Webhook ordering is not guaranteed (webhook-events.md:279) and uniqueness is not guaranteed (guides_developers_webhooks.md:117). Retries are new events with `deliveryAttempt`/`retryOf` (webhook-events.md:292-294) → PASS. The "5 times" wording is minor (m9).
- `X-DFNS-WEBHOOK-SIGNATURE: sha256=<hex>`, HMAC-SHA256, `timingSafeEqual`, the example HMACs `JSON.stringify(eventPayload)`, and the 5-minute tolerance on `timestampSent` (webhooks guide:36-73) → PASS. The secret is shown only once (webhooks guide:39) → PASS.
- Region hosts api.dfns.io and api.uae.dfns.io, both mainnet and testnet per region, and the Europe webhook IP 35.181.116.68 (regions.md:22-25, 57-61) → PASS.
- Content-type and a non-empty User-agent (api-reference_index.md:27-28). The bearer scheme and `X-DFNS-USERACTION` come from transfer-asset securitySchemes (4923-4936) → PASS.
- Rate limit is per organisation over a 60-second window, with `Retry-After` (rate-limits.md:18-28) → PASS.
- `/auth/action/init` takes `userActionHttpMethod`/`Path`/`Payload` and returns `challengeIdentifier`. `/auth/action` takes `firstFactor` with kind `Key`. The challenge expires after 15 minutes and is single-use (signing-requests.md:32, 51) → PASS.
- Service-account keys: RSA ≥ 2048, P-256 or Ed25519, as PEM SPKI. The token lasts 2 years by default, which is also the maximum, and is shown once. A new account has no permissions. The service-account create API rejects PATs (gate-sa:74) → PASS. "Ed25519 is preferred" is attributed to DFNS but is our own preference (m9).
- Transfer body: `amount` matches `^\d+$` ("minimum denomination"), `externalId` is 1–50 chars, `priority` is one of Slow/Standard/Fast, `memo` applies to supported networks only, there is no network field (networks_evm.md:57), and the only fee control is `priority` (create-transfers.md:187) → PASS.
- "Never submit a second Transfer Asset request to 'retry'…" quote (create-transfers.md:206) → PASS verbatim.
- Status enum and transitions (transfer-asset 4677-4710; transaction-monitoring.md:37-40). `Executing` is "only set for a short time between pending and broadcasted". `Broadcasted` means "written to the mempool" → PASS. Both facts drive m1 and B1.
- Idempotency (idempotency.md*): the same body returns 200 with the existing entity; the same externalId with a different body returns 409; the externalId is bound permanently after a terminal status; txHash present means it failed on-chain, absent means off-chain → PASS.
- Transfer Asset OpenAPI lists only 200, while error-codes.md:141 has "Policy pending (202)". This is correctly raised as Q-N11 → PASS.
- Abort: PUT, only while `Executing` and not yet signed, and it sets `Failed`. Cancel: POST, a 0-value same-nonce replacement that is not guaranteed → PASS.
- Permission names: `Wallets:Read`, `Wallets:Transfers:Create/Read/Abort`, `Wallets:Create`, `Wallets:Update`, `Policies:Evaluations:Read` (which includes `GET /v2/policy-approvals/{approvalId}`), `Policies:Evaluations:Vote` and `Webhooks:Events:Read` all exist in roles-and-permissions.md*. `Wallets:Sign` appears only in service-account.md:89 (Q-N15) → PASS for the names. **`Wallets:Transfers:Read` also grants POST cancel and POST speed-up (lines 1036-1042, live identical) → FAIL against DFNS_SETUP §4 (B3).**
- Policies (core-concepts_policies.md):
  - "Delegated wallets bypass policies" and `walletTags.hasAny` → PASS.
  - Block wins, and all matching policies are evaluated → PASS.
  - Any approver rejecting cancels the transfer, and the initiator cannot approve by default → PASS.
  - `serviceAccountsCanApprove` defaults to false → PASS.
  - Value rules fail closed on contract calls and 0-value transfers → PASS.
  - `autoRejectTimeout` is in minutes and optional → PASS.
- `TransactionAmountLimitNominal` takes `{network, tid, limit}` and fails closed if the asset or amount is unknown → PASS. **"A transfer of an asset that is not listed does not trigger the rule" (create-policy.md, assets description; live page has the sentence) → not handled by DFNS_SETUP POL-2 (B4).**
- Estimate Fees `GET /networks/fees`: `ArcTestnet` is in the enum, and `maxFeePerGas`/`maxPriorityFeePerGas` are wei strings for slow/standard/fast → PASS. The design's "bearer token only" is wrong: the OpenAPI has `security: []` (m9).
- Wallet assets: `balance` is a string in the smallest unit (displaying-balances.md:9) and `quotes.USD` is a number (never read) → PASS.
- Get Wallet `status` is Active/Inactive/Archived; list-transfers takes `limit`/`paginationToken` and returns `nextPageToken`; create-webhook requires `url` and `events`; the testnet guide's dashboard path and "Do not reuse Testnet wallets for Mainnet usage." → PASS.
- **No DFNS endpoint, field, header or state was found to be invented.** Every one resolves to an archived page.

### Arc facts
- Every C-id used matches constants.md: C-01/02/03/04/06, C-10/11/12/15, C-20…C-28, C-30/31, C-40/41/42, C-50/51/53/54/55/57, C-62/63/64/65 → PASS. Live re-fetch of docs.arc.io was **not** repeated this pass (the source-drift tool also touches non-DFNS/Arc hosts, so it was stopped before writing anything). [inspection-only against archive]
- The F-3b "rejected before the mempool" claim is cited to C-53, but C-53 says the transaction is included, reverts and consumes gas. The pre-mempool claim is a CO-1/kit claim, still open as Q-A13 → minor citation defect (m9).

### Judgment lenses (one-line anchors)
- JL-1 fail-closed: mostly strong (PAUSE/QUARANTINE everywhere, webhook only as a hint, no auto-resubmission). It fails at F-3b (B1) and at the §6.5 fallback (B2). [judgment]
- JL-2 human-owned: ages, caps, quorum and dust ownership are all routed to Ops or Khumo → PASS. [judgment]
- JL-3 03:00 operability: m1 and m2 would cause routine false QUARANTINEs. [judgment]
- JL-4 auditability: journal refs carry paymentId, txHash, logIndex and dfnsTransferId → PASS. B2 can attach the wrong tx to a payment. [judgment]
- JL-5 fewest new parts: ports onto Nova. The one new store (GasDustStore) exists only if K-11 says it must → PASS. [judgment]
- JL-6 privacy: no memo, no PII on-chain → PASS. [judgment]

## DEFECTS

**B1 · NOVA_ARC_DESIGN.md:751 (F-3b) with :753 (F-4) and :567 (§8.4 rule 3) · RUBRIC MC-13 / JL-1 · severity blocking**

The text is: F-3b "DFNS `Failed`, no `txHash`; **or no receipt and no log after `T_pending`**" → `REJECTED / BLOCKLISTED_PRE_MEMPOOL` → "**P6, no gas**".

The same observation (a txHash with no receipt and no log after `T_pending`) is F-4's trigger. F-4 correctly holds the funds until non-inclusion is proven ("P6 only after proof … QUARANTINE until proven"). F-3b instead releases the reservation on a timer. DFNS defines `Broadcasted` as "written to the mempool", so a transfer that has a hash was not rejected before the mempool.

Failure path: the transaction lands after `T_pending`, so the payer has been refunded (P6) and the money has also left the hot wallet. The money is lost or paid twice. MC-13 requires "drop, then late inclusion → no release".

Rule 3 has a related weakness: it allows a new attempt after "DFNS `Failed` with our indexer showing no log". Absence of a log is not proof of non-inclusion.

Fix: F-3b may release only on the off-chain branch (DFNS `Failed` with no `txHash`). The timer branch must follow F-4's proof standard: the nonce is consumed by another transaction, or DFNS reports an off-chain failure. Rule 3 should use the same standard.

**B2 · NOVA_ARC_DESIGN.md:252 (§6.5 rule 1) vs :728 (§10.4) and :761 (F-12) · CO-1 rubric "communication integrity", MC-17(a) · severity blocking**

§6.5 lists as sufficient for COMPLETED: "if DFNS has not reported a hash yet, a log whose `from` is our bound wallet and whose `(to, value)` equals the binding and **which no other payment has claimed**". §10.4 says such a link is only provisional and "becomes `COMPLETED` only when DFNS's `txHash` … arrives and equals it", and that it needs *exactly one* candidate.

Failure path: open payments P and Q, from different payers, have the same `(to, amount)`. Q's log arrives first and is unclaimed, so §6.5 completes P on it. P's own DFNS transfer then fails, and the state is STALE because P is already terminal. Q waits, gets quarantined, and may be released. P's payer has paid for Q's transfer, and Q's payer gets refunded for money that actually left. That is a cross-customer misposting.

Fix: make §6.5 rule 1 identical to §10.4: a provisional link never completes without DFNS's matching hash, and needs exactly one candidate.

**B3 · DFNS_SETUP.md:50-51 (SA-1/SA-2 roles) and NOVA_ARC_DESIGN.md:552 · least privilege / required control / DFNS fact misstated · severity blocking**

DFNS_SETUP gives both service accounts `Wallets:Transfers:Read`. It calls SA-2 "Independent read-only cross-check … Must NOT have: Anything that writes". The archived and live roles page lists, under `Wallets:Transfers:Read`: "Cancel transfer (POST …/cancel)" and "Speed up transfer (POST …/speed-up)" (core-concepts_roles-and-permissions.md:1036-1042). Speed-up creates "a replacement transaction with the same nonce … higher gas fees (maximum between 10% bump or Fast network fees)" (live docs.dfns.co speed-up-transfer page).

Consequences:
- (a) the "read-only" monitor credential can mutate transfers;
- (b) the design's "operator-initiated only (two-person)" cancel (§8.2) cannot be enforced at DFNS, because both service accounts can cancel;
- (c) speed-up bypasses gateway check 7's fee ceiling (Q-N8), and only the post-check pages;
- (d) a replacement changes the txHash, so the §6.5 hash match fails and §6.7 pauses the rail. That outcome is fail-closed, but it is not documented.

Fix:
- State the fact in DFNS_SETUP and the design.
- Ask DFNS whether cancel and speed-up are policy-gated (POL-1 `Wallets:Sign`). Extend Q-N15.
- Give SA-2 a read path without `Wallets:Transfers:Read` (for example wallet history plus webhook events), or record the residual risk.
- Add a speed-up/replacement row to §12.

**B4 · DFNS_SETUP.md:70 (POL-2) and :27 (Q-N18) · control bypass · severity blocking**

POL-2 configures `TransactionAmountLimitNominal` with a single `tid`. Q-N18 asks for "the DFNS token identifier (`tid`)", in the singular. DFNS says of this rule: "A transfer of an asset that is not listed does not trigger the rule" (create-policy.md, `assets` description; present on the live page).

Arc USDC is one balance with two interfaces: native at 18 dp (C-10) and ERC-20 at `0x3600…0000` (C-12). Which interface DFNS uses is still open (Q-N1). If only one tid is listed, an over-cap transfer sent through the other `kind` moves without the hard cap.

Fix: POL-2 must list every tid that can move Arc USDC (for example both `native:…` and `erc20:0x3600000000000000000000000000000000000000`). Alternatively, Q-N18 must confirm that only one exists. Reword Q-N18 to ask for all of them.

**m1 · NOVA_ARC_DESIGN.md:799 (§13.3) · MC-11 · minor**

The legal-transition table has no `PENDING_APPROVAL → SUBMITTED`. DFNS `Executing` is "only set for a short time between pending and broadcasted", so a poll will often see Pending, then Broadcasted. The table also lacks `SUBMITTED → COMPLETED` and `APPROVED → CANCELLED|EXPIRED`, although the text says "`CANCELLED` is allowed only before `SUBMITTED`".

As written, normal payments become `ILLEGAL_TRANSITION` and are quarantined. This fails closed, but it is routine. Define how one signal applies intermediate stages.

**m2 · NOVA_ARC_DESIGN.md:446, :722 · MC-18 · minor**

The webhook and the follow-up GET share the dedupe key `dfns:transfer:<id>:<status>`. Different `payloadDigest` values under the same key → `SIGNAL_CONFLICT` → QUARANTINE. The digest's canonical input is unspecified: the webhook envelope differs from the GET body, and each retry has a new event id. Specify a digest over normalised entity fields.

**m3 · NOVA_ARC_DESIGN.md:711-712 with :276 · MC-10 · minor**

`sha256(payer ‖ Idempotency-Key)` has no delimiter or length prefix: payer "u1" with key "x" and payer "u" with key "1x" collide. Separately, `pay_` plus base32 contains `_` and upper-case letters, which break the declared `IdempotencyKey` charset `[a-z0-9:-]` once embedded in `pay:<paymentId>:p1`.

**m4 · NOVA_ARC_DESIGN.md:117-118, :681 · operator correction fidelity · minor**

The correction says the receiver picks the payout ("the receiver can receive in traditional currency or stable coin"; LEDGER CO-1 says "recipient's chosen currency"). The design takes `PayoutMethod` from the payer's create request. Resolve the payout method server-side from the receiver or beneficiary record [A-41], as is already done for the destination. Extend K-41 to ask where the receiver's preference is stored.

**m5 · NOVA_ARC_DESIGN.md:637 (P2I), :806 (D2), :570 (check 6) · MC-04/MC-47 · minor (D2)**

An internal transfer to a customer deposit wallet is also seen by D2's inbound crediting (`topic2 = our address`), and no ours-to-ours classification rule exists. The inbox primary key prevents a double credit, but whichever path claims the log first wins, so the payment strands or is credited by the wrong template. Check 6's "not ours-to-ours self-transfer" is also ambiguous against P2I.

**m6 · NOVA_ARC_DESIGN.md:766 (F-17) · MC-04 · minor (D5)**

Funds that sit at the payout partner after a failed payout belong to no GL role. P2/P3 stay posted while the public status is FAILED. Keep them in clearing, or add a partner-receivable role.

**m7 · NOVA_ARC_DESIGN.md:225, :648, :660 · JL-1/JL-3 · minor**

D1 indexes outbound only, but any chain drift causes a PAUSE. An unsolicited inbound transfer to the public hot wallet, which anyone can send, pauses the rail, and D1 has no unidentified-receipt path (GL-4 `arc.unidentified` is D2).

**m8 · NOVA_ARC_DESIGN.md:513 · MC-06 · minor**

`PRECISION_MISMATCH` → QUARANTINE per payment. The rubric requires a PAUSE before any posting, plus a known-amount onboarding test.

**m9 · citations and wording · MC-21/MC-44 · minor**
- §8.2 says the fee estimate needs a "bearer token only", but estimate-fees.md:27 has `security: []`.
- §8.7 says "answer 2xx", but DFNS treats anything other than **200** as a failure (webhook-events.md:288).
- "Retries up to 5 times" should be "up to 5 total attempts" (:290).
- §6.2 says "one block below the documented page size". 9,999 blocks *is* the documented page size; it is one below the 10,000 cap.
- F-3b cites C-53 for a pre-mempool rejection. C-53 says the transaction is included, reverts and consumes gas (Q-A13).
- DFNS_SETUP §4 says "Ed25519 is preferred (guides_developers_service-account.md)". The guide's example is RSA; Ed25519 is only "if you prefer".

**m10 · NOVA_ARC_DESIGN.md:70, :190, :805, :225 · MC-44 · minor**
- §2 rule 3 cites "§9.3" for dust suspense; the dust rules are in §9.2.
- §5.1 says "§7.6 open question Q-N1"; §7.6 is InvoicePort, and the reference should be §8.5.
- §14 cites "DFNS_SETUP §6" for `Wallets:Create`; it is at the end of §3.
- §6.1 calls `listWallets('ARC')`, but the port declares `list(network, role?)`.

**m11 · NOVA_ARC_DESIGN.md:754 (F-5) vs DFNS_SETUP.md:71 (POL-3) · minor**

DFNS cancel is a 0-value same-nonce replacement, and POL-3 ("also blocks … 0-value transactions") would probably block it. The operator's F-5 cancel option is then unavailable without a policy change. Say so.

**m12 · NOVA_ARC_DESIGN.md:240 vs :236 and :255 · JL-1 · minor**

The live testnet slice runs from a single source, while §6.2 and §6.5 rule 4 say one source alone cannot confirm. Make the exception an explicit testnet-only config flag, with a test proving it can't be enabled with mainnet.

## VERDICT

NEGATIVE (16 defects: 4 blocking, B1–B4; 12 minor, m1–m12)
