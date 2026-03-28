import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Subscription } from '../../../shared/models';
import { ISubscriptionsService } from './subscriptions.service.interface';

@Injectable()
export class SubscriptionsMockService extends ISubscriptionsService {
  private store: Subscription[] = [];

  getAll(): Observable<Subscription[]> {
    return of([...this.store]).pipe(delay(300));
  }

  create(sourceId: string, pairId: string): Observable<Subscription> {
    const sub: Subscription = {
      id: uuidv4(),
      sourceId,
      pairId,
      enabled: true,
      createdAt: Date.now(),
    };
    this.store.push(sub);
    return of(sub).pipe(delay(300));
  }

  toggle(id: string): Observable<Subscription> {
    const sub = this.store.find((s) => s.id === id);
    if (!sub) throw new Error(`Подписка ${id} не найдена`);
    sub.enabled = !sub.enabled;
    return of({ ...sub }).pipe(delay(200));
  }

  remove(id: string): Observable<void> {
    this.store = this.store.filter((s) => s.id !== id);
    return of(undefined as void).pipe(delay(200));
  }
}

