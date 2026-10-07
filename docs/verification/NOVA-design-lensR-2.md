VERIFICATION · lens: R · target: docs/NOVA_ARC_DESIGN.md + docs/KHUMO_QUESTIONS.md + docs/DFNS_SETUP.md (after fix block 1) · commit: 7fe69e2 (the three targets are untracked; pinned by sha256 prefix: NOVA_ARC_DESIGN 23a42a15ff1759fa, KHUMO_QUESTIONS 2cea5a8f1dede89f, DFNS_SETUP 8b0fa0fcc57216c6)

Verifier: independent verifier subagent, 2026-10-06. This is round 2, after the fix block that answers `NOVA-design-lensR-1.md`.

Judged against:
- CO-1 v3 (docs/kit-v3/CHANGE_ORDER.md): D1 scope and Step 6;
- CLAUDE.md and docs/kit-v3/CLAUDE.md money rules;
- docs/constants.md and docs/RUBRIC.md;
- the archived DFNS pages under docs/sources/dfns/.

Binding operator correction: "(they pick)they can pay in traditional currency or stable coin and the receiver can receive in traditional currency or stable coin".

Safety statement:
- No DFNS, Circle or VALR API was called. Nothing was signed or broadcast. No .env file was read.
- Scratch dirs were /tmp/verify-design2-VUxF and /tmp/verify-design2-mut-*, holding real-file copies only, no symlinks.
- No live re-fetch was done this round. Every DFNS fact was re-checked against its archive, and Arc facts against constants.md. [archive-only]

## CHECKS

### Mechanical (run)
- `npx tsc --noEmit` (Node v22.23.3 from .tools/node/bin) → PASS (exit 0).
- MC-01 float lint `node tools/lint-money-floats.mjs` → PASS ("13 money-path files, 0 finding(s)").
- `vitest run --project unit --project property` → PASS (13 files, 600 tests). This only shows the repo is still green; the target adds no code.
- Semgrep MC-01 (`tools/semgrep/mc01-money-float.yml`) on the 10 TypeScript snippets extracted from NOVA_ARC_DESIGN.md → PASS (0 findings).
  - Planted mutant `mutant-float.ts` (`0.0025`, `Number(a) * 1.01`) → 4 findings (float-literal ×2, number-parse, literal-operand), so the rule bites.
- gitleaks on the three target copies and on docs/ → PASS ("no leaks found").
  - A grep for JWT, PEM, `sk_` and long-token patterns → only public contract addresses (C-12, C-20).
- Tests and Stryker on the target's files → **N/A**. The target is design text only. None of the proposed paths (src/net, src/dfns, src/nova, src/payments) exist, so there is no file to pass to `--mutate`.
  - Instead, document mutants were planted in /tmp copies: Q-N15→Q-N98, C-53→C-99, [A-41]→[A-49] and DF:cancel→DF:cancelx. The cross-reference script caught all four.

### Cross-references (reconstructed by script /tmp/verify-design2-VUxF/xref.py)
- Every Q-xx in the three targets resolves in OPEN_QUESTIONS.md, including the new Q-N18 and the extended Q-N15 → PASS.
- Every C-xx resolves in constants.md, and every CF-xx in LEDGER/SEQUENCES → PASS.
- Every [A-xx] has a §15 row (A-60/61 combined) and a K row, and every K-xx exists → PASS.
- Every DF:key is in the §0.1 key table, and every file in that table and every file cited in DFNS_SETUP exists under docs/sources/dfns/ and in MANIFEST.md → PASS.
- Section references → FAIL (minor m9).

### Money reconstruction (script /tmp/verify-design2-VUxF/inv.mjs, BigInt, k = 10^(18−p))
- C-25 receipt at p=6: G = 7,374,356,000,000,000 → g = 7,374, d = 356,000,000,000 → PASS.
- Mixed sequence of gas receipts (G ∈ {1, k−1, k−1, C-25 value, k, 3k+5}), automatic P5 sweeps, and an unidentified inbound (P9/P9D) of G+1 after each receipt, for p = 6, 2 and 18. Results:
  - chain invariant (wei = arc.hot·k − gasDust + arc.hot.subminor) → true;
  - expense invariant (ΣG = GL-3·k + gasDust) → true;
  - unidentified invariant (Σvalue = arc.unidentified·k + receiptDust) → true;
  - gasDust < k after each sweep → true.
  → PASS.
