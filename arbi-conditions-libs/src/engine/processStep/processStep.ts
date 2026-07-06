/**
 * processStep — evaluate the current step against the strategy (engine core).
 *
 * The current step is `steps[currentIndex]` (defaults to the LAST element);
 * steps after it are treated as future and ignored, and the earlier steps feed
 * the lookback conditions.
 *
 * Two condition kinds:
 * - GATE conditions (from `conditions`, default `CONDITIONS`) are evaluated for
 *   both sides and AND-ed → `transaction.buy` / `transaction.sell`.
 * - TRIGGER conditions (from `triggerConditions`, default `TRIGGER_CONDITIONS`)
 *   are evaluated on the sell side and OR-ed → `transaction.forcedSell` (stop-loss,
 *   trailing take-profit, max holding time). Their per-condition outcomes are
 *   merged into `condition.sell`.
 *
 * Pure and framework-agnostic. Throws when the resulting window is empty.
 *
 * @example
 * import { processStep } from '@sislex/arbi-conditions-libs';
 *
 * const result = processStep({ steps: window, strategy, position });
 * result.transaction.buy;              // all buy gates passed?
 * result.transaction.forcedSell;       // a sell trigger fired?
 * result.condition.buy.spread_ok;      // { passed, actual, required }
 */

import { CONDITIONS, TRIGGER_CONDITIONS } from '../conditions';
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
 * Evaluate every GATE condition for one side and AND the results. Pure function
 * of its inputs; `conditions` defaults to the built-in registry so callers can
 * pass a custom set. The loop never short-circuits — `outcomes` always holds the
 * full per-condition breakdown.
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

/**
 * Evaluate sell TRIGGER conditions and OR their `passed` into a forced-sell flag.
 * Triggers are always evaluated on the sell side; their outcomes are returned for
 * merging into the sell breakdown.
 */
export function evaluateTriggers(
  ctx: EvalContext,
  strategy: StrategyEngineConfig,
  triggers: ConditionDef[] = TRIGGER_CONDITIONS,
): { outcomes: ConditionOutcomes; forced: boolean } {
  const outcomes = {} as ConditionOutcomes;
  let forced = false;
  for (const def of triggers) {
    const outcome = def.evaluate(ctx, strategy, 'sell');
    outcomes[def.id] = outcome;
    if (outcome.passed) forced = true; // OR
  }
  return { outcomes, forced };
}

export function processStep({
  steps,
  strategy,
  currentIndex,
  position,
  conditions = CONDITIONS,
  triggerConditions = TRIGGER_CONDITIONS,
}: ProcessStepParams): TradingConditionsStepResult {
  // Everything up to and including the current step; later steps are the future.
  const window = currentIndex === undefined ? steps : steps.slice(0, currentIndex + 1);
  const current = lastStep(window);
  const ctx: EvalContext = { window, current, position: position ?? null };

  const buy = evaluateSide(ctx, strategy, 'buy', conditions);
  const sell = evaluateSide(ctx, strategy, 'sell', conditions);
  const triggers = evaluateTriggers(ctx, strategy, triggerConditions);

  // Trigger outcomes live alongside the sell gate outcomes in condition.sell.
  const sellOutcomes = { ...sell.outcomes, ...triggers.outcomes } as ConditionOutcomes;

  return {
    transaction: {
      buy: buy.passed,
      sell: sell.passed,
      forcedSell: triggers.forced,
    },
    condition: {
      buy: buy.outcomes,
      sell: sellOutcomes,
    },
    meta: {
      lastStepTime: current.time,
      transactionInProgress: isTransactionInProgress(window),
      lastFinishedTransactionTime: lastFinishedTransactionTime(window),
    },
  };
}
