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
}

/** Per-step breakdown of all conditions and the resulting transaction intent. */
export interface TradingConditionsStepResult {
  transaction: {
    buy: boolean;
    sell: boolean;
  };
  condition: {
    buy: {
      enabled: boolean;
      no_transaction_in_progress: boolean;
      avg_observed_higher_than_buy: boolean;
      avg_observed_higher_than_buy_for_last_steps: boolean;
      spread_ok: boolean;
      last_finished_transaction_delay_ok: boolean;
      token1_balance_ok: boolean;
    };
    sell: {
      enabled: boolean;
      no_transaction_in_progress: boolean;
      avg_observed_higher_than_sell: boolean;
      avg_observed_higher_than_sell_for_last_steps: boolean;
      spread_ok: boolean;
      last_finished_transaction_delay_ok: boolean;
      token2_balance_ok: boolean;
    };
  };
  meta: {
    lastStepTime: number;
    transactionInProgress: boolean;
    lastFinishedTransactionTime: number | null;
  };
}
