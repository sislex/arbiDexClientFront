import { pctDiff } from '../helpers';
import type { ConditionDef } from '../types';

/** The buy/sell spread on the current step is within the side's maximum. */
export const spreadOkCondition: ConditionDef = {
  id: 'spread_ok',
  window: () => ({}),
  evaluate: (ctx, strategy, side) => {
    const spread = pctDiff(ctx.current.quotes.buyQuote, ctx.current.quotes.sellQuote);
    const max = strategy[side].maxBuySellSpreadPercent;
    return { passed: spread <= max, actual: spread, required: max };
  },
};
