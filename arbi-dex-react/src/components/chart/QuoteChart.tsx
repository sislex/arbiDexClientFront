import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  LineType,
  type IChartApi,
  type ISeriesApi,
  type ISeriesPrimitive,
  type SeriesAttachedParameter,
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
  /** Failed live trade — drawn as a warning circle instead of an arrow. */
  failed?: boolean;
  /** Trade price — shown in the hover tooltip («куплено/продано по …»). */
  price?: number | null;
  /** Realised PnL of a closing sell — shown in the tooltip. */
  pnl?: number | null;
  /** Custom tooltip line (e.g. a follow-analysis event) — replaces the default
   * bought/sold wording. */
  tooltip?: string;
}

/** Series primitive drawing a dashed vertical line at the selected step. */
class SelectedTimeLine implements ISeriesPrimitive<Time> {
  private _time: UTCTimestamp | null = null;
  private _chart: IChartApi | null = null;
  private _requestUpdate: (() => void) | null = null;

  attached({ chart, requestUpdate }: SeriesAttachedParameter<Time>) {
    this._chart = chart;
    this._requestUpdate = requestUpdate;
  }

  detached() {
    this._chart = null;
    this._requestUpdate = null;
  }

  setTime(t: UTCTimestamp | null) {
    this._time = t;
    this._requestUpdate?.();
  }

