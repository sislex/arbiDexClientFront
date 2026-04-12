import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  CreateArbiConfigPayload,
  UpdateArbiConfigPayload,
} from '../services/arbi-configs.service.interface';
import {
  loadArbiConfigs,
  loadArbiConfig,
  createArbiConfig,
  updateArbiConfig,
  deleteArbiConfig,
  loadArbiConfigPrices,
  runBacktest,
  clearBacktestResult,
} from '../store/arbi-configs.actions';
import {
  selectAllArbiConfigs,
  selectArbiConfigsTotal,
  selectArbiConfigById,
  selectArbiConfigsLoading,
  selectArbiConfigsCreating,
  selectArbiConfigsError,
  selectArbiConfigCurrentPrices,
  selectArbiConfigPricesLoading,
  selectBacktestResult,
  selectBacktestLoading,
} from '../store/arbi-configs.selectors';

@Injectable({ providedIn: 'root' })
export class ArbiConfigsFacade {
  private readonly store = inject(Store);

  readonly all$ = this.store.select(selectAllArbiConfigs);
  readonly total$ = this.store.select(selectArbiConfigsTotal);
  readonly loading$ = this.store.select(selectArbiConfigsLoading);
  readonly creating$ = this.store.select(selectArbiConfigsCreating);
  readonly error$ = this.store.select(selectArbiConfigsError);
  readonly currentPrices$ = this.store.select(selectArbiConfigCurrentPrices);
  readonly pricesLoading$ = this.store.select(selectArbiConfigPricesLoading);
  readonly backtestResult$ = this.store.select(selectBacktestResult);
  readonly backtestLoading$ = this.store.select(selectBacktestLoading);

  selectById(id: string) {
    return this.store.select(selectArbiConfigById(id));
  }

  load(): void {
    this.store.dispatch(loadArbiConfigs());
  }

  loadOne(id: string): void {
    this.store.dispatch(loadArbiConfig({ id }));
  }

  create(payload: CreateArbiConfigPayload): void {
    this.store.dispatch(createArbiConfig({ payload }));
  }

  update(id: string, payload: UpdateArbiConfigPayload): void {
    this.store.dispatch(updateArbiConfig({ id, payload }));
  }

  delete(id: string): void {
    this.store.dispatch(deleteArbiConfig({ id }));
  }

  loadPrices(id: string): void {
    this.store.dispatch(loadArbiConfigPrices({ id }));
  }

  refreshPrices(id: string): void {
    this.store.dispatch(loadArbiConfigPrices({ id, noCache: true }));
  }

  runBacktest(id: string): void {
    this.store.dispatch(runBacktest({ id }));
  }

  clearBacktestResult(): void {
    this.store.dispatch(clearBacktestResult());
  }
}
