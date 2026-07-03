/**
 * Генератор Playwright storageState с уже выполненной авторизацией.
 *
 * Вход в ArbiDex — через подпись Web3-кошелька, поэтому в браузере без
 * расширения MetaMask залогиниться нельзя. Этот скрипт делает то же самое
 * программно через ethers:
 *   1. POST /api/auth/nonce  (бэкенд создаёт пользователя на лету)
 *   2. подписываем "Войти в ArbiDex\nNonce: <nonce>" тестовым ключом
 *   3. POST /api/auth/verify → JWT-токены
 *   4. кладём объект authResult в localStorage под ключом 'arbidex_auth'
 *      (тот же формат, что пишет фронтенд в auth.effects.ts)
 *
 * Результат — файл .auth/state.json в формате Playwright storageState.
 * Его подхватывают и сценарии (playwright.config.ts), и Playwright MCP
 * (флаг --storage-state в .mcp.json).
 *
 * Переменные окружения (все опциональны):
 *   E2E_API_BASE_URL   — базовый URL API   (default http://localhost:3006/api)
 *   E2E_BASE_URL       — origin фронтенда   (default http://localhost:4200)
 *   E2E_PRIVATE_KEY    — фикс. приватный ключ (по умолчанию детерминированный тестовый)
 */
import { Wallet } from 'ethers';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '.auth/state.json');

const API = process.env.E2E_API_BASE_URL ?? 'http://localhost:3006/api';
const ORIGIN = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
// Детерминированный тестовый ключ — чтобы переиспользовать одного и того же
// dev-пользователя между прогонами. НЕ использовать с реальными средствами.
const PRIVATE_KEY =
  process.env.E2E_PRIVATE_KEY ??
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${url} → ${res.status} ${res.statusText}\n${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function main() {
  const wallet = new Wallet(PRIVATE_KEY);
  const address = wallet.address.toLowerCase();

  const { nonce } = await postJson(`${API}/auth/nonce`, { walletAddress: address });
  const signature = await wallet.signMessage(`Войти в ArbiDex\nNonce: ${nonce}`);
  const { accessToken, refreshToken, user } = await postJson(`${API}/auth/verify`, {
    walletAddress: address,
    signature,
    walletProvider: 'MetaMask',
  });

  // Та же структура, что фронтенд сохраняет в localStorage (auth.effects.ts)
  const authResult = {
    walletInfo: { address, provider: 'MetaMask' },
    accessToken,
    refreshToken,
    userId: user.id,
  };

  const state = {
    cookies: [],
    origins: [
      {
        origin: ORIGIN,
        localStorage: [{ name: 'arbidex_auth', value: JSON.stringify(authResult) }],
      },
    ],
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(state, null, 2));
  console.log(`✓ storageState готов для ${address}`);
  console.log(`  → ${OUT}`);
}

main().catch((err) => {
  console.error('✗ Не удалось получить auth state.');
  console.error('  Бэкенд (', API, ') и Postgres подняты? Запусти сначала ./dev-up.sh');
  console.error('  Причина:', err.message);
  process.exit(1);
});
