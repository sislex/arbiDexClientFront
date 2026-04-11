import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  ArbiConfigsState,
  ARBI_CONFIGS_FEATURE_KEY,
  arbiConfigsAdapter,
} from './arbi-configs.reducer';

export const selectArbiConfigsState =
  createFeatureSelector<ArbiConfigsState>(ARBI_CONFIGS_FEATURE_KEY);

const { selectAll, selectTotal, selectEntities } =
  arbiConfigsAdapter.getSelectors();

export const selectAllArbiConfigs = createSelector(
  selectArbiConfigsState,
  (s) => selectAll(s.configs),
);

export const selectArbiConfigsTotal = createSelector(
  selectArbiConfigsState,
  (s) => selectTotal(s.configs),
);

export const selectArbiConfigEntities = createSelector(
  selectArbiConfigsState,
  (s) => selectEntities(s.configs),
);

export const selectArbiConfigById = (id: string) =>
  createSelector(selectArbiConfigEntities, (entities) => entities[id] ?? null);

export const selectArbiConfigsLoading = createSelector(
  selectArbiConfigsState,
  (s) => s.loading,
);

export const selectArbiConfigsCreating = createSelector(
  selectArbiConfigsState,
  (s) => s.creating,
);

export const selectArbiConfigsError = createSelector(
  selectArbiConfigsState,
  (s) => s.error,
);

export const selectArbiConfigCurrentPrices = createSelector(
  selectArbiConfigsState,
  (s) => s.currentPrices,
);

export const selectArbiConfigPricesLoading = createSelector(
  selectArbiConfigsState,
  (s) => s.pricesLoading,
);

