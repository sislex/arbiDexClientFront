import { createAction, props } from '@ngrx/store';
import { WalletProvider, AuthResult } from '../../../shared/models';

export const connectWalletRequest = createAction(
  '[Auth] Connect Wallet Request',
  props<{ provider: WalletProvider }>(),
);

export const connectWalletSuccess = createAction(
  '[Auth] Connect Wallet Success',
  props<{ authResult: AuthResult }>(),
);

export const connectWalletFailure = createAction(
  '[Auth] Connect Wallet Failure',
  props<{ error: string }>(),
);

/** Восстановление сессии из localStorage при старте */
export const restoreSession = createAction(
  '[Auth] Restore Session',
  props<{ authResult: AuthResult }>(),
);

export const logout = createAction('[Auth] Logout');

/** Обновление токенов после успешного refresh */
export const refreshTokenSuccess = createAction(
  '[Auth] Refresh Token Success',
  props<{ accessToken: string; refreshToken: string }>(),
);

