# CONTRACT: anti-corruption layer between the Arc Rail Adapter and the CBS

**Status: DRAFT for G1. Version 3, fix block J**, regenerated from the spec plus every verifier finding (LEDGER: v1 failed twice → v2 reframe failed → v3 regeneration, regen budget 3 → 2). Fix blocks A to I followed `docs/verification/P1-contract-lensR-4.md` … `-lensR-12.md`; **fix block J** follows `docs/verification/P1-contract-lensR-13.md`. No CBS has been chosen (KICKOFF §1), so this contract is **transport-agnostic**. It defines operations, schemas, keys, error semantics and per-flow state machines. A CBS-specific translator (the ACL's CBS side) maps them onto the chosen vendor's API once Q-C1 is answered.

**Siblings ("ahead" notes).** Fix blocks I and J change five points of the monitor's journal-binding join (§3 `postJournal`, `listJournals`). Points 1 to 4 are from fix block I, point 5 from fix block J:
1. T11 binds to the cited, unsuperseded `ASSIGN` (`refs.assignRef`), not to the current case's `ASSIGN`.
2. The release check ignores the item's own same-nonce cancel.
3. The amount comparison is net of case returns already posted.
4. `listJournals` returns each journal's `refs`, including `txHash` and `caseId`.
5. Every T9/T10 is bound to its own case return before it is netted (contract R13 D1). It carries `refs.caseId`, `refs.dispositionSeq` and `refs.txHash`. The CBS checks `refs.instructionId` against the `cr-` derivation of that `RETURN` disposition in its own record, and R against its `returnAmount`. DR-29 joins `(instructionId, txHash)` to the case-return transfer on-chain, and nets only the T9/T10 journals that pass.

THREAT_MODEL v2 fix block 9 (DR-29) and ADR-008 fix block 7 **match** points 1 to 4: both leave the T11 supersession check to the CBS, where §3 places it. This version is **ahead of both** on point 5, which is routed as LEDGER **CF-39(f)**. This version is **ahead of SEQUENCES v2**, which is pinned to fix block H, on fix blocks I and J (CF-39(d)). OPEN_QUESTIONS **Q-C19** names the T11 check of point 1, and this fix block returns the CBS part of point 5 for it (CF-39(f)).

Every requirement traces to:
- `docs/discovery/cbs-port-requirements.md` (`P…`);
- `docs/constants.md` (`C-…`);
- `docs/THREAT_MODEL.md` (`T-…`, `L-…`).

Primary sources are archived in `docs/sources/` (MANIFEST with SHA-256).

Under CLAUDE.md N3, nothing here authorises a CBS change. After G1, the CBS may be changed only to implement operations listed here, through its own change process.

---

## 1. Conventions

### 1.1 Amounts (I-INT, I-CONV)
- On the wire, every amount is an object `{ "unit": <UnitTag>, "value": "<decimal integer string>" }`. JSON numbers are **never** used for amounts. The value matches `^(0|[1-9][0-9]*)$`. There is no sign: direction is carried by the debit/credit leg.
- `UnitTag` is one of:
  - `CBS_MINOR:<assetCode>:<p>`: CBS minor units at precision `p` (Q-C4)
  - `USDC_UNITS`: ERC-20 view, 6 dp (C-11)
  - `NATIVE_WEI`: native view, 18 dp (C-10)
- The ACL rejects a call whose unit tag doesn't match the account's configured asset and `p` (`REJECTED/UNIT_MISMATCH`).
- **Precision comes from the CBS, not from adapter config.** Every amount the CBS *returns* (`getBalancesAsOf`, `listJournals`, `getResultByKey`) carries a unit tag built from the **CBS's own** asset configuration. At startup and on every response, the adapter compares that `p` with its configured `p`. Any difference → **PAUSE** before any posting (I-FAIL). This is the independent check for a precision mismatch (RISK_REGISTER RR-1). The reconciliation identity can't catch it, because both of its sides use the same `k`.
- Only the conversion module (U1) turns one unit into another (§6).

### 1.2 Identifiers
- `accountRef`: an opaque CBS account identifier. Never a name, ID number or anything else personal (P9.1).
- `chainId`: decimal string. Only `"5042002"` (C-01) is accepted. Any other value gets `REJECTED/CHAIN_NOT_ENABLED` (CLAUDE.md N1; the mainnet gate is in U2).
- `txHash`: `0x` followed by 64 lowercase hex characters. `logIndex` and `blockNumber`: decimal strings with no leading zeros.
- `address`: validated as 20 bytes and **not `0x0`** (C-54). It is displayed EIP-55 checksummed. Inside canonical encodings (§1.3) it is always written as `0x` plus 40 lowercase hex characters.
- **ID grammar** (`ID`): `^[A-Za-z0-9._:-]{1,128}$`, case-preserving, so `Ab` and `ab` are different IDs. Used for:
  - `instructionId`, assigned by the CBS, or derived for case returns (below);
  - `moveId`, `batchSeq`, `caseSeq` and `fundingId`, assigned by the adapter;
  - `caseId`, assigned by the CBS.

  Values that don't match are rejected (`INVALID`). Each is assigned once, durably, before first use, and never reused.
- **Case-return instruction ID:** `"cr-" + first 32 hex characters of SHA-256(canonical(["arc1","cr",caseId,dispositionSeq]))`. It is always 35 characters, so it satisfies the ID grammar for any `caseId`.
- `walletRole`: `hot`, `gas` or `collection` (the per-merchant collection addresses, if ADR-006 option A or B is chosen). Roles name bank wallets in keys without exposing addresses.
- `callId`: a UUID per transport attempt, sent on every adapter→CBS call. It is for the audit join (P8.4) and is **not** part of the idempotency key.
- **Subject references** (`subjectRef` = the canonical-JSON *string* of one of these arrays):

  | Subject | Array |
  |---|---|
  | inbound log | `["in",chainId,txHash,logIndex]` |
  | outbound instruction (incl. case return) | `["out",instructionId]` |
  | internal move | `["move",moveId]` |
  | batch | `["batch","gas"\|"dust",walletRole,batchSeq]` |
  | reconciliation | `["recon",blockNumber,cbsCutoff]`, where `cbsCutoff` is the CBS journal sequence as a decimal string |
  | inbound or outbound CBS event (quarantine) | `["event",eventId]` |
  | rail-wide PAUSE | `["rail",pauseSeq]`, where `pauseSeq` is an adapter counter |
  | account (quarantine) | `["account",accountRef]` |
  | bank wallet (quarantine, blocklist) | `["wallet",walletRole,walletIndex]`, where `walletIndex` is the registry's decimal index within the role |

  `batchSeq` is assigned when an accumulator **opens** a batch, i.e. at its first item. The batch subject therefore exists before it is posted.

### 1.3 Canonical encoding, idempotency keys and payload hash (I-ONCE, P1.1, P7.1)
- **Canonical encoding.** `canonical(x)` = RFC 8785 JSON Canonicalization Scheme (JCS) of `x`, encoded as UTF-8. Every field is a JSON string. A JSON array of strings has no delimiter ambiguity.
- **Key.** `key = "arc1-" + lowercase_hex(SHA-256(canonical(K)))`, 69 ASCII characters. Keys are referred to by **key name**:

| Key name | Operation | `K` |
|---|---|---|
| `K.recv` | T1 inbound received | `["arc1","in",chainId,txHash,logIndex,"recv",attempt]` |
| `K.avail` | T2 or T8 inbound made available | `["arc1","in",chainId,txHash,logIndex,"avail",attempt]` |
| `K.unid` | unidentified inbound to suspense | `["arc1","in",chainId,txHash,logIndex,"unid",attempt]` |
| `K.assign` | T11 suspense assigned to a customer | `["arc1","in",chainId,txHash,logIndex,"assign",attempt]` |
| `K.reserve` | T3 reserve | `["arc1","out",instructionId,"reserve",attempt]` |
| `K.settle` | T4, T9 or T10 settle | `["arc1","out",instructionId,"settle",attempt]` |
| `K.release` | T5 release | `["arc1","out",instructionId,"release",attempt]` |
| `K.move` | T6 internal move | `["arc1","tre",moveId,"move",attempt]` |
| `K.gas` | gas batch | `["arc1","gas",chainId,walletRole,batchSeq,attempt]` |
| `K.dust` | dust batch | `["arc1","dust",chainId,walletRole,batchSeq,attempt]` |
| `K.scr` | `screen` | `["arc1","scr",subjectRef,role,round]`, where `role` is `"sender"` or `"destination"` and `round` is decimal from `"0"` |
| `K.case` | `createCase` | `["arc1","case",reason,subjectRef,caseSeq]`. `caseSeq` is a decimal counter per (reason, subject), starting at `"0"`, so a recurring case always gets a new key |
| `K.mon` | `submitMonitoringEvent` | `["arc1","mon",subjectRef]` |
| `K.appr` | `requestApproval` | `["arc1","appr",instructionId,payloadHash]` |
| `K.rpt` | `fileReportData` | `["arc1","rpt",reportType,subjectRef]` |

  `round` increments each time the same subject and role are screened again after a case disposition.

  **`attempt`** (decimal, from `"0"`) is the **last element of every key** in the table above. Posting and hold keys already show it; for the others (`K.scr`, `K.case`, `K.mon`, `K.appr`, `K.rpt`) it is appended after the elements shown. AMBIGUOUS retries and `getResultByKey` keep the **same** attempt, so an operation is never duplicated. The attempt is incremented **only** when the **same operation for the same subject** is re-issued **after a definite `REJECTED`**, and only on one of these paths:
  - a case disposition that re-enters the flow (`RELEASE`, `ASSIGN`);
  - a two-person resolution of a PAUSED item (`RESUME`, `SETTLED`, `POSTED`, `RELEASED`, `RETURN_FAILED`; §5.4–§5.6) or of a QUARANTINED item (`RESUME`, `RELEASE`, `CONFIRM_ABSENT`; §1.6);
  - a Notification re-queue after `REJECTED` (§1.5).

  **Before incrementing**, the adapter calls `getResultByKey(previous key)`:
  - `REJECTED` → re-issue with `attempt + 1`;
  - `APPLIED` → **don't re-issue**; record the applied result and continue as for OK;
  - `NOT_FOUND`, including a key aged out of CBS retention (Q-C3) → **don't re-issue**; QUARANTINE the item. A human checks the **CBS's own record for that operation** and records one of two resolutions: **`CONFIRM_APPLIED`** (the effect exists → record it as OK and continue) or **`CONFIRM_ABSENT`** (it doesn't → re-issue with `attempt + 1`, **without** a further `getResultByKey` check, because the human check replaces it). The evidence depends on the operation, and the resolution records a reference to it:

  | Operation | Evidence the human checks in the CBS |
  |---|---|
  | `postJournal`, `settleHold` | the journal, through `listJournals` over the item's window |
  | `placeHold` | a hold with this key on the account (`CONFIRM_APPLIED` records its `holdId`) |
  | `releaseHold` | the hold's state: released → `CONFIRM_APPLIED`; still active → `CONFIRM_ABSENT` |
  | `screen` | the screening record for this key (`CONFIRM_APPLIED` records its verdict and `screeningRef`) |
  | `requestApproval` | the approval record (`getApproval`) |
  | `createCase`, `submitMonitoringEvent`, `fileReportData` | the case, monitoring or report record for this key |

  These are the only exits from this quarantine, so it can't loop (contract R8 E4).

  Re-issuing therefore can neither duplicate an operation nor hit a cached rejection or a CONFLICT (contract R5 C1, R6 D2/D6). Rows below that say "`attempt + 1`" mean "per this rule".
- **Payload hash for approvals.** `payloadDigest = SHA-256(canonical({"amountWei":…, "asset":"USDC", "chainId":"5042002", "destination":<lowercase hex>, "instructionId":…}))`, which is 32 raw bytes. `payloadHash` = lowercase hex of `payloadDigest`. Nonce and fees are left out on purpose (SEQUENCES F4). **The WebAuthn challenge is the 32 raw bytes of `payloadDigest`**, not its hex text.

### 1.4 Result model (P1.4, P1.6)
Every adapter→CBS call returns exactly one of:

| Result | Meaning |
|---|---|
| `OK{…}` | Definitely applied, or already applied under this key with the same payload |
| `REJECTED{code}` | Definitely **not** applied, with no side effect |
| `CONFLICT{key}` | Key already used with a **different** payload |
| `AMBIGUOUS` | Timeout, transport error, 5xx, or an unclassified response |

`REJECTED` codes: `INVALID`, `UNIT_MISMATCH`, `CHAIN_NOT_ENABLED`, `UNKNOWN_ACCOUNT`, `ACCOUNT_BLOCKED`, `ACCOUNT_CLOSED`, `INSUFFICIENT_FUNDS`, `UNBALANCED`, `ZERO_AMOUNT`, `NOT_PERMITTED`, `HOLD_NOT_FOUND`, `HOLD_STATE`, `BINDING_MISMATCH`. **An unknown code is treated as `AMBIGUOUS`.** **`BINDING_MISMATCH` → PAUSE in every class**, because the adapter asked to move a customer's money in a way the CBS's own records don't support: an adapter-integrity signal, never a business refusal.

**Resolving AMBIGUOUS** (the same for every keyed operation). Its output is always one of `OK`, `REJECTED{code}`, `CONFLICT` or `UNRESOLVED`:
1. Retry with the **same key and payload**, with exponential backoff and jitter, for at most `H_retry` (< Q-C3 retention). The first non-ambiguous result is the output.
2. Then call `getResultByKey(key)`:
   - `APPLIED` → `OK`
   - `REJECTED{code}` → `REJECTED{code}`
   - `NOT_FOUND` → **one** final call with the same key. Its result is the output, and AMBIGUOUS again → `UNRESOLVED`
   - unavailable, or op not covered (Q-C2) → `UNRESOLVED`

### 1.5 Operation classes and what each result means
| Class | Operations | `REJECTED` | `UNRESOLVED` | `CONFLICT` |
|---|---|---|---|---|
| **Decision** | `placeHold`, `screen`, `requestApproval`, `getAccountStanding`, `getTravelRuleOriginator`; `postJournal` for the **T3 fallback** | Business refusal. The flow compensates as follows unless a §5 row says otherwise:<br>• `placeHold` or T3 fallback → RELEASED (nothing to release);<br>• `screen` → QUARANTINE (screening refused, so we can't proceed);<br>• `requestApproval` → outbound: T5 (condition 1) → RELEASED; case return: `createCase APPROVAL_REJECTED` → source held state;<br>• `getTravelRuleOriginator` → `createCase TRAVEL_RULE_INCOMPLETE` → HELD_FOR_CASE (outbound) or source held state (case return);<br>• `getAccountStanding` → treated as not eligible | **PAUSE** | **PAUSE** |
| **Release** | `releaseHold` (T5); `postJournal` for the **T5 fallback** | `HOLD_NOT_FOUND`/`HOLD_STATE`/other: the release couldn't be applied, and the customer's funds may still be reserved or debited → **QUARANTINE** the instruction (§1.6, escalates to PAUSE). Re-issued only through a QUARANTINE `RELEASE` resolution, under the §1.3 attempt rule | **PAUSE** | **PAUSE** |
| **Fact** | `postJournal` for T1, T6, T9, T10, unid, gas batch, dust batch, **and the T4 fallback**; `settleHold` (T4) | The chain has already settled, so no compensation is possible → **PAUSE**, and the item stays in its pending term and ages (§5.8) | **PAUSE** | **PAUSE** |
| **Decision-then-fact** | `postJournal` for T2, T8, T11 | Funds stay where they are (G5 or G4). The item goes to a held state with a case | **PAUSE** | **PAUSE** |
| **Notification** | `createCase`, `submitMonitoringEvent`, `fileReportData` | Re-queued in the outbox and retried with backoff. **Page Compliance ops immediately.** The money flow does **not** move past any step that needs this notification (§5.2). Past `A_notify` (§5.8) → **PAUSE** | Same as REJECTED | **PAUSE** |

### 1.6 PAUSE and QUARANTINE
- **PAUSE** (rail-wide): stop all outbound signing, page on-call, `createCase` with the reason. Inbound detection continues, so funds keep being recorded, **except** under an RPC disagreement (below). Leaving PAUSE needs a **two-person unpause** (U12).
- **Rail-wide chain conditions (from any state; CLAUDE.md fail-closed; contract R9 F3, CF-14):**
  - **RPC disagreement** (DR-02): own nodes and the reference return a different block hash, or a different log set, for the same height → **PAUSE** (`createCase RECON_DRIFT`). Inbound ingestion **freezes its cursor** at the last height where the sources agree. Nothing past that height is detected or credited until a **two-person resolution** recorded by the monitor (§1.6). SEQUENCES F2 must show that resolution step (routed as part of SEQUENCES fix 2).
  - **Chain stall:** no new block on two or more own nodes for `A_stall` (§5.8; its value is decided under **Q-A7**) → **PAUSE** (`createCase PENDING_AGE`). Ingestion has nothing new to read. Items keep their states, and their §5.8 ages keep running.
  - **Effect on items:** every item stays in its state with its funds where they are. The rail-wide PAUSE stops new signatures, and the ages in §5.8 still apply.
- **QUARANTINE(item)**: stop processing one item (an account, a bank wallet, an instruction, a move or an event; subjects in §1.2), page on-call, and open a case. The rest of the rail continues. **Exit:** a two-person resolution recorded by the monitor:
  - `RESUME`: back to the state it was quarantined from;
  - `CONFIRM_APPLIED` / `CONFIRM_ABSENT`: only for a NOT_FOUND quarantine (§1.3);
  - `RELEASE`: T5, only with proof that a T5 condition holds;
  - `ESCALATE`: → PAUSE.
  QUARANTINE escalates to PAUSE automatically if still unresolved after `A_quarantine` (§5.8). A quarantined or paused item **keeps its funds where they are**, so it stays in the G5/G4 itemisation (§5.7).
- Triggers for PAUSE are named in the tables. Triggers for QUARANTINE: an event that fails schema validation, has an unknown type, or arrives after a `seq` gap; a `HoldChanged` the adapter didn't cause; an `AccountStatusChanged` to frozen or closed during an active outbound instruction (that instruction only).


### 1.7 Events while an effect is in flight, and stale events
- **In-flight gate (all of §5).** An item has an effect **in flight** when any keyed operation for it has been committed to the outbox and has no final result yet. "Final" means OK or REJECTED. A PAUSE or QUARANTINE resolution makes an in-flight effect final **only if it records that effect's outcome with evidence** (`CONFIRM_APPLIED` or `CONFIRM_ABSENT`, §1.3; `SETTLED`, `RELEASED`, `POSTED`, `RETURN_FAILED` or `FAILED` with their proof). **`RESUME` doesn't make an effect final:** it re-drives the in-flight effect under the **same key** (§1.4: retry, then `getResultByKey`), and events stay held until that yields OK or REJECTED (contract R9 F1). `AMBIGUOUS` and `UNRESOLVED` aren't final. This covers **every** keyed effect: every posting (T1–T11, `unid`, and the fallbacks of T3, T4 and T5), every hold operation (`placeHold`, `settleHold`, `releaseHold`) and every Decision call. Notification-class operations (§1.5) are **not** gating effects: they move no money, and `A_notify` already bounds them. While an effect is in flight, **every event for that item** (`CaseDisposition`, `ScreeningOutcome`, `ApprovalDecided`, and a `HoldChanged` caused by the adapter's own in-flight hold operation, as defined in §4) is **held in the inbox**. It is applied only after the result is final, against the state the item has reached by then. The item doesn't change state until the effect's result is final, so a row's "Next" is entered only on that result (contract R7 N1, R8 E1).
  - **Never held:** QUARANTINE and PAUSE triggers (§1.6), including a `HoldChanged` the adapter didn't cause (§4), and `AccountStatusChanged`, which is an account event. Each of these only ever stops processing.
  - **Example (outbound).** HELD_FOR_CASE → `CANCEL` → T5 issued. A `ScreeningOutcome CLEAR` or a later `RELEASE` that arrives while T5 is in flight is held. Once T5 is OK the item is RELEASED, and the held event meets a terminal state (next rule).
- **Events for a terminal item.** A §1.6 QUARANTINE trigger, such as a `HoldChanged` the adapter didn't cause, applies to a terminal item too: QUARANTINE, page, case. It is never just recorded. Every other event for a terminal item (AVAILABLE, BANK_FUNDED, ASSIGNED, DUST_ONLY, RELEASED, SETTLED, RETURNED, ABANDONED, POSTED, FAILED) is recorded, on the open case if there is one, and changes nothing. A `CaseDisposition` there also opens a case (`LATE_DISPOSITION`) and pages Compliance ops, because a human decided on an item that had already finished. **This rule takes precedence over the "invalid combination → QUARANTINE" rule of §4**, which applies only to non-terminal items. **DUST_ONLY** is the exception: its case concerns a flagged D amount and no money action, so a disposition there is recorded on the case and the flagged amount stays in D until its treatment is decided (Q-C5). No `LATE_DISPOSITION` is opened.
- **Current case.** Every §5 row that opens a case for an item records it as the item's **current case**, replacing any earlier one.
  - The current case stays current until a newer case replaces it, or until the item reaches a terminal state. **Nothing else ends it**, and a disposition never closes it.
  - So after `HOLD`, after a partial return (`RETURNED_PARTIAL`), after a `RETURN_FAILED` resolution, and after an abandoned assignment, the item is back in a held state and its current case still accepts dispositions.
  - After `RELEASE` → re-screen → HIT or REVIEW, the new case becomes current.
  - **Where a disposition acts.** A disposition acts only in a state whose §5 rows name a `CaseDisposition`: inbound AWAITING_SCREENING, HELD_IN_CLEARING, SUSPENSE and SUSPENSE_ASSIGNING; outbound AWAITING_SCREENING and HELD_FOR_CASE.
  - In every other non-terminal state, a disposition on the current case is recorded on that case, changes **no** state, and pages Compliance ops, just as a stale disposition does. Examples are SCREENING, RETURNING and the RET_ states of a case return in progress, PAUSED and QUARANTINED. This rule takes precedence over the "invalid combination → QUARANTINE" rules of §4 and of §5.3 (disposition gating), which therefore apply only in the states listed above.
  - `dispositionSeq` orders the several dispositions that one case can receive (contract R11 D1, R12 D2).
- **Stale dispositions.** A `CaseDisposition` whose `caseId` isn't the item's **current case**, or whose `dispositionSeq` is not higher than the last one applied for that case, is recorded on its case and changes **no** state, in every state. Compliance ops are paged (contract R9 F6).
- **Stale screening outcomes.** A `ScreeningOutcome` whose `screeningRef` isn't the one returned by the item's **current** screening round is recorded on the case and changes **no** state, in **every** state (contract R8 E2).
  - **Current round.** An inbound item's current round is its latest **sender** screen (round r). An outbound payout's is its latest **destination** screen. A case return's destination screen (§5.5 RET_SCREENING) has its own subject and `screeningRef`, so it is never the item's current round. It is never awaited either: a HIT or REVIEW sends the item back to its source held state with a case (contract R13 D3).
  - Only an outcome for the current round can resolve a REVIEW, and only in a state that awaits it (AWAITING_SCREENING, SUSPENSE_ASSIGNING). In any other state, that outcome is recorded on the open case and changes **no** state, and Compliance acts through `CaseDisposition`.
  - The held-state rows for unawaited outcomes in §5.3 and §5.4 apply this rule. They also cover the current round's outcome once a `HOLD` or an abandoned assignment has taken the item out of the awaiting state (contract R12 D3).
  - It applies equally in RETURNING and the RET_ states. An AWAITING_SCREENING `RETURN` (§5.3) can move an item there while its sender REVIEW is still outstanding, and the outcome then has no row of its own there. If the return comes back to the source held state, the held-state row applies to any later outcome (contract R13 D3).

---

## 2. GL roles (P4)

Account numbers are supplied by Finance (Q-C7) and loaded from configuration, never hard-coded. No GL name or config key may contain "deposit" or "bank account" (KICKOFF §8).

| Role | Config key | Normal side | Sub-accounts |
|---|---|---|---|
| G1 Customer USDC liability | per `accountRef` | Credit | one per merchant/customer |
| G2 Treasury USDC asset | `gl.treasury.<walletRole>` | Debit | `hot`, `gas`, `collection` (if ADR-006 option A or B) |
| G3 Network fee expense | `gl.gasExpense` | Debit | — |
| G4 Suspense: dust and unidentified | `gl.suspense.dust`, `gl.suspense.unidentified` | Credit | — |
| G5 Clearing / in-flight | `gl.clearing.inbound`, `gl.clearing.outbound` | Credit | balance must equal the sum of listed in-flight items at cut-off |
| G6 Fee income (only if Q-C8 = yes) | `gl.feeIncome` | Credit | — |
| G7 Bank-owned USDC funding | `gl.ownFunds` | Credit | — |

G7 is **not in KICKOFF's list but is required for conservation**. Gas (G3) uses up treasury USDC without reducing any customer liability, so the bank must fund it (T8). The account and its treatment are for Finance (Q-C16).

---

## 3. Operations: adapter → CBS

All of these are idempotent by key (§1.3) unless marked *read*. Every call carries a `callId`. The CBS records `(callerIdentity, key, callId)` in its own audit trail, joinable to U13 (P8.4). The scopes are under P8.3. The class column refers to §1.5.

| Op | Class | Request | `OK` response | Notes |
|---|---|---|---|---|
| `getAccountStanding` *read* | Decision | `{accountRef, asset}` | `{active, kycValid, frozen, asOf}` | Stale (`asOf` older than `A_standing`) or missing → **not eligible** (P6.4) |
| `postJournal` | per template (§1.5): Decision for the T3 fallback, Release for the T5 fallback, D-then-F for T2/T8/T11, Fact for the rest | `{key, valueDate, legs:[{glOrAccountRef, side:"DR"\|"CR", amount}], narrative, refs:{subjectRef, caseId?, dispositionSeq?, instructionId?, address?, txHash?, assignRef?:{caseId, dispositionSeq}}}` | `{journalId, postedAt}` | Balanced per unit and atomic (P1.5). **`refs` per template:** the T3/T4/T5 fallbacks carry `instructionId`, and the T4 fallback also carries the paid transaction's `txHash`. T2 carries `address`. T11 carries `assignRef`, the `ASSIGN` disposition that the item's assignment started from (§5.3, SUSPENSE `ASSIGN` row). T9/T10 carry `instructionId` (the case-return ID), the `caseId` and `dispositionSeq` of the `RETURN` disposition, and the `txHash` of the final status-1 case-return transaction (§5.5). A required ref that is missing → `REJECTED{INVALID}`. **Account binding (CF-16).** It applies to every operation that writes a customer-account leg: `placeHold`, `settleHold`, `releaseHold` (bound through `holdId`), and the `postJournal` templates below. Every leg on a customer account (G1) must match the CBS's **own** record:<br>• T3/T4/T5 fallbacks: the payout instruction's `accountRef` and A + fee (`refs.instructionId`);<br>• T2: the account to which the CBS issued `refs.address` (`listIssuedAddresses`);<br>• T11: the `accountRef` of the disposition named by `refs.assignRef` in the CBS's **own** disposition record. That disposition must be an `ASSIGN` on a case whose subject equals `refs.subjectRef`. A cited disposition that doesn't exist, isn't an `ASSIGN`, belongs to another subject, or names another account → `REJECTED{BINDING_MISMATCH}`.<br>**A superseded `ASSIGN` doesn't bind.** Suppose the CBS's own record holds a later `ASSIGN`, `HOLD` or `RETURN` for the same subject, on any of its cases. The CBS then refuses T11 with `REJECTED{NOT_PERMITTED}`. This is a business refusal (D-then-F, §1.5), not an integrity signal. The funds stay in G4, and the item goes back to SUSPENSE with a `POSTING_REJECTED` case (§5.3). The reason is that a human may legitimately have decided again: on a case the adapter treated as stale (§1.7), or while T11 was in flight. A REVIEW case opened during the assignment carries no disposition, so it never supersedes the `ASSIGN`. A REVIEW followed by CLEAR therefore still binds to the `ASSIGN` the assignment started from (contract R12 D1). Any other G1 leg → `REJECTED{BINDING_MISMATCH}`. **Case returns (T9/T10) bind to their own `RETURN`.** T9/T10 have no G1 leg, but their `caseId` decides which item a case return is netted from (below), so the CBS binds it too. Its **own** disposition record must hold a `RETURN` with `refs.caseId` and `refs.dispositionSeq`, `refs.instructionId` must equal that disposition's case-return ID (§1.2: `"cr-"` + the first 32 hex characters of SHA-256(canonical(["arc1","cr",caseId,dispositionSeq]))), and the journal's R must equal that disposition's `returnAmount`. Anything else → `REJECTED{BINDING_MISMATCH}` → PAUSE (contract R13 D1). **Settlements and releases against the chain.** Every settlement (`settleHold`, the T4 fallback with `refs.txHash`, or a T9/T10 with `refs.txHash`) must match a final status-1 transaction for **that** instruction whose content matches the instruction's approval. For a case return, that content is `to` = the `RETURN` disposition's `returnDestination` and value = R × k. Every release (T5) of an instruction that has a signing-log entry must have **no final status-1 transaction whose content matches that instruction's approval**. The item's own same-nonce cancel (zero value, `to` = the sending wallet, carrying the `instructionId`, LEDGER CF-18) is not a payout and doesn't count (contract R12 D4). The monitor checks these (DR-29); a mismatch → PAUSE. This stops a settlement being claimed against another customer's paid transaction while that customer's hold is released. **Amounts that start on-chain** (T2, T8, T11, `unid`), and T2's `refs.address`, can't be checked by the CBS. They are the adapter's claim, bound **outside the adapter** by the monitor's journal-binding join (THREAT_MODEL DR-29, ADR-008). The join compares each journal's account, address and amount with the monitor's own log fetch. The expected amount is the item's `h` (§5.1): `m = ⌊W/k⌋` from the log, less `R` for every T9 or T10 already posted for that item. Only a T9/T10 that passed the CBS's `RETURN` binding above **and** whose `(instructionId, txHash)` the monitor has joined to its case-return transaction is netted, and each such transaction is netted once. Its item is the subject of the case that `refs.caseId` names, taken from the CBS's own case record, not from the adapter. A credit after a partial return therefore matches, and an over-credit doesn't. A genuine return of one item can't be netted from another: its transaction carries the case-return ID of the first item's `RETURN`, and a T9/T10 citing the second item's case would need that case's own case-return ID, which either fails the CBS binding or has no transaction (contract R13 D1). Until that join exists, this is RISK_REGISTER RB-13. Whether the CBS can do the binding checks in this paragraph and in `placeHold`/`settleHold` is **Q-C19**. That includes the T11 supersession check over the CBS's own disposition record and the T9/T10 `RETURN` binding. **No zero-amount legs:** a leg whose amount would be 0 is omitted, never sent. `narrative` has no PII |
| `getResultByKey` *read* | — | `{key}` | `{state:"APPLIED"\|"NOT_FOUND"\|"REJECTED", op, result?, code?}` | Covers every keyed op |
| `placeHold` | Decision | `{key, instructionId}` | `{holdId, accountRef, amount}` | **The CBS takes `accountRef` and `amount` (A + fee) from its own payout instruction**, never from the adapter (contract R9 F2, CF-16), and returns them so the adapter can check them. **No expiry.** This is deliberately stricter than port requirement P3.4, which allows a long configurable expiry: release depends on nonce resolution (§5.4), which has no upper bound. If the CBS can't create a hold without expiry, holds aren't used and the P3.5 fallback applies (§5.1, T3/T4/T5 fallback legs) |
| `releaseHold` | Release | `{key, holdId}` | `{}` | Only under the T5 conditions (§5.4) |
| `settleHold` | Fact | `{key, holdId, instructionId, txHash, legs:[…]}` | `{journalId}` | Atomic (P3.3). **Bound (CF-16):** the CBS checks that **the hold was placed for this `instructionId`** (by `placeHold {key, instructionId}`), that the debit leg is **the hold's own account and amount**, and that the credits are A to G2.hot and the fee to G6 **per its own payout instruction**. `instructionId` and `txHash` are recorded on the journal, and `listJournals` returns them as its `refs`. The CBS can't check the chain, so the monitor does: **DR-29** joins every settlement's `(instructionId, txHash)` to a final status-1 receipt whose signing-log entry carries the same `instructionId` and whose content matches that instruction's approval (contract R11 D2). Anything else → `REJECTED{BINDING_MISMATCH}` → PAUSE |
| `screen` | Decision | `{key, subject:{kind:"ADDRESS"\|"CCTP_MINT", value}, role, direction, amount, context}` | `{verdict:"CLEAR"\|"HIT"\|"REVIEW", screeningRef}` | `REVIEW` → wait for `ScreeningOutcome` (§4). `kind:"CCTP_MINT"` (sender `0x0`) can never return CLEAR synchronously, so it is always REVIEW |
| `createCase` | Notification | `{key, reason, subjectRef, refs, evidenceRefs}` | `{caseId}` | Reasons (closed list): `SCREENING_HIT`, `SCREENING_REVIEW`, `UNIDENTIFIED_INBOUND`, `MINT_UNATTRIBUTED`, `TRAVEL_RULE_INCOMPLETE`, `TR_HASH_CHANGED`, `RECON_DRIFT`, `BLOCKLIST_REVERT`, `BLOCKLIST_PRECHECK`, `STANDING_INELIGIBLE`, `APPROVAL_REJECTED`, `APPROVAL_EXPIRED`, `APPROVAL_MISMATCH`, `CANCEL_FINAL`, `POSTING_REJECTED`, `SIGNER_REFUSED`, `CANCEL_BLOCKED`, `LATE_DISPOSITION`, `PENDING_AGE`, `QUARANTINE`, `PAUSE`. Every §5 row that opens a case names one of these |
| `submitMonitoringEvent` | Notification | `{key, direction, class, accountRef?, amount, chainId, txHash, counterpartyAddress, at}` | `{}` | For **every** movement class (§5.2). Format: Q-C9 |
| `getTravelRuleOriginator` *read* | Decision | `{subjectRef}` | `{payloadRef, payloadHashTR}` | The adapter never holds the fields. `payloadHashTR` is stored and re-checked before signing (T-B2). Field list: Q-R3 |
| `requestApproval` | Decision | `{key, instructionId, payloadHash, summary}` | `{approvalId}` | The checker signs `payloadDigest` (§1.3) |
| `getApproval` *read* | Decision | `{approvalId}` | `{state:"PENDING"\|"APPROVED"\|"REJECTED", payloadHash, makerId, checkerId, decidedAt, checkerAssertion}` | `checkerAssertion` is a WebAuthn assertion whose challenge is `payloadDigest`. The **signer** verifies it against its own registered credential for `checkerId` (T-T1, CF-1). If the CBS can't produce one: Q-C10, and T-T1 stays OPEN |
| `getBalancesAsOf` *read* | — | `{accounts:[…], cutoff}` | `{balances:[{account, amount}], cutoffApplied}` | P10.1 |
| `listJournals` *read* | — | `{fromCutoff, toCutoff, keys?}` | `{journals:[{journalId, key, legs, refs, postedAt}], next?}` | P10.2. `refs` is the journal's `refs` as posted (`postJournal`). For a `settleHold` journal, it holds `instructionId` and `txHash` from the request, and `subjectRef` = `["out",instructionId]` (§1.2), which the CBS derives from that `instructionId` because the request carries no `subjectRef` (contract R13 D4). DR-29 joins every settlement, T9/T10 included, on `(instructionId, txHash)` to its transaction, and joins a T9/T10 to its item through the CBS-bound `caseId` and `dispositionSeq` (`postJournal`; ADR-008 input map; contract R12 D5, R13 D1) |
| `fileReportData` | Notification | `{key, reportType, subjectRef, dataRefs}` | `{reportRef}` | P6.6. `reportType` is undefined until Q-R1 is answered |
| `replayEvents` *read* | — | `{fromSeq?, fromTime?, types?}` | `{events:[…], next?}` | P5.3 |

## 4. Operations and events: CBS → adapter, and adapter → CBS events

| Name | Direction | Payload | Delivery and rules |
|---|---|---|---|
| `submitPayoutInstruction` | CBS → adapter (call) | `{instructionId, accountRef, asset:"USDC", amount:CBS_MINOR, destination, purposeCode?}` | Idempotent by `instructionId`. Response: `OK{instructionId, state:"ACCEPTED"}`, `CONFLICT`, or `REJECTED{code}` with code `INVALID`, `UNIT_MISMATCH`, `ZERO_AMOUNT`, `INVALID_DESTINATION` or `ADAPTER_PAUSED`. **An `instructionId` starting with `cr-` is `INVALID`**: that prefix is reserved for derived case-return IDs (§1.2). All REJECTED codes are definite and have no effect. `INVALID_DESTINATION` covers bad format, `0x0` (C-54), and any address in the adapter's `forbiddenDestinations` config: the Ethereum precompile set of the Osaka baseline (the exact list is fixed in U2 config and reviewed under Q-A14), `0x3600…0000` (USDC's ERC-20 interface, which "is deployed at a precompile address", https://docs.arc.io/integrate/exchanges/custody.md, accessed 2026-10-02, archived at `docs/sources/arc/integrate_exchanges_custody.md` line 76), `0x1800…0000` (C-26), the system emitter (C-20), the Memo and Multicall3From contracts (C-62, C-63), and every address in the registry (bank wallets aren't payout destinations; internal moves use §5.6). Refusing precompiles is **the adapter's own conservative rule**, because the doc statement about precompile reverts was removed on 2026-10-02 (Q-A14, archived in `docs/sources/arc/`) |
| `PayoutOutcome` | adapter → CBS (event) | `{eventId, instructionId, state:"SETTLED"\|"RELEASED"\|"HELD_FOR_CASE"\|"QUARANTINED"\|"PAUSED"\|"RETURNED"\|"RETURNED_PARTIAL"\|"RETURN_FAILED", txHash?, amount?, caseId?, at}` | **Emitted on every transition of an outbound or case-return instruction into one of these states** (§5.4, §5.5). For case returns: `RETURNED` (fully returned), `RETURNED_PARTIAL` (R moved on-chain, funds remain held; carries `amount` and `txHash`), `RETURN_FAILED` (back to the source held state; nothing moved, except gas if a transaction reverted). At least once, from the outbox. Deduplicated on `eventId` |
| `AccountStatusChanged` | CBS → adapter | `{eventId, seq, accountRef, active, kycValid, frozen, at}` | At least once. Deduplicated on `eventId`, applied in `seq` order per account |
| `HoldChanged` | CBS → adapter | `{eventId, seq, holdId, key, state, at}` | **`key`** is the idempotency key of the operation that caused the change, if any. **Caused by the adapter** = its `key` is the key of one of the adapter's own hold operations (in flight or completed) and its `state` is the state that operation produces → recorded, changes nothing (held while that operation is in flight, §1.7). Anything else → QUARANTINE that instruction |
| `ScreeningOutcome` | CBS → adapter | `{eventId, screeningRef, verdict:"CLEAR"\|"HIT", at}` | Resolves a pending `REVIEW` (§5.3, §5.4) **only for the current screening round's `screeningRef`**; anything else is stale (§1.7) |
| `ApprovalDecided` | CBS → adapter | `{eventId, approvalId, state, at}` | A trigger only. The adapter re-reads through `getApproval` |
| `CaseDisposition` | CBS → adapter | `{eventId, caseId, dispositionSeq, disposition, accountRef?, returnAmount?, returnDestination?, decidedBy, at}` | Humans only. Valid dispositions per subject are in §5.3 to §5.5. `RETURN` requires `returnAmount` (CBS_MINOR, **greater than 0**) and `returnDestination`. `ASSIGN` requires `accountRef`. An invalid combination → QUARANTINE |

**Acknowledgement.** The adapter acks an event only after it has committed the event to its inbox. The sender redelivers anything un-acked. An event with an unknown `type`, a gap in `seq`, or a payload that fails schema validation → QUARANTINE (§1.6). After downtime, the adapter catches up through `replayEvents` from its last committed `seq`. If the CBS can't emit events (Q-C14), the adapter polls the matching reads on a fixed cadence (P5.2 fallback).

---

## 5. Flows as state machines (I-CONS, I-ONCE, I-FAIL)

Notation: `k = 10^(18−p)`, `m = ⌊W/k⌋`, dust `= W mod k`, all computed by U1.

How to read the tables:
- Every row is `state × outcome → action → next state`.
- Results not shown in a row follow §1.5: UNRESOLVED and CONFLICT → **PAUSE**. Fact REJECTED → **PAUSE**.
- Any state can also leave because of reconciliation (§5.7) or age (§5.8).

### 5.0 Classifying a system-emitter log (C-20)
Rules are applied **in order**, using the address registry (U5):

1. `from` is bank-controlled **and** `to` is bank-controlled → **internal**. It must match exactly one move **whose signed bytes exist** (SIGNED, BROADCAST or CANCELLING in §5.6, or PAUSED or QUARANTINED entered from one of these) **and** one entry in the signer's own signing log.
2. `from` is bank-controlled, `to` is not → **outbound**. It must match exactly one outbound or case-return instruction **whose signed bytes exist**: in SIGNED, BROADCAST, CANCELLING, RET_SIGNED, RET_BROADCAST or RET_CANCELLING, **or** in PAUSED or QUARANTINED entered from one of these (a send that timed out, or an original landing while its cancel is pending, can still appear on-chain), **and** one signing-log entry. A match found in SIGNED, PAUSED or QUARANTINED is handled like the corresponding BROADCAST row for that receipt.
   - **Drift cell "unmatched outflow"** (MC-05): a log that fails rule 1 or rule 2 → **PAUSE** (T-E2, RR-3). The residual is legitimately non-zero here, because the chain moved in a way the rail didn't authorise.
3. `to` is bank-controlled (`from` is external or `0x0`) → **inbound** (§5.3).
4. Neither address is bank-controlled → not ours. Ignore it.

The signer's signing log records `(payloadHash, nonce, txHash)` for every signature. It is written by the signer, not the orchestrator. That makes it the independent input for rules 1 and 2 (ADR-001 Context, "Signing log"; for a custodian it must be provided by them, Q-D1(c)).

### 5.1 Templates (balanced by construction; zero-amount legs are omitted)
| ID | Journal | Key |
|---|---|---|
| T1 | `DR G2.<wallet> m · CR G5.inbound m` | `K.recv` |
| T2 | `DR G5.inbound h · CR G1 h` | `K.avail` |
| T3 | hold `A + fee` on G1. Fallback: `DR G1 (A+fee) · CR G5.outbound (A+fee)` | `K.reserve` |
| T4 | settleHold → `DR G1 (A+fee) · CR G2.hot A` and, **only if fee > 0**, `CR G6 fee`. Fallback: `DR G5.outbound (A+fee)` with the same credits | `K.settle` |
| T5 | releaseHold. Fallback: `DR G5.outbound (A+fee) · CR G1 (A+fee)` | `K.release` |
| T6 | `DR G2.<to> X · CR G2.<from> X` | `K.move` |
| T8 | `DR G5.inbound h · CR G7 h` | `K.avail` |
| T9 | case return from clearing: `DR G5.inbound R · CR G2.hot R` | `K.settle` (case-return instructionId) |
| T10 | case return from suspense: `DR G4.unidentified R · CR G2.hot R` | `K.settle` (case-return instructionId) |
| T11 | suspense assigned: `DR G4.unidentified h · CR G1 h` | `K.assign` |
| unid | `DR G5.inbound h · CR G4.unidentified h` | `K.unid` |
| gas batch | `DR G3 n · CR G2.<r> n` | `K.gas` |
| dust batch | `DR G2.<r> n · CR G4.dust n` | `K.dust` |

**`h` is the item's current `heldAmount`**, not the original `m`: they differ after a partial case return (`RETURNED_PARTIAL`, §5.5). When T2, T8, T11 or `unid` is OK, `heldAmount` moves with the funds (it becomes 0 for G5 after T2/T8, and is carried to G4 by `unid`, where T11 then zeroes it). This prevents over-crediting after a partial return (contract R6 D1).

`fee` is 0 unless Q-C8 = yes. With fee = 0 there is no G6 leg, and G6 doesn't need to exist.

### 5.2 Compliance coverage by movement class (P6.1, P6.3, P6.5)
Every class is monitored and given a case path. Every class that involves an external party is screened. A step marked **gate** must succeed before the money flow moves on.

| Class | Screen (subject, role) | Monitor (`K.mon`) | Case on | Gate before |
|---|---|---|---|---|
| Inbound → customer | sender address | yes | `SCREENING_HIT`, `SCREENING_REVIEW`, `STANDING_INELIGIBLE`, `POSTING_REJECTED` (§5.3) | T2 |
| Inbound → bank-owned wallet | sender address | yes | `SCREENING_HIT`, `SCREENING_REVIEW`, `POSTING_REJECTED` (T8, §5.3) | T8 |
| Inbound → bank address with no mapping (unidentified) | sender address | yes | always (`UNIDENTIFIED_INBOUND`); also `SCREENING_HIT`, `SCREENING_REVIEW`, and, on assignment, `STANDING_INELIGIBLE` and `POSTING_REJECTED` (T11) (§5.3) | T11 (assign) or T10 (return) |
| Inbound mint (`from = 0x0`, e.g. CCTP) | `CCTP_MINT`, which is always REVIEW | yes | always (`MINT_UNATTRIBUTED`); also `STANDING_INELIGIBLE`, `POSTING_REJECTED` (T2, T8, T11), `UNIDENTIFIED_INBOUND`, and `SCREENING_REVIEW` on assignment (§5.3) | T2, T8 or T11 |
| Inbound dust-only (`m = 0`) | sender address | yes | HIT, REVIEW | — (no posting; the D item is flagged) |
| Outbound payout | destination address | yes | `SCREENING_HIT`, `SCREENING_REVIEW`, `TRAVEL_RULE_INCOMPLETE`, `TR_HASH_CHANGED`, `STANDING_INELIGIBLE`, `BLOCKLIST_PRECHECK`, `BLOCKLIST_REVERT`, `CANCEL_FINAL`, `CANCEL_BLOCKED`, `APPROVAL_MISMATCH`, `APPROVAL_EXPIRED` (§5.8), `SIGNER_REFUSED` (§5.4) | signing |
| Case return (T9, T10) | destination address | yes | `SCREENING_HIT`, `SCREENING_REVIEW`, `TRAVEL_RULE_INCOMPLETE`, `TR_HASH_CHANGED`, `APPROVAL_REJECTED`, `APPROVAL_EXPIRED`, `APPROVAL_MISMATCH`, `BLOCKLIST_PRECHECK`, `BLOCKLIST_REVERT`, `CANCEL_FINAL`, `CANCEL_BLOCKED`, `SIGNER_REFUSED` (§5.5) | signing |
| Internal move | — (bank to bank) | yes | signer refusal (`SIGNER_REFUSED`), blocklist pre-check (`BLOCKLIST_PRECHECK`), on-chain failure (`BLOCKLIST_REVERT`), cancel final (`CANCEL_FINAL`), cancel blocked (`CANCEL_BLOCKED`) (§5.6) | — |

**Every class** can also open `PENDING_AGE` (a §5.8 expiry), `LATE_DISPOSITION` (§1.7), `QUARANTINE` and `PAUSE` cases. A required `createCase` or a gating `screen` that hasn't returned holds the item in its current state. `A_notify` (§5.8) then applies.

### 5.3 Inbound
**Disposition gating.** The in-flight gate of §1.7 applies: every event for an item, including a `CaseDisposition`, is held while any keyed effect for that item is in flight. When a disposition is applied, `RETURN` is validated against **the `heldAmount` at that moment**: if the posting succeeded and moved the funds elsewhere (for example T11 credited the customer), a `RETURN` against the source no longer applies. The item is then terminal (AVAILABLE, BANK_FUNDED or ASSIGNED), so the §1.7 terminal rule applies: recorded, `LATE_DISPOSITION`, page Compliance ops, no QUARANTINE. A `RETURN` larger than a still-held `heldAmount` on a non-terminal item → QUARANTINE (invalid disposition). This removes the race in which a return was accepted against a stale `heldAmount` while a credit was still in flight (contract R7 N1).

**Detection commit**, one local transaction:
- D[wallet] gains `W mod k`;
- Rin gains `m×k`;
- `heldAmount := m`;
- the item enters DETECTED;
- the outbox rows for T1 (if `m > 0`) and `K.mon` are written.

| State | Outcome | Action | Next |
|---|---|---|---|
| DETECTED, `m = 0` | — | screen sender (`K.scr`). Dust-only item in D | DUST_ONLY (terminal. A HIT or REVIEW flags the D item and opens a case, `SCREENING_HIT` or `SCREENING_REVIEW`. Q-C5) |
| DETECTED | T1 OK | Rin loses `m×k` | RECEIVED |
| RECEIVED | — | screen per §5.2 (`K.scr`, round r) | SCREENING |
| SCREENING | CLEAR, `to` bank-owned, `from` not `0x0` | T8 | BANK_FUNDED (terminal) |
| SCREENING | CLEAR, `to` maps to `accountRef` | `getAccountStanding`. If eligible → T2. If ineligible → `createCase STANDING_INELIGIBLE` | AVAILABLE (terminal) or HELD_IN_CLEARING |
| SCREENING | CLEAR, `to` has no mapping | `unid` posting, `createCase UNIDENTIFIED_INBOUND` | SUSPENSE |
| SCREENING | HIT | `createCase SCREENING_HIT` | HELD_IN_CLEARING |
| SCREENING | REVIEW (including every `CCTP_MINT`) | `createCase SCREENING_REVIEW` or `MINT_UNATTRIBUTED` | AWAITING_SCREENING |
| AWAITING_SCREENING | `ScreeningOutcome CLEAR`, `to` bank-owned (including a **mint**: `CCTP_MINT` cleared by Compliance) | T8 | BANK_FUNDED |
| AWAITING_SCREENING | `ScreeningOutcome CLEAR`, `to` maps to `accountRef` (including a cleared mint) | `getAccountStanding`. Eligible → T2. Ineligible → `createCase STANDING_INELIGIBLE` | AVAILABLE or HELD_IN_CLEARING |
| AWAITING_SCREENING | `ScreeningOutcome CLEAR`, `to` has no mapping | `unid` posting, `createCase UNIDENTIFIED_INBOUND` | SUSPENSE |
| AWAITING_SCREENING | `ScreeningOutcome HIT` | the case continues | HELD_IN_CLEARING |
| AWAITING_SCREENING | `CaseDisposition` (RELEASE, HOLD, RETURN) | handle exactly as the HELD_IN_CLEARING rows below | as there |
| RECEIVED→T2 | T2 or T8 REJECTED (D-then-F) | `createCase POSTING_REJECTED` | HELD_IN_CLEARING |
| HELD_IN_CLEARING | `RELEASE` (accountRef mapping) | r := r + 1, re-run SCREENING (with a fresh standing check) | SCREENING |
| HELD_IN_CLEARING | `RELEASE` for bank-owned | T8 | BANK_FUNDED |
| HELD_IN_CLEARING | `RELEASE`, `to` has **no mapping** (including an unattributed mint) | r := r + 1, re-run SCREENING, whose rows decide. CLEAR → `unid` posting, `createCase UNIDENTIFIED_INBOUND` → SUSPENSE (ready for `ASSIGN` or `RETURN`). HIT → `createCase SCREENING_HIT` → HELD_IN_CLEARING. REVIEW (every mint) → AWAITING_SCREENING, whose rows act on the outcome (contract R12 D3) | SCREENING |
| HELD_IN_CLEARING, SUSPENSE, DUST_ONLY | a `ScreeningOutcome` that this state doesn't await: a late outcome for an earlier REVIEW (§1.7), or the current round's outcome after a `HOLD` (from AWAITING_SCREENING) or an abandoned assignment (from SUSPENSE_ASSIGNING) moved the item here | recorded on the open case, no state change. Compliance acts through `CaseDisposition`: `RELEASE` re-screens, and a REVIEW then waits in AWAITING_SCREENING; `ASSIGN` re-screens in SUSPENSE_ASSIGNING | unchanged |
| HELD_IN_CLEARING | `HOLD` | none | HELD_IN_CLEARING |
| HELD_IN_CLEARING | `RETURN` with `returnAmount ≤ heldAmount` | start a case return from G5 (§5.5) | RETURNING |
| HELD_IN_CLEARING | `RETURN` with `returnAmount > heldAmount` | QUARANTINE (invalid disposition) | HELD_IN_CLEARING |
| SUSPENSE | `ASSIGN(accountRef)` | record this disposition (`caseId`, `dispositionSeq`) as the item's `assignRef`, which T11 cites (§3, `postJournal` binding). `getAccountStanding`, then screen sender (round r+1) | SUSPENSE_ASSIGNING |
| SUSPENSE_ASSIGNING | eligible and CLEAR | T11 | ASSIGNED (terminal) |
| SUSPENSE_ASSIGNING | ineligible | `createCase STANDING_INELIGIBLE` | SUSPENSE |
| SUSPENSE_ASSIGNING | HIT | `createCase SCREENING_HIT` | SUSPENSE |
| SUSPENSE_ASSIGNING | REVIEW | `createCase SCREENING_REVIEW`. On `ScreeningOutcome` CLEAR (and still eligible) → T11 → ASSIGNED. On HIT → SUSPENSE | SUSPENSE_ASSIGNING |
| SUSPENSE_ASSIGNING | T11 REJECTED (D-then-F) | `createCase POSTING_REJECTED` | SUSPENSE |
| SUSPENSE_ASSIGNING | `CaseDisposition` `HOLD`, `RETURN` or a new `ASSIGN` | abandon this assignment; handle as the SUSPENSE rows | as there |
| SUSPENSE | `RETURN` with `returnAmount ≤ heldAmount` | start a case return from G4 (§5.5) | RETURNING |
| SUSPENSE | `HOLD` | none | SUSPENSE |

### 5.4 Outbound payout
On-chain value = `A × k` wei, exactly.

| State | Outcome | Action | Next |
|---|---|---|---|
| ACCEPTED | `placeHold` OK, and the returned `accountRef` and `amount` equal the instruction's (A + fee) | — | RESERVED |
| ACCEPTED | `placeHold` OK, but the returned `accountRef` or `amount` differs from the instruction | **PAUSE** (adapter or CBS integrity; CF-16) | PAUSED |
| ACCEPTED | `placeHold` REJECTED | `PayoutOutcome RELEASED` | RELEASED (terminal) |
| RESERVED | policy DENY or standing ineligible | T5 (condition 1) | RELEASED |
| RESERVED | ALLOW and eligible | screen destination (`K.scr`, round r) | SCREENING |
| SCREENING | CLEAR | `getTravelRuleOriginator`, store `payloadHashTR`, then submit to TR | TRAVEL_RULE |
| SCREENING | HIT | `createCase SCREENING_HIT`. The hold stays | HELD_FOR_CASE |
| SCREENING | REVIEW | `createCase SCREENING_REVIEW` | AWAITING_SCREENING |
| AWAITING_SCREENING | `ScreeningOutcome CLEAR` / `HIT` | as for SCREENING CLEAR / HIT | — |
| AWAITING_SCREENING | `CaseDisposition` RELEASE / HOLD / CANCEL | exactly as the HELD_FOR_CASE rows below | as there |
| TRAVEL_RULE | COMPLETE | `eth_call` simulation on own node(s) (L-3) | SIMULATING |
| TRAVEL_RULE | incomplete | `createCase TRAVEL_RULE_INCOMPLETE`. The hold stays | HELD_FOR_CASE |
| SIMULATING | success | `requestApproval` | AWAITING_APPROVAL |
| SIMULATING | EVM revert | T5 (condition 1) | RELEASED |
| SIMULATING | JSON-RPC `-32603` with message `"Blocked address"` (C-57) | T5 (condition 1), `createCase BLOCKLIST_PRECHECK` | RELEASED |
| SIMULATING | any other error | retry up to `H_retry`, then **PAUSE** | — |
| AWAITING_APPROVAL | APPROVED, hash matches, maker ≠ checker | `getAccountStanding` (no older than `A_standing`). Re-read and compare `payloadHashTR` | APPROVED |
| AWAITING_APPROVAL | REJECTED | T5 (condition 1) | RELEASED |
| AWAITING_APPROVAL | hash mismatch or maker = checker | **PAUSE** (`APPROVAL_MISMATCH`, T-T1) | PAUSED |
| APPROVED | eligible and TR hash unchanged | assign nonce (single writer). The signer verifies `checkerAssertion`, shape (T-E5) and limits, signs, and logs to its signing log | SIGNED |
| APPROVED | ineligible, or TR hash changed | T5 (condition 1), `createCase STANDING_INELIGIBLE` or `TR_HASH_CHANGED` | RELEASED |
| APPROVED | signer refuses | **PAUSE** | PAUSED |
| SIGNED | bytes persisted, then sent to own node(s) and the reference. **At least one source accepts** | — | BROADCAST |
| SIGNED | **every** source rejects with `-32603 "Blocked address"` (C-57, Q-A13) | `createCase BLOCKLIST_PRECHECK`. The bytes may still exist somewhere, so **no release yet**: sign a same-nonce zero-value self-send cancel (shape-allowed: empty data, `to` = own wallet) | CANCELLING |
| SIGNED | every source rejects with `transaction underpriced` | Can't happen if the fee floor (C-30) is honoured, so it means a config or chain-parameter change → **PAUSE** (DR-16) | PAUSED |
| SIGNED | `-32014` or another transient error from every source | Resend the **same bytes**, with backoff, up to `A_broadcast` | SIGNED |
| SIGNED | any other rejection from every source | **PAUSE** | PAUSED |
| SIGNED | **no source accepts, and the results differ** between sources | Take the most severe result present, in this order: other rejection (→ PAUSE) > `transaction underpriced` (→ PAUSE) > `"Blocked address"` (→ cancel path) > `-32014`/transient (→ resend) | as that row |
| CANCELLING | the cancel is final (status 1 or 0) | gas to F. T5 (condition 3). `createCase CANCEL_FINAL` | RELEASED |
| CANCELLING | the **original** transaction is final instead (status 1) | It went through despite the send-time error: Rout, then T4 as in BROADCAST, `K.mon` | SETTLED |
| CANCELLING | the **original** transaction is final with status 0 | gas to F. T5 (condition 2). `createCase BLOCKLIST_REVERT` | RELEASED |
| CANCELLING | no receipt for either by `A_stuck` | **PAUSE** | PAUSED |
| BROADCAST | final receipt status 1 | Rout gains `A×k`. T4. Rout loses it on OK. `K.mon` | SETTLED (terminal) |
| BROADCAST | final receipt status 0 | gas to F. T5 (condition 2). `createCase BLOCKLIST_REVERT` | RELEASED |
| BROADCAST | no receipt by `T_pending` | SEQUENCES F4: rebroadcast or replace. Cancel only on operator instruction | BROADCAST |
| BROADCAST | our same-nonce cancel is final | gas to F. T5 (condition 3) | RELEASED |
| BROADCAST | nonce used, no receipt for any of our hashes (Q-A1) | **PAUSE**. Neither settle nor release. **Drift cell** (MC-05): the chain moved in a way the rail can't attribute | PAUSED |
| BROADCAST | nonce used by a hash we did not sign (DR-12) | **PAUSE**. **Drift cell** | PAUSED |
| PAUSED | two-person unpause with a recorded resolution: `RESUME` (back to the state it was paused from), `SETTLED` (proof of a status-1 receipt supplied → T4), or `RELEASED` (proof that one of the T5 conditions holds → T5) | as chosen. **Owner: on-call plus Ops lead**. No automatic exit | as chosen |
| HELD_FOR_CASE | `RELEASE` | r := r + 1, re-enter at SCREENING. A travel-rule case resumes at TRAVEL_RULE | SCREENING or TRAVEL_RULE |
| HELD_FOR_CASE | `HOLD` | none. The hold stays | HELD_FOR_CASE |
| HELD_FOR_CASE | a `ScreeningOutcome` that this state doesn't await: a late outcome for an earlier REVIEW (§1.7), or the current round's outcome after a `HOLD` moved the item here from AWAITING_SCREENING | recorded on the open case, no state change. Compliance acts through `CaseDisposition`: `RELEASE` re-screens, and a REVIEW then waits in AWAITING_SCREENING (contract R12 D3) | HELD_FOR_CASE |
| HELD_FOR_CASE | `CANCEL` (cancel the payout; freeze vs cancel is Q-R8) | T5 (condition 1) | RELEASED |

Every arrival at RELEASED, SETTLED, HELD_FOR_CASE, QUARANTINED or PAUSED emits `PayoutOutcome` (§4).

**T5 release conditions** (exactly one must hold):
1. **Never broadcast.** The flow stopped before SIGNED, or the signed bytes are provably unsent and destroyed, with their nonce reassigned or cancelled.
2. **Final failure.** A final `status = 0` receipt exists for one of the instruction's hashes.
3. **Nonce consumed by something else.** A different transaction we signed for the same nonce is final.

"Dropped", "not seen" or "timed out" never count (constants M-6).

**Send-time results of cancels and replacements (§5.4, §5.5, §5.6; contract R8 E3).** Every transaction sent from a later state, whether a same-nonce cancel or a same-nonce replacement, is persisted before it is sent. Its **own** send-time results follow the SIGNED rows of its flow (accepted; `-32014`/transient → resend the same bytes up to `A_broadcast`; underpriced or other → PAUSE; mixed → the severity order), with one exception:
- **A cancel rejected with `"Blocked address"` by every source → PAUSE** with `createCase CANCEL_BLOCKED`. The sending wallet itself is blocklisted, so nothing it signs can land, and the original bytes may still exist. Only a two-person resolution can then decide. The item stays where §5.0 can still match either hash: rule 1 for internal moves, rule 2 for payouts and case returns.
- A **replacement** rejected with `"Blocked address"` by every source → the cancel path of its flow's SIGNED row.
- **The signer refuses** a cancel or a replacement (for example it would exceed the signer's fee limits or daily cap, ADR-001 duty 3) → **PAUSE** with `createCase SIGNER_REFUSED`. The original bytes may still land, so nothing is released (CF-22).

The item stays in CANCELLING, RET_CANCELLING or BROADCAST while these sends are retried.

**Nonce drift in every state where signed bytes exist** (SIGNED, BROADCAST, CANCELLING, RET_SIGNED, RET_BROADCAST, RET_CANCELLING, and §5.6 SIGNED, BROADCAST, CANCELLING; contract R9 F4). The item's nonce is used on-chain:
- **by a hash we didn't sign** (DR-12) → **PAUSE**. **Drift cell**;
- **with no receipt for any of our hashes** for that nonce, including the cancel (Q-A1) → **PAUSE**. **Drift cell**.

Neither case settles or releases anything. These rows apply in addition to each state's own rows.

### 5.5 Case return (T9 from G5, T10 from G4)
- **Start.** `instructionId` is the case-return ID (§1.2), derived from the `RETURN` disposition's `caseId` and `dispositionSeq`, which the adapter records with the case return because T9/T10 cite them (§3). `R = returnAmount` and the destination are **from the disposition**; the adapter never chooses them. There is no hold and no G1 debit, because the funds were never the customer's available balance.
- **No hold, no standing check, no T5.** There's no customer debit, and returning ineligible customers' funds is exactly what this path is for. Every pre-finality failure therefore has the same compensation: **no journal; the item goes back to its source held state** (HELD_IN_CLEARING for G5, SUSPENSE for G4) with a case. Nothing has moved on-chain, so both identities stay at 0 and `heldAmount` is unchanged.
- The original dust stays in D (Q-C5). `PayoutOutcome` is emitted on every row marked †.

| State | Outcome | Action | Next |
|---|---|---|---|
| RETURNING (start) | — | screen `returnDestination` (`K.scr` with the case return's own subject `["out",instructionId]`, role `destination`, round `"0"`; each `RETURN` has its own case-return ID, so this is always a fresh round, §1.7) | RET_SCREENING |
| RET_SCREENING | CLEAR | `getTravelRuleOriginator` (bank as originator; Q-R9), submit to TR | RET_TRAVEL_RULE |
| RET_SCREENING | HIT or REVIEW | `createCase SCREENING_HIT` or `SCREENING_REVIEW` † | source held state |
| RET_TRAVEL_RULE | COMPLETE | `eth_call` simulation on own node(s) | RET_SIMULATING |
| RET_TRAVEL_RULE | incomplete | `createCase TRAVEL_RULE_INCOMPLETE` † | source held state |
| RET_SIMULATING | success | `requestApproval` | RET_AWAITING_APPROVAL |
| RET_SIMULATING | EVM revert | `createCase BLOCKLIST_PRECHECK` (reason recorded: revert) † | source held state |
| RET_SIMULATING | `-32603 "Blocked address"` (C-57) | `createCase BLOCKLIST_PRECHECK` † | source held state |
| RET_SIMULATING | other error | retry up to `H_retry`, then **PAUSE** | PAUSED |
| RET_AWAITING_APPROVAL | APPROVED, hash matches, maker ≠ checker, **and `payloadHashTR` unchanged** | assign nonce (single writer, ADR-003); the signer verifies and signs (signing log) | RET_SIGNED |
| RET_AWAITING_APPROVAL | APPROVED but `payloadHashTR` changed | `createCase TR_HASH_CHANGED` † `RETURN_FAILED` | source held state |
| RET_AWAITING_APPROVAL | REJECTED, or older than `A_approval` | `createCase APPROVAL_REJECTED` or `APPROVAL_EXPIRED` † `RETURN_FAILED` | source held state |
| RET_AWAITING_APPROVAL | hash mismatch or maker = checker | **PAUSE** (`APPROVAL_MISMATCH`) | PAUSED |
| RET_SIGNED | signer refuses | **PAUSE** | PAUSED |
| RET_SIGNED | at least one source accepts | — | RET_BROADCAST |
| RET_SIGNED | every source rejects with `"Blocked address"` | `createCase BLOCKLIST_PRECHECK`; sign a same-nonce zero-value self-send cancel | RET_CANCELLING |
| RET_SIGNED | every source rejects with `transaction underpriced`, or with another non-transient error | **PAUSE** | PAUSED |
| RET_SIGNED | `-32014`/transient from every source | resend the same bytes up to `A_broadcast` | RET_SIGNED |
| RET_SIGNED | mixed results, none accepted | the §5.4 severity order | as that row |
| RET_CANCELLING | the cancel is final | gas to F. `createCase CANCEL_FINAL` † `RETURN_FAILED` | source held state |
| RET_CANCELLING | the **original** is final with status 1 | as RET_BROADCAST status 1 below | as there |
| RET_CANCELLING | the **original** is final with status 0 | gas to F. `createCase BLOCKLIST_REVERT` † `RETURN_FAILED` | source held state |
| RET_CANCELLING | no receipt for either by `A_stuck` | **PAUSE** | PAUSED |
| RET_BROADCAST | final status 1 | Rout gains `R×k`. **T9 or T10** (Fact, `K.settle`), with `refs` = the case-return `instructionId`, the `RETURN` disposition's `caseId` and `dispositionSeq`, and this receipt's `txHash` (§3, `postJournal`; `BINDING_MISMATCH` → PAUSE). On OK: `heldAmount := heldAmount − R`, Rout loses it, `K.mon` † `RETURNED` if `heldAmount = 0`, otherwise `RETURNED_PARTIAL` | RETURNED (terminal) if `heldAmount = 0`, otherwise the source held state |
| RET_BROADCAST | final status 0 | gas to F, `createCase BLOCKLIST_REVERT` † `RETURN_FAILED` | source held state |
| RET_BROADCAST | no receipt by `T_pending` | SEQUENCES F4: rebroadcast or same-nonce replacement (same `to`, value and data). Cancel only on operator instruction | RET_BROADCAST, or RET_CANCELLING on cancel |
| RET_BROADCAST | nonce used, no receipt for our hashes; or nonce used by a hash we didn't sign | **PAUSE**. **Drift cells** | PAUSED |
| PAUSED | two-person resolution: `RESUME` (back to the paused-from state); `SETTLED` (proof of a status-1 receipt → T9/T10 with `attempt + 1` and that receipt's `txHash` in `refs`, then as RET_BROADCAST status 1); `RETURN_FAILED` (proof that nothing moved, or that the nonce went to our cancel → gas to F → source held state) | as chosen. Owner: on-call plus Ops lead | as chosen |

### 5.6 Internal move (gas top-up, sweep)
| State | Outcome | Action | Next |
|---|---|---|---|
| PROPOSED | policy ALLOW (or approved above threshold) | sign through the signer (ADR-001 duty 6 for moves below the threshold; signing log). X is a multiple of `k`. The policy engine's (U7) threshold is the same owner-signed value the signer holds its own copy of (ADR-001 duties 3 and 6). If the two differ, the signer refuses and the next row applies | SIGNED |
| PROPOSED | signer refuses | `createCase SIGNER_REFUSED` (nothing was signed); the refusal is also reported to the monitor | ABANDONED (terminal) |
| SIGNED | at least one source accepts | — | BROADCAST |
| SIGNED | every source rejects with `"Blocked address"` | `createCase BLOCKLIST_PRECHECK`; sign a same-nonce zero-value self-send cancel | CANCELLING |
| SIGNED | every source rejects with `transaction underpriced` or another non-transient error | **PAUSE** | PAUSED |
| SIGNED | `-32014`/transient from every source | resend the same bytes up to `A_broadcast` | SIGNED |
| SIGNED | mixed results, none accepted | the §5.4 severity order | as that row |
| CANCELLING | the cancel is final | gas to F. `createCase CANCEL_FINAL` | FAILED (terminal) |
| CANCELLING | the original move is final with status 1 | as BROADCAST status 1 below | POSTED |
| CANCELLING | the original move is final with status 0 | gas to F. `createCase BLOCKLIST_REVERT` | FAILED (terminal) |
| CANCELLING | no receipt for either by `A_stuck` | **PAUSE** | PAUSED |
| PROPOSED | DENY or older than `A_move` | none (never broadcast) | ABANDONED (terminal) |
| BROADCAST | final status 1 | Rmove gains X (per-role check only). T6 (Fact). `K.mon` | POSTED (terminal) |
| BROADCAST | final status 0 | gas to F. `createCase BLOCKLIST_REVERT` | FAILED (terminal) |
| BROADCAST | no receipt by `T_pending` | F4: rebroadcast or same-nonce replacement. Cancel only on operator instruction | BROADCAST |
| BROADCAST | our same-nonce cancel is final | gas to F. No T6 (nothing moved) | FAILED (terminal) |
| BROADCAST | nonce used, no receipt for our hashes; or nonce used by a hash we didn't sign | **PAUSE**. **Drift cells** | PAUSED |
| PAUSED | two-person resolution: `RESUME`, `POSTED` (proof of status 1 → T6 with `attempt + 1`) or `FAILED` (proof the nonce went to our cancel) | as chosen | as chosen |

### 5.7 Accumulators and the reconciliation identity
- **Dust:** `D[walletRole]` gains `W mod k` at the detection commit, per **receiving** wallet. When `D[r] ≥ k`, a dust batch posts `⌊D[r]/k⌋` (`K.dust`) and carries `D[r] mod k`. Items are listed per batch. Ownership: Q-C5.
- **Gas:** `F[walletRole]` gains `gasUsed × effectiveGasPrice` for every final receipt we paid for, status 0 included (C-25, C-53), per **paying** wallet. A gas batch posts when `F[r] ≥ k` (`K.gas`), floor and carry. Policy: Q-C5.

**Identity** (mandatory over `S` = all bank-controlled wallets; every term is a non-negative integer in wei, at an on-chain block cut-off and a CBS journal cut-off):
```
Σ chainBalanceWei(S, t) = CBS_G2(S, t)×k + D(S, t) − F(S, t) + Rin(S, t) − Rout(S, t)
```
- Rin: inbound items in DETECTED with `m > 0`.
- Rout: outbound and case-return items that are final with status 1 but whose T4/T9/T10 is not yet OK.
- Internal moves cancel out over S. A per-role diagnostic check adds `±Rmove`.
- Every term is **itemised**. The residual must be **exactly 0 wei**, otherwise PAUSE.

CBS side, at the same cut-off: `CBS_G2 + G3 = G1 + G4 + G5 + G6 + G7` (normal-side balances, opening balances 0). Each template moves both sides equally:

| Template | Effect |
|---|---|
| T1 | G2↑ G5↑ |
| T2 | G5↓ G1↑ |
| T3 fallback | G1↓ G5↑ |
| T4 | G1 or G5 ↓(A+fee), G2↓A, G6↑fee |
| T5 fallback | G5↓ G1↑ |
| T6 | within G2 |
| T8 | G5↓ G7↑ |
| T9 | G5↓ G2↓ |
| T10 | G4↓ G2↓ |
| T11 | G4↓ G1↑ |
| unid | G5↓ G4↑ |
| gas | G3↑ G2↓ |
| dust | G2↑ G4↑ |

Also checked:
- `G1 ≥ 0` per customer.
- `G7 ≥ cumulative G3`.
- **G5 itemisation:** the `gl.clearing.inbound` balance equals Σ `heldAmount` over **every non-terminal inbound item whose funds are in G5** (T1 OK and neither T2, T8 nor `unid` OK), **whatever its state, including PAUSED and QUARANTINED**. `heldAmount` drops only when T9 is OK. The `gl.clearing.outbound` balance equals Σ (A+fee) of fallback-mode outbound items not yet SETTLED or RELEASED, whatever their state.
- **G4.unidentified** equals Σ `heldAmount` over **every non-terminal item whose funds are in G4** (`unid` OK and neither T11 OK nor fully returned), **whatever its state, including PAUSED and QUARANTINED**. `heldAmount` drops only when T10 is OK.

Any failure → PAUSE. Itemisation is what catches a duplicated T2, T8 or T11 (RISK_REGISTER RR-4), which the two identities alone don't catch.

### 5.8 Maximum ages and owners (every non-terminal state)
Proposed values. **A human sets them at G1 (Q-C17).** "PAUSE" and "QUARANTINE" are as in §1.6.

| State or item | Max | On expiry |
|---|---|---|
| Inbound DETECTED (Rin) | `A_post` 15 min | PAUSE |
| Inbound RECEIVED, SCREENING | `A_decide` 15 min | QUARANTINE |
| Inbound/outbound AWAITING_SCREENING | **owner: Compliance** (case SLA) | case escalation, no auto-move |
| HELD_IN_CLEARING, SUSPENSE, HELD_FOR_CASE | **owner: Compliance** (case SLA) | case escalation, no auto-move |
| Outbound ACCEPTED | `A_reserve` 5 min | QUARANTINE |
| Outbound RESERVED, SCREENING, TRAVEL_RULE, SIMULATING | `A_checks` 30 min | T5 (condition 1), RELEASED |
| Outbound CANCELLING | `A_stuck` 30 min | PAUSE |
| Internal move BROADCAST without a final receipt | `T_pending` → F4. `A_stuck` 30 min | PAUSE |
| Internal move SIGNED (bytes exist, not accepted) | `A_broadcast` 1 min | PAUSE |
| Internal move CANCELLING | `A_stuck` 30 min | PAUSE |
| Inbound SUSPENSE_ASSIGNING | `A_decide` 15 min (Compliance owns it while a REVIEW is outstanding) | QUARANTINE |
| Case return RET_SCREENING, RET_TRAVEL_RULE, RET_SIMULATING | `A_checks` 30 min | `createCase PENDING_AGE` → source held state (nothing broadcast) |
| Case return RET_AWAITING_APPROVAL | `A_approval` 24 h | `createCase APPROVAL_EXPIRED` → source held state |
| Case return RET_SIGNED, RET_BROADCAST | as for outbound SIGNED and BROADCAST | as there (PAUSE) |
| Case return RET_CANCELLING | `A_stuck` 30 min | PAUSE |
| Entry labels that act immediately and never wait (`RETURNING (start)`, `RECEIVED→T2`) | none: an item can't wait there; its waiting is covered by the next state's row | — |
| Rail: no new block on two or more own nodes | `A_stall`: 30 s, as proposed in **Q-A7** (the owner decides) | PAUSE (§1.6) |
| PAUSED (item or rail) | **Owner: on-call plus Ops lead.** Two-person unpause with a recorded resolution | no automatic exit |
| QUARANTINED item | `A_quarantine` 4 h | PAUSE |
| Outbound AWAITING_APPROVAL | `A_approval` 24 h | T5 (condition 1), `createCase APPROVAL_EXPIRED`, RELEASED |
| Outbound APPROVED | `A_sign` 5 min | re-run the standing check. Past 2×`A_sign` → QUARANTINE |
| Outbound SIGNED (bytes exist, not broadcast) | `A_broadcast` 1 min | PAUSE |
| BROADCAST without a final receipt | `T_pending` → F4. `A_stuck` 30 min | PAUSE |
| Final status 1, settle not OK (Rout, Rmove) | `A_post` 15 min | PAUSE |
| Internal move PROPOSED | `A_move` 30 min | ABANDONED |
| D[r] or F[r] ≥ k without a batch | `A_batch` 24 h | PAUSE |
| Notification not yet OK (case, monitoring, report) | `A_notify` 1 h | PAUSE |
| `getAccountStanding.asOf` used for a decision | `A_standing` 60 s | treat as ineligible |
| QUARANTINE unresolved | `A_quarantine` 4 h | PAUSE |

---

## 6. Unit mapping (U1 is the only implementation)

| From → To | Rule | Exact? |
|---|---|---|
| `NATIVE_WEI` → `USDC_UNITS` | `u = ⌊w / 10¹²⌋`, remainder `w mod 10¹²` | Remainder is reported, never dropped (C-13, C-14) |
| `USDC_UNITS` → `NATIVE_WEI` | `w = u × 10¹²` | Exact |
| `NATIVE_WEI` → `CBS_MINOR(p)` | `m = ⌊w / k⌋`, remainder `w mod k` goes to dust | Remainder is reported |
| `CBS_MINOR(p)` → `NATIVE_WEI` | `w = m × k` | Exact. Outbound amounts are always built this way |
| any → display | Integer formatting only. Never show 18 dp to users (KICKOFF U11) | — |

**Overflow guard.** If `m > CBS_MAX` (the CBS integer max, Q-C4), the call is rejected and the adapter PAUSEs. Amounts are arbitrary-precision integers inside the adapter.

### 6.1 Worked examples (recomputed by exact integer division on 2026-10-02)

**`p = 6`, `k = 10¹²`**

| `w` (wei) | `m` (minor) | dust (wei) | Note |
|---|---|---|---|
| 0 | 0 | 0 | zero (and zero-value transfers emit no log, C-24) |
| 1 | 0 | 1 | smallest unit |
| 999,999,999,999 | 0 | 999,999,999,999 | `k − 1` |
| 1,000,000,000,000 | 1 | 0 | `k` |
| 1,000,000,000,000,000,000 | 1,000,000 | 0 | 1 USDC |
| 1,000,000,500,000,000,000 | 1,000,000 | 500,000,000,000 | 1.0000005 USDC |
| 420,000,000,000,000 | 420 | 0 | gas: 21,000 × 20 gwei (C-30, C-35) |
| 7,374,356,000,000,000 | 7,374 | 356,000,000,000 | gas from live testnet tx `0x0e8279a4fc99863c702f3b2d408e77897cf8076aa5caa1901e3f94ceaed24695` |
| 9,223,372,036,854,775,807,999,999,999,999 | 9,223,372,036,854,775,807 | 999,999,999,999 | largest `w` that fits a signed 64-bit `m` |

**`p = 2`, `k = 10¹⁶`**

| `w` (wei) | `m` | dust (wei) | Note |
|---|---|---|---|
| 1,000,000,000,000,000,000 | 100 | 0 | 1 USDC |
| 15,000,000,000,000,000 | 1 | 5,000,000,000,000,000 | 0.015 USDC |
| 9,999,999,999,999,999 | 0 | 9,999,999,999,999,999 | `k − 1` |
| 7,374,356,000,000,000 | 0 | 7,374,356,000,000,000 | the same gas fee accrues entirely in §5.7 |

**`NATIVE_WEI` ↔ `USDC_UNITS`**: 1,234,567,890,123,456,789 wei gives 1,234,567 units, remainder 890,123,456,789 wei. 1 unit = 1,000,000,000,000 wei.

**Signed 64-bit capacity by `p`:** `p = 18` → about 9.22 USDC (**unusable**) · `p = 6` → about 9.22 × 10¹² USDC · `p = 2` → about 9.22 × 10¹⁶ USDC (P2.3).

---

## 7. Open items this contract depends on
Q-A1, Q-A13, Q-A14, Q-C1, Q-C2, Q-C3, Q-C4, Q-C5, Q-C6, Q-C7, Q-C8, Q-C9, Q-C10, Q-C14, Q-C16, Q-C17, Q-R1, Q-R3, Q-R8, Q-D1, Q-D7, Q-D8, Q-R9, Q-R10, Q-C18, **Q-C19** (CBS account binding), **Q-A7** (stall threshold).

**Port-requirement coverage:**
- P1.1–P1.7 → §1.3–§1.5, `postJournal`, `getResultByKey`
- P2 → §1.1, §6
- P3 → §5.4, hold operations. Deliberately stricter than P3.4 (`placeHold` note)
- P4 → §2
- P5.1 → outbox
- P5.2 → §4
- P5.3 → `replayEvents`
- P6.1–P6.5 → §5.2 coverage matrix, `screen`, `submitMonitoringEvent`, `getAccountStanding`, `createCase`
- P6.6 → `fileReportData`
- P6.7 → `getTravelRuleOriginator`
- P7 → `requestApproval`/`getApproval`, §1.3
- P8.1–P8.3 → outside this contract (ADR at G1)
- P8.4 → `callId`
- P9 → §1.2
- P10 → `getBalancesAsOf`, `listJournals`, §5.7
- P11 → §1.4, §5.8
