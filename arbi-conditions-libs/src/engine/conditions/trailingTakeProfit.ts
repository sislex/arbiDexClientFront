import type { ConditionDef } from '../types';

/**
 * Trailing take-profit trigger: tracks the peak exit (sell/bid) price since the
 * position opened and forces a sell when the price pulls back at least
 * `sell.trailingTakeProfitPercent`% from that peak. Only triggers once the peak
 * has risen above the entry price (i.e. we are in profit). Needs the window to
 * reach back to when the position opened (`sincePositionOpen`).
 */
export const trailingTakeProfitCondition: ConditionDef = {
  id: 'trailing_take_profit',
  window: () => ({ sincePositionOpen: true }),
  evaluate: (ctx, strategy) => {
    const pct = strategy.sell.trailingTakeProfitPercent;
    if (ctx.position === null || pct == null) {
      return { passed: false };
    }
    const { openedAt, entryPrice } = ctx.position;

    // Peak of the exit price over steps at/after the position opened.
    let peak = entryPrice;
    for (const step of ctx.window) {
      if (step.time >= openedAt && step.quotes.sellQuote > peak) {
        peak = step.quotes.sellQuote;
      }
    }

    const price = ctx.current.quotes.sellQuote;
    const trailLevel = peak * (1 - pct / 100);
    // Trigger only after we've been in profit (peak strictly above entry).
    const passed = peak > entryPrice && price <= trailLevel;
    return { passed, actual: price, required: trailLevel };
  },
};
