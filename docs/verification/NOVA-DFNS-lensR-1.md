VERIFICATION · lens: R · target: unit DFNS (src/dfns/**, src/gateway/**, test/unit/dfns-*.test.ts) · commit: 8448431f277880700d242fc17bab0a81e0843c0b on branch co1-v3/nova-arc-d1 (read 2026-10-07 14:45–15:20 SAST)

**This file replaces the pass written to the same path at 11:30 on 2026-10-07.** That version is kept in git (commit 348972d). Since that pass, types.ts (12:01), webhook.ts (12:02) and gateway/index.ts (12:00) changed in a fix block. test/unit/dfns-boundary.test.ts changed in commit 6ef160f, which came from the JPARTNER block. This pass re-verifies the unit from scratch and uses the earlier findings only as hints. The status of each earlier finding is under "Earlier findings".

The unit files had the same sha256 at the start and at the end of this pass. HEAD moved from 07e9950 to 8448431 during the pass, but no unit file changed.

| File | sha256 prefix |
|---|---|
| src/dfns/client.ts | de0a36ec37c61d346 |
| src/dfns/json.ts | 928fef5aa12903cf3 |
| src/dfns/types.ts | c51af34a709a22858 |
| src/dfns/webhook.ts | 822e63120a850d7a8 |
| src/gateway/index.ts | c589bc022bbd84f30 |
| src/gateway/wrapper.ts | c7f4ada1efc33909c |

**Judged against:**
- docs/NOVA_ARC_DESIGN.md §0.1, §2, §3, §8.1–8.7, §10.2–10.4, §11 and §12 (F-1 to F-18);
- the CLAUDE.md money rules: "Exactly once", "Authenticity and dedupe on every inbound signal", "Fail closed", "Binding" and "Wrapper-call signing rule";
- docs/constants.md;
- docs/sources/dfns/* and docs/sources/arc/*;
- docs/RUBRIC.md items MC-01, 03, 07, 08, 10, 13, 18, 21, 22, 33, 34 and 44, and JL-1 to JL-6.

**Environment and limits:**
- Node v22.23.3 from .tools/node/bin.
- No DFNS, Circle or VALR API was called. No .env file was read. Nothing was signed or broadcast.
- Public docs were read only: docs.arc.io and docs.dfns.co, 2026-10-07.
- Probes, planted mutants and coverage ran in the mkdtemp copy /tmp/verify-dfns-R3.lMc4uu/repo. Every file there is a real file. Its only 30 symlinks are node_modules/.bin entries, and all of them resolve inside the copy (0 point outside it). After the mutant run, `sha256sum -c` showed the copy's unit files matched the repo again.
- Stryker ran in the repo on the six files only, with `--tempDirName .stryker-tmp-verify-DFNS --reporters clear-text`. `--ignorePatterns` was the config list plus `.stryker-tmp*`, because the first attempt failed while copying another agent's live `.stryker-tmp-fix-JPARTNER2` sandbox. That failed attempt left `.stryker-tmp-verify-DFNS/sandbox-ezKgej` (184 MB) in the repo. I have not deleted it, because the operator said nothing may be deleted. Remove it by hand if wanted.
- ci.sh was not run.

## CHECKS

### Toolchain, lint and secrets

| Check | Result | Evidence |
|---|---|---|
| C-01 `npx tsc --noEmit` | PASS | Exit 0. |
| C-02 Unit tests (`npx vitest run test/unit/dfns-*.test.ts`) | PASS | 467/467 tests in 9 files pass, in the repo and in the /tmp copy. |
| C-03 MC-01 money-float lint (`node tools/lint-money-floats.mjs`) | PASS | "51 money-path files, 0 finding(s)". All six unit files are in docs/MONEY_PATH.md (rows 52–57, anchors 131–136). |
| C-04 Semgrep MC-01 layer on the six files (`--config tools/semgrep/mc01-money-float.yml`) | PASS | Exit 0; 13 rules on 6 files, 0 findings. |
| C-05 Vendored Semgrep JS/TS rules on src/dfns, src/gateway and test/unit/dfns-*.test.ts | PASS | Exit 0. |
| C-06 gitleaks (`--no-git`) on the real-file copy /tmp/verify-dfns-gl.ahSzOp of src/dfns, src/gateway and the dfns tests | PASS | "no leaks found". Tests generate their secrets at runtime: `randomBytes` for the webhook secret and the bearer token, and `generateKeyPairSync('ed25519')` for keys (dfns-client.test.ts:30–32, dfns-webhook.test.ts:73, dfns-gateway.test.ts:61–64). |
| C-07 No real API call and no network I/O | PASS | grep of src/dfns and src/gateway for `fetch(`, `node:http(s)`, `node:net`, axios, undici, `process.env`, `readFileSync` and `.env` finds nothing. All I/O goes through the injected `DfnsHttpClient` (client.ts:74–76) and `DfnsCredentials` (client.ts:90–93). |
| C-08 Mainnet stays disabled | PASS | No `5042` or `5042n` literal in the unit. `Arc` appears only as the refusal constant `DFNS_ARC_MAINNET` (types.ts:36), and it is used only at index.ts:499 (NETWORK_DISABLED). The constructor refuses any chain ID other than 5042002n (index.ts:329). |

### Coverage and mutation

**C-09 MC-07 coverage of the six files (v8, in the /tmp copy): PASS.** 100% on every measure: statements 674/674, branches 508/508, functions 94/94, lines 507/507.

**C-10 MC-08 Stryker on the six files only: PASS.** The score is **97.78%** against a break threshold of 90. Of 1941 mutants, 1896 were killed, 2 timed out (json.ts), 43 survived, and none lacked coverage.

| File | Score |
|---|---|
| client.ts | 99.36 |
| json.ts | 95.95 |
| types.ts | 96.67 |
| webhook.ts | 97.69 |
| gateway/index.ts | 99.01 |
| gateway/wrapper.ts | 95.51 |

I read all 43 survivors, and every one is equivalent or cosmetic:
- **Error names and labels:** error-class `name` strings, and the shape-error labels `"data"`, `"data.transferRequest"` and `"event"`.
- **Encoding arguments:** `'utf8'` → `""`, where Node falls back to UTF-8.
- **json.ts regexes:**
  - anchors on tokens that come only from the sticky TOKEN matcher;
  - `{4}` on `\u` escapes that TOKEN already enforces;
  - `+` on run pieces that rejoin.
- **json.ts:121:** `k === undefined ||`, where `STRING_TOKEN.test(undefined)` is already false.
- **types.ts:256:** `typeof v !== 'string'` → `false`. Every non-string `JsonValue` stringifies to something the nonce regexes reject.
- **types.ts:289–296:** a single anchor dropped from `/^.+$/s`. This is equivalent with the `s` flag.
- **types.ts:503:** detail text.
- **client.ts:192:** `v !== undefined &&` → `true`. A regex test on undefined is false.
- **webhook.ts:234:** `age < 0n` → `<= 0n`.
- **webhook.ts:282:** `{ abortAccepted: false }` → `{}`, which is falsy either way.
- **index.ts:416:** `held.externalId !== …` → `false`. The externalId is inside the body text that `bodyDigest` covers.
- **index.ts:421–423 and :496:** `X.kind === 'REJECTED' &&` → `true`. OK and AMBIGUOUS results carry no `code`.
- **wrapper.ts:**
  - `.slice(0, 200)` on error detail;
  - viem `functionName` → `""` on a one-function ABI.

The earlier non-equivalent survivor, webhook.ts:237 `digest('hex')`, is now killed (see m4 below).

**C-11 Planted mutants in the /tmp copy: PASS, 36 of 36 killed** by test/unit/dfns-*.test.ts. The number of failing tests is in brackets.

| Mutant | Change | Failing tests |
|---|---|---|
| P01 | hash-less `Failed` with `dateBroadcasted` → HOLD_FOR_INDEXER (the old B1) | 1 |
| P02 | hold re-read after the marker removed | 4 |
| P03 | same-event replay not dropped | 6 |
| P04 | HMAC compare ignored | 7 |
| P05 | timestamp window removed | 4 |
| P06 | re-read id/wallet check removed | 2 |
| P07 | high-water STALE removed | 2 |
| P08 | high-water raised before the sink commits | 4 |
| P09 | proposal chain-ID pin removed | 2 |
| P10 | Native recipient check removed | 2 |
| P11 | Native amount check removed | 2 |
| P12 | inner recipient check removed | 3 |
| P13 | inner amount check removed | 4 |
| P14 | inner canonical re-encode removed | 1 |
| P15 | inner target allow-list removed | 5 |
| P16 | verified contract call proceeds to POST | 3 |
| P17 | held-marker digest check removed | 2 |
| P18 | read-back quarantine check removed | 4 |
| P19 | mainnet wallet refusal removed | 2 |
| P20 | wallet ArcTestnet check removed | 2 |
| P21 | 409 not quarantined | 2 |
| P22 | Erc7984 row fails the whole read | 1 |
| P23 | delivery-log digest over decoded text | 2 |
| P24 | client body-digest check removed | 1 |
| P25 | `…/cancel` added to the allow-list | 2 |
| P26 | P6 AMBIGUOUS counted as absent | 2 |
| P27 | Rejected never holds | 1 |
| P28 | rail PAUSE ignored | 2 |
| P29 | wallet address binding removed | 2 |
| P30 | source-IP layer removed | 3 |
| P31 | read-back `externalRef` check removed | 2 |
| P32 | echo amount check removed | 3 |
| P33 | binding digest recompute removed | 2 |
| P34 | ERC-20 token must be C-12 removed | 2 |
| P35 | Memo `memoId` check removed | 1 |
| P36 | empty-secret refusal in `verifyDfnsSignature` removed | 1 |

**C-12 MC-08 consistency test (test/unit/money-path.test.ts "Stryker mutate (MC-08)"): FAIL, not caused by this unit.** stryker.config.json `mutate` lacks src/journey/quote/fill.ts and src/ops/{audit,ports,queue,types}.ts, which docs/MONEY_PATH.md lists. All six DFNS files are in both lists. This is recorded as OBS-1 and not counted against DFNS.

### Gateway (§8.4) and wrapper rule

**C-13 Check 1, chain pin: PASS.**
- The constructor checks the chain ID (index.ts:329), and the proposal's chain must match (:339).
- The DFNS wallet is checked in this order:
  1. `Arc` → NETWORK_DISABLED (:499);
  2. any network other than `ArcTestnet` → CHAIN_ID_MISMATCH (:500);
  3. the wallet id (:501);
  4. status `Active` (:502);
  5. no `vaultId` (:503);
  6. the address equals the binding's `fromAddress` (:504).
- The echo of the DFNS answer requires network `ArcTestnet` (:314).
- Mutants P09, P19, P20 and P29 were killed. The test "refuses a wrong chain ID in the proposal" (dfns-gateway.test.ts:698) and the mainnet/other-network wallet test (:705) pass.

**C-14 Check 2, binding: PASS.**
- The digest recomputes (:470). I recomputed it independently in Python (length-prefixed sha256) for the sample binding: `0x49898fbd…096a5a`. The code gives the same value.
- A proposed `to` or amount that differs from the binding gives BINDING_MISMATCH and QUARANTINE (:351, :356–358). Test :717 covers this.
- The body is built from the binding only (:366–369).
- The DFNS echo is checked for externalId, walletId, network, kind, `to`, amount and contract (:308–320).
- Mutants P10, P11, P32 and P33 were killed.

**C-15 Check 2, open reservation: PASS.**
- A terminal payment or leg, or a pending P6, is refused before any DFNS call (:374–377).
- P1 missing → QUARANTINE. P1 AMBIGUOUS → retry. P6 AMBIGUOUS counts as released. P6 existing while the leg is non-terminal → QUARANTINE (:378–386).
- Mutant P26 was killed.

**C-16 Check 3, one request per payment, the marker and replay: PASS.**
- `attempt: 1n` is in the type (:115), and `SubmitRequest` has no attempt field.
- `deriveExternalId('pay-0123456789abcdef0123456789abcdef')`, recomputed in Python, is `nv1-fc03858be34948615c6fce9cfdc4631b5f8561ec`. It is 44 characters, inside DFNS's 1–50 [transfer-asset.md:165–166]. The code gives the same value.
- The marker is committed before the POST (test :327 records the request count at `markSubmit`). It is read back on every path (:427–440): our marker, not QUARANTINED, the same binding, `externalRef` null, and not terminal or p6Pending.
- A re-POST sends only bytes whose digest equals the marker's. The gateway checks this (:416), and so does the client (client.ts:326).
- A resolved leg is read with GET and never POSTed again (:481–489).
- On the POST: 409 → QUARANTINE (:532); 429 or a failed user action → wait; any other 4xx → refused, with the leg left UNRESOLVED and QUARANTINED (:534); timeout or 5xx → AMBIGUOUS (:530).
- Mutants P17, P18, P21, P24 and P31 were killed.

**C-17 Check 4, wrapper-call rule, including tampered inner calls: PASS.**
- A call that is not allow-listed or does not verify → CONTRACT_CALL_NOT_ALLOWED with QUARANTINE. A verified call → CALL_ROUTE_NOT_ENABLED, because D1 has no route (:340–347).
- `verifyWrapperCall` (wrapper.ts:140–166) requires all of these:
  - an exact allow-listed address;
  - value 0;
  - canonical re-encoding;
  - empty `memoData`;
  - `memoId` = `deriveMemoId(paymentId)` (recomputed `0x45b1e4c6…63fa06`, which matches);
  - an inner target in the allow-list (C-12 by default);
  - inner `transfer(address,uint256)` re-encoded canonically;
  - recipient and amount×10¹² equal to the binding.
- Tamper tests cover a swapped recipient, a changed amount, an extra call, a different target, nesting, trailing bytes and a wrong memo (dfns-gateway.test.ts:739, :748).
- An ERC-20 proposal must name the C-12 token (:355).
- Mutants P12–P16, P34 and P35 were killed.

**C-18 Check 5, rail state and nonce hold: PASS, with one new minor (n1).**
- PAUSED, an unhealthy indexer, no agreed head and a QUARANTINED payment are all refused.
- `listActiveHolds` is read on every submission, and again after the marker, just before `createTransfer` (:492, :526–527). This fixes the earlier m1, and mutant P02 was killed.
- The rail state itself is read only once (n1).

**C-19 Check 6, destination: PASS.** A COMPANY-owned destination, or a customer wallet not owned by the receiver, → DESTINATION_NOT_ALLOWED. On a re-POST it quarantines (:391–399, :507–510).

**C-20 Check 7, fees: PASS.**
- `standard.maxFeePerGas` is parsed as a bigint from a `^\d+$` string (types.ts:168–170).
- Above the ceiling → RETRY_LATER. Fees for another network are refused (:512–517).
- The ceiling must be in [C-30, C-31]. Recomputed: 20×10⁹ = 20,000,000,000 (:76) and 20,000×10⁹ = 20,000,000,000,000 (:78).

**C-21 Units, recomputed in Python and compared with U1 output in the /tmp copy: PASS.**

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

All rows match U1. In Erc20 mode, `checkProposal` requires units×10¹² = binding.amount, so the body's remainder is provably 0. Dust is refused (test :764).

### DFNS status mapping (§8.6) and webhooks (§8.7)

**C-22 Status mapping: PASS.** I probed `mapTransferStatus` directly in the /tmp copy:

| Input | Result |
|---|---|
| `Failed`, no `txHash`, `dateBroadcasted` set, `details.nonce` 7 | FAILED_UNPROVEN, quarantine, `nonceHold{nonce:7}` (types.ts:540). **The earlier B1 is fixed.** |
| the same, with an accepted abort | ANOMALY |
| `Failed`, no hash, no date, accepted abort, nonce `0x1f` | A2, CANCELLED_BY_OPERATOR, `nonceHold{31, aborted}` |
| hash-less `Failed` with nonce `"0x"` | FAILED_UNPROVEN, nonce null (Q-N20) |
| `Failed` with a hash | HOLD_FOR_INDEXER |
| `Failed` with a hash and an accepted abort | ANOMALY |
| `Rejected`, nonce `"3"` | A1, `approvalUnverified`, hold 3 |
| `Rejected` with an accepted abort | ANOMALY |
| `Confirmed` without a hash | ANOMALY |
| a `replacementId` | ANOMALY (F-18) |
| `Executing` with `dateBroadcasted` | ANOMALY |

- No mapping is ever COMPLETED (§2 rule 6).
- Mutants P01 and P27 were killed. The test is dfns-types.test.ts:364.

**C-23 Webhook authenticity (forged): PASS.**
- The order of checks is (webhook.ts:190–202): size cap, then source IP, then the header `sha256=<64 lower-hex>`, then the empty-key refusal, then HMAC-SHA256 over the raw bytes with `timingSafeEqual` on 32-byte buffers. All of this happens before any parse.
- The constructor refuses an empty secret or an empty IP list (:213–214).
- Forged tests:
  - wrong secret → 401 and no re-read (dfns-webhook.test.ts:244);
  - a leaked-secret body is overridden by the GET re-read (:255; e2e :86).
- Mutants P04, P30 and P36 were killed.

**C-24 Webhook replay and dedupe: PASS.**
- `|now − sent| ≥ 300` → 401 (:233–235).
- The same event id with the same bytes → REPLAYED_EVENT, with no re-read. With different bytes → EVENT_ID_CONFLICT and an alert (:237–240).
- DFNS retries carry a new id, so they dedupe on the entity key `dfns:transfer:<id>:<status>` with the §10.3 projection digest (types.ts:394–415). Test :432 shows the webhook and the GET give the same key and digest.
- Mutants P03, P05 and P23 were killed.

**C-25 Webhook ordering (out of order): PASS.**
- The per-transfer high-water mark returns STALE for an older rank and SIGNAL_CONFLICT for a different status at the same rank (:270–275).
- The mark is raised, and the event id recorded, only after the sink returns APPLIED or DUPLICATE. NOT_COMMITTED → 503 with nothing recorded (:285–292).
- The re-read must match the hinted wallet and transfer (:263).
- Mutants P06, P07 and P08 were killed. Tests :325, :342, :352, :359 and :367 pass.

### Facts, fakes and allow-list

**C-26 DFNS facts re-checked against the archive: PASS. No invented fact.**
- **Network names:** `Arc | ArcTestnet`, tier 1 [networks_index.md:34].
- **Id patterns:**
  - `wa-` [get-wallet.md:62];
  - `xfr-` [get-transfer.md:71];
  - `^ap-` [get-transfer.md, approvalId].
- **Transfer request body** [transfer-asset.md]:
  - `amount` `^\d+$` (:107);
  - `externalId` 1–50 (:165–166);
  - priority enum Slow/Standard/Fast;
  - Erc20 `contract` and `to` pattern `^0x[0-9a-fA-F]{40}$` (:885–889).
- **TransferRequest** [get-transfer.md:2257–2370]:
  - the six statuses, with "`Failed` | Indicates either system failure to complete the request or the transaction failed on chain";
  - `dateBroadcasted` "When the transfer was broadcasted to the blockchain";
  - `replacementId` "(cancel or speed-up)";
  - `details` "Structured representation … (e.g. nonce, gas parameters). Shape is blockchain specific";
  - required: id, walletId, network, requester, requestBody, metadata, status, dateRequested.
- **Status transitions** [transaction-monitoring.md:38–50]: "Pending --> Rejected", "Executing --> Failed", "Broadcasted --> Failed", and "Blocked by policy or approval rejected".
- **Idempotency** [idempotency.md:20–44]: the same request → 200 with the existing entity; a different body or wallet → 409; after a terminal status the externalId is permanently bound; "`txHash` … present means it was broadcast on-chain, absent means it failed off-chain".
- **Abort and cancel:**
  - abort applies to a transfer "currently in 'Executing' status and has not yet been signed" [abort-transfer.md:7];
  - the EVM `nonce` is anyOf integer ≥ 0, `^\d+$` or `^0x[0-9a-fA-F]*$` [cancel-transfer.md:578–585]. The code is stricter and requires at least one hex digit.
- **Webhooks:**
  - header `X-DFNS-WEBHOOK-SIGNATURE: sha256=<hex>`, HMAC-SHA256, `REPLAY_ATTACK_TOLERANCE = 5 * 60` with a strict `<` [webhooks.md:36–71];
  - the five `wallet.transfer.*` kinds [webhook-events.md:69–73];
  - "doesn't guarantee delivery of events in the order" (:279);
  - anything but 200 is a failed delivery, retried up to 5 attempts over 24 h, with `deliveryAttempt` and `retryOf` (:288–294).
- **Regions:** Europe `api.dfns.io` with webhook IP `35.181.116.68`; UAE `api.uae.dfns.io` [regions.md:24–25].
- **Assets:**
  - `Erc7984` "EVM ERC-7984 confidential tokens", which requires `kind` and `contract` [get-wallet-assets.md:139–145];
  - balances "in their smallest unit … as strings" and "not a live read from the chain" [displaying-balances.md:9, :208].
- **Fees:** `/networks/fees` with the `network` query and `Eip1559`/`maxFeePerGas` [estimate-fees.md:29, 111, 205, 274].
- **List transfers:** `limit` maximum 500, `paginationToken`, `nextPageToken` [list-transfers.md:47–82].
- **User actions:**
  - `userActionServerKind` `Api`, plus `userActionHttpMethod`, `userActionHttpPath` and `userActionPayload` [create-user-action-challenge.md:47–72];
  - `challengeIdentifier` and `firstFactor.kind: Key` with `credentialAssertion` {credId, clientData, signature} [create-user-action-signature.md:70–104];
  - the `X-DFNS-USERACTION` security scheme [transfer-asset.md:2482, 4936].
- **Live re-read** of docs.dfns.co/guides/developers/webhooks on 2026-10-07: the header name, the `sha256=` prefix and the 5×60 strict-`<` tolerance match the archive.

**C-27 Arc facts re-checked against the archive and live: PASS.** All live reads were on 2026-10-07.

| Constant | Value | Archive | Live |
|---|---|---|---|
| C-01 | 5042002 | rpc-endpoints.md:64 | docs.arc.io/arc/references/rpc-endpoints.md: "\| **Chain ID (Testnet)** \| `5042002` \|" |
| C-12 | `0x3600…0000`, 6 decimals | contract-addresses.md:48 | contract-addresses.md, same address and decimals |
| C-62 | Memo `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | contract-addresses.md:288; transaction-memos.md:22 | contract-addresses.md, same address |
| C-30 | 20 gwei | gas-and-fees.md:38 | gas-and-fees.md, "Minimum base fee (testnet) \| 20 Gwei" |
| C-31 | 20,000 gwei | gas-and-fees.md:39 | gas-and-fees.md, "Maximum base fee \| 20,000 Gwei" |

The Memo ABI `memo(address target, bytes calldata data, bytes32 memoId, bytes calldata memoData)` (transaction-memos.md:42–47) matches wrapper.ts:52–65. The rows in docs/constants.md carry the same values.

**C-28 Two structurally different DFNS fakes and recorded fixtures: PASS.**
- **Fake #1, `DfnsSimulator`,** is stateful. It requires the bearer token and the User-Agent, binds a single-use user action to the method, path and payload, and enforces externalId idempotency: the same body gives 200, a different body gives 409.
- **Fake #2, `RecordedDfns`,** is a stateless script that pins the call sequence.
- The gateway runs over both fakes, in two Nova worlds (Map and Log). The webhook runs end to end over both fakes (dfns-webhook-e2e.test.ts:86, :121).
- I re-checked the fixtures against the archive:
  - wallet `wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx`, `0x00e3495c…dac47`, "trading hot wallet" [get-wallet.md:304–307];
  - webhook `wh-xxx-xxxxxxx`, `timestampSent` 1701684144, `to` `0xb282dc…b25f`, amount `1000000000` [webhook-events.md:22–44];
  - schema example ids `wa-5pfuu-…` and `us-6b58p-…` [get-transfer.md:80, :2490];
  - fee examples `1500000000`, `1626000000000` and `1000000000` [estimate-fees.md:273–324];
  - balances `1500000000000000000` and `1000000` [displaying-balances.md:17, :25].
- Each edit is named in the fixture's header.

**C-29 Closed allow-list: PASS.** Only the 8 templates at client.ts:155–164 can be sent. Cancel, speed-up and abort are refused before the transport sees them. Mutant P25 was killed.

**C-30 MC-03, MC-10, MC-34 and MC-44 spot checks: PASS.**
- Conversions go only through U1.
- Keys are length-prefixed sha256.
- There are no LLM imports.
- The § and DF references I sampled resolve. For example, client.ts:259–264 quotes displaying-balances.md:208 verbatim, and types.ts:205–207 quotes get-transfer.md `details`.

**C-31 JL-1 to JL-6: [inspection-only] PASS.**
- JL-1: every hash-less or contradictory DFNS state now quarantines or holds.
- JL-2: the fee ceiling is configuration (Q-N8).
- JL-6: no memo is sent, the memo id is a hash, and `memoData` must be empty.

## Earlier findings (11:30 pass), re-checked

| Earlier finding | Status now | Evidence |
|---|---|---|
| B1: hash-less `Failed` with `dateBroadcasted` → HOLD_FOR_INDEXER with no hold | **FIXED** | types.ts:540; probe C-22; test dfns-types.test.ts:364; mutant P01 killed |
| m1: holds not re-read after the marker | **FIXED** | index.ts:526–527; tests dfns-gateway.test.ts:608 and :640; mutant P02 killed |
| m2: approval-detail gap recorded only in code | **OPEN** (carried as m2) | It is now also a typed `gap` field on IGNORED (webhook.ts:164, :245), but design §8.2 row "Approval detail" (NOVA_ARC_DESIGN.md:756), F-1 (:1077), §8.7 rule 5 and §10.3 still list `GET /v2/policy-approvals/{id}` and the `dfns:approval:` key as D1 behaviour. grep of OPEN_QUESTIONS.md, LEDGER.md and the design finds no record of the deviation |
| m3: an Erc7984 row fails the whole assets read | **FIXED** | types.ts:112–134; test dfns-assets.test.ts:104; mutant P22 killed |
| m4: delivery-log digest format not pinned | **FIXED** | test dfns-webhook.test.ts:299; the Stryker survivor is gone; mutant P23 killed |

## CANDIDATES (Lens R observations used to decide the defect list)

| Candidate | Evidence | Verdict | Reason |
|---|---|---|---|
| R-c1: rail PAUSE and indexer health read once | index.ts:455 `const rail = await deps.rail.getRailState();` is the only rail read. Nothing re-reads it before :529 `deps.dfns.createTransfer(…)` | REAL, minor (n1) | See n1 |
| R-c2: `details: null` fails the decode | types.ts:233–235 `optObject` refuses an explicit null, so the probe gives "JsonShapeError: details: expected an object" | DISMISSED | The archive types `details` as `type: object` with no null (get-transfer.md:2357–2363). An out-of-schema body becomes AMBIGUOUS, which fails closed |
| R-c3: `src/dfns/json.ts` exempted from the DFNS import boundary | dfns-boundary.test.ts:24 `const NEUTRAL_TARGETS = ['src/dfns/json.ts'];` and :51. Five imports of `dfns/json` exist outside src/dfns and src/gateway (journey/payout/partner ×4, journey/recipients ×1) | REAL, minor (n2) | See n2 |
| R-c4: `findTransferByExternalId` OK(null) misused as proof | client.ts:286–291 | DISMISSED | The doc comment states that null proves nothing (§8.4 check 3, Q-N21). The gateway never calls it, and it never ends a leg |

## DEFECTS

### Blocking

None.

### Minor

**m2 (carried) · src/dfns/client.ts:143–151 and src/dfns/webhook.ts:158–164, :244–245 vs NOVA_ARC_DESIGN §8.2 row "Approval detail" (:756), F-1 (:1077), §8.7 rule 5 and §10.3 · Lens R MC-44 / CLAUDE.md rule 5 (record deviations) · minor.**

The gap:
- The design still lists `GET /v2/policy-approvals/{approvalId}` and the `dfns:approval:<id>:<status>` key as D1 behaviour.
- The code leaves both out, for a sound reason: no response schema is archived.
- The deviation is now typed in the code (`gap: 'APPROVAL_DETAIL_NOT_IN_D1'`), but it is still not in the design or in docs/OPEN_QUESTIONS.md.

No money effect: every `Rejected` maps to REJECTED with `approvalUnverified` and a page.

Fix: record the deviation in the design (§8.2, §8.6, §8.7, §10.3, F-1, F-2) and in OPEN_QUESTIONS, next to Q-N3.

**n1 · src/gateway/index.ts:455–457 vs :529 · §8.4 check 5 ("the rail is not PAUSED; the indexer has been healthy"), CLAUDE.md "Fail closed" · minor.**

`getRailState()` is read once, at the start of `submit`. The read-back after the marker re-checks quarantine, the binding and the leg, and since the m1 fix the holds too, but not the rail state. Between the first read and the POST the gateway makes several remote calls: the P1 and P6 ledger reads, holds, `getWallet`, the registry, precheck, `getFees`, `markSubmit` and the read-back.

Probe in the /tmp copy, in both store worlds (Map and Log):
- PAUSE set during `markSubmit` → `SUBMITTED`, 1 POST.
- indexer marked unhealthy during `markSubmit` → `SUBMITTED`, 1 POST.

Why this is minor:
- Every check has some window.
- DFNS policy approval (POL-1) still gates signing.
- The marker makes the outcome exactly-once.
- The design does not say how fresh the rail-state read must be.

It is the same race class as the earlier m1, which was fixed only for holds.

Fix: re-read `getRailState()` together with the post-marker hold re-read (index.ts:526), and refuse RAIL_PAUSED or INDEXER_UNHEALTHY there, leaving the leg UNRESOLVED.

**n2 · test/unit/dfns-boundary.test.ts:18–24, :51, :62–67 (commit 6ef160f, JPARTNER block) vs NOVA_ARC_DESIGN §3 ("A dependency lint rule forbids importing … `src/dfns/**` from anywhere except their own directory and the composition root") · Lens R MC-44 / phase discipline (the unit's frozen boundary changed outside a DFNS block) · minor.**

What changed:
- The boundary test now exempts `src/dfns/json.ts`. Four JPARTNER files and journey/recipients import it.
- The exemption is guarded: json.ts must import nothing, and it must be the only exempt file. json.ts carries no DFNS endpoint or state.
- The deviation from §3 is recorded only as an "Open item" in a test comment. It is not in the design, LEDGER or OPEN_QUESTIONS.
- It also couples five non-DFNS modules to a DFNS-unit file, so a future DFNS edit to json.ts silently changes JPARTNER's parsing.

No money effect today.

Fix: move json.ts to a shared path (for example `src/json/strict.ts`) and re-point the imports, or record the exemption in design §3 and in LEDGER.

## OBSERVATIONS (not counted against DFNS)

- **OBS-1:** stryker.config.json `mutate` lacks src/journey/quote/fill.ts and src/ops/{audit,ports,queue,types}.ts, which docs/MONEY_PATH.md lists, so test/unit/money-path.test.ts "Stryker mutate (MC-08)" fails. Those files belong to other units.
- **OBS-2:** concurrent Stryker runs copy each other's `.stryker-tmp-*` sandboxes, because `ignorePatterns` in stryker.config.json does not exclude `.stryker-tmp*`. My first run died with ENOENT on `.stryker-tmp-fix-JPARTNER2`. Adding `.stryker-tmp*` to `ignorePatterns` would stop this. My failed run left `.stryker-tmp-verify-DFNS/sandbox-ezKgej` (184 MB). It was not deleted, per the operator's no-delete instruction.

## VERDICT: NEGATIVE (3 defects: 0 blocking, 3 minor)

Zero blocking: no money can be lost, misposted, double-counted or moved without a required control by any path I traced; every fail-closed path exists; every inbound signal is HMAC-, IP- and timestamp-checked and deduplicated; no DFNS or Arc fact is invented; no secret or real API call is present; and every mandatory lint passes.
