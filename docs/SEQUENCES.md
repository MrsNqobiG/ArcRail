# Sequence diagrams (Phase 1, item 2)

**Status: DRAFT for G1. Version 2 (reframe, LEDGER ladder step 1), fix block 1.** v1 and its verifier reports (`docs/verification/P1-sequences-lensR.md`, `-lensR-2.md`) are superseded. Their line numbers don't apply to this version. Fix block 1 (applied before any v2 verifier report) makes every "CONTRACT silent" mark cite a LEDGER item or an open question: the ten gaps that had no item now cite **CF-26 to CF-35**, which this fix block adds to LEDGER. It also re-ran the Mermaid lint. Those items route the gaps to CONTRACT. No diagram draws the missing behaviour, so this document is **not ahead of** CONTRACT and **matches** the pinned siblings below.

**Pinned siblings** (fix-block identity from LEDGER; short SHA-256 taken when v2 was written, re-checked unchanged at fix block 1):

| Sibling | Version | SHA-256 |
|---|---|---|
| `docs/CONTRACT.md` | v3, fix block H | `d2f72422…a3e1d781` |
| `docs/THREAT_MODEL.md` | v2, fix block 8 | `6799bd75…bdb4c982` |
| `docs/adr/ADR-001-custody-signing.md` | fix block 10 | `ce0106ea…dedb124a` |
| `docs/adr/ADR-008-independent-monitor.md` | fix block 6 | `f81850e2…d0e565ea` |
| `docs/constants.md` | Phase 0, sources accessed 2026-10-02 | `e494e772…a58ebed3` |

**Framing rule.** These diagrams are a **view** of CONTRACT v3 fix block H, not a second specification.
- Every message or note that carries a money, compliance or failure decision is labelled with the CONTRACT section and state or row it implements, in square brackets, for example `[§5.4 SIGNED]`.
- A diagram never states behaviour that CONTRACT doesn't. The monitor and signer steps come from THREAT_MODEL B9/§D, ADR-001 and ADR-008, and are labelled with those sources.
- Where CONTRACT is silent, the diagram says **"CONTRACT silent"** and cites the open question (`Q-…`) or LEDGER item (`CF-…`), instead of inventing behaviour.
- Where a diagram omits §5 rows, the line under it lists them.
- Arc facts cite `docs/constants.md` (`C-…`, `M-…`).

## Conventions
- **Amounts.** Amounts are integers in CONTRACT notation: `k = 10^(18−p)`, `m = ⌊W/k⌋`, dust `W mod k`, on-chain payout value `A×k` wei, and `h` = the item's current `heldAmount` (§5.1). Fees are `gasUsed×effectiveGasPrice` wei (C-25).
- **No real data.** Wallets are named by role `r` (`hot`, `gas`, `collection`) and parties by symbol (`destination`, `accountRef`). No address, key or personal data appears.
- **`alt` blocks.** Steps after an `alt` continue from its **first** branch, unless they say they apply to every outcome. Every other branch ends where its text says.
- **Every keyed CBS call** can return AMBIGUOUS, and F1 then applies; F1 is not redrawn in each diagram. Results that aren't drawn follow §1.5: UNRESOLVED and CONFLICT → PAUSE, and a Fact-class REJECTED → PAUSE.
- **"PAUSE (P0)"** means the PAUSE path drawn in P0: the adapter stops at once, reports to the monitor, and the monitor sends `PAUSE` to the signer.
- **`PayoutOutcome`** is emitted on every arrival at RELEASED, SETTLED, HELD_FOR_CASE, QUARANTINED or PAUSED (§4, §5.4). It is drawn only where it helps.
- **CBS → adapter events** enter the adapter's inbox and are acked after commit (§4). The §1.7 in-flight gate applies to all of them (F5).
- **Reads (THREAT_MODEL L-3).** Address-specific reads go **only to own nodes**: balances, `eth_call`, nonces, address-filtered logs and receipts for our hashes. The reference RPC gets only unfiltered range queries, block hashes and already-signed transactions. With a single own node these reads are single-source, and DR-10 is the cross-check.
- **Syntax check.** Mermaid syntax was checked by a structural lint only: every `alt`, `opt` and `loop` closed by `end`, every `else` inside an `alt`, every arrow and `Note over` naming a declared participant, and no `;`, `#` or `%%` in message, note or block-label text (Mermaid ends text at those characters). Fix block 1 re-ran it and found nothing to change. No renderer ran (inspection-only).

## Participants

| Id | Who | Source |
|---|---|---|
| `CBS` | Core banking system: system of record, approvals, cases, holds | CONTRACT §3–§4 |
| `SCR` | Screening, reached through the CBS `screen` operation, with its `ScreeningOutcome` events | §3, §4 |
| `AD` | Arc Rail Adapter: orchestrator (U3–U8, U10, U11) and ACL. Single nonce writer | KICKOFF units, §1.3 |
| `SG` | Signer U9 | ADR-001 duties 1–6 |
| `MON` | Independent monitor | ADR-008, THREAT_MODEL B9 |
| `OWN` | Own Arc testnet nodes, chain ID 5042002 (C-01) | ADR-002, L-3 |
| `REF` | Reference RPC | ADR-002, L-3 |
| `TR` | Travel-rule provider | ADR-004 |
| `CHK` | Checker (human, FIDO2) | §3 `getApproval` |
| `CMP` | Compliance (human, decides case dispositions in the CBS) | §4 `CaseDisposition` |
| `OC` | On-call plus Ops lead: the two people for every PAUSE or QUARANTINE resolution and every unpause | §5.8 PAUSED owner, §1.6 |
| `OWNR` | Artefact or control owner (Treasury, Security, Compliance, Engineering) | ADR-008 operator channel |

---

## P0 Attestation, PAUSE and unpause (shared by S2, S3 and every F path)

```mermaid
sequenceDiagram
    autonumber
    participant AD as Adapter (orchestrator and ACL)
    participant SG as Signer U9
    participant MON as Independent monitor
    participant OWN as Own nodes
    participant CBS
    actor OC as On-call and Ops lead
    actor OWNR as Artefact owner
    loop every cycle, at most A_cycle (ADR-008)
        MON->>OWN: own fetch of logs, receipts, balances, nonces (reference input)
        MON->>CBS: CBS reads under the monitor's own credentials (reference input, CF-5(f)(h)(i))
        MON->>AD: read adapter claims and PAUSE flag (subject under check, read-only)
        alt every ALL_CLEAR precondition holds (ADR-008 attestation protocol)
            MON->>SG: ALL_CLEAR, sequence n, timestamp, signed, on the direct channel
        else a precondition fails, an input is missing, or the adapter flag is set or unreadable
            MON->>SG: PAUSE, sequence n, signed, on the direct channel
            MON->>OC: page on the monitor's own paging path
        end
    end
    SG->>SG: keep highest sequence, ignore stale or sequence ≤ highest, PAUSE overrides ALL_CLEAR, no valid ALL_CLEAR means refuse (ADR-001 duty 5)
    SG->>MON: push every signing-log entry (payloadHash, nonce, txHash, instructionId) directly (ADR-001 Signing log)
    Note over AD,SG: The adapter never relays attestations or signing-log entries (ADR-008 Channel, THREAT_MODEL B9)
    AD->>AD: own PAUSE condition met → set PAUSE flag, stop signing requests at once [§1.6 PAUSE]
    AD->>OC: page on-call [§1.6 PAUSE]
    AD->>CBS: createCase with the reason [§1.6 PAUSE]
    AD->>MON: report the condition (ADR-008 single PAUSE authority)
    MON->>SG: PAUSE
    OWNR->>MON: PAUSE request signed with the owner's IdP identity, one owner is enough (ADR-008 operator channel)
    MON->>SG: PAUSE
    OC->>MON: two-person unpause with a recorded resolution, two distinct IdP identities (DR-08) [§1.6, §5.8 PAUSED]
    MON->>AD: signed RESUME on the monitor-to-adapter link (ADR-008)
    AD->>AD: clear the flag only on a valid RESUME plus a recorded resolution of its own condition (ADR-008)
    MON->>SG: ALL_CLEAR only once every precondition holds again
```

