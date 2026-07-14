export interface StrategyChartPoint {
  t: number;
  label: string;
  xLabel?: string;
  avg?: number;
  [seriesKey: string]: string | number | undefined;
}

export interface StrategyChartEvent {
  dataIdx: number;
  markerTs: number;
  markerPrice: number;
  type: "Buy" | "Sell" | "Error";
  detail?: string;
}

export interface StrategyChartZoomWindow {
  start: number;
  size: number;
}

export interface StrategyChartFixture {
  version?: number;
  pointCount?: number;
  stepMs?: number;
  networkId?: string;
  chartData: StrategyChartPoint[];
  events?: StrategyChartEvent[];
}
