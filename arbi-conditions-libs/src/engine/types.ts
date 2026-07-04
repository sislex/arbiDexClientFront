/**
 * Strategy engine types.
 *
 * Shared, framework-agnostic type definitions for the market-step trading
 * engine. These are the single source of truth reused by every engine entry
 * point (`processStep` and the wrappers built on top of it).
 *
 * Pure TypeScript only — no runtime code lives here.
 */

/** "The observed price stayed higher than the quote for the last N steps" rule. */
export interface AvgObservedHigherThanForLastStepsConfig {
  steps: number;
  percent: number;
}

/** Buy-side trading conditions. */
export interface BuyTradingConditionsConfig {
  enabled: boolean;
  requireNoTransactionInProgress: boolean;
  avgObservedHigherThanBuyPercent: number;
  avgObservedHigherThanBuyForLastSteps: AvgObservedHigherThanForLastStepsConfig;
  maxBuySellSpreadPercent: number;
  minDelayAfterLastFinishedTransactionMs: number;
  requireToken1Balance: boolean;
  minToken1Balance: number;
}

/** Sell-side trading conditions. */
export interface SellTradingConditionsConfig {
  enabled: boolean;
  requireNoTransactionInProgress: boolean;
  avgObservedHigherThanSellPercent: number;
  avgObservedHigherThanSellForLastSteps: AvgObservedHigherThanForLastStepsConfig;
  maxBuySellSpreadPercent: number;
  minDelayAfterLastFinishedTransactionMs: number;
  requireToken2Balance: boolean;
  minToken2Balance: number;
}

/** Full strategy config: buy + sell conditions. */
export interface StrategyEngineConfig {
  buy: BuyTradingConditionsConfig;
  sell: SellTradingConditionsConfig;
}

/** A transaction event attached to a market step. */
export interface TransactionEvent {
  id: string;
  side: 'buy' | 'sell';
  status: 'started' | 'finished' | 'failed';
  txHash?: string;
  error?: string;
}

/** One market step fed into the engine. */
export interface MarketStep {
  time: number;
  quotes: {
    buyQuote: number;
    sellQuote: number;
    avgObservedQuote: number;
  };
  events?: {
    transaction?: TransactionEvent;
  };
  balances?: {
    token1?: number;
    token2?: number;
  };
}

/**
 * Input to the engine: the step window plus the strategy.
 * A single object (rather than positional args) so new fields can be added
 * later without breaking call sites.
 */
export interface ProcessStepParams {
  steps: MarketStep[];
  strategy: StrategyEngineConfig;
  /**
   * Index of the current step within `steps`. Steps after it are treated as
   * future and ignored. Defaults to the last step (`steps.length - 1`).
   */
  currentIndex?: number;
  /**
   * The open position, if any. Passed through the engine so position-aware
   * conditions (take-profit, stop-loss, PnL, max holding time…) can use it.
   * `null`/absent means flat.
   */
  position?: PositionState | null;
  /**
   * Condition set to evaluate. Defaults to the built-in registry `CONDITIONS`.
   * Pass a custom array to add/replace conditions without changing the engine.
   */
  conditions?: ConditionDef[];
}

/** Which side a condition is evaluated for. */
export type Side = 'buy' | 'sell';

/** The currently open position. */
export interface PositionState {
  /** Average price the position was entered at. */
  entryPrice: number;
  /** Position size (in the traded token). */
  size: number;
  /** `time` of the step the position was opened on. */
  openedAt: number;
}

/**
 * How much history a condition needs, so `prepareSteps` can size the window.
 * The engine takes the max over all conditions: the largest `steps`, the
 * largest `durationMs`, and `toLastTransaction` if any condition asks for it.
 */
export interface WindowRequirement {
  /** Count-based lookback: keep at least this many trailing steps. */
  steps?: number;
  /** Time-based lookback: keep steps within this many ms of the current step. */
  durationMs?: number;
  /** Keep steps back to the most recent transaction event. */
  toLastTransaction?: boolean;
}

/** Everything a condition needs to evaluate the current step. */
export interface EvalContext {
  /** Steps up to and including the current one (the window). */
  window: MarketStep[];
  /** The current step (last of `window`). */
  current: MarketStep;
  /** The open position, or `null` when flat. */
  position: PositionState | null;
}

/** Result of evaluating a single condition for one side. */
export interface ConditionOutcome {
  passed: boolean;
  /** Observed value (for UI / debugging), e.g. the current spread. */
  actual?: number | string;
  /** The threshold the value is checked against. */
  required?: number | string;
}

/** Stable identifiers for the built-in conditions. */
export type ConditionId =
  | 'enabled'
  | 'no_transaction_in_progress'
  | 'avg_observed_higher_for_last_steps'
  | 'spread_ok'
  | 'transaction_delay_ok'
  | 'balance_ok';

/**
 * A self-describing condition: it declares how much history it needs
 * (`window`) and how to evaluate itself (`evaluate`). Registering a new
 * condition is the only change needed to extend the engine.
 *
 * `id` accepts any string for custom conditions; built-in ids are suggested.
 */
export interface ConditionDef {
  id: ConditionId | (string & {});
  window(strategy: StrategyEngineConfig, side: Side): WindowRequirement;
  evaluate(ctx: EvalContext, strategy: StrategyEngineConfig, side: Side): ConditionOutcome;
}

/**
 * Per-side map of condition id -> outcome. Built-in ids are always present
 * (non-optional); custom ids are accessed as possibly-undefined.
 */
export type ConditionOutcomes =
  Record<ConditionId, ConditionOutcome> & { [id: string]: ConditionOutcome };

/** Per-step breakdown of all conditions and the resulting transaction intent. */
export interface TradingConditionsStepResult {
  transaction: {
    buy: boolean;
    sell: boolean;
  };
  condition: {
    buy: ConditionOutcomes;
    sell: ConditionOutcomes;
  };
  meta: {
    lastStepTime: number;
    transactionInProgress: boolean;
    lastFinishedTransactionTime: number | null;
  };
}
