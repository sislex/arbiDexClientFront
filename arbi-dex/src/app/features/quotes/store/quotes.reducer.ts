import { createReducer, on } from '@ngrx/store';
import { Quote } from '../../../shared/models';
import {
  loadLatestQuotes,
  loadLatestQuotesSuccess,
  loadLatestQuotesFailure,
} from './quotes.actions';

export const QUOTES_FEATURE_KEY = 'quotes';

export interface QuotesState {
  latestQuotes: Quote[];
  loading: boolean;
  error: string | null;
}

export const initialQuotesState: QuotesState = {
  latestQuotes: [],
  loading: false,
  error: null,
};

export const quotesReducer = createReducer(
  initialQuotesState,

  on(loadLatestQuotes, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(loadLatestQuotesSuccess, (state, { quotes }) => ({
    ...state,
    latestQuotes: quotes,
    loading: false,
  })),

  on(loadLatestQuotesFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
);

