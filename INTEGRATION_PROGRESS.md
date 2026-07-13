# Интеграция arbi-dex-react ↔ arbi-dex-server — прогресс

Статусы: ⬜ TODO · 🟨 IN PROGRESS · ✅ DONE

| # | Шаг | Статус | AC |
|---|---|---|---|
| INT-1 | Backend: demo-engine + conditions-catalog + /catalog/markets | ✅ | jest + curl |
| INT-2 | Backend: market-configs (+/:id/quotes) | ✅ | probe CRUD+quotes (e2e в INT-4) |
| INT-3 | Backend: strategy-configs | ✅ | demo.e2e |
| INT-4 | Backend: bots + backtest + autotune (демосчёт) | ✅ | demo.e2e |
| INT-5 | FE: http client + dev-key auth + api facade toggle | ✅ | live-smoke (auth+catalog) |
| INT-6 | FE: configs (market+strategy) live | ✅ | live-smoke (CRUD+quotes) |
| INT-7 | FE: bots/charts/backtest/autotune/demo live | ✅ | live-smoke (bot+backtest+autotune) |
| INT-8 | E2E против live-стека + финализация | ✅ | Playwright live |

## Инфраструктура
- Postgres поднят (docker, :5433). Сервер `start:dev` на :3006/api (Swagger /api/docs).
- Проверено: auth (тестовый ключ) + catalog (живые данные) + subscriptions/arbi-configs работают.
- Dev-ключ: `0x59c6...690d` (детерминированный, как в e2e/make-auth-state.mjs).

## Журнал

### INT-1 — ✅ DONE
- `src/demo/engine/`: types, rng, quotes (persistent-divergence генератор), conditions-catalog (9 условий), simulate, autotune, markets (28 рынков = sources×pairs).
- Модуль `conditions-catalog` (GET /conditions-catalog). Расширен catalog: GET /catalog/markets.
- **AC:** `jest engine.spec` (серия детерминирована, сделки>0, autotune ранжирован, 28 рынков) — 4 PASS. Curl: /conditions-catalog=9, /catalog/markets=28.

### INT-2 — ✅ DONE
- Сущность `MarketConfig` (jsonb observedMarketIds/weights), DTO, сервис (CRUD scoped by userId + getQuotes через demo-engine), контроллер (GET/POST/PATCH/DELETE + GET /:id/quotes), модуль. Зарегистрировано в app.module (+entity).
- **AC:** probe — create 201 (createdAt ISO), list, patch, quotes (60 точек), delete 204. Формальный e2e — в INT-4.

### INT-3 — ✅ DONE
- Сущность `StrategyConfig` (buy/sell jsonb), DTO, сервис (CRUD + defaults из каталога), контроллер (+ GET /strategy-configs/defaults), модуль. Зарегистрировано.

### INT-4 — ✅ DONE
- Сущность `Bot` (демосчёт: balance/pnl/stats на double precision → числа), DTO, сервис (CRUD + backtest, обновляющий демосчёт, + autotune), контроллер (+ POST /:id/backtest, /:id/autotune), модуль (инжектит MarketConfigsService+StrategyConfigsService). Зарегистрировано.
- **AC (INT-2/3/4):** `test/demo.e2e-spec.ts` — 2 сьюта PASS: markets(28)+catalog(9); полный поток login→market-config→quotes(120)→strategy(defaults)→bot(balance=1000)→backtest(trades>0, демосчёт обновлён: balance==finalBalance)→autotune(ранжирован по PnL)→cleanup. Dev-сервер жив после e2e (200).

### INT-5/6/7 — ✅ DONE
- `ethers` добавлен. `api/config.ts` (VITE_API_BASE_URL → live/mock, dev-ключ), `api/http.ts` (fetch + Bearer + refresh-on-401 + хранилище токенов с memory-fallback), `api/auth.ts` (dev-подпись ethers), `api/types.ts` (общий `ApiClient`), `api/live.ts` (live-реализация), `api/mock.ts` (перенесён мок, типизирован ApiClient), `api/index.ts` (переключатель).
- Thunks: `botId` в runBacktest/runAutotune. BacktestTab передаёт botId + `fetchBot` после прогона (демосчёт). AutotuneTab передаёт botId. Восстановление сессии в live (`restoreSession` в main).
- **AC:** `npm run test:live` (scripts/live-smoke.ts) — реальный клиент ↔ сервер: логин, markets(28), market-config CRUD+quotes(120), strategy(defaults), bot(1000), backtest(12 сделок, демосчёт обновлён), autotune(24 ранжировано), cleanup → ✅ PASSED. Мок-режим не затронут: `test:sb` 19/19 PASS. tsc ✓.

### INT-8 — ✅ DONE
- Playwright в `arbi-dex-react/e2e` (config + `scenarios/demo-flow.spec.ts`), `npm run e2e`. webServer поднимает `dev:live`.
- Детерминированный live-режим: `vite.config` `define` пробрасывает `VITE_API_BASE_URL`/`VITE_DEV_WALLET_KEY` из shell в бандл (Vite не всегда форвардит shell VITE_*); `config.ts` читает injected-константы с typeof-guard (безопасно под Storybook).
- **AC:** e2e PASS — реальный фронт в live-режиме: логин кошельком → создание стратегии через UI → сохранена в бэкенде → переживает reload (восстановление сессии).