- **Inbound during PAUSE.** Inbound detection continues, except under an RPC disagreement (F2) [§1.6]. Items keep their states and funds, and §5.8 ages keep running [§1.6].
- **QUARANTINE(item)** stops one item, pages on-call and opens a case [§1.6]. Its exits are a two-person resolution **recorded by the monitor**: `RESUME`, `CONFIRM_APPLIED`/`CONFIRM_ABSENT` (F1), `RELEASE` (T5, with proof) or `ESCALATE` (→ PAUSE). Past `A_quarantine` (4 h) it becomes a PAUSE [§1.6, §5.8].
- **CONTRACT silent:**
  - CONTRACT §1.6 doesn't yet name the monitor as the single PAUSE authority, or unpause through the monitor. That is **CF-9(a)**, so the monitor's role here rests on ADR-008.
  - Neither CONTRACT nor ADR-008 says how a QUARANTINE resolution recorded by the monitor reaches the adapter, or how the adapter authenticates it. ADR-008 defines `RESUME` only for the adapter's PAUSE flag. That is **CF-26**, so no delivery step is drawn here or in F1.

---

## S1 Inbound deposit → CBS credit

```mermaid
sequenceDiagram
    autonumber
    participant OWN as Own nodes
    participant REF as Reference RPC
    participant AD as Adapter (orchestrator and ACL)
    participant SCR as Screening (CBS screen)
    participant CBS
    participant MON as Independent monitor
    AD->>OWN: eth_getLogs, emitter C-20, topic C-21, at most 9,999 blocks (C-40), no bank-address filter
    AD->>REF: the same unfiltered range query, plus block hashes (L-3)
    AD->>AD: DR-02 compares block hash and log set per height. A difference → F2 [§1.6]
    AD->>AD: dedupe on (chainId, txHash, logIndex) of the system-emitter log only (C-22). to is bank-controlled → inbound [§5.0 rule 3]. Attribute to the log's from (C-27)
    AD->>AD: detection commit. D[r] gains W mod k, Rin gains m×k, heldAmount := m, DETECTED, outbox rows T1 (only if m greater than 0) and K.mon [§5.3 detection commit]
    AD->>CBS: submitMonitoringEvent, K.mon, direction in [§5.2 every class]
    alt m greater than 0
        AD->>CBS: postJournal T1, DR G2.r m · CR G5.inbound m, K.recv [§5.3 DETECTED]
        CBS-->>AD: OK journalId. Rin loses m×k → RECEIVED [§5.3 DETECTED T1 OK]
        AD->>SCR: screen sender address, K.scr, role sender, round r [§5.3 RECEIVED → SCREENING]
        SCR-->>AD: verdict and screeningRef
        alt CLEAR, to maps to an accountRef
            AD->>CBS: getAccountStanding, asOf no older than A_standing [§5.3 SCREENING CLEAR mapped]
            alt eligible
                AD->>CBS: postJournal T2, DR G5.inbound h · CR G1 h, K.avail, refs.address [§5.3 SCREENING CLEAR mapped]
                alt T2 OK
                    CBS-->>AD: OK. heldAmount := 0 → AVAILABLE (terminal) [§5.1, §5.3]
                else T2 REJECTED, Decision-then-fact class
                    AD->>CBS: createCase POSTING_REJECTED → HELD_IN_CLEARING, see F5 [§5.3 RECEIVED→T2]
                end
            else ineligible, or asOf older than A_standing
                AD->>CBS: createCase STANDING_INELIGIBLE → HELD_IN_CLEARING, see F5 [§5.3 SCREENING CLEAR mapped, §5.8]
            end
        else CLEAR, to is bank-owned, from is not 0x0
            AD->>CBS: postJournal T8, DR G5.inbound h · CR G7 h, K.avail → BANK_FUNDED (terminal). REJECTED → createCase POSTING_REJECTED → HELD_IN_CLEARING [§5.3 SCREENING CLEAR bank-owned, RECEIVED→T2]
        else CLEAR, to has no mapping
            AD->>CBS: postJournal unid, DR G5.inbound h · CR G4.unidentified h, K.unid, then createCase UNIDENTIFIED_INBOUND → SUSPENSE [§5.3 SCREENING CLEAR no mapping]
        else HIT or REVIEW, including every CCTP_MINT
            Note over AD,CBS: → F5 inbound, HELD_IN_CLEARING or AWAITING_SCREENING [§5.3 SCREENING HIT, REVIEW]
        end
    else m = 0, dust only
        AD->>SCR: screen sender address, K.scr, role sender, round r [§5.3 DETECTED m = 0]
        Note over AD,SCR: → DUST_ONLY (terminal). No posting. A HIT or REVIEW flags the D item and opens SCREENING_HIT or SCREENING_REVIEW (Q-C5) [§5.3]
    end
    MON->>OWN: own log fetch (reference input)
    MON->>CBS: listJournals with legs, listIssuedAddresses, screening records (reference inputs)
    Note over MON,CBS: DR-29 binds each T2 account, address and amount, DR-23 checks the mapping, DR-28 checks screening coverage. They need CF-5(f)(h)(i) and Q-C19, until then RB-13 and THREAT_MODEL residual 6
```

- **CCTP mint (§5.3, §5.2).** A mint has `from = 0x0` (CCTP domain 26, C-60). It is screened with `kind: CCTP_MINT`, which is always REVIEW, so it opens `MINT_UNATTRIBUTED` and enters AWAITING_SCREENING. Only a `ScreeningOutcome CLEAR` for the current round moves it on, by its `to`:
  - bank-owned → T8;
  - mapped to an account → `getAccountStanding`, then T2 or `STANDING_INELIGIBLE`;
  - unmapped → `unid` and SUSPENSE.

  A mint is never routed to T8 because of its sender.
- **CBS binding.** T2's account is bound by the CBS to its own issuance record for `refs.address` (§3, CF-16). The on-chain amount is bound only by the monitor (DR-29). Whether the CBS can bind is **Q-C19**.
- **Rows that don't apply.** Zero-value transfers and self-transfers emit no log (C-24), so they never reach DETECTED. A log that is neither from nor to a bank address is ignored [§5.0 rule 4]. If a query hits the `-32602` result cap, the range is shrunk (C-41, M-2, Q-A4).
- **Fact-class failures.** T1 or `unid` REJECTED → PAUSE [§1.5 Fact]. DETECTED older than `A_post` (15 min) → PAUSE. RECEIVED or SCREENING older than `A_decide` (15 min) → QUARANTINE [§5.8].
- **CONTRACT silent:** v3 has **no inbound travel-rule step**. That is **Q-R9** and **CF-4(a)**, so none is drawn.
- **Omitted §5.3 rows:** AWAITING_SCREENING, HELD_IN_CLEARING and the late-outcome row (drawn in F5); SUSPENSE and SUSPENSE_ASSIGNING (listed under F5).

