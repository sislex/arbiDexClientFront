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
  TradingConditionsStepResult,
} from './engine/types';

export { processStep } from './engine/processStep';
export { processStepArray } from './engine/processStepArray';
export {
  processAllStepsAndRecordResults,
  type StepRecord,
  type ProcessAllStepsAndRecordResultsOptions,
  type ProcessAllStepsAndRecordResultsOutput,
} from './engine/processAllStepsAndRecordResults';
