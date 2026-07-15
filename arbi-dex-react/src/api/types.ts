import type {
  AutotuneResult,
  BacktestResult,
  Bot,
  Market,
  MarketConfig,
  QuotePoint,
  StepEngineResult,
  StrategyConfig,
  User,
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
    /** Real historical quotes of the bot's market over [from, to] (no backtest run). */
    quotes(id: string, params?: { from?: number; to?: number }): Promise<{ quotes: QuotePoint[] }>;
    /** Engine evaluation of the bot's strategy on the step at `time` (processStep). */
    stepResult(id: string, params: { time: number }): Promise<BotStepResult>;
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