---

## S2 Outbound payout

```mermaid
sequenceDiagram
    autonumber
    participant CBS
    participant AD as Adapter (orchestrator and ACL)
    participant SCR as Screening (CBS screen)
    participant TR as Travel-rule provider
    actor CHK as Checker
    participant SG as Signer U9
    participant MON as Independent monitor
    participant OWN as Own nodes
    participant REF as Reference RPC
    CBS->>AD: submitPayoutInstruction (instructionId, accountRef, A as CBS_MINOR, destination) [§4]
    AD-->>CBS: OK ACCEPTED. Or REJECTED INVALID, UNIT_MISMATCH, ZERO_AMOUNT, INVALID_DESTINATION or ADAPTER_PAUSED, with no effect [§4]
    AD->>CBS: placeHold (K.reserve, instructionId) [§5.4 ACCEPTED]
    CBS-->>AD: OK holdId, accountRef, amount A+fee, taken from the CBS's own instruction [§3 placeHold]
    alt echo equals the instruction
        AD->>AD: → RESERVED [§5.4 ACCEPTED]
    else accountRef or amount differs
        AD->>AD: PAUSE (P0), CF-16 → PAUSED [§5.4 ACCEPTED]
    else placeHold REJECTED
        AD->>CBS: PayoutOutcome RELEASED, nothing to release → RELEASED [§5.4 ACCEPTED]
    end
    AD->>AD: U7 policy and getAccountStanding. DENY or ineligible → releaseHold T5 condition 1 → RELEASED [§5.4 RESERVED]
    AD->>SCR: screen destination, K.scr, role destination, round r [§5.4 RESERVED → SCREENING]
    SCR-->>AD: CLEAR. HIT or REVIEW → F5 [§5.4 SCREENING]
    AD->>CBS: getTravelRuleOriginator (subjectRef) [§5.4 SCREENING CLEAR]
    CBS-->>AD: payloadRef and payloadHashTR, stored [§3]
    AD->>TR: submit payloadRef → TRAVEL_RULE [§5.4 SCREENING CLEAR]
    TR-->>AD: COMPLETE. Incomplete → F6 [§5.4 TRAVEL_RULE]
    AD->>OWN: eth_call simulation, value A×k to destination, own nodes only (L-3) [§5.4 TRAVEL_RULE COMPLETE → SIMULATING]
    OWN-->>AD: success. EVM revert → T5 condition 1. "Blocked address" → F3. Other error → retry up to H_retry, then PAUSE [§5.4 SIMULATING]
    AD->>CBS: requestApproval (K.appr, instructionId, payloadHash, summary) → AWAITING_APPROVAL [§5.4 SIMULATING success]
    CHK->>CBS: approve with FIDO2. WebAuthn challenge = the 32 raw bytes of payloadDigest [§1.3]
    CBS->>AD: ApprovalDecided, a trigger only, into the inbox [§4]
    AD->>CBS: getApproval (approvalId)
    CBS-->>AD: state, payloadHash, makerId, checkerId, checkerAssertion [§3]
    alt APPROVED, hash matches, maker ≠ checker
        AD->>CBS: getAccountStanding no older than A_standing, re-read and compare payloadHashTR → APPROVED [§5.4 AWAITING_APPROVAL]
    else REJECTED
        AD->>CBS: releaseHold T5 condition 1 → RELEASED [§5.4 AWAITING_APPROVAL]
    else hash mismatch or maker = checker
        AD->>AD: PAUSE (P0), APPROVAL_MISMATCH, T-T1 → PAUSED [§5.4 AWAITING_APPROVAL]
    end
    Note over AD,CBS: APPROVED but ineligible or payloadHashTR changed → T5 condition 1, createCase STANDING_INELIGIBLE or TR_HASH_CHANGED → RELEASED [§5.4 APPROVED]
    MON->>SG: fresh ALL_CLEAR on the direct channel (P0)
    AD->>AD: assign nonce n (single writer). maxFeePerGas ≥ 20 gwei (C-30). EIP-155 chain ID 5042002 (C-01, C-56) [§5.4 APPROVED]
    AD->>SG: sign request with the type-2 tx, instructionId and approval with checkerAssertion [§5.4 APPROVED eligible, TR hash unchanged]
    SG->>SG: duty 5 fresh ALL_CLEAR. Duty 1 recompute payloadDigest, verify checkerAssertion against own credential. Duty 2 type-2, empty data, to and value = approval. Duty 3 fee limits, caps on value + gasLimit×maxFeePerGas, chain ID pinned. Duty 4 replay rule. Signed configuration only (ADR-001)
    alt every duty passes
        SG->>MON: push signing-log entry (payloadHash, n, txHash, instructionId)
        SG-->>AD: signed bytes → SIGNED [§5.4 APPROVED]
    else the signer refuses
        SG-->>AD: refusal → PAUSE (P0), SIGNER_REFUSED [§5.4 APPROVED signer refuses, §5.2]
    end
    AD->>AD: persist the signed bytes before any send [§5.4 SIGNED]
    AD->>OWN: eth_sendRawTransaction [§5.4 SIGNED]
    AD->>REF: eth_sendRawTransaction, an already-signed tx (L-3) [§5.4 SIGNED]
    OWN-->>AD: at least one source accepts → BROADCAST. Other send results → F3, F4 and the SIGNED rows [§5.4 SIGNED]
    AD->>OWN: receipt for our hash, own nodes only (L-3)
    OWN-->>AD: final receipt, status 1 (C-50) [§5.4 BROADCAST]
    AD->>AD: Rout gains A×k. F[hot] gains gasUsed×effectiveGasPrice (C-25) [§5.4 BROADCAST status 1, §5.7]
    AD->>CBS: settleHold (K.settle, holdId, instructionId, txHash), T4: DR G1 (A+fee) · CR G2.hot A · CR G6 fee only if fee greater than 0 [§5.1 T4, §5.4 BROADCAST status 1]
    CBS-->>AD: OK journalId. CBS checked the hold, account and amount against its own records, else BINDING_MISMATCH → PAUSE. Rout loses A×k [§3 settleHold, §1.4]
    AD->>CBS: submitMonitoringEvent K.mon. PayoutOutcome SETTLED with txHash → SETTLED (terminal) [§5.4, §4]
    MON->>CBS: listJournals with legs, listApprovals, listPayoutInstructions (reference inputs)
    Note over MON,CBS: DR-01 recomputes payloadDigest from the final tx's to and value, DR-29 joins (instructionId, txHash) to a final status-1 receipt and its signing-log entry (CF-25), ageing from the monitor's own finality block (ADR-008)
```

