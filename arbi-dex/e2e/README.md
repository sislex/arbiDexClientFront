# e2e — обвязка для вайбкодинга (браузер + скриншоты)

Позволяет запускать приложение, водить браузер и снимать скриншоты — вручную
(через Playwright MCP, прямо в диалоге с Claude Code) и автоматически
(сценарии-смоуки). Вход через Web3-кошелёк обходится программной подписью.

## Состав

| Файл | Назначение |
|------|------------|
| `dev-up.sh` / `dev-down.sh` | поднять/остановить весь стек (postgres + backend + frontend) |
| `make-auth-state.mjs` | программный логин (ethers → JWT) → `.auth/state.json` |
| `playwright.config.ts` | конфиг сценариев (системный Chrome, авто-авторизация) |
| `scenarios/pages.smoke.spec.ts` | обход всех страниц + скриншоты |
| `scenarios/storybook.smoke.spec.ts` | скриншоты компонентов из Storybook |
| `.auth/state.json` | сгенерированный storageState (в .gitignore) |
| `screenshots/` | результаты (в .gitignore) |

Порты: frontend `4200`, backend `3006` (`/api`), postgres `5433`, Storybook `6006`.

## Быстрый старт

```bash
cd arbi-dex
npm run dev:up          # postgres → backend → frontend → авторизация
npm run e2e             # обход страниц, скриншоты в e2e/screenshots/
npm run e2e:report      # HTML-отчёт
npm run dev:down        # остановить (postgres остаётся; --with-db чтобы и его)
```

Storybook (отдельный процесс):
```bash
npm run storybook       # поднимет :6006
npm run e2e:storybook   # скриншоты историй
```

## Живое управление браузером (Playwright MCP)

В корне репозитория лежит `.mcp.json` с сервером `playwright`. Он стартует
системный Chrome и подхватывает авторизацию из `.auth/state.json`.

Порядок:
1. `npm run dev:up` (стек поднят, `.auth/state.json` создан);
2. **перезапустить Claude Code** — MCP-серверы подхватываются при старте;
3. дальше можно просить: «открой /arbi-configs и сделай скрин», «кликни …» —
   Claude управляет реальным браузером через инструменты `browser_*`.

> Если `.auth/state.json` пустой (заглушка) — браузер откроется без логина и
> любая защищённая страница перекинет на `/login`. Сначала `npm run dev:up`.

## Авторизация без кошелька — как это работает

`make-auth-state.mjs` повторяет флоу фронтенда программно:
`POST /auth/nonce` → подпись `"Войти в ArbiDex\nNonce: <nonce>"` тестовым
ключом → `POST /auth/verify` → JWT. Токены кладутся в `localStorage` под ключом
`arbidex_auth` (та же структура, что в `auth.effects.ts`). Бэкенд создаёт
пользователя на лету, поэтому отдельная регистрация не нужна.

Переопределяется через env: `E2E_API_BASE_URL`, `E2E_BASE_URL`,
`E2E_PRIVATE_KEY`, `E2E_STORYBOOK_URL`.

## Добавить свой сценарий

Положи `*.spec.ts` в `scenarios/`. Авторизация и `baseURL` уже подставляются
из конфига — пиши сразу `await page.goto('/market')`.
