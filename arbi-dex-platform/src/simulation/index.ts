export { StrategySimulationPage } from "./StrategySimulationPage";
export type { StrategySimulationPageProps } from "./StrategySimulationPage";
export { PrecomputedSimulationViewer } from "./PrecomputedSimulationViewer";
export type { PrecomputedSimulationViewerProps } from "./PrecomputedSimulationViewer";
export { usePrecomputedSimulation } from "./usePrecomputedSimulation";
export type {
  UsePrecomputedSimulationOptions,
  UsePrecomputedSimulationResult,
} from "./usePrecomputedSimulation";
export {
  buildSimulationContextFromStrategy,
  buildTradingNetworkIds,
} from "./buildSimulationContextFromStrategy";
export type { SimulationDisplayContext } from "./buildSimulationContextFromStrategy";
export { StrategySimulationViewer } from "./StrategySimulationViewer";
export type { StrategySimulationViewerProps } from "./StrategySimulationViewer";
export { StrategySimulationFixture } from "./StrategySimulationFixture";
export { StrategySimulationWorkspace } from "./StrategySimulationWorkspace";
export type {
  StrategySimulationWorkspaceProps,
  SimulationWorkspaceHeader,
} from "./StrategySimulationWorkspace";
export { ChartErrorBoundary } from "./ChartErrorBoundary";
export { PlayerBtn } from "./PlayerBtn";
export { SimulationPlayer } from "./SimulationPlayer";
export type { SimulationPlayerProps } from "./SimulationPlayer";
export { SimulationSidebar } from "./SimulationSidebar";
export type { SimulationSidebarProps } from "./SimulationSidebar";
export { StepResultPanel } from "./StepResultPanel";
export { EventExplainPanel } from "./EventExplainPanel";
export {
  buildNetworksFromStrategy,
  DEFAULT_NETWORKS,
  NETWORK_COLORS,
  exchangeId,
  normalizeToken,
  resolveStrategyTokenSymbols,
} from "./simulationNetworkTypes";
export type { NetworkSource } from "./simulationNetworkTypes";
export {
  chartCrosshairDateTime,
  chartDateTime,
  chartTimeOnly,
  eventTime,
} from "./simulationFormatters";
export type {
  SimulationLogEvent,
  SimulationEventType,
  SimulationEventDetail,
  SimulationChartPoint,
} from "./simulationViewerTypes";
export {
  SIMULATION_EVENT_TYPE_CONFIG,
  PLAYBACK_SPEEDS,
  DEFAULT_PLAYBACK_INTERVAL_MS,
  MAX_RENDERED_LOG_EVENTS,
} from "./simulationViewerTypes";
