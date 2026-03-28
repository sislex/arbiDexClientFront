import { createAction, props } from '@ngrx/store';
import { WalletInfo, WalletProvider } from '../../../shared/models';

export const connectWalletRequest = createAction(
  '[Auth] Connect Wallet Request',
  props<{ provider: WalletProvider }>(),
);

export const connectWalletSuccess = createAction(
  '[Auth] Connect Wallet Success',
  props<{ walletInfo: WalletInfo }>(),
);

export const connectWalletFailure = createAction(
  '[Auth] Connect Wallet Failure',
  props<{ error: string }>(),
);

export const logout = createAction('[Auth] Logout');

