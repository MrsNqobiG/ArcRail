/**
 * U9-only vitest config, used by test/signer.stryker.config.json so that
 * mutation testing of src/signer/index.ts runs only the U9 tests (other
 * units are generated in parallel in the same tree). Not used by CI.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('..', import.meta.url)),
    include: ['test/unit/signer*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
