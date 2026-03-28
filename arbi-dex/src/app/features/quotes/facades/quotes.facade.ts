import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { loadLatestQuotes } from '../store/quotes.actions';
import {
  selectLatestQuotes,
  selectQuotesLoading,
  selectQuotesError,
  selectQuotesCount,
} from '../store/quotes.selectors';

@Injectable({ providedIn: 'root' })
export class QuotesFacade {
  private readonly store = inject(Store);

  readonly latestQuotes$ = this.store.select(selectLatestQuotes);
  readonly loading$ = this.store.select(selectQuotesLoading);
  readonly error$ = this.store.select(selectQuotesError);
  readonly count$ = this.store.select(selectQuotesCount);

  loadLatest(): void {
    this.store.dispatch(loadLatestQuotes());
  }
}

