import { createReducer, on } from '@ngrx/store';
import { AuthState } from '../../../shared/models';
import {
  connectWalletRequest,
  connectWalletSuccess,
  connectWalletFailure,
  restoreSession,
  logout,
} from './auth.actions';

export const AUTH_FEATURE_KEY = 'auth';

export const initialAuthState: AuthState = {
  walletAddress: null,
  walletProvider: null,
  userId: null,
  accessToken: null,
  refreshToken: null,
  isConnected: false,
  isAuthenticated: false,
  status: 'idle',
  error: null,
};

export const authReducer = createReducer(
  initialAuthState,

  on(connectWalletRequest, (state) => ({
    ...state,
    status: 'connecting' as const,
    error: null,
  })),

  on(connectWalletSuccess, (state, { authResult }) => ({
    ...state,
    walletAddress: authResult.walletInfo.address,
    walletProvider: authResult.walletInfo.provider,
    userId: authResult.userId,
    accessToken: authResult.accessToken,
    refreshToken: authResult.refreshToken,
    isConnected: true,
    isAuthenticated: true,
    status: 'connected' as const,
    error: null,
  })),

  on(restoreSession, (state, { authResult }) => ({
    ...state,
    walletAddress: authResult.walletInfo.address,
    walletProvider: authResult.walletInfo.provider,
    userId: authResult.userId,
    accessToken: authResult.accessToken,
    refreshToken: authResult.refreshToken,
    isConnected: true,
    isAuthenticated: true,
    status: 'connected' as const,
    error: null,
  })),

  on(connectWalletFailure, (state, { error }) => ({
    ...state,
    status: 'error' as const,
    error,
  })),

  on(logout, () => ({ ...initialAuthState })),
);

