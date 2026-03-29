import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { IPricesService, SubscriptionPriceData } from './prices.service.interface';

@Injectable()
export class PricesHttpService extends IPricesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  getPricesBySubscription(subscriptionId: string): Observable<SubscriptionPriceData> {
    return this.http.get<SubscriptionPriceData>(
      `${this.apiUrl}/prices/subscription/${subscriptionId}`,
    );
  }
}

