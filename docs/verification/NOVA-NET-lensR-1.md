VERIFICATION · lens: R · target: unit NET (src/network/**, src/indexer/**, test/unit/net-indexer.test.ts, test/unit/net-arc-adapter.test.ts, test/unit/net-boundary.test.ts, test/contract/net-adapter.contract.test.ts) · commit: 6ef160f047f069aaa421c433dc1d9f3bb8a81652 (NET files identical in 07e9950 and 6ef160f; `git diff 07e9950 6ef160f` over NET sources, tests and NET design docs is empty)

**Pass details.** An independent verifier subagent ran this pass on 2026-10-07, 14:40–15:00. It is Lens R round 1 (re-run 4), on the NET code as committed in 07e9950. It replaces the 14:07 report, which is kept in git history (07e9950). I did not rely on that report or on the author's comments: every check below was re-run or re-derived in this pass.

**Fingerprint.** sha256 over the NET sources and tests, concatenated in sorted path order: `2e91a2afd945e5c3a913a083a8c67e03311ad884b6aa59d4f9b2f870f528b366`. The value was the same at the start and at the end of the pass, and it matched the scratch copy.

**Inputs.**
- docs/NOVA_ARC_DESIGN.md §2, §3, §5, §6 (6.1–6.7), §10.3
- CLAUDE.md money rules, docs/RUBRIC.md (MC-01, 02, 03, 07, 08, 15, 16, 19, 20, 21, 31, 33), docs/constants.md, docs/MONEY_PATH.md, docs/OPEN_QUESTIONS.md, ADR-002
- the archive under docs/sources (arc/, dfns/)
- the code and the tests

**Guard rules (applied by me).**
- I made no call to the DFNS, Circle, VALR or Arc RPC endpoints and read no .env file. I signed and broadcast nothing.
- The only network reads were six public documentation pages (docs.arc.io ×4, docs.dfns.co ×2), fetched for the MC-21 re-check. I did **not** run `tools/source_drift.py`, because MANIFEST.md also lists hosts outside the three allowed doc sites (fic.gov.za, gov.za, resbank.co.za, inforegulator.org.za).
- Scratch work was done in `mktemp -d` → `/tmp/verify-NET-R1d-SyOSEn`. It is a real-file tar copy of the repo, without `.git`, `.tools`, `reports`, `coverage`, `dist` or the `.stryker-tmp*` dirs. `find -lname '/*'` found no absolute symlink in it. The only link is `plant/node_modules → ../node_modules`, which points to the scratch copy, not the repo.
- Node came from `.tools/node/bin` (v22.23.3).
- Stryker ran in the scratch copy with `--tempDirName .stryker-tmp-verify-NET --reporters clear-text,json`. Stryker removed its own temp dir. I did not run `scripts/ci.sh`. This report is the only file I wrote to the repo.
- Following the operator's "without deleting anything", I left the scratch dir in place (/tmp, about 283 MB).

## CHECKS

### Mechanical (reconstructed)
- **tsc.** `npx tsc --noEmit` (scratch) → exit 0. **PASS**
- **NET tests.** The 4 NET files run **163/163**, all passing. With `mainnet-gate.test.ts` added the count is 205/205. **PASS**
- **MC-01 float lint.** `node tools/lint-money-floats.mjs` → "51 money-path files, 0 finding(s)", exit 0. **PASS**
- **Semgrep MC-01 layer.** `tools/semgrep/mc01-money-float.yml`, run with `--no-git-ignore --error` on the 12 NET source files: 13 rules, **0 findings**, exit 0. **PASS**
- **Semgrep vendored JS/TS rules** (a84ff9cc…): 203 rules on the 12 NET sources and 4 NET tests → **0 findings**, exit 0. **PASS**
- **MC-07 coverage.** v8 coverage over the NET tests only (scratch):

  | File | Lines / branches / functions / statements |
  |---|---|
  | decode | 100 / 100 / 100 / 100 |
  | fetch | 100 / 100 / 100 / 100 |
  | indexer | 100 / 100 / 100 / 100 |
  | rpc | 100 / 100 / 100 / 100 |
  | store | 100 / 100 / 100 / 100 |
  | network/types | 100 / 100 / 100 / 100 |
  | arc/adapter | 100 / 100 / 100 / 100 |
  | arc/config | 100 / 100 / 100 / 100 |
  | arc/params | 100 / 100 / 100 / 100 |
  | fake/adapter | 100 / 100 / 100 / 100 |

  The only gaps are in test fakes, which are not on the money path: `indexer/fakes.ts` (branches 99.1, line 147) and `arc/blocklist-fakes.ts` (one function, line 29). **PASS**
- **MC-08 Stryker, NET files only.** Mutated: `network/types`, `arc/{params,adapter,config}`, `fake/adapter` and `indexer/{rpc,fetch,indexer,decode,store}`. Vitest was narrowed to the 4 NET test files by a scratch config. Results: 1,475 mutants, **score 98.58 %** (1,436 killed, 18 timeouts, 21 survived, 0 no-coverage, 0 errors). Break threshold is 90. **PASS**

  I adjudicated all 21 survivors from their exact source spans in the JSON report. Each is equivalent:
  - The `'utf8'` → `""` mutants (decode.ts:123, fake/adapter.ts:51, fake/adapter.ts:185) are equivalent because Node's default input encoding is utf8.
  - fetch.ts:35 `end < to` → `<=`, fetch.ts:46 `raw < cap` → `<=`, indexer.ts:143 `x < low` → `<=`, :248 `<` → `<=`, :249 `>` → `>=`, and :119 `logIndex <` → `<=` are equivalent: equal values pick the same result, and the merged keys are unique.
  - fetch.ts:109, span `[r.kind === 'ERROR']` → `true`: equivalent, because an EXHAUSTED result has no `code`, so `includes(undefined)` is false.
  - indexer.ts:76 `toLowerCase` → `toUpperCase`: equivalent, because the same transform is applied to both sides of every comparison.
  - indexer.ts:121, span `[sorted.filter((y) => before(x, y))]` → `sorted`: this one is not equivalent in its intermediate state. It duplicates earlier logs, but the duplicates carry the same dedupe key and digest, so the store folds them into one row. At worst an extra ERC-20 copy produces UNKNOWN_EVENT, which fails closed. No money effect.
  - indexer.ts:167, span `[first === second]` → `false`: equivalent. The same object has the same name, so the name check still refuses it (test l.425).
  - indexer.ts:414 `missing` initial value: equivalent, because `maxAttempts ≥ 1` and the array is reassigned before it is read.
  - indexer.ts:437 `every` → `some`: equivalent, because when a receipt was found, `missing` holds at most one source (two sources at most).
  - indexer.ts:457, span `[found === null]` → `false`: equivalent, because `found === null` implies that `missing` is non-empty. The other :457 survivor, `'MISSING'` → `""`, is also equivalent: both consumers test only `kind === 'ALL'`.
  - indexer.ts:522 `d.kind === 'CANONICAL'` → `true`: equivalent, because a non-canonical decode has no `value`.
  - arc/adapter.ts:63, both `PRECOMPILE_RE` anchors: equivalent, because the input has already been checked to be exactly `^0x[0-9a-f]{40}$`.
  - types.ts:258 `^\d+$` → `^\d+`: equivalent, because a bigint's decimal text is either digits or `-digits`.
- **Planted mutants (my own, in `plant/`, NET tests after each, bail on first failure).** **35/35 killed**, plus 1 control. The control, M00 (`end <= to`, known to be equivalent), SURVIVED, which shows that the harness can report a survivor. The 35:
  - M01: the ERC-20 emitter made canonical
  - M02: the pairing check skipped
  - M03: pairing ignores the value
  - M04: one canonical log pairs two ERC-20 logs
  - M05: `logIndex` dropped from the dedupe key
  - M06: an unknown error made non-sticky
  - M07: an unknown error read as "no logs"
  - M08: `-32014` not retried
  - M09: the agreed head is the highest
  - M10: no CHAIN_STALL
  - M11: RPC_DISAGREEMENT not sticky
  - M12: the stored halt not checked
  - M13: the cursor skips a block
  - M14: pages of 10,000 blocks
  - M15: status 0 credited
  - M16: a log present only on the reference is missed
  - M17: the same approver twice is allowed
  - M18: the blocklist age check made 1,000× looser
  - M19: confirmTx above the head
  - M20: confirmTx returns null on a missing source
  - M21: FakeNet does not dedupe
  - M22: non-zero topic padding accepted
  - M23: a log touching none of ours accepted
  - M24: a foreign receipt accepted
  - M25: `value` dropped from the digest
  - M26: SIGNAL_CONFLICT ignored
  - M27: FakeNet dust accepted
  - M28: a self-transfer accepted
  - M29: receiptCarries skipped
  - M30: the single-source flag allowed with mainnet
  - M31: the split is not a halving
  - M33: CURSOR_CONFLICT ignored
  - M34: unlimited head regression
  - M35: poll returns only `[]`
  - M36: FakeNet ack is partial

  **PASS**
- **Secrets and real calls.** gitleaks `detect --no-git` on a /tmp copy of every NET file → "no leaks found". A grep for `fetch(`, `http(s)://`, `process.env`, privateKey, mnemonic, secret, apiKey, token, Bearer and `.env` across the NET sources and tests found **no hits**. **PASS**
- **Mainnet (MC-20 slice).** Two greps over NET:
  - `5042` other than `5042002` → none;
  - `'Arc'` → only `DFNS_ARC_NETWORKS.mainnet { name: 'Arc', enabled: false }` (config.ts:28).

  In config.ts:76–92, mainnet without the flag goes through U2's gate (`resolveChain`), and then `chainId !== testnetId` throws anyway. Mainnet together with the flag gives ArcConfigError. Tests net-arc-adapter l.85–92 and my mutant M30 confirm this. The indexer constructor (indexer.ts:159) and precheck (adapter.ts:288) re-pin 5042002 / `ArcTestnet`. `mainnet-gate.test.ts` passes. **PASS**
- **Agnosticism lint (§3).** `net-boundary.test.ts` passes. A grep finds no module outside `src/network/**` or `src/indexer/**` that imports `network/arc` or `indexer/`. **PASS**
- **Contract tests on both implementations (§5.3).** `describe.each` runs one suite on ArcNetworkAdapter (two in-memory chains) and on FakeNetAdapter. It covers every item §5.3 lists: U1 round trip, idempotent poll, dedupe of a re-delivered transfer, cursor resume after a crash, disagreement, stall, unknown event and precheck refusals. It also covers ack, partial-commit loss, CURSOR_CONFLICT and a restart that keeps the halt. M21, M27 and M36 (FakeNet mutants) were killed. **PASS**

### Numbers and units (recomputed by hand, then confirmed by running the code)
- **U1, `toNetworkAmount(m, p) = m × 10^(18−p)`**, run through ArcNetworkAdapter (probe V7). Every row equals my hand value. **PASS**

  | m | p | Result |
  |---|---|---|
  | 0 | 2 | 0 |
  | 1 | 2 | 10¹⁶ |
  | 12,345 | 2 | 123,450,000,000,000,000,000 |
  | 1 | 6 | 10¹² |
  | 999,999,999 | 0 | 999,999,999 × 10¹⁸ |
  | 7 | 15 | 7,000 |
  | 1 | 18 | 1 |
- **Two-log ERC-20 fixture (MC-15), probe V1, on both store fakes.** Hand value: 1,500,000 units × 10¹² = 1,500,000,000,000,000,000 wei. Result: **one** transfer of exactly that amount at log index 0 (the system log), `pending()` = 1, and the second poll still returns 1 (no duplicate). **PASS**
- **Paging (C-40).** By hand, `pageRange(1, 25000, 9999)` gives 1–9,999, then 10,000–19,998, then 19,999–25,000, so every page has `to − from ≤ 9,998`. U2 `getLogsMaxBlocksPerPage = 9_999n`. Mutant M14 was killed. **PASS**
- **Backoff (C-42, values ours, Q-N6).** Policy 250 ms, cap 8 s, 8 attempts. By hand, `d = min(8000, 250·2ⁱ)` for i = 0…6 gives 250, 500, 1000, 2000, 4000, 8000, 8000. The minimum jitter `d/2` gives 125, 250, 500, 1000, 2000, 4000, 4000. That matches the code's formula, and the test pins it. **PASS**
- **Fee constants carried.** `feeFloorWei` = 20 gwei = 2×10¹⁰ (C-30). `maxBaseFeeWei` = 20,000 gwei = 2×10¹³ (C-31). Both are read from U2 unchanged. **PASS**

### Arc / DFNS facts: archive re-checked, integrity verified, live page diffed
Archive integrity: the recomputed sha256 matches MANIFEST.md for all 9 archive files NET relies on.

| Fact | Archive evidence | Live 2026-10-07 14:49 | Result |
|---|---|---|---|
| C-01 `5042002` | rpc-endpoints.md l.64 | quote unchanged | PASS |
| C-40 `-32012` / ≤9,999 | rpc-endpoints.md l.105–108, l.118 | unchanged (the page differs only in WebSocket URLs and a status-page sentence) | PASS |
| C-42 `-32014` retry; load-balanced backends | rpc-endpoints.md l.40–44, l.119 | unchanged | PASS |
| C-20 emitter, C-21 topic0, C-22 two logs, C-24 zero-value and self-transfer | usdc-system-events.md l.35, 39, 64, 66, 78–79 | page **identical** to archive | PASS |
| C-12 `0x3600…0000`, 6 dp | contract-addresses.md l.48 | unchanged (live page adds an ERC-8183 section) | PASS |
| C-50 no reorgs | deterministic-finality.md l.26 | page **identical** | PASS |
| C-27 `tx.from` relayer, C-15 raw 18 dp | deposits.md l.209, 289–290 | archive only | PASS |
| C-28 `Blocklisted` / `UnBlocklisted` | indexing-events.md l.287–288 | archive only (UNVERIFIED per constants, Q-A5) | PASS (cited as unverified) |
| DF:networks "\| Arc \| ArcTestnet \| 1 \| N/A \| 10 \| \| \|" | dfns/networks_index.md l.34 (Confirmation Delay column l.29) | page **identical** | PASS |
| DF:transfer: `Native`, `^\d+$`, minimum denomination, `Standard`, externalId 1–50 | transfer-asset.md l.9, 101, 107, 124, 165–166 | unchanged (live page adds an Authentication / Permissions block) | PASS |

U2 values (src/chain/config l.82–99) equal the archive: chainId, ERC-20 address, emitter, topic0, 9,999, -32012, -32014 and -32602 (C-41, UNVERIFIED, Q-A4). **No invented DFNS or Arc fact found.** **PASS**

### Logic re-trace (§6 money path)
- **§6.1 canonical-only credit.**
  - Only `kind: 'CANONICAL'` logs (emitter = C-20) become transfers (indexer.ts:369, 400).
  - Each ERC-20 log must pair 1:1 with a canonical log in the same tx, with the same `from`/`to` and value × 10¹² via U1 (decode.ts:98–109). Otherwise → UNKNOWN_EVENT.
  - `from`/`to` come from the topics (decode.ts:84–86).

  Killed: M01–M04, M22, M23. **PASS**
- **§6.2 faults.**
  - `-32012`/`-32602` halve and never widen; one block that still fails → RANGE_UNRECOVERABLE, sticky (fetch.ts:174–182).
  - `-32014` and transport errors retry with backoff; when exhausted → SOURCE_LAGGING, not sticky.
  - Any other code → SOURCE_STOPPED, sticky (fetch.ts:183, indexer.ts:71).
  - A log outside the requested range → SOURCE_STOPPED.
  - Probe V4: `-32603` on the reference's getLogs only gives FAILED SOURCE_STOPPED, the halt is stored, 0 pending, the cursor stays null, and the next poll is still FAILED.
  - Probe V6: `-32014` × 8 on head → SOURCE_LAGGING with no halt; `-32012` on a 4-block page gave ranges 1-4, 1-2, 3-4, 1-4 and the log was delivered.

  Killed: M06–M08, M31. **Never "no logs."** **PASS**
- **§6.3 two sources.**
  - The constructor requires 2 distinct sources; 1 only with the flag (indexer.ts:162–169).
  - The log sets are compared both ways on full content, including block hash (indexer.ts:541–549).
  - Heads at one height with different hashes → RPC_DISAGREEMENT (indexer.ts:247).
  - Receipts are compared by fingerprint.
  - Probe V8: different log content → RPC_DISAGREEMENT, sticky, cursor frozen at 1.

  Killed: M09, M11, M16, M20. **PASS**
- **§6.4 exactly once.**
  - Dedupe key `arc:5042002:<txHash>:<logIndex>` (types.ts:243–245) is the §10.3 key.
  - The digest projection matches the §10.3 list. The keys are sorted (blockHash, chainId, from, logIndex, status, to, txHash, value), and I checked the order by hand.
  - Page and cursor commit in one call, with compare-and-set (indexer.ts:318–321).
  - The same key with a different digest → SIGNAL_CONFLICT → RPC_DISAGREEMENT.
  - Probe V5: an INTERNAL transfer read by two cursor groups, acknowledged once, gives 1 inbox row and is not re-delivered.

  Killed: M05, M13, M25, M26, M33, M35. **PASS**
- **§6.5 confirmation.**
  - Status must be 1 (else UNKNOWN_EVENT); the receipt must be in the same block and must carry the credited log; foreign receipts are refused.
  - `confirmTx` returns null above `head − confirmations`.
  - A status-0 receipt is returned with its gas and no transfers.

  Killed: M15, M19, M24, M29. **PASS**
- **§6.6 liveness.** No source advances for `stallAfterMs` → CHAIN_STALL. One source frozen → SOURCE_LAGGING. Neither is sticky, and both are stored with the stream. Probe V8 confirms that CHAIN_STALL clears once a block arrives. Killed: M10, M34. **PASS**
- **"Raise PAUSE".** NET returns typed FAILED results, documented at types.ts:48 as "FAILED always means: PAUSE outbound and page a human". The sticky kinds freeze the cursors until two distinct approvers resume. Writing the rail PAUSE state belongs to the D1 orchestrator / composition root (design §3 S3). Today the gateway reads it (`RAIL_PAUSED`, gateway/index.ts:456), and `COMPOSITION_ROOTS` is empty. **[inspection-only] PASS at the NET boundary.** It must be proven when S3 is generated.
- **MC-16 "-32603 Blocked address classified exactly".** C-57 is about `eth_call`/`eth_estimateGas`, which NET never issues. On NET's reads, `-32603` is unknown → SOURCE_STOPPED (probe V4). Not applicable to NET; it belongs to the gateway / simulation unit.

### Rubric items applicable to NET
| Item | Result |
|---|---|
| MC-01 | PASS |
| MC-02 | PASS (amounts are U1 brands only; tsc clean) |
| MC-03 | PASS (only U1 converts: `cbsMinorToNativeWei`, `usdcUnitsToNativeWei`) |
| MC-07 | PASS |
| MC-08 | PASS (98.58 %) |
| MC-15 | PASS |
| MC-16 | PASS (for NET reads) |
| MC-20 | slice PASS |
| MC-21 | PASS for NET citations |
| MC-33 | slice PASS (SAST 0, gitleaks 0) |
| **MC-19** | **FAIL → m3** |
| **MC-31** | **FAIL → m1** |

## PROBES (plant/test/unit/zz-verify-net.test.ts, observed)
- **V1.** Two-log ERC-20 on MapIndexerStore and JournalIndexerStore → 1 transfer, 1,500,000,000,000,000,000 wei, log index 0, pending 1, no duplicate on re-poll. **PASS**
- **V2.** confirmTx: the reference's head has reached block N, but its `getReceipt` returns null (C-42: a load-balanced backend behind the one that answered `head`). Result: `FAILED RPC_DISAGREEMENT`, **stored as a sticky halt**. The same condition in poll gives `SOURCE_LAGGING`, halt null. → **m6**
- **V3.** A lone **zero-value** ERC-20 `Transfer` X→ours (no system log), status 1. Result: `FAILED UNKNOWN_EVENT`, stored halt. Resume with ('alice', 'alice') is refused; ('alice', 'bob') clears it. → confirms **m2**
- **V4.** An unknown `-32603` on the reference's getLogs → SOURCE_STOPPED, sticky, 0 pending, cursor null. **PASS**
- **V5.** INTERNAL A→B, A indexed and acked first, then B added from `startBlock` → 0 re-delivered, 1 inbox key. **PASS**
- **V6.** `-32014` × 8 on head → SOURCE_LAGGING, not sticky. `-32012` on a 4-block page splits it, and the log is delivered. **PASS**
- **V7.** The U1 table. **PASS**
- **V8.** CHAIN_STALL after 30 s with no block, no halt. Then different log content → RPC_DISAGREEMENT, sticky, cursor 1. **PASS**

## CANDIDATES considered and dismissed
- **C1 · poll: a receipt that stays missing never escalates to a sticky halt** (indexer.ts:412–423). Each poll returns FAILED (PAUSE plus page), so outbound stays paused while the condition lasts, and nothing is delivered. **DISMISSED** (fails closed).
- **C2 · `dfnsTransferBody` does not itself refuse amount 0 or an unchecked `to`** (adapter.ts:314–317). The body is used against fakes only until Q-N1/Q-N2 are answered, precheck refuses both cases, and the gateway binds `to`/amount to the server record (design §8.4). **DISMISSED.**
- **C3 · `-32602` is also JSON-RPC's generic "invalid params"**, so an invalid-params reply is bisected to one block and then becomes RANGE_UNRECOVERABLE, not SOURCE_STOPPED. Both are sticky halts, so it fails closed, and the design (§6.2, C-41) chose this. **DISMISSED.**
- **C4 · Stryker survivor indexer.ts:121** (duplicate logs in inChainOrder). Store dedupe absorbs it, and the worst case fails closed. **DISMISSED** as equivalent in money effect.

## DEFECTS
- **m1 · MC-31 / L-3 / ADR-002 rule 2: address-filtered reads go to every source, the reference included** · `src/indexer/indexer.ts:333–336` (getLogs with `topic1`/`topic2 = our addresses`, sent to each source) and `:450–451` (receipts for our hashes, sent to each source) · Lens R, MC-31 · **minor** (privacy; not on the blocking list).
  - ADR-002 l.37: "Address-filtered queries go **only** to own nodes. The reference gets unfiltered range queries and block hashes".
  - MC-31 requires an egress-capture test. None exists, and `RpcSource` has no own/reference role.
  - Design §6.1 and §6.3 prescribe the opposite, so this needs a human decision. Neither LEDGER nor OPEN_QUESTIONS records one (`grep` for MC-31, "own nodes" or L-3 in both finds nothing).
  - Carried, unchanged since the last report.
- **m2 · A lone ERC-20 `Transfer` log halts the whole rail, and the zero-value question has not been raised** · `src/indexer/indexer.ts:372–375` and `:499–500` · CLAUDE.md "Fail closed", design §6.1 · **minor** (fails closed; griefing).
  - Probe V3 shows that a third party's zero-value ERC-20 log to our address gives a sticky UNKNOWN_EVENT, and two humans must resume.
  - The archive's "Zero-value transfers emit no log" (usdc-system-events.md l.78) is stated for the **system** log only.
  - OPEN_QUESTIONS has no row on whether NativeFiatToken emits an ERC-20 `Transfer` for `transfer(x, 0)` (`grep` for zero-value / NativeFiatToken finds only Q-A5).
  - Route: add the question. The design should say whether this is a QUARANTINE case rather than a rail halt.
  - Carried.
- **m3 · MC-19: resume approvers are not authenticated in NET** · `src/network/types.ts:194–211`, `src/indexer/indexer.ts:196–201` · **minor**.
  - Distinctness is enforced (M17 killed), and the approvers are recorded.
  - Authentication depends on CF-26 / CF-31, which are open, so MC-19's "authenticated" is not met inside NET.
  - Carried; blocked upstream.
- **m4 · The head-regression tolerance is an operator value with no OPEN_QUESTIONS row** · `src/network/arc/config.ts:37–44` · CLAUDE.md non-negotiable 5 · **minor**.
  - The default is gone: the type requires the value, and a runtime `typeof` check throws (config.ts:100). M34 was killed.
  - The comment says "Q-N6 family", but Q-N6 (OPEN_QUESTIONS.md:126) does not list this value, and `grep regression|tolerance` over OPEN_QUESTIONS and LEDGER finds nothing.
  - Fix: add "head-regression tolerance (proposed 5 blocks)" to Q-N6, or give it its own row with an owner.
  - Carried.
- **m5 · Deviation from frozen design §3 / §6.2** · **minor**.
  - (a) §6.2 says "Implement and reuse the existing U3 stub `pageBlockRange`". NET has its own `pageRange` (`src/indexer/fetch.ts:30`), and the header routes the stub to U3. LEDGER has no routing entry (`grep pageBlockRange` finds nothing).
  - (b) §3 marks N2 `arc/config.ts` "money path: yes", but it is not in MONEY_PATH.md. There is no control gap: Stryker scores it 100 % and coverage is 100 %. It is still an unrecorded deviation.
  - Carried.
- **m6 (new) · confirmTx turns the C-42 load-balanced receipt lag into a sticky rail halt** · `src/indexer/indexer.ts:431–438` (`agreedReceipt`): `if (receipt === null || missing.every((source) => (heads.get(source) as bigint) < receipt.blockNumber)) return { ok: true, value: null }; return disagree(...)` · CLAUDE.md "Fail closed" (false-positive PAUSE), C-42 · **minor** (fails closed; availability).
  - The heads are read first, and the receipt is read in a later request. The archive documents that on the load-balanced endpoint "the backend that reported the current head may differ from the one serving this request" (rpc-endpoints.md l.119; also l.40–44).
  - So a reference that answers `head = N` and then has no receipt for a tx in block N is documented, normal behaviour. confirmTx treats it as RPC_DISAGREEMENT and stores a sticky halt that needs two humans (probe V2).
  - `pollReceipt` (indexer.ts:405–423) handles the same condition as lag: it retries with backoff, and then returns SOURCE_LAGGING, which is not sticky. That is the module's own stated reasoning (header l.36–38).
  - No money is at risk, but the Arc leg's normal confirmation path can halt the whole rail on a benign RPC race.
  - Fix: in `agreedReceipt`, retry a missing source with the `-32014` backoff before deciding. If it is still missing, return SOURCE_LAGGING, not sticky. Keep RPC_DISAGREEMENT for two **different** receipts. Add a test with a source whose head has reached the block but whose receipt read returns null once and then the receipt.

**Out of scope (not charged to NET).**
- `test/unit/money-path.test.ts` fails 1 test: MONEY_PATH.md lists `src/ops/{types,ports,audit,queue}.ts` and `src/registry/index.ts`, and these are not in the Stryker `mutate` list. Route to OPS / registry.
- [inspection-only] A second indexer instance reads the stored halt only at the start of a call (indexer.ts:214). Every page it commits is still two-source-agreed and passes compare-and-set.

### Status of the 14:07 findings (re-checked by reconstruction, not copied)
| 14:07 | Now | Evidence |
|---|---|---|
| m1, MC-31 | m1, still open | code unchanged (hash); no LEDGER or OPEN_QUESTIONS row |
| m2, lone ERC-20 | m2, still open | probe V3; no question row |
| m3, MC-19 | m3, still open | CF-26 / CF-31 still open |
| m4, tolerance row | m4, still open | the grep finds no row |
| m5, layout / paging | m5, still open | no LEDGER routing; config.ts still not in MONEY_PATH |
| — | m6, new | probe V2 |

## VERDICT
NEGATIVE (6 defects: 0 blocking, 6 minor, m1–m6)

There are zero blocking findings:
- no path loses, misposts, double-counts or moves money without its control;
- credit comes only from the system emitter, and the two-log ERC-20 fixture gives one credit;
- dedupe is on (chainId, txHash, logIndex), with digest conflicts detected;
- every log is checked by emitter, topic, two-source agreement and receipt status;
- unknown errors stop and are never "no logs";
- RPC disagreement and stall return FAILED, with disagreement sticky until two distinct approvers resume;
- no invented fact, secret or real API call was found;
- MC-01 lint and Semgrep MC-01 are clean on NET.

Routing:
- **m6** needs a NET code change.
- **m4** needs one OPEN_QUESTIONS row.
- **m1, m2, m3 and m5** need a human decision or another unit (design §6.3 vs ADR-002; the zero-value question; CF-26 / CF-31; U3 / LEDGER).

phase · CO-1 v3 D1 / unit NET Lens R round 1 (re-run 4) · units frozen: n/a (verifier does not freeze) · streak 0/3 · rounds used: not tracked by verifier · regen budget: not tracked by verifier
