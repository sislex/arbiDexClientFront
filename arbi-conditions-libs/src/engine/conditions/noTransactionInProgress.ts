import { isTransactionInProgress } from '../helpers';
import type { ConditionDef } from '../types';

/**
 * No transaction is currently blocking a new trade. Looks across the whole
 * window for an open transaction ('started' with no later 'finished'/'failed').
 */
export const noTransactionInProgressCondition: ConditionDef = {
  id: 'no_transaction_in_progress',
  window: (strategy, side) =>
    strategy[side].requireNoTransactionInProgress ? { toLastTransaction: true } : {},
  evaluate: (ctx, strategy, side) => {
    const inProgress = isTransactionInProgress(ctx.window);
    return {
      passed: !strategy[side].requireNoTransactionInProgress || !inProgress,
      actual: inProgress ? 'in_progress' : 'none',
      required: 'none',
    };
  },
};