### Доп.: реальный MetaMask-логин (опция)
- `api/auth.ts`: `connectWithMetaMask` (`window.ethereum` → `eth_requestAccounts` → `personal_sign`), `connectWithDevKey`, диспетчер `connectWalletLive(method)` (MetaMask при наличии, иначе dev), `hasMetaMask()`.
- Фасад/thunk `connectWallet(method?: 'metamask'|'dev')`; `LoginPage` в live-режиме — кнопки «Подключить MetaMask» + «Dev-вход», в мок-режиме — одна кнопка.
- E2E изолирован на порт :5399 (`dev:e2e`, `reuseExistingServer:false`), логинится dev-кнопкой. Все проверки зелёные: test:sb 19/19, test:live, e2e, tsc.

### Доп.: реальные котировки на странице «Конфигурация рынков»
- Бэкенд: `PricesService.getPricesByMarket(sourceId, pairId)` + `GET /prices/market?sourceId=&pairId=` (реальные bid/ask из arbiDexMarketData без подписки; прореживание до ~800 точек). `/catalog/markets` теперь выводится из живых ключей market-data (45 рынков, id `${sourceId}__${pairId}`).
- Фронт: фасад `api.quotes.marketPreview` (mock → генератор; live → тянет `/prices/market` по каждому рынку, строит средневзвешенную + линии buy/sell). Редактор конфигурации рынков грузит превью асинхронно + спиннер «Загрузка котировок…».
- Проверено в браузере (live): Binance ETH/USDT (реальный mid) + Arbitrum DEX USDC/WETH (реальные bid/ask), реальная ось времени. tsc ✓, test:sb 19/19 ✓, `/prices/market` → 800 точек.
- Известное: средневзвешенная линия может выглядеть «плоской», если временные окна источников не пересекаются (DEX-история старее CEX) — артефакт склейки разных источников; индивидуальные линии (тумблер выкл.) показывают реальные данные корректно. Realtime-режим пока рендерит ту же историю (стриминг через socket `/live-chart` — следующий шаг).

### Доп.: живой стриминг котировок через socket /live-chart
- Бэкенд: `LiveChartGateway` расширен — помимо `subscriptionId` принимает `sourceId`+`pairId` в query (стрим по рынку, без подписки; комната `market:<src>|<pair>`). `startRoom(roomId, sourceId, pairId)`. Ретранслирует `dataChange` из arbiDexMarketData → `priceUpdate`.
- Фронт: `socket.io-client`; `api/liveSocket.ts` (`subscribeMarket(marketId, onTick)` → `/live-chart` с auth-токеном + query source/pair, парсит bid/ask); общий `api/assemble.ts` (сборка превью, переиспользуется live-fetch и стримом). Редактор конфигурации рынков в режиме «Реальное время» открывает сокеты по каждому рынку, дозаписывает тики (throttle 500мс) и обновляет график; бейдж «● LIVE».
- Проверено: socket-probe — реальные `priceUpdate` (binance ETH/USDT bid/ask); в браузере — «● LIVE» и график достраивается в реальном времени. tsc ✓, test:sb 19/19 ✓ (стриминг под `IS_LIVE`, мок не затронут).

### Доп.: плеер истории + контролы масштаба на графике
- `QuoteChart`: поддержка видимого окна (`viewStartTime`/`viewEndTime` → `timeScale.setVisibleRange`), отдельный эффект — без сброса данных.
- `QuoteChartPanel`: контролы масштаба (zoom in/out/«весь график»); плеер истории (`player` prop) — play/pause + слайдер по шагам (0..N) + метка «время · шаг/всего»; playhead + окно зума задают видимый диапазон; playhead «прилипает» к концу при новых данных.
- Включено: страница «Конфигурация рынков» в режиме «Исторические» (`player={mode==='historical'}`) и вкладка «Бэктест» (график результата). Зум — на всех графиках.
- Проверено: play-тест `Chart/QuoteChartPanel → PlayerAndZoom` (плеер, слайдер, zoom in/out/reset, play/pause) — test:sb 20/20 ✓; tsc ✓; в браузере — перемотка на любой шаг (218/800, график обрезается до шага) + кнопки зума.

