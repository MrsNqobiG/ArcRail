VERIFICATION · lens: R · target: P1-adrs (docs/adr/ADR-001 … ADR-007), round 15, after fix block 11 (Phase-1 close-out, round 1) · commit: none (uncommitted working tree; the repo has no commits)

Run window: 2026-10-05 13:19 UTC to 13:47 UTC (15:19 to 15:47 SAST). The guard hook was not loaded, so the verifier followed its rules by hand:
- the only network traffic was read-only HTTPS GETs of documentation pages, through `tools/source_drift.py` (33 URLs from MANIFEST: docs.arc.io, developers.circle.com, fic.gov.za, gov.za, resbank.co.za, inforegulator.org.za). I listed the URLs before running it. None is an RPC endpoint;
- no RPC call of any kind, so no mainnet endpoint and no signing or sending method;
- no .env file or key material read;
- no temp files. The drift tool wrote to `/dev/stdout`. The Directive 9 PDF text was extracted in memory (stdlib `zlib`) and nothing was written to disk. The only file written is this report.

Exit rule in force (operator, LEDGER 2026-10-05): a unit freezes when a pass finds **zero blocking** defects, and minor defects are carried to the G1 packet. Severity is strict:
- **blocking:** money can be lost, misposted or moved without the required control, or a fail-closed path is missing;
- **minor:** everything else.

## Versions (SHA-256 prefixes, pinned 13:19:45 UTC, re-read 13:46:13 UTC)

Target files, identical at start and end:

| File | R14 | R15 | Change |
|---|---|---|---|
| ADR-001 | ce0106ea60d271e7 | **ee09a22e8df23da3** | fix block 11 |
| ADR-002 | f56d8a71d580dbb6 | **fe254a6e95a10133** | fix block 11 (CF-20) |
| ADR-003 | 58b9836384c63ee1 | 58b9836384c63ee1 | none |
| ADR-004 | 43554bbf083caec3 | **176c0a38f2573d38** | fix block 11 (CF-24) |
| ADR-005 | 08cdf2fb0dc482fa | 08cdf2fb0dc482fa | none |
| ADR-006 | 9a91b242428b25cc | **8614d5fedac36bc2** | fix block 11 (CF-21) |
| ADR-007 | 05c75efbf80b87d2 | 05c75efbf80b87d2 | none |

Siblings:

| Document | Start | End | Effect on this run |
|---|---|---|---|
| THREAT_MODEL | 4971e7c4f25d13e1 | same | Now **v2 fix block 9** (ADR headers cite fix block 8). Its header :20 confirms ADR-001 fix 11 is ahead on the threshold, CF-36/37. T-T6 :113, T-I2 :128, T-B2 :161, DR-01 :194, DR-04 :197, DR-18 :211 and residual 13 :242 were re-read |
| ADR-008 | 164d52772d7cae7c | same | Now **fix block 7** (ADR-001 header cites fix block 6). Header, :84, :99 and :102 (operator channel) were re-read |
| OPEN_QUESTIONS | 01528f20fcce2460 | same | Q-D1 :85, Q-D3 :87, Q-D9 :93, Q-C17 :56 and Q-T6 :107 were used |
| CONTRACT | d48f622c28d3fbd7 | same | Changed since R14. The signature rows moved to :356, :358, :393, :419, :423, :442, :443 and their text was re-read |
| RISK_REGISTER | 48930790cea9523b | same | RR-3 :38–43, RB-6 :89, RB-7 :90 |
| RUBRIC | 62698867c785aaee | same | Fix block 12. MC-25 and the MC-45 clause "every preventive control that a G1 residual relies on … names its configuration source and human owner" were applied |
| constants | e494e7724fa544fb | same | unchanged |
| LEDGER | aaf57367956dd22a | **d8fe333007cb6864** | Changed during this run: rows shifted by one line. Re-read at the end: CF-20/21/24 closed, CF-36/37 open, P1-adrs row "R15 pending". Same text |
| GATES | 8a7cc18294be0201 | **6f8be479b1795f45** | Changed during this run. G-M 2, 5 and 8 were re-read at the end (:19, :22, :25): same text |
| STATUS.md | — | **6aff9f5d8fd485a5** (new) | Not cited by any ADR, so it has no effect |

## Criteria and exclusions

