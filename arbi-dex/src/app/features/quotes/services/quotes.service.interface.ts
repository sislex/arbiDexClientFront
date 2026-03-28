import { Observable } from 'rxjs';
import { Quote } from '../../../shared/models';

export abstract class IQuotesService {
  abstract getLatestQuotes(): Observable<Quote[]>;
}

