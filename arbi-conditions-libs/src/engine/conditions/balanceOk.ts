import type { ConditionDef } from '../types';

/**
 * The token balance on the current step meets the required minimum
 * (buy → token1, sell → token2). Passes when a balance is not required;
 * a missing balance is treated as -Infinity.
 */
export const balanceOkCondition: ConditionDef = {
  id: 'balance_ok',
  window: () => ({}),
  evaluate: (ctx, strategy, side) => {
    const require = side === 'buy'
      ? strategy.buy.requireToken1Balance
      : strategy.sell.requireToken2Balance;
    const minBalance = side === 'buy' ? strategy.buy.minToken1Balance : strategy.sell.minToken2Balance;
    const balance = side === 'buy' ? ctx.current.balances?.token1 : ctx.current.balances?.token2;
    return {
      passed: !require || (balance ?? Number.NEGATIVE_INFINITY) >= minBalance,
      actual: balance ?? '—',
      required: minBalance,
    };
  },
};
