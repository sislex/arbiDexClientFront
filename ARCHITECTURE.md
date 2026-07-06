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
Тестов нет.

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
`EvalContext = { window, current, position }`. Реестр `CONDITIONS` — 6 встроенных условий:

| id | нужна история | проверка |
|---|---|---|
| `enabled` | — | `strategy[side].enabled` |
| `no_transaction_in_progress` | до последней транзакции (если требуется) | нет открытой tx в окне |
| `avg_observed_higher_for_last_steps` | последние N шагов | `pctDiff(avg, quote) ≥ percent` для каждого |
| `spread_ok` | — (текущий) | `pctDiff(buy, sell) ≤ maxSpread` |
| `transaction_delay_ok` | окно `minDelay` мс | `now − lastFinished > minDelay` |
| `balance_ok` | — (текущий) | `!require \|\| balance ≥ min` (buy→token1, sell→token2) |

**Три публичные функции:**
- **`processStep({ steps, strategy, currentIndex?, position?, conditions? })`** → `TradingConditionsStepResult`.
  Ядро: строит `ctx`, прогоняет каждое условие для buy и sell, **AND**-агрегирует
  (`transaction.buy/sell`), возвращает разбор `condition.buy/sell[id] = {passed, actual, required}` + `meta`.
- **`prepareSteps({ steps, strategy, ... })`** → `ProcessStepParams`. Обрезает **всю историю**
  до минимального окна: берёт максимум требований `window()` по всем условиям
  (count / durationMs / toLastTransaction), `keepFrom = min(...)`, режет суффикс. Пайплайн:
  `processStep(prepareSteps({ steps: history, strategy }))`.
- **`processAllStepsAndRecordResults(steps, strategy, { onRecord? })`** → `{ records }`. Прогон
  всей истории растущим окном, запись `{ index, step, result }` на каждый шаг.

`evaluateSide(ctx, strategy, side, conditions=CONDITIONS)` — экспортированный примитив
(AND по стороне).

**Точки расширения** (ключевое для фич):
1. **Добавить условие** — написать `ConditionDef` и либо добавить в `CONDITIONS`, либо передать
   через параметр `conditions` в вызов (не трогая библиотеку). `window()` автоматически учтётся
   в `prepareSteps`.
2. **Позиция** — `position` уже прокинута в `EvalContext`, но **пока не читается** ни одним
   встроенным условием. Это заготовка под take-profit / stop-loss / trailing / PnL / max-holding.

**Форма результата** `TradingConditionsStepResult`:
```ts
{ transaction: { buy, sell },
  condition: { buy: Record<ConditionId, {passed, actual?, required?}>, sell: {...} },
  meta: { lastStepTime, transactionInProgress, lastFinishedTransactionTime } }
```

**Сборка/тесты:** `tsup` (esm+cjs+dts), `vitest` (27 тестов, только по `src/engine/`),
`tsc --noEmit`. Экспортируется всё нужное для написания своих `ConditionDef`
(типы + `CONDITIONS`). Отдельные именованные условия (`spreadOkCondition`, …) наружу **не**
реэкспортированы — только `CONDITIONS`.

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

### 5.2. HTTP API (под `/api`, все под JWT кроме `auth` и ⚠️ `swap-execution`)

- **Auth:** `POST /auth/{nonce,verify,refresh}`.
- **ArbiConfigs:** `GET /arbi-configs`, `GET /arbi-configs/:id`, `POST /arbi-configs`,
  `PATCH /arbi-configs/:id`, `DELETE /arbi-configs/:id`,
  `GET /arbi-configs/:id/prices?noCache=`, `POST /arbi-configs/:id/backtest` (**старый** движок),
  `POST /arbi-configs/:id/backtest-new` (**новый**, через `processStep`).
  ⚠️ Swagger для `backtest-new` устарел (написано «заглушка», хотя метод реализован).
- **Subscriptions / Settings / Catalog / Prices / Quotes / MarketData** — CRUD/чтение.
- **SwapExecution:** `POST /swap-execution/execute` — ⚠️ **без JwtAuthGuard** (см. §9).

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

Дальше — **две независимые реализации** (важная несогласованность, см. §9):

- **`runBacktest`** (`/backtest`, старый) → `BacktestEngine` (`engine/backtest.engine.ts`).
  **Использует поля автоторговли сущности**: покупка при
  `ask ≤ avgRefMid·(1−autoBuy%)`; в позиции приоритет stop-loss → trailing TP → arb-sell при
  `bid ≥ avgRefMid·(1+autoSell%)`; учитывает `slippage`, `tradeAmountPct`.
- **`runBacktestNew`** (`/backtest-new`, новый) → инлайн в сервисе, **через движок**:
  `StepQuotes → evaluateConditionsViaEngine (processStep) → decideAction → симуляция`.
  ⚠️ **Игнорирует поля автоторговли сущности** — гоняет по статичному `conditions.config.json`
  (0.02/0.02/0.03 %), 100 % баланса, slippage=0. Собирает `summary`, выборку «значимых»
  шагов (`STEP_SAMPLE_LIMIT=2000`), `ConditionStat`.

### 5.5. Слой аналитики (`src/arbi-configs/analytics/`)

