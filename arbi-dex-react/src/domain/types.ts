/** Domain types for the ArbiDex prototype. Framework-agnostic, mirror the
 * server entities and the `arbi-conditions-libs` engine config shapes. */

export type Side = 'buy' | 'sell';
export type BotStatus = 'running' | 'paused' | 'stopped' | 'error';
/** Runtime trading mode of a bot. */
export type TradingMode = 'demo-live' | 'real-live' | 'idle';

// ── Markets / catalog ──────────────────────────────────────────────────────

/** A market = a source (exchange/DEX) + a trading pair. Mirrors a Subscription. */
export interface Market {
  id: string;
  sourceId: string;
  sourceName: string;
  kind: 'cex' | 'dex';
  pairId: string;
  base: string;
  quote: string;
}

// ── Market configuration ─────────────────────────────────────────────────────

export interface MarketConfig {
  id: string;
  name: string;
  /** Market we actually trade on (usually a DEX). */
  tradingMarketId: string;
  /** Reference markets we observe (usually CEXes) → weighted average. */
  observedMarketIds: string[];
  useWeightedAverage: boolean;
  /** Optional per-market weight; equal weight when absent. */
  weights: Record<string, number>;
  createdAt: string;
}

// ── Strategy configuration (conditions + coefficients) ───────────────────────

export interface TuneRange {
  min: number;
  max: number;
  step: number;
  enabled: boolean;
}

/** A condition instance inside a strategy: its coefficients + auto-tune ranges. */
export interface StrategyConditionValue {
  conditionId: string;
  enabled: boolean;
  params: Record<string, number | boolean>;
  /** Auto-tune ranges keyed by numeric param key (feature 8). */
  tuneRanges: Record<string, TuneRange>;
}

export interface StrategyConfig {
  id: string;
  name: string;
  buy: StrategyConditionValue[];
  sell: StrategyConditionValue[];
  createdAt: string;
}

// ── Bots ─────────────────────────────────────────────────────────────────────

export interface Bot {
  id: string;
  name: string;
  status: BotStatus;
  mode: TradingMode;
  marketConfigId: string;
  strategyConfigId: string;
  baseAsset: string;
  quoteAsset: string;
  initialBalance: number;
  balance: number;
  pnl: number;
  pnlPct: number;
  tradesCount: number;
  winRate: number;
  openPosition: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Quotes / market steps ─────────────────────────────────────────────────────

/** One market step: three quotes at a point in time (unix seconds). */
export interface QuotePoint {
  time: number;
  buyQuote: number;
  sellQuote: number;
  avgObservedQuote: number;
}

// ── Trades / backtest ─────────────────────────────────────────────────────────

export interface Trade {
  id: string;
  time: number;
  side: Side;
  price: number;
  amount: number;
  /** Realised PnL of the round-trip, attached to the closing (sell) trade. */
  pnl?: number;
  /** Reason a sell was forced (trigger id), if any. */
  reason?: string;
}

export interface BacktestStats {
  trades: number;
  pnl: number;
  pnlPct: number;
  winRate: number;
  maxDrawdownPct: number;
  finalBalance: number;
}

export interface BacktestResult {
  id: string;
  from: number;
  to: number;
  quotes: QuotePoint[];
  trades: Trade[];
  stats: BacktestStats;
}

// ── Auto-tuning ───────────────────────────────────────────────────────────────

export interface AutotuneCombo {
  id: string;
  /** Flattened coefficient set under test, keyed `side.conditionId.param`. */
  params: Record<string, number>;
  stats: BacktestStats;
}

export interface AutotuneResult {
  id: string;
  totalCombos: number;
  combos: AutotuneCombo[];
  best: AutotuneCombo | null;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  address: string;
  token: string;
  isNew: boolean;
}
