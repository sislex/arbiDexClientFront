import type { ConditionDef } from '../types';

/** The buy/sell side is enabled in the strategy. (Config-only.) */
export const enabledCondition: ConditionDef = {
  id: 'enabled',
  window: () => ({}),
  evaluate: (_ctx, strategy, side) => ({ passed: strategy[side].enabled }),
};