- **Hold fallback.** If the CBS can't hold without expiry (P3.5), the T3, T4 and T5 fallback journals of §5.1 replace `placeHold`, `settleHold` and `releaseHold` one for one [§3 placeHold].
- **Ages [§5.8]:**
  - ACCEPTED: `A_reserve` 5 min → QUARANTINE.
  - RESERVED to SIMULATING: `A_checks` 30 min → T5 condition 1.
  - AWAITING_APPROVAL: `A_approval` 24 h → T5 condition 1 with `APPROVAL_EXPIRED`.
  - APPROVED: `A_sign` 5 min → re-run the standing check, and past 2×`A_sign` → QUARANTINE.
  - SIGNED: `A_broadcast` 1 min → PAUSE.
  - BROADCAST: `T_pending` → F4, and `A_stuck` 30 min → PAUSE.
  - Settlement not OK after a final status 1: `A_post` 15 min → PAUSE.
- **Fee.** The fee is part of the CBS's own instruction and is taken by `placeHold`. `fee` is 0 unless Q-C8 = yes (§5.1).
- **Open values.** `T_pending` and `H_retry` have no value yet (Q-C17).
- **Omitted §5.4 rows:**
  - AWAITING_SCREENING and HELD_FOR_CASE (F5, F6);
  - SIMULATING `"Blocked address"`, SIGNED `"Blocked address"`, CANCELLING, and BROADCAST status 0 (F3);
  - BROADCAST no receipt, cancel final, and the nonce-drift rows (F4);
  - SIGNED `transaction underpriced` (→ PAUSE, DR-16 part (1)), SIGNED `-32014`/transient (resend the same bytes up to `A_broadcast`), SIGNED other rejection (→ PAUSE), SIGNED mixed results (severity order), and PAUSED (P0).

---

## S3 Internal treasury move and gas top-up

```mermaid
sequenceDiagram
    autonumber
    participant AD as Adapter (U11 gas treasury and single nonce writer)
    participant SG as Signer U9
    participant MON as Independent monitor
    participant OWN as Own nodes
    participant REF as Reference RPC
    participant CBS
    AD->>OWN: eth_getBalance of the gas wallet, own nodes only (L-3)
    Note over AD,OWN: CONTRACT silent on when and how much to top up (CF-33, top-up approval Q-C16). §5.6 starts at PROPOSED, the trigger is U11 policy
    AD->>AD: PROPOSED, moveId, from r1 to r2 (for example hot to gas), value X wei with X mod k = 0 [§5.6 PROPOSED]
    alt policy ALLOW, or approved above the threshold
        MON->>SG: fresh ALL_CLEAR (P0)
        AD->>SG: sign the move, nonce from the single writer, to = the r2 wallet [§5.6 PROPOSED]
    else DENY, or older than A_move
        AD->>AD: → ABANDONED (terminal), never broadcast [§5.6 PROPOSED, §5.8]
    end
    SG->>SG: duty 6 to on own copy of Treasury's list, per-move cap and daily move cap. Duty 3 value + gasLimit×maxFeePerGas within caps, fee limits, chain ID pinned. Duty 5 ALL_CLEAR (ADR-001)
    alt signs
        SG->>MON: push signing-log entry (payloadHash, nonce, txHash, instructionId)
        SG-->>AD: signed bytes → SIGNED [§5.6 PROPOSED]
    else refuses
        AD->>CBS: createCase SIGNER_REFUSED, nothing signed → ABANDONED (terminal) [§5.6 PROPOSED signer refuses]
        Note over AD,MON: The refusal is also reported to the monitor [§5.6]. CONTRACT silent on who reports it and on which channel (CF-30)
    end
    AD->>OWN: eth_sendRawTransaction [§5.6 SIGNED]
    AD->>REF: eth_sendRawTransaction, an already-signed tx (L-3) [§5.6 SIGNED]
    OWN-->>AD: at least one source accepts → BROADCAST [§5.6 SIGNED]
    AD->>OWN: receipt for our hash, own nodes only
    OWN-->>AD: final receipt, status 1 [§5.6 BROADCAST]
    AD->>AD: Rmove gains X, per-role check only. F[r1] gains gasUsed×effectiveGasPrice [§5.6 BROADCAST status 1, §5.7]
    AD->>CBS: postJournal T6, DR G2.r2 X/k · CR G2.r1 X/k, K.move, Fact class [§5.1 T6, §5.6]
    CBS-->>AD: OK → POSTED (terminal). The Rmove item ends here, since §5.8 counts Rmove as final with T6 not yet OK [§5.6, §5.8]
    AD->>CBS: submitMonitoringEvent K.mon [§5.6, §5.2 internal move]
    MON->>OWN: own receipts and log fetch (reference inputs)
    Note over MON,OWN: Rmove needs a final status-1 receipt, a signing-log entry, a to on Treasury's list, value plus fee within the move caps and the fee within the signer limits (ADR-008). DR-13, DR-24
```

- **Approval above the threshold.** CONTRACT says only "approved above threshold" [§5.6]. ADR-001 duty 6 sets the boundary (at or below: no checker; strictly above: a checker assertion). **CONTRACT silent** on that boundary and on the approval route for a move, since `requestApproval` and `payloadDigest` are keyed by `instructionId` (§1.3). That is **CF-15**.
- **Per-role check.** The ±Rmove per-role check is diagnostic only in §5.7. Making it PAUSE is **CF-5(b)**.
- **T6 units.** §5.1 writes T6 as `X` with no unit tag, so **CONTRACT is silent** on the unit of the T6 journal. That is **CF-29**. This diagram reads the posting through U1 (§6) as `X/k` minor units, which is exact because `X mod k = 0` [§5.6].
- **Bank funding.** Funding from outside, for example a CCTP mint to a bank-owned wallet, follows S1 into T8 and G7. **CONTRACT silent** on CCTP outbound rebalancing, which has no flow. That is **CF-35**, so none is drawn.
- **Ages [§5.8]:** PROPOSED `A_move` 30 min → ABANDONED. SIGNED `A_broadcast` 1 min → PAUSE. BROADCAST `T_pending` → F4, and `A_stuck` 30 min → PAUSE. Final but T6 not OK: `A_post` 15 min → PAUSE.
- **Omitted §5.6 rows:** SIGNED `"Blocked address"` and CANCELLING (as in F3, but ending in FAILED with no T6); BROADCAST status 0 (→ gas to F, `BLOCKLIST_REVERT`, FAILED); BROADCAST no receipt, cancel final and drift (F4); SIGNED underpriced, transient and mixed (as in S2); PAUSED (`RESUME`, `POSTED` with T6 at `attempt + 1`, or `FAILED`).

---

## S4 Fees

```mermaid
sequenceDiagram
    autonumber
    participant OWN as Own nodes
    participant AD as Adapter (orchestrator and ACL)
    participant CBS
    participant MON as Independent monitor
    OWN-->>AD: final receipt of a tx paid by wallet role r, status 1 or 0 (C-25, C-53)
    AD->>AD: F[r] gains gasUsed×effectiveGasPrice, itemised by txHash. The gas batch and its batchSeq open at the first item [§5.7 Gas, §1.2]
    opt F[r] ≥ k
        AD->>AD: n = ⌊F[r]/k⌋, carry F[r] mod k [§5.7 Gas]
        AD->>CBS: postJournal gas batch, DR G3 n · CR G2.r n, K.gas, Fact class [§5.1 gas batch]
        CBS-->>AD: OK journalId [§5.1]
    end
    MON->>OWN: receipts by txHash (reference input)
    Note over MON,OWN: The monitor rebuilds F from receipts (ADR-008 Rule). DR-06 residual must be 0 wei [§5.7]
    opt customer fee leg G6, only if Q-C8 = yes
        Note over AD,CBS: No separate posting. The fee is inside the T3 hold A+fee from the CBS's own instruction, and T4 credits G6 fee only if fee greater than 0 [§5.1 T3, T4]
    end
```

