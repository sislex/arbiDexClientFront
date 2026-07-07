# ArbiDex — Архитектура и гид для разработки

Живой документ для продолжения работы над фичами. Описывает монорепозиторий,
доменную модель, общий движок стратегии, бэкенд, фронтенд, сквозные потоки
данных, а также известные пробелы и рецепты добавления фич.

> Связанные документы: `arbi-conditions-libs/README.md` (API движка),
> `arbi-conditions-libs/docs/engine-algorithm.html` (блок-схемы алгоритма),
> `arbi-dex/e2e/README.md` (e2e-прогон стека).

---

## Содержание
1. [Что это за продукт](#1-что-это-за-продукт)
2. [Монорепозиторий](#2-монорепозиторий)
3. [Доменный глоссарий](#3-доменный-глоссарий)
4. [Общий движок — `arbi-conditions-libs`](#4-общий-движок--arbi-conditions-libs)
5. [Бэкенд — `arbi-dex-server`](#5-бэкенд--arbi-dex-server)
6. [Фронтенд — `arbi-dex`](#6-фронтенд--arbi-dex)
7. [Сквозные потоки данных](#7-сквозные-потоки-данных)
8. [Рабочий процесс и команды](#8-рабочий-процесс-и-команды)
9. [Известные пробелы и несогласованности](#9-известные-пробелы-и-несогласованности)
10. [Рецепты добавления фич](#10-рецепты-добавления-фич)
11. [Дорожная карта](#11-дорожная-карта)

---

## 1. Что это за продукт

ArbiDex — инструмент для настройки и проверки стратегий **арбитражной автоторговли**.
Пользователь выбирает **торговый рынок** (DEX, где реально покупает/продаёт) и набор
**референс-рынков** (обычно CEX, за которыми наблюдает как за «справедливой» ценой).
Движок на каждом шаге сравнивает цену торгового рынка с наблюдаемой средней по
референсам и решает: покупать, продавать или ждать.

Три режима работы над конфигом:
- **historical** — статичный график цен;
- **playback** — воспроизведение истории (клиентское) или серверный **бэктест** (PnL, сделки, аналитика);
- **live** — реальные котировки по WebSocket + реальное исполнение сделок on-chain.

---

## 2. Монорепозиторий

Корень: `arbi-dex-workspace` (private, npm workspaces). Три пакета:

| Пакет | Что | Стек |
|---|---|---|
| `arbi-conditions-libs` | Общий чистый TS: движок условий/стратегии | TypeScript, tsup, vitest |
| `arbi-dex-server` | Бэкенд: конфиги, бэктест, исполнение | NestJS 11, TypeORM/Postgres, ethers |
| `arbi-dex` | Фронтенд SPA | Angular 19 (standalone), NgRx, ag-charts |

**Связывание.** Оба консьюмера зависят от `@sislex/arbi-conditions-libs` (`^0.1.0`).
Линкуется через **workspace-симлинк** в корневом `node_modules/@sislex/arbi-conditions-libs → ../../arbi-conditions-libs`.
Консьюмеры импортируют **собранный `dist/`** (не `src/`), поэтому перед типизацией/запуском
консьюмеров нужен собранный движок:

```bash
npm run build:libs      # собрать dist движка (tsup: esm+cjs+dts)
npm run dev:libs         # tsup --watch — держать dist свежим во время разработки
```

Корневые скрипты только делегируют в библиотеку; сквозного `test`/`build` по всем трём нет.
Корень содержит `docker-compose.yml`, `.mcp.json` (playwright MCP для e2e фронта), `.env`, `AGENTS.md`.

**Важно про резолюцию модулей.** Библиотека — ESM-пакет (`"type": "module"`), а сервер
собирается под `nodenext` (CommonJS-выход). Поэтому в `exports` библиотеки заданы типы
**отдельно** для `import` (`index.d.ts`) и `require` (`index.d.cts`) — иначе TS ругается
`TS1479`. Если увидишь эту ошибку у нового консьюмера — проверь `exports`/пересобери `dist`.

---

## 3. Доменный глоссарий

| Термин | Синонимы в коде | Значение |
|---|---|---|
| Наблюдаемая цена | `observedPrice`, `avgRefMid`, `avgObservedQuote` | Средняя `mid` по референс-рынкам (CEX). «Справедливая» цена. |
| Цена покупки | `buyPrice`, `tradingAsk`, `buyQuote` | Ask на торговом рынке (DEX): сколько платишь за базовый актив (WETH). |
| Цена продажи | `sellPrice`, `tradingBid`, `sellQuote` | Bid на торговом рынке: сколько получаешь при продаже. |
| Референс-рынки | `sources[]`, `referenceSubscriptionIds` | Подписки-наблюдатели (CEX). Дают только `avgRefMid`, против них не торгуют. |
| Торговый рынок | `tradingSubscription`, `tradingSubscriptionId` | Единственная площадка (DEX), где происходят покупки/продажи. |
| Позиция | `position`, `hasPosition`, `wethBalance>0` | Держим базовый актив (WETH) после покупки, ждём продажу. Баланс: USDC ⟷ WETH. |
| Спред | `spread` | `ask − bid` (и % от mid). Гейт исполнения: торгуем только при узком спреде. |
| Шаг | `MarketStep`, `tick`, `StepQuotes` | Момент времени с тремя котировками (+ опц. события транзакций, балансы). |

---

## 4. Общий движок — `arbi-conditions-libs`

**Это ядро всех будущих фич.** Чистый фреймворк-агностичный TypeScript, без зависимостей.
Публичный API — `src/index.ts`. Внутри две подсистемы.

### 4.1. `src/conditions/` — аналитические условия (простая подсистема)
Зеркалит `arbi-dex-server/.../conditions.config.json`. Типы условий:
`OBSERVED_ABOVE_BUY`, `OBSERVED_BELOW_SELL`, `SPREAD_WITHIN`. Функции
`evaluateCondition` / `evaluateConfig` / `allConditionsMet`. Порог `thresholdPct` в процентах.
Тесты — `src/conditions/evaluate.test.ts`.

### 4.2. `src/engine/` — движок стратегии (ядро)

**Оконная модель.** Вход — упорядоченный `MarketStep[]`; **последний элемент = текущий шаг**.
Условия, которым нужна история (последние N шагов, «транзакция в процессе»), читают
предыдущие шаги прямо из окна. `currentIndex` «замораживает» текущий шаг в другой точке
(`slice(0, currentIndex+1)`, шаги после — «будущее», игнорируются). Пустое окно → бросает.

**Условие — это `ConditionDef`:**
```ts
interface ConditionDef {
  id: ConditionId | (string & {});
  window(strategy, side): WindowRequirement;   // сколько истории надо
  evaluate(ctx, strategy, side): ConditionOutcome; // { passed, actual?, required? }
}
```
`EvalContext = { window, current, position }`. Реестр `CONDITIONS` — 6 встроенных **гейт-условий**
(все должны пройти, AND-агрегация → `transaction.buy/sell`):

| id | нужна история | проверка |
|---|---|---|
| `enabled` | — | `strategy[side].enabled` |
| `no_transaction_in_progress` | до последней транзакции (если требуется) | нет открытой tx в окне |
| `avg_observed_higher_for_last_steps` | последние N шагов | `pctDiff(avg, quote) ≥ percent` для каждого |
| `spread_ok` | — (текущий) | `pctDiff(buy, sell) ≤ maxSpread` |
| `transaction_delay_ok` | окно `minDelay` мс | `now − lastFinished > minDelay` |
| `balance_ok` | — (текущий) | `!require \|\| balance ≥ min` (buy→token1, sell→token2) |

Плюс реестр `TRIGGER_CONDITIONS` — 3 **позиционных sell-триггера** (читают `ctx.position`,
OR-агрегация → `transaction.forcedSell`):

| id | проверка |
|---|---|
| `stop_loss` | цена ≤ `entryPrice·(1 − stopLossPercent%)` |
| `trailing_take_profit` | откат от пика с момента `openedAt` ≥ `trailingPercent%` |
| `max_holding_time` | время в позиции с `openedAt` ≥ лимита |

**Три публичные функции:**
- **`processStep({ steps, strategy, currentIndex?, position?, conditions?, triggerConditions? })`** → `TradingConditionsStepResult`.
  Ядро: строит `ctx`, прогоняет гейт-условия для buy и sell (**AND** → `transaction.buy/sell`) и
  sell-триггеры (**OR** → `transaction.forcedSell`), возвращает разбор
  `condition.buy/sell[id] = {passed, actual, required}` + `meta`.
- **`prepareSteps({ steps, strategy, ... })`** → `ProcessStepParams`. Обрезает **всю историю**
  до минимального окна: берёт максимум требований `window()` по всем условиям
  (count / durationMs / toLastTransaction), `keepFrom = min(...)`, режет суффикс. Пайплайн:
  `processStep(prepareSteps({ steps: history, strategy }))`.
- **`processAllStepsAndRecordResults({ steps, strategy, position?, conditions?, triggerConditions?, onRecord? })`**
  → `{ records }`. Прогон всей истории растущим окном (текущий шаг = последний в окне),
  прокидывает `position`/`conditions`/`triggerConditions` в каждый `processStep`, запись
  `{ index, step, result }` на каждый шаг.

`evaluateSide(ctx, strategy, side, conditions=CONDITIONS)` — экспортированный примитив
(AND по стороне).

**Точки расширения** (ключевое для фич):
1. **Добавить условие** — написать `ConditionDef` и либо добавить в `CONDITIONS`, либо передать
   через параметр `conditions` в вызов (не трогая библиотеку). `window()` автоматически учтётся
   в `prepareSteps`.
2. **Позиция** — `position` читается sell-триггерами `stop_loss` / `trailing_take_profit` /
   `max_holding_time` (реестр `TRIGGER_CONDITIONS`); их результат OR-агрегируется в
   `transaction.forcedSell`. Свой триггер — добавить в `TRIGGER_CONDITIONS` или передать через
   параметр `triggerConditions`.

**Форма результата** `TradingConditionsStepResult`:
```ts
{ transaction: { buy, sell, forcedSell },
  condition: { buy: Record<ConditionId, {passed, actual?, required?}>, sell: {...} },
  meta: { lastStepTime, transactionInProgress, lastFinishedTransactionTime } }
```

**Сборка/тесты:** `tsup` (esm+cjs+dts), `vitest` (51 тест по `src/engine/` и `src/conditions/`),
`tsc --noEmit`. Публичный API (`src/index.ts`) реэкспортирует всё нужное для своих `ConditionDef`:
типы (вкл. `PositionState`, `ConditionId`), реестры `CONDITIONS` и `TRIGGER_CONDITIONS`, **и**
отдельные именованные условия (`spreadOkCondition`, `stopLossCondition`,
`trailingTakeProfitCondition`, `maxHoldingTimeCondition`, …).

---

## 5. Бэкенд — `arbi-dex-server`

NestJS 11, глобальный префикс `/api`, Swagger `/api/docs`, Postgres/TypeORM
(`synchronize: true`, миграций нет), Web3-аутентификация + JWT. По сути — слой
агрегации/прокси перед внешним сервисом `arbiDexMarketData` + CRUD конфигов + бэктест +
on-chain исполнение. tsconfig — `nodenext`.

### 5.1. Модули

| Модуль | Папка | Ответственность |
|---|---|---|
| Auth | `src/auth/` | Web3-логин (nonce→подпись→verify), JWT access/refresh, guard, `@CurrentUser()` |
| Users | `src/users/` | Сущность `User` (кошелёк) |
| Subscriptions | `src/subscriptions/` | CRUD подписок (`sourceId`+`pairId`) |
| Settings | `src/settings/` | UI-настройки пользователя |
| Catalog | `src/catalog/` | Каталог источников и пар (live из marketData + fallback в БД) |
| Prices | `src/prices/` | Загрузка/кэш исторических bid/ask серий; `market-data-keys.ts` |
| Quotes | `src/quotes/` | Снапшот bid/ask/mid/spread по всем парам |
| LiveChart | `src/live-chart/` | Socket.IO-шлюз `/live-chart` (релей upstream → клиенту) |
| **ArbiConfigs** | `src/arbi-configs/` | Ядро домена: CRUD конфигов, цены, **два бэктеста**, аналитика |
| SwapExecution | `src/swap-execution/` | Реальное on-chain исполнение свопов (ethers, `ArbExecutor`) |
| MarketData | `src/market-data/` | Прокси метаданных пула (`bidPool`/`askPool` → dex/version/poolAddress) |

### 5.2. HTTP API (под `/api`, все под JWT кроме `auth`)

- **Auth:** `POST /auth/{nonce,verify,refresh}`.
- **ArbiConfigs:** `GET /arbi-configs`, `GET /arbi-configs/:id`, `POST /arbi-configs`,
  `PATCH /arbi-configs/:id`, `DELETE /arbi-configs/:id`,
  `GET /arbi-configs/:id/prices?noCache=`, `POST /arbi-configs/:id/backtest` (**старый** `BacktestEngine`),
  `POST /arbi-configs/:id/backtest-new` (**новый**, через движок `processStep` + поля автоторговли сущности).
- **Subscriptions / Settings / Catalog / Prices / Quotes / MarketData** — CRUD/чтение.
- **SwapExecution:** `POST /swap-execution/execute` — под `JwtAuthGuard` (`@ApiBearerAuth`).

### 5.3. Сущности (TypeORM)

- **ArbiConfig** (`arbi_configs`) — `name`, `tradingSubscriptionId` (торговый рынок),
  `profitAsset`, `initialBalance`, `slippage`, и поля автоторговли:
  `autoBuyThresholdPct`, `autoSellThresholdPct`, `trailingTakeProfitPct`, `stopLossPct`,
  `tradeAmountPct`; `sources: ArbiConfigSource[]` (референс-рынки, eager).
- **ArbiConfigSource** — связка config ↔ subscription (одна строка на референс).
- **Subscription** — `sourceId`+`pairId`+`enabled` пользователя.
- **User / UserSettings / Source / TradingPair** — вспомогательные.

Форма: конфиг = **1 торговая подписка** + **N референс-подписок**.

### 5.4. Бэктест-конвейер (`arbi-configs.service.ts`)

Общий шаг — **`buildBacktestTicks(pricesMap, tradingSubId, referenceSubIds)`**: объединяет
таймстампы, forward-fill, на каждый момент даёт
`BacktestTick { time, index, tradingBid, tradingAsk, avgRefMid }`.

Дальше — **две реализации**; обе используют поля автоторговли сущности и держатся близко
через parity-spec (`analytics/engine-backtest.parity.spec.ts`), но это два кодовых пути (см. §9):

- **`runBacktest`** (`/backtest`, старый) → `BacktestEngine` (`engine/backtest.engine.ts`).
  Покупка при `ask ≤ avgRefMid·(1−autoBuy%)`; в позиции приоритет stop-loss → trailing TP →
  arb-sell при `bid ≥ avgRefMid·(1+autoSell%)`; учитывает `slippage`, `tradeAmountPct`.
- **`runBacktestNew`** (`/backtest-new`, новый) → `runEngineBacktest` (`analytics/engine-backtest.ts`),
  **через общий движок**: строит `BacktestConfig` из полей сущности
  (autoBuy/autoSell/trailing/stopLoss/tradeAmount/slippage/initialBalance) →
  `buildStrategyFromConfig` + `buildGateConditions` → `processStep` с трекингом `PositionState`.
  Собирает `summary`, выборку «значимых» шагов (`STEP_SAMPLE_LIMIT=2000`), `ConditionStat`.

### 5.5. Слой аналитики (`src/arbi-configs/analytics/`)

- **`trade-analytics.helper.ts`** — `CONDITION_EVALUATORS` (формулы 3 типов),
  `evaluateConditions`, `decideAction(results, hasPosition)`, `StepQuotes`, `ConditionResult`,
  `StepAnalytics`, `ConditionStat`, `BacktestAnalyticsSummary`.
- **`conditions.config.json`** — 3 условия с порогами (копируется в `dist` через `nest-cli.json`).
- **`strategy-config.mapper.ts`** ← **мост к движку**: `buildStrategyFromConfig` (поля
  автоторговли `ArbiConfig` → `StrategyEngineConfig`) и `buildGateConditions`; используются
  `engine-backtest.ts`. (`PERMISSIVE_STRATEGY` в бэкенде больше не применяется.)
- **`engine-backtest.ts`** — `runEngineBacktest(ticks, BacktestConfig)`: симуляция на общем
  движке с `PositionState`, отдаёт `BacktestNewResult` (summary/steps/conditionStats).

### 5.6. Реальная торговля

Нет единого «real-trading» модуля; возможности разнесены:
- **SwapExecution** — фактическое исполнение: ethers `Wallet` + контракт `ArbExecutor`,
  preview через `executeSwaps.staticCall`, расчёт `amountOutMin` по slippage, отправка tx,
  метрики газа. Эндпоинт под `JwtAuthGuard`; использует серверный `PRIVATE_KEY`.
- **MarketData** — выбор пула (`GET /market-data/pool` → `{dex, version, poolAddress}`).
- **LiveChart** — WS-фид котировок для live-UI.

Серверного оркестратора «конфиг → live-исполнение» **нет** — цикл решений живёт на фронте.

---

## 6. Фронтенд — `arbi-dex`

Angular 19 (standalone-компоненты, без NgModules), NgRx (store+effects+entity) поверх
**facade**-паттерна, Angular Material, **ag-charts** для графиков, socket.io-client, ethers.
Базовый URL API — `API_BASE_URL` (InjectionToken, хардкод `http://localhost:3006/api`;
файла `environments/` нет). e2e — Playwright.

### 6.1. Маршруты (`app.routes.ts`)
`login` (public) и `''` под `AppShell`+`authGuard`: `dashboard`, `market`, `subscriptions[/:id]`,
`live-chart`, `profile`, `demo-account`, `arbi-configs`, `arbi-configs/new`,
`arbi-configs/:id/edit`, и **`arbi-configs/:id/{historical|playback|live}` → один
`ArbiConfigDetailPageComponent`** (режим по последнему сегменту URL).

### 6.2. Паттерн фичи (шаблон для новых)
`component → Facade → Store (actions/effects/reducer/selectors) → абстрактный service-интерфейс
→ HTTP-реализация` (биндинг `{ provide: IXxxService, useClass: XxxHttpService }` в `app.config.ts`).
- модели в `shared/models`, DTO в интерфейсе сервиса;
- триады `request/Success/Failure`; `@ngrx/entity` для коллекций;
- эффекты: `ofType → switchMap(service) → map(Success)/catchError(Failure)`; навигация — эффект `{dispatch:false}`;
- фасад: `readonly x$ = store.select(...)` + императивные методы; компонент знает только фасад.

Императивные (не-store) сервисы: сокеты, playback, swap-execution, market-data, движки.

### 6.3. Фича `arbi-configs` (главная)
- **Facade** — `all$/loading$/currentPrices$/backtestResult$/backtestLoading$/…`; методы
  `load/loadOne/create/update/delete/loadPrices/refreshPrices/runBacktest/runBacktestNew/clearBacktestResult`.
- **HTTP-сервис** — все эндпоинты `/arbi-configs*`; маппит серверный DTO в плоский клиентский `ArbiConfig`.
- **Store** — `@ngrx/entity` для списка + слайсы `currentPrices/backtestResult/backtestLoading/…`;
  эффекты создают/удаляют с навигацией; ⚠️ `runBacktest$` и `runBacktestNew$` шлют **один и тот же**
  `runBacktestSuccess`.
- **`engine/auto-trade.engine.ts`** — клиентский конечный автомат автоторговли (использует поля
  автоторговли конфига: autoBuy/autoSell/trailing/stop-loss). Питает уровни-аннотации на графике
  и решения в live/playback.
- **`services/multi-playback.service.ts`** — воспроизведение мультиподписочной истории (`tick$`/`state$`).

### 6.4. Ключевые страницы
- **`arbi-config-form-page`** — создание/редактирование (источники + секция автоторговли).
- **`arbi-config-detail-page`** (~2200 строк — хаб) — 3 режима (historical/playback/live),
  графики (`app-price-chart`: мультисерии, уровни, маркеры сделок), серверный бэктест
  (стат-карточки + таблица сделок), торговая секция (балансы, котировки, Auto-Trade toggle,
  ручной своп, **demo** vs **real on-chain**: `selectBestPool` пробует ask/bid-пулы preview’ом и
  исполняет лучший).
- **`demo-account-page`** (~1150 строк) — отдельная песочница симуляции.

### 6.5. e2e (`arbi-dex/e2e/`, Playwright)
`dev-up.sh`/`dev-down.sh` (postgres:5433 + backend:3006 + frontend:4200),
`make-auth-state.mjs` (программный Web3-логин → `storageState`), smoke по 8 роутам (скриншоты,
проверка что не редиректит на `/login`) + storybook-smoke. `.mcp.json` даёт playwright MCP.

---

## 7. Сквозные потоки данных

**Бэктест (серверный):**
```
ArbiConfig (+подписки)
  → PricesService.getPricesBySubscription (кэш 1ч)  → pricesMap
  → buildBacktestTicks  → BacktestTick[] {tradingBid, tradingAsk, avgRefMid}
  → per tick:  StepQuotes
      старый:  BacktestEngine (поля автоторговли сущности)  → trades
      новый:   runEngineBacktest → processStep (поля автоторговли сущности + PositionState)
               → transaction.buy / arb-sell / forcedSell  → trades
  → PnL, summary, выборка шагов  → BacktestResult / BacktestNewResult
  → фронт: стат-карточки + таблица сделок + график с маркерами
```

**Live / real-торговля (клиентская):**
```
LiveChart WS (котировки)  → AutoTradeEngine.tick (поля автоторговли)  → buy/sell/none
  demo:  DemoAccountFacade.swap (симуляция баланса)
  real:  MarketDataService.getPool → selectBestPool (preview execute:false)
         → SwapExecutionService.execute → on-chain tx (ArbExecutor)
```

---

## 8. Рабочий процесс и команды

```bash
# Библиотека (ядро)
npm run build:libs                         # собрать dist (нужно консьюмерам)
npm run dev:libs                            # tsup --watch
npm test  --workspace @sislex/arbi-conditions-libs      # vitest (27)
npx tsc --noEmit -p arbi-conditions-libs   # типизация

# Бэкенд
npm --workspace arbi-dex-server run start:dev   # nest watch (:3006)
npm --workspace arbi-dex-server run build        # nest build
npm --workspace arbi-dex-server test             # jest (ts-jest)

# Фронтенд
npm --workspace arbi-dex start              # ng serve (:4200)
npm --workspace arbi-dex run build          # ng build (prod)
npm --workspace arbi-dex test               # karma/jasmine

# Полный стек для e2e/скриншотов
arbi-dex/e2e/dev-up.sh    # postgres:5433 + backend:3006 + frontend:4200
```

> При правках движка сначала `build:libs` (или держи `dev:libs`), иначе консьюмеры увидят старый `dist`.

---

## 9. Известные пробелы и несогласованности

> Актуализировано 2026-07-07 после фаз рефакторинга 1–8. Ниже — то, что **действительно
> открыто** в текущем коде; закрытые ранее пункты убраны (см. историю в git и §11).

**Движок (`arbi-conditions-libs`):** открытых пробелов из прежних ревизий не осталось —
позиционные триггеры (`stop_loss` / `trailing_take_profit` / `max_holding_time`) реализованы как
`ConditionDef` в `TRIGGER_CONDITIONS`, именованные условия реэкспортированы из `index.ts`,
`src/conditions/` покрыт тестами, `processAllStepsAndRecordResults` — на объектных параметрах.

**Бэкенд:**
- **Два кодовых пути бэктеста** сосуществуют: `/backtest` → `BacktestEngine`, `/backtest-new` →
  общий движок. Обе реализации читают поля автоторговли сущности, сходимость держит
  parity-spec — но это дублирование логики (цель дорожной карты — свести к одному движку).
- **Нет серверного оркестратора live-торговли** — цикл решений живёт на фронте.

**Фронтенд:**
- **Аналитика `backtest-new` не рендерится** — оба эффекта (`runBacktest$`, `runBacktestNew$`)
  шлют один `runBacktestSuccess`, редьюсер и detail-page типизированы `BacktestResult`, поэтому
  поля `summary` / `steps` / `conditionStats` молча теряются (данные с бэка приходят — см. §10.4).
- **`tradeAmountPct` — рассинхрон подписи**: detail-page корректно трактует как % баланса
  (`computeTradeAmount`), но форма `arbi-config-form-page` подписывает поле «абсолютная сумма,
  USDC» при `max="100"`. Нужно поправить лейбл/подсказку формы.
- Нет `environments/` — `API_BASE_URL` захардкожен в `core/config/api.config.ts` (за DI-токеном).
- Мелочи: неиспользуемый `quotes/services/quotes-mock.service.ts` (импорт закомментирован в
  `app.config.ts`); дублирование `referenceSubscriptionIds` + `sources[]` в модели `ArbiConfig`.

---

## 10. Рецепты добавления фич

### 10.1. Новое условие в движке (шаблон; готовые примеры — `stopLoss.ts` / `trailingTakeProfit.ts` / `maxHoldingTime.ts`)
```ts
// arbi-conditions-libs/src/engine/conditions/stopLoss.ts
export const stopLossCondition: ConditionDef = {
  id: 'stop_loss',
  window: () => ({}),                       // хватает текущего шага
  evaluate: (ctx, strategy, side) => {
    if (side !== 'sell' || !ctx.position) return { passed: false };
    const stop = ctx.position.entryPrice * (1 - strategy.sell.stopLossPercent / 100);
    const price = ctx.current.quotes.avgObservedQuote;
    return { passed: price <= stop, actual: price, required: stop };
  },
};
```
Гейт-условие — добавить в `CONDITIONS` (глобально) **или** передать через `conditions` (локально);
sell-триггер — в `TRIGGER_CONDITIONS` **или** через `triggerConditions` (OR → `transaction.forcedSell`).
Обновить `ConditionId`, тесты, README. Позиционные условия требуют, чтобы вызывающий **вёл**
`position` (см. 10.3).

### 10.2. Серверный бэктест на реальной стратегии сущности (сделано — как устроено)
`runBacktestNew` уже считает реальную стратегию через `runEngineBacktest` (`analytics/engine-backtest.ts`):
1. `buildStrategyFromConfig(ArbiConfig)` → `StrategyEngineConfig` (autoBuy/autoSell/… → buy/sell).
2. `buildGateConditions` (гейты) + `TRIGGER_CONDITIONS` (stop-loss / trailing / max-holding).
3. Цикл ведёт `PositionState` (entryPrice/openedAt) и прокидывает в `processStep`.
Шаблон для следующего движкового условия — §10.1.

### 10.3. Ведение позиции вокруг `processStep`
Движок только **читает** `position` и сообщает, какие условия прошли — он **не решает** buy/sell
и **не обновляет** позицию. Слой выше: по `transaction.buy/sell` + текущей позиции открывает/закрывает
и обновляет `PositionState` (entryPrice = цена входа, openedAt = time шага).

### 10.4. Отрисовать аналитику `backtest-new` на фронте
Развести `runBacktestSuccess` на два экшена (или расширить payload до `BacktestNewResult`),
типизировать `backtestResult` как union, добавить рендер `summary`/`conditionStats`/`steps`
(данные уже приходят с бэка).

### 10.5. Новая фича-модуль на фронте
Следовать §6.2: `store/ + facades/ + services/ (interface + http)`, зарегистрировать редьюсер+эффекты
и биндинг сервиса в `app.config.ts`, модели в `shared/models`.

---

## 11. Дорожная карта

Логический порядок следующих шагов (по возрастанию связности). ✅ — уже сделано (фазы 1–8).

1. ✅ **Позиционные условия в движке** — stop-loss / trailing / max-holding как `ConditionDef`,
   потребляющие `ctx.position` (`TRIGGER_CONDITIONS`).
2. ✅ **`StrategyEngineConfig` из сущности** — `buildStrategyFromConfig`, `runBacktestNew` считает
   реальную стратегию (§10.2).
3. **Единый бэктест** — свести `/backtest` и `/backtest-new` к одному движку (сейчас держатся
   parity-spec’ом, но это два кодовых пути).
4. **Рендер аналитики бэктеста** на фронте (§10.4) — данные уже есть, UI нет.
5. **Оркестратор live-торговли** — перенести цикл решений (сейчас на фронте) в общий движок,
   единый источник правды для demo/backtest/live.
6. **Гигиена (частично сделано)** — ✅ `swap-execution` под guard, ✅ Swagger `backtest-new`,
   ✅ тесты `src/conditions/`; осталось: `environments/` на фронте, лейбл `tradeAmountPct` в форме.
```
