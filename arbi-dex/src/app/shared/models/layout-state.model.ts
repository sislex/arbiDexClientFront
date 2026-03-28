export type AppTheme = 'light' | 'dark';
export type AppDensity = 'default' | 'compact';

export interface LayoutState {
  sidebarOpened: boolean;
  theme: AppTheme;
  density: AppDensity;
}

