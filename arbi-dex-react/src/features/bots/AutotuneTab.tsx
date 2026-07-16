import { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Stack, Button, TextField, Typography, CircularProgress,
  Alert, Table, TableBody, TableCell, TableHead, TableRow, Chip, Divider, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, InputAdornment,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { Bot } from '../../domain/types';
import { StatCard } from '../../components/StatCard';
import { PnlValue } from '../../components/PnlValue';
import { fmtDuration } from '../../components/format';
import { useAppDispatch, useAppSelector } from '../../store';
import { runAutotuneThunk } from '../../store/tradingSlice';
import { createStrategyConfig, updateStrategyConfig } from '../../store/strategyConfigsSlice';
import { updateBot } from '../../store/botsSlice';
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
  const bots = useAppSelector((s) => s.bots.items);
  const period = usePeriod(bot.id);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);
  const [maxCombos, setMaxCombos] = useState(1000);
  const [initialBalance, setInitialBalance] = useState(bot.initialBalance);
  const [applyDialog, setApplyDialog] = useState(false);

  /** How many bots share the bot's current strategy (incl. this one). */
  const strategyUsers = useMemo(
    () => bots.filter((b) => b.strategyConfigId === bot.strategyConfigId).length,
    [bots, bot.strategyConfigId],
  );

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
      maxCombos,
      initialBalance,
      botId: bot.id,
    }));

  // Apply the best combo: either mutate the shared strategy or clone it for
  // this bot only — the user picks in a confirm dialog (other bots may share
  // the strategy).
  const applyToCurrent = async () => {
    if (!result?.best || !strategy) return;
    const { buy, sell } = applyComboToStrategy(strategy, result.best.params);
    await dispatch(updateStrategyConfig({ id: strategy.id, patch: { buy, sell } }));
    setApplyDialog(false);
    setAppliedMsg('Коэффициенты применены к текущей стратегии');
  };

  const applyAsDuplicate = async () => {
    if (!result?.best || !strategy) return;
    const { buy, sell } = applyComboToStrategy(strategy, result.best.params);
    const created = await dispatch(
      createStrategyConfig({ name: `${strategy.name} — автоподбор (${bot.name})`, buy, sell }),
    ).unwrap();
    await dispatch(updateBot({ id: bot.id, patch: { strategyConfigId: created.id } }));
    setApplyDialog(false);
    setAppliedMsg(`Создан дубликат «${created.name}» и привязан к боту`);
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
            <TextField
              label="Начальный баланс" size="small" type="number" value={initialBalance}
              onChange={(e) => setInitialBalance(Number(e.target.value))}
              sx={{ width: 200 }} inputProps={{ 'data-testid': 'at-balance' }}
              // Валюта баланса бота (quoteAsset) — её тратит покупка.
              InputProps={{ endAdornment: <InputAdornment position="end">{bot.quoteAsset}</InputAdornment> }}
            />
            <TextField
              label="Лимит прогонов" size="small" type="number" value={maxCombos}
              onChange={(e) => setMaxCombos(Math.max(1, Math.round(Number(e.target.value) || 0)))}
              inputProps={{ min: 1, step: 100, 'data-testid': 'at-max-combos' }}
              sx={{ width: 150 }}
            />
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
                <Typography variant="subtitle1">Лучшая комбинация</Typography>
                <Button variant="contained" color="success" startIcon={<AutoFixHighIcon />} onClick={() => setApplyDialog(true)} data-testid="apply-best">
                  Применить к стратегии
                </Button>
              </Stack>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2, mb: 1 }}>
                <StatCard label="PnL" value={<PnlValue value={best.stats.pnl} pct={best.stats.pnlPct} variant="h6" />} />
                <StatCard label="Winrate" value={`${best.stats.winRate}%`} />
                <StatCard label="Сделок" value={best.stats.trades} />
                <StatCard label="Просадка" value={`${best.stats.maxDrawdownPct}%`} />
                <StatCard
                  label="Прогонов"
                  value={
                    <span data-testid="at-combos">
                      {result.totalCombos.toLocaleString('ru-RU')}
                      {result.gridTotal != null && result.gridTotal > result.totalCombos
                        ? ` из ${result.gridTotal.toLocaleString('ru-RU')}`
                        : ''}
                    </span>
                  }
                />
                {result.tookMs != null && (
                  <StatCard label="Время расчёта" value={<span data-testid="at-took">{fmtDuration(result.tookMs)}</span>} />
                )}
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
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Топ {result.combos.length.toLocaleString('ru-RU')} комбинаций (по PnL)</Typography>
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

      {/* Apply choice: the strategy may be shared by several bots. */}
      <Dialog open={applyDialog} onClose={() => setApplyDialog(false)} data-testid="apply-dialog">
        <DialogTitle>Как применить коэффициенты?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {strategyUsers > 1
              ? `Эту стратегию используют ${strategyUsers} бот(а/ов). Изменение текущей стратегии затронет их всех.`
              : 'Эту стратегию использует только этот бот.'}{' '}
            Можно создать дубликат стратегии с подобранными коэффициентами и привязать его только к этому боту.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDialog(false)} data-testid="apply-cancel">Отмена</Button>
          <Button onClick={applyToCurrent} color="warning" data-testid="apply-current">
            Изменить текущую
          </Button>
          <Button onClick={applyAsDuplicate} variant="contained" startIcon={<ContentCopyIcon />} data-testid="apply-duplicate">
            Дубликат для этого бота
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!appliedMsg}
        autoHideDuration={4000}
        onClose={() => setAppliedMsg(null)}
        message={appliedMsg ?? ''}
      />
    </Box>
  );
}
