import type { MarketStep, StrategyEngineConfig } from '../../types';

/** Condition: the buy side is enabled. (Config-only; `steps` unused.) */
export function buyEnabled(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return strategy.buy.enabled;
}

/** Condition: the sell side is enabled. (Config-only; `steps` unused.) */
export function sellEnabled(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return strategy.sell.enabled;
}
