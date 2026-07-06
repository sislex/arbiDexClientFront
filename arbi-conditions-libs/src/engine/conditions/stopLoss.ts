import type { ConditionDef } from '../types';

/**
 * Stop-loss trigger: forces a sell when the current exit (sell/bid) price falls
 * at least `sell.stopLossPercent`% below the position's entry price. Fires only
 * with an open position and a configured percent.
 */
export const stopLossCondition: ConditionDef = {
  id: 'stop_loss',
  window: () => ({}),
  evaluate: (ctx, strategy) => {
    const pct = strategy.sell.stopLossPercent;
    if (ctx.position === null || pct == null) {
      return { passed: false };
    }
    const stopPrice = ctx.position.entryPrice * (1 - pct / 100);
    const price = ctx.current.quotes.sellQuote;
    return { passed: price <= stopPrice, actual: price, required: stopPrice };
  },
};
