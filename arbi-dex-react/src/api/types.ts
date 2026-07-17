import type {
  AutotuneEstimate,
  AutotuneJob,
  AutotuneResult,
  BacktestResult,
  Bot,
  ComputeConfig,
  ComputeNode,
  ExecutorBalances,
  LiveTrade,
  Market,
  MarketConfig,
  QuotePoint,
  Side,
  StepEngineResult,
  StrategyConfig,
  TradingContract,
  User,
  UserToken,
} from '../domain/types';

export type { StepConditionOutcome } from '../domain/types';

/** How to authenticate the wallet: real MetaMask or the dev test key. */
export type WalletMethod = 'metamask' | 'dev';

export interface QuotesParams {
  marketConfigId?: string;
  pairId?: string;
  count?: number;
  intervalSec?: number;
  endTime?: number;
  seed?: string;
}

export interface BacktestParams {
  strategyConfigId: string;
  marketConfigId: string;
  /** Start of the backtest window (timestamp in the data's own unit). */
  from?: number;
  /** End of the backtest window (timestamp in the data's own unit). */
  to?: number;
  initialBalance?: number;
  /** When present (live mode), runs against the bot and updates its demo account. */
  botId?: string;
  /** Autotune-combo coefficients applied over the strategy for this run only. */
  params?: Record<string, number>;
}

/** Bounds of available quote history for a bot's market (for period selection). */
export interface HistoryRange {
  historyFrom: number;
  historyTo: number;
}

/** Engine evaluation of one step (TradingConditionsStepResult + step context). */
export interface BotStepResult extends StepEngineResult {
  /** The resolved (nearest ≤ time) step the strategy was evaluated on. */
  step: QuotePoint;
  /** Index of the evaluated step within the history (0-based). */
  index: number;
  /** Steps available up to the evaluated time. */
  totalSteps: number;
  /** Steps actually fed into processStep (window sized by the bot's conditions).
   * Absent when the breakdown comes from a recorded backtest run. */
  windowSteps?: number;
  historyFrom?: number;
  historyTo?: number;
  /** Server-side computation time, ms (absent for recorded backtest breakdowns). */
  tookMs?: number;
}

/** One reference-market line for the market-config preview. */
export interface PreviewSeries {
  id: string;
  label: string;
  data: { time: number; value: number }[];
}

/** Combined preview for the market-config chart: weighted quotes + per-market lines. */
export interface MarketPreview {
  quotes: QuotePoint[];
  observed: PreviewSeries[];
}

/** Per-direction stats of the follow analysis. */
export interface FollowDirectionStats {
  events: number;
  followed: number;
  followRate: number;
}

/** One significant observed move and whether the trading market followed it. */
export interface FollowEvent {
  time: number;
  direction: 'up' | 'down';
  movedPct: number;
  followed: boolean;
  followedAt: number | null;
  lagSteps: number | null;
  /** Step index within the analyzed period (0-based). */
  index: number;
  observedBefore: number;
  observedAfter: number;
  /** Trading mid before the event (the follow baseline). */
  baseMid: number;
  midAtFollow: number | null;
  /** Strongest same-direction trading move within the window, % (signed). */
  tradingMovePct: number;
}

/** «Как часто торговый рынок следует за наблюдаемыми» over a period. */
export interface FollowAnalysis {
  totalSteps: number;
  events: number;
  followed: number;
  followRate: number;
  up: FollowDirectionStats;
  down: FollowDirectionStats;
  avgLagSteps: number | null;
  avgLagMs: number | null;
  /** Every event in chronological order (for drill-down on the chart). */
  eventList: FollowEvent[];
  movePct: number;
  windowSteps: number;
  from: number;
  to: number;
  historyFrom: number;
  historyTo: number;
  tookMs: number;
}

export interface FollowAnalysisParams {
  movePct?: number;
  window?: number;
  from?: number;
  to?: number;
}

export interface MarketPreviewParams {
  tradingMarketId?: string | null;
  observedMarketIds: string[];
  weights: Record<string, number>;
}

export interface AutotuneParams {
  strategyConfigId: string;
  marketConfigId: string;
  maxCombos?: number;
  /** Start of the tuning window (timestamp in the data's own unit). */
  from?: number;
  /** End of the tuning window (timestamp in the data's own unit). */
  to?: number;
  botId?: string;
  /** Starting balance of each run (quote asset); defaults to the bot's. */
  initialBalance?: number;
}

export interface AutotuneStartParams {
  from?: number;
  to?: number;
  maxCombos?: number;
  initialBalance?: number;
  /** How many pool threads this job may occupy. */
  threads?: number;
  /** Sweep type: 'grid' (plain) or 'refine' (coarse-to-fine rounds). */
  searchType?: 'grid' | 'refine';
}

