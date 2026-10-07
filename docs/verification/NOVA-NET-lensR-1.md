VERIFICATION · lens: R · target: unit NET (src/network/**, src/indexer/**, test/unit/net-indexer.test.ts, test/unit/net-arc-adapter.test.ts, test/unit/net-boundary.test.ts, test/contract/net-adapter.contract.test.ts) · commit: 27774147e485ac38d084a429c2b6856a7a391cc3 (branch co1-v3/nova-arc-d1). The NET fix for the 11:10 report is uncommitted in the working tree: `src/indexer/indexer.ts`, `src/network/{types.ts,arc/config.ts,fake/adapter.ts}` and three NET test files. The sha256 of the NET sources and tests, concatenated in sorted path order, is 2e91a2afd945e5c3a913a083a8c67e03311ad884b6aa59d4f9b2f870f528b366. It was the same at the start and at the end of the pass, and a `cmp` of every NET file against my scratch copy found no difference.

**Pass details.** An independent verifier subagent ran this pass on 2026-10-07, 13:49–14:06. It is Lens R round 1, re-run 3, on the unit as fixed after the 11:10 report. It replaces that report; its m1–m7 are re-checked in the status table at the end.

**Inputs.**
- docs/NOVA_ARC_DESIGN.md §3, §5, §6, §10.3 (DELTA-1 changes nothing in NET)
- CLAUDE.md, docs/RUBRIC.md (MC-15, MC-16, MC-19, MC-31), docs/constants.md, docs/MONEY_PATH.md, docs/OPEN_QUESTIONS.md, ADR-002
- the archived Arc and DFNS sources
- the code and the tests

I did not trust the author's comments or the earlier reports.

**Guard rules (I applied them myself):**
- I made no call to any Arc, DFNS, Circle or VALR endpoint and read no .env file. I checked facts only against the archive.
- Scratch work went into `mktemp -d` → `/tmp/verify-NET-R1c-VtZw4y`. It holds a real-file copy of the repo, made with tar and without `.git`, `.tools`, `reports` or the Stryker temp dirs. `find -lname '/*'` found no absolute symlink in it. The only link I made is `plant/node_modules → ../node_modules`, which stays inside the scratch dir.
- Node came from `.tools/node/bin` (v22.23.3).
- Stryker ran in the scratch copy with `--tempDirName .stryker-tmp-verify-NET --reporters clear-text`. Its temp dir was cleaned, and I deleted the whole scratch dir after the pass. I did not run the full ci.sh, and I wrote nothing to the repo except this report.

## CHECKS

### Mechanical (reconstructed)
- **tsc.** `npx tsc --noEmit` → exit 0. **PASS**
- **NET tests.** The 4 NET files run **163/163** and pass. That is 6 more than at 11:10: the poll-receipt and INVALID_ADDRESS tests. **PASS**
- **MC-01 float lint.** `node tools/lint-money-floats.mjs` → "47 money-path files, 4 finding(s)", exit 1. All 4 findings are in `src/history/index.ts` (lines 151, 160, 216 and 223, unit HIST, another agent's work in progress), and **none are in a NET file**. Not charged to NET. NET **PASS**
- **Semgrep MC-01 layer.** I ran `tools/semgrep/mc01-money-float.yml` with `--no-git-ignore` on all 12 NET source files: 13 rules, **0 findings**. **PASS**
- **Semgrep vendored JS/TS rules.** 203 rules on the 12 NET sources and the 4 NET test files → **0 findings**. **PASS**
- **`test/unit/money-path.test.ts`.** 3 of its tests fail, all in other units:
  - MONEY_PATH lists `src/history/index.ts`, `src/journey/payout/partner/*.ts` (5 files) and `src/journey/recipients/index.ts`, and the Stryker `mutate` list does not include them yet.
  - `src/journey/recipients/index.ts` imports `node:util`, which is not on the allow-list.

  All 8 NET paths are in both lists. Not charged to NET; route the fix to HIST and JPARTNER.
- **Mainnet gate.** `test/unit/mainnet-gate.test.ts` passes. A grep for `5042` other than `5042002`, and for `'Arc'`, in NET finds only `DFNS_ARC_NETWORKS.mainnet { name: 'Arc', enabled: false }` (config.ts:28). The 11:10 probe of the refusal paths still holds on unchanged code (config.ts:76–92): `MainnetGateError` without the single-source flag, `ArcConfigError` with it. **PASS**
- **MC-07 coverage.** v8 coverage, NET tests only, in the scratch copy. All 8 money-path files score **100/100/100/100** (lines, branches, functions, statements), and so do `arc/config.ts` and `fake/adapter.ts`. The only gaps are in the test fakes `indexer/fakes.ts` (one branch) and `arc/blocklist-fakes.ts` (one function), which are not on the money path. **PASS**
- **MC-08 Stryker, NET files only.** It mutated all 10 NET non-fake sources: `network/types`, `arc/{params,adapter,config}`, `fake/adapter`, and `indexer/{rpc,fetch,indexer,decode,store}`. Vitest was narrowed to the 4 NET test files through a scratch config. Score **98.58 %**: 1,436 killed, 18 timeouts, 21 survived, 0 no-coverage, break threshold 90. **PASS**

  I adjudicated all 21 survivors by reasoning, and every one is equivalent.

  The 16 already adjudicated at 11:10, re-confirmed on today's code:
  - `'utf8'` → `""` in decode.ts:123 (Node's default encoding).
  - `end < to` → `<=` in pageRange.
  - `raw < cap` → `<=` in backoffDelay.
  - `r.kind === 'ERROR'` → `true` (EXHAUSTED has no `code`).
  - `toLowerCase` → `toUpperCase` in `text()`.
  - In inChainOrder: `logIndex <` → `<=`, and `...sorted`.
  - `lowest` `<` → `<=`.
  - `first === second` → `false`.
  - In readHeads: `<` → `<=` and `>` → `>=`.
  - `missing.every` → `some`. There are at most two sources.
  - `d.kind === 'CANONICAL'` → `true` in receiptCarries.
  - The two `PRECOMPILE_RE` anchors.
  - The `^\d+$` anchor in dfnsAmount: a bigint's decimal text is either digits or `-digits`.

  The 5 that are new this round:
  - indexer.ts:414, `missing` initialised to `["Stryker was here"]`. The loader enforces `maxAttempts ≥ 1`, so the loop body always runs, and every iteration that does not return reassigns `missing` before the value is read.
  - indexer.ts:457, `found === null ||` → `false`. With at least one source, `found === null` implies that every source returned null, so `missing.length > 0` already holds.
  - indexer.ts:457, `'MISSING'` → `""`. Both consumers test only `kind === 'ALL'`.
  - Two `'utf8'` → `""` mutants in fake/adapter.ts (lines 51 and 185). This file was not in the mutate set at 11:10.
- **Secrets and real calls.** gitleaks on a /tmp copy of every NET file → "no leaks found". A grep for `fetch(`, `http(s)://`, `process.env`, privateKey, mnemonic, secret, apiKey and token across the NET sources and tests → **no hits**. **PASS**
- **My own planted mutants.** I planted 34 mutants in a second scratch copy (`plant/`) and ran the NET tests after each one. **34/34 killed.** **PASS**
  - Control: the known-equivalent `end <= to` survived, which shows that the harness can report a survivor.
  - The 14 that target this round's changes:
    - P1: pollReceipt accepts a receipt that only one source has
    - P2: no retry
    - P3: no backoff sleep
    - P4: readReceipt reports ALL while a source is missing
    - P5: pollReceipt swallows a readReceipt failure and retries
    - P6: SOURCE_LAGGING made sticky
    - P7: INVALID_ADDRESS made sticky
    - P8: pollAddresses skips a malformed address
    - P9: pollAddresses keeps the raw case
    - P10: pollAddresses does not dedupe
    - P11: the address check runs after the head read
    - P12: the tolerance default is restored (the `typeof` guard is removed)
    - P13: FakeNet skips the address check
    - P14: agreedReceipt treats a missing source at or above the block as "not yet"
  - The 20 that target core properties:
    - P15: a log touching none of ours accepted
    - P16: lone ERC-20 tolerated
    - P17: status ≠ 1 credited
    - P18: an unknown getLogs error read as "no logs"
    - P19: RPC_DISAGREEMENT not sticky
    - P20: chainId dropped from the dedupe key
    - P21: agreed head = highest
    - P22: stall boundary `>=` → `>`
    - P23: the receipt need not carry the log
    - P24: a log present only on the second source ignored
    - P25: the ERC-20 emitter made canonical
    - P26: confirmTx ignores confirmations
    - P27: a foreign receipt accepted
    - P28: two different logs at one key accepted
    - P29: SIGNAL_CONFLICT ignored
    - P30: one source allowed without the flag
    - P31: a same-height hash change accepted
    - P32: an out-of-range log accepted
    - P33: the ERC-20 value check dropped from pairing
    - P34: confirmTx skips a malformed system log

### Numbers and units (recomputed by hand, confirmed by running the code)
- **U1 round trip, `toNetworkAmount(m, p) = m × 10^(18−p)`** (via `cbsMinorToNativeWei`). Every case equals my hand value (probe V7). **PASS**

  | m | p | Expected (= result) |
  |---|---|---|
  | 0 | 2 | 0 |
  | 1 | 2 | 10¹⁶ |
  | 12,345 | 2 | 1.2345 × 10²⁰ |
  | 1 | 6 | 10¹² |
  | 999,999,999 | 0 | 999,999,999 × 10¹⁸ |
  | 7 | 15 | 7,000 |
  | 1 | 18 | 1 |

- **Two-log ERC-20 fixture (MC-15), probe V1.** On JournalIndexerStore, 1,500,000 units × 10¹² = 1,500,000,000,000,000,000 wei. The result is **one** transfer of exactly that amount at log index 0 (the canonical log), and `pending()` holds 1 item. **PASS**
- **Poll-receipt backoff, reconstructed** (250 ms initial, 8 s cap, 8 attempts, so 7 sleeps, minimum jitter from ManualTiming): 125, 250, 500, 1000, 2000, 4000, 4000. That equals the test's `timing.slept`, and the range is [d/2, d] for each d = min(8000, 250 × 2ⁱ). **PASS**
- **Paging (C-40).** `pageRange(1, 25000, 9999)` → `1-9999`, `10000-19998`, `19999-25000`. Every page has `to − from ≤ 9,998`. **PASS**

### Arc / DFNS facts (re-checked against the archive; no live fetch)
- **C-42 and the new citation "rpc-endpoints.md lines 40, 119".** `arc_references_rpc-endpoints.md` l.39–40: "load-balanced across multiple backends that may be at slightly different block heights". l.119: "the backend that reported the current head may differ from the one serving this request". Matches. **PASS**
  - [inspection-only] The fix's comment (indexer.ts:36–38, 406–410) says that a missing receipt "is a load-balanced backend that has not imported the block". The archive documents only `-32014` for such a backend. That `eth_getTransactionReceipt` returns `null` for an unknown hash is generic JSON-RPC behaviour, not an Arc claim, and the control fails closed whichever way it is read. I do not count it as an invented fact.
- **C-40.** "`-32012` when the requested block range exceeds 10,000 blocks … ≤9,999-block chunks", l.105–108. **PASS**
- **C-20, C-21, C-22, C-24.** `arc_references_usdc-system-events.md` contains:
  - the emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (l.35, 64);
  - "A single ERC-20 `transfer()` emits **two** logs" (l.39);
  - topic0 `0xddf252ad…b3ef` (l.66, 98);
  - "Zero-value transfers emit no log." and "Self-transfers (`from == to`) emit no log." (l.78–79). These rules are stated for the **system** log only.

  **PASS**
- **C-12.** `arc_references_contract-addresses.md` l.48: `0x3600…0000` "Uses 6 decimals". **PASS**
- **DF:networks.** `dfns/networks_index.md`: "| Arc | ArcTestnet | 1 | N/A | 10 | | |", with the Confirmation Delay column defined in the header row. **PASS**
- **DF:transfer.** `dfns/api-reference_wallets_transfer-asset.md` has "minimum denomination" (l.9, 51), `Native` (l.101), `^\d+$` (l.107), `Standard` (l.124) and `externalId` minLength 1 / maxLength 50 (l.165–166). **PASS**
- **Cited identifiers.** The C-ids cited in NET are rows in constants.md:
  - C-01, C-12, C-15
  - C-20, C-21, C-22, C-24, C-25, C-27, C-28
  - C-40, C-41, C-42
  - C-50, C-53, C-54

  **I found no invented DFNS or Arc fact.** **PASS**

### Logic re-trace of this round's changes
- **Poll receipt (11:10 m1).** `pollReceipt` (indexer.ts:412–423) accepts a receipt only when **every** source returns the same one (`kind: 'ALL'`). That receipt has already passed the status and foreign-transaction checks in `readReceipt` (:459–466), and afterwards it must still match the log's block, have status 1 and carry the credited log (:391–397).
  - A source without it is retried with the `-32014` backoff. When still missing → SOURCE_LAGGING (not sticky): nothing is committed for that page, and no cursor moves.
  - Two different receipts in any attempt → RPC_DISAGREEMENT, sticky (P5 killed).
  - An unknown RPC error during a retry → SOURCE_STOPPED, sticky (probe V4).

  Fail-closed is preserved. **PASS**
- **confirmTx is unchanged in behaviour.** `agreedReceipt` (:431–439) still returns OK null only when no source has the receipt, or when every source without it reports a head below the receipt's block. Otherwise → RPC_DISAGREEMENT (probe V6, P14). **PASS**
- **INVALID_ADDRESS (11:10 m6).** `pollAddresses` (types.ts:226–234) lower-cases and dedupes each address, and returns INVALID_ADDRESS for the first value that is not a 20-byte hex address. It is shared by both adapters.
  - In the indexer it runs inside `run()`, so a stored halt is still reported first (probe V2).
  - It runs before any source read (the test counts 0 calls; P11 killed).
  - It is not sticky (P7 killed).
  - No consumer outside NET switches on `NetworkFailure`, so the wider union breaks nothing (grep).

  **PASS**
- **Head-regression tolerance (11:10 m5).** It is now required, with no default: the type makes it mandatory, and a runtime `typeof` check throws `ArcConfigError` (config.ts:240–242; P12 killed). **PASS**, but the question row was not added; see m4.
- **Unchanged since 11:10, re-confirmed by mutants and probes:**
  - §6.1 canonical-only credit: P15, P16, P25, P33
  - §6.2 faults: P18, P32 and V5 (an unknown getLogs error on the reference only → SOURCE_STOPPED, 0 pending)
  - §6.3 two sources: P19, P24, P28, P30, P31
  - §6.4 exactly once: P20, P29
  - §6.5: P17, P23, P26, P27
  - §6.6: P21, P22
  - precheck and reuse of U1/U2: unchanged code, 100 % mutation score on config.ts

  **PASS**
- **"Raise PAUSE".** NET returns typed FAILED results, documented as "FAILED always means: PAUSE outbound and page a human". Mapping FAILED onto the rail state belongs to the D1 orchestrator and composition root (S3), which do not exist yet. **[inspection-only]**, not charged to NET. It must be proven when S3 is generated.

### Rubric items applicable to NET
- MC-01 PASS (NET)
- MC-02 PASS
- MC-03 PASS
- MC-07 PASS
- MC-08 PASS (98.58 %)
- MC-15 PASS
- MC-16 PASS
- MC-21 PASS
- MC-33 PASS
- **MC-19: FAIL** (m3, routed): the test "same identity twice → refused" passes, but the approvers are not authenticated in NET.
- **MC-31: FAIL** (m1, routed)

## PROBES (plant/test/unit/zz-verify-net.test.ts; observed results)
- **V1.** `OK`, 1 transfer, amount `1500000000000000000`, log index 0, pending 1. **PASS**
- **V2.** A halted indexer (sources disagree), then a poll with `'0x12'` → `RPC_DISAGREEMENT`: the stored halt comes before INVALID_ADDRESS. **PASS**
- **V3.** One source's receipt is missing on every read, over 3 polls → `SOURCE_LAGGING` × 3, halt `null`, 21 sleeps (7 per poll). The rail stays failed for as long as the condition lasts. It never escalates to a sticky halt, but nothing is delivered. → Candidate C1, DISMISSED (below).
- **V4.** The receipt is missing, then a `-32000` error arrives during a retry → `SOURCE_STOPPED`, stored as the halt. **PASS**
- **V5.** An unknown error (`-32603`) on the reference's getLogs only → `FAILED SOURCE_STOPPED`, 0 pending. **PASS**
- **V6.** confirmTx where the reference lacks the receipt and its head is above the block → `RPC_DISAGREEMENT`. **PASS**
- **V7.** The U1 table above. **PASS**

## CANDIDATES considered and dismissed
- **C1 · A persistent missing receipt never escalates** (V3, indexer.ts:412–423). Design §6.2 says that exhausted lag is "treat that source as lagging, which feeds stall/disagreement logic". The result is FAILED, so outbound stays paused and a human is paged on every poll. It auto-clears only when every source returns the same validated receipt. No money path is weakened. **DISMISSED**
- **C2 · INVALID_ADDRESS pauses the rail for a caller bug.** That is fail-closed by design ("FAILED always means PAUSE"). **DISMISSED**

## DEFECTS
- **m1 · MC-31 / L-3 / ADR-002 rule 2 (carried, still not routed in any document): address-filtered reads go to every source, the reference included.** `src/indexer/indexer.ts:333–336` (filtered `getLogs` on `topic1`/`topic2 = our addresses` to each source) and `:450–451` (receipts for our hashes to each source) · **minor** (privacy; not on the blocking list).
  - ADR-002 l.37 says: "Address-filtered queries go **only** to own nodes. The reference gets unfiltered range queries and block hashes".
  - RUBRIC MC-31 (code) says: "Address-specific reads go only to own nodes", with an "Egress capture test". There is no such test, and the `RpcSource` port has no own/reference role.
  - Design §6.1 and §6.3 prescribe the opposite, so the conflict starts in the design.
  - **Route.** Design §6.3 against ADR-002 rule 2 needs a human decision, and neither LEDGER nor OPEN_QUESTIONS records one. A NET-side option is a reference role that is sent `topics: [topic0, null, null]` over the two emitters and filters locally; it costs C-41 bisection on busy ranges.
- **m2 · A lone ERC-20 `Transfer` log halts the whole rail, and the question was never raised (carried).** `src/indexer/indexer.ts:372–375`, `:499–500` · design §6.1, CLAUDE.md "Fail closed" · **minor** (fails closed; griefing only).
  - Any ERC-20 log without an equal canonical partner is a sticky UNKNOWN_EVENT for the whole stream.
  - The archive's "Zero-value transfers emit no log" (usdc-system-events.md l.78) covers the **system** log only. It says nothing on whether NativeFiatToken emits its own ERC-20 `Transfer` for `transfer(ourWallet, 0)`. If it does, any third party can halt outbound movement until two humans resume.
  - Arc's guidance (integrate_exchanges_deposits.md l.101–102, 171–173) is to filter only the system emitter.
  - OPEN_QUESTIONS has no row for this (grep for "zero-value" / NativeFiatToken finds only Q-A5).
  - **Route.** Add the question. Until it is answered, the design should say whether a lone zero-value ERC-20 log is a QUARANTINE case record rather than a rail halt.
- **m3 · MC-19: resume approvers are not authenticated (carried; blocked upstream).** `src/network/types.ts:194–211`, `src/indexer/indexer.ts:196–201` · **minor**.
  - `resume` takes two free-text strings. Distinctness is enforced and tested, and the approvers are recorded.
  - Authentication depends on CF-26 / CF-31, which are open. NET documents this, but MC-19's "authenticated" is not met inside NET.
- **m4 · The head-regression tolerance is an operator value with no OPEN_QUESTIONS row (partly fixed).** `src/network/arc/config.ts:36–43` · CLAUDE.md non-negotiable 5 · **minor**.
  - The silent default is gone (fixed).
  - The constant still says "Ours, not Arc's (Q-N6 family)", but Q-N6 (OPEN_QUESTIONS.md:126) lists the `-32014` backoff, `A_ambiguous`, `A_xcheck`, `A_blocklist`, `A_fresh`, `T_pending`, `A_stuck` and `A_approval`, and not this value. So no owner has been asked to choose it.
  - The sibling operator values each have a row: `stallAfterMs` → Q-A7, `startBlock` → Q-A6, `blocklistMaxAgeMs` → Q-N6.
  - **Fix.** Add "head-regression tolerance (proposed 5 blocks)" to Q-N6, or give it its own row with an owner.
- **m5 · Divergence from design §3 and §6.2 (carried, routed).** **minor**.
  - (a) §6.2 says "Implement and reuse the existing U3 stub `pageBlockRange`". `src/chain/client/index.ts:45–51` still throws "not implemented: U3", and NET has its own `pageRange` (`src/indexer/fetch.ts:30`), which makes two paging functions. The header routes this to U3, but nothing in LEDGER records the routing.
  - (b) §3 marks N2 (`arc/config.ts`) "money path: yes", and it is not on MONEY_PATH. The file header gives a reason (no amount arithmetic), and in this pass Stryker scored it 100 % and v8 coverage was 100 %, so there is no control gap. It is still an undocumented deviation from the frozen design.
  - The `src/net/**` → `src/network/**` + `src/indexer/**` rename is not counted: §3 is headed "proposed", and the boundary lint enforces the actual layout.

**Out of scope (not charged to NET).**
- MC-01 lint: 4 findings in `src/history/index.ts` (HIST).
- money-path.test: 3 failures. MONEY_PATH lists HIST and JPARTNER files that the Stryker `mutate` list lacks, and `src/journey/recipients/index.ts` imports `node:util`.
- [inspection-only] A second indexer instance checks the stored halt only at the start of each call (indexer.ts:214). Every page it commits is still two-source-agreed and passes compare-and-set.

### Status of the 11:10 findings (re-checked by reconstruction)
| Finding | Status | Evidence |
|---|---|---|
| m1, poll null receipt | **FIXED** | pollReceipt retries, then SOURCE_LAGGING (not sticky). Killed P1–P6, probes V3 and V4, and tests "missing … after every retry", "missing on the first read …" and "no receipt on any source" |
| m2, MC-31 | Carried | Now m1 |
| m3, lone ERC-20 | Carried | Now m2 |
| m4, MC-19 | Carried | Now m3 |
| m5, tolerance default | **Partly FIXED** | No default; P12 killed. The OPEN_QUESTIONS row is still missing → m4 |
| m6, malformed address | **FIXED** | `pollAddresses` in both adapters, before any read, not sticky. Killed P7–P11 and P13; probe V2; a contract test runs it on both implementations |
| m7, layout and paging | Carried, narrowed | Now m5 (the rename part is dropped) |

## VERDICT
NEGATIVE (5 defects: 0 blocking, 5 minor: m1–m5)

Zero blocking findings:
- no path loses, misposts or double-counts money;
- every inbound log is checked by emitter, topic, two-source agreement and receipt status, and deduplicated on (chainId, txHash, logIndex);
- unknown errors stop and are never "no logs";
- RPC disagreement and stall give FAILED (PAUSE);
- no invented fact, secret or real API call was found;
- MC-01 and Semgrep are clean on NET.

All five minors are routed or carried items. Four of them (m1, m2, m3, m5) need a human or another unit, not a NET code change. m4 needs one OPEN_QUESTIONS row.

phase · CO-1 v3 D1 / unit NET Lens R round 1 (re-run 3) · units frozen: n/a (verifier does not freeze) · streak 0/3 · rounds used: not tracked by verifier · regen budget: not tracked by verifier
