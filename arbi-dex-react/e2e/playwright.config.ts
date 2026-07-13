import { defineConfig, devices } from '@playwright/test';

/** E2E against the real backend: boots the React app in live mode
 * (VITE_API_BASE_URL) and drives it in Chromium. Requires arbi-dex-server +
 * Postgres running on :3006. */
export default defineConfig({
  testDir: './scenarios',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5399',
    trace: 'on-first-retry',
  },
  // Dedicated port + no reuse so we never attach to an unrelated dev server.
  webServer: {
    command: 'npm run dev:e2e',
    cwd: process.cwd(),
    url: 'http://localhost:5399',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
