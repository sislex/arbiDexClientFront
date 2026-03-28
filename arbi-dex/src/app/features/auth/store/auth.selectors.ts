import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState } from '../../../shared/models';
import { AUTH_FEATURE_KEY } from './auth.reducer';

export const selectAuthState = createFeatureSelector<AuthState>(AUTH_FEATURE_KEY);

export const selectWalletAddress = createSelector(
  selectAuthState,
  (s) => s.walletAddress,
);

export const selectWalletProvider = createSelector(
  selectAuthState,
  (s) => s.walletProvider,
);

export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (s) => s.isAuthenticated,
);

export const selectIsConnected = createSelector(
  selectAuthState,
  (s) => s.isConnected,
);

export const selectAuthStatus = createSelector(
  selectAuthState,
  (s) => s.status,
);

export const selectAuthError = createSelector(
  selectAuthState,
  (s) => s.error,
);

export const selectIsConnecting = createSelector(
  selectAuthStatus,
  (status) => status === 'connecting',
);

export const selectAccessToken = createSelector(
  selectAuthState,
  (s) => s.accessToken,
);

export const selectRefreshToken = createSelector(
  selectAuthState,
  (s) => s.refreshToken,
);

export const selectUserId = createSelector(
  selectAuthState,
  (s) => s.userId,
);

