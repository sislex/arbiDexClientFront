import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Card, Stack, Tabs, Tab, Button, ToggleButtonGroup, ToggleButton, CircularProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBot, fetchBots, updateBot } from '../../store/botsSlice';
import { fetchMarketConfigs } from '../../store/marketConfigsSlice';
import { fetchStrategyConfigs } from '../../store/strategyConfigsSlice';
import { fetchMarkets } from '../../store/catalogSlice';
import type { TradingMode } from '../../domain/types';
import { OverviewTab } from './OverviewTab';
import { BacktestTab } from './BacktestTab';
import { LiveTab } from './LiveTab';
import { AutotuneTab } from './AutotuneTab';
import { SessionsTab } from './SessionsTab';

const TABS = ['Обзор', 'Бэктест', 'Реальное время', 'Сессии', 'Авто-подбор'] as const;
/** URL slugs for the tabs (`?tab=backtest`) — shareable and HMR/reload-proof. */
const TAB_KEYS = ['overview', 'backtest', 'live', 'sessions', 'autotune'] as const;

export function BotDetailPage() {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const bot = useAppSelector((s) => s.bots.items.find((b) => b.id === id) ?? s.bots.current);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = Math.max(0, TAB_KEYS.indexOf(searchParams.get('tab') as (typeof TAB_KEYS)[number]));
  const setTab = (i: number) =>
    setSearchParams(i === 0 ? {} : { tab: TAB_KEYS[i] }, { replace: true });

  useEffect(() => {
    if (id) dispatch(fetchBot(id));
    dispatch(fetchBots());
    dispatch(fetchMarketConfigs());
    dispatch(fetchStrategyConfigs());
    dispatch(fetchMarkets());
  }, [dispatch, id]);

  if (!bot) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const setStatus = (status: 'running' | 'paused' | 'stopped') => dispatch(updateBot({ id: bot.id, patch: { status } }));
  const setMode = (mode: TradingMode) => dispatch(updateBot({ id: bot.id, patch: { mode } }));

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/bots')} sx={{ mb: 1 }}>
        К ботам
      </Button>
      <PageHeader
        title={bot.name}
        subtitle={`${bot.baseAsset}/${bot.quoteAsset}`}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <StatusBadge status={bot.status} />
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => navigate(`/bots/${bot.id}/edit`)} data-testid="bot-edit">
              Изменить
            </Button>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={bot.mode}
              onChange={(_, v) => v && setMode(v)}
            >
              <ToggleButton value="demo-live" data-testid="mode-demo">Демо</ToggleButton>
              <ToggleButton value="real-live" data-testid="mode-real" sx={{ '&.Mui-selected': { color: 'error.main' } }}>Реальный</ToggleButton>
            </ToggleButtonGroup>
            {bot.status !== 'running' ? (
              <Button variant="contained" color="success" startIcon={<PlayArrowIcon />} onClick={() => setStatus('running')} data-testid="bot-start">
                Запустить
              </Button>
            ) : (
              <Button variant="outlined" color="warning" startIcon={<PauseIcon />} onClick={() => setStatus('paused')} data-testid="bot-pause">
                Пауза
              </Button>
            )}
            <Button variant="outlined" color="inherit" startIcon={<StopIcon />} onClick={() => setStatus('stopped')} data-testid="bot-stop">
              Стоп
            </Button>
          </Stack>
        }
      />

      <Card sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          {TABS.map((t, i) => (
            <Tab key={t} label={t} data-testid={`tab-${i}`} />
          ))}
        </Tabs>
      </Card>

      {tab === 0 && <OverviewTab bot={bot} />}
      {tab === 1 && <BacktestTab bot={bot} />}
      {tab === 2 && <LiveTab bot={bot} />}
      {tab === 3 && <SessionsTab bot={bot} />}
      {tab === 4 && <AutotuneTab bot={bot} />}
    </Box>
  );
}
