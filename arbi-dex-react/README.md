# ArbiDex React — прототип фронтенда

Прототип нового фронтенда платформы автоторговли (арбитраж DEX/CEX) на **React +
Redux Toolkit**. API не подключён — все данные **замоканы**, но все интерфейсы
рабочие: авторизация, дашборд ботов, конфигурации рынков и стратегий, бэктест,
торговля в реальном времени (демо/реальный), авто-подбор коэффициентов.

## Стек
React 18 · Redux Toolkit · React Router 6 · MUI 6 (тёмная тема) ·
lightweight-charts · Vite · Storybook 8 + test-runner (play-функции как автотесты).

## Запуск
```bash
npm install
npm run dev              # приложение (Vite) → http://localhost:5273
npm run storybook        # Storybook → http://localhost:6007
npm run test:sb          # автотесты интерфейса (play-функции, headless chromium)
npm run build            # прод-сборка
```
Вход: на экране логина нажать «Подключить кошелёк» (мок — сразу авторизует/регистрирует).

## Структура
```
src/
  domain/        типы + каталог условий (зеркало arbi-conditions-libs с UI-мета и диапазонами авто-подбора)
  mocks/         генераторы (детерминированный rng, серии котировок, симулятор бэктеста, авто-подбор), seed-данные
  api/           in-memory БД + async-фасад (эмуляция сети)
  store/         RTK-слайсы: auth, bots, marketConfigs, strategyConfigs, catalog, trading, ui
  components/    общие: PageHeader, StatCard, StatusBadge, PnlValue, chart/(QuoteChart, QuoteChartPanel)
  app/           AppShell, RequireAuth (guard), AppRoutes
  features/
    auth/          логин по кошельку
    dashboard/     список ботов
    marketConfigs/ список + конструктор конфигурации рынков (наблюдаемые → средневзвешенная, торговый → buy/sell)
    strategies/    список + редактор стратегии (условия + коэффициенты + диапазоны авто-подбора)
    bots/          детали бота: Обзор / Бэктест / Реальное время / Авто-подбор, мастер добавления
```

## Реализованные фичи (по ТЗ)
1. Авторизация по кошельку (первый вход = регистрация) — `features/auth`.
2. Дашборд со списком запущенных ботов — `features/dashboard`.
3. Просмотр конфигурации бота (рынки + стратегия) — `bots/OverviewTab`.
4. Конструктор конфигурации рынков + графики (historical/realtime) с приведением к средневзвешенной, линии покупки/продажи торгового рынка — `marketConfigs`.
5. Конфигурация стратегий: секции покупки/продажи, условия из каталога с коэффициентами — `strategies`.
6. Добавление бота: связывание конфигурации рынков со стратегией — `bots/AddBotPage`.
7. Торговля: демо/реальный в реальном времени + исторический бэктест с маркерами сделок — `bots/LiveTab`, `bots/BacktestTab`.
8. Авто-подбор коэффициентов по диапазонам из конфига условий — `bots/AutotuneTab`.

## Подключение к бэкенду (live-режим)
По умолчанию приложение работает на моках. Для реального бэкенда (`arbi-dex-server`)
задайте `VITE_API_BASE_URL` — тогда включается live-режим (см. `src/api/`):
- HTTP-клиент с JWT (`Authorization: Bearer`) и refresh на 401, хранилище токенов в `localStorage['arbidex_auth']`.
- Авторизация по кошельку двумя способами (экран логина в live-режиме):
  - **MetaMask** — реальная подпись через `window.ethereum` (`eth_requestAccounts` + `personal_sign`); кнопка активна, если расширение обнаружено.
  - **Dev-вход** — подпись детерминированным тестовым ключом (ethers), работает headless и в автотестах (как в `e2e/make-auth-state.mjs`).
  Выбор метода — `connectWallet('metamask' | 'dev')`; без аргумента: MetaMask при наличии, иначе dev.
- Ответы сервера совпадают по форме с доменными типами → live-слой без маппинга.

Бэкенд расширен под модель нового фронта (модули `market-configs`, `strategy-configs`,
`bots` + `conditions-catalog`, `/catalog/markets`); демосчёт = баланс бота, обновляется бэктестом.

```bash
# стек: Postgres :5433 (docker) + сервер :3006 + фронт в live-режиме
docker compose up -d postgres                              # из корня монорепо
cd arbi-dex-server && npm run start:dev                    # :3006/api
cd arbi-dex-react  && npm run dev:live                     # http://localhost:5273 (live)

npm run test:live   # Node-смоук: реальный клиент ↔ сервер (полный демо-поток)
npm run e2e         # Playwright: реальный фронт в live-режиме против сервера
```

## Автотесты
Каждая фича покрыта play-функциями в `*.stories.tsx`; `npm run test:sb` прогоняет их в
headless-chromium (критерий приёмки шагов). Прогресс по шагам — в `PROGRESS.md`, план — `PLAN.md`.
