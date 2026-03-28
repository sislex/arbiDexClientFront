import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Source, TradingPair } from '../../../shared/models';
import {
  loadSources, loadSourcesSuccess, loadSourcesFailure,
  loadPairs, loadPairsSuccess, loadPairsFailure,
} from './catalog.actions';

export const CATALOG_FEATURE_KEY = 'catalog';

export const sourcesAdapter: EntityAdapter<Source> =
  createEntityAdapter<Source>();

export const pairsAdapter: EntityAdapter<TradingPair> =
  createEntityAdapter<TradingPair>();

export interface CatalogState {
  sources: EntityState<Source>;
  pairs: EntityState<TradingPair>;
  sourcesLoading: boolean;
  pairsLoading: boolean;
  error: string | null;
}

export const initialCatalogState: CatalogState = {
  sources: sourcesAdapter.getInitialState(),
  pairs: pairsAdapter.getInitialState(),
  sourcesLoading: false,
  pairsLoading: false,
  error: null,
};

export const catalogReducer = createReducer(
  initialCatalogState,

  on(loadSources, (state) => ({ ...state, sourcesLoading: true })),
  on(loadSourcesSuccess, (state, { sources }) => ({
    ...state,
    sources: sourcesAdapter.setAll(sources, state.sources),
    sourcesLoading: false,
  })),
  on(loadSourcesFailure, (state, { error }) => ({
    ...state, sourcesLoading: false, error,
  })),

  on(loadPairs, (state) => ({ ...state, pairsLoading: true })),
  on(loadPairsSuccess, (state, { pairs }) => ({
    ...state,
    pairs: pairsAdapter.setAll(pairs, state.pairs),
    pairsLoading: false,
  })),
  on(loadPairsFailure, (state, { error }) => ({
    ...state, pairsLoading: false, error,
  })),
);

