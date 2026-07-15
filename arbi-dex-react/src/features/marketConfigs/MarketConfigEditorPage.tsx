import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Stack, TextField, Typography, Chip, IconButton,
  ToggleButtonGroup, ToggleButton, Divider, List, ListItem, ListItemText, CircularProgress,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import { PageHeader } from '../../components/PageHeader';
import { QuoteChartPanel } from '../../components/chart/QuoteChartPanel';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMarketConfigs, createMarketConfig, updateMarketConfig } from '../../store/marketConfigsSlice';
import { fetchMarkets } from '../../store/catalogSlice';
import { MarketPicker } from './MarketPicker';
import { findMarket, marketLabel } from './marketLabel';
import { api, IS_LIVE } from '../../api';
import type { MarketPreview, PreviewSeries } from '../../api/types';
import { subscribeMarket, type MarketTick } from '../../api/liveSocket';
import { assembleMarketPreview, type TradingPoint } from '../../api/assemble';
import { marketLabelFromId } from '../../api/live';

export function MarketConfigEditorPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const markets = useAppSelector((s) => s.catalog.markets);
  const existing = useAppSelector((s) => s.marketConfigs.items.find((m) => m.id === id));

  const [name, setName] = useState('');
  const [tradingMarketId, setTradingMarketId] = useState<string | null>(null);
  const [observedMarketIds, setObservedMarketIds] = useState<string[]>([]);
  const [useWeightedAverage, setUseWeightedAverage] = useState(true);
  const [mode, setMode] = useState<'historical' | 'realtime'>('historical');
  const [pendingObserved, setPendingObserved] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchMarkets());
    dispatch(fetchMarketConfigs());
  }, [dispatch]);

  // Hydrate from existing config once loaded.
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setTradingMarketId(existing.tradingMarketId);
      setObservedMarketIds(existing.observedMarketIds);
      setUseWeightedAverage(existing.useWeightedAverage);
    }
  }, [existing]);

  const [preview, setPreview] = useState<MarketPreview>({ quotes: [], observed: [] });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { quotes, observed } = preview;

  // Load the chart preview (mock → generated; live → real market-data) whenever
  // the selected markets change. `mode` is part of the deps so the historical/
  // realtime toggle refetches.
  useEffect(() => {
    if (!tradingMarketId && observedMarketIds.length === 0) {
      setPreview({ quotes: [], observed: [] });
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    api.quotes
      .marketPreview({ tradingMarketId, observedMarketIds, weights: existing?.weights ?? {} })
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {
        if (!cancelled) setPreview({ quotes: [], observed: [] });
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tradingMarketId, observedMarketIds, existing, mode]);

  // Keep the latest preview in a ref so the streaming effect can seed from it
  // without depending on it (which would restart the stream on every tick).
  const previewRef = useRef(preview);
  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  // Live realtime streaming via the /live-chart socket (live mode only).
  const [streaming, setStreaming] = useState(false);
  const observedKey = observedMarketIds.join(',');
  useEffect(() => {
    if (!IS_LIVE || mode !== 'realtime' || (!tradingMarketId && observedMarketIds.length === 0)) {
      setStreaming(false);
      return;
    }
    const weights = existing?.weights ?? {};
    const seed = previewRef.current;
    const observedData = new Map<string, { time: number; value: number }[]>(
      observedMarketIds.map((id) => [id, (seed.observed.find((o) => o.id === id)?.data ?? []).slice(-2000)]),
    );
    let tradingData: TradingPoint[] = tradingMarketId
      ? seed.quotes.map((q) => ({ time: q.time, bid: q.sellQuote, ask: q.buyQuote })).slice(-2000)
      : [];
    const lastBA = new Map<string, { bid?: number; ask?: number }>();
    let dirty = false;

    const onTick = (id: string, isTrading: boolean) => (tick: MarketTick) => {
      const sec = Math.floor(tick.t / 1000);
      const ba = lastBA.get(id) ?? {};
      ba[tick.field] = tick.v;
      lastBA.set(id, ba);
      if (isTrading) {
        if (ba.bid != null && ba.ask != null) {
          if (tradingData.length && tradingData[tradingData.length - 1].time === sec)
            tradingData[tradingData.length - 1] = { time: sec, bid: ba.bid, ask: ba.ask };
          else tradingData = [...tradingData.slice(-1999), { time: sec, bid: ba.bid, ask: ba.ask }];
          dirty = true;
        }
      } else {
        const mid = ba.bid != null && ba.ask != null ? (ba.bid + ba.ask) / 2 : ba.bid ?? ba.ask;
        if (mid != null) {
          const arr = observedData.get(id)!;
          if (arr.length && arr[arr.length - 1].time === sec) arr[arr.length - 1] = { time: sec, value: mid };
          else { arr.push({ time: sec, value: mid }); if (arr.length > 2000) arr.shift(); }
          dirty = true;
        }
      }
    };

    const unsubs = observedMarketIds.map((id) => subscribeMarket(id, onTick(id, false)));
    if (tradingMarketId) unsubs.push(subscribeMarket(tradingMarketId, onTick(tradingMarketId, true)));
    setStreaming(true);

    const timer = window.setInterval(() => {
      if (!dirty) return;
      dirty = false;
      const observedSeries: PreviewSeries[] = observedMarketIds.map((id) => ({
        id,
        label: marketLabelFromId(id),
        data: observedData.get(id)!.slice(),
      }));
      setPreview(assembleMarketPreview(observedSeries, tradingData.slice(), weights));
    }, 500);

    return () => {
      unsubs.forEach((u) => u());
      window.clearInterval(timer);
      setStreaming(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tradingMarketId, observedKey]);

  // Наблюдаемые рынки необязательны: без них конфигурацию можно сохранить,
  // но торговать по ней нельзя (нет средневзвешенной цены).
  const canSave = name.trim().length > 0 && !!tradingMarketId;

  const addObserved = () => {
    if (pendingObserved && !observedMarketIds.includes(pendingObserved)) {
      setObservedMarketIds((ids) => [...ids, pendingObserved]);
      setPendingObserved(null);
    }
  };

  const save = async () => {
    const payload = {
      name: name.trim(),
      tradingMarketId: tradingMarketId!,
      observedMarketIds,
      useWeightedAverage,
      weights: existing?.weights ?? {},
    };
    if (isNew) await dispatch(createMarketConfig(payload));
    else await dispatch(updateMarketConfig({ id: id!, patch: payload }));
    navigate('/market-configs');
  };

  return (
    <Box>
      <PageHeader
        title={isNew ? 'Новая конфигурация рынков' : 'Конфигурация рынков'}
        subtitle="Наблюдаемые рынки → средневзвешенная, торговый рынок → линии покупки/продажи"
        actions={
          <Button variant="contained" startIcon={<SaveIcon />} disabled={!canSave} onClick={save} data-testid="save-market-config">
            Сохранить
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Card sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0 }}>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label="Название"
                size="small"
                value={name}
                onChange={(e) => setName(e.target.value)}
                inputProps={{ 'data-testid': 'mc-name' }}
              />

              <Divider textAlign="left"><Typography variant="caption">Наблюдаемые рынки</Typography></Divider>
              <Stack direction="row" spacing={1}>
                <MarketPicker
                  markets={markets}
                  value={pendingObserved}
                  onChange={setPendingObserved}
                  label="Добавить рынок"
                  testid="observed-picker"
                  exclude={[...observedMarketIds, ...(tradingMarketId ? [tradingMarketId] : [])]}
                  showStoreKey
                />
                <IconButton color="primary" onClick={addObserved} disabled={!pendingObserved} data-testid="add-observed">
                  <AddIcon />
                </IconButton>
              </Stack>
              <List dense data-testid="observed-list">
                {observedMarketIds.map((mid) => {
                  const m = findMarket(markets, mid);
                  return (
                    <ListItem
                      key={mid}
                      secondaryAction={
                        <IconButton edge="end" size="small" onClick={() => setObservedMarketIds((ids) => ids.filter((x) => x !== mid))}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={m ? m.storeKey ?? marketLabel(m) : mid}
                        primaryTypographyProps={{ sx: { wordBreak: 'break-all' } }}
                      />
                    </ListItem>
                  );
                })}
                {observedMarketIds.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Не заполнено — торговля по этой конфигурации невозможна
                  </Typography>
                )}
              </List>

              <Divider textAlign="left"><Typography variant="caption">Торговый рынок</Typography></Divider>
              <MarketPicker
                markets={markets}
                kind="dex"
                value={tradingMarketId}
                onChange={setTradingMarketId}
                label="Где торгуем (DEX)"
                testid="trading-picker"
                exclude={observedMarketIds}
                showStoreKey
              />
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flexGrow: 1, width: '100%' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1">Предпросмотр графика</Typography>
                {streaming && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label="● LIVE"
                    data-testid="live-indicator"
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </Stack>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={mode}
                onChange={(_, v) => v && setMode(v)}
              >
                <ToggleButton value="historical" data-testid="mode-historical">Исторические</ToggleButton>
                <ToggleButton value="realtime" data-testid="mode-realtime">Реальное время</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            {!tradingMarketId && observedMarketIds.length === 0 ? (
              <Box sx={{ height: 360, display: 'grid', placeItems: 'center' }}>
                <Typography color="text.secondary">Выберите торговый или наблюдаемые рынки для предпросмотра</Typography>
              </Box>
            ) : loadingPreview && quotes.length === 0 ? (
              <Stack sx={{ height: 360 }} alignItems="center" justifyContent="center" spacing={1} data-testid="preview-loading">
                <CircularProgress />
                <Typography variant="caption" color="text.secondary">Загрузка котировок…</Typography>
              </Stack>
            ) : quotes.length === 0 ? (
              <Box sx={{ height: 360, display: 'grid', placeItems: 'center' }}>
                <Typography color="text.secondary">Нет данных котировок для выбранных рынков</Typography>
              </Box>
            ) : (
              <Box sx={{ position: 'relative' }}>
                {loadingPreview && (
                  <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                    <CircularProgress size={18} />
                  </Box>
                )}
                <QuoteChartPanel
                  quotes={quotes}
                  observed={observed}
                  hasTradingMarket={!!tradingMarketId}
                  defaultWeighted={useWeightedAverage}
                  height={360}
                  player={mode === 'historical'}
                />
              </Box>
            )}
            {tradingMarketId && (
              <Chip sx={{ mt: 1 }} size="small" color="primary" variant="outlined" label="Торговый рынок подключён — показаны линии покупки/продажи" />
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
