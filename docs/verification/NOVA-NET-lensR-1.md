VERIFICATION · lens: R · target: unit NET (src/network/**, src/indexer/**, test/unit/net-indexer.test.ts, test/unit/net-arc-adapter.test.ts, test/unit/net-boundary.test.ts, test/contract/net-adapter.contract.test.ts) · commit: 7fe69e270d5f886d92b92afd59645e5daa6de075 (branch co1-v3/nova-arc-d1). All NET files are untracked changes in the working tree on top of that commit. The sha256 of the NET sources and tests concatenated is 554c63768e984deb189f6979f3b0abc6bc417ba5a6289d06a5ff38450f39646f. I compared every NET file byte for byte against my scratch copy at the end of the pass, and none had changed.

**Pass details.** An independent verifier subagent ran this pass on 2026-10-07 at 11:07. It is Lens R round 1, run again on the unit as revised at 09:52–10:03. It replaces the 04:28 report, whose m1–m6 the author says are addressed (status table at the end).

**Inputs.**
- docs/NOVA_ARC_DESIGN.md §2, §3, §5, §6, §10.2–§12
- CLAUDE.md
- docs/RUBRIC.md
- docs/constants.md
- docs/MONEY_PATH.md
- docs/OPEN_QUESTIONS.md
- ADR-002 and THREAT_MODEL L-3
- the archived Arc and DFNS sources
- the code and the tests

I did not trust the author's comments.

**Guard rules (I applied them myself):**
- I made no call to any Arc, DFNS, Circle or VALR endpoint and read no .env file. I checked facts only against the archive.
- Scratch work went into `mktemp -d` → `/tmp/verify-NET-R1b-H7SkTh`. It holds a real-file copy of the repo, without `.git` and `.tools`. No symlink in it points outside the scratch dir: `find -lname '/*'` found none, and the two dangling `.bin` links are relative.
- Node came from `.tools/node/bin` (v22.23.3).
- Stryker ran in the scratch copy with `--tempDirName .stryker-tmp-verify-NET --reporters clear-text`. That temp dir is gone, and I deleted the whole scratch dir after the pass. I did not run the full ci.sh, and I wrote nothing to the repo except this report.

## CHECKS

### Mechanical (reconstructed)
- **tsc.** `npx tsc --noEmit` → exit 0. **PASS**
- **NET tests.** The 4 NET files run **157/157** and pass: net-indexer 82, net-arc-adapter 26 (plus the parameterised tests), net-boundary 4, and net-adapter.contract 18 × 2 implementations. **PASS**
- **MC-01 float lint.** `node tools/lint-money-floats.mjs` → "40 money-path files, 0 finding(s)". That includes the 8 NET money-path files. **PASS**
- **Semgrep MC-01 layer.** I ran `tools/semgrep/mc01-money-float.yml` with `--no-git-ignore` on all 12 NET source files: 13 rules, **0 findings**. **PASS**
- **Semgrep vendored JS/TS rules.** 203 rules on the 12 NET sources and the 4 NET test files → **0 findings**. **PASS**
- **`test/unit/money-float-lint.test.ts`.** It runs 69 tests, 67 pass and 2 fail. Every finding in the failing tests is in `src/gateway/wrapper.ts` (unit F2b). Not charged to NET.
- **`test/unit/money-path.test.ts`.** 1 test fails, "Stryker mutate (MC-08)". The cause is that MONEY_PATH.md now lists `src/journey/quote/{fiat,ports,compose}.ts` (unit JQUOTE, another agent's work in progress), and `stryker.config.json` `mutate` does not list them yet. All 8 NET paths are in both lists. Not charged to NET; routed to JQUOTE.
- **Mainnet gate.** `test/unit/mainnet-gate.test.ts` passes. In NET, mainnet appears only as `DFNS_ARC_NETWORKS.mainnet { name: 'Arc', enabled: false }` (config.ts:28). A grep for `5042` other than `5042002`, and for `'Arc'`, in NET finds only that line. Reconstructed (probe): every combination of chain 5042 or DFNS `Arc`, with and without `singleSourceTestnetOnly`, is refused at load. Without the flag it throws `MainnetGateError` (U2 gate); with the flag it throws `ArcConfigError` (§11 test e). Chain 1 is refused, and 5042002 with `ArcTestnet` loads. **PASS**
- **MC-07 coverage.** v8 coverage, NET tests only, in the scratch copy. All 8 money-path files score **100/100/100/100** (lines, branches, functions, statements): decode, fetch, indexer, rpc, store, types, arc/adapter and arc/params. **PASS**
- **MC-08 Stryker, NET files only.** It mutated `network/types`, `arc/adapter`, `arc/config`, `indexer/fetch`, `indexer/indexer` and `indexer/decode`. Vitest was narrowed to the 4 NET test files through a scratch config. Score **98.58 %**: 1,090 killed, 17 timeouts, 16 survived, 0 no-coverage, break threshold 90. **PASS**

  I adjudicated all 16 survivors by reasoning, and every one is equivalent:
  - `'utf8'` → `""` (Node's default encoding).
  - `end < to` → `<=` in `pageRange`.
  - `raw < cap` → `<=` in `backoffDelay`.
  - `r.kind === 'ERROR'` → `true`. EXHAUSTED has no `code`, so `includes(undefined)` is false.
  - `toLowerCase` → `toUpperCase` in `text()`. Both sides of every fingerprint comparison go through it.
  - `inChainOrder` `logIndex <` → `<=`. No two logs share a (block, index).
  - `inChainOrder` `...sorted` (it duplicates later items). The duplicates are dropped by both stores' in-batch dedupe, so poll output is identical.
  - `lowest` `<` → `<=`.
  - `first === second` → `false`. The same object has the same name.
  - `low`/`high` `<`/`>` → `<=`/`>=` in `readHeads`. A tie at one height with different hashes is already a disagreement.
  - `missing.every` → `some`. With two sources and a receipt found, at most one source is missing.
  - `d.kind === 'CANONICAL'` → `true` in `receiptCarries`. An ERC20 decode has no `value`.
  - `PRECOMPILE_RE` and `^\d+$` anchors. The input is already a 42-character lower-case address or a non-negative bigint.
- **Secrets and real calls.** gitleaks on a /tmp copy of every NET file → "no leaks found". A grep for `fetch(`, `http(s)://`, `process.env`, privateKey, mnemonic, secret, apiKey and token across the NET sources and tests → **no hits**. Test values are runtime sha256 labels. **PASS**
- **My own planted mutants.** 29 mutants in a second scratch copy (`plant/`), each followed by the NET tests → **29/29 killed**. **PASS**
  - Control: the known-equivalent `end <= to` survived, which shows that the harness can report a survivor.
  - The 9 that target this round's changes:
    - M1: the tolerance `>` → `>=`
    - M2: a same-height hash change accepted
    - M3: confirmTx without head-aware receipts
    - M4: `<` → `<=` in the missing-receipt head test
    - M5: liveness not persisted
    - M6: resume keeps liveness
    - M7, M8: confirmTx skips a malformed USDC `Transfer` log
    - M19: FakeNet does not back-scan a new address
    - M29: FakeNet ignores the cursor compare-and-set
  - The 20 that target core properties:
    - M9: SOURCE_LAGGING removed
    - M10: CURSOR_CONFLICT not sticky
    - M11: a log touching none of ours accepted
    - M12: unpaired ERC-20 tolerated
    - M13: status ≠ 1 credited
    - M14: an unknown getLogs error read as "no logs"
    - M15: SIGNAL_CONFLICT ignored
    - M16: confirmations ignored in poll
    - M17: the single-source plus mainnet throw removed
    - M18: recipient blocklist skipped
    - M20: the ERC-20 emitter made canonical
    - M21: chainId dropped from the dedupe key
    - M22: agreed head = highest
    - M23: lag clock refreshed without advance
    - M24: stall boundary `>=` → `>`
    - M25: one source allowed without the flag
    - M26: confirmTx ignores confirmations
    - M27: the out-of-range log check removed
    - M28: a reverted receipt with logs accepted

### Numbers and units (recomputed by hand, confirmed by running the code)
- **U1 round trip, `toNetworkAmount(m, p) = m × 10^(18−p)`** (via `cbsMinorToNativeWei`). Every case equals my hand value and round-trips with `dustWei` 0. FakeNet refuses amounts below 10¹² wei (§5.3), which the contract and FakeNet tests check. **PASS**

  | m | p | Expected (= result) |
  |---|---|---|
  | 0 | 2 | 0 |
  | 1 | 2 | 10¹⁶ |
  | 12,345 | 2 | 1.2345 × 10²⁰ |
  | 1 | 6 | 10¹² |
  | 999,999,999 | 0 | 999,999,999 × 10¹⁸ |
  | 7 | 15 | 7,000 |
  | 1 | 18 | 1 |

- **Two-log ERC-20 fixture (MC-15), probe V1.** On JournalIndexerStore, 1,500,000 units × 10¹² = 1,500,000,000,000,000,000 wei. The result is exactly one transfer at that amount, at log index 0 (the canonical log), and the store holds **1** inbox key. **PASS**
- **Paging (C-40).** `pageRange(1, 20000, 9999)` → `1-9999 10000-19998 19999-20000`, and `pageRange(5, 4, ·)` → []. `maxBlocksPerPage` = 9999 from U2. **PASS**
- **Backoff** (250 ms initial, 8 s cap, 8 attempts, so 7 sleeps). With maximum jitter: 250, 500, 1000, 2000, 4000, 8000, 8000. With minimum jitter: 125, 250, 500, 1000, 2000, 4000, 4000. That is the range [d/2, d]. **PASS**
- **Arc parameters as loaded.**
  - emitter `0xffff…fffe`; ERC-20 `0x3600…0000`
  - topic0 `0xddf252ad…b3ef`
  - codes −32012 / −32602 / −32014
  - fee floor 20,000,000,000 wei = 20 gwei (C-30); maximum base fee 20,000,000,000,000 wei = 20,000 gwei (C-31)
  - confirmations 0 by default (C-50, Q-N5)
  - tolerance 5 (see m5)

  **PASS**
- **Dedupe key and digest, probe V8.** Poll and confirmTx give the same key `arc:5042002:0x147e…8c46:0` and the same `payloadDigest` for one log, so a consumer dedupes them as one signal (§10.3). **PASS**

### Arc / DFNS facts (re-checked against the archive; no live fetch)
- **C-20, C-22, C-24, C-21.** `docs/sources/arc/arc_references_usdc-system-events.md` contains:
  - the emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (l.35, 64);
  - "A single ERC-20 `transfer()` emits **two** logs" (l.39–42);
  - "Zero-value transfers emit no log." and "Self-transfers (`from == to`) emit no log." (l.78–79);
  - topic0 `0xddf252ad…b3ef` (l.66, 98).

  **PASS**
- **C-40 and C-42.** `arc_references_rpc-endpoints.md` has "`-32012` when the requested block range exceeds 10,000 blocks … ≤9,999-block chunks" (l.105–108, 118) and the `-32014` retry (l.43–44, 119). The new citation in `params.ts`, "lines 40, 119", for load-balanced backends at different heights checks out: l.40 says "load-balanced across multiple backends that may be at slightly different block heights". **PASS**
- **C-41** (`-32602`, observed and undocumented, Q-A4). Present in constants.md:62. **PASS**
- **C-12.** "`0x3600000000000000000000000000000000000000` … Uses 6 decimals." → `arc_references_contract-addresses.md` l.48. **PASS**
- **DF:networks.** "| Arc | ArcTestnet | 1 | N/A | 10 | | |" → `dfns/networks_index.md` l.34, with the Confirmation Delay column defined on l.29. `DFNS_ARC_CONFIRMATION_DELAY_BLOCKS = 10n` matches. **PASS**
- **DF:transfer.** `dfns/api-reference_wallets_transfer-asset.md` has "minimum denomination" (l.9, 51), `Native` (l.101), `^\d+$` (l.107), `Slow`/… (l.123) and `externalId` minLength 1 / maxLength 50 (l.163–166). Native vs Erc20 is still open as Q-N1/Q-N2, and the body is used against fakes only. **PASS**
- **Cited identifiers.** Each of these is present in constants.md:
  - C-01, C-10, C-11, C-12, C-15
  - C-20, C-21, C-22, C-24, C-25, C-27, C-28
  - C-30, C-31
  - C-40, C-41, C-42
  - C-50, C-53, C-54

  Each of these is a row in OPEN_QUESTIONS.md: Q-A4, Q-A5, Q-A6, Q-A7, Q-A14, Q-N1, Q-N2, Q-N5, Q-N6 and Q-N9. **I found no invented DFNS or Arc fact.** One proposed operator value is uncited, see m5. **PASS**

### Logic re-trace (design §5, §6)
- **§5.1 interface.** Every member is present. The deviations are additive and documented in the types.ts header:
  - `NetworkRead`;
  - `gas` instead of `fee`;
  - `SOURCE_STOPPED`, `SOURCE_LAGGING` and `CURSOR_CONFLICT`;
  - `pending`, `ack` and `resume`.

  **[inspection-only] PASS**
- **§5.3 contract suite.** One suite runs against `ArcNetworkAdapter` (two in-memory chains) and the structurally different `FakeNetAdapter`. It now covers:
  - added-address back-scan;
  - a halt that survives a restart;
  - CURSOR_CONFLICT;
  - CHAIN_STALL after a restart;
  - everything the previous pass covered.

  M19 and M29 were killed. **PASS** (round-1 re-run m3 is fixed).
- **§6.1 canonical only (MC-15).**
  - Credit comes from system-emitter logs only (M20 killed).
  - An ERC-20 log must pair with an equal canonical log, otherwise UNKNOWN_EVENT (M12 killed).
  - A log touching none of ours is UNKNOWN_EVENT (M11 killed).

  **PASS** (see m3 for the effect of a lone ERC-20 log).
- **§6.2 fault injection (MC-16).** **PASS**
  - `-32012` halves and never widens.
  - `-32602` bisects to one block, then RANGE_UNRECOVERABLE (sticky).
  - `-32014` and transport errors back off, then SOURCE_LAGGING, which is not sticky. Probe V3: getReceipt `-32014` × 8 → SOURCE_LAGGING, no halt, cursor null, and the next poll delivers.
  - An unknown code → SOURCE_STOPPED, sticky, **never "no logs"**:
    - V5: on the reference only, nothing is delivered;
    - V4: on getReceipt it is sticky;
    - M14 was killed.
  - A log outside the range → SOURCE_STOPPED (M27).
- **§6.3 two sources.**
  - Log fingerprints (block hash included) and receipt fingerprints are compared.
  - A log on one source only is a mismatch.
  - Same-height heads with different hashes are a mismatch.

  Each mismatch gives sticky RPC_DISAGREEMENT, with the cursors frozen (pages committed before it stay committed). The single-source flag is accepted only with 5042002 / ArcTestnet (M17, M25). **PASS**. Gaps: m1, m2.
- **§6.4 exactly once.**
  - Each page commits its transfers and the moves of every covered cursor atomically, with compare-and-set (CURSOR_CONFLICT, sticky, M10).
  - A same key with a different digest gives SIGNAL_CONFLICT → RPC_DISAGREEMENT (M15).
  - The inbox stays unacknowledged until an all-or-nothing `ack`.
  - The page-2 failure test passes.
  - The two store fakes dedupe within a batch and across acknowledgements.

  **PASS**
- **§6.5 rules 3 and 4.**
  - A status-0 receipt that carries a Transfer → UNKNOWN_EVENT in poll (M13).
  - confirmTx returns a status-0 receipt with its gas and no transfers (F-3c). A reverted receipt that carries logs fails closed (M28).
  - The receipt must be the requested transaction's own and must carry the credited log.
  - Nothing is indexed or confirmed above `lowest head − confirmations` (M16, M22, M26).

  **PASS**
- **Round-1 m1, receipt race in confirmTx.** A receipt held only by a source whose head is below its block → OK null. When both hold it, it is confirmed (M3, M4). **PASS**. The poll-path residual is m1 below.
- **Round-1 m1, head regression.**
  - Probe V6: a fall of 5 blocks (the tolerance) → OK with the lower head; a fall of 6 → SOURCE_STOPPED (sticky).
  - The same-height hash change is still a stop (M1, M2).
  - Resume resets the stored liveness (M6), so a pre-halt high head cannot re-halt the indexer.

  **PASS**. The value itself is m5.
- **§6.6 liveness.**
  - No source advancing → CHAIN_STALL (M24 boundary).
  - One source frozen → SOURCE_LAGGING (M9, M23).
  - Liveness is stored per stream, so a restart does not reset the stall clock (M5). Round-1 re-run m4 part 2 is fixed.

  **PASS**
- **confirmTx malformed USDC log.** A USDC-emitter log with the Transfer topic that fails to decode now fails closed, as in poll (M7, M8). Round-1 re-run m4 part 1 is fixed. **PASS**
- **Precheck (§8.4 check 6).**
  - chain and network pin;
  - asset;
  - lower-case addresses;
  - amount > 0;
  - zero address;
  - self-transfer;
  - reserved addresses;
  - precompile range;
  - a blocklist copy that is too old or future-dated;
  - both parties (M18).

  **PASS**
- **Reuse.** U1 (`cbsMinorToNativeWei`, `usdcUnitsToNativeWei`, brands) and U2 (`ARC_TESTNET`, `ARC_MAINNET_DISABLED`, `resolveChain`, every Arc constant) are reused. There is no NET-local conversion, and no Arc constant is re-typed in NET. **PASS** (MC-03, MC-21)
- **Agnosticism lint.** `test/unit/net-boundary.test.ts` checks two things, and it catches a planted violation:
  - nothing outside `src/network/arc/**` or `src/indexer/**` imports them (the composition-root list is empty);
  - the port and FakeNet carry no Arc literal (including 5042002, 5042, 32012, 32014 and 32602).

  **PASS**
- **"Raise PAUSE".** NET returns typed FAILED results, documented as "FAILED always means: PAUSE outbound and page a human". The gateway refuses on `rail.paused` and on `!indexerHealthy || agreedHead === null` (src/gateway/index.ts:447–448). Mapping NET's FAILED onto that RailState belongs to the D1 orchestrator and composition root (S3), which do not exist yet. **[inspection-only]**, not charged to NET. It must be proven when S3 is generated.

### Rubric items applicable to NET
- MC-01 PASS
- MC-02 PASS
- MC-03 PASS
- MC-07 PASS
- MC-08 PASS (98.58 %)
- MC-11(vi) PASS, with over-triggering noted in m1 and m3
- MC-15 PASS
- MC-16 PASS
- MC-19: distinct approvers are enforced, but they are not authenticated in NET (m4)
- **MC-31: FAIL** (m2, routed)
- MC-21 PASS
- MC-33 PASS

Every other rubric item covers postings, the signer, the contract, CI or compliance, and does not apply to NET.

## PROBES (plant/test/unit/zz-verify-net.test.ts in /tmp/verify-NET-R1b-H7SkTh; observed results)
- **V1.** One credit at 1.5 × 10¹⁸ wei and one inbox key. **PASS**
- **V2.** `poll({'0x1234'})` → **OK [] and cursor 1** for that key, so a malformed address is accepted without complaint. → m6
- **V3, V4, V5.** Fault handling exactly as §6.2. **PASS**
- **V6.** Head regression of 5 → OK; of 6 → SOURCE_STOPPED. **PASS**
- **V7.** Both sources report head 1, and the reference's receipt read returns null for the transaction in block 1, which is what a load-balanced backend that has not imported the block returns. `poll` → **FAILED RPC_DISAGREEMENT, sticky = true**. → m1
- **V8.** Poll and confirmTx agree on the key and the digest. **PASS**
- **V9.** U1 table above. **PASS**

## DEFECTS
- **m1 · Poll still halts stickily when a load-balanced backend has not imported a block yet.** `src/indexer/indexer.ts:378–380` · JL-1, §6.5 rule 4, C-42 · **minor** (it fails closed).
  - `withReceipts` calls `this.agreedReceipt(log.txHash, null)` and then `if (r.value === null) return disagree(...)`. With `heads = null`, a source that returns null is a disagreement however the read was routed.
  - C-42 (rpc-endpoints.md l.40, 119) documents that the backend serving a request "may differ from the one" that reported the head. For `eth_getTransactionReceipt` such a backend answers null, not `-32014`.
  - Probe V7 shows the result: a sticky halt that only two humans can clear, triggered by a documented normal condition. The confirmTx half of round-1 m1 is fixed; this poll half remains.
  - **Fix.** In poll, retry a missing receipt with the same backoff as `-32014` before declaring disagreement, or treat it as SOURCE_LAGGING (not sticky).
- **m2 · MC-31 / L-3 / ADR-002 rule 2 (carried): address-filtered reads go to every source, the reference included.** `src/indexer/indexer.ts:325–336` (filtered `getLogs` on `topic1`/`topic2 = our addresses` to each source) and `:407–413` (receipts for our hashes to each source) · **minor** (privacy; not on the blocking list), routed.
  - ADR-002 l.37 says: "Address-filtered queries go **only** to own nodes. The reference gets unfiltered range queries and block hashes". Design §6.3 prescribes the opposite, so the conflict is upstream.
  - The port has no own/reference role, and there is no egress capture test.
  - **Route.** Design §6.3 against ADR-002 rule 2 needs a human decision. Nothing in LEDGER or OPEN_QUESTIONS records it yet.
- **m3 · A lone ERC-20 `Transfer` log halts the whole rail, and nobody has asked whether a third party can cause one.** `src/indexer/indexer.ts:364–366` (and `:460–461`) · design §6.1, CLAUDE.md "Fail closed" · **minor**.
  - Any ERC-20 log without an equal canonical partner is a sticky UNKNOWN_EVENT for the whole stream. Design §6.1 says only "a mismatch is `UNKNOWN_EVENT` → QUARANTINE". It says nothing about an ERC-20 log with no partner at all.
  - The archive says that zero-value and self-transfers emit **no system log** (usdc-system-events.md l.78–79). It is silent on whether NativeFiatToken's own ERC-20 `Transfer` is emitted for a zero-value `transfer()`. If it is, anyone can call `transfer(ourWallet, 0)` and halt outbound movement until two humans resume. The rail fails closed, so no money is at risk, but it is a griefing vector.
  - Arc's own guidance (integrate_exchanges_deposits.md l.101–102, 171–173) is to filter only the system emitter.
  - **Route.** Add an open question: "Does the NativeFiatToken emit an ERC-20 Transfer for a zero-value or self `transfer()` on Arc?". Until it is answered, decide in the design whether a lone **zero-value** ERC-20 log is a QUARANTINE case record rather than a rail halt.
- **m4 · MC-19: resume approvers are not authenticated (carried).** `src/network/types.ts:191–208`, `src/indexer/indexer.ts:189–194` · **minor**.
  - `resume` takes two free-text strings. Distinctness is enforced (tests), and the store records them. Authentication depends on CF-26 / CF-31, which are open.
  - It is documented, but MC-19's "authenticated" is not met inside NET.
- **m5 · A new proposed operator value with a silent default, missing from OPEN_QUESTIONS.** `src/network/arc/config.ts:41` · CLAUDE.md non-negotiable 5 · **minor**.
  - The line is `PROPOSED_HEAD_REGRESSION_TOLERANCE_BLOCKS = 5n`, applied when the input omits it (`:95`). The comment says "Ours, not Arc's (Q-N6 family)", but the Q-N6 row (OPEN_QUESTIONS.md:126) does not list it.
  - It is the only operator value in the loader with a default. `stallAfterMs`, `startBlock` and `blocklistMaxAgeMs` are required, with "no default" because they are human decisions.
  - The value matters for fail-closed behaviour: it is how far a source may go backwards before it is stopped.
  - **Fix.** Add the value to Q-N6, or to a new question, for an owner. Either require it as input, or document why a default is acceptable.
- **m6 · `poll` accepts a malformed address without complaint.** `src/indexer/indexer.ts:292` · port contract "FAILED never means no transfers" · **minor** (defence in depth).
  - Addresses are only lower-cased. `'0x1234'` builds a short topic, and against the fake it returns **OK []** and advances a cursor (probe V2).
  - A real node would most likely answer `-32602`, which ends in RANGE_UNRECOVERABLE (closed). The wallet registry also validates addresses (`src/nova-ports/wallet-registry.ts:77–78`).
  - So this is defence in depth only. `precheck` does validate with `toNetworkAddress`, and poll does not.
  - **Fix.** Refuse any address for which `toNetworkAddress(a) !== a`, with a typed failure.
- **m7 · Layout and paging still diverge from design §3 and §6.2 (carried, routed).** **minor**.
  - The code lives in `src/network/**` and `src/indexer/**`, not `src/net/arc/**`. The boundary lint enforces the new layout.
  - `pageRange` (`src/indexer/fetch.ts:30`) is a second paging function beside U3's stub `pageBlockRange` (`src/chain/client`). Design §6.2 says "Implement and reuse the existing U3 stub". The header routes this to U3.
  - `src/network/arc/config.ts` is off MONEY_PATH, although §3 marks N2 "money path: yes". The header gives a reason: no amount arithmetic. Stryker still scores it 100 %.

**Out of scope (not charged to NET).**
- money-path.test: the JQUOTE files are missing from the Stryker `mutate` list.
- money-float-lint.test: the findings are in `src/gateway/wrapper.ts` (F2b).
- [inspection-only] A second indexer instance on the same store checks the stored halt only at the start of each call (`run`, indexer.ts:207). It can therefore finish a poll that is already running after another instance has halted. Every page it commits is still two-source-agreed and passes compare-and-set.

### Status of the 04:28 findings (re-checked by reconstruction)
| Finding | Status | Evidence |
|---|---|---|
| m1 | **Partly FIXED** | confirmTx receipt race fixed (M3, M4, test "receipt race (m1)"). Head regression within tolerance accepted (V6, M1, M2), and liveness reset on resume (M6). Poll-path null receipt remains → new m1 |
| m2 | Carried | Now m2 |
| m3 | **FIXED** | FakeNet per-address cursors, compare-and-set, ledger survives restart. Contract suite covers added address, restart halt, CURSOR_CONFLICT and CHAIN_STALL after restart (M19, M29) |
| m4 | **FIXED** | Malformed USDC log in confirmTx (M7, M8); liveness stored per stream (M5, test "liveness is stored with the stream") |
| m5 | Carried | Now m4 |
| m6 | Carried | Now m7 |

## VERDICT
NEGATIVE (7 defects: 0 blocking, 7 minor: m1–m7)

Zero blocking findings:
- no path loses, misposts or double-counts money;
- every inbound log is checked by emitter, topic, two-source agreement and receipt status, and deduplicated on (chainId, txHash, logIndex);
- unknown errors stop and are never "no logs";
- no invented fact, secret or real API call was found;
- MC-01 and Semgrep are clean on NET.

phase · CO-1 v3 D1 / unit NET Lens R round 1 (re-run 2) · units frozen: n/a (verifier does not freeze) · streak 0/3 · rounds used: not tracked by verifier · regen budget: not tracked by verifier
