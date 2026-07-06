# План рефакторинга ArbiDex

> **Для исполнителя (агента/разработчика).** Этот план самодостаточен: контекст, точные файлы и строки, критерии приёмки и команды проверки. Выполняй фазы **по порядку** — они упорядочены по риску (сначала безопасность и деньги). Строки указаны на момент составления плана — если код сдвинулся, ищи по приведённым фрагментам, а не только по номерам.
>
> Связанные документы: `ARCHITECTURE.md` (карта проекта), `arbi-conditions-libs/README.md` (API движка), `arbi-conditions-libs/docs/engine-algorithm.html` (блок-схемы движка).

## Глобальные правила

1. **Одна фаза = одна ветка/коммит(ы).** Не смешивать фазы. Сообщения коммитов — на английском, по образцу истории (`git log --oneline`).
2. **Перед каждой фазой** — базовая проверка зелёности, **после каждой фазы** — та же проверка + критерии приёмки фазы:
   ```bash
   npm run build:libs                                     # dist движка нужен консьюмерам
   npm test  --workspace @sislex/arbi-conditions-libs     # vitest, сейчас 27 passed
   npx tsc --noEmit -p arbi-conditions-libs
   npx jest --config arbi-dex-server/package.json --rootDir arbi-dex-server/src 2>/dev/null \
     || (cd arbi-dex-server && npx jest)                  # серверные jest-спеки
   cd arbi-dex && npx tsc --noEmit -p tsconfig.json       # фронт: хотя бы типизация
   ```
3. **Не менять** публичное HTTP-API (пути/формы ответов), кроме мест, где фаза явно этого требует.
4. **Не «улучшать попутно»**: не переименовывать, не форматировать и не рефакторить код вне пунктов фазы.
5. В `arbi-conditions-libs` действует инвариант: движок **чистый** (без побочных эффектов), условия — `ConditionDef { id, window(), evaluate() }`, агрегация по стороне — AND, последний шаг окна = текущий. Не ломать 27 существующих тестов, менять их можно только там, где фаза меняет контракт.
6. TypeScript-модель: либа — ESM (`type: module`, exports с `.d.ts`/`.d.cts`), сервер — `nodenext`. При ошибке `TS1479` у консьюмера — проверь `exports` в `arbi-conditions-libs/package.json` и пересобери dist.

---

## Фаза 0 — Подготовка

- [ ] Создать ветку `refactor/phase-security` от `main`.
- [ ] Прогнать все команды из «Глобальных правил» п.2, зафиксировать базовую зелёность (что падает — записать, не чинить).
- [ ] `npm install` в корне, если node_modules неполные.

---

## Фаза 1 — Безопасность бэкенда (критично, ~полдня)

### 1.1. Закрыть `POST /api/swap-execution/execute`
**Файл:** `arbi-dex-server/src/swap-execution/swap-execution.controller.ts` (~строка 11).
Сейчас — единственный не-auth контроллер, а сервис подписывает реальные on-chain транзакции серверным `PRIVATE_KEY`.
- [ ] Добавить `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()` на контроллер (образец — `arbi-configs.controller.ts`).
- [ ] Убрать из Swagger-описания слова «Публичный endpoint».
- [ ] В `swap-execution.service.ts`: добавить серверный верхний лимит `amountIn` (константа, например `MAX_AMOUNT_IN`, значение согласовать; при превышении — `BadRequestException`).
**Приёмка:** запрос без токена → 401; спека контроллера, проверяющая наличие guard'а (см. Фазу 8).

