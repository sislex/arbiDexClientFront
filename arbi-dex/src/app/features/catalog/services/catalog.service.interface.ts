import { Observable } from 'rxjs';
import { Source, TradingPair } from '../../../shared/models';

export abstract class ICatalogService {
  abstract getSources(): Observable<Source[]>;
  abstract getPairs(): Observable<TradingPair[]>;
  abstract getPairsBySource(sourceId: string): Observable<TradingPair[]>;
}

