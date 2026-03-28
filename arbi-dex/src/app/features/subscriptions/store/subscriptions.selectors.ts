import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  SubscriptionsState,
  SUBSCRIPTIONS_FEATURE_KEY,
  subscriptionsAdapter,
} from './subscriptions.reducer';

export const selectSubscriptionsState =
  createFeatureSelector<SubscriptionsState>(SUBSCRIPTIONS_FEATURE_KEY);

const { selectAll, selectTotal } = subscriptionsAdapter.getSelectors();

export const selectSavedSubscriptions = createSelector(
  selectSubscriptionsState,
  (s) => selectAll(s.saved),
);

export const selectSubscriptionsCount = createSelector(
  selectSubscriptionsState,
  (s) => selectTotal(s.saved),
);

export const selectDraft = createSelector(
  selectSubscriptionsState,
  (s) => s.draft,
);

export const selectDraftIsComplete = createSelector(
  selectDraft,
  (d) => d.sourceId !== null && d.pairId !== null,
);

export const selectSubscriptionsLoading = createSelector(
  selectSubscriptionsState,
  (s) => s.loading,
);

export const selectActiveSubscriptions = createSelector(
  selectSavedSubscriptions,
  (subs) => subs.filter((s) => s.enabled),
);

