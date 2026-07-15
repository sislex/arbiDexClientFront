import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  LineType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { Box } from '@mui/material';
import { CHART } from './colors';

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  data: { time: number; value: number }[];
  dashed?: boolean;
}

export interface ChartMarker {
  time: number;
  side: 'buy' | 'sell';
  text?: string;
}

/** lightweight-charts renders the time scale in UTC and has no timezone
 * support; the documented workaround is shifting epoch seconds by the local
 * offset. Per-timestamp offset keeps DST transitions correct. Callers keep
 * passing real (UTC) epoch seconds — the shift stays inside this component. */
function toLocal(unixSec: number): UTCTimestamp {
  return (unixSec - new Date(unixSec * 1000).getTimezoneOffset() * 60) as UTCTimestamp;
}

/** Inverse of `toLocal` — chart click times back to real (UTC) epoch seconds. */
function fromLocal(localSec: number): number {
  return localSec + new Date(localSec * 1000).getTimezoneOffset() * 60;
}

/**
 * Thin wrapper around lightweight-charts. Renders any number of line series
 * plus optional buy/sell markers. Purely presentational — legend & toggles
 * live in the parent panel so they're easy to assert in tests.
 */
export function QuoteChart({
  series,
  markers = [],
  height = 360,
  viewStartTime,
  viewEndTime,
  onTimeClick,
}: {
  series: ChartSeries[];
  markers?: ChartMarker[];
  height?: number;
  /** When both set, the chart shows this time window (player/zoom); else fitContent. */
  viewStartTime?: number;
  viewEndTime?: number;
  /** Called with the clicked point's time (real UTC epoch seconds). */
  onTimeClick?: (timeSec: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  // Keep the latest handler in a ref so the click subscription (created once
  // with the chart) always calls the current callback.
  const onTimeClickRef = useRef(onTimeClick);
  useEffect(() => {
    onTimeClickRef.current = onTimeClick;
  }, [onTimeClick]);

  const applyView = (chart: IChartApi) => {
    if (viewStartTime != null && viewEndTime != null && viewEndTime > viewStartTime) {
      try {
        chart.timeScale().setVisibleRange({ from: toLocal(viewStartTime), to: toLocal(viewEndTime) });
      } catch {
        /* range outside data — ignore */
      }
    } else {
      chart.timeScale().fitContent();
    }
  };

  // Create the chart once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: CHART.text,
        fontFamily: 'Inter, sans-serif',
      },
      grid: { vertLines: { color: CHART.grid }, horzLines: { color: CHART.grid } },
      rightPriceScale: { borderColor: CHART.grid },
      timeScale: { borderColor: CHART.grid, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    chart.subscribeClick((param) => {
      if (typeof param.time === 'number') onTimeClickRef.current?.(fromLocal(param.time));
    });

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) chart.applyOptions({ width: Math.floor(w) });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth || 600 });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current.clear();
    };
  }, [height]);

  // Sync series data (recreate series set when ids change).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const map = seriesRef.current;
    const wantIds = new Set(series.map((s) => s.id));

    // Remove stale series.
    for (const [id, s] of map) {
      if (!wantIds.has(id)) {
        chart.removeSeries(s);
        map.delete(id);
      }
    }
    // Add / update.
    let markerHost: ISeriesApi<'Line'> | null = null;
    for (const def of series) {
      let s = map.get(def.id);
      if (!s) {
        s = chart.addLineSeries({
          color: def.color,
          lineWidth: 2,
          lineStyle: def.dashed ? LineStyle.Dashed : LineStyle.Solid,
          lineType: LineType.WithSteps,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        map.set(def.id, s);
      } else {
        s.applyOptions({ color: def.color, lineStyle: def.dashed ? LineStyle.Dashed : LineStyle.Solid });
      }
      s.setData(def.data.map((p) => ({ time: toLocal(p.time), value: p.value })));
      if (!markerHost) markerHost = s;
    }

    // Attach markers to the first series.
    if (markerHost) {
      const ms: SeriesMarker<Time>[] = markers.map((m) => ({
        time: toLocal(m.time),
        position: m.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: m.side === 'buy' ? CHART.buy : CHART.sell,
        shape: m.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: m.text ?? (m.side === 'buy' ? 'B' : 'S'),
      }));
      markerHost.setMarkers(ms);
    }
    applyView(chart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, markers]);

  // React to view-window changes (player scrub / zoom) without resetting data.
  useEffect(() => {
    const chart = chartRef.current;
    if (chart) applyView(chart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStartTime, viewEndTime]);

  return <Box ref={containerRef} data-testid="quote-chart" sx={{ width: '100%', height }} />;
}
