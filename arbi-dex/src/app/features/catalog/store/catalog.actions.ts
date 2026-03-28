import { createAction, props } from '@ngrx/store';
import { Source, TradingPair } from '../../../shared/models';

export const loadSources = createAction('[Catalog] Load Sources');
export const loadSourcesSuccess = createAction(
  '[Catalog] Load Sources Success',
  props<{ sources: Source[] }>(),
);
export const loadSourcesFailure = createAction(
  '[Catalog] Load Sources Failure',
  props<{ error: string }>(),
);

export const loadPairs = createAction('[Catalog] Load Pairs');
export const loadPairsSuccess = createAction(
  '[Catalog] Load Pairs Success',
  props<{ pairs: TradingPair[] }>(),
);
export const loadPairsFailure = createAction(
  '[Catalog] Load Pairs Failure',
  props<{ error: string }>(),
);

