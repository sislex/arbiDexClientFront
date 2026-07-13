/**
 * Domain types for the demo engine. Kept byte-compatible with the React
 * frontend's `arbi-dex-react/src/domain/types.ts` so server responses map to
 * the client with no transformation.
 */

export type Side = 'buy' | 'sell';
export type BotStatus = 'running' | 'paused' | 'stopped' | 'error';
export type TradingMode = 'demo-live' | 'real-live' | 'idle';

export interface QuotePoint {
  time: number;
  buyQuote: number;
  sellQuote: number;
  avgObservedQuote: number;
}

export interface TuneRange {
  min: number;
  max: number;
  step: number;
  enabled: boolean;
}

export interface StrategyConditionValue {
  conditionId: string;
  enabled: boolean;
  params: Record<string, number | boolean>;
  tuneRanges: Record<string, TuneRange>;
}

export interface StrategyConfigData {
  buy: StrategyConditionValue[];
  sell: StrategyConditionValue[];
}

export interface Trade {
  id: string;
  time: number;
  side: Side;
  price: number;
  amount: number;
  pnl?: number;
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

export interface AutotuneCombo {
  id: string;
  params: Record<string, number>;
  stats: BacktestStats;
}

export interface AutotuneResult {
  id: string;
  totalCombos: number;
  combos: AutotuneCombo[];
  best: AutotuneCombo | null;
}

export interface Market {
  id: string;
  sourceId: string;
  sourceName: string;
  kind: 'cex' | 'dex';
  pairId: string;
  base: string;
  quote: string;
}
