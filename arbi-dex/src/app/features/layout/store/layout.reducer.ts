import { createReducer, on } from '@ngrx/store';
import { LayoutState } from '../../../shared/models';
import { toggleSidebar, setSidebarOpen, setTheme, setDensity } from './layout.actions';

export const LAYOUT_FEATURE_KEY = 'layout';

export const initialLayoutState: LayoutState = {
  sidebarOpened: true,
  theme: 'light',
  density: 'default',
};

export const layoutReducer = createReducer(
  initialLayoutState,
  on(toggleSidebar, (state) => ({
    ...state,
    sidebarOpened: !state.sidebarOpened,
  })),
  on(setSidebarOpen, (state, { opened }) => ({
    ...state,
    sidebarOpened: opened,
  })),
  on(setTheme, (state, { theme }) => ({ ...state, theme })),
  on(setDensity, (state, { density }) => ({ ...state, density })),
);

