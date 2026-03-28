import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { ICatalogService } from '../services/catalog-mock.service';
import {
  loadPairs, loadPairsFailure, loadPairsSuccess,
  loadSources, loadSourcesFailure, loadSourcesSuccess,
} from './catalog.actions';

@Injectable()
export class CatalogEffects {
  private readonly actions$ = inject(Actions);
  private readonly catalogService = inject(ICatalogService);

  loadSources$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadSources),
      switchMap(() =>
        this.catalogService.getSources().pipe(
          map((sources) => loadSourcesSuccess({ sources })),
          catchError((err: unknown) =>
            of(loadSourcesFailure({ error: String(err) })),
          ),
        ),
      ),
    ),
  );

  loadPairs$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadPairs),
      switchMap(() =>
        this.catalogService.getPairs().pipe(
          map((pairs) => loadPairsSuccess({ pairs })),
          catchError((err: unknown) =>
            of(loadPairsFailure({ error: String(err) })),
          ),
        ),
      ),
    ),
  );
}

