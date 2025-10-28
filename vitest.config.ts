import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vitest configuration with Vite plugins and coverage using coverage-v8
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@triplex': path.resolve(__dirname, '.triplex'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    include: ['src/**/*.test.{ts,tsx}'],
    watch: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json'],
      // 'all' was removed from the typed Coverage options in newer Vitest
      // versions. Tests should rely on `include`/`exclude` to control files.
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: ['**/node_modules/**', 'test/**', 'src/**/*.test.{ts,tsx}'],
      // Use thresholds to enforce minimum coverage
      thresholds: {
        global: {
          lines: 80,
          statements: 80,
          branches: 70,
          functions: 75,
        },
      },
    },
  },
});
