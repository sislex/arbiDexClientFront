import { lastFinishedTransactionTime, lastStep } from '../helpers';
import type { MarketStep, StrategyEngineConfig } from '../../types';

/**
 * Elapsed time from the most recent `finished` transaction to the current step.
 * +Infinity when the window has no finished transaction.
 */
function sinceLastFinishedMs(steps: MarketStep[]): number {
  const lastFinished = lastFinishedTransactionTime(steps);
  return lastFinished === null
    ? Number.POSITIVE_INFINITY
    : lastStep(steps).time - lastFinished;
}

/** Condition (buy): enough time passed since the last finished transaction. */
export function buyTransactionDelayOk(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return sinceLastFinishedMs(steps) > strategy.buy.minDelayAfterLastFinishedTransactionMs;
}

/** Condition (sell): enough time passed since the last finished transaction. */
export function sellTransactionDelayOk(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return sinceLastFinishedMs(steps) > strategy.sell.minDelayAfterLastFinishedTransactionMs;
}
