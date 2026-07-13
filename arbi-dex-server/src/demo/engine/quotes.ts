import { QuotePoint } from './types';
import { makeRng, hashSeed } from './rng';

export interface QuoteSeriesOptions {
  seed: string;
  count: number;
  intervalSec: number;
  endTime: number;
  basePrice: number;
  volatility?: number;
  spread?: number;
}

/**
 * Generate a deterministic quote series. `avgObservedQuote` is a smooth random
 * walk (the "fair"/reference price). The trading market diverges from it with a
 * persistent (mean-reverting) offset so arbitrage windows last several steps.
 */
export function generateQuoteSeries(opts: QuoteSeriesOptions): QuotePoint[] {
  const {
    seed,
    count,
    intervalSec,
    endTime,
    basePrice,
    volatility = 0.0025,
    spread = 0.0015,
  } = opts;
  const rng = makeRng(hashSeed(seed));
  const startTime = endTime - (count - 1) * intervalSec;

  const points: QuotePoint[] = [];
  let mid = basePrice;
  let drift = 0;
  let diverge = 0;
  for (let i = 0; i < count; i++) {
    drift = drift * 0.9 + (rng() - 0.5) * volatility * 2;
    mid = mid * (1 + drift);
    diverge = diverge * 0.82 + (rng() - 0.5) * 0.014;
    const tradingMid = mid * (1 + diverge);
    const halfSpread = (spread / 2) * (0.6 + rng() * 0.8);
    const buyQuote = tradingMid * (1 + halfSpread);
    const sellQuote = tradingMid * (1 - halfSpread);
    points.push({
      time: startTime + i * intervalSec,
      buyQuote: round(buyQuote),
      sellQuote: round(sellQuote),
      avgObservedQuote: round(mid),
    });
  }
  return points;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
