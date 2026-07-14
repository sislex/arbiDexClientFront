import type { EngineConditionEvaluation } from '../simulation/engineConditionTypes'

/** Точка графика — как ChartPoint в UI. */
export interface PrecomputedChartPoint {
  t: number;
  label: string;
  xLabel?: string;
  avg?: number;
  [seriesKey: string]: string | number | undefined;
}

/** Анализ одного шага для сайдбара «Условия покупки/продажи». */
export interface PrecomputedStepAnalysis {
  dataIdx: number;
  t: number;
  label: string;
  action: "WAIT" | "BUY" | "SELL";
  decision: string;
  message: string;
  evaluations: EngineConditionEvaluation[];
}

/** Событие журнала — формат совместим с LogEvent в StrategyDetails. */
export interface PrecomputedLogEvent {
  id: string;
  dataIdx: number;
  time: string;
  type: "System" | "Signal" | "Buy" | "Sell" | "Risk" | "Error";
  message: string;
  markerTs?: number;
  markerPrice?: number;
  detail: {
    rule?: string;
    currentValue?: string;
    required?: string;
    decision?: string;
    status?: string;
    amount?: string;
    requestPrice?: string;
    executedPrice?: string;
    executionOk?: string;
    executionDelayMs?: string;
    slippagePct?: string;
    evaluations?: EngineConditionEvaluation[];
  } | null;
}

/**
 * Полный payload с бэка для display-only симулятора.
 * Клиент не запускает скрипты — только отображает.
 */
export interface PrecomputedSimulationPayload {
  version: number;
  description?: string;
  strategyId?: string;
  pointCount: number;
  stepMs?: number;
  networkId?: string;
  chartData: PrecomputedChartPoint[];
  /** Анализ по каждому dataIdx (длина = pointCount). */
  stepAnalysis: PrecomputedStepAnalysis[];
  /** Полный журнал событий (System, Signal, Buy, Sell, Error). */
  logEvents: PrecomputedLogEvent[];
  stats?: {
    buy: number;
    sell: number;
    error: number;
    total: number;
  };
}

export function stepAnalysisToLogEvent(step: PrecomputedStepAnalysis): PrecomputedLogEvent {
  const type =
    step.action === "BUY" ? "Buy" :
    step.action === "SELL" ? "Sell" :
    "Signal";
  return {
    id: `step-analysis-${step.dataIdx}`,
    dataIdx: step.dataIdx,
    time: step.label,
    type,
    message: step.message,
    markerTs: step.t,
    detail: {
      decision: step.decision,
      evaluations: step.evaluations,
    },
  };
}

/** Срез журнала и анализ текущего шага для playIdx (конец окна, exclusive). */
export function slicePrecomputedForPlayIdx(
  payload: PrecomputedSimulationPayload,
  playIdx: number,
): { logEvents: PrecomputedLogEvent[]; currentStep: PrecomputedStepAnalysis | null } {
  const safeIdx = Math.max(0, Math.min(playIdx, payload.chartData.length));
  const logEvents = payload.logEvents.filter(
    (e) => e.type === "System" || e.dataIdx < safeIdx,
  );
  const currentStep =
    safeIdx > 0 ? payload.stepAnalysis[safeIdx - 1] ?? null : null;
  return { logEvents, currentStep };
}