- Per payment, P1 = P2+P3 or P1 = P6, re-traced for STABLECOIN_WALLET → PASS.
  - The P2P/P2 pair for FIAT_BANK nets arc.hot −A and partner 0 on PAID → PASS.
  - The return path after a failed payout → FAIL (m6).
  - The INTERNAL top-up → FAIL (B2).
- Keys (script keys.mjs):
  - The `lp()` derivation separates (u1, x) from (u, 1x); the naive concatenation collides.
  - requestKey is 68 chars and paymentId 36.
  - `pay:<id>:p1` is 43 chars and matches `[a-z0-9:-]`.
  - externalId is 44 chars ≤ 50 [DF:transfer], including attempt 2^64, and attempts 1 and 2 give different values.
  - `gas:5042002:<0x…64>` is 78 chars.
  - 2,000 distinct (payer, key) pairs gave 0 duplicates.
  → PASS. Missing keys and the case of the hash → m7.

### Prior defects (NOVA-design-lensR-1), re-checked
| Prior | Status | Evidence |
|---|---|---|
| B1 F-3b timer release | **Timer branch FIXED. Off-chain branch: residual, now blocking B1** | F-3b:817 is now "**Only** DFNS `Failed` with no `txHash` and no `dateBroadcasted`". F-4:819 says "A timer alone never releases". §8.4 rule 3:610-614 defines proofs (a) and (b), and "No log seen yet is **never** proof". Proof (a) does not cover a transfer that was signed and then failed off-chain (B1 below) |
| B2 §6.5 completes on an unclaimed log | FIXED | §6.5 rule 1:264 says "There is no other way to satisfy this rule … it never completes anything". It matches §10.4:794 |
| B3 Transfers:Read grants cancel and speed-up | FIXED (residual m2) | §8.2:591-595 and DFNS_SETUP:48-56: SA-2 no longer gets `Wallets:Transfers:Read`, the client allow-list refuses cancel/speed-up/abort, the residual risk is recorded, F-18 was added, and Q-N15 (2) is in OPEN_QUESTIONS:134 |
| B4 POL-2 single tid | FIXED (residual m3) | DFNS_SETUP:75 says "one entry per `tid`". Q-N18 is in OPEN_QUESTIONS:137. The gateway refuses any other `kind` until Q-N18 is answered |
| m1 legal transitions | FIXED | §13.3:867-890 allows forward jumps, applies one signal across skipped stages, and adds a test over every DFNS sequence |
| m2 digest input | FIXED | §10.3:779-788 defines a normalised projection |
| m3 key delimiter and charset | FIXED | §10.2:766 (reconstructed above) |
| m4 receiver picks | FIXED | §4.1:121, `ReceiverPort` §7.5a, `PAYOUT_NOT_PAYER_CHOICE`, K-41 extended |
| m5 ours-to-ours | FIXED | §6.1:226-235 classification table. A new posting defect on that path is B2 |
| m6 partner funds after a failed payout | PARTIAL → m6 | F-17:832 keeps the funds in clearing and partner. The return leg is missing |
| m7 unsolicited inbound pauses | FIXED | P9/P9D and F-19 added |
| m8 PRECISION_MISMATCH | FIXED | §7.2:366 and §7.7:549 → PAUSE before posting, plus an onboarding test |
| m9 citations | FIXED, except the fee-auth claim → m1 | The answer is exactly 200, "5 total attempts", the 9,999 wording is corrected, F-3b no longer cites C-53, and Ed25519 is labelled as our choice |
| m10 section references | FIXED | §2 rule 3 → §9.2; §5.1 → §8.5; §14 → DFNS_SETUP §3; `list('ARC')` |
| m11 cancel blocked by POL-3 | FIXED (extended by m3) | F-5:820 and DFNS_SETUP:76 |
| m12 single source | FIXED | §6.3:252 `arc.indexer.singleSourceTestnetOnly`, with CI test (e) in §11:806 |

### CO-1 v3 D1 scope and Step 6 (re-traced)
- Network abstraction, testnet config with mainnet present but disabled, CI tests (a)–(e) → PASS.
- DFNS `ArcTestnet` wallet and balance read, and transfer with policy approval → PASS.
- Confirmation from our own indexer, with DFNS only as the hash link (§2 rule 6, §6.5) → PASS. This round the rule is consistent everywhere it appears.
- Gas posted in USDC, with dust going to suspense → PASS (reconstructed).
- `GET /payments/:id` returns decimal strings → PASS.
- Webhook is HMAC-checked over the raw body, deduped on the entity, and used only as a hint → PASS.
- Step 6:
  - the five-value public status is kept, the stage list is exact, and the mapping table is total → PASS;
  - REVERSED is set only via P7 → PASS;
  - "blocklisted pre-mempool → FAILED with reason" → PASS on the mapping, but its release rule is B1;
  - "under-floor drop → FAILED with reason" → PASS, released only after proof (b).