- **Ages and checks.** `F[r] ≥ k` with no batch for `A_batch` (24 h) → PAUSE [§5.8]. A gas batch REJECTED → PAUSE [§1.5 Fact]. The bank funds gas through T8 into G7, checked by `G7 ≥ cumulative G3` [§5.7] (Q-C16).
- **CONTRACT silent:**
  - the gas rounding policy is **Q-C5**;
  - §5.7 doesn't say whether `F[r]` drops to `F[r] mod k` when the batch is committed locally or when it is OK. That is **CF-28**, so this diagram doesn't decide it.
- **Fee display.** U11 fee display (USDC plus ZAR, never 18 dp) is outside CONTRACT; the ZAR source is Q-C15.

---

## S5 Dust batch

```mermaid
sequenceDiagram
    autonumber
    participant AD as Adapter (orchestrator and ACL)
    participant CBS
    participant MON as Independent monitor
    AD->>AD: at each S1 detection commit, D[r] gains W mod k, r = the receiving wallet [§5.3, §5.7 Dust]
    opt D[r] ≥ k
        AD->>AD: n = ⌊D[r]/k⌋, carry D[r] mod k, list the covered items (chainId, txHash, logIndex, wei) [§5.7 Dust]
        AD->>CBS: postJournal dust batch, DR G2.r n · CR G4.dust n, K.dust (chainId, r, batchSeq), Fact class [§5.1 dust batch]
        CBS-->>AD: OK journalId [§5.1]
    end
    Note over AD,MON: The monitor rebuilds D from its own log fetch and the CBS journals (ADR-008 Rule)
```

- **Ages and failures.** `D[r] ≥ k` with no batch for `A_batch` (24 h) → PAUSE [§5.8]. A dust batch REJECTED → PAUSE [§1.5 Fact].
- **Flagged dust.** A DUST_ONLY item flagged by a HIT or REVIEW stays in D until its treatment is decided (Q-C5) [§1.7].
- **CONTRACT silent:**
  - Who owns dust is **Q-C5**.
  - Whether a flagged item may be included in a batch is also open under **Q-C5**.
  - A `D ≥ 0` check is **CF-5(d)**.
  - As for F, the step at which `D[r]` drops to `D[r] mod k` isn't stated. That is also **CF-28**.

---

## Failure and compensation paths

### F1 CBS timeout or AMBIGUOUS result (any keyed operation)

```mermaid
sequenceDiagram
    autonumber
    participant AD as Adapter (orchestrator and ACL)
    participant CBS
    actor OC as On-call and Ops lead
    participant MON as Independent monitor
    AD->>CBS: keyed operation, key K with attempt a, new callId
    CBS--xAD: timeout, transport error, 5xx or unclassified → AMBIGUOUS [§1.4]
    Note over AD,CBS: In-flight gate. Every event for this item stays in the inbox until the result is OK or REJECTED. RESUME doesn't make it final [§1.7]
    loop exponential backoff with jitter, at most H_retry (less than the Q-C3 retention)
        AD->>CBS: same operation, same K, same payload [§1.4 step 1]
    end
    alt a retry returns a non-ambiguous result
        CBS-->>AD: OK, REJECTED code or CONFLICT is the output [§1.4 step 1]
    else still AMBIGUOUS after H_retry
        AD->>CBS: getResultByKey K [§1.4 step 2]
        alt APPLIED
            CBS-->>AD: → OK [§1.4]
        else REJECTED code
            CBS-->>AD: → REJECTED code [§1.4]
        else NOT_FOUND
            AD->>CBS: one final call with the same K. Its result is the output, AMBIGUOUS again → UNRESOLVED [§1.4]
        else unavailable, or the operation isn't covered (Q-C2)
            AD->>AD: → UNRESOLVED [§1.4]
        end
    end
    Note over AD,CBS: UNRESOLVED or CONFLICT → PAUSE (P0) in every class. REJECTED → the class rule of §1.5. Notification class: re-queue, page Compliance ops, A_notify 1 h → PAUSE [§1.5, §5.8]
    opt the flow re-issues the same operation after a definite REJECTED (disposition RELEASE or ASSIGN, a resolution, a Notification re-queue) [§1.3 attempt rule]
        AD->>CBS: getResultByKey of the previous key (attempt a) [§1.3]
        alt REJECTED
            AD->>CBS: re-issue with attempt a+1 [§1.3]
        else APPLIED
            AD->>AD: don't re-issue. Record the applied result and continue as for OK [§1.3]
        else NOT_FOUND, including a key aged out of CBS retention (Q-C3)
            AD->>AD: don't re-issue. QUARANTINE the item, page, open a case [§1.3, §1.6]
            OC->>CBS: check the CBS's own record for that operation (per-operation evidence table) [§1.3]
            OC->>MON: two-person resolution with an evidence reference, recorded by the monitor [§1.3, §1.6]
            alt CONFIRM_APPLIED
                AD->>AD: record the effect as OK and continue [§1.3]
            else CONFIRM_ABSENT
                AD->>CBS: re-issue with attempt a+1, with no further getResultByKey [§1.3]
            end
        end
    end
```

- **Exits.** These are the only exits from the NOT_FOUND quarantine, so it can't loop [§1.3]. An unresolved QUARANTINE escalates to PAUSE after `A_quarantine` (4 h) [§5.8].
- **REJECTED by class [§1.5]:**
  - Decision: compensates (for example `placeHold` → RELEASED, `screen` → QUARANTINE).
  - Release: QUARANTINE.
  - Fact: PAUSE, and the item stays in its pending term and ages.
  - Decision-then-fact: held state with a case.
  - `BINDING_MISMATCH` → PAUSE in every class.
- **Values.** `H_retry` has no value yet (Q-C17).

### F2 RPC disagreement

```mermaid
sequenceDiagram
    autonumber
    participant OWN as Own nodes
    participant REF as Reference RPC
    participant AD as Adapter (orchestrator and ACL)
    participant SG as Signer U9
    participant MON as Independent monitor
    participant CBS
    actor OC as On-call and Ops lead
    AD->>OWN: block hash at height h, unfiltered log set for the range
    AD->>REF: the same, with no bank address (L-3)
    alt different block hash or log set at the same height (DR-02) [§1.6 RPC disagreement]
        AD->>AD: freeze the ingestion cursor at the last height where the sources agree. Nothing past it is detected or credited [§1.6]
        AD->>AD: PAUSE, set the flag, stop signing requests [§1.6]
        AD->>CBS: createCase RECON_DRIFT [§1.6]
        AD->>MON: report the condition (P0)
        MON->>SG: PAUSE on the direct channel (P0)
        MON->>OC: page
        OC->>MON: two-person resolution of the disagreement, recorded by the monitor [§1.6, CF-2]
        AD->>AD: the cursor unfreezes only after that recorded resolution, and ingestion continues from the frozen height [§1.6]
        OC->>MON: two-person unpause (P0) [§1.6]
        MON->>AD: signed RESUME (ADR-008)
        MON->>SG: ALL_CLEAR once its preconditions hold (ADR-008)
    else -32014 from one source (C-42)
        AD->>AD: back off and retry that source
    else -32012 range too large (C-40), or -32602 result cap (C-41, Q-A4)
        AD->>AD: shrink the range and retry (constants M-2)
    else one source has a lower head
        AD->>AD: not a §1.6 disagreement, which compares the same height. Stall → F7
    end
```

