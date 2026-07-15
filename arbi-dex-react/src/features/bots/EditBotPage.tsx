import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, CircularProgress, MenuItem, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { PageHeader } from '../../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBot, updateBot } from '../../store/botsSlice';
import { fetchMarketConfigs } from '../../store/marketConfigsSlice';
import { fetchStrategyConfigs } from '../../store/strategyConfigsSlice';
import { fetchMarkets } from '../../store/catalogSlice';
import { findMarket } from '../marketConfigs/marketLabel';
import type { TradingMode } from '../../domain/types';

export function EditBotPage() {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const bot = useAppSelector((s) => s.bots.items.find((b) => b.id === id) ?? s.bots.current);
  const markets = useAppSelector((s) => s.catalog.markets);
  const marketConfigs = useAppSelector((s) => s.marketConfigs.items);
  const strategyConfigs = useAppSelector((s) => s.strategyConfigs.items);

  const [name, setName] = useState('');
  const [mode, setMode] = useState<TradingMode>('demo-live');
  const [initialBalance, setInitialBalance] = useState(1000);
  const [marketConfigId, setMarketConfigId] = useState('');
  const [strategyConfigId, setStrategyConfigId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchBot(id));
    dispatch(fetchMarketConfigs());
    dispatch(fetchStrategyConfigs());
    dispatch(fetchMarkets());
  }, [dispatch, id]);

  // Hydrate the form once the bot is loaded.
  useEffect(() => {
    if (bot) {
      setName(bot.name);
      setMode(bot.mode);
      setInitialBalance(bot.initialBalance);
      setMarketConfigId(bot.marketConfigId);
      setStrategyConfigId(bot.strategyConfigId);
    }
  }, [bot]);

  if (!bot) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const canSave = name.trim().length > 0 && !!marketConfigId && !!strategyConfigId && initialBalance > 0;

  const save = async () => {
    setSaving(true);
    try {
      // When the market config changes, re-derive the traded pair from its trading market.
      const mc = marketConfigs.find((m) => m.id === marketConfigId);
      const trading = mc ? findMarket(markets, mc.tradingMarketId) : undefined;
      const pair = marketConfigId !== bot.marketConfigId && trading
        ? { baseAsset: trading.base, quoteAsset: trading.quote }
        : {};
      await dispatch(updateBot({
        id: bot.id,
        patch: { name: name.trim(), mode, initialBalance, marketConfigId, strategyConfigId, ...pair },
      })).unwrap();
      navigate(`/bots/${bot.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate(`/bots/${bot.id}`)} sx={{ mb: 1 }}>
        К боту
      </Button>
      <PageHeader
        title={`Изменить бота: ${bot.name}`}
        subtitle="Название, режим, счёт, конфигурация рынков и стратегия"
        actions={
          <Button variant="contained" startIcon={<SaveIcon />} disabled={!canSave || saving} onClick={save} data-testid="save-bot">
            Сохранить
          </Button>
        }
      />
      <Card sx={{ maxWidth: 560 }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Название бота"
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ 'data-testid': 'edit-bot-name' }}
            />
            <Box>
              <Typography variant="caption" color="text.secondary">Режим</Typography>
              <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} sx={{ display: 'block', mt: 0.5 }}>
                <ToggleButton value="demo-live" data-testid="edit-mode-demo">Демо</ToggleButton>
                <ToggleButton value="real-live" data-testid="edit-mode-real">Реальный</ToggleButton>
                <ToggleButton value="idle" data-testid="edit-mode-idle">Выкл</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <TextField
              label="Начальный баланс"
              size="small"
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(Number(e.target.value))}
              inputProps={{ 'data-testid': 'edit-bot-initial-balance' }}
            />
            <TextField
              select
              label="Конфигурация рынков"
              size="small"
              value={marketConfigs.some((m) => m.id === marketConfigId) ? marketConfigId : ''}
              onChange={(e) => setMarketConfigId(e.target.value)}
              inputProps={{ 'data-testid': 'edit-bot-market-config' }}
            >
              {marketConfigs.map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Стратегия"
              size="small"
              value={strategyConfigs.some((s) => s.id === strategyConfigId) ? strategyConfigId : ''}
              onChange={(e) => setStrategyConfigId(e.target.value)}
              inputProps={{ 'data-testid': 'edit-bot-strategy' }}
            >
              {strategyConfigs.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
