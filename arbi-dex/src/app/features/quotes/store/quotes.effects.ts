import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { IQuotesService } from '../services/quotes-mock.service';
import {
  loadLatestQuotes,
  loadLatestQuotesSuccess,
  loadLatestQuotesFailure,
} from './quotes.actions';
import { addSubscriptionSuccess } from '../../subscriptions/store/subscriptions.actions';

@Injectable()
export class QuotesEffects {
  private readonly actions$ = inject(Actions);
  private readonly quotesService = inject(IQuotesService);

  loadLatestQuotes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadLatestQuotes),
      switchMap(() =>
        this.quotesService.getLatestQuotes().pipe(
          map((quotes) => loadLatestQuotesSuccess({ quotes })),
          catchError((err: unknown) =>
            of(loadLatestQuotesFailure({ error: String(err) })),
          ),
        ),
      ),
    ),
  );

  // Reload quotes when a new subscription is added
  reloadOnSubscription$ = createEffect(() =>
    this.actions$.pipe(
      ofType(addSubscriptionSuccess),
      map(() => loadLatestQuotes()),
    ),
  );
}

