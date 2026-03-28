import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthFacade } from '../../features/auth/facades/auth.facade';
import { APP_ROUTES } from '../../shared/constants';

export const authGuard: CanActivateFn = () => {
  const authFacade = inject(AuthFacade);
  const router = inject(Router);

  return authFacade.isAuthenticated$.pipe(
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated) return true;
      return router.createUrlTree([APP_ROUTES.LOGIN]);
    }),
  );
};

