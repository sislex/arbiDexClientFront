/**
 * prepareSteps — trim a full history down to the minimal window `processStep`
 * needs (public entry point).
 *
 * Takes the same params as `processStep` (the difference is the number of
 * steps: here you pass the WHOLE history) and returns a `ProcessStepParams`
 * whose `steps` is the smallest suffix that still satisfies every strategy
 * condition. Pipe it straight into `processStep`:
 *
 *   processStep(prepareSteps({ steps: history, strategy }));
 *
 * The returned window ends at the current step, so `currentIndex` is dropped
 * (the current step is the last one again).
 *
 * How the required window is derived (max across all conditions; "now" is the
 * current step's `time`):
 * - avgObservedHigher*ForLastSteps → the last `steps` entries (max of buy/sell).
 * - minDelayAfterLastFinishedTransactionMs → steps within that delay of now
 *   (correctness-preserving vs the full history).
 * - requireNoTransactionInProgress → back to the most recent transaction event
 *   (assumes at most one transaction is ever in flight — the engine's own
 *   invariant). Only applied when a side requires it.
 * - enabled / spread / balance → the current step only.
 *
 * If the history is shorter than a condition needs, all available steps are
 * kept and `processStep` reports that condition as unmet, as usual.
 */

import type { MarketStep, ProcessStepParams } from '../types';

export function prepareSteps({
  steps,
  strategy,
  currentIndex,
}: ProcessStepParams): ProcessStepParams {
  if (steps.length === 0) return { steps, strategy };

  const lastIndex = steps.length - 1;
  const ci = Math.min(Math.max(currentIndex ?? lastIndex, 0), lastIndex);
  const history = steps.slice(0, ci + 1); // drop future steps
  const last = history.length - 1;
  const current = history[last] as MarketStep;

  // Default: only the current step is needed.
  let keepFrom = last;

  // avgObservedHigher*ForLastSteps — count-based lookback.
  const neededSteps = Math.max(
    1,
    Math.floor(strategy.buy.avgObservedHigherThanBuyForLastSteps.steps),
    Math.floor(strategy.sell.avgObservedHigherThanSellForLastSteps.steps),
  );
  keepFrom = Math.min(keepFrom, Math.max(0, last - (neededSteps - 1)));

  // minDelayAfterLastFinishedTransactionMs — time-based lookback.
  const maxDelayMs = Math.max(
    strategy.buy.minDelayAfterLastFinishedTransactionMs,
    strategy.sell.minDelayAfterLastFinishedTransactionMs,
  );
  if (maxDelayMs > 0) {
    const cutoff = current.time - maxDelayMs;
    const idx = history.findIndex((s) => s.time >= cutoff);
    if (idx >= 0) keepFrom = Math.min(keepFrom, idx);
  }

  // requireNoTransactionInProgress — back to the most recent transaction event.
  if (strategy.buy.requireNoTransactionInProgress || strategy.sell.requireNoTransactionInProgress) {
    for (let i = last; i >= 0; i -= 1) {
      if (history[i]?.events?.transaction) {
        keepFrom = Math.min(keepFrom, i);
        break;
      }
    }
  }

  return { steps: history.slice(keepFrom), strategy };
}
