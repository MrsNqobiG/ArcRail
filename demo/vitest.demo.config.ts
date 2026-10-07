import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * DEMO ONLY, NOT REVIEWED. Runs demo/**\/*.demo.test.ts, which the main
 * vitest.config.ts, tsconfig.json, Stryker and scripts/ci.sh never include.
 * Run: npx vitest run -c demo/vitest.demo.config.ts
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    include: ['demo/**/*.demo.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
