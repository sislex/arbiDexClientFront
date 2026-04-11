import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { take, switchMap, catchError, filter } from 'rxjs/operators';
import { throwError, BehaviorSubject, Observable } from 'rxjs';
import { selectAccessToken, selectRefreshToken } from '../../features/auth/store/auth.selectors';
import { logout, refreshTokenSuccess } from '../../features/auth/store/auth.actions';
import { IAuthService } from '../../features/auth/services/auth.service.interface';

/** Флаг — идёт ли сейчас процесс обновления токена */
let isRefreshing = false;
/** Subject для ожидания нового токена другими запросами */
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * Функциональный HTTP-интерсептор:
 * 1. Прикрепляет JWT access-токен к каждому запросу (Authorization: Bearer)
 * 2. При 401-ответе — пытается обновить токен через refresh endpoint
 * 3. Если refresh тоже не сработал — dispatch logout
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(Store);
  const authService = inject(IAuthService);

  return store.select(selectAccessToken).pipe(
    take(1),
    switchMap((token) => {
      // Не прикрепляем токен к auth-запросам (nonce, verify, refresh)
      const isAuthRequest = req.url.includes('/auth/');
      const authReq = token && !isAuthRequest
        ? addToken(req, token)
        : req;

      return next(authReq).pipe(
        catchError((error) => {
          if (
            error instanceof HttpErrorResponse &&
            error.status === 401 &&
            !isAuthRequest
          ) {
            return handle401(store, authService, req, next);
          }
          return throwError(() => error);
        }),
      );
    }),
  );
};

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handle401(
  store: Store,
  authService: IAuthService,
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return store.select(selectRefreshToken).pipe(
      take(1),
      switchMap((refreshToken) => {
        if (!refreshToken) {
          // Нет refresh-токена — сразу logout
          isRefreshing = false;
          store.dispatch(logout());
          return throwError(() => new Error('No refresh token'));
        }

        return authService.refresh(refreshToken).pipe(
          switchMap((tokens) => {
            isRefreshing = false;
            // Обновляем токены в store и localStorage
            store.dispatch(refreshTokenSuccess({
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
            }));
            refreshTokenSubject.next(tokens.accessToken);
            // Повторяем оригинальный запрос с новым токеном
            return next(addToken(req, tokens.accessToken));
          }),
          catchError((refreshErr) => {
            // Refresh не удался — logout
            isRefreshing = false;
            refreshTokenSubject.next(null);
            store.dispatch(logout());
            return throwError(() => refreshErr);
          }),
        );
      }),
    );
  } else {
    // Другой запрос уже обновляет токен — ждём нового токена
    return refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next(addToken(req, token!))),
    );
  }
}
