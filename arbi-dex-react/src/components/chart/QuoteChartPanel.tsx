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
  height = 360,
  defaultWeighted = false,
  player = false,
}: {
  quotes: QuotePoint[];
  observed?: ObservedSeries[];
  hasTradingMarket?: boolean;
  trades?: Trade[];
  height?: number;
  defaultWeighted?: boolean;
  /** Show the history playback player (scrubber + play/pause). */
  player?: boolean;
}) {
  const [weighted, setWeighted] = useState(defaultWeighted);
  const canWeight = !!observed && observed.length > 0;
  const effectiveWeighted = canWeight ? weighted : true;

  const series = useMemo<ChartSeries[]>(() => {
    const out: ChartSeries[] = [];
    if (canWeight && !effectiveWeighted) {
      observed!.forEach((o, i) => {
        out.push({ id: o.id, label: o.label, color: CATEGORICAL[i % CATEGORICAL.length], data: o.data });
      });
    } else {
      out.push({
        id: 'weighted',
        label: 'Средневзвешенная',
        color: CHART.weighted,
        data: quotes.map((q) => ({ time: q.time, value: q.avgObservedQuote })),
      });
    }
    if (hasTradingMarket) {
      out.push({
        id: 'buy',
        label: 'Цена покупки',
        color: CHART.buy,
        dashed: true,
        data: quotes.map((q) => ({ time: q.time, value: q.buyQuote })),
      });
      out.push({
        id: 'sell',
        label: 'Цена продажи',
        color: CHART.sell,
        dashed: true,
        data: quotes.map((q) => ({ time: q.time, value: q.sellQuote })),
      });
    }
    return out;
  }, [quotes, observed, canWeight, effectiveWeighted, hasTradingMarket]);

  const markers = useMemo<ChartMarker[]>(
    () => (hasTradingMarket ? trades.map((t) => ({ time: t.time, side: t.side })) : []),
    [trades, hasTradingMarket],
  );

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

  // Visible window derived from playhead + zoom.
  const win = visible > 0 ? visible : total;
  const endIdx = Math.min(playhead, total - 1);
  const startIdx = Math.max(0, endIdx - win + 1);
  const viewStartTime = total ? steps[startIdx] : undefined;
  const viewEndTime = total ? steps[endIdx] : undefined;
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
          <QuoteChart series={series} markers={markers} height={height} viewStartTime={viewStartTime} viewEndTime={viewEndTime} />

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
