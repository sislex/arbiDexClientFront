import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { PageHeader } from '../../components/PageHeader';
import { PnlValue } from '../../components/PnlValue';
import { fmtDuration } from '../../components/format';
import { api } from '../../api';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBots, updateBot } from '../../store/botsSlice';
import { createStrategyConfig, fetchStrategyConfigs, updateStrategyConfig } from '../../store/strategyConfigsSlice';
import { tuneKeyLabel, applyComboToStrategy } from '../bots/autotuneLabels';
import type { AutotuneCombo, AutotuneJob, ComputeConfig, ComputeJobStatus } from '../../domain/types';

const STATUS_LABEL: Record<ComputeJobStatus, { label: string; color: 'success' | 'info' | 'warning' | 'default' | 'error' }> = {
  running: { label: 'идёт', color: 'success' },
  queued: { label: 'в очереди', color: 'info' },
  paused: { label: 'пауза', color: 'warning' },
  done: { label: 'завершён', color: 'default' },
  error: { label: 'ошибка', color: 'error' },
};

/**
 * Меню расчётов: все фоновые задачи (идущие / очередь / пауза / завершённые),
 * пул потоков сервера, пауза/резюме, и детали каждого расчёта с применением
 * результата к стратегии.
 */
export function ComputationsPage() {
  const dispatch = useAppDispatch();
  const bots = useAppSelector((s) => s.bots.items);
  const strategies = useAppSelector((s) => s.strategyConfigs.items);

  const [jobs, setJobs] = useState<AutotuneJob[]>([]);
  const [config, setConfig] = useState<ComputeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchBots());
    dispatch(fetchStrategyConfigs());
  }, [dispatch]);

  // Поллинг раз в секунду: живые счётчики выполненного и очередь.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [js, cfg] = await Promise.all([api.compute.jobs(), api.compute.config()]);
        if (alive) {
          setJobs(js);
          setConfig(cfg);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void load();
    const t = window.setInterval(load, 1000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      setJobs(await api.compute.jobs());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ── Детали расчёта ──────────────────────────────────────────────────────────
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const openJob = useMemo(() => jobs.find((j) => j.jobId === openJobId) ?? null, [jobs, openJobId]);
  const openBot = useMemo(() => bots.find((b) => b.id === openJob?.botId) ?? null, [bots, openJob]);
  const openStrategy = useMemo(
    () => strategies.find((s) => s.id === openBot?.strategyConfigId) ?? null,
    [strategies, openBot],
  );

  const applyToStrategy = async (combo: AutotuneCombo) => {
    if (!openStrategy) return setError('Стратегия бота не найдена');
    const { buy, sell } = applyComboToStrategy(openStrategy, combo.params);
    await dispatch(updateStrategyConfig({ id: openStrategy.id, patch: { buy, sell } }));
    setMsg('Коэффициенты применены к текущей стратегии');
  };

  const createNewStrategy = async (combo: AutotuneCombo) => {
    if (!openStrategy || !openBot) return setError('Стратегия бота не найдена');
    const { buy, sell } = applyComboToStrategy(openStrategy, combo.params);
    const created = await dispatch(
      createStrategyConfig({ name: `${openStrategy.name} — расчёт (${openBot.name})`, buy, sell }),
    ).unwrap();
    await dispatch(updateBot({ id: openBot.id, patch: { strategyConfigId: created.id } }));
    setMsg(`Создана стратегия «${created.name}» и привязана к боту`);
  };

  const botName = (botId: string): string => bots.find((b) => b.id === botId)?.name ?? botId.slice(0, 8);

  return (
    <Box>
      <PageHeader
        title="Расчёты"
        subtitle="Все фоновые расчёты: сколько идёт, очередь, потоки. Пауза отправляет расчёт в конец очереди; освободившийся поток сразу забирает следующий расчёт."
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {config && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }} data-testid="compute-config">
          <Chip label={`Потоков сервера: ${config.totalThreads}`} variant="outlined" />
          <Chip label={`Занято: ${config.activeThreads}`} color={config.activeThreads > 0 ? 'success' : 'default'} variant="outlined" />
          <Chip label={`В очереди: ${config.queuedJobs}`} color={config.queuedJobs > 0 ? 'info' : 'default'} variant="outlined" />
        </Stack>
      )}

      <Card>
        <CardContent>
          {jobs.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Расчётов нет — запустите авто-подбор на вкладке бота.
            </Typography>
          ) : (
            <Table size="small" data-testid="compute-jobs">
              <TableHead>
                <TableRow>
                  <TableCell>Расчёт</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell sx={{ minWidth: 220 }}>Прогресс</TableCell>
                  <TableCell align="center">Потоки</TableCell>
                  <TableCell align="right">Время</TableCell>
                  <TableCell width={90} />
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((j) => {
                  const st = STATUS_LABEL[j.status];
                  const pct = j.total > 0 ? Math.min(100, (j.done / j.total) * 100) : 0;
                  return (
                    <TableRow key={j.jobId} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenJobId(j.jobId)} data-testid={`compute-job-${j.jobId}`}>
                      <TableCell>
                        <Typography variant="body2">{j.label || botName(j.botId)}</Typography>
                        <Typography variant="caption" color="text.secondary">{botName(j.botId)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={st.color} variant="outlined" label={
                          j.status === 'queued' && j.queuePosition ? `${st.label} #${j.queuePosition}` : st.label
                        } />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {j.done.toLocaleString('ru-RU')} / {j.total.toLocaleString('ru-RU')}
                            {j.status === 'running' && j.done > 0 && j.done < j.total
                              ? ` · осталось ~${fmtDuration((j.elapsedMs / j.done) * (j.total - j.done))}`
                              : ''}
                          </Typography>
                          <LinearProgress variant="determinate" value={pct} />
                        </Stack>
                      </TableCell>
                      <TableCell align="center" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {j.threadsActive}/{j.threadsRequested}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtDuration(j.elapsedMs)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {(j.status === 'running' || j.status === 'queued') && (
                          <Tooltip title="Пауза (расчёт уйдёт в конец очереди)">
                            <IconButton size="small" onClick={() => act(() => api.compute.pause(j.jobId))} data-testid={`pause-${j.jobId}`}>
                              <PauseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {j.status === 'paused' && (
                          <Tooltip title="Продолжить (вернётся в очередь)">
                            <IconButton size="small" color="primary" onClick={() => act(() => api.compute.resume(j.jobId))} data-testid={`resume-${j.jobId}`}>
                              <PlayArrowIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Детали расчёта: живой топ результатов + применение к стратегии. */}
      <Dialog open={!!openJob} onClose={() => setOpenJobId(null)} maxWidth="md" fullWidth data-testid="compute-job-dialog">
        <DialogTitle>
          {openJob?.label} · {openJob ? STATUS_LABEL[openJob.status].label : ''}
        </DialogTitle>
        <DialogContent>
          {openJob && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {openJob.status === 'running' && <CircularProgress size={16} />}
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {openJob.done.toLocaleString('ru-RU')} / {openJob.total.toLocaleString('ru-RU')} прогонов
                </Typography>
                <Chip size="small" variant="outlined" label={`потоки ${openJob.threadsActive}/${openJob.threadsRequested}`} />
                <Chip size="small" variant="outlined" label={`время ${fmtDuration(openJob.elapsedMs)}`} />
              </Stack>
              <LinearProgress variant="determinate" value={openJob.total ? (openJob.done / openJob.total) * 100 : 0} />
              {!openStrategy && (
                <Alert severity="info">Применение к стратегии недоступно: стратегия бота не найдена (возможно, изменена).</Alert>
              )}
              <Box sx={{ maxHeight: 380, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Параметры</TableCell>
                      <TableCell align="right">PnL</TableCell>
                      <TableCell align="right">PnL %</TableCell>
                      <TableCell align="right">Winrate</TableCell>
                      <TableCell align="right">Сделок</TableCell>
                      <TableCell align="right">Просадка</TableCell>
                      <TableCell width={110} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {openJob.topCombos.slice(0, 100).map((c, i) => (
                      <TableRow key={c.id} hover selected={i === 0}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {Object.entries(c.params).map(([k, v]) => (
                              <Chip key={k} size="small" variant="outlined" label={`${tuneKeyLabel(k)}: ${v}`} />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell align="right"><PnlValue value={c.stats.pnl} /></TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {c.stats.pnlPct > 0 ? '+' : ''}{c.stats.pnlPct}%
                        </TableCell>
                        <TableCell align="right">{c.stats.winRate}%</TableCell>
                        <TableCell align="right">{c.stats.trades}</TableCell>
                        <TableCell align="right">{c.stats.maxDrawdownPct}%</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Применить коэффициенты к текущей стратегии">
                              <span>
                                <IconButton size="small" disabled={!openStrategy} onClick={() => applyToStrategy(c)}>
                                  <AutoFixHighIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Создать новую стратегию на основе этого прогона">
                              <span>
                                <IconButton size="small" disabled={!openStrategy} onClick={() => createNewStrategy(c)}>
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {openJob && (openJob.status === 'running' || openJob.status === 'queued') && (
            <Button startIcon={<PauseIcon />} onClick={() => act(() => api.compute.pause(openJob.jobId))}>Пауза</Button>
          )}
          {openJob?.status === 'paused' && (
            <Button startIcon={<PlayArrowIcon />} onClick={() => act(() => api.compute.resume(openJob.jobId))}>Продолжить</Button>
          )}
          <Button onClick={() => setOpenJobId(null)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg(null)} message={msg ?? ''} />
    </Box>
  );
}
