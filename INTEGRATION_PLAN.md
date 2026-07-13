# План интеграции нового фронта (arbi-dex-react) с бэкендом

## Контекст
Старый фронт (Angular `arbi-dex`) подключён к NestJS `arbi-dex-server` так:
- База API: `http://localhost:3006/api` (глобальный префикс `/api`), CORS `*`.
- Авторизация по кошельку: `POST /auth/nonce` → подпись `Войти в ArbiDex\nNonce: <nonce>` →
  `POST /auth/verify` → `{accessToken, refreshToken, user}`; refresh `POST /auth/refresh`.
- JWT кладётся в `localStorage['arbidex_auth']`, шлётся заголовком `Authorization: Bearer` на все не-`/auth` запросы; на 401 — refresh, при неудаче logout.
- Данные: `arbi-configs` (CRUD, `/:id/prices`, `/:id/backtest[-new]`), `subscriptions`, `catalog`, `prices`, `quotes`, WS `/live-chart` (`priceUpdate`).

## Решения (согласовано с пользователем)
- **Модель:** расширяем бэкенд под модель нового фронта (раздельные market-config и
  strategy-config с каталогом условий и коэффициентами). Ответы сервера делаем
  **точно совпадающими** с типами фронта → live-слой почти без маппинга.
- **Авторизация:** dev-подпись тестовым ключом через ethers (headless-friendly,
  как в `e2e/make-auth-state.mjs`); MetaMask — опционально позже.
- **Скоуп сейчас:** демо-торговля, конфигурации, отображение графиков, демосчёт.

## Архитектура расширения бэкенда (NestJS, TypeORM `synchronize:true` в dev — таблицы создаются автоматически)
Новые модули (все под JWT, как остальные):
- `src/demo/engine/` — портированные чистые функции из прототипа: `quotes` (генератор серий),
  `simulate` (бэктест-симулятор), `autotune` (свип комбинаций), `conditionsCatalog`.
- `conditions-catalog`: `GET /conditions-catalog` → каталог условий (метаданные + диапазоны).
- `catalog` (расширение): `GET /catalog/markets` → `Market[]` из сид-справочника sources×pairs.
- `market-configs`: сущность + CRUD + `GET /:id/quotes?count=&interval=` (серия QuotePoint[]).
- `strategy-configs`: сущность (buy/sell jsonb) + CRUD.
- `bots`: сущность (демосчёт: balance/pnl/stats) + CRUD + `POST /:id/backtest`,
  `POST /:id/autotune`. Бэктест обновляет демосчёт бота.

Ответы `QuotePoint`, `BacktestResult`, `AutotuneResult`, `Bot`, `MarketConfig`, `StrategyConfig`
совпадают по форме с типами `arbi-dex-react/src/domain/types.ts`.

## Интеграция фронта (arbi-dex-react)
- `ethers` (dev-подпись). Конфиг через `import.meta.env.VITE_API_BASE_URL` (+ `VITE_DEV_WALLET_KEY`).
- `src/api/http.ts` — fetch-клиент: база, `Authorization: Bearer`, refresh на 401, хранилище
  токенов (`localStorage`, с memory-fallback для Node-тестов).
- `src/api/auth.ts` — dev-логин: nonce → подпись ethers → verify.
- `src/api/live.ts` — реализация того же фасада `api`, что и мок (auth/catalog/bots/
  marketConfigs/strategyConfigs/quotes/backtest/autotune) поверх HTTP.
- `src/api/index.ts` — выбор live/mock по наличию `VITE_API_BASE_URL`. Сигнатуры не меняются,
  store/thunks/скрины остаются как есть.
- Мок-режим остаётся дефолтом (Storybook play-тесты не ломаются).

## Тесты (критерии приёмки шагов)
- Бэкенд: Jest e2e (supertest) `test/demo.e2e-spec.ts` — login → CRUD market/strategy →
  create bot → backtest (trades>0, демосчёт обновлён) → autotune (ранжировано) → quotes.
- Фронт: Node live-smoke `scripts/live-smoke.mjs` — гоняет live-api-клиент против поднятого
  сервера (полный поток). Storybook play-тесты продолжают проходить в мок-режиме.
- E2E: Playwright — реальный React-фронт в live-режиме против сервера (login→конфиг→бот→бэктест).

## Запуск стека
```bash
docker compose up -d postgres                 # :5433
cd arbi-dex-server && npm run start:dev        # :3006/api
cd arbi-dex-react && VITE_API_BASE_URL=http://localhost:3006/api npm run dev
```

## Шаги
INT-1 demo-engine + conditions-catalog + /catalog/markets ·
INT-2 market-configs (+quotes) · INT-3 strategy-configs · INT-4 bots (+backtest/autotune, демосчёт) ·
INT-5 FE http+auth+facade · INT-6 FE configs live · INT-7 FE bots/charts/backtest/demo live ·
INT-8 e2e + финализация. Прогресс — в `INTEGRATION_PROGRESS.md`.
