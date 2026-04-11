import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { IArbiConfigsService } from '../services/arbi-configs.service.interface';
import {
  loadArbiConfigs,
  loadArbiConfigsSuccess,
  loadArbiConfigsFailure,
  loadArbiConfig,
  loadArbiConfigSuccess,
  loadArbiConfigFailure,
  createArbiConfig,
  createArbiConfigSuccess,
  createArbiConfigFailure,
  updateArbiConfig,
  updateArbiConfigSuccess,
  updateArbiConfigFailure,
  deleteArbiConfig,
  deleteArbiConfigSuccess,
  deleteArbiConfigFailure,
  loadArbiConfigPrices,
  loadArbiConfigPricesSuccess,
  loadArbiConfigPricesFailure,
} from './arbi-configs.actions';

@Injectable()
export class ArbiConfigsEffects {
  private readonly actions$ = inject(Actions);
  private readonly service = inject(IArbiConfigsService);
  private readonly router = inject(Router);

  loadAll$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadArbiConfigs),
      switchMap(() =>
        this.service.getAll().pipe(
          map((configs) => loadArbiConfigsSuccess({ configs })),
          catchError((err) =>
            of(loadArbiConfigsFailure({ error: String(err?.error?.message ?? err) })),
          ),
        ),
      ),
    ),
  );

  loadOne$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadArbiConfig),
      switchMap(({ id }) =>
        this.service.getOne(id).pipe(
          map((config) => loadArbiConfigSuccess({ config })),
          catchError((err) =>
            of(loadArbiConfigFailure({ error: String(err?.error?.message ?? err) })),
          ),
        ),
      ),
    ),
  );

  create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(createArbiConfig),
      switchMap(({ payload }) =>
        this.service.create(payload).pipe(
          map((config) => createArbiConfigSuccess({ config })),
          catchError((err) =>
            of(createArbiConfigFailure({ error: String(err?.error?.message ?? err) })),
          ),
        ),
      ),
    ),
  );

  createSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(createArbiConfigSuccess),
        tap(({ config }) =>
          this.router.navigate(['/arbi-configs', config.id]),
        ),
      ),
    { dispatch: false },
  );

  update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateArbiConfig),
      switchMap(({ id, payload }) =>
        this.service.update(id, payload).pipe(
          map((config) => updateArbiConfigSuccess({ config })),
          catchError((err) =>
            of(updateArbiConfigFailure({ error: String(err?.error?.message ?? err) })),
          ),
        ),
      ),
    ),
  );

  delete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(deleteArbiConfig),
      switchMap(({ id }) =>
        this.service.remove(id).pipe(
          map(() => deleteArbiConfigSuccess({ id })),
          catchError((err) =>
            of(deleteArbiConfigFailure({ error: String(err?.error?.message ?? err) })),
          ),
        ),
      ),
    ),
  );

  deleteSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(deleteArbiConfigSuccess),
        tap(() => this.router.navigate(['/arbi-configs'])),
      ),
    { dispatch: false },
  );

  loadPrices$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadArbiConfigPrices),
      switchMap(({ id }) =>
        this.service.getPrices(id).pipe(
          map((pricesResponse) =>
            loadArbiConfigPricesSuccess({ id, pricesResponse }),
          ),
          catchError((err) =>
            of(loadArbiConfigPricesFailure({ error: String(err?.error?.message ?? err) })),
          ),
        ),
      ),
    ),
  );
}

