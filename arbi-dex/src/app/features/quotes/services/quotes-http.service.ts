import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Quote } from '../../../shared/models';
import { API_BASE_URL } from '../../../core/config/api.config';
import { IQuotesService } from './quotes.service.interface';

@Injectable()
export class QuotesHttpService extends IQuotesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  getLatestQuotes(): Observable<Quote[]> {
    return this.http.get<Quote[]>(`${this.apiUrl}/quotes/latest`);
  }
}

