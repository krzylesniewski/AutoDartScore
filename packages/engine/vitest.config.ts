import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text'],
      // Zmierzone pokrycie zaokrąglone w dół do pełnego procentu. Spadek poniżej progu przerywa pnpm test.
      thresholds: {
        statements: 99,
        branches: 98,
        functions: 100,
        lines: 99,
      },
    },
  },
});
