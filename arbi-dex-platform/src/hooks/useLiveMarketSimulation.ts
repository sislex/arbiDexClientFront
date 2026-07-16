import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EngineConditionEvaluation } from '../engine/processAllStepsAndRecordResults'
import {
  createInitialEngineState,
  dispatchStrategyStepSync,
  type MarketStep,
  type StrategyEngineEvent,
} from '../engine/processAllStepsAndRecordResults'
import { buildTradingConditionsConfig } from '../lib/buildTradingConditionsConfig'
import { referenceNetworks, resolveChartNetworks } from '../lib/buildChartNetworks'
import { applyReferenceAverage } from '../lib/chartPointAvg'
import {
  cacheCoversPeriod,
  CHART_POLL_OVERLAP_MS,
  CHART_POLL_TAIL_LIMIT,
  getChartDataCache,
  mergeChartPoints,
  setChartDataCache,
} from '../lib/chartDataCache'
import { filterChartDataByPeriod, type ChartPeriod } from '../lib/chartTimeRange'
import {
  fetchChartData,
  fetchStoreKeyCatalog,
  CHART_POLL_INTERVAL_MS,
  type ChartPoint,
} from '../services/chartDataService'
import { eventTime } from '../simulation/simulationFormatters'
import {
  buildNetworksFromStrategy,
  resolveStrategyTokenSymbols,
  type NetworkSource,
} from '../simulation/simulationNetworkTypes'
import { buildTradingNetworkIds } from '../simulation/buildSimulationContextFromStrategy'
import type { Strategy } from '../simulation/simulationStrategy'
import type { SimulationEventType, SimulationLogEvent } from '../simulation/simulationViewerTypes'
import type { ChartPairSelection } from '../types/chart'

const MAX_STEP_CALC_WINDOW = 100
const TEST_TOKEN_BALANCE = 1000
const EXECUTION_ERROR_PROBABILITY = Math.min(
  0.95,
  Math.max(0, Number.parseFloat(String(import.meta.env.VITE_EXECUTION_ERROR_PROBABILITY ?? '0.18')) || 0),
)

function pctDiff(a: number, b: number): number {
  if (b === 0) return 0
  return ((a - b) / b) * 100
}

function extractSpread(
  point: ChartPoint,
  networks: readonly NetworkSource[],
  filterNetworkIds?: Set<string>,
) {
  const relevantNetworks =
    filterNetworkIds && filterNetworkIds.size > 0
      ? networks.filter((n) => filterNetworkIds.has(n.id))
      : networks
  const buys = relevantNetworks
    .map((n) => point[`${n.id}_buy`] as number | undefined)
    .filter((v): v is number => v !== undefined)
  const sells = relevantNetworks
    .map((n) => point[`${n.id}_sell`] as number | undefined)
    .filter((v): v is number => v !== undefined)
  if (buys.length === 0 || sells.length === 0) return null
  return { maxBuy: Math.max(...buys), minSell: Math.min(...sells), invertedPct: pctDiff(Math.max(...buys), Math.min(...sells)) }
}

function toLogEvent(engineEvent: StrategyEngineEvent & { evaluations?: EngineConditionEvaluation[] }): SimulationLogEvent {
  const type: SimulationEventType =
    engineEvent.action === 'BUY'
      ? 'Buy'
      : engineEvent.action === 'SELL'
        ? 'Sell'
        : engineEvent.action === 'WAIT'
          ? 'Signal'
          : 'Risk'
  const decision =
    engineEvent.action === 'BUY' ? 'BUY' : engineEvent.action === 'SELL' ? 'SELL' : 'NO ACTION'
  return {
    id: `evt-${engineEvent.ts}-${engineEvent.action}-${engineEvent.conditionId ?? 'na'}`,
    dataIdx: engineEvent.index,
    time: eventTime(engineEvent.ts),
    type,
    message: engineEvent.action === 'WAIT' ? 'Nothing' : engineEvent.message,
    detail: {
      rule: engineEvent.conditionId,
      currentValue: engineEvent.value,
      required: engineEvent.required,
      decision,
      amount: engineEvent.action === 'BUY' || engineEvent.action === 'SELL' ? '1,000 USDT' : undefined,
      evaluations: engineEvent.evaluations,
    },
  }
}

