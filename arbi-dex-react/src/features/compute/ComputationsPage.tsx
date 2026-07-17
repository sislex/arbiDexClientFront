import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
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
import DeleteIcon from '@mui/icons-material/Delete';
import { PageHeader } from '../../components/PageHeader';
import { fmtDuration } from '../../components/format';
import { api } from '../../api';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBots } from '../../store/botsSlice';
import { fetchStrategyConfigs } from '../../store/strategyConfigsSlice';
import type { AutotuneJob, ComputeConfig, ComputeJobStatus } from '../../domain/types';

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
  const navigate = useNavigate();
  const bots = useAppSelector((s) => s.bots.items);

  const [jobs, setJobs] = useState<AutotuneJob[]>([]);
  const [config, setConfig] = useState<ComputeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

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
                    <TableRow key={j.jobId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/computations/${j.jobId}`)} data-testid={`compute-job-${j.jobId}`}>
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
                        <Tooltip title="Удалить расчёт">
                          <IconButton size="small" onClick={() => act(() => api.compute.remove(j.jobId))} data-testid={`delete-${j.jobId}`}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </Box>
  );
}
