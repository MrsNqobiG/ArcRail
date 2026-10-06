# ADR-008 Independent monitor (reconciliation and detection outside the adapter)

**Status: PROPOSED. A human decides at G1.** Raised by the threat-model R5 verifier (D1, blocking). Not one of KICKOFF's seven ADRs; it was added because the threat model can't be made sound without it. **Fix blocks 1 to 7 applied** after `docs/verification/P1-adr-008-lensR.md` … `-lensR-7.md`; fix block 7 also takes the threat-model R12 cross-unit notes X1 (return netting) and X3 (no hold read) on this ADR. Checked against THREAT_MODEL **v2 fix block 8**, CONTRACT **v3 fix block I**, ADR-001 **fix block 11** and RISK_REGISTER **v3 fix block 6**, each as named in its own header. THREAT_MODEL fix block 8 carries DR-29 (T-T7), the monitor's ageing and the `RESUME` channel (B9), and RISK_REGISTER carries RB-13. This ADR **matches CONTRACT fix block I** on DR-29 (`listJournals` with `refs`; T11 bound to the cited `refs.assignRef`; the release check ignores the item's own cancel; amounts net of posted case returns), and **matches ADR-001 fix block 11** duties 3 and 6 on the caps and fee limits DR-01 re-checks. It is **ahead of THREAT_MODEL fix block 8** on exactly two detections, both routed as LEDGER **CF-25**: (1) **DR-29**: its settlement and release checks against the chain (CF-25(a)), its `refs`-based joins (CF-25(b)), and its scope over every journal whose amount starts on-chain (T2, T8, T11, `unid`), each amount compared net of that item's posted case returns (CF-25(c)); (2) **DR-01**: its fee conditions for moves and cancels, and the inputs they need, ADR-001 duty 3's daily cap and fee limits (CF-25(d)). ADR-001 fix block 11 also routes one **detection gap** to this ADR's move rule (by that unit, not by this ADR): no DR-01 check yet joins a move strictly above the move-approval threshold to an approval. This fix block doesn't take it, so on that point this ADR and THREAT_MODEL fix block 8 agree: neither has the join yet.

## Context
- The threats with the worst blind impact have **a compromised adapter** as the attacker:
  - T-S1: an invented instruction;
  - T-T2: a swapped account mapping;
  - T-E1: postings to arbitrary accounts;
  - T-E2: the signer made to sign arbitrary transactions.

  (THREAT_MODEL; RISK_REGISTER RR-3, RR-2 2e.)
- KICKOFF U12 ("Three-way reconciliation and circuit breaker … manual unpause requires two humans") places reconciliation inside the adapter. A detection that runs inside the component it watches can be blinded: the attacker narrows its scope or drops its PAUSE.
- CLAUDE.md requires that "any reconciliation drift … pauses outbound movement and pages a human". That only holds if the drifting component can't suppress the pause.

## Input model: reference vs subject under check
Reconciliation must compare the adapter's records with the outside world, so the monitor **does read adapter records**. It reads them **only as the subject under check, never as evidence**:

| Input | Role | Source |
|---|---|---|
| Chain data, **by category**: logs, receipts, balances, nonces, code, block headers (`extra_data`), `eth_call` results, and transactions (their inputs and their fee fields `gasLimit`, `maxFeePerGas`, `maxPriorityFeePerGas`) | **Reference** | The monitor's **own fetch** from own nodes (L-3) |
| CBS records: `getBalancesAsOf`, `listJournals`, `listPayoutInstructions`, `listApprovals`, `listIssuedAddresses`, **`listCaseDispositions`**, and the CBS's own **monitoring and screening records** for each subject | **Reference** | The CBS read API, with the monitor's own credentials (CF-5(f), CF-5(h), **CF-5(i)**, Q-C18) |
| Treasury's list of bank-owned wallets, its **move caps** (per-move, daily), and the signer limits DR-01 re-checks for every signature: ADR-001 duty 3's **daily cap** and its two **fee limits** (the `maxPriorityFeePerGas` ceiling and the `gasLimit × maxFeePerGas` ceiling) | **Reference** | Treasury (with Risk for the caps and fee limits), outside the adapter, signed and versioned: the same owner-signed values the signer loads (ADR-001 duties 3 and 6, "Signed configuration") (DR-24, DR-01; THREAT_MODEL T-T6) |
| Signing log `(payloadHash, nonce, txHash, instructionId)` | **Reference** | **Pushed by the signer** directly to the monitor |
| Official sanctions list entries (canary) and the screening service's API | **Reference** (list) and **subject** (screening path) | Compliance's list source; the screening service, called by the monitor with its own identity |
| Security artefacts: canary address↔account mappings, honeytoken registry rows, the **DB engine's audit log** | **Reference** | Owned by Security, outside the adapter (the DB audit log is written by the database engine, not the application). Egress capture (DR-20) runs in Security's egress proxy, not in the monitor |
| The **key-ceremony extended public key (xpub)** for bank-derived addresses | **Reference** | From the key ceremony, held by the monitor (DR-04) |
| External WORM anchor of the audit chain head; the checkers' **FIDO2 credential registry**; identity-provider assertions | **Reference** | Security / IdP (DR-05, DR-03, DR-08) |
| Registry reads for DR-04, DR-23, DR-24 and DR-26 | — | Made under the **monitor's own database identity**, never the adapter's, so DR-26's row-level audit can tell them apart. If the adapter-store access is the "API" option, that API must pass the monitor's identity through to the database audit log (CF-19(c)) |
| Adapter logs and telemetry, the adapter's local nonce, its screening and monitoring requests | **Subject under check** | Read-only from the log and telemetry pipeline and the adapter store |
| Adapter claims, **by category**: in-flight items (Rin, Rout, Rmove), accumulators (D, F), the index, registry rows and bank-owned flags, move records, the adapter's journal list and itemised G5/G4 items, its configured precision `p`, its configured fee floor (DR-16 part (2)), its outbox and audit hash chain (DR-05), and its PAUSE flag | **Subject under check** | Read-only replica or API of the adapter store |

