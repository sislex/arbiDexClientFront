import type { QuotePoint } from '../domain/types';
import type { MarketPreview, PreviewSeries } from './types';

export interface TradingPoint {
  time: number;
  bid: number;
  ask: number;
}

/** Weighted average across observed series at time `t` (last value ≤ t). */
function weightedAt(
  series: { data: { time: number; value: number }[]; weight: number; cursor: number }[],
  t: number,
): number | null {
  let sum = 0;
  let wsum = 0;
  for (const s of series) {
    while (s.cursor + 1 < s.data.length && s.data[s.cursor + 1].time <= t) s.cursor++;
    const pt = s.data[s.cursor];
    if (pt && pt.time <= t) {
      sum += pt.value * s.weight;
      wsum += s.weight;
    }
  }
  return wsum ? sum / wsum : null;
}

/**
 * Assemble a chart preview: weighted quotes (avgObserved + buy/sell) over the
 * trading market's timeline (or observed timeline when flat), plus the observed
 * lines. Shared by the live fetch and the realtime socket stream so both render
 * identically.
 */
export function assembleMarketPreview(
  observed: PreviewSeries[],
  trading: TradingPoint[],
  weights: Record<string, number>,
): MarketPreview {
  const weighted = observed.map((s) => ({ data: s.data, weight: weights[s.id] ?? 1, cursor: 0 }));

  const baseTimes = trading.length
    ? trading.map((p) => p.time)
    : (observed.slice().sort((a, b) => b.data.length - a.data.length)[0]?.data.map((p) => p.time) ?? []);

  const quotes: QuotePoint[] = [];
  for (let i = 0; i < baseTimes.length; i++) {
    const time = baseTimes[i];
    const avg = weightedAt(weighted, time);
    const trade = trading[i];
    // 0 = «нет данных наблюдаемых»: только наблюдаемые рынки формируют среднюю,
    // торговый рынок в неё не подмешивается.
    const avgObservedQuote = avg ?? 0;
    quotes.push({
      time,
      avgObservedQuote,
      buyQuote: trade ? trade.ask : avgObservedQuote,
      sellQuote: trade ? trade.bid : avgObservedQuote,
    });
  }
  return { quotes, observed };
}