- Operator correction: four combinations; the payer picks the pay-in; the receiver's payout is resolved server-side and frozen with a preference version; only USDC→USDC is live; fiat legs sit behind ports and closed flags; fiat→fiat is asked as K-56 → PASS.

### DFNS facts re-checked against the archive
- `Wallets:Transfers:Read` lists Cancel transfer, Speed up transfer, Get transfer and List transfers (core-concepts_roles-and-permissions.md:1036-1042) → PASS.
  - **Also in the archive (:1003-1011): `Wallets:Transactions:Create` grants "Cancel transfer" and "Speed up transfer" too, and the default role (:93) includes it** → m2.
- `Wallets:Read` grants Get wallet history, List org wallet history and the Canton proxy POST (:969-977). `Webhooks:Events:Read` grants Get/List webhook events (:1068-1071). `Policies:Evaluations:Read` grants Get approval (:770-772) → PASS. SA-2's read path exists.
- Speed-up "10% bump or current Fast fees, whichever is higher" (networks_evm.md:89, verbatim) → PASS.
  - Cancel is a "zero-value self-transfer" (networks_evm.md:90), "to the same wallet address with 0 amount" (cancel-transfer.md:16), and requires `userActionSignature` (:93) → PASS.
  - **Cancel also works for "Transfers that are in 'Failed' status, but failed off-chain", by "Extracting the nonce from the original transfer's signed data" to "Consume the nonce that was reserved but not used" (cancel-transfer.md:12-19). networks_evm.md:85 says the same for aborted transactions, "to burn the reserved nonce"** → drives B1.
- TransferRequest has `replacementId` ("replacement transaction (cancel or speed-up)"), `dateBroadcasted`, `datePolicyResolved`, `details` ("e.g. nonce") and required `requestBody` (get-transfer.md:2290-2366) → PASS.
- `Failed` = "either system failure to complete the request or the transaction failed on chain" (get-transfer.md:2285). A missing txHash means an off-chain failure (idempotency.md:42) → PASS as quoted. See B1 for what it does not prove.
- `Broadcasted` = "Signed and sent to the network mempool" (transaction-monitoring.md:47). `Executing` is "only set for a short time" (transfer-asset.md:4698). `Pending → Rejected` (monitoring.md:38) → PASS.
- `TransactionAmountLimitNominal`:
  - `tid` examples are `native:eth` and `erc20:0x…`, and contract addresses must be lower-case;
  - `limit` is in "the minimum denomination of the asset";
  - "A transfer of an asset that is not listed does not trigger the rule";
  - it fails closed if the amount or the asset cannot be determined (create-policy.md:1229-1296).
  → PASS.
- policies.md:68: the value rules fail closed on contract calls and 0-value transactions → PASS. **This applies to POL-2 as well as POL-3** → m3.
- Webhooks:
  - `data.transferRequest`, `timestampSent`, `deliveryAttempt` and `retryOf` (webhook-events.md:26, 44, 294);
  - only 200 counts as delivered; "up to 5 total attempts over 24 hours" (:288-290);
  - event names (:69-86).
  → PASS.
- **Fee estimate auth: §8.2:582 says "none: the archived OpenAPI declares `security: []`". The archive has top-level `security: []` (estimate-fees.md:27) but operation-level `security: - authenticationToken: []` (:395-396), which overrides it. A bearer token is required** → FAIL (m1). My round-1 m9 bullet was itself wrong and induced this. No money impact, because the design sends the bearer header anyway.
- Arc row "| Arc | ArcTestnet | 1 | N/A | 10 | | |" (networks_index.md:34) → PASS.
- No invented DFNS endpoint, field, header or state was found. [archive-only]

### Arc facts
- Every C-id used matches its constants.md row: C-01/02/03/04/06, C-10/11/12/15, C-20…C-28, C-30/31, C-40/41/42, C-50/51/53/54/55/57, C-62/63/64/65. The F-3b and C-53 wording is now correct → PASS. [archive-only, no live re-fetch this round]