**Rule:** every claimed item must be **reconstructed from reference inputs**; a claimed item without reference support → **PAUSE**.
- Rin and D: from the monitor's own system-emitter log fetch and the CBS journals.
- F: from receipts by `txHash`.
- Rout: each needs a final status-1 receipt **and** a signing-log entry **and** the CBS instruction **and** approval (or, for a case return, the CBS case disposition). **The match binds content, not just IDs** (verifier R3 D1):
  - **Payout:** the monitor recomputes `payloadDigest` (CONTRACT §1.3) from the **final transaction's own `to` and `value`** plus the `instructionId`, and it must equal the **CBS approval's** `payloadHash`. The CBS instruction's destination and amount must match too.
  - **Case return:** the transaction's `to` must equal the disposition's `returnDestination`, and its value must equal `returnAmount × k`.
  - A genuine payout re-signed to another address or for another amount therefore fails at the first reconciliation cycle after it is final.
- Rmove: each needs a final status-1 receipt, a signing-log entry and a `to` on Treasury's list. Its **realised debit** (value + `gasUsed × effectiveGasPrice`, from its own receipt) must be within the per-move cap, and the day's realised debits of all moves and their cancels within the daily move cap (ADR-001 duty 6). Its **fee fields**, read from the transaction fetched from own nodes, must be within the signer's fee limits: `maxPriorityFeePerGas` within the priority-fee ceiling, and `gasLimit × maxFeePerGas` within the worst-case-fee ceiling (ADR-001 duty 3). A legitimate move can't trip the cap check, because its realised debit is never above the worst case (value + `gasLimit × maxFeePerGas`) that the signer bounds. Every daily sum here and under cancels uses the signer's own day boundary for that cap; ADR-001 doesn't state one yet (CF-25(d)). Anything else → PAUSE.
- **Cancels (CF-18):** a zero-value transaction whose `to` equals its sender, and whose signing-log `instructionId` names a payout, case return or move with signed bytes, is classified as **a cancel of that item**, whether the sender is on Treasury's list or is a collection address in the reference set S (ADR-001 duty 2). It moves no value. Its fee fields must be within the fee limits, checked as for a move, and **its realised fee counts toward the daily cap of the item it cancels** (ADR-001 duties 3 and 6): the daily move cap for a move; for a payout or case return, ADR-001 duty 3's daily cap, against which the monitor sums the day's realised debits of every signing-log entry's final transaction. Above either → PAUSE. Any other zero-value self-send is unmatched → PAUSE.
- **The bank wallet set S** that the monitor scans and reconciles is built **from reference inputs only**: Treasury's bank-owned list ∪ the collection addresses in `listIssuedAddresses`. It is **never** taken from the adapter's registry.
- Registry rows are checked **both ways** against that reference set: a registry row with no reference entry is flagged, **and** a reference address missing from the registry is flagged. A deleted row therefore can't make deposits to that address invisible.

