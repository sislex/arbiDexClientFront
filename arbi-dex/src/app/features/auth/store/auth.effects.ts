import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Router } from '@angular/router';
import { of, tap } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { IAuthService } from '../services/auth.service.interface';
import {
  connectWalletRequest,
  connectWalletSuccess,
  connectWalletFailure,
  logout,
} from './auth.actions';
import { APP_ROUTES } from '../../../shared/constants';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly authService = inject(IAuthService);
  private readonly router = inject(Router);

  connectWallet$ = createEffect(() =>
    this.actions$.pipe(
      ofType(connectWalletRequest),
      switchMap(({ provider }) =>
        this.authService.connectWallet(provider).pipe(
          map((walletInfo) => connectWalletSuccess({ walletInfo })),
          catchError((err: unknown) =>
            of(connectWalletFailure({ error: String(err) })),
          ),
        ),
      ),
    ),
  );

  redirectAfterLogin$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(connectWalletSuccess),
        tap(() => this.router.navigate([APP_ROUTES.DASHBOARD])),
      ),
    { dispatch: false },
  );

  redirectAfterLogout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(logout),
        tap(() => this.router.navigate([APP_ROUTES.LOGIN])),
      ),
    { dispatch: false },
  );
}