### Judgment lenses
- JL-1 fail-closed: strong. Release happens only on proof, an unlinked log PAUSEs the rail, and precision is a PAUSE. The exception is B1 (signed bytes released early). [judgment]
- JL-2 human-owned decisions: PASS. Caps, ages, quorum, dust and receiver preferences are all routed to humans. [judgment]
- JL-3 03:00 operability: m4 and m5. [judgment]
- JL-4 auditability: m5 (a cancel is reported as a fee-floor drop); otherwise PASS. [judgment]
- JL-5 fewest new parts: PASS. [judgment]
- JL-6 privacy: PASS. [judgment]

## DEFECTS

**B1 · NOVA_ARC_DESIGN.md:611 (§8.4 rule 3(a)), :643 (§8.6 `Failed` no-txHash row), :690 (P6), :817 (F-3b), :875 (§13.3) · RUBRIC MC-13, MC-17(a) · severity blocking**

Proof (a) says DFNS "`Failed` with no `txHash` and no `dateBroadcasted` … Nothing was broadcast". On that proof it releases the reservation (P6, "the **only** status-driven release") and permits attempt+1. The archive shows that an off-chain-failed transfer can already be signed with a reserved nonce: cancel works for "Transfers that are in 'Failed' status, but failed off-chain" by "Extracting the nonce from the original transfer's signed data" and "Consume the nonce that was reserved but not used" (cancel-transfer.md:12-19; networks_evm.md:85). DFNS `Failed` also covers "system failure to complete the request" (get-transfer.md:2285).

Failure path: DFNS signs, its broadcast call errors after a node has already accepted the transaction, and DFNS records `Failed` with no hash. We post P6 (the payer is refunded) and submit attempt 2. Both transactions land, so the money leaves twice. §6.7 detects this only afterwards (PAUSE). MC-13: "A hold or reservation outlives nonce resolution"; "drop, then late inclusion → no release".

The unburned reserved nonce also blocks every later transfer from the wallet, and nothing addresses that.

Fix:
- Proof (a) stands only where DFNS shows the transfer was never signed: `Rejected` by policy, or an abort accepted while `Executing` and unsigned.
- Any other hash-less `Failed` needs nonce resolution. Take the nonce from `details`. At a block both sources agree on, the account nonce must be above it with no matching unlinked log, for example after an operator cancel burns it. This is proof (b) generalised to attempts without a hash.
- If the nonce is unknown, QUARANTINE.
- Add the nonce-burn step to F-3b.

This tightens the fix I recommended in round 1.

**B2 · NOVA_ARC_DESIGN.md:231 (§6.1 INTERNAL row) with :692 (P8) and :667 (GL-2 "one per DFNS wallet") · MC-04 / double count · severity blocking**

INTERNAL logs may be claimed by "an approved internal move record (for example a P8 gas-float top-up from a company wallet)". P8 posts DR GL-2 `arc.hot` / CR GL-7 when "the indexer sees the `INBOUND`/`INTERNAL` log".

For a move between two of our wallets (for example GAS_FLOAT → TREASURY_HOT, both roles indexed in §6.1:225), the source wallet's GL-2 sub-account is never credited. GL-7 funding is credited instead, so company USDC assets and funding are both overstated by X. The source wallet's per-wallet chain invariant is off by X plus the gas of that transaction, which is also unassigned: P4 credits `arc.hot` generically. Reconciliation then PAUSEs, but the template itself misposts.

Fix:
- Add a separate internal-move template (DR GL-2 `arc.<dest>` / CR GL-2 `arc.<source>`).
- Make P4 always credit the sending wallet's sub-account.
- Restrict P8 to `INBOUND` funding from outside the registry.

**m1 · NOVA_ARC_DESIGN.md:582 · MC-21 DFNS fact misread · minor**

The design says the fee estimate needs no auth because of `security: []`. The operation-level `security: - authenticationToken: []` (estimate-fees.md:395-396) overrides the top-level declaration, so a bearer token is required. Restore "bearer token". This error came from my own round-1 note. There is no money impact, because the headers are sent anyway.

**m2 · NOVA_ARC_DESIGN.md:591, DFNS_SETUP.md:48, :55-56 · least privilege, incomplete DFNS fact · minor**

`Wallets:Transactions:Create` also grants Cancel transfer and Speed up transfer, and `Wallets:Transactions:Read` grants cancel and speed-up of transactions (roles-and-permissions.md:1003-1018). DFNS's default service-account role includes both (:93).

The design says these grants come "under `Wallets:Transfers:Read`" as if that were the only source. Neither SA's "Must NOT have" list names `Wallets:Transactions:*`. The assign column is an explicit allow-list, so this is minor. Add both to the must-not lists and to the stated fact, and extend Q-N15.

