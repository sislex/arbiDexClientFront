import { createFeatureSelector, createSelector } from '@ngrx/store';
import { LayoutState } from '../../../shared/models';
import { LAYOUT_FEATURE_KEY } from './layout.reducer';

export const selectLayoutState =
  createFeatureSelector<LayoutState>(LAYOUT_FEATURE_KEY);

export const selectSidebarOpened = createSelector(
  selectLayoutState, (s) => s.sidebarOpened,
);
export const selectTheme = createSelector(
  selectLayoutState, (s) => s.theme,
);
export const selectDensity = createSelector(
  selectLayoutState, (s) => s.density,
);

