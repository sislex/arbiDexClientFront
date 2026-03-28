import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { Source, TradingPair } from '../../../shared/models';
import { MOCK_SOURCES } from '../../../shared/mock-data/mock-sources';
import { MOCK_PAIRS } from '../../../shared/mock-data/mock-pairs';
import { MOCK_CATALOG_LOAD_DELAY_MS } from '../../../shared/constants';
import { ICatalogService } from './catalog.service.interface';

// Ре-экспорт для обратной совместимости импортов
export { ICatalogService } from './catalog.service.interface';

@Injectable()
export class CatalogMockService extends ICatalogService {
  getSources(): Observable<Source[]> {
    return of(MOCK_SOURCES).pipe(delay(MOCK_CATALOG_LOAD_DELAY_MS));
  }
  getPairs(): Observable<TradingPair[]> {
    return of(MOCK_PAIRS).pipe(delay(MOCK_CATALOG_LOAD_DELAY_MS));
  }
}

