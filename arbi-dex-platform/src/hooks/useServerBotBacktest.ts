import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BotPeriodState } from './useBotPeriod'
import { CHART_POLL_INTERVAL_MS, type ChartPoint } from '../services/chartDataService'
import {
  executeBotTrade,
  type ExcludedTimeRange,
  fetchBotQuotes,
  fetchBotTrades,
  fetchServerBot,
  fetchServerStepResult,
  runServerBacktest,
  type ServerBacktestResult,
  type ServerBot,
  type ServerBotStepResult,
  type ServerBotTrade,
  type ServerChartNetwork,
  type ServerQuotePoint,
} from '../services/botsApi'
import {
  buildStepLogEventFromBacktestRecord,
  findNearestStepRecord,
  findQuoteIndexByTime,
} from '../lib/inspectBotStep'
import { STRATEGY_CONFIG_UPDATED_EVENT } from '../lib/pushStrategyRulesToServer'
import { mapServerLiveTradeToLogEvent, mapServerStepToLogEvent, mapServerTradeToLogEvent } from '../lib/mapServerBotStepResult'
import { derivePositionAtTime } from '../lib/derivePositionAtTime'
import { isTimeInExcludedRanges } from '../lib/excludedRanges'
import type { SimulationLogEvent } from '../simulation/simulationViewerTypes'
import { NETWORK_COLORS } from '../simulation/simulationNetworkTypes'

const TRADING_NET_ID = 'trading'
const STABLE_ASSET_FRAGMENT = 'USD'
const BACKTEST_MAX_POINTS = 1_000

function mergeQuotes(previous: ServerQuotePoint[], incoming: ServerQuotePoint[]): ServerQuotePoint[] {
  const byTime = new Map(previous.map((point) => [point.time, point]))
  for (const point of incoming) byTime.set(point.time, point)
  return [...byTime.values()].sort((a, b) => a.time - b.time)
}

function mergeChartData(previous: ChartPoint[], incoming: ChartPoint[]): ChartPoint[] {
  const byTime = new Map(previous.map((point) => [point.t, point]))
  for (const point of incoming) byTime.set(point.t, point)
  return [...byTime.values()].sort((a, b) => a.t - b.t)
}

function chartDataForQuotes(chartData: ChartPoint[], quotes: ServerQuotePoint[]): ChartPoint[] {
  const quoteTimes = new Set(quotes.map((quote) => quote.time))
  return chartData.filter((point) => quoteTimes.has(point.t))
}

function mergeTrades(previous: ServerBotTrade[], incoming: ServerBotTrade[]): ServerBotTrade[] {
  const byId = new Map(previous.map((trade) => [trade.id, trade]))
  for (const trade of incoming) byId.set(trade.id, trade)
  return [...byId.values()].sort((a, b) => a.time - b.time)
}

function isStableAsset(symbol: string): boolean {
  return symbol.toUpperCase().includes(STABLE_ASSET_FRAGMENT)
}

function resolveInspectPosition(
  time: number,
  bot: ServerBot,
  backtest: ServerBacktestResult | null,
  liveTrades: ServerBotTrade[],
) {
  if (backtest?.trades?.length) {
    const fromBacktest = derivePositionAtTime(
      backtest.trades.map((t) => ({
        time: t.time,
        side: t.side,
        price: t.price,
        amount: t.amount,
      })),
      time,
    )
    if (fromBacktest) return fromBacktest
  }

  const fromLive = derivePositionAtTime(
    liveTrades
      .filter((t) => t.status === 'success')
      .map((t) => ({
        time: t.time,
        side: t.side,
        price: t.price ?? t.expectedPrice ?? 0,
        amount: t.amountIn,
      })),
    time,
  )
  if (fromLive) return fromLive

  const positionOpenedAt = bot.positionOpenedAt ?? 0
  const entryPrice = bot.entryPrice ?? 0
  if (bot.openPosition && positionOpenedAt > 0 && time >= positionOpenedAt && entryPrice > 0) {
    return {
      entryPrice,
      openedAt: positionOpenedAt,
      size: bot.positionSize ?? 0,
    }
  }

  return null
}

