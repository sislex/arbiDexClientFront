import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, Chip, ToggleButton, Typography, IconButton, Slider, Tooltip } from '@mui/material';
import FunctionsIcon from '@mui/icons-material/Functions';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CropFreeIcon from '@mui/icons-material/CropFree';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import type { QuotePoint, Trade } from '../../domain/types';
import { QuoteChart, type ChartSeries, type ChartMarker } from './QuoteChart';
import { CHART, CATEGORICAL } from './colors';
import { fmtTime } from '../format';

export interface ObservedSeries {
  id: string;
  label: string;
  data: { time: number; value: number }[];
}

/** Minimum number of steps kept visible when zooming in. */
const MIN_VISIBLE = 12;

/** Normalize a timestamp to unix seconds — backend series come in ms.
 * FRACTIONAL seconds are kept on purpose: history can contain several steps
 * within one second, and rounding would collapse them into a single point. */
const toSec = (t: number): number => (t > 1e12 ? t / 1000 : t);

/** Collapse points with IDENTICAL timestamps (the chart asserts strictly
 * ascending times) — the last value wins. Sub-second steps stay distinct. */
function dedupeByTime<T extends { time: number }>(arr: T[]): T[] {
  const out: T[] = [];
  for (const p of arr) {
    if (out.length && out[out.length - 1].time === p.time) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

/**
 * Full quote panel: reference (observed) lines that can be collapsed to a
 * single weighted-average line, optional trading buy/sell lines, trade markers,
 * zoom controls, and (in history mode) a playback player to scrub any step.
 */
export function QuoteChartPanel({
  quotes,
  observed,
  hasTradingMarket = true,
  trades = [],
  extraMarkers = [],
  height = 360,
  defaultWeighted = false,
  player = false,
  onTimeClick,
  selectedTime,
}: {
  quotes: QuotePoint[];
  observed?: ObservedSeries[];
  hasTradingMarket?: boolean;
  trades?: Trade[];
  /** Extra chart markers (times in seconds) — e.g. follow-analysis events. */
  extraMarkers?: ChartMarker[];
  height?: number;
  defaultWeighted?: boolean;
  /** Show the history playback player (scrubber + play/pause). */
  player?: boolean;
  /** Called with the clicked point's time in the quotes' own unit (sec/ms). */
  onTimeClick?: (time: number) => void;
  /** Persistently highlighted step (in the quotes' own unit). */
  selectedTime?: number | null;
}) {
  const [weighted, setWeighted] = useState(defaultWeighted);
  const canWeight = !!observed && observed.length > 0;
  const effectiveWeighted = canWeight ? weighted : true;

  const series = useMemo<ChartSeries[]>(() => {
    const out: ChartSeries[] = [];
    if (canWeight && !effectiveWeighted) {
      observed!.forEach((o, i) => {
        out.push({
          id: o.id,
          label: o.label,
          color: CATEGORICAL[i % CATEGORICAL.length],
          data: dedupeByTime(o.data.map((p) => ({ time: toSec(p.time), value: p.value }))),
        });
      });
    } else {
      // avgObservedQuote ≤ 0 means «no observed data» (only observed markets
      // form the weighted average) — such points are dropped, and without any
      // valid point the weighted line is not drawn at all.
      const weightedData = dedupeByTime(
        quotes
          .filter((q) => q.avgObservedQuote > 0)
          .map((q) => ({ time: toSec(q.time), value: q.avgObservedQuote })),
      );
      if (weightedData.length > 0) {
        out.push({ id: 'weighted', label: 'Средневзвешенная', color: CHART.weighted, data: weightedData });
      }
    }
    if (hasTradingMarket) {
      out.push({
        id: 'buy',
        label: 'Цена покупки',
        color: CHART.buy,
        dashed: true,
        data: dedupeByTime(quotes.map((q) => ({ time: toSec(q.time), value: q.buyQuote }))),
      });
      out.push({
        id: 'sell',
        label: 'Цена продажи',
        color: CHART.sell,
        dashed: true,
        data: dedupeByTime(quotes.map((q) => ({ time: toSec(q.time), value: q.sellQuote }))),
      });
    }
    return out;
  }, [quotes, observed, canWeight, effectiveWeighted, hasTradingMarket]);

  const markers = useMemo<ChartMarker[]>(() => {
    const tradeMarkers = hasTradingMarket
      ? trades.map((t) => ({
          time: toSec(t.time),
          side: t.side,
          failed: t.status === 'failed',
          price: t.price,
          pnl: t.pnl ?? null,
        }))
      : [];
    return [...tradeMarkers, ...extraMarkers];
  }, [trades, hasTradingMarket, extraMarkers]);

  // Timeline of steps — union of all series' times, sorted & unique.
  const steps = useMemo<number[]>(() => {
    const set = new Set<number>();
    for (const s of series) for (const p of s.data) set.add(p.time);
    return [...set].sort((a, b) => a - b);
  }, [series]);

  const total = steps.length;
  const [playhead, setPlayhead] = useState(0);
  const [visible, setVisible] = useState(0);
  const [playing, setPlaying] = useState(false);
  const prevTotal = useRef(0);

  // When the data changes, clamp state; stick the playhead to the end (so live
  // data auto-follows) unless the user had scrubbed back.
  useEffect(() => {
    if (total === 0) {
      prevTotal.current = 0;
      return;
    }
    const wasAtEnd = playhead >= prevTotal.current - 1;
    setPlayhead((p) => (wasAtEnd ? total - 1 : Math.min(p, total - 1)));
    setVisible((v) => (v <= 0 || v > total ? total : v));
    prevTotal.current = total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Playback loop.
  useEffect(() => {
    if (!playing || total === 0) return;
    const stepPer = Math.max(1, Math.floor(total / 300));
    const timer = window.setInterval(() => {
      setPlayhead((p) => {
        const next = p + stepPer;
        if (next >= total - 1) {
          setPlaying(false);
          return total - 1;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, total]);

  const zoomIn = () => setVisible((v) => Math.max(MIN_VISIBLE, Math.floor((v || total) * 0.6)));
  const zoomOut = () => setVisible((v) => Math.min(total, Math.ceil((v || total) * 1.6)));
  const zoomReset = () => {
    setVisible(total);
    setPlayhead(total - 1);
  };

  // Wheel over the chart: vertical scroll zooms, horizontal scroll moves the
  // player. Native non-passive listener — React's onWheel is passive since
  // v17, so preventDefault (page scroll) needs this. Latest total/visible are
  // mirrored into a ref so the listener isn't reattached on every zoom/pan.
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const wheelState = useRef({ total, visible, panAcc: 0 });
  wheelState.current.total = total;
  wheelState.current.visible = visible;
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el || !total) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = wheelState.current;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Pan speed scales with the visible window; fractional steps
        // accumulate so slow trackpad swipes still move the playhead.
        const win = st.visible > 0 ? st.visible : st.total;
        st.panAcc += e.deltaX * win * 0.003;
        const step = Math.trunc(st.panAcc);
        if (step) {
          st.panAcc -= step;
          setPlaying(false);
          setPlayhead((p) => Math.max(0, Math.min(st.total - 1, p + step)));
        }
      } else {
        setVisible((v) => {
          const cur = v > 0 ? v : st.total;
          const next = Math.round(cur * Math.exp(e.deltaY * 0.002));
          return Math.min(st.total, Math.max(MIN_VISIBLE, next));
        });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [total]);

  // Visible window derived from playhead + zoom.
  const win = visible > 0 ? visible : total;
  const endIdx = Math.min(playhead, total - 1);
  // The chart needs a non-degenerate range (from < to): near the history start
  // the window shrinks down to two steps instead of collapsing into one point
  // (a collapsed range was silently ignored — the view stuck at the old spot).
  const viewEndIdx = Math.max(endIdx, Math.min(1, total - 1));
  const startIdx = Math.max(0, viewEndIdx - win + 1);
  const viewStartTime = total ? steps[startIdx] : undefined;
  const viewEndTime = total ? steps[viewEndIdx] : undefined;
  const zoomed = win < total;

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
        {canWeight && (
          <ToggleButton
            value="weighted"
            selected={weighted}
            size="small"
            onChange={() => setWeighted((v) => !v)}
            data-testid="toggle-weighted"
            sx={{ textTransform: 'none' }}
          >
            <FunctionsIcon fontSize="small" sx={{ mr: 0.5 }} />
            Привести к средневзвешенной
          </ToggleButton>
        )}
        {/* Zoom controls */}
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Уменьшить масштаб">
            <span><IconButton size="small" onClick={zoomOut} disabled={!total || !zoomed} data-testid="zoom-out"><ZoomOutIcon fontSize="small" /></IconButton></span>
          </Tooltip>
          <Tooltip title="Увеличить масштаб">
            <span><IconButton size="small" onClick={zoomIn} disabled={!total || win <= MIN_VISIBLE} data-testid="zoom-in"><ZoomInIcon fontSize="small" /></IconButton></span>
          </Tooltip>
          <Tooltip title="Весь график">
            <span><IconButton size="small" onClick={zoomReset} disabled={!total} data-testid="zoom-reset"><CropFreeIcon fontSize="small" /></IconButton></span>
          </Tooltip>
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }} data-testid="chart-legend">
          {series.map((s) => (
            <Chip
              key={s.id}
              size="small"
              variant="outlined"
              label={s.label}
              sx={{ borderColor: s.color, '& .MuiChip-label': { color: s.color } }}
            />
          ))}
        </Stack>
      </Stack>

      {quotes.length === 0 ? (
        <Box sx={{ height, display: 'grid', placeItems: 'center' }}>
          <Typography color="text.secondary">Нет данных котировок</Typography>
        </Box>
      ) : (
        <>
          <Box ref={chartWrapRef} sx={onTimeClick ? { cursor: 'crosshair' } : undefined}>
            <QuoteChart
              series={series}
              markers={markers}
              height={height}
              viewStartTime={viewStartTime}
              viewEndTime={viewEndTime}
              onTimeClick={
                onTimeClick &&
                ((sec) => onTimeClick((quotes[0]?.time ?? 0) > 1e12 ? Math.round(sec * 1000) : sec))
              }
              selectedTime={selectedTime != null ? toSec(selectedTime) : null}
            />
          </Box>

          {/* History playback player */}
          {player && total > 1 && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }} data-testid="history-player">
              <IconButton
                size="small"
                color="primary"
                onClick={() => setPlaying((p) => !p)}
                data-testid="player-toggle"
              >
                {playing ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
              <Slider
                size="small"
                min={0}
                max={total - 1}
                value={endIdx}
                onChange={(_, v) => {
                  setPlaying(false);
                  setPlayhead(v as number);
                }}
                data-testid="player-slider"
                sx={{ mx: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 128, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} data-testid="player-time">
                {fmtTime(steps[endIdx])} · {endIdx + 1}/{total}
              </Typography>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
