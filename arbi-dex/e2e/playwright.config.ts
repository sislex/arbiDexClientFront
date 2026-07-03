import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';

/**
 * Конфиг сценариев smoke-проверок ArbiDex.
 *
 * - использует системный Chrome (channel: 'chrome'), браузер качать не нужно;
 * - подхватывает авторизацию из e2e/.auth/state.json (см. make-auth-state.mjs);
 * - скриншоты сценарии пишут в e2e/screenshots.
 *
 * Запуск:  npm run e2e            (из arbi-dex/)
 *          предварительно подними стек:  e2e/dev-up.sh
 */
const E2E = __dirname;

export default defineConfig({
  testDir: join(E2E, 'scenarios'),
  outputDir: join(E2E, '.test-results'),
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: join(E2E, '.report'), open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    storageState: join(E2E, '.auth/state.json'),
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
