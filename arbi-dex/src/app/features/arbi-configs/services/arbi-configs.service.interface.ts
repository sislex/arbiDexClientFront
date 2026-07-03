import { Observable } from 'rxjs';
import { ArbiConfig } from '../../../shared/models';
import { SubscriptionPriceData } from '../../subscriptions/services/prices.service.interface';

/** DTO создания конфига */
export interface CreateArbiConfigPayload {
  name: string;
  tradingSubscriptionId: string;
  referenceSubscriptionIds: string[];
  profitAsset: string;
  slippage: number;
  initialBalance?: number;
  autoBuyThresholdPct?: number | null;
  autoSellThresholdPct?: number | null;
  trailingTakeProfitPct?: number | null;
  stopLossPct?: number | null;
  tradeAmountPct?: number;
}

/** DTO обновления конфига */
export interface UpdateArbiConfigPayload {
  name?: string;
  tradingSubscriptionId?: string;
  referenceSubscriptionIds?: string[];
  profitAsset?: string;
  slippage?: number;
  initialBalance?: number;
  autoBuyThresholdPct?: number | null;
  autoSellThresholdPct?: number | null;
  trailingTakeProfitPct?: number | null;
  stopLossPct?: number | null;
  tradeAmountPct?: number;
}

/** Ответ ценовых данных конфига */
export interface ArbiConfigPricesResponse {
  tradingSubscriptionId: string;
  referenceSubscriptionIds: string[];
  prices: Record<string, SubscriptionPriceData>;
}

/** Запись о сделке из бэктеста */
export interface BacktestTrade {
  id: number;
  step: number;
  time: number;
  direction: 'USDC_TO_WETH' | 'WETH_TO_USDC';
  amountIn: number;
  tokenIn: string;
  amountOut: number;
  tokenOut: string;
  price: number;
  slippage: number;
  reason: string;
}

/** Результат серверного бэктеста */
export interface BacktestResult {
  finalUsdcBalance: number;
  finalWethBalance: number;
  portfolioValue: number;
  initialBalance: number;
  pnl: number;
  pnlPct: number;
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  totalPoints: number;
  trades: BacktestTrade[];
}

/** Котировки на конкретном шаге аналитики */
export interface StepQuotes {
  observedPrice: number;
  buyPrice: number;
  sellPrice: number;
}

/** Результат проверки одного условия аналитики */
export interface ConditionResult {
  id: string;
  type: string;
  passed: boolean;
  thresholdPct: number;
  actualPct: number;
  description?: string;
}

/** Пошаговая аналитика бэктеста */
export interface StepAnalytics {
  time: number;
  index: number;
  quotes: StepQuotes;
  conditions: ConditionResult[];
  action: 'buy' | 'sell' | 'none';
}

/** Статистика по одному условию за весь прогон */
export interface ConditionStat {
  id: string;
  type: string;
  thresholdPct: number;
  passedCount: number;
  failedCount: number;
}

/** Сводная аналитика по всему бэктесту */
export interface BacktestAnalyticsSummary {
  totalSteps: number;
  buySignals: number;
  sellSignals: number;
  txAllowed: number;
  conditionStats: ConditionStat[];
}

/** Результат новой реализации бэктеста: итоги + сводная аналитика + выборка шагов */
export interface BacktestNewResult extends BacktestResult {
  conditions: Array<{
    id: string;
    type: string;
    thresholdPct: number;
    enabled?: boolean;
    description?: string;
  }>;
  /** Сводная аналитика по всем шагам */
  summary: BacktestAnalyticsSummary;
  /** Ограниченная выборка значимых шагов (сигнал/сделка) */
  steps: StepAnalytics[];
  /** Сколько значимых шагов всего (до обрезки лимитом) */
  significantSteps: number;
  /** Была ли выборка steps обрезана */
  stepsTruncated: boolean;
}

export abstract class IArbiConfigsService {
  abstract getAll(): Observable<ArbiConfig[]>;
  abstract getOne(id: string): Observable<ArbiConfig>;
  abstract create(payload: CreateArbiConfigPayload): Observable<ArbiConfig>;
  abstract update(id: string, payload: UpdateArbiConfigPayload): Observable<ArbiConfig>;
  abstract remove(id: string): Observable<void>;
  abstract getPrices(id: string, noCache?: boolean): Observable<ArbiConfigPricesResponse>;
  abstract runBacktest(id: string): Observable<BacktestResult>;
  /** Новая реализация серверного бэктеста (итоги + пошаговая аналитика) */
  abstract runBacktestNew(id: string): Observable<BacktestNewResult>;
}