/** The API facade implemented by both the mock and the live backend clients. */
export interface ApiClient {
  auth: {
    connectWallet(method?: WalletMethod): Promise<User>;
  };
  catalog: {
    markets(): Promise<Market[]>;
  };
  bots: {
    list(): Promise<Bot[]>;
    get(id: string): Promise<Bot | undefined>;
    create(input: Omit<Bot, 'id' | 'createdAt' | 'updatedAt'>): Promise<Bot>;
    update(id: string, patch: Partial<Bot>): Promise<Bot>;
    remove(id: string): Promise<void>;
    /** Bounds of available quote history for the bot's market. */
    historyRange(id: string): Promise<HistoryRange>;
    /** Real historical quotes of the bot's market over [from, to] (no backtest run).
     * `refresh` — re-fetch the config's markets bypassing the server quotes cache.
     * The live backend also returns the (possibly extended) history bounds. */
    quotes(
      id: string,
      params?: { from?: number; to?: number; refresh?: boolean },
    ): Promise<{ quotes: QuotePoint[]; historyFrom?: number; historyTo?: number }>;
    /** Engine evaluation of the bot's strategy on the step at `time` (processStep). */
    stepResult(id: string, params: { time: number }): Promise<BotStepResult>;
    /** Manual live trade (buy/sell button). Demo mode quotes through the executor
     * contract (staticCall), real mode executes on-chain. Live backend only. */
    trade(
      id: string,
      params: { side: Side; expectedPrice?: number; amount?: number },
    ): Promise<{ trade: LiveTrade; bot: Bot }>;
    /** Live-trade log of the bot (successful and failed). */
    trades(id: string): Promise<LiveTrade[]>;
    /** Executor contract balances for the bot's pair tokens (real mode). */
    executorBalance(id: string): Promise<ExecutorBalances>;
    /** Reset the demo account: balance → initial, position/PnL/counters → 0,
     * demo-trade log cleared. Returns the updated bot. */
    resetAccount(id: string): Promise<Bot>;
    /** Autotune estimate: grid size, run count, time forecast (one measured
     * backtest × runs / threads). Does not start the sweep. */
    autotuneEstimate(
      id: string,
      params?: { from?: number; to?: number; maxCombos?: number; threads?: number },
    ): Promise<AutotuneEstimate>;
    /** Start a background autotune; progress streams over the websocket. */
    autotuneStart(id: string, params?: AutotuneStartParams): Promise<AutotuneJob>;
    /** Snapshot of a background autotune job (reconnect after leaving the tab). */
    autotuneJob(id: string, jobId: string): Promise<AutotuneJob>;
  };
  settings: {
    /** Quoter/executor contract entries (many per network; the active one trades). */
    contracts(kind?: 'quoter' | 'executor'): Promise<TradingContract[]>;
    createContract(input: Omit<TradingContract, 'id' | 'isActive'> & { isActive?: boolean }): Promise<TradingContract>;
    updateContract(id: string, patch: Partial<Omit<TradingContract, 'id' | 'kind'>>): Promise<TradingContract>;
    removeContract(id: string): Promise<void>;
    /** Token mapping: network, contract address, display symbol, decimals. */
    tokens(): Promise<UserToken[]>;
    createToken(input: Omit<UserToken, 'id'>): Promise<UserToken>;
    updateToken(id: string, patch: Partial<Omit<UserToken, 'id'>>): Promise<UserToken>;
    removeToken(id: string): Promise<void>;
    /** Additional deployed compute servers (for distributing runs). */
    computeNodes(): Promise<ComputeNode[]>;
    createComputeNode(input: Omit<ComputeNode, 'id'>): Promise<ComputeNode>;
    updateComputeNode(id: string, patch: Partial<Omit<ComputeNode, 'id'>>): Promise<ComputeNode>;
    removeComputeNode(id: string): Promise<void>;
  };
  compute: {
    /** All the user's compute jobs: running, queued, paused, finished. */
    jobs(): Promise<AutotuneJob[]>;
    pause(jobId: string): Promise<AutotuneJob>;
    resume(jobId: string): Promise<AutotuneJob>;
    /** Delete a job (a running one is cancelled, threads return to the pool). */
    remove(jobId: string): Promise<void>;
    config(): Promise<ComputeConfig>;
    updateConfig(totalThreads: number): Promise<ComputeConfig>;
  };
  marketConfigs: {
    list(): Promise<MarketConfig[]>;
    get(id: string): Promise<MarketConfig | undefined>;
    create(input: Omit<MarketConfig, 'id' | 'createdAt'>): Promise<MarketConfig>;
    update(id: string, patch: Partial<MarketConfig>): Promise<MarketConfig>;
    remove(id: string): Promise<void>;
    /** Bounds of available quote history for the config's trading market. */
    historyRange(id: string): Promise<HistoryRange>;
    /** How often the trading market follows the observed ones over [from, to]. */
    followAnalysis(id: string, params?: FollowAnalysisParams): Promise<FollowAnalysis>;
  };
  strategyConfigs: {
    list(): Promise<StrategyConfig[]>;
    get(id: string): Promise<StrategyConfig | undefined>;
    create(input: Omit<StrategyConfig, 'id' | 'createdAt'>): Promise<StrategyConfig>;
    update(id: string, patch: Partial<StrategyConfig>): Promise<StrategyConfig>;
    remove(id: string): Promise<void>;
  };
  quotes: {
    series(params: QuotesParams): Promise<QuotePoint[]>;
    /** Chart preview for the market-config editor (mock → generated; live → real market-data). */
    marketPreview(params: MarketPreviewParams): Promise<MarketPreview>;
  };
  backtest: {
    run(params: BacktestParams): Promise<BacktestResult>;
  };
  autotune: {
    run(params: AutotuneParams): Promise<AutotuneResult>;
  };
}
