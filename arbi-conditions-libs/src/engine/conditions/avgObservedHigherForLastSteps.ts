import { pctDiff } from '../helpers';
import type {
  AvgObservedHigherThanForLastStepsConfig,
  ConditionDef,
  Side,
  StrategyEngineConfig,
} from '../types';

function cfgFor(strategy: StrategyEngineConfig, side: Side): AvgObservedHigherThanForLastStepsConfig {
  return side === 'buy'
    ? strategy.buy.avgObservedHigherThanBuyForLastSteps
    : strategy.sell.avgObservedHigherThanSellForLastSteps;
}

/**
 * For each of the last `steps` steps, the observed price was at least
 * `percent`% above the side's quote (buy → buyQuote, sell → sellQuote).
 * `actual` reports the weakest (minimum) percent over that window.
 */
export const avgObservedHigherForLastStepsCondition: ConditionDef = {
  id: 'avg_observed_higher_for_last_steps',
  window: (strategy, side) => ({ steps: Math.max(1, Math.floor(cfgFor(strategy, side).steps)) }),
  evaluate: (ctx, strategy, side) => {
    const cfg = cfgFor(strategy, side);
    const n = Math.max(1, Math.floor(cfg.steps));
    const quoteKey = side === 'buy' ? 'buyQuote' : 'sellQuote';
    const last = ctx.window.slice(-n);
    const percents = last.map((s) => pctDiff(s.quotes.avgObservedQuote, s.quotes[quoteKey]));
    const passed = ctx.window.length >= n && percents.every((p) => p >= cfg.percent);
    const weakest = percents.length ? Math.min(...percents) : Number.NEGATIVE_INFINITY;
    return { passed, actual: weakest, required: cfg.percent };
  },
};
