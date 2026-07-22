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
import { api } from '../../api';
import type { TradingMode, UserToken } from '../../domain/types';

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
  const [balanceAsset, setBalanceAsset] = useState('');
  const [slippagePct, setSlippagePct] = useState(0.5);
  const [minPositionValue, setMinPositionValue] = useState(0);
  const [tokenMap, setTokenMap] = useState<UserToken[]>([]);
  const [marketConfigId, setMarketConfigId] = useState('');
  const [strategyConfigId, setStrategyConfigId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchBot(id));
    dispatch(fetchMarketConfigs());
    dispatch(fetchStrategyConfigs());
    dispatch(fetchMarkets());
    // Сопоставление токенов — чтобы показать адреса рядом с валютами баланса.
    api.settings
      .tokens()
      .then(setTokenMap)
      .catch(() => {});
  }, [dispatch, id]);

  // Hydrate the form once the bot is loaded.
  useEffect(() => {
    if (bot) {
      setName(bot.name);
      setMode(bot.mode);
      setInitialBalance(bot.initialBalance);
      setBalanceAsset(bot.quoteAsset);
      setSlippagePct(bot.slippagePct ?? 0.5);
      setMinPositionValue(bot.minPositionValue ?? 0);
      setMarketConfigId(bot.marketConfigId);
      setStrategyConfigId(bot.strategyConfigId);
    }
  }, [bot]);

  // Trading market of the selected config → the two currencies the balance can
  // be held in. Symbols come from the pair; addresses — from the token mapping.
  const selectedMc = marketConfigs.find((m) => m.id === marketConfigId);
  const trading = selectedMc ? findMarket(markets, selectedMc.tradingMarketId) : undefined;
  const assetOptions = trading ? [trading.quote, trading.base] : [];
  const effectiveBalanceAsset = assetOptions.includes(balanceAsset)
    ? balanceAsset
    : assetOptions[0] ?? '';
  const tokenFor = (symbol: string): UserToken | undefined =>
    tokenMap.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());

  if (!bot) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const canSave =
    name.trim().length > 0 && !!marketConfigId && !!strategyConfigId && initialBalance > 0 &&
    slippagePct >= 0 && slippagePct <= 50 && minPositionValue >= 0;

  const save = async () => {
    setSaving(true);
    try {
      // The chosen balance currency becomes quoteAsset (what the bot spends
      // buying), the other pair token becomes baseAsset.
      const pair = trading && effectiveBalanceAsset
        ? {
            quoteAsset: effectiveBalanceAsset,
            baseAsset: effectiveBalanceAsset === trading.base ? trading.quote : trading.base,
          }
        : {};
      await dispatch(updateBot({
        id: bot.id,
        patch: { name: name.trim(), mode, initialBalance, slippagePct, minPositionValue, marketConfigId, strategyConfigId, ...pair },
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
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Начальный баланс"
                size="small"
                type="number"
                fullWidth
                value={initialBalance}
                onChange={(e) => setInitialBalance(Number(e.target.value))}
                inputProps={{ 'data-testid': 'edit-bot-initial-balance' }}
              />
              <TextField
                select
                label="Валюта баланса"
                size="small"
                sx={{ minWidth: 200 }}
                value={effectiveBalanceAsset}
                onChange={(e) => setBalanceAsset(e.target.value)}
                disabled={assetOptions.length === 0}
                helperText={
                  tokenFor(effectiveBalanceAsset)
                    ? `${tokenFor(effectiveBalanceAsset)!.address.slice(0, 10)}… из сопоставления токенов`
                    : undefined
                }
                inputProps={{ 'data-testid': 'edit-bot-balance-asset' }}
              >
                {assetOptions.map((sym) => {
                  const mapped = tokenFor(sym);
                  return (
                    <MenuItem key={sym} value={sym}>
                      {mapped ? `${mapped.symbol} (${mapped.address.slice(0, 8)}…)` : sym}
                    </MenuItem>
                  );
                })}
              </TextField>
            </Stack>
            <TextField
              label="Допустимое проскальзывание, %"
              size="small"
              type="number"
              value={slippagePct}
              onChange={(e) => setSlippagePct(Number(e.target.value))}
              helperText="Если к моменту сделки котировка ушла в невыгодную сторону сильнее — транзакция фейлится"
              inputProps={{ 'data-testid': 'edit-bot-slippage', step: 0.1, min: 0, max: 50 }}
            />
            <TextField
              label={`Порог пыли${effectiveBalanceAsset ? `, ${effectiveBalanceAsset}` : ''}`}
              size="small"
              type="number"
              value={minPositionValue}
              onChange={(e) => setMinPositionValue(Number(e.target.value))}
              helperText="При старте сессии позиция дешевле этого порога считается закрытой (0 = выключено)"
              inputProps={{ 'data-testid': 'edit-bot-min-position', step: 0.01, min: 0 }}
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
