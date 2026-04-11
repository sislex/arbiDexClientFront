import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { ArbiConfig } from '../../../shared/models';
import { ArbiConfigPricesResponse, BacktestResult } from '../services/arbi-configs.service.interface';
import {
  loadArbiConfigs,
  loadArbiConfigsSuccess,
  loadArbiConfigsFailure,
  loadArbiConfig,
  loadArbiConfigSuccess,
  loadArbiConfigFailure,
  createArbiConfig,
  createArbiConfigSuccess,
  createArbiConfigFailure,
  updateArbiConfigSuccess,
  deleteArbiConfigSuccess,
  loadArbiConfigPrices,
  loadArbiConfigPricesSuccess,
  loadArbiConfigPricesFailure,
  runBacktest,
  runBacktestSuccess,
  runBacktestFailure,
  clearBacktestResult,
} from './arbi-configs.actions';

export const ARBI_CONFIGS_FEATURE_KEY = 'arbiConfigs';

export const arbiConfigsAdapter: EntityAdapter<ArbiConfig> =
  createEntityAdapter<ArbiConfig>();

export interface ArbiConfigsState {
  configs: EntityState<ArbiConfig>;
  loading: boolean;
  creating: boolean;
  error: string | null;
  /** Ценовые данные для текущего открытого конфига */
  currentPrices: ArbiConfigPricesResponse | null;
  pricesLoading: boolean;
  /** Результат серверного бэктеста */
  backtestResult: BacktestResult | null;
  backtestLoading: boolean;
}

export const initialArbiConfigsState: ArbiConfigsState = {
  configs: arbiConfigsAdapter.getInitialState(),
  loading: false,
  creating: false,
  error: null,
  currentPrices: null,
  pricesLoading: false,
  backtestResult: null,
  backtestLoading: false,
};

export const arbiConfigsReducer = createReducer(
  initialArbiConfigsState,

  // Load all
  on(loadArbiConfigs, (state) => ({ ...state, loading: true, error: null })),
  on(loadArbiConfigsSuccess, (state, { configs }) => ({
    ...state,
    configs: arbiConfigsAdapter.setAll(configs, state.configs),
    loading: false,
  })),
  on(loadArbiConfigsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Load one
  on(loadArbiConfig, (state) => ({ ...state, loading: true, error: null })),
  on(loadArbiConfigSuccess, (state, { config }) => ({
    ...state,
    configs: arbiConfigsAdapter.upsertOne(config, state.configs),
    loading: false,
  })),
  on(loadArbiConfigFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Create
  on(createArbiConfig, (state) => ({ ...state, creating: true, error: null })),
  on(createArbiConfigSuccess, (state, { config }) => ({
    ...state,
    configs: arbiConfigsAdapter.addOne(config, state.configs),
    creating: false,
  })),
  on(createArbiConfigFailure, (state, { error }) => ({
    ...state,
    creating: false,
    error,
  })),

  // Update
  on(updateArbiConfigSuccess, (state, { config }) => ({
    ...state,
    configs: arbiConfigsAdapter.upsertOne(config, state.configs),
  })),

  // Delete
  on(deleteArbiConfigSuccess, (state, { id }) => ({
    ...state,
    configs: arbiConfigsAdapter.removeOne(id, state.configs),
  })),

  // Prices
  on(loadArbiConfigPrices, (state) => ({
    ...state,
    pricesLoading: true,
    currentPrices: null,
  })),
  on(loadArbiConfigPricesSuccess, (state, { pricesResponse }) => ({
    ...state,
    currentPrices: pricesResponse,
    pricesLoading: false,
  })),
  on(loadArbiConfigPricesFailure, (state, { error }) => ({
    ...state,
    pricesLoading: false,
    error,
  })),

  // Backtest
  on(runBacktest, (state) => ({
    ...state,
    backtestLoading: true,
    backtestResult: null,
    error: null,
  })),
  on(runBacktestSuccess, (state, { result }) => ({
    ...state,
    backtestResult: result,
    backtestLoading: false,
  })),
  on(runBacktestFailure, (state, { error }) => ({
    ...state,
    backtestLoading: false,
    error,
  })),
  on(clearBacktestResult, (state) => ({
    ...state,
    backtestResult: null,
    backtestLoading: false,
  })),
);