function quotesToChartPoints(quotes: ServerQuotePoint[]): ChartPoint[] {
  return quotes.map((q) => ({
    t: q.time,
    label: new Date(q.time).toISOString(),
    avg: q.avgObservedQuote,
    [`${TRADING_NET_ID}_buy`]: q.buyQuote,
    [`${TRADING_NET_ID}_sell`]: q.sellQuote,
  }))
}

export type ServerStepSource = 'backtest' | 'api' | null

export interface UseBotBacktestOptions {
  bot: ServerBot
  period: BotPeriodState
  excludedRanges?: ExcludedTimeRange[]
  enabled?: boolean
  onBotRefresh?: () => void
  onBotUpdated?: (bot: ServerBot) => void
  /** While picking period on chart, defer quote reload until pick completes. */
  suspendPeriodReload?: boolean
  /**
   * Keep chart in sync with the live tip: always poll for new steps/trades and
   * follow the playhead when the user is at the end of the series.
   */
  followLive?: boolean
}

export function useBotBacktest({
  bot,
  period,
  excludedRanges = [],
  enabled = true,
  onBotRefresh,
  onBotUpdated,
  suspendPeriodReload = false,
  followLive = false,
}: UseBotBacktestOptions) {
  const [quotes, setQuotes] = useState<ServerQuotePoint[]>([])
  const [serverChartData, setServerChartData] = useState<ChartPoint[]>([])
  const [serverNetworks, setServerNetworks] = useState<ServerChartNetwork[]>([])
  const [backtest, setBacktest] = useState<ServerBacktestResult | null>(null)
  const [backtestStrategyConfigId, setBacktestStrategyConfigId] = useState<string | null>(null)
  const [backtestRevision, setBacktestRevision] = useState(0)
  const [liveTrades, setLiveTrades] = useState<ServerBotTrade[]>([])
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [tradePending, setTradePending] = useState(false)
  const [tradeError, setTradeError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playIdx, setPlayIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [stepResult, setStepResult] = useState<SimulationLogEvent | null>(null)
  const [stepSource, setStepSource] = useState<ServerStepSource>(null)
  const [stepAnalyzing, setStepAnalyzing] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [inspectTime, setInspectTime] = useState<number | null>(null)
  const skipPlayIdxInspectRef = useRef(false)
  const inspectStepRef = useRef<(time: number, preferApi?: boolean, syncPlayIdx?: boolean) => void>(() => {})
  const quotesRef = useRef<ServerQuotePoint[]>([])
  const chartDataRef = useRef<ChartPoint[]>([])
  const playIdxRef = useRef(0)
  const pollInFlightRef = useRef(false)
  const backtestRef = useRef<ServerBacktestResult | null>(null)
  const onBotRefreshRef = useRef(onBotRefresh)
  onBotRefreshRef.current = onBotRefresh
  const onBotUpdatedRef = useRef(onBotUpdated)
  onBotUpdatedRef.current = onBotUpdated
  quotesRef.current = quotes
  chartDataRef.current = serverChartData
  playIdxRef.current = playIdx
  backtestRef.current = backtest

  const applyPeriodRange = period.applyRange
  const activeQuotes = backtest?.quotes ?? quotes
  const invertedPair = useMemo(
    () => isStableAsset(bot.baseAsset) && !isStableAsset(bot.quoteAsset),
    [bot.baseAsset, bot.quoteAsset],
  )
  const toBotSide = useCallback(
    (displaySide: 'buy' | 'sell'): 'buy' | 'sell' =>
      invertedPair ? (displaySide === 'buy' ? 'sell' : 'buy') : displaySide,
    [invertedPair],
  )
  const chartData = useMemo(
    () => serverChartData.length > 0 ? serverChartData : quotesToChartPoints(activeQuotes),
    [activeQuotes, serverChartData],
  )
  const hasObservedAvg = useMemo(
    () => activeQuotes.some((quote) => quote.avgObservedQuote > 0),
    [activeQuotes],
  )

  const events = useMemo(() => {
    const quoteSource = activeQuotes
    const manualTradeEvents = liveTrades.map((t) => mapServerLiveTradeToLogEvent(t, quoteSource))

    if (!backtest) {
      return manualTradeEvents.sort((a, b) => a.dataIdx - b.dataIdx)
    }

    const records = backtest.stepResults?.records ?? []
    const tradeEvents = backtest.trades.map((t) =>
      mapServerTradeToLogEvent(t, findQuoteIndexByTime(backtest.quotes, t.time)),
    )
    const signalEvents = records
      .filter((s) => s.result.transaction.buy || s.result.transaction.sell || s.result.transaction.forcedSell)
      .map((s) => {
        const ev = buildStepLogEventFromBacktestRecord(s, backtest!.quotes, records.length)
        // Dry-run signals are not executed trades — keep them in the log only.
        if (ev.type === 'Buy' || ev.type === 'Sell') {
          return { ...ev, type: 'Signal' as const }
        }
        return ev
      })
    return [...signalEvents, ...tradeEvents, ...manualTradeEvents].sort((a, b) => a.dataIdx - b.dataIdx)
  }, [activeQuotes, backtest, liveTrades])

  const displayNetworks = useMemo(
    () => serverNetworks.length > 0
      ? serverNetworks.map((network, index) => ({
          id: network.id,
          label: network.label,
          color: NETWORK_COLORS[index % NETWORK_COLORS.length],
        }))
      : [{ id: TRADING_NET_ID, label: `${bot.baseAsset}/${bot.quoteAsset}`, color: '#7C3AED' }],
    [bot.baseAsset, bot.quoteAsset, serverNetworks],
  )

  const tradingNetworkIds = useMemo(
    () => new Set(
      serverNetworks.length > 0
        ? serverNetworks.filter((network) => network.role === 'trading').map((network) => network.id)
        : [TRADING_NET_ID],
    ),
    [serverNetworks],
  )
  const primaryTradingNetworkId = tradingNetworkIds.values().next().value ?? TRADING_NET_ID
  const lastPoint = chartData[Math.max(0, playIdx - 1)]
  const lastPrice =
    (typeof lastPoint?.avg === 'number' && lastPoint.avg > 0 ? lastPoint.avg : undefined) ??
    (typeof lastPoint?.[`${primaryTradingNetworkId}_buy`] === 'number'
      ? (lastPoint[`${primaryTradingNetworkId}_buy`] as number)
      : undefined)

  const inspectViaApi = useCallback(
    async (time: number) => {
      setStepAnalyzing(true)
      setStepError(null)
      try {
        // Prefer the engine breakdown stored on the trade at this tick — it has
        // the real trigger outcomes (stop-loss «да») from decision time.
        const tradeWithStep = [...liveTrades]
          .filter((t) => t.stepResult && typeof t.stepResult === 'object')
          .filter((t) => {
            const stepTime =
              typeof (t.stepResult as { step?: { time?: number } }).step?.time === 'number'
                ? (t.stepResult as { step: { time: number } }).step.time
                : t.time
            return t.time === time || stepTime === time || Math.abs(t.time - time) < 2_000
          })
          .sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))[0]
        if (tradeWithStep?.stepResult && typeof tradeWithStep.stepResult === 'object') {
          const stored = tradeWithStep.stepResult as unknown as ServerBotStepResult
          if (stored.transaction && stored.condition) {
            setStepResult(mapServerStepToLogEvent(stored))
            setStepSource('api')
            return
          }
        }

        const pos = resolveInspectPosition(time, bot, backtest, liveTrades)
        const apiResult = await fetchServerStepResult(bot.id, {
          time,
          excludedRanges,
          ...(pos
            ? {
                entryPrice: pos.entryPrice,
                openedAt: pos.openedAt,
                size: pos.size,
              }
            : {}),
        })
        setStepResult(mapServerStepToLogEvent(apiResult))
        setStepSource('api')
      } catch (e) {
        setStepResult(null)
        setStepSource(null)
        setStepError(e instanceof Error ? e.message : 'Не удалось рассчитать шаг')
      } finally {
        setStepAnalyzing(false)
      }
    },
    [backtest, bot, excludedRanges, liveTrades],
  )

  const inspectStep = useCallback(
    (time: number, preferApi = false, syncPlayIdx = true) => {
      setInspectTime(time)
      const records = backtest?.stepResults?.records
      const backtestFresh = backtestStrategyConfigId === bot.strategyConfigId
      const excluded = isTimeInExcludedRanges(time, excludedRanges)
      const backtestFrom = backtest?.quotes[0]?.time ?? null
      const backtestTo = backtest?.quotes[backtest.quotes.length - 1]?.time ?? null
      const insideBacktestWindow =
        backtestFrom != null &&
        backtestTo != null &&
        time >= backtestFrom &&
        time <= backtestTo

      if (syncPlayIdx && activeQuotes.length > 0) {
        const idx = findQuoteIndexByTime(activeQuotes, time) + 1
        skipPlayIdxInspectRef.current = true
        setPlayIdx(idx)
      }

      // If this step is already covered by the latest backtest window, reuse the
      // cached backtest result on click. The API should only be used explicitly
      // via "Рассчитать в API".
      if (!preferApi && !excluded && backtestFresh && insideBacktestWindow && records?.length) {
        const rec = findNearestStepRecord(records, time)
        setStepError(null)
        setStepResult(
          buildStepLogEventFromBacktestRecord(rec, backtest!.quotes, records.length),
        )
        setStepSource('backtest')
        return
      }

      void inspectViaApi(time)
    },
    [activeQuotes, backtest, backtestStrategyConfigId, bot, excludedRanges, inspectViaApi, liveTrades],
  )

  inspectStepRef.current = inspectStep

  const executeTrade = useCallback(
    async (displaySide: 'buy' | 'sell') => {
      const currentQuotes = quotesRef.current.length > 0 ? quotesRef.current : activeQuotes
      if (currentQuotes.length === 0 || tradePending) return
      // Manual demo trading always uses the latest market step, not the
      // historical player position.
      const point = currentQuotes[currentQuotes.length - 1]
      if (!point) return

      const side = toBotSide(displaySide)
      const expectedPrice = displaySide === 'buy' ? point.buyQuote : point.sellQuote
      setTradePending(true)
      setTradeError(null)
      try {
        const result = await executeBotTrade(bot.id, { side, expectedPrice })
        setLiveTrades((prev) => mergeTrades(prev, [result.trade]))
        onBotUpdatedRef.current?.(result.bot)
        onBotRefreshRef.current?.()
      } catch (e) {
        setTradeError(e instanceof Error ? e.message : 'Сделка не удалась')
      } finally {
        setTradePending(false)
      }
    },
    [activeQuotes, bot.id, toBotSide, tradePending],
  )

  const executeBuy = useCallback(() => void executeTrade('buy'), [executeTrade])
  const executeSell = useCallback(() => void executeTrade('sell'), [executeTrade])

  const canTrade = bot.mode !== 'idle' && activeQuotes.length > 0 && !tradePending
  const canBuy =
    canTrade &&
    (toBotSide('buy') === 'buy'
      ? !bot.openPosition && bot.balance > 0
      : bot.openPosition)
  const canSell =
    canTrade &&
    (toBotSide('sell') === 'buy'
      ? !bot.openPosition && bot.balance > 0
      : bot.openPosition)

  const analyzeCurrentStep = useCallback(
    (preferApi = false) => {
      if (inspectTime != null) {
        inspectStep(inspectTime, preferApi, false)
        return
      }
      if (playIdx <= 0 || activeQuotes.length === 0) return
      inspectStep(activeQuotes[playIdx - 1].time, preferApi, false)
    },
    [activeQuotes, inspectStep, inspectTime, playIdx],
  )

  const loadQuotes = useCallback(async (refresh = false) => {
    if (period.from == null || period.to == null) return
    setQuotesLoading(true)
    setError(null)
    try {
      const result = await fetchBotQuotes(bot.id, { from: period.from, to: period.to, refresh })
      if (result.historyFrom != null && result.historyTo != null) {
        applyPeriodRange({ historyFrom: result.historyFrom, historyTo: result.historyTo })
      }
      setQuotes(result.quotes)
      quotesRef.current = result.quotes
      const nextChartData = (result.chartPoints ?? []) as ChartPoint[]
      setServerChartData(nextChartData)
      chartDataRef.current = nextChartData
      setServerNetworks(result.networks ?? [])
      skipPlayIdxInspectRef.current = true
      setPlayIdx(result.quotes.length)
      playIdxRef.current = result.quotes.length
      setStepResult(null)
      setStepSource(null)
      setStepError(null)
      setInspectTime(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить котировки')
      setQuotes([])
      setServerChartData([])
      setServerNetworks([])
      setPlayIdx(0)
      setStepResult(null)
      setStepSource(null)
    } finally {
      setQuotesLoading(false)
    }
  }, [applyPeriodRange, bot.id, period.from, period.to])

  const runBacktest = useCallback(async () => {
    if (period.from == null || period.to == null) return
    const graphQuotes = quotesRef.current
    const backtestQuotes = graphQuotes.slice(-BACKTEST_MAX_POINTS)
    const backtestFrom = backtestQuotes[0]?.time ?? period.from
    const backtestTo = backtestQuotes[backtestQuotes.length - 1]?.time ?? period.to
    setBacktest(null)
    setBacktestStrategyConfigId(null)
    setBacktestRevision((revision) => revision + 1)
    skipPlayIdxInspectRef.current = true
    setPlayIdx(0)
    playIdxRef.current = 0
    setBacktestLoading(true)
    setError(null)
    try {
      const result = await runServerBacktest(bot.id, {
        from: backtestFrom,
        to: backtestTo,
        excludedRanges,
      })
      if (result.historyFrom != null && result.historyTo != null) {
        applyPeriodRange({ historyFrom: result.historyFrom, historyTo: result.historyTo })
      }
      setBacktest(result)
      setBacktestStrategyConfigId(bot.strategyConfigId)
      setQuotes(result.quotes)
      quotesRef.current = result.quotes
      // Backtest returns aggregated quotes only. Preserve the matching
      // per-market points so trading and observed lines remain visible.
      let backtestChartData = chartDataForQuotes(chartDataRef.current, result.quotes)
      if (backtestChartData.length === 0 && result.quotes.length > 0) {
        const first = result.quotes[0]
        const last = result.quotes[result.quotes.length - 1]
        try {
          const chartResult = await fetchBotQuotes(bot.id, { from: first.time, to: last.time })
          backtestChartData = (chartResult.chartPoints ?? []) as ChartPoint[]
          setServerNetworks(chartResult.networks ?? [])
        } catch {
          // Aggregated buy/sell lines remain available as a safe fallback.
        }
      }
      setServerChartData(backtestChartData)
      chartDataRef.current = backtestChartData
      skipPlayIdxInspectRef.current = true
      setPlayIdx(result.quotes.length)
      playIdxRef.current = result.quotes.length
      const last = result.quotes[result.quotes.length - 1]
      if (last) inspectStepRef.current(last.time, false, false)
      onBotRefreshRef.current?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Бэктест не удался')
    } finally {
      setBacktestLoading(false)
    }
  }, [applyPeriodRange, bot.id, bot.strategyConfigId, excludedRanges, period.from, period.to])

  const invalidateSimulation = useCallback(() => {
    setBacktest(null)
    setBacktestStrategyConfigId(null)
    setStepResult(null)
    setStepSource(null)
    setStepError(null)
    setInspectTime(null)
  }, [])

  const refreshChart = useCallback(async () => {
    invalidateSimulation()
    await loadQuotes(true)
  }, [invalidateSimulation, loadQuotes])

  useEffect(() => {
    invalidateSimulation()
  }, [period.from, period.to, bot.strategyConfigId, excludedRanges, invalidateSimulation])

  useEffect(() => {
    setLiveTrades([])
  }, [bot.id])

  useEffect(() => {
    // Сделки сессии бота → журнал событий (раньше лог оставался пустым:
    // liveTrades обнуляли и не подгружали, пока не сделают ручную сделку).
    let cancelled = false
    if (!enabled) return
    const from = bot.startedAt > 0 ? bot.startedAt : period.from
    if (from == null) return
    void fetchBotTrades(bot.id, { from, limit: 2000 })
      .then((rows) => {
        if (!cancelled) setLiveTrades(rows)
      })
      .catch(() => {
        /* keep previous / empty */
      })
    return () => {
      cancelled = true
    }
  }, [bot.id, bot.startedAt, enabled, period.from])

  useEffect(() => {
    const onStrategyUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ configIds: string[] }>).detail
      if (detail?.configIds?.includes(bot.strategyConfigId)) {
        invalidateSimulation()
        if (period.from != null && period.to != null && activeQuotes.length > 0) {
          const last = activeQuotes[activeQuotes.length - 1]
          if (last) inspectStepRef.current(last.time, true, false)
        }
      }
    }
    window.addEventListener(STRATEGY_CONFIG_UPDATED_EVENT, onStrategyUpdated)
    return () => window.removeEventListener(STRATEGY_CONFIG_UPDATED_EVENT, onStrategyUpdated)
  }, [activeQuotes, bot.strategyConfigId, invalidateSimulation, period.from, period.to])

  useEffect(() => {
    if (!enabled || suspendPeriodReload) return
    void loadQuotes()
  }, [enabled, loadQuotes, suspendPeriodReload])

  useEffect(() => {
    if (!enabled || suspendPeriodReload || period.from == null || period.to == null) return
    const latestBound = period.range?.historyTo
    const followsLatest = followLive || latestBound == null || period.to >= latestBound
    if (!followsLatest) return

    const periodFrom = period.from
    const pollIntervalMs = followLive
      ? Math.min(CHART_POLL_INTERVAL_MS, 2000)
      : CHART_POLL_INTERVAL_MS
    let cancelled = false
    const poll = async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        const currentQuotes = quotesRef.current
        const previousLastTime = currentQuotes[currentQuotes.length - 1]?.time ?? periodFrom
        const [quoteResult, botResult, tradeRows] = await Promise.all([
          fetchBotQuotes(bot.id, {
            // Keep one overlap point so a same-timestamp bid/ask update
            // replaces the previous value instead of creating a duplicate.
            from: previousLastTime,
            refresh: true,
          }),
          fetchServerBot(bot.id),
          followLive
            ? fetchBotTrades(bot.id, {
                from: bot.startedAt > 0 ? Math.min(bot.startedAt, periodFrom) : periodFrom,
                limit: 2000,
              }).catch(() => [] as ServerBotTrade[])
            : Promise.resolve(null),
        ])
        if (cancelled) return

        onBotUpdatedRef.current?.(botResult)

        if (tradeRows) {
          setLiveTrades((prev) => mergeTrades(prev, tradeRows))
        }

        const incomingQuotes = quoteResult.quotes
        if (incomingQuotes.length === 0) return
        const incomingChart = (quoteResult.chartPoints ?? []) as ChartPoint[]
        const nextLastTime = incomingQuotes[incomingQuotes.length - 1]?.time ?? previousLastTime
        const hasNewStep = nextLastTime > previousLastTime
        const wasFollowing = playIdxRef.current >= currentQuotes.length
        const mergedQuotes = mergeQuotes(currentQuotes, incomingQuotes)
        const backtestActive = backtestRef.current != null
        const mergedChart = backtestActive
          ? chartDataRef.current
          : mergeChartData(chartDataRef.current, incomingChart)

        quotesRef.current = mergedQuotes
        setQuotes(mergedQuotes)
        if (!backtestActive) {
          chartDataRef.current = mergedChart
          setServerChartData(mergedChart)
          setServerNetworks(quoteResult.networks ?? [])
        }

        if (!hasNewStep) return
        if (backtestActive) return

        if (wasFollowing) {
          skipPlayIdxInspectRef.current = true
          playIdxRef.current = mergedQuotes.length
          setPlayIdx(mergedQuotes.length)
        }
      } catch {
        // Preserve the last complete state; the next interval retries.
      } finally {
        pollInFlightRef.current = false
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), pollIntervalMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [
    bot.id,
    bot.startedAt,
    enabled,
    followLive,
    period.from,
    period.range?.historyTo,
    period.to,
    suspendPeriodReload,
  ])

  useEffect(() => {
    if (skipPlayIdxInspectRef.current) {
      skipPlayIdxInspectRef.current = false
      return
    }
    // Step/backtest breakdown only on explicit actions (chart click, analyze, playback).
    if (!isPlaying || playIdx <= 0 || activeQuotes.length === 0) return
    const time = activeQuotes[playIdx - 1]?.time
    if (time != null) inspectStepRef.current(time, false, false)
  }, [playIdx, activeQuotes, isPlaying])

  useEffect(() => {
    if (!isPlaying || chartData.length === 0) return
    const intervalMs = 200 / speed
    const timer = window.setInterval(() => {
      setPlayIdx((prev) => {
        if (prev >= chartData.length) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [isPlaying, speed, chartData.length])

  return {
    backtest,
    backtestRevision,
    chartData,
    fullChartData: chartData,
    events,
    stepResult,
    stepSource,
    stepAnalyzing,
    stepError,
    inspectTime,
    quotesLoading,
    backtestLoading,
    loading: quotesLoading || backtestLoading,
    loadingPhase: backtestLoading ? ('simulation' as const) : ('history' as const),
    error,
    playIdx,
    setPlayIdx,
    isPlaying,
    setIsPlaying,
    speed,
    setSpeed,
    displayNetworks,
    tradingNetworkIds,
    lastPrice,
    live: followLive,
    token1Label: bot.baseAsset,
    token2Label: bot.quoteAsset,
    refreshChart,
    runBacktest,
    analyzeCurrentStep,
    inspectStep,
    inspectViaApi,
    hasObservedAvg,
    executeBuy,
    executeSell,
    tradePending,
    tradeError,
    canBuy,
    canSell,
  }
}

/** @deprecated Use useBotBacktest */
export function useServerBotBacktest(options: {
  bot: ServerBot
  enabled?: boolean
  autoRunBacktest?: boolean
  period?: BotPeriodState
}) {
  const fallbackPeriod = {
    from: null as number | null,
    to: null as number | null,
    range: null,
    setFrom: () => {},
    setTo: () => {},
    setPreset: () => {},
    applyRange: () => {},
    dateStr: () => '',
    parseDate: () => null,
    HOUR: 0,
    DAY: 0,
    WEEK: 0,
    MONTH: 0,
  }
  return useBotBacktest({
    bot: options.bot,
    period: options.period ?? fallbackPeriod,
    excludedRanges: [],
    enabled: options.enabled,
  })
}
