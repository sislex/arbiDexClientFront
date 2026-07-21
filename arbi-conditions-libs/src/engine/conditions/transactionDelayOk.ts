import { lastTransactionTimeBeforeCurrent } from '../helpers';
import type { ConditionDef } from '../types';

/**
 * Enough time has passed since the last buy or sell. `actual` is the elapsed ms
 * (Infinity when there is none in the window).
 */
export const transactionDelayOkCondition: ConditionDef = {
  id: 'transaction_delay_ok',
  window: (strategy, side) => {
    const minMs = strategy[side].minDelayAfterLastFinishedTransactionMs;
    if (minMs <= 0) return {};
    return { durationMs: minMs, toLastTransaction: true };
  },
  evaluate: (ctx, strategy, side) => {
    const minMs = strategy[side].minDelayAfterLastFinishedTransactionMs;
    if (minMs <= 0) return { passed: true };
    const lastTx = lastTransactionTimeBeforeCurrent(ctx.window);
    const sinceMs = lastTx === null
      ? Number.POSITIVE_INFINITY
      : ctx.current.time - lastTx;
    return { passed: sinceMs > minMs, actual: sinceMs, required: minMs };
  },
};