- **Scope of the compare.** Finality is deterministic with no reorgs (C-50), so a disagreement at a height both sources have is never normal. Block hashes and unfiltered log sets are compared between own nodes and the reference. Address-specific reads go to own nodes only, and with one own node they are single-source, cross-checked by DR-10 (L-3).
- **CONTRACT silent:**
  - §1.6 doesn't define what the two-person resolution records: which source was right, and whether the frozen height is kept or changed. That is **CF-27(a)**. This diagram shows only that a recorded resolution unfreezes the cursor (CF-2).
  - §1.6 also doesn't say whether that resolution and the rail unpause are one act. That is **CF-27(b)**. They are drawn as two steps.

### F3 Blocklist pre-check and blocklist revert (payout shown)

```mermaid
sequenceDiagram
    autonumber
    participant AD as Adapter (orchestrator and ACL)
    participant SG as Signer U9
    participant MON as Independent monitor
    participant OWN as Own nodes
    participant REF as Reference RPC
    participant CBS
    AD->>OWN: eth_call simulation, own nodes only (L-3) [§5.4 SIMULATING]
    alt success, the flow continues as S2 to SIGNED
        AD->>OWN: eth_sendRawTransaction [§5.4 SIGNED]
        AD->>REF: eth_sendRawTransaction [§5.4 SIGNED]
    else -32603 "Blocked address" (C-57, Q-A13)
        AD->>CBS: releaseHold T5 condition 1, K.release. createCase BLOCKLIST_PRECHECK. PayoutOutcome RELEASED → RELEASED [§5.4 SIMULATING]
    end
    alt every source rejects with -32603 "Blocked address" (C-57, Q-A13) [§5.4 SIGNED]
        AD->>CBS: createCase BLOCKLIST_PRECHECK. No release yet, the bytes may still exist [§5.4 SIGNED]
        AD->>SG: sign a same-nonce zero-value self-send cancel, to = the sending wallet [§5.4 SIGNED]
        SG->>SG: duty 2 cancel shape, duty 4 replay exception for the same instruction, duty 3 fee limits and daily cap, duty 5 ALL_CLEAR (ADR-001)
        alt signs
            SG->>MON: push signing-log entry carrying the item's instructionId (CF-18)
            SG-->>AD: cancel bytes, persisted before sending → CANCELLING [§5.4 send-time rule]
        else refuses
            AD->>CBS: createCase SIGNER_REFUSED, PAUSE (P0). Nothing released (CF-22) [§5.4 send-time rule]
        end
        AD->>OWN: send the cancel [§5.4 send-time rule]
        AD->>REF: send the cancel [§5.4 send-time rule]
        alt accepted
            AD->>OWN: receipts for both hashes, own nodes only (L-3)
        else every source rejects the cancel with "Blocked address"
            AD->>CBS: createCase CANCEL_BLOCKED, PAUSE (P0). The sending wallet is blocklisted [§5.4 send-time rule]
        end
        alt the cancel is final, status 1 or 0
            AD->>CBS: gas to F. releaseHold T5 condition 3. createCase CANCEL_FINAL → RELEASED [§5.4 CANCELLING]
        else the original is final with status 1
            AD->>CBS: Rout, then T4 as in S2, K.mon → SETTLED [§5.4 CANCELLING]
        else the original is final with status 0
            AD->>CBS: gas to F. releaseHold T5 condition 2. createCase BLOCKLIST_REVERT → RELEASED [§5.4 CANCELLING]
        else no receipt for either by A_stuck (30 min)
            AD->>AD: PAUSE (P0) [§5.4 CANCELLING, §5.8]
        end
    else at least one source accepts → BROADCAST
        AD->>OWN: receipt for our hash, own nodes only (L-3)
        alt final receipt, status 0, gas consumed (C-53)
            AD->>CBS: F[hot] gains the fee. releaseHold T5 condition 2. createCase BLOCKLIST_REVERT. PayoutOutcome RELEASED → RELEASED [§5.4 BROADCAST status 0]
        else nonce used, but no receipt for any of our hashes (Q-A1, constants M-1)
            AD->>AD: PAUSE (P0). Drift cell MC-05. Neither settle nor release [§5.4 BROADCAST, nonce-drift rule]
        else nonce not yet used, no receipt by T_pending
            AD->>AD: the tx may still land. → F4, no release [§5.4 BROADCAST]
        end
    end
    MON->>OWN: zero-value eth_call from each bank wallet (DR-11)
    Note over MON,OWN: "Blocked address" → QUARANTINE that wallet's flows, recorded by the monitor. Other errors past H_retry → PAUSE as a node fault (THREAT_MODEL DR-11, B9)
```

- **Mixed send results.** If no source accepts and the results differ, the most severe result applies, in this order: other rejection > `transaction underpriced` > `"Blocked address"` > transient [§5.4 SIGNED mixed].
- **Replacement.** A replacement rejected with `"Blocked address"` by every source takes this cancel path [§5.4 send-time rule].
- **Case returns and moves.** The same rows exist for case returns (RET_SIMULATING, RET_SIGNED, RET_CANCELLING, RET_BROADCAST) and moves (§5.6). There, every compensation is the **source held state with `RETURN_FAILED`** [§5.5] or **FAILED** [§5.6], never T5. Those rows are omitted here.
- **Receipt shape.** Whether a blocklist revert gives a `status: 0` receipt or no receipt is **Q-A1** (constants M-1). Both are drawn.
- **Release rule.** "Not seen" never releases [§5.4 T5 conditions].

### F4 Stuck nonce or dropped transaction

