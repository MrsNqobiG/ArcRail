/**
 * U3-only vitest config, used by test/client.stryker.config.json so that
 * mutation testing of src/chain/client/ runs only the U3 tests (other units
 * are generated in parallel in the same tree). Not used by CI.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('..', import.meta.url)),
    include: ['test/unit/client*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
