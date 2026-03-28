import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ISubscriptionsService } from '../services/subscriptions.service.interface';
import {
  addSubscription,
  addSubscriptionSuccess,
  addSubscriptionFailure,
  removeSubscription,
  removeSubscriptionSuccess,
  removeSubscriptionFailure,
  toggleSubscription,
  toggleSubscriptionSuccess,
  toggleSubscriptionFailure,
  loadSubscriptions,
  loadSubscriptionsSuccess,
  loadSubscriptionsFailure,
} from './subscriptions.actions';

@Injectable()
export class SubscriptionsEffects {
  private readonly actions$ = inject(Actions);
  private readonly service = inject(ISubscriptionsService);

  loadSubscriptions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadSubscriptions),
      switchMap(() =>
        this.service.getAll().pipe(
          map((subscriptions) => loadSubscriptionsSuccess({ subscriptions })),
          catchError((err: unknown) =>
            of(loadSubscriptionsFailure({ error: String(err) })),
          ),
        ),
      ),
    ),
  );

  addSubscription$ = createEffect(() =>
    this.actions$.pipe(
      ofType(addSubscription),
      switchMap(({ sourceId, pairId }) =>
        this.service.create(sourceId, pairId).pipe(
          map((subscription) => addSubscriptionSuccess({ subscription })),
          catchError((err: unknown) =>
            of(addSubscriptionFailure({ error: String(err) })),
          ),
        ),
      ),
    ),
  );

  toggleSubscription$ = createEffect(() =>
    this.actions$.pipe(
      ofType(toggleSubscription),
      switchMap(({ id }) =>
        this.service.toggle(id).pipe(
          map((subscription) => toggleSubscriptionSuccess({ subscription })),
          catchError((err: unknown) =>
            of(toggleSubscriptionFailure({ error: String(err) })),
          ),
        ),
      ),
    ),
  );

  removeSubscription$ = createEffect(() =>
    this.actions$.pipe(
      ofType(removeSubscription),
      switchMap(({ id }) =>
        this.service.remove(id).pipe(
          map(() => removeSubscriptionSuccess({ id })),
          catchError((err: unknown) =>
            of(removeSubscriptionFailure({ error: String(err) })),
          ),
        ),
      ),
    ),
  );
}

