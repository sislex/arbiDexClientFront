/**
 * processAllStepsAndRecordResults — full run that records a result per step
 * (public entry point).
 *
 * Runs `processStep` over a growing window and returns `records` pairing each
 * step with its index and result, calling an optional `onRecord` callback as
 * each step is processed (handy for streaming/logging). Each step is evaluated
 * over the window up to and including it.
 *
 * @example
 * import { processAllStepsAndRecordResults } from '@sislex/arbi-conditions-libs';
 *
 * const { records } = processAllStepsAndRecordResults(steps, strategy, {
 *   onRecord: (r) => console.log(r.index, r.result.transaction.buy),
 * });
 */

import { processStep } from '../processStep';
import type {
  MarketStep,
  StrategyEngineConfig,
  TradingConditionsStepResult,
} from '../types';

/** One processed step: its position, the step itself and its condition result. */
export interface StepRecord {
  index: number;
  step: MarketStep;
  result: TradingConditionsStepResult;
}

export interface ProcessAllStepsAndRecordResultsOptions {
  /** Called once per step, in order, right after it is processed. */
  onRecord?: (record: StepRecord) => void;
}

export interface ProcessAllStepsAndRecordResultsOutput {
  records: StepRecord[];
}

export function processAllStepsAndRecordResults(
  steps: MarketStep[],
  strategy: StrategyEngineConfig,
  options: ProcessAllStepsAndRecordResultsOptions = {},
): ProcessAllStepsAndRecordResultsOutput {
  const records: StepRecord[] = [];
  const window: MarketStep[] = [];

  for (const [index, step] of steps.entries()) {
    window.push(step);
    const result = processStep({ steps: window, strategy });
    const record: StepRecord = { index, step, result };
    records.push(record);
    options.onRecord?.(record);
  }

  return { records };
}
