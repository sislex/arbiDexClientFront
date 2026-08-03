import type { ConditionDef } from '../types';

/**
 * Take-profit trigger: forces a sell when the current exit (sell/bid) price rises
 * at least `sell.trailingTakeProfitPercent`% above the position's entry price.
 * (Param name kept for backward compatibility with stored strategy configs.)
 */
export const trailingTakeProfitCondition: ConditionDef = {
  id: 'trailing_take_profit',
  window: () => ({}),
  evaluate: (ctx, strategy) => {
    const pct = strategy.sell.trailingTakeProfitPercent;
    if (ctx.position === null || pct == null) {
      return { passed: false };
    }
    const targetPrice = ctx.position.entryPrice * (1 + pct / 100);
    const price = ctx.current.quotes.sellQuote;
    return { passed: price >= targetPrice, actual: price, required: targetPrice };
  },
};
