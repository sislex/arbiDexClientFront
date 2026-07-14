import { useEffect } from "react";
import type { PrecomputedSimulationPayload } from "../fixtures/precomputedSimulationTypes";
import { FIXTURE_CHART_STRATEGY } from "../fixtures/fixtureStrategy";
import type { Strategy } from "./simulationStrategy";
import { StrategySimulationWorkspace } from "./StrategySimulationWorkspace";
import { buildSimulationContextFromStrategy } from "./buildSimulationContextFromStrategy";
import { usePrecomputedSimulation } from "./usePrecomputedSimulation";
import type { SimulationWorkspaceHeader } from "./StrategySimulationWorkspace";

import type { SimulationLogEvent } from "./simulationViewerTypes";

export interface StrategySimulationPageProps {
  payload: PrecomputedSimulationPayload;
  isDark?: boolean;
  className?: string;
  /** Стратегия для meta/сетей в chart header. По умолчанию FIXTURE_CHART_STRATEGY. */
  strategy?: Strategy;
  defaultPlayIdx?: number;
  /** Переопределить chart header (pair, id, status…). */
  header?: Partial<SimulationWorkspaceHeader>;
  /** Колбэк при смене анализа текущего шага (для сигналов в ручной торговле). */
  onStepResultChange?: (stepResult: SimulationLogEvent | null) => void;
}

/**
 * Переносимый симулятор: график + player + sidebar.
 * Без внешней шапки приложения — только workspace.
 */
export function StrategySimulationPage({
  payload,
  isDark = true,
  className,
  strategy = FIXTURE_CHART_STRATEGY,
  defaultPlayIdx,
  header: headerOverride,
  onStepResultChange,
}: StrategySimulationPageProps) {
  const sim = usePrecomputedSimulation(payload, { defaultPlayIdx });
  const ctx = buildSimulationContextFromStrategy(strategy);

  useEffect(() => {
    onStepResultChange?.(sim.stepResult)
  }, [sim.stepResult, onStepResultChange])

  const header: SimulationWorkspaceHeader = {
    pairLabel: ctx.pairLabel,
    networksLabel: ctx.networksLabel,
    lastPrice: sim.lastPrice,
    id: ctx.strategyId,
    status: ctx.status,
    rules: ctx.rules,
    profitCurrency: ctx.profitCurrency,
    ...headerOverride,
  };

  return (
    <div
      className={className}
      style={{ display: 'flex', flex: 1, width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
    >
      <StrategySimulationWorkspace
        className="h-full min-h-0 w-full min-w-0 flex-1"
        isDark={isDark}
        chartData={sim.chartData}
        events={sim.events}
        stepResult={sim.stepResult}
        networks={ctx.displayNetworks}
        tradingNetworkIds={ctx.tradingNetworkIds}
        playIdx={sim.playIdx}
        onPlayIdxChange={sim.setPlayIdx}
        isPlaying={sim.isPlaying}
        onPlayingChange={sim.setIsPlaying}
        speed={sim.speed}
        onSpeedChange={sim.setSpeed}
        loading={false}
        token1Label={ctx.token1Label}
        token2Label={ctx.token2Label}
        header={header}
      />
    </div>
  );
}