  paneViews() {
    return [
      {
        renderer: () => ({
          draw: (target: {
            useMediaCoordinateSpace: (
              cb: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => void,
            ) => void;
          }) => {
            const time = this._time;
            const chart = this._chart;
            if (time == null || !chart) return;
            const x = chart.timeScale().timeToCoordinate(time);
            if (x == null) return;
            target.useMediaCoordinateSpace(({ context, mediaSize }) => {
              context.save();
              context.strokeStyle = CHART.selected;
              context.lineWidth = 1;
              context.setLineDash([4, 3]);
              context.beginPath();
              context.moveTo(x, 0);
              context.lineTo(x, mediaSize.height);
              context.stroke();
              context.restore();
            });
          },
        }),
      },
    ];
  }
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

/** Tooltip time with seconds — series can tick multiple times a minute. */
function fmtTipTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Tooltip price: 2 decimals for big values, significant digits for tiny ones. */
function fmtVal(v: number): string {
  return Math.abs(v) >= 1 ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toPrecision(4);
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
  selectedTime,
}: {
  series: ChartSeries[];
  markers?: ChartMarker[];
  height?: number;
  /** When both set, the chart shows this time window (player/zoom); else fitContent. */
  viewStartTime?: number;
  viewEndTime?: number;
  /** Called with the clicked point's time (real UTC epoch seconds). */
  onTimeClick?: (timeSec: number) => void;
  /** Dashed vertical line at this time (real UTC epoch seconds). */
  selectedTime?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const selectedLineRef = useRef<SelectedTimeLine>(new SelectedTimeLine());
  const selectedHostRef = useRef<ISeriesApi<'Line'> | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Latest series defs / markers for the crosshair tooltip (the subscription
  // is created once with the chart, so it reads through refs).
  const defsRef = useRef<ChartSeries[]>([]);
  defsRef.current = series;
  const markersRef = useRef<ChartMarker[]>([]);
  markersRef.current = markers;

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

    // Hover tooltip: every series value at the crosshair time plus trade
    // events (bought/sold at which price) that happened on that step.
    chart.subscribeCrosshairMove((param) => {
      const tip = tooltipRef.current;
      const host = containerRef.current;
      if (!tip || !host) return;
      if (typeof param.time !== 'number' || !param.point) {
        tip.style.display = 'none';
        return;
      }

      const rows: string[] = [
        `<div style="color:${CHART.text};margin-bottom:4px">${fmtTipTime(fromLocal(param.time))}</div>`,
      ];
      for (const def of defsRef.current) {
        const s = seriesRef.current.get(def.id);
        const d = s ? (param.seriesData.get(s) as { value?: number } | undefined) : undefined;
        if (d?.value == null) continue;
        rows.push(
          `<div style="display:flex;gap:6px;align-items:center">` +
            `<span style="width:8px;height:8px;border-radius:50%;background:${def.color};flex-shrink:0"></span>` +
            `<span style="color:${CHART.text}">${escapeHtml(def.label)}:</span>` +
            `<span style="margin-left:auto;font-variant-numeric:tabular-nums">${fmtVal(d.value)}</span>` +
          `</div>`,
        );
      }
      // Events on this step: trades (bought/sold at price) or custom-tooltip
      // markers (e.g. follow-analysis events).
      for (const m of markersRef.current) {
        if (toLocal(m.time) !== param.time) continue;
        const color = m.failed ? CHART.failed : m.side === 'buy' ? CHART.buy : CHART.sell;
        const icon = m.failed ? '✕ ' : m.side === 'buy' ? '▲ ' : '▼ ';
        let line: string;
        if (m.tooltip) {
          line = escapeHtml(m.tooltip);
        } else {
          const action = m.side === 'buy' ? (m.failed ? 'Покупка не прошла' : 'Куплено') : m.failed ? 'Продажа не прошла' : 'Продано';
          const price = m.price != null ? ` по ${fmtVal(m.price)}` : '';
          const pnl = !m.failed && m.side === 'sell' && m.pnl != null
            ? ` · PnL ${m.pnl >= 0 ? '+' : ''}${fmtVal(m.pnl)}`
            : '';
          line = `${action}${price}${pnl}`;
        }
        rows.push(`<div style="color:${color};margin-top:4px">${icon}${line}</div>`);
      }

      if (rows.length <= 1) {
        tip.style.display = 'none';
        return;
      }
      tip.innerHTML = rows.join('');
      tip.style.display = 'block';
      // Flip near the right/bottom edges so the tooltip stays inside the chart.
      const pad = 12;
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const hostW = host.clientWidth;
      const hostH = host.clientHeight;
      let x = param.point.x + pad;
      if (x + w > hostW) x = Math.max(0, param.point.x - w - pad);
      let y = param.point.y + pad;
      if (y + h > hostH) y = Math.max(0, param.point.y - h - pad);
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
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
      selectedHostRef.current = null;
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

    // Attach markers to the first series (sorted — the lib requires ascending times).
    if (markerHost) {
      const ms: SeriesMarker<Time>[] = [...markers]
        .sort((a, b) => a.time - b.time)
        .map((m) => ({
          time: toLocal(m.time),
          position: m.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
          color: m.failed ? CHART.failed : m.side === 'buy' ? CHART.buy : CHART.sell,
          shape: m.failed ? ('circle' as const) : m.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
          text: m.text ?? `${m.failed ? '✕' : ''}${m.side === 'buy' ? 'B' : 'S'}`,
        }));
      markerHost.setMarkers(ms);
    }

    // Keep the selected-time line primitive attached to the (possibly new) first series.
    if (selectedHostRef.current !== markerHost) {
      selectedHostRef.current?.detachPrimitive(selectedLineRef.current);
      markerHost?.attachPrimitive(selectedLineRef.current);
      selectedHostRef.current = markerHost;
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

  // Move the selected-step vertical line.
  useEffect(() => {
    selectedLineRef.current.setTime(selectedTime != null ? toLocal(selectedTime) : null);
  }, [selectedTime]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height }}>
      <Box ref={containerRef} data-testid="quote-chart" sx={{ width: '100%', height }} />
      {/* Crosshair tooltip (populated imperatively from subscribeCrosshairMove). */}
      <Box
        ref={tooltipRef}
        data-testid="chart-tooltip"
        sx={{
          display: 'none',
          position: 'absolute',
          zIndex: 3,
          pointerEvents: 'none',
          minWidth: 170,
          maxWidth: 300,
          px: 1.25,
          py: 1,
          fontSize: 12,
          lineHeight: 1.5,
          borderRadius: 1,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(16,20,28,0.94)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      />
    </Box>
  );
}