**Criteria:**
- RUBRIC MC-03, MC-11 (exits), MC-21 (shared method, run by me), MC-43, MC-44, MC-45 (including the fix-block-12 residual-bound clause) and the ADR rules;
- JL-1 to JL-6;
- CLAUDE.md N1, N2, N4 and N5.

**Routed, not counted as defects** (open CF items):
- CF-9(b);
- CF-15 (CONTRACT §5.6 :442 "for moves below the threshold");
- CF-30 (who reports a move refusal to the monitor);
- CF-33;
- CF-36 (T-T6 lacks the threshold);
- CF-37 (no detection joins an above-threshold move to an approval);
- CF-38.

Queued rubric proposals (for example R14 Probe G) are not applied as criteria.

## CHECKS

### R14 defects: re-derived
- **R14 D1 (Q-D1 lacks the loaded-version hash report) → FIXED.**
  - ADR-001:32 says the signer "**reports the hash of each loaded version to the owners**, so each owner can re-attest it daily (the signer's input to T-T6's [X] check)".
  - OPEN_QUESTIONS:85 parenthetical says "and **the hash of each loaded version is reported to its owners** for their daily re-attestation".
  - Clause by clause: load when signed and pinned = equal; refuse otherwise = equal; hash report = equal.
  - The ADR-001:32 sentence "With B, the custodian must do all three … (Q-D1, the clause after (g))" resolves: the parenthetical sits between (g) and (h).
- **R14 D2 (move-approval threshold had no own copy, no owner and no signed-config entry) → FIXED.**

  | Property | ADR-001 | Q-D1 |
  |---|---|---|
  | Own copy, never from the orchestrator or the request | :22 "and of the move-approval threshold (item 6) … never taken from the orchestrator or from the signing request"; :25 "The threshold is the signer's own copy (item 3), never a value the orchestrator or the request supplies" | (f) "taken from its own copy as in (g)"; (g) "and of the move-approval threshold of (f) … never taken from the orchestrator" |
  | Named owner | :22 "Treasury, with Risk" | (g) "Treasury with Risk" |
  | In the signed configuration | :29 "every cap and fee limit, and the move-approval threshold (items 3 and 6, Treasury with Risk)" | parenthetical "caps, fee limits and move-approval threshold" |
  | Routing | :5 CF-36 (T-T6) and CF-37 (DR-01/Rmove) | LEDGER :68/:69 state what :5 claims |

### MC-45: signer duty parameters (own copy, owner, signed config, Q-D1) → FAIL (D1)
Every value that a signer duty compares against, re-derived from ADR-001:10–32:

| Duty | Parameter | Source (not the orchestrator) | Owner | Signed config :27–30 | Q-D1 |
|---|---|---|---|---|---|
| 1 | checkers' FIDO2 credentials | "credentials the signer holds" | Security | yes | (a) + parenthetical |
| 2, 6 | Treasury's list | own copy | Treasury | yes | (b), (f) |
| 2 | collection-address derivation (cancel sender) | derived by the signer from its own key (ADR-006 branch fixed at the key ceremony) | key ceremony | n/a (key material) | (b) |
| 3 | per-tx and daily value caps, priority-fee and worst-case fee ceilings | own copy (:22) | Treasury with Risk | yes | (g) |
| 3 | chain-ID pin 5042002 | fixed value (code, MC-20/MC-23) | n/a | n/a | (g) |
| 4 | consumed-approval record | signer state, not configuration | n/a | n/a | (e) |
| 5 | monitor attestation public key | own trust store | Security | yes | (d) |
| **5** | **attestation freshness window `A_attest`** (ADR-001:24 "valid, fresh `ALL_CLEAR`"; ADR-008:99 "stale (`A_attest`, proposed 60 s) … → the signer refuses"), and the clock it is measured against | **not stated** | **none in ADR-001** (Q-C17 asks "Who sets and owns each?", Ops + Risk) | **no** | (d) asks for "fresh" only |
| 6 | per-move cap, daily move cap, approval threshold | own copy (:22, :25) | Treasury with Risk | yes | (f), (g) |

