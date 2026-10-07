VERIFICATION · lens: R · target: unit DFNS (src/dfns/**, src/gateway/**, test/unit/dfns-*.test.ts) · commit: 7fe69e270d5f886d92b92afd59645e5daa6de075 on branch co1-v3/nova-arc-d1 (unit files untracked in the working tree, read 2026-10-07 11:10–11:30 SAST)

**This file replaces the pass written to the same path at 03:12 on 2026-10-07.** The unit changed after that pass: client.ts 10:13, types.ts 10:14, webhook.ts 10:19, gateway/index.ts 10:13, fakes 10:14, and the tests dfns-assets, dfns-gateway, dfns-webhook and dfns-webhook-e2e between 10:15 and 10:18. This pass re-verifies the code from scratch. The earlier pass's findings were used only as hints; the status of each one is under "Earlier findings".

File sha256 prefixes. They were the same at the start and at the end of this pass.

| File | sha256 prefix |
|---|---|
| src/dfns/client.ts | de0a36ec37c61d346 |
| src/dfns/json.ts | 928fef5aa12903cf3 |
| src/dfns/types.ts | fe56c501bb77f30d0 |
| src/dfns/webhook.ts | eb0edfbbab6ace3de |
| src/gateway/index.ts | 60947a710b5d17fe1 |
| src/gateway/wrapper.ts | c7f4ada1efc33909c |

**Judged against:**
- docs/NOVA_ARC_DESIGN.md:
  - §0.1, §2 and §3;
  - §8.1–8.7;
  - §10.2–10.4;
  - §7.3 for the `markSubmit`, `listActiveHolds` and `applySignal` contracts.
- CLAUDE.md money rules ("Exactly once" and "Fail closed").
- docs/constants.md.
- docs/sources/dfns/* and docs/sources/arc/*.
- docs/RUBRIC.md items MC-01, 03, 07, 08, 10, 13, 18, 21, 22, 33, 34 and 44, and JL-1 to JL-6.

**Environment and limits:**
- Node v22.23.3 from .tools/node/bin.
- No DFNS, Circle or VALR API was called. No .env file was read. Nothing was signed or broadcast.
- Planted mutants, probes and coverage ran in the mkdtemp real-file copy /tmp/verify-dfns-R2.LnxbIy/repo. `find -type l` on the copy returned 0. After the mutant run, `cmp` showed the copy's src matched the repo again.
- Stryker ran in the repo on the six files only, with `--tempDirName .stryker-tmp-verify-DFNS --reporters clear-text`. It removed that directory when it finished. I did not run ci.sh.

## CHECKS

### Toolchain, lint and secrets

**C-01 `npx tsc --noEmit`: PASS.** Exit 0.

**C-02 Unit tests: PASS.** `npx vitest run test/unit/dfns-*.test.ts` passes all 457 tests in 9 files. See C-10 for test/unit/money-path.test.ts.

**C-03 MC-01 money-float lint: PASS.** `node tools/lint-money-floats.mjs` reports "40 money-path files, 0 finding(s)". All six unit files are listed in docs/MONEY_PATH.md (rows 52–57, anchors 119–124).

**C-04 Semgrep MC-01 layer on the six files: PASS (exit 0).** The scan uses `--config tools/semgrep/mc01-money-float.yml`, scoped as in scripts/ci.sh:93.

**C-05 Vendored Semgrep JS/TS rules on src/dfns, src/gateway and test/unit/dfns-*: PASS (exit 0).**

**C-06 gitleaks on a real-file copy of the unit and its tests: PASS** ("no leaks found"). Secrets are generated at test time: the webhook secret and bearer token with `randomBytes`, and the Ed25519 key with `generateKeyPairSync` (dfns-gateway.test.ts:61–64). The fixtures carry no token or key.

**C-07 No real API call: PASS** (grep plus inspection).
- src/dfns and src/gateway contain no `fetch(`, `node:http(s)`, `node:net`, axios, undici, `process.env` or `readFileSync`.
- All I/O goes through the injected `DfnsHttpClient` (client.ts:74) and `DfnsCredentials` (client.ts:90).

### Coverage and mutation

**C-08 MC-07 coverage of the six files, measured in the /tmp copy: PASS.** 100% on every measure.

| File | Statements | Branches | Functions |
|---|---|---|---|
| client.ts | 84/84 | 60/60 | 16/16 |
| json.ts | 118/118 | 80/80 | 24/24 |
| types.ts | 113/113 | 77/77 | 23/23 |
| webhook.ts | 91/91 | 59/59 | 7/7 |
| gateway/index.ts | 215/215 | 203/203 | 15/15 |
| gateway/wrapper.ts | 40/40 | 19/19 | 7/7 |

**C-09 MC-08 Stryker on the six files only: PASS.** Score **97.71%** against a break threshold of 90. Of 1918 mutants, 1872 were killed, 2 timed out, 44 survived and 0 had no coverage.

| File | Score |
|---|---|
| client.ts | 99.36 |
| json.ts | 95.95 |
| types.ts | 96.57 |
| webhook.ts | 97.21 |
| gateway/index.ts | 98.99 |
| gateway/wrapper.ts | 95.51 |

I read all 44 survivors. All but one are equivalent or cosmetic:
- error-class `name` strings, and the shape-error labels `'data'` and `'data.transferRequest'`;
- the `'utf8'`→`""` encoding argument;
- regex anchors on whole-token inputs, a defence-in-depth `{4}` that the other regex repeats, and `+` on run pieces that rejoin;
- `X.kind === 'REJECTED' &&` → `true &&` (index.ts:421–423, :489), where the other kinds have no `code`;
- `age < 0n` → `<= 0n`;
- `retryAfter`, `k === undefined ||` and `typeof v !== 'string'`, where the regex test on a non-string is false;
- `mapTransferStatus(t, {})`;
- `held.externalId !==` → `false` (index.ts:416), because `bodyDigest` already covers the body text that contains the externalId;
- viem `functionName` on a one-function ABI;
- `.slice(0, 200)` on error detail.

The exception is webhook.ts:225 `digest('hex')` → `digest("")`. It is not strictly equivalent and is reported as m4.

**C-10 MC-08 consistency test (test/unit/money-path.test.ts "Stryker mutate (MC-08)"): FAIL, but not caused by this unit.** stryker.config.json `mutate` lacks the three JQUOTE files that docs/MONEY_PATH.md now lists: src/journey/quote/fiat.ts, ports.ts and compose.ts. All six DFNS files are in both lists. This is recorded as OBS-1 and is not counted against DFNS.

**C-11 Hand-planted mutants in the /tmp copy: PASS. All 30 were killed** by the DFNS tests. The failing-test count is in brackets.

| Mutant | Change | Failing tests |
|---|---|---|
| M01 | read-back quarantine check removed | 4 |
| M02 | nonce-hold check removed | 2 |
| M03 | echo amount check removed | 3 |
| M04 | inner-recipient check removed | 3 |
| M05 | timestamp window ×1000 | 4 |
| M06 | re-read walletId check removed | 2 |
| M07 | ERC20 token ≠ C-12 allowed | 2 |
| M08 | high-water raised on STALE or CONFLICT | 2 |
| M09 | Rejected never holds | 1 |
| M10 | allow-list ignores method | 4 |
| M11 | fee check on the fast tier | 2 |
| M12 | read-back binding check removed | 2 |
| M13 | txHash pattern removed | 3 |
| M14 | HMAC over trimmed UTF-8 | 2 |
| M15 | vault check removed | 2 |
| M16 | client body-digest check removed | 1 |
| M17 | memoData check removed | 1 |
| M18 | P6 AMBIGUOUS treated as absent | 2 |
| M19 | receiver-owner check removed | 2 |
| M20 | native amount compare removed | 2 |
| M21 | a verified call proceeds to POST | 3 |
| M22 | `0x` nonce with no digits accepted | 1 |
| M23 | any `wallet.*` kind re-read | 2 |
| M24 | non-ArcTestnet wallet allowed | 2 |
| M25 | chain-ID pin removed | 2 |
| M26 | resolved leg re-POSTs | 4 |
| M27 | inner amount `!==` → `<` | 1 |
| M28 | replay drop removed | 4 |
| M29 | 409 not quarantined | 2 |
| M30 | abort on Rejected not an anomaly | 1 |

### Gateway (§8.4)

**C-12 Check 1, chain pin: PASS.**
- The constructor refuses `chainId ≠ 5042002n` (index.ts:329).
- The proposal's chain must equal the pinned chain (:339).
- The DFNS wallet is checked, in order:
  - network `Arc` gives NETWORK_DISABLED (:492);
  - any network other than `ArcTestnet` gives CHAIN_ID_MISMATCH (:493);
  - the wallet id must match (:494);
  - the status must be `Active` (:495);
  - the wallet must have no `vaultId` (:496);
  - the address must equal the binding's `fromAddress` (:497).
- Mainnet appears only as the refusal constant `DFNS_ARC_MAINNET` (types.ts:36).
- Mutants M24 and M25 were killed.

**C-13 Check 2, binding: PASS.**
- The binding digest recomputes (:461). I recomputed it independently with my own `lp` (UInt32BE byte length plus the UTF-8 bytes), and it matched.
- A proposed `to` or amount that differs from the binding gives BINDING_MISMATCH with quarantine (:351, :356). The body is built from the binding only (:366–369).
- DFNS's echo is checked for externalId, walletId, network, kind, `to`, amount and contract (:308–320). The DFNS transfer id is returned for linking (:525).
- Mutants M03, M20 and M12 were killed.

**C-14 Check 2, open reservation: PASS.** `reservationOpen` (:372–388) gives:
- a refusal for a terminal payment or leg;
- a refusal when `p6Pending` is set;
- for P1: missing gives refused and QUARANTINE; AMBIGUOUS gives a retry;
- for P6: AMBIGUOUS counts as released; P6 existing while the leg is non-terminal gives refused and QUARANTINE.

Mutant M18 was killed.

**C-15 Check 3, one DFNS request per payment: PASS.**
- `attempt: 1n` is in the type (:115), and `SubmitRequest` has no attempt field.
- I recomputed `deriveExternalId('pay-0123456789abcdef0123456789abcdef')` independently: `nv1-fc03858be34948615c6fce9cfdc4631b5f8561ec`, 44 characters, inside DFNS's 1–50 [DF:transfer `externalId` minLength 1 / maxLength 50, transfer-asset.md:163–166].

**C-16 Check 3, submit marker and read-back: PASS.**
- The marker is committed before the POST. Test :327 records the request count at each `markSubmit` call.
- A record read back after `markSubmit` (OK, AMBIGUOUS or VERSION_CONFLICT) and after a held-marker re-POST must:
  - show our marker;
  - not be QUARANTINED;
  - have the same binding digest;
  - have no `externalRef`;
  - be non-terminal with no pending P6 (:427–441).

  This fixes the earlier m1, and mutant M01 was killed.
- A re-POST sends only bytes whose sha256 equals the marker's `bodyDigest`. The gateway checks this at :416, and the client checks it again at client.ts:326. Mutant M16 was killed.
- A resolved leg is read with GET and never POSTed again (:472–480). Mutant M26 was killed.

**C-17 Check 4, wrapper-call rule: PASS.**
- A contract call that is not allow-listed or does not verify gives CONTRACT_CALL_NOT_ALLOWED with quarantine. A verified call gives CALL_ROUTE_NOT_ENABLED, because D1 has no route (:340–347).
- The decoder enforces all of these (wrapper.ts:140–167):
  - re-encoding to the exact bytes;
  - value = 0;
  - empty memoData;
  - memoId = `deriveMemoId`;
  - inner target in the allow-list;
  - inner `transfer(address,uint256)` re-encodes canonically;
  - recipient and amount ×10¹² equal the binding.
- Tamper tests cover a swapped recipient, a changed amount, an extra call, a different target, nesting, trailing bytes and a wrong memo (dfns-gateway.test.ts:296–316, :695, :704).
- Mutants M04, M17, M21 and M27 were killed.

**C-18 Check 5, rail and nonce hold: PASS, with a race (m1).**
- The gateway refuses when PAUSED, when the indexer is unhealthy, when there is no agreed head, and when the payment is QUARANTINED.
- `listActiveHolds` is read from the store on every submission (:483–486). Mutant M02 was killed.
- See m1 for the window after that read.

**C-19 Check 6, destination: PASS.** A COMPANY-owned destination, or a customer wallet not owned by the receiver, gives DESTINATION_NOT_ALLOWED. It quarantines on a re-POST (:391–399). Mutant M19 was killed.

**C-20 Check 7, fees: PASS.**
- The check reads `standard.maxFeePerGas` as a bigint from a `^\d+$` string (types.ts:153–155).
- Above the ceiling gives RETRY_LATER. Fees reported for another network are refused (:505–510).
- The ceiling must lie in [20 gwei, 20,000 gwei]. Recomputed: 20×10⁹ = 20,000,000,000 (:76) and 20,000×10⁹ = 2×10¹³ (:78).
- Mutant M11 was killed.

**C-21 Units, recomputed via U1 in the /tmp copy: PASS.**

USDC units to wei:

| Units | Wei |
|---|---|
| 0 | 0 |
| 1 | 10¹² |
| 10⁶ | 10¹⁸ |
| 123,456,789 | 123,456,789×10¹² |
| 2⁶⁴ | 2⁶⁴×10¹² |

Wei to USDC units (floor, with the remainder returned):

| Wei | Units | Remainder |
|---|---|---|
| 1 | 0 | 1 |
| 10¹²−1 | 0 | 10¹²−1 |
| 10¹² | 1 | 0 |
| 10¹⁸+1 | 10⁶ | 1 |
| 10¹⁸−1 | 999,999 | 10¹²−1 |

In Erc20 mode, the proposal check requires `units×10¹² = binding.amount`, so the body's remainder is provably 0. Dust is refused (test :720).

### DFNS status mapping (§8.6) and webhooks (§8.7)

**C-22 Status mapping: FAIL (B1).**
- Correct rows:
  - `replacementId` → ANOMALY;
  - Pending/Executing → PENDING_APPROVAL/APPROVED;
  - Broadcasted/Confirmed with a hash → SUBMITTED/CONFIRMING, with `crossCheckOnly` set on Confirmed;
  - Rejected → proof (a1), with `approvalUnverified` and a hold when `details` shows a nonce;
  - hash-less Failed with an accepted abort → proof (a2) with a hold;
  - hash-less, never-broadcast Failed → FAILED_UNPROVEN with quarantine and a hold.
- Wrong row: `Failed` with `dateBroadcasted` and no `txHash` (see B1).

**C-23 Webhook authenticity: PASS.**
- The order of checks is (webhook.ts:178–191): size cap, then source IP, then the `sha256=<64 lower-hex>` format, then the empty-key refusal, then HMAC-SHA256 over the raw bytes with `timingSafeEqual` on 32-byte buffers. All of this happens before parsing.
- The timestamp must satisfy |now − sent| < 300.
- The constructor refuses an empty secret and an empty IP list (:201–202). This fixes the earlier m4.
- Mutants M05 and M14 were killed.

**C-24 Webhook dedupe and out-of-order delivery: PASS.**
- Replay: the same event id with the same bytes gives REPLAYED_EVENT; with different bytes it gives EVENT_ID_CONFLICT with an alert.
- The handler re-reads the transfer with GET and refuses a different wallet or transfer id (:245–252).
- Dedupe uses the entity key `dfns:transfer:<id>:<status>` and the §10.3 projection digest.
- The per-transfer high-water mark gives STALE or SIGNAL_CONFLICT. It is raised, and the event id recorded, only after the sink commits. NOT_COMMITTED gives 503.
- The full path (webhook → `DfnsClient.getTransfer` → sink) runs over both DFNS fakes and both delivery logs (dfns-webhook-e2e.test.ts:86–139). This fixes the earlier m3.
- Mutants M06, M08, M23 and M28 were killed.

### Facts, fakes and allow-list

**C-25 DFNS facts re-checked against the archive: PASS.** Each fact is quoted from the archived file named in brackets.

TransferRequest [get-transfer.md:2255–2374]:
- `required` is id, walletId, network, requester, requestBody, metadata, status, dateRequested;
- the status enum has six values, with "`Failed` | Indicates either system failure to complete the request or the transaction failed on chain";
- `dateBroadcasted` is "When the transfer was broadcasted to the blockchain";
- `replacementId` is "(cancel or speed-up)";
- `details` is "e.g. nonce … Shape is blockchain specific";
- `approvalId` has the `^ap-` pattern.

Status transitions:
- "Pending --> Rejected", "Executing --> Failed", "Broadcasted --> Failed", and Rejected "Blocked by policy or approval rejected" [transaction-monitoring.md:36–50].

Idempotency, abort and cancel:
- The same request gives 200 with the existing entity. A different body or wallet gives 409. After a terminal status the externalId is permanently bound [idempotency.md:15–40].
- Abort applies to a transfer "in 'Executing' status and has not yet been signed" [abort-transfer.md:7].
- The EVM `nonce` is anyOf integer ≥ 0, `^\d+$` or `^0x[0-9a-fA-F]*$` [cancel-transfer.md:578–586].

Webhooks [webhooks guide:36–71; webhook-events.md:69–73, 279–294]:
- the header is `X-DFNS-WEBHOOK-SIGNATURE: sha256=…`;
- `REPLAY_ATTACK_TOLERANCE = 5 * 60` with a strict `<`;
- there are five `wallet.transfer.*` kinds;
- delivery order is not guaranteed;
- anything other than 200 is a failed delivery, retried up to 5 attempts over 24 h.

User actions:
- `userActionServerKind` enum `Api`, plus `userActionHttpMethod`, `userActionHttpPath` and `userActionPayload` ("JSON-encoded body") [action-challenge.md:44–72].
- `challengeIdentifier`, plus `firstFactor.kind: Key` with `credentialAssertion` {credId, clientData, signature} [action-signature.md:70–117].

Endpoints, headers and limits:
- `/networks/fees` with `network`; `Eip1559` with `maxFeePerGas` per tier; the network enum includes ArcTestnet [estimate-fees.md:29, 111, 195–318].
- List Transfers: `limit` maximum 500, `paginationToken`, `nextPageToken`; `walletId` and `items` are required [list-transfers.md:47–93].
- Assets: `walletId`, `network`, and per asset `kind`, `balance` and `decimals`; balances are "in their smallest unit … as strings"; "the latest balance recorded by the DFNS indexer, not a live read" [get-wallet-assets.md:60–322; displaying-balances.md:9, 208].
- Base URLs `api.dfns.io` and `api.uae.dfns.io`, and Europe webhook IP `35.181.116.68` [regions.md:24–25].
- Content-type `application/json` and a non-empty User-agent [api-reference_index.md:27–28].
- `Retry-After` on 429, counted per organisation [rate-limits.md:18, 28].
- `Arc | ArcTestnet` [networks_index.md:34].

No invented DFNS fact was found.

**C-26 Arc facts re-checked against the archive: PASS.**

| Constant | Fact | Archive location |
|---|---|---|
| C-01 | `5042002` | rpc-endpoints.md:64 |
| C-12 | `0x3600…0000`, 6 decimals | contract-addresses.md:48 |
| C-30 | 20 gwei | gas-and-fees.md:38; evm-differences.md:205 |
| C-31 | 20,000 gwei | gas-and-fees.md:39 |
| C-62 | Memo `0x5294E992…e505` | transaction-memos.md:22 |

The Memo ABI is `memo(address target, bytes calldata data, bytes32 memoId, bytes calldata memoData)` (transaction-memos.md:41–46), and wrapper.ts:52–65 matches it. The rows in docs/constants.md carry the same values and URLs.

**C-27 Two structurally different DFNS fakes and recorded fixtures: PASS.**
- Fake #1 is the stateful `DfnsSimulator`. It enforces a single-use user action bound to the method, path and payload, and externalId idempotency with 409.
- Fake #2 is the stateless `RecordedDfns` script, which pins the call sequence.
- The gateway runs over both, in two Nova worlds (Map store + MapLedger + MapWalletRegistry, and Log store + EventLogLedger + ListWalletRegistry).
- Each fixture names its archived example and every edit made to it. The `blockNumber` provenance is now stated (this fixes the earlier m5).

**C-28 Closed allow-list: PASS.**
- Only the 8 templates at client.ts:155–164 can be sent. Wallet assets is now included, without `netWorth`, which fixes half of the earlier m2.
- Cancel, speed-up and abort are refused before the transport sees them.
- Mutant M10 was killed.

**C-29 MC-03, MC-10, MC-34 and MC-44 spot checks: PASS.**
- Conversions go only through U1.
- Keys are length-prefixed sha256.
- There are no LLM imports.
- The § and DF references in the headers resolve. For example, client.ts:259–264 quotes displaying-balances.md:208 verbatim.

**C-30 JL-1 to JL-6: [inspection-only] PASS, except JL-1 on B1.**
- JL-2: the fee ceiling is configuration (Q-N8).
- JL-6: no memo is sent, and the memo id is a hash.

## Earlier findings (03:12 pass), re-checked

| Earlier finding | Status now | Evidence |
|---|---|---|
| m1: stale-view race on the marker | FIXED | C-16 read-back; mutant M01; test :915 |
| m2: Balance call not implemented; approval-detail gap recorded only in code | Partly fixed | Assets are implemented (C-28). The approval-detail gap remains: new m2 |
| m3: webhook never run against the DFNS fakes | FIXED | C-24 e2e |
| m4: webhook configuration not validated | FIXED | C-23 |
| m5: fixture provenance | FIXED | C-27 |

## DEFECTS

### Blocking

**B1 · src/dfns/types.ts:480 and :513–515, pinned by test/unit/dfns-types.test.ts:362 · Lens R: NOVA_ARC_DESIGN §8.4 check 5, §8.6, MC-13, JL-1, CLAUDE.md "Fail closed" · blocking.**

What the code does: `mapTransferStatus` maps a DFNS `Failed` transfer that has `dateBroadcasted` set but no `txHash` to `{kind:'HOLD_FOR_INDEXER', stage:'CONFIRMING', txHash:null}`. That signal has no nonce hold and no quarantine.

Probe in the /tmp copy: `Failed`, no `txHash`, `dateBroadcasted` set and `details: {nonce: 7}` gives `{"kind":"HOLD_FOR_INDEXER","stage":"CONFIRMING","txHash":null}`.

What the design requires:
- §8.4 check 5: "A wallet goes on hold as soon as any DFNS transfer from it is seen as … `Failed` with no `txHash`, aborted or not".
- §8.6: "`Failed`, no `txHash`, any other case → … payment QUARANTINED; wallet nonce hold … nothing is released on this status".

Why this state is the riskiest of the hash-less cases:
- DFNS's own fields say signed bytes were written for a reserved nonce: `dateBroadcasted` is "When the transfer was broadcasted to the blockchain", and `Broadcasted` means "written to the mempool".
- With `txHash` null, our indexer can never link that transaction (§10.4), so HOLD_FOR_INDEXER has no way to resolve.
- The mapper treats every other self-contradictory DFNS combination as ANOMALY: Broadcasted or Confirmed without a hash, and Pending, Executing or Rejected with broadcast evidence. This one alone is passed on as a normal stage.

Consequence: no `WalletNonceHold` is written. The PORTS store only accepts a hold the signal carries (payment-store.ts:447–455); it never forces one. So new payments from TREASURY_HOT keep being submitted while a signed transaction with nonce `n` may still be pending. That is money moving without the control §8.4 check 5 requires.

Fix:
- For `Failed` with `txHash === null`, return FAILED_UNPROVEN (quarantine plus `nonceHold` with `detailsNonce`) whatever `dateBroadcasted` says, and name the broadcast trace in `detail`.
- Keep HOLD_FOR_INDEXER for `Failed` with a `txHash` only.
- Keep `abortAccepted` plus a broadcast trace as ANOMALY.
- Update the test at :362.

### Minor

**m1 · src/gateway/index.ts:483–486 vs :427–441 · §8.4 check 5 (hold read on every submission) and check 3 (c) ("After that, no new submission can take `n`") · minor.**

Holds are read once, before the marker. The read-back after `markSubmit` re-checks quarantine, the binding and the leg, but not `listActiveHolds`.

Probe in the /tmp copy, in both store worlds: a hold placed during `markSubmit` (after the hold read) still gives `SUBMITTED` with 1 POST.

Why this is minor:
- It needs a concurrent `applySignal` with `placeHold` on the same wallet inside one submission's window.
- DFNS policy approval still gates signing.
- The design already contemplates transfers that were in flight when a hold began.

Fix: re-read `listActiveHolds(b.fromWallet)` after the read-back, immediately before `createTransfer`.

**m2 · src/dfns/client.ts:143–151 and src/dfns/webhook.ts:162–163, :230–232 vs design §8.2 row "Approval detail", F-1, §8.7 rule 5 and §10.3 · minor.**

The gap:
- The design still lists `GET /v2/policy-approvals/{approvalId}` as a D1 call, and F-1 relies on it.
- The code leaves it out, for a sound reason: no response schema is archived.
- That reason is recorded only in a code comment, not in docs/OPEN_QUESTIONS.md or the design.

The knock-on effect: `policy.approval.*` webhooks are IGNORED with no alert. The `dfns:approval:<approvalId>:<status>` key and the approval projection of §8.7 rule 5 and §10.3 are not implemented.

No money effect: every `Rejected` maps to REJECTED with `approvalUnverified` and a page.

Fix: record the deviation in the design (§8.2, §8.7, §10.3) and in OPEN_QUESTIONS.

**m3 · src/dfns/types.ts:118–121 · [DF:assets] lists `Erc7984` ("EVM ERC-7984 confidential tokens", get-wallet-assets.md:134–145) as an EVM asset kind · minor.**

`decodeWalletAsset` throws on any kind other than `Native`/`Erc20`, so the whole `getWalletAssets` read becomes AMBIGUOUS. One such token sent to the wallet by any outside party disables the balance cross-check for good.

This fails closed, and the read is display and reconciliation only (client.ts:259–264), so it is minor.

Fix: skip unknown kinds, or carry them as non-USDC rows.

**m4 · src/dfns/webhook.ts:225, with no test pinning it (the Stryker `digest("")` survivor) · MC-08 test strength · minor.**

No test asserts the format of the raw-body digest in the delivery log. If `digest('hex')` regressed to a Buffer turned into text, distinct sha256 values whose bytes decode to the same U+FFFD string would compare equal. A forged-id EVENT_ID_CONFLICT (an alert) would then be reported as a silent REPLAYED_EVENT.

Fix: assert `eventDigest` = `0x` + sha256 hex of the raw bytes in dfns-webhook.test.ts.

### Observation outside the target (not counted)

**OBS-1 · stryker.config.json vs docs/MONEY_PATH.md.** test/unit/money-path.test.ts "Stryker mutate (MC-08)" fails:
- docs/MONEY_PATH.md now lists src/journey/quote/fiat.ts, ports.ts and compose.ts (the JQUOTE unit);
- stryker.config.json `mutate` does not.

All six DFNS files are in both lists. This belongs to the JQUOTE unit's owner, and CI on this branch is red until it is fixed.

## VERDICT

NEGATIVE (5 defects: 1 blocking B1, 4 minor m1–m4). Everything else holds when re-checked:
- toolchain, lint, Semgrep MC-01, gitleaks;
- 100% coverage and a Stryker score of 97.71%;
- 30 of 30 planted mutants killed;
- every gateway check of §8.4 except the hold race;
- webhook HMAC, replay, dedupe and ordering;
- every DFNS and Arc fact re-checked against the archive.

B1 must be fixed before this unit passes.
