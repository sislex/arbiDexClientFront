import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BotPeriodState } from './useBotPeriod'
import type { ChartPoint } from '../services/chartDataService'
import {
  executeBotTrade,
  fetchBotQuotes,
  fetchBotTrades,
  fetchServerStepResult,
  runServerBacktest,
  type ServerBacktestResult,
  type ServerBot,
  type ServerBotTrade,
  type ServerQuotePoint,
} from '../services/botsApi'
import {
  buildStepLogEventFromBacktestRecord,
  findNearestStepRecord,
  findQuoteIndexByTime,
} from '../lib/inspectBotStep'
import { mapServerLiveTradeToLogEvent, mapServerStepToLogEvent, mapServerTradeToLogEvent } from '../lib/mapServerBotStepResult'
import type { SimulationLogEvent } from '../simulation/simulationViewerTypes'

const TRADING_NET_ID = 'trading'

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
  enabled?: boolean
  onBotRefresh?: () => void
  /** While picking period on chart, defer quote reload until pick completes. */
  suspendPeriodReload?: boolean
}

export function useBotBacktest({
  bot,
  period,
  enabled = true,
  onBotRefresh,
  suspendPeriodReload = false,
}: UseBotBacktestOptions) {
  const [quotes, setQuotes] = useState<ServerQuotePoint[]>([])
  const [backtest, setBacktest] = useState<ServerBacktestResult | null>(null)
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
  const onBotRefreshRef = useRef(onBotRefresh)
  onBotRefreshRef.current = onBotRefresh

  const activeQuotes = backtest?.quotes ?? quotes
  const chartData = useMemo(() => quotesToChartPoints(activeQuotes), [activeQuotes])
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

    const tradeEvents = backtest.trades.map((t) =>
      mapServerTradeToLogEvent(t, findQuoteIndexByTime(backtest.quotes, t.time)),
    )
    const records = backtest.stepResults?.records ?? []
    const signalEvents = records
      .filter((s) => s.result.transaction.buy || s.result.transaction.sell || s.result.transaction.forcedSell)
      .map((s) => mapServerStepToLogEvent(s))
    return [...signalEvents, ...tradeEvents, ...manualTradeEvents].sort((a, b) => a.dataIdx - b.dataIdx)
  }, [activeQuotes, backtest, liveTrades])

  const displayNetworks = useMemo(
    () => [{ id: TRADING_NET_ID, label: `${bot.baseAsset}/${bot.quoteAsset}`, color: '#7C3AED' }],
    [bot.baseAsset, bot.quoteAsset],
  )

  const tradingNetworkIds = useMemo(() => new Set([TRADING_NET_ID]), [])
  const lastPoint = chartData[Math.max(0, playIdx - 1)]
  const lastPrice =
    (typeof lastPoint?.avg === 'number' && lastPoint.avg > 0 ? lastPoint.avg : undefined) ??
    (typeof lastPoint?.[`${TRADING_NET_ID}_buy`] === 'number'
      ? (lastPoint[`${TRADING_NET_ID}_buy`] as number)
      : undefined)

  const inspectViaApi = useCallback(
    async (time: number) => {
      setStepAnalyzing(true)
      setStepError(null)
      try {
        const apiResult = await fetchServerStepResult(bot.id, { time })
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
    [bot.id],
  )

  const inspectStep = useCallback(
    (time: number, preferApi = false, syncPlayIdx = true) => {
      setInspectTime(time)
      const records = backtest?.stepResults?.records

      if (syncPlayIdx && activeQuotes.length > 0) {
        const idx = findQuoteIndexByTime(activeQuotes, time) + 1
        skipPlayIdxInspectRef.current = true
        setPlayIdx(idx)
      }

      if (!preferApi && records?.length) {
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
    [activeQuotes, backtest, inspectViaApi],
  )

  inspectStepRef.current = inspectStep

  const loadLiveTrades = useCallback(async () => {
    if (period.from == null || period.to == null) return
    try {
      const trades = await fetchBotTrades(bot.id, { from: period.from, to: period.to })
      setLiveTrades(trades)
    } catch {
      setLiveTrades([])
    }
  }, [bot.id, period.from, period.to])

  const executeTrade = useCallback(
    async (side: 'buy' | 'sell') => {
      if (activeQuotes.length === 0 || tradePending) return
      const point = activeQuotes[Math.max(0, Math.min(playIdx, activeQuotes.length) - 1)] ?? activeQuotes[activeQuotes.length - 1]
      if (!point) return

      const expectedPrice = side === 'buy' ? point.buyQuote : point.sellQuote
      setTradePending(true)
      setTradeError(null)
      try {
        const result = await executeBotTrade(bot.id, { side, expectedPrice })
        setLiveTrades((prev) => [...prev, result.trade])
        onBotRefreshRef.current?.()
      } catch (e) {
        setTradeError(e instanceof Error ? e.message : 'Сделка не удалась')
      } finally {
        setTradePending(false)
      }
    },
    [activeQuotes, bot.id, playIdx, tradePending],
  )

  const executeBuy = useCallback(() => void executeTrade('buy'), [executeTrade])
  const executeSell = useCallback(() => void executeTrade('sell'), [executeTrade])

  const canTrade = bot.mode !== 'idle' && activeQuotes.length > 0 && !tradePending
  const canBuy = canTrade && !bot.openPosition && bot.balance > 0
  const canSell = canTrade && bot.openPosition

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

  const loadQuotes = useCallback(async () => {
    if (period.from == null || period.to == null) return
    setQuotesLoading(true)
    setError(null)
    try {
      const result = await fetchBotQuotes(bot.id, { from: period.from, to: period.to })
      if (result.historyFrom != null && result.historyTo != null) {
        period.applyRange({ historyFrom: result.historyFrom, historyTo: result.historyTo })
      }
      setQuotes(result.quotes)
      skipPlayIdxInspectRef.current = true
      setPlayIdx(result.quotes.length)
      const last = result.quotes[result.quotes.length - 1]
      if (last) inspectStepRef.current(last.time, false, false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить котировки')
      setQuotes([])
      setPlayIdx(0)
      setStepResult(null)
      setStepSource(null)
    } finally {
      setQuotesLoading(false)
    }
  }, [bot.id, period.from, period.to])

  const runBacktest = useCallback(async () => {
    if (period.from == null || period.to == null) return
    setBacktestLoading(true)
    setError(null)
    try {
      const result = await runServerBacktest(bot.id, { from: period.from, to: period.to })
      if (result.historyFrom != null && result.historyTo != null) {
        period.applyRange({ historyFrom: result.historyFrom, historyTo: result.historyTo })
      }
      setBacktest(result)
      setQuotes(result.quotes)
      skipPlayIdxInspectRef.current = true
      setPlayIdx(result.quotes.length)
      const last = result.quotes[result.quotes.length - 1]
      if (last) inspectStepRef.current(last.time, false, false)
      onBotRefreshRef.current?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Бэктест не удался')
    } finally {
      setBacktestLoading(false)
    }
  }, [bot.id, period.from, period.to])

  useEffect(() => {
    setBacktest(null)
    setStepResult(null)
    setStepSource(null)
    setStepError(null)
    setInspectTime(null)
  }, [period.from, period.to])

  useEffect(() => {
    if (!enabled || suspendPeriodReload) return
    void loadQuotes()
    void loadLiveTrades()
  }, [enabled, loadLiveTrades, loadQuotes, suspendPeriodReload])

  useEffect(() => {
    if (skipPlayIdxInspectRef.current) {
      skipPlayIdxInspectRef.current = false
      return
    }
    if (playIdx <= 0 || activeQuotes.length === 0) return
    const time = activeQuotes[playIdx - 1]?.time
    if (time != null) inspectStepRef.current(time, false, false)
  }, [playIdx, activeQuotes])

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
    live: false,
    token1Label: bot.baseAsset,
    token2Label: bot.quoteAsset,
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
    enabled: options.enabled,
  })
}
