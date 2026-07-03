import { lastStep, pctDiff } from '../helpers';
import type { MarketStep, StrategyEngineConfig } from '../../types';

/** Buy/sell spread percent on the current step (last of the window). */
function currentSpreadPercent(steps: MarketStep[]): number {
  const current = lastStep(steps);
  return pctDiff(current.quotes.buyQuote, current.quotes.sellQuote);
}

/** Condition (buy): the current spread is within the buy-side maximum. */
export function buySpreadOk(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return currentSpreadPercent(steps) <= strategy.buy.maxBuySellSpreadPercent;
}

/** Condition (sell): the current spread is within the sell-side maximum. */
export function sellSpreadOk(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return currentSpreadPercent(steps) <= strategy.sell.maxBuySellSpreadPercent;
}
