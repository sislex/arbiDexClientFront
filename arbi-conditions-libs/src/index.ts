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
  GateConditionId,
  TriggerConditionId,
  ConditionDef,
} from './engine/types';

export {
  CONDITIONS,
  TRIGGER_CONDITIONS,
  enabledCondition,
  noTransactionInProgressCondition,
  avgObservedHigherForLastStepsCondition,
  spreadOkCondition,
  transactionDelayOkCondition,
  balanceOkCondition,
  stopLossCondition,
  trailingTakeProfitCondition,
  maxHoldingTimeCondition,
} from './engine/conditions';
export { processStep, evaluateSide, evaluateTriggers } from './engine/processStep';
export { prepareSteps } from './engine/prepareSteps';
export {
  processAllStepsAndRecordResults,
  type StepRecord,
  type ProcessAllStepsAndRecordResultsParams,
  type ProcessAllStepsAndRecordResultsOutput,
} from './engine/processAllStepsAndRecordResults';
export {
  runBacktest,
  type BacktestTrade,
  type BacktestStats,
  type BacktestConditionStat,
  type BacktestSummary,
  type EngineBacktestResult,
  type BacktestOptions,
} from './engine/runBacktest';
