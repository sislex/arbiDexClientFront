import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, CardContent, Stack, Button, TextField, Typography, CircularProgress,
  Alert, Table, TableBody, TableCell, TableHead, TableRow, Chip, Divider, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, InputAdornment,
  LinearProgress, Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import type { AutotuneCombo, AutotuneEstimate, AutotuneJob, BacktestStats, Bot, SearchType } from '../../domain/types';
import { StatCard } from '../../components/StatCard';
import { PnlValue } from '../../components/PnlValue';
import { fmtDuration } from '../../components/format';
import { useAppDispatch, useAppSelector } from '../../store';
import { setAutotuneResult } from '../../store/tradingSlice';
import { createStrategyConfig, updateStrategyConfig } from '../../store/strategyConfigsSlice';
import { updateBot } from '../../store/botsSlice';
import { tuneKeyLabel, applyComboToStrategy } from './autotuneLabels';
import { usePeriod } from './usePeriod';
import { PeriodPicker } from './PeriodPicker';
import { PeriodHistoryChart } from './PeriodHistoryChart';
import { SearchTypeSelect } from './SearchTypeSelect';
import { api } from '../../api';
import { subscribeAutotuneProgress } from '../../api/liveSocket';

export function AutotuneTab({ bot }: { bot: Bot }) {
  const dispatch = useAppDispatch();
  const result = useAppSelector((s) => s.trading.autotune);
  const status = useAppSelector((s) => s.trading.autotuneStatus);
  const storeError = useAppSelector((s) => s.trading.autotuneError);
  const strategy = useAppSelector((s) => s.strategyConfigs.items.find((x) => x.id === bot.strategyConfigId));
  const bots = useAppSelector((s) => s.bots.items);
  const period = usePeriod(bot.id);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);
  const [maxCombos, setMaxCombos] = useState(1000);
  const [initialBalance, setInitialBalance] = useState(bot.initialBalance);
  const [threads, setThreads] = useState(6);
  const [searchType, setSearchType] = useState<SearchType>('grid');
  const [applyDialog, setApplyDialog] = useState(false);

  // ── Оценка: сколько прогонов и сколько это займёт ─────────────────────────
  const [estimate, setEstimate] = useState<AutotuneEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  // Параметры изменились → прежняя оценка неактуальна.
  useEffect(() => {
    setEstimate(null);
  }, [period.from, period.to, maxCombos, threads, searchType]);
  const runEstimate = async () => {
    setEstimating(true);
    setEstimateError(null);
    try {
      setEstimate(
        await api.bots.autotuneEstimate(bot.id, {
          from: period.from ?? undefined,
          to: period.to ?? undefined,
          maxCombos,
          threads,
          searchType,
        }),
      );
    } catch (e) {
      setEstimateError((e as Error).message);
    } finally {
      setEstimating(false);
    }
  };

  // ── Фоновый прогон с live-прогрессом по вебсокету ──────────────────────────
  const [job, setJob] = useState<AutotuneJob | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  useEffect(() => () => unsubRef.current?.(), []);

  const jobStorageKey = `at-job-${bot.id}`;
  const handleSnapshot = (snap: AutotuneJob) => {
    setJob(snap);
    if (snap.status === 'done' || snap.status === 'error') {
      unsubRef.current?.();
      unsubRef.current = null;
      sessionStorage.removeItem(jobStorageKey);
      if (snap.status === 'done' && snap.result) dispatch(setAutotuneResult(snap.result));
    }
  };

  // Переподключение к идущему прогону после ухода с вкладки/перезагрузки:
  // jobId хранится в sessionStorage, снапшот забирается по REST, дальше сокет.
  useEffect(() => {
    const savedJobId = sessionStorage.getItem(jobStorageKey);
    if (!savedJobId) return;
    let cancelled = false;
    api.bots
      .autotuneJob(bot.id, savedJobId)
      .then((snap) => {
        if (cancelled) return;
        handleSnapshot(snap);
        if (snap.status === 'running' || snap.status === 'queued' || snap.status === 'paused') {
          unsubRef.current = subscribeAutotuneProgress(snap.jobId, handleSnapshot);
        }
      })
      .catch(() => sessionStorage.removeItem(jobStorageKey));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id]);

  const running = job != null && (job.status === 'running' || job.status === 'queued' || job.status === 'paused');
  const error = startError ?? (job?.status === 'error' ? job.error : null) ?? (status === 'failed' ? storeError : null);

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
    (running && job ? job.topCombos : result?.combos ?? []).forEach((c) =>
      Object.keys(c.params).forEach((k) => set.add(k)),
    );
    return [...set];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, job, running]);

  const run = async () => {
    setStartError(null);
    setJob(null);
    try {
      const snap = await api.bots.autotuneStart(bot.id, {
        from: period.from ?? undefined,
        to: period.to ?? undefined,
        maxCombos,
        initialBalance,
        threads,
        searchType,
      });
      handleSnapshot(snap);
      if (snap.status === 'running' || snap.status === 'queued') {
        sessionStorage.setItem(jobStorageKey, snap.jobId);
        unsubRef.current = subscribeAutotuneProgress(snap.jobId, handleSnapshot);
      }
    } catch (e) {
      setStartError((e as Error).message);
    }
  };

  /** «Уточнить ещё»: доп. раунды сужения вокруг лучших результатов завершённого
   * прогона (без повторов); бюджет — текущее значение «Лимит прогонов». */
  const refineMore = async () => {
    if (!job || job.status !== 'done') return;
    setStartError(null);
    try {
      const snap = await api.compute.refineMore(job.jobId, { maxCombos });
      handleSnapshot(snap);
      if (snap.status === 'running' || snap.status === 'queued') {
        sessionStorage.setItem(jobStorageKey, snap.jobId);
        unsubRef.current?.();
        unsubRef.current = subscribeAutotuneProgress(snap.jobId, handleSnapshot);
      }
    } catch (e) {
      setStartError((e as Error).message);
    }
  };

  // Apply a combo (the best one or a clicked row): either mutate the shared
  // strategy or clone it for this bot only — other bots may share the strategy.
  const applyToCurrent = async (combo: AutotuneCombo | null) => {
    if (!combo || !strategy) return;
    const { buy, sell } = applyComboToStrategy(strategy, combo.params);
    await dispatch(updateStrategyConfig({ id: strategy.id, patch: { buy, sell } }));
    setApplyDialog(false);
    setRowCombo(null);
    setAppliedMsg('Коэффициенты применены к текущей стратегии');
  };

  const applyAsDuplicate = async (combo: AutotuneCombo | null) => {
    if (!combo || !strategy) return;
    const { buy, sell } = applyComboToStrategy(strategy, combo.params);
    const created = await dispatch(
      createStrategyConfig({ name: `${strategy.name} — автоподбор (${bot.name})`, buy, sell }),
    ).unwrap();
    await dispatch(updateBot({ id: bot.id, patch: { strategyConfigId: created.id } }));
    setApplyDialog(false);
    setRowCombo(null);
    setAppliedMsg(`Создан дубликат «${created.name}» и привязан к боту`);
  };

  // ── Диалог строки прогона: настройки + бэктест + применение ───────────────
  const [rowCombo, setRowCombo] = useState<{ combo: AutotuneCombo; rank: number } | null>(null);
  const [rowBt, setRowBt] = useState<{ loading: boolean; stats: BacktestStats | null; error: string | null }>({
    loading: false,
    stats: null,
    error: null,
  });
  const openRow = (combo: AutotuneCombo, rank: number) => {
    setRowCombo({ combo, rank });
    setRowBt({ loading: false, stats: null, error: null });
  };
  const runRowBacktest = async () => {
    if (!rowCombo) return;
    setRowBt({ loading: true, stats: null, error: null });
    try {
      const bt = await api.backtest.run({
        strategyConfigId: bot.strategyConfigId,
        marketConfigId: bot.marketConfigId,
        from: period.from ?? undefined,
        to: period.to ?? undefined,
        initialBalance,
        botId: bot.id,
        params: rowCombo.combo.params,
      });
      setRowBt({ loading: false, stats: bt.stats, error: null });
    } catch (e) {
      setRowBt({ loading: false, stats: null, error: (e as Error).message });
    }
  };

  const best = result?.best;
  // Пока перебор идёт — таблица живёт от снапшотов вебсокета (top-500).
  const liveRows = running && job ? job.topCombos : result?.combos ?? [];

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
            <TextField
              label="Потоков" size="small" type="number" value={threads}
              onChange={(e) => setThreads(Math.max(1, Math.min(64, Math.round(Number(e.target.value) || 1))))}
              inputProps={{ min: 1, max: 64, 'data-testid': 'at-threads' }}
              sx={{ width: 110 }}
            />
            <SearchTypeSelect value={searchType} onChange={setSearchType} dataTestId="at-search-type" />
            <Button
              variant="outlined"
              startIcon={estimating ? <CircularProgress size={16} color="inherit" /> : <TimerOutlinedIcon />}
              onClick={runEstimate}
              disabled={estimating || running || dims.length === 0}
              data-testid="estimate-autotune"
            >
              Оценить
            </Button>
            <Button
              variant="contained"
              startIcon={running ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={run}
              disabled={running || dims.length === 0}
              data-testid="run-autotune"
            >
              Запустить подбор
            </Button>
          </Stack>

          {/* Оценка: 1 замеренный бэктест × число прогонов / потоки. */}
          {estimateError && (
            <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setEstimateError(null)}>{estimateError}</Alert>
          )}
          {estimate && (
            <Alert severity="info" icon={<TimerOutlinedIcon />} sx={{ mt: 1.5 }} data-testid="at-estimate">
              Будет выполнено <b>{estimate.combosToRun.toLocaleString('ru-RU')}</b> прогонов
              {estimate.searchType === 'refine' && estimate.rounds
                ? ` уточняющим перебором (${estimate.rounds} раунда по ~${(estimate.roundSize ?? 0).toLocaleString('ru-RU')})`
                : ''}
              {estimate.gridTotal > estimate.combosToRun
                ? ` (сетка ${estimate.gridTotal.toLocaleString('ru-RU')} комбинаций)`
                : ''}{' '}
              — примерно <b>{fmtDuration(estimate.estimatedMs)}</b>: один бэктест ({estimate.steps.toLocaleString('ru-RU')} шагов)
              занял {fmtDuration(estimate.singleRunMs)}, потоков — {estimate.threads}.
              {' '}Сама оценка заняла {fmtDuration(estimate.tookMs)}.
            </Alert>
          )}

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

      {error && (
        <Alert severity="error" data-testid="at-error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Live-прогресс фонового перебора (снапшоты по вебсокету раз в секунду). */}
      {running && job && (
        <Card sx={{ mb: 2 }} variant="outlined" data-testid="at-progress">
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
              {job.status === 'running' && <CircularProgress size={18} />}
              <Typography variant="subtitle2">
                {job.status === 'queued' && `В очереди${job.queuePosition ? ` (#${job.queuePosition})` : ''} · `}
                {job.status === 'paused' && 'На паузе · '}
                Выполнено {job.done.toLocaleString('ru-RU')} из {job.total.toLocaleString('ru-RU')} прогонов
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`потоки: ${job.threadsActive}/${job.threadsRequested}`}
                data-testid="at-progress-threads"
              />
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="caption" color="text.secondary" data-testid="at-progress-time">
                прошло {fmtDuration(job.elapsedMs)}
                {job.done > 0 && job.done < job.total && job.status === 'running'
                  ? ` · осталось ~${fmtDuration((job.elapsedMs / job.done) * (job.total - job.done))}`
                  : ''}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={job.total > 0 ? Math.min(100, (job.done / job.total) * 100) : 0}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Управлять расчётом (пауза/очередь) можно в меню «Расчёты».
            </Typography>
          </CardContent>
        </Card>
      )}

      <Box sx={{ mb: 2 }}>
        <PeriodHistoryChart botId={bot.id} period={period} idPrefix="at" />
      </Box>

      {result && best && !running && (
        <Stack spacing={2} sx={{ mb: 2 }} data-testid="at-result">
          <Card sx={{ borderColor: 'success.main' }} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle1">Лучшая комбинация</Typography>
                <Stack direction="row" spacing={1}>
                  {job?.status === 'done' && job.topCombos.length > 0 && (
                    <Tooltip title={`Продолжить сужение вокруг лучших результатов: ещё ~${maxCombos.toLocaleString('ru-RU')} прогонов двумя раундами, без повторов`}>
                      <Button variant="outlined" color="success" startIcon={<TimerOutlinedIcon />} onClick={refineMore} data-testid="at-refine-more">
                        Уточнить ещё
                      </Button>
                    </Tooltip>
                  )}
                  <Button variant="contained" color="success" startIcon={<AutoFixHighIcon />} onClick={() => setApplyDialog(true)} data-testid="apply-best">
                    Применить к стратегии
                  </Button>
                </Stack>
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
        </Stack>
      )}

      {/* Таблица лучших прогонов: во время перебора живёт от снапшотов сокета
          (top-500), после — от финального результата. Клик по строке — детали. */}
      {liveRows.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {running ? 'Лучшие прогоны (обновляется каждую секунду)' : `Топ ${liveRows.length.toLocaleString('ru-RU')} комбинаций (по PnL)`}
              {' '}— клик по строке открывает действия
            </Typography>
            <Box sx={{ maxHeight: 360, overflow: 'auto' }} data-testid="at-grid">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    {columns.map((c) => (<TableCell key={c}>{tuneKeyLabel(c)}</TableCell>))}
                    <TableCell align="right">PnL</TableCell>
                    <TableCell align="right">PnL %</TableCell>
                    <TableCell align="right">Winrate</TableCell>
                    <TableCell align="right">Сделок</TableCell>
                    <TableCell align="right">Просадка</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {liveRows.map((combo, i) => (
                    <TableRow
                      key={combo.id}
                      selected={i === 0}
                      hover
                      onClick={() => openRow(combo, i + 1)}
                      sx={{ cursor: 'pointer' }}
                      data-testid={`at-row-${i}`}
                    >
                      <TableCell>{i + 1}</TableCell>
                      {columns.map((c) => (<TableCell key={c}>{combo.params[c] ?? '—'}</TableCell>))}
                      <TableCell align="right"><PnlValue value={combo.stats.pnl} /></TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {combo.stats.pnlPct > 0 ? '+' : ''}{combo.stats.pnlPct}%
                      </TableCell>
                      <TableCell align="right">{combo.stats.winRate}%</TableCell>
                      <TableCell align="right">{combo.stats.trades}</TableCell>
                      <TableCell align="right">{combo.stats.maxDrawdownPct}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Детали прогона: настройки + бэктест + применение к боту. */}
      <Dialog open={!!rowCombo} onClose={() => setRowCombo(null)} maxWidth="sm" fullWidth data-testid="combo-dialog">
        <DialogTitle>Прогон #{rowCombo?.rank}</DialogTitle>
        <DialogContent>
          {rowCombo && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(rowCombo.combo.params).map(([k, v]) => (
                  <Chip key={k} size="small" variant="outlined" label={`${tuneKeyLabel(k)}: ${v}`} />
                ))}
                {Object.keys(rowCombo.combo.params).length === 0 && (
                  <Typography variant="body2" color="text.secondary">Без изменённых коэффициентов</Typography>
                )}
              </Stack>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
                <StatCard label="PnL прогона" value={<PnlValue value={rowCombo.combo.stats.pnl} pct={rowCombo.combo.stats.pnlPct} />} />
                <StatCard label="Winrate" value={`${rowCombo.combo.stats.winRate}%`} />
                <StatCard label="Сделок" value={rowCombo.combo.stats.trades} />
                <StatCard label="Просадка" value={`${rowCombo.combo.stats.maxDrawdownPct}%`} />
              </Stack>
              {rowBt.error && <Alert severity="error">{rowBt.error}</Alert>}
              {rowBt.stats && (
                <Alert severity="success" data-testid="combo-bt-result">
                  Бэктест: PnL {rowBt.stats.pnl >= 0 ? '+' : ''}{rowBt.stats.pnl.toFixed(4)} ({rowBt.stats.pnlPct}%) ·
                  winrate {rowBt.stats.winRate}% · сделок {rowBt.stats.trades} · итог {rowBt.stats.finalBalance.toFixed(4)} {bot.quoteAsset}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setRowCombo(null)}>Закрыть</Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            startIcon={rowBt.loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
            onClick={runRowBacktest}
            disabled={rowBt.loading}
            data-testid="combo-backtest"
          >
            Запустить бэктест
          </Button>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={() => applyAsDuplicate(rowCombo?.combo ?? null)}
            data-testid="combo-duplicate"
          >
            Создать конфиг
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<AutoFixHighIcon />}
            onClick={() => applyToCurrent(rowCombo?.combo ?? null)}
            data-testid="combo-apply"
          >
            Применить к боту
          </Button>
        </DialogActions>
      </Dialog>

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
          <Button onClick={() => applyToCurrent(best ?? null)} color="warning" data-testid="apply-current">
            Изменить текущую
          </Button>
          <Button onClick={() => applyAsDuplicate(best ?? null)} variant="contained" startIcon={<ContentCopyIcon />} data-testid="apply-duplicate">
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
