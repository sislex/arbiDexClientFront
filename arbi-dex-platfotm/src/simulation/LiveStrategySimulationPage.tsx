import { useEffect } from 'react'
import { useLiveMarketSimulation } from '../hooks/useLiveMarketSimulation'
import type { Strategy } from './simulationStrategy'
import { StrategySimulationWorkspace, type SimulationWorkspaceHeader } from './StrategySimulationWorkspace'
import type { SimulationLogEvent } from './simulationViewerTypes'

export interface LiveStrategySimulationPageProps {
  strategy: Strategy
  isDark?: boolean
  className?: string
  header?: Partial<SimulationWorkspaceHeader>
  onStepResultChange?: (stepResult: SimulationLogEvent | null) => void
}

export function LiveStrategySimulationPage({
  strategy,
  isDark = true,
  className,
  header: headerOverride,
  onStepResultChange,
}: LiveStrategySimulationPageProps) {
  const live = useLiveMarketSimulation({ strategy, enabled: true })

  useEffect(() => {
    onStepResultChange?.(live.stepResult)
  }, [live.stepResult, onStepResultChange])

  const header: SimulationWorkspaceHeader = {
    pairLabel: strategy.pair.map((p) => p.pair).join(' · '),
    networksLabel: live.displayNetworks.map((n) => n.label).join(' · '),
    lastPrice: live.lastPrice,
    live: live.live,
    id: strategy.id,
    status: strategy.status,
    rules: strategy.rules,
    profitCurrency: strategy.profitCurrency,
    ...headerOverride,
  }

  return (
    <div
      className={className}
      style={{ display: 'flex', flex: 1, width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
    >
      <StrategySimulationWorkspace
        className="h-full min-h-0 w-full min-w-0 flex-1"
        isDark={isDark}
        chartData={live.chartData}
        events={live.events}
        stepResult={live.stepResult}
        networks={live.displayNetworks}
        tradingNetworkIds={live.tradingNetworkIds}
        playIdx={live.playIdx}
        onPlayIdxChange={live.setPlayIdx}
        isPlaying={live.isPlaying}
        onPlayingChange={live.setIsPlaying}
        speed={live.speed}
        onSpeedChange={live.setSpeed}
        loading={live.loading}
        loadingMessage={
          live.loadingPhase === 'history'
            ? 'Loading historical data…'
            : `Calculating BUY/SELL on last ${import.meta.env.VITE_HISTORICAL_SIM_STEPS ?? 300} steps…`
        }
        error={live.error}
        token1Label={live.token1Label}
        token2Label={live.token2Label}
        header={header}
      />
    </div>
  )
}
