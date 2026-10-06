# ADR-003 Orchestration (durable execution)

**Status: PROPOSED. A human decides at G1.** KICKOFF: "reuse the CBS's workflow/saga mechanism if one exists; otherwise a durable-execution engine (e.g. Temporal, self-hosted). Prefer fewer new components."

## Context
- Outbound flows include waits of unbounded length: human approval (S2), case dispositions (F5), travel-rule data (F6). They also include retries with deadlines (F1) and nonce tracking that must survive crashes (F4).
- Exactly-once (I-ONCE) is achieved with a **transactional outbox/inbox** plus deterministic keys (CONTRACT §1.3). The orchestrator must not add a second source of truth for money state.
- The nonce must have a **single writer** per hot wallet (CLAUDE.md). **Who that writer is depends on ADR-001:** with option A (HSM self-custody) it is the adapter; with option B (custodian) it is the adapter only if the custodian accepts adapter-supplied nonces, otherwise the custodian is the single writer (Q-D7). The orchestration options below assume the adapter is the writer; under a custodian-owned nonce, the per-wallet lock guards submission order rather than nonce assignment.
- No CBS has been chosen (Q-C1), so we don't know whether a CBS saga engine exists.

## Options

| | A. CBS workflow/saga engine | B. Self-hosted durable-execution engine (e.g. Temporal) | C. Database state machine: outbox + persisted state per instruction + scheduler |
|---|---|---|---|
| New components | None (if it exists) | Engine cluster plus its persistence | None beyond the adapter's own DB |
| Unbounded waits | Depends on the CBS | Native | Rows in a waiting state plus inbox events (CONTRACT §4) |
| Single nonce writer (when the adapter is the writer, ADR-001 / Q-D7) | Hard: the nonce state would sit in the CBS | Needs a single workflow or lock per wallet | One DB row lock per wallet, in the same transaction as the outbox |
| Testability, deterministic fault injection (§6) | Vendor-dependent | Good (replay testing) | Good: a pure transition function, so property tests apply directly |
| Operational burden | The CBS team's | New cluster to run, patch and back up | Lowest |
| Risk of two sources of truth | Medium | Medium (workflow history next to our DB) | Low |

## Recommendation (for the human)
**C, a database-backed explicit state machine,** for the testnet and pilot phases. Each instruction is a row with a finite state set. Transitions are a pure, tested function. Effects go only through the outbox. The nonce is held under a per-wallet row lock. **A** should be re-assessed once the CBS is known (Q-C1) and kept only if the nonce and outbox can stay in the adapter. **B** only becomes worth it if the number of flow types grows well beyond S1–S5 and T9.

### Recommendation by phase
| Phase | Recommended |
|---|---|
| Testnet | **C** |
| Mainnet pilot | **C**, unless Q-C1 shows a CBS workflow engine that can keep the nonce and outbox inside the adapter (then re-assess A) |
| General availability | **C**. Re-assess **B** only if the number of flow types grows well beyond today's |

## Questions this ADR raises
- **Q-D4:** Which database does the bank run and support operationally? It must provide serialisable transactions, or row locking with a transactional outbox, and a **row-level read audit log that the application identity can't alter** (THREAT_MODEL DR-26, residual 9). The authoritative wording is the OPEN_QUESTIONS row.
- **Q-D7** (shared with ADR-001): under custodian custody, who assigns nonces? Can the adapter supply them?
