import type { ConditionDef } from '../types';

/**
 * The balance on the current step meets the required minimum in quote units:
 * - buy  → free cash (`token2`) ≥ min
 * - sell → base holdings valued at bid (`token1 * sellQuote`) ≥ min
 *
 * Passes when a balance is not required; a missing balance is treated as -Infinity.
 */
export const balanceOkCondition: ConditionDef = {
  id: 'balance_ok',
  window: () => ({}),
  evaluate: (ctx, strategy, side) => {
    if (side === 'buy') {
      const require = strategy.buy.requireToken1Balance;
      const minBalance = strategy.buy.minToken1Balance;
      const balance = ctx.current.balances?.token2;
      return {
        passed: !require || (balance ?? Number.NEGATIVE_INFINITY) >= minBalance,
        actual: balance ?? '—',
        required: minBalance,
      };
    }
    const require = strategy.sell.requireToken2Balance;
    const minBalance = strategy.sell.minToken2Balance;
    const token1 = ctx.current.balances?.token1;
    const sellQuote = ctx.current.quotes.sellQuote;
    const balance =
      token1 == null || !(sellQuote > 0) ? undefined : token1 * sellQuote;
    return {
      passed: !require || (balance ?? Number.NEGATIVE_INFINITY) >= minBalance,
      actual: balance ?? '—',
      required: minBalance,
    };
  },
};
