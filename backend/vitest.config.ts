import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // One-off scripts and the server entry point are exercised by deployment, not unit tests.
      exclude: ['src/scripts/**', 'src/server.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
