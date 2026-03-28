import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Subscription, SubscriptionDraft } from '../../../shared/models';
import {
  addSubscription,
  addSubscriptionSuccess,
  addSubscriptionFailure,
  removeSubscriptionSuccess,
  removeSubscriptionFailure,
  toggleSubscription,
  toggleSubscriptionSuccess,
  toggleSubscriptionFailure,
  setDraft,
  clearDraft,
  loadSubscriptions,
  loadSubscriptionsSuccess,
  loadSubscriptionsFailure,
} from './subscriptions.actions';

export const SUBSCRIPTIONS_FEATURE_KEY = 'subscriptions';

export const subscriptionsAdapter: EntityAdapter<Subscription> =
  createEntityAdapter<Subscription>();

export interface SubscriptionsState {
  saved: EntityState<Subscription>;
  draft: SubscriptionDraft;
  loading: boolean;
  error: string | null;
}

export const initialSubscriptionsState: SubscriptionsState = {
  saved: subscriptionsAdapter.getInitialState(),
  draft: { sourceId: null, pairId: null },
  loading: false,
  error: null,
};

export const subscriptionsReducer = createReducer(
  initialSubscriptionsState,

  on(loadSubscriptions, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(loadSubscriptionsSuccess, (state, { subscriptions }) => ({
    ...state,
    saved: subscriptionsAdapter.setAll(subscriptions, state.saved),
    loading: false,
  })),

  on(loadSubscriptionsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(addSubscription, (state) => ({
    ...state,
    error: null,
  })),

  on(addSubscriptionSuccess, (state, { subscription }) => ({
    ...state,
    saved: subscriptionsAdapter.addOne(subscription, state.saved),
    draft: { sourceId: null, pairId: null },
  })),

  on(addSubscriptionFailure, (state, { error }) => ({
    ...state,
    error,
  })),

  on(removeSubscriptionSuccess, (state, { id }) => ({
    ...state,
    saved: subscriptionsAdapter.removeOne(id, state.saved),
  })),

  on(removeSubscriptionFailure, (state, { error }) => ({
    ...state,
    error,
  })),

  // Оптимистичный toggle — переключаем сразу, откатываем при ошибке
  on(toggleSubscription, (state, { id }) => ({
    ...state,
    saved: subscriptionsAdapter.updateOne(
      {
        id,
        changes: {
          enabled: !state.saved.entities[id]?.enabled,
        },
      },
      state.saved,
    ),
  })),

  on(toggleSubscriptionSuccess, (state, { subscription }) => ({
    ...state,
    saved: subscriptionsAdapter.updateOne(
      {
        id: subscription.id,
        changes: { enabled: subscription.enabled },
      },
      state.saved,
    ),
  })),

  on(toggleSubscriptionFailure, (state, { error }) => ({
    ...state,
    error,
  })),

  on(setDraft, (state, { draft }) => ({ ...state, draft })),
  on(clearDraft, (state) => ({
    ...state,
    draft: { sourceId: null, pairId: null },
  })),
);