```mermaid
sequenceDiagram
    autonumber
    participant AD as Adapter (orchestrator and ACL)
    participant SG as Signer U9
    participant MON as Independent monitor
    participant OWN as Own nodes
    participant REF as Reference RPC
    participant CBS
    actor OC as On-call and Ops lead
    Note over AD,OWN: Item in BROADCAST (or RET_BROADCAST, or §5.6 BROADCAST) with no final receipt by T_pending (value Q-C17) [§5.4, §5.5, §5.6 BROADCAST]
    AD->>OWN: getTransactionCount latest and pending, receipts for every hash we signed for nonce n, own nodes only (L-3)
    alt nonce n not used
        alt rebroadcast
            AD->>OWN: resend the persisted bytes, same hash [§5.4 BROADCAST no receipt]
            AD->>REF: resend the persisted bytes [§5.4 BROADCAST no receipt]
        else same-nonce replacement with the same to, value and data
            AD->>SG: sign the replacement under the same approval. payloadDigest excludes nonce and fees [§1.3, §5.5 RET_BROADCAST]
            SG->>SG: duty 4 replay exception for the same instruction, duty 3 fee limits and daily cap, duty 5 ALL_CLEAR (ADR-001)
            alt signs
                SG->>MON: push signing-log entry
                AD->>OWN: persist, then send. Track every hash for nonce n [§5.4 send-time rule]
            else refuses
                AD->>CBS: createCase SIGNER_REFUSED, PAUSE (P0). Nothing released (CF-22) [§5.4 send-time rule]
            end
        end
        Note over AD,OWN: CONTRACT silent on choosing rebroadcast or replacement (§5.4 hands the choice to F4 with no rule, CF-34). The fee bump is Q-A10, the below-floor behaviour Q-A2
    else nonce n used by a hash we didn't sign (DR-12)
        AD->>AD: PAUSE (P0). Drift cell [§5.4 nonce-drift rule]
    else nonce n used, no receipt for any of our hashes (Q-A1)
        AD->>AD: PAUSE (P0). Drift cell. Neither settle nor release [§5.4 nonce-drift rule]
    end
    opt operator instructs a cancel (only then) [§5.4 BROADCAST no receipt]
        OC->>AD: cancel instruction
        AD->>SG: same-nonce zero-value self-send, to = the sender, as in F3 (ADR-001 duty 2)
        Note over AD,CBS: Our cancel final → gas to F and T5 condition 3 → RELEASED. A move → FAILED, no T6. A case return → RET_CANCELLING [§5.4, §5.5, §5.6]
    end
    alt one of our hashes is final with status 1
        AD->>CBS: settle as in S2 (T4), T9 or T10 for a case return, T6 for a move [§5.4, §5.5, §5.6 BROADCAST status 1]
    else final with status 0
        AD->>AD: → F3 [§5.4 BROADCAST status 0]
    else still no final receipt at A_stuck (30 min)
        AD->>AD: PAUSE (P0) [§5.8 BROADCAST]
    end
    MON->>OWN: own-node nonces and the signing log (reference inputs)
    Note over MON,OWN: DR-12 in the monitor. A nonce used by a hash absent from the signing log → PAUSE. The adapter's local nonce is only the subject under check
```

- **Release rule.** "Dropped", "not seen" and "timed out" never count as a T5 condition. Release needs exactly one of conditions 1–3 [§5.4] (constants M-6).
- **Nonce drift.** The drift rows apply in **every** state where signed bytes exist: SIGNED, BROADCAST, CANCELLING, their RET_ forms, and the §5.6 states [§5.4 nonce-drift rule].
- **Silent drops.** A send that is accepted and then silently dropped gives no error. It reaches this path at `T_pending` and PAUSEs at `A_stuck` (DR-16 part (1); constants C-30 and M-4; Q-A2).
- **CONTRACT silent:** how an operator's cancel instruction reaches the adapter, who may give it, and which identity check it carries. That is **CF-31**, so the `OC->>AD` step names no channel.

### F5 Screening hit

```mermaid
sequenceDiagram
    autonumber
    participant AD as Adapter (orchestrator and ACL)
    participant SCR as Screening (CBS screen)
    participant CBS
    actor CMP as Compliance
    alt inbound [§5.3]
        SCR-->>AD: HIT, or REVIEW (every CCTP_MINT is REVIEW)
        AD->>CBS: createCase SCREENING_HIT → HELD_IN_CLEARING. REVIEW → SCREENING_REVIEW or MINT_UNATTRIBUTED → AWAITING_SCREENING. Recorded as the current case [§5.3 SCREENING, §1.7]
        Note over AD,CBS: Funds stay in G5 as heldAmount, no T2. Age owner is Compliance (case SLA), no automatic move [§5.8]
        SCR->>AD: ScreeningOutcome for the current screeningRef. CLEAR → the S1 CLEAR rows. HIT → HELD_IN_CLEARING [§5.3 AWAITING_SCREENING]
        CMP->>CBS: decide a disposition
        CBS->>AD: CaseDisposition (caseId, dispositionSeq, disposition) into the inbox [§4]
        alt RELEASE, to maps to an accountRef
            AD->>SCR: r := r+1, screen again, with a fresh standing check before any T2 → SCREENING [§5.3 HELD_IN_CLEARING RELEASE]
        else RELEASE, to is bank-owned
            AD->>CBS: T8 → BANK_FUNDED [§5.3 HELD_IN_CLEARING RELEASE bank-owned]
        else RELEASE, to has no mapping (including an unattributed mint)
            AD->>SCR: r := r+1, screen again. CLEAR → unid, UNIDENTIFIED_INBOUND → SUSPENSE. HIT or REVIEW → stays [§5.3 HELD_IN_CLEARING RELEASE no mapping]
        else HOLD
            AD->>AD: none → HELD_IN_CLEARING. The current case stays open [§5.3, §1.7 current case]
        else RETURN with returnAmount ≤ heldAmount
            AD->>AD: start a case return from G5 with the cr- instructionId. R and destination come from the disposition → RETURNING [§5.3, §5.5, §1.2]
        else RETURN with returnAmount greater than heldAmount
            AD->>AD: QUARANTINE, invalid disposition [§5.3 HELD_IN_CLEARING]
        end
    else outbound [§5.4]
        SCR-->>AD: HIT, or REVIEW
        AD->>CBS: createCase SCREENING_HIT, PayoutOutcome HELD_FOR_CASE. The hold stays → HELD_FOR_CASE. REVIEW → SCREENING_REVIEW → AWAITING_SCREENING [§5.4 SCREENING]
        CMP->>CBS: decide a disposition
        CBS->>AD: CaseDisposition into the inbox [§4]
        alt RELEASE
            AD->>SCR: r := r+1, re-enter at SCREENING [§5.4 HELD_FOR_CASE RELEASE]
        else HOLD
            AD->>AD: none. The hold stays [§5.4 HELD_FOR_CASE HOLD]
        else CANCEL
            AD->>CBS: releaseHold T5 condition 1 → RELEASED, PayoutOutcome RELEASED [§5.4 HELD_FOR_CASE CANCEL]
        end
    end
    opt an event arrives while a keyed effect for the item is in flight, for example the T5 after CANCEL [§1.7 in-flight gate]
        CBS->>AD: CaseDisposition RELEASE, or ScreeningOutcome CLEAR
        AD->>AD: held in the inbox until the effect is OK or REJECTED, then applied against the state reached [§1.7]
        AD->>CBS: the item is now RELEASED (terminal). Recorded, createCase LATE_DISPOSITION, page Compliance ops [§1.7 terminal items]
    end
    opt stale events [§1.7]
        CBS->>AD: CaseDisposition whose caseId isn't the current case, or whose dispositionSeq isn't higher than the last applied
        AD->>CBS: recorded on its case, no state change, page Compliance ops [§1.7 stale dispositions]
        SCR->>AD: ScreeningOutcome whose screeningRef isn't the current round's
        AD->>CBS: recorded on the case, no state change [§1.7 stale screening outcomes]
    end
```