A compromised adapter that adds a fabricated in-flight payout to make a theft balance gains nothing: the item has no CBS instruction or approval behind it, so it is flagged. **CBS postings are bound too:** for holds, settlements, releases and fallbacks, the CBS takes the **account and amount** from its own records (instruction, hold) and refuses anything else with `BINDING_MISMATCH` → PAUSE. For T2 and T11 it binds the **account** to its issuance record, or to the unsuperseded `ASSIGN` disposition the journal cites (`refs.assignRef`) (CONTRACT §3, fixes F–I). **Amounts that start on-chain** (T2, T8, T11, `unid`) and T2's address can't be checked by the CBS; only the monitor's **DR-29** binds them, against its own log fetch. The expected amount is the item's `h` (CONTRACT §5.1): `m` from the monitor's own log, **less `R` for every T9 or T10 already posted for that item** (joined through the journal's `refs.caseId`), so a credit after a legitimate partial return matches and an over-credit doesn't. DR-29 also joins every settlement's `(instructionId, txHash)`, read from the journal's `refs` (`listJournals`), to a final status-1 transaction for that instruction whose content matches its approval, and checks that no released instruction was **paid** on-chain; the item's own zero-value cancel isn't a payment (CONTRACT fix I). **A hold placed on the wrong customer is stopped by the CBS binding alone** (`placeHold` takes the account from the CBS's own instruction; Q-C19). The monitor has **no hold read** (CONTRACT §3 offers none), so it can't see a hold that is never settled. It sees the wrong account only when money moves through a journal (a settlement or a T3/T4/T5 fallback), at the first reconciliation cycle after that journal is posted. A wrong hold that is released moves no money; it is left to the CBS binding and the customer ([X] in THREAT_MODEL T-E1). **Until the CBS confirms it can bind (Q-C19) and DR-29's inputs exist, this path is G1 residual RB-13** (RISK_REGISTER) (ADR-008 R5 C-1). A **genuine** item left in flight too long is flagged by the monitor's own ageing (attestation preconditions below). **Content binding applies to every signing-log entry**, whether or not it is still in Rout (THREAT_MODEL DR-01). KICKOFF U12's **three-way** reconciliation (chain ↔ adapter ↔ CBS) is kept, with the adapter as the checked party.

