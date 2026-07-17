import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { PageHeader } from '../../components/PageHeader';
import { PnlValue } from '../../components/PnlValue';
import { fmtDuration, fmtTime } from '../../components/format';
import { api } from '../../api';
import { subscribeAutotuneProgress } from '../../api/liveSocket';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBots, updateBot } from '../../store/botsSlice';
import { fetchMarketConfigs } from '../../store/marketConfigsSlice';
import { fetchStrategyConfigs, createStrategyConfig, updateStrategyConfig } from '../../store/strategyConfigsSlice';
import { fetchMarkets } from '../../store/catalogSlice';
import { findMarket, marketLabel } from '../marketConfigs/marketLabel';
import { tuneKeyLabel, applyComboToStrategy } from '../bots/autotuneLabels';
import { usePeriod } from '../bots/usePeriod';
import { PeriodPicker } from '../bots/PeriodPicker';
import { PeriodHistoryChart } from '../bots/PeriodHistoryChart';
import { SearchTypeSelect } from '../bots/SearchTypeSelect';
import type { AutotuneCombo, AutotuneJob, SearchType } from '../../domain/types';

const STATUS_LABEL: Record<AutotuneJob['status'], string> = {
  running: 'идёт',
  queued: 'в очереди',
  paused: 'на паузе',
  done: 'завершён',
  error: 'ошибка',
};

/**
 * Страница одного расчёта — в стиле вкладки авто-подбора: график котировок
 * периода расчёта, рынок и временные пределы, live-прогресс, топ результатов.
 * Параметры можно изменить — «Сохранить и перезапустить» отменяет текущий
 * расчёт и начинает его заново с новыми параметрами.
 */