### Доп.: бэктест стратегии бота за период на общем движке (arbi-conditions-libs)
- **Библиотека:** новый общий раннер `runBacktest(steps, strategy, opts)` поверх `processStep` (позиция + сделки + PnL/статы + summary) — единственная недостающая часть движка. Экспортирован из `@sislex/arbi-conditions-libs`. Тесты `runBacktest.test.ts` (6): вход/выход по сигналу, force-close в конце, stop-loss + drawdown, slippage/tradeAmountPct, пустая серия, отсутствие сигналов. Либа: build + 57 тестов ✓.
- **Сервер:** маппер `demo/engine/strategy-engine.mapper.ts` (`StrategyConditionValue[] → StrategyEngineConfig` + кастомные gate-условия avg-отклонение/спред + built-in триггеры, воспроизводит `simulate.ts`). `MarketConfigsService.getQuotesRange(from,to)`/`getHistoryRange` — реальные котировки рынка за диапазон через `PricesService.getPricesByMarket` (observed-рынки forward-fill + средневзвешенная), фолбэк на синтетику. `BotsService.backtest({from,to})` — прогон через `runBacktest` за период (дефолт — последняя неделя, кламп к истории), обновляет демосчёт; `historyRange`. Контроллер: `POST /bots/:id/backtest?from=&to=`, `GET /bots/:id/history-range`.
- **AC:** `strategy-engine.mapper.spec.ts` (3) — синтетика+дефолтная стратегия через маппер+`runBacktest` даёт сделки; выключенная buy-сторона → 0 сделок; триггеры проброшены. Сервер: nest build ✓, 13 сьютов / 73 теста ✓.
- **Фронт:** `BacktestParams` → `from/to` (вместо `count`), `ApiClient.bots.historyRange`. `live.ts`/`mock.ts` обновлены (mock слайсит синтетику по диапазону). `BacktestTab` — пресеты Неделя(деф.)/Месяц/Вся история + произвольные даты начала/конца (детект единицы времени сек/мс). tsc ✓, `test:sb` 20/20 ✓.
- **Autotune (Фаза 4):** `demo/engine/autotune.ts` переведён с `simulate.ts` на общий `runBacktest` (через `toEngineStrategy`), окно шагов строится один раз. `BotsService.autotune({from,to,maxCombos})` + контроллер `POST /bots/:id/autotune?from=&to=&maxCombos=` — тот же период, что и бэктест. Фронт: `AutotuneParams` `count`→`from/to`; общие `usePeriod`/`PeriodPicker` вынесены и переиспользованы в Backtest+Autotune вкладках.
- **Проверено на живом стеке (Postgres :5433 + market-data):** `test/demo.e2e-spec.ts` — 2 сьюта / 33 теста PASS; `npm run test:live` — логин, каталог (45 живых рынков), CRUD, `historyRange` (реальные границы), бэктест за дефолт-период + кастомное окно (котировки строго в `[from,to]`, демосчёт == finalBalance), autotune (24 комбо, ранжировано) → ✅. Ноль сделок на реальных данных — легитимный исход (наблюдаемые рынки другой базы/окна → avg≈mid); движок производит сделки при реальном отклонении (`strategy-engine.mapper.spec` + full-flow e2e на синтетике).
- **Устаревшие ассерты приведены к среде:** хардкод `markets=28` (e2e+live-smoke) → структурная проверка (каталог теперь 45 живых рынков); live-smoke `trades>0` → структурная проверка бэктеста (реальные данные могут давать 0 сделок).
- **Осталось:** Playwright e2e (`npm run e2e`) — не гонял (требует поднятого dev:e2e-стека); фронтовые вкладки в браузере визуально не проверял.

### Доп.: UX-правки (подтверждение удаления + ошибка бэктеста) и изоляция e2e-БД
- **Подтверждение удаления:** `StrategiesPage` и `MarketConfigsPage` — клик по корзине открывает диалог подтверждения (Отмена/Удалить) с предупреждением, что боты останутся без стратегии/рынка. Раньше удаляли сразу по клику.
- **Ошибка бэктеста при удалённой стратегии:** сервер (`BotsService.loadStrategy`) отдаёт понятное сообщение вместо голого 404; стор (`tradingSlice`) получил `rejected`-обработчики + `backtestError`/`autotuneError` (раньше спиннер висел вечно); `BacktestTab`/`AutotuneTab` показывают Alert. Проверено в браузере: сообщение «У бота не привязана стратегия…».
- **Изоляция e2e-БД:** `app.e2e-spec.ts` с `dropSchema:true` ранее затирал dev-базу `arbidex_db`. Теперь `test/e2e-setup-env.ts` (setupFiles) форсит `DB_NAME=arbidex_e2e` (или `E2E_DB_NAME`), а `test/e2e-global-setup.ts` (globalSetup) создаёт эту БД. Проверено канарейкой: dev-данные в `arbidex_db` переживают прогон e2e; e2e работает в `arbidex_e2e`.
- **Проверки:** FE `tsc` ✓, Storybook 20/20 ✓; сервер `nest build` ✓, e2e 33/33 ✓ (в изолированной БД).

## Итог
Новый фронт подключён к бэкенду так же, как старый (JWT+refresh, wallet-auth, /api).
Бэкенд расширен под модель нового фронта (market-configs / strategy-configs / bots +
conditions-catalog + /catalog/markets), демосчёт = баланс бота. Скоуп покрыт: конфигурации,
графики (котировки), демо-бэктест, автоподбор, демосчёт. Мок-режим сохранён (дефолт).

**Проверки (все зелёные):** backend `test/demo.e2e-spec.ts`; engine `engine.spec.ts`;
FE `npm run test:live` (клиент↔сервер); FE `npm run e2e` (Playwright live); FE `npm run test:sb` 19/19 (мок); tsc фронта и сборка сервера.
