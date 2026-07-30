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
 * Arb deviation gate over the last `steps` ticks (denominator = avgObservedQuote):
 * - buy:  (avg − buyQuote) / avg · 100 ≥ percent  → buyQuote below avg
 * - sell: (sellQuote − avg) / avg · 100 ≥ percent → sellQuote above avg
 *
 * `percent` may be negative (looser / inverted threshold). `actual` is the
 * weakest (minimum) deviation in the window.
 */
export const avgObservedHigherForLastStepsCondition: ConditionDef = {
  id: 'avg_observed_higher_for_last_steps',
  window: (strategy, side) => ({ steps: Math.max(1, Math.floor(cfgFor(strategy, side).steps)) }),
  evaluate: (ctx, strategy, side) => {
    const cfg = cfgFor(strategy, side);
    const n = Math.max(1, Math.floor(cfg.steps));
    const last = ctx.window.slice(-n);
    const percents = last.map((s) => {
      const avg = s.quotes.avgObservedQuote;
      if (avg <= 0) return Number.NEGATIVE_INFINITY;
      return side === 'buy'
        ? ((avg - s.quotes.buyQuote) / avg) * 100
        : ((s.quotes.sellQuote - avg) / avg) * 100;
    });
    const passed = ctx.window.length >= n && percents.every((p) => p >= cfg.percent);
    const weakest = percents.length ? Math.min(...percents) : Number.NEGATIVE_INFINITY;
    return { passed, actual: weakest, required: cfg.percent };
  },
};
