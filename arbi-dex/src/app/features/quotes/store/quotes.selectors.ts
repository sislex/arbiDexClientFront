import { createFeatureSelector, createSelector } from '@ngrx/store';
import { QuotesState, QUOTES_FEATURE_KEY } from './quotes.reducer';

export const selectQuotesState =
  createFeatureSelector<QuotesState>(QUOTES_FEATURE_KEY);

export const selectLatestQuotes = createSelector(
  selectQuotesState,
  (s) => s.latestQuotes,
);

export const selectQuotesLoading = createSelector(
  selectQuotesState,
  (s) => s.loading,
);

export const selectQuotesError = createSelector(
  selectQuotesState,
  (s) => s.error,
);

export const selectQuotesCount = createSelector(
  selectLatestQuotes,
  (quotes) => quotes.length,
);

export const selectQuotesBySubscription = (sourceId: string, pairId: string) =>
  createSelector(selectLatestQuotes, (quotes) =>
    quotes.filter((q) => q.sourceId === sourceId && q.pairId === pairId),
  );

