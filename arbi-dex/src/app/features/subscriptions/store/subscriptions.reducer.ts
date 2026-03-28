import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Subscription, SubscriptionDraft } from '../../../shared/models';
import {
  addSubscriptionSuccess,
  removeSubscription,
  toggleSubscription,
  setDraft,
  clearDraft,
  loadSubscriptionsSuccess,
} from './subscriptions.actions';

export const SUBSCRIPTIONS_FEATURE_KEY = 'subscriptions';

export const subscriptionsAdapter: EntityAdapter<Subscription> =
  createEntityAdapter<Subscription>();

export interface SubscriptionsState {
  saved: EntityState<Subscription>;
  draft: SubscriptionDraft;
  loading: boolean;
}

export const initialSubscriptionsState: SubscriptionsState = {
  saved: subscriptionsAdapter.getInitialState(),
  draft: { sourceId: null, pairId: null },
  loading: false,
};

export const subscriptionsReducer = createReducer(
  initialSubscriptionsState,

  on(loadSubscriptionsSuccess, (state, { subscriptions }) => ({
    ...state,
    saved: subscriptionsAdapter.setAll(subscriptions, state.saved),
    loading: false,
  })),

  on(addSubscriptionSuccess, (state, { subscription }) => ({
    ...state,
    saved: subscriptionsAdapter.addOne(subscription, state.saved),
    draft: { sourceId: null, pairId: null },
  })),

  on(removeSubscription, (state, { id }) => ({
    ...state,
    saved: subscriptionsAdapter.removeOne(id, state.saved),
  })),

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

  on(setDraft, (state, { draft }) => ({ ...state, draft })),
  on(clearDraft, (state) => ({
    ...state,
    draft: { sourceId: null, pairId: null },
  })),
);

