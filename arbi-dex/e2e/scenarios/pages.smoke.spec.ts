import { test, expect } from '@playwright/test';

/**
 * Smoke-обход всех основных страниц приложения.
 * Для каждой: переходим, убеждаемся что НЕ выкинуло на /login (значит auth
 * из storageState подхватился), собираем ошибки консоли и делаем скриншот.
 *
 * Скриншоты: arbi-dex/e2e/screenshots/<page>.png
 */
const ROUTES: Array<[name: string, path: string]> = [
  ['dashboard', '/dashboard'],
  ['market', '/market'],
  ['subscriptions', '/subscriptions'],
  ['live-chart', '/live-chart'],
  ['profile', '/profile'],
  ['demo-account', '/demo-account'],
  ['arbi-configs', '/arbi-configs'],
  ['arbi-configs-new', '/arbi-configs/new'],
];

for (const [name, path] of ROUTES) {
  test(`страница: ${name}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    // networkidle не подходит — live-chart держит websocket. Ждём DOM + паузу.
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });

    // authGuard не должен был перекинуть на логин
    expect(page.url(), `${name}: редирект на /login — auth не подхватился`).not.toContain('/login');

    if (consoleErrors.length) {
      console.warn(`⚠ ${name}: ошибки в консоли:\n  - ${consoleErrors.join('\n  - ')}`);
    }
  });
}
