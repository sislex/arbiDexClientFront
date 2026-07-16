import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stepper, Step, StepLabel, Button, Stack, TextField, MenuItem,
  ToggleButtonGroup, ToggleButton, Typography, Divider,
} from '@mui/material';
import { PageHeader } from '../../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../../store';
import { createBot } from '../../store/botsSlice';
import { fetchMarketConfigs } from '../../store/marketConfigsSlice';
import { fetchStrategyConfigs } from '../../store/strategyConfigsSlice';
import { fetchMarkets } from '../../store/catalogSlice';
import { findMarket, marketLabel } from '../marketConfigs/marketLabel';
import type { TradingMode } from '../../domain/types';

const STEPS = ['Основное', 'Конфигурация рынков', 'Стратегия', 'Обзор'];

export function AddBotPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const markets = useAppSelector((s) => s.catalog.markets);
  const marketConfigs = useAppSelector((s) => s.marketConfigs.items);
  const strategyConfigs = useAppSelector((s) => s.strategyConfigs.items);

  const [active, setActive] = useState(0);
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState(1000);
  const [mode, setMode] = useState<TradingMode>('demo-live');
  const [marketConfigId, setMarketConfigId] = useState('');
  const [strategyConfigId, setStrategyConfigId] = useState('');

  useEffect(() => {
    dispatch(fetchMarketConfigs());
    dispatch(fetchStrategyConfigs());
    dispatch(fetchMarkets());
  }, [dispatch]);

  const marketConfig = marketConfigs.find((m) => m.id === marketConfigId);
  const strategy = strategyConfigs.find((s) => s.id === strategyConfigId);
  const trading = marketConfig ? findMarket(markets, marketConfig.tradingMarketId) : undefined;

  const stepValid = [name.trim().length > 0, !!marketConfigId, !!strategyConfigId, true];
  const canNext = stepValid[active];

  const create = async () => {
    const res = await dispatch(
      createBot({
        name: name.trim(),
        status: 'stopped',
        mode,
        marketConfigId,
        strategyConfigId,
        baseAsset: trading?.base ?? 'WETH',
        quoteAsset: trading?.quote ?? 'USDC',
        initialBalance,
        balance: initialBalance,
        pnl: 0,
        pnlPct: 0,
        tradesCount: 0,
        winRate: 0,
        openPosition: false,
      }),
    ).unwrap();
    navigate(`/bots/${res.id}`);
  };

  return (
    <Box>
      <PageHeader title="Добавить бота" subtitle="Свяжите конфигурацию рынков со стратегией" />
      <Card>
        <CardContent>
          <Stepper activeStep={active} sx={{ mb: 3 }}>
            {STEPS.map((s) => (
              <Step key={s}><StepLabel>{s}</StepLabel></Step>
            ))}
          </Stepper>

          {active === 0 && (
            <Stack spacing={2} sx={{ maxWidth: 420 }}>
              <TextField label="Название бота" size="small" value={name} onChange={(e) => setName(e.target.value)} inputProps={{ 'data-testid': 'bot-name' }} />
              <TextField label="Начальный баланс" size="small" type="number" value={initialBalance} onChange={(e) => setInitialBalance(Number(e.target.value))} inputProps={{ 'data-testid': 'bot-initial-balance' }} />
              <Box>
                <Typography variant="caption" color="text.secondary">Режим</Typography>
                <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} sx={{ display: 'block', mt: 0.5 }}>
                  <ToggleButton value="demo-live" data-testid="wizard-mode-demo">Демо</ToggleButton>
                  <ToggleButton value="real-live" data-testid="wizard-mode-real">Реальный</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Stack>
          )}

          {active === 1 && (
            <TextField select label="Конфигурация рынков" size="small" value={marketConfigId} onChange={(e) => setMarketConfigId(e.target.value)} sx={{ minWidth: 360 }} inputProps={{ 'data-testid': 'wizard-market-config' }}>
              {marketConfigs.map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
              ))}
            </TextField>
          )}

          {active === 2 && (
            <TextField select label="Стратегия" size="small" value={strategyConfigId} onChange={(e) => setStrategyConfigId(e.target.value)} sx={{ minWidth: 360 }} inputProps={{ 'data-testid': 'wizard-strategy' }}>
              {strategyConfigs.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
          )}

          {active === 3 && (
            <Stack spacing={1} sx={{ maxWidth: 480 }} data-testid="wizard-review">
              <Row k="Название" v={name} />
              <Row k="Режим" v={mode === 'real-live' ? 'Реальный' : 'Демо'} />
              <Row k="Начальный баланс" v={`${initialBalance} ${trading?.quote ?? ''}`.trim()} />
              <Divider />
              <Row k="Конфигурация рынков" v={marketConfig?.name ?? '—'} />
              <Row k="Торговый рынок" v={trading ? marketLabel(trading) : '—'} />
              <Row k="Стратегия" v={strategy?.name ?? '—'} />
            </Stack>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
            <Button disabled={active === 0} onClick={() => setActive((a) => a - 1)} data-testid="wizard-back">Назад</Button>
            <Box sx={{ flexGrow: 1 }} />
            {active < STEPS.length - 1 ? (
              <Button variant="contained" disabled={!canNext} onClick={() => setActive((a) => a + 1)} data-testid="wizard-next">Далее</Button>
            ) : (
              <Button variant="contained" color="success" onClick={create} data-testid="wizard-create">Создать бота</Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">{k}</Typography>
      <Typography variant="body2" fontWeight={600}>{v}</Typography>
    </Stack>
  );
}
