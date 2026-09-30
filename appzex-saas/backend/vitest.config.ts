import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/setup/globalSetup.ts'],
    setupFiles: ['./tests/setup/loadTestEnv.ts'],
    // Suites share one seeded test database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
