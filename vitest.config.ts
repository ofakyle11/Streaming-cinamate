import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', 'e2e/**'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/state/**'],
      exclude: ['**/*.test.*', '**/__tests__/**'],
      reporter: ['text', 'text-summary', 'html'],
      thresholds: { lines: 70 },
    },
  },
});
