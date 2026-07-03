/**
 * processStepArray — evaluate a whole sequence of steps (public entry point).
 *
 * Walks the steps in order and evaluates each one against the GROWING window of
 * all steps up to and including it, so lookback conditions see the real prior
 * steps. Returns one `TradingConditionsStepResult` per input step (same length,
 * same order). An empty input yields an empty array.
 *
 * @example
 * import { processStepArray } from '@sislex/arbi-conditions-libs';
 *
 * const results = processStepArray(steps, strategy);
 * results[i]; // conditions for steps[i], evaluated over steps[0..i]
 */

import { processStep } from '../processStep';
import type {
  MarketStep,
  StrategyEngineConfig,
  TradingConditionsStepResult,
} from '../types';

export function processStepArray(
  steps: MarketStep[],
  strategy: StrategyEngineConfig,
): TradingConditionsStepResult[] {
  const results: TradingConditionsStepResult[] = [];
  const window: MarketStep[] = [];
  for (const step of steps) {
    window.push(step);
    results.push(processStep(window, strategy));
  }
  return results;
}
