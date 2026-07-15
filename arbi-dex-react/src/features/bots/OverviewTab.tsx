import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, CircularProgress, Stack, Typography, Chip, Button, Divider } from '@mui/material';
import type { Bot } from '../../domain/types';
import { StatCard } from '../../components/StatCard';
import { PnlValue } from '../../components/PnlValue';
import { fmtMoney, fmtPct } from '../../components/format';
import { QuoteChartPanel } from '../../components/chart/QuoteChartPanel';
import { useAppSelector } from '../../store';
import { api } from '../../api';
import type { MarketPreview } from '../../api/types';
import { findMarket, marketLabel } from '../marketConfigs/marketLabel';
import { strategySummary } from '../strategies/summary';
import { cashAsset } from './botAssets';

function KeyVal({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">{k}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{v}</Typography>
    </Stack>
  );
}

export function OverviewTab({ bot }: { bot: Bot }) {
  const navigate = useNavigate();
  const markets = useAppSelector((s) => s.catalog.markets);
  const marketConfig = useAppSelector((s) => s.marketConfigs.items.find((m) => m.id === bot.marketConfigId));
  const strategy = useAppSelector((s) => s.strategyConfigs.items.find((x) => x.id === bot.strategyConfigId));

  // Real market chart (same data source as the market config editor preview).
  const [preview, setPreview] = useState<MarketPreview>({ quotes: [], observed: [] });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const observedKey = marketConfig?.observedMarketIds.join(',') ?? '';
  useEffect(() => {
    if (!marketConfig || (!marketConfig.tradingMarketId && marketConfig.observedMarketIds.length === 0)) {
      setPreview({ quotes: [], observed: [] });
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    api.quotes
      .marketPreview({
        tradingMarketId: marketConfig.tradingMarketId || null,
        observedMarketIds: marketConfig.observedMarketIds,
        weights: marketConfig.weights ?? {},
      })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketConfig?.id, marketConfig?.tradingMarketId, observedKey]);

  const trading = marketConfig ? findMarket(markets, marketConfig.tradingMarketId) : undefined;
  const sum = strategy ? strategySummary(strategy) : null;

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <StatCard label="PnL" value={<PnlValue value={bot.pnl} pct={bot.pnlPct} variant="h6" />} />
        <StatCard label="Баланс" value={fmtMoney(bot.balance, cashAsset(bot))} />
        <StatCard label="Сделок" value={bot.tradesCount} />
        <StatCard label="Winrate" value={`${bot.winRate}%`} />
      </Stack>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
        <Stack spacing={2} sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1">Конфигурация рынков</Typography>
                {marketConfig && (
                  <Button size="small" onClick={() => navigate(`/market-configs/${marketConfig.id}`)} data-testid="open-market-config">
                    Открыть
                  </Button>
                )}
              </Stack>
              {marketConfig ? (
                <Stack spacing={0.5}>
                  <KeyVal k="Название" v={marketConfig.name} />
                  <KeyVal k="Торговый рынок" v={trading ? marketLabel(trading) : '—'} />
                  <KeyVal k="Наблюдаемых" v={marketConfig.observedMarketIds.length} />
                  <KeyVal k="Средневзвешенная" v={<Chip size="small" label={marketConfig.useWeightedAverage ? 'вкл' : 'выкл'} variant="outlined" />} />
                </Stack>
              ) : (
                <Typography color="text.secondary" variant="body2">Не найдена</Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1">Стратегия</Typography>
                {strategy && (
                  <Button size="small" onClick={() => navigate(`/strategies/${strategy.id}`)} data-testid="open-strategy">
                    Открыть
                  </Button>
                )}
              </Stack>
              {strategy && sum ? (
                <Stack spacing={0.5}>
                  <KeyVal k="Название" v={strategy.name} />
                  <Divider sx={{ my: 0.5 }} />
                  <KeyVal k="Порог покупки" v={sum.buyThreshold != null ? fmtPct(sum.buyThreshold) : '—'} />
                  <KeyVal k="Порог продажи" v={sum.sellThreshold != null ? fmtPct(sum.sellThreshold) : '—'} />
                  <KeyVal k="Стоп-лосс" v={sum.stopLoss != null ? fmtPct(sum.stopLoss) : 'выкл'} />
                  <KeyVal k="Trailing TP" v={sum.trailingTP != null ? fmtPct(sum.trailingTP) : 'выкл'} />
                </Stack>
              ) : (
                <Typography color="text.secondary" variant="body2">Не найдена</Typography>
              )}
            </CardContent>
          </Card>
        </Stack>

        <Card sx={{ flexGrow: 1, width: '100%' }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Рынок (реальные котировки)</Typography>
            {loadingPreview && preview.quotes.length === 0 ? (
              <Stack sx={{ height: 340 }} alignItems="center" justifyContent="center" spacing={1} data-testid="bot-chart-loading">
                <CircularProgress />
                <Typography variant="caption" color="text.secondary">Загрузка котировок…</Typography>
              </Stack>
            ) : preview.quotes.length === 0 ? (
              <Box sx={{ height: 340, display: 'grid', placeItems: 'center' }}>
                <Typography color="text.secondary">Нет данных котировок для рынков этой конфигурации</Typography>
              </Box>
            ) : (
              <QuoteChartPanel
                quotes={preview.quotes}
                observed={preview.observed}
                hasTradingMarket={!!marketConfig?.tradingMarketId}
                height={340}
                defaultWeighted={marketConfig?.useWeightedAverage ?? true}
                player
              />
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
