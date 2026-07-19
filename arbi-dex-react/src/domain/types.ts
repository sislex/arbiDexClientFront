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
  /** Raw arbiDexMarketData key `source|base/quote` (without |bidPrice/|askPrice). */
  storeKey?: string;
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
  /** Allowed slippage for live buy/sell, % (live backend; default 0.5). */
  slippagePct?: number;
  /** Open position size in the base asset (manual live trading). */
  positionSize?: number;
  /** Entry price of the open position (quote per base). */
  entryPrice?: number;
  /** When the bot was switched to running, unix ms (live chart starts here). */
  startedAt?: number;
  /** Last live-engine evaluation of this bot, unix ms (0 = never). */
  lastTickAt?: number;
  /** Last buy/sell signal from the strategy, unix ms (0 = never). */
  lastSignalAt?: number;
  /** Pause after a failed trade until this moment, unix ms. */
  failCooldownUntil?: number;
  /** Current (or last) session totals from the trade journal (server list only). */
  live?: {
    /** Successful live trades (buys + sells). */
    tradesCount: number;
    /** Failed attempts (slippage, missing funds, data outages…). */
    failedCount: number;
    /** Realised PnL — sum of closing sells' PnL, in the balance currency. */
    pnl: number;
    /** PnL as % of the initial deposit. */
    pnlPct: number;
    /** The session the totals belong to (null — the bot never ran). */
    sessionId: string | null;
    sessionStartedAt: number | null;
    sessionActive: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

/** A trading session: opened when the bot starts, closed when it stops. */
export interface BotSession {
  id: string;
  botId: string;
  /** Session start, unix ms. */
  startedAt: number;
  /** Session end, unix ms; 0 — still active. */
  endedAt: number;
  /** Free balance at session start (balance currency). */
  startBalance: number;
  /** Bot mode at start (demo-live / real-live). */
  mode: string;
  active: boolean;
  /** Totals over the session window, from the trade journal. */
  tradesCount: number;
  failedCount: number;
  pnl: number;
  pnlPct: number;
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
  /** Manual live trades only: failed ones are drawn differently on the chart. */
  status?: 'success' | 'failed';
}

/** One manual live trade of a bot (buy/sell button), successful or failed.
 * Mirrors the server's BotTrade entity. */
export interface LiveTrade {
  id: string;
  botId: string;
  /** Trade time, unix ms. */
  time: number;
  side: Side;
  status: 'success' | 'failed';
  mode: 'demo' | 'real';
  /** Executed (quoted) price, quote per base; null when quoting failed. */
  price: number | null;
  /** The quote the user saw when clicking — the slippage baseline. */
  expectedPrice: number | null;
  /** Amount in: quote asset for buys, base asset for sells. */
  amountIn: number;
  amountOut: number | null;
  pnl: number | null;
  /** Failure reason (slippage exceeded / execution error). */
  error: string | null;
  txHash: string;
  txUrl: string;
  /** Step breakdown recorded at decision time (engine trades only) — shown
   * «из истории» like backtest step records; null for manual button trades. */
  stepResult?: Record<string, unknown> | null;
}

export interface BacktestStats {
  trades: number;
  pnl: number;
  pnlPct: number;
  winRate: number;
  maxDrawdownPct: number;
  finalBalance: number;
}

/** Engine outcome of one condition on a step. */
export interface StepConditionOutcome {
  passed: boolean;
  actual?: number;
  required?: number;
}

/** Engine evaluation of one step (mirrors TradingConditionsStepResult). */
export interface StepEngineResult {
  transaction: { buy: boolean; sell: boolean; forcedSell: boolean };
  condition: {
    buy: Record<string, StepConditionOutcome>;
    sell: Record<string, StepConditionOutcome>;
  };
  meta: {
    lastStepTime: number;
    transactionInProgress: boolean;
    lastFinishedTransactionTime: number | null;
  };
}

/** One engine dry-run record (mirrors the library's StepRecord). */
export interface StepRecord {
  index: number;
  step: { time: number; quotes: { buyQuote: number; sellQuote: number; avgObservedQuote: number } };
  result: StepEngineResult;
}

/** Mirrors the library's ProcessAllStepsAndRecordResultsOutput. */
export interface ProcessAllStepsAndRecordResultsOutput {
  records: StepRecord[];
}

export interface BacktestResult {
  id: string;
  from: number;
  to: number;
  quotes: QuotePoint[];
  trades: Trade[];
  stats: BacktestStats;
  /** Engine dry run over every step (live backend only). */
  stepResults?: ProcessAllStepsAndRecordResultsOutput;
  /** Server-side computation time, ms (live backend only). */
  tookMs?: number;
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
  /** How many combos were actually run (≤ gridTotal, limited by the run limit). */
  totalCombos: number;
  /** Full size of the combination grid (live backend / mock). */
  gridTotal?: number;
  combos: AutotuneCombo[];
  best: AutotuneCombo | null;
  /** Server-side computation time, ms (live backend only). */
  tookMs?: number;
}

// ── Trading settings (per-network contracts + token mapping) ─────────────────

/** A user quoter/executor contract entry: network + RPC URL + address. Any
 * number of entries per network; trading uses the network's active one, and
 * with no entries at all the server's .env fallback applies. */
export interface TradingContract {
  id: string;
  kind: 'quoter' | 'executor';
  /** Network prefix: ARBITRUM | OPTIMISM | BASE. */
  network: string;
  name: string;
  rpcUrl: string;
  address: string;
  isActive: boolean;
}

/** User token mapping: network + contract address + display symbol. */
export interface UserToken {
  id: string;
  network: string;
  address: string;
  symbol: string;
  decimals: number;
}

/** Executor contract balances for the bot's pair tokens. */
export interface ExecutorBalances {
  network: string;
  executorAddress: string;
  balances: { symbol: string; address: string; decimals: number; balance: number }[];
}

// ── Autotune estimation / background jobs ────────────────────────────────────

/** Server estimate for an autotune run: grid size, run count and a time
 * forecast (one measured backtest × runs / threads). */
export interface AutotuneEstimate {
  gridTotal: number;
  combosToRun: number;
  dimensions: number;
  steps: number;
  singleRunMs: number;
  threads: number;
  estimatedMs: number;
  from: number;
  to: number;
  searchType: SearchType;
  /** Refine sweep only: rounds and runs per round. */
  rounds: number | null;
  roundSize: number | null;
  /** How long the estimate itself took (data load + one backtest). */
  tookMs: number;
}

export type ComputeJobStatus = 'queued' | 'running' | 'paused' | 'done' | 'error';

/** Sweep type: uniform grid sampling, coarse-to-fine refinement or random search. */
export type SearchType = 'grid' | 'refine' | 'random';

/** Parameters a compute job was started with (for its page / restart). */
export interface ComputeJobParams {
  from: number;
  to: number;
  maxCombos: number;
  initialBalance?: number;
  threads?: number;
  searchType: SearchType;
}

/** Snapshot of a background compute job (streamed over the websocket / listed
 * in the computations menu). */
export interface AutotuneJob {
  jobId: string;
  botId: string;
  /** Human label: bot name + run count. */
  label: string;
  searchType: SearchType;
  params: ComputeJobParams;
  status: ComputeJobStatus;
  total: number;
  done: number;
  gridTotal: number;
  /** Threads requested by the job / busy right now. */
  threadsRequested: number;
  threadsActive: number;
  /** Position in the queue (queued/paused); null otherwise. */
  queuePosition: number | null;
  startedAt: number;
  elapsedMs: number;
  /** Best runs so far (by PnL), capped at 500. */
  topCombos: AutotuneCombo[];
  best: AutotuneCombo | null;
  error: string | null;
  /** Full result — only when status === 'done'. */
  result: (AutotuneResult & { tookMs?: number }) | null;
}

/** Server compute pool: total/busy threads and queue length. */
export interface ComputeConfig {
  totalThreads: number;
  activeThreads: number;
  queuedJobs: number;
}

/** Another deployed arbi-dex-server for distributing parallel runs. */
export interface ComputeNode {
  id: string;
  name: string;
  baseUrl: string;
  threads: number;
  enabled: boolean;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  address: string;
  token: string;
  isNew: boolean;
}
