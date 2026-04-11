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
}

/** DTO обновления конфига */
export interface UpdateArbiConfigPayload {
  name?: string;
  tradingSubscriptionId?: string;
  referenceSubscriptionIds?: string[];
  profitAsset?: string;
  slippage?: number;
  initialBalance?: number;
}

/** Ответ ценовых данных конфига */
export interface ArbiConfigPricesResponse {
  tradingSubscriptionId: string;
  referenceSubscriptionIds: string[];
  prices: Record<string, SubscriptionPriceData>;
}

export abstract class IArbiConfigsService {
  abstract getAll(): Observable<ArbiConfig[]>;
  abstract getOne(id: string): Observable<ArbiConfig>;
  abstract create(payload: CreateArbiConfigPayload): Observable<ArbiConfig>;
  abstract update(id: string, payload: UpdateArbiConfigPayload): Observable<ArbiConfig>;
  abstract remove(id: string): Observable<void>;
  abstract getPrices(id: string): Observable<ArbiConfigPricesResponse>;
}

