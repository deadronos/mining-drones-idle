import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
  },
  webServer: {
    // Build the app and run a static preview server so tests run against
    // the production build. This avoids dev-server race conditions.
    command: 'npm run build && npm run preview -- --port 5174',
    port: 5174,
    // Always start the preview server for tests to ensure a consistent
    // environment.
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
