import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { Quote } from '../../../shared/models';
import { MOCK_QUOTES } from '../../../shared/mock-data/mock-quotes';
import { MOCK_QUOTES_LOAD_DELAY_MS } from '../../../shared/constants';
import { IQuotesService } from './quotes.service.interface';

// Ре-экспорт для обратной совместимости импортов
export { IQuotesService } from './quotes.service.interface';

@Injectable()
export class QuotesMockService extends IQuotesService {
  getLatestQuotes(): Observable<Quote[]> {
    return of(MOCK_QUOTES).pipe(delay(MOCK_QUOTES_LOAD_DELAY_MS));
  }
}

