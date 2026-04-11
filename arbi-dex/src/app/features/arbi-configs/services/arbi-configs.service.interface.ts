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

export abstract class IArbiConfigsService {
  abstract getAll(): Observable<ArbiConfig[]>;
  abstract getOne(id: string): Observable<ArbiConfig>;
  abstract create(payload: CreateArbiConfigPayload): Observable<ArbiConfig>;
  abstract update(id: string, payload: UpdateArbiConfigPayload): Observable<ArbiConfig>;
  abstract remove(id: string): Observable<void>;
  abstract getPrices(id: string, noCache?: boolean): Observable<ArbiConfigPricesResponse>;
  abstract runBacktest(id: string): Observable<BacktestResult>;
}