export function ComputationJobPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const bots = useAppSelector((s) => s.bots.items);
  const marketConfigs = useAppSelector((s) => s.marketConfigs.items);
  const markets = useAppSelector((s) => s.catalog.markets);
  const strategies = useAppSelector((s) => s.strategyConfigs.items);

  const [job, setJob] = useState<AutotuneJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    dispatch(fetchBots());
    dispatch(fetchMarketConfigs());
    dispatch(fetchStrategyConfigs());
    dispatch(fetchMarkets());
  }, [dispatch]);

  const bot = useMemo(() => bots.find((b) => b.id === job?.botId) ?? null, [bots, job?.botId]);
  const marketConfig = useMemo(
    () => marketConfigs.find((m) => m.id === bot?.marketConfigId) ?? null,
    [marketConfigs, bot?.marketConfigId],
  );
  const tradingMarket = marketConfig ? findMarket(markets, marketConfig.tradingMarketId) : undefined;
  const strategy = useMemo(
    () => strategies.find((s) => s.id === bot?.strategyConfigId) ?? null,
    [strategies, bot?.strategyConfigId],
  );

  // Живой снапшот: REST + вебсокет для незавершённых.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    unsubRef.current?.();
    unsubRef.current = null;
    setJob(null);
    (async () => {
      try {
        const jobs = await api.compute.jobs();
        const snap = jobs.find((j) => j.jobId === jobId);
        if (!snap) throw new Error('Расчёт не найден (возможно, удалён или истёк срок хранения)');
        if (cancelled) return;
        setJob(snap);
        if (snap.status !== 'done' && snap.status !== 'error') {
          unsubRef.current = subscribeAutotuneProgress(snap.jobId, (s) => setJob(s));
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [jobId]);

  // Параметры расчёта (редактируемые): период — через usePeriod бота.
  const period = usePeriod(bot?.id);
  const [maxCombos, setMaxCombos] = useState(1000);
  const [threads, setThreads] = useState(6);
  const [initialBalance, setInitialBalance] = useState<number | undefined>(undefined);
  const [searchType, setSearchType] = useState<SearchType>('grid');
  const paramsSeeded = useRef(false);
  useEffect(() => {
    if (!job || paramsSeeded.current) return;
    paramsSeeded.current = true;
    setMaxCombos(job.params.maxCombos);
    setThreads(job.params.threads ?? 6);
    setInitialBalance(job.params.initialBalance);
    setSearchType(job.params.searchType);
  }, [job]);
  // Период сеется из параметров расчёта, когда границы истории загрузились.
  const periodSeeded = useRef(false);
  useEffect(() => {
    if (!job || !period.range || periodSeeded.current) return;
    periodSeeded.current = true;
    period.setFrom(job.params.from);
    period.setTo(job.params.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, period.range]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** «Сохранить и перезапустить»: отменяет текущий расчёт и стартует заново. */
  const restart = async () => {
    if (!job || !bot) return;
    setError(null);
    try {
      await api.compute.remove(job.jobId).catch(() => {});
      const snap = await api.bots.autotuneStart(bot.id, {
        from: period.from ?? undefined,
        to: period.to ?? undefined,
        maxCombos,
        threads,
        initialBalance,
        searchType,
      });
      setMsg('Расчёт перезапущен с новыми параметрами');
      navigate(`/computations/${snap.jobId}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeJob = async () => {
    if (!job) return;
    await act(async () => {
      await api.compute.remove(job.jobId);
      navigate('/computations');
    });
  };

  const applyToStrategy = async (combo: AutotuneCombo) => {
    if (!strategy) return setError('Стратегия бота не найдена');
    const { buy, sell } = applyComboToStrategy(strategy, combo.params);
    await dispatch(updateStrategyConfig({ id: strategy.id, patch: { buy, sell } }));
    setMsg('Коэффициенты применены к текущей стратегии');
  };

  const createNewStrategy = async (combo: AutotuneCombo) => {
    if (!strategy || !bot) return setError('Стратегия бота не найдена');
    const { buy, sell } = applyComboToStrategy(strategy, combo.params);
    const created = await dispatch(
      createStrategyConfig({ name: `${strategy.name} — расчёт (${bot.name})`, buy, sell }),
    ).unwrap();
    await dispatch(updateBot({ id: bot.id, patch: { strategyConfigId: created.id } }));
    setMsg(`Создана стратегия «${created.name}» и привязана к боту`);
  };

  const columns = useMemo(() => {
    const set = new Set<string>();
    job?.topCombos.forEach((c) => Object.keys(c.params).forEach((k) => set.add(k)));
    return [...set];
  }, [job?.topCombos]);

  if (!job) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/computations')} sx={{ mb: 1 }}>
          К расчётам
        </Button>
        {error ? <Alert severity="error">{error}</Alert> : <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>}
      </Box>
    );
  }

  const active = job.status === 'running' || job.status === 'queued' || job.status === 'paused';
  const unitMs = (job.params.to ?? 0) > 1e12;
  const toSec = (t: number): number => (unitMs ? Math.round(t / 1000) : t);

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/computations')} sx={{ mb: 1 }} data-testid="back-to-computations">
        К расчётам
      </Button>
      <PageHeader
        title={job.label}
        subtitle={`Статус: ${STATUS_LABEL[job.status]}${job.queuePosition ? ` (#${job.queuePosition} в очереди)` : ''} · ${
          job.searchType === 'refine' ? 'уточняющий перебор' : 'обычный перебор'
        }`}
        actions={
          <Stack direction="row" spacing={1}>
            {(job.status === 'running' || job.status === 'queued') && (
              <Button startIcon={<PauseIcon />} onClick={() => act(() => api.compute.pause(job.jobId))} data-testid="job-pause">
                Пауза
              </Button>
            )}
            {job.status === 'paused' && (
              <Button startIcon={<PlayArrowIcon />} onClick={() => act(() => api.compute.resume(job.jobId))} data-testid="job-resume">
                Продолжить
              </Button>
            )}
            <Tooltip title="Удалить расчёт">
              <IconButton color="error" onClick={removeJob} data-testid="job-delete">
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Параметры расчёта: рынок, пределы, лимиты. Сохранение = перезапуск. */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Chip size="small" variant="outlined" label={`Бот: ${bot?.name ?? job.botId.slice(0, 8)}`} data-testid="job-bot" />
            <Chip
              size="small"
              variant="outlined"
              label={`Рынок: ${tradingMarket ? marketLabel(tradingMarket) : marketConfig?.name ?? '—'}`}
              data-testid="job-market"
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Период: ${fmtTime(toSec(job.params.from))} — ${fmtTime(toSec(job.params.to))}`}
              data-testid="job-period"
            />
            <Chip size="small" variant="outlined" label={`Прогонов: ${job.total.toLocaleString('ru-RU')} из сетки ${job.gridTotal.toLocaleString('ru-RU')}`} />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
            <PeriodPicker period={period} idPrefix="cj" />
            <TextField
              label="Лимит прогонов" size="small" type="number" value={maxCombos}
              onChange={(e) => setMaxCombos(Math.max(1, Math.round(Number(e.target.value) || 0)))}
              inputProps={{ min: 1, step: 100, 'data-testid': 'cj-max-combos' }}
              sx={{ width: 150 }}
            />
            <TextField
              label="Потоков" size="small" type="number" value={threads}
              onChange={(e) => setThreads(Math.max(1, Math.min(64, Math.round(Number(e.target.value) || 1))))}
              inputProps={{ min: 1, max: 64, 'data-testid': 'cj-threads' }}
              sx={{ width: 110 }}
            />
            <SearchTypeSelect value={searchType} onChange={setSearchType} dataTestId="cj-search-type" />
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              startIcon={<RestartAltIcon />}
              onClick={restart}
              disabled={!bot}
              data-testid="job-restart"
            >
              Сохранить и перезапустить
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Прогресс */}
      {active && (
        <Card sx={{ mb: 2 }} variant="outlined" data-testid="job-progress">
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
              {job.status === 'running' && <CircularProgress size={18} />}
              <Typography variant="subtitle2">
                Выполнено {job.done.toLocaleString('ru-RU')} из {job.total.toLocaleString('ru-RU')} прогонов
              </Typography>
              <Chip size="small" variant="outlined" label={`потоки: ${job.threadsActive}/${job.threadsRequested}`} />
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="caption" color="text.secondary">
                прошло {fmtDuration(job.elapsedMs)}
                {job.done > 0 && job.done < job.total && job.status === 'running'
                  ? ` · осталось ~${fmtDuration((job.elapsedMs / job.done) * (job.total - job.done))}`
                  : ''}
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={job.total > 0 ? Math.min(100, (job.done / job.total) * 100) : 0} />
          </CardContent>
        </Card>
      )}

      {/* График котировок периода расчёта — как на вкладке авто-подбора. */}
      {bot && (
        <Box sx={{ mb: 2 }}>
          <PeriodHistoryChart botId={bot.id} period={period} idPrefix="cj" />
        </Box>
      )}

      {/* Топ результатов */}
      {job.topCombos.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {active ? 'Лучшие прогоны (обновляется каждую секунду)' : `Топ ${job.topCombos.length.toLocaleString('ru-RU')} комбинаций (по PnL)`}
            </Typography>
            <Box sx={{ maxHeight: 420, overflow: 'auto' }} data-testid="job-grid">
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
                    <TableCell width={100} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {job.topCombos.map((combo, i) => (
                    <TableRow key={combo.id} selected={i === 0} hover>
                      <TableCell>{i + 1}</TableCell>
                      {columns.map((c) => (<TableCell key={c}>{combo.params[c] ?? '—'}</TableCell>))}
                      <TableCell align="right"><PnlValue value={combo.stats.pnl} /></TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {combo.stats.pnlPct > 0 ? '+' : ''}{combo.stats.pnlPct}%
                      </TableCell>
                      <TableCell align="right">{combo.stats.winRate}%</TableCell>
                      <TableCell align="right">{combo.stats.trades}</TableCell>
                      <TableCell align="right">{combo.stats.maxDrawdownPct}%</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Применить к текущей стратегии">
                            <span>
                              <IconButton size="small" disabled={!strategy} onClick={() => applyToStrategy(combo)}>
                                <AutoFixHighIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Создать новую стратегию на основе прогона">
                            <span>
                              <IconButton size="small" disabled={!strategy} onClick={() => createNewStrategy(combo)}>
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
          </CardContent>
        </Card>
      )}

      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg(null)} message={msg ?? ''} />
    </Box>
  );
}
