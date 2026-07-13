import { test, expect } from '@playwright/test';

/** Drives the real React app in live mode against arbi-dex-server:
 * wallet login → create a strategy → verify it persists across reload. */
test('login, create a strategy, and persist it in the backend', async ({ page }) => {
  await page.goto('/');

  // Wallet login. Headless Chromium has no MetaMask → use the dev test-key button.
  await page.getByTestId('login-dev').click();
  await expect(page.getByRole('heading', { name: 'Дашборд' })).toBeVisible({ timeout: 20_000 });

  // Go to Strategies and create one with a unique name.
  const name = `E2E стратегия ${Date.now()}`;
  await page.getByText('Стратегии', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Стратегии' })).toBeVisible();
  await page.getByTestId('create-strategy').click();
  await page.getByTestId('strategy-name').fill(name);
  await page.getByTestId('save-strategy').click();

  // It appears in the list (written to the backend).
  await expect(page.getByText(name)).toBeVisible({ timeout: 20_000 });

  // Reload → session restored from storage; strategy still present (persisted
  // in the backend, reloaded from /strategies). Proves live wiring end-to-end.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Стратегии' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(name)).toBeVisible({ timeout: 20_000 });
});
