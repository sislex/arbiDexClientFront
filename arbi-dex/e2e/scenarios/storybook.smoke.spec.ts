import { test } from '@playwright/test';

/**
 * Smoke-проверка компонентов в Storybook (порт 6006).
 * Открываем каждую историю в изолированном iframe и делаем скриншот.
 *
 * id истории = lowercase(title) с заменой '/' и пробелов на '-', плюс '--<export>'.
 * Напр. title 'UI/StatCard' + export Default → 'ui-statcard--default'.
 *
 * Запусти Storybook отдельно:  npm run storybook   (из arbi-dex/)
 * Скриншоты: arbi-dex/e2e/screenshots/story-<id>.png
 */
const STORYBOOK = process.env.E2E_STORYBOOK_URL ?? 'http://localhost:6006';

const STORIES = [
  'ui-statcard--default',
  'ui-statusbadge--default',
  'ui-pageheader--default',
  'ui-subscriptionstable--default',
];

for (const id of STORIES) {
  test(`story: ${id}`, async ({ page }) => {
    await page.goto(`${STORYBOOK}/iframe.html?id=${id}&viewMode=story`, {
      waitUntil: 'load',
    });
    // ждём, пока Storybook отрендерит корень истории
    await page.waitForSelector('#storybook-root, #root', { timeout: 15_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `e2e/screenshots/story-${id}.png` });
  });
}
