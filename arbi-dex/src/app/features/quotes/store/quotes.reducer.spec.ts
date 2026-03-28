import { quotesReducer, initialQuotesState } from './quotes.reducer';
import {
  loadLatestQuotes,
  loadLatestQuotesSuccess,
  loadLatestQuotesFailure,
} from './quotes.actions';
import { MOCK_QUOTES } from '../../../shared/mock-data/mock-quotes';

describe('quotesReducer', () => {
  it('should return initial state', () => {
    const state = quotesReducer(undefined, { type: '@@init' });
    expect(state).toEqual(initialQuotesState);
  });

  it('should set loading on loadLatestQuotes', () => {
    const state = quotesReducer(initialQuotesState, loadLatestQuotes());
    expect(state.loading).toBe(true);
  });

  it('should populate quotes on loadLatestQuotesSuccess', () => {
    const state = quotesReducer(
      initialQuotesState,
      loadLatestQuotesSuccess({ quotes: MOCK_QUOTES }),
    );
    expect(state.latestQuotes.length).toBe(16);
    expect(state.loading).toBe(false);
  });

  it('should set error on loadLatestQuotesFailure', () => {
    const state = quotesReducer(
      initialQuotesState,
      loadLatestQuotesFailure({ error: 'Timeout' }),
    );
    expect(state.error).toBe('Timeout');
    expect(state.loading).toBe(false);
  });
});

