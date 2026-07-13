# ArbiDex React — прогресс

Формат: каждый шаг — статус, что сделано, как проверено (AC), заметки.
Статусы: ⬜ TODO · 🟨 IN PROGRESS · ✅ DONE · ⛔ BLOCKED

| # | Шаг | Статус | AC пройден |
|---|---|---|---|
| 0 | Scaffold | ✅ | build+SB+test-runner |
| 1 | Домен+моки+API+store | ✅ | tsc + 2 play-теста |
| 2 | Shell+routing+auth | ✅ | 4 play-теста |
| 3 | Dashboard | ✅ | 6 play-тестов |
| 4 | QuoteChart | ✅ | 8 play-тестов |
| 5 | Market config builder | ✅ | tsc + 10 play-тестов |
| 6 | Strategy config editor | ✅ | tsc + 12 play-тестов |
| 7 | Bot detail | ✅ | tsc + 14 play-тестов |
| 8 | Historical backtest | ✅ | tsc + 15 play-тестов |
| 9 | Live/demo/real | ✅ | tsc + 17 play-тестов |
| 10 | Add-bot wizard | ✅ | tsc + 18 play-тестов |
| 11 | Auto-tuning | ✅ | tsc + 19 play-тестов |
| 12 | Polish | ✅ | build + 19 play-тестов |

## Журнал

### Step 0 — Scaffold — ✅ DONE
- Пакет `arbi-dex-react`: Vite+React18+TS, RTK, react-router-6, MUI6 (тёмная тема), lightweight-charts, Storybook 8.4 (react-vite) + test-runner.
- Конфиги: tsconfig(app/node), vite (alias `@`), .storybook (main/preview/withAppProviders), theme.ts.
- Минимальный store (`ui` slice) + `makeStore(preloaded)` для стори.
- **AC пройден:** `npm run build` ✓, `npm run build-storybook` ✓, `npm run test:sb` → Smoke/Scaffold play-тест PASS (chromium).
- Скрипт `test:sb` = build-storybook → http-server storybook-static:6007 → test-storybook.