- **Current case.** A disposition doesn't close the current case. It stays current until the item leaves its held state family or a newer case replaces it. So after HOLD, `RETURNED_PARTIAL` or a `RETURN_FAILED` resolution, the same case still accepts dispositions [§1.7 current case]. DUST_ONLY dispositions are recorded on the case with no `LATE_DISPOSITION` [§1.7].
- **Never held.** QUARANTINE and PAUSE triggers are never held by the gate, and nor is `AccountStatusChanged` [§1.7 never held].
- **Who decides.** The adapter never chooses a disposition. Freeze versus return or cancel after a TFS hit is **Q-R8**.
- **Omitted rows:**
  - §5.3 SUSPENSE (`ASSIGN` → SUSPENSE_ASSIGNING, `RETURN` from G4, `HOLD`);
  - every SUSPENSE_ASSIGNING row (T11 or back to SUSPENSE with a case);
  - the HELD_IN_CLEARING late-outcome row;
  - the whole §5.5 case-return table. A case return runs screening, travel rule, simulation, approval and signing like S2, but has no hold, no standing check and no T5. Every pre-finality failure returns to the source held state, and success posts T9 (from G5) or T10 (from G4) and ends RETURNED or RETURNED_PARTIAL.

### F6 Travel-rule data missing

```mermaid
sequenceDiagram
    autonumber
    participant AD as Adapter (orchestrator and ACL)
    participant CBS
    participant TR as Travel-rule provider
    actor CMP as Compliance
    AD->>CBS: getTravelRuleOriginator (subjectRef) [§5.4 SCREENING CLEAR]
    alt OK, payloadRef and payloadHashTR
        AD->>TR: submit payloadRef → TRAVEL_RULE [§5.4 SCREENING CLEAR]
        TR-->>AD: incomplete [§5.4 TRAVEL_RULE]
        AD->>CBS: createCase TRAVEL_RULE_INCOMPLETE, PayoutOutcome HELD_FOR_CASE. The hold stays → HELD_FOR_CASE [§5.4 TRAVEL_RULE incomplete]
    else REJECTED, Decision class
        AD->>CBS: createCase TRAVEL_RULE_INCOMPLETE, PayoutOutcome HELD_FOR_CASE → HELD_FOR_CASE [§1.5 Decision]
    end
    CMP->>CBS: decide a disposition
    CBS->>AD: CaseDisposition into the inbox, subject to §1.7 (F5) [§4]
    alt RELEASE
        AD->>AD: r := r+1. A travel-rule case resumes at TRAVEL_RULE, not at SCREENING [§5.4 HELD_FOR_CASE RELEASE]
    else HOLD
        AD->>AD: none. The hold stays [§5.4 HELD_FOR_CASE HOLD]
    else CANCEL
        AD->>CBS: releaseHold T5 condition 1 → RELEASED [§5.4 HELD_FOR_CASE CANCEL]
    end
    Note over AD,CBS: Later, at APPROVED, the adapter re-reads and compares payloadHashTR. Changed → T5 condition 1 and TR_HASH_CHANGED → RELEASED [§5.4 APPROVED]
```

- **Case return.** RET_TRAVEL_RULE incomplete → `TRAVEL_RULE_INCOMPLETE`, a `PayoutOutcome`, and the source held state, with no T5 [§5.5]. The bank as originator for a return is **Q-R9**.
- **CONTRACT silent:**
  - whether resuming at TRAVEL_RULE re-reads `getTravelRuleOriginator` or re-submits the stored `payloadRef` is **CF-32**;
  - comparing `payloadHashTR` with the travel-rule system's reported digest (DR-18) is **CF-5(e)**;
  - the field list and threshold are **Q-R3**;
  - the inbound travel-rule check is **Q-R9** and **CF-4(a)**;
  - the R5 000 tier is **CF-4(b)** and **Q-R10**;
  - a counterparty acknowledgement is **CF-24** and **Q-D9**.

### F7 Chain stall

```mermaid
sequenceDiagram
    autonumber
    participant OWN as Own nodes
    participant AD as Adapter (orchestrator and ACL)
    participant SG as Signer U9
    participant MON as Independent monitor
    participant CBS
    actor OC as On-call and Ops lead
    AD->>OWN: poll the head on each own node
    Note over AD,OWN: No new block on two or more own nodes for A_stall (proposed 30 s, value decided under Q-A7) [§1.6 chain stall, §5.8]
    AD->>AD: PAUSE, set the flag, stop signing requests [§1.6]
    AD->>CBS: createCase PENDING_AGE [§1.6 chain stall]
    AD->>MON: report the condition (P0)
    MON->>SG: PAUSE on the direct channel (P0)
    MON->>OC: page
    Note over AD,CBS: Items keep their states and funds, and §5.8 ages keep running. Ingestion has nothing new to read [§1.6]
    OWN-->>AD: new blocks again
    Note over AD,MON: No automatic resume. PAUSED has no automatic exit [§1.6, §5.8 PAUSED]
    OC->>MON: two-person unpause with a recorded resolution (DR-08) [§1.6]
    MON->>AD: signed RESUME (ADR-008)
    MON->>SG: ALL_CLEAR only when its preconditions hold, including no claimed item past its §5.8 age (ADR-008)
```

- **Signed bytes during a stall.** Signed bytes sent before the stall may still land once blocks resume. §5.0 rule 2 still matches them, and their item rows apply.
- **CONTRACT silent:** CONTRACT §1.6 doesn't yet say that the unpause goes through the monitor. That is **CF-9(a)**, which names F7, so the monitor steps rest on ADR-008. Liveness needs more than two-thirds of validators online (C-51); the docs give no stall threshold (M-7).

---

## Mapping to KICKOFF §5 item 2

| Diagram | KICKOFF §5 Phase 1 item 2 bullet | CONTRACT sections |
|---|---|---|
| P0 | (supports every failure and compensation path) | §1.6, §5.8 PAUSED and QUARANTINED; ADR-001 duty 5; ADR-008 |
| S1 | Inbound deposit: a merchant or customer receives USDC on Arc → credit in the CBS | §1.3, §5.0, §5.1 (T1, T2, T8, unid), §5.2, §5.3, §5.7, §5.8 |
| S2 | Outbound payout/withdrawal | §1.3, §3, §4, §5.1 (T3, T4, T5), §5.2, §5.4, §5.8 |
| S3 | Internal treasury moves and gas top-up | §5.1 T6, §5.6, §5.7, §5.8 |
| S4 | Fees | §5.1 (T3, T4, gas batch), §5.7 Gas, §5.8 |
| S5 | Fees (sub-unit dust, KICKOFF money invariants) | §5.1 dust batch, §5.3, §5.7 Dust, §1.7 |
| F1 | Failure path: CBS timeout | §1.3, §1.4, §1.5, §1.6, §1.7 |
| F2 | Failure path: RPC disagreement | §1.6, §5.0 |
| F3 | Failure path: blocklist revert | §5.4 (SIMULATING, SIGNED, CANCELLING, BROADCAST, send-time rule, nonce-drift rule), §5.5, §5.6 |
| F4 | Failure path: stuck nonce | §1.3, §5.4 (BROADCAST, send-time rule, nonce-drift rule, T5 conditions), §5.5, §5.6, §5.8 |
| F5 | Failure path: screening hit | §1.7, §4, §5.3, §5.4, §5.5 |
| F6 | Failure path: travel-rule data missing | §1.5, §3, §5.4, §5.5 |
| F7 | Failure path: chain stall | §1.6, §5.0, §5.8 |
