import type { QuotePoint } from '../domain/types';
import { makeRng, hashSeed } from './rng';

export interface QuoteSeriesOptions {
  seed: string;
  /** Number of steps. */
  count: number;
  /** Seconds between steps. */
  intervalSec: number;
  /** End time (unix seconds); series ends here and goes back `count` steps. */
  endTime: number;
  /** Starting mid price. */
  basePrice: number;
  /** Random-walk volatility as a fraction of price per step. */
  volatility?: number;
  /** Base buy/sell spread as a fraction of price. */
  spread?: number;
}

/**
 * Generate a deterministic quote series. `avgObservedQuote` is a smooth random
 * walk (the "fair"/reference price). `buyQuote`/`sellQuote` orbit it with a
 * spread plus occasional divergences that create arbitrage opportunities.
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
  // Persistent divergence of the trading market from the reference. It
  // mean-reverts slowly so arbitrage windows last several steps (enough for
  // the engine's N-step gate to fire) rather than single-step spikes.
  let diverge = 0;
  for (let i = 0; i < count; i++) {
    // Mean-reverting random walk for the reference (observed) price.
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
