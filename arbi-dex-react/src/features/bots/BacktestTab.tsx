import { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Button, TextField, Typography, CircularProgress, Divider, Alert,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { Bot } from '../../domain/types';
import { StatCard } from '../../components/StatCard';
import { PnlValue } from '../../components/PnlValue';
import { fmtMoney } from '../../components/format';
import { useAppDispatch, useAppSelector } from '../../store';
import { runBacktest } from '../../store/tradingSlice';
import { fetchBot } from '../../store/botsSlice';
import { api } from '../../api';
import type { BotStepResult } from '../../api/types';
import { TradesTable } from './TradesTable';
import { usePeriod } from './usePeriod';
import { PeriodPicker } from './PeriodPicker';
import { PeriodHistoryChart } from './PeriodHistoryChart';
import { StepResultPanel } from './StepResultPanel';

export function BacktestTab({ bot }: { bot: Bot }) {
  const dispatch = useAppDispatch();
  const result = useAppSelector((s) => s.trading.backtest);
  const status = useAppSelector((s) => s.trading.backtestStatus);
  const error = useAppSelector((s) => s.trading.backtestError);
  const [initialBalance, setInitialBalance] = useState(bot.initialBalance);
  const period = usePeriod(bot.id);

  // Engine evaluation (processStep) of the clicked chart step → side panel.
  const [stepResult, setStepResult] = useState<BotStepResult | null>(null);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const inspectStep = async (time: number) => {
    setStepLoading(true);
    setStepError(null);
    try {
      setStepResult(await api.bots.stepResult(bot.id, { time }));
    } catch (e) {
      setStepResult(null);
      setStepError((e as Error).message);
    } finally {
      setStepLoading(false);
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

      {/* History chart for the period (2/3) + engine step inspector (1/3). */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch" sx={{ mb: 2 }}>
        <Box sx={{ width: { xs: '100%', lg: '66.667%' }, flexShrink: 0 }}>
          <PeriodHistoryChart
            botId={bot.id}
            period={period}
            trades={result?.trades ?? []}
            title={result ? 'График с транзакциями' : 'История котировок за период'}
            idPrefix="bt"
            onStepClick={inspectStep}
          />
        </Box>
        <StepResultPanel result={stepResult} loading={stepLoading} error={stepError} />
      </Stack>

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
