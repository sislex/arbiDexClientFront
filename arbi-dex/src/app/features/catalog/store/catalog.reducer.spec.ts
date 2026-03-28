import { catalogReducer, initialCatalogState, sourcesAdapter, pairsAdapter } from './catalog.reducer';
import {
  loadSources, loadSourcesSuccess, loadSourcesFailure,
  loadPairs, loadPairsSuccess,
} from './catalog.actions';
import { MOCK_SOURCES } from '../../../shared/mock-data/mock-sources';
import { MOCK_PAIRS } from '../../../shared/mock-data/mock-pairs';

describe('catalogReducer', () => {
  it('should return initial state', () => {
    const state = catalogReducer(undefined, { type: '@@init' });
    expect(state).toEqual(initialCatalogState);
  });

  it('should set sourcesLoading true on loadSources', () => {
    const state = catalogReducer(initialCatalogState, loadSources());
    expect(state.sourcesLoading).toBe(true);
  });

  it('should populate sources on loadSourcesSuccess', () => {
    const state = catalogReducer(
      initialCatalogState,
      loadSourcesSuccess({ sources: MOCK_SOURCES }),
    );
    const all = sourcesAdapter.getSelectors().selectAll(state.sources);
    expect(all.length).toBe(4);
    expect(state.sourcesLoading).toBe(false);
  });

  it('should set error on loadSourcesFailure', () => {
    const state = catalogReducer(
      initialCatalogState,
      loadSourcesFailure({ error: 'Network error' }),
    );
    expect(state.error).toBe('Network error');
    expect(state.sourcesLoading).toBe(false);
  });

  it('should set pairsLoading true on loadPairs', () => {
    const state = catalogReducer(initialCatalogState, loadPairs());
    expect(state.pairsLoading).toBe(true);
  });

  it('should populate pairs on loadPairsSuccess', () => {
    const state = catalogReducer(
      initialCatalogState,
      loadPairsSuccess({ pairs: MOCK_PAIRS }),
    );
    const all = pairsAdapter.getSelectors().selectAll(state.pairs);
    expect(all.length).toBe(4);
    expect(state.pairsLoading).toBe(false);
  });
});

