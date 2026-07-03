import { pctDiff } from '../helpers';
import type {
  AvgObservedHigherThanForLastStepsConfig,
  MarketStep,
  StrategyEngineConfig,
} from '../../types';

type QuoteKey = 'buyQuote' | 'sellQuote';

/**
 * For each of the last `cfg.steps` steps in the window, the observed price was
 * at least `cfg.percent`% above the given quote. Fails until the window holds
 * `cfg.steps` steps.
 */
function passLastSteps(
  steps: MarketStep[],
  quoteKey: QuoteKey,
  cfg: AvgObservedHigherThanForLastStepsConfig,
): boolean {
  const n = Math.max(1, Math.floor(cfg.steps));
  if (steps.length < n) return false;
  return steps
    .slice(-n)
    .every((step) => pctDiff(step.quotes.avgObservedQuote, step.quotes[quoteKey]) >= cfg.percent);
}

/** Condition (buy): observed stayed above the buy quote for the last N steps. */
export function buyAvgObservedHigherForLastSteps(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return passLastSteps(steps, 'buyQuote', strategy.buy.avgObservedHigherThanBuyForLastSteps);
}

/** Condition (sell): observed stayed above the sell quote for the last N steps. */
export function sellAvgObservedHigherForLastSteps(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return passLastSteps(steps, 'sellQuote', strategy.sell.avgObservedHigherThanSellForLastSteps);
}
