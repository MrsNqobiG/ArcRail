import { defineConfig } from 'vitest/config';
import { readMoneyPath } from './tools/money-path.mjs';

/** Money-path source paths, read from docs/MONEY_PATH.md (single source). */
const moneyPath = readMoneyPath(new URL('.', import.meta.url).pathname).paths;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
          testTimeout: 120_000,
        },
      },
      {
        test: {
          name: 'property',
          include: ['test/property/**/*.property.test.ts'],
          environment: 'node',
        },
      },
      {
        // CBS contract tests (KICKOFF Phase 2). Today: the port-vs-CONTRACT
        // diff. The in-memory CBS stub's behavioural tests join here later.
        test: {
          name: 'contract',
          include: ['test/contract/**/*.contract.test.ts'],
          environment: 'node',
          testTimeout: 120_000,
        },
      },
      {
        // Arc testnet E2E (read-only). Every suite is skipped unless ARC_E2E=1.
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.e2e.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
        },
      },
    ],
    // RUBRIC MC-07: 100% of reachable branches, per money-path file. Exclusions
    // only via docs/COVERAGE_EXCLUSIONS.md (compiler-proven guards).
    coverage: {
      provider: 'v8',
      include: [...moneyPath],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        perFile: true,
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
