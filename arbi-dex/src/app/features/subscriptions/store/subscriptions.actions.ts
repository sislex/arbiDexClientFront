import { createAction, props } from '@ngrx/store';
import { Subscription, SubscriptionDraft } from '../../../shared/models';

export const addSubscription = createAction(
  '[Subscriptions] Add',
  props<{ sourceId: string; pairId: string }>(),
);
export const addSubscriptionSuccess = createAction(
  '[Subscriptions] Add Success',
  props<{ subscription: Subscription }>(),
);
export const addSubscriptionFailure = createAction(
  '[Subscriptions] Add Failure',
  props<{ error: string }>(),
);

export const removeSubscription = createAction(
  '[Subscriptions] Remove',
  props<{ id: string }>(),
);
export const removeSubscriptionSuccess = createAction(
  '[Subscriptions] Remove Success',
  props<{ id: string }>(),
);
export const removeSubscriptionFailure = createAction(
  '[Subscriptions] Remove Failure',
  props<{ error: string }>(),
);

export const toggleSubscription = createAction(
  '[Subscriptions] Toggle',
  props<{ id: string }>(),
);
export const toggleSubscriptionSuccess = createAction(
  '[Subscriptions] Toggle Success',
  props<{ subscription: Subscription }>(),
);
export const toggleSubscriptionFailure = createAction(
  '[Subscriptions] Toggle Failure',
  props<{ error: string }>(),
);

export const setDraft = createAction(
  '[Subscriptions] Set Draft',
  props<{ draft: SubscriptionDraft }>(),
);

export const clearDraft = createAction('[Subscriptions] Clear Draft');

export const loadSubscriptions = createAction('[Subscriptions] Load');
export const loadSubscriptionsSuccess = createAction(
  '[Subscriptions] Load Success',
  props<{ subscriptions: Subscription[] }>(),
);
export const loadSubscriptionsFailure = createAction(
  '[Subscriptions] Load Failure',
  props<{ error: string }>(),
);

