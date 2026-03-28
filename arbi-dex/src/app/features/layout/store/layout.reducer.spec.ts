import { layoutReducer, initialLayoutState } from './layout.reducer';
import { toggleSidebar, setSidebarOpen, setTheme, setDensity } from './layout.actions';

describe('layoutReducer', () => {
  it('should return initial state', () => {
    const state = layoutReducer(undefined, { type: '@@init' });
    expect(state).toEqual(initialLayoutState);
  });

  it('should toggle sidebar', () => {
    const state = layoutReducer(initialLayoutState, toggleSidebar());
    expect(state.sidebarOpened).toBe(false);
    const toggled = layoutReducer(state, toggleSidebar());
    expect(toggled.sidebarOpened).toBe(true);
  });

  it('should set sidebar open', () => {
    const state = layoutReducer(initialLayoutState, setSidebarOpen({ opened: false }));
    expect(state.sidebarOpened).toBe(false);
  });

  it('should set theme', () => {
    const state = layoutReducer(initialLayoutState, setTheme({ theme: 'dark' }));
    expect(state.theme).toBe('dark');
  });

  it('should set density', () => {
    const state = layoutReducer(initialLayoutState, setDensity({ density: 'compact' }));
    expect(state.density).toBe('compact');
  });
});

