import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import type { QuotePoint, Trade } from '../../domain/types';
import { QuoteChartPanel } from '../../components/chart/QuoteChartPanel';
import { api } from '../../api';
import type { PeriodState } from './usePeriod';

/**
 * History chart card for a bot period: shows the market's real quotes within
 * `[period.from, period.to]` (redrawn immediately on change) and lets the user
 * pick the period right on the chart — first click fills «Начало», second
 * fills «Конец».
 */
export function PeriodHistoryChart({
  botId,
  period,
  trades = [],
  title = 'История котировок за период',
  idPrefix,
  height = 340,
}: {
  botId: string;
  period: PeriodState;
  /** Trade markers to overlay (e.g. after a backtest run). */
  trades?: Trade[];
  title?: string;
  idPrefix: string;
  height?: number;
}) {
  const [quotes, setQuotes] = useState<QuotePoint[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    // Wait until usePeriod resolves the default period so we don't fetch twice.
    if (period.from == null || period.to == null) return;
    let cancelled = false;
    setLoading(true);
    api.bots
      .quotes(botId, { from: period.from, to: period.to })
      .then((r) => {
        if (!cancelled) setQuotes(r.quotes);
      })
      .catch(() => {
        if (!cancelled) setQuotes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [botId, period.from, period.to]);

  // Pick the period by clicking the chart: first click → «Начало», second → «Конец».
  const [pick, setPick] = useState<'idle' | 'from' | 'to'>('idle');
  const onChartTimeClick = (time: number) => {
    if (pick === 'from') {
      period.setFrom(time);
      if (period.to != null && time > period.to) period.setTo(time);
      setPick('to');
    } else if (pick === 'to') {
      if (period.from != null && time < period.from) {
        // Clicked earlier than the picked start — swap so the range stays valid.
        period.setTo(period.from);
        period.setFrom(time);
      } else {
        period.setTo(time);
      }
      setPick('idle');
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">{title}</Typography>
          {loading && <CircularProgress size={16} />}
          <Box sx={{ flexGrow: 1 }} />
          <Button
            size="small"
            variant={pick === 'idle' ? 'outlined' : 'contained'}
            color={pick === 'idle' ? 'inherit' : 'primary'}
            startIcon={<HighlightAltIcon />}
            onClick={() => setPick(pick === 'idle' ? 'from' : 'idle')}
            disabled={quotes.length === 0}
            data-testid={`${idPrefix}-pick-period`}
          >
            {pick === 'idle'
              ? 'Выбрать период на графике'
              : pick === 'from'
                ? 'Кликните на графике: начало'
                : 'Кликните на графике: конец'}
          </Button>
        </Stack>
        {quotes.length === 0 && !loading ? (
          <Box sx={{ height, display: 'grid', placeItems: 'center' }} data-testid={`${idPrefix}-history-empty`}>
            <Typography color="text.secondary">Нет котировок за выбранный период</Typography>
          </Box>
        ) : (
          <QuoteChartPanel
            quotes={quotes}
            trades={trades}
            hasTradingMarket
            height={height}
            defaultWeighted
            player
            onTimeClick={pick === 'idle' ? undefined : onChartTimeClick}
          />
        )}
      </CardContent>
    </Card>
  );
}