### 1.2. Убрать фолбэки секретов
**Файл:** `arbi-dex-server/src/config/configuration.ts` (~35–36):
```ts
accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
```
- [ ] Написать хелпер `requireEnv(name)` (бросает при отсутствии) и применить к `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. Для DB-переменных — оставить дефолты только для `NODE_ENV !== 'production'`.
- [ ] Проверить, что `.env.example` содержит все обязательные переменные.
**Приёмка:** запуск без `JWT_ACCESS_SECRET` падает на старте с понятной ошибкой.

### 1.3. WebSocket: обязательный токен + проверка владельца
**Файл:** `arbi-dex-server/src/live-chart/live-chart.gateway.ts`.
- [ ] `handleConnection` (~78–116): сейчас `if (token) { verify }` — токен опционален. Сделать обязательным: нет токена или verify упал → `client.disconnect()`, return. Сохранить `userId` из payload.
- [ ] `startRoom` (~142–144): `subsRepo.findOne({ where: { id: subscriptionId } })` → добавить `userId` в where (проверка владельца подписки).
- [ ] Заодно (гонка, ~113–115): `rooms.set(roomId, placeholder)` **синхронно до** await'ов в `startRoom`, чтобы два одновременных клиента не создавали два upstream-сокета; при ошибке — удалить placeholder.
- [ ] Опечатка (~146): `'dex:arbitrumWETHUSdCbidPrice'` → `USDC`. Лучше: убрать хардкод-фолбэки и отклонять подключение, если ключи не собрались.
**Приёмка:** подключение без токена рвётся; подписка на чужой `subscriptionId` отклоняется.

### 1.4. Кэш цен: владелец до кэша
**Файл:** `arbi-dex-server/src/prices/prices.service.ts` (~73–91). Сейчас кэш-lookup и early-return стоят **до** проверки `findOne({ id, userId })`, а ключ кэша — только `subscriptionId` → любой пользователь читает чужие данные из кэша.
- [ ] Перенести проверку владельца **до** обращения к кэшу (NotFoundException, если не его).
- [ ] Ключ кэша оставить `subscriptionId` (данные одни и те же), но проверка владельца обязана выполняться на каждый вызов.
**Приёмка:** пользователь B с чужим subscriptionId получает 404 даже при тёплом кэше.

### 1.5. CORS и rate-limit
- [ ] `arbi-dex-server/src/main.ts` (~14–22): `CORS_ORIGIN` поддержать как список через запятую → массив; запретить сочетание wildcard/`origin:true` с `credentials:true`.
- [ ] Подключить `@nestjs/throttler` глобально (умеренно, напр. 100 req/min), строже — на `auth/nonce` и `swap-execution`.
- [ ] `arbi-dex-server/src/app.module.ts` (~47): `synchronize: true` → `synchronize: nodeEnv !== 'production'` + TODO на миграции (сами миграции — вне этого плана).
**Приёмка:** сборка и текущие jest-спеки зелёные; ручной smoke `GET /api/health`.

---

## Фаза 2 — Деньги на фронте (критично для real-режима)

Все пункты — в `arbi-dex/src/app/pages/arbi-config-detail-page/arbi-config-detail-page.component.ts` (~2180 строк), если не сказано иное. Компонент большой — искать по фрагментам кода.

### 2.1. Guard от двойного реального свопа
- [ ] `prepareRealSwap()` (~1578): первой строкой — если `isRealSwapInProgress` → return; иначе выставить `true`. Снимать флаг в `next` и `error` всех веток (сейчас флаг ставит только авто-трейд путь ~1946/1970, поэтому `canSwap` (~949) всегда разрешает клик).
**Приёмка:** два синхронных вызова `prepareRealSwap()` порождают один HTTP-запрос (юнит-тест — Фаза 8).

### 2.2. Семантика `tradeAmountPct` — РЕШЕНИЕ
Имя и доки говорят «% от баланса» (`shared/models/arbi-config.model.ts:31`, дефолт 100 в `arbi-configs-http.service.ts:60`), а используется как **абсолютные USDC**:
`this.amountIn = config.tradeAmountPct` (~995), `this.realUsdcHeld = config.tradeAmountPct` (~997, ~2109), `Math.min(config.tradeAmountPct, usdcBalance)` (~1996).
- [ ] **Принятое решение: реализовать как процент** (соответствует имени, DTO, серверному `BacktestEngine`, который уже трактует его как долю). Во всех четырёх местах: `amount = balance * (tradeAmountPct / 100)`, где balance — USDC-баланс соответствующего режима (demo → демо-баланс, real → `realUsdcHeld`).
- [ ] Обновить подпись поля в форме (`arbi-config-form-page.component.ts`): «% от баланса на сделку».
- [ ] Если исполнителю доступен владелец продукта — подтвердить; иначе выполнять как написано и пометить в PR.
**Приёмка:** при балансе 1000 и tradeAmountPct=50 сделка на 500.

### 2.3. Изоляция real-режима от демо-состояния
- [ ] Подписка на демо-баланс (~1072–1094) клампит `amountIn` и в real-режиме. Обернуть тело в `if (this.tradingMode === 'demo')`.
- [ ] Карточки Balance/Portfolio/P&L (~шаблон 336–349, `updatePortfolio` ~2084) в real-режиме должны показывать `realUsdcHeld`/`realWethHeld`, а не демо-стор.
**Приёмка:** в real-режиме демо-эмиссии не меняют `amountIn`; карточки показывают real-значения.

### 2.4. Сброс состояния при переключениях
- [ ] `applyMode()` (~1154–1184): при каждой смене historical/playback/live вызывать `resetTradeState()` (сброс `engine`, `isRealSwapInProgress`; `realUsdcHeld/realWethHeld` — пересеять от конфига).
- [ ] Конфиг-подписка (~971–1004, `combineLatest([selectById, sources$, pairs$]).subscribe`): добавить `distinctUntilChanged` по `config.id + updatedAt` (или сравнением полей стратегии); пересоздавать `AutoTradeEngine` и пересеивать `realUsdcHeld` **только** при реальном изменении конфига, не при каждом re-emit.
**Приёмка:** смена режима туда-обратно не оставляет `hasPosition=true` от старого режима; re-dispatch `loadOne` не сбрасывает накопленный `realUsdcHeld`.

### 2.5. Утечка playback-подписок
- [ ] `startPlaybackMode()` (~1740): подписка на `multiPlayback.tick$` кладётся в общий `rxSubs` и никогда не снимается до destroy — каждый рестарт добавляет дубль (N× `runAutoTrade` за тик). Завести поле `private tickSub?: Subscription`; в начале `startPlaybackMode()` — `this.tickSub?.unsubscribe()`, новую подписку хранить в нём (и всё равно снять в `ngOnDestroy`).
**Приёмка:** три вызова `startPlaybackMode()` подряд → на тик срабатывает ровно один обработчик.

### 2.6. Зависание очереди при неудачном refresh
**Файл:** `arbi-dex/src/app/core/interceptors/auth.interceptor.ts` (~96–103). Очередь ждёт `refreshTokenSubject.pipe(filter(t => t !== null))`; при провале рефреша пишется `next(null)` → ожидающие запросы висят вечно.
- [ ] При провале рефреша: пробрасывать ошибку ожидающим (например, `refreshTokenSubject.error(...)` c пересозданием subject, либо отдельный сигнал-«провал», на который ожидающие отвечают `throwError`), затем logout как сейчас.
**Приёмка:** юнит-тест — 2 параллельных 401 при падающем refresh: оба запроса завершаются ошибкой, не зависают.

### 2.7. Мёртвая демо-кнопка Buy/Sell
- [ ] `doSwap()` (~1342): тело демо-свопа закомментировано (~1352–1371) — кнопка только флипает направление. Восстановить: `demoFacade.swap(...)`, уведомление, `engine.onBuy/onSell`, `updateHorizontalLines` (см. авто-трейд путь ~1994 как образец). Если восстановление нежелательно — скрыть кнопку в demo-режиме, но предпочтителен первый вариант.
**Приёмка:** ручной Buy в demo меняет балансы и пишет строку в Trade History.

---

## Фаза 3 — Достроить движок `arbi-conditions-libs` (позиционные условия)

Контекст: движок — реестр условий `CONDITIONS: ConditionDef[]`; `evaluate(ctx, strategy, side)` получает `ctx = { window, current, position }`; `position: PositionState { entryPrice, size, openedAt } | null` уже прокинут, но никем не читается. `prepareSteps` берёт требования окна из `window()` каждого условия. Всё в `arbi-conditions-libs/src/engine/`.

### 3.1. Расширить конфиг стратегии
**Файл:** `src/engine/types.ts`.
- [ ] Удалить мёртвые поля `avgObservedHigherThanBuyPercent` / `avgObservedHigherThanSellPercent` (они нигде не читаются; README помечает их «reserved»). Обновить README и `__fixtures__/stubs.ts`.
- [ ] В `SellTradingConditionsConfig` добавить опциональные поля:
  ```ts
  stopLossPercent?: number | null;          // % убытка от entryPrice → форс-продажа
  trailingTakeProfitPercent?: number | null; // % отката от пика после входа
  maxHoldingTimeMs?: number | null;          // максимум времени в позиции
  ```
- [ ] В `EvalContext` ничего не менять. В `ConditionId` добавить `'stop_loss' | 'trailing_take_profit' | 'max_holding_time'`.

### 3.2. Новые условия (каждое — свой файл в `src/engine/conditions/`)
Общие правила: если параметр не задан (`null`/`undefined`) или `ctx.position === null` — условие **passed: true** для «гейтов» не подходит; здесь семантика другая — это **триггеры продажи**, поэтому оформить их как *отдельную группу*: они не должны AND-иться с обычными sell-условиями (иначе стоп-лосс сработает только при выполнении всех прочих условий).
- [ ] **Решение по агрегации:** расширить `TradingConditionsStepResult.transaction` полем `forcedSell: boolean` — true, если сработал хотя бы один из `stop_loss` / `trailing_take_profit` / `max_holding_time` (OR-семантика), при этом их outcome'ы класть в `condition.sell` как обычно, но **не** включать в AND для `transaction.sell`. В `processStep.ts` разделить реестр: `GATE_CONDITIONS` (существующие 6, AND) и `TRIGGER_CONDITIONS` (новые 3, OR → `forcedSell`). Параметр `conditions` в `ProcessStepParams` оставить для gate-набора; добавить опциональный `triggerConditions?: ConditionDef[]`.
- [ ] `stopLoss.ts`: `id: 'stop_loss'`, `window: () => ({})`; evaluate (side==='sell' only): passed = `position && cfg != null && current.avgObservedQuote <= position.entryPrice * (1 - cfg/100)`; actual = текущая цена, required = уровень стопа.
- [ ] `maxHoldingTime.ts`: passed = `position && cfg != null && current.time - position.openedAt >= cfg`.
- [ ] `trailingTakeProfit.ts`: требует пик цены с момента входа → `window: (s) => ({ sinceTime: позиция })` — окна по времени входа у `WindowRequirement` нет; добавить в `WindowRequirement` поле `sincePositionOpen?: boolean`, а в `prepareSteps` — если задано и есть `position`, `keepFrom = min(keepFrom, первый индекс с time >= position.openedAt)`. evaluate: peak = max(avgObservedQuote по window с time >= openedAt, но не ниже entryPrice); passed = `цена <= peak * (1 - cfg/100) && peak > entryPrice`.
- [ ] Обновить `registry.ts` (новый экспорт `TRIGGER_CONDITIONS`), `conditions/index.ts`, `src/index.ts` (реэкспорт новых условий и `TRIGGER_CONDITIONS`).

### 3.3. Довести API
- [ ] `processAllStepsAndRecordResults`: перевести на объектный вход `({ steps, strategy, position?, conditions?, triggerConditions?, onRecord? })`, внутри вести позицию **не надо** (остаётся чистый прогон), но параметры прокидывать в `processStep`. Обновить его тесты.
- [ ] Реэкспортировать из корня пакета все именованные условия (`enabledCondition`, `spreadOkCondition`, …) — сейчас наружу смотрит только `CONDITIONS`.
- [ ] Тесты: на каждое новое условие (сработал/не сработал/нет позиции/параметр не задан), на `forcedSell`-агрегацию, на `sincePositionOpen` в `prepareSteps`. Ожидаемый итог ≥ 40 тестов.
- [ ] Добавить тесты на `src/conditions/` (аналитическая подсистема: `evaluateCondition`/`evaluateConfig`/`allConditionsMet` — сейчас 0 тестов).
- [ ] Обновить `README.md` (раздел Strategy engine: триггеры, forcedSell, новые поля) и при возможности `docs/engine-algorithm.html` (хотя бы пометку).
**Приёмка:** `npm test` (либа) зелёный; `npm run build:libs` зелёный; `tsc --noEmit` консьюмеров зелёный.

---

## Фаза 4 — Сервер: одна стратегия вместо двух бэктестов

Контекст: сейчас `/backtest` (старый `BacktestEngine`, читает поля автоторговли `ArbiConfig`) и `/backtest-new` (через `processStep`, но со статичным `conditions.config.json`, `PERMISSIVE_STRATEGY`, slippage=0, all-in). Цель — `-new` считает реальную стратегию сущности через движок либы.

### 4.1. Маппер `ArbiConfig → StrategyEngineConfig`
**Новый файл:** `arbi-dex-server/src/arbi-configs/analytics/strategy-config.mapper.ts`.
- [ ] Функция `buildStrategyFromConfig(config: ArbiConfig): StrategyEngineConfig`:
  - `buy.enabled = config.autoBuyThresholdPct != null`; `buy.avgObservedHigherThanBuyForLastSteps = { steps: 1, percent: Number(config.autoBuyThresholdPct ?? 0) }` — семантика старого движка: покупка, когда `ask ≤ avgRefMid·(1−pct/100)`, т.е. observed выше ask на ≥ pct — это ровно встроенное buy-условие.
  - `sell.enabled = config.autoSellThresholdPct != null`; **внимание:** встроенное sell-условие движка — «observed ВЫШЕ sellQuote», а стратегия сервера — «bid ≥ avgRefMid·(1+pct/100)», т.е. observed **НИЖЕ** bid на ≥ pct. Встроенное условие не подходит → написать кастомный `ConditionDef` `sell_observed_below` в этом же файле (формула: `pctDiff(sellQuote, avgObservedQuote) >= pct`) и передавать его через параметр `conditions` (заменив в наборе `avg_observed_higher_for_last_steps` для sell-стороны; проще: собрать свой массив gate-условий из либы + этот).
  - `sell.stopLossPercent = config.stopLossPct`, `sell.trailingTakeProfitPercent = config.trailingTakeProfitPct` (числа из TypeORM decimal приходят строками — коэрсить `Number()`).
  - Прочие поля — «пропускающие» значения (spread=∞ если не настроен, балансы не требуются, delay=0), как в текущем `PERMISSIVE_STRATEGY`.
- [ ] Юнит-спека маппера: конфиг с/без порогов → ожидаемый StrategyEngineConfig.

### 4.2. Переписать `runBacktestNew` на движок с позицией
**Файл:** `arbi-dex-server/src/arbi-configs/arbi-configs.service.ts` (~282–461).
- [ ] Тики → `MarketStep[]` (уже есть `quotesToMarketStep` в `strategy-engine.adapter.ts` — расширить временем: `time: tick.time`).
- [ ] Цикл по шагам с ведением `PositionState`:
  - нет позиции и `result.transaction.buy` → купить: размер = `usdcBalance * (tradeAmountPct/100)`, применить `slippage` из конфига к цене (как в `BacktestEngine.executeBuy`), открыть позицию `{ entryPrice, size, openedAt: tick.time }`;
  - есть позиция и (`result.transaction.forcedSell` или `result.transaction.sell`) → продать (slippage аналогично), закрыть позицию; в `reason` сделки — id сработавших условий.
  - на каждый шаг вызывать `processStep(prepareSteps({ steps: window, strategy, position, conditions, triggerConditions }))` — окно вести растущим массивом, `prepareSteps` подрежет.
- [ ] Сохранить форму ответа `BacktestNewResult` (summary/steps/conditions/…): `ConditionResult[]` собирать из `result.condition.*` нового движка (passed/actual/required уже есть). `conditions` в ответе — описать из реальной стратегии, а не из JSON.
- [ ] `conditions.config.json` и старый путь `evaluateConditionsViaEngine` оставить **только** если их использует что-то ещё; иначе удалить вместе со спекой эквивалентности (она фиксирует старое поведение, которое мы сознательно меняем) — заменить новыми спеками: «BUY при пороге X на подходящем тике», «SELL по stop-loss», «слиппедж применён», «tradeAmountPct как %».
- [ ] `runBacktest` (старый) и `BacktestEngine` пока **не удалять** — пометить `@deprecated` в Swagger; удаление — отдельным решением после сверки результатов (см. 4.3).
- [ ] Исправить проглатывание ошибок (~294–299): если все серии пусты → `BadRequestException('Нет данных котировок')`; частичные провалы — добавить в ответ поле `warnings: string[]`.
- [ ] Обновить Swagger `backtest-new` (убрать «Заглушка…»).

### 4.3. Сверка старого и нового
- [ ] Написать интеграционную спеку: один и тот же синтетический набор тиков + конфиг → прогнать `BacktestEngine` и новый `runBacktestNew`; сделки должны совпадать по направлению/шагам (цены — с точностью slippage-модели). Расхождения задокументировать в спеке комментарием.
**Приёмка фазы:** серверные спеки зелёные; `/backtest-new` для конфига с порогами возвращает ненулевые сделки, использует slippage и tradeAmountPct.

---

## Фаза 5 — Фронт: `AutoTradeEngine` → движок либы

Контекст: `arbi-dex/src/app/features/arbi-configs/engine/auto-trade.engine.ts` — третья копия стратегии (tick → buy/sell/none + внутреннее состояние позиции/пиков). Заменяем расчёт условий на `processStep`, ведение позиции оставляем в тонком слое.

- [ ] Убедиться, что `@sislex/arbi-conditions-libs` собрана и импортируется во фронте (`npm run build:libs`; Angular работает с ESM — импорт из пакета должен пройти без доп. настроек).
- [ ] Новый сервис `arbi-dex/src/app/features/arbi-configs/engine/strategy-engine.service.ts`:
  - хранит `window: MarketStep[]` (append на каждый тик; capacity ~ разумный максимум, prepareSteps подрежет), `position: PositionState | null`;
  - метод `tick(tradingBid, tradingAsk, avgRefMid, time): { action: 'buy'|'sell'|'none', reason: string }`:
    строит `MarketStep` (`buyQuote: tradingAsk`, `sellQuote: tradingBid`, `avgObservedQuote: avgRefMid`), пушит в окно, вызывает `processStep(prepareSteps({...}))` с той же стратегией/условиями, что сервер (переиспользовать маппер-логику: продублировать `buildStrategyFromConfig` на фронте или, лучше, перенести маппер в либу `src/engine/mappers/` и импортировать с обеих сторон);
  - `onBuy(price, size, time)` / `onSell()` — ведение `position`;
  - экспонирует уровни для графика: `stopLossLevel`, `trailingLevel`, `autoBuyLevel` (вычисляются из strategy + position — формулы взять из старого `AutoTradeEngine`).
- [ ] В `arbi-config-detail-page.component.ts` заменить `AutoTradeEngine` на новый сервис (создание ~1000, `runAutoTrade` ~1946+, уровни `updateHorizontalLines`). Поведение решения — идентичное: без позиции → buy-сигнал, в позиции → sell-сигнал или триггер.
- [ ] Старый `auto-trade.engine.ts` удалить после переключения; его формулы предварительно зафиксировать юнит-тестом на новый сервис (порог покупки, стоп, трейлинг — граничные значения).
**Приёмка:** demo-плейбек с теми же данными даёт те же сделки, что и до замены (проверить вручную на одном конфиге); юнит-тесты сервиса зелёные.

---

## Фаза 6 — Фронт: стор и аналитика backtest-new

**Файлы:** `arbi-dex/src/app/features/arbi-configs/store/{actions,reducer,effects,selectors}.ts`, detail-page.
- [ ] `actions.ts` (~101): завести отдельный `runBacktestNewSuccess({ result: BacktestNewResult })`; эффект `runBacktestNew$` (`effects.ts` ~164) диспатчит его, а не общий `runBacktestSuccess`.
- [ ] `reducer.ts`: `on(runBacktestNew, s => ({...s, backtestLoading: true, backtestResult: null}))` (сейчас прогресс-бар не показывается вовсе); отдельный слайс `backtestNewResult: BacktestNewResult | null`; селектор.
- [ ] Detail-page: секция аналитики под результатами нового бэктеста — `summary` (totalSteps/buySignals/sellSignals/txAllowed), таблица `conditionStats` (passed/failed по условию), таблица «значимых шагов» `steps` (time, action, условия с actual/required). Данные уже приходят с бэка и сейчас молча теряются.
**Приёмка:** кнопка «Server backtest new» показывает прогресс-бар и рендерит summary + таблицы.

---

## Фаза 7 — Гигиена и производительность

- [ ] **Чарты:** тротлинг обновлений (~1774 `onPlaybackTick`, ~1855 `upsertLivePoint`, `price-chart.component.ts` ngOnChanges): аккумулировать точки и применять раз в animation frame (или каждые 250 мс); не пересоздавать массив целиком, где ag-charts позволяет инкремент.
- [ ] **Бандл:** удалить `ag-grid-community`/`ag-grid-angular` из `package.json` (используются только Storybook-компонентами `quotes-table`/`subscriptions-table` — либо удалить и их); проверить, нужен ли `ag-charts-enterprise` или хватит community. Бюджеты в `angular.json`: warn 3 MB / error 5 MB.
- [ ] **environments/**: создать `environment.ts`/`environment.prod.ts` (+`fileReplacements`), `API_BASE_URL` из environment. e2e-переопределение через `E2E_API_BASE_URL` сохранить.
- [ ] Удалить мёртвые mock-сервисы (auth/catalog/quotes/subscriptions `-mock.service.ts`), пустую папку `core/store/`, поле `referenceSubscriptionIds` из модели (использовать `sources`; поправить маппер http-сервиса и все usages).
- [ ] Токены: refresh-токен убрать из `localStorage` минимум в память (компромисс задокументировать); access — можно оставить, добавить строгий CSP в `index.html`.
- [ ] Бэкенд: централизовать URL marketData (убрать 5 хардкод-IP фолбэков: `prices.service.ts:63`, `live-chart.gateway.ts:74`, `market-data.service.ts:37`, `quotes.service.ts:44` — все через `configuration.ts`, при отсутствии env — падать).
- [ ] Точность денег: убрать промежуточные `parseFloat(x.toFixed(n))` в симуляции (`backtest.engine.ts`, `arbi-configs.service.ts`) — округление только на выдаче.
- [ ] Forward-fill: `arbi-configs.service.ts` (~508) — `pt.bidPrice > 0 ? pt.bidPrice : prev.bid` вместо `??` (ноль — сентинел пропуска).
- [ ] (Опционально, большой) Декомпозиция detail-page на TradingPanel / AutoTradeController / PlaybackController / LivePriceController / BacktestPanel — делать **после** фаз 2/5/6, отдельной веткой.

---

## Фаза 8 — Тесты (закрепление)

Минимальный обязательный набор (сверх добавленных по ходу фаз):
- [ ] **Сервер:** спека, что `SwapExecutionController` защищён guard'ом (Reflector/metadata или e2e 401); `buildBacktestTicks` (пропуски, нули, forward-fill); `decideAction` (если остался); новый `runBacktestNew` (BUY/SELL/stop-loss/slippage/размер сделки); `LiveChartGateway.handleConnection` (без токена → disconnect).
- [ ] **Фронт:** `StrategyEngineService.tick` (границы порогов, стоп, трейлинг, нет-позиции); `auth.interceptor` (401 → refresh → retry; refresh падает → оба запроса завершаются, не висят); guard двойного свопа; редьюсер `runBacktestNew` loading/слайс.
- [ ] **Либа:** уже покрыта по ходу Фазы 3 (цель ≥ 40).
- [ ] e2e: один happy-path «открыть конфиг → playback → server backtest new → увидеть summary» на dev-стеке (`arbi-dex/e2e/`).

---

## Порядок и зависимости

```
Фаза 1 (сервер-безопасность)     — независима, первой
Фаза 2 (фронт-деньги)            — независима, второй
Фаза 3 (либа: позиционные усл.)  — база для 4 и 5
Фаза 4 (сервер: единая стратегия)— после 3
Фаза 5 (фронт: движок либы)      — после 3 (маппер лучше делать в либе на Фазе 4 и переиспользовать)
Фаза 6 (стор/аналитика)          — независима, можно параллельно с 4/5
Фаза 7 (гигиена)                 — последней, кроме пунктов, мешающих ранним фазам
Фаза 8 (тесты)                   — сквозная: тесты пишутся в своей фазе, здесь — добор
```

## Известные ловушки для исполнителя

1. **`build:libs` перед любыми проверками консьюмеров** — сервер и фронт импортируют `dist/`, не `src/`.
2. TypeORM decimal-поля приходят **строками** — всегда `Number(...)` перед математикой (autoBuyThresholdPct и т.д.).
3. Встроенное sell-условие движка (`avg_observed_higher_for_last_steps`, side=sell) — «observed ВЫШЕ bid», серверная стратегия — «observed НИЖЕ bid». Не пытаться натянуть встроенное — нужен кастомный `ConditionDef` (Фаза 4.1).
4. Триггеры продажи (stop-loss и др.) — **OR и mustNotAND** с гейтами: стоп-лосс обязан срабатывать независимо от спреда/задержек (Фаза 3.2).
5. Тесты либы используют фикстуры `__fixtures__/stubs.ts` — при изменении конфиг-типов обновлять фикстуры, а не ослаблять типы.
6. В detail-page много скрытых связей через поля класса — после каждого пункта Фазы 2 прогонять `tsc --noEmit` и вручную кликать playback/live в dev-стеке (`arbi-dex/e2e/dev-up.sh`).
7. Не удалять `BacktestEngine`/`/backtest` до сверки 4.3 — фронт зовёт оба эндпоинта.
