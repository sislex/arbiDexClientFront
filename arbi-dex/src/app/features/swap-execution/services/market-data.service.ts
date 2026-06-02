import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

/** Информация о пуле из arbiDexMarketData (значение ключа bidPool/askPool) */
export interface PoolInfo {
  dex: string;
  version: string;
  poolAddress: string;
}

/** Сторона пула: bid (продажа base) / ask (покупка base) */
export type PoolSide = 'bid' | 'ask';

/**
 * Сервис получения метаданных пула (bidPool/askPool).
 *
 * Запрос идёт через наш backend (`/api/market-data/pool`), который проксирует
 * arbiDexMarketData — это решает проблему CORS при прямом обращении из браузера.
 */
@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** Загружает PoolInfo по sourceId + pairId + стороне. */
  getPool(sourceId: string, pairId: string, side: PoolSide): Observable<PoolInfo> {
    const params = new HttpParams()
      .set('sourceId', sourceId)
      .set('pairId', pairId)
      .set('side', side);

    return this.http.get<PoolInfo>(`${this.apiBaseUrl}/market-data/pool`, { params });
  }
}
