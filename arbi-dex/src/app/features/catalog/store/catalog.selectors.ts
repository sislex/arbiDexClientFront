import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CatalogState, CATALOG_FEATURE_KEY, sourcesAdapter, pairsAdapter } from './catalog.reducer';

export const selectCatalogState =
  createFeatureSelector<CatalogState>(CATALOG_FEATURE_KEY);

const { selectAll: selectAllSources } = sourcesAdapter.getSelectors();
const { selectAll: selectAllPairs } = pairsAdapter.getSelectors();

export const selectSources = createSelector(
  selectCatalogState,
  (s) => selectAllSources(s.sources),
);

export const selectPairs = createSelector(
  selectCatalogState,
  (s) => selectAllPairs(s.pairs),
);

export const selectSourcesLoading = createSelector(
  selectCatalogState,
  (s) => s.sourcesLoading,
);

export const selectPairsLoading = createSelector(
  selectCatalogState,
  (s) => s.pairsLoading,
);

export const selectCatalogLoading = createSelector(
  selectSourcesLoading,
  selectPairsLoading,
  (s, p) => s || p,
);

export const selectSourceById = (id: string) =>
  createSelector(selectSources, (sources) =>
    sources.find((s) => s.id === id),
  );

export const selectPairById = (id: string) =>
  createSelector(selectPairs, (pairs) =>
    pairs.find((p) => p.id === id),
  );

