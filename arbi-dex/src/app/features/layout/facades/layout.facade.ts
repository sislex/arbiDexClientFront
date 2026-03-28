import { inject, Injectable, effect } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppTheme, AppDensity } from '../../../shared/models';
import { toggleSidebar, setSidebarOpen, setTheme, setDensity } from '../store/layout.actions';
import { selectSidebarOpened, selectTheme, selectDensity } from '../store/layout.selectors';

@Injectable({ providedIn: 'root' })
export class LayoutFacade {
  private readonly store = inject(Store);

  readonly sidebarOpened$ = this.store.select(selectSidebarOpened);
  readonly theme$ = this.store.select(selectTheme);
  readonly density$ = this.store.select(selectDensity);

  toggleSidebar(): void {
    this.store.dispatch(toggleSidebar());
  }

  setSidebarOpen(opened: boolean): void {
    this.store.dispatch(setSidebarOpen({ opened }));
  }

  setTheme(theme: AppTheme): void {
    this.store.dispatch(setTheme({ theme }));
  }

  setDensity(density: AppDensity): void {
    this.store.dispatch(setDensity({ density }));
  }
}

