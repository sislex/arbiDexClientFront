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

  // Timeline = union of ALL series' times. DEX prices only tick when the pool
  // moves — sometimes minutes apart — so a trading-only timeline would collapse
  // the live chart to a couple of points (or none, hiding the buy/sell lines).
  const timeSet = new Set<number>();
  for (const p of trading) timeSet.add(p.time);
  for (const s of observed) for (const p of s.data) timeSet.add(p.time);
  const baseTimes = [...timeSet].sort((a, b) => a - b);

  const quotes: QuotePoint[] = [];
  let tc = -1; // forward-fill cursor over the trading series
  for (const time of baseTimes) {
    const avg = weightedAt(weighted, time);
    while (tc + 1 < trading.length && trading[tc + 1].time <= time) tc++;
    const trade = tc >= 0 ? trading[tc] : null;
    // 0 = «нет данных наблюдаемых»: только наблюдаемые рынки формируют среднюю,
    // торговый рынок в неё не подмешивается.
    const avgObservedQuote = avg ?? 0;
    quotes.push({
      time,
      avgObservedQuote,
      // Rare trading ticks stretch as steps (last known bid/ask); only with no
      // trading data at all do the buy/sell lines fall back to the average.
      buyQuote: trade ? trade.ask : avgObservedQuote,
      sellQuote: trade ? trade.bid : avgObservedQuote,
    });
  }
  return { quotes, observed };
}