### Step 1 — Домен+моки+API+store — ✅ DONE
- `domain/types.ts` (Bot, MarketConfig, StrategyConfig, QuotePoint, Trade, Backtest/Autotune, User).
- `domain/conditionsCatalog.ts` — 9 условий (gate+trigger) с UI-мета, диапазонами редактирования и авто-подбора.
- `mocks/`: rng (детерминированный), quotes (генератор серий), simulate (бэктест-симулятор), autotune (свип комбинаций), seed (7 рынков, 2 market-config, 2 стратегии, 4 бота).
- `api/`: in-memory БД (`db.ts`, resetDb) + async фасад с задержкой (auth/catalog/bots/marketConfigs/strategyConfigs/quotes/backtest/autotune).
- `store/`: слайсы auth, bots, marketConfigs, strategyConfigs, catalog, trading + ui; `makeStore(preloaded)`.
- **AC пройден:** `tsc -b` ✓; `test:sb` → Foundation/MockData + Smoke PASS (данные приходят через thunk'и).

### Step 2 — Shell+routing+auth — ✅ DONE
- `LoginPage` (wallet-connect, авто-регистрация), `RequireAuth` guard, `AppShell` (sidebar + topbar с адресом/выходом), `AppRoutes` (login public + защищённые dashboard/market-configs/strategies/bots).
- Заглушки страниц (dashboard/market-configs/strategies/bot/add-bot) + `PageHeader`.
- **AC пройден:** `Auth/Login flow` → ConnectRedirectsToDashboard (клик → guard → Дашборд). Всего 4 play-теста PASS.

### Step 3 — Dashboard — ✅ DONE
- Общие компоненты: `format` (деньги/%/время/длит.), `StatusBadge`+`ModeBadge`, `PnlValue`, `StatCard`, `BotCard`.
- `DashboardPage`: KPI-строка (ботов/PnL/баланс) + карточки ботов, клик → `/bots/:id`.
- **AC пройден:** Dashboard/Page → ListsBots (4 бота + KPI) и OpensBotDetail (клик → детали). Всего 6 play-тестов PASS.

### Step 4 — QuoteChart — ✅ DONE
- `chart/colors.ts`, `chart/QuoteChart.tsx` (обёртка lightweight-charts: линии + маркеры buy/sell, ResizeObserver).
- `chart/QuoteChartPanel.tsx`: наблюдаемые рынки как отдельные линии ↔ тумблер «Привести к средневзвешенной», линии buy/sell торгового рынка, маркеры сделок, DOM-легенда.
- **AC пройден:** Chart/QuoteChartPanel → WeightedToggle (клик сворачивает 3 линии в «Средневзвешенную»). 8 play-тестов PASS. lightweight-charts работает в headless chromium.

### Step 5 — Market config builder — ✅ DONE
- `MarketPicker` (Autocomplete по каталогу, фильтр cex/dex), `marketLabel`, `preview.ts` (серии наблюдаемых + средневзвешенная + buy/sell торгового).
- `MarketConfigsPage` (таблица + удаление + создать), `MarketConfigEditorPage` (имя, торговый рынок, список наблюдаемых add/remove, тумблер historical/realtime, превью-график с тумблером средневзвешенной).
- **AC пройден:** MarketConfig/Builder → List + CreateConfig (добавить наблюдаемый → трейдинг-рынок → линии buy/sell → сохранить → в списке). tsc ✓, 10 play-тестов PASS.

### Step 6 — Strategy config editor — ✅ DONE
- `CoefficientField` (число+единица), `RangeField` (min/max/step + вкл — диапазоны авто-подбора), `ConditionEditor` (условие: enable + параметры + диапазоны).
- `StrategyEditorPage` (секции покупки/продажи из каталога, тумблер показа диапазонов авто-подбора), `StrategiesPage` (список).
- **AC пройден:** Strategy/Editor → CreateAndEditCoefficient (правка коэффициента, показ диапазонов, отключение триггера, сохранение → в списке). tsc ✓, 12 play-тестов PASS.

### Step 7 — Bot detail — ✅ DONE
- `strategies/summary.ts` (ключевые коэффициенты), `OverviewTab` (KPI + сводка конфигов рынков/стратегии + график котировок), заглушки `BacktestTab`/`LiveTab`/`AutotuneTab`.
- `BotDetailPage`: шапка (статус, тумблер режима демо/реальный, старт/пауза/стоп) + табы Обзор/Бэктест/Реальное время/Авто-подбор.
- **AC пройден:** Bot/Detail → Overview (KPI + сводки + переключение таба), PauseControl (пауза меняет статус). tsc ✓, 14 play-тестов PASS.

### Step 8 — Historical backtest — ✅ DONE
- `TradesTable` (время/сторона/цена/объём/PnL/причина), `BacktestTab` (период, нач. баланс, запуск → KPI + график с маркерами сделок + таблица).
- Настроил генератор котировок: персистентная дивергенция торгового рынка → устойчивые арбитражные окна. Проверено: консерв. 12 сделок (+3.73%), агрессивная 16 (+7%).
- **AC пройден:** Bot/Backtest → RunBacktest (запуск → bt-result, KPI, ≥1 сделка в таблице, линии buy/sell). tsc ✓, 15 play-тестов PASS.

### Step 9 — Live/demo/real — ✅ DONE
- `LiveTab`: мок-стриминг тиков (setInterval + thunk pushTick), start/stop, KPI (цены + счётчик живых тиков), график в реальном времени, баннер предупреждения для реального режима.
- **AC пройден:** Bot/Live → StreamTicks (старт → тики растут → стоп) и RealModeWarning (bot_2 real → баннер). tsc ✓, 17 play-тестов PASS.

### Step 10 — Add-bot wizard — ✅ DONE
- `AddBotPage`: Stepper (Основное→Конфиг рынков→Стратегия→Обзор), связывает market-config + strategy, создаёт бота (createBot) → переход на страницу бота.
- **AC пройден:** Bot/AddWizard → CreateBot (полный проход мастера → детали нового бота). tsc ✓, 18 play-тестов PASS.

### Step 11 — Auto-tuning — ✅ DONE
- `autotuneLabels.ts` (метки flattened-ключей, применение комбинации к стратегии), `AutotuneTab`: список подбираемых диапазонов, запуск свипа, лучшая комбинация (KPI + параметры), грид всех комбинаций по PnL, «Применить к стратегии» (updateStrategyConfig + snackbar).
- **AC пройден:** Bot/Autotune → RunAutotune (диапазоны → грид, PnL убыв., применить → snackbar). tsc ✓, 19 play-тестов PASS.

### Step 12 — Polish — ✅ DONE
- `README.md` (стек, запуск, структура, соответствие фичам ТЗ).
- Финальная проверка: `npm run build` ✓, `npm run test:sb` → **12 сьютов, 19 play-тестов PASS**.
- Все 12 шагов закрыты; каждая фича ТЗ покрыта play-тестами.

## Итог
Прототип готов: React+Redux, замоканные данные, рабочие интерфейсы по всем 8 фичам ТЗ.
Автотесты: `npm run test:sb` (19 play-функций, headless chromium). Запуск: `npm run dev`.