function simulateFakeExecution(requestTs: number, requestPrice: number) {
  const delayMs = Math.floor(Math.random() * 3001)
  const slippagePct = (Math.random() - 0.5) * 1.0
  const executedPrice = requestPrice * (1 + slippagePct / 100)
  const ok = Math.random() >= EXECUTION_ERROR_PROBABILITY
  return { ok, requestTs, responseTs: requestTs + delayMs, executedPrice, delayMs, slippagePct }
}

function findResponseIndexByTs(data: ChartPoint[], responseTs: number, fallbackIdx: number): number {
  const idx = data.findIndex((point) => point.t >= responseTs)
  if (idx >= 0) return idx
  return Math.max(0, Math.min(data.length - 1, fallbackIdx))
}

function buildMarketSteps(
  chartData: ChartPoint[],
  endIdx: number,
  networks: readonly NetworkSource[],
  tradingNetworkIds: Set<string>,
): MarketStep[] {
  return chartData.slice(0, endIdx).map((point) => {
    const spread = extractSpread(point, networks, tradingNetworkIds)
    if (!spread || point.avg === undefined) {
      return {
        time: point.t,
        quotes: {
          buyQuote: point.avg ?? 0,
          sellQuote: point.avg ?? 0,
          avgObservedQuote: point.avg ?? 0,
        },
        balances: { token1: TEST_TOKEN_BALANCE, token2: TEST_TOKEN_BALANCE },
      }
    }
    return {
      time: point.t,
      quotes: {
        buyQuote: spread.maxBuy,
        sellQuote: spread.minSell,
        avgObservedQuote: point.avg,
      },
      balances: { token1: TEST_TOKEN_BALANCE, token2: TEST_TOKEN_BALANCE },
    }
  })
}

export interface UseLiveMarketSimulationOptions {
  strategy: Strategy
  /** Тот же набор бирж/DEX, что в отслеживании (Trading Pairs → chart). */
  chartSelection?: ChartPairSelection | null
  enabled?: boolean
  period?: ChartPeriod
}

function chartSelectionKey(selection: ChartPairSelection): string {
  return [
    selection.id,
    selection.pair,
    selection.purpose,
    selection.tradingExchange ?? '',
    selection.selectedExchanges.join(','),
    JSON.stringify(selection.dexEntries ?? []),
    JSON.stringify(selection.dexAddresses ?? {}),
  ].join('|')
}

function buildTradingNetworkIdsFromSelection(
  selection: ChartPairSelection | null | undefined,
  networks: readonly NetworkSource[],
): Set<string> {
  if (!selection?.tradingExchange) return new Set()
  const match = networks.find((n) => n.label === selection.tradingExchange)
  return match ? new Set([match.id]) : new Set()
}

