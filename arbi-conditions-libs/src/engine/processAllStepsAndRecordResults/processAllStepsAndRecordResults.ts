/**
 * processAllStepsAndRecordResults — full run that records a result per step
 * (public entry point).
 *
 * Runs `processStep` over a growing window and returns `records` pairing each
 * step with its index and result, calling an optional `onRecord` callback as
 * each step is processed. Each step is evaluated over the window up to and
 * including it. This is a pure "dry" run — it does NOT track a position; the
 * `position`/`conditions`/`triggerConditions` params are passed through to every
 * `processStep` call unchanged (position bookkeeping belongs to the caller).
 *
 * @example
 * import { processAllStepsAndRecordResults } from '@sislex/arbi-conditions-libs';
 *
 * const { records } = processAllStepsAndRecordResults({
 *   steps, strategy,
 *   onRecord: (r) => console.log(r.index, r.result.transaction.buy),
 * });
 */

import { processStep } from '../processStep';
import type {
  ConditionDef,
  MarketStep,
  PositionState,
  StrategyEngineConfig,
  TradingConditionsStepResult,
} from '../types';

/** One processed step: its index, the step itself and its condition result. */
export interface StepRecord {
  index: number;
  step: MarketStep;
  result: TradingConditionsStepResult;
}

export interface ProcessAllStepsAndRecordResultsParams {
  steps: MarketStep[];
  strategy: StrategyEngineConfig;
  /** Passed through to every `processStep` call (not tracked). */
  position?: PositionState | null;
  /** Gate condition set (defaults to the built-in registry). */
  conditions?: ConditionDef[];
  /** Sell trigger condition set (defaults to the built-in registry). */
  triggerConditions?: ConditionDef[];
  /** Called once per step, in order, right after it is processed. */
  onRecord?: (record: StepRecord) => void;
}

export interface ProcessAllStepsAndRecordResultsOutput {
  records: StepRecord[];
}

export function processAllStepsAndRecordResults({
  steps,
  strategy,
  position,
  conditions,
  triggerConditions,
  onRecord,
}: ProcessAllStepsAndRecordResultsParams): ProcessAllStepsAndRecordResultsOutput {
  const records: StepRecord[] = [];
  const window: MarketStep[] = [];

  for (const [index, step] of steps.entries()) {
    window.push(step);
    const result = processStep({ steps: window, strategy, position, conditions, triggerConditions });
    const record: StepRecord = { index, step, result };
    records.push(record);
    onRecord?.(record);
  }

  return { records };
}
