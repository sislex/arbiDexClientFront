import { useCallback, useEffect, useRef, useState } from 'react'
import type { BotTradeHandlers } from '../components/bot/BotTradingButtons'
import { BotBacktestPeriodPicker, applyChartPeriodPick } from '../components/bot/BotBacktestPeriodPicker'
import { useBotBacktest } from '../hooks/useServerBotBacktest'
import { useBotPeriod, type ChartPeriodPickMode } from '../hooks/useBotPeriod'
import type { ServerBot } from '../services/botsApi'
import { StrategySimulationWorkspace, type SimulationWorkspaceHeader } from './StrategySimulationWorkspace'
import type { SimulationLogEvent } from './simulationViewerTypes'

export interface ServerBotSimulationPageProps {
  bot: ServerBot
  isDark?: boolean
  className?: string
  header?: Partial<SimulationWorkspaceHeader>
  onStepResultChange?: (stepResult: SimulationLogEvent | null) => void
  onBotRefresh?: () => void
  showPlayer?: boolean
  onTradeHandlersChange?: (handlers: BotTradeHandlers | null) => void
}

function tradeHandlersEqual(a: BotTradeHandlers, b: BotTradeHandlers): boolean {
  return (
    a.onBuy === b.onBuy &&
    a.onSell === b.onSell &&
    a.tradePending === b.tradePending &&
    a.tradeError === b.tradeError &&
    a.canBuy === b.canBuy &&
    a.canSell === b.canSell
  )
}

export function ServerBotSimulationPage({
  bot,
  isDark = true,
  className,
  header: headerOverride,
  onStepResultChange,
  onBotRefresh,
  showPlayer = true,
  onTradeHandlersChange,
}: ServerBotSimulationPageProps) {
  const period = useBotPeriod(bot.id)
  const [chartPickMode, setChartPickMode] = useState<ChartPeriodPickMode>('idle')
  const chartPickModeRef = useRef(chartPickMode)
  chartPickModeRef.current = chartPickMode
  const sim = useBotBacktest({
    bot,
    period,
    enabled: true,
    onBotRefresh,
    suspendPeriodReload: chartPickMode !== 'idle',
  })

  const onTradeHandlersChangeRef = useRef(onTradeHandlersChange)
  onTradeHandlersChangeRef.current = onTradeHandlersChange
  const lastTradeHandlersRef = useRef<BotTradeHandlers | null>(null)

  useEffect(() => {
    onStepResultChange?.(sim.stepResult)
  }, [sim.stepResult, onStepResultChange])

  const header: SimulationWorkspaceHeader = {
    pairLabel: `${bot.baseAsset}/${bot.quoteAsset}`,
    networksLabel: `${bot.baseAsset}/${bot.quoteAsset}`,
    lastPrice: sim.lastPrice !== undefined ? String(sim.lastPrice) : undefined,
    live: false,
    id: bot.id,
    status: bot.status === 'running' ? 'Running' : bot.status === 'paused' ? 'Paused' : 'Stopped',
    rules: 0,
    profitCurrency: bot.quoteAsset,
    ...headerOverride,
  }

  const handleStepRecalc = useCallback(() => {
    if (sim.inspectTime != null) {
      void sim.inspectViaApi(sim.inspectTime)
    } else {
      sim.analyzeCurrentStep(true)
    }
  }, [sim])

  const handleChartPeriodPick = useCallback(
    (time: number) => {
      applyChartPeriodPick(period, time, chartPickModeRef.current, setChartPickMode)
    },
    [period],
  )

  useEffect(() => {
    if (sim.chartData.length === 0 && chartPickMode !== 'idle') setChartPickMode('idle')
  }, [sim.chartData.length, chartPickMode])

  useEffect(() => {
    const notify = onTradeHandlersChangeRef.current
    if (!notify) return

    const next: BotTradeHandlers = {
      onBuy: sim.executeBuy,
      onSell: sim.executeSell,
      tradePending: sim.tradePending,
      tradeError: sim.tradeError,
      canBuy: sim.canBuy,
      canSell: sim.canSell,
    }

    if (lastTradeHandlersRef.current && tradeHandlersEqual(lastTradeHandlersRef.current, next)) return

    lastTradeHandlersRef.current = next
    notify(next)
  }, [
    sim.executeBuy,
    sim.executeSell,
    sim.tradePending,
    sim.tradeError,
    sim.canBuy,
    sim.canSell,
  ])

  useEffect(() => {
    return () => {
      lastTradeHandlersRef.current = null
      onTradeHandlersChangeRef.current?.(null)
    }
  }, [])

  return (
    <div
      className={className}
      style={{ display: 'flex', flex: 1, width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
    >
      <StrategySimulationWorkspace
        className="h-full min-h-0 w-full min-w-0 flex-1"
        isDark={isDark}
        chartData={sim.chartData}
        chartFullData={sim.fullChartData}
        events={sim.events}
        stepResult={sim.stepResult}
        networks={sim.displayNetworks}
        tradingNetworkIds={sim.tradingNetworkIds}
        playIdx={sim.playIdx}
        onPlayIdxChange={sim.setPlayIdx}
        isPlaying={sim.isPlaying}
        onPlayingChange={sim.setIsPlaying}
        speed={sim.speed}
        onSpeedChange={sim.setSpeed}
        loading={sim.loading}
        loadingMessage={
          sim.backtestLoading
            ? 'Running server backtest (max 1000 steps)…'
            : 'Loading historical quotes…'
        }
        error={sim.error}
        token1Label={sim.token1Label}
        token2Label={sim.token2Label}
        header={{
          ...header,
          badge: (
            <>
              {header.badge}
              {sim.backtest ? (
                <span className="ml-1 text-[10px] text-muted">· График с транзакциями</span>
              ) : sim.events.some((e) => e.type === 'Buy' || e.type === 'Sell' || e.type === 'Error') ? (
                <span className="ml-1 text-[10px] text-muted">· Сделки на графике</span>
              ) : (
                <span className="ml-1 text-[10px] text-muted">· История котировок за период</span>
              )}
              {!sim.hasObservedAvg && sim.chartData.length > 0 && (
                <span className="ml-1 text-[10px] text-warning">
                  · Нет средневзвешенной (observed) — только buy/sell
                </span>
              )}
            </>
          ),
        }}
        showPlayer={showPlayer}
        chartToolbar={
          <BotBacktestPeriodPicker
            period={period}
            chartPickMode={chartPickMode}
            onChartPickModeChange={setChartPickMode}
            chartDataAvailable={sim.chartData.length > 0}
          />
        }
        chartPeriodPickMode={chartPickMode}
        onChartPeriodPick={handleChartPeriodPick}
        stepLoading={sim.stepAnalyzing}
        stepError={sim.stepError}
        onStepRecalc={sim.inspectTime != null ? handleStepRecalc : undefined}
        collapsibleBacktestPanel
        simulationActions={{
          onRunBacktest: () => void sim.runBacktest(),
          onAnalyzeStep: () => sim.analyzeCurrentStep(false),
          backtestLoading: sim.backtestLoading,
          stepAnalyzing: sim.stepAnalyzing,
          backtestDone: !!sim.backtest,
          stepSource: sim.stepSource,
        }}
      />
    </div>
  )
}
