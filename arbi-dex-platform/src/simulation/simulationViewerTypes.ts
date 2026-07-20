import type { EngineConditionEvaluation } from "./engineConditionTypes";
import type { StrategyChartPoint } from "./strategyChartTypes";

export type SimulationEventType = "System" | "Signal" | "Buy" | "Sell" | "Risk" | "Error";

export interface SimulationEventDetail {
  rule?: string;
  currentValue?: string;
  required?: string;
  risk?: string;
  status?: string;
  decision?: string;
  amount?: string;
  requestPrice?: string;
  executedPrice?: string;
  executionOk?: string;
  executionDelayMs?: string;
  slippagePct?: string;
  evaluations?: EngineConditionEvaluation[];
  stepIndex?: number;
  totalSteps?: number;
  windowSteps?: number;
  stepTime?: number;
  buyQuote?: number;
  sellQuote?: number;
  avgQuote?: number;
  transactionBuy?: boolean;
  transactionSell?: boolean;
  forcedSell?: boolean;
  tookMs?: number;
}

export interface SimulationLogEvent {
  id: string;
  time: string;
  type: SimulationEventType;
  message: string;
  detail: SimulationEventDetail | null;
  dataIdx: number;
  markerTs?: number;
  markerPrice?: number;
}

export const SIMULATION_EVENT_TYPE_CONFIG: Record<
  SimulationEventType,
  { color: string; label: string }
> = {
  System: { color: "#6B7A8D", label: "SYS" },
  Signal: { color: "#3B82F6", label: "SIG" },
  Buy: { color: "#10B981", label: "BUY" },
  Sell: { color: "#E5383B", label: "SLL" },
  Risk: { color: "#F97316", label: "RSK" },
  Error: { color: "#EAB308", label: "ERR" },
};

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;
export const DEFAULT_PLAYBACK_INTERVAL_MS = 200;
export const MAX_RENDERED_LOG_EVENTS = 400;

export type SimulationChartPoint = StrategyChartPoint;
