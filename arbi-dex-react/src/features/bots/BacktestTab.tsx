import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Stack, Button, TextField, Typography, CircularProgress, Divider, Alert,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import type { Bot, QuotePoint } from '../../domain/types';
import { StatCard } from '../../components/StatCard';
import { PnlValue } from '../../components/PnlValue';
import { fmtMoney } from '../../components/format';
import { QuoteChartPanel } from '../../components/chart/QuoteChartPanel';
import { useAppDispatch, useAppSelector } from '../../store';
import { runBacktest } from '../../store/tradingSlice';
import { fetchBot } from '../../store/botsSlice';
import { api } from '../../api';
import { TradesTable } from './TradesTable';
import { usePeriod } from './usePeriod';
import { PeriodPicker } from './PeriodPicker';

export function BacktestTab({ bot }: { bot: Bot }) {
  const dispatch = useAppDispatch();
  const result = useAppSelector((s) => s.trading.backtest);
  const status = useAppSelector((s) => s.trading.backtestStatus);
  const error = useAppSelector((s) => s.trading.backtestError);
  const [initialBalance, setInitialBalance] = useState(bot.initialBalance);
  const period = usePeriod(bot.id);

  // History chart for the selected period — shown before any backtest run and
  // redrawn immediately whenever from/to change.
  const [historyQuotes, setHistoryQuotes] = useState<QuotePoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  useEffect(() => {
    // Wait until usePeriod resolves the default period so we don't fetch twice.
    if (period.from == null || period.to == null) return;
    let cancelled = false;
    setLoadingHistory(true);
    api.bots
      .quotes(bot.id, { from: period.from, to: period.to })
      .then((r) => {
        if (!cancelled) setHistoryQuotes(r.quotes);
      })
      .catch(() => {
        if (!cancelled) setHistoryQuotes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bot.id, period.from, period.to]);

  // Pick the period by clicking the chart: first click → «Начало», second → «Конец».
  const [pick, setPick] = useState<'idle' | 'from' | 'to'>('idle');
  const onChartTimeClick = (time: number) => {
    if (pick === 'from') {
      period.setFrom(time);
      if (period.to != null && time > period.to) period.setTo(time);
      setPick('to');
    } else if (pick === 'to') {
      if (period.from != null && time < period.from) {
        // Clicked earlier than the picked start — swap so the range stays valid.
        period.setTo(period.from);
        period.setFrom(time);
      } else {
        period.setTo(time);
      }
      setPick('idle');
    }
  };

  const run = async () => {
    await dispatch(
      runBacktest({
        strategyConfigId: bot.strategyConfigId,
        marketConfigId: bot.marketConfigId,
        from: period.from ?? undefined,
        to: period.to ?? undefined,
        initialBalance,
        botId: bot.id,
      }),
    );
    // Refresh the bot so the demo account (balance/PnL) reflects the run.
    dispatch(fetchBot(bot.id));
  };

  const s = result?.stats;

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Прогон стратегии на реальных исторических котировках за выбранный период.
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
              <PeriodPicker period={period} idPrefix="bt" />
              <Box sx={{ flexGrow: 1 }} />
              <TextField
                label="Начальный баланс" size="small" type="number" value={initialBalance}
                onChange={(e) => setInitialBalance(Number(e.target.value))}
                sx={{ width: 160 }} inputProps={{ 'data-testid': 'bt-balance' }}
              />
              <Button
                variant="contained"
                startIcon={status === 'loading' ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                onClick={run}
                disabled={status === 'loading'}
                data-testid="run-backtest"
              >
                Запустить бэктест
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {status === 'failed' && error && (
        <Alert severity="error" data-testid="bt-error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* History chart for the period — always visible; trades overlay after a run. */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">
              {result ? 'График с транзакциями' : 'История котировок за период'}
            </Typography>
            {loadingHistory && <CircularProgress size={16} />}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small"
              variant={pick === 'idle' ? 'outlined' : 'contained'}
              color={pick === 'idle' ? 'inherit' : 'primary'}
              startIcon={<HighlightAltIcon />}
              onClick={() => setPick(pick === 'idle' ? 'from' : 'idle')}
              disabled={historyQuotes.length === 0}
              data-testid="bt-pick-period"
            >
              {pick === 'idle'
                ? 'Выбрать период на графике'
                : pick === 'from'
                  ? 'Кликните на графике: начало'
                  : 'Кликните на графике: конец'}
            </Button>
          </Stack>
          {historyQuotes.length === 0 && !loadingHistory ? (
            <Box sx={{ height: 340, display: 'grid', placeItems: 'center' }} data-testid="bt-history-empty">
              <Typography color="text.secondary">Нет котировок за выбранный период</Typography>
            </Box>
          ) : (
            <QuoteChartPanel
              quotes={historyQuotes}
              trades={result?.trades ?? []}
              hasTradingMarket
              height={340}
              defaultWeighted
              player
              onTimeClick={pick === 'idle' ? undefined : onChartTimeClick}
            />
          )}
        </CardContent>
      </Card>

      {!result && status === 'idle' && (
        <Typography color="text.secondary">Запустите бэктест, чтобы увидеть результат.</Typography>
      )}

      {status === 'loading' && !result && (
        <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
      )}

      {result && s && (
        <Stack spacing={2} data-testid="bt-result">
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
            <StatCard label="PnL" value={<PnlValue value={s.pnl} pct={s.pnlPct} variant="h6" />} />
            <StatCard label="Итоговый баланс" value={fmtMoney(s.finalBalance, bot.quoteAsset)} />
            <StatCard label="Сделок" value={s.trades} />
            <StatCard label="Winrate" value={`${s.winRate}%`} />
            <StatCard label="Макс. просадка" value={`${s.maxDrawdownPct}%`} />
          </Stack>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Сделки ({result.trades.length})</Typography>
              <Divider sx={{ mb: 1 }} />
              <TradesTable trades={result.trades} />
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
