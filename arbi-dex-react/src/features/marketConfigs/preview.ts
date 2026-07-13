import type { Market, QuotePoint } from '../../domain/types';
import type { ObservedSeries } from '../../components/chart/QuoteChartPanel';
import { generateQuoteSeries } from '../../mocks/quotes';
import { PAIR_BASE_PRICE, NOW } from '../../mocks/seed';
import { marketLabel } from './marketLabel';

const COUNT = 180;
const INTERVAL = 60;

function basePriceFor(m: Market | undefined): number {
  return (m && PAIR_BASE_PRICE[m.pairId]) || 3200;
}

/**
 * Build chart preview data from selected markets: one series per observed
 * market, their weighted average, and the trading market's buy/sell quotes.
 * Deterministic (seeded per market) so previews are stable. `mode` only
 * varies the seed so historical vs realtime render differently.
 */
export function buildPreview(
  markets: Market[],
  tradingMarketId: string | null,
  observedMarketIds: string[],
  weights: Record<string, number>,
  mode: 'historical' | 'realtime',
): { quotes: QuotePoint[]; observed: ObservedSeries[] } {
  const suffix = mode === 'realtime' ? ':live' : '';
  const endTime = NOW;

  const observedRaw = observedMarketIds.map((id) => {
    const m = markets.find((x) => x.id === id);
    return {
      id,
      label: m ? marketLabel(m) : id,
      series: generateQuoteSeries({ seed: id + suffix, count: COUNT, intervalSec: INTERVAL, endTime, basePrice: basePriceFor(m) }),
    };
  });

  const observed: ObservedSeries[] = observedRaw.map((o) => ({
    id: o.id,
    label: o.label,
    data: o.series.map((q) => ({ time: q.time, value: q.avgObservedQuote })),
  }));

  const trading = tradingMarketId ? markets.find((m) => m.id === tradingMarketId) : undefined;
  const tradingSeries = trading
    ? generateQuoteSeries({ seed: trading.id + suffix, count: COUNT, intervalSec: INTERVAL, endTime, basePrice: basePriceFor(trading) })
    : null;

  // Weighted average of observed mids at each step.
  const quotes: QuotePoint[] = [];
  for (let i = 0; i < COUNT; i++) {
    const time = tradingSeries?.[i]?.time ?? observedRaw[0]?.series[i]?.time ?? endTime - (COUNT - 1 - i) * INTERVAL;
    let sum = 0;
    let wsum = 0;
    for (const o of observedRaw) {
      const w = weights[o.id] ?? 1;
      sum += o.series[i].avgObservedQuote * w;
      wsum += w;
    }
    const avg = wsum ? sum / wsum : tradingSeries?.[i]?.avgObservedQuote ?? 0;
    quotes.push({
      time,
      buyQuote: tradingSeries?.[i]?.buyQuote ?? avg,
      sellQuote: tradingSeries?.[i]?.sellQuote ?? avg,
      avgObservedQuote: Math.round(avg * 100) / 100,
    });
  }
  return { quotes, observed };
}
