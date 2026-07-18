import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { BotSession, LiveTrade, QuotePoint, Side, Trade } from '../../domain/types';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { PnlValue } from '../../components/PnlValue';
import { QuoteChartPanel } from '../../components/chart/QuoteChartPanel';
import { fmtDuration, fmtTime } from '../../components/format';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBot } from '../../store/botsSlice';
import { fetchMarketConfigs } from '../../store/marketConfigsSlice';
import { api, IS_LIVE } from '../../api';
import { tokenAsset } from './botAssets';
import { LiveTradesTable, TradesMarkdownActions } from './LiveTradesTable';
import { LiveTab } from './LiveTab';

/**
 * Страница торговой сессии. Активная сессия — живой вид (как вкладка
 * «Реальное время» бота); завершённая — исторический вид как бэктест: график
 * котировок за окно сессии с маркерами сделок и журнал под ним.
 */
export function SessionPage() {
  const { id, sessionId } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const bot = useAppSelector((s) => s.bots.items.find((b) => b.id === id) ?? s.bots.current);

  const [session, setSession] = useState<BotSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuotePoint[]>([]);
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) dispatch(fetchBot(id));
    dispatch(fetchMarketConfigs());
  }, [dispatch, id]);

  // Сессия + (для завершённой) котировки окна и сделки.
  useEffect(() => {
    if (!IS_LIVE || !id || !sessionId) return;
    let alive = true;
    setLoading(true);
    api.bots
      .session(id, sessionId)
      .then(async (s) => {
        if (!alive) return;
        setSession(s);
        if (!s.active) {
          const to = s.endedAt || Date.now();
          const [q, t] = await Promise.all([
            api.bots.quotes(id, { from: s.startedAt, to }),
            api.bots.trades(id, { from: s.startedAt, to }),
          ]);
          if (!alive) return;
          setQuotes(q.quotes.map((p) => (p.time > 1e12 ? { ...p, time: p.time / 1000 } : p)));
          setTrades(t);
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, sessionId]);

  // Рыночная семантика (как на live-вкладке): маркеры и стороны — в терминах
  // актива графика; у инверсных листингов бот-buy отображается продажей.
  const isStableSym = (s: string): boolean => s.toUpperCase().includes('USD');
  const inverted = bot ? isStableSym(bot.baseAsset) && !isStableSym(bot.quoteAsset) : false;
  const displayAsset = bot ? (inverted ? bot.quoteAsset : bot.baseAsset) : '';
  const toDisplaySide = (s: Side): Side => (inverted ? (s === 'buy' ? 'sell' : 'buy') : s);

  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const snapToStep = (unixMs: number): number | null => {
    if (quotes.length === 0) return null;
    const sec = Math.round(unixMs / 1000);
    let nearest = quotes[0].time;
    let bestD = Math.abs(quotes[0].time - sec);
    for (const q of quotes) {
      const d = Math.abs(q.time - sec);
      if (d < bestD) {
        bestD = d;
        nearest = q.time;
      }
    }
    return nearest;
  };

  const chartTrades = useMemo<Trade[]>(
    () =>
      trades
        .map((t) => {
          const time = snapToStep(t.time);
          if (time == null) return null;
          const trade: Trade = {
            id: t.id,
            time,
            side: toDisplaySide(t.side),
            price: t.price ?? t.expectedPrice ?? 0,
            amount: t.amountIn,
            pnl: t.pnl ?? undefined,
            status: t.status,
          };
          return trade;
        })
        .filter((t): t is Trade => t !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, quotes, inverted],
  );

  if (!IS_LIVE) {
    return <Alert severity="info">Сессии доступны только в live-режиме (нужен сервер).</Alert>;
  }
  if (!bot || loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !session) {
    return <Alert severity="error">{error ?? 'Сессия не найдена'}</Alert>;
  }

  const header = (
    <PageHeader
      title={`Сессия · ${bot.name}`}
      subtitle={`${fmtTime(session.startedAt / 1000)} — ${session.active ? 'идёт' : fmtTime(session.endedAt / 1000)} · ${
        session.mode === 'real-live' ? 'реальная торговля' : 'демо'
      }`}
      actions={
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/bots/${bot.id}?tab=sessions`)} data-testid="session-back">
          К сессиям
        </Button>
      }
    />
  );

  // Активная сессия = живой вид бота (график с запуска, поток, журнал).
  if (session.active) {
    return (
      <Box>
        {header}
        <LiveTab bot={bot} />
      </Box>
    );
  }

  return (
    <Box data-testid="session-page">
      {header}

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <StatCard label="Длительность" value={fmtDuration(session.endedAt - session.startedAt)} />
        <StatCard label="Сделок" value={String(session.tradesCount)} sub={
          session.failedCount > 0 ? (
            <Typography variant="caption" color="error.main">неудачных: {session.failedCount}</Typography>
          ) : undefined
        } />
        <StatCard label="Результат" value={<PnlValue value={session.pnl} pct={session.pnlPct} />} />
        <StatCard label="Баланс на старте" value={`${session.startBalance} ${bot.quoteAsset}`} />
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">Котировки за сессию</Typography>
            <Chip size="small" variant="outlined" label={`${quotes.length} шагов`} />
          </Stack>
          {quotes.length === 0 ? (
            <Box sx={{ height: 340, display: 'grid', placeItems: 'center' }}>
              <Typography color="text.secondary">Нет котировок за окно сессии</Typography>
            </Box>
          ) : (
            <QuoteChartPanel
              quotes={quotes}
              trades={chartTrades}
              hasTradingMarket
              height={340}
              defaultWeighted
              selectedTime={selectedTime}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">Сделки сессии ({trades.length})</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <TradesMarkdownActions
              trades={trades}
              markdownOpts={{
                title: `Сделки — ${bot.name}, сессия ${fmtTime(session.startedAt / 1000)} — ${fmtTime(session.endedAt / 1000)}`,
                displaySide: toDisplaySide,
                displayAsset: displayAsset || tokenAsset(bot),
                cashAsset: bot.quoteAsset,
              }}
              fileName={`${bot.name.replace(/[^\wа-яА-ЯёЁ-]+/g, '_')}-session-trades.md`}
            />
          </Stack>
          <LiveTradesTable
            trades={trades}
            displaySide={toDisplaySide}
            displayAsset={displayAsset || tokenAsset(bot)}
            onRowClick={(t) => setSelectedTime(snapToStep(t.time))}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
