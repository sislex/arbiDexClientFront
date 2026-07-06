import type { ConditionDef } from '../types';

/**
 * Max-holding-time trigger: forces a sell once the position has been held for at
 * least `sell.maxHoldingTimeMs` ms. Fires only with an open position and a
 * configured limit.
 */
export const maxHoldingTimeCondition: ConditionDef = {
  id: 'max_holding_time',
  window: () => ({}),
  evaluate: (ctx, strategy) => {
    const maxMs = strategy.sell.maxHoldingTimeMs;
    if (ctx.position === null || maxMs == null) {
      return { passed: false };
    }
    const heldMs = ctx.current.time - ctx.position.openedAt;
    return { passed: heldMs >= maxMs, actual: heldMs, required: maxMs };
  },
};
