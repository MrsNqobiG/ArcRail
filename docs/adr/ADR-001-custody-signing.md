# ADR-001 Custody and signing

**Status: PROPOSED. A human decides at G1.** KICKOFF §1: custody is `undecided`.

**Fix block 11** (LEDGER P1-adrs) was applied after `docs/verification/P1-adrs-lensR-14.md`. It is checked against THREAT_MODEL **v2 fix block 8** and ADR-008 **fix block 6**. This ADR is **ahead of THREAT_MODEL** on one point: the move-approval threshold as an artefact the signer trusts. T-T6 lists only Treasury's list and caps. This is routed as LEDGER **CF-36**. A detection gap is routed as **CF-37** to THREAT_MODEL DR-01 and ADR-008's move rule: no detection yet checks that a move above the threshold joins to an approval. That gap is not an "ahead" claim, because this ADR defines no detection. It **matches** OPEN_QUESTIONS Q-D1 (as amended by this fix block) and Q-D3.

## Context
- Every outbound movement needs a secp256k1 signature with EIP-155 chain ID 5042002 (C-56). Arc needs no special signing configuration: "No Arc-specific MPC protocol modifications are needed" (https://docs.arc.io/integrate/exchanges/custody.md, accessed 2026-10-02).
- THREAT_MODEL T-T1 and T-E2: the signer **must not trust the orchestrator**. Whichever option is chosen, the signing boundary must enforce six things itself:
  1. **Approval verification:** recompute `payloadHash` (CONTRACT §1.3) and verify the checker's FIDO2 `checkerAssertion`, whose WebAuthn challenge is the **32 raw bytes of `payloadDigest`** (CONTRACT §1.3), not the hex `payloadHash`, against credentials the signer holds (CONTRACT §3 `getApproval`, CF-1).
  2. **Shape allow-list (T-E5):** sign only EIP-1559 type-2 transactions with **empty `data`** (native value sends), whose `to` is bound as follows. The signer never takes a destination list from the orchestrator:
     - **payout or case return:** `to` and value must equal the destination and amount inside the approval verified under item 1. The checker's assertion is the authority. For a case return, the CBS disposition chose that destination and the checker approved it (CONTRACT §5.5). The per-merchant destination allow-list is a **policy** check owned by merchant onboarding in the CBS and applied by U7 before approval. It is not a signer duty (THREAT_MODEL residual 4);
     - **internal move:** `to` must be on the signer's own copy of Treasury's list (item 6);
     - **same-nonce cancel** (of a payout, case return or move): zero value, and `to` **equals the sending wallet**. The sender is on Treasury's list, or is a collection address the signer derives itself (ADR-006; the same derivation THREAT_MODEL DR-04 uses). That way a sweep from a collection wallet can be cancelled.

     **No Memo shape** is allowed until Q-P1/ADR-006 is decided. If it is allowed later, the exact form is the one in THREAT_MODEL T-E5: inner target USDC, `transfer` only, recipient and amount decoded and bound to `payloadHash`, `memoId` from the random-memo table. **Refuse** EIP-712 typed data (including EIP-3009 `transferWithAuthorization` and permits), `personal_sign`, EIP-7702 authorizations, `approve`/`permit` calldata and contract deployments.
  3. **Limits:** per-tx and daily **value** caps; **fee limits** on every signature, cancels and replacements included:
     - a ceiling on `maxPriorityFeePerGas`;
     - a ceiling on the worst-case fee `gasLimit × maxFeePerGas`. Arc's base fee is bounded (C-30 floor 20 gwei, C-31 maximum 20,000 gwei), but the priority fee is not;
     - every signature's worst-case fee counted against the daily cap.

     So the most a signature can debit is **value + gasLimit × maxFeePerGas**, and every cap bounds that total (ADRs R11 D1: a zero-value self-send with an unbounded tip would otherwise drain the hot wallet as fees). Also **chain ID pinned to 5042002**. The signer holds **its own copy** of every cap (here and in item 6) **and of the move-approval threshold (item 6)**, set by a named human owner (**Treasury, with Risk**) under the signer's change control. Caps and the threshold are **never taken from the orchestrator** or from the signing request. Residual 4 and RB-7 rely on the caps as the damage bound if the adapter is compromised. Item 6's checker rule relies on the threshold.
  4. **Replay rule:** a consumed-approval record, durable and shared across signer instances, so that a given `payloadDigest` is signed at most once, except for a same-nonce replacement or cancel of the same instruction (THREAT_MODEL T-T1, CF-5(g), RUBRIC MC-24). This is needed because `payloadDigest` deliberately excludes nonce and fees (CONTRACT §1.3).
  5. **Monitor attestation (ADR-008):** sign only while holding a valid, fresh `ALL_CLEAR` from the independent monitor, verified against the monitor's key in the signer's own trust store. A valid, fresh **`PAUSE` is accepted and immediately stops signing**, overriding any unexpired `ALL_CLEAR`. Attestations that are stale or out of sequence (sequence ≤ the highest seen) are **ignored**. With no valid `ALL_CLEAR` in force, the signer refuses.
  6. **Internal moves** (CONTRACT §5.6), **including same-nonce zero-value cancels:** every move needs a `to` on **the signer's own copy of Treasury's bank-owned wallet list** (DR-24), and every move counts against a **per-move cap** and a **daily move cap**. A move above the per-move cap is refused (it must be split). A move **at or below** the approval threshold needs no checker assertion; a move **strictly above** it needs one, as in item 1. The threshold is **the signer's own copy** (item 3), never a value the orchestrator or the request supplies, so a compromised orchestrator can't declare a large move to be "at or below" it. Cancels follow the cancel rule in item 2: zero value and `to` = the sender. They count against no **value** cap, but **their fees count against the daily cap and the fee limits of item 3**.
- **Signed configuration (THREAT_MODEL T-T6, CF-23).** The signer loads the configuration its duties depend on only when it is **signed by its bank owner and matches the pinned version**. That configuration is:
  - the checkers' FIDO2 credentials (item 1, Security);
  - its copy of Treasury's list (items 2 and 6);
  - every cap and fee limit, and the move-approval threshold (items 3 and 6, Treasury with Risk);
  - the monitor's attestation public key (item 5, Security).

  An unsigned or unexpected version → the signer refuses to sign (fail closed). The signer **reports the hash of each loaded version to the owners**, so each owner can re-attest it daily (the signer's input to T-T6's [X] check). With A, our policy engine does all three: it loads only a signed, pinned version, refuses otherwise and reports the hash. With B, the custodian must do all three, because only the custodian can report what its engine actually loaded (Q-D1, the clause after (g)).
- **Signing log** (CONTRACT §5.0, THREAT_MODEL DR-13, RISK_REGISTER 2c/3a/3b, RUBRIC MC-17). The signing boundary itself writes an append-only log of `(payloadHash, nonce, txHash, instructionId)` for every signature, and **pushes each entry to the independent monitor** (ADR-008), never through the orchestrator. `instructionId` is needed for the monitor's own classification (DR-01). With A, we build it inside the policy engine. With B, the custodian must provide an equivalent log keyed by our `payloadHash` (Q-D1(c)).
- **Single nonce writer** (CLAUDE.md, ADR-003). Exactly one component assigns nonces per wallet. With A it is the adapter. With B the adapter must be able to supply the nonce, **or** the custodian becomes the single writer and nothing else may sign for that wallet (Q-D7).
- THREAT_MODEL T-E2 and T-E3: the preventive controls are signer-side policy plus a small hot balance. RISK_REGISTER RR-3 maps the detections:
  - 3b (key theft or a signature outside the signer's logged flow): DR-12 and DR-13, which match every outflow to an instruction or move and a signing-log entry;
  - 3a (compromised orchestrator): DR-01, which **can't run until the CBS read operations in CF-5(f) exist** (RB-7).
- CLAUDE.md N2: no keys in this repo. All signing goes through the `Signer` interface (U9).
- Deposit addresses (ADR-006) may need many derived addresses. The custody choice decides whether that is cheap or expensive.

## Options

| | A. HSM self-custody (FIPS 140-3 Level 3) with an in-house policy engine | B. Regulated custodian with an on-prem co-signer | C. Hybrid: custodian for treasury/cold, HSM for a small hot wallet |
|---|---|---|---|
| Who holds keys | The bank, in its own HSMs | The custodian, with a bank co-signer share or device | Both |
| Policy engine | Built by us, running next to the HSM in a segmented VM with no inbound internet (§6) | The custodian's engine, configured by the bank | Custodian's for cold, ours for hot |
| Approval check (T-T1) and shape allow-list (T-E5) | Fully under our control | Depends on whether the custodian's policy engine can verify our FIDO2 assertion over `payloadDigest` **and** refuse non-transaction signatures (**unknown, Q-D1**) | Ours for hot |
| Nonce ownership | Adapter | Adapter-supplied or custodian-owned (Q-D7) | Split by wallet |
| Independent signing log (pushed to the monitor, with `instructionId`) | Built in our policy engine | Custodian-provided and pushed (Q-D1(c)) | Both |
| Monitor attestation (full protocol), internal-move rule for every move, and caps with the chain-ID pin | Built in our policy engine | Custodian policy engine must support them (Q-D1(d), Q-D1(f), Q-D1(g)) | Ours for hot |
| Data residency (§6, POPIA s72) | Stays in the bank | Depends on the custodian's hosting (Q-D2) | Mixed |
| Regulatory | The bank carries the full custody obligation | Custodian licensing must be checked (Q-R4) | Both |
| Effort to build | High (key ceremony, HSM integration, policy engine) | Medium (integration) | Highest |
| Many deposit addresses (ADR-006) | Cheap if the HSM supports HD derivation (Q-D3) | Depends on per-address fees and limits (Q-D2) | — |
| Key-compromise drill (G-M 5) | Ours to design and run | Shared with the custodian | Both |

## Trade-offs
- A gives the strongest control and residency, but the bank owns its full operational risk: the key ceremony, HSM lifecycle and the policy engine's correctness.
- B moves operational risk to the custodian, but adds vendor dependence and a possible cross-border data flow. It may also weaken T-T1 if the custodian can't verify our approval binding.
- C cuts the hot-wallet blast radius, but runs two systems.

## Recommendation (for the human to accept or reject)
**A, HSM self-custody,** *provided* the bank already runs FIPS 140-3 Level 3 HSMs with a key-ceremony practice. If it doesn't, **B**, provided **Q-D1 (a)–(g) are all answered yes**: assertion verification, shape allow-list, pushed signing log, monitor attestation, replay rule, the internal-move rule, and per-transaction/daily caps. **If neither A's precondition nor all of Q-D1 holds, the mainnet pilot is blocked** (see the phase table). Either way, the hot wallet balance is capped by policy (U7, U11), and the `Signer` interface in U9 stays the same so the choice can change later.

### Recommendation by phase
| Phase | Recommended |
|---|---|
| Testnet (Phases 2–5) | **Signer service with a throwaway key generated at test time inside the service** (CLAUDE.md N2; `MockSigner` in unit tests). Same `Signer` interface, same shape allow-list and assertion checks. Funding is Q-T2 |
| Mainnet pilot | **A** if the bank already runs FIPS 140-3 Level 3 HSMs with a key-ceremony practice, otherwise **B** if Q-D1 (a)–(g) are all yes. **If neither holds, the pilot is blocked** (G-M 5) |
| General availability | Same as the pilot, re-reviewed after the key-compromise drill |

## Questions this ADR raises
- **Q-D1** (the authoritative wording is the OPEN_QUESTIONS row; this is a summary, mapped clause by clause to the duties above). Can the custodian or HSM policy engine:
  - (a) verify a FIDO2 assertion whose challenge is our raw `payloadDigest` before signing (item 1);
  - (b) enforce the shape allow-list and the `to` binding, including decoding calldata nested inside a Memo call if that shape is ever enabled (item 2);
  - (c) provide an append-only signing log of `(payloadHash, nonce, txHash, instructionId)` **pushed to the independent monitor** (Signing log);
  - (d) **require the monitor's attestation with the full protocol** (item 5): a fresh `ALL_CLEAR` before signing; reject equal or lower sequence numbers; a valid `PAUSE` overrides an unexpired `ALL_CLEAR`; attestations arrive on a direct channel;
  - (e) enforce the **replay rule** (item 4);
  - (f) enforce the **internal-move rule** for every move, with the approval threshold taken from its own copy (item 6);
  - (g) enforce **per-transaction and daily caps and the chain-ID pin to 5042002** inside its own boundary (item 3);
  - (h) export an xpub for the dedicated, hardened collection-address branch (ADR-006; THREAT_MODEL DR-04, T-I2)?

  (a)–(g) cover the six duties and are **all required** for option B. For (a), (b), (d), (f) and (g), the OPEN_QUESTIONS row also asks for the signed configuration, including the hash report (Signed configuration above). (h) isn't a signing duty: if the answer is no, DR-04 can't run for collection addresses, and that becomes a G1 residual.
- **Q-D7:** Under option B, who assigns nonces? Can the adapter supply them?
- **Q-D2:** The custodian's hosting location, licensing and fee model.
- **Q-D3:** Does the HSM support BIP-32 derivation (`m/44'/60'/0'/0/x`, C-56) without exporting keys? Can it **export an xpub for only a dedicated, hardened collection-address branch** (ADR-006), so the independent monitor can derive collection addresses itself (THREAT_MODEL DR-04, T-I2)? The authoritative wording is the OPEN_QUESTIONS row.
