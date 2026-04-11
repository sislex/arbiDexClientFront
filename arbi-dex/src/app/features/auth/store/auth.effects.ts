import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Router } from '@angular/router';
import { of, tap } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { IAuthService } from '../services/auth.service.interface';
import { AuthResult } from '../../../shared/models';
import {
  connectWalletRequest,
  connectWalletSuccess,
  connectWalletFailure,
  restoreSession,
  logout,
  refreshTokenSuccess,
} from './auth.actions';
import { APP_ROUTES } from '../../../shared/constants';

const STORAGE_KEY = 'arbidex_auth';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly authService = inject(IAuthService);
  private readonly router = inject(Router);

  /**
   * Полный цикл аутентификации:
   * 1. Подключение к кошельку → адрес
   * 2. Запрос nonce с бэкенда
   * 3. Подпись сообщения кошельком
   * 4. Верификация подписи на бэкенде → JWT-токены
   */
  connectWallet$ = createEffect(() =>
    this.actions$.pipe(
      ofType(connectWalletRequest),
      switchMap(({ provider }) =>
        this.authService.connectWallet(provider).pipe(
          switchMap((walletInfo) =>
            this.authService.getNonce(walletInfo.address).pipe(
              switchMap(({ nonce }) => {
                const message = `Войти в ArbiDex\nNonce: ${nonce}`;
                return this.authService.signMessage(message, walletInfo.address).pipe(
                  switchMap((signature) =>
                    this.authService.verifySignature(
                      walletInfo.address,
                      signature,
                      provider,
                    ).pipe(
                      map((response) => {
                        const authResult: AuthResult = {
                          walletInfo,
                          accessToken: response.accessToken,
                          refreshToken: response.refreshToken,
                          userId: response.user.id,
                        };
                        return connectWalletSuccess({ authResult });
                      }),
                    ),
                  ),
                );
              }),
            ),
          ),
          catchError((err: unknown) =>
            of(connectWalletFailure({ error: err instanceof Error ? err.message : String(err) })),
          ),
        ),
      ),
    ),
  );

  /** Сохранение сессии в localStorage при успешной аутентификации */
  persistAuth$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(connectWalletSuccess),
        tap(({ authResult }) => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(authResult));
        }),
      ),
    { dispatch: false },
  );

  /** Восстановление сессии из localStorage при инициализации */
  initAuth$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const authResult: AuthResult = JSON.parse(stored);
            if (authResult.accessToken && authResult.walletInfo?.address) {
              return restoreSession({ authResult });
            }
          }
        } catch { /* ignore corrupt data */ }
        return { type: '[Auth] No Stored Session' };
      }),
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

  /** Очистка localStorage и редирект при выходе */
  logoutCleanup$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(logout),
        tap(() => {
          localStorage.removeItem(STORAGE_KEY);
          this.router.navigate([APP_ROUTES.LOGIN]);
        }),
      ),
    { dispatch: false },
  );

  /** Сохранение обновлённых токенов в localStorage после refresh */
  persistRefresh$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(refreshTokenSuccess),
        tap(({ accessToken, refreshToken }) => {
          try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              const authResult = JSON.parse(stored);
              authResult.accessToken = accessToken;
              authResult.refreshToken = refreshToken;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(authResult));
            }
          } catch { /* ignore */ }
        }),
      ),
    { dispatch: false },
  );
}