## Per-detection input map (RUBRIC MC-40(e))
Every detection THREAT_MODEL v2 fix block 8 assigns to the monitor (26 entries in its executor list, counting DR-16 part (2), DR-26 part (1) and DR-29; DR-20 and DR-26 part (2) run in Security's egress proxy, DR-16 part (1) in the adapter), with reference and subject inputs. The DR-01 and DR-29 rows are ahead of THREAT_MODEL fix block 8, as the header lists (CF-25(a) to (d)):

| Detection | Reference inputs | Subject under check |
|---|---|---|
| DR-01 | CBS instructions, approvals, **case dispositions**; Treasury's list and move caps; ADR-001 duty 3's **daily cap and fee limits**; signing log; **own receipts** (content binding, realised debits); **own-node transactions** (fee fields) | — (classification is the monitor's own) |
| DR-03 | Checkers' FIDO2 credential registry (Security); CBS approvals with stored assertions (`listApprovals`); signing log; **the transaction itself, fetched from own nodes by the log's `txHash`** (so the recomputed `payloadDigest` comes from what was actually signed, not from the signer's log) | — |
| DR-04 | **Key-ceremony xpub**; CBS `listIssuedAddresses` | Adapter's registry rows |
| DR-05 | External WORM anchor of the audit/outbox chain head | Adapter's outbox and audit chain |
| DR-08 | Identity provider assertions recorded by the monitor for unpause | — |
| DR-11 | Own-node `eth_call` from each wallet in S (value 0) | — |
| DR-16 part (2) | Own-node headers (`extra_data`) | Adapter's configured fee floor (part (1), send results, runs in the adapter, which is the only component that sends) |
| DR-06 | Own-node balances; CBS `getBalancesAsOf`; receipts; own log fetch | Adapter's claimed Rin, Rout, D, F |
| DR-07 | CBS `listJournals`, `getBalancesAsOf` | Adapter's journal list and itemised G5/G4 items |
| DR-10 | Own-node balances and own log fetch | Adapter's index |
| DR-12 | Own-node nonces; signing log | Adapter's local next nonce |
| DR-13 | Own log fetch; signing log; Treasury's list | Adapter's move records |
| DR-14 | Own-node `eth_getCode` | — |
| DR-15 | Own log fetch | — |
| DR-17 | Official list canary entry; the screening service, called directly by the monitor | — |
| DR-19 | Security's canary mappings | Adapter logs and telemetry |
| DR-21 | Own log fetch and tx inputs; `accountRef`s from the CBS issuance and instruction records, hashed by the monitor | — |
| DR-22 | Own log fetch; CBS monitoring and screening records | Adapter's screening and monitoring requests |
| DR-23 | CBS `listIssuedAddresses` | Adapter's registry rows |
| DR-24 | Treasury's list | Adapter's bank-owned flags |
| DR-25 | CBS approvals; own receipts; signing log | — |
| DR-26 part (1) | Security's honeytoken and canary lists; DB engine row-level audit log | — |
| DR-28 | CBS journals, screening records and case dispositions | — |
| DR-29 | CBS journals as `listJournals` returns them (`journalId`, `key`, `legs`, `refs`, `postedAt`), using `refs.instructionId` and `refs.txHash` (settlements), `refs.address` (T2), `refs.assignRef` (T11) and `refs.caseId` (T9/T10 netting); CBS payout instructions and approvals (`listPayoutInstructions`, `listApprovals`); CBS issuance record (`listIssuedAddresses`); `ASSIGN` and `RETURN` dispositions (`listCaseDispositions`); own log fetch and receipts; signing log. No hold read: an unsettled hold is the CBS's to bind | — |
| RD-01 | CBS responses read by the monitor itself | Adapter's configured `p` |
| RD-03 | Own-node balances per wallet set; CBS per-role balances | Adapter's per-role claimed items |

## Options

| | A. Monitor inside the adapter (KICKOFF as written) | B. **Independent monitor, signer-enforced attestation** | C. Independent monitor, alerts only | D. B **plus pre-sign co-attestation** |
|---|---|---|---|---|
| Trust domain | Same as the adapter | Separate VM and network segment, identity, credentials and admins | Separate | Separate |
| When a fabricated payout is stopped | Not reliably | **After** a fabricated transaction is final and the next reconciliation cycle sees it: within `A_cycle` (proposed 60 s) of finality, plus up to `A_attest` (proposed 60 s) for the last `ALL_CLEAR` to expire, so **at most about 120 s** of further signing for a fabricated payout. A **genuine** payout that the adapter leaves unposted is caught by the ageing rule below: about 16 min (`A_post` 15 min + `A_attest` 60 s) after its finality. The loss in that window is bounded by the signer's per-transaction and daily limits | Only if a human reacts | **Before** signing: for **each** payout the monitor checks the CBS instruction and approval and issues a **co-signature token that commits to `payloadDigest`, nonce and chain ID**. The signer refuses unless the token matches the exact transaction it is about to sign |
| How PAUSE is enforced | The adapter pauses itself | The signer refuses without a fresh `ALL_CLEAR` | Human | As B, plus a per-transaction co-signature |
| Cost | — | One service, an attestation check in the signer | One service | As B, plus a synchronous CBS read on the payout path (latency) and higher availability needs |
| Defeats a compromised adapter alone | No | **Detects and stops it** after the first fabricated transaction is final and reconciled (about 120 s), or, for a genuine payout left unposted, after `A_post` + `A_attest` (about 16 min). Limits bound the loss in both windows. Wrong-account postings: see DR-29 and RB-13 | Partly | **Prevents** a fabricated or altered payout, because the token binds the approved content; a genuine payout that is later left unposted is still caught by B's ageing |

## Attestation protocol (B and D)
- **Preconditions for `ALL_CLEAR`** (freshness is measured **at the moment the attestation is issued**):
  - the last full reconciliation cycle finished within `A_cycle` (proposed 60 s);
  - every reference input it used was fresh, no older than `A_fresh` (proposed 30 s) for chain data and CBS reads;
  - the residual was exactly 0, and every claimed item was reference-supported;
  - **no claimed item is older than its CONTRACT §5.8 age**, measured by the monitor **from the finality block in its own chain fetch**, not from any adapter timestamp. For example, an Rout item final for longer than `A_post` without its T4/T9/T10 in the CBS journals means PAUSE. Otherwise a compromised adapter could keep a genuine final payout "in flight" forever, never post the settlement, release the customer's hold, and stay at residual 0 (verifier R4 D1);
  - there is no open PAUSE condition, from the monitor itself or reported by the adapter.

  (`A_cycle`, `A_fresh` and `A_attest` are new ages, distinct from CONTRACT's `A_post`; Q-C17.)
- **Channel:** the monitor pushes attestations **directly to the signer** over its own mutually authenticated channel. The adapter never relays them.
- **Freshness and order:** each attestation carries a monotone sequence number and a timestamp. The signer keeps the highest sequence seen and **rejects any attestation with an equal or lower sequence** (no replay). A `PAUSE` **overrides** any unexpired `ALL_CLEAR`. A missing, stale (`A_attest`, proposed 60 s) or `PAUSE` attestation → the signer refuses.
- **Monitor input failure:** if any reference input is unavailable, the monitor issues no `ALL_CLEAR`, so signing stops (fail closed).
- **Paging:** the monitor has **its own paging path** to on-call, independent of the adapter.
- **Operator channel (owner PAUSE requests):** named artefact and control owners (Treasury, Security, Compliance, Engineering) can send a **PAUSE request** to the monitor over its own mutually authenticated operator channel, signed with that person's identity-provider identity (the same IdP trust as DR-08). **One valid request is enough:** the monitor issues `PAUSE` at once and records who asked and why. The channel can only stop signing: it carries no `ALL_CLEAR` and no unpause, which still needs two people. Requests arrive directly, never through the adapter (THREAT_MODEL T-T6, T-B1, T-SC2, T-I3, DR-26 part (2), residual 13).
- **Artefact checks on load (THREAT_MODEL T-T6):** the monitor accepts a reference artefact (Treasury's list, caps and fee limits, the honeytoken and canary lists, the xpub, the credential registry, the **identity-provider trust configuration** and the **WORM anchor's** verification key) only if it is **signed by its owner** and matches the **pinned version**. An unsigned or unexpected version means no `ALL_CLEAR` (fail closed). The monitor reports the hash of each artefact it has loaded, so each owner can re-attest it daily. The signer's equivalent duty is routed to ADR-001 (CF-23).
- **Single PAUSE authority:** when the adapter hits one of its own PAUSE conditions (CONTRACT §1.6), it **stops submitting signing requests itself, immediately**, and reports the condition to the monitor, which then issues `PAUSE`. If that report is lost, the monitor still reads the adapter's PAUSE flag (subject under check) every cycle and treats "flag set" or "flag unreadable" as PAUSE. The monitor is the single place that shows whether the rail is paused and why. Unpausing means two humans instructing the monitor; the monitor issues `ALL_CLEAR` only when its preconditions hold. (CONTRACT §1.6 and SEQUENCES F7 must say this: **CF-9**.)
- **Clearing the adapter's PAUSE flag:** after a two-person unpause at the monitor, the monitor sends a **signed `RESUME`** to the adapter over a declared monitor→adapter channel (its own mutually authenticated link). The adapter clears its flag **only** on a valid `RESUME` from the monitor **and** a recorded resolution of its own original condition. Until then the monitor keeps reading "flag set" and won't issue `ALL_CLEAR`. The on-call view shows both the monitor's state and the adapter's flag in one place.

## Privacy
The monitor holds a copy of the address↔account links, which is personal information (KICKOFF §6, THREAT_MODEL L-2). The same controls as the U5 registry apply: encrypted at rest, access-logged, honeytoken rows (DR-26), minimal retention, and inclusion in the POPIA PIA (L-8, Q-R12).

## Recommendation by phase

| Phase | Recommended |
|---|---|
| Testnet (Phases 2–5) | **B**, so the attestation path and its fail-closed behaviour are exercised in E2E. Monitor and adapter may share a host on testnet, but must use separate identities and credentials. CBS reads are stubbed |
| Mainnet pilot | **B**, with separate hosts, admins and change control. Consider **D** if Risk wants prevention rather than bounded detection. **Blocked until:** CF-5(f), CF-5(h) and CF-5(i) exist (Q-C18); and, under ADR-001 option B (custodian), Q-D1 (c) (signing log pushed to the monitor) and (d) (attestation required) are both answered yes |
| General availability | **B** (or D, if chosen for the pilot) |

## Consequences
- KICKOFF U12 moves out of the adapter into the monitor.
- The signer (U9) gains attestation verification and **pushes its signing log** `(payloadHash, nonce, txHash, instructionId)` to the monitor. ADR-001 already says this (duty list and "Signing log"); CONTRACT §5.0 must match (CF-9(b)).
- The CBS must offer the read operations in CF-5(f), CF-5(h) and CF-5(i), and `listJournals` with each journal's legs and `refs` (CONTRACT fix I; DR-29), all under Q-C18, and must bind accounts and amounts (Q-C19). It offers no hold read, and DR-29 doesn't need one.

## Questions this ADR raises
- **Q-D8:** Is a separate monitor service acceptable to Ops and Infra (JL-5)? Without it, a compromised adapter can suppress its own detection (options A and C).
- **Q-D1 (c) and (d)**: under a custodian, can the custodian push its signing log (with `instructionId`) to the monitor (c)? Can it require the monitor's attestation before signing **with the full protocol** (d): reject equal or lower sequence numbers, let PAUSE override an unexpired ALL_CLEAR, and receive attestations on a direct channel?
- `A_attest`, `A_cycle` and `A_fresh` go to Q-C17 with the other ages.
