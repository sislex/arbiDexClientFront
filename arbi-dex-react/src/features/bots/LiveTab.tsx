import { useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Stack, Button, Typography, Alert, Chip, Divider,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import type { Bot, QuotePoint } from '../../domain/types';
import { StatCard } from '../../components/StatCard';
import { QuoteChartPanel } from '../../components/chart/QuoteChartPanel';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchQuotes, setStreaming, pushTick, clearLive } from '../../store/tradingSlice';

const TICK_MS = 200;

/** Advance one mock tick from the previous quote (small random walk + spread). */
function nextTick(prev: QuotePoint): QuotePoint {
  const drift = (Math.random() - 0.5) * 0.004;
  const mid = prev.avgObservedQuote * (1 + drift);
  const diverge = (Math.random() - 0.5) * 0.01;
  const tradingMid = mid * (1 + diverge);
  const half = 0.0008;
  return {
    time: prev.time + 60,
    avgObservedQuote: Math.round(mid * 100) / 100,
    buyQuote: Math.round(tradingMid * (1 + half) * 100) / 100,
    sellQuote: Math.round(tradingMid * (1 - half) * 100) / 100,
  };
}

export function LiveTab({ bot }: { bot: Bot }) {
  const dispatch = useAppDispatch();
  const baseQuotes = useAppSelector((s) => s.trading.quotes);
  const liveTicks = useAppSelector((s) => s.trading.liveTicks);
  const streaming = useAppSelector((s) => s.trading.streaming);
  const timerRef = useRef<number | null>(null);
  const isReal = bot.mode === 'real-live';

  useEffect(() => {
    dispatch(fetchQuotes({ marketConfigId: bot.marketConfigId, count: 120 }));
    return () => {
      dispatch(clearLive());
    };
  }, [dispatch, bot.marketConfigId]);

  // Streaming loop: append a tick every TICK_MS while `streaming`.
  useEffect(() => {
    if (!streaming) return;
    timerRef.current = window.setInterval(() => {
      dispatch((dispatchInner, getState) => {
        const st = getState().trading;
        const last = st.liveTicks[st.liveTicks.length - 1] ?? st.quotes[st.quotes.length - 1];
        if (last) dispatchInner(pushTick(nextTick(last)));
      });
    }, TICK_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [streaming, dispatch]);

  const combined = [...baseQuotes, ...liveTicks];
  const lastPrice = combined[combined.length - 1];

  return (
    <Box>
      {isReal && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="real-warning">
          Реальный режим: сделки исполняются настоящими транзакциями on-chain.
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
            <Chip
              label={isReal ? 'Реальные транзакции' : 'Демо-режим'}
              color={isReal ? 'error' : 'info'}
              variant="outlined"
            />
            <Typography variant="body2" color="text.secondary">
              Автоторговля в реальном времени. Переключить режим можно в шапке бота.
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            {!streaming ? (
              <Button variant="contained" color="success" startIcon={<PlayArrowIcon />} onClick={() => dispatch(setStreaming(true))} data-testid="live-start">
                Запустить поток
              </Button>
            ) : (
              <Button variant="outlined" color="warning" startIcon={<StopIcon />} onClick={() => dispatch(setStreaming(false))} data-testid="live-stop">
                Остановить
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <StatCard label="Цена покупки" value={lastPrice ? lastPrice.buyQuote : '—'} />
        <StatCard label="Цена продажи" value={lastPrice ? lastPrice.sellQuote : '—'} />
        <StatCard label="Средневзвешенная" value={lastPrice ? lastPrice.avgObservedQuote : '—'} />
        <StatCard label="Живых тиков" value={<span data-testid="live-tick-count">{liveTicks.length}</span>} sub={<Typography variant="caption" color={streaming ? 'success.main' : 'text.secondary'}>{streaming ? '● поток активен' : 'остановлено'}</Typography>} />
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Котировки в реальном времени</Typography>
          <Divider sx={{ mb: 1 }} />
          <QuoteChartPanel quotes={combined} hasTradingMarket height={340} defaultWeighted />
        </CardContent>
      </Card>
    </Box>
  );
}
