import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { loadPairs, loadSources } from '../store/catalog.actions';
import {
  selectCatalogLoading,
  selectPairs,
  selectSources,
} from '../store/catalog.selectors';

@Injectable({ providedIn: 'root' })
export class CatalogFacade {
  private readonly store = inject(Store);

  readonly sources$ = this.store.select(selectSources);
  readonly pairs$ = this.store.select(selectPairs);
  readonly loading$ = this.store.select(selectCatalogLoading);

  loadSources(): void {
    this.store.dispatch(loadSources());
  }

  loadPairs(): void {
    this.store.dispatch(loadPairs());
  }

  loadAll(): void {
    this.loadSources();
    this.loadPairs();
  }
}

