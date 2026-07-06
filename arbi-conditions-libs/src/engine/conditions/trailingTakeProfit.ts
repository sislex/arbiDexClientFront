import type { ConditionDef } from '../types';

/**
 * Trailing take-profit trigger (trailing stop): tracks the peak exit (sell/bid)
 * price observed since the position opened and forces a sell when the price
 * pulls back at least `sell.trailingTakeProfitPercent`% from that peak. Fires
 * regardless of whether the peak was above entry (i.e. it also protects on the
 * downside), matching the server `BacktestEngine` / frontend `AutoTradeEngine`.
 * Needs the window to reach back to when the position opened (`sincePositionOpen`).
 */
export const trailingTakeProfitCondition: ConditionDef = {
  id: 'trailing_take_profit',
  window: () => ({ sincePositionOpen: true }),
  evaluate: (ctx, strategy) => {
    const pct = strategy.sell.trailingTakeProfitPercent;
    if (ctx.position === null || pct == null) {
      return { passed: false };
    }
    const { openedAt } = ctx.position;

    // Highest exit (bid) price observed strictly after the position opened
    // (the entry step's own bid is excluded — matches the server BacktestEngine).
    let peak = 0;
    for (const step of ctx.window) {
      if (step.time > openedAt && step.quotes.sellQuote > peak) {
        peak = step.quotes.sellQuote;
      }
    }

    const price = ctx.current.quotes.sellQuote;
    const trailLevel = peak * (1 - pct / 100);
    // Fire once a peak exists and price has pulled back to the trailing level.
    const passed = peak > 0 && price <= trailLevel;
    return { passed, actual: price, required: trailLevel };
  },
};
