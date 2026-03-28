import { createAction, props } from '@ngrx/store';
import { Quote } from '../../../shared/models';

export const loadLatestQuotes = createAction('[Quotes] Load Latest');
export const loadLatestQuotesSuccess = createAction(
  '[Quotes] Load Latest Success',
  props<{ quotes: Quote[] }>(),
);
export const loadLatestQuotesFailure = createAction(
  '[Quotes] Load Latest Failure',
  props<{ error: string }>(),
);

