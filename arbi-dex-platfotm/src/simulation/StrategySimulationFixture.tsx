import { useEffect, useState } from "react";
import type { StrategyChartFixture } from "./strategyChartTypes";
import { StrategySimulationViewer } from "./StrategySimulationViewer";
import type { SimulationLogEvent } from "./simulationViewerTypes";

interface StrategySimulationFixtureProps {
  src?: string;
  className?: string;
  isDark?: boolean;
  defaultPlayIdx?: number;
}

const DEFAULT_FIXTURE_SRC = "/fixtures/chart-data-100k.json";

function fixtureEventsToLogEvents(events: StrategyChartFixture["events"]): SimulationLogEvent[] {
  if (!events?.length) return [];
  return events.map((ev, i) => ({
    id: `fixture-${i}-${ev.dataIdx}`,
    time: new Date(ev.markerTs).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
    type: ev.type,
    message: ev.detail ?? ev.type,
    detail: null,
    dataIdx: ev.dataIdx,
    markerTs: ev.markerTs,
    markerPrice: ev.markerPrice,
  }));
}

export function StrategySimulationFixture({
  src = DEFAULT_FIXTURE_SRC,
  className,
  isDark = true,
  defaultPlayIdx = 0,
}: StrategySimulationFixtureProps) {
  const [fixture, setFixture] = useState<StrategyChartFixture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<StrategyChartFixture>;
      })
      .then((json) => {
        if (!cancelled) {
          setFixture(json);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (loading && !fixture) {
    return (
      <div className={className} style={{ padding: 16, fontFamily: "var(--font-mono)", fontSize: 12 }}>
        Загрузка fixture…
      </div>
    );
  }

  if (error || !fixture?.chartData?.length) {
    return (
      <div className={className} style={{ padding: 16, color: "#E5383B", fontFamily: "var(--font-mono)", fontSize: 12 }}>
        {error ?? "Fixture пуст"}
      </div>
    );
  }

  return (
    <StrategySimulationViewer
      className={className}
      isDark={isDark}
      loading={loading}
      data={fixture.chartData}
      events={fixtureEventsToLogEvents(fixture.events)}
      networkIds={fixture.networkId ? [fixture.networkId] : undefined}
      defaultPlayIdx={defaultPlayIdx}
    />
  );
}
