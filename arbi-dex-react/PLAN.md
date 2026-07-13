# ArbiDex React — план прототипа нового фронтенда

## Цель
Прототип нового фронтенда на **React + Redux** для платформы автоторговли (боты, рынки,
стратегии, бэктест, автоподбор коэффициентов). API **не подключаем** — все данные
**замоканы**, но все интерфейсы должны быть рабочими на моках.

## Стек и обоснование
| Область | Выбор | Почему |
|---|---|---|
| Сборка | **Vite + React 18 + TypeScript** | быстрый dev/HMR, нативная связка со Storybook |
| Состояние | **Redux Toolkit** (slices + `createAsyncThunk`) | требование задачи (Redux); thunks эмулируют async API с задержкой |
| Роутинг | **React Router v6** | стандарт |
| UI-кит | **MUI (Material UI) v6, тёмная тема** | готовые таблицы/формы/диалоги/слайдеры (нужны для коэффициентов), быстрый качественный вид |
| Графики | **lightweight-charts (TradingView)** | серии buy/sell/avg, маркеры транзакций, линии покупки/продажи — профильный инструмент под котировки |
| Storybook | **Storybook 10 (react-vite)** + `@storybook/test` (play) + `@storybook/test-runner` | автотесты интерфейса = play-функции в сторис, прогон в headless как критерий приёмки |

**Расположение:** отдельный самодостаточный пакет `arbi-dex-react/` в корне монорепо
(свой `package.json` и `node_modules`, НЕ добавляется в корневые workspaces, чтобы не
трогать существующую установку Angular-фронта).

**Домен-модель условий** зеркалим из `arbi-conditions-libs` в локальный «каталог условий»
(`src/domain/conditionsCatalog.ts`) с UI-метаданными: подпись, единицы, дефолт, диапазон
для авто-подбора (фича 8). Это разъединяет прототип со сборкой библиотеки.

## Доменные сущности (из ARCHITECTURE.md / arbi-dex-server)
- **Bot** (≈ `ArbiConfig` + рантайм-статус): id, name, статус (running/stopped/paused),
  mode (demo-live / real-live / idle), marketConfigId, strategyConfigId, PnL, сделки, баланс.
- **MarketConfig**: торговый рынок (`tradingSubscription`) + наблюдаемые рынки (`sources`),
  флаг средневзвешенной. Рынок = source (биржа/DEX) + пара.
- **StrategyConfig**: buy-секция + sell-секция условий с коэффициентами (движок:
  `BuyTradingConditionsConfig` / `SellTradingConditionsConfig`) + диапазоны для авто-подбора.
- **Quotes / MarketStep**: `{ time, buyQuote, sellQuote, avgObservedQuote }` (+ события транзакций).
- **Subscription/Catalog**: список источников и пар (для выбора рынков).
- **User**: адрес кошелька, jwt (мок).

## Архитектура состояния (slices)
`auth`, `bots`, `marketConfigs`, `strategyConfigs`, `catalog` (источники/пары/каталог условий),
`quotes` (мок-серии + стриминг), `backtest`, `autotune`, `ui`.

## Общие компоненты
`AppShell` (sidebar+topbar), `StatusBadge`, `PnlValue`, `StatCard`, `QuoteChart`,
`MarketPicker`, `ConditionEditor`, `CoefficientField`, `RangeField`, `DataTable`,
`ConfirmDialog`, `ModeSwitch`.

## Шаги и критерии приёмки
Каждый шаг → сторис + play-тест(ы) + запись в `PROGRESS.md`. Шаг закрыт, когда
`npm run build`/typecheck зелёные и `npm run test:sb` (test-runner) по стори шага зелёный.

- **Step 0 — Scaffold.** Vite+React+TS, deps, MUI-тема, Storybook+test-runner. AC: build ok,
  storybook собирается, smoke-стори проходит test-runner.
- **Step 1 — Домен+моки+API+store.** Типы, детерминированные генераторы моков, fake-API
  (Promise+delay), store и slices. AC: typecheck зелёный, стори с таблицей моков рендерится.
- **Step 2 — Shell+routing+auth.** Логин по кошельку (мок connect → авто-регистрация), guard,
  sidebar-навигация. AC: play-тест «Connect wallet» → редирект на dashboard.
- **Step 3 — Dashboard.** Карточки ботов (статус/режим/PnL), клик → detail. AC: play-тест клика.
- **Step 4 — QuoteChart.** Серии + тумблер средневзвешенной + линии buy/sell + маркеры
  транзакций. AC: play-тест переключения средневзвешенной.
- **Step 5 — Market config builder.** Добавление/удаление наблюдаемых рынков + торгового,
  тумблер средневзвешенной, график historical/realtime. AC: play-тест добавления рынка.
- **Step 6 — Strategy config editor.** Секции buy/sell, условия из каталога с коэффициентами
  + диапазоны авто-подбора. AC: play-тест редактирования коэффициента.
- **Step 7 — Bot detail.** Просмотр конфигурации (рынки+стратегия) + карточки статистики +
  табы режимов. AC: стори табов и статистики.
- **Step 8 — Historical backtest (demo).** Прогон мок-бэктеста, график с маркерами сделок +
  таблица/статистика результата. AC: play-тест «Run» → маркеры + метрики.
- **Step 9 — Live/demo/real.** Мок-стриминг тиков, start/stop, тумблер demo/real. AC: play-тест
  start добавляет тики.
- **Step 10 — Add-bot wizard.** Связывание market-config + strategy-config → бот на dashboard.
  AC: play-тест мастера создаёт бота.
- **Step 11 — Auto-tuning.** Диапазоны коэффициентов → мок-свип → грид результатов по PnL,
  применить лучший. AC: play-тест «Run» → отсортированные результаты.
- **Step 12 — Polish.** Тема, весь test-runner зелёный, финализация PROGRESS.md.

## Команды
- `npm run dev` — dev-сервер
- `npm run build` — прод-сборка (tsc + vite)
- `npm run storybook` — Storybook dev
- `npm run build-storybook` — сборка Storybook
- `npm run test:sb` — прогон play-тестов (test-runner) — критерий приёмки шагов
