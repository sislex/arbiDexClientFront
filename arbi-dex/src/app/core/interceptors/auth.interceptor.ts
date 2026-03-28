import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { take, switchMap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { selectAccessToken } from '../../features/auth/store/auth.selectors';
import { logout } from '../../features/auth/store/auth.actions';

/**
 * Функциональный HTTP-интерсептор:
 * 1. Прикрепляет JWT access-токен к каждому запросу (Authorization: Bearer)
 * 2. При 401-ответе — dispatch logout (очистка сессии + редирект)
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(Store);

  return store.select(selectAccessToken).pipe(
    take(1),
    switchMap((token) => {
      // Не прикрепляем токен к auth-запросам (nonce, verify, refresh)
      const isAuthRequest = req.url.includes('/auth/');
      const authReq =
        token && !isAuthRequest
          ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : req;

      return next(authReq).pipe(
        catchError((error) => {
          if (
            error instanceof HttpErrorResponse &&
            error.status === 401 &&
            !isAuthRequest
          ) {
            store.dispatch(logout());
          }
          return throwError(() => error);
        }),
      );
    }),
  );
};

