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

export const removeSubscription = createAction(
  '[Subscriptions] Remove',
  props<{ id: string }>(),
);

export const toggleSubscription = createAction(
  '[Subscriptions] Toggle',
  props<{ id: string }>(),
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

