import { lastFinishedTransactionTime } from '../helpers';
import type { ConditionDef } from '../types';

/**
 * Enough time has passed since the last finished transaction. `actual` is the
 * elapsed ms (Infinity when there is none in the window).
 */
export const transactionDelayOkCondition: ConditionDef = {
  id: 'transaction_delay_ok',
  window: (strategy, side) => ({ durationMs: strategy[side].minDelayAfterLastFinishedTransactionMs }),
  evaluate: (ctx, strategy, side) => {
    const lastFinished = lastFinishedTransactionTime(ctx.window);
    const sinceMs = lastFinished === null
      ? Number.POSITIVE_INFINITY
      : ctx.current.time - lastFinished;
    const minMs = strategy[side].minDelayAfterLastFinishedTransactionMs;
    return { passed: sinceMs > minMs, actual: sinceMs, required: minMs };
  },
};
