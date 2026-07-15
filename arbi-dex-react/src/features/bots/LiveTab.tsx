import { useEffect, useRef, useState } from 'react';
import { Box, Card, CardContent, Stack, Typography, Alert, Chip } from '@mui/material';
import type { Bot, QuotePoint } from '../../domain/types';
import { StatCard } from '../../components/StatCard';
import { QuoteChartPanel } from '../../components/chart/QuoteChartPanel';
import { useAppSelector } from '../../store';
import { api, IS_LIVE } from '../../api';
import type { BotStepResult } from '../../api/types';
import { subscribeMarket, type MarketTick } from '../../api/liveSocket';
import { assembleMarketPreview, type TradingPoint } from '../../api/assemble';
import { marketLabelFromId } from '../../api/live';
import type { PreviewSeries } from '../../api/types';
import { StepResultPanel } from './StepResultPanel';

/** The chart keeps at most the last 30 minutes of live data. */
const WINDOW_SEC = 30 * 60;
/** Redraw cadence while ticks stream in. */
const FLUSH_MS = 500;
/** Do not call the step-result API more often than this. */
const INSPECT_MIN_MS = 3000;

export function LiveTab({ bot }: { bot: Bot }) {
  const marketConfig = useAppSelector((s) => s.marketConfigs.items.find((m) => m.id === bot.marketConfigId));
  const isReal = bot.mode === 'real-live';

  const [quotes, setQuotes] = useState<QuotePoint[]>([]);
  const [streaming, setStreaming] = useState(false);

  // Live stream: subscribe to the config's markets via the /live-chart socket,
  // assemble steps every FLUSH_MS and keep only the last 30 minutes.
  const observedKey = marketConfig?.observedMarketIds.join(',') ?? '';
  useEffect(() => {
    if (!IS_LIVE || !marketConfig) return;
    const observedIds = marketConfig.observedMarketIds;
    const tradingId = marketConfig.tradingMarketId || null;
    if (!tradingId && observedIds.length === 0) return;
    const weights = marketConfig.weights ?? {};

    const observedData = new Map<string, { time: number; value: number }[]>(
      observedIds.map((id) => [id, []]),
    );
    let tradingData: TradingPoint[] = [];
    const lastBA = new Map<string, { bid?: number; ask?: number }>();
    let dirty = false;

    const onTick = (id: string, isTrading: boolean) => (tick: MarketTick) => {
      const sec = Math.floor(tick.t / 1000);
      const ba = lastBA.get(id) ?? {};
      ba[tick.field] = tick.v;
      lastBA.set(id, ba);
      if (isTrading) {
        if (ba.bid != null && ba.ask != null) {
          if (tradingData.length && tradingData[tradingData.length - 1].time === sec)
            tradingData[tradingData.length - 1] = { time: sec, bid: ba.bid, ask: ba.ask };
          else tradingData = [...tradingData, { time: sec, bid: ba.bid, ask: ba.ask }];
          dirty = true;
        }
      } else {
        const mid = ba.bid != null && ba.ask != null ? (ba.bid + ba.ask) / 2 : ba.bid ?? ba.ask;
        if (mid != null) {
          const arr = observedData.get(id)!;
          if (arr.length && arr[arr.length - 1].time === sec) arr[arr.length - 1] = { time: sec, value: mid };
          else arr.push({ time: sec, value: mid });
          dirty = true;
        }
      }
    };

    const unsubs = observedIds.map((id) => subscribeMarket(id, onTick(id, false)));
    if (tradingId) unsubs.push(subscribeMarket(tradingId, onTick(tradingId, true)));
    setStreaming(true);

    const timer = window.setInterval(() => {
      if (!dirty) return;
      dirty = false;
      // Trim everything older than the 30-minute window.
      const cutoff = Math.floor(Date.now() / 1000) - WINDOW_SEC;
      tradingData = tradingData.filter((p) => p.time >= cutoff);
      for (const [id, arr] of observedData) {
        observedData.set(id, arr.filter((p) => p.time >= cutoff));
      }
      const observedSeries: PreviewSeries[] = observedIds.map((id) => ({
        id,
        label: marketLabelFromId(id),
        data: observedData.get(id)!.slice(),
      }));
      setQuotes(assembleMarketPreview(observedSeries, tradingData.slice(), weights).quotes);
    }, FLUSH_MS);

    return () => {
      unsubs.forEach((u) => u());
      window.clearInterval(timer);
      setStreaming(false);
      setQuotes([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketConfig?.id, marketConfig?.tradingMarketId, observedKey]);

  // Every new step → inspect the latest one via the API (throttled) and show
  // the breakdown in the side panel.
  const [stepResult, setStepResult] = useState<BotStepResult | null>(null);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const lastInspectedStep = useRef<number | null>(null);
  const lastCallAt = useRef(0);
  const inFlight = useRef(false);
  const lastTime = quotes[quotes.length - 1]?.time ?? null;
  useEffect(() => {
    if (lastTime == null || !IS_LIVE) return;
    if (lastInspectedStep.current === lastTime) return;
    const now = Date.now();
    if (inFlight.current || now - lastCallAt.current < INSPECT_MIN_MS) return;
    lastInspectedStep.current = lastTime;
    lastCallAt.current = now;
    inFlight.current = true;
    setStepLoading(true);
    api.bots
      .stepResult(bot.id, { time: lastTime * 1000 })
      .then((r) => {
        setStepResult(r);
        setStepError(null);
      })
      .catch((e) => {
        setStepError((e as Error).message);
      })
      .finally(() => {
        inFlight.current = false;
        setStepLoading(false);
      });
  }, [lastTime, bot.id]);

  const last = quotes[quotes.length - 1];

  return (
    <Box>
      {isReal && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="real-warning">
          Реальный режим: сделки исполняются настоящими транзакциями on-chain.
        </Alert>
      )}

      {!IS_LIVE && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="live-mock-note">
          Поток реального времени доступен только в live-режиме (нужен сервер с вебсокетами).
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <StatCard label="Цена покупки" value={last ? last.buyQuote.toFixed(2) : '—'} />
        <StatCard label="Цена продажи" value={last ? last.sellQuote.toFixed(2) : '—'} />
        <StatCard
          label="Средневзвешенная"
          value={last && last.avgObservedQuote > 0 ? last.avgObservedQuote.toFixed(2) : '—'}
        />
        <StatCard
          label="Шагов в окне"
          value={<span data-testid="live-step-count">{quotes.length}</span>}
          sub={
            <Typography variant="caption" color={streaming ? 'success.main' : 'text.secondary'}>
              {streaming ? '● поток активен' : 'нет потока'}
            </Typography>
          }
        />
      </Stack>

      {/* Live chart (2/3) + latest-step breakdown (1/3), like the backtest tab. */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
        <Box sx={{ width: { xs: '100%', lg: '66.667%' }, flexShrink: 0 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1">Котировки в реальном времени</Typography>
                {streaming && (
                  <Chip size="small" color="success" variant="outlined" label="● LIVE" data-testid="live-indicator" sx={{ fontWeight: 700 }} />
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" color="text.secondary">последние 30 минут</Typography>
              </Stack>
              {quotes.length === 0 ? (
                <Box sx={{ height: 340, display: 'grid', placeItems: 'center' }}>
                  <Typography color="text.secondary">
                    {IS_LIVE ? 'Ожидание тиков рынков…' : 'Нет потока'}
                  </Typography>
                </Box>
              ) : (
                <QuoteChartPanel
                  quotes={quotes}
                  hasTradingMarket={!!marketConfig?.tradingMarketId}
                  height={340}
                  defaultWeighted
                  selectedTime={last?.time ?? null}
                />
              )}
            </CardContent>
          </Card>
        </Box>
        <StepResultPanel result={stepResult} loading={stepLoading} error={stepError} source={stepResult ? 'api' : null} />
      </Stack>
    </Box>
  );
}
