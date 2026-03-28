import { Observable } from 'rxjs';
import { Subscription } from '../../../shared/models';

export abstract class ISubscriptionsService {
  /** Получить все подписки пользователя */
  abstract getAll(): Observable<Subscription[]>;

  /** Создать подписку на пару в источнике */
  abstract create(sourceId: string, pairId: string): Observable<Subscription>;

  /** Переключить активность подписки */
  abstract toggle(id: string): Observable<Subscription>;

  /** Удалить подписку */
  abstract remove(id: string): Observable<void>;
}