- **Re-trace.** ADR-008:84 bounds unmonitored signing after a fabricated payout at `A_cycle` + `A_attest`, about 120 s. The ADRs R10 report (`P1-adrs-lensR-10.md`:178) dismissed a relayed or delayed PAUSE because it is "bounded by `A_attest`". Both bounds hold only if the signer's `A_attest` and time reference are not under the orchestrator's influence. ADR-001 says this for every cap and the threshold, but not for `A_attest`.
  - If the signer read `A_attest` from an unsigned or orchestrator-supplied setting, an inflated window would keep a stale `ALL_CLEAR` valid whenever the monitor's PAUSE can't arrive (monitor down, or the direct channel cut).
  - Under option B, Q-D1(d) doesn't ask the custodian where its freshness window comes from.
- **Bound.** A fresh PAUSE still overrides at once (duty 5), and ADR-008 :99 makes a stale attestation a refusal. The per-transaction and daily caps (owned, signed, own copy) still bound the loss, and no fail-closed path is missing: only its parameter is unsourced. → **minor**.

### MC-45: residual bounds name a source and owner outside the compromise domain (RUBRIC fix 12 clause) → PASS
- Residual 4 (THREAT_MODEL:230) and RB-7 (RISK_REGISTER:90) rely on the signer's per-transaction and daily limits: "from its own copy owned by Treasury with Risk (ADR-001)". ADR-001:22 matches, and that copy sits outside the adapter domain.
- CF-37's interim bound (Treasury's list plus move caps) is signer configuration, owned and signed (ADR-001:28–29).
- Residual 8 (owner plus adapter) is the accepted combined-compromise case.

### Fee, cap and threshold re-trace at the boundary (ADR-001:17–25) → PASS [inspection-only for the boundary predicates]
- Most a signature can debit:
  - payout or return: ≤ C_tx + F_max;
  - move: ≤ per-move cap + F_max;
  - cancel: ≤ F_max (value 0);
  - per day: ≤ C_day, with every signature's worst-case fee counted.
- Threshold T: T−k → no checker; T → no checker ("at or below"); T+k → checker ("strictly above"). This matches Q-D1 (f) "strictly above" and RUBRIC MC-25(d) "one at the threshold → signed without one".
- Move cap C: C → allowed; C+k → refused ("must be split").
- Fee ceiling F_max: F_max → allowed; F_max + 1 wei → refused (MC-25(b)).

### MC-45: signer rules against every CONTRACT row that requests a signature, per `walletRole` → PASS
- CONTRACT rows (renumbered since R14, re-read):
  - §5.4 APPROVED sign (:356) / signer refuses → PAUSE (:358);
  - cancel or replacement refused → PAUSE `SIGNER_REFUSED` (:393);
  - §5.5 RET sign (:419) / refuse → PAUSE (:423);
  - §5.6 PROPOSED sign (:442) / refuse → ABANDONED with a case (:443).
- `walletRole` ∈ {hot, gas, collection} (CONTRACT :48):
  - hot: payouts and returns, `to` bound to the approval;
  - hot ↔ gas: moves, `to` on Treasury's list (SEQUENCES S3 "for example hot to gas");
  - collection: sweeps to a Treasury wallet, and cancels whose sender is a self-derived collection address.
  - No CONTRACT row moves value **to** a collection address, so duty 6 refusing such a `to` breaks no row.
- A load-time refusal (unsigned or unpinned configuration) reaches the same refusal rows. → JL-1 PASS.

### MC-45: backward trace from owner cells in THREAT_MODEL and RISK_REGISTER → FAIL (D3); restatement precision → FAIL (D4)
Every THREAT_MODEL and RISK_REGISTER cell that names ADR-001 to ADR-007 was extracted by script (34 hits) and re-traced:
- **T-T1 :108** "against credentials it holds itself (ADR-001, U9)" = duty 1. PASS.
- **T-E2 :146 / T-E3 :147 / T-E5 :149** = duties 1 to 3 and the HSM or custodian choice. PASS.
- **T-I2 :128** "The xpub covers only a dedicated, hardened account-level branch … Child private keys never leave the HSM or custodian (ADR-001)" = ADR-006:14 plus ADR-001 Q-D3/Q-D1(h).
  - BIP-32 re-derivation: with the xpub of a node N and any non-hardened child private key, an attacker gets k_N = k_child − I_L mod n.
  - Climbing above N needs the parent's chain code, and stops at a hardened step (I_L there depends on the parent private key).
  - With N inside m/44'/60'/a'/… and a' ≠ 0' (hot and gas wallets are at m/44'/60'/0'/0/x, C-56), the exposure is confined to the a' subtree.
  - So ADR-006's claim "exposes only that branch, never the hot or gas wallets" is correct. Note that it does expose **all** collection-address keys in that branch, which is residual 10.
  - PASS.
