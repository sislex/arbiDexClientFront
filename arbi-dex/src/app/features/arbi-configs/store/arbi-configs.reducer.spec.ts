import {
  arbiConfigsReducer,
  initialArbiConfigsState,
  ArbiConfigsState,
} from './arbi-configs.reducer';
import {
  loadArbiConfigs,
  loadArbiConfigsSuccess,
  loadArbiConfigsFailure,
  createArbiConfig,
  createArbiConfigSuccess,
  deleteArbiConfigSuccess,
  loadArbiConfigPrices,
  loadArbiConfigPricesSuccess,
} from './arbi-configs.actions';
import { ArbiConfig } from '../../../shared/models';

const mockConfig: ArbiConfig = {
  id: 'cfg-1',
  name: 'Test',
  tradingSubscriptionId: 'sub-t',
  referenceSubscriptionIds: ['sub-r1'],
  sources: [{ id: 's1', subscriptionId: 'sub-r1' }],
  profitAsset: 'USDC',
  slippage: 0.01,
  initialBalance: 100,
  autoBuyThresholdPct: null,
  autoSellThresholdPct: null,
  trailingTakeProfitPct: null,
  stopLossPct: null,
  tradeAmountPct: 100,
  createdAt: Date.now(),
};

describe('arbiConfigsReducer', () => {
  it('should return initial state', () => {
    const state = arbiConfigsReducer(undefined, { type: 'unknown' });
    expect(state).toEqual(initialArbiConfigsState);
  });

  it('loadArbiConfigs should set loading=true', () => {
    const state = arbiConfigsReducer(initialArbiConfigsState, loadArbiConfigs());
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('loadArbiConfigsSuccess should populate configs', () => {
    const state = arbiConfigsReducer(
      { ...initialArbiConfigsState, loading: true },
      loadArbiConfigsSuccess({ configs: [mockConfig] }),
    );
    expect(state.loading).toBe(false);
    expect(state.configs.ids.length).toBe(1);
  });

  it('loadArbiConfigsFailure should set error', () => {
    const state = arbiConfigsReducer(
      { ...initialArbiConfigsState, loading: true },
      loadArbiConfigsFailure({ error: 'fail' }),
    );
    expect(state.loading).toBe(false);
    expect(state.error).toBe('fail');
  });

  it('createArbiConfig should set creating=true', () => {
    const state = arbiConfigsReducer(
      initialArbiConfigsState,
      createArbiConfig({
        payload: {
          name: 'x',
          tradingSubscriptionId: 't',
          referenceSubscriptionIds: ['r'],
          profitAsset: 'USDC',
          slippage: 0.01,
        },
      }),
    );
    expect(state.creating).toBe(true);
  });

  it('createArbiConfigSuccess should add config', () => {
    const state = arbiConfigsReducer(
      { ...initialArbiConfigsState, creating: true },
      createArbiConfigSuccess({ config: mockConfig }),
    );
    expect(state.creating).toBe(false);
    expect(state.configs.ids).toContain('cfg-1');
  });

  it('deleteArbiConfigSuccess should remove config', () => {
    // First add the config
    let state = arbiConfigsReducer(
      initialArbiConfigsState,
      createArbiConfigSuccess({ config: mockConfig }),
    );
    // Then delete
    state = arbiConfigsReducer(state, deleteArbiConfigSuccess({ id: 'cfg-1' }));
    expect(state.configs.ids).not.toContain('cfg-1');
  });

  it('loadArbiConfigPrices should set pricesLoading', () => {
    const state = arbiConfigsReducer(
      initialArbiConfigsState,
      loadArbiConfigPrices({ id: 'cfg-1' }),
    );
    expect(state.pricesLoading).toBe(true);
    expect(state.currentPrices).toBeNull();
  });

  it('loadArbiConfigPricesSuccess should populate prices', () => {
    const pricesResponse = {
      tradingSubscriptionId: 'sub-t',
      referenceSubscriptionIds: ['sub-r1'],
      prices: {},
    };
    const state = arbiConfigsReducer(
      { ...initialArbiConfigsState, pricesLoading: true },
      loadArbiConfigPricesSuccess({ id: 'cfg-1', pricesResponse }),
    );
    expect(state.pricesLoading).toBe(false);
    expect(state.currentPrices).toEqual(pricesResponse);
  });
});

