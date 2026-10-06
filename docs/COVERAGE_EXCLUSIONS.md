# COVERAGE_EXCLUSIONS: branches excluded from MC-07

RUBRIC MC-07 requires 100% of **reachable** branches covered in the money-path modules (docs/MONEY_PATH.md). The coverage stage in `scripts/ci.sh` (`npx vitest run --coverage`, thresholds in `vitest.config.ts`) enforces 100% lines, branches, functions and statements, per file, on exactly the listed paths.

A branch may be excluded only if **all** of these hold (RUBRIC Probe F, Patch 2):
1. it is a compiler-proven exhaustiveness guard (for example an `assertNever` default that TypeScript proves unreachable);
2. it is listed in the table below with file:line and reason;
3. the verifier recounts it.

The exclusion in source is a `/* v8 ignore next */` (or `start`/`stop`) comment on exactly that guard. A source ignore comment with no row here is a defect. So is a row with no ignore comment in the source. Changing how this exit bar is measured needs explicit human acknowledgement at G1 (RUBRIC Probe F).

| File:line | Guard | Why the compiler proves it unreachable | Added by (LEDGER entry) |
|---|---|---|---|

No exclusions yet.
