import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map, switchMap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Subscription } from '../../../shared/models';
import {
  addSubscription,
  addSubscriptionSuccess,
  loadSubscriptions,
  loadSubscriptionsSuccess,
} from './subscriptions.actions';

@Injectable()
export class SubscriptionsEffects {
  private readonly actions$ = inject(Actions);

  addSubscription$ = createEffect(() =>
    this.actions$.pipe(
      ofType(addSubscription),
      map(({ sourceId, pairId }) => {
        const subscription: Subscription = {
          id: uuidv4(),
          sourceId,
          pairId,
          enabled: true,
          createdAt: Date.now(),
        };
        return addSubscriptionSuccess({ subscription });
      }),
    ),
  );

  // Returns empty list — no persistence in this prototype
  loadSubscriptions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadSubscriptions),
      map(() => loadSubscriptionsSuccess({ subscriptions: [] })),
    ),
  );
}

