import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ArbiConfig } from '../../../shared/models';
import { API_BASE_URL } from '../../../core/config/api.config';
import {
  IArbiConfigsService,
  CreateArbiConfigPayload,
  UpdateArbiConfigPayload,
  ArbiConfigPricesResponse,
} from './arbi-configs.service.interface';

/** Формат ответа бэкенда — createdAt как ISO-строка */
interface ArbiConfigApiDto {
  id: string;
  userId: string;
  name: string;
  tradingSubscriptionId: string;
  tradingSubscription?: { id: string; sourceId: string; pairId: string };
  profitAsset: string;
  slippage: number;
  initialBalance: number;
  sources: Array<{
    id: string;
    subscriptionId: string;
    subscription?: { id: string; sourceId: string; pairId: string };
  }>;
  createdAt: string;
}

function mapConfig(dto: ArbiConfigApiDto): ArbiConfig {
  return {
    id: dto.id,
    name: dto.name,
    tradingSubscriptionId: dto.tradingSubscriptionId,
    tradingSourceId: dto.tradingSubscription?.sourceId,
    tradingPairId: dto.tradingSubscription?.pairId,
    referenceSubscriptionIds: dto.sources.map((s) => s.subscriptionId),
    sources: dto.sources.map((s) => ({
      id: s.id,
      subscriptionId: s.subscriptionId,
      sourceId: s.subscription?.sourceId,
      pairId: s.subscription?.pairId,
    })),
    profitAsset: dto.profitAsset,
    slippage: +dto.slippage,
    initialBalance: +dto.initialBalance,
    createdAt: new Date(dto.createdAt).getTime(),
  };
}

@Injectable()
export class ArbiConfigsHttpService extends IArbiConfigsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  getAll(): Observable<ArbiConfig[]> {
    return this.http
      .get<ArbiConfigApiDto[]>(`${this.apiUrl}/arbi-configs`)
      .pipe(map((list) => list.map(mapConfig)));
  }

  getOne(id: string): Observable<ArbiConfig> {
    return this.http
      .get<ArbiConfigApiDto>(`${this.apiUrl}/arbi-configs/${id}`)
      .pipe(map(mapConfig));
  }

  create(payload: CreateArbiConfigPayload): Observable<ArbiConfig> {
    return this.http
      .post<ArbiConfigApiDto>(`${this.apiUrl}/arbi-configs`, payload)
      .pipe(map(mapConfig));
  }

  update(id: string, payload: UpdateArbiConfigPayload): Observable<ArbiConfig> {
    return this.http
      .patch<ArbiConfigApiDto>(`${this.apiUrl}/arbi-configs/${id}`, payload)
      .pipe(map(mapConfig));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/arbi-configs/${id}`);
  }

  getPrices(id: string): Observable<ArbiConfigPricesResponse> {
    return this.http.get<ArbiConfigPricesResponse>(
      `${this.apiUrl}/arbi-configs/${id}/prices`,
    );
  }
}