- **DR-04 :197** "derivable from the key-ceremony xpub at its recorded index … Q-D3 for an HSM, Q-D1(h) for a custodian" = ADR-006:14. PASS.
- **DR-01 :194 cancel class** "a collection address in the reference set S (ADR-001 duty 2)" = ADR-001:14. PASS.
- **T-B2 :161 / DR-18 :211 / residual 13 :242 / RB-6 :89 (hosted CASPs)**: ADR-004:34–36 gives an owner (Compliance's travel-rule operations), a cadence (every transfer to a hosted CASP) and an action (mismatch → PAUSE request on the operator channel). ADR-008:102 lets Compliance use that channel. If no option provides an acknowledgement, the bank accepts residual 13 at G1. PASS on what is stated. **Missing-echo handling: D2.**
- **T-B2 :161 (unhosted wallets)**: "For unhosted-wallet destinations: the travel-rule system's own audit log ([X], **contingent on ADR-004**)". ADR-004 has no audit-log assessment: no options row, nothing in the recommendation, and :38 says only "for them residual 13 always applies". → **D3**.
- **RR-3 3a :41** "Needs CF-5(f), CF-5(h) and CF-5(i)", matching DR-01 :194 "Needs CF-5(f), CF-5(h) and CF-5(i)". ADR-001:37 says DR-01 "**can't run until the CBS read operations in CF-5(f) exist**". That is incomplete: a reader at G1 would take CF-5(f) alone as sufficient. → **D4**.
- **RB-7 :90** limits "from its own copy owned by Treasury with Risk (ADR-001)". PASS.
- **L-1 :179, L-3 :181, T-D5 :138, T-I1 :127 (ADR-002 rule 5), B8 :59**: unchanged and consistent. PASS.

### MC-45: Q-D mirror and restatements → PASS
- Every Q-D row's ADR column is mirrored:
  - D1 → 001;
  - D2 → 001;
  - D3 → 001, 006 (ADR-006:14 names Q-D3);
  - D4 → 003;
  - D5 → 004;
  - D6 → 005;
  - D7 → 001, 003;
  - D9 → 004 (ADR-004:49, new).
- Q-D9 (ADR-004:49) equals OPEN_QUESTIONS:93 word for word, and also defers.
- The Q-D3 restatement (ADR-001:86) equals OPEN_QUESTIONS:87 on the dedicated-branch clause, and also defers.
- The Q-D1 summary (ADR-001:73–83) defers explicitly. Note: summary (h) drops "only" ("an xpub for **only** the dedicated, hardened … branch", OPEN_QUESTIONS:85). This passes because of the explicit deferral; it is recorded here, not as a defect.
- Q-D4, Q-D5, Q-D6 and Q-D7: unchanged since R14. Equal.

### MC-44: IDs resolved by script → PASS
- 73 distinct IDs were extracted from ADR-001…007 (C-, CF-, DR-, RD-, T-, L-, RR-, RB-, MC-, Q-, G-M n) and matched against definition rows or headings in their home documents: **0 unresolved**. MC-17 and MC-24 resolve after allowing for the "(both)/(code)" suffix.
- New citations:
  - CF-36 and CF-37 (LEDGER :68/:69) state what ADR-001:5 claims;
  - CF-20, CF-21 and CF-24 are closed and name the ADR fix block as the closer;
  - Q-D9 and Q-T6 exist;
  - G-M 2, 5 and 8 are at GATES :19, :22 and :25.
- "Ahead" claims, re-checked against the current siblings:
  - ADR-001:5 ("ahead of THREAT_MODEL on one point: the move-approval threshold"): THREAT_MODEL fix 9 :20 says the same. True.
  - ADR-004:5 and ADR-006:5 ("matches THREAT_MODEL v2 fix block 8"): the relevant rows are unchanged in fix 9. True.
  - The fix-block labels are historical, and no rule requires the latest sibling block.

### MC-21: shared method, run by me → PASS
- `tools/source_drift.py` SHA-256 is 5504b5e7076f186c49874d5738d3ca8fd77e9cf66bd6bf607d5586ffd38980e1, equal to the version reviewed in R12–R14. Its I/O lines were re-read: `urllib.request.urlopen` GET only, and it writes only to `--out`.
- It ran 13:26:09–13:26:31 UTC. Every archive integrity check was "match", including `arc_tools_node-providers.REFETCH-2026-10-05.md` and `circle/llms.REFETCH-2026-10-05.txt`. Result: "integrity failures 0; drifted URLs 0; fetch errors 0; URLs checked 33"; exit 0.
- Every Arc quote in the ADRs was checked by script against **the archive the tool compared** for its URL (whitespace, markup and `|` normalised), and all were found:
  - custody.md;
  - node-requirements.md (13 quotes, including the IPC sentence and the relay sentence);
  - rpc-endpoints.md (QuickNode testnet);
  - compliance-vendors.md;
  - transaction-memos.md (the EOA sentence, the Memo address);
  - deposits.md;
  - withdrawals.md (viem, ethers);
  - llms.txt (Reth);
  - gas-and-fees.md (20 Gwei, 20,000 Gwei).
- **New in ADR-002 (CF-20)**, checked against the newest archive `node-providers.REFETCH-2026-10-05.md`, which the tool reported identical to live:
  - "Low-latency RPCs for Arc over a global edge network" found;
  - "Payable per request in USDC" found;
  - "x402" found ("x402 Nanopayments");
  - Goldsky absent from the 2026-10-02 archive, so "newly listed" is correct;
  - no Goldsky URL or network in the archive, so "give no Goldsky endpoint, don't say which networks" is correct. The page's generic sentence "Each provider offers HTTP and WebSocket endpoints" gives no endpoint;
  - the Alchemy claim, "an API-keyed mainnet endpoint and no testnet endpoint", was verified against rpc-endpoints.md :30 and the testnet table :48–55;
  - MANIFEST :47 maps the archive to the URL with a hash, so the citation is valid under the ADR R4 Probe F relaxation.
- The constants cited by the ADRs exist with the stated subjects: C-10, C-27, C-30, C-31, C-35, C-40, C-41, C-53, C-55, C-56, C-57, C-62 to C-68.

### MC-43: ADR-004 Directive 9 → PASS [inspection-only for ¶2.1.9]
- MANIFEST :50 (2026-10-05): the `.extracted.txt` files are gone. The PDF is authoritative. The drift tool found its hash matching and identical to live.
- I extracted text in memory from the hash-matched PDF (stdlib `zlib`, Tj/TJ strings) and found:
  - ¶9.1 "comes into operation on 30 April 2025";
  - ¶4.6 "unless there is a suspicion of money laundering or terrorist financing" and "must verify the information pertaining to the originator";
  - ¶4.8 "may not execute a crypto asset transfer if it cannot comply";
  - ¶7.2 "prior to, or simultaneously with";
  - ¶7.3 "Post facto transmission … is not permitted";
  - ¶4.5 "less than R5 000";
  - Gazette "No. 51556" and Notice "5543";
  - ¶4.7 counterparty due diligence;
  - ¶6.2 beneficiary verification;
  - ¶6.4 and ¶6.5.1 with the **"cross-border"** qualifier kept ("execute, suspend execution or return a cross-border crypto asset transfer").
- ¶2.1.9 ("any value above zero") sits in one of 12 streams that the stdlib extractor can't decode → **[inspection-only]**, as MANIFEST :50 prescribes.
- The ADR-004:44 claim "the directive text is now archived" is true per MANIFEST (PDF).

### MC-03 arithmetic (exact Python integers) → PASS
- ADR-006:15: 21,000 × 20·10⁹ = 420,000,000,000,000 wei. divmod(·, 10¹²) = (420, 0), so 0.000420 USDC = "0.00042 USDC".
- p = 6 (k = 10¹²):

  | Input | divmod |
  |---|---|
  | 0 | (0, 0) |
  | 1 | (0, 1) |
  | k−1 | (0, 999,999,999,999) |
  | k | (1, 0) |
  | 10¹⁸ | (1,000,000, 0) |
  | 1,000,000,500,000,000,000 | (1,000,000, 500,000,000,000) |
  | 123,456,789,012,345,678,901 | (123,456,789, 12,345,678,901) |
  | (2⁶³−1)·k + k−1 | (9,223,372,036,854,775,807, 999,999,999,999) |

- p = 2 (k = 10¹⁶):

  | Input | divmod |
  |---|---|
  | 10¹⁸ | (100, 0) |
  | 123,456,789,012,345,678,901 | (12,345, 6,789,012,345,678,901) |
  | 1 | (0, 1) |

### Structure and safety scans (script) → PASS
- "Status: PROPOSED. A human decides at G1." appears exactly once in each of the 7 files.
- Every ADR has a per-phase recommendation:
  - ADR-001 to ADR-006 each have a 3-row phase table;
  - ADR-007:29 is "the same in all phases", with a reason.
- Prose and phase tables agree:
  - ADR-001: B is conditioned on Q-D1 (a)–(g) in both :63 and :69;
  - ADR-002: QuickNode for testnet, re-assessed at G-M including Alchemy and Goldsky, in both :21–23 and :46–47;
  - ADR-004: the pilot is blocked until Q-R3, Q-R9 and Q-D5, in both :32 and :44.
- N1/N2:
  - the testnet ID 5042002 appears only in ADR-001 (3 hits);
  - the mainnet chain ID `5042` appears 0 times;
  - mainnet hostnames (`mainnet.arc.io`, the Alchemy v2 URL) appear 0 times;
  - 64-hex strings appear 0 times;
  - gitleaks is not on PATH → [inspection-only].

### Judgment lenses
- **JL-1:**
  - unsigned or unpinned configuration → refuse → CONTRACT PAUSE or ABANDONED: PASS;
  - ADR-005 B down or stale → REVIEW: PASS;
  - ADR-004 TR not COMPLETE → no signing: PASS;
  - **exception: ADR-004 has no action for a missing acknowledgement (D2).**
- **JL-2 / N4:**
  - caps, fee limits, threshold, list, credentials and key are owned;
  - the screening threshold is Compliance's (Q-D6), with default "none";
  - **exception: `A_attest` at the signer has no stated owner or source in ADR-001 (D1).**
- **JL-3, JL-5, JL-6:** unchanged since R12 → [inspection-only] PASS. ADR-002 keeps Goldsky's x402 pay-per-request outside the design, which is consistent with T-E5 refusing EIP-3009 signatures.
- **JL-4:** the hash report is now vendor-qualified (R14 D1 fixed) → PASS.
- **Counts vs LEDGER:** 12 unit rows (5 P0, 7 P1), 0 frozen. The P1-adrs row reads "fix block 11 used … R15 pending" → PASS.

### Regression spot check (byte-identical units farthest from the fix-11 edits): ADR-003, ADR-005, ADR-007 → PASS
- **ADR-003:** Q-D4 (:33) equals OPEN_QUESTIONS :88, including the audit-log clause, and defers. The Q-D7 mirror is equal. The single-writer text agrees with ADR-001:34.
- **ADR-005:** the compliance-vendors quote was found. C-27, C-53, C-55 and C-63 exist. Fail-closed rules :25–27 are present. Q-D6 is mirrored with OPEN_QUESTIONS :90.
- **ADR-007:** the viem, ethers and Reth quotes were found in the compared archives. C-10, C-57 and C-62 to C-67 exist. A single recommendation is given for all phases, with a reason.

## CANDIDATES (run for completeness)

**C-1 · `A_attest` and the signer's time reference are not in the signed configuration, not sourced and not vendor-qualified** → **REAL (D1)**
- Evidence:
  - ADR-001:24 "sign only while holding a valid, **fresh** `ALL_CLEAR` … Attestations that are **stale** … are ignored";
  - ADR-001:27–30 lists credentials, Treasury's list, caps, fee limits, threshold and the monitor key, but no age;
  - ADR-008:99 "A missing, stale (`A_attest`, proposed 60 s) … → the signer refuses";
  - OPEN_QUESTIONS:85 (d) "require the monitor's fresh `ALL_CLEAR`";
  - OPEN_QUESTIONS:56 Q-C17 "Who sets and owns each?".
- Criteria:
  - MC-45: "its trusted-artefact set is derived from **every input its duties name**", and the vendor question must cover the control;
  - JL-2.

**C-2 · ADR-004 doesn't say what happens when the counterparty acknowledgement is missing or late** → **REAL (D2)**
- Evidence:
  - ADR-004:35 "Compliance's travel-rule operations compare the echoed digest with the digest of the payload sent, for every transfer to a hosted CASP. A mismatch → a PAUSE request";
  - the only stated trigger is a *mismatch*. An absent echo leaves nothing to compare, so nothing fires.
- Criteria:
  - MC-45: "Every external dependency (screening, TR, CBS, nodes) has a stated fail-closed behaviour";
  - JL-1.

**C-3 · T-B2 relies on ADR-004 for an unhosted-wallet audit-log detection that ADR-004 doesn't contain** → **REAL (D3)**
- Evidence:
  - THREAT_MODEL:161 "For unhosted-wallet destinations: the travel-rule system's own audit log ([X], contingent on ADR-004)";
  - ADR-004:38 "Unhosted wallets have no receiving CASP to echo anything, so for them residual 13 always applies. No option has been assessed for this yet (Q-D9)";
  - the options table (:22–29) has no audit-log row.
- Criterion: MC-45, backward trace from an owner cell that names the ADR.

**C-4 · ADR-001 understates DR-01's CBS dependencies** → **REAL (D4)**
- Evidence:
  - ADR-001:37 "3a (compromised orchestrator): DR-01, which **can't run until the CBS read operations in CF-5(f) exist** (RB-7)";
  - THREAT_MODEL:194 "**Needs CF-5(f), CF-5(h) and CF-5(i)**";
  - RISK_REGISTER:41 "Needs CF-5(f), CF-5(h) and CF-5(i)".
- Criteria: MC-44 ("says what the citing text claims") and MC-45 (restatement).

**C-5 · The hash-report channel is unspecified, so the orchestrator could relay it** → DISMISSED.
- A forged report matters only if the signer has loaded a version that is **validly signed** but unexpected. That needs an owner-key compromise plus an adapter that relays the report: the combined compromise accepted as residual 8 (THREAT_MODEL:237).
- The signing log's "never through the orchestrator" pattern would be a good hardening step, recorded here for G1, but it isn't a criterion failure.

**C-6 · The single "signed by its bank owner" vs T-T6's "two-person change control"** → DISMISSED.
- ADR-001:27–30 annotate an owner per artefact, so each artefact is signed by its own owner.
- Two-person change control is the owner-side process of T-T6. The signer can't verify it, and it isn't a signer duty.

**C-7 · ADR-001's options table has no row for duty 4 (replay) or the signed configuration** → DISMISSED.
- The recommendation (:63) and the phase table (:69) condition B on **all** of Q-D1 (a)–(g), and Q-D1 includes the replay rule and the signed-configuration parenthetical. The options table is a comparison, not the qualification list.

**C-8 · Q-D3's first clause names the plain path `m/44'/60'/0'/0/x`, while collection addresses use `m/44'/60'/a'/0/x`** → DISMISSED.
- BIP-32 derivation support doesn't depend on the account index. Q-D3's second clause asks for the dedicated branch's xpub, which is the branch-specific capability. [inspection-only]

**C-9 · The ADR headers name THREAT_MODEL fix 8 and ADR-008 fix 6, but the siblings are now at fix 9 and fix 7** → DISMISSED.
- The siblings were edited in parallel. Every "matches" or "ahead" claim was re-checked against the current versions and still holds (MC-44 above).

**Probe G (would the rubric wave through a bad version?): YES, twice.**
1. MC-45's derivation clause gives examples "(keys, credential sets, lists, caps)". A timing parameter (`A_attest`) passed 14 rounds, and so did R14's threshold before it.
   - Proposed: extend the queued R14 Probe G list to "lists, caps, thresholds, **ages and freshness windows, the time source**, keys, credentials, pins".
2. MC-45's "every external dependency has a stated fail-closed behaviour" is applied per dependency, not per detection input. An [X] or [R] check whose input can be absent (a counterparty echo) passes.
   - Proposed: "every detection an ADR defines states its action when its input is missing, late or unverifiable".

**Probe F (would the rubric fail a good version?): mildly.** MC-43 and MC-21 read as "checked by script against the archive". With the extracted Directive 9 text lost (MANIFEST :50), a faithful ¶2.1.9 paraphrase can't be found by a stdlib extractor, so a literal reading fails a good ADR-004.
- Suggested: "where MANIFEST marks a source as extraction-limited, an [inspection-only] check against the hash-matched primary file satisfies MC-43".

## DEFECTS

**D1** · docs/adr/ADR-001-custody-signing.md:24, :26–30 (with OPEN_QUESTIONS:85 (d))
- **Problem:** duty 5's freshness window `A_attest`, and the time reference the signer measures it against, are the only duty parameters with no stated source, no owner in ADR-001 and no place in the signed configuration. Q-D1(d) doesn't ask a custodian where its window comes from.
- **Why it matters:** ADR-008's bound on unmonitored signing (about 120 s) and the ADRs R10 dismissal of a delayed PAUSE both assume the orchestrator can't influence that window.
- **Lens and criterion:** R / MC-45 (trusted-artefact set derived from every input a duty names; vendor-question coverage), JL-2.
- **Severity: minor.** The fail-closed path exists:
  - stale → refuse;
  - a fresh PAUSE overrides immediately, whatever the window is;
  - the signed, owned per-transaction and daily caps still bound any loss.
- **Fix:** state that the signer's `A_attest` (and its time source) is its own copy, never from the orchestrator or the request, owned per Q-C17, included in the signed configuration list and in the Q-D1 (d) clause and parenthetical. Route to THREAT_MODEL T-T6 as a CF item if adopted.

**D2** · docs/adr/ADR-004-travel-rule.md:34–36
- **Problem:** when the chosen option provides a counterparty acknowledgement, only a *mismatch* triggers action. A missing, late or unverifiable echo for a transfer to a hosted CASP has no stated action, so the per-transfer check passes silently for exactly the transfers it can't see.
- **Lens and criterion:** R / MC-45 (every external dependency has a stated fail-closed behaviour), JL-1.
- **Severity: minor.** It is a post-transfer detective control: the preventive gate (no signing until `COMPLETE`, ¶4.8) is intact, and the exposure is the residual-13 case.
- **Fix:** add "no echo within a stated window (owner Compliance, Q-C17) → case to Compliance, and a PAUSE request if the window is exceeded for more than N transfers" (the human to set N), or state that a missing echo is treated as a mismatch.

**D3** · docs/adr/ADR-004-travel-rule.md:22–29, :38 against docs/THREAT_MODEL.md:161 (T-B2)
- **Problem:** T-B2's detection cell names ADR-004 as the place where the unhosted-wallet [X] check ("the travel-rule system's own audit log") is decided. ADR-004 never assesses an audit log, and says only that residual 13 applies to unhosted wallets.
- **Lens and criterion:** R / MC-45 (backward trace from an owner cell that names the ADR).
- **Severity: minor.** The detection is after the fact, for data integrity. Residual 13 already covers the gap.
- **Fix:** either assess each option for an audit log of what was transmitted, with an owner, cadence and action, or route a CF item to THREAT_MODEL to drop the contingent [X] from T-B2.

**D4** · docs/adr/ADR-001-custody-signing.md:37
- **Problem:** "DR-01, which can't run until the CBS read operations in CF-5(f) exist". DR-01 (THREAT_MODEL:194) and RR-3 3a (RISK_REGISTER:41) both need CF-5(f), CF-5(h) **and** CF-5(i), so the G1 reader is told about one dependency of three.
- **Lens and criterion:** R / MC-44 (the reference says what the citing text claims) and MC-45 (restatement).
- **Severity: minor.** Wording only. The residual (6 / RB-7) is correctly stated in its home documents.
- **Fix:** "… until the CBS read operations in CF-5(f), CF-5(h) and CF-5(i) exist (RB-7)".

## Status of R14 defects (confirmed by reconstruction)
- R14 D1 (Q-D1 lacks the hash report): **fixed**.
- R14 D2 (threshold not owned, not own-copy, not in signed config): **fixed**. The routed follow-ups CF-36 and CF-37 are open in LEDGER and acknowledged by THREAT_MODEL fix 9 :20 and ADR-008 fix 7 header.

## VERDICT

VERDICT: NEGATIVE (4 defects: **0 blocking**, 4 minor)

Phase 1 exit rule (operator, LEDGER 2026-10-05):
- this pass found **zero blocking defects**, so **P1-adrs meets the freeze condition**;
- D1 to D4 are minor and carry to the G1 packet.

Phase 1 · units frozen 0/12 before this pass (P1-adrs eligible to freeze on this result) · rounds: P1-adrs R15 (Phase-1 close-out round 1) · regen budget: per LEDGER (not changed by this pass)
