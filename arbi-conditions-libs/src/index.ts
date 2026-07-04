export type {
  ConditionType,
  AnalyticsCondition,
  ConditionsConfig,
  PriceContext,
} from './conditions/types';

export {
  evaluateCondition,
  evaluateConfig,
  allConditionsMet,
  type ConditionResult,
} from './conditions/evaluate';

// ── Strategy engine ──────────────────────────────────────────────────────
export type {
  AvgObservedHigherThanForLastStepsConfig,
  BuyTradingConditionsConfig,
  SellTradingConditionsConfig,
  StrategyEngineConfig,
  TransactionEvent,
  MarketStep,
  ProcessStepParams,
  TradingConditionsStepResult,
  Side,
  PositionState,
  WindowRequirement,
  EvalContext,
  ConditionOutcome,
  ConditionOutcomes,
  ConditionId,
  ConditionDef,
} from './engine/types';

export { CONDITIONS } from './engine/conditions';
export { processStep, evaluateSide } from './engine/processStep';
export { prepareSteps } from './engine/prepareSteps';
export {
  processAllStepsAndRecordResults,
  type StepRecord,
  type ProcessAllStepsAndRecordResultsOptions,
  type ProcessAllStepsAndRecordResultsOutput,
} from './engine/processAllStepsAndRecordResults';
