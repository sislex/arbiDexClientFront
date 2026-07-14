import { StrategySimulationPage, type StrategySimulationPageProps } from "./StrategySimulationPage";

export type PrecomputedSimulationViewerProps = StrategySimulationPageProps;

/** @deprecated Алиас StrategySimulationPage */
export function PrecomputedSimulationViewer(props: PrecomputedSimulationViewerProps) {
  return <StrategySimulationPage {...props} />;
}
