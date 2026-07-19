import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
  Alert,
  Chip,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SellIcon from '@mui/icons-material/Sell';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Tooltip, IconButton } from '@mui/material';
import type { Bot, ExecutorBalances, LiveTrade, QuotePoint, Side, Trade } from '../../domain/types';
import { StatCard } from '../../components/StatCard';
import { QuoteChartPanel } from '../../components/chart/QuoteChartPanel';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBot } from '../../store/botsSlice';
import { api, IS_LIVE } from '../../api';
import type { BotStepResult } from '../../api/types';
import { subscribeMarket, type MarketTick } from '../../api/liveSocket';
import { assembleMarketPreview, type TradingPoint } from '../../api/assemble';
import { marketLabelFromId } from '../../api/live';
import type { PreviewSeries } from '../../api/types';
import { StepResultPanel } from './StepResultPanel';
import { LiveTradesTable, TradesMarkdownActions } from './LiveTradesTable';
import { fmtTime } from '../../components/format';

/** The chart keeps at most the last 30 minutes of live data. */
const WINDOW_SEC = 30 * 60;
/** Redraw cadence while ticks stream in. */
const FLUSH_MS = 500;
/** Do not call the step-result API more often than this. */
const INSPECT_MIN_MS = 3000;
/** Poll cadence for history / trades / bot state of a running bot. */
const POLL_MS = 20_000;

/** Human amount: 2 decimals for big values, significant digits for tiny ones
 * (0.001 WBTC must not collapse to «0.00»). */
function fmtAmount(v: number): string {
  if (!isFinite(v)) return '—';
  return Math.abs(v) >= 1 ? v.toFixed(2) : v === 0 ? '0' : v.toPrecision(4);
}

/** Step time with seconds for the pinned-step chip. */
function fmtStepTime(sec: number): string {
  return new Date(sec * 1000).toLocaleTimeString('ru-RU');
}

/** Pull the human message out of an API error (`POST … 400 … {"message":…}`). */
function apiErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const json = raw.match(/\{.*\}\s*$/s);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]) as { message?: string | string[] };
      if (parsed.message) return Array.isArray(parsed.message) ? parsed.message.join('; ') : parsed.message;
    } catch {
      /* not JSON — fall through to the raw message */
    }
  }
  return raw;
}