**m3 · DFNS_SETUP.md:75-76, NOVA_ARC_DESIGN.md:820 (F-5) · minor**

- **The 0-value rule hits POL-2 too.** policies.md:68 says `TransactionAmountLimitNominal` also fails closed on 0-value transactions, so POL-2 (Block) blocks a DFNS cancel just as POL-3 does. Only POL-3 is named.
- **The native limit assumes 18 dp.** POL-2's native limit `L × 10^12` assumes that DFNS's minimum denomination for Arc native USDC is 18 dp. That is Q-N2, which is still open. If DFNS used 6 dp, the cap would be 10^12 times too loose. Cite Q-N2 in POL-2.

**m4 · NOVA_ARC_DESIGN.md:278 (§6.7) vs :794 (§10.4) and :827 (F-12) · JL-3 · minor**

The first sentence of §6.7 makes any outbound log that "is not a provisional candidate of exactly one open payment" an immediate `UNKNOWN_EVENT` → PAUSE. That includes the two-candidate case. F-12 says the rail action is "none (by design)", and the second sentence of §6.7 implies ambiguous candidates are exempt until `A_xcheck`. The text is self-contradictory but fails closed. Exempt ambiguous candidates explicitly until `A_xcheck`.

**m5 · NOVA_ARC_DESIGN.md:833 (F-18 cancel), :876, :880 (§13.3) · MC-44 / JL-4 · minor**

An operator cancel of a broadcast transfer ends with proof (b) and then P6. The legal targets from `SUBMITTED`/`CONFIRMING` are only `REJECTED/ONCHAIN_REVERTED` and `EXPIRED/UNDER_FEE_FLOOR_DROPPED`, and `CANCELLED` is allowed only before `SUBMITTED`. A cancelled transfer is therefore reported as an under-floor drop. Add a reason (for example `CANCELLED_REPLACED`) or allow `CANCELLED` after proof (b).

**m6 · NOVA_ARC_DESIGN.md:832 (F-17), :232 (§6.1 INBOUND row), :690 (P6) · MC-04 (D5, flag closed) · minor**

The partner's return of USDC is an INBOUND log. §6.1 lets INBOUND logs be claimed only by a P8 record or by P9, so the return would go to `arc.unidentified`. No template moves the A back from GL-2 `partner.<id>` to `arc.hot`, so after the return and P6, the partner sub-account still shows A. Add a case-record claim and a DR `arc.hot` / CR `partner.<id>` leg.

**m7 · NOVA_ARC_DESIGN.md:767 (§10.2), :297 (§7.1) · MC-10 · minor**

- **Missing keys.** No ledger keys are defined for P8, P9/P9D, P2I or P2P. For FIAT_BANK, P2P (on the Arc leg's COMPLETED) and P2 (on PAID) would both fall to `:p2` → KEY_CONFLICT.
- **Hash case not fixed.** `Hex32` is not declared lower-cased; only `NetworkAddress` is. A DFNS-reported hash in a different case from the RPC's would give two `gas:` keys for one receipt.

**m8 · NOVA_ARC_DESIGN.md:694, :698 vs §9.1:667 and §7.3:452-459 · MC-44 · minor**

- **Undeclared sub-account.** GL-2 `arc.hot.subminor` (P9D and the chain invariant) is not in the §9.1 sub-account list.
- **No port operation.** `GasDustStore` has no operation to record receipt dust (P9D), so the 18-dp sub-ledger cannot hold what the invariant needs.

**m9 · NOVA_ARC_DESIGN.md:789-790, :121, :264 · MC-44 · minor**

- **Lost table rows.** The "Conversion result (D5)" and "Payout callback (D5)" dedupe rows follow the projection table and a paragraph. Rendered, they are paragraph text, not rows of the §10.3 dedupe-key table.
- **Wrong section number.** §4.1 cites `ReceiverPort` as "§7.5", but it is §7.5a.
- **Wrong stage.** §6.5 rule 1 says a leg with no DFNS hash "stays `CONFIRMING`", but without a hash the leg cannot have reached `CONFIRMING` (§8.6).

## VERDICT

NEGATIVE (11 defects: 2 blocking, B1–B2; 9 minor, m1–m9). All four round-1 blocking defects are fixed or reduced to minor residuals. B1 is a narrower residual of round-1 B1. B2 is new, on the ours-to-ours path that fix block 1 introduced.