export function useLiveMarketSimulation({
  strategy,
  chartSelection = null,
  enabled = true,
  period = '1h',
}: UseLiveMarketSimulationOptions) {
  const [networks, setNetworks] = useState<NetworkSource[]>([])
  const [networksReady, setNetworksReady] = useState(false)

  const selectionKey = chartSelection ? chartSelectionKey(chartSelection) : ''
  const cacheKey = useMemo(() => {
    if (chartSelection) return chartSelectionKey(chartSelection)
    const networkIds = networks.map((n) => n.id).join(',')
    return networkIds ? `sim:${strategy.id}:${networkIds}` : `sim:${strategy.id}`
  }, [chartSelection, strategy.id, networks])

  const cachedFull = cacheKey ? getChartDataCache(cacheKey) : undefined

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setNetworksReady(false)

    const resolveNetworks = async () => {
      try {
        if (chartSelection) {
          const catalog = await fetchStoreKeyCatalog()
          if (cancelled) return
          const resolved = resolveChartNetworks(chartSelection, catalog)
          setNetworks(resolved.length > 0 ? resolved : buildNetworksFromStrategy(strategy))
        } else {
          setNetworks(buildNetworksFromStrategy(strategy))
        }
      } catch {
        if (!cancelled) setNetworks(buildNetworksFromStrategy(strategy))
      } finally {
        if (!cancelled) setNetworksReady(true)
      }
    }

    void resolveNetworks()
    return () => {
      cancelled = true
    }
  }, [enabled, selectionKey, strategy])

  const tradingNetworkIds = useMemo(
    () =>
      chartSelection
        ? buildTradingNetworkIdsFromSelection(chartSelection, networks)
        : buildTradingNetworkIds(strategy, networks),
    [chartSelection, networks, strategy],
  )
  const displayNetworks = useMemo(
    () => networks.map((n) => ({ id: n.id, label: n.label, color: n.color })),
    [networks],
  )
  const tokens = useMemo(() => resolveStrategyTokenSymbols(strategy), [strategy])

  const [fullData, setFullData] = useState<ChartPoint[]>(() => cachedFull ?? [])
  const [events, setEvents] = useState<SimulationLogEvent[]>([])
  const [stepResult, setStepResult] = useState<SimulationLogEvent | null>(null)
  const [loading, setLoading] = useState(() => !(cachedFull && cacheCoversPeriod(cachedFull, period)))
  const [loadingPhase, setLoadingPhase] = useState<'history' | 'simulation'>('history')
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playIdx, setPlayIdx] = useState(0)
  const [speed, setSpeed] = useState(1)

  const fullDataRef = useRef(fullData)
  const periodRef = useRef(period)
  const prevChartLenRef = useRef(0)
  fullDataRef.current = fullData
  periodRef.current = period

  const chartData = useMemo(
    () => filterChartDataByPeriod(fullData, period),
    [fullData, period],
  )

  const commitFullData = useCallback(
    (next: ChartPoint[], cachePeriod: ChartPeriod) => {
      setFullData(next)
      if (cacheKey) setChartDataCache(cacheKey, next, cachePeriod)
    },
    [cacheKey],
  )

  const fetchAndMerge = useCallback(
    async (
      resolved: NetworkSource[],
      fetchPeriod: ChartPeriod,
      options?: { limit?: number; sinceMs?: number },
    ): Promise<ChartPoint[]> => {
      const refNets = chartSelection ? referenceNetworks(chartSelection, resolved) : []
      const apiData = await fetchChartData(resolved, {
        period: fetchPeriod,
        keepBuffer: true,
        limit: options?.limit,
        sinceMs: options?.sinceMs,
      })
      if (apiData.length === 0) return fullDataRef.current
      const averaged = refNets.length > 0 ? applyReferenceAverage(apiData, refNets) : apiData
      return mergeChartPoints(fullDataRef.current, averaged)
    },
    [chartSelection],
  )
  const playIdxRef = useRef(playIdx)
  const engineStateRef = useRef(createInitialEngineState())
  const processedIdxRef = useRef(0)
  const engineLogRef = useRef<SimulationLogEvent[]>([])
  const lastTransactionStepIdxRef = useRef<number | null>(null)

  const followPlayIdxToLiveEdge = useCallback((data: readonly ChartPoint[]) => {
    const len = filterChartDataByPeriod([...data], periodRef.current).length
    if (len === 0) return
    setPlayIdx(len)
    prevChartLenRef.current = len
  }, [])

  playIdxRef.current = playIdx

  useEffect(() => {
    if (!enabled || !networksReady || networks.length === 0) return

    setLoadingPhase('history')
    setEvents([])
    setStepResult(null)
    setError(null)
    prevChartLenRef.current = 0
    engineStateRef.current = createInitialEngineState()
    processedIdxRef.current = 0
    engineLogRef.current = []
    lastTransactionStepIdxRef.current = null

    let cancelled = false
    const cached = getChartDataCache(cacheKey)
    if (cached?.length) {
      setFullData(cached)
      if (cacheCoversPeriod(cached, periodRef.current)) {
        setLoading(false)
        followPlayIdxToLiveEdge(cached)
      }
    } else {
      setFullData([])
      setLoading(true)
    }

    const bootstrap = async () => {
      const showLoading = !fullDataRef.current.length
      if (showLoading) setLoading(true)

      try {
        if (cacheCoversPeriod(fullDataRef.current, periodRef.current)) {
          if (fullDataRef.current.length > 0) {
            followPlayIdxToLiveEdge(fullDataRef.current)
            setLoadingPhase('simulation')
            setError(null)
          }
          return
        }

        const merged = await fetchAndMerge(networks, periodRef.current)
        if (cancelled) return

        if (merged.length === 0) {
          setError('api')
          return
        }

        commitFullData(merged, periodRef.current)
        followPlayIdxToLiveEdge(merged)
        setLoadingPhase('simulation')
        setError(null)
      } catch {
        if (!cancelled && !fullDataRef.current.length) setError('api')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrap()

    const pollTimer = window.setInterval(async () => {
      if (networks.length === 0 || fullDataRef.current.length === 0) return

      try {
        const lastT = fullDataRef.current[fullDataRef.current.length - 1].t
        const merged = await fetchAndMerge(networks, periodRef.current, {
          limit: CHART_POLL_TAIL_LIMIT,
          sinceMs: Math.max(0, lastT - CHART_POLL_OVERLAP_MS),
        })
        if (merged.length > fullDataRef.current.length) {
          commitFullData(merged, periodRef.current)
          if (playIdxRef.current >= prevChartLenRef.current) {
            followPlayIdxToLiveEdge(merged)
          }
          setError(null)
        }
      } catch {
        // фоновое обновление
      }
    }, CHART_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(pollTimer)
    }
  }, [enabled, networks, networksReady, cacheKey, strategy.id, fetchAndMerge, commitFullData, followPlayIdxToLiveEdge])

  useEffect(() => {
    if (!enabled || !networksReady || networks.length === 0) return
    if (cacheCoversPeriod(fullDataRef.current, period)) {
      setLoading(false)
      return
    }

    let cancelled = false

    const extendForPeriod = async () => {
      try {
        const merged = await fetchAndMerge(networks, period)
        if (cancelled || merged.length === 0) return
        commitFullData(merged, period)
        if (playIdxRef.current >= prevChartLenRef.current) {
          followPlayIdxToLiveEdge(merged)
        }
        setLoadingPhase('simulation')
        setError(null)
      } catch {
        // оставляем уже загруженное
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setLoading(fullDataRef.current.length === 0)
    void extendForPeriod()

    return () => {
      cancelled = true
    }
  }, [period, enabled, networks, networksReady, fetchAndMerge, commitFullData, followPlayIdxToLiveEdge])

  useEffect(() => {
    const len = chartData.length
    if (len === 0) return
    setPlayIdx((prev) => {
      if (prevChartLenRef.current === 0) return len
      if (prev >= prevChartLenRef.current) return len
      return Math.min(prev, len)
    })
    prevChartLenRef.current = len
  }, [chartData])

  useEffect(() => {
    if (!enabled || loading || chartData.length === 0) return

    const targetIdx = Math.max(0, Math.min(playIdx, chartData.length))
    if (targetIdx < processedIdxRef.current) {
      engineStateRef.current = createInitialEngineState()
      processedIdxRef.current = 0
      engineLogRef.current = []
      lastTransactionStepIdxRef.current = null
      setEvents([])
      setStepResult(null)
    }
    if (targetIdx === processedIdxRef.current) return

    let calcStartIdx = processedIdxRef.current
    const windowStartIdx = Math.max(0, targetIdx - MAX_STEP_CALC_WINDOW)
    if (calcStartIdx < windowStartIdx) {
      calcStartIdx = windowStartIdx
      engineStateRef.current = createInitialEngineState()
      engineLogRef.current = []
      setEvents([])
      setStepResult(null)
    }
    if (lastTransactionStepIdxRef.current !== null && lastTransactionStepIdxRef.current > calcStartIdx) {
      calcStartIdx = lastTransactionStepIdxRef.current
      engineStateRef.current = createInitialEngineState()
      engineLogRef.current = []
      setEvents([])
      setStepResult(null)
    }

    const strategyCfg = buildTradingConditionsConfig(strategy)
    const marketSteps = buildMarketSteps(chartData, targetIdx, networks, tradingNetworkIds)

    let latestStepResult: SimulationLogEvent | null = null
    for (let i = calcStartIdx; i < targetIdx; i += 1) {
      const point = chartData[i]
      if (point.avg === undefined) continue
      const { state, event } = dispatchStrategyStepSync(marketSteps, i, engineStateRef.current, strategyCfg)
      engineStateRef.current = state
      if (!event) continue
      latestStepResult = toLogEvent(event)
      if (event.action === 'BUY' || event.action === 'SELL') {
        lastTransactionStepIdxRef.current = i
        const requestLog = toLogEvent({ ...event, message: `${event.action} REQUEST` })
        requestLog.markerTs = marketSteps[i]?.time ?? point.t
        requestLog.markerPrice = typeof event.price === 'number' ? event.price : undefined
        engineLogRef.current.push(requestLog)

        const requestPrice = typeof event.price === 'number' ? event.price : (point.avg ?? 0)
        const exec = simulateFakeExecution(marketSteps[i]?.time ?? point.t, requestPrice)
        const responseIndex = findResponseIndexByTs(chartData, exec.responseTs, i)
        engineLogRef.current.push({
          id: `${requestLog.id}-resp`,
          dataIdx: responseIndex,
          time: eventTime(exec.responseTs),
          type: exec.ok ? (event.action === 'BUY' ? 'Buy' : 'Sell') : 'Error',
          message: exec.ok ? `${event.action} FILLED` : `${event.action} ERROR`,
          markerTs: exec.responseTs,
          markerPrice: exec.ok ? exec.executedPrice : requestPrice,
          detail: {
            decision: exec.ok ? event.action : 'ERROR',
            status: exec.ok ? 'FILLED' : 'REJECTED',
            executionOk: String(exec.ok),
            requestPrice: `${requestPrice.toFixed(4)}`,
            executedPrice: exec.ok ? `${exec.executedPrice.toFixed(4)}` : '—',
            executionDelayMs: `${exec.delayMs}`,
            slippagePct: exec.ok ? `${exec.slippagePct.toFixed(4)}%` : '—',
            evaluations: event.evaluations,
          },
        })
      }
    }

    processedIdxRef.current = targetIdx
    setEvents([...engineLogRef.current])
    if (latestStepResult) setStepResult(latestStepResult)
  }, [enabled, playIdx, chartData, strategy, networks, tradingNetworkIds, loading])

  const lastPrice =
    chartData.length > 0 ? chartData[chartData.length - 1].avg?.toFixed(2) ?? '—' : '—'

  const live = useMemo(() => {
    if (chartData.length === 0) return false
    const lastT = chartData[chartData.length - 1].t
    return Date.now() - lastT < CHART_POLL_INTERVAL_MS * 2
  }, [chartData])

  return {
    chartData,
    fullChartData: fullData,
    events,
    stepResult,
    loading,
    loadingPhase,
    error,
    isPlaying,
    setIsPlaying,
    playIdx,
    setPlayIdx,
    speed,
    setSpeed,
    lastPrice,
    live,
    displayNetworks,
    tradingNetworkIds,
    token1Label: tokens.token1,
    token2Label: tokens.token2,
  }
}