export function LiveTab({ bot }: { bot: Bot }) {
  const dispatch = useAppDispatch();
  const marketConfig = useAppSelector((s) => s.marketConfigs.items.find((m) => m.id === bot.marketConfigId));
  const isReal = bot.mode === 'real-live';

  const [quotes, setQuotes] = useState<QuotePoint[]>([]);
  const [streaming, setStreaming] = useState(false);

  // ── История с момента запуска бота ────────────────────────────────────────
  // Запущенный бот: график начинается с bot.startedAt (момент старта скрипта
  // на сервере), история подтягивается с сервера и дополняется live-потоком.
  const isRunning = IS_LIVE && bot.status === 'running' && bot.mode !== 'idle';
  const startedMs = isRunning && (bot.startedAt ?? 0) > 0 ? bot.startedAt! : null;
  const [history, setHistory] = useState<QuotePoint[]>([]);
  useEffect(() => {
    if (!startedMs) {
      setHistory([]);
      return;
    }
    let alive = true;
    const load = () =>
      api.bots
        .quotes(bot.id, { from: startedMs })
        .then((r) => {
          if (!alive) return;
          // Chart times are unix seconds (fractional ok); the server sends ms.
          setHistory(r.quotes.map((q) => (q.time > 1e12 ? { ...q, time: q.time / 1000 } : q)));
        })
        .catch(() => {
          /* история недоступна — остаётся live-поток */
        });
    load();
    const t = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [bot.id, startedMs]);

  // Live stream: subscribe to the config's markets via the /live-chart socket,
  // assemble steps every FLUSH_MS and keep only the last 30 minutes.
  const observedKey = marketConfig?.observedMarketIds.join(',') ?? '';
  useEffect(() => {
    if (!IS_LIVE || !marketConfig) return;
    const observedIds = marketConfig.observedMarketIds;
    const tradingId = marketConfig.tradingMarketId || null;
    if (!tradingId && observedIds.length === 0) return;
    const weights = marketConfig.weights ?? {};

    const observedData = new Map<string, { time: number; value: number }[]>(
      observedIds.map((id) => [id, []]),
    );
    let tradingData: TradingPoint[] = [];
    const lastBA = new Map<string, { bid?: number; ask?: number }>();
    let dirty = false;

    const onTick = (id: string, isTrading: boolean) => (tick: MarketTick) => {
      const sec = Math.floor(tick.t / 1000);
      const ba = lastBA.get(id) ?? {};
      ba[tick.field] = tick.v;
      lastBA.set(id, ba);
      if (isTrading) {
        if (ba.bid != null && ba.ask != null) {
          if (tradingData.length && tradingData[tradingData.length - 1].time === sec)
            tradingData[tradingData.length - 1] = { time: sec, bid: ba.bid, ask: ba.ask };
          else tradingData = [...tradingData, { time: sec, bid: ba.bid, ask: ba.ask }];
          dirty = true;
        }
      } else {
        const mid = ba.bid != null && ba.ask != null ? (ba.bid + ba.ask) / 2 : ba.bid ?? ba.ask;
        if (mid != null) {
          const arr = observedData.get(id)!;
          if (arr.length && arr[arr.length - 1].time === sec) arr[arr.length - 1] = { time: sec, value: mid };
          else arr.push({ time: sec, value: mid });
          dirty = true;
        }
      }
    };

    const unsubs = observedIds.map((id) => subscribeMarket(id, onTick(id, false)));
    if (tradingId) unsubs.push(subscribeMarket(tradingId, onTick(tradingId, true)));
    setStreaming(true);

    const timer = window.setInterval(() => {
      if (!dirty) return;
      dirty = false;
      // Trim everything older than the 30-minute window, but keep the last
      // pre-window value clamped to the window edge: rare DEX ticks must keep
      // forward-filling the buy/sell lines instead of vanishing.
      const cutoff = Math.floor(Date.now() / 1000) - WINDOW_SEC;
      const trim = <T extends { time: number }>(arr: T[]): T[] => {
        const kept = arr.filter((p) => p.time >= cutoff);
        if (kept.length < arr.length && (kept.length === 0 || kept[0].time > cutoff)) {
          const lastOld = arr.filter((p) => p.time < cutoff).pop();
          if (lastOld) kept.unshift({ ...lastOld, time: cutoff });
        }
        return kept;
      };
      tradingData = trim(tradingData);
      for (const [id, arr] of observedData) {
        observedData.set(id, trim(arr));
      }
      const observedSeries: PreviewSeries[] = observedIds.map((id) => ({
        id,
        label: marketLabelFromId(id),
        data: observedData.get(id)!.slice(),
      }));
      setQuotes(assembleMarketPreview(observedSeries, tradingData.slice(), weights).quotes);
    }, FLUSH_MS);

    return () => {
      unsubs.forEach((u) => u());
      window.clearInterval(timer);
      setStreaming(false);
      setQuotes([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketConfig?.id, marketConfig?.tradingMarketId, observedKey]);

  // График = история с запуска + live-поток (поток точнее на последних шагах,
  // история закрывает всё, что было до открытия страницы).
  const chartQuotes = useMemo<QuotePoint[]>(() => {
    if (history.length === 0) return quotes;
    const firstStream = quotes[0]?.time ?? Infinity;
    return history.filter((q) => q.time < firstStream).concat(quotes);
  }, [history, quotes]);

  // Every new step → inspect the latest one via the API (throttled) and show
  // the breakdown in the side panel.
  const [stepResult, setStepResult] = useState<BotStepResult | null>(null);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  // Закреплённый шаг (клик по сделке/графику): панель разбора держит его и не
  // следует за последним шагом, пока не нажать «К последнему шагу».
  const [pinnedTime, setPinnedTime] = useState<number | null>(null);
  // Откуда разбор: у сделок движка — записанное решение из журнала
  // («из истории»), иначе — расчёт через API.
  const [stepSource, setStepSource] = useState<'history' | 'api'>('api');
  const lastInspectedStep = useRef<number | null>(null);
  const lastCallAt = useRef(0);
  const inFlight = useRef(false);
  const lastTime = quotes[quotes.length - 1]?.time ?? null;
  useEffect(() => {
    if (lastTime == null || !IS_LIVE || pinnedTime != null) return;
    if (lastInspectedStep.current === lastTime) return;
    const now = Date.now();
    if (inFlight.current || now - lastCallAt.current < INSPECT_MIN_MS) return;
    lastInspectedStep.current = lastTime;
    lastCallAt.current = now;
    inFlight.current = true;
    setStepLoading(true);
    api.bots
      .stepResult(bot.id, { time: lastTime * 1000 })
      .then((r) => {
        setStepResult(r);
        setStepSource('api');
        setStepError(null);
      })
      .catch((e) => {
        setStepError((e as Error).message);
      })
      .finally(() => {
        inFlight.current = false;
        setStepLoading(false);
      });
  }, [lastTime, bot.id, pinnedTime]);

  // Разбор конкретного шага (клик по сделке в журнале или точке графика):
  // закрепляет шаг в панели и подсвечивает его на графике — как в бэктесте.
  // `stored` — записанное при сделке решение движка: показывается сразу
  // («из истории»), пересчитать через API можно кнопкой в панели.
  const inspectStep = (sec: number, stored?: BotStepResult | null) => {
    setPinnedTime(sec);
    setSelectedTradeTime(sec);
    if (stored) {
      setStepResult(stored);
      setStepSource('history');
      setStepError(null);
      return;
    }
    setStepLoading(true);
    api.bots
      .stepResult(bot.id, { time: Math.round(sec * 1000) })
      .then((r) => {
        setStepResult(r);
        setStepSource('api');
        setStepError(null);
      })
      .catch((e) => setStepError((e as Error).message))
      .finally(() => setStepLoading(false));
  };

  // «К последнему шагу»: снять закрепление, панель снова следует за потоком.
  const unpinStep = () => {
    setPinnedTime(null);
    setSelectedTradeTime(null);
    lastInspectedStep.current = null; // форсируем свежий разбор последнего шага
  };

  const last = chartQuotes[chartQuotes.length - 1];

  // ── Manual trading (buy/sell buttons) ─────────────────────────────────────
  const [liveTrades, setLiveTrades] = useState<LiveTrade[]>([]);
  const [tradePending, setTradePending] = useState(false);
  const [lastTrade, setLastTrade] = useState<LiveTrade | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Existing trade log → chart markers survive a page reload.
  useEffect(() => {
    if (!IS_LIVE) return;
    let alive = true;
    api.bots
      .trades(bot.id)
      .then((ts) => {
        if (alive) setLiveTrades(ts);
      })
      .catch(() => {
        /* журнал недоступен — маркеры появятся по мере сделок */
      });
    return () => {
      alive = false;
    };
  }, [bot.id]);

  // Запущенный бот торгует сам (движок на сервере) — журнал сделок и счёт
  // бота обновляются поллингом, чтобы сделки движка появлялись без перезагрузки.
  useEffect(() => {
    if (!isRunning) return;
    const t = window.setInterval(() => {
      api.bots
        .trades(bot.id)
        .then(setLiveTrades)
        .catch(() => {});
      dispatch(fetchBot(bot.id));
    }, POLL_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id, isRunning]);

  // Real mode: executor contract balances — fetched on every visit to the tab
  // and refreshed after each trade (real trades spend the executor's tokens).
  const [executor, setExecutor] = useState<ExecutorBalances | null>(null);
  const [executorError, setExecutorError] = useState<string | null>(null);
  const loadExecutor = () => {
    if (!IS_LIVE || !isReal) return;
    api.bots
      .executorBalance(bot.id)
      .then((r) => {
        setExecutor(r);
        setExecutorError(null);
      })
      .catch((e) => setExecutorError(apiErrorMessage(e)));
  };
  useEffect(() => {
    setExecutor(null);
    loadExecutor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id, isReal]);

  // «Обнулить демосчёт»: баланс → начальный, позиция/PnL — в ноль, журнал
  // демо-сделок (и его маркеры на графике) очищается.
  const [resetting, setResetting] = useState(false);
  const resetAccount = async () => {
    setResetting(true);
    setTradeError(null);
    setLastTrade(null);
    try {
      await api.bots.resetAccount(bot.id);
      setLiveTrades((ts) => ts.filter((t) => t.mode !== 'demo'));
      dispatch(fetchBot(bot.id));
    } catch (e) {
      setTradeError(apiErrorMessage(e));
    } finally {
      setResetting(false);
    }
  };

  // Рыночная семантика кнопок. График котирует НЕ-стейбл актив пары (WBTC в
  // USDC и т.п.); если бот держит баланс именно в нём (инверсный листинг:
  // baseAsset — стейбл), то бот-«buy» (quote→base) на деле ПРОДАЁТ этот актив
  // по цене продажи. Кнопки/сообщения/маркеры показываем в терминах рыночного
  // актива, а на сервер шлём бот-сторону.
  const isStableSym = (s: string): boolean => s.toUpperCase().includes('USD');
  const inverted = isStableSym(bot.baseAsset) && !isStableSym(bot.quoteAsset);
  const displayAsset = inverted ? bot.quoteAsset : bot.baseAsset;
  const toBotSide = (s: Side): Side => (inverted ? (s === 'buy' ? 'sell' : 'buy') : s);
  const toDisplaySide = toBotSide; // преобразование симметрично

  const doTrade = async (displaySide: Side) => {
    if (!last || tradePending) return;
    setTradePending(true);
    setTradeError(null);
    setLastTrade(null);
    try {
      const expectedPrice = displaySide === 'buy' ? last.buyQuote : last.sellQuote;
      const r = await api.bots.trade(bot.id, { side: toBotSide(displaySide), expectedPrice });
      setLiveTrades((ts) => [...ts, r.trade]);
      setLastTrade(r.trade);
      // Balance / position / PnL changed — refresh the bot in the store.
      dispatch(fetchBot(bot.id));
      if (isReal) loadExecutor();
    } catch (e) {
      setTradeError(apiErrorMessage(e));
    } finally {
      setTradePending(false);
    }
  };

  // Запущенный бот: на графике и в журнале — сделки с момента запуска скрипта.
  const visibleTrades = useMemo<LiveTrade[]>(
    () => (startedMs ? liveTrades.filter((t) => t.time >= startedMs) : liveTrades),
    [liveTrades, startedMs],
  );

  // Trades → chart markers: snap each trade to the nearest visible step so the
  // marker lands on an existing series point (markers bind to bar times).
  const chartTrades = useMemo<Trade[]>(() => {
    if (chartQuotes.length === 0 || visibleTrades.length === 0) return [];
    const times = chartQuotes.map((q) => q.time);
    return visibleTrades
      .map((t) => {
        const sec = Math.round(t.time / 1000);
        if (sec < times[0] - 60) return null; // до окна графика — не показываем
        let nearest = times[0];
        let bestD = Math.abs(times[0] - sec);
        for (const ts of times) {
          const d = Math.abs(ts - sec);
          if (d < bestD) {
            bestD = d;
            nearest = ts;
          }
        }
        const trade: Trade = {
          id: t.id,
          time: nearest,
          // Маркер в рыночной семантике: buy инверсного бота = продажа актива
          // графика — стрелка и тултип должны лечь на линию продажи.
          side: toDisplaySide(t.side),
          price: t.price ?? t.expectedPrice ?? 0,
          amount: t.amountIn,
          pnl: t.pnl ?? undefined,
          status: t.status,
        };
        return trade;
      })
      .filter((t): t is Trade => t !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartQuotes, visibleTrades, inverted]);

  // Клик по строке журнала → подсветить шаг сделки на графике.
  const [selectedTradeTime, setSelectedTradeTime] = useState<number | null>(null);

  const positionSize = bot.positionSize ?? 0;
  const canTrade = IS_LIVE && bot.mode !== 'idle' && !!last;

  // Живость движка: проверка раз в ~30 с; давность больше 90 с — тревога.
  const lastTickAgoSec =
    isRunning && (bot.lastTickAt ?? 0) > 0 ? Math.max(0, Math.round((Date.now() - bot.lastTickAt!) / 1000)) : null;
  const engineAlive = lastTickAgoSec != null && lastTickAgoSec < 90;
  const cooldownActive = isRunning && (bot.failCooldownUntil ?? 0) > Date.now();

  return (
    <Box>
      {isReal && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="real-warning">
          Реальный режим: сделки исполняются настоящими транзакциями on-chain.
        </Alert>
      )}

      {/* Живость движка: бот запущен — сервер оценивает стратегию каждые 30 с. */}
      {isRunning && (
        <Alert
          severity={lastTickAgoSec == null ? 'info' : engineAlive ? 'success' : 'warning'}
          sx={{ mb: 2 }}
          data-testid="engine-status"
        >
          {lastTickAgoSec == null
            ? 'Бот запущен, движок ещё не сделал первую проверку (тик раз в 30 с).'
            : engineAlive
              ? `Движок работает: проверка стратегии ${lastTickAgoSec} с назад.`
              : `Движок давно не тикал (${lastTickAgoSec} с назад) — проверьте сервер.`}
          {(bot.lastSignalAt ?? 0) > 0 && <> Последний сигнал: {fmtTime(bot.lastSignalAt! / 1000)}.</>}
          {cooldownActive && <> Пауза после неудачной сделки до {fmtTime(bot.failCooldownUntil! / 1000)}.</>}
          {(bot.startedAt ?? 0) > 0 && <> Запущен: {fmtTime(bot.startedAt! / 1000)}.</>}
          {bot.openPosition && (
            <> Позиция открыта — сигналы покупки игнорируются, движок ждёт сигнала продажи.</>
          )}
          {!bot.openPosition && bot.balance <= 0 && (
            <> Баланс нулевой — покупки невозможны, обнулите счёт или пополните баланс.</>
          )}
        </Alert>
      )}

      {!IS_LIVE && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="live-mock-note">
          Поток реального времени доступен только в live-режиме (нужен сервер с вебсокетами).
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <StatCard label="Цена покупки" value={last ? last.buyQuote.toFixed(2) : '—'} />
        <StatCard label="Цена продажи" value={last ? last.sellQuote.toFixed(2) : '—'} />
        <StatCard
          label="Средневзвешенная"
          value={last && last.avgObservedQuote > 0 ? last.avgObservedQuote.toFixed(2) : '—'}
        />
        <StatCard
          label="Шагов в окне"
          value={<span data-testid="live-step-count">{quotes.length}</span>}
          sub={
            <Typography variant="caption" color={streaming ? 'success.main' : 'text.secondary'}>
              {streaming ? '● поток активен' : 'нет потока'}
            </Typography>
          }
        />
      </Stack>

      {/* Manual trading: quote via the executor contract (demo) / on-chain swap (real). */}
      {IS_LIVE && (
        <Card sx={{ mb: 2 }} data-testid="live-trading">
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <Typography variant="subtitle1">
                Торговля {isReal ? '(реальная, через экзекутор)' : '(демо, котировка через квотер)'}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`Проскальзывание ≤ ${bot.slippagePct ?? 0.5}%`}
                data-testid="trade-slippage"
              />
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="body2" color="text.secondary" data-testid="trade-balance">
                Баланс: {fmtAmount(bot.balance)} {bot.quoteAsset}
              </Typography>
              {bot.openPosition && positionSize > 0 && (
                <Typography variant="body2" color="text.secondary" data-testid="trade-position">
                  Позиция: {fmtAmount(positionSize)} {bot.baseAsset} @ {fmtAmount(bot.entryPrice ?? 0)}
                </Typography>
              )}
              <Tooltip title={`Обнулить демосчёт: баланс → ${fmtAmount(bot.initialBalance)} ${bot.quoteAsset}, позиция и PnL — в ноль, журнал демо-сделок очищается`}>
                <span>
                  <IconButton
                    size="small"
                    onClick={resetAccount}
                    disabled={resetting || tradePending}
                    data-testid="reset-account"
                  >
                    <RestartAltIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            {/* Real mode: executor address + its token balances (funds real trades). */}
            {isReal && (
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}
                data-testid="executor-info"
              >
                <Typography variant="body2" color="text.secondary">
                  Executor:{' '}
                  {executor
                    ? `${executor.executorAddress.slice(0, 8)}…${executor.executorAddress.slice(-6)}`
                    : 'загрузка…'}
                </Typography>
                {executor?.balances.map((b) => (
                  <Chip
                    key={b.address}
                    size="small"
                    variant="outlined"
                    label={`${b.symbol}: ${b.balance.toFixed(6)}`}
                    data-testid={`executor-balance-${b.symbol}`}
                  />
                ))}
                <Typography variant="caption" color="text.secondary">
                  Реальные сделки — тестовые (эквивалент 1 USDC) и тратят токены executor-контракта.
                </Typography>
                {executorError && (
                  <Typography variant="caption" color="error.main" data-testid="executor-error">
                    {executorError}
                  </Typography>
                )}
              </Stack>
            )}

            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1.5 }}>
              <Button
                variant="contained"
                color="success"
                startIcon={<ShoppingCartIcon />}
                // Модель позиции едина для демо и реала: «купить актив графика»
                // доступно, когда бот держит валюту, которой за него платят
                // (бот-side buy → нет позиции, sell → есть позиция).
                disabled={
                  !canTrade || tradePending ||
                  (toBotSide('buy') === 'buy' ? bot.openPosition : !bot.openPosition)
                }
                onClick={() => doTrade('buy')}
                data-testid="trade-buy"
              >
                Купить {displayAsset}{last ? ` по ${last.buyQuote.toFixed(2)}` : ''}
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<SellIcon />}
                disabled={
                  !canTrade || tradePending ||
                  (toBotSide('sell') === 'buy' ? bot.openPosition : !bot.openPosition)
                }
                onClick={() => doTrade('sell')}
                data-testid="trade-sell"
              >
                Продать {displayAsset}{last ? ` по ${last.sellQuote.toFixed(2)}` : ''}
              </Button>
              {tradePending && (
                <Stack direction="row" spacing={1} alignItems="center" data-testid="trade-pending">
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Идёт транзакция…
                  </Typography>
                </Stack>
              )}
              {bot.mode === 'idle' && (
                <Typography variant="body2" color="text.secondary">
                  Бот выключен — включите демо или реальный режим в настройках.
                </Typography>
              )}
            </Stack>

            {tradeError && (
              <Alert severity="error" sx={{ mt: 1.5 }} data-testid="trade-error">
                {tradeError}
              </Alert>
            )}
            {lastTrade && (
              <Alert
                severity={lastTrade.status === 'success' ? 'success' : 'error'}
                sx={{ mt: 1.5 }}
                data-testid="trade-result"
              >
                {lastTrade.status === 'success' ? (
                  <>
                    {toDisplaySide(lastTrade.side) === 'buy' ? 'Куплено' : 'Продано'} {displayAsset} по{' '}
                    {(lastTrade.price ?? 0).toFixed(4)}
                    {lastTrade.side === 'sell' && lastTrade.pnl != null && (
                      <> · PnL {lastTrade.pnl >= 0 ? '+' : ''}{fmtAmount(lastTrade.pnl)} {bot.quoteAsset}</>
                    )}
                    {lastTrade.txUrl && (
                      <> · <a href={lastTrade.txUrl} target="_blank" rel="noreferrer">транзакция</a></>
                    )}
                  </>
                ) : (
                  <>Сделка не прошла: {lastTrade.error ?? 'неизвестная ошибка'}</>
                )}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live chart (2/3) + latest-step breakdown (1/3), like the backtest tab. */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
        <Box sx={{ width: { xs: '100%', lg: '66.667%' }, flexShrink: 0 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1">Котировки в реальном времени</Typography>
                {streaming && (
                  <Chip size="small" color="success" variant="outlined" label="● LIVE" data-testid="live-indicator" sx={{ fontWeight: 700 }} />
                )}
                {pinnedTime != null && (
                  <>
                    <Chip
                      size="small"
                      color="info"
                      variant="outlined"
                      label={`разбор шага: ${fmtStepTime(pinnedTime)}`}
                      data-testid="pinned-step-chip"
                    />
                    <Button size="small" onClick={unpinStep} data-testid="unpin-step">
                      К последнему шагу
                    </Button>
                  </>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {startedMs ? `с запуска (${fmtTime(startedMs / 1000)})` : 'последние 30 минут'}
                </Typography>
              </Stack>
              {chartQuotes.length === 0 ? (
                <Box sx={{ height: 340, display: 'grid', placeItems: 'center' }}>
                  <Typography color="text.secondary">
                    {IS_LIVE ? 'Ожидание тиков рынков…' : 'Нет потока'}
                  </Typography>
                </Box>
              ) : (
                <QuoteChartPanel
                  quotes={chartQuotes}
                  trades={chartTrades}
                  hasTradingMarket={!!marketConfig?.tradingMarketId}
                  height={340}
                  defaultWeighted
                  selectedTime={pinnedTime ?? selectedTradeTime ?? last?.time ?? null}
                  onTimeClick={inspectStep}
                />
              )}
            </CardContent>
          </Card>
        </Box>
        <StepResultPanel
          result={stepResult}
          loading={stepLoading}
          error={stepError}
          source={stepResult ? stepSource : null}
          // Пересчитать закреплённый шаг через API (для «из истории» — сверка
          // записанного решения с текущим расчётом, как в бэктесте).
          onRecalc={pinnedTime != null ? () => inspectStep(pinnedTime) : undefined}
        />
      </Stack>

      {/* Журнал live-сделок — как таблица сделок в бэктесте, но с фактическим
          статусом исполнения; клик по строке подсвечивает шаг на графике. */}
      {IS_LIVE && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">
                Сделки{startedMs ? ' с момента запуска' : ''} ({visibleTrades.length})
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <TradesMarkdownActions
                trades={visibleTrades}
                markdownOpts={{
                  title: `Сделки — ${bot.name} (${isReal ? 'реальная торговля' : 'демо'})${
                    startedMs ? `, сессия с ${fmtTime(startedMs / 1000)}` : ''
                  }`,
                  displaySide: toDisplaySide,
                  displayAsset,
                  cashAsset: bot.quoteAsset,
                }}
                fileName={`${bot.name.replace(/[^\wа-яА-ЯёЁ-]+/g, '_')}-trades.md`}
              />
            </Stack>
            <LiveTradesTable
              trades={visibleTrades}
              displaySide={toDisplaySide}
              displayAsset={displayAsset}
              onRowClick={(t) => {
                // Маркеры прибиты к ближайшему шагу — подсветка и разбор туда же.
                const sec = Math.round(t.time / 1000);
                const times = chartQuotes.map((q) => q.time);
                if (times.length === 0) return;
                let nearest = times[0];
                let bestD = Math.abs(times[0] - sec);
                for (const ts of times) {
                  const d = Math.abs(ts - sec);
                  if (d < bestD) {
                    bestD = d;
                    nearest = ts;
                  }
                }
                inspectStep(nearest, t.stepResult as BotStepResult | null | undefined);
              }}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
