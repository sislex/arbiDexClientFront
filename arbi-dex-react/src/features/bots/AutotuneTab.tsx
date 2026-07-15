import { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Stack, Button, Typography, CircularProgress,
  Alert, Table, TableBody, TableCell, TableHead, TableRow, Chip, Divider, Snackbar,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import type { Bot } from '../../domain/types';
import { StatCard } from '../../components/StatCard';
import { PnlValue } from '../../components/PnlValue';
import { useAppDispatch, useAppSelector } from '../../store';
import { runAutotuneThunk } from '../../store/tradingSlice';
import { updateStrategyConfig } from '../../store/strategyConfigsSlice';
import { tuneKeyLabel, applyComboToStrategy } from './autotuneLabels';
import { usePeriod } from './usePeriod';
import { PeriodPicker } from './PeriodPicker';
import { PeriodHistoryChart } from './PeriodHistoryChart';

export function AutotuneTab({ bot }: { bot: Bot }) {
  const dispatch = useAppDispatch();
  const result = useAppSelector((s) => s.trading.autotune);
  const status = useAppSelector((s) => s.trading.autotuneStatus);
  const error = useAppSelector((s) => s.trading.autotuneError);
  const strategy = useAppSelector((s) => s.strategyConfigs.items.find((x) => x.id === bot.strategyConfigId));
  const period = usePeriod(bot.id);
  const [applied, setApplied] = useState(false);

  // Which dimensions will be swept (tune ranges enabled in the strategy).
  const dims = useMemo(() => {
    if (!strategy) return [] as string[];
    const out: string[] = [];
    (['buy', 'sell'] as const).forEach((side) => {
      for (const c of strategy[side]) {
        if (!c.enabled) continue;
        for (const [k, r] of Object.entries(c.tuneRanges)) {
          if (r.enabled) out.push(`${side}.${c.conditionId}.${k}`);
        }
      }
    });
    return out;
  }, [strategy]);

  const columns = useMemo(() => {
    const set = new Set<string>();
    result?.combos.forEach((c) => Object.keys(c.params).forEach((k) => set.add(k)));
    return [...set];
  }, [result]);

  const run = () =>
    dispatch(runAutotuneThunk({
      strategyConfigId: bot.strategyConfigId,
      marketConfigId: bot.marketConfigId,
      from: period.from ?? undefined,
      to: period.to ?? undefined,
      maxCombos: 48,
      botId: bot.id,
    }));

  const applyBest = () => {
    if (!result?.best || !strategy) return;
    const { buy, sell } = applyComboToStrategy(strategy, result.best.params);
    dispatch(updateStrategyConfig({ id: strategy.id, patch: { buy, sell } }));
    setApplied(true);
  };

  const best = result?.best;

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              Прогон исторических котировок с разными коэффициентами (диапазоны задаются в стратегии) в демо-режиме.
            </Typography>
            <PeriodPicker period={period} idPrefix="at" />
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              startIcon={status === 'loading' ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={run}
              disabled={status === 'loading' || dims.length === 0}
              data-testid="run-autotune"
            >
              Запустить подбор
            </Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />
          {dims.length === 0 ? (
            <Alert severity="info">
              Не выбраны диапазоны для подбора. Включите их в редакторе стратегии (тумблер «Показать диапазоны авто-подбора»).
            </Alert>
          ) : (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Подбираются:</Typography>
              {dims.map((d) => (<Chip key={d} size="small" variant="outlined" label={tuneKeyLabel(d)} />))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {status === 'failed' && error && (
        <Alert severity="error" data-testid="at-error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <PeriodHistoryChart botId={bot.id} period={period} idPrefix="at" />
      </Box>

      {status === 'loading' && !result && <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>}

      {result && best && (
        <Stack spacing={2} data-testid="at-result">
          <Card sx={{ borderColor: 'success.main' }} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle1">Лучшая комбинация из {result.totalCombos}</Typography>
                <Button variant="contained" color="success" startIcon={<AutoFixHighIcon />} onClick={applyBest} data-testid="apply-best">
                  Применить к стратегии
                </Button>
              </Stack>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2, mb: 1 }}>
                <StatCard label="PnL" value={<PnlValue value={best.stats.pnl} pct={best.stats.pnlPct} variant="h6" />} />
                <StatCard label="Winrate" value={`${best.stats.winRate}%`} />
                <StatCard label="Сделок" value={best.stats.trades} />
                <StatCard label="Просадка" value={`${best.stats.maxDrawdownPct}%`} />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(best.params).map(([k, v]) => (
                  <Chip key={k} size="small" color="success" variant="outlined" label={`${tuneKeyLabel(k)}: ${v}`} />
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Все комбинации (по PnL)</Typography>
              <Box sx={{ maxHeight: 360, overflow: 'auto' }} data-testid="at-grid">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      {columns.map((c) => (<TableCell key={c}>{tuneKeyLabel(c)}</TableCell>))}
                      <TableCell align="right">PnL</TableCell>
                      <TableCell align="right">Winrate</TableCell>
                      <TableCell align="right">Сделок</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.combos.map((combo, i) => (
                      <TableRow key={combo.id} selected={i === 0}>
                        <TableCell>{i + 1}</TableCell>
                        {columns.map((c) => (<TableCell key={c}>{combo.params[c] ?? '—'}</TableCell>))}
                        <TableCell align="right"><PnlValue value={combo.stats.pnl} /></TableCell>
                        <TableCell align="right">{combo.stats.winRate}%</TableCell>
                        <TableCell align="right">{combo.stats.trades}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      )}

      <Snackbar
        open={applied}
        autoHideDuration={3000}
        onClose={() => setApplied(false)}
        message="Коэффициенты применены к стратегии"
      />
    </Box>
  );
}
