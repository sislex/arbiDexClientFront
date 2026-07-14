import { useEffect, useMemo, useRef, useState } from 'react'
import type { EngineConditionEvaluation } from '../engine/processAllStepsAndRecordResults'
import {
  createInitialEngineState,
  dispatchStrategyStepSync,
  type MarketStep,
  type StrategyEngineEvent,
} from '../engine/processAllStepsAndRecordResults'
import { buildTradingConditionsConfig } from '../lib/buildTradingConditionsConfig'
import {
  calcMid,
  fetchChartData,
  fetchLatestPrices,
  FETCH_LIMIT,
  type ChartPoint,
  type PriceSnapshot,
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

const MAX_STEP_CALC_WINDOW = 100
const TEST_TOKEN_BALANCE = 1000
const POLL_INTERVAL_MS = 5000
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
  enabled?: boolean
}

export function useLiveMarketSimulation({ strategy, enabled = true }: UseLiveMarketSimulationOptions) {
  const networks = useMemo(() => buildNetworksFromStrategy(strategy), [strategy])
  const tradingNetworkIds = useMemo(
    () => buildTradingNetworkIds(strategy, networks),
    [strategy, networks],
  )
  const displayNetworks = useMemo(
    () => networks.map((n) => ({ id: n.id, label: n.label, color: n.color })),
    [networks],
  )
  const tokens = useMemo(() => resolveStrategyTokenSymbols(strategy), [strategy])
  const liveKeys = useMemo(() => networks.flatMap((n) => [n.bidKey, n.askKey]), [networks])

  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [events, setEvents] = useState<SimulationLogEvent[]>([])
  const [stepResult, setStepResult] = useState<SimulationLogEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingPhase, setLoadingPhase] = useState<'history' | 'simulation'>('history')
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playIdx, setPlayIdx] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [liveSnapshot, setLiveSnapshot] = useState<PriceSnapshot>({})

  const lastLiveTsRef = useRef(0)
  const engineStateRef = useRef(createInitialEngineState())
  const processedIdxRef = useRef(0)
  const engineLogRef = useRef<SimulationLogEvent[]>([])
  const lastTransactionStepIdxRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    setLoadingPhase('history')
    setChartData([])
    setPlayIdx(0)
    setEvents([])
    setStepResult(null)
    setError(null)
    lastLiveTsRef.current = 0
    engineStateRef.current = createInitialEngineState()
    processedIdxRef.current = 0
    engineLogRef.current = []
    lastTransactionStepIdxRef.current = null

    fetchChartData(networks)
      .then((data) => {
        if (data.length === 0) {
          setError('api')
          setLoading(false)
          return
        }
        setLoadingPhase('simulation')
        setChartData(data)
        setPlayIdx(data.length)
        lastLiveTsRef.current = data[data.length - 1]?.t ?? 0
        setLoading(false)
      })
      .catch(() => {
        setError('api')
        setLoading(false)
      })
  }, [enabled, networks, strategy.id])

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

  useEffect(() => {
    if (!enabled || loading || liveKeys.length === 0) return
    let cancelled = false
    const poll = async () => {
      try {
        const snapshot = await fetchLatestPrices(liveKeys)
        if (!cancelled) setLiveSnapshot(snapshot)
      } catch {
        // ignore transient poll errors
      }
    }
    void poll()
    const id = window.setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [enabled, loading, liveKeys.join('|')])

  useEffect(() => {
    if (!enabled || loading || networks.length === 0) return
    const timestamps = networks
      .flatMap((n) => [liveSnapshot[n.bidKey]?.timestamp, liveSnapshot[n.askKey]?.timestamp])
      .filter((ts): ts is number => Number.isFinite(ts))
    if (timestamps.length === 0) return

    const ts = Math.max(...timestamps)
    if (ts <= lastLiveTsRef.current) return

    const point: ChartPoint = {
      t: ts,
      label: new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    }
    const mids: number[] = []
    for (const net of networks) {
      const bid = liveSnapshot[net.bidKey]?.value
      const ask = liveSnapshot[net.askKey]?.value
      if (typeof ask === 'number') point[`${net.id}_buy`] = net.transform(ask)
      if (typeof bid === 'number') point[`${net.id}_sell`] = net.transform(bid)
      const mid = calcMid(liveSnapshot, net.bidKey, net.askKey, net.transform)
      if (mid !== null) mids.push(mid)
    }
    if (mids.length === 0) return
    point.avg = +(mids.reduce((a, b) => a + b, 0) / mids.length).toFixed(4)

    setChartData((prev) => {
      const lastTs = prev[prev.length - 1]?.t ?? 0
      if (ts <= lastTs) return prev
      const next = [...prev, point]
      return next.length > FETCH_LIMIT ? next.slice(next.length - FETCH_LIMIT) : next
    })
    setPlayIdx((i) => i + 1)
    lastLiveTsRef.current = ts
  }, [enabled, liveSnapshot, networks, loading])

  const liveAvg = useMemo(() => {
    const mids = networks
      .map((n) => calcMid(liveSnapshot, n.bidKey, n.askKey, n.transform))
      .filter((v): v is number => v !== null)
    return mids.length > 0 ? (mids.reduce((a, b) => a + b, 0) / mids.length).toFixed(2) : null
  }, [liveSnapshot, networks])

  const lastPrice =
    liveAvg ?? (chartData.length > 0 ? chartData[chartData.length - 1].avg?.toFixed(2) ?? '—' : '—')

  return {
    chartData,
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
    live: !!liveAvg,
    displayNetworks,
    tradingNetworkIds,
    token1Label: tokens.token1,
    token2Label: tokens.token2,
  }
}
