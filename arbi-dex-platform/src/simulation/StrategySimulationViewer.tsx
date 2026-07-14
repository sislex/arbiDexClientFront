import { useCallback, useEffect, useMemo, useState } from "react";
import {
  StrategySimulationWorkspace,
  type SimulationWorkspaceHeader,
} from "./StrategySimulationWorkspace";
import {
  DEFAULT_NETWORKS,
  NETWORK_COLORS,
  buildNetworksFromStrategy,
  type NetworkSource,
} from "./simulationNetworkTypes";
import type { SimulationChartPoint, SimulationLogEvent } from "./simulationViewerTypes";

export interface StrategySimulationViewerProps {
  /** Полный массив точек графика. */
  data: SimulationChartPoint[];
  /** Журнал событий симуляции. */
  events?: SimulationLogEvent[];
  /** Результат анализа текущего шага (условия buy/sell). */
  stepResult?: SimulationLogEvent | null;
  networkIds?: string[];
  tradingNetworkIds?: Set<string> | string[];
  loading?: boolean;
  isDark?: boolean;
  className?: string;
  token1Label?: string;
  token2Label?: string;
  /** Controlled playback index (0..data.length). */
  playIdx?: number;
  onPlayIdxChange?: (idx: number) => void;
  /** Начальный playIdx для uncontrolled режима. */
  defaultPlayIdx?: number;
  isPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  speed?: number;
  onSpeedChange?: (speed: number) => void;
  header?: SimulationWorkspaceHeader;
  /** @deprecated Используйте header */
  chartHeader?: React.ReactNode;
  loadingMessage?: string;
  error?: string | null;
}

function resolveNetworks(networkIds?: string[]): Array<{ id: string; label: string; color: string }> {
  if (!networkIds?.length) {
    return DEFAULT_NETWORKS.map((n) => ({ id: n.id, label: n.label, color: n.color }));
  }
  return networkIds.map((id, index) => {
    const def = DEFAULT_NETWORKS.find((n) => n.id === id);
    return {
      id,
      label: def?.label ?? id,
      color: def?.color ?? NETWORK_COLORS[index % NETWORK_COLORS.length],
    };
  });
}

export function StrategySimulationViewer({
  data,
  events = [],
  stepResult = null,
  networkIds,
  tradingNetworkIds,
  loading = false,
  isDark = true,
  className,
  token1Label = "Token1",
  token2Label = "Token2",
  playIdx: playIdxProp,
  onPlayIdxChange,
  defaultPlayIdx = 0,
  isPlaying,
  onPlayingChange,
  speed,
  onSpeedChange,
  header,
  chartHeader: _chartHeader,
  loadingMessage,
  error,
}: StrategySimulationViewerProps) {
  const [internalPlayIdx, setInternalPlayIdx] = useState(defaultPlayIdx);
  const playIdx = playIdxProp ?? internalPlayIdx;

  const setPlayIdx = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, data.length));
      if (onPlayIdxChange) onPlayIdxChange(clamped);
      else setInternalPlayIdx(clamped);
    },
    [data.length, onPlayIdxChange],
  );

  useEffect(() => {
    if (playIdxProp === undefined) {
      setInternalPlayIdx(Math.min(defaultPlayIdx, data.length));
    }
  }, [data.length, defaultPlayIdx, playIdxProp]);

  const networks = useMemo(() => resolveNetworks(networkIds), [networkIds]);

  const resolvedTradingNetworkIds = useMemo(() => {
    if (tradingNetworkIds) {
      return tradingNetworkIds instanceof Set ? tradingNetworkIds : new Set(tradingNetworkIds);
    }
    return new Set(networks[0] ? [networks[0].id] : []);
  }, [tradingNetworkIds, networks]);

  const defaultHeader = useMemo<SimulationWorkspaceHeader>(() => {
    const lastPoint = data[data.length - 1];
    return {
      pairLabel: "Simulation",
      networksLabel: networks.map((n) => n.label).join(" · "),
      lastPrice: typeof lastPoint?.avg === "number" ? lastPoint.avg.toFixed(2) : "—",
    };
  }, [data, networks]);

  return (
    <StrategySimulationWorkspace
      className={className}
      isDark={isDark}
      chartData={data}
      events={events}
      stepResult={stepResult}
      networks={networks}
      tradingNetworkIds={resolvedTradingNetworkIds}
      playIdx={playIdx}
      onPlayIdxChange={setPlayIdx}
      isPlaying={isPlaying}
      onPlayingChange={onPlayingChange}
      speed={speed}
      onSpeedChange={onSpeedChange}
      loading={loading}
      loadingMessage={loadingMessage}
      error={error}
      token1Label={token1Label}
      token2Label={token2Label}
      header={header ?? defaultHeader}
    />
  );
}

export { buildNetworksFromStrategy, type NetworkSource };
