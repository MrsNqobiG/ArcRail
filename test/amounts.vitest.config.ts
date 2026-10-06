/**
 * U1-only vitest config, used by test/amounts.stryker.config.json so that
 * mutation testing of src/amounts/index.ts runs only the U1 tests (other
 * units are generated in parallel in the same tree). Not used by CI.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('..', import.meta.url)),
    include: ['test/unit/amounts*.test.ts', 'test/property/amounts*.property.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
