import {
  subscriptionsReducer,
  initialSubscriptionsState,
  subscriptionsAdapter,
} from './subscriptions.reducer';
import {
  addSubscriptionSuccess,
  removeSubscriptionSuccess,
  toggleSubscription,
  setDraft,
  clearDraft,
} from './subscriptions.actions';
import { Subscription } from '../../../shared/models';

const mockSub: Subscription = {
  id: 'sub-1',
  sourceId: 'cex_binance',
  pairId: 'ETH_USDT',
  enabled: true,
  createdAt: Date.now(),
};

describe('subscriptionsReducer', () => {
  it('should return initial state', () => {
    const state = subscriptionsReducer(undefined, { type: '@@init' });
    expect(state).toEqual(initialSubscriptionsState);
  });

  it('should add subscription on addSubscriptionSuccess', () => {
    const state = subscriptionsReducer(
      initialSubscriptionsState,
      addSubscriptionSuccess({ subscription: mockSub }),
    );
    const all = subscriptionsAdapter.getSelectors().selectAll(state.saved);
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('sub-1');
    expect(state.draft).toEqual({ sourceId: null, pairId: null });
  });

  it('should remove subscription on removeSubscriptionSuccess', () => {
    const stateWithOne = subscriptionsReducer(
      initialSubscriptionsState,
      addSubscriptionSuccess({ subscription: mockSub }),
    );
    const state = subscriptionsReducer(
      stateWithOne,
      removeSubscriptionSuccess({ id: 'sub-1' }),
    );
    const all = subscriptionsAdapter.getSelectors().selectAll(state.saved);
    expect(all.length).toBe(0);
  });

  it('should toggle subscription enabled', () => {
    const stateWithOne = subscriptionsReducer(
      initialSubscriptionsState,
      addSubscriptionSuccess({ subscription: mockSub }),
    );
    const state = subscriptionsReducer(
      stateWithOne,
      toggleSubscription({ id: 'sub-1' }),
    );
    expect(state.saved.entities['sub-1']?.enabled).toBe(false);
  });

  it('should set draft', () => {
    const state = subscriptionsReducer(
      initialSubscriptionsState,
      setDraft({ draft: { sourceId: 'cex_binance', pairId: 'ETH_USDT' } }),
    );
    expect(state.draft.sourceId).toBe('cex_binance');
    expect(state.draft.pairId).toBe('ETH_USDT');
  });

  it('should clear draft', () => {
    const stateWithDraft = subscriptionsReducer(
      initialSubscriptionsState,
      setDraft({ draft: { sourceId: 'cex_binance', pairId: 'ETH_USDT' } }),
    );
    const state = subscriptionsReducer(stateWithDraft, clearDraft());
    expect(state.draft).toEqual({ sourceId: null, pairId: null });
  });
});

