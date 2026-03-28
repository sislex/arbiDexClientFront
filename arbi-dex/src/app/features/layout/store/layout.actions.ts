import { createAction, props } from '@ngrx/store';
import { AppTheme, AppDensity } from '../../../shared/models';

export const toggleSidebar = createAction('[Layout] Toggle Sidebar');
export const setSidebarOpen = createAction(
  '[Layout] Set Sidebar Open',
  props<{ opened: boolean }>(),
);
export const setTheme = createAction(
  '[Layout] Set Theme',
  props<{ theme: AppTheme }>(),
);
export const setDensity = createAction(
  '[Layout] Set Density',
  props<{ density: AppDensity }>(),
);

