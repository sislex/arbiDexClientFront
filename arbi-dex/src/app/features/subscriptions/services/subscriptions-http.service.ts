import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Subscription } from '../../../shared/models';
import { ISubscriptionsService } from './subscriptions.service.interface';
import { API_BASE_URL } from '../../../core/config/api.config';

/** Формат ответа бэкенда (createdAt — ISO-строка) */
interface SubscriptionApiDto {
  id: string;
  userId: string;
  sourceId: string;
  pairId: string;
  enabled: boolean;
  createdAt: string;
}

/** Маппинг бэкенд DTO → фронтенд модель */
function mapSubscription(dto: SubscriptionApiDto): Subscription {
  return {
    id: dto.id,
    sourceId: dto.sourceId,
    pairId: dto.pairId,
    enabled: dto.enabled,
    createdAt: new Date(dto.createdAt).getTime(),
  };
}

@Injectable()
export class SubscriptionsHttpService extends ISubscriptionsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  getAll(): Observable<Subscription[]> {
    return this.http
      .get<SubscriptionApiDto[]>(`${this.apiUrl}/subscriptions`)
      .pipe(map((list) => list.map(mapSubscription)));
  }

  create(sourceId: string, pairId: string): Observable<Subscription> {
    return this.http
      .post<SubscriptionApiDto>(`${this.apiUrl}/subscriptions`, { sourceId, pairId })
      .pipe(map(mapSubscription));
  }

  toggle(id: string): Observable<Subscription> {
    return this.http
      .patch<SubscriptionApiDto>(`${this.apiUrl}/subscriptions/${id}/toggle`, {})
      .pipe(map(mapSubscription));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/subscriptions/${id}`);
  }
}

