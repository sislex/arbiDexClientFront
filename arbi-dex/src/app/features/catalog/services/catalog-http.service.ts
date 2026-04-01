import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Source, TradingPair } from '../../../shared/models';
import { ICatalogService } from './catalog.service.interface';
import { API_BASE_URL } from '../../../core/config/api.config';

@Injectable()
export class CatalogHttpService extends ICatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  getSources(): Observable<Source[]> {
    return this.http.get<Source[]>(`${this.apiUrl}/catalog/sources`);
  }

  getPairs(): Observable<TradingPair[]> {
    return this.http.get<TradingPair[]>(`${this.apiUrl}/catalog/pairs`);
  }

  getPairsBySource(sourceId: string): Observable<TradingPair[]> {
    return this.http.get<TradingPair[]>(`${this.apiUrl}/catalog/sources/${sourceId}/pairs`);
  }
}

