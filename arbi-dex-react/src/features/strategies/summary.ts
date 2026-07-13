import type { StrategyConfig } from '../../domain/types';

function n(side: StrategyConfig['buy'], cond: string, key: string): number | null {
  const c = side.find((x) => x.conditionId === cond);
  if (!c || !c.enabled) return null;
  const v = c.params[key];
  return typeof v === 'number' ? v : null;
}

/** Key coefficients of a strategy, for compact display. */
export function strategySummary(s: StrategyConfig) {
  return {
    buyThreshold: n(s.buy, 'avg_observed_higher_for_last_steps', 'percent'),
    sellThreshold: n(s.sell, 'avg_observed_higher_for_last_steps', 'percent'),
    maxSpread: n(s.buy, 'spread_ok', 'maxSpreadPercent'),
    stopLoss: n(s.sell, 'stop_loss', 'stopLossPercent'),
    trailingTP: n(s.sell, 'trailing_take_profit', 'trailingTakeProfitPercent'),
    buyEnabled: s.buy.filter((c) => c.enabled).length,
    sellEnabled: s.sell.filter((c) => c.enabled).length,
  };
}