- **`trade-analytics.helper.ts`** — `CONDITION_EVALUATORS` (формулы 3 типов),
  `evaluateConditions`, `decideAction(results, hasPosition)`, `StepQuotes`, `ConditionResult`,
  `StepAnalytics`, `ConditionStat`, `BacktestAnalyticsSummary`.
- **`conditions.config.json`** — 3 условия с порогами (копируется в `dist` через `nest-cli.json`).
- **`strategy-engine.adapter.ts`** ← **мост к движку** (наша интеграция):
  `quotesToMarketStep`, `buildEngineConditions` (каждое аналитическое условие как `ConditionDef`,
  переиспользуя `CONDITION_EVALUATORS`), `PERMISSIVE_STRATEGY`, `evaluateConditionsViaEngine`
  (drop-in для `evaluateConditions`, доказан spec’ом 1:1).

### 5.6. Реальная торговля

Нет единого «real-trading» модуля; возможности разнесены:
- **SwapExecution** — фактическое исполнение: ethers `Wallet` + контракт `ArbExecutor`,
  preview через `executeSwaps.staticCall`, расчёт `amountOutMin` по slippage, отправка tx,
  метрики газа. ⚠️ Эндпоинт публичный, использует серверный `PRIVATE_KEY`.
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
      новый:   evaluateConditionsViaEngine (processStep + conditions.config.json)
               → decideAction(hasPosition)  → trades
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

**Движок (`arbi-conditions-libs`):**
- **Мёртвые поля конфига** — `avgObservedHigherThan{Buy,Sell}Percent` объявлены, но не читаются.
- **`position` не потребляется** ни одним встроенным условием — нет TP/SL/trailing как `ConditionDef`.
- **`processAllStepsAndRecordResults`** — позиционная сигнатура, не пробрасывает `position`/`conditions`/`currentIndex`.
- Именованные условия наружу не реэкспортированы (только `CONDITIONS`).
- Подсистема `src/conditions/` без тестов.

**Бэкенд:**
- **Два разных бэктеста** дают разные результаты на одном конфиге: `/backtest` учитывает поля
  автоторговли сущности, `/backtest-new` — нет (статичный `conditions.config.json`, 100 % баланса, slippage 0).
- **`runBacktestNew` не строит `StrategyEngineConfig` из сущности** — в адаптере зашит
  `PERMISSIVE_STRATEGY`, стратегия задаётся только кастомными условиями из JSON.
- **`swap-execution` без аутентификации** — публичный эндпоинт, отправляет реальные tx серверным `PRIVATE_KEY`.
- Устаревший Swagger у `backtest-new`. Нет серверного оркестратора live-торговли.

**Фронтенд:**
- **Аналитика `backtest-new` не рендерится** — эффект шлёт тот же `runBacktestSuccess`, редьюсер
  типизирован `BacktestResult`, поля `summary/steps/conditions` молча теряются.
- **`tradeAmountPct` — мисномер**: имя/DTO говорят «% баланса», а detail-page трактует как
  абсолютную сумму USDC.
- Нет `environments/` (URL API захардкожен). Пустой `core/store/`. Дубли: два playback-сервиса,
  неиспользуемые mock-сервисы, `referenceSubscriptionIds` + `sources[]` (одно и то же).

---

## 10. Рецепты добавления фич

### 10.1. Новое условие в движке (например `stop_loss`)
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
Добавить в `CONDITIONS` (глобально) **или** передать через `conditions` в вызов (локально).
Обновить `ConditionId`, тесты, README. Позиционные условия требуют, чтобы вызывающий **вёл**
`position` (см. 10.3).

### 10.2. Серверный бэктест на реальной стратегии сущности
Сейчас `runBacktestNew` игнорирует поля автоторговли. Чтобы движок стал «мозгом»:
1. Построить `StrategyEngineConfig` из `ArbiConfig` (маппер autoBuy/autoSell/… → buy/sell).
2. Реализовать недостающие условия как `ConditionDef` (sell-observed-below, stop-loss, trailing).
3. Заменить `PERMISSIVE_STRATEGY` в `strategy-engine.adapter.ts` на построенный конфиг + эти условия.
4. Вести `PositionState` (entryPrice/openedAt) в цикле и прокидывать в `processStep`.
> Это сознательно меняет результаты бэктеста — согласовать с продуктом.

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

Логический порядок следующих шагов (по возрастанию связности):

1. **Позиционные условия в движке** — TP / stop-loss / trailing / max-holding как `ConditionDef`,
   потребляющие `ctx.position` (главная открытая точка расширения).
2. **`StrategyEngineConfig` из сущности** — маппер полей автоторговли + недостающие условия,
   чтобы `runBacktestNew` считал реальную стратегию (§10.2).
3. **Единый бэктест** — свести `/backtest` и `/backtest-new` к одному движку, убрать расхождение.
4. **Рендер аналитики бэктеста** на фронте (§10.4) — данные уже есть, UI нет.
5. **Оркестратор live-торговли** — перенести цикл решений (сейчас на фронте) в общий движок,
   единый источник правды для demo/backtest/live.
6. **Гигиена** — защитить `swap-execution` guard’ом; `environments/` на фронте; починить
   `tradeAmountPct` (имя vs семантика); тесты для `src/conditions/`; обновить Swagger.
```
