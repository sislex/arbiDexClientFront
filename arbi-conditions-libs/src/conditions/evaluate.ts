import type {
  AnalyticsCondition,
  ConditionsConfig,
  PriceContext,
} from './types';

/** Convert a percent threshold (0.02 = 0.02%) to a fraction (0.0002). */
function pctToFraction(thresholdPct: number): number {
  return thresholdPct / 100;
}

/**
 * Evaluate a single condition against the current prices.
 * Returns whether the condition is currently satisfied.
 */
export function evaluateCondition(
  condition: AnalyticsCondition,
  ctx: PriceContext,
): boolean {
  const threshold = pctToFraction(condition.thresholdPct);

  switch (condition.type) {
    // Observed price is above buy price by more than the threshold.
    case 'OBSERVED_ABOVE_BUY':
      return ctx.observedPrice > ctx.buyPrice * (1 + threshold);

    // Observed price is below sell price by more than the threshold.
    case 'OBSERVED_BELOW_SELL':
      return ctx.observedPrice < ctx.sellPrice * (1 - threshold);

    // Buy and sell prices differ by less than the threshold.
    case 'SPREAD_WITHIN': {
      if (ctx.sellPrice === 0) {
        return false;
      }
      const spread = Math.abs(ctx.buyPrice - ctx.sellPrice) / ctx.sellPrice;
      return spread < threshold;
    }
  }
}

/** Result of evaluating one condition. */
export interface ConditionResult {
  id: string;
  type: AnalyticsCondition['type'];
  satisfied: boolean;
}

/**
 * Evaluate every enabled condition in the config.
 * Disabled conditions are skipped entirely.
 */
export function evaluateConfig(
  config: ConditionsConfig,
  ctx: PriceContext,
): ConditionResult[] {
  return config.conditions
    .filter((c) => c.enabled)
    .map((c) => ({
      id: c.id,
      type: c.type,
      satisfied: evaluateCondition(c, ctx),
    }));
}

/** True only if every enabled condition is satisfied. */
export function allConditionsMet(
  config: ConditionsConfig,
  ctx: PriceContext,
): boolean {
  return evaluateConfig(config, ctx).every((r) => r.satisfied);
}
