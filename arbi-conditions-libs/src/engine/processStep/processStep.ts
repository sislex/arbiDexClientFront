/**
 * processStep — evaluate the current step against the strategy (engine core).
 *
 * The current step is `steps[currentIndex]` (defaults to the LAST element);
 * steps after it are treated as future and ignored, and the earlier steps feed
 * the lookback conditions. Every condition from the registry (or a custom
 * `conditions` array) is evaluated for both sides and AND-ed together; the
 * per-condition breakdown is returned alongside the aggregate
 * `transaction.buy` / `transaction.sell`.
 *
 * Pure and framework-agnostic. Throws when the resulting window is empty.
 *
 * @example
 * import { processStep } from '@sislex/arbi-conditions-libs';
 *
 * const result = processStep({ steps: window, strategy });
 * result.transaction.buy;            // all buy conditions passed?
 * result.condition.buy.spread_ok;    // { passed, actual, required }
 */

import { CONDITIONS } from '../conditions';
import { isTransactionInProgress, lastFinishedTransactionTime, lastStep } from '../helpers';
import type {
  ConditionDef,
  ConditionOutcomes,
  EvalContext,
  ProcessStepParams,
  Side,
  StrategyEngineConfig,
  TradingConditionsStepResult,
} from '../types';

/**
 * Evaluate every condition for one side and AND the results. Pure function of
 * its inputs; `conditions` defaults to the built-in registry so callers can
 * pass a custom set. The loop never short-circuits — `outcomes` always holds
 * the full per-condition breakdown.
 */
export function evaluateSide(
  ctx: EvalContext,
  strategy: StrategyEngineConfig,
  side: Side,
  conditions: ConditionDef[] = CONDITIONS,
): { outcomes: ConditionOutcomes; passed: boolean } {
  const outcomes = {} as ConditionOutcomes;
  let passed = true;
  for (const def of conditions) {
    const outcome = def.evaluate(ctx, strategy, side);
    outcomes[def.id] = outcome;
    if (!outcome.passed) passed = false;
  }
  return { outcomes, passed };
}

export function processStep({
  steps,
  strategy,
  currentIndex,
  position,
  conditions = CONDITIONS,
}: ProcessStepParams): TradingConditionsStepResult {
  // Everything up to and including the current step; later steps are the future.
  const window = currentIndex === undefined ? steps : steps.slice(0, currentIndex + 1);
  const current = lastStep(window);
  const ctx: EvalContext = { window, current, position: position ?? null };

  const buy = evaluateSide(ctx, strategy, 'buy', conditions);
  const sell = evaluateSide(ctx, strategy, 'sell', conditions);

  return {
    transaction: {
      buy: buy.passed,
      sell: sell.passed,
    },
    condition: {
      buy: buy.outcomes,
      sell: sell.outcomes,
    },
    meta: {
      lastStepTime: current.time,
      transactionInProgress: isTransactionInProgress(window),
      lastFinishedTransactionTime: lastFinishedTransactionTime(window),
    },
  };
}
